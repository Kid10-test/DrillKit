/**
 * #11b — Pengurai arsip `.mxl` (MusicXML terkompresi).
 *
 * **Kenapa modul terpisah dari `zip.ts` (keputusan D3 rancangan 11b).**
 * `src/lib/zip.ts` sengaja hanya mendukung metode 0 (*stored* / tanpa
 * pemadatan) dan dipakai jalur paling sensitif di aplikasi: *backup &
 * pulihkan* serta paket anggota. Sementara berkas `.mxl` bawaan MuseScore,
 * Finale, Sibelius, dan Dorico hampir selalu memadatkan isinya dengan
 * *deflate* (metode 8), dan banyak pengekspor menulis *streaming data
 * descriptor* (`bendera & 0x0008`) yang membuat `compSize` di *local file
 * header* bernilai `0`.
 *
 * Supaya jalur backup sama sekali tidak tersentuh risiko regresi, `.mxl`
 * diurai di modul khusus ini dengan tiga pengaman:
 *
 * 1. **Membaca dari *Central Directory* ZIP (`0x06054b50` → `0x02014b50`)**,
 *    bukan menelusuri *local header* dari depan — di *Central Directory*,
 *    ukuran padat, ukuran asli, metode kompresi, dan CRC-32 selalu terisi
 *    meskipun berkas ditulis secara *streaming* (`flag & 0x08`).
 * 2. **Mendekompresi lewat `DecompressionStream('deflate-raw')` bawaan
 *    peramban & Node ≥ 18** — nol pustaka tambahan, sambil memotong aliran
 *    seketika bila keluaran melewati `BATAS_BITA` (8 MB, anti-*zip-bomb*)
 *    dan memverifikasi `crc32` sesudahnya.
 * 3. **Cadangan jujur untuk peramban lama** (mis. iOS Safari < 16.4 atau
 *    Firefox < 113 yang belum punya `DecompressionStream`): tidak pernah
 *    melempar `ReferenceError`, melainkan mengembalikan pesan petunjuk cara
 *    menyimpan ulang sebagai `.musicxml` tak terkompresi.
 *
 * Modul ini **murni** (tanpa DOM, tanpa Dexie), dirakit `qa/bangun-logika.sh`,
 * dan diuji langsung di Node (`qa/mxl-logika.mjs`).
 */
import { BATAS_BITA, deteksiPartitur, teksPartitur } from './partitur'
import { crc32 } from './zip'

/* ------------------------------- Konstanta ------------------------------ */

const SIG_LOKAL = 0x04034b50
const SIG_PUSAT = 0x02014b50
const SIG_AKHIR_PUSAT = 0x06054b50

const METODE_STORED = 0
const METODE_DEFLATE = 8

/** Komentar akhir ZIP paling panjang menurut spesifikasi PKWARE (65.535 bita). */
const MAKS_KOMENTAR_ZIP = 0xffff

/**
 * Pesan cadangan bila peramban perangkat terlalu lama sehingga belum memiliki
 * `DecompressionStream('deflate-raw')` untuk membuka entri `.mxl` terkompresi.
 */
export const PESAN_MXL_PERAMBAN_LAMA =
  'Peramban di perangkat ini belum mendukung pembukaan berkas .mxl terkompresi secara langsung. ' +
  "Simpan ulang dari MuseScore/Sibelius/Finale sebagai 'MusicXML (*.musicxml)' tak terkompresi, " +
  'atau buka di peramban yang lebih baru.'

/* --------------------------------- Tipe --------------------------------- */

export type HasilUraiMxl =
  | {
      ok: true
      /** Bita MusicXML utama hasil ekstraksi (siap masuk `putusanPartitur` & `Blob`). */
      bitaXml: Uint8Array
      /** Jalur berkas utama di dalam arsip `.mxl`, mis. `"score.xml"`. */
      jalurUtama: string
    }
  | {
      ok: false
      /** Pesan Bahasa Indonesia yang menyebut penyebab & langkah berikutnya. */
      alasan: string
    }

interface EntriPusatZip {
  nama: string
  bendera: number
  metode: number
  crc: number
  ukuranPadat: number
  ukuranAsli: number
  offsetLokal: number
}

interface KonstruktorDecompressionStream {
  new (format: string): {
    readonly readable: ReadableStream<Uint8Array>
    readonly writable: WritableStream<Uint8Array>
  }
}

/* ------------------------------- Perkakas ------------------------------- */

const dekoderUtf8 = new TextDecoder('utf-8')

function formatMb(bita: number): string {
  const mb = bita / (1024 * 1024)
  return Number.isInteger(mb) ? `${mb} MB` : `${mb.toFixed(1).replace('.', ',')} MB`
}

function normalisasiJalur(jalur: string): string {
  return jalur
    .replace(/\\/g, '/')
    .replace(/^(\.\/)+/, '')
    .replace(/^\/+/, '')
    .trim()
}

function magicZip(bita: Uint8Array): boolean {
  return (
    bita.length >= 4 &&
    bita[0] === 0x50 &&
    bita[1] === 0x4b &&
    (bita[2] === 3 || bita[2] === 5 || bita[2] === 7)
  )
}

function memuatAscii(bita: Uint8Array, cari: string): boolean {
  const n = cari.length
  if (bita.length < n) return false
  const awal = cari.charCodeAt(0)
  for (let i = 0; i + n <= bita.length; i += 1) {
    if (bita[i] !== awal) continue
    let cocok = true
    for (let j = 1; j < n; j += 1) {
      if (bita[i + j] !== cari.charCodeAt(j)) {
        cocok = false
        break
      }
    }
    if (cocok) return true
  }
  return false
}

/**
 * Ubah nama berkas `.mxl` menjadi `.musicxml` ketika bita XML hasil urai
 * disimpan ke `partiturBerkas` / dikemas ke ZIP backup.
 */
export function namaMusicXmlDariMxl(namaFile: string): string {
  const bersih = namaFile.trim() || 'partitur'
  if (/\.mxl$/i.test(bersih)) return bersih.replace(/\.mxl$/i, '.musicxml')
  if (/\.(musicxml|xml)$/i.test(bersih)) return bersih
  return `${bersih}.musicxml`
}

/**
 * Pemeriksaan sinkron cepat: apakah deretan bita ini adalah arsip ZIP yang
 * memuat penanda baku MusicXML terkompresi (`META-INF/container.xml`)?
 */
export function apakahMxl(bita: Uint8Array): boolean {
  if (!magicZip(bita)) return false
  return (
    memuatAscii(bita, 'META-INF/container.xml') ||
    memuatAscii(bita, 'META-INF\\container.xml')
  )
}

/* ----------------------- Pembaca Central Directory ---------------------- */

/**
 * Cari rekaman *End of Central Directory* (`0x06054b50`) dari ekor berkas,
 * lalu urai seluruh entri di *Central Directory* (`0x02014b50`).
 */
function bacaDirektoriPusat(
  bita: Uint8Array,
): { ok: true; entri: EntriPusatZip[] } | { ok: false; alasan: string } {
  if (bita.length < 22) {
    return { ok: false, alasan: 'berkas .mxl rusak: ukuran terlalu kecil untuk arsip ZIP' }
  }
  const dv = new DataView(bita.buffer, bita.byteOffset, bita.byteLength)
  const batasBawah = Math.max(0, bita.length - 22 - MAKS_KOMENTAR_ZIP)

  let posEocd = -1
  let cadanganEocd = -1
  for (let p = bita.length - 22; p >= batasBawah; p -= 1) {
    if (dv.getUint32(p, true) !== SIG_AKHIR_PUSAT) continue
    const panjangKomentar = dv.getUint16(p + 20, true)
    if (p + 22 + panjangKomentar === bita.length) {
      posEocd = p
      break
    }
    if (cadanganEocd < 0 && p + 22 + panjangKomentar <= bita.length) {
      cadanganEocd = p
    }
  }
  if (posEocd < 0) posEocd = cadanganEocd
  if (posEocd < 0) {
    return {
      ok: false,
      alasan: 'berkas .mxl rusak: penutup direktori ZIP (EOCD) tidak ditemukan — arsip kemungkinan terpotong',
    }
  }

  const nomorDisk = dv.getUint16(posEocd + 4, true)
  const diskPusat = dv.getUint16(posEocd + 6, true)
  if (nomorDisk !== 0 || diskPusat !== 0) {
    return { ok: false, alasan: 'arsip ZIP multi-cakram tidak didukung' }
  }

  const jumlahEntri = dv.getUint16(posEocd + 10, true)
  const ukuranPusat = dv.getUint32(posEocd + 12, true)
  const offsetPusat = dv.getUint32(posEocd + 16, true)

  if (jumlahEntri === 0xffff || ukuranPusat === 0xffffffff || offsetPusat === 0xffffffff) {
    return { ok: false, alasan: 'arsip ZIP64 tidak didukung untuk berkas partitur' }
  }
  if (offsetPusat + ukuranPusat > posEocd) {
    return { ok: false, alasan: 'berkas .mxl rusak: direktori pusat ZIP melampaui batas berkas' }
  }

  const entri: EntriPusatZip[] = []
  let o = offsetPusat
  const akhirPusat = offsetPusat + ukuranPusat

  for (let indeks = 0; indeks < jumlahEntri && o < akhirPusat; indeks += 1) {
    if (o + 46 > akhirPusat) {
      return { ok: false, alasan: 'berkas .mxl rusak: tajuk direktori pusat ZIP terpotong' }
    }
    if (dv.getUint32(o, true) !== SIG_PUSAT) {
      return { ok: false, alasan: 'berkas .mxl rusak: tanda tangan direktori pusat ZIP tidak cocok' }
    }
    const bendera = dv.getUint16(o + 8, true)
    const metode = dv.getUint16(o + 10, true)
    const crc = dv.getUint32(o + 16, true)
    const ukuranPadat = dv.getUint32(o + 20, true)
    const ukuranAsli = dv.getUint32(o + 24, true)
    const panjangNama = dv.getUint16(o + 28, true)
    const panjangEkstra = dv.getUint16(o + 30, true)
    const panjangKomentar = dv.getUint16(o + 32, true)
    const offsetLokal = dv.getUint32(o + 42, true)

    const akhirHeader = o + 46 + panjangNama + panjangEkstra + panjangKomentar
    if (akhirHeader > akhirPusat) {
      return { ok: false, alasan: 'berkas .mxl rusak: nama berkas di direktori pusat ZIP terpotong' }
    }
    const namaMentah = dekoderUtf8.decode(bita.subarray(o + 46, o + 46 + panjangNama))
    entri.push({
      nama: normalisasiJalur(namaMentah),
      bendera,
      metode,
      crc,
      ukuranPadat,
      ukuranAsli,
      offsetLokal,
    })
    o = akhirHeader
  }

  return { ok: true, entri }
}

/* -------------------------- Dekompresi Entri ---------------------------- */

function ambilDecompressionStream(): KonstruktorDecompressionStream | null {
  const kandidat = (globalThis as { DecompressionStream?: unknown }).DecompressionStream
  return typeof kandidat === 'function' ? (kandidat as KonstruktorDecompressionStream) : null
}

async function uraiDeflateRaw(
  padat: Uint8Array,
  namaEntri: string,
): Promise<{ ok: true; bita: Uint8Array } | { ok: false; alasan: string }> {
  const Ctor = ambilDecompressionStream()
  if (!Ctor) {
    return { ok: false, alasan: PESAN_MXL_PERAMBAN_LAMA }
  }

  let ds: InstanceType<KonstruktorDecompressionStream>
  try {
    ds = new Ctor('deflate-raw')
  } catch {
    return { ok: false, alasan: PESAN_MXL_PERAMBAN_LAMA }
  }

  const penulis = ds.writable.getWriter()
  const pembaca = ds.readable.getReader()

  // Tulis secara serempak dengan pembacaan: buffer internal TransformStream
  // terbatas, jadi menunggu `write` selesai sebelum `read` akan macet pada
  // partitur besar. `.catch` dipasang agar pembatalan dini (saat melewati
  // BATAS_BITA) tidak memicu unhandledRejection di Node/peramban.
  const janjiTulis = (async () => {
    await penulis.write(padat)
    await penulis.close()
  })()
  janjiTulis.catch(() => {})

  const kepingan: Uint8Array[] = []
  let total = 0

  try {
    for (;;) {
      const { value, done } = await pembaca.read()
      if (done) break
      if (!value || value.byteLength === 0) continue
      total += value.byteLength
      if (total > BATAS_BITA) {
        await pembaca.cancel('melebihi batas ukuran partitur').catch(() => {})
        await penulis.abort('melebihi batas ukuran partitur').catch(() => {})
        return {
          ok: false,
          alasan: `isi "${namaEntri}" di dalam .mxl melebihi batas ${formatMb(BATAS_BITA)} setelah dibuka`,
        }
      }
      kepingan.push(value)
    }
    await janjiTulis
  } catch {
    return {
      ok: false,
      alasan: `berkas .mxl rusak: gagal mendekompresi "${namaEntri}" (aliran deflate cacat atau terpotong)`,
    }
  } finally {
    try {
      pembaca.releaseLock()
    } catch {
      // sudah lepas — abaikan
    }
  }

  const gabung = new Uint8Array(total)
  let pos = 0
  for (const k of kepingan) {
    gabung.set(k, pos)
    pos += k.byteLength
  }
  return { ok: true, bita: gabung }
}

/**
 * Ekstrak satu entri berdasarkan rekaman *Central Directory*-nya, periksa
 * batas ukuran 8 MB, dan cocokkan CRC-32.
 */
async function ekstrakEntri(
  arsip: Uint8Array,
  entri: EntriPusatZip,
): Promise<{ ok: true; bita: Uint8Array } | { ok: false; alasan: string }> {
  if ((entri.bendera & 0x0001) !== 0) {
    return { ok: false, alasan: `arsip .mxl terenkripsi/berkata-sandi tidak didukung ("${entri.nama}")` }
  }
  if (entri.ukuranAsli > BATAS_BITA) {
    return {
      ok: false,
      alasan: `isi "${entri.nama}" (${formatMb(entri.ukuranAsli)}) melebihi batas ${formatMb(BATAS_BITA)}`,
    }
  }
  if (entri.ukuranPadat > BATAS_BITA) {
    return {
      ok: false,
      alasan: `entri terkompresi "${entri.nama}" (${formatMb(entri.ukuranPadat)}) melebihi batas ${formatMb(BATAS_BITA)}`,
    }
  }

  const dv = new DataView(arsip.buffer, arsip.byteOffset, arsip.byteLength)
  if (entri.offsetLokal + 30 > arsip.length || dv.getUint32(entri.offsetLokal, true) !== SIG_LOKAL) {
    return {
      ok: false,
      alasan: `berkas .mxl rusak: tajuk lokal ZIP untuk "${entri.nama}" tidak valid`,
    }
  }

  // Panjang nama & kolom ekstra di tajuk lokal BOLEH berbeda dari direktori
  // pusat (mis. Info-ZIP menulis timestamp ekstra 9 bita di lokal vs 5 bita
  // di pusat), jadi awal data selalu dihitung dari tajuk lokal itu sendiri,
  // sementara panjang datanya (`ukuranPadat`) diambil dari direktori pusat.
  const panjangNamaLokal = dv.getUint16(entri.offsetLokal + 26, true)
  const panjangEkstraLokal = dv.getUint16(entri.offsetLokal + 28, true)
  const awalData = entri.offsetLokal + 30 + panjangNamaLokal + panjangEkstraLokal
  const akhirData = awalData + entri.ukuranPadat
  if (awalData < 0 || akhirData > arsip.length) {
    return {
      ok: false,
      alasan: `berkas .mxl rusak: data entri "${entri.nama}" terpotong sebelum akhir berkas`,
    }
  }

  const potongan = arsip.subarray(awalData, akhirData)
  let hasilBita: Uint8Array

  if (entri.metode === METODE_STORED) {
    if (entri.ukuranPadat !== entri.ukuranAsli) {
      return {
        ok: false,
        alasan: `berkas .mxl rusak: ukuran stored "${entri.nama}" tidak konsisten`,
      }
    }
    hasilBita = new Uint8Array(potongan)
  } else if (entri.metode === METODE_DEFLATE) {
    const urai = await uraiDeflateRaw(potongan, entri.nama)
    if (!urai.ok) return urai
    hasilBita = urai.bita
  } else {
    return {
      ok: false,
      alasan: `metode kompresi ZIP #${entri.metode} pada "${entri.nama}" tidak didukung (hanya stored/deflate)`,
    }
  }

  if (hasilBita.length !== entri.ukuranAsli) {
    return {
      ok: false,
      alasan: `berkas .mxl rusak: panjang hasil "${entri.nama}" (${hasilBita.length} B) tidak sesuai tajuk (${entri.ukuranAsli} B)`,
    }
  }

  const hitungCrc = crc32(hasilBita)
  if (hitungCrc !== entri.crc) {
    return {
      ok: false,
      alasan: `berkas .mxl rusak: cek keutuhan CRC-32 gagal pada "${entri.nama}"`,
    }
  }

  return { ok: true, bita: hasilBita }
}

/* --------------------- Pengurai META-INF/container.xml ------------------ */

const ENTITAS_DASAR: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
}

function dekodeAtributXmlRingan(nilai: string): string {
  return nilai.replace(/&(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);/g, (utuh, isi: string) => {
    if (isi in ENTITAS_DASAR) return ENTITAS_DASAR[isi]
    const kode = isi.startsWith('#x') || isi.startsWith('#X')
      ? Number.parseInt(isi.slice(2), 16)
      : isi.startsWith('#')
        ? Number.parseInt(isi.slice(1), 10)
        : Number.NaN
    return Number.isFinite(kode) && kode > 0 ? String.fromCodePoint(kode) : utuh
  })
}

interface CalonRootfile {
  fullPath: string
  mediaType: string
}

/**
 * Ambil daftar `<rootfile full-path="…" media-type="…">` dari teks
 * `META-INF/container.xml`, lalu pilih yang menunjuk ke berkas MusicXML utama
 * (bukan lampiran gambar *thumbnail* atau PDF pratinjau).
 */
function pilihJalurUtamaContainer(teksContainer: string): string | null {
  const calon: CalonRootfile[] = []
  const polaRootfile = /<rootfile\b([^>]*?)\/?>/gi
  let cocok: RegExpExecArray | null

  while ((cocok = polaRootfile.exec(teksContainer)) !== null) {
    const blokAtribut = cocok[1]
    const polaAttr = /([A-Za-z0-9_.:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g
    let attr: RegExpExecArray | null
    let fullPath = ''
    let mediaType = ''
    while ((attr = polaAttr.exec(blokAtribut)) !== null) {
      const kunci = attr[1].toLowerCase()
      const nilai = dekodeAtributXmlRingan(attr[2] ?? attr[3] ?? '')
      if (kunci === 'full-path' || kunci.endsWith(':full-path')) fullPath = normalisasiJalur(nilai)
      else if (kunci === 'media-type' || kunci.endsWith(':media-type')) mediaType = nilai.trim().toLowerCase()
    }
    if (fullPath) calon.push({ fullPath, mediaType })
  }

  if (calon.length === 0) return null

  const bukanMxlSendiri = (j: string) => !/\.mxl$/i.test(j)
  const bukanLampiranVisual = (c: CalonRootfile) =>
    !c.mediaType.startsWith('image/') &&
    c.mediaType !== 'application/pdf' &&
    !/\.(pdf|png|jpe?g|gif|svg|webp)$/i.test(c.fullPath)

  // Prioritas 1: media-type resmi MusicXML tak terkompresi.
  const prio1 = calon.find(
    (c) => c.mediaType.includes('musicxml') && !c.mediaType.endsWith('+zip') && bukanMxlSendiri(c.fullPath),
  )
  if (prio1) return prio1.fullPath

  // Prioritas 2: berekstensi .musicxml atau .xml (dan bukan container itu sendiri).
  const prio2 = calon.find(
    (c) =>
      bukanLampiranVisual(c) &&
      /\.(musicxml|xml)$/i.test(c.fullPath) &&
      c.fullPath.toLowerCase() !== 'meta-inf/container.xml',
  )
  if (prio2) return prio2.fullPath

  // Prioritas 3: rootfile pertama yang bukan PDF/gambar.
  const prio3 = calon.find((c) => bukanLampiranVisual(c) && bukanMxlSendiri(c.fullPath))
  return prio3 ? prio3.fullPath : null
}

function cariEntri(daftar: EntriPusatZip[], jalur: string): EntriPusatZip | undefined {
  const target = normalisasiJalur(jalur)
  const persis = daftar.find((e) => e.nama === target)
  if (persis) return persis
  const kecil = target.toLowerCase()
  return daftar.find((e) => e.nama.toLowerCase() === kecil)
}

/* ----------------------------- Fungsi Utama ----------------------------- */

/**
 * Ekstrak berkas MusicXML utama dari arsip `.mxl` (mendukung metode 0 *stored*
 * maupun metode 8 *deflate*, termasuk yang memakai *streaming data descriptor*).
 *
 * Galat tidak pernah dilempar: setiap masalah dikembalikan sebagai
 * `{ ok: false, alasan }` dengan kalimat yang bisa langsung ditampilkan ke
 * pelatih/anggota.
 */
export async function uraiMxl(bita: Uint8Array): Promise<HasilUraiMxl> {
  try {
    if (bita.length === 0) {
      return { ok: false, alasan: 'berkas .mxl kosong (0 bita)' }
    }
    if (bita.length > BATAS_BITA) {
      return {
        ok: false,
        alasan: `ukuran berkas .mxl (${formatMb(bita.length)}) melebihi batas ${formatMb(BATAS_BITA)}`,
      }
    }
    if (!magicZip(bita)) {
      return { ok: false, alasan: 'bukan arsip .mxl/ZIP yang sah (tanda tangan PK tidak ditemukan)' }
    }

    const dir = bacaDirektoriPusat(bita)
    if (!dir.ok) return dir

    const entriContainer = cariEntri(dir.entri, 'META-INF/container.xml')
    if (!entriContainer) {
      return {
        ok: false,
        alasan: 'arsip ZIP tidak memuat META-INF/container.xml — bukan berkas MusicXML terkompresi (.mxl)',
      }
    }

    const hasilContainer = await ekstrakEntri(bita, entriContainer)
    if (!hasilContainer.ok) return hasilContainer

    const teksContainer = teksPartitur(hasilContainer.bita)
    const jalurUtama = pilihJalurUtamaContainer(teksContainer)
    if (!jalurUtama) {
      return {
        ok: false,
        alasan: 'META-INF/container.xml di dalam .mxl tidak menyebut berkas partitur utama (<rootfile>)',
      }
    }

    const entriSkor = cariEntri(dir.entri, jalurUtama)
    if (!entriSkor) {
      return {
        ok: false,
        alasan: `berkas utama "${jalurUtama}" yang disebut META-INF/container.xml tidak ditemukan di dalam .mxl`,
      }
    }

    const hasilSkor = await ekstrakEntri(bita, entriSkor)
    if (!hasilSkor.ok) return hasilSkor

    if (hasilSkor.bita.length === 0) {
      return {
        ok: false,
        alasan: `berkas utama "${jalurUtama}" di dalam .mxl kosong (0 bita)`,
      }
    }

    const periksaIsi = deteksiPartitur(hasilSkor.bita)
    if (!periksaIsi.ya || periksaIsi.tipe !== 'musicxml') {
      return {
        ok: false,
        alasan:
          `isi "${jalurUtama}" di dalam .mxl bukan MusicXML yang sah` +
          (periksaIsi.alasan ? ` (${periksaIsi.alasan})` : ''),
      }
    }

    return {
      ok: true,
      bitaXml: hasilSkor.bita,
      jalurUtama: entriSkor.nama,
    }
  } catch (e) {
    const pesan = e instanceof Error ? e.message : String(e)
    return { ok: false, alasan: `gagal membuka .mxl: ${pesan}` }
  }
}
