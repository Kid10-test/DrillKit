/**
 * #30 — Estafet QR berantai tanpa sinyal (*animated QR air-gap sync*).
 *
 * Lapisan **transpor** di atas berkas DrillKit yang sudah ada (setoran seksi
 * #15, data pilihan/tambalan set, paket anggota, …): isinya tidak diubah,
 * hanya dipindahkan dari layar satu HP ke kamera HP lain lalu dibuka lewat
 * Pintu #7 (`kenaliBerkas` + pratinjau) — sehingga pagar privasi & aturan
 * mode tiap jenis berkas tetap berlaku persis seperti berkas yang diunduh.
 *
 * Alur:
 *  1. `kemasEstafet` — susun muatan (meta + isi), mampatkan dengan
 *     `CompressionStream('deflate-raw')` bila memang memperkecil, pecah jadi
 *     potongan ±700 bita, tiap potongan diberi CRC32 lalu disandikan
 *     **Base45** (RFC 9285). Alfabet Base45 = alfabet mode *alphanumeric* QR,
 *     jadi tiap bingkai muat di QR yang lebih kecil (±8,3 bit/bita, bukan 10,7
 *     seperti Base64 di mode bita) dan aman melewati `BarcodeDetector`
 *     (yang mengembalikan teks, bukan bita mentah).
 *  2. Pengirim menayangkan bingkai berputar 2–4 fps.
 *  3. `tampung` — penerima mengumpulkan bingkai **dalam urutan apa pun**;
 *     dobel diabaikan, bingkai rusak (CRC salah) dibuang, bingkai dari
 *     kiriman lain tidak tercampur.
 *  4. `rakitEstafet` — gabung, buka mampatan, cocokkan CRC32 isi asli.
 *
 * Murni: tanpa Dexie, React, atau DOM (aliran mampat memakai API standar
 * yang juga ada di Node ≥ 18), jadi bisa diuji di node.
 */
import { crc32 } from './zip'

/* ------------------------------ Konstanta ------------------------------ */

/** Penanda awal tiap bingkai: aplikasi + versi protokol. */
export const AWALAN_ESTAFET = 'DK1'

/** Pilihan ukuran potongan (bita isi per bingkai, sebelum Base45). */
export const UKURAN_BINGKAI = {
  /** ±QR versi 19 (97×97 modul) — layar HP ke kamera HP biasa. */
  besar: 700,
  /** ±QR versi 13 — kamera lama/buram, atau layar kecil. */
  kecil: 350,
} as const
export type UkuranBingkai = keyof typeof UKURAN_BINGKAI

/** Kecepatan tayang yang ditawarkan (bingkai per detik). */
export const PILIHAN_FPS = [2, 3, 4] as const

/** Batas bingkai per kiriman — di atas ini satu putaran > 1,5 menit. */
export const MAKS_BINGKAI = 400

/** Di atas ini pengirim diberi saran memakai "Bagikan langsung". */
export const SARAN_BINGKAI = 60

/** Batas isi setelah dibuka (melindungi dari muatan "bom zip"). */
export const MAKS_ISI_BITA = 20 * 1024 * 1024

/* -------------------------------- Base45 ------------------------------- */

const ALFABET45 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:'
const NILAI45 = new Map([...ALFABET45].map((c, i) => [c, i]))

/** Sandikan bita ke Base45 (RFC 9285): tiap 2 bita → 3 karakter. */
export function keBase45(b: Uint8Array): string {
  let s = ''
  for (let i = 0; i + 1 < b.length; i += 2) {
    let n = b[i] * 256 + b[i + 1]
    const c = n % 45
    n = (n - c) / 45
    const d = n % 45
    const e = (n - d) / 45
    s += ALFABET45[c] + ALFABET45[d] + ALFABET45[e]
  }
  if (b.length % 2 === 1) {
    const n = b[b.length - 1]
    s += ALFABET45[n % 45] + ALFABET45[Math.floor(n / 45)]
  }
  return s
}

/** Kebalikan `keBase45`; `null` bila ada karakter/nilai yang tidak sah. */
export function dariBase45(s: string): Uint8Array | null {
  if (s.length % 3 === 1) return null
  const keluar = new Uint8Array(Math.floor(s.length / 3) * 2 + (s.length % 3 === 2 ? 1 : 0))
  let j = 0
  for (let i = 0; i < s.length; i += 3) {
    const c = NILAI45.get(s[i])
    const d = NILAI45.get(s[i + 1])
    if (c === undefined || d === undefined) return null
    if (i + 2 < s.length) {
      const e = NILAI45.get(s[i + 2])
      if (e === undefined) return null
      const n = c + d * 45 + e * 45 * 45
      if (n > 0xffff) return null
      keluar[j++] = n >> 8
      keluar[j++] = n & 0xff
    } else {
      const n = c + d * 45
      if (n > 0xff) return null
      keluar[j++] = n
    }
  }
  return keluar
}

/** Semua karakter bingkai termasuk alfabet mode alphanumeric QR. */
export function apakahAlfanumerikQr(s: string): boolean {
  for (const ch of s) if (!NILAI45.has(ch)) return false
  return true
}

/* --------------------------- Aliran mampat ----------------------------- */

interface KonstruktorAliran {
  new (format: string): { readonly readable: ReadableStream<Uint8Array>; readonly writable: WritableStream<Uint8Array> }
}

function ambilAliran(nama: 'CompressionStream' | 'DecompressionStream'): KonstruktorAliran | null {
  const k = (globalThis as Record<string, unknown>)[nama]
  return typeof k === 'function' ? (k as KonstruktorAliran) : null
}

/** Peramban/Node ini bisa memampatkan & membuka `deflate-raw`? */
export function bisaMampat(): boolean {
  return !!ambilAliran('CompressionStream') && !!ambilAliran('DecompressionStream')
}

async function alirkan(bita: Uint8Array, Ctor: KonstruktorAliran, batas: number): Promise<Uint8Array> {
  const t = new Ctor('deflate-raw')
  const penulis = t.writable.getWriter()
  const pembaca = t.readable.getReader()
  // Tulis serempak dengan membaca: buffer internal terbatas.
  const tulis = (async () => {
    await penulis.write(bita)
    await penulis.close()
  })()
  tulis.catch(() => {})
  const keping: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { value, done } = await pembaca.read()
    if (done) break
    if (!value?.byteLength) continue
    total += value.byteLength
    if (total > batas) {
      await pembaca.cancel().catch(() => {})
      throw new Error('terlalu besar')
    }
    keping.push(value)
  }
  await tulis
  const hasil = new Uint8Array(total)
  let o = 0
  for (const k of keping) {
    hasil.set(k, o)
    o += k.byteLength
  }
  return hasil
}

/* ------------------------------- Muatan -------------------------------- */

/*
 * Muatan = [versi:1][metode:1][panjangMeta:2 BE][meta JSON UTF-8][isi]
 * metode 0 = mentah, 1 = deflate-raw (isi dimampatkan).
 * meta = { n: nama berkas, u: ukuran asli, c: CRC32 isi asli, m?: mime }
 */
const VERSI_MUATAN = 1
const METODE_MENTAH = 0
const METODE_DEFLATE = 1

interface MetaMuatan {
  n: string
  u: number
  c: number
  m?: string
}

export interface KirimanEstafet {
  sesi: string
  nama: string
  bingkai: string[]
  ukuranAsli: number
  /** ukuran muatan yang benar-benar ditayangkan (setelah mampat bila dipakai) */
  ukuranKirim: number
  metode: 'deflate-raw' | 'mentah'
}

export type HasilKemas = { ok: true; kiriman: KirimanEstafet } | { ok: false; alasan: string; perluBingkai?: number }

const enc = new TextEncoder()
const dec = new TextDecoder()

/** Kode sesi 4 karakter (base36 huruf besar) — pembeda antar-kiriman. */
export function sesiAcak(): string {
  return Math.floor(Math.random() * 36 ** 4)
    .toString(36)
    .toUpperCase()
    .padStart(4, '0')
}

const ke36 = (n: number) => n.toString(36).toUpperCase()

/** Rapikan nama berkas: tanpa jalur, maksimal 120 karakter. */
function rapikanNama(nama: string): string {
  const dasar = (nama.split(/[\\/]/).pop() ?? '').replace(/[\u0000-\u001f]/g, '').trim()
  return (dasar || 'berkas-drillkit.json').slice(0, 120)
}

/**
 * Kemas satu berkas menjadi deret teks bingkai QR.
 *
 * Mampat hanya dipakai bila memang memperkecil (ZIP/PDF biasanya tidak).
 */
export async function kemasEstafet(
  nama: string,
  isi: Uint8Array,
  opsi: { ukuranBingkai?: number; sesi?: string; mime?: string; mampat?: boolean } = {},
): Promise<HasilKemas> {
  const ukuranBingkai = Math.max(64, Math.min(1200, Math.floor(opsi.ukuranBingkai ?? UKURAN_BINGKAI.besar)))
  if (isi.byteLength > MAKS_ISI_BITA) return { ok: false, alasan: 'Berkas lebih dari 20 MB — terlalu besar untuk QR.' }
  const namaRapi = rapikanNama(nama)
  const meta: MetaMuatan = { n: namaRapi, u: isi.byteLength, c: crc32(isi) }
  if (opsi.mime) meta.m = opsi.mime.slice(0, 80)
  const metaBita = enc.encode(JSON.stringify(meta))

  let metode = METODE_MENTAH
  let badan = isi
  const Kompres = opsi.mampat === false ? null : ambilAliran('CompressionStream')
  if (Kompres && ambilAliran('DecompressionStream')) {
    try {
      const padat = await alirkan(isi, Kompres, MAKS_ISI_BITA)
      if (padat.byteLength < isi.byteLength) {
        badan = padat
        metode = METODE_DEFLATE
      }
    } catch {
      /* tetap mentah */
    }
  }

  const muatan = new Uint8Array(4 + metaBita.byteLength + badan.byteLength)
  muatan[0] = VERSI_MUATAN
  muatan[1] = metode
  muatan[2] = metaBita.byteLength >> 8
  muatan[3] = metaBita.byteLength & 0xff
  muatan.set(metaBita, 4)
  muatan.set(badan, 4 + metaBita.byteLength)

  const jumlah = Math.max(1, Math.ceil(muatan.byteLength / ukuranBingkai))
  if (jumlah > MAKS_BINGKAI) {
    return {
      ok: false,
      perluBingkai: jumlah,
      alasan: `Terlalu besar untuk QR: perlu ${jumlah} bingkai (maks. ${MAKS_BINGKAI}). Pakai "Bagikan langsung" atau Unduh.`,
    }
  }
  const sesi = (opsi.sesi ?? sesiAcak()).toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 6) || sesiAcak()
  const bingkai: string[] = []
  for (let i = 0; i < jumlah; i++) {
    const potong = muatan.subarray(i * ukuranBingkai, Math.min(muatan.byteLength, (i + 1) * ukuranBingkai))
    const denganCrc = new Uint8Array(potong.byteLength + 4)
    denganCrc.set(potong, 0)
    const c = crc32(potong)
    denganCrc[potong.byteLength] = (c >>> 24) & 0xff
    denganCrc[potong.byteLength + 1] = (c >>> 16) & 0xff
    denganCrc[potong.byteLength + 2] = (c >>> 8) & 0xff
    denganCrc[potong.byteLength + 3] = c & 0xff
    bingkai.push(`${AWALAN_ESTAFET}/${sesi}/${ke36(i)}/${ke36(jumlah)}/${keBase45(denganCrc)}`)
  }
  return {
    ok: true,
    kiriman: {
      sesi,
      nama: namaRapi,
      bingkai,
      ukuranAsli: isi.byteLength,
      ukuranKirim: muatan.byteLength,
      metode: metode === METODE_DEFLATE ? 'deflate-raw' : 'mentah',
    },
  }
}

/* ------------------------------- Bingkai ------------------------------- */

export interface BingkaiEstafet {
  sesi: string
  indeks: number
  jumlah: number
  data: Uint8Array
}

/** Cepat: apakah teks QR ini bingkai estafet DrillKit (belum tentu utuh)? */
export function apakahBingkaiEstafet(teks: string): boolean {
  return teks.startsWith(`${AWALAN_ESTAFET}/`)
}

/** Urai satu teks QR. `bukan` = QR lain (mis. kartu anggota); `rusak` = CRC/format salah. */
export function bacaBingkai(teks: string): { ok: true; bingkai: BingkaiEstafet } | { ok: false; galat: 'bukan' | 'rusak' } {
  if (!apakahBingkaiEstafet(teks)) return { ok: false, galat: 'bukan' }
  const bagian: string[] = []
  let sisa = teks
  for (let k = 0; k < 4; k++) {
    const p = sisa.indexOf('/')
    if (p < 0) return { ok: false, galat: 'rusak' }
    bagian.push(sisa.slice(0, p))
    sisa = sisa.slice(p + 1)
  }
  const [, sesi, si, sn] = bagian
  if (!/^[0-9A-Z]{1,6}$/.test(sesi) || !/^[0-9A-Z]{1,3}$/.test(si) || !/^[0-9A-Z]{1,3}$/.test(sn))
    return { ok: false, galat: 'rusak' }
  const indeks = parseInt(si, 36)
  const jumlah = parseInt(sn, 36)
  if (!(jumlah >= 1 && jumlah <= MAKS_BINGKAI && indeks >= 0 && indeks < jumlah)) return { ok: false, galat: 'rusak' }
  const mentah = dariBase45(sisa)
  if (!mentah || mentah.byteLength < 5) return { ok: false, galat: 'rusak' }
  const data = mentah.subarray(0, mentah.byteLength - 4)
  const t = mentah.byteLength - 4
  const c = ((mentah[t] << 24) | (mentah[t + 1] << 16) | (mentah[t + 2] << 8) | mentah[t + 3]) >>> 0
  if (crc32(data) !== c) return { ok: false, galat: 'rusak' }
  return { ok: true, bingkai: { sesi, indeks, jumlah, data } }
}

/* ------------------------------ Penampung ------------------------------ */

export interface PenampungEstafet {
  sesi: string | null
  jumlah: number
  potongan: (Uint8Array | undefined)[]
  diterima: number
  dobel: number
  rusak: number
  /** bingkai dari kiriman lain (sesi berbeda) yang diabaikan */
  asing: number
}

export function penampungBaru(): PenampungEstafet {
  return { sesi: null, jumlah: 0, potongan: [], diterima: 0, dobel: 0, rusak: 0, asing: 0 }
}

export type HasilTampung = 'baru' | 'dobel' | 'rusak' | 'asing' | 'bukan'

/**
 * Masukkan satu teks QR ke penampung (tidak mengubah `p`; mengembalikan salinan).
 * Bingkai pertama yang sah menentukan sesi; bingkai sesi lain diabaikan.
 */
export function tampung(p: PenampungEstafet, teks: string): { p: PenampungEstafet; hasil: HasilTampung } {
  const b = bacaBingkai(teks)
  if (!b.ok) {
    if (b.galat === 'bukan') return { p, hasil: 'bukan' }
    return { p: { ...p, rusak: p.rusak + 1 }, hasil: 'rusak' }
  }
  const { sesi, indeks, jumlah, data } = b.bingkai
  if (p.sesi === null || p.diterima === 0) {
    const potongan: (Uint8Array | undefined)[] = new Array(jumlah)
    potongan[indeks] = data
    return { p: { ...p, sesi, jumlah, potongan, diterima: 1 }, hasil: 'baru' }
  }
  if (sesi !== p.sesi || jumlah !== p.jumlah) return { p: { ...p, asing: p.asing + 1 }, hasil: 'asing' }
  if (p.potongan[indeks]) return { p: { ...p, dobel: p.dobel + 1 }, hasil: 'dobel' }
  const potongan = p.potongan.slice()
  potongan[indeks] = data
  return { p: { ...p, potongan, diterima: p.diterima + 1 }, hasil: 'baru' }
}

export function persenEstafet(p: PenampungEstafet): number {
  return p.jumlah ? Math.round((p.diterima / p.jumlah) * 100) : 0
}

export function lengkap(p: PenampungEstafet): boolean {
  return p.jumlah > 0 && p.diterima === p.jumlah
}

/** Indeks bingkai yang belum diterima (untuk petunjuk "tinggal …"). */
export function bingkaiKurang(p: PenampungEstafet): number[] {
  const kurang: number[] = []
  for (let i = 0; i < p.jumlah; i++) if (!p.potongan[i]) kurang.push(i)
  return kurang
}

export type HasilRakit = { ok: true; nama: string; isi: Uint8Array; mime?: string } | { ok: false; alasan: string }

/** Gabung semua potongan, buka mampatan, lalu cocokkan CRC32 isi asli. */
export async function rakitEstafet(p: PenampungEstafet): Promise<HasilRakit> {
  if (!lengkap(p)) return { ok: false, alasan: `Baru ${p.diterima} dari ${p.jumlah} bingkai.` }
  const total = p.potongan.reduce((n, x) => n + (x?.byteLength ?? 0), 0)
  const muatan = new Uint8Array(total)
  let o = 0
  for (const x of p.potongan) {
    muatan.set(x!, o)
    o += x!.byteLength
  }
  if (muatan.byteLength < 4 || muatan[0] !== VERSI_MUATAN) {
    return { ok: false, alasan: 'Versi estafet tidak dikenal — perbarui DrillKit di kedua HP.' }
  }
  const metode = muatan[1]
  const panjangMeta = (muatan[2] << 8) | muatan[3]
  if (4 + panjangMeta > muatan.byteLength) return { ok: false, alasan: 'Kiriman rusak (meta terpotong).' }
  let meta: MetaMuatan
  try {
    meta = JSON.parse(dec.decode(muatan.subarray(4, 4 + panjangMeta))) as MetaMuatan
  } catch {
    return { ok: false, alasan: 'Kiriman rusak (meta tidak terbaca).' }
  }
  if (typeof meta?.n !== 'string' || typeof meta.u !== 'number' || typeof meta.c !== 'number' || meta.u > MAKS_ISI_BITA) {
    return { ok: false, alasan: 'Kiriman rusak (meta tidak sah).' }
  }
  const badan = muatan.subarray(4 + panjangMeta)
  let isi: Uint8Array
  if (metode === METODE_DEFLATE) {
    const Buka = ambilAliran('DecompressionStream')
    if (!Buka) return { ok: false, alasan: 'Peramban ini belum bisa membuka kiriman termampat — perbarui Chrome.' }
    try {
      isi = await alirkan(badan, Buka, MAKS_ISI_BITA)
    } catch {
      return { ok: false, alasan: 'Kiriman rusak (gagal dibuka).' }
    }
  } else if (metode === METODE_MENTAH) {
    isi = badan.slice()
  } else {
    return { ok: false, alasan: 'Metode kiriman tidak dikenal.' }
  }
  if (isi.byteLength !== meta.u || crc32(isi) !== meta.c >>> 0) {
    return { ok: false, alasan: 'Isi tidak cocok dengan sidik CRC32 — ulangi pemindaian.' }
  }
  return { ok: true, nama: rapikanNama(meta.n), isi, mime: typeof meta.m === 'string' ? meta.m : undefined }
}

/* ------------------------------ Perkiraan ------------------------------ */

/** Lama satu putaran tayang (detik, dibulatkan ke atas). */
export function detikPutaran(jumlahBingkai: number, fps: number): number {
  return Math.ceil(jumlahBingkai / Math.max(1, fps))
}

/** "12 KB" / "1,4 MB" — format ukuran ramah. */
export function formatUkuran(b: number): string {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`
  return `${(b / 1024 / 1024).toFixed(1).replace('.', ',')} MB`
}
