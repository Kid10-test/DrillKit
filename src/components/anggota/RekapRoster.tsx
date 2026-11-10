/**
 * v2.7.1 — Rekap roster: section × instrumen × kelompok roster (tag).
 *
 * Kelompok roster = tag pilihan pelatih (mis. "CAB 42", "Returner 2027",
 * "Returner – menunggu", "Alumni"), disimpan di `TeamSettings.kelompokRoster`.
 * Angka = anggota aktif; "+n" = nonaktif di kelompok itu. Bisa diunduh CSV
 * atau dicetak A4 (lembar dimuat malas).
 */
import { useMemo, useState } from 'react'
import { saveSettings } from '../../db/db'
import type { Member } from '../../db/types'
import { useSettings } from '../../hooks/useSettings'
import { downloadHtmlFile, printHtml } from '../../lib/print'
import {
  type BarisRekapRoster,
  barisCsvRekapRoster,
  kelompokRosterAktif,
  rekapRoster,
  teksSelRekap,
} from '../../lib/rosterAnggota'
import { bersihkanSatuTag, kumpulkanTagRoster } from '../../lib/tagAnggota'
import { cx, downloadFile, todayISO, toCSV, visibleSections } from '../../lib/utils'
import { Button, Modal, Toggle, useToast } from '../ui'

export function RekapRoster({ open, anggota, onClose }: { open: boolean; anggota: Member[]; onClose: () => void }) {
  const toast = useToast()
  const settings = useSettings()
  const kelompok = useMemo(() => kelompokRosterAktif(settings.kelompokRoster, anggota), [settings.kelompokRoster, anggota])
  const [tagBaru, setTagBaru] = useState('')
  const [sertakanNama, setSertakanNama] = useState(true)
  const sections = useMemo(() => visibleSections(), [])
  const rekap = useMemo(() => rekapRoster(anggota, kelompok, sections), [anggota, kelompok, sections])
  const semuaTag = useMemo(() => kumpulkanTagRoster(anggota), [anggota])
  const usulan = semuaTag.filter((t) => !kelompok.some((k) => k.toLowerCase() === t.tag.toLowerCase()))

  async function simpan(daftar: string[]) {
    await saveSettings({ kelompokRoster: daftar })
  }
  async function tambah(tag: string) {
    const t = bersihkanSatuTag(tag)
    if (!t || kelompok.some((k) => k.toLowerCase() === t.toLowerCase())) return
    await simpan([...kelompok, t])
    setTagBaru('')
  }
  async function geser(i: number, arah: -1 | 1) {
    const j = i + arah
    if (j < 0 || j >= kelompok.length) return
    const d = [...kelompok]
    ;[d[i], d[j]] = [d[j], d[i]]
    await simpan(d)
  }

  async function cetak(unduh: boolean) {
    const { buatLembarRekapRosterHtml } = await import('../../lib/rosterCetak')
    const html = buatLembarRekapRosterHtml({
      namaTim: settings.teamName || 'Marching Band',
      tanggal: todayISO(),
      rekap,
      sertakanNama,
    })
    if (unduh) downloadHtmlFile(html, `rekap-roster-${todayISO()}.html`)
    else if (!printHtml(html)) toast.push('Jendela cetak diblokir — pakai Unduh HTML', 'err')
  }

  const sel = (b: BarisRekapRoster, kuat = false) => (
    <>
      {b.sel.map((s, i) => (
        <td key={i} className={cx('px-2 py-1 text-center tabular-nums', kuat && 'font-semibold', !s.aktif && s.nonaktif ? 'text-slate-500' : '')} title={s.nonaktif ? `${s.nonaktif} nonaktif` : undefined}>
          {teksSelRekap(s)}
        </td>
      ))}
      <td className="px-2 py-1 text-center tabular-nums text-slate-400">{b.lainnya || '–'}</td>
      <td className="px-2 py-1 text-center font-semibold tabular-nums text-slate-100">{b.totalAktif}</td>
    </>
  )

  return (
    <Modal open={open} onClose={onClose} wide testId="rekap-roster" title="Rekap roster">
      <div className="space-y-3">
        <div>
          <p className="mb-1.5 text-xs text-slate-400">
            <b>Kelompok roster</b> = tag pilihanmu, urut sesuai prioritas (anggota dihitung di kelompok pertama yang
            dipegangnya). Pasang tagnya lewat kolom Tag di CSV atau aksi massal <b>Pilih</b>.
          </p>
          <div className="flex flex-wrap items-center gap-1.5" data-testid="kelompok-roster">
            {kelompok.map((k, i) => (
              <span key={k} data-testid={`kelompok-${i}`} className="inline-flex items-center gap-1 rounded-full border border-emerald-600/40 bg-emerald-950/40 py-0.5 pl-2 pr-1 text-[11px] text-emerald-200">
                #{k}
                <button type="button" title="Geser ke kiri" disabled={i === 0} onClick={() => void geser(i, -1)} className="px-0.5 text-slate-400 disabled:opacity-30">
                  ‹
                </button>
                <button type="button" title="Geser ke kanan" disabled={i === kelompok.length - 1} onClick={() => void geser(i, 1)} className="px-0.5 text-slate-400 disabled:opacity-30">
                  ›
                </button>
                <button
                  type="button"
                  title="Keluarkan dari rekap (tag anggota tidak dihapus)"
                  data-testid={`kelompok-hapus-${i}`}
                  onClick={() => void simpan(kelompok.filter((_, j) => j !== i))}
                  className="px-0.5 text-slate-400 hover:text-rose-300"
                >
                  ×
                </button>
              </span>
            ))}
            <form
              className="inline-flex items-center gap-1"
              onSubmit={(e) => {
                e.preventDefault()
                void tambah(tagBaru)
              }}
            >
              <input
                data-testid="kelompok-baru"
                list="usulan-kelompok-roster"
                value={tagBaru}
                onChange={(e) => setTagBaru(e.target.value)}
                placeholder="+ kelompok baru"
                className="w-40 rounded-full border border-slate-700 bg-slate-950/60 px-2.5 py-0.5 text-[11px] text-slate-200 outline-none focus:border-emerald-500"
              />
              <datalist id="usulan-kelompok-roster">
                {usulan.map((t) => (
                  <option key={t.tag} value={t.tag} />
                ))}
              </datalist>
              <button type="submit" data-testid="kelompok-tambah" disabled={!tagBaru.trim()} className="rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-semibold text-white disabled:opacity-40">
                Tambah
              </button>
            </form>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full min-w-[420px] text-xs" data-testid="tabel-rekap-roster">
            <thead className="bg-slate-900 text-[11px] text-slate-400">
              <tr>
                <th className="px-2 py-1.5 text-left">Instrumen</th>
                {kelompok.map((k) => (
                  <th key={k} className="px-2 py-1.5">
                    {k}
                  </th>
                ))}
                <th className="px-2 py-1.5">Lainnya</th>
                <th className="px-2 py-1.5">Total aktif</th>
              </tr>
            </thead>
            {rekap.seksi.map((s) => (
              <tbody key={s.section} data-testid={`rekap-seksi-${s.section}`} className="border-t border-slate-800">
                <tr className="bg-slate-900/60">
                  <td colSpan={kelompok.length + 3} className="px-2 py-1 font-semibold text-slate-200">
                    {s.label}
                  </td>
                </tr>
                {s.baris.map((b) => (
                  <tr key={b.instrumen} className="text-slate-300">
                    <td className="px-2 py-1 pl-4">{b.instrumen}</td>
                    {sel(b)}
                  </tr>
                ))}
                <tr className="bg-slate-900/30 text-slate-200" data-testid={`rekap-jumlah-${s.section}`}>
                  <td className="px-2 py-1 font-semibold">Jumlah</td>
                  {sel(s.jumlah, true)}
                </tr>
              </tbody>
            ))}
            <tfoot className="border-t-2 border-slate-600 bg-slate-900">
              <tr className="text-slate-100" data-testid="rekap-total">
                <td className="px-2 py-1.5 font-bold">Total</td>
                {sel(rekap.total, true)}
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="text-[11px] text-slate-500">
          Angka = aktif · <b>+n</b> = nonaktif di kelompok itu (mis. returner yang belum berkomitmen) · <b>Lainnya</b> = aktif
          tanpa kelompok roster.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Toggle checked={sertakanNama} onChange={setSertakanNama} label="Lampirkan daftar nama per kelompok" />
          <div className="ml-auto flex flex-wrap gap-2">
            <Button size="sm" variant="outline" data-testid="rekap-unduh-csv" onClick={() => downloadFile(`rekap-roster-${todayISO()}.csv`, toCSV(barisCsvRekapRoster(rekap)), 'text/csv')}>
              Unduh CSV
            </Button>
            <Button size="sm" variant="outline" data-testid="rekap-unduh-html" onClick={() => void cetak(true)}>
              Unduh HTML
            </Button>
            <Button size="sm" variant="primary" data-testid="rekap-cetak" onClick={() => void cetak(false)}>
              Cetak A4
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
