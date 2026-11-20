/**
 * v2.14 — Kehadiran bersama: logika murni (tanpa jaringan, tanpa Dexie).
 *
 * Satu daftar kehadiran dipakai bersama oleh pemilik, danlat, pencatat, dan
 * PH/asisten lewat proyek Supabase milik pelatih. Yang dikirim ke server
 * sengaja sesempit mungkin:
 *
 *   - **kerangka** — anggota (id, nama, panggilan, section, status aktif),
 *     sesi (judul, tanggal, jam, isian Form presensi), dan aturan program
 *     latihan. Hanya pemilik yang mengirim kerangka.
 *   - **kehadiran** — satu catatan per anggota per sesi, apa adanya.
 *
 * Nomor HP, kartu medis, kas, evaluasi, drill, musik, token QR anggota, dan
 * catatan pribadi lainnya **tidak pernah** ikut. Daftar putih ada di
 * `dataAnggota()` & `dataSesi()` — field baru tidak ikut terkirim sebelum
 * ditambahkan di sana dengan sengaja.
 *
 * Cara sinkron: setiap perangkat menyimpan sidik (hash) versi terakhir yang
 * sudah sama dengan server. Catatan yang sidiknya berubah dikirim; catatan
 * yang hilang dikirim sebagai `dihapus`. Sesudah itu perangkat menarik semua
 * baris yang berubah sejak tarikan terakhir. Satu catatan = satu anggota di
 * satu sesi, jadi dua perangkat yang mengisi orang yang sama memakai baris
 * yang sama di server (yang terakhir mengirim yang berlaku).
 */
import type { AttendanceRecord, KonfigServerTim, Member, ProgramLatihan, Session } from '../db/types'
import type { PeranStaf } from './kembaliMasuk'
export { KUNCI_KODE, KUNCI_MASUK, KUNCI_SIDIK, KUNCI_STATUS, bacaKembaliOAuth, type KembaliOAuth, type PeranStaf, type StatusServer } from './kembaliMasuk'

/* --------------------------------- Peran ---------------------------------- */

export const DAFTAR_PERAN: PeranStaf[] = ['pemilik', 'danlat', 'pencatat', 'pengamat']

export const LABEL_PERAN: Record<PeranStaf, string> = {
  pemilik: 'Pemilik',
  danlat: 'Danlat',
  pencatat: 'Pencatat',
  pengamat: 'PH & asisten',
}

export const KET_PERAN: Record<PeranStaf, string> = {
  pemilik: 'Mengatur anggota, sesi, dan aturan; mengundang staf; mengisi dan memutus kehadiran.',
  danlat: 'Mengisi kehadiran dan memutus izin, sakit, telat, serta pulang awal.',
  pencatat: 'Mengisi kehadiran (H/I/S/A, jam datang & pulang). Putusan tetap di tangan danlat.',
  pengamat: 'Melihat kehadiran dan rekap saja. Perubahan di perangkatnya tidak dikirim.',
}

export function peranSah(p: unknown): p is PeranStaf {
  return typeof p === 'string' && (DAFTAR_PERAN as string[]).includes(p)
}

/** Boleh mengirim catatan kehadiran (H/I/S/A, jam, izin). */
export function bolehIsi(p: PeranStaf | null | undefined): boolean {
  return p === 'pemilik' || p === 'danlat' || p === 'pencatat'
}

/** Putusan izin/telat dari peran ini diterima server. */
export function bolehPutus(p: PeranStaf | null | undefined): boolean {
  return p === 'pemilik' || p === 'danlat'
}

/** Hanya pemilik yang mengirim anggota, sesi, aturan, dan mengundang staf. */
export function bolehKerangka(p: PeranStaf | null | undefined): boolean {
  return p === 'pemilik'
}

/* --------------------------------- Konfig --------------------------------- */

export interface KonfigServer {
  url: string
  kunci: string
}

/** Isi payload JWT tanpa memeriksa tanda tangan — hanya untuk menolak kunci yang salah. */
function payloadJwt(t: string): Record<string, unknown> | null {
  const bagian = t.split('.')
  if (bagian.length !== 3) return null
  try {
    const b64 = bagian[1].replace(/-/g, '+').replace(/_/g, '/')
    const pad = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
    const teks = typeof atob === 'function' ? atob(pad) : ''
    return JSON.parse(teks) as Record<string, unknown>
  } catch {
    return null
  }
}

/** Kunci yang TIDAK boleh berada di aplikasi (melewati semua aturan akses). */
export function kunciRahasia(k: string): boolean {
  const t = k.trim()
  if (/^sb_secret_/i.test(t)) return true
  const p = payloadJwt(t)
  return !!p && p.role === 'service_role'
}

/** Pemeriksaan bentuk sebelum disimpan. Salah tempel adalah galat paling umum. */
export function periksaKonfigServer(k: KonfigServerTim): string[] {
  const masalah: string[] = []
  const url = (k.url ?? '').trim()
  const kunci = (k.kunci ?? '').trim()
  if (url) {
    if (!/^https:\/\//.test(url) && !LOKAL.test(url)) masalah.push('Alamat proyek diawali “https://”.')
    else if (/\/(rest|auth)\/v1/.test(url)) masalah.push('Cukup alamat proyeknya saja, tanpa “/rest/v1” atau “/auth/v1”.')
    else if (!/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)\/?$/.test(url) && !/^https:\/\/[^/]+\/?$/.test(url) && !LOKAL.test(url))
      masalah.push('Alamat proyek berbentuk https://xxxx.supabase.co.')
  }
  if (kunci) {
    if (kunciRahasia(kunci))
      masalah.push('Ini kunci RAHASIA (secret/service_role). Jangan pernah ditempel di aplikasi — pakai kunci publik (publishable).')
    else if (!/^sb_publishable_[A-Za-z0-9_-]{10,}$/.test(kunci) && !payloadJwt(kunci))
      masalah.push('Kunci publik diawali “sb_publishable_”.')
  }
  return masalah
}

/** Supabase lokal (CLI di komputer pengembang) boleh tanpa https. */
const LOKAL = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/

/** Gabungkan pengaturan tim dengan nilai bawaan build. Kunci rahasia tidak pernah dipakai. */
export function konfigServer(tim: KonfigServerTim | undefined, env: Record<string, string | undefined>): KonfigServer | null {
  const url = (tim?.url || env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '')
  const kunci = (tim?.kunci || env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY || '').trim()
  if (!url || !kunci || kunciRahasia(kunci) || (!/^https:\/\//.test(url) && !LOKAL.test(url))) return null
  return { url, kunci }
}

/** Ref proyek (subdomain) untuk ditampilkan — bukan untuk keamanan. */
export function refProyek(url: string): string {
  const m = url.match(/^https:\/\/([a-z0-9-]+)\.supabase\.(co|in)/)
  return m ? m[1] : url.replace(/^https:\/\//, '')
}

/* --------------------------------- Email ---------------------------------- */

/** Email dirapikan (huruf kecil, tanpa spasi) atau `null` bila bentuknya salah. */
export function emailSah(e: string): string | null {
  const t = e.trim().toLowerCase()
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(t) && t.length <= 254 ? t : null
}

/* ------------------------------ Masuk Google ------------------------------ */

/**
 * Alamat kembali sesudah masuk Google. DrillKit memakai HashRouter, jadi
 * kodenya dikirim balik sebagai `?code=` di alamat akar (bukan setelah `#`)
 * — rute aplikasinya dipulihkan sendiri sesudah kodenya diambil.
 */
export function alamatKembali(loc: { origin: string; pathname: string }): string {
  return `${loc.origin}${loc.pathname}`
}

/** Kalimat galat masuk yang dimengerti pemakai. */
export function pesanGalatMasuk(galat: string): string {
  const g = galat.toLowerCase()
  if (/access_denied|denied|cancel/.test(g)) return 'Masuk dibatalkan atau ditolak Google. Bila aplikasinya masih mode uji, pastikan email ini sudah didaftarkan sebagai test user.'
  if (/provider is not enabled|unsupported provider/.test(g)) return 'Login Google belum dinyalakan di Supabase (Authentication › Sign In / Providers › Google).'
  if (/redirect/.test(g)) return 'Alamat kembali belum diizinkan di Supabase (Authentication › URL Configuration).'
  if (/code verifier|flow state|pkce/.test(g)) return 'Sesi masuk kedaluwarsa. Ulangi “Masuk dengan Google” dari perangkat dan browser yang sama.'
  return `Masuk gagal: ${galat}`
}

/* ------------------------------- Kerangka --------------------------------- */

export type JenisKerangka = 'anggota' | 'sesi' | 'konfig'

/** Field anggota yang dikirim — daftar putih. */
export type DataAnggota = Pick<Member, 'id' | 'code' | 'name' | 'section' | 'role' | 'active'> &
  Partial<Pick<Member, 'panggilan' | 'alias' | 'instrument' | 'joinYear'>>

/** Field sesi yang dikirim — daftar putih. */
export type DataSesi = Pick<Session, 'id' | 'title' | 'type' | 'date' | 'startTime' | 'endTime'> &
  Partial<Pick<Session, 'place' | 'formPresensi' | 'formKeterangan'>>

export interface DataKonfig {
  programLatihan: ProgramLatihan[]
}

function tanpaKosong<T extends Record<string, unknown>>(o: T): T {
  const r: Record<string, unknown> = {}
  for (const k of Object.keys(o)) {
    const v = o[k]
    if (v === undefined || v === null || v === '') continue
    if (Array.isArray(v) && v.length === 0) continue
    r[k] = v
  }
  return r as T
}

export function dataAnggota(m: Member): DataAnggota {
  return tanpaKosong({
    id: m.id,
    code: m.code ?? '',
    name: m.name,
    panggilan: m.panggilan,
    alias: m.alias,
    section: m.section,
    instrument: m.instrument,
    role: m.role,
    joinYear: m.joinYear,
    active: m.active ? 1 : 0,
  }) as DataAnggota
}

export function dataSesi(s: Session): DataSesi {
  const fp = s.formPresensi && Object.keys(s.formPresensi).length ? s.formPresensi : undefined
  const fk = s.formKeterangan && Object.keys(s.formKeterangan).length ? s.formKeterangan : undefined
  return tanpaKosong({
    id: s.id,
    title: s.title,
    type: s.type,
    date: s.date,
    startTime: s.startTime,
    endTime: s.endTime,
    place: s.place,
    formPresensi: fp,
    formKeterangan: fk,
  }) as DataSesi
}

export function dataKonfig(program: ProgramLatihan[] | undefined): DataKonfig {
  return { programLatihan: program ?? [] }
}

/** Catatan kehadiran di server: semua field kehadiran tanpa `id` lokal. */
export type DataKehadiran = Omit<AttendanceRecord, 'id'>

/**
 * Catatan kehadiran apa adanya (semua field-nya memang data kehadiran), tanpa
 * field kosong dan **tanpa id lokal** — dua perangkat bisa memberi id berbeda
 * untuk orang yang sama di sesi yang sama; kuncinya di server (sesi|anggota).
 */
export function dataKehadiran(r: AttendanceRecord): DataKehadiran {
  const { id: _id, ...isi } = r
  void _id
  return tanpaKosong(isi as unknown as Record<string, unknown>) as unknown as DataKehadiran
}

/**
 * Anggota yang ikut dikirim: yang aktif, ditambah siapa pun yang punya catatan
 * kehadiran (supaya rekap sesi lama tetap bernama). Alumni tanpa catatan tidak.
 */
export function anggotaUntukServer(members: Member[], attendance: AttendanceRecord[]): Member[] {
  const tercatat = new Set(attendance.map((r) => r.memberId))
  return members.filter((m) => m.active || tercatat.has(m.id))
}

export const kunciKerangka = (jenis: JenisKerangka, id: string) => `${jenis}|${id}`
export const kunciKehadiran = (sessionId: string, memberId: string) => `${sessionId}|${memberId}`

export function pecahKunci(k: string): [string, string] {
  const i = k.indexOf('|')
  return [k.slice(0, i), k.slice(i + 1)]
}

/** Peta kerangka lokal pemilik: kunci → data. */
export function petaKerangka(members: Member[], sessions: Session[], attendance: AttendanceRecord[], program: ProgramLatihan[] | undefined): Map<string, unknown> {
  const peta = new Map<string, unknown>()
  for (const m of anggotaUntukServer(members, attendance)) peta.set(kunciKerangka('anggota', m.id), dataAnggota(m))
  for (const s of sessions) peta.set(kunciKerangka('sesi', s.id), dataSesi(s))
  peta.set(kunciKerangka('konfig', 'program'), dataKonfig(program))
  return peta
}

/**
 * Peta kehadiran lokal: kunci (sesi|anggota) → data. Hanya sesi & anggota yang
 * ada di kerangka server yang ikut, supaya data contoh atau data pribadi
 * perangkat staf tidak pernah terkirim. Duplikat lokal: catatan pertama dipakai.
 */
export function petaKehadiran(attendance: AttendanceRecord[], kenal: { sesi: Set<string>; anggota: Set<string> }): Map<string, DataKehadiran> {
  const peta = new Map<string, DataKehadiran>()
  for (const r of attendance) {
    if (!kenal.sesi.has(r.sessionId) || !kenal.anggota.has(r.memberId)) continue
    const k = kunciKehadiran(r.sessionId, r.memberId)
    if (!peta.has(k)) peta.set(k, dataKehadiran(r))
  }
  return peta
}

/** Id sesi & anggota yang dikenal server menurut sidik kerangka yang tersimpan. */
export function kenalDari(tersinkronKerangka: Record<string, string>): { sesi: Set<string>; anggota: Set<string> } {
  const sesi = new Set<string>()
  const anggota = new Set<string>()
  for (const k of Object.keys(tersinkronKerangka)) {
    const [j, id] = pecahKunci(k)
    if (j === 'sesi') sesi.add(id)
    else if (j === 'anggota') anggota.add(id)
  }
  return { sesi, anggota }
}

/* ---------------------------------- Sidik --------------------------------- */

/** JSON dengan kunci berurutan — sidik tidak boleh bergantung urutan field. */
export function jsonUrut(x: unknown): string {
  if (x === null || typeof x !== 'object') return JSON.stringify(x) ?? 'null'
  if (Array.isArray(x)) return `[${x.map((v) => (v === undefined ? 'null' : jsonUrut(v))).join(',')}]`
  const o = x as Record<string, unknown>
  const kunci = Object.keys(o)
    .filter((k) => o[k] !== undefined)
    .sort()
  return `{${kunci.map((k) => `${JSON.stringify(k)}:${jsonUrut(o[k])}`).join(',')}}`
}

/** Sidik pendek (FNV-1a 2×32 bit) — cukup untuk mendeteksi perubahan, bukan untuk keamanan. */
export function sidik(x: unknown): string {
  const s = jsonUrut(x)
  let a = 0x811c9dc5
  let b = 0x01000193 ^ s.length
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    a = Math.imul(a ^ c, 0x01000193) >>> 0
    b = Math.imul(b ^ c ^ (a >>> 7), 0x5bd1e995) >>> 0
  }
  return a.toString(36) + b.toString(36)
}

/** Sidik catatan kehadiran (tanpa id lokal). */
export function sidikKehadiran(r: AttendanceRecord): string {
  return sidik(dataKehadiran(r))
}

/* --------------------------------- Rencana -------------------------------- */

export interface RencanaKirim<T> {
  kirim: { kunci: string; data: T }[]
  hapus: string[]
}

/** Apa yang berubah dibanding versi terakhir yang sama dengan server. */
export function rencanakanKirim<T>(lokal: Map<string, T>, tersinkron: Record<string, string>): RencanaKirim<T> {
  const kirim: { kunci: string; data: T }[] = []
  for (const [kunci, data] of lokal) if (tersinkron[kunci] !== sidik(data)) kirim.push({ kunci, data })
  const hapus = Object.keys(tersinkron).filter((k) => !lokal.has(k))
  return { kirim, hapus }
}

/* ---------------------- Penjaga program kosong (v2.15.1) ------------------- */

export const KUNCI_PROGRAM = kunciKerangka('konfig', 'program')

/**
 * Rencana kirim pemilik memuat program latihan **kosong** yang belum pernah
 * disepakati kosong dengan server. Bila ya, putaran wajib memeriksa server
 * dulu: program kosong di perangkat hampir selalu akibat pengaturan yang
 * hilang (pulihkan backup lama, data situs terhapus, perangkat baru), bukan
 * keputusan menghapus semua program. Tanpa penjaga ini kiriman itu menimpa
 * program di server, lalu semua perangkat staf ikut kehilangan programnya.
 */
export function programKosongPerluDicek(rencana: RencanaKirim<unknown>, tersinkron: Record<string, string>): boolean {
  const item = rencana.kirim.find((k) => k.kunci === KUNCI_PROGRAM)
  if (!item) return false
  const d = item.data as Partial<DataKonfig> | undefined
  if (Array.isArray(d?.programLatihan) && d.programLatihan.length > 0) return false
  return tersinkron[KUNCI_PROGRAM] !== sidik(dataKonfig([]))
}

/** Rencana yang sama tanpa satu kunci (kiriman ditahan). */
export function tahanKunci<T>(rencana: RencanaKirim<T>, kunci: string): RencanaKirim<T> {
  return { kirim: rencana.kirim.filter((k) => k.kunci !== kunci), hapus: rencana.hapus.filter((k) => k !== kunci) }
}

/** Jumlah program di baris konfig server (0 bila tidak ada, dihapus, atau rusak). */
export function jumlahProgramServer(baris: { data?: unknown; dihapus?: boolean } | null | undefined): number {
  if (!baris || baris.dihapus) return 0
  const p = (baris.data as Partial<DataKonfig> | undefined)?.programLatihan
  return Array.isArray(p) ? p.length : 0
}

/** Kalimat peringatan saat kiriman program kosong ditahan. */
export function pesanProgramDitahan(n: number): string {
  return `Program latihan di perangkat ini kosong, sedangkan server masih menyimpan ${n} program. Kiriman program ditahan supaya program di server tidak terhapus. Pilih “Ambil dari server” untuk memulihkannya, atau “Kosongkan di server” bila memang semua program sengaja dihapus.`
}

/** Kunci yang berubah di perangkat tetapi tidak boleh dikirim peran ini (akan dikembalikan). */
export function kunciMenyimpang<T>(lokal: Map<string, T>, tersinkron: Record<string, string>): string[] {
  const r: string[] = []
  for (const [k, v] of lokal) if (k in tersinkron && tersinkron[k] !== sidik(v)) r.push(k)
  for (const k of Object.keys(tersinkron)) if (!lokal.has(k)) r.push(k)
  return r
}

/* ----------------------------- Terapkan tarikan --------------------------- */

/** Anggota lokal sesudah kerangka server diterapkan. Field lokal lain (HP, catatan) tidak disentuh. */
export function terapkanAnggota(lokal: Member | undefined, d: DataAnggota, buatToken: () => string, kini: number): Member {
  const dasar: Member = lokal ?? {
    id: d.id,
    code: '',
    name: d.name,
    section: d.section,
    instrument: '',
    role: d.role,
    joinYear: d.joinYear ?? new Date(kini).getFullYear(),
    active: 1,
    token: buatToken(),
    createdAt: kini,
  }
  const r: Member = { ...dasar }
  for (const k of ['panggilan', 'alias', 'instrument', 'joinYear'] as const) {
    if (d[k] === undefined) delete (r as unknown as Record<string, unknown>)[k]
  }
  Object.assign(r, tanpaKosong({ ...d }), { instrument: d.instrument ?? '', joinYear: d.joinYear ?? dasar.joinYear })
  return r
}

/** Sesi lokal sesudah kerangka server diterapkan. Rundown, Pacu, dll. tetap milik perangkat. */
export function terapkanSesi(lokal: Session | undefined, d: DataSesi, kini: number): Session {
  const dasar: Session = lokal ?? { ...d, checklist: [], createdAt: kini }
  const r: Session = { ...dasar }
  for (const k of ['place', 'formPresensi', 'formKeterangan'] as const) {
    if (d[k] === undefined) delete (r as unknown as Record<string, unknown>)[k]
  }
  return Object.assign(r, tanpaKosong({ ...d }))
}

/** Catatan kehadiran lokal dari baris server. Id lokal dipertahankan bila orangnya sudah tercatat. */
export function terapkanKehadiran(
  lokal: AttendanceRecord | undefined,
  d: DataKehadiran & { id?: string },
  sesiId: string,
  anggotaId: string,
  buatId: () => string,
): AttendanceRecord {
  const { id: _abaikan, ...isi } = d
  void _abaikan
  return { ...isi, id: lokal?.id ?? buatId(), sessionId: sesiId, memberId: anggotaId }
}

/* ---------------------------------- Kursor -------------------------------- */

/** Tarikan diulang sedikit ke belakang: transaksi yang selesai belakangan tidak terlewat. */
export const TUMPANG_TARIK_MS = 2 * 60_000

export function kursorTarik(kursor: string | null | undefined): string {
  if (!kursor) return '1970-01-01T00:00:00Z'
  const t = Date.parse(kursor)
  return Number.isFinite(t) ? new Date(t - TUMPANG_TARIK_MS).toISOString() : '1970-01-01T00:00:00Z'
}

export function kursorBaru(lama: string | null | undefined, baris: { diubah_at: string }[]): string | null {
  let maks = lama && Number.isFinite(Date.parse(lama)) ? lama : null
  for (const b of baris) if (!maks || Date.parse(b.diubah_at) > Date.parse(maks)) maks = b.diubah_at
  return maks
}

/* --------------------------------- Status --------------------------------- */



export interface SidikTersimpan {
  timId?: string
  kerangka: Record<string, string>
  kehadiran: Record<string, string>
  kursorKerangka?: string | null
  kursorKehadiran?: string | null
}

export function sidikKosong(timId?: string): SidikTersimpan {
  return { timId, kerangka: {}, kehadiran: {}, kursorKerangka: null, kursorKehadiran: null }
}

/** Teks singkat kapan terakhir sinkron. */
export function kapanSinkron(at: number | undefined, kini: number): string {
  if (!at) return 'belum pernah'
  const beda = kini - at
  if (beda < 60_000) return 'baru saja'
  if (beda < 3_600_000) return `${Math.floor(beda / 60_000)} menit lalu`
  if (beda < 86_400_000) return `${Math.floor(beda / 3_600_000)} jam lalu`
  const hari = Math.floor(beda / 86_400_000)
  return hari === 1 ? 'kemarin' : `${hari} hari lalu`
}
