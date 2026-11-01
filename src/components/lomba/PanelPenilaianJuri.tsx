import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import type {
  ButirSubCaption,
  KelompokCaption,
  PenaltiLomba,
  PenandaJudgeTape,
  PenilaianLomba,
  Session,
  SkemaCaptionId,
} from '../../db/types'
import {
  LABEL_KELOMPOK_CAPTION,
  LABEL_SKEMA_CAPTION,
  WARNA_HEX_KELOMPOK,
  buatSubCaptionDariSkema,
  detikMulaiUntukSet,
  formatWaktuDetik,
  hitungRekapPenilaian,
  hitungTrenSkorSimulasi,
  petakanDetikKeSetDanBirama,
  urutkanCatatanJudgeTape,
} from '../../lib/penilaianJuri'
import { bangunHtmlRekapPenilaian } from '../../lib/penilaianJuriCetak'
import { downloadHtmlFile, printHtml } from '../../lib/print'
import { cx, slugify, uid } from '../../lib/utils'
import { IconDownload, IconPlay, IconPlus, IconPrinter, IconTrash } from '../Icons'
import { Button, Card, ConfirmButton, EmptyState, Field, Input, Modal, Select, useToast } from '../ui'

const DAFTAR_SKEMA: SkemaCaptionId[] = [
  'field_show',
  'street_parade',
  'indoor_winds',
  'indoor_perc',
  'indoor_guard',
  'kustom',
]

function fmt2(n: number): string {
  return n.toFixed(2).replace('.', ',')
}

async function hitungHashPendek(bita: Uint8Array): Promise<string> {
  let h = 2166136261
  const langkah = Math.max(1, Math.floor(bita.length / 4096))
  for (let i = 0; i < bita.length; i += langkah) {
    h ^= bita[i]
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

export function PanelPenilaianJuri({
  tanggalAktif,
  sesiAktif,
  namaTim,
}: {
  tanggalAktif: string
  sesiAktif?: Session
  namaTim: string
}) {
  const toast = useToast()
  const semuaPenilaian = useLiveQuery(() => db.penilaianLomba.toArray(), [], [])
  const drills = useLiveQuery(() => db.drills.toArray(), [], [])
  const semuaSet = useLiveQuery(() => db.sets.toArray(), [], [])
  const songs = useLiveQuery(() => db.songs.toArray(), [], [])

  const daftarUrut = useMemo(
    () =>
      [...(semuaPenilaian ?? [])].sort((a, b) => {
        if (b.tanggal !== a.tanggal) return b.tanggal.localeCompare(a.tanggal)
        return (b.updatedAt || 0) - (a.updatedAt || 0)
      }),
    [semuaPenilaian],
  )

  const [aktifId, setAktifId] = useState<string>('')
  const penilaianDb = useMemo(() => {
    if (!daftarUrut.length) return null
    return daftarUrut.find((p) => p.id === aktifId) ?? daftarUrut[0]
  }, [daftarUrut, aktifId])

  useEffect(() => {
    if (penilaianDb && penilaianDb.id !== aktifId) {
      setAktifId(penilaianDb.id)
    }
  }, [penilaianDb, aktifId])

  // Draf sinkron (useRef + useState) agar ketikan cepat nilai caption bebas race useLiveQuery
  const [draf, setDraf] = useState<PenilaianLomba | null>(null)
  const drafRef = useRef<PenilaianLomba | null>(null)
  const sedangMenulisRef = useRef(0)

  useEffect(() => {
    if (sedangMenulisRef.current > 0 && drafRef.current?.id === penilaianDb?.id) return
    drafRef.current = penilaianDb
    setDraf(penilaianDb)
  }, [penilaianDb])

  // Audio Judge Tape dari store biner terpisah
  const rekamanDb = useLiveQuery(
    () => (draf?.id ? db.judgeTapeAudio.get(draf.id) : undefined),
    [draf?.id],
    undefined,
  )
  const [urlAudio, setUrlAudio] = useState<string | null>(null)
  const audioElRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    if (!rekamanDb?.blob) {
      setUrlAudio(null)
      return
    }
    const u = URL.createObjectURL(rekamanDb.blob)
    setUrlAudio(u)
    return () => URL.revokeObjectURL(u)
  }, [rekamanDb])

  // Stopwatch run-through & perekam MediaRecorder
  const [detikSekarang, setDetikSekarang] = useState(0)
  const [stopwatchJalan, setStopwatchJalan] = useState(false)
  const [sedangMerekamSuara, setSedangMerekamSuara] = useState(false)
  const mediaRecRef = useRef<MediaRecorder | null>(null)
  const potonganSuaraRef = useRef<BlobPart[]>([])
  const mulaiRekamMsRef = useRef<number>(0)

  useEffect(() => {
    if (!stopwatchJalan) return
    const t0 = performance.now() - detikSekarang * 1000
    const id = window.setInterval(() => {
      const s = Math.round(((performance.now() - t0) / 1000) * 10) / 10
      setDetikSekarang(s)
    }, 200)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopwatchJalan])

  // State form penalti, Judge Tape, sub-caption baru, dan modal pratinjau cetak
  const [skemaBaru, setSkemaBaru] = useState<SkemaCaptionId>('field_show')
  const [alasanPenalti, setAlasanPenalti] = useState('')
  const [poinPenalti, setPoinPenalti] = useState('0.5')

  const [detikManual, setDetikManual] = useState('')
  const [fokusCatatan, setFokusCatatan] = useState<KelompokCaption | 'umum'>('ge')
  const [tingkatCatatan, setTingkatCatatan] = useState<'biasa' | 'penting' | 'pujian'>('biasa')
  const [teksCatatan, setTeksCatatan] = useState('')
  const [filterSetId, setFilterSetId] = useState<string>('semua')

  const [labelSubBaru, setLabelSubBaru] = useState('')
  const [klpSubBaru, setKlpSubBaru] = useState<KelompokCaption>('ge')
  const [maksSubBaru, setMaksSubBaru] = useState('10')

  const [pratinjauOpen, setPratinjauOpen] = useState(false)

  async function simpanPenilaian(berikut: PenilaianLomba) {
    const rapi: PenilaianLomba = {
      ...berikut,
      updatedAt: Math.max(Date.now(), (drafRef.current?.updatedAt ?? 0) + 1),
    }
    drafRef.current = rapi
    setDraf(rapi)
    sedangMenulisRef.current += 1
    try {
      await db.penilaianLomba.put(rapi)
    } finally {
      sedangMenulisRef.current = Math.max(0, sedangMenulisRef.current - 1)
    }
  }

  const drillTertaut = useMemo(
    () => (drills ?? []).find((x) => x.id === draf?.drillId) ?? null,
    [drills, draf?.drillId],
  )
  const setsDrillTertaut = useMemo(
    () =>
      draf?.drillId
        ? (semuaSet ?? []).filter((s) => s.drillId === draf.drillId).sort((a, b) => a.order - b.order)
        : [],
    [semuaSet, draf?.drillId],
  )
  const laguTertaut = useMemo(
    () => (songs ?? []).find((x) => x.id === (draf?.songId || drillTertaut?.songId)) ?? null,
    [songs, draf?.songId, drillTertaut?.songId],
  )

  const detikEfektif = detikManual.trim() !== '' ? Math.max(0, Number(detikManual) || 0) : detikSekarang

  const posisiLangsung = useMemo(
    () =>
      petakanDetikKeSetDanBirama(detikEfektif, {
        sets: setsDrillTertaut,
        drill: drillTertaut,
        song: laguTertaut,
      }),
    [detikEfektif, setsDrillTertaut, drillTertaut, laguTertaut],
  )

  const rekap = useMemo(
    () => (draf ? hitungRekapPenilaian(draf) : null),
    [draf],
  )

  const tren = useMemo(
    () => hitungTrenSkorSimulasi(semuaPenilaian ?? []),
    [semuaPenilaian],
  )

  async function buatSimulasiBaru(skemaPilihan: SkemaCaptionId = skemaBaru) {
    const skrg = Date.now()
    const drillAwal = (drills ?? [])[0]
    const nomorUrut = (semuaPenilaian?.length ?? 0) + 1
    const baru: PenilaianLomba = {
      id: uid('juri_'),
      judul: sesiAktif?.title
        ? `Simulasi #${nomorUrut} — ${sesiAktif.title}`
        : `Simulasi Run-Through #${nomorUrut}`,
      tanggal: tanggalAktif,
      skema: skemaPilihan,
      sessionId: sesiAktif?.id,
      drillId: drillAwal?.id,
      songId: drillAwal?.songId || (songs ?? [])[0]?.id,
      captions: buatSubCaptionDariSkema(skemaPilihan),
      penalti: [],
      catatanWaktu: [],
      createdAt: skrg,
      updatedAt: skrg,
    }
    drafRef.current = baru
    setDraf(baru)
    setAktifId(baru.id)
    await db.penilaianLomba.put(baru)
    toast.push('Lembar simulasi penilaian juri siap diisi')
  }

  async function muatDuaSimulasiContoh() {
    const skrg = Date.now()
    const drillAwal = (drills ?? [])[0]
    const laguAwal = (songs ?? []).find((s) => s.id === drillAwal?.songId) ?? (songs ?? [])[0]
    const setsAwal = drillAwal
      ? (semuaSet ?? []).filter((s) => s.drillId === drillAwal.id).sort((a, b) => a.order - b.order)
      : []

    const tglH14 = (() => {
      const p = /^(\d{4})-(\d{2})-(\d{2})$/.exec(tanggalAktif)
      const d = p ? new Date(Number(p[1]), Number(p[2]) - 1, Number(p[3])) : new Date()
      d.setDate(d.getDate() - 14)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    })()

    const cap1 = buatSubCaptionDariSkema('field_show').map((c) => ({
      ...c,
      nilaiKomposisi: Math.round(c.maksKomposisi * 0.72 * 10) / 10,
      nilaiEksekusi: Math.round(c.maksEksekusi * 0.68 * 10) / 10,
    }))
    const cap2 = buatSubCaptionDariSkema('field_show').map((c) => ({
      ...c,
      nilaiKomposisi: Math.round(c.maksKomposisi * 0.85 * 10) / 10,
      nilaiEksekusi: Math.round(c.maksEksekusi * 0.83 * 10) / 10,
    }))

    const petaDetik12 = petakanDetikKeSetDanBirama(12, {
      sets: setsAwal,
      drill: drillAwal,
      song: laguAwal,
    })
    const petaDetik28 = petakanDetikKeSetDanBirama(28, {
      sets: setsAwal,
      drill: drillAwal,
      song: laguAwal,
    })

    const sim1: PenilaianLomba = {
      id: uid('juri_'),
      judul: 'Simulasi Evaluasi #1 (H-14)',
      tanggal: tglH14,
      skema: 'field_show',
      drillId: drillAwal?.id,
      songId: laguAwal?.id,
      juriUtama: 'Tim Pelatih Tamu',
      captions: cap1,
      penalti: [{ id: uid('pen_'), alasan: 'Overtime penutup 4 detik', poin: 0.5 }],
      catatanWaktu: [
        {
          id: uid('jt_'),
          detik: 12,
          fokus: 'visual',
          teks: 'Jarak antar saf sayap kanan melebar 1 langkah saat transisi pembuka.',
          setId: petaDetik12.setId,
          labelSet: petaDetik12.labelSet,
          hitunganSet: petaDetik12.hitunganSet,
          birama: petaDetik12.birama,
          tingkat: 'penting',
        },
      ],
      catatanUmum: 'Kerangka repertoar kuat; fokuskan kebersihan artikulasi tiup dan transisi awal.',
      createdAt: skrg - 2000,
      updatedAt: skrg - 2000,
    }

    const sim2: PenilaianLomba = {
      id: uid('juri_'),
      judul: 'Simulasi Gladi Bersih #2 (H-1)',
      tanggal: tanggalAktif,
      skema: 'field_show',
      sessionId: sesiAktif?.id,
      drillId: drillAwal?.id,
      songId: laguAwal?.id,
      juriUtama: 'Panel Juri Simulasi Kejuaraan',
      captions: cap2,
      penalti: [],
      catatanWaktu: [
        {
          id: uid('jt_'),
          detik: 12,
          fokus: 'visual',
          teks: 'Saf pembuka jauh lebih rapi dan terkunci tepat di hitungan akhir!',
          setId: petaDetik12.setId,
          labelSet: petaDetik12.labelSet,
          hitunganSet: petaDetik12.hitunganSet,
          birama: petaDetik12.birama,
          tingkat: 'pujian',
        },
        {
          id: uid('jt_'),
          detik: 28,
          fokus: 'musik',
          teks: 'Jaga keseimbangan dinamika low brass saat masuk klimaks reff.',
          setId: petaDetik28.setId,
          labelSet: petaDetik28.labelSet,
          hitunganSet: petaDetik28.hitunganSet,
          birama: petaDetik28.birama,
          tingkat: 'penting',
        },
      ],
      catatanUmum: 'Peningkatan signifikan menuju Box 4; pertahankan stamina hingga koda penutup.',
      createdAt: skrg - 1000,
      updatedAt: skrg - 1000,
    }

    await db.penilaianLomba.bulkPut([sim1, sim2])
    drafRef.current = sim2
    setDraf(sim2)
    setAktifId(sim2.id)
    toast.push('2 simulasi contoh (H-14 & H-1) berhasil dimuat')
  }

  function perbaruiSubCaption(subId: string, ubah: Partial<ButirSubCaption>) {
    const sumber = drafRef.current
    if (!sumber) return
    const captions = sumber.captions.map((c) => (c.id === subId ? { ...c, ...ubah } : c))
    void simpanPenilaian({ ...sumber, captions })
  }

  function gantiSkema(skema: SkemaCaptionId) {
    const sumber = drafRef.current
    if (!sumber) return
    void simpanPenilaian({
      ...sumber,
      skema,
      captions: buatSubCaptionDariSkema(skema),
    })
    toast.push(`Template diganti ke ${LABEL_SKEMA_CAPTION[skema]}`)
  }

  function tambahSubCaptionKustom() {
    const sumber = drafRef.current
    if (!sumber) return
    const label = labelSubBaru.trim()
    if (!label) {
      toast.push('Isi nama sub-caption terlebih dahulu', 'err')
      return
    }
    const maks = Math.max(1, Number(maksSubBaru) || 10)
    const baru: ButirSubCaption = {
      id: uid('sub_'),
      kelompok: klpSubBaru,
      label,
      maksKomposisi: maks,
      nilaiKomposisi: Math.round(maks * 0.75 * 10) / 10,
      maksEksekusi: maks,
      nilaiEksekusi: Math.round(maks * 0.75 * 10) / 10,
      pengaliBobot: 1,
    }
    void simpanPenilaian({ ...sumber, captions: [...sumber.captions, baru] })
    setLabelSubBaru('')
  }

  function hapusSubCaption(subId: string) {
    const sumber = drafRef.current
    if (!sumber || sumber.captions.length <= 1) return
    void simpanPenilaian({
      ...sumber,
      captions: sumber.captions.filter((c) => c.id !== subId),
    })
  }

  function tambahPenalti(alasanOtomatis?: string, poinOtomatis?: number) {
    const sumber = drafRef.current
    if (!sumber) return
    const alasan = (alasanOtomatis ?? alasanPenalti).trim()
    const poin = poinOtomatis ?? Math.max(0.05, Number(poinPenalti) || 0)
    if (!alasan) {
      toast.push('Tulis alasan pengurangan penalti', 'err')
      return
    }
    const item: PenaltiLomba = { id: uid('pen_'), alasan, poin: Math.round(poin * 100) / 100 }
    void simpanPenilaian({ ...sumber, penalti: [...sumber.penalti, item] })
    if (!alasanOtomatis) setAlasanPenalti('')
  }

  function hapusPenalti(penId: string) {
    const sumber = drafRef.current
    if (!sumber) return
    void simpanPenilaian({
      ...sumber,
      penalti: sumber.penalti.filter((p) => p.id !== penId),
    })
  }

  function tambahCatatanJudgeTape() {
    const sumber = drafRef.current
    if (!sumber) return
    const teks = teksCatatan.trim()
    if (!teks) {
      toast.push('Tulis isi komentar juri terlebih dahulu', 'err')
      return
    }
    const peta = petakanDetikKeSetDanBirama(detikEfektif, {
      sets: setsDrillTertaut,
      drill: drillTertaut,
      song: laguTertaut,
    })
    const baru: PenandaJudgeTape = {
      id: uid('jt_'),
      detik: peta.detik,
      fokus: fokusCatatan,
      teks,
      setId: peta.setId,
      labelSet: peta.labelSet,
      hitunganSet: peta.hitunganSet,
      birama: peta.birama,
      tingkat: tingkatCatatan,
    }
    void simpanPenilaian({
      ...sumber,
      catatanWaktu: urutkanCatatanJudgeTape([...sumber.catatanWaktu, baru]),
    })
    setTeksCatatan('')
    setDetikManual('')
  }

  function hapusCatatanJudgeTape(catId: string) {
    const sumber = drafRef.current
    if (!sumber) return
    void simpanPenilaian({
      ...sumber,
      catatanWaktu: sumber.catatanWaktu.filter((c) => c.id !== catId),
    })
  }

  function putarPadaDetik(detik: number) {
    setDetikSekarang(detik)
    const el = audioElRef.current
    if (el) {
      try {
        el.currentTime = Math.max(0, detik)
        void el.play().catch(() => {
          // Abaikan blokir autoplay peramban headless bila ada
        })
      } catch {
        // Abaikan bila metadata audio belum termuat penuh
      }
    }
  }

  async function unggahBerkasJudgeTape(file: File) {
    const sumber = drafRef.current
    if (!sumber) return
    const ab = await file.arrayBuffer()
    const bita = new Uint8Array(ab)
    const hash = await hitungHashPendek(bita)
    const tipe = file.type || (file.name.endsWith('.webm') ? 'audio/webm' : 'audio/mpeg')
    const blob = new Blob([bita], { type: tipe })

    const durasiDetik = await new Promise<number>((resolve) => {
      const u = URL.createObjectURL(blob)
      const a = new Audio()
      const selesai = (d: number) => {
        URL.revokeObjectURL(u)
        resolve(Number.isFinite(d) && d > 0 ? Math.round(d * 10) / 10 : 0)
      }
      a.onloadedmetadata = () => selesai(a.duration)
      a.onerror = () => selesai(0)
      setTimeout(() => selesai(0), 1200)
      a.src = u
    })

    await db.judgeTapeAudio.put({
      id: sumber.id,
      penilaianId: sumber.id,
      blob,
      namaFile: file.name,
      tipe,
      ukuran: bita.byteLength,
      durasiDetik,
      hash,
      updatedAt: Date.now(),
    })

    await simpanPenilaian({
      ...sumber,
      rekamanJudgeTape: {
        namaFile: file.name,
        tipe,
        ukuran: bita.byteLength,
        durasiDetik,
        hash,
      },
    })
    toast.push(`Rekaman Judge Tape "${file.name}" tersimpan`)
  }

  async function mulaiRekamMikrofon() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      toast.push('Peramban ini tidak mendukung perekaman mikrofon langsung — gunakan Unggah Audio', 'err')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rec = new MediaRecorder(stream)
      potonganSuaraRef.current = []
      mulaiRekamMsRef.current = Date.now()
      rec.ondataavailable = (ev) => {
        if (ev.data.size > 0) potonganSuaraRef.current.push(ev.data)
      }
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        const tipe = rec.mimeType || 'audio/webm'
        const blob = new Blob(potonganSuaraRef.current, { type: tipe })
        const bita = new Uint8Array(await blob.arrayBuffer())
        const hash = await hitungHashPendek(bita)
        const durasiDetik = Math.max(1, Math.round((Date.now() - mulaiRekamMsRef.current) / 100) / 10)
        const sumber = drafRef.current
        if (!sumber) return
        const namaFile = `judgetape-${sumber.tanggal}.webm`
        await db.judgeTapeAudio.put({
          id: sumber.id,
          penilaianId: sumber.id,
          blob,
          namaFile,
          tipe,
          ukuran: bita.byteLength,
          durasiDetik,
          hash,
          updatedAt: Date.now(),
        })
        await simpanPenilaian({
          ...sumber,
          rekamanJudgeTape: {
            namaFile,
            tipe,
            ukuran: bita.byteLength,
            durasiDetik,
            hash,
          },
        })
        toast.push('Rekaman suara Judge Tape berhasil disimpan')
      }
      mediaRecRef.current = rec
      rec.start()
      setDetikSekarang(0)
      setStopwatchJalan(true)
      setSedangMerekamSuara(true)
    } catch {
      toast.push('Izin mikrofon ditolak atau perangkat tidak tersedia', 'err')
    }
  }

  function hentikanRekamMikrofon() {
    if (mediaRecRef.current && mediaRecRef.current.state !== 'inactive') {
      mediaRecRef.current.stop()
    }
    setSedangMerekamSuara(false)
    setStopwatchJalan(false)
  }

  async function hapusRekamanJudgeTape() {
    const sumber = drafRef.current
    if (!sumber) return
    await db.judgeTapeAudio.delete(sumber.id)
    await simpanPenilaian({ ...sumber, rekamanJudgeTape: undefined })
    toast.push('Rekaman audio Judge Tape dihapus', 'info')
  }

  function susunHtmlCetak(): string {
    if (!draf) return ''
    return bangunHtmlRekapPenilaian({
      namaTim,
      penilaian: draf,
      namaDrill: drillTertaut?.name,
      namaLagu: laguTertaut?.title,
      namaSesi: sesiAktif?.title,
    })
  }

  function cetakLembar() {
    const html = susunHtmlCetak()
    if (!html) return
    if (!printHtml(html)) {
      downloadHtmlFile(`caption-recap-${slugify(draf?.judul || 'simulasi')}.html`, html)
      toast.push('Pop-up diblokir — berkas HTML A4 diunduh')
    }
  }

  function unduhLembar() {
    const html = susunHtmlCetak()
    if (!html) return
    downloadHtmlFile(`caption-recap-${slugify(draf?.judul || 'simulasi')}.html`, html)
    toast.push('Lembar Caption Recap A4 diunduh')
  }

  const catatanTersaring = useMemo(() => {
    const urut = urutkanCatatanJudgeTape(draf?.catatanWaktu ?? [])
    if (filterSetId === 'semua') return urut
    return urut.filter((c) => c.setId === filterSetId)
  }, [draf?.catatanWaktu, filterSetId])

  if (!draf || !rekap) {
    return (
      <div data-testid="panel-penilaian-juri-kosong">
        <EmptyState
          icon={<IconPrinter size={30} />}
          title="Belum ada simulasi penilaian juri"
          desc="Gunakan lembar Caption Recap standar kejuaraan (Field Show GPMB/IDCA/DCI, Street Parade, Indoor Winds/Percussion/Guard) beserta Judge Tape tertaut Set & Birama."
          action={
            <div className="flex flex-col items-center gap-2.5">
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Select
                  aria-label="Pilih skema mata lomba"
                  data-testid="pilih-skema-awal-juri"
                  value={skemaBaru}
                  onChange={(e) => setSkemaBaru(e.target.value as SkemaCaptionId)}
                >
                  {DAFTAR_SKEMA.map((sk) => (
                    <option key={sk} value={sk}>
                      {LABEL_SKEMA_CAPTION[sk]}
                    </option>
                  ))}
                </Select>
                <Button
                  variant="primary"
                  data-testid="buat-simulasi-juri"
                  onClick={() => void buatSimulasiBaru(skemaBaru)}
                >
                  <IconPlus size={15} /> Buat Simulasi Penilaian
                </Button>
              </div>
              <Button
                variant="soft"
                data-testid="muat-contoh-simulasi"
                onClick={() => void muatDuaSimulasiContoh()}
              >
                Muat 2 Simulasi Contoh (Tren H-14 → H-1)
              </Button>
            </div>
          }
        />
      </div>
    )
  }

  const warnaLencanaBox =
    rekap.predikatBox === 'Box 5'
      ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300'
      : rekap.predikatBox === 'Box 4'
        ? 'border-sky-500/50 bg-sky-500/15 text-sky-300'
        : rekap.predikatBox === 'Box 3'
          ? 'border-amber-500/50 bg-amber-500/15 text-amber-300'
          : 'border-rose-500/50 bg-rose-500/15 text-rose-300'

  return (
    <div className="space-y-4" data-testid="panel-penilaian-juri">
      {/* Bar pemilih simulasi & tombol cetak */}
      <Card className="p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5" data-testid="daftar-simulasi-juri">
            {daftarUrut.map((item) => {
              const rItem = hitungRekapPenilaian(item)
              const aktif = item.id === draf.id
              return (
                <button
                  key={item.id}
                  type="button"
                  data-testid={`pilih-simulasi-${item.id}`}
                  onClick={() => setAktifId(item.id)}
                  className={cx(
                    'rounded-lg border px-2.5 py-1.5 text-left text-xs transition',
                    aktif
                      ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-200'
                      : 'border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700',
                  )}
                >
                  <div className="font-semibold">{item.judul}</div>
                  <div className="text-[11px] text-slate-400">
                    {item.tanggal} · <strong>{fmt2(rItem.skorAkhir)}</strong> ({rItem.predikatBox})
                  </div>
                </button>
              )
            })}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              size="sm"
              variant="soft"
              data-testid="buat-simulasi-juri"
              onClick={() => void buatSimulasiBaru(draf.skema)}
            >
              <IconPlus size={14} /> Simulasi Baru
            </Button>
            <Button
              size="sm"
              variant="ghost"
              data-testid="pratinjau-cetak-juri"
              onClick={() => setPratinjauOpen(true)}
            >
              Pratinjau A4
            </Button>
            <Button
              size="sm"
              variant="ghost"
              data-testid="cetak-rekap-juri"
              onClick={cetakLembar}
            >
              <IconPrinter size={14} /> Cetak Rekap
            </Button>
            <Button
              size="sm"
              variant="ghost"
              data-testid="unduh-rekap-juri"
              onClick={unduhLembar}
            >
              <IconDownload size={14} /> Unduh HTML
            </Button>
            <ConfirmButton
              label="Hapus"
              message={`Hapus simulasi "${draf.judul}" beserta rekaman Judge Tape-nya?`}
              onConfirm={async () => {
                await db.judgeTapeAudio.delete(draf.id)
                await db.penilaianLomba.delete(draf.id)
                setAktifId('')
                toast.push('Simulasi penilaian dihapus', 'info')
              }}
            />
          </div>
        </div>
      </Card>

      {/* Papan skor utama + identitas simulasi */}
      <Card data-testid="papan-skor-juri">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-800 pb-4 md:flex-row md:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                data-testid="skor-akhir-juri"
                className="text-3xl font-extrabold tabular-nums text-slate-50"
              >
                {fmt2(rekap.skorAkhir)}
              </span>
              <span className="text-sm text-slate-400">/ {fmt2(rekap.maksSubtotal)}</span>
              <span
                data-testid="lencana-box-juri"
                className={cx('rounded-full border px-2.5 py-0.5 text-xs font-bold', warnaLencanaBox)}
              >
                {rekap.predikatBox} ({fmt2(rekap.persenAkhir)}%)
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              {rekap.ketPredikatBox}
              {rekap.totalPenalti > 0 && (
                <span className="ml-2 font-semibold text-rose-400">
                  · Penalti −{fmt2(rekap.totalPenalti)} poin (Subtotal {fmt2(rekap.subtotal)})
                </span>
              )}
            </p>
          </div>
          {rekap.terkuat && rekap.terlemah && (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg border border-emerald-800/50 bg-emerald-950/30 px-2.5 py-1.5">
                <div className="text-[10px] uppercase tracking-wider text-emerald-400">Caption Terkuat</div>
                <div className="font-semibold text-emerald-200">{rekap.terkuat.label}</div>
                <div className="text-[11px] text-emerald-300/80">{fmt2(rekap.terkuat.persen)}%</div>
              </div>
              <div className="rounded-lg border border-amber-800/50 bg-amber-950/30 px-2.5 py-1.5">
                <div className="text-[10px] uppercase tracking-wider text-amber-400">Fokus Pembenahan</div>
                <div className="font-semibold text-amber-200">{rekap.terlemah.label}</div>
                <div className="text-[11px] text-amber-300/80">{fmt2(rekap.terlemah.persen)}%</div>
              </div>
            </div>
          )}
        </div>

        {/* Kartu subtotal per kelompok caption */}
        <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {rekap.perKelompok.map((k) => (
            <div
              key={k.kelompok}
              data-testid={`kartu-kelompok-${k.kelompok}`}
              className="rounded-xl border border-slate-800 bg-slate-900/60 p-2.5"
            >
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-300">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: WARNA_HEX_KELOMPOK[k.kelompok] }}
                />
                {k.label}
              </div>
              <div className="mt-1 text-lg font-bold tabular-nums text-slate-100">
                {fmt2(k.terbobot)}{' '}
                <span className="text-xs font-normal text-slate-500">/ {fmt2(k.maksTerbobot)}</span>
              </div>
              <div className="text-[11px] text-slate-400">{fmt2(k.persen)}% capaian</div>
            </div>
          ))}
        </div>

        {/* Metadata simulasi & tautan Drill/Lagu */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Judul Simulasi / Evaluasi">
            <Input
              data-testid="input-judul-juri"
              value={draf.judul}
              onChange={(e) => void simpanPenilaian({ ...drafRef.current!, judul: e.target.value })}
            />
          </Field>
          <Field label="Tanggal Simulasi">
            <Input
              type="date"
              data-testid="input-tanggal-juri"
              value={draf.tanggal}
              onChange={(e) => void simpanPenilaian({ ...drafRef.current!, tanggal: e.target.value })}
            />
          </Field>
          <Field label="Skema Mata Lomba">
            <Select
              data-testid="select-skema-juri"
              value={draf.skema}
              onChange={(e) => gantiSkema(e.target.value as SkemaCaptionId)}
            >
              {DAFTAR_SKEMA.map((sk) => (
                <option key={sk} value={sk}>
                  {LABEL_SKEMA_CAPTION[sk]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Drill Tertaut (Peta Set)">
            <Select
              data-testid="select-drill-juri"
              value={draf.drillId ?? ''}
              onChange={(e) => {
                const idDrill = e.target.value || undefined
                const dr = (drills ?? []).find((x) => x.id === idDrill)
                void simpanPenilaian({
                  ...drafRef.current!,
                  drillId: idDrill,
                  songId: dr?.songId || drafRef.current!.songId,
                })
              }}
            >
              <option value="">— Tanpa tautan drill —</option>
              {(drills ?? []).map((dr) => (
                <option key={dr.id} value={dr.id}>
                  {dr.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Lagu Tertaut (Peta Birama)">
            <Select
              data-testid="select-lagu-juri"
              value={draf.songId ?? ''}
              onChange={(e) =>
                void simpanPenilaian({
                  ...drafRef.current!,
                  songId: e.target.value || undefined,
                })
              }
            >
              <option value="">— Tanpa tautan lagu —</option>
              {(songs ?? []).map((sg) => (
                <option key={sg.id} value={sg.id}>
                  {sg.title} ({sg.bpm} BPM)
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Card>

      {/* Tabel Lembar Rekapitulasi Sub-Caption */}
      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">
              Lembar Rekapitulasi Sub-Caption (Komposisi vs Eksekusi)
            </h2>
            <p className="text-xs text-slate-400">
              Isi skor Repertoar/Komposisi dan Pencapaian/Eksekusi per juri; nilai terbobot dan klasifikasi Box terhitung seketika.
            </p>
          </div>
          <Field label="Koordinator / Juri Utama">
            <Input
              placeholder="Mis. Bpk. Hendra (Juri Tamu)"
              data-testid="input-juri-utama"
              value={draf.juriUtama ?? ''}
              onChange={(e) =>
                void simpanPenilaian({
                  ...drafRef.current!,
                  juriUtama: e.target.value || undefined,
                })
              }
            />
          </Field>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs" data-testid="tabel-subcaption-juri">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400">
                <th className="py-2 pr-2">Sub-Caption &amp; Juri</th>
                <th className="px-2 py-2">Komposisi / Rep</th>
                <th className="px-2 py-2">Eksekusi / Achv</th>
                <th className="px-2 py-2 text-right">Bobot</th>
                <th className="px-2 py-2 text-right">Terbobot</th>
                <th className="py-2 pl-2 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {rekap.baris.map((b, idx) => {
                const asli = draf.captions[idx]
                if (!asli) return null
                return (
                  <tr key={b.id} data-testid={`baris-subcaption-${b.id}`}>
                    <td className="py-2.5 pr-2 align-top">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="inline-block h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: WARNA_HEX_KELOMPOK[b.kelompok] }}
                        />
                        <span className="font-semibold text-slate-100">{b.label}</span>
                      </div>
                      <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
                        <Input
                          placeholder="Nama juri (opsional)"
                          value={asli.namaJuri ?? ''}
                          onChange={(e) =>
                            perbaruiSubCaption(b.id, { namaJuri: e.target.value || undefined })
                          }
                        />
                        <Input
                          placeholder="Catatan ringkas caption"
                          value={asli.catatan ?? ''}
                          onChange={(e) =>
                            perbaruiSubCaption(b.id, { catatan: e.target.value || undefined })
                          }
                        />
                      </div>
                    </td>
                    <td className="px-2 py-2.5 align-top">
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          step="0.1"
                          min={0}
                          max={b.maksKomposisi}
                          data-testid={`input-komposisi-${b.id}`}
                          className="w-20 text-right tabular-nums"
                          value={asli.nilaiKomposisi}
                          onChange={(e) =>
                            perbaruiSubCaption(b.id, {
                              nilaiKomposisi: Math.max(
                                0,
                                Math.min(b.maksKomposisi, Number(e.target.value) || 0),
                              ),
                            })
                          }
                        />
                        <span className="text-[11px] text-slate-500">/ {b.maksKomposisi}</span>
                      </div>
                    </td>
                    <td className="px-2 py-2.5 align-top">
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          step="0.1"
                          min={0}
                          max={b.maksEksekusi}
                          data-testid={`input-eksekusi-${b.id}`}
                          className="w-20 text-right tabular-nums"
                          value={asli.nilaiEksekusi}
                          onChange={(e) =>
                            perbaruiSubCaption(b.id, {
                              nilaiEksekusi: Math.max(
                                0,
                                Math.min(b.maksEksekusi, Number(e.target.value) || 0),
                              ),
                            })
                          }
                        />
                        <span className="text-[11px] text-slate-500">/ {b.maksEksekusi}</span>
                      </div>
                    </td>
                    <td className="px-2 py-2.5 align-top text-right tabular-nums text-slate-400">
                      {b.pengaliBobot}×
                    </td>
                    <td className="px-2 py-2.5 align-top text-right tabular-nums">
                      <div className="font-bold text-slate-100">{fmt2(b.terbobot)}</div>
                      <div className="text-[10px] text-slate-500">
                        / {fmt2(b.maksTerbobot)} ({fmt2(b.persen)}%)
                      </div>
                    </td>
                    <td className="py-2.5 pl-2 align-top text-right">
                      {draf.captions.length > 1 && (
                        <button
                          type="button"
                          title="Hapus sub-caption"
                          onClick={() => hapusSubCaption(b.id)}
                          className="rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-rose-400"
                        >
                          <IconTrash size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Tambah sub-caption kustom */}
        <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-slate-800 pt-3">
          <Field label="Tambah Sub-Caption Tambahan / Kustom">
            <Input
              placeholder="Mis. Drum Major / Mayoret"
              data-testid="input-subcaption-baru"
              value={labelSubBaru}
              onChange={(e) => setLabelSubBaru(e.target.value)}
            />
          </Field>
          <Field label="Kelompok">
            <Select
              value={klpSubBaru}
              onChange={(e) => setKlpSubBaru(e.target.value as KelompokCaption)}
            >
              {(Object.keys(LABEL_KELOMPOK_CAPTION) as KelompokCaption[]).map((k) => (
                <option key={k} value={k}>
                  {LABEL_KELOMPOK_CAPTION[k]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Maks per Komponen">
            <Input
              type="number"
              min={1}
              max={50}
              className="w-24"
              value={maksSubBaru}
              onChange={(e) => setMaksSubBaru(e.target.value)}
            />
          </Field>
          <Button
            size="sm"
            variant="soft"
            data-testid="tambah-subcaption-juri"
            onClick={tambahSubCaptionKustom}
          >
            <IconPlus size={14} /> Tambah Sub-Caption
          </Button>
        </div>

        {/* Penalti & Catatan Umum */}
        <div className="mt-4 grid gap-4 border-t border-slate-800 pt-4 md:grid-cols-2" data-testid="bagian-penalti-juri">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Penalti Waktu &amp; Garis Batas (−{fmt2(rekap.totalPenalti)} poin)
            </h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button
                type="button"
                data-testid="preset-penalti-waktu"
                onClick={() => tambahPenalti('Melewati batas durasi (Overtime)', 0.5)}
                className="rounded-md border border-slate-700 bg-slate-800/80 px-2 py-1 text-[11px] text-slate-300 hover:border-rose-500/50 hover:text-rose-200"
              >
                + Overtime (−0,50)
              </button>
              <button
                type="button"
                onClick={() => tambahPenalti('Keluar garis batas arena (Boundary)', 0.1)}
                className="rounded-md border border-slate-700 bg-slate-800/80 px-2 py-1 text-[11px] text-slate-300 hover:border-rose-500/50 hover:text-rose-200"
              >
                + Garis Batas (−0,10)
              </button>
              <button
                type="button"
                onClick={() => tambahPenalti('Terlambat masuk gerbang start', 1.0)}
                className="rounded-md border border-slate-700 bg-slate-800/80 px-2 py-1 text-[11px] text-slate-300 hover:border-rose-500/50 hover:text-rose-200"
              >
                + Terlambat Start (−1,00)
              </button>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Input
                placeholder="Alasan penalti lain…"
                data-testid="input-alasan-penalti"
                value={alasanPenalti}
                onChange={(e) => setAlasanPenalti(e.target.value)}
              />
              <Input
                type="number"
                step="0.1"
                min="0.05"
                data-testid="input-poin-penalti"
                className="w-24 text-right tabular-nums"
                value={poinPenalti}
                onChange={(e) => setPoinPenalti(e.target.value)}
              />
              <Button size="sm" variant="soft" data-testid="tambah-penalti-juri" onClick={() => tambahPenalti()}>
                Tambah
              </Button>
            </div>
            {draf.penalti.length > 0 && (
              <ul className="mt-2 space-y-1">
                {draf.penalti.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between rounded-lg border border-rose-900/50 bg-rose-950/25 px-2.5 py-1 text-xs text-rose-200"
                  >
                    <span>
                      {p.alasan} · <strong>−{fmt2(p.poin)}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => hapusPenalti(p.id)}
                      className="text-rose-400 hover:text-rose-200"
                    >
                      Hapus
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Catatan Umum Evaluasi Run-Through
            </h3>
            <textarea
              rows={4}
              data-testid="input-catatan-umum-juri"
              placeholder="Ringkasan evaluasi keseluruhan penampilan untuk rapat staf pelatih…"
              value={draf.catatanUmum ?? ''}
              onChange={(e) =>
                void simpanPenilaian({
                  ...drafRef.current!,
                  catatanUmum: e.target.value || undefined,
                })
              }
              className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-600 focus:border-emerald-500 focus:outline-none"
            />
          </div>
        </div>
      </Card>

      {/* Studio Judge Tape Berpenanda Waktu & Tertaut Set + Birama */}
      <Card data-testid="panel-judgetape">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">
              Judge Tape Berpenanda Waktu (Otomatis Tertaut Nomor Set &amp; Birama)
            </h2>
            <p className="text-xs text-slate-400">
              Rekam komentar suara juri atau jalankan stopwatch saat run-through; setiap cap waktu otomatis dipetakan ke Set formasi &amp; Birama lagu.
            </p>
          </div>
          <div
            data-testid="indikator-posisi-judgetape"
            className="rounded-xl border border-emerald-700/40 bg-emerald-950/30 px-3 py-1.5 text-right text-xs text-emerald-200"
          >
            <div className="font-mono text-sm font-bold">{formatWaktuDetik(posisiLangsung.detik)}</div>
            <div className="text-[11px] text-emerald-300/90">
              {posisiLangsung.labelSet
                ? `${posisiLangsung.labelSet}${posisiLangsung.hitunganSet ? ` (Hit. ${posisiLangsung.hitunganSet})` : ''}`
                : 'Belum tertaut set'}
              {posisiLangsung.birama ? ` · Birama ${posisiLangsung.birama}` : ''}
            </div>
          </div>
        </div>

        {/* Kontrol Stopwatch + Perekam Mikrofon + Unggah Audio */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={stopwatchJalan ? 'danger' : 'soft'}
            data-testid="tombol-stopwatch-judgetape"
            onClick={() => setStopwatchJalan((s) => !s)}
          >
            <IconPlay size={14} />{' '}
            {stopwatchJalan ? `Jeda Stopwatch (${formatWaktuDetik(detikSekarang)})` : 'Mulai Stopwatch Run-Through'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setStopwatchJalan(false)
              setDetikSekarang(0)
            }}
          >
            Reset 00:00
          </Button>

          {!sedangMerekamSuara ? (
            <Button
              size="sm"
              variant="soft"
              data-testid="rekam-suara-judgetape"
              onClick={() => void mulaiRekamMikrofon()}
            >
              ● Rekam Suara Juri (Mic)
            </Button>
          ) : (
            <Button
              size="sm"
              variant="danger"
              data-testid="henti-rekam-judgetape"
              onClick={hentikanRekamMikrofon}
            >
              ■ Hentikan &amp; Simpan Rekaman
            </Button>
          )}

          <label className="cursor-pointer rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:border-slate-600">
            Unggah Audio Judge Tape
            <input
              type="file"
              accept="audio/*"
              data-testid="unggah-audio-judgetape"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void unggahBerkasJudgeTape(f)
                e.currentTarget.value = ''
              }}
            />
          </label>
        </div>

        {/* Pemutar Audio bila ada rekaman Judge Tape */}
        {(urlAudio || draf.rekamanJudgeTape) && (
          <div
            data-testid="info-rekaman-judgetape"
            className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-900/70 p-2.5"
          >
            <div className="flex flex-1 flex-wrap items-center gap-3">
              {urlAudio && (
                <audio
                  ref={audioElRef}
                  controls
                  src={urlAudio}
                  data-testid="pemutar-audio-judgetape"
                  onTimeUpdate={(e) => setDetikSekarang(Math.round(e.currentTarget.currentTime * 10) / 10)}
                  className="h-9 max-w-full"
                />
              )}
              <span className="text-xs text-slate-300">
                <strong>{draf.rekamanJudgeTape?.namaFile ?? rekamanDb?.namaFile}</strong>
                {draf.rekamanJudgeTape?.ukuran
                  ? ` · ${Math.max(1, Math.round(draf.rekamanJudgeTape.ukuran / 1024))} KB`
                  : ''}
              </span>
            </div>
            <Button size="sm" variant="ghost" onClick={() => void hapusRekamanJudgeTape()}>
              Hapus Audio
            </Button>
          </div>
        )}

        {/* Form input cepat komentar berpenanda waktu */}
        <div className="mt-3 grid gap-2 rounded-xl border border-slate-800 bg-slate-900/40 p-3 sm:grid-cols-12">
          <div className="sm:col-span-2">
            <Field label="Detik (opsional)">
              <Input
                type="number"
                min={0}
                step="0.5"
                placeholder={String(Math.floor(detikSekarang))}
                data-testid="input-detik-judgetape"
                value={detikManual}
                onChange={(e) => setDetikManual(e.target.value)}
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Fokus Caption">
              <Select
                data-testid="select-fokus-judgetape"
                value={fokusCatatan}
                onChange={(e) => setFokusCatatan(e.target.value as KelompokCaption | 'umum')}
              >
                <option value="ge">General Effect</option>
                <option value="musik">Music</option>
                <option value="visual">Visual</option>
                <option value="guard">Color Guard</option>
                <option value="umum">Umum</option>
              </Select>
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Sifat Catatan">
              <Select
                data-testid="select-tingkat-judgetape"
                value={tingkatCatatan}
                onChange={(e) => setTingkatCatatan(e.target.value as 'biasa' | 'penting' | 'pujian')}
              >
                <option value="biasa">Catatan</option>
                <option value="penting">Prioritas Perbaikan</option>
                <option value="pujian">Apresiasi / Kuat</option>
              </Select>
            </Field>
          </div>
          <div className="sm:col-span-4">
            <Field label="Komentar Juri pada Momen Ini">
              <Input
                placeholder="Ketik catatan lalu tekan Enter (mis. Intonasi trumpet goyah di transisi)…"
                data-testid="input-teks-judgetape"
                value={teksCatatan}
                onChange={(e) => setTeksCatatan(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    tambahCatatanJudgeTape()
                  }
                }}
              />
            </Field>
          </div>
          <div className="flex items-end sm:col-span-2">
            <Button
              variant="primary"
              className="w-full"
              data-testid="tambah-catatan-judgetape"
              onClick={tambahCatatanJudgeTape}
            >
              + Tandai
            </Button>
          </div>
        </div>

        {/* Saring & lompat per Set formasi */}
        {setsDrillTertaut.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5" data-testid="filter-set-judgetape">
            <span className="text-[11px] text-slate-400">Saring / Putar per Set:</span>
            <button
              type="button"
              onClick={() => setFilterSetId('semua')}
              className={cx(
                'rounded-full px-2.5 py-0.5 text-xs transition',
                filterSetId === 'semua'
                  ? 'bg-emerald-500/20 font-semibold text-emerald-300 ring-1 ring-emerald-500/40'
                  : 'bg-slate-800/80 text-slate-400 hover:text-slate-200',
              )}
            >
              Semua ({draf.catatanWaktu.length})
            </button>
            {setsDrillTertaut.map((s) => {
              const jml = draf.catatanWaktu.filter((c) => c.setId === s.id).length
              const aktif = filterSetId === s.id
              return (
                <button
                  key={s.id}
                  type="button"
                  data-testid={`filter-set-${s.id}`}
                  onClick={() => {
                    setFilterSetId(s.id)
                    const mulai = detikMulaiUntukSet(s.id, {
                      sets: setsDrillTertaut,
                      drill: drillTertaut,
                      song: laguTertaut,
                    })
                    if (mulai !== null) putarPadaDetik(mulai)
                  }}
                  className={cx(
                    'rounded-full px-2.5 py-0.5 text-xs transition',
                    aktif
                      ? 'bg-emerald-500/20 font-semibold text-emerald-300 ring-1 ring-emerald-500/40'
                      : 'bg-slate-800/80 text-slate-400 hover:text-slate-200',
                  )}
                >
                  {s.name} ({jml})
                </button>
              )
            })}
          </div>
        )}

        {/* Daftar komentar berpenanda waktu */}
        {catatanTersaring.length === 0 ? (
          <p className="mt-3 text-xs italic text-slate-500">
            Belum ada komentar Judge Tape pada tampilan ini.
          </p>
        ) : (
          <ul className="mt-3 space-y-1.5" data-testid="daftar-catatan-judgetape">
            {catatanTersaring.map((c) => (
              <li
                key={c.id}
                data-testid={`item-judgetape-${c.id}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs"
              >
                <div className="flex flex-1 flex-wrap items-center gap-2">
                  <button
                    type="button"
                    data-testid={`putar-catatan-${c.id}`}
                    onClick={() => putarPadaDetik(c.detik)}
                    className="inline-flex items-center gap-1 rounded-md border border-emerald-700/50 bg-emerald-950/40 px-2 py-0.5 font-mono font-bold text-emerald-300 hover:bg-emerald-900/50"
                  >
                    ▶ {formatWaktuDetik(c.detik)}
                  </button>
                  {(c.labelSet || c.birama) && (
                    <span
                      data-testid={`tautan-set-birama-${c.id}`}
                      className="rounded-md bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-sky-300"
                    >
                      {c.labelSet
                        ? `${c.labelSet}${c.hitunganSet ? ` · Hit. ${c.hitunganSet}` : ''}`
                        : ''}
                      {c.labelSet && c.birama ? ' · ' : ''}
                      {c.birama ? `Birama ${c.birama}` : ''}
                    </span>
                  )}
                  <span className="rounded bg-slate-800/80 px-1.5 py-0.5 text-[10px] uppercase text-slate-300">
                    {c.fokus === 'umum' ? 'Umum' : LABEL_KELOMPOK_CAPTION[c.fokus]}
                  </span>
                  {c.tingkat === 'penting' && (
                    <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                      PRIORITAS
                    </span>
                  )}
                  {c.tingkat === 'pujian' && (
                    <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
                      KUAT
                    </span>
                  )}
                  <span className="text-slate-100">{c.teks}</span>
                </div>
                <button
                  type="button"
                  onClick={() => hapusCatatanJudgeTape(c.id)}
                  className="text-slate-500 hover:text-rose-400"
                  title="Hapus komentar"
                >
                  <IconTrash size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Grafik Tren Skor Multi-Simulasi (#1 -> H-1 Lomba) — SVG Hex Murni */}
      <Card data-testid="grafik-tren-juri">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">
              Grafik Tren Skor Simulasi Tim (Simulasi #1 → H-1 Lomba)
            </h2>
            <p className="text-xs text-slate-400">
              Pantau progres nilai bersih dan perkembangan tiap caption lintas uji coba penampilan.
            </p>
          </div>
          {tren.kenaikanTotal !== null && (
            <span
              data-testid="lencana-kenaikan-tren"
              className={cx(
                'rounded-full border px-2.5 py-1 text-xs font-bold',
                tren.kenaikanTotal >= 0
                  ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                  : 'border-rose-500/40 bg-rose-500/15 text-rose-300',
              )}
            >
              {tren.kenaikanTotal >= 0 ? `+${fmt2(tren.kenaikanTotal)}` : fmt2(tren.kenaikanTotal)} poin sejak simulasi pertama
            </span>
          )}
        </div>

        {tren.titik.length < 2 ? (
          <p className="text-xs text-slate-400">
            Simpan minimal 2 simulasi run-through pada tanggal berbeda untuk menampilkan kurva pertumbuhan skor menuju hari lomba.
          </p>
        ) : (
          <GrafikTrenSvg titik={tren.titik} aktifId={draf.id} onPilih={setAktifId} />
        )}
      </Card>

      {/* Modal Pratinjau Lembar Cetak A4 */}
      <Modal
        open={pratinjauOpen}
        onClose={() => setPratinjauOpen(false)}
        title="Pratinjau Caption Recap Sheet A4"
        wide
        testId="modal-pratinjau-rekap-juri"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setPratinjauOpen(false)}>
              Tutup
            </Button>
            <Button variant="soft" onClick={unduhLembar}>
              <IconDownload size={14} /> Unduh HTML
            </Button>
            <Button variant="primary" onClick={cetakLembar}>
              <IconPrinter size={14} /> Cetak Sekarang
            </Button>
          </div>
        }
      >
        <div className="overflow-hidden rounded-lg border border-slate-700 bg-white">
          <iframe
            title="Pratinjau Caption Recap Sheet"
            data-testid="iframe-pratinjau-rekap-juri"
            srcDoc={susunHtmlCetak()}
            className="h-[68vh] w-full border-0"
          />
        </div>
      </Modal>
    </div>
  )
}

function GrafikTrenSvg({
  titik,
  aktifId,
  onPilih,
}: {
  titik: ReturnType<typeof hitungTrenSkorSimulasi>['titik']
  aktifId: string
  onPilih: (id: string) => void
}) {
  const W = 680
  const H = 210
  const padL = 44
  const padR = 28
  const padT = 24
  const padB = 42
  const plotW = W - padL - padR
  const plotH = H - padT - padB

  const nilaiMin = Math.max(0, Math.floor(Math.min(...titik.map((t) => t.skorAkhir)) / 10) * 10 - 5)
  const nilaiMaks = Math.min(100, Math.ceil(Math.max(...titik.map((t) => t.skorAkhir)) / 10) * 10 + 5)
  const rentang = Math.max(10, nilaiMaks - nilaiMin)

  const xUntuk = (i: number) =>
    titik.length === 1 ? padL + plotW / 2 : padL + (i / (titik.length - 1)) * plotW
  const yUntuk = (skor: number) => padT + plotH - ((skor - nilaiMin) / rentang) * plotH

  const polyline = titik.map((t, i) => `${xUntuk(i).toFixed(1)},${yUntuk(t.skorAkhir).toFixed(1)}`).join(' ')

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[460px]"
        role="img"
        aria-label="Grafik tren skor simulasi penilaian juri"
        data-testid="svg-tren-juri"
      >
        <rect x={0} y={0} width={W} height={H} rx={12} fill="#0f172a" stroke="#1e293b" />
        {[0, 0.5, 1].map((fr) => {
          const v = nilaiMin + fr * rentang
          const y = yUntuk(v)
          return (
            <g key={fr}>
              <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#1e293b" strokeDasharray="4 4" />
              <text x={padL - 8} y={y + 4} textAnchor="end" fontSize="10" fill="#94a3b8">
                {Math.round(v)}
              </text>
            </g>
          )
        })}
        <polyline
          fill="none"
          stroke="#10b981"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={polyline}
        />
        {titik.map((t, i) => {
          const cxPt = xUntuk(i)
          const cyPt = yUntuk(t.skorAkhir)
          const aktif = t.id === aktifId
          return (
            <g
              key={t.id}
              style={{ cursor: 'pointer' }}
              onClick={() => onPilih(t.id)}
            >
              <circle
                cx={cxPt}
                cy={cyPt}
                r={aktif ? 7 : 5}
                fill={aktif ? '#34d399' : '#0f172a'}
                stroke="#10b981"
                strokeWidth="2.5"
              />
              <text
                x={cxPt}
                y={cyPt - 10}
                textAnchor="middle"
                fontSize="10.5"
                fontWeight="700"
                fill="#f8fafc"
              >
                {fmt2(t.skorAkhir)}
              </text>
              <text x={cxPt} y={H - 20} textAnchor="middle" fontSize="10" fill="#cbd5e1">
                {t.tanggal}
              </text>
              <text x={cxPt} y={H - 8} textAnchor="middle" fontSize="9.5" fill="#64748b">
                {t.predikatBox}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
