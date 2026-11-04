/**
 * #26 (`v2.2.4`) — Panel cepat catatan *cleaning* tertaut set.
 *
 * Satu komponen untuk `DrillEditor` (kartu sisi) dan `DrillPresenter`
 * (laci bawah layar lapangan). Membaca & menulis store terpadu
 * `db.tindakLanjut` (Dexie v17) yang juga akan dipakai Papan Staf `#34` —
 * tidak ada daftar perbaikan kedua. Cetak Lembar Fokus A4 dimuat malas.
 */
import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import type { SectionDef, StatusTindakLanjut, TindakLanjut } from '../../db/types'
import { downloadHtmlFile, printHtml } from '../../lib/print'
import {
  LABEL_STATUS_TL,
  URUTAN_STATUS_TL,
  WARNA_STATUS_TL_HEX,
  buatTindakLanjut,
  hitungStatusTL,
  konteksTL,
  saringTindakLanjut,
  statusBerikut,
  ubahStatusTL,
  urutkanTindakLanjut,
  type FilterStatusTL,
} from '../../lib/tindakLanjut'
import { slugify, todayISO, uid } from '../../lib/utils'
import { useToast } from '../ui'

export function PanelCleaningSet({
  drillId,
  namaDrill,
  namaTim,
  setId,
  setNomor,
  namaSet,
  rentangBirama,
  sections,
  varian = 'editor',
}: {
  drillId: string
  namaDrill: string
  namaTim: string
  setId?: string
  setNomor?: number
  namaSet?: string
  rentangBirama?: { dari: number; sampai: number } | null
  sections: SectionDef[]
  varian?: 'editor' | 'presenter'
}) {
  const toast = useToast()
  const semua = useLiveQuery(
    async () => db.tindakLanjut.where('drillId').equals(drillId).toArray(),
    [drillId],
    [] as TindakLanjut[],
  )
  const [judul, setJudul] = useState('')
  const [seksi, setSeksi] = useState('')
  const [lingkup, setLingkup] = useState<'set' | 'drill'>('set')
  const [filter, setFilter] = useState<FilterStatusTL>('terbuka')

  const daftarLingkup = useMemo(
    () => saringTindakLanjut(semua, { setId: lingkup === 'set' ? setId : undefined }),
    [semua, lingkup, setId],
  )
  const jml = hitungStatusTL(daftarLingkup)
  const tampil = useMemo(
    () => urutkanTindakLanjut(saringTindakLanjut(daftarLingkup, { status: filter })),
    [daftarLingkup, filter],
  )

  async function tambah() {
    const tl = buatTindakLanjut({
      id: uid('tl_'),
      judul,
      sumber: 'cleaning',
      drillId,
      setId,
      setNomor,
      biramaDari: rentangBirama?.dari,
      biramaSampai: rentangBirama?.sampai,
      seksi: seksi || undefined,
    })
    if (!tl) return
    await db.tindakLanjut.put(tl)
    setJudul('')
  }

  async function putarStatus(t: TindakLanjut, ke?: StatusTindakLanjut) {
    await db.tindakLanjut.put(ubahStatusTL(t, ke ?? statusBerikut(t.status)))
  }

  async function cetak(unduh: boolean) {
    const { buatLembarFokusCleaningHtml } = await import('../../lib/cleaningCetak')
    const html = buatLembarFokusCleaningHtml({
      namaTim,
      namaDrill,
      tanggal: new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
      daftar: semua,
      sections,
    })
    const nama = `fokus-cleaning-${slugify(namaDrill)}-${todayISO()}.html`
    if (unduh || !printHtml(html)) {
      downloadHtmlFile(html, nama)
      if (!unduh) toast.push('Jendela cetak diblokir — berkas HTML diunduh, buka lalu Ctrl+P.', 'info')
    }
  }

  const presenter = varian === 'presenter'
  const chip = (aktif: boolean) =>
    'rounded-full border px-2 py-0.5 text-[11px] active:scale-[.97] ' +
    (aktif ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-200' : 'border-slate-700 text-slate-400')

  return (
    <div data-testid="panel-cleaning" className={presenter ? 'space-y-2' : 'space-y-2.5'}>
      <div className="flex flex-wrap items-center gap-1.5">
        <b className="text-xs text-slate-200">Catatan cleaning</b>
        <span className="text-[11px] text-slate-500">
          {lingkup === 'set' && namaSet ? `${namaSet}${setNomor ? ` (Set ${setNomor})` : ''}` : 'seluruh drill'}
          {rentangBirama ? ` · Birama ${rentangBirama.dari}–${rentangBirama.sampai}` : ''}
        </span>
      </div>
      <form
        className="flex min-w-0 flex-wrap gap-1.5"
        onSubmit={(e) => {
          e.preventDefault()
          void tambah()
        }}
      >
        <input
          data-testid="input-cleaning"
          value={judul}
          onChange={(e) => setJudul(e.target.value)}
          placeholder="mis. Busur sayap kanan terlalu maju 1 langkah"
          className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-600"
        />
        <select
          data-testid="seksi-cleaning"
          value={seksi}
          onChange={(e) => setSeksi(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-950 px-1.5 py-1.5 text-xs text-slate-200"
        >
          <option value="">Semua seksi</option>
          {sections.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          data-testid="tambah-cleaning"
          disabled={!judul.trim()}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
        >
          + Temuan
        </button>
      </form>
      <div className="flex flex-wrap items-center gap-1">
        <button type="button" className={chip(lingkup === 'set')} onClick={() => setLingkup('set')} disabled={!setId}>
          Set ini
        </button>
        <button type="button" className={chip(lingkup === 'drill')} onClick={() => setLingkup('drill')}>
          Semua set
        </button>
        <span className="mx-1 h-3 w-px bg-slate-700" />
        {(['terbuka', ...URUTAN_STATUS_TL, 'semua'] as FilterStatusTL[]).map((f) => (
          <button
            key={f}
            type="button"
            data-testid={`filter-cleaning-${f}`}
            className={chip(filter === f)}
            onClick={() => setFilter(f)}
          >
            {f === 'terbuka'
              ? `Terbuka ${jml.temuan + jml.fokus}`
              : f === 'semua'
                ? 'Semua'
                : `${LABEL_STATUS_TL[f]} ${jml[f]}`}
          </button>
        ))}
      </div>
      <ul className={presenter ? 'max-h-40 space-y-1 overflow-y-auto' : 'max-h-64 space-y-1 overflow-y-auto'} data-testid="daftar-cleaning">
        {tampil.length === 0 && (
          <li className="rounded-lg border border-dashed border-slate-800 px-2.5 py-2 text-center text-[11px] text-slate-500">
            Belum ada catatan pada saringan ini.
          </li>
        )}
        {tampil.map((t) => {
          const w = WARNA_STATUS_TL_HEX[t.status]
          return (
            <li
              key={t.id}
              data-testid="baris-cleaning"
              data-status={t.status}
              className="flex min-w-0 items-start gap-2 rounded-lg border border-slate-800 bg-slate-950/60 px-2 py-1.5"
            >
              <button
                type="button"
                data-testid="status-cleaning"
                onClick={() => void putarStatus(t)}
                title="Ketuk untuk memajukan status: temuan → fokus → beres"
                className="shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-bold"
                style={{ color: w.teks, background: w.latar, borderColor: w.garis }}
              >
                {LABEL_STATUS_TL[t.status]}
              </button>
              <div className="min-w-0 flex-1">
                <p className={'break-words text-xs ' + (t.status === 'beres' ? 'text-slate-500 line-through' : 'text-slate-100')}>
                  {t.judul}
                </p>
                <p className="text-[10px] text-slate-500">
                  {[konteksTL(t), t.seksi ? sections.find((s) => s.id === t.seksi)?.label ?? t.seksi : '']
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void db.tindakLanjut.delete(t.id)}
                className="shrink-0 px-1 text-[11px] text-slate-600 hover:text-rose-400"
                title="Hapus catatan"
              >
                ✕
              </button>
            </li>
          )
        })}
      </ul>
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          data-testid="cetak-fokus-cleaning"
          onClick={() => void cetak(false)}
          className="rounded-lg border border-slate-700 px-2.5 py-1 text-[11px] text-slate-200"
        >
          Cetak Lembar Fokus A4
        </button>
        <button
          type="button"
          data-testid="unduh-fokus-cleaning"
          onClick={() => void cetak(true)}
          className="rounded-lg border border-slate-700 px-2.5 py-1 text-[11px] text-slate-400"
        >
          Unduh HTML
        </button>
      </div>
    </div>
  )
}
