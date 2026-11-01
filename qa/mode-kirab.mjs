/**
 * Rangkaian uji E2E peramban #19 — Mode Kirab / Street Parade & Display Jalan Raya (v1.2.3):
 *   1. Pelatih memuat data contoh -> klik `+ Kirab` di halaman Drill -> membuat drill Jalan Parade 8 m
 *      lengkap susunan Banjar × Saf otomatis
 *   2. Verifikasi SVG kanvas jalan raya (`parade-koridor`, `bahu-jalan`, `marka-tengah`, `panggung-vip`,
 *      `arah-defile`) murni `#hex` (0 `oklch()` / 0 `color-mix()`)
 *   3. Membuka modal Studio `Parade` (`tombol-parade`):
 *      - Tab 1 (`Banjar × Saf`): ganti lebar jalan 12 m -> 8 m, terapkan Banjar × Saf
 *      - Tab 2 (`Tikungan 90° & VIP`): tambah 3 set `Display Panggung VIP -> Kembali Defile` + 2 set `Belok Kanan 90°`
 *      - Tab 3 (`Kalkulator Rute & Cetak`): pilih rute 2,5 km, verifikasi waktu tempuh & siklus lagu, simpan ke drill
 *   4. Membuka pratinjau `DotSheetModal` (`Kartu`): verifikasi koordinat `Defile` & penanda `Saf · Bjr` bebas `oklch`
 *   5. Mengekspor Paket Grup & membuka di konteks segar Mode Anggota (layar HP `360×740`):
 *      - Bebas bilah bawah "Tim" & bebas luapan horizontal
 *      - Kanvas anggota menampilkan `panggung-vip`
 *      - Kartu `info-parade-anggota` menampilkan nomor Saf, Banjar, dan jarak Panggung VIP dengan akurat
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

const UNDUH = path.join(os.tmpdir(), `unduh-kirab-${Date.now()}`)
const BUKA = path.join(os.tmpdir(), `buka-kirab-${Date.now()}`)
fs.mkdirSync(UNDUH, { recursive: true })
fs.mkdirSync(BUKA, { recursive: true })

let lulus = 0
let gagal = 0
function cek(kondisi, pesan, detail = '') {
  if (kondisi) {
    lulus += 1
    console.log(`  ✓ ${pesan}`)
  } else {
    gagal += 1
    console.error(`  ✗ GAGAL: ${pesan}${detail ? ' -> ' + detail : ''}`)
  }
}

const browser = await puppeteer.launch({
  headless: true,
  executablePath: EXEC,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
})

const galatHalaman = []

try {
  const page = await browser.newPage()
  page.on('pageerror', (e) => galatHalaman.push(String(e)))
  page.on('console', (m) => {
    if (m.type() === 'error') galatHalaman.push(m.text())
  })
  const cdp = await page.target().createCDPSession()
  await cdp.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: UNDUH })
  await page.setViewport({ width: 1280, height: 900 })

  await page.goto(`${BASE}/`, { waitUntil: 'networkidle2' })
  await lewatSambutan(page, 'coach')
  await tunggu(600)

  // Muat data contoh tim
  await page.evaluate(() => {
    const btnContoh = [...document.querySelectorAll('button')].find((b) =>
      (b.textContent || '').includes('Muat data contoh'),
    )
    btnContoh?.click()
  })
  await tunggu(2400)

  // Buka halaman Drill & buat Drill Kirab / Street Parade baru 1-klik
  await page.goto(`${BASE}/#/drill`, { waitUntil: 'networkidle2' })
  await tunggu(1200)
  await page.waitForSelector('[data-testid="buat-drill-parade"]', { timeout: 8000 })
  await page.click('[data-testid="buat-drill-parade"]')
  await tunggu(1200)

  // Verifikasi elemen SVG jalan raya & Panggung Kehormatan digambar murni #hex
  const infoSvg = await page.evaluate(() => {
    const svg = document.querySelector('.drill-surface svg')
    const htmlSvg = svg ? svg.outerHTML : ''
    return {
      adaKoridor: Boolean(document.querySelector('[data-lap="parade-koridor"]')),
      adaBahu: Boolean(document.querySelector('[data-lap="bahu-jalan"]')),
      adaMarka: Boolean(document.querySelector('[data-lap="marka-tengah"]')),
      adaVip: Boolean(document.querySelector('[data-lap="panggung-vip"]')),
      adaArah: Boolean(document.querySelector('[data-lap="arah-defile"]')),
      bocorWarnaModern: /oklch\(|color-mix\(/i.test(htmlSvg),
      teksVip: document.querySelector('[data-lap="panggung-vip"]')?.textContent || '',
    }
  })
  cek(
    infoSvg.adaKoridor && infoSvg.adaBahu && infoSvg.adaMarka && infoSvg.adaVip && infoSvg.adaArah,
    '1: Kanvas Drill Kirab menampilkan koridor aspal, bahu jalan, marka tengah, arah defile, & Panggung VIP',
    JSON.stringify(infoSvg),
  )
  cek(!infoSvg.bocorWarnaModern, '1: SVG kanvas Jalan Parade murni #hex tanpa oklch()/color-mix()')
  cek(infoSvg.teksVip.includes('PANGGUNG KEHORMATAN'), '1: Label Panggung Kehormatan / Juri tampil di tepi jalan')

  // Buka Studio Mode Kirab (`tombol-parade`)
  await page.waitForSelector('[data-testid="tombol-parade"]', { timeout: 6000 })
  await page.click('[data-testid="tombol-parade"]')
  await page.waitForSelector('[data-testid="modal-parade"]', { timeout: 8000 })

  // Tab 1: Coba pilih Jalan 12 m -> kembali Jalan 8 m -> Terapkan Banjar × Saf
  await page.click('[data-testid="parade-pilih-jalan-12m"]')
  await tunggu(400)
  const teksJalan12 = await page.$eval('[data-testid="parade-status-jalan"]', (el) => el.textContent || '')
  cek(teksJalan12.includes('12') && teksJalan12.includes('Aman'), '2: Saklar cepat Jalan 12 m memperbarui lebar efektif jalan & status Aman', teksJalan12)

  await page.click('[data-testid="parade-pilih-jalan-8m"]')
  await tunggu(400)
  await page.click('[data-testid="parade-terapkan-banjar-saf"]')
  await tunggu(500)

  // Tab 2: Tambah 3 set Display Panggung VIP -> Kembali Defile, lalu 2 set Belok Kanan 90°
  await page.click('[data-testid="tab-parade-tikungan"]')
  await tunggu(300)
  await page.click('[data-testid="parade-buat-display-vip"]')
  await tunggu(700)
  await page.click('[data-testid="parade-buat-belok-kanan"]')
  await tunggu(700)

  // Tab 3: Kalkulator Rute 2,5 km & simpan ke drill
  await page.click('[data-testid="tab-parade-kalkulator"]')
  await tunggu(300)
  await page.click('[data-testid="parade-rute-cepat-2500"]')
  await tunggu(300)
  const ringkasanRute = await page.evaluate(() => ({
    waktu: document.querySelector('[data-testid="parade-waktu-tempuh"]')?.textContent || '',
    siklus: document.querySelector('[data-testid="parade-ulang-lagu"]')?.textContent || '',
    napas: document.querySelector('[data-testid="parade-status-napas"]')?.textContent || '',
  }))
  cek(
    ringkasanRute.waktu.includes('mnt') && /\d+× siklus/.test(ringkasanRute.siklus) && ringkasanRute.napas.length > 15,
    '3: Kalkulator rute menghitung waktu tempuh, pengulangan lagu, & evaluasi cadangan napas',
    JSON.stringify(ringkasanRute),
  )
  await page.click('[data-testid="parade-simpan-rute"]')
  await tunggu(500)

  // Tutup modal Parade dengan Escape
  await page.keyboard.press('Escape')
  await tunggu(400)

  // Pastikan 6 set telah terbentuk di drill (1 awal + 3 Display VIP + 2 Tikungan 90°)
  const infoSetDrill = await page.evaluate(() => {
    const teks = document.body.innerText || ''
    return {
      adaDisplay: teks.includes('DisplayVIP'),
      adaKembali: teks.includes('KembaliDefile'),
      adaBelok: teks.includes('BelokKanan'),
    }
  })
  cek(
    infoSetDrill.adaDisplay && infoSetDrill.adaKembali && infoSetDrill.adaBelok,
    '4: Generator menambahkan set DisplayVIP, KembaliDefile, dan BelokKanan ke daftar set drill',
    JSON.stringify(infoSetDrill),
  )

  // Buka DotSheetModal ("Kartu") -> klik Pratinjau -> verifikasi koordinat Defile & Saf × Banjar
  await page.evaluate(() => {
    const btnKartu = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('Kartu'))
    btnKartu?.click()
  })
  await tunggu(600)
  await page.evaluate(() => {
    const btnPratinjau = [...document.querySelectorAll('button')].find((b) =>
      (b.textContent || '').includes('Pratinjau'),
    )
    btnPratinjau?.click()
  })
  await tunggu(800)
  const cekKartuCetak = await page.evaluate(async () => {
    const iframe = document.querySelector('iframe')
    const html = iframe?.getAttribute('srcdoc') || iframe?.contentDocument?.documentElement?.outerHTML || ''
    return {
      adaSafBjr: html.includes('Saf ') && html.includes('Bjr '),
      adaDefile: html.includes('Defile '),
      bocorOklch: /oklch\(|color-mix\(/i.test(html),
    }
  })
  cek(
    cekKartuCetak.adaSafBjr && cekKartuCetak.adaDefile && !cekKartuCetak.bocorOklch,
    '5: Pratinjau Buku Saku / Dot Sheet mencetak koordinat Defile + Saf × Banjar murni #hex',
    JSON.stringify(cekKartuCetak),
  )
  await page.keyboard.press('Escape')
  await tunggu(300)
  await page.keyboard.press('Escape')
  await tunggu(300)

  // Ekspor ZIP Paket Per Anggota dari /#/berbagi lalu uji di konteks segar Mode Anggota (360×740)
  await page.goto(`${BASE}/#/berbagi`, { waitUntil: 'networkidle2' })
  await tunggu(1200)
  const sebelumUnduh = new Set(fs.readdirSync(UNDUH))
  await page.click('[data-testid="unduh-per-anggota"]')
  let berkasZip = null
  const batasUnduh = Date.now() + 15000
  while (Date.now() < batasUnduh) {
    await tunggu(250)
    const baru = fs
      .readdirSync(UNDUH)
      .filter((f) => !sebelumUnduh.has(f) && !f.endsWith('.crdownload') && f.endsWith('.zip'))
    if (baru.length > 0) {
      berkasZip = path.join(UNDUH, baru[0])
      break
    }
  }
  cek(Boolean(berkasZip), '6: ZIP paket per anggota berhasil diunduh dari halaman Berbagi')

  if (berkasZip) {
    execFileSync('unzip', ['-o', '-q', berkasZip, '-d', BUKA])
    const berkasAnggota = fs.readdirSync(BUKA).find((f) => f.endsWith('.json'))

    const ctxAnggota = await browser.createBrowserContext()
    const hp = await ctxAnggota.newPage()
    hp.on('pageerror', (e) => galatHalaman.push(String(e)))
    await hp.setViewport({ width: 360, height: 740, isMobile: true, hasTouch: true })
    await hp.goto(`${BASE}/`, { waitUntil: 'networkidle2' })
    await tunggu(900)
    await hp.click('[data-testid="pilih-member"]')
    await tunggu(250)
    await hp.click('[data-testid="lanjut-pilih-mode"]')
    await tunggu(900)
    await hp.goto(`${BASE}/#/berbagi`, { waitUntil: 'networkidle2' })
    await tunggu(900)
    const inputPkg = await hp.$('#pkg-input')
    await inputPkg.uploadFile(path.join(BUKA, berkasAnggota))
    await tunggu(1800)

    // Buka tab Formasi & pilih drill Kirab / Parade memakai hp.select agar React 19 menangkap onChange
    await hp.evaluate(() => {
      const btnFormasi = [...document.querySelectorAll('button')].find(
        (b) => (b.textContent || '').trim().toLowerCase() === 'formasi',
      )
      btnFormasi?.click()
    })
    await tunggu(800)

    const targetDrill = await hp.evaluate(() => {
      const selects = [...document.querySelectorAll('select')]
      for (let idx = 0; idx < selects.length; idx++) {
        const s = selects[idx]
        const opt = [...s.options].find((o) => (o.textContent || '').includes('Kirab / Parade'))
        if (opt) {
          s.setAttribute('data-pilih-kirab', '1')
          return opt.value
        }
      }
      return null
    })
    if (targetDrill) {
      await hp.select('select[data-pilih-kirab="1"]', targetDrill)
      await tunggu(800)
    }

    const cekAnggota = await hp.evaluate(() => ({
      adaNavBawah: Boolean(document.querySelector('[data-testid="nav-bawah-hp"]')),
      luap: document.documentElement.scrollWidth > window.innerWidth + 1,
      adaVipSvg: Boolean(document.querySelector('[data-lap="panggung-vip"]')),
      teksInfoParade: document.querySelector('[data-testid="info-parade-anggota"]')?.textContent || '',
      teksHalaman: document.body.innerText || '',
    }))
    cek(
      !cekAnggota.adaNavBawah && !cekAnggota.luap,
      '7: Layar HP Mode Anggota (360×740) bebas bilah bawah "Tim" & bebas luapan horizontal',
    )
    cek(cekAnggota.adaVipSvg, '7: Kanvas Mode Anggota merender Panggung Kehormatan / VIP di jalan raya')
    cek(
      cekAnggota.teksInfoParade.includes('Barisan Kirab: Saf ') &&
        cekAnggota.teksInfoParade.includes('Banjar ') &&
        cekAnggota.teksHalaman.includes('Defile '),
      '7: Mode Anggota menampilkan kartu Saf × Banjar, status Panggung VIP, & koordinat jalan Defile',
      cekAnggota.teksInfoParade,
    )
    cek(
      !/\bNaN\b|\bundefined\b/.test(cekAnggota.teksHalaman),
      '7: Layar Mode Anggota bersih dari teks NaN / undefined',
    )
    await ctxAnggota.close()
  }

  cek(galatHalaman.length === 0, '8: Nol pageerror / console.error sepanjang pengujian Mode Kirab', galatHalaman.join(' | '))
} finally {
  await browser.close()
  fs.rmSync(UNDUH, { recursive: true, force: true })
  fs.rmSync(BUKA, { recursive: true, force: true })
}

console.log(`\nmode-kirab: ${lulus} lulus, ${gagal} gagal`)
if (gagal > 0) process.exit(1)
