import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type {
  LampiranPartiturPaket,
  Member,
  Session,
  ShareBundle,
} from '../db/types'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  StatTile,
  Toggle,
  useToast,
} from '../components/ui'
import { IconDownload, IconLoop, IconShare, IconUpload } from '../components/Icons'
import { PanelTukarRepertoar } from '../components/TukarRepertoar'
import { TombolPanduanAnggota } from '../components/Panduan'
import { namaBerkasAnggota, paketAnggota, paketGrup } from '../lib/bagikan'
import { kenaliBerkas, namaPaketGrup, namaZipAnggota } from '../lib/bukaBerkas'
import { mintaPratinjau } from '../components/BukaBerkas'
import { pasangPartiturDariPaket, pulihkanAudioDariZipPaket, simpanPaketAnggota } from '../lib/paketMasuk'
import { simpanLoncatLatih } from '../lib/partiturFrasa'
import { buatLampiranPartiturPaket } from '../lib/partiturPaket'
import {
  LABEL_KATEGORI_PERUBAHAN,
  apakahButirMenyangkutAnggota,
  bandingkanKeadaanShow,
  cicipKeadaanShow,
  ekstrakKeadaanShow,
  pilihAcuanPerubahan,
} from '../lib/logPerubahan'
import { MemberSchedule } from '../components/share/TabAnggotaJadwal'
import {
  MemberAttendance,
  MemberDrill,
  MemberKuis,
  MemberNotes,
} from '../components/share/TabAnggotaKonten'
import { uid } from '../lib/utils'
import { gabungPembaruan, materiLebihBaru, muatBerkasTerbit, bukaDataPribadi, tanggalIndonesia, type DataTerkunci } from '../lib/terbit'
import { kunciDariUrl, simpanKunciAnggota, bacaKunciAnggota } from '../lib/kunci'
import { TerbitkanAnggota } from '../components/TerbitkanAnggota'
import { cocokCari, namaDenganPanggilan } from '../lib/namaAnggota'
import { NamaTampil } from '../components/NamaTampil'
import Music from './Music'
import { useMemberMode } from '../hooks/useMemberMode'
import { TombolKeluarModeAnggota, TombolMasukModeAnggota } from '../components/ModePerangkat'
import { bikinZip, type EntriZip } from '../lib/zip'
import {
  sectionDot,
  sectionLabel,
  cx,
  downloadBlob,
  downloadFile,
} from '../lib/utils'

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
  const targetSetoran = useLiveQuery(() => db.targetSetoran.toArray(), [], [])
  const catatanSetoran = useLiveQuery(() => db.setoran.toArray(), [], [])
  const countSheets = useLiveQuery(() => db.countSheets.toArray(), [], [])
  const riwayatLogPerubahan = useLiveQuery(() => db.logPerubahan.toArray(), [], [])
  const settings = useLiveQuery(() => db.settings.get('team'), [], undefined)
  const partiturItems = useLiveQuery(() => db.partiturBerkas.toArray(), [], [])
  const rekamanItems = useLiveQuery(() => db.rekamanAudio.toArray(), [], [])

  const [includeSchedule, setIncludeSchedule] = useState(true)
  const [includeDrills, setIncludeDrills] = useState(true)
  const [includeSongs, setIncludeSongs] = useState(true)
  /** #13a — sertakan berkas partitur (disaring per suara otomatis pada berkas per anggota). */
  const [includePartitur, setIncludePartitur] = useState(true)
  /** #13a — opsional sertakan rekaman audio panduan lagu ke dalam ZIP per anggota. */
  const [includeAudioZip, setIncludeAudioZip] = useState(false)
  const [includeAttendance, setIncludeAttendance] = useState(true)
  /** Catatan evaluasi — dulu SELALU ikut berkas tanpa saklar apa pun. */
  const [includeNotes, setIncludeNotes] = useState(true)
  /** #14 — target & capaian setoran hafalan pribadi per anggota. */
  const [includeSetoran, setIncludeSetoran] = useState(true)
  /** #17 — lembar hitungan kerja alat Color Guard (Count Sheet). */
  const [includeCountSheets, setIncludeCountSheets] = useState(true)
  /** #15b — sertakan log perubahan show otomatis di paket anggota. */
  const [includeLogPerubahan, setIncludeLogPerubahan] = useState(true)
  const [catatanPerubahan, setCatatanPerubahan] = useState('')
  const [preview, setPreview] = useState<ShareBundle | null>(null)
  const [petaPartiturSiap, setPetaPartiturSiap] = useState<Record<string, LampiranPartiturPaket>>({})

  useEffect(() => {
    let batal = false
    const daftar = partiturItems ?? []
    if (daftar.length === 0) {
      setPetaPartiturSiap({})
      return
    }
    void (async () => {
      const peta: Record<string, LampiranPartiturPaket> = {}
      for (const item of daftar) {
        try {
          const bita = new Uint8Array(await item.blob.arrayBuffer())
          const lamp = buatLampiranPartiturPaket(
            item.songId,
            item.namaFile,
            item.tipe,
            bita,
            item.hash,
          )
          if (lamp) peta[item.songId] = lamp
        } catch {
          // abaikan berkas rusak
        }
      }
      if (!batal) setPetaPartiturSiap(peta)
    })()
    return () => {
      batal = true
    }
  }, [partiturItems])

  const keadaanSekarang = useMemo(
    () =>
      ekstrakKeadaanShow({
        defaultField: settings?.defaultField,
        members: members ?? [],
        drills: includeDrills ? (drills ?? []) : [],
        sets: includeDrills ? (sets ?? []) : [],
        songs: includeSongs ? (songs ?? []) : [],
        sessions: includeSchedule ? (sessions ?? []) : [],
        targetSetoran: includeSetoran ? (targetSetoran ?? []) : [],
        countSheets: includeCountSheets ? (countSheets ?? []) : [],
      }),
    [
      settings?.defaultField,
      members,
      drills,
      sets,
      songs,
      sessions,
      targetSetoran,
      countSheets,
      includeDrills,
      includeSongs,
      includeSchedule,
      includeSetoran,
      includeCountSheets,
    ],
  )

  const pilihanAcuan = useMemo(
    () => pilihAcuanPerubahan(keadaanSekarang, riwayatLogPerubahan ?? []),
    [keadaanSekarang, riwayatLogPerubahan],
  )

  const ringkasanPerubahanAktif = useMemo(() => {
    if (pilihanAcuan.acuan) {
      return bandingkanKeadaanShow(pilihanAcuan.acuan, keadaanSekarang, {
        labelAcuan: pilihanAcuan.labelAcuan,
        catatanPelatih: catatanPerubahan,
      })
    }
    if (catatanPerubahan.trim()) {
      const skrg = Date.now()
      return {
        dibuatAt: skrg,
        dibandingkanDariAt: skrg,
        catatanPelatih: catatanPerubahan.trim(),
        butir: [],
      }
    }
    return null
  }, [pilihanAcuan, keadaanSekarang, catatanPerubahan])

  async function catatAcuanTerbitan(resetMurni = false) {
    const sekarang = Date.now()
    const cicipSkrg = cicipKeadaanShow(keadaanSekarang)
    if (resetMurni) {
      await db.logPerubahan.put({
        id: uid('log_'),
        dibuatAt: sekarang,
        label: `Acuan ${new Date(sekarang).toLocaleDateString('id-ID')}`,
        cicipSebelum: undefined,
        cicipSesudah: cicipSkrg,
        ringkasan: { dibuatAt: sekarang, dibandingkanDariAt: sekarang, butir: [] },
        keadaanSesudah: { ...keadaanSekarang, dibuatAt: sekarang },
      })
      toast.push('Keadaan show saat ini ditandai sebagai titik acuan revisi')
      return
    }
    // Bila keadaan show belum berubah dari entri terakhir (mis. klik Unduh grup lalu Unduh ZIP),
    // jangan menumpuk entri duplikat supaya diff revisi tetap terjaga.
    if (pilihanAcuan.pakaiUlangEntri) return
    const cicipSblm = pilihanAcuan.acuan ? cicipKeadaanShow(pilihanAcuan.acuan) : undefined
    await db.logPerubahan.put({
      id: uid('log_'),
      dibuatAt: sekarang,
      label: `Terbitan ${new Date(sekarang).toLocaleDateString('id-ID')}`,
      cicipSebelum: cicipSblm,
      cicipSesudah: cicipSkrg,
      ringkasan: ringkasanPerubahanAktif ?? {
        dibuatAt: sekarang,
        dibandingkanDariAt: pilihanAcuan.acuan?.dibuatAt ?? sekarang,
        butir: [],
      },
      keadaanSesudah: { ...keadaanSekarang, dibuatAt: sekarang },
    })
  }

  function build(): ShareBundle {
    const idLaguIkut = new Set((includeSongs ? (songs ?? []) : []).map((s) => s.id))
    const partiturTerpilih: Record<string, LampiranPartiturPaket> = {}
    if (includeSongs && includePartitur) {
      for (const [songId, lamp] of Object.entries(petaPartiturSiap)) {
        if (idLaguIkut.has(songId)) partiturTerpilih[songId] = lamp
      }
    }
    const sertakanLog =
      includeLogPerubahan &&
      ringkasanPerubahanAktif != null &&
      (ringkasanPerubahanAktif.butir.length > 0 || !!ringkasanPerubahanAktif.catatanPelatih)
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
            sections: settings.sections,
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
      partiturPaket: Object.keys(partiturTerpilih).length > 0 ? partiturTerpilih : undefined,
      targetSetoran: includeSetoran ? (targetSetoran ?? []) : [],
      setoran: includeSetoran ? (catatanSetoran ?? []) : [],
      countSheets: includeCountSheets ? (countSheets ?? []) : [],
      perubahanPaket: sertakanLog ? ringkasanPerubahanAktif : undefined,
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
    void catatAcuanTerbitan(false)
    toast.push('Berkas grup diunduh — tanpa data pribadi, aman dibagikan ke mana saja')
  }

  /**
   * Berkas **per anggota** — satu ZIP berisi satu berkas per anggota.
   *
   * Tiap berkas hanya memuat absensi & catatan anggota itu sendiri, serta
   * partitur MusicXML yang sudah dipangkas ke part instrumen/seksinya (#13a).
   */
  async function unduhPerAnggota() {
    const dasar = build()
    if (dasar.members.length === 0) {
      toast.push('Belum ada anggota untuk dibagikan', 'err')
      return
    }
    const entri: EntriZip[] = dasar.members.map((m) => ({
      nama: namaBerkasAnggota(m),
      isi: JSON.stringify(paketAnggota(dasar, m.id)),
    }))
    if (includeSongs && includeAudioZip && (rekamanItems?.length ?? 0) > 0) {
      const idLaguIkut = new Set(dasar.songs.map((s) => s.id))
      const manifestAudio: Record<
        string,
        { songId: string; namaFile: string; durasi: number; hash: string }
      > = {}
      for (const item of rekamanItems ?? []) {
        if (!idLaguIkut.has(item.songId)) continue
        const ab = await item.blob.arrayBuffer()
        const safeName = item.namaFile.replace(/[^\w.-]/g, '_')
        const pathZip = `audio/${item.songId}_${safeName}`
        entri.push({ nama: pathZip, isi: new Uint8Array(ab) })
        manifestAudio[pathZip] = {
          songId: item.songId,
          namaFile: item.namaFile,
          durasi: item.durasi,
          hash: item.hash,
        }
      }
      if (Object.keys(manifestAudio).length > 0) {
        entri.push({
          nama: 'audio/manifest.json',
          isi: JSON.stringify(manifestAudio, null, 2),
        })
      }
    }
    downloadBlob(namaZipAnggota(namaTim()), bikinZip(entri))
    await catatAcuanTerbitan(false)
    toast.push(
      `${dasar.members.length} berkas anggota dibungkus — tiap berkas hanya memuat data & partitur suaranya sendiri`,
    )
  }

  const jmlPartiturSiap = Object.keys(petaPartiturSiap).length

  const size = useMemo(() => {
    // Dihitung dari berkas GRUP, karena itulah yang benar-benar diunduh
    // sebagai satu berkas — bukan dari paket lengkap yang tak pernah dibagikan.
    const n = JSON.stringify(paketGrup(build())).length
    return n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`
  }, [
    members,
    sessions,
    drills,
    sets,
    songs,
    includeSchedule,
    includeDrills,
    includeSongs,
    includePartitur,
    includeSetoran,
    includeCountSheets,
    targetSetoran,
    countSheets,
    petaPartiturSiap,
  ])

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
        <TerbitkanAnggota susun={build} onTerbitBerhasil={() => catatAcuanTerbitan(false)} />
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
            {includeSongs && (
              <Toggle
                testId="toggle-partitur-paket"
                checked={includePartitur}
                onChange={setIncludePartitur}
                label={`Partitur lagu siap baca — disaring per instrumen di berkas per anggota (${jmlPartiturSiap})`}
              />
            )}
            <Toggle
              testId="toggle-count-sheet"
              checked={includeCountSheets}
              onChange={setIncludeCountSheets}
              label={`Lembar hitungan Color Guard / Count Sheet (${countSheets?.length ?? 0})`}
            />
          </div>

          {/* #15b (I1) — Log Perubahan Show Otomatis */}
          <div
            data-testid="kartu-log-perubahan-pelatih"
            className="mt-3 rounded-lg border border-sky-900/50 bg-sky-950/20 p-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Toggle
                testId="toggle-log-perubahan"
                checked={includeLogPerubahan}
                onChange={setIncludeLogPerubahan}
                label={`Log perubahan show otomatis (${ringkasanPerubahanAktif?.butir.length ?? 0} perubahan terdeteksi)`}
              />
              <Button
                size="sm"
                variant="ghost"
                data-testid="simpan-acuan-perubahan"
                onClick={() => void catatAcuanTerbitan(true)}
              >
                Tandai acuan sekarang
              </Button>
            </div>

            {!pilihanAcuan.acuan ? (
              <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
                Belum ada titik acuan revisi di perangkat ini. Tekan <b>Tandai acuan sekarang</b>{' '}
                (atau unduh paket pertama) — setelah Anda mengubah posisi set, birama, atau tempo,
                daftar perubahannya muncul otomatis di sini dan ikut dikirim ke HP anggota.
              </p>
            ) : ringkasanPerubahanAktif && ringkasanPerubahanAktif.butir.length > 0 ? (
              <ul
                data-testid="daftar-butir-perubahan-pelatih"
                className="mt-2 space-y-1 rounded bg-slate-950/60 p-2 text-[11px] text-slate-200"
              >
                {ringkasanPerubahanAktif.butir.slice(0, 6).map((b, idx) => (
                  <li key={idx} className="flex flex-wrap items-baseline gap-1.5">
                    <span className="rounded bg-sky-900/60 px-1.5 py-0.5 text-[10px] font-semibold text-sky-200">
                      {LABEL_KATEGORI_PERUBAHAN[b.kategori]}
                    </span>
                    <b className="text-slate-100">{b.subjek}:</b>
                    <span>{b.teks}</span>
                  </li>
                ))}
                {ringkasanPerubahanAktif.butir.length > 6 && (
                  <li className="text-slate-400">
                    +{ringkasanPerubahanAktif.butir.length - 6} perubahan lainnya
                  </li>
                )}
              </ul>
            ) : (
              <p className="mt-2 text-[11px] text-slate-400">
                Belum ada perubahan formasi/lagu dibanding acuan terakhir (
                {new Date(pilihanAcuan.acuan.dibuatAt).toLocaleDateString('id-ID')}).
              </p>
            )}

            <div className="mt-2">
              <Input
                data-testid="input-catatan-perubahan"
                placeholder="Pesan revisi opsional untuk anggota (mis. Fokus latihan Sabtu: perhatikan Set 3)…"
                value={catatanPerubahan}
                onChange={(e) => setCatatanPerubahan(e.target.value)}
                className="text-xs"
              />
            </div>
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
              <Toggle
                testId="toggle-setoran"
                checked={includeSetoran}
                onChange={setIncludeSetoran}
                label={`Setoran hafalan (${catatanSetoran?.length ?? 0} catatan, ${targetSetoran?.length ?? 0} target)`}
              />
              {includeSongs && (rekamanItems?.length ?? 0) > 0 && (
                <Toggle
                  testId="toggle-rekaman-zip"
                  checked={includeAudioZip}
                  onChange={setIncludeAudioZip}
                  label={`Rekaman panduan lagu di ZIP (${rekamanItems?.length ?? 0} audio)`}
                />
              )}
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
  /** #15b — exportedAt paket yang kartu perubahannya disembunyikan sementara oleh anggota. */
  const [tutupPerubahanAt, setTutupPerubahanAt] = useState<number | null>(null)
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
      // #13a — pasang berkas partitur dari paket terbit ke `db.partiturBerkas`
      // lebih dulu, lalu simpan salinan paket ringan ke `db.packages`.
      await pasangPartiturDariPaket(digabung)
      const digabungRingan: ShareBundle = digabung.partiturPaket
        ? { ...digabung, partiturPaket: undefined }
        : digabung
      await db.packages.put({
        key: 'current',
        importedAt: Date.now(),
        data: digabungRingan,
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
      if ((kenal.audioZip ?? 0) > 0) {
        await pulihkanAudioDariZipPaket(bita)
      }
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

      {/* #15b (I1) — Kartu "Apa yang berubah di paket ini" */}
      {bundle.perubahanPaket &&
        (bundle.perubahanPaket.butir.length > 0 || !!bundle.perubahanPaket.catatanPelatih) &&
        (tutupPerubahanAt === bundle.exportedAt ? (
          <div className="mb-4 flex justify-end">
            <Button
              size="sm"
              variant="ghost"
              data-testid="buka-perubahan-paket"
              onClick={() => setTutupPerubahanAt(null)}
            >
              Lihat apa yang berubah ({bundle.perubahanPaket.butir.length})
            </Button>
          </div>
        ) : (
          <Card
            data-testid="kartu-perubahan-paket"
            className="mb-4 border-sky-800/60 bg-sky-950/20"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-sky-200">
                  Apa yang berubah di paket ini
                </h3>
                <p className="text-[11px] text-slate-400">
                  Dibandingkan paket/acuan sebelumnya (
                  {new Date(bundle.perubahanPaket.dibandingkanDariAt).toLocaleDateString('id-ID')})
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                data-testid="tutup-perubahan-paket"
                onClick={() => setTutupPerubahanAt(bundle.exportedAt)}
              >
                Sembunyikan
              </Button>
            </div>

            {bundle.perubahanPaket.catatanPelatih && (
              <p
                data-testid="catatan-pelatih-perubahan"
                className="mt-2 rounded bg-sky-900/30 px-2.5 py-1.5 text-xs text-sky-100"
              >
                💬 <b>Pesan pelatih:</b> {bundle.perubahanPaket.catatanPelatih}
              </p>
            )}

            {bundle.perubahanPaket.butir.length > 0 && (
              <ul className="mt-2.5 space-y-1.5 text-xs">
                {bundle.perubahanPaket.butir.map((b, idx) => {
                  const kenaSaya = apakahButirMenyangkutAnggota(b, me)
                  return (
                    <li
                      key={idx}
                      data-testid={`butir-perubahan-paket-${idx}`}
                      className={cx(
                        'flex flex-wrap items-baseline gap-1.5 rounded px-2.5 py-1.5',
                        kenaSaya
                          ? 'border border-amber-500/40 bg-amber-950/30 text-amber-100'
                          : 'bg-slate-900/60 text-slate-200',
                      )}
                    >
                      <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold text-sky-300">
                        {LABEL_KATEGORI_PERUBAHAN[b.kategori]}
                      </span>
                      <b className="text-slate-100">{b.subjek}:</b>
                      <span className="flex-1">{b.teks}</span>
                      {kenaSaya && (
                        <span
                          data-testid="lencana-menyangkut-saya"
                          className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300"
                        >
                          Menyangkut titikmu!
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
        ))}

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
        <Music
          hanyaPutar
          anggotaAktif={me}
          sectionsPaket={bundle.team?.sections}
          namaTimPaket={bundle.team?.teamName}
          drillsPaket={bundle.drills}
          setsPaket={bundle.sets}
          countSheetsPaket={bundle.countSheets}
        />
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
        <MemberNotes
          bundle={dataTerkunci ?? bundle}
          bundleGrup={bundle}
          me={me}
          locked={!!dataTerkunci}
          onLatihDiMusik={(t) => {
            if (!t.songId) return
            simpanLoncatLatih({
              songId: t.songId,
              dari: t.biramaDari,
              sampai: t.biramaSampai,
              label: t.judul,
            })
            setTab('musik')
          }}
        />
      )}
    </div>
  )
}


/* --------------------------------- Mode ------------------------------------- */
export { bacaMode, simpanMode } from '../lib/modePerangkat'
export { useMemberMode } from '../hooks/useMemberMode'
