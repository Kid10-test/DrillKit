/**
 * Canonical tempo-map evaluator.
 *
 * Musical positions are expressed as measure + 1-based beat/subdivision and
 * converted to quarter-note coordinates. Tempo changes, ramp samples, audio
 * time conversion, metronome scheduling, and drill timing all use this one
 * evaluator so they cannot independently infer ramp length from meter.
 */
import type { LatihTempo, TandaBirama } from '../db/types'
import type { TempoLatihan } from './tempoLatihan'
import { normalisasiBirama } from './birama'
import { tempoLatih, tempoRampBpm } from './tempoRamp'
import { terapkanLatihan } from './tempoLatihan'

export type TempoRampUnit = 'beat' | 'tempoBeat' | 'subdivision' | 'tempoSubdivision' | 'bar'

/** Input fields shared by persisted tempo-map rows and the timing modules. */
export interface TempoTimelineSegment {
  measure: number
  bpm: number
  birama?: TandaBirama
  berangsur?: 0 | 1
  /** 1-based written beat within the measure; default 1. */
  beat?: number
  /** 1-based subdivision within `beat`; default 1. */
  subdivision?: number
  /** Subdivision grid used to interpret `subdivision`; default 1. */
  subdivisionsPerBeat?: number
  /** Inclusive, explicit ramp length; count one changes, count N reaches target. */
  rampCounts?: number
  rampUnit?: TempoRampUnit
  rampSubdivisions?: number
  rampFromBpm?: number
}

export interface TempoPosition {
  measure: number
  beat?: number
  subdivision?: number
  subdivisionsPerBeat?: number
}

export interface TempoPositionResult extends Required<TempoPosition> {
  /** Absolute measure position, e.g. 3.5 is halfway through measure 3. */
  measurePosition: number
  /** Fraction through the current measure, 0..1. */
  fraction: number
}

export interface TempoTimelineOptions {
  bpm: number
  meter: TandaBirama
  segments?: readonly TempoTimelineSegment[]
  /** Legacy whole-song ramp. Suppressed by a map ramp, matching prior priority. */
  latih?: LatihTempo | null
}

interface TempoPoint {
  quarter: number
  bpm: number
  /** Quarter-note length of the BPM note unit active at this position. */
  bpmUnitQuarter: number
  order: number
}

interface ClockCache {
  practice: TempoLatihan | null
  secondsAtPoint: number[]
}

const MAX_MEASURE = 20_000
const MAX_RAMP_COUNTS = 10_000
const EPSILON = 1e-9
const amanBpm = (bpm: number) => (Number.isFinite(bpm) ? Math.min(400, Math.max(20, bpm)) : 120)
const whole = (n: number, fallback: number, max = 64) =>
  Math.min(max, Math.max(1, Math.floor(Number.isFinite(n) ? n : fallback)))

/** Quarter-note duration of one BPM unit. */
export function tempoUnitQuarter(meterInput: TandaBirama): number {
  const meter = normalisasiBirama(meterInput)
  const note = meter.acuan?.nilai ?? 4
  const dotted = meter.acuan?.titik ? 1.5 : 1
  return (4 / note) * dotted
}

/** Quarter-note duration of a notated denominator-note beat. */
export function writtenBeatQuarter(meterInput: TandaBirama): number {
  return 4 / normalisasiBirama(meterInput).penyebut
}

/** A single, immutable evaluator shared by playback and timing consumers. */
export class TempoTimeline {
  private readonly baseBpm: number
  private readonly baseMeter: TandaBirama
  private readonly segments: TempoTimelineSegment[]
  private readonly meterRows: TempoTimelineSegment[]
  private readonly points: TempoPoint[]
  private readonly barStarts = new Map<number, number>([[1, 0]])
  private readonly clocks = new Map<string, ClockCache>()

  constructor(options: TempoTimelineOptions) {
    this.baseBpm = amanBpm(options.bpm)
    this.baseMeter = normalisasiBirama(options.meter)
    this.segments = [...(options.segments ?? [])]
      .map((segment, index) => ({ ...segment, measure: whole(segment.measure, 1, MAX_MEASURE), __order: index }))
      .sort((a, b) => a.measure - b.measure || (a.__order as number) - (b.__order as number))
    this.meterRows = this.segments.filter((segment) => !!segment.birama)
    this.points = this.buildPoints(options.latih ?? null)
  }

  /** Meter in force at the start of a measure. */
  meterAtMeasure(measure: number): TandaBirama {
    const m = whole(measure, 1, MAX_MEASURE)
    let meter = this.baseMeter
    for (const row of this.meterRows) {
      if (row.measure > m) break
      meter = normalisasiBirama(row.birama!)
    }
    return meter
  }

  /** Absolute quarter-note position at the start of a measure. */
  quarterAtMeasure(measure: number): number {
    const target = whole(measure, 1, MAX_MEASURE)
    if (this.barStarts.has(target)) return this.barStarts.get(target)!
    let latest = 1
    for (const known of this.barStarts.keys()) if (known <= target && known > latest) latest = known
    let quarter = this.barStarts.get(latest) ?? 0
    for (let m = latest; m < target; m += 1) {
      const meter = this.meterAtMeasure(m)
      quarter += (meter.pembilang * 4) / meter.penyebut
      this.barStarts.set(m + 1, quarter)
    }
    return quarter
  }

  /** Quarter-note length of a measure. */
  measureLengthQuarter(measure: number): number {
    const meter = this.meterAtMeasure(measure)
    return (meter.pembilang * 4) / meter.penyebut
  }

  /** Quarter-note coordinate for a 1-based beat/subdivision position. */
  quarterAtPosition(position: TempoPosition): number {
    const measure = whole(position.measure, 1, MAX_MEASURE)
    const meter = this.meterAtMeasure(measure)
    const beat = Math.max(1, Number.isFinite(position.beat) ? position.beat! : 1)
    const subdivision = Math.max(1, Number.isFinite(position.subdivision) ? position.subdivision! : 1)
    const subdivisions = whole(position.subdivisionsPerBeat ?? 1, 1, 64)
    const beatLength = writtenBeatQuarter(meter)
    return this.quarterAtMeasure(measure) + (beat - 1) * beatLength + ((subdivision - 1) * beatLength) / subdivisions
  }

  /** Measure (and written beat) containing an absolute quarter-note position. */
  positionAtQuarter(inputQuarter: number): TempoPositionResult {
    const quarter = Math.max(0, Number.isFinite(inputQuarter) ? inputQuarter : 0)
    let highest = 1
    for (const known of this.barStarts.keys()) if (known > highest) highest = known
    let measure = 1
    if (quarter >= this.quarterAtMeasure(highest)) {
      measure = highest
      while (measure < MAX_MEASURE && this.quarterAtMeasure(measure + 1) <= quarter + EPSILON) measure += 1
    } else {
      let low = 1
      let high = highest
      while (low < high) {
        const mid = Math.ceil((low + high) / 2)
        if (this.quarterAtMeasure(mid) <= quarter + EPSILON) low = mid
        else high = mid - 1
      }
      measure = low
    }
    const start = this.quarterAtMeasure(measure)
    const meter = this.meterAtMeasure(measure)
    const length = this.measureLengthQuarter(measure)
    const inMeasure = Math.min(length, Math.max(0, quarter - start))
    const beatLength = writtenBeatQuarter(meter)
    const beat = Math.min(meter.pembilang, Math.floor((inMeasure + EPSILON) / beatLength) + 1)
    const fraction = length > 0 ? Math.min(1, Math.max(0, inMeasure / length)) : 0
    return {
      measure,
      beat,
      subdivision: 1,
      subdivisionsPerBeat: 1,
      fraction,
      measurePosition: measure + fraction,
    }
  }

  measureAtQuarter(quarter: number): number {
    return this.positionAtQuarter(quarter).measure
  }

  meterAtQuarter(quarter: number): TandaBirama {
    return this.meterAtMeasure(this.measureAtQuarter(quarter))
  }

  /** Tempo at an absolute quarter-note position; practice is an optional overlay. */
  tempoAtQuarter(quarter: number, practice?: TempoLatihan | null): number {
    const point = this.pointAtQuarter(quarter)
    return practice ? terapkanLatihan(point.bpm, practice) : point.bpm
  }

  tempoAtPosition(position: TempoPosition, practice?: TempoLatihan | null): number {
    return this.tempoAtQuarter(this.quarterAtPosition(position), practice)
  }

  /** Song time at an absolute quarter-note position. */
  secondsAtQuarter(quarter: number, practice?: TempoLatihan | null): number {
    const target = Math.max(0, Number.isFinite(quarter) ? quarter : 0)
    const clock = this.clockFor(practice ?? null)
    const index = this.pointIndexAtQuarter(target)
    const point = this.points[index]
    const tempo = practice ? terapkanLatihan(point.bpm, practice) : point.bpm
    const secondsPerQuarter = 60 / (tempo * point.bpmUnitQuarter)
    return clock.secondsAtPoint[index] + (target - point.quarter) * secondsPerQuarter
  }

  secondsAtPosition(position: TempoPosition, practice?: TempoLatihan | null): number {
    return this.secondsAtQuarter(this.quarterAtPosition(position), practice)
  }

  secondsBetween(startQuarter: number, endQuarter: number, practice?: TempoLatihan | null): number {
    return Math.max(0, this.secondsAtQuarter(endQuarter, practice) - this.secondsAtQuarter(startQuarter, practice))
  }

  barStartSeconds(measure: number, practice?: TempoLatihan | null): number {
    return this.secondsAtQuarter(this.quarterAtMeasure(measure), practice)
  }

  barDurationSeconds(measure: number, practice?: TempoLatihan | null): number {
    const start = this.quarterAtMeasure(measure)
    return this.secondsBetween(start, start + this.measureLengthQuarter(measure), practice)
  }

  /** Invert song seconds back to musical position, using the same tempo points. */
  quarterAtSeconds(inputSeconds: number, practice?: TempoLatihan | null): number {
    const seconds = Math.max(0, Number.isFinite(inputSeconds) ? inputSeconds : 0)
    const clock = this.clockFor(practice ?? null)
    let low = 0
    let high = this.points.length - 1
    while (low < high) {
      const mid = Math.ceil((low + high) / 2)
      if (clock.secondsAtPoint[mid] <= seconds + EPSILON) low = mid
      else high = mid - 1
    }
    const point = this.points[low]
    const tempo = practice ? terapkanLatihan(point.bpm, practice) : point.bpm
    const secondsPerQuarter = 60 / (tempo * point.bpmUnitQuarter)
    return point.quarter + Math.max(0, seconds - clock.secondsAtPoint[low]) / secondsPerQuarter
  }

  positionAtSeconds(seconds: number, practice?: TempoLatihan | null): TempoPositionResult {
    return this.positionAtQuarter(this.quarterAtSeconds(seconds, practice))
  }

  /** Advance by BPM-note pulses (the unit drill counts use). */
  advanceTempoBeats(startQuarter: number, count: number): number {
    return this.advanceBy(startQuarter, count, 'tempoBeat', 1)
  }

  /** Advance by written beats, useful for score-grid editing and tests. */
  advanceWrittenBeats(startQuarter: number, count: number): number {
    return this.advanceBy(startQuarter, count, 'beat', 1)
  }

  private advanceBy(startQuarter: number, count: number, unit: TempoRampUnit, subdivisions: number): number {
    let quarter = Math.max(0, Number.isFinite(startQuarter) ? startQuarter : 0)
    let remaining = Math.max(0, Number.isFinite(count) ? count : 0)
    let guard = 0
    while (remaining > EPSILON && guard < 100_000) {
      const meter = this.meterAtQuarter(quarter + EPSILON)
      const step = this.rampStepQuarter(unit, subdivisions, meter)
      const wholeSteps = Math.min(remaining, 1)
      quarter += step * wholeSteps
      remaining -= wholeSteps
      guard += 1
    }
    return quarter
  }

  private rampStepQuarter(unit: TempoRampUnit, subdivisions: number, meter: TandaBirama): number {
    if (unit === 'bar') return (meter.pembilang * 4) / meter.penyebut
    if (unit === 'tempoBeat') return tempoUnitQuarter(meter)
    if (unit === 'tempoSubdivision') return tempoUnitQuarter(meter) / whole(subdivisions, 3, 64)
    const written = writtenBeatQuarter(meter)
    if (unit === 'subdivision') return written / whole(subdivisions, 3, 64)
    return written
  }

  private nextRampQuarter(
    quarter: number,
    measure: number,
    unit: TempoRampUnit,
    subdivisions: number,
  ): number {
    if (unit === 'bar') {
      const currentMeasure = this.measureAtQuarter(quarter)
      return this.quarterAtMeasure(Math.max(measure + 1, currentMeasure + 1))
    }
    const meter = this.meterAtQuarter(quarter + EPSILON)
    return quarter + this.rampStepQuarter(unit, subdivisions, meter)
  }

  private buildPoints(latih: LatihTempo | null): TempoPoint[] {
    const base: TempoPoint = {
      quarter: 0,
      bpm: this.baseBpm,
      bpmUnitQuarter: tempoUnitQuarter(this.baseMeter),
      order: -1,
    }
    const events = this.segments
      .map((segment, index) => ({ segment, index, quarter: this.quarterAtPosition(segment) }))
      .sort((a, b) => a.quarter - b.quarter || a.index - b.index)
    const points: TempoPoint[] = [base]
    let order = 0
    const hasMapRamp = this.segments.some((segment) => segment.berangsur === 1 || (segment.rampCounts ?? 0) > 0)

    const append = (quarter: number, bpm: number) => {
      const meter = this.meterAtQuarter(quarter + EPSILON)
      points.push({ quarter, bpm: amanBpm(bpm), bpmUnitQuarter: tempoUnitQuarter(meter), order: order++ })
    }

    for (let i = 0; i < events.length; i += 1) {
      const current = events[i]
      const next = events[i + 1]
      const segment = current.segment

      // Keep legacy bar-to-bar ramps byte-for-byte compatible in their tempo
      // values, while new rows use their explicit `rampCounts` instead.
      if (segment.berangsur === 1 && (segment.rampCounts ?? 0) <= 0 && next && next.segment.measure > segment.measure) {
        const totalBars = next.segment.measure - segment.measure
        for (let measure = segment.measure; measure <= next.segment.measure; measure += 1) {
          const quarter = this.quarterAtMeasure(measure)
          if (quarter < current.quarter - EPSILON) continue
          if (quarter > next.quarter + EPSILON) break
          const bpm = tempoRampBpm(segment.bpm, next.segment.bpm, totalBars, measure - segment.measure)
          append(quarter, bpm)
        }
        continue
      }

      const counts = Math.min(MAX_RAMP_COUNTS, Math.floor(segment.rampCounts ?? 0))
      if (counts > 0) {
        const from = Number.isFinite(segment.rampFromBpm)
          ? segment.rampFromBpm!
          : this.pointAtQuarterFrom(points, current.quarter).bpm
        const unit = segment.rampUnit ?? 'beat'
        const subdivisions = whole(segment.rampSubdivisions ?? 3, 3, 64)
        let quarter = current.quarter
        for (let count = 1; count <= counts; count += 1) {
          if (next && quarter >= next.quarter - EPSILON) break
          append(quarter, tempoRampBpm(from, segment.bpm, counts, count))
          quarter = this.nextRampQuarter(quarter, segment.measure, unit, subdivisions)
        }
        continue
      }

      append(current.quarter, segment.bpm)
    }

    let resolved = this.collapsePoints(points)
    if (latih?.on && !hasMapRamp) {
      const mapPoints = resolved
      const mapAt = (quarter: number) => this.pointAtQuarterFrom(mapPoints, quarter)
      const overlay = [...mapPoints].map((point) => ({
        ...point,
        bpm: tempoLatih(point.bpm, latih, this.measureAtQuarter(point.quarter)),
        order: order++,
      }))
      // Whole-song legacy practice can change at a bar even with no tempo-map
      // row there. Add those boundaries so time integration sees them too.
      for (let measure = 1; measure <= MAX_MEASURE; measure += 1) {
        const quarter = this.quarterAtMeasure(measure)
        const basePoint = mapAt(quarter)
        overlay.push({
          quarter,
          bpm: tempoLatih(basePoint.bpm, latih, measure),
          bpmUnitQuarter: tempoUnitQuarter(this.meterAtMeasure(measure)),
          order: order++,
        })
      }
      resolved = this.collapsePoints(overlay)
    }

    // A tempo/meter row at measure 1 beat 1 may replace the base point at 0.
    // There is always at least one point at zero after collapsing.
    if (!resolved.length || resolved[0].quarter > EPSILON) resolved.unshift(base)
    return resolved
  }

  private collapsePoints(input: TempoPoint[]): TempoPoint[] {
    const sorted = [...input].sort((a, b) => a.quarter - b.quarter || a.order - b.order)
    const out: TempoPoint[] = []
    for (const point of sorted) {
      const previous = out[out.length - 1]
      if (previous && Math.abs(previous.quarter - point.quarter) <= EPSILON) out[out.length - 1] = point
      else out.push(point)
    }
    return out
  }

  private pointIndexAtQuarter(quarter: number): number {
    let low = 0
    let high = this.points.length - 1
    const target = Number.isFinite(quarter) ? quarter : 0
    while (low < high) {
      const mid = Math.ceil((low + high) / 2)
      if (this.points[mid].quarter <= target + EPSILON) low = mid
      else high = mid - 1
    }
    return low
  }

  private pointAtQuarter(quarter: number): TempoPoint {
    return this.points[this.pointIndexAtQuarter(quarter)]
  }

  private pointAtQuarterFrom(points: TempoPoint[], quarter: number): TempoPoint {
    let found = points[0] ?? {
      quarter: 0,
      bpm: this.baseBpm,
      bpmUnitQuarter: tempoUnitQuarter(this.baseMeter),
      order: -1,
    }
    for (const point of points) {
      if (point.quarter > quarter + EPSILON) break
      found = point
    }
    return found
  }

  private clockFor(practice: TempoLatihan | null): ClockCache {
    const key = !practice ? 'original' : `${practice.mode}:${practice.persen}:${practice.geser}`
    const existing = this.clocks.get(key)
    if (existing) return existing
    const secondsAtPoint = new Array<number>(this.points.length).fill(0)
    for (let i = 1; i < this.points.length; i += 1) {
      const previous = this.points[i - 1]
      const bpm = practice ? terapkanLatihan(previous.bpm, practice) : previous.bpm
      secondsAtPoint[i] = secondsAtPoint[i - 1] +
        (this.points[i].quarter - previous.quarter) * 60 / (bpm * previous.bpmUnitQuarter)
    }
    const clock = { practice, secondsAtPoint }
    this.clocks.set(key, clock)
    return clock
  }
}

export function createTempoTimeline(options: TempoTimelineOptions): TempoTimeline {
  return new TempoTimeline(options)
}
