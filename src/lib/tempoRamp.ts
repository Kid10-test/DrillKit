/**
 * Pure tempo-ramp helpers shared by the tempo-map evaluator and legacy
 * metronome controls.  Keeping the arithmetic here avoids slightly different
 * ramp formulas in playback, MP3 alignment, and drill timing.
 */
import type { LatihTempo } from '../db/types'

/**
 * BPM at count `count` in a ramp of `countTotal` counts.
 *
 * Count zero is the tempo immediately before the ramp.  Count one has already
 * moved by 1/N of the distance, and count N reaches the target exactly.  This
 * is the inclusive Sibelius-style count convention used by tempo-map ramps.
 */
export function tempoRampBpm(from: number, to: number, countTotal: number, count: number): number {
  const start = Number.isFinite(from) ? from : 120
  const target = Number.isFinite(to) ? to : start
  const total = Math.max(1, Math.floor(Number.isFinite(countTotal) ? countTotal : 1))
  const step = Number.isFinite(count) ? Math.min(total, Math.max(0, count)) : 0
  return start + ((target - start) * step) / total
}

/** Legacy whole-song tempo practice, stepped every `tiap` measures. */
export function tempoLatih(bpm: number, latihan: LatihTempo | null, measure: number): number {
  if (!latihan || !latihan.on) return bpm
  const cycles = Math.floor((measure - 1) / Math.max(1, latihan.tiap))
  const target = latihan.langkah === 0 ? bpm : bpm + cycles * latihan.langkah
  return latihan.langkah > 0
    ? Math.min(target, Math.max(latihan.ke, latihan.dari))
    : Math.max(target, Math.min(latihan.ke, latihan.dari))
}
