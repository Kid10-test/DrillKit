/**
 * Tangkapan layar — ambang kesulitan gerak yang bisa diatur.
 *
 * Dua potret: kartu baru di Pengaturan, dan panel Analitik gerakan yang kini
 * menampilkan baris "Langkah terbesar" — baris yang dulu tidak ada, padahal
 * buku saku mencetaknya.
 */
import puppeteer from 'puppeteer'

const BASE = process.argv[2] || 'http://localhost:5173'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--mute-audio'] })
const p = await b.newPage()
await p.setViewport({ width: 1440, height: 1200, deviceScaleFactor: 2 })
await p.goto(BASE.startsWith('file:') ? BASE : BASE + '/', { waitUntil: 'networkidle2' })
await wait(1600)
await p.evaluate(() => {
  const x = [...document.querySelectorAll('button')].find((y) =>
    y.textContent.includes('Muat data contoh'),
  )
  x && x.click()
})
await wait(3600)

const keHalaman = async (hash) => {
  await p.evaluate((h) => {
    location.hash = h
  }, hash)
  await wait(2600)
}

/** Potret satu elemen saja. */
async function potret(selector, berkas, pad = 14) {
  const kotak = await p.evaluate(
    (s, pd) => {
      const el = document.querySelector(s)
      if (!el) return null
      el.scrollIntoView({ block: 'center' })
      const r = el.getBoundingClientRect()
      return {
        x: Math.max(0, r.x - pd),
        y: Math.max(0, r.y - pd),
        width: Math.min(1400, r.width + pd * 2),
        height: Math.min(1000, r.height + pd * 2),
      }
    },
    selector,
    pad,
  )
  if (!kotak) return false
  await wait(700)
  await p.screenshot({ path: berkas, clip: kotak })
  return true
}

/* ---------------- Kartu ambang di Pengaturan ---------------- */
await keHalaman('#/pengaturan')
await potret('[data-testid="kartu-ambang-gerak"]', '/home/user/shots/ambang-pengaturan.png', 18)

const nilai = await p.evaluate(() => {
  const baca = (s) => document.querySelector(s)?.value ?? null
  return {
    perMenit: [
      baca('[data-testid="ambang-perMenit-padat"]'),
      baca('[data-testid="ambang-perMenit-berat"]'),
      baca('[data-testid="ambang-perMenit-mustahil"]'),
    ],
    inci: [
      baca('[data-testid="ambang-inci-padat"]'),
      baca('[data-testid="ambang-inci-berat"]'),
      baca('[data-testid="ambang-inci-mustahil"]'),
    ],
  }
})
console.log('ambang kecepatan    :', nilai.perMenit.join(' / '))
console.log('ambang ukuran langkah:', nilai.inci.join(' / '))

/* ---------------- Panel analitik di editor drill ---------------- */
await keHalaman('#/drill')
const sebelum = await p.evaluate(() => {
  const el = document.querySelector('[data-testid="analitik-ukuran-langkah"]')
  return el ? el.textContent.replace(/\s+/g, ' ').trim() : null
})
console.log('analitik (bawaan)   :', sebelum)
await potret(
  '[data-testid="analitik-ukuran-langkah"]',
  '/home/user/shots/ambang-analitik.png',
  90,
)

/* ---------------- Kartu analitik utuh ---------------- */
await p.evaluate(() => {
  const el = document.querySelector('[data-testid="analitik-ukuran-langkah"]')
  if (!el) return
  let n = el
  for (let i = 0; i < 5 && n; i++) n = n.parentElement
  n?.scrollIntoView({ block: 'center' })
})
await wait(800)
await p.screenshot({
  path: '/home/user/shots/ambang-analitik-kartu.png',
  clip: { x: 0, y: 0, width: 760, height: 900 },
})

console.log('selesai')
await b.close()
