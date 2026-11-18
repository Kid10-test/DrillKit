import { useEffect } from 'react'
import { perluPenjagaServer } from './statusServer'

/**
 * v2.14 — sinkron kehadiran bersama di belakang layar. Tidak memuat pustaka
 * Supabase sama sekali sampai perangkat ini menyalakan kehadiran bersama
 * (atau baru kembali dari halaman masuk Google).
 */
export function PenjagaServer() {
  useEffect(() => {
    let hidup = true
    let henti: (() => void) | undefined
    let memuat = false
    const nyalakan = () => {
      if (henti || memuat || !perluPenjagaServer()) return
      memuat = true
      void import('../../lib/serverKehadiran')
        .then((m) => {
          if (hidup) henti = m.mulaiPenjaga()
        })
        .catch(() => undefined)
        .finally(() => {
          memuat = false
        })
    }
    nyalakan()
    window.addEventListener('drillkit-server', nyalakan)
    return () => {
      hidup = false
      window.removeEventListener('drillkit-server', nyalakan)
      henti?.()
    }
  }, [])
  return null
}
