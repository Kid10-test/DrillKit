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
import { VitePWA } from 'vite-plugin-pwa'

// DrillKit dikonfigurasi agar bisa diakses dari preview host manapun (0.0.0.0).
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
  },
  /**
   * base './' membuat hasil build portabel: bisa dibuka langsung dari file
   * (mis. di HP), dari subfolder hosting, maupun dari root domain.
   */
  base: './',
  css,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'DrillKit - Pelatih Marching Band',
        short_name: 'DrillKit',
        description: 'Formasi/drill, anggota, absensi, jadwal & metronom untuk marching band. Tetap jalan offline.',
        theme_color: '#0f172a',
        background_color: '#0b1120',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      devOptions: { enabled: false },
    }),
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: true,
  },
  build: {
    /** JavaScript juga diturunkan supaya aman di browser lama. */
    target: 'es2019',
    cssMinify: 'lightningcss',
  },
})
