// DD3 — analitik & peringatan gerak (dev 5173)
import puppeteer from 'puppeteer'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--mute-audio'] })
const p = await b.newPage()
await p.setViewport({ width: 1440, height: 1000 })
const errs = []
p.on('pageerror', (e) => errs.push(e.message.slice(0, 160)))
p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)) })
const R = {}

const setCount = (v) => p.evaluate((val) => {
  const lab = [...document.querySelectorAll('label')].find((l) => l.textContent.includes('Count ke set berikutnya'))
  const inp = lab && lab.parentElement.querySelector('input')
  if (!inp) return false
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  set.call(inp, String(val)); inp.dispatchEvent(new Event('input', { bubbles: true }))
  return true
}, v)
const toggle = (teks) => p.evaluate((t) => {
  // Toggle = tombol berperan switch
  const el = [...document.querySelectorAll('button,[role="switch"],label')].find((x) => x.textContent.trim() === t)
  if (!el) return false
  el.click(); return true
}, teks)
const bacaPanel = () => p.evaluate(() => {
  const judul = [...document.querySelectorAll('h2')].find((h) => h.textContent.includes('Analitik gerakan'))
  if (!judul) return null
  const card = judul.closest('div[class*="rounded"]') || judul.parentElement.parentElement
  return {
    teks: card.innerText.replace(/\s+/g, ' ').slice(0, 600),
    angkaBesar: [...card.querySelectorAll('.text-\\[15px\\]')].map((e) => e.textContent.trim()),
    baris: [...card.querySelectorAll('[style*="background"]')].map((e) => e.getAttribute('style')),
  }
})
const warnaJejak = () => p.evaluate(() => [...new Set([...document.querySelectorAll('[data-trail="keluar"]')].map((e) => e.getAttribute('stroke')))])

await p.goto('http://localhost:5173/', { waitUntil: 'networkidle2' }); await wait(1600)
await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((y) => y.textContent.includes('Muat data contoh')); x && x.click() })
await wait(3400)
await p.evaluate(() => { location.hash = '#/drill' }); await wait(2800)

R.panel = await bacaPanel()
R.warnaAwal = await warnaJejak()

// nyalakan peta kesulitan
R.setToggle = await toggle('Warnai jejak menurut kesulitan'); await wait(900)
R.warnaSesudah = await warnaJejak()

// paksa gerakan jadi berat: semua jarak ditempuh dalam 1 count
R.setCount1 = await setCount(1); await wait(1200)
R.panelBerat = await bacaPanel()
R.warnaBerat = await warnaJejak()

// kembalikan
R.setCount16 = await setCount(16); await wait(1200)
R.panelKembali = await bacaPanel()

R.error = errs
console.log(JSON.stringify(R, null, 2))
await b.close()
