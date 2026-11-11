/**
 * v2.8 — editor Syarat pelantikan berbasis rasio (bagian dari Program Latsar).
 *
 * Jumlah sesi Latsar berubah tiap musim, jadi syaratnya ditulis sebagai
 * pecahan dari N sesi wajib — dan pratinjaunya langsung menunjukkan angka
 * untuk N musim ini serta N lain yang lazim (mis. gelombang oprec susulan).
 */
import type { AturanPelantikan, KategoriIzin, RasioSesi } from '../../db/types'
import { Button, Input } from '../ui'
import { KATEGORI_IZIN_BAKU, batasRasio, lengkapiAturan, teksRasio, type AturanLengkap } from '../../lib/programLatsar'
import { uid } from '../../lib/utils'

function InputRasio({
  label,
  nilai,
  onChange,
  testId,
}: {
  label: string
  nilai: RasioSesi
  onChange: (r: RasioSesi) => void
  testId: string
}) {
  const kecil =
    'w-12 rounded-lg border border-slate-700 bg-slate-950/60 px-1.5 py-1.5 text-center text-sm text-slate-100 outline-none focus:border-emerald-500'
  const bulat = (v: string, min: number) => Math.max(min, Math.round(Number(v) || 0))
  return (
    <label className="text-[11px] text-slate-400">
      {label}
      <span className="mt-1 flex items-center gap-1">
        <input
          type="number"
          min={0}
          data-testid={`${testId}-a`}
          className={kecil}
          value={nilai[0]}
          onChange={(e) => onChange([Math.min(bulat(e.target.value, 0), nilai[1]), nilai[1]])}
        />
        <span className="text-slate-500">/</span>
        <input
          type="number"
          min={1}
          data-testid={`${testId}-b`}
          className={kecil}
          value={nilai[1]}
          onChange={(e) => {
            const b = bulat(e.target.value, 1)
            onChange([Math.min(nilai[0], b), b])
          }}
        />
        <span className="text-slate-500">× N</span>
      </span>
    </label>
  )
}

export function EditorAturanPelantikan({
  aturan: mentah,
  nWajib,
  onChange,
}: {
  aturan: AturanPelantikan
  /** Jumlah sesi wajib program saat ini (pratinjau). */
  nWajib: number
  onChange: (a: AturanLengkap) => void
}) {
  const a = lengkapiAturan(mentah)
  const ubah = (x: Partial<AturanLengkap>) => onChange(lengkapiAturan({ ...a, ...x }))
  const ubahKategori = (i: number, x: Partial<KategoriIzin>) =>
    ubah({ kategoriIzin: a.kategoriIzin.map((k, j) => (j === i ? { ...k, ...x } : k)) })
  const contohN = [...new Set([nWajib, 6, 7, 8, 10, 12, 14, 16].filter((n) => n > 0))].sort((x, y) => x - y)
  const angka = (v: string) => Math.max(0, Math.round(Number(v) || 0))

  return (
    <section className="space-y-2" data-testid="program-aturan">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Syarat pelantikan (rasio dari N sesi wajib)</h3>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <InputRasio label="Hadir minimal (dibulatkan ke atas)" testId="aturan-rasio-hadir" nilai={a.rasioHadir} onChange={(r) => ubah({ rasioHadir: r })} />
        <InputRasio label="Alpa maksimal" testId="aturan-rasio-alpa" nilai={a.rasioAlpa} onChange={(r) => ubah({ rasioAlpa: r })} />
        <InputRasio label="Jatah telat" testId="aturan-rasio-telat" nilai={a.rasioTelat} onChange={(r) => ubah({ rasioTelat: r })} />
      </div>
      <div className="overflow-x-auto">
        <table className="text-[11px] text-slate-300" data-testid="aturan-tabel-rasio">
          <thead>
            <tr className="text-slate-500">
              <th className="pr-3 text-left font-medium">N sesi</th>
              {contohN.map((n) => (
                <th key={n} className={`px-1.5 text-center font-medium ${n === nWajib ? 'text-emerald-300' : ''}`}>
                  {n}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(['hadir', 'alpa', 'telat'] as const).map((k) => (
              <tr key={k}>
                <td className="pr-3 text-slate-500">{k === 'hadir' ? 'Hadir min.' : k === 'alpa' ? 'Alpa maks.' : 'Jatah telat'}</td>
                {contohN.map((n) => (
                  <td
                    key={n}
                    data-testid={n === nWajib ? `aturan-n-${k}` : undefined}
                    className={`px-1.5 text-center tabular-nums ${n === nWajib ? 'font-semibold text-emerald-200' : ''}`}
                  >
                    {batasRasio(n, a)[k]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <label className="text-[11px] text-slate-400">
          Toleransi datang (menit)
          <Input type="number" min={0} data-testid="aturan-toleransi" value={a.toleransiMenit} onChange={(e) => ubah({ toleransiMenit: angka(e.target.value) })} />
        </label>
        <label className="text-[11px] text-slate-400">
          Batas jatah telat (menit)
          <Input
            type="number"
            min={0}
            data-testid="aturan-batas-jatah"
            placeholder="½ durasi"
            value={a.batasJatahMenit ?? ''}
            onChange={(e) => ubah({ batasJatahMenit: e.target.value === '' ? undefined : angka(e.target.value) })}
          />
        </label>
        <label className="text-[11px] text-slate-400">
          Batas lapor izin
          <Input type="time" data-testid="aturan-batas-izin" value={a.batasIzin ?? ''} onChange={(e) => ubah({ batasIzin: e.target.value || undefined })} />
        </label>
        <label className="text-[11px] text-slate-400">
          Lapor sakit maks. (jam)
          <Input type="number" min={0} data-testid="aturan-sakit" value={a.sakitMaksJam} onChange={(e) => ubah({ sakitMaksJam: angka(e.target.value) })} />
        </label>
        <label className="text-[11px] text-slate-400">
          Batas bergabung
          <Input type="date" data-testid="aturan-batas" value={a.batasGabung ?? ''} onChange={(e) => ubah({ batasGabung: e.target.value || undefined })} />
        </label>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-slate-300">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" data-testid="aturan-wajib-bukti" checked={a.wajibBukti} onChange={(e) => ubah({ wajibBukti: e.target.checked })} />
          Izin, sakit &amp; telat beralasan wajib berbukti
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" data-testid="aturan-wajib-form" checked={a.wajibForm} onChange={(e) => ubah({ wajibForm: e.target.checked })} />
          Hadir wajib mengisi Google Form presensi
        </label>
      </div>

      <details className="rounded-lg border border-slate-800 px-2 py-1.5" data-testid="aturan-kategori">
        <summary className="cursor-pointer text-[12px] text-slate-300">Kategori izin yang diterima ({a.kategoriIzin.length})</summary>
        <ul className="mt-1.5 space-y-1">
          {a.kategoriIzin.map((k, i) => (
            <li key={k.id} className="flex flex-wrap items-center gap-1.5" data-testid={`kategori-${k.id}`}>
              <span className="min-w-0 flex-1 basis-40">
                <Input value={k.nama} aria-label="Nama kategori" onChange={(e) => ubahKategori(i, { nama: e.target.value })} />
              </span>
              <span className="min-w-0 flex-1 basis-40">
                <Input value={k.bukti} aria-label="Bukti yang diminta" placeholder="Bukti yang diminta" onChange={(e) => ubahKategori(i, { bukti: e.target.value })} />
              </span>
              <Button size="sm" variant="ghost" aria-label={`Hapus ${k.nama}`} onClick={() => ubah({ kategoriIzin: a.kategoriIzin.filter((_, j) => j !== i) })}>
                ✕
              </Button>
            </li>
          ))}
        </ul>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <Button
            size="sm"
            data-testid="kategori-tambah"
            onClick={() => ubah({ kategoriIzin: [...a.kategoriIzin, { id: uid('kat_'), nama: 'Kategori baru', bukti: '' }] })}
          >
            + Kategori
          </Button>
          <Button size="sm" variant="ghost" data-testid="kategori-pulihkan" onClick={() => ubah({ kategoriIzin: KATEGORI_IZIN_BAKU.map((k) => ({ ...k })) })}>
            Pulihkan 7 bawaan
          </Button>
        </div>
        <p className="mt-1 text-[11px] text-slate-500">Alasan di luar daftar (mis. rapat organisasi, kerabat lain) tidak diterima sebagai izin.</p>
      </details>

      <p className="text-[11px] text-slate-500">
        Hadir ≥ {teksRasio(a.rasioHadir)}·N, alpa ≤ {teksRasio(a.rasioAlpa)}·N, telat berjatah ≤ {teksRasio(a.rasioTelat)}·N — N = sesi wajib
        sejak bergabung. Datang ≤ {a.toleransiMenit} menit sesudah mulai = hadir; sampai {a.batasJatahMenit != null ? `${a.batasJatahMenit} menit` : 'separuh durasi sesi'}{' '}
        dengan alasan{a.wajibBukti ? ' + bukti' : ''} = hadir memakai jatah telat; selebihnya alpa. Izin/sakit sah tidak memakai jatah alpa. Bergabung
        sesudah batas → pelantikan susulan.
      </p>
    </section>
  )
}
