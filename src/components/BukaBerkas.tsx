/**
 * #7 — satu pintu "Buka berkas DrillKit".
 *
 * Cara pakai:
 * - Tombol: `<TombolBukaBerkas />` — dipasang di menu Data & Dashboard.
 * - Global: `<PratinjauGlobal />` + `<LapisanSeretBerkas />` — dipasang
 *   sekali di `Layout`, supaya tombol LAMA pun bisa mengalihkan berkas yang
 *   bukan jenisnya ke pratinjau yang benar lewat `mintaPratinjau()`.
 * - Lintas halaman: `titipBerkas()` + `ambilTitipan()` — pratinjau menitipkan
 *   berkasnya lalu pindah rute, halaman tujuan mengambil & meneruskannya ke
 *   alur yang sudah ada (impor Data, impor CSV, ...).
 *
 * Aturan mode ditegakkan di pratinjau, bukan di tombol: berkas apa pun boleh
 * dipilih/diseret, tetapi paket anggota ditolak di mode pelatih dan mode
 * anggota hanya menerima paket — selalu dengan penjelasan, bukan diam-diam.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../db/db'
import { useMemberMode } from '../hooks/useMemberMode'
import {
  LABEL_JENIS,
  TUJUAN_JENIS,
  aturMode,
  kenaliBerkas,
  ringkasCsv,
  ringkasDataPindah,
  ringkasPaket,
  type BerkasDikenal,
  type JenisBerkas,
} from '../lib/bukaBerkas'
import { simpanPaketAnggota } from '../lib/paketMasuk'
import { cekBerkas, type BerkasShow } from '../lib/show'
import { bacaPaket, perluPeringatan, ringkasanImpor, terapkanPaket } from '../lib/repertoar'
import type { PaketRepertoar } from '../db/types'
import { Button, Modal, useToast } from './ui'
import { IconUpload } from './Icons'
import { AlurPulihkanBackup, ekstrakAudioZip } from './PulihkanBackup'
import { AlurImporShow } from './ImporShow'

/* ------------------------- Bus pratinjau global -------------------------- */

export interface PaketPratinjau {
  hasil: BerkasDikenal
  /** Bita mentah (ZIP) — dibutuhkan untuk mengekstrak audio saat pulihkan. */
  bita?: Uint8Array
}

type Pendengar = (paket: PaketPratinjau | null) => void
const pendengar = new Set<Pendengar>()

/**
 * Minta pratinjau global dibuka untuk berkas ini.
 *
 * Dipakai tombol baru DAN tombol lama yang menerima berkas di luar jenisnya
 * ("mengalihkan ke pratinjau yang benar").
 */
export function mintaPratinjau(hasil: BerkasDikenal, bita?: Uint8Array): void {
  for (const fn of pendengar) fn({ hasil, bita })
}

export function tutupPratinjau(): void {
  for (const fn of pendengar) fn(null)
}

function langgananPratinjau(fn: Pendengar): () => void {
  pendengar.add(fn)
  return () => {
    pendengar.delete(fn)
  }
}

/* ------------------------------ Titipan ---------------------------------- */

/** Berkas yang dititipkan pratinjau untuk halaman tujuan. */
export interface TitipanBerkas {
  jenis: JenisBerkas
  nama: string
  teks: string
}

let titipan: TitipanBerkas | null = null

export function titipBerkas(t: TitipanBerkas): void {
  titipan = t
  // Beri tahu halaman yang SUDAH terbuka (pratinjau bisa dibuka dari halaman
  // tujuannya sendiri — navigasi ke rute yang sama tidak me-mount ulang).
  try {
    window.dispatchEvent(new CustomEvent('drillkit:titipan'))
  } catch {
    // bukan peramban — abaikan
  }
}

/** Intip titipan tanpa mengambilnya (untuk memilih tab sebelum mount). */
export function intipTitipan(): TitipanBerkas | null {
  return titipan
}

/**
 * Ambil titipan bila jenisnya cocok (sekali ambil, langsung hangus).
 * Tanpa argumen: ambil apa pun yang ada.
 */
export function ambilTitipan(boleh?: JenisBerkas[]): TitipanBerkas | null {
  if (!titipan) return null
  if (boleh && !boleh.includes(titipan.jenis)) return null
  const t = titipan
  titipan = null
  return t
}

/**
 * Pakai titipan: ambil yang menunggu saat dipasang, lalu dengarkan yang
 * datang kemudian. Sekali ambil langsung hangus (tidak diproses dua kali).
 */
export function useTitipan(boleh: JenisBerkas[], cb: (t: TitipanBerkas) => void): void {
  useEffect(() => {
    const cek = () => {
      const t = ambilTitipan(boleh)
      if (t) cb(t)
    }
    cek()
    window.addEventListener('drillkit:titipan', cek)
    return () => window.removeEventListener('drillkit:titipan', cek)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}

/* ------------------------------ Kenali ----------------------------------- */

/** Baca `File` dari pemilih/seretan lalu kenali dari isinya. */
export async function kenaliFile(file: File): Promise<{ hasil: BerkasDikenal; bita: Uint8Array }> {
  const bita = new Uint8Array(await file.arrayBuffer())
  return { hasil: kenaliBerkas(file.name, bita), bita }
}

/* --------------------------- Tombol pintu baru --------------------------- */

export function TombolBukaBerkas({
  label = 'Buka berkas DrillKit',
  variant = 'primary',
  size: _ukuran = 'md',
  testId = 'buka-berkas',
  petunjuk = true,
}: {
  label?: string
  variant?: 'primary' | 'ghost' | 'outline'
  size?: 'sm' | 'md'
  testId?: string
  petunjuk?: boolean
}) {
  const toast = useToast()
  return (
    <span className="inline-flex flex-col gap-1">
      <label
        data-testid={testId}
        className="inline-flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium"
        style={
          variant === 'primary'
            ? { backgroundColor: '#059669', color: '#ffffff' }
            : variant === 'outline'
              ? { border: '1px solid #475569', color: '#e2e8f0' }
              : { color: '#e2e8f0' }
        }
        title="Buka berkas apa pun — backup, data, show, lagu, paket, CSV, ZIP. Jenisnya dikenali otomatis."
      >
        <IconUpload size={16} /> {label}
        <input
          type="file"
          accept=".json,.csv,.zip,application/json,text/csv,application/zip"
          data-testid={`${testId}-input`}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (!f) return
            void kenaliFile(f)
              .then(({ hasil, bita }) => mintaPratinjau(hasil, bita))
              .catch(() => toast.push('Berkas tidak bisa dibaca', 'err'))
          }}
        />
      </label>
      {petunjuk && (
        <span className="text-[11px] text-slate-500">
          Backup, data, show, lagu, paket, CSV, ZIP — jenisnya dikenali otomatis.
        </span>
      )}
    </span>
  )
}

/* --------------------------- Pratinjau global ---------------------------- */

export function PratinjauGlobal() {
  const [paket, setPaket] = useState<PaketPratinjau | null>(null)
  useEffect(() => langgananPratinjau(setPaket), [])
  return (
    <Modal
      open={paket != null}
      onClose={() => setPaket(null)}
      title="Buka berkas DrillKit"
      wide
      testId="modal-buka-berkas"
      footer={
        <Button variant="ghost" data-testid="buka-tutup" onClick={() => setPaket(null)}>
          Tutup
        </Button>
      }
    >
      {paket && <TubuhPratinjau paket={paket} onTutup={() => setPaket(null)} />}
    </Modal>
  )
}

/** Kepala pratinjau: jenis + nama + tanggal + catatan. Selalu tampil. */
function KepalaPratinjau({ hasil }: { hasil: BerkasDikenal }) {
  const tanggal =
    hasil.tanggal != null
      ? new Date(hasil.tanggal).toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : null
  return (
    <div className="mb-3 rounded-lg bg-slate-950/50 p-3">
      <p data-testid="buka-jenis" className="text-sm font-semibold text-slate-100">
        {LABEL_JENIS[hasil.jenis]}
      </p>
      <p data-testid="buka-nama" className="mt-0.5 break-all text-[11px] text-slate-500">
        {hasil.nama}
      </p>
      {tanggal && (
        <p data-testid="buka-tanggal" className="mt-0.5 text-[11px] text-slate-400">
          Dibuat {tanggal}
        </p>
      )}
      {hasil.catatan && (
        <p data-testid="buka-catatan" className="mt-1 text-[11px] leading-relaxed text-slate-500">
          {hasil.catatan}
        </p>
      )}
    </div>
  )
}

function TubuhPratinjau({ paket, onTutup }: { paket: PaketPratinjau; onTutup: () => void }) {
  const mode = useMemberMode()
  const { hasil } = paket

  if (hasil.jenis === 'tak-dikenal') {
    return (
      <>
        <KepalaPratinjau hasil={hasil} />
        <TubuhTakDikenal hasil={hasil} />
      </>
    )
  }

  const jumlahPaket = hasil.jenis === 'zip-anggota' ? (hasil.daftarZip?.length ?? 0) : 0
  const gate = aturMode(hasil.jenis, mode, jumlahPaket)
  if (!gate.boleh) {
    return (
      <>
        <KepalaPratinjau hasil={hasil} />
        <TubuhTolak alasan={gate.alasan} />
      </>
    )
  }

  // ZIP berisi tepat satu paket di mode anggota = paket biasa.
  const dataPaket =
    hasil.jenis === 'zip-anggota' && hasil.daftarZip?.length === 1
      ? (hasil.daftarZip[0].data as Parameters<typeof ringkasPaket>[0])
      : undefined

  return (
    <>
      <KepalaPratinjau hasil={hasil} />
      {(hasil.jenis === 'backup' || hasil.jenis === 'zip-backup') && (
        <AlurPulihkanBackup
          data={(hasil.data ?? {}) as Record<string, any>}
          audio={paket.bita ? ekstrakAudioZip(paket.bita) : []}
          namaBerkas={hasil.nama}
          testId="buka-pulih"
          onSelesai={onTutup}
        />
      )}
      {hasil.jenis === 'data' && <TubuhData hasil={hasil} onTutup={onTutup} />}
      {hasil.jenis === 'show' && <TubuhShow hasil={hasil} onTutup={onTutup} />}
      {hasil.jenis === 'repertoar' && <TubuhRepertoar hasil={hasil} onTutup={onTutup} />}
      {(hasil.jenis === 'paket' || dataPaket !== undefined) && (
        <TubuhPaket
          hasil={hasil}
          data={(dataPaket ?? hasil.data) as Record<string, unknown>}
          onTutup={onTutup}
        />
      )}
      {hasil.jenis.startsWith('csv-') && <TubuhCsv hasil={hasil} onTutup={onTutup} />}
    </>
  )
}

/* ------------------------------ Tiap jenis ------------------------------- */

function TubuhTolak({ alasan }: { alasan: string }) {
  return (
    <div
      data-testid="buka-tolak"
      className="rounded-lg border border-amber-600/40 bg-amber-950/20 p-3 text-xs leading-relaxed text-amber-100/90"
    >
      <p className="font-semibold">Berkas ini tidak bisa dibuka di sini</p>
      <p className="mt-1">{alasan}</p>
    </div>
  )
}

function TubuhTakDikenal({ hasil }: { hasil: BerkasDikenal }) {
  const buka: { jenis: string; tempat: string }[] = [
    { jenis: 'Backup lengkap (.json/.zip)', tempat: 'Pengaturan → Pulihkan backup' },
    { jenis: 'Data pilihan (.json)', tempat: 'menu Data' },
    { jenis: 'Show antar pelatih (.json)', tempat: 'Drill → ⚙ → Berbagi show' },
    { jenis: 'Lagu/repertoar (.json)', tempat: 'Musik → Tukar repertoar' },
    { jenis: 'Paket anggota (.json)', tempat: 'mode anggota → Buka paket tim' },
    { jenis: 'CSV anggota / koordinat / jadwal / absensi', tempat: 'menu masing-masing' },
  ]
  return (
    <div data-testid="buka-tak-dikenal">
      <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-3 text-xs leading-relaxed text-slate-300">
        <p className="font-semibold text-slate-100">Berkas ini tidak dikenali</p>
        <p className="mt-1 text-slate-400">
          {hasil.catatan ?? 'Bukan JSON, CSV, atau ZIP DrillKit.'} Tidak ada yang diubah.
        </p>
      </div>
      <p className="mb-1 mt-3 text-[11px] font-semibold text-slate-400">
        Yang bisa dibuka DrillKit:
      </p>
      <ul className="space-y-1">
        {buka.map((b) => (
          <li key={b.jenis} className="flex items-center justify-between gap-2 text-[11px]">
            <span className="text-slate-300">{b.jenis}</span>
            <span className="text-right text-slate-500">{b.tempat}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Data pilihan: pratinjau di sini, penerapannya di menu Data (ada cocoknya). */
function TubuhData({ hasil, onTutup }: { hasil: BerkasDikenal; onTutup: () => void }) {
  const navigate = useNavigate()
  const [idLokal, setIdLokal] = useState<Record<string, string[]> | null>(null)

  useEffect(() => {
    let hidup = true
    ;(async () => {
      const kunci = (daftar: { id?: string; key?: string }[]) =>
        daftar.map((e) => e?.id ?? e?.key ?? '').filter(Boolean)
      const [anggota, jadwal, absensi, lagu, setlist, drill, set, kemajuan, catatan, evaluasi] =
        await Promise.all([
          db.members.toArray(),
          db.sessions.toArray(),
          db.attendance.toArray(),
          db.songs.toArray(),
          db.setlists.toArray(),
          db.drills.toArray(),
          db.sets.toArray(),
          db.kemajuan.toArray(),
          db.memberNotes.toArray(),
          db.evaluasi.toArray(),
        ])
      if (!hidup) return
      setIdLokal({
        anggota: kunci(anggota),
        jadwal: kunci(jadwal),
        absensi: kunci(absensi),
        lagu: kunci(lagu),
        setlist: kunci(setlist),
        drill: kunci(drill),
        set: kunci(set),
        kemajuan: kunci(kemajuan),
        catatan: kunci(catatan),
        evaluasi: kunci(evaluasi),
      })
    })()
    return () => {
      hidup = false
    }
  }, [])

  const ringkas = ringkasDataPindah(hasil.data, idLokal ?? {})

  function lanjut() {
    if (hasil.teks == null) return
    titipBerkas({ jenis: 'data', nama: hasil.nama, teks: hasil.teks })
    onTutup()
    navigate('/data')
  }

  return (
    <div data-testid="buka-data">
      {idLokal == null ? (
        <p className="text-xs text-slate-500">Menghitung isi berkas…</p>
      ) : (
        <ul className="space-y-1">
          {ringkas.baris.map((b) => (
            <li
              key={b.label}
              className="flex items-center gap-2 rounded bg-slate-800/50 px-2 py-1.5 text-sm"
            >
              <span className="flex-1 text-slate-200">{b.label}</span>
              <span className="text-xs tabular-nums text-slate-400">{b.jumlah}</span>
              {b.baru > 0 && (
                <span className="text-xs tabular-nums text-emerald-400">{b.baru} baru</span>
              )}
              {b.ditimpa > 0 && (
                <span className="text-xs tabular-nums text-rose-300">{b.ditimpa} ditimpa</span>
              )}
            </li>
          ))}
          {ringkas.baris.length === 0 && (
            <li className="text-xs text-slate-500">Berkasnya tidak berisi data apa pun.</li>
          )}
        </ul>
      )}
      <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
        Penerapannya di menu Data — di sana Anda bisa mencocokkan anggota dulu sebelum menekan
        Terapkan.
      </p>
      <div className="mt-3 flex justify-end">
        <Button variant="primary" data-testid="buka-lanjut-data" onClick={lanjut}>
          Buka di menu Data
        </Button>
      </div>
    </div>
  )
}

/** Show: pratinjau + impor langsung (timpa/gabung/salinan + cocok anggota). */
function TubuhShow({ hasil, onTutup }: { hasil: BerkasDikenal; onTutup: () => void }) {
  const navigate = useNavigate()
  const salah = cekBerkas(hasil.data)
  if (salah) {
    return (
      <div
        data-testid="buka-show-rusak"
        className="rounded-lg border border-rose-500/40 bg-rose-500/5 p-3 text-xs leading-relaxed text-slate-300"
      >
        <p className="font-semibold text-rose-300">Berkas show-nya tidak lengkap</p>
        <p className="mt-1">{salah}. Tidak ada yang diubah.</p>
      </div>
    )
  }
  return (
    <AlurImporShow
      data={hasil.data as BerkasShow}
      testId="buka-show"
      onSelesai={() => {
        onTutup()
        navigate('/drill')
      }}
    />
  )
}

/** Repertoar: pratinjau baru/ditimpa + terapkan langsung. */
function TubuhRepertoar({ hasil, onTutup }: { hasil: BerkasDikenal; onTutup: () => void }) {
  const toast = useToast()
  const [siap, setSiap] = useState<{
    paket: PaketRepertoar
    baru: { songs: number; setlists: number; drills: number }
    timpa: { songs: number; setlists: number; drills: number }
    rujukanHilang: number
    berbahaya: boolean
  } | null>(null)
  const [sedang, setSedang] = useState(false)

  useEffect(() => {
    let hidup = true
    ;(async () => {
      if (hasil.teks == null) return
      const baca = bacaPaket(hasil.teks)
      if (!baca.ok) return
      const [songs, setlists, drills] = await Promise.all([
        db.songs.toArray(),
        db.setlists.toArray(),
        db.drills.toArray(),
      ])
      if (!hidup) return
      const r = ringkasanImpor(baca.paket, { songs, setlists, drills })
      setSiap({
        paket: baca.paket,
        baru: {
          songs: r.baru.songs.length,
          setlists: r.baru.setlists.length,
          drills: r.baru.drills.length,
        },
        timpa: {
          songs: r.timpa.songs.length,
          setlists: r.timpa.setlists.length,
          drills: r.timpa.drills.length,
        },
        rujukanHilang: r.rujukanHilang.length,
        berbahaya: perluPeringatan(r),
      })
    })()
    return () => {
      hidup = false
    }
  }, [hasil.teks])

  async function terapkan() {
    if (!siap) return
    setSedang(true)
    try {
      await terapkanPaket(siap.paket)
      toast.push(
        `${siap.baru.songs} lagu masuk, ${siap.timpa.songs} ditimpa`,
      )
      onTutup()
    } catch {
      toast.push('Gagal menerapkan repertoar', 'err')
    } finally {
      setSedang(false)
    }
  }

  if (hasil.teks == null) return null
  const baca = bacaPaket(hasil.teks)
  if (!baca.ok) {
    return (
      <div
        data-testid="buka-repertoar-rusak"
        className="rounded-lg border border-rose-500/40 bg-rose-500/5 p-3 text-xs text-slate-300"
      >
        {baca.alasan}. Tidak ada yang diubah.
      </div>
    )
  }
  const tim = baca.paket.team?.teamName
  return (
    <div data-testid="buka-repertoar">
      {tim && (
        <p className="mb-2 text-xs text-slate-400">
          Dari <span className="text-slate-200">{tim}</span>
        </p>
      )}
      {siap == null ? (
        <p className="text-xs text-slate-500">Menghitung isi paket…</p>
      ) : (
        <>
          <dl className="mb-3 grid grid-cols-3 gap-2 text-center">
            <RingkasanMini judul="Lagu" baru={siap.baru.songs} timpa={siap.timpa.songs} />
            <RingkasanMini judul="Set list" baru={siap.baru.setlists} timpa={siap.timpa.setlists} />
            <RingkasanMini judul="Drill" baru={siap.baru.drills} timpa={siap.timpa.drills} />
          </dl>
          {siap.berbahaya && (
            <p className="mb-3 rounded-lg border border-amber-600/40 bg-amber-600/10 px-3 py-2 text-xs text-amber-200">
              {siap.timpa.songs} lagu, {siap.timpa.setlists} set list, dan {siap.timpa.drills}{' '}
              drill yang sudah ada akan <strong>ditimpa</strong>. Suntingan lokal pada bagian itu
              akan hilang.
            </p>
          )}
          {siap.rujukanHilang > 0 && (
            <p className="mb-3 rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-xs text-slate-300">
              Ada {siap.rujukanHilang} lagu yang dirujuk paket ini tetapi tidak ikut dan tidak ada
              di perangkat ini. Impor tetap aman, tetapi bagian itu akan berlubang.
            </p>
          )}
        </>
      )}
      <div className="mt-3 flex justify-end">
        <Button
          variant={siap?.berbahaya ? 'danger' : 'primary'}
          data-testid="buka-repertoar-terapkan"
          disabled={siap == null || sedang}
          onClick={() => void terapkan()}
        >
          {sedang ? 'Menerapkan…' : 'Terapkan'}
        </Button>
      </div>
    </div>
  )
}

function RingkasanMini({ judul, baru, timpa }: { judul: string; baru: number; timpa: number }) {
  return (
    <div className="rounded-lg border border-slate-800 px-2 py-2">
      <dt className="text-[11px] text-slate-500">{judul}</dt>
      <dd className="text-sm text-slate-100">
        {baru > 0 && <span className="text-emerald-300">+{baru}</span>}
        {baru > 0 && timpa > 0 && <span className="text-slate-600"> / </span>}
        {timpa > 0 && <span className="text-amber-300">~{timpa}</span>}
        {baru === 0 && timpa === 0 && <span className="text-slate-600">—</span>}
      </dd>
    </div>
  )
}

/** Paket anggota (hanya sampai sini dalam mode anggota). */
function TubuhPaket({
  hasil,
  data,
  onTutup,
}: {
  hasil: BerkasDikenal
  data: Record<string, unknown>
  onTutup: () => void
}) {
  const toast = useToast()
  const navigate = useNavigate()
  const [sedang, setSedang] = useState(false)
  const ringkas = ringkasPaket(data)
  if (!ringkas) return null

  async function buka() {
    setSedang(true)
    try {
      const h = await simpanPaketAnggota(data as unknown as Parameters<typeof simpanPaketAnggota>[0])
      if (h.penerima) {
        try {
          localStorage.setItem('drillkit.meId', h.penerima.id)
        } catch {
          // abaikan
        }
      }
      toast.push(
        h.penerima
          ? `Paket "${h.namaTim}" dibuka — hai, ${h.penerima.nama}!`
          : `Paket "${h.namaTim}" dibuka`,
      )
      onTutup()
      navigate('/berbagi')
    } catch {
      toast.push('Gagal membuka paket', 'err')
    } finally {
      setSedang(false)
    }
  }

  return (
    <div data-testid="buka-paket">
      <p className="mb-2 text-sm text-slate-300">
        Paket tim <b>{ringkas.tim}</b>
        {ringkas.penerima.jenis === 'anggota' ? (
          <>
            {' '}· untuk <b>{ringkas.penerima.nama}</b>
          </>
        ) : (
          ' · untuk semua anggota (grup)'
        )}
      </p>
      <ul className="space-y-1 text-xs text-slate-400">
        <li>
          {ringkas.jumlahAnggota} anggota · {ringkas.jumlahJadwal} jadwal · {ringkas.jumlahDrill}{' '}
          drill ({ringkas.jumlahSet} set) · {ringkas.jumlahLagu} lagu
        </li>
        {(ringkas.jumlahAbsensi > 0 || ringkas.jumlahCatatan > 0) && (
          <li>
            {ringkas.jumlahAbsensi} absensi · {ringkas.jumlahCatatan} catatan
          </li>
        )}
        {ringkas.terkunci > 0 && <li>{ringkas.terkunci} data terkunci (butuh kunci pribadi)</li>}
      </ul>
      {hasil.jenis === 'zip-anggota' && (
        <p className="mt-2 text-[11px] text-slate-500">
          Satu-satunya paket di dalam {hasil.nama} — langsung dibuka.
        </p>
      )}
      <div className="mt-3 flex justify-end">
        <Button
          variant="primary"
          data-testid="buka-paket-buka"
          disabled={sedang}
          onClick={() => void buka()}
        >
          {sedang ? 'Membuka…' : 'Buka paket'}
        </Button>
      </div>
    </div>
  )
}

/** CSV: pratinjau + teruskan ke halaman tujuannya. */
function TubuhCsv({ hasil, onTutup }: { hasil: BerkasDikenal; onTutup: () => void }) {
  const navigate = useNavigate()
  const ringkas = hasil.teks != null ? ringkasCsv(hasil.teks) : { baris: 0, kolom: [] as string[] }
  const tujuan = TUJUAN_JENIS[hasil.jenis]

  function lanjut() {
    if (hasil.teks == null) return
    titipBerkas({ jenis: hasil.jenis, nama: hasil.nama, teks: hasil.teks })
    onTutup()
    navigate(tujuan.rute)
  }

  return (
    <div data-testid="buka-csv">
      <p className="text-sm text-slate-300">
        <b>{ringkas.baris}</b> baris data
      </p>
      <p className="mt-1 break-all text-[11px] text-slate-500">
        Kolom: <code className="text-slate-400">{ringkas.kolom.join(', ')}</code>
      </p>
      <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
        Dibuka di <b>{tujuan.tempat}</b> — di sana isinya bisa diperiksa dulu sebelum diterapkan.
      </p>
      <div className="mt-3 flex justify-end">
        <Button variant="primary" data-testid="buka-lanjut-csv" onClick={lanjut}>
          Buka di {tujuan.tempat.split(' → ')[0]}
        </Button>
      </div>
    </div>
  )
}

/* ------------------------- Seret & letakkan (laptop) ---------------------- */

/**
 * Berkas bisa diseret dari penjelajah berkas ke jendela aplikasi.
 *
 * Hanya bereaksi pada seretan yang membawa **berkas** (`Files`), supaya
 * menyeret teks di dalam kolom isian tidak ikut memicu lapisan ini.
 * Dipasang sekali di `Layout`.
 */
export function LapisanSeretBerkas() {
  const [tampil, setTampil] = useState(false)
  const toast = useToast()

  useEffect(() => {
    let hitung = 0
    const bawaBerkas = (e: DragEvent) => [...(e.dataTransfer?.types ?? [])].includes('Files')
    const masuk = (e: DragEvent) => {
      if (!bawaBerkas(e)) return
      e.preventDefault()
      hitung += 1
      setTampil(true)
    }
    const lewat = (e: DragEvent) => {
      if (!bawaBerkas(e)) return
      e.preventDefault()
    }
    const keluar = (e: DragEvent) => {
      if (!bawaBerkas(e)) return
      hitung = Math.max(0, hitung - 1)
      if (hitung === 0) setTampil(false)
    }
    const lepas = (e: DragEvent) => {
      if (!bawaBerkas(e)) return
      e.preventDefault()
      hitung = 0
      setTampil(false)
      const f = e.dataTransfer?.files?.[0]
      if (!f) return
      void kenaliFile(f)
        .then(({ hasil, bita }) => mintaPratinjau(hasil, bita))
        .catch(() => toast.push('Berkas tidak bisa dibaca', 'err'))
    }
    window.addEventListener('dragenter', masuk)
    window.addEventListener('dragover', lewat)
    window.addEventListener('dragleave', keluar)
    window.addEventListener('drop', lepas)
    return () => {
      window.removeEventListener('dragenter', masuk)
      window.removeEventListener('dragover', lewat)
      window.removeEventListener('drop', lepas)
    }
  }, [toast])

  if (!tampil) return null
  return (
    <div
      data-testid="lapisan-seret"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-6"
    >
      <div className="rounded-2xl border-2 border-dashed border-emerald-500/60 bg-slate-900/90 px-10 py-14 text-center">
        <p className="text-base font-semibold text-slate-100">Lepaskan berkasnya di sini</p>
        <p className="mt-1 text-xs text-slate-400">
          Backup, data, show, lagu, paket, CSV, ZIP — jenisnya dikenali otomatis.
        </p>
      </div>
    </div>
  )
}

