/**
 * Diekstrak dari `src/pages/Drill.tsx` (#5 — pecah Drill.tsx).
 * Isinya tidak diubah; hanya alamat impor yang disesuaikan.
 */

/** Editor formasi — kanvas titik, set, animasi, dan semua modalnya. */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { DEFAULT_FIELD, db } from '../db/db'
import type {
  BentukTerikat,
  Drill,
  DrillPoint,
  DrillSet,
  Facing,
  FieldMarker,
  GerakSet,
  InstruksiVisualSet,
  Member,
  TimpaanTampilanTag,
  TitikKendaliYd,
  TitikSinggahMidset,
} from '../db/types'
import {
  Button,
  Card,
  ConfirmButton,
  Input,
  Select,
  Textarea,
  Toggle,
  useToast,
} from './ui'
import { JEDA_OTOMATIS_MS, foto, terakhirDipotret } from '../lib/riwayat'
import {
  IconDownload,
  IconExpand,
  IconPause,
  IconPlay,
  IconPlus,
  IconPrinter,
  IconTrash,
  IconCopy,
} from './Icons'
import { FieldSurface } from './FieldSurface'
import { NamaTampil } from './NamaTampil'
import { MarkerLayer, PenandaPanel, butuhDuaTitik } from './FieldMarkers'
import { DrillPresenter } from './DrillPresenter'
import { useTempoLatihan } from '../hooks/useTempoLatihan'
import { labelLatihan, latihanAktif, lajuRekaman, terapkanLatihan } from '../lib/tempoLatihan'

import {
  apakahModeParade,
  coordText as coorTextSafe,
  facingDeg,
  stepYd,
  ukurTitik,
} from '../lib/field'
import {
  ambangEfektif,
  TINGKAT_WARNA,
  analisisPerpindahan,
  rasioLengkung,
  setTerberat,
} from '../lib/analitik'
import {
  pusatKumpulan,
  skalaTitik,
} from '../lib/massa'
import {
  OPSI_BENTUK_BAWAAN,
  buatBentukTerikatDariOpsi,
  bulatkanKoordinatSumbu,
  cerminBentukTerikat,
  cerminTitikFormasi,
  geserBentukTerikat,
  hitungTitikBentukTerikat,
  jepitKeLapangan,
  kotakBatasTitik,
  lepaskanAnggotaDariBentuk,
  pasangBentukTerikatPadaSet,
  pilihTitikDenganLasso,
  putarBebasTitik,
  putarBentukTerikat,
  rentangTitikKotakBatas,
  sampelGarisBentukUntukSvg,
  skalaBentukTerikat,
  susunBentukCepat,
  terapkanKunciSumbu,
  type KotakBatasYd,
  type LangkahBulat,
  type ModeKunciSumbu,
  type OpsiBentukCepat,
  type OpsiPembulatanSumbu,
  type SudutGagangSkala,
} from '../lib/bentukFormasi'
import { apakahPropertiBergerak, penandaEfektifPadaSet } from '../lib/propertiGerak'
import {
  bersihkanSetIdCountSheet,
  sinkronkanCountSheetSaatPecahSet,
} from '../lib/countSheet'
import type { PropsModalCountSheet } from './drill/ModalCountSheet'
import type { ModalParadeProps } from './drill/ModalParade'
import {
  type GerakLengkap,
  bangunPetaFtl,
  cocokPutaran,
  countEfektifPemain,
  deltaBusur,
  deltaMidsets,
  deltaPoliFtl,
  gerakOf,
  kelompokPemain,
  normalisasiMidsetsPemain,
  panjangJalurMidsets,
  pathPoliFtl,
  progresPemain,
  sinkronkanKelompokDariTag,
  titikJalur,
  turunkanPusatAkhir,
} from '../lib/gerak'
import {
  gayaTitikPemain,
  kumpulkanTagRoster,
  lepasTagDariAnggota,
  pasangTagKeAnggota,
  punyaTag,
} from '../lib/tagAnggota'
import {
  AMBANG_GESER_PX,
  DURASI_TEKAN_LAMA_MS,
  VIEWPORT_AWAL,
  aksiSeretKanvasKosong,
  hitungCubitDuaJari,
  hitungRadiusTangkapSvg,
  hitungViewBoxKanvas,
  jepitViewport,
  peranPointerEfektif,
  zoomSekitarTitik,
  type AlatKanvas,
  type ModeInputKanvas,
  type PeranPointer,
  type ViewportKanvas,
} from '../lib/mesinPointer'
import { lengkapiReferensiPintasan, type ItemPaletPerintah } from '../lib/paletPerintah'
import {
  cariSaranTukarSilang,
  periksaKerataanSpasi,
  periksaTabrakanSet,
  ratakanSpasiBarisan,
  selesaikanSemuaSilang2Opt,
  terapkanTukarTujuan,
  tukarAnggotaPadaBentukTerikat,
  type KejadianTabrakan,
  type SaranTukarSilang,
  type TemuanKerataanSpasi,
} from '../lib/tabrakanDrill'
import { DAFTAR_SHORTCUT } from '../lib/shortcut'
import { PenggarisMusikDrill } from './drill/PenggarisMusikDrill'
import { PanelAnalitikGerak } from './drill/PanelAnalitikGerak'
import { PanelAlatFormasi } from './drill/PanelAlatFormasi'
import { PanelGerakSet } from './drill/PanelGerakSet'
import { downloadHtmlFile, esc, printHtml, printShell } from '../lib/print'
import { Metronom, klikUntukDrill } from '../lib/metronome'
import { PemutarRekaman } from '../lib/rekaman'
import { dariBeatsLama, labelBirama } from '../lib/birama'
import { daftarTempo, petakanSetKeMusik, tempoSet } from '../lib/gabungMusik'
// #5 sisa — penggaris drill × segmen lagu, bantuan hitungan, pecah/gabung set.
import { bantuanSet, gabungGerak, petaPenggaris, pecahSet } from '../lib/segmenDrill'
// #11d — sorot birama partitur pendamping sinkron animasi/scrubber drill.
import { biramaPadaProgresSet, hitungPetaSetKeBirama, hitunganPadaBirama } from '../lib/partiturFrasa'
import { useFrasaLatihan } from '../hooks/useFrasaLatihan'
import { LayarPartitur } from './LayarPartitur'
import { hapusTandaSet } from '../lib/kemajuan'
import {
  cx,
  downloadFile,
  sectionDot,
  sectionLabel,
  slugify,
  toCSV,
  uid,
  visibleSections,
} from '../lib/utils'
import { useSettings } from '../hooks/useSettings'
import CopySetModal from './CopySetModal'
import TukarCsvModal from './TukarCsv'
import ImporPywareModal from './ImporPyware'
import { intipTitipan } from './BukaBerkas'
import { Jejak, TapakLangkah, TitikPemainBentuk } from './JejakLangkah'
import type { BusurGambar } from './JejakLangkah'
import { PointInspector } from './PointInspector'
import { PerformerDetailModal } from './PerformerDetailModal'
import { DotSheetModal } from './DotSheetModal'
import { DrillSettingsModal } from './DrillSettingsModal'
import { PaletPerintah } from './PaletPerintah'

/* ========================================================================== */
/*  Editor                                                                     */
/* ========================================================================== */

type Tool = AlatKanvas

/**
 * Pengaturan tampilan editor (A5: jejak gerakan & panah arah).
 * Disimpan di `localStorage` supaya pilihanmu tidak hilang tiap kali halaman
 * dimuat ulang — ditulis/dibaca dengan try/catch karena localStorage bisa
 * diblokir browser (mode penyamaran, iframe).
 */
const KUNCI_TAMPILAN = 'drillkit.drillView'
type Tampilan = {
  /** Geser titik otomatis menempel ke grid langkah. */
  snap: boolean
  /** Jejak dari set aktif ke set berikutnya. */
  jalur: boolean
  /** Jejak dari set sebelumnya ke set aktif. */
  masuk: boolean
  /** Panah arah di ujung jejak. */
  panah: boolean
  /** Lingkaran putus-putus di posisi asal/tujuan. */
  hantu: boolean
  /** Angka jarak tempuh (langkah) di tengah jejak. */
  jarak: boolean
  /** Kode pemain di sebelah titik. */
  kode: boolean
  /** A7 — penanda bebas di lapangan (properti, bendera, garis bantu). */
  penanda: boolean
  /** B2 — pengali kecepatan animasi (1 = sesuai tempo). */
  cepat: number
  /** B2 — mengulang perpindahan ini terus-menerus. */
  ulang: boolean
  /** DD3 — warnai jejak menurut kesulitan gerakan (peta kesulitan). */
  analitik: boolean
  /** B5 — klik tempo menyertai animasi & urutan latihan. */
  klik: boolean
  /** DD9 — tapak langkah: satu tanda di sepanjang jejak tiap satu langkah. */
  tapak: boolean
  /** DD9 — garis waktu melangkah per hitungan, bukan geser bebas. */
  perHitungan: boolean
  /** #22.4 — pengunci sumbu gerak saat menggeser titik/gagang. */
  kunciSumbu: ModeKunciSumbu
  /** #22.4 — resolusi pembulatan langkah mandiri pada sumbu X & Y. */
  langkahX: LangkahBulat
  langkahY: LangkahBulat
  /** #23.3 — mode input pointer kanvas (`otomatis`, `sentuh`, `tetikus`). */
  modeInput: ModeInputKanvas
}
const TAMPILAN_AWAL: Tampilan = {
  snap: true,
  jalur: true,
  masuk: true,
  panah: true,
  hantu: false,
  jarak: false,
  kode: true,
  penanda: true,
  cepat: 1,
  ulang: false,
  klik: false,
  analitik: false,
  tapak: false,
  perHitungan: true,
  kunciSumbu: 'bebas',
  langkahX: 1,
  langkahY: 1,
  modeInput: 'otomatis',
}

function bacaTampilan(): Tampilan {
  try {
    return { ...TAMPILAN_AWAL, ...(JSON.parse(localStorage.getItem(KUNCI_TAMPILAN) ?? '{}') as Partial<Tampilan>) }
  } catch {
    return TAMPILAN_AWAL
  }
}

function simpanTampilan(v: Tampilan) {
  try {
    localStorage.setItem(KUNCI_TAMPILAN, JSON.stringify(v))
  } catch {
    /* abaikan */
  }
}

export function Editor({
  drill,
  sets,
  members,
  onGantiDrill,
}: {
  drill: Drill
  sets: DrillSet[]
  members: Member[]
  /** F3 — dipakai untuk pindah ke show hasil impor (kalau disalin sebagai show baru). */
  onGantiDrill?: (id: string) => void
}) {
  const toast = useToast()
  /** F3 — nama tim dipakai sebagai penanda asal berkas show. */
  const settings = useSettings()
  const [idx, setIdx] = useState(0)
  const [selected, setSelected] = useState<string[]>([])
  const [tool, setTool] = useState<Tool>('select')
  const [view, setView] = useState<Tampilan>(bacaTampilan)
  /** Ubah satu pengaturan tampilan, lalu simpan ke localStorage. */
  /** Ubah satu pengaturan tampilan lalu simpan (boolean & angka — B2). */
  const ubah = <K extends keyof Tampilan>(k: K, v: Tampilan[K]) =>
    setView((s) => {
      const baru = { ...s, [k]: v }
      simpanTampilan(baru)
      return baru
    })
  // Nama pendek supaya kode di bawah tetap enak dibaca.
  const snap = view.snap
  const [sectionFilter, setSectionFilter] = useState<string>('all')
  const [settingsOpen, setSettingsOpen] = useState(false)
  /** DD7 — jendela tukar formasi lewat CSV. */
  const [tukarCsv, setTukarCsv] = useState(false)
  /** #10 — jendela impor drill Pyware (CSV lembar koordinat). */
  const [imporPyware, setImporPyware] = useState(false)
  /** #17 — jendela Count Sheet Color Guard (dimuat malas sebelum dibuka). */
  const [countSheetOpen, setCountSheetOpen] = useState(false)
  const [KompModalCountSheet, setKompModalCountSheet] = useState<React.ComponentType<PropsModalCountSheet> | null>(null)
  const countSheetsDrill = useLiveQuery(
    () => db.countSheets.where('drillId').equals(drill.id).toArray(),
    [drill.id],
    [],
  )

  async function bukaCountSheet() {
    if (!KompModalCountSheet) {
      const mod = await import('./drill/ModalCountSheet')
      setKompModalCountSheet(() => mod.default)
    }
    setCountSheetOpen(true)
  }

  /** #19 — jendela Studio Mode Kirab / Street Parade (dimuat malas saat dibuka). */
  const [paradeOpen, setParadeOpen] = useState(false)
  const [KompModalParade, setKompModalParade] = useState<React.ComponentType<ModalParadeProps> | null>(null)

  async function bukaParade() {
    if (!KompModalParade) {
      const mod = await import('./drill/ModalParade')
      setKompModalParade(() => mod.default)
    }
    setParadeOpen(true)
  }

  /**
   * #7 → #10: pintu "Buka berkas DrillKit" menitipkan CSV Pyware lalu pindah
   * ke /drill. Kalau titipan itu yang menunggu, jendela impornya dibuka
   * sendiri — pelatih tidak perlu mencari tombolnya.
   */
  useEffect(() => {
    if (intipTitipan()?.jenis === 'csv-pyware') setImporPyware(true)
  }, [])

  /* ------------------ M1 — tautan lagu (drill mengikuti musik) ------------------ */
  /** Lagu yang ditautkan ke drill ini, kalau ada. */
  const lagu = useLiveQuery(
    async () => (drill.songId ? await db.songs.get(drill.songId) : undefined),
    [drill.songId],
  )
  /** Semua lagu di repertoar, untuk pilihan tautan. */
  const daftarLagu = useLiveQuery(() => db.songs.orderBy('title').toArray(), [], [])
  /*
   * #4 — tempo latihan lagu yang ditautkan. Peta waktunya dibuat setelah hook
   * ini agar durasi drill dan offset klik ikut memakai tempo latihan yang sama.
   */
  const tl = useTempoLatihan()
  const latihanDrill = drill.songId && lagu ? tl.tempoUntuk(drill.songId) : null
  const adaLatihanDrill = latihanAktif(latihanDrill)
  /**
   * Pemetaan tiap set ke posisi, tempo, dan sukat lagu.
   * `null` kalau drill tidak ditautkan → semua perilaku lama berlaku.
   */
  const petaSet = useMemo(() => {
    if (!lagu) return null
    return petakanSetKeMusik(
      sets.map((s) => ({ counts: s.counts })),
      drill.beatsPerCount,
      {
        bpm: lagu.bpm,
        tandaBirama: lagu.tandaBirama ?? dariBeatsLama(lagu.beats),
        // N9 — `berangsur` & `latih` ikut dikirim: tanpanya pemetaan
        // menghitung tempo tangga, padahal lagunya meluncur.
        tempoMap: lagu.tempoMap,
        latih: lagu.latih ?? null,
      },
      latihanDrill,
    )
  }, [lagu, sets, drill.beatsPerCount, latihanDrill?.mode, latihanDrill?.persen, latihanDrill?.geser])
  /** Tempo yang dipakai set ke-`i`: dari lagu kalau ditautkan, kalau tidak ya tempo drill. */
  const tempoUntuk = useCallback(
    (i: number) => terapkanLatihan(tempoSet(petaSet, i, drill.tempo), latihanDrill),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [petaSet, drill.tempo, latihanDrill?.mode, latihanDrill?.persen, latihanDrill?.geser],
  )
  /**
   * #5 sisa — penggaris drill × segmen lagu: baris segmen & baris set dalam
   * satuan hitungan, dari evaluator tempo yang sama dengan pemutaran.
   */
  const penggaris = useMemo(() => {
    if (!lagu) return null
    return petaPenggaris(
      sets.map((s) => ({ counts: s.counts, name: s.name })),
      {
        bpm: lagu.bpm,
        tandaBirama: lagu.tandaBirama ?? dariBeatsLama(lagu.beats),
        tempoMap: lagu.tempoMap,
        latih: lagu.latih ?? null,
      },
      { beatsPerCount: drill.beatsPerCount, latihan: latihanDrill },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lagu, sets, drill.beatsPerCount, latihanDrill?.mode, latihanDrill?.persen, latihanDrill?.geser])
  /** #5 sisa — bantuan hitungan untuk set yang sedang dibuka. */
  const bantuanHitungan = useMemo(
    () => (penggaris ? bantuanSet(penggaris, idx, idx < sets.length - 1) : null),
    [penggaris, idx, sets.length],
  )
  /** #5 sisa — keterangan tanda ⚡, dikumpulkan supaya terbaca juga di HP. */
  const catatanLintas = useMemo(
    () =>
      (penggaris?.set ?? [])
        .filter((b) => b.keterangan.length > 0)
        .map((b) => ({ index: b.index, nama: b.nama, teks: b.keterangan.join(' · ') })),
    [penggaris],
  )
  /** Lebar blok penggaris: sebanding hitungan, berlantai supaya teksnya muat. */
  const lebarBlok = (hitungan: number) => `${Math.max(58, Math.min(520, hitungan * 16))}px`
  /** #4 — kembali ke tempo asli: tempo latihan lagu dan pengali animasi. */
  const keTempoAsli = () => {
    if (drill.songId) tl.keAsli([drill.songId])
    ubah('cepat', 1)
  }
  const flDrill = useFrasaLatihan()
  const [partiturDrillTerbuka, setPartiturDrillTerbuka] = useState(false)
  const [biramaDrill, setBiramaDrill] = useState(1)
  const biramaDrillRef = useRef(1)
  const daftarSetBiramaDrill = useMemo(
    () =>
      lagu
        ? hitungPetaSetKeBirama(
            sets.map((s) => ({ counts: s.counts, name: s.name })),
            {
              bpm: lagu.bpm,
              tandaBirama: lagu.tandaBirama ?? dariBeatsLama(lagu.beats),
              tempoMap: lagu.tempoMap,
              latih: lagu.latih ?? null,
            },
            { beatsPerCount: drill.beatsPerCount, latihan: latihanDrill },
          )
        : [],
    [lagu, sets, drill.beatsPerCount, latihanDrill],
  )
  const segarkanBiramaDrill = useCallback(
    (indeksSet: number, progres01: number) => {
      if (!lagu || sets.length === 0) return
      const b = biramaPadaProgresSet(
        sets.map((s) => ({ counts: s.counts })),
        {
          bpm: lagu.bpm,
          tandaBirama: lagu.tandaBirama ?? dariBeatsLama(lagu.beats),
          tempoMap: lagu.tempoMap,
          latih: lagu.latih ?? null,
        },
        indeksSet,
        progres01,
        { beatsPerCount: drill.beatsPerCount },
      )
      if (b !== biramaDrillRef.current) {
        biramaDrillRef.current = b
        setBiramaDrill(b)
      }
    },
    [lagu, sets, drill.beatsPerCount],
  )
  useEffect(() => {
    if (!lagu?.partitur) setPartiturDrillTerbuka(false)
  }, [lagu?.id, lagu?.partitur])
  const [dotSheet, setDotSheet] = useState(false)
  /** DD4 — sudut putar blok (derajat). */
  const [sudutPutar, setSudutPutar] = useState(45)
  /** DD4 — persen kembang-kempis. */
  const [persenSkala, setPersenSkala] = useState(10)
  /** DD4 — sekalian pasang jalur busur supaya jarak antar pemain tetap terjaga. */
  const [ikutBusur, setIkutBusur] = useState(true)
  /** #22.3 — poros cermin terpadu (garis 50 lapangan vs tengah pilihan). */
  const [porosCermin, setPorosCermin] = useState<'lapangan' | 'pilihan'>('lapangan')
  /** #16.2 & #22.1 — pengaturan generator bentuk parametrik hidup & pratinjau kanvas. */
  const [opsiBentuk, setOpsiBentukState] = useState<OpsiBentukCepat>(OPSI_BENTUK_BAWAAN)
  const [ikatBentukHidup, setIkatBentukHidup] = useState(true)
  const [pratinjauBentukAktif, setPratinjauBentukAktif] = useState(false)
  /** #22.3 — lencana sudut putar langsung selama menarik gagang putar bebas di kanvas. */
  const [sudutPutarBebas, setSudutPutarBebas] = useState<number | null>(null)
  function ubahOpsiBentuk(patch: Partial<OpsiBentukCepat>) {
    setOpsiBentukState((s) => ({ ...s, ...patch }))
  }
  /** DD6 — pemain yang sedang dibuka panel detailnya. */
  const [detailId, setDetailId] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0) // 0..1 menuju set berikutnya
  /** Mode presenter: formasi layar penuh untuk dipakai saat latihan. */
  const [presenter, setPresenter] = useState(false)
  /** Daftar shortcut keyboard (A6). */
  const [bantuan, setBantuan] = useState(false)
  /**
   * A7 — penanda lapangan.
   * `editPenanda` = draf yang sedang diisi di dialog; `petik` = sedang
   * menunggu sentuhan di lapangan untuk mengisi koordinatnya.
   */
  const [editPenanda, setEditPenanda] = useState<{ draf: FieldMarker; baru: boolean } | null>(null)
  const [petik, setPetik] = useState<{ draf: FieldMarker; tahap: 1 | 2 } | null>(null)
  /**
   * B2 — kontrol animasi.
   * `seksiAnimasi` = 'all' atau id section yang saja digerakkan.
   * Posisi animasi TIDAK disimpan di state React (itu akan memicu render 60×
   * per detik); garis waktu dan label count diperbarui langsung lewat DOM.
   */
  const [seksiAnimasi, setSeksiAnimasi] = useState('all')
  const sliderRef = useRef<HTMLInputElement>(null)
  /** > 0 kalau pengguna sedang/pernah menjepret (scrub) posisi — dipakai supaya
   *  pembersihan transform otomatis tidak menghapus jepretan itu. */
  const jepretRef = useRef(0)
  /** #5 sisa — panel pecah set: berapa hitungan bagian pertama. */
  const [pecahTerbuka, setPecahTerbuka] = useState(false)
  const [pecahDi, setPecahDi] = useState(1)
  /**
   * #5 sisa — permintaan geser yang menunggu set aktif berpindah dulu.
   * Mengetuk blok segmen di penggaris bisa menunjuk set lain; `geserKe` baru
   * boleh dipanggil setelah React menggambar set itu.
   */
  const [geserPending, setGeserPending] = useState<{ idx: number; p: number } | null>(null)
  /** B3 — urutan latihan: mainkan semua set berurutan tanpa berhenti. */
  const [urutan, setUrutan] = useState(false)
  /** B5 — mesin klik tempo (menyertai animasi & urutan latihan). */
  const metronomRef = useRef<Metronom>(new Metronom())
  /** B5 — salinan `view.klik`, dibaca efek animasi tanpa memicu render ulang. */
  const klikRef = useRef(view.klik)
  klikRef.current = view.klik
  const urutanRef = useRef(urutan)
  urutanRef.current = urutan
  const svgRef = useRef<SVGSVGElement>(null)
  const dragRef = useRef<{
    startX: number
    startY: number
    orig: Record<string, DrillPoint>
    moved: boolean
    /** posisi hasil geseran terakhir, disimpan ke database saat pointer lepas */
    next?: Record<string, DrillPoint>
  } | null>(null)
  const [, setTick] = useState(0)
  const forceRender = () => setTick((t) => t + 1)

  /**
   * KINERJA untuk tim besar (40–80 pemain).
   *
   * Selama menggeser titik (dan saat animasi), posisi titik TIDAK di-render
   * ulang oleh React. Titik cukup digeser lewat atribut `transform` pada
   * elemen <g>-nya. Biayanya jadi sebanding dengan jumlah titik yang digeser,
   * bukan dengan jumlah seluruh pemain — jadi tetap lancar untuk 80 orang.
   * Render ulang React + penulisan database terjadi sekali saat selesai.
   */
  const dotRefs = useRef(new Map<string, SVGGElement>())
  const dotCbs = useRef(new Map<string, (el: SVGGElement | null) => void>())
  const pathsRef = useRef<SVGGElement>(null)
  const rafRef = useRef(0)
  const pendingEv = useRef<PointerEvent | null>(null)
  const animatingRef = useRef(false)
  /** Kotak pilih (marquee): seret di area kosong untuk memilih banyak titik. */
  const marqRef = useRef<{
    x0: number
    y0: number
    x1: number
    y1: number
    moved: boolean
    additive: boolean
  } | null>(null)
  const marqRectRef = useRef<SVGRectElement>(null)
  const marqRaf = useRef(0)
  const marqPending = useRef<PointerEvent | null>(null)
  /** #22.2 — Lasso poligon bebas di kanvas. */
  const lassoRef = useRef<{
    simpulYd: TitikKendaliYd[]
    simpulSvg: { sx: number; sy: number }[]
    moved: boolean
    additive: boolean
  } | null>(null)
  const lassoPolyRef = useRef<SVGPolygonElement>(null)
  /** #22.1 & #22.3 — status seret gagang bentuk hidup, gagang skala kotak batas, & gagang putar bebas. */
  const gagangBentukRef = useRef<{
    idBentuk: string
    peran: 'p0' | 'p1' | 'c1' | 'c2'
    startX: number
    startY: number
    asalTitik: TitikKendaliYd
    origBentuk: BentukTerikat[]
    origPoints: Record<string, DrillPoint>
    nextBentuk?: BentukTerikat[]
    nextPoints?: Record<string, DrillPoint>
    moved: boolean
  } | null>(null)
  const gagangSkalaRef = useRef<{
    sudut: SudutGagangSkala
    startX: number
    startY: number
    ids: string[]
    kotakAwal: KotakBatasYd
    origPoints: Record<string, DrillPoint>
    origBentuk: BentukTerikat[]
    nextPoints?: Record<string, DrillPoint>
    nextBentuk?: BentukTerikat[]
    moved: boolean
  } | null>(null)
  const gagangPutarRef = useRef<{
    ids: string[]
    pusat: TitikKendaliYd
    sudutAwalRad: number
    derajatTerakhir: number
    origPoints: Record<string, DrillPoint>
    origBentuk: BentukTerikat[]
    nextPoints?: Record<string, DrillPoint>
    nextBentuk?: BentukTerikat[]
    moved: boolean
  } | null>(null)
  /** #23.1 — seret titik singgah (Midset) langsung pada garis jejak biru di kanvas. */
  const gagangMidsetRef = useRef<{
    memberId: string
    indeks: number
    padaCount: number
    startX: number
    startY: number
    asalTitik: TitikKendaliYd
    baruDibuat: boolean
    origMidsets: Record<string, TitikSinggahMidset[]>
    nextMidsets?: Record<string, TitikSinggahMidset[]>
    moved: boolean
  } | null>(null)
  /** #23.2 — input pemberian tag cepat untuk pemain terpilih di editor. */
  const [inputTagMassal, setInputTagMassal] = useState('')
  /** #23.3 — viewport zoom/pan kanvas, deteksi pointer terakhir, target cepat, & balon tekan-lama. */
  const [viewport, setViewport] = useState<ViewportKanvas>(VIEWPORT_AWAL)
  const viewportRef = useRef<ViewportKanvas>(VIEWPORT_AWAL)
  viewportRef.current = viewport
  const [pointerTerakhir, setPointerTerakhir] = useState<PeranPointer>('tetikus')
  const [lebarSvgPx, setLebarSvgPx] = useState(760)
  const [siapLetakkanId, setSiapLetakkanId] = useState<string | null>(null)
  const [balonInfo, setBalonInfo] = useState<{ x: number; y: number; teks: string } | null>(null)
  const timerTekanLamaRef = useRef<number>(0)
  const panGeserRef = useRef<{
    pointerId: number
    startClientX: number
    startClientY: number
    vpAwal: ViewportKanvas
    rect: { left: number; top: number; width: number; height: number }
    moved: boolean
    additive: boolean
  } | null>(null)
  const jariAktifRef = useRef(
    new Map<number, { awalX: number; awalY: number; kiniX: number; kiniY: number }>(),
  )
  const cubitAwalRef = useRef<{
    vpAwal: ViewportKanvas
    idA: number
    idB: number
    awalA: { x: number; y: number }
    awalB: { x: number; y: number }
    rect: { left: number; top: number; width: number; height: number }
  } | null>(null)
  /** callback ref yang stabil per pemain (tidak dibuat ulang tiap render) */
  const dotRefCb = useCallback((id: string) => {
    let cb = dotCbs.current.get(id)
    if (!cb) {
      cb = (el: SVGGElement | null) => {
        if (el) dotRefs.current.set(id, el)
        else dotRefs.current.delete(id)
      }
      dotCbs.current.set(id, cb)
    }
    return cb
  }, [])

  const set = sets[Math.min(idx, sets.length - 1)]
  const nextSet = sets[idx + 1]
  const prevSet = idx > 0 ? sets[idx - 1] : undefined

  /* B2 — nilai yang dibaca loop animasi. Disimpan di ref supaya mengubah
     kecepatan / ulang / section tidak mengulang animasi dari awal. */
  const cepatRef = useRef(view.cepat)
  cepatRef.current = view.cepat
  const ulangRef = useRef(view.ulang)
  ulangRef.current = view.ulang
  /** DD9 — mode bilah waktu: melangkah per hitungan atau geser bebas. */
  const perHitunganRef = useRef(view.perHitungan)
  perHitunganRef.current = view.perHitungan
  /**
   * DD9 — posisi progres terakhir (0..1), baik dari animasi maupun scrub.
   * Ref (bukan state) supaya tombol `,` / `.` bisa melangkah dari posisi
   * berhenti tanpa memicu render 60 kali sedetik.
   */
  const posisiRef = useRef(0)
  const seksiRef = useRef(seksiAnimasi)
  seksiRef.current = seksiAnimasi

  /** B2 — lama perpindahan set ini (detik) setelah dikali kecepatan. */
  const durasiDetik = useMemo(() => {
    const counts = Math.max(1, set?.counts ?? 8)
    const durasiPartitur = (counts * drill.beatsPerCount * 60) / Math.max(20, tempoUntuk(idx))
    const durasiTimeline = petaSet?.[idx]?.detikLatihan ?? durasiPartitur
    return durasiTimeline / Math.max(0.05, view.cepat)
  }, [set?.counts, drill.beatsPerCount, tempoUntuk, idx, view.cepat, petaSet])

  /** A7 — penanda lapangan milik drill ini (drill lama belum punya → []). */
  const markers = useMemo(() => drill?.markers ?? [], [drill?.markers])
  const markersRef = useRef(markers)
  markersRef.current = markers

  /** Simpan daftar penanda ke database drill. */
  const simpanPenanda = useCallback(
    (daftar: FieldMarker[]) => {
      if (!drill) return
      void db.drills.update(drill.id, { markers: daftar, updatedAt: Date.now() })
    },
    [drill],
  )
  /** Set aktif versi ref — dipakai handler drag agar selalu membaca data terbaru. */
  const setRef = useRef(set)
  setRef.current = set

  /* ------------------------------ Undo / Redo -------------------------------- */

  /**
   * Riwayat berisi salinan titik SEBELUM perubahan (maksimal 50 langkah).
   * Satu langkah bisa berisi **beberapa set sekaligus** — jadi menyalin formasi
   * ke 3 set cukup dibatalkan dengan satu Ctrl+Z.
   */
  type Langkah = {
    setId: string
    points: Record<string, DrillPoint>
    bentukTerikat?: BentukTerikat[]
    midsets?: Record<string, TitikSinggahMidset[]>
  }[]
  /** 'salin' = dari set ini ke set lain · 'ambil' = dari set lain ke set ini. */
  const [copyMode, setCopyMode] = useState<'salin' | 'ambil' | null>(null)
  const [history, setHistory] = useState<Langkah[]>([])
  const [future, setFuture] = useState<Langkah[]>([])

  /** Simpan keadaan beberapa set sebagai satu langkah riwayat (termasuk bentukTerikat & midsets). */
  function snapshotMany(
    list: {
      id: string
      points: Record<string, DrillPoint>
      bentukTerikat?: BentukTerikat[]
      midsets?: Record<string, TitikSinggahMidset[]>
    }[],
  ) {
    if (!list.length) return
    const langkah: Langkah = list.map((s) => ({
      setId: s.id,
      points: JSON.parse(JSON.stringify(s.points)) as Record<string, DrillPoint>,
      bentukTerikat: s.bentukTerikat?.length
        ? (JSON.parse(JSON.stringify(s.bentukTerikat)) as BentukTerikat[])
        : undefined,
      midsets:
        s.midsets && Object.keys(s.midsets).length
          ? (JSON.parse(JSON.stringify(s.midsets)) as Record<string, TitikSinggahMidset[]>)
          : undefined,
    }))
    setHistory((h) => [...h.slice(-49), langkah])
    setFuture([])
  }

  /** Panggil sebelum mengubah titik/bentuk/midset, supaya keadaan lama bisa dikembalikan. */
  function snapshot() {
    const cur = setRef.current
    if (cur) {
      snapshotMany([
        {
          id: cur.id,
          points: cur.points,
          bentukTerikat: cur.bentukTerikat,
          midsets: cur.midsets,
        },
      ])
    }
  }

  const undo = useCallback(async () => {
    const prev = history[history.length - 1]
    const cur = setRef.current
    if (!prev || !cur) return
    const sekarang: Langkah = prev.map((e) => {
      const s = sets.find((x) => x.id === e.setId)
      return {
        setId: e.setId,
        points: JSON.parse(JSON.stringify(s?.points ?? {})) as Record<string, DrillPoint>,
        bentukTerikat: s?.bentukTerikat?.length
          ? (JSON.parse(JSON.stringify(s.bentukTerikat)) as BentukTerikat[])
          : undefined,
        midsets:
          s?.midsets && Object.keys(s.midsets).length
            ? (JSON.parse(JSON.stringify(s.midsets)) as Record<string, TitikSinggahMidset[]>)
            : undefined,
      }
    })
    setFuture((f) => [sekarang, ...f.slice(0, 49)])
    setHistory((h) => h.slice(0, -1))
    await Promise.all(
      prev.map((e) =>
        db.sets.update(e.setId, {
          points: e.points,
          bentukTerikat: e.bentukTerikat?.length ? e.bentukTerikat : undefined,
          midsets: e.midsets && Object.keys(e.midsets).length ? e.midsets : undefined,
        }),
      ),
    )
    const i = sets.findIndex((s) => s.id === prev[0].setId)
    if (i >= 0) setIdx(i)
  }, [history, sets])

  const redo = useCallback(async () => {
    const nxt = future[0]
    const cur = setRef.current
    if (!nxt || !cur) return
    const sekarang: Langkah = nxt.map((e) => {
      const s = sets.find((x) => x.id === e.setId)
      return {
        setId: e.setId,
        points: JSON.parse(JSON.stringify(s?.points ?? {})) as Record<string, DrillPoint>,
        bentukTerikat: s?.bentukTerikat?.length
          ? (JSON.parse(JSON.stringify(s.bentukTerikat)) as BentukTerikat[])
          : undefined,
        midsets:
          s?.midsets && Object.keys(s.midsets).length
            ? (JSON.parse(JSON.stringify(s.midsets)) as Record<string, TitikSinggahMidset[]>)
            : undefined,
      }
    })
    setHistory((h) => [...h.slice(-49), sekarang])
    setFuture((f) => f.slice(1))
    await Promise.all(
      nxt.map((e) =>
        db.sets.update(e.setId, {
          points: e.points,
          bentukTerikat: e.bentukTerikat?.length ? e.bentukTerikat : undefined,
          midsets: e.midsets && Object.keys(e.midsets).length ? e.midsets : undefined,
        }),
      ),
    )
    const i = sets.findIndex((s) => s.id === nxt[0].setId)
    if (i >= 0) setIdx(i)
  }, [future, sets])
  // #7 — drill tanpa `field` (mis. dari berkas show lama) memakai
  // lapangan bawaan, bukan memogokkan halaman (`stepYd` membaca `step`).
  const f = drill.field ?? DEFAULT_FIELD
  /**
   * Versi ref dari konfigurasi lapangan.
   * `snapVal` dipanggil dari handler geser yang dipasang sekali di `useEffect`,
   * sehingga closure-nya bisa usang. Tanpa ref ini, mengganti lapangan
   * (mis. DCI → sepak bola) membuat titik tetap menempel memakai ukuran
   * langkah & lebar lapangan yang LAMA.
   */
  const fRef = useRef(f)
  fRef.current = f
  const sYd = stepYd(f)
  const roster = members.filter((m) => (drill.rosterIds.length ? drill.rosterIds.includes(m.id) : true))
  const daftarTagRoster = useMemo(() => kumpulkanTagRoster(roster), [roster])
  /** DD2 & #23.2 — cara pemain berpindah ke set berikutnya (kelompok terikat Tag disinkronkan). */
  const gerakSet = useMemo(() => {
    const mentah = gerakOf(set?.gerak)
    const klp = sinkronkanKelompokDariTag(mentah.kelompok, roster)
    return klp !== mentah.kelompok ? { ...mentah, kelompok: klp } : mentah
  }, [set?.gerak, roster])
  /** DD2 — gerak set SEBELUMNYA: dipakai jejak "masuk" (kuning). */
  const gerakSebelum = gerakOf(prevSet?.gerak)
  /** DD2 — simpan pengaturan gerak untuk set yang sedang aktif. */
  function simpanGerak(patch: Partial<GerakSet>) {
    if (!set) return
    const baru: GerakLengkap = { ...gerakSet, ...patch }
    set.gerak = baru
    db.sets.update(set.id, { gerak: baru })
    forceRender()
  }
  /** #16.3 — simpan simbol visual/tanduk untuk set yang sedang aktif. */
  function simpanVisual(vis: InstruksiVisualSet | undefined) {
    if (!set) return
    set.visual = vis
    db.sets.update(set.id, { visual: vis })
    forceRender()
  }
  /** #23.2 — simpan timpaan warna/bentuk titik berbasis Tag khusus pada set aktif. */
  function simpanTampilanTagSet(peta: Record<string, TimpaanTampilanTag> | undefined) {
    if (!set) return
    set.tampilanTag = peta
    void db.sets.update(set.id, { tampilanTag: peta })
    forceRender()
  }
  /**
   * Versi ref — dipakai handler animasi yang dipasang sekali di `useEffect`,
   * supaya tidak terjebak closure usang seperti yang pernah terjadi pada
   * konfigurasi lapangan (lihat catatan DD1).
   */
  const gerakRef = useRef(gerakSet)
  gerakRef.current = gerakSet
  /**
   * Ukuran titik pemain mengikuti luas lapangan (acuan: DCI 120 yard), lalu
   * dikalikan pengali pilihan pelatih. Dipakai untuk radius titik, tebal
   * garis, panjang garis hadap, dan ukuran teks kode pemain.
   */
  const uk = (n: number) => ukurTitik(f, n)

  /** DD2 — section yang ada di drill ini, dipakai untuk mengatur tunda mulai. */
  const seksiUnik = [...new Set(roster.map((m) => m.section))]
  const visible = useMemo(
    () =>
      roster.filter((m) => {
        if (sectionFilter === 'all') return true
        if (sectionFilter.startsWith('tag:')) return punyaTag(m, sectionFilter.slice(4))
        return m.section === sectionFilter
      }),
    [roster, sectionFilter],
  )
  const visibleIds = useMemo(() => new Set(visible.map((m) => m.id)), [visible])
  /** Versi ref supaya handler yang dipasang sekali selalu membaca data terbaru. */
  /** DD3 — analitik gerak untuk perpindahan yang sedang aktif. */
  const analisis = analisisPerpindahan(
    set,
    nextSet,
    roster,
    sYd,
    drill.tempo,
    drill.beatsPerCount,
    visibleIds,
    drill.setelanLangkah,
    settings?.ambangGerak,
    drill.setelanJarak,
  )
  /** #24 — pemeriksaan benturan lintasan, silang 2-Opt, & kerataan spasi (0 biaya saat scrub 60fps). */
  const [tampilCincinTabrakan, setTampilCincinTabrakan] = useState(true)
  const [idPratinjauTukar, setIdPratinjauTukar] = useState<string | null>(null)
  useEffect(() => {
    setIdPratinjauTukar(null)
  }, [set?.id, nextSet?.id])

  const hasilTabrakan = useMemo(
    () =>
      set && nextSet
        ? periksaTabrakanSet({
            dari: set,
            ke: nextSet,
            anggota: roster,
            stepYd: sYd,
            markers,
            sets,
            idxSet: idx,
            hanya: visibleIds,
          })
        : undefined,
    [
      set,
      set?.points,
      set?.gerak,
      set?.midsets,
      set?.counts,
      nextSet,
      nextSet?.points,
      sets,
      idx,
      roster,
      sYd,
      markers,
      visibleIds,
    ],
  )

  const saranTukarSilang = useMemo(
    () =>
      set && nextSet
        ? cariSaranTukarSilang({
            dari: set,
            ke: nextSet,
            anggota: roster,
            stepYd: sYd,
            hanya: visibleIds,
          })
        : [],
    [set, set?.points, set?.gerak, set?.midsets, nextSet, nextSet?.points, roster, sYd, visibleIds],
  )

  const temuanSpasi = useMemo(
    () =>
      set
        ? periksaKerataanSpasi({
            set,
            anggota: roster,
            stepYd: sYd,
            selectedIds: selected,
            hanya: visibleIds,
          })
        : [],
    [set, set?.points, set?.bentukTerikat, roster, sYd, selected, visibleIds],
  )
  /** Ambang yang benar-benar berlaku — punya tim, atau bawaan. */
  const ambang = useMemo(() => ambangEfektif(settings?.ambangGerak), [settings?.ambangGerak])
  /** DD3 — tingkat kesulitan per pemain, untuk mewarnai jejak. */
  const tingkatById = useMemo(
    () => new Map(analisis.daftar.map((d) => [d.id, d.tingkat])),
    [analisis],
  )
  /** DD3 — warna jejak keluar: biru biasa, atau mengikuti kesulitan. */
  const warnaJalur = (id: string) =>
    view.analitik && tingkatById.has(id) ? TINGKAT_WARNA[tingkatById.get(id)!] : '#38bdf8'

  /**
   * DD4 — pemain yang mengikuti **busur putaran** pada satu perpindahan.
   *
   * Hanya pemain yang perpindahannya benar-benar cocok dengan putaran itu yang
   * dimasukkan; sisanya tetap memakai jalur lurus/melengkung. Pusat putaran
   * ikut diproyeksikan ke ruang gambar, supaya animasi, scrub, dan gambar
   * jejak memakai hitungan yang sama persis.
   */
  function petaBusur(dari: DrillSet | undefined, ke: DrillSet | undefined) {
    const peta = new Map<string, BusurGambar & { x0: number; y0: number }>()
    if (!dari || !ke) return peta
    // Busur hanya berlaku kalau jalurnya memang dipilih 'busur' — mengganti ke
    // 'lurus'/'melengkung' harus benar-benar mengembalikan jalur itu.
    const g = gerakOf(dari.gerak)
    const pt = g.jalur === 'busur' ? g.putar : undefined
    if (!pt || !pt.sudut) return peta
    const pusatGambar = { x: sx(pt.pusat.x), y: sy(pt.pusat.y) }
    // Geseran dalam ruang gambar = selisih dua titik terproyeksi, bukan
    // proyeksi sebuah selisih — aman untuk sumbu yang dibalik seperti sx/sy.
    const geser = pt.pusatAkhir
      ? { x: pt.pusatAkhir.x - pt.pusat.x, y: pt.pusatAkhir.y - pt.pusat.y }
      : { x: 0, y: 0 }
    const geserGambar = pt.pusatAkhir
      ? { x: sx(pt.pusatAkhir.x) - pusatGambar.x, y: sy(pt.pusatAkhir.y) - pusatGambar.y }
      : { x: 0, y: 0 }
    for (const [id, p] of Object.entries(dari.points)) {
      const q = ke.points[id]
      if (!q || !visibleIds.has(id)) continue
      if (!cocokPutaran(p.x, p.y, q.x, q.y, pt.pusat, pt.sudut, geser)) continue
      peta.set(id, { x0: sx(p.x), y0: sy(p.y), pusat: pusatGambar, sudut: pt.sudut, geser: geserGambar })
    }
    return peta
  }
  /* `busurKeluar` & `busurMasuk` dihitung SETELAH `sx`/`sy` ada — lihat bawah.
     (Pernah diletakkan di sini dan membuat aplikasi mogok: "Cannot access 'sx'
     before initialization" begitu sebuah set benar-benar memakai busur.) */
  /** DD3 — set terberat di seluruh drill, untuk ringkasan sekilas. */
  const terberat = useMemo(
    () =>
      setTerberat(
        sets,
        roster,
        sYd,
        drill.tempo,
        drill.beatsPerCount,
        // M1 — tempo per set, supaya peringatan dihitung pada tempo yang
        // benar-benar diputar, bukan tempo datar drill.
        petaSet ? daftarTempo(petaSet, drill.tempo, sets.length) : undefined,
        settings?.ambangGerak,
      ),
    [sets, roster, sYd, drill.tempo, drill.beatsPerCount, petaSet, settings?.ambangGerak],
  )
  const visibleIdsRef = useRef(visibleIds)
  visibleIdsRef.current = visibleIds
  /** Peta id → anggota: menghindari pencarian `find` berulang (O(n²)) saat menggambar titik. */
  const rosterById = useMemo(() => new Map(roster.map((m) => [m.id, m])), [roster])
  /** B2 — section tiap pemain, untuk "mainkan hanya 1 section". */
  const seksiMember = useMemo(() => new Map(roster.map((m) => [m.id, m.section])), [roster])
  const selSet = useMemo(() => new Set(selected), [selected])
  /**
   * Titik yang jejaknya digambar: semua titik yang tampil, atau cuma yang
   * sedang dipilih kalau ada pilihan (supaya jejak satu pemain mudah diikuti).
   */
  const entriJejak = useMemo(() => {
    const semua = Object.entries(set?.points ?? {}).filter(([id]) => visibleIds.has(id))
    if (!selected.length) return semua
    const sel = new Set(selected)
    return semua.filter(([id]) => sel.has(id))
  }, [set, selected, visibleIds])

  /**
   * DD9 — jumlah tapak yang digambar di sepanjang jejak.
   *
   * Isinya **jumlah langkah yang benar-benar dijalankan pemain**, jadi
   * mengikuti mode langkah DD10b:
   *  - `menyesuaikan` → dari hitungan (hitungan × langkah per hitungan);
   *  - `tetap` (bawaan) → dari jarak, sudah termasuk tambahan lengkungan.
   *
   * Karena itu tapaknya berubah saat mode diubah — dan itulah gunanya: kelihatan
   * langsung bahwa "jarak dekat dalam hitungan panjang" berarti langkah
   * pendek-pendek, bukan jalan lambat.
   */
  function jumlahLangkah(id: string, dari: DrillPoint, ke: DrillPoint): number {
    const timpa = set?.langkah?.[id]
    const mode = timpa?.mode ?? drill.setelanLangkah?.mode ?? 'tetap'
    if (mode === 'menyesuaikan') {
      const k = timpa?.langkahPerCount ?? drill.setelanLangkah?.langkahPerCount ?? 1
      const cAktif = countEfektifPemain(gerakSet, seksiMember.get(id), set?.counts ?? 0, id)
      return Math.max(1, Math.round(cAktif * k))
    }
    const lurus = (drill.setelanJarak ?? 'jalur') === 'lurus'
    if (!lurus && set && nextSet && gerakSet.kelompok?.some((k) => k.jalur === 'ftl' && k.memberIds.includes(id))) {
      const petaYd = bangunPetaFtl(gerakSet.kelompok, set.points, nextSet.points)
      const ftlYd = petaYd.get(id)
      if (ftlYd && ftlYd.totalPanjang > 0) return Math.max(1, Math.round(ftlYd.totalPanjang / sYd))
    }
    const klp = kelompokPemain(gerakSet, id)
    if (!lurus && set?.midsets?.[id]?.length) {
      const kAkhir = klp
        ? klp.jalur === 'lengkung'
          ? (klp.lengkung ?? 0.4)
          : 0
        : gerakSet.jalur === 'lengkung'
          ? gerakSet.lengkung
          : 0
      const jrkMid = panjangJalurMidsets(dari, ke, set.midsets[id], set.counts || 8, kAkhir)
      return Math.max(1, Math.round(jrkMid / sYd))
    }
    // 31e — sama dengan analitik: `lurus` mengabaikan kelengkungan.
    const rasio = lurus
      ? 1
      : klp
        ? klp.jalur === 'lengkung'
          ? rasioLengkung(klp.lengkung ?? 0.4)
          : 1
        : gerakSet.jalur === 'lengkung'
          ? rasioLengkung(gerakSet.lengkung ?? 0)
          : 1
    const jrkYd = Math.hypot(ke.x - dari.x, ke.y - dari.y) * rasio
    return Math.max(1, Math.round(jrkYd / sYd))
  }

  /* ----------------------------- Mutasi data ------------------------------ */

  const writePoints = useCallback(
    async (
      points: Record<string, DrillPoint>,
      setId = set?.id,
      bentukBaru?: BentukTerikat[] | null,
    ) => {
      if (!setId) return
      const payload: Partial<DrillSet> = { points }
      if (bentukBaru !== undefined) {
        payload.bentukTerikat = bentukBaru && bentukBaru.length ? bentukBaru : undefined
      }
      await db.sets.update(setId, payload)
      await db.drills.update(drill.id, { updatedAt: Date.now() })
    },
    [set?.id, drill.id],
  )

  const writeMidsets = useCallback(
    async (
      midsetsBaru: Record<string, TitikSinggahMidset[]> | undefined,
      setId = set?.id,
    ) => {
      if (!setId) return
      const rapi =
        midsetsBaru && Object.keys(midsetsBaru).length ? midsetsBaru : undefined
      await db.sets.update(setId, { midsets: rapi })
      await db.drills.update(drill.id, { updatedAt: Date.now() })
    },
    [set?.id, drill.id],
  )

  async function addSet(copyPrevious = true) {
    const prev = sets[sets.length - 1]
    const salinanBentuk =
      copyPrevious && prev?.bentukTerikat?.length
        ? (JSON.parse(JSON.stringify(prev.bentukTerikat)) as BentukTerikat[]).map((b) => ({
            ...b,
            id: uid('btk_'),
          }))
        : undefined
    const newSet: DrillSet = {
      id: uid('set_'),
      drillId: drill.id,
      order: sets.length,
      name: `Set ${sets.length + 1}`,
      counts: prev?.counts ?? 16,
      points: copyPrevious && prev ? JSON.parse(JSON.stringify(prev.points)) : {},
      bentukTerikat: salinanBentuk,
      createdAt: Date.now(),
    }
    await db.sets.put(newSet)
    await db.drills.update(drill.id, { updatedAt: Date.now() })
    setIdx(sets.length)
    toast.push('Set baru ditambahkan')
  }

  /**
   * Menyalin set yang sedang dibuka menjadi set baru **tepat di setelahnya**.
   * (Versi lama menaruh salinan di akhir daftar, jadi urutannya melompat.)
   */
  async function duplicateSet() {
    if (!set) return
    const dasar = set.name.replace(/ \(salinan\)$/, '')
    const klon = JSON.parse(JSON.stringify(set)) as DrillSet
    const copy: DrillSet = {
      ...klon,
      id: uid('set_'),
      order: idx + 1,
      name: `${dasar} (salinan)`,
      bentukTerikat: klon.bentukTerikat?.length
        ? klon.bentukTerikat.map((b) => ({ ...b, id: uid('btk_') }))
        : undefined,
      createdAt: Date.now(),
    }
    await db.sets.put(copy)
    // Geser nomor urut set sesudahnya supaya salinan benar-benar tersisip.
    await Promise.all(sets.slice(idx + 1).map((s, i) => db.sets.update(s.id, { order: idx + 2 + i })))
    await db.drills.update(drill.id, { updatedAt: Date.now() })
    setIdx(idx + 1)
    toast.push(`Disalin menjadi "${copy.name}"`)
  }

  /**
   * Menyalin titik antar set — dipakai bersama tombol "Salin ke…" (dari set ini
   * ke set lain) dan "Ambil dari…" (dari set lain ke set ini).
   *
   * @param targetIds set yang akan diisi
   * @param sourceId  set sumber isinya
   * @param hanyaTerpilih true = cuma titik yang sedang dipilih di editor
   * @param ganti true = target jadi sama persis; false = titik target yang sudah ada dibiarkan
   */
  async function copyPoints(targetIds: string[], sourceId: string, hanyaTerpilih: boolean, ganti: boolean) {
    const src = sets.find((s) => s.id === sourceId)
    const targets = sets.filter((s) => targetIds.includes(s.id))
    if (!src || !targets.length) return
    const dipilih = new Set(selected)
    const sumber = hanyaTerpilih
      ? Object.fromEntries(Object.entries(src.points).filter(([id]) => dipilih.has(id)))
      : src.points
    if (hanyaTerpilih && !Object.keys(sumber).length) {
      toast.push('Tidak ada titik yang dipilih', 'info')
      return
    }
    // Satu langkah riwayat untuk semua target → cukup satu Ctrl+Z.
    snapshotMany(targets.map((t) => ({ id: t.id, points: t.points, bentukTerikat: t.bentukTerikat })))
    for (const t of targets) {
      const isi = JSON.parse(JSON.stringify(sumber)) as Record<string, DrillPoint>
      const hasil = ganti ? isi : { ...JSON.parse(JSON.stringify(t.points)), ...isi }
      const bentukHasil = ganti
        ? !hanyaTerpilih && src.bentukTerikat?.length
          ? (JSON.parse(JSON.stringify(src.bentukTerikat)) as BentukTerikat[]).map((b) => ({
              ...b,
              id: uid('btk_'),
            }))
          : undefined
        : lepaskanAnggotaDariBentuk(t.bentukTerikat, Object.keys(isi))
      await db.sets.update(t.id, {
        points: hasil,
        bentukTerikat: bentukHasil?.length ? bentukHasil : undefined,
      })
    }
    await db.drills.update(drill.id, { updatedAt: Date.now() })
  }

  async function bersihkanKeyframeSetPenanda(idSetDihapus: string) {
    if (!markers.some((m) => m.perSet && idSetDihapus in m.perSet)) return
    const bersih = markers.map((m) => {
      if (!m.perSet || !(idSetDihapus in m.perSet)) return m
      const perSetBaru = { ...m.perSet }
      delete perSetBaru[idSetDihapus]
      return {
        ...m,
        perSet: Object.keys(perSetBaru).length ? perSetBaru : undefined,
      }
    })
    await simpanPenanda(bersih)
  }

  async function removeSet() {
    if (!set || sets.length <= 1) return
    // 1a — difoto dulu: menghapus set bersama semua titiknya adalah
    // kehilangan yang paling sering disesali, dan paling sering baru
    // disadari besoknya.
    await foto(drill.id, 'sebelum-hapus-set')
    const idHapus = set.id
    await db.sets.delete(idHapus)
    await bersihkanKeyframeSetPenanda(idHapus)
    if (countSheetsDrill?.length) {
      await Promise.all(
        countSheetsDrill.map((cs) => {
          const bersih = bersihkanSetIdCountSheet(cs, idHapus)
          return bersih !== cs ? db.countSheets.put(bersih) : null
        }),
      )
    }
    // K3 — centang untuk set ini tidak ada gunanya lagi.
    await hapusTandaSet(drill.id, idHapus)
    const rest = sets.filter((s) => s.id !== idHapus)
    await Promise.all(rest.map((s, i) => (s.order === i ? null : db.sets.update(s.id, { order: i }))))
    setIdx(Math.max(0, idx - 1))
    toast.push('Set dihapus', 'info')
  }

  /* ------------------- #5 sisa — bantuan & pecah/gabung set ---------------- */

  /** Isi hitungan set ini supaya berakhir tepat di batas segmen lagu. */
  function pasKeBatasSegmen() {
    if (!set || !bantuanHitungan?.bisaPas) return
    set.counts = bantuanHitungan.sisaBulat
    db.sets.update(set.id, { counts: bantuanHitungan.sisaBulat })
    toast.push(
      `Hitungan set diisi ${bantuanHitungan.sisaBulat} — berakhir di batas segmen ${bantuanHitungan.segmen?.label ?? ''}`,
    )
    forceRender()
  }

  /** Batas segmen yang jatuh **di dalam** set ini (hitungan 1..counts-1). */
  function batasDiDalamSet(): number[] {
    if (!set || !penggaris) return []
    const n = Math.max(1, Math.floor(set.counts))
    const mulai = penggaris.set[idx]?.mulai ?? 0
    return penggaris.segmen
      .map((s) => Math.round(s.mulai - mulai))
      .filter((k) => k >= 1 && k <= n - 1)
  }

  /** Buka panel pecah, dengan usul hitungan yang paling masuk akal. */
  function bukaPecah() {
    if (!set) return
    const n = Math.max(1, Math.floor(set.counts))
    const batas = batasDiDalamSet()
    const usul =
      batas.length > 0
        ? batas.reduce((a, b) =>
            Math.abs(b - (bantuanHitungan?.sisaBulat ?? b)) <
            Math.abs(a - (bantuanHitungan?.sisaBulat ?? a))
              ? b
              : a,
          )
        : Math.max(1, Math.floor(n / 2))
    setPecahDi(Math.min(Math.max(1, usul), Math.max(1, n - 1)))
    setPecahTerbuka(true)
  }

  /**
   * Pecah set ini setelah hitungan ke-`di`.
   *
   * Posisi peralihan diambil dari jalur yang sudah ada (termasuk busur) oleh
   * `pecahSet`, dan keadaan sebelum pecah difoto ke riwayat formasi — jadi
   * hasilnya bisa dibatalkan walau halaman sudah ditutup.
   */
  async function pecahSetDi(di: number) {
    if (!set || !nextSet) {
      toast.push('Set terakhir tidak punya tujuan untuk dipecah', 'info')
      return
    }
    const peta = petaSet?.[idx]
    const porsi =
      peta && peta.detikLatihan > 0
        ? Math.min(1, Math.max(0, (peta.offsetKlikLatihan[di] ?? peta.detikLatihan) / peta.detikLatihan))
        : di / Math.max(1, set.counts)
    const hasil = pecahSet({
      counts: set.counts,
      points: set.points,
      gerak: set.gerak,
      midsets: set.midsets,
      tujuan: nextSet.points,
      di,
      porsi,
      seksi: (id) => seksiMember.get(id),
    })
    if (!hasil) return

    await foto(drill.id, 'sebelum-pecah-set')
    const baru: DrillSet = {
      id: uid('set_'),
      drillId: drill.id,
      order: idx + 1,
      name: `${set.name} (pecahan)`,
      counts: hasil.hitunganKedua,
      points: hasil.tengah,
      gerak: hasil.gerakKedua,
      ...(hasil.midsetsKedua ? { midsets: hasil.midsetsKedua } : {}),
      createdAt: Date.now(),
    }
    await db.sets.update(set.id, {
      counts: hasil.hitunganPertama,
      gerak: hasil.gerakPertama,
      midsets: hasil.midsetsPertama,
    })
    await db.sets.put(baru)
    if (countSheetsDrill?.length) {
      await Promise.all(
        countSheetsDrill.map((cs) => {
          const disinkron = sinkronkanCountSheetSaatPecahSet(
            cs,
            set.id,
            { id: set.id, name: set.name, counts: hasil.hitunganPertama },
            { id: baru.id, name: baru.name, counts: hasil.hitunganKedua },
          )
          return disinkron !== cs ? db.countSheets.put(disinkron) : null
        }),
      )
    }
    // Geser nomor urut set sesudahnya supaya pecahannya benar-benar tersisip.
    await Promise.all(sets.slice(idx + 1).map((s, i) => db.sets.update(s.id, { order: idx + 2 + i })))
    await db.drills.update(drill.id, { updatedAt: Date.now() })
    setPecahTerbuka(false)
    setIdx(idx + 1)
    toast.push(`Set dipecah di hitungan ${di} — bisa dibatalkan lewat Riwayat formasi`)
  }

  /**
   * Gabung set ini dengan set berikutnya: titik set berikutnya dibuang,
   * hitungannya ditambahkan ke set ini, dan pengaturan geraknya digabung
   * (`gabungGerak`) sehingga busur hasil pecahan bisa kembali utuh.
   */
  async function gabungSetBerikut() {
    if (!set || !nextSet) return
    await foto(drill.id, 'sebelum-gabung-set')
    const countsAwal = Math.max(1, Math.floor(set.counts))
    const countsKedua = Math.max(1, Math.floor(nextSet.counts))
    const counts = countsAwal + countsKedua
    const gerak = gabungGerak(set.gerak, nextSet.gerak)
    const midsetsGabung: Record<string, TitikSinggahMidset[]> = {}
    const semuaIdMid = new Set([
      ...Object.keys(set.midsets ?? {}),
      ...Object.keys(nextSet.midsets ?? {}),
    ])
    for (const id of semuaIdMid) {
      const a = normalisasiMidsetsPemain(set.midsets?.[id], countsAwal)
      const b = normalisasiMidsetsPemain(nextSet.midsets?.[id], countsKedua).map((w) => ({
        ...w,
        padaCount: w.padaCount + countsAwal,
      }))
      const titikTengah = nextSet.points[id]
        ? [{ padaCount: countsAwal, x: nextSet.points[id].x, y: nextSet.points[id].y }]
        : []
      const rapi = normalisasiMidsetsPemain([...a, ...titikTengah, ...b], counts)
      if (rapi.length) midsetsGabung[id] = rapi
    }
    await db.sets.update(set.id, {
      counts,
      gerak,
      midsets: Object.keys(midsetsGabung).length ? midsetsGabung : undefined,
    })
    const idLeleh = nextSet.id
    await db.sets.delete(idLeleh)
    await bersihkanKeyframeSetPenanda(idLeleh)
    if (countSheetsDrill?.length) {
      await Promise.all(
        countSheetsDrill.map((cs) => {
          const bersih = bersihkanSetIdCountSheet(cs, idLeleh)
          return bersih !== cs ? db.countSheets.put(bersih) : null
        }),
      )
    }
    await hapusTandaSet(drill.id, idLeleh)
    await Promise.all(sets.slice(idx + 2).map((s, i) => db.sets.update(s.id, { order: idx + 1 + i })))
    await db.drills.update(drill.id, { updatedAt: Date.now() })
    setPecahTerbuka(false)
    toast.push(`Set digabung — ${nextSet.name} dilebur (bisa dibatalkan lewat Riwayat formasi)`)
  }

  async function moveSetOrder(dir: -1 | 1) {
    const j = idx + dir
    if (j < 0 || j >= sets.length || !set) return
    const other = sets[j]
    await db.sets.update(set.id, { order: j })
    await db.sets.update(other.id, { order: idx })
    setIdx(j)
  }

  function updatePoint(memberId: string, patch: Partial<DrillPoint>) {
    if (!set) return
    snapshot()
    const base = set.points[memberId] ?? { x: 0, y: 0, facing: 'front' as Facing }
    const points = { ...set.points, [memberId]: { ...base, ...patch } }
    const pindahKoord =
      (patch.x !== undefined && patch.x !== base.x) ||
      (patch.y !== undefined && patch.y !== base.y)
    const bentukBaru = pindahKoord
      ? lepaskanAnggotaDariBentuk(set.bentukTerikat, [memberId])
      : set.bentukTerikat
    set.points = points // optimistik untuk UI
    set.bentukTerikat = bentukBaru
    void writePoints(points, set.id, pindahKoord ? (bentukBaru ?? null) : undefined)
  }

  /* --------------------- DD4 & #22 — Transformasi Terpadu --------------------- */

  /** Titik yang kena operasi: yang dipilih, atau semua titik tampil kalau tak ada pilihan. */
  function targetMassa(): string[] {
    if (!set) return []
    if (selected.length) return selected.filter((id) => Boolean(set.points[id]))
    return Object.keys(set.points).filter((id) => visibleIds.has(id))
  }

  /**
   * Sinkronkan `bentukTerikat` saat sebagian/seluruh titik ditransformasi:
   * - bentuk yang SEMUA anggotanya ikut ditransformasi → titik kendalinya ikut ditransformasi;
   * - bentuk yang hanya SEBAGIAN anggotanya dipindah → anggota itu dilepas dari bentuk.
   */
  function sinkronkanBentukMassal(
    daftar: BentukTerikat[] | undefined,
    idsTarget: string[],
    ubahUtuh: ((b: BentukTerikat) => BentukTerikat) | null,
  ): BentukTerikat[] | undefined {
    if (!daftar?.length) return undefined
    const setTarget = new Set(idsTarget)
    const hasil: BentukTerikat[] = []
    for (const b of daftar) {
      const jmlIkut = b.memberIds.filter((id) => setTarget.has(id)).length
      if (jmlIkut === 0) {
        hasil.push(b)
      } else if (jmlIkut === b.memberIds.length && ubahUtuh) {
        hasil.push(ubahUtuh(b))
      } else {
        const sisa = b.memberIds.filter((id) => !setTarget.has(id))
        if (sisa.length >= 2) hasil.push({ ...b, memberIds: sisa })
      }
    }
    return hasil.length ? hasil : undefined
  }

  /** Terapkan satu transformasi ke semua target + bentuk hidupnya, dalam **satu** langkah undo. */
  function ubahMassal(
    ubah: (p: DrillPoint) => DrillPoint,
    pesan: string,
    ubahBentuk: ((b: BentukTerikat) => BentukTerikat) | null = null,
  ) {
    if (!set) return
    const ids = targetMassa()
    if (!ids.length) return
    const points = { ...set.points }
    let n = 0
    for (const id of ids) {
      const p0 = points[id]
      if (!p0) continue
      points[id] = ubah(p0)
      n++
    }
    if (!n) return
    snapshot() // sebelum diubah, supaya undo mengembalikan semuanya sekaligus
    const bentukBaru = sinkronkanBentukMassal(set.bentukTerikat, ids, ubahBentuk)
    set.points = points // optimistik untuk UI
    set.bentukTerikat = bentukBaru
    void writePoints(points, set.id, bentukBaru ?? null)
    toast.push(pesan, 'info')
  }

  /** Pusat putaran busur dalam **langkah** — supaya mudah dibaca & diedit. */
  const pusatPutar = {
    x: Math.round(((gerakSet.putar?.pusat.x ?? 0) / sYd) * 4) / 4,
    y: Math.round(((gerakSet.putar?.pusat.y ?? 0) / sYd) * 4) / 4,
  }

  /** Ke mana pusat putaran berpindah, dalam **langkah**. Null = berputar di tempat. */
  const pusatAkhirPutar = gerakSet.putar?.pusatAkhir
    ? {
        x: Math.round((gerakSet.putar.pusatAkhir.x / sYd) * 4) / 4,
        y: Math.round((gerakSet.putar.pusatAkhir.y / sYd) * 4) / 4,
      }
    : null

  /**
   * Ubah salah satu bagian pengaturan busur (sudut dalam derajat, pusat dalam
   * langkah). `x2`/`y2` mengatur **tujuan** pusat; `x`/`y` pusat awalnya.
   *
   * Tujuannya bersifat absolut: menggeser pusat awal tidak menggeser tujuan,
   * jadi yang berubah justru seberapa jauh lingkarannya berjalan.
   */
  function ubahPutar(patch: { sudut?: number; x?: number; y?: number; x2?: number; y2?: number }) {
    const p = gerakSet.putar?.pusat ?? { x: 0, y: 0 }
    const pa = gerakSet.putar?.pusatAkhir
    const adaAkhir = pa !== undefined || patch.x2 !== undefined || patch.y2 !== undefined
    simpanGerak({
      putar: {
        pusat: {
          x: patch.x !== undefined ? patch.x * sYd : p.x,
          y: patch.y !== undefined ? patch.y * sYd : p.y,
        },
        sudut: patch.sudut ?? gerakSet.putar?.sudut ?? 0,
        ...(adaAkhir
          ? {
              pusatAkhir: {
                x: patch.x2 !== undefined ? patch.x2 * sYd : pa?.x ?? p.x,
                y: patch.y2 !== undefined ? patch.y2 * sYd : pa?.y ?? p.y,
              },
            }
          : {}),
      },
    })
  }

  /** Kembalikan ke putaran di tempat: lingkaran tidak ikut berjalan. */
  function hapusPusatAkhir() {
    const pt = gerakSet.putar
    if (!pt) return
    const { pusatAkhir: _dibuang, ...sisa } = pt
    simpanGerak({ putar: sisa })
  }

  /**
   * Turunkan ke mana pusat putaran berpindah dari posisi pemain di set
   * berikutnya.
   *
   * Pemakai cukup menggambar set A dan set B lalu menyebut sudutnya; sisanya
   * dihitung dari kenyataan bahwa semua pemain yang ikut berputar menghasilkan
   * pergeseran pusat yang sama. Angkanya tetap bisa diubah sesudahnya.
   */
  function hitungPusatAkhir() {
    const pt = gerakSet.putar
    if (!pt) return
    if (!set || !nextSet) {
      toast.push('Butuh set berikutnya untuk menghitung perpindahan pusat', 'info')
      return
    }
    if (!pt.sudut) {
      toast.push('Tentukan sudut putar lebih dulu', 'info')
      return
    }
    const titik: { x0: number; y0: number; x1: number; y1: number }[] = []
    for (const [id, p] of Object.entries(set.points)) {
      const q = nextSet.points[id]
      if (!q) continue
      titik.push({ x0: p.x, y0: p.y, x1: q.x, y1: q.y })
    }
    const r = turunkanPusatAkhir(titik, pt.pusat, pt.sudut)
    if (!r) {
      toast.push(
        'Tidak ada kelompok pemain yang sepakat — set berikutnya bukan hasil memutar & menggeser blok ini',
        'info',
      )
      return
    }
    simpanGerak({ putar: { ...pt, pusatAkhir: { x: r.x, y: r.y } } })
    toast.push(
      `Pusat berpindah ke ${(r.x / sYd).toFixed(2)}, ${(r.y / sYd).toFixed(2)} langkah — ${r.ikut} dari ${r.dari} pemain sepakat`,
      'info',
    )
  }

  /** Titik tengah target — dipakai putar & kembang-kempis. */
  function pusatTarget(): { x: number; y: number } | null {
    if (!set) return null
    return pusatKumpulan(targetMassa().map((id) => set!.points[id]))
  }

  function putarBlok(derajat: number) {
    if (!set) return
    const c = pusatTarget()
    if (!c) return
    const ids = targetMassa()
    if (ids.length < 2) return
    const diputar = putarBebasTitik(set.points, ids, c, derajat, f, {
      snapAktif: false,
      langkahX: 0,
      langkahY: 0,
    })
    snapshot()
    const points = { ...set.points, ...diputar }
    const bentukBaru = sinkronkanBentukMassal(set.bentukTerikat, ids, (b) =>
      putarBentukTerikat(b, c, derajat, f),
    )
    set.points = points
    set.bentukTerikat = bentukBaru
    void writePoints(points, set.id, bentukBaru ?? null)
    toast.push(`${ids.length} titik diputar ${derajat}°`, 'info')

    /**
     * Jalur busur dipasang pada set **sebelumnya**, bukan set ini.
     *
     * Alasannya: `gerak` pada sebuah set mengatur perpindahan **dari** set itu
     * ke set berikutnya. Memutar blok di set 3 berarti putarannya terjadi saat
     * perpindahan set 2 → set 3. Kalau dipasang di set 3, yang ikut busur justru
     * perpindahan set 3 → set 4, dan pemain tetap terlihat mengkerut.
     */
    if (ikutBusur && prevSet && set) {
      prevSet.gerak = {
        ...gerakOf(prevSet.gerak),
        jalur: 'busur',
        putar: { pusat: { x: c.x, y: c.y }, sudut: derajat },
      }
      db.sets.update(prevSet.id, { gerak: prevSet.gerak })
      toast.push(
        `Jalur busur ${derajat}° dipasang pada ${prevSet.name} → ${set.name} — jarak antar pemain terjaga`,
        'info',
      )
    }
  }

  function ubahUkuran(faktor: number) {
    const c = pusatTarget()
    if (!c) return
    const n = targetMassa().length
    const persen = Math.abs(Math.round((faktor - 1) * 100))
    ubahMassal(
      (p) => skalaTitik(p, c, faktor),
      `${n} titik ${faktor > 1 ? `dibesarkan ${persen}%` : `dikecilkan ${persen}%`}`,
      (b) => skalaBentukTerikat(b, c, faktor, faktor, f),
    )
  }

  function cerminBlok(sumbu: 'x' | 'y') {
    if (!set) return
    const ids = targetMassa()
    if (!ids.length) return
    const ktk = porosCermin === 'pilihan' ? kotakBatasTitik(ids, set.points) : null
    const pusatPoros =
      porosCermin === 'pilihan'
        ? ktk
          ? { x: ktk.cx, y: ktk.cy }
          : (pusatTarget() ?? { x: 0, y: 0 })
        : { x: 0, y: 0 }
    const dicermin = cerminTitikFormasi(ids, set.points, f, sumbu, porosCermin, false)
    snapshot()
    const points = { ...set.points, ...dicermin }
    const bentukBaru = sinkronkanBentukMassal(set.bentukTerikat, ids, (b) =>
      cerminBentukTerikat(b, pusatPoros, sumbu, f),
    )
    set.points = points
    set.bentukTerikat = bentukBaru
    void writePoints(points, set.id, bentukBaru ?? null)
    toast.push(
      `${ids.length} titik dicerminkan ${sumbu === 'x' ? 'kiri ⇄ kanan' : 'depan ⇄ belakang'}`,
      'info',
    )
  }

  /**
   * Putar & kembang-kempis mengitari titik tengah target. Kalau cuma satu titik,
   * titik itu sendiri adalah pusatnya — jadi operasinya tidak berpengaruh apa-apa.
   */
  const bisaPutarSkala = targetMassa().length >= 2
  const bisaRatakan = targetMassa().length >= 3

  /* ------------------------------- Geometri -------------------------------- */

  /**
   * Proyeksi koordinat internal → koordinat gambar SVG.
   *
   * Sumbu internal:
   *   x = memanjang lapangan (garis yard), 0 di garis 50, positif ke arah SIDE 1
   *   y = melintang lapangan (sideline ke sideline), 0 di tengah,
   *       positif ke arah BACK SIDELINE
   *
   * Sumbu gambar (chart lanskap seperti lazimnya bagan drill):
   *   svg x = memanjang, SIDE 1 di kiri  → svgX = setengahPanjang - x
   *   svg y = melintang, BACK di atas    → svgY = setengahLebar   - y
   */
  const halfW = f.widthYd / 2
  const halfL = (f.lengthYd + f.endZoneYd * 2) / 2
  const VW = f.lengthYd + f.endZoneYd * 2
  const VH = f.widthYd

  const sx = (x: number) => halfL - x
  const sy = (y: number) => halfW - y

  /** DD4 — busur untuk perpindahan dari set aktif ke set berikutnya. */
  const busurKeluar = petaBusur(set, nextSet)
  /** DD4 — busur untuk perpindahan dari set sebelumnya ke set aktif. */
  const busurMasuk = petaBusur(prevSet, set)
  const busurRef = useRef(busurKeluar)
  busurRef.current = busurKeluar

  /** #16.1 — peta lintasan Follow-the-Leader (FTL) dalam satuan gambar SVG. */
  const ftlKeluar = useMemo(() => {
    if (!set || !nextSet || !gerakSet.kelompok?.length) return new Map()
    const awalSvg: Record<string, { x: number; y: number }> = {}
    const akhirSvg: Record<string, { x: number; y: number }> = {}
    for (const [id, pt] of Object.entries(set.points)) {
      awalSvg[id] = { x: sx(pt.x), y: sy(pt.y) }
    }
    for (const [id, pt] of Object.entries(nextSet.points)) {
      akhirSvg[id] = { x: sx(pt.x), y: sy(pt.y) }
    }
    return bangunPetaFtl(gerakSet.kelompok, awalSvg, akhirSvg)
  }, [set, nextSet, gerakSet.kelompok, sx, sy])
  const ftlRef = useRef(ftlKeluar)
  ftlRef.current = ftlKeluar

  /** #23.1 — peta titik singgah (Midsets) keluar & masuk dalam satuan gambar SVG. */
  const midsetsSvgKeluar = useMemo(() => {
    const peta = new Map<string, TitikSinggahMidset[]>()
    if (!set?.midsets) return peta
    const counts = Math.max(2, Math.floor(set.counts || 8))
    for (const [id, daftar] of Object.entries(set.midsets)) {
      const rapi = normalisasiMidsetsPemain(daftar, counts)
      if (!rapi.length) continue
      peta.set(
        id,
        rapi.map((w) => ({ ...w, x: sx(w.x), y: sy(w.y) })),
      )
    }
    return peta
  }, [set?.midsets, set?.counts, sx, sy])
  const midsetsSvgRef = useRef(midsetsSvgKeluar)
  midsetsSvgRef.current = midsetsSvgKeluar

  const midsetsSvgMasuk = useMemo(() => {
    const peta = new Map<string, TitikSinggahMidset[]>()
    if (!prevSet?.midsets) return peta
    const counts = Math.max(2, Math.floor(prevSet.counts || 8))
    for (const [id, daftar] of Object.entries(prevSet.midsets)) {
      const rapi = normalisasiMidsetsPemain(daftar, counts)
      if (!rapi.length) continue
      peta.set(
        id,
        rapi.map((w) => ({ ...w, x: sx(w.x), y: sy(w.y) })),
      )
    }
    return peta
  }, [prevSet?.midsets, prevSet?.counts, sx, sy])

  /** #16.2 — pratinjau langsung bentuk cepat di kanvas sebelum diterapkan. */
  const pratinjauTitikBentuk = useMemo(() => {
    if (!pratinjauBentukAktif || !set) return null
    const ids = selected.length
      ? selected.filter((id) => visibleIds.has(id))
      : Object.keys(set.points).filter((id) => visibleIds.has(id))
    if (!ids.length) return null
    return susunBentukCepat(ids, set.points, f, { ...opsiBentuk, snap: view.snap })
  }, [pratinjauBentukAktif, set, selected, visibleIds, f, opsiBentuk, view.snap])

  const opsiPembulatan = useMemo<OpsiPembulatanSumbu>(
    () => ({
      snapAktif: view.snap,
      langkahX: view.langkahX,
      langkahY: view.langkahY,
      hormatiPatok: true,
    }),
    [view.snap, view.langkahX, view.langkahY],
  )
  const opsiPembulatanRef = useRef(opsiPembulatan)
  opsiPembulatanRef.current = opsiPembulatan
  const kunciSumbuRef = useRef(view.kunciSumbu)
  kunciSumbuRef.current = view.kunciSumbu

  function terapkanBentukCepat() {
    if (!set) return
    const ids = selected.length
      ? selected.filter((id) => visibleIds.has(id) && Boolean(set.points[id]))
      : Object.keys(set.points).filter((id) => visibleIds.has(id))
    if (!ids.length) return
    snapshot()
    if (ikatBentukHidup && ids.length >= 2) {
      const btk = buatBentukTerikatDariOpsi(ids, set.points, f, opsiBentuk, uid('btk_'))
      if (btk) {
        const hasil = hitungTitikBentukTerikat(btk, set.points, f, opsiPembulatan)
        const pts = { ...set.points, ...hasil }
        const bentukBaru = pasangBentukTerikatPadaSet(set.bentukTerikat, btk)
        set.points = pts
        set.bentukTerikat = bentukBaru
        void writePoints(pts, set.id, bentukBaru)
        setPratinjauBentukAktif(false)
        toast.push(`${ids.length} titik diikat ke bentuk hidup (${btk.nama})`)
        return
      }
    }
    const hasil = susunBentukCepat(ids, set.points, f, { ...opsiBentuk, snap: view.snap })
    const pts = { ...set.points, ...hasil }
    const bentukBaru = lepaskanAnggotaDariBentuk(set.bentukTerikat, ids)
    set.points = pts
    set.bentukTerikat = bentukBaru
    void writePoints(pts, set.id, bentukBaru ?? null)
    setPratinjauBentukAktif(false)
    toast.push(`${ids.length} titik disusun ke bentuk baru`)
  }

  function bulatkanBentukTerikat(idBentuk: string) {
    if (!set?.bentukTerikat?.length) return
    const btk = set.bentukTerikat.find((b) => b.id === idBentuk)
    if (!btk) return
    snapshot()
    const hasil = hitungTitikBentukTerikat(btk, set.points, f, {
      snapAktif: true,
      langkahX: view.langkahX || 1,
      langkahY: view.langkahY || 1,
      hormatiPatok: true,
    })
    const pts = { ...set.points, ...hasil }
    set.points = pts
    void writePoints(pts, set.id)
    toast.push(`Koordinat ${btk.memberIds.length} titik dibulatkan ke langkah`)
  }

  async function salinBentukKeSet(idBentuk: string, arah: -1 | 1) {
    if (!set?.bentukTerikat?.length) return
    const btk = set.bentukTerikat.find((b) => b.id === idBentuk)
    const tujuan = sets[idx + arah]
    if (!btk || !tujuan) return
    const validIds = btk.memberIds.filter((id) => Boolean(tujuan.points[id] || set.points[id]))
    if (validIds.length < 2) {
      toast.push('Anggota bentuk ini belum ada di set tujuan', 'info')
      return
    }
    snapshotMany([{ id: tujuan.id, points: tujuan.points, bentukTerikat: tujuan.bentukTerikat }])
    const klon: BentukTerikat = {
      ...(JSON.parse(JSON.stringify(btk)) as BentukTerikat),
      id: uid('btk_'),
      memberIds: validIds,
    }
    const dasarTitik: Record<string, DrillPoint> = { ...set.points, ...tujuan.points }
    const hasil = hitungTitikBentukTerikat(klon, dasarTitik, f, opsiPembulatan)
    const ptsTujuan = { ...tujuan.points, ...hasil }
    const bentukTujuan = pasangBentukTerikatPadaSet(tujuan.bentukTerikat, klon)
    tujuan.points = ptsTujuan
    tujuan.bentukTerikat = bentukTujuan
    await writePoints(ptsTujuan, tujuan.id, bentukTujuan)
    toast.push(`Bentuk hidup disalin ke ${tujuan.name}`)
  }

  function lepasBentukTerikat(idBentuk: string) {
    if (!set?.bentukTerikat?.length) return
    const sisa = set.bentukTerikat.filter((b) => b.id !== idBentuk)
    snapshot()
    set.bentukTerikat = sisa.length ? sisa : undefined
    void writePoints(set.points, set.id, sisa.length ? sisa : null)
    toast.push('Ikatan bentuk dilepas — koordinat titik tetap terjaga', 'info')
  }

  /** Versi ref (dipakai handler marquee/lasso yang dipasang sekali). */
  const geomRef = useRef({ sx, sy, ix: (vx: number) => halfL - vx, iy: (vy: number) => halfW - vy })
  const ix = (vx: number) => halfL - vx
  const iy = (vy: number) => halfW - vy
  geomRef.current = { sx, sy, ix, iy }

  /** `snap` dibaca lewat ref supaya handler geser selalu memakai nilai terbaru. */
  const snapRef = useRef(snap)
  snapRef.current = snap

  const snapVal = (x: number, y: number) =>
    bulatkanKoordinatSumbu(x, y, fRef.current, opsiPembulatanRef.current)

  /* ------------------ #23.1, #23.2, & #23.3 — Helper Kanvas ------------------ */

  const viewBoxKanvas = useMemo(() => hitungViewBoxKanvas(viewport, VW, VH), [viewport, VW, VH])
  const peranAktif = useMemo(
    () =>
      peranPointerEfektif(
        view.modeInput,
        pointerTerakhir === 'sentuh' ? 'touch' : pointerTerakhir === 'pena' ? 'pen' : 'mouse',
      ),
    [view.modeInput, pointerTerakhir],
  )
  const rHitSentuh = useMemo(
    () => hitungRadiusTangkapSvg(viewBoxKanvas.width, lebarSvgPx, peranAktif, uk(1.35)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [viewBoxKanvas.width, lebarSvgPx, peranAktif, f],
  )
  const siapLetakkanRef = useRef<string | null>(null)
  siapLetakkanRef.current = siapLetakkanId

  useEffect(() => {
    const ukur = () => {
      if (svgRef.current?.clientWidth) setLebarSvgPx(svgRef.current.clientWidth)
    }
    ukur()
    window.addEventListener('resize', ukur)
    return () => window.removeEventListener('resize', ukur)
  }, [])

  function batalkanTimerBalon() {
    if (timerTekanLamaRef.current) {
      window.clearTimeout(timerTekanLamaRef.current)
      timerTekanLamaRef.current = 0
    }
  }

  function jadwalkanBalonSentuh(clientX: number, clientY: number, teks: string, peran: PeranPointer) {
    batalkanTimerBalon()
    if (peran !== 'sentuh' || !teks.trim()) return
    timerTekanLamaRef.current = window.setTimeout(() => {
      timerTekanLamaRef.current = 0
      setBalonInfo({ x: clientX, y: clientY, teks: teks.trim() })
    }, DURASI_TEKAN_LAMA_MS)
  }

  useEffect(() => {
    if (!balonInfo) return
    const id = window.setTimeout(() => setBalonInfo(null), 2800)
    return () => window.clearTimeout(id)
  }, [balonInfo])

  function ubahZoomKanvas(faktor: number) {
    setViewport((vp) => {
      const vb = hitungViewBoxKanvas(vp, VW, VH)
      return zoomSekitarTitik(vp, faktor, vb.x + vb.width / 2, vb.y + vb.height / 2, VW, VH)
    })
  }

  function resetViewportKanvas() {
    setViewport(VIEWPORT_AWAL)
  }

  function cariCountSinggahBebas(daftar: TitikSinggahMidset[], counts: number): number | null {
    const batas = Math.floor(counts)
    if (batas < 2) return null
    const urut = normalisasiMidsetsPemain(daftar, batas)
    const dipakai = new Set(urut.map((w) => Math.round(w.padaCount)))
    const tengah = Math.max(1, Math.min(batas - 1, Math.round(batas / 2)))
    if (!dipakai.has(tengah)) return tengah
    const simpul = [0, ...urut.map((w) => w.padaCount), batas]
    let celahTerbesar = 0
    let kandidat: number | null = null
    for (let i = 0; i < simpul.length - 1; i++) {
      const celah = simpul[i + 1] - simpul[i]
      const c = Math.round((simpul[i] + simpul[i + 1]) / 2)
      if (celah > celahTerbesar && c > 0 && c < batas && !dipakai.has(c)) {
        celahTerbesar = celah
        kandidat = c
      }
    }
    if (kandidat !== null) return kandidat
    for (let c = 1; c < batas; c++) {
      if (!dipakai.has(c)) return c
    }
    return null
  }

  function posisiJalurPemainYd(id: string, padaCount: number): TitikKendaliYd | null {
    if (!set || !nextSet) return null
    const p = set.points[id]
    const q = nextSet.points[id]
    if (!p || !q) return null
    const counts = Math.max(2, set.counts || 8)
    const t = Math.min(0.99, Math.max(0.01, padaCount / counts))
    const klp = kelompokPemain(gerakSet, id)
    const kAkhir = klp
      ? klp.jalur === 'lengkung'
        ? (klp.lengkung ?? 0.4)
        : 0
      : gerakSet.jalur === 'lengkung'
        ? gerakSet.lengkung
        : 0
    const mid = set.midsets?.[id]
    const [dx, dy] = mid?.length
      ? deltaMidsets(p, q, mid, counts, t, kAkhir, klp?.jalanCount ?? gerakSet.jalanCount)
      : titikJalur(t, q.x - p.x, q.y - p.y, kAkhir)
    return { x: p.x + dx, y: p.y + dy }
  }

  function tambahMidsetPemain(memberId: string) {
    if (!set || !nextSet) return
    const counts = Math.max(0, Math.floor(set.counts || 0))
    if (counts < 2) {
      toast.push('Set harus berdurasi minimal 2 hitungan untuk titik singgah', 'info')
      return
    }
    const daftarLama = normalisasiMidsetsPemain(set.midsets?.[memberId], counts)
    const countBaru = cariCountSinggahBebas(daftarLama, counts)
    if (countBaru === null) {
      toast.push('Semua hitungan pada perpindahan ini sudah memiliki titik singgah', 'info')
      return
    }
    const pos = posisiJalurPemainYd(memberId, countBaru)
    if (!pos) return
    const disnap = snapVal(pos.x, pos.y)
    snapshot()
    const baru = normalisasiMidsetsPemain(
      [...daftarLama, { padaCount: countBaru, x: disnap.x, y: disnap.y }],
      counts,
    )
    const petaBaru = { ...(set.midsets ?? {}), [memberId]: baru }
    set.midsets = petaBaru
    void writeMidsets(petaBaru, set.id)
    forceRender()
    toast.push(`Titik singgah hitungan ${countBaru} ditambahkan`)
  }

  function ubahCountMidsetPemain(memberId: string, indeks: number, padaCountBaru: number) {
    if (!set) return
    const counts = Math.max(2, Math.floor(set.counts || 8))
    const daftarLama = normalisasiMidsetsPemain(set.midsets?.[memberId], counts)
    if (!daftarLama[indeks]) return
    snapshot()
    const diubah = daftarLama.map((w, i) =>
      i === indeks
        ? { ...w, padaCount: Math.max(1, Math.min(counts - 1, Math.round(padaCountBaru))) }
        : w,
    )
    const rapi = normalisasiMidsetsPemain(diubah, counts)
    const petaBaru = { ...(set.midsets ?? {}), [memberId]: rapi }
    set.midsets = petaBaru
    void writeMidsets(petaBaru, set.id)
    forceRender()
  }

  function hapusMidsetPemain(memberId: string, indeks?: number) {
    if (!set?.midsets?.[memberId]?.length) return
    const counts = Math.max(2, Math.floor(set.counts || 8))
    const daftarLama = normalisasiMidsetsPemain(set.midsets[memberId], counts)
    snapshot()
    const sisa =
      typeof indeks === 'number' ? daftarLama.filter((_, i) => i !== indeks) : []
    const petaBaru = { ...set.midsets }
    if (sisa.length) petaBaru[memberId] = sisa
    else delete petaBaru[memberId]
    set.midsets = Object.keys(petaBaru).length ? petaBaru : undefined
    void writeMidsets(set.midsets, set.id)
    forceRender()
    toast.push('Titik singgah dihapus', 'info')
  }

  function pilihAnggotaBerTag(tag: string) {
    if (!set) return
    const cocok = roster
      .filter((m) => punyaTag(m, tag) && Boolean(set.points[m.id]) && visibleIds.has(m.id))
      .map((m) => m.id)
    setSelected(cocok)
    toast.push(
      cocok.length
        ? `${cocok.length} anggota ber-tag #${tag} dipilih`
        : `Belum ada anggota #${tag} yang ditempatkan di set ini`,
      'info',
    )
  }

  async function pasangTagKePilihan(tagMentah: string) {
    const tag = tagMentah.trim()
    if (!tag || !selected.length) return
    const target = selected
      .map((id) => rosterById.get(id))
      .filter((m): m is Member => Boolean(m))
    if (!target.length) return
    const diperbarui = target.map((m) => pasangTagKeAnggota(m, tag))
    await db.members.bulkPut(diperbarui)
    setInputTagMassal('')
    toast.push(`Tag #${tag.replace(/^#+/, '').trim()} dipasang ke ${diperbarui.length} anggota`)
  }

  async function tambahTagSatuAnggota(memberId: string, tag: string) {
    const m = rosterById.get(memberId)
    if (!m || !tag.trim()) return
    await db.members.put(pasangTagKeAnggota(m, tag))
  }

  async function hapusTagSatuAnggota(memberId: string, tag: string) {
    const m = rosterById.get(memberId)
    if (!m) return
    await db.members.put(lepasTagDariAnggota(m, tag))
  }

  /* --------------------------- Interaksi pointer --------------------------- */

  /** Konversi koordinat layar (clientX/Y) ke koordinat gambar SVG. */
  function clientToUser(clientX: number, clientY: number) {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }
    const ctm = svg.getScreenCTM()
    if (!ctm) return { x: 0, y: 0 }
    const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse())
    return { x: p.x, y: p.y }
  }

  function onPointerDownPoint(e: React.PointerEvent, memberId: string) {
    e.stopPropagation()
    const peran = peranPointerEfektif(view.modeInput, e.pointerType)
    setPointerTerakhir(peran)
    setBalonInfo(null)
    setSiapLetakkanId(null)
    if (tool === 'pan') return
    const additive = e.shiftKey || e.metaKey || e.ctrlKey
    const chosen = additive ? (selected.includes(memberId) ? selected : [...selected, memberId]) : [memberId]
    setSelected(chosen)
    const cur = setRef.current
    if (!cur) return
    const mInfo = rosterById.get(memberId)
    const pInfo = cur.points[memberId]
    if (mInfo && pInfo) {
      const infoTags = mInfo.tags?.length ? ` · #${mInfo.tags.join(' #')}` : ''
      jadwalkanBalonSentuh(
        e.clientX,
        e.clientY,
        `${mInfo.code} · ${mInfo.name} (${sectionLabel(mInfo.section)})${infoTags} — ${coorTextSafe(pInfo.x, pInfo.y, f)}`,
        peran,
      )
    }
    const orig: Record<string, DrillPoint> = {}
    for (const id of chosen) if (cur.points[id]) orig[id] = { ...cur.points[id] }
    const u = clientToUser(e.clientX, e.clientY)
    dragRef.current = { startX: u.x, startY: u.y, orig, moved: false }
  }

  /**
   * 1a — pemotretan otomatis.
   *
   * Dicek tiap menit, tetapi hanya memotret bila sudah lewat jeda sejak foto
   * terakhir DAN keadaannya benar-benar berubah — `foto()` sendiri yang
   * menolak kembaran, jadi duduk sambil membaca tidak menghasilkan apa-apa.
   *
   * Halaman yang sedang tidak terlihat dilewati: tidak ada gunanya memotret
   * keadaan yang tidak sedang dikerjakan, lagipula browser menunda timer di
   * tab yang disembunyikan sehingga waktu bacanya bisa menyesatkan.
   */
  useEffect(() => {
    if (!drill?.id) return
    let batal = false
    const timer = window.setInterval(async () => {
      if (batal || document.hidden) return
      try {
        const terakhir = await terakhirDipotret(drill.id)
        if (terakhir && Date.now() - terakhir < JEDA_OTOMATIS_MS) return
        await foto(drill.id, 'otomatis')
      } catch {
        // Pemotretan yang gagal tidak boleh mengganggu orang yang sedang
        // menyusun formasi. Keadaannya dicoba lagi satu menit berikutnya.
      }
    }, 60_000)
    return () => {
      batal = true
      window.clearInterval(timer)
    }
  }, [drill?.id])

  /**
   * Kotak pilih (marquee). Sama seperti menggeser titik: kotaknya digambar
   * LANGSUNG lewat atribut elemen <rect> dan digerakkan maksimal sekali per
   * frame, jadi tetap ringan meski timnya 80 orang.
   */
  useEffect(() => {
    function draw(ev: PointerEvent) {
      const m = marqRef.current
      if (!m) return
      const u = clientToUser(ev.clientX, ev.clientY)
      m.x1 = u.x
      m.y1 = u.y
      if (Math.abs(m.x1 - m.x0) + Math.abs(m.y1 - m.y0) > 0.5) m.moved = true
      const r = marqRectRef.current
      if (r) {
        r.setAttribute('x', String(Math.min(m.x0, m.x1)))
        r.setAttribute('y', String(Math.min(m.y0, m.y1)))
        r.setAttribute('width', String(Math.abs(m.x1 - m.x0)))
        r.setAttribute('height', String(Math.abs(m.y1 - m.y0)))
        r.style.display = ''
      }
    }

    function onMove(ev: PointerEvent) {
      if (!marqRef.current) return
      marqPending.current = ev
      if (marqRaf.current) return
      marqRaf.current = requestAnimationFrame(() => {
        marqRaf.current = 0
        const e2 = marqPending.current
        marqPending.current = null
        if (e2) draw(e2)
      })
    }

    function onUp() {
      const m = marqRef.current
      if (!m) return
      if (marqRaf.current) {
        cancelAnimationFrame(marqRaf.current)
        marqRaf.current = 0
      }
      marqPending.current = null
      marqRef.current = null
      const r = marqRectRef.current
      if (r) {
        r.style.display = 'none'
        r.setAttribute('width', '0')
        r.setAttribute('height', '0')
      }
      if (!m.moved) {
        if (siapLetakkanRef.current) {
          const { ix: gIx, iy: gIy } = geomRef.current
          const pos = snapVal(gIx(m.x0), gIy(m.y0))
          const targetId = siapLetakkanRef.current
          setSiapLetakkanId(null)
          updatePoint(targetId, pos)
          setSelected([targetId])
          return
        }
        // Klik biasa di area kosong → kosongkan pilihan (kecuali menambah).
        if (!m.additive) setSelected([])
        return
      }
      const cur = setRef.current
      if (!cur) return
      const { sx: gx, sy: gy } = geomRef.current
      const x0 = Math.min(m.x0, m.x1)
      const x1 = Math.max(m.x0, m.x1)
      const y0 = Math.min(m.y0, m.y1)
      const y1 = Math.max(m.y0, m.y1)
      const ids: string[] = []
      for (const [id, p] of Object.entries(cur.points)) {
        if (!visibleIdsRef.current.has(id)) continue
        const px = gx(p.x)
        const py = gy(p.y)
        if (px >= x0 && px <= x1 && py >= y0 && py <= y1) ids.push(id)
      }
      setSelected((prev) => (m.additive ? [...new Set([...prev, ...ids])] : ids))
      if (ids.length) toast.push(`${ids.length} titik dipilih`)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [toast])

  /**
   * #22.2 — Seleksi Lasso Poligon Bebas: seret poligon bebas di area kosong
   * ketika alat `lasso` aktif (atau sambil menahan Alt pada alat `select`).
   */
  useEffect(() => {
    let lassoRaf = 0
    let pending: PointerEvent | null = null

    function drawLasso(ev: PointerEvent) {
      const ls = lassoRef.current
      if (!ls) return
      const u = clientToUser(ev.clientX, ev.clientY)
      const prev = ls.simpulSvg[ls.simpulSvg.length - 1]
      const jarak = prev ? Math.hypot(u.x - prev.sx, u.y - prev.sy) : 999
      if (jarak > 0.35) {
        const { ix: gIx, iy: gIy } = geomRef.current
        ls.simpulSvg.push({ sx: u.x, sy: u.y })
        ls.simpulYd.push({ x: gIx(u.x), y: gIy(u.y) })
        if (ls.simpulSvg.length >= 3) ls.moved = true
      }
      const poly = lassoPolyRef.current
      if (poly && ls.simpulSvg.length >= 2) {
        poly.setAttribute(
          'points',
          ls.simpulSvg.map((p) => `${p.sx.toFixed(2)},${p.sy.toFixed(2)}`).join(' '),
        )
        poly.style.display = ''
      }
    }

    function onMove(ev: PointerEvent) {
      if (!lassoRef.current) return
      pending = ev
      if (lassoRaf) return
      lassoRaf = requestAnimationFrame(() => {
        lassoRaf = 0
        const e2 = pending
        pending = null
        if (e2) drawLasso(e2)
      })
    }

    function onUp() {
      const ls = lassoRef.current
      if (!ls) return
      if (lassoRaf) {
        cancelAnimationFrame(lassoRaf)
        lassoRaf = 0
      }
      pending = null
      lassoRef.current = null
      const poly = lassoPolyRef.current
      if (poly) {
        poly.style.display = 'none'
        poly.setAttribute('points', '')
      }
      if (!ls.moved || ls.simpulYd.length < 3) {
        if (!ls.additive) setSelected([])
        return
      }
      const cur = setRef.current
      if (!cur) return
      const ids = pilihTitikDenganLasso(cur.points, ls.simpulYd, visibleIdsRef.current)
      setSelected((prev) => {
        if (!ls.additive) return ids
        if (!ids.length) return prev
        const setPrev = new Set(prev)
        const semuaSudahAda = ids.every((id) => setPrev.has(id))
        if (semuaSudahAda) {
          const buang = new Set(ids)
          return prev.filter((id) => !buang.has(id))
        }
        return [...new Set([...prev, ...ids])]
      })
      if (ids.length) toast.push(`${ids.length} titik dipilih lewat lasso`)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [toast])

  /**
   * #22.1 & #22.3 — Interaksi seret gagang di kanvas:
   *  - `gagangBentukRef`: gagang p0/p1/c1/c2 bentuk parametrik hidup (Bézier / busur / lingkaran / blok)
   *  - `gagangSkalaRef`: 8 gagang rentang/kempis kotak batas seleksi
   *  - `gagangPutarRef`: gagang tangkai putar bebas di atas kotak seleksi
   */
  useEffect(() => {
    let gRaf = 0
    let gPending: PointerEvent | null = null

    function prosesGerakGagang(ev: PointerEvent) {
      const cur = setRef.current
      if (!cur) return
      const ff = fRef.current
      const { ix: gIx, iy: gIy } = geomRef.current
      const u = clientToUser(ev.clientX, ev.clientY)

      // 1) Gagang bentuk parametrik hidup (P0, P1, C1, C2)
      const gb = gagangBentukRef.current
      if (gb) {
        const rawDx = -(u.x - gb.startX)
        const rawDy = -(u.y - gb.startY)
        const { x: dx, y: dy } = terapkanKunciSumbu(
          { x: 0, y: 0 },
          { x: rawDx, y: rawDy },
          kunciSumbuRef.current,
        )
        if (!gb.moved) {
          if (Math.abs(dx) + Math.abs(dy) < 1e-4) return
          snapshotMany([{ id: cur.id, points: gb.origPoints, bentukTerikat: gb.origBentuk }])
          gb.moved = true
        }
        const koordBaru = jepitKeLapangan(gb.asalTitik.x + dx, gb.asalTitik.y + dy, ff)
        const opsiSnap = opsiPembulatanRef.current
        const disnap =
          ev.shiftKey || (opsiSnap.snapAktif && (gb.peran === 'p0' || gb.peran === 'p1'))
            ? bulatkanKoordinatSumbu(koordBaru.x, koordBaru.y, ff, opsiSnap)
            : {
                x: Math.round(koordBaru.x * 1000) / 1000,
                y: Math.round(koordBaru.y * 1000) / 1000,
              }
        const modeKunci = kunciSumbuRef.current
        const koordAkhir =
          modeKunci === 'hanya_x'
            ? { x: disnap.x, y: gb.asalTitik.y }
            : modeKunci === 'hanya_y'
              ? { x: gb.asalTitik.x, y: disnap.y }
              : disnap
        let targetBtk: BentukTerikat | null = null
        const nextBentuk = gb.origBentuk.map((b) => {
          if (b.id !== gb.idBentuk) return b
          const diubah: BentukTerikat = { ...b, [gb.peran]: koordAkhir }
          targetBtk = diubah
          return diubah
        })
        if (!targetBtk) return
        const dievaluasi = hitungTitikBentukTerikat(
          targetBtk,
          gb.origPoints,
          ff,
          opsiPembulatanRef.current,
        )
        const nextPoints = { ...gb.origPoints, ...dievaluasi }
        gb.nextBentuk = nextBentuk
        gb.nextPoints = nextPoints
        cur.points = nextPoints
        cur.bentukTerikat = nextBentuk
        forceRender()
        return
      }

      // 2) Gagang rentang / kempis kotak seleksi (8 sudut/sisi)
      const gs = gagangSkalaRef.current
      if (gs) {
        const rawDx = -(u.x - gs.startX)
        const rawDy = -(u.y - gs.startY)
        const { x: dx, y: dy } = terapkanKunciSumbu(
          { x: 0, y: 0 },
          { x: rawDx, y: rawDy },
          kunciSumbuRef.current,
        )
        if (!gs.moved) {
          if (Math.abs(dx) + Math.abs(dy) < 1e-4) return
          snapshotMany([
            {
              id: cur.id,
              points: gs.origPoints,
              bentukTerikat: gs.origBentuk.length ? gs.origBentuk : undefined,
            },
          ])
          gs.moved = true
        }
        const posBaruYd = { x: gIx(gs.startX) + dx, y: gIy(gs.startY) + dy }
        const { points: direntang, jangkar, fx, fy } = rentangTitikKotakBatas(
          gs.origPoints,
          gs.ids,
          gs.kotakAwal,
          gs.sudut,
          posBaruYd,
          ff,
          opsiPembulatanRef.current,
        )
        const nextPoints = { ...gs.origPoints, ...direntang }
        const nextBentuk = sinkronkanBentukMassal(
          gs.origBentuk.length ? gs.origBentuk : undefined,
          gs.ids,
          (b) => skalaBentukTerikat(b, jangkar, fx, fy, ff),
        )
        gs.nextPoints = nextPoints
        gs.nextBentuk = nextBentuk
        cur.points = nextPoints
        cur.bentukTerikat = nextBentuk
        forceRender()
        return
      }

      // 3) Gagang putar bebas kotak seleksi
      const gp = gagangPutarRef.current
      if (gp) {
        const xYd = gIx(u.x)
        const yYd = gIy(u.y)
        const sudutKini = Math.atan2(yYd - gp.pusat.y, xYd - gp.pusat.x)
        let deg = ((sudutKini - gp.sudutAwalRad) * 180) / Math.PI
        while (deg > 180) deg -= 360
        while (deg < -180) deg += 360
        deg = ev.shiftKey ? Math.round(deg / 15) * 15 : Math.round(deg * 2) / 2
        if (!gp.moved) {
          if (Math.abs(deg) < 0.4) return
          snapshotMany([
            {
              id: cur.id,
              points: gp.origPoints,
              bentukTerikat: gp.origBentuk.length ? gp.origBentuk : undefined,
            },
          ])
          gp.moved = true
        }
        const diputar = putarBebasTitik(gp.origPoints, gp.ids, gp.pusat, deg, ff, {
          snapAktif: false,
          langkahX: 0,
          langkahY: 0,
        })
        const nextPoints = { ...gp.origPoints, ...diputar }
        const nextBentuk = sinkronkanBentukMassal(
          gp.origBentuk.length ? gp.origBentuk : undefined,
          gp.ids,
          (b) => putarBentukTerikat(b, gp.pusat, deg, ff),
        )
        gp.derajatTerakhir = deg
        gp.nextPoints = nextPoints
        gp.nextBentuk = nextBentuk
        cur.points = nextPoints
        cur.bentukTerikat = nextBentuk
        setSudutPutarBebas(deg)
        forceRender()
        return
      }

      // 4) #23.1 — Gagang titik singgah (Midset) di garis jejak biru kanvas
      const gm = gagangMidsetRef.current
      if (gm) {
        const rawDx = -(u.x - gm.startX)
        const rawDy = -(u.y - gm.startY)
        const { x: dx, y: dy } = terapkanKunciSumbu(
          { x: 0, y: 0 },
          { x: rawDx, y: rawDy },
          kunciSumbuRef.current,
        )
        if (!gm.moved) {
          if (Math.abs(dx) + Math.abs(dy) < 1e-4) return
          snapshotMany([
            {
              id: cur.id,
              points: cur.points,
              bentukTerikat: cur.bentukTerikat,
              midsets: Object.keys(gm.origMidsets).length ? gm.origMidsets : undefined,
            },
          ])
          gm.moved = true
        }
        const dijepit = jepitKeLapangan(gm.asalTitik.x + dx, gm.asalTitik.y + dy, ff)
        const disnap = bulatkanKoordinatSumbu(dijepit.x, dijepit.y, ff, opsiPembulatanRef.current)
        const modeKunci = kunciSumbuRef.current
        const koordAkhir =
          modeKunci === 'hanya_x'
            ? { x: disnap.x, y: gm.asalTitik.y }
            : modeKunci === 'hanya_y'
              ? { x: gm.asalTitik.x, y: disnap.y }
              : disnap
        const counts = Math.max(2, Math.floor(cur.counts || 8))
        const daftarAsal = normalisasiMidsetsPemain(gm.origMidsets[gm.memberId], counts)
        const entriBaru: TitikSinggahMidset = {
          ...(gm.indeks >= 0 && daftarAsal[gm.indeks]
            ? daftarAsal[gm.indeks]
            : { padaCount: gm.padaCount }),
          padaCount: gm.padaCount,
          x: koordAkhir.x,
          y: koordAkhir.y,
        }
        const gabungan =
          gm.indeks >= 0
            ? daftarAsal.map((w, i) => (i === gm.indeks ? entriBaru : w))
            : [...daftarAsal, entriBaru]
        const rapi = normalisasiMidsetsPemain(gabungan, counts)
        const nextMidsets = { ...gm.origMidsets, [gm.memberId]: rapi }
        gm.nextMidsets = nextMidsets
        cur.midsets = nextMidsets
        forceRender()
      }
    }

    function onMove(ev: PointerEvent) {
      if (
        !gagangBentukRef.current &&
        !gagangSkalaRef.current &&
        !gagangPutarRef.current &&
        !gagangMidsetRef.current
      )
        return
      gPending = ev
      if (gRaf) return
      gRaf = requestAnimationFrame(() => {
        gRaf = 0
        const e2 = gPending
        gPending = null
        if (e2) prosesGerakGagang(e2)
      })
    }

    function onUp() {
      if (gRaf) {
        cancelAnimationFrame(gRaf)
        gRaf = 0
      }
      gPending = null
      const cur = setRef.current

      const gb = gagangBentukRef.current
      gagangBentukRef.current = null
      if (gb?.moved && gb.nextPoints && cur) {
        void writePoints(gb.nextPoints, cur.id, gb.nextBentuk ?? null)
      }

      const gs = gagangSkalaRef.current
      gagangSkalaRef.current = null
      if (gs?.moved && gs.nextPoints && cur) {
        void writePoints(gs.nextPoints, cur.id, gs.nextBentuk ?? null)
      }

      const gp = gagangPutarRef.current
      gagangPutarRef.current = null
      setSudutPutarBebas(null)
      if (gp?.moved && gp.nextPoints && cur) {
        void writePoints(gp.nextPoints, cur.id, gp.nextBentuk ?? null)
      }

      const gm = gagangMidsetRef.current
      gagangMidsetRef.current = null
      if (gm && cur) {
        if (gm.moved && gm.nextMidsets) {
          void writeMidsets(gm.nextMidsets, cur.id)
        } else if (gm.baruDibuat && !gm.moved) {
          // Ketuk tunggal pada gagang '+' jejak biru tetap menyisipkan titik singgah di tempatnya
          snapshotMany([
            {
              id: cur.id,
              points: cur.points,
              bentukTerikat: cur.bentukTerikat,
              midsets: Object.keys(gm.origMidsets).length ? gm.origMidsets : undefined,
            },
          ])
          const counts = Math.max(2, Math.floor(cur.counts || 8))
          const disnap = bulatkanKoordinatSumbu(
            gm.asalTitik.x,
            gm.asalTitik.y,
            fRef.current,
            opsiPembulatanRef.current,
          )
          const daftar = normalisasiMidsetsPemain(
            [...(gm.origMidsets[gm.memberId] ?? []), { padaCount: gm.padaCount, x: disnap.x, y: disnap.y }],
            counts,
          )
          const petaBaru = { ...gm.origMidsets, [gm.memberId]: daftar }
          cur.midsets = petaBaru
          void writeMidsets(petaBaru, cur.id)
          forceRender()
        }
      }
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [writePoints, writeMidsets])
  /**
   * Karena saat menggeser React tidak di-render ulang, panel koordinat
   * diperbarui langsung lewat DOM supaya angkanya tetap hidup.
   * Hanya untuk satu titik terpilih (kasus yang paling sering).
   */
  function updateLiveReadout(points: Record<string, DrillPoint>) {
    const ids = Object.keys(points)
    if (ids.length !== 1) return
    const p = points[ids[0]]
    const el = document.querySelector('[data-live-coord]')
    if (el) el.textContent = coorTextSafe(p.x, p.y, f)
    const ixEl = document.querySelector<HTMLInputElement>('[data-live-x]')
    if (ixEl) ixEl.value = String(Math.round((p.x / sYd) * 4) / 4)
    const iyEl = document.querySelector<HTMLInputElement>('[data-live-y]')
    if (iyEl) iyEl.value = String(Math.round(((p.y + f.widthYd / 2) / sYd) * 4) / 4)
  }

  /**
   * Pemindahan titik dipasang di `window`, bukan di elemen SVG.
   * Alasannya: jari/mouse bisa keluar dari area gambar saat menggeser, dan
   * cara ini juga menghindari masalah `setPointerCapture` di sebagian browser.
   */
  useEffect(() => {
    /** Terapkan satu kali pergerakan pointer (dipanggil maksimal sekali per frame). */
    function applyMove(e: PointerEvent) {
      const d = dragRef.current
      const cur = setRef.current
      if (!d || !cur) return
      const u = clientToUser(e.clientX, e.clientY)
      // svg x berlawanan arah dengan internal x, begitu juga sumbu y
      const rawDx = -(u.x - d.startX)
      const rawDy = -(u.y - d.startY)
      const { x: dx, y: dy } = terapkanKunciSumbu(
        { x: 0, y: 0 },
        { x: rawDx, y: rawDy },
        kunciSumbuRef.current,
      )
      if (!d.moved) {
        // Abaikan getaran kecil, lalu simpan riwayat sekali di awal geseran.
        if (Math.abs(dx) + Math.abs(dy) < 1e-6) return
        batalkanTimerBalon()
        setBalonInfo(null)
        snapshot()
        d.moved = true
      }
      // `d.next` belum ada di gerakan pertama → mulai dari SEMUA titik set aktif,
      // lalu timpa hanya titik yang digeser.
      const modeKunci = kunciSumbuRef.current
      const points: Record<string, DrillPoint> = { ...(d.next ?? cur.points) }
      for (const [id, p0] of Object.entries(d.orig)) {
        const sMentah = snapVal(p0.x + dx, p0.y + dy)
        const s =
          modeKunci === 'hanya_x'
            ? { x: sMentah.x, y: p0.y }
            : modeKunci === 'hanya_y'
              ? { x: p0.x, y: sMentah.y }
              : sMentah
        points[id] = { ...p0, ...s }
        // Geser elemen <g> titik langsung — tanpa render ulang React.
        const g = dotRefs.current.get(id)
        if (g) g.setAttribute('transform', `translate(${sx(s.x) - sx(p0.x)} ${sy(s.y) - sy(p0.y)})`)
      }
      d.next = points
      if (pathsRef.current) pathsRef.current.style.opacity = '0.25'
      updateLiveReadout(points)
    }

    function onMove(e: PointerEvent) {
      if (!dragRef.current) return
      pendingEv.current = e
      if (rafRef.current) return
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0
        const ev = pendingEv.current
        pendingEv.current = null
        if (ev) applyMove(ev)
      })
    }

    function onUp() {
      batalkanTimerBalon()
      const d = dragRef.current
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = 0
      }
      pendingEv.current = null
      dragRef.current = null
      if (!d) return
      if (pathsRef.current) pathsRef.current.style.opacity = ''
      if (d.moved && d.next && setRef.current) {
        const cur = setRef.current
        const idsGeser = Object.keys(d.orig)
        const idContoh = idsGeser[0]
        const dxAkhir = idContoh && d.next[idContoh] ? d.next[idContoh].x - d.orig[idContoh].x : 0
        const dyAkhir = idContoh && d.next[idContoh] ? d.next[idContoh].y - d.orig[idContoh].y : 0
        const bentukBaru = sinkronkanBentukMassal(cur.bentukTerikat, idsGeser, (b) =>
          geserBentukTerikat(b, dxAkhir, dyAkhir, fRef.current),
        )
        cur.points = d.next
        cur.bentukTerikat = bentukBaru
        void writePoints(d.next, cur.id, bentukBaru ?? null)
        forceRender()
      }
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [writePoints])

  /**
   * Menyentuh area kosong lapangan:
   * - seret → kotak pilih (marquee), semua titik di dalamnya akan terpilih;
   * - klik tanpa menggeser → kosongkan pilihan.
   */
  /**
   * A7 — mengambil satu titik penanda dari sentuhan di lapangan.
   * Dipasang di **fase capture** (lihat `onPointerDownCapture` pada <svg>)
   * karena kalau dipasang biasa, klik yang kebetulan kena titik pemain
   * dihentikan lebih dulu oleh `onPointerDownPoint`.
   */
  function ambilTitikPenanda(e: React.PointerEvent) {
    if (!petik) return
    e.preventDefault()
    e.stopPropagation()
    const u = clientToUser(e.clientX, e.clientY)
    const p = snapVal(ix(u.x), iy(u.y))
    if (butuhDuaTitik(petik.draf.jenis) && petik.tahap === 1) {
      setPetik({ draf: { ...petik.draf, x: p.x, y: p.y }, tahap: 2 })
      toast.push('Titik awal ditandai — sentuh lagi untuk ujungnya', 'info')
      return
    }
    const hasil: FieldMarker = butuhDuaTitik(petik.draf.jenis)
      ? { ...petik.draf, x2: p.x, y2: p.y }
      : { ...petik.draf, x: p.x, y: p.y }
    setPetik(null)
    setEditPenanda({ draf: hasil, baru: true })
  }

  function onFieldClick(e: React.PointerEvent) {
    if (!set) return
    const peran = peranPointerEfektif(view.modeInput, e.pointerType)
    setPointerTerakhir(peran)
    setBalonInfo(null)
    if (svgRef.current?.clientWidth) setLebarSvgPx(svgRef.current.clientWidth)

    // #23.3 — lacak multi-jari untuk cubit 2 jari (pinch-to-zoom)
    if (e.pointerType === 'touch' || peran === 'sentuh') {
      jariAktifRef.current.set(e.pointerId, {
        awalX: e.clientX,
        awalY: e.clientY,
        kiniX: e.clientX,
        kiniY: e.clientY,
      })
      if (jariAktifRef.current.size === 2 && svgRef.current) {
        const entri = [...jariAktifRef.current.entries()]
        const r = svgRef.current.getBoundingClientRect()
        cubitAwalRef.current = {
          vpAwal: viewportRef.current,
          idA: entri[0][0],
          idB: entri[1][0],
          awalA: { x: entri[0][1].kiniX, y: entri[0][1].kiniY },
          awalB: { x: entri[1][1].kiniX, y: entri[1][1].kiniY },
          rect: { left: r.left, top: r.top, width: r.width, height: r.height },
        }
        panGeserRef.current = null
        marqRef.current = null
        lassoRef.current = null
        dragRef.current = null
        return
      }
    }

    const u = clientToUser(e.clientX, e.clientY)
    const additive = e.shiftKey || e.metaKey || e.ctrlKey
    const aksi = aksiSeretKanvasKosong({ peran, alat: tool, altKey: e.altKey })
    if (aksi === 'lasso') {
      lassoRef.current = {
        simpulYd: [{ x: ix(u.x), y: iy(u.y) }],
        simpulSvg: [{ sx: u.x, sy: u.y }],
        moved: false,
        additive,
      }
      return
    }
    if (aksi === 'pan' && svgRef.current) {
      const r = svgRef.current.getBoundingClientRect()
      panGeserRef.current = {
        pointerId: e.pointerId,
        startClientX: e.clientX,
        startClientY: e.clientY,
        vpAwal: viewportRef.current,
        rect: { left: r.left, top: r.top, width: Math.max(1, r.width), height: Math.max(1, r.height) },
        moved: false,
        additive,
      }
      return
    }
    marqRef.current = {
      x0: u.x,
      y0: u.y,
      x1: u.x,
      y1: u.y,
      moved: false,
      additive,
    }
  }

  /**
   * #23.3 — Geser kanvas 1 jari (`panGeserRef`), cubit 2 jari (`cubitAwalRef`),
   * dan roda tetikus `Ctrl+Wheel` untuk memperbesar/memperkecil lapangan.
   */
  useEffect(() => {
    function onMove(ev: PointerEvent) {
      const jari = jariAktifRef.current.get(ev.pointerId)
      if (jari) {
        jari.kiniX = ev.clientX
        jari.kiniY = ev.clientY
      }
      const cubit = cubitAwalRef.current
      if (cubit && jariAktifRef.current.size >= 2) {
        const jA = jariAktifRef.current.get(cubit.idA)
        const jB = jariAktifRef.current.get(cubit.idB)
        if (jA && jB) {
          setViewport(
            hitungCubitDuaJari(
              cubit.awalA,
              cubit.awalB,
              { x: jA.kiniX, y: jA.kiniY },
              { x: jB.kiniX, y: jB.kiniY },
              cubit.vpAwal,
              cubit.rect,
              VW,
              VH,
            ),
          )
        }
        return
      }

      const pg = panGeserRef.current
      if (!pg || pg.pointerId !== ev.pointerId) return
      const dxPx = ev.clientX - pg.startClientX
      const dyPx = ev.clientY - pg.startClientY
      if (!pg.moved && Math.hypot(dxPx, dyPx) < AMBANG_GESER_PX) return
      pg.moved = true
      const lebarView = VW / pg.vpAwal.zoom
      const tinggiView = VH / pg.vpAwal.zoom
      const panX = pg.vpAwal.panX - (dxPx / pg.rect.width) * lebarView
      const panY = pg.vpAwal.panY - (dyPx / pg.rect.height) * tinggiView
      setViewport(jepitViewport({ zoom: pg.vpAwal.zoom, panX, panY }, VW, VH))
    }

    function onUp(ev: PointerEvent) {
      jariAktifRef.current.delete(ev.pointerId)
      if (jariAktifRef.current.size < 2) {
        cubitAwalRef.current = null
      }
      const pg = panGeserRef.current
      if (!pg || pg.pointerId !== ev.pointerId) return
      panGeserRef.current = null
      if (!pg.moved) {
        if (siapLetakkanRef.current) {
          const u = clientToUser(ev.clientX, ev.clientY)
          const { ix: gIx, iy: gIy } = geomRef.current
          const pos = snapVal(gIx(u.x), gIy(u.y))
          const targetId = siapLetakkanRef.current
          setSiapLetakkanId(null)
          updatePoint(targetId, pos)
          setSelected([targetId])
          return
        }
        if (!pg.additive) setSelected([])
      }
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [VW, VH])

  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    function onWheel(e: WheelEvent) {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      const u = clientToUser(e.clientX, e.clientY)
      const faktor = e.deltaY < 0 ? 1.18 : 1 / 1.18
      setViewport((vp) => zoomSekitarTitik(vp, faktor, u.x, u.y, VW, VH))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [VW, VH])

  /**
   * B3 — jalankan (atau hentikan) urutan latihan: semua set dimainkan
   * berurutan mengikuti tempo. Dipakai tombol ▶▶ dan tombol R.
   */
  const mulaiUrutan = useCallback(() => {
    if (urutan) {
      setUrutan(false)
      setPlaying(false)
      return
    }
    if (sets.length < 2) return
    // Kalau sedang di set terakhir, ulang dari set pertama.
    if (idx >= sets.length - 1) setIdx(0)
    setUrutan(true)
    setPlaying(true)
  }, [urutan, sets.length, idx])

  /* ------------------------------ Keyboard --------------------------------- */

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // #23.4 — Ctrl+K / ⌘K membuka/menutup Palet Perintah dari mana saja (termasuk dari input).
      if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        setBantuan((v) => !v)
        return
      }
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      // Undo / redo bisa dipakai kapan saja, bahkan tanpa titik terpilih.
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
        return
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault()
        redo()
        return
      }
      // Pilih semua titik yang tampil (Ctrl+A) & batalkan pilihan (Esc).
      if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault()
        setSelected(Object.keys(set?.points ?? {}).filter((id) => visibleIdsRef.current.has(id)))
        return
      }
      if (e.key === 'Escape') {
        // A7 — kalau sedang memetik penanda, Esc membatalkannya dulu.
        if (petik) {
          setPetik(null)
          return
        }
        if (siapLetakkanRef.current) {
          setSiapLetakkanId(null)
          return
        }
        setSelected([])
        return
      }
      // 'F' = buka mode presenter (layar penuh).
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault()
        setPresenter(true)
        return
      }
      // Spasi = mainkan/jeda perpindahan ke set berikutnya.
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault()
        setUrutan(false)
        if (!nextSet) {
          toast.push('Tidak ada set berikutnya', 'info')
          return
        }
        setPlaying((p) => !p)
        return
      }
      // Ctrl+D = duplikat set aktif (sama seperti tombol "Duplikat").
      if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault()
        void duplicateSet()
        return
      }
      // '[' dan ']' = mundur / maju set.
      if (e.key === '[' || e.key === ']') {
        e.preventDefault()
        setIdx((i) => Math.max(0, Math.min(sets.length - 1, i + (e.key === ']' ? 1 : -1))))
        return
      }
      /**
       * DD9 — ',' dan '.' = mundur / maju **satu hitungan**.
       * Melangkah dari posisi terakhir (animasi atau scrub), dan otomatis
       * memakai mode per hitungan supaya bilahnya sejajar.
       */
      if (e.key === ',' || e.key === '.') {
        e.preventDefault()
        const counts = Math.max(1, set?.counts ?? 0)
        const langkah = 1 / counts
        const p = Math.min(1, Math.max(0, posisiRef.current + (e.key === '.' ? langkah : -langkah)))
        if (!view.perHitungan) ubah('perHitungan', true)
        if (!nextSet) {
          toast.push('Tidak ada set berikutnya', 'info')
          return
        }
        geserKe(p)
        if (sliderRef.current) sliderRef.current.value = String(Math.round(p * counts))
        return
      }
      // 'K' = kode pemain · 'J' = jejak gerak (masuk & keluar sekaligus).
      if (e.key === 'k' || e.key === 'K') {
        e.preventDefault()
        ubah('kode', !view.kode)
        return
      }
      // 'R' = urutan latihan (B3): mainkan semua set berurutan.
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault()
        mulaiUrutan()
        return
      }
      // 'L' = ulang terus (B2).
      if (e.key === 'l' || e.key === 'L') {
        e.preventDefault()
        ubah('ulang', !view.ulang)
        return
      }
      // 'M' = penanda lapangan (A7).
      if (e.key === 'm' || e.key === 'M') {
        e.preventDefault()
        ubah('penanda', !view.penanda)
        return
      }
      if (e.key === 'j' || e.key === 'J') {
        e.preventDefault()
        const hidup = view.jalur || view.masuk
        ubah('jalur', !hidup)
        ubah('masuk', !hidup)
        return
      }
      // '?' = buka daftar shortcut.
      if (e.key === '?') {
        e.preventDefault()
        setBantuan((v) => !v)
        return
      }
      // #22.4 — 'X' / 'Y' tanpa Ctrl/Meta: kunci sumbu gerak (X = kiri-kanan, Y = depan-belakang).
      if (!e.ctrlKey && !e.metaKey && !e.altKey && (e.key === 'x' || e.key === 'X')) {
        e.preventDefault()
        const baru = view.kunciSumbu === 'hanya_x' ? 'bebas' : 'hanya_x'
        ubah('kunciSumbu', baru)
        toast.push(
          baru === 'hanya_x' ? 'Sumbu dikunci ke X (kiri–kanan)' : 'Kunci sumbu dibuka (bebas)',
          'info',
        )
        return
      }
      if (!e.ctrlKey && !e.metaKey && !e.altKey && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault()
        const baru = view.kunciSumbu === 'hanya_y' ? 'bebas' : 'hanya_y'
        ubah('kunciSumbu', baru)
        toast.push(
          baru === 'hanya_y'
            ? 'Sumbu dikunci ke Y (depan–belakang)'
            : 'Kunci sumbu dibuka (bebas)',
          'info',
        )
        return
      }
      if (!selected.length || !set) return
      // Delete / Backspace = keluarkan titik terpilih dari set (bisa di-undo).
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        const points = { ...set.points }
        let hilang = 0
        for (const id of selected) if (points[id]) { delete points[id]; hilang++ }
        if (!hilang) return
        snapshot()
        const bentukBaru = lepaskanAnggotaDariBentuk(set.bentukTerikat, selected)
        set.points = points
        set.bentukTerikat = bentukBaru
        void writePoints(points, set.id, bentukBaru ?? null)
        setSelected([])
        toast.push(`${hilang} titik dikeluarkan dari ${set.name}`, 'info')
        return
      }
      const step = e.shiftKey ? sYd * 4 : sYd
      let rawDx = 0
      let rawDy = 0
      if (e.key === 'ArrowLeft') rawDx = -step
      else if (e.key === 'ArrowRight') rawDx = step
      else if (e.key === 'ArrowUp') rawDy = step // ke back sideline
      else if (e.key === 'ArrowDown') rawDy = -step
      else if (e.key === 'Escape') setSelected([])
      else return
      e.preventDefault()
      const { x: dx, y: dy } = terapkanKunciSumbu(
        { x: 0, y: 0 },
        { x: rawDx, y: rawDy },
        view.kunciSumbu,
      )
      if (dx === 0 && dy === 0) return
      const points = { ...set.points }
      for (const id of selected) {
        const p0 = points[id]
        if (!p0) continue
        points[id] = { ...p0, x: p0.x + dx, y: p0.y + dy }
      }
      snapshot()
      const bentukBaru = sinkronkanBentukMassal(set.bentukTerikat, selected, (b) =>
        geserBentukTerikat(b, dx, dy, f),
      )
      set.points = points
      set.bentukTerikat = bentukBaru
      void writePoints(points, set.id, bentukBaru ?? null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // `snapshot`, `undo`, `redo` sengaja tidak dicantumkan: isinya hanya
    // memakai ref & setter yang stabil, jadi tidak perlu pasang ulang listener.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // `petik` ikut dicantumkan supaya penanganan Escape selalu membaca kondisi
    // terbaru (kalau tidak, Esc tidak bisa membatalkan pemetikan penanda —
    // closure-nya masih berisi nilai lama). `mulaiUrutan` & `duplicateSet`
    // juga wajib: keduanya membaca state (`urutan`, `idx`, `set`), jadi tanpa
    // ini tombol R / Ctrl+D bisa memakai nilai yang sudah basi.
  }, [selected, set, sYd, writePoints, sets.length, nextSet, view, toast, petik, mulaiUrutan, duplicateSet])

  /* ------------------------------- Playback -------------------------------- */

  /** Vektor gerak tiap pemain (satuan gambar SVG) — dipakai animasi & scrub. */
  const vektorGerak = useCallback(() => {
    const out: [string, number, number][] = []
    if (!set || !nextSet) return out
    for (const [id, p] of Object.entries(set.points)) {
      const q = nextSet.points[id]
      if (!q || !visibleIds.has(id)) continue
      out.push([id, sx(q.x) - sx(p.x), sy(q.y) - sy(p.y)])
    }
    return out
  }, [set, nextSet, sx, sy, visibleIds])

  /** Tulis "Count x/y" ke semua penanda hitungan (toolbar & bilah animasi). */
  const tulisCount = useCallback((p: number) => {
    const counts = Math.max(1, set?.counts ?? 8)
    const teks = `Count ${Math.min(counts, Math.ceil(p * counts) || 0)}/${set?.counts ?? 0}`
    document.querySelectorAll('[data-live-count]').forEach((el) => {
      el.textContent = teks
    })
  }, [set?.counts])

  /** B2 — pindahkan titik ke posisi ke-p (0..1) tanpa animasi (scrub). */
  const geserKe = useCallback(
    (p: number) => {
      if (playing) setPlaying(false)
      jepretRef.current = p
      posisiRef.current = p
      const gr = gerakRef.current
      const lengkungScrub = gr.jalur === 'lengkung' ? gr.lengkung : 0
      const countsScrub = Math.max(1, set?.counts ?? 8)
      for (const [id, vx, vy] of vektorGerak()) {
        const g = dotRefs.current.get(id)
        if (!g) continue
        const ikut = seksiAnimasi === 'all' || seksiMember.get(id) === seksiAnimasi
        if (!ikut || p <= 0) g.removeAttribute('transform')
        else {
          // DD2/DD4/#16 — hitungan yang sama dengan animasi: tunda per section,
          // ripple, Move+Hold, FTL, jalur sub-kelompok, atau busur.
          const t = progresPemain(p, gr, seksiMember.get(id), countsScrub, id)
          const ftl = ftlRef.current.get(id)
          const midSvg = midsetsSvgRef.current.get(id)
          const klp = kelompokPemain(gr, id)
          const bs = busurKeluar.get(id)
          const pAsal = set?.points[id]
          const kAkhir = klp
            ? klp.jalur === 'lengkung'
              ? (klp.lengkung ?? 0.4)
              : 0
            : lengkungScrub
          const [tx, ty] = ftl
            ? deltaPoliFtl(ftl, t)
            : midSvg && pAsal
              ? deltaMidsets(
                  { x: sx(pAsal.x), y: sy(pAsal.y) },
                  { x: sx(pAsal.x) + vx, y: sy(pAsal.y) + vy },
                  midSvg,
                  countsScrub,
                  p,
                  kAkhir,
                  klp?.jalanCount ?? gr.jalanCount,
                )
              : klp
                ? titikJalur(t, vx, vy, klp.jalur === 'lengkung' ? (klp.lengkung ?? 0.4) : 0)
                : bs
                  ? deltaBusur(t, bs.x0, bs.y0, bs.pusat, bs.sudut, bs.geser ?? { x: 0, y: 0 })
                  : titikJalur(t, vx, vy, lengkungScrub)
          g.setAttribute('transform', `translate(${tx} ${ty})`)
        }
      }
      setProgress(p)
      tulisCount(p)
      segarkanBiramaDrill(idx, p)

      // #6 — sinkronkan posisi scrubber ke audio bila lagu memiliki rekaman
      if (lagu?.rekaman && petaSet?.[idx]) {
        /*
         * #6 — posisi di berkas rekaman selalu dihitung pada tempo PARTITUR,
         * bukan tempo latihan: rekaman itu partitur yang dipercepat atau
         * diperlambat lewat `playbackRate`, jadi detiknya tidak berubah.
         * Dulu durasi set di sini memakai `tempoUntuk` (tempo latihan),
         * sehingga penanda scrubber meleset dari bunyinya setiap kali
         * tempo latihan bukan 100%.
         */
        const posAudio = (lagu.rekaman.titikMulaiDetik || 0) + petaSet[idx].detikMulai + p * petaSet[idx].detik
        PemutarRekaman.get().lompat(posAudio)
      }
    },
    [playing, vektorGerak, seksiAnimasi, seksiMember, tulisCount, segarkanBiramaDrill, lagu?.rekaman, petaSet, idx, set?.counts, drill.beatsPerCount, tempoUntuk],
  )

  /**
   * #5 sisa — lompat ke sebuah hitungan dari penggaris: pilih set yang
   * memuatnya, lalu geser posisi animasi ke hitungan itu di dalam set.
   */
  function keHitungan(h: number) {
    if (!penggaris || penggaris.set.length === 0) return
    const blok =
      penggaris.set.find((b) => h >= b.mulai - 1e-9 && h < b.akhir - 1e-9) ??
      penggaris.set[penggaris.set.length - 1]
    if (!blok) return
    const p = Math.min(1, Math.max(0, (h - blok.mulai) / Math.max(1, blok.hitungan)))
    setGeserPending({ idx: blok.index, p })
    // Ketukan yang menunjuk set lain harus benar-benar berpindah set dulu;
    // kalau tidak, permintaan gesernya menunggu selamanya.
    if (blok.index !== idx) setIdx(blok.index)
  }

  /** #24.1 — Lompat scrubber tepat ke hitungan benturan & pilih pemain yang terlibat. */
  function fokusBenturan(k: KejadianTabrakan) {
    const counts = Math.max(1, set?.counts ?? 8)
    const p = Math.min(1, Math.max(0, k.padaCount / counts))
    if (sliderRef.current) {
      sliderRef.current.value = String(view.perHitungan ? Math.round(p * counts) : p)
    }
    geserKe(p)
    setSelected(k.jenis === 'pemain_properti' ? [k.idA] : [k.idA, k.idB])
  }

  /** #24.4 — Tukar tujuan satu pasangan silang di set berikutnya (Undo 1 langkah). */
  function tukarSatuPasangan(saran: SaranTukarSilang) {
    if (!set || !nextSet) return
    snapshotMany([
      { id: set.id, points: set.points, bentukTerikat: set.bentukTerikat, midsets: set.midsets },
      {
        id: nextSet.id,
        points: nextSet.points,
        bentukTerikat: nextSet.bentukTerikat,
        midsets: nextSet.midsets,
      },
    ])
    const ptsTujuan = terapkanTukarTujuan(nextSet.points, [saran])
    const bentukTujuan = tukarAnggotaPadaBentukTerikat(nextSet.bentukTerikat, [saran])
    nextSet.points = ptsTujuan
    nextSet.bentukTerikat = bentukTujuan
    void writePoints(ptsTujuan, nextSet.id, bentukTujuan ?? null)
    setIdPratinjauTukar(null)
    forceRender()
    toast.push(
      `Tujuan ${saran.kodeA} ↔ ${saran.kodeB} ditukar di ${nextSet.name} (hemat ${saran.hematLangkah.toFixed(1)} langkah)`,
    )
  }

  /** #24.4 — Urai seluruh jalur bersilangan 2-Opt sekaligus di set berikutnya. */
  function tukarSemuaSilang() {
    if (!set || !nextSet || !saranTukarSilang.length) return
    snapshotMany([
      { id: set.id, points: set.points, bentukTerikat: set.bentukTerikat, midsets: set.midsets },
      {
        id: nextSet.id,
        points: nextSet.points,
        bentukTerikat: nextSet.bentukTerikat,
        midsets: nextSet.midsets,
      },
    ])
    const hasil = selesaikanSemuaSilang2Opt({
      dari: set,
      ke: nextSet,
      anggota: roster,
      stepYd: sYd,
      hanya: visibleIds,
    })
    if (hasil.jumlahPertukaran <= 0) return
    nextSet.points = hasil.kePointsBaru
    nextSet.bentukTerikat = hasil.bentukTerikatBaru
    void writePoints(hasil.kePointsBaru, nextSet.id, hasil.bentukTerikatBaru ?? null)
    setIdPratinjauTukar(null)
    forceRender()
    toast.push(
      `${hasil.jumlahPertukaran} silang jalur diurai di ${nextSet.name} (hemat ${hasil.totalHematLangkah.toFixed(1)} langkah)`,
    )
  }

  /** #24.3 — Ratakan spasi barisan pada set aktif tanpa mengikat bentuk. */
  function ratakanSpasi(temuan: TemuanKerataanSpasi) {
    if (!set) return
    snapshot()
    const ptsBaru = ratakanSpasiBarisan(set.points, temuan)
    set.points = ptsBaru
    void writePoints(ptsBaru, set.id)
    setSelected(temuan.memberIds)
    forceRender()
    toast.push(`Spasi ${temuan.label} diratakan (${temuan.spasiRataLangkah.toFixed(1)} langkah)`)
  }

  /** #24.3 — Ratakan spasi sekaligus ikat ke Bentuk Garis Hidup (#22). */
  function ikatKeGarisHidup(temuan: TemuanKerataanSpasi) {
    if (!set) return
    snapshot()
    const btk: BentukTerikat = {
      id: uid('btk_'),
      nama: temuan.label,
      jenis: 'garis',
      memberIds: [...temuan.memberIds],
      p0: { x: temuan.p0.x, y: temuan.p0.y },
      p1: { x: temuan.p1.x, y: temuan.p1.y },
      arahHadap: 'tetap',
    }
    const hasil = hitungTitikBentukTerikat(btk, set.points, f, {
      snapAktif: false,
      langkahX: 0,
      langkahY: 0,
    })
    const ptsBaru = { ...set.points, ...hasil }
    const bentukBaru = pasangBentukTerikatPadaSet(set.bentukTerikat, btk)
    set.points = ptsBaru
    set.bentukTerikat = bentukBaru
    void writePoints(ptsBaru, set.id, bentukBaru)
    setSelected(temuan.memberIds)
    forceRender()
    toast.push(`${temuan.label} diratakan & diikat ke Garis Hidup`)
  }

  /** Permintaan geser dari penggaris dijalankan setelah set aktifnya tergambar. */
  useEffect(() => {
    if (!geserPending) return
    if (geserPending.idx !== idx) return
    geserKe(geserPending.p)
    setGeserPending(null)
  }, [geserPending, idx, geserKe])

  useEffect(() => {
    if (!playing) segarkanBiramaDrill(idx, posisiRef.current)
  }, [idx, playing, segarkanBiramaDrill])

  /** B2 — kembalikan semua titik ke posisi awal set ini. */
  const resetAnimasi = useCallback(() => {
    setPlaying(false)
    jepretRef.current = 0
    posisiRef.current = 0
    if (sliderRef.current) sliderRef.current.value = '0'
    dotRefs.current.forEach((g) => {
      if (g.hasAttribute('transform')) g.removeAttribute('transform')
    })
    setProgress(0)
    tulisCount(0)
    segarkanBiramaDrill(idx, 0)
  }, [tulisCount, segarkanBiramaDrill, idx])

  useEffect(() => {
    if (!playing) return
    const counts = Math.max(1, set?.counts ?? 8)
    const beats = counts * drill.beatsPerCount
    // Durasi dan klik per hitungan berasal dari TempoTimeline saat drill tertaut.
    const msPerBeat = 60_000 / Math.max(20, tempoUntuk(idx))
    const total = (petaSet?.[idx]?.detikLatihan ?? (beats * msPerBeat) / 1000) * 1000
    if (klikRef.current) {
      const jadwal = petaSet?.[idx]?.offsetKlikLatihan
      if (jadwal?.length) {
        metronomRef.current.mulai({
          bpm: tempoUntuk(idx),
          beats: counts,
          subdiv: 1,
          suara: 'kayu',
          volume: 0.9,
          jadwalKlik: jadwal.map((offset, i) => ({
            offset: offset / Math.max(0.05, cepatRef.current),
            bpm: petaSet?.[idx]?.bpmLatihanPerHitungan[i],
            bpmAsli: petaSet?.[idx]?.bpmPerHitungan[i],
          })),
        })
      } else {
        const k = klikUntukDrill(tempoUntuk(idx) * cepatRef.current, drill.beatsPerCount, counts)
        metronomRef.current.mulai({ bpm: k.bpm, beats: k.beats, subdiv: 1, suara: 'kayu', volume: 0.9 })
      }
    }

    // #6 — putar rekaman audio tersinkronisasi jika lagu memiliki rekaman
    if (lagu?.id && lagu.rekaman && petaSet?.[idx]) {
      const pemutar = PemutarRekaman.get()
      void pemutar.muat(lagu.id).then((siap) => {
        if (!siap) return
        const mode = lagu.rekaman?.modeBunyi ?? 'keduanya'
        pemutar.setVolume(mode === 'klik' ? 0 : (lagu.rekaman?.volumeAudio ?? 1.0))
        /*
         * #6 — laju rekaman = rasio tempo latihan (aturan yang sama dengan
         * klik: mode persen ATAU BPM) × pengali kecepatan editor. Tanpa
         * rasio itu, klik melambat sementara rekaman berjalan di tempo asli.
         */
        const laju = lajuRekaman(tempoSet(petaSet, idx, drill.tempo), latihanDrill) * cepatRef.current
        pemutar.setKecepatan(laju)
        const dtkMulai = (lagu.rekaman?.titikMulaiDetik ?? 0) + petaSet[idx].detikMulai
        pemutar.putar(dtkMulai)
      })
    }

    let t0 = performance.now()
    // Vektor gerak tiap pemain (dalam satuan gambar SVG) — dihitung sekali.
    const vec = vektorGerak()
    // Mulai mainkan berarti jepretan (scrub) dibersihkan.
    jepretRef.current = 0
    animatingRef.current = true
    let raf = 0
    const loop = () => {
      // B2 — kecepatan jadi pengali jarak waktu, jadi bisa diubah saat jalan.
      const p = Math.min(1, ((performance.now() - t0) * cepatRef.current) / total)
      // Geser titik lewat `transform` — tanpa render ulang React per frame.
      const gr = gerakRef.current
      const lengkung = gr.jalur === 'lengkung' ? gr.lengkung : 0
      for (const [id, vx, vy] of vec) {
        const g = dotRefs.current.get(id)
        if (!g) continue
        // B2 — "mainkan hanya 1 section": pemain di luar section diam di tempat.
        if (seksiRef.current !== 'all' && seksiMember.get(id) !== seksiRef.current) {
          if (g.hasAttribute('transform')) g.removeAttribute('transform')
          continue
        }
        // DD2/#16 — progres tiap pemain (tunda per section, ripple, Move+Hold),
        // lalu posisinya pada FTL, sub-kelompok, busur, atau jalur utama.
        const t = progresPemain(p, gr, seksiMember.get(id), counts, id)
        const ftl = ftlRef.current.get(id)
        const midSvg = midsetsSvgRef.current.get(id)
        const klp = kelompokPemain(gr, id)
        const bs = busurRef.current.get(id)
        const pAsal = setRef.current?.points[id]
        const kAkhir = klp
          ? klp.jalur === 'lengkung'
            ? (klp.lengkung ?? 0.4)
            : 0
          : lengkung
        const [tx, ty] = ftl
          ? deltaPoliFtl(ftl, t)
          : midSvg && pAsal
            ? deltaMidsets(
                { x: sx(pAsal.x), y: sy(pAsal.y) },
                { x: sx(pAsal.x) + vx, y: sy(pAsal.y) + vy },
                midSvg,
                counts,
                p,
                kAkhir,
                klp?.jalanCount ?? gr.jalanCount,
              )
            : klp
              ? titikJalur(t, vx, vy, klp.jalur === 'lengkung' ? (klp.lengkung ?? 0.4) : 0)
              : bs
                ? deltaBusur(t, bs.x0, bs.y0, bs.pusat, bs.sudut, bs.geser ?? { x: 0, y: 0 })
                : titikJalur(t, vx, vy, lengkung)
        g.setAttribute('transform', `translate(${tx} ${ty})`)
      }
      if (markersRef.current.some(apakahPropertiBergerak)) {
        setProgress(p)
      }
      tulisCount(p)
      segarkanBiramaDrill(idx, p)
      posisiRef.current = p
      if (sliderRef.current)
        sliderRef.current.value = perHitunganRef.current ? String(Math.round(p * counts)) : String(p)
      if (p < 1) raf = requestAnimationFrame(loop)
      else if (ulangRef.current) {
        // B2 — ulang terus: mulai lagi dari posisi awal set ini.
        t0 = performance.now()
        raf = requestAnimationFrame(loop)
      } else if (urutanRef.current && sets.length > 1 && idx < sets.length - 1) {
        // B3 — urutan latihan: lanjut ke set berikutnya tanpa berhenti.
        // B5 — klik dihentikan sebentar; efek menjalankannya lagi untuk set berikutnya.
        metronomRef.current.berhenti()
        // `playing` tetap true, jadi efek langsung menjalankan set berikutnya.
        if (sliderRef.current) sliderRef.current.value = '0'
        setIdx(idx + 1)
      } else {
        animatingRef.current = false
        metronomRef.current.berhenti()
        setPlaying(false)
        // B3 — urutan latihan selesai sampai set terakhir.
        setUrutan(false)
        setProgress(0)
        if (sliderRef.current) sliderRef.current.value = '0'
        if (idx < sets.length - 1) setIdx(idx + 1)
      }
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      animatingRef.current = false
      if (lagu?.id && lagu.rekaman) {
        PemutarRekaman.get().jeda()
      }
      // B5 — klik ikut berhenti saat animasi selesai, dijeda, atau dibatalkan.
      metronomRef.current.berhenti()
    }
    // `vektorGerak`, `tulisCount`, dan `seksiMember` sengaja tidak dicantumkan:
    // isinya sudah benar saat animasi mulai dan tidak berubah selama loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // M1 — `tempoUntuk` dicantumkan supaya mengubah tautan lagu atau tempo
    // map langsung berlaku pada pemutaran berikutnya.
  }, [playing, set?.counts, drill.beatsPerCount, idx, sets.length, tempoUntuk])

  /** Ganti set → garis waktu & jepretan kembali ke awal. */
  useEffect(() => {
    jepretRef.current = 0
    posisiRef.current = 0
    if (sliderRef.current) sliderRef.current.value = '0'
    tulisCount(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx])

  /**
   * Bersihkan sisa `transform` setelah React selesai menggambar posisi baru.
   * useLayoutEffect dipakai supaya pembersihan terjadi SEBELUM browser
   * menggambar ulang — jadi tidak ada kedipan ke posisi lama.
   */
  useLayoutEffect(() => {
    // `jepretRef > 0` = pengguna sedang menjepret posisi (B2) — jangan dibersihkan.
    if (dragRef.current || animatingRef.current || jepretRef.current > 0) return
    dotRefs.current.forEach((g) => {
      if (g.hasAttribute('transform')) g.removeAttribute('transform')
    })
    if (pathsRef.current) pathsRef.current.style.opacity = ''
  })

  /* --------------------------- Susun & rapikan ----------------------------- */

  /** Titik yang dipakai operasi: yang dipilih, atau semua titik yang tampil. */
  function targetIds() {
    const ids = selected.length ? selected : Object.keys(set?.points ?? {}).filter((id) => visibleIds.has(id))
    return ids.filter((id) => !!set?.points[id])
  }

  /**
   * Catatan arah (penting!):
   *   +x = ke arah Side 1 = ke KIRI di layar
   *   +y = ke arah back sideline = ke ATAS di layar
   * Jadi "sejajarkan kiri" berarti memakai nilai x terbesar.
   */
  function alignSelection(kind: 'kiri' | 'tengahX' | 'kanan' | 'atas' | 'tengahY' | 'bawah') {
    const ids = targetIds()
    if (!set || ids.length < 2) return
    const xs = ids.map((id) => set.points[id].x)
    const ys = ids.map((id) => set.points[id].y)
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)
    snapshot()
    const pts = { ...set.points }
    for (const id of ids) {
      const p = pts[id]
      const x = kind === 'kiri' ? maxX : kind === 'kanan' ? minX : kind === 'tengahX' ? (minX + maxX) / 2 : p.x
      const y = kind === 'atas' ? maxY : kind === 'bawah' ? minY : kind === 'tengahY' ? (minY + maxY) / 2 : p.y
      const s = snapVal(x, y)
      pts[id] = { ...p, x: s.x, y: s.y }
    }
    const bentukBaru = lepaskanAnggotaDariBentuk(set.bentukTerikat, ids)
    set.points = pts
    set.bentukTerikat = bentukBaru
    void writePoints(pts, set.id, bentukBaru ?? null)
    toast.push(`${ids.length} titik disejajarkan`)
  }

  /** Ratakan jarak antar titik pada satu sumbu (ujung-ujungnya tetap). */
  function distributeSelection(axis: 'x' | 'y') {
    const ids = targetIds()
    if (!set || ids.length < 3) return
    const sorted = [...ids].sort((a, b) => set.points[a][axis] - set.points[b][axis])
    const first = set.points[sorted[0]][axis]
    const last = set.points[sorted[sorted.length - 1]][axis]
    const step = (last - first) / (sorted.length - 1)
    snapshot()
    const pts = { ...set.points }
    sorted.forEach((id, i) => {
      const p = pts[id]
      const v = first + step * i
      const s = axis === 'x' ? snapVal(v, p.y) : snapVal(p.x, v)
      pts[id] = { ...p, x: s.x, y: s.y }
    })
    const bentukBaru = lepaskanAnggotaDariBentuk(set.bentukTerikat, ids)
    set.points = pts
    set.bentukTerikat = bentukBaru
    void writePoints(pts, set.id, bentukBaru ?? null)
    toast.push(`Jarak ${sorted.length} titik diratakan`)
  }

  /* -------------------------------- Ekspor ---------------------------------- */

  const svgMarkup = () => {
    const el = svgRef.current
    if (!el) return ''
    const clone = el.cloneNode(true) as SVGSVGElement
    clone.querySelectorAll('[data-editor-ui="1"], [data-marquee="1"]').forEach((n) => n.remove())
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    clone.setAttribute('viewBox', `0 0 ${VW} ${VH}`)
    clone.setAttribute('width', String(VW * 10))
    clone.setAttribute('height', String(VH * 10))
    return new XMLSerializer().serializeToString(clone)
  }

  async function exportPNG() {
    const markup = svgMarkup()
    if (!markup) return
    const img = new Image()
    const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(markup)
    await new Promise((res, rej) => {
      img.onload = res
      img.onerror = rej
      img.src = url
    })
    const canvas = document.createElement('canvas')
    canvas.width = VW * 10
    canvas.height = VH * 10
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0)
    downloadFile(`${slugify(drill.name)}-${slugify(set?.name ?? 'set')}.png`, canvas.toDataURL('image/png'), 'image/png')
    toast.push('Gambar formasi diunduh')
  }

  function exportSVG() {
    downloadFile(`${slugify(drill.name)}-${slugify(set?.name ?? 'set')}.svg`, svgMarkup(), 'image/svg+xml')
  }

  function printChart() {
    const html = printShell(
      `${drill.name} — ${set?.name ?? ''}`,
      `<div style="padding:16px">
        <h1 style="font-size:16px;margin:0 0 2px">${esc(drill.name)}${drill.showTitle ? ' — ' + esc(drill.showTitle) : ''}</h1>
        <p style="font-size:12px;color:#555;margin:0 0 10px">${esc(set?.name ?? '')} · ${set?.counts ?? 0} count · ${drill.tempo} BPM</p>
        ${svgMarkup()}
      </div>`,
    )
    if (!printHtml(html)) {
      downloadHtmlFile(html, `${slugify(drill.name)}-${slugify(set?.name ?? 'set')}.html`)
      toast.push('Jendela cetak diblokir — berkas HTML diunduh. Buka lalu Ctrl+P.', 'info')
    }
  }

  function exportCoordSheet() {
    const rows: unknown[][] = [['Set', 'Kode', 'Nama', 'Section', 'Instrumen', 'X (steps)', 'Y (steps)', 'Koordinat']]
    for (const s of sets) {
      for (const m of roster) {
        const p = s.points[m.id]
        if (!p) continue
        rows.push([
          s.name,
          m.code,
          m.name,
          sectionLabel(m.section),
          m.instrument,
          Math.round((p.x / sYd) * 4) / 4,
          Math.round(((p.y + f.widthYd / 2) / sYd) * 4) / 4,
          coorTextSafe(p.x, p.y, f),
        ])
      }
    }
    downloadFile(`${slugify(drill.name)}-koordinat.csv`, toCSV(rows), 'text/csv')
    toast.push('Lembar koordinat diunduh')
  }

  /* ------------------------------- Render ----------------------------------- */

  const placed = Object.keys(set?.points ?? {})
  const unplaced = roster.filter((m) => !set?.points[m.id])
  const curCount = Math.min(set?.counts ?? 0, Math.ceil(progress * (set?.counts ?? 0)) || 0)
  const selectedAktif = useMemo(
    () => (set ? selected.filter((id) => Boolean(set.points[id]) && visibleIds.has(id)) : []),
    [selected, set, visibleIds],
  )
  const kotakSeleksi = useMemo(
    () => (set && selectedAktif.length >= 2 ? kotakBatasTitik(selectedAktif, set.points) : null),
    [selectedAktif, set, set?.points],
  )

  function mulaiSeretGagangBentuk(
    e: React.PointerEvent,
    b: BentukTerikat,
    peran: 'p0' | 'p1' | 'c1' | 'c2',
  ) {
    e.preventDefault()
    e.stopPropagation()
    if (!set?.bentukTerikat) return
    const asal = b[peran]
    if (!asal) return
    const u = clientToUser(e.clientX, e.clientY)
    gagangBentukRef.current = {
      idBentuk: b.id,
      peran,
      startX: u.x,
      startY: u.y,
      asalTitik: { ...asal },
      origBentuk: JSON.parse(JSON.stringify(set.bentukTerikat)) as BentukTerikat[],
      origPoints: JSON.parse(JSON.stringify(set.points)) as Record<string, DrillPoint>,
      moved: false,
    }
  }

  function mulaiSeretGagangSkala(e: React.PointerEvent, sudut: SudutGagangSkala) {
    e.preventDefault()
    e.stopPropagation()
    if (!set || !kotakSeleksi || selectedAktif.length < 2) return
    const u = clientToUser(e.clientX, e.clientY)
    gagangSkalaRef.current = {
      sudut,
      startX: u.x,
      startY: u.y,
      ids: [...selectedAktif],
      kotakAwal: { ...kotakSeleksi },
      origPoints: JSON.parse(JSON.stringify(set.points)) as Record<string, DrillPoint>,
      origBentuk: set.bentukTerikat?.length
        ? (JSON.parse(JSON.stringify(set.bentukTerikat)) as BentukTerikat[])
        : [],
      moved: false,
    }
  }

  function mulaiSeretGagangPutar(e: React.PointerEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!set || !kotakSeleksi || selectedAktif.length < 2) return
    const u = clientToUser(e.clientX, e.clientY)
    const pusat = { x: kotakSeleksi.cx, y: kotakSeleksi.cy }
    const sudutAwalRad = Math.atan2(iy(u.y) - pusat.y, ix(u.x) - pusat.x)
    gagangPutarRef.current = {
      ids: [...selectedAktif],
      pusat,
      sudutAwalRad,
      derajatTerakhir: 0,
      origPoints: JSON.parse(JSON.stringify(set.points)) as Record<string, DrillPoint>,
      origBentuk: set.bentukTerikat?.length
        ? (JSON.parse(JSON.stringify(set.bentukTerikat)) as BentukTerikat[])
        : [],
      moved: false,
    }
  }

  function mulaiSeretGagangMidset(
    e: React.PointerEvent,
    memberId: string,
    indeks: number,
    padaCount: number,
    asalYd: TitikKendaliYd,
    baruDibuat = false,
  ) {
    e.preventDefault()
    e.stopPropagation()
    if (!set) return
    const peran = peranPointerEfektif(view.modeInput, e.pointerType)
    setPointerTerakhir(peran)
    setBalonInfo(null)
    const u = clientToUser(e.clientX, e.clientY)
    gagangMidsetRef.current = {
      memberId,
      indeks,
      padaCount,
      baruDibuat,
      startX: u.x,
      startY: u.y,
      asalTitik: { ...asalYd },
      origMidsets: set.midsets
        ? (JSON.parse(JSON.stringify(set.midsets)) as Record<string, TitikSinggahMidset[]>)
        : {},
      moved: false,
    }
  }

  const daftarPerintahPalet = useMemo<ItemPaletPerintah[]>(() => {
    const aksiUtama: ItemPaletPerintah[] = [
      {
        id: 'putar-jeda',
        label: playing ? 'Jeda animasi formasi' : 'Mainkan animasi formasi',
        kategori: 'Pemutaran',
        pintasan: 'Spasi',
        kataKunci: ['play', 'pause', 'animasi', 'putar', 'jalan'],
        jalankan: () => setPlaying((p) => !p),
      },
      {
        id: 'urutan-semua-set',
        label: urutan ? 'Hentikan urutan seluruh set' : 'Mainkan urutan seluruh set',
        kategori: 'Pemutaran',
        pintasan: 'R',
        kataKunci: ['runthrough', 'urutan', 'semua', 'set'],
        nonaktif: sets.length < 2,
        jalankan: () => mulaiUrutan(),
      },
      {
        id: 'buka-presenter',
        label: 'Buka Mode Presenter (layar penuh)',
        kategori: 'Pemutaran',
        pintasan: 'F',
        kataKunci: ['presenter', 'proyektor', 'fullscreen', 'layar penuh'],
        jalankan: () => setPresenter(true),
      },
      {
        id: 'toggle-klik-tempo',
        label: view.klik ? 'Matikan klik metronom editor' : 'Nyalakan klik metronom editor',
        kategori: 'Pemutaran',
        kataKunci: ['metronom', 'klik', 'ketukan', 'audio', 'tempo'],
        jalankan: () => ubah('klik', !view.klik),
      },
      {
        id: 'set-sebelumnya',
        label: 'Pindah ke set sebelumnya',
        kategori: 'Set & Navigasi',
        pintasan: '[',
        kataKunci: ['prev', 'set', 'mundur', 'sebelumnya'],
        nonaktif: idx <= 0,
        jalankan: () => setIdx((i) => Math.max(0, i - 1)),
      },
      {
        id: 'set-berikutnya',
        label: 'Pindah ke set berikutnya',
        kategori: 'Set & Navigasi',
        pintasan: ']',
        kataKunci: ['next', 'set', 'maju', 'berikutnya'],
        nonaktif: idx >= sets.length - 1,
        jalankan: () => setIdx((i) => Math.min(sets.length - 1, i + 1)),
      },
      {
        id: 'gandakan-set',
        label: `Gandakan ${set?.name ?? 'set aktif'}`,
        kategori: 'Set & Navigasi',
        pintasan: 'Ctrl + D',
        kataKunci: ['duplicate', 'duplikat', 'tambah set', 'salin formasi'],
        nonaktif: !set,
        jalankan: () => void duplicateSet(),
      },
      {
        id: 'pecah-set',
        label: 'Buka panel Pecah Set…',
        kategori: 'Set & Navigasi',
        kataKunci: ['split', 'pecah', 'set', 'hitungan tengah'],
        nonaktif: !nextSet,
        jalankan: () => bukaPecah(),
      },
      {
        id: 'undo-aksi',
        label: 'Batalkan perubahan terakhir (Undo)',
        kategori: 'Titik & Bentuk',
        pintasan: 'Ctrl + Z',
        kataKunci: ['undo', 'batal', 'riwayat'],
        nonaktif: !history.length,
        jalankan: () => undo(),
      },
      {
        id: 'redo-aksi',
        label: 'Ulangi perubahan yang dibatalkan (Redo)',
        kategori: 'Titik & Bentuk',
        pintasan: 'Ctrl + Shift + Z',
        kataKunci: ['redo', 'ulangi'],
        nonaktif: !future.length,
        jalankan: () => redo(),
      },
      {
        id: 'pilih-semua',
        label: 'Pilih semua titik pemain yang tampil',
        kategori: 'Titik & Bentuk',
        pintasan: 'Ctrl + A',
        kataKunci: ['select all', 'pilih semua', 'anggota'],
        nonaktif: !placed.length,
        jalankan: () =>
          setSelected(Object.keys(set?.points ?? {}).filter((id) => visibleIds.has(id))),
      },
      {
        id: 'kosongkan-pilihan',
        label: 'Kosongkan pilihan titik',
        kategori: 'Titik & Bentuk',
        pintasan: 'Esc',
        kataKunci: ['deselect', 'lepas', 'batal pilih'],
        nonaktif: !selected.length,
        jalankan: () => setSelected([]),
      },
      {
        id: 'tambah-midset-pilihan',
        label: 'Sisipkan titik singgah (Midset) untuk pemain terpilih',
        kategori: 'Titik & Bentuk',
        kataKunci: ['midset', 'waypoint', 'titik singgah', 'belok', 'jalur biru'],
        nonaktif: selected.length !== 1 || !nextSet || (set?.counts ?? 0) < 2,
        jalankan: () => {
          if (selected[0]) tambahMidsetPemain(selected[0])
        },
      },
      {
        id: 'alat-pilih',
        label: 'Alat Kanvas: Pilih & Geser',
        kategori: 'Tampilan & Mode',
        kataKunci: ['select', 'marquee', 'kotak pilih', 'alat'],
        jalankan: () => setTool('select'),
      },
      {
        id: 'alat-lasso',
        label: 'Alat Kanvas: Lasso Bebas',
        kategori: 'Tampilan & Mode',
        pintasan: 'Alt + seret',
        kataKunci: ['lasso', 'poligon bebas', 'lengkung'],
        jalankan: () => setTool('lasso'),
      },
      {
        id: 'alat-pan',
        label: 'Alat Kanvas: Geser Papan (Pan)',
        kategori: 'Tampilan & Mode',
        kataKunci: ['pan', 'tangan', 'geser layar', 'zoom kanvas'],
        jalankan: () => setTool('pan'),
      },
      {
        id: 'mode-input-otomatis',
        label: 'Mode Input: Otomatis (deteksi sentuh / pena / tetikus)',
        kategori: 'Tampilan & Mode',
        kataKunci: ['tablet', 'ipad', 'stylus', 'otomatis', 'pointer', 'input'],
        jalankan: () => ubah('modeInput', 'otomatis'),
      },
      {
        id: 'mode-input-sentuh',
        label: 'Mode Input: Sentuh / Tablet (geser 1 jari = pan, target besar)',
        kategori: 'Tampilan & Mode',
        kataKunci: ['touch', 'tablet', 'jari', 'sentuh', 'ipad'],
        jalankan: () => ubah('modeInput', 'sentuh'),
      },
      {
        id: 'mode-input-tetikus',
        label: 'Mode Input: Tetikus / Desktop (geser area kosong = kotak pilih)',
        kategori: 'Tampilan & Mode',
        kataKunci: ['mouse', 'desktop', 'kursor', 'tetikus'],
        jalankan: () => ubah('modeInput', 'tetikus'),
      },
      {
        id: 'reset-zoom-kanvas',
        label: 'Kembalikan Zoom Kanvas ke 100%',
        kategori: 'Tampilan & Mode',
        kataKunci: ['zoom', 'reset', '100%', 'penuh', 'lapangan'],
        jalankan: () => resetViewportKanvas(),
      },
      {
        id: 'kunci-sumbu-x',
        label:
          view.kunciSumbu === 'hanya_x'
            ? 'Buka kunci sumbu X (kembali bebas)'
            : 'Kunci sumbu gerak ke X (kiri–kanan saja)',
        kategori: 'Titik & Bentuk',
        pintasan: 'X',
        kataKunci: ['axis lock', 'sumbu x', 'mendatar', 'yard'],
        jalankan: () => ubah('kunciSumbu', view.kunciSumbu === 'hanya_x' ? 'bebas' : 'hanya_x'),
      },
      {
        id: 'kunci-sumbu-y',
        label:
          view.kunciSumbu === 'hanya_y'
            ? 'Buka kunci sumbu Y (kembali bebas)'
            : 'Kunci sumbu gerak ke Y (depan–belakang saja)',
        kategori: 'Titik & Bentuk',
        pintasan: 'Y',
        kataKunci: ['axis lock', 'sumbu y', 'vertikal', 'hash'],
        jalankan: () => ubah('kunciSumbu', view.kunciSumbu === 'hanya_y' ? 'bebas' : 'hanya_y'),
      },
      {
        id: 'toggle-jejak',
        label: view.jalur || view.masuk ? 'Sembunyikan garis jejak gerakan' : 'Tampilkan garis jejak gerakan',
        kategori: 'Tampilan & Mode',
        pintasan: 'J',
        kataKunci: ['trail', 'path', 'jejak', 'garis biru', 'kuning'],
        jalankan: () => {
          const hidup = view.jalur || view.masuk
          ubah('jalur', !hidup)
          ubah('masuk', !hidup)
        },
      },
      {
        id: 'toggle-penanda',
        label: view.penanda ? 'Sembunyikan penanda & properti lapangan' : 'Tampilkan penanda & properti lapangan',
        kategori: 'Tampilan & Mode',
        pintasan: 'M',
        kataKunci: ['marker', 'props', 'penanda', 'bendera', 'panggung'],
        jalankan: () => ubah('penanda', !view.penanda),
      },
      {
        id: 'toggle-snap',
        label: view.snap ? 'Matikan Snap ke Grid langkah' : 'Nyalakan Snap ke Grid langkah',
        kategori: 'Tampilan & Mode',
        kataKunci: ['snap', 'grid', 'langkah', 'pembulatan'],
        jalankan: () => ubah('snap', !view.snap),
      },
      {
        id: 'buka-dot-sheet',
        label: 'Buka Kartu / Buku Saku (Dot Sheet) per pemain',
        kategori: 'Ekspor & Cetak',
        kataKunci: ['dot sheet', 'buku saku', 'cetak kartu', 'koordinat'],
        jalankan: () => setDotSheet(true),
      },
      {
        id: 'cetak-bagan',
        label: 'Cetak bagan lapangan set aktif (A4 / PDF)',
        kategori: 'Ekspor & Cetak',
        kataKunci: ['print', 'pdf', 'cetak bagan', 'chart'],
        jalankan: () => printChart(),
      },
      {
        id: 'unduh-png',
        label: 'Unduh gambar formasi (PNG)',
        kategori: 'Ekspor & Cetak',
        kataKunci: ['export', 'png', 'gambar', 'unduh'],
        jalankan: () => void exportPNG(),
      },
      {
        id: 'unduh-csv-koordinat',
        label: 'Unduh lembar koordinat seluruh set (CSV)',
        kategori: 'Ekspor & Cetak',
        kataKunci: ['csv', 'excel', 'koordinat', 'unduh', 'ekspor'],
        jalankan: () => exportCoordSheet(),
      },
      {
        id: 'pengaturan-drill',
        label: 'Buka Pengaturan Drill (ukuran lapangan, tempo, riwayat)',
        kategori: 'Set & Navigasi',
        kataKunci: ['settings', 'pengaturan', 'ukuran lapangan', 'tempo'],
        jalankan: () => setSettingsOpen(true),
      },
      {
        id: 'lompat-benturan-pertama',
        label: hasilTabrakan?.kejadian.length
          ? `Lompat ke benturan terparah (${hasilTabrakan.kejadian[0].kodeA} × ${hasilTabrakan.kejadian[0].kodeB} · c${hasilTabrakan.kejadian[0].padaCount})`
          : 'Lompat ke benturan lintasan terparah',
        kategori: 'Titik & Bentuk',
        kataKunci: ['tabrakan', 'benturan', 'collision', 'nyaris', 'keselamatan', 'scrubber'],
        nonaktif: !hasilTabrakan?.kejadian.length,
        jalankan: () => {
          if (hasilTabrakan?.kejadian[0]) fokusBenturan(hasilTabrakan.kejadian[0])
        },
      },
      {
        id: 'urai-semua-silang',
        label: saranTukarSilang.length
          ? `Urai semua jalur seksi bersilangan (${saranTukarSilang.length} pasangan)`
          : 'Urai semua jalur seksi bersilangan (2-Opt)',
        kategori: 'Titik & Bentuk',
        kataKunci: ['silang', 'uncross', '2-opt', 'tukar', 'swap', 'jalur'],
        nonaktif: !saranTukarSilang.length,
        jalankan: () => tukarSemuaSilang(),
      },
      {
        id: 'ratakan-spasi-pertama',
        label: temuanSpasi.length
          ? `Ratakan interval barisan (${temuanSpasi[0].label})`
          : 'Ratakan interval barisan yang melenceng',
        kategori: 'Titik & Bentuk',
        kataKunci: ['spasi', 'interval', 'rata', 'spacing', 'drift', 'barisan'],
        nonaktif: !temuanSpasi.length,
        jalankan: () => {
          if (temuanSpasi[0]) ratakanSpasi(temuanSpasi[0])
        },
      },
      {
        id: 'toggle-cincin-tabrakan',
        label: tampilCincinTabrakan
          ? 'Sembunyikan cincin benturan di kanvas'
          : 'Tampilkan cincin benturan di kanvas',
        kategori: 'Tampilan & Mode',
        kataKunci: ['cincin', 'tabrakan', 'benturan', 'ring', 'peringatan'],
        jalankan: () => setTampilCincinTabrakan((v) => !v),
      },
    ]

    const aksiTag: ItemPaletPerintah[] = daftarTagRoster.map(({ tag }) => ({
      id: `pilih-tag-${tag}`,
      label: `Pilih semua anggota ber-tag #${tag}`,
      kategori: 'Titik & Bentuk',
      kataKunci: ['tag', 'label', 'kelompok', tag],
      jalankan: () => pilihAnggotaBerTag(tag),
    }))

    return lengkapiReferensiPintasan([...aksiUtama, ...aksiTag], DAFTAR_SHORTCUT)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    playing,
    urutan,
    sets.length,
    idx,
    set?.id,
    set?.name,
    set?.counts,
    Boolean(nextSet),
    history.length,
    future.length,
    placed.length,
    selected,
    view,
    daftarTagRoster,
    tampilCincinTabrakan,
    hasilTabrakan,
    saranTukarSilang,
    temuanSpasi,
  ])

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      {/* ------------------------------ Papan ------------------------------- */}
      <div className="min-w-0 space-y-3">
        <Card padded={false} className="overflow-hidden">
          {/* Toolbar */}
          <div
            className="no-print flex flex-wrap items-center gap-2 border-b border-slate-800 px-3 py-2.5"
            onPointerDown={(e) => {
              const peran = peranPointerEfektif(view.modeInput, e.pointerType)
              if (peran !== 'sentuh') return
              const elJudul = (e.target as HTMLElement | null)?.closest('[title]') as HTMLElement | null
              if (elJudul) {
                jadwalkanBalonSentuh(e.clientX, e.clientY, elJudul.getAttribute('title') ?? '', peran)
              }
            }}
            onPointerUp={batalkanTimerBalon}
            onPointerCancel={batalkanTimerBalon}
          >
            <div className="flex items-center gap-1">
              <button
                data-kiosk-allow
                onClick={() => setIdx(Math.max(0, idx - 1))}
                disabled={idx === 0}
                className="rounded-lg border border-slate-700 px-2 py-1.5 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-30"
              >
                ‹
              </button>
              <span className="min-w-24 px-1 text-center text-xs font-medium text-slate-200">
                {set?.name ?? '-'}
                <span className="ml-1 text-slate-500">
                  {idx + 1}/{sets.length}
                </span>
              </span>
              <button
                data-kiosk-allow
                onClick={() => setIdx(Math.min(sets.length - 1, idx + 1))}
                disabled={idx >= sets.length - 1}
                className="rounded-lg border border-slate-700 px-2 py-1.5 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-30"
              >
                ›
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-1">
              <Button size="sm" variant={playing ? 'danger' : 'primary'} onClick={() => setPlaying((p) => !p)} data-kiosk-allow>
                {playing ? <IconPause size={14} /> : <IconPlay size={14} />}
                {playing ? (
                  <span data-live-count>{`Count ${curCount}/${set?.counts ?? 0}`}</span>
                ) : (
                  'Mainkan'
                )}
              </Button>
              <Button
                size="sm"
                variant={view.klik ? 'primary' : 'ghost'}
                data-kiosk-allow
                data-testid="tombol-klik-editor"
                onClick={() => ubah('klik', !view.klik)}
                title="B5 — klik tempo menyertai animasi & urutan latihan"
                className="h-9 px-2.5 sm:h-8 sm:px-2"
              >
                Klik
              </Button>
              <Button
                size="sm"
                variant="ghost"
                data-kiosk-allow
                onClick={() => setPresenter(true)}
                title="Mode presenter — layar penuh untuk latihan (F)"
                className="h-9 px-2.5 sm:h-8 sm:px-2"
              >
                <IconExpand size={14} />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                data-kiosk-allow
                data-testid="tombol-shortcut"
                onClick={() => setBantuan(true)}
                title="Palet perintah & daftar pintasan keyboard (Ctrl+K / ?)"
                className="h-9 px-2.5 sm:h-8 sm:px-2"
              >
                <span className="hidden sm:inline">⌘K · </span>?
              </Button>
              <Button size="sm" variant="ghost" onClick={undo} disabled={!history.length} title="Undo (Ctrl+Z)">
                ↶
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={redo}
                disabled={!future.length}
                title="Redo (Ctrl+Shift+Z)"
              >
                ↷
              </Button>
              <Button
                size="sm"
                onClick={() => setSettingsOpen(true)}
                title="Pengaturan drill"
              >
                ⚙
              </Button>
            </div>

            {/* #23.3 — Sakelar Mode Input (Otomatis / Sentuh / Tetikus) + Kontrol Zoom Kanvas */}
            <div className="flex flex-wrap items-center gap-1" data-testid="kontrol-input-zoom">
              <div
                className="inline-flex rounded-lg border border-slate-800 bg-slate-900/80 p-0.5 text-[11px]"
                data-testid="sakelar-mode-input"
                role="group"
                aria-label="Mode input kanvas"
              >
                {(
                  [
                    ['otomatis', 'Otomatis', 'Deteksi otomatis sentuhan jari, pena stylus, atau tetikus'],
                    ['sentuh', 'Sentuh', 'Mode tablet: seret 1 jari menggeser kanvas, target tangkap diperbesar >= 40 px'],
                    ['tetikus', 'Tetikus', 'Mode desktop: seret area kosong membuat kotak pilih'],
                  ] as const
                ).map(([kode, label, ket]) => (
                  <button
                    key={kode}
                    type="button"
                    data-testid={`mode-input-${kode}`}
                    onClick={() => ubah('modeInput', kode)}
                    title={ket}
                    className={cx(
                      'rounded-md px-1.5 py-1 transition sm:px-2',
                      view.modeInput === kode
                        ? 'bg-emerald-600/25 font-medium text-emerald-200'
                        : 'text-slate-400 hover:text-slate-200',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div
                className="inline-flex items-center rounded-lg border border-slate-800 bg-slate-900/80 p-0.5 text-[11px]"
                data-testid="kontrol-zoom-kanvas"
              >
                <button
                  type="button"
                  data-testid="zoom-perkecil"
                  onClick={() => ubahZoomKanvas(1 / 1.25)}
                  disabled={viewport.zoom <= 1.001}
                  title="Perkecil tampilan lapangan"
                  className="rounded px-1.5 py-0.5 text-slate-300 hover:bg-slate-800 disabled:opacity-35"
                >
                  −
                </button>
                <button
                  type="button"
                  data-testid="zoom-reset"
                  onClick={resetViewportKanvas}
                  title="Kembalikan zoom ke 100% (Ctrl + roda tetikus atau cubit 2 jari untuk zoom)"
                  className="px-1.5 py-0.5 font-mono text-[10px] text-slate-300 hover:text-emerald-300"
                >
                  {Math.round(viewport.zoom * 100)}%
                </button>
                <button
                  type="button"
                  data-testid="zoom-perbesar"
                  onClick={() => ubahZoomKanvas(1.25)}
                  disabled={viewport.zoom >= 3.99}
                  title="Perbesar tampilan lapangan"
                  className="rounded px-1.5 py-0.5 text-slate-300 hover:bg-slate-800 disabled:opacity-35"
                >
                  +
                </button>
              </div>
            </div>

            <div className="ml-auto flex flex-wrap items-center gap-1">
              <Button size="sm" variant="ghost" onClick={exportPNG} title="Unduh PNG">
                <IconDownload size={14} />
              </Button>
              <Button size="sm" variant="ghost" onClick={exportSVG} title="Unduh SVG">
                SVG
              </Button>
              <Button size="sm" variant="ghost" onClick={printChart} title="Cetak / PDF">
                <IconPrinter size={14} />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setTukarCsv(true)} title="Tukar formasi lewat CSV">
                CSV
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setImporPyware(true)}
                title="Impor drill Pyware (CSV lembar koordinat)"
                data-testid="tombol-pyware"
              >
                Pyware
              </Button>
              <Button
                size="sm"
                variant={apakahModeParade(f) ? 'soft' : 'ghost'}
                onClick={() => void bukaParade()}
                title="Mode Kirab / Street Parade — Banjar × Saf, Tikungan 90°, Display Panggung VIP & Kalkulator Rute"
                data-testid="tombol-parade"
              >
                {apakahModeParade(f) ? 'Parade ●' : 'Parade'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void bukaCountSheet()}
                title="Lembar Hitungan Color Guard (Count Sheet)"
                data-testid="tombol-count-sheet"
              >
                Guard{countSheetsDrill?.length ? ` (${countSheetsDrill.length})` : ''}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDotSheet(true)} title="Kartu/dot sheet per pemain">
                <IconPrinter size={14} /> Kartu
              </Button>
            </div>
          </div>

          {/* Kanvas */}
          <div data-kiosk-block className="drill-surface relative bg-slate-950 p-2 sm:p-3">
            {siapLetakkanId && rosterById.get(siapLetakkanId) && (
              <div
                data-testid="banner-siap-letakkan"
                className="mb-2 flex items-center justify-between gap-2 rounded-lg border border-emerald-700/50 bg-emerald-950/50 px-3 py-1.5 text-xs text-emerald-200"
              >
                <span>
                  Ketuk di mana saja pada lapangan untuk menempatkan{' '}
                  <b>{rosterById.get(siapLetakkanId)!.code}</b> ({rosterById.get(siapLetakkanId)!.name}).
                </span>
                <button
                  type="button"
                  onClick={() => setSiapLetakkanId(null)}
                  className="rounded px-2 py-0.5 text-[11px] text-emerald-300 hover:bg-emerald-900/50"
                >
                  Batal (Esc)
                </button>
              </div>
            )}
            <svg
              ref={svgRef}
              data-testid="kanvas-drill-svg"
              viewBox={`${viewBoxKanvas.x} ${viewBoxKanvas.y} ${viewBoxKanvas.width} ${viewBoxKanvas.height}`}
              className={cx(
                'w-full touch-none select-none',
                siapLetakkanId
                  ? 'cursor-crosshair'
                  : tool === 'pan' || peranAktif === 'sentuh'
                    ? 'cursor-grab'
                    : '',
              )}
              onPointerDown={onFieldClick}
              onPointerDownCapture={petik ? ambilTitikPenanda : undefined}
            >
              <FieldSurface f={f} VW={VW} VH={VH} sx={sx} sy={sy} />

              {/* A7 & #16.4 — penanda bebas & properti bergerak: digambar di bawah titik pemain. */}
              {view.penanda && (
                <MarkerLayer
                  markers={penandaEfektifPadaSet(markers, sets, idx, progress)}
                  sx={sx}
                  sy={sy}
                />
              )}

              {/* Kotak pilih (marquee) — digambar langsung saat menyeret di area kosong */}
              <rect
                ref={marqRectRef}
                data-marquee="1"
                x={0}
                y={0}
                width={0}
                height={0}
                fill="#38bdf8"
                fillOpacity={0.12}
                stroke="#38bdf8"
                strokeWidth={0.25}
                strokeDasharray="1 0.6"
                style={{ display: 'none', pointerEvents: 'none' }}
              />

              {/* #22.2 — Poligon seleksi Lasso bebas */}
              <polygon
                ref={lassoPolyRef}
                data-testid="lasso-poligon"
                data-editor-ui="1"
                points=""
                fill="#10b981"
                fillOpacity={0.14}
                stroke="#10b981"
                strokeWidth={0.28}
                strokeDasharray="0.9 0.5"
                style={{ display: 'none', pointerEvents: 'none' }}
              />

              {/*
                Jejak gerakan (A5) — dipakai untuk menjelaskan "pemain jalan ke mana".
                Kuning  = jejak MASUK (dari posisi di set sebelumnya ke posisi sekarang).
                Biru    = jejak KELUAR (dari posisi sekarang ke set berikutnya).
                Kalau ada titik yang dipilih, jejak cuma digambar untuk titik itu —
                jadi bisa mengikuti satu pemain saja tanpa tumpang tindih.
              */}
              <defs>
                <marker
                  id="dk-panah-masuk"
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="2.6"
                  markerHeight="2.6"
                  markerUnits="userSpaceOnUse"
                  orient="auto"
                >
                  <path d="M0 0 L10 5 L0 10 Z" fill="#fbbf24" />
                </marker>
                <marker
                  id="dk-panah-keluar"
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="2.6"
                  markerHeight="2.6"
                  markerUnits="userSpaceOnUse"
                  orient="auto"
                >
                  <path d="M0 0 L10 5 L0 10 Z" fill="#38bdf8" />
                </marker>
              </defs>
              <g ref={pathsRef} style={{ pointerEvents: 'none' }}>
                {!playing &&
                  set &&
                  entriJejak.map(([id, p]) => {
                    const r = view.masuk ? prevSet?.points[id] : undefined
                    const q = view.jalur ? nextSet?.points[id] : undefined
                    const x = sx(p.x)
                    const y = sy(p.y)
                    const ada = (a?: DrillPoint) => a && !(sx(a.x) === x && sy(a.y) === y)
                    return (
                      <g key={`trail-${id}`}>
                        {/* asal: dari set sebelumnya */}
                        {ada(r) && (
                          <Jejak
                            nama="masuk"
                            x1={sx(r!.x)}
                            y1={sy(r!.y)}
                            x2={x}
                            y2={y}
                            lengkung={gerakSebelum.jalur === 'lengkung' ? gerakSebelum.lengkung : 0}
                            warna="#fbbf24"
                            opacity={0.8}
                            putus="1.6 1"
                            busur={busurMasuk.get(id)}
                            midsetsSvg={midsetsSvgMasuk.get(id)}
                            countsSet={prevSet?.counts}
                            panah={view.panah ? 'url(#dk-panah-masuk)' : undefined}
                          />
                        )}
                        {/* tujuan: ke set berikutnya (FTL, titik singgah/midsets, sub-kelompok, busur, atau jalur utama) */}
                        {ada(q) &&
                          (ftlKeluar.get(id) ? (
                            <path
                              data-testid={`jejak-ftl-${id}`}
                              d={pathPoliFtl(ftlKeluar.get(id)!)}
                              fill="none"
                              stroke="#38bdf8"
                              strokeWidth={0.32}
                              strokeDasharray="1.1 0.6"
                              opacity={0.9}
                              markerEnd={view.panah ? 'url(#dk-panah-keluar)' : undefined}
                            />
                          ) : (
                            <Jejak
                              nama="keluar"
                              x1={x}
                              y1={y}
                              x2={sx(q!.x)}
                              y2={sy(q!.y)}
                              lengkung={
                                kelompokPemain(gerakSet, id)
                                  ? kelompokPemain(gerakSet, id)!.jalur === 'lengkung'
                                    ? (kelompokPemain(gerakSet, id)!.lengkung ?? 0.4)
                                    : 0
                                  : gerakSet.jalur === 'lengkung'
                                    ? gerakSet.lengkung
                                    : 0
                              }
                              warna={warnaJalur(id)}
                              opacity={view.analitik ? 0.95 : 0.75}
                              busur={kelompokPemain(gerakSet, id) ? undefined : busurKeluar.get(id)}
                              midsetsSvg={midsetsSvgKeluar.get(id)}
                              countsSet={set.counts}
                              panah={view.panah ? 'url(#dk-panah-keluar)' : undefined}
                            />
                          ))}
                        {/*
                          DD9 — tapak langkah di sepanjang jejak keluar.
                          Hanya untuk **pemain terpilih**: satu formasi 40 orang
                          berarti ratusan tapak, dan papan justru tidak terbaca.
                        */}
                        {view.tapak && selected.length > 0 && ada(q) && (
                          <TapakLangkah
                            x1={x}
                            y1={y}
                            x2={sx(q!.x)}
                            y2={sy(q!.y)}
                            lengkung={gerakSet.jalur === 'lengkung' ? gerakSet.lengkung : 0}
                            busur={busurKeluar.get(id)}
                            midsetsSvg={midsetsSvgKeluar.get(id)}
                            countsSet={set.counts}
                            jumlah={jumlahLangkah(id, p, q!)}
                            warna={warnaJalur(id)}
                          />
                        )}
                        {/* titik hantu: bayangan posisi asal & tujuan */}
                        {view.hantu && ada(r) && (
                          <circle
                            data-ghost="masuk"
                            cx={sx(r!.x)}
                            cy={sy(r!.y)}
                            r={uk(0.85)}
                            fill="none"
                            stroke="#fbbf24"
                            strokeOpacity={0.85}
                            strokeWidth={uk(0.16)}
                            strokeDasharray="0.6 0.5"
                          />
                        )}
                        {view.hantu && ada(q) && (
                          <circle
                            data-ghost="keluar"
                            cx={sx(q!.x)}
                            cy={sy(q!.y)}
                            r={uk(0.85)}
                            fill="none"
                            stroke="#38bdf8"
                            strokeOpacity={0.85}
                            strokeWidth={uk(0.16)}
                            strokeDasharray="0.6 0.5"
                          />
                        )}
                        {/* angka jarak tempuh dalam langkah */}
                        {view.jarak && q && (
                          <text
                            data-jarak="1"
                            x={(x + sx(q.x)) / 2}
                            y={(y + sy(q.y)) / 2 - 0.7}
                            fontSize={1.6}
                            textAnchor="middle"
                            fill="#7dd3fc"
                          >
                            {Math.round(Math.hypot(q.x - p.x, q.y - p.y) / sYd)}
                          </text>
                        )}
                      </g>
                    )
                  })}
              </g>

              {/* #16.2 — Pratinjau langsung generator bentuk cepat di kanvas */}
              {pratinjauTitikBentuk && (
                <g data-testid="pratinjau-bentuk-kanvas" style={{ pointerEvents: 'none' }}>
                  {Object.entries(pratinjauTitikBentuk).map(([id, pt]) => (
                    <circle
                      key={`prv-${id}`}
                      cx={sx(pt.x)}
                      cy={sy(pt.y)}
                      r={uk(0.95)}
                      fill="#fbbf24"
                      fillOpacity={0.22}
                      stroke="#fbbf24"
                      strokeWidth={uk(0.2)}
                      strokeDasharray="0.7 0.5"
                    />
                  ))}
                </g>
              )}

              {/* #22.1 — Tulang punggung bentuk parametrik hidup (di bawah titik pemain) */}
              {!playing && (set?.bentukTerikat?.length ?? 0) > 0 && (
                <g data-testid="lapisan-garis-bentuk" data-editor-ui="1" style={{ pointerEvents: 'none' }}>
                  {set!.bentukTerikat!.map((b) => {
                    if (!b.memberIds.some((id) => visibleIds.has(id))) return null
                    const sampel = sampelGarisBentukUntukSvg(b, 48)
                    const sorot = b.memberIds.some((id) => selSet.has(id))
                    const ptsAttr = sampel.map((pt) => `${sx(pt.x)},${sy(pt.y)}`).join(' ')
                    return (
                      <polyline
                        key={`backbone-${b.id}`}
                        data-testid={`garis-bentuk-${b.id}`}
                        points={ptsAttr}
                        fill="none"
                        stroke="#f59e0b"
                        strokeOpacity={sorot ? 0.92 : 0.6}
                        strokeWidth={uk(sorot ? 0.28 : 0.2)}
                        strokeDasharray="0.9 0.55"
                      />
                    )
                  })}
                </g>
              )}

              {/* Titik pemain */}
              {Object.entries(set?.points ?? {}).map(([id, p]) => {
                const m = rosterById.get(id)
                if (!m || !visibleIds.has(id)) return null
                // Saat animasi, titik digerakkan lewat `transform` (lihat efek
                // playback), jadi di sini selalu memakai posisi dasar set aktif.
                const x = p.x
                const y = p.y
                const deg = facingDeg(p.facing, p.facingDeg)
                const rad = (deg * Math.PI) / 180
                // facing 0° = menghadap penonton = ke bawah pada svg (y bertambah)
                const fx = Math.sin(rad) * -uk(1.6)
                const fy = Math.cos(rad) * uk(1.6)
                const isSel = selSet.has(id)
                const gayaTitik = gayaTitikPemain(
                  m,
                  sectionDot(m.section),
                  drill.tampilanTag,
                  set?.tampilanTag,
                )
                return (
                  <g
                    key={id}
                    ref={dotRefCb(id)}
                    onPointerDown={(e) => onPointerDownPoint(e, id)}
                    className="cursor-move"
                    style={{ touchAction: 'none' }}
                  >
                    {peranAktif !== 'tetikus' && (
                      <circle
                        data-editor-ui="1"
                        data-hit-sentuh="1"
                        cx={sx(x)}
                        cy={sy(y)}
                        r={rHitSentuh}
                        fill="#ffffff"
                        fillOpacity={0.001}
                      />
                    )}
                    <line
                      x1={sx(x)}
                      y1={sy(y)}
                      x2={sx(x) + fx}
                      y2={sy(y) + fy}
                      stroke={gayaTitik.warna}
                      strokeWidth={0.35}
                    />
                    <TitikPemainBentuk
                      cx={sx(x)}
                      cy={sy(y)}
                      r={uk(isSel ? 1.5 : 1.15)}
                      fill={gayaTitik.warna}
                      bentuk={gayaTitik.bentuk}
                      stroke={isSel ? '#f8fafc' : '#0b1120'}
                      strokeWidth={uk(isSel ? 0.35 : 0.18)}
                    />
                    {view.kode && (
                      <text
                        x={sx(x)}
                        y={sy(y) + uk(0.45)}
                        textAnchor="middle"
                        fontSize={uk(1.15)}
                        fill="#0b1120"
                        style={{ pointerEvents: 'none', fontWeight: 700 }}
                      >
                        {m.code}
                      </text>
                    )}
                  </g>
                )
              })}

              {/* #24.1 & #24.2 — Cincin peringatan benturan lintasan & properti (murni #hex) */}
              {set && nextSet && tampilCincinTabrakan && (hasilTabrakan?.kejadian.length ?? 0) > 0 && (
                <g data-testid="lapisan-tabrakan-kanvas" data-editor-ui="1">
                  {hasilTabrakan!.kejadian.slice(0, 12).map((k, idxRing) => {
                    const cxSvg = sx(k.x)
                    const cySvg = sy(k.y)
                    const counts = Math.max(1, set.counts ?? 8)
                    const aktifDiScrub = Math.abs(progress * counts - k.padaCount) <= 0.6
                    const warnaUtama = k.tingkat === 'tabrakan' ? '#f43f5e' : '#f59e0b'
                    const warnaTeks = k.tingkat === 'tabrakan' ? '#fda4af' : '#fde68a'
                    const rAman = Math.max(uk(1.3), k.batasAmanLangkah * sYd * 0.5)
                    return (
                      <g
                        key={k.id}
                        data-testid={`cincin-tabrakan-${idxRing}`}
                        className="cursor-pointer"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation()
                          fokusBenturan(k)
                        }}
                      >
                        {aktifDiScrub && (
                          <circle
                            cx={cxSvg}
                            cy={cySvg}
                            r={rAman + uk(0.85)}
                            fill="none"
                            stroke={warnaUtama}
                            strokeWidth={uk(0.3)}
                            strokeOpacity={0.95}
                          />
                        )}
                        <circle
                          cx={cxSvg}
                          cy={cySvg}
                          r={rAman}
                          fill={warnaUtama}
                          fillOpacity={aktifDiScrub ? 0.28 : 0.14}
                          stroke={warnaUtama}
                          strokeWidth={uk(aktifDiScrub ? 0.28 : 0.2)}
                          strokeDasharray="0.55 0.35"
                        />
                        <circle
                          cx={cxSvg}
                          cy={cySvg}
                          r={uk(0.42)}
                          fill={warnaUtama}
                          stroke="#0f172a"
                          strokeWidth={uk(0.16)}
                        />
                        <text
                          x={cxSvg}
                          y={cySvg - rAman - uk(0.35)}
                          textAnchor="middle"
                          fontSize={uk(1.05)}
                          fill={warnaTeks}
                          stroke="#0f172a"
                          strokeWidth={uk(0.28)}
                          paintOrder="stroke"
                          style={{ pointerEvents: 'none', fontWeight: 700 }}
                        >
                          {`! c${k.padaCount}`}
                        </text>
                      </g>
                    )
                  })}
                </g>
              )}

              {/* #24.4 — Pratinjau jalur bebas silang 2-Opt di kanvas (murni #hex) */}
              {!playing && set && nextSet && idPratinjauTukar && (() => {
                const pratinjau = saranTukarSilang.find((s) => s.id === idPratinjauTukar)
                if (!pratinjau) return null
                const pA = set.points[pratinjau.idA]
                const pB = set.points[pratinjau.idB]
                const qA = nextSet.points[pratinjau.idA]
                const qB = nextSet.points[pratinjau.idB]
                if (!pA || !pB || !qA || !qB) return null
                return (
                  <g
                    data-testid="lapisan-pratinjau-tukar"
                    data-editor-ui="1"
                    style={{ pointerEvents: 'none' }}
                  >
                    {/* Jalur lama bersilangan (merah putus-putus redup) */}
                    <line
                      x1={sx(pA.x)}
                      y1={sy(pA.y)}
                      x2={sx(qA.x)}
                      y2={sy(qA.y)}
                      stroke="#f43f5e"
                      strokeOpacity={0.55}
                      strokeWidth={uk(0.22)}
                      strokeDasharray="0.7 0.45"
                    />
                    <line
                      x1={sx(pB.x)}
                      y1={sy(pB.y)}
                      x2={sx(qB.x)}
                      y2={sy(qB.y)}
                      stroke="#f43f5e"
                      strokeOpacity={0.55}
                      strokeWidth={uk(0.22)}
                      strokeDasharray="0.7 0.45"
                    />
                    {/* Jalur baru bebas silang sesudah ditukar (zamrud tegas) */}
                    <line
                      x1={sx(pA.x)}
                      y1={sy(pA.y)}
                      x2={sx(qB.x)}
                      y2={sy(qB.y)}
                      stroke="#10b981"
                      strokeWidth={uk(0.34)}
                    />
                    <line
                      x1={sx(pB.x)}
                      y1={sy(pB.y)}
                      x2={sx(qA.x)}
                      y2={sy(qA.y)}
                      stroke="#10b981"
                      strokeWidth={uk(0.34)}
                    />
                    <circle
                      cx={sx(qB.x)}
                      cy={sy(qB.y)}
                      r={uk(0.85)}
                      fill="none"
                      stroke="#6ee7b7"
                      strokeWidth={uk(0.24)}
                    />
                    <circle
                      cx={sx(qA.x)}
                      cy={sy(qA.y)}
                      r={uk(0.85)}
                      fill="none"
                      stroke="#6ee7b7"
                      strokeWidth={uk(0.24)}
                    />
                  </g>
                )
              })()}

              {/* #23.1 — Gagang Titik Singgah (Midsets) langsung pada jejak biru pemain terpilih */}
              {!playing && set && nextSet && view.jalur && selectedAktif.length > 0 && (set.counts ?? 0) >= 2 && (
                <g data-testid="lapisan-gagang-midset" data-editor-ui="1">
                  {selectedAktif.map((id) => {
                    const p = set.points[id]
                    const q = nextSet.points[id]
                    if (!p || !q || ftlKeluar.get(id)) return null
                    if (Math.hypot(q.x - p.x, q.y - p.y) < 1e-3 && !set.midsets?.[id]?.length) {
                      return null
                    }
                    const counts = Math.max(2, Math.floor(set.counts || 8))
                    const daftarMid = normalisasiMidsetsPemain(set.midsets?.[id], counts)
                    const countBebas =
                      selectedAktif.length <= 4 ? cariCountSinggahBebas(daftarMid, counts) : null
                    const posTambah =
                      countBebas !== null ? posisiJalurPemainYd(id, countBebas) : null
                    const dIntan = uk(0.95)
                    return (
                      <g key={`midsets-${id}`} data-testid={`grup-midset-${id}`}>
                        {daftarMid.map((w, wi) => {
                          const wx = sx(w.x)
                          const wy = sy(w.y)
                          return (
                            <g
                              key={`mid-${id}-${wi}`}
                              data-testid={`gagang-midset-${id}-${wi}`}
                              className="cursor-grab"
                              style={{ touchAction: 'none' }}
                              onPointerDown={(e) =>
                                mulaiSeretGagangMidset(e, id, wi, w.padaCount, { x: w.x, y: w.y }, false)
                              }
                              onDoubleClick={(e) => {
                                e.stopPropagation()
                                hapusMidsetPemain(id, wi)
                              }}
                            >
                              {peranAktif !== 'tetikus' && (
                                <circle
                                  data-editor-ui="1"
                                  cx={wx}
                                  cy={wy}
                                  r={rHitSentuh}
                                  fill="#ffffff"
                                  fillOpacity={0.001}
                                />
                              )}
                              <polygon
                                points={`${wx},${wy - dIntan} ${wx + dIntan},${wy} ${wx},${wy + dIntan} ${wx - dIntan},${wy}`}
                                fill="#38bdf8"
                                stroke="#0f172a"
                                strokeWidth={uk(0.22)}
                              />
                              <text
                                x={wx}
                                y={wy - uk(1.35)}
                                textAnchor="middle"
                                fontSize={uk(1.15)}
                                fill="#bae6fd"
                                style={{ pointerEvents: 'none', fontWeight: 700 }}
                              >
                                c{w.padaCount}
                              </text>
                            </g>
                          )
                        })}
                        {posTambah && countBebas !== null && (
                          <g
                            data-testid={`tambah-midset-kanvas-${id}`}
                            className="cursor-pointer"
                            style={{ touchAction: 'none' }}
                            onPointerDown={(e) =>
                              mulaiSeretGagangMidset(e, id, -1, countBebas, posTambah, true)
                            }
                          >
                            {peranAktif !== 'tetikus' && (
                              <circle
                                data-editor-ui="1"
                                cx={sx(posTambah.x)}
                                cy={sy(posTambah.y)}
                                r={rHitSentuh}
                                fill="#ffffff"
                                fillOpacity={0.001}
                              />
                            )}
                            <circle
                              cx={sx(posTambah.x)}
                              cy={sy(posTambah.y)}
                              r={uk(0.8)}
                              fill="#0f172a"
                              stroke="#38bdf8"
                              strokeWidth={uk(0.2)}
                              strokeDasharray="0.45 0.3"
                            />
                            <text
                              x={sx(posTambah.x)}
                              y={sy(posTambah.y) + uk(0.38)}
                              textAnchor="middle"
                              fontSize={uk(1.15)}
                              fill="#38bdf8"
                              style={{ pointerEvents: 'none', fontWeight: 700 }}
                            >
                              +
                            </text>
                          </g>
                        )}
                      </g>
                    )
                  })}
                </g>
              )}

              {/* #22.1 — Gagang kendali interaktif bentuk parametrik hidup (P0, P1, C1, C2) */}
              {!playing && (set?.bentukTerikat?.length ?? 0) > 0 && (
                <g data-testid="lapisan-gagang-bentuk" data-editor-ui="1">
                  {set!.bentukTerikat!.map((b) => {
                    if (!b.memberIds.some((id) => visibleIds.has(id))) return null
                    const x0 = sx(b.p0.x)
                    const y0 = sy(b.p0.y)
                    const x1 = sx(b.p1.x)
                    const y1 = sy(b.p1.y)
                    const vx = x1 - x0
                    const vy = y1 - y0
                    const len = Math.hypot(vx, vy) || 1
                    const ux = vx / len
                    const uy = vy / len
                    // Tangkai gagang ujung menjorok 2,4 unit ke luar supaya tidak menutupi titik pemain ujung
                    const tangkai = uk(2.4)
                    const hx0 = b.jenis === 'lingkaran' ? x0 : x0 - ux * tangkai
                    const hy0 = b.jenis === 'lingkaran' ? y0 : y0 - uy * tangkai
                    const hx1 = x1 + ux * tangkai
                    const hy1 = y1 + uy * tangkai
                    const rGagang = uk(0.85)
                    const dIntan = uk(0.85)
                    return (
                      <g key={`handles-${b.id}`} data-testid={`grup-gagang-bentuk-${b.id}`}>
                        {/* Garis tangkai ujung P0 & P1 */}
                        {b.jenis !== 'lingkaran' && (
                          <line
                            x1={x0}
                            y1={y0}
                            x2={hx0}
                            y2={hy0}
                            stroke="#f59e0b"
                            strokeWidth={uk(0.18)}
                            style={{ pointerEvents: 'none' }}
                          />
                        )}
                        <line
                          x1={x1}
                          y1={y1}
                          x2={hx1}
                          y2={hy1}
                          stroke="#f59e0b"
                          strokeWidth={uk(0.18)}
                          style={{ pointerEvents: 'none' }}
                        />

                        {/* Tangkai & gagang lengkung C1 / C2 */}
                        {b.c1 && (b.jenis === 'kurva_satu' || b.jenis === 'kurva_s') && (
                          <>
                            <line
                              x1={x0}
                              y1={y0}
                              x2={sx(b.c1.x)}
                              y2={sy(b.c1.y)}
                              stroke="#fde047"
                              strokeOpacity={0.75}
                              strokeWidth={uk(0.16)}
                              strokeDasharray="0.6 0.45"
                              style={{ pointerEvents: 'none' }}
                            />
                            {b.jenis === 'kurva_satu' && (
                              <line
                                x1={x1}
                                y1={y1}
                                x2={sx(b.c1.x)}
                                y2={sy(b.c1.y)}
                                stroke="#fde047"
                                strokeOpacity={0.75}
                                strokeWidth={uk(0.16)}
                                strokeDasharray="0.6 0.45"
                                style={{ pointerEvents: 'none' }}
                              />
                            )}
                            <polygon
                              data-testid={`gagang-bentuk-${b.id}-c1`}
                              points={`${sx(b.c1.x)},${sy(b.c1.y) - dIntan} ${sx(b.c1.x) + dIntan},${sy(b.c1.y)} ${sx(b.c1.x)},${sy(b.c1.y) + dIntan} ${sx(b.c1.x) - dIntan},${sy(b.c1.y)}`}
                              fill="#fde047"
                              stroke="#78350f"
                              strokeWidth={uk(0.22)}
                              className="cursor-grab"
                              style={{ touchAction: 'none' }}
                              onPointerDown={(e) => mulaiSeretGagangBentuk(e, b, 'c1')}
                            />
                          </>
                        )}

                        {b.c2 && b.jenis === 'kurva_s' && (
                          <>
                            <line
                              x1={x1}
                              y1={y1}
                              x2={sx(b.c2.x)}
                              y2={sy(b.c2.y)}
                              stroke="#fde047"
                              strokeOpacity={0.75}
                              strokeWidth={uk(0.16)}
                              strokeDasharray="0.6 0.45"
                              style={{ pointerEvents: 'none' }}
                            />
                            <polygon
                              data-testid={`gagang-bentuk-${b.id}-c2`}
                              points={`${sx(b.c2.x)},${sy(b.c2.y) - dIntan} ${sx(b.c2.x) + dIntan},${sy(b.c2.y)} ${sx(b.c2.x)},${sy(b.c2.y) + dIntan} ${sx(b.c2.x) - dIntan},${sy(b.c2.y)}`}
                              fill="#fde047"
                              stroke="#78350f"
                              strokeWidth={uk(0.22)}
                              className="cursor-grab"
                              style={{ touchAction: 'none' }}
                              onPointerDown={(e) => mulaiSeretGagangBentuk(e, b, 'c2')}
                            />
                          </>
                        )}

                        {/* Gagang P0 & P1 */}
                        <circle
                          data-testid={`gagang-bentuk-${b.id}-p0`}
                          cx={hx0}
                          cy={hy0}
                          r={rGagang}
                          fill="#f59e0b"
                          stroke="#0f172a"
                          strokeWidth={uk(0.22)}
                          className="cursor-grab"
                          style={{ touchAction: 'none' }}
                          onPointerDown={(e) => mulaiSeretGagangBentuk(e, b, 'p0')}
                        />
                        <circle
                          data-testid={`gagang-bentuk-${b.id}-p1`}
                          cx={hx1}
                          cy={hy1}
                          r={rGagang}
                          fill="#f59e0b"
                          stroke="#0f172a"
                          strokeWidth={uk(0.22)}
                          className="cursor-grab"
                          style={{ touchAction: 'none' }}
                          onPointerDown={(e) => mulaiSeretGagangBentuk(e, b, 'p1')}
                        />
                      </g>
                    )
                  })}
                </g>
              )}

              {/* #22.3 — Kotak batas seleksi interaktif: 8 gagang Stretch/Squeeze + tangkai Putar Bebas */}
              {!playing && kotakSeleksi && (
                <g data-testid="kotak-seleksi-kanvas" data-editor-ui="1">
                  {(() => {
                    const padX = kotakSeleksi.lebar < 0.5 ? uk(1.6) : 0
                    const padY = kotakSeleksi.tinggi < 0.5 ? uk(1.6) : 0
                    const left = sx(kotakSeleksi.maxX) - padX
                    const right = sx(kotakSeleksi.minX) + padX
                    const top = sy(kotakSeleksi.maxY) - padY
                    const bottom = sy(kotakSeleksi.minY) + padY
                    const midX = (left + right) / 2
                    const midY = (top + bottom) / 2
                    const uKtk = uk(0.72)
                    const yPutar = top - uk(3.6)
                    const gagang8: [SudutGagangSkala, number, number][] = [
                      ['nw', left, top],
                      ['n', midX, top],
                      ['ne', right, top],
                      ['e', right, midY],
                      ['se', right, bottom],
                      ['s', midX, bottom],
                      ['sw', left, bottom],
                      ['w', left, midY],
                    ]
                    return (
                      <>
                        <rect
                          x={left}
                          y={top}
                          width={Math.max(0.2, right - left)}
                          height={Math.max(0.2, bottom - top)}
                          fill="none"
                          stroke="#38bdf8"
                          strokeOpacity={0.85}
                          strokeWidth={uk(0.2)}
                          strokeDasharray="0.9 0.55"
                          style={{ pointerEvents: 'none' }}
                        />
                        {/* Tangkai & gagang putar bebas */}
                        <line
                          x1={midX}
                          y1={top}
                          x2={midX}
                          y2={yPutar}
                          stroke="#10b981"
                          strokeWidth={uk(0.2)}
                          style={{ pointerEvents: 'none' }}
                        />
                        <circle
                          data-testid="gagang-putar-bebas"
                          cx={midX}
                          cy={yPutar}
                          r={uk(0.95)}
                          fill="#10b981"
                          stroke="#0f172a"
                          strokeWidth={uk(0.22)}
                          className="cursor-grab"
                          style={{ touchAction: 'none' }}
                          onPointerDown={mulaiSeretGagangPutar}
                        />
                        {sudutPutarBebas !== null && (
                          <text
                            data-testid="lencana-sudut-putar"
                            x={midX}
                            y={yPutar - uk(1.5)}
                            textAnchor="middle"
                            fontSize={uk(1.45)}
                            fill="#a7f3d0"
                            style={{ pointerEvents: 'none', fontWeight: 700 }}
                          >
                            {sudutPutarBebas > 0 ? `+${sudutPutarBebas}°` : `${sudutPutarBebas}°`}
                          </text>
                        )}
                        {gagang8.map(([sudut, gx, gy]) => (
                          <rect
                            key={sudut}
                            data-testid={`gagang-skala-${sudut}`}
                            x={gx - uKtk}
                            y={gy - uKtk}
                            width={uKtk * 2}
                            height={uKtk * 2}
                            rx={uk(0.2)}
                            fill="#38bdf8"
                            stroke="#0f172a"
                            strokeWidth={uk(0.2)}
                            className="cursor-pointer"
                            style={{ touchAction: 'none' }}
                            onPointerDown={(e) => mulaiSeretGagangSkala(e, sudut)}
                          />
                        ))}
                      </>
                    )
                  })()}
                </g>
              )}
            </svg>
          </div>

          {/* B2 — Kontrol animasi: garis waktu, kecepatan, ulang, per section */}
          <div
            data-testid="kontrol-animasi"
            className="flex flex-wrap items-center gap-2 border-t border-slate-800 px-3 py-2"
          >
            <Button
              size="sm"
              variant={playing ? 'danger' : 'primary'}
              data-kiosk-allow
              data-testid="tombol-main"
              onClick={() => {
                if (!playing && !nextSet) {
                  toast.push('Tidak ada set berikutnya', 'info')
                  return
                }
                setPlaying((v) => !v)
              }}
              title="Mainkan / jeda (Spasi)"
            >
              {playing ? <IconPause size={14} /> : <IconPlay size={14} />}
            </Button>

            <div className="relative flex min-w-[120px] flex-1 items-center py-1">
              {set && nextSet && (hasilTabrakan?.kejadian.length ?? 0) > 0 && (
                <div
                  data-testid="penanda-tabrakan-scrubber"
                  className="pointer-events-none absolute inset-x-1 -top-1 h-2"
                >
                  {hasilTabrakan!.kejadian.slice(0, 10).map((k, idxTick) => {
                    const counts = Math.max(1, set.counts ?? 8)
                    const persen = Math.min(100, Math.max(0, (k.padaCount / counts) * 100))
                    return (
                      <button
                        key={k.id}
                        type="button"
                        data-testid={`tik-benturan-${idxTick}`}
                        onClick={() => fokusBenturan(k)}
                        title={`${k.kodeA} × ${k.kodeB} pada hitungan ${k.padaCount}`}
                        style={{
                          left: `${persen}%`,
                          backgroundColor: k.tingkat === 'tabrakan' ? '#f43f5e' : '#f59e0b',
                        }}
                        className="pointer-events-auto absolute top-0 h-2 w-2 -translate-x-1/2 rounded-full ring-1 ring-slate-950"
                      />
                    )
                  })}
                </div>
              )}
              <input
                ref={sliderRef}
                type="range"
                min={0}
                max={view.perHitungan ? Math.max(1, set?.counts ?? 1) : 1}
                step={view.perHitungan ? 1 : 0.005}
                defaultValue={0}
                data-kiosk-allow
                data-testid="garis-waktu"
                onInput={(e) => {
                  const v = Number(e.currentTarget.value)
                  // Mode per hitungan: nilainya hitungan, diubah jadi progres 0..1.
                  geserKe(view.perHitungan ? v / Math.max(1, set?.counts ?? 1) : v)
                }}
                title={
                  view.perHitungan
                    ? 'Geser hitungan demi hitungan'
                    : 'Geser bebas di tengah perpindahan'
                }
                className="h-1.5 w-full accent-emerald-500"
              />
            </div>

            <Button
              size="sm"
              variant={view.perHitungan ? 'primary' : 'soft'}
              data-kiosk-allow
              data-testid="tombol-perhitungan"
              onClick={() => ubah('perHitungan', !view.perHitungan)}
              title="Bilah waktu melangkah per hitungan (, dan . untuk mundur/maju)"
            >
              ⌗ Per hitungan
            </Button>

            <span className="whitespace-nowrap text-[11px] tabular-nums text-slate-400">
              <span data-live-count>{`Count 0/${set?.counts ?? 0}`}</span>
              <span className="text-slate-600"> · {durasiDetik.toFixed(1)}s</span>
            </span>

            <div className="flex w-full items-center gap-2 sm:w-auto">
            <Select
              value={String(view.cepat)}
              data-kiosk-allow
              data-testid="kecepatan"
              onChange={(e) => ubah('cepat', Number(e.target.value))}
              className="w-20 py-1 text-xs"
              title="Kecepatan animasi"
            >
              <option value="0.25">0,25×</option>
              <option value="0.5">0,5×</option>
              <option value="1">1×</option>
              <option value="1.5">1,5×</option>
              <option value="2">2×</option>
            </Select>
            {/* #4 — tempo latihan lagu disatukan dengan pengali kecepatan. */}
            {(adaLatihanDrill || view.cepat !== 1) && (
              <span className="flex items-center gap-1" data-testid="drill-latihan">
                <span
                  className="whitespace-nowrap rounded-full border border-amber-500/50 bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-200"
                  title={
                    adaLatihanDrill
                      ? `Tempo latihan lagu ${lagu?.title ?? ''} × kecepatan animasi ${view.cepat}×`
                      : 'Kecepatan animasi'
                  }
                >
                  {adaLatihanDrill
                    ? `${labelLatihan(latihanDrill)}${view.cepat !== 1 ? ` × ${String(view.cepat).replace('.', ',')}` : ''}`
                    : `${String(view.cepat).replace('.', ',')}×`}
                </span>
                <button
                  type="button"
                  data-kiosk-allow
                  onClick={keTempoAsli}
                  className="whitespace-nowrap rounded-md border border-slate-700 px-1.5 py-0.5 text-[10px] text-slate-300 hover:bg-slate-800"
                  data-testid="drill-tempo-asli"
                >
                  Tempo asli
                </button>
              </span>
            )}

            <Button
              size="sm"
              variant={view.ulang ? 'primary' : 'soft'}
              data-kiosk-allow
              data-testid="tombol-ulang"
              onClick={() => ubah('ulang', !view.ulang)}
              title="Ulangi perpindahan ini terus-menerus (L)"
            >
              ↻ Ulang
            </Button>

            <Select
              value={seksiAnimasi}
              data-kiosk-allow
              data-testid="seksi-animasi"
              onChange={(e) => setSeksiAnimasi(e.target.value)}
              className="w-28 py-1 text-xs"
              title="Mainkan hanya section ini"
            >
              <option value="all">Semua section</option>
              {visibleSections().map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </Select>

            <Button
              size="sm"
              variant={urutan ? 'primary' : 'soft'}
              data-kiosk-allow
              data-testid="tombol-urutan-editor"
              onClick={mulaiUrutan}
              disabled={sets.length < 2}
              title="Mainkan semua set berurutan mengikuti tempo (R)"
            >
              ▶▶
            </Button>
            <Button
              size="sm"
              variant="ghost"
              data-kiosk-allow
              data-testid="tombol-reset"
              onClick={resetAnimasi}
              title="Kembalikan ke posisi awal set ini"
            >
              ⏹
            </Button>
            </div>
          </div>

          {/* #5 sisa & #12c — penggaris musik × drill */}
          {lagu && penggaris && penggaris.set.length > 0 && (
            <PenggarisMusikDrill
              lagu={lagu}
              penggaris={penggaris}
              idxAktif={idx}
              partiturDrillTerbuka={partiturDrillTerbuka}
              onTogglePartitur={() => setPartiturDrillTerbuka((v) => !v)}
              keHitungan={keHitungan}
              lebarBlok={lebarBlok}
              catatanLintas={catatanLintas}
            />
          )}

          {/* #11d — Partitur pendamping lapangan: sorot birama aktif sinkron saat drill berjalan / digeser */}
          {lagu && lagu.partitur && partiturDrillTerbuka && (
            <div className="border-t border-slate-800 p-3" data-testid="drill-panel-partitur">
              <LayarPartitur
                song={lagu}
                onTutup={() => setPartiturDrillTerbuka(false)}
                sectionsTim={settings.sections}
                namaTim={settings.teamName}
                biramaAktif={biramaDrill}
                sedangMain={playing}
                labelKonteksPutar="Drill"
                onToggleMain={() => {
                  if (playing) {
                    setUrutan(false)
                    setPlaying(false)
                  } else if (nextSet) {
                    setPlaying(true)
                  } else {
                    mulaiUrutan()
                  }
                }}
                onLoncatBirama={(bir) => {
                  const h = hitunganPadaBirama(
                    sets.map((s) => ({ counts: s.counts, name: s.name })),
                    {
                      bpm: lagu.bpm,
                      tandaBirama: lagu.tandaBirama ?? dariBeatsLama(lagu.beats),
                      tempoMap: lagu.tempoMap,
                      latih: lagu.latih ?? null,
                    },
                    bir,
                    { beatsPerCount: drill.beatsPerCount },
                  )
                  keHitungan(h)
                }}
                frasa={flDrill.frasaUntuk(lagu.id, lagu.ulangBagian)}
                panjangBiramaLagu={lagu.panjangBirama}
                onUbahFrasa={(patch) => {
                  flDrill.aturFrasa(lagu.id, patch, lagu.ulangBagian)
                }}
                onHapusFrasa={() => {
                  flDrill.hapusFrasa(lagu.id)
                }}
                tempoLatihan={latihanDrill}
                onAturPersenTempo={(persen) =>
                  tl.aturTempo(lagu.id, { mode: 'persen', persen, geser: 0 })
                }
                daftarSetDrill={daftarSetBiramaDrill}
              />
            </div>
          )}

          {/* Keterangan */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-800 px-3 py-2 text-[11px] text-slate-500">
            <span>
              Titik: <b className="text-slate-300">{placed.filter((id) => visibleIds.has(id)).length}</b> dari{' '}
              {visible.length} anggota
            </span>
            {selected.length > 0 && <span className="text-emerald-400">{selected.length} dipilih</span>}
            {petik && (
              <span className="font-medium text-emerald-400" data-testid="petunjuk-petik">
                Sentuh lapangan untuk {petik.tahap === 1 ? 'titik awal' : 'ujung'} penanda “{petik.draf.label || petik.draf.jenis}” · Esc batal
              </span>
            )}
            <span>Geser titik untuk memindah · panah keyboard = 1 langkah (Shift = 4)</span>
          </div>
        </Card>

        {/* Daftar set */}
        <Card>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-200">Set formasi</h2>
            <div className="flex gap-1">
              <Button size="sm" onClick={() => addSet(true)}>
                <IconPlus size={14} /> Set baru
              </Button>
              <Button size="sm" variant="ghost" onClick={() => moveSetOrder(-1)} disabled={idx === 0}>
                ↑
              </Button>
              <Button size="sm" variant="ghost" onClick={() => moveSetOrder(1)} disabled={idx >= sets.length - 1}>
                ↓
              </Button>
              <ConfirmButton onConfirm={removeSet} message="Hapus set?" label="Hapus" />
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={duplicateSet}
              title="Buat set baru berisi salinan set ini, tepat di setelahnya"
            >
              <IconCopy size={14} /> Duplikat
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setCopyMode('salin')}
              title="Salin isi set ini ke satu atau beberapa set lain"
            >
              Salin ke…
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setCopyMode('ambil')}
              title="Isi set ini dengan formasi dari set lain"
            >
              Ambil dari…
            </Button>
            {/* #5 sisa — pecah & gabung set: alat bantu, tidak pernah otomatis. */}
            <Button
              size="sm"
              variant={pecahTerbuka ? 'primary' : 'ghost'}
              onClick={() => (pecahTerbuka ? setPecahTerbuka(false) : bukaPecah())}
              disabled={!nextSet}
              data-testid="tombol-pecah"
              title="Pecah set ini di batas segmen atau di hitungan tertentu — posisi peralihan diambil dari jalur yang ada"
            >
              ✂ Pecah…
            </Button>
            <ConfirmButton
              label="Gabung →"
              testId="tombol-gabung"
              disabled={!nextSet}
              message={`Gabung ${set?.name ?? ''} dengan ${nextSet?.name ?? ''}?`}
              onConfirm={gabungSetBerikut}
            />
          </div>

          {/* #5 sisa — panel pecah set. Sengaja di dalam kartu set, bukan modal:
              pelatih bisa melihat hitungan & batas segmennya sambil mengisi. */}
          {pecahTerbuka && set && (
            <div className="mt-2 rounded-lg border border-amber-700/40 bg-amber-950/20 p-2.5" data-testid="panel-pecah">
              <p className="text-[11px] text-amber-100">
                Pecah <b>{set.name}</b> setelah hitungan{' '}
                <Input
                  type="number"
                  min={1}
                  max={Math.max(1, Math.floor(set.counts) - 1)}
                  value={pecahDi}
                  data-testid="pecah-hitungan"
                  onChange={(e) => setPecahDi(Number(e.target.value))}
                  className="mx-1 inline-block w-16 px-2 py-0.5 text-xs"
                />{' '}
                dari {Math.max(1, Math.floor(set.counts))}
              </p>
              <p className="mt-0.5 text-[10px] leading-snug text-slate-400">
                Set peralihan mengambil posisi pemain dari jalur yang sudah ada (termasuk busur), jadi
                formasinya sama seperti di tengah perpindahan semula. Kedua bagian menyimpan pengaturan
                jalurnya sendiri, dan hasilnya bisa dibatalkan lewat Riwayat formasi.
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {batasDiDalamSet().map((k) => (
                  <Button
                    key={k}
                    size="sm"
                    variant={pecahDi === k ? 'primary' : 'soft'}
                    data-testid={`pecah-batas-${k}`}
                    onClick={() => setPecahDi(k)}
                    title="Batas segmen lagu yang jatuh di dalam set ini"
                  >
                    Batas segmen · {k}
                  </Button>
                ))}
                <Button
                  size="sm"
                  variant={pecahDi === Math.max(1, Math.floor(set.counts / 2)) ? 'primary' : 'soft'}
                  data-testid="pecah-tengah"
                  onClick={() => setPecahDi(Math.max(1, Math.floor(set.counts / 2)))}
                >
                  Tengah
                </Button>
                <Button size="sm" variant="primary" data-testid="pecah-jalankan" onClick={() => pecahSetDi(pecahDi)}>
                  ✂ Pecah sekarang
                </Button>
                <Button size="sm" variant="ghost" data-testid="pecah-batal" onClick={() => setPecahTerbuka(false)}>
                  Batal
                </Button>
              </div>
            </div>
          )}
          <div className="scroll-thin flex gap-2 overflow-x-auto pb-1">
            {sets.map((s, i) => (
              <button
                key={s.id}
                data-kiosk-allow
                onClick={() => setIdx(i)}
                className={cx(
                  'shrink-0 rounded-lg border px-3 py-2 text-left text-xs transition',
                  i === idx
                    ? 'border-emerald-600/50 bg-emerald-600/10 text-emerald-200'
                    : 'border-slate-800 text-slate-400 hover:bg-slate-800/60',
                )}
              >
                <p className="font-medium">{s.name}</p>
                <p className="text-[10px] opacity-70">
                  {Object.keys(s.points).length} titik · {s.counts} count
                </p>
              </button>
            ))}
          </div>
          {set && (
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-[11px] text-slate-500">Nama set</label>
                <Input
                  data-testid="nama-set"
                  value={set.name}
                  onChange={(e) => {
                    set.name = e.target.value
                    db.sets.update(set.id, { name: e.target.value })
                    forceRender()
                  }}
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-slate-500">Count ke set berikutnya</label>
                <Input
                  type="number"
                  data-testid="hitungan-set"
                  value={set.counts}
                  onChange={(e) => {
                    set.counts = Number(e.target.value)
                    db.sets.update(set.id, { counts: Number(e.target.value) })
                    forceRender()
                  }}
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-slate-500">Tempo (BPM)</label>
                <Input
                  type="number"
                  value={drill.tempo}
                  onChange={(e) => db.drills.update(drill.id, { tempo: Number(e.target.value), updatedAt: Date.now() })}
                />
              </div>

              {/* #5 sisa — bantuan mengisi hitungan: set ini mulai di hitungan
                  berapa & di segmen mana, berapa lagi sampai batas segmennya. */}
              {bantuanHitungan?.ada && (
                <div className="rounded-lg border border-sky-800/40 bg-sky-950/20 p-2.5 sm:col-span-3" data-testid="bantuan-segmen">
                  <p className="text-[11px] text-sky-100">{bantuanHitungan.teks}</p>
                  <p className="mt-0.5 text-[10px] leading-snug text-slate-400" data-testid="bantuan-segmen-rinci">
                    {bantuanHitungan.teksRinci}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant={bantuanHitungan.bisaPas ? 'primary' : 'soft'}
                      disabled={!bantuanHitungan.bisaPas}
                      data-testid="tombol-pas-segmen"
                      onClick={pasKeBatasSegmen}
                      title={
                        bantuanHitungan.bisaPas
                          ? `Isi ${bantuanHitungan.sisaBulat} hitungan supaya set ini berakhir tepat di batas segmen`
                          : 'Tidak ada yang perlu diubah'
                      }
                    >
                      Pas ke batas segmen
                    </Button>
                    <span className="text-[10px] text-slate-500">
                      {bantuanHitungan.bisaPas
                        ? `jadi ${bantuanHitungan.sisaBulat} hitungan`
                        : idx >= sets.length - 1
                          ? 'set terakhir tidak berpindah'
                          : 'sudah tepat di batas segmen'}
                    </span>
                  </div>
                </div>
              )}

              {/*
                K1 — Catatan per set.

                Field `notes` sudah ada sejak lama tapi tidak pernah bisa diisi
                dari antarmuka, jadi nilainya selalu kosong. Padahal inilah
                tempat perancang menulis instruksi untuk formasi ini ("bentuk
                lingkaran", "mata ke penonton"), dan asisten di presenter
                membacakannya sebelum pemain bergerak.
              */}
              <div className="sm:col-span-3">
                <label className="mb-1 block text-[11px] text-slate-500">
                  Catatan set
                  <span className="ml-1 text-slate-600">
                    — dibacakan asisten di presenter sebelum perpindahan ke set ini
                  </span>
                </label>
                <Textarea
                  value={set.notes ?? ''}
                  onChange={(e) => {
                    set.notes = e.target.value
                    db.sets.update(set.id, { notes: e.target.value })
                    forceRender()
                  }}
                  placeholder="mis. Bentuk lingkaran, mata ke penonton, jaga jarak 2 langkah"
                  data-testid="catatan-set"
                />
              </div>

              {/* M1 — tautkan lagu: tempo & segmen lagu dipakai drill */}
              <div className="sm:col-span-3" data-testid="kartu-lagu-drill">
                <label className="mb-1 block text-[11px] text-slate-500">
                  Musik pengiring (opsional)
                </label>
                <Select
                  value={drill.songId ?? ''}
                  onChange={(e) =>
                    db.drills.update(drill.id, {
                      songId: e.target.value || undefined,
                      updatedAt: Date.now(),
                    })
                  }
                  data-testid="pilih-lagu-drill"
                >
                  <option value="">Tanpa lagu — tempo datar drill</option>
                  {(daftarLagu ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </Select>

                {lagu && petaSet && petaSet.length > 0 ? (
                  <div className="mt-2 rounded-lg border border-emerald-700/40 bg-emerald-950/20 p-2.5">
                    <p className="text-[11px] text-emerald-200" data-testid="info-lagu-drill">
                      Drill mengikuti <b>{lagu.title}</b> — tempo &amp; sukat tiap set diambil dari
                      birama lagu tempat set itu mulai.
                    </p>
                    {petaSet[idx] && (
                      <p className="mt-1 text-[11px] text-emerald-300/80" data-testid="info-set-ke-birama">
                        Set ini: birama {petaSet[idx].biramaMulai.toFixed(1)} · {petaSet[idx].bpm} BPM ·{' '}
                        {labelBirama(petaSet[idx].birama)} ({petaSet[idx].birama.kelompok.join('+')}) ·{' '}
                        {petaSet[idx].detik.toFixed(1)} dtk
                      </p>
                    )}
                    {(() => {
                      // Tunjukkan hanya set yang temponya berbeda — itu yang
                      // paling perlu diketahui, tanpa membanjiri layar.
                      const beda = petaSet.filter((p, i) => i > 0 && p.bpm !== petaSet[i - 1].bpm)
                      if (beda.length === 0)
                        return (
                          <p className="mt-1 text-[11px] text-slate-500">
                            Tempo lagu datar {petaSet[0].bpm} BPM di semua set.
                          </p>
                        )
                      return (
                        <p className="mt-1 text-[11px] text-slate-400" data-testid="ringkas-perubahan">
                          Perubahan tempo:{' '}
                          {beda
                            .slice(0, 4)
                            .map((p) => `set ${p.index + 1} → ${p.bpm} BPM`)
                            .join(' · ')}
                          {beda.length > 4 ? ` · +${beda.length - 4} lagi` : ''}
                        </p>
                      )
                    })()}
                  </div>
                ) : (
                  <p className="mt-1 text-[11px] text-slate-500">
                    Tanpa lagu, semua set memakai tempo datar seperti sekarang.
                  </p>
                )}
              </div>

              {/* DD2, #16, & #23.2 — koreografi visual, sorotan tag, FTL/sub-kelompok, Move+Hold, Ripple, & jalur */}
              {set && (
                <PanelGerakSet
                  set={set}
                  adaSetBerikut={Boolean(nextSet)}
                  gerakSet={gerakSet}
                  simpanGerak={simpanGerak}
                  simpanVisual={simpanVisual}
                  pusatPutar={pusatPutar}
                  pusatAkhirPutar={pusatAkhirPutar}
                  ubahPutar={ubahPutar}
                  hapusPusatAkhir={hapusPusatAkhir}
                  hitungPusatAkhir={hitungPusatAkhir}
                  jumlahIkutBusur={busurKeluar.size}
                  seksiUnik={seksiUnik}
                  selectedIds={selected}
                  rosterById={rosterById}
                  simpanTampilanTagSet={simpanTampilanTagSet}
                />
              )}
            </div>
          )}
        </Card>
      </div>

      {/* ------------------------------- Panel -------------------------------- */}
      <div className="min-w-0 space-y-4">
        <Card>
          <h2 className="mb-2 text-sm font-semibold text-slate-200">Alat kanvas &amp; pengunci sumbu</h2>
          <div className="grid grid-cols-3 gap-1">
            <Button
              size="sm"
              data-testid="alat-select"
              variant={tool === 'select' ? 'primary' : 'soft'}
              onClick={() => setTool('select')}
              className="px-1.5 text-xs"
            >
              Pilih &amp; geser
            </Button>
            <Button
              size="sm"
              data-testid="alat-lasso"
              variant={tool === 'lasso' ? 'primary' : 'soft'}
              onClick={() => setTool('lasso')}
              className="px-1.5 text-xs"
            >
              Lasso bebas
            </Button>
            <Button
              size="sm"
              data-testid="alat-pan"
              variant={tool === 'pan' ? 'primary' : 'soft'}
              onClick={() => setTool('pan')}
              className="px-1.5 text-xs"
              title="Seret di area kosong lapangan untuk menggeser tampilan (di mode Sentuh aktif otomatis)"
            >
              Geser papan
            </Button>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
            {tool === 'pan'
              ? 'Seret area kosong untuk menggeser lapangan (gunakan cubit 2 jari, Ctrl+Wheel, atau tombol +/− di atas untuk zoom).'
              : tool === 'lasso'
                ? 'Seret poligon bebas mengelilingi barisan melengkung/miring (tahan Shift untuk tambah/kurangi pilihan).'
                : peranAktif === 'sentuh'
                  ? 'Mode sentuh aktif: seret titik/gagang untuk memindahkan, seret 1 jari di area kosong untuk menggeser lapangan, tahan titik/ikon untuk info.'
                  : 'Geser titik atau gagang di kanvas. Seret kotak di area kosong (atau tahan Alt untuk lasso cepat).'}
          </p>

          {/* #22.4 — Pengunci Sumbu Gerak (Axis Lock X / Y) */}
          <div className="mt-3 rounded-xl border border-slate-800 bg-slate-900/60 p-2" data-testid="panel-kunci-sumbu">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[11px] font-medium text-slate-300">Kunci sumbu gerak</span>
              <span className="text-[10px] text-slate-500">Tombol X / Y</span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              <Button
                size="sm"
                data-testid="sumbu-bebas"
                variant={view.kunciSumbu === 'bebas' ? 'primary' : 'soft'}
                onClick={() => ubah('kunciSumbu', 'bebas')}
                className="px-1 text-[11px]"
              >
                Bebas
              </Button>
              <Button
                size="sm"
                data-testid="kunci-sumbu-x"
                variant={view.kunciSumbu === 'hanya_x' ? 'primary' : 'soft'}
                onClick={() =>
                  ubah('kunciSumbu', view.kunciSumbu === 'hanya_x' ? 'bebas' : 'hanya_x')
                }
                className="px-1 text-[11px]"
                title="Gerak mendatar kiri–kanan saja, menahan posisi depan–belakang (X)"
              >
                ↔ Sumbu X
              </Button>
              <Button
                size="sm"
                data-testid="kunci-sumbu-y"
                variant={view.kunciSumbu === 'hanya_y' ? 'primary' : 'soft'}
                onClick={() =>
                  ubah('kunciSumbu', view.kunciSumbu === 'hanya_y' ? 'bebas' : 'hanya_y')
                }
                className="px-1 text-[11px]"
                title="Gerak maju–mundur saja, menahan posisi garis yard tetap (Y)"
              >
                ↕ Sumbu Y
              </Button>
            </div>
          </div>

          <div className="mt-3 space-y-1.5">
            <Toggle
              checked={view.snap}
              onChange={(v) => ubah('snap', v)}
              label={`Snap ke grid (${Math.round((1 / sYd) * 10) / 10} langkah/yard)`}
            />
            {view.snap && (
              <div className="grid grid-cols-2 gap-1.5 rounded-lg border border-slate-800/80 bg-slate-900/40 p-2">
                <div>
                  <label className="mb-0.5 block text-[10px] text-slate-400" htmlFor="pilih-snap-x">
                    Bulat X (kiri–kanan)
                  </label>
                  <Select
                    id="pilih-snap-x"
                    data-testid="pilih-snap-x"
                    value={String(view.langkahX)}
                    onChange={(e) => ubah('langkahX', Number(e.target.value) as LangkahBulat)}
                    className="py-1 text-xs"
                  >
                    <option value="1">1 langkah</option>
                    <option value="0.5">1/2 langkah</option>
                    <option value="0.25">1/4 langkah</option>
                    <option value="0">Bebas</option>
                  </Select>
                </div>
                <div>
                  <label className="mb-0.5 block text-[10px] text-slate-400" htmlFor="pilih-snap-y">
                    Bulat Y (depan–blk)
                  </label>
                  <Select
                    id="pilih-snap-y"
                    data-testid="pilih-snap-y"
                    value={String(view.langkahY)}
                    onChange={(e) => ubah('langkahY', Number(e.target.value) as LangkahBulat)}
                    className="py-1 text-xs"
                  >
                    <option value="1">1 langkah</option>
                    <option value="0.5">1/2 langkah</option>
                    <option value="0.25">1/4 langkah</option>
                    <option value="0">Bebas</option>
                  </Select>
                </div>
              </div>
            )}
            <Toggle checked={view.kode} onChange={(v) => ubah('kode', v)} label="Tampilkan kode pemain" />
            <Toggle checked={view.penanda} onChange={(v) => ubah('penanda', v)} label="Penanda lapangan (M)" />

            <p className="mt-3 mb-1 text-[11px] font-medium text-slate-400">Jejak gerakan</p>
            <Toggle checked={view.jalur} onChange={(v) => ubah('jalur', v)} label="Ke set berikutnya (biru)" />
            <Toggle checked={view.masuk} onChange={(v) => ubah('masuk', v)} label="Dari set sebelumnya (kuning)" />
            <Toggle checked={view.panah} onChange={(v) => ubah('panah', v)} label="Panah arah" />
            <Toggle checked={view.hantu} onChange={(v) => ubah('hantu', v)} label="Titik hantu (posisi asal/tujuan)" />
            <Toggle checked={view.jarak} onChange={(v) => ubah('jarak', v)} label="Angka jarak (langkah)" />
            <Toggle
              checked={view.tapak}
              onChange={(v) => ubah('tapak', v)}
              label="Tapak langkah (satu tanda tiap langkah)"
            />
            <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
              Kuning = dari mana pemain datang · biru = ke mana ia jalan. Kalau ada titik
              dipilih, jejak cuma digambar untuk titik itu.
            </p>
            <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
              <b>Tapak langkah</b> menandai <b>tiap satu langkah</b> di sepanjang jejak — jadi
              kelihatan berapa kali pemain melangkah dan seberapa panjang langkahnya. Hanya
              digambar untuk pemain yang <b>dipilih</b>, dan jumlahnya mengikuti mode langkah:
              mode <i>ikut hitungan</i> menaruh tapak sesuai hitungan.
            </p>
          </div>
        </Card>

        {/* ------------- #12c, #16.2, & #22 — Panel Bentuk Hidup & Inspektor Terpadu ------------- */}
        <PanelAlatFormasi
          selectedCount={selected.length}
          totalTampil={placed.filter((id) => visibleIds.has(id)).length}
          onPilihSemua={() =>
            setSelected(Object.keys(set?.points ?? {}).filter((id) => visibleIds.has(id)))
          }
          onKosongkanPilihan={() => setSelected([])}
          bisaPutarSkala={bisaPutarSkala}
          bisaRatakan={bisaRatakan}
          sudutPutar={sudutPutar}
          setSudutPutar={setSudutPutar}
          ikutBusur={ikutBusur}
          setIkutBusur={setIkutBusur}
          putarBlok={putarBlok}
          persenSkala={persenSkala}
          setPersenSkala={setPersenSkala}
          ubahUkuran={ubahUkuran}
          porosCermin={porosCermin}
          setPorosCermin={setPorosCermin}
          cerminBlok={cerminBlok}
          sejajarkan={alignSelection}
          ratakanJarak={distributeSelection}
          opsiBentuk={opsiBentuk}
          setOpsiBentuk={ubahOpsiBentuk}
          ikatBentukHidup={ikatBentukHidup}
          setIkatBentukHidup={setIkatBentukHidup}
          pratinjauAktif={pratinjauBentukAktif}
          setPratinjauAktif={setPratinjauBentukAktif}
          onTerapkanBentuk={terapkanBentukCepat}
          bentukTerikat={set?.bentukTerikat ?? []}
          selectedIds={selected}
          adaSetSebelum={Boolean(prevSet)}
          adaSetBerikut={Boolean(nextSet)}
          onPilihAnggotaBentuk={(ids) => setSelected(ids.filter((id) => visibleIds.has(id)))}
          onBulatkanBentuk={bulatkanBentukTerikat}
          onSalinBentukKeSet={(idBentuk, arah) => void salinBentukKeSet(idBentuk, arah)}
          onLepasBentuk={lepasBentukTerikat}
        />

        <PenandaPanel
          markers={markers}
          sYd={sYd}
          edit={editPenanda}
          setEdit={setEditPenanda}
          petik={petik}
          setPetik={setPetik}
          onSimpan={simpanPenanda}
          setAktif={set ? { id: set.id, name: set.name } : undefined}
          roster={roster}
        />

        {/* --------- DD3, #12c, & #24 — Analitik gerakan, Benturan, 2-Opt, & Spasi --------- */}
        {set && (
          <PanelAnalitikGerak
            drill={drill}
            adaSetBerikut={Boolean(nextSet)}
            nyalaAnalitik={view.analitik}
            onToggleAnalitik={(v) => ubah('analitik', v)}
            analisis={analisis}
            ambang={ambang}
            terberat={terberat}
            rosterById={rosterById}
            hasilTabrakan={hasilTabrakan}
            tampilCincinTabrakan={tampilCincinTabrakan}
            onToggleCincinTabrakan={setTampilCincinTabrakan}
            onFokusBenturan={fokusBenturan}
            saranTukarSilang={saranTukarSilang}
            idPratinjauTukar={idPratinjauTukar}
            onPratinjauTukar={setIdPratinjauTukar}
            onTukarSatuPasangan={tukarSatuPasangan}
            onTukarSemuaSilang={tukarSemuaSilang}
            temuanSpasi={temuanSpasi}
            onPilihBarisanSpasi={setSelected}
            onRatakanSpasi={ratakanSpasi}
            onIkatKeGarisHidup={ikatKeGarisHidup}
          />
        )}

        <Card>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-200">Anggota &amp; Tag</h2>
            <Select
              data-testid="filter-anggota-editor"
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
              className="w-36 py-1 text-xs"
            >
              <option value="all">Semua</option>
              {visibleSections().map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
              {daftarTagRoster.length > 0 && (
                <optgroup label="Tag Lintas-Seksi">
                  {daftarTagRoster.map(({ tag }) => (
                    <option key={`tag:${tag}`} value={`tag:${tag}`}>
                      #{tag}
                    </option>
                  ))}
                </optgroup>
              )}
            </Select>
          </div>

          {daftarTagRoster.length > 0 && (
            <div className="mb-2.5 flex flex-wrap gap-1" data-testid="baris-chip-tag">
              {daftarTagRoster.map(({ tag, memberIds }) => (
                <button
                  key={tag}
                  type="button"
                  data-testid={`pilih-cepat-tag-${tag}`}
                  onClick={() => pilihAnggotaBerTag(tag)}
                  className="rounded-md border border-emerald-700/40 bg-emerald-950/30 px-2 py-0.5 text-[10px] font-medium text-emerald-300 hover:bg-emerald-900/40"
                  title="Klik untuk memilih semua anggota ber-tag ini di set aktif"
                >
                  #{tag} ({memberIds.length})
                </button>
              ))}
            </div>
          )}

          {selected.length >= 2 && (
            <form
              data-testid="form-tag-massal"
              className="mb-2.5 flex gap-1"
              onSubmit={(e) => {
                e.preventDefault()
                void pasangTagKePilihan(inputTagMassal)
              }}
            >
              <Input
                data-testid="input-tag-massal"
                value={inputTagMassal}
                onChange={(e) => setInputTagMassal(e.target.value)}
                placeholder={`Beri tag ke ${selected.length} terpilih…`}
                className="py-1 text-xs"
              />
              <Button
                type="submit"
                size="sm"
                variant="soft"
                data-testid="simpan-tag-massal"
                disabled={!inputTagMassal.trim()}
              >
                + Tag
              </Button>
            </form>
          )}

          {unplaced.length > 0 && (
            <div className="mb-3">
              <p className="mb-1.5 text-[11px] font-medium text-amber-400">
                Belum masuk set ini ({unplaced.length})
              </p>
              <div className="flex flex-wrap gap-1">
                {unplaced
                  .filter((m) =>
                    sectionFilter === 'all'
                      ? true
                      : sectionFilter.startsWith('tag:')
                        ? punyaTag(m, sectionFilter.slice(4))
                        : m.section === sectionFilter,
                  )
                  .map((m) => {
                    const disiapkan = siapLetakkanId === m.id
                    return (
                      <div key={m.id} className="inline-flex overflow-hidden rounded-md border border-slate-700">
                        <button
                          type="button"
                          onClick={() => {
                            setSiapLetakkanId(null)
                            updatePoint(m.id, snapVal(0, 0))
                            setSelected([m.id])
                          }}
                          className="px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-800"
                          title="Tempatkan langsung di tengah lapangan (0, 0)"
                        >
                          + {m.code}
                        </button>
                        <button
                          type="button"
                          data-testid={`siap-letakkan-${m.id}`}
                          onClick={() => setSiapLetakkanId((cur) => (cur === m.id ? null : m.id))}
                          className={cx(
                            'border-l border-slate-700 px-1.5 py-1 text-[11px]',
                            disiapkan
                              ? 'bg-emerald-600/30 text-emerald-200'
                              : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200',
                          )}
                          title="Siapkan lalu ketuk titik tujuan di lapangan"
                        >
                          ⌖
                        </button>
                      </div>
                    )
                  })}
              </div>
            </div>
          )}

          <div className="scroll-thin max-h-72 space-y-0.5 overflow-y-auto">
            {visible.map((m) => {
              const has = !!set?.points[m.id]
              const sel = selected.includes(m.id)
              const disiapkan = siapLetakkanId === m.id
              return (
                <button
                  key={m.id}
                  onClick={() => {
                    if (!has) {
                      setSiapLetakkanId((cur) => (cur === m.id ? null : m.id))
                      return
                    }
                    setSelected(sel ? (selected.includes(m.id) ? [m.id] : []) : [m.id])
                  }}
                  className={cx(
                    'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition',
                    sel || disiapkan
                      ? 'bg-emerald-600/15 ring-1 ring-emerald-600/30'
                      : 'hover:bg-slate-800/60',
                  )}
                >
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: sectionDot(m.section) }} />
                  <NamaTampil anggota={m} className={cx('truncate', has ? 'text-slate-200' : 'text-slate-500')} />
                  {m.tags?.[0] && (
                    <span className="shrink-0 rounded bg-slate-800 px-1 py-0.5 text-[9px] text-emerald-300">
                      #{m.tags[0]}
                    </span>
                  )}
                  <span className="ml-auto shrink-0 text-[10px] text-slate-500">
                    {disiapkan ? '⌖ ketuk lapangan' : m.code}
                  </span>
                  {has && set && (
                    <span
                      onClick={(e) => {
                        e.stopPropagation()
                        snapshot()
                        const pts = { ...set.points }
                        delete pts[m.id]
                        set.points = pts
                        writePoints(pts)
                      }}
                      className="shrink-0 rounded p-0.5 text-slate-600 hover:text-rose-400"
                      title="Keluarkan dari set ini"
                    >
                      <IconTrash size={12} />
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </Card>

        {selected.length === 1 && set?.points[selected[0]] && (
          <PointInspector
            member={rosterById.get(selected[0])!}
            point={set.points[selected[0]]}
            field={f}
            onChange={(patch) => updatePoint(selected[0], patch)}
            onDetail={() => setDetailId(selected[0])}
            midsets={set.midsets?.[selected[0]]}
            countsSet={set.counts}
            adaSetBerikut={Boolean(nextSet)}
            onTambahMidset={() => tambahMidsetPemain(selected[0])}
            onUbahCountMidset={(wi, countBaru) => ubahCountMidsetPemain(selected[0], wi, countBaru)}
            onHapusMidset={(wi) => hapusMidsetPemain(selected[0], wi)}
            onTambahTag={(tag) => void tambahTagSatuAnggota(selected[0], tag)}
            onHapusTag={(tag) => void hapusTagSatuAnggota(selected[0], tag)}
          />
        )}
      </div>

      {detailId && rosterById.get(detailId) && (
        <PerformerDetailModal
          open={!!detailId}
          onClose={() => setDetailId(null)}
          drill={drill}
          sets={sets}
          member={rosterById.get(detailId)}
          onKeSet={(urutan) => setIdx(urutan)}
        />
      )}

      {set && copyMode && (
        <CopySetModal
          open={!!copyMode}
          onClose={() => setCopyMode(null)}
          sets={sets}
          currentId={set.id}
          selectedCount={selected.length}
          mode={copyMode}
          onApply={copyPoints}
        />
      )}

      {presenter && (
        <DrillPresenter
          drill={drill}
          sets={sets}
          tempoPerSet={
            petaSet
              ? daftarTempo(petaSet, drill.tempo, sets.length).map((t) => terapkanLatihan(t, latihanDrill))
              : undefined
          }
          tempoAsliPerSet={petaSet ? daftarTempo(petaSet, drill.tempo, sets.length) : undefined}
          durasiPerSet={petaSet ? petaSet.map((p) => p.detikLatihan) : undefined}
          offsetKlikPerSet={petaSet ? petaSet.map((p) =>
            p.offsetKlikLatihan.map((offset, i) => ({
              offset,
              bpm: p.bpmLatihanPerHitungan[i],
              bpmAsli: p.bpmPerHitungan[i],
            })),
          ) : undefined}
          labelLatihan={adaLatihanDrill ? labelLatihan(latihanDrill) : null}
          onTempoAsli={adaLatihanDrill ? () => drill.songId && tl.keAsli([drill.songId]) : undefined}
          roster={roster}
          startIdx={idx}
          song={lagu ?? null}
          detikMulaiPerSet={petaSet ? petaSet.map((p) => p.detikMulai) : undefined}
          lajuPerSet={petaSet ? petaSet.map((p) => lajuRekaman(p.bpm, latihanDrill)) : undefined}
          onClose={(i) => {
            setIdx(i)
            setPresenter(false)
          }}
        />
      )}

      <DotSheetModal
        open={dotSheet}
        onClose={() => setDotSheet(false)}
        drill={drill}
        sets={sets}
        roster={roster}
      />

      {KompModalCountSheet && (
        <KompModalCountSheet
          open={countSheetOpen}
          onClose={() => setCountSheetOpen(false)}
          drill={drill}
          sets={sets}
          roster={roster}
          songAwal={lagu ?? null}
          namaTim={settings?.teamName ?? 'Tim'}
          sections={settings?.sections ?? []}
        />
      )}

      {KompModalParade && (
        <KompModalParade
          open={paradeOpen}
          onClose={() => setParadeOpen(false)}
          namaTim={settings?.teamName ?? 'Tim'}
          judulDrill={drill.name}
          namaSetAktif={set?.name ?? 'Set 1'}
          tempoDrill={drill.tempo}
          field={f}
          pointsAktif={set?.points ?? {}}
          members={roster}
          laguTertaut={lagu ?? null}
          onUbahField={async (fieldBaru) => {
            await db.drills.update(drill.id, { field: fieldBaru, updatedAt: Date.now() })
          }}
          onTerapkanPointsSetAktif={async (pointsBaru, catatanRingkas) => {
            if (!set) return
            snapshot()
            await db.sets.update(set.id, {
              points: pointsBaru,
              notes: set.notes ? set.notes : catatanRingkas,
            })
            await db.drills.update(drill.id, { updatedAt: Date.now() })
          }}
          onTambahRangkaianSet={async (setsBaru, fieldOpsional) => {
            if (!setsBaru.length) return
            const posisiSisip = set ? idx + 1 : sets.length
            // Pastikan set aktif punya counts > 0 agar perpindahan menuju set baru berjalan mulus
            if (set && (!set.counts || set.counts <= 0)) {
              await db.sets.update(set.id, { counts: 8 })
            }
            const sekarang = Date.now()
            const entitasBaru: DrillSet[] = setsBaru.map((sb, i) => ({
              id: uid('set_'),
              drillId: drill.id,
              order: posisiSisip + i,
              name: `Set ${posisiSisip + i + 1} (${sb.nameSuffix})`,
              counts: sb.counts,
              points: sb.points,
              notes: sb.notes,
              gerak: sb.gerak,
              visual: sb.visual,
              createdAt: sekarang + i,
            }))
            await Promise.all(
              sets
                .slice(posisiSisip)
                .map((sLama, i) => db.sets.update(sLama.id, { order: posisiSisip + entitasBaru.length + i })),
            )
            await db.sets.bulkPut(entitasBaru)
            await db.drills.update(drill.id, {
              ...(fieldOpsional ? { field: fieldOpsional } : {}),
              updatedAt: Date.now(),
            })
            setIdx(posisiSisip)
          }}
        />
      )}

      <PaletPerintah
        open={bantuan}
        onClose={() => setBantuan(false)}
        perintah={daftarPerintahPalet}
      />

      {balonInfo && (
        <div
          data-testid="balon-info-sentuh"
          style={{
            left: Math.max(12, Math.min((typeof window !== 'undefined' ? window.innerWidth : 800) - 260, balonInfo.x - 90)),
            top: Math.max(12, balonInfo.y - 54),
          }}
          className="pointer-events-none fixed z-50 max-w-xs rounded-xl border border-slate-700 bg-slate-900/95 px-3 py-1.5 text-xs text-slate-100 shadow-xl"
        >
          {balonInfo.teks}
        </div>
      )}

      <TukarCsvModal
        open={tukarCsv}
        onClose={() => setTukarCsv(false)}
        drill={drill}
        sets={sets}
        roster={roster}
        sYd={sYd}
        lebarYd={f.widthYd}
        setAktifId={set?.id}
        koordinatTeks={(x, y) => coorTextSafe(x, y, f)}
        onUnduhLembar={exportCoordSheet}
        onSelesai={() => forceRender()}
      />

      <ImporPywareModal
        open={imporPyware}
        onClose={() => setImporPyware(false)}
        drill={drill}
        sets={sets}
        sYd={sYd}
        koordinatTeks={(x, y) => coorTextSafe(x, y, f)}
        onSelesai={(id) => {
          // Hanya mode `salinan` yang menghasilkan drill lain; pindah drill
          // tanpa perlu akan memuat ulang editor seluruhnya.
          if (id !== drill.id) onGantiDrill?.(id)
          forceRender()
        }}
      />

      <DrillSettingsModal
        open={settingsOpen}
        drill={drill}
        onClose={() => setSettingsOpen(false)}
        rosterCount={roster.length}
        namaTim={settings?.teamName ?? 'Tim'}
        setDrillId={onGantiDrill ?? (() => undefined)}
      />
    </div>
  )
}
