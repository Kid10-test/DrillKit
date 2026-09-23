// DD2 — jalur & pembagian gerak (dev 5173)
import puppeteer from 'puppeteer'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const R = {}
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--mute-audio'] })
const p = await b.newPage()
await p.setViewport({ width: 1440, height: 980 })
const errs = []
p.on('pageerror', (e) => errs.push(e.message.slice(0, 160)))
p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)) })

const scrub = (v) => p.evaluate((nilai) => {
  const s = document.querySelector('[data-testid="garis-waktu"]')
  if (!s) return false
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(s, String(nilai))
  s.dispatchEvent(new Event('input', { bubbles: true }))
  return true
}, v)
const setSelect = (label, nilai) => p.evaluate((lab, val) => {
  const f = [...document.querySelectorAll('label')].find((l) => l.textContent.includes(lab))
  const sel = f && f.parentElement.querySelector('select')
  if (!sel) return false
  const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set
  setter.call(sel, String(val))
  sel.dispatchEvent(new Event('change', { bubbles: true }))
  return true
}, label, nilai)
const setRange = (aria, nilai) => p.evaluate((a, val) => {
  const el = document.querySelector(`input[aria-label="${a}"]`)
  if (!el) return false
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(el, String(val))
  el.dispatchEvent(new Event('input', { bubbles: true }))
  return true
}, aria, nilai)
const setTundaPertama = (nilai) => p.evaluate((val) => {
  const lab = [...document.querySelectorAll('label')].find((l) => l.textContent.includes('Tunda mulai per section'))
  const inp = lab && lab.parentElement.querySelector('input[type="number"]')
  if (!inp) return false
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(inp, String(val))
  inp.dispatchEvent(new Event('input', { bubbles: true }))
  return true
}, nilai)

/** Semua transform titik, jadi bisa dibandingkan antar pengaturan. */
const transform = () => p.evaluate(() =>
  [...document.querySelectorAll('g.cursor-move')].map((g) => g.getAttribute('transform') || ''),
)
const jejakKeluar = () => p.evaluate(() => {
  const el = [...document.querySelectorAll('[data-trail="keluar"]')]
  const a = el[0]
  return { jml: el.length, tag: a ? a.tagName.toLowerCase() : null, d: a ? a.getAttribute('d') : null }
})
/** Berapa titik yang belum bergerak sama sekali. */
const diam = (daftar) => daftar.filter((t) => !t || /translate\(0 0\)/.test(t) || !/translate/.test(t)).length

await p.goto('http://localhost:5173/', { waitUntil: 'networkidle2' }); await wait(1600)
await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((y) => y.textContent.includes('Muat data contoh')); x && x.click() })
await wait(3400)
await p.evaluate(() => { location.hash = '#/drill' }); await wait(2800)

/* ---------- A. Bawaan: lurus ---------- */
R.awalJejak = await jejakKeluar()
R.scrubLurus = await scrub(0.5); await wait(500)
R.tengahLurus = await transform()

/* ---------- B. Jalur melengkung ---------- */
R.setJalur = await setSelect('Bentuk jalur', 'lengkung'); await wait(900)
R.setLengkung = await setRange('Lengkungan jalur', 100); await wait(900)
R.jejakLengkung = await jejakKeluar()
R.scrubLengkung = await scrub(0.5); await wait(500)
R.tengahLengkung = await transform()

/* ujung jalur harus sama persis antara lurus & melengkung */
await scrub(1); await wait(400); R.akhirLengkung = await transform()
await scrub(0); await wait(400); R.awalLengkung = await transform()

/* ---------- C. Tunda per section ---------- */
await scrub(0.25); await wait(400)
R.diamTanpaTunda = diam(await transform())
R.setTunda = await setTundaPertama(4); await wait(1000)
await scrub(0.25); await wait(400)
R.diamDenganTunda = diam(await transform())
await scrub(0.6); await wait(400)
R.diamTengah = diam(await transform())
await scrub(1); await wait(400)
R.diamAkhir = diam(await transform())

/* ---------- D. Presenter mengikuti ---------- */
await scrub(0); await wait(300)
await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((y) => (y.title || '').includes('resenter') || y.textContent.includes('Presenter')); x && x.click() })
await wait(2600)
R.presenterJejak = await p.evaluate(() => {
  const el = [...document.querySelectorAll('[data-titik="1"]')]
  return { titik: el.length }
})
await p.keyboard.press('Escape'); await wait(1200)

/* ---------- E. Kembali lurus: jejak jadi garis lagi ---------- */
R.kembaliLurus = await setSelect('Bentuk jalur', 'lurus'); await wait(1000)
R.jejakAkhir = await jejakKeluar()

R.error = errs
console.log(JSON.stringify(R, null, 2))
await b.close()
