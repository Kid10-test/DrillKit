import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db } from '../db/db'
import type { AttendanceStatus, Member } from '../db/types'
import { seedDemoData } from '../db/seed'
import { useSettings } from '../hooks/useSettings'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  StatTile,
  useToast,
} from '../components/ui'
import {
  IconCalendar,
  IconCheck,
  IconGrid,
  IconMusic,
  IconUsers,
} from '../components/Icons'
import { BackupReminder } from '../components/BackupReminder'
import { PengingatJadwal } from '../components/PengingatJadwal'
import { TombolPanduan } from '../components/Panduan'
import { NamaTampil, useModeNama } from '../components/NamaTampil'
import { namaTampil } from '../lib/namaAnggota'
import {
  sectionDot,
  sesiMeta,
  visibleSections,
  STATUS_META,
  daysFromToday,
  formatDateLong,
  pct,
  relativeDay,
  todayISO,
} from '../lib/utils'

export default function Dashboard() {
  const settings = useSettings()
  const toast = useToast()

  const members = useLiveQuery(() => db.members.toArray(), [], [])
  const sessions = useLiveQuery(() => db.sessions.orderBy('date').toArray(), [], [])
  const drills = useLiveQuery(() => db.drills.toArray(), [], [])
  const sets = useLiveQuery(() => db.sets.toArray(), [], [])
  const attendance = useLiveQuery(() => db.attendance.toArray(), [], [])

  const active = members.filter((m) => m.active)
  const today = todayISO()
  const upcoming = sessions.filter((s) => daysFromToday(s.date) >= 0)
  const past = sessions.filter((s) => daysFromToday(s.date) < 0)
  const nextSession = upcoming[0]

  // Rekap kehadiran 30 hari terakhir
  const recentSessions = sessions.filter(
    (s) => daysFromToday(s.date) <= 0 && daysFromToday(s.date) >= -30,
  )
  const recentIds = new Set(recentSessions.map((s) => s.id))
  const recent = attendance.filter((a) => recentIds.has(a.sessionId))
  const hadir = recent.filter((a) => a.status === 'hadir').length
  const totalRec = recent.length
  const rate = pct(hadir, totalRec)

  // Kehadiran per anggota (semua sesi)
  const byMember = new Map<string, { hadir: number; total: number }>()
  for (const a of attendance) {
    const e = byMember.get(a.memberId) ?? { hadir: 0, total: 0 }
    e.total++
    if (a.status === 'hadir') e.hadir++
    byMember.set(a.memberId, e)
  }
  const topMembers = active
    .map((m) => ({ m, ...(byMember.get(m.id) ?? { hadir: 0, total: 0 }) }))
    .filter((x) => x.total > 0)
    .sort((a, b) => b.hadir / b.total - a.hadir / a.total)
    .slice(0, 5)

  // Komposisi section
  const bySection = new Map<string, number>()
  for (const m of active) bySection.set(m.section, (bySection.get(m.section) ?? 0) + 1)

  // Absensi terakhir yang belum lengkap
  const lastSession = past[past.length - 1]
  const lastFilled = lastSession ? attendance.filter((a) => a.sessionId === lastSession.id).length : 0

  async function loadDemo() {
    const n = await seedDemoData()
    if (n) toast.push(`Data contoh dimuat: ${n} anggota + jadwal + drill`)
    else toast.push('Data sudah ada, tidak ditambahkan', 'info')
  }

  if (members.length === 0) {
    return (
      <div>
        <PageHeader
          title={`Halo, ${settings?.coachName ?? 'Pelatih'}!`}
          subtitle="Selamat datang di DrillKit"
          actions={<TombolPanduan />}
        />
        <EmptyState
          title="Belum ada data anggota"
          desc="Mulai dengan menambahkan anggota secara manual, impor dari CSV, atau muat data contoh untuk melihat semua fitur."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Link to="/anggota">
                <Button variant="primary">Tambah anggota</Button>
              </Link>
              <Button onClick={loadDemo}>Muat data contoh</Button>
            </div>
          }
        />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title={`Halo, ${settings?.coachName ?? 'Pelatih'}!`}
        subtitle={`${settings?.teamName ?? 'Tim'} · ${formatDateLong(today)}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <TombolPanduan />
            {nextSession && (
              <Link to="/absensi">
                <Button variant="primary">
                  <IconCheck size={16} /> Isi absensi
                </Button>
              </Link>
            )}
          </div>
        }
      />

      {/* Pengingat backup — muncul hanya kalau sudah waktunya */}
      <div className="mb-4">
        <BackupReminder />
      </div>

      {/* C3 — pengingat jadwal terdekat, muncul hanya kalau ada yang dekat */}
      <div className="mb-4">
        <PengingatJadwal sessions={sessions} prefix="ingat-coach" />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Anggota aktif"
          value={active.length}
          sub={members.length > active.length ? `${members.length - active.length} nonaktif` : 'semua aktif'}
        />
        <StatTile
          label="Kehadiran 30 hari"
          value={`${rate}%`}
          sub={totalRec ? `${hadir} dari ${totalRec} catatan` : 'belum ada catatan'}
          accent={rate >= 85 ? 'text-emerald-400' : rate >= 70 ? 'text-amber-400' : 'text-rose-400'}
        />
        <StatTile
          label="Jadwal mendatang"
          value={upcoming.length}
          sub={nextSession ? `Berikutnya: ${relativeDay(nextSession.date).toLowerCase()}` : '-'}
        />
        <StatTile
          label="Drill tersimpan"
          value={drills.length}
          sub={sets.length ? `${sets.length} set formasi` : 'belum ada set'}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* Jadwal berikutnya */}
        <Card className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
              <IconCalendar size={16} className="text-slate-500" /> Jadwal berikutnya
            </h2>
            <Link to="/jadwal" className="text-xs font-medium text-emerald-400 hover:text-emerald-300">
              Lihat semua →
            </Link>
          </div>
          {nextSession ? (
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={sesiMeta(nextSession.type).color}>{sesiMeta(nextSession.type).label}</Badge>
                    <span className="text-xs text-slate-400">{relativeDay(nextSession.date)}</span>
                  </div>
                  <p className="mt-2 text-base font-semibold text-slate-100">{nextSession.title}</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {formatDateLong(nextSession.date)} · {nextSession.startTime}–{nextSession.endTime}
                    {nextSession.place ? ` · ${nextSession.place}` : ''}
                  </p>
                </div>
                <Link to="/absensi">
                  <Button variant="primary" size="sm">
                    Buka absensi
                  </Button>
                </Link>
              </div>
              {nextSession.checklist.length > 0 && (
                <div className="mt-4 space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Materi</p>
                  {nextSession.checklist.map((c) => (
                    <div key={c.id} className="flex items-center gap-2 text-xs text-slate-300">
                      <span className={`h-1.5 w-1.5 rounded-full ${c.done ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                      {c.text}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <EmptyState title="Belum ada jadwal mendatang" desc="Tambahkan jadwal latihan dari menu Jadwal." />
          )}

          {upcoming.length > 1 && (
            <div className="mt-3 space-y-1.5">
              {upcoming.slice(1, 4).map((s) => (
                <Link
                  key={s.id}
                  to="/jadwal"
                  className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/30 px-3 py-2 text-xs hover:bg-slate-800/50"
                >
                  <span className="truncate text-slate-300">{s.title}</span>
                  <span className="shrink-0 text-slate-500">{relativeDay(s.date)}</span>
                </Link>
              ))}
            </div>
          )}
        </Card>

        {/* Komposisi tim */}
        <Card>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-200">
            <IconGrid size={16} className="text-slate-500" /> Komposisi tim
          </h2>
          <div className="space-y-2.5">
            {visibleSections().map((sec) => {
              const n = bySection.get(sec.id) ?? 0
              if (!n) return null
              return (
                <div key={sec.id}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-slate-300">{sec.label}</span>
                    <span className="tabular-nums text-slate-500">{n}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${(n / Math.max(1, active.length)) * 100}%`, background: sec.dot }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
          <Link to="/anggota" className="mt-4 block text-xs font-medium text-emerald-400 hover:text-emerald-300">
            Kelola anggota →
          </Link>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* Kehadiran terbaik */}
        <Card>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-200">
            <IconUsers size={16} className="text-slate-500" /> Kehadiran terbaik
          </h2>
          {topMembers.length ? (
            <div className="space-y-2">
              {topMembers.map(({ m, hadir: h, total: t }) => {
                const p = pct(h, t)
                return (
                  <div key={m.id} className="flex items-center gap-3">
                    <Avatar m={m} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-xs font-medium text-slate-200"><NamaTampil anggota={m} /></p>
                        <span className="shrink-0 text-[11px] tabular-nums text-slate-500">
                          {h}/{t} · {p}%
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-800">
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{ width: `${p}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <EmptyState title="Belum ada data absensi" desc="Isi absensi setelah latihan untuk melihat rekap." />
          )}
        </Card>

        {/* Ringkasan cepat */}
        <Card>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-200">
            <IconMusic size={16} className="text-slate-500" /> Ringkasan
          </h2>
          <div className="space-y-2 text-sm">
            <SummaryRow
              label="Absensi terakhir"
              value={
                lastSession
                  ? `${lastSession.title} — ${lastFilled}/${active.length} terisi`
                  : 'belum ada sesi lewat'
              }
              to="/absensi"
            />
            <SummaryRow label="Jumlah drill" value={`${drills.length} drill · ${sets.length} set`} to="/drill" />
            <SummaryRow label="Repertoar & tempo" value="Buka metronom" to="/musik" />
            <SummaryRow label="Berbagi ke anggota" value="Ekspor/import paket tim" to="/berbagi" />
          </div>
          {totalRec === 0 && (
            <Button className="mt-4 w-full" onClick={loadDemo}>
              Muat data contoh
            </Button>
          )}
        </Card>
      </div>
    </div>
  )
}

function SummaryRow({ label, value, to }: { label: string; value: string; to: string }) {
  return (
    <Link
      to={to}
      className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/30 px-3 py-2.5 hover:bg-slate-800/50"
    >
      <span className="text-xs text-slate-400">{label}</span>
      <span className="truncate text-xs font-medium text-slate-200">{value}</span>
    </Link>
  )
}

export function Avatar({ m, size = 30 }: { m: Member; size?: number }) {
  const tampil = namaTampil(m, useModeNama())
  const initials = tampil
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
  return (
    <div
      className="grid shrink-0 place-items-center rounded-full text-[10px] font-bold text-slate-950"
      style={{ width: size, height: size, background: sectionDot(m.section) }}
      title={tampil}
    >
      {initials}
    </div>
  )
}

export function StatusChip({ status }: { status: AttendanceStatus }) {
  return <Badge className={STATUS_META[status].color}>{STATUS_META[status].label}</Badge>
}

/** Dipakai juga di halaman lain. */
export function useAttendanceStats() {
  return useLiveQuery(() => db.attendance.toArray(), [], [])
}
