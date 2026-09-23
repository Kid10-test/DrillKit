/**
 * H1 — rencana latihan per sesi.
 *
 * Keluhan yang mendasarinya: **latihan sering melenceng dari rencana, dan
 * bagian akhir yang kehabisan waktu.** Bagian akhir selalu yang paling
 * mahal — di situlah biasanya materi yang paling perlu diulang — tetapi
 * justru yang paling dulu dipotong kalau waktunya habis.
 *
 * Modul ini mengerjakan dua hal yang berbeda waktunya:
 *
 * 1. **Sebelum latihan** — apakah rencananya muat di slot sesinya?
 *    (blok 5 × 20 menit di sesi 90 menit tidak akan pernah muat, dan itu
 *    seharusnya ketahuan sebelum lapangan, bukan sesudahnya.)
 * 2. **Selama latihan** — di blok mana kita sekarang, dan **berapa menit
 *    kita sudah melenceng**? Melencengnya terakumulasi, jadi blok terakhir
 *    menanggung semua keterlambatan blok-blok sebelumnya.
 *
 * Sengaja **murni** (tidak menyentuh Dexie, React, atau DOM) supaya bisa
 * diuji langsung dari node, seperti `runsheet.ts` dan `lomba.ts`.
 */
import type { BlokLatihan, JenisBlok, RealisasiBlok } from '../db/types'

/** Satu blok rencana, sudah dihitung waktu absolutnya. */
export interface BarisRencana {
  id: string
  judul: string
  jenis: JenisBlok
  /** Durasi yang direncanakan, dalam menit. */
  menit: number
  catatan?: string
  /** Menit sejak tengah malam. `null` kalau jam mulai sesi tidak sah. */
  mulai: number | null
  selesai: number | null
  urutan: number
}

export const URUTAN_BLOK: JenisBlok[] = ['pemanasan', 'section', 'gabungan', 'pendingin', 'lainnya']

export const LABEL_BLOK: Record<JenisBlok, string> = {
  pemanasan: 'Pemanasan',
  section: 'Section',
  gabungan: 'Gabungan',
  pendingin: 'Pendingin',
  lainnya: 'Lainnya',
}

/** Warna per jenis blok, seragam dengan gaya badge di seluruh aplikasi. */
export const WARNA_BLOK: Record<JenisBlok, string> = {
  pemanasan: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  section: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  gabungan: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  pendingin: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  lainnya: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
}

/** Total menit yang direncanakan. Blok dengan durasi tidak sah diabaikan. */
export function totalRencana(blok: BlokLatihan[] | undefined): number {
  if (!blok) return 0
  return blok.reduce((t, b) => t + (b.menit > 0 ? b.menit : 0), 0)
}

/**
 * Turunkan waktu absolut tiap blok dengan menjumlahkan durasinya dari jam
 * mulai sesi.
 *
 * `mulai` boleh `null` — entah jam mulainya tidak terbaca, atau sesinya
 * memang tidak berjam. Blok-bloknya tetap disusun, hanya tanpa waktu.
 * Ini sengaja: rencana tanpa jam masih berguna sebagai daftar urutan.
 */
export function susunRencana(mulai: number | null, blok: BlokLatihan[] | undefined): BarisRencana[] {
  if (!blok || blok.length === 0) return []
  let m = mulai
  return blok.map((b, urutan) => {
    const menit = b.menit > 0 ? b.menit : 0
    const awal = m
    const akhir = m == null ? null : m + menit
    if (m != null) m += menit
    return {
      id: b.id,
      judul: b.judul,
      jenis: b.jenis,
      menit,
      catatan: b.catatan,
      mulai: awal,
      selesai: akhir,
      urutan,
    }
  })
}

/**
 * Berapa menit rencana **melebihi** slot sesinya.
 *
 * `null` = tidak bisa dinilai (slotnya tidak terbaca), jadi jangan
 * diklaim "muat". Angka > 0 = kelebihannya; ≤ 0 = muat.
 */
export function lebihRencana(lamaSlot: number | null, blok: BlokLatihan[] | undefined): number | null {
  if (lamaSlot == null) return null
  return totalRencana(blok) - lamaSlot
}

export type FaseLatihan = 'belumMulai' | 'berjalan' | 'rampung'

export interface PosisiLatihan {
  /** Menit sejak tengah malam, sesuai jam yang diberikan. */
  menit: number
  fase: FaseLatihan
  /** Blok yang sedang berjalan. `null` kalau di luar rentang rencana. */
  blok: BarisRencana | null
  /**
   * Menit tersisa pada blok yang berjalan. **Boleh negatif** — negatif
   * berarti blok ini sudah lewat dari jatahnya dan belum dituntaskan.
   */
  sisaBlok: number | null
  /** Blok yang sudah dilewati, dalam urutan rencana. */
  sudahLewat: BarisRencana[]
  /** Blok yang belum dikerjakan. */
  tersisa: BarisRencana[]
  /**
   * **Inti modul ini.** Geser kumulatif dalam menit: positif = terlambat,
   * negatif = lebih cepat dari rencana. Dihitung dari realisasi, bukan
   * dari rencana — karena rencana tidak pernah melenceng, kenyataannya yang
   * melenceng.
   */
  geser: number
  /** Total menit yang direncanakan. */
  totalRencana: number
  /**
   * Proyeksi jam selesainya semua blok, dalam menit sejak tengah malam.
   * Inilah jawaban untuk "apakah bagian akhir kehabisan waktu".
   * `null` kalau rencananya tidak berjam.
   */
  proyeksiSelesai: number | null
  /** Berapa blok yang sudah dicatat realisasinya. */
  tercatat: number
}

/**
 * Posisi latihan saat ini.
 *
 * Dua jangkar yang berbeda, dipakai bergantung pada apa yang tersedia:
 *
 * - **Jangkar realisasi** (utama). Kalau ada blok yang benar-benar sudah
 *   dimulai, posisi dan gesernya dihitung dari **kenyataan**.
 * - **Jangkar rencana** (cadangan). Kalau belum ada yang dimulai, posisi
 *   ditentukan dengan mencari blok yang slotnya mencakup jam sekarang —
 *   memakai **rentang setengah terbuka** `mulai ≤ now < selesai`, sama
 *   seperti `posisiHari` di G2, supaya menit pertama sesi sudah menjadi
 *   milik blok pertama.
 *
 * Geser hanya dihitung setelah blok pertama benar-benar dimulai. Sebelum
 * itu nilainya 0, bukan karena tepat waktu, melainkan karena **belum ada
 * yang bisa diketahui** — membedakan "tidak tahu" dari "tepat waktu"
 * adalah pelajaran yang sama dengan status `takPasti` di G1.
 */
export function posisiLatihan(bahan: {
  rencana: BarisRencana[]
  realisasi: RealisasiBlok[]
  /** Menit sejak tengah malam, jam saat ini. */
  menit: number
  /** Epoch ms saat ini — diperlukan untuk menghitung durasi blok berjalan. */
  kini: number
}): PosisiLatihan {
  const { rencana, realisasi, menit, kini } = bahan
  const peta = new Map(realisasi.map((r) => [r.id, r]))
  const total = rencana.reduce((t, b) => t + b.menit, 0)

  // --- Jangkar realisasi: ada blok yang sedang berjalan?
  const berjalan = rencana.find((b) => {
    const r = peta.get(b.id)
    return r != null && r.mulai != null && r.selesai == null
  })

  // --- Geser kumulatif dari realisasi.
  //
  // Blok yang **sudah selesai** menyumbang seluruh selisihnya, entah lebih
  // atau kurang dari rencana.
  //
  // Blok yang **sedang berjalan** hanya menyumbang kelebihannya yang sudah
  // terjadi — `max(0, berjalan − rencana)`. Ini penting: kalau ia ikut
  // menyumbang selisih utuhnya, maka baru 5 menit masuk blok 20 menit akan
  // terbaca "lebih cepat 15 menit", padahal yang benar kita tidak tahu apa
  // pun selain "belum melenceng".
  let geser = 0
  for (const b of rencana) {
    const r = peta.get(b.id)
    if (!r || r.mulai == null) break // belum ada catatan → setelahnya tak dinilai
    if (r.selesai != null) {
      geser += (r.selesai - r.mulai) / 60000 - b.menit
    } else {
      geser += Math.max(0, (kini - r.mulai) / 60000 - b.menit)
      break
    }
  }

  let blok: BarisRencana | null = berjalan ?? null
  let sisaBlok: number | null = null

  if (berjalan) {
    const r = peta.get(berjalan.id)!
    sisaBlok = berjalan.menit - (kini - r.mulai) / 60000
  } else {
    // --- Jangkar rencana: blok yang slotnya mencakup jam sekarang.
    const berwaktu = rencana.filter((b) => b.mulai != null && b.selesai != null)
    const isi = berwaktu.find((b) => b.mulai! <= menit && menit < b.selesai!)
    if (isi) {
      blok = isi
      sisaBlok = isi.selesai! - menit
    }
  }

  const idx = blok ? blok.urutan : -1
  const sudahLewat = idx >= 0 ? rencana.slice(0, idx) : []
  const tersisa = idx >= 0 ? rencana.slice(idx + 1) : rencana

  let fase: FaseLatihan
  if (blok) fase = 'berjalan'
  else if (rencana.length === 0) fase = 'rampung'
  else {
    const berwaktu = rencana.filter((b) => b.mulai != null && b.selesai != null)
    const adaYangBelum = berwaktu.some((b) => b.selesai! > menit)
    fase = adaYangBelum || berwaktu.length === 0 ? 'belumMulai' : 'rampung'
  }

  // Proyeksi selesai: ujung rencana digeser sebesar keterlambatan yang
  // sudah terakumulasi. Di sinilah "bagian akhir kehabisan waktu" kelihatan
  // sebelum benar-benar terjadi.
  const ujung = rencana.length ? rencana[rencana.length - 1].selesai : null
  const proyeksiSelesai = ujung == null ? null : ujung + geser

  return {
    menit,
    fase,
    blok,
    sisaBlok,
    sudahLewat,
    tersisa,
    geser,
    totalRencana: total,
    proyeksiSelesai,
    tercatat: realisasi.filter((r) => r.mulai != null).length,
  }
}

/** "25 mnt" / "1 jam 10 mnt" — ringkas untuk dibaca sekilas. */
export function formatMenit(m: number): string {
  const t = Math.max(0, Math.round(m))
  if (t < 60) return `${t} mnt`
  const j = Math.floor(t / 60)
  const s = t % 60
  return s ? `${j} jam ${s} mnt` : `${j} jam`
}

/**
 * Tanda geser untuk ditampilkan: "tepat", "lebih 7 mnt", "kurang 3 mnt".
 *
 * Ambang 1 menit dipakai supaya selisih receh karena detik tidak
 * mengganggu tampilan — latihan yang melenceng 20 detik tidak perlu
 * diberi warna merah.
 */
export function formatGeser(geser: number): string {
  const g = Math.round(geser)
  if (Math.abs(g) < 1) return 'tepat waktu'
  return g > 0 ? `terlambat ${formatMenit(g)}` : `lebih cepat ${formatMenit(-g)}`
}
