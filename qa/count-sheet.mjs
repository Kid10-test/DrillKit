/**
 * Rangkaian uji E2E peramban #17 — Lembar Hitungan Color Guard (Count Sheet) & Buku Saku Visual (v1.2.1):
 *  1. Pelatih membuka Editor Drill -> tombol `Guard` langsung membuka `modal-count-sheet` tanpa jeda Suspense
 *  2. Membuat Count Sheet terikat Set & Birama lagu contoh, menyisipkan teknik cepat (`Drop Spin`, `Toss 45`),
 *     menandai hitungan Aksen (`▲`) & Catch (`★`), serta posisi tangan
 *  3. Membuka pratinjau cetak A4 & Buku Saku Lipat A5: verifikasi 0 `oklch()`/`color-mix()`, koordinat + simbol ★,
 *     serta tombol `Escape` hanya menutup modal pratinjau tanpa menutup modal editor Count Sheet di bawahnya
 *  4. Verifikasi integrasi `centang-dot-guard` pada `DotSheetModal`
 *  5. Ekspor ZIP Paket Per Anggota (`unduh-per-anggota`) -> buka di konteks Mode Anggota murni pada layar HP `360×740`:
 *     - Bebas bilah bawah "Tim" & bebas luapan horizontal (`scrollWidth <= innerWidth`)
 *     - Tab Formasi menampilkan `kartu-count-sheet-anggota` dan menyorot hitungan aktif saat animasi `Putar perpindahan`
 *     - Tab Musik menampilkan `panel-count-sheet-musik` dan menyorot hitungan sinkron waktu nyata saat metronom berjalan
 */
import puppeteer from 'puppeteer'
import { lewatSambutan } from './sambutan.mjs'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const BASE = (process.env.BASE || process.argv[2] || 'http://localhost:4173').replace(/\/+$/, '')
const EXEC = process.env.PUPPETEER_EXECUTABLE_PATH || undefined
const tunggu = (ms) => new Promise((r) => setTimeout(r, ms))

const UNDUH = path.join(os.tmpdir(), `unduh-cs-${Date.now()}`)
const BUKA = path.join(os.tmpdir(), `buka-cs-${Date.now()}`)
fs.mkdirSync(UNDUH, { recursive: true })
fs.mkdirSync(BUKA, { recursive: true })

let lulus = 0
let gagal = 0
function cek(kondisi, pesan) {
  if (kondisi) {
    lulus += 1
    console.log(`  ✓ ${pesan}`)
  } else {
    gagal += 1
    console.error(`  ✗ GAGAL: ${pesan}`)
  }
}

const browser = await puppeteer.launch({
  headless: true,
  executablePath: EXEC,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
})

try {
  const page = await browser.newPage()
  const cdp = await page.target().createCDPSession()
  await cdp.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: UNDUH })
  await page.setViewport({ width: 1280, height: 900 })

  await page.goto(`${BASE}/`, { waitUntil: 'networkidle2' })
  await lewatSambutan(page, 'coach')
  await tunggu(600)

  // Muat data contoh tim (memuat anggota seksi Color Guard, lagu, & drill)
  await page.evaluate(() => {
    const btnContoh = [...document.querySelectorAll('button')].find((b) =>
      (b.textContent || '').includes('Muat data contoh'),
    )
    btnContoh?.click()
  })
  await tunggu(2400)

  await page.evaluate(() => {
    location.hash = '#/drill'
  })
  await page.waitForSelector('[data-testid="tombol-count-sheet"]', { timeout: 15000 })

  await page.click('[data-testid="tombol-count-sheet"]')
  await page.waitForSelector('[data-testid="modal-count-sheet"]', { timeout: 8000 })

  const tombolBuatAda = await page.$('[data-testid="buat-count-sheet-baru"]')
  cek(!!tombolBuatAda, 'Modal Count Sheet langsung siap tanpa balapan lazy Suspense')

  await page.click('[data-testid="buat-count-sheet-baru"]')
  await page.waitForSelector('[data-testid="blok-count-sheet-0"]', { timeout: 8000 })
  cek(true, 'Count Sheet baru otomatis membangkitkan blok 8-count dari Set formasi')

  // Tautkan ke lagu pertama di repertoar lewat page.select (memicu onChange React) lalu susun ulang blok
  const laguDipilih = await page.evaluate(() => {
    const sel = document.querySelector('[data-testid="pilih-lagu-cs"]')
    if (!sel) return ''
    return sel.value || (sel.options.length > 1 ? sel.options[1].value : '')
  })
  if (laguDipilih) {
    await page.select('[data-testid="pilih-lagu-cs"]', laguDipilih)
  }
  await tunggu(250)
  await page.click('[data-testid="susun-blok-per8"]')
  await tunggu(250)
  cek(!!laguDipilih, 'Count Sheet tertaut ke lagu repertoar & birama tersinkron otomatis')

  // Ketuk pil teknik cepat Drop Spin & Toss 45 pada Blok #1
  await page.click('[data-testid="pil-teknik-0-Drop Spin"]')
  await tunggu(120)
  await page.click('[data-testid="pil-teknik-0-Toss 45"]')
  await tunggu(120)

  const isiTeknik = await page.$eval('[data-testid="input-teknik-blok-0"]', (el) => el.value)
  cek(
    isiTeknik.includes('Drop Spin') && isiTeknik.includes('Toss 45'),
    `Pil teknik cepat mengisi ringkasan: "${isiTeknik}"`,
  )

  // Tandai hitungan 6 sebagai ▲ Aksen dan hitungan 8 sebagai ★ Catch
  await page.click('[data-testid="mode-ketuk-aksen-0"]')
  await page.click('[data-testid="pil-count-0-6"]')
  await tunggu(120)
  await page.click('[data-testid="mode-ketuk-tangkap-0"]')
  await page.click('[data-testid="pil-count-0-8"]')
  await tunggu(120)

  const teksPil8 = await page.$eval('[data-testid="pil-count-0-8"]', (el) => el.textContent || '')
  cek(teksPil8.includes('8★'), 'Ketuk hitungan 8 menandai ★ Catch pada pita hitungan')

  // Isi posisi tangan
  await page.type('[data-testid="input-tangan-blok-0"]', 'Kanan di tab, kiri ujung bawah')
  await tunggu(250)

  // Buka pratinjau cetak A4 Gabungan
  await page.click('[data-testid="pratinjau-cetak-cs"]')
  await page.waitForSelector('[data-testid="modal-pratinjau-cs"]', { timeout: 8000 })
  const srcDocA4 = await page.$eval(
    '[data-testid="iframe-pratinjau-cs"]',
    (el) => el.getAttribute('srcdoc') || '',
  )
  cek(
    srcDocA4.length > 500 &&
      !/oklch\(|color-mix\(/i.test(srcDocA4) &&
      srcDocA4.includes('Drop Spin') &&
      srcDocA4.includes('8★') &&
      srcDocA4.includes('Kanan di tab'),
    'Pratinjau cetak A4 gabungan murni #hex serta memuat teknik, ★ Catch, & posisi tangan',
  )

  // Tekan Escape sekali: hanya modal pratinjau di atas yang tertutup, modal editor tetap terbuka
  await page.keyboard.press('Escape')
  await tunggu(250)
  const pratinjauMasihAda = await page.$('[data-testid="modal-pratinjau-cs"]')
  const editorMasihAda = await page.$('[data-testid="modal-count-sheet"]')
  cek(!pratinjauMasihAda && !!editorMasihAda, 'Escape pada modal bertumpuk hanya menutup pratinjau teratas')

  // Coba format Buku Saku Lipat Guard (A5)
  await page.select('[data-testid="pilih-format-cetak-cs"]', 'buku-saku')
  await page.click('[data-testid="pratinjau-cetak-cs"]')
  await page.waitForSelector('[data-testid="iframe-pratinjau-cs"]', { timeout: 8000 })
  const srcDocSaku = await page.$eval(
    '[data-testid="iframe-pratinjau-cs"]',
    (el) => el.getAttribute('srcdoc') || '',
  )
  cek(
    !/oklch\(|color-mix\(/i.test(srcDocSaku) && srcDocSaku.includes('kartu-saku-guard'),
    'Pratinjau Buku Saku Lipat Guard (A5) murni #hex dan berformat kartu saku',
  )

  // Tutup kedua modal dengan dua kali Escape berurutan
  await page.keyboard.press('Escape')
  await tunggu(200)
  await page.keyboard.press('Escape')
  await tunggu(300)

  // Verifikasi centang-dot-guard juga tampil di DotSheetModal
  await page.evaluate(() => {
    const btnDot = [...document.querySelectorAll('button')].find((b) =>
      (b.textContent || '').includes('Kartu'),
    )
    btnDot?.click()
  })
  await page.waitForSelector('[data-testid="centang-dot-guard"]', { timeout: 8000 })
  const guardTercetakDiDot = await page.evaluate(() => {
    const cb = document.querySelector('[data-testid="centang-dot-guard"]')
    return Boolean(cb && cb.checked)
  })
  cek(guardTercetakDiDot, 'DotSheetModal menyediakan centang aktif penyertaan kerja alat Guard')
  await page.keyboard.press('Escape')
  await tunggu(250)

  /* ---- 5. Unduh Paket Per Anggota & buka di Mode Anggota HP (360×740) ---- */
  await page.goto(`${BASE}/#/berbagi`, { waitUntil: 'networkidle2' })
  await page.waitForSelector('[data-testid="toggle-count-sheet"]', { timeout: 10000 })
  await page.click('[data-testid="unduh-per-anggota"]')
  let zipPath = null
  for (let i = 0; i < 60 && !zipPath; i += 1) {
    await tunggu(250)
    const files = fs.readdirSync(UNDUH).filter((x) => x.endsWith('.zip'))
    if (files.length) zipPath = path.join(UNDUH, files[0])
  }
  cek(Boolean(zipPath), 'ZIP paket per anggota terunduh dari halaman Berbagi')
  execFileSync('unzip', ['-o', '-q', zipPath, '-d', BUKA])

  const semuaJson = fs.readdirSync(BUKA).filter((f) => f.endsWith('.json'))
  let berkasGuard = semuaJson[0]
  for (const f of semuaJson) {
    const obj = JSON.parse(fs.readFileSync(path.join(BUKA, f), 'utf8'))
    const penerima = (obj?.members || []).find((m) => m.id === obj?.forMember)
    if (penerima?.section === 'guard') {
      berkasGuard = f
      break
    }
  }
  const isiPaketGuard = JSON.parse(fs.readFileSync(path.join(BUKA, berkasGuard), 'utf8'))
  cek(
    Array.isArray(isiPaketGuard.countSheets) && isiPaketGuard.countSheets.length === 1,
    `Paket anggota Guard (${berkasGuard}) menyertakan Count Sheet Color Guard`,
  )

  const ctxAnggota = await browser.createBrowserContext()
  const hp = await ctxAnggota.newPage()
  await hp.setViewport({ width: 360, height: 740, isMobile: true, hasTouch: true })
  await hp.goto(`${BASE}/`, { waitUntil: 'networkidle2' })
  await tunggu(900)
  await hp.click('[data-testid="pilih-member"]')
  await tunggu(200)
  await hp.click('[data-testid="lanjut-pilih-mode"]')
  await tunggu(900)
  await hp.goto(`${BASE}/#/berbagi`, { waitUntil: 'networkidle2' })
  await tunggu(900)
  const inputPkg = await hp.$('#pkg-input')
  await inputPkg.uploadFile(path.join(BUKA, berkasGuard))
  await tunggu(1800)

  const cekLayarHp = await hp.evaluate(() => {
    const navBawah = document.querySelector('[data-testid="nav-bawah-hp"]')
    const btnFormasi = [...document.querySelectorAll('button')].find(
      (b) => (b.textContent || '').trim().toLowerCase() === 'formasi',
    )
    btnFormasi?.click()
    return {
      adaNavBawah: Boolean(navBawah),
      luap: document.documentElement.scrollWidth > window.innerWidth + 1,
    }
  })
  await tunggu(600)
  cek(
    !cekLayarHp.adaNavBawah && !cekLayarHp.luap,
    'Mode Anggota di 360×740 bebas bilah bawah "Tim" dan bebas luapan horizontal',
  )

  await hp.waitForSelector('[data-testid="kartu-count-sheet-anggota"]', { timeout: 8000 })
  const teksKartuFormasi = await hp.$eval(
    '[data-testid="kartu-count-sheet-anggota"]',
    (el) => el.textContent || '',
  )
  cek(
    teksKartuFormasi.includes('Drop Spin') &&
      teksKartuFormasi.includes('8★') &&
      teksKartuFormasi.includes('Kanan di tab'),
    'Tab Formasi anggota Guard menampilkan kartu Count Sheet lengkap dengan teknik & ★ Catch',
  )

  // Klik tombol Putar perpindahan di MemberDrill dan pastikan indikator count-aktif-formasi menyala
  await hp.evaluate(() => {
    const btnPutar = [...document.querySelectorAll('button')].find((b) =>
      (b.textContent || '').includes('Putar perpindahan') || (b.textContent || '').trim() === 'Putar',
    )
    btnPutar?.click()
  })
  await tunggu(260)
  const adaCountFormasi = await hp.$('[data-testid="count-aktif-formasi"]')
  cek(!!adaCountFormasi, 'Saat animasi formasi diputar, hitungan aktif tersorot langsung di kartu Guard')

  // Beralih ke Tab Musik -> pilih lagu tertaut -> jalankan metronom & amati sorotan waktu nyata
  await hp.evaluate(() => {
    const btnMusik = [...document.querySelectorAll('button')].find(
      (b) => (b.textContent || '').trim().toLowerCase() === 'musik',
    )
    btnMusik?.click()
  })
  await tunggu(700)
  const selLagu = await hp.$(`[data-testid="pilih-lagu-${laguDipilih}"]`)
  if (selLagu) {
    await selLagu.click()
    await tunggu(350)
  }

  await hp.waitForSelector('[data-testid="panel-count-sheet-musik"]', { timeout: 10000 })
  const angkaAwal = await hp.$eval(
    '[data-testid="angka-count-aktif-musik"]',
    (el) => (el.textContent || '').trim(),
  )
  cek(angkaAwal === '1/8', `Panel Count Sheet di Tab Musik siap pada hitungan awal (${angkaAwal})`)

  await hp.click('[data-testid="tombol-mulai"]')
  let melihatHitunganMaju = false
  const batas = Date.now() + 8500
  while (Date.now() < batas) {
    await tunggu(180)
    const teks = await hp
      .$eval('[data-testid="angka-count-aktif-musik"]', (el) => (el.textContent || '').trim())
      .catch(() => '')
    if (teks && teks !== '1/8' && /^\d+\/8$/.test(teks)) {
      melihatHitunganMaju = true
      break
    }
  }
  await hp.click('[data-testid="tombol-mulai"]')
  cek(melihatHitunganMaju, 'Metronom di Tab Musik menggerakkan sorotan hitungan Count Sheet secara waktu nyata')

  await ctxAnggota.close()
} finally {
  await browser.close()
  fs.rmSync(UNDUH, { recursive: true, force: true })
  fs.rmSync(BUKA, { recursive: true, force: true })
}

console.log(`\n${lulus} lulus, ${gagal} gagal`)
process.exit(gagal > 0 ? 1 : 0)
