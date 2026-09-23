import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import { mulaiTampilan } from './lib/tampilan'

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
