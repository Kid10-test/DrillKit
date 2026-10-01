/**
 * M1 — Tanda birama & hitung mundur (count-off).
 *
 * Sengaja **murni**: tidak menyentuh DOM, Web Audio, React, atau basis data.
 * Semua perhitungan di sini bisa diuji langsung di node (lihat
 * /home/user/qa/uji-birama.mjs).
 *
 * Rumah yang dipakai:
 * - `TandaBirama` menyimpan **tanda birama dan pengelompokannya saja**.
 * - Bunyi yang terjadi di dalam birama tetap disimpan di `BiramaPola` (E3).
 *   Meter tidak menyimpan salinannya sendiri — ia **membuat** pola, supaya
 *   satu fakta tidak punya dua tempat.
 *
 * Satuan yang dipakai di seluruh berkas ini:
 * - `pembilang` = jumlah **not penyebut** dalam satu birama (7/8 → 7).
 * - `kelompok`  = pengelompokan not penyebut menjadi pulsa (7/8 → [2,2,3]).
 * - `acuan`     = not yang dihitung sebagai **1 BPM** (bisa dipilih bebas).
 */

import type { BiramaPola, TingkatKlik } from '../db/types'

/* --------------------------------- Tipe ---------------------------------- */

/** Nilai not yang bisa dipakai sebagai acuan tempo. */
export type NilaiNot = 1 | 2 | 4 | 8 | 16 | 32

/** Not yang dihitung sebagai satu ketukan metronom (1 BPM). */
export interface AcuanTempo {
  /** nilai not: 1 = penuh, 2 = setengah, 4 = seperempat, 8 = seperdelapan … */
  nilai: NilaiNot
  /** bertitik — durasinya 1,5× (mis. seperempat bertitik untuk 6/8) */
  titik: boolean
}

/** Tanda birama lengkap: pembilang, penyebut, pengelompokan, dan acuan tempo. */
export interface TandaBirama {
  /** jumlah not penyebut per birama (7/8 → 7) */
  pembilang: number
  /** penyebut: 4 = seperempat, 8 = seperdelapan, 16 = keenambelas */
  penyebut: number
  /** pengelompokan pulsa, dalam not penyebut; jumlahnya harus = pembilang */
  kelompok: number[]
  /** not yang dihitung sebagai 1 BPM */
  acuan: AcuanTempo
}

/** Pengaturan hitung mundur (count-off) sebelum lagu mulai. */
export interface HitungMundur {
  on: boolean
  /** diulang berapa kali (1–8) */
  ulang: number
  /**
   * true  = hitung **tiap not penyebut** (7/8 → "1 2 3 4 5 6 7")
   * false = hitung **tiap pulsa** saja (7/8 [2,2,3] → "1 2 3")
   */
  tiapNot: boolean
  /** bunyi yang dipakai; 'suara' = suara manusia menyebut angka */
  suara: 'klik' | 'kayu' | 'bel' | 'suara'
  /**
   * Ucapan per ketuk kalau `suara === 'suara'`. Kosong → angka otomatis
   * (1, 2, 3, …). Bisa diisi mis. ['siap', '1', '2'].
   */
  ucap?: string[]
}

/* ------------------------------- Batas aman ------------------------------- */

export const MIN_PEMBILANG = 1
export const MAX_PEMBILANG = 32
/** Penyebut yang ditawarkan — urut dari yang paling sering dipakai. */
export const DAFTAR_PENYEBUT = [4, 8, 2, 16, 32] as const

/** Acuan tempo yang ditawarkan, beserta labelnya. */
export const DAFTAR_ACUAN: { nilai: NilaiNot; titik: boolean; label: string }[] = [
  { nilai: 1, titik: false, label: 'Not penuh' },
  { nilai: 2, titik: false, label: 'Not setengah' },
  { nilai: 2, titik: true, label: 'Setengah bertitik' },
  { nilai: 4, titik: false, label: 'Not seperempat' },
  { nilai: 4, titik: true, label: 'Seperempat bertitik' },
  { nilai: 8, titik: false, label: 'Not seperdelapan' },
  { nilai: 8, titik: true, label: 'Seperdelapan bertitik' },
  { nilai: 16, titik: false, label: 'Not keenambelas' },
]

/* --------------------------- Pembantu kecil (lokal) ----------------------- */

function rep(nilai: number, kali: number): number[] {
  return Array.from({ length: Math.max(0, Math.floor(kali)) }, () => nilai)
}

function jepit(angka: number, min: number, maks: number): number {
  if (!Number.isFinite(angka)) return min
  return Math.min(maks, Math.max(min, Math.floor(angka)))
}

/* ------------------------------ Pengelompokan ----------------------------- */

/**
 * Pengelompokan baku untuk pembilang & penyebut tertentu.
 *
 * Aturannya sengaja sederhana dan bisa ditebak, supaya tidak mengejutkan:
 * - penyebut ≥ 8 (birama *compound*): kalau habis dibagi 3 → kelompok 3;
 *   kalau genap → kelompok 2; sisanya (ganjil) → 2 dengan 3 di akhir.
 * - penyebut ≤ 4: ketukan utamanya not penyebut sendiri (kelompok 1),
 *   kecuali birama compound (6/4, 9/4) dan yang lebih dari 4 ketuk.
 */
export function kelompokBaku(pembilang: number, penyebut: number): number[] {
  const n = jepit(pembilang, MIN_PEMBILANG, MAX_PEMBILANG)
  if (n === 1) return [1]

  // Ganjil: 2 berderet, lalu 3 di akhir → 5 = [2,3], 7 = [2,2,3], 9 = [2,2,2,3].
  const ganjil = (): number[] => {
    const out: number[] = []
    let sisa = n
    while (sisa > 3) {
      out.push(2)
      sisa -= 2
    }
    if (sisa > 0) out.push(sisa)
    return out
  }

  if (penyebut >= 8) {
    if (n % 3 === 0) return rep(3, n / 3)
    if (n % 2 === 0) return rep(2, n / 2)
    return ganjil()
  }

  // penyebut 4, 2, …
  if (n % 3 === 0 && n > 3) return rep(3, n / 3) // 6/4, 9/4, 12/4
  if (n >= 5) return ganjil() // 5/4 = [2,3], 7/4 = [2,2,3]
  return rep(1, n) // 2/4, 3/4, 4/4
}

/** Tanda birama baku untuk pembilang & penyebut, dengan acuan yang masuk akal. */
export function biramaBaku(pembilang: number, penyebut: number, acuan?: AcuanTempo): TandaBirama {
  return {
    pembilang: jepit(pembilang, MIN_PEMBILANG, MAX_PEMBILANG),
    penyebut,
    kelompok: kelompokBaku(pembilang, penyebut),
    acuan: acuan ?? acuanBaku(penyebut),
  }
}

/**
 * Acuan tempo bawaan: birama /4 menghitung seperempat, birama /8 menghitung
 * seperdelapan. Ini yang paling sering diharapkan, tapi bebas diganti.
 */
export function acuanBaku(penyebut: number): AcuanTempo {
  if (penyebut >= 16) return { nilai: 16, titik: false }
  if (penyebut === 8) return { nilai: 8, titik: false }
  return { nilai: 4, titik: false }
}

/* ------------------------------- Normalisasi ------------------------------ */

/**
 * Rapikan tanda birama: pembilang dijepit ke batas aman, dan **kelompok
 * selalu disesuaikan agar jumlahnya tepat = pembilang**.
 *
 * Ini penting karena kelompok bisa diubah bebas oleh pemakai — kalau jumlahnya
 * meleset, aksen akan bergeser diam-diam.
 */
export function normalisasiBirama(t: TandaBirama): TandaBirama {
  const pembilang = jepit(t.pembilang, MIN_PEMBILANG, MAX_PEMBILANG)
  const awal = (t.kelompok ?? []).map((k) => Math.max(1, Math.floor(k) || 1)).filter((k) => k > 0)

  /**
   * Ambil awalan terpanjang yang masih muat, dengan syarat **sisanya cukup
   * untuk menjadi kelompok sendiri** (≥2). Ini yang bikin 7/8 [2,2,3] yang
   * diperkecil ke 5 jadi [2,3], bukan [2,2,1] apalagi [2,5].
   */
  const jumlah = (a: number[]) => a.reduce((x, y) => x + y, 0)
  let kelompok: number[] = []
  let adaAwalanMuat = false
  // Hanya awalan yang **tidak kosong** yang diuji di sini. Kalau ternyata
  // tidak satupun yang muat (mis. kelompok [9] untuk 5/8), jangan dipaksa
  // jadi [5] — pakai pengelompokan baku.
  for (let i = awal.length; i >= 1; i--) {
    const calon = awal.slice(0, i)
    const sisa = pembilang - jumlah(calon)
    if (sisa === 0) {
      kelompok = calon
      adaAwalanMuat = true
      break
    }
    if (sisa >= 2) {
      kelompok = [...calon, sisa]
      adaAwalanMuat = true
      break
    }
  }

  if (!adaAwalanMuat) kelompok = kelompokBaku(pembilang, t.penyebut ?? 4)

  return { ...t, pembilang, kelompok, acuan: t.acuan ?? acuanBaku(t.penyebut ?? 4) }
}

/** Tanda birama bawaan: 4/4, acuan seperempat. */
export function biramaDefault(): TandaBirama {
  return { pembilang: 4, penyebut: 4, kelompok: [1, 1, 1, 1], acuan: { nilai: 4, titik: false } }
}

/**
 * Migrasi dari `beats` lama (angka ketukan per birama, selalu dianggap /4).
 * Lagu lama tetap berbunyi persis seperti sebelumnya.
 */
export function dariBeatsLama(beats: number): TandaBirama {
  const n = jepit(beats, MIN_PEMBILANG, MAX_PEMBILANG)
  return normalisasiBirama({ pembilang: n, penyebut: 4, kelompok: rep(1, n), acuan: acuanBaku(4) })
}

/* --------------------------------- Durasi -------------------------------- */

/** Berapa not penyebut yang setara dengan satu acuan tempo. */
export function notPerAcuan(penyebut: number, acuan: AcuanTempo): number {
  const nilaiAcuan = (4 / acuan.nilai) * (acuan.titik ? 1.5 : 1) // dalam not seperempat
  const nilaiPenyebut = 4 / penyebut // dalam not seperempat
  return nilaiAcuan / nilaiPenyebut
}

/** Detik per **satu not penyebut** pada tempo tertentu. */
export function detikPerNot(bpm: number, penyebut: number, acuan: AcuanTempo): number {
  const aman = Math.min(400, Math.max(20, bpm))
  return 60 / aman / notPerAcuan(penyebut, acuan)
}

/** Detik per **satu acuan tempo** (satu "ketuk" sesuai angka BPM). */
export function detikPerKetuk(bpm: number): number {
  return 60 / Math.min(400, Math.max(20, bpm))
}

/** Lama satu birama penuh dalam detik. */
export function durasiBirama(t: TandaBirama, bpm: number): number {
  return detikPerNot(bpm, t.penyebut, t.acuan) * t.pembilang
}

/**
 * Ubah angka BPM kalau acuan temponya diganti, **dengan kecepatan bunyi yang
 * sama**. Berguna saat pemakai mengganti acuan: lagu tidak tiba-tiba melambat.
 */
export function konversiBpm(
  bpm: number,
  penyebut: number,
  dari: AcuanTempo,
  ke: AcuanTempo,
): number {
  const rasio = notPerAcuan(penyebut, dari) / notPerAcuan(penyebut, ke)
  return jepit(bpm * rasio, 20, 400)
}

/* ------------------------------ Meter → pola ------------------------------ */

/**
 * Ubah tanda birama menjadi `BiramaPola` (bentuk yang dipakai E3).
 *
 * Aksen jatuh di **awal tiap kelompok**; not penyebut lainnya jadi ketuk
 * biasa. `subdiv` memperhalus klik (1 = per not penyebut, 2 = setengahnya …).
 *
 * `hanyaAwal` mengikuti kebiasaan E3: kalau `true`, not di antara awal ketukan
 * **dibiarkan diam** (0) — persis seperti `polaBaku`. Dipakai saat metronom
 * berjalan tanpa pola kustom, supaya memilih pembagian tidak tiba-tiba
 * menghidupkan semua not tengah.
 */
export function bikinPolaDariBirama(
  t: TandaBirama,
  subdiv = 1,
  id?: string,
  hanyaAwal = false,
): BiramaPola {
  const n = normalisasiBirama(t)
  const sd = jepit(subdiv, 1, 4)
  const panjang = n.pembilang * sd
  const cells: TingkatKlik[] = new Array(panjang).fill(hanyaAwal ? 0 : 1)

  /**
   * Kalau **tiap kelompok hanya satu not** (birama sederhana seperti 4/4 atau
   * 3/4), aksen jatuh di ketuk pertama saja. Kalau tidak, semua ketuk jadi
   * aksen dan 4/4 terdengar seperti empat ketuk sama kuat — padahal metronom
   * 4/4 mengaksen ketuk 1.
   *
   * Untuk birama ganjil (7/8 = 2+2+3) tiap kelompok memang lebih dari satu
   * not, jadi aksen jatuh di awal tiap kelompok — itulah yang bikin 7/8
   * terasa seperti 7/8.
   */
  const semuaSatu = n.kelompok.every((g) => g === 1)
  if (!semuaSatu) {
    let pos = 0
    for (const g of n.kelompok) {
      if (pos * sd < panjang) cells[pos * sd] = 2
      pos += g
    }
  }
  // Awal tiap not penyebut selalu jadi ketuk biasa (kecuali sudah jadi aksen).
  if (hanyaAwal) {
    for (let k = 0; k < n.pembilang; k++) {
      const i = k * sd
      if (i < panjang && cells[i] === 0) cells[i] = 1
    }
  }
  if (panjang > 0) cells[0] = 2

  return {
    id: id ?? `bm_${Math.random().toString(36).slice(2, 8)}`,
    beats: n.pembilang,
    subdiv: sd,
    cells,
  }
}

/** Posisi (index not penyebut) tempat aksen jatuh — untuk ditampilkan. */
export function posisiAksen(t: TandaBirama): number[] {
  const n = normalisasiBirama(t)
  const out: number[] = []
  let pos = 0
  for (const g of n.kelompok) {
    out.push(pos)
    pos += g
  }
  return out.filter((p) => p < n.pembilang)
}

/* -------------------------------- Label ---------------------------------- */

/** Tanda birama ditulis seperti di partitur, mis. `7/8`. */
export function labelBirama(t: TandaBirama): string {
  const n = normalisasiBirama(t)
  return `${n.pembilang}/${n.penyebut}`
}

/** Penjelasan ringkas pengelompokan & acuan, mis. `2+2+3 · hitung seperdelapan`. */
export function labelBiramaLengkap(t: TandaBirama): string {
  const n = normalisasiBirama(t)
  const kel = n.kelompok.join('+')
  const a = DAFTAR_ACUAN.find((x) => x.nilai === n.acuan.nilai && x.titik === n.acuan.titik)
  return `${n.pembilang}/${n.penyebut} · ${kel} · hitung ${a?.label.toLowerCase() ?? 'not'}`
}

/* ----------------------------- Daftar pilihan ----------------------------- */

export interface MeterPilihan {
  pembilang: number
  penyebut: number
  kelompok: number[]
  label: string
}

/**
 * Meter yang ditawarkan di dropdown — yang lazim dipakai marching band &
 * ansambel tiup, termasuk meter ganjil dengan beberapa pengelompokan.
 */
export const DAFTAR_METER: MeterPilihan[] = [
  { pembilang: 2, penyebut: 4, kelompok: [1, 1], label: '2/4' },
  { pembilang: 3, penyebut: 4, kelompok: [1, 1, 1], label: '3/4' },
  { pembilang: 4, penyebut: 4, kelompok: [1, 1, 1, 1], label: '4/4' },
  { pembilang: 4, penyebut: 4, kelompok: [2, 2], label: '4/4 · 2+2' },
  { pembilang: 5, penyebut: 4, kelompok: [2, 3], label: '5/4 · 2+3' },
  { pembilang: 5, penyebut: 4, kelompok: [3, 2], label: '5/4 · 3+2' },
  { pembilang: 6, penyebut: 4, kelompok: [3, 3], label: '6/4 · 3+3' },
  { pembilang: 7, penyebut: 4, kelompok: [2, 2, 3], label: '7/4 · 2+2+3' },
  { pembilang: 7, penyebut: 4, kelompok: [3, 2, 2], label: '7/4 · 3+2+2' },
  { pembilang: 3, penyebut: 8, kelompok: [3], label: '3/8' },
  { pembilang: 4, penyebut: 8, kelompok: [2, 2], label: '4/8 · 2+2' },
  { pembilang: 5, penyebut: 8, kelompok: [2, 3], label: '5/8 · 2+3' },
  { pembilang: 5, penyebut: 8, kelompok: [3, 2], label: '5/8 · 3+2' },
  { pembilang: 6, penyebut: 8, kelompok: [3, 3], label: '6/8 · 3+3' },
  { pembilang: 6, penyebut: 8, kelompok: [2, 2, 2], label: '6/8 · 2+2+2' },
  { pembilang: 7, penyebut: 8, kelompok: [2, 2, 3], label: '7/8 · 2+2+3' },
  { pembilang: 7, penyebut: 8, kelompok: [2, 3, 2], label: '7/8 · 2+3+2' },
  { pembilang: 7, penyebut: 8, kelompok: [3, 2, 2], label: '7/8 · 3+2+2' },
  { pembilang: 8, penyebut: 8, kelompok: [3, 3, 2], label: '8/8 · 3+3+2' },
  { pembilang: 9, penyebut: 8, kelompok: [3, 3, 3], label: '9/8 · 3+3+3' },
  { pembilang: 9, penyebut: 8, kelompok: [2, 2, 2, 3], label: '9/8 · 2+2+2+3' },
  { pembilang: 11, penyebut: 8, kelompok: [3, 3, 3, 2], label: '11/8 · 3+3+3+2' },
  { pembilang: 12, penyebut: 8, kelompok: [3, 3, 3, 3], label: '12/8 · 3+3+3+3' },
  { pembilang: 2, penyebut: 2, kelompok: [1, 1], label: '2/2' },
  { pembilang: 3, penyebut: 2, kelompok: [1, 1, 1], label: '3/2' },
  { pembilang: 4, penyebut: 2, kelompok: [1, 1, 1, 1], label: '4/2' },
]

/** Cari meter di daftar yang sama persis (pembilang, penyebut, kelompok). */
export function cariMeter(t: TandaBirama): MeterPilihan | undefined {
  const n = normalisasiBirama(t)
  return DAFTAR_METER.find(
    (m) =>
      m.pembilang === n.pembilang &&
      m.penyebut === n.penyebut &&
      m.kelompok.length === n.kelompok.length &&
      m.kelompok.every((v, i) => v === n.kelompok[i]),
  )
}

/* ----------------------------- Hitung mundur ------------------------------ */

export function hitungMundurDefault(): HitungMundur {
  return { on: false, ulang: 1, tiapNot: false, suara: 'bel' }
}

/**
 * Berapa ketukan hitung mundur yang dibunyikan, dan **apa yang diucapkan**
 * tiap ketuk — dihitung dari tanda birama birama pertama yang akan dimainkan.
 *
 * Mengembalikan daftar ucapan dalam **satu** putaran hitung mundur; pemutar
 * tinggal mengulangnya sebanyak `ulang`.
 */
export function ucapHitungMundur(t: TandaBirama, h: HitungMundur): string[] {
  const n = normalisasiBirama(t)
  const jumlah = h.tiapNot ? n.pembilang : n.kelompok.length
  const kustom = (h.ucap ?? []).filter((s) => s.trim() !== '')
  if (kustom.length > 0) {
    // Ucapan kustom dipakai apa adanya; diulang kalau lebih pendek dari jumlah.
    return Array.from({ length: jumlah }, (_, i) => kustom[i % kustom.length])
  }
  return Array.from({ length: jumlah }, (_, i) => String(i + 1))
}

/**
 * Posisi (dalam not penyebut) tiap ketukan hitung mundur di dalam birama.
 * Dipakai untuk menjadwalkan bunyi pada waktu yang tepat.
 */
export function posisiHitungMundur(t: TandaBirama, h: HitungMundur): number[] {
  const n = normalisasiBirama(t)
  if (h.tiapNot) return Array.from({ length: n.pembilang }, (_, i) => i)
  return posisiAksen(n)
}

/* ---------------------- Lini masa lagu (mode lagu M1) --------------------- */

/**
 * Segmen tempo dalam bentuk paling sederhana — cukup untuk menghitung
 * lini masa tanpa perlu mengimpor tipe `Song`. Sengaja dibuat longgar
 * supaya bagian ini tetap murni dan mudah diuji.
 */
export interface SegmenWaktu {
  /** birama mulainya segmen ini (1-based) */
  measure: number
  bpm: number
  /** sukat segmen ini; kosong = mewarisi sukat lagu */
  birama?: TandaBirama
  /**
   * N9 — 1 = menuju segmen berikutnya berangsur.
   *
   * Sengaja dicerminkan dari `SegmenTempo.berangsur` di metronome.ts
   * supaya hitungan di modul ini (waktu lagu, pemetaan drill↔musik)
   * bisa memakai luncuran yang sama dengan yang berbunyi. Opsional:
   * tanpa ini perilakunya persis seperti sediakala.
   */
  berangsur?: 0 | 1
  /** Posisi 1-based dalam birama; opsional supaya map lama tetap kompatibel. */
  beat?: number
  subdivision?: number
  subdivisionsPerBeat?: number
  /** Durasi ramp eksplisit dan unit hitungannya. */
  rampCounts?: number
  rampUnit?: 'beat' | 'tempoBeat' | 'subdivision' | 'tempoSubdivision' | 'bar'
  rampSubdivisions?: number
  rampFromBpm?: number
}

/** Urutkan segmen berdasarkan birama mulaimya. */
function urut<T extends { measure: number }>(daftar: T[]): T[] {
  return [...daftar].sort((a, b) => a.measure - b.measure)
}

/**
 * Index segmen tempo yang berlaku pada birama ke-`b`.
 * `-1` kalau birama itu **sebelum** segmen pertama (tempo dasar lagu).
 */
export function indexSegmen(segmen: SegmenWaktu[], b: number): number {
  let idx = -1
  const s = urut(segmen)
  for (let i = 0; i < s.length; i++) if (s[i].measure <= b) idx = i
  return idx
}

/** Rentang birama segmen ke-`i`. `selesai` = null kalau ini segmen terakhir. */
export function rentangSegmen(
  segmen: SegmenWaktu[],
  i: number,
): { mulai: number; selesai: number | null } | null {
  const s = urut(segmen)
  if (i < 0 || i >= s.length) return null
  const berikut = s[i + 1]
  return { mulai: s[i].measure, selesai: berikut ? berikut.measure - 1 : null }
}

/** Sukat yang berlaku pada birama ke-`b` (segmen → warisan lagu). */
export function meterPada(segmen: SegmenWaktu[], b: number, warisan: TandaBirama): TandaBirama {
  const s = urut(segmen)
  const i = indexSegmen(s, b)
  const m = i >= 0 ? s[i].birama : undefined
  return normalisasiBirama(m ?? warisan)
}

/**
 * Tempo (BPM) yang berlaku pada birama ke-`b` (segmen → tempo dasar).
 *
 * N10 — PERHATIAN: ini tempo **TANGGA**, bukan tempo yang berbunyi. Ia
 * tidak tahu luncuran per segmen (`berangsur`) maupun luncuran
 * menyeluruh (`latih`).
 *
 * Dulu ia dipakai panel lagu dan pemetaan drill, dan di kedua tempat itu
 * ia menampilkan/menghitung angka yang berbeda dari yang berbunyi.
 * Sekarang tidak ada lagi pemanggilnya di aplikasi — yang tersisa hanya
 * uji. Untuk menampilkan atau memainkan tempo, pakai
 * `tempoBerlaku(opsi, birama)` di `metronome.ts`.
 */
export function tempoPada(segmen: SegmenWaktu[], b: number, tempoDasar: number): number {
  const s = urut(segmen)
  const i = indexSegmen(s, b)
  return i >= 0 ? s[i].bpm : tempoDasar
}

/**
 * Lama birama ke-`b` dalam detik, memperhitungkan sukat & tempo segmen.
 *
 * N10 — PERHATIAN: memakai `tempoPada`, jadi juga **buta luncuran**.
 * Tidak ada pemanggilnya di aplikasi; yang tersisa hanya uji.
 */
export function detikBiramaPada(
  segmen: SegmenWaktu[],
  b: number,
  warisan: TandaBirama,
  tempoDasar: number,
): number {
  return durasiBirama(meterPada(segmen, b, warisan), tempoPada(segmen, b, tempoDasar))
}

/**
 * Total detik dari awal lagu **sampai menjelang** birama ke-`b`
 * (jadi birama ke-1 = 0 detik).
 *
 * Dipakai untuk menampilkan "berjalan 1:23" dan posisi dalam lagu.
 * Dibatasi 5000 birama supaya tidak pernah membeku kalau data iseng.
 */
export function detikSampai(
  segmen: SegmenWaktu[],
  b: number,
  warisan: TandaBirama,
  tempoDasar: number,
  /**
   * N7 — tempo pada birama tertentu, kalau tempo tidak lagi bertangga.
   *
   * Tanpa ini, semua hitungan waktu menganggap tempo datar di dalam satu
   * segmen. Itu benar untuk lagu lama, tapi salah begitu ada luncuran
   * (berangsur per segmen maupun perubahan menyeluruh): tiga birama yang
   * meluncur 172 → 140 ternyata lebih panjang daripada tiga birama 172.
   *
   * Opsional sengaja: pemanggil yang tidak mengirimkannya mendapat
   * perilaku lama persis, jadi lagu lama tidak berubah sedetik pun.
   */
  tempoUntuk?: (birama: number) => number,
): number {
  const s = urut(segmen)
  const sampai = Math.max(1, Math.min(5000, Math.floor(b)))

  // Jalan per birama: tempo bisa berbeda tiap birama, jadi tidak bisa
  // lagi dikelompokkan per rentang. Batas 5000 birama di atas membuat
  // ini tetap cepat walau data iseng.
  if (tempoUntuk) {
    let detik = 0
    let i = 0 // segmen berikutnya yang belum dipakai
    let aktif = -1 // segmen yang sedang berlaku
    for (let birama = 1; birama < sampai; birama++) {
      // Tentukan segmen yang berlaku DULU, baru hitung durasinya.
      while (i < s.length && s[i].measure <= birama) {
        aktif = i
        i++
      }
      const meter = aktif >= 0 ? (s[aktif].birama ?? warisan) : warisan
      detik += durasiBirama(normalisasiBirama(meter), tempoUntuk(birama))
    }
    return detik
  }

  // Dihitung per rentang antar-segmen (bukan per birama) supaya cepat.
  let detik = 0
  let birama = 1
  let i = 0 // segmen berikutnya yang belum dipakai
  let aktif = -1 // segmen yang sedang berlaku
  while (birama < sampai) {
    // Tentukan segmen yang berlaku DULU, baru hitung durasinya — kalau
    // dibalik, tempo & sukat segmen pertama terlewat.
    while (i < s.length && s[i].measure <= birama) {
      aktif = i
      i++
    }
    const batas = i < s.length ? Math.min(s[i].measure, sampai) : sampai
    if (batas <= birama) break
    const meter = aktif >= 0 ? (s[aktif].birama ?? warisan) : warisan
    const bpm = aktif >= 0 ? s[aktif].bpm : tempoDasar
    detik += (batas - birama) * durasiBirama(normalisasiBirama(meter), bpm)
    birama = batas
  }
  return detik
}

/**
 * #6 — Kebalikan `detikSampai`: birama ke berapa (dan sisa detik di dalamnya)
 * pada detik lagu ke-`detik`.
 *
 * Mengapa perlu: begitu rekaman dijadikan **patokan waktu** (lihat `JamLagu`
 * di metronome.ts), penjadwal klik tidak lagi boleh menebak posisinya sendiri
 * — ia harus bisa bertanya "rekaman sekarang ada di birama berapa?", termasuk
 * sesudah pemakai menggeser garis waktu atau mengulang satu bagian. Pertanyaan
 * itu tidak bisa dijawab `detikSampai` (yang arahnya ke depan).
 *
 * Memakai `tempoUntuk` yang sama seperti `detikSampai`, jadi kedua arah
 * memakai tempo yang berbunyi — bukan tempo tangga.
 */
export function biramaPadaDetik(
  segmen: SegmenWaktu[],
  detik: number,
  warisan: TandaBirama,
  tempoDasar: number,
  /** N7 — seperti `detikSampai`: tanpa ini, tempo dianggap bertangga. */
  tempoUntuk?: (birama: number) => number,
): { birama: number; sisa: number } {
  const s = urut(segmen)
  const target = Math.max(0, detik)
  let akumulasi = 0
  let i = 0
  let aktif = -1
  for (let birama = 1; birama <= 5000; birama++) {
    while (i < s.length && s[i].measure <= birama) {
      aktif = i
      i++
    }
    const meter = normalisasiBirama(aktif >= 0 ? (s[aktif].birama ?? warisan) : warisan)
    const bpm = tempoUntuk ? tempoUntuk(birama) : aktif >= 0 ? s[aktif].bpm : tempoDasar
    const dur = durasiBirama(meter, bpm)
    if (akumulasi + dur > target) return { birama, sisa: target - akumulasi }
    akumulasi += dur
  }
  return { birama: 5000, sisa: 0 }
}

/* ------------------------------- M5 — panjang lagu ------------------------------ */
/**
 * M5 — total durasi lagu yang panjangnya `panjangBirama` birama.
 *
 * `detikSampai` menghitung waktu **menjelang** suatu birama, jadi durasi
 * birama ke-`N` baru ikut terhitung pada `N + 1`.
 *
 * `panjangBirama` yang tidak masuk akal (kosong, nol, negatif, bukan angka)
 * dikembalikan sebagai `null` — penanda "lagu tanpa akhir", supaya lagu lama
 * tetap berjalan seperti sebelumnya.
 */
export function detikTotal(
  segmen: SegmenWaktu[],
  panjangBirama: number | undefined,
  warisan: TandaBirama,
  tempoDasar: number,
  tempoUntuk?: (birama: number) => number,
): number | null {
  const n = Math.floor(panjangBirama ?? 0)
  if (!Number.isFinite(n) || n < 1) return null
  return detikSampai(segmen, n + 1, warisan, tempoDasar, tempoUntuk)
}

/**
 * M5 — detik yang tersisa mulai **awal birama ke-`b`** sampai lagu habis.
 *
 * `null` kalau lagu tidak punya panjang (lagu lama) — bukan nol, supaya
 * tampilan bisa membedakan "tidak ada batas" dari "tinggal 0 detik".
 */
export function detikSisa(
  segmen: SegmenWaktu[],
  panjangBirama: number | undefined,
  b: number,
  warisan: TandaBirama,
  tempoDasar: number,
  tempoUntuk?: (birama: number) => number,
): number | null {
  const total = detikTotal(segmen, panjangBirama, warisan, tempoDasar, tempoUntuk)
  if (total === null) return null
  const n = Math.floor(panjangBirama!)
  // Kalau sudah lewat akhir lagu (misalnya karena loncat ke segmen),
  // sisanya nol — jangan sampai negatif.
  const sudah = detikSampai(segmen, Math.min(b, n + 1), warisan, tempoDasar, tempoUntuk)
  return Math.max(0, total - sudah)
}

/**
 * M5 — posisi dalam lagu, 0 di awal sampai 1 di akhir.
 *
 * Dihitung dari **waktu**, bukan jumlah birama, karena birama bisa
 * berbeda-beda panjangnya kalau sukatnya berganti.
 */
export function rasioProgres(
  segmen: SegmenWaktu[],
  panjangBirama: number | undefined,
  b: number,
  warisan: TandaBirama,
  tempoDasar: number,
  tempoUntuk?: (birama: number) => number,
): number | null {
  const total = detikTotal(segmen, panjangBirama, warisan, tempoDasar, tempoUntuk)
  if (total === null || total <= 0) return null
  const n = Math.floor(panjangBirama!)
  const sudah = detikSampai(segmen, Math.min(b, n + 1), warisan, tempoDasar, tempoUntuk)
  return Math.min(1, Math.max(0, sudah / total))
}

/** Waktu "m:ss" dari detik — untuk ditampilkan di panel. */
export function formatWaktu(detik: number): string {
  const d = Math.max(0, Math.floor(detik))
  const m = Math.floor(d / 60)
  const s = d % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
