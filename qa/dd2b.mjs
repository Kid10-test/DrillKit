// DD2 — verifikasi geometri kurva: lengkungan harus tegak lurus & sebesar yang dijanjikan
import puppeteer from 'puppeteer'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--mute-audio'] })
const p = await b.newPage()
await p.setViewport({ width: 1440, height: 980 })
const errs = []
p.on('pageerror', (e) => errs.push(e.message.slice(0, 160)))
p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)) })

const scrub = (v) => p.evaluate((n) => {
  const s = document.querySelector('[data-testid="garis-waktu"]')
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(s, String(n))
  s.dispatchEvent(new Event('input', { bubbles: true }))
}, v)
const trafo = () => p.evaluate(() =>
  [...document.querySelectorAll('g.cursor-move')].map((g) => g.getAttribute('transform') || 'translate(0 0)'),
)
const setSelect = (label, nilai) => p.evaluate((lab, val) => {
  const f = [...document.querySelectorAll('label')].find((l) => l.textContent.includes(lab))
  const sel = f && f.parentElement.querySelector('select')
  const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set
  setter.call(sel, String(val)); sel.dispatchEvent(new Event('change', { bubbles: true }))
}, label, nilai)
const setRange = (aria, nilai) => p.evaluate((a, val) => {
  const el = document.querySelector(`input[aria-label="${a}"]`)
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(el, String(val)); el.dispatchEvent(new Event('input', { bubbles: true }))
}, aria, nilai)

const angka = (t) => {
  const m = /translate\(([-\d.e]+) ([-\d.e]+)\)/.exec(t)
  return m ? [Number(m[1]), Number(m[2])] : [0, 0]
}

await p.goto('http://localhost:5173/', { waitUntil: 'networkidle2' }); await wait(1600)
await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((y) => y.textContent.includes('Muat data contoh')); x && x.click() })
await wait(3400)
await p.evaluate(() => { location.hash = '#/drill' }); await wait(2800)

for (const persen of [50, 100, -100]) {
  await setSelect('Bentuk jalur', 'lengkung'); await wait(700)
  await setRange('Lengkungan jalur', persen); await wait(700)
  await scrub(1); await wait(350); const akhir = (await trafo()).map(angka)
  await scrub(0.5); await wait(350); const tengah = (await trafo()).map(angka)

  let maksSalah = 0
  let contoh = null
  for (let i = 0; i < akhir.length; i++) {
    const [dx, dy] = akhir[i]
    const len = Math.hypot(dx, dy)
    if (len < 0.5) continue // pemain diam
    const px = -dy / len
    const py = dx / len
    const busur = (persen / 100) * len * 0.5
    // B(0.5) = 0.5·D + 0.5·perp·busur
    const ex = dx / 2 + px * busur * 0.5
    const ey = dy / 2 + py * busur * 0.5
    const salah = Math.hypot(tengah[i][0] - ex, tengah[i][1] - ey)
    if (salah > maksSalah) { maksSalah = salah; contoh = { tengah: tengah[i], harap: [Math.round(ex*100)/100, Math.round(ey*100)/100] } }
  }
  console.log(`lengkung ${persen}% → selisih terbesar terhadap hitungan: ${maksSalah.toFixed(4)} satuan`, contoh || '')
}

/* lurus: titik tengah harus tepat setengah perpindahan */
await setSelect('Bentuk jalur', 'lurus'); await wait(800)
await scrub(1); await wait(350); const akhirL = (await trafo()).map(angka)
await scrub(0.5); await wait(350); const tengahL = (await trafo()).map(angka)
let maksL = 0
for (let i = 0; i < akhirL.length; i++) {
  maksL = Math.max(maksL, Math.hypot(tengahL[i][0] - akhirL[i][0] / 2, tengahL[i][1] - akhirL[i][1] / 2))
}
console.log('lurus → titik tengah menyimpang paling jauh', maksL.toFixed(4), 'satuan dari setengah perpindahan')
console.log('error:', errs)
await b.close()
