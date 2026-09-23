// DD8 — langkah per hitungan di buku saku (dev 5173)
import puppeteer from 'puppeteer'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--mute-audio'] })
const p = await b.newPage()
await p.setViewport({ width: 1440, height: 1000 })
const errs = []
p.on('pageerror', (e) => errs.push(e.message.slice(0, 160)))
p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)) })
const R = {}

const tombol = (t) => p.evaluate((x) => {
  const el = [...document.querySelectorAll('button')].find((y) => y.textContent.trim().includes(x))
  if (!el) return false
  el.click(); return true
}, t)
const centang = (teks, nilai) => p.evaluate((t, v) => {
  const el = [...document.querySelectorAll('label')].find((l) => l.textContent.includes(t))
  const cb = el && el.querySelector('input[type="checkbox"]')
  if (!cb) return false
  if (cb.checked !== v) cb.click()
  return true
}, teks, nilai)
/** Ambil tabel dari iframe pratinjau. */
const bacaPratinjau = async () => {
  await wait(1400)
  for (const f of p.frames()) {
    const html = await f.evaluate(() => (document.body ? document.body.innerHTML : '')).catch(() => '')
    if (html.includes('<table')) {
      return f.evaluate(() => {
        const t = document.querySelector('table')
        if (!t) return null
        const kepala = [...t.querySelectorAll('thead th')].map((th) => th.textContent.trim())
        const baris = [...t.querySelectorAll('tbody tr')]
          .slice(0, 5)
          .map((tr) => [...tr.children].map((td) => td.textContent.trim()))
        const warnaLpc = [...t.querySelectorAll('tbody tr')]
          .slice(0, 5)
          .map((tr) => {
            const td = tr.children[tr.children.length - 1]
            return td ? td.innerHTML : ''
          })
        const legenda = (document.querySelector('.legend') || {}).textContent || null
        return { kepala, baris, warnaLpc, legenda }
      })
    }
  }
  return null
}

await p.goto('http://localhost:5173/', { waitUntil: 'networkidle2' }); await wait(1600)
await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((y) => y.textContent.includes('Muat data contoh')); x && x.click() })
await wait(3400)
await p.evaluate(() => { location.hash = '#/drill' }); await wait(2800)

R.buka = await p.evaluate(() => {
  const el = document.querySelector('[title="Kartu/dot sheet per pemain"]')
  if (!el) return false
  el.click(); return true
})
await wait(1400)
R.adaCentang = await p.evaluate(() =>
  [...document.querySelectorAll('label')].some((l) => l.textContent.includes('Sertakan langkah per hitungan')),
)
// centang menyala bawaan
await tombol('Pratinjau')
R.denganLpc = await bacaPratinjau()

// tutup pratinjau, buka ulang bila perlu, matikan centang
await p.keyboard.press('Escape'); await wait(1200)
if (!(await p.evaluate(() => [...document.querySelectorAll('label')].some((l) => l.textContent.includes('Sertakan langkah per hitungan'))))) {
  await p.evaluate(() => { const el = document.querySelector('[title="Kartu/dot sheet per pemain"]'); el && el.click() })
  await wait(1400)
}
R.setMatikan = await centang('Sertakan langkah per hitungan', false); await wait(700)
await tombol('Pratinjau')
R.tanpaLpc = await bacaPratinjau()

// periksa kebenaran angka: Lk/cnt harus = jarak (langkah) / count
if (R.denganLpc) {
  const k = R.denganLpc.kepala
  const iSet = k.findIndex((x) => x === 'Set')
  const iCnt = k.findIndex((x) => x.toLowerCase() === 'cnt')
  const iLk = k.findIndex((x) => /langkah|→/i.test(x))
  const iLpc = k.findIndex((x) => x.toLowerCase().includes('lk/cnt'))
  R.indeks = { iSet, iCnt, iLk, iLpc }
  R.periksa = R.denganLpc.baris
    .filter((r) => r.length === k.length && r[iLk] && r[iLk] !== '-')
    .map((r) => {
      const langkah = Number(r[iLk])
      const cnt = Number(r[iCnt])
      const lpc = Number(r[iLpc])
      const harap = Math.round((langkah / cnt) * 100) / 100
      return { set: r[iSet], langkah, cnt, lpc, harap, cocok: Math.abs(lpc - harap) < 0.02 }
    })
}
R.error = errs
console.log(JSON.stringify(R, null, 2))
await b.close()
