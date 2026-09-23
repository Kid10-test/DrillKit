import puppeteer from 'puppeteer'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--mute-audio'] })
const p = await b.newPage(); await p.setViewport({ width: 1440, height: 1000 })
await p.goto('http://localhost:5173/', { waitUntil: 'networkidle2' }); await wait(1600)
await p.evaluate(() => { const x=[...document.querySelectorAll('button')].find(y=>y.textContent.includes('Muat data contoh')); x&&x.click() })
await wait(3400); await p.evaluate(() => { location.hash = '#/drill' }); await wait(2800)
const info = () => p.evaluate(() => ({
  slider: !!document.querySelector('[data-testid="garis-waktu"]'),
  namaSet: (document.querySelector('input')||{}).value,
  daftarSet: [...document.querySelectorAll('option')].map(o=>o.textContent).slice(0,8),
  judul: [...document.querySelectorAll('h1,h2')].map(h=>h.textContent.trim()).slice(0,6),
  titik: document.querySelectorAll('circle[data-titik="1"]').length,
}))
console.log('awal:', JSON.stringify(await info()))
await p.keyboard.press('BracketRight'); await wait(1200)
console.log('setelah ]:', JSON.stringify(await info()))
await p.keyboard.press('BracketLeft'); await wait(1200)
console.log('setelah [:', JSON.stringify(await info()))
await b.close()
