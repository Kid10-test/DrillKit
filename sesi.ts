/**
 * G3 — penanda mulai & selesai **sesi**.
 *
 * H1 sudah mencatat kapan tiap **blok** mulai dan selesai. G3 mencatat hal
 * yang berbeda: kapan **sesinya sendiri** mulai dan selesai.
 *
 * Mengapa tidak sekadar memakai blok pertama sebagai penanda sesi? Karena
 * keduanya **tidak terjadi pada saat yang sama**. Sesi dimulai ketika
 * pelatih memanggil semua orang berkumpul; blok pertama baru dimulai ketika
 * pemanasan benar-benar berjalan. Memakai blok pertama sebagai penanda sesi
 * akan menyembunyikan keterlambatan yang justru paling umum: *semua sudah
 * berkumpul, tetapi belum ada yang mulai.*
 *
 * Sebaliknya, sesi bisa **selesai** sebelum blok terakhir ditandai rampung —
 * misalnya bloknya ditinggalkan begitu saja. Karena itu keadaan blok tidak
 * pernah disimpulkan dari penanda sesi, dan penanda sesi tidak pernah
 * mengubah catatan blok. Keduanya dicatat terpisah, lalu dibandingkan.
 *
 * Empat aturan yang menjaga kejujuran angkanya:
 *
 * 1. **Yang belum ditandai tidak dihitung sebagai tepat waktu.** Sesi tanpa
 *    penanda mengembalikan `null`, dan `rataTelat` **melewatinya** — bukan
 *    menganggapnya nol. Menghitung "belum ditandai" sebagai "telat 0 menit"
 *    akan membuat keterlambatan tampak membaik hanya karena pelatih lupa
 *    menekan tombol.
 * 2. **Penanda di luar hari sesinya tidak dipakai.** Kalau penanda jatuh pada
 *    tanggal yang berbeda dari `s.date`, angkanya tidak dihitung —
 *    dilaporkan sebagai `hariLain`. Ini bukan tebakan, melainkan
 *    perbandingan tanggal yang pasti. Tanpa ini, satu ketukan salah pada
 *    jadwal hari Kamis akan menghasilkan "telat 2879 menit".
 * 3. **Penanda yang mundur tidak menghasilkan durasi negatif.** Bila
 *    `selesaiNyata` lebih awal daripada `mulaiNyata` — jam perangkat
 *    berubah, atau penanda salah urutan — durasinya `null`, bukan angka
 *    negatif yang tidak ada artinya.
 * 4. **Tepat waktu punya ambang.** Selisih di bawah `AMBANG_TEPAT` dianggap
 *    tepat waktu. Sesi yang mulai 40 detik terlambat tidak perlu dilaporkan
 *    sebagai keterlambatan; presisi semu seperti itu hanya menambah derau.
 */
import type { Session } from '../db/types'

export type StatusSesi = 'belum' | 'berjalan' | 'rampung'

/**
 * Selisih di bawah ini (dalam menit) dilaporkan **tepat waktu**, bukan
 * sebagai keterlambatan.
 */
export const AMBANG_TEPAT = 1

/** `YYYY-MM-DD` dari sebuah epoch, menurut zona waktu perangkat. */
function isoHari(epoch: number): string {
  const d = new Date(epoch)
  const b = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${b(d.getMonth() + 1)}-${b(d.getDate())}`
}

/** `"15:30"` → menit sejak tengah malam. */
export function menitDariJam(jam: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec((jam ?? '').trim())
  if (!m) return null
  const h = Number(m[1])
  const n = Number(m[2])
  if (!Number.isFinite(h) || !Number.isFinite(n)) return null
  if (h > 23 || n > 59) return null
  return h * 60 + n
}

/**
 * Epoch dari **tanggal sesi + jam** (`"15:30"`), menurut zona waktu
 * perangkat. `null` bila tanggal atau jamnya tidak bisa dibaca.
 *
 * Rencana disimpan sebagai tanggal dan jam terpisah, sedangkan penanda
 * disimpan sebagai epoch. Tanpa jembatan ini keduanya tidak bisa
 * dibandingkan.
 */
export function epochRencana(tanggal: string, jam: string): number | null {
  const menit = menitDariJam(jam)
  if (menit == null) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((tanggal ?? '').trim())
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0)
  if (Number.isNaN(d.getTime())) return null
  return d.getTime() + menit * 60_000
}

/**
 * Keadaan sesi menurut penandanya.
 *
 * `rampung` hanya bila **keduanya** ada. Sesi yang dimulai tetapi tidak
 * pernah ditandai selesai tetap `berjalan` berapa lama pun — lebih jujur
 * daripada menebak kapan ia berakhir.
 */
export function statusSesi(mulaiNyata?: number | null, selesaiNyata?: number | null): StatusSesi {
  if (mulaiNyata == null) return 'belum'
  return selesaiNyata == null ? 'berjalan' : 'rampung'
}

/** `"07:42"` dari sebuah epoch. */
export function jamDariEpoch(epoch: number): string {
  const d = new Date(epoch)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export interface RingkasanSesi {
  id: string
  status: StatusSesi
  /** Epoch penanda mulai, `null` bila belum ditandai. */
  mulaiNyata: number | null
  /** Epoch penanda selesai, `null` bila belum ditandai. */
  selesaiNyata: number | null
  /**
   * Keterlambatan mulai dalam menit; **positif = terlambat**.
   * `null` bila belum ditandai, atau penandanya di luar hari sesinya.
   */
  telat: number | null
  /**
   * Kelebihan waktu selesai dalam menit; **positif = molor**.
   * `null` bila belum rampung, atau penandanya di luar hari sesinya.
   */
  lampau: number | null
  /** Durasi nyata dalam menit. `null` bila belum rampung atau penanda mundur. */
  durasi: number | null
  /** Durasi yang direncanakan dalam menit. */
  durasiRencana: number | null
  /** Penanda jatuh pada hari yang berbeda dari tanggal sesinya. */
  hariLain: boolean
  /** Banyak blok yang sudah dimulai tetapi belum ditandai selesai. */
  blokMenggantung: number
}

/**
 * Ringkasan satu sesi: rencana berhadapan dengan kenyataan.
 *
 * **Tidak pernah mengubah data sesinya** — ia hanya membaca.
 */
export function ringkasanSesi(s: Session): RingkasanSesi {
  const mulaiNyata = s.mulaiNyata ?? null
  const selesaiNyata = s.selesaiNyata ?? null
  const status = statusSesi(mulaiNyata, selesaiNyata)

  const mulaiRencana = epochRencana(s.date, s.startTime)
  const selesaiRencana = epochRencana(s.date, s.endTime)

  // Penanda di luar hari sesinya tidak dipakai: ia hampir pasti ketukan
  // yang salah, dan menghasilkannya saja sudah cukup membingungkan.
  const mulaiHariLain = mulaiNyata != null && isoHari(mulaiNyata) !== s.date
  const selesaiHariLain = selesaiNyata != null && isoHari(selesaiNyata) !== s.date

  let telat: number | null = null
  if (mulaiNyata != null && mulaiRencana != null && !mulaiHariLain) {
    telat = (mulaiNyata - mulaiRencana) / 60_000
  }

  let lampau: number | null = null
  if (selesaiNyata != null && selesaiRencana != null && !selesaiHariLain) {
    lampau = (selesaiNyata - selesaiRencana) / 60_000
  }

  let durasi: number | null = null
  if (mulaiNyata != null && selesaiNyata != null && selesaiNyata >= mulaiNyata) {
    durasi = (selesaiNyata - mulaiNyata) / 60_000
  }

  let durasiRencana: number | null = null
  if (mulaiRencana != null && selesaiRencana != null && selesaiRencana > mulaiRencana) {
    durasiRencana = (selesaiRencana - mulaiRencana) / 60_000
  } else if (mulaiRencana != null && selesaiRencana != null && selesaiRencana <= mulaiRencana) {
    // Sesi yang melewati tengah malam: ujungnya jatuh pada hari berikutnya.
    durasiRencana = (selesaiRencana + 24 * 60 * 60_000 - mulaiRencana) / 60_000
  }

  const blokMenggantung = (s.realisasiLatihan ?? []).filter((r) => r.selesai == null).length

  return {
    id: s.id,
    status,
    mulaiNyata,
    selesaiNyata,
    telat,
    lampau,
    durasi,
    durasiRencana,
    hariLain: mulaiHariLain || selesaiHariLain,
    blokMenggantung,
  }
}

/**
 * Rata-rata keterlambatan **dari sesi yang benar-benar ditandai saja**.
 *
 * Sesi tanpa penanda **dilewati**, tidak dihitung sebagai nol. Menghitungnya
 * sebagai nol akan membuat angka ini tampak membaik setiap kali pelatih lupa
 * menekan tombol — kebalikan dari yang diinginkan.
 *
 * `null` bila tidak ada satu pun sesi yang punya angka keterlambatan.
 */
export function rataTelat(daftar: RingkasanSesi[]): number | null {
  const ada = daftar.map((r) => r.telat).filter((t): t is number => t != null)
  if (ada.length === 0) return null
  return ada.reduce((a, b) => a + b, 0) / ada.length
}

/** Rata-rata kelebihan waktu selesai; aturan yang sama dengan `rataTelat`. */
export function rataLampau(daftar: RingkasanSesi[]): number | null {
  const ada = daftar.map((r) => r.lampau).filter((t): t is number => t != null)
  if (ada.length === 0) return null
  return ada.reduce((a, b) => a + b, 0) / ada.length
}

/**
 * Kalimat keterlambatan yang siap dibaca.
 *
 * `null` menjadi **"belum ditandai"** — bukan "tepat waktu", karena tidak
 * ditandai bukan berarti tepat waktu.
 */
export function formatTelat(menit: number | null): string {
  if (menit == null) return 'belum ditandai'
  if (Math.abs(menit) < AMBANG_TEPAT) return 'tepat waktu'
  const m = Math.round(Math.abs(menit))
  return menit > 0 ? `telat ${m} menit` : `${m} menit lebih awal`
}

/** Kalimat kelebihan waktu selesai. `null` bila belum rampung. */
export function formatLampau(menit: number | null): string {
  if (menit == null) return 'belum ditandai'
  if (Math.abs(menit) < AMBANG_TEPAT) return 'tepat waktu'
  const m = Math.round(Math.abs(menit))
  return menit > 0 ? `molor ${m} menit` : `${m} menit lebih cepat`
}

/**
 * Durasi dalam bentuk `"1 jam 20 menit"` / `"45 menit"`.
 *
 * `null` menjadi `"—"`, bukan `"0 menit"`: sesi yang belum selesai belum
 * punya durasi, dan menulisnya nol akan terbaca sebagai sesi yang tidak
 * berlangsung sama sekali.
 */
export function formatDurasi(menit: number | null): string {
  if (menit == null) return '—'
  const m = Math.round(menit)
  if (m < 60) return `${m} menit`
  const j = Math.floor(m / 60)
  const s = m % 60
  return s === 0 ? `${j} jam` : `${j} jam ${s} menit`
}

/** Warna penanda keterlambatan (kelas Tailwind). */
export function warnaTelat(menit: number | null): string {
  if (menit == null) return 'text-slate-500'
  if (Math.abs(menit) < AMBANG_TEPAT) return 'text-emerald-400'
  if (menit > 0) return menit >= 15 ? 'text-red-400' : 'text-amber-400'
  return 'text-sky-400'
}
