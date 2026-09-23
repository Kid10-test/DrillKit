import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { Drill, DrillSet, Member } from '../db/types'
import { facingDeg, ukurTitik } from '../lib/field'
import { cocokPutaran, deltaBusur, gerakOf, progresPemain, titikJalur } from '../lib/gerak'
import { TINGKAT_LABEL, URUTAN_TINGKAT, analisisPerpindahan, lebihBerat } from '../lib/analitik'
import { stepYd } from '../lib/field'
import { useSettings } from '../hooks/useSettings'
import { sectionDot, sectionLabel } from '../lib/utils'
import {
  KUNCI_SEMUA,
  bersihkanSet,
  hitungSelesai,
  seksiSelesai,
  setSelesai,
  tandai,
} from '../lib/kemajuan'
import { bacaTampilan, langgananTampilan, ubahTampilan } from '../lib/tampilan'
import type { Tampilan } from '../lib/tampilan'
import { Metronom, klikUntukDrill } from '../lib/metronome'
import { FieldSurface } from './FieldSurface'
import { LayarTerkunci, TombolKunci, pakaiKunciLayar } from './KunciPresenter'
import { diDalamLayarKunci, kunciMenahan } from '../lib/kunciLayar'
import { MarkerLayer } from './FieldMarkers'

/**
 * Mode Presenter — menampilkan formasi sebesar mungkin, tanpa menu editor.
 *
 * Dipakai saat latihan: HP/laptop diletakkan atau dipegang sambil berdiri,
 * lalu pelatih cukup mengetuk layar untuk maju ke set berikutnya.
 *
 * Catatan teknis:
 * - Animasi antar set memakai trik yang sama dengan editor: titik digerakkan
 *   lewat atribut `transform` (bukan render ulang React per frame), supaya
 *   tetap 60 fps untuk 80 pemain.
 * - Layar ditahan agar tidak mati (`Screen Wake Lock`) kalau browser
 *   mendukungnya. Kalau tidak didukung, diam-diam dilewati.
 */
export function DrillPresenter({
  drill,
  sets,
  roster,
  startIdx = 0,
  tempoPerSet,
  onClose,
}: {
  drill: Drill
  sets: DrillSet[]
  roster: Member[]
  /** set yang ditampilkan pertama kali (ikut set aktif di editor) */
  startIdx?: number
  /**
   * M1 — tempo per set kalau drill ditautkan ke lagu. Kalau diisi, presenter
   * memakai tempo lagu pada set itu, bukan satu tempo datar drill.
   */
  tempoPerSet?: number[]
  /** dipanggil saat ditutup — membawa indeks set terakhir yang dilihat */
  onClose: (idx: number) => void
}) {
  /**
   * G2b — kunci layar.
   *
   * Sengaja dipanggil **paling atas**: penangan tombol di bawah memakai
   * `layarTerkunci`, dan variabel ini harus sudah ada sebelum penangan itu
   * dibaca. Posisinya di sini juga menandakan bahwa kunci adalah keadaan
   * inti presenter, bukan tambahan di pinggir.
   */
  const { terkunci: layarTerkunci, kunci: kunciLayar, buka: bukaLayar } = pakaiKunciLayar()

  /** M1 — tempo untuk set ke-`i`: dari lagu kalau ada, selain itu tempo drill. */
  const tempoUntuk = (i: number) => tempoPerSet?.[i] ?? drill.tempo
  const f = drill.field
  /** Ukuran titik mengikuti luas lapangan — sama seperti di editor. */
  const uk = (n: number) => ukurTitik(f, n)
  const ordered = useMemo(() => [...sets].sort((a, b) => a.order - b.order), [sets])
  const [idx, setIdx] = useState(Math.min(Math.max(0, startIdx), Math.max(0, ordered.length - 1)))
  const [playing, setPlaying] = useState(false)
  /**
   * Putar 90° supaya lapangan memenuhi layar HP yang dipegang tegak.
   * Nilai awal mengikuti bentuk layar: kalau tinggi > lebar (HP berdiri),
   * langsung diputar — kalau tidak, biarkan lanskap seperti bagan kertas.
   */
  const [rotated, setRotated] = useState(
    () => typeof window !== 'undefined' && window.innerHeight > window.innerWidth,
  )
  const [showCodes, setShowCodes] = useState(true)
  const [showPaths, setShowPaths] = useState(true)
  /** Ketuk layar = maju ke set berikutnya (bisa dimatikan). */
  const [tapNext, setTapNext] = useState(true)
  /* ------------------- B3 — Mode urutan latihan (run-through) -------------------
     Menjalankan set 1 → terakhir otomatis mengikuti tempo, jadi pelatih tidak
     perlu memegang HP terus. Tiap set: diam beberapa count (supaya formasi
     sempat terlihat), lalu bergerak mengikuti jumlah count set tersebut. */
  const [urutan, setUrutan] = useState(false)
  /** ulangi dari set pertama setelah set terakhir */
  const [ulangUrutan, setUlangUrutan] = useState(false)
  /** lama diam di tiap set, dalam count (0 / 2 / 4 / 8) */
  const [diam, setDiam] = useState(2)
  /* ------------------------- B4 — Tampilan layar --------------------------
     Chip cepat untuk menyalakan kontras tinggi & huruf besar tanpa keluar
     dari presenter — berguna saat matahari membuat layar sulit dibaca. */
  const [tampilan, setTampilan] = useState<Tampilan>(bacaTampilan)
  useEffect(() => langgananTampilan(setTampilan), [])

  /* --------------------------- K1 — Mode asisten ----------------------------
     B3 sudah menjalankan set berurutan, tapi ia hanya menggerakkan titik tanpa
     pernah mengatakan apa yang sedang terjadi. Asisten menambah lapisan
     pemberitahuan: sebelum tiap perpindahan ia mengumumkan ke mana, berapa
     count, catatan set yang ditulis perancang, dan section yang gerakannya
     paling berat — lalu menghitung mundur supaya pemain sempat siap. */
  const [asisten, setAsisten] = useState(false)
  /** Tahap yang sedang diumumkan: `siap` (hitung mundur) → `jalan` → `selesai`. */
  const [tahap, setTahap] = useState<null | 'siap' | 'jalan' | 'selesai'>(null)
  /** Sisa hitung mundur persiapan. */
  const [hitung, setHitung] = useState(0)
  const asistenRef = useRef(asisten)
  asistenRef.current = asisten

  /* --------------------- K2 — Latihan per section ---------------------------
     Pilih satu section: hanya section itu yang bergerak, sisanya tetap tampil
     redup sebagai patokan — karena pemain perlu melihat di mana rekan mereka
     berada, bukan melihat mereka ikut jalan. Bisa diulang terus tanpa maju ke
     set berikutnya, persis yang dilakukan pelatih: "Battery, ulangi lagi." */
  const [seksi, setSeksi] = useState<string>('semua')
  /** Ulangi perpindahan yang sama terus, tanpa maju ke set berikutnya. */
  const [ulangPerpindahan, setUlangPerpindahan] = useState(false)

  /* ------------------------- B5 — Klik tempo latihan -------------------------
     Satu detak per count, aksen di count pertama tiap set. Menyertai baik
     perpindahan tunggal maupun mode urutan latihan. */
  const [klik, setKlik] = useState(false)
  const metronomRef = useRef<Metronom>(new Metronom())
  const klikRef = useRef(klik)
  klikRef.current = klik

  const mulaiKlik = useCallback(
    (counts: number, keSet: number) => {
      if (!klikRef.current) return
      const k = klikUntukDrill(tempoUntuk(keSet), drill.beatsPerCount, counts)
      metronomRef.current.mulai({ bpm: k.bpm, beats: k.beats, subdiv: 1, suara: 'kayu', volume: 0.9 })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [drill.tempo, drill.beatsPerCount, tempoPerSet],
  )
  const hentiKlik = useCallback(() => metronomRef.current.berhenti(), [])

  // Matikan tombol Klik → bunyi langsung berhenti.
  useEffect(() => {
    if (!klik) hentiKlik()
  }, [klik, hentiKlik])
  // Presenter ditutup → klik ikut berhenti.
  useEffect(() => () => metronomRef.current.berhenti(), [])
  const ulangRef = useRef(ulangUrutan)
  ulangRef.current = ulangUrutan

  /* -------------------------------------------------------------------------- */
  /*  K1 — Petunjuk asisten untuk perpindahan yang sedang tampil               */
  /* -------------------------------------------------------------------------- */

  const settings = useSettings()
  const sYd = stepYd(f)

  /* -------------------------------- K2 ------------------------------------- */
  /** Section yang ada di drill ini, dipakai untuk pilihan di presenter. */
  const daftarSeksi = useMemo(
    () => [...new Set(roster.map((m) => m.section))].sort((a, b) => a.localeCompare(b)),
    [roster],
  )
  /** Pemain yang ikut bergerak: semua, atau cuma section terpilih. */
  const anggotaSeksi = useMemo(
    () => new Set(roster.filter((m) => seksi === 'semua' || m.section === seksi).map((m) => m.id)),
    [roster, seksi],
  )
  // Ref supaya handler animasi yang dipasang sekali tidak terjebak closure usang.
  const seksiRef = useRef(seksi)
  seksiRef.current = seksi
  const anggotaRef = useRef(anggotaSeksi)
  anggotaRef.current = anggotaSeksi
  const ulangPerRef = useRef(ulangPerpindahan)
  ulangPerRef.current = ulangPerpindahan
  /** Apakah pemain ini ikut bergerak pada latihan yang sedang berjalan? */
  const ikutGerak = (id: string) =>
    seksiRef.current === 'semua' || anggotaRef.current.has(id)

  /**
   * Apa yang akan diumumkan asisten untuk perpindahan ini.
   *
   * `catatan` diambil dari set **tujuan** — catatan di situ yang menjelaskan
   * formasi yang harus dibentuk ("lingkaran", "blok 4 baris"), jadi itulah
   * yang perlu didengar pemain sesaat sebelum bergerak.
   *
   * Section terberat diambil dari modul analitik yang sama dengan editor, dan
   * dengan ambang yang sama — supaya asisten tidak pernah menyebut angka yang
   * berbeda dari panel di belakangnya.
   */
  const petunjuk = useMemo(() => {
    const dari = ordered[idx]
    const ke = ordered[idx + 1]
    if (!dari || !ke) return null
    const counts = Math.max(1, dari.counts ?? 8)
    const h = analisisPerpindahan(
      dari,
      ke,
      roster,
      sYd,
      tempoUntuk(idx),
      drill.beatsPerCount,
      undefined,
      drill.setelanLangkah,
      settings?.ambangGerak,
      drill.setelanJarak,
    )
    const berat = h.seksi.find((sc) => sc.tingkatAkhir === 'berat' || sc.tingkatAkhir === 'mustahil')
    const paling = berat ?? h.seksi[0]
    /**
     * Sebabnya harus disebut dengan jujur.
     *
     * Section bisa berstatus "mustahil" karena **kecepatannya**, sementara
     * ukuran langkahnya biasa saja. Menampilkan "langkah 22,5″ (mustahil)"
     * akan membuat pelatih memperkecil langkah — padahal yang perlu
     * ditambah adalah jumlah count-nya.
     */
    const sebab = paling
      ? lebihBerat(paling.tingkatLangkah, paling.tingkat) === paling.tingkatLangkah &&
        URUTAN_TINGKAT.indexOf(paling.tingkatLangkah) > 0
        ? { jenis: 'langkah' as const, angka: paling.langkahTerbesarInci, tingkat: paling.tingkatLangkah }
        : { jenis: 'cepat' as const, angka: paling.terberat, tingkat: paling.tingkat }
      : null
    return {
      dari: dari.name,
      ke: ke.name,
      counts,
      tempo: Math.round(tempoUntuk(idx)),
      catatan: (ke.notes ?? '').trim(),
      /** Section yang perlu diingatkan — null kalau gerakannya biasa saja. */
      seksi: berat && paling && sebab
        ? { label: paling.label, ...sebab }
        : null,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    ordered,
    idx,
    roster,
    sYd,
    drill.beatsPerCount,
    drill.setelanLangkah,
    drill.setelanJarak,
    drill.tempo,
    tempoPerSet,
    settings?.ambangGerak,
  ])

  const halfW = f.widthYd / 2
  const halfL = (f.lengthYd + f.endZoneYd * 2) / 2
  const VW = f.lengthYd + f.endZoneYd * 2
  const VH = f.widthYd
  const sx = (x: number) => halfL - x
  const sy = (y: number) => halfW - y

  const set = ordered[idx]

  /* ---------------------------------------------------------------------- *
   * K3 — kemajuan latihan.
   *
   * Centang per set, tersimpan per drill di tabel sendiri. Sengaja tidak
   * menempel di `Drill` karena daftar drill diurutkan menurut `updatedAt`:
   * kalau centang menulis ke situ, drill akan melompat ke puncak daftar
   * setiap kali pemain mencentang sesuatu.
   * ---------------------------------------------------------------------- */
  const kemajuan = useLiveQuery(() => db.kemajuan.get(drill.id), [drill.id], undefined)
  const idSet = useMemo(() => ordered.map((s) => s.id), [ordered])
  /** Kunci yang berlaku sekarang: seluruh formasi, atau seksi yang dipilih. */
  const kunciKemajuan = seksi === 'semua' ? KUNCI_SEMUA : seksi
  const sudahKuasai = set
    ? kunciKemajuan === KUNCI_SEMUA
      ? setSelesai(kemajuan, set.id, daftarSeksi)
      : seksiSelesai(kemajuan, set.id, kunciKemajuan)
    : false
  const jumlahSelesai = hitungSelesai(kemajuan, idSet, daftarSeksi)
  /**
   * Centang set ini, atau bersihkan kalau sudah selesai.
   *
   * Dalam mode "Semua" keadaan selesai bisa datang dari centang per seksi,
   * yang tidak bisa dibatalkan dengan menambah `'*'` — jadi kalau set sudah
   * lengkap, klik berarti mengulang set ini dari awal.
   */
  const centangSetIni = useCallback(() => {
    if (!set) return
    if (kunciKemajuan === KUNCI_SEMUA && setSelesai(kemajuan, set.id, daftarSeksi)) {
      void bersihkanSet(drill.id, set.id)
      return
    }
    void tandai(drill.id, set.id, kunciKemajuan)
  }, [drill.id, set, kunciKemajuan, kemajuan, daftarSeksi])
  const nextSet = idx < ordered.length - 1 ? ordered[idx + 1] : undefined
  const rosterById = useMemo(() => new Map(roster.map((m) => [m.id, m])), [roster])

  /** Elemen <g> tiap titik, dipakai untuk menggerakkan saat animasi. */
  const dotRefs = useRef(new Map<string, SVGGElement>())
  const dotCbs = useRef(new Map<string, (el: SVGGElement | null) => void>())
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

  /**
   * B3 — jalankan / hentikan urutan latihan. Kalau tombol ditekan saat sudah
   * di set terakhir, urutan dimulai lagi dari set pertama (bukan langsung
   * berhenti) — kalau tidak, menekan ▶▶ di akhir latihan terasa "nggak ngefek".
   */
  const mulaiUrutan = useCallback(() => {
    setPlaying(false)
    if (urutan) {
      setUrutan(false)
      return
    }
    if (ordered.length < 2) return
    if (idx >= ordered.length - 1) setIdx(0)
    setUrutan(true)
  }, [urutan, ordered.length, idx])

  const goNext = useCallback(() => {
    setUrutan(false)
    setPlaying(false)
    setIdx((i) => Math.min(i + 1, ordered.length - 1))
  }, [ordered.length])
  const goPrev = useCallback(() => {
    setUrutan(false)
    setPlaying(false)
    setIdx((i) => Math.max(i - 1, 0))
  }, [])

  /**
   * DD4 — pemain yang mengikuti **busur putaran** pada satu perpindahan.
   * Hanya yang perpindahannya cocok dengan putaran itu yang masuk; sisanya
   * tetap memakai jalur lurus/melengkung. Hitungannya sama persis dengan editor.
   */
  function petaBusur(dari: DrillSet, ke: DrillSet) {
    const peta = new Map<
      string,
      {
        x0: number
        y0: number
        pusat: { x: number; y: number }
        sudut: number
        geser: { x: number; y: number }
      }
    >()
    const g = gerakOf(dari.gerak)
    const pt = g.jalur === 'busur' ? g.putar : undefined
    if (!pt || !pt.sudut) return peta
    const pusatGambar = { x: sx(pt.pusat.x), y: sy(pt.pusat.y) }
    // Geseran pusat dalam ruang gambar = selisih dua titik terproyeksi, bukan
    // proyeksi sebuah selisih — dengan begitu aman untuk sumbu yang dibalik.
    const geserGambar = pt.pusatAkhir
      ? { x: sx(pt.pusatAkhir.x) - pusatGambar.x, y: sy(pt.pusatAkhir.y) - pusatGambar.y }
      : { x: 0, y: 0 }
    for (const [id, p] of Object.entries(dari.points)) {
      const q = ke.points[id]
      if (!q) continue
      if (!cocokPutaran(p.x, p.y, q.x, q.y, pt.pusat, pt.sudut, pt.pusatAkhir ? {
        x: pt.pusatAkhir.x - pt.pusat.x,
        y: pt.pusatAkhir.y - pt.pusat.y,
      } : undefined)) continue
      peta.set(id, {
        x0: sx(p.x),
        y0: sy(p.y),
        pusat: pusatGambar,
        sudut: pt.sudut,
        geser: geserGambar,
      })
    }
    return peta
  }

  /* ------------------------------- Animasi -------------------------------- */

  const rafRef = useRef(0)
  useEffect(() => {
    if (!playing || !set || !nextSet) {
      setPlaying(false)
      return
    }
    const counts = Math.max(1, set.counts ?? 8)
    // M1 — pakai tempo lagu pada set ini kalau drill ditautkan.
    const total = counts * drill.beatsPerCount * (60_000 / Math.max(20, tempoUntuk(idx)))
    mulaiKlik(counts, idx)
    const t0 = performance.now()
    // Vektor gerak tiap pemain (satuan gambar SVG) — dihitung sekali.
    const vec: [string, number, number][] = []
    for (const [id, p] of Object.entries(set.points)) {
      const q = nextSet.points[id]
      if (!q) continue
      // K2 — latihan per section: yang bukan section terpilih diam.
      if (!ikutGerak(id)) continue
      vec.push([id, sx(q.x) - sx(p.x), sy(q.y) - sy(p.y)])
    }
    // DD2 — gerak set ini: bentuk jalur, pembagian kecepatan, tunda per section.
    const gr = gerakOf(set.gerak)
    const lengkungGerak = gr.jalur === 'lengkung' ? gr.lengkung : 0
    const busur = petaBusur(set, nextSet)
    const loop = () => {
      const p = Math.min(1, (performance.now() - t0) / total)
      for (const [id, vx, vy] of vec) {
        const g = dotRefs.current.get(id)
        if (!g) continue
        const t = progresPemain(p, gr, rosterById.get(id)?.section, counts)
        const bs = busur.get(id)
        const [tx, ty] = bs
          ? deltaBusur(t, bs.x0, bs.y0, bs.pusat, bs.sudut, bs.geser)
          : titikJalur(t, vx, vy, lengkungGerak)
        g.setAttribute('transform', `translate(${tx} ${ty})`)
      }
      if (p < 1) {
        rafRef.current = requestAnimationFrame(loop)
      } else {
        for (const [id] of vec) dotRefs.current.get(id)?.removeAttribute('transform')
        hentiKlik()
        setPlaying(false)
        setIdx((i) => Math.min(i + 1, ordered.length - 1))
      }
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(rafRef.current)
      hentiKlik()
      // Bersihkan sisa transform kalau animasi dibatalkan di tengah jalan.
      for (const [id] of vec) dotRefs.current.get(id)?.removeAttribute('transform')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, set, nextSet, drill.beatsPerCount, drill.tempo, tempoPerSet, ordered.length])

  /* --------------------- B3 — Urutan latihan otomatis ---------------------- */

  /**
   * Ref pembantu: mesin urutan di bawah sengaja **hanya bergantung pada
   * `urutan`**, jadi ia tidak ikut berhenti & mulai lagi setiap kali React
   * merender ulang presenter (yang sering terjadi karena data drill dibaca
   * langsung dari database). Semua nilai yang bisa berubah dibaca lewat ref.
   */
  const idxRef = useRef(idx)
  idxRef.current = idx
  const orderedRef = useRef(ordered)
  orderedRef.current = ordered
  const diamRef = useRef(diam)
  diamRef.current = diam

  useEffect(() => {
    if (!urutan) return
    let batal = false
    /**
     * Menandai urutan yang **habis dengan sendirinya**, bukan dihentikan.
     *
     * Penting: begitu `urutan` jadi false, pembersih efek ini berjalan — dan
     * kalau ia selalu menghapus `tahap`, kartu "Selesai" lenyap pada detik
     * yang sama ia dibuat. Jadi pembersih hanya membersihkan kalau urutannya
     * memang dibatalkan di tengah jalan.
     */
    let rampung = false
    const msPerCount = drill.beatsPerCount * (60_000 / Math.max(20, tempoUntuk(0)))
    const tunda = (ms: number) => new Promise<void>((r) => setTimeout(r, Math.max(50, ms)))
    /** tunggu satu frame — dipakai untuk menunggu `setIdx` benar-benar diterapkan */
    const tungguRender = () => new Promise<void>((r) => requestAnimationFrame(() => r()))

    /** Mainkan satu perpindahan (dari → ke) mengikuti jumlah count set asal. */
    const mainkanPerpindahan = (dari: DrillSet, ke: DrillSet, counts: number) =>
      new Promise<void>((selesai) => {
        const total = counts * msPerCount
        const vec: [string, number, number][] = []
        for (const [id, p] of Object.entries(dari.points)) {
          const q = ke.points[id]
          if (q && ikutGerak(id)) vec.push([id, sx(q.x) - sx(p.x), sy(q.y) - sy(p.y)])
        }
        // DD2 — pengaturan gerak diambil dari set ASAL perpindahan ini.
        const gr = gerakOf(dari.gerak)
        const lengkungGerak = gr.jalur === 'lengkung' ? gr.lengkung : 0
        const busur = petaBusur(dari, ke)
        const t0 = performance.now()
        const loop = () => {
          if (batal) return selesai()
          const p = Math.min(1, (performance.now() - t0) / total)
          for (const [id, vx, vy] of vec) {
            const g = dotRefs.current.get(id)
            if (!g) continue
            const t = progresPemain(p, gr, rosterById.get(id)?.section, counts)
            const bs = busur.get(id)
            const [tx, ty] = bs
              ? deltaBusur(t, bs.x0, bs.y0, bs.pusat, bs.sudut, bs.geser)
              : titikJalur(t, vx, vy, lengkungGerak)
            g.setAttribute('transform', `translate(${tx} ${ty})`)
          }
          // Harus dibatasi ke dalam presenter: editor di belakangnya juga punya
          // elemen `[data-live-count]`, dan letaknya lebih awal di DOM.
          const lbl = document.querySelector('[data-testid="presenter"] [data-live-count]')
          if (lbl) lbl.textContent = `Count ${Math.min(counts, Math.ceil(p * counts) || 0)}/${counts}`
          if (p < 1) requestAnimationFrame(loop)
          else {
            for (const [id] of vec) dotRefs.current.get(id)?.removeAttribute('transform')
            selesai()
          }
        }
        requestAnimationFrame(loop)
      })

    ;(async () => {
      while (!batal) {
        // Diam dulu di formasi ini supaya sempat dilihat, lalu bergerak.
        // K1 — kalau asisten menyala, jedanya diumumkan: kartu petunjuk tampil
        // dan hitung mundurnya berdetak mengikuti tempo, bukan sekadar menunggu
        // dalam diam. Tanpa asisten, perilakunya persis seperti dulu.
        const nDiam = Math.max(0, Math.round(diamRef.current))
        if (asistenRef.current && nDiam > 0) {
          setTahap('siap')
          for (let k = nDiam; k >= 1; k--) {
            if (batal) break
            setHitung(k)
            await tunda(msPerCount)
          }
          if (batal) break
          setHitung(0)
        } else {
          await tunda(nDiam * msPerCount)
          if (batal) break
        }
        const i = idxRef.current
        const daftar = orderedRef.current
        if (i >= daftar.length - 1) {
          // Sudah di set terakhir: ulang dari awal atau selesai.
          if (!ulangRef.current) break
          setIdx(0)
          while (!batal && idxRef.current !== 0) await tungguRender()
          continue
        }
        // B5 — klik dimulai lagi di tiap set supaya aksen jatuh pada count 1.
        mulaiKlik(Math.max(1, daftar[i].counts ?? 8), i)
        if (asistenRef.current) setTahap('jalan')
        await mainkanPerpindahan(daftar[i], daftar[i + 1], Math.max(1, daftar[i].counts ?? 8))
        if (batal) break
        // K2 — ulangi perpindahan yang sama. Transform titik sudah dibersihkan
        // di akhir `mainkanPerpindahan`, jadi formasi kembali ke posisi set ini
        // dengan sendirinya tanpa perlu menyetel ulang apa pun.
        if (ulangPerRef.current) continue
        setIdx(i + 1)
        while (!batal && idxRef.current !== i + 1) await tungguRender()
      }
      hentiKlik()
      if (!batal) {
        rampung = true
        // Biarkan kartu "Selesai" tampil sebentar, lalu hilang sendiri.
        if (asistenRef.current) {
          setTahap('selesai')
          setTimeout(() => setTahap((t) => (t === 'selesai' ? null : t)), 2600)
        }
        setUrutan(false)
      }
    })()

    return () => {
      batal = true
      hentiKlik()
      if (!rampung) {
        setTahap(null)
        setHitung(0)
      }
      for (const [, g] of dotRefs.current) if (g.hasAttribute('transform')) g.removeAttribute('transform')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urutan])

  /* ------------------------------- Keyboard -------------------------------- */

  /**
   * Keyboard presenter dipasang dengan **capture** (`true`) dan dihentikan
   * penyebarannya (`stopPropagation`). Alasannya: editor di belakangnya juga
   * memasang pintasan keyboard di `window` (Ctrl+Z, panah, Escape, F, …).
   * Dengan capture, presenter melihat tombol lebih dulu dan bisa mencegah
   * editor ikut menjalankan pintasannya saat presenter sedang terbuka.
   */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // G2b — kunci layar ditegakkan DI SINI, bukan oleh penangan saingan.
      // Penangan ini terdaftar lebih dulu di `window` (fase tangkap), jadi
      // dialah satu-satunya tempat yang bisa mencegah aksi sebelum terjadi.
      if (kunciMenahan(layarTerkunci, e.key, diDalamLayarKunci(e.target))) {
        e.preventDefault()
        e.stopPropagation()
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose(idx)
        return
      }
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'PageDown') {
        e.preventDefault()
        e.stopPropagation()
        goNext()
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault()
        e.stopPropagation()
        goPrev()
      } else if (e.key === ' ') {
        e.preventDefault()
        e.stopPropagation()
        setUrutan(false)
        if (nextSet) setPlaying((p) => !p)
      } else if (e.key === 'r' || e.key === 'R') {
        // B3 — urutan latihan (run-through) dari set yang sedang tampil.
        e.preventDefault()
        e.stopPropagation()
        mulaiUrutan()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [goNext, goPrev, idx, nextSet, onClose, mulaiUrutan, layarTerkunci])

  /* --------------------- Tahan layar agar tidak mati ---------------------- */

  useEffect(() => {
    let sentinel: { release: () => Promise<void> } | null = null
    ;(async () => {
      try {
        const wl = (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> } })
          .wakeLock
        if (wl?.request) sentinel = await wl.request('screen')
      } catch {
        // Tidak didukung browser (atau tidak aman konteksnya) — lewati saja.
      }
    })()
    return () => {
      try {
        void sentinel?.release()
      } catch {
        // abaikan
      }
    }
  }, [])

  const bigBtn =
    'grid h-16 min-w-[5.5rem] place-items-center rounded-2xl border border-slate-700 bg-slate-900 text-2xl font-semibold text-slate-100 active:scale-[.97] disabled:opacity-30'

  return (
    <div
      data-kiosk-allow
      data-testid="presenter"
      data-layar-terkunci={layarTerkunci ? 'ya' : 'tidak'}
      className="fixed inset-0 z-[200] flex flex-col bg-slate-950 text-slate-100"
    >
      {/* Baris atas: judul, nama set, tombol tutup */}
      <div className="flex items-center gap-3 px-3 py-2 sm:px-5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{drill.showTitle || drill.name}</p>
          <p className="truncate text-xs text-slate-400">
            {set?.name ?? '-'} ·{' '}
            <span className="text-slate-500" data-testid="info-set">
              {idx + 1}/{ordered.length}
            </span>
            {set?.counts ? <span className="text-slate-500"> · {set.counts} count</span> : null}
          </p>
        </div>
        <TombolKunci terkunci={layarTerkunci} onKunci={kunciLayar} />
        <button
          type="button"
          data-testid="tutup-presenter"
          onClick={() => onClose(idx)}
          className="shrink-0 rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-200 active:scale-[.97]"
        >
          Tutup ✕
        </button>
      </div>

      {/* Kanvas lapangan — ketuk untuk maju (kalau diaktifkan) */}
      <div
        className="relative min-h-0 flex-1 px-2"
        onClick={tapNext ? goNext : undefined}
        data-testid="kanvas-presenter"
        style={{ touchAction: 'manipulation' }}
      >
        {/*
          K1 — Kartu petunjuk asisten.

          Sengaja diletakkan di atas lapangan, bukan di bawahnya: pemain
          melihat layar dari jauh, dan yang mereka perlukan sebelum bergerak
          adalah "ke mana" dan "berapa count" — bukan detail formasi yang sudah
          tergambar di lapangan.
        */}
        {asisten &&
          tahap &&
          // Kartu "selesai" sengaja tidak mensyaratkan `urutan` — ia justru
          // tampil setelah urutan selesai — dan tidak mensyaratkan `petunjuk`,
          // karena di set terakhir memang tidak ada perpindahan berikutnya.
          (tahap === 'selesai' || (urutan && petunjuk)) && (
          <div
            data-testid="kartu-asisten"
            data-tahap={tahap}
            className="pointer-events-none absolute inset-x-1 top-1 z-20 rounded-2xl border-2 bg-slate-950/90 px-3 py-2 shadow-xl"
            style={{
              borderColor:
                tahap === 'jalan' ? '#34d399' : tahap === 'selesai' ? '#64748b' : '#f59e0b',
            }}
          >
            {tahap === 'selesai' ? (
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-bold text-slate-200">SELESAI</span>
                <span className="text-xs text-slate-400">
                  seluruh {ordered.length} set telah dijalankan
                </span>
              </div>
            ) : petunjuk ? (
              <>
                <div className="flex items-center gap-2">
                  {tahap === 'siap' ? (
                    <>
                      <span className="shrink-0 text-sm font-bold tracking-wide text-amber-300">
                        SIAP
                      </span>
                      <span
                        data-testid="asisten-hitung"
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber-500/20 text-xl font-bold tabular-nums text-amber-200"
                      >
                        {hitung || '·'}
                      </span>
                    </>
                  ) : (
                    <span className="shrink-0 text-sm font-bold tracking-wide text-emerald-300">
                      JALAN
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-100">
                    {petunjuk.dari}
                    <span className="mx-1 text-slate-500">→</span>
                    {petunjuk.ke}
                  </span>
                </div>

                <p className="mt-0.5 text-xs text-slate-400">
                  {petunjuk.counts} count · {petunjuk.tempo} BPM
                </p>

                {/* Catatan perancang — inilah "suara" asistennya. */}
                {petunjuk.catatan && (
                  <p
                    data-testid="asisten-catatan"
                    className="mt-1 border-l-2 border-slate-600 pl-2 text-xs italic leading-snug text-slate-300"
                  >
                    {petunjuk.catatan}
                  </p>
                )}

                {/* Peringatan section: hanya yang berat/mustahil, supaya tidak
                    jadi kebisingan di layar yang dibaca sambil berjalan. */}
                {petunjuk.seksi && (
                  <p
                    data-testid="asisten-seksi"
                    data-sebab={petunjuk.seksi.jenis}
                    className="mt-1 text-xs font-semibold"
                    style={{
                      color:
                        petunjuk.seksi.tingkat === 'mustahil' ? '#ef4444' : '#fb923c',
                    }}
                  >
                    Perhatian {petunjuk.seksi.label} —{' '}
                    {petunjuk.seksi.jenis === 'langkah'
                      ? `langkah ${Math.round(petunjuk.seksi.angka * 10) / 10}\u2033`
                      : `${Math.round(petunjuk.seksi.angka)} langkah/mnt`}{' '}
                    ({TINGKAT_LABEL[petunjuk.seksi.tingkat].toLowerCase()})
                  </p>
                )}
              </>
            ) : null}
          </div>
        )}

        <svg
          viewBox={`0 0 ${rotated ? VH : VW} ${rotated ? VW : VH}`}
          className="h-full w-full touch-none select-none"
          preserveAspectRatio="xMidYMid meet"
        >
          <g transform={rotated ? `translate(${VH} 0) rotate(90)` : undefined}>
            <FieldSurface f={f} VW={VW} VH={VH} sx={sx} sy={sy} />

            {/* A7 — penanda lapangan ikut tampil di layar latihan. */}
            <MarkerLayer markers={drill.markers ?? []} sx={sx} sy={sy} redup />

            {/*
              Jejak gerak ke set berikutnya — di layar lapangan panahnya dibuat
              lebih besar supaya kelihatan dari jauh (A5).
            */}
            <defs>
              <marker
                id="dk-panah-presenter"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="3.4"
                markerHeight="3.4"
                markerUnits="userSpaceOnUse"
                orient="auto"
              >
                <path d="M0 0 L10 5 L0 10 Z" fill="#e2e8f0" fillOpacity={0.8} />
              </marker>
            </defs>
            {showPaths &&
              !playing &&
              nextSet &&
              Object.entries(set?.points ?? {}).map(([id, p]) => {
                const q = nextSet.points[id]
                if (!q) return null
                const x1 = sx(p.x)
                const y1 = sy(p.y)
                const x2 = sx(q.x)
                const y2 = sy(q.y)
                if (x1 === x2 && y1 === y2) return null
                return (
                  <g key={`p-${id}`}>
                    <line
                      data-trail="keluar"
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke="#e2e8f0"
                      strokeOpacity={0.45}
                      strokeWidth={0.22}
                      strokeDasharray="1 1"
                      markerEnd="url(#dk-panah-presenter)"
                    />
                    {/* titik hantu: ke mana pemain akan berdiri */}
                    <circle
                      data-ghost="keluar"
                      cx={x2}
                      cy={y2}
                      r={uk(0.9)}
                      fill="none"
                      stroke="#e2e8f0"
                      strokeOpacity={0.5}
                      strokeWidth={uk(0.18)}
                      strokeDasharray="0.6 0.5"
                    />
                  </g>
                )
              })}

            {/* Titik pemain */}
            {Object.entries(set?.points ?? {}).map(([id, p]) => {
              const m = rosterById.get(id)
              if (!m) return null
              const rad = (facingDeg(p.facing, p.facingDeg) * Math.PI) / 180
              const fx = Math.sin(rad) * -uk(2)
              const fy = Math.cos(rad) * uk(2)
              const warna = sectionDot(m.section)
              return (
                <g
                  key={id}
                  ref={dotRefCb(id)}
                  data-pemain={id}
                  // K2 — tetap terlihat, tapi redup: pemain perlu tahu di mana
                  // rekan mereka berada tanpa melihat mereka ikut berjalan.
                  opacity={seksi === 'semua' || anggotaSeksi.has(id) ? 1 : 0.22}
                >
                  <line
                    x1={sx(p.x)}
                    y1={sy(p.y)}
                    x2={sx(p.x) + fx}
                    y2={sy(p.y) + fy}
                    stroke={warna}
                    strokeWidth={0.5}
                  />
                  <circle data-titik="1" cx={sx(p.x)} cy={sy(p.y)} r={uk(1.35)} fill={warna} stroke="#0b1120" strokeWidth={uk(0.22)} />
                  {showCodes && (
                    <text
                      x={sx(p.x)}
                      y={sy(p.y) + uk(0.52)}
                      textAnchor="middle"
                      fontSize={uk(1.35)}
                      fill="#0b1120"
                      style={{ fontWeight: 800, pointerEvents: 'none' }}
                    >
                      {m.code}
                    </text>
                  )}
                </g>
              )
            })}
          </g>
        </svg>
      </div>

      {/* Kontrol besar — mudah dipakai sambil berdiri */}
      <div className="flex items-center gap-3 px-3 pb-3 pt-2 sm:px-5">
        <button
          type="button"
          className={bigBtn}
          onClick={goPrev}
          disabled={idx === 0}
          title="Set sebelumnya"
          data-testid="presenter-sebelumnya"
        >
          ‹
        </button>
        <button
          type="button"
          className="h-16 flex-1 rounded-2xl bg-emerald-600 text-lg font-semibold text-white active:scale-[.98] disabled:opacity-40"
          onClick={() => setPlaying((p) => !p)}
          disabled={!nextSet}
          title="Mainkan perpindahan ke set berikutnya"
          data-testid="presenter-mainkan"
        >
          {playing ? 'Jeda' : `Mainkan${set?.counts ? ` (${set.counts} ct)` : ''}`}
          {/* M1 — tempo yang benar-benar dipakai set ini (dari lagu kalau ditautkan) */}
          <span className="sr-only" data-testid="tempo-presenter">
            {tempoUntuk(idx)}
          </span>
        </button>
        <button
          type="button"
          className={bigBtn}
          onClick={goNext}
          disabled={idx >= ordered.length - 1}
          title="Set berikutnya"
          data-testid="presenter-berikutnya"
        >
          ›
        </button>
      </div>

      {/* B3 — Urutan latihan: jalankan semua set otomatis mengikuti tempo */}
      <div className="flex items-center gap-2 px-3 pb-1 sm:px-5">
        <button
          type="button"
          data-testid="tombol-urutan"
          onClick={mulaiUrutan}
          disabled={ordered.length < 2}
          className={
            'h-11 flex-1 rounded-xl border text-sm font-semibold active:scale-[.98] disabled:opacity-40 ' +
            (urutan
              ? 'border-amber-500/40 bg-amber-500/15 text-amber-200'
              : 'border-slate-700 bg-slate-900 text-slate-200')
          }
          title="Mainkan semua set berurutan mengikuti tempo (R)"
        >
          {urutan ? `⏸ Urutan berjalan · ${idx + 1}/${ordered.length}` : '▶▶ Urutan latihan'}
        </button>
        <span className="whitespace-nowrap text-[11px] tabular-nums text-slate-400" data-testid="info-urutan">
          <span data-live-count>Count 0/{set?.counts ?? 0}</span>
        </span>
      </div>

      {/*
        K2 — Pilih section yang dilatih.

        Hanya ditampilkan kalau drill punya lebih dari satu section: untuk tim
        yang seluruhnya satu section, baris ini cuma menambah keruwetan.
      */}
      {daftarSeksi.length > 1 && (
        <div
          className="flex items-center gap-1.5 overflow-x-auto px-3 pb-1 sm:px-5"
          data-testid="baris-seksi"
        >
          <span className="shrink-0 text-[11px] text-slate-500">Latih:</span>
          <Chip
            data-testid="chip-seksi-semua"
            active={seksi === 'semua'}
            onClick={() => setSeksi('semua')}
          >
            Semua
          </Chip>
          {daftarSeksi.map((k) => (
            <Chip
              key={k}
              data-testid={`chip-seksi-${k}`}
              active={seksi === k}
              onClick={() => setSeksi(k)}
            >
              {sectionLabel(k)}
            </Chip>
          ))}
        </div>
      )}

      {/*
        K3 — checklist kemajuan.

        Satu pip per set: bercentang kalau sudah dikuasai, dan bisa diklik
        untuk melompat ke set itu. Jadi "menyambung latihan minggu lalu"
        tinggal melihat pip mana yang masih kosong.
      */}
      <div
        className="flex items-center gap-1.5 overflow-x-auto px-3 pb-1 sm:px-5"
        data-testid="baris-kemajuan"
      >
        <span className="shrink-0 text-[11px] text-slate-500">Kemajuan:</span>
        {ordered.map((s, i) => {
          const selesai = setSelesai(kemajuan, s.id, daftarSeksi)
          return (
            <button
              key={s.id}
              type="button"
              data-testid={`pip-kemajuan-${i}`}
              data-selesai={selesai ? '1' : '0'}
              onClick={() => setIdx(i)}
              title={s.name || `Set ${i + 1}`}
              className={
                'grid h-6 w-6 shrink-0 place-items-center rounded-md border text-[11px] tabular-nums active:scale-[.97] ' +
                (selesai
                  ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200'
                  : i === idx
                    ? 'border-sky-500/50 bg-sky-500/15 text-sky-200'
                    : 'border-slate-700 bg-slate-900 text-slate-500')
              }
            >
              {selesai ? '✓' : i + 1}
            </button>
          )
        })}
        <span
          className="shrink-0 pl-1 text-[11px] tabular-nums text-slate-400"
          data-testid="info-kemajuan"
        >
          {jumlahSelesai}/{ordered.length}
        </span>
      </div>

      {/* Pengaturan tampilan */}
      <div className="flex flex-wrap items-center gap-2 px-3 pb-4 sm:px-5">
        <Chip active={showCodes} onClick={() => setShowCodes((v) => !v)}>
          Kode
        </Chip>
        <Chip active={showPaths} onClick={() => setShowPaths((v) => !v)}>
          Jalur
        </Chip>
        <Chip active={rotated} onClick={() => setRotated((v) => !v)}>
          Putar layar
        </Chip>
        <Chip active={tapNext} onClick={() => setTapNext((v) => !v)}>
          Ketuk = maju
        </Chip>
        <Chip active={ulangUrutan} onClick={() => setUlangUrutan((v) => !v)}>
          ↻ Ulang urutan
        </Chip>
        <Chip active={diam > 0} onClick={() => setDiam((v) => (v === 0 ? 2 : v === 2 ? 4 : v === 4 ? 8 : 0))}>
          Diam {diam} ct
        </Chip>
        <Chip data-testid="chip-klik" active={klik} onClick={() => setKlik((v) => !v)}>
          Klik
        </Chip>
        <Chip
          data-testid="chip-asisten"
          active={asisten}
          onClick={() => setAsisten((v) => !v)}
          title="Asisten mengumumkan tiap perpindahan & menghitung mundur sebelum bergerak"
        >
          Asisten
        </Chip>
        <Chip
          data-testid="chip-kuasai"
          active={sudahKuasai}
          onClick={centangSetIni}
          title={
            seksi === 'semua'
              ? 'Tandai set ini sudah dikuasai seluruh formasi'
              : `Tandai set ini sudah dikuasai oleh ${sectionLabel(seksi)}`
          }
        >
          ✓ Kuasai{seksi === 'semua' ? '' : ` ${sectionLabel(seksi)}`}
        </Chip>
        <Chip
          data-testid="chip-ulang-perpindahan"
          active={ulangPerpindahan}
          onClick={() => setUlangPerpindahan((v) => !v)}
          title="Ulangi perpindahan ini terus, tanpa maju ke set berikutnya"
        >
          ↻ Ulang terus
        </Chip>
        <Chip
          data-testid="chip-kontras"
          active={tampilan.kontras}
          onClick={() => setTampilan(ubahTampilan({ kontras: !tampilan.kontras }))}
        >
          Kontras
        </Chip>
        <Chip
          data-testid="chip-huruf"
          active={tampilan.besar}
          onClick={() => setTampilan(ubahTampilan({ besar: !tampilan.besar }))}
        >
          Huruf
        </Chip>
        <span className="ml-auto hidden text-[11px] text-slate-500 sm:block">
          ← → ganti set · Spasi mainkan · R urutan latihan · Esc tutup
        </span>
      </div>

      {/*
        Lapisan kunci ditaruh paling akhir supaya ia menutupi seluruh
        presenter — termasuk kanvas, pip kemajuan, dan baris chip. Sentuhan
        ditahan olehnya; papan ketik ditahan oleh pakaiKunciLayar.
      */}
      {layarTerkunci && <LayarTerkunci onBuka={bukaLayar} />}
    </div>
  )
}

/** Tombol kecil bergaya "chip" untuk pengaturan tampilan presenter. */
function Chip({
  active,
  onClick,
  children,
  ...rest
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...rest}
      onClick={onClick}
      className={
        'rounded-full border px-3 py-1.5 text-xs active:scale-[.97] ' +
        (active
          ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200'
          : 'border-slate-700 bg-slate-900 text-slate-400')
      }
    >
      {children}
    </button>
  )
}
