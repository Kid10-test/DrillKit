// DD4 — alat gerak massa (dev 5173)
import puppeteer from 'puppeteer'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--mute-audio'] })
const p = await b.newPage()
await p.setViewport({ width: 1440, height: 1000 })
const errs = []
p.on('pageerror', (e) => errs.push(e.message.slice(0, 160)))
p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)) })
const R = {}

const posisi = () => p.evaluate(() =>
  [...document.querySelectorAll('circle[data-titik="1"]')].map((c) => [
    Math.round(Number(c.getAttribute('cx')) * 1000) / 1000,
    Math.round(Number(c.getAttribute('cy')) * 1000) / 1000,
  ]),
)
const tombol = (teks) => p.evaluate((t) => {
  const el = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === t)
  if (!el) return false
  el.click(); return true
}, teks)
const pusat = (d) => [d.reduce((a, q) => a + q[0], 0) / d.length, d.reduce((a, q) => a + q[1], 0) / d.length]
const beda = (a, c) => a.every((q, i) => Math.hypot(q[0] - c[i][0], q[1] - c[i][1]) < 0.02)

await p.goto('http://localhost:5173/', { waitUntil: 'networkidle2' }); await wait(1600)
await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((y) => y.textContent.includes('Muat data contoh')); x && x.click() })
await wait(3400)
await p.evaluate(() => { location.hash = '#/drill' }); await wait(2800)

R.adaPanel = await p.evaluate(() => !!([...document.querySelectorAll('h2')].find((h) => h.textContent.includes('Alat gerak massa'))))
const A = await posisi()
R.jmlTitik = A.length

/* ---------- 1. Putar 90° ke kanan ---------- */
R.kilikPutar = await tombol('Kanan ↻'); await wait(900)
const B = await posisi()
const cA = pusat(A), cB = pusat(B)
R.pusatTetap = Math.hypot(cA[0] - cB[0], cA[1] - cB[1]) < 0.02
// jarak tiap titik ke pusat harus kekal (bentuk tidak berubah)
const jarakA = A.map((q) => Math.hypot(q[0] - cA[0], q[1] - cA[1])).sort((x, y) => x - y)
const jarakB = B.map((q) => Math.hypot(q[0] - cB[0], q[1] - cB[1])).sort((x, y) => x - y)
R.bentukKekal = jarakA.every((v, i) => Math.abs(v - jarakB[i]) < 0.02)
R.bergakPutar = !beda(A, B)

/* ---------- 2. Undo mengembalikan semuanya ---------- */
await p.keyboard.down('Control'); await p.keyboard.press('KeyZ'); await p.keyboard.up('Control')
await wait(1000)
R.undoKembali = beda(A, await posisi())

/* ---------- 3. Cermin kiri ⇄ kanan ---------- */
R.kilikCermin = await tombol('Kiri ⇄ Kanan'); await wait(900)
const C = await posisi()
const SP = (pusat(A)[0] + pusat(C)[0]) / 2
R.cerminTepat = A.every((q, i) => Math.abs(C[i][0] - (2 * SP - q[0])) < 0.02 && Math.abs(C[i][1] - q[1]) < 0.02)
await p.keyboard.down('Control'); await p.keyboard.press('KeyZ'); await p.keyboard.up('Control'); await wait(1000)

/* ---------- 4. Geser 4 langkah ke depan ---------- */
R.kilikGeser = await tombol('Ke depan'); await wait(900)
const D = await posisi()
const selisihY = A.map((q, i) => Math.round((D[i][1] - q[1]) * 1000) / 1000)
R.geserSeragam = new Set(selisihY).size === 1
R.geserJarak = selisihY[0]      // 4 langkah × 0,625 yard = 2,5 satuan
await p.keyboard.down('Control'); await p.keyboard.press('KeyZ'); await p.keyboard.up('Control'); await wait(1000)

/* ---------- 5. Geser 4 langkah ke Side 1 ---------- */
await tombol('Ke Side 1'); await wait(900)
const E = await posisi()
R.side1Jarak = Math.round((E[0][0] - A[0][0]) * 1000) / 1000
await p.keyboard.down('Control'); await p.keyboard.press('KeyZ'); await p.keyboard.up('Control'); await wait(1000)

/* ---------- 6. Pilih satu titik, lalu kembang-kempis ---------- */
const lingkaran = await p.$$('circle[data-titik="1"]')
await lingkaran[0].click(); await wait(700)
R.terpilih = await p.evaluate(() => {
  const el = [...document.querySelectorAll('p,span')].find((x) => x.textContent.includes('titik dipilih'))
  return el ? el.textContent.trim() : null
})
await tombol('Besarkan'); await wait(900)
const F = await posisi()
R.yangBerubah = A.reduce((n, q, i) => n + (Math.hypot(q[0] - F[i][0], q[1] - F[i][1]) > 0.02 ? 1 : 0), 0)

R.error = errs
console.log(JSON.stringify(R, null, 2))
await b.close()
