import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { BlokLatihan, ChecklistItem, JenisBlok, Session, SessionType } from '../db/types'
import {
  Badge,
  Button,
  Card,
  ConfirmButton,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Textarea,
  useToast,
} from '../components/ui'
import { IconCalendar, IconPlus, IconDownload, IconPlay } from '../components/Icons'
import { PacuLatihan } from '../components/PacuLatihan'
import { PenandaSesi, RekapPenanda } from '../components/PenandaSesi'
import { lamaSlot, menitDariJam } from '../lib/runsheet'
import { LABEL_BLOK, URUTAN_BLOK, formatMenit, lebihRencana, totalRencana } from '../lib/latihan'
import { URUTAN_JENIS, daysFromToday, formatDateLong, relativeDay, sesiMeta, toCSV, downloadFile, nowTime, todayISO, uid } from '../lib/utils'

const TYPES: SessionType[] = [...URUTAN_JENIS] as SessionType[]

export default function Schedule() {
  const toast = useToast()
  const sessions = useLiveQuery(() => db.sessions.orderBy('date').toArray(), [], [])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Session | null>(null)
  /** D3 — saring daftar jadwal menurut jenis kegiatan. */
  const [filterJenis, setFilterJenis] = useState<string>('all')
  /**
  /** H1 — layar pacu latihan. Yang disimpan **id-nya saja**, bukan
   * salinan sesinya: sebegitu blok dimulai atau diselesaikan, perubahannya
   * ditulis ke db dan harus langsung terlihat. Menyimpan salinan akan
   * membuat layar ini beku pada keadaan saat pertama kali dibuka.
   */
  const [pacuId, setPacuId] = useState<string | null>(null)

  const { upcoming, past } = useMemo(() => {
    const up: Session[] = []
    const pa: Session[] = []
    const cocok = (s: Session) => filterJenis === 'all' || s.type === filterJenis
    for (const s of (sessions ?? []).filter(cocok)) (daysFromToday(s.date) >= 0 ? up : pa).push(s)
    return { upcoming: up, past: pa.reverse() }
  }, [sessions, filterJenis])

  /** D3 — jumlah sesi per jenis, ditampilkan di pilihan penyaring. */
  const hitungJenis = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of sessions ?? []) m.set(s.type, (m.get(s.type) ?? 0) + 1)
    return m
  }, [sessions])

  function blank(): Session {
    return {
      id: uid('s_'),
      title: '',
      type: 'latihan',
      date: todayISO(),
      startTime: '15:30',
      endTime: '18:00',
      place: '',
      notes: '',
      checklist: [],
      createdAt: Date.now(),
    }
  }

  async function save(s: Session) {
    if (!s.title.trim()) {
      toast.push('Judul kegiatan wajib diisi', 'err')
      return
    }
    await db.sessions.put(s)
    setOpen(false)
    toast.push('Jadwal disimpan')
  }

  async function remove(s: Session) {
    await db.sessions.delete(s.id)
    await db.attendance.where('sessionId').equals(s.id).delete()
    toast.push('Jadwal dihapus', 'info')
  }

  async function toggleChecklist(s: Session, itemId: string) {
    const checklist = s.checklist.map((c) => (c.id === itemId ? { ...c, done: c.done ? 0 : 1 } : c))
    await db.sessions.update(s.id, { checklist })
  }

  /** Sesi yang sedang dipacu, diambil dari kueri hidup supaya selalu mutakhir. */
  const pacuSesi = useMemo(
    () => (pacuId ? (sessions ?? []).find((s) => s.id === pacuId) ?? null : null),
    [pacuId, sessions],
  )

  function exportCSV() {
    const rows: unknown[][] = [
      ['Tanggal', 'Judul', 'Jenis', 'Mulai', 'Selesai', 'Tempat', 'Materi', 'Catatan'],
      ...(sessions ?? []).map((s) => [
        s.date,
        s.title,
        sesiMeta(s.type).label,
        s.startTime,
        s.endTime,
        s.place ?? '',
        s.checklist.map((c) => `${c.done ? '[x]' : '[ ]'} ${c.text}`).join(' | '),
        s.notes ?? '',
      ]),
    ]
    downloadFile('drillkit-jadwal.csv', toCSV(rows), 'text/csv')
  }

  return (
    <div>
      <PageHeader
        title="Jadwal"
        subtitle="Latihan, penampilan, dan agenda lain beserta materi per sesi"
        actions={
          <>
            <Button onClick={exportCSV}>
              <IconDownload size={16} /> Ekspor
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setEditing(blank())
                setOpen(true)
              }}
            >
              <IconPlus size={16} /> Tambah jadwal
            </Button>
          </>
        }
      />

      <Card className="mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Jenis kegiatan</label>
            <Select
              data-testid="saring-jenis-jadwal"
              data-kiosk-allow
              value={filterJenis}
              onChange={(e) => setFilterJenis(e.target.value)}
              className="min-w-[13rem]"
            >
              <option value="all">Semua jenis ({sessions?.length ?? 0})</option>
              {URUTAN_JENIS.map((t) =>
                hitungJenis.get(t) ? (
                  <option key={t} value={t}>
                    {sesiMeta(t).label} ({hitungJenis.get(t)})
                  </option>
                ) : null,
              )}
            </Select>
          </div>
          <p className="pb-1 text-[11px] text-slate-500">
            Jenis kegiatan ikut menentukan rekap kehadiran — latihan section, latihan gabungan,
            dan penampilan bisa dilihat terpisah di menu <b>Absensi → Rekap</b>.
          </p>
        </div>
      </Card>

      <RekapPenanda sesi={sessions ?? []} />

      <Section
        title="Mendatang"
        items={upcoming}
        empty="Belum ada jadwal mendatang."
        onToggle={toggleChecklist}
        onEdit={(s) => {
          setEditing(s)
          setOpen(true)
        }}
        onDelete={remove}
        onPacu={(s) => setPacuId(s.id)}
      />

      <div className="mt-6">
        <Section
          title="Sudah lewat"
          items={past}
          empty="Belum ada riwayat kegiatan."
          muted
          onToggle={toggleChecklist}
          onEdit={(s) => {
            setEditing(s)
            setOpen(true)
          }}
          onDelete={remove}
          onPacu={(s) => setPacuId(s.id)}
        />
      </div>

      <SessionModal open={open} session={editing} onClose={() => setOpen(false)} onSave={save} />

      {pacuSesi && <PacuLatihan sesi={pacuSesi} onClose={() => setPacuId(null)} />}
    </div>
  )
}

function Section({
  title,
  items,
  empty,
  muted,
  onToggle,
  onEdit,
  onDelete,
  onPacu,
}: {
  title: string
  items: Session[]
  empty: string
  muted?: boolean
  onToggle: (s: Session, id: string) => void
  onEdit: (s: Session) => void
  onDelete: (s: Session) => void
  onPacu: (s: Session) => void
}) {
  return (
    <div>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title} ({items.length})
      </h2>
      {items.length === 0 ? (
        <EmptyState icon={<IconCalendar size={28} />} title={empty} />
      ) : (
        <div className="space-y-3">
          {items.map((s) => (
            <Card key={s.id} className={muted ? 'opacity-80' : ''}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={sesiMeta(s.type).color}>{sesiMeta(s.type).label}</Badge>
                    <span className="text-xs font-medium text-emerald-400">{relativeDay(s.date)}</span>
                    <span className="text-xs text-slate-500">
                      {s.startTime}–{s.endTime}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm font-semibold text-slate-100">{s.title}</p>
                  <p className="text-xs text-slate-500">
                    {formatDateLong(s.date)}
                    {s.place ? ` · ${s.place}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {(s.rencanaLatihan?.length ?? 0) > 0 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      data-testid={`pacu-${s.id}`}
                      onClick={() => onPacu(s)}
                    >
                      <IconPlay size={14} /> Pacu
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => onEdit(s)}>
                    Edit
                  </Button>
                  <ConfirmButton onConfirm={() => onDelete(s)} message="Hapus jadwal?" />
                </div>
              </div>

              {s.checklist.length > 0 && (
                <ul className="mt-3 space-y-1">
                  {s.checklist.map((c) => (
                    <li key={c.id}>
                      <button
                        onClick={() => onToggle(s, c.id)}
                        className="flex w-full items-center gap-2 rounded px-1 py-0.5 text-left text-xs text-slate-300 hover:bg-slate-800/60"
                      >
                        <span
                          className={`grid h-4 w-4 shrink-0 place-items-center rounded border text-[10px] ${
                            c.done ? 'border-emerald-500 bg-emerald-500 text-slate-950' : 'border-slate-600'
                          }`}
                        >
                          {c.done ? '✓' : ''}
                        </span>
                        <span className={c.done ? 'text-slate-500 line-through' : ''}>{c.text}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <RencanaRingkas s={s} />

              <PenandaSesi s={s} />

              {s.notes && <p className="mt-3 whitespace-pre-wrap text-xs text-slate-400">{s.notes}</p>}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function SessionModal({
  open,
  session,
  onClose,
  onSave,
}: {
  open: boolean
  session: Session | null
  onClose: () => void
  onSave: (s: Session) => void
}) {
  const [s, setS] = useState<Session | null>(session)
  const [newItem, setNewItem] = useState('')
  useEffect(() => setS(session), [session])

  if (!s) return null

  const addItem = () => {
    if (!newItem.trim()) return
    const item: ChecklistItem = { id: uid('c_'), text: newItem.trim(), done: 0 }
    setS({ ...s, checklist: [...s.checklist, item] })
    setNewItem('')
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={session?.title ? 'Edit jadwal' : 'Tambah jadwal'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button variant="primary" onClick={() => onSave(s)}>
            Simpan
          </Button>
        </>
      }
    >
      <Field label="Judul kegiatan">
        <Input autoFocus value={s.title} onChange={(e) => setS({ ...s, title: e.target.value })} placeholder="mis. Latihan rutin — formasi bagian A" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Jenis">
          <Select value={s.type} onChange={(e) => setS({ ...s, type: e.target.value as SessionType })}>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {sesiMeta(t).label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Tanggal">
          <Input type="date" value={s.date} onChange={(e) => setS({ ...s, date: e.target.value })} />
        </Field>
        <Field label="Jam mulai">
          <Input type="time" value={s.startTime} onChange={(e) => setS({ ...s, startTime: e.target.value })} />
        </Field>
        <Field label="Jam selesai">
          <Input type="time" value={s.endTime} onChange={(e) => setS({ ...s, endTime: e.target.value })} />
        </Field>
      </div>
      <Field label="Tempat" hint="opsional">
        <Input value={s.place ?? ''} onChange={(e) => setS({ ...s, place: e.target.value })} placeholder="Lapangan sekolah / aula" />
      </Field>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-400">Materi / checklist latihan</label>
        <div className="space-y-1.5">
          {s.checklist.map((c, i) => (
            <div key={c.id} className="flex items-center gap-2">
              <span className="flex-1 text-sm text-slate-200">
                {i + 1}. {c.text}
              </span>
              <button
                onClick={() => setS({ ...s, checklist: s.checklist.filter((x) => x.id !== c.id) })}
                className="rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-rose-300"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <Input
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addItem()
              }
            }}
            placeholder="Tambah materi, lalu Enter"
          />
          <Button onClick={addItem}>Tambah</Button>
        </div>
      </div>

      <RencanaEditor s={s} setS={setS} />

      <Field label="Catatan evaluasi" hint="opsional">
        <Textarea
          value={s.notes ?? ''}
          onChange={(e) => setS({ ...s, notes: e.target.value })}
          placeholder="Catatan setelah latihan: apa yang sudah bagus, apa yang perlu diulang."
        />
      </Field>
      <p className="text-[11px] text-slate-500">Waktu saat ini: {nowTime()}</p>
    </Modal>
  )
}

/**
 * Ringkasan rencana pada kartu sesi.
 *
 * Yang ditampilkan bukan sekadar jumlah blok, melainkan **apakah rencananya
 * muat di slotnya** — karena itulah keluhan utamanya: bagian akhir kehabisan
 * waktu. Kalau rencananya sudah kelebihan sejak awal, latihan itu akan
 * kehabisan waktu bagaimanapun dijalankannya.
 */
function RencanaRingkas({ s }: { s: Session }) {
  const blok = s.rencanaLatihan ?? []
  if (blok.length === 0) return null
  const lama = lamaSlot(menitDariJam(s.startTime), menitDariJam(s.endTime))
  const lebih = lebihRencana(lama, blok)

  return (
    <p className="mt-2 text-xs text-slate-500">
      Rencana: {blok.length} blok · {formatMenit(totalRencana(blok))}
      {lebih == null ? (
        <span className="ml-1 text-slate-600">· slotnya tidak terbaca</span>
      ) : lebih > 0 ? (
        <span data-testid="ringkas-lebih" className="ml-1 font-semibold text-rose-300">
          · lebih {formatMenit(lebih)} dari slotnya
        </span>
      ) : (
        <span data-testid="ringkas-muat" className="ml-1 text-emerald-400">
          · sisa {formatMenit(-lebih)} di slotnya
        </span>
      )}
    </p>
  )
}

/**
 * Penyunting rencana latihan di dalam modal jadwal.
 *
 * Durasi disimpan per blok (bukan jam absolut), jadi menggeser jam mulai
 * sesi otomatis menggeser seluruh blok tanpa perlu disusun ulang.
 */
function RencanaEditor({ s, setS }: { s: Session; setS: (x: Session) => void }) {
  const [judul, setJudul] = useState('')
  const [jenis, setJenis] = useState<JenisBlok>('pemanasan')
  const [menit, setMenit] = useState('15')

  const blok = s.rencanaLatihan ?? []
  const lama = lamaSlot(menitDariJam(s.startTime), menitDariJam(s.endTime))
  const lebih = lebihRencana(lama, blok)

  function tambah() {
    const n = Number(menit)
    if (!judul.trim() || !Number.isFinite(n) || n <= 0) return
    const b: BlokLatihan = { id: uid('b_'), judul: judul.trim(), jenis, menit: Math.round(n) }
    setS({ ...s, rencanaLatihan: [...blok, b] })
    setJudul('')
  }

  function hapus(id: string) {
    setS({ ...s, rencanaLatihan: blok.filter((b) => b.id !== id) })
  }

  function geser(i: number, arah: -1 | 1) {
    const j = i + arah
    if (j < 0 || j >= blok.length) return
    const salin = [...blok]
    ;[salin[i], salin[j]] = [salin[j], salin[i]]
    setS({ ...s, rencanaLatihan: salin })
  }

  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-400">
        Rencana latihan <span className="text-slate-600">— opsional</span>
      </label>
      <p className="mb-2 text-[11px] text-slate-500">
        Bagi sesi menjadi blok waktu. Waktu tiap blok dihitung otomatis dari jam mulai sesi, jadi
        menggeser jam mulai cukup sekali.
      </p>

      {blok.length > 0 && (
        <ul data-testid="daftar-blok" className="mb-2 space-y-1">
          {blok.map((b, i) => (
            <li key={b.id} data-testid={`blok-${b.id}`} className="flex items-center gap-2 rounded bg-slate-800/50 px-2 py-1.5">
              <span className="text-[11px] text-slate-600">{i + 1}.</span>
              <span className="flex-1 text-sm text-slate-200">{b.judul}</span>
              <span className="rounded border border-slate-600 px-1.5 py-0.5 text-[10px] text-slate-400">
                {LABEL_BLOK[b.jenis]}
              </span>
              <span className="w-16 text-right text-xs text-slate-300">{b.menit} mnt</span>
              <button
                onClick={() => geser(i, -1)}
                disabled={i === 0}
                data-testid={`naik-${b.id}`}
                className="rounded px-1 text-slate-500 hover:bg-slate-700 hover:text-slate-200 disabled:opacity-25"
                title="Naikkan"
              >
                ↑
              </button>
              <button
                onClick={() => geser(i, 1)}
                disabled={i === blok.length - 1}
                data-testid={`turun-${b.id}`}
                className="rounded px-1 text-slate-500 hover:bg-slate-700 hover:text-slate-200 disabled:opacity-25"
                title="Turunkan"
              >
                ↓
              </button>
              <button
                onClick={() => hapus(b.id)}
                data-testid={`hapus-${b.id}`}
                className="rounded px-1 text-slate-500 hover:bg-slate-700 hover:text-rose-300"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[10rem] flex-1">
          <Input
            data-testid="nama-blok"
            value={judul}
            onChange={(e) => setJudul(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                tambah()
              }
            }}
            placeholder="mis. Pemanasan & tuning"
          />
        </div>
        <Select data-testid="jenis-blok" value={jenis} onChange={(e) => setJenis(e.target.value as JenisBlok)} className="w-32">
          {URUTAN_BLOK.map((t) => (
            <option key={t} value={t}>
              {LABEL_BLOK[t]}
            </option>
          ))}
        </Select>
        <Input
          data-testid="menit-blok"
          type="number"
          min={1}
          value={menit}
          onChange={(e) => setMenit(e.target.value)}
          className="w-20"
        />
        <Button data-testid="tambah-blok" onClick={tambah}>
          Tambah
        </Button>
      </div>

      {blok.length > 0 && (
        <p data-testid="ringkasan-rencana" className="mt-2 text-[11px]">
          <span className="text-slate-500">
            Total rencana {formatMenit(totalRencana(blok))}
            {lama != null && <> · slot {formatMenit(lama)}</>}
          </span>
          {lebih == null ? (
            <span className="ml-1 text-slate-500">· slotnya tidak terbaca, jadi tidak bisa dinilai</span>
          ) : lebih > 0 ? (
            <span data-testid="rencana-lebih" className="ml-1 font-semibold text-rose-300">
              · lebih {formatMenit(lebih)} dari slotnya — bagian akhir akan kehabisan waktu
            </span>
          ) : (
            <span data-testid="rencana-muat" className="ml-1 text-emerald-400">
              · muat, sisa {formatMenit(-lebih)}
            </span>
          )}
        </p>
      )}
    </div>
  )
}
