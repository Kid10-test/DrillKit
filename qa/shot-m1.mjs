import puppeteer from 'puppeteer'
const BASE = process.argv[2] || 'http://localhost:5173'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] })
const p = await b.newPage()
await p.setViewport({ width: 1280, height: 1100, deviceScaleFactor: 2 })
await p.goto(BASE.startsWith('file:') ? BASE : BASE + '/', { waitUntil: 'networkidle2' })
await wait(2200)
await p.evaluate(() => { location.hash = '#/musik' })
await wait(2200)
// Pilih 7/8 · 2+2+3 lalu nyalakan hitung mundur dengan suara manusia.
const pilihTeks = async (sel, label) => {
  const v = await p.$$eval(sel + ' option', (o, lb) => { const x = o.find(q => q.textContent.trim() === lb); return x ? x.value : null }, label)
  if (v === null) throw new Error('tidak ketemu ' + label)
  await p.select(sel, v); await wait(400)
}
await pilihTeks('[data-testid="meter-pilihan"]', '7/8 · 2+2+3')
await p.click('[data-testid="hm-aktif"]'); await wait(500)
await p.select('[data-testid="hm-suara"]', 'suara'); await wait(600)
await wait(700)
await p.screenshot({ path: '/home/user/shots/m1-birama.png' })
await b.close()
console.log('ok')
