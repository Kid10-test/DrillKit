import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type {
  BiramaPola,
  Drill,
  HitungMundur,
  SetList,
  LatihTempo,
  PolaRitme,
  Song,
  SuaraKlik,
  TandaBirama,
  TempoSegment,
  UlangBagian,
  TingkatKlik,
} from '../db/types'
import {
  Metronom,
  jepitTempo,
  jejakLuncuran,
  polaBaku,
  putarSel,
  rapikanBirama,
  ringkasLuncuran,
} from '../lib/metronome'
import { createTempoTimeline } from '../lib/tempoTimeline'
import type { InfoKetuk, JamLagu } from '../lib/metronome'
import {
  bikinPolaDariBirama,
  biramaDefault,
  dariBeatsLama,
  formatWaktu,
  hitungMundurDefault,
  labelBirama,
  meterPada,
  normalisasiBirama,
} from '../lib/birama'
import type { SegmenWaktu } from '../lib/birama'
// #5 sisa — panjang segmen lagu dalam hitungan drill.
import { fmtAngka, fmtBirama, panjangSegmenLagu } from '../lib/segmenDrill'
import type { PanjangSegmen } from '../lib/segmenDrill'
import { hitungSetList, setListBaru } from '../lib/setlist'
import { ModalRekamanLagu } from '../components/ModalRekamanLagu'
import { PemutarRekaman, waktuBiramaKeDetikAudio } from '../lib/rekaman'
import { lajuRekaman } from '../lib/tempoLatihan'
import type { PartiturMeta, RekamanAudioMeta } from '../db/types'
import { jumlahBirama, rentangValid } from '../lib/ulang'
import { KartuSetList } from '../components/KartuSetList'
import { KendaliTempoLatihan, LencanaLatihan } from '../components/KendaliTempoLatihan'
import { useTempoLatihan } from '../hooks/useTempoLatihan'
import { PanelTukarRepertoar } from '../components/TukarRepertoar'
import { PanelPartitur } from '../components/PanelPartitur'
import { LayarPartitur } from '../components/LayarPartitur'
import { IndikatorKetuk, PanelSedangDiputar, StripSegmen } from '../components/PanelLagu'
import { diam as hentikanUcapan, ucap as ucapkan } from '../lib/ucap'
import PilihBirama, { PilihBiramaSegmen, RingkasBirama } from '../components/PilihBirama'
import AturHitungMundur from '../components/AturHitungMundur'
import {
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
  Toggle,
  useToast,
} from '../components/ui'
import { IconLoop, IconMusic, IconPause, IconPlay, IconPlus } from '../components/Icons'
import TunerDrone from '../components/TunerDrone'
import { cx, uid } from '../lib/utils'

/**
 * #5 sisa — ketuk per hitungan untuk menampilkan panjang segmen dalam
 * **hitungan drill**.
 *
 * Editor lagu tidak tahu drill mana yang akan memakainya, jadi nilainya
 * diambil dari drill yang sudah menautkan lagu ini. Kalau belum ada (atau
 * nilainya berbeda-beda), dipakai asumsi lazim **2 ketuk per hitungan** —
 * satu hitungan = setengah birama 4/4 — dan sumbernya ditulis apa adanya di
 * keterangan supaya tidak dikira angka pasti.
 */
function asumsiHitungan(drills: Drill[], songId: string): { nilai: number; sumber: string } {
  const dipakai = drills.filter((d) => d.songId === songId)
  const nilai = Array.from(new Set(dipakai.map((d) => d.beatsPerCount))).filter(
    (n) => Number.isFinite(n) && n > 0,
  )
  if (nilai.length === 1) return { nilai: nilai[0], sumber: 'dari drill yang memakai lagu ini' }
  if (nilai.length > 1) {
    const hitung = new Map<number, number>()
    dipakai.forEach((d) => hitung.set(d.beatsPerCount, (hitung.get(d.beatsPerCount) ?? 0) + 1))
    const terbanyak = [...hitung.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0]
    return {
      nilai: terbanyak,
      sumber: `dari drill yang memakai lagu ini (${nilai.length} nilai berbeda — dipakai yang terbanyak)`,
    }
  }
  return { nilai: 2, sumber: 'asumsi 2 ketuk per hitungan; belum ada drill yang memakai lagu ini' }
}

/** Peta id segmen → panjangnya; urutannya sama dengan urutan musikal. */
function petaPanjang(segs: TempoSegment[], panjang: PanjangSegmen[]): Map<string, PanjangSegmen> {
  const urut = [...segs].sort(
    (a, b) =>
      a.measure - b.measure ||
      (a.beat ?? 1) - (b.beat ?? 1) ||
      (a.subdivision ?? 1) - (b.subdivision ?? 1),
  )
  const peta = new Map<string, PanjangSegmen>()
  urut.forEach((seg, i) => {
    const p = panjang[i]
    if (p && Math.abs(p.measure - seg.measure) < 1e-9) peta.set(seg.id, p)
  })
  return peta
}

/* ---------------------------------------------------------------------------
 * E3 — Mesin metronom sudah dipindah ke `src/lib/metronome.ts` supaya bisa
 * dipakai bersama oleh halaman Musik, editor drill, dan presenter (B5).
 * --------------------------------------------------------------------------- */

/* -------------------------------- Halaman ---------------------------------- */

/**
 * N4 — halaman Musik & Metronom dipakai dua macam orang.
 *
 * `hanyaPutar` dipakai mode anggota: metronom, lagu, dan set list tetap
 * bisa dipakai sepenuhnya — tetapi yang menulis ke basis data
 * (tambah/ubah/hapus lagu, sunting pola ritme, mengurutkan set list,
 * tukar repertoar) disembunyikan. Alasannya bukan soal keamanan, melainkan
 * soal kepemilikan: repertoar itu milik pelatih. Kalau 18 anggota bisa
 * mengubahnya, setiap kali mereka menekan Perbarui perubahannya lenyap
 * begitu saja, dan mereka tidak akan mengerti mengapa.
 */
export default function Music({ hanyaPutar = false }: { hanyaPutar?: boolean } = {}) {
  const toast = useToast()
  const songs = useLiveQuery(() => db.songs.orderBy('title').toArray(), [], [])
  const [bpm, setBpm] = useState(120)
  const [beats, setBeats] = useState(4)
  const [subdiv, setSubdiv] = useState(1)
  /* --------------------------- M1 — tanda birama --------------------------- */
  /** Tanda birama yang sedang dipakai (7/8, 5/4, …) + acuan temponya. */
  const [birama, setBirama] = useState<TandaBirama>(biramaDefault())
  /** Hitung mundur sebelum lagu mulai. */
  const [hitungMundur, setHitungMundur] = useState<HitungMundur>(hitungMundurDefault())
  /** Mulai dari birama absolut ke-berapa (1-based). */
  const [mulaiDari, setMulaiDari] = useState(1)
  const [running, setRunning] = useState(false)
  const [measure, setMeasure] = useState(1)
  /**
   * M5 — lagu sudah habis (metronom berhenti sendiri di birama terakhir).
   * Dipakai supaya batang progres genap 100%: tanpa ini ia berhenti di
   * posisi **awal** birama terakhir (mis. 75% dari 4 birama) karena progres
   * memang dihitung dari awal birama yang sedang berjalan.
   */
  const [habis, setHabis] = useState(false)
  /* --------------------------- M3 — set list ---------------------------- */
  /** Set list yang sedang dibuka. Kosong = belum memilih. */
  const [setlistId, setSetlistId] = useState('')
  /** Indeks dalam set list yang sedang diputar; `null` = tidak memutar set list. */
  const [indeksMain, setIndeksMain] = useState<number | null>(null)
  /**
   * Penanda "memutar set list" dibaca dari dalam `onSelesai`, yang dibuat
   * sekali saat pemutaran dimulai — karena itu harus berupa ref, bukan state.
   */
  const mainkanSetRef = useRef(false)
  /**
   * #6 — penanda upaya pemutaran yang sedang berjalan.
   *
   * Memulai pemutaran dengan rekaman itu asinkron (baca berkas → geser →
   * tunggu benar-benar berbunyi). Tanpa penanda ini, menekan Mulai lalu
   * Berhenti dengan cepat akan tetap menyalakan metronom sesudahnya — mesin
   * yang berbunyi setelah pemakainya membatalkannya.
   */
  const mulaiTokenRef = useRef(0)
  const daftarSetList = useLiveQuery(() => db.setlists.orderBy('updatedAt').reverse().toArray(), [], [])
  const setlistAktif: SetList | null = daftarSetList?.find((x) => x.id === setlistId) ?? null
  const hitunganSet = useMemo(() => hitungSetList(setlistAktif, songs ?? []), [setlistAktif, songs])
  const [selected, setSelected] = useState<string>('')
  const [partiturTerbuka, setPartiturTerbuka] = useState(false)
  const [useMap, setUseMap] = useState(false)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Song | null>(null)
  const engineRef = useRef<Metronom>(new Metronom())
  const taps = useRef<number[]>([])

  /* ---------------------------- E3 — keadaan ------------------------------- */
  /** Pola ritme yang sedang disunting (null = metronom detak rata). */
  const [pola, setPola] = useState<PolaRitme | null>(null)
  /** Apakah pola dipakai saat metronom berjalan. */
  const [pakaiPola, setPakaiPola] = useState(false)
  /** Latih tempo: tempo bergerak bertahap. */
  const [latih, setLatih] = useState<LatihTempo>({ on: false, dari: 100, ke: 140, langkah: 2, tiap: 4 })
  /** Jenis bunyi, getar, dan volume. */
  const [suara, setSuara] = useState<SuaraKlik>('klik')
  const [getar, setGetar] = useState(false)
  const [volume, setVolume] = useState(0.8)
  /** Kotak yang sedang berbunyi — untuk menyorot editor pola. */
  const [aktif, setAktif] = useState<InfoKetuk | null>(null)
  /**
   * Penanda "belum disimpan". Dipakai supaya **memilih lagu lain tidak
   * membuang pola yang baru saja kamu sunting** — pola lagu hanya dimuat
   * kalau tidak ada suntingan yang belum tersimpan.
   */
  const [kotor, setKotor] = useState(false)

  const song = songs?.find((s) => s.id === selected)
  useEffect(() => {
    if (!song?.partitur) setPartiturTerbuka(false)
  }, [song?.id, song?.partitur])
  /* #5 sisa — panjang tiap segmen lagu terpilih dalam hitungan drill. */
  const semuaDrill = useLiveQuery(() => db.drills.toArray(), [], [])
  const asumsiSegmen = useMemo(() => asumsiHitungan(semuaDrill ?? [], song?.id ?? ''), [semuaDrill, song?.id])
  const panjangSegmenLaguIni = useMemo(
    () =>
      song
        ? panjangSegmenLagu(
            {
              bpm: song.bpm,
              tandaBirama: song.tandaBirama ?? dariBeatsLama(song.beats),
              tempoMap: song.tempoMap,
              latih: song.latih ?? null,
            },
            asumsiSegmen.nilai,
            { akhirBirama: song.panjangBirama ?? null },
          )
        : [],
    [song, asumsiSegmen.nilai],
  )
  const panjangSegmenById = useMemo(
    () => (song ? petaPanjang(song.tempoMap, panjangSegmenLaguIni) : new Map<string, PanjangSegmen>()),
    [song, panjangSegmenLaguIni],
  )
  const segs = useMemo(() => song?.tempoMap ?? [], [song])
  /* ------------------------ #4 — tempo latihan -------------------------- */
  const tl = useTempoLatihan()
  /** Tempo latihan lagu yang dipilih (per lagu, per perangkat). */
  const latihan = tl.tempoUntuk(song?.id)
  const naikOtomatis = tl.naikUntuk(song?.id)
  /** Putaran naik otomatis yang sedang berjalan; `null` kalau tidak berjalan. */
  const [putaran, setPutaran] = useState<number | null>(null)

  /* ----------------------- #6 — Rekaman Lagu MP3 ------------------------- */
  const [modalRekamanOpen, setModalRekamanOpen] = useState(false)
  const pemutarAudio = useRef<PemutarRekaman>(PemutarRekaman.get())

  /** Ubah tempo latihan saat berjalan → langsung terdengar di birama berikutnya. */
  useEffect(() => {
    if (engineRef.current.jalan) engineRef.current.setLatihan(latihan)
    /*
     * #6 — laju rekaman memakai aturan tempo yang SAMA dengan kliknya
     * (`lajuRekaman`), jadi kedua mode tempo latihan ikut terlayani. Dulu di
     * sini ada `latihan.persen / 100`: pada mode BPM angka itu selalu 100,
     * sehingga klik melambat 20 BPM sementara rekaman berjalan di tempo asli
     * — selisihnya 2,7 detik dalam 25 detik.
     */
    if (song?.rekaman) {
      pemutarAudio.current.setKecepatan(lajuRekaman(song.bpm, latihan))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latihan.mode, latihan.persen, latihan.geser])

  /* ------------------------- M1 — mode lagu ------------------------------ */
  /** Segmen tempo ringkas untuk menghitung sukat & tempo yang berlaku. */
  const segmenWaktu = useMemo<SegmenWaktu[]>(() => segs, [segs])
  /** Segmen lengkap (id & label) untuk strip, sudah urut berdasarkan birama. */
  const segmenLengkap = useMemo(
    () =>
      [...segs]
        .sort((a, b) => a.measure - b.measure)
        .map((t) => ({ id: t.id, label: t.label, measure: t.measure, bpm: t.bpm, birama: t.birama })),
    [segs],
  )
  /** Sukat yang berlaku pada birama yang sedang berjalan. */
  const meterBerjalan = useMemo(
    () => meterPada(segmenWaktu, measure, birama),
    [segmenWaktu, measure, birama],
  )
  const tempoTimeline = useMemo(
    () => createTempoTimeline({
      bpm,
      meter: birama,
      segments: useMap ? segs : [],
      latih,
    }),
    [bpm, birama, segs, useMap, latih],
  )
  /**
   * Single evaluator for the audible tempo at every beat/subdivision. The
   * timeline also supplies the seconds used by audio offsets and progress.
   */
  const tempoUntuk = useMemo(
    () => (bir: number) =>
      jepitTempo(tempoTimeline.tempoAtPosition({ measure: bir, beat: 1 }, latihan)),
    [tempoTimeline, latihan],
  )
  /** #4 — tempo asli (tanpa tempo latihan) pada birama yang sedang berjalan. */
  const tempoAsliSekarang = jepitTempo(
    aktif && aktif.tahap !== 'hitung'
      ? (aktif.bpmAsli ?? aktif.bpm)
      : tempoTimeline.tempoAtPosition({ measure, beat: 1 }),
  )

  /**
   * #6 — jam rekaman untuk mesin metronom: posisi, laju, dan apakah benar-benar
   * berbunyi. Dibaca langsung dari pemutar pada tiap tick penjadwalan — jadi
   * klik selalu mengikuti rekaman, termasuk sesudah digeser atau diulang.
   */
  const jamLagu = (meta: RekamanAudioMeta): JamLagu => {
    const titik = meta.titikMulaiDetik || 0
    return {
      posisi: () => Math.max(0, pemutarAudio.current.currentTime - titik),
      laju: () => pemutarAudio.current.laju,
      jalan: () => pemutarAudio.current.berbunyi,
    }
  }
  /* --------------------- M5 — panjang lagu & ulang ---------------------- */
  /** Birama terakhir lagu. 0 = lagu tanpa akhir (perilaku lama). */
  const panjangBirama = Math.max(0, Math.floor(song?.panjangBirama ?? 0))
  const adaPanjang = panjangBirama > 0
  /** Durasi total lagu; `null` kalau lagu tidak punya panjang. */
  const durasiLagu = useMemo(
    () => panjangBirama > 0
      ? tempoTimeline.secondsAtPosition({ measure: panjangBirama + 1, beat: 1 }, latihan)
      : null,
    [tempoTimeline, panjangBirama, latihan],
  )
  /** Detik yang tersisa mulai awal birama yang sedang berjalan. */
  const sisaDetik = useMemo(() => {
    if (durasiLagu === null) return null
    const sudah = tempoTimeline.secondsAtPosition({ measure: Math.min(measure, panjangBirama + 1), beat: 1 }, latihan)
    return Math.max(0, durasiLagu - sudah)
  }, [tempoTimeline, durasiLagu, measure, panjangBirama, latihan])
  /**
   * 0 di awal, 1 di akhir — dihitung dari waktu, bukan jumlah birama.
   * `habis` memaksanya genap 100% setelah lagu selesai.
   */
  const progres = useMemo(
    () => durasiLagu === null || durasiLagu <= 0
      ? null
      : habis
        ? 1
        : Math.min(1, Math.max(0, tempoTimeline.secondsAtPosition({
            measure: Math.min(measure, panjangBirama + 1),
            beat: 1,
          }, latihan) / durasiLagu)),
    [habis, tempoTimeline, durasiLagu, measure, panjangBirama, latihan],
  )
  /** Ulang hanya berarti kalau lagu punya panjang. */
  const ulangAktif = adaPanjang && song?.ulang === 1

  /* --------------------- M2 — ulang bagian (satu rentang) --------------------- */
  const ub = song?.ulangBagian ?? null
  /** Rentangnya sah secara angka (belum peduli dinyalakan atau tidak). */
  const ubSah = rentangValid(ub, panjangBirama)
  /** Pengulangan bagian benar-benar hidup: ada rentangnya, sah, dan dinyalakan. */
  const ulangBagianAktif = !!ub && ub.aktif === 1 && ubSah
  /** Durasi satu putaran rentang. */
  const detikPutaran = useMemo(
    () => ub
      ? Math.max(0, tempoTimeline.secondsAtPosition({ measure: ub.sampai + 1, beat: 1 }, latihan) -
        tempoTimeline.secondsAtPosition({ measure: ub.dari, beat: 1 }, latihan))
      : 0,
    [ub, tempoTimeline, latihan],
  )
  /** Tulis rentang ke lagu. */
  const setUlangBagian = (patch: Partial<UlangBagian>) => {
    if (!song) return
    const lama: UlangBagian = song.ulangBagian ?? { dari: 1, sampai: 4, aktif: 0 }
    db.songs.update(song.id, { ulangBagian: { ...lama, ...patch } })
  }
  const setUlang = (v: boolean) => {
    if (!song) return
    db.songs.update(song.id, { ulang: v ? 1 : 0 })
  }

  const polaAktif = pakaiPola && !!pola && pola.bars.length > 0
  const indexBarTampil = polaAktif
    ? Math.min(Math.max(0, aktif?.bar ?? 0), (pola?.bars.length ?? 1) - 1)
    : 0
  const barTampil = useMemo(
    () =>
      polaAktif && pola
        ? rapikanBirama(pola.bars[indexBarTampil] ?? pola.bars[0])
        : bikinPolaDariBirama(meterBerjalan, subdiv, 'tampil'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [polaAktif, pola, indexBarTampil, meterBerjalan, subdiv],
  )
  const iKotakAktif =
    aktif && aktif.suara === 1 && aktif.tahap !== 'hitung' && aktif.bar === indexBarTampil
      ? aktif.beat * barTampil.subdiv + aktif.sub
      : -1

  useEffect(() => {
    if (song) {
      setBpm(song.bpm)
      setBeats(song.beats)
      /*
       * N8 — ikuti tempo map lagunya sejak lagu dipilih.
       *
       * Ini satu-satunya pengaturan metronom yang TIDAK ikut dimuat dari
       * lagu, padahal bpm, sukat, hitung mundur, pola, bunyi, dan volume
       * semuanya dimuat. Akibatnya tempo map sebuah lagu **tidak
       * berbunyi** sampai pemakai menemukan sendiri pilihan "Ikuti tempo
       * map" di bawah — termasuk untuk anggota yang menerima materi.
       *
       * Yang lebih gawat: pemutaran lewat SET LIST menyusun opsinya
       * sendiri (lihat `opsiDariLagu`) dengan `pakaiTempoMap: segmen.length
       * > 0`. Jadi **lagu yang sama** mengikuti tempo map-nya kalau
       * diputar dari set list, dan mengabaikannya kalau diputar dengan
       * tombol Mulai. Dua jawaban berbeda untuk pertanyaan yang sama.
       *
       * Menjadikannya bawaan tidak menutup apa pun: pilihannya tetap ada,
       * dan panel serta peringatannya tetap mengatakan keadaannya.
       */
      setUseMap((song.tempoMap ?? []).length > 0)
      setBirama(song.tandaBirama ? normalisasiBirama(song.tandaBirama) : dariBeatsLama(song.beats))
      setHitungMundur(song.hitungMundur ?? hitungMundurDefault())
      // E3 — muat pengaturan metronom milik lagu ini. Pola hanya diganti kalau
      // tidak ada suntingan yang belum disimpan (`kotor`), supaya pekerjaanmu
      // tidak hilang hanya karena ganti pilihan lagu.
      if (!kotor) {
        setPola(song.pola ?? null)
        setPakaiPola(!!song.pola && song.pola.bars.length > 0)
        setLatih(song.latih ?? { on: false, dari: song.bpm, ke: song.bpm + 20, langkah: 2, tiap: 4 })
        setSuara(song.suara ?? 'klik')
        setGetar(song.getar === 1)
        setVolume(song.volume ?? 0.8)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [song])

  useEffect(() => () => {
    engineRef.current.berhenti()
    pemutarAudio.current.jeda()
  }, [])

  /** E3 — sunting satu kotak pola pada birama ke-`iBar`, sel ke-`iSel`. */
  function ubahSel(iBar: number, iSel: number) {
    setKotor(true)
    setPola((p) => {
      if (!p) return p
      const bars = p.bars.map((b, i) =>
        i === iBar ? { ...b, cells: b.cells.map((c, j) => (j === iSel ? putarSel(c) : c)) } : b,
      )
      return { ...p, bars }
    })
  }

  /** E3 — sunting kotak pada suara kedua (poliritme). */
  function ubahSelPoly(iSel: number) {
    setKotor(true)
    setPola((p) => {
      if (!p || !p.poly) return p
      return { ...p, poly: { ...p.poly, cells: p.poly.cells.map((c, j) => (j === iSel ? putarSel(c) : c)) } }
    })
  }

  function tambahBirama() {
    setKotor(true)
    setPola((p) => {
      const ketukAwal = p?.bars.at(-1)?.beats ?? beats
      const subdivAwal = p?.bars.at(-1)?.subdiv ?? subdiv
      const bar = polaBaku(ketukAwal, subdivAwal)
      return { bars: [...(p?.bars ?? []), bar], poly: p?.poly ?? null }
    })
  }

  function salinBirama(i: number) {
    setKotor(true)
    setPola((p) => {
      if (!p) return p
      const salinan: BiramaPola = { ...p.bars[i], id: `b_${Math.random().toString(36).slice(2, 8)}`, cells: [...p.bars[i].cells] }
      return { ...p, bars: [...p.bars.slice(0, i + 1), salinan, ...p.bars.slice(i + 1)] }
    })
  }

  function hapusBirama(i: number) {
    setKotor(true)
    setPola((p) => (p ? { ...p, bars: p.bars.filter((_, j) => j !== i) } : p))
  }

  function ubahBirama(i: number, patch: Partial<BiramaPola>) {
    setKotor(true)
    setPola((p) => {
      if (!p) return p
      const bars = p.bars.map((b, j) => (j === i ? rapikanBirama({ ...b, ...patch }) : b))
      return { ...p, bars }
    })
  }

  function aturPoly(patch: Partial<{ beats: number; subdiv: number }>) {
    setKotor(true)
    setPola((p) => {
      if (!p) return p
      const lama = p.poly ?? { beats: 3, subdiv: 1, cells: [] as TingkatKlik[] }
      const beats = patch.beats ?? lama.beats
      const subdiv = patch.subdiv ?? lama.subdiv
      const panjang = beats * subdiv
      const cells = [...lama.cells]
      while (cells.length < panjang) cells.push(0)
      return { ...p, poly: { beats, subdiv, cells: cells.slice(0, panjang) as TingkatKlik[] } }
    })
  }

  /** E3 — simpan pola & pengaturan metronom ke lagu yang dipilih. */
  async function simpanKeLagu() {
    if (!song) {
      toast.push('Pilih lagu dulu di repertoar', 'err')
      return
    }
    await db.songs.put({
      ...song,
      // Yang tersimpan tetap pola buatan pemakai. Pola turunan meter dibuat
      // saat diputar saja (lihat `toggle`), supaya meter tidak jadi "rumah
      // kedua" bagi ritme yang sama.
      pola: pakaiPola ? pola : null,
      latih: latih.on ? latih : null,
      suara,
      getar: getar ? 1 : 0,
      volume,
      tandaBirama: birama,
      hitungMundur,
    })
    setKotor(false)
    toast.push('Pola metronom disimpan ke lagu')
  }

  /**
   * Nyalakan metronom mulai dari birama ke-`m`.
   * Dipisah dari `toggle` supaya loncat antar segmen bisa langsung memakai
   * birama tujuan — kalau hanya `setMulaiDari(m)` lalu `toggle()`, mesin
   * masih membaca nilai lama karena React belum sempat render ulang.
   */
  function nyalakan(m: number) {
    // M3 — memutar satu lagu secara manual membatalkan set list yang sedang
    // berjalan (kalau ada), supaya tombol Berhenti tidak membingungkan.
    mainkanSetRef.current = false
    setIndeksMain(null)
    /**
     * M2 — kalau ulang bagian menyala, pemutaran langsung mulai di **awal
     * rentang**. Maksudnya berlatih bagian itu, jadi tidak ada gunanya
     * mendengar birama sebelumnya dulu tiap kali menekan Mulai.
     */
    const mulai = ulangBagianAktif && ub ? ub.dari : m
    const idLagu = song?.id
    setPutaran(null)

    /*
     * #6 — satu jalur untuk menyalakan mesin, dipakai baik oleh pemutaran
     * dengan rekaman maupun tanpa. Bedanya hanya satu: kalau rekaman menjadi
     * patokan waktu, `jam` diisi dan **hitung mundur dimatikan** (klik tidak
     * boleh menghitung mundur sementara lagunya sudah berjalan).
     */
    const jalankanMesin = (jam: JamLagu | null) => {
      engineRef.current.mulai({
        bpm,
        beats,
        subdiv,
        // M1 — tanpa pola kustom, mesin yang membuat birama dari meter yang
        // berlaku, sehingga meter bisa berubah tiap segmen tempo.
        pola: pakaiPola ? pola : null,
        suara,
        volume: song?.rekaman?.modeBunyi === 'rekaman' ? 0 : volume * (song?.rekaman?.volumeKlik ?? 1.0),
        getar,
        latih,
        segmen: segs,
        pakaiTempoMap: useMap && segs.length > 0,
        birama,
        mulaiDari: mulai,
        hitungMundur: jam ? null : hitungMundur,
        jam,
        // M5 — batas akhir lagu & ulang.
        biramaAkhir: panjangBirama,
        ulang: ulangAktif,
        // M2 — rentang ulang. Kalau hidup, ini menang atas akhir lagu.
        ulangBagian: ulangBagianAktif && ub ? { dari: ub.dari, sampai: ub.sampai } : null,
        // #4 — tempo latihan & naik otomatis tiap putaran bagian.
        latihan,
        naikOtomatis: ulangBagianAktif ? naikOtomatis : null,
        onPutaran: (info) => {
          setPutaran(info.putaran)
          // Tempo terakhir yang dicapai diingat.
          tl.aturTempo(idLagu, info.tempo)
          if (song?.id && song.rekaman && ub) {
            // Tempo putaran baru juga berlaku untuk rekamannya: klik yang
            // naik sementara rekaman tetap akan berpisah makin jauh.
            pemutarAudio.current.setKecepatan(lajuRekaman(bpm, info.tempo))
            const offsetUlang = waktuBiramaKeDetikAudio(ub.dari, song.rekaman, segmenWaktu, birama, bpm, undefined, latih)
            pemutarAudio.current.putar(offsetUlang)
          }
        },
        onSelesai: () => {
          pemutarAudio.current.jeda()
          setRunning(false)
          setAktif(null)
          setHabis(true)
          setPutaran(null)
        },
        onKetuk: (i) => {
          setMeasure(i.birama)
          setAktif(i)
          // M1 — ucapkan angka hitung mundur. Ucapan hanya lapisan: ketukannya
          // sudah dijadwalkan Web Audio, jadi ketukan pertama lagu tetap tepat.
          if (i.tahap === 'hitung' && i.ucap) ucapkan(i.ucap)
        },
      })
      setRunning(true)
      setAktif(null)
      setMeasure(mulai)
      setHabis(false)
    }

    if (!song?.id || !song.rekaman) {
      jalankanMesin(null)
      return
    }

    /*
     * #6 — rekaman sebagai patokan waktu: klik baru dimulai setelah rekaman
     * benar-benar berbunyi, dan sepanjang pemutaran ia mengikuti posisi
     * rekaman. Sebelumnya klik mulai lebih dulu — di mesin cepat selisihnya
     * 40 ms, di perangkat sibuk sampai ratusan milidetik — dan tidak ada
     * yang menyusulnya kembali.
     */
    const rekaman = song.rekaman
    const mode = rekaman.modeBunyi ?? 'keduanya'
    const volAud = rekaman.volumeAudio ?? 1.0
    const token = ++mulaiTokenRef.current
    void (async () => {
      const siap = await pemutarAudio.current.muat(song.id)
      if (!siap || token !== mulaiTokenRef.current) return
      pemutarAudio.current.setVolume(mode === 'klik' ? 0 : volAud)
      // #6 — laju yang sepadan dengan tempo latihan (mode persen ATAU BPM).
      pemutarAudio.current.setKecepatan(lajuRekaman(bpm, latihan))
      const offsetDetik = waktuBiramaKeDetikAudio(mulai, rekaman, segmenWaktu, birama, bpm, undefined, latih)
      const berbunyi = await pemutarAudio.current.putarTunggu(offsetDetik)
      if (token !== mulaiTokenRef.current) return
      if (!berbunyi) {
        // Rekaman ditolak peramban atau gagal dimuat: metronom tetap dipakai,
        // tetapi tanpa jam lagu — dan itu dikatakan, bukan didiamkan.
        toast.push('Rekaman tidak mulai berbunyi — metronom jalan tanpa patokan rekaman', 'err')
        jalankanMesin(null)
        return
      }
      jalankanMesin(jamLagu(rekaman))
    })()
  }

  /**
   * M3 — susun opsi mesin **dari lagunya sendiri**, bukan dari state metronom.
   *
   * Ini penting: saat pindah lagu, `useEffect` pada `[song]` memuat ulang
   * pengaturan lagu ke state, tapi pemutaran harus langsung mulai di render
   * yang sama. Membaca langsung dari objek lagu menghindari balapan itu,
   * sekaligus menjadikan tiap lagu diputar dengan pengaturannya sendiri
   * (tempo, sukat, tempo map, bunyi) — memang itu maksud set list.
   */
  function opsiDariLagu(s: Song, selesai: () => void) {
    const meter = s.tandaBirama ? normalisasiBirama(s.tandaBirama) : dariBeatsLama(s.beats)
    const segmen = s.tempoMap ?? []
    const pakaiPolaLagu = !!s.pola && s.pola.bars.length > 0

    if (s.id && s.rekaman) {
      const mode = s.rekaman.modeBunyi ?? 'keduanya'
      const volAud = s.rekaman.volumeAudio ?? 1.0
      void (async () => {
        const siap = await pemutarAudio.current.muat(s.id)
        if (!siap) return
        pemutarAudio.current.setVolume(mode === 'klik' ? 0 : volAud)
        // #6 — aturan tempo yang sama dengan kliknya (mode persen ATAU BPM).
        pemutarAudio.current.setKecepatan(lajuRekaman(s.bpm, tl.tempoUntuk(s.id)))
        const offsetDetik = waktuBiramaKeDetikAudio(1, s.rekaman!, segmen, meter, s.bpm, undefined, s.latih ?? null)
        await pemutarAudio.current.putarTunggu(offsetDetik)
      })()
    }

    return {
      bpm: s.bpm,
      beats: meter.pembilang,
      subdiv,
      pola: pakaiPolaLagu ? s.pola : null,
      suara: s.suara ?? suara,
      volume: s.rekaman?.modeBunyi === 'rekaman' ? 0 : (s.volume ?? volume) * (s.rekaman?.volumeKlik ?? 1.0),
      getar: s.getar === 1 || getar,
      latih: s.latih ?? null,
      // #4 — set list memakai tempo latihan setiap lagu.
      latihan: tl.tempoUntuk(s.id),
      segmen,
      pakaiTempoMap: segmen.length > 0,
      birama: meter,
      mulaiDari: 1,
      // #6 — rekaman menjadi patokan waktu; hitung mundur dimatikan (kalau
      // tidak, klik tertinggal satu hitung mundur penuh dari lagunya).
      jam: s.rekaman ? jamLagu(s.rekaman) : null,
      hitungMundur: s.rekaman ? null : hitungMundur,
      // M5 — berhenti di akhir lagu ini, lalu `selesai` memajukan set list.
      biramaAkhir: s.panjangBirama ?? 0,
      ulang: false,
      onSelesai: () => {
        pemutarAudio.current.jeda()
        selesai()
      },
      onKetuk: (i: InfoKetuk) => {
        setMeasure(i.birama)
        setAktif(i)
        if (i.tahap === 'hitung' && i.ucap) ucapkan(i.ucap)
      },
    }
  }

  /**
   * M3 — mainkan set list mulai dari lagu ke-`k`, lalu lanjut sendiri sampai
   * habis. Fungsi ini memanggil dirinya sendiri dari `onSelesai`.
   */
  function putarSetListDari(k: number) {
    const baris = hitunganSet.baris
    const b = baris[k]
    if (!b) return
    const s = (songs ?? []).find((x) => x.id === b.id)
    if (!s) return

    if (k === 0) setHabis(false)
    mainkanSetRef.current = true
    setIndeksMain(k)
    setSelected(s.id)
    setMeasure(1)
    setAktif(null)

    engineRef.current.mulai(
      opsiDariLagu(s, () => {
        // Lagu ini sudah habis — lanjut ke berikutnya, atau selesai.
        if (!mainkanSetRef.current) return
        if (k + 1 < baris.length) {
          putarSetListDari(k + 1)
        } else {
          mainkanSetRef.current = false
          setIndeksMain(null)
          setRunning(false)
          setHabis(true)
        }
      }),
    )
    setRunning(true)
  }

  function toggle() {
    if (running) {
      // #6 — batalkan juga pemutaran yang masih menunggu rekaman berbunyi.
      mulaiTokenRef.current++
      engineRef.current.berhenti()
      hentikanUcapan()
      pemutarAudio.current.jeda()
      setRunning(false)
      setAktif(null)
      setHabis(false)
      setPutaran(null)
      // M3 — berhenti manual menghentikan set list juga.
      mainkanSetRef.current = false
      setIndeksMain(null)
      return
    }
    nyalakan(mulaiDari)
  }

  /** M1 — loncat ke awal segmen: langsung diputar dari sana kalau sedang jalan. */
  function loncatKeSegmen(m: number) {
    setMulaiDari(m)
    if (running) {
      engineRef.current.berhenti()
      hentikanUcapan()
      pemutarAudio.current.jeda()
      setAktif(null)
      nyalakan(m)
    } else {
      setMeasure(m)
      setHabis(false)
    }
  }

  /* -----------------------------------------------------------------------
   * N5 — Accelerando & Ritardando.
   *
   * Permintaannya berbahasa musik, jadi kendalinya pun harus berbahasa
   * musik: pelatih tidak perlu menghitung "berapa BPM tiap empat birama",
   * ia hanya perlu berkata "lagu ini accelerando". Langkahnya dihitung
   * aplikasi.
   *
   * Alasan teknis yang menentukan: pada bentuk lama, `langkah` diketik
   * sendiri dan **boleh nol** — dan nol membuat tempo tidak pernah berubah
   * sedetik pun tanpa peringatan apa pun. Itu keadaan mati yang tampak
   * seperti fitur rusak. Karena itu langkahnya kini diturunkan dari jarak
   * tempo dan rentang waktunya, sehingga selalu ada perubahan yang terjadi.
   * -------------------------------------------------------------------- */
  /**
   * N6 — apakah lagu yang sedang dipilih punya luncuran PER SEGMEN.
   * Kalau ya, luncuran menyeluruh dikesampingkan (lihat `adaBerangsur`
   * di metronome.ts) — dan yang terpenting, hal itu harus DIBERITAHUKAN,
   * bukan terjadi diam-diam.
   */
  const laguPunyaBerangsur = (song?.tempoMap ?? []).some((t) => t.berangsur === 1 || (t.rampCounts ?? 0) > 0)

  /** Arah perubahan tempo yang sedang dipilih. */
  const arahLatih: 'datar' | 'accel' | 'ritard' = !latih.on
    ? 'datar'
    : latih.ke > latih.dari
      ? 'accel'
      : latih.ke < latih.dari
        ? 'ritard'
        : 'datar'

  /** Berapa BPM perubahannya tiap siklus, diturunkan dari jarak & rentang. */
  const hitungLangkah = (dari: number, ke: number, tiap: number) => {
    const rentang = panjangBirama > 0 ? panjangBirama : 32
    const siklus = Math.max(1, Math.round(rentang / Math.max(1, tiap)))
    return (ke - dari) / siklus
  }

  const pilihArah = (arah: 'accel' | 'ritard') => {
    // Tekan lagi pada arah yang sama = kembalikan tempo jadi datar.
    if (arahLatih === arah) {
      setLatih({ ...latih, on: false })
      return
    }
    const beda = arah === 'accel' ? 20 : -20
    const dari = bpm
    const ke = Math.min(400, Math.max(20, bpm + beda))
    const tiap = 4
    setLatih({ on: true, dari, ke, tiap, langkah: hitungLangkah(dari, ke, tiap) })
  }

  const gantiKe = (ke: number) =>
    setLatih({ ...latih, ke, langkah: hitungLangkah(latih.dari, ke, latih.tiap) })

  const gantiTiap = (tiap: number) =>
    setLatih({ ...latih, tiap, langkah: hitungLangkah(latih.dari, latih.ke, tiap) })

  /** Kalau tempo dasarnya berubah, titik awalnya ikut — bukan tetap di angka lama. */
  const gantiBpm = (v: number) => {
    setBpm(v)
    if (latih.on) setLatih({ ...latih, dari: v, langkah: hitungLangkah(v, latih.ke, latih.tiap) })
  }

  function tapTempo() {
    const now = performance.now()
    taps.current = [...taps.current.filter((t) => now - t < 3000), now]
    if (taps.current.length >= 3) {
      const gaps: number[] = []
      for (let i = 1; i < taps.current.length; i++) gaps.push(taps.current[i] - taps.current[i - 1])
      const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length
      const t = Math.round(60_000 / avg)
      setBpm(Math.min(240, Math.max(40, t)))
    }
  }

  async function saveSong(s: Song) {
    if (!s.title.trim()) {
      toast.push('Judul lagu wajib diisi', 'err')
      return
    }
    await db.songs.put(s)
    setOpen(false)
    toast.push('Lagu disimpan')
  }

  async function handleUpdateRekaman(songId: string, meta: RekamanAudioMeta | null) {
    await db.songs.update(songId, { rekaman: meta })
  }

  /**
   * #11a — metadata partitur lagu. Blob-nya sudah ditulis `partiturSimpan.ts`
   * sebelum baris ini dipanggil (berkas dulu, metadata kemudian).
   */
  async function handleUpdatePartitur(songId: string, meta: PartiturMeta | null) {
    await db.songs.update(songId, { partitur: meta })
  }

  return (
    <div>
      <PageHeader
        title="Musik & Metronom"
        subtitle={
          hanyaPutar
            ? 'Latihan mandiri: ikuti metronom, dengarkan lagu, mainkan set list'
            : 'Klik track untuk latihan, tempo map per ketukan/subdivisi, dan repertoar'
        }
        actions={
          hanyaPutar ? undefined : (
            <Button
              variant="primary"
              onClick={() => {
                setEditing(blankSong())
                setOpen(true)
              }}
            >
              <IconPlus size={16} /> Tambah lagu
            </Button>
          )
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Metronom — aman dipakai walau data terkunci (tidak menyimpan apa pun) */}
        <Card data-kiosk-allow className="min-w-0 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-slate-200">Metronom</h2>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={tapTempo} title="Ketuk beberapa kali sesuai tempo">
                Tap tempo
              </Button>
              <Button
                size="sm"
                variant={running ? 'danger' : 'primary'}
                onClick={toggle}
                data-testid="tombol-mulai"
              >
                {running ? <IconPause size={14} /> : <IconPlay size={14} />} {running ? 'Berhenti' : 'Mulai'}
              </Button>
            </div>
          </div>

          {/* #4 — tempo latihan, dekat tombol Mulai. Juga tersedia di mode anggota. */}
          <KendaliTempoLatihan
            nilai={latihan}
            onUbah={(t) => tl.aturTempo(song?.id, t)}
            bpmAsli={tempoAsliSekarang}
            naik={naikOtomatis}
            onNaik={(n) => tl.aturNaik(song?.id, n)}
            bisaNaik={ulangBagianAktif}
            putaran={running ? putaran : null}
          />

          {/* M1 — mode lagu: panel informasi & strip segmen (hanya saat lagu dipilih) */}
          {song && (
            <div className="mt-4 space-y-2">
              <PanelSedangDiputar
                judul={song.title}
                measure={measure}
                running={running}
                segmen={segmenLengkap}
                warisan={birama}
                tempoDasar={bpm}
                pakaiTempoMap={useMap && segs.length > 0}
                segmenTempo={segs}
                latih={latih}
                tempoUntuk={tempoUntuk}
                latihan={latihan}
                tempoKetuk={aktif && aktif.tahap !== 'hitung'
                  ? { asli: aktif.bpmAsli ?? aktif.bpm, latihan: aktif.bpm }
                  : null}
                waktuBiramaUntuk={(bir) => tempoTimeline.secondsAtPosition({ measure: bir, beat: 1 }, latihan)}
                durasiBiramaUntuk={(bir) => tempoTimeline.barDurationSeconds(bir, latihan)}
              />
              {segmenLengkap.length > 0 && (
                <StripSegmen
                  segmen={segmenLengkap}
                  biramaSekarang={measure}
                  warisan={birama}
                  onLoncat={loncatKeSegmen}
                />
              )}

              {/* M5 — panjang lagu: progres, sisa waktu, dan tombol ulang */}
              {adaPanjang && (
                <div
                  className="rounded-lg border border-slate-800 bg-slate-950/40 p-2.5"
                  data-testid="kartu-panjang"
                >
                  <div className="flex items-center justify-between gap-3 text-[11px]">
                    <span className="text-slate-400" data-testid="teks-panjang">
                      Birama <b className="text-slate-200 tabular-nums">{measure}</b> dari{' '}
                      <b className="text-slate-200 tabular-nums" data-testid="birama-total">
                        {panjangBirama}
                      </b>
                    </span>
                    <span className="text-slate-400" data-testid="teks-sisa">
                      {durasiLagu !== null ? (
                        <>
                          sisa <b className="text-slate-200 tabular-nums">{formatWaktu(sisaDetik ?? 0)}</b>
                          <span className="text-slate-600">
                            {' '}
                            / {formatWaktu(durasiLagu)}
                          </span>
                        </>
                      ) : null}
                    </span>
                  </div>

                  {/* Batang progres — dihitung dari waktu, jadi sukat yang
                      berganti tidak membuatnya melompat. */}
                  <div
                    className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-800"
                    data-testid="batang-progres"
                  >
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-[width] duration-100"
                      style={{ width: `${Math.round((progres ?? 0) * 100)}%` }}
                    />
                  </div>

                  <div className="mt-2 flex items-center gap-2">
                    <Button
                      size="sm"
                      variant={ulangAktif ? 'primary' : 'ghost'}
                      onClick={() => setUlang(!ulangAktif)}
                      data-testid="tombol-ulang"
                      title="Ulang lagu dari awal begitu birama terakhir selesai"
                    >
                      <IconLoop size={13} /> Ulang
                    </Button>
                    {/* M2 — rentang ulang menang atas kedua perilaku di atas. */}
                    <span className="text-[10px] text-slate-500" data-testid="keterangan-akhir">
                      {ulangBagianAktif && ub
                        ? `Birama ${ub.dari}–${ub.sampai} diulang terus — lagu tidak berhenti sendiri.`
                        : ulangAktif
                          ? 'Lagu mengulang dari birama awal.'
                          : 'Metronom berhenti sendiri di akhir lagu.'}
                    </span>
                  </div>
                </div>
              )}

              {/* #6 — Rekaman lagu audio (MP3) */}
              <div
                className="rounded-lg border border-slate-800 bg-slate-950/40 p-2.5"
                data-testid="kartu-rekaman-audio"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-200">
                      🎵 {song.rekaman ? song.rekaman.namaFile : 'Rekaman Lagu'}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      {song.rekaman
                        ? `${formatWaktu(song.rekaman.durasi)} · Titik mulai: ${song.rekaman.titikMulaiDetik.toFixed(2)} dtk · Mode: ${
                            song.rekaman.modeBunyi === 'rekaman'
                              ? 'Audio saja'
                              : song.rekaman.modeBunyi === 'klik'
                                ? 'Klik saja'
                                : 'Audio + Klik'
                          }`
                        : 'Belum ada rekaman audio yang diselaraskan.'}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant={song.rekaman ? 'outline' : 'soft'}
                    onClick={() => setModalRekamanOpen(true)}
                    data-testid="tombol-kelola-rekaman"
                  >
                    {song.rekaman ? 'Kelola Rekaman' : '+ Rekaman Audio'}
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="mt-5 flex flex-col items-center">
            <div className="flex items-baseline gap-2">
              <input
                type="number"
                value={bpm}
                min={40}
                max={240}
                data-testid="bpm"
                onChange={(e) => gantiBpm(Number(e.target.value))}
                className="w-28 rounded-lg border border-slate-700 bg-slate-950/60 px-2 py-1 text-center text-4xl font-bold tabular-nums text-slate-50 outline-none focus:border-emerald-500"
              />
              <span className="text-sm text-slate-500">BPM</span>
            </div>
            <input
              type="range"
              min={40}
              max={240}
              value={bpm}
              onChange={(e) => gantiBpm(Number(e.target.value))}
              className="mt-4 w-full accent-emerald-500"
            />

            {/* M1 — indikator ketuk: lebih besar, bernomor, dan dikelompokkan
                sesuai sukat, jadi 7/8 kelihatan sebagai 2+2+3. */}
            <div className="mt-6 flex flex-col items-center gap-1.5">
              <IndikatorKetuk
                cells={barTampil.cells}
                subdiv={barTampil.subdiv}
                kelompok={meterBerjalan.kelompok}
                iAktif={iKotakAktif}
              />
              <p className="text-[10px] text-slate-500" data-testid="keterangan-indikator">
                {polaAktif
                  ? `Pola birama ${indexBarTampil + 1} dari ${pola?.bars.length ?? 0}`
                  : `${labelBirama(meterBerjalan)} · ${meterBerjalan.kelompok.join('+')}`}
              </p>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Birama ke-<span className="font-semibold text-slate-300" data-testid="birama-ke">{measure}</span>
              {running ? '' : ' — tekan Mulai'}
            </p>
            {/* M1 — selama hitung mundur, tampilkan tahapnya supaya kelihatan
                lagu belum mulai (dan angka ke berapa yang sedang dihitung). */}
            {aktif?.tahap === 'hitung' && (
              <p
                data-testid="tahap-hitung"
                className="mt-1 rounded-full border border-amber-500/40 bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-medium text-amber-200"
              >
                Hitung mundur{aktif?.ucap ? ` — "${aktif.ucap}"` : ''}
              </p>
            )}
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <Field label="Pembagian">
              <Select value={subdiv} onChange={(e) => setSubdiv(Number(e.target.value))} data-testid="pembagian">
                <option value={1}>Ketukan penuh</option>
                <option value={2}>Setengah (1 & 2 &)</option>
                <option value={3}>Triplet</option>
                <option value={4}>Enam belas</option>
              </Select>
            </Field>
            <Field label="Tempo map">
              <Select
                value={useMap ? '1' : '0'}
                onChange={(e) => setUseMap(e.target.value === '1')}
                disabled={segs.length === 0}
                data-testid="pilih-tempo-map"
              >
                <option value="0">Nonaktif</option>
                <option value="1">Ikuti tempo map</option>
              </Select>
            </Field>
            <Field label="Mulai dari birama" hint="1 = dari awal lagu">
              <Input
                type="number"
                min={1}
                value={mulaiDari}
                onChange={(e) => setMulaiDari(Math.max(1, Number(e.target.value) || 1))}
                data-testid="mulai-dari"
              />
            </Field>
            {/*
              M5 — panjang lagu & pengulangan.
              Sengaja di kolom metronom, bukan di modal lagu: modalnya sudah
              setinggi layar, dan menambah satu baris lagi membuat tombol
              "Tambah segmen" di bawah tertutup footer yang menempel.
            */}
            <Field
              label="Panjang lagu (birama)"
              hint={
                durasiLagu === null
                  ? song
                    ? 'belum diisi — tanpa akhir'
                    : 'pilih lagu dulu'
                  : `≈ ${formatWaktu(durasiLagu)} dari tempo map`
              }
            >
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  value={song?.panjangBirama ?? ''}
                  placeholder="tanpa akhir"
                  data-testid="panjang-lagu"
                  onChange={(e) => {
                    if (!song) return
                    const teks = e.target.value
                    const v = teks === '' ? undefined : Math.max(0, Math.floor(Number(teks) || 0))
                    db.songs.update(song.id, { panjangBirama: v })
                  }}
                  disabled={!song}
                  className="flex-1"
                />
                <button
                  type="button"
                  onClick={() => setUlang(!ulangAktif)}
                  disabled={!adaPanjang}
                  data-testid="ulang-ringkas"
                  title="Ulang lagu dari awal begitu birama terakhir selesai"
                  className={cx(
                    'shrink-0 rounded-lg border px-2 py-2 transition disabled:opacity-40',
                    ulangAktif
                      ? 'border-emerald-600/50 bg-emerald-600/15 text-emerald-200'
                      : 'border-slate-700 text-slate-400 hover:bg-slate-800',
                  )}
                >
                  <IconLoop size={14} />
                </button>
              </div>
            </Field>
            <Field label="Bunyi" hint="dibuat sintetis, tetap offline">
              <Select
                data-testid="pilih-suara"
                value={suara}
                onChange={(e) => setSuara(e.target.value as SuaraKlik)}
              >
                <option value="klik">Klik (nada)</option>
                <option value="kayu">Kayu (woodblock)</option>
                <option value="bel">Bel (cowbell)</option>
              </Select>
            </Field>
            <Field label={`Volume ${Math.round(volume * 100)}%`}>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(volume * 100)}
                onChange={(e) => setVolume(Number(e.target.value) / 100)}
                className="mt-2 w-full accent-emerald-500"
              />
            </Field>
          </div>

          {/* M1 — Tanda birama: meter jadi, meter ganjil, atau kustom penuh */}
          <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/40 p-3" data-testid="kartu-birama">
            <h3 className="mb-2 text-xs font-semibold text-slate-300">Tanda birama</h3>
            <PilihBirama
              nilai={birama}
              onChange={(t) => {
                setBirama(t)
                setBeats(t.pembilang)
              }}
              bpm={bpm}
            />
          </div>

          {/* M1 — Hitung mundur mengikuti birama pertama yang dimainkan */}
          <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/40 p-3" data-testid="kartu-hitung-mundur">
            <h3 className="mb-2 text-xs font-semibold text-slate-300">Hitung mundur</h3>
            <AturHitungMundur nilai={hitungMundur} onChange={setHitungMundur} birama={birama} />
          </div>

          {/* M2 — ulang satu bagian saja, untuk berlatih bagian yang sulit */}
          <div
            className="mt-3 rounded-lg border border-slate-800 bg-slate-950/40 p-3"
            data-testid="kartu-ulang-bagian"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold text-slate-300">Ulang bagian</h3>
              <button
                type="button"
                onClick={() => setUlangBagian({ aktif: ulangBagianAktif ? 0 : 1 })}
                disabled={!song || !ubSah}
                data-testid="tombol-ulang-bagian"
                title="Ulang terus rentang birama ini saja"
                className={cx(
                  'rounded-lg border px-2.5 py-1 text-[11px] font-medium transition disabled:opacity-40',
                  ulangBagianAktif
                    ? 'border-emerald-600/50 bg-emerald-600/15 text-emerald-200'
                    : 'border-slate-700 text-slate-400 hover:bg-slate-800',
                )}
              >
                {ulangBagianAktif ? 'Mengulang' : 'Ulang bagian'}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Field label="Dari birama">
                <Input
                  type="number"
                  min={1}
                  value={ub?.dari ?? ''}
                  placeholder="1"
                  disabled={!song}
                  data-testid="ulang-dari"
                  onChange={(e) =>
                    setUlangBagian({ dari: Math.max(1, Math.floor(Number(e.target.value) || 1)) })
                  }
                />
              </Field>
              <Field label="Sampai birama">
                <Input
                  type="number"
                  min={1}
                  value={ub?.sampai ?? ''}
                  placeholder="4"
                  disabled={!song}
                  data-testid="ulang-sampai"
                  onChange={(e) =>
                    setUlangBagian({ sampai: Math.max(1, Math.floor(Number(e.target.value) || 1)) })
                  }
                />
              </Field>
            </div>

            {!song ? (
              <p className="mt-2 text-[10px] text-slate-500">Pilih lagu dulu.</p>
            ) : !ubSah ? (
              <p className="mt-2 text-[10px] text-amber-300/90" data-testid="ulang-tidak-sah">
                Rentang belum bisa dipakai — pastikan "dari" tidak lebih besar dari "sampai"
                {panjangBirama > 0 ? ', dan tidak melebihi panjang lagu' : ''}.
              </p>
            ) : (
              <p className="mt-2 text-[10px] text-slate-500" data-testid="ulang-ringkasan">
                {jumlahBirama(ub)} birama · satu putaran ≈{' '}
                <b className="text-slate-400">{formatWaktu(detikPutaran)}</b>
                {ulangBagianAktif ? (
                  <span className="text-emerald-300/90">
                    {' '}
                    — menyala: pemutaran mulai di birama {ub?.dari} dan bagian ini diulang terus,
                    lagu tidak berhenti di akhir.
                  </span>
                ) : (
                  <span> — nyalakan tombol di atas untuk mengulang bagian ini terus.</span>
                )}
              </p>
            )}
          </div>

          {/* N5 — Accelerando & Ritardando (pelatih dan anggota: ini
              perilaku metronom, bukan data repertoar) */}
          <div
            className="mt-3 rounded-lg border border-slate-800 bg-slate-950/40 p-3"
            data-testid="kartu-perubahan-tempo"
          >
            <h3 className="mb-2 text-xs font-semibold text-slate-300">Perubahan tempo</h3>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={arahLatih === 'accel' ? 'primary' : undefined}
                onClick={() => pilihArah('accel')}
                data-testid="tombol-accelerando"
              >
                Accelerando
              </Button>
              <Button
                size="sm"
                variant={arahLatih === 'ritard' ? 'primary' : undefined}
                onClick={() => pilihArah('ritard')}
                data-testid="tombol-ritardando"
              >
                Ritardando
              </Button>
            </div>
            <p className="mt-1.5 text-[11px] text-slate-500" data-testid="keterangan-arah-tempo">
              {arahLatih === 'accel'
                ? 'Makin lama makin cepat.'
                : arahLatih === 'ritard'
                  ? 'Makin lama makin lambat.'
                  : 'Tempo tetap dari awal sampai akhir.'}
            </p>
            {laguPunyaBerangsur && (
              <p
                className="mt-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[11px] leading-relaxed text-amber-200"
                data-testid="catatan-dikesampingkan"
              >
                Lagu ini punya <b>luncuran per segmen</b>, jadi pengaturan di atas
                <b> dikesampingkan</b> — yang dipakai luncuran per segmennya, karena ia lebih
                khusus. Matikan tanda “Berangsur” pada segmennya bila ingin memakai yang ini.
              </p>
            )}
            {arahLatih !== 'datar' && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Field label="Tujuan (BPM)">
                  <Input
                    type="number"
                    value={latih.ke}
                    onChange={(e) => gantiKe(Number(e.target.value))}
                    data-testid="latih-ke"
                  />
                </Field>
                <Field label="Berubah tiap (birama)">
                  <Input
                    type="number"
                    value={latih.tiap}
                    onChange={(e) => gantiTiap(Number(e.target.value))}
                    data-testid="latih-tiap"
                  />
                </Field>
              </div>
            )}
            {arahLatih !== 'datar' && (
              <p className="mt-2 text-[11px] text-emerald-300/90" data-testid="latih-ringkasan">
                Dari {Math.round(latih.dari)} ke {Math.round(latih.ke)} BPM —{' '}
                {arahLatih === 'accel' ? 'naik' : 'turun'} {Math.abs(latih.langkah).toFixed(1)} BPM
                tiap {latih.tiap} birama.
              </p>
            )}
          </div>

          <div className="mt-4">
            <Toggle
              checked={getar}
              onChange={(v) => setGetar(v)}
              label="Getar tiap ketukan (HP)"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              Getar hanya jalan di browser/HP yang mendukungnya; kalau tidak, dilewati tanpa pesan error.
            </p>
          </div>

          <p className="mt-3 rounded-lg bg-slate-950/50 p-3 text-[11px] leading-relaxed text-slate-500">
            Tips: untuk latihan langkah, gunakan <b>8-to-5 = 1 ketukan per langkah</b>. Kalau BPM 120, satu
            langkah = 0,5 detik. Ketuk tombol “Tap tempo” 4× mengikuti musik untuk mencari tempo lagu.
          </p>
        </Card>

        {/* E3 — Pola ritme. Latih tempo SUDAH PINDAH ke kartu metronom
            (N5) supaya anggota pun bisa memakainya, jadi judulnya tidak
            lagi menyebutnya — judul yang menyebut sesuatu yang tidak ada
            di dalamnya membuat orang mencari di tempat yang salah. */}
        {!hanyaPutar && (
        <Card data-kiosk-allow className="min-w-0 lg:col-span-2" data-testid="kartu-pola">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-200">
              Pola ritme
              {kotor && (
                <span data-testid="tanda-belum-simpan" className="ml-2 rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-200">
                  belum disimpan
                </span>
              )}
            </h2>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                data-testid="tombol-pola-baru"
                onClick={() => {
                  setPola({ bars: [polaBaku(beats, subdiv)], poly: null })
                  setPakaiPola(true)
                  setKotor(true)
                }}
              >
                Pola baru
              </Button>
              <Button size="sm" variant="primary" data-testid="tombol-simpan-pola" onClick={simpanKeLagu}>
                Simpan ke lagu
              </Button>
            </div>
          </div>

          <div className="mt-3">
            <Toggle
              checked={pakaiPola}
              onChange={(v) => setPakaiPola(v)}
              label="Pakai pola (mati = metronom berdetak rata)"
            />
          </div>

          {!pola || !pakaiPola ? (
            <p className="mt-3 rounded-lg bg-slate-950/50 p-3 text-[11px] leading-relaxed text-slate-500">
              Belum ada pola. Tekan <b>Pola baru</b> untuk mulai menggambar ritme: tiap kotak diklik bergilir
              <b> diam → biasa → aksen</b>. Pola tersimpan per lagu, jadi tiap lagu bisa punya ritmenya sendiri.
            </p>
          ) : (
            <>
              <div className="mt-4 space-y-2">
                {pola.bars.map((b, i) => (
                  <EditorBirama
                    key={b.id}
                    bar={b}
                    index={i}
                    aktif={aktif}
                    bisaHapus={pola.bars.length > 1}
                    onSel={(j) => ubahSel(i, j)}
                    onUbah={(patch) => ubahBirama(i, patch)}
                    onSalin={() => salinBirama(i)}
                    onHapus={() => hapusBirama(i)}
                  />
                ))}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" data-testid="tombol-tambah-birama" onClick={tambahBirama}>
                  + Birama
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setKotor(true)
                    setPola((p) =>
                      p
                        ? {
                            ...p,
                            bars: p.bars.map((b) => ({
                              ...b,
                              cells: b.cells.map((_, j) => (j % b.subdiv === 0 ? (j === 0 ? 2 : 1) : 0)) as TingkatKlik[],
                            })),
                          }
                        : p,
                    )
                  }}
                >
                  Rapikan (aksen ketuk 1)
                </Button>
              </div>

              {/* Poliritme */}
              <div className="mt-4 border-t border-slate-800 pt-3">
                <Toggle
                  checked={!!pola.poly}
                  onChange={(v) =>
                    setPola((p) =>
                      p
                        ? {
                            ...p,
                            poly: v
                              ? { beats: 3, subdiv: 1, cells: new Array(3).fill(1) as TingkatKlik[] }
                              : null,
                          }
                        : p,
                    )
                  }
                  label="Poliritme — suara kedua (mis. 3 lawan 2)"
                />
                {pola.poly && (
                  <div className="mt-3 rounded-lg border border-slate-800 p-2.5" data-testid="editor-poliritme">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-semibold text-slate-400">Suara kedua</span>
                      <select
                        value={pola.poly.beats}
                        onChange={(e) => aturPoly({ beats: Number(e.target.value) })}
                        className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200"
                      >
                        {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                          <option key={n} value={n}>
                            {n} bagi
                          </option>
                        ))}
                      </select>
                      <span className="text-[11px] text-slate-600">merata sepanjang birama</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {pola.poly.cells.map((c, j) => {
                        const menyala = aktif && aktif.suara === 2 && aktif.beat === j
                        return (
                          <button
                            key={j}
                            type="button"
                            data-testid={`sel-poly-${j}`}
                            data-tingkat={c}
                            onClick={() => ubahSelPoly(j)}
                            title="Klik: diam → biasa → aksen"
                            className={cx(
                              'h-8 min-w-[30px] flex-1 rounded border text-[10px] font-semibold tabular-nums transition',
                              c === 2
                                ? 'border-amber-500/50 bg-amber-500/25 text-amber-200'
                                : c === 1
                                  ? 'border-slate-600 bg-slate-800 text-slate-200'
                                  : 'border-slate-800 bg-slate-950 text-slate-600',
                              menyala && 'ring-2 ring-amber-300',
                            )}
                          >
                            {c === 2 ? 'A' : c === 1 ? j + 1 : '·'}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

            </>
          )}
        </Card>
        )}

        {/* E4 — Penala & nada dengung */}
        <TunerDrone />

        {/* Repertoar */}
        <Card className="min-w-0">
          <h2 className="mb-3 text-sm font-semibold text-slate-200">Repertoar</h2>
          {!songs?.length ? (
            <EmptyState icon={<IconMusic size={28} />} title="Belum ada lagu" desc="Simpan tempo lagu agar latihan konsisten." />
          ) : (
            <div className="space-y-1.5">
              {songs.map((s) => (
                <button
                  key={s.id}
                  data-testid={`pilih-lagu-${s.id}`}
                  onClick={() => {
                    setSelected(s.id)
                    setUseMap(true)
                  }}
                  className={cx(
                    'w-full rounded-lg border px-3 py-2.5 text-left transition',
                    selected === s.id
                      ? 'border-emerald-600/40 bg-emerald-600/10'
                      : 'border-slate-800 hover:bg-slate-800/50',
                  )}
                >
                  <p className="truncate text-sm font-medium text-slate-100">{s.title}</p>
                  <p className="text-[11px] text-slate-500">
                    {s.bpm} BPM · {s.tandaBirama ? <RingkasBirama nilai={s.tandaBirama} /> : `${s.beats}/4`}
                    {s.key ? ` · ${s.key}` : ''}
                    {s.tempoMap.length ? ` · ${s.tempoMap.length} segmen tempo` : ''}
                    {/*
                      N5 — penanda perubahan tempo. Sengaja tampil untuk
                      anggota juga: kalau sebuah lagu accelerando, mereka
                      harus tahu SEBELUM memutarnya, bukan terkejut ketika
                      temponya tiba-tiba naik sendiri.
                    */}
                    {/* #4 — lagu yang sedang dilatih dengan tempo latihan */}
                    <LencanaLatihan nilai={tl.tempoUntuk(s.id)} testId={`lencana-tempo-latihan-${s.id}`} />
                    {s.latih?.on && (
                      <span
                        className="ml-1 rounded-full border border-emerald-600/40 bg-emerald-600/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300"
                        data-testid={`lencana-latih-${s.id}`}
                      >
                        {s.latih.ke > s.latih.dari ? 'accelerando' : 'ritardando'} → {Math.round(s.latih.ke)}
                      </span>
                    )}
                    {/*
                      N10 — penanda luncuran per segmen. Alasannya persis
                      seperti penanda di atas: anggota harus tahu SEBELUM
                      memutarnya, bukan terkejut di tengah lagu.

                      Tanpa ini, sebuah lagu tertulis "120 BPM" di daftar
                      padahal ia meluncur 172 → 140 pada bar 88–91. Yang
                      mengetahuinya cuma orang yang membuka editornya —
                      padahal yang memutarnya belum tentu orang itu.
                    */}
                    {ringkasLuncuran(s.tempoMap) && (
                      <span
                        className="ml-1 rounded-full border border-sky-500/40 bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-medium text-sky-300"
                        data-testid={`lencana-berangsur-${s.id}`}
                        title={jejakLuncuran(s.tempoMap) ?? undefined}
                      >
                        {ringkasLuncuran(s.tempoMap)}
                      </span>
                    )}
                  </p>
                </button>
              ))}
            </div>
          )}
          {!hanyaPutar && (
            <div className="mt-4 border-t border-slate-800 pt-3">
              <PanelTukarRepertoar songs={songs ?? []} setlists={daftarSetList ?? []} />
            </div>
          )}
          {song && (
            <div className="mt-4 space-y-2 border-t border-slate-800 pt-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-300">Tempo map — {song.title}</p>
                <div className="flex items-center gap-1">
                  {!hanyaPutar && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditing(song)
                        setOpen(true)
                      }}
                    >
                      Edit
                    </Button>
                  )}
                  {!hanyaPutar && (
                    <ConfirmButton
                      onConfirm={async () => {
                        await db.songs.delete(song.id)
                        setSelected('')
                        toast.push('Lagu dihapus', 'info')
                      }}
                      message="Hapus lagu?"
                    />
                  )}
                </div>
              </div>
              {song.tempoMap.length === 0 && <p className="text-[11px] text-slate-500">Belum ada segmen tempo.</p>}
              {[...song.tempoMap]
                .sort((a, b) => a.measure - b.measure)
                .map((t) => (
                  <div key={t.id} className="flex items-center justify-between rounded-lg border border-slate-800 px-2.5 py-1.5">
                    <span className="text-xs text-slate-300">
                      Birama {t.measure} — {t.label}
                      {t.birama && (
                        <span className="ml-1 text-slate-500" data-testid={`segmen-label-${t.id}`}>
                          · {labelBirama(t.birama)} ({t.birama.kelompok.join('+')})
                        </span>
                      )}
                    </span>
                    <span className="flex items-center gap-2">
                      {(() => {
                        const p = panjangSegmenById.get(t.id)
                        if (!p) return null
                        return (
                          <span
                            className="text-[10px] tabular-nums text-slate-500"
                            data-testid={`daftar-segmen-panjang-${t.id}`}
                            title={`Panjang segmen dalam hitungan drill (${fmtAngka(asumsiSegmen.nilai)} ketuk per hitungan, ${asumsiSegmen.sumber})`}
                          >
                            {p.hitungan === null ? 'panjang bebas' : `≈ ${fmtAngka(p.hitungan)} hitungan`}
                          </span>
                        )
                      })()}
                      <span className="text-xs font-semibold tabular-nums text-emerald-400">{t.bpm} BPM</span>
                    </span>
                  </div>
                ))}
              {song.notes && <p className="whitespace-pre-wrap text-[11px] text-slate-500">{song.notes}</p>}
              {/*
                #11a — partitur lagu ini: pasang/lepas, ringkasan, kuota.
                Diletakkan di sebelah tempo map karena keduanya milik lagu yang
                sedang dipilih, dan supaya halaman Musik tetap satu tempat untuk
                "lagu ini isinya apa saja" (rekaman, tempo, partitur).
              */}
              <div className="border-t border-slate-800 pt-3">
                <PanelPartitur
                  song={song}
                  onUpdateSong={handleUpdatePartitur}
                  hanyaPutar={hanyaPutar}
                  terbuka={partiturTerbuka && !!song.partitur}
                  onToggleBuka={() => setPartiturTerbuka((v) => !v)}
                />
              </div>
            </div>
          )}
        </Card>

        {/* #11b — lembar baca partitur full score (MusicXML OSMD / PDF) */}
        {song && song.partitur && partiturTerbuka && (
          <LayarPartitur
            song={song}
            onTutup={() => setPartiturTerbuka(false)}
          />
        )}
      </div>

      {/* M3 — set list: urutan lagu untuk satu penampilan */}
      <KartuSetList
        daftar={daftarSetList ?? []}
        aktif={setlistAktif}
        songs={songs ?? []}
        laguDipilih={selected}
        sedangMain={running}
        latihanUntuk={(id) => tl.tempoUntuk(id)}
        onSemuaAsli={(ids) => tl.keAsli(ids)}
        indeksMain={indeksMain}
        onPilih={(id) => {
          mainkanSetRef.current = false
          setIndeksMain(null)
          setSetlistId(id)
        }}
        onBuat={async () => {
          const sl = setListBaru(uid('sl_'), `Set list ${(daftarSetList?.length ?? 0) + 1}`)
          await db.setlists.put(sl)
          setSetlistId(sl.id)
        }}
        onHapus={async () => {
          if (!setlistAktif) return
          await db.setlists.delete(setlistAktif.id)
          setSetlistId('')
          setIndeksMain(null)
          mainkanSetRef.current = false
        }}
        onGantiNama={async (nama) => {
          if (!setlistAktif) return
          await db.setlists.update(setlistAktif.id, { name: nama, updatedAt: Date.now() })
        }}
        onUrut={async (songIds) => {
          if (!setlistAktif) return
          await db.setlists.update(setlistAktif.id, { songIds, updatedAt: Date.now() })
        }}
        onMainkan={(i) => {
          if (running && indeksMain !== null) {
            // Tekan lagi pada lagu yang sama = berhenti.
            engineRef.current.berhenti()
            hentikanUcapan()
            pemutarAudio.current.jeda()
            mainkanSetRef.current = false
            setIndeksMain(null)
            setRunning(false)
            return
          }
          putarSetListDari(i)
        }}
        onPilihLagu={(id) => {
          mainkanSetRef.current = false
          setIndeksMain(null)
          setSelected(id)
          setUseMap(true)
        }}
        hanyaPutar={hanyaPutar}
        onTambah={async (songId) => {
          if (!setlistAktif) return
          await db.setlists.update(setlistAktif.id, {
            songIds: [...setlistAktif.songIds, songId],
            updatedAt: Date.now(),
          })
        }}
      />

      <SongModal open={open} song={editing} onClose={() => setOpen(false)} onSave={saveSong} />

      <ModalRekamanLagu
        open={modalRekamanOpen}
        song={song ?? null}
        onClose={() => setModalRekamanOpen(false)}
        onUpdateSong={handleUpdateRekaman}
        hanyaPutar={hanyaPutar}
      />
    </div>
  )
}

/**
 * E3 — Editor satu birama: pilih jumlah ketukan & pembagian, lalu klik kotak
 * berulang untuk mengatur **diam → biasa → aksen**. Saat metronom berjalan,
 * kotak yang sedang berbunyi diberi cincin terang.
 */
function EditorBirama({
  bar,
  index,
  aktif,
  bisaHapus,
  onSel,
  onUbah,
  onSalin,
  onHapus,
}: {
  bar: BiramaPola
  index: number
  aktif: InfoKetuk | null
  bisaHapus: boolean
  onSel: (i: number) => void
  onUbah: (patch: Partial<BiramaPola>) => void
  onSalin: () => void
  onHapus: () => void
}) {
  const barAktif = aktif && aktif.suara === 1 ? aktif.bar : -1
  const iAktif = aktif && aktif.suara === 1 ? aktif.beat * bar.subdiv + aktif.sub : -1
  return (
    <div className="rounded-lg border border-slate-800 p-2.5" data-testid={`editor-birama-${index}`}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold text-slate-400">Birama {index + 1}</span>
        <select
          value={bar.beats}
          onChange={(e) => onUbah({ beats: Number(e.target.value) })}
          className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200"
          title="Jumlah ketukan dalam birama ini"
        >
          {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
            <option key={n} value={n}>
              {n} ketuk
            </option>
          ))}
        </select>
        <select
          value={bar.subdiv}
          onChange={(e) => onUbah({ subdiv: Number(e.target.value) })}
          className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200"
          title="Pembagian tiap ketukan"
        >
          <option value={1}>penuh</option>
          <option value={2}>setengah</option>
          <option value={3}>triplet</option>
          <option value={4}>enam belas</option>
        </select>
        <div className="ml-auto flex gap-1">
          <Button size="sm" variant="ghost" onClick={onSalin}>
            Salin
          </Button>
          {bisaHapus && (
            <Button size="sm" variant="ghost" onClick={onHapus}>
              Hapus
            </Button>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        {bar.cells.map((c, i) => {
          const menyala = barAktif === index && i === iAktif
          return (
            <button
              key={i}
              type="button"
              data-testid={`sel-${index}-${i}`}
              data-tingkat={c}
              onClick={() => onSel(i)}
              title="Klik berulang: diam → biasa → aksen"
              className={cx(
                'h-8 min-w-[26px] flex-1 rounded border text-[10px] font-semibold tabular-nums transition',
                c === 2
                  ? 'border-emerald-500/50 bg-emerald-500/25 text-emerald-200'
                  : c === 1
                    ? 'border-slate-600 bg-slate-800 text-slate-200'
                    : 'border-slate-800 bg-slate-950 text-slate-600',
                menyala && 'ring-2 ring-emerald-300',
              )}
            >
              {c === 2 ? 'A' : c === 1 ? Math.floor(i / bar.subdiv) + 1 : '·'}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function blankSong(): Song {
  return {
    id: uid('song_'),
    title: '',
    composer: '',
    bpm: 120,
    beats: 4,
    key: '',
    notes: '',
    tempoMap: [],
    createdAt: Date.now(),
  }
}

function SongModal({
  open,
  song,
  onClose,
  onSave,
}: {
  open: boolean
  song: Song | null
  onClose: () => void
  onSave: (s: Song) => void
}) {
  const [s, setS] = useState<Song | null>(song)
  useEffect(() => setS(song), [song])
  /*
   * #5 sisa — panjang tiap segmen dalam **hitungan drill**, supaya musik dan
   * set drill direncanakan dengan satuan yang sama. Ketuk per hitungannya
   * diambil dari drill yang memakai lagu ini (lihat `asumsiHitungan`).
   *
   * Hook-nya WAJIB di atas `if (!s) return null` di bawah: kalau tidak, jumlah
   * hook berubah begitu lagunya ada dan React melempar error #310.
   */
  const semuaDrill = useLiveQuery(() => db.drills.toArray(), [], [])
  const asumsi = useMemo(() => asumsiHitungan(semuaDrill ?? [], s?.id ?? ''), [semuaDrill, s?.id])
  const panjangSegmen = useMemo(
    () =>
      s
        ? panjangSegmenLagu(
            {
              bpm: s.bpm,
              tandaBirama: s.tandaBirama ?? dariBeatsLama(s.beats),
              tempoMap: s.tempoMap,
              latih: s.latih ?? null,
            },
            asumsi.nilai,
            { akhirBirama: s.panjangBirama ?? null },
          )
        : [],
    [s, asumsi.nilai],
  )
  /** Peta id segmen → panjangnya, memakai urutan yang sama dengan `urutSegmen`. */
  const panjangById = useMemo(
    () => (s ? petaPanjang(s.tempoMap, panjangSegmen) : new Map<string, PanjangSegmen>()),
    [s, panjangSegmen],
  )
  if (!s) return null

  /* N5 — perubahan tempo yang tersimpan di lagu ini. */
  const arahLagu: 'datar' | 'accel' | 'ritard' = !s.latih?.on
    ? 'datar'
    : s.latih.ke > s.latih.dari
      ? 'accel'
      : s.latih.ke < s.latih.dari
        ? 'ritard'
        : 'datar'
  /** Rentang lagu dipakai untuk membagi langkahnya; 32 bila belum diisi. */
  const rentangLagu = Math.max(1, s.panjangBirama ?? 0) > 0 ? (s.panjangBirama ?? 32) : 32
  const hitungLangkahLagu = (dari: number, ke: number, tiap: number) => {
    const siklus = Math.max(1, Math.round(rentangLagu / Math.max(1, tiap)))
    return (ke - dari) / siklus
  }
  const pilihArahLagu = (arah: 'accel' | 'ritard') => {
    if (arahLagu === arah) {
      setS({ ...s, latih: null })
      return
    }
    const dari = s.bpm
    const ke = Math.min(400, Math.max(20, s.bpm + (arah === 'accel' ? 20 : -20)))
    const tiap = 4
    setS({ ...s, latih: { on: true, dari, ke, tiap, langkah: hitungLangkahLagu(dari, ke, tiap) } })
  }
  const gantiKeLagu = (ke: number) =>
    setS({
      ...s,
      latih: s.latih
        ? { ...s.latih, ke, langkah: hitungLangkahLagu(s.latih.dari, ke, s.latih.tiap) }
        : s.latih,
    })
  const gantiTiapLagu = (tiap: number) =>
    setS({
      ...s,
      latih: s.latih
        ? { ...s.latih, tiap, langkah: hitungLangkahLagu(s.latih.dari, s.latih.ke, tiap) }
        : s.latih,
    })

  /* N6 — segmen terurut: dipakai untuk mengetahui segmen SESUDAH sebuah
     segmen, karena luncuran temponya menuju segmen berikutnya. */
  const urutSegmen = [...s.tempoMap].sort((a, b) =>
    a.measure - b.measure || (a.beat ?? 1) - (b.beat ?? 1) ||
    (a.subdivision ?? 1) - (b.subdivision ?? 1),
  )

  /** N6 — kalau ada segmen berangsur, luncuran menyeluruh dikesampingkan. */
  const adaBerangsurDiLagu = s.tempoMap.some((t) => t.berangsur === 1 || (t.rampCounts ?? 0) > 0)

  const addSeg = () => {
    const lastMeasure = s.tempoMap.length ? Math.max(...s.tempoMap.map((t) => t.measure)) + 8 : 1
    const seg: TempoSegment = {
      id: uid('tm_'),
      label: `Bagian ${String.fromCharCode(65 + s.tempoMap.length)}`,
      measure: lastMeasure,
      bpm: s.tempoMap.at(-1)?.bpm ?? s.bpm,
      beats: s.beats,
      beat: 1,
      subdivision: 1,
      subdivisionsPerBeat: 1,
      rampUnit: 'beat',
    }
    setS({ ...s, tempoMap: [...s.tempoMap, seg] })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={song?.title ? 'Edit lagu' : 'Tambah lagu'}
      testId="modal-lagu"
      wide
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button variant="primary" onClick={() => onSave(s)}>
            Simpan
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Judul lagu">
          <Input autoFocus value={s.title} onChange={(e) => setS({ ...s, title: e.target.value })} />
        </Field>
        <Field label="Komposer / aransemen" hint="opsional">
          <Input value={s.composer ?? ''} onChange={(e) => setS({ ...s, composer: e.target.value })} />
        </Field>
        <Field label="Tempo dasar (BPM)">
          <Input type="number" value={s.bpm} onChange={(e) => setS({ ...s, bpm: Number(e.target.value) })} />
        </Field>
        <Field label="Tangga nada" hint="opsional">
          <Input value={s.key ?? ''} onChange={(e) => setS({ ...s, key: e.target.value })} placeholder="mis. Bb" />
        </Field>
      </div>

      {/* M1 — pilihan meter yang sama persis dengan metronom */}
      <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/40 p-3" data-testid="lagu-birama">
        <h3 className="mb-2 text-xs font-semibold text-slate-300">Tanda birama</h3>
        <PilihBirama
          nilai={s.tandaBirama ?? dariBeatsLama(s.beats)}
          onChange={(t) => setS({ ...s, tandaBirama: t, beats: t.pembilang })}
          bpm={s.bpm}
        />
      </div>

      {/* M1 — hitung mundur mengikuti birama pertama lagu */}
      <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/40 p-3" data-testid="lagu-hitung-mundur">
        <h3 className="mb-2 text-xs font-semibold text-slate-300">Hitung mundur</h3>
        <AturHitungMundur
          nilai={s.hitungMundur ?? hitungMundurDefault()}
          onChange={(h) => setS({ ...s, hitungMundur: h })}
          birama={s.tandaBirama ?? dariBeatsLama(s.beats)}
        />
      </div>

      {/* N5 — Accelerando & Ritardando yang TERSIMPAN DI LAGU ini.

          Beda dengan kendali di kartu metronom: yang itu untuk berlatih
          sesaat di perangkat ini, yang ini milik lagunya. Karena tersimpan
          di dalam `Song`, ia ikut terbawa ke HP seluruh anggota setiap
          kali pelatih menerbitkan materi — jadi satu band berlatih
          perubahan tempo yang sama, bukan masing-masing menebak sendiri. */}
      <div
        className="mt-3 rounded-lg border border-slate-800 bg-slate-950/40 p-3"
        data-testid="lagu-perubahan-tempo"
      >
        <h3 className="mb-2 text-xs font-semibold text-slate-300">Perubahan tempo lagu ini</h3>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={arahLagu === 'accel' ? 'primary' : undefined}
            onClick={() => pilihArahLagu('accel')}
            data-testid="lagu-accelerando"
          >
            Accelerando
          </Button>
          <Button
            size="sm"
            variant={arahLagu === 'ritard' ? 'primary' : undefined}
            onClick={() => pilihArahLagu('ritard')}
            data-testid="lagu-ritardando"
          >
            Ritardando
          </Button>
        </div>
        <p className="mt-1.5 text-[11px] text-slate-500" data-testid="lagu-keterangan-arah">
          {arahLagu === 'accel'
            ? 'Lagu ini makin lama makin cepat.'
            : arahLagu === 'ritard'
              ? 'Lagu ini makin lama makin lambat.'
              : 'Tempo lagu ini tetap dari awal sampai akhir.'}
        </p>
        {adaBerangsurDiLagu && (
          <p
            className="mt-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[11px] leading-relaxed text-amber-200"
            data-testid="lagu-catatan-dikesampingkan"
          >
            Salah satu segmen di bawah ditandai <b>Berangsur</b>, jadi pengaturan ini
            <b> dikesampingkan</b> saat lagu diputar. Yang dipakai luncuran per segmennya,
            karena ia lebih khusus.
          </p>
        )}
        {arahLagu !== 'datar' && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Tujuan (BPM)">
              <Input
                type="number"
                value={s.latih?.ke ?? s.bpm}
                onChange={(e) => gantiKeLagu(Number(e.target.value))}
                data-testid="lagu-latih-ke"
              />
            </Field>
            <Field label="Berubah tiap (birama)">
              <Input
                type="number"
                value={s.latih?.tiap ?? 4}
                onChange={(e) => gantiTiapLagu(Number(e.target.value))}
                data-testid="lagu-latih-tiap"
              />
            </Field>
          </div>
        )}
        {arahLagu !== 'datar' && s.latih && (
          <p className="mt-2 text-[11px] text-emerald-300/90" data-testid="lagu-latih-ringkasan">
            Dari {Math.round(s.latih.dari)} ke {Math.round(s.latih.ke)} BPM —{' '}
            {arahLagu === 'accel' ? 'naik' : 'turun'} {Math.abs(s.latih.langkah).toFixed(1)} BPM tiap{' '}
            {s.latih.tiap} birama. Tersimpan di lagu ini, jadi ikut terbawa ke seluruh anggota.
          </p>
        )}
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400">Tempo map (posisi birama / ketuk / subdivisi)</span>
          <Button size="sm" onClick={addSeg}>
            <IconPlus size={14} /> Segmen
          </Button>
        </div>
        <p className="mb-2 text-[11px] leading-relaxed text-slate-500">
          Ketuk dan subdivisi memakai indeks 1-based. Ramp menyimpan jumlah hitungan dan satuannya secara eksplisit;
          perubahan pada hitungan pertama sudah bergerak, dan hitungan terakhir mencapai BPM target.
        </p>
        <p className="mb-2 text-[11px] leading-relaxed text-slate-500" data-testid="segmen-asumsi-hitungan">
          Panjang tiap segmen juga ditulis dalam <b>hitungan drill</b> ({fmtAngka(asumsi.nilai)} ketuk per
          hitungan, {asumsi.sumber}) — itulah satuan set di editor drill.
        </p>
        <div className="space-y-2">
          {[...s.tempoMap]
            .sort((a, b) => a.measure - b.measure || (a.beat ?? 1) - (b.beat ?? 1) || (a.subdivision ?? 1) - (b.subdivision ?? 1))
            .map((t) => (
              <div key={t.id} className="space-y-1.5 rounded-lg border border-slate-800 bg-slate-950/40 p-2" data-testid={`segmen-${t.id}`}>
                {(() => {
                  const idx = urutSegmen.findIndex((x) => x.id === t.id)
                  const berikut = urutSegmen[idx + 1]
                  return (
                <>
                <div className="grid grid-cols-12 gap-2">
                <Input
                  className="col-span-4"
                  placeholder="Label"
                  data-testid={`segmen-label-${t.id}`}
                  value={t.label}
                  onChange={(e) =>
                    setS({ ...s, tempoMap: s.tempoMap.map((x) => (x.id === t.id ? { ...x, label: e.target.value } : x)) })
                  }
                />
                <Input
                  className="col-span-2"
                  type="number"
                  min={1}
                  placeholder="Birama"
                  aria-label={`Birama segmen ${t.label}`}
                  data-testid={`segmen-birama-${t.id}`}
                  value={t.measure}
                  onChange={(e) =>
                    setS({
                      ...s,
                      tempoMap: s.tempoMap.map((x) => (x.id === t.id ? { ...x, measure: Number(e.target.value) } : x)),
                    })
                  }
                />
                <Input
                  className="col-span-2"
                  type="number"
                  min={1}
                  placeholder="Ketuk"
                  aria-label={`Ketuk segmen ${t.label}`}
                  data-testid={`segmen-ketuk-${t.id}`}
                  value={t.beat ?? 1}
                  onChange={(e) =>
                    setS({
                      ...s,
                      tempoMap: s.tempoMap.map((x) => (x.id === t.id ? { ...x, beat: Number(e.target.value) || 1 } : x)),
                    })
                  }
                />
                <Input
                  className="col-span-3"
                  type="number"
                  placeholder="BPM"
                  data-testid={`segmen-bpm-${t.id}`}
                  value={t.bpm}
                  onChange={(e) =>
                    setS({ ...s, tempoMap: s.tempoMap.map((x) => (x.id === t.id ? { ...x, bpm: Number(e.target.value) } : x)) })
                  }
                />
                <button
                  onClick={() => setS({ ...s, tempoMap: s.tempoMap.filter((x) => x.id !== t.id) })}
                  className="col-span-1 rounded-lg text-slate-500 hover:bg-slate-800 hover:text-rose-300"
                >
                  ✕
                </button>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Field label="Subdivisi posisi">
                    <Input
                      type="number"
                      min={1}
                      value={t.subdivision ?? 1}
                      aria-label={`Subdivisi posisi segmen ${t.label}`}
                      data-testid={`segmen-subdivisi-${t.id}`}
                      onChange={(e) => setS({
                        ...s,
                        tempoMap: s.tempoMap.map((x) => x.id === t.id
                          ? { ...x, subdivision: Number(e.target.value) || 1 }
                          : x),
                      })}
                    />
                  </Field>
                  <Field label="Subdivisi per ketuk">
                    <Input
                      type="number"
                      min={1}
                      max={64}
                      value={t.subdivisionsPerBeat ?? 1}
                      aria-label={`Jumlah subdivisi segmen ${t.label}`}
                      data-testid={`segmen-jumlah-subdivisi-${t.id}`}
                      onChange={(e) => setS({
                        ...s,
                        tempoMap: s.tempoMap.map((x) => x.id === t.id
                          ? { ...x, subdivisionsPerBeat: Number(e.target.value) || 1 }
                          : x),
                      })}
                    />
                  </Field>
                </div>
                {/* M1 — sukat per segmen: lagu bisa berganti meter di tengah */}
                <div className="flex items-center gap-2">
                  <span className="w-12 shrink-0 text-[11px] text-slate-500">Sukat</span>
                  <div className="flex-1">
                    <PilihBiramaSegmen
                      nilai={t.birama}
                      onChange={(bm) =>
                        setS({
                          ...s,
                          tempoMap: s.tempoMap.map((x) =>
                            x.id === t.id ? { ...x, birama: bm, beats: bm ? bm.pembilang : s.beats } : x,
                          ),
                        })
                      }
                      warisan={s.tandaBirama ?? dariBeatsLama(s.beats)}
                      testId={`segmen-meter-${t.id}`}
                    />
                  </div>
                </div>

                <div className="border-t border-slate-800/60 pt-2">
                  <div className="grid gap-2 sm:grid-cols-3">
                    <Field label="Panjang ramp (hitungan)" hint="kosong = perubahan langsung">
                      <Input
                        type="number"
                        min={1}
                        max={10000}
                        placeholder="mis. 6"
                        value={t.rampCounts ?? ''}
                        data-testid={`segmen-ramp-hitungan-${t.id}`}
                        onChange={(e) => {
                          const counts = Number(e.target.value)
                          setS({
                            ...s,
                            tempoMap: s.tempoMap.map((x) => x.id === t.id
                              ? { ...x, rampCounts: counts > 0 ? Math.floor(counts) : undefined, berangsur: 0 }
                              : x),
                          })
                        }}
                      />
                    </Field>
                    <Field label="Satuan hitungan ramp">
                      <Select
                        value={t.rampUnit ?? 'beat'}
                        data-testid={`segmen-ramp-unit-${t.id}`}
                        onChange={(e) => setS({
                          ...s,
                          tempoMap: s.tempoMap.map((x) => x.id === t.id
                            ? { ...x, rampUnit: e.target.value as TempoSegment['rampUnit'] }
                            : x),
                        })}
                      >
                        <option value="beat">Ketuk tertulis</option>
                        <option value="tempoBeat">Ketuk acuan BPM</option>
                        <option value="subdivision">Subdivisi ketuk tertulis</option>
                        <option value="tempoSubdivision">Subdivisi acuan BPM</option>
                        <option value="bar">Birama</option>
                      </Select>
                    </Field>
                    <Field label="Dari BPM" hint="kosong = tempo yang sedang berlaku">
                      <Input
                        type="number"
                        min={20}
                        max={400}
                        placeholder="otomatis"
                        value={t.rampFromBpm ?? ''}
                        data-testid={`segmen-ramp-dari-${t.id}`}
                        onChange={(e) => {
                          const value = e.target.value === '' ? undefined : Number(e.target.value)
                          setS({
                            ...s,
                            tempoMap: s.tempoMap.map((x) => x.id === t.id ? { ...x, rampFromBpm: value } : x),
                          })
                        }}
                      />
                    </Field>
                  </div>
                  {(t.rampUnit === 'subdivision' || t.rampUnit === 'tempoSubdivision') && (
                    <Field label="Subdivisi per hitungan" hint="3 = triplet">
                      <Input
                        type="number"
                        min={2}
                        max={64}
                        value={t.rampSubdivisions ?? 3}
                        data-testid={`segmen-ramp-subdivisi-${t.id}`}
                        onChange={(e) => setS({
                          ...s,
                          tempoMap: s.tempoMap.map((x) => x.id === t.id
                            ? { ...x, rampSubdivisions: Number(e.target.value) || 3 }
                            : x),
                        })}
                      />
                    </Field>
                  )}
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                    Posisi perubahan: birama / ketuk / subdivisi (semuanya mulai dari 1). BPM di atas adalah
                    target. Pada ramp berdurasi N hitungan, hitungan 1 sudah berubah dan hitungan N tepat
                    mencapai target.
                  </p>
                  {(t.rampCounts ?? 0) > 0 && (
                    <p className="mt-1 text-[11px] text-emerald-300/90" data-testid={`segmen-ramp-ringkasan-${t.id}`}>
                      Ramp {t.rampFromBpm ?? 'tempo aktif'} → {t.bpm} BPM selama {t.rampCounts} hitungan.
                    </p>
                  )}
                </div>

                {/* Legacy ramp: retained for existing bar-to-bar maps. */}
                {(t.rampCounts ?? 0) <= 0 && <div className="border-t border-slate-800/60 pt-1.5">
                  <Toggle
                    testId={`segmen-berangsur-${t.id}`}
                    checked={t.berangsur === 1}
                    onChange={(v) =>
                      setS({
                        ...s,
                        tempoMap: s.tempoMap.map((x) =>
                          x.id === t.id ? { ...x, berangsur: v ? 1 : 0 } : x,
                        ),
                      })
                    }
                    label={
                      berikut
                        ? `Berangsur ke bar ${berikut.measure} (${berikut.bpm} BPM)`
                        : 'Berangsur ke segmen berikutnya'
                    }
                  />
                  {t.berangsur === 1 && !berikut && (
                    <p
                      className="mt-1 text-[11px] text-amber-300/90"
                      data-testid={`berangsur-tanpa-tujuan-${t.id}`}
                    >
                      Belum ada segmen sesudahnya, jadi belum ada yang bisa diluncurkan. Tambah
                      segmen di birama berikutnya dulu.
                    </p>
                  )}
                  {t.berangsur === 1 && berikut && berikut.measure <= t.measure && (
                    <p
                      className="mt-1 text-[11px] text-amber-300/90"
                      data-testid={`berangsur-tumpang-${t.id}`}
                    >
                      Segmen berikutnya harus ditempatkan di birama yang lebih besar.
                    </p>
                  )}
                  {t.berangsur === 1 && berikut && berikut.measure > t.measure && (
                    <p
                      className="mt-1 text-[11px] text-emerald-300/90"
                      data-testid={`berangsur-ringkasan-${t.id}`}
                    >
                      Bar {t.measure}: {t.bpm} BPM → bar {berikut.measure}: {berikut.bpm} BPM —
                      diluncurkan selama {berikut.measure - t.measure} birama
                      {berikut.bpm > t.bpm ? ' (accelerando)' : berikut.bpm < t.bpm ? ' (ritardando)' : ''}.
                    </p>
                  )}
                </div>}
                {/* #5 sisa — panjang segmen dalam hitungan drill. */}
                {(() => {
                  const p = panjangById.get(t.id)
                  if (!p) return null
                  return (
                    <p className="text-[10px] text-slate-500" data-testid={`segmen-panjang-${t.id}`}>
                      {p.hitungan === null
                        ? 'Panjangnya belum tertentu — isi “panjang lagu” atau tambah segmen berikutnya'
                        : `≈ ${fmtAngka(p.hitungan)} hitungan drill · birama ${fmtBirama(p.mulaiBirama)}–${fmtBirama(p.akhirBirama)}`}
                    </p>
                  )
                })()}
                </>
                  )
                })()}
              </div>
            ))}

          {/* M1 — tombol tambah juga ada di BAWAH daftar, supaya mengisi
              banyak segmen tidak perlu menggulir kembali ke atas. */}
          <Button
            size="sm"
            variant="ghost"
            className="mt-2 w-full"
            onClick={addSeg}
            data-testid="tambah-segmen-bawah"
          >
            <IconPlus size={14} /> Tambah segmen
          </Button>
          {s.tempoMap.length === 0 && (
            <p className="mt-1 text-center text-[11px] text-slate-500">
              Belum ada segmen. Segmen dipakai untuk mengubah tempo &amp; sukat di tengah lagu.
            </p>
          )}
        </div>
      </div>

      <Field label="Catatan" hint="opsional">
        <Textarea value={s.notes ?? ''} onChange={(e) => setS({ ...s, notes: e.target.value })} />
      </Field>
    </Modal>
  )
}
