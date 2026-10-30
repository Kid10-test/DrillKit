/**
 * Pusat Data — satu tempat untuk impor & ekspor seluruh fitur.
 *
 * Sebelumnya impor/ekspor tersebar di lima tempat dengan lima format:
 * backup JSON (Pengaturan), paket show (Berbagi), tukar repertoar (Musik),
 * CSV koordinat (Drill), CSV anggota (Anggota). Tiga fitur besar — jadwal,
 * absensi, rekap — bahkan hanya bisa **keluar** tanpa bisa **masuk** kembali.
 *
 * Halaman ini menampung dua alur:
 *
 * 1. **Pindah data** (JSON) — pilih jenisnya, pindahkan ke perangkat lain.
 *    Beda dengan backup, yang selalu memuat segalanya.
 * 2. **Round-trip CSV** — ekspor, sunting massal di Excel, impor balik.
 *
 * Dua aturan yang dipilih pemakai dan karena itu dikodekan di sini:
 * - **Bentrokan: tanya dulu.** Sebelum apa pun ditulis, tampilkan "N baru /
 *   M ditimpa". Menimpa tanpa pemberitahuan menghapus suntingan lokal tanpa
 *   jejak.
 * - **Rujukan: longgar.** Impor saja semuanya; rujukan yang tidak ketemu
 *   dikosongkan dan **dilaporkan**. Kehilangan data lebih buruk daripada
 *   rujukan yang putus — asalkan yang putus tidak diam-diam.
 */
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import {
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  useToast,
} from '../components/ui'
import { IconDownload, IconUpload, IconShare } from '../components/Icons'
import { DEFAULT_SECTIONS, downloadFile, uid } from '../lib/utils'
import { intipTitipan, mintaPratinjau, TombolBukaBerkas, useTitipan } from '../components/BukaBerkas'
import { capTanggal, kenaliBerkas, kenaliTeks, namaData, namaSetoranSeksi } from '../lib/bukaBerkas'
import {
  LABEL_RENTANG_SEKSI,
  gabungAbsensiAsisten,
  gabungKemajuanAman,
  gabungSetoranAman,
  hitungPratinjauSetoranSeksi,
  ringkasGabungSeksi,
  susunBerkasSetoranSeksi,
  type RentangSetoranSeksi,
} from '../lib/kolaborasiSeksi'
import {
  LABEL_JENIS_DATA,
  URUTAN_JENIS_DATA,
  bacaBerkasPindah,
  hitungBentrok,
  putusRujukan,
  ringkasPutus,
  totalBerkas,
} from '../lib/pindah'
import type { BerkasPindah, JenisData, RingkasanJenis, YangAda } from '../lib/pindah'
import type {
  AttendanceRecord,
  CatatanSetoran,
  Evaluasi,
  Kemajuan,
  Member,
  MemberNote,
  SectionDef,
  Session,
  TargetSetoran,
} from '../db/types'
import {
  keputusanAwal,
  perluDitanya,
  saringBentrokLokal,
  susunSaran,
  terapkanCocok,
  tulisUlangMuatan,
  type KeputusanCocok,
  type SaranBaris,
} from '../lib/namaAnggota'
import { PanelCocok } from '../components/PanelCocok'
import { KartuDaftarInduk } from '../components/DaftarInduk'

/** Tulis daftar entitas sebuah jenis ke berkas. */
function taruh(berkas: BerkasPindah, jenis: JenisData, daftar: unknown[]): void {
  switch (jenis) {
    case 'anggota': berkas.anggota = daftar as never; break
    case 'jadwal': berkas.jadwal = daftar as never; break
    case 'absensi': berkas.absensi = daftar as never; break
    case 'lagu': berkas.lagu = daftar as never; break
    case 'setlist': berkas.setlist = daftar as never; break
    case 'drill': berkas.drill = daftar as never; break
    case 'set': berkas.set = daftar as never; break
    case 'kemajuan': berkas.kemajuan = daftar as never; break
    case 'catatan': berkas.catatan = daftar as never; break
    case 'evaluasi': berkas.evaluasi = daftar as never; break
    case 'targetSetoran': berkas.targetSetoran = daftar as never; break
    case 'setoran': berkas.setoran = daftar as never; break
  }
}

/** Jenis yang bisa dipilih **satu per satu** (daftarnya pendek). */
const JENIS_PILIH: JenisData[] = ['lagu', 'setlist', 'drill']

export default function Data() {
  const [searchParams] = useSearchParams()
  const seksiDariUrl = searchParams.get('seksi') || ''
  const [alur, setAlur] = useState<'pindah' | 'csv'>('pindah')

  const settings = useLiveQuery(() => db.settings.get('team'), [], undefined)
  const anggota = useLiveQuery(() => db.members.toArray(), [], [])
  const jadwal = useLiveQuery(() => db.sessions.toArray(), [], [])
  const absensi = useLiveQuery(() => db.attendance.toArray(), [], [])
  const lagu = useLiveQuery(() => db.songs.toArray(), [], [])
  const setlist = useLiveQuery(() => db.setlists.toArray(), [], [])
  const drill = useLiveQuery(() => db.drills.toArray(), [], [])
  const set = useLiveQuery(() => db.sets.toArray(), [], [])
  const kemajuan = useLiveQuery(() => db.kemajuan.toArray(), [], [])
  const catatan = useLiveQuery(() => db.memberNotes.toArray(), [], [])
  const evaluasi = useLiveQuery(() => db.evaluasi.toArray(), [], [])
  const targetSetoran = useLiveQuery(() => db.targetSetoran.toArray(), [], [])
  const setoran = useLiveQuery(() => db.setoran.toArray(), [], [])

  const sumber: Record<JenisData, unknown[]> = useMemo(
    () => ({
      anggota,
      jadwal,
      absensi,
      lagu,
      setlist,
      drill,
      set,
      kemajuan,
      catatan,
      evaluasi,
      targetSetoran,
      setoran,
    }),
    [anggota, jadwal, absensi, lagu, setlist, drill, set, kemajuan, catatan, evaluasi, targetSetoran, setoran],
  )

  // #7 — titipan CSV dari pintu baru: bukakan tab CSV-nya sekalian.
  useEffect(() => {
    const cek = () => {
      const t = intipTitipan()
      if (!t) return
      if (t.jenis === 'csv-jadwal' || t.jenis === 'csv-absensi') setAlur('csv')
      else if (t.jenis === 'data') setAlur('pindah')
    }
    cek()
    window.addEventListener('drillkit:titipan', cek)
    return () => window.removeEventListener('drillkit:titipan', cek)
  }, [])

  /** Id yang sudah ada di perangkat, untuk menghitung bentrokan. */
  const yangAda = useMemo((): YangAda => {
    const kunci = (daftar: unknown[]) =>
      (daftar as { id?: string; key?: string }[]).map((e) => e?.id ?? e?.key ?? '').filter(Boolean)
    return {
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
      targetSetoran: kunci(targetSetoran),
      setoran: kunci(setoran),
    }
  }, [sumber])

  return (
    <div>
      <PageHeader
        title="Data"
        subtitle="Impor & ekspor seluruh fitur — pindahkan data antar perangkat, atau sunting massal di Excel"
      />

      <KartuDaftarInduk />

      {/* #7 C — menu Data sebagai pusat: mau apa? */}
      <Card className="mb-4" data-testid="mau-apa">
        <h2 className="mb-1 text-sm font-semibold text-slate-200">Mau apa?</h2>
        <p className="mb-3 text-[11px] leading-relaxed text-slate-500">
          Semua urusan berkas mulai dari sini. Menerima berkas dari pelatih lain? Tekan{' '}
          <b>Buka berkas</b> — jenisnya dikenali otomatis.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Link
            to="/pengaturan"
            data-testid="mau-semua"
            className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 hover:bg-slate-800/50"
          >
            <p className="text-xs font-semibold text-slate-200">Pindahkan semua data</p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Backup lengkap di Pengaturan — untuk ganti perangkat.
            </p>
          </Link>
          <button
            type="button"
            data-testid="mau-sebagian"
            onClick={() => setAlur('pindah')}
            className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-left hover:bg-slate-800/50"
          >
            <p className="text-xs font-semibold text-slate-200">Kirim sebagian data</p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Pilih jenisnya di bawah — lagu, jadwal, drill, dan lainnya.
            </p>
          </button>
          <Link
            to="/drill"
            data-testid="mau-show"
            className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 hover:bg-slate-800/50"
          >
            <p className="text-xs font-semibold text-slate-200">Kirim show ke pelatih lain</p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Buka drill-nya, tekan ⚙, lalu Berbagi show.
            </p>
          </Link>
          <Link
            to="/berbagi"
            data-testid="mau-anggota"
            className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 hover:bg-slate-800/50"
          >
            <p className="text-xs font-semibold text-slate-200">Kirim ke anggota</p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Berkas grup atau per anggota di halaman Berbagi.
            </p>
          </Link>
        </div>
        <div className="mt-3 border-t border-slate-800 pt-3">
          <TombolBukaBerkas testId="buka-berkas-data" />
        </div>
      </Card>

      <Card className="mb-4">
        <div className="flex flex-wrap gap-2">
          <Button
            variant={alur === 'pindah' ? 'primary' : 'ghost'}
            data-testid="alur-pindah"
            onClick={() => setAlur('pindah')}
          >
            <IconShare size={16} /> Pindah data (JSON)
          </Button>
          <Button
            variant={alur === 'csv' ? 'primary' : 'ghost'}
            data-testid="alur-csv"
            onClick={() => setAlur('csv')}
          >
            <IconDownload size={16} /> Round-trip CSV
          </Button>
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
          {alur === 'pindah' ? (
            <>
              Pilih jenis datanya, lalu unduh. Berkasnya bisa dibuka di perangkat lain dan
              <b> tidak menghapus apa pun di sana</b> sebelum Anda menyetujui ringkasannya. Ini
              berbeda dengan <b>Backup</b> di Pengaturan, yang selalu memuat segalanya sekaligus.
            </>
          ) : (
            <>
              Ekspor ke CSV, sunting massal di Excel, lalu impor balik. Bagian ini yang membuka
              jalan bagi <b>jadwal</b> dan <b>absensi</b>, yang selama ini hanya bisa diekspor
              tanpa bisa diimpor kembali.
            </>
          )}
        </p>
      </Card>

      {alur === 'pindah' ? (
        <AlurPindah
          sumber={sumber}
          yangAda={yangAda}
          daftarSeksi={settings?.sections ?? DEFAULT_SECTIONS}
          seksiAwal={seksiDariUrl}
          namaPelatihBawaan={settings?.coachName ?? ''}
        />
      ) : (
        <AlurCsv sumber={sumber} />
      )}
    </div>
  )
}

/* ========================================================================== */
/*  Alur 1 — pindah data (JSON)                                               */
/* ========================================================================== */

function AlurPindah({
  sumber,
  yangAda,
  daftarSeksi,
  seksiAwal,
  namaPelatihBawaan,
}: {
  sumber: Record<JenisData, unknown[]>
  yangAda: YangAda
  daftarSeksi: SectionDef[]
  seksiAwal?: string
  namaPelatihBawaan?: string
}) {
  const toast = useToast()
  /** Jenis yang dicentang. Bawaan: kosong, supaya tidak ada yang ikut tanpa sengaja. */
  const [pilihJenis, setPilihJenis] = useState<Set<JenisData>>(new Set())
  /** Entitas yang dicentang, khusus jenis yang bisa dipilih satu-satu. */
  const [pilihEntitas, setPilihEntitas] = useState<Set<string>>(new Set())

  /** #15a — Kolaborasi Pelatih Seksi (1-Klik Kirim Setoran Seksi). */
  const pilihanSeksi = useMemo(() => {
    const peta = new Map<string, SectionDef>()
    for (const s of daftarSeksi) peta.set(s.id, s)
    for (const m of (sumber.anggota ?? []) as Member[]) {
      if (m.section && !peta.has(m.section)) {
        peta.set(m.section, {
          id: m.section,
          label: m.section,
          short: m.section.slice(0, 3).toUpperCase(),
          dot: '#94a3b8',
        })
      }
    }
    return [...peta.values()]
  }, [daftarSeksi, sumber.anggota])

  const [seksiKolab, setSeksiKolab] = useState<string>(() => seksiAwal || '')
  const [rentangKolab, setRentangKolab] = useState<RentangSetoranSeksi>('7-hari')
  const [namaAsisten, setNamaAsisten] = useState<string>('')

  useEffect(() => {
    if (seksiAwal && pilihanSeksi.some((s) => s.id === seksiAwal)) {
      setSeksiKolab(seksiAwal)
    } else if (!seksiKolab && pilihanSeksi.length > 0) {
      // Pilih seksi pertama yang memiliki anggota aktif, atau seksi pertama
      const adaAnggota = pilihanSeksi.find((s) =>
        ((sumber.anggota ?? []) as Member[]).some((m) => m.section === s.id),
      )
      setSeksiKolab((adaAnggota ?? pilihanSeksi[0]).id)
    }
  }, [seksiAwal, pilihanSeksi, seksiKolab, sumber.anggota])

  const seksiKolabEfektif =
    seksiKolab || (pilihanSeksi.length > 0 ? pilihanSeksi[0].id : '')

  const sumberKolab = useMemo(
    () => ({
      anggota: (sumber.anggota ?? []) as Member[],
      jadwal: (sumber.jadwal ?? []) as Session[],
      absensi: (sumber.absensi ?? []) as AttendanceRecord[],
      evaluasi: (sumber.evaluasi ?? []) as Evaluasi[],
      catatan: (sumber.catatan ?? []) as MemberNote[],
      targetSetoran: (sumber.targetSetoran ?? []) as TargetSetoran[],
      setoran: (sumber.setoran ?? []) as CatatanSetoran[],
      kemajuan: (sumber.kemajuan ?? []) as Kemajuan[],
    }),
    [sumber],
  )

  const pratinjauSeksi = useMemo(
    () =>
      hitungPratinjauSetoranSeksi(
        sumberKolab,
        seksiKolabEfektif,
        rentangKolab,
        capTanggal(),
      ),
    [sumberKolab, seksiKolabEfektif, rentangKolab],
  )

  function unduhSetoranSeksi() {
    if (!seksiKolabEfektif) {
      toast.push('Pilih seksinya terlebih dahulu', 'err')
      return
    }
    const defSeksi = pilihanSeksi.find((s) => s.id === seksiKolabEfektif)
    const labelSeksi = defSeksi?.label ?? seksiKolabEfektif
    const oleh = namaAsisten.trim() || namaPelatihBawaan?.trim() || undefined
    const berkas = susunBerkasSetoranSeksi(sumberKolab, {
      seksi: seksiKolabEfektif,
      labelSeksi,
      oleh,
      rentang: rentangKolab,
      tanggalAcuan: capTanggal(),
    })
    if (totalBerkas(berkas) === 0) {
      toast.push(`Belum ada data seksi ${labelSeksi} pada rentang tersebut`, 'err')
      return
    }
    downloadFile(namaSetoranSeksi(labelSeksi, oleh), JSON.stringify(berkas, null, 2))
    toast.push(`Setoran seksi ${labelSeksi} diunduh — kirim ke Pelatih Kepala`)
  }

  /** Berkas yang sedang menunggu konfirmasi. `null` = tidak ada. */
  const [menunggu, setMenunggu] = useState<BerkasPindah | null>(null)
  const [ringkasan, setRingkasan] = useState<RingkasanJenis[]>([])
  const [utamakanAbsensiAsisten, setUtamakanAbsensiAsisten] = useState(true)
  const [laporan, setLaporan] = useState<string[] | null>(null)
  const [saran, setSaran] = useState<SaranBaris[]>([])
  const [keputusan, setKeputusan] = useState<Record<string, KeputusanCocok>>({})

  const jumlah = (j: JenisData) => sumber[j]?.length ?? 0

  function jug(j: JenisData) {
    const berikut = new Set(pilihJenis)
    if (berikut.has(j)) berikut.delete(j)
    else berikut.add(j)
    setPilihJenis(berikut)
    // Centang semua entitasnya sekalian, supaya tidak ada yang ikut setengah.
    if (JENIS_PILIH.includes(j) && berikut.has(j)) {
      const s = new Set(pilihEntitas)
      for (const e of sumber[j] as { id: string }[]) s.add(e.id)
      setPilihEntitas(s)
    }
  }

  function jugEntitas(id: string) {
    const s = new Set(pilihEntitas)
    if (s.has(id)) s.delete(id)
    else s.add(id)
    setPilihEntitas(s)
  }

  const bisaEkspor = [...pilihJenis].some((j) =>
    JENIS_PILIH.includes(j) ? pilihEntitas.size > 0 : jumlah(j) > 0,
  )

  function ekspor() {
    const berkas: BerkasPindah = { format: 'drillkit-data', versi: 1, dibuat: Date.now() }
    for (const j of URUTAN_JENIS_DATA) {
      if (!pilihJenis.has(j)) continue
      let daftar = sumber[j] ?? []
      if (JENIS_PILIH.includes(j)) {
        daftar = daftar.filter((e) => pilihEntitas.has((e as { id: string }).id))
      }
      if (daftar.length) taruh(berkas, j, daftar)
    }
    if (totalBerkas(berkas) === 0) {
      toast.push('Tidak ada data yang dipilih', 'err')
      return
    }
    downloadFile(namaData(), JSON.stringify(berkas, null, 2))
    toast.push('Berkas data diunduh')
  }

  // #7 — titipan dari pintu "Buka berkas DrillKit": berkas data yang
  // diteruskan ke sini langsung diproses, tanpa dipilih ulang.
  useTitipan(['data'], (t) => void terimaTeks(t.nama, t.teks))

  async function terima(file: File) {
    // #7 — tombol lama menerima SEMUA jenis: kenali dari isinya, yang bukan
    // data dialihkan ke pratinjau yang benar (bukan ditolak mentah-mentah).
    const bita = new Uint8Array(await file.arrayBuffer())
    const kenal = kenaliBerkas(file.name, bita)
    if (kenal.jenis !== 'data') {
      mintaPratinjau(kenal, bita)
      return
    }
    await terimaTeks(file.name, kenal.teks ?? '')
  }

  async function terimaTeks(_nama: string, teks: string) {
    const hasil = bacaBerkasPindah(teks)
    if (!hasil.ok) {
      toast.push(hasil.alasan, 'err')
      return
    }
    // Baca langsung dari IndexedDB supaya saat Data baru dipasang lewat
    // navigasi Pintu #7 (`useTitipan`), `useLiveQuery` yang masih `[]` di
    // render pertama tidak salah menganggap seluruh anggota lokal kosong!
    const kunci = (daftar: { id?: string; key?: string }[]) =>
      daftar.map((e) => e?.id ?? e?.key ?? '').filter(Boolean)
    const [
      anggotaLokal,
      jadwalDb,
      absensiDb,
      laguDb,
      setlistDb,
      drillDb,
      setDb,
      kemajuanDb,
      catatanDb,
      evaluasiDb,
      targetSetoranDb,
      setoranDb,
    ] = await Promise.all([
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
      db.targetSetoran.toArray(),
      db.setoran.toArray(),
    ])
    const yangAdaSegar: YangAda = {
      anggota: kunci(anggotaLokal),
      jadwal: kunci(jadwalDb),
      absensi: kunci(absensiDb),
      lagu: kunci(laguDb),
      setlist: kunci(setlistDb),
      drill: kunci(drillDb),
      set: kunci(setDb),
      kemajuan: kunci(kemajuanDb),
      catatan: kunci(catatanDb),
      evaluasi: kunci(evaluasiDb),
      targetSetoran: kunci(targetSetoranDb),
      setoran: kunci(setoranDb),
    }
    const masuk = hasil.berkas.anggota ?? []
    const baris = susunSaran(masuk, anggotaLokal)
    setSaran(baris)
    setKeputusan(keputusanAwal(baris))
    setMenunggu(hasil.berkas)
    setUtamakanAbsensiAsisten(true)
    setRingkasan(hitungBentrok(hasil.berkas, yangAdaSegar))
    setLaporan(null)
  }

  const ringkasanGabungPerSeksi = useMemo(() => {
    if (!menunggu) return null
    return ringkasGabungSeksi(
      menunggu,
      {
        anggota: (sumber.anggota ?? []) as Member[],
        jadwal: (sumber.jadwal ?? []) as Session[],
        absensi: (sumber.absensi ?? []) as AttendanceRecord[],
      },
      pilihanSeksi,
    )
  }, [menunggu, sumber.anggota, sumber.jadwal, sumber.absensi, pilihanSeksi])

  async function terapkan() {
    if (!menunggu) return
    const apakahAsisten = !!menunggu.asistenSeksi
    const anggotaLokal = (sumber.anggota ?? []) as Member[]
    const hasilCocok = terapkanCocok({
      masuk: menunggu.anggota ?? [],
      lokal: anggotaLokal,
      keputusan,
      arah: 'lokal',
      // #15a — berkas asisten seksi membawa anggota tanpa token/phone/notes:
      // jangan menimpa profil anggota lokal yang id-nya sudah sama!
      timpaSamaId: !apakahAsisten,
    })
    const { data: dipetakan, bentrok } = tulisUlangMuatan(menunggu, hasilCocok.peta)
    if (menunggu.anggota) dipetakan.anggota = hasilCocok.anggotaTulis
    if (dipetakan.absensi) {
      if (apakahAsisten) {
        const gabungAbs = gabungAbsensiAsisten(
          dipetakan.absensi,
          (sumber.absensi ?? []) as AttendanceRecord[],
          utamakanAbsensiAsisten,
        )
        dipetakan.absensi = gabungAbs.tulis
        bentrok.push(...gabungAbs.laporan)
      } else {
        const saring = saringBentrokLokal(dipetakan.absensi, (sumber.absensi ?? []) as AttendanceRecord[])
        dipetakan.absensi = saring.tulis
        bentrok.push(...saring.bentrok)
      }
    }
    const { berkas, putus } = putusRujukan(dipetakan, yangAda)
    const b = berkas
    if (apakahAsisten && b.kemajuan?.length) {
      const gabungKem = gabungKemajuanAman(b.kemajuan, (sumber.kemajuan ?? []) as Kemajuan[])
      b.kemajuan = gabungKem.tulis
    }
    if (apakahAsisten && b.setoran?.length) {
      const gabungSet = gabungSetoranAman(b.setoran, (sumber.setoran ?? []) as CatatanSetoran[])
      b.setoran = gabungSet.tulis
      bentrok.push(...gabungSet.laporan)
    }
    try {
      // Setiap tabel yang ditulis di bawah WAJIB tercantum di cakupan ini.
      // Dexie menolak tabel di luar cakupan (NotFound) dan seluruh berkas
      // batal. `evaluasi` dulu tertinggal (2a).
      await db.transaction(
        'rw',
        [
          db.members,
          db.sessions,
          db.attendance,
          db.drills,
          db.sets,
          db.songs,
          db.setlists,
          db.kemajuan,
          db.memberNotes,
          db.evaluasi,
          db.targetSetoran,
          db.setoran,
        ],
        async () => {
          if (b.anggota?.length) await db.members.bulkPut(b.anggota)
          if (b.jadwal?.length) await db.sessions.bulkPut(b.jadwal)
          if (b.absensi?.length) await db.attendance.bulkPut(b.absensi)
          if (b.lagu?.length) await db.songs.bulkPut(b.lagu)
          if (b.setlist?.length) await db.setlists.bulkPut(b.setlist)
          if (b.drill?.length) await db.drills.bulkPut(b.drill)
          if (b.set?.length) await db.sets.bulkPut(b.set)
          if (b.kemajuan?.length) await db.kemajuan.bulkPut(b.kemajuan)
          if (b.catatan?.length) await db.memberNotes.bulkPut(b.catatan)
          if (b.evaluasi?.length) await db.evaluasi.bulkPut(b.evaluasi)
          if (b.targetSetoran?.length) await db.targetSetoran.bulkPut(b.targetSetoran)
          if (b.setoran?.length) await db.setoran.bulkPut(b.setoran)
        },
      )
      setMenunggu(null)
      setLaporan([...ringkasPutus(putus), ...bentrok, ...hasilCocok.laporan])
      toast.push(putus.length ? `Data masuk, ${putus.length} rujukan dikosongkan` : 'Data masuk')
    } catch {
      toast.push('Gagal menerapkan data', 'err')
    }
  }

  return (
    <>
      {/* -------------------------------------- #15a: Kolaborasi Pelatih Seksi */}
      <Card className="mb-4 border-emerald-900/50 bg-emerald-950/10" data-testid="kartu-kolaborasi-seksi">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-emerald-200">
              Kolaborasi Pelatih Seksi — 1-Klik Kirim Setoran Seksi
            </h2>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
              Khusus asisten pelatih (<i>Brass, Battery, Pit, Color Guard</i>): ekspor otomatis
              absensi, evaluasi, setoran hafalan, catatan, dan centang kemajuan <b>hanya untuk seksi
              Anda</b>. Saat dibuka Pelatih Kepala lewat <b>Buka berkas</b>, seksi lain dijamin
              tidak tersentuh.
            </p>
          </div>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Field label="Seksi Anda">
            <Select
              data-testid="pilih-seksi-kolaborasi"
              value={seksiKolabEfektif}
              onChange={(e) => setSeksiKolab(e.target.value)}
            >
              {pilihanSeksi.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Rentang waktu">
            <Select
              data-testid="pilih-rentang-seksi"
              value={rentangKolab}
              onChange={(e) => setRentangKolab(e.target.value as RentangSetoranSeksi)}
            >
              <option value="hari-ini">{LABEL_RENTANG_SEKSI['hari-ini']}</option>
              <option value="7-hari">{LABEL_RENTANG_SEKSI['7-hari']}</option>
              <option value="semua">{LABEL_RENTANG_SEKSI.semua}</option>
            </Select>
          </Field>

          <Field label="Nama asisten (opsional)">
            <Input
              data-testid="input-nama-asisten"
              placeholder="Mis. Kak Raka (Brass)"
              value={namaAsisten}
              onChange={(e) => setNamaAsisten(e.target.value)}
            />
          </Field>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2">
          <p className="text-xs text-slate-300" data-testid="pratinjau-kirim-seksi">
            Siap dikirim: <b>{pratinjauSeksi.anggota}</b> anggota ·{' '}
            <b>{pratinjauSeksi.absensi}</b> absensi ·{' '}
            <b>{pratinjauSeksi.evaluasi}</b> evaluasi ·{' '}
            <b>{pratinjauSeksi.setoran}</b> setoran hafalan ·{' '}
            <b>{pratinjauSeksi.catatan}</b> catatan ·{' '}
            <b>{pratinjauSeksi.kemajuanCentang}</b> centang kemajuan
          </p>
          <Button
            variant="primary"
            size="sm"
            data-testid="kirim-setoran-seksi"
            disabled={pratinjauSeksi.anggota === 0 && pratinjauSeksi.totalAksi === 0}
            onClick={unduhSetoranSeksi}
          >
            <IconDownload size={14} /> Unduh Setoran Seksi
          </Button>
        </div>
      </Card>

      {/* ---------------------------------------------------------- ekspor */}
      <Card className="mb-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-200">Ekspor — pilih datanya</h2>
        <div className="space-y-1.5" data-testid="pilih-jenis">
          {URUTAN_JENIS_DATA.map((j) => {
            const n = jumlah(j)
            const bisa = JENIS_PILIH.includes(j)
            return (
              <div key={j} data-testid={`jenis-${j}`}>
                <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 hover:bg-slate-800/50">
                  <input
                    type="checkbox"
                    data-testid={`centang-jenis-${j}`}
                    checked={pilihJenis.has(j)}
                    onChange={() => jug(j)}
                    disabled={n === 0}
                    className="h-4 w-4 accent-emerald-500"
                  />
                  <span className={`flex-1 text-sm ${n === 0 ? 'text-slate-600' : 'text-slate-200'}`}>
                    {LABEL_JENIS_DATA[j]}
                  </span>
                  <span className="text-xs tabular-nums text-slate-500">{n}</span>
                </label>

                {bisa && pilihJenis.has(j) && n > 0 && (
                  <div className="ml-6 mt-1 max-h-44 space-y-0.5 overflow-y-auto border-l border-slate-800 pl-3">
                    {(sumber[j] as { id: string; name?: string; title?: string }[]).map((e) => (
                      <label
                        key={e.id}
                        className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-xs hover:bg-slate-800/50"
                      >
                        <input
                          type="checkbox"
                          data-testid={`centang-entitas-${e.id}`}
                          checked={pilihEntitas.has(e.id)}
                          onChange={() => jugEntitas(e.id)}
                          className="h-3.5 w-3.5 accent-emerald-500"
                        />
                        <span className="truncate text-slate-300">{e.name ?? e.title ?? e.id}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button variant="primary" data-testid="ekspor-data" onClick={ekspor} disabled={!bisaEkspor}>
            <IconDownload size={16} /> Unduh data
          </Button>
          {!bisaEkspor && (
            <span className="text-[11px] text-slate-600">Centang dulu jenis datanya.</span>
          )}
        </div>
      </Card>

      {/* ---------------------------------------------------------- impor */}
      <Card>
        <h2 className="mb-3 text-sm font-semibold text-slate-200">Impor — dari berkas data</h2>
        <p className="mb-3 text-[11px] text-slate-500">
          Berkasnya tidak langsung diterapkan. Anda akan melihat dulu berapa yang baru dan berapa
          yang akan ditimpa.
        </p>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800">
          <IconUpload size={16} /> Pilih berkas .json
          <input
            type="file"
            accept=".json,.csv,.zip,application/json,text/csv,application/zip"
            data-testid="berkas-masuk"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void terima(f)
              e.target.value = ''
            }}
          />
        </label>

        {laporan && (
          <div
            data-testid="laporan-impor"
            className={`mt-3 rounded-lg border p-3 text-xs ${
              laporan.length
                ? 'border-amber-600/40 bg-amber-950/20 text-amber-100/90'
                : 'border-emerald-600/40 bg-emerald-950/20 text-emerald-100/90'
            }`}
          >
            <p className="mb-1 font-semibold">
              {laporan.length ? 'Masuk, tetapi ada rujukan yang dikosongkan' : 'Masuk — semua rujukan utuh'}
            </p>
            {laporan.length ? (
              <ul className="space-y-0.5">
                {laporan.map((l, i) => (
                  <li key={i}>• {l}</li>
                ))}
              </ul>
            ) : (
              <p>Tidak ada rujukan yang terputus.</p>
            )}
          </div>
        )}
      </Card>

      {/* ------------------------------------------- konfirmasi sebelum tulis */}
      <Modal
        open={menunggu != null}
        onClose={() => setMenunggu(null)}
        title="Terapkan data ini?"
        wide={perluDitanya(saran, (sumber.anggota ?? []).length)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setMenunggu(null)}>
              Batal
            </Button>
            <Button variant="primary" data-testid="terapkan-data" onClick={terapkan}>
              Terapkan
            </Button>
          </>
        }
      >
        {menunggu && (
          <div data-testid="konfirmasi-impor">
            {menunggu.asistenSeksi && ringkasanGabungPerSeksi && (
              <div
                data-testid="ringkasan-gabung-seksi"
                className="mb-3 rounded-lg border border-emerald-700/50 bg-emerald-950/25 p-3 text-xs leading-relaxed"
              >
                <p className="font-semibold text-emerald-200">
                  Gabung Setoran Asisten Seksi: {menunggu.asistenSeksi.labelSeksi}
                  {menunggu.asistenSeksi.oleh ? ` · oleh ${menunggu.asistenSeksi.oleh}` : ''}
                </p>
                <p className="mt-0.5 text-[11px] text-emerald-200/80">
                  Rentang: {LABEL_RENTANG_SEKSI[menunggu.asistenSeksi.rentang]}
                  {menunggu.asistenSeksi.tanggalAcuan ? ` (${menunggu.asistenSeksi.tanggalAcuan})` : ''}
                </p>

                {ringkasanGabungPerSeksi.perSeksi.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {ringkasanGabungPerSeksi.perSeksi.map((b) => (
                      <li
                        key={b.seksi}
                        data-testid={`ringkas-seksi-${b.seksi}`}
                        className="rounded bg-slate-900/70 px-2.5 py-1.5 text-[11px] text-slate-200"
                      >
                        <b>{b.label}:</b>{' '}
                        {[
                          b.absensiBaru > 0 ? `${b.absensiBaru} absensi baru` : '',
                          b.absensiBentrok > 0 ? `${b.absensiBentrok} absensi bentrok` : '',
                          b.evaluasi > 0 ? `${b.evaluasi} evaluasi` : '',
                          b.setoran > 0 ? `${b.setoran} setoran hafalan` : '',
                          b.catatan > 0 ? `${b.catatan} catatan` : '',
                          b.kemajuanCentang > 0 ? `${b.kemajuanCentang} centang kemajuan` : '',
                        ]
                          .filter(Boolean)
                          .join(' · ') || 'Hanya daftar anggota seksi'}
                      </li>
                    ))}
                  </ul>
                )}

                {ringkasanGabungPerSeksi.seksiTakTersentuh.length > 0 && (
                  <p
                    data-testid="seksi-aman-tak-tersentuh"
                    className="mt-2 text-[11px] text-emerald-300"
                  >
                    ✓ Seksi lain aman tidak tersentuh:{' '}
                    <b>{ringkasanGabungPerSeksi.seksiTakTersentuh.map((s) => s.label).join(', ')}</b>
                  </p>
                )}

                {ringkasanGabungPerSeksi.bentrokAbsensi.length > 0 && (
                  <div
                    data-testid="daftar-bentrok-absensi"
                    className="mt-2.5 rounded border border-amber-600/40 bg-amber-950/30 p-2 text-[11px] text-amber-100"
                  >
                    <p className="font-semibold text-amber-200">
                      Ditemukan {ringkasanGabungPerSeksi.bentrokAbsensi.length} status absensi berbeda:
                    </p>
                    <ul className="mt-1 space-y-0.5">
                      {ringkasanGabungPerSeksi.bentrokAbsensi.slice(0, 5).map((bt) => (
                        <li key={`${bt.sessionId}|${bt.memberId}`}>
                          • {bt.namaAnggota} ({bt.judulSesi}): lokal <b>{bt.statusLokal}</b> vs asisten{' '}
                          <b>{bt.statusMasuk}</b>
                        </li>
                      ))}
                    </ul>
                    <label className="mt-2 flex cursor-pointer items-center gap-2 text-amber-100">
                      <input
                        type="checkbox"
                        data-testid="utamakan-absensi-asisten"
                        checked={utamakanAbsensiAsisten}
                        onChange={(e) => setUtamakanAbsensiAsisten(e.target.checked)}
                        className="h-3.5 w-3.5 accent-emerald-500"
                      />
                      <span>Utamakan status absensi dari asisten pelatih untuk baris di atas</span>
                    </label>
                  </div>
                )}
              </div>
            )}

            <p className="mb-3 text-sm text-slate-300">
              Berkas berisi <b>{totalBerkas(menunggu)}</b> entitas.{' '}
              {menunggu.asistenSeksi ? (
                <>
                  Profil anggota lokal, token QR, dan centang seksi lain <b>dipertahankan utuh</b>;
                  setoran hafalan digabung ke jenjang tertinggi.
                </>
              ) : (
                <>
                  Yang sudah ada di perangkat ini akan <b>ditimpa</b> — suntingan lokalnya tidak
                  bisa dikembalikan.
                </>
              )}
            </p>
            <ul className="space-y-1">
              {ringkasan.map((r) => (
                <li
                  key={r.jenis}
                  data-testid={`ringkas-${r.jenis}`}
                  className="flex items-center gap-2 rounded bg-slate-800/50 px-2 py-1.5 text-sm"
                >
                  <span className="flex-1 text-slate-200">{LABEL_JENIS_DATA[r.jenis]}</span>
                  <span className="text-xs tabular-nums text-emerald-400" data-testid={`baru-${r.jenis}`}>
                    {r.baru} baru
                  </span>
                  {r.ditimpa > 0 && (
                    <span className="text-xs tabular-nums text-rose-300" data-testid={`timpa-${r.jenis}`}>
                      {r.ditimpa} ditimpa
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] text-slate-500">
              Rujukan yang tidak ketemu (mis. jadwal menunjuk set list yang tidak ikut) akan
              dikosongkan, bukan ditolak — dan dilaporkan setelahnya.
            </p>
            {perluDitanya(saran, (sumber.anggota ?? []).length) && (
              <div className="mt-3">
                <PanelCocok
                  saran={saran}
                  lokal={(sumber.anggota ?? []) as Member[]}
                  keputusan={keputusan}
                  onUbah={(id, kep) => setKeputusan((s) => ({ ...s, [id]: kep }))}
                />
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  )
}

/* ========================================================================== */
/*  Alur 2 — round-trip CSV                                                   */
/* ========================================================================== */

/**
 * CSV hanya masuk akal untuk **jadwal** dan **absensi** — dua fitur yang
 * selama ini bisa diekspor tanpa bisa diimpor kembali. Jenis lain yang
 * bentuknya bersarang (drill, set formasi) tetap memakai JSON.
 */
function AlurCsv({ sumber }: { sumber: Record<JenisData, unknown[]> }) {
  const toast = useToast()
  const [jenis, setJenis] = useState<'jadwal' | 'absensi'>('jadwal')
  const [menunggu, setMenunggu] = useState<{ judul: string; baris: string[][] } | null>(null)

  // #7 — titipan dari pintu baru: jenis tab-nya mengikuti berkasnya.
  useTitipan(['csv-jadwal', 'csv-absensi'], (t) => {
    const untuk = t.jenis === 'csv-absensi' ? 'absensi' : 'jadwal'
    setJenis(untuk)
    terimaTeksCsv(untuk, t.nama, t.teks)
  })

  const kolom: Record<'jadwal' | 'absensi', string[]> = {
    jadwal: ['id', 'judul', 'jenis', 'tanggal', 'mulai', 'selesai', 'tempat', 'setListId'],
    absensi: ['id', 'sessionId', 'memberId', 'status', 'catatan'],
  }

  const baris: Record<'jadwal' | 'absensi', string[][]> = useMemo(
    () => ({
      jadwal: (sumber.jadwal as Record<string, unknown>[]).map((s) => [
        String(s.id ?? ''),
        String(s.title ?? ''),
        String(s.type ?? ''),
        String(s.date ?? ''),
        String(s.startTime ?? ''),
        String(s.endTime ?? ''),
        String(s.place ?? ''),
        String(s.setListId ?? ''),
      ]),
      absensi: (sumber.absensi as Record<string, unknown>[]).map((a) => [
        String(a.id ?? ''),
        String(a.sessionId ?? ''),
        String(a.memberId ?? ''),
        String(a.status ?? ''),
        String(a.note ?? ''),
      ]),
    }),
    [sumber],
  )

  function eksporCsv() {
    const k = kolom[jenis]
    const isi = [k, ...baris[jenis]]
    const csv = isi
      .map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(','))
      .join('\n')
    downloadFile(`drillkit-${jenis}.csv`, csv, 'text/csv')
    toast.push(`CSV ${jenis} diunduh`)
  }

  async function terimaCsv(file: File) {
    const teks = await file.text()
    // #7 — kenali dulu: berkas yang bukan CSV tujuan dialihkan ke pratinjau.
    const kenal = kenaliTeks(file.name, teks)
    const untuk = jenis === 'absensi' ? 'csv-absensi' : 'csv-jadwal'
    if (kenal.jenis !== untuk) {
      mintaPratinjau(kenal)
      return
    }
    terimaTeksCsv(jenis, file.name, teks)
  }

  function terimaTeksCsv(untuk: 'jadwal' | 'absensi', namaFile: string, teks: string) {
    const diproses = untuk
    const barisCsv = parseCsv(teks)
    if (barisCsv.length < 2) {
      toast.push('Berkasnya kosong atau tidak terbaca', 'err')
      return
    }
    const judul = barisCsv[0].map((h) => h.trim().toLowerCase())
    const wajib = kolom[diproses]
    // Bandingkan tanpa mempedulikan huruf besar-kecil. Nama kolom baku
    // memakai camelCase (`setListId`), sedangkan Excel dan banyak alat lain
    // menuliskannya `setlistid` — membedakan keduanya akan menolak berkas
    // yang sebenarnya sah.
    const kurang = wajib.filter((k) => !judul.includes(k.toLowerCase()))
    if (kurang.length) {
      toast.push(`Kolom kurang: ${kurang.join(', ')}`, 'err')
      return
    }
    // Susun ulang mengikuti urutan kolom baku, supaya urutan di Excel bebas.
    const badan = barisCsv.slice(1).map((r) => wajib.map((k) => r[judul.indexOf(k.toLowerCase())] ?? ''))
    setMenunggu({ judul: namaFile, baris: badan })
  }

  /**
   * Terapkan isi CSV dengan cara **menggabungkan**, bukan menggantikan.
   *
   * Berkas CSV hanya memuat sebagian kolom. Kalau rekamannya ditulis ulang
   * seluruhnya, kolom yang **tidak** ada di CSV ikut terhapus — padahal
   * pemakai tidak pernah memintanya dihapus.
   *
   * Alur yang memicunya sangat lazim: ekspor jadwal → sunting satu judul di
   * Excel → impor balik. Tanpa penggabungan, seluruh **materi latihan**
   * (`checklist`) dan **rencana latihan** (`rencanaLatihan`) sesi itu lenyap
   * bersama catatan evaluasinya — dan pemakai hanya melihat judulnya
   * berubah, persis seperti yang diinginkannya. Kehilangan datanya tidak
   * berbunyi apa pun.
   *
   * Karena itu: kolom yang ada di CSV ditimpa, kolom yang tidak disebut
   * **dipertahankan** dari rekaman lama. Baris tanpa id tetap dibuat baru.
   */
  async function terapkanCsv() {
    if (!menunggu) return
    try {
      if (jenis === 'jadwal') {
        const daftar = []
        for (const r of menunggu.baris) {
          const id = r[0] || uid('s_')
          const lama = await db.sessions.get(id)
          daftar.push({
            // Ambil dulu apa yang sudah ada, baru timpa yang disebut CSV.
            ...(lama ?? {}),
            id,
            title: r[1] || lama?.title || '',
            type: (r[2] || lama?.type || 'latihan') as never,
            date: r[3] || lama?.date || '',
            startTime: r[4] || lama?.startTime || '',
            endTime: r[5] || lama?.endTime || '',
            place: r[6] || lama?.place || undefined,
            setListId: r[7] || lama?.setListId || undefined,
            // Kolom yang tidak ada di CSV dipertahankan apa adanya.
            checklist: lama?.checklist ?? [],
            createdAt: lama?.createdAt ?? Date.now(),
          })
        }
        await db.sessions.bulkPut(daftar)
      } else {
        const daftar = []
        for (const r of menunggu.baris) {
          const id = r[0] || uid('a_')
          const lama = await db.attendance.get(id)
          daftar.push({
            ...(lama ?? {}),
            id,
            sessionId: r[1] || lama?.sessionId || '',
            memberId: r[2] || lama?.memberId || '',
            status: (r[3] || lama?.status || 'hadir') as never,
            note: r[4] || lama?.note || undefined,
            // Waktu benar-benar hadir tidak ada di CSV — jangan sampai hilang
            // hanya karena statusnya disunting.
            checkInAt: lama?.checkInAt,
          })
        }
        await db.attendance.bulkPut(daftar)
      }
      setMenunggu(null)
      toast.push(`${jenis === 'jadwal' ? 'Jadwal' : 'Absensi'} diimpor`)
    } catch {
      toast.push('Gagal mengimpor', 'err')
    }
  }

  return (
    <>
      <Card>
        <h2 className="mb-3 text-sm font-semibold text-slate-200">Round-trip CSV</h2>
        <p className="mb-3 text-[11px] leading-relaxed text-slate-500">
          Ekspor, sunting massal di Excel, lalu impor balik. <b>Id dipertahankan apa adanya</b> —
          baris dengan id yang sudah ada akan ditimpa, baris tanpa id akan dibuat baru. Kosongkan
          id untuk menambah baris baru.
        </p>

        <div className="mb-3 flex gap-2" data-testid="pilih-jenis-csv">
          {(['jadwal', 'absensi'] as const).map((j) => (
            <Button key={j} variant={jenis === j ? 'primary' : 'ghost'} data-testid={`csv-${j}`} onClick={() => setJenis(j)}>
              {j === 'jadwal' ? 'Jadwal' : 'Absensi'} ({baris[j].length})
            </Button>
          ))}
        </div>

        <p className="mb-3 text-[11px] text-slate-600">
          Kolom: <code className="text-slate-400">{kolom[jenis].join(', ')}</code>
        </p>

        {baris[jenis].length === 0 && (
          <EmptyState icon={<IconDownload size={28} />} title={`Belum ada ${jenis} untuk diekspor.`} />
        )}

        <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900/40 p-3">
          <p className="mb-1 text-[11px] font-semibold text-slate-400">
            Yang sengaja tidak ada di sini
          </p>
          <ul className="space-y-0.5 text-[11px] leading-relaxed text-slate-500">
            <li>
              • <b>Rekap absensi</b> &amp; laporan — itu <b>data turunan</b> (ringkasan yang
              dihitung dari absensi), jadi tidak ada yang bisa diimpor balik. Yang bisa diimpor
              adalah <b>absensi</b>-nya sendiri.
            </li>
            <li>
              • <b>Drill, set formasi, lagu</b> — bentuknya bersarang (tempo map, titik pemain,
              pengaturan jarak). Menyimpannya ke CSV akan membuang sebagian isinya tanpa kabar,
              jadi mereka memakai <b>alur JSON</b> di atas, yang tidak mengurangi apa pun.
            </li>
            <li>
              • <b>Anggota</b> — sudah dua arah di halaman <b>Anggota</b>, lengkap dengan contoh
              berkasnya.
            </li>
          </ul>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button data-testid="ekspor-csv" onClick={eksporCsv} disabled={baris[jenis].length === 0}>
            <IconDownload size={16} /> Ekspor CSV
          </Button>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800">
            <IconUpload size={16} /> Impor CSV
            <input
              type="file"
              accept=".json,.csv,.zip,application/json,text/csv,application/zip"
              data-testid="csv-masuk"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void terimaCsv(f)
                e.target.value = ''
              }}
            />
          </label>
        </div>
      </Card>

      <Modal
        open={menunggu != null}
        onClose={() => setMenunggu(null)}
        title="Terapkan CSV ini?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setMenunggu(null)}>
              Batal
            </Button>
            <Button variant="primary" data-testid="terapkan-csv" onClick={terapkanCsv}>
              Terapkan
            </Button>
          </>
        }
      >
        {menunggu && (
          <div data-testid="konfirmasi-csv">
            <p className="text-sm text-slate-300">
              <b>{menunggu.baris.length}</b> baris dari <span className="text-slate-400">{menunggu.judul}</span>{' '}
              akan diterapkan ke <b>{jenis === 'jadwal' ? 'Jadwal' : 'Absensi'}</b>. Baris dengan id
              yang sudah ada akan ditimpa.
            </p>
            <p className="mt-2 text-[11px] text-slate-500">
              Rujukan yang tidak ketemu (mis. <code>setListId</code> yang tidak ada) akan dikosongkan.
            </p>
          </div>
        )}
      </Modal>
    </>
  )
}

/* -------------------------------------------------------------------------- */

/** Pecah teks CSV menjadi baris & kolom, menghargai tanda kutip. */
function parseCsv(teks: string): string[][] {
  const out: string[][] = []
  let baris: string[] = []
  let cur = ''
  let kutip = false
  for (let i = 0; i < teks.length; i += 1) {
    const c = teks[i]
    if (kutip) {
      if (c === '"') {
        if (teks[i + 1] === '"') {
          cur += '"'
          i += 1
        } else kutip = false
      } else cur += c
      continue
    }
    if (c === '"') kutip = true
    else if (c === ',') {
      baris.push(cur)
      cur = ''
    } else if (c === '\n') {
      baris.push(cur)
      out.push(baris)
      baris = []
      cur = ''
    } else if (c !== '\r') cur += c
  }
  if (cur.length || baris.length) {
    baris.push(cur)
    out.push(baris)
  }
  return out.filter((r) => r.some((c) => c.trim() !== ''))
}
