/**
 * N11 — penanda bahwa aplikasi benar-benar berjalan.
 *
 * Dibaca oleh skrip sederhana di dalam `index.html`, yang tidak bisa
 * mengimpor apa pun: kalau berkas modulnya gagal dimuat, hanya skrip
 * sebaris itu yang masih hidup untuk menolong pemakai.
 */
interface Window {
  /** `true` sesudah React berhasil dimuat — penanda aplikasinya hidup. */
  __drillkitJalan?: boolean
  /** Dijalankan sekali oleh `index.html` untuk menjadwalkan pemeriksaan. */
  __drillkitPeriksa?: () => void
}
