// Diagnostik: apakah scrub benar-benar menggerakkan titik, dan berapa jauh?
import puppeteer from 'puppeteer'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--mute-audio'] })
const p = await b.newPage()
await p.setViewport({ width: 1440, height: 1000 })
const R = {}

// PENTING: bilah waktu memakai mode per hitungan, jadi rentangnya 0..counts
// (bukan 0..1). Nilainya harus dibulatkan ke hitungan terdekat.
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
    set.call(s, String(n))
    s.dispatchEvent(new Event('input', { bubbles: true }))
  }, v)
}
const tombol = (t) =>
  p.evaluate((x) => {
    const el = [...document.querySelectorAll('button')].find((y) => y.textContent.trim() === x)
    if (!el || el.disabled) return false
    el.click()
    return true
  }, t)
const posisi = () =>
  p.evaluate(() =>
    [...document.querySelectorAll('g.cursor-move')]
      .map((g) => {
        const c = g.querySelector('circle[data-titik="1"]')
        if (!c) return null
        const m = /translate\(([-\d.e]+) ([-\d.e]+)\)/.exec(g.getAttribute('transform') || '')
        return [
          Number(c.getAttribute('cx')) + (m ? +m[1] : 0),
          Number(c.getAttribute('cy')) + (m ? +m[2] : 0),
        ]
      })
      .filter(Boolean),
  )
const pusat = (d) => [
  d.reduce((a, q) => a + q[0], 0) / d.length,
  d.reduce((a, q) => a + q[1], 0) / d.length,
]

await p.goto('http://localhost:5173/', { waitUntil: 'networkidle2' })
await wait(1600)
await p.evaluate(() => {
  const x = [...document.querySelectorAll('button')].find((y) =>
    y.textContent.includes('Muat data contoh'),
  )
  x && x.click()
})
await wait(3400)
await p.evaluate(() => {
  location.hash = '#/drill'
})
await wait(2800)

R.jumlahSetAwal = await p.evaluate(
  () => document.querySelectorAll('[data-set-item]').length || document.querySelectorAll('button[data-kiosk-allow]').length,
)
R.blok1 = await tombol('Blok')
await wait(1300)
await p.keyboard.press('BracketRight')
await wait(1500)
R.blok2 = await tombol('Blok')
await wait(1300)
R.putar = await tombol('Kanan ↻')
await wait(1700)
R.geser = await tombol('Ke Side 1')
await wait(1600)
await p.keyboard.press('BracketLeft')
await wait(1600)

R.jumlahTitik = (await posisi()).length
R.maksScrub = await p.evaluate(() => {
  const s = document.querySelector('[data-testid="garis-waktu"]')
  return s ? { min: s.min, max: s.max, step: s.step } : null
})

const cuplikan = {}
for (const t of [0, 0.25, 0.5, 0.75, 1]) {
  await scrub(t)
  await wait(450)
  const P = await posisi()
  cuplikan['t' + t] = {
    n: P.length,
    pusat: pusat(P).map((v) => Math.round(v * 100) / 100),
    tiga: P.slice(0, 3).map((q) => q.map((v) => Math.round(v * 100) / 100)),
  }
}
R.cuplikan = cuplikan
R.pusatBergerak =
  Math.round(Math.hypot(cuplikan.t1.pusat[0] - cuplikan.t0.pusat[0], cuplikan.t1.pusat[1] - cuplikan.t0.pusat[1]) * 100) / 100

// Apakah ada busur terpasang?
R.keterangan = await p.evaluate(() => {
  const el = document.querySelector('[data-testid="putar-jalan-keterangan"]')
  return el ? el.textContent.replace(/\s+/g, ' ').trim().slice(0, 160) : null
})
R.jejak = await p.evaluate(() => {
  const el = document.querySelector('[data-trail="keluar"]')
  return el ? { tag: el.tagName.toLowerCase(), segmen: ((el.getAttribute('d') || '').match(/L/g) || []).length } : null
})

console.log(JSON.stringify(R, null, 2))
await b.close()
