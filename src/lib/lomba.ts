/**
 * G2 — mode lomba: posisi hari ini **saat ini juga**.
 *
 * G1 menjawab "apakah rencananya muat". G2 menjawab "di mana kita sekarang,
 * dan apa yang harus disiapkan berikutnya" — ditampilkan sebesar mungkin
 * supaya bisa dibaca dari seberang ruang persiapan.
 *
 * Sengaja **murni** (menerima menit, bukan `Date`) supaya bisa diuji di node
 * tanpa menunggu jam sungguhan berjalan.
 */
import type { BarisRun, RunSheet } from './runsheet'

export type FaseHari = 'belumMulai' | 'sedang' | 'senggang' | 'rampung'

export interface PosisiHari {
  /** Menit sejak tengah malam, sesuai jam yang diberikan. */
  menit: number
  fase: FaseHari
  /** Sesi yang slotnya mencakup menit ini. `null` kalau di sela sesi. */
  sekarang: BarisRun | null
  /** Sesi berikutnya yang belum mulai. `null` kalau tidak ada lagi. */
  berikutnya: BarisRun | null
  /** Menit menuju mulai sesi berikutnya. `null` kalau tidak ada berikutnya. */
  menitKeBerikutnya: number | null
  /** Menit tersisa pada slot yang sedang berjalan. `null` kalau tidak di sesi. */
  sisaSlot: number | null
  /** Sesi hari ini yang waktunya sudah lewat. */
  sudahLewat: number
  /** Jumlah sesi yang punya waktu sah. */
  totalSesi: number
  /**
   * Penampilan terdekat yang membawa set list — entah sedang berjalan atau
   * yang berikutnya. Inilah yang perlu dipersiapkan pemain.
   */
  tampilan: BarisRun | null
}

/**
 * Hitung posisi hari ini pada menit tertentu.
 *
 * Baris tanpa waktu sah diabaikan: tidak bisa diketahui kapan ia terjadi,
 * jadi ikut serta hanya akan mengacaukan perhitungan "sudah lewat".
 */
export function posisiHari(run: RunSheet, menit: number): PosisiHari {
  const berwaktu = run.baris.filter((b) => b.mulai != null && b.selesai != null)

  const sekarang = berwaktu.find((b) => b.mulai! <= menit && menit < b.selesai!) ?? null
  const berikutnya = berwaktu.filter((b) => b.mulai! > menit).sort((a, b) => a.mulai! - b.mulai!)[0] ?? null
  const sudahLewat = berwaktu.filter((b) => b.selesai! <= menit).length

  let fase: FaseHari
  if (sekarang) fase = 'sedang'
  else if (berikutnya) fase = sudahLewat === 0 ? 'belumMulai' : 'senggang'
  else fase = 'rampung'

  // Penampilan yang perlu dipersiapkan: yang sedang berjalan kalau ada,
  // selain itu yang berikutnya. Kalau sedang berjalan sudah lewat slotnya,
  // tetap yang berikutnya yang lebih berguna.
  const berisi = (b: BarisRun | null) => (b && b.lamaIsi != null ? b : null)
  const tampilan = berisi(sekarang) ?? berisi(berikutnya)

  return {
    menit,
    fase,
    sekarang,
    berikutnya,
    menitKeBerikutnya: berikutnya ? berikutnya.mulai! - menit : null,
    sisaSlot: sekarang ? sekarang.selesai! - menit : null,
    sudahLewat,
    totalSesi: berwaktu.length,
    tampilan,
  }
}

/** "1 jam 20 mnt" / "45 mnt" / "3 mnt" — ringkas untuk dibaca sekilas. */
export function formatMenit(m: number): string {
  const t = Math.max(0, Math.round(m))
  if (t < 60) return `${t} mnt`
  const j = Math.floor(t / 60)
  const s = t % 60
  return s ? `${j} jam ${s} mnt` : `${j} jam`
}

/** Detik dalam bentuk "MM:SS" atau "HH:MM:SS" untuk hitung mundur. */
export function formatHitungMundur(detik: number): string {
  const t = Math.max(0, Math.floor(detik))
  const j = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const s = t % 60
  const p = (n: number) => String(n).padStart(2, '0')
  return j ? `${j}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`
}
