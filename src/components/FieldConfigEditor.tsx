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
  hurufPatok,
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
   * Ganti satuan tampilan. **Nilai yang tersimpan tetap yard** — hanya
   * label/satuan yang berubah. Geometri, yardline, dan patok tidak bergeser.
   * Konversi hanya di lapisan tampil (f.widthYd * YD_TO_M), bukan di penyimpanan.
   */
  function gantiSatuan(s: 'yd' | 'm') {
    if (s === satuan) return
    patch({ satuan: s })
  }

  // DD1 — sistem patok cara Indonesia.
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
  const urut = [...daftarPatok(fHitung, p.sumbuHuruf)].sort((a, b) => a.pos - b.pos).map((g) => g.label)
  const contohPola =
    urut.length > 9 ? [...urut.slice(0, 4), '…', ...urut.slice(-4)].join(' ') : urut.join(' ')

  const gridUtamaOn = (f.gridTampil ?? 1) === 1
  const subgridOn = (f.subgridTampil ?? (f.subgridYd ? 1 : 0)) === 1
  const hashOn = (f.hashTampil ?? (f.hash !== 'none' ? 1 : 0)) === 1
  const patokGarisOn = (p.tampilGaris ?? p.tampil) === 1
  const patokLabelOn = (p.tampilLabel ?? p.tampil) === 1

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Satuan ukuran" hint="Hanya mengubah tampilan — geometri & patok tetap di yard internal">
        <Select value={satuan} onChange={(e) => gantiSatuan(e.target.value as 'yd' | 'm')}>
          <option value="yd">Yard (standar DCI)</option>
          <option value="m">Meter (lapangan Indonesia)</option>
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

      {/* Grid utama & subgrid — terpisah dari patok */}
      <Field label="Grid utama" hint="Garis yard tiap N — tidak dipotong oleh batas patok">
        <div className="flex gap-2">
          <Select value={gridUtamaOn ? 1 : 0} onChange={(e) => patch({ gridTampil: Number(e.target.value) })}>
            <option value={1}>Tampilkan</option>
            <option value={0}>Sembunyikan</option>
          </Select>
          <Select
            value={f.gridYd}
            onChange={(e) => patch({ gridYd: Number(e.target.value) })}
            disabled={!gridUtamaOn}
          >
            <option value={bulat(5 * (satuan === 'm' ? M_TO_YD : 1))}>Setiap 5 {nSatuan}</option>
            <option value={bulat(10 * (satuan === 'm' ? M_TO_YD : 1))}>Setiap 10 {nSatuan}</option>
            <option value={bulat(1 * (satuan === 'm' ? M_TO_YD : 1))}>Setiap 1 {nSatuan}</option>
            <option value={bulat(2 * (satuan === 'm' ? M_TO_YD : 1))}>Setiap 2 {nSatuan}</option>
          </Select>
        </div>
      </Field>
      <Field label="Subgrid" hint="Garis tipis di antara grid utama">
        <div className="flex gap-2">
          <Select value={subgridOn ? 1 : 0} onChange={(e) => patch({ subgridTampil: Number(e.target.value), subgridYd: Number(e.target.value) ? f.subgridYd ?? bulat(1 * (satuan === 'm' ? M_TO_YD : 1)) : f.subgridYd })}>
            <option value={0}>Tanpa subgrid</option>
            <option value={1}>Tampilkan</option>
          </Select>
          <Select
            value={f.subgridYd ?? bulat(1 * (satuan === 'm' ? M_TO_YD : 1))}
            onChange={(e) => patch({ subgridYd: Number(e.target.value), subgridTampil: 1 })}
            disabled={!subgridOn}
          >
            <option value={bulat(1 * (satuan === 'm' ? M_TO_YD : 1))}>1 {nSatuan}</option>
            <option value={bulat(2.5 * (satuan === 'm' ? M_TO_YD : 1))}>2,5 {nSatuan}</option>
            <option value={bulat(2 * (satuan === 'm' ? M_TO_YD : 1))}>2 {nSatuan}</option>
          </Select>
        </div>
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
      <div className="sm:col-span-2 rounded-md border border-amber-700/30 bg-amber-950/20 p-2 text-[11px] leading-relaxed text-amber-200/80">
        <b>Catatan yard ↔ meter:</b> 8-to-5 standar = <b>8 langkah per 5 yard</b> (22,5″ ≈ 0,5715 m per langkah, total 4,572 m). Grid <b>5 meter</b> = <b>5,468 yard</b> — jarak fisik berbeda. Aplikasi <b>tidak</b> mengubah panjang langkah atau memaksa snap saat mengganti satuan; grid & patok dihitung terpisah. Pilih “Satuan jarak patok” di bawah bila ingin patok mengikuti garis grid.
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
          dibaca gabungan keduanya, misalnya <b>A6</b> (patok A, patok T6) atau <b>B#8</b>. Grid <b>tidak</b> dipotong oleh batas patok.
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
            <Field label="Satuan jarak patok" hint="langkah = ikut 8-to-5; yard = fisik sejajar grid">
              <Select
                value={p.satuanJarak ?? 'langkah'}
                onChange={(e) => gantiPatok({ satuanJarak: e.target.value as 'langkah' | 'yard' })}
              >
                <option value="langkah">Langkah (8 per 5 yard)</option>
                <option value="yard">Yard fisik (ikuti grid)</option>
              </Select>
            </Field>
            <Field label="Garis patok">
              <Select value={patokGarisOn ? 1 : 0} onChange={(e) => gantiPatok({ tampilGaris: Number(e.target.value), tampil: Number(e.target.value) || (p.tampilLabel ?? p.tampil) ? 1 : 0 })}>
                <option value={1}>Tampilkan garis</option>
                <option value={0}>Sembunyikan garis</option>
              </Select>
            </Field>
            <Field label="Label patok">
              <Select value={patokLabelOn ? 1 : 0} onChange={(e) => gantiPatok({ tampilLabel: Number(e.target.value), tampil: Number(e.target.value) || (p.tampilGaris ?? p.tampil) ? 1 : 0 })}>
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
            <Field label="Jarak patok huruf → huruf" hint={p.satuanJarak === 'yard' ? 'dalam yard' : 'dalam langkah — mis. A ke B'}>
              <Input
                type="number"
                step="0.5"
                min="0.5"
                value={p.jarakHuruf}
                onChange={(e) => gantiPatok({ jarakHuruf: Number(e.target.value) })}
              />
            </Field>
            <Field label="Jarak patok huruf → # " hint={p.satuanJarak === 'yard' ? 'dalam yard' : 'dalam langkah — mis. A ke A#'}>
              <Input
                type="number"
                step="0.5"
                min="0.5"
                value={p.jarakHash}
                onChange={(e) => gantiPatok({ jarakHash: Number(e.target.value) })}
              />
            </Field>
            <Field label="Jarak antar patok T" hint={p.satuanJarak === 'yard' ? 'dalam yard — mis. T1 ke T2' : 'dalam langkah — mis. T1 ke T2'}>
              <Input
                type="number"
                step="0.5"
                min="0.5"
                value={p.jarakT}
                onChange={(e) => gantiPatok({ jarakT: Number(e.target.value) })}
              />
            </Field>
            <Field label="Batas huruf" hint="E = sampai E simetris; kosong = otomatis sampai tepi">
              <div className="flex gap-2">
                <Select
                  value={p.maksHuruf === undefined ? '' : String(p.maksHuruf)}
                  onChange={(e) => gantiPatok({ maksHuruf: e.target.value === '' ? undefined : Number(e.target.value) })}
                >
                  <option value="">Otomatis (sampai tepi)</option>
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i} value={i}>{hurufPatok(i)} (sampai {hurufPatok(i)})</option>
                  ))}
                </Select>
              </div>
            </Field>
            <Field label="Batas T" hint="26 = T1..T26; kosong = otomatis">
              <Input
                type="number"
                step="1"
                min="1"
                placeholder="otomatis"
                value={p.maksT ?? ''}
                onChange={(e) => gantiPatok({ maksT: e.target.value.trim() === '' ? undefined : Math.max(1, Math.floor(Number(e.target.value))) })}
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
                <span className="text-slate-600">A di tengah = YL50 pada lapangan simetris; B 5 yard dari A (8 langkah), A# 2,5 yard (4 langkah) bila 8-to-5.</span>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
