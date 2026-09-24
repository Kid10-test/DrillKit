/**
 * Diekstrak dari `src/pages/Drill.tsx` (#5 — pecah Drill.tsx).
 * Isinya tidak diubah; hanya alamat impor yang disesuaikan.
 */

/** Inspektur satu titik terpilih di editor. */
import type {
  DrillPoint,
  Facing,
  FieldConfig,
  Member,
} from '../db/types'
import {
  Badge,
  Button,
  Card,
  Input,
  Select,
} from './ui'

import {
  coordText as coorTextSafe,
  stepYd,
} from '../lib/field'

/* ========================================================================== */
/*  Komponen pendukung                                                         */
/* ========================================================================== */

export function PointInspector({
  member,
  point,
  field,
  onChange,
  onDetail,
}: {
  member: Member
  point: DrillPoint
  field: FieldConfig
  onChange: (p: Partial<DrillPoint>) => void
  /** DD6 — buka panel detail pemain ini (riwayat gerak & perlengkapan). */
  onDetail?: () => void
}) {
  const s = stepYd(field)
  return (
    <Card>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="truncate text-sm font-semibold text-slate-200">{member.name}</h2>
        <div className="flex shrink-0 items-center gap-1.5">
          {onDetail && (
            <Button size="sm" onClick={onDetail} title="Riwayat gerak & perlengkapan pemain ini">
              Detail
            </Button>
          )}
          <Badge>{member.code}</Badge>
        </div>
      </div>
      {/* data-live-* dipakai untuk memperbarui angka saat menggeser titik,
          tanpa harus me-render ulang seluruh peta. */}
      <p
        data-live-coord
        className="mb-3 rounded-lg bg-slate-950/60 px-3 py-2 font-mono text-xs text-emerald-300"
      >
        {coorTextSafe(point.x, point.y, field)}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-[11px] text-slate-500">X (langkah dari 50)</label>
          <Input
            type="number"
            step="0.25"
            data-live-x
            value={Math.round((point.x / s) * 4) / 4}
            onChange={(e) => onChange({ x: Number(e.target.value) * s })}
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-slate-500">Y (langkah dari depan)</label>
          <Input
            type="number"
            step="0.25"
            data-live-y
            value={Math.round(((point.y + field.widthYd / 2) / s) * 4) / 4}
            onChange={(e) => onChange({ y: Number(e.target.value) * s - field.widthYd / 2 })}
          />
        </div>
        <div className="col-span-2">
          <label className="mb-1 block text-[11px] text-slate-500">Arah hadap</label>
          <Select value={point.facing} onChange={(e) => onChange({ facing: e.target.value as Facing })}>
            <option value="front">Depan (penonton)</option>
            <option value="back">Belakang</option>
            <option value="left">Kiri (S1)</option>
            <option value="right">Kanan (S2)</option>
          </Select>
        </div>
      </div>
    </Card>
  )
}
