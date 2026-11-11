/**
 * Diekstrak dari `src/pages/Drill.tsx` (#5 — pecah Drill.tsx).
 * Diperkaya pada #23.1 & #23.2 dengan kendali Titik Singgah (Midset) dan Tags anggota.
 */

/** Inspektur satu titik terpilih di editor. */
import { useState } from 'react'
import type {
  DrillPoint,
  Facing,
  FieldConfig,
  Member,
  TitikSinggahMidset,
} from '../db/types'
import { NamaTampil } from './NamaTampil'
import {
  Badge,
  Button,
  Card,
  Input,
  Select,
} from './ui'
import {
  coordText as coorTextSafe,
  teksMeterAcuan,
  stepYd,
} from '../lib/field'
import { normalisasiMidsetsPemain } from '../lib/gerak'

export function PointInspector({
  member,
  point,
  field,
  onChange,
  onDetail,
  countsSet,
  adaSetBerikut,
  midsets,
  onTambahMidset,
  onUbahCountMidset,
  onHapusMidset,
  onTambahTag,
  onHapusTag,
}: {
  member: Member
  point: DrillPoint
  field: FieldConfig
  onChange: (p: Partial<DrillPoint>) => void
  /** DD6 — buka panel detail pemain ini (riwayat gerak & perlengkapan). */
  onDetail?: () => void
  /** #23.1 — jumlah hitungan set aktif & ketersediaan set tujuan untuk titik singgah. */
  countsSet?: number
  adaSetBerikut?: boolean
  midsets?: TitikSinggahMidset[]
  onTambahMidset?: () => void
  onUbahCountMidset?: (indeks: number, padaCountBaru: number) => void
  onHapusMidset?: (indeks: number) => void
  /** #23.2 — kelola tag lintas-seksi langsung pada anggota terpilih. */
  onTambahTag?: (tag: string) => void
  onHapusTag?: (tag: string) => void
}) {
  const s = stepYd(field)
  const [inputTag, setInputTag] = useState('')
  const batasCount = Math.max(0, Math.floor(countsSet ?? 0))
  const daftarMid = normalisasiMidsetsPemain(midsets, batasCount)

  return (
    <Card>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="truncate text-sm font-semibold text-slate-200"><NamaTampil anggota={member} /></h2>
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
      <div className="mb-3 rounded-lg bg-slate-950/60 px-3 py-2 font-mono text-xs text-emerald-300">
        <span data-live-coord className="block">
          {coorTextSafe(point.x, point.y, field)}
        </span>
        {/* v2.9 — jarak pita meteran dari A & T0 (atau garis 50 & sideline depan) */}
        {teksMeterAcuan(point.x, point.y, field) && (
          <span data-live-meter data-testid="meter-titik" className="mt-0.5 block text-[10px] text-slate-400">
            {teksMeterAcuan(point.x, point.y, field)}
          </span>
        )}
      </div>
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

      {/* #23.1 — Titik Singgah (Midset) per-pemain di tengah perpindahan */}
      {adaSetBerikut && batasCount >= 2 && onTambahMidset && (
        <div
          className="mt-3 border-t border-slate-800 pt-2.5"
          data-testid="inspektur-midset"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-medium text-slate-300">
              Titik singgah (Midset)
            </span>
            <Button
              size="sm"
              variant="soft"
              data-testid="tombol-tambah-midset"
              onClick={onTambahMidset}
              disabled={daftarMid.length >= batasCount - 1}
              className="px-2 py-0.5 text-[11px]"
              title="Sisipkan titik singgah di garis jejak biru pemain ini tanpa memecah set seluruh tim"
            >
              + Singgah
            </Button>
          </div>
          {daftarMid.length === 0 ? (
            <p className="mt-1 text-[10px] leading-snug text-slate-500">
              Seret tanda <b>+</b> di garis biru kanvas atau klik <b>+ Singgah</b> untuk membelokkan jalur pemain ini.
            </p>
          ) : (
            <ul className="mt-1.5 space-y-1" data-testid="daftar-midset-pemain">
              {daftarMid.map((w, idx) => (
                <li
                  key={`mid-${w.padaCount}-${idx}`}
                  data-testid={`baris-midset-${idx}`}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950/60 px-2 py-1 text-[11px]"
                >
                  <span className="text-[10px] text-sky-300">Hit.</span>
                  <Input
                    type="number"
                    min={1}
                    max={batasCount - 1}
                    data-testid={`input-count-midset-${idx}`}
                    value={w.padaCount}
                    onChange={(e) =>
                      onUbahCountMidset?.(
                        idx,
                        Math.max(1, Math.min(batasCount - 1, Math.round(Number(e.target.value) || 1))),
                      )
                    }
                    className="w-14 px-1.5 py-0.5 text-xs"
                  />
                  <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-slate-300">
                    {coorTextSafe(w.x, w.y, field)}
                  </span>
                  <button
                    type="button"
                    data-testid={`hapus-midset-${idx}`}
                    onClick={() => onHapusMidset?.(idx)}
                    className="rounded px-1 text-slate-500 hover:text-rose-400"
                    title="Hapus titik singgah ini"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* #23.2 — Tag lintas-seksi langsung pada anggota terpilih */}
      {onTambahTag && onHapusTag && (
        <div className="mt-3 border-t border-slate-800 pt-2.5" data-testid="inspektur-tag-anggota">
          <span className="block text-[11px] font-medium text-slate-300">Tags lintas-seksi</span>
          {(member.tags?.length ?? 0) > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {member.tags!.map((tg) => (
                <span
                  key={tg}
                  className="inline-flex items-center gap-1 rounded-md border border-emerald-700/40 bg-emerald-950/40 px-1.5 py-0.5 text-[10px] font-medium text-emerald-200"
                >
                  #{tg}
                  <button
                    type="button"
                    data-testid={`hapus-tag-inspektur-${tg}`}
                    onClick={() => onHapusTag(tg)}
                    className="text-emerald-400/70 hover:text-rose-300"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}
          <form
            className="mt-1.5 flex items-center gap-1"
            onSubmit={(e) => {
              e.preventDefault()
              if (!inputTag.trim()) return
              onTambahTag(inputTag)
              setInputTag('')
            }}
          >
            <Input
              data-testid="input-tag-inspektur"
              value={inputTag}
              onChange={(e) => setInputTag(e.target.value)}
              placeholder="Tambah tag (mis. Solois)…"
              className="flex-1 py-1 text-xs"
            />
            <Button size="sm" variant="soft" type="submit" disabled={!inputTag.trim()}>
              +
            </Button>
          </form>
        </div>
      )}
    </Card>
  )
}
