// DD1 lanjutan — pola patok simetris, garis lapangan, warna latar, awalan T
import puppeteer from 'puppeteer'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const R = {}
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--mute-audio'] })
const p = await b.newPage()
await p.setViewport({ width: 1440, height: 980 })
const errs = []
p.on('pageerror', (e) => errs.push(e.message.slice(0, 160)))
p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)) })

const bukaPengaturan = async () => {
  await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((y) => (y.title || '') === 'Pengaturan drill'); x && x.click() })
  await wait(1100)
}
const klikTeks = (t) => p.evaluate((teks) => { const x = [...document.querySelectorAll('button')].find((y) => y.textContent.trim() === teks); if (!x) return false; x.click(); return true }, t)
const setSelect = (label, nilai) => p.evaluate((lab, val) => {
  const f = [...document.querySelectorAll('label')].find((l) => l.textContent.includes(lab))
  const sel = f && f.parentElement.querySelector('select')
  if (!sel) return false
  const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set
  setter.call(sel, String(val))
  sel.dispatchEvent(new Event('change', { bubbles: true }))
  return true
}, label, nilai)

await p.goto('http://localhost:5173/', { waitUntil: 'networkidle2' }); await wait(1600)
await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((y) => y.textContent.includes('Muat data contoh')); x && x.click() })
await wait(3400)
await p.evaluate(() => { location.hash = '#/drill' }); await wait(2600)

await bukaPengaturan()
R.presetBola = await klikTeks('Sepak bola (Indonesia)'); await wait(900)

/* ---------- A. Opsi baru ada di pengaturan ---------- */
R.opsi = await p.evaluate(() => {
  const labels = [...document.querySelectorAll('label')].map((l) => l.textContent.trim())
  return {
    pola: labels.some((l) => l.includes('Pola patok huruf')),
    tulisan: labels.some((l) => l.includes('Tulisan patok angka')),
    duaSisi: labels.some((l) => l.includes('Patok di dua sisi')),
    garis: labels.some((l) => l.includes('Garis lapangan')),
    warna: labels.some((l) => l.includes('Warna lapangan')),
  }
})
R.contohPola = await p.evaluate(() => {
  const el = [...document.querySelectorAll('p')].find((x) => x.textContent.includes('Urutannya'))
  return el ? el.textContent.replace(/\s+/g, ' ').trim() : null
})

/* ---------- B. Bawaan: A di tengah, tanpa penanda sisi ---------- */
await klikTeks('Simpan'); await wait(2400)
const bacaLapangan = () => p.evaluate(() => {
  const t = [...document.querySelectorAll('svg text')].map((x) => x.textContent.trim())
  const rumput = document.querySelector('[data-lap="rumput"]')
  return {
    huruf: t.filter((x) => /^[A-Z]'?#?$/.test(x)),
    jmlB: t.filter((x) => x === 'B').length,
    adaBKiri: t.filter((x) => x === "B'").length,
    warna: rumput ? rumput.getAttribute('fill') : null,
    tepi: document.querySelectorAll('[data-lap="tepi"]').length,
    garis: document.querySelectorAll('[data-lap="garis"]').length,
    patok: document.querySelectorAll('[data-lap="patok"]').length,
  }
})
R.bawaan = await bacaLapangan()

/* ---------- C. Koordinat titik tengah harus A ---------- */
const koor = () => p.evaluate(() => { const e = document.querySelector('[data-live-coord]'); return e ? e.textContent.trim() : null })
const kotak = await p.evaluate(() => { const g = document.querySelector('g.cursor-move'); if (!g) return null; const r = g.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })
if (kotak) { await p.mouse.move(kotak.x, kotak.y); await p.mouse.down(); await p.mouse.move(kotak.x + 20, kotak.y + 16, { steps: 5 }); await p.mouse.up(); await wait(1000) }
R.koorSetelahGeser = await koor()

/* ---------- D. Penanda sisi ---------- */
await bukaPengaturan()
R.setPenanda = await setSelect('Patok di dua sisi', 1); await wait(700)
await klikTeks('Simpan'); await wait(2200)
R.penandaSisi = await bacaLapangan()

/* ---------- E. Tanpa awalan T ---------- */
await bukaPengaturan()
R.setT = await setSelect('Tulisan patok angka', 0); await wait(700)
await klikTeks('Simpan'); await wait(2200)
R.tanpaT = await p.evaluate(() => {
  const t = [...document.querySelectorAll('svg text')].map((x) => x.textContent.trim())
  return { adaT1: t.includes('T1'), ada1: t.includes('1'), contoh: t.filter((x) => /^\d+$/.test(x)).slice(0, 4) }
})
if (kotak) { await p.mouse.move(kotak.x + 20, kotak.y + 16); await p.mouse.down(); await p.mouse.move(kotak.x + 40, kotak.y + 30, { steps: 5 }); await p.mouse.up(); await wait(1000) }
R.koorTanpaT = await koor()

/* ---------- F. Garis & warna ---------- */
await bukaPengaturan()
R.setGaris = await setSelect('Garis lapangan', 2); await wait(600)
R.setWarna = await setSelect('Warna lapangan', 'biru'); await wait(700)
await klikTeks('Simpan'); await wait(2200)
R.tanpaTepi = await bacaLapangan()

await bukaPengaturan()
R.setGaris0 = await setSelect('Garis lapangan', 0); await wait(600)
await klikTeks('Simpan'); await wait(2200)
R.tanpaGaris = await bacaLapangan()

R.error = errs
console.log(JSON.stringify(R, null, 2))
await b.close()
