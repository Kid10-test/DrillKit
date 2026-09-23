/**
 * Lewati layar sambutan pada perangkat uji.
 *
 * Layar sambutan sengaja muncul di setiap perangkat yang benar-benar baru,
 * dan setiap kali Puppeteer diluncurkan ia membawa profil baru. Jadi
 * rangkaian uji yang disusun sebelum layar ini ada tiba-tiba berhadapan
 * dengannya dan tidak bisa menyentuh apa pun.
 *
 * Menulis mode lebih dulu menjadikan perangkat uji ini "perangkat milik
 * pelatih", persis keadaan sesungguhnya setelah pelatih memilih sekali —
 * bukan jalan pintas yang menyembunyikan cacat. Bila sebuah uji memang
 * hendak mulai sebagai anggota, panggil dengan `lewatSambutan(h, 'member')`.
 *
 * Harus dipanggil **setelah** halaman pertama dibuka: localStorage tidak
 * bisa disentuh sebelum ada asalnya.
 */
export async function lewatSambutan(h, mode = 'coach') {
  await h.evaluate((m) => localStorage.setItem('drillkit.mode', m), mode)
  await h.reload({ waitUntil: 'networkidle2' })
  await new Promise((r) => setTimeout(r, 1500))
}
