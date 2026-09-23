// Tangkap & baca keadaan mode anggota terkunci.
import puppeteer from 'puppeteer'
const BASE = process.argv[2] ?? 'http://localhost:4173'
const b = await puppeteer.launch({ args: ['--no-sandbox'], defaultViewport: { width: 1440, height: 1000 } })
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
// Pasang PIN lalu masuk mode anggota.
await p.evaluate(() => {
  const hashPin = (pin) => { let h = 5381; const s = `drillkit::${pin}`
    for (let i = 0; i < s.length; i += 1) h = ((h << 5) + h + s.charCodeAt(i)) | 0
    return `k${(h >>> 0).toString(36)}` }
  localStorage.setItem('drillkit.kiosk.pin', hashPin('1234'))
  localStorage.setItem('drillkit.kiosk.hint', 'angka punggung')
  localStorage.setItem('drillkit.mode', 'member')
})
await p.reload({ waitUntil: 'networkidle2' })
await wait(2500)
console.log('mode  :', await p.evaluate(() => localStorage.getItem('drillkit.mode')))
console.log('menu  :', await p.evaluate(() =>
  [...document.querySelectorAll('nav a[href^="#/"]')].map((a) => a.textContent.trim())))
await p.screenshot({ path: '/home/user/shots/mode-anggota-terkunci.jpg', type: 'jpeg', quality: 80 })

// Coba lari ke rute pelatih.
await p.goto(`${BASE}/#/pengaturan`, { waitUntil: 'networkidle2' })
await wait(1500)
console.log('ketik #/pengaturan -> dialihkan ke:', await p.evaluate(() => location.hash))

// Buka modal keluar.
await p.goto(`${BASE}/#/berbagi`, { waitUntil: 'networkidle2' })
await wait(1800)
const k = await p.$('[data-testid="keluar-mode-anggota"]')
if (k) { await k.click(); await wait(900) }
console.log('modal keluar:', await p.evaluate(() => {
  const e = document.querySelector('[data-testid="modal-keluar-anggota"]')
  return e ? e.innerText.replace(/\s*\n\s*/g, ' | ') : 'TIDAK ADA'
}))
await p.screenshot({ path: '/home/user/shots/mode-keluar-pin.jpg', type: 'jpeg', quality: 80 })
console.log('selesai')
await b.close()
