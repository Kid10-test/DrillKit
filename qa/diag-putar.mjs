/**
 * Diagnosa: tombol **Putar perpindahan** di tab Formasi milik anggota.
 *
 * Dokumentasi kodenya menyebut fitur ini "supaya anggota bisa berlatih
 * mandiri tanpa harus menunggu pelatih" — jadi kalau ia tidak jalan,
 * anggota kehilangan satu-satunya cara melihat gerakannya sendiri tanpa
 * pelatih di sampingnya.
 *
 * Yang diperiksa:
 *   1. Apakah tombolnya ada dan bisa ditekan.
 *   2. Apakah titik benar-benar BERGERAK selama animasi (transform).
 *   3. Apakah set aktif MAJU setelah animasi selesai.
 *   4. Apakah keadaan bersih setelah selesai (transform dihapus).
 *
 * Tidak ada asersi. Semua dicetak.
 */
import puppeteer from 'puppeteer'
import { lewatSambutan } from './sambutan.mjs'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const BASE = process.env.BASE || 'http://localhost:4173'
const UNDUH = path.join(os.tmpdir(), `unduh-putar-${Date.now()}`)
const BUKA = path.join(os.tmpdir(), `buka-putar-${Date.now()}`)
fs.mkdirSync(UNDUH, { recursive: true })
fs.mkdirSync(BUKA, { recursive: true })

const browser = await puppeteer.launch({
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  defaultViewport: { width: 390, height: 844 }, // HP
})
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

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

const ctx = await browser.createBrowserContext()
const h = await ctx.newPage()
await h.setViewport({ width: 390, height: 844 })
h.on('dialog', async (d) => { await d.accept() })
h.on('pageerror', (e) => console.log('GALAT HALAMAN:', String(e).slice(0, 120)))
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

const namaSet = () => h.evaluate(() => {
  const el = [...document.querySelectorAll('p')].find((p) => /^Set \d+ —/.test(p.textContent.trim()))
  return el ? el.textContent.trim() : null
})
const keadaan = () => h.evaluate(() => {
  const svg = [...document.querySelectorAll('svg')]
    .sort((a, b) => b.querySelectorAll('circle').length - a.querySelectorAll('circle').length)[0]
  const gs = [...svg.querySelectorAll('g')]
  const bergerak = gs.filter((g) => g.getAttribute('transform')).length
  const contoh = gs.find((g) => g.getAttribute('transform'))?.getAttribute('transform')
  return { jumlahG: gs.length, bergerak, contoh }
})
const tombolPutar = () => h.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((y) => /Putar perpindahan|Jeda/.test(y.textContent))
  if (!b) return null
  const r = b.getBoundingClientRect()
  return { teks: b.textContent.trim(), lebar: Math.round(r.width), tinggi: Math.round(r.height) }
})

console.log('set awal     :', await namaSet())
console.log('tombol       :', JSON.stringify(await tombolPutar()))
console.log('sebelum      :', JSON.stringify(await keadaan()))

await h.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((y) => /Putar perpindahan/.test(y.textContent))
  b.click()
})
for (const ms of [300, 700, 1200]) {
  await wait(ms === 300 ? 300 : 400)
  console.log(`setelah ${ms}ms :`, JSON.stringify(await keadaan()))
}

// Animasi 16 count pada 120 BPM = 8 detik. Tunggu sampai SELESAI, bukan
// menebak-nebak waktunya — percobaan pertama membaca keadaan pada detik
// ketujuh dan menyimpulkan animasinya mandek, padahal belum selesai.
let detik = 0
let setAkhir = await namaSet()
while (detik < 25 && setAkhir === 'Set 1 — Blok') {
  await wait(1000)
  detik += 1
  setAkhir = await namaSet()
}
console.log(`selesai setelah ~${detik} detik`)
console.log('sesudah      :', JSON.stringify(await keadaan()))
console.log('set akhir    :', setAkhir)
console.log('tombol akhir :', JSON.stringify(await tombolPutar()))

await browser.close()
