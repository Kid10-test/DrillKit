/**
 * Uji **cap rilis** — penanda satu-satunya yang jujur tentang versi yang
 * sedang berjalan.
 *
 * Mengapa ini ada: pelatih mengunggah rilis baru ke hosting, lalu melihat
 * **tidak ada perubahan**, dan tidak punya cara apa pun untuk mengetahui
 * apakah hostingnya menyajikan rilis baru atau simpanan service worker
 * yang lama. Tanpa cap ini ia hanya bisa menebak — padahal perbaikan
 * untuk "simpanan lama" (tutup lalu buka kembali) berbeda sama sekali
 * dari perbaikan untuk "unggahan gagal" (unggah ulang).
 *
 * Yang diuji dan menentukan: capnya harus **berasal dari waktu build yang
 * sesungguhnya**, bukan teks yang diketik. Cap yang tidak pernah berubah
 * lebih berbahaya daripada tidak ada cap sama sekali, karena ia memberi
 * keyakinan palsu bahwa rilisnya sudah berganti.
 */
import puppeteer from 'puppeteer'
import { lewatSambutan } from './sambutan.mjs'
import fs from 'node:fs'

const BASE = process.env.BASE || 'http://localhost:4173'

const browser = await puppeteer.launch({
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  defaultViewport: { width: 1300, height: 1000 },
})
const errors = []

let lulus = 0
const gagal = []
const cek = (nama, syarat, keterangan = '') => {
  if (syarat) lulus += 1
  else gagal.push(`${nama}${keterangan ? ' — ' + keterangan : ''}`)
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

try {
  const A = await browser.newPage()
  A.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  A.on('pageerror', (e) => errors.push(String(e)))
  A.on('dialog', async (d) => { await d.accept() })
  await A.goto(BASE, { waitUntil: 'networkidle2' })
  await wait(1200)
  await lewatSambutan(A)
  await wait(1500)

  await A.goto(`${BASE}/#/pengaturan`, { waitUntil: 'networkidle2' })
  await wait(2200)

  const ada = (id, h = A) => h.evaluate((x) => document.querySelector(`[data-testid="${x}"]`) != null, id)
  const isi = (id, h = A) => h.evaluate((x) => document.querySelector(`[data-testid="${x}"]`)?.textContent ?? '', id)

  cek('1: Pengaturan menampilkan kartu rilis', await ada('kartu-rilis'))
  const cap = await isi('cap-build')
  cek('1: capnya terisi', cap.trim().length > 0, `"${cap}"`)

  // Harus memuat tahun — kalau tidak, ia bukan tanggal.
  cek('2: capnya berbentuk tanggal yang bisa dibaca', /\d{4}/.test(cap), cap)

  /* Yang menentukan: capnya harus SESUAI dengan waktu build yang nyata.
     Hasil buildnya baru saja dibuat, jadi capnya tidak boleh lebih tua
     dari satu hari. Cap yang lebih tua berarti ia diketik atau disuntikkan
     sekali lalu beku — dan cap yang beku memberi keyakinan palsu. */
  const berkas = fs.readdirSync('/home/user/drillkit/dist/assets').filter((f) => f.endsWith('.js'))
  const js = fs.readFileSync(`/home/user/drillkit/dist/assets/${berkas[0]}`, 'utf8')
  const cocok = js.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/)
  cek('3: cap waktu build tersemat di dalam berkas rilisnya', cocok != null,
    cocok ? cocok[0] : 'tidak ketemu')

  if (cocok) {
    const umur = Date.now() - new Date(cocok[0]).getTime()
    const hari = umur / 86_400_000
    cek('3: capnya BERASAL dari build yang baru saja dilakukan, bukan teks beku',
      hari >= 0 && hari < 1, `umur ${(hari * 24).toFixed(1)} jam`)
  }

  // Bilah sisi (desktop) juga menampilkannya.
  const singkat = await isi('cap-build-singkat')
  cek('4: bilah sisi menampilkan cap singkatnya', singkat.trim().length > 0, `"${singkat}"`)
  cek('4: cap singkatnya bukan teks putus asa', singkat !== 'versi?', singkat)

  /* ============ 5. Penanda "ada versi baru" (N13) =====================
   *
   * Mengapa butir ini ada: aplikasi ini sengaja TIDAK memuat ulang
   * dirinya sendiri (memuat ulang otomatis akan mematikan metronom di
   * tengah latihan). Konsekuensinya sebuah perangkat bisa menjalankan
   * versi lama berhari-hari. Pelatih yang baru mengunggah perbaikan
   * lalu melihat anak-anaknya tetap memakai yang lama akan mengira
   * unggahannya gagal — padahal unggahannya berhasil.
   *
   * Penanda ini punya DUA sinyal, sebab satu saja tidak cukup:
   *   a. pekerja layanan berganti — sinyal utama di dunia nyata;
   *   b. nama bundel di index.html berbeda — untuk perangkat yang
   *      belum punya pekerja layanan sama sekali.
   *
   * Mengapa butir (b) saja tidak cukup: setelah aplikasi pernah dibuka,
   * `index.html` disajikan dari cache pekerja layanan, sehingga
   * permintaannya tidak pernah sampai ke jaringan. Ini bukan dugaan —
   * uji pertama gagal persis karena itu (penyadapan jaringannya tidak
   * pernah dipanggil, padahal `unregister()` sudah dijalankan).
   *
   * Dua arah kesalahan diuji keduanya: tidak pernah berbunyi, dan
   * berbunyi tanpa sebab.
   */
  {
    await A.goto(`${BASE}/#/`, { waitUntil: 'networkidle2' })
    await wait(6000) // pemeriksaan pertama berjalan 4 detik setelah hidup
    cek('5a: rilis yang sama TIDAK memunculkan penanda',
      !(await ada('penanda-rilis-baru')))

    /* --- Sinyal utama: pekerja layanannya berganti -------------------- */
    await A.evaluate(() => navigator.serviceWorker.dispatchEvent(new Event('controllerchange')))
    await wait(800)
    cek('5b: pekerja layanan yang berganti MEMUNCULKAN penanda',
      await ada('penanda-rilis-baru'))

    if (await ada('penanda-rilis-baru')) {
      const teks = await isi('penanda-rilis-baru')
      cek('5b: penandanya dijelaskan dengan bahasa yang tidak menakutkan',
        /tidak akan hilang/i.test(teks), teks.replace(/\s+/g, ' ').slice(0, 120))
      cek('5b: dan menawarkan satu tombol untuk memuat ulang',
        await ada('tombol-muat-ulang-rilis'))
      await A.click('[data-testid="tombol-nanti-rilis"]')
      await wait(600)
      cek('5b: tombol "Nanti" menutup penandanya', !(await ada('penanda-rilis-baru')))
    }
  }

  /* --- Sinyal kedua: nama bundel di situs berbeda --------------------- */
  /*
   * Konteks baru dengan pekerja layanan DIBLOKIR sejak awal, supaya
   * `index.html` benar-benar datang dari jaringan. Tanpa itu
   * permintaannya dijawab dari cache dan percobaan ini tidak menguji
   * apa pun — kegagalan yang sunyi, tanpa satu baris pun.
   */
  {
    const ctx = await browser.createBrowserContext()
    const B = await ctx.newPage()
    B.on('pageerror', (e) => errors.push(String(e)))
    let modifikasi = false
    await B.setRequestInterception(true)
    B.on('request', async (r) => {
      if (/registerSW\.js|\/sw\.js/.test(r.url())) return r.abort()
      if (modifikasi && r.url().endsWith('/index.html')) {
        const asli = await (await fetch(r.url())).text()
        return r.respond({
          status: 200,
          contentType: 'text/html',
          body: asli.replace(/index-[A-Za-z0-9_-]+\.js/g, 'index-unggahanbaru1.js'),
        })
      }
      return r.continue()
    })
    await B.goto(BASE, { waitUntil: 'networkidle2' })
    await wait(1200)
    await lewatSambutan(B)
    await wait(5500)

    cek('5c: tanpa pekerja layanan, rilis yang sama tetap tidak berbunyi',
      !(await ada('penanda-rilis-baru', B)))

    /*
     * Penjaga yang mudah dilupakan: `controllerchange` BERBUNYI juga
     * saat pekerja layanan pertama kali mengambil alih (atau saat ia
     * dibuang), padahal saat itu tidak ada versi lama sama sekali.
     * Penanda yang muncul pada keadaan itu akan diabaikan pemakainya.
     */
    await B.evaluate(() => navigator.serviceWorker.dispatchEvent(new Event('controllerchange')))
    await wait(800)
    cek('5d: controllerchange TANPA pengendali sebelumnya tidak memunculkan penanda',
      !(await ada('penanda-rilis-baru', B)))

    modifikasi = true
    await B.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    let muncul = false
    for (let i = 0; i < 30; i += 1) {
      await wait(300)
      if (await ada('penanda-rilis-baru', B)) { muncul = true; break }
    }
    cek('5e: situs yang memuat bundel lain MEMUNCULKAN penanda', muncul)
    await B.close()
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
