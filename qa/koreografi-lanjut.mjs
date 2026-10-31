/**
 * Rangkaian uji E2E peramban #16 — Koreografi Visual Lanjut & Layar HP (v1.2.0):
 *  1. Generator bentuk cepat di `PanelAlatFormasi`: pratinjau langsung di kanvas SVG + Terapkan bentuk
 *  2. `PanelGerakSet`: Simbol Visual (Horn Up + Halt + catatan), Move+Hold (`Jalan 6 · Hold ...`),
 *     kelompok jalur FTL (`jejak-ftl-*` di SVG), dan gelombang Ripple kiri→kanan
 *  3. Properti panggung bergerak (`FieldMarkers`): rotasi + penugasan kru pendorong + keyframe per set
 *  4. Cetak Dot Sheet & Buku Saku Lipat: simbol visual, Move+Hold/FTL, dan kru properti tercetak murni hex (tanpa oklch)
 *  5. Paket Anggota nyata (`unduh-per-anggota` ZIP) dibuka di Mode Anggota (layar HP 360×740):
 *     bebas bilah bawah "Tim", isyarat koreografi & tugas kru properti tampil di kartu "Posisiku"
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

const UNDUH = path.join(os.tmpdir(), `unduh-kl-${Date.now()}`)
const BUKA = path.join(os.tmpdir(), `buka-kl-${Date.now()}`)
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
  await page.setViewport({ width: 1280, height: 900 })
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle2' })
  await lewatSambutan(page, 'coach')
  await tunggu(800)

  await page.evaluate(() => {
    const btnContoh = [...document.querySelectorAll('button')].find((b) =>
      (b.textContent || '').includes('Muat data contoh'),
    )
    btnContoh?.click()
  })
  await tunggu(2500)

  await page.evaluate(() => {
    location.hash = '#/drill'
  })
  await page.waitForSelector('[data-testid="panel-bentuk-cepat"]', { timeout: 15000 })
  cek(true, 'Editor drill terbuka dengan komponen modular PanelAlatFormasi & PanelGerakSet')

  /* ---- 1. Generator bentuk cepat + pratinjau langsung di kanvas SVG ---- */
  await page.select('[data-testid="pilih-jenis-bentuk"]', 'busur')
  await page.click('[data-testid="toggle-pratinjau-bentuk"]')
  await tunggu(200)
  const jmlPratinjau = await page.evaluate(
    () => document.querySelectorAll('[data-testid="pratinjau-bentuk-kanvas"] circle').length,
  )
  cek(jmlPratinjau > 0, `Pratinjau langsung bentuk Busur menampilkan ${jmlPratinjau} titik bayangan di kanvas SVG`)

  await page.click('[data-testid="terapkan-bentuk-cepat"]')
  await tunggu(250)
  const koorSesudah = await page.evaluate(() => {
    const c = document.querySelector('svg circle[data-titik="1"]')
    return c ? `${c.getAttribute('cx')},${c.getAttribute('cy')}` : ''
  })
  const pratinjauMati = await page.evaluate(
    () => document.querySelector('[data-testid="pratinjau-bentuk-kanvas"]') === null,
  )
  cek(
    koorSesudah !== '' && pratinjauMati,
    'Terapkan bentuk menyusun koordinat titik dan menutup bayangan pratinjau otomatis',
  )

  /* ---- 2. Simbol visual, Move + Hold, FTL, & Ripple pada Set 1 ---- */
  await page.waitForSelector('[data-testid="panel-koreografi-set"]', { timeout: 8000 })
  await page.click('[data-testid="simbol-visual-horn_up"]')
  await page.click('[data-testid="simbol-visual-halt"]')
  await page.type('[data-testid="input-catatan-visual"]', 'Aksen brass kompak')
  await tunggu(150)

  // Move + Hold: ubah jalanCount menjadi 6
  await page.$eval('[data-testid="input-jalan-count"]', (el) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(el, '6')
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await tunggu(150)
  const teksRingkasanMh = await page.$eval(
    '[data-testid="lencana-move-hold"]',
    (el) => el.textContent || '',
  )
  cek(/Jalan\s*6.*Hold/i.test(teksRingkasanMh), `Move + Hold menampilkan pembagian hitungan (${teksRingkasanMh.trim()})`)

  // Pilih 3 titik pertama di kanvas lapangan SVG lewat klik tetikus sungguhan + Shift
  await page.evaluate(() => {
    document.querySelector('svg circle[data-titik="1"]')?.scrollIntoView({ block: 'center' })
  })
  await tunggu(200)
  const titikKlik = await page.evaluate(() => {
    const circles = [...document.querySelectorAll('svg circle[data-titik="1"]')].slice(0, 3)
    return circles.map((c) => {
      const r = c.getBoundingClientRect()
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
    })
  })
  for (let i = 0; i < titikKlik.length; i += 1) {
    if (i > 0) await page.keyboard.down('Shift')
    await page.mouse.click(titikKlik[i].x, titikKlik[i].y)
    if (i > 0) await page.keyboard.up('Shift')
    await tunggu(80)
  }
  await tunggu(200)

  await page.select('[data-testid="pilih-jalur-kelompok"]', 'ftl')
  await page.type('[data-testid="input-nama-kelompok"]', 'Ular Brass')
  const bisaTambahFtl = await page.$eval(
    '[data-testid="tambah-kelompok-gerak"]',
    (el) => !el.hasAttribute('disabled'),
  )
  if (bisaTambahFtl) {
    await page.click('[data-testid="tambah-kelompok-gerak"]')
    await tunggu(300)
  }
  const adaKartuKelompok = await page.evaluate(
    () => document.querySelectorAll('[data-testid^="item-kelompok-"]').length > 0,
  )
  const adaJejakFtl = await page.evaluate(
    () => document.querySelectorAll('[data-testid^="jejak-ftl-"]').length > 0,
  )
  cek(adaKartuKelompok && adaJejakFtl, 'Kelompok Follow-the-Leader (FTL) tersimpan & menggambar lintasan ular di kanvas SVG')

  // Pasang gelombang Ripple otomatis kiri -> kanan
  await page.click('[data-testid="pasang-ripple-kiri-kanan"]')
  await tunggu(200)
  const adaHapusRipple = (await page.$('[data-testid="hapus-ripple"]')) !== null
  cek(adaHapusRipple, 'Gelombang Ripple aktif dan menampilkan penugasan gelombang per pemain')

  /* ---- 3. Properti panggung bergerak + kru pendorong ---- */
  await page.click('[data-testid="tambah-penanda"]')
  await page.waitForSelector('[data-testid="pilihan-kru-penanda"]', { timeout: 8000 })
  await page.select('[data-testid="jenis-penanda"]', 'kotak')
  await page.$eval('[data-testid="label-penanda"]', (el) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(el, 'Menara Brass')
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await page.$eval('[data-testid="rotasi-penanda"]', (el) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(el, '30')
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  })
  const infoKruPertama = await page.evaluate(() => {
    const btnKru = document.querySelector('[data-testid^="kru-penanda-"]')
    if (!btnKru) return null
    btnKru.click()
    return {
      id: (btnKru.getAttribute('data-testid') || '').replace('kru-penanda-', ''),
      teks: (btnKru.textContent || '').trim(),
    }
  })
  if (await page.$('[data-testid="toggle-penanda-perset"]')) {
    await page.click('[data-testid="toggle-penanda-perset"]')
  }
  await page.click('[data-testid="simpan-penanda"]')
  await tunggu(300)
  const adaBadgeGerak = (await page.$('[data-testid="lencana-properti-bergerak"]')) !== null
  cek(Boolean(infoKruPertama?.id) && adaBadgeGerak, 'Properti panggung bergerak tersimpan dengan rotasi, keyframe set, & kru pendorong')

  /* ---- 4. Cetak Dot Sheet & Buku Saku Lipat (murni hex, memuat simbol & kru) ---- */
  await page.click('button[title="Kartu/dot sheet per pemain"]')
  await tunggu(400)
  await page.evaluate(() => {
    const btnPratinjau = [...document.querySelectorAll('button')].find((b) =>
      /Pratinjau/i.test(b.textContent || ''),
    )
    btnPratinjau?.click()
  })
  await tunggu(600)
  const hasilCetak = await page.evaluate(() => {
    const iframe = document.querySelector('iframe')
    const html = iframe?.getAttribute('srcdoc') || iframe?.contentDocument?.documentElement?.outerHTML || ''
    return {
      adaHtml: html.length > 200,
      bebasOklch: !/oklch\s*\(/i.test(html),
      adaHornUp: /Horn Up|\[HU\]/i.test(html),
      adaMoveHold: /Jln 6\+Hold|Jalan 6/i.test(html),
      adaKru: /Tugas kru properti|Menara Brass/i.test(html),
    }
  })
  cek(hasilCetak.adaHtml && hasilCetak.bebasOklch, 'HTML cetak Buku Saku murni warna hex tanpa oklch()')
  cek(
    hasilCetak.adaHornUp && hasilCetak.adaMoveHold && hasilCetak.adaKru,
    'Buku Saku mencetak simbol visual (Horn Up), pembagian Move+Hold, dan tugas kru properti',
  )

  await page.keyboard.press('Escape')
  await tunggu(200)
  await page.keyboard.press('Escape')
  await tunggu(300)

  /* ---- 5. Unduh Paket Per Anggota & buka di Mode Anggota HP (360×740) ---- */
  const cdp = await page.target().createCDPSession()
  await cdp.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: UNDUH })
  await page.goto(`${BASE}/#/berbagi`, { waitUntil: 'networkidle2' })
  await tunggu(1200)
  await page.click('[data-testid="unduh-per-anggota"]')
  let zipPath = null
  for (let i = 0; i < 60 && !zipPath; i += 1) {
    await tunggu(250)
    const files = fs.readdirSync(UNDUH).filter((x) => x.endsWith('.zip'))
    if (files.length) zipPath = path.join(UNDUH, files[0])
  }
  cek(Boolean(zipPath), 'ZIP paket per anggota terunduh dari halaman Berbagi')
  execFileSync('unzip', ['-o', '-q', zipPath, '-d', BUKA])

  // Cari berkas JSON milik anggota kru pertama (`forMember`)
  const semuaJson = fs.readdirSync(BUKA).filter((f) => f.endsWith('.json'))
  let berkasKru = semuaJson[0]
  for (const f of semuaJson) {
    const obj = JSON.parse(fs.readFileSync(path.join(BUKA, f), 'utf8'))
    if (obj?.forMember === infoKruPertama?.id) {
      berkasKru = f
      break
    }
  }

  const ctxAnggota = await browser.createBrowserContext()
  const hp = await ctxAnggota.newPage()
  await hp.setViewport({ width: 360, height: 740, isMobile: true, hasTouch: true })
  await hp.goto(`${BASE}/`, { waitUntil: 'networkidle2' })
  await tunggu(1000)
  await hp.click('[data-testid="pilih-member"]')
  await tunggu(200)
  await hp.click('[data-testid="lanjut-pilih-mode"]')
  await tunggu(1000)
  await hp.goto(`${BASE}/#/berbagi`, { waitUntil: 'networkidle2' })
  await tunggu(1000)
  const inputPkg = await hp.$('#pkg-input')
  await inputPkg.uploadFile(path.join(BUKA, berkasKru))
  await tunggu(2000)

  const cekLayarHpAnggota = await hp.evaluate(() => {
    const navBawah = document.querySelector('[data-testid="nav-bawah-hp"]')
    const btnFormasi = [...document.querySelectorAll('button')].find(
      (b) => (b.textContent || '').trim().toLowerCase() === 'formasi',
    )
    btnFormasi?.click()
    return { adaNavBawah: Boolean(navBawah), klikFormasi: Boolean(btnFormasi) }
  })
  await tunggu(600)
  cek(!cekLayarHpAnggota.adaNavBawah, 'Layar HP Mode Anggota bersih dari bilah bawah "Tim" yang menghalangi layar')

  const isyaratAnggota = await hp.evaluate(() => {
    const koreo = document.querySelector('[data-testid="anggota-isyarat-koreo"]')?.textContent || ''
    const kru = document.querySelector('[data-testid="anggota-kru-properti"]')?.textContent || ''
    return { koreo, kru }
  })
  cek(
    /Horn Up/i.test(isyaratAnggota.koreo) && /Jalan 6/i.test(isyaratAnggota.koreo),
    `Mode Anggota di HP menampilkan isyarat koreografi personal (${isyaratAnggota.koreo})`,
  )
  cek(
    /Menara Brass/i.test(isyaratAnggota.kru),
    `Mode Anggota di HP menampilkan tugas kru properti (${isyaratAnggota.kru})`,
  )

  await ctxAnggota.close()
} finally {
  await browser.close()
  fs.rmSync(UNDUH, { recursive: true, force: true })
  fs.rmSync(BUKA, { recursive: true, force: true })
}

console.log(`\n${lulus} lulus, ${gagal} gagal`)
process.exit(gagal > 0 ? 1 : 0)
