// Tangkapan layar: tapak langkah pada jejak pemain terpilih (dev 5173)
import puppeteer from 'puppeteer'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--mute-audio'] })
const p = await b.newPage()
await p.setViewport({ width: 1440, height: 1100 })

await p.goto('http://localhost:5173/', { waitUntil: 'networkidle2' }); await wait(1600)
await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((y) => y.textContent.includes('Muat data contoh')); x && x.click() })
await wait(3400)
await p.evaluate(() => { location.hash = '#/drill' }); await wait(2800)

// pilih satu titik
const ling = await p.$$('circle[data-titik="1"]')
await ling[0].click(); await wait(800)

// nyalakan tapak langkah
await p.evaluate(() => {
  const el = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Tapak langkah'))
  el && el.click()
})
await wait(1000)

// fokus pada papan lapangan
const berkas = process.argv[2] || '/home/user/shots/dd9-tapak.png'
await p.screenshot({ path: berkas })
console.log('tersimpan:', berkas)
await b.close()
