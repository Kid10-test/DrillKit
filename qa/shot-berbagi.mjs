// Tangkap layar Berbagi (dua cara membagikan) + baca teksnya.
import puppeteer from 'puppeteer'
const BASE = process.argv[2] ?? 'http://localhost:4173'
const b = await puppeteer.launch({ args: ['--no-sandbox'], defaultViewport: { width: 1440, height: 1150 } })
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
await p.goto(`${BASE}/#/berbagi`, { waitUntil: 'networkidle2' })
await wait(2000)
await p.screenshot({ path: '/home/user/shots/berbagi-dua-cara.jpg', type: 'jpeg', quality: 80 })

console.log('--- kartu "Dua cara membagikan" ---')
console.log(await p.evaluate(() => {
  const kartu = [...document.querySelectorAll('div')].find((d) =>
    d.querySelector('h2') && /Dua cara membagikan/.test(d.querySelector('h2').textContent))
  return kartu ? kartu.innerText.replace(/\s*\n\s*/g, ' | ') : 'TIDAK ADA'
}))
console.log('--- kartu "Isi bersama" ---')
console.log(await p.evaluate(() => {
  const kartu = [...document.querySelectorAll('div')].find((d) =>
    d.querySelector('h2') && /Isi bersama/.test(d.querySelector('h2').textContent))
  return kartu ? kartu.innerText.replace(/\s*\n\s*/g, ' | ').slice(0, 520) : 'TIDAK ADA'
}))
console.log('--- tombol unduh ---')
console.log(await p.evaluate(() =>
  [...document.querySelectorAll('[data-testid^="unduh-"]')].map((e) =>
    `${e.dataset.testid}: "${e.textContent.trim()}"`).join('\n')))
console.log('selesai')
await b.close()
