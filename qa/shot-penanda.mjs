// Tangkap G3 (penanda mulai/selesai sesi): rekap + kartu sesi.
import puppeteer from 'puppeteer'
const BASE = process.argv[2] ?? 'http://localhost:4173'
const b = await puppeteer.launch({ args: ['--no-sandbox'], defaultViewport: { width: 1400, height: 1400 } })
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
await p.goto(`${BASE}/#/jadwal`, { waitUntil: 'networkidle2' })
await wait(1500)

const hari = (n) => { const d = new Date(); d.setDate(d.getDate() + n)
  const f = (x) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${f(d.getMonth() + 1)}-${f(d.getDate())}` }

await p.evaluate(async (kemarin) => {
  const db = await new Promise((res) => { const q = indexedDB.open('drillkit'); q.onsuccess = () => res(q.result) })
  const ep = (tgl, jam) => {
    const [h, m] = jam.split(':').map(Number)
    const [Y, M, D] = tgl.split('-').map(Number)
    return new Date(Y, M - 1, D, h, m, 0, 0).getTime()
  }
  const dasar = { title: 'Latihan gabungan', type: 'latihan', checklist: [], createdAt: Date.now() }
  const baris = [
    { ...dasar, id: 'psh1', date: kemarin, startTime: '08:00', endTime: '10:00',
      mulaiNyata: ep(kemarin, '08:12'), selesaiNyata: ep(kemarin, '10:04') },
    { ...dasar, id: 'psh2', date: kemarin, startTime: '13:00', endTime: '15:00',
      mulaiNyata: ep(kemarin, '13:00'), selesaiNyata: ep(kemarin, '15:02') },
    { ...dasar, id: 'psh3', date: kemarin, startTime: '19:00', endTime: '21:00' },
  ]
  await new Promise((res) => {
    const tx = db.transaction(['sessions'], 'readwrite')
    const s = tx.objectStore('sessions')
    s.clear(); baris.forEach((x) => s.put(x)); tx.oncomplete = res
  })
  db.close()
}, hari(-1))
await wait(600)
await p.reload({ waitUntil: 'networkidle2' })
await wait(2500)
await p.screenshot({ path: '/home/user/shots/penanda-jadwal.jpg', type: 'jpeg', quality: 80 })

console.log('--- rekap ---')
console.log(await p.evaluate(() => {
  const e = document.querySelector('[data-testid="rekap-penanda"]')
  return e ? e.innerText.replace(/\s*\n\s*/g, ' | ') : 'TIDAK ADA'
}))
console.log('--- kartu sesi pertama ---')
console.log(await p.evaluate(() => {
  const e = document.querySelector('[data-testid="penanda-psh1"]')
  return e ? e.innerText.replace(/\s*\n\s*/g, ' | ') : 'TIDAK ADA'
}))
console.log('--- kartu sesi tanpa penanda ---')
console.log(await p.evaluate(() => {
  const e = document.querySelector('[data-testid="penanda-psh3"]')
  return e ? e.innerText.replace(/\s*\n\s*/g, ' | ') : 'TIDAK ADA'
}))
console.log('selesai')
await b.close()
