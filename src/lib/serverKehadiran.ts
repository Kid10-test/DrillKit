/**
 * v2.14 — Kehadiran bersama: sambungan ke Supabase milik pelatih.
 *
 * Modul ini dimuat malas (impor dinamis) — pustaka Supabase tidak ikut bundel
 * awal, dan perangkat yang tidak memakai kehadiran bersama tidak pernah
 * mengunduhnya. Semua fitur DrillKit lain tetap jalan tanpa internet; yang
 * butuh jaringan hanya kirim/tarik kehadiran, dan itu dicoba ulang sendiri
 * begitu sinyal kembali.
 *
 * Logika murninya (peran, daftar putih field, sidik, rencana kirim) ada di
 * `kehadiranBersama.ts` dan diuji tanpa peramban. Aturan akses yang
 * sesungguhnya dijaga server (RLS di `supabase/v2.14.0-kehadiran-bersama.sql`)
 * — aplikasi hanya menyesuaikan tampilan.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { liveQuery } from 'dexie'
import { db, saveSettings } from '../db/db'
import type { AttendanceRecord, Member, Session } from '../db/types'
import { uid } from './utils'
import {
  KUNCI_KODE,
  KUNCI_MASUK,
  KUNCI_PROGRAM,
  KUNCI_SIDIK,
  KUNCI_STATUS,
  alamatKembali,
  bolehIsi,
  bolehKerangka,
  dataAnggota,
  dataKehadiran,
  dataKonfig,
  dataSesi,
  emailSah,
  jumlahProgramServer,
  kenalDari,
  konfigServer,
  kunciKehadiran,
  kunciKerangka,
  kunciMenyimpang,
  kursorBaru,
  kursorTarik,
  pecahKunci,
  peranSah,
  pesanGalatMasuk,
  petaKehadiran,
  petaKerangka,
  programKosongPerluDicek,
  rencanakanKirim,
  sidik,
  sidikKosong,
  tahanKunci,
  terapkanAnggota,
  terapkanKehadiran,
  terapkanSesi,
  type DataAnggota,
  type DataKehadiran,
  type DataKonfig,
  type DataSesi,
  type JenisKerangka,
  type KonfigServer,
  type PeranStaf,
  type SidikTersimpan,
  type StatusServer,
} from './kehadiranBersama'

export type { StatusServer, PeranStaf }

const ENV = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {}

/* --------------------------------- Status --------------------------------- */

export function bacaStatus(): StatusServer {
  try {
    return (JSON.parse(localStorage.getItem(KUNCI_STATUS) ?? '{}') as StatusServer) ?? {}
  } catch {
    return {}
  }
}

export function tulisStatus(patch: Partial<StatusServer>, ganti = false): StatusServer {
  const baru = { ...(ganti ? {} : bacaStatus()), ...patch }
  for (const k of Object.keys(baru) as (keyof StatusServer)[]) if (baru[k] === undefined) delete baru[k]
  try {
    localStorage.setItem(KUNCI_STATUS, JSON.stringify(baru))
  } catch {
    /* penyimpanan penuh — status hanya penanda tampilan */
  }
  window.dispatchEvent(new Event('drillkit-server'))
  return baru
}

function bacaSidik(timId: string): SidikTersimpan {
  try {
    const s = JSON.parse(localStorage.getItem(KUNCI_SIDIK) ?? 'null') as SidikTersimpan | null
    if (s && s.timId === timId && s.kerangka && s.kehadiran) return s
  } catch {
    /* rusak → mulai dari awal; tarikan pertama menyamakan semuanya lagi */
  }
  return sidikKosong(timId)
}

function tulisSidik(s: SidikTersimpan) {
  try {
    localStorage.setItem(KUNCI_SIDIK, JSON.stringify(s))
  } catch {
    /* tanpa sidik, putaran berikutnya hanya mengirim ulang yang sama */
  }
}

/* --------------------------------- Klien ---------------------------------- */

let klien: { kunci: string; c: SupabaseClient } | null = null

export async function konfigAktif(): Promise<KonfigServer | null> {
  const s = await db.settings.get('team')
  return konfigServer(s?.serverKehadiran, ENV)
}

async function dapatKlien(): Promise<SupabaseClient | null> {
  const k = await konfigAktif()
  if (!k) return null
  const kunci = `${k.url}|${k.kunci}`
  if (klien?.kunci === kunci) return klien.c
  const c = createClient(k.url, k.kunci, {
    auth: {
      flowType: 'pkce',
      detectSessionInUrl: false,
      persistSession: true,
      autoRefreshToken: true,
      storageKey: 'drillkit-supabase',
    },
  })
  klien = { kunci, c }
  return c
}

/* --------------------------------- Galat ---------------------------------- */

export class GalatServer extends Error {
  constructor(
    public kode: 'belum-diatur' | 'perlu-masuk' | 'belum-diundang' | 'offline' | 'ditolak' | 'belum-dipasang' | 'server',
    pesan: string,
  ) {
    super(pesan)
    this.name = 'GalatServer'
  }
}

function terjemahkan(e: unknown): GalatServer {
  if (e instanceof GalatServer) return e
  const o = (e ?? {}) as { message?: string; code?: string; status?: number }
  const pesan = o.message ?? String(e)
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return new GalatServer('offline', 'Sedang offline — kehadiran dikirim begitu ada sinyal.')
  if (/Failed to fetch|NetworkError|Load failed|fetch failed/i.test(pesan))
    return new GalatServer('offline', 'Server tidak terjangkau. Periksa sinyal; bila proyek Supabase sedang dijeda, buka dasbor Supabase lalu Restore.')
  if (o.code === '42501' || /row-level security|permission denied/i.test(pesan))
    return new GalatServer('ditolak', 'Peranmu tidak mengizinkan perubahan ini.')
  if (o.code === '42P01' || o.code === 'PGRST205' || o.code === 'PGRST202' || /could not find the (table|function)/i.test(pesan))
    return new GalatServer('belum-dipasang', 'Tabel server belum dibuat. Jalankan berkas supabase/v2.14.0-kehadiran-bersama.sql di Supabase › SQL Editor.')
  if (/JWT|refresh token|session/i.test(pesan)) return new GalatServer('perlu-masuk', 'Sesi masuk berakhir — masuk lagi dengan Google.')
  return new GalatServer('server', `Server: ${pesan}`)
}

export function pesanGalat(e: unknown): string {
  return terjemahkan(e).message
}

/* ------------------------------ Masuk & keluar ---------------------------- */

/** Akun yang sedang masuk di perangkat ini (tanpa jaringan bila sesinya masih tersimpan). */
export async function akun(): Promise<{ email: string } | null> {
  const c = await dapatKlien()
  if (!c) return null
  const { data } = await c.auth.getSession()
  const email = data.session?.user?.email
  return email ? { email: email.toLowerCase() } : null
}

/** Pindah ke halaman Google. Kembali ke alamat akar membawa `?code=`. */
export async function masukGoogle(): Promise<void> {
  const c = await dapatKlien()
  if (!c) throw new GalatServer('belum-diatur', 'Server kehadiran belum diatur.')
  if (location.protocol !== 'https:' && !/^(localhost|127\.0\.0\.1)$/.test(location.hostname))
    throw new GalatServer('server', 'Masuk Google hanya bisa dari alamat https (mis. situs DrillKit yang di-hosting), bukan dari berkas lokal.')
  try {
    localStorage.setItem(KUNCI_MASUK, JSON.stringify({ at: Date.now(), kembali: location.hash || '#/pengaturan' }))
  } catch {
    /* tanpa penanda, kode tetap ditukar bila ada */
  }
  const { error } = await c.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: alamatKembali(location), queryParams: { prompt: 'select_account' } },
  })
  if (error) throw terjemahkan(error)
}

/** Tukar kode masuk yang disimpan `main.tsx` menjadi sesi. */
export async function tukarKodeMasuk(): Promise<boolean> {
  let kode: string | null = null
  let galat: string | null = null
  try {
    kode = sessionStorage.getItem(KUNCI_KODE)
    galat = sessionStorage.getItem(`${KUNCI_KODE}.galat`)
    sessionStorage.removeItem(KUNCI_KODE)
    sessionStorage.removeItem(`${KUNCI_KODE}.galat`)
  } catch {
    return false
  }
  if (galat) {
    tulisStatus({ galat: pesanGalatMasuk(galat) })
    return false
  }
  if (!kode) return false
  const c = await dapatKlien()
  if (!c) return false
  const { error } = await c.auth.exchangeCodeForSession(kode)
  if (error) {
    tulisStatus({ galat: pesanGalatMasuk(error.message) })
    return false
  }
  tulisStatus({ aktif: true, galat: undefined })
  await muatTim().catch((e) => tulisStatus({ galat: pesanGalat(e) }))
  return true
}

/** Keluar dari perangkat ini saja. Data di perangkat tetap ada. */
export async function keluar(): Promise<void> {
  const c = await dapatKlien()
  if (c) await c.auth.signOut({ scope: 'local' }).catch(() => undefined)
  try {
    localStorage.removeItem(KUNCI_SIDIK)
  } catch {
    /* abaikan */
  }
  tulisStatus({}, true)
}

/* ---------------------------------- Tim ----------------------------------- */

interface BarisTimSaya {
  tim_id: string
  nama_tim: string
  peran: string
  nama: string | null
}

export async function muatTim(): Promise<StatusServer> {
  const c = await dapatKlien()
  if (!c) throw new GalatServer('belum-diatur', 'Server kehadiran belum diatur.')
  const a = await akun()
  if (!a) throw new GalatServer('perlu-masuk', 'Belum masuk.')
  const { data, error } = await c.rpc('tim_saya')
  if (error) throw terjemahkan(error)
  const daftar = ((data ?? []) as BarisTimSaya[]).filter((b) => peranSah(b.peran))
  const lama = bacaStatus()
  const pilih = daftar.find((b) => b.tim_id === lama.timId) ?? daftar[0]
  if (!pilih) return tulisStatus({ email: a.email, belumDiundang: true, timId: undefined, namaTim: undefined, peran: undefined, galat: undefined })
  return tulisStatus({ email: a.email, belumDiundang: undefined, timId: pilih.tim_id, namaTim: pilih.nama_tim, peran: pilih.peran as PeranStaf, galat: undefined })
}

export interface Staf {
  email: string
  peran: PeranStaf
  nama: string | null
  masuk_at: string | null
}

export async function daftarStaf(timId: string): Promise<Staf[]> {
  const c = await dapatKlien()
  if (!c) return []
  const { data, error } = await c.from('staf_tim').select('email,peran,nama,masuk_at').eq('tim_id', timId).order('dibuat_at')
  if (error) throw terjemahkan(error)
  return (data ?? []) as Staf[]
}

export async function undangStaf(timId: string, email: string, peran: PeranStaf, nama: string): Promise<void> {
  const e = emailSah(email)
  if (!e) throw new GalatServer('server', 'Bentuk email belum benar.')
  const c = await dapatKlien()
  if (!c) throw new GalatServer('belum-diatur', 'Server kehadiran belum diatur.')
  const { error } = await c.from('staf_tim').insert({ tim_id: timId, email: e, peran, nama: nama.trim().slice(0, 60) || null })
  if (error) {
    if (error.code === '23505') throw new GalatServer('server', 'Email ini sudah ada di daftar staf.')
    throw terjemahkan(error)
  }
}

export async function ubahPeranStaf(timId: string, email: string, peran: PeranStaf): Promise<void> {
  const c = await dapatKlien()
  if (!c) return
  const { error } = await c.from('staf_tim').update({ peran }).eq('tim_id', timId).eq('email', email)
  if (error) throw /pemilik/i.test(error.message) ? new GalatServer('ditolak', 'Tim harus punya minimal satu pemilik.') : terjemahkan(error)
}

export async function hapusStaf(timId: string, email: string): Promise<void> {
  const c = await dapatKlien()
  if (!c) return
  const { error } = await c.from('staf_tim').delete().eq('tim_id', timId).eq('email', email)
  if (error) throw /pemilik/i.test(error.message) ? new GalatServer('ditolak', 'Tim harus punya minimal satu pemilik.') : terjemahkan(error)
}

/* --------------------------------- Sinkron -------------------------------- */

interface BarisKerangka {
  jenis: JenisKerangka
  id: string
  data: unknown
  dihapus: boolean
  diubah_at: string
}

interface BarisKehadiran {
  sesi_id: string
  anggota_id: string
  data: DataKehadiran
  dihapus: boolean
  diubah_at: string
}

export interface HasilSinkron {
  dikirim: number
  diterima: number
  /** v2.15.1 — kiriman program kosong ditahan; jumlah program yang masih ada di server. */
  programDitahan?: number
}

const POTONG = 300
const HALAMAN = 1000

function potong<T>(xs: T[], n = POTONG): T[][] {
  const r: T[][] = []
  for (let i = 0; i < xs.length; i += n) r.push(xs.slice(i, i + n))
  return r
}

async function tarikSejak<T extends { diubah_at: string }>(
  c: SupabaseClient,
  tabel: 'kerangka' | 'kehadiran',
  kolom: string,
  timId: string,
  kursor: string | null | undefined,
): Promise<T[]> {
  const semua: T[] = []
  let sejak = kursorTarik(kursor)
  for (let putaran = 0; putaran < 50; putaran++) {
    const { data, error } = await c.from(tabel).select(kolom).eq('tim_id', timId).gt('diubah_at', sejak).order('diubah_at').limit(HALAMAN)
    if (error) throw terjemahkan(error)
    const baris = (data ?? []) as unknown as T[]
    semua.push(...baris)
    if (baris.length < HALAMAN) break
    sejak = baris[baris.length - 1].diubah_at
  }
  return semua
}

function petaKerangkaSemua(members: Member[], sessions: Session[], program: Parameters<typeof dataKonfig>[0]): Map<string, unknown> {
  const peta = new Map<string, unknown>()
  for (const m of members) peta.set(kunciKerangka('anggota', m.id), dataAnggota(m))
  for (const s of sessions) peta.set(kunciKerangka('sesi', s.id), dataSesi(s))
  peta.set(kunciKerangka('konfig', 'program'), dataKonfig(program))
  return peta
}

let sedangSinkron: Promise<HasilSinkron> | null = null

/** Satu putaran kirim + tarik. Putaran yang sedang berjalan dipakai bersama. */
export function sinkronkan(): Promise<HasilSinkron> {
  if (!sedangSinkron) {
    sedangSinkron = putaran()
      .then((h) => {
        tulisStatus({ terakhir: Date.now(), galat: undefined, dikirim: h.dikirim, diterima: h.diterima, programDitahan: h.programDitahan })
        return h
      })
      .catch((e) => {
        const g = terjemahkan(e)
        tulisStatus({ galat: g.message })
        throw g
      })
      .finally(() => {
        sedangSinkron = null
      })
  }
  return sedangSinkron
}

async function putaran(): Promise<HasilSinkron> {
  const c = await dapatKlien()
  if (!c) throw new GalatServer('belum-diatur', 'Server kehadiran belum diatur.')
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new GalatServer('offline', 'Sedang offline — kehadiran dikirim begitu ada sinyal.')
  if (!(await akun())) throw new GalatServer('perlu-masuk', 'Belum masuk — ketuk “Masuk dengan Google”.')
  const st = await muatTim()
  if (!st.timId || !st.peran) throw new GalatServer('belum-diundang', `Akun ${st.email ?? ''} belum diundang ke tim mana pun.`)
  const timId = st.timId
  const peran = st.peran
  const sd = bacaSidik(timId)
  let dikirim = 0
  let diterima = 0
  let programDitahan: number | undefined

  // Potret awal perangkat — dasar untuk menolak menimpa yang diubah di tengah putaran.
  const [members, sessions, attendance, settings] = await Promise.all([
    db.members.toArray(),
    db.sessions.toArray(),
    db.attendance.toArray(),
    db.settings.get('team'),
  ])
  const kerangkaAwal = petaKerangkaSemua(members, sessions, settings?.programLatihan)
  const sidikKerangkaAwal = new Map([...kerangkaAwal].map(([k, v]) => [k, sidik(v)]))
  const sidikKehadiranAwal = new Map<string, string>()
  for (const r of attendance) {
    const k = kunciKehadiran(r.sessionId, r.memberId)
    if (!sidikKehadiranAwal.has(k)) sidikKehadiranAwal.set(k, sidik(dataKehadiran(r)))
  }

  // 1. Pemilik mengirim kerangka (anggota, sesi, aturan).
  if (bolehKerangka(peran)) {
    const lokal = petaKerangka(members, sessions, attendance, settings?.programLatihan)
    let r = rencanakanKirim(lokal, sd.kerangka)
    // v2.15.1 — program kosong tidak boleh menimpa program yang masih ada di
    // server tanpa persetujuan pemilik (lihat `programKosongPerluDicek`).
    if (programKosongPerluDicek(r, sd.kerangka)) {
      const izin = !!bacaStatus().izinkanProgramKosong
      const diServer = izin ? 0 : await jumlahProgramDiServer(c, timId)
      if (diServer > 0) {
        r = tahanKunci(r, KUNCI_PROGRAM)
        programDitahan = diServer
      }
    }
    if (bacaStatus().izinkanProgramKosong) tulisStatus({ izinkanProgramKosong: undefined })
    const baris = [
      ...r.kirim.map(({ kunci, data }) => {
        const [jenis, id] = pecahKunci(kunci)
        return { tim_id: timId, jenis, id, data, dihapus: false }
      }),
      ...r.hapus.map((kunci) => {
        const [jenis, id] = pecahKunci(kunci)
        return { tim_id: timId, jenis, id, data: {}, dihapus: true }
      }),
    ]
    for (const bagian of potong(baris)) {
      const { error } = await c.from('kerangka').upsert(bagian, { onConflict: 'tim_id,jenis,id' })
      if (error) throw terjemahkan(error)
    }
    for (const { kunci, data } of r.kirim) sd.kerangka[kunci] = sidik(data)
    for (const kunci of r.hapus) delete sd.kerangka[kunci]
    dikirim += baris.length
    tulisSidik(sd)
  }

  // 2. Tarik kerangka.
  const barisKerangka = await tarikSejak<BarisKerangka>(c, 'kerangka', 'jenis,id,data,dihapus,diubah_at', timId, sd.kursorKerangka)
  diterima += await terapkanKerangka(barisKerangka, sd, sidikKerangkaAwal, false)
  sd.kursorKerangka = kursorBaru(sd.kursorKerangka, barisKerangka)
  tulisSidik(sd)
  // Perangkat pemilik yang baru pertama sinkron langsung menerima program
  // server di tarikan ini; peringatan "ditahan" tidak perlu muncul lagi.
  if (programDitahan && (await db.settings.get('team'))?.programLatihan?.length) programDitahan = undefined

  // Kerangka yang diubah di perangkat staf (bukan pemilik) dikembalikan ke versi server.
  if (!bolehKerangka(peran)) {
    const [m2, s2, set2] = await Promise.all([db.members.toArray(), db.sessions.toArray(), db.settings.get('team')])
    const kini = petaKerangkaSemua(m2, s2, set2?.programLatihan)
    const menyimpang = kunciMenyimpang(new Map([...kini].filter(([k]) => k in sd.kerangka)), sd.kerangka)
    if (menyimpang.length) diterima += await pulihkanKerangka(c, timId, menyimpang, sd, sidikKerangkaAwal)
  }

  // 3. Kirim kehadiran.
  const kenal = kenalDari(sd.kerangka)
  const lokalKehadiran = petaKehadiran(attendance, kenal)
  if (bolehIsi(peran)) {
    const r = rencanakanKirim(lokalKehadiran, sd.kehadiran)
    const baris = [
      ...r.kirim.map(({ kunci, data }) => {
        const [sesi_id, anggota_id] = pecahKunci(kunci)
        return { tim_id: timId, sesi_id, anggota_id, data, dihapus: false }
      }),
      ...r.hapus.map((kunci) => {
        const [sesi_id, anggota_id] = pecahKunci(kunci)
        return { tim_id: timId, sesi_id, anggota_id, data: { sessionId: sesi_id, memberId: anggota_id }, dihapus: true }
      }),
    ]
    for (const bagian of potong(baris)) {
      const { error } = await c.from('kehadiran').upsert(bagian, { onConflict: 'tim_id,sesi_id,anggota_id' })
      if (error) throw terjemahkan(error)
    }
    for (const { kunci, data } of r.kirim) sd.kehadiran[kunci] = sidik(data)
    for (const kunci of r.hapus) delete sd.kehadiran[kunci]
    dikirim += baris.length
    tulisSidik(sd)
  }

  // 4. Tarik kehadiran.
  const barisKehadiran = await tarikSejak<BarisKehadiran>(c, 'kehadiran', 'sesi_id,anggota_id,data,dihapus,diubah_at', timId, sd.kursorKehadiran)
  diterima += await terapkanBarisKehadiran(barisKehadiran, sd, sidikKehadiranAwal)
  sd.kursorKehadiran = kursorBaru(sd.kursorKehadiran, barisKehadiran)
  tulisSidik(sd)

  // 5. PH & asisten: isian di perangkatnya sendiri dikembalikan ke versi server.
  if (!bolehIsi(peran)) {
    const kini = petaKehadiran(await db.attendance.toArray(), kenal)
    const menyimpang = new Set(kunciMenyimpang(kini, sd.kehadiran))
    for (const k of kini.keys()) if (!(k in sd.kehadiran)) menyimpang.add(k)
    if (menyimpang.size) diterima += await pulihkanKehadiran(c, timId, [...menyimpang], sd, sidikKehadiranAwal)
  }

  return { dikirim, diterima, programDitahan }
}

async function jumlahProgramDiServer(c: SupabaseClient, timId: string): Promise<number> {
  const { data, error } = await c.from('kerangka').select('data,dihapus').eq('tim_id', timId).eq('jenis', 'konfig').eq('id', 'program').limit(1)
  if (error) throw terjemahkan(error)
  return jumlahProgramServer(((data ?? []) as { data?: unknown; dihapus?: boolean }[])[0])
}

/**
 * v2.15.1 — pemilik memulihkan program latihan dari server ke perangkat ini
 * (dipakai saat kiriman program kosong ditahan). Mengembalikan jumlah program.
 */
export async function ambilProgramDariServer(): Promise<number> {
  const c = await dapatKlien()
  if (!c) throw new GalatServer('belum-diatur', 'Server kehadiran belum diatur.')
  const st = await muatTim()
  if (!st.timId) throw new GalatServer('belum-diundang', `Akun ${st.email ?? ''} belum diundang ke tim mana pun.`)
  const sd = bacaSidik(st.timId)
  const s = await db.settings.get('team')
  const awal = new Map([[KUNCI_PROGRAM, sidik(dataKonfig(s?.programLatihan))]])
  await pulihkanKerangka(c, st.timId, [KUNCI_PROGRAM], sd, awal)
  tulisSidik(sd)
  tulisStatus({ programDitahan: undefined })
  return (await db.settings.get('team'))?.programLatihan?.length ?? 0
}

/** v2.15.1 — pemilik menyetujui program kosong menimpa server; berlaku untuk satu putaran. */
export async function kosongkanProgramDiServer(): Promise<HasilSinkron> {
  tulisStatus({ izinkanProgramKosong: true })
  return sinkronkan()
}

/** Terapkan baris kerangka. `paksa` dipakai saat memulihkan isian yang menyimpang. */
async function terapkanKerangka(baris: BarisKerangka[], sd: SidikTersimpan, awal: Map<string, string>, paksa: boolean): Promise<number> {
  if (!baris.length) return 0
  let n = 0
  const kini = Date.now()
  await db.transaction('rw', db.members, db.sessions, db.settings, async () => {
    for (const b of baris) {
      const k = kunciKerangka(b.jenis, b.id)
      if (b.jenis === 'anggota') {
        const lokal = await db.members.get(b.id)
        const sekarang = lokal ? sidik(dataAnggota(lokal)) : undefined
        if (!paksa && sekarang !== awal.get(k)) continue // diubah di tengah putaran
        if (b.dihapus) {
          delete sd.kerangka[k]
          if (lokal?.active) {
            await db.members.put({ ...lokal, active: 0 })
            n++
          }
          continue
        }
        const d = b.data as DataAnggota
        const target = sidik(d)
        sd.kerangka[k] = target
        if (sekarang === target) continue
        await db.members.put(terapkanAnggota(lokal, d, () => uid('t_'), kini))
        n++
      } else if (b.jenis === 'sesi') {
        const lokal = await db.sessions.get(b.id)
        const sekarang = lokal ? sidik(dataSesi(lokal)) : undefined
        if (!paksa && sekarang !== awal.get(k)) continue
        if (b.dihapus) {
          delete sd.kerangka[k]
          if (lokal) {
            await db.sessions.delete(b.id)
            n++
          }
          continue
        }
        const d = b.data as DataSesi
        const target = sidik(d)
        sd.kerangka[k] = target
        if (sekarang === target) continue
        await db.sessions.put(terapkanSesi(lokal, d, kini))
        n++
      } else if (b.jenis === 'konfig' && b.id === 'program' && !b.dihapus) {
        const s = await db.settings.get('team')
        const sekarang = sidik(dataKonfig(s?.programLatihan))
        if (!paksa && sekarang !== awal.get(k)) continue
        const d = b.data as DataKonfig
        const target = sidik(dataKonfig(d.programLatihan))
        sd.kerangka[k] = target
        if (sekarang === target) continue
        await saveSettings({ programLatihan: d.programLatihan ?? [] })
        n++
      }
    }
  })
  return n
}

async function terapkanBarisKehadiran(baris: BarisKehadiran[], sd: SidikTersimpan, awal: Map<string, string>, paksa = false): Promise<number> {
  if (!baris.length) return 0
  let n = 0
  await db.transaction('rw', db.attendance, async () => {
    for (const b of baris) {
      const k = kunciKehadiran(b.sesi_id, b.anggota_id)
      const lokalSemua: AttendanceRecord[] = await db.attendance.where('[sessionId+memberId]').equals([b.sesi_id, b.anggota_id]).toArray()
      const lokal = lokalSemua[0]
      const sekarang = lokal ? sidik(dataKehadiran(lokal)) : undefined
      if (!paksa && sekarang !== awal.get(k)) continue // diisi di tengah putaran — dikirim putaran berikutnya
      if (b.dihapus) {
        delete sd.kehadiran[k]
        if (lokalSemua.length) {
          await db.attendance.bulkDelete(lokalSemua.map((r) => r.id))
          n++
        }
        continue
      }
      const baru = terapkanKehadiran(lokal, b.data, b.sesi_id, b.anggota_id, () => uid('a_'))
      const target = sidik(dataKehadiran(baru))
      sd.kehadiran[k] = target
      if (sekarang === target && lokalSemua.length === 1) continue
      await db.attendance.put(baru)
      if (lokalSemua.length > 1) await db.attendance.bulkDelete(lokalSemua.slice(1).map((r) => r.id))
      n++
    }
  })
  return n
}

async function pulihkanKerangka(c: SupabaseClient, timId: string, kunci: string[], sd: SidikTersimpan, awal: Map<string, string>): Promise<number> {
  const ids = [...new Set(kunci.map((k) => pecahKunci(k)[1]))]
  const baris: BarisKerangka[] = []
  for (const bagian of potong(ids, 100)) {
    const { data, error } = await c.from('kerangka').select('jenis,id,data,dihapus,diubah_at').eq('tim_id', timId).in('id', bagian)
    if (error) throw terjemahkan(error)
    baris.push(...((data ?? []) as BarisKerangka[]).filter((b) => kunci.includes(kunciKerangka(b.jenis, b.id))))
  }
  return terapkanKerangka(baris, sd, awal, true)
}

async function pulihkanKehadiran(c: SupabaseClient, timId: string, kunci: string[], sd: SidikTersimpan, awal: Map<string, string>): Promise<number> {
  const sesi = [...new Set(kunci.map((k) => pecahKunci(k)[0]))]
  const ada = new Map<string, BarisKehadiran>()
  for (const bagian of potong(sesi, 50)) {
    const { data, error } = await c.from('kehadiran').select('sesi_id,anggota_id,data,dihapus,diubah_at').eq('tim_id', timId).in('sesi_id', bagian)
    if (error) throw terjemahkan(error)
    for (const b of (data ?? []) as BarisKehadiran[]) ada.set(kunciKehadiran(b.sesi_id, b.anggota_id), b)
  }
  const baris = kunci.map((k) => {
    const [sesi_id, anggota_id] = pecahKunci(k)
    return ada.get(k) ?? { sesi_id, anggota_id, data: { sessionId: sesi_id, memberId: anggota_id } as DataKehadiran, dihapus: true, diubah_at: '' }
  })
  return terapkanBarisKehadiran(baris, sd, awal, true)
}

/* --------------------------------- Penjaga -------------------------------- */

const JEDA_MS = 60_000
const TUNDA_UBAH_MS = 4_000
let hentikan: (() => void) | null = null

/**
 * Sinkron di belakang layar: tiap menit selama tab terlihat, saat sinyal
 * kembali, saat tab dibuka lagi, dan beberapa detik sesudah kehadiran/sesi
 * berubah di perangkat ini. Aman dipanggil berkali-kali.
 */
export function mulaiPenjaga(): () => void {
  if (hentikan) return hentikan
  let tunda: number | undefined
  const coba = () => {
    if (document.hidden || !bacaStatus().aktif) return
    void sinkronkan().catch(() => undefined)
  }
  const nanti = () => {
    window.clearTimeout(tunda)
    tunda = window.setTimeout(coba, TUNDA_UBAH_MS)
  }
  const t = window.setInterval(coba, JEDA_MS)
  const terlihat = () => !document.hidden && coba()
  window.addEventListener('online', coba)
  window.addEventListener('drillkit-server-sinkron', coba)
  document.addEventListener('visibilitychange', terlihat)
  let pertama = true
  const langganan = liveQuery(async () => {
    const [a, s] = await Promise.all([db.attendance.toArray(), db.sessions.toArray()])
    return a.length + s.length
  }).subscribe({
    next: () => {
      if (pertama) {
        pertama = false
        return
      }
      if (!sedangSinkron) nanti()
    },
  })
  void tukarKodeMasuk()
    .catch(() => false)
    .finally(coba)
  hentikan = () => {
    window.clearInterval(t)
    window.clearTimeout(tunda)
    window.removeEventListener('online', coba)
    window.removeEventListener('drillkit-server-sinkron', coba)
    document.removeEventListener('visibilitychange', terlihat)
    langganan.unsubscribe()
    hentikan = null
  }
  return hentikan
}
