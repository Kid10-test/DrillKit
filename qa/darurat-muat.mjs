/**
 * N11 — Panel darurat bila aplikasi GAGAL dimuat.
 *
 * Mengapa ini ada: sebuah unggahan ke host statis adalah PENGGANTIAN.
 * Berkas ber-hash yang lama ikut terhapus, sementara perambah bisa
 * saja masih menyimpan `index.html` lama berikut `sw.js` lama. Perambah
 * itu lalu meminta berkas yang sudah tiada, menerima 404, dan pemakai
 * melihat halaman "link rusak" — padahal situsnya sehat.
 *
 * Yang paling menderita pemakai awam: mereka tidak tahu apa itu cache,
 * apalagi cara membersihkannya di Safari. Panel ini memberi mereka
 * SATU tombol.
 *
 * Yang diuji di sini bukan "apakah tombolnya ada" — itu mudah
 * ditulis dan tidak membuktikan apa pun. Yang diuji:
 *   1. aplikasi yang HIDUP tidak pernah menampilkannya,
 *   2. aplikasi yang GAGAL menampilkannya,
 *   3. tombolnya benar-benar menyembuhkan keadaannya.
 *
 * Pakai: BASE=http://localhost:4173 node darurat-muat.mjs
 */
import puppeteer from 'puppeteer'
import fs from 'node:fs'
import { lewatSambutan } from './sambutan.mjs'
import { DIST } from './lokasi.mjs'

const BASE = process.env.BASE || 'http://localhost:4173'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

let lulus = 0
const gagal = []
const cek = (nama, ok, detail = '') => {
  if (ok) {
    lulus += 1
    console.log('  ✓ ' + nama)
  } else {
    gagal.push(`${nama}${detail ? ' — ' + detail : ''}`)
    console.log('  ✗ ' + nama + (detail ? ' → ' + detail : ''))
  }
}
const ada = (h, sel) => h.evaluate((s) => !!document.querySelector(s), sel)

const browser = await puppeteer.launch({
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required'],
  defaultViewport: { width: 420, height: 900 },
})
const errors = []

try {
  /* ---------------- 0. berkas konfigurasi host ikut terunggah ---------------- */
  /*
   * Tanpa dua berkas ini, `sw.js` boleh saja disimpan oleh jaringan
   * pengirim isi (CDN) dan perambah terus-menerus menerima pekerja
   * layanan yang sudah usang.
   */
  console.log('\n— Berkas pengaturan host ikut dalam hasil build —')
  {
    for (const nama of ['_headers', '_redirects']) {
      cek(`0: dist/${nama} ada`, fs.existsSync(`${DIST}/${nama}`))
    }
    const headers = fs.existsSync(`${DIST}/_headers`)
      ? fs.readFileSync(`${DIST}/_headers`, 'utf8')
      : ''
    cek('0: _headers melarang cache pada sw.js', /\/sw\.js[\s\S]*?no-store/.test(headers),
      headers.slice(0, 120))
    cek('0: _headers melarang cache pada index.html', /\/index\.html[\s\S]*?no-store/.test(headers),
      headers.slice(0, 160))
    const redirects = fs.existsSync(`${DIST}/_redirects`)
      ? fs.readFileSync(`${DIST}/_redirects`, 'utf8')
      : ''
    /*
     * Catatan penting yang sengaja tertulis di dalam berkasnya: berkas
     * yang BENAR-BENAR ada tidak pernah tertimpa aturan ini (aturan
     * Netlify: "you can't shadow an existing URL by default"), jadi
     * /paket.json tetap terlayani dan tombol Perbarui aman.
     */
    cek('0: _redirects memakai status 200 (bukan 301/302)',
      /\/\*\s+\/index\.html\s+200/.test(redirects), redirects.trim().split('\n').pop())
  }

  /* ---------------- 1. aplikasi hidup → panel tidak pernah tampil ------------- */
  console.log('\n— Aplikasi hidup: panel tidak boleh muncul —')
  {
    const p = await browser.newPage()
    p.on('pageerror', (e) => errors.push(String(e)))
    await p.goto(BASE + '/', { waitUntil: 'networkidle2' })
    await wait(1500)
    await lewatSambutan(p)
    await wait(2000)
    cek('1: aplikasinya berjalan', await p.evaluate(() => window.__drillkitJalan === true))
    cek('1: panel daruratnya TIDAK ada', !(await ada(p, '#darurat')))
    // Tunggu lewat batas waktu pemeriksaannya (8 dtk) — jangan sampai
    // panelnya muncul belakangan pada perangkat yang lambat.
    await wait(9000)
    cek('1: dan tetap tidak muncul setelah 9 detik', !(await ada(p, '#darurat')))
    await p.close()
  }

  /* ---------------- 2. aplikasi gagal → panel muncul & menyembuhkan ----------- */
  console.log('\n— Berkas aplikasi gagal dimuat: panel muncul & menyembuhkan —')
  {
    /*
     * Konteks BARU, sengaja. Pada halaman sebelumnya pekerja layanannya
     * sudah terdaftar di asal yang sama; kalau dipakai lagi, ia akan
     * melayani aplikasi dari cache dan kegagalan yang sedang diuji
     * tidak pernah terjadi — ujinya lulus seolah semuanya baik-baik
     * saja. Kebetulan ini juga menunjukkan persis mekanisme yang
     * membuat pemakai macet pada versi lama.
     */
    const ctx = await browser.createBrowserContext()
    const p = await ctx.newPage()
    let blokir = true
    await p.setRequestInterception(true)
    p.on('request', (r) => {
      // Pekerja layanan ikut diblokir supaya keadaannya bersih: kalau
      // ia sempat terdaftar, ia bisa saja melayani dari cache dan
      // menyembunyikan kegagalan yang sedang diuji.
      if (blokir && /assets\/index-.*\.js|registerSW\.js/.test(r.url())) return r.abort()
      return r.continue()
    })
    await p.goto(BASE + '/', { waitUntil: 'domcontentloaded' }).catch(() => {})
    await wait(10500)

    cek('2: panel darurat MUNCUL bila aplikasi gagal dimuat', await ada(p, '#darurat'))
    {
      const tampil = await p.evaluate(() => {
        const e = document.getElementById('darurat')
        return e ? getComputedStyle(e).display : null
      })
      cek('2: dan benar-benar terlihat, bukan sekadar ada', tampil === 'block', String(tampil))
    }
    {
      const t = await p.evaluate(() => {
        const e = document.getElementById('tombol-bersihkan')
        return e ? e.textContent.trim() : null
      })
      cek('2: tombolnya ada dan berbahasa Indonesia', /Bersihkan/.test(String(t)), String(t))
    }
    {
      const teks = await p.evaluate(() => {
        const e = document.getElementById('darurat')
        return e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : ''
      })
      cek('2: panelnya MENJELASKAN penyebabnya, bukan hanya "error"',
        /versi lama/.test(teks), teks.slice(0, 140))
      cek('2: dan menyebut bahwa datanya tidak ikut terhapus',
        /tidak ikut terhapus/.test(teks), teks.slice(0, 200))
    }

    // Buka blokirnya, lalu tekan tombolnya: keadaan harus pulih.
    blokir = false
    await p.evaluate(() => document.getElementById('tombol-bersihkan')?.click())
    await p.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {})
    await wait(2500)

    {
      const url = p.url()
      cek('3: tombolnya memuat ulang dengan penanda bersih', /bersih=\d+/.test(url), url)
    }
    cek('3: aplikasi HIDUP kembali setelah dibersihkan',
      await p.evaluate(() => window.__drillkitJalan === true))
    cek('3: panelnya hilang', !(await ada(p, '#darurat')))
    await p.close()
    await ctx.close()
  }

  cek('tidak ada galat di konsol', errors.length === 0, errors.slice(0, 3).join(' | '))
} finally {
  await browser.close()
}

console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) {
  for (const g of gagal) console.log('  ✗ ' + g)
  process.exitCode = 1
}
