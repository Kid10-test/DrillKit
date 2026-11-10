/**
 * #34a — Papan Tindak Lanjut Staf: Temuan → Fokus minggu ini → Beres.
 *
 * Membaca & menulis store yang SAMA dengan catatan cleaning per set (#26,
 * Drill) dan tombol "Jadikan tindak lanjut" Judge Tape (#20, Lomba) — satu
 * daftar kerja, tiga pintu masuk. Kolom Fokus tampil juga di Dashboard.
 */
import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import type { SumberTindakLanjut, StatusTindakLanjut, TindakLanjut } from '../../db/types'
import { useSettings } from '../../hooks/useSettings'
import { downloadHtmlFile, printHtml } from '../../lib/print'
import {
  BATAS_FOKUS,
  LABEL_STATUS_TL,
  LABEL_SUMBER_TL,
  URUTAN_STATUS_TL,
  WARNA_STATUS_TL_HEX,
  buatTindakLanjut,
  geserStatusTL,
  konteksTL,
  saringTindakLanjut,
  urutkanTindakLanjut,
} from '../../lib/tindakLanjut'
import { cx, sectionLabel, todayISO, uid, visibleSections } from '../../lib/utils'
import { Button, Card, Select, useToast } from '../ui'

const SUMBER: (SumberTindakLanjut | 'semua')[] = ['semua', 'cleaning', 'juri', 'staf']
const PETUNJUK: Record<StatusTindakLanjut, string> = {
  temuan: 'Semua catatan masuk di sini — dari Drill, Judge Tape, atau staf.',
  fokus: `Pilih ${BATAS_FOKUS - 2}–${BATAS_FOKUS} butir untuk latihan minggu ini.`,
  beres: 'Sudah diulang bersih di lapangan.',
}
/** Kolom Beres hanya menampilkan 14 hari terakhir kecuali diminta semua. */
const JENDELA_BERES = 14 * 86_400_000

export default function PapanTindakLanjut() {
  const settings = useSettings()
  const toast = useToast()
  const semua = useLiveQuery(() => db.tindakLanjut.toArray(), [], [] as TindakLanjut[])
  const drills = useLiveQuery(() => db.drills.toArray(), [], [])
  const sections = visibleSections()
  const [judul, setJudul] = useState('')
  const [seksiBaru, setSeksiBaru] = useState('')
  const [drillBaru, setDrillBaru] = useState('')
  const [prioBaru, setPrioBaru] = useState(false)
  const [sumber, setSumber] = useState<SumberTindakLanjut | 'semua'>('semua')
  const [seksi, setSeksi] = useState('semua')
  const [drill, setDrill] = useState('')
  const [beresSemua, setBeresSemua] = useState(false)
  const namaDrill = (id?: string) => (id ? drills.find((d) => d.id === id)?.name : undefined)

  const tersaring = useMemo(
    () => saringTindakLanjut(semua, { sumber, seksi, drillId: drill || undefined }),
    [semua, sumber, seksi, drill],
  )
  const kolom = useMemo(() => {
    const batas = Date.now() - JENDELA_BERES
    const out = {} as Record<StatusTindakLanjut, TindakLanjut[]>
    for (const st of URUTAN_STATUS_TL) out[st] = urutkanTindakLanjut(tersaring.filter((t) => t.status === st))
    const beresLama = out.beres.filter((t) => (t.beresAt ?? t.updatedAt) < batas).length
    if (!beresSemua) out.beres = out.beres.filter((t) => (t.beresAt ?? t.updatedAt) >= batas)
    return { ...out, beresLama }
  }, [tersaring, beresSemua])
  const jmlFokus = semua.filter((t) => t.status === 'fokus').length

  async function tambah() {
    const tl = buatTindakLanjut({
      id: uid('tl_'),
      judul,
      sumber: 'staf',
      drillId: drillBaru || undefined,
      seksi: seksiBaru || undefined,
      prioritas: prioBaru ? 'tinggi' : undefined,
    })
    if (!tl) return
    await db.tindakLanjut.put(tl)
    setJudul('')
    setPrioBaru(false)
  }

  async function cetak(unduh: boolean) {
    const { buatLembarFokusCleaningHtml } = await import('../../lib/cleaningCetak')
    const html = buatLembarFokusCleaningHtml({
      namaTim: settings.teamName ?? 'Tim',
      namaDrill: [namaDrill(drill) ?? 'Semua drill & catatan staf', sumber !== 'semua' ? LABEL_SUMBER_TL[sumber] : '', seksi !== 'semua' ? sectionLabel(seksi) : '']
        .filter(Boolean)
        .join(' · '),
      tanggal: new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
      judul: 'Lembar Fokus Latihan & Cleaning',
      tandaiSumber: true,
      daftar: tersaring,
      sections,
    })
    const nama = `fokus-latihan-${todayISO()}.html`
    if (unduh || !printHtml(html)) {
      downloadHtmlFile(html, nama)
      if (!unduh) toast.push('Jendela cetak diblokir — berkas HTML diunduh, buka lalu Ctrl+P.', 'info')
    }
  }

  return (
    <Card className="space-y-3 p-3" data-testid="papan-staf">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">Papan tindak lanjut staf</h2>
          <p className="text-[11px] text-slate-500">Satu daftar untuk catatan cleaning (Drill), komentar Judge Tape (Lomba), & tugas staf.</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" data-testid="papan-cetak" onClick={() => void cetak(false)}>
            Cetak Lembar Fokus A4
          </Button>
          <Button size="sm" variant="ghost" data-testid="papan-unduh" onClick={() => void cetak(true)}>
            Unduh HTML
          </Button>
        </div>
      </div>

      <form
        className="flex min-w-0 flex-wrap items-center gap-1.5"
        onSubmit={(e) => {
          e.preventDefault()
          void tambah()
        }}
      >
        <input
          data-testid="tl-input"
          value={judul}
          onChange={(e) => setJudul(e.target.value)}
          placeholder="mis. Ulang transisi Ballad → Closer, tempo brass terburu"
          className="min-w-0 flex-[1_1_14rem] rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-600"
        />
        <select data-testid="tl-seksi" value={seksiBaru} onChange={(e) => setSeksiBaru(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-1.5 py-1.5 text-xs text-slate-200">
          <option value="">Semua seksi</option>
          {sections.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        {drills.length > 0 && (
          <select data-testid="tl-drill" value={drillBaru} onChange={(e) => setDrillBaru(e.target.value)} className="max-w-[10rem] rounded-lg border border-slate-700 bg-slate-950 px-1.5 py-1.5 text-xs text-slate-200">
            <option value="">Tanpa drill</option>
            {drills.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          data-testid="tl-prioritas"
          aria-pressed={prioBaru}
          onClick={() => setPrioBaru(!prioBaru)}
          title="Prioritas tinggi"
          className={cx('rounded-lg border px-2 py-1.5 text-xs font-bold', prioBaru ? 'border-rose-500 bg-rose-500/20 text-rose-200' : 'border-slate-700 text-slate-500')}
        >
          !
        </button>
        <button type="submit" data-testid="tl-tambah" disabled={!judul.trim()} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">
          + Temuan
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-1.5">
        {SUMBER.map((s) => (
          <button
            key={s}
            type="button"
            data-testid={`papan-sumber-${s}`}
            aria-pressed={sumber === s}
            onClick={() => setSumber(s)}
            className={cx('rounded-full border px-2 py-0.5 text-[11px]', sumber === s ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-200' : 'border-slate-700 text-slate-400')}
          >
            {s === 'semua' ? 'Semua asal' : LABEL_SUMBER_TL[s]} ({s === 'semua' ? semua.length : semua.filter((t) => t.sumber === s).length})
          </button>
        ))}
        <select
          data-testid="papan-seksi"
          aria-label="Saring seksi"
          value={seksi}
          onChange={(e) => setSeksi(e.target.value)}
          className={cx('max-w-[9rem] rounded-full border bg-slate-950/60 px-2 py-0.5 text-[11px] outline-none focus:border-emerald-500', seksi !== 'semua' ? 'border-emerald-500/50 text-emerald-200' : 'border-slate-700 text-slate-400')}
        >
          <option value="semua">Semua seksi</option>
          {sections.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        {drills.length > 0 && (
          <div className="w-40">
            <Select data-testid="papan-drill" value={drill} onChange={(e) => setDrill(e.target.value)}>
              <option value="">Semua drill</option>
              {drills.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>

      {jmlFokus > BATAS_FOKUS && (
        <p data-testid="fokus-berlebih" className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-[12px] text-amber-200">
          {jmlFokus} butir di kolom Fokus — terlalu banyak untuk satu minggu. Pilih {BATAS_FOKUS} yang paling menentukan nilai, kembalikan
          sisanya ke Temuan.
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {URUTAN_STATUS_TL.map((st) => {
          const w = WARNA_STATUS_TL_HEX[st]
          const xs = kolom[st]
          return (
            <section key={st} data-testid={`kolom-${st}`} data-jumlah={xs.length} className="min-w-0 space-y-1.5 rounded-xl border border-slate-800 bg-slate-950/40 p-2">
              <header className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wide" style={{ color: w.garis }}>
                  {st === 'fokus' ? 'Fokus minggu ini' : LABEL_STATUS_TL[st]} · {xs.length}
                </h3>
                {st === 'beres' && kolom.beresLama > 0 && (
                  <button type="button" data-testid="papan-beres-semua" onClick={() => setBeresSemua(!beresSemua)} className="text-[10px] text-slate-500 underline">
                    {beresSemua ? '14 hari terakhir' : `+${kolom.beresLama} lebih lama`}
                  </button>
                )}
              </header>
              <p className="text-[10px] text-slate-500">{PETUNJUK[st]}</p>
              <ul className="space-y-1.5">
                {xs.map((t) => (
                  <KartuTL key={t.id} t={t} namaDrill={namaDrill(t.drillId)} />
                ))}
                {xs.length === 0 && <li className="rounded-lg border border-dashed border-slate-800 px-2 py-3 text-center text-[11px] text-slate-600">Kosong</li>}
              </ul>
            </section>
          )
        })}
      </div>
    </Card>
  )
}

function KartuTL({ t, namaDrill }: { t: TindakLanjut; namaDrill?: string }) {
  const w = WARNA_STATUS_TL_HEX[t.status]
  const i = URUTAN_STATUS_TL.indexOf(t.status)
  const geser = (arah: -1 | 1) => void db.tindakLanjut.put(geserStatusTL(t, arah))
  const konteks = [konteksTL(t), namaDrill, t.seksi ? sectionLabel(t.seksi) : ''].filter(Boolean).join(' · ')
  return (
    <li
      data-testid={`kartu-tl-${t.id}`}
      data-status={t.status}
      data-sumber={t.sumber}
      className="min-w-0 space-y-1 rounded-lg border border-slate-800 bg-slate-900/70 px-2 py-1.5"
      style={{ borderLeft: `3px solid ${w.garis}` }}
    >
      <div className="flex min-w-0 items-start gap-1.5">
        <p className={cx('min-w-0 flex-1 break-words text-xs', t.status === 'beres' ? 'text-slate-500 line-through' : 'text-slate-100')}>
          {t.prioritas === 'tinggi' && <b className="mr-1 text-rose-400">!</b>}
          {t.judul}
        </p>
        <button type="button" data-testid={`tl-hapus-${t.id}`} onClick={() => void db.tindakLanjut.delete(t.id)} className="shrink-0 px-0.5 text-[11px] text-slate-600 hover:text-rose-400" title="Hapus">
          ✕
        </button>
      </div>
      {(konteks || t.catatan) && (
        <p className="break-words text-[10px] text-slate-500">
          {konteks}
          {konteks && t.catatan ? ' · ' : ''}
          {t.catatan}
        </p>
      )}
      <div className="flex items-center gap-1">
        <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-slate-300">{LABEL_SUMBER_TL[t.sumber]}</span>
        <button
          type="button"
          data-testid={`tl-prio-${t.id}`}
          onClick={() => void db.tindakLanjut.put({ ...t, prioritas: t.prioritas === 'tinggi' ? 'normal' : 'tinggi', updatedAt: Date.now() })}
          className={cx('rounded px-1 text-[10px] font-bold', t.prioritas === 'tinggi' ? 'text-rose-400' : 'text-slate-600')}
          title="Prioritas tinggi"
        >
          !
        </button>
        <span className="flex-1" />
        <button
          type="button"
          data-testid={`tl-kiri-${t.id}`}
          disabled={i === 0}
          onClick={() => geser(-1)}
          className="rounded border border-slate-700 px-1.5 text-xs text-slate-300 disabled:opacity-30"
          title={i > 0 ? `Kembalikan ke ${LABEL_STATUS_TL[URUTAN_STATUS_TL[i - 1]]}` : undefined}
        >
          ←
        </button>
        <button
          type="button"
          data-testid={`tl-kanan-${t.id}`}
          disabled={i === URUTAN_STATUS_TL.length - 1}
          onClick={() => geser(1)}
          className="rounded border border-slate-700 px-1.5 text-xs text-slate-300 disabled:opacity-30"
          title={i < URUTAN_STATUS_TL.length - 1 ? `Pindah ke ${LABEL_STATUS_TL[URUTAN_STATUS_TL[i + 1]]}` : undefined}
        >
          →
        </button>
      </div>
    </li>
  )
}
