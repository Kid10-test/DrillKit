import puppeteer from 'puppeteer'
const BASE = 'http://localhost:5173'
const b = await puppeteer.launch({ args: ['--no-sandbox'], defaultViewport: { width: 1400, height: 1200 } })
const p = await b.newPage()
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
const hari = (n) => { const d = new Date(); d.setDate(d.getDate() + n)
  const f = (x) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${f(d.getMonth() + 1)}-${f(d.getDate())}` }
await p.evaluate(async (kemarin) => {
  const db = await new Promise((res) => { const q = indexedDB.open('drillkit'); q.onsuccess = () => res(q.result) })
  const baris = ['ps_telat','ps_rapi','ps_lupa'].map((id) => ({
    id, title: 'Latihan uji', type: 'latihan', date: kemarin,
    startTime: '08:00', endTime: '10:00', checklist: [], createdAt: Date.now() }))
  await new Promise((res) => { const tx = db.transaction(['sessions'], 'readwrite')
    const s = tx.objectStore('sessions'); baris.forEach((x) => s.put(x)); tx.oncomplete = res })
  db.close()
}, hari(-1))
await wait(600)
await p.goto(`${BASE}/#/jadwal`, { waitUntil: 'networkidle2' })
await wait(2000)
console.log('penanda-*:', await p.evaluate(() => [...document.querySelectorAll('[data-testid^="penanda-"]')].map((e) => e.dataset.testid)))
console.log('mulai-sesi-*:', await p.evaluate(() => [...document.querySelectorAll('[data-testid^="mulai-sesi-"]')].map((e) => e.dataset.testid)))
console.log('isi penanda ps_telat:', await p.evaluate(() => {
  const e = document.querySelector('[data-testid="penanda-ps_telat"]')
  return e ? e.innerText.replace(/\n+/g, ' | ') : 'TIDAK ADA'
}))
console.log('judul sesi di halaman:', await p.evaluate(() => [...document.querySelectorAll('p')].map((e) => e.textContent.trim()).filter((t) => t.includes('Latihan uji'))))
await b.close()
