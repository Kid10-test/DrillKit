/**
 * Tangkapan layar M5 — panjang lagu: kartu progres, tombol ulang, dan
 * batang progres yang terisi sebagian.
 *
 * Digerakkan antarmuka (tidak memakai modul internal) supaya bisa dipakai
 * di dev, produksi, maupun berkas portabel.
 *
 * Pakai: node shot-m5-panjang.mjs [BASE_URL]
 */
import puppeteer from 'puppeteer'

const BASE = process.argv[2] || 'http://localhost:5173'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'],
})
const p = await browser.newPage()
await p.setViewport({ width: 1280, height: 1150, deviceScaleFactor: 2 })
await p.goto(BASE.startsWith('file:') ? BASE : BASE + '/', { waitUntil: 'networkidle2' })
await wait(2500)
await p.evaluate(() => {
  location.hash = '#/musik'
})
await wait(2000)

const isi = async (sel, nilai) => {
  await p.evaluate(
    (s, v) => {
      const el = document.querySelector(s)
      if (!el) return
      const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      set.call(el, String(v))
      el.dispatchEvent(new Event('input', { bubbles: true }))
    },
    sel,
    nilai,
  )
  await wait(450)
}
const klikMengandung = async (lb) => {
  await p.evaluate((x) => {
    ;[...document.querySelectorAll('button')].find((e) => e.textContent.includes(x))?.click()
  }, lb)
  await wait(700)
}
const klikTepat = async (lb) => {
  await p.evaluate((x) => {
    ;[...document.querySelectorAll('button')].find((e) => e.textContent.trim() === x)?.click()
  }, lb)
  await wait(700)
}

/* --------------------- buat lagu ber-tempo map 2 segmen -------------------- */

await klikMengandung('Tambah lagu')
await p.evaluate(() => {
  const m = document.querySelector('[data-testid="modal-lagu"]')
  const i = m?.querySelector('input')
  if (i) {
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    set.call(i, 'Mars Uji — 32 birama')
    i.dispatchEvent(new Event('input', { bubbles: true }))
  }
})
await wait(400)

// Tambah dua segmen tempo supaya durasinya tidak rata (4/4 lalu 7/8).
await p.click('[data-testid="tambah-segmen-bawah"]')
await wait(500)
await p.click('[data-testid="tambah-segmen-bawah"]')
await wait(600)
await klikTepat('Simpan')
await wait(1300)

// Pilih lagunya.
await p.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find(
    (e) =>
      e.textContent.includes('Mars Uji — 32 birama') &&
      e.getAttribute('data-testid')?.startsWith('pilih-lagu-'),
  )
  b?.click()
})
await wait(1200)

// Atur tempo & panjang (menulis ke lagu → tempo diatur ulang sesudahnya).
await isi('[data-testid="bpm"]', 132)
await isi('[data-testid="panjang-lagu"]', 32)
await isi('[data-testid="bpm"]', 132)
await wait(700)

// Mainkan sebentar supaya batang progres terisi sebagian & birama berjalan.
await p.click('[data-testid="tombol-mulai"]')
await wait(4200)
await p.screenshot({
  path: '/home/user/shots/m5-panjang-berjalan.png',
  clip: { x: 0, y: 0, width: 1280, height: 820 },
})
await p.click('[data-testid="tombol-mulai"]')
await wait(500)

// Nyalakan ulang, lalu potret lagi untuk menunjukkan tombol aktif.
await p.click('[data-testid="tombol-ulang"]')
await wait(800)
await p.screenshot({
  path: '/home/user/shots/m5-panjang-ulang.png',
  clip: { x: 0, y: 0, width: 1280, height: 820 },
})

console.log('selesai')
await browser.close()
