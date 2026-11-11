import { Suspense, lazy, useEffect, useMemo, useState, type ReactNode } from 'react'
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
import { IconCheck, IconDownload, IconQr, IconSearch, IconUpload } from '../components/Icons'
import AttendanceRecap from './AttendanceRecap'
import { bacaModeNama, cocokCari, namaTampil } from '../lib/namaAnggota'
import { NamaTampil } from '../components/NamaTampil'
import ScanQrModal from '../components/QrScanner'
import { useSettings } from '../hooks/useSettings'
import {
  LABEL_DATANG,
  aturanUntukSesi,
  batasLapor,
  infoSesiProgram,
  jendelaDatang,
  kategoriIzin,
  keabsahanIzin,
  sesiBerForm,
  statusDatang,
  type AturanLengkap,
  type KeabsahanIzin,
} from '../lib/programLatsar'

/** #36 — pemantau syarat pelantikan dimuat saat tabnya dibuka. */
const PemantauPelantikan = lazy(() => import('../components/absensi/PemantauPelantikan'))
/** v2.8 — impor CSV jawaban Google Form (presensi / izin / absen fisik). */
const ImporGFormModal = lazy(() => import('../components/absensi/ImporGFormModal'))
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
  const [datangFor, setDatangFor] = useState<AttendanceRecord | null>(null)
  const [imporOpen, setImporOpen] = useState(false)

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
  const aturan: AturanLengkap = aturanUntukSesi(settings.programLatihan, sessionId)
  const adaForm = !!session && aturan.wajibForm && sesiBerForm(session)
  const jendela = session ? jendelaDatang(session, aturan) : null
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
    // v2.8 — kategori & bukti izin hanya ikut berpindah antar izin↔sakit;
    // jam datang & alasan telat hanya milik catatan hadir.
    const izinSakit = status === 'izin' || status === 'sakit'
    if (existing) {
      const tetapCap = izinSakit && (existing.status === 'izin' || existing.status === 'sakit')
      await db.attendance.update(existing.id, {
        status,
        checkInAt: status === 'hadir' ? Date.now() : existing.checkInAt,
        dilaporAt: izinSakit ? (tetapCap ? existing.dilaporAt : Date.now()) : undefined,
        putusanIzin: tetapCap ? existing.putusanIzin : undefined,
        kategoriIzin: tetapCap ? existing.kategoriIzin : undefined,
        bukti: tetapCap ? existing.bukti : undefined,
        datangAt: undefined,
        alasanTelat: undefined,
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
      const dariIzin = existing.status === 'izin' || existing.status === 'sakit'
      await db.attendance.update(existing.id, {
        status: 'hadir',
        checkInAt: Date.now(),
        // v2.8 — sisa data izin (jam lapor, kategori, bukti, putusan) tidak ikut ke catatan hadir.
        ...(dariIzin ? { dilaporAt: undefined, kategoriIzin: undefined, bukti: undefined, putusanIzin: undefined } : {}),
      })
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
      ['Sesi', 'Tanggal', 'Kode', 'Nama', 'Section', 'Status', 'Jam masuk', 'Jam datang', 'Alasan telat', 'Kategori izin', 'Bukti', 'Google Form'],
      ...active.map((m) => {
        const r = statusOf(m.id)
        const form = session.formPresensi?.[m.id]
        return [
          session.title,
          session.date,
          m.code,
          m.name,
          sectionLabel(m.section),
          r ? STATUS_META[r.status].label : 'Belum diisi',
          r?.checkInAt ? formatTime(r.checkInAt) : '',
          r?.datangAt ? formatTime(r.datangAt) : '',
          r?.alasanTelat ?? '',
          r?.kategoriIzin ? (kategoriIzin(aturan, r.kategoriIzin)?.nama ?? 'Di luar daftar') : '',
          r?.bukti ?? '',
          form ? formatTime(form) : '',
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
              <Button data-testid="buka-impor-gform" onClick={() => setImporOpen(true)} disabled={!sessions?.length}>
                <IconUpload size={16} /> Impor Form
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
            {' — '}datang ≤ {jendela ? jamTitik(jendela.tepat) : ''} hadir, s.d. {jendela ? jamTitik(jendela.batasJatah) : ''} beralasan
            {aturan.wajibBukti ? ' + bukti' : ''} memakai jatah telat · izin sebelum {aturan.batasIzin ? aturan.batasIzin.replace(':', '.') : session?.startTime}
            {aturan.wajibBukti ? ' + bukti' : ''} · sakit ≤ {aturan.sakitMaksJam} jam
            {adaForm ? ` · Google Form: ${Object.keys(session?.formPresensi ?? {}).length} isian` : ''}.
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
                <li key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 sm:flex-nowrap sm:px-4">
                  <button onClick={() => setHistoryFor(m)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                    <Avatar m={m} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-sm font-medium text-slate-100"><NamaTampil anggota={m} /></p>
                        <span className="hidden shrink-0 text-[10px] text-slate-500 sm:inline">{m.code}</span>
                      </div>
                      <p className="truncate text-xs text-slate-500">
                        {sectionLabel(m.section)} · {m.instrument}
                        {session?.formPresensi?.[m.id] ? (
                          <span data-testid={`form-${m.id}`} className="text-emerald-400/80">
                            {' '}
                            · Form ✓
                          </span>
                        ) : null}
                      </p>
                    </div>
                  </button>
                  {r && session && (r.status === 'izin' || r.status === 'sakit') && (
                    <BarisChip>
                      <ChipLapor r={r} session={session} aturan={aturan} onClick={() => setLaporFor(r)} />
                    </BarisChip>
                  )}
                  {r && session && r.status === 'hadir' && (() => {
                    const tanpaForm = adaForm && !session.formPresensi?.[m.id]
                    const chip = <ChipDatang r={r} session={session} aturan={aturan} tanpaForm={tanpaForm} onClick={() => setDatangFor(r)} />
                    // Chip kosong ("jam") tetap sebaris; chip berisi info turun ke baris kedua di HP.
                    return r.datangAt != null || tanpaForm ? <BarisChip>{chip}</BarisChip> : chip
                  })()}
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
      <DatangModal
        rec={datangFor}
        session={session}
        aturan={aturan}
        nama={datangFor ? namaTampil(active.find((m) => m.id === datangFor.memberId) ?? { name: '' }, bacaModeNama()) : ''}
        onClose={() => setDatangFor(null)}
      />
      {imporOpen && (
        <Suspense fallback={null}>
          <ImporGFormModal
            open={imporOpen}
            onClose={() => setImporOpen(false)}
            members={members ?? []}
            sessions={sessions ?? []}
            records={records ?? []}
            sesiAwal={sessionId}
            program={settings.programLatihan ?? []}
          />
        </Suspense>
      )}
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

/** "18.30" */
function jamTitik(ms: number): string {
  const d = new Date(ms)
  return `${dua(d.getHours())}.${dua(d.getMinutes())}`
}

const TEKS_KEABSAHAN: Record<KeabsahanIzin, string> = {
  sah: 'sah',
  telat: 'lapor terlambat',
  'tanpa-cap': 'jam lapor?',
  'tanpa-bukti': 'bukti?',
  ditolak: 'tidak diterima',
}

function ChipLapor({
  r,
  session,
  aturan,
  onClick,
}: {
  r: AttendanceRecord
  session: Session
  aturan: AturanLengkap
  onClick: () => void
}) {
  const k = keabsahanIzin(r, session, aturan)
  const warna =
    k === 'sah'
      ? 'border-emerald-500/40 text-emerald-300'
      : k === 'telat' || k === 'ditolak'
        ? 'border-rose-500/50 text-rose-300'
        : 'border-amber-500/50 text-amber-300'
  const kat = r.kategoriIzin ? (kategoriIzin(aturan, r.kategoriIzin)?.nama ?? 'di luar daftar') : ''
  const teks =
    k === 'tanpa-cap'
      ? 'jam lapor?'
      : `${r.dilaporAt ? jamPendek(r.dilaporAt, session.date) : ''}${r.putusanIzin ? ' · putusan' : ''} · ${k ? TEKS_KEABSAHAN[k] : ''}`
  return (
    <button
      type="button"
      data-testid={`lapor-${r.memberId}`}
      data-sah={k ?? ''}
      onClick={onClick}
      title={`${kat ? `${kat} — ` : ''}jam lapor, kategori & bukti izin/sakit — ketuk untuk mengubah`}
      className={cx('max-w-[9rem] shrink-0 truncate rounded-full border px-2 py-0.5 text-[10px] font-medium', warna)}
    >
      {teks}
    </button>
  )
}

/** v2.8 — di HP chip berinfo turun ke baris kedua (rata kanan) agar nama tidak terhimpit. */
function BarisChip({ children }: { children: ReactNode }) {
  return <div className="order-last flex basis-full justify-end sm:order-none sm:basis-auto">{children}</div>
}

/** v2.8 — chip jam datang pada catatan hadir: tepat / telat berjatah / tidak dihitung / tanpa Form. */
function ChipDatang({
  r,
  session,
  aturan,
  tanpaForm,
  onClick,
}: {
  r: AttendanceRecord
  session: Session
  aturan: AturanLengkap
  tanpaForm: boolean
  onClick: () => void
}) {
  const d = statusDatang(r, session, aturan)
  const telat = d != null && d !== 'tepat'
  const dihitung = d === 'jatah' || d === 'putusan-sah'
  const kelas = tanpaForm
    ? 'border-rose-500/50 text-rose-300'
    : !telat
      ? d === 'tepat'
        ? 'border-emerald-500/30 text-emerald-300/80'
        : 'border-slate-700 text-slate-500'
      : dihitung
        ? 'border-teal-500/50 text-teal-300'
        : 'border-orange-500/50 text-orange-300'
  const teks = [
    r.datangAt ? jamPendek(r.datangAt, session.date) : 'jam',
    telat ? (dihitung ? (d === 'jatah' ? 'jatah telat' : 'putusan') : 'tak dihitung') : '',
    tanpaForm ? 'tanpa Form' : '',
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <button
      type="button"
      data-testid={`datang-${r.memberId}`}
      data-datang={d ?? ''}
      data-form={tanpaForm ? 'tanpa' : ''}
      onClick={onClick}
      title={`Jam datang${d ? ` — ${LABEL_DATANG[d]}` : ' belum dicatat (dianggap tepat waktu)'}${tanpaForm ? ' · belum mengisi Google Form presensi' : ''} — ketuk untuk mengubah`}
      className={cx('max-w-[9rem] shrink-0 truncate rounded-full border py-0.5 text-[10px] font-medium', r.datangAt == null && !tanpaForm ? 'px-1.5' : 'px-2', kelas)}
    >
      {teks}
    </button>
  )
}

/** v2.8 — bukti: centang "sudah diterima" (mis. lewat WA) dan/atau tautan berkas. */
function IsianBukti({
  ada,
  tautan,
  onAda,
  onTautan,
  wajib,
  petunjuk,
}: {
  ada: boolean
  tautan: string
  onAda: (v: boolean) => void
  onTautan: (v: string) => void
  wajib: boolean
  petunjuk?: string
}) {
  return (
    <div className="space-y-1">
      <label className="flex items-center gap-1.5 text-[12px] text-slate-300">
        <input type="checkbox" data-testid="bukti-ada" checked={ada} onChange={(e) => onAda(e.target.checked)} />
        Bukti sudah diterima{wajib ? ' (wajib)' : ''}
        {petunjuk ? <span className="text-slate-500"> — {petunjuk}</span> : null}
      </label>
      <input
        data-testid="bukti-tautan"
        value={tautan}
        onChange={(e) => onTautan(e.target.value)}
        placeholder="Tautan bukti (opsional, mis. berkas Google Form)"
        className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-1.5 text-[12px] text-slate-100 outline-none focus:border-emerald-500"
      />
    </div>
  )
}

const buktiDari = (ada: boolean, tautan: string) => (ada ? tautan.trim() || 'ada' : undefined)

function LaporIzinModal({
  rec,
  session,
  aturan,
  nama,
  onClose,
}: {
  rec: AttendanceRecord | null
  session: Session | undefined
  aturan: AturanLengkap
  nama: string
  onClose: () => void
}) {
  const [waktu, setWaktu] = useState('')
  const [putusan, setPutusan] = useState<'' | 'sah' | 'tidak-sah'>('')
  const [catatan, setCatatan] = useState('')
  const [kategori, setKategori] = useState('')
  const [buktiAda, setBuktiAda] = useState(false)
  const [tautan, setTautan] = useState('')
  useEffect(() => {
    if (!rec) return
    setWaktu(rec.dilaporAt ? keLokal(rec.dilaporAt) : '')
    setPutusan(rec.putusanIzin ?? '')
    setCatatan(rec.note ?? '')
    setKategori(rec.kategoriIzin ?? (rec.status === 'sakit' && kategoriIzin(aturan, 'sakit') ? 'sakit' : ''))
    setBuktiAda(!!rec.bukti)
    setTautan(rec.bukti && rec.bukti !== 'ada' ? rec.bukti : '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rec])
  if (!rec || !session || (rec.status !== 'izin' && rec.status !== 'sakit')) return null
  const ms = waktu ? new Date(waktu).getTime() : undefined
  const uji = {
    ...rec,
    dilaporAt: Number.isFinite(ms) ? ms : undefined,
    putusanIzin: putusan || undefined,
    kategoriIzin: kategori || undefined,
    bukti: buktiDari(buktiAda, tautan),
  }
  const k = keabsahanIzin(uji, session, aturan)
  const batas = batasLapor(rec.status, session, aturan)
  const kat = kategoriIzin(aturan, kategori)

  async function simpan() {
    if (!rec) return
    await db.attendance.update(rec.id, {
      dilaporAt: uji.dilaporAt,
      putusanIzin: uji.putusanIzin,
      kategoriIzin: uji.kategoriIzin,
      bukti: uji.bukti,
      note: catatan.trim() || undefined,
    })
    onClose()
  }

  return (
    <Modal open={!!rec} onClose={onClose} title={`${rec.status === 'izin' ? 'Izin' : 'Sakit'} — ${nama}`} testId="modal-lapor-izin">
      <p className="text-[12px] text-slate-400">
        Isi jam pesan izin/sakit <b className="text-slate-200">diterima</b> (mis. cap waktu Google Form / jam pesan WA), bukan jam mencatat.{' '}
        {rec.status === 'izin'
          ? `Izin sah bila dilaporkan sebelum ${jamPendek(batas, session.date)} pada hari sesi.`
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
        Kategori
        <Select data-testid="lapor-kategori" value={kategori} onChange={(e) => setKategori(e.target.value)}>
          <option value="">— belum dipilih —</option>
          {aturan.kategoriIzin.map((x) => (
            <option key={x.id} value={x.id}>
              {x.nama}
            </option>
          ))}
          <option value="lain">Di luar daftar (tidak diterima)</option>
        </Select>
      </label>
      <IsianBukti
        ada={buktiAda}
        tautan={tautan}
        onAda={(v) => {
          setBuktiAda(v)
          if (!v) setTautan('')
        }}
        onTautan={(v) => {
          setTautan(v)
          if (v.trim()) setBuktiAda(true)
        }}
        wajib={aturan.wajibBukti}
        petunjuk={kat?.bukti}
      />
      <label className="block text-[11px] text-slate-400">
        Keputusan
        <Select data-testid="lapor-putusan" value={putusan} onChange={(e) => setPutusan(e.target.value as '' | 'sah' | 'tidak-sah')}>
          <option value="">Otomatis menurut aturan</option>
          <option value="sah">Sah — keputusan pelatih (izin jelas & bertanggung jawab)</option>
          <option value="tidak-sah">Tidak sah — dihitung alpa</option>
        </Select>
      </label>
      <label className="block text-[11px] text-slate-400">
        Alasan / catatan
        <input
          data-testid="lapor-catatan"
          value={catatan}
          onChange={(e) => setCatatan(e.target.value)}
          placeholder="mis. praktikum Kimia Dasar sampai 19.00"
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500"
        />
      </label>
      <p
        data-testid="lapor-hasil"
        className={cx('text-sm font-medium', k === 'sah' ? 'text-emerald-300' : k === 'telat' || k === 'ditolak' ? 'text-rose-300' : 'text-amber-300')}
      >
        {k === 'sah'
          ? 'Sah — tidak memakai jatah alpa'
          : k === 'telat'
            ? 'Tidak sah (lapor terlambat) — dihitung alpa'
            : k === 'ditolak'
              ? 'Tidak diterima — dihitung alpa'
              : k === 'tanpa-bukti'
                ? 'Bukti belum diterima — dihitung alpa sampai buktinya masuk'
                : 'Belum ada jam lapor — dihitung alpa sampai diisi'}
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

/** v2.8 — jam datang + alasan telat + bukti untuk satu catatan hadir. */
function DatangModal({
  rec,
  session,
  aturan,
  nama,
  onClose,
}: {
  rec: AttendanceRecord | null
  session: Session | undefined
  aturan: AturanLengkap
  nama: string
  onClose: () => void
}) {
  const [jam, setJam] = useState('')
  const [alasan, setAlasan] = useState('')
  const [buktiAda, setBuktiAda] = useState(false)
  const [tautan, setTautan] = useState('')
  const [putusan, setPutusan] = useState<'' | 'sah' | 'tidak-sah'>('')
  useEffect(() => {
    if (!rec) return
    setJam(rec.datangAt ? jamTitik(rec.datangAt).replace('.', ':') : '')
    setAlasan(rec.alasanTelat ?? '')
    setBuktiAda(!!rec.bukti)
    setTautan(rec.bukti && rec.bukti !== 'ada' ? rec.bukti : '')
    setPutusan(rec.putusanIzin ?? '')
  }, [rec])
  if (!rec || !session || rec.status !== 'hadir') return null
  const j = jendelaDatang(session, aturan)
  const datangAt = jam ? new Date(`${session.date}T${jam}`).getTime() : undefined
  const uji = {
    ...rec,
    datangAt: Number.isFinite(datangAt) ? datangAt : undefined,
    alasanTelat: alasan.trim() || undefined,
    bukti: buktiDari(buktiAda, tautan),
    putusanIzin: putusan || undefined,
  }
  const d = statusDatang(uji, session, aturan)
  const formOk = !(aturan.wajibForm && sesiBerForm(session)) || !!session.formPresensi?.[rec.memberId]

  async function simpan() {
    if (!rec) return
    await db.attendance.update(rec.id, {
      datangAt: uji.datangAt,
      alasanTelat: uji.alasanTelat,
      bukti: uji.bukti,
      putusanIzin: uji.putusanIzin,
    })
    onClose()
  }

  const sekarang = () => {
    const n = new Date()
    setJam(`${dua(n.getHours())}:${dua(n.getMinutes())}`)
  }

  return (
    <Modal open={!!rec} onClose={onClose} title={`Jam datang — ${nama}`} testId="modal-datang">
      <p className="text-[12px] text-slate-400">
        Datang ≤ <b className="text-slate-200">{jamTitik(j.tepat)}</b> = hadir. Sampai <b className="text-slate-200">{jamTitik(j.batasJatah)}</b> dengan
        alasan{aturan.wajibBukti ? ' + bukti' : ''} = hadir memakai jatah telat (selama jatahnya masih ada). Lewat dari itu tetap boleh ikut latihan,
        tetapi tidak dihitung hadir — kalau alasannya termasuk izin sah, catat sebagai <b>Izin</b>. Kosongkan jam bila datang tepat waktu.
      </p>
      <label className="block text-[11px] text-slate-400">
        Jam datang
        <input
          type="time"
          data-testid="datang-jam"
          value={jam}
          onChange={(e) => setJam(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500"
        />
      </label>
      <div className="flex flex-wrap gap-1.5">
        <Button size="sm" data-testid="datang-sekarang" onClick={sekarang}>
          Sekarang
        </Button>
        <Button size="sm" variant="ghost" data-testid="datang-hapus" onClick={() => setJam('')}>
          Kosongkan (tepat waktu)
        </Button>
      </div>
      <label className="block text-[11px] text-slate-400">
        Alasan telat
        <input
          data-testid="datang-alasan"
          value={alasan}
          onChange={(e) => setAlasan(e.target.value)}
          placeholder="mis. kelas pengganti sampai 18.15"
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500"
        />
      </label>
      <IsianBukti
        ada={buktiAda}
        tautan={tautan}
        onAda={(v) => {
          setBuktiAda(v)
          if (!v) setTautan('')
        }}
        onTautan={(v) => {
          setTautan(v)
          if (v.trim()) setBuktiAda(true)
        }}
        wajib={aturan.wajibBukti}
      />
      <label className="block text-[11px] text-slate-400">
        Keputusan
        <Select data-testid="datang-putusan" value={putusan} onChange={(e) => setPutusan(e.target.value as '' | 'sah' | 'tidak-sah')}>
          <option value="">Otomatis menurut aturan</option>
          <option value="sah">Dihitung hadir — keputusan pelatih</option>
          <option value="tidak-sah">Tidak dihitung hadir</option>
        </Select>
      </label>
      <p
        data-testid="datang-hasil"
        className={cx(
          'text-sm font-medium',
          !formOk ? 'text-rose-300' : d == null || d === 'tepat' || d === 'putusan-sah' ? 'text-emerald-300' : d === 'jatah' ? 'text-teal-300' : 'text-orange-300',
        )}
      >
        {!formOk
          ? 'Belum mengisi Google Form presensi — dihitung alpa (kecuali keputusan pelatih “dihitung hadir”)'
          : d == null || d === 'tepat'
            ? 'Hadir tepat waktu'
            : d === 'jatah'
              ? 'Telat berjatah — dihitung hadir bila jatah telat masih ada'
              : d === 'putusan-sah'
                ? 'Dihitung hadir — keputusan pelatih'
                : `Tidak dihitung hadir (${LABEL_DATANG[d]}) — dihitung alpa`}
      </p>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Batal
        </Button>
        <Button variant="primary" data-testid="datang-simpan" onClick={simpan}>
          Simpan
        </Button>
      </div>
    </Modal>
  )
}
