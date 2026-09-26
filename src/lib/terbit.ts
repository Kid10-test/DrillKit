/**
 * Terbitkan materi ke anggota — bagian pertama.
 *
 * Pelatih menekan satu tombol. Berkas grup (sama dengan yang diunduh
 * manual) ditulis ke repo GitHub lewat Contents API. Anggota tetap
 * mengambil `paket.json` di situs yang sama; rewrite Vercel yang
 * mengarah ke berkas mentah dipasang sekali.
 *
 * Token hanya hidup di localStorage perangkat pelatih. Modul ini tidak
 * menulisnya ke IndexedDB, backup, atau paket. Kunci pribadi per anggota
 * belum ada — itu bagian berikutnya. Terbitan ini sengaja hanya materi
 * grup, tanpa absensi dan tanpa catatan.
 */

import type { ShareBundle, Song } from '../db/types'
import { paketGrup } from './bagikan'

export const NAMA_BERKAS = 'paket.json'
export const KUNCI_TERBIT = 'drillkit.terbit'
const API = 'https://api.github.com'

export const PESAN_TOKEN_DITOLAK =
  'Token ditolak atau sudah kedaluwarsa. Buat token baru di GitHub (fine-grained, hanya Contents pada repo ini), lalu tempel lagi di Pengaturan → Terbitkan ke anggota.'

export const PESAN_LURING =
  'Tidak ada koneksi. Tombol terbit ditolak. Unduh berkas grup, lalu unggah paket.json secara manual.'

export interface AturTerbit {
  pemilik: string
  repo: string
  token: string
  /** Cabang tempat berkas ditulis. Bawaan `main`. */
  cabang: string
}

export interface Permintaan {
  url: string
  method: 'GET' | 'PUT'
  headers: Record<string, string>
  body?: string
}

export interface Jawaban {
  status: number
  json: unknown
  teks: string
}

export type Pengirim = (p: Permintaan) => Promise<Jawaban>

export interface HasilUji {
  baik: boolean
  pesan: string
  adaBerkas: boolean
}

export interface HasilTulis {
  ok: boolean
  pesan: string
  sha?: string
}

export interface RiwayatTerbit {
  sha: string
  pesan: string
  tanggal: string
}

export interface RingkasTerbit {
  jadwal: number
  show: number
  lagu: number
  anggota: number
  /** Selalu 0 sampai kunci pribadi ada. */
  terkunci: number
  tanpaKunci: string[]
}

const BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

/* -------------------------------- Penyimpanan ----------------------------- */

export function bacaAtur(): AturTerbit | null {
  try {
    const raw = localStorage.getItem(KUNCI_TERBIT)
    if (!raw) return null
    const j = JSON.parse(raw) as Partial<AturTerbit>
    const rapi = rapikanAtur(j)
    return 'salah' in rapi ? null : rapi
  } catch {
    return null
  }
}

export function simpanAtur(atur: AturTerbit | null): void {
  try {
    if (!atur) localStorage.removeItem(KUNCI_TERBIT)
    else localStorage.setItem(KUNCI_TERBIT, JSON.stringify(atur))
  } catch {
    /* localStorage diblokir — pemanggil yang memberitahu */
  }
}

export function rapikanAtur(masuk: Partial<AturTerbit> | null | undefined): AturTerbit | { salah: string } {
  if (!masuk) return { salah: 'Isi pemilik, repo, dan token dulu.' }
  const pemilik = (masuk.pemilik ?? '').trim()
  const repo = (masuk.repo ?? '').trim().replace(/\.git$/, '')
  const token = (masuk.token ?? '').trim()
  const cabang = (masuk.cabang ?? '').trim() || 'main'
  if (!pemilik || !repo || !token) return { salah: 'Pemilik, nama repo, dan token wajib diisi.' }
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(pemilik)) {
    return { salah: 'Nama pemilik tidak sah. Contoh: nama-github.' }
  }
  if (!/^[A-Za-z0-9._-]{1,100}$/.test(repo)) {
    return { salah: 'Nama repo tidak sah. Contoh: drillkit-materi.' }
  }
  if (token.length < 8 || /\s/.test(token)) return { salah: 'Token tidak berbentuk token GitHub.' }
  if (!/^[A-Za-z0-9._/-]{1,100}$/.test(cabang)) return { salah: 'Nama cabang tidak sah.' }
  return { pemilik, repo, token, cabang }
}

/** Terima `pemilik/repo` atau URL GitHub yang ditempel utuh. */
export function bacaAlamatRepo(teks: string): { pemilik: string; repo: string } | null {
  const t = teks.trim()
  const url = t.match(/github\.com\/([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+)/i)
  if (url) return { pemilik: url[1], repo: url[2].replace(/\.git$/, '') }
  const pendek = t.match(/^([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+)$/)
  if (pendek) return { pemilik: pendek[1], repo: pendek[2].replace(/\.git$/, '') }
  return null
}

/* --------------------------------- Jaringan ------------------------------- */

function tajuk(token: string, tulis = false): Record<string, string> {
  const h: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
  }
  if (tulis) h['Content-Type'] = 'application/json'
  return h
}

function jalur(atur: AturTerbit, ekor: string): string {
  return `${API}/repos/${encodeURIComponent(atur.pemilik)}/${encodeURIComponent(atur.repo)}${ekor}`
}

export function permintaanRepo(atur: AturTerbit): Permintaan {
  return { url: jalur(atur, ''), method: 'GET', headers: tajuk(atur.token) }
}

export function permintaanBerkas(atur: AturTerbit, ref?: string): Permintaan {
  const q = ref ? `?ref=${encodeURIComponent(ref)}` : ''
  return { url: jalur(atur, `/contents/${NAMA_BERKAS}${q}`), method: 'GET', headers: tajuk(atur.token) }
}

export function permintaanRiwayat(atur: AturTerbit): Permintaan {
  return {
    url: jalur(atur, `/commits?path=${NAMA_BERKAS}&per_page=8`),
    method: 'GET',
    headers: tajuk(atur.token),
  }
}

export function permintaanTulis(atur: AturTerbit, isi: string, sha: string | undefined, pesan: string): Permintaan {
  return {
    url: jalur(atur, `/contents/${NAMA_BERKAS}`),
    method: 'PUT',
    headers: tajuk(atur.token, true),
    body: badanTulis({ pesan, isi, sha, cabang: atur.cabang }),
  }
}

export function urlMentah(atur: Pick<AturTerbit, 'pemilik' | 'repo' | 'cabang'>): string {
  return `https://raw.githubusercontent.com/${atur.pemilik}/${atur.repo}/${atur.cabang}/${NAMA_BERKAS}`
}

export function cuplikanVercel(atur: Pick<AturTerbit, 'pemilik' | 'repo' | 'cabang'>): string {
  return JSON.stringify(
    { rewrites: [{ source: `/${NAMA_BERKAS}`, destination: urlMentah(atur) }] },
    null,
    2,
  )
}

function pesanMentah(json: unknown): string {
  if (json && typeof json === 'object' && 'message' in json && typeof (json as { message: unknown }).message === 'string') {
    return (json as { message: string }).message
  }
  return ''
}

export function pesanGalat(status: number, json: unknown, konteks: 'repo' | 'berkas' | 'tulis'): string {
  if (status === 401) return PESAN_TOKEN_DITOLAK
  if (status === 403) {
    const m = pesanMentah(json).toLowerCase()
    if (m.includes('rate limit')) return 'GitHub membatasi permintaan. Tunggu beberapa menit, lalu coba lagi.'
    return 'Token tidak berhak membaca atau menulis Contents di repo ini. Pada token fine-grained, izinkan Contents: Read and write, hanya untuk repo ini.'
  }
  if (status === 404) {
    if (konteks === 'repo') {
      return 'Repo tidak ditemukan. Periksa nama pemilik dan nama repo, dan pastikan token boleh melihat repo itu.'
    }
    return 'Berkas materi belum ada di repo.'
  }
  if (status === 409) return 'Berkas di GitHub baru saja berubah. Coba terbitkan sekali lagi.'
  if (status === 422) return 'GitHub menolak berkasnya. Mungkin terlalu besar untuk dikirim sekaligus.'
  const tambahan = pesanMentah(json)
  return tambahan ? `GitHub menjawab ${status}. ${tambahan}` : `GitHub menjawab ${status}.`
}

function shaDari(json: unknown): string | undefined {
  if (json && typeof json === 'object' && 'sha' in json && typeof (json as { sha: unknown }).sha === 'string') {
    return (json as { sha: string }).sha
  }
  return undefined
}

function privat(json: unknown): boolean {
  return !!json && typeof json === 'object' && (json as { private?: boolean }).private === true
}

export async function ujiSambungan(atur: AturTerbit, kirim: Pengirim): Promise<HasilUji> {
  const repo = await kirim(permintaanRepo(atur))
  if (repo.status !== 200) {
    return { baik: false, pesan: pesanGalat(repo.status, repo.json, 'repo'), adaBerkas: false }
  }
  if (privat(repo.json)) {
    return {
      baik: false,
      pesan: 'Repo ini privat. Anggota tidak bisa mengambil materinya. Ubah repo menjadi publik, lalu uji lagi.',
      adaBerkas: false,
    }
  }
  const berkas = await kirim(permintaanBerkas(atur))
  if (berkas.status === 200) {
    return { baik: true, pesan: 'Sambungan baik. Repo publik, dan paket.json sudah ada — terbitan berikutnya menimpanya.', adaBerkas: true }
  }
  if (berkas.status === 404) {
    return { baik: true, pesan: 'Sambungan baik. Repo publik. paket.json belum ada — terbitan pertama yang akan membuatnya.', adaBerkas: false }
  }
  return { baik: false, pesan: pesanGalat(berkas.status, berkas.json, 'berkas'), adaBerkas: false }
}

async function tulis(
  atur: AturTerbit,
  isi: string,
  sha: string | undefined,
  pesan: string,
  kirim: Pengirim,
): Promise<HasilTulis> {
  const jawab = await kirim(permintaanTulis(atur, isi, sha, pesan))
  if (jawab.status === 200 || jawab.status === 201) {
    return { ok: true, pesan: 'Materi terbit.', sha: shaDari(jawab.json) }
  }
  if (jawab.status === 409) {
    const ulang = await kirim(permintaanBerkas(atur))
    const shaBaru = shaDari(ulang.json)
    if (ulang.status !== 200 || !shaBaru || shaBaru === sha) {
      return { ok: false, pesan: pesanGalat(409, jawab.json, 'tulis') }
    }
    const kedua = await kirim(permintaanTulis(atur, isi, shaBaru, pesan))
    if (kedua.status === 200 || kedua.status === 201) {
      return { ok: true, pesan: 'Materi terbit.', sha: shaDari(kedua.json) }
    }
    return { ok: false, pesan: pesanGalat(kedua.status, kedua.json, 'tulis') }
  }
  return { ok: false, pesan: pesanGalat(jawab.status, jawab.json, 'tulis') }
}

export async function terbitkan(atur: AturTerbit, isi: string, kirim: Pengirim): Promise<HasilTulis> {
  const ada = await kirim(permintaanBerkas(atur))
  if (ada.status !== 200 && ada.status !== 404) {
    return { ok: false, pesan: pesanGalat(ada.status, ada.json, ada.status === 404 ? 'berkas' : 'tulis') }
  }
  const sha = ada.status === 200 ? shaDari(ada.json) : undefined
  if (ada.status === 200 && !sha) return { ok: false, pesan: 'GitHub tidak mengirim sidik berkas. Coba lagi.' }
  const cap = tanggalIndonesia(Date.now())
  return tulis(atur, isi, sha, `Terbitkan materi DrillKit — ${cap}`, kirim)
}

export function bacaRiwayat(json: unknown): RiwayatTerbit[] {
  if (!Array.isArray(json)) return []
  const out: RiwayatTerbit[] = []
  for (const item of json) {
    if (!item || typeof item !== 'object') continue
    const sha = (item as { sha?: unknown }).sha
    const komit = (item as { commit?: { message?: unknown; author?: { date?: unknown } } }).commit
    if (typeof sha !== 'string' || !komit) continue
    const pesan = typeof komit.message === 'string' ? komit.message.split('\n')[0] : 'Terbitan'
    const tanggal = typeof komit.author?.date === 'string' ? komit.author.date : ''
    out.push({ sha, pesan, tanggal })
  }
  return out
}

export async function muatRiwayat(atur: AturTerbit, kirim: Pengirim): Promise<RiwayatTerbit[] | { salah: string }> {
  const jawab = await kirim(permintaanRiwayat(atur))
  if (jawab.status === 409) return []
  if (jawab.status === 404) return []
  if (jawab.status !== 200) return { salah: pesanGalat(jawab.status, jawab.json, 'repo') }
  return bacaRiwayat(jawab.json)
}

export async function kembalikan(atur: AturTerbit, shaKomit: string, kirim: Pengirim): Promise<HasilTulis> {
  const lama = await kirim(permintaanBerkas(atur, shaKomit))
  if (lama.status !== 200) return { ok: false, pesan: pesanGalat(lama.status, lama.json, 'berkas') }
  const isi = bacaIsiBerkas(lama.json)
  if (isi == null) return { ok: false, pesan: 'Isi terbitan lama tidak bisa dibaca.' }
  const kini = await kirim(permintaanBerkas(atur))
  if (kini.status !== 200 && kini.status !== 404) return { ok: false, pesan: pesanGalat(kini.status, kini.json, 'tulis') }
  const sha = kini.status === 200 ? shaDari(kini.json) : undefined
  const cap = tanggalIndonesia(Date.now())
  return tulis(atur, isi, sha, `Kembalikan materi ke terbitan ${cap}`, kirim)
}

/** Jaringan gagal — bukan jawaban GitHub. */
export async function kirimGithub(p: Permintaan): Promise<Jawaban> {
  let res: Response
  try {
    res = await fetch(p.url, { method: p.method, headers: p.headers, body: p.body, cache: 'no-store' })
  } catch {
    throw new Error(PESAN_LURING)
  }
  const teks = await res.text()
  let json: unknown = null
  try {
    json = teks ? JSON.parse(teks) : null
  } catch {
    json = null
  }
  return { status: res.status, json, teks }
}

/* --------------------------------- Isi berkas ------------------------------ */

export function siapTerbit(b: ShareBundle): string {
  return JSON.stringify(paketGrup(b))
}

export function ringkasTerbit(b: ShareBundle): RingkasTerbit {
  const grup = paketGrup(b)
  return {
    jadwal: grup.sessions?.length ?? 0,
    show: grup.drills?.length ?? 0,
    lagu: grup.songs?.length ?? 0,
    anggota: grup.members?.length ?? 0,
    terkunci: 0,
    tanpaKunci: (grup.members ?? []).map((m) => m.name),
  }
}

const BIDANG_LATIH = ['ulang', 'ulangBagian', 'panjangBirama', 'latih', 'suara', 'getar', 'volume'] as const

/**
 * Lagu dari pelatih menang untuk isi musiknya. Setelan latihan yang
 * anggota ubah sendiri di HP-nya — dibanding paket sebelumnya — tidak
 * ditimpa.
 */
export function gabungLagu(baru: Song[], lamaPaket: Song[] | undefined, lokal: Song[]): Song[] {
  const dariLama = new Map((lamaPaket ?? []).map((s) => [s.id, s]))
  const dariLokal = new Map(lokal.map((s) => [s.id, s]))
  return baru.map((s) => {
    const diLokal = dariLokal.get(s.id)
    if (!diLokal) return s
    const diLama = dariLama.get(s.id)
    const jaga: Partial<Song> = {}
    for (const k of BIDANG_LATIH) {
      const nilaiLokal = diLokal[k]
      if (nilaiLokal === undefined) continue
      const beda = JSON.stringify(nilaiLokal ?? null) !== JSON.stringify(diLama?.[k] ?? null)
      if (beda) jaga[k] = nilaiLokal as never
    }
    return { ...s, ...jaga }
  })
}

/**
 * Pembaruan dari situs tidak menimpa yang anggota catat sendiri.
 *
 * Absensi, catatan, dan penanda "untuk siapa" selalu dari paket yang
 * sudah ada di HP. Berkas di alamat situs adalah berkas grup — meniru
 * absensinya (yang memang kosong) akan menghapus riwayat setiap kali
 * pelatih menerbitkan.
 */
export function gabungPembaruan(
  baru: ShareBundle,
  lama: ShareBundle | null | undefined,
  laguLokal: Song[] = [],
): ShareBundle {
  return {
    ...baru,
    songs: gabungLagu(baru.songs ?? [], lama?.songs, laguLokal),
    attendance: lama?.attendance ?? [],
    memberNotes: lama?.memberNotes ?? [],
    forMember: lama?.forMember,
    namaPenerima: lama?.namaPenerima,
  }
}

export function materiLebihBaru(lokalAt: number | undefined, jarakAt: number | undefined): boolean {
  if (jarakAt == null || !Number.isFinite(jarakAt)) return false
  if (lokalAt == null || !Number.isFinite(lokalAt)) return true
  return jarakAt > lokalAt
}

export function tanggalIndonesia(at: number): string {
  const d = new Date(at)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`
}

/* --------------------------------- Base64 ---------------------------------- */

const ABJAD = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

export function sandiTeks(teks: string): string {
  const bytes = new TextEncoder().encode(teks)
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0
    const n = (a << 16) | (b << 8) | c
    out += ABJAD[(n >> 18) & 63]
    out += ABJAD[(n >> 12) & 63]
    out += i + 1 < bytes.length ? ABJAD[(n >> 6) & 63] : '='
    out += i + 2 < bytes.length ? ABJAD[n & 63] : '='
  }
  return out
}

export function bacaSandi(sandi: string): string {
  const bersih = sandi.replace(/\s/g, '')
  const bytes: number[] = []
  for (let i = 0; i < bersih.length; i += 4) {
    const c0 = ABJAD.indexOf(bersih[i] ?? 'A')
    const c1 = ABJAD.indexOf(bersih[i + 1] ?? 'A')
    const c2 = bersih[i + 2] === '=' ? -1 : ABJAD.indexOf(bersih[i + 2] ?? 'A')
    const c3 = bersih[i + 3] === '=' ? -1 : ABJAD.indexOf(bersih[i + 3] ?? 'A')
    const n = ((c0 < 0 ? 0 : c0) << 18) | ((c1 < 0 ? 0 : c1) << 12) | ((c2 < 0 ? 0 : c2) << 6) | (c3 < 0 ? 0 : c3)
    bytes.push((n >> 16) & 255)
    if (c2 >= 0) bytes.push((n >> 8) & 255)
    if (c3 >= 0) bytes.push(n & 255)
  }
  return new TextDecoder().decode(new Uint8Array(bytes))
}

export function badanTulis(opts: { pesan: string; isi: string; sha?: string; cabang: string }): string {
  const o: Record<string, string> = {
    message: opts.pesan,
    content: sandiTeks(opts.isi),
    branch: opts.cabang,
  }
  if (opts.sha) o.sha = opts.sha
  return JSON.stringify(o)
}

export function bacaIsiBerkas(json: unknown): string | null {
  if (!json || typeof json !== 'object') return null
  const isi = (json as { content?: unknown; encoding?: unknown }).content
  const encoding = (json as { encoding?: unknown }).encoding
  if (typeof isi !== 'string') return null
  if (encoding && encoding !== 'base64') return null
  try {
    return bacaSandi(isi)
  } catch {
    return null
  }
}
