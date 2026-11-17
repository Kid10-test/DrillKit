/**
 * v2.13 — keterangan telat/pulang awal dari Form gabungan (`Session.formKeterangan`).
 * Modul kecil tersendiri supaya halaman Absensi bisa memakainya tanpa ikut
 * memuat seluruh pengimpor Form.
 */
import type { AttendanceRecord, Session } from '../db/types'

/**
 * v2.13 — alasan telat & bukti dari keterangan Form untuk catatan hadir yang
 * belum memilikinya. Kosong = tidak ada yang perlu ditambahkan.
 */
export function lengkapiDariForm(
  r: Pick<AttendanceRecord, 'memberId' | 'alasanTelat' | 'bukti'>,
  s: Pick<Session, 'formKeterangan'>,
): Partial<Pick<AttendanceRecord, 'alasanTelat' | 'bukti'>> {
  const k = s.formKeterangan?.[r.memberId]
  const out: Partial<Pick<AttendanceRecord, 'alasanTelat' | 'bukti'>> = {}
  if (!k) return out
  if (k.alasan && !r.alasanTelat?.trim()) out.alasanTelat = k.alasan
  if (k.bukti && !r.bukti?.trim()) out.bukti = k.bukti
  return out
}
