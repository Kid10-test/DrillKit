import puppeteer from 'puppeteer'
const BASE = 'http://localhost:4173'
const b = await puppeteer.launch({ args: ['--no-sandbox'], defaultViewport: { width: 1400, height: 1050 } })
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

await p.evaluate(async () => {
  const db = await new Promise((res, rej) => {
    const q = indexedDB.open('drillkit'); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error)
  })
  const anggota = await new Promise((res) => {
    const q = db.transaction(['members'], 'readonly').objectStore('members').getAll()
    q.onsuccess = () => res(q.result)
  })
  const a = anggota.slice(0, 3)
  const s = Date.now()
  const baris = []
  if (a[0]) {
    baris.push({ id: 'ev_r1', memberId: a[0].id, tanggal: '2026-08-01',
      nilai: { teknik: 3, musikalitas: 2, kedisiplinan: 3 }, catatan: 'Teknik dasar belum stabil.', createdAt: s })
    baris.push({ id: 'ev_r2', memberId: a[0].id, tanggal: '2026-09-01',
      nilai: { teknik: 4, musikalitas: 4, kedisiplinan: 4 }, catatan: 'Sudah jauh lebih rapi.', createdAt: s + 1 })
  }
  if (a[1]) baris.push({ id: 'ev_r3', memberId: a[1].id, tanggal: '2026-09-01',
    nilai: { teknik: 5, musikalitas: 5, kerjasama: 5 }, catatan: '', createdAt: s + 2 })
  if (a[2]) baris.push({ id: 'ev_r4', memberId: a[2].id, tanggal: '2026-09-01',
    nilai: { teknik: 2, musikalitas: 2, kedisiplinan: 2, kerjasama: 2 }, catatan: 'Perlu pendampingan.', createdAt: s + 3 })
  await new Promise((res) => {
    const tx = db.transaction(['evaluasi'], 'readwrite')
    baris.forEach((x) => tx.objectStore('evaluasi').put(x))
    tx.oncomplete = res
  })
  db.close()
})
await p.goto(`${BASE}/#/evaluasi`, { waitUntil: 'networkidle2' })
await wait(2000)

console.log('JUDUL:', await p.$eval('h1,h2', (e) => e.textContent.trim()))
console.log('--- baris yang punya nilai ---')
console.log(await p.evaluate(() => [...document.querySelectorAll('[data-testid^="baris-"]')]
  .map((r) => r.innerText.replace(/\s*\n+\s*/g, ' | ').replace(/ {2,}/g, ' ').trim())
  .filter((t) => !/^[^|]*\| — \| — \| —/.test(t))
  .slice(0, 6).join('\n')))
console.log('--- contoh baris tanpa nilai ---')
console.log(await p.evaluate(() => {
  const r = [...document.querySelectorAll('[data-testid^="baris-"]')].slice(-1)[0]
  return r ? r.innerText.replace(/\s*\n+\s*/g, ' | ').replace(/ {2,}/g, ' ').trim() : '-'
}))
console.log('--- ringkasan tim ---')
console.log(await p.evaluate(() => {
  const k = [...document.querySelectorAll('[class*="rounded"]')]
    .filter((e) => /rata-rata tim|perlu perhatian/i.test(e.innerText) && e.innerText.length < 200)
  return [...new Set(k.map((e) => e.innerText.replace(/\s*\n\s*/g, ' = ').trim()))].slice(0, 4).join('\n')
}))
await b.close()
