import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import QRCode from 'qrcode'
import { db } from '../db/db'
import type { Member, MemberRole, Section } from '../db/types'
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
  Toggle,
  useToast,
} from '../components/ui'
import { Avatar } from './Dashboard'
import { IconDownload, IconPlus, IconQr, IconSearch, IconUpload, IconUsers } from '../components/Icons'
import {
  ROLE_LABEL,
  sectionDot,
  sectionLabel,
  downloadFile,
  formatDateLong,
  readFileAsText,
  toCSV,
  uid,
  visibleSections,
} from '../lib/utils'
import {
  bacaBarisCsvAnggota,
  barisCsvAnggota,
  cocokCari,
  JUDUL_CSV_ANGGOTA,
  pecahCsv,
} from '../lib/namaAnggota'
import { NamaTampil, useModeNama } from '../components/NamaTampil'
import { GabungAnggota } from '../components/GabungAnggota'
import { PilihModeNama } from '../components/PilihModeNama'

const ROLES: MemberRole[] = ['member', 'sectionLeader', 'drumMajor', 'assistant']

export default function Members() {
  const toast = useToast()
  const modeNama = useModeNama()
  const members = useLiveQuery(() => db.members.orderBy('name').toArray(), [], [])
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Section | 'all'>('all')
  const [showInactive, setShowInactive] = useState(false)
  const [editing, setEditing] = useState<Member | null>(null)
  const [open, setOpen] = useState(false)
  const [qrFor, setQrFor] = useState<Member | null>(null)
  const [gabung, setGabung] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const list = useMemo(() => {
    return members
      .filter((m) => (showInactive ? true : m.active === 1))
      .filter((m) => (filter === 'all' ? true : m.section === filter))
      .filter((m) => cocokCari(m, q, true))
  }, [members, q, filter, showInactive])

  const grouped = useMemo(() => {
    const g = new Map<Section, Member[]>()
    for (const m of list) {
      const arr = g.get(m.section) ?? []
      arr.push(m)
      g.set(m.section, arr)
    }
    return g
  }, [list])

  function newMember(): Member {
    return {
      id: uid('m_'),
      code: autoCode(members),
      name: '',
      section: 'brass',
      instrument: '',
      role: 'member',
      joinYear: new Date().getFullYear(),
      active: 1,
      token: uid('t_'),
      createdAt: Date.now(),
    }
  }

  async function save(m: Member) {
    if (!m.name.trim()) {
      toast.push('Nama anggota wajib diisi', 'err')
      return
    }
    await db.members.put({
      ...m,
      name: m.name.trim(),
      panggilan: m.panggilan?.trim() || undefined,
    })
    setOpen(false)
    toast.push(members.some((x) => x.id === m.id) ? 'Perubahan disimpan' : 'Anggota ditambahkan')
  }

  async function toggleActive(m: Member) {
    await db.members.update(m.id, { active: m.active ? 0 : 1 })
  }

  async function remove(m: Member) {
    await db.members.delete(m.id)
    await db.attendance.where('memberId').equals(m.id).delete()
    toast.push(`${m.name} dihapus`, 'info')
  }

  /** Unduh contoh berkas CSV supaya mudah diisi di Excel lalu diimpor. */
  function downloadTemplate() {
    const rows: unknown[][] = [
      JUDUL_CSV_ANGGOTA,
      ['C01', 'Contoh Nama Satu', 'Dede', 'Brass', 'Trumpet', 'Anggota', new Date().getFullYear(), '0812xxxxxxx1', 'Aktif', ''],
      ['C02', 'Contoh Nama Dua', '', 'Battery', 'Snare', 'Ketua Section', new Date().getFullYear(), '', 'Aktif', ''],
      ['C03', 'Contoh Nama Tiga', '', 'Color Guard', 'Flag', 'Anggota', new Date().getFullYear(), '', 'Aktif', 'Perlu pendampingan langkah'],
    ]
    downloadFile('template-anggota.csv', toCSV(rows), 'text/csv')
    toast.push('Template diunduh — isi di Excel, lalu Impor')
  }

  function exportCSV() {
    const rows: unknown[][] = [
      JUDUL_CSV_ANGGOTA,
      ...members.map((m) => barisCsvAnggota(m, sectionLabel, (role) => ROLE_LABEL[role] ?? role)),
    ]
    downloadFile('drillkit-anggota.csv', toCSV(rows), 'text/csv')
    toast.push('CSV diunduh')
  }

  async function importCSV(file: File) {
    try {
      const text = await readFileAsText(file)
      const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter(Boolean)
      const [judulMentah, ...rows] = lines
      const judul = judulMentah ? pecahCsv(judulMentah) : null
      const sections = visibleSections()
      let added = 0
      for (const line of rows) {
        const baris = bacaBarisCsvAnggota(pecahCsv(line), judul, sections)
        if (!baris) continue
        await db.members.put({
          id: uid('m_'),
          code: baris.code || autoCode(members, added),
          name: baris.name,
          panggilan: baris.panggilan,
          section: baris.section,
          instrument: baris.instrument,
          role: baris.role,
          joinYear: baris.joinYear,
          phone: baris.phone,
          notes: baris.notes,
          active: baris.active,
          token: uid('t_'),
          createdAt: Date.now(),
        })
        added++
      }
      toast.push(`${added} anggota diimpor`)
    } catch (e) {
      toast.push('Gagal membaca file CSV', 'err')
    }
  }

  return (
    <div>
      <PageHeader
        title="Anggota"
        subtitle={`${members.filter((m) => m.active).length} aktif dari ${members.length} terdaftar`}
        actions={
          <>
            <Button onClick={exportCSV} title="Ekspor CSV">
              <IconDownload size={16} /> Ekspor
            </Button>
            <Button onClick={() => fileRef.current?.click()} title="Impor CSV">
              <IconUpload size={16} /> Impor
            </Button>
            <Button onClick={downloadTemplate} title="Unduh contoh berkas CSV">
              Template
            </Button>
            <Button data-testid="tombol-gabung" onClick={() => setGabung(true)} title="Satukan dua kartu yang ternyata orang yang sama">
              Gabungkan
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setEditing(newMember())
                setOpen(true)
              }}
            >
              <IconPlus size={16} /> Tambah
            </Button>
          </>
        }
      />
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) importCSV(f)
          e.target.value = ''
        }}
      />

      {/* Filter */}
      <Card className="mb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <IconSearch size={16} className="absolute left-3 top-2.5 text-slate-500" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari nama, panggilan, kode, atau instrumen…"
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            <Select value={filter} onChange={(e) => setFilter(e.target.value as Section | 'all')} className="sm:w-44">
              <option value="all">Semua section</option>
              {visibleSections().map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <Toggle checked={showInactive} onChange={setShowInactive} label="Tampilkan anggota nonaktif" />
          <PilihModeNama />
        </div>
      </Card>

      {list.length === 0 ? (
        <EmptyState
          icon={<IconUsers size={32} />}
          title="Tidak ada anggota yang cocok"
          desc="Coba ubah kata kunci pencarian atau filter section."
        />
      ) : (
        <div className="space-y-4">
          {[...grouped.entries()].map(([sec, arr]) => (
            <Card key={sec} padded={false}>
              <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: sectionDot(sec) }} />
                  <h2 className="text-sm font-semibold text-slate-200">{sectionLabel(sec)}</h2>
                </div>
                <span className="text-xs text-slate-500">{arr.length} orang</span>
              </div>
              <ul className="divide-y divide-slate-800/70">
                {arr.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 px-4 py-2.5">
                    <Avatar m={m} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className={`truncate text-sm font-medium ${m.active ? 'text-slate-100' : 'text-slate-500 line-through'}`}>
                          <NamaTampil anggota={m} />
                        </p>
                        {m.panggilan?.trim() && m.panggilan.trim() !== m.name && modeNama === 'lengkap' && (
                          <span className="text-[10px] text-slate-500">{m.panggilan.trim()}</span>
                        )}
                        {m.panggilan?.trim() && modeNama === 'panggilan' && (
                          <span className="text-[10px] text-slate-500">{m.name}</span>
                        )}
                        <Badge>{m.code}</Badge>
                        {m.role !== 'member' && <Badge className="border-violet-500/30 bg-violet-500/10 text-violet-300">{ROLE_LABEL[m.role]}</Badge>}
                      </div>
                      <p className="truncate text-xs text-slate-500">
                        {m.instrument || '—'} · masuk {m.joinYear}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <button
                        onClick={() => setQrFor(m)}
                        className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-emerald-300"
                        title="Kartu QR absensi"
                      >
                        <IconQr size={16} />
                      </button>
                      <button
                        onClick={() => toggleActive(m)}
                        className={`rounded-lg px-2 py-1 text-[11px] font-medium ${
                          m.active ? 'text-slate-400 hover:bg-slate-800' : 'text-emerald-400 hover:bg-emerald-500/10'
                        }`}
                        title={m.active ? 'Nonaktifkan' : 'Aktifkan'}
                      >
                        {m.active ? 'Nonaktifkan' : 'Aktifkan'}
                      </button>
                      <button
                        onClick={() => {
                          setEditing(m)
                          setOpen(true)
                        }}
                        className="rounded-lg px-2 py-1 text-[11px] font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                      >
                        Edit
                      </button>
                      <ConfirmButton
                        onConfirm={() => remove(m)}
                        label="Hapus"
                        message="Yakin hapus?"
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}

      <MemberModal
        open={open}
        member={editing}
        onClose={() => setOpen(false)}
        onSave={save}
        existingCodes={members.map((m) => m.code)}
      />
      <QrModal member={qrFor} onClose={() => setQrFor(null)} />
      <GabungAnggota open={gabung} anggota={members} onClose={() => setGabung(false)} />
    </div>
  )
}

/* ------------------------------ Modal form -------------------------------- */

function MemberModal({
  open,
  member,
  onClose,
  onSave,
  existingCodes,
}: {
  open: boolean
  member: Member | null
  onClose: () => void
  onSave: (m: Member) => void
  existingCodes: string[]
}) {
  const [m, setM] = useState<Member | null>(member)
  useEffect(() => setM(member), [member])

  if (!m) return null
  const dupe = existingCodes.filter((c) => c === m.code).length > (member?.code === m.code ? 1 : 0)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={member?.name ? 'Edit anggota' : 'Tambah anggota'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button variant="primary" onClick={() => onSave(m)}>
            Simpan
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nama lengkap" hint="dipakai laporan & kartu kehadiran">
          <Input autoFocus value={m.name} onChange={(e) => setM({ ...m, name: e.target.value })} placeholder="Nama anggota" />
        </Field>
        <Field label="Nama panggilan" hint="opsional, mis. Dede">
          <Input
            data-testid="kolom-panggilan"
            value={m.panggilan ?? ''}
            onChange={(e) => setM({ ...m, panggilan: e.target.value })}
            placeholder="Nama di lapangan"
          />
        </Field>
        <Field label="Kode / nomor" hint="muncul di chart">
          <Input
            value={m.code}
            onChange={(e) => setM({ ...m, code: e.target.value })}
            className={dupe ? 'border-amber-500' : ''}
          />
        </Field>
        <Field label="Section">
          <Select value={m.section} onChange={(e) => setM({ ...m, section: e.target.value as Section })}>
            {visibleSections().map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Instrumen / perlengkapan">
          <Input
            value={m.instrument}
            onChange={(e) => setM({ ...m, instrument: e.target.value })}
            placeholder="mis. Trumpet, Snare, Flag"
          />
        </Field>
        <Field label="Peran">
          <Select value={m.role} onChange={(e) => setM({ ...m, role: e.target.value as MemberRole })}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Tahun masuk">
          <Input
            type="number"
            value={m.joinYear}
            onChange={(e) => setM({ ...m, joinYear: Number(e.target.value) })}
          />
        </Field>
        <Field label="No. HP / kontak" hint="opsional">
          <Input value={m.phone ?? ''} onChange={(e) => setM({ ...m, phone: e.target.value })} />
        </Field>
        <Field label="Status">
          <Select value={String(m.active)} onChange={(e) => setM({ ...m, active: Number(e.target.value) })}>
            <option value="1">Aktif</option>
            <option value="0">Nonaktif</option>
          </Select>
        </Field>
      </div>
      <Field label="Catatan" hint="opsional">
        <Textarea
          value={m.notes ?? ''}
          onChange={(e) => setM({ ...m, notes: e.target.value })}
          placeholder="Mis. perlu pendampingan langkah, catatan medis, dll."
        />
      </Field>
      {dupe && <p className="text-xs text-amber-400">Kode ini sudah dipakai anggota lain.</p>}
      {/* Catatan evaluasi hanya muncul saat menyunting anggota yang sudah tersimpan */}
      {member?.id && <MemberNotesEditor memberId={member.id} />}
    </Modal>
  )
}

/* -------------------------------- QR kartu --------------------------------- */

/**
 * Catatan evaluasi pribadi untuk satu anggota.
 *
 * Ditulis pelatih di sini, lalu ikut terbawa ke **paket berbagi** sehingga bisa
 * dibaca anggota yang bersangkutan di HP-nya (menu Berbagi → tab **Catatan**).
 */
function MemberNotesEditor({ memberId }: { memberId: string }) {
  const notes = useLiveQuery(() => db.memberNotes.where('memberId').equals(memberId).toArray(), [memberId], [])
  const [teks, setTeks] = useState('')

  const urut = [...notes].sort((a, b) => b.at - a.at)

  async function tambah() {
    const t = teks.trim()
    if (!t) return
    await db.memberNotes.put({ id: uid('n_'), memberId, at: Date.now(), text: t, by: 'Pelatih' })
    setTeks('')
  }

  return (
    <div className="mt-4 border-t border-slate-800 pt-4">
      <p className="mb-1 text-xs font-semibold text-slate-200">Catatan evaluasi</p>
      <p className="mb-3 text-[11px] leading-relaxed text-slate-500">
        Catatan ini ikut ke paket berbagi, jadi bisa dibaca anggota yang bersangkutan di HP-nya
        (menu Berbagi → tab Catatan). Tidak terlihat oleh anggota lain.
      </p>
      {urut.length > 0 && (
        <ul className="scroll-thin mb-3 max-h-40 space-y-1.5 overflow-y-auto">
          {urut.map((n) => (
            <li key={n.id} className="rounded-lg border border-slate-800 bg-slate-950/40 p-2.5">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-[11px] text-slate-500">
                  {formatDateLong(new Date(n.at).toISOString().slice(0, 10))}
                  {n.by ? ` · ${n.by}` : ''}
                </span>
                <ConfirmButton
                  label="Hapus"
                  message="Hapus catatan ini?"
                  onConfirm={() => void db.memberNotes.delete(n.id)}
                />
              </div>
              <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-200">{n.text}</p>
            </li>
          ))}
        </ul>
      )}
      <Textarea
        value={teks}
        onChange={(e) => setTeks(e.target.value)}
        placeholder="Mis. langkah sudah rapi, tapi jaga jarak saat pivot."
        className="min-h-[68px]"
      />
      <Button className="mt-2" size="sm" variant="primary" onClick={tambah} disabled={!teks.trim()}>
        Tambah catatan
      </Button>
    </div>
  )
}

function QrModal({ member, onClose }: { member: Member | null; onClose: () => void }) {
  const [url, setUrl] = useState('')

  useEffect(() => {
    if (!member) return
    QRCode.toDataURL(member.token, { width: 640, margin: 1, errorCorrectionLevel: 'M' })
      .then(setUrl)
      .catch(() => setUrl(''))
  }, [member])

  if (!member) return null

  return (
    <Modal
      open={!!member}
      onClose={onClose}
      title="Kartu absensi"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Tutup
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              const w = window.open('', '_blank', 'width=420,height=620')
              if (!w) return
              w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Kartu ${member.name}</title>
              <style>body{font-family:system-ui;text-align:center;padding:24px}
              h1{font-size:20px;margin:8px 0 2px}p{color:#555;margin:0 0 4px}
              img{width:300px;height:300px}.code{font-family:monospace;font-size:12px;color:#888;margin-top:8px}</style>
              </head><body>
              <h1>${member.name}</h1>
              <p>${member.code} · ${sectionLabel(member.section)} · ${member.instrument}</p>
              <img src="${url}" alt="QR" />
              <div class="code">${member.token}</div>
              </body></html>`)
              w.document.close()
            }}
          >
            Cetak / simpan PDF
          </Button>
        </>
      }
    >
      <div className="text-center">
        {url ? (
          <img src={url} alt="QR" className="mx-auto w-56 rounded-xl bg-white p-2" />
        ) : (
          <p className="text-sm text-slate-400">Membuat kode QR…</p>
        )}
        <p className="mt-3 text-sm font-medium text-slate-100"><NamaTampil anggota={member} /></p>
        <p className="text-xs text-slate-500">
          {member.code} · {sectionLabel(member.section)} · {member.instrument}
        </p>
        <p className="mt-3 text-xs text-slate-500">
          Tunjukkan QR ini ke pelatih saat absensi, atau cetak sebagai kartu.
        </p>
      </div>
    </Modal>
  )
}

/* -------------------------------- Helpers ---------------------------------- */

function autoCode(members: Member[], offset = 0): string {
  let n = members.length + 1 + offset
  let code = `A${String(n).padStart(2, '0')}`
  const used = new Set(members.map((m) => m.code))
  while (used.has(code)) {
    n++
    code = `A${String(n).padStart(2, '0')}`
  }
  return code
}

/** Parser CSV sederhana yang mendukung kutip ("...") dan koma di dalam nilai. */
export function parseCSVLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else inQuotes = false
      } else cur += ch
    } else if (ch === '"') inQuotes = true
    else if (ch === ',' || ch === ';') {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out.map((s) => s.trim())
}
