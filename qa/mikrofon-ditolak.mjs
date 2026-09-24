/**
 * Uji **izin mikrofon ditolak** — penala boleh diam, metronom tidak boleh.
 *
 * Mengapa ini ada: penala butuh mikrofon, dan saya pernah mengatakannya
 * kepada pelatih dengan janji yang belum diuji — "kalau anak-anak menolak
 * izinnya, penala diam saja, metronom tetap jalan". Janji itu hanya boleh
 * diucapkan bila benar.
 *
 * Bahayanya bukan penala yang tidak bunyi, melainkan penolakan izin yang
 * melempar galat tak tertangani: satu `getUserMedia` yang gagal bisa
 * meruntuhkan SELURUH halaman Musik, dan anak yang menolak izin mikrofon
 * justru kehilangan metronomnya — alat yang sama sekali tidak butuh
 * mikrofon. Karena itu yang diuji bukan "penalanya bekerja", melainkan
 * "segalanya yang lain tetap bekerja".
 */
import puppeteer from 'puppeteer'
import { lewatSambutan } from './sambutan.mjs'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { DIST } from './lokasi.mjs'

const BASE = process.env.BASE || 'http://localhost:4173'
const PAKET = path.join(DIST, 'paket.json')
const UNDUH = path.join(os.tmpdir(), 'unduh-mik')
fs.mkdirSync(UNDUH, { recursive: true })
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

let lulus = 0
const gagal = []
const cek = (nama, syarat, keterangan = '') => {
  if (syarat) lulus += 1
  else gagal.push(`${nama}${keterangan ? ' — ' + keterangan : ''}`)
}

// Mikrofon DITOLAK habis-habisan: tanpa perangkat audio pun.
const browser = await puppeteer.launch({
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--use-fake-ui-for-media-stream=deny',
    '--deny-permission-prompts',
  ],
  defaultViewport: { width: 1300, height: 1000 },
})

try {
  const A = await browser.newPage()
  A.on('dialog', async (d) => { await d.accept() })
  await A.goto(BASE, { waitUntil: 'networkidle2' })
  await wait(1200)
  await lewatSambutan(A)
  await wait(1200)
  await A.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((y) => y.textContent.includes('Muat data contoh'))
    if (b) b.click()
  })
  await wait(4500)
  const cdp = await A.target().createCDPSession()
  await cdp.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: UNDUH })
  await A.goto(`${BASE}/#/berbagi`, { waitUntil: 'networkidle2' })
  await wait(2200)
  await (await A.$('[data-testid="unduh-grup"]')).click()
  let f = null
  for (let i = 0; i < 120 && !f; i += 1) {
    await wait(250)
    const x = fs.readdirSync(UNDUH).filter((y) => y.endsWith('.json'))
    if (x.length) f = path.join(UNDUH, x[0])
  }
  fs.writeFileSync(PAKET, fs.readFileSync(f))

  // Anggota, dengan izin mikrofon DITOLAK
  const ctx = await browser.createBrowserContext()
  await ctx.overridePermissions(BASE, []) // tidak ada izin apa pun
  const B = await ctx.newPage()
  const galat = []
  B.on('pageerror', (e) => galat.push(String(e).slice(0, 200)))
  B.on('console', (m) => { if (m.type() === 'error') galat.push('konsol: ' + m.text().slice(0, 200)) })
  B.on('dialog', async (d) => { await d.accept() })
  await B.goto(BASE, { waitUntil: 'networkidle2' })
  await wait(2500)
  await B.click('[data-testid="pilih-member"]')
  await wait(300)
  await B.click('[data-testid="lanjut-pilih-mode"]')
  await wait(1500)
  await B.goto(`${BASE}/#/berbagi`, { waitUntil: 'networkidle2' })
  await wait(2500)
  await (await B.$('[data-testid="ambil-materi"]')).click()
  await wait(3200)

  const teks = () => B.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').trim())
  const ada = (id) => B.evaluate((x) => document.querySelector(`[data-testid="${x}"]`) != null, id)

  await (await B.$('[data-testid="tab-musik"]')).click()
  await wait(2000)
  cek('1: metronom tersedia sebelum mikrofon disentuh', await ada('tombol-mulai'))
  cek('1: penala tersedia untuk anggota', await ada('kartu-penala'))

  // Tekan tombol mikrofon dengan izin yang pasti ditolak.
  const tombolMik = await B.$('[data-testid="tombol-mikrofon"]')
  cek('2: tombol mikrofon ada', tombolMik != null)
  if (tombolMik) {
    await tombolMik.click()
    await wait(3000)
  }
  const t = await teks()
  cek('3: TIDAK ada galat ketika izin mikrofon ditolak',
    galat.length === 0, galat.slice(0, 3).join(' | '))
  cek('3: halaman Musik TIDAK runtuh', t.length > 40, `${t.length} huruf`)
  cek('3: metronom TETAP ada setelah ditolak', await ada('tombol-mulai'))
  cek('3: penala TETAP ada setelah ditolak', await ada('kartu-penala'))

  // Metronom harus tetap berdetak walau mikrofon ditolak.
  if (await ada('tombol-mulai')) {
    await (await B.$('[data-testid="tombol-mulai"]')).click()
    await wait(700)
    const jalan = await teks()
    cek('4: metronom TETAP berjalan walau mikrofon ditolak', /Berhenti/.test(jalan))
    const m1 = await B.evaluate(() => document.querySelector('[data-testid="birama-ke"]')?.textContent ?? '')
    await wait(2600)
    const m2 = await B.evaluate(() => document.querySelector('[data-testid="birama-ke"]')?.textContent ?? '')
    cek('4: biramanya benar-benar bertambah', m1 !== m2, `${m1} -> ${m2}`)
  }
} finally {
  try { fs.unlinkSync(PAKET) } catch { /* tidak apa-apa */ }
  await browser.close()
}

console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) {
  for (const g of gagal) console.log('  \u2717 ' + g)
  process.exitCode = 1
}
