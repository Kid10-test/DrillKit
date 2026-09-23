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
import {
  durasiBirama,
  formatWaktu,
  meterPada,
  normalisasiBirama,
  notPerAcuan,
} from './birama'
import type { SegmenWaktu } from './birama'
import { jepitTempo, tempoBerlaku } from './metronome'

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
  /** lama perpindahan set ini (detik) */
  detik: number
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
 * Dijalankan berurutan dari set pertama: tiap set memajukan posisi birama
 * sesuai hitungannya, lalu tempo & sukat untuk set berikutnya dibaca pada
 * posisi baru itu. Karena itu perubahan tempo & sukat lagu diikuti dengan
 * benar meski terjadi di tengah drill.
 */
export function petakanSetKeMusik(
  sets: { counts: number }[],
  beatsPerCount: number,
  lagu: LaguRingkas,
): PetaSet[] {
  const bpc = Math.max(0.25, beatsPerCount)
  const out: PetaSet[] = []
  let pos = 1

  for (let i = 0; i < sets.length; i++) {
    const m = Math.max(1, Math.floor(pos))
    const meter = meterPada(lagu.tempoMap, m, lagu.tandaBirama)
    /*
     * N9 — tempo yang BERBUNYI pada birama ini, bukan tempo tangganya.
     *
     * Dulu yang dipakai `tempoPada`, yang hanya tahu tempo per segmen.
     * Kalau lagunya meluncur 172 → 140, tiap set di dalam rentang itu
     * dipetakan seolah temponya 172 — padahal telinga mendengar 161,3
     * lalu 150,7. Drill-nya berjalan lebih cepat daripada musiknya, dan
     * pemain tiba di set berikutnya sebelum lagunya sampai di situ.
     */
    const bpm = jepitTempo(
      tempoBerlaku(
        { dasar: lagu.bpm, segmen: lagu.tempoMap, pakaiTempoMap: true, latih: lagu.latih ?? null },
        m,
      ),
    )
    const counts = Math.max(1, Math.floor(sets[i].counts))
    const ketuk = counts * bpc
    const perBirama = ketukPerBirama(meter)
    const detikPerKetuk = 60 / Math.max(20, Math.min(400, bpm))

    out.push({
      index: i,
      biramaMulai: pos,
      bpm,
      birama: meter,
      detik: ketuk * detikPerKetuk,
      counts,
    })

    pos += perBirama > 0 ? ketuk / perBirama : 0
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
