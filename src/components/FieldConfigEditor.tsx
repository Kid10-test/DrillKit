/**
 * Editor konfigurasi lapangan (preset, ukuran, patok, langkah).
 *
 * Dulu fungsi ini hidup di `src/pages/Settings.tsx`, sehingga modal
 * pengaturan drill menarik seluruh halaman Pengaturan ke bundelnya.
 * Pindah ke sini (#5): kedua pemakainya mengimpor komponen, bukan halaman.
 */

import type { FieldConfig, HashPreset, PatokConfig, StepPreset } from '../db/types'
import {
  Field,
  Input,
  Select,
  Toggle,
} from './ui'
import {
  HASH_LABEL,
  M_TO_YD,
  STEP_LABEL,
  YD_TO_M,
  coordText,
  WARNA_LAPANGAN,
  daftarPatok,
  fieldBox,
  patokOf,
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
   * Batas minimum diterapkan pada satuan yang DITAMPILKAN (yard atau
   * meter), baru nilainya dikonversi — jangan dibalik, atau yang
   * dibatasi adalah angka yang tidak pernah dilihat pelatih.
   *
   * End zone **boleh** nol (lapangan bola & indoor); lebar, panjang,
   * dan ukuran langkah tidak boleh.
   */
  const angkaAman = (teks: string, bawaan: number, min = 0): number => {
    /*
     * Kolom yang DIKOSONGKAN berarti belum diisi — bukan nol.
     * `Number('')` adalah 0, jadi membiarkannya lewat akan membuat
     * lebar lapangan meloncat ke batas minimumnya (0,01 yard) hanya
     * karena pelatih menghapus angkanya untuk mengetik yang baru.
     */
    if (teks.trim() === '') return bawaan
    const n = Number(teks)
    if (!Number.isFinite(n)) return bawaan
    return Math.max(min, n)
  }
  /** Satuan yang dipakai untuk menampilkan & mengisi ukuran lapangan. */
  const satuan: 'yd' | 'm' = f.satuan === 'm' ? 'm' : 'yd'
  const U = satuan === 'm' ? YD_TO_M : 1
  const nSatuan = satuan === 'm' ? 'meter' : 'yard'
  const bulat = (v: number) => Math.round(v * 100) / 100

  /**
   * Ganti satuan tampilan. Nilai yang tersimpan **tetap yard**, jadi angkanya
   * ikut dikonversi — drill yang sudah ada tidak perlu diubah.
   */
  function gantiSatuan(s: 'yd' | 'm') {
    if (s === satuan) return
    const k = s === 'm' ? YD_TO_M : M_TO_YD
    patch({
      satuan: s,
      widthYd: bulat(f.widthYd * k),
      lengthYd: bulat(f.lengthYd * k),
      endZoneYd: bulat(f.endZoneYd * k),
      gridYd: bulat(f.gridYd * k),
    })
  }

  // DD1 — sistem patok cara Indonesia.
  const p = patokOf(f)
  const gantiPatok = (q: Partial<PatokConfig>) => patch({ patok: { ...p, ...q } })
  /** Hitung jumlah patok walaupun gambarnya sedang disembunyikan. */
  const fHitung = { ...f, patok: { ...p, tampil: 1 } }
  const jmlHuruf = daftarPatok(fHitung, p.sumbuHuruf).length
  const jmlT = daftarPatok(fHitung, p.sumbuHuruf === 'y' ? 'x' : 'y').length
  /** Contoh koordinat: patok pertama (pasti tepat di patok) dan titik tengah. */
  const box = fieldBox(f)
  const contohPatok = coordText(box.minX, box.minY, f)
  const contohTengah = coordText(0, 0, f)
  /** Gambaran urutan patok huruf, mis. `C# C B# B A# A A# B B# C`. */
  const urut = [...daftarPatok(fHitung, p.sumbuHuruf)].sort((a, b) => a.pos - b.pos).map((g) => g.label)
  const contohPola =
    urut.length > 9 ? [...urut.slice(0, 4), '…', ...urut.slice(-4)].join(' ') : urut.join(' ')

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Satuan ukuran">
        <Select value={satuan} onChange={(e) => gantiSatuan(e.target.value as 'yd' | 'm')}>
          <option value="yd">Yard (standar DCI)</option>
          <option value="m">Meter (lapangan Indonesia)</option>
        </Select>
      </Field>
      <Field label="Grid garis lapangan">
        <Select value={f.gridYd} onChange={(e) => patch({ gridYd: Number(e.target.value) })}>
          <option value={bulat(5 * (satuan === 'm' ? M_TO_YD : 1))}>Setiap 5 {nSatuan}</option>
          <option value={bulat(10 * (satuan === 'm' ? M_TO_YD : 1))}>Setiap 10 {nSatuan}</option>
        </Select>
      </Field>
      <Field label={`Lebar lapangan (${nSatuan})`}>
        <Input
          data-testid="kolom-lebar"
          type="number"
          step="0.01"
          value={bulat(f.widthYd * U)}
          onChange={(e) =>
            patch({ widthYd: angkaAman(e.target.value, bulat(f.widthYd * U), 0.01) / U })
          }
          min={0.01}
        />
      </Field>
      <Field label={`Panjang area main (${nSatuan})`}>
        <Input
          data-testid="kolom-panjang"
          type="number"
          step="0.01"
          value={bulat(f.lengthYd * U)}
          onChange={(e) =>
            patch({ lengthYd: angkaAman(e.target.value, bulat(f.lengthYd * U), 0.01) / U })
          }
          min={0.01}
        />
      </Field>
      <Field label={`End zone tiap ujung (${nSatuan})`} hint="0 untuk lapangan bola & indoor">
        <Input
          data-testid="kolom-endzone"
          type="number"
          step="0.01"
          value={bulat(f.endZoneYd * U)}
          onChange={(e) =>
            patch({ endZoneYd: angkaAman(e.target.value, bulat(f.endZoneYd * U), 0) / U })
          }
          min={0}
        />
      </Field>
      <Field label="Jarak hash mark">
        <Select value={f.hash} onChange={(e) => patch({ hash: e.target.value as HashPreset })}>
          {(Object.keys(HASH_LABEL) as HashPreset[]).map((h) => (
            <option key={h} value={h}>
              {HASH_LABEL[h]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Ukuran langkah">
        <Select
          data-testid="pilih-step" value={f.step} onChange={(e) => patch({ step: e.target.value as StepPreset })}>
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
      <Field label="Label koordinat">
        <Select value={f.showLabels} onChange={(e) => patch({ showLabels: Number(e.target.value) })}>
          <option value={1}>Tampilkan</option>
          <option value={0}>Sembunyikan</option>
        </Select>
      </Field>

      <Field label="Garis lapangan" hint="tepi = garis putih tebal">
        <Select value={f.garis ?? 1} onChange={(e) => patch({ garis: Number(e.target.value) })}>
          <option value={1}>Tampilkan semua</option>
          <option value={2}>Tanpa garis tepi</option>
          <option value={0}>Sembunyikan semua</option>
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

      {/* DD1 — sistem patok cara Indonesia */}
      <div className="rounded-lg border border-slate-700/60 bg-slate-950/40 p-3 sm:col-span-2">
        <p className="mb-2 text-[11px] leading-relaxed text-slate-500">
          Patok huruf <b>A → # → B → # → C …</b> dan patok angka <b>T1 → T2 → T3 …</b>. Posisi pemain
          dibaca gabungan keduanya, misalnya <b>A6</b> (patok A, patok T6) atau <b>B#8</b>.
        </p>
        <Toggle
          label="Pakai sistem patok"
          checked={p.aktif === 1}
          onChange={(v) => gantiPatok({ aktif: v ? 1 : 0 })}
        />
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
            <Field label="Gambar patok di lapangan">
              <Select value={p.tampil} onChange={(e) => gantiPatok({ tampil: Number(e.target.value) })}>
                <option value={1}>Tampilkan</option>
                <option value={0}>Sembunyikan</option>
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
            <Field label="Jarak patok huruf → huruf (langkah)" hint="mis. A ke B">
              <Input
                type="number"
                step="0.5"
                min="1"
                value={p.jarakHuruf}
                onChange={(e) => gantiPatok({ jarakHuruf: Number(e.target.value) })}
              />
            </Field>
            <Field label="Jarak patok huruf → # (langkah)" hint="mis. A ke A#">
              <Input
                type="number"
                step="0.5"
                min="0.5"
                value={p.jarakHash}
                onChange={(e) => gantiPatok({ jarakHash: Number(e.target.value) })}
              />
            </Field>
            <Field label="Jarak antar patok T (langkah)" hint="mis. T1 ke T2">
              <Input
                type="number"
                step="0.5"
                min="1"
                value={p.jarakT}
                onChange={(e) => gantiPatok({ jarakT: Number(e.target.value) })}
              />
            </Field>
            <div className="flex items-end">
              <p className="pb-2 text-[11px] leading-relaxed text-slate-500">
                Lapangan ini: <b className="text-slate-300">{jmlHuruf}</b> patok huruf/# dan{' '}
                <b className="text-slate-300">{jmlT}</b> patok angka.
                <br />
                Urutannya: <b className="text-slate-300">{contohPola || '—'}</b>
                <br />
                Patok pertama: <b className="text-slate-300">{contohPatok}</b>
                <br />
                Titik tengah: <b className="text-slate-300">{contohTengah}</b>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
