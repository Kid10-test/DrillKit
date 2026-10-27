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
import {
  SPESIFIKASI_KERTAS_PARTITUR,
  siapkanSvgHalamanCetak,
  zoomUntukSkalaCetak,
  type SkalaCetakPartitur,
  type UkuranKertasPartitur,
} from './partiturCetak'
import {
  petakanKotakBiramaSumber,
  type BiramaSumberMentah,
  type KotakBiramaPiksel,
  type KotakPikselMentah,
} from './partiturFrasa'

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

export interface KotakBiramaRender extends KotakBiramaPiksel {
  /** Nomor birama sumber di MusicXML (mis. 0 untuk anacrusis, 1..N) — nama bidang kompatibel #11b. */
  nomorBirama: number
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
  /**
   * Daftar ID `<score-part>` (`idXml`) yang ingin ditampilkan (#11c).
   * Bila `null` / `undefined` / kosong, seluruh instrumen digambar (*Full score*).
   */
  filterIdXml?: string[] | null
  /** Sinyal pembatalan saat lagu berganti, zoom diubah, atau panel ditutup. */
  sinyal?: AbortSignal
  /** Dipanggil setiap gelombang sistem selesai digambar. */
  onProgres?: (progres: ProgresRenderPartitur) => void
}

export interface OpsiRenderCetakPartitur {
  /** Isi MusicXML sebagai `Blob`, `Uint8Array`, atau teks. */
  sumber: Blob | Uint8Array | string
  /** Judul cadangan bila di dalam XML belum tertulis judul. */
  judulCadangan?: string
  /** Daftar ID `<score-part>` yang ingin dicetak (`null`/kosong = *Full score*). */
  filterIdXml?: string[] | null
  /** Ukuran halaman cetak (`A4_P`, `A4_L`, atau `A5_L` buku saku / *lyre*). */
  ukuranKertas: UkuranKertasPartitur
  /** Kerapatan ukuran notasi pada lembaran cetak (bawaan `'normal'`). */
  skala?: SkalaCetakPartitur
  /** Sinyal pembatalan saat pengguna menutup modal atau mengganti pengaturan. */
  sinyal?: AbortSignal
}

export type HasilRenderCetakPartitur =
  | {
      ok: true
      halamanSvg: string[]
      jumlahPartTampil: number
      jumlahBirama: number
    }
  | {
      ok: false
      dibatalkan?: boolean
      galat: string
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

/* ------------------------ Penyaringan Instrumen ------------------------- */

function terapkanFilterInstrumenOsmd(
  osmd: InstanceType<ModulOsmd['OpenSheetMusicDisplay']>,
  filterIdXml?: string[] | null,
): { ok: true; jumlahTampil: number } | { ok: false; galat: string } {
  const daftarInst = osmd.Sheet?.Instruments ?? []
  if (!filterIdXml || filterIdXml.length === 0) {
    return { ok: true, jumlahTampil: daftarInst.length }
  }

  const setDipilih = new Set(filterIdXml)
  let jumlahTampil = 0
  for (let idx = 0; idx < daftarInst.length; idx += 1) {
    const inst = daftarInst[idx]
    const idInst = inst.IdString ?? String(idx + 1)
    const dipilih = setDipilih.has(idInst)
    inst.Visible = dipilih
    for (const st of inst.Staves ?? []) {
      st.Visible = dipilih
    }
    if (dipilih) jumlahTampil += 1
  }

  if (jumlahTampil === 0) {
    return {
      ok: false,
      galat: 'Part yang dipilih tidak ditemukan di dalam partitur ini.',
    }
  }

  // Bila tepat 1 instrumen tampil, matikan label kiri paranada yang berulang
  // di setiap baris agar paranada memperoleh lebar penuh (terutama di layar HP
  // dan ukuran buku saku A5); nama part sudah jelas di tajuk/bilah filter.
  if (jumlahTampil === 1) {
    osmd.setOptions({ drawPartNames: false, drawPartAbbreviations: false })
  }

  // Wajib: `osmd.load()` sudah menjalankan `updateGraphic()` saat semua part
  // masih Visible = true; merakit ulang lembar grafis sekarang juga memicu
  // penggabungan istirahat multi-birama otomatis khusus part yang tampil.
  osmd.updateGraphic()
  return { ok: true, jumlahTampil }
}

/* ------------------------ Ekstraksi Info Sesi --------------------------- */

function ukurPetaKotakGrafisSvg(wadah: HTMLElement): Map<string, KotakPikselMentah> {
  const peta = new Map<string, KotakPikselMentah>()
  const rectWadah = wadah.getBoundingClientRect()
  const elemenBirama = wadah.querySelectorAll('g.vf-measure')

  for (let i = 0; i < elemenBirama.length; i += 1) {
    const el = elemenBirama[i]
    const id = el.getAttribute('id')
    if (!id) continue
    const r = el.getBoundingClientRect()
    if (r.width <= 0 && r.height <= 0) continue

    const x = r.left - rectWadah.left
    const y = r.top - rectWadah.top
    const kanan = x + r.width
    const bawah = y + r.height
    const lama = peta.get(id)
    if (!lama) {
      peta.set(id, { x, y, lebar: r.width, tinggi: r.height })
    } else {
      const xMin = Math.min(lama.x, x)
      const yMin = Math.min(lama.y, y)
      const xMaks = Math.max(lama.x + lama.lebar, kanan)
      const yMaks = Math.max(lama.y + lama.tinggi, bawah)
      peta.set(id, {
        x: xMin,
        y: yMin,
        lebar: xMaks - xMin,
        tinggi: yMaks - yMin,
      })
    }
  }

  return peta
}

function kumpulkanInfoSesi(
  osmd: InstanceType<ModulOsmd['OpenSheetMusicDisplay']>,
  wadah: HTMLElement,
  tataLetak: ModeTataLetakPartitur,
  zoom: number,
): HasilSesiPartitur {
  const daftarInst = osmd.Sheet?.Instruments ?? []
  const instrumen: InfoInstrumenRender[] = daftarInst.map((inst, indeks) => ({
    indeks,
    idXml: inst.IdString ?? String(indeks + 1),
    nama: inst.NameLabel?.text || inst.Name || `Part ${indeks + 1}`,
    singkatan: inst.PartAbbreviation || '',
    tampil: typeof inst.isVisible === 'function' ? inst.isVisible() : inst.Visible !== false,
  }))

  const sumberBirama = osmd.Sheet?.SourceMeasures ?? []
  const daftarBarisGrafis = osmd.GraphicSheet?.MeasureList ?? []
  const petaKotakGrafis = ukurPetaKotakGrafisSvg(wadah)

  const daftarSumberMentah: BiramaSumberMentah[] = sumberBirama.map((sm, idx) => {
    const nomorBiramaXml =
      typeof sm.MeasureNumberXML === 'number' ? sm.MeasureNumberXML : sm.MeasureNumber
    const indeksUrut = typeof sm.measureListIndex === 'number' ? sm.measureListIndex : idx
    const barisGrafis = daftarBarisGrafis[idx]
    const gmPertama = Array.isArray(barisGrafis)
      ? barisGrafis.find(
          (gm) =>
            gm &&
            !gm.IsExtraGraphicalMeasure &&
            typeof gm.MeasureNumber === 'number' &&
            gm.MeasureNumber >= 0,
        )
      : undefined
    const idGrafis = gmPertama ? String(gmPertama.MeasureNumber) : null
    const multiRest = (sm as unknown as { multipleRestMeasures?: number }).multipleRestMeasures
    return {
      indeksUrut,
      nomorBiramaXml,
      idGrafis,
      ...(typeof multiRest === 'number' && multiRest > 1 ? { jumlahMultiRest: multiRest } : {}),
    }
  })

  const kotakTerpeta = petakanKotakBiramaSumber(daftarSumberMentah, petaKotakGrafis)
  const birama: KotakBiramaRender[] =
    kotakTerpeta.length > 0
      ? kotakTerpeta.map((k) => ({
          ...k,
          nomorBirama: k.nomorBiramaXml,
        }))
      : daftarSumberMentah.map((sm, idx) => ({
          nomorBirama: sm.nomorBiramaXml,
          nomorBiramaXml: sm.nomorBiramaXml,
          birama: idx + 1,
          indeksUrut: sm.indeksUrut,
          x: 0,
          y: 0,
          lebar: 0,
          tinggi: 0,
        }))

  const jumlahBiramaGrafis =
    daftarBarisGrafis.length > 0
      ? daftarBarisGrafis.filter((baris) => Array.isArray(baris) && baris.some(Boolean)).length
      : birama.length

  return {
    jumlahHalaman: osmd.GraphicSheet?.MusicPages?.length ?? 0,
    jumlahBiramaGrafis,
    tataLetak,
    zoom,
    instrumen,
    birama,
  }
}

/* ----------------------------- Fungsi Utama ----------------------------- */

/**
 * Muat OSMD secara malas dan gambar *full score* atau subset *part* ke dalam
 * `wadah` secara bertahap dengan warna hex murni (`#ffffff` / `#0f172a`).
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
    filterIdXml,
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

    const saring = terapkanFilterInstrumenOsmd(osmd, filterIdXml)
    if (!saring.ok) {
      osmd.clear()
      wadah.innerHTML = ''
      return { ok: false, galat: saring.galat }
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

    const sesi = kumpulkanInfoSesi(osmd, wadah, tataLetak, osmd.Zoom)
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

/* --------------------- Render Paginasi Halaman Cetak -------------------- */

/**
 * Gambar halaman-halaman `<svg>` terpaginasi (`A4_P`, `A4_L`, atau `A5_L`) di
 * dalam wadah lepas-layar berukuran baku dengan warna hex murni (`#ffffff` /
 * `#0f172a`), lengkap dengan `viewBox` responsif siap bungkus HTML cetak (#11c).
 */
export async function renderHalamanCetakPartitur(
  opsi: OpsiRenderCetakPartitur,
): Promise<HasilRenderCetakPartitur> {
  const {
    sumber,
    judulCadangan,
    filterIdXml,
    ukuranKertas,
    skala = 'normal',
    sinyal,
  } = opsi

  if (sinyal?.aborted) {
    return { ok: false, dibatalkan: true, galat: 'Dibatalkan' }
  }

  const siap = await siapkanXmlUntukOsmd(sumber)
  if (!siap.ok) {
    return { ok: false, galat: siap.galat }
  }
  if (sinyal?.aborted) {
    return { ok: false, dibatalkan: true, galat: 'Dibatalkan' }
  }

  let modulOsmd: ModulOsmd
  try {
    modulOsmd = await muatModulOsmd()
  } catch (e) {
    const rincian = e instanceof Error ? e.message : String(e)
    return { ok: false, galat: `Gagal memuat mesin perender partitur: ${rincian}` }
  }
  if (sinyal?.aborted) {
    return { ok: false, dibatalkan: true, galat: 'Dibatalkan' }
  }

  const OpenSheetMusicDisplay = ambilKelasOsmd(modulOsmd)
  const spekKertas = SPESIFIKASI_KERTAS_PARTITUR[ukuranKertas]

  // Wadah sementara di luar tampilan dengan lebar piksel baku agar paginasi A4/A5
  // identik baik saat dicetak dari layar HP 360 px maupun monitor desktop lebar.
  const wadah = document.createElement('div')
  wadah.setAttribute('aria-hidden', 'true')
  wadah.style.cssText = [
    'position:fixed',
    'left:-10000px',
    'top:0',
    `width:${spekKertas.lebarRenderPx}px`,
    'visibility:hidden',
    'pointer-events:none',
    'overflow:hidden',
    `background:${WARNA_PARTITUR_HEX.kertas}`,
    `color:${WARNA_PARTITUR_HEX.tinta}`,
  ].join(';')
  document.body.appendChild(wadah)

  let osmd: InstanceType<ModulOsmd['OpenSheetMusicDisplay']> | null = null
  try {
    osmd = new OpenSheetMusicDisplay(wadah, {
      backend: 'svg',
      autoResize: false,
      disableCursor: true,
      drawingParameters: ukuranKertas === 'A5_L' ? 'compacttight' : 'default',
      pageFormat: ukuranKertas,
      renderSingleHorizontalStaffline: false,
      // Tajuk judul, pengarang, dan nama bagian digambar rapi oleh kop HTML
      // cetak (`htmlCetakPartitur`), sehingga ruang vertikal kertas (terutama
      // buku saku A5) sepenuhnya dipakai untuk paranada tanpa judul ganda.
      drawCredits: false,
      drawTitle: false,
      drawSubtitle: false,
      drawComposer: false,
      drawLyricist: false,
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

    osmd.setLogLevel('silent')
    osmd.EngravingRules.PageBackgroundColor = WARNA_PARTITUR_HEX.kertas

    await osmd.load(siap.dok, judulCadangan)
    if (sinyal?.aborted) {
      return { ok: false, dibatalkan: true, galat: 'Dibatalkan' }
    }

    const saring = terapkanFilterInstrumenOsmd(osmd, filterIdXml)
    if (!saring.ok) {
      return { ok: false, galat: saring.galat }
    }

    osmd.Zoom = jepitZoom(zoomUntukSkalaCetak(skala, ukuranKertas))

    if (typeof osmd.renderNext === 'function') {
      for (;;) {
        if (sinyal?.aborted) {
          return { ok: false, dibatalkan: true, galat: 'Dibatalkan' }
        }
        const langkah = osmd.renderNext({ systems: 3 })
        if (langkah.done) break
        await jedaBingkaiBerikutnya()
      }
    } else {
      osmd.render()
    }

    if (sinyal?.aborted) {
      return { ok: false, dibatalkan: true, galat: 'Dibatalkan' }
    }

    const halamanSvg = Array.from(wadah.querySelectorAll('svg'))
      .map((el) => siapkanSvgHalamanCetak(el.outerHTML))
      .filter((s) => s.length > 0)

    if (halamanSvg.length === 0) {
      return {
        ok: false,
        galat: 'Tidak ada halaman notasi SVG yang berhasil disusun untuk dicetak.',
      }
    }

    return {
      ok: true,
      halamanSvg,
      jumlahPartTampil: saring.jumlahTampil,
      jumlahBirama: osmd.Sheet?.SourceMeasures?.length ?? 0,
    }
  } catch (e) {
    if (sinyal?.aborted) {
      return { ok: false, dibatalkan: true, galat: 'Dibatalkan' }
    }
    const rincian = e instanceof Error ? e.message : String(e)
    return {
      ok: false,
      galat: `Partitur gagal disusun untuk cetak: ${rincian}`,
    }
  } finally {
    try {
      osmd?.clear()
    } catch {
      // abaikan
    }
    wadah.remove()
  }
}
