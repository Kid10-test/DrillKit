// DD10b — timpa mode langkah per pemain per perpindahan (panel Detail, dev 5173)
import puppeteer from 'puppeteer'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--mute-audio'] })
const p = await b.newPage()
await p.setViewport({ width: 1440, height: 1000 })
const errs = []
p.on('pageerror', (e) => errs.push(e.message.slice(0, 160)))
p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)) })
const R = {}

/** Baris tabel gerak di dalam panel Detail. */
const bacaTabel = () => p.evaluate(() => {
  const j = [...document.querySelectorAll('h2,h3')].find((h) => (h.textContent || '').startsWith('Detail —'))
  if (!j) return null
  const k = j.closest('div[class*="rounded"]')?.parentElement?.parentElement
  if (!k) return null
  const t = k.querySelector('table')
  if (!t) return null
  return {
    kepala: [...t.querySelectorAll('thead th')].map((x) => x.textContent.trim()),
    baris: [...t.querySelectorAll('tbody tr')].slice(0, 3).map((tr) =>
      [...tr.children].map((td) => td.textContent.trim()),
    ),
  }
})

/** Klik tombol mode pada baris ke-n (0 = baris pertama). */
const klikMode = (n) => p.evaluate((i) => {
  const j = [...document.querySelectorAll('h2,h3')].find((h) => (h.textContent || '').startsWith('Detail —'))
  const k = j?.closest('div[class*="rounded"]')?.parentElement?.parentElement
  const t = k?.querySelector('table')
  const tr = t?.querySelectorAll('tbody tr')[i]
  const tombol = tr?.querySelector('td:last-child button')
  if (!tombol) return null
  const sebelum = tombol.textContent.trim()
  tombol.click()
  return sebelum
}, n)

await p.goto('http://localhost:5173/', { waitUntil: 'networkidle2' }); await wait(1600)
await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((y) => y.textContent.includes('Muat data contoh')); x && x.click() })
await wait(3400)
await p.evaluate(() => { location.hash = '#/drill' }); await wait(2800)

// pilih satu titik lalu buka Detail
const ling = await p.$$('circle[data-titik="1"]')
R.titik = ling.length
await ling[0].click(); await wait(900)
R.buka = await p.evaluate(() => {
  const el = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Detail')
  if (!el) return false
  el.click(); return true
})
await wait(1500)
R.awal = await bacaTabel()

// siklus: drill -> tetap -> hitungan -> drill
R.langkah1 = await klikMode(0); await wait(1300)
R.setelahTetap = await bacaTabel()
R.langkah2 = await klikMode(0); await wait(1300)
R.setelahHitungan = await bacaTabel()
R.langkah3 = await klikMode(0); await wait(1300)
R.setelahKembali = await bacaTabel()

// tutup lalu buka lagi — harus tetap tersimpan
await p.keyboard.press('Escape'); await wait(1200)
await p.evaluate(() => { const el = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Detail'); el && el.click() })
await wait(1400)

// setel ke "hitungan" lalu tutup-buka untukuji simpan
R.langkah4 = await klikMode(0); await wait(1200)
R.setelahSimpan = await bacaTabel()
await p.keyboard.press('Escape'); await wait(1200)
const ling2 = await p.$$('circle[data-titik="1"]')
await ling2[0].click(); await wait(800)
await p.evaluate(() => { const el = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Detail'); el && el.click() })
await wait(1500)
R.setelahBukaLagi = await bacaTabel()

const ringkas = (d) => d && { kepala: d.kepala.join(' | '), baris: d.baris.slice(0, 2) }
console.log(JSON.stringify({
  titik: R.titik,
  buka: R.buka,
  awal: ringkas(R.awal),
  siklus: [R.langkah1, R.langkah2, R.langkah3, R.langkah4],
  setelahTetap: ringkas(R.setelahTetap),
  setelahHitungan: ringkas(R.setelahHitungan),
  setelahKembali: ringkas(R.setelahKembali),
  setelahBukaLagi: ringkas(R.setelahBukaLagi),
  error: errs,
}, null, 2))
await b.close()
