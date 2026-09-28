/**
 * Diekstrak dari `src/pages/Drill.tsx` (#5 — pecah Drill.tsx).
 * Isinya tidak diubah; hanya alamat impor yang disesuaikan.
 */

/** Editor formasi — kanvas titik, set, animasi, dan semua modalnya. */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type {
  Drill,
  DrillPoint,
  DrillSet,
  Facing,
  FieldMarker,
  GerakSet,
  Member,
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
import { labelLatihan, latihanAktif, terapkanLatihan } from '../lib/tempoLatihan'

import {
  coordText as coorTextSafe,
  facingDeg,
  patokOf,
  patokTerdekat,
  stepYd,
  ukurTitik,
} from '../lib/field'
import {
  AMBANG,
  ambangEfektif,
  TINGKAT_LABEL,
  TINGKAT_WARNA,
  analisisPerpindahan,
  rasioLengkung,
  setTerberat,
  tingkatLangkahDari,
} from '../lib/analitik'
import {
  cerminTitik,
  geserTitik,
  pusatKumpulan,
  putarTitik,
  skalaTitik,
} from '../lib/massa'
import {
  JALUR_LABEL,
  MUDAH_LABEL,
  type GerakLengkap,
  cocokPutaran,
  deltaBusur,
  gerakOf,
  progresPemain,
  titikJalur,
  turunkanPusatAkhir,
} from '../lib/gerak'
import { downloadHtmlFile, esc, printHtml, printShell } from '../lib/print'
import { Metronom, klikUntukDrill } from '../lib/metronome'
import { PemutarRekaman } from '../lib/rekaman'
import { dariBeatsLama, labelBirama } from '../lib/birama'
import { daftarTempo, petakanSetKeMusik, tempoSet } from '../lib/gabungMusik'
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
import { Jejak, TapakLangkah } from './JejakLangkah'
import type { BusurGambar } from './JejakLangkah'
import { PointInspector } from './PointInspector'
import { PerformerDetailModal } from './PerformerDetailModal'
import { DotSheetModal } from './DotSheetModal'
import { DrillSettingsModal } from './DrillSettingsModal'
import { ShortcutHelp } from './ShortcutHelp'

/* ========================================================================== */
/*  Editor                                                                     */
/* ========================================================================== */

type Tool = 'select' | 'place'

/**
 * Mengubah sudut (derajat) menjadi nilai `facing`.
 * 0° = menghadap penonton, 90° = ke Side 1 (kiri), -90° = ke Side 2 (kanan).
 */
function facingFromDeg(deg: number): { facing: Facing; facingDeg?: number } {
  let d = ((deg % 360) + 360) % 360
  if (d > 180) d -= 360
  if (d === 0) return { facing: 'front' }
  if (d === 180 || d === -180) return { facing: 'back' }
  if (d === 90) return { facing: 'left' }
  if (d === -90) return { facing: 'right' }
  return { facing: 'custom', facingDeg: Math.round(d * 10) / 10 }
}

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
}
const TAMPILAN_AWAL: Tampilan = { snap: true, jalur: true, masuk: true, panah: true, hantu: false, jarak: false, kode: true, penanda: true, cepat: 1, ulang: false, klik: false, analitik: false, tapak: false, perHitungan: true }

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

  /* ------------------ M1 — tautan lagu (drill mengikuti musik) ------------------ */
  /** Lagu yang ditautkan ke drill ini, kalau ada. */
  const lagu = useLiveQuery(
    async () => (drill.songId ? await db.songs.get(drill.songId) : undefined),
    [drill.songId],
  )
  /** Semua lagu di repertoar, untuk pilihan tautan. */
  const daftarLagu = useLiveQuery(() => db.songs.orderBy('title').toArray(), [], [])
  /**
   * Pemetaan tiap set ke birama, tempo, dan sukat lagu.
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
        tempoMap: lagu.tempoMap.map((t) => ({
          measure: t.measure,
          bpm: t.bpm,
          birama: t.birama,
          berangsur: t.berangsur,
        })),
        latih: lagu.latih ?? null,
      },
    )
  }, [lagu, sets, drill.beatsPerCount])
  /** Tempo yang dipakai set ke-`i`: dari lagu kalau ditautkan, kalau tidak ya tempo drill. */
  /*
   * #4 — tempo latihan lagu yang ditautkan. Presenter & animasi editor ikut
   * melambat; analitik langkah tetap memakai tempo asli (yang dinilai adalah
   * penampilan sungguhan, bukan latihannya).
   */
  const tl = useTempoLatihan()
  const latihanDrill = drill.songId && lagu ? tl.tempoUntuk(drill.songId) : null
  const adaLatihanDrill = latihanAktif(latihanDrill)
  const tempoUntuk = useCallback(
    (i: number) => terapkanLatihan(tempoSet(petaSet, i, drill.tempo), latihanDrill),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [petaSet, drill.tempo, latihanDrill?.mode, latihanDrill?.persen, latihanDrill?.geser],
  )
  /** #4 — kembali ke tempo asli: tempo latihan lagu dan pengali animasi. */
  const keTempoAsli = () => {
    if (drill.songId) tl.keAsli([drill.songId])
    ubah('cepat', 1)
  }
  const [dotSheet, setDotSheet] = useState(false)
  /** DD4 — sudut putar blok (derajat). */
  const [sudutPutar, setSudutPutar] = useState(45)
  /** DD4 — persen kembang-kempis. */
  const [persenSkala, setPersenSkala] = useState(10)
  /** DD4 — jarak geser blok, dalam langkah. */
  const [jarakGeser, setJarakGeser] = useState(4)
  /** DD4 — sekalian pasang jalur busur supaya jarak antar pemain tetap terjaga. */
  const [ikutBusur, setIkutBusur] = useState(true)
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
    // #4 — memakai tempo set ini setelah tempo latihan (sama dengan animasinya).
    return ((counts * drill.beatsPerCount * 60) / Math.max(20, tempoUntuk(idx))) / Math.max(0.05, view.cepat)
  }, [set?.counts, drill.beatsPerCount, tempoUntuk, idx, view.cepat])

  /** A7 — penanda lapangan milik drill ini (drill lama belum punya → []). */
  const markers = useMemo(() => drill?.markers ?? [], [drill?.markers])

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
  type Langkah = { setId: string; points: Record<string, DrillPoint> }[]
  /** 'salin' = dari set ini ke set lain · 'ambil' = dari set lain ke set ini. */
  const [copyMode, setCopyMode] = useState<'salin' | 'ambil' | null>(null)
  const [history, setHistory] = useState<Langkah[]>([])
  const [future, setFuture] = useState<Langkah[]>([])

  /** Simpan keadaan beberapa set sebagai satu langkah riwayat. */
  function snapshotMany(list: { id: string; points: Record<string, DrillPoint> }[]) {
    if (!list.length) return
    const langkah: Langkah = list.map((s) => ({
      setId: s.id,
      points: JSON.parse(JSON.stringify(s.points)) as Record<string, DrillPoint>,
    }))
    setHistory((h) => [...h.slice(-49), langkah])
    setFuture([])
  }

  /** Panggil sebelum mengubah titik, supaya keadaan lama bisa dikembalikan. */
  function snapshot() {
    const cur = setRef.current
    if (cur) snapshotMany([{ id: cur.id, points: cur.points }])
  }

  const undo = useCallback(async () => {
    const prev = history[history.length - 1]
    const cur = setRef.current
    if (!prev || !cur) return
    const sekarang: Langkah = prev.map((e) => {
      const s = sets.find((x) => x.id === e.setId)
      return { setId: e.setId, points: JSON.parse(JSON.stringify(s?.points ?? {})) as Record<string, DrillPoint> }
    })
    setFuture((f) => [sekarang, ...f.slice(0, 49)])
    setHistory((h) => h.slice(0, -1))
    await Promise.all(prev.map((e) => db.sets.update(e.setId, { points: e.points })))
    const i = sets.findIndex((s) => s.id === prev[0].setId)
    if (i >= 0) setIdx(i)
  }, [history, sets])

  const redo = useCallback(async () => {
    const nxt = future[0]
    const cur = setRef.current
    if (!nxt || !cur) return
    const sekarang: Langkah = nxt.map((e) => {
      const s = sets.find((x) => x.id === e.setId)
      return { setId: e.setId, points: JSON.parse(JSON.stringify(s?.points ?? {})) as Record<string, DrillPoint> }
    })
    setHistory((h) => [...h.slice(-49), sekarang])
    setFuture((f) => f.slice(1))
    await Promise.all(nxt.map((e) => db.sets.update(e.setId, { points: e.points })))
    const i = sets.findIndex((s) => s.id === nxt[0].setId)
    if (i >= 0) setIdx(i)
  }, [future, sets])
  const f = drill.field
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
  /** DD2 — cara pemain berpindah ke set berikutnya pada set yang aktif. */
  const gerakSet = gerakOf(set?.gerak)
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

  const roster = members.filter((m) => (drill.rosterIds.length ? drill.rosterIds.includes(m.id) : true))
  /** DD2 — section yang ada di drill ini, dipakai untuk mengatur tunda mulai. */
  const seksiUnik = [...new Set(roster.map((m) => m.section))]
  const visible = roster.filter((m) => (sectionFilter === 'all' ? true : m.section === sectionFilter))
  const visibleIds = new Set(visible.map((m) => m.id))
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
      return Math.max(1, Math.round((set?.counts ?? 0) * k))
    }
    // 31e — sama dengan analitik: `lurus` mengabaikan kelengkungan.
    const rasio =
      (drill.setelanJarak ?? 'jalur') === 'lurus'
        ? 1
        : gerakSet.jalur === 'lengkung'
          ? rasioLengkung(gerakSet.lengkung ?? 0)
          : 1
    const jrkYd = Math.hypot(ke.x - dari.x, ke.y - dari.y) * rasio
    return Math.max(1, Math.round(jrkYd / sYd))
  }

  /* ----------------------------- Mutasi data ------------------------------ */

  const writePoints = useCallback(
    async (points: Record<string, DrillPoint>, setId = set?.id) => {
      if (!setId) return
      await db.sets.update(setId, { points })
      await db.drills.update(drill.id, { updatedAt: Date.now() })
    },
    [set?.id, drill.id],
  )

  async function addSet(copyPrevious = true) {
    const prev = sets[sets.length - 1]
    const newSet: DrillSet = {
      id: uid('set_'),
      drillId: drill.id,
      order: sets.length,
      name: `Set ${sets.length + 1}`,
      counts: prev?.counts ?? 16,
      points: copyPrevious && prev ? JSON.parse(JSON.stringify(prev.points)) : {},
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
    const copy: DrillSet = {
      ...JSON.parse(JSON.stringify(set)),
      id: uid('set_'),
      order: idx + 1,
      name: `${dasar} (salinan)`,
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
    snapshotMany(targets.map((t) => ({ id: t.id, points: t.points })))
    for (const t of targets) {
      const isi = JSON.parse(JSON.stringify(sumber)) as Record<string, DrillPoint>
      const hasil = ganti ? isi : { ...JSON.parse(JSON.stringify(t.points)), ...isi }
      await db.sets.update(t.id, { points: hasil })
    }
    await db.drills.update(drill.id, { updatedAt: Date.now() })
  }

  async function removeSet() {
    if (!set || sets.length <= 1) return
    // 1a — difoto dulu: menghapus set bersama semua titiknya adalah
    // kehilangan yang paling sering disesali, dan paling sering baru
    // disadari besoknya.
    await foto(drill.id, 'sebelum-hapus-set')
    await db.sets.delete(set.id)
    // K3 — centang untuk set ini tidak ada gunanya lagi.
    await hapusTandaSet(drill.id, set.id)
    const rest = sets.filter((s) => s.id !== set.id)
    await Promise.all(rest.map((s, i) => (s.order === i ? null : db.sets.update(s.id, { order: i }))))
    setIdx(Math.max(0, idx - 1))
    toast.push('Set dihapus', 'info')
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
    set.points = points // optimistik untuk UI
    writePoints(points)
  }

  /* --------------------------- DD4 — Gerak massa --------------------------- */

  /** Titik yang kena operasi massa: yang dipilih, atau semua kalau tak ada pilihan. */
  function targetMassa(): string[] {
    if (!set) return []
    if (selected.length) return selected.filter((id) => set!.points[id])
    return Object.keys(set.points)
  }

  /** Terapkan satu transformasi ke semua target, dalam **satu** langkah undo. */
  function ubahMassal(ubah: (p: DrillPoint) => DrillPoint, pesan: string) {
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
    set.points = points // optimistik untuk UI
    writePoints(points)
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
    const c = pusatTarget()
    if (!c) return
    const n = targetMassa().length
    ubahMassal((p) => putarTitik(p, c, derajat), `${n} titik diputar ${derajat}°`)

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
    )
  }

  function cerminBlok(sumbu: 'x' | 'y') {
    const n = targetMassa().length
    ubahMassal(
      (p) => cerminTitik(p, sumbu),
      `${n} titik dicerminkan ${sumbu === 'x' ? 'kiri ⇄ kanan' : 'depan ⇄ belakang'}`,
    )
  }

  /**
   * Putar & kembang-kempis mengitari titik tengah target. Kalau cuma satu titik,
   * titik itu sendiri adalah pusatnya — jadi operasinya tidak berpengaruh apa-apa.
   * Daripada tombolnya diam tanpa penjelasan, lebih jujur dimatikan.
   */
  const bisaPutarSkala = targetMassa().length >= 2

  function geserBlok(sumbu: 'x' | 'y', arah: number) {
    const n = targetMassa().length
    const j = jarakGeser * sYd
    ubahMassal(
      (p) => geserTitik(p, sumbu === 'x' ? arah * j : 0, sumbu === 'y' ? arah * j : 0),
      `${n} titik digeser ${jarakGeser} langkah`,
    )
  }

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
  /** Versi ref (dipakai handler marquee yang dipasang sekali). */
  const geomRef = useRef({ sx, sy })
  geomRef.current = { sx, sy }
  const ix = (vx: number) => halfL - vx
  const iy = (vy: number) => halfW - vy

  /** `snap` dibaca lewat ref supaya handler geser selalu memakai nilai terbaru. */
  const snapRef = useRef(snap)
  snapRef.current = snap

  const snapVal = (x: number, y: number) => {
    if (!snapRef.current) return { x, y }
    // DD1 — kalau tim memakai patok, titik menempel ke patok terdekat,
    // bukan ke langkah terdekat: pemain berdiri di patok, bukan di antaranya.
    // Lapangan dibaca dari ref: handler geser memakai closure yang mungkin usang.
    const ff = fRef.current
    // DD1 — kalau tim memakai patok, titik menempel ke patok terdekat,
    // bukan ke langkah terdekat: pemain berdiri di patok, bukan di antaranya.
    if (patokOf(ff).aktif === 1) {
      return { x: patokTerdekat(ff, 'x', x), y: patokTerdekat(ff, 'y', y) }
    }
    const s = stepYd(ff)
    const setengah = ff.widthYd / 2
    const gx = Math.round(x / s) * s
    const gy = Math.round((y + setengah) / s) * s - setengah
    return { x: gx, y: gy }
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
    if (tool === 'place') return
    const additive = e.shiftKey || e.metaKey || e.ctrlKey
    const chosen = additive ? (selected.includes(memberId) ? selected : [...selected, memberId]) : [memberId]
    setSelected(chosen)
    const cur = setRef.current
    if (!cur) return
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
    const ix = document.querySelector<HTMLInputElement>('[data-live-x]')
    if (ix) ix.value = String(Math.round((p.x / sYd) * 4) / 4)
    const iy = document.querySelector<HTMLInputElement>('[data-live-y]')
    if (iy) iy.value = String(Math.round(((p.y + f.widthYd / 2) / sYd) * 4) / 4)
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
      const dx = -(u.x - d.startX)
      const dy = -(u.y - d.startY)
      if (!d.moved) {
        // Abaikan getaran kecil, lalu simpan riwayat sekali di awal geseran.
        if (Math.abs(dx) + Math.abs(dy) < 1e-6) return
        snapshot()
        d.moved = true
      }
      // `d.next` belum ada di gerakan pertama → mulai dari SEMUA titik set aktif,
      // lalu timpa hanya titik yang digeser. (Jangan mulai dari objek kosong:
      // itu akan menghapus titik pemain lain.)
      const points: Record<string, DrillPoint> = { ...(d.next ?? cur.points) }
      for (const [id, p0] of Object.entries(d.orig)) {
        const s = snapVal(p0.x + dx, p0.y + dy)
        points[id] = { ...p0, ...s }
        // Geser elemen <g> titik langsung — tanpa render ulang React.
        const g = dotRefs.current.get(id)
        if (g) g.setAttribute('transform', `translate(${sx(s.x) - sx(p0.x)} ${sy(s.y) - sy(p0.y)})`)
      }
      d.next = points
      // Jalur gerak ke set berikutnya diredupkan sementara (posisinya belum diperbarui).
      if (pathsRef.current) pathsRef.current.style.opacity = '0.25'
      updateLiveReadout(points)
    }

    /**
     * `pointermove` bisa datang lebih dari 100 kali per detik (mouse cepat,
     * layar 120 Hz). Event-nya digabung dengan requestAnimationFrame sehingga
     * paling banyak satu pembaruan per frame.
     */
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
        // Simpan ke database & sinkronkan tampilan. Sisa `transform` dibersihkan
        // oleh useLayoutEffect SETELAH React menggambar posisi baru.
        setRef.current.points = d.next
        writePoints(d.next)
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
    if (tool === 'place' && selected.length === 1) {
      const u = clientToUser(e.clientX, e.clientY)
      const p = snapVal(ix(u.x), iy(u.y))
      updatePoint(selected[0], p)
      return
    }
    if (tool === 'place') return
    const u = clientToUser(e.clientX, e.clientY)
    marqRef.current = {
      x0: u.x,
      y0: u.y,
      x1: u.x,
      y1: u.y,
      moved: false,
      additive: e.shiftKey || e.metaKey || e.ctrlKey,
    }
  }

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
      if (!selected.length || !set) return
      // Delete / Backspace = keluarkan titik terpilih dari set (bisa di-undo).
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        const points = { ...set.points }
        let hilang = 0
        for (const id of selected) if (points[id]) { delete points[id]; hilang++ }
        if (!hilang) return
        snapshot()
        set.points = points
        void writePoints(points)
        setSelected([])
        toast.push(`${hilang} titik dikeluarkan dari ${set.name}`, 'info')
        return
      }
      const step = e.shiftKey ? sYd * 4 : sYd
      let dx = 0
      let dy = 0
      if (e.key === 'ArrowLeft') dx = -step
      else if (e.key === 'ArrowRight') dx = step
      else if (e.key === 'ArrowUp') dy = step // ke back sideline
      else if (e.key === 'ArrowDown') dy = -step
      else if (e.key === 'Escape') setSelected([])
      else return
      e.preventDefault()
      const points = { ...set.points }
      for (const id of selected) {
        const p0 = points[id]
        if (!p0) continue
        points[id] = { ...p0, x: p0.x + dx, y: p0.y + dy }
      }
      snapshot()
      set.points = points
      writePoints(points)
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
          // DD2/DD4 — hitungan yang sama dengan animasi: tunda per section,
          // pembagian kecepatan, lalu posisi di jalur lurus/melengkung/busur.
          const t = progresPemain(p, gr, seksiMember.get(id), countsScrub)
          const bs = busurKeluar.get(id)
          const [tx, ty] = bs
            ? deltaBusur(t, bs.x0, bs.y0, bs.pusat, bs.sudut, bs.geser ?? { x: 0, y: 0 })
            : titikJalur(t, vx, vy, lengkungScrub)
          g.setAttribute('transform', `translate(${tx} ${ty})`)
        }
      }
      tulisCount(p)

      // #6 — sinkronkan posisi scrubber ke audio bila lagu memiliki rekaman
      if (lagu?.rekaman && petaSet?.[idx]) {
        const counts = Math.max(1, set?.counts ?? 8)
        const beats = counts * drill.beatsPerCount
        const durasiSet = beats * (60 / Math.max(20, tempoUntuk(idx)))
        const posAudio = (lagu.rekaman.titikMulaiDetik || 0) + (petaSet[idx].detik || 0) + p * durasiSet
        PemutarRekaman.get().lompat(posAudio)
      }
    },
    [playing, vektorGerak, seksiAnimasi, seksiMember, tulisCount, lagu?.rekaman, petaSet, idx, set?.counts, drill.beatsPerCount, tempoUntuk],
  )

  /** B2 — kembalikan semua titik ke posisi awal set ini. */
  const resetAnimasi = useCallback(() => {
    setPlaying(false)
    jepretRef.current = 0
    posisiRef.current = 0
    if (sliderRef.current) sliderRef.current.value = '0'
    dotRefs.current.forEach((g) => {
      if (g.hasAttribute('transform')) g.removeAttribute('transform')
    })
    tulisCount(0)
  }, [tulisCount])

  useEffect(() => {
    if (!playing) return
    const counts = Math.max(1, set?.counts ?? 8)
    const beats = counts * drill.beatsPerCount
    // M1 — tempo datar diganti tempo lagu pada set ini (kalau ditautkan).
    const msPerBeat = 60_000 / Math.max(20, tempoUntuk(idx))
    const total = beats * msPerBeat
    // B5 — klik tempo: satu detak per count, aksen di count pertama tiap set.
    // Tempo dikalikan pengali kecepatan supaya klik tetap seirama dengan animasi.
    if (klikRef.current) {
      const k = klikUntukDrill(tempoUntuk(idx) * cepatRef.current, drill.beatsPerCount, counts)
      metronomRef.current.mulai({ bpm: k.bpm, beats: k.beats, subdiv: 1, suara: 'kayu', volume: 0.9 })
    }

    // #6 — putar rekaman audio tersinkronisasi jika lagu memiliki rekaman
    if (lagu?.id && lagu.rekaman && petaSet?.[idx]) {
      const pemutar = PemutarRekaman.get()
      void pemutar.muat(lagu.id).then((siap) => {
        if (!siap) return
        const mode = lagu.rekaman?.modeBunyi ?? 'keduanya'
        pemutar.setVolume(mode === 'klik' ? 0 : (lagu.rekaman?.volumeAudio ?? 1.0))
        pemutar.setKecepatan(cepatRef.current)
        const dtkMulai = (lagu.rekaman?.titikMulaiDetik ?? 0) + (petaSet[idx].detik || 0)
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
        // DD2 — progres tiap pemain (tunda per section & pembagian kecepatan),
        // lalu posisinya pada jalur lurus, melengkung, atau busur putaran.
        const t = progresPemain(p, gr, seksiMember.get(id), counts)
        const bs = busurRef.current.get(id)
        const [tx, ty] = bs
          ? deltaBusur(t, bs.x0, bs.y0, bs.pusat, bs.sudut, bs.geser ?? { x: 0, y: 0 })
          : titikJalur(t, vx, vy, lengkung)
        g.setAttribute('transform', `translate(${tx} ${ty})`)
      }
      tulisCount(p)
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

  /* --------------------------- Generator bentuk ----------------------------- */

  function applyShape(kind: 'blok' | 'busur' | 'lingkaran' | 'garis' | 'sebar') {
    if (!set) return
    const ids = selected.length ? selected : Object.keys(set.points).filter((id) => visibleIds.has(id))
    if (!ids.length) return
    const n = ids.length
    snapshot()
    const pts = { ...set.points }
    ids.forEach((id, i) => {
      let x = 0
      let y = 0
      if (kind === 'garis') {
        x = (i - (n - 1) / 2) * sYd * 2
        y = 0
      } else if (kind === 'blok') {
        const cols = Math.ceil(Math.sqrt(n))
        const c = i % cols
        const r = Math.floor(i / cols)
        x = (c - (cols - 1) / 2) * sYd * 2
        y = (r - (Math.ceil(n / cols) - 1) / 2) * sYd * 2
      } else if (kind === 'busur') {
        const t = n === 1 ? 0.5 : i / (n - 1)
        const ang = Math.PI * (0.15 + 0.7 * t)
        x = -Math.cos(ang) * (f.lengthYd * 0.3)
        y = -halfW * 0.4 + Math.sin(ang) * (halfW * 0.8)
      } else if (kind === 'lingkaran') {
        const ang = (i / n) * Math.PI * 2
        const r = Math.min(halfW, f.lengthYd / 2) * 0.8
        x = Math.cos(ang) * r
        y = Math.sin(ang) * r * (halfW / Math.max(halfW, 1)) * (halfW / f.lengthYd > 0.3 ? 1 : 1)
      } else {
        // sebar merata di seluruh area main
        const cols = Math.ceil(Math.sqrt(n))
        const c = i % cols
        const r = Math.floor(i / cols)
        x = (c - (cols - 1) / 2) * ((f.lengthYd * 0.85) / Math.max(1, cols - 1 || 1))
        y = (r - (Math.ceil(n / cols) - 1) / 2) * ((halfW * 1.6) / Math.max(1, Math.ceil(n / cols) - 1 || 1))
      }
      const s = snapVal(x, y)
      pts[id] = { ...(pts[id] ?? { facing: 'front' as Facing }), x: s.x, y: s.y }
    })
    set.points = pts
    writePoints(pts)
    toast.push(`Bentuk ${kind} diterapkan ke ${ids.length} titik`)
  }

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
    set.points = pts
    writePoints(pts)
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
    set.points = pts
    writePoints(pts)
    toast.push(`Jarak ${sorted.length} titik diratakan`)
  }

  /**
   * Putar pilihan mengelilingi titik tengahnya. Arah hadap ikut berputar,
   * karena memutar blok tanpa memutar hadap akan membuat chart menyesatkan.
   */
  function rotateSelection(deg: number) {
    const ids = targetIds()
    if (!set || !ids.length) return
    const xs = ids.map((id) => set.points[id].x)
    const ys = ids.map((id) => set.points[id].y)
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2
    const rad = (deg * Math.PI) / 180
    snapshot()
    const pts = { ...set.points }
    for (const id of ids) {
      const p = pts[id]
      const dx = p.x - cx
      const dy = p.y - cy
      const nx = cx + dx * Math.cos(rad) - dy * Math.sin(rad)
      const ny = cy + dx * Math.sin(rad) + dy * Math.cos(rad)
      const s = snapVal(nx, ny)
      pts[id] = { ...p, x: s.x, y: s.y, ...facingFromDeg(facingDeg(p.facing, p.facingDeg) + deg) }
    }
    set.points = pts
    writePoints(pts)
    toast.push(`${ids.length} titik diputar ${deg}°`)
  }

  /**
   * Cerminkan pilihan pada titik tengahnya (jadi bloknya tidak berpindah
   * tempat). Arah hadap ikut dicerminkan: kiri ↔ kanan, atau depan ↔ belakang.
   */
  function mirrorSelection(axis: 'x' | 'y') {
    const ids = targetIds()
    if (!set || ids.length < 2) return
    const xs = ids.map((id) => set.points[id].x)
    const ys = ids.map((id) => set.points[id].y)
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2
    snapshot()
    const pts = { ...set.points }
    for (const id of ids) {
      const p = pts[id]
      const nx = axis === 'x' ? 2 * cx - p.x : p.x
      const ny = axis === 'y' ? 2 * cy - p.y : p.y
      const s = snapVal(nx, ny)
      const f0 = facingDeg(p.facing, p.facingDeg)
      pts[id] = { ...p, x: s.x, y: s.y, ...facingFromDeg(axis === 'x' ? -f0 : 180 - f0) }
    }
    set.points = pts
    writePoints(pts)
    toast.push(`${ids.length} titik dicerminkan (${axis === 'x' ? 'kiri–kanan' : 'depan–belakang'})`)
  }

  /* -------------------------------- Ekspor ---------------------------------- */

  const svgMarkup = () => {
    const el = svgRef.current
    if (!el) return ''
    const clone = el.cloneNode(true) as SVGSVGElement
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
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

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      {/* ------------------------------ Papan ------------------------------- */}
      <div className="space-y-3">
        <Card padded={false} className="overflow-hidden">
          {/* Toolbar */}
          <div className="no-print flex flex-wrap items-center gap-2 border-b border-slate-800 px-3 py-2.5">
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

            <div className="flex items-center gap-1">
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
                title="Daftar shortcut keyboard (?)"
                className="h-9 px-2.5 sm:h-8 sm:px-2"
              >
                ?
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

            <div className="ml-auto flex items-center gap-1">
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
              <Button size="sm" variant="ghost" onClick={() => setDotSheet(true)} title="Kartu/dot sheet per pemain">
                <IconPrinter size={14} /> Kartu
              </Button>
            </div>
          </div>

          {/* Kanvas */}
          <div data-kiosk-block className="drill-surface bg-slate-950 p-2 sm:p-3">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${VW} ${VH}`}
              className="w-full touch-none select-none"
              onPointerDown={onFieldClick}
              onPointerDownCapture={petik ? ambilTitikPenanda : undefined}
            >
              <FieldSurface f={f} VW={VW} VH={VH} sx={sx} sy={sy} />

              {/* A7 — penanda bebas: digambar di bawah titik pemain. */}
              {view.penanda && <MarkerLayer markers={markers} sx={sx} sy={sy} />}

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
                            panah={view.panah ? 'url(#dk-panah-masuk)' : undefined}
                          />
                        )}
                        {/* tujuan: ke set berikutnya */}
                        {ada(q) && (
                          <Jejak
                            nama="keluar"
                            x1={x}
                            y1={y}
                            x2={sx(q!.x)}
                            y2={sy(q!.y)}
                            lengkung={gerakSet.jalur === 'lengkung' ? gerakSet.lengkung : 0}
                            warna={warnaJalur(id)}
                            opacity={view.analitik ? 0.95 : 0.75}
                            busur={busurKeluar.get(id)}
                            panah={view.panah ? 'url(#dk-panah-keluar)' : undefined}
                          />
                        )}
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
                return (
                  <g
                    key={id}
                    ref={dotRefCb(id)}
                    onPointerDown={(e) => onPointerDownPoint(e, id)}
                    className="cursor-move"
                    style={{ touchAction: 'none' }}
                  >
                    <line
                      x1={sx(x)}
                      y1={sy(y)}
                      x2={sx(x) + fx}
                      y2={sy(y) + fy}
                      stroke={sectionDot(m.section)}
                      strokeWidth={0.35}
                    />
                    <circle
                      data-titik="1"
                      cx={sx(x)}
                      cy={sy(y)}
                      r={uk(isSel ? 1.5 : 1.15)}
                      fill={sectionDot(m.section)}
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
              className="h-1.5 min-w-[120px] flex-1 accent-emerald-500"
            />

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
          </div>
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

              {/* DD2 — cara pemain berpindah ke set berikutnya */}
              {set && nextSet && (
                <div className="mt-3 border-t border-slate-800 pt-3">
                  <label className="mb-1.5 block text-[11px] font-medium text-slate-400">
                    Gerakan ke set berikutnya
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-[11px] text-slate-500">Bentuk jalur</label>
                      <Select
                        value={gerakSet.jalur}
                        onChange={(e) => simpanGerak({ jalur: e.target.value as 'lurus' | 'lengkung' })}
                      >
                        {(Object.keys(JALUR_LABEL) as ('lurus' | 'lengkung')[]).map((k) => (
                          <option key={k} value={k}>
                            {JALUR_LABEL[k]}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] text-slate-500">
                        Pembagian kecepatan
                      </label>
                      <Select
                        value={gerakSet.mudah}
                        onChange={(e) =>
                          simpanGerak({ mudah: e.target.value as GerakLengkap['mudah'] })
                        }
                      >
                        {(Object.keys(MUDAH_LABEL) as GerakLengkap['mudah'][]).map((k) => (
                          <option key={k} value={k}>
                            {MUDAH_LABEL[k]}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </div>

                  {gerakSet.jalur === 'lengkung' && (
                    <div className="mt-2">
                      <label className="mb-1 block text-[11px] text-slate-500">
                        Lengkungan: {Math.round(gerakSet.lengkung * 100)}%
                      </label>
                      <input
                        type="range"
                        min={-100}
                        max={100}
                        step={25}
                        value={Math.round(gerakSet.lengkung * 100)}
                        onChange={(e) => simpanGerak({ lengkung: Number(e.target.value) / 100 })}
                        className="w-full accent-sky-500"
                        aria-label="Lengkungan jalur"
                      />
                    </div>
                  )}

                  {/* DD4 — busur putaran: jarak antar pemain tetap terjaga */}
                  {gerakSet.jalur === 'busur' && (
                    <div className="mt-2 space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="w-24 shrink-0 text-[11px] text-slate-500">Sudut putar</span>
                        <Input
                          type="number"
                          step={15}
                          value={gerakSet.putar?.sudut ?? 0}
                          onChange={(e) => ubahPutar({ sudut: Number(e.target.value) })}
                        />
                        <span className="shrink-0 text-[11px] text-slate-500">derajat</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-24 shrink-0 text-[11px] text-slate-500">
                          Pusat putaran
                        </span>
                        <Input
                          type="number"
                          step={0.25}
                          value={pusatPutar.x}
                          onChange={(e) => ubahPutar({ x: Number(e.target.value) })}
                          aria-label="Pusat putaran, sumbu x (langkah)"
                        />
                        <Input
                          type="number"
                          step={0.25}
                          value={pusatPutar.y}
                          onChange={(e) => ubahPutar({ y: Number(e.target.value) })}
                          aria-label="Pusat putaran, sumbu y (langkah)"
                        />
                      </div>

                      {/* putar-jalan — lingkaran ikut berjalan */}
                      <label className="flex items-center gap-1.5 text-[11px] text-slate-400">
                        <input
                          type="checkbox"
                          className="accent-sky-500"
                          checked={pusatAkhirPutar !== null}
                          onChange={(e) =>
                            e.target.checked
                              ? ubahPutar({ x2: pusatPutar.x, y2: pusatPutar.y })
                              : hapusPusatAkhir()
                          }
                          data-testid="putar-jalan-aktif"
                        />
                        Lingkaran ikut berjalan (pusatnya berpindah)
                      </label>

                      {pusatAkhirPutar && (
                        <div className="flex items-center gap-1.5">
                          <span className="w-24 shrink-0 text-[11px] text-slate-500">
                            Berpindah ke
                          </span>
                          <Input
                            type="number"
                            step={0.25}
                            value={pusatAkhirPutar.x}
                            onChange={(e) => ubahPutar({ x2: Number(e.target.value) })}
                            aria-label="Pusat putaran berpindah ke, sumbu x (langkah)"
                            data-testid="putar-jalan-x2"
                          />
                          <Input
                            type="number"
                            step={0.25}
                            value={pusatAkhirPutar.y}
                            onChange={(e) => ubahPutar({ y2: Number(e.target.value) })}
                            aria-label="Pusat putaran berpindah ke, sumbu y (langkah)"
                            data-testid="putar-jalan-y2"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            className="shrink-0 px-2 py-1 text-[11px]"
                            onClick={hitungPusatAkhir}
                            data-testid="putar-jalan-hitung"
                          >
                            Hitung
                          </Button>
                        </div>
                      )}

                      <p className="text-[10px] leading-snug text-slate-500" data-testid="putar-jalan-keterangan">
                        {busurKeluar.size} dari {Object.keys(set.points).length} pemain mengikuti
                        busur ini — sisanya tetap jalur lurus/melengkung karena perpindahannya tidak
                        cocok dengan putaran ini. Pusat diukur dalam langkah dari titik tengah
                        lapangan.
                        {pusatAkhirPutar && (
                          <>
                            {' '}
                            Lingkaran berputar sambil pusatnya bergeser dari {pusatPutar.x},{' '}
                            {pusatPutar.y} ke {pusatAkhirPutar.x}, {pusatAkhirPutar.y} — jadi
                            bentuk formasi tetap utuh sementara seluruh blok terbawa maju.
                            Pemain di sisi luar menempuh jarak lebih jauh dalam hitungan yang
                            sama, dan itu wajar: begitulah kenyataannya di lapangan.
                          </>
                        )}
                      </p>
                    </div>
                  )}

                  <div className="mt-2">
                    <label className="mb-1 block text-[11px] text-slate-500">
                      Tunda mulai per section (count)
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {seksiUnik.map((sc) => (
                        <div key={sc} className="flex items-center gap-1.5">
                          <span className="w-14 shrink-0 truncate text-[11px] text-slate-400">
                            {sectionLabel(sc)}
                          </span>
                          <Input
                            type="number"
                            min={0}
                            value={gerakSet.tunda[sc] ?? 0}
                            onChange={(e) =>
                              simpanGerak({
                                tunda: {
                                  ...gerakSet.tunda,
                                  [sc]: Math.max(0, Number(e.target.value)),
                                },
                              })
                            }
                          />
                        </div>
                      ))}
                    </div>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
                      Section yang ditunda diam beberapa count lebih dulu, lalu <b>mengejar</b>{' '}
                      supaya tetap tiba bersamaan di akhir.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      {/* ------------------------------- Panel -------------------------------- */}
      <div className="space-y-4">
        <Card>
          <h2 className="mb-2 text-sm font-semibold text-slate-200">Alat</h2>
          <div className="grid grid-cols-2 gap-1.5">
            <Button size="sm" variant={tool === 'select' ? 'primary' : 'soft'} onClick={() => setTool('select')}>
              Pilih & geser
            </Button>
            <Button size="sm" variant={tool === 'place' ? 'primary' : 'soft'} onClick={() => setTool('place')}>
              Letakkan titik
            </Button>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
            {tool === 'place'
              ? 'Pilih satu anggota di daftar bawah, lalu sentuh lapangan untuk menempatkan titiknya.'
              : 'Geser titik langsung. Seret kotak di area kosong atau Shift + klik untuk memilih banyak titik.'}
          </p>
          <div className="mt-3 space-y-1.5">
            <Toggle checked={view.snap} onChange={(v) => ubah('snap', v)} label={`Snap ke grid (${Math.round((1 / sYd) * 10) / 10} langkah/yard)`} />
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
          <div className="mt-3">
            <label className="mb-1 block text-[11px] text-slate-500">Bentuk cepat</label>
            <div className="grid grid-cols-2 gap-1.5">
              {(['blok', 'busur', 'lingkaran', 'garis'] as const).map((k) => (
                <Button key={k} size="sm" onClick={() => applyShape(k)}>
                  {k[0].toUpperCase() + k.slice(1)}
                </Button>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-slate-500">
              Berlaku untuk titik terpilih, atau semua titik jika tidak ada yang dipilih.
            </p>
          </div>

          <div className="mt-3 border-t border-slate-800 pt-3">
            <div className="mb-1.5 flex items-center justify-between">
              <label className="block text-[11px] text-slate-500">Susun pilihan</label>
              <button
                type="button"
                className="text-[11px] text-sky-400 hover:underline"
                onClick={() => setSelected(Object.keys(set?.points ?? {}).filter((id) => visibleIds.has(id)))}
              >
                Pilih semua
              </button>
            </div>
            {!selected.length ? (
              <p className="text-[11px] leading-relaxed text-slate-500">
                Pilih titik dulu: klik, <b>Shift + klik</b> untuk menambah, atau{' '}
                <b>seret kotak</b> di area kosong lapangan.
              </p>
            ) : (
              <>
                <p data-selcount className="mb-1.5 text-[11px] font-medium text-emerald-300">
                  {selected.length} titik dipilih
                </p>
                <div className="space-y-1.5">
                  <div>
                    <p className="mb-1 text-[10px] text-slate-500">Sejajarkan</p>
                    <div className="grid grid-cols-3 gap-1">
                      <Button size="sm" className="px-1 text-[11px]" title="Rapatkan ke sisi kiri" onClick={() => alignSelection('kiri')}>
                        Kiri
                      </Button>
                      <Button size="sm" className="px-1 text-[11px]" title="Rapatkan ke tengah mendatar" onClick={() => alignSelection('tengahX')}>
                        ↔
                      </Button>
                      <Button size="sm" className="px-1 text-[11px]" title="Rapatkan ke sisi kanan" onClick={() => alignSelection('kanan')}>
                        Kanan
                      </Button>
                      <Button size="sm" className="px-1 text-[11px]" title="Rapatkan ke sisi atas" onClick={() => alignSelection('atas')}>
                        Atas
                      </Button>
                      <Button size="sm" className="px-1 text-[11px]" title="Rapatkan ke tengah vertikal" onClick={() => alignSelection('tengahY')}>
                        ↕
                      </Button>
                      <Button size="sm" className="px-1 text-[11px]" title="Rapatkan ke sisi bawah" onClick={() => alignSelection('bawah')}>
                        Bawah
                      </Button>
                    </div>
                  </div>
                  <div>
                    <p className="mb-1 text-[10px] text-slate-500">Ratakan jarak</p>
                    <div className="grid grid-cols-2 gap-1">
                      <Button size="sm" className="px-1 text-[11px]" title="Jarak mendatar sama rata" onClick={() => distributeSelection('x')}>
                        ↔ Rata
                      </Button>
                      <Button size="sm" className="px-1 text-[11px]" title="Jarak vertikal sama rata" onClick={() => distributeSelection('y')}>
                        ↕ Rata
                      </Button>
                    </div>
                  </div>
                  <div>
                    <p className="mb-1 text-[10px] text-slate-500">Putar (arah hadap ikut)</p>
                    <div className="grid grid-cols-4 gap-1">
                      <Button size="sm" className="px-1 text-[11px]" title="Putar 15° berlawanan jarum jam" onClick={() => rotateSelection(-15)}>
                        ↺15
                      </Button>
                      <Button size="sm" className="px-1 text-[11px]" title="Putar 15° searah jarum jam" onClick={() => rotateSelection(15)}>
                        ↻15
                      </Button>
                      <Button size="sm" className="px-1 text-[11px]" title="Putar 90° berlawanan jarum jam" onClick={() => rotateSelection(-90)}>
                        ↺90
                      </Button>
                      <Button size="sm" className="px-1 text-[11px]" title="Putar 90° searah jarum jam" onClick={() => rotateSelection(90)}>
                        ↻90
                      </Button>
                    </div>
                  </div>
                  <div>
                    <p className="mb-1 text-[10px] text-slate-500">Cermin (di tempat)</p>
                    <div className="grid grid-cols-2 gap-1">
                      <Button size="sm" className="px-1 text-[11px]" title="Cermin kiri–kanan di tempat" onClick={() => mirrorSelection('x')}>
                        ↔ Cermin
                      </Button>
                      <Button size="sm" className="px-1 text-[11px]" title="Cermin depan–belakang di tempat" onClick={() => mirrorSelection('y')}>
                        ↕ Cermin
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </Card>

        {/* --------------------- DD4 — Alat gerak massa ---------------------- */}
        <Card>
          <h2 className="mb-2 text-sm font-semibold text-slate-200">Alat gerak massa</h2>
          <p className="mb-2 text-[11px] leading-relaxed text-slate-500">
            {selected.length
              ? `${selected.length} titik dipilih — perubahan hanya berlaku pada titik itu.`
              : 'Tidak ada titik dipilih — perubahan berlaku untuk SEMUA pemain di set ini.'}
          </p>

          <div className="space-y-2.5">
            {/* Putar */}
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-400">Putar blok</label>
              <div className="grid grid-cols-3 gap-1.5">
                <Select
                  value={String(sudutPutar)}
                  onChange={(e) => setSudutPutar(Number(e.target.value))}
                  className="py-1 text-xs"
                >
                  {[15, 30, 45, 90].map((d) => (
                    <option key={d} value={d}>
                      {d}°
                    </option>
                  ))}
                </Select>
                <Button size="sm" disabled={!bisaPutarSkala} onClick={() => putarBlok(-sudutPutar)}>
                  ↺ Kiri
                </Button>
                <Button size="sm" disabled={!bisaPutarSkala} onClick={() => putarBlok(sudutPutar)}>
                  Kanan ↻
                </Button>
              </div>
              <label className="mt-1.5 flex items-start gap-1.5 text-[10px] leading-snug text-slate-400">
                <input
                  type="checkbox"
                  checked={ikutBusur}
                  onChange={(e) => setIkutBusur(e.target.checked)}
                  className="mt-0.5 accent-sky-500"
                />
                <span>
                  Ikuti busur — pemain mengitari titik tengahnya, bukan memotong lewat
                  tali busur (tanpa ini formasi mengkerut di tengah jalan)
                </span>
              </label>
              <p className="mt-1 text-[10px] leading-snug text-slate-500">
                {bisaPutarSkala
                  ? 'Mengitari titik tengah blok. Putaran 90° ikut memutar arah hadap.'
                  : 'Perlu minimal 2 titik — kosongkan pilihan supaya berlaku untuk seluruh formasi.'}
              </p>
            </div>

            {/* Kembang-kempis */}
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-400">
                Kembang-kempis
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                <Select
                  value={String(persenSkala)}
                  onChange={(e) => setPersenSkala(Number(e.target.value))}
                  className="py-1 text-xs"
                >
                  {[5, 10, 25].map((d) => (
                    <option key={d} value={d}>
                      {d}%
                    </option>
                  ))}
                </Select>
                <Button
                  size="sm"
                  disabled={!bisaPutarSkala}
                  onClick={() => ubahUkuran(1 - persenSkala / 100)}
                >
                  Kecilkan
                </Button>
                <Button
                  size="sm"
                  disabled={!bisaPutarSkala}
                  onClick={() => ubahUkuran(1 + persenSkala / 100)}
                >
                  Besarkan
                </Button>
              </div>
              <p className="mt-1 text-[10px] leading-snug text-slate-500">
                {bisaPutarSkala
                  ? 'Mengembang atau mengempis dari titik tengah blok.'
                  : 'Perlu minimal 2 titik — kosongkan pilihan supaya berlaku untuk seluruh formasi.'}
              </p>
            </div>

            {/* Cermin */}
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-400">Cermin</label>
              <div className="grid grid-cols-2 gap-1.5">
                <Button size="sm" onClick={() => cerminBlok('x')}>
                  Kiri ⇄ Kanan
                </Button>
                <Button size="sm" onClick={() => cerminBlok('y')}>
                  Depan ⇄ Belakang
                </Button>
              </div>
              <p className="mt-1 text-[10px] leading-snug text-slate-500">
                Dicerminkan terhadap garis tengah lapangan; arah hadap ikut tercermin.
              </p>
            </div>

            {/* Geser */}
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-400">Geser blok</label>
              <div className="mb-1.5 flex items-center gap-1.5">
                <Select
                  value={String(jarakGeser)}
                  onChange={(e) => setJarakGeser(Number(e.target.value))}
                  className="w-20 py-1 text-xs"
                >
                  {[1, 2, 4, 8].map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </Select>
                <span className="text-[11px] text-slate-500">langkah sekali tekan</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <Button size="sm" onClick={() => geserBlok('y', -1)}>
                  Ke depan
                </Button>
                <Button size="sm" onClick={() => geserBlok('y', 1)}>
                  Ke belakang
                </Button>
                <Button size="sm" onClick={() => geserBlok('x', 1)}>
                  Ke Side 1
                </Button>
                <Button size="sm" onClick={() => geserBlok('x', -1)}>
                  Ke Side 2
                </Button>
              </div>
            </div>
          </div>
        </Card>

        <PenandaPanel
          markers={markers}
          sYd={sYd}
          edit={editPenanda}
          setEdit={setEditPenanda}
          petik={petik}
          setPetik={setPetik}
          onSimpan={simpanPenanda}
        />

        {/* --------------------- DD3 — Analitik gerakan ---------------------- */}
        {set && nextSet && (
          <Card>
            <h2 className="mb-2 text-sm font-semibold text-slate-200">Analitik gerakan</h2>
            <Toggle
              checked={view.analitik}
              onChange={(v) => ubah('analitik', v)}
              label="Warnai jejak menurut kesulitan"
            />

            {analisis.daftar.length === 0 ? (
              <p className="mt-2 text-[11px] text-slate-500">
                Belum ada perpindahan yang bisa dihitung pada set ini.
              </p>
            ) : (
              <div className="mt-2 space-y-2">
                <div className="grid grid-cols-3 gap-1.5 text-center">
                  <div className="rounded bg-slate-800/60 p-1.5">
                    <div className="text-[15px] font-semibold text-slate-100">
                      {Math.round(analisis.rata)}
                    </div>
                    <div className="text-[10px] leading-tight text-slate-500">
                      rata² langkah/menit
                    </div>
                  </div>
                  <div
                    className="rounded bg-slate-800/60 p-1.5"
                    data-testid="analitik-langkah-terjauh"
                  >
                    <div className="text-[15px] font-semibold text-slate-100">
                      {Math.round(analisis.terjauh?.jarakLangkah ?? 0)}
                    </div>
                    <div className="text-[10px] leading-tight text-slate-500">langkah terjauh</div>
                  </div>
                  <div
                    className="rounded bg-slate-800/60 p-1.5"
                    data-testid="analitik-paling-cepat"
                  >
                    <div
                      className="text-[15px] font-semibold"
                      style={{ color: TINGKAT_WARNA[analisis.tercepat?.tingkat ?? 'nyaman'] }}
                    >
                      {Math.round(analisis.tercepat?.langkahPerMenit ?? 0)}
                    </div>
                    <div className="text-[10px] leading-tight text-slate-500">paling cepat</div>
                  </div>
                </div>

                <div>
                  {analisis.seksi.map((sc) => (
                    <div key={sc.seksi} className="mb-1">
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span className="truncate">{sc.label}</span>
                        <span className="shrink-0">
                          {Math.round(sc.rata)} lk/mnt · terberat {Math.round(sc.terberat)}
                        </span>
                      </div>
                      <div className="mt-0.5 h-1.5 overflow-hidden rounded bg-slate-800">
                        <div
                          className="h-full rounded"
                          style={{
                            width: `${Math.min(100, (sc.rata / Math.max(1, ambang.perMenit.mustahil)) * 100)}%`,
                            // Warna memakai tingkat gabungan: section yang
                            // pelan tapi langkahnya raksasa tetap merah.
                            background: TINGKAT_WARNA[sc.tingkatAkhir],
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Ukuran langkah — dulu tidak pernah tampil di analitik,
                    padahal buku saku mencetaknya. Inilah sumber kejutannya. */}
                <div
                  className="flex items-center justify-between rounded bg-slate-800/60 px-2 py-1.5 text-[11px]"
                  data-testid="analitik-ukuran-langkah"
                >
                  <span className="text-slate-400">Langkah terbesar</span>
                  <span
                    className="font-semibold"
                    style={{
                      color: TINGKAT_WARNA[
                        tingkatLangkahDari(analisis.langkahTerbesarInci, ambang.inci)
                      ],
                    }}
                  >
                    {Math.round(analisis.langkahTerbesarInci * 10) / 10}&Prime; ·{' '}
                    {TINGKAT_LABEL[tingkatLangkahDari(analisis.langkahTerbesarInci, ambang.inci)]}
                  </span>
                </div>

                {terberat && (
                  <p className="text-[11px] text-slate-400">
                    Set terberat di drill ini: <b className="text-slate-200">{terberat.nama}</b> (set{' '}
                    {terberat.urutan}) — rata² {Math.round(terberat.rata)} langkah/menit.
                  </p>
                )}

                {analisis.peringatan.length > 0 ? (
                  <div className="rounded border border-amber-600/40 bg-amber-950/30 p-2">
                    <p className="mb-1 text-[11px] font-medium text-amber-300">
                      {analisis.peringatan.length} gerakan berat / mustahil
                    </p>
                    <ul className="space-y-0.5" data-testid="analitik-peringatan">
                      {analisis.peringatan.slice(0, 8).map((d) => (
                        <li key={d.id} className="flex items-center justify-between gap-2 text-[11px]">
                          <span className="truncate text-slate-300">
                            {rosterById.get(d.id) ? <NamaTampil anggota={rosterById.get(d.id)!} /> : d.nama}
                          </span>
                          <span className="shrink-0" style={{ color: TINGKAT_WARNA[d.tingkatAkhir] }}>
                            {/* Sebut yang bermasalah: kecepatan, ukuran
                                langkah, atau keduanya. Tanpa ini pembaca tidak
                                tahu apa yang mesti diperbaiki. */}
                            {d.tingkatAkhir === d.tingkatLangkah && d.tingkatAkhir === d.tingkat
                              ? `${Math.round(d.langkahPerMenit)} lk/mnt · ${Math.round(d.ukuranLangkahInci)}\u2033`
                              : d.tingkatAkhir === d.tingkatLangkah
                                ? `${Math.round(d.ukuranLangkahInci)}\u2033 langkah`
                                : `${Math.round(d.langkahPerMenit)} lk/mnt`}
                          </span>
                        </li>
                      ))}
                    </ul>
                    {analisis.peringatan.length > 8 && (
                      <p className="mt-1 text-[10px] text-slate-500">
                        …dan {analisis.peringatan.length - 8} pemain lainnya
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-[11px] text-emerald-400">
                    Semua gerakan masih nyaman atau sekadar agak padat.
                  </p>
                )}

                <p className="text-[11px] leading-relaxed text-slate-500">
                  Ambang: nyaman ≤ {AMBANG.padat} · padat ≤ {AMBANG.berat} · berat ≤ {AMBANG.mustahil} ·
                  mustahil &gt; {AMBANG.mustahil} langkah/menit. Dihitung dari tempo {drill.tempo} BPM
                  dan {drill.beatsPerCount} ketuk/hitungan.
                </p>
              </div>
            )}
          </Card>
        )}

        <Card>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-200">Anggota</h2>
            <Select
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
              className="w-32 py-1 text-xs"
            >
              <option value="all">Semua</option>
              {visibleSections().map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </Select>
          </div>

          {unplaced.length > 0 && (
            <div className="mb-3">
              <p className="mb-1.5 text-[11px] font-medium text-amber-400">Belum masuk set ini ({unplaced.length})</p>
              <div className="flex flex-wrap gap-1">
                {unplaced
                  .filter((m) => (sectionFilter === 'all' ? true : m.section === sectionFilter))
                  .map((m) => (
                    <button
                      key={m.id}
                      onClick={() => {
                        updatePoint(m.id, snapVal(0, 0))
                        setSelected([m.id])
                      }}
                      className="rounded-md border border-slate-700 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-800"
                      title="Tempatkan di tengah lapangan"
                    >
                      + {m.code}
                    </button>
                  ))}
              </div>
            </div>
          )}

          <div className="scroll-thin max-h-72 space-y-0.5 overflow-y-auto">
            {visible.map((m) => {
              const has = !!set?.points[m.id]
              const sel = selected.includes(m.id)
              return (
                <button
                  key={m.id}
                  onClick={() => setSelected(sel ? (selected.includes(m.id) ? [m.id] : []) : [m.id])}
                  className={cx(
                    'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition',
                    sel ? 'bg-emerald-600/15 ring-1 ring-emerald-600/30' : 'hover:bg-slate-800/60',
                  )}
                >
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: sectionDot(m.section) }} />
                  <NamaTampil anggota={m} className={cx('truncate', has ? 'text-slate-200' : 'text-slate-500')} />
                  <span className="ml-auto shrink-0 text-[10px] text-slate-500">{m.code}</span>
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
          labelLatihan={adaLatihanDrill ? labelLatihan(latihanDrill) : null}
          onTempoAsli={adaLatihanDrill ? () => drill.songId && tl.keAsli([drill.songId]) : undefined}
          roster={roster}
          startIdx={idx}
          song={lagu ?? null}
          detikPerSet={petaSet ? petaSet.map((p) => p.detik) : undefined}
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

      <ShortcutHelp open={bantuan} onClose={() => setBantuan(false)} />

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
