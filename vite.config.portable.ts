import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { browserslistToTargets } from 'lightningcss'
import browserslist from 'browserslist'

/**
 * Tailwind v4 menghasilkan warna `oklch()` dan `color-mix()`. Browser yang
 * lebih lama dari Chrome 111 / Safari 15.4 / Firefox 113 tidak mengerti
 * keduanya, sehingga SELURUH deklarasi warna dibuang dan aplikasi tampil
 * sebagai teks polos tanpa warna/latar. Lightning CSS menurunkan (downlevel)
 * warna-warna itu menjadi `rgb()` plus versi modernnya sebagai cadangan,
 * sehingga tampilan tetap benar di browser lama maupun baru.
 */
const cssTargets = browserslistToTargets(
  browserslist([
    'chrome >= 87',
    'edge >= 88',
    'firefox >= 78',
    'safari >= 14',
    'ios_saf >= 14',
    'android >= 87',
    'opera >= 73',
  ]),
)

const css = {
  transformer: /** @type {const} */ ('lightningcss'),
  lightningcss: { targets: cssTargets },
}
import { viteSingleFile } from 'vite-plugin-singlefile'
import { pbkdf2Sync } from 'node:crypto'

function hashPinPelatihEnv(): string {
  const pin = process.env.PIN_PELATIH ?? ''
  if (!pin) return JSON.stringify('')
  const h = pbkdf2Sync(pin, 'drillkit-pin-pelatih-v1', 10_000, 32, 'sha256').toString('hex')
  return JSON.stringify(h)
}

/**
 * Build portabel: seluruh JavaScript & CSS ditanam ke dalam SATU berkas HTML.
 *
 * Tujuannya supaya aplikasi bisa dibuka langsung dari berkas (mis. dibuka di HP
 * tanpa hosting). Ini perlu karena browser memblokir `<script type="module" src>`
 * lintas-origin saat halaman dibuka lewat protokol file://.
 *
 * Konsekuensi: service worker / PWA tidak aktif pada mode ini (file:// bukan
 * origin aman), jadi aplikasi belum bisa di-install & offline penuh. Untuk itu
 * tetap perlu hosting HTTPS — lihat DEPLOY.md. Data tetap tersimpan (IndexedDB).
 *
 * Pakai: npm run build:portable  →  hasilnya di dist-standalone/index.html
 */
/**
 * N5 — cap waktu build.
 *
 * Mengapa ini ada: pelatih mengunggah rilis baru ke hosting, lalu melihat
 * tidak ada yang berubah, dan tidak punya cara apa pun untuk mengetahui
 * apakah hostingnya menyajikan rilis baru atau simpanan service worker
 * yang lama. Tanpa cap ini, ia hanya bisa menebak — padahal perbaikannya
 * (tutup lalu buka kembali) berbeda sama sekali dari perbaikan untuk
 * unggahan yang gagal.
 *
 * Cap ini disuntikkan pada saat build (`define`), jadi ia berubah setiap
 * kali aplikasi dirakit, dan menjadi satu-satunya penanda yang jujur
 * tentang rilis mana yang sedang berjalan.
 */
const CAP_BUILD = JSON.stringify(new Date().toISOString())

export default defineConfig({
  define: {
    __CAP_BUILD__: CAP_BUILD,
    __PIN_PELATIH_HASH__: hashPinPelatihEnv(),
  },
  base: './',
  css,
  plugins: [react(), tailwindcss(), viteSingleFile()],
  build: {
    target: 'es2019',
    cssMinify: 'lightningcss',
    outDir: 'dist-standalone',
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 4000,
    reportCompressedSize: false,
  },
})
