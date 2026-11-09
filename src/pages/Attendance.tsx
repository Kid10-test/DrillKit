import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { AttendanceRecord, AttendanceStatus, Member, Session } from '../db/types'
import { Avatar } from './Dashboard'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Modal,
  PageHeader,
  Select,
  StatTile,
  useToast,
} from '../components/ui'
import { IconCheck, IconDownload, IconQr, IconSearch } from '../components/Icons'
import AttendanceRecap from './AttendanceRecap'
import { bacaModeNama, cocokCari, namaTampil } from '../lib/namaAnggota'
import { NamaTampil } from '../components/NamaTampil'
import ScanQrModal from '../components/QrScanner'
import { useSettings } from '../hooks/useSettings'
import { aturanUntukSesi, infoSesiProgram, keabsahanIzin, batasLapor } from '../lib/programLatsar'
import type { AturanPelantikan } from '../db/types'

/** #36 — pemantau syarat pelantikan dimuat saat tabnya dibuka. */
const PemantauPelantikan = lazy(() => import('../components/absensi/PemantauPelantikan'))
import {
  sectionLabel,
  STATUS_META,
  cx,
  daysFromToday,
  downloadFile,
  formatDateLong,
  formatTime,
  pct,
  relativeDay,
  sesiMeta,
  toCSV,
  todayISO,
  uid,
  URUTAN_JENIS,
} from '../lib/utils'

const ORDER: AttendanceStatus[] = ['hadir', 'izin', 'sakit', 'alpha']

export default function Attendance() {
  const toast = useToast()
  const members = useLiveQuery(() => db.members.orderBy('name').toArray(), [], [])
  const sessions = useLiveQuery(() => db.sessions.orderBy('date').toArray(), [], [])
  const records = useLiveQuery(() => db.attendance.toArray(), [], [])

  const [sessionId, setSessionId] = useState<string>('')
  /** D3 — saring daftar sesi menurut jenis kegiatan. */
  const [filterJenis, setFilterJenis] = useState<string>('all')
  const [q, setQ] = useState('')
  const [scanOpen, setScanOpen] = useState(false)
  const [historyFor, setHistoryFor] = useState<Member | null>(null)
  const [tab, setTab] = useState<'isi' | 'rekap' | 'pelantikan'>('isi')
  const settings = useSettings()
  const [laporFor, setLaporFor] = useState<AttendanceRecord | null>(null)

  /** D3 — daftar sesi yang lolos penyaring jenis kegiatan. */
  const sesiTampil = useMemo(
    () => (sessions ?? []).filter((s) => filterJenis === 'all' || s.type === filterJenis),
    [sessions, filterJenis],
  )

  /** D3 — sesi terpilih diganti otomatis kalau tidak termasuk penyaring yang aktif. */
  useEffect(() => {
    if (!sessions?.length || !sesiTampil.length) return
    if (sessionId && sesiTampil.some((s) => s.id === sessionId)) return
    const today = todayISO()
    const next =
      sesiTampil.find((s) => s.date === today) ??
      sesiTampil.filter((s) => daysFromToday(s.date) >= 0)[0] ??
      sesiTampil[sesiTampil.length - 1]
    if (next) setSessionId(next.id)
  }, [sesiTampil, sessionId, sessions])

  // Pilih sesi terdekat (hari ini kalau ada) saat data pertama kali muncul.
  useEffect(() => {
    if (sessionId || !sesiTampil.length) return
    const today = todayISO()
    const next = sesiTampil.find((s) => s.date === today) ?? sesiTampil.filter((s) => daysFromToday(s.date) >= 0)[0] ?? sesiTampil[sesiTampil.length - 1]
    if (next) setSessionId(next.id)
  }, [sesiTampil, sessionId])

  const active = (members ?? []).filter((m) => m.active)
  const session = sessions?.find((s) => s.id === sessionId)

  const statusOf = (memberId: string) =>
    (records ?? []).find((r) => r.sessionId === sessionId && r.memberId === memberId)

  const counts = useMemo(() => {
    const c: Record<AttendanceStatus, number> = { hadir: 0, izin: 0, sakit: 0, alpha: 0 }
    for (const r of records ?? []) if (r.sessionId === sessionId) c[r.status]++
    return c
  }, [records, sessionId])

  const filled = counts.hadir + counts.izin + counts.sakit + counts.alpha
  const programSesi = session ? infoSesiProgram(settings.programLatihan, session) : null
  const aturan: AturanPelantikan = aturanUntukSesi(settings.programLatihan, sessionId)
  const adaProgram = (settings.programLatihan ?? []).length > 0
  const rate = pct(counts.hadir, filled)

  const list = active.filter((m) => {
    const s = q.trim().toLowerCase()
    if (!s) return true
    return cocokCari(m, s)
  })

  async function setStatus(memberId: string, status: AttendanceStatus) {
    if (!sessionId) return
    const existing = (records ?? []).find((r) => r.sessionId === sessionId && r.memberId === memberId)
    if (existing?.status === status) {
      await db.attendance.delete(existing.id)
      return
    }
    // #36 — izin/sakit diberi cap jam lapor (bisa diubah); status lain melepasnya.
    const izinSakit = status === 'izin' || status === 'sakit'
    if (existing) {
      const tetapCap = izinSakit && (existing.status === 'izin' || existing.status === 'sakit')
      await db.attendance.update(existing.id, {
        status,
        checkInAt: status === 'hadir' ? Date.now() : existing.checkInAt,
        dilaporAt: izinSakit ? (tetapCap ? existing.dilaporAt : Date.now()) : undefined,
        putusanIzin: tetapCap ? existing.putusanIzin : undefined,
      })
    } else {
      await db.attendance.put({
        id: uid('a_'),
        sessionId,
        memberId,
        status,
        checkInAt: status === 'hadir' ? Date.now() : undefined,
        ...(izinSakit ? { dilaporAt: Date.now() } : {}),
      })
    }
  }

  async function markAllHadir() {
    if (!sessionId) return
    const now = Date.now()
    const existing = new Map((records ?? []).filter((r) => r.sessionId === sessionId).map((r) => [r.memberId, r]))
    const puts = active
      .filter((m) => !existing.has(m.id))
      .map((m) => ({ id: uid('a_'), sessionId, memberId: m.id, status: 'hadir' as AttendanceStatus, checkInAt: now }))
    if (puts.length) await db.attendance.bulkPut(puts)
    toast.push(`${puts.length} anggota ditandai hadir`)
  }

  /**
   * Menandai satu anggota hadir. Mengembalikan id record-nya supaya pemindai
   * QR bisa membatalkannya lagi (tombol "Batalkan" di daftar baru saja masuk).
   */
  async function markHadir(memberId: string): Promise<string> {
    if (!sessionId) return ''
    const existing = (records ?? []).find((r) => r.sessionId === sessionId && r.memberId === memberId)
    if (existing) {
      await db.attendance.update(existing.id, { status: 'hadir', checkInAt: Date.now() })
      return existing.id
    }
    const id = uid('a_')
    await db.attendance.put({ id, sessionId, memberId, status: 'hadir', checkInAt: Date.now() })
    return id
  }

  /** Membatalkan satu hasil pindai (hapus record absensinya). */
  async function undoScan(recordId: string) {
    await db.attendance.delete(recordId)
  }

  function exportCSV() {
    if (!session) return
    const rows: unknown[][] = [
      ['Sesi', 'Tanggal', 'Kode', 'Nama', 'Section', 'Status', 'Jam masuk'],
      ...active.map((m) => {
        const r = statusOf(m.id)
        return [
          session.title,
          session.date,
          m.code,
          m.name,
          sectionLabel(m.section),
          r ? STATUS_META[r.status].label : 'Belum diisi',
          r?.checkInAt ? formatTime(r.checkInAt) : '',
        ]
      }),
    ]
    downloadFile(`absensi-${session.date}-${session.title.slice(0, 20)}.csv`, toCSV(rows), 'text/csv')
  }

  return (
    <div>
      <PageHeader
        title="Absensi"
        subtitle={session ? `${session.title} · ${formatDateLong(session.date)}` : 'Pilih sesi latihan'}
        actions={
          tab === 'isi' ? (
            <>
              <Button onClick={() => setScanOpen(true)}>
                <IconQr size={16} /> Scan QR
              </Button>
              <Button onClick={exportCSV} disabled={!session}>
                <IconDownload size={16} /> Ekspor
              </Button>
            </>
          ) : undefined
        }
      />

      <div className="mb-4 flex gap-1 rounded-lg border border-slate-800 bg-slate-900/50 p-1">
        {(
          [
            ['isi', 'Isi absensi'],
            ['rekap', 'Rekap'],
            ...(adaProgram ? ([['pelantikan', 'Syarat pelantikan']] as const) : []),
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            data-kiosk-allow
            data-testid={`tab-absensi-${id}`}
            onClick={() => setTab(id)}
            className={cx(
              'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition',
              tab === id ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-100',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'rekap' && (
        <AttendanceRecap
          members={(members ?? []).filter((m) => m.active)}
          sessions={sessions ?? []}
          records={records ?? []}
        />
      )}
      {tab === 'pelantikan' && (
        <Suspense fallback={<p className="text-sm text-slate-500">Memuat…</p>}>
          <PemantauPelantikan />
        </Suspense>
      )}

{tab === 'isi' && (
      <>
      <Card className="mb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-400">Sesi</label>
            <Select data-kiosk-allow value={sessionId} onChange={(e) => setSessionId(e.target.value)}>
              {sesiTampil.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.date} — {s.title} ({relativeDay(s.date)})
                </option>
              ))}
            </Select>
            {session && (
              <span
                data-testid="badge-jenis-sesi"
                className={`mt-2 inline-block rounded-full border px-2 py-0.5 text-[11px] font-medium ${sesiMeta(session.type).color}`}
              >
                {sesiMeta(session.type).label}
              </span>
            )}
          </div>
          <div className="sm:w-48">
            <label className="mb-1 block text-xs font-medium text-slate-400">Jenis kegiatan</label>
            <Select
              data-testid="saring-jenis-absensi"
              data-kiosk-allow
              value={filterJenis}
              onChange={(e) => setFilterJenis(e.target.value)}
            >
              <option value="all">Semua jenis</option>
              {URUTAN_JENIS.map((t) =>
                (sessions ?? []).some((s) => s.type === t) ? (
                  <option key={t} value={t}>
                    {sesiMeta(t).label}
                  </option>
                ) : null,
              )}
            </Select>
          </div>
          <div className="relative flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-400">Cari anggota</label>
            <div className="relative">
              <IconSearch size={16} className="absolute left-3 top-2.5 text-slate-500" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Nama atau kode…"
                className="w-full rounded-lg border border-slate-700 bg-slate-950/60 py-2 pl-9 pr-3 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        </div>
        {programSesi && (
          <p data-testid="info-sesi-program" className="mt-2 text-[11px] text-slate-400">
            <b className="text-slate-200">{programSesi.program.nama}</b>
            {programSesi.fase ? ` · ${programSesi.fase.nama}` : ''}
            {programSesi.wajib ? ` · sesi wajib ${programSesi.urutWajib}/${programSesi.program.wajibIds.length}` : ' · tidak dihitung untuk pelantikan'}
            {' — '}izin sah bila tertulis sebelum {session?.startTime}; sakit dilaporkan paling lambat {aturan.sakitMaksJam} jam sesudahnya.
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="primary" onClick={markAllHadir}>
            Tandai semua hadir
          </Button>
          <span className="text-xs text-slate-500 self-center">
            {filled}/{active.length} terisi · kehadiran {rate}%
          </span>
        </div>
      </Card>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {ORDER.map((s) => (
          <StatTile
            key={s}
            label={STATUS_META[s].label}
            value={counts[s]}
            accent={
              s === 'hadir'
                ? 'text-emerald-400'
                : s === 'alpha'
                  ? 'text-rose-400'
                  : 'text-amber-400'
            }
          />
        ))}
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={<IconCheck size={30} />}
          title="Belum ada anggota aktif"
          desc="Tambahkan anggota dulu di menu Anggota."
        />
      ) : (
        <Card padded={false}>
          <ul className="divide-y divide-slate-800/70">
            {list.map((m) => {
              const r = statusOf(m.id)
              return (
                <li key={m.id} className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
                  <button onClick={() => setHistoryFor(m)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                    <Avatar m={m} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-sm font-medium text-slate-100"><NamaTampil anggota={m} /></p>
                        <span className="shrink-0 text-[10px] text-slate-500">{m.code}</span>
                      </div>
                      <p className="truncate text-xs text-slate-500">
                        {sectionLabel(m.section)} · {m.instrument}
                      </p>
                    </div>
                  </button>
                  {r && session && (r.status === 'izin' || r.status === 'sakit') && (
                    <ChipLapor r={r} session={session} aturan={aturan} onClick={() => setLaporFor(r)} />
                  )}
                  <div className="flex shrink-0 gap-1">
                    {ORDER.map((s) => {
                      const on = r?.status === s
                      return (
                        <button
                          key={s}
                          data-testid={`absen-${m.id}-${s}`}
                          onClick={() => setStatus(m.id, s)}
                          title={STATUS_META[s].label}
                          className={cx(
                            'h-8 w-8 rounded-lg border text-xs font-bold transition active:scale-95',
                            on
                              ? s === 'hadir'
                                ? 'border-emerald-500 bg-emerald-500 text-slate-950'
                                : s === 'izin'
                                  ? 'border-sky-500 bg-sky-500 text-slate-950'
                                  : s === 'sakit'
                                    ? 'border-amber-500 bg-amber-500 text-slate-950'
                                    : 'border-rose-500 bg-rose-500 text-white'
                              : 'border-slate-700 bg-slate-900 text-slate-400 hover:bg-slate-800',
                          )}
                        >
                          {STATUS_META[s].short}
                        </button>
                      )
                    })}
                  </div>
                </li>
              )
            })}
          </ul>
        </Card>
      )}
      </>
    )}

      <ScanQrModal
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        members={members ?? []}
        records={records ?? []}
        sessionId={sessionId}
        sessionTitle={session?.title}
        hadirCount={counts.hadir}
        totalActive={active.length}
        onMark={markHadir}
        onUndo={undoScan}
      />

      <HistoryModal member={historyFor} onClose={() => setHistoryFor(null)} sessions={sessions ?? []} />
      <LaporIzinModal
        rec={laporFor}
        session={session}
        aturan={aturan}
        nama={laporFor ? namaTampil(active.find((m) => m.id === laporFor.memberId) ?? { name: '' }, bacaModeNama()) : ''}
        onClose={() => setLaporFor(null)}
      />
    </div>
  )
}

/* ---------------------------- Riwayat anggota ------------------------------ */

function HistoryModal({
  member,
  onClose,
  sessions,
}: {
  member: Member | null
  onClose: () => void
  sessions: Session[]
}) {
  const records = useLiveQuery(
    async (): Promise<AttendanceRecord[]> =>
      member ? db.attendance.where('memberId').equals(member.id).toArray() : [],
    [member?.id],
    [] as AttendanceRecord[],
  )
  if (!member) return null
  const total = records.length
  const hadir = records.filter((r) => r.status === 'hadir').length

  return (
    <Modal open={!!member} onClose={onClose} title={`Riwayat — ${namaTampil(member, bacaModeNama())}`}>
      <p className="text-sm text-slate-400">
        Kehadiran: <span className="font-semibold text-emerald-400">{pct(hadir, total)}%</span> ({hadir} dari{' '}
        {total} sesi)
      </p>
      <div className="max-h-72 space-y-1 overflow-y-auto">
        {sessions
          .filter((s) => records.some((r) => r.sessionId === s.id))
          .reverse()
          .map((s) => {
            const r = records.find((x) => x.sessionId === s.id)!
            return (
              <div key={s.id} className="flex items-center justify-between rounded-lg border border-slate-800 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-slate-200">{s.title}</p>
                  <p className="text-[11px] text-slate-500">{s.date}</p>
                </div>
                <Badge className={STATUS_META[r.status].color}>{STATUS_META[r.status].label}</Badge>
              </div>
            )
          })}
      </div>
      <div className="flex justify-end">
        <Button variant="ghost" onClick={onClose}>
          Tutup
        </Button>
      </div>
    </Modal>
  )
}

/* ------------------------ #36 — cap jam lapor izin/sakit ------------------------ */

const dua = (n: number) => String(n).padStart(2, '0')
function keLokal(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${dua(d.getMonth() + 1)}-${dua(d.getDate())}T${dua(d.getHours())}:${dua(d.getMinutes())}`
}
function jamPendek(ms: number, sesiTanggal: string): string {
  const d = new Date(ms)
  const iso = `${d.getFullYear()}-${dua(d.getMonth() + 1)}-${dua(d.getDate())}`
  const jam = `${dua(d.getHours())}.${dua(d.getMinutes())}`
  return iso === sesiTanggal ? jam : `${d.getDate()}/${d.getMonth() + 1} ${jam}`
}

function ChipLapor({
  r,
  session,
  aturan,
  onClick,
}: {
  r: AttendanceRecord
  session: Session
  aturan: AturanPelantikan
  onClick: () => void
}) {
  const k = keabsahanIzin(r, session, aturan)
  const warna =
    k === 'sah' ? 'border-emerald-500/40 text-emerald-300' : k === 'telat' ? 'border-rose-500/50 text-rose-300' : 'border-amber-500/50 text-amber-300'
  const teks =
    k === 'tanpa-cap'
      ? 'jam lapor?'
      : `${r.dilaporAt ? jamPendek(r.dilaporAt, session.date) : ''}${r.putusanIzin ? ' · putusan' : ''} · ${k === 'sah' ? 'sah' : 'tidak sah'}`
  return (
    <button
      type="button"
      data-testid={`lapor-${r.memberId}`}
      data-sah={k ?? ''}
      onClick={onClick}
      title="Jam lapor izin/sakit — ketuk untuk mengubah"
      className={cx('shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium', warna)}
    >
      {teks}
    </button>
  )
}

function LaporIzinModal({
  rec,
  session,
  aturan,
  nama,
  onClose,
}: {
  rec: AttendanceRecord | null
  session: Session | undefined
  aturan: AturanPelantikan
  nama: string
  onClose: () => void
}) {
  const [waktu, setWaktu] = useState('')
  const [putusan, setPutusan] = useState<'' | 'sah' | 'tidak-sah'>('')
  const [catatan, setCatatan] = useState('')
  useEffect(() => {
    if (!rec) return
    setWaktu(rec.dilaporAt ? keLokal(rec.dilaporAt) : '')
    setPutusan(rec.putusanIzin ?? '')
    setCatatan(rec.note ?? '')
  }, [rec])
  if (!rec || !session || (rec.status !== 'izin' && rec.status !== 'sakit')) return null
  const ms = waktu ? new Date(waktu).getTime() : undefined
  const uji = { ...rec, dilaporAt: Number.isFinite(ms) ? ms : undefined, putusanIzin: putusan || undefined }
  const k = keabsahanIzin(uji, session, aturan)
  const batas = batasLapor(rec.status, session, aturan)

  async function simpan() {
    if (!rec) return
    await db.attendance.update(rec.id, {
      dilaporAt: uji.dilaporAt,
      putusanIzin: putusan || undefined,
      note: catatan.trim() || undefined,
    })
    onClose()
  }

  return (
    <Modal open={!!rec} onClose={onClose} title={`${rec.status === 'izin' ? 'Izin' : 'Sakit'} — ${nama}`} testId="modal-lapor-izin">
      <p className="text-[12px] text-slate-400">
        Isi jam pesan izin/sakit <b className="text-slate-200">diterima</b> (mis. jam pesan WA), bukan jam mencatat.{' '}
        {rec.status === 'izin'
          ? `Izin sah bila tertulis sebelum ${session.startTime} pada hari sesi.`
          : `Sakit sah bila dilaporkan paling lambat ${aturan.sakitMaksJam} jam sesudah sesi mulai (${jamPendek(batas, session.date)}).`}
      </p>
      <label className="block text-[11px] text-slate-400">
        Dilaporkan pada
        <input
          type="datetime-local"
          data-testid="lapor-waktu"
          value={waktu}
          onChange={(e) => setWaktu(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500"
        />
      </label>
      <div className="flex flex-wrap gap-1.5">
        <Button size="sm" data-testid="lapor-sekarang" onClick={() => setWaktu(keLokal(Date.now()))}>
          Sekarang
        </Button>
        <Button size="sm" variant="ghost" data-testid="lapor-hapus" onClick={() => setWaktu('')}>
          Kosongkan
        </Button>
      </div>
      <label className="block text-[11px] text-slate-400">
        Keputusan
        <Select data-testid="lapor-putusan" value={putusan} onChange={(e) => setPutusan(e.target.value as '' | 'sah' | 'tidak-sah')}>
          <option value="">Otomatis menurut jam lapor</option>
          <option value="sah">Sah — keputusan pelatih (izin jelas & bertanggung jawab)</option>
          <option value="tidak-sah">Tidak sah — dihitung tanpa keterangan</option>
        </Select>
      </label>
      <label className="block text-[11px] text-slate-400">
        Alasan / catatan
        <input
          data-testid="lapor-catatan"
          value={catatan}
          onChange={(e) => setCatatan(e.target.value)}
          placeholder="mis. acara keluarga, surat dari orang tua"
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500"
        />
      </label>
      <p
        data-testid="lapor-hasil"
        className={cx('text-sm font-medium', k === 'sah' ? 'text-emerald-300' : k === 'telat' ? 'text-rose-300' : 'text-amber-300')}
      >
        {k === 'sah'
          ? 'Sah — tidak mengurangi jatah'
          : k === 'telat'
            ? 'Tidak sah — dihitung tanpa keterangan'
            : 'Belum ada jam lapor — dihitung tanpa keterangan sampai diisi'}
      </p>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Batal
        </Button>
        <Button variant="primary" data-testid="lapor-simpan" onClick={simpan}>
          Simpan
        </Button>
      </div>
    </Modal>
  )
}
