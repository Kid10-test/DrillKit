import { useEffect } from 'react'
import { useSettings } from '../../hooks/useSettings'
import { adaIzinGoogle } from './izinGoogle'

/** Sama dengan `JEDA_BACKUP_DRIVE_MS` di lib/backupDrive.ts (diuji di sana). */
const JEDA_MS = 10 * 60_000

/** Dibaca langsung supaya modul backup tidak masuk bundel awal. */
function backupDriveAktif(): boolean {
  try {
    return !!(JSON.parse(localStorage.getItem('drillkit.backupDrive') ?? '{}') as { aktif?: boolean }).aktif
  } catch {
    return false
  }
}

/**
 * v2.10.1 — backup ke Drive di belakang layar. Tidak memuat modul Google
 * maupun modul backup sampai backup Drive aktif *dan* ada izin yang masih
 * berlaku di tab ini, dan tidak pernah membuka jendela Google.
 */
export function PenjagaBackupDrive() {
  const settings = useSettings()
  const konfig = settings.google
  useEffect(() => {
    let hidup = true
    let jalan = false
    const coba = async () => {
      if (!hidup || jalan || document.hidden) return
      if (!backupDriveAktif() || !adaIzinGoogle()) return
      jalan = true
      try {
        const { backupKeDrive } = await import('../../lib/backupDrive')
        await backupKeDrive(konfig)
      } catch {
        /* backup otomatis tidak boleh mengganggu pemakaian */
      } finally {
        jalan = false
      }
    }
    const t = window.setInterval(() => void coba(), JEDA_MS)
    const segera = () => void coba()
    window.addEventListener('drillkit-google', segera)
    window.addEventListener('online', segera)
    void coba()
    return () => {
      hidup = false
      window.clearInterval(t)
      window.removeEventListener('drillkit-google', segera)
      window.removeEventListener('online', segera)
    }
  }, [konfig])
  return null
}
