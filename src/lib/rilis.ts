/**
 * N13 — mendeteksi bahwa situsnya memuat rilis yang LEBIH BARU daripada
 * yang sedang berjalan di perangkat ini.
 *
 * Mengapa ini perlu: aplikasi ini **tidak** memuat ulang dirinya sendiri
 * (itu disengaja — memuat ulang otomatis akan mematikan metronom di
 * tengah latihan). Akibatnya sebuah perangkat bisa menjalankan versi
 * lama berhari-hari tanpa ada yang memberitahunya. Pelatih yang baru
 * saja mengunggah perbaikan lalu melihat anak-anaknya tetap memakai
 * yang lama akan mengira unggahannya gagal — padahal unggahannya
 * berhasil, hanya saja perangkat itu belum dimuat ulang.
 *
 * Caranya sengaja sederhana dan tidak butuh berkas tambahan: nama
 * bundelnya berisi **capaian isi** (hash), jadi bila nama bundel yang
 * diminta `index.html` di situs berbeda dari nama bundel yang sedang
 * berjalan, berarti situsnya memuat rilis yang lain.
 *
 * Modul ini murni — tidak menyentuh jaringan maupun `document`, supaya
 * seluruh logikanya bisa diuji tanpa peramban.
 */

/** Pola nama bundel utama. Capaian isinya berubah setiap kali isinya berubah. */
const POLA = /assets\/index-[A-Za-z0-9_-]+\.js/

/**
 * Nama bundel yang SEDANG berjalan.
 *
 * `null` bila tidak ketemu — yaitu saat aplikasi dijalankan dari kode
 * sumber (server pengembangan), di mana tidak ada bundel sama sekali.
 */
export function berkasBerjalan(url: string): string | null {
  const m = url.match(POLA)
  return m ? m[0] : null
}

/**
 * Nama bundel yang diminta oleh `index.html` **yang sedang melayani**.
 *
 * Bukan yang ada di folder komputer pelatih — melainkan yang benar-benar
 * dijawab situsnya saat ini. Awalan `./` dan `/` dibuang supaya
 * hasilnya bisa dibandingkan langsung dengan `berkasBerjalan`.
 */
export function berkasDiSitus(teksHtml: string): string | null {
  const m = teksHtml.match(POLA)
  return m ? m[0].replace(/^\.?\//, '') : null
}

/**
 * Apakah situsnya memuat rilis yang berbeda?
 *
 * Bila salah satunya tidak diketahui, jawabannya **tidak**. Penanda yang
 * berbunyi pada keadaan yang tidak diketahui akan berisik dan akhirnya
 * diabaikan — sama buruknya dengan tidak pernah berbunyi.
 */
export function adaRilisBaru(berjalan: string | null, diSitus: string | null): boolean {
  if (!berjalan || !diSitus) return false
  return berjalan !== diSitus
}
