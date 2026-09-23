// Tangkap G2b (kunci layar presenter): presenter terbuka, lalu terkunci.
import puppeteer from 'puppeteer'
const BASE = process.argv[2] ?? 'http://localhost:4173'
const b = await puppeteer.launch({ args: ['--no-sandbox'], defaultViewport: { width: 1400, height: 950 } })
const p = await b.newPage()
p.on('dialog', async (d) => { await d.accept() })
const wait = (m) => new Promise((r) => setTimeout(r, m))
const tombol = (t) => p.evaluate((x) => {
  const e = [...document.querySelectorAll('button')].find((y) => y.textContent.includes(x))
  if (!e || e.disabled) return false
  e.click(); return true
}, t)
await p.goto(BASE, { waitUntil: 'networkidle2' })
await wait(1500)
await tombol('Muat data contoh')
await wait(4000)
await p.reload({ waitUntil: 'networkidle2' })
await wait(2500)
await p.goto(`${BASE}/#/drill`, { waitUntil: 'networkidle2' })
await wait(2000)
const buka = await p.$('button[title^="Mode presenter"]')
if (buka) { await buka.click(); await wait(1800) }
await p.screenshot({ path: '/home/user/shots/kunci-presenter-buka.jpg', type: 'jpeg', quality: 80 })

const k = await p.$('[data-testid="kunci-presenter"]')
if (k) { await k.click(); await wait(900) }
await p.screenshot({ path: '/home/user/shots/kunci-presenter-terkunci.jpg', type: 'jpeg', quality: 80 })

console.log('--- kondisi terkunci ---')
console.log('set saat ini :', await p.evaluate(() => {
  const e = document.querySelector('[data-testid="info-set"]'); return e ? e.textContent.trim() : '-'
}))
console.log('lapisan      :', await p.evaluate(() => !!document.querySelector('[data-testid="layar-terkunci"]')))
console.log('teks layar   :', await p.evaluate(() => {
  const e = document.querySelector('[data-testid="layar-terkunci"]')
  return e ? e.innerText.replace(/\s*\n\s*/g, ' | ') : 'TIDAK ADA'
}))
console.log('tombol kunci :', await p.evaluate(() => {
  const e = document.querySelector('[data-testid="kunci-presenter"]')
  return e ? `${e.textContent.trim()} (terkunci=${e.dataset.terkunci})` : '-'
}))
console.log('selesai')
await b.close()
