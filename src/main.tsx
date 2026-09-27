import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import { mulaiTampilan } from './lib/tampilan'

/**
 * QR kunci pribadi memakai fragment URL agar kunci tidak pernah dikirim ke
 * server. Karena DrillKit juga memakai HashRouter, `#kunci` perlu diubah
 * sebelum router membaca alamatnya; kalau tidak, router akan mengira kunci
 * itu nama rute lalu membuangnya sebelum halaman anggota sempat membacanya.
 */
function siapkanKunciQr() {
  if (typeof location === 'undefined') return
  const hash = location.hash
  if (!hash || hash === '#' || hash.startsWith('#/')) return
  const kunci = hash.slice(1)
  try {
    history.replaceState(null, '', `${location.pathname}${location.search}#/berbagi?kunci=${encodeURIComponent(kunci)}`)
  } catch {
    /* history bisa diblokir pada sebagian pembuka berkas */
  }
}

siapkanKunciQr()

/**
 * HashRouter dipilih supaya aplikasi bisa dibuka dari mana saja
 * (file host statis, PWA offline, atau preview) tanpa perlu aturan
 * rewrite di server.
 */
/** B4 — pasang penanda tampilan (kontras/huruf besar) sebelum render. */
mulaiTampilan()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>,
)

/**
 * N11 — kabari berkas HTML bahwa aplikasinya benar-benar hidup, lalu
 * singkirkan panel daruratnya kalau kebetulan sudah telanjur muncul.
 *
 * Tanpa baris ini, panel darurat akan muncul delapan detik kemudian
 * pada perangkat yang lambat sekalipun aplikasinya berjalan baik —
 * dan pemakai akan disuruh "membersihkan" sesuatu yang tidak perlu
 * dibersihkan.
 */
window.__drillkitJalan = true
document.getElementById('darurat')?.remove()
