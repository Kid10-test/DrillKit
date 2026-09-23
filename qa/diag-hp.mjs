/**
 * Diagnosa: keterbacaan tab Formasi **di layar HP**.
 *
 * Ukurannya diambil dari geometri yang benar-benar digambar peramban
 * (getBoundingClientRect), bukan dari kode. Yang dicari: apa yang tidak
 * terbaca oleh anggota di perangkat yang sesungguhnya ia pegang.
 *
 *   390 px  ~ lebar HP pada umumnya
 *   titik kode (BR01)  fontSize 1.1  pada viewBox 120 unit
 *   titik sendiri      fontSize 1.6  + lingkaran emas r 3.4
 *
 * Tidak ada asersi. Diukur lalu dilaporkan.
 */
import puppeteer from 'puppeteer'
import { lewatSambutan } from './sambutan.mjs'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const BASE = process.env.BASE || 'http://localhost:4173'
const UNDUH = path.join(os.tmpdir(), `unduh-hp-${Date.now()}`)
const BUKA = path.join(os.tmpdir(), `buka-hp-${Date.now()}`)
fs.mkdirSync(UNDUH, { recursive: true })
fs.mkdirSync(BUKA, { recursive: true })

const browser = await puppeteer.launch({
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  defaultViewport: { width: 1300, height: 1000 },
})
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

/* -------------------------------- pelatih --------------------------------- */
const A = await browser.newPage()
A.on('dialog', async (d) => { await d.accept() })
await A.goto(BASE, { waitUntil: 'networkidle2' })
await lewatSambutan(A)
await wait(1200)
await A.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((y) => y.textContent.includes('Muat data contoh'))
  if (b) b.click()
})
await wait(4000)
await A.reload({ waitUntil: 'networkidle2' })
await wait(2500)
const klien = await A.target().createCDPSession()
await klien.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: UNDUH })
await A.goto(`${BASE}/#/berbagi`, { waitUntil: 'networkidle2' })
await wait(2200)
await (await A.$('[data-testid="unduh-per-anggota"]')).click()
let zip = null
for (let i = 0; i < 120 && !zip; i += 1) {
  await wait(250)
  const f = fs.readdirSync(UNDUH).filter((x) => x.endsWith('.zip'))
  if (f.length) zip = path.join(UNDUH, f[0])
}
execFileSync('unzip', ['-o', '-q', zip, '-d', BUKA])
const berkas = fs.readdirSync(BUKA).find((f) => f.includes('Andra'))

for (const lebar of [390, 768, 1300]) {
  const ctx = await browser.createBrowserContext()
  const h = await ctx.newPage()
  await h.setViewport({ width: lebar, height: 900 })
  h.on('dialog', async (d) => { await d.accept() })
  await h.goto(BASE, { waitUntil: 'networkidle2' })
  await wait(2500)
  await h.click('[data-testid="pilih-member"]')
  await wait(300)
  await h.click('[data-testid="lanjut-pilih-mode"]')
  await wait(1500)
  await h.goto(`${BASE}/#/berbagi`, { waitUntil: 'networkidle2' })
  await wait(2200)
  await (await h.$('#pkg-input')).uploadFile(path.join(BUKA, berkas))
  await wait(3000)
  await h.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((y) => y.textContent.trim().toLowerCase() === 'formasi')
    if (b) b.click()
  })
  await wait(1800)

  const ukur = await h.evaluate(() => {
    // Ambil SVG yang benar-benar peta lapangan: yang punya banyak titik.
    // Penyeleksi pada viewBox terdahulu malah mengenai ikon 20x20.
    const svg = [...document.querySelectorAll('svg')]
      .sort((a, b) => b.querySelectorAll('circle').length - a.querySelectorAll('circle').length)[0]
    if (!svg || svg.querySelectorAll('circle').length < 5) return null
    const kotak = svg.getBoundingClientRect()
    const teks = [...svg.querySelectorAll('text')]
    const lingkar = [...svg.querySelectorAll('circle')]
    const px = (el) => {
      const r = el.getBoundingClientRect()
      return { t: Math.round(r.height * 10) / 10, w: Math.round(r.width * 10) / 10 }
    }
    const ukuranTeks = teks.map(px).map((x) => x.t)
    const lingkaran = lingkar.map((c) => {
      const r = c.getBoundingClientRect()
      return Math.round(r.width * 10) / 10
    })
    // Berapa banyak teks yang saling bertumpukan (jarak < separuh tingginya)?
    const kotakTeks = teks.map((t) => t.getBoundingClientRect())
    let tumpuk = 0
    for (let i = 0; i < kotakTeks.length; i += 1) {
      for (let j = i + 1; j < kotakTeks.length; j += 1) {
        const a = kotakTeks[i]
        const b = kotakTeks[j]
        const dx = Math.abs(a.left - b.left)
        const dy = Math.abs(a.top - b.top)
        if (dx < Math.max(a.width, b.width) && dy < Math.max(a.height, b.height)) tumpuk += 1
      }
    }
    return {
      lebarSvg: Math.round(kotak.width),
      tinggiSvg: Math.round(kotak.height),
      jumlahTeks: teks.length,
      tinggiTeksMin: Math.min(...ukuranTeks),
      tinggiTeksMaks: Math.max(...ukuranTeks),
      diameterLingkarMin: Math.min(...lingkaran),
      diameterLingkarMaks: Math.max(...lingkaran),
      pasanganTeksBertumpuk: tumpuk,
      lebarHalaman: document.documentElement.scrollWidth,
      lebarJendela: window.innerWidth,
    }
  })
  console.log(`\n===== lebar ${lebar} px =====`)
  console.log(JSON.stringify(ukur, null, 1))
  await ctx.close()
}

await browser.close()
