/**
 * v2.10.1 — Sambungan Google Drive langsung dari browser.
 *
 * Tidak ada server DrillKit di tengah: browser meminta izin ke Google (Google
 * Identity Services), lalu memanggil Drive/Sheets API sendiri. Data berjalan
 * dari perangkat ini ke Google dan kembali — sama seperti membuka Drive.
 *
 * **Izinnya sempit:** `drive.file` — DrillKit hanya bisa membuka berkas yang
 * kamu pilih sendiri lewat pemilih berkas Google (Picker) dan berkas yang ia
 * buat sendiri (folder & berkas backup). Seluruh isi Drive lainnya tidak
 * terlihat. Google menggolongkan izin ini non-sensitif.
 *
 * Batas yang perlu diketahui, dan sengaja dikatakan di antarmuka:
 *
 * 1. **Izin berlaku ±1 jam.** Tanpa server, browser tidak boleh menyimpan
 *    izin jangka panjang. Sesudah itu perlu satu ketukan "Sambungkan" lagi
 *    (tanpa mengetik kata sandi bila sudah masuk Google). Selama izin masih
 *    berlaku, semua yang otomatis (backup, periksa rundown) berjalan sendiri.
 * 2. **Butuh internet.** Bila offline, tombolnya mati dengan keterangan;
 *    fitur DrillKit lain tetap jalan.
 * 3. **Butuh proyek Google Cloud milik pelatih** (Client ID, API key, nomor
 *    proyek) — lihat `PANDUAN-GOOGLE-DRIVE.md`.
 *
 * Modul ini hanya dimuat saat dibutuhkan (impor dinamis), supaya bundel awal
 * tidak bertambah.
 */
import type { KonfigGoogleTim } from '../db/types'

/* --------------------------------- Konfig --------------------------------- */

export const SCOPE_DRIVE = 'https://www.googleapis.com/auth/drive.file'

export interface KonfigGoogle {
  clientId: string
  apiKey: string
  appId: string
}

const ENV = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {}

/** Gabungkan pengaturan tim dengan nilai bawaan build (`VITE_GOOGLE_*`). */
export function konfigGoogle(tim?: KonfigGoogleTim): KonfigGoogle | null {
  const clientId = (tim?.clientId || ENV.VITE_GOOGLE_CLIENT_ID || '').trim()
  const apiKey = (tim?.apiKey || ENV.VITE_GOOGLE_API_KEY || '').trim()
  const appId = (tim?.appId || ENV.VITE_GOOGLE_APP_ID || '').trim()
  if (!clientId || !apiKey || !appId) return null
  return { clientId, apiKey, appId }
}

/** Pemeriksaan bentuk pengenal sebelum dipakai — salah tempel adalah galat paling umum. */
export function periksaKonfig(k: KonfigGoogleTim): string[] {
  const masalah: string[] = []
  const c = (k.clientId ?? '').trim()
  const a = (k.apiKey ?? '').trim()
  const p = (k.appId ?? '').trim()
  if (c && !/\.apps\.googleusercontent\.com$/.test(c)) masalah.push('Client ID biasanya berakhiran “.apps.googleusercontent.com”.')
  if (a && !/^AIza[0-9A-Za-z_-]{20,}$/.test(a)) masalah.push('API key biasanya diawali “AIza”.')
  if (p && !/^\d{6,}$/.test(p)) masalah.push('Nomor proyek berupa angka saja (bukan ID proyek bernama).')
  if (c && /^\d+-/.test(c) && /^\d{6,}$/.test(p) && !c.startsWith(`${p}-`)) masalah.push('Angka di depan Client ID biasanya sama dengan nomor proyek — periksa lagi.')
  return masalah
}

/* --------------------------------- Galat ---------------------------------- */

export type KodeGalatGoogle = 'belum-diatur' | 'offline' | 'batal' | 'popup' | 'kedaluwarsa' | 'ditolak' | 'tidak-ada' | 'api'

export class GalatGoogle extends Error {
  constructor(
    public kode: KodeGalatGoogle,
    pesan: string,
  ) {
    super(pesan)
    this.name = 'GalatGoogle'
  }
}

/** Kalimat untuk toast — satu tempat, supaya semua layar berbahasa sama. */
export function pesanGalat(e: unknown): string {
  if (e instanceof GalatGoogle) return e.message
  return `Google Drive: ${e instanceof Error ? e.message : String(e)}`
}

export const online = () => typeof navigator === 'undefined' || navigator.onLine !== false

/* ------------------------------ Tipe Google ------------------------------- */

interface JawabanToken {
  access_token?: string
  expires_in?: number | string
  error?: string
  error_description?: string
}
interface KlienToken {
  callback: (r: JawabanToken) => void
  requestAccessToken(o?: { prompt?: string }): void
}
interface PickerDoc {
  id: string
  name: string
  mimeType: string
  url?: string
  lastEditedUtc?: number
}
interface PickerData {
  action: string
  docs?: PickerDoc[]
}
interface GoogleGlobal {
  accounts?: {
    oauth2: {
      initTokenClient(o: {
        client_id: string
        scope: string
        callback: (r: JawabanToken) => void
        error_callback?: (e: { type?: string; message?: string }) => void
      }): KlienToken
      revoke(token: string, done?: () => void): void
    }
  }
  picker?: {
    PickerBuilder: new () => PembangunPicker
    DocsView: new (viewId?: string) => TampilanDocs
    ViewId: Record<string, string>
    Action: { PICKED: string; CANCEL: string }
    Feature?: Record<string, string>
  }
}
interface TampilanDocs {
  setMimeTypes(m: string): TampilanDocs
  setIncludeFolders(v: boolean): TampilanDocs
  setSelectFolderEnabled(v: boolean): TampilanDocs
  setMode?(m: string): TampilanDocs
}
interface PembangunPicker {
  addView(v: TampilanDocs): PembangunPicker
  setOAuthToken(t: string): PembangunPicker
  setDeveloperKey(k: string): PembangunPicker
  setAppId(id: string): PembangunPicker
  setCallback(f: (d: PickerData) => void): PembangunPicker
  setTitle(t: string): PembangunPicker
  setLocale(l: string): PembangunPicker
  setOrigin?(o: string): PembangunPicker
  enableFeature?(f: string): PembangunPicker
  build(): { setVisible(v: boolean): void }
}
interface JendelaGoogle {
  google?: GoogleGlobal
  gapi?: { load(nama: string, o: (() => void) | { callback: () => void; onerror?: () => void }): void }
}
const w = () => window as unknown as JendelaGoogle

/* ------------------------------ Muat skrip -------------------------------- */

const skripDimuat = new Map<string, Promise<void>>()

function muatSkrip(src: string): Promise<void> {
  const ada = skripDimuat.get(src)
  if (ada) return ada
  const p = new Promise<void>((ok, gagal) => {
    const el = document.createElement('script')
    el.src = src
    el.async = true
    el.defer = true
    el.onload = () => ok()
    el.onerror = () => {
      skripDimuat.delete(src)
      gagal(new GalatGoogle(online() ? 'api' : 'offline', online() ? 'Pustaka Google tidak bisa dimuat — periksa koneksi atau pemblokir iklan.' : 'Sedang offline — Google Drive butuh internet.'))
    }
    document.head.appendChild(el)
  })
  skripDimuat.set(src, p)
  return p
}

async function muatGis(): Promise<void> {
  if (w().google?.accounts?.oauth2) return
  await muatSkrip('https://accounts.google.com/gsi/client')
}

async function muatPicker(): Promise<void> {
  if (w().google?.picker) return
  if (!w().gapi) await muatSkrip('https://apis.google.com/js/api.js')
  await new Promise<void>((ok, gagal) =>
    w().gapi!.load('picker', { callback: () => ok(), onerror: () => gagal(new GalatGoogle('api', 'Pemilih berkas Google tidak bisa dimuat.')) }),
  )
}

/**
 * Muat pustaka Google lebih awal (saat layar Drive dibuka), supaya jendela
 * izin bisa dibuka langsung dari ketukan. Browser memblokir jendela sembul
 * yang muncul terlalu lama sesudah ketukan.
 */
export function siapkan(): void {
  if (!online()) return
  void muatGis().catch(() => undefined)
  void muatPicker().catch(() => undefined)
}

/* --------------------------------- Token ---------------------------------- */

export const KUNCI_TOKEN = 'drillkit.google.token'
let token: { akses: string; habis: number } | null = null
let klien: { id: string; k: KlienToken } | null = null
let tunggu: { ok: (t: string) => void; gagal: (e: unknown) => void } | null = null
const pemirsa = new Set<() => void>()

function bacaToken(): { akses: string; habis: number } | null {
  if (token) return token
  try {
    const t = JSON.parse(sessionStorage.getItem(KUNCI_TOKEN) ?? 'null') as { akses: string; habis: number } | null
    if (t?.akses && t.habis > Date.now()) token = t
  } catch {
    /* sessionStorage tidak tersedia */
  }
  return token
}

function simpanToken(t: { akses: string; habis: number } | null) {
  token = t
  try {
    if (t) sessionStorage.setItem(KUNCI_TOKEN, JSON.stringify(t))
    else sessionStorage.removeItem(KUNCI_TOKEN)
  } catch {
    /* abaikan */
  }
  for (const f of pemirsa) f()
  // Untuk penjaga backup di tingkat aplikasi, yang tidak memuat modul ini.
  try {
    window.dispatchEvent(new Event('drillkit-google'))
  } catch {
    /* bukan browser */
  }
}

/** Izin masih berlaku (dengan cadangan 1 menit)? */
export function tersambung(): boolean {
  const t = bacaToken()
  return !!t && t.habis - 60_000 > Date.now()
}

/** Kapan izin habis (epoch ms); 0 = tidak tersambung. */
export function habisPada(): number {
  return tersambung() ? bacaToken()!.habis : 0
}

/** Beri tahu saat status sambungan berubah. */
export function pantauSambungan(f: () => void): () => void {
  pemirsa.add(f)
  return () => pemirsa.delete(f)
}

/**
 * Minta izin (atau perbarui izin yang habis). **Panggil langsung dari
 * ketukan pengguna** — Google membuka jendela kecil, dan browser hanya
 * mengizinkannya sebagai jawaban atas ketukan.
 */
export async function sambung(k: KonfigGoogle, opsi: { pilihAkun?: boolean } = {}): Promise<string> {
  if (!online()) throw new GalatGoogle('offline', 'Sedang offline — Google Drive butuh internet.')
  if (!opsi.pilihAkun && tersambung()) return bacaToken()!.akses
  await muatGis()
  const g = w().google!.accounts!.oauth2
  if (!klien || klien.id !== k.clientId) {
    klien = {
      id: k.clientId,
      k: g.initTokenClient({
        client_id: k.clientId,
        scope: SCOPE_DRIVE,
        callback: () => undefined,
        error_callback: (e) => {
          const t = tunggu
          tunggu = null
          if (!t) return
          if (e?.type === 'popup_closed') t.gagal(new GalatGoogle('batal', 'Jendela Google ditutup sebelum selesai.'))
          else if (e?.type === 'popup_failed_to_open') t.gagal(new GalatGoogle('popup', 'Jendela Google diblokir browser — izinkan pop-up untuk situs ini, lalu coba lagi.'))
          else t.gagal(new GalatGoogle('api', e?.message || 'Google menolak permintaan izin.'))
        },
      }),
    }
  }
  return new Promise<string>((ok, gagal) => {
    tunggu = { ok, gagal }
    klien!.k.callback = (r) => {
      const t = tunggu
      tunggu = null
      if (!t) return
      if (r.error || !r.access_token) {
        const ditolak = r.error === 'access_denied'
        t.gagal(
          new GalatGoogle(
            ditolak ? 'ditolak' : 'api',
            ditolak
              ? 'Izin Google Drive tidak diberikan. Bila akunmu belum terdaftar sebagai pengguna uji di proyek Google Cloud, tambahkan dulu.'
              : `Google: ${r.error_description || r.error || 'izin gagal'}`,
          ),
        )
        return
      }
      const detik = Number(r.expires_in) || 3600
      simpanToken({ akses: r.access_token, habis: Date.now() + detik * 1000 })
      t.ok(r.access_token)
    }
    klien!.k.requestAccessToken({ prompt: opsi.pilihAkun ? 'select_account' : '' })
  })
}

/** Putuskan: cabut izin di Google & lupakan token di perangkat ini. */
export function putus(): void {
  const t = bacaToken()
  simpanToken(null)
  try {
    if (t && w().google?.accounts?.oauth2) w().google!.accounts!.oauth2.revoke(t.akses)
  } catch {
    /* tetap terputus di sisi DrillKit */
  }
}

/* ---------------------------------- REST ---------------------------------- */

const DRIVE = 'https://www.googleapis.com/drive/v3'
const UNGGAH = 'https://www.googleapis.com/upload/drive/v3'
const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets'

async function api(url: string, init: RequestInit = {}): Promise<Response> {
  if (!online()) throw new GalatGoogle('offline', 'Sedang offline — Google Drive butuh internet.')
  const t = bacaToken()
  if (!t || t.habis <= Date.now()) {
    simpanToken(null)
    throw new GalatGoogle('kedaluwarsa', 'Izin Google Drive sudah habis — ketuk “Sambungkan” lagi.')
  }
  let r: Response
  try {
    r = await fetch(url, { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${t.akses}` } })
  } catch {
    throw new GalatGoogle(online() ? 'api' : 'offline', online() ? 'Tidak bisa menghubungi Google — periksa koneksi.' : 'Sedang offline — Google Drive butuh internet.')
  }
  if (r.status === 401) {
    simpanToken(null)
    throw new GalatGoogle('kedaluwarsa', 'Izin Google Drive sudah habis — ketuk “Sambungkan” lagi.')
  }
  if (r.status === 404) throw new GalatGoogle('tidak-ada', 'Berkas tidak ditemukan — mungkin dihapus, dipindah ke sampah, atau belum dipilih lewat DrillKit.')
  if (!r.ok) {
    let pesan = `${r.status}`
    try {
      const j = (await r.json()) as { error?: { message?: string; status?: string } }
      pesan = j.error?.message || pesan
      if (j.error?.status === 'PERMISSION_DENIED' && /has not been used|is disabled/i.test(pesan)) {
        pesan = 'API Google ini belum diaktifkan di proyek Google Cloud-mu (Drive API / Sheets API). Pengaturan → Google Drive → Atur → langkah 2.'
      }
    } catch {
      /* bukan JSON */
    }
    throw new GalatGoogle('api', `Google Drive: ${pesan}`)
  }
  return r
}

const json = async <T>(r: Promise<Response>) => (await (await r).json()) as T

/* --------------------------------- Berkas --------------------------------- */

export const MIME = {
  docs: 'application/vnd.google-apps.document',
  sheets: 'application/vnd.google-apps.spreadsheet',
  folder: 'application/vnd.google-apps.folder',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  csv: 'text/csv',
  teks: 'text/plain',
  html: 'text/html',
  json: 'application/json',
} as const

export interface BerkasDrive {
  id: string
  name: string
  mimeType: string
  modifiedTime?: string
  webViewLink?: string
}

/** Jenis berkas yang ditawarkan pemilih. */
export type JenisPilih = 'rundown' | 'sheet'

const MIME_PILIH: Record<JenisPilih, string> = {
  rundown: [MIME.docs, MIME.sheets, MIME.docx, MIME.csv, MIME.teks, MIME.html].join(','),
  sheet: [MIME.sheets, MIME.csv].join(','),
}

/**
 * Buka pemilih berkas Google. Berkas yang dipilih di sini — dan hanya itu —
 * yang boleh dibaca DrillKit (`drive.file`). `null` = dibatalkan.
 */
export async function pilihBerkas(k: KonfigGoogle, jenis: JenisPilih, judul: string): Promise<BerkasDrive | null> {
  const akses = await sambung(k)
  await muatPicker()
  const p = w().google!.picker!
  return new Promise<BerkasDrive | null>((ok) => {
    const view = new p.DocsView(p.ViewId.DOCS).setMimeTypes(MIME_PILIH[jenis]).setIncludeFolders(true).setSelectFolderEnabled(false)
    let b = new p.PickerBuilder()
      .addView(view)
      .setOAuthToken(akses)
      .setDeveloperKey(k.apiKey)
      .setAppId(k.appId)
      .setTitle(judul)
      .setLocale('id')
      .setCallback((d) => {
        if (d.action === p.Action.PICKED && d.docs?.[0]) {
          const x = d.docs[0]
          ok({ id: x.id, name: x.name, mimeType: x.mimeType })
        } else if (d.action === p.Action.CANCEL) ok(null)
      })
    if (b.setOrigin) b = b.setOrigin(window.location.origin)
    if (b.enableFeature && p.Feature?.SUPPORT_DRIVES) b = b.enableFeature(p.Feature.SUPPORT_DRIVES)
    b.build().setVisible(true)
  })
}

/** Metadata satu berkas (nama, jenis, kapan terakhir diubah). */
export function infoBerkas(id: string): Promise<BerkasDrive> {
  return json<BerkasDrive>(api(`${DRIVE}/files/${encodeURIComponent(id)}?fields=id,name,mimeType,modifiedTime,webViewLink&supportsAllDrives=true`))
}

/** Isi rundown dari Drive dalam bentuk yang dimengerti `lib/rundown.ts`. */
export type IsiRundownDrive =
  | { jenis: 'html'; html: string }
  | { jenis: 'teks'; teks: string }
  | { jenis: 'docx'; bita: Uint8Array }
  | { jenis: 'sheet'; tab: string; tabs: string[]; nilai: string[][] }

export async function ambilIsiRundown(b: BerkasDrive, tab?: string): Promise<IsiRundownDrive> {
  const id = encodeURIComponent(b.id)
  if (b.mimeType === MIME.docs) {
    const r = await api(`${DRIVE}/files/${id}/export?mimeType=${encodeURIComponent(MIME.html)}`)
    return { jenis: 'html', html: await r.text() }
  }
  if (b.mimeType === MIME.sheets) {
    const t = await tabSheet(b.id)
    const pakai = tab && t.includes(tab) ? tab : t[0]
    return { jenis: 'sheet', tab: pakai, tabs: t, nilai: await nilaiSheet(b.id, pakai) }
  }
  const r = await api(`${DRIVE}/files/${id}?alt=media&supportsAllDrives=true`)
  if (b.mimeType === MIME.docx || /\.docx$/i.test(b.name)) return { jenis: 'docx', bita: new Uint8Array(await r.arrayBuffer()) }
  const teks = await r.text()
  return b.mimeType === MIME.html || /\.html?$/i.test(b.name) ? { jenis: 'html', html: teks } : { jenis: 'teks', teks }
}

/* --------------------------------- Sheets --------------------------------- */

/** Nama tab sebuah Google Sheet, berurutan. */
export async function tabSheet(id: string): Promise<string[]> {
  const j = await json<{ sheets?: { properties?: { title?: string; index?: number } }[] }>(
    api(`${SHEETS}/${encodeURIComponent(id)}?fields=sheets.properties(title,index)`),
  )
  return (j.sheets ?? [])
    .map((s) => s.properties ?? {})
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .map((p) => p.title ?? '')
    .filter(Boolean)
}

/** Seluruh nilai satu tab (teks seperti tampil di layar). */
export async function nilaiSheet(id: string, tab?: string): Promise<string[][]> {
  const rentang = tab ? `'${tab.replace(/'/g, "''")}'` : 'A:ZZ'
  const j = await json<{ values?: unknown[][] }>(
    api(`${SHEETS}/${encodeURIComponent(id)}/values/${encodeURIComponent(rentang)}?majorDimension=ROWS&valueRenderOption=FORMATTED_VALUE`),
  )
  return (j.values ?? []).map((b) => b.map((x) => String(x ?? '')))
}

/** Isi CSV/Sheet jawaban Form → teks CSV (dibaca `bacaCsvForm`). */
export async function ambilCsvForm(b: { id: string; mimeType?: string }, tab?: string): Promise<{ teks: string; tab?: string; tabs: string[] }> {
  if (b.mimeType && b.mimeType !== MIME.sheets) {
    const r = await api(`${DRIVE}/files/${encodeURIComponent(b.id)}?alt=media&supportsAllDrives=true`)
    return { teks: await r.text(), tabs: [] }
  }
  const tabs = await tabSheet(b.id)
  const pakai = tab && tabs.includes(tab) ? tab : tabs[0]
  const nilai = await nilaiSheet(b.id, pakai)
  return { teks: keCsv(nilai), tab: pakai, tabs }
}

/** Baris nilai → CSV berkutip (sel bisa memuat koma/baris baru). */
export function keCsv(nilai: string[][]): string {
  const lebar = Math.max(0, ...nilai.map((b) => b.length))
  return nilai
    .map((b) =>
      Array.from({ length: lebar }, (_, i) => {
        const s = b[i] ?? ''
        return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
      }).join(','),
    )
    .join('\n')
}

/* ---------------------------------- Akun ---------------------------------- */

export async function akun(): Promise<{ email: string; nama: string } | null> {
  try {
    const j = await json<{ user?: { emailAddress?: string; displayName?: string } }>(api(`${DRIVE}/about?fields=user(emailAddress,displayName)`))
    return j.user?.emailAddress ? { email: j.user.emailAddress, nama: j.user.displayName ?? '' } : null
  } catch {
    return null
  }
}

/* --------------------------------- Backup --------------------------------- */

export const NAMA_FOLDER_BACKUP = 'DrillKit Backup'

/** Folder backup buatan DrillKit; dibuat bila belum ada (atau sudah dihapus). */
export async function folderBackup(idLama?: string): Promise<{ id: string; webViewLink?: string }> {
  if (idLama) {
    try {
      const f = await json<{ id: string; trashed?: boolean; webViewLink?: string }>(api(`${DRIVE}/files/${encodeURIComponent(idLama)}?fields=id,trashed,webViewLink`))
      if (!f.trashed) return f
    } catch (e) {
      if (!(e instanceof GalatGoogle) || e.kode !== 'tidak-ada') throw e
    }
  }
  // `drive.file`: pencarian hanya melihat berkas buatan DrillKit sendiri — itulah yang dicari.
  const q = `mimeType='${MIME.folder}' and name='${NAMA_FOLDER_BACKUP}' and trashed=false`
  const cari = await json<{ files?: { id: string; webViewLink?: string }[] }>(api(`${DRIVE}/files?q=${encodeURIComponent(q)}&fields=files(id,webViewLink)&spaces=drive`))
  if (cari.files?.[0]) return cari.files[0]
  return json<{ id: string; webViewLink?: string }>(
    api(`${DRIVE}/files?fields=id,webViewLink`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: NAMA_FOLDER_BACKUP, mimeType: MIME.folder, description: 'Backup otomatis DrillKit. Satu berkas per hari; 14 hari terakhir disimpan.' }),
    }),
  )
}

/** Berkas backup di folder (terbaru dulu). */
export async function daftarBackup(folderId: string): Promise<BerkasDrive[]> {
  const q = `'${folderId}' in parents and trashed=false and mimeType='${MIME.json}'`
  const j = await json<{ files?: BerkasDrive[] }>(
    api(`${DRIVE}/files?q=${encodeURIComponent(q)}&orderBy=modifiedTime desc&pageSize=100&fields=files(id,name,mimeType,modifiedTime,webViewLink)&spaces=drive`),
  )
  return j.files ?? []
}

/** Batas unggah satu permintaan (multipart); lebih besar memakai unggah bertahap. */
const BATAS_MULTIPART = 4 * 1024 * 1024

/**
 * Tulis backup: berkas hari ini ditimpa (satu berkas per hari), berkas
 * baru dibuat bila belum ada. Lalu berkas lebih tua dari `simpan` terbaru
 * dibuang — hanya yang dibuat DrillKit di folder ini.
 */
export async function unggahBackup(
  folderId: string,
  nama: string,
  teks: string,
  simpan = 14,
): Promise<{ id: string; dibuang: number }> {
  const ada = (await daftarBackup(folderId)).find((f) => f.name === nama)
  const bita = new TextEncoder().encode(teks)
  const meta = ada ? { name: nama } : { name: nama, parents: [folderId], mimeType: MIME.json }
  let id: string
  if (bita.length <= BATAS_MULTIPART) {
    const batas = `drillkit${Math.random().toString(36).slice(2)}`
    const tubuh = new Blob([
      `--${batas}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${batas}\r\nContent-Type: application/json\r\n\r\n`,
      bita,
      `\r\n--${batas}--`,
    ])
    const url = ada ? `${UNGGAH}/files/${encodeURIComponent(ada.id)}?uploadType=multipart&fields=id` : `${UNGGAH}/files?uploadType=multipart&fields=id`
    id = (await json<{ id: string }>(api(url, { method: ada ? 'PATCH' : 'POST', headers: { 'Content-Type': `multipart/related; boundary=${batas}` }, body: tubuh }))).id
  } else {
    const url = ada ? `${UNGGAH}/files/${encodeURIComponent(ada.id)}?uploadType=resumable` : `${UNGGAH}/files?uploadType=resumable`
    const awal = await api(url, {
      method: ada ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': MIME.json, 'X-Upload-Content-Length': String(bita.length) },
      body: JSON.stringify(meta),
    })
    const lokasi = awal.headers.get('Location')
    if (!lokasi) throw new GalatGoogle('api', 'Google Drive tidak memberi alamat unggah — coba lagi nanti.')
    id = (await json<{ id: string }>(api(lokasi, { method: 'PUT', headers: { 'Content-Type': MIME.json }, body: bita }))).id
  }
  let dibuang = 0
  const semua = (await daftarBackup(folderId)).filter((f) => /^DrillKit - BACKUP LENGKAP - \d{4}-\d{2}-\d{2}\.json$/.test(f.name))
  semua.sort((a, b) => b.name.localeCompare(a.name))
  for (const f of semua.slice(simpan)) {
    try {
      await api(`${DRIVE}/files/${encodeURIComponent(f.id)}`, { method: 'DELETE' })
      dibuang++
    } catch {
      /* berkas lama yang gagal dibuang dicoba lagi lain kali */
    }
  }
  return { id, dibuang }
}

/** Unduh satu berkas backup (untuk Pulihkan dari Drive). */
export async function unduhTeks(id: string): Promise<string> {
  const r = await api(`${DRIVE}/files/${encodeURIComponent(id)}?alt=media`)
  return r.text()
}
