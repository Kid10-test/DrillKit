// Tangkapan layar 31e — opsi dasar jarak di Pengaturan drill.
import puppeteer from 'puppeteer'
import fs from 'node:fs'

const BASE = process.env.BASE || 'http://localhost:5173'
fs.mkdirSync('/home/user/shots', { recursive: true })
const browser = await puppeteer.launch({
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  defaultViewport: { width: 1000, height: 1100 },
})
const p = await browser.newPage()
p.on('console', (m) => { if (m.type() === 'error') console.log('KONSOL:', m.text()) })
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const tombol = (teks) =>
  p.evaluate((t) => {
    const x = [...document.querySelectorAll('button')].find((y) => y.textContent.includes(t))
    if (!x || x.disabled) return false
    x.click()
    return true
  }, teks)
const tombolJudul = (j) =>
  p.evaluate((t) => {
    const x = [...document.querySelectorAll('button')].find((y) =>
      (y.getAttribute('title') || '').includes(t))
    if (!x || x.disabled) return false
    x.click()
    return true
  }, j)
const klik = async (sel) => { await p.waitForSelector(sel, { timeout: 10000 }); await p.click(sel) }
const potret = async (nama) => {
  await p.screenshot({ path: `/home/user/shots/${nama}.png` })
  console.log('terpotret:', nama)
}

await p.goto(BASE, { waitUntil: 'networkidle2' })
await wait(1500)
await tombol('Muat data contoh')
await wait(4000)
await p.evaluate(() => { location.hash = '#/drill' })
await wait(2600)

// Jadikan jalurnya melengkung supaya kedua dasar betul-betul berbeda —
// pada jalur lurus keduanya memberi angka yang sama persis.
await p.evaluate(() => new Promise((res) => {
  const r = indexedDB.open('drillkit')
  r.onsuccess = () => {
    const tx = r.result.transaction('sets', 'readwrite')
    const os = tx.objectStore('sets')
    const q = os.getAll()
    q.onsuccess = () => {
      for (const s of q.result) os.put({ ...s, gerak: { jalur: 'lengkung', lengkung: 1 } })
    }
    tx.oncomplete = res
  }
  r.onerror = res
}))
await p.reload({ waitUntil: 'networkidle2' })
await wait(3000)
await p.evaluate(() => { location.hash = '#/drill' })
await wait(2600)

await tombolJudul('Pengaturan drill')
await wait(1400)
// Gulir supaya blok "Dasar jarak" tampak bersama "Cara menghitung langkah".
await p.evaluate(() => {
  const el = document.querySelector('[data-testid="setelan-jarak"]')
  el?.scrollIntoView({ block: 'center' })
})
await wait(700)
await potret('jarak-1-jarak-tempuh')

await klik('[data-testid="jarak-lurus"]')
await wait(700)
await potret('jarak-2-garis-lurus')

await tombol('Simpan')
await wait(1800)
await potret('jarak-3-dampak-analitik')

await browser.close()
console.log('selesai')
