/**
 * Diagnosa: perjalanan UTUH seorang anggota pada perangkat bersih.
 *
 * `berbagi-anggota` memeriksa **isi berkas** yang dibagikan (kebocoran
 * privasi). Yang belum pernah diuji: apakah anggota benar-benar bisa
 * MEMBUKA berkas itu dan melihat miliknya sendiri. Ini tonggak yang akan
 * dilewati 18 anggota, jadi direkam apa adanya sebelum dinilai.
 *
 * Alur:
 *   Perangkat A (pelatih)  → muat data contoh → unduh ZIP per anggota
 *   Perangkat B (anggota)  → sambutan → pilih anggota → buka paket
 *
 * Tidak ada asersi. Semua yang tampak dicetak.
 */
import puppeteer from 'puppeteer'
import { lewatSambutan } from './sambutan.mjs'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const BASE = process.env.BASE || 'http://localhost:4173'
const UNDUH = path.join(os.tmpdir(), `unduh-diag-${Date.now()}`)
const BUKA = path.join(os.tmpdir(), `buka-diag-${Date.now()}`)
fs.mkdirSync(UNDUH, { recursive: true })
fs.mkdirSync(BUKA, { recursive: true })

const browser = await puppeteer.launch({
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  defaultViewport: { width: 1300, height: 1000 },
})
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const bersih = (t) => (t ?? '').replace(/\s*\n\s*/g, ' | ').trim()

function pasang(h, wadah) {
  const errors = []
  h.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  h.on('pageerror', (e) => errors.push(String(e)))
  h.on('dialog', async (d) => { await d.accept() })
  wadah.push(...[])
  return errors
}

/* ===================== PERANGKAT A — pelatih mengekspor ==================== */
const galatA = []
const ctxA = await browser.createBrowserContext()
const A = await ctxA.newPage()
pasang(A, galatA)
await A.goto(BASE, { waitUntil: 'networkidle2' })
await lewatSambutan(A)
await wait(1500)
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

const infoTim = await A.evaluate(() => {
  const t = document.body.innerText
  return t.replace(/\s*\n\s*/g, ' | ').slice(0, 400)
})
console.log('=== A. Halaman berbagi pelatih ===')
console.log(bersih(infoTim), '\n')

const tombolZip = await A.$('[data-testid="unduh-per-anggota"]')
console.log('tombol "Unduh per anggota (ZIP)" ada:', tombolZip != null)
if (tombolZip) await tombolZip.click()

let zipPath = null
for (let i = 0; i < 120 && !zipPath; i += 1) {
  await wait(250)
  const f = fs.readdirSync(UNDUH).filter((x) => x.endsWith('.zip'))
  if (f.length) zipPath = path.join(UNDUH, f[0])
}
console.log('ZIP:', zipPath)
if (!zipPath) { await browser.close(); process.exit(1) }

execFileSync('unzip', ['-o', '-q', zipPath, '-d', BUKA])
const daftar = fs.readdirSync(BUKA)
console.log('isi ZIP:', JSON.stringify(daftar.slice(0, 6)), '… total', daftar.length)

const berkasSatu = daftar.find((f) => f.endsWith('.json'))
const isi = JSON.parse(fs.readFileSync(path.join(BUKA, berkasSatu), 'utf8'))
console.log('berkas pertama:', berkasSatu)
console.log('  format      :', isi.format)
console.log('  nama tim    :', isi.team?.teamName)
console.log('  anggota     :', JSON.stringify((isi.members ?? []).map((m) => `${m.code} ${m.name}`)))
console.log('  sesi/jadwal :', (isi.sessions ?? []).length, ' drill:', (isi.drills ?? []).length,
  ' lagu:', (isi.songs ?? []).length)

/* ==================== PERANGKAT B — anggota membuka paket ================== */
console.log('\n=== B. Perangkat anggota, benar-benar baru ===')
const galatB = []
const ctxB = await browser.createBrowserContext()
const B = await ctxB.newPage()
pasang(B, galatB)
await B.goto(BASE, { waitUntil: 'networkidle2' })
await wait(2500)

const sambutan = (await B.$('[data-testid="sambutan-mode"]')) != null
console.log('sambutan tampil:', sambutan)
if (sambutan) {
  await B.click('[data-testid="pilih-member"]')
  await wait(300)
  await B.click('[data-testid="lanjut-pilih-mode"]')
  await wait(1500)
  await B.goto(BASE, { waitUntil: 'networkidle2' })
  await wait(2500)
}
console.log('menu:', JSON.stringify(await B.evaluate(() =>
  [...document.querySelectorAll('nav a[href^="#/"]')].map((a) => a.textContent.trim()))))
console.log('lokasi:', await B.evaluate(() => location.hash))

console.log('\n--- sebelum membuka paket ---')
console.log(bersih(await B.evaluate(() => document.body.innerText)).slice(0, 400))

const masukan = await B.$('#pkg-input')
console.log('\ninput berkas ada:', masukan != null)
if (masukan) {
  await masukan.uploadFile(path.join(BUKA, berkasSatu))
  await wait(3000)
}

console.log('\n--- sesudah membuka paket ---')
console.log('lokasi:', await B.evaluate(() => location.hash))
const teksB = bersih(await B.evaluate(() => document.body.innerText))
console.log(teksB.slice(0, 900))

// Tab yang tersedia bagi anggota.
const tab = await B.evaluate(() =>
  [...document.querySelectorAll('button')].map((b) => b.textContent.trim()).filter((t) => t && t.length < 24))
console.log('\ntombol di halaman:', JSON.stringify(tab))

for (const t of ['Jadwal', 'Formasi', 'Absensi', 'Catatan']) {
  const ketemu = await B.evaluate((x) => {
    const b = [...document.querySelectorAll('button')].find((y) => y.textContent.trim().includes(x))
    if (!b) return 'tidak ada tombolnya'
    b.click()
    return 'diklik'
  }, t)
  if (ketemu === 'diklik') {
    await wait(1200)
    console.log(`\n[tab ${t}]`, bersih(await B.evaluate(() => document.body.innerText)).slice(0, 500))
  } else {
    console.log(`\n[tab ${t}] ${ketemu}`)
  }
}

console.log('\ngalat konsol A:', galatA.length ? JSON.stringify(galatA.slice(0, 3)) : 'tidak ada')
console.log('galat konsol B:', galatB.length ? JSON.stringify(galatB.slice(0, 3)) : 'tidak ada')
await browser.close()
