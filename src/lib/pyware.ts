/**
 * #10 — Impor drill Pyware (satu arah: Pyware/Excel → DrillKit).
 *
 * **Masalahnya.** Banyak tim sudah menulis drill-nya di Pyware 3D (atau di
 * Excel hasil salinan dari sana). Menulis ulang titik per set di DrillKit
 * memakan waktu berjam-jam dan rawan salah salin.
 *
 * **Keputusannya.** Impor satu arah lewat **CSV lembar koordinat**, bukan
 * lewat berkas `.d3d` Pyware: format berkas Pyware tidak terbuka, sedangkan
 * lembar koordinatnya bisa diekspor/ditempel ke Excel oleh siapa saja, dan
 * alur DD7 (`csvKoordinat.ts`) sudah membuktikan bahwa CSV cukup untuk
 * bertukar formasi.
 *
 * Modul ini **murni** — tidak menyentuh Dexie, React, atau DOM — supaya
 * seluruh aturannya bisa diuji di node (`qa/pyware-logika.mjs`). Yang
 * menulis ke basis data ada di `pywareTulis.ts`, dipisah supaya
 * `bukaBerkas.ts` bisa mengimpor pendeteksi di sini tanpa ikut menarik
 * Dexie ke dalam bundelnya.
 *
 * Tiga hal yang disengaja:
 *
 * 1. **Format Pyware tidak diterbitkan secara resmi.** Yang ada hanya
 *    lembar koordinat hasil cetak/ekspor tiap versi, dan judul kolomnya
 *    berbeda antar versi & antar salinan Excel. Karena itu pengurai di sini
 *    mengenali **peran** kolom (set / count / pemain / X / Y) dari banyak
 *    ejaan, bukan mencocokkan satu bentuk baku. Yang tidak bisa dipastikan
 *    (satuan, asal Y) ditebak dari judul kolom **dan** bisa diubah di layar,
 *    dengan pratinjau sebelum apa pun ditulis.
 * 2. **Pratinjau dulu, tulis kemudian.** Impor tidak pernah menimpa tanpa
 *    diminta, dan posisi yang keluar lapangan dilaporkan sebelum pelatih
 *    menekan tombol — bukan sesudah formasi berantakan.
 * 3. **Busur Pyware tidak ikut.** Lembar koordinat hanya memuat titik set;
 *    jalur di antaranya diimpor **lurus** (interpolasi linear). Busur,
 *    putar, dan counter-march ditambahkan di editor setelah impor.
 */
import type { FieldConfig, Member } from '../db/types'
import { M_TO_YD, fieldBox } from './field'
import { uraiCsv } from './csvKoordinat'

/* ------------------------------- Pilihan -------------------------------- */

/** Satuan angka pada berkas Pyware. */
export type SatuanPyware = 'langkah' | 'yard' | 'meter' | 'kaki'

/**
 * Dari mana nilai Y diukur.
 *
 * - `tengah` — dari garis tengah lapangan; positif = ke belakang. Ini bentuk
 *   internal DrillKit.
 * - `garis-depan` — dari garis depan (sisi penonton); positif = ke belakang.
 * - `garis-belakang` — dari garis belakang; positif = ke depan.
 */
export type AsalYPyware = 'tengah' | 'garis-depan' | 'garis-belakang'

/**
 * Arti kolom `Count`.
 *
 * - `mutlak` — hitungan ke berapa set itu terjadi (1, 9, 25, …). Selisihnya
 *   yang menjadi panjang perpindahan.
 * - `transisi` — panjang perpindahan dari set itu ke set berikutnya (8, 16, …).
 */
export type ArtiCount = 'mutlak' | 'transisi'

/** Cara memasukkan hasil impor ke drill yang sedang terbuka. */
export type ModeImporPyware = 'gabung' | 'timpa' | 'salinan'

export const LABEL_SATUAN_PYWARE: Record<SatuanPyware, string> = {
  langkah: 'Langkah (ikut ukuran langkah drill)',
  yard: 'Yard',
  meter: 'Meter',
  kaki: 'Kaki (feet)',
}

export const LABEL_ASAL_Y_PYWARE: Record<AsalYPyware, string> = {
  tengah: 'Dari garis tengah (positif = ke belakang)',
  'garis-depan': 'Dari garis depan / sisi penonton (positif = ke belakang)',
  'garis-belakang': 'Dari garis belakang (positif = ke depan)',
}

export const LABEL_MODE_PYWARE: Record<ModeImporPyware, string> = {
  gabung: 'Gabungkan ke drill ini',
  timpa: 'Timpa set drill ini',
  salinan: 'Simpan sebagai show baru',
}

export const KETERANGAN_MODE_PYWARE: Record<ModeImporPyware, string> = {
  gabung: 'Set yang namanya sama diperbarui titik-titiknya, set baru ditambahkan di akhir. Set lama yang tidak ada di berkas tetap ada.',
  timpa: 'Semua set drill ini diganti dengan hasil impor. Keadaan sebelumnya difoto dulu, jadi bisa dikembalikan dari Riwayat.',
  salinan: 'Dibuat show baru berisi hasil impor; drill yang sedang dibuka tidak disentuh. Membatalkan = menghapus show baru itu.',
}

/* ------------------------------ Pengali --------------------------------- */

/** 1 kaki = 0,3048 m. */
export const KAKI_KE_M = 0.3048

/** Pengali dari satuan berkas ke yard (satuan simpan DrillKit). */
export function faktorKeYard(satuan: SatuanPyware, sYd: number): number {
  if (satuan === 'yard') return 1
  if (satuan === 'meter') return M_TO_YD
  if (satuan === 'kaki') return KAKI_KE_M * M_TO_YD
  return sYd
}

/* ------------------------------ Pemetaan -------------------------------- */

/**
 * Peran tiap kolom. `-1` = kolomnya tidak ada.
 *
 * Disimpan sebagai indeks, bukan nama, supaya berkas yang judul kolomnya
 * aneh (hasil salin-tempel Excel) tetap bisa diatur lewat pemetaan yang
 * sama.
 */
export interface PemetaanPyware {
  set: number
  subset: number
  count: number
  kode: number
  nama: number
  instrumen: number
  x: number
  y: number
  /** elevasi — dibaca supaya tidak keliru dianggap Y, lalu dibuang */
  z: number
  /** arah hadap — dibaca supaya tidak keliru dianggap X, lalu dibuang */
  arah: number
  /** kolom satuan ("Units"), bila lembar koordinatnya memakainya */
  satuan: number
}

export const PEMETAAN_KOSONG: PemetaanPyware = {
  set: -1,
  subset: -1,
  count: -1,
  kode: -1,
  nama: -1,
  instrumen: -1,
  x: -1,
  y: -1,
  z: -1,
  arah: -1,
  satuan: -1,
}

/* ------------------------------- Penanda -------------------------------- */

/**
 * Kata yang menandakan berkas ini lembar koordinat Pyware.
 *
 * Sengaja TIDAK memuat `instrumen` atau `set`: dua kata itu juga ada di
 * lembar koordinat ekspor DrillKit sendiri (`Set,Kode,Nama,Section,
 * Instrumen,X (steps),Y (steps),Koordinat`), dan berkas itu harus tetap
 * dikenali sebagai `csv-koordinat` (pintu DD7), bukan dialihkan ke sini.
 */
export const PENANDA_PYWARE = [
  'sidelong',
  'depth',
  'performer',
  'count',
  'subset',
  'sub-set',
  'direction',
  'orientation',
  'elevation',
  'transition',
  'page tab',
  'set #',
  'units',
]

const adalahX = (h: string): boolean =>
  /(^|[^a-z])x([^a-z]|$)/i.test(h) || /^x\b/i.test(h.trim()) || /sidelong/i.test(h)
const adalahY = (h: string): boolean =>
  /(^|[^a-z])y([^a-z]|$)/i.test(h) || /^y\b/i.test(h.trim()) || /depth/i.test(h)
const adalahZ = (h: string): boolean =>
  /(^|[^a-z])z([^a-z]|$)/i.test(h) || /elevation|height/i.test(h)
const adalahSet = (h: string): boolean =>
  /(^|[^a-z])(set|page|formasi|formation)([^a-z]|$)/i.test(h)
const adalahCount = (h: string): boolean =>
  /(^|[^a-z])(count|counts|hitungan|transition)([^a-z]|$)/i.test(h)
const adalahArah = (h: string): boolean =>
  /direction|orientation|facing|angle|degrees|arah|hadap/i.test(h)
const adalahSatuan = (h: string): boolean => /^units?$|^satuan$/i.test(h.trim())

/**
 * Apakah berkas ini lembar koordinat Pyware?
 *
 * Syaratnya: ada pasangan X/Y **dan** sedikitnya satu penanda Pyware. Tanpa
 * penanda itu, CSV koordinat biasa (ekspor DrillKit, buatan Excel sendiri)
 * tetap lewat pintu DD7 — tidak dipaksa masuk alur ini.
 */
export function deteksiPyware(teks: string): { ya: boolean; nilai: number; alasan: string[] } {
  const rows = uraiCsv(teks)
  const alasan: string[] = []
  let nilai = 0
  let adaXY = false

  const periksa = (judul: string[]) => {
    const x = judul.some(adalahX)
    const y = judul.some(adalahY)
    if (x && y) adaXY = true
    for (const p of PENANDA_PYWARE) {
      const kena = judul.some((h) => h.toLowerCase().includes(p))
      if (kena) {
        nilai += 1
        if (!alasan.includes(p)) alasan.push(p)
      }
    }
  }

  // Judul kolom tidak selalu di baris pertama: lembar Pyware sering punya
  // satu-dua baris judul drill di atasnya.
  for (const r of rows.slice(0, 12)) periksa(r)

  return { ya: adaXY && nilai > 0, nilai, alasan }
}

/** Tebak peran tiap kolom dari judulnya. */
export function saranPemetaanPyware(judul: string[]): PemetaanPyware {
  const p: PemetaanPyware = { ...PEMETAAN_KOSONG }
  const pakai = (kolom: keyof PemetaanPyware, i: number): boolean => {
    if (p[kolom] >= 0) return false
    p[kolom] = i
    return true
  }
  const dipakai = (i: number): boolean => Object.values(p).includes(i)

  // Urutannya penting: kolom yang paling khas dikenali dulu, karena `Nama`
  // bisa berarti nama pemain ATAU nama set ("Set Title").
  judul.forEach((h, i) => {
    const t = h.trim()
    if (!t) return
    if (adalahSatuan(t)) pakai('satuan', i)
    else if (adalahZ(t)) pakai('z', i)
    else if (adalahArah(t)) pakai('arah', i)
    else if (/subset|sub-set/i.test(t)) pakai('subset', i)
    else if (adalahSet(t) && !adalahX(t) && !adalahY(t)) pakai('set', i)
    else if (adalahCount(t)) pakai('count', i)
    else if (adalahX(t) && !adalahY(t)) pakai('x', i)
    else if (adalahY(t) && !adalahX(t)) pakai('y', i)
  })

  // Sisa kolom identitas pemain: `Performer`, `Name`, `Kode`, `Instrumen`.
  judul.forEach((h, i) => {
    if (dipakai(i)) return
    const t = h.trim()
    if (/^(kode|code|id|no\.?|number|#|performer\s*(id|no\.?|number)|member\s*(id|no\.?|number))$/i.test(t)) {
      pakai('kode', i)
    } else if (/^(instrument|section|part|instrumen|seksi)$/i.test(t)) {
      pakai('instrumen', i)
    } else if (/performer|member|nama|name|player/i.test(t)) {
      if (p.nama < 0) pakai('nama', i)
      else pakai('kode', i)
    }
  })

  return p
}

/**
 * Sambung judul kolom yang terpecah oleh koma di dalam tanda kurung.
 *
 * `"X (Sidelong, meters)"` yang **tidak** diberi tanda kutip (Excel menulisnya
 * dengan kutip, tetapi berkas yang diedit tangan sering tidak) pecah menjadi
 * dua sel, dan setiap kolom sesudahnya bergeser satu — X lalu dibaca dari
 * kolom angka yang salah tanpa pesan apa pun. Aturannya sengaja sempit: sel
 * yang kurung buka-nya belum ditutup disambung dengan sel berikutnya sampai
 * seimbang. Bukan menebak jumlah kolom.
 */
export function rapikanJudul(judul: string[]): string[] {
  const buka = (t: string): number => (t.match(/\(/g) ?? []).length - (t.match(/\)/g) ?? []).length
  const out: string[] = []
  for (const sel of judul) {
    if (out.length && buka(out[out.length - 1]) > 0) out[out.length - 1] += `,${sel}`
    else out.push(sel)
  }
  return out
}

/* --------------------------- Tebakan satuan/Y ---------------------------- */

const POLA_SATUAN: { satuan: SatuanPyware; pola: RegExp }[] = [
  { satuan: 'langkah', pola: /\b(steps?|paces?|langkah)\b/i },
  { satuan: 'yard', pola: /\b(yd|yds|yards?|yard)\b/i },
  { satuan: 'meter', pola: /\b(m|meters?|metres?|meter)\b/i },
  { satuan: 'kaki', pola: /\b(ft|feet|foot|kaki)\b/i },
]

/** Tebak satuan dari judul kolom (X/Y/Units) atau isi kolom satuan. */
export function tebakSatuan(judul: string[], contohIsi: string[] = []): { satuan: SatuanPyware; yakin: boolean } {
  const teks = [...judul, ...contohIsi]
  for (const { satuan, pola } of POLA_SATUAN) {
    if (teks.some((t) => pola.test(t))) return { satuan, yakin: true }
  }
  return { satuan: 'langkah', yakin: false }
}

/** Tebak asal pengukuran Y dari judul kolomnya. */
export function tebakAsalY(judul: string[]): { asalY: AsalYPyware; yakin: boolean } {
  const gabung = judul.join(' | ')
  if (/from\s+(the\s+)?center|from\s+50|dari\s+tengah|center\s*line/i.test(gabung)) {
    return { asalY: 'tengah', yakin: true }
  }
  if (/from\s+(the\s+)?back|dari\s+(garis\s+)?belakang/i.test(gabung)) {
    return { asalY: 'garis-belakang', yakin: true }
  }
  if (/from\s+(the\s+)?front|front\s+sideline|dari\s+(garis\s+)?depan|sisi\s+penonton/i.test(gabung)) {
    return { asalY: 'garis-depan', yakin: true }
  }
  // Bawaan: dari garis depan. Ini kebiasaan lembar koordinat Pyware, dan
  // sama dengan bentuk ekspor DrillKit sendiri. Pratinjau tetap memberi
  // saran kalau ternyata banyak titik yang keluar lapangan.
  return { asalY: 'garis-depan', yakin: false }
}

/* -------------------------------- Angka ---------------------------------- */

/**
 * Baca angka dari sel CSV Pyware.
 *
 * Lembar koordinat sering memuat lebih dari angka polos: `-4.5`, `4 1/2`,
 * `−12` (minus Unicode dari Excel), `8 counts`, `12.5 steps`, atau angka
 * berkoma desimal gaya Indonesia (`12,5`). Semuanya diterima; yang tidak
 * terbaca menghasilkan `null`, bukan `0` — karena `0` adalah posisi yang
 * sah (tepat di garis tengah).
 */
export function angkaPyware(sel: string | undefined): number | null {
  if (sel === undefined) return null
  let t = sel.trim().replace(/\u2212/g, '-').replace(/\s+/g, ' ')
  if (!t) return null

  // Pecahan campuran: "4 1/2" → 4.5
  const campuran = t.match(/^(-?\d+)\s+(\d+)\s*\/\s*(\d+)$/)
  if (campuran) {
    const utuh = Number(campuran[1])
    const pec = Number(campuran[2]) / Number(campuran[3])
    return Number.isFinite(utuh) && Number.isFinite(pec)
      ? (utuh < 0 ? utuh - pec : utuh + pec)
      : null
  }
  // Pecahan biasa: "1/2" → 0.5
  const pecahan = t.match(/^(-?\d+)\s*\/\s*(\d+)$/)
  if (pecahan) {
    const n = Number(pecahan[1]) / Number(pecahan[2])
    return Number.isFinite(n) ? n : null
  }

  // Ambil angka pertama (boleh desimal, koma atau titik), buang satuan teks.
  const m = t.match(/-?\d+(?:[.,]\d+)?/)
  if (!m) return null
  const n = Number(m[0].replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

/* ------------------------------- Hasil ---------------------------------- */

export interface TitikPyware {
  /** yard, dari titik tengah lapangan; positif = sisi S1 */
  x: number
  /** yard, dari titik tengah lapangan; positif = ke belakang */
  y: number
}

export interface PemainPyware {
  /** kunci baris: kode bila ada, kalau tidak namanya */
  kunci: string
  kode: string
  nama: string
  instrumen: string
  /** posisi per set; `null` = pemain tidak ada di set itu */
  pos: (TitikPyware | null)[]
}

export interface SetPyware {
  /** nama apa adanya dari berkas ("1", "Set 1 — Blok", "Opener") */
  nama: string
  /** nomor set bila terbaca dari namanya, untuk laporan saja */
  nomor: number | null
  /** nilai kolom Count pada set ini, bila ada */
  count: number | null
}

export interface OpsiPyware {
  /** yard per langkah, dari pengaturan lapangan drill */
  sYd: number
  /** lebar lapangan (yard) — dipakai mengubah asal Y */
  lebarYd: number
  /** kosongkan untuk menebak dari judul kolom */
  satuan?: SatuanPyware
  asalY?: AsalYPyware
  artiCount?: ArtiCount
}

export interface HasilPyware {
  bentuk: 'pyware' | 'tidak-dikenal'
  pemetaan: PemetaanPyware
  /** baris judul kolom (0 = baris pertama berkas) */
  indeksHeader: number
  satuan: SatuanPyware
  /** false = satuan ditebak dan sebaiknya diperiksa pelatih */
  satuanTebak: boolean
  asalY: AsalYPyware
  /** false = asal Y tidak disebut di judul kolom */
  asalYTebak: boolean
  artiCount: ArtiCount
  artiCountTebak: boolean
  set: SetPyware[]
  pemain: PemainPyware[]
  /** baris yang dilewati karena identitas pemainnya tidak ada */
  dilewati: number
  /**
   * baris yang identitasnya ada tetapi koordinatnya kosong. Pemainnya TETAP
   * dihitung di set itu (posisinya `null`), supaya celahnya bisa diisi lurus
   * dan setnya tidak hilang dari urutan.
   */
  kosong: number
  /** jumlah baris yang menimpa titik set+pemain yang sama */
  kembar: number
  catatan: string[]
}

/** Baris judul pertama yang memuat pasangan X/Y. */
function cariHeader(rows: string[][]): number {
  const batas = Math.min(rows.length, 15)
  for (let i = 0; i < batas; i++) {
    const r = rapikanJudul(rows[i])
    const angka = r.filter((s) => s !== '' && angkaPyware(s) !== null).length
    // Baris data biasanya separuh atau lebih isinya angka.
    if (r.length > 1 && angka >= Math.ceil(r.length / 2)) continue
    const adaX = r.some(adalahX)
    const adaY = r.some(adalahY)
    const adaSiapa = r.some(
      (h) => adalahSet(h) || adalahCount(h) || /performer|member|nama|name|kode|code|id/i.test(h),
    )
    if (adaX && adaY && adaSiapa) return i
  }
  return -1
}

/**
 * Urai lembar koordinat Pyware menjadi posisi per pemain per set.
 *
 * Hasilnya sudah dalam **yard** dengan konvensi internal DrillKit (X dari
 * tengah lapangan, positif = S1; Y dari tengah, positif = belakang), jadi
 * lapisan di atasnya tidak perlu tahu satuan berkasnya lagi.
 */
export function uraiPyware(teks: string, opsi: OpsiPyware): HasilPyware {
  const rows = uraiCsv(teks)
  const hampa: HasilPyware = {
    bentuk: 'tidak-dikenal',
    pemetaan: { ...PEMETAAN_KOSONG },
    indeksHeader: -1,
    satuan: opsi.satuan ?? 'langkah',
    satuanTebak: opsi.satuan === undefined,
    asalY: opsi.asalY ?? 'garis-depan',
    asalYTebak: opsi.asalY === undefined,
    artiCount: opsi.artiCount ?? 'mutlak',
    artiCountTebak: opsi.artiCount === undefined,
    set: [],
    pemain: [],
    dilewati: rows.length,
    kosong: 0,
    kembar: 0,
    catatan: ['Judul kolom dengan pasangan X/Y tidak ditemukan.'],
  }
  if (!rows.length) return hampa

  const indeksHeader = cariHeader(rows)
  if (indeksHeader < 0) return hampa

  const judul = rapikanJudul(rows[indeksHeader])
  const pemetaan = saranPemetaanPyware(judul)
  if (pemetaan.x < 0 || pemetaan.y < 0) return hampa

  /* ---- satuan & asal Y: pilihan pelatih menang atas tebakan ---- */
  const isiSatuan =
    pemetaan.satuan >= 0
      ? rows
          .slice(indeksHeader + 1, indeksHeader + 6)
          .map((r) => r[pemetaan.satuan] ?? '')
          .filter(Boolean)
      : []
  const tebakanSatuan = tebakSatuan(judul, isiSatuan)
  const satuan = opsi.satuan ?? tebakanSatuan.satuan
  const tebakanY = tebakAsalY(judul)
  const asalY = opsi.asalY ?? tebakanY.asalY
  const k = faktorKeYard(satuan, opsi.sYd)

  const keY = (v: number): number => {
    if (asalY === 'tengah') return v * k
    if (asalY === 'garis-belakang') return opsi.lebarYd / 2 - v * k
    return v * k - opsi.lebarYd / 2
  }

  const catatan: string[] = []
  if (opsi.satuan === undefined && !tebakanSatuan.yakin) {
    catatan.push(
      'Satuan angka tidak disebut di judul kolom — dianggap langkah. Periksa pratinjau, atau pilih satuannya sendiri.',
    )
  }
  if (opsi.asalY === undefined && !tebakanY.yakin) {
    catatan.push('Asal pengukuran Y tidak disebut di judul kolom — dianggap dari garis depan.')
  }
  if (pemetaan.set < 0) catatan.push('Kolom set tidak ada: seluruh baris dianggap satu set.')
  if (pemetaan.z >= 0) catatan.push('Kolom elevasi (Z) dibaca lalu dibuang — DrillKit bekerja di dua sumbu.')
  if (pemetaan.arah >= 0) {
    catatan.push('Arah hadap dari Pyware tidak diimpor; atur hadap di editor bila perlu.')
  }

  /* ---- kumpulkan per set, lalu per pemain ---- */
  const ambil = (sel: string[], i: number): string | undefined =>
    i >= 0 && i < sel.length ? sel[i] : undefined

  const urutanSet: string[] = []
  const setKe = new Map<string, number>()
  const setList: SetPyware[] = []
  const pemain = new Map<string, PemainPyware>()
  const urutanPemain: string[] = []
  let dilewati = 0
  let kosong = 0
  let kembar = 0

  for (const sel of rows.slice(indeksHeader + 1)) {
    const vx = angkaPyware(ambil(sel, pemetaan.x))
    const vy = angkaPyware(ambil(sel, pemetaan.y))
    const kode = (ambil(sel, pemetaan.kode) ?? '').trim()
    const nama = (ambil(sel, pemetaan.nama) ?? '').trim()
    // Tanpa identitas baris ini tidak bisa dipakai sama sekali — dilewati.
    if (!kode && !nama) {
      dilewati++
      continue
    }
    // Koordinat kosong BUKAN berarti barisnya dibuang: pemainnya tetap ada di
    // set itu, hanya posisinya yang belum diketahui. Membuang barisnya akan
    // menghapus set itu dari urutan kalau semua barisnya kosong, dan menutup
    // jalan interpolasi di celah tersebut.
    if (vx === null && vy === null) kosong++

    const namaSetCsv =
      pemetaan.set >= 0 ? (ambil(sel, pemetaan.set) ?? '').trim() || `Set ${setList.length + 1}` : 'Set 1'
    if (!setKe.has(namaSetCsv)) {
      const idx = setList.length
      setKe.set(namaSetCsv, idx)
      urutanSet.push(namaSetCsv)
      setList.push({
        nama: namaSetCsv,
        nomor: angkaPyware(namaSetCsv.match(/\d+/)?.[0]),
        count: null,
      })
    }
    const iSet = setKe.get(namaSetCsv)!

    // Count: dibaca dari baris pertama tiap set (Pyware menulisnya berulang
    // untuk tiap pemain pada set yang sama).
    if (pemetaan.count >= 0 && setList[iSet].count === null) {
      setList[iSet].count = angkaPyware(ambil(sel, pemetaan.count))
    }

    const kunci = (kode || nama).toLowerCase()
    let p = pemain.get(kunci)
    if (!p) {
      p = {
        kunci,
        kode,
        nama,
        instrumen: (ambil(sel, pemetaan.instrumen) ?? '').trim(),
        pos: [],
      }
      pemain.set(kunci, p)
      urutanPemain.push(kunci)
    } else if (!p.instrumen && pemetaan.instrumen >= 0) {
      p.instrumen = (ambil(sel, pemetaan.instrumen) ?? '').trim()
    }

    while (p.pos.length <= iSet) p.pos.push(null)
    if (p.pos[iSet] !== null && p.pos[iSet] !== undefined) kembar++
    p.pos[iSet] = vx === null || vy === null ? null : { x: vx * k, y: keY(vy) }
  }

  // Setiap pemain punya slot untuk semua set; yang kosong `null`.
  for (const kunci of urutanPemain) {
    const p = pemain.get(kunci)!
    while (p.pos.length < setList.length) p.pos.push(null)
  }

  /* ---- arti kolom Count: mutlak atau transisi ---- */
  const counts = setList.map((s) => s.count).filter((c): c is number => c !== null)
  let artiCount = opsi.artiCount ?? 'mutlak'
  let artiCountTebak = opsi.artiCount === undefined
  if (artiCountTebak && counts.length >= 2) {
    // Naik terus = hitungan mutlak. Ada yang berulang/turun = panjang
    // perpindahan (transisi).
    let naik = true
    for (let i = 1; i < counts.length; i++) if (counts[i] <= counts[i - 1]) naik = false
    artiCount = naik ? 'mutlak' : 'transisi'
  } else if (artiCountTebak) {
    // Satu set saja: tidak ada yang bisa dibedakan.
    artiCount = 'mutlak'
  }

  if (dilewati) catatan.push(`${dilewati} baris dilewati karena identitas pemainnya tidak terbaca.`)
  if (kosong) {
    catatan.push(
      `${kosong} baris tanpa koordinat — pemainnya tetap dihitung di set itu; posisinya diisi lurus bila set sebelum & sesudahnya ada.`,
    )
  }
  if (kembar) catatan.push(`${kembar} titik ditulis dua kali untuk set & pemain yang sama — yang terakhir dipakai.`)

  return {
    bentuk: 'pyware',
    pemetaan,
    indeksHeader,
    satuan,
    satuanTebak: opsi.satuan === undefined && !tebakanSatuan.yakin,
    asalY,
    asalYTebak: opsi.asalY === undefined && !tebakanY.yakin,
    artiCount,
    artiCountTebak,
    set: setList,
    pemain: urutanPemain.map((kunci) => pemain.get(kunci)!),
    dilewati,
    kosong,
    kembar,
    catatan,
  }
}

/* --------------------------- Interpolasi -------------------------------- */

/**
 * Isi titik yang hilang di antara dua set dengan interpolasi linear.
 *
 * Kenapa perlu: lembar koordinat Pyware sering hanya menulis set-set pokok
 * (pemain yang tidak ikut satu set tidak punya baris di sana). Tanpa
 * pengisian, pemain itu lenyap di set tengah lalu muncul lagi — padahal di
 * Pyware ia berjalan lurus di antaranya.
 *
 * Yang **tidak** dilakukan: menebak busur. Jalur melengkung Pyware tidak
 * terbaca dari titik set, jadi hasilnya lurus dan busurnya ditambahkan di
 * editor. Itu ditulis di catatan, bukan didiamkan.
 *
 * Bobotnya mengikuti hitungan bila ada (set yang lebih panjang mendapat
 * bagian pergeseran lebih besar); kalau tidak ada, jarak antar set dipakai.
 */
export function isiCelahLinear(
  pemain: PemainPyware[],
  set: SetPyware[],
): { pemain: PemainPyware[]; interpolasi: number } {
  let interpolasi = 0

  // Jarak antar set dalam hitungan; fallback = 1 per set.
  const bobot: number[] = []
  for (let i = 0; i + 1 < set.length; i++) {
    const a = set[i].count
    const b = set[i + 1].count
    const d = a !== null && b !== null ? Math.abs(b - a) : 0
    bobot.push(d > 0 ? d : 1)
  }
  const jarak = (dari: number, ke: number): number => {
    let j = 0
    for (let i = dari; i < ke; i++) j += bobot[i] ?? 1
    return j || 1
  }

  const jadi = pemain.map((p) => {
    const pos = [...p.pos]
    const ada = pos
      .map((v, i) => (v ? i : -1))
      .filter((i) => i >= 0)
    if (ada.length < 2) return { ...p, pos }

    for (let i = ada[0]; i <= ada[ada.length - 1]; i++) {
      if (pos[i]) continue
      let kiri = i - 1
      while (kiri >= 0 && !pos[kiri]) kiri--
      let kanan = i + 1
      while (kanan < pos.length && !pos[kanan]) kanan++
      if (kiri < 0 || kanan >= pos.length) continue
      const a = pos[kiri] as TitikPyware
      const b = pos[kanan] as TitikPyware
      const t = jarak(kiri, i) / jarak(kiri, kanan)
      pos[i] = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
      interpolasi++
    }
    return { ...p, pos }
  })

  return { pemain: jadi, interpolasi }
}

/* ------------------------------ Pratinjau -------------------------------- */

export interface TitikLuar {
  kode: string
  nama: string
  setKe: number
  namaSet: string
  x: number
  y: number
  /** sumbu yang keluar lapangan, untuk pesan yang jelas */
  sumbu: 'x' | 'y' | 'keduanya'
}

export interface RingkasanPyware {
  jumlahSet: number
  jumlahPemain: number
  /** titik yang benar-benar ada di berkas (sebelum interpolasi) */
  jumlahTitik: number
  /** titik hasil pengisian celah */
  interpolasi: number
  countMin: number | null
  countMax: number | null
  diLuar: TitikLuar[]
  /** jumlah seluruh titik di luar lapangan (daftar `diLuar` dipotong) */
  diLuarJumlah: number
}

const TOL = 1e-6

/** Apakah satu titik keluar dari kotak lapangan? */
export function titikLuarKotak(
  t: TitikPyware,
  f: FieldConfig,
): TitikLuar['sumbu'] | null {
  const b = fieldBox(f)
  const luarX = t.x < b.minX - TOL || t.x > b.maxX + TOL
  const luarY = t.y < b.minY - TOL || t.y > b.maxY + TOL
  if (luarX && luarY) return 'keduanya'
  if (luarX) return 'x'
  if (luarY) return 'y'
  return null
}

/** Rentang hitungan mutlak set-set yang diimpor. */
export function rentangHitungan(set: SetPyware[], artiCount: ArtiCount): { min: number | null; max: number | null } {
  const counts = set.map((s) => s.count)
  if (counts.every((c) => c === null)) return { min: null, max: null }
  if (artiCount === 'mutlak') {
    const angka = counts.filter((c): c is number => c !== null)
    return { min: Math.min(...angka), max: Math.max(...angka) }
  }
  // Transisi: hitungan kumulatif dari set pertama.
  let total = 0
  const kumulatif = counts.map((c) => {
    const mulai = total
    total += c ?? 0
    return mulai
  })
  return { min: kumulatif[0] ?? null, max: kumulatif[kumulatif.length - 1] ?? null }
}

/**
 * Ringkas hasil impor untuk pratinjau.
 *
 * Semuanya dihitung sebelum apa pun ditulis: jumlah set & pemain, rentang
 * hitungan, berapa titik yang diisi dengan interpolasi, dan posisi mana yang
 * keluar lapangan. Yang terakhir inilah yang paling sering menandai pilihan
 * satuan/asal Y yang keliru.
 */
export function ringkasPyware(
  hasil: HasilPyware,
  f: FieldConfig,
  maksDaftarLuar = 40,
): RingkasanPyware {
  const { pemain, interpolasi } = isiCelahLinear(hasil.pemain, hasil.set)
  const rentang = rentangHitungan(hasil.set, hasil.artiCount)

  // Titik yang benar-benar ada di berkas dihitung dari hasil urai, bukan dari
  // hasil interpolasi — pratinjau harus bisa membedakan keduanya.
  const jumlahTitik = hasil.pemain.reduce(
    (n, p) => n + p.pos.filter((t) => t !== null).length,
    0,
  )

  const diLuar: TitikLuar[] = []
  let diLuarJumlah = 0
  for (const p of pemain) {
    p.pos.forEach((t, i) => {
      if (!t) return
      const sumbu = titikLuarKotak(t, f)
      if (!sumbu) return
      diLuarJumlah++
      if (diLuar.length < maksDaftarLuar) {
        diLuar.push({
          kode: p.kode,
          nama: p.nama,
          setKe: i,
          namaSet: hasil.set[i]?.nama ?? `Set ${i + 1}`,
          x: t.x,
          y: t.y,
          sumbu,
        })
      }
    })
  }

  return {
    jumlahSet: hasil.set.length,
    jumlahPemain: pemain.length,
    jumlahTitik,
    interpolasi,
    countMin: rentang.min,
    countMax: rentang.max,
    diLuar,
    diLuarJumlah,
  }
}

/**
 * Sarankan asal Y yang lain bila pilihan sekarang jelas lebih buruk.
 *
 * Pelatih tidak selalu tahu lembar koordinatnya diukur dari mana. Daripada
 * menyuruh menebak, pratinjau menghitung ulang untuk tiap kemungkinan dan
 * menyebut yang paling sedikit mengeluarkan titik dari lapangan — hanya
 * kalau bedanya nyata.
 */
export function saranAsalY(
  teks: string,
  opsi: OpsiPyware,
  f: FieldConfig,
): { asalY: AsalYPyware; sekarang: number; saran: number } | null {
  const hitungLuar = (asalY: AsalYPyware): number => {
    const h = uraiPyware(teks, { ...opsi, asalY })
    if (h.bentuk !== 'pyware') return Number.MAX_SAFE_INTEGER
    return ringkasPyware(h, f, 1).diLuarJumlah
  }
  const sekarang = hitungLuar(opsi.asalY ?? 'garis-depan')
  const lain = (['tengah', 'garis-depan', 'garis-belakang'] as AsalYPyware[]).filter(
    (a) => a !== (opsi.asalY ?? 'garis-depan'),
  )
  let terbaik: AsalYPyware | null = null
  let nilai = sekarang
  for (const a of lain) {
    const n = hitungLuar(a)
    if (n < nilai) {
      nilai = n
      terbaik = a
    }
  }
  if (!terbaik || nilai >= sekarang) return null
  return { asalY: terbaik, sekarang, saran: nilai }
}

/* ----------------------------- Rancangan set ----------------------------- */

export interface RancanganSetPyware {
  nama: string
  /** hitungan untuk berpindah KE set berikutnya (0 = set terakhir) */
  counts: number
  /** key = kunci pemain Pyware (kode bila ada) */
  titik: Record<string, TitikPyware>
  /** berapa titik di set ini hasil interpolasi */
  interpolasi: number
}

/**
 * Susun rancangan set DrillKit dari hasil urai.
 *
 * Menghasilkan struktur biasa (bukan baris Dexie) supaya bisa diuji tanpa
 * basis data; `pywareTulis.ts` yang mengubahnya menjadi `DrillSet`.
 */
export function susunSetPyware(
  hasil: HasilPyware,
  opts: { countsBawaan?: number } = {},
): { set: RancanganSetPyware[]; interpolasi: number } {
  const bawaan = opts.countsBawaan ?? 16
  const { pemain, interpolasi } = isiCelahLinear(hasil.pemain, hasil.set)

  // Panjang perpindahan tiap set, dari kolom Count.
  const counts: number[] = hasil.set.map((s, i) => {
    if (hasil.artiCount === 'mutlak') {
      const berikutnya = hasil.set[i + 1]?.count
      if (s.count !== null && berikutnya !== null) {
        const d = berikutnya - s.count
        if (d > 0) return d
      }
      return 0
    }
    return s.count !== null && s.count > 0 ? s.count : 0
  })
  // Set terakhir (atau yang selisihnya tidak terbaca) memakai bawaan.
  for (let i = 0; i < counts.length; i++) if (counts[i] <= 0) counts[i] = i === counts.length - 1 ? bawaan : counts[i + 1] || bawaan

  const asli = new Map(hasil.pemain.map((p) => [p.kunci, p]))
  const set = hasil.set.map((s, i) => {
    const titik: Record<string, TitikPyware> = {}
    let interp = 0
    for (const p of pemain) {
      const t = p.pos[i]
      if (!t) continue
      titik[p.kunci] = t
      if (!asli.get(p.kunci)?.pos[i]) interp++
    }
    return { nama: s.nama, counts: counts[i], titik, interpolasi: interp }
  })

  return { set, interpolasi }
}

/* ---------------------------- Pencocokan #1 ------------------------------ */

/**
 * Awalan id anggota tiruan yang dipakai saat mencocokkan.
 *
 * Pencocokan anggota memakai mesin #1 (`namaAnggota.ts`) apa adanya: pemain
 * Pyware dibungkus menjadi `Member` dengan id `pyware:<kode>`. Begitu
 * pelatih mencocokkannya, id itu masuk ke `alias` anggota DrillKit — dan
 * impor berikutnya langsung cocok tanpa ditanya lagi.
 */
export const AWALAN_ID_PYWARE = 'pyware:'

/** Id anggota tiruan untuk satu pemain Pyware. */
export function idPyware(kode: string, nama: string): string {
  const kunci = (kode || nama || '').trim().toLowerCase()
  return `${AWALAN_ID_PYWARE}${kunci}`
}

/**
 * Bungkus pemain Pyware sebagai `Member` supaya bisa lewat layar
 * "Cocokkan anggota" (#1).
 *
 * Yang diisi hanya yang dipakai pencocokan: `code`, `name`, `instrument`.
 * `token` sengaja dikosongkan — `terapkanCocok` memberi token QR sendiri
 * untuk anggota yang benar-benar baru.
 */
export function pemainKeAnggota(pemain: PemainPyware[]): Member[] {
  return pemain.map((p) => ({
    id: idPyware(p.kode, p.nama),
    code: p.kode || p.nama,
    name: p.nama || p.kode,
    section: '',
    instrument: p.instrumen,
    role: 'member',
    joinYear: new Date().getFullYear(),
    active: 1,
    token: '',
    createdAt: 0,
  }))
}
