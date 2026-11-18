/**
 * v2.14 — status kehadiran bersama yang dibaca tanpa memuat pustaka Supabase
 * (dipakai penjaga di bundel awal, pita di Absensi, dan kartu Pengaturan).
 */
import { KUNCI_KODE, KUNCI_STATUS, type StatusServer } from '../../lib/kembaliMasuk'

export function bacaStatusServer(): StatusServer {
  try {
    return (JSON.parse(localStorage.getItem(KUNCI_STATUS) ?? '{}') as StatusServer) ?? {}
  } catch {
    return {}
  }
}

/** Penjaga perlu dimuat: sinkron menyala, atau baru kembali dari halaman masuk Google. */
export function perluPenjagaServer(): boolean {
  if (bacaStatusServer().aktif) return true
  try {
    return !!(sessionStorage.getItem(KUNCI_KODE) || sessionStorage.getItem(`${KUNCI_KODE}.galat`))
  } catch {
    return false
  }
}
