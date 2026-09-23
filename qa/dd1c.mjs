// DD1 — uji tempel-ke-patok (snap) + regresi editor
import puppeteer from 'puppeteer'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const R = {}
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--mute-audio'] })
const p = await b.newPage()
await p.setViewport({ width: 1440, height: 980 })
const errs = []
p.on('pageerror', (e) => errs.push(e.message.slice(0, 160)))
p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)) })

await p.goto('http://localhost:5173/', { waitUntil: 'networkidle2' }); await wait(1500)
await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((y) => y.textContent.includes('Muat data contoh')); x && x.click() })
await wait(3200)
await p.evaluate(() => { location.hash = '#/drill' }); await wait(2600)

/* regresi: editor tetap utuh setelah suntingan */
R.regresi = await p.evaluate(() => ({
  set: [...document.querySelectorAll('[data-testid="daftar-set"] > *')].length || null,
  titik: document.querySelectorAll('g.cursor-move').length,
  hidup: !!document.querySelector('[data-live-coord]'),
}))

async function gantiPreset(nama) {
  await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((y) => (y.title || '') === 'Pengaturan drill'); x && x.click() })
  await wait(1000)
  await p.evaluate((t) => { const x = [...document.querySelectorAll('button')].find((y) => y.textContent.trim() === t); x && x.click() }, nama)
  await wait(900)
  await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((y) => y.textContent.trim() === 'Simpan'); x && x.click() })
  await wait(2200)
}

const koorHidup = () => p.evaluate(() => {
  const el = document.querySelector('[data-live-coord]')
  return el ? el.textContent.trim() : null
})

const geserTitik = async (dx, dy) => {
  const kotak = await p.evaluate(() => {
    const g = document.querySelector('g.cursor-move')
    if (!g) return null
    const r = g.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  })
  if (!kotak) return false
  await p.mouse.move(kotak.x, kotak.y)
  await p.mouse.down()
  await p.mouse.move(kotak.x + dx, kotak.y + dy, { steps: 6 })
  await p.mouse.up()
  await wait(900)
  return true
}

/* ---------- A. DCI dulu (snap per langkah) ---------- */
R.geserDci = await geserTitik(24, 18)
R.koorDci = await koorHidup()

/* ---------- B. Lapangan bola: harus menempel ke patok ---------- */
await gantiPreset('Sepak bola (Indonesia)')
R.koorSebelum = await koorHidup()
R.geserBola = await geserTitik(24, 18)
R.koorSesudah = await koorHidup()
R.tepatDiPatok = R.koorSesudah ? /^[A-Z]#?\d+$/.test(R.koorSesudah) : false

R.geserBola2 = await geserTitik(-30, 22)
R.koorSesudah2 = await koorHidup()
R.tepatDiPatok2 = R.koorSesudah2 ? /^[A-Z]#?\d+$/.test(R.koorSesudah2) : false

/* ---------- C. Patok mati → snap kembali per langkah ---------- */
await gantiPreset('DCI / kampus')
R.geserDci2 = await geserTitik(18, 12)
R.koorDci2 = await koorHidup()

/* ---------- D. Regresi: shortcut & berbagi show tetap ada ---------- */
R.setelahSunting = await p.evaluate(() => ({
  titik: document.querySelectorAll('g.cursor-move').length,
  berbagi: !!document.querySelector('[data-testid="kartu-berbagi-show"]'),
}))
await p.keyboard.press('?'); await wait(900)
R.shortcut = await p.evaluate(() => {
  const el = document.querySelector('[data-testid="daftar-shortcut"]')
  return el ? el.textContent.split('\n').filter((x) => x.trim()).length : null
})

R.error = errs
console.log(JSON.stringify(R, null, 2))
await b.close()
