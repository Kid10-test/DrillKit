/**
 * v2.10.1 — Mesin pembaca rundown: tabel dari Google Docs / Word / Sheets /
 * WhatsApp → blok rencana latihan (`BlokLatihan[]`). Murni (tanpa DOM,
 * Dexie, atau React), diuji `qa/rundown-logika.mjs`.
 *
 * Alurnya satu untuk semua sumber:
 *
 *   sumber (HTML papan klip / ekspor Docs / .docx / teks) → tabel mentah
 *   → tebak peran kolom → baris → blok (durasi dari selisih jam) → pratinjau
 *
 * Kenapa durasi, bukan jam: rencana latihan DrillKit disimpan sebagai durasi
 * per blok (lihat `Session.rencanaLatihan`), supaya menggeser jam mulai sesi
 * menggeser semua blok. Jadi jam di rundown dipakai untuk menghitung durasi,
 * dan jam mulai/selesai rundown dikembalikan terpisah supaya jam sesi bisa
 * disesuaikan.
 *
 * Yang sengaja TIDAK dilakukan: menebak yang tidak tertulis. Jeda di antara
 * dua kegiatan menjadi blok "Jeda" tersendiri (bukan diam-diam ditambahkan
 * ke blok sebelumnya), dan setiap tebakan yang meragukan dilaporkan sebagai
 * peringatan di pratinjau.
 */
import type { BlokLatihan, CabangBlok, JenisBlok } from '../db/types'

/* --------------------------------- Tipe ---------------------------------- */

export interface TabelRundown {
  /** Judul tabel: teks terakhir sebelum tabel (mis. "Rundown P3 — Selasa 17 Nov"). */
  judul: string
  baris: string[][]
}

export type PeranKolom = 'jam' | 'mulai' | 'selesai' | 'durasi' | 'kegiatan' | 'pj' | 'tempat' | 'ket' | 'jenis'

export const PERAN_KOLOM: readonly PeranKolom[] = ['jam', 'mulai', 'selesai', 'durasi', 'kegiatan', 'jenis', 'pj', 'tempat', 'ket']

export const LABEL_PERAN: Record<PeranKolom, string> = {
  jam: 'Jam (rentang)',
  mulai: 'Jam mulai',
  selesai: 'Jam selesai',
  durasi: 'Durasi',
  kegiatan: 'Kegiatan',
  jenis: 'Jenis',
  pj: 'PJ / pemateri',
  tempat: 'Tempat',
  ket: 'Keterangan',
}

/** Indeks kolom per peran (`-1` = tidak ada), kolom per seksi, dan baris judul. */
export interface PetaRundown {
  kolom: Record<PeranKolom, number>
  /** Kolom yang isinya per seksi (blok paralel): kolom → id seksi. */
  seksi: { kolom: number; seksiIds: string[] }[]
  /** Indeks baris judul kolom; `-1` = tabel tanpa judul kolom. */
  judulBaris: number
}

export interface SeksiRundown {
  id: string
  label: string
}

export interface PeringatanRundown {
  kode: 'tanpa-jam' | 'jeda' | 'tumpang' | 'durasi-tebak' | 'durasi-nol' | 'lewat-tengah-malam' | 'tanpa-kegiatan' | 'durasi-beda'
  teks: string
}

export interface HasilRundown {
  blok: BlokLatihan[]
  /** "HH:MM" jam mulai rundown; `null` bila rundown tanpa jam. */
  mulai: string | null
  /** "HH:MM" jam selesai rundown; `null` bila tidak terbaca. */
  selesai: string | null
  peringatan: PeringatanRundown[]
  /** Baris data yang dibaca menjadi blok (tidak termasuk judul & baris kosong). */
  dibaca: number
}

/* --------------------------------- Teks ---------------------------------- */

const ENTITAS: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
  bull: '•',
  middot: '·',
  // Ekspor HTML Google Docs memakai entitas bernama untuk simbol yang lazim
  // di rundown ("3 × 9′", "2 × 600 ml", "→"). Tanpa daftar ini sel terbaca
  // mentah sebagai "3 &times; 9&prime;".
  times: '×',
  divide: '÷',
  prime: '′',
  Prime: '″',
  deg: '°',
  plusmn: '±',
  minus: '−',
  frac12: '½',
  frac14: '¼',
  frac34: '¾',
  sup2: '²',
  sup3: '³',
  le: '≤',
  ge: '≥',
  ne: '≠',
  asymp: '≈',
  larr: '←',
  rarr: '→',
  uarr: '↑',
  darr: '↓',
  harr: '↔',
  lArr: '⇐',
  rArr: '⇒',
  laquo: '«',
  raquo: '»',
  lsaquo: '‹',
  rsaquo: '›',
  sbquo: '‚',
  bdquo: '„',
  copy: '©',
  reg: '®',
  trade: '™',
  sect: '§',
  para: '¶',
  euro: '€',
  ensp: ' ',
  emsp: ' ',
  thinsp: ' ',
  shy: '',
  zwj: '',
  zwnj: '',
  eacute: 'é',
  egrave: 'è',
  ecirc: 'ê',
  euml: 'ë',
  aacute: 'á',
  agrave: 'à',
  auml: 'ä',
  iacute: 'í',
  oacute: 'ó',
  ouml: 'ö',
  uacute: 'ú',
  uuml: 'ü',
  ntilde: 'ñ',
  ccedil: 'ç',
  Eacute: 'É',
}

export function dekodeEntitas(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, k: string) => {
    if (k[0] === '#') {
      const n = k[1] === 'x' || k[1] === 'X' ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10)
      return Number.isFinite(n) && n > 0 ? String.fromCodePoint(n) : m
    }
    // Huruf besar-kecil bermakna (&prime; ′ lain dengan &Prime; ″), jadi cocokkan
    // persis dulu; bentuk huruf kecil hanya cadangan untuk &AMP;, &NBSP;, dst.
    return ENTITAS[k] ?? ENTITAS[k.toLowerCase()] ?? m
  })
}

/** Huruf kecil, tanpa diakritik & tanda baca — untuk mencocokkan judul kolom. */
function normal(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

const rapikanSel = (s: string) =>
  s
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim()

/* ---------------------------------- HTML ---------------------------------- */

/**
 * Ambil semua tabel dari HTML — isi papan klip saat menyalin tabel dari
 * Google Docs/Word/Sheets, atau hasil ekspor Google Docs ke HTML.
 *
 * Pengurai kecil buatan sendiri, bukan `DOMParser`, supaya modul ini tetap
 * murni dan bisa diuji di Node. Yang dipahami cukup yang dihasilkan Docs,
 * Word, dan Sheets: `<table>/<tr>/<td|th>` dengan `colspan`/`rowspan`,
 * `<br>` dan paragraf di dalam sel. Tabel bersarang diratakan ke sel induk.
 */
export function tabelDariHtml(html: string): TabelRundown[] {
  const bersih = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|head|title)\b[\s\S]*?<\/\1>/gi, '')
  const hasil: TabelRundown[] = []
  const reTabel = /<table\b[^>]*>|<\/table>/gi
  let kedalaman = 0
  let awal = -1
  let akhirSebelum = 0
  let teksSebelum = ''
  let m: RegExpExecArray | null
  while ((m = reTabel.exec(bersih))) {
    if (m[0][1] !== '/') {
      if (kedalaman === 0) {
        awal = m.index
        teksSebelum = bersih.slice(akhirSebelum, m.index)
      }
      kedalaman++
    } else if (kedalaman > 0) {
      kedalaman--
      if (kedalaman === 0 && awal >= 0) {
        const isi = bersih.slice(awal, m.index + m[0].length)
        const baris = barisTabelHtml(isi)
        if (baris.length) hasil.push({ judul: judulDariTeks(teksHtml(teksSebelum)), baris })
        akhirSebelum = m.index + m[0].length
        awal = -1
      }
    }
  }
  return hasil
}

/** Teks polos dari potongan HTML: blok & `<br>` jadi baris baru. */
export function teksHtml(html: string): string {
  return rapikanSel(
    dekodeEntitas(
      html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n')
        .replace(/<li\b[^>]*>/gi, '• ')
        .replace(/<[^>]+>/g, ''),
    ),
  )
}

function judulDariTeks(t: string): string {
  const baris = t.split('\n').map((x) => x.trim()).filter(Boolean)
  return (baris[baris.length - 1] ?? '').slice(0, 120)
}

function atributAngka(tag: string, nama: string): number {
  const m = new RegExp(`${nama}\\s*=\\s*["']?(\\d+)`, 'i').exec(tag)
  const n = m ? Number(m[1]) : 1
  return Number.isFinite(n) && n > 1 ? Math.min(n, 50) : 1
}

function barisTabelHtml(tabel: string): string[][] {
  // Buang pembungkus tabel terluar, lalu ratakan tabel bersarang.
  const dalam = tabel.replace(/^<table\b[^>]*>/i, '').replace(/<\/table>$/i, '')
  const barisMentah: { sel: { teks: string; col: number; row: number }[] }[] = []
  const reBaris = /<tr\b[^>]*>([\s\S]*?)(?=<tr\b|<\/tbody>|<\/thead>|<\/tfoot>|$)/gi
  let mb: RegExpExecArray | null
  // Tabel bersarang membuat <tr> palsu; ratakan dulu isinya menjadi teks.
  const rata = ratakanBersarang(dalam)
  while ((mb = reBaris.exec(rata))) {
    const sel: { teks: string; col: number; row: number }[] = []
    const reSel = /<(td|th)\b([^>]*)>([\s\S]*?)(?=<td\b|<th\b|<\/tr>|$)/gi
    let ms: RegExpExecArray | null
    while ((ms = reSel.exec(mb[1]))) {
      sel.push({
        teks: teksHtml(ms[3].replace(/<\/t[dh]>[\s\S]*$/i, '')),
        col: atributAngka(ms[2], 'colspan'),
        row: atributAngka(ms[2], 'rowspan'),
      })
    }
    if (sel.length) barisMentah.push({ sel })
  }
  // Susun kisi dengan colspan/rowspan: sel gabungan diisi ulang di tiap posisi.
  const kisi: string[][] = []
  const tertunda: Map<number, { teks: string; sisa: number }> = new Map()
  for (const b of barisMentah) {
    const out: string[] = []
    let c = 0
    const isiTertunda = () => {
      while (tertunda.has(c)) {
        const t = tertunda.get(c)!
        out[c] = t.teks
        t.sisa--
        if (t.sisa <= 0) tertunda.delete(c)
        c++
      }
    }
    for (const s of b.sel) {
      isiTertunda()
      for (let k = 0; k < s.col; k++) {
        out[c] = s.teks
        if (s.row > 1) tertunda.set(c, { teks: s.teks, sisa: s.row - 1 })
        c++
      }
    }
    isiTertunda()
    kisi.push(Array.from(out, (x) => x ?? ''))
  }
  return rapikanKisi(kisi)
}

/** Tabel di dalam sel diganti teksnya (sel per baris), supaya `<tr>` induk tetap utuh. */
function ratakanBersarang(html: string): string {
  let hasil = html
  for (let i = 0; i < 5; i++) {
    const baru = hasil.replace(/<table\b[^>]*>((?:(?!<table\b)[\s\S])*?)<\/table>/gi, (_m, isi: string) =>
      teksHtml(isi.replace(/<\/t[dh]>/gi, ' ').replace(/<\/tr>/gi, '<br>')).replace(/\n/g, '<br>'),
    )
    if (baru === hasil) break
    hasil = baru
  }
  return hasil
}

/** Samakan lebar baris & buang baris/kolom yang kosong seluruhnya. */
function rapikanKisi(kisi: string[][]): string[][] {
  const lebar = Math.max(0, ...kisi.map((b) => b.length))
  const penuh = kisi.map((b) => Array.from({ length: lebar }, (_, i) => b[i] ?? '')).filter((b) => b.some((x) => x.trim()))
  if (!penuh.length) return []
  const kolomIsi = Array.from({ length: lebar }, (_, i) => penuh.some((b) => b[i].trim()))
  return penuh.map((b) => b.filter((_, i) => kolomIsi[i]))
}

/* ---------------------------------- .docx --------------------------------- */

/**
 * `word/document.xml` (isi .docx) → HTML sederhana yang dimengerti
 * `tabelDariHtml`. Hanya tabel, paragraf, tab, dan jeda baris yang dibawa;
 * gaya diabaikan. `gridSpan` jadi `colspan`; `vMerge` lanjutan dibiarkan
 * kosong lalu diisi dari sel di atasnya.
 */
export function docxKeHtml(xml: string): string {
  const badan = /<w:body\b[^>]*>([\s\S]*)<\/w:body>/.exec(xml)?.[1] ?? xml
  let html = badan
    .replace(/<w:tbl\b[^>]*>/g, '<table>')
    .replace(/<\/w:tbl>/g, '</table>')
    .replace(/<w:tr\b[^>]*\/>/g, '')
    .replace(/<w:tr\b[^>]*>/g, '<tr>')
    .replace(/<\/w:tr>/g, '</tr>')
    .replace(/<w:tc\b[^>]*>([\s\S]*?)<\/w:tc>/g, (_m, isi: string) => {
      const span = /<w:gridSpan\b[^>]*w:val="(\d+)"/.exec(isi)?.[1]
      const lanjut = /<w:vMerge\b(?![^>]*w:val="restart")[^>]*\/>/.test(isi)
      return `<td${span ? ` colspan="${span}"` : ''}${lanjut ? ' data-vmerge="1"' : ''}>${isi}</td>`
    })
    .replace(/<w:tab\b[^>]*\/>/g, ' ')
    .replace(/<w:(br|cr)\b[^>]*\/>/g, '<br>')
    .replace(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g, '<span>$1</span>')
    .replace(/<w:p\b[^>]*\/>/g, '<p></p>')
    .replace(/<w:p\b[^>]*>/g, '<p>')
    .replace(/<\/w:p>/g, '</p>')
  // Sisa tag w:* (properti, run, dsb.) tidak membawa teks.
  html = html.replace(/<\/?w:[^>]*>/g, '').replace(/<\/?(mc|wp|a|pic|v|o|w14|w15|wps|wpg|m):[^>]*>/g, '')
  return isiVMerge(html)
}

/** Sel `vMerge` lanjutan (kosong) diberi teks sel tepat di atasnya. */
function isiVMerge(html: string): string {
  if (!html.includes('data-vmerge')) return html
  return html.replace(/<table>([\s\S]*?)<\/table>/g, (_m, isi: string) => {
    const baris = isi.split('</tr>')
    let atas: string[] = []
    const keluar = baris.map((b) => {
      const sel: string[] = []
      const r = b.replace(/<td([^>]*)>([\s\S]*?)<\/td>/g, (_s, attr: string, dalam: string) => {
        const i = sel.length
        const pakai = attr.includes('data-vmerge') && !teksHtml(dalam) ? (atas[i] ?? '') : dalam
        sel.push(pakai)
        return `<td${attr.replace(' data-vmerge="1"', '')}>${pakai}</td>`
      })
      if (sel.length) atas = sel
      return r
    })
    return `<table>${keluar.join('</tr>')}</table>`
  })
}

/* ---------------------------------- Teks ---------------------------------- */

const RE_JAM_AWAL = /^\s*(?:pk\.?|pukul|jam)?\s*(\d{1,2})[.:.](\d{2})/i

/**
 * Teks polos → tabel. Tiga bentuk:
 * - **TSV** — hasil salin dari Google Sheets/Excel (ada tab di tiap baris);
 * - **CSV** — berkas .csv (pemisah koma/titik koma);
 * - **baris bebas** — pesan WhatsApp: `17.30 – 17.40 Apel pembuka (PJ Danlat)`.
 */
export function tabelDariTeks(teks: string): TabelRundown[] {
  const bersih = teks.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
  const baris = bersih.split('\n').filter((b) => b.trim())
  if (!baris.length) return []
  const bertab = baris.filter((b) => b.includes('\t')).length
  if (bertab >= Math.max(2, Math.ceil(baris.length * 0.5))) {
    return [{ judul: '', baris: rapikanKisi(bacaTerpisah(bersih, '\t')) }]
  }
  const pertama = baris[0]
  const koma = (pertama.match(/,/g) ?? []).length
  const titikKoma = (pertama.match(/;/g) ?? []).length
  const pemisah = titikKoma > koma ? ';' : ','
  const nPemisah = Math.max(koma, titikKoma)
  const konsisten = nPemisah >= 1 && baris.slice(0, 8).every((b) => (b.match(pemisah === ',' ? /,/g : /;/g) ?? []).length >= nPemisah - 0)
  const berjam = baris.filter((b) => RE_JAM_AWAL.test(b)).length
  if (konsisten && !(berjam >= baris.length * 0.6 && nPemisah < 2)) {
    return [{ judul: '', baris: rapikanKisi(bacaTerpisah(bersih, pemisah)) }]
  }
  return [tabelDariBaris(baris)]
}

/** Pembaca CSV/TSV berkutip (sel boleh memuat baris baru). */
function bacaTerpisah(teks: string, pemisah: string): string[][] {
  const out: string[][] = []
  let kini: string[] = []
  let sel = ''
  let kutip = false
  for (let i = 0; i < teks.length; i++) {
    const ch = teks[i]
    if (kutip) {
      if (ch === '"') {
        if (teks[i + 1] === '"') {
          sel += '"'
          i++
        } else kutip = false
      } else sel += ch
    } else if (ch === '"' && !sel.trim()) {
      kutip = true
      sel = ''
    } else if (ch === pemisah) {
      kini.push(rapikanSel(sel))
      sel = ''
    } else if (ch === '\n') {
      kini.push(rapikanSel(sel))
      out.push(kini)
      kini = []
      sel = ''
    } else sel += ch
  }
  kini.push(rapikanSel(sel))
  if (kini.some((x) => x)) out.push(kini)
  return out
}

const RE_BARIS_BEBAS =
  /^\s*(?:[-•*·]\s*)?(?:pk\.?|pukul|jam)?\s*(\d{1,2}[.:]\d{2})(?:\s*(?:-|–|—|s\.?\s?d\.?|sd|sampai|hingga|to)\s*(\d{1,2}[.:]\d{2}|selesai))?\s*(?:wib|wita|wit)?\s*[-–—:|=>)]*\s*(.*)$/i

/** Baris WhatsApp → kolom Jam | Kegiatan | PJ | Tempat. */
function tabelDariBaris(baris: string[]): TabelRundown {
  const out: string[][] = [['Jam', 'Kegiatan', 'PJ', 'Tempat']]
  let judul = ''
  for (const b of baris) {
    const m = RE_BARIS_BEBAS.exec(b)
    if (!m) {
      if (out.length === 1) judul = b.trim()
      else out.push(['', b.trim().replace(/^[-•*·]\s*/, ''), '', ''])
      continue
    }
    const jam = m[2] ? `${m[1]}–${m[2]}` : m[1]
    let isi = m[3].trim()
    let pj = ''
    let tempat = ''
    const mPj = /\(?\b(?:pj|pic|pemateri|oleh|by)\b\s*[:.]?\s*([^()|;]+?)\)?\s*(?=$|[|;]|\(|@)/i.exec(isi)
    if (mPj) {
      pj = mPj[1].trim()
      isi = (isi.slice(0, mPj.index) + isi.slice(mPj.index + mPj[0].length)).trim()
    }
    const mTempat = /(?:@|\bdi\s+(?=lapangan|aula|gedung|ruang|lap\b|gor|sekre))\s*([^()|;]+?)\s*(?=$|[|;]|\()/i.exec(isi)
    if (mTempat) {
      tempat = mTempat[1].trim()
      isi = (isi.slice(0, mTempat.index) + isi.slice(mTempat.index + mTempat[0].length)).trim()
    }
    out.push([jam, isi.replace(/[\s\-–—|,;]+$/, '').replace(/^\(|\)$/g, ''), pj, tempat])
  }
  return { judul, baris: rapikanKisi(out) }
}

/* --------------------------------- Waktu ---------------------------------- */

/** "17.30" / "17:30" / "1730" / "pk 17.30" → menit sejak tengah malam. */
export function bacaSatuJam(s: string): number | null {
  const m = /(?:^|[^\d])(\d{1,2})[.:.](\d{2})(?!\d)/.exec(s) ?? /^\s*(\d{2})(\d{2})\s*$/.exec(s)
  if (!m) return null
  const j = Number(m[1])
  const mm = Number(m[2])
  if (j > 24 || mm > 59) return null
  return (j % 24) * 60 + mm
}

/**
 * Rentang jam dalam satu sel: "17.30 – 17.40", "17.30-17.40 WIB",
 * "17.30 s.d. 17.40", "17.30 - selesai", atau satu jam saja.
 */
export function bacaJam(s: string): { mulai: number | null; selesai: number | null } {
  const t = s.replace(/\u2013|\u2014/g, '-')
  const semua = [...t.matchAll(/(\d{1,2})[.:](\d{2})(?!\d)/g)]
    .map((m) => (Number(m[1]) <= 24 && Number(m[2]) <= 59 ? (Number(m[1]) % 24) * 60 + Number(m[2]) : null))
    .filter((x): x is number => x != null)
  if (!semua.length) {
    const satu = bacaSatuJam(t)
    return { mulai: satu, selesai: null }
  }
  return { mulai: semua[0], selesai: semua.length > 1 ? semua[1] : null }
}

/** "10'" / "10 menit" / "10 mnt" / "1 jam" / "1j 20m" / "1,5 jam" / "90" → menit. */
export function bacaDurasi(s: string): number | null {
  const t = normalDurasi(s)
  if (!t) return null
  let total = 0
  let ada = false
  const jam = /(\d+(?:[.,]\d+)?)\s*(?:jam|j|h|hr|hrs|hour|hours)\b/.exec(t)
  if (jam) {
    total += Number(jam[1].replace(',', '.')) * 60
    ada = true
  }
  const menit = /(\d+)\s*(?:menit|mnt|min|mins|minute|minutes|m|')(?![a-z])/.exec(t.replace(jam?.[0] ?? '\u0000', ' '))
  if (menit) {
    total += Number(menit[1])
    ada = true
  }
  if (!ada && /^\d{1,3}$/.test(t)) {
    total = Number(t)
    ada = true
  }
  return ada && total > 0 ? Math.round(total) : null
}

const normalDurasi = (s: string) =>
  s
    .toLowerCase()
    .replace(/[′’`]/g, "'")
    .replace(/±|kurang lebih|sekitar|kira-kira/g, '')
    .trim()

const fmt = (menit: number) => {
  const m = ((menit % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

/** Menit → "17.30" (gaya penulisan rundown). */
export const jamTitik = (menit: number) => fmt(menit).replace(':', '.')

/* --------------------------------- Jenis ---------------------------------- */

const POLA_JENIS: [JenisBlok, RegExp][] = [
  ['istirahat', /\b(ishoma|istirahat|break|rehat|makan|snack|sholat|shalat|salat|solat|maghrib|magrib|isya|isha|ashar|asar|dzuhur|zuhur|subuh|minum|coffee)\b/],
  ['pendingin', /\b(pendinginan|pendingin|cool(ing)? ?down|peregangan akhir|stretching akhir)\b/],
  ['pemanasan', /\b(pemanasan|warm ?up|warming ?up|peregangan|stretching|stretch|senam)\b/],
  ['apel', /\b(apel|upacara|absen|absensi|presensi|briefing|pembukaan|penutupan|pembuka|penutup|doa|evaluasi harian|check ?in|registrasi|kumpul|berkumpul)\b/],
  ['tes', /\b(tes|test|ujian|uji|penilaian|evaluasi|assessment|audisi|pass ?off|setoran)\b/],
  ['fisik', /\b(fisik|kebugaran|lari|jogging|push ?up|sit ?up|plank|sirkuit|circuit|kardio|cardio|conditioning|latsar fisik|core)\b/],
  ['teori', /\b(teori|materi kelas|kelas|sharing|diskusi|presentasi|pengenalan|sosialisasi|penjelasan|briefing materi|nonton|menonton|video)\b/],
  ['section', /\b(section|sectional|seksi|per section|per seksi|sectionals|kelompok instrumen)\b/],
  ['gabungan', /\b(gabungan|gabung|full ?run|run ?through|full band|tutti|ensemble penuh|run show)\b/],
  ['drill', /\b(drill|formasi|blocking|chart|dot|set \d+|cleaning)\b/],
  ['visual', /\b(visual|pbb|baris ?berbaris|sikap dasar|langkah|marching|mark ?time|basic visual|body|gerak dasar|hadap|balik kanan)\b/],
  ['musik', /\b(musik|music|lagu|ensemble|tuning|stem|nada|long ?tone|lip slur|rudiment|basic strokes|chop|latihan alat|instrumen|tiup)\b/],
]

/** Tebak ranah blok dari teks kegiatan. Tidak ada yang cocok → `lainnya`. */
export function tebakJenisBlok(teks: string): JenisBlok {
  const t = normal(teks)
  if (!t) return 'lainnya'
  for (const [jenis, pola] of POLA_JENIS) if (pola.test(t)) return jenis
  return 'lainnya'
}

/* ------------------------------- Tebak kolom ------------------------------- */

const POLA_JUDUL: [PeranKolom, RegExp][] = [
  ['mulai', /^(jam mulai|mulai|waktu mulai|start|dari)$/],
  ['selesai', /^(jam selesai|selesai|waktu selesai|end|sampai|hingga|jam akhir)$/],
  ['durasi', /^(durasi|lama|alokasi( waktu)?|menit|duration|lama waktu|waktu \(menit\)|alokasi menit)$|durasi|alokasi/],
  ['jam', /^(jam|waktu|pukul|time|jadwal|jam wib|waktu wib|timeline)$|^(jam|waktu|pukul)\b/],
  ['kegiatan', /(kegiatan|acara|agenda|materi|aktivitas|aktifitas|uraian|activity|rundown|mata acara|susunan acara|program)/],
  ['jenis', /^(jenis|kategori|ranah|tipe|type)$/],
  ['pj', /(^pj\b|\bpj$|\bpic\b|penanggung|pemateri|pelatih|pengisi|petugas|koordinator|instruktur|pemandu|coach|narasumber)/],
  ['tempat', /(tempat|lokasi|venue|ruang|area|lapangan)/],
  ['ket', /(keterangan|catatan|^ket\b|perlengkapan|alat|note|notes|properti|kebutuhan)/],
]

/**
 * Kelompok nama seksi yang lazim ditulis di rundown. Satu judul kolom
 * ("Perkusi") boleh mewakili beberapa seksi DrillKit (Battery + Pit).
 */
const KELOMPOK_SEKSI: { judul: RegExp; seksi: RegExp }[] = [
  { judul: /\b(brass|tiup|horn|hornline|brasswind)\b/, seksi: /\b(brass|tiup|horn)\b/ },
  { judul: /\b(perkusi|percussion|perc|drumline|drum line)\b/, seksi: /\b(battery|pit|perkusi|percussion|front|drum)\b/ },
  { judul: /\b(battery|batt)\b/, seksi: /\b(battery|batt|percussion)\b/ },
  { judul: /\b(pit|front ensemble|front)\b/, seksi: /\b(pit|front)\b/ },
  { judul: /\b(cg|color ?guard|colour ?guard|guard|bendera)\b/, seksi: /\b(cg|color ?guard|colour ?guard|guard)\b/ },
  { judul: /\b(woodwind|ww)\b/, seksi: /\b(woodwind|ww)\b/ },
  { judul: /\b(fc|field commander|mayoret|mayoret|dm|drum major)\b/, seksi: /\b(fc|field commander|drum major)\b/ },
]

/** Kolom ini milik seksi mana? Kosong = bukan kolom seksi. */
export function seksiDariJudul(judul: string, seksi: SeksiRundown[]): string[] {
  const j = normal(judul)
  if (!j) return []
  const langsung = seksi.filter((s) => normal(s.label) === j || normal(s.id) === j).map((s) => s.id)
  if (langsung.length) return langsung
  for (const k of KELOMPOK_SEKSI) {
    if (!k.judul.test(j)) continue
    const ids = seksi.filter((s) => k.seksi.test(normal(s.label)) || k.seksi.test(normal(s.id))).map((s) => s.id)
    if (ids.length) return ids
  }
  return []
}

const kosongPeta = (): Record<PeranKolom, number> => ({ jam: -1, mulai: -1, selesai: -1, durasi: -1, kegiatan: -1, pj: -1, tempat: -1, ket: -1, jenis: -1 })

/** Sebagian besar sel terisi di kolom ini cocok dengan `uji`? */
function porsi(baris: string[][], kolom: number, uji: (s: string) => boolean): number {
  const isi = baris.map((b) => b[kolom] ?? '').filter((s) => s.trim())
  if (!isi.length) return 0
  return isi.filter(uji).length / isi.length
}

const adaJam = (s: string) => /(\d{1,2})[.:](\d{2})(?!\d)/.test(s)

/**
 * Tebak peran tiap kolom. Baris judul dicari di tiga baris pertama: baris
 * dengan ≥2 sel yang cocok kata kunci dan tanpa jam. Tabel tanpa judul
 * ditebak dari isinya: kolom berjam → Jam, kolom berdurasi → Durasi, teks
 * terpanjang → Kegiatan.
 */
export function tebakKolomRundown(baris: string[][], seksi: SeksiRundown[] = []): PetaRundown {
  const kolom = kosongPeta()
  const peta: PetaRundown = { kolom, seksi: [], judulBaris: -1 }
  if (!baris.length) return peta
  const lebar = Math.max(...baris.map((b) => b.length))

  for (let r = 0; r < Math.min(3, baris.length); r++) {
    const b = baris[r]
    if (b.some(adaJam)) continue
    const cocok = b.filter((s) => POLA_JUDUL.some(([, p]) => p.test(normal(s))) || seksiDariJudul(s, seksi).length).length
    if (cocok >= 2 || (cocok >= 1 && b.filter((s) => s.trim()).length === 1 && baris.length > 1 && baris[r + 1]?.some(adaJam))) {
      peta.judulBaris = r
      break
    }
  }

  const data = baris.slice(peta.judulBaris + 1)
  if (peta.judulBaris >= 0) {
    const judul = baris[peta.judulBaris]
    const dipakai = new Set<number>()
    for (const [peran, pola] of POLA_JUDUL) {
      for (let i = 0; i < lebar; i++) {
        if (dipakai.has(i) || kolom[peran] >= 0) continue
        const j = normal(judul[i] ?? '')
        if (!j || !pola.test(j)) continue
        kolom[peran] = i
        dipakai.add(i)
      }
    }
    for (let i = 0; i < lebar; i++) {
      if (dipakai.has(i)) continue
      const ids = seksiDariJudul(judul[i] ?? '', seksi)
      if (ids.length) {
        peta.seksi.push({ kolom: i, seksiIds: ids })
        dipakai.add(i)
      }
    }
    // "Waktu" berisi "10 menit" adalah durasi, bukan jam.
    if (kolom.jam >= 0 && porsi(data, kolom.jam, adaJam) < 0.3 && porsi(data, kolom.jam, (s) => bacaDurasi(s) != null) >= 0.6) {
      if (kolom.durasi < 0) kolom.durasi = kolom.jam
      kolom.jam = -1
    }
    // Judul kegiatan tidak dikenali: pakai kolom teks terpanjang yang tersisa.
    if (kolom.kegiatan < 0) {
      const sisa = [...Array(lebar).keys()].filter((i) => !dipakai.has(i) && porsi(data, i, adaJam) < 0.5)
      kolom.kegiatan = kolomTerpanjang(data, sisa)
    }
    if (kolom.jam < 0 && kolom.mulai < 0) {
      const berjam = [...Array(lebar).keys()].find((i) => !Object.values(kolom).includes(i) && porsi(data, i, adaJam) >= 0.6)
      if (berjam != null) kolom.jam = berjam
    }
    return peta
  }

  // Tanpa baris judul: tebak dari isi.
  const semua = [...Array(lebar).keys()]
  const berjam = semua.filter((i) => porsi(data, i, adaJam) >= 0.6)
  if (berjam.length >= 2 && berjam[1] === berjam[0] + 1 && porsi(data, berjam[0], (s) => bacaJam(s).selesai == null) > 0.8) {
    kolom.mulai = berjam[0]
    kolom.selesai = berjam[1]
  } else if (berjam.length) kolom.jam = berjam[0]
  const terpakai = new Set(Object.values(kolom).filter((x) => x >= 0))
  const berdurasi = semua.find((i) => !terpakai.has(i) && porsi(data, i, (s) => !adaJam(s) && bacaDurasi(s) != null) >= 0.7)
  if (berdurasi != null) {
    kolom.durasi = berdurasi
    terpakai.add(berdurasi)
  }
  const teks = semua.filter((i) => !terpakai.has(i) && !/^\d+$/.test((data[0]?.[i] ?? '').trim()))
  kolom.kegiatan = kolomTerpanjang(data, teks)
  if (kolom.kegiatan >= 0) terpakai.add(kolom.kegiatan)
  // Kolom teks pendek sesudah kegiatan biasanya PJ lalu tempat.
  const sesudah = teks.filter((i) => i > kolom.kegiatan && !terpakai.has(i))
  if (sesudah[0] != null) kolom.pj = sesudah[0]
  if (sesudah[1] != null) kolom.tempat = sesudah[1]
  return peta
}

function kolomTerpanjang(data: string[][], calon: number[]): number {
  let terbaik = -1
  let skor = -1
  for (const i of calon) {
    const isi = data.map((b) => (b[i] ?? '').trim()).filter(Boolean)
    if (!isi.length) continue
    const huruf = isi.filter((s) => /[a-z]/i.test(s)).length / isi.length
    const s = (isi.reduce((a, x) => a + x.length, 0) / isi.length) * huruf * (isi.length / Math.max(1, data.length))
    if (s > skor) {
      skor = s
      terbaik = i
    }
  }
  return terbaik
}

/** Pilih tabel yang paling mungkin rundown: berjam/berdurasi & berbaris terbanyak. */
export function pilihTabelRundown(tabel: TabelRundown[]): number {
  let terbaik = 0
  let skor = -1
  tabel.forEach((t, i) => {
    const sel = t.baris.flat()
    const jam = sel.filter(adaJam).length
    const s = jam * 3 + t.baris.length + (/rundown|jadwal|susunan acara/i.test(t.judul) ? 5 : 0)
    if (s > skor) {
      skor = s
      terbaik = i
    }
  })
  return terbaik
}

/* ------------------------------- Baca rundown ------------------------------ */

interface BarisRundown {
  mulai: number | null
  selesai: number | null
  durasi: number | null
  judul: string
  catatan: string[]
  jenis?: JenisBlok
  pj: string
  tempat: string
  /** teks per seksi (id → teks) untuk blok paralel */
  perSeksi: Record<string, string>
}

const JUDUL_MAKS = 80

function pecahJudul(teks: string): { judul: string; sisa: string[] } {
  const baris = teks.split('\n').map((x) => x.trim()).filter(Boolean)
  let judul = baris[0] ?? ''
  const sisa = baris.slice(1)
  if (judul.length > JUDUL_MAKS) {
    const potong = judul.lastIndexOf(' ', JUDUL_MAKS)
    sisa.unshift(judul.slice(potong > 30 ? potong + 1 : JUDUL_MAKS))
    judul = judul.slice(0, potong > 30 ? potong : JUDUL_MAKS)
  }
  return { judul, sisa }
}

/**
 * Baca satu tabel rundown menjadi blok rencana.
 *
 * Durasi tiap blok, berurutan menurut yang tersedia:
 *   1. jam selesai − jam mulai baris itu;
 *   2. jam mulai baris berikutnya − jam mulai baris itu;
 *   3. kolom durasi;
 *   4. untuk baris terakhir: `selesaiSesi` − jam mulai;
 *   5. `menitBaku` (bawaan 15) — dilaporkan sebagai tebakan.
 */
export function bacaRundown(
  tabel: TabelRundown,
  peta: PetaRundown,
  opsi: { seksi?: SeksiRundown[]; buatId: (awalan: string) => string; selesaiSesi?: string | null; menitBaku?: number },
): HasilRundown {
  const k = peta.kolom
  const sel = (b: string[], i: number) => (i >= 0 ? (b[i] ?? '').trim() : '')
  const peringatan: PeringatanRundown[] = []
  const baris: BarisRundown[] = []

  for (const b of tabel.baris.slice(peta.judulBaris + 1)) {
    let mulai: number | null = null
    let selesai: number | null = null
    if (k.mulai >= 0) {
      mulai = bacaSatuJam(sel(b, k.mulai))
      selesai = k.selesai >= 0 ? bacaSatuJam(sel(b, k.selesai)) : null
      if (mulai == null && k.mulai === k.jam) mulai = bacaJam(sel(b, k.jam)).mulai
    } else if (k.jam >= 0) {
      const j = bacaJam(sel(b, k.jam))
      mulai = j.mulai
      selesai = k.selesai >= 0 ? (bacaSatuJam(sel(b, k.selesai)) ?? j.selesai) : j.selesai
    }
    const durasi = k.durasi >= 0 ? bacaDurasi(sel(b, k.durasi)) : null
    const teksKegiatan = sel(b, k.kegiatan)
    const perSeksi: Record<string, string> = {}
    for (const ks of peta.seksi) {
      const t = sel(b, ks.kolom)
      if (t) for (const id of ks.seksiIds) perSeksi[id] = t
    }
    const { judul, sisa } = pecahJudul(teksKegiatan)
    const ket = sel(b, k.ket)
    const jenisSel = sel(b, k.jenis)
    const pj = sel(b, k.pj)
    const tempat = sel(b, k.tempat)

    const berwaktu = mulai != null || durasi != null
    if (!berwaktu) {
      // Baris tanpa jam & durasi: rincian blok sebelumnya (sub-butir, PJ tambahan).
      const rinci = [teksKegiatan, ket, pj && `PJ: ${pj}`, tempat && `Tempat: ${tempat}`, ...Object.values(perSeksi)].filter(Boolean).join(' · ')
      if (rinci && baris.length) baris[baris.length - 1].catatan.push(rinci)
      continue
    }
    baris.push({
      mulai,
      selesai,
      durasi,
      judul,
      catatan: [...sisa, ...(ket ? [ket] : [])],
      jenis: jenisSel ? (tebakJenisBlok(jenisSel) === 'lainnya' ? undefined : tebakJenisBlok(jenisSel)) : undefined,
      pj,
      tempat,
      perSeksi,
    })
  }

  // Jam rundown yang melewati tengah malam (malam camp) atau ditulis 12 jam.
  let geser = 0
  let sebelum: number | null = null
  for (const r of baris) {
    if (r.mulai == null) continue
    let m = r.mulai + geser
    if (sebelum != null && m < sebelum) {
      if (sebelum - m <= 12 * 60 && m + 12 * 60 >= sebelum && r.mulai < 12 * 60 && sebelum < 24 * 60 && sebelum - m > 6 * 60) {
        geser += 12 * 60
      } else {
        geser += 24 * 60
        peringatan.push({ kode: 'lewat-tengah-malam', teks: `Rundown melewati tengah malam di ${jamTitik(r.mulai)} — durasi dihitung ke hari berikutnya.` })
      }
      m = r.mulai + geser
    }
    r.mulai = m
    if (r.selesai != null) {
      r.selesai += geser
      while (r.selesai < r.mulai) r.selesai += 12 * 60
    }
    sebelum = m
  }

  const akhirSesi = opsi.selesaiSesi ? bacaSatuJam(opsi.selesaiSesi) : null
  const menitBaku = opsi.menitBaku ?? 15
  const blok: BlokLatihan[] = []
  const adaJamSamaSekali = baris.some((r) => r.mulai != null)
  if (!adaJamSamaSekali && baris.length) {
    peringatan.push({ kode: 'tanpa-jam', teks: 'Rundown tidak memuat jam — durasi diambil dari kolom durasi.' })
  }

  for (let i = 0; i < baris.length; i++) {
    const r = baris[i]
    const berikut = baris.slice(i + 1).find((x) => x.mulai != null)?.mulai ?? null
    let menit: number | null = null
    let asal: 'selesai' | 'berikut' | 'sesi' | 'durasi' | 'baku' = 'baku'
    if (r.mulai != null && r.selesai != null && r.selesai > r.mulai) {
      menit = r.selesai - r.mulai
      asal = 'selesai'
    } else if (r.mulai != null && berikut != null && berikut > r.mulai) {
      menit = berikut - r.mulai
      asal = 'berikut'
    } else if (r.durasi != null) {
      menit = r.durasi
      asal = 'durasi'
    } else if (r.mulai != null && akhirSesi != null) {
      let akhir = akhirSesi
      while (akhir <= r.mulai) akhir += 24 * 60
      if (akhir - r.mulai <= 12 * 60) {
        menit = akhir - r.mulai
        asal = 'sesi'
      }
    }
    if (menit == null) {
      menit = menitBaku
      peringatan.push({ kode: 'durasi-tebak', teks: `“${r.judul || 'Baris ' + (i + 1)}” tidak punya jam selesai atau durasi — diisi ${menitBaku} menit, periksa.` })
    }
    if (r.durasi != null && asal !== 'durasi' && Math.abs(r.durasi - menit) >= 5) {
      peringatan.push({ kode: 'durasi-beda', teks: `“${r.judul}”: kolom durasi ${r.durasi}′, tetapi jamnya ${menit}′ — yang dipakai jamnya.` })
    }
    // Tumpang tindih: blok ini selesai sesudah blok berikutnya mulai.
    if (r.mulai != null && berikut != null && r.mulai + menit > berikut) {
      if (berikut > r.mulai) {
        peringatan.push({
          kode: 'tumpang',
          teks: `“${r.judul}” (${jamTitik(r.mulai)}–${jamTitik(r.mulai + menit)}) bertumpuk dengan kegiatan berikutnya (${jamTitik(berikut)}) — dipotong sampai ${jamTitik(berikut)}.`,
        })
        menit = berikut - r.mulai
      }
    }
    if (menit <= 0) {
      peringatan.push({ kode: 'durasi-nol', teks: `“${r.judul || 'Baris ' + (i + 1)}” berdurasi 0 menit — dilewati.` })
      continue
    }
    blok.push(buatBlok(r, menit, opsi))
    // Jeda yang tidak tertulis: jadi blok sendiri supaya jam blok sesudahnya tetap benar.
    if (r.mulai != null && berikut != null && r.mulai + menit < berikut) {
      const jeda = berikut - (r.mulai + menit)
      peringatan.push({ kode: 'jeda', teks: `Ada ${jeda} menit kosong antara ${jamTitik(r.mulai + menit)} dan ${jamTitik(berikut)} — dibuat blok “Jeda”.` })
      blok.push({ id: opsi.buatId('b_'), judul: 'Jeda', jenis: 'istirahat', menit: jeda })
    }
  }

  for (const b of blok) {
    if (!b.judul.trim()) {
      b.judul = b.cabang?.length ? 'Section' : 'Kegiatan'
      peringatan.push({ kode: 'tanpa-kegiatan', teks: 'Ada baris berjam tanpa nama kegiatan — diberi nama sementara, periksa.' })
    }
  }

  const pertama = baris.find((r) => r.mulai != null)?.mulai ?? null
  return {
    blok,
    mulai: pertama != null ? fmt(pertama) : null,
    selesai: pertama != null ? fmt(pertama + blok.reduce((a, b) => a + b.menit, 0)) : null,
    peringatan,
    dibaca: baris.length,
  }
}

function buatBlok(r: BarisRundown, menit: number, opsi: { seksi?: SeksiRundown[]; buatId: (awalan: string) => string }): BlokLatihan {
  const isiSeksi = Object.entries(r.perSeksi)
  const unik = new Set(isiSeksi.map(([, t]) => normal(t)))
  // Kolom seksi berbeda isi → blok paralel; semua sama → cukup jadi judul.
  const paralel = isiSeksi.length > 0 && (unik.size > 1 || (opsi.seksi && isiSeksi.length < opsi.seksi.length && unik.size >= 1 && !r.judul))
  let judul = r.judul
  if (!judul && isiSeksi.length && !paralel) judul = isiSeksi[0][1].split('\n')[0]
  const tebak = r.jenis ?? tebakJenisBlok([judul, ...(paralel ? [] : r.catatan)].join(' '))
  const b: BlokLatihan = {
    id: opsi.buatId('b_'),
    judul: judul || (paralel ? 'Section' : ''),
    jenis: paralel && (tebak === 'lainnya' || !judul) ? 'section' : tebak,
    menit,
  }
  if (r.catatan.length) b.catatan = r.catatan.join('\n')
  if (r.pj) b.pelatih = r.pj
  if (r.tempat) b.tempat = r.tempat
  if (paralel) {
    const kelompok = new Map<string, { teks: string; seksi: string[] }>()
    for (const [id, t] of isiSeksi) {
      const kunci = normal(t)
      const g = kelompok.get(kunci) ?? { teks: t, seksi: [] }
      g.seksi.push(id)
      kelompok.set(kunci, g)
    }
    b.cabang = [...kelompok.values()].map((g): CabangBlok => {
      const { judul: j, sisa } = pecahJudul(g.teks)
      const c: CabangBlok = { id: opsi.buatId('c_'), seksi: g.seksi, judul: j }
      const jenis = tebakJenisBlok(g.teks)
      if (jenis !== 'lainnya' && jenis !== b.jenis) c.jenis = jenis
      const mTempat = sisa.find((x) => /^(tempat|lokasi|@)/i.test(x))
      if (mTempat) c.tempat = mTempat.replace(/^(tempat|lokasi)\s*[:.]?\s*|^@\s*/i, '')
      const mPj = sisa.find((x) => /^(pj|pic|pemateri|pelatih)\b/i.test(x))
      if (mPj) c.pelatih = mPj.replace(/^(pj|pic|pemateri|pelatih)\s*[:.]?\s*/i, '')
      return c
    })
  }
  return b
}

/* ------------------------------ Satu pintu ------------------------------- */

/**
 * Sumber apa pun → daftar tabel. HTML dicoba lebih dulu (lebih kaya:
 * struktur tabel utuh); bila tidak ada tabel di HTML-nya, teks polosnya
 * dibaca sebagai TSV/CSV/baris bebas.
 */
export function tabelDariSumber(sumber: { html?: string; teks?: string }): TabelRundown[] {
  if (sumber.html && /<table\b/i.test(sumber.html)) {
    const t = tabelDariHtml(sumber.html)
    if (t.length) return t
  }
  const teks = sumber.teks ?? (sumber.html ? teksHtml(sumber.html) : '')
  return teks.trim() ? tabelDariTeks(teks) : []
}

/** Nilai sel-sel Google Sheets (`values`) → tabel. */
export function tabelDariNilai(judul: string, nilai: unknown[][]): TabelRundown {
  return { judul, baris: rapikanKisi(nilai.map((b) => b.map((x) => rapikanSel(String(x ?? ''))))) }
}
