// DD9 — scrub per hitungan & tapak langkah (dev 5173)
import puppeteer from 'puppeteer'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--mute-audio', '--allow-file-access-from-files'] })
const p = await b.newPage()
await p.setViewport({ width: 1440, height: 1100 })
const errs = []
p.on('pageerror', (e) => errs.push(e.message.slice(0, 160)))
p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)) })

const teks = (sel) => p.evaluate((s) => document.querySelector(s)?.textContent?.trim() ?? null, sel)

const URL_DASAR = process.argv[2] || 'http://localhost:5173/'
await p.goto(URL_DASAR, { waitUntil: 'networkidle2' }); await wait(1600)
await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((y) => y.textContent.includes('Muat data contoh')); x && x.click() })
await wait(3400)
await p.evaluate(() => { location.hash = '#/drill' }); await wait(2800)

const R = {}

// 1. keadaan bilah waktu
R.bilah = await p.evaluate(() => {
  const s = document.querySelector('[data-testid="garis-waktu"]')
  return s ? { min: s.min, max: s.max, step: s.step } : null
})
R.tombolPerHitungan = await p.evaluate(() => {
  const el = document.querySelector('[data-testid="tombol-perhitungan"]')
  return el ? { teks: el.textContent.trim(), menyala: el.className.includes('bg-emerald') || el.className.includes('sky') } : null
})

// 2. melangkah dengan tombol '.' — hitungan harus naik & titik bergerak
const posisiTitik = () => p.evaluate(() => {
  const g = document.querySelector('circle[data-titik="1"]')?.closest('g[transform], g')
  return g?.getAttribute('transform') ?? null
})
R.posAwal = await posisiTitik()
for (let i = 0; i < 3; i++) { await p.keyboard.press('.'); await wait(500) }
R.hitunganSetelah3 = await teks('[data-live-count]')
R.posSetelah3 = await posisiTitik()
await p.keyboard.press(','); await wait(500)
R.hitunganSetelahKurang1 = await teks('[data-live-count]')

// 3. tapak langkah: pilih satu titik lalu nyalakan
const ling = await p.$$('circle[data-titik="1"]')
await ling[0].click(); await wait(800)
R.tapakSebelum = await p.evaluate(() => document.querySelectorAll('[data-tapak] circle').length)
R.nyalakanTapak = await p.evaluate(() => {
  const el = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Tapak langkah'))
  if (!el) return false
  el.click(); return true
})
await wait(900)
R.tapakSesudah = await p.evaluate(() => document.querySelectorAll('[data-tapak] circle').length)

// 4. bandingkan dengan jumlah langkah di panel Detail pemain yang sama
await p.evaluate(() => { const el = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Detail'); el && el.click() })
await wait(1500)
R.detail = await p.evaluate(() => {
  const j = [...document.querySelectorAll('h2,h3')].find((h) => (h.textContent || '').startsWith('Detail —'))
  const k = j?.closest('div[class*="rounded"]')?.parentElement?.parentElement
  const t = k?.querySelector('table')
  const tr = t?.querySelector('tbody tr')
  return tr ? [...tr.children].map((td) => td.textContent.trim()) : null
})
await p.keyboard.press('Escape'); await wait(900)

// 5. tanpa pilihan, tapak tidak boleh membanjiri papan
await p.keyboard.press('Escape'); await wait(600)
await p.evaluate(() => {
  const svg = document.querySelector('svg')
  svg?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 5, clientY: 5 }))
})
await wait(800)
R.tapakTanpaPilihan = await p.evaluate(() => document.querySelectorAll('[data-tapak] circle').length)

// 6. mode menyesuaikan harus mengubah jumlah tapak (pilih titik lagi dulu)
await p.evaluate(() => { const el = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '⚙'); el && el.click() })
await wait(1200)
await p.evaluate(() => { const el = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Langkah ikut hitungan'); el && el.click() })
await wait(800)
await p.evaluate(() => { const el = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Simpan'); el && el.click() })
await wait(1700)
R.tapakSebelumPilih = await p.evaluate(() => document.querySelectorAll('[data-tapak] circle').length)
const ling2 = await p.$$('circle[data-titik="1"]')
await ling2[0].click(); await wait(1000)
R.tapakModeSesuai = await p.evaluate(() => document.querySelectorAll('[data-tapak] circle').length)

R.error = errs
console.log(JSON.stringify(R, null, 2))
await b.close()
