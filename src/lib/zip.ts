/**
 * Penulis berkas ZIP — **tanpa pemadatan** (metode 0, "stored").
 *
 * Mengapa ditulis sendiri, bukan memakai pustaka: aplikasi ini harus tetap
 * **luring dan nol biaya**, dan berkas portabelnya sudah 850 KB. Menambah
 * pustaka kompresi untuk sekadar membungkus 18 berkas teks kecil tidak
 * sebanding — lagipula isinya sudah padat, jadi pemadatan nyaris tidak
 * menghemat apa pun dibandingkan sekadar menyimpannya.
 *
 * Tanpa pemadatan, satu-satunya yang perlu dihitung adalah **CRC32**,
 * itulah sebabnya seluruh modul ini cukup pendek.
 *
 * Yang sengaja tidak didukung: berkas di atas 4 GB, enkripsi, dan direktori.
 * Tidak ada satu pun yang dibutuhkan untuk membagikan paket ke anggota.
 */

/** Tabel CRC32 — dihitung sekali, dipakai untuk semua berkas. */
const TABEL = (() => {
  const t = new Uint32Array(256)
  for (let i = 0; i < 256; i += 1) {
    let c = i
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[i] = c >>> 0
  }
  return t
})()

/** CRC32 dari deretan bita — dipakai di tajuk ZIP. */
export function crc32(bita: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < bita.length; i += 1) c = TABEL[(c ^ bita[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/** Satu berkas yang akan dimasukkan ke ZIP. */
export interface EntriZip {
  /** Nama berkas **di dalam** ZIP, mis. `DrillKit-Andra-A07.json`. */
  nama: string
  /** Isinya dalam bentuk teks; dikodekan UTF-8. */
  isi: string
}

/** Waktu DOS (16 bit): jam/menit/detik dan tanggal, untuk tajuk ZIP. */
function waktuDos(d: Date) {
  const jam = d.getHours()
  const menit = d.getMinutes()
  const detik = Math.floor(d.getSeconds() / 2)
  const tahun = Math.max(1980, d.getFullYear())
  return {
    waktu: (jam << 11) | (menit << 5) | detik,
    tanggal: ((tahun - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  }
}

/**
 * Bungkus beberapa berkas menjadi satu ZIP tanpa pemadatan.
 *
 * Hasilnya berupa `Uint8Array`, bukan `Blob`, supaya **modul ini murni dan
 * bisa diuji di node** tanpa peramban. Panggilan yang mengubahnya menjadi
 * `Blob` dilakukan di luar sini.
 */
export function bikinZip(entri: EntriZip[], sekarang = new Date()): Uint8Array {
  const teks = new TextEncoder()
  const { waktu, tanggal } = waktuDos(sekarang)

  // Sekali jalan: tiap berkas disiapkan lebih dulu supaya ukuran totalnya
  // diketahui sebelum mulai menulis.
  const siap = entri.map((e) => {
    const nama = teks.encode(e.nama)
    const isi = teks.encode(e.isi)
    return { nama, isi, crc: crc32(isi) }
  })

  const ukur = (s: Uint8Array) => s.length
  let total = 0
  for (const s of siap) total += 30 + ukur(s.nama) + ukur(s.isi) + 46 + ukur(s.nama)
  total += 22

  const out = new Uint8Array(total)
  const dv = new DataView(out.buffer)
  let o = 0
  const u16 = (v: number) => { dv.setUint16(o, v, true); o += 2 }
  const u32 = (v: number) => { dv.setUint32(o, v >>> 0, true); o += 4 }
  const bita = (b: Uint8Array) => { out.set(b, o); o += b.length }

  const posisi: { offset: number; crc: number; ukuran: number; nama: Uint8Array }[] = []

  for (const s of siap) {
    posisi.push({ offset: o, crc: s.crc, ukuran: s.isi.length, nama: s.nama })
    u32(0x04034b50)  // tanda tangan tajuk lokal
    u16(20)          // versi minimal
    u16(0x0800)      // bendera: nama berkas UTF-8
    u16(0)           // metode: tanpa pemadatan
    u16(waktu)
    u16(tanggal)
    u32(s.crc)
    u32(s.isi.length)  // ukuran terpadatkan
    u32(s.isi.length)  // ukuran asli
    u16(s.nama.length)
    u16(0)             // panjang kolom tambahan
    bita(s.nama)
    bita(s.isi)
  }

  const awalPusat = o
  for (const s of posisi) {
    u32(0x02014b50)  // tanda tangan direktori pusat
    u16(20)          // versi pembuat
    u16(20)          // versi minimal
    u16(0x0800)
    u16(0)
    u16(waktu)
    u16(tanggal)
    u32(s.crc)
    u32(s.ukuran)
    u32(s.ukuran)
    u16(s.nama.length)
    u16(0)           // tambahan
    u16(0)           // komentar
    u16(0)           // nomor cakram
    u16(0)           // atribut internal
    u32(0)           // atribut eksternal
    u32(s.offset)
    bita(s.nama)
  }
  const ukuranPusat = o - awalPusat

  u32(0x06054b50)  // akhir direktori pusat
  u16(0)
  u16(0)
  u16(posisi.length)
  u16(posisi.length)
  u32(ukuranPusat)
  u32(awalPusat)
  u16(0)           // panjang komentar

  return out.subarray(0, o)
}
