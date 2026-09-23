import { useCallback, useEffect, useState } from 'react'
import { adaRilisBaru, berkasBerjalan, berkasDiSitus } from '../lib/rilis'

/**
 * N13 — bundel yang SEDANG berjalan di perangkat ini.
 *
 * Dihitung sekali pada saat modul dimuat. `import.meta.url` di dalam
 * hasil build berisi nama bundelnya lengkap dengan capaian isinya —
 * itulah penanda rilis yang paling jujur, dan ia tidak butuh berkas
 * tambahan apa pun di situs.
 */
const BERKAS_BERJALAN = berkasBerjalan(typeof import.meta !== 'undefined' ? import.meta.url : '')

/**
 * Tunggu sebentar sebelum memeriksa. Pemeriksaan ini mengirim satu
 * permintaan jaringan, dan aplikasi yang baru saja hidup sedang sibuk
 * membuka basis datanya — jangan direbut.
 */
const TUNDA_AWAL = 4000

/**
 * Apakah situsnya memuat rilis yang lebih baru daripada yang sedang
 * berjalan di perangkat ini?
 *
 * Sengaja dijawab dengan hemat: pemeriksaan hanya dilakukan saat
 * aplikasi hidup dan saat aplikasinya kembali terlihat. HP yang
 * ditinggal semalaman lalu dibuka lagi tidak akan pernah memuat ulang
 * dengan sendirinya — dan justru pada saat itulah rilis baru menumpuk.
 */
export function useRilisBaru(): boolean {
  const [ada, setAda] = useState(false)

  const periksa = useCallback(async () => {
    // Tidak ada bundel (server pengembangan) → tidak ada yang bisa dibandingkan.
    if (!BERKAS_BERJALAN) return
    // Dibuka dari berkas (portable) → tidak ada situsnya.
    if (typeof location !== 'undefined' && location.protocol === 'file:') return
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return
    try {
      const url = new URL('index.html', document.baseURI).href
      const res = await fetch(url, { cache: 'no-store' })
      if (!res.ok) return
      const teks = await res.text()
      if (adaRilisBaru(BERKAS_BERJALAN, berkasDiSitus(teks))) setAda(true)
    } catch {
      /*
       * Gagal memeriksa BUKAN berarti ada rilis baru. Luring, situs
       * sedang lambat, atau permintaannya diblokir — semuanya harus
       * didiamkan, karena penanda yang berbunyi tanpa sebab akan
       * berhenti dipercaya.
       */
    }
  }, [])

  useEffect(() => {
    const t = window.setTimeout(() => void periksa(), TUNDA_AWAL)

    /*
     * Sinyal yang UTAMA justru bukan pemeriksaannya, melainkan pekerja
     * layanannya.
     *
     * Mengapa: setelah aplikasi pernah dibuka, `index.html` disajikan
     * dari cache pekerja layanan — jadi memintanya lewat jaringan akan
     * mengembalikan salinan lama dan tidak pernah mendeteksi perubahan.
     * (Ini bukan dugaan: uji pertama gagal persis karena ini.) Tetapi
     * bila pekerja layanannya BERGANTI, kode yang sedang berjalan pasti
     * lebih tua dari yang ada di situs. Itu sinyal yang tidak bisa
     * meleset.
     *
     * Penjagaan yang perlu: saat pekerja layanan pertama kali mengambil
     * alih, `controllerchange` juga berbunyi — padahal saat itu tidak
     * ada versi lama sama sekali. Karenanya hanya dihitung bila
     * SEBELUMNYA sudah ada pengendali. Dan bila pengendalinya menjadi
     * kosong (pekerja layanan dibuang), itu bukan rilis baru.
     */
    let punyaPengendali = navigator.serviceWorker?.controller != null
    const saatBerganti = () => {
      const sekarang = navigator.serviceWorker?.controller != null
      if (punyaPengendali && sekarang) setAda(true)
      punyaPengendali = sekarang
    }
    navigator.serviceWorker?.addEventListener('controllerchange', saatBerganti)

    const saatKelihatan = () => {
      if (document.visibilityState === 'visible') void periksa()
    }
    document.addEventListener('visibilitychange', saatKelihatan)
    return () => {
      window.clearTimeout(t)
      navigator.serviceWorker?.removeEventListener('controllerchange', saatBerganti)
      document.removeEventListener('visibilitychange', saatKelihatan)
    }
  }, [periksa])

  return ada
}

/**
 * Muat ulang aplikasinya, dengan sedikit usaha lebih supaya yang
 * terbuka benar-benar rilis yang baru.
 *
 * Pekerja layanan diminta memeriksa pembaruan lebih dulu: tanpa itu,
 * ia akan dengan senang hati menyajikan salinan lama yang sudah ada di
 * perangkat, dan pemakai akan memuat ulang tanpa hasil apa pun.
 */
export async function muatUlangKeRilisBaru(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker?.getRegistration()
    await reg?.update()
  } catch {
    // Tidak punya pekerja layanan — langsung muat ulang saja.
  }
  // Penanda waktu supaya perambah tidak mengembalikan salinan lamanya.
  window.location.href = `${window.location.pathname}?rilis=${Date.now()}${window.location.hash}`
}
