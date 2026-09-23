import puppeteer from 'puppeteer'
import { lewatSambutan } from './sambutan.mjs'
/* N14 — dialihkan dari server pengembangan (:5173) ke hasil build
   (:4173). Server pengembangan menyajikan ratusan modul sekali muat dan
   kehabisan memori di kotak pasir; karena itu rangkaian ini dulu tidak
   pernah bisa masuk daftar regresi. */
const BASE = process.env.BASE || 'http://localhost:4173'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--mute-audio'] })
const p = await b.newPage(); await p.setViewport({ width: 1400, height: 950 })
const errs = []
p.on('pageerror', (e) => errs.push(e.message.slice(0, 140)))
p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 140)) })
await p.goto(BASE + '/', { waitUntil: 'networkidle2' }); await wait(1800)
/* Layar sambutan muncul di setiap profil baru; tanpa ini rangkaian
   tidak bisa menyentuh apa pun. */
await lewatSambutan(p)
await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((y) => y.textContent.includes('Muat data contoh')); x && x.click() })
await wait(3400)
await p.evaluate(() => { location.hash = '#/drill' }); await wait(2600)
const R = await p.evaluate(() => ({
  judul: document.body.innerText.slice(0, 60).replace(/\n/g, ' | '),
  titik: document.querySelectorAll('[data-member-id], [data-testid^="titik-"]').length,
  svg: document.querySelectorAll('svg').length,
}))
// buka pengaturan drill (tombol ⚙)
R.modalPengaturan = await p.evaluate(() => {
  const t = [...document.querySelectorAll('button')].find((b) => b.title?.includes('Pengaturan drill'))
  if (!t) return 'tombol tidak ada'
  t.click(); return 'diklik'
})
await wait(1000)
R.kartuShow = await p.evaluate(() => !!document.querySelector('[data-testid="kartu-berbagi-show"]'))
await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((y) => y.textContent.trim() === 'Batal' || y.textContent.trim() === 'Tutup'); x && x.click() })
await wait(600)
// buka dialog shortcut dengan tombol ?
await p.keyboard.press('?')
await wait(700)
R.daftarShortcut = await p.evaluate(() => {
  const d = document.querySelector('[data-testid="daftar-shortcut"]')
  return d ? d.innerText.split('\n').filter(Boolean).length : 0
})
R.jumlahSet = await p.evaluate(() => (document.body.innerText.match(/Set \d+/g) ?? []).length)
R.error = errs
console.log(JSON.stringify(R, null, 2))
await b.close()
