/**
 * Tangkapan layar — rotasi lingkaran yang pusatnya ikut berjalan.
 *
 * Membuat dua set blok, memutar set 2 sekaligus menggesernya, lalu menyalakan
 * "lingkaran ikut berjalan" dan menekan Hitung. Dipotr et di tengah
 * perpindahan, saat jejaknya menyapu sekaligus terbawa maju.
 */
import puppeteer from 'puppeteer'

const BASE = process.argv[2] || 'http://localhost:5173'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--mute-audio'] })
const p = await b.newPage()
await p.setViewport({ width: 1500, height: 1000, deviceScaleFactor: 2 })
await p.goto(BASE.startsWith('file:') ? BASE : BASE + '/', { waitUntil: 'networkidle2' })
await wait(1600)
await p.evaluate(() => {
  const x = [...document.querySelectorAll('button')].find((y) =>
    y.textContent.includes('Muat data contoh'),
  )
  x && x.click()
})
await wait(3500)
await p.evaluate(() => {
  location.hash = '#/drill'
})
await wait(2800)

const tombol = (t) =>
  p.evaluate((x) => {
    const el = [...document.querySelectorAll('button')].find((y) => y.textContent.trim() === x)
    if (!el || el.disabled) return false
    el.click()
    return true
  }, t)

const setSelect = (lab, val) =>
  p.evaluate(
    (l, v) => {
      const f = [...document.querySelectorAll('label')].find((x) => x.textContent.includes(l))
      const sel = f && f.parentElement.querySelector('select')
      if (!sel) return false
      const set = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set
      set.call(sel, String(v))
      sel.dispatchEvent(new Event('change', { bubbles: true }))
      return true
    },
    lab,
    val,
  )

// Bilah waktu memakai mode per hitungan: rentangnya 0..counts.
const scrub = async (t) => {
  const maks = await p.evaluate(() => {
    const s = document.querySelector('[data-testid="garis-waktu"]')
    return s ? Number(s.max) : 0
  })
  const v = Math.round(t * maks)
  await p.evaluate((n) => {
    const s = document.querySelector('[data-testid="garis-waktu"]')
    if (!s) return
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    set.call(s, String(n))
    s.dispatchEvent(new Event('input', { bubbles: true }))
  }, v)
}

// set 1 = blok
await tombol('Blok')
await wait(1300)
// set 2 = blok sama, lalu diputar & digeser
await p.keyboard.press('BracketRight')
await wait(1500)
await tombol('Blok')
await wait(1300)
await tombol('Kanan ↻')
await wait(1700)
await setSelect('Geser blok', 8)
await wait(700)
await tombol('Ke Side 1')
await wait(1700)
// kembali ke set 1
await p.keyboard.press('BracketLeft')
await wait(1700)

// Nyalakan "lingkaran ikut berjalan", lalu hitung tujuannya.
await p.evaluate(() => document.querySelector('[data-testid="putar-jalan-aktif"]')?.click())
await wait(800)
await p.evaluate(() => document.querySelector('[data-testid="putar-jalan-hitung"]')?.click())
await wait(1400)

const lapor = await p.evaluate(() => {
  const t = (s) => document.querySelector(s)?.textContent.replace(/\s+/g, ' ').trim() ?? null
  return {
    keterangan: t('[data-testid="putar-jalan-keterangan"]'),
    pusatX: document.querySelector('input[aria-label="Pusat putaran, sumbu x (langkah)"]')?.value,
    pusatY: document.querySelector('input[aria-label="Pusat putaran, sumbu y (langkah)"]')?.value,
    x2: document.querySelector('[data-testid="putar-jalan-x2"]')?.value,
    y2: document.querySelector('[data-testid="putar-jalan-y2"]')?.value,
  }
})
console.log('pusat putaran :', lapor.pusatX, ',', lapor.pusatY)
console.log('berpindah ke  :', lapor.x2, ',', lapor.y2)
console.log('keterangan    :', (lapor.keterangan || '').slice(0, 200))

// Potret 1 — keadaan awal (progres 0).
await scrub(0)
await wait(600)
await p.screenshot({ path: '/home/user/shots/putar-jalan-awal.png' })

// Potret 2 — di tengah perpindahan: jejak menyapu sambil terbawa maju.
await scrub(0.5)
await wait(700)
await p.screenshot({ path: '/home/user/shots/putar-jalan-tengah.png' })

// Potret 3 — kartu pengaturnya saja.
const kartu = await p.evaluate(() => {
  const el = document.querySelector('[data-testid="putar-jalan-keterangan"]')
  if (!el) return null
  let n = el
  for (let i = 0; i < 6 && n; i++) n = n.parentElement
  if (!n) return null
  n.scrollIntoView({ block: 'center' })
  const r = n.getBoundingClientRect()
  return { x: Math.max(0, r.x - 12), y: Math.max(0, r.y - 12), width: Math.min(760, r.width + 24), height: Math.min(560, r.height + 24) }
})
await wait(700)
if (kartu) await p.screenshot({ path: '/home/user/shots/putar-jalan-kartu.png', clip: kartu })

console.log('selesai')
await b.close()
