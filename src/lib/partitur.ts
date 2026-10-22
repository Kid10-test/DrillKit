/**
 * #11a — Partitur: simpan, kenali, dan bawa MusicXML.
 *
 * **Masalahnya.** Pelatih menyiapkan notasi lagunya di MuseScore/Sibelius/
 * Finale, lalu harus mengirim ulang berkas itu ke setiap anggota lewat jalur
 * lain (WA, Drive). DrillKit tidak tahu apa-apa tentang berkas itu: tidak
 * bisa menunjukkan "partitur lagu ini sudah terpasang", tidak bisa
 * membawanya di ZIP backup, dan tidak bisa memberi ringkasan apa pun.
 *
 * **Keputusannya.** 11a hanya **menyimpan, mengenali, dan meringkas**.
 * Tidak ada render — itu 11b–11d. Seluruh isi modul ini karena itu **murni**:
 * tanpa DOM, tanpa Dexie, tanpa dependensi baru, tanpa impor apa pun, supaya
 * bisa diuji di node (`qa/partitur-logika.mjs`). Pola yang sama dengan #10
 * (`pyware.ts`).
 *
 * Dua fungsi pokoknya:
 *
 * - `deteksiPartitur(bita)` — menjawab "berkas ini apa" dari **isinya**,
 *   bukan dari namanya (nama berkas tidak bisa dipercaya: diunduh ulang,
 *   diganti WA, dikirim tanpa ekstensi).
 * - `ringkasMusicXml(teks)` — membaca judul, daftar part, jumlah birama,
 *   sukat, perubahan sukat, dan tempo **tanpa merender satu not pun**.
 *
 * ### Batas yang disengaja (diputuskan, bukan kelalaian)
 *
 * 1. **Pemindai tag kecil, bukan parser XML penuh.** `DOMParser` hanya ada
 *    di peramban (tidak bisa diuji di node) dan dependensi XML baru
 *    melanggar aturan proyek "tanpa dependensi baru". Yang diambil hanya
 *    tag yang dibutuhkan; sisanya dilewati.
 * 2. **Hanya lima entitas bawaan XML** (`&amp; &lt; &gt; &quot; &apos;`).
 *    Entitas lain — termasuk rujukan angka seperti `&#160;` — ditolak
 *    dengan pesan yang menyebut entitasnya. Lebih baik gagal terang-terangan
 *    daripada menghasilkan judul yang salah tanpa ada yang tahu; dan
 *    kegagalannya **tidak** menghilangkan berkas (lihat butir 4).
 * 3. **Namespace di luar default tidak ditelusuri.** `<score-partwise>`
 *    harus muncul sebagai elemen akar. BOM, spasi, deklarasi `<?xml …?>`,
 *    DOCTYPE, dan komentar sebelum akar ditoleransi — semuanya ada di ekspor
 *    nyata. `<![CDATA[ ]]>` diperlakukan sebagai teks mentah.
 * 4. **Galat parser tidak memblokir penyimpanan (D4).** Bila deteksi yakin
 *    ini MusicXML tetapi ringkasannya gagal, berkasnya tetap dipasang dengan
 *    `terurai: false` dan pesannya ditampilkan apa adanya — sebab OSMD di
 *    11b memakai parser XML sungguhan, jadi berkas yang menjegal pemindai
 *    kita belum tentu menjegal perender. `putusanPartitur()` di bawah ini
 *    yang menyatakannya, supaya aturannya bisa diuji di node sebelum ada UI.
 * 5. **`.mxl` (MusicXML terkompresi) ditolak di 11a, dengan pesan
 *    petunjuk (D1).** `bukaZip` kita hanya membaca metode 0 "stored",
 *    sedangkan `.mxl` dari MuseScore dipadatkan deflate. Membaca deflate
 *    berarti menambah varian *async* pada `zip.ts` — modul yang dipakai
 *    jalur backup & pulihkan, jalur paling sensitif di aplikasi ini.
 *    Risiko itu tidak sebanding dengan satu format yang bisa dihindari dari
 *    aplikasi notasinya. Kandidat 11b: `bukaZipAsync` + `DecompressionStream`.
 * 6. **Ukuran maksimum 8 MB dan 5.000 birama**, ditolak dengan pesan yang
 *    menyebut batasnya — bukan menggantung atau kehabisan memori di HP
 *    anggota.
 *
 * Setiap pesan galat di modul ini **menyebut apa yang dilihat**, bukan
 * sekadar "gagal": `"elemen akar <html>, bukan
 * <score-partwise>/<score-timewise>"`, `"entitas &nbsp; tidak dikenal"`,
 * `"8,4 MB melebihi batas 8 MB"`. Pelatih harus bisa memutuskan sendiri
 * langkah berikutnya dari pesan itu.
 */

/* ------------------------------- Batas ---------------------------------- */

/** Ukuran berkas partitur terbesar yang dipindai: 8 MB. */
export const BATAS_BITA = 8 * 1024 * 1024

/** Jumlah birama terbanyak yang dipindai: 5.000. */
export const BATAS_BIRAMA = 5000

/**
 * Pesan penolakan `.mxl` (D1). Dipakai juga oleh pintu #7 (#11a tahap 3),
 * jadi ditulis sekali di sini supaya tidak ada dua versi yang berbeda.
 */
export const PESAN_MXL =
  'Ini MusicXML terkompresi (.mxl). Simpan ulang dari MuseScore sebagai ' +
  "'MusicXML file (*.musicxml)' — DrillKit belum membuka yang terkompresi."

/* -------------------------------- Tipe ---------------------------------- */

/** Hasil deteksi dari bita. `mxl` sengaja ada supaya penolakannya bisa menyebut nama formatnya. */
export type JenisPartitur = 'musicxml' | 'mxl' | 'pdf'

/** Satu part sesuai `<part-list>`. */
export interface BagianPartitur {
  /** `id` di MusicXML, mis. `P1` — dipakai 11c untuk mencocokkan part ↔ section. */
  id: string
  nama: string
  singkatan?: string
}

/** Satu tanda sukat. */
export interface SukatPartitur {
  beats: number
  beatType: number
}

/**
 * Perubahan sukat: sukat ini **mulai** di birama ke-`birama`.
 *
 * Lagu 4/4 murni menghasilkan satu entri; lagu bersukat campur (7/8 di
 * tengah) beberapa. Inilah "struktur" yang bisa dibaca pelatih tanpa
 * merender apa pun — cukup untuk memastikan berkas yang terpasang benar dan
 * untuk merencanakan frasa (bahan 11d). Murah dihitung: pemindai sudah
 * melewati setiap `<measure>`.
 *
 * Satu birama = paling banyak satu entri. Berkas partwise mengulang
 * `<attributes>` di **setiap** part, jadi tanpa aturan itu lagu enam part
 * akan melaporkan perubahan yang sama enam kali — dan itu bukan struktur,
 * itu kebisingan.
 */
export interface PerubahanSukatPartitur {
  /** Nomor birama (1-based) tempat sukat ini mulai; 0 bila `<time>` ada di luar birama. */
  birama: number
  beats: number
  beatType: number
}

/**
 * Ringkasan isi MusicXML — bidang yang sama dengan `PartiturMeta` di
 * `src/db/types.ts` **tanpa** `namaFile`/`hash`/`ukuran`/`dipasangiAt`
 * (itu urusan penyimpanan, bukan urusan berkasnya) dan tanpa `terurai`
 * (selalu `true` bila ringkasan ini ada).
 */
export interface RingkasanPartitur {
  /** `partwise` (umum, part-major) atau `timewise` (measure-major). */
  susunan: 'partwise' | 'timewise'
  /** `<movement-title>`, atau `<work-title>` bila yang pertama tidak ada. */
  judul?: string
  /** `<creator type="composer">`; creator tanpa `type` dipakai sebagai cadangan. */
  pengarang?: string
  /** Birama terbanyak di antara semua part. */
  jumlahBirama: number
  jumlahPart: number
  /** Urutan sesuai `<part-list>` — bahan part per instrumen di 11c. */
  parts: BagianPartitur[]
  /** Sukat pertama yang ditemukan. */
  sukat?: SukatPartitur
  perubahanSukat: PerubahanSukatPartitur[]
  /** `<sound tempo="…">` pertama (BPM). */
  tempo?: number
}

/** Hasil `ringkasMusicXml`: galat dikembalikan, tidak dilempar. */
export type HasilRingkasPartitur =
  | { ok: true; ringkas: RingkasanPartitur }
  | { ok: false; galat: string }

/** Hasil `deteksiPartitur`. `alasan` selalu ada bila `ya` false — tidak pernah diam. */
export interface DeteksiPartitur {
  ya: boolean
  tipe?: JenisPartitur
  alasan?: string
}

/**
 * Hasil `putusanPartitur` — keputusan **boleh dipasang atau tidak**, plus
 * ringkasannya bila ada (D1 & D4).
 */
export interface PutusanPartitur {
  boleh: boolean
  tipe?: JenisPartitur
  /**
   * Terisi bila `boleh`. `null` berarti tidak ada ringkasan: untuk PDF
   * memang tidak ada yang bisa diringkas, untuk MusicXML berarti pemindai
   * menyerah (lihat `ringkasGagal`).
   */
  ringkas?: RingkasanPartitur | null
  /** Pesan galat pemindai bila `ringkas` kosong pada MusicXML (D4) — ditampilkan apa adanya. */
  ringkasGagal?: string
  /** Pesan penolakan bila `boleh` false — selalu menyebut langkah berikutnya. */
  alasan?: string
}

/* ------------------------------- Galat ---------------------------------- */

/**
 * Galat pemindai. Selalu membawa pesan yang menyebut apa yang dilihat;
 * `ringkasMusicXml` menangkapnya dan mengembalikannya sebagai `galat`.
 */
class GalatPartitur extends Error {}

function pesanGalat(e: unknown): string {
  if (e instanceof GalatPartitur) return e.message
  if (e instanceof Error) return `pemindai partitur gagal: ${e.message}`
  return `pemindai partitur gagal: ${String(e)}`
}

/* ------------------------------ Perkakas -------------------------------- */

const KODE_BOM = 0xfeff

function isSpasi(c: string): boolean {
  return c === ' ' || c === '\t' || c === '\n' || c === '\r'
}

/** Cuplikan pendek untuk pesan galat — inilah "apa yang dilihat" itu. */
function cuplik(teks: string, mulai = 0, panjang = 24): string {
  const potong = teks.slice(mulai, mulai + panjang).replace(/[\u0000-\u001f\u007f]/g, '·')
  return mulai + panjang < teks.length ? `${potong}…` : potong
}

/** 6000 → "6.000" (pemisah ribuan titik, gaya Indonesia). */
function pemisahRibu(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

/** 8.804.000 bita → "8,4 MB"; bilangan bulat tetap "8 MB". */
function formatMb(bita: number): string {
  const mb = bita / (1024 * 1024)
  return Number.isInteger(mb) ? `${mb} MB` : `${mb.toFixed(1).replace('.', ',')} MB`
}

/** Panjang bita UTF-8 dari sebuah string, tanpa menyalinnya jadi Uint8Array. */
function panjangBitaUtf8(teks: string): number {
  let n = 0
  for (let i = 0; i < teks.length; i += 1) {
    const k = teks.charCodeAt(i)
    if (k < 0x80) n += 1
    else if (k < 0x800) n += 2
    else if (k >= 0xd800 && k <= 0xdbff) {
      n += 4
      i += 1
    } else n += 3
  }
  return n
}

function angkaBulat(teks: string | undefined): number | null {
  if (teks === undefined) return null
  const t = teks.trim()
  return /^-?\d+$/.test(t) ? Number.parseInt(t, 10) : null
}

function angkaDesimal(teks: string | undefined): number | null {
  if (teks === undefined) return null
  const t = teks.trim()
  if (!/^-?\d+(\.\d+)?$/.test(t)) return null
  const n = Number.parseFloat(t)
  return Number.isFinite(n) ? n : null
}

function maksimal(angka: Iterable<number>, bawaan = 0): number {
  let hasil = bawaan
  for (const n of angka) if (n > hasil) hasil = n
  return hasil
}

/** Rapikan judul/nama: buang spasi tepi dan runtuhkan spasi ganda (termasuk baris baru). */
function rapikan(teks: string): string {
  return teks.replace(/\s+/g, ' ').trim()
}

/* ------------------------------- Entitas -------------------------------- */

/** Lima entitas bawaan XML — satu-satunya yang didukung (lihat batas butir 2). */
const ENTITAS: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
}

const POLA_NAMA_ENTITAS = /^[A-Za-z][A-Za-z0-9]*$|^#\d+$|^#x[0-9A-Fa-f]+$/

/**
 * Dekode teks XML: lima entitas bawaan saja, sisanya galat yang menyebut
 * entitasnya. `asal` dipakai di pesan supaya jelas entitas itu ada di mana
 * ("teks" atau "atribut number").
 */
function dekodeEntitas(teks: string, asal: string): string {
  let hasil = ''
  let i = 0
  while (i < teks.length) {
    const amp = teks.indexOf('&', i)
    if (amp < 0) {
      hasil += teks.slice(i)
      break
    }
    hasil += teks.slice(i, amp)
    const titik = teks.indexOf(';', amp + 1)
    const nama = titik > 0 && titik - amp <= 32 ? teks.slice(amp + 1, titik) : ''
    if (!nama || !POLA_NAMA_ENTITAS.test(nama)) {
      throw new GalatPartitur(
        `karakter & di ${asal} bukan awal entitas yang dikenal ` +
          '(hanya &amp; &lt; &gt; &quot; &apos;)',
      )
    }
    const nilai = ENTITAS[nama]
    if (nilai === undefined) {
      throw new GalatPartitur(
        `entitas &${nama}; tidak dikenal ` +
          '(hanya &amp; &lt; &gt; &quot; &apos; yang didukung)',
      )
    }
    hasil += nilai
    i = titik + 1
  }
  return hasil
}

/* ------------------------------ Pemindai tag ---------------------------- */

interface TagBuka {
  nama: string
  attrs: Record<string, string>
  penutupSendiri: boolean
  akhir: number
}

const POLA_KARAKTER_NAMA = /[A-Za-z0-9_.:-]/

function bacaNama(teks: string, mulai: number): { nama: string; akhir: number } {
  let i = mulai
  while (i < teks.length && POLA_KARAKTER_NAMA.test(teks[i])) i += 1
  if (i === mulai) throw new GalatPartitur(`nama elemen kosong pada posisi ${mulai}`)
  return { nama: teks.slice(mulai, i), akhir: i }
}

/** Baca satu tag pembuka: `<nama …>` atau `<nama … />`. */
function bacaTag(teks: string, mulai: number): TagBuka {
  let i = mulai + 1
  const { nama, akhir } = bacaNama(teks, i)
  i = akhir
  const attrs: Record<string, string> = {}
  for (;;) {
    while (i < teks.length && isSpasi(teks[i])) i += 1
    if (i >= teks.length) {
      throw new GalatPartitur(`tag <${nama}> di posisi ${mulai} tidak ditutup dengan '>'`)
    }
    const c = teks[i]
    if (c === '>') {
      i += 1
      break
    }
    if (c === '/') {
      if (teks[i + 1] !== '>') {
        throw new GalatPartitur(`tag <${nama}> di posisi ${mulai}: '/' tidak diikuti '>'`)
      }
      i += 2
      return { nama, attrs, penutupSendiri: true, akhir: i }
    }
    const { nama: namaAttr, akhir: akhirAttr } = bacaNama(teks, i)
    let k = akhirAttr
    while (k < teks.length && isSpasi(teks[k])) k += 1
    if (teks[k] !== '=') {
      // Atribut tanpa nilai (jarang, tetapi sah) — dicatat kosong, jangan buntu.
      attrs[namaAttr] = ''
      i = akhirAttr
      continue
    }
    k += 1
    while (k < teks.length && isSpasi(teks[k])) k += 1
    const kutip = teks[k]
    if (kutip !== '"' && kutip !== "'") {
      throw new GalatPartitur(`nilai atribut ${namaAttr} pada <${nama}> tidak diapit tanda kutip`)
    }
    const tutup = teks.indexOf(kutip, k + 1)
    if (tutup < 0) {
      throw new GalatPartitur(`nilai atribut ${namaAttr} pada <${nama}> tidak ditutup`)
    }
    attrs[namaAttr] = dekodeEntitas(teks.slice(k + 1, tutup), `atribut ${namaAttr}`)
    i = tutup + 1
  }
  return { nama, attrs, penutupSendiri: false, akhir: i }
}

function bacaTagTutup(teks: string, mulai: number): { nama: string; akhir: number } {
  const { nama, akhir } = bacaNama(teks, mulai + 2)
  let i = akhir
  while (i < teks.length && isSpasi(teks[i])) i += 1
  if (teks[i] !== '>') {
    throw new GalatPartitur(`tag penutup </${nama}> di posisi ${mulai} tidak ditutup dengan '>'`)
  }
  return { nama, akhir: i + 1 }
}

/** Lewati `penanda` (mis. `-->`) atau galat yang menyebut apa yang tak ditutup. */
function lompatKe(teks: string, penanda: string, mulai: number, apa: string): number {
  const akhir = teks.indexOf(penanda, mulai)
  if (akhir < 0) throw new GalatPartitur(`${apa} tidak ditutup dengan "${penanda}"`)
  return akhir + penanda.length
}

/** Lewati `<!DOCTYPE …>` termasuk *internal subset* `[…]` di dalamnya. */
function lewatiDoctype(teks: string, mulai: number): number {
  let i = mulai + 9
  let dalamKurung = 0
  while (i < teks.length) {
    const c = teks[i]
    if (c === '[') dalamKurung += 1
    else if (c === ']') dalamKurung -= 1
    else if (c === '>' && dalamKurung <= 0) return i + 1
    i += 1
  }
  throw new GalatPartitur(`DOCTYPE pada posisi ${mulai} tidak ditutup`)
}

interface AkarXml {
  nama: string
  attrs: Record<string, string>
  penutupSendiri: boolean
  mulai: number
  akhir: number
}

/**
 * Elemen akar XML, dengan BOM/spasi/`<?xml …?>`/DOCTYPE/komentar sebelum akar
 * ditoleransi. Galatnya menyebut apa yang dilihat supaya pelatih tahu berkas
 * itu sebenarnya apa.
 */
function akarElemen(teks: string): AkarXml {
  let i = teks.charCodeAt(0) === KODE_BOM ? 1 : 0
  for (;;) {
    while (i < teks.length && isSpasi(teks[i])) i += 1
    if (i >= teks.length) throw new GalatPartitur('berkas berakhir tanpa elemen akar XML')
    if (teks[i] !== '<') throw new GalatPartitur(`bukan XML: teks "${cuplik(teks, i)}" sebelum elemen akar`)
    if (teks.startsWith('<!--', i)) {
      i = lompatKe(teks, '-->', i + 4, 'komentar')
      continue
    }
    if (teks.startsWith('<?', i)) {
      i = lompatKe(teks, '?>', i + 2, 'deklarasi <?…?>')
      continue
    }
    if (teks.startsWith('<!DOCTYPE', i)) {
      i = lewatiDoctype(teks, i)
      continue
    }
    if (teks.startsWith('<!', i)) {
      throw new GalatPartitur(`deklarasi "${cuplik(teks, i)}" sebelum elemen akar tidak dikenal`)
    }
    const tag = bacaTag(teks, i)
    return { ...tag, mulai: i }
  }
}

/* ------------------------------- Bita ----------------------------------- */

function mulaiDengan(bita: Uint8Array, teks: string): boolean {
  if (bita.length < teks.length) return false
  for (let i = 0; i < teks.length; i += 1) {
    if (bita[i] !== teks.charCodeAt(i)) return false
  }
  return true
}

/** Cari penanda ASCII di dalam bita — dipakai untuk mengenali `.mxl` tanpa membuka ZIP. */
function memuatPenanda(bita: Uint8Array, cari: string): boolean {
  const n = cari.length
  if (bita.length < n) return false
  const awal = cari.charCodeAt(0)
  for (let i = 0; i + n <= bita.length; i += 1) {
    if (bita[i] !== awal) continue
    let cocok = true
    for (let j = 1; j < n; j += 1) {
      if (bita[i + j] !== cari.charCodeAt(j)) {
        cocok = false
        break
      }
    }
    if (cocok) return true
  }
  return false
}

/**
 * Bita → teks. BOM UTF-8 dibuang (`TextDecoder` sudah melakukannya, disaring
 * lagi sebagai penjaga), BOM UTF-16 LE/BE dipakai untuk memilih penguraian —
 * ekspor lama dari Sibelius/Finale memang ada yang UTF-16.
 */
export function teksPartitur(bita: Uint8Array): string {
  if (bita.length >= 2 && bita[0] === 0xff && bita[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(bita.subarray(2))
  }
  if (bita.length >= 2 && bita[0] === 0xfe && bita[1] === 0xff) {
    // UTF-16 BE ditukar jadi LE lalu diuraikan — `TextDecoder('utf-16be')`
    // tidak ada di semua lingkungan, menukar bita selalu bisa.
    const tukar = new Uint8Array(Math.max(0, bita.length - 2))
    for (let i = 2; i + 1 < bita.length; i += 2) {
      tukar[i - 2] = bita[i + 1]
      tukar[i - 1] = bita[i]
    }
    return new TextDecoder('utf-16le').decode(tukar)
  }
  const teks = new TextDecoder('utf-8').decode(bita)
  return teks.charCodeAt(0) === KODE_BOM ? teks.slice(1) : teks
}

/* ------------------------------ Deteksi --------------------------------- */

/**
 * Berkas ini apa? Dijawab dari **isinya**:
 *
 * - `%PDF-` di empat bita pertama → PDF.
 * - ZIP yang memuat `META-INF/container.xml` → `.mxl`, **ditolak** dengan
 *   pesan petunjuk (D1); ZIP lain → bukan partitur.
 * - Sisanya diperlakukan sebagai teks: akar `score-partwise`/`score-timewise`
 *   → MusicXML.
 */
export function deteksiPartitur(bita: Uint8Array): DeteksiPartitur {
  try {
    if (bita.length === 0) return { ya: false, alasan: 'berkas kosong (0 bita)' }
    if (mulaiDengan(bita, '%PDF-')) return { ya: true, tipe: 'pdf' }
    if (bita[0] === 0x50 && bita[1] === 0x4b && (bita[2] === 3 || bita[2] === 5 || bita[2] === 7)) {
      if (memuatPenanda(bita, 'META-INF/container.xml')) {
        return { ya: false, tipe: 'mxl', alasan: PESAN_MXL }
      }
      return {
        ya: false,
        alasan: 'arsip ZIP tanpa META-INF/container.xml di dalamnya — bukan MusicXML terkompresi',
      }
    }
    const akar = akarElemen(teksPartitur(bita))
    if (akar.nama === 'score-partwise' || akar.nama === 'score-timewise') {
      return { ya: true, tipe: 'musicxml' }
    }
    return {
      ya: false,
      alasan: `elemen akar <${akar.nama}>, bukan <score-partwise>/<score-timewise>`,
    }
  } catch (e) {
    return { ya: false, alasan: pesanGalat(e) }
  }
}

/* ------------------------------ Ringkasan ------------------------------- */

/**
 * Ringkas MusicXML **tanpa merender**. Galat dikembalikan, tidak dilempar.
 *
 * `teks` (bukan bita) supaya pemanggil memutuskan sendiri kapan menguraikan
 * berkas besar; ukuran bita UTF-8-nya tetap diperiksa di sini terhadap
 * `BATAS_BITA`.
 */
export function ringkasMusicXml(teks: string): HasilRingkasPartitur {
  try {
    const bita = panjangBitaUtf8(teks)
    if (bita > BATAS_BITA) {
      throw new GalatPartitur(`${formatMb(bita)} melebihi batas ${formatMb(BATAS_BITA)}`)
    }
    return { ok: true, ringkas: pindaiPartitur(teks) }
  } catch (e) {
    return { ok: false, galat: pesanGalat(e) }
  }
}

function pindaiPartitur(teks: string): RingkasanPartitur {
  const akar = akarElemen(teks)
  const partwise = akar.nama === 'score-partwise'
  if (!partwise && akar.nama !== 'score-timewise') {
    throw new GalatPartitur(`elemen akar <${akar.nama}>, bukan <score-partwise>/<score-timewise>`)
  }

  const tumpukan: TagBuka[] = []
  let buf = ''
  let akarDitutup = false

  // <part-list>
  const parts: BagianPartitur[] = []
  let partListAktif: BagianPartitur | null = null
  // <part id="…"> yang benar-benar ada isinya
  const idTerlihat: string[] = []
  let bagianSekarang: string | null = null

  // Birama
  let birama = 0
  let biramaSekarang: number | null = null
  const cacahPerPart = new Map<string, number>()
  let cacahTimewise = 0

  // Sukat
  let sukat: SukatPartitur | undefined
  let waktuSekarang: { beats?: number; beatType?: number } | null = null
  const perubahanSukat: PerubahanSukatPartitur[] = []

  // Kepala
  let judulGerak: string | undefined
  let judulKarya: string | undefined
  let pengarangComposer: string | undefined
  let pengarangUmum: string | undefined
  let tempo: number | undefined

  function naik(kunci: string) {
    cacahPerPart.set(kunci, (cacahPerPart.get(kunci) ?? 0) + 1)
  }

  /** Tumpuk teks mentah (entitasnya sudah diperiksa) untuk elemen terdalam. */
  function serapTeks(kasar: string) {
    if (!kasar) return
    buf += dekodeEntitas(kasar, 'teks')
  }

  /** Bagi `buf` ke elemen yang sedang terbuka — dipanggil di setiap batas tag. */
  function serapBuf() {
    if (!buf) return
    const isi = buf
    buf = ''
    const atas = tumpukan[tumpukan.length - 1]
    if (!atas) {
      if (isi.trim()) throw new GalatPartitur(`teks "${cuplik(isi.trim())}" di luar elemen akar`)
      return
    }
    const bersih = rapikan(isi)
    if (!bersih) return
    if (atas.nama === 'movement-title') judulGerak ??= bersih
    else if (atas.nama === 'work-title') judulKarya ??= bersih
    else if (atas.nama === 'creator') {
      if (atas.attrs.type === 'composer') pengarangComposer ??= bersih
      else if (!atas.attrs.type) pengarangUmum ??= bersih
    } else if (atas.nama === 'part-name' && partListAktif) partListAktif.nama = bersih
    else if (atas.nama === 'part-abbreviation' && partListAktif) partListAktif.singkatan = bersih
    else if ((atas.nama === 'beats' || atas.nama === 'beat-type') && waktuSekarang) {
      const induk = tumpukan[tumpukan.length - 2]
      if (induk && induk.nama === 'time') {
        const angka = angkaBulat(bersih)
        if (angka !== null && angka > 0) {
          if (atas.nama === 'beats') waktuSekarang.beats = angka
          else waktuSekarang.beatType = angka
        }
      }
    }
  }

  function bukaElemen(tag: TagBuka) {
    if (tumpukan.length === 0) {
      if (akarDitutup) throw new GalatPartitur(`elemen akar kedua <${tag.nama}> setelah </${akar.nama}>`)
      if (tag.nama !== akar.nama) {
        throw new GalatPartitur(`tag pembuka <${tag.nama}> di luar elemen akar <${akar.nama}>`)
      }
    }
    const induk = tumpukan[tumpukan.length - 1] ?? null

    if (tag.nama === 'score-part') {
      partListAktif = { id: tag.attrs.id ?? '', nama: '' }
      parts.push(partListAktif)
    } else if (tag.nama === 'part') {
      const id = tag.attrs.id ?? ''
      if (id && !idTerlihat.includes(id)) idTerlihat.push(id)
      bagianSekarang = id
      // Partwise: nomor birama dihitung ulang per part, jadi penomoran tidak
      // menumpuk dari part sebelumnya bila `number` tidak ada.
      if (partwise) birama = 0
      else if (induk && induk.nama === 'measure') naik(id || '')
    } else if (tag.nama === 'measure') {
      const nomor = angkaBulat(tag.attrs.number)
      if (nomor !== null) birama = nomor
      else birama += 1
      biramaSekarang = birama
      if (partwise) naik(bagianSekarang ?? '')
      else cacahTimewise += 1
    } else if (tag.nama === 'time') {
      waktuSekarang = {}
    } else if (tag.nama === 'sound' && tempo === undefined) {
      const t = angkaDesimal(tag.attrs.tempo)
      if (t !== null && t > 0) tempo = t
    }

    if (!tag.penutupSendiri) tumpukan.push(tag)
  }

  /**
   * Catat satu tanda sukat.
   *
   * Dua hal yang harus dijaga di sini, dan keduanya dari kenyataan berkas
   * partwise — `<attributes>` **diulang di setiap part**:
   *
   * 1. Hanya **perubahan** yang dicatat: bandingkan dengan sukat yang berlaku
   *    di birama itu, bukan dengan `<time>` terakhir yang dilihat. Kalau
   *    dibandingkan dengan yang terakhir, part kedua akan mencatat ulang
   *    7/8 di birama 17 sebagai perubahan baru.
   * 2. Satu birama = satu entri. Part pertama yang dipegang, supaya urutan
   *    `<part-list>` tetap jadi acuan (polimetri tidak didukung — dan tidak
   *    akan pernah bisa dibaca pelatih dari ringkasan ini).
   */
  function catatSukat(nilai: SukatPartitur) {
    const biramaSukat = biramaSekarang ?? 0
    let berlaku: SukatPartitur | null = null
    for (const p of perubahanSukat) {
      if (p.birama > biramaSukat) break
      berlaku = { beats: p.beats, beatType: p.beatType }
    }
    if (berlaku && berlaku.beats === nilai.beats && berlaku.beatType === nilai.beatType) return
    if (perubahanSukat.some((p) => p.birama === biramaSukat)) return
    perubahanSukat.push({ birama: biramaSukat, beats: nilai.beats, beatType: nilai.beatType })
    sukat ??= nilai
  }

  function tutupElemen(atas: TagBuka) {
    if (atas.nama === 'time') {
      const { beats, beatType } = waktuSekarang ?? {}
      if (beats !== undefined && beatType !== undefined) catatSukat({ beats, beatType })
      waktuSekarang = null
    }
    if (atas.nama === 'part') {
      bagianSekarang = null
      if (partwise) birama = 0
    }
  }

  let i = akar.akhir
  if (!akar.penutupSendiri) tumpukan.push({ nama: akar.nama, attrs: akar.attrs, penutupSendiri: false, akhir: akar.akhir })

  for (;;) {
    const lt = teks.indexOf('<', i)
    if (lt < 0) {
      serapTeks(teks.slice(i))
      break
    }
    if (lt > i) serapTeks(teks.slice(i, lt))
    i = lt

    if (teks.startsWith('<!--', i)) {
      i = lompatKe(teks, '-->', i + 4, 'komentar')
      continue
    }
    if (teks.startsWith('<![CDATA[', i)) {
      const akhirCdata = teks.indexOf(']]>', i + 9)
      if (akhirCdata < 0) throw new GalatPartitur('CDATA tidak ditutup dengan "]]>"')
      // Teks mentah: entitas di dalamnya TIDAK diperiksa (lihat batas butir 3).
      buf += teks.slice(i + 9, akhirCdata)
      i = akhirCdata + 3
      continue
    }
    if (teks.startsWith('<?', i)) {
      i = lompatKe(teks, '?>', i + 2, 'deklarasi <?…?>')
      continue
    }
    if (teks.startsWith('<!DOCTYPE', i)) {
      i = lewatiDoctype(teks, i)
      continue
    }
    if (teks.startsWith('</', i)) {
      const tutup = bacaTagTutup(teks, i)
      i = tutup.akhir
      const atas = tumpukan[tumpukan.length - 1]
      if (!atas) throw new GalatPartitur(`tag penutup </${tutup.nama}> tanpa tag pembuka`)
      if (atas.nama !== tutup.nama) {
        throw new GalatPartitur(`tag penutup </${tutup.nama}> tidak cocok dengan <${atas.nama}>`)
      }
      serapBuf()
      tumpukan.pop()
      if (tumpukan.length === 0) akarDitutup = true
      tutupElemen(atas)
      continue
    }
    if (teks.startsWith('<!', i)) {
      throw new GalatPartitur(`deklarasi "${cuplik(teks, i)}" di luar DOCTYPE tidak dikenal`)
    }

    const tag = bacaTag(teks, i)
    i = tag.akhir
    serapBuf()
    bukaElemen(tag)
  }

  if (tumpukan.length > 0) {
    const sisa = tumpukan.map((t) => `<${t.nama}>`).join(' ')
    throw new GalatPartitur(`XML terpotong: ${sisa} belum ditutup di akhir berkas`)
  }

  const jumlahBirama = partwise ? maksimal(cacahPerPart.values()) : Math.max(cacahTimewise, maksimal(cacahPerPart.values()))
  if (jumlahBirama > BATAS_BIRAMA) {
    throw new GalatPartitur(
      `${pemisahRibu(jumlahBirama)} birama melebihi batas pemindai ${pemisahRibu(BATAS_BIRAMA)} birama`,
    )
  }

  const daftarPart: BagianPartitur[] = []
  for (const p of parts) {
    const id = p.id || p.nama
    if (!id) continue
    daftarPart.push(p.singkatan ? { id, nama: p.nama || id, singkatan: p.singkatan } : { id, nama: p.nama || id })
  }
  // Part yang benar-benar ada isinya tetapi tidak tercatat di <part-list>
  // tetap dilaporkan — kalau tidak, ia hilang diam-diam dari ringkasan.
  for (const id of idTerlihat) {
    if (!daftarPart.some((p) => p.id === id)) daftarPart.push({ id, nama: id })
  }

  return {
    susunan: partwise ? 'partwise' : 'timewise',
    judul: judulGerak ?? judulKarya,
    pengarang: pengarangComposer ?? pengarangUmum,
    jumlahBirama,
    jumlahPart: daftarPart.length,
    parts: daftarPart,
    sukat,
    perubahanSukat,
    tempo,
  }
}

/* ------------------------------- Putusan -------------------------------- */

/**
 * Boleh dipasang atau tidak — dan kalau boleh, ringkasannya apa.
 *
 * Inilah tempat keputusan D1 dan D4 dihidupkan, supaya aturannya bisa diuji
 * di node sebelum ada layarnya:
 *
 * - `.mxl` → **tidak boleh**, dengan pesan yang menyebut cara menyimpan ulang.
 * - PDF → boleh, tanpa ringkasan (memang tidak ada yang bisa diringkas).
 * - MusicXML yang pemindainya menyerah → **tetap boleh** (D4), dengan
 *   `ringkasGagal` berisi pesan aslinya untuk ditampilkan apa adanya.
 */
export function putusanPartitur(bita: Uint8Array): PutusanPartitur {
  const d = deteksiPartitur(bita)
  if (!d.ya) return { boleh: false, tipe: d.tipe, alasan: d.alasan }
  if (d.tipe === 'pdf') return { boleh: true, tipe: 'pdf', ringkas: null }
  const hasil = ringkasMusicXml(teksPartitur(bita))
  if (hasil.ok) return { boleh: true, tipe: 'musicxml', ringkas: hasil.ringkas }
  return { boleh: true, tipe: 'musicxml', ringkas: null, ringkasGagal: hasil.galat }
}
