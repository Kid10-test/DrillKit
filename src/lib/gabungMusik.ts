/**
 * M1 — Memakai tempo & segmen lagu untuk drill ("drill display" mengikuti musik).
 *
 * Sengaja **murni** (tanpa DOM, basis data, atau React) supaya bisa diuji di
 * node — lihat `/home/user/qa/uji-gabung-musik.mjs`.
 *
 * Gagasannya: tiap set drill punya `counts` (berapa hitungan untuk pindah ke
 * set berikutnya). Kalau drill ditautkan ke lagu, hitungan itu **berjalan di
 * atas musik**: tempo & sukatnya diambil dari lagu pada birama tempat set itu
 * mulai. Jadi drill mengikuti perubahan tempo lagu, bukan satu tempo datar.
 *
 * Yang dipakai untuk memajukan posisi:
 * - 1 hitungan = `beatsPerCount` ketuk,
 * - 1 ketuk = satu **not acuan** pada tempo berjalan (60/BPM detik),
 * - 1 birama = `pembilang / notPerAcuan` ketuk — jadi sukat ikut menentukan
 *   berapa birama yang terlewati, termasuk saat sukatnya berganti.
 */

import type { LatihTempo, TandaBirama } from '../db/types'
import type { TempoLatihan } from './tempoLatihan'
import {
  durasiBirama,
  formatWaktu,
  normalisasiBirama,
  notPerAcuan,
} from './birama'
import type { SegmenWaktu } from './birama'
import { createTempoTimeline } from './tempoTimeline'

/** Lagu dalam bentuk yang dibutuhkan pemetaan (tanpa mengimpor tipe Song). */
export interface LaguRingkas {
  bpm: number
  tandaBirama: TandaBirama
  tempoMap: SegmenWaktu[]
  /** N9 — perubahan tempo menyeluruh lagu ini; ikut menentukan temponya. */
  latih?: LatihTempo | null
}

/** Satu set drill setelah dipetakan ke musik. */
export interface PetaSet {
  /** index set (0-based, sesuai urutan set) */
  index: number
  /** birama lagu tempat set ini mulai — bisa pecahan (mis. 9,5) */
  biramaMulai: number
  /** tempo yang dipakai set ini, dari tempo map lagu */
  bpm: number
  /** sukat lagu yang berlaku pada set ini */
  birama: TandaBirama
  /** Lama set pada tempo partitur (detik), untuk sinkronisasi/scrub audio. */
  detik: number
  /** Lama set setelah tempo latihan lokal (detik), untuk animasi & klik drill. */
  detikLatihan: number
  /** Offset klik tiap hitungan set, dihitung oleh TempoTimeline (detik). */
  offsetKlikLatihan: number[]
  /** BPM partitur pada setiap hitungan set (untuk label/analitik). */
  bpmPerHitungan: number[]
  /** BPM setelah tempo latihan lokal, yaitu tempo yang dipakai bunyi/animasi. */
  bpmLatihanPerHitungan: number[]
  /**
   * #6 — detik lagu saat set ini MULAI (jumlah lama set-set sebelumnya).
   *
   * Dipakai untuk menempatkan rekaman audio pada posisi yang benar. Dulu
   * pemanggil memakai `detik` — yang artinya *lama* set, bukan *posisi
   * mulainya — sehingga rekaman selalu berbunyi satu set terlalu jauh.
   */
  detikMulai: number
  /** jumlah hitungan set ini */
  counts: number
}

/** Berapa ketuk (not acuan) dalam satu birama pada sukat tertentu. */
export function ketukPerBirama(t: TandaBirama): number {
  const n = normalisasiBirama(t)
  const per = notPerAcuan(n.penyebut, n.acuan)
  return per > 0 ? n.pembilang / per : n.pembilang
}

/**
 * Petakan urutan set drill ke lini masa lagu.
 *
 * Dijalankan berurutan pada posisi quarter-note yang sama dengan evaluator
 * tempo lagu. Tiap hitungan drill dimajukan sebagai pulsa acuan BPM; durasi,
 * posisi audio, dan offset klik tiap hitungan berasal dari evaluator itu juga.
 */
export function petakanSetKeMusik(
  sets: { counts: number }[],
  beatsPerCount: number,
  lagu: LaguRingkas,
  latihan?: TempoLatihan | null,
): PetaSet[] {
  const bpc = Math.max(0.25, beatsPerCount)
  const timeline = createTempoTimeline({
    bpm: lagu.bpm,
    meter: lagu.tandaBirama,
    segments: lagu.tempoMap,
    latih: lagu.latih ?? null,
  })
  const out: PetaSet[] = []
  let startQuarter = 0

  for (let i = 0; i < sets.length; i += 1) {
    const counts = Math.max(1, Math.floor(sets[i].counts))
    const position = timeline.positionAtQuarter(startQuarter)
    const meter = timeline.meterAtQuarter(startQuarter)
    const bpm = timeline.tempoAtQuarter(startQuarter)
    const originalStart = timeline.secondsAtQuarter(startQuarter)
    const practiceStart = timeline.secondsAtQuarter(startQuarter, latihan)
    const clickOffsets: number[] = []
    const bpmPerHitungan: number[] = []
    const bpmLatihanPerHitungan: number[] = []
    let clickQuarter = startQuarter

    for (let count = 0; count < counts; count += 1) {
      clickOffsets.push(Math.max(0, timeline.secondsAtQuarter(clickQuarter, latihan) - practiceStart))
      bpmPerHitungan.push(timeline.tempoAtQuarter(clickQuarter))
      bpmLatihanPerHitungan.push(timeline.tempoAtQuarter(clickQuarter, latihan))
      clickQuarter = timeline.advanceTempoBeats(clickQuarter, bpc)
    }

    const endQuarter = timeline.advanceTempoBeats(startQuarter, counts * bpc)
    const detik = timeline.secondsBetween(startQuarter, endQuarter)
    const detikLatihan = timeline.secondsBetween(startQuarter, endQuarter, latihan)
    out.push({
      index: i,
      biramaMulai: position.measurePosition,
      bpm,
      birama: meter,
      detik,
      detikLatihan,
      offsetKlikLatihan: clickOffsets,
      bpmPerHitungan,
      bpmLatihanPerHitungan,
      detikMulai: originalStart,
      counts,
    })
    startQuarter = endQuarter
  }
  return out
}

/** Tempo untuk set ke-`i`; jatuh ke tempo drill kalau tidak ada pemetaan. */
export function tempoSet(peta: PetaSet[] | null, i: number, tempoDrill: number): number {
  if (!peta || peta.length === 0) return tempoDrill
  const p = peta[i] ?? peta[peta.length - 1]
  return p ? p.bpm : tempoDrill
}

/** Daftar tempo per set, untuk dikirim ke presenter. */
export function daftarTempo(peta: PetaSet[] | null, tempoDrill: number, jumlah: number): number[] {
  return Array.from({ length: Math.max(0, jumlah) }, (_, i) => tempoSet(peta, i, tempoDrill))
}

/** Total durasi semua perpindahan (detik). */
export function totalDetik(peta: PetaSet[]): number {
  return peta.reduce((a, p) => a + p.detik, 0)
}

/**
 * Lama satu birama pada sukat & tempo tertentu — dibungkus supaya pemanggil
 * tidak perlu mengimpor dua modul.
 */
export function lamaBirama(t: TandaBirama, bpm: number): number {
  return durasiBirama(t, bpm)
}

export { formatWaktu }
