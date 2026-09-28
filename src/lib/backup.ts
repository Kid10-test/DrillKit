import { db, getSettings } from '../db/db'
import { downloadBlob, downloadFile } from './utils'
import { bikinZip, type EntriZip } from './zip'

/**
 * Backup otomatis — pengingat & riwayat backup.
 *
 * Kenapa modul ini perlu?
 * Semua data DrillKit tersimpan **hanya di perangkat** (IndexedDB). Tidak ada
 * server, jadi kalau cache browser dibersihkan atau perangkat rusak, data
 * ikut hilang. Satu-satunya jaring pengaman adalah berkas backup.
 *
 * Browser tidak bisa menulis berkas ke folder unduhan tanpa aksi pengguna,
 * jadi "backup otomatis" di sini berarti:
 *   1. aplikasi **mengingatkan** kalau sudah lewat N hari sejak backup terakhir;
 *   2. satu klik langsung mengunduh berkasnya;
 *   3. riwayat backup dicatat supaya kamu tahu kapan terakhir kali menyimpan.
 *
 * Catatan riwayat sengaja disimpan di **localStorage**, bukan di database:
 * kalau data utama hilang, catatan "kapan terakhir backup" tetap terbaca.
 * Semua akses localStorage dibungkus try/catch karena browser bisa memblokirnya
 * (mode penyamaran, iframe ter-sandbox, dll) — kalau diblokir, fitur ini
 * diam-diam dilewati tanpa merusak aplikasi.
 */

export interface BackupNote {
  /** kapan backup dibuat (epoch ms) */
  at: number
  bytes: number
  members: number
  drills: number
  sets: number
}

const NOTES_KEY = 'drillkit.backup.notes'
const SNOOZE_KEY = 'drillkit.backup.snoozeUntil'
const MAX_NOTES = 20
const HARI = 86_400_000

/* ------------------------------- Riwayat --------------------------------- */

export function backupNotes(): BackupNote[] {
  try {
    const raw = localStorage.getItem(NOTES_KEY)
    const arr = raw ? JSON.parse(raw) : []
    if (!Array.isArray(arr)) return []
    return arr
      .filter((n): n is BackupNote => !!n && typeof n.at === 'number')
      .sort((a, b) => b.at - a.at)
  } catch {
    return []
  }
}

/** Backup terakhir yang pernah dibuat (null kalau belum pernah). */
export function lastBackup(): BackupNote | null {
  return backupNotes()[0] ?? null
}

/** Simpan catatan backup baru ke riwayat. */
export function noteBackup(n: BackupNote) {
  try {
    const notes = backupNotes()
    notes.unshift(n)
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes.slice(0, MAX_NOTES)))
  } catch {
    // localStorage diblokir — lewati saja.
  }
}

/* ------------------------------- Pengingat -------------------------------- */

/** Selisih hari sejak `ts` sampai sekarang (null kalau `ts` kosong). */
export function daysSince(ts?: number | null): number | null {
  if (!ts) return null
  return Math.floor((Date.now() - ts) / HARI)
}

/** Tunda pengingat selama `days` hari. */
export function snoozeReminder(days: number) {
  try {
    localStorage.setItem(SNOOZE_KEY, String(Date.now() + days * HARI))
  } catch {
    // abaikan
  }
}

export function isSnoozed(): boolean {
  try {
    return Number(localStorage.getItem(SNOOZE_KEY) ?? 0) > Date.now()
  } catch {
    return false
  }
}

/**
 * Apakah sudah waktunya mengingatkan pengguna?
 * `intervalDays` = 0 berarti pengingat dimatikan.
 */
export function shouldRemind(intervalDays: number): boolean {
  if (!intervalDays || intervalDays <= 0) return false
  if (isSnoozed()) return false
  const last = lastBackup()
  if (!last) return true // belum pernah backup sama sekali
  return (daysSince(last.at) ?? 0) >= intervalDays
}

/* ---------------------------- Berkas backup ------------------------------- */

/** Kumpulkan seluruh data menjadi satu objek (dipakai unduhan & pratinjau). */
export async function buildBackupPayload() {
  const [members, sessions, attendance, drills, sets, songs, setlists, memberNotes, kemajuan, evaluasi] =
    await Promise.all([
    db.members.toArray(),
    db.sessions.toArray(),
    db.attendance.toArray(),
    db.drills.toArray(),
    db.sets.toArray(),
    db.songs.toArray(),
      db.setlists.toArray(),
      db.memberNotes.toArray(),
      db.kemajuan.toArray(),
      db.evaluasi.toArray(),
    ])
  return {
    format: 'drillkit-backup',
    version: 1,
    exportedAt: Date.now(),
    settings: await getSettings(),
    members,
    sessions,
    attendance,
    drills,
    sets,
    songs,
    setlists,
    memberNotes,
    kemajuan,
    evaluasi,
  }
}

/**
 * Unduh berkas backup, lalu catat ke riwayat.
 * Mengembalikan catatan backup yang baru dibuat.
 */
export async function downloadBackup(): Promise<BackupNote> {
  const payload = await buildBackupPayload()
  const text = JSON.stringify(payload, null, 2)
  const stamp = new Date(payload.exportedAt).toISOString().slice(0, 10)
  downloadFile(`drillkit-backup-${stamp}.json`, text)
  const note: BackupNote = {
    at: payload.exportedAt,
    bytes: new Blob([text]).size,
    members: payload.members.length,
    drills: payload.drills.length,
    sets: payload.sets.length,
  }
  noteBackup(note)
  return note
}

/**
 * #6 — Unduh berkas backup lengkap berserta rekaman audio (ZIP).
 * Mengemas JSON teks + berkas biner audio MP3/WAV/dll.
 */
export async function downloadBackupZip(): Promise<BackupNote> {
  const payload = await buildBackupPayload()
  const text = JSON.stringify(payload, null, 2)
  const stamp = new Date(payload.exportedAt).toISOString().slice(0, 10)
  const audioItems = await db.rekamanAudio.toArray()

  const entries: EntriZip[] = [
    { nama: `drillkit-backup-${stamp}.json`, isi: text },
  ]

  const manifestAudio: Record<string, { songId: string; namaFile: string; durasi: number; hash: string }> = {}

  for (const item of audioItems) {
    const ab = await item.blob.arrayBuffer()
    const safeName = item.namaFile.replace(/[^\w.-]/g, '_')
    const pathZip = `audio/${item.songId}_${safeName}`
    entries.push({
      nama: pathZip,
      isi: new Uint8Array(ab),
    })
    manifestAudio[pathZip] = {
      songId: item.songId,
      namaFile: item.namaFile,
      durasi: item.durasi,
      hash: item.hash,
    }
  }

  if (audioItems.length > 0) {
    entries.push({
      nama: 'audio/manifest.json',
      isi: JSON.stringify(manifestAudio, null, 2),
    })
  }

  const zipData = bikinZip(entries)
  downloadBlob(`drillkit-backup-${stamp}.zip`, zipData)

  const note: BackupNote = {
    at: payload.exportedAt,
    bytes: zipData.length,
    members: payload.members.length,
    drills: payload.drills.length,
    sets: payload.sets.length,
  }
  noteBackup(note)
  return note
}

/** Ukuran berkas dalam KB/MB yang mudah dibaca. */
export function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`
  return `${(b / (1024 * 1024)).toFixed(1)} MB`
}
