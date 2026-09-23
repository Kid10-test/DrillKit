/**
 * M2 — ulang bagian: mengulang satu rentang birama (mis. 32–48) alih-alih
 * seluruh lagu.
 *
 * Sengaja **murni** (tidak menyentuh DOM, React, atau database) supaya bisa
 * diuji langsung dari node.
 */
import type { UlangBagian } from '../db/types'
import { detikSampai } from './birama'
import type { SegmenWaktu, TandaBirama } from './birama'

/**
 * Apakah rentang ini bisa dipakai.
 *
 * Syaratnya: angkanya masuk akal, `dari` tidak lebih besar dari `sampai`,
 * dan (kalau lagu punya panjang) rentangnya tidak melebihi akhir lagu.
 * Rentang satu birama (`dari === sampai`) sah — itu sekadar mengulang satu
 * birama terus-menerus, yang justru berguna untuk latihan.
 */
export function rentangValid(
  ub: UlangBagian | null | undefined,
  panjangBirama?: number,
): boolean {
  if (!ub) return false
  const dari = Math.floor(ub.dari)
  const sampai = Math.floor(ub.sampai)
  if (!Number.isFinite(dari) || !Number.isFinite(sampai)) return false
  if (dari < 1 || sampai < 1) return false
  if (dari > sampai) return false
  const n = Math.floor(panjangBirama ?? 0)
  if (n > 0 && sampai > n) return false
  return true
}

/**
 * Rapikan rentang: dibulatkan ke bawah dan dijepit agar tidak melebihi
 * panjang lagu. Nilai yang tidak masuk akal dijatuhkan ke batas terdekat.
 */
export function normalisasiUlangBagian(
  ub: UlangBagian | null | undefined,
  panjangBirama?: number,
): UlangBagian | null {
  if (!ub) return null
  const n = Math.floor(panjangBirama ?? 0)
  const batasAtas = n > 0 ? n : 1_000_000
  let dari = Math.floor(ub.dari)
  let sampai = Math.floor(ub.sampai)
  if (!Number.isFinite(dari) || dari < 1) dari = 1
  if (!Number.isFinite(sampai) || sampai < 1) sampai = dari
  if (dari > batasAtas) dari = batasAtas
  if (sampai > batasAtas) sampai = batasAtas
  if (dari > sampai) sampai = dari
  return { dari, sampai, aktif: ub.aktif }
}

/**
 * Durasi **satu putaran** rentang, dalam detik.
 *
 * `detikSampai` menghitung waktu menjelang suatu birama, jadi durasi birama
 * `sampai` baru ikut pada `sampai + 1`.
 */
export function detikSatuPutaran(
  segmen: SegmenWaktu[],
  dari: number,
  sampai: number,
  warisan: TandaBirama,
  tempoDasar: number,
  /** N7 — tempo per birama; lihat keterangan `detikSampai`. Opsional: tanpa ini perilaku lama. */
  tempoUntuk?: (birama: number) => number,
): number {
  const a = Math.max(1, Math.floor(dari))
  const b = Math.max(a, Math.floor(sampai))
  return Math.max(
    0,
    detikSampai(segmen, b + 1, warisan, tempoDasar, tempoUntuk) -
      detikSampai(segmen, a, warisan, tempoDasar, tempoUntuk),
  )
}

/** Berapa birama dalam rentang ini (inklusif). */
export function jumlahBirama(ub: UlangBagian | null | undefined): number {
  if (!ub) return 0
  return Math.max(0, Math.floor(ub.sampai) - Math.floor(ub.dari) + 1)
}
