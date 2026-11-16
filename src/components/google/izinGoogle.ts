/**
 * v2.10.1 — tanpa memuat modul Google: apakah ada izin Google Drive yang
 * masih berlaku di tab ini? Berkas kecil sendiri supaya penjaga backup di
 * tingkat aplikasi tidak menarik apa pun ke bundel awal.
 *
 * Kuncinya sama dengan `KUNCI_TOKEN` di lib/googleDrive.ts.
 */
export function adaIzinGoogle(): boolean {
  try {
    const t = JSON.parse(sessionStorage.getItem('drillkit.google.token') ?? 'null') as { habis?: number } | null
    return !!t?.habis && t.habis - 60_000 > Date.now()
  } catch {
    return false
  }
}
