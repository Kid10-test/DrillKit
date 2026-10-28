/**
 * Editor konfigurasi lapangan (satuan yard/meter/langkah, grid & subgrid kustom,
 * warna/ketebalan garis hex, pratinjau langsung, serta sistem patok Indonesia).
 *
 * Dipakai bersama oleh Pengaturan tim (`src/pages/Settings.tsx`) dan modal
 * Pengaturan drill (`src/components/DrillSettingsModal.tsx`).
 */

import type {
  FieldConfig,
  HashPreset,
  PatokConfig,
  SatuanJarakPatok,
  SatuanTampilLapangan,
  StepPreset,
} from '../db/types'
import { FieldSurface } from './FieldSurface'
import {
  Field,
  Input,
  Select,
  Toggle,
} from './ui'
import {
  HASH_LABEL,
  STEP_LABEL,
  TEBAL_GARIS_GRID,
  WARNA_GARIS_GRID,
  WARNA_LAPANGAN,
  YD_TO_M,
  coordText,
  daftarPatok,
  dariSatuanTampil,
  fieldBox,
  garisGridUtama,
  garisSubgrid,
  hurufPatok,
  keSatuanTampil,
  namaSatuanLapangan,
  patokOf,
  satuanLapanganOf,
  singkatanSatuanLapangan,
  stepYd,
  tebalGarisGrid,
  ukurTitik,
  warnaGarisGrid,
  warnaLapangan,
} from '../lib/field'

/* --------------------------- Editor konfigurasi ----------------------------- */

export function FieldConfigEditor({
  value,
  onChange,
}: {
  value: FieldConfig
  onChange: (f: FieldConfig) => void
}) {
  const f = value
  const patch = (p: Partial<FieldConfig>) => onChange({ ...f, ...p })

  /**
   * N16 — angka dari kolom isian, tidak pernah menghasilkan NaN.
   *
   * Kolom `type="number"` yang dikosongkan memberi `''`, dan
   * `Number('')` adalah `0` — bukan NaN, jadi tidak ketahuan. Bila `0`
   * itu sampai ke ukuran langkah, seluruh koordinat menjadi NaN; bila
   * sampai ke lebar lapangan, lapangannya lenyap.
   *
   * Batas minimum diterapkan pada satuan yang DITAMPILKAN (`yard`, `meter`,
   * atau `langkah`), baru nilainya dikonversi kembali ke yard internal.
   */
  const angkaAman = (teks: string, bawaan: number, min = 0): number => {
    if (teks.trim() === '') return bawaan
    const n = Number(teks)
    if (!Number.isFinite(n)) return bawaan
    return Math.max(min, n)
  }

  /** Satuan tampilan ukuran & grid (`yd` / `m` / `langkah`). Nilai internal tetap yard. */
  const satuan: SatuanTampilLapangan = satuanLapanganOf(f)
  const nSatuan = namaSatuanLapangan(satuan)
  const singkatan = singkatanSatuanLapangan(satuan)
  const bulat = (v: number) => Math.round(v * 100) / 100
  const keTampil = (nilaiYd: number) => bulat(keSatuanTampil(nilaiYd, f, satuan))
  const dariTampil = (nilaiTampil: number) => dariSatuanTampil(nilaiTampil, f, satuan)

  /**
   * Ganti satuan tampilan (`yd` / `m` / `langkah`).
   * **Nilai yang tersimpan tetap yard** — geometri, garis grid, dan patok
   * tidak pernah bergeser atau memaksa snap saat berpindah satuan.
   */
  function gantiSatuan(s: SatuanTampilLapangan) {
    if (s === satuan) return
    patch({ satuan: s })
  }

  // DD1 & #9 — sistem patok cara Indonesia + opsi Tanpa patok.
  const p = patokOf(f)
  const gantiPatok = (q: Partial<PatokConfig>) => patch({ patok: { ...p, ...q } })
  /** Hitung jumlah patok walaupun gambarnya sedang disembunyikan. */
  const fHitung = { ...f, patok: { ...p, tampil: 1, tampilGaris: 1, tampilLabel: 1 } }
  const jmlHuruf = daftarPatok(fHitung, p.sumbuHuruf).length
  const jmlT = daftarPatok(fHitung, p.sumbuHuruf === 'y' ? 'x' : 'y').length
  /** Contoh koordinat: patok pertama (pasti tepat di patok) dan titik tengah. */
  const box = fieldBox(f)
  const contohPatok = coordText(box.minX, box.minY, f)
  const contohTengah = coordText(0, 0, f)
  /** Gambaran urutan patok huruf, mis. `C# C B# B A# A A# B B# C`. */
  const urut = [...daftarPatok(fHitung, p.sumbuHuruf)]
    .sort((a, b) => a.pos - b.pos)
    .map((g) => g.label)
  const contohPola =
    urut.length > 9 ? [...urut.slice(0, 4), '…', ...urut.slice(-4)].join(' ') : urut.join(' ')

  const gridUtamaOn = (f.gridTampil ?? 1) === 1
  const subgridOn = (f.subgridTampil ?? (f.subgridYd ? 1 : 0)) === 1
  const hashOn = (f.hashTampil ?? (f.hash !== 'none' ? 1 : 0)) === 1
  const patokGarisOn = (p.tampilGaris ?? p.tampil) === 1
  const patokLabelOn = (p.tampilLabel ?? p.tampil) === 1

  // Hitungan otomatis garis dari fieldBox (#9).
  const daftarGarisUtama = gridUtamaOn && (f.garis ?? 1) !== 0 ? garisGridUtama(f) : []
  const daftarGarisSub = subgridOn && (f.garis ?? 1) !== 0 ? garisSubgrid(f) : []
  const presetGridCepat = satuan === 'langkah' ? [2, 4, 8, 16] : [1, 2, 5, 10]

  // Geometri SVG pratinjau langsung (identik dengan konvensi DrillEditor).
  const VW = Math.max(2, f.lengthYd + f.endZoneYd * 2)
  const VH = Math.max(2, f.widthYd)
  const halfL = VW / 2
  const halfW = VH / 2
  const sx = (x: number) => halfL - x
  const sy = (y: number) => halfW - y
  const rContoh = ukurTitik(f, 1.15)
  const bentangContohX = Math.min(Math.max(1, f.lengthYd * 0.18), 10)
  const bentangContohY = Math.min(Math.max(0.6, f.widthYd * 0.14), 5)
  const titikContoh = [
    { x: -bentangContohX, y: -bentangContohY * 0.5, warna: '#38bdf8' },
    { x: -bentangContohX * 0.5, y: bentangContohY * 0.4, warna: '#38bdf8' },
    { x: 0, y: 0, warna: '#f59e0b' },
    { x: bentangContohX * 0.5, y: bentangContohY * 0.4, warna: '#ec4899' },
    { x: bentangContohX, y: -bentangContohY * 0.5, warna: '#ec4899' },
  ]
  const warnaLatar = warnaLapangan(f)
  const warnaG = warnaGarisGrid(f)
  const langkahYd = stepYd(f)
  const langkahCm = Math.round(langkahYd * YD_TO_M * 1000) / 10
  const satuanJarakPatok: SatuanJarakPatok = p.satuanJarak ?? 'langkah'
  const ketJarakPatok =
    satuanJarakPatok === 'yard'
      ? 'dalam yard fisik'
      : satuanJarakPatok === 'meter'
        ? 'dalam meter fisik'
        : 'dalam langkah'

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {/* Pratinjau lapangan langsung (#9) — grid, subgrid, hash, patok, warna hex & skala titik */}
      <div
        data-testid="pratinjau-lapangan-editor"
        className="rounded-lg border border-slate-700/70 bg-slate-950/70 p-2.5 sm:col-span-2"
      >
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-1.5 text-[11px]">
          <span className="font-medium text-slate-300">
            Pratinjau lapangan langsung ·{' '}
            <span className="font-mono text-sky-300">
              {keTampil(f.lengthYd)} × {keTampil(f.widthYd)} {singkatan}
            </span>
          </span>
          <span
            data-testid="info-jumlah-garis-grid"
            className="rounded bg-slate-900 px-2 py-0.5 font-mono text-[10px] text-slate-300"
          >
            {daftarGarisUtama.length} garis grid
            {subgridOn ? ` · ${daftarGarisSub.length} subgrid` : ''} ·{' '}
            {p.aktif === 1 ? `Patok ${jmlHuruf}×${jmlT}` : 'Tanpa patok'}
          </span>
        </div>
        <div className="overflow-hidden rounded border border-slate-800 bg-slate-950 p-1.5">
          <svg
            data-testid="svg-pratinjau-lapangan"
            viewBox={`0 0 ${VW} ${VH}`}
            className="max-h-44 w-full select-none"
            aria-label="Pratinjau konfigurasi lapangan"
          >
            <FieldSurface f={f} VW={VW} VH={VH} sx={sx} sy={sy} pratinjau />
            {titikContoh.map((t, i) => (
              <circle
                key={i}
                data-pratinjau-titik="1"
                cx={sx(t.x)}
                cy={sy(t.y)}
                r={rContoh}
                fill={t.warna}
                stroke="#0f172a"
                strokeWidth={Math.max(0.08, rContoh * 0.22)}
              />
            ))}
          </svg>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500">
          <span>
            5 titik contoh mengikuti skala titik ({Math.round((f.ukuranTitik ?? 1) * 100)}%) & luas lapangan
          </span>
          <span className="font-mono">
            Latar {warnaLatar.rumput} · Garis {warnaG.hex}
          </span>
        </div>
      </div>

      <Field
        label="Satuan ukuran"
        hint="Hanya mengubah tampilan & input — nilai internal tetap yard, tanpa menggeser geometri"
      >
        <div className="space-y-1.5">
          <div className="grid grid-cols-3 gap-1" role="group" aria-label="Pilih satuan tampilan lapangan">
            {(
              [
                { id: 'yd', label: 'Yard' },
                { id: 'm', label: 'Meter' },
                { id: 'langkah', label: 'Langkah' },
              ] as const
            ).map((opsi) => (
              <button
                key={opsi.id}
                type="button"
                data-testid={`satuan-${opsi.id}`}
                onClick={() => gantiSatuan(opsi.id)}
                className={`rounded border px-2 py-1 text-xs font-medium transition ${
                  satuan === opsi.id
                    ? 'border-sky-500 bg-sky-500/20 text-sky-200'
                    : 'border-slate-700 bg-slate-900/70 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                }`}
              >
                {opsi.label}
              </button>
            ))}
          </div>
          <Select
            data-testid="pilih-satuan"
            value={satuan}
            onChange={(e) => gantiSatuan(e.target.value as SatuanTampilLapangan)}
          >
            <option value="yd">Yard (standar DCI)</option>
            <option value="m">Meter (lapangan Indonesia)</option>
            <option value="langkah">Langkah (1 lk = {langkahCm} cm)</option>
          </Select>
        </div>
      </Field>

      <Field label={`Lebar lapangan (${nSatuan})`}>
        <Input
          data-testid="kolom-lebar"
          type="number"
          step="0.01"
          value={keTampil(f.widthYd)}
          onChange={(e) =>
            patch({ widthYd: dariTampil(angkaAman(e.target.value, keTampil(f.widthYd), 0.01)) })
          }
          min={0.01}
        />
      </Field>
      <Field label={`Panjang area main (${nSatuan})`}>
        <Input
          data-testid="kolom-panjang"
          type="number"
          step="0.01"
          value={keTampil(f.lengthYd)}
          onChange={(e) =>
            patch({ lengthYd: dariTampil(angkaAman(e.target.value, keTampil(f.lengthYd), 0.01)) })
          }
          min={0.01}
        />
      </Field>
      <Field label={`End zone tiap ujung (${nSatuan})`} hint="0 untuk lapangan bola & indoor">
        <Input
          data-testid="kolom-endzone"
          type="number"
          step="0.01"
          value={keTampil(f.endZoneYd)}
          onChange={(e) =>
            patch({ endZoneYd: dariTampil(angkaAman(e.target.value, keTampil(f.endZoneYd), 0)) })
          }
          min={0}
        />
      </Field>

      {/* Grid utama & subgrid kustom — dihitung otomatis dari fieldBox, terpisah dari patok */}
      <Field
        label={`Grid utama (${nSatuan})`}
        hint={`Dihitung otomatis dari fieldBox (${daftarGarisUtama.length} garis)`}
      >
        <div className="space-y-1.5">
          <div className="flex gap-2">
            <Select
              data-testid="pilih-grid-tampil"
              value={gridUtamaOn ? 1 : 0}
              onChange={(e) => patch({ gridTampil: Number(e.target.value) })}
            >
              <option value={1}>Tampilkan</option>
              <option value={0}>Sembunyikan</option>
            </Select>
            <Input
              data-testid="kolom-grid-jarak"
              type="number"
              step="0.25"
              min={0.25}
              disabled={!gridUtamaOn}
              value={keTampil(f.gridYd)}
              onChange={(e) => {
                const jarakYd = Math.max(
                  0.25,
                  dariTampil(angkaAman(e.target.value, keTampil(f.gridYd), 0.25)),
                )
                patch({ gridYd: jarakYd })
              }}
            />
          </div>
          {gridUtamaOn && (
            <div className="flex flex-wrap gap-1">
              {presetGridCepat.map((n) => {
                const targetYd = dariTampil(n)
                const aktif = Math.abs(f.gridYd - targetYd) < 0.02
                return (
                  <button
                    key={n}
                    type="button"
                    data-testid={`preset-grid-${n}`}
                    onClick={() => patch({ gridYd: targetYd })}
                    className={`rounded border px-1.5 py-0.5 text-[10px] transition ${
                      aktif
                        ? 'border-sky-500 bg-sky-500/20 text-sky-200'
                        : 'border-slate-700/80 bg-slate-900/60 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Tiap {n} {singkatan}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </Field>

      <Field
        label={`Subgrid (${nSatuan})`}
        hint="Garis bantu tipis di antara garis grid utama"
      >
        <div className="space-y-1.5">
          <div className="flex gap-2">
            <Select
              data-testid="pilih-subgrid-tampil"
              value={subgridOn ? 1 : 0}
              onChange={(e) => {
                const nyala = Number(e.target.value)
                const bawaanSub = Math.max(0.25, f.gridYd / 2)
                patch({
                  subgridTampil: nyala,
                  subgridYd: nyala ? (f.subgridYd && f.subgridYd < f.gridYd ? f.subgridYd : bawaanSub) : f.subgridYd,
                })
              }}
            >
              <option value={0}>Tanpa subgrid</option>
              <option value={1}>Tampilkan</option>
            </Select>
            <Input
              data-testid="kolom-subgrid-jarak"
              type="number"
              step="0.25"
              min={0.1}
              disabled={!subgridOn}
              value={keTampil(f.subgridYd ?? Math.max(0.25, f.gridYd / 2))}
              onChange={(e) => {
                const nilaiAsal = keTampil(f.subgridYd ?? Math.max(0.25, f.gridYd / 2))
                const mentahYd = dariTampil(angkaAman(e.target.value, nilaiAsal, 0.1))
                const amanYd = Math.min(Math.max(0.1, mentahYd), Math.max(0.15, f.gridYd - 0.05))
                patch({ subgridYd: amanYd, subgridTampil: 1 })
              }}
            />
          </div>
          {subgridOn && (
            <div className="flex flex-wrap gap-1">
              {[
                { label: '½ grid utama', nilaiYd: Math.max(0.1, f.gridYd / 2) },
                { label: '¼ grid utama', nilaiYd: Math.max(0.1, f.gridYd / 4) },
              ].map((opsi) => {
                const aktif = Math.abs((f.subgridYd ?? 0) - opsi.nilaiYd) < 0.02
                return (
                  <button
                    key={opsi.label}
                    type="button"
                    onClick={() => patch({ subgridYd: opsi.nilaiYd, subgridTampil: 1 })}
                    className={`rounded border px-1.5 py-0.5 text-[10px] transition ${
                      aktif
                        ? 'border-sky-500 bg-sky-500/20 text-sky-200'
                        : 'border-slate-700/80 bg-slate-900/60 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {opsi.label} ({keTampil(opsi.nilaiYd)} {singkatan})
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </Field>

      <Field label="Warna garis grid" hint="Hex murni — aman cetak & berkas portabel">
        <Select
          data-testid="pilih-warna-grid"
          value={f.warnaGrid ?? 'putih'}
          onChange={(e) => patch({ warnaGrid: e.target.value })}
        >
          {WARNA_GARIS_GRID.map((w) => (
            <option key={w.id} value={w.id}>
              {w.label} ({w.hex})
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Ketebalan garis grid" hint="Mengikuti proporsi ukuran lapangan">
        <Select
          data-testid="pilih-tebal-grid"
          value={tebalGarisGrid(f)}
          onChange={(e) => patch({ tebalGrid: Number(e.target.value) })}
        >
          {TEBAL_GARIS_GRID.map((t) => (
            <option key={t.nilai} value={t.nilai}>
              {t.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Hash mark" hint="Garis putus-putus sejajar sideline">
        <div className="flex gap-2">
          <Select value={hashOn ? 1 : 0} onChange={(e) => patch({ hashTampil: Number(e.target.value) })}>
            <option value={1}>Tampilkan</option>
            <option value={0}>Sembunyikan</option>
          </Select>
          <Select
            value={f.hash}
            onChange={(e) => patch({ hash: e.target.value as HashPreset })}
            disabled={!hashOn}
          >
            {(Object.keys(HASH_LABEL) as HashPreset[]).map((h) => (
              <option key={h} value={h}>
                {HASH_LABEL[h]}
              </option>
            ))}
          </Select>
        </div>
      </Field>
      <Field label="Garis lapangan" hint="tepi = garis putih tebal">
        <Select value={f.garis ?? 1} onChange={(e) => patch({ garis: Number(e.target.value) })}>
          <option value={1}>Tampilkan semua</option>
          <option value={2}>Tanpa garis tepi</option>
          <option value={0}>Sembunyikan semua</option>
        </Select>
      </Field>

      <Field label="Ukuran langkah" hint="8-to-5 = 8 langkah per 5 yard (4,57 m), bukan 5 meter">
        <Select
          data-testid="pilih-step"
          value={f.step}
          onChange={(e) => patch({ step: e.target.value as StepPreset })}
        >
          {(Object.keys(STEP_LABEL) as StepPreset[]).map((s) => (
            <option key={s} value={s}>
              {STEP_LABEL[s]}
            </option>
          ))}
        </Select>
      </Field>
      {f.step === 'custom' && (
        <Field label="1 langkah = (yard)">
          <Input
            data-testid="kolom-step-khusus"
            type="number"
            step="0.01"
            value={f.customStepYd}
            onChange={(e) =>
              patch({ customStepYd: angkaAman(e.target.value, f.customStepYd, 0.01) })
            }
            min={0.01}
          />
        </Field>
      )}
      <div className="sm:col-span-2 rounded-md border border-amber-700/30 bg-amber-950/20 p-2 text-[11px] leading-relaxed text-amber-200/80">
        <b>Catatan yard ↔ meter ↔ langkah:</b> 8-to-5 standar = <b>8 langkah per 5 yard</b> (22,5″ ≈ 0,5715 m per langkah, total 4,572 m). Grid <b>5 meter</b> = <b>5,468 yard</b> — jarak fisik berbeda. Mengganti satuan tampilan <b>tidak</b> mengubah panjang langkah atau memaksa snap; grid & patok dihitung terpisah dari garis tengah (<code className="font-mono">fieldBox</code>).
      </div>

      <Field label="Label koordinat">
        <Select value={f.showLabels} onChange={(e) => patch({ showLabels: Number(e.target.value) })}>
          <option value={1}>Tampilkan</option>
          <option value={0}>Sembunyikan</option>
        </Select>
      </Field>

      <Field label="Warna lapangan">
        <Select value={f.warna ?? 'hijau'} onChange={(e) => patch({ warna: e.target.value })}>
          {WARNA_LAPANGAN.map((w) => (
            <option key={w.id} value={w.id}>
              {w.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field
        label="Ukuran titik pemain"
        hint="sudah mengikuti luas lapangan — perkecil kalau formasi terasa sesak"
      >
        <Select
          data-testid="pilih-ukuran-titik"
          value={f.ukuranTitik ?? 1}
          onChange={(e) => patch({ ukuranTitik: Number(e.target.value) })}
        >
          <option value={0.5}>50% — sangat kecil</option>
          <option value={0.75}>75% — kecil</option>
          <option value={1}>100% — bawaan</option>
          <option value={1.25}>125% — besar</option>
          <option value={1.5}>150% — lebih besar</option>
          <option value={2}>200% — sangat besar</option>
        </Select>
      </Field>

      {/* DD1 & #9 — sistem patok cara Indonesia + opsi cepat Tanpa patok */}
      <div className="rounded-lg border border-slate-700/60 bg-slate-950/40 p-3 sm:col-span-2">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <Toggle
            label="Pakai sistem patok"
            checked={p.aktif === 1}
            onChange={(v) => gantiPatok({ aktif: v ? 1 : 0 })}
          />
          <button
            type="button"
            data-testid="opsi-tanpa-patok"
            onClick={() => gantiPatok({ aktif: 0 })}
            className={`rounded border px-2.5 py-1 text-xs font-medium transition ${
              p.aktif === 0
                ? 'border-emerald-500/70 bg-emerald-500/15 text-emerald-200'
                : 'border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-500 hover:text-white'
            }`}
            title="Matikan sistem patok — cocok untuk aula/GOR kecil atau lapangan bergaris biasa"
          >
            Tanpa patok (indoor kecil)
          </button>
        </div>
        <p className="mb-2 text-[11px] leading-relaxed text-slate-500">
          {p.aktif === 1 ? (
            <>
              Patok huruf <b>A → # → B → # → C …</b> dan patok angka <b>T1 → T2 → T3 …</b>. Posisi pemain
              dibaca gabungan keduanya, misalnya <b>A6</b> (patok A, patok T6) atau <b>B#8</b>. Grid <b>tidak</b> dipotong oleh batas patok.
            </>
          ) : (
            <>
              Mode <b>Tanpa patok</b> aktif — cocok untuk lapangan indoor/GOR kecil atau lapangan standar tanpa penanda huruf. Hanya garis grid &amp; tepi yang digambar; contoh titik tengah: <b className="text-slate-300">{contohTengah}</b>.
            </>
          )}
        </p>
        {p.aktif === 1 && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Patok huruf dipasang di sumbu" hint="sumbu lainnya dipakai patok T">
              <Select
                value={p.sumbuHuruf}
                onChange={(e) => gantiPatok({ sumbuHuruf: e.target.value as 'x' | 'y' })}
              >
                <option value="y">Melintang (depan ↔ belakang)</option>
                <option value="x">Membujur (kiri ↔ kanan)</option>
              </Select>
            </Field>
            <Field
              label="Satuan jarak patok"
              hint="langkah = ikut ukuran langkah; yard/meter = ukuran pita fisik"
            >
              <Select
                data-testid="pilih-satuan-jarak-patok"
                value={satuanJarakPatok}
                onChange={(e) =>
                  gantiPatok({ satuanJarak: e.target.value as SatuanJarakPatok })
                }
              >
                <option value="langkah">Langkah (8 per 5 yard pada 8-to-5)</option>
                <option value="yard">Yard fisik (ikuti grid yard)</option>
                <option value="meter">Meter fisik (ikuti pita meteran)</option>
              </Select>
            </Field>
            <Field label="Garis patok">
              <Select
                value={patokGarisOn ? 1 : 0}
                onChange={(e) =>
                  gantiPatok({
                    tampilGaris: Number(e.target.value),
                    tampil: Number(e.target.value) || (p.tampilLabel ?? p.tampil) ? 1 : 0,
                  })
                }
              >
                <option value={1}>Tampilkan garis</option>
                <option value={0}>Sembunyikan garis</option>
              </Select>
            </Field>
            <Field label="Label patok">
              <Select
                value={patokLabelOn ? 1 : 0}
                onChange={(e) =>
                  gantiPatok({
                    tampilLabel: Number(e.target.value),
                    tampil: Number(e.target.value) || (p.tampilGaris ?? p.tampil) ? 1 : 0,
                  })
                }
              >
                <option value={1}>Tampilkan label</option>
                <option value={0}>Sembunyikan label</option>
              </Select>
            </Field>
            <Field label="Pola patok huruf">
              <Select
                value={p.dariTengah}
                onChange={(e) => gantiPatok({ dariTengah: Number(e.target.value) })}
              >
                <option value={1}>A di tengah, lalu ke dua sisi</option>
                <option value={0}>A di tepi, lurus ke seberang</option>
              </Select>
            </Field>
            <Field label="Tulisan patok angka">
              <Select value={p.awalanT} onChange={(e) => gantiPatok({ awalanT: Number(e.target.value) })}>
                <option value={1}>T1, T2, T3, …</option>
                <option value={0}>1, 2, 3, …</option>
              </Select>
            </Field>
            <Field label="Patok di dua sisi" hint="A di tengah, jadi B ada kiri & kanan">
              <Select
                value={p.penandaSisi}
                onChange={(e) => gantiPatok({ penandaSisi: Number(e.target.value) })}
              >
                <option value={0}>Sama saja (B · B)</option>
                <option value={1}>Beri tanda (B&apos; · B)</option>
              </Select>
            </Field>
            <Field label="Jarak patok huruf → huruf" hint={`${ketJarakPatok} — mis. A ke B`}>
              <Input
                data-testid="kolom-patok-huruf"
                type="number"
                step="0.5"
                min="1"
                value={p.jarakHuruf}
                onChange={(e) =>
                  gantiPatok({ jarakHuruf: angkaAman(e.target.value, p.jarakHuruf, 1) })
                }
              />
            </Field>
            <Field label="Jarak patok huruf → #" hint={`${ketJarakPatok} — mis. A ke A#`}>
              <Input
                data-testid="kolom-patok-hash"
                type="number"
                step="0.5"
                min="0.5"
                value={p.jarakHash}
                onChange={(e) =>
                  gantiPatok({ jarakHash: angkaAman(e.target.value, p.jarakHash, 0.5) })
                }
              />
            </Field>
            <Field label="Jarak antar patok T" hint={`${ketJarakPatok} — mis. T1 ke T2`}>
              <Input
                data-testid="kolom-patok-t"
                type="number"
                step="0.5"
                min="1"
                value={p.jarakT}
                onChange={(e) =>
                  gantiPatok({ jarakT: angkaAman(e.target.value, p.jarakT, 1) })
                }
              />
            </Field>
            <Field label="Batas huruf" hint="E = sampai E simetris; kosong = otomatis sampai tepi">
              <div className="flex gap-2">
                <Select
                  data-testid="pilih-batas-huruf"
                  value={p.maksHuruf === undefined ? '' : String(p.maksHuruf)}
                  onChange={(e) =>
                    gantiPatok({
                      maksHuruf: e.target.value === '' ? undefined : Number(e.target.value),
                    })
                  }
                >
                  <option value="">Otomatis (sampai tepi)</option>
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i} value={i}>
                      {hurufPatok(i)} (sampai {hurufPatok(i)})
                    </option>
                  ))}
                </Select>
              </div>
            </Field>
            <Field label="Batas T" hint="26 = T1..T26; kosong = otomatis">
              <Input
                data-testid="kolom-batas-t"
                type="number"
                step="1"
                min="1"
                placeholder="otomatis"
                value={p.maksT ?? ''}
                onChange={(e) => {
                  const teks = e.target.value.trim()
                  if (teks === '') {
                    gantiPatok({ maksT: undefined })
                    return
                  }
                  const n = Number(teks)
                  if (Number.isFinite(n)) {
                    gantiPatok({ maksT: Math.max(1, Math.floor(n)) })
                  }
                }}
              />
            </Field>
            <div className="flex items-end sm:col-span-2">
              <p className="pb-2 text-[11px] leading-relaxed text-slate-500">
                Lapangan ini: <b className="text-slate-300">{jmlHuruf}</b> patok huruf/# dan{' '}
                <b className="text-slate-300">{jmlT}</b> patok angka.
                <br />
                Urutannya: <b className="text-slate-300">{contohPola || '—'}</b>
                <br />
                Patok pertama: <b className="text-slate-300">{contohPatok}</b>
                <br />
                Titik tengah: <b className="text-slate-300">{contohTengah}</b>
                <br />
                <span className="text-slate-600">
                  A di tengah = YL50 pada lapangan simetris; B 5 yard dari A (8 langkah), A# 2,5 yard (4 langkah) bila 8-to-5.
                </span>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
