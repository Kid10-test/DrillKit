// Apa yang dilihat anak yang baru pertama kali membuka aplikasi?
import puppeteer from 'puppeteer'
const BASE = process.argv[2] ?? 'http://localhost:5173'
const b = await puppeteer.launch({ args: ['--no-sandbox'], defaultViewport: { width: 1280, height: 900 } })
const p = await b.newPage()
p.on('dialog', async (d) => { await d.accept() })
const wait = (m) => new Promise((r) => setTimeout(r, m))
// Perangkat benar-benar bersih: tanpa localStorage, tanpa basis data.
await p.goto(BASE, { waitUntil: 'networkidle2' })
await wait(2500)
console.log('mode tersimpan :', await p.evaluate(() => localStorage.getItem('drillkit.mode')))
console.log('lokasi         :', await p.evaluate(() => location.hash))
console.log('menu           :', await p.evaluate(() =>
  [...document.querySelectorAll('nav a[href^="#/"]')].map((a) => a.textContent.trim()).join(', ')))
console.log('halaman (awal) :', await p.evaluate(() =>
  (document.body.innerText || '').replace(/\s*\n\s*/g, ' | ').slice(0, 320)))
// Coba buka menu Berbagi seperti yang akan dilakukan anak.
await p.goto(`${BASE}/#/berbagi`, { waitUntil: 'networkidle2' })
await wait(1800)
console.log('--- halaman Berbagi di perangkat bersih ---')
console.log(await p.evaluate(() =>
  (document.body.innerText || '').replace(/\s*\n\s*/g, ' | ').slice(0, 600)))
console.log('tombol yang ada:', await p.evaluate(() =>
  [...document.querySelectorAll('button')].map((x) => x.textContent.trim()).filter(Boolean).slice(0, 14)))
console.log('selesai')
await b.close()
