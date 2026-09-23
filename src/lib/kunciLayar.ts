/**
 * G2b — kunci layar presenter.
 *
 * Keluhan yang mendasarinya: *di lapangan layar tak sengaja tersentuh dan
 * urutan set berubah.* Layar presenter memang penuh kontrol navigasi —
 * panah, pip kemajuan, ketuk kanvas untuk maju — dan semuanya berada
 * tepat di bawah jari, tali, atau senggolan orang lewat.
 *
 * Dua keputusan yang menentukan, keduanya melawan kebiasaan pertama:
 *
 * 1. **Kunci menahan papan ketik, bukan hanya sentuhan.** Presenter
 *    memang punya pintasan sendiri (panah, PageDown, spasi, R), tetapi
 *    menahan **hanya** yang itu akan menyisakan celah: *remote presenter*
 *    mengirim tombol panah, dan laptop yang tersenggol mengirim tombol
 *    apa saja. Kunci yang tidak menahan papan ketik sama sekali bukan
 *    kunci.
 * 2. **Semua tombol ditelan, kecuali Escape** — bukan daftar tombol yang
 *    dicegat. Menginventaris tombol satu per satu pasti ada yang luput,
 *    dan yang luput justru yang berbahaya: presenter hanya mencegat
 *    panah/spasi/R, sehingga tombol lain (**Delete**, **Ctrl+Z**, huruf
 *    pintasan editor) menembus ke editor di belakangnya. Menelan semuanya
 *    menutup celah itu sekaligus.
 *
 * **Escape sengaja dibiarkan lewat.** Menutup presenter tidak bisa
 * mengubah urutan set, dan menjebak pemakai di dalam layar yang terkunci
 * jauh lebih buruk daripada kehilangan posisi. Ini juga alasan kunci tidak
 * pernah disimpan: kalau ia bertahan setelah aplikasi dimuat ulang,
 * pemakai yang lupa PIN-nya terkunci selamanya.
 */

/** Satu-satunya tombol yang tetap bekerja saat layar terkunci. */
export const TOMBOL_BEBAS = 'Escape'

/**
 * Bolehkah tombol ini lewat saat layar terkunci?
 *
 * Hanya `Escape`. Segala yang lain — termasuk tombol yang tampaknya tidak
 * berbahaya — ditelan, karena presenter berjalan **di atas editor** dan
 * tombol yang tidak dikenalnya akan diteruskan ke sana.
 */
export function bolehLewat(kunci: string): boolean {
  return kunci === TOMBOL_BEBAS
}

/**
 * Penanda elemen yang tombolnya **tetap diterima** walau layar terkunci.
 *
 * Diperlukan karena kunci menelan semua tombol — termasuk ketikan pada
 * kolom PIN-nya sendiri. Tanpa pengecualian ini, **memasang PIN berarti
 * mengunci layar selamanya**: `preventDefault()` pada `keydown` mencegah
 * karakter masuk ke kolom, jadi PIN yang benar pun tidak pernah bisa
 * diketik. Kebuntuan, dan kebuntuan tidak bisa diatasi dengan menekan
 * lebih keras.
 */
export const ATURAN_TERIMA = 'data-terima-kunci'

/**
 * Haruskah tombol ini ditahan?
 *
 * @param diLayarKunci apakah tombol ini ditujukan ke elemen **di dalam**
 *        lapisan kunci (kolom PIN). Kalau ya, tombolnya diterima.
 *
 * Inilah penjaga yang dipakai penangan tombol presenter. Sengaja berbentuk
 * fungsi, bukan penangan `keydown` tersendiri, karena **dua penangan pada
 * target yang sama tidak bisa saling membatalkan**: presenter memasang
 * penangannya dengan tangkap (`capture`) di `window`, jadi penangan kunci
 * yang dipasang belakangan akan berjalan **sesudah** `goNext()` telanjur
 * dipanggil. `preventDefault()` tidak pernah bisa membatalkan apa yang
 * sudah terjadi.
 *
 * Karena itu kunci ditegakkan **di sumbernya** — pada penangan tombol yang
 * sudah ada — bukan dengan menambah penangan saingan.
 */
export function kunciMenahan(terkunci: boolean, kunci: string, diLayarKunci = false): boolean {
  if (!terkunci) return false
  if (diLayarKunci) return false
  return !bolehLewat(kunci)
}

/**
 * Apakah tombol ini ditujukan ke sesuatu di dalam lapisan kunci?
 *
 * Dibaca dari `event.target`, jadi hanya ketikan yang benar-benar masuk ke
 * kolom PIN yang diterima — ketikan liar pada elemen lain tetap tertahan.
 */
export function diDalamLayarKunci(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return !!target.closest(`[${ATURAN_TERIMA}]`)
}

/**
 * Apakah tombol ini mengubah urutan set kalau tidak ditahan?
 *
 * Tidak dipakai untuk menyaring — kunci menelan semuanya — melainkan untuk
 * **dokumentasi yang bisa diuji**: kalau presenter kelak menambah pintasan
 * baru, daftar ini mengingatkan bahwa tombol itu pun harus masuk
 * pertimbangan. Bila daftar ini pernah berbeda dari kenyataan, kuncinya
 * masih aman; itulah sebabnya penyaringan tidak memakainya.
 */
export const PINTASAN_URUTAN = [
  'ArrowRight',
  'ArrowDown',
  'ArrowLeft',
  'ArrowUp',
  'PageDown',
  'PageUp',
  ' ',
  'r',
  'R',
] as const

/**
 * Kalimat penjelas di layar terkunci.
 *
 * Sengaja menyebut **apa yang ditahan** (sentuhan dan papan ketik), bukan
 * sekadar "terkunci" — pemakai perlu tahu bahwa layarnya tidak rusak, dan
 * bahwa remote-nya pun ikut tertahan.
 */
export function keteranganKunci(adaPin: boolean): string {
  return adaPin
    ? 'Sentuhan dan papan ketik ditahan, termasuk remote. Masukkan PIN untuk membuka.'
    : 'Sentuhan dan papan ketik ditahan, termasuk remote. Tekan Buka untuk melanjutkan.'
}

/**
 * Berapa kali percobaan PIN yang salah sebelum dikunci sementara.
 *
 * Bukan pengaman serius — PIN tersimpan di `localStorage` dan tidak
 * dimaksudkan menahan penyerang. Tujuannya menahan **ketukan beruntun**:
 * layar yang disenggol berulang kali tidak akan membuka kunci dengan sendirinya.
 */
export const BATAS_COBA = 5

/** Waktu tunggu setelah percobaan salah melewati batas, dalam detik. */
export const TUNGGU_COBA = 15

/**
 * Apakah percobaan berikutnya harus ditahan?
 *
 * Mengembalikan `true` bila percobaan salah sudah mencapai batas **dan**
 * waktu tunggunya belum lewat. Dipisahkan dari komponen supaya aturannya
 * bisa diuji tanpa peramban.
 */
export function masihTunggu(salah: number, sejak: number | null, sekarang: number): boolean {
  if (salah < BATAS_COBA || sejak == null) return false
  return sekarang - sejak < TUNGGU_COBA * 1000
}
