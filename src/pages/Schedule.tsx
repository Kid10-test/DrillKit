import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { AttendanceRecord, BlokLatihan, ChecklistItem, JenisBlok, Session, SessionType } from '../db/types'
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
import { unduhICS } from '../components/PengingatJadwal'
import { PacuLatihan } from '../components/PacuLatihan'
import { PenandaSesi, RekapPenanda } from '../components/PenandaSesi'
import { lamaSlot, menitDariJam } from '../lib/runsheet'
import { LABEL_BLOK, URUTAN_BLOK, formatMenit, lebihRencana, totalRencana } from '../lib/latihan'
import { URUTAN_JENIS, formatDateLong, relativeDay, sesiMeta, toCSV, downloadFile, nowTime, todayISO, uid } from '../lib/utils'
import { bangunICS } from '../lib/pengingat'
import { cetakAtauUnduh, rapikanPredikat } from '../lib/laporan'
import { useSettings } from '../hooks/useSettings'
import {
  KUNCI_TAMPILAN,
  NAMA_BULAN,
  NAMA_HARI_PANJANG,
  NAMA_HARI_SENIN,
  buatSeri,
  gabungICS,
  geserBulan,
  hariSenin,
  htmlKalenderBulan,
  kelompokPerMinggu,
  nadaKehadiran,
  penampilanTerdekat,
  rencanaHapusSeri,
  ringkasSesi,
  salinSesi,
  sesiBerikutnya,
  sesiPerTanggal,
  susunBulan,
  tambahHari,
  tampilanAwal,
  tanggalSeri,
  teksHitungMundur,
  ubahSeri,
  type AturanSeri,
  type TampilanJadwal,
} from '../lib/kalender'

const TYPES: SessionType[] = [...URUTAN_JENIS] as SessionType[]

function bacaTampilan(): TampilanJadwal {
  let simpan: string | null = null
  try {
    simpan = localStorage.getItem(KUNCI_TAMPILAN)
  } catch {
    /* localStorage diblokir */
  }
  return tampilanAwal(simpan, typeof window !== 'undefined' ? window.innerWidth : 1024)
}

/** Warna titik/label kalender per jenis (kelas Tailwind yang sudah dipakai SESSION_META). */
const TITIK: Record<string, string> = {
  latihan: 'bg-emerald-400',
  section: 'bg-cyan-400',
  gabungan: 'bg-violet-400',
  penampilan: 'bg-amber-400',
  rapat: 'bg-sky-400',
  lainnya: 'bg-slate-400',
}

const NADA: Record<string, string> = {
  baik: 'text-emerald-300',
  cukup: 'text-amber-300',
  kurang: 'text-rose-300',
}

interface Aksi {
  onToggle: (s: Session, id: string) => void
  onEdit: (s: Session) => void
  onDelete: (s: Session) => void
  onDeleteSeri: (s: Session) => void
  onPacu: (s: Session) => void
  onDuplikat: (s: Session) => void
}

export default function Schedule() {
  const toast = useToast()
  const settings = useSettings()
  const ambang = rapikanPredikat(settings?.ambangPredikat)
  const sessions = useLiveQuery(() => db.sessions.orderBy('date').toArray(), [], [])
  const absensi = useLiveQuery(() => db.attendance.toArray(), [], [] as AttendanceRecord[])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Session | null>(null)
  /** D3 — saring daftar jadwal menurut jenis kegiatan. */
  const [filterJenis, setFilterJenis] = useState<string>('all')
  /** H1 — layar pacu latihan; yang disimpan id-nya saja supaya selalu mutakhir. */
  const [pacuId, setPacuId] = useState<string | null>(null)

  /* #3 — tampilan kalender/agenda, diingat per perangkat */
  const [tampilan, setTampilanState] = useState<TampilanJadwal>(bacaTampilan)
  function setTampilan(t: TampilanJadwal) {
    setTampilanState(t)
    try {
      localStorage.setItem(KUNCI_TAMPILAN, t)
    } catch {
      /* abaikan */
    }
  }
  const hariIni = todayISO()
  const [bulanAktif, setBulanAktif] = useState(() => ({ tahun: Number(hariIni.slice(0, 4)), bulan: Number(hariIni.slice(5, 7)) }))
  const [hariPilih, setHariPilih] = useState<string>(hariIni)
  const [lihatLewat, setLihatLewat] = useState(false)
  const [duplikat, setDuplikat] = useState<Session | null>(null)
  /** Menunggu pilihan "hanya sesi ini / semua berikutnya". */
  const [tanyaSeri, setTanyaSeri] = useState<{ lama: Session; baru: Session } | null>(null)
  const [hapusSeri, setHapusSeri] = useState<Session | null>(null)
  /** Seret-pindah terakhir, untuk tombol Batalkan. */
  const [undo, setUndo] = useState<{ id: string; date: string; judul: string } | null>(null)
  useEffect(() => {
    if (!undo) return
    const t = setTimeout(() => setUndo(null), 10_000)
    return () => clearTimeout(t)
  }, [undo])

  const tersaring = useMemo(
    () => (sessions ?? []).filter((s) => filterJenis === 'all' || s.type === filterJenis),
    [sessions, filterJenis],
  )

  /** D3 — jumlah sesi per jenis, ditampilkan di pilihan penyaring. */
  const hitungJenis = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of sessions ?? []) m.set(s.type, (m.get(s.type) ?? 0) + 1)
    return m
  }, [sessions])

  function blank(date = todayISO()): Session {
    return {
      id: uid('s_'),
      title: '',
      type: 'latihan',
      date,
      startTime: '15:30',
      endTime: '18:00',
      place: '',
      notes: '',
      checklist: [],
      createdAt: Date.now(),
    }
  }

  function bukaBaru(date?: string) {
    setEditing(blank(date))
    setOpen(true)
  }

  async function save(s: Session, aturan: AturanSeri | null) {
    if (!s.title.trim()) {
      toast.push('Judul kegiatan wajib diisi', 'err')
      return
    }
    const lama = (sessions ?? []).find((x) => x.id === s.id)
    if (lama?.seriId) {
      setOpen(false)
      setTanyaSeri({ lama, baru: s })
      return
    }
    if (aturan) {
      const seri = buatSeri(s, aturan, () => uid('s_'), uid('seri_'))
      await db.sessions.bulkPut(seri)
      setOpen(false)
      toast.push(`${seri.length} jadwal dibuat`)
      return
    }
    await db.sessions.put(s)
    setOpen(false)
    toast.push('Jadwal disimpan')
  }

  async function simpanSeri(cakupan: 'ini' | 'berikutnya') {
    if (!tanyaSeri) return
    const hasil = ubahSeri(sessions ?? [], tanyaSeri.lama, tanyaSeri.baru, cakupan)
    await db.sessions.bulkPut(hasil)
    setTanyaSeri(null)
    toast.push(hasil.length > 1 ? `${hasil.length} jadwal diperbarui` : 'Jadwal disimpan')
  }

  async function remove(s: Session) {
    await db.sessions.delete(s.id)
    await db.attendance.where('sessionId').equals(s.id).delete()
    toast.push('Jadwal dihapus', 'info')
  }

  async function hapusSeriDari(s: Session) {
    if (!s.seriId) return
    const r = rencanaHapusSeri(sessions ?? [], s.seriId, absensi ?? [], s.date)
    await db.sessions.bulkDelete(r.hapus)
    setHapusSeri(null)
    toast.push(
      r.dipertahankan.length
        ? `${r.hapus.length} jadwal dihapus · ${r.dipertahankan.length} dipertahankan karena sudah ada absensinya`
        : `${r.hapus.length} jadwal dihapus`,
      'info',
    )
  }

  async function simpanDuplikat(s: Session, tanggal: string[]) {
    const salinan = tanggal.map((t) => salinSesi(s, t, () => uid('s_')))
    await db.sessions.bulkPut(salinan)
    setDuplikat(null)
    toast.push(salinan.length > 1 ? `${salinan.length} salinan dibuat` : `Disalin ke ${formatDateLong(tanggal[0])}`)
  }

  async function pindahTanggal(id: string, tanggal: string) {
    const s = (sessions ?? []).find((x) => x.id === id)
    if (!s || s.date === tanggal) return
    await db.sessions.update(id, { date: tanggal })
    setUndo({ id, date: s.date, judul: s.title })
    setHariPilih(tanggal)
  }

  async function batalkanPindah() {
    if (!undo) return
    await db.sessions.update(undo.id, { date: undo.date })
    setHariPilih(undo.date)
    setUndo(null)
    toast.push('Pemindahan dibatalkan', 'info')
  }

  async function toggleChecklist(s: Session, itemId: string) {
    const checklist = s.checklist.map((c) => (c.id === itemId ? { ...c, done: c.done ? 0 : 1 } : c))
    await db.sessions.update(s.id, { checklist })
  }

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

  function unduhSemuaICS() {
    const mendatang = tersaring.filter((s) => s.date >= hariIni)
    const potong: string[] = []
    for (const s of mendatang) {
      try {
        potong.push(bangunICS(s))
      } catch {
        /* sesi dengan jam rusak dilewati */
      }
    }
    if (!potong.length) {
      toast.push('Belum ada jadwal mendatang', 'info')
      return
    }
    downloadFile(`drillkit-jadwal-${hariIni}.ics`, gabungICS(potong), 'text/calendar')
    toast.push(`${potong.length} jadwal dimasukkan ke berkas kalender`)
  }

  function cetakBulan() {
    const { tahun, bulan } = bulanAktif
    const html = htmlKalenderBulan(tahun, bulan, tersaring, {
      namaTim: settings?.teamName,
      label: (t) => sesiMeta(t).label,
    })
    const dicetak = cetakAtauUnduh(html, `jadwal-${tahun}-${String(bulan).padStart(2, '0')}.html`)
    if (!dicetak) toast.push('Jendela cetak diblokir — berkas HTML diunduh, buka lalu tekan Ctrl+P', 'info')
  }

  const aksi: Aksi = {
    onToggle: toggleChecklist,
    onEdit: (s) => {
      setEditing(s)
      setOpen(true)
    },
    onDelete: remove,
    onDeleteSeri: (s) => setHapusSeri(s),
    onPacu: (s) => setPacuId(s.id),
    onDuplikat: (s) => setDuplikat(s),
  }

  const penampilan = penampilanTerdekat(tersaring, hariIni)

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
            <Button data-testid="ics-semua" onClick={unduhSemuaICS}>
              <IconCalendar size={16} /> .ics semua
            </Button>
            <Button variant="primary" data-testid="tambah-jadwal" onClick={() => bukaBaru()}>
              <IconPlus size={16} /> Tambah jadwal
            </Button>
          </>
        }
      />

      <Card className="mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div role="tablist" className="flex rounded-lg border border-slate-700 p-0.5">
            {(['bulan', 'agenda', 'daftar'] as const).map((t) => (
              <button
                key={t}
                role="tab"
                data-testid={`tampilan-${t}`}
                aria-selected={tampilan === t}
                onClick={() => setTampilan(t)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                  tampilan === t ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t === 'bulan' ? 'Bulan' : t === 'agenda' ? 'Agenda' : 'Daftar'}
              </button>
            ))}
          </div>
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
          {penampilan && (
            <p data-testid="hitung-penampilan" className="pb-1 text-xs text-amber-300">
              Penampilan terdekat — {penampilan.title}: <b>{teksHitungMundur(penampilan, new Date())}</b>
            </p>
          )}
        </div>
        <p className="mt-2 text-[11px] text-slate-500">
          Jenis kegiatan ikut menentukan rekap kehadiran — latihan section, latihan gabungan, dan
          penampilan bisa dilihat terpisah di menu <b>Absensi → Rekap</b>.
        </p>
      </Card>

      {undo && (
        <div data-testid="bilah-undo" className="mb-3 flex items-center justify-between gap-2 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs text-slate-300">
          <span>
            “{undo.judul}” dipindah dari {formatDateLong(undo.date)}.
          </span>
          <Button size="sm" data-testid="batal-pindah" onClick={batalkanPindah}>
            Batalkan
          </Button>
        </div>
      )}

      <RekapPenanda sesi={sessions ?? []} />

      {tampilan === 'bulan' ? (
        <TampilanBulan
          tahun={bulanAktif.tahun}
          bulan={bulanAktif.bulan}
          onGeser={(n) => setBulanAktif((b) => geserBulan(b.tahun, b.bulan, n))}
          onHariIni={() => {
            setBulanAktif({ tahun: Number(hariIni.slice(0, 4)), bulan: Number(hariIni.slice(5, 7)) })
            setHariPilih(hariIni)
          }}
          sesi={tersaring}
          absensi={absensi ?? []}
          ambang={ambang}
          hariIni={hariIni}
          hariPilih={hariPilih}
          onPilih={setHariPilih}
          onBaru={bukaBaru}
          onPindah={pindahTanggal}
          onCetak={cetakBulan}
          aksi={aksi}
        />
      ) : tampilan === 'daftar' ? (
        <TampilanDaftar sesi={tersaring} absensi={absensi ?? []} ambang={ambang} hariIni={hariIni} aksi={aksi} />
      ) : (
        <TampilanAgenda
          sesi={tersaring}
          absensi={absensi ?? []}
          ambang={ambang}
          hariIni={hariIni}
          lihatLewat={lihatLewat}
          setLihatLewat={setLihatLewat}
          aksi={aksi}
        />
      )}

      <SessionModal open={open} session={editing} baru={!!editing && !(sessions ?? []).some((x) => x.id === editing.id)} onClose={() => setOpen(false)} onSave={save} />

      <Modal
        open={!!tanyaSeri}
        onClose={() => setTanyaSeri(null)}
        title="Ubah jadwal berulang"
        testId="modal-ubah-seri"
        footer={
          <>
            <Button variant="ghost" onClick={() => setTanyaSeri(null)}>
              Batal
            </Button>
            <Button data-testid="ubah-ini" onClick={() => simpanSeri('ini')}>
              Hanya sesi ini
            </Button>
            <Button variant="primary" data-testid="ubah-berikutnya" onClick={() => simpanSeri('berikutnya')}>
              Semua berikutnya
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-300">
          Sesi ini bagian dari jadwal berulang. Terapkan perubahan ke sesi ini saja, atau ke sesi ini dan
          semua sesi sesudahnya dalam seri yang sama?
        </p>
        <p className="text-[11px] text-slate-500">
          “Hanya sesi ini” melepaskan sesi dari seri. “Semua berikutnya” tidak mengubah tanggal, dan centang
          checklist yang teksnya sama tetap dipertahankan.
        </p>
      </Modal>

      <Modal
        open={!!hapusSeri}
        onClose={() => setHapusSeri(null)}
        title="Hapus jadwal berulang"
        testId="modal-hapus-seri"
        footer={
          <>
            <Button variant="ghost" onClick={() => setHapusSeri(null)}>
              Batal
            </Button>
            <Button variant="danger" data-testid="hapus-seri-ya" onClick={() => hapusSeri && hapusSeriDari(hapusSeri)}>
              Hapus
            </Button>
          </>
        }
      >
        {hapusSeri &&
          (() => {
            const r = rencanaHapusSeri(sessions ?? [], hapusSeri.seriId ?? '', absensi ?? [], hapusSeri.date)
            return (
              <p className="text-sm text-slate-300">
                Menghapus <b>{r.hapus.length}</b> jadwal dalam seri ini mulai {formatDateLong(hapusSeri.date)}.
                {r.dipertahankan.length > 0 && (
                  <>
                    {' '}
                    <b>{r.dipertahankan.length}</b> sesi yang sudah punya absensi tidak ikut dihapus.
                  </>
                )}
              </p>
            )
          })()}
      </Modal>

      <DuplikatModal sesi={duplikat} onClose={() => setDuplikat(null)} onSimpan={simpanDuplikat} />

      {pacuSesi && <PacuLatihan sesi={pacuSesi} onClose={() => setPacuId(null)} />}
    </div>
  )
}

/* =============================== Bulan =============================== */

function TampilanBulan({
  tahun,
  bulan,
  onGeser,
  onHariIni,
  sesi,
  absensi,
  ambang,
  hariIni,
  hariPilih,
  onPilih,
  onBaru,
  onPindah,
  onCetak,
  aksi,
}: {
  tahun: number
  bulan: number
  onGeser: (n: number) => void
  onHariIni: () => void
  sesi: Session[]
  absensi: AttendanceRecord[]
  ambang: { baik: number; cukup: number }
  hariIni: string
  hariPilih: string
  onPilih: (t: string) => void
  onBaru: (t: string) => void
  onPindah: (id: string, t: string) => void
  onCetak: () => void
  aksi: Aksi
}) {
  const minggu = useMemo(() => susunBulan(tahun, bulan), [tahun, bulan])
  const per = useMemo(() => sesiPerTanggal(sesi), [sesi])
  const [seret, setSeret] = useState<string | null>(null)
  const pilihan = per.get(hariPilih) ?? []

  return (
    <div className="lg:grid lg:grid-cols-[1fr_22rem] lg:gap-4">
      <Card className="p-2 sm:p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" data-testid="bulan-mundur" onClick={() => onGeser(-1)} aria-label="Bulan sebelumnya">
              ‹
            </Button>
            <h2 data-testid="judul-bulan" className="min-w-[9rem] text-center text-sm font-semibold text-slate-100">
              {NAMA_BULAN[bulan - 1]} {tahun}
            </h2>
            <Button size="sm" variant="ghost" data-testid="bulan-maju" onClick={() => onGeser(1)} aria-label="Bulan berikutnya">
              ›
            </Button>
          </div>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" onClick={onHariIni}>
              Hari ini
            </Button>
            <Button size="sm" data-testid="cetak-bulan" onClick={onCetak}>
              Cetak
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-7 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          {NAMA_HARI_SENIN.map((h) => (
            <div key={h} className="py-1">
              {h}
            </div>
          ))}
        </div>
        <div data-testid="kotak-bulan" className="grid grid-cols-7 gap-px overflow-hidden rounded-md bg-slate-800">
          {minggu.flat().map((sel) => {
            const isi = per.get(sel.tanggal) ?? []
            const dipilih = sel.tanggal === hariPilih
            const hari = sel.tanggal === hariIni
            return (
              <div
                key={sel.tanggal}
                data-testid={`hari-${sel.tanggal}`}
                role="button"
                tabIndex={0}
                onClick={() => (isi.length || dipilih ? onPilih(sel.tanggal) : onBaru(sel.tanggal))}
                onKeyDown={(e) => e.key === 'Enter' && onPilih(sel.tanggal)}
                onDragOver={(e) => {
                  if (seret) e.preventDefault()
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  const id = e.dataTransfer.getData('text/plain') || seret
                  if (id) onPindah(id, sel.tanggal)
                  setSeret(null)
                }}
                className={`min-h-[3.25rem] cursor-pointer bg-slate-900 p-1 text-left sm:min-h-[5.5rem] ${
                  sel.bulanIni ? '' : 'opacity-40'
                } ${dipilih ? 'ring-2 ring-inset ring-emerald-500' : 'hover:bg-slate-800/70'}`}
                title={isi.length ? undefined : 'Ketuk untuk membuat jadwal di tanggal ini'}
              >
                <div
                  className={`mb-0.5 inline-grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px] ${
                    hari ? 'bg-emerald-500 font-bold text-slate-950' : 'text-slate-400'
                  }`}
                >
                  {Number(sel.tanggal.slice(8))}
                </div>
                {/* HP: titik berwarna */}
                <div className="flex flex-wrap gap-0.5 sm:hidden">
                  {isi.map((s) => (
                    <span key={s.id} className={`h-1.5 w-1.5 rounded-full ${TITIK[s.type] ?? TITIK.lainnya}`} />
                  ))}
                </div>
                {/* Laptop/tablet: label */}
                <div className="hidden space-y-0.5 sm:block">
                  {isi.map((s) => {
                    const r = ringkasSesi(s, absensi)
                    const lewat = s.date < hariIni
                    return (
                      <div
                        key={s.id}
                        data-testid={`label-${s.id}`}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', s.id)
                          e.dataTransfer.effectAllowed = 'move'
                          setSeret(s.id)
                        }}
                        onDragEnd={() => setSeret(null)}
                        onClick={(e) => {
                          e.stopPropagation()
                          onPilih(sel.tanggal)
                        }}
                        className={`truncate rounded border px-1 py-0.5 text-[10px] leading-tight ${sesiMeta(s.type).color}`}
                        title={`${s.startTime}–${s.endTime} ${s.title} (seret untuk memindah tanggal)`}
                      >
                        <b>{s.startTime}</b> {s.title}
                        <span className="ml-1 opacity-80">
                          {lewat
                            ? r.persenHadir != null && (
                                <span className={NADA[nadaKehadiran(r.persenHadir, ambang)]}>{r.persenHadir}%</span>
                              )
                            : (
                                <>
                                  {r.checklistTotal > 0 && `${r.checklistSelesai}/${r.checklistTotal}`}
                                  {(r.adaRencana || r.adaSetList) && ' ●'}
                                </>
                              )}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
        <p className="mt-2 hidden text-[11px] text-slate-500 sm:block">
          Ketuk tanggal kosong untuk membuat jadwal. Seret label ke tanggal lain untuk memindahkannya. Sesi
          lewat menampilkan % hadir, sesi mendatang menampilkan checklist (●: ada rencana/set list).
        </p>
      </Card>

      <div data-testid="detail-hari" className="mt-4 lg:mt-0">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {NAMA_HARI_PANJANG[hariSenin(hariPilih)]}, {formatDateLong(hariPilih).split(', ')[1]}
          </h2>
          <Button size="sm" data-testid="baru-di-hari" onClick={() => onBaru(hariPilih)}>
            <IconPlus size={14} /> Jadwal
          </Button>
        </div>
        {pilihan.length === 0 ? (
          <EmptyState icon={<IconCalendar size={28} />} title="Tidak ada jadwal di tanggal ini." />
        ) : (
          <div className="space-y-3">
            {pilihan.map((s) => (
              <SesiKartu key={s.id} s={s} absensi={absensi} ambang={ambang} muted={s.date < hariIni} aksi={aksi} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* =============================== Agenda =============================== */

function TampilanAgenda({
  sesi,
  absensi,
  ambang,
  hariIni,
  lihatLewat,
  setLihatLewat,
  aksi,
}: {
  sesi: Session[]
  absensi: AttendanceRecord[]
  ambang: { baik: number; cukup: number }
  hariIni: string
  lihatLewat: boolean
  setLihatLewat: (b: boolean) => void
  aksi: Aksi
}) {
  const [buka, setBuka] = useState<string | null>(null)
  const sekarang = new Date()
  const berikut = sesiBerikutnya(sesi, hariIni, nowTime())
  const mendatang = sesi.filter((s) => s.date >= hariIni && s.id !== berikut?.id)
  const lewat = sesi.filter((s) => s.date < hariIni || (s.date === hariIni && s.id !== berikut?.id && !mendatang.includes(s)))
  const kelompok = kelompokPerMinggu(mendatang, hariIni)
  const kelompokLewat = kelompokPerMinggu(lewat, hariIni).reverse()

  const baris = (s: Session) => {
    const r = ringkasSesi(s, absensi)
    const terbuka = buka === s.id
    return (
      <li key={s.id}>
        <button
          data-testid={`baris-${s.id}`}
          onClick={() => setBuka(terbuka ? null : s.id)}
          className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-slate-800/60"
        >
          <span className={`h-2 w-2 shrink-0 rounded-full ${TITIK[s.type] ?? TITIK.lainnya}`} />
          <span className="w-24 shrink-0 text-xs text-slate-400">
            {NAMA_HARI_SENIN[hariSenin(s.date)]} {Number(s.date.slice(8))}/{Number(s.date.slice(5, 7))}
          </span>
          <span className="w-12 shrink-0 text-xs text-slate-500">{s.startTime}</span>
          <span className="min-w-0 flex-1 truncate text-sm text-slate-200">{s.title}</span>
          <span className="shrink-0 text-[11px] text-slate-500">
            {s.date < hariIni
              ? r.persenHadir != null && <span className={NADA[nadaKehadiran(r.persenHadir, ambang)]}>{r.persenHadir}%</span>
              : r.checklistTotal > 0 && `${r.checklistSelesai}/${r.checklistTotal}`}
            {s.seriId && ' ↻'}
          </span>
        </button>
        {terbuka && (
          <div className="mt-1 mb-2">
            <SesiKartu s={s} absensi={absensi} ambang={ambang} muted={s.date < hariIni} aksi={aksi} />
          </div>
        )}
      </li>
    )
  }

  return (
    <div className="space-y-5">
      {berikut ? (
        <div data-testid="sesi-berikutnya">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Sesi berikutnya · <span className="text-emerald-400">{teksHitungMundur(berikut, sekarang)}</span>
          </h2>
          <SesiKartu s={berikut} absensi={absensi} ambang={ambang} aksi={aksi} besar />
        </div>
      ) : (
        <EmptyState icon={<IconCalendar size={28} />} title="Belum ada jadwal mendatang." />
      )}

      {kelompok.map((k) => (
        <div key={k.awal}>
          <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{k.label}</h2>
          <Card className="p-1">
            <ul className="divide-y divide-slate-800">{k.sesi.map(baris)}</ul>
          </Card>
        </div>
      ))}

      {lewat.length > 0 && (
        <div>
          <Button size="sm" variant="ghost" data-testid="lihat-lewat" onClick={() => setLihatLewat(!lihatLewat)}>
            {lihatLewat ? 'Sembunyikan' : 'Tampilkan'} yang sudah lewat ({lewat.length})
          </Button>
          {lihatLewat &&
            kelompokLewat.map((k) => (
              <div key={k.awal} className="mt-3 opacity-80">
                <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{k.label}</h2>
                <Card className="p-1">
                  <ul className="divide-y divide-slate-800">{[...k.sesi].reverse().map(baris)}</ul>
                </Card>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}

/* =============================== Daftar (lama) =============================== */

/** Tampilan lama: semua kartu terbuka, "Mendatang" lalu "Sudah lewat". */
function TampilanDaftar({
  sesi,
  absensi,
  ambang,
  hariIni,
  aksi,
}: {
  sesi: Session[]
  absensi: AttendanceRecord[]
  ambang: { baik: number; cukup: number }
  hariIni: string
  aksi: Aksi
}) {
  const up = sesi.filter((s) => s.date >= hariIni)
  const pa = sesi.filter((s) => s.date < hariIni).reverse()
  const bagian = (judul: string, isi: Session[], kosong: string, muted?: boolean) => (
    <div>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {judul} ({isi.length})
      </h2>
      {isi.length === 0 ? (
        <EmptyState icon={<IconCalendar size={28} />} title={kosong} />
      ) : (
        <div className="space-y-3">
          {isi.map((s) => (
            <SesiKartu key={s.id} s={s} absensi={absensi} ambang={ambang} muted={muted} aksi={aksi} />
          ))}
        </div>
      )}
    </div>
  )
  return (
    <div className="space-y-6">
      {bagian('Mendatang', up, 'Belum ada jadwal mendatang.')}
      {bagian('Sudah lewat', pa, 'Belum ada riwayat kegiatan.', true)}
    </div>
  )
}

/* =============================== Kartu sesi =============================== */

function SesiKartu({
  s,
  absensi,
  ambang,
  muted,
  besar,
  aksi,
}: {
  s: Session
  absensi: AttendanceRecord[]
  ambang: { baik: number; cukup: number }
  muted?: boolean
  besar?: boolean
  aksi: Aksi
}) {
  const { onToggle, onEdit, onDelete, onDeleteSeri, onPacu, onDuplikat } = aksi
  const r = ringkasSesi(s, absensi)
  return (
    <Card data-testid={`kartu-${s.id}`} className={`${muted ? 'opacity-80' : ''} ${besar ? 'border-emerald-500/40' : ''}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={sesiMeta(s.type).color}>{sesiMeta(s.type).label}</Badge>
            <span className="text-xs font-medium text-emerald-400">{relativeDay(s.date)}</span>
            <span className="text-xs text-slate-500">
              {s.startTime}–{s.endTime}
            </span>
            {s.seriId && <span className="text-[10px] text-slate-500" title="Jadwal berulang">↻ berulang</span>}
            {muted && r.persenHadir != null && (
              <span data-testid={`hadir-${s.id}`} className={`text-[11px] font-semibold ${NADA[nadaKehadiran(r.persenHadir, ambang)]}`}>
                hadir {r.persenHadir}%
              </span>
            )}
          </div>
          <p className={`mt-1.5 font-semibold text-slate-100 ${besar ? 'text-base' : 'text-sm'}`}>{s.title}</p>
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
          <Button
            size="sm"
            variant="ghost"
            data-testid={`ics-${s.id}`}
            onClick={() => unduhICS(s)}
          >
            Kalender
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onEdit(s)}>
            Edit
          </Button>
          <Button size="sm" variant="ghost" data-testid={`duplikat-${s.id}`} onClick={() => onDuplikat(s)}>
            Duplikat
          </Button>
          <ConfirmButton onConfirm={() => onDelete(s)} message="Hapus jadwal?" />
          {s.seriId && (
            <Button size="sm" variant="ghost" data-testid={`hapus-seri-${s.id}`} onClick={() => onDeleteSeri(s)}>
              Hapus seri…
            </Button>
          )}
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
  )
}

function SessionModal({
  open,
  session,
  baru,
  onClose,
  onSave,
}: {
  open: boolean
  session: Session | null
  /** #3 — sesi belum tersimpan: pilihan "ulangi mingguan" ditampilkan */
  baru: boolean
  onClose: () => void
  onSave: (s: Session, aturan: AturanSeri | null) => void
}) {
  const [s, setS] = useState<Session | null>(session)
  const [newItem, setNewItem] = useState('')
  const [ulang, setUlang] = useState(false)
  const [hariUlang, setHariUlang] = useState<number[]>([])
  const [akhirUlang, setAkhirUlang] = useState('')
  useEffect(() => {
    setS(session)
    setUlang(false)
    if (session) {
      setHariUlang([hariSenin(session.date)])
      setAkhirUlang(tambahHari(session.date, 7 * 8))
    }
  }, [session])

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
          <Button
            variant="primary"
            data-testid="simpan-jadwal"
            onClick={() => onSave(s, baru && ulang ? { hari: hariUlang, mulai: s.date, akhir: akhirUlang } : null)}
          >
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
      {baru && (
        <div data-testid="atur-ulang" className="rounded-lg border border-slate-700 p-3">
          <label className="flex items-center gap-2 text-sm text-slate-200">
            <input type="checkbox" data-testid="ulangi-mingguan" checked={ulang} onChange={(e) => setUlang(e.target.checked)} />
            Ulangi mingguan
          </label>
          {ulang && (
            <div className="mt-2 space-y-2">
              <div className="flex flex-wrap gap-1">
                {NAMA_HARI_SENIN.map((h, i) => {
                  const on = hariUlang.includes(i)
                  return (
                    <button
                      key={h}
                      type="button"
                      data-testid={`ulang-hari-${i}`}
                      onClick={() => setHariUlang(on ? hariUlang.filter((x) => x !== i) : [...hariUlang, i].sort())}
                      className={`rounded-md border px-2 py-1 text-xs ${
                        on ? 'border-emerald-500 bg-emerald-500/20 text-emerald-200' : 'border-slate-600 text-slate-400'
                      }`}
                    >
                      {h}
                    </button>
                  )
                })}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                Sampai
                <Input type="date" data-testid="ulang-akhir" value={akhirUlang} min={s.date} onChange={(e) => setAkhirUlang(e.target.value)} className="w-44" />
              </div>
              <p data-testid="ulang-ringkas" className="text-[11px] text-slate-500">
                {(() => {
                  const n = tanggalSeri({ hari: hariUlang, mulai: s.date, akhir: akhirUlang }).length
                  return n
                    ? `${n} sesi akan dibuat, mulai ${formatDateLong(s.date)}. Checklist dan rencana latihan ikut tersalin.`
                    : 'Pilih minimal satu hari dan tanggal akhir sesudah tanggal mulai.'
                })()}
              </p>
            </div>
          )}
        </div>
      )}
      {s.seriId && !baru && (
        <p className="text-[11px] text-slate-500">↻ Sesi ini bagian dari jadwal berulang. Saat disimpan, kamu bisa memilih menerapkannya ke sesi ini saja atau semua berikutnya.</p>
      )}
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

/**
 * #3 — duplikat sesi ke satu atau beberapa tanggal lain. Checklist ikut
 * tersalin tanpa centang; realisasi & penanda sesi tidak ikut.
 */
function DuplikatModal({
  sesi,
  onClose,
  onSimpan,
}: {
  sesi: Session | null
  onClose: () => void
  onSimpan: (s: Session, tanggal: string[]) => void
}) {
  const [tanggal, setTanggal] = useState<string[]>([])
  const [isi, setIsi] = useState('')
  useEffect(() => {
    if (sesi) {
      const t = tambahHari(sesi.date, 7)
      setTanggal([t])
      setIsi(t)
    }
  }, [sesi])
  if (!sesi) return null
  return (
    <Modal
      open={!!sesi}
      onClose={onClose}
      title="Duplikat jadwal"
      testId="modal-duplikat"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button variant="primary" data-testid="duplikat-simpan" disabled={!tanggal.length} onClick={() => onSimpan(sesi, tanggal)}>
            Salin ke {tanggal.length} tanggal
          </Button>
        </>
      }
    >
      <p className="text-sm text-slate-300">
        Salin “{sesi.title}” ({sesi.startTime}–{sesi.endTime}). Checklist dan rencana ikut, tanpa centang.
      </p>
      <div className="flex items-end gap-2">
        <Field label="Tanggal">
          <Input type="date" data-testid="duplikat-tanggal" value={isi} onChange={(e) => setIsi(e.target.value)} />
        </Field>
        <Button
          data-testid="duplikat-tambah"
          onClick={() => isi && !tanggal.includes(isi) && setTanggal([...tanggal, isi].sort())}
        >
          Tambah tanggal
        </Button>
      </div>
      <div className="flex flex-wrap gap-1">
        {tanggal.map((t) => (
          <span key={t} className="flex items-center gap-1 rounded-full border border-slate-600 px-2 py-0.5 text-xs text-slate-300">
            {formatDateLong(t)}
            <button onClick={() => setTanggal(tanggal.filter((x) => x !== t))} className="text-slate-500 hover:text-rose-300">
              ✕
            </button>
          </span>
        ))}
      </div>
    </Modal>
  )
}
