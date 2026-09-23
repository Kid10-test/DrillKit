/**
 * M1 — Pemilih tanda birama.
 *
 * Satu komponen yang dipakai **dua tempat** — metronom mandiri dan editor
 * lagu — supaya keduanya punya pilihan yang sama persis.
 *
 * Yang bisa diatur:
 * - meter jadi (daftar) atau **kustom penuh** (pembilang & penyebut bebas),
 * - **pengelompokan** pulsa (7/8 bisa 2+2+3, 2+3+2, atau 3+2+2),
 * - **acuan tempo**: not yang dihitung sebagai 1 BPM.
 *
 * Komponen ini hanya mengubah tanda birama. Bunyi di dalam birama tetap
 * disimpan di pola ritme E3 — meter **membuat** pola, bukan menyalinnya.
 */

import { useState } from 'react'
import type { TandaBirama } from '../db/types'
import {
  DAFTAR_ACUAN,
  DAFTAR_METER,
  DAFTAR_PENYEBUT,
  MAX_PEMBILANG,
  MIN_PEMBILANG,
  biramaBaku,
  bikinPolaDariBirama,
  cariMeter,
  durasiBirama,
  kelompokBaku,
  labelBirama,
  labelBiramaLengkap,
  normalisasiBirama,
} from '../lib/birama'
import { Button, Field, Input, Select } from './ui'
import { cx } from '../lib/utils'

interface Props {
  nilai: TandaBirama
  onChange: (t: TandaBirama) => void
  /** Tampilkan perkiraan lama birama pada tempo ini (detik). */
  bpm?: number
  /** Sembunyikan pratinjau kotak (dipakai di modal yang sempit). */
  tanpaPratinjau?: boolean
  /**
   * M1 — sembunyikan dropdown daftar meter. Dipakai kalau daftarnya sudah
   * ditampilkan oleh pembungkusnya (mis. di tiap segmen tempo), supaya tidak
   * ada dua dropdown meter bertumpuk.
   */
  sembunyikanDaftar?: boolean
}

export default function PilihBirama({
  nilai,
  onChange,
  bpm,
  tanpaPratinjau = false,
  sembunyikanDaftar = false,
}: Props) {
  const t = normalisasiBirama(nilai)
  const preset = cariMeter(t)
  const [mode, setMode] = useState<'preset' | 'kustom'>(preset ? 'preset' : 'kustom')

  const kel = t.kelompok
  const pola = bikinPolaDariBirama(t, 1, 'pratinjau')
  const detik = bpm ? durasiBirama(t, bpm) : null

  function kePreset(nilaiPilihan: string) {
    if (nilaiPilihan === 'kustom') {
      setMode('kustom')
      return
    }
    const m = DAFTAR_METER[Number(nilaiPilihan)]
    if (!m) return
    setMode('preset')
    onChange(normalisasiBirama({ ...t, pembilang: m.pembilang, penyebut: m.penyebut, kelompok: [...m.kelompok] }))
  }

  function setPembilang(n: number) {
    const p = Math.min(MAX_PEMBILANG, Math.max(MIN_PEMBILANG, Math.floor(n) || 1))
    if (p === t.pembilang) return
    setMode('kustom')
    onChange(normalisasiBirama({ ...t, pembilang: p, kelompok: kelompokBaku(p, t.penyebut) }))
  }

  function setPenyebut(n: number) {
    setMode('kustom')
    onChange(normalisasiBirama({ ...t, penyebut: n, kelompok: kelompokBaku(t.pembilang, n) }))
  }

  function setKelompok(k: number[]) {
    setMode('kustom')
    onChange(normalisasiBirama({ ...t, kelompok: k }))
  }

  function ubahKelompok(i: number, delta: number) {
    const k = [...kel]
    k[i] = Math.max(1, (k[i] ?? 1) + delta)
    setKelompok(k)
  }

  function setAcuan(nilaiAcuan: string) {
    const a = DAFTAR_ACUAN[Number(nilaiAcuan)]
    if (!a) return
    onChange({ ...t, acuan: { nilai: a.nilai, titik: a.titik } })
  }

  const indexAcuan = DAFTAR_ACUAN.findIndex((a) => a.nilai === t.acuan.nilai && a.titik === t.acuan.titik)

  return (
    <div className="space-y-3" data-testid="pilih-birama">
      <div className="grid gap-3 sm:grid-cols-2">
        {!sembunyikanDaftar && (
          <Field label="Tanda birama">
            <Select
              value={mode === 'preset' && preset ? String(DAFTAR_METER.indexOf(preset)) : 'kustom'}
              onChange={(e) => kePreset(e.target.value)}
              data-testid="meter-pilihan"
            >
              {DAFTAR_METER.map((m, i) => (
                <option key={i} value={i}>
                  {m.label}
                </option>
              ))}
              <option value="kustom">Kustom…</option>
            </Select>
          </Field>
        )}
        <Field label={`Acuan tempo (1 BPM =)`}>
          <Select value={String(indexAcuan)} onChange={(e) => setAcuan(e.target.value)} data-testid="meter-acuan">
            {DAFTAR_ACUAN.map((a, i) => (
              <option key={i} value={i}>
                {a.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {(mode === 'kustom' || sembunyikanDaftar) && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Pembilang (jumlah not per birama)">
            <Input
              type="number"
              min={MIN_PEMBILANG}
              max={MAX_PEMBILANG}
              value={t.pembilang}
              onChange={(e) => setPembilang(Number(e.target.value))}
              data-testid="meter-pembilang"
            />
          </Field>
          <Field label="Penyebut (nilai not)">
            <Select value={t.penyebut} onChange={(e) => setPenyebut(Number(e.target.value))} data-testid="meter-penyebut">
              {DAFTAR_PENYEBUT.map((p) => (
                <option key={p} value={p}>
                  1/{p}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      )}

      {/* Pengelompokan — inti dari meter ganjil */}
      <div data-testid="meter-kelompok">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            Pengelompokan pulsa{' '}
            <span className="font-semibold text-slate-300" data-testid="meter-label-kelompok">
              {kel.join('+')}
            </span>
          </span>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" onClick={() => setKelompok([...kel, 1])} title="Tambah kelompok">
              + kelompok
            </Button>
            {kel.length > 1 && (
              <Button size="sm" variant="ghost" onClick={() => setKelompok(kel.slice(0, -1))} title="Hapus kelompok terakhir">
                − kelompok
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setKelompok(kelompokBaku(t.pembilang, t.penyebut))}
              title="Kembalikan ke pengelompokan baku"
            >
              Reset
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {kel.map((g, i) => (
            <div
              key={i}
              className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900/60 px-1.5 py-1"
              data-testid={`kelompok-${i}`}
            >
              <button
                type="button"
                className="h-5 w-5 rounded text-xs text-slate-400 hover:bg-slate-700 hover:text-slate-100"
                onClick={() => ubahKelompok(i, -1)}
                title={`Kurangi kelompok ke-${i + 1}`}
              >
                −
              </button>
              <span className="min-w-5 text-center text-sm font-semibold tabular-nums text-slate-100">{g}</span>
              <button
                type="button"
                className="h-5 w-5 rounded text-xs text-slate-400 hover:bg-slate-700 hover:text-slate-100"
                onClick={() => ubahKelompok(i, 1)}
                title={`Tambah kelompok ke-${i + 1}`}
              >
                +
              </button>
            </div>
          ))}
        </div>
      </div>

      {!tanpaPratinjau && (
        <div data-testid="meter-preview">
          <p className="mb-1.5 text-xs text-slate-400">
            Aksen & bunyi per birama —{' '}
            <span className="text-slate-300">
              {pola.cells.filter((c) => c === 2).length} aksen dari {pola.cells.length} not
            </span>
          </p>
          <div className="flex flex-wrap gap-1">
            {pola.cells.map((c, i) => (
              <div
                key={i}
                data-testid={`meter-kotak-${i}`}
                data-tingkat={c}
                className={cx(
                  'flex h-6 w-6 items-center justify-center rounded border text-[10px] font-semibold',
                  c === 2
                    ? 'border-emerald-400 bg-emerald-500/30 text-emerald-200'
                    : c === 1
                      ? 'border-slate-600 bg-slate-800 text-slate-400'
                      : 'border-slate-800 bg-slate-900 text-slate-600',
                )}
                title={`Not ke-${i + 1}${c === 2 ? ' (aksen)' : ''}`}
              >
                {c === 2 ? 'A' : i + 1}
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-[11px] text-slate-500" data-testid="meter-ringkasan">
        {labelBiramaLengkap(t)}
        {detik ? ` · satu birama ≈ ${detik.toFixed(2)} detik pada ${bpm} BPM` : ''}
      </p>
    </div>
  )
}

/** Ringkasan satu baris, dipakai di daftar lagu. */
export function RingkasBirama({ nilai }: { nilai?: TandaBirama }) {
  if (!nilai) return null
  const t = normalisasiBirama(nilai)
  return (
    <span data-testid="ringkas-birama" title={labelBiramaLengkap(t)}>
      {labelBirama(t)} · {t.kelompok.join('+')}
    </span>
  )
}

/**
 * M1 — Pemilih tanda birama untuk **satu segmen tempo**.
 *
 * Beda dengan `PilihBirama`: di sini ada pilihan **"Ikuti lagu"**, yang
 * berarti segmen mewarisi tanda birama lagu. Itu penting supaya lagu 4/4
 * yang tidak pernah berganti meter tetap sederhana — cukup satu meter di
 * tingkat lagu, tidak perlu mengisi segmen satu per satu.
 *
 * Segmen yang diberi meter sendiri akan mengubah tanda birama mulai birama
 * segmen itu, jadi lagu bisa 4/4 → 7/8 → 4/4.
 */
export function PilihBiramaSegmen({
  nilai,
  onChange,
  warisan,
  testId,
}: {
  /** `undefined` = ikuti lagu. */
  nilai?: TandaBirama
  onChange: (t: TandaBirama | undefined) => void
  /** Tanda birama lagu — ditampilkan sebagai penjelas pilihan "Ikuti lagu". */
  warisan: TandaBirama
  testId?: string
}) {
  const [bukaKustom, setBukaKustom] = useState(false)
  const w = normalisasiBirama(warisan)
  const preset = nilai ? cariMeter(nilai) : undefined
  const modeKustom = !!nilai && (!preset || bukaKustom)

  function atur(v: string) {
    if (v === 'waris') {
      setBukaKustom(false)
      onChange(undefined)
      return
    }
    if (v === 'kustom') {
      setBukaKustom(true)
      onChange(nilai ?? biramaBaku(w.pembilang, w.penyebut, w.acuan))
      return
    }
    const m = DAFTAR_METER[Number(v)]
    if (!m) return
    setBukaKustom(false)
    onChange(normalisasiBirama({ ...w, pembilang: m.pembilang, penyebut: m.penyebut, kelompok: [...m.kelompok] }))
  }

  return (
    <div data-testid={testId}>
      <Select
        value={nilai === undefined ? 'waris' : modeKustom ? 'kustom' : String(DAFTAR_METER.indexOf(preset!))}
        onChange={(e) => atur(e.target.value)}
      >
        <option value="waris">Ikuti lagu ({labelBirama(w)})</option>
        {DAFTAR_METER.map((m, i) => (
          <option key={i} value={i}>
            {m.label}
          </option>
        ))}
        <option value="kustom">Kustom…</option>
      </Select>
      {modeKustom && nilai && (
        <div className="mt-2 rounded-lg border border-slate-800 bg-slate-950/60 p-2">
          <PilihBirama nilai={nilai} onChange={onChange} sembunyikanDaftar tanpaPratinjau />
        </div>
      )}
    </div>
  )
}
