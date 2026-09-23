// DD6 — detail per pemain (dev 5173)
import puppeteer from 'puppeteer'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--mute-audio'] })
const p = await b.newPage()
await p.setViewport({ width: 1440, height: 1000 })
const errs = []
p.on('pageerror', (e) => errs.push(e.message.slice(0, 160)))
p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)) })
const R = {}

const modal = () => p.evaluate(() => {
  const judul = [...document.querySelectorAll('h2,h3')].find((h) =>
    (h.textContent || '').startsWith('Detail —'),
  )
  if (!judul) return null
  const kotak = judul.closest('div[class*="rounded"]')?.parentElement?.parentElement
  if (!kotak) return null
  return {
    teks: kotak.innerText.replace(/\s+/g, ' ').slice(0, 700),
    baris: [...kotak.querySelectorAll('tbody tr')].map((tr) =>
      [...tr.children].map((td) => td.textContent.trim()),
    ),
    kepala: [...kotak.querySelectorAll('thead th')].map((th) => th.textContent.trim()),
    inputPerlengkapan: (() => {
      const el = [...kotak.querySelectorAll('input')].find((i) => i.placeholder.includes('Trumpet'))
      return el ? el.value : null
    })(),
  }
})
const tombol = (t) => p.evaluate((x) => {
  const el = [...document.querySelectorAll('button')].find((y) => y.textContent.trim() === x)
  if (!el) return false
  el.click(); return true
}, t)
const ketik = (placeholder, nilai) => p.evaluate((ph, v) => {
  const el = [...document.querySelectorAll('input')].find((i) => i.placeholder.includes(ph))
  if (!el) return false
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  set.call(el, v)
  el.dispatchEvent(new Event('input', { bubbles: true }))
  return true
}, placeholder, nilai)

await p.goto('http://localhost:5173/', { waitUntil: 'networkidle2' }); await wait(1600)
await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((y) => y.textContent.includes('Muat data contoh')); x && x.click() })
await wait(3400)
await p.evaluate(() => { location.hash = '#/drill' }); await wait(2800)

// pilih satu titik
const ling = await p.$$('circle[data-titik="1"]')
await ling[0].click(); await wait(800)
R.tombolDetail = await tombol('Detail'); await wait(1200)
R.modal = await modal()

// isi & simpan perlengkapan
R.ketik = await ketik('Trumpet', 'Flag — bendera merah')
await wait(400)
R.simpan = await p.evaluate(() => {
  const el = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Simpan')
  if (!el) return false
  el.click(); return true
})
await wait(1200)
// tutup & buka lagi untuk memastikan tersimpan
await p.keyboard.press('Escape'); await wait(900)
await p.evaluate(() => { const el = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Detail'); el && el.click() })
await wait(1200)
R.modalKedua = await modal()

R.error = errs
console.log(JSON.stringify(R, null, 2))
await b.close()
