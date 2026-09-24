import type { Session } from '../db/types'

/**
 * C3 — pengingat jadwal latihan. Modul murni (tanpa React/DOM) supaya bisa
 * diuji tanpa peramban; satu-satunya pengecualian adalah pembungkus
 * `Notification` di bawah, yang sengaja setipis mungkin.
 *
 * Batasan yang jujur: tanpa server, peramban tidak bisa membangunkan
 * aplikasi yang tertutup — jadi tidak ada alarm sungguhan. Yang ada:
 *   1. spanduk "jadwal terdekat" setiap aplikasi dibuka;
 *   2. notifikasi sistem bila aplikasinya sedang dibuka dan izin diberikan;
 *   3. berkas kalender (.ics) berisi dua alarm, supaya pengingat yang
 *      berjalan saat aplikasi tutup dipegang oleh kalender HP.
 */

/** Pengganti `Storage` yang cukup untuk uji (localStorage memenuhinya). */
export interface SimpananKecil {
  getItem(kunci: string): string | null
  setItem(kunci: string, nilai: string): void
}

const KUNCI_TUTUP = 'drillkit.tutupIngatkan.v1'
const KUNCI_NOTIF = 'drillkit.kirimNotifikasi.v1'

/** 'YYYY-MM-DD' lokal dari epoch ms. */
export function hariStr(waktuMs: number): string {
  const d = new Date(waktuMs)
  const dua = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${dua(d.getMonth() + 1)}-${dua(d.getDate())}`
}

/** Epoch ms jam mulai sesi (waktu lokal). `null` bila tanggal/jam rusak. */
export function epochMulai(s: Session): number | null {
  const t = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.date ?? '')
  const j = /^(\d{1,2}):(\d{2})$/.exec(s.startTime ?? '')
  if (!t || !j) return null
  const [, th, bl, tg] = t.map(Number)
  const [, jam, mnt] = j.map(Number)
  if (bl < 1 || bl > 12 || tg < 1 || tg > 31 || jam > 23 || mnt > 59) return null
  const d = new Date(th, bl - 1, tg, jam, mnt, 0, 0)
  // 31 Feb "meluber" ke Maret — tolak, jangan diam-diam menggeser jadwal.
  if (d.getFullYear() !== th || d.getMonth() !== bl - 1 || d.getDate() !== tg) return null
  return d.getTime()
}

/**
 * Sesi yang layak diingatkan: mulai hari ini sampai `dalamHari` hari ke
 * depan, diurutkan (tanggal, jam). Sesi yang tanggalnya rusak dilewati.
 */
export function sesiMendesak(sesi: Session[], sekarangMs: number, dalamHari = 1): Session[] {
  const awal = new Date(sekarangMs)
  awal.setHours(0, 0, 0, 0)
  const akhir = new Date(sekarangMs)
  akhir.setHours(0, 0, 0, 0)
  akhir.setDate(akhir.getDate() + dalamHari + 1)
  return sesi
    .filter((s) => {
      const m = epochMulai(s)
      return m !== null && m >= awal.getTime() && m < akhir.getTime()
    })
    .sort((a, b) =>
      a.date < b.date ? -1 : a.date > b.date ? 1 : a.startTime < b.startTime ? -1 : a.startTime > b.startTime ? 1 : 0,
    )
}

/**
 * Layak dikirimi notifikasi sistem? Jendela: sudah mulai (maksimal 15
 * menit lalu) sampai 3 jam ke depan. Di luar itu spanduk saja cukup.
 */
export function butuhNotifikasi(s: Session, sekarangMs: number): boolean {
  const m = epochMulai(s)
  if (m === null) return false
  return sekarangMs - m <= 15 * 60_000 && m - sekarangMs <= 3 * 3_600_000
}

/** Teks notifikasi: "dimulai!" bila waktunya tiba, sisa waktu bila belum. */
export function teksNotifikasi(s: Session, sekarangMs: number): { judul: string; isi: string } {
  const m = epochMulai(s) ?? sekarangMs
  const sisaMnt = Math.max(0, Math.round((m - sekarangMs) / 60_000))
  let kapan: string
  if (sisaMnt <= 0) kapan = 'dimulai!'
  else if (sisaMnt < 60) kapan = `${sisaMnt} menit lagi`
  else if (sisaMnt % 60 === 0) kapan = `${sisaMnt / 60} jam lagi`
  else kapan = `${Math.floor(sisaMnt / 60)} jam ${sisaMnt % 60} menit lagi`
  const judul = `${s.title} ${kapan}`
  const isi = `${s.startTime}–${s.endTime}${s.place ? ` · ${s.place}` : ''}`
  return { judul, isi }
}

/* ------------------------- ingatan harian ------------------------- */

function bacaPeta(simpan: SimpananKecil | null, kunci: string): Record<string, string> {
  if (!simpan) return {}
  try {
    const mentah = simpan.getItem(kunci)
    if (!mentah) return {}
    const o = JSON.parse(mentah) as unknown
    return typeof o === 'object' && o !== null ? (o as Record<string, string>) : {}
  } catch {
    return {}
  }
}

/** Hari ('YYYY-MM-DD') sesi ini terakhir ditutup spanduknya, bila ada. */
export function bacaTutup(simpan: SimpananKecil | null, id: string): string | null {
  return bacaPeta(simpan, KUNCI_TUTUP)[id] ?? null
}

/** Hari sesi ini terakhir dikirimi notifikasi, bila ada. */
export function bacaNotif(simpan: SimpananKecil | null, id: string): string | null {
  return bacaPeta(simpan, KUNCI_NOTIF)[id] ?? null
}

function tulisPeta(simpan: SimpananKecil | null, kunci: string, id: string, hari: string): void {
  if (!simpan) return
  try {
    simpan.setItem(kunci, JSON.stringify({ ...bacaPeta(simpan, kunci), [id]: hari }))
  } catch {
    /* penyimpanan penuh/dimatikan: pengingat boleh muncul lagi, tidak fatal */
  }
}

/** Tutup spanduk sesi ini sampai besok. */
export function tutupHariIni(simpan: SimpananKecil | null, id: string, hari: string): void {
  tulisPeta(simpan, KUNCI_TUTUP, id, hari)
}

/** Catat notifikasi sesi ini sudah dikirim hari ini. */
export function tandaiNotif(simpan: SimpananKecil | null, id: string, hari: string): void {
  tulisPeta(simpan, KUNCI_NOTIF, id, hari)
}

/* ------------------------- berkas kalender ------------------------- */

/** Loloskan teks untuk nilai properti .ics (RFC 5545 §3.3.11). */
export function escICS(teks: string): string {
  return teks
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')
}

/**
 * Lipat baris .ics di 75 oktet (lanjutan diawali spasi). Dihitung dalam
 * byte UTF-8 — melipat di tengah huruf multi-byte merusak berkasnya.
 */
export function lipatICS(baris: string): string {
  const bytes = new TextEncoder().encode(baris)
  if (bytes.length <= 75) return baris
  // Peta indeks char -> offset byte (surrogate pair = 1 char, 2 UTF-16 unit).
  let keluar = ''
  let potong = 0
  let byteAwal = 0
  const unit = [...baris]
  let offset = 0
  for (let i = 0; i < unit.length; i++) {
    const b = new TextEncoder().encode(unit[i]).length
    if (offset + b - byteAwal > 75) {
      keluar += baris.slice(potong, i) + '\r\n '
      potong = i
      byteAwal = offset
    }
    offset += b
  }
  return keluar + baris.slice(potong)
}

function dua(n: number): string {
  return String(n).padStart(2, '0')
}

/**
 * Bangun isi berkas .ics untuk satu sesi.
 *
 * Waktu ditulis **mengambang** (tanpa zona waktu): kalender HP
 * menafsirkannya sebagai waktu lokal — tepat untuk jadwal latihan yang
 * memang selalu dibaca di zona yang sama dengan yang membuatnya.
 * Dua alarm ikut di dalam: H-1 sehari dan H-0 sejam sebelumnya.
 */
export function bangunICS(
  s: Session,
  opts: { uid?: string; stampMs?: number; prodId?: string } = {},
): string {
  const t = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.date ?? '')
  const j1 = /^(\d{1,2}):(\d{2})$/.exec(s.startTime ?? '')
  const j2 = /^(\d{1,2}):(\d{2})$/.exec(s.endTime ?? '')
  if (!t || !j1 || !j2) throw new Error('tanggal/jam sesi rusak — .ics tidak dibuat')
  const w = (p: RegExpExecArray) => `${t[1]}${t[2]}${t[3]}T${dua(Number(p[1]))}${dua(Number(p[2]))}00`
  const stamp = new Date(opts.stampMs ?? Date.now())
  const stampUTC =
    `${stamp.getUTCFullYear()}${dua(stamp.getUTCMonth() + 1)}${dua(stamp.getUTCDate())}` +
    `T${dua(stamp.getUTCHours())}${dua(stamp.getUTCMinutes())}${dua(stamp.getUTCSeconds())}Z`
  const baris = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${opts.prodId ?? '-//DrillKit//Jadwal//ID'}`,
    'BEGIN:VEVENT',
    `UID:${opts.uid ?? `${s.id}@drillkit`}`,
    `DTSTAMP:${stampUTC}`,
    `DTSTART:${w(j1)}`,
    `DTEND:${w(j2)}`,
    `SUMMARY:${escICS(s.title)}`,
    ...(s.place ? [`LOCATION:${escICS(s.place)}`] : []),
    ...(s.notes ? [`DESCRIPTION:${escICS(s.notes)}`] : []),
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'TRIGGER:-P1D',
    `DESCRIPTION:${escICS(s.title)}`,
    'END:VALARM',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'TRIGGER:-PT60M',
    `DESCRIPTION:${escICS(s.title)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return baris.map(lipatICS).join('\r\n') + '\r\n'
}

/** Nama berkas .ics yang ramah: judul dijadikan slug + tanggal. */
export function namaBerkasICS(s: Session): string {
  const slug =
    s.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 30) || 'jadwal'
  return `${slug}-${s.date}.ics`
}

/* ------------------------- notifikasi sistem ------------------------- */

/** `true` bila peramban ini mengenal Notification API. */
export function bisaNotifikasi(): boolean {
  return typeof Notification !== 'undefined'
}

/**
 * Tampilkan notifikasi sistem. Mengembalikan `false` (tanpa melempar)
 * bila izin belum ada, API tidak ada, atau peramban menolak.
 */
export function tampilkanNotifikasi(judul: string, isi: string): boolean {
  try {
    if (!bisaNotifikasi() || Notification.permission !== 'granted') return false
    new Notification(judul, { body: isi, tag: 'drillkit-jadwal' })
    return true
  } catch {
    return false
  }
}
