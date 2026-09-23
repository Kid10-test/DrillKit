// DD4 lanjutan — busur putaran: apakah radius (dan jarak antar pemain) terjaga?
// Skenario yang benar: set 1 & set 2 dibuat IDENTIK (bentuk cepat "Blok"),
// lalu set 2 diputar 90°. Maka set 1 → set 2 adalah putaran murni.
import puppeteer from 'puppeteer'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--mute-audio'] })
const p = await b.newPage()
await p.setViewport({ width: 1440, height: 1000 })
const errs = []
p.on('pageerror', (e) => errs.push(e.message.slice(0, 160)))
p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)) })
const R = {}

// PENTING: bilah waktu memakai mode per hitungan, jadi rentangnya 0..counts
// dengan step 1 — BUKAN 0..1. Dulu uji ini mengirim 0,25/0,5/0,75 begitu saja,
// yang dibulatkan jadi hitungan nol: titiknya nyaris tidak bergerak, jadi
// rasio radius selalu 1 dan uji ini lolos tanpa menguji apa pun.
const scrub = async (t) => {
  const maks = await p.evaluate(() => {
    const s = document.querySelector('[data-testid="garis-waktu"]')
    return s ? Number(s.max) : 0
  })
  const v = Math.round(t * maks)
  await p.evaluate((n) => {
    const s = document.querySelector('[data-testid="garis-waktu"]')
    if (!s) throw new Error('Bilah waktu tidak ada')
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    set.call(s, String(n)); s.dispatchEvent(new Event('input', { bubbles: true }))
  }, v)
}
const tombol = (t) => p.evaluate((x) => {
  const el = [...document.querySelectorAll('button')].find((y) => y.textContent.trim() === x)
  if (!el || el.disabled) return false
  el.click(); return true
}, t)
const setSelect = (lab, val) => p.evaluate((l, v) => {
  const f = [...document.querySelectorAll('label')].find((x) => x.textContent.includes(l))
  const sel = f && f.parentElement.querySelector('select')
  if (!sel) return false
  const set = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set
  set.call(sel, String(v)); sel.dispatchEvent(new Event('change', { bubbles: true }))
  return true
}, lab, val)
const posisi = () => p.evaluate(() =>
  [...document.querySelectorAll('g.cursor-move')].map((g) => {
    const c = g.querySelector('circle[data-titik="1"]')
    if (!c) return null
    const m = /translate\(([-\d.e]+) ([-\d.e]+)\)/.exec(g.getAttribute('transform') || '')
    return [Number(c.getAttribute('cx')) + (m ? +m[1] : 0), Number(c.getAttribute('cy')) + (m ? +m[2] : 0)]
  }).filter(Boolean),
)
const kePusat = (d) => [d.reduce((a, q) => a + q[0], 0) / d.length, d.reduce((a, q) => a + q[1], 0) / d.length]
/** Perbandingan radius tiap pemain terhadap radius awalnya. 1 = tidak berubah. */
const rasio = (awal, pusat, skrg) =>
  skrg.map((q, i) => Math.hypot(q[0] - pusat[0], q[1] - pusat[1]) / Math.hypot(awal[i][0] - pusat[0], awal[i][1] - pusat[1]))
const ringkas = (r) => ({ min: Math.round(Math.min(...r) * 1000) / 1000, maks: Math.round(Math.max(...r) * 1000) / 1000 })
const teksBusur = () => p.evaluate(() => {
  const el = [...document.querySelectorAll('p')].find((x) => x.textContent.includes('pemain mengikuti'))
  return el ? el.textContent.replace(/\s+/g, ' ').trim() : null
})
const jejak = () => p.evaluate(() => {
  const el = document.querySelector('[data-trail="keluar"]')
  return el ? { tag: el.tagName.toLowerCase(), segmen: ((el.getAttribute('d') || '').match(/L/g) || []).length } : null
})

await p.goto('http://localhost:5173/', { waitUntil: 'networkidle2' }); await wait(1600)
await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((y) => y.textContent.includes('Muat data contoh')); x && x.click() })
await wait(3400)
await p.evaluate(() => { location.hash = '#/drill' }); await wait(2800)

// set 1 = blok
R.blok1 = await tombol('Blok'); await wait(1200)
// set 2 = blok yang sama
await p.keyboard.press('BracketRight'); await wait(1400)
R.blok2 = await tombol('Blok'); await wait(1200)
// putar set 2 → putaran murni dari set 1
R.putar = await tombol('Kanan ↻'); await wait(1600)
await p.keyboard.press('BracketLeft'); await wait(1500)

R.ikutBusur = await teksBusur()
R.jejakBusur = await jejak()

R.gerakPusat = await (async () => {
  await scrub(0); await wait(400)
  const a = await posisi()
  await scrub(1); await wait(400)
  const z = await posisi()
  const c = (d) => [d.reduce((s, q) => s + q[0], 0) / d.length, d.reduce((s, q) => s + q[1], 0) / d.length]
  const [ax, ay] = c(a); const [zx, zy] = c(z)
  return Math.round(Math.hypot(zx - ax, zy - ay) * 100) / 100
})()

async function ukur(label) {
  await scrub(0); await wait(400)
  const A = await posisi()
  const pusat = kePusat(A)
  const out = {}
  for (const t of [0.25, 0.5, 0.75, 1]) {
    await scrub(t); await wait(350)
    out['t' + t] = ringkas(rasio(A, pusat, await posisi()))
  }
  R[label] = out
}
await ukur('busur')
R.setLurus = await setSelect('Bentuk jalur', 'lurus'); await wait(1100)
R.jejakLurus = await jejak()
await ukur('lurus')
R.setBusur = await setSelect('Bentuk jalur', 'busur'); await wait(1100)
R.jejakKembali = await jejak()

R.error = errs

/* Penegasan — dulu berkas ini hanya mencetak angka, jadi tidak pernah ada
   yang memeriksa apakah busur sungguh menjaga radius. */
const catat = []
const wajib = (nama, syarat, ket = '') => { if (!syarat) catat.push(`\u2717 ${nama}${ket ? ' — ' + ket : ''}`) }
wajib('busur menjaga radius di semua progres',
  ['t0.25', 't0.5', 't0.75', 't1'].every((t) => Math.abs(R.busur[t].min - 1) < 0.02 && Math.abs(R.busur[t].maks - 1) < 0.02),
  JSON.stringify(R.busur))
// Jalur lurus HARUS mengkerut di tengah jalan — kalau tidak, berarti uji di
// atas tidak mengukur apa pun. cos(45°/2) = 0,924 untuk putaran 45°.
wajib('pembanding: jalur lurus mengkerutkan blok di tengah jalan',
  Math.abs(R.lurus['t0.5'].min - 0.924) < 0.02, `${R.lurus['t0.5'].min}`)
wajib('jalur lurus tiba di bentuk yang benar', Math.abs(R.lurus['t1'].min - 1) < 0.02, `${R.lurus['t1'].min}`)
wajib('jejak busur berupa path bersegmen', R.jejakBusur && R.jejakBusur.tag === 'path' && R.jejakBusur.segmen > 10, JSON.stringify(R.jejakBusur))
wajib('jejak lurus berupa garis', R.jejakLurus && R.jejakLurus.tag === 'line', JSON.stringify(R.jejakLurus))
wajib('kembali ke busur memulihkan path', R.jejakKembali && R.jejakKembali.tag === 'path', JSON.stringify(R.jejakKembali))
wajib('semua pemain mengikuti busur', /(\d+) dari \1 pemain mengikuti/.test(R.ikutBusur || ''), String(R.ikutBusur).slice(0, 60))
wajib('tanpa error konsol', errs.length === 0, errs.join(' | ').slice(0, 160))

console.log(JSON.stringify(R, null, 2))
if (catat.length) console.log(catat.join('\n'))
else console.log('semua penegasan lolos')
await b.close()
process.exit(catat.length ? 1 : 0)
