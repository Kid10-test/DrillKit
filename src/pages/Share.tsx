import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, DEFAULT_FIELD } from '../db/db'
import type { AttendanceRecord, DrillSet, FieldConfig, Member, MemberNote, Session, ShareBundle } from '../db/types'
import { FieldSurface } from '../components/FieldSurface'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  Select,
  StatTile,
  Toggle,
  useToast,
} from '../components/ui'
import { IconDownload, IconLoop, IconPause, IconPlay, IconShare, IconUpload } from '../components/Icons'
import { PanelTukarRepertoar } from '../components/TukarRepertoar'
import { TombolPanduanAnggota } from '../components/Panduan'
import { namaBerkasAnggota, paketAnggota, paketGrup } from '../lib/bagikan'
import { kenaliBerkas, namaPaketGrup, namaZipAnggota } from '../lib/bukaBerkas'
import { mintaPratinjau } from '../components/BukaBerkas'
import { simpanPaketAnggota } from '../lib/paketMasuk'
import { gabungPembaruan, materiLebihBaru, muatBerkasTerbit, bukaDataPribadi, tanggalIndonesia, type DataTerkunci } from '../lib/terbit'
import { kunciDariUrl, simpanKunciAnggota, bacaKunciAnggota } from '../lib/kunci'
import { TerbitkanAnggota } from '../components/TerbitkanAnggota'
import { cocokCari, namaDenganPanggilan } from '../lib/namaAnggota'
import { NamaTampil } from '../components/NamaTampil'
import Music from './Music'
import { useMemberMode } from '../hooks/useMemberMode'
import { TombolKeluarModeAnggota, TombolMasukModeAnggota } from '../components/ModePerangkat'
import { bikinZip } from '../lib/zip'
import {
  sectionDot,
  sectionLabel,
  STATUS_META,
  cx,
  daysFromToday,
  downloadBlob,
  downloadFile,
  formatDateLong,
  pct,
  relativeDay,
  sesiMeta,
  todayISO,
  nowTime,
} from '../lib/utils'
import { coordText, facingDeg, stepYd, ukurTitik } from '../lib/field'
import { acakUrutan, bangunSoal, nilaiTebakan, TOLERANSI_LANGKAH } from '../lib/kuis'
import { PengingatJadwal, unduhICS } from '../components/PengingatJadwal'
import {
  NAMA_BULAN,
  NAMA_HARI_PANJANG,
  NAMA_HARI_SENIN,
  KUNCI_TAMPILAN,
  geserBulan,
  kelompokPerMinggu,
  hariSenin,
  sesiBerikutnya,
  sesiPerTanggal,
  susunBulan,
  teksHitungMundur,
  tampilanAwal,
} from '../lib/kalender'
import type { NilaiTebakan } from '../lib/kuis'

/**
 * Halaman berbagi punya dua mode:
 *  - Pelatih : membuat paket tim (jadwal + formasi + repertoar + daftar anggota)
 *              yang bisa dibagikan lewat WhatsApp/email, lalu dibuka anggota di HP mereka.
 *  - Anggota : membuka paket tersebut dan melihat jadwal, posisi formasi sendiri,
 *              serta rekap kehadiran — tanpa bisa mengubah data pelatih.
 */
export default function Share() {
  const mode = useMemberMode()
  return mode === 'member' ? <MemberView /> : <CoachExport />
}

/* ========================================================================== */
/*  Mode pelatih — buat paket                                                   */
/* ========================================================================== */

function CoachExport() {
  const toast = useToast()
  const members = useLiveQuery(() => db.members.toArray(), [], [])
  const sessions = useLiveQuery(() => db.sessions.toArray(), [], [])
  const drills = useLiveQuery(() => db.drills.toArray(), [], [])
  const sets = useLiveQuery(() => db.sets.toArray(), [], [])
  const songs = useLiveQuery(() => db.songs.toArray(), [], [])
  const daftarSetList = useLiveQuery(() => db.setlists.toArray(), [], [])
  const attendance = useLiveQuery(() => db.attendance.toArray(), [], [])
  const memberNotes = useLiveQuery(() => db.memberNotes.toArray(), [], [])
  const settings = useLiveQuery(() => db.settings.get('team'), [], undefined)

  const [includeSchedule, setIncludeSchedule] = useState(true)
  const [includeDrills, setIncludeDrills] = useState(true)
  const [includeSongs, setIncludeSongs] = useState(true)
  const [includeAttendance, setIncludeAttendance] = useState(true)
  /** Catatan evaluasi — dulu SELALU ikut berkas tanpa saklar apa pun. */
  const [includeNotes, setIncludeNotes] = useState(true)
  const [preview, setPreview] = useState<ShareBundle | null>(null)

  function build(): ShareBundle {
    return {
      format: 'drillkit-share',
      version: 1,
      exportedAt: Date.now(),
      team: settings
        ? {
            teamName: settings.teamName,
            coachName: settings.coachName,
            city: settings.city,
            logo: settings.logo,
            defaultField: settings.defaultField,
            memberMode: 1,
          }
        : null,
      // Token QR tidak ikut dibagikan — hanya pelatih yang perlu memindainya.
      members: (members ?? []).map(({ token, ...rest }) => ({ ...rest, token: '' })),
      sessions: includeSchedule ? (sessions ?? []) : [],
      drills: includeDrills ? (drills ?? []) : [],
      sets: includeDrills ? (sets ?? []) : [],
      songs: includeSongs ? (songs ?? []) : [],
      // Set list mengikuti saklar repertoar: ia tidak ada artinya tanpa lagu.
      setlists: includeSongs ? (daftarSetList ?? []) : [],
      attendance: includeAttendance ? (attendance ?? []) : [],
      // Catatan evaluasi — kini menghormati saklar, seperti jenis data lain.
      memberNotes: includeNotes ? (memberNotes ?? []) : [],
      mode: 'member',
    }
  }

  function namaTim(): string {
    return build().team?.teamName ?? 'tim'
  }

  /**
   * Berkas **grup** — satu berkas untuk semua orang.
   *
   * Tidak memuat data pribadi siapa pun, jadi aman dibagikan ke mana saja.
   */
  function unduhGrup() {
    const bundle = paketGrup(build())
    downloadFile(namaPaketGrup(), JSON.stringify(bundle))
    toast.push('Berkas grup diunduh — tanpa data pribadi, aman dibagikan ke mana saja')
  }

  /**
   * Berkas **per anggota** — satu ZIP berisi satu berkas per anggota.
   *
   * Tiap berkas hanya memuat absensi & catatan anggota itu sendiri.
   */
  function unduhPerAnggota() {
    const dasar = build()
    if (dasar.members.length === 0) {
      toast.push('Belum ada anggota untuk dibagikan', 'err')
      return
    }
    const entri = dasar.members.map((m) => ({
      nama: namaBerkasAnggota(m),
      isi: JSON.stringify(paketAnggota(dasar, m.id)),
    }))
    downloadBlob(namaZipAnggota(namaTim()), bikinZip(entri))
    toast.push(
      `${entri.length} berkas anggota dibungkus — tiap berkas hanya memuat datanya sendiri, ` +
        `dan begitu dibuka langsung mengenali namanya`,
    )
  }

  const size = useMemo(() => {
    // Dihitung dari berkas GRUP, karena itulah yang benar-benar diunduh
    // sebagai satu berkas — bukan dari paket lengkap yang tak pernah dibagikan.
    const n = JSON.stringify(paketGrup(build())).length
    return n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`
  }, [members, sessions, drills, sets, songs, includeSchedule, includeDrills, includeSongs])

  return (
    <div>
      <PageHeader
        title="Berbagi ke anggota"
        subtitle="Kirim jadwal & formasi ke HP anggota tanpa perlu server atau akun"
        actions={
          <>
            <TombolMasukModeAnggota />
            <Button data-testid="unduh-grup-atas" onClick={unduhGrup}>
              <IconDownload size={16} /> Unduh berkas grup
            </Button>
            <Button variant="primary" data-testid="unduh-per-anggota-atas" onClick={unduhPerAnggota}>
              <IconDownload size={16} /> Unduh per anggota (ZIP)
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <TerbitkanAnggota susun={build} />
        <Card className="lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-slate-200">Isi bersama</h2>
          <p className="mb-3 text-[11px] leading-relaxed text-slate-500">
            Ikut di <b>kedua</b> jenis berkas — grup maupun per anggota.
          </p>
          <div className="space-y-1.5">
            <Toggle
              testId="toggle-jadwal"
              checked={includeSchedule}
              onChange={setIncludeSchedule}
              label={`Jadwal & materi (${sessions?.length ?? 0})`}
            />
            <Toggle
              testId="toggle-drill"
              checked={includeDrills}
              onChange={setIncludeDrills}
              label={`Formasi/drill (${drills?.length ?? 0} drill, ${sets?.length ?? 0} set)`}
            />
            <Toggle
              testId="toggle-repertoar"
              checked={includeSongs}
              onChange={setIncludeSongs}
              label={`Repertoar & tempo (${songs?.length ?? 0})`}
            />
          </div>
          <p className="mt-3 rounded-lg bg-slate-950/50 p-3 text-[11px] leading-relaxed text-slate-500">
            Yang <b>selalu</b> ikut: daftar anggota (nama, section, instrumen) dan nama tim — diperlukan
            supaya anggota bisa memilih namanya dan melihat formasinya di antara rekan-rekannya.
            Yang <b>tidak pernah</b> ikut, ke mana pun: token QR absensi, nomor telepon, catatan
            pribadi pelatih, dan <b>nilai evaluasi</b> (keputusan Anda — yang sampai ke anggota hanya
            tulisan pelatih). Perkiraan ukuran berkas grup: <b>{size}</b>.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={() => setPreview(build())}>Pratinjau isi</Button>
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-200">Dua cara membagikan</h2>

          <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
            <p className="text-xs font-semibold text-slate-200">Berkas grup</p>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
              Satu berkas untuk semua orang. <b>Tanpa</b> absensi & catatan siapa pun, jadi aman
              dibagikan ke mana saja — termasuk grup terbuka.
            </p>
            <Button
              data-testid="unduh-grup"
              onClick={unduhGrup}
              className="mt-2 w-full"
            >
              <IconDownload size={14} /> Unduh berkas grup
            </Button>
            {BISA_AMBIL && (
              <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                <b>Untuk tombol Perbarui anggota:</b> tekan <b>Terbitkan ke anggota</b> di atas,
                atau unggah berkas ini secara manual dengan nama{' '}
                <code className="text-slate-400">paket.json</code>. Jangan unggah berkas{' '}
                <b>per anggota</b> ke situs: itu memuat absensi dan catatan pribadi.
              </p>
            )}
          </div>

          <div className="mt-3 rounded-lg border border-emerald-900/50 bg-emerald-950/20 p-3">
            <p className="text-xs font-semibold text-emerald-200">Berkas per anggota</p>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
              Satu berkas ZIP berisi <b>{members?.length ?? 0} berkas</b> — satu per anak, sudah
              diberi nama. Tiap berkas hanya memuat absensi & catatan <b>anak itu sendiri</b>.
              Butuh satu pesan per orang.
            </p>
            <div className="mt-2 space-y-1.5">
              <Toggle
                testId="toggle-absensi"
                checked={includeAttendance}
                onChange={setIncludeAttendance}
                label={`Rekap kehadiran (${attendance?.length ?? 0} catatan)`}
              />
              <Toggle
                testId="toggle-catatan"
                checked={includeNotes}
                onChange={setIncludeNotes}
                label={`Catatan evaluasi (${memberNotes?.length ?? 0})`}
              />
            </div>
            <Button
              variant="primary"
              data-testid="unduh-per-anggota"
              onClick={unduhPerAnggota}
              className="mt-2 w-full"
            >
              <IconDownload size={14} /> Unduh {members?.length ?? 0} berkas (ZIP)
            </Button>
          </div>

          <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
            Mengapa harus dipisah: selama semua anak menerima <b>satu berkas yang sama</b>, data
            pribadi semua anak harus ada di dalamnya. Menyaring tampilan tidak mengatasinya — yang
            bocor adalah berkasnya, bukan layarnya.
          </p>

          {/* J1 — panduan anggota: disiapkan di tempat yang sama dengan berkasnya. */}
          <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/40 p-3" data-testid="kotak-panduan-anggota">
            <p className="text-xs font-semibold text-slate-200">Panduan untuk anggota</p>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
              Satu lembar A4: cara membuka berkas ini di HP, isi tiap tab, menala sesuai instrumen,
              dan kalau macet. Cetak, atau unduh HTML-nya lalu kirim bersama berkasnya.
            </p>
            <div className="mt-2">
              <TombolPanduanAnggota label="Pratinjau panduan anggota" />
            </div>
          </div>
        </Card>

        <Card className="lg:col-span-3">
          <h2 className="mb-1 text-sm font-semibold text-slate-200">
            Tukar repertoar antar perangkat
          </h2>
          <p className="mb-3 text-xs leading-relaxed text-slate-400">
            Paket di atas mengalir <b>satu arah</b> ke HP anggota dan hanya bisa
            dibaca. Untuk memindahkan lagu, set list, dan drill yang menautkannya
            <b> ke perangkat pelatih lain</b>, gunakan berkas repertoar di bawah
            ini — isinya langsung masuk ke pustaka di perangkat tujuan. Id lagu
            tetap dipertahankan, jadi tautan drill ke lagu tidak putus.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <PanelTukarRepertoar
              songs={songs ?? []}
              setlists={daftarSetList ?? []}
              ringkas
            />
            <button
              type="button"
              data-testid="ke-halaman-musik"
              onClick={() => {
                location.hash = '#/musik'
              }}
              className="text-xs text-emerald-400 underline decoration-dotted hover:text-emerald-300"
            >
              Buka di halaman Musik →
            </button>
          </div>
        </Card>
      </div>

      <Modal open={!!preview} onClose={() => setPreview(null)} title="Pratinjau paket" wide>
        {preview && (
          <div className="grid gap-3 sm:grid-cols-2">
            <StatTile label="Anggota" value={preview.members.length} />
            <StatTile label="Jadwal" value={preview.sessions.length} />
            <StatTile label="Set formasi" value={preview.sets.length} />
            <StatTile label="Repertoar" value={preview.songs.length} />
          </div>
        )}
        {preview && (
          <pre className="scroll-thin max-h-64 overflow-auto rounded-lg bg-slate-950 p-3 text-[11px] leading-relaxed text-slate-400">
            {JSON.stringify(
              {
                format: preview.format,
                teamName: preview.team?.teamName,
                members: preview.members.slice(0, 3).map((m) => `${m.code} — ${namaDenganPanggilan(m)} (${m.section})`),
                sessions: preview.sessions.slice(0, 5).map((s: Session) => `${s.date} ${s.title}`),
                drills: preview.drills.map((d) => d.name),
                songs: preview.songs.map((s) => `${s.title} @ ${s.bpm}BPM`),
              },
              null,
              2,
            )}
          </pre>
        )}
      </Modal>
    </div>
  )
}

/* ========================================================================== */
/*  Mode anggota — baca paket                                                   */
/* ========================================================================== */

/**
 * Bolehkah materi diambil dari sebuah alamat?
 *
 * Hanya bila aplikasinya memang **disajikan oleh situs**. Dibuka dari berkas
 * (`file://`) tidak punya asal yang bisa dijadikan pangkal alamat, dan
 * mengambil lintas-asal dari berkas justru akan diblokir peramban.
 */
const BISA_AMBIL = /^https?:$/.test(location.protocol)

function MemberView() {
  const toast = useToast()
  const pkg = useLiveQuery(() => db.packages.get('current'), [], undefined)
  const [tab, setTab] = useState<'jadwal' | 'formasi' | 'kuis' | 'absensi' | 'catatan' | 'musik'>('jadwal')
  const [meId, setMeId] = useState(() => localStorage.getItem('drillkit.meId') ?? '')
  const [q, setQ] = useState('')
  const [sedangMuat, setSedangMuat] = useState(false)
  const [pemberitahuan, setPemberitahuan] = useState<string | null>(null)
  /**
   * Kunci pribadi anggota. Dibaca dari URL fragment (#) sekali, lalu
   * disimpan di localStorage supaya tidak perlu memindai QR lagi.
   */
  const [kunciPribadi] = useState(() => {
    const dariUrl = kunciDariUrl()
    if (dariUrl) {
      simpanKunciAnggota(dariUrl)
      // Hapus kunci dari URL, tetapi pertahankan rute HashRouter. Kalau hash
      // dihapus seluruhnya, router akan kembali ke Dashboard.
      try {
        const rute = location.hash.startsWith('#/') ? location.hash.split('?')[0] : '#/berbagi'
        history.replaceState(null, '', location.pathname + location.search + rute)
      } catch { /* */ }
      return dariUrl
    }
    return bacaKunciAnggota()
  })
  /** Data pribadi yang sudah didekripsi dari berkas terbit. */
  const [dataTerkunci, setDataTerkunci] = useState<ShareBundle | null>(null)
  /** Bagian terkunci dari terbitan terakhir — ciphertext tidak pernah disimpan ke DB. */
  const [terbitTerkunci, setTerbitTerkunci] = useState<DataTerkunci | null>(null)
  /** Apakah sumber data terkunci sudah dimuat dan sudah dicoba dibuka. */
  const [sudahCobaDekripsi, setSudahCobaDekripsi] = useState(false)
  /**
   * Alamat berkas materi. Bawaan **`paket.json`** — sebelah aplikasi ini —
   * sehingga pelatih cukup menaruh berkasnya di situ dan anggota tidak
   * perlu menyetel apa pun.
   */
  const [alamat, setAlamat] = useState('paket.json')
  const urlPaket = useMemo(() => {
    try {
      return new URL(alamat.trim() || 'paket.json', document.baseURI).href
    } catch {
      return ''
    }
  }, [alamat])

  /**
   * Ambil materi terbaru dari alamatnya — pengganti "unduh berkas, lalu unggah
   * lagi" bagi anggota.
   *
   * Yang **sengaja tidak ditimpa**: absensi dan catatan milik anggota ini,
   * serta penanda untuk siapa berkasnya dibuat. Berkas di alamat itu adalah
   * berkas **GRUP**, yang memang tidak memuat absensi siapa pun — menimpa
   * seluruhnya akan mengosongkan riwayat kehadiran anggota **setiap kali**
   * pelatih memperbarui materi.
   */
  async function perbarui() {
    if (!urlPaket) return
    setSedangMuat(true)
    try {
      const res = await fetch(urlPaket, { cache: 'no-store' })
      if (!res.ok) throw new Error(String(res.status))
      /*
       * Banyak penyaji berkas statis menjawab alamat yang tidak ada dengan
       * `index.html` (200), bukan 404 — termasuk layanan tarik-dan-lepas
       * tempat aplikasi ini diterbitkan. Karenanya status saja tidak cukup:
       * isi HTML harus dikenali dan diberitahukan dengan jujur.
       *
       * Ini bukan keadaan yang langka. `paket.json` TIDAK ikut di dalam
       * `dist/`, sedangkan sebuah terbitan adalah *penggantian*, bukan
       * sinkronisasi: mengunggah ulang isi `dist/` akan menghapus berkas
       * materi yang sudah ada di situ. Pesan yang menyebut kemungkinan itu
       * menghemat berjam-jam mencari kesalahan yang tidak pernah diperbuat.
       */
      const jenis = res.headers.get('content-type') ?? ''
      if (jenis.includes('text/html')) {
        throw new Error('bukan-berkas')
      }
      const teksMentah = await res.text()
      /*
       * Muat berkas terbit: ekstrak bagian terbuka (grup) dan terkunci.
       * `muatBerkasTerbit` memisahkan keduanya — bagian terkunci tidak
       * ikut tersimpan ke `packages` supaya data pribadi orang lain
       * tidak bercampur ke IndexedDB anggota ini.
       */
      const hasilMuat = muatBerkasTerbit(teksMentah)
      if (!hasilMuat) {
        toast.push('Berkas di alamat itu bukan paket DrillKit', 'err')
        return
      }
      const data = hasilMuat.grup
      const lama = pkg?.data
      const laguLokal = await db.songs.toArray()
      const digabung = gabungPembaruan(data, lama, laguLokal)
      await db.packages.put({
        key: 'current',
        importedAt: Date.now(),
        data: digabung,
      })
      /*
       * Lagu dan set list harus sampai ke **tabelnya**, bukan sekadar ikut
       * tersimpan di dalam paket: halaman Musik membaca `db.songs`, bukan
       * berkasnya. Tanpa dua baris ini anggota melihat repertoar kosong
       * padahal materinya berisi lagu — kegagalan yang tampak "berhasil".
       *
       * Dipakai `bulkPut`, bukan kosongkan-lalu-isi: lagu yang id-nya sama
       * ditimpa (itulah maksud pembaruan), dan apa pun yang sudah ada di
       * perangkat ini tetap ada.
       */
      if (digabung.songs?.length) await db.songs.bulkPut(digabung.songs)
      if (digabung.setlists?.length) await db.setlists.bulkPut(digabung.setlists)
      /*
       * Simpan ciphertext hanya di state. Dekripsi dilakukan oleh effect di
       * bawah setelah `meId` diketahui; ini penting ketika anggota memilih
       * namanya SETELAH menekan Perbarui. Hanya hasil milik orang itu yang
       * pernah menjadi `dataTerkunci`, tidak ada data anggota lain yang masuk
       * ke IndexedDB.
       */
      setDataTerkunci(null)
      setTerbitTerkunci(hasilMuat.locked)
      toast.push(`Materi diperbarui — ${data.team?.teamName ?? 'tim'}`)
    } catch (e) {
      const bukanBerkas = e instanceof Error && e.message === 'bukan-berkas'
      toast.push(
        bukanBerkas
          ? 'Tidak ada berkas materi di alamat itu. Mungkin belum diunggah, atau ikut terhapus saat aplikasi diperbarui — unggah ulang paket.json bersama isi dist/.'
          : 'Gagal mengambil materi. Periksa koneksi atau alamatnya.',
        'err',
      )
    } finally {
      setSedangMuat(false)
    }
  }

  const bundle = pkg?.data
  const members: Member[] = bundle?.members ?? []

  useEffect(() => {
    if (meId) localStorage.setItem('drillkit.meId', meId)
  }, [meId])

  // #7 — paket yang dibuka lewat pintu "Buka berkas DrillKit" (atau tombol
  // ini sendiri): kenali namanya + pegang bagian terkuncinya.
  useEffect(() => {
    const onPaket = (e: Event) => {
      const d = (e as CustomEvent).detail as {
        penerimaId: string | null
        locked: DataTerkunci
      }
      setDataTerkunci(null)
      setTerbitTerkunci(d?.locked ?? {})
      if (d?.penerimaId) setMeId(d.penerimaId)
    }
    window.addEventListener('drillkit:paket-baru', onPaket)
    return () => window.removeEventListener('drillkit:paket-baru', onPaket)
  }, [])

  /**
   * Buka ulang data pribadi setiap kali nama dipilih atau paket terbitan
   * berganti. Jangan memakai `bundle.attendance`: pada berkas terbit bagian
   * terbuka memang kosong, dan status kalender harus berasal dari ciphertext
   * yang dikunci untuk anggota ini.
   */
  useEffect(() => {
    let batal = false
    setDataTerkunci(null)
    if (!meId || terbitTerkunci === null) return
    setSudahCobaDekripsi(true)
    if (!kunciPribadi || !terbitTerkunci[meId]) return
    ;(async () => {
      const terbuka = await bukaDataPribadi(terbitTerkunci, meId, kunciPribadi)
      if (!batal && terbuka) setDataTerkunci(terbuka)
    })()
    return () => {
      batal = true
    }
  }, [meId, kunciPribadi, terbitTerkunci])

  useEffect(() => {
    if (!BISA_AMBIL || !urlPaket) return
    let batal = false
    ;(async () => {
      try {
        const res = await fetch(urlPaket, { cache: 'no-store' })
        if (!res.ok) return
        const jenis = res.headers.get('content-type') ?? ''
        if (jenis.includes('text/html')) return
        const teks = await res.text()
        const hasil = muatBerkasTerbit(teks)
        if (batal || !hasil) return
        if (materiLebihBaru(pkg?.data?.exportedAt, hasil.grup.exportedAt)) {
          setPemberitahuan(tanggalIndonesia(hasil.grup.exportedAt))
        } else setPemberitahuan(null)
      } catch {
        /* luring — jangan mengganggu */
      }
    })()
    return () => {
      batal = true
    }
  }, [urlPaket, pkg?.data?.exportedAt])

  /**
   * Buka berkas paket yang dipilih anggota.
   *
   * Bila berkasnya menyebut **untuk siapa** ia dibuat (berkas per anggota),
   * namanya langsung dipakai — anggota tidak disuruh memilih namanya dari
   * daftar 18 orang padahal berkasnya sudah difilter hanya untuk dia.
   *
   * Tetapi tidak pernah dilakukan diam-diam: namanya disebut di pesan dan
   * ditampilkan di kartu di bawah, lengkap dengan tombol **Ganti nama**.
   * Kalau pelatih salah kirim berkas, salah orangnya harus kelihatan, bukan
   * tersembunyi di balik pilihan yang tampak berhasil.
   */
  async function openPackage(file: File) {
    try {
      // #7 — tombol ini menerima SEMUA jenis: yang bukan paket dialihkan ke
      // pratinjau (di mode anggota, pratinjau menolak selain paket).
      const bita = new Uint8Array(await file.arrayBuffer())
      const kenal = kenaliBerkas(file.name, bita)
      let data: unknown = null
      if (kenal.jenis === 'paket') data = kenal.data
      else if (kenal.jenis === 'zip-anggota' && kenal.daftarZip?.length === 1) {
        data = kenal.daftarZip[0].data
      } else {
        mintaPratinjau(kenal, bita)
        return
      }
      const h = await simpanPaketAnggota(
        data as Parameters<typeof simpanPaketAnggota>[0],
      )
      // Nama + bagian terkunci diurus pendengar 'drillkit:paket-baru'.
      toast.push(
        h.penerima
          ? `Paket "${h.namaTim}" dibuka — hai, ${h.penerima.nama}!`
          : `Paket "${h.namaTim}" dibuka`,
      )
    } catch {
      toast.push('Gagal membaca paket', 'err')
    }
  }

  if (!bundle) {
    return (
      <div>
        <PageHeader
          title="Mode anggota"
          subtitle="Buka paket yang dibagikan pelatih"
          actions={<TombolKeluarModeAnggota label="Kembali ke mode pelatih" />}
        />
        <EmptyState
          icon={<IconShare size={32} />}
          title="Belum ada paket dibuka"
          desc={
            BISA_AMBIL
              ? 'Ambil materi terbaru langsung dari situsnya, atau minta file paket .json dari pelatih. Semua data hanya tersimpan di HP ini.'
              : 'Minta file paket .json dari pelatih, lalu buka di sini. Semua data hanya tersimpan di HP ini.'
          }
          action={
            <>
              {pemberitahuan && (
                <p data-testid="pemberitahuan-materi" className="mb-2 text-xs text-emerald-300">
                  Ada materi baru dari pelatih ({pemberitahuan}).
                </p>
              )}
              <input
                id="pkg-input"
                type="file"
                accept=".json,.csv,.zip,application/json,text/csv,application/zip"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) openPackage(f)
                  e.target.value = ''
                }}
              />
              {BISA_AMBIL && (
                <Button
                  variant="primary"
                  data-testid="ambil-materi"
                  disabled={sedangMuat}
                  onClick={perbarui}
                >
                  <IconLoop size={16} /> {sedangMuat ? 'Mengambil…' : 'Ambil materi dari situs'}
                </Button>
              )}
              <Button
                variant={BISA_AMBIL ? 'ghost' : 'primary'}
                onClick={() => document.getElementById('pkg-input')?.click()}
              >
                <IconUpload size={16} /> Buka paket tim
              </Button>
            </>
          }
        />
      </div>
    )
  }

  const filtered = members.filter((m) => {
    const s = q.trim().toLowerCase()
    return cocokCari(m, s)
  })
  const me = members.find((m) => m.id === meId)

  return (
    <div>
      <PageHeader
        title={bundle.team?.teamName ?? 'Tim'}
        subtitle={`Paket dibuat ${new Date(bundle.exportedAt).toLocaleDateString('id-ID')} · ${members.length} anggota`}
        actions={
          <>
            {BISA_AMBIL && (
              <Button data-testid="perbarui-materi" disabled={sedangMuat} onClick={perbarui}>
                <IconLoop size={16} /> {sedangMuat ? 'Mengambil…' : 'Perbarui'}
              </Button>
            )}
            <TombolKeluarModeAnggota />
            <Button onClick={() => document.getElementById('pkg-input2')?.click()}>
              <IconUpload size={16} /> Ganti paket
            </Button>
          </>
        }
      />
      <input
        id="pkg-input2"
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) openPackage(f)
          e.target.value = ''
        }}
      />

      {pemberitahuan && (
        <div
          data-testid="pemberitahuan-materi"
          className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-800/60 bg-emerald-950/30 px-3 py-2"
        >
          <p className="text-xs text-emerald-200">Ada materi baru dari pelatih ({pemberitahuan}).</p>
          <Button size="sm" data-testid="perbarui-pemberitahuan" disabled={sedangMuat} onClick={perbarui}>
            <IconLoop size={14} /> Perbarui
          </Button>
        </div>
      )}

      {/* Pilih nama — cukup sekali, diingat di HP ini */}
      <Card className="mb-4">
        {me ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <div
                className="grid h-10 w-10 place-items-center rounded-full text-xs font-bold text-slate-950"
                style={{ background: sectionDot(me.section) }}
              >
                {me.code}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-100">{namaDenganPanggilan(me)}</p>
                <p className="text-xs text-slate-500">
                  {sectionLabel(me.section)} · {me.instrument}
                </p>
              </div>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setMeId('')}>
              Ganti nama
            </Button>
          </div>
        ) : (
          <div>
            <p className="mb-2 text-xs font-medium text-slate-400">Pilih namamu dulu</p>
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ketik nama atau kode…"
              className="mb-2"
            />
            <div className="scroll-thin max-h-48 space-y-1 overflow-y-auto">
              {filtered.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMeId(m.id)}
                  className="flex w-full items-center gap-2 rounded-lg border border-slate-800 px-3 py-2 text-left hover:bg-slate-800/60"
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: sectionDot(m.section) }} />
                  <span className="text-sm text-slate-200"><NamaTampil anggota={m} /></span>
                  <Badge className="ml-auto">{m.code}</Badge>
                </button>
              ))}
              {!filtered.length && <p className="text-xs text-slate-500">Tidak ditemukan.</p>}
            </div>
          </div>
        )}
      </Card>

      {/* Alamat materi — tempat tombol Perbarui mengambilnya */}
      {BISA_AMBIL && (
        <Card className="mb-4">
          <h3 className="mb-1 text-sm font-semibold text-slate-200">Alamat materi</h3>
          <p className="mb-2 text-[11px] leading-relaxed text-slate-500">
            Tombol <b>Perbarui</b> mengambil materi terbaru dari alamat ini. Absensi dan
            catatanmu <b>tidak</b> ikut tertimpa.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              data-testid="alamat-materi"
              value={alamat}
              onChange={(e) => setAlamat(e.target.value)}
              placeholder="paket.json"
              className="flex-1 font-mono text-xs"
            />
            <Button
              data-testid="perbarui-alamat"
              variant="primary"
              disabled={sedangMuat || !urlPaket}
              onClick={perbarui}
              className="justify-center"
            >
              <IconLoop size={16} /> {sedangMuat ? 'Mengambil…' : 'Perbarui'}
            </Button>
          </div>
          <p className="mt-1.5 break-all text-[11px] text-slate-600">{urlPaket}</p>
        </Card>
      )}

      {/* Status kunci pribadi */}
      {me && !dataTerkunci && sudahCobaDekripsi && (
        <div className="mb-3 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2" data-testid="status-kunci">
          <p className="text-[11px] leading-relaxed text-slate-400">
            Data pribadi (kehadiran, catatan) belum terbuka.{' '}
            {!kunciPribadi
              ? 'Mintalah QR kunci ke pelatih untuk membuka data pribadimu.'
              : 'Kunci tersimpan, tapi data pribadi tidak ditemukan di berkas ini — mungkin belum diterbitkan dengan kunci.'}
          </p>
        </div>
      )}
      {me && dataTerkunci && (
        <div className="mb-3 rounded-lg border border-emerald-800/40 bg-emerald-950/20 px-3 py-2" data-testid="status-kunci">
          <p className="text-[11px] leading-relaxed text-emerald-300">
            ✓ Data pribadi terbuka — kehadiran dan catatan dari pelatih.
          </p>
        </div>
      )}

      {/*
        Tab — enam buah, dan ukurannya harus Muat di HP.

        Penambahan tab Musik membuat bar ini meluber 12px pada layar 360px:
        tombol terakhir sebagian keluar dari layar. Seluruh rangkaian uji
        berjalan di lebar 1300px, jadi cacatnya tidak pernah terlihat —
        padahal mode anggota justru dipakai di HP.

        Karena itu: padding & ukuran huruf diperkecil pada layar sempit,
        label tidak boleh membungkus, dan bar boleh digeser bila tetap
        tidak muat (misalnya layar 320px — atau tab Kuis di 360px). Batang gesernya dibuat tipis
        supaya tidak menggeser tata letaknya.
      */}
      <div
        data-testid="bar-tab-anggota"
        data-kiosk-allow
        className="scroll-thin mb-4 flex gap-1 overflow-x-auto rounded-lg border border-slate-800 bg-slate-900/50 p-1"
      >
        {(['jadwal', 'formasi', 'kuis', 'absensi', 'catatan', 'musik'] as const).map((t) => (
          <button
            key={t}
            data-testid={`tab-${t}`}
            onClick={() => setTab(t)}
            className={cx(
              'flex-1 whitespace-nowrap rounded-md px-2 py-1.5 text-[11px] font-medium capitalize transition sm:px-3 sm:text-xs',
              tab === t ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-100',
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'musik' ? (
        /*
         * N4 — metronom sengaja bisa dipakai WALAU belum memilih nama.
         * Berlatih ketukan tidak perlu identitas, dan memaksa anggota
         * memilih nama dulu hanya untuk berlatih tempo adalah rintangan
         * yang tidak memberi apa pun.
         */
        <Music hanyaPutar />
      ) : !me ? (
        <EmptyState title="Pilih nama di atas" desc="Supaya DrillKit tahu formasi dan absensi siapa yang ditampilkan." />
      ) : tab === 'jadwal' ? (
        <MemberSchedule
          sessions={bundle.sessions}
          // Kalender anggota sengaja TIDAK membaca bundle.attendance yang
          // terbuka. Status pribadi hanya berasal dari data terkunci #2.
          attendance={dataTerkunci ? dataTerkunci.attendance : null}
        />
      ) : tab === 'formasi' ? (
        <MemberDrill bundle={bundle} me={me} members={members} />
      ) : tab === 'kuis' ? (
        <MemberKuis bundle={bundle} me={me} members={members} />
      ) : tab === 'absensi' ? (
        <MemberAttendance bundle={dataTerkunci ?? bundle} me={me} locked={!!dataTerkunci} />
      ) : (
        <MemberNotes bundle={dataTerkunci ?? bundle} me={me} locked={!!dataTerkunci} />
      )}
    </div>
  )
}

function bacaTampilanJadwalAnggota(): 'bulan' | 'agenda' {
  let tersimpan: string | null = null
  try {
    tersimpan = localStorage.getItem(KUNCI_TAMPILAN)
  } catch {
    /* localStorage diblokir — ikuti ukuran layar */
  }
  const awal = tampilanAwal(tersimpan, typeof window !== 'undefined' ? window.innerWidth : 1024)
  return awal === 'bulan' ? 'bulan' : 'agenda'
}

/**
 * Kalender anggota adalah salinan baca-saja dari jadwal pelatih.
 *
 * Hal yang sengaja berbeda dari kalender pelatih:
 * - tidak ada tombol tambah/edit/hapus, seret-pindah, checklist, atau Pacu;
 * - status yang ditampilkan hanya status anggota yang sedang dipilih;
 * - `attendance === null` berarti bagian terkunci #2 belum dibuka. Dalam
 *   keadaan itu kalender tidak menebak "alpha" dan tidak membaca absensi
 *   terbuka dari paket grup.
 */
function MemberSchedule({
  sessions,
  attendance,
}: {
  sessions: Session[]
  /** null = data pribadi terkunci/belum tersedia; [] = sudah dibuka, nihil catatan */
  attendance: AttendanceRecord[] | null
}) {
  const hariIni = todayISO()
  const [tampilan, setTampilan] = useState<'bulan' | 'agenda'>(bacaTampilanJadwalAnggota)
  const [bulanAktif, setBulanAktif] = useState(() => ({
    tahun: Number(hariIni.slice(0, 4)),
    bulan: Number(hariIni.slice(5, 7)),
  }))
  const [hariPilih, setHariPilih] = useState(hariIni)
  const [lihatLewat, setLihatLewat] = useState(false)
  const [buka, setBuka] = useState<string | null>(null)

  function pilihTampilan(next: 'bulan' | 'agenda') {
    setTampilan(next)
    try {
      localStorage.setItem(KUNCI_TAMPILAN, next)
    } catch {
      /* abaikan */
    }
  }

  const perTanggal = useMemo(() => sesiPerTanggal(sessions), [sessions])
  const minggu = useMemo(
    () => susunBulan(bulanAktif.tahun, bulanAktif.bulan),
    [bulanAktif.bulan, bulanAktif.tahun],
  )
  const pilihan = perTanggal.get(hariPilih) ?? []
  const berikutnya = useMemo(
    () => sesiBerikutnya(sessions, hariIni, nowTime()),
    [sessions, hariIni],
  )
  const mendatang = useMemo(
    () => sessions.filter((s) => s.id !== berikutnya?.id && s.date >= hariIni),
    [sessions, berikutnya?.id, hariIni],
  )
  const lewat = useMemo(
    () => sessions.filter((s) => s.date < hariIni || (s.date === hariIni && s.id !== berikutnya?.id && !mendatang.some((x) => x.id === s.id))),
    [sessions, hariIni, berikutnya?.id, mendatang],
  )
  const kelompok = useMemo(() => kelompokPerMinggu(mendatang, hariIni), [mendatang, hariIni])
  const kelompokLewat = useMemo(() => kelompokPerMinggu(lewat, hariIni).reverse(), [lewat, hariIni])

  const statusUntuk = (s: Session) => attendance?.find((a) => a.sessionId === s.id)
  const jumlahDicatat = attendance?.length ?? 0
  const hadir = attendance?.filter((a) => a.status === 'hadir').length ?? 0
  const statusTerbuka = attendance !== null

  return (
    <div className="space-y-4" data-kiosk-allow data-testid="kalender-anggota">
      <PengingatJadwal sessions={sessions} prefix="ingat-anggota" />

      <Card className="p-2 sm:p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">Kalender tim</h2>
            <p className="text-[11px] text-slate-500">Jadwal pelatih · hanya untuk dilihat</p>
          </div>
          <div className="flex rounded-lg border border-slate-700 p-0.5" role="tablist" aria-label="Tampilan jadwal anggota">
            <button
              type="button"
              role="tab"
              data-testid="anggota-tampilan-bulan"
              aria-selected={tampilan === 'bulan'}
              onClick={() => pilihTampilan('bulan')}
              className={cx('rounded-md px-2.5 py-1.5 text-xs font-medium', tampilan === 'bulan' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-slate-100')}
            >
              Bulan
            </button>
            <button
              type="button"
              role="tab"
              data-testid="anggota-tampilan-agenda"
              aria-selected={tampilan === 'agenda'}
              onClick={() => pilihTampilan('agenda')}
              className={cx('rounded-md px-2.5 py-1.5 text-xs font-medium', tampilan === 'agenda' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-slate-100')}
            >
              Agenda
            </button>
          </div>
        </div>

        {statusTerbuka ? (
          <p data-testid="status-kehadiran-anggota" className="mt-3 rounded-lg border border-emerald-800/40 bg-emerald-950/20 px-3 py-2 text-[11px] leading-relaxed text-emerald-300">
            Status kehadiranmu dari catatan pelatih: <b>{hadir} hadir</b> dari {jumlahDicatat} sesi yang dicatat.
          </p>
        ) : (
          <p data-testid="status-kehadiran-anggota" className="mt-3 rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-[11px] leading-relaxed text-slate-400">
            Status kehadiran pribadi masih terkunci. Minta QR kunci pribadi ke pelatih, lalu tekan Perbarui.
          </p>
        )}
      </Card>

      {tampilan === 'bulan' ? (
        <div className="lg:grid lg:grid-cols-[1fr_22rem] lg:gap-4" data-testid="kalender-anggota-bulan">
          <Card className="p-2 sm:p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  data-testid="anggota-bulan-mundur"
                  onClick={() => setBulanAktif((b) => geserBulan(b.tahun, b.bulan, -1))}
                  aria-label="Bulan sebelumnya"
                >
                  ‹
                </Button>
                <h3 data-testid="anggota-judul-bulan" className="min-w-[9rem] text-center text-sm font-semibold text-slate-100">
                  {NAMA_BULAN[bulanAktif.bulan - 1]} {bulanAktif.tahun}
                </h3>
                <Button
                  size="sm"
                  variant="ghost"
                  data-testid="anggota-bulan-maju"
                  onClick={() => setBulanAktif((b) => geserBulan(b.tahun, b.bulan, 1))}
                  aria-label="Bulan berikutnya"
                >
                  ›
                </Button>
              </div>
              <Button
                size="sm"
                variant="ghost"
                data-testid="anggota-hari-ini"
                onClick={() => {
                  setBulanAktif({ tahun: Number(hariIni.slice(0, 4)), bulan: Number(hariIni.slice(5, 7)) })
                  setHariPilih(hariIni)
                }}
              >
                Hari ini
              </Button>
            </div>

            <div className="grid grid-cols-7 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              {NAMA_HARI_SENIN.map((hari) => <div key={hari} className="py-1">{hari}</div>)}
            </div>
            <div data-testid="anggota-kotak-bulan" className="grid grid-cols-7 gap-px overflow-hidden rounded-md bg-slate-800">
              {minggu.flat().map((sel) => {
                const isi = perTanggal.get(sel.tanggal) ?? []
                const dipilih = sel.tanggal === hariPilih
                const hari = sel.tanggal === hariIni
                return (
                  <div
                    key={sel.tanggal}
                    data-testid={`anggota-hari-${sel.tanggal}`}
                    role="button"
                    tabIndex={0}
                    aria-current={hari ? 'date' : undefined}
                    aria-label={`${formatDateLong(sel.tanggal)}${isi.length ? `, ${isi.length} sesi` : ', kosong'}`}
                    onClick={() => setHariPilih(sel.tanggal)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setHariPilih(sel.tanggal)
                      }
                    }}
                    className={cx(
                      'min-h-[3.25rem] cursor-pointer bg-slate-900 p-1 text-left sm:min-h-[5.5rem]',
                      sel.bulanIni ? '' : 'opacity-40',
                      dipilih ? 'ring-2 ring-inset ring-emerald-500' : 'hover:bg-slate-800/70',
                    )}
                  >
                    <div className={cx('mb-0.5 inline-grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px]', hari ? 'bg-emerald-500 font-bold text-slate-950' : 'text-slate-400')}>
                      {Number(sel.tanggal.slice(8))}
                    </div>
                    {/* Ringkas di HP: titik jenis kegiatan, tanpa membuat sel melebar. */}
                    <div className="flex flex-wrap gap-0.5 sm:hidden">
                      {isi.map((s) => {
                        const catatan = statusUntuk(s)
                        return (
                          <span
                            key={s.id}
                            data-testid={`anggota-titik-${s.id}`}
                            title={catatan ? STATUS_META[catatan.status]?.label : s.title}
                            className={cx('h-1.5 w-1.5 rounded-full', catatan ? warnaStatusTitik(catatan.status) : jenisTitik(s.type))}
                          />
                        )
                      })}
                    </div>
                    {/* Laptop: label lengkap + status pribadi, tanpa aksi ubah data. */}
                    <div className="hidden space-y-0.5 sm:block">
                      {isi.map((s) => {
                        const catatan = statusUntuk(s)
                        const lewatSesi = s.date < hariIni
                        return (
                          <div
                            key={s.id}
                            data-testid={`anggota-label-${s.id}`}
                            className={cx('truncate rounded border px-1 py-0.5 text-[10px] leading-tight', sesiMeta(s.type).color)}
                            title={`${s.startTime}–${s.endTime} ${s.title}`}
                          >
                            <b>{s.startTime}</b> {s.title}
                            {catatan ? (
                              <span className={cx('ml-1 font-semibold', STATUS_META[catatan.status]?.color.split(' ')[1] ?? 'text-slate-300')}>
                                {STATUS_META[catatan.status]?.short ?? catatan.status}
                              </span>
                            ) : lewatSesi && statusTerbuka ? (
                              <span className="ml-1 text-slate-400">—</span>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-500">
              <span><i className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />sesi</span>
              <span>H/I/S/A = status kehadiran</span>
              <span>— = belum dicatat</span>
            </div>
          </Card>

          <div data-testid="anggota-detail-hari" className="mt-4 lg:mt-0">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {NAMA_HARI_PANJANG[hariSenin(hariPilih)]}, {formatDateLong(hariPilih).split(', ')[1]}
              </h3>
              <span className="text-[10px] text-slate-600">Baca saja</span>
            </div>
            {!pilihan.length ? (
              <EmptyState title="Tidak ada jadwal di tanggal ini." />
            ) : (
              <div className="space-y-3">
                {pilihan.map((s) => (
                  <MemberSessionCard key={s.id} session={s} attendance={statusUntuk(s)} statusTerbuka={statusTerbuka} hariIni={hariIni} />
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-5" data-testid="kalender-anggota-agenda">
          {berikutnya ? (
            <div data-testid="anggota-sesi-berikutnya">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Sesi berikutnya · <span className="text-emerald-400">{teksHitungMundur(berikutnya, new Date())}</span>
              </h3>
              <MemberSessionCard session={berikutnya} attendance={statusUntuk(berikutnya)} statusTerbuka={statusTerbuka} hariIni={hariIni} besar />
            </div>
          ) : (
            <EmptyState title="Belum ada jadwal mendatang." />
          )}

          {kelompok.map((kel) => (
            <div key={kel.awal}>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{kel.label}</h3>
              <Card className="p-1">
                <ul className="divide-y divide-slate-800">
                  {kel.sesi.map((s) => (
                    <MemberAgendaRow
                      key={s.id}
                      session={s}
                      attendance={statusUntuk(s)}
                      statusTerbuka={statusTerbuka}
                      hariIni={hariIni}
                      open={buka === s.id}
                      onOpen={() => setBuka(buka === s.id ? null : s.id)}
                    />
                  ))}
                </ul>
              </Card>
            </div>
          ))}

          {lewat.length > 0 && (
            <div>
              <Button size="sm" variant="ghost" data-testid="anggota-lihat-lewat" onClick={() => setLihatLewat(!lihatLewat)}>
                {lihatLewat ? 'Sembunyikan' : 'Tampilkan'} yang sudah lewat ({lewat.length})
              </Button>
              {lihatLewat && kelompokLewat.map((kel) => (
                <div key={kel.awal} className="mt-3 opacity-80">
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{kel.label}</h3>
                  <Card className="p-1">
                    <ul className="divide-y divide-slate-800">
                      {[...kel.sesi].reverse().map((s) => (
                        <MemberAgendaRow
                          key={s.id}
                          session={s}
                          attendance={statusUntuk(s)}
                          statusTerbuka={statusTerbuka}
                          hariIni={hariIni}
                          open={buka === s.id}
                          onOpen={() => setBuka(buka === s.id ? null : s.id)}
                        />
                      ))}
                    </ul>
                  </Card>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** Titik jenis kegiatan; warna status pribadi diprioritaskan di pemanggil. */
function jenisTitik(type: string): string {
  return {
    latihan: 'bg-emerald-400',
    section: 'bg-cyan-400',
    gabungan: 'bg-violet-400',
    penampilan: 'bg-amber-400',
    rapat: 'bg-sky-400',
    lainnya: 'bg-slate-400',
  }[type] ?? 'bg-slate-400'
}

function warnaStatusTitik(status: string): string {
  return {
    hadir: 'bg-emerald-400',
    izin: 'bg-sky-400',
    sakit: 'bg-amber-400',
    alpha: 'bg-rose-400',
  }[status] ?? 'bg-slate-400'
}

function MemberSessionCard({
  session,
  attendance,
  statusTerbuka,
  hariIni,
  besar,
}: {
  session: Session
  attendance?: AttendanceRecord
  statusTerbuka: boolean
  hariIni: string
  besar?: boolean
}) {
  const status = attendance ? STATUS_META[attendance.status] : null
  const lewat = session.date < hariIni
  return (
    <Card data-testid={`kartu-anggota-${session.id}`} className={cx(lewat ? 'opacity-85' : '', besar ? 'border-emerald-500/40' : '')}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={sesiMeta(session.type).color}>{sesiMeta(session.type).label}</Badge>
            <span className="text-xs text-emerald-400">{relativeDay(session.date)}</span>
            <span className="text-xs text-slate-500">{session.startTime}–{session.endTime}</span>
          </div>
          <p className={cx('mt-1.5 font-semibold text-slate-100', besar ? 'text-base' : 'text-sm')}>{session.title}</p>
          <p className="text-xs text-slate-500">
            {formatDateLong(session.date)}{session.place ? ` · ${session.place}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {status ? (
            <Badge data-testid={`kehadiran-${session.id}`} className={status.color}>{status.label}</Badge>
          ) : !statusTerbuka ? (
            <Badge data-testid={`kehadiran-${session.id}`} className="border-slate-600/40 bg-slate-700/40 text-slate-400">Terkunci</Badge>
          ) : lewat ? (
            <Badge data-testid={`kehadiran-${session.id}`} className="border-slate-600/40 bg-slate-700/40 text-slate-400">Belum dicatat</Badge>
          ) : null}
          <Button
            size="sm"
            variant="ghost"
            data-testid={`ics-anggota-${session.id}`}
            onClick={() => unduhICS(session)}
          >
            Kalender (.ics)
          </Button>
        </div>
      </div>

      {session.checklist.length > 0 && (
        <ul className="mt-3 space-y-1">
          {session.checklist.map((c) => (
            <li key={c.id} className="flex items-start gap-2 text-xs text-slate-400">
              <span className={cx('mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border text-[10px]', c.done ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-300' : 'border-slate-600 text-slate-600')}>
                {c.done ? '✓' : ''}
              </span>
              <span className={c.done ? 'text-slate-500 line-through' : ''}>{c.text}</span>
            </li>
          ))}
        </ul>
      )}
      {session.notes && <p className="mt-3 whitespace-pre-wrap text-xs leading-relaxed text-slate-400">{session.notes}</p>}
    </Card>
  )
}

function MemberAgendaRow({
  session,
  attendance,
  statusTerbuka,
  hariIni,
  open,
  onOpen,
}: {
  session: Session
  attendance?: AttendanceRecord
  statusTerbuka: boolean
  hariIni: string
  open: boolean
  onOpen: () => void
}) {
  const status = attendance ? STATUS_META[attendance.status] : null
  return (
    <li>
      <button
        type="button"
        data-testid={`baris-anggota-${session.id}`}
        aria-expanded={open}
        onClick={onOpen}
        className="flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-slate-800/60"
      >
        <span className={cx('h-2 w-2 shrink-0 rounded-full', jenisTitik(session.type))} />
        <span className="w-[4.5rem] shrink-0 text-xs text-slate-400">
          {NAMA_HARI_SENIN[hariSenin(session.date)]} {Number(session.date.slice(8))}/{Number(session.date.slice(5, 7))}
        </span>
        <span className="w-12 shrink-0 text-xs text-slate-500">{session.startTime}</span>
        <span className="min-w-0 flex-1 truncate text-sm text-slate-200">{session.title}</span>
        {status ? (
          <span className={cx('shrink-0 text-[11px] font-semibold', status.color.split(' ')[1] ?? 'text-slate-300')}>{status.short}</span>
        ) : !statusTerbuka && session.date < hariIni ? (
          <span className="shrink-0 text-[11px] text-slate-500">🔒</span>
        ) : session.date < hariIni ? (
          <span className="shrink-0 text-[11px] text-slate-500">—</span>
        ) : null}
      </button>
      {open && <div className="mb-2 mt-1"><MemberSessionCard session={session} attendance={attendance} statusTerbuka={statusTerbuka} hariIni={hariIni} /></div>}
    </li>
  )
}

/**
 * Tab "Formasi" untuk anggota.
 *
 * Isinya: pilihan drill, navigasi set memakai tombol besar (‹ ›), peta posisi
 * dengan titiknya sendiri ditandai lingkaran emas, koordinat & jumlah langkah,
 * informasi **asal** (set sebelumnya) dan **tujuan** (set berikutnya), serta
 * tombol **Putar** untuk melihat perpindahannya beranimasi — supaya anggota
 * bisa berlatih mandiri tanpa harus menunggu pelatih.
 */
function MemberDrill({ bundle, me, members }: { bundle: ShareBundle; me: Member; members: Member[] }) {
  const [drillId, setDrillId] = useState(bundle.drills[0]?.id ?? '')
  const [setId, setSetId] = useState('')
  const [playing, setPlaying] = useState(false)

  const drill = bundle.drills.find((d) => d.id === drillId) ?? bundle.drills[0]
  const sets: DrillSet[] = useMemo(
    () => bundle.sets.filter((s) => s.drillId === drill?.id).sort((a, b) => a.order - b.order),
    [bundle.sets, drill?.id],
  )
  useEffect(() => {
    if (sets.length && !sets.some((s) => s.id === setId)) setSetId(sets[0].id)
  }, [sets, setId])

  const f: FieldConfig = drill?.field ?? DEFAULT_FIELD
  /** Ukuran titik mengikuti luas lapangan — sama seperti di editor. */
  const uk = (n: number) => ukurTitik(f, n)
  const sYd = stepYd(f)
  const halfW = f.widthYd / 2
  const halfL = (f.lengthYd + f.endZoneYd * 2) / 2
  const VW = f.lengthYd + f.endZoneYd * 2
  const VH = f.widthYd
  const sx = (x: number) => halfL - x
  const sy = (y: number) => halfW - y

  const idxSet = sets.findIndex((s) => s.id === setId)
  const set = sets[idxSet] ?? sets[0]
  const prevSet = idxSet > 0 ? sets[idxSet - 1] : undefined
  const nextSet = idxSet >= 0 && idxSet < sets.length - 1 ? sets[idxSet + 1] : undefined
  const myPoint = set?.points?.[me.id]
  const myPrev = prevSet?.points?.[me.id]
  const myNext = nextSet?.points?.[me.id]

  /** Elemen <g> tiap titik — dipakai untuk menggerakkan saat animasi. */
  const dotRefs = useRef(new Map<string, SVGGElement>())
  const rafRef = useRef(0)

  /**
   * Animasi perpindahan ke set berikutnya. Sama seperti mode presenter: titik
   * digerakkan lewat atribut `transform`, tanpa render ulang React per frame,
   * supaya tetap mulus walau timnya 80 orang. Setelah selesai, set aktif maju.
   */
  useEffect(() => {
    if (!playing || !set || !nextSet || !drill) {
      setPlaying(false)
      return
    }
    const total = Math.max(1, set.counts ?? 8) * drill.beatsPerCount * (60_000 / Math.max(20, drill.tempo))
    const t0 = performance.now()
    const vec: [string, number, number][] = []
    for (const [id, p] of Object.entries(set.points ?? {})) {
      const q = nextSet.points[id]
      if (!q) continue
      vec.push([id, sx(q.x) - sx(p.x), sy(q.y) - sy(p.y)])
    }
    const loop = () => {
      const p = Math.min(1, (performance.now() - t0) / total)
      for (const [id, vx, vy] of vec) {
        dotRefs.current.get(id)?.setAttribute('transform', `translate(${vx * p} ${vy * p})`)
      }
      if (p < 1) {
        rafRef.current = requestAnimationFrame(loop)
      } else {
        for (const [id] of vec) dotRefs.current.get(id)?.removeAttribute('transform')
        setPlaying(false)
        setSetId(nextSet.id)
      }
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(rafRef.current)
      for (const [id] of vec) dotRefs.current.get(id)?.removeAttribute('transform')
    }
  }, [playing, set, nextSet, drill])

  const gantiSet = (arah: number) => {
    setPlaying(false)
    const i = Math.min(Math.max(0, idxSet + arah), sets.length - 1)
    if (sets[i]) setSetId(sets[i].id)
  }

  if (!drill) return <EmptyState title="Paket ini tidak berisi formasi" />

  const jarak = (a?: { x: number; y: number }, b?: { x: number; y: number }) =>
    a && b ? Math.round(Math.hypot(b.x - a.x, b.y - a.y) / sYd) : null

  return (
    <div className="space-y-3">
      <Card>
        <Select value={drillId} onChange={(e) => setDrillId(e.target.value)} className="mb-2 w-full">
          {bundle.drills.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>

        {/* Navigasi set — tombol besar supaya mudah dipakai di HP */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => gantiSet(-1)}
            disabled={idxSet <= 0}
            className="grid h-12 w-14 place-items-center rounded-xl border border-slate-700 bg-slate-900 text-2xl text-slate-100 active:scale-[.97] disabled:opacity-30"
            title="Set sebelumnya"
          >
            ‹
          </button>
          <div className="min-w-0 flex-1 text-center">
            <p className="truncate text-sm font-medium text-slate-100">{set?.name}</p>
            <p className="text-[11px] text-slate-500">
              Set {idxSet + 1} dari {sets.length} · {set?.counts ?? 0} count
            </p>
          </div>
          <button
            type="button"
            onClick={() => gantiSet(1)}
            disabled={idxSet >= sets.length - 1}
            className="grid h-12 w-14 place-items-center rounded-xl border border-slate-700 bg-slate-900 text-2xl text-slate-100 active:scale-[.97] disabled:opacity-30"
            title="Set berikutnya"
          >
            ›
          </button>
        </div>

        {nextSet && (
          <Button
            className="mt-2 w-full"
            variant={playing ? 'danger' : 'primary'}
            onClick={() => setPlaying((p) => !p)}
          >
            {playing ? <IconPause size={16} /> : <IconPlay size={16} />}
            {playing ? 'Jeda' : `Putar perpindahan ke ${nextSet.name}`}
          </Button>
        )}
      </Card>

      <Card padded={false} className="overflow-hidden">
        <div className="bg-slate-950 p-2">
          <svg viewBox={`0 0 ${VW} ${VH}`} className="w-full">
            <FieldSurface f={f} VW={VW} VH={VH} sx={sx} sy={sy} />
            {nextSet &&
              Object.entries(set?.points ?? {}).map(([id, p]) => {
                const q = nextSet.points[id]
                if (!q) return null
                return (
                  <line
                    key={`p-${id}`}
                    x1={sx(p.x)}
                    y1={sy(p.y)}
                    x2={sx(q.x)}
                    y2={sy(q.y)}
                    stroke="rgba(255,255,255,0.35)"
                    strokeWidth={id === me.id ? 0.4 : 0.15}
                    strokeDasharray="1 1"
                  />
                )
              })}
            {Object.entries(set?.points ?? {}).map(([id, p]) => {
              const m = members.find((x) => x.id === id)
              if (!m) return null
              const mine = id === me.id
              const deg = facingDeg(p.facing, p.facingDeg)
              const rad = (deg * Math.PI) / 180
              return (
                <g
                  key={id}
                  ref={(el) => {
                    if (el) dotRefs.current.set(id, el)
                    else dotRefs.current.delete(id)
                  }}
                >
                  <line
                    x1={sx(p.x)}
                    y1={sy(p.y)}
                    x2={sx(p.x) - Math.sin(rad) * 1.6}
                    y2={sy(p.y) + Math.cos(rad) * 1.6}
                    stroke={sectionDot(m.section)}
                    strokeWidth={0.35}
                  />
                  <circle
                    cx={sx(p.x)}
                    cy={sy(p.y)}
                    r={uk(mine ? 2.2 : 1.15)}
                    fill={sectionDot(m.section)}
                    stroke={mine ? '#fbbf24' : '#0b1120'}
                    strokeWidth={uk(mine ? 0.6 : 0.18)}
                  />
                  {mine && (
                    <circle
                      cx={sx(p.x)}
                      cy={sy(p.y)}
                      r={uk(3.4)}
                      fill="none"
                      stroke="#fbbf24"
                      strokeWidth={uk(0.3)}
                      strokeDasharray="1 0.8"
                    />
                  )}
                  <text
                    x={sx(p.x)}
                    y={sy(p.y) + 0.45}
                    textAnchor="middle"
                    fontSize={mine ? 1.6 : 1.1}
                    fill="#0b1120"
                    style={{ fontWeight: 700 }}
                  >
                    {m.code}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>
        <div className="border-t border-slate-800 px-3 py-2 text-[11px] text-slate-500">
          Titikmu ditandai lingkaran emas · ukuran langkah {Math.round((1 / sYd) * 10) / 10} langkah/yard
        </div>
      </Card>

      <Card>
        <h3 className="mb-2 text-sm font-semibold text-slate-200">Posisiku — {set?.name}</h3>
        {myPoint ? (
          <>
            <p className="rounded-lg bg-slate-950/60 px-3 py-2.5 font-mono text-sm text-emerald-300">
              {coordText(myPoint.x, myPoint.y, f)}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <StatTile
                label="Langkah dari garis 50"
                value={Math.round((myPoint.x / sYd) * 4) / 4}
                sub={myPoint.x >= 0 ? 'arah Side 1' : 'arah Side 2'}
              />
              <StatTile
                label="Langkah dari garis depan"
                value={Math.round(((myPoint.y + f.widthYd / 2) / sYd) * 4) / 4}
                sub="front sideline = 0"
              />
            </div>

            {/* Asal: set sebelumnya */}
            {prevSet && (
              <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                <p className="text-xs font-medium text-slate-300">
                  Dari {prevSet.name}: {prevSet.counts ?? 0} count
                  {jarak(myPrev, myPoint) !== null && (
                    <>
                      {' '}
                      · jarak <b className="text-sky-400">{jarak(myPrev, myPoint)}</b> langkah
                    </>
                  )}
                </p>
                {myPrev && (
                  <p className="mt-1 text-[11px] text-slate-500">
                    Asal: {coordText(myPrev.x, myPrev.y, f)}
                  </p>
                )}
              </div>
            )}

            {/* Tujuan: set berikutnya */}
            {nextSet && (
              <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                <p className="text-xs font-medium text-slate-300">
                  Gerakan ke {nextSet.name}: {set?.counts ?? 0} count
                  {jarak(myPoint, myNext) !== null && (
                    <>
                      {' '}
                      · jarak <b className="text-emerald-400">{jarak(myPoint, myNext)}</b> langkah
                    </>
                  )}
                </p>
                {myNext && (
                  <p className="mt-1 text-[11px] text-slate-500">
                    Tujuan: {coordText(myNext.x, myNext.y, f)} ·{' '}
                    {Math.round(((set?.counts ?? 0) * 60) / drill.tempo)} detik pada {drill.tempo} BPM
                  </p>
                )}
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-slate-400">Kamu tidak ada di set ini (mungkin istirahat/prop).</p>
        )}
      </Card>
    </div>
  )
}

/**
 * C2 — tab "Kuis" untuk anggota: tebak posisi sendiri di set berikutnya.
 *
 * Satu soal per perpindahan set (berurutan, atau acak bila diminta). Peta
 * menampilkan set ASAL — titik sendiri berlingkaran emas, seperti tab
 * Formasi — tetapi TANPA garis perpindahan: di situlah soalnya. Anggota
 * mengetuk peta untuk meletakkan tebakan (bisa digeser dengan mengetuk
 * lagi), lalu mengunci jawaban. Benar bila dalam toleransi langkah dari
 * kunci. Baca-saja: tidak menulis apa pun ke basis data.
 */
function MemberKuis({ bundle, me, members }: { bundle: ShareBundle; me: Member; members: Member[] }) {
  const [drillId, setDrillId] = useState(bundle.drills[0]?.id ?? '')
  /** 0 = urutan set; selain itu benih acakan (lihat `acakUrutan`). */
  const [benih, setBenih] = useState(0)
  const [idx, setIdx] = useState(0)
  const [tebakan, setTebakan] = useState<{ x: number; y: number } | null>(null)
  const [terkunci, setTerkunci] = useState<NilaiTebakan | null>(null)
  const [benar, setBenar] = useState(0)

  const drill = bundle.drills.find((d) => d.id === drillId) ?? bundle.drills[0]
  const sets: DrillSet[] = useMemo(
    () => bundle.sets.filter((s) => s.drillId === drill?.id).sort((a, b) => a.order - b.order),
    [bundle.sets, drill?.id],
  )
  const soal = useMemo(() => acakUrutan(bangunSoal(sets, me.id), benih), [sets, me.id, benih])
  const selesai = idx >= soal.length
  const kini = selesai ? undefined : soal[idx]

  const f: FieldConfig = drill?.field ?? DEFAULT_FIELD
  const uk = (n: number) => ukurTitik(f, n)
  const sYd = stepYd(f)
  const halfW = f.widthYd / 2
  const halfL = (f.lengthYd + f.endZoneYd * 2) / 2
  const VW = f.lengthYd + f.endZoneYd * 2
  const VH = f.widthYd
  const sx = (x: number) => halfL - x
  const sy = (y: number) => halfW - y

  const petaAsal = kini ? sets.find((s) => s.id === kini.dariSetId) : undefined
  const dijawab = Math.min(idx + (terkunci ? 1 : 0), soal.length)

  function ulang(acak: boolean) {
    setIdx(0)
    setTebakan(null)
    setTerkunci(null)
    setBenar(0)
    setBenih(acak ? Date.now() : 0)
  }

  function ketukPeta(e: { clientX: number; clientY: number; currentTarget: SVGSVGElement }) {
    if (terkunci || !kini) return
    const r = e.currentTarget.getBoundingClientRect()
    if (r.width <= 0 || r.height <= 0) return
    // Balik proyeksi peta: sx = halfL − x, jadi x = halfL − vx.
    setTebakan({
      x: halfL - ((e.clientX - r.left) / r.width) * VW,
      y: halfW - ((e.clientY - r.top) / r.height) * VH,
    })
  }

  function kunci() {
    if (!kini || !tebakan || terkunci) return
    const nilai = nilaiTebakan(tebakan, kini.kunci, sYd)
    setTerkunci(nilai)
    if (nilai.benar) setBenar((b) => b + 1)
  }

  function lanjut() {
    setIdx((i) => i + 1)
    setTebakan(null)
    setTerkunci(null)
  }

  if (!drill) return <EmptyState title="Paket ini tidak berisi formasi" />

  return (
    <div className="space-y-3" data-kiosk-allow>
      <Card>
        <Select
          value={drill.id}
          onChange={(e) => {
            setDrillId(e.target.value)
            ulang(false)
          }}
          className="mb-2 w-full"
        >
          {bundle.drills.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
        <div className="flex items-center justify-between gap-2">
          <p data-testid="soal-ke" className="text-xs text-slate-400">
            {soal.length ? (selesai ? `Selesai — ${soal.length} soal` : `Soal ${idx + 1} dari ${soal.length}`) : 'Belum ada soal'}
            {benih !== 0 && soal.length ? ' · acak' : ''}
          </p>
          <p data-testid="skor-kuis" className="text-xs font-medium text-slate-300">
            Benar {benar} dari {dijawab}
          </p>
        </div>
        {soal.length > 1 && !selesai && (
          <Button size="sm" variant="ghost" data-testid="acak-kuis" onClick={() => ulang(true)} className="mt-2 w-full">
            <IconLoop size={14} /> Acak urutan
          </Button>
        )}
      </Card>

      {!soal.length ? (
        <EmptyState
          title="Belum bisa kuis"
          desc="Kamu harus ada di dua set berurutan supaya ada yang ditebak. Minta pelatih menambah set."
        />
      ) : selesai ? (
        <Card data-testid="selesai-kuis">
          <h3 className="mb-1 text-sm font-semibold text-slate-200">Kuis selesai</h3>
          <p className="mb-3 text-sm text-slate-400">
            Skor: <b className="text-emerald-400">{benar}</b> benar dari {soal.length} soal
            {benar === soal.length && soal.length > 0 ? ' — hafal semua!' : '.'}
          </p>
          <div className="flex gap-2">
            <Button data-testid="ulang-kuis" onClick={() => ulang(false)} className="flex-1">
              Main lagi
            </Button>
            <Button variant="ghost" onClick={() => ulang(true)} className="flex-1">
              Acak & main lagi
            </Button>
          </div>
        </Card>
      ) : (
        kini && (
          <>
            <Card>
              <p className="text-sm text-slate-200">
                Dari <b>{kini.dariNama}</b> ke <b>{kini.keNama}</b> · {kini.counts} count
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                Ketuk posisimu di {kini.keNama} — kunci jawaban bila sudah yakin.
              </p>
            </Card>

            <Card padded={false} className="overflow-hidden">
              <div className="bg-slate-950 p-2">
                <svg
                  data-testid="peta-kuis"
                  viewBox={`0 0 ${VW} ${VH}`}
                  className="w-full cursor-crosshair touch-manipulation"
                  onClick={ketukPeta}
                >
                  <FieldSurface f={f} VW={VW} VH={VH} sx={sx} sy={sy} />
                  {Object.entries(petaAsal?.points ?? {}).map(([id, p]) => {
                    const m = members.find((x) => x.id === id)
                    if (!m) return null
                    const mine = id === me.id
                    const deg = facingDeg(p.facing, p.facingDeg)
                    const rad = (deg * Math.PI) / 180
                    return (
                      <g key={id}>
                        <line
                          x1={sx(p.x)}
                          y1={sy(p.y)}
                          x2={sx(p.x) - Math.sin(rad) * 1.6}
                          y2={sy(p.y) + Math.cos(rad) * 1.6}
                          stroke={sectionDot(m.section)}
                          strokeWidth={0.35}
                        />
                        <circle
                          cx={sx(p.x)}
                          cy={sy(p.y)}
                          r={uk(mine ? 2.2 : 1.15)}
                          fill={sectionDot(m.section)}
                          stroke={mine ? '#fbbf24' : '#0b1120'}
                          strokeWidth={uk(mine ? 0.6 : 0.18)}
                        />
                        {mine && (
                          <circle
                            cx={sx(p.x)}
                            cy={sy(p.y)}
                            r={uk(3.4)}
                            fill="none"
                            stroke="#fbbf24"
                            strokeWidth={uk(0.3)}
                            strokeDasharray="1 0.8"
                          />
                        )}
                        <text
                          x={sx(p.x)}
                          y={sy(p.y) + 0.45}
                          textAnchor="middle"
                          fontSize={mine ? 1.6 : 1.1}
                          fill="#0b1120"
                          style={{ fontWeight: 700 }}
                        >
                          {m.code}
                        </text>
                      </g>
                    )
                  })}
                  {tebakan && (
                    <g data-testid="penanda-tebakan">
                      <circle
                        cx={sx(tebakan.x)}
                        cy={sy(tebakan.y)}
                        r={uk(2.6)}
                        fill="rgba(56,189,248,.35)"
                        stroke="#38bdf8"
                        strokeWidth={uk(0.5)}
                      />
                      <line
                        x1={sx(tebakan.x) - uk(1.2)}
                        y1={sy(tebakan.y)}
                        x2={sx(tebakan.x) + uk(1.2)}
                        y2={sy(tebakan.y)}
                        stroke="#38bdf8"
                        strokeWidth={uk(0.4)}
                      />
                      <line
                        x1={sx(tebakan.x)}
                        y1={sy(tebakan.y) - uk(1.2)}
                        x2={sx(tebakan.x)}
                        y2={sy(tebakan.y) + uk(1.2)}
                        stroke="#38bdf8"
                        strokeWidth={uk(0.4)}
                      />
                    </g>
                  )}
                  {terkunci && tebakan && (
                    <g data-testid="penanda-kunci">
                      <line
                        x1={sx(tebakan.x)}
                        y1={sy(tebakan.y)}
                        x2={sx(kini.kunci.x)}
                        y2={sy(kini.kunci.y)}
                        stroke="rgba(52,211,153,.7)"
                        strokeWidth={uk(0.35)}
                        strokeDasharray="1 1"
                      />
                      <circle
                        cx={sx(kini.kunci.x)}
                        cy={sy(kini.kunci.y)}
                        r={uk(2.2)}
                        fill="none"
                        stroke="#34d399"
                        strokeWidth={uk(0.6)}
                      />
                    </g>
                  )}
                </svg>
              </div>
              <div className="border-t border-slate-800 px-3 py-2 text-[11px] text-slate-500">
                {terkunci
                  ? 'Biru = tebakanmu · hijau = kunci'
                  : tebakan
                    ? 'Ketuk lagi untuk menggeser, lalu kunci jawaban.'
                    : 'Ketuk peta untuk meletakkan tebakanmu.'}
              </div>
            </Card>

            {!terkunci ? (
              <Button
                data-testid="kunci-jawaban"
                variant="primary"
                disabled={!tebakan}
                onClick={kunci}
                className="w-full"
              >
                Kunci jawaban
              </Button>
            ) : (
              <Card data-testid="hasil-kuis">
                <p className={`text-sm font-semibold ${terkunci.benar ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {terkunci.benar ? 'Tepat!' : 'Belum tepat.'}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Jarak tebakanmu {terkunci.jarakLangkah} langkah (toleransi {TOLERANSI_LANGKAH}).
                </p>
                <p data-testid="kunci-koor" className="mt-2 rounded-lg bg-slate-950/60 px-3 py-2 font-mono text-sm text-emerald-300">
                  {coordText(kini.kunci.x, kini.kunci.y, f)}
                </p>
                <Button data-testid="lanjut-kuis" onClick={lanjut} className="mt-3 w-full">
                  {idx + 1 >= soal.length ? 'Lihat skor' : 'Lanjut'}
                </Button>
              </Card>
            )}
          </>
        )
      )}
    </div>
  )
}

/**
 * Tab "Catatan" — catatan evaluasi pribadi yang ditulis pelatih.
 * Hanya catatan untuk anggota yang sedang dipilih yang ditampilkan.
 */
function MemberNotes({ bundle, me, locked }: { bundle: ShareBundle; me: Member; locked?: boolean }) {
  const notes: MemberNote[] = useMemo(
    () => (bundle.memberNotes ?? []).filter((n) => n.memberId === me.id).sort((a, b) => b.at - a.at),
    [bundle.memberNotes, me.id],
  )

  if (!notes.length) {
    return (
      <div>
        <EmptyState
          title="Belum ada catatan"
          desc={locked
            ? 'Catatan evaluasi dari pelatih akan muncul di sini setelah paket diperbarui.'
            : 'Mintalah QR kunci ke pelatih untuk membuka catatan pribadi, atau tunggu materi diperbarui.'}
        />
      </div>
    )
  }

  return (
    <Card padded={false}>
      <ul className="divide-y divide-slate-800/70">
        {notes.map((n) => (
          <li key={n.id} className="px-4 py-3">
            <p className="mb-1 text-[11px] text-slate-500">
              {formatDateLong(new Date(n.at).toISOString().slice(0, 10))}
              {n.by ? ` · ${n.by}` : ''}
            </p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-200">{n.text}</p>
          </li>
        ))}
      </ul>
    </Card>
  )
}

/**
 * Tab "Absensi" milik anggota.
 *
 * Persentase kehadiran dihitung dari sesi yang **dicatat pelatih**, bukan
 * dari seluruh sesi. Dua keadaan yang berbeda bisa menghasilkan angka yang
 * sama — pelatih mencatat 2 dari 5 sesi (dua-duanya hadir) dan pelatih
 * mencatat semua 5 sesi (semuanya hadir) keduanya menampilkan **100%**.
 *
 * Karena itu penyebutnya ditulis di bawah angkanya, persis seperti yang
 * sudah dilakukan layar rekap pelatih sendiri, dan sesi yang sudah lewat
 * tanpa catatan ditampilkan tersendiri sebagai **"Belum dicatat"** —
 * **bukan** digabung ke "tidak hadir". Pelatih yang belum sempat mengisi
 * absensi tidak boleh membuat anggotanya tampak mangkir.
 */
function MemberAttendance({ bundle, me, locked }: { bundle: ShareBundle; me: Member; locked?: boolean }) {
  const mine = bundle.attendance.filter((a) => a.memberId === me.id)
  const hadir = mine.filter((a) => a.status === 'hadir').length
  const sessions = [...bundle.sessions].sort((a, b) => b.date.localeCompare(a.date))

  /** Sesi yang sudah lewat dan belum punya catatan apa pun. */
  const belumDicatat = sessions.filter(
    (s) => daysFromToday(s.date) < 0 && !mine.some((a) => a.sessionId === s.id),
  )
  const baris = sessions
    .map((s) => ({ s, r: mine.find((a) => a.sessionId === s.id) }))
    .filter(({ s, r }) => r != null || daysFromToday(s.date) < 0)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <StatTile label="Hadir" value={hadir} accent="text-emerald-400" />
        <StatTile label="Izin/Sakit" value={mine.filter((a) => a.status === 'izin' || a.status === 'sakit').length} />
        <StatTile
          label="Kehadiran"
          /*
           * Bila pelatih belum mencatat apa pun, jangan menampilkan "0%".
           * Nol persen pada data yang kosong berbunyi sebagai tuduhan
           * mangkir, padahal yang benar adalah "belum ada datanya".
           * Angka yang tidak ada dibedakan dari angka nol.
           */
          value={mine.length ? `${pct(hadir, mine.length)}%` : '—'}
          sub={mine.length ? `${hadir} dari ${mine.length} sesi yang dicatat` : 'belum ada yang dicatat'}
          accent={mine.length ? 'text-emerald-400' : undefined}
        />
      </div>
      {belumDicatat.length > 0 && (
        <p className="text-[11px] leading-relaxed text-slate-500">
          {belumDicatat.length} sesi lain yang sudah lewat belum dicatat pelatih — ditandai{' '}
          <b>Belum dicatat</b> di bawah, bukan berarti tidak hadir.
        </p>
      )}
      <Card padded={false}>
        <ul className="divide-y divide-slate-800/70">
          {baris.map(({ s, r }) => (
            <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm text-slate-200">{s.title}</p>
                <p className="text-[11px] text-slate-500">{s.date}</p>
              </div>
              {r ? (
                <Badge className={STATUS_META[r.status].color}>{STATUS_META[r.status].label}</Badge>
              ) : (
                <Badge className="bg-slate-700/40 text-slate-400 border-slate-600/40">Belum dicatat</Badge>
              )}
            </li>
          ))}
        </ul>
        {!baris.length && (
          <div className="p-4">
            <EmptyState
              title="Belum ada catatan kehadiran"
              desc={locked
                ? 'Paket ini belum memuat data absensi.'
                : 'Mintalah QR kunci ke pelatih untuk membuka data kehadiran pribadi.'}
            />
          </div>
        )}
      </Card>
    </div>
  )
}

/* --------------------------------- Mode ------------------------------------- */

/*
 * Simpanan & pembacaan mode kini hidup di `src/lib/modePerangkat`, bersama
 * aturan-aturannya. Dulu ia di sini, tetapi komponen penjaga rutenya butuh
 * `useMemberMode` sementara komponen itu sendiri dipakai oleh halaman ini —
 * impor melingkar. Menyatukan keadaan dan aturannya di satu modul lebih
 * rapi daripada sekadar memutus lingkaran itu.
 */
export { bacaMode, simpanMode } from '../lib/modePerangkat'

// #5 — hooknya pindah ke `src/hooks/useMemberMode.ts` supaya `Layout` tidak
// menarik halaman ini ke bundel awal. Diteruskan di sini untuk kompatibilitas.
export { useMemberMode } from '../hooks/useMemberMode'
