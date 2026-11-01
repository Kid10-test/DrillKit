/**
 * Rangkaian uji E2E peramban #18 — Manajemen Inventaris Alat, Seragam (Uniform Fitting),
 * & Manifes Logistik Hari Lomba 3-Tahap (`v1.2.2`):
 *  1. Pelatih membuka `/anggota` -> tab `Inventaris Alat`: tambah aset `BRS-01` + nomor seri +
 *     riwayat servis + peminjaman ke anggota aktif; verifikasi pratinjau cetak A4 Berita Acara
 *     (`0` `oklch()`/`color-mix()`).
 *  2. Tab `Seragam & Fitting`: isi ukuran fitting + nomor seri seragam `SRG-077`, uji pil 1-ketuk
 *     (`Dipinjam` / `Dicuci ✓`), & pratinjau cetak A4 distribusi seragam (`0` `oklch()`/`color-mix()`).
 *  3. Halaman `/lomba?tab=logistik`: buat manifes 1-klik dari inventaris, centang 3-tahap
 *     (`1. Muat`, `2. Lokasi`, `3. Gudang`), buktikan peringatan merah real-time muncul saat sebagian
 *     barang belum kembali ke gudang (serta pengingat di Dashboard), lalu hilang saat lengkap,
 *     plus pratinjau cetak A4 manifes (`0` `oklch()`/`color-mix()`).
 *  4. Halaman `/berbagi`: unduh Berkas Grup & ZIP Paket Per Anggota; verifikasi pagar privasi
 *     keras pada bita JSON dan tampilan `kartu-perlengkapan-anggota` di konteks Mode Anggota HP
 *     `360×740` (bebas luapan horizontal, `0` `pageerror`, `0` `console.error`).
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

const UNDUH = path.join(os.tmpdir(), `unduh-inv-${Date.now()}`)
const BUKA = path.join(os.tmpdir(), `buka-inv-${Date.now()}`)
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

const galatHalaman = []
const browser = await puppeteer.launch({
  headless: true,
  executablePath: EXEC,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
})

try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 860 })
  page.on('pageerror', (e) => galatHalaman.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error') galatHalaman.push(`console.error: ${m.text()}`)
  })

  const cdp = await page.createCDPSession()
  await cdp.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: UNDUH })

  // Muat data contoh tim agar ada anggota aktif lintas seksi
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle2' })
  await lewatSambutan(page, 'coach')
  await tunggu(700)
  await page.evaluate(async () => {
    const tombolContoh = [...document.querySelectorAll('button')].find((b) =>
      (b.textContent || '').includes('Muat data contoh'),
    )
    if (tombolContoh) tombolContoh.click()
  })
  await tunggu(2200)

  /* ---- 1. Buku Induk Inventaris Alat & Berita Acara A4 ---- */
  await page.goto(`${BASE}/#/anggota`, { waitUntil: 'networkidle2' })
  await page.waitForSelector('[data-testid="tab-inventaris-alat"]', { timeout: 10000 })
  await page.click('[data-testid="tab-inventaris-alat"]')
  await page.waitForSelector('[data-testid="panel-buku-inventaris"]', { timeout: 10000 })

  await page.click('[data-testid="tambah-aset-inventaris"]')
  await page.waitForSelector('[data-testid="modal-aset-inventaris"]', { timeout: 8000 })

  const kodeOtomatis = await page.$eval('[data-testid="input-kode-aset"]', (el) => el.value)
  cek(kodeOtomatis === 'BRS-01', `Kode aset otomatis terisi '${kodeOtomatis}'`)

  await page.type('[data-testid="input-seri-aset"]', 'YTR-99881')
  await page.type('[data-testid="input-nama-aset"]', 'Trumpet Bb Utama 1')
  await page.type('[data-testid="input-merek-aset"]', 'Yamaha Xeno YTR-8335')
  await page.type('[data-testid="input-kelengkapan-aset"]', 'Hardcase + Mouthpiece Bach 3C')

  // Pilih peminjam anggota pertama yang aktif
  const peminjamDipilih = await page.evaluate(() => {
    const sel = document.querySelector('[data-testid="pilih-peminjam-aset"]')
    const opsi = [...(sel?.options || [])].find((o) => o.value)
    return opsi ? { id: opsi.value, label: opsi.textContent || '' } : null
  })
  cek(Boolean(peminjamDipilih?.id), 'Daftar anggota aktif tersedia di pemilih peminjam inventaris')
  await page.select('[data-testid="pilih-peminjam-aset"]', peminjamDipilih.id)
  const kodeAnggotaPeminjam = peminjamDipilih.label.split('—')[0].trim()

  // Catat 1 riwayat servis
  await page.type('[data-testid="input-jenis-servis"]', 'Cuci kimia & pelumasan valve')
  await page.type('[data-testid="input-biaya-servis"]', '150000')
  await page.click('[data-testid="tambah-catatan-servis"]')
  await tunggu(200)
  const adaRiwayat = await page.$('[data-testid="daftar-riwayat-servis"]')
  cek(Boolean(adaRiwayat), 'Riwayat perawatan tercatat di dalam modal aset')

  await page.click('[data-testid="simpan-aset-inventaris"]')
  await tunggu(500)

  const totalInv = await page.$eval('[data-testid="inv-total-aset"]', (el) => el.textContent?.trim())
  const dipinjamInv = await page.$eval('[data-testid="inv-dipinjam"]', (el) => el.textContent?.trim())
  cek(
    totalInv === '1' && dipinjamInv === '1',
    'Statistik inventaris memperbarui total aset (1) dan sedang dipinjam (1)',
  )

  // Buka Berita Acara Peminjaman & periksa kemurnian #hex A4
  await page.click('[data-testid="buka-berita-acara"]')
  await page.waitForSelector('[data-testid="iframe-pratinjau-inventaris"]', { timeout: 8000 })
  const srcDocBA = await page.$eval(
    '[data-testid="iframe-pratinjau-inventaris"]',
    (el) => el.getAttribute('srcdoc') || '',
  )
  cek(
    srcDocBA.includes('BERITA ACARA PEMINJAMAN') &&
      srcDocBA.includes('YTR-99881') &&
      srcDocBA.includes('Bach 3C') &&
      !/oklch\s*\(|color-mix\s*\(/i.test(srcDocBA),
    'Pratinjau Berita Acara A4 memuat nomor seri & kelengkapan serta bebas oklch()/color-mix()',
  )
  await page.keyboard.press('Escape')
  await tunggu(300)

  /* ---- 2. Ukuran Fitting & Distribusi Seragam ---- */
  await page.click('[data-testid="tab-seragam-fitting"]')
  await page.waitForSelector('[data-testid="panel-seragam-fitting"]', { timeout: 10000 })
  await page.click(`[data-testid="ukur-seragam-${kodeAnggotaPeminjam}"]`)
  await page.waitForSelector('[data-testid="modal-fitting-seragam"]', { timeout: 8000 })

  await page.type('[data-testid="input-fitting-sepatu"]', '42')
  await page.type('[data-testid="input-fitting-jaket"]', 'L')
  await page.type('[data-testid="input-fitting-bibber"]', 'L')
  await page.type('[data-testid="input-fitting-shako"]', '58 cm')
  await page.type('[data-testid="input-seri-seragam"]', 'SRG-077')
  await page.select('[data-testid="pilih-status-fitting"]', 'dipinjam')
  await page.click('[data-testid="simpan-fitting-seragam"]')
  await tunggu(450)

  const teksBarisSrg = await page.$eval(
    `[data-testid="baris-seragam-${kodeAnggotaPeminjam}"]`,
    (el) => el.textContent || '',
  )
  cek(
    teksBarisSrg.includes('42') && teksBarisSrg.includes('SRG-077'),
    `Baris seragam anggota ${kodeAnggotaPeminjam} menampilkan ukuran sepatu 42 & seri SRG-077`,
  )

  // Uji pil 1-ketuk Dicuci ✓ lalu kembalikan ke Dipinjam
  await page.click(`[data-testid="status-seragam-${kodeAnggotaPeminjam}-dicuci"]`)
  await tunggu(300)
  const jmlDicuci = await page.$eval('[data-testid="srg-dicuci"]', (el) => el.textContent?.trim())
  cek(jmlDicuci === '1', 'Ketuk cepat pil Dicuci ✓ langsung memperbarui ringkasan seragam')
  await page.click(`[data-testid="status-seragam-${kodeAnggotaPeminjam}-dipinjam"]`)
  await tunggu(300)

  await page.click('[data-testid="pratinjau-cetak-seragam"]')
  await page.waitForSelector('[data-testid="iframe-pratinjau-seragam"]', { timeout: 8000 })
  const srcDocSrg = await page.$eval(
    '[data-testid="iframe-pratinjau-seragam"]',
    (el) => el.getAttribute('srcdoc') || '',
  )
  cek(
    srcDocSrg.includes('SRG-077') && !/oklch\s*\(|color-mix\s*\(/i.test(srcDocSrg),
    'Pratinjau cetak A4 distribusi seragam bebas oklch()/color-mix()',
  )
  await page.keyboard.press('Escape')
  await tunggu(300)

  /* ---- 3. Manifes Logistik & Loading Truk 3-Tahap di Halaman Lomba ---- */
  await page.goto(`${BASE}/#/lomba?tab=logistik`, { waitUntil: 'networkidle2' })
  await page.waitForSelector('[data-testid="buat-manifes-inventaris"]', { timeout: 10000 })
  await page.click('[data-testid="buat-manifes-inventaris"]')
  await page.waitForSelector('[data-testid="tabel-ceklis-manifes"]', { timeout: 8000 })

  const isiTabelManifes = await page.$eval(
    '[data-testid="tabel-ceklis-manifes"]',
    (el) => el.textContent || '',
  )
  cek(
    isiTabelManifes.includes('BRS-01') && isiTabelManifes.includes('Podium Konduktor'),
    'Manifes hari lomba otomatis menarik BRS-01 dari inventaris + perlengkapan standar lomba',
  )

  // Centang 1. Muat & 2. Lokasi pada baris 0 dan baris 1, lalu centang 3. Gudang hanya pada baris 0
  await page.click('[data-testid="centang-berangkat-0"]')
  await page.click('[data-testid="centang-berangkat-1"]')
  await page.click('[data-testid="centang-lokasi-0"]')
  await page.click('[data-testid="centang-lokasi-1"]')
  await page.click('[data-testid="centang-gudang-0"]')
  await tunggu(400)

  const adaBannerMerah = await page.$('[data-testid="peringatan-belum-kembali"]')
  const baris1Merah = await page.$eval('[data-testid="baris-manifes-1"]', (el) =>
    el.getAttribute('data-belum-kembali'),
  )
  cek(
    Boolean(adaBannerMerah) && baris1Merah === '1',
    'Barang yang belum tercentang kembali ke gudang langsung menyalakan peringatan merah real-time',
  )

  // Cek juga pengingat di Dashboard pelatih
  await page.goto(`${BASE}/#/`, { waitUntil: 'networkidle2' })
  await tunggu(500)
  const adaPengingatDash = await page.$('[data-testid="pengingat-inventaris-logistik"]')
  cek(Boolean(adaPengingatDash), 'Dashboard menampilkan pengingat barang manifes lomba yang belum kembali')

  // Kembali ke Lomba -> centang 3. Gudang pada baris 1 -> peringatan merah bersih!
  await page.goto(`${BASE}/#/lomba?tab=logistik`, { waitUntil: 'networkidle2' })
  await page.waitForSelector('[data-testid="centang-gudang-1"]', { timeout: 8000 })
  await page.click('[data-testid="centang-gudang-1"]')
  await tunggu(400)
  const bannerSesudahLengkap = await page.$('[data-testid="peringatan-belum-kembali"]')
  cek(!bannerSesudahLengkap, 'Peringatan merah hilang begitu seluruh barang yang dimuat kembali ke gudang')

  await page.click('[data-testid="pratinjau-cetak-manifes"]')
  await page.waitForSelector('[data-testid="iframe-pratinjau-manifes"]', { timeout: 8000 })
  const srcDocManifes = await page.$eval(
    '[data-testid="iframe-pratinjau-manifes"]',
    (el) => el.getAttribute('srcdoc') || '',
  )
  cek(
    srcDocManifes.includes('MANIFES LOGISTIK') && !/oklch\s*\(|color-mix\s*\(/i.test(srcDocManifes),
    'Pratinjau cetak A4 Manifes Logistik bebas oklch()/color-mix()',
  )
  await page.keyboard.press('Escape')
  await tunggu(300)

  /* ---- 4. Pagar Privasi Berkas Grup vs ZIP Per Anggota & Mode Anggota HP ---- */
  await page.goto(`${BASE}/#/berbagi`, { waitUntil: 'networkidle2' })
  await page.waitForSelector('[data-testid="toggle-perlengkapan-pribadi"]', { timeout: 10000 })

  await page.click('[data-testid="unduh-grup"]')
  let grupPath = null
  for (let i = 0; i < 40 && !grupPath; i += 1) {
    await tunggu(200)
    const files = fs.readdirSync(UNDUH).filter((x) => x.endsWith('.json'))
    if (files.length) grupPath = path.join(UNDUH, files[0])
  }
  const mentahGrup = fs.readFileSync(grupPath, 'utf8')
  cek(
    !mentahGrup.includes('YTR-99881') &&
      !mentahGrup.includes('SRG-077') &&
      !mentahGrup.includes('perlengkapanPribadi') &&
      !mentahGrup.includes('ukuranSeragam'),
    'Berkas grup (.json) 100% bebas dari kebocoran nomor seri alat maupun ukuran seragam siapa pun',
  )

  await page.click('[data-testid="unduh-per-anggota"]')
  let zipPath = null
  for (let i = 0; i < 60 && !zipPath; i += 1) {
    await tunggu(250)
    const files = fs.readdirSync(UNDUH).filter((x) => x.endsWith('.zip'))
    if (files.length) zipPath = path.join(UNDUH, files[0])
  }
  cek(Boolean(zipPath), 'ZIP paket per anggota terunduh dari halaman Berbagi')
  execFileSync('unzip', ['-o', '-q', zipPath, '-d', BUKA])

  const semuaJsonAnggota = fs.readdirSync(BUKA).filter((f) => f.endsWith('.json'))
  let berkasPeminjam = null
  let berkasRekanLain = null
  for (const f of semuaJsonAnggota) {
    const obj = JSON.parse(fs.readFileSync(path.join(BUKA, f), 'utf8'))
    if (obj.forMember === peminjamDipilih.id) berkasPeminjam = f
    else if (!berkasRekanLain) berkasRekanLain = f
  }
  const mentahPeminjam = fs.readFileSync(path.join(BUKA, berkasPeminjam), 'utf8')
  const mentahRekanLain = fs.readFileSync(path.join(BUKA, berkasRekanLain), 'utf8')
  cek(
    mentahPeminjam.includes('YTR-99881') &&
      mentahPeminjam.includes('SRG-077') &&
      !mentahPeminjam.includes('150000') &&
      !mentahRekanLain.includes('YTR-99881') &&
      !mentahRekanLain.includes('SRG-077'),
    'Berkas per anggota mengisolasi BRS-01 & SRG-077 hanya untuk peminjam (tanpa biaya servis & tanpa bocor ke rekan lain)',
  )

  // Buka berkas peminjam di konteks peramban Mode Anggota layar HP 360×740
  const ctxAnggota = await browser.createBrowserContext()
  const hp = await ctxAnggota.newPage()
  hp.on('pageerror', (e) => galatHalaman.push(`hp pageerror: ${e.message}`))
  hp.on('console', (m) => {
    if (m.type() === 'error') galatHalaman.push(`hp console.error: ${m.text()}`)
  })
  await hp.setViewport({ width: 360, height: 740, isMobile: true, hasTouch: true })
  await hp.goto(`${BASE}/`, { waitUntil: 'networkidle2' })
  await tunggu(800)
  await hp.click('[data-testid="pilih-member"]')
  await tunggu(200)
  await hp.click('[data-testid="lanjut-pilih-mode"]')
  await tunggu(800)
  await hp.goto(`${BASE}/#/berbagi`, { waitUntil: 'networkidle2' })
  await tunggu(800)
  const inputPkg = await hp.$('#pkg-input')
  await inputPkg.uploadFile(path.join(BUKA, berkasPeminjam))
  await hp.waitForSelector('[data-testid="kartu-perlengkapan-anggota"]', { timeout: 10000 })

  const infoKartuHp = await hp.evaluate(() => {
    const kartu = document.querySelector('[data-testid="kartu-perlengkapan-anggota"]')
    return {
      teks: kartu?.textContent || '',
      luap: document.documentElement.scrollWidth > window.innerWidth + 1,
    }
  })
  cek(
    infoKartuHp.teks.includes('BRS-01') &&
      infoKartuHp.teks.includes('YTR-99881') &&
      infoKartuHp.teks.includes('SRG-077') &&
      !infoKartuHp.luap,
    'Mode Anggota di HP 360×740 menampilkan kartu Alat & Seragam Pinjamanku dengan rapi tanpa luapan horizontal',
  )
  await ctxAnggota.close()

  // Cek juga layar HP pelatih 360×740 pada tab Inventaris & Manifes Lomba bebas luapan horizontal
  await page.setViewport({ width: 360, height: 740, isMobile: true, hasTouch: true })
  await page.goto(`${BASE}/#/anggota?tab=inventaris`, { waitUntil: 'networkidle2' })
  await tunggu(500)
  const luapInvHp = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  )
  await page.goto(`${BASE}/#/lomba?tab=logistik`, { waitUntil: 'networkidle2' })
  await tunggu(500)
  const luapManifesHp = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  )
  cek(
    !luapInvHp && !luapManifesHp,
    'Tab Inventaris Alat & Manifes Truk Lomba di HP 360×740 bebas luapan horizontal',
  )

  cek(
    galatHalaman.length === 0,
    `Seluruh alur bebas pageerror & console.error (${galatHalaman.length} galat)`,
  )
  if (galatHalaman.length > 0) {
    console.error('Detail galat:', galatHalaman)
  }
} finally {
  await browser.close()
  fs.rmSync(UNDUH, { recursive: true, force: true })
  fs.rmSync(BUKA, { recursive: true, force: true })
}

console.log(`\n${lulus} lulus, ${gagal} gagal`)
process.exit(gagal ? 1 : 0)
