/**
 * #11b — Pembungkus *lazy-load* dan perender partitur `opensheetmusicdisplay`.
 *
 * Seluruh sentuhan ke pustaka `opensheetmusicdisplay` (OSMD + VexFlow) dikurung
 * di berkas ini supaya:
 *
 * 1. ***Code splitting* terjaga ketat (keputusan D1 rancangan 11b):** bundel
 *    OSMD (~1,42 MB minified / ~355 KB gzip) diimpor secara dinamis hanya saat
 *    pengguna benar-benar membuka tampilan notasi MusicXML — tidak membebani
 *    muatan awal Dasbor, Anggota, Absensi, Drill, maupun halaman Musik biasa.
 * 2. **Warna hex murni terkunci di satu tempat (keputusan D2):** kertas putih
 *    `#ffffff` dengan tinta `#0f172a` tanpa satu pun `oklch()` / `color-mix()`,
 *    tajam dibaca di bawah matahari lapangan dan seragam dengan cetak di 11c.
 * 3. **Render bertahap anti-beku (keputusan D4):** menggambar sistem demi
 *    sistem lewat `osmd.renderNext()` dengan jeda antar-bingkai sehingga detak
 *    metronom WebAudio dan tombol kendali tetap responsif pada skor besar,
 *    serta bisa dibatalkan bersih kapan saja lewat `AbortSignal`.
 * 4. **Menambal dua keterbatasan bawaan OSMD sebelum `load()`:**
 *    - mengonversi `<score-timewise>` menjadi `<score-partwise>` (OSMD hanya
 *      membaca susunan *partwise*), dan
 *    - menormalisasi entitas bernama umum HTML (seperti `&nbsp;`) menjadi
 *      rujukan angka XML (`&#160;`) bila pengurai XML ketat menolaknya, sehingga
 *      berkas D4 dari `#11a` tetap berhasil dirender notasinya.
 */
import { teksPartitur } from './partitur'

/* ------------------------------- Konstanta ------------------------------ */

export const WARNA_PARTITUR_HEX = {
  kertas: '#ffffff',
  tinta: '#0f172a',
  tintaRedup: '#475569',
} as const

export const ZOOM_BAWAAN = 1
export const ZOOM_MIN = 0.6
export const ZOOM_MAKS = 1.6
export const ZOOM_LANGKAH = 0.15
export const KUNCI_SIMPAN_ZOOM = 'drillkit_partitur_zoom'

/* --------------------------------- Tipe --------------------------------- */

export type ModeTataLetakPartitur = 'vertikal' | 'mendatar'

export interface ProgresRenderPartitur {
  selesai: boolean
  biramaTerender: number
  totalBirama: number
}

export interface InfoInstrumenRender {
  indeks: number
  idXml: string
  nama: string
  singkatan: string
  tampil: boolean
}

export interface KotakBiramaRender {
  /** Nomor birama sumber di MusicXML (mis. 0 untuk anacrusis, 1..N). */
  nomorBirama: number
  /** Indeks urut 0-based di daftar birama OSMD (`measureListIndex`). */
  indeksUrut: number
}

export interface HasilSesiPartitur {
  jumlahHalaman: number
  jumlahBiramaGrafis: number
  tataLetak: ModeTataLetakPartitur
  zoom: number
  instrumen: InfoInstrumenRender[]
  birama: KotakBiramaRender[]
}

export type HasilRenderPartitur =
  | {
      ok: true
      sesi: HasilSesiPartitur
      bersihkan: () => void
    }
  | {
      ok: false
      dibatalkan?: boolean
      galat: string
    }

export interface OpsiRenderPartitur {
  /** Elemen pembungkus tempat OSMD menaruh elemen `<svg>`. */
  wadah: HTMLElement
  /** Isi MusicXML sebagai `Blob`, `Uint8Array`, atau teks. */
  sumber: Blob | Uint8Array | string
  /** Judul cadangan bila di dalam XML belum tertulis judul. */
  judulCadangan?: string
  /** Faktor skala 0.6 – 1.6 (bawaan 1.0). */
  zoom?: number
  /** `'vertikal'` (lembar bertumpuk ke bawah) atau `'mendatar'` (satu baris panjang). */
  tataLetak?: ModeTataLetakPartitur
  /** Sinyal pembatalan saat lagu berganti, zoom diubah, atau panel ditutup. */
  sinyal?: AbortSignal
  /** Dipanggil setiap gelombang sistem selesai digambar. */
  onProgres?: (progres: ProgresRenderPartitur) => void
}

/* ----------------------------- Utilitas Zoom ---------------------------- */

export function jepitZoom(nilai: number): number {
  if (!Number.isFinite(nilai)) return ZOOM_BAWAAN
  const bulat = Math.round(nilai * 100) / 100
  return Math.min(ZOOM_MAKS, Math.max(ZOOM_MIN, bulat))
}

export function bacaZoomTersimpan(): number {
  try {
    const mentah = localStorage.getItem(KUNCI_SIMPAN_ZOOM)
    if (!mentah) return ZOOM_BAWAAN
    return jepitZoom(Number.parseFloat(mentah))
  } catch {
    return ZOOM_BAWAAN
  }
}

export function simpanZoomPartitur(nilai: number): void {
  try {
    localStorage.setItem(KUNCI_SIMPAN_ZOOM, String(jepitZoom(nilai)))
  } catch {
    // penyimpanan diblokir — abaikan
  }
}

/* -------------------------- Pemuat Malas OSMD --------------------------- */

type ModulOsmd = typeof import('opensheetmusicdisplay')

let janjiOsmd: Promise<ModulOsmd> | null = null
let sudahTerunduh = false

/** Apakah modul OSMD sudah pernah dimuat pada sesi peramban ini? */
export function apakahOsmdSudahDimuat(): boolean {
  return sudahTerunduh
}

function ambilKelasOsmd(
  modul: ModulOsmd,
): ModulOsmd['OpenSheetMusicDisplay'] {
  if (typeof modul.OpenSheetMusicDisplay === 'function') {
    return modul.OpenSheetMusicDisplay
  }
  const def = (modul as unknown as { default?: { OpenSheetMusicDisplay?: ModulOsmd['OpenSheetMusicDisplay'] } }).default
  if (def && typeof def.OpenSheetMusicDisplay === 'function') {
    return def.OpenSheetMusicDisplay
  }
  throw new Error('Kelas OpenSheetMusicDisplay tidak ditemukan di bundel OSMD.')
}

/** Muat `opensheetmusicdisplay` sekali saja secara malas (*dynamic import*). */
export async function muatModulOsmd(): Promise<ModulOsmd> {
  if (!janjiOsmd) {
    janjiOsmd = import('opensheetmusicdisplay')
      .then((m) => {
        sudahTerunduh = true
        return m
      })
      .catch((err) => {
        // Kosongkan cache janji bila gagal (mis. luring sebelum SW selesai)
        // supaya percobaan berikutnya bisa mencoba lagi.
        janjiOsmd = null
        throw err
      })
  }
  return janjiOsmd
}

/* ------------------- Penyiapan & Normalisasi MusicXML ------------------- */

const ENTITAS_HTML_UMUM: Record<string, string> = {
  nbsp: '&#160;',
  ndash: '&#8211;',
  mdash: '&#8212;',
  lsquo: '&#8216;',
  rsquo: '&#8217;',
  ldquo: '&#8220;',
  rdquo: '&#8221;',
  copy: '&#169;',
  reg: '&#174;',
  hellip: '&#8230;',
}

/**
 * Ganti entitas bernama HTML umum di luar blok `<![CDATA[…]]>` menjadi rujukan
 * karakter numerik XML yang sah, supaya berkas D4 (seperti judul ber-`&nbsp;`)
 * tidak ditolak `DOMParser` XML peramban.
 */
function normalisasiEntitasHtmlDiXml(teks: string): string {
  const gantiPotongan = (potongan: string) =>
    potongan.replace(/&([a-zA-Z]+);/g, (utuh, nama: string) => ENTITAS_HTML_UMUM[nama] ?? utuh)

  if (!teks.includes('<![CDATA[')) return gantiPotongan(teks)

  let hasil = ''
  let pos = 0
  for (;;) {
    const awal = teks.indexOf('<![CDATA[', pos)
    if (awal < 0) {
      hasil += gantiPotongan(teks.slice(pos))
      break
    }
    hasil += gantiPotongan(teks.slice(pos, awal))
    const akhir = teks.indexOf(']]>', awal + 9)
    if (akhir < 0) {
      hasil += teks.slice(awal)
      break
    }
    hasil += teks.slice(awal, akhir + 3)
    pos = akhir + 3
  }
  return hasil
}

function ambilPesanParserError(dok: Document): string | null {
  const errEl = dok.querySelector('parsererror')
  if (!errEl) return null
  const mentah = (errEl.textContent ?? '').replace(/\s+/g, ' ').trim()
  return mentah ? mentah.slice(0, 220) : 'sintaks XML rusak atau terpotong'
}

/**
 * Ubah dokumen `<score-timewise>` menjadi `<score-partwise>` di memori.
 *
 * OSMD hanya menerima `<score-partwise>`, sedangkan MusicXML mengizinkan dua
 * susunan yang setara secara matematis (matriks birama × part ditransposisi
 * menjadi part × birama).
 */
function konversiTimewiseKePartwise(dokAsal: Document): Document {
  const akarAsal = dokAsal.documentElement
  const dokBaru = document.implementation.createDocument(null, 'score-partwise', null)
  const akarBaru = dokBaru.documentElement

  for (let i = 0; i < akarAsal.attributes.length; i += 1) {
    const attr = akarAsal.attributes[i]
    akarBaru.setAttribute(attr.name, attr.value)
  }

  const urutanPartId: string[] = []
  const sudahAda = new Set<string>()
  const catatPartId = (id: string) => {
    if (id && !sudahAda.has(id)) {
      sudahAda.add(id)
      urutanPartId.push(id)
    }
  }

  const daftarBiramaAsal: Element[] = []

  for (let i = 0; i < akarAsal.children.length; i += 1) {
    const anak = akarAsal.children[i]
    const nama = anak.localName || anak.tagName
    if (nama === 'measure') {
      daftarBiramaAsal.push(anak)
      for (let j = 0; j < anak.children.length; j += 1) {
        const sub = anak.children[j]
        if ((sub.localName || sub.tagName) === 'part') {
          catatPartId(sub.getAttribute('id') ?? '')
        }
      }
    } else {
      if (nama === 'part-list') {
        const daftarScorePart = anak.getElementsByTagName('score-part')
        for (let j = 0; j < daftarScorePart.length; j += 1) {
          catatPartId(daftarScorePart[j].getAttribute('id') ?? '')
        }
      }
      akarBaru.appendChild(dokBaru.importNode(anak, true))
    }
  }

  const petaElemenPart = new Map<string, Element>()
  for (const id of urutanPartId) {
    const elPart = dokBaru.createElement('part')
    elPart.setAttribute('id', id)
    akarBaru.appendChild(elPart)
    petaElemenPart.set(id, elPart)
  }

  for (const biramaAsal of daftarBiramaAsal) {
    for (let j = 0; j < biramaAsal.children.length; j += 1) {
      const partDiBirama = biramaAsal.children[j]
      if ((partDiBirama.localName || partDiBirama.tagName) !== 'part') continue
      const id = partDiBirama.getAttribute('id') ?? ''
      const wadahPart = petaElemenPart.get(id)
      if (!wadahPart) continue

      const biramaBaru = dokBaru.createElement('measure')
      for (let a = 0; a < biramaAsal.attributes.length; a += 1) {
        const attr = biramaAsal.attributes[a]
        biramaBaru.setAttribute(attr.name, attr.value)
      }
      for (let c = 0; c < partDiBirama.childNodes.length; c += 1) {
        biramaBaru.appendChild(dokBaru.importNode(partDiBirama.childNodes[c], true))
      }
      wadahPart.appendChild(biramaBaru)
    }
  }

  return dokBaru
}

/**
 * Pastikan sumber menjadi dokumen XML `<score-partwise>` yang siap diberikan ke
 * `osmd.load()`, atau kembalikan pesan galat yang jelas bila XML-nya rusak.
 *
 * Memberikan `Document` langsung ke `osmd.load(dok)` menghindari penguraian
 * `DOMParser` dua kali sekaligus mencegah OSMD salah mengira XML pendek tanpa
 * deklarasi `<?xml …?>` sebagai URL jaringan.
 */
async function siapkanXmlUntukOsmd(
  sumber: Blob | Uint8Array | string,
): Promise<{ ok: true; dok: Document } | { ok: false; galat: string }> {
  let mentah: string
  if (typeof sumber === 'string') {
    mentah = sumber.charCodeAt(0) === 0xfeff ? sumber.slice(1) : sumber
  } else if (sumber instanceof Uint8Array) {
    mentah = teksPartitur(sumber)
  } else {
    const ab = await sumber.arrayBuffer()
    mentah = teksPartitur(new Uint8Array(ab))
  }

  if (!mentah.trim()) {
    return { ok: false, galat: 'Berkas partitur kosong (tidak ada isi XML).' }
  }

  const parser = new DOMParser()
  let dok = parser.parseFromString(mentah, 'application/xml')
  let salahParse = ambilPesanParserError(dok)

  if (salahParse) {
    const sudahDinormalisasi = normalisasiEntitasHtmlDiXml(mentah)
    if (sudahDinormalisasi !== mentah) {
      dok = parser.parseFromString(sudahDinormalisasi, 'application/xml')
      salahParse = ambilPesanParserError(dok)
      if (!salahParse) mentah = sudahDinormalisasi
    }
  }

  if (salahParse) {
    return {
      ok: false,
      galat: `XML partitur rusak atau tidak lengkap (${salahParse}).`,
    }
  }

  const namaAkar = dok.documentElement?.localName || dok.documentElement?.tagName || ''
  if (namaAkar === 'score-timewise') {
    return { ok: true, dok: konversiTimewiseKePartwise(dok) }
  }
  if (namaAkar !== 'score-partwise') {
    return {
      ok: false,
      galat: `Elemen akar <${namaAkar || '?'}> bukan partitur MusicXML (<score-partwise> / <score-timewise>).`,
    }
  }

  return { ok: true, dok }
}

/* ----------------------- Penjadwal Antar-Bingkai ------------------------ */

/**
 * Serahkan satu giliran ke peramban di antara dua gelombang `renderNext` supaya
 * klik tombol dan penjadwal audio metronom tetap lancar, sambil memasang batas
 * 24 ms agar tetap maju cepat ketika tab berada di latar belakang / headless.
 */
function jedaBingkaiBerikutnya(): Promise<void> {
  return new Promise((selesai) => {
    let beres = false
    const rampung = () => {
      if (beres) return
      beres = true
      selesai()
    }
    const timer = window.setTimeout(rampung, 24)
    if (typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => {
        window.clearTimeout(timer)
        rampung()
      })
    }
  })
}

/* ------------------------ Ekstraksi Info Sesi --------------------------- */

function kumpulkanInfoSesi(
  osmd: InstanceType<ModulOsmd['OpenSheetMusicDisplay']>,
  tataLetak: ModeTataLetakPartitur,
  zoom: number,
): HasilSesiPartitur {
  const daftarInst = osmd.Sheet?.Instruments ?? []
  const instrumen: InfoInstrumenRender[] = daftarInst.map((inst, indeks) => ({
    indeks,
    idXml: inst.IdString ?? String(indeks + 1),
    nama: inst.NameLabel?.text || inst.Name || `Part ${indeks + 1}`,
    singkatan: inst.PartAbbreviation || '',
    tampil: inst.Visible !== false,
  }))

  const sumberBirama = osmd.Sheet?.SourceMeasures ?? []
  const birama: KotakBiramaRender[] = sumberBirama.map((sm, idx) => ({
    nomorBirama: typeof sm.MeasureNumberXML === 'number' ? sm.MeasureNumberXML : sm.MeasureNumber,
    indeksUrut: typeof sm.measureListIndex === 'number' ? sm.measureListIndex : idx,
  }))

  return {
    jumlahHalaman: osmd.GraphicSheet?.MusicPages?.length ?? 0,
    jumlahBiramaGrafis: osmd.GraphicSheet?.MeasureList?.length ?? birama.length,
    tataLetak,
    zoom,
    instrumen,
    birama,
  }
}

/* ----------------------------- Fungsi Utama ----------------------------- */

/**
 * Muat OSMD secara malas dan gambar *full score* ke dalam `wadah` secara
 * bertahap dengan warna hex murni (`#ffffff` / `#0f172a`).
 */
export async function renderPartiturMusicXml(
  opsi: OpsiRenderPartitur,
): Promise<HasilRenderPartitur> {
  const {
    wadah,
    sumber,
    judulCadangan,
    zoom = ZOOM_BAWAAN,
    tataLetak = 'vertikal',
    sinyal,
    onProgres,
  } = opsi

  if (sinyal?.aborted) {
    return { ok: false, dibatalkan: true, galat: 'Dibatalkan' }
  }

  try {
    const siap = await siapkanXmlUntukOsmd(sumber)
    if (!siap.ok) {
      return { ok: false, galat: siap.galat }
    }
    if (sinyal?.aborted) {
      return { ok: false, dibatalkan: true, galat: 'Dibatalkan' }
    }

    const modulOsmd = await muatModulOsmd()
    const OpenSheetMusicDisplay = ambilKelasOsmd(modulOsmd)
    if (sinyal?.aborted) {
      return { ok: false, dibatalkan: true, galat: 'Dibatalkan' }
    }

    // Kosongkan isi wadah lama sebelum merakit kanvas baru.
    wadah.innerHTML = ''
    const lebarWadah = wadah.clientWidth || wadah.offsetWidth || 800
    const modePadat = lebarWadah < 640

    const osmd = new OpenSheetMusicDisplay(wadah, {
      backend: 'svg',
      autoResize: false,
      disableCursor: true,
      drawingParameters: modePadat ? 'compacttight' : 'default',
      renderSingleHorizontalStaffline: tataLetak === 'mendatar',
      drawPartNames: true,
      drawPartAbbreviations: true,
      drawMeasureNumbers: true,
      defaultColorMusic: WARNA_PARTITUR_HEX.tinta,
      defaultColorNotehead: WARNA_PARTITUR_HEX.tinta,
      defaultColorStem: WARNA_PARTITUR_HEX.tinta,
      defaultColorRest: WARNA_PARTITUR_HEX.tinta,
      defaultColorLabel: WARNA_PARTITUR_HEX.tinta,
      defaultColorTitle: WARNA_PARTITUR_HEX.tinta,
      pageBackgroundColor: WARNA_PARTITUR_HEX.kertas,
    })

    // Senyapkan log internal OSMD ke konsol supaya berkas eksotis tidak
    // membanjiri console.error; semua galat nyata tetap ditangkap try/catch.
    osmd.setLogLevel('silent')
    osmd.EngravingRules.PageBackgroundColor = WARNA_PARTITUR_HEX.kertas

    await osmd.load(siap.dok, judulCadangan)
    if (sinyal?.aborted) {
      osmd.clear()
      wadah.innerHTML = ''
      return { ok: false, dibatalkan: true, galat: 'Dibatalkan' }
    }

    osmd.Zoom = jepitZoom(zoom)

    // Render bertahap: 2 sistem per bingkai pada mode vertikal, atau 12 birama
    // per bingkai pada mode mendatar. Bila metode `renderNext` tidak tersedia,
    // jatuh mulus ke `osmd.render()`.
    if (typeof osmd.renderNext === 'function') {
      const opsiBatch = tataLetak === 'mendatar' ? { measures: 12 } : { systems: 2 }
      for (;;) {
        if (sinyal?.aborted) {
          osmd.clear()
          wadah.innerHTML = ''
          return { ok: false, dibatalkan: true, galat: 'Dibatalkan' }
        }
        const langkah = osmd.renderNext(opsiBatch)
        onProgres?.({
          selesai: langkah.done,
          biramaTerender: langkah.renderedMeasures,
          totalBirama: langkah.totalMeasures,
        })
        if (langkah.done) break
        await jedaBingkaiBerikutnya()
      }
    } else {
      osmd.render()
      const total = osmd.Sheet?.SourceMeasures?.length ?? 0
      onProgres?.({ selesai: true, biramaTerender: total, totalBirama: total })
    }

    const sesi = kumpulkanInfoSesi(osmd, tataLetak, osmd.Zoom)
    const bersihkan = () => {
      try {
        osmd.clear()
      } catch {
        // sudah bersih — abaikan
      }
      wadah.innerHTML = ''
    }

    return { ok: true, sesi, bersihkan }
  } catch (e) {
    wadah.innerHTML = ''
    if (sinyal?.aborted) {
      return { ok: false, dibatalkan: true, galat: 'Dibatalkan' }
    }
    const rincian = e instanceof Error ? e.message : String(e)
    return {
      ok: false,
      galat: `Partitur tidak dapat digambar perender notasi: ${rincian}`,
    }
  }
}
