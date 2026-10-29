/**
 * #11b, #11c & #11d — Layar baca partitur (MusicXML via OSMD SVG hex & lembar PDF),
 * lengkap dengan penyaringan per seksi / per *part* instrumen, pencocokan
 * otomatis anggota, pratinjau cetak & unduh HTML mandiri murni hex, serta
 * sorot birama aktif sinkron `TempoTimeline`, pilih/*loop* frasa, dan keping
 * tautan set drill.
 *
 * **Jaminan utama:**
 * - Menggambar *full score*, kelompok seksi, maupun *part* tunggal secara
 *   *offline* dengan warna hex murni (`#ffffff` kertas / `#0f172a` tinta, nol
 *   `oklch()` / `color-mix()`), dimuat malas lewat `partiturRender.ts` dan
 *   dirender bertahap (`renderNext`) agar metronom tidak tersendat.
 * - Sorot birama aktif & rentang frasa dirender sebagai lapisan absolut murni
 *   hex/rgba di atas kanvas SVG tanpa merender ulang OSMD di tiap ketukan,
 *   lengkap dengan gulir otomatis (*auto-scroll*) pintar dan pemetaan *multi-rest*.
 * - Mode anggota memberi pilihan awal cerdas sesuai `instrument` / `section`
 *   tanpa pernah mengunci atau menghalangi pemakaian tanpa nama (D4 `#11c`).
 * - Untuk berkas PDF, menampilkan bingkai pratinjau ditambah bilah latihan frasa
 *   serta tombol selalu-ada **Buka di tab baru** & **Unduh PDF** (D5 `#11b`).
 */
import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import type { Member, PartiturBerkasItem, SectionDef, Song } from '../db/types'
import type { BagianPartitur } from '../lib/partitur'
import {
  bacaFilterPartiturTersimpan,
  daftarIdPartAktif,
  kelompokkanPartSkor,
  pilihFilterAwalAnggota,
  samaFilterPartitur,
  sesuaikanFilterKePartSkor,
  simpanFilterPartitur,
  type FilterPartitur,
} from '../lib/partiturBagian'
import {
  WARNA_SOROT_PARTITUR_HEX,
  cariBiramaDariTitikKlik,
  cariKotakBiramaAktif,
  formatLencanaFrasa,
  formatTautanSetBirama,
  frasaAktifSah,
  gabungKotakFrasaPerBaris,
  gabungRentangSetKeBirama,
  hitungRentangFrasaSegmen,
  hitungTargetGulirBirama,
  susunFrasaTerurut,
  type FrasaLatihan,
  type InfoSetBirama,
} from '../lib/partiturFrasa'
import {
  WARNA_PARTITUR_HEX,
  ZOOM_BAWAAN,
  ZOOM_LANGKAH,
  ZOOM_MAKS,
  ZOOM_MIN,
  bacaZoomTersimpan,
  jepitZoom,
  renderPartiturMusicXml,
  simpanZoomPartitur,
  type HasilSesiPartitur,
  type ModeTataLetakPartitur,
  type ProgresRenderPartitur,
} from '../lib/partiturRender'
import { muatPartiturBerkas } from '../lib/partiturSimpan'
import { teksPartitur } from '../lib/partitur'
import {
  PemutarNadaPartitur,
  jadwalkanDetikNada,
  uraiJadwalNadaMusicXml,
} from '../lib/partiturBunyi'
import type { TempoLatihan } from '../lib/tempoLatihan'
import { DEFAULT_SECTIONS, cx } from '../lib/utils'
import { IconDownload, IconLoop, IconMusic, IconPause, IconPlay, IconPrinter } from './Icons'
import { PratinjauCetakPartitur } from './PratinjauCetakPartitur'
import { Button } from './ui'

const PILIHAN_PERSEN_CEPAT = [70, 80, 90, 100] as const

function tentukanFilterAwalLagu(
  kunciSimpan: string,
  daftarPart: BagianPartitur[],
  anggotaAktif: Member | null,
  sectionsTim: SectionDef[],
): FilterPartitur {
  const tersimpan = bacaFilterPartiturTersimpan(kunciSimpan)
  if (tersimpan) {
    return daftarPart.length > 0
      ? sesuaikanFilterKePartSkor(tersimpan, daftarPart)
      : tersimpan
  }
  if (anggotaAktif && daftarPart.length > 0) {
    return pilihFilterAwalAnggota(daftarPart, anggotaAktif, sectionsTim).filter
  }
  return { jenis: 'semua' }
}

export function LayarPartitur({
  song,
  onTutup,
  anggotaAktif = null,
  sectionsTim = DEFAULT_SECTIONS,
  namaTim,
  hanyaPutar = false,
  biramaAktif: biramaAktifLuar = 1,
  sedangMain: sedangMainLuar = false,
  tahapKetuk = null,
  ketukAktif: ketukAktifLuar = null,
  onToggleMain,
  onLoncatBirama,
  frasa = null,
  panjangBiramaLagu,
  onUbahFrasa,
  onHapusFrasa,
  tempoLatihan = null,
  onAturPersenTempo,
  daftarSetDrill = [],
  labelKonteksPutar,
}: {
  song: Song
  onTutup: () => void
  anggotaAktif?: Member | null
  sectionsTim?: SectionDef[]
  namaTim?: string
  hanyaPutar?: boolean
  /** #11d — birama 1-based yang sedang disorot mengikuti `TempoTimeline`. */
  biramaAktif?: number
  /** #11d — apakah metronom / rekaman / animasi drill sedang berjalan. */
  sedangMain?: boolean
  /** #11d — `'hitung'` saat count-off M1 sedang berbunyi. */
  tahapKetuk?: 'hitung' | 'main' | null
  /** #11d — ketuk 0-based di dalam birama saat ini (opsional). */
  ketukAktif?: number | null
  /** #11d — nyalakan/hentikan pemutaran langsung dari bilah partitur. */
  onToggleMain?: () => void
  /** #11d — lompat ke birama tertentu saat diklik di partitur. */
  onLoncatBirama?: (birama: number) => void
  /** #11d — rentang frasa latihan lagu ini (per perangkat / M2). */
  frasa?: FrasaLatihan | null
  /** #11d — batas birama maksimum lagu bila diketahui. */
  panjangBiramaLagu?: number
  /** #11d — ubah rentang atau status aktif loop frasa. */
  onUbahFrasa?: (patch: Partial<FrasaLatihan>) => void
  /** #11d — hapus frasa latihan lagu ini. */
  onHapusFrasa?: () => void
  /** #11d — tempo latihan lagu ini (#4). */
  tempoLatihan?: TempoLatihan | null
  /** #11d — ubah cepat persen tempo latihan (mis. 70/80/90/100%). */
  onAturPersenTempo?: (persen: number) => void
  /** #11d — daftar pemetaan set drill ↔ birama bila lagu ditautkan ke drill. */
  daftarSetDrill?: InfoSetBirama[]
  /** #11d — label ringkas pemutar pendamping (mis. "Animasi Drill"). */
  labelKonteksPutar?: string
}) {
  const meta = song.partitur ?? null
  const [itemBerkas, setItemBerkas] = useState<PartiturBerkasItem | null>(null)
  const [memuatBerkas, setMemuatBerkas] = useState(true)
  const [blobUrl, setBlobUrl] = useState<string | null>(null)

  const [zoom, setZoom] = useState<number>(() => bacaZoomTersimpan())
  const [tataLetak, setTataLetak] = useState<ModeTataLetakPartitur>('vertikal')
  const [layarPenuh, setLayarPenuh] = useState(false)
  const [cetakTerbuka, setCetakTerbuka] = useState(false)
  const [seriLebar, setSeriLebar] = useState(0)

  const [sedangRender, setSedangRender] = useState(false)
  const [progres, setProgres] = useState<ProgresRenderPartitur | null>(null)
  const [infoSesi, setInfoSesi] = useState<HasilSesiPartitur | null>(null)
  const [galatRender, setGalatRender] = useState<string | null>(null)

  // #11d — auto-scroll mengikuti birama aktif + mode 2-ketuk pilih frasa di kanvas
  const [ikutiBirama, setIkutiBirama] = useState(true)
  const [modePilihFrasa, setModePilihFrasa] = useState(false)
  const [calonAwalFrasa, setCalonAwalFrasa] = useState<number | null>(null)
  const [setAwalTerpilih, setSetAwalTerpilih] = useState<number | null>(null)

  // #13b — pemutar sintesis bunyi notasi WebAudio langsung dari MusicXML
  const pemutarNotRef = useRef<PemutarNadaPartitur | null>(null)
  const [sedangBunyiNot, setSedangBunyiNot] = useState(false)
  const [posisiNot, setPosisiNot] = useState<{ birama: number; ketuk: number } | null>(null)
  const [teksXmlPartitur, setTeksXmlPartitur] = useState<string>('')

  const biramaAktif = sedangBunyiNot && posisiNot ? posisiNot.birama : biramaAktifLuar
  const sedangMain = sedangMainLuar || sedangBunyiNot
  const ketukAktif = sedangBunyiNot && posisiNot ? posisiNot.ketuk : ketukAktifLuar

  // Cadangan daftar part dari OSMD untuk berkas D4 (`terurai: false`, mis. `<score-timewise>`)
  // yang pada saat dipindai `#11a` belum memiliki `meta.parts`.
  const [partCadanganOsmd, setPartCadanganOsmd] = useState<BagianPartitur[]>([])

  const daftarPartSkor = useMemo<BagianPartitur[]>(() => {
    if (meta?.parts && meta.parts.length > 0) return meta.parts
    return partCadanganOsmd
  }, [meta?.parts, partCadanganOsmd])

  const tandaPartSkor = useMemo(
    () => daftarPartSkor.map((p) => `${p.id}:${p.nama}`).join('|'),
    [daftarPartSkor],
  )

  const kunciSimpanFilter = anggotaAktif?.id
    ? `${song.id}::${anggotaAktif.id}`
    : hanyaPutar
      ? `${song.id}::anon`
      : song.id

  const [filterAktif, setFilterAktif] = useState<FilterPartitur>(() =>
    tentukanFilterAwalLagu(kunciSimpanFilter, daftarPartSkor, anggotaAktif, sectionsTim),
  )

  const kunciKonteksRef = useRef(`${kunciSimpanFilter}@@${tandaPartSkor}`)
  useEffect(() => {
    const kunciBaru = `${kunciSimpanFilter}@@${tandaPartSkor}`
    if (kunciKonteksRef.current === kunciBaru) return
    kunciKonteksRef.current = kunciBaru
    setFilterAktif(
      tentukanFilterAwalLagu(kunciSimpanFilter, daftarPartSkor, anggotaAktif, sectionsTim),
    )
  }, [kunciSimpanFilter, tandaPartSkor, daftarPartSkor, anggotaAktif, sectionsTim])

  useEffect(() => {
    setModePilihFrasa(false)
    setCalonAwalFrasa(null)
    setSetAwalTerpilih(null)
  }, [song.id])

  const daftarKelompok = useMemo(
    () => kelompokkanPartSkor(daftarPartSkor, sectionsTim),
    [daftarPartSkor, sectionsTim],
  )

  const pilihanAnggotaAwal = useMemo(
    () => pilihFilterAwalAnggota(daftarPartSkor, anggotaAktif, sectionsTim),
    [daftarPartSkor, anggotaAktif, sectionsTim],
  )

  const filterIdAktif = useMemo(
    () => daftarIdPartAktif(filterAktif, daftarPartSkor),
    [filterAktif, daftarPartSkor],
  )
  const tandaFilterId = filterIdAktif ? filterIdAktif.join('\u0001') : '__SEMUA__'

  const kertasRef = useRef<HTMLDivElement | null>(null)
  const pembungkusKanvasRef = useRef<HTMLDivElement | null>(null)
  const wadahSvgRef = useRef<HTMLDivElement | null>(null)
  const lebarTerakhirRef = useRef<number>(0)

  // 1. Ambil Blob dari IndexedDB setiap kali lagu atau sidik berkasnya berubah.
  useEffect(() => {
    let hidup = true
    setMemuatBerkas(true)
    setItemBerkas(null)
    setInfoSesi(null)
    setGalatRender(null)
    setProgres(null)
    setPartCadanganOsmd([])

    if (!meta) {
      setMemuatBerkas(false)
      return
    }

    void muatPartiturBerkas(song.id)
      .then(async (hasil) => {
        if (!hidup) return
        setItemBerkas(hasil ?? null)
        if (hasil?.blob && hasil.tipe === 'musicxml') {
          try {
            const bita = new Uint8Array(await hasil.blob.arrayBuffer())
            if (hidup) setTeksXmlPartitur(teksPartitur(bita))
          } catch {
            if (hidup) setTeksXmlPartitur('')
          }
        } else {
          setTeksXmlPartitur('')
        }
        setMemuatBerkas(false)
      })
      .catch(() => {
        if (!hidup) return
        setItemBerkas(null)
        setTeksXmlPartitur('')
        setMemuatBerkas(false)
      })

    return () => {
      hidup = false
    }
  }, [song.id, meta?.hash, meta?.namaFile, meta?.dipasangiAt])

  // 2. Kelola masa hidup Object URL untuk tombol unduh asli & penampil PDF.
  useEffect(() => {
    if (!itemBerkas?.blob) {
      setBlobUrl(null)
      return
    }
    const url = URL.createObjectURL(itemBerkas.blob)
    setBlobUrl(url)
    return () => {
      URL.revokeObjectURL(url)
    }
  }, [itemBerkas])

  // 3. Tutup mode layar penuh dengan tombol Escape & kunci gulir latar belakang.
  useEffect(() => {
    if (!layarPenuh) return
    const gayaOverflowAsli = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const saatTombol = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !cetakTerbuka) setLayarPenuh(false)
    }
    window.addEventListener('keydown', saatTombol)
    return () => {
      document.body.style.overflow = gayaOverflowAsli
      window.removeEventListener('keydown', saatTombol)
    }
  }, [layarPenuh, cetakTerbuka])

  // 4. Pantau perubahan lebar nyata wadah kertas (>= 24 px).
  useEffect(() => {
    const el = kertasRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    lebarTerakhirRef.current = el.clientWidth
    let pewaktu: number | null = null

    const pengamat = new ResizeObserver(() => {
      const lebarBaru = el.clientWidth
      if (lebarBaru <= 0) return
      if (Math.abs(lebarBaru - lebarTerakhirRef.current) < 24) return
      lebarTerakhirRef.current = lebarBaru
      if (pewaktu != null) window.clearTimeout(pewaktu)
      pewaktu = window.setTimeout(() => {
        setSeriLebar((n) => n + 1)
      }, 240)
    })

    pengamat.observe(el)
    return () => {
      if (pewaktu != null) window.clearTimeout(pewaktu)
      pengamat.disconnect()
    }
  }, [itemBerkas?.tipe, layarPenuh])

  // 5. Render MusicXML secara malas & bertahap lewat OSMD.
  useEffect(() => {
    const wadah = wadahSvgRef.current
    if (!itemBerkas || itemBerkas.tipe !== 'musicxml' || !wadah) {
      return
    }

    const pengendali = new AbortController()
    let pembersihSesi: (() => void) | null = null
    const daftarIdRender = tandaFilterId === '__SEMUA__' ? null : tandaFilterId.split('\u0001')

    setSedangRender(true)
    setGalatRender(null)
    setProgres({ selesai: false, biramaTerender: 0, totalBirama: meta?.jumlahBirama ?? 0 })

    void renderPartiturMusicXml({
      wadah,
      sumber: itemBerkas.blob,
      judulCadangan: meta?.judul || song.title,
      zoom,
      tataLetak,
      filterIdXml: daftarIdRender,
      sinyal: pengendali.signal,
      onProgres: (p) => {
        if (!pengendali.signal.aborted) setProgres(p)
      },
    }).then((hasil) => {
      if (pengendali.signal.aborted) return
      setSedangRender(false)
      if (hasil.ok) {
        pembersihSesi = hasil.bersihkan
        setInfoSesi(hasil.sesi)
        setGalatRender(null)
        if ((!meta?.parts || meta.parts.length === 0) && hasil.sesi.instrumen.length > 0) {
          setPartCadanganOsmd((lama) =>
            lama.length > 0
              ? lama
              : hasil.sesi.instrumen.map((i) => ({
                  id: i.idXml,
                  nama: i.nama,
                  singkatan: i.singkatan || undefined,
                })),
          )
        }
      } else if (!hasil.dibatalkan) {
        setInfoSesi(null)
        setGalatRender(hasil.galat)
      }
    })

    return () => {
      pengendali.abort()
      pembersihSesi?.()
    }
  }, [
    itemBerkas,
    zoom,
    tataLetak,
    tandaFilterId,
    layarPenuh,
    seriLebar,
    meta?.judul,
    meta?.jumlahBirama,
    meta?.parts,
    song.title,
  ])

  const tipe = itemBerkas?.tipe ?? meta?.tipe ?? 'musicxml'
  const namaUnduh = itemBerkas?.namaFile ?? meta?.namaFile ?? `${song.title}.musicxml`
  const persenZoom = Math.round(zoom * 100)

  const batasMaksBirama = useMemo(() => {
    if (panjangBiramaLagu && panjangBiramaLagu > 0) return panjangBiramaLagu
    if (song.panjangBirama && song.panjangBirama > 0) return song.panjangBirama
    if (infoSesi?.birama.length) {
      const maksSesi = infoSesi.birama[infoSesi.birama.length - 1]?.birama ?? 0
      if (maksSesi > 0) return maksSesi
    }
    if (meta?.jumlahBirama && meta.jumlahBirama > 0) return meta.jumlahBirama
    return undefined
  }, [panjangBiramaLagu, song.panjangBirama, infoSesi?.birama, meta?.jumlahBirama])

  const daftarKotakBirama = infoSesi?.birama ?? []

  const kotakBiramaAktif = useMemo(
    () => cariKotakBiramaAktif(daftarKotakBirama, biramaAktif),
    [daftarKotakBirama, biramaAktif],
  )

  const kotakCalonAwal = useMemo(
    () => (calonAwalFrasa != null ? cariKotakBiramaAktif(daftarKotakBirama, calonAwalFrasa) : null),
    [daftarKotakBirama, calonAwalFrasa],
  )

  const frasaSahUntukSorot = useMemo(
    () => Boolean(frasa && frasa.dari >= 1 && frasa.sampai >= frasa.dari),
    [frasa],
  )

  const pitaSorotFrasa = useMemo(() => {
    if (!frasa || !frasaSahUntukSorot) return []
    return gabungKotakFrasaPerBaris(daftarKotakBirama, frasa.dari, frasa.sampai)
  }, [daftarKotakBirama, frasa, frasaSahUntukSorot])

  const lencanaFrasa = useMemo(
    () => formatLencanaFrasa(frasa, tempoLatihan, panjangBiramaLagu ?? song.panjangBirama),
    [frasa, tempoLatihan, panjangBiramaLagu, song.panjangBirama],
  )

  const frasaMenyala = frasaAktifSah(frasa, panjangBiramaLagu ?? song.panjangBirama)

  const daftarFrasaSegmen = useMemo(
    () => hitungRentangFrasaSegmen(song.tempoMap ?? [], batasMaksBirama ?? null),
    [song.tempoMap, batasMaksBirama],
  )

  // #13b — urai jadwal nada sesuai part yang sedang disaring (`filterIdAktif`)
  const jadwalNadaPartitur = useMemo(
    () =>
      teksXmlPartitur
        ? uraiJadwalNadaMusicXml(
            teksXmlPartitur,
            tandaFilterId === '__SEMUA__' ? null : tandaFilterId.split('\u0001'),
          )
        : null,
    [teksXmlPartitur, tandaFilterId],
  )

  const adaNadaUntukDibunyikan = (jadwalNadaPartitur?.nada.length ?? 0) > 0

  function hentikanBunyiNot() {
    pemutarNotRef.current?.henti()
    pemutarNotRef.current = null
    setSedangBunyiNot(false)
    setPosisiNot(null)
  }

  // Hentikan pemutar notasi saat komponen dilepas atau lagu berganti.
  useEffect(() => {
    return () => {
      pemutarNotRef.current?.henti()
      pemutarNotRef.current = null
    }
  }, [song.id])

  // Bila pemutar eksternal (metronom / rekaman) dinyalakan, hentikan bunyi notasi agar tidak bertabrakan.
  useEffect(() => {
    if (sedangMainLuar && sedangBunyiNot) {
      hentikanBunyiNot()
    }
  }, [sedangMainLuar, sedangBunyiNot])

  // Bila filter part diubah saat sedang membunyikan not, mulai ulang dengan part baru.
  useEffect(() => {
    if (!sedangBunyiNot || !jadwalNadaPartitur || jadwalNadaPartitur.nada.length === 0) return
    const pemutar = pemutarNotRef.current
    if (!pemutar) return
    const persen =
      tempoLatihan?.mode === 'bpm' && song.bpm > 0
        ? Math.round((Math.max(20, song.bpm + tempoLatihan.geser) / song.bpm) * 100)
        : (tempoLatihan?.persen ?? 100)
    const dari = frasaMenyala && frasa ? frasa.dari : Math.max(1, posisiNot?.birama ?? biramaAktifLuar)
    const sampai =
      frasaMenyala && frasa
        ? frasa.sampai
        : Math.max(dari, jadwalNadaPartitur.jumlahBirama)
    const hasilJadwal = jadwalkanDetikNada(jadwalNadaPartitur, {
      tempoMap: song.tempoMap,
      tempoDasar: song.bpm || meta?.tempo,
      persenTempo: persen,
      dariBirama: dari,
      sampaiBirama: sampai,
    })
    void pemutar.mulai({
      hasilJadwal,
      ulang: frasaMenyala,
      onPosisi: (b, k) => setPosisiNot({ birama: b, ketuk: k }),
      onSelesai: () => {
        setSedangBunyiNot(false)
        setPosisiNot(null)
      },
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tandaFilterId, tempoLatihan?.persen, tempoLatihan?.geser, tempoLatihan?.mode, frasaMenyala, frasa?.dari, frasa?.sampai])

  async function toggleBunyikanNot() {
    if (sedangBunyiNot) {
      hentikanBunyiNot()
      return
    }
    if (!jadwalNadaPartitur || jadwalNadaPartitur.nada.length === 0) return
    if (sedangMainLuar) {
      onToggleMain?.()
    }
    const pemutar = new PemutarNadaPartitur()
    pemutarNotRef.current = pemutar
    const persen =
      tempoLatihan?.mode === 'bpm' && song.bpm > 0
        ? Math.round((Math.max(20, song.bpm + tempoLatihan.geser) / song.bpm) * 100)
        : (tempoLatihan?.persen ?? 100)
    const maksBirama = Math.max(1, jadwalNadaPartitur.jumlahBirama)
    const dari =
      frasaMenyala && frasa
        ? Math.min(maksBirama, Math.max(1, frasa.dari))
        : biramaAktifLuar >= 1 && biramaAktifLuar <= maksBirama
          ? biramaAktifLuar
          : 1
    const sampai =
      frasaMenyala && frasa
        ? Math.min(maksBirama, Math.max(dari, frasa.sampai))
        : maksBirama
    const hasilJadwal = jadwalkanDetikNada(jadwalNadaPartitur, {
      tempoMap: song.tempoMap,
      tempoDasar: song.bpm || meta?.tempo,
      persenTempo: persen,
      dariBirama: dari,
      sampaiBirama: sampai,
    })
    setSedangBunyiNot(true)
    setPosisiNot({ birama: dari, ketuk: 0 })
    const ok = await pemutar.mulai({
      hasilJadwal,
      ulang: frasaMenyala,
      onPosisi: (b, k) => setPosisiNot({ birama: b, ketuk: k }),
      onSelesai: () => {
        setSedangBunyiNot(false)
        setPosisiNot(null)
      },
    })
    if (!ok) {
      hentikanBunyiNot()
    }
  }

  // 6. Auto-scroll pintar saat birama aktif berpindah keluar zona nyaman baca.
  useEffect(() => {
    if (
      !ikutiBirama ||
      sedangRender ||
      !kotakBiramaAktif ||
      kotakBiramaAktif.lebar <= 0
    ) {
      return
    }
    const kertas = kertasRef.current
    const pembungkus = pembungkusKanvasRef.current
    if (!kertas) return

    const geserX = pembungkus?.offsetLeft ?? 0
    const geserY = pembungkus?.offsetTop ?? 0
    const target = hitungTargetGulirBirama(
      {
        x: kotakBiramaAktif.x + geserX,
        y: kotakBiramaAktif.y + geserY,
        lebar: kotakBiramaAktif.lebar,
        tinggi: kotakBiramaAktif.tinggi,
      },
      {
        scrollTop: kertas.scrollTop,
        scrollLeft: kertas.scrollLeft,
        clientHeight: kertas.clientHeight,
        clientWidth: kertas.clientWidth,
      },
      tataLetak,
    )
    if (!target) return
    kertas.scrollTo({
      ...(typeof target.top === 'number' ? { top: target.top } : {}),
      ...(typeof target.left === 'number' ? { left: target.left } : {}),
      behavior: sedangMain ? 'smooth' : 'auto',
    })
  }, [biramaAktif, ikutiBirama, sedangRender, kotakBiramaAktif, tataLetak, sedangMain])

  function ubahZoom(nilaiBaru: number) {
    const jepit = jepitZoom(nilaiBaru)
    setZoom(jepit)
    simpanZoomPartitur(jepit)
  }

  function pilihFilter(baru: FilterPartitur) {
    setFilterAktif(baru)
    simpanFilterPartitur(kunciSimpanFilter, baru)
  }

  function terapkanRentangFrasa(dari: number, sampai: number, label?: string) {
    const rapi = susunFrasaTerurut(dari, sampai, 1, label)
    onUbahFrasa?.(rapi)
    onLoncatBirama?.(rapi.dari)
    setModePilihFrasa(false)
    setCalonAwalFrasa(null)
  }

  function tanganiKlikKanvas(e: MouseEvent<HTMLDivElement>) {
    if (sedangRender || daftarKotakBirama.length === 0) return
    const wadah = wadahSvgRef.current
    if (!wadah) return
    const rect = wadah.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const kena = cariBiramaDariTitikKlik(daftarKotakBirama, x, y)
    if (!kena) return

    const biramaAwalKotak = Math.max(1, kena.birama)
    const biramaAkhirKotak = kena.rentangMultiRest
      ? Math.max(biramaAwalKotak, kena.rentangMultiRest[1])
      : biramaAwalKotak

    if (onUbahFrasa && (modePilihFrasa || e.shiftKey)) {
      if (e.shiftKey && calonAwalFrasa == null) {
        const patokan = Math.max(1, frasa?.dari ?? biramaAktif ?? 1)
        const ujungKedua = biramaAwalKotak >= patokan ? biramaAkhirKotak : biramaAwalKotak
        terapkanRentangFrasa(patokan, ujungKedua)
        return
      }
      if (calonAwalFrasa == null) {
        setCalonAwalFrasa(biramaAwalKotak)
        onLoncatBirama?.(biramaAwalKotak)
        return
      }
      const ujungKedua = biramaAwalKotak >= calonAwalFrasa ? biramaAkhirKotak : biramaAwalKotak
      terapkanRentangFrasa(calonAwalFrasa, ujungKedua)
      return
    }

    onLoncatBirama?.(biramaAwalKotak)
  }

  function tanganiKlikSetDrill(s: InfoSetBirama, pakaiShift: boolean) {
    if (!onUbahFrasa) {
      onLoncatBirama?.(s.biramaDari)
      return
    }
    if (pakaiShift && setAwalTerpilih != null) {
      const gabung = gabungRentangSetKeBirama(daftarSetDrill, setAwalTerpilih, s.nomorSet)
      if (gabung) {
        terapkanRentangFrasa(
          gabung.biramaDari,
          gabung.biramaSampai,
          formatTautanSetBirama(gabung),
        )
        setSetAwalTerpilih(null)
        return
      }
    }
    setSetAwalTerpilih(s.nomorSet)
    terapkanRentangFrasa(
      s.biramaDari,
      s.biramaSampai,
      formatTautanSetBirama({
        setAwal: s.nomorSet,
        setAkhir: s.nomorSet,
        biramaDari: s.biramaDari,
        biramaSampai: s.biramaSampai,
      }),
    )
  }

  const teksInfoSesi = useMemo(() => {
    if (!infoSesi) return ''
    const arah = infoSesi.tataLetak === 'mendatar' ? 'mendatar' : 'halaman'
    const totalInst = infoSesi.instrumen.length
    const jumlahTampil = infoSesi.instrumen.filter((i) => i.tampil).length
    if (filterAktif.jenis === 'semua' || jumlahTampil >= totalInst) {
      return `${infoSesi.birama.length} birama · ${totalInst} part terender · Full score (${arah})`
    }
    return `${infoSesi.birama.length} birama · ${jumlahTampil}/${totalInst} part · ${filterAktif.label} (${arah})`
  }, [infoSesi, filterAktif])

  const sedangDiPartAnggota = samaFilterPartitur(filterAktif, pilihanAnggotaAwal.filter)
  const punyaPartAnggotaKhusus =
    Boolean(anggotaAktif) && pilihanAnggotaAwal.filter.jenis !== 'semua'

  const persenAktif =
    tempoLatihan?.mode === 'bpm' ? null : (tempoLatihan?.persen ?? 100)

  const bisaBunyiNot = tipe === 'musicxml' && adaNadaUntukDibunyikan
  const tampilkanBilahLatihan =
    Boolean(
      onToggleMain ||
        onUbahFrasa ||
        onLoncatBirama ||
        daftarSetDrill.length > 0 ||
        bisaBunyiNot,
    ) && Boolean(itemBerkas || meta)

  return (
    <>
      <div
        data-testid="layar-partitur"
        data-kiosk-allow
        style={{
          backgroundColor: layarPenuh ? '#0b1120' : '#0f172a',
          borderColor: '#1e293b',
          color: '#e2e8f0',
        }}
        className={cx(
          layarPenuh
            ? 'fixed inset-0 z-40 flex flex-col p-3 sm:p-5'
            : 'min-w-0 rounded-2xl border p-4 shadow-sm sm:p-5 lg:col-span-3',
        )}
      >
        {/* Bilah atas: judul, status render, dan kendali baca */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold" style={{ color: '#f1f5f9' }}>
              Lembar Partitur — {meta?.judul || song.title}
            </h2>
            <p className="mt-0.5 text-[11px]" style={{ color: '#94a3b8' }}>
              {memuatBerkas ? (
                'Membaca berkas dari penyimpanan lokal…'
              ) : tipe === 'pdf' ? (
                'Lembar PDF statis — tidak merender ulang per instrumen'
              ) : sedangRender ? (
                <span data-testid="partitur-progres">
                  {progres && progres.biramaTerender > 0
                    ? `Merender birama ${progres.biramaTerender}${progres.totalBirama > 0 ? ` / ${progres.totalBirama}` : ''}…`
                    : 'Memuat perender notasi & menyiapkan skor…'}
                </span>
              ) : infoSesi ? (
                <span data-testid="partitur-info-sesi">{teksInfoSesi}</span>
              ) : galatRender ? (
                'Partitur belum bisa ditampilkan'
              ) : (
                namaUnduh
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {tipe === 'musicxml' && itemBerkas && (
              <>
                <div
                  className="inline-flex items-center rounded-lg border px-1 py-0.5"
                  style={{ borderColor: '#334155', backgroundColor: '#020617' }}
                >
                  <button
                    type="button"
                    data-testid="partitur-zoom-kurang"
                    disabled={zoom <= ZOOM_MIN}
                    onClick={() => ubahZoom(zoom - ZOOM_LANGKAH)}
                    title="Perkecil tampilan notasi"
                    style={{ color: '#e2e8f0' }}
                    className="rounded px-2 py-0.5 text-xs font-bold disabled:opacity-40"
                  >
                    −
                  </button>
                  <button
                    type="button"
                    data-testid="partitur-zoom-nilai"
                    onClick={() => ubahZoom(ZOOM_BAWAAN)}
                    title="Kembalikan ke skala 100%"
                    style={{ color: '#cbd5e1' }}
                    className="px-1.5 py-0.5 text-[11px] font-medium tabular-nums"
                  >
                    {persenZoom}%
                  </button>
                  <button
                    type="button"
                    data-testid="partitur-zoom-tambah"
                    disabled={zoom >= ZOOM_MAKS}
                    onClick={() => ubahZoom(zoom + ZOOM_LANGKAH)}
                    title="Perbesar tampilan notasi"
                    style={{ color: '#e2e8f0' }}
                    className="rounded px-2 py-0.5 text-xs font-bold disabled:opacity-40"
                  >
                    +
                  </button>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  data-testid="partitur-tata-letak"
                  onClick={() => setTataLetak((s) => (s === 'vertikal' ? 'mendatar' : 'vertikal'))}
                  title="Ganti susunan halaman bertumpuk ke bawah atau satu baris mendatar"
                >
                  {tataLetak === 'vertikal' ? 'Tata letak: Halaman' : 'Tata letak: Mendatar'}
                </Button>

                {!galatRender && (
                  <Button
                    size="sm"
                    variant="primary"
                    data-testid="partitur-cetak-buka"
                    onClick={() => setCetakTerbuka(true)}
                    title="Pratinjau halaman kertas A4 / Lyre A5, cetak, atau unduh HTML mandiri"
                  >
                    <IconPrinter size={13} /> Cetak / HTML
                  </Button>
                )}
              </>
            )}

            {blobUrl && (
              <a
                href={blobUrl}
                download={namaUnduh}
                data-testid="partitur-unduh-asli"
                style={{
                  borderColor: '#334155',
                  backgroundColor: '#1e293b',
                  color: '#e2e8f0',
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium"
                title="Unduh berkas partitur asli dari penyimpanan lokal"
              >
                <IconDownload size={13} /> Unduh asli
              </a>
            )}

            <Button
              size="sm"
              variant="soft"
              data-testid="partitur-layar-penuh"
              onClick={() => setLayarPenuh((v) => !v)}
            >
              {layarPenuh ? 'Keluar layar penuh' : 'Layar penuh'}
            </Button>

            <Button
              size="sm"
              variant="ghost"
              data-testid="partitur-tutup"
              onClick={() => {
                setLayarPenuh(false)
                onTutup()
              }}
            >
              Tutup
            </Button>
          </div>
        </div>

        {/* #11c — Bilah penyaringan Full score / kelompok seksi / per part individu */}
        {tipe === 'musicxml' && itemBerkas && daftarPartSkor.length >= 1 && (
          <div
            data-testid="partitur-filter-bar"
            data-kiosk-allow
            style={{
              borderColor: '#1e293b',
              backgroundColor: '#020617',
              color: '#cbd5e1',
            }}
            className="mb-2.5 space-y-2 rounded-xl border p-2.5 text-xs"
          >
            {daftarPartSkor.length === 1 ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span style={{ color: '#cbd5e1' }}>
                  Part tunggal: <b style={{ color: '#f1f5f9' }}>{daftarPartSkor[0].nama}</b>
                </span>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="mr-0.5 text-[11px] font-medium" style={{ color: '#94a3b8' }}>
                    Tampilan:
                  </span>
                  <button
                    type="button"
                    data-testid="partitur-filter-semua"
                    onClick={() => pilihFilter({ jenis: 'semua' })}
                    style={
                      filterAktif.jenis === 'semua'
                        ? {
                            backgroundColor: '#059669',
                            borderColor: '#10b981',
                            color: '#ffffff',
                          }
                        : {
                            backgroundColor: '#0f172a',
                            borderColor: '#334155',
                            color: '#cbd5e1',
                          }
                    }
                    className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-medium"
                  >
                    Full score ({daftarPartSkor.length})
                  </button>

                  {daftarKelompok.map((kel) => {
                    const aktif =
                      filterAktif.jenis === 'kelompok' && filterAktif.kelompokId === kel.id
                    return (
                      <button
                        key={kel.id}
                        type="button"
                        data-testid={`partitur-filter-kelompok-${kel.id}`}
                        onClick={() =>
                          pilihFilter({
                            jenis: 'kelompok',
                            kelompokId: kel.id,
                            label: kel.label,
                            partIds: kel.partIds,
                          })
                        }
                        style={
                          aktif
                            ? {
                                backgroundColor: '#059669',
                                borderColor: '#10b981',
                                color: '#ffffff',
                              }
                            : {
                                backgroundColor: '#0f172a',
                                borderColor: '#334155',
                                color: '#cbd5e1',
                              }
                        }
                        className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium"
                      >
                        <span
                          aria-hidden="true"
                          style={{ backgroundColor: kel.warnaHex }}
                          className="inline-block h-2 w-2 rounded-full"
                        />
                        {kel.label} ({kel.partIds.length})
                      </button>
                    )
                  })}
                </div>

                <label className="inline-flex items-center gap-1.5">
                  <span className="text-[11px]" style={{ color: '#94a3b8' }}>
                    Part:
                  </span>
                  <select
                    data-testid="partitur-pilih-part"
                    aria-label="Pilih 1 part spesifik"
                    value={filterAktif.jenis === 'part' ? filterAktif.partId : ''}
                    onChange={(e) => {
                      const idDipilih = e.target.value
                      if (!idDipilih) {
                        pilihFilter({ jenis: 'semua' })
                        return
                      }
                      const p = daftarPartSkor.find((x) => x.id === idDipilih)
                      if (p) {
                        pilihFilter({ jenis: 'part', partId: p.id, label: p.nama })
                      }
                    }}
                    style={{
                      borderColor: '#334155',
                      backgroundColor: '#0f172a',
                      color: '#f1f5f9',
                    }}
                    className="max-w-[230px] rounded-lg border px-2 py-1 text-[11px]"
                  >
                    <option value="">— Pilih 1 part spesifik —</option>
                    {daftarPartSkor.map((p, idx) => (
                      <option key={p.id} value={p.id}>
                        {idx + 1}. {p.nama}
                        {p.singkatan ? ` (${p.singkatan})` : ''}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}

            {/* Keterangan cerdas untuk anggota aktif (hanya saat identitas dipilih) */}
            {anggotaAktif && pilihanAnggotaAwal.keterangan && (
              <div
                data-testid="partitur-info-anggota"
                style={{
                  borderColor: '#065f46',
                  backgroundColor: '#022c22',
                  color: '#a7f3d0',
                }}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-[11px]"
              >
                <span>
                  <b style={{ color: '#ecfdf5' }}>
                    {anggotaAktif.panggilan || anggotaAktif.name}:
                  </b>{' '}
                  {sedangDiPartAnggota
                    ? pilihanAnggotaAwal.keterangan
                    : `Sedang melihat tampilan pilihan manual (${
                        filterAktif.jenis === 'semua' ? 'Full score' : filterAktif.label
                      }).`}
                </span>
                {punyaPartAnggotaKhusus && !sedangDiPartAnggota && (
                  <button
                    type="button"
                    data-testid="partitur-ke-part-saya"
                    onClick={() => pilihFilter(pilihanAnggotaAwal.filter)}
                    style={{
                      backgroundColor: '#059669',
                      color: '#ffffff',
                    }}
                    className="rounded-md px-2 py-0.5 text-[11px] font-medium"
                  >
                    Ke part saya ({pilihanAnggotaAwal.filter.jenis === 'semua' ? 'Full score' : pilihanAnggotaAwal.filter.label})
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* #11d — Bilah putar langsung, sorot birama aktif, pilih/loop frasa, & tautan set drill (murni hex) */}
        {tampilkanBilahLatihan && (
          <div
            data-testid="partitur-bilah-frasa"
            data-kiosk-allow
            style={{
              borderColor: '#1e293b',
              backgroundColor: '#020617',
              color: '#cbd5e1',
            }}
            className="mb-3 space-y-2 rounded-xl border p-2.5 text-xs"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {onToggleMain && (
                  <button
                    type="button"
                    data-testid="partitur-tombol-putar"
                    onClick={onToggleMain}
                    style={
                      sedangMainLuar
                        ? {
                            backgroundColor: '#be123c',
                            borderColor: '#e11d48',
                            color: '#ffffff',
                          }
                        : {
                            backgroundColor: '#059669',
                            borderColor: '#10b981',
                            color: '#ffffff',
                          }
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold"
                  >
                    {sedangMainLuar ? <IconPause size={12} /> : <IconPlay size={12} />}
                    {sedangMainLuar ? 'Berhenti' : labelKonteksPutar ? `Putar ${labelKonteksPutar}` : 'Putar'}
                  </button>
                )}

                {bisaBunyiNot && (
                  <button
                    type="button"
                    data-testid="partitur-bunyikan-not"
                    data-kiosk-allow
                    onClick={() => void toggleBunyikanNot()}
                    title="Bunyikan notasi suara yang sedang tampil dengan sintesis WebAudio (mengikuti tempo latihan & frasa)"
                    style={
                      sedangBunyiNot
                        ? {
                            backgroundColor: '#be123c',
                            borderColor: '#e11d48',
                            color: '#ffffff',
                          }
                        : {
                            backgroundColor: '#0f766e',
                            borderColor: '#14b8a6',
                            color: '#ffffff',
                          }
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold"
                  >
                    {sedangBunyiNot ? <IconPause size={12} /> : <IconMusic size={12} />}
                    {sedangBunyiNot ? 'Hentikan not' : 'Bunyikan not'}
                  </button>
                )}

                <span
                  data-testid="partitur-indikator-birama"
                  style={
                    sedangMain && tahapKetuk === 'hitung'
                      ? {
                          borderColor: '#b45309',
                          backgroundColor: '#451a03',
                          color: '#fde68a',
                        }
                      : sedangMain
                        ? {
                            borderColor: '#059669',
                            backgroundColor: '#022c22',
                            color: '#a7f3d0',
                          }
                        : {
                            borderColor: '#334155',
                            backgroundColor: '#0f172a',
                            color: '#e2e8f0',
                          }
                  }
                  className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold tabular-nums"
                >
                  {sedangMain && tahapKetuk === 'hitung'
                    ? `Hitung mundur → Bar ${biramaAktif}`
                    : `Bar ${biramaAktif}${
                        sedangMain && ketukAktif != null ? ` · Ketuk ${ketukAktif + 1}` : ''
                      }${
                        kotakBiramaAktif?.rentangMultiRest
                          ? ` (istirahat ${kotakBiramaAktif.rentangMultiRest[0]}–${kotakBiramaAktif.rentangMultiRest[1]})`
                          : ''
                      }`}
                </span>

                {lencanaFrasa && (
                  <span
                    data-testid="partitur-lencana-frasa"
                    style={{
                      borderColor: '#d97706',
                      backgroundColor: '#451a03',
                      color: '#fde68a',
                    }}
                    className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tabular-nums"
                  >
                    <IconLoop size={11} />
                    {lencanaFrasa}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {tipe === 'musicxml' && itemBerkas && onUbahFrasa && (
                  <button
                    type="button"
                    data-testid="partitur-mode-pilih-frasa"
                    onClick={() => {
                      setModePilihFrasa((v) => !v)
                      setCalonAwalFrasa(null)
                    }}
                    title="Ketuk birama awal lalu birama akhir pada partitur (atau tahan Shift + Klik)"
                    style={
                      modePilihFrasa
                        ? {
                            backgroundColor: '#0284c7',
                            borderColor: '#38bdf8',
                            color: '#ffffff',
                          }
                        : {
                            backgroundColor: '#0f172a',
                            borderColor: '#334155',
                            color: '#cbd5e1',
                          }
                    }
                    className="rounded-lg border px-2 py-1 text-[11px] font-medium"
                  >
                    {modePilihFrasa
                      ? calonAwalFrasa != null
                        ? `Pilih akhir (awal: Bar ${calonAwalFrasa})…`
                        : 'Ketuk birama awal…'
                      : 'Pilih frasa di partitur'}
                  </button>
                )}

                {onUbahFrasa && (
                  <div
                    className="inline-flex items-center gap-1 rounded-lg border px-2 py-0.5"
                    style={{ borderColor: '#334155', backgroundColor: '#0f172a' }}
                  >
                    <span className="text-[11px]" style={{ color: '#94a3b8' }}>
                      Bar
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={batasMaksBirama}
                      aria-label="Frasa dari birama"
                      data-testid="partitur-frasa-dari"
                      value={frasa?.dari ?? ''}
                      placeholder="1"
                      onChange={(e) =>
                        onUbahFrasa({
                          dari: Math.max(1, Math.floor(Number(e.target.value) || 1)),
                        })
                      }
                      style={{
                        borderColor: '#334155',
                        backgroundColor: '#020617',
                        color: '#f1f5f9',
                      }}
                      className="w-12 rounded border px-1.5 py-0.5 text-center text-[11px] tabular-nums"
                    />
                    <span style={{ color: '#64748b' }}>–</span>
                    <input
                      type="number"
                      min={1}
                      max={batasMaksBirama}
                      aria-label="Frasa sampai birama"
                      data-testid="partitur-frasa-sampai"
                      value={frasa?.sampai ?? ''}
                      placeholder="4"
                      onChange={(e) =>
                        onUbahFrasa({
                          sampai: Math.max(1, Math.floor(Number(e.target.value) || 1)),
                        })
                      }
                      style={{
                        borderColor: '#334155',
                        backgroundColor: '#020617',
                        color: '#f1f5f9',
                      }}
                      className="w-12 rounded border px-1.5 py-0.5 text-center text-[11px] tabular-nums"
                    />
                    <button
                      type="button"
                      data-testid="partitur-toggle-ulang"
                      onClick={() =>
                        onUbahFrasa({
                          dari: frasa?.dari ?? 1,
                          sampai: frasa?.sampai ?? Math.min(4, batasMaksBirama ?? 4),
                          aktif: frasaMenyala ? 0 : 1,
                        })
                      }
                      style={
                        frasaMenyala
                          ? {
                              backgroundColor: '#d97706',
                              borderColor: '#f59e0b',
                              color: '#ffffff',
                            }
                          : {
                              backgroundColor: '#1e293b',
                              borderColor: '#475569',
                              color: '#cbd5e1',
                            }
                      }
                      className="inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-medium"
                    >
                      <IconLoop size={11} />
                      {frasaMenyala ? 'Mengulang' : 'Ulang frasa'}
                    </button>
                    {frasa && onHapusFrasa && (
                      <button
                        type="button"
                        data-testid="partitur-hapus-frasa"
                        onClick={() => {
                          setModePilihFrasa(false)
                          setCalonAwalFrasa(null)
                          onHapusFrasa()
                        }}
                        title="Hapus pilihan frasa pada perangkat ini"
                        style={{ color: '#94a3b8' }}
                        className="px-1 text-[11px] font-medium"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                )}

                {onAturPersenTempo && (
                  <div
                    className="inline-flex items-center gap-0.5 rounded-lg border px-1 py-0.5"
                    style={{ borderColor: '#334155', backgroundColor: '#0f172a' }}
                  >
                    {PILIHAN_PERSEN_CEPAT.map((p) => {
                      const dipilih = persenAktif === p
                      return (
                        <button
                          key={p}
                          type="button"
                          data-testid={`partitur-tempo-${p}`}
                          onClick={() => onAturPersenTempo(p)}
                          style={
                            dipilih
                              ? {
                                  backgroundColor: p === 100 ? '#334155' : '#b45309',
                                  color: '#ffffff',
                                }
                              : {
                                  backgroundColor: 'transparent',
                                  color: '#94a3b8',
                                }
                          }
                          className="rounded px-1.5 py-0.5 text-[11px] font-medium tabular-nums"
                        >
                          {p}%
                        </button>
                      )
                    })}
                  </div>
                )}

                {tipe === 'musicxml' && itemBerkas && (
                  <button
                    type="button"
                    data-testid="partitur-ikuti-birama"
                    onClick={() => setIkutiBirama((v) => !v)}
                    title="Gulir halaman otomatis mengikuti birama yang sedang berbunyi"
                    style={
                      ikutiBirama
                        ? {
                            backgroundColor: '#022c22',
                            borderColor: '#059669',
                            color: '#a7f3d0',
                          }
                        : {
                            backgroundColor: '#0f172a',
                            borderColor: '#334155',
                            color: '#94a3b8',
                          }
                    }
                    className="rounded-lg border px-2 py-1 text-[11px] font-medium"
                  >
                    {ikutiBirama ? 'Ikuti birama: Hidup' : 'Ikuti birama: Mati'}
                  </button>
                )}
              </div>
            </div>

            {/* Keping segmen lagu & keping set drill (Set A–B = Bar X–Y) */}
            {(daftarFrasaSegmen.length > 0 || daftarSetDrill.length > 0) && (
              <div
                style={{ borderColor: '#1e293b' }}
                className="flex flex-wrap items-center gap-1.5 border-t pt-2"
              >
                {daftarFrasaSegmen.length > 0 && onUbahFrasa && (
                  <>
                    <span className="text-[10px] font-medium" style={{ color: '#64748b' }}>
                      Segmen:
                    </span>
                    {daftarFrasaSegmen.map((seg) => {
                      const cocok =
                        frasaMenyala && frasa?.dari === seg.dari && frasa?.sampai === seg.sampai
                      return (
                        <button
                          key={seg.id}
                          type="button"
                          data-testid={`partitur-chip-segmen-${seg.id}`}
                          onClick={() => terapkanRentangFrasa(seg.dari, seg.sampai, seg.label)}
                          style={
                            cocok
                              ? {
                                  backgroundColor: '#b45309',
                                  borderColor: '#f59e0b',
                                  color: '#ffffff',
                                }
                              : {
                                  backgroundColor: '#0f172a',
                                  borderColor: '#334155',
                                  color: '#cbd5e1',
                                }
                          }
                          className="rounded-md border px-2 py-0.5 text-[10px] font-medium tabular-nums"
                        >
                          {seg.label} (Bar {seg.dari}–{seg.sampai})
                        </button>
                      )
                    })}
                  </>
                )}

                {daftarSetDrill.length > 0 && (
                  <>
                    <span
                      className="ml-1 text-[10px] font-medium"
                      style={{ color: '#64748b' }}
                      title="Klik satu set untuk melatih biramanya, atau tahan Shift + Klik set kedua untuk merangkai rentang set"
                    >
                      Set drill:
                    </span>
                    {daftarSetDrill.map((s) => {
                      const diDalamBiramaAktif =
                        biramaAktif >= s.biramaDari && biramaAktif <= s.biramaSampai
                      const cocokFrasa =
                        frasaMenyala &&
                        frasa != null &&
                        s.biramaDari >= frasa.dari &&
                        s.biramaSampai <= frasa.sampai
                      return (
                        <button
                          key={s.index}
                          type="button"
                          data-testid={`partitur-chip-set-${s.nomorSet}`}
                          onClick={(e) => tanganiKlikSetDrill(s, e.shiftKey)}
                          title={`${s.nama} (${s.counts} hitungan) — Shift+Klik untuk merangkai rentang set`}
                          style={
                            cocokFrasa
                              ? {
                                  backgroundColor: '#b45309',
                                  borderColor: '#f59e0b',
                                  color: '#ffffff',
                                }
                              : diDalamBiramaAktif
                                ? {
                                    backgroundColor: '#022c22',
                                    borderColor: '#059669',
                                    color: '#a7f3d0',
                                  }
                                : {
                                    backgroundColor: '#0f172a',
                                    borderColor: '#334155',
                                    color: '#cbd5e1',
                                  }
                          }
                          className="rounded-md border px-2 py-0.5 text-[10px] font-medium tabular-nums"
                        >
                          Set {s.nomorSet} · Bar{' '}
                          {s.biramaDari === s.biramaSampai
                            ? s.biramaDari
                            : `${s.biramaDari}–${s.biramaSampai}`}
                        </button>
                      )
                    })}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Isi utama berdasarkan ketersediaan & jenis berkas */}
        {!memuatBerkas && !itemBerkas && (
          <div
            data-testid="partitur-berkas-kosong"
            style={{ borderColor: '#0369a1', backgroundColor: '#082f49', color: '#e0f2fe' }}
            className="rounded-xl border p-4 text-xs leading-relaxed"
          >
            Berkas partitur untuk lagu ini belum tersimpan di perangkat ini. Pasang berkasnya lewat panel Partitur di
            kartu Repertoar terlebih dahulu (latihan frasa di atas tetap dapat dipakai mengikuti peta tempo lagu).
          </div>
        )}

        {itemBerkas && tipe === 'musicxml' && (
          <div className={cx('flex flex-col gap-3', layarPenuh && 'min-h-0 flex-1')}>
            {galatRender && (
              <div
                data-testid="partitur-render-galat"
                style={{ borderColor: '#b45309', backgroundColor: '#451a03', color: '#fef3c7' }}
                className="rounded-xl border p-3.5 text-xs leading-relaxed"
              >
                <p className="font-semibold">Notasi belum bisa digambar dari berkas ini</p>
                <p className="mt-1">{galatRender}</p>
                <p className="mt-1.5 text-[11px]" style={{ color: '#fcd34d' }}>
                  Berkas aslinya tetap aman di perangkat ini — tekan tombol <b>Unduh asli</b> di atas bila ingin
                  membukanya di MuseScore/Sibelius/Finale lalu mengekspornya kembali.
                </p>
              </div>
            )}

            <div
              ref={kertasRef}
              data-testid="partitur-kertas"
              style={{
                backgroundColor: WARNA_PARTITUR_HEX.kertas,
                color: WARNA_PARTITUR_HEX.tinta,
                borderColor: '#cbd5e1',
              }}
              className={cx(
                'overflow-auto rounded-xl border p-3 sm:p-5',
                layarPenuh ? 'min-h-0 flex-1' : 'max-h-[75vh]',
                galatRender && 'hidden',
              )}
            >
              <div
                ref={pembungkusKanvasRef}
                data-testid="partitur-pembungkus-kanvas"
                onClick={tanganiKlikKanvas}
                className={cx(
                  'relative',
                  tataLetak === 'mendatar' ? 'min-w-max' : 'w-full min-w-[300px]',
                  (onLoncatBirama || onUbahFrasa) && 'cursor-pointer',
                )}
              >
                <div
                  ref={wadahSvgRef}
                  data-testid="partitur-kanvas-svg"
                  className={cx(tataLetak === 'mendatar' ? 'min-w-max' : 'w-full min-w-[300px]')}
                />

                {/* Pita sorot rentang frasa terpilih (murni hex/rgba, nol oklch/color-mix) */}
                {!sedangRender &&
                  pitaSorotFrasa.map((pita, idx) => (
                    <div
                      key={`sorot-frasa-${idx}`}
                      data-testid="partitur-sorot-frasa"
                      data-frasa-rentang={frasa ? `${frasa.dari}-${frasa.sampai}` : ''}
                      aria-hidden="true"
                      style={{
                        position: 'absolute',
                        left: `${pita.x}px`,
                        top: `${pita.y}px`,
                        width: `${pita.lebar}px`,
                        height: `${pita.tinggi}px`,
                        backgroundColor: WARNA_SOROT_PARTITUR_HEX.frasaLatar,
                        border: `1.5px dashed ${WARNA_SOROT_PARTITUR_HEX.frasaTepi}`,
                        borderRadius: '6px',
                        pointerEvents: 'none',
                      }}
                    />
                  ))}

                {/* Sorot birama awal saat pengguna sedang memilih frasa 2-ketuk */}
                {!sedangRender && kotakCalonAwal && kotakCalonAwal.lebar > 0 && (
                  <div
                    data-testid="partitur-sorot-calon-awal"
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      left: `${kotakCalonAwal.x}px`,
                      top: `${kotakCalonAwal.y}px`,
                      width: `${kotakCalonAwal.lebar}px`,
                      height: `${kotakCalonAwal.tinggi}px`,
                      backgroundColor: WARNA_SOROT_PARTITUR_HEX.calonAwalLatar,
                      border: `2px dashed ${WARNA_SOROT_PARTITUR_HEX.calonAwalTepi}`,
                      borderRadius: '6px',
                      pointerEvents: 'none',
                    }}
                  />
                )}

                {/* Sorot birama aktif sinkron TempoTimeline (metronom / rekaman / drill) */}
                {!sedangRender && kotakBiramaAktif && kotakBiramaAktif.lebar > 0 && (
                  <div
                    data-testid="partitur-sorot-aktif"
                    data-birama-aktif={String(biramaAktif)}
                    data-birama-kotak={String(kotakBiramaAktif.birama)}
                    data-multirest={
                      kotakBiramaAktif.rentangMultiRest
                        ? `${kotakBiramaAktif.rentangMultiRest[0]}-${kotakBiramaAktif.rentangMultiRest[1]}`
                        : undefined
                    }
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      left: `${kotakBiramaAktif.x}px`,
                      top: `${kotakBiramaAktif.y}px`,
                      width: `${kotakBiramaAktif.lebar}px`,
                      height: `${kotakBiramaAktif.tinggi}px`,
                      backgroundColor:
                        tahapKetuk === 'hitung'
                          ? WARNA_SOROT_PARTITUR_HEX.hitungLatar
                          : WARNA_SOROT_PARTITUR_HEX.aktifLatar,
                      border: `2px solid ${
                        tahapKetuk === 'hitung'
                          ? WARNA_SOROT_PARTITUR_HEX.hitungTepi
                          : WARNA_SOROT_PARTITUR_HEX.aktifTepi
                      }`,
                      borderRadius: '6px',
                      pointerEvents: 'none',
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {itemBerkas && tipe === 'pdf' && blobUrl && (
          <div className={cx('flex flex-col gap-2.5', layarPenuh && 'min-h-0 flex-1')}>
            <div
              style={{ borderColor: '#334155', backgroundColor: '#020617', color: '#cbd5e1' }}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-2.5 text-[11px]"
            >
              <span>
                Berkas PDF berupa lembaran tetap (penyaringan per instrumen & sorot notasi khusus MusicXML/MXL, namun
                pengulangan frasa di bilah atas tetap berjalan penuh). Di peramban HP yang tidak menampilkan bingkai di
                bawah, gunakan tombol di samping untuk membuka atau mencetak PDF.
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={blobUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="partitur-pdf-buka"
                  style={{ backgroundColor: '#059669', color: '#ffffff' }}
                  className="inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-medium"
                >
                  Buka di tab baru
                </a>
                <a
                  href={blobUrl}
                  download={namaUnduh}
                  data-testid="partitur-pdf-unduh"
                  style={{ borderColor: '#475569', backgroundColor: '#1e293b', color: '#e2e8f0' }}
                  className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium"
                >
                  <IconDownload size={12} /> Unduh PDF
                </a>
              </div>
            </div>

            <iframe
              data-testid="partitur-pdf-bingkai"
              src={blobUrl}
              title={`Partitur PDF ${song.title}`}
              style={{ backgroundColor: '#ffffff', borderColor: '#334155' }}
              className={cx('w-full rounded-xl border', layarPenuh ? 'min-h-0 flex-1' : 'h-[72vh]')}
            />
          </div>
        )}
      </div>

      {itemBerkas && tipe === 'musicxml' && (
        <PratinjauCetakPartitur
          open={cetakTerbuka}
          onClose={() => setCetakTerbuka(false)}
          song={song}
          sumber={itemBerkas.blob}
          daftarPart={daftarPartSkor}
          sectionsTim={sectionsTim}
          filterAwal={filterAktif}
          namaTim={namaTim}
        />
      )}
    </>
  )
}
