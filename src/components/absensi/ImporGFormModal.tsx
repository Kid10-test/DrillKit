/**
 * v2.8 — Absensi → Impor Form: CSV jawaban Google Form (presensi, izin,
 * atau rekap absen fisik) → pratinjau per baris → terapkan. Dimuat malas.
 */
import { useMemo, useState } from 'react'
import type { AttendanceRecord, Member, ProgramLatihan, Session } from '../../db/types'
import { db } from '../../db/db'
import { Button, Modal, Select, useToast } from '../ui'
import { aturanUntukSesi } from '../../lib/programLatsar'
import {
  bacaCsvForm,
  rencanakanImporForm,
  ringkasRencanaForm,
  tebakKolomGForm,
  tebakUrutanTanggal,
  terapkanImporForm,
  type AksiImpor,
  type JenisFormImpor,
  type KolomGForm,
  type PetaKolomGForm,
  type UrutanTanggal,
} from '../../lib/imporGForm'
import { namaTampil, bacaModeNama } from '../../lib/namaAnggota'
import { cx, uid } from '../../lib/utils'

const JENIS: { id: JenisFormImpor; label: string; ket: string }[] = [
  { id: 'presensi', label: 'Presensi', ket: 'Form yang dibuka ±24 jam sebelum latihan. Disimpan sebagai “sudah isi Form”, bukan hadir.' },
  { id: 'izin', label: 'Izin / sakit', ket: 'Jam lapor = cap waktu Form; kategori ditebak dari jawaban; kolom unggah jadi tautan bukti.' },
  { id: 'datang', label: 'Absen fisik', ket: 'Rekap admin: nama + jam datang (+ alasan telat). Menandai hadir.' },
]

const LABEL_KOLOM: Record<KolomGForm, string> = {
  waktu: 'Cap waktu',
  nama: 'Nama',
  tanggal: 'Tanggal latihan',
  jam: 'Jam datang',
  alasan: 'Alasan / keterangan',
  kategori: 'Kategori izin',
  bukti: 'Bukti (unggah)',
}
const KOLOM_PER_JENIS: Record<JenisFormImpor, KolomGForm[]> = {
  presensi: ['nama', 'waktu', 'tanggal'],
  izin: ['nama', 'waktu', 'tanggal', 'kategori', 'alasan', 'bukti'],
  datang: ['nama', 'tanggal', 'waktu', 'jam', 'alasan', 'bukti'],
}
const WARNA_AKSI: Record<AksiImpor, string> = {
  tambah: 'bg-emerald-600 text-white',
  perbarui: 'bg-sky-600 text-white',
  sama: 'bg-slate-700 text-slate-200',
  bentrok: 'bg-amber-600 text-white',
  ganda: 'bg-slate-600 text-slate-200',
  lewati: 'bg-rose-700 text-white',
}
const LABEL_AKSI: Record<AksiImpor, string> = {
  tambah: 'Tambah',
  perbarui: 'Perbarui',
  sama: 'Sama',
  bentrok: 'Bentrok',
  ganda: 'Ganda',
  lewati: 'Lewati',
}

export default function ImporGFormModal({
  open,
  onClose,
  members,
  sessions,
  records,
  sesiAwal,
  program,
}: {
  open: boolean
  onClose: () => void
  members: Member[]
  sessions: Session[]
  records: AttendanceRecord[]
  sesiAwal: string
  program: ProgramLatihan[]
}) {
  const toast = useToast()
  const [jenis, setJenis] = useState<JenisFormImpor>('presensi')
  const [teks, setTeks] = useState('')
  const [namaBerkas, setNamaBerkas] = useState('')
  const [peta, setPeta] = useState<PetaKolomGForm | null>(null)
  const [urutan, setUrutan] = useState<UrutanTanggal>('dmy')
  const [sesiTetap, setSesiTetap] = useState('')
  const [pilihan, setPilihan] = useState<Record<number, string | null>>({})
  const [sibuk, setSibuk] = useState(false)

  const tabel = useMemo(() => (teks.trim() ? bacaCsvForm(teks) : []), [teks])
  const judul = tabel[0] ?? []
  const data = useMemo(() => tabel.slice(1), [tabel])
  const anggota = useMemo(() => members.filter((m) => m.active), [members])
  /** Sesi kandidat: milik program latihan bila ada, selain itu semua sesi. */
  const kandidatSesi = useMemo(() => {
    const ids = new Set(program.flatMap((p) => p.sesiIds))
    const milik = sessions.filter((s) => ids.has(s.id))
    return milik.length ? milik : sessions
  }, [program, sessions])
  const kategori = aturanUntukSesi(program, sesiTetap || sesiAwal).kategoriIzin

  function muat(isi: string) {
    setTeks(isi)
    const t = bacaCsvForm(isi)
    const p = tebakKolomGForm(t[0] ?? [])
    setPeta(p)
    setUrutan(tebakUrutanTanggal(t.slice(1, 40).map((b) => (p.waktu >= 0 ? (b[p.waktu] ?? '') : p.tanggal >= 0 ? (b[p.tanggal] ?? '') : ''))))
    setPilihan({})
  }

  const rencana = useMemo(
    () =>
      peta && data.length
        ? rencanakanImporForm({ jenis, baris: data, peta, urutan, anggota, sesi: kandidatSesi, catatan: records, kategori, sesiTetap: sesiTetap || undefined, pilihan })
        : [],
    [jenis, data, peta, urutan, anggota, kandidatSesi, records, kategori, sesiTetap, pilihan],
  )
  const ringkas = ringkasRencanaForm(rencana)
  const akanDitulis = ringkas.tambah + ringkas.perbarui
  const perSesi = useMemo(() => new Map(sessions.map((s) => [s.id, s])), [sessions])
  const perAnggota = useMemo(() => new Map(members.map((m) => [m.id, m])), [members])
  const mode = bacaModeNama()

  async function terapkan() {
    setSibuk(true)
    try {
      const h = terapkanImporForm(jenis, rencana, records, sessions, () => uid('a_'))
      await db.transaction('rw', db.attendance, db.sessions, async () => {
        if (h.catatan.length) await db.attendance.bulkPut(h.catatan)
        for (const [id, form] of Object.entries(h.form)) await db.sessions.update(id, { formPresensi: form })
      })
      toast.push(`${h.jumlah} isian Form diterapkan`)
      onClose()
    } finally {
      setSibuk(false)
    }
  }

  const kolomTampil = KOLOM_PER_JENIS[jenis]
  const sesiUrut = [...kandidatSesi].sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`))

  return (
    <Modal open={open} onClose={onClose} title="Impor jawaban Google Form" wide testId="modal-impor-gform">
      <div className="flex flex-wrap gap-1.5">
        {JENIS.map((j) => (
          <button
            key={j.id}
            type="button"
            data-testid={`gform-jenis-${j.id}`}
            aria-pressed={jenis === j.id}
            onClick={() => {
              setJenis(j.id)
              setPilihan({})
            }}
            className={cx(
              'rounded-md border px-2.5 py-1 text-xs font-medium',
              jenis === j.id ? 'border-emerald-500 bg-emerald-500/20 text-emerald-200' : 'border-slate-600 text-slate-400',
            )}
          >
            {j.label}
          </button>
        ))}
      </div>
      <p className="text-[12px] text-slate-400">{JENIS.find((j) => j.id === jenis)!.ket}</p>
      <p className="text-[11px] text-slate-500">
        Di Google Form: tab <b>Jawaban</b> → ⋮ → <b>Download responses (.csv)</b>, atau dari Google Sheets: File → Download → CSV. Berkas dibaca di
        perangkat ini saja.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <label className="cursor-pointer rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800">
          Pilih berkas CSV
          <input
            type="file"
            accept=".csv,text/csv,text/plain"
            className="hidden"
            data-testid="gform-berkas"
            onChange={async (e) => {
              const f = e.target.files?.[0]
              if (!f) return
              setNamaBerkas(f.name)
              muat(await f.text())
              e.target.value = ''
            }}
          />
        </label>
        <span className="text-[11px] text-slate-500">{namaBerkas || (data.length ? `${data.length} baris ditempel` : 'atau tempel isinya di bawah')}</span>
      </div>
      <textarea
        data-testid="gform-tempel"
        value={teks}
        onChange={(e) => muat(e.target.value)}
        rows={data.length ? 2 : 4}
        placeholder={'Timestamp,Nama lengkap,Seksi\n12/11/2026 14:03:22,Nama Anggota,Brass'}
        className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 font-mono text-[11px] text-slate-100 outline-none focus:border-emerald-500"
      />

      {peta && judul.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {kolomTampil.map((k) => (
              <label key={k} className="text-[11px] text-slate-400">
                {LABEL_KOLOM[k]}
                <Select data-testid={`gform-kolom-${k}`} value={peta[k]} onChange={(e) => setPeta({ ...peta, [k]: Number(e.target.value) })}>
                  <option value={-1}>— tidak ada —</option>
                  {judul.map((j, i) => (
                    <option key={i} value={i}>
                      {j || `Kolom ${i + 1}`}
                    </option>
                  ))}
                </Select>
              </label>
            ))}
            <label className="text-[11px] text-slate-400">
              Format tanggal
              <Select data-testid="gform-urutan" value={urutan} onChange={(e) => setUrutan(e.target.value as UrutanTanggal)}>
                <option value="dmy">hari/bulan/tahun</option>
                <option value="mdy">bulan/hari/tahun</option>
              </Select>
            </label>
            <label className="text-[11px] text-slate-400">
              Sesi
              <Select data-testid="gform-sesi" value={sesiTetap} onChange={(e) => setSesiTetap(e.target.value)}>
                <option value="">Otomatis dari tanggal / cap waktu</option>
                {sesiUrut.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.date} — {s.title}
                  </option>
                ))}
              </Select>
            </label>
          </div>

          <div className="flex flex-wrap gap-1.5 text-[11px]" data-testid="gform-ringkas">
            {(Object.keys(ringkas) as AksiImpor[])
              .filter((k) => ringkas[k] > 0)
              .map((k) => (
                <span key={k} data-testid={`gform-jumlah-${k}`} className={cx('rounded px-1.5 py-0.5 font-medium', WARNA_AKSI[k])}>
                  {LABEL_AKSI[k]} {ringkas[k]}
                </span>
              ))}
          </div>

          <div className="max-h-[45vh] overflow-auto rounded-lg border border-slate-800">
            <table className="w-full text-[11px]">
              <thead className="sticky top-0 bg-slate-900 text-slate-400">
                <tr>
                  <th className="px-1.5 py-1 text-left">#</th>
                  <th className="px-1.5 py-1 text-left">Nama di Form</th>
                  <th className="px-1.5 py-1 text-left">Anggota</th>
                  <th className="px-1.5 py-1 text-left">Sesi</th>
                  <th className="px-1.5 py-1 text-left">Hasil</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 text-slate-300">
                {rencana.slice(0, 300).map((b) => {
                  const s = b.sesiId ? perSesi.get(b.sesiId) : undefined
                  const m = b.memberId ? perAnggota.get(b.memberId) : undefined
                  const ragu = !b.cocok.memberId || b.no in pilihan
                  return (
                    <tr key={b.no} data-testid={`gform-baris-${b.no}`} data-aksi={b.aksi}>
                      <td className="px-1.5 py-1 text-slate-500">{b.no}</td>
                      <td className="max-w-[9rem] truncate px-1.5 py-1">{b.nama || '—'}</td>
                      <td className="px-1.5 py-1">
                        {ragu && b.nama ? (
                          <select
                            data-testid={`gform-pilih-${b.no}`}
                            value={b.memberId ?? ''}
                            onChange={(e) => setPilihan({ ...pilihan, [b.no]: e.target.value || null })}
                            className="w-36 rounded border border-slate-700 bg-slate-950 px-1 py-0.5 text-[11px] text-slate-100"
                          >
                            <option value="">— pilih —</option>
                            {b.cocok.kandidat.map((k) => {
                              const a = perAnggota.get(k.memberId)
                              return a ? (
                                <option key={k.memberId} value={k.memberId}>
                                  {namaTampil(a, mode)} ({Math.round(k.skor * 100)}%)
                                </option>
                              ) : null
                            })}
                            <option disabled>──────</option>
                            {anggota
                              .filter((a) => !b.cocok.kandidat.some((k) => k.memberId === a.id))
                              .map((a) => (
                                <option key={a.id} value={a.id}>
                                  {namaTampil(a, mode)}
                                </option>
                              ))}
                          </select>
                        ) : (
                          <span className="text-slate-200">{m ? namaTampil(m, mode) : '—'}</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-1.5 py-1 text-slate-400">{s ? s.date : '—'}</td>
                      <td className="px-1.5 py-1">
                        <span className={cx('mr-1 rounded px-1 py-0.5 text-[10px] font-semibold', WARNA_AKSI[b.aksi])}>{LABEL_AKSI[b.aksi]}</span>
                        <span className="text-slate-400">
                          {b.pesan}
                          {jenis === 'izin' && b.kategori ? ` · ${b.kategori === 'lain' ? 'di luar daftar' : (kategori.find((k) => k.id === b.kategori)?.nama ?? b.kategori)}` : ''}
                          {jenis === 'izin' && b.bukti ? ' · ada bukti' : ''}
                          {jenis === 'datang' && b.jamDatang != null
                            ? ` · ${String(Math.floor(b.jamDatang / 60)).padStart(2, '0')}.${String(b.jamDatang % 60).padStart(2, '0')}`
                            : ''}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {rencana.length > 300 && <p className="text-[11px] text-slate-500">Menampilkan 300 dari {rencana.length} baris.</p>}
        </>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Batal
        </Button>
        <Button variant="primary" data-testid="gform-terapkan" disabled={!akanDitulis || sibuk} onClick={terapkan}>
          Terapkan {akanDitulis} baris
        </Button>
      </div>
    </Modal>
  )
}
