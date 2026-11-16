/**
 * v2.10.1 — Backup otomatis ke Google Drive.
 *
 * Melengkapi "Simpan otomatis ke berkas" (1b): berkas itu menyelamatkan dari
 * data browser yang terhapus, tetapi masih di perangkat yang sama. Backup ke
 * Drive menyelamatkan dari HP hilang atau rusak.
 *
 * Aturannya sederhana dan terlihat di antarmuka:
 * - satu berkas per hari di folder "DrillKit Backup" (ditimpa sepanjang hari),
 *   14 hari terakhir disimpan;
 * - hanya diunggah bila isinya berubah sejak unggahan terakhir;
 * - hanya saat izin Google masih berlaku — izin itu ±1 jam sesudah
 *   "Sambungkan", jadi DrillKit tidak pernah membuka jendela Google sendiri.
 *   Bila izin habis, backup menunggu sampai pelatih menyambung lagi.
 *
 * Keadaan disimpan per perangkat (localStorage), bukan di data tim: HP
 * asisten tidak ikut menulis ke Drive pelatih hanya karena memulihkan
 * backup yang sama.
 */
import type { KonfigGoogleTim } from '../db/types'
import { siapkanBackup, noteBackup } from './backup'

const KUNCI = 'drillkit.backupDrive'

export interface StatusBackupDrive {
  aktif: boolean
  folderId?: string
  folderLink?: string
  /** Epoch ms unggahan terakhir yang berhasil. */
  at?: number
  /** Sidik isi unggahan terakhir (tanpa cap waktu ekspor). */
  sidik?: string
  bytes?: number
  /** Galat terakhir (dikosongkan setelah berhasil). */
  galat?: string
}

export function bacaStatusBackupDrive(): StatusBackupDrive {
  try {
    return { aktif: false, ...(JSON.parse(localStorage.getItem(KUNCI) ?? '{}') as Partial<StatusBackupDrive>) }
  } catch {
    return { aktif: false }
  }
}

export function tulisStatusBackupDrive(patch: Partial<StatusBackupDrive>): StatusBackupDrive {
  const baru = { ...bacaStatusBackupDrive(), ...patch }
  try {
    localStorage.setItem(KUNCI, JSON.stringify(baru))
  } catch {
    /* penyimpanan penuh — status tidak diingat, backup tetap jalan */
  }
  try {
    window.dispatchEvent(new Event('drillkit-backup-drive'))
  } catch {
    /* bukan browser */
  }
  return baru
}

/** Sidik FNV-1a 32-bit — cukup untuk "isinya berubah atau tidak". */
export function sidikTeks(teks: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < teks.length; i++) {
    h ^= teks.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0') + teks.length.toString(16)
}

/** Isi backup tanpa cap waktu ekspor — dua backup tanpa perubahan data bersidik sama. */
export const tanpaCapWaktu = (teks: string) => teks.replace(/"exportedAt":\s*\d+/, '"exportedAt":0')

export type HasilBackupDrive = 'tersimpan' | 'sama' | 'nonaktif' | 'perlu-sambung' | 'belum-diatur' | 'kosong' | 'offline' | 'gagal'

/** Jarak terdekat dua unggahan otomatis. */
export const JEDA_BACKUP_DRIVE_MS = 10 * 60_000

/**
 * Jalankan satu kali backup ke Drive. `paksa` = tombol "Backup sekarang"
 * (abaikan jeda & sidik). Tidak pernah membuka jendela Google.
 */
export async function backupKeDrive(
  konfigTim: KonfigGoogleTim | undefined,
  opsi: { paksa?: boolean; sekarang?: number } = {},
): Promise<{ hasil: HasilBackupDrive; pesan?: string }> {
  const st = bacaStatusBackupDrive()
  if (!st.aktif && !opsi.paksa) return { hasil: 'nonaktif' }
  const g = await import('./googleDrive')
  const k = g.konfigGoogle(konfigTim)
  if (!k) return { hasil: 'belum-diatur' }
  if (!g.online()) return { hasil: 'offline' }
  if (!g.tersambung()) return { hasil: 'perlu-sambung' }
  const sekarang = opsi.sekarang ?? Date.now()
  if (!opsi.paksa && st.at && sekarang - st.at < JEDA_BACKUP_DRIVE_MS) return { hasil: 'sama' }
  try {
    const b = await siapkanBackup()
    if (!b.catatan.members && !opsi.paksa) return { hasil: 'kosong' }
    const sidik = sidikTeks(tanpaCapWaktu(b.teks))
    if (!opsi.paksa && sidik === st.sidik) return { hasil: 'sama' }
    const folder = await g.folderBackup(st.folderId)
    await g.unggahBackup(folder.id, b.nama, b.teks)
    noteBackup(b.catatan)
    tulisStatusBackupDrive({ folderId: folder.id, folderLink: folder.webViewLink, at: Date.now(), sidik, bytes: b.catatan.bytes, galat: undefined })
    return { hasil: 'tersimpan' }
  } catch (e) {
    const pesan = g.pesanGalat(e)
    if (e instanceof g.GalatGoogle && e.kode === 'kedaluwarsa') return { hasil: 'perlu-sambung', pesan }
    tulisStatusBackupDrive({ galat: pesan })
    return { hasil: 'gagal', pesan }
  }
}
