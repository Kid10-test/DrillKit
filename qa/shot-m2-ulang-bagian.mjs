/**
 * Tangkapan layar M2 — ulang bagian.
 *
 * Membuat satu lagu konser, mengatur panjangnya, lalu menyalakan pengulangan
 * bagian 17–24 (delapan birama yang sulit). Dipotr et saat bagian itu
 * sedang diulang.
 *
 * Digerakkan antarmuka — jalan di dev, produksi, maupun berkas portabel.
 *
 * Pakai: node shot-m2-ulang-bagian.mjs [BASE_URL]
 */
import puppeteer from 'puppeteer'

const BASE = process.argv[2] || 'http://localhost:5173'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'],
})
const p = await browser.newPage()
await p.setViewport({ width: 1280, height: 1350, deviceScaleFactor: 2 })
await p.goto(BASE.startsWith('file:') ? BASE : BASE + '/', { waitUntil: 'networkidle2' })
await wait(2500)
await p.evaluate(() => {
  location.hash = '#/musik'
})
await wait(2000)

const klikMengandung = async (lb) => {
  await p.evaluate((x) => {
    ;[...document.querySelectorAll('button')].find((e) => e.textContent.includes(x))?.click()
  }, lb)
  await wait(650)
}
const klikTepat = async (lb) => {
  await p.evaluate((x) => {
    ;[...document.querySelectorAll('button')].find((e) => e.textContent.trim() === x)?.click()
  }, lb)
  await wait(650)
}
const isi = async (sel, v) => {
  await p.evaluate(
    (s, val) => {
      const el = document.querySelector(s)
      if (!el) return
      const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      set.call(el, String(val))
      el.dispatchEvent(new Event('input', { bubbles: true }))
    },
    sel,
    v,
  )
  await wait(420)
}

// Lagu konser: 96 birama @112, meternya 4/4.
await klikMengandung('Tambah lagu')
await p.evaluate(() => {
  const m = document.querySelector('[data-testid="modal-lagu"]')
  const ins = m?.querySelectorAll('input') ?? []
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  if (ins[0]) {
    set.call(ins[0], 'Mars Parade')
    ins[0].dispatchEvent(new Event('input', { bubbles: true }))
  }
  if (ins[2]) {
    set.call(ins[2], '112')
    ins[2].dispatchEvent(new Event('input', { bubbles: true }))
  }
})
await wait(400)
await klikTepat('Simpan')
await wait(1000)

await p.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find(
    (e) => e.textContent.includes('Mars Parade') && e.getAttribute('data-testid')?.startsWith('pilih-lagu-'),
  )
  b?.click()
})
await wait(900)

await isi('[data-testid="panjang-lagu"]', 96)
await isi('[data-testid="ulang-dari"]', 17)
await isi('[data-testid="ulang-sampai"]', 24)
await wait(700)

// Laporkan ringkasannya supaya angka di tangkapan bisa dipastikan.
const ringkas = await p.evaluate(() => {
  const t = (s) => document.querySelector(s)?.textContent.trim() ?? null
  return {
    ringkasan: t('[data-testid="ulang-ringkasan"]'),
    total: t('[data-testid="setlist-total"]'),
    sisa: t('[data-testid="teks-sisa"]'),
    tombol: t('[data-testid="tombol-ulang-bagian"]'),
  }
})
console.log('ringkasan ulang bagian:', ringkas.ringkasan)
console.log('tombol                 :', ringkas.tombol)
console.log('total & sisa lagu      :', ringkas.total, '/', ringkas.sisa)

// Potret keadaan diam (belum menyala).
await p.evaluate(() => {
  document.querySelector('[data-testid="kartu-ulang-bagian"]')?.scrollIntoView({ block: 'center' })
})
await wait(600)
await p.screenshot({
  path: '/home/user/shots/m2-ulang-bagian-diam.png',
  clip: { x: 0, y: 0, width: 1280, height: 950 },
})

// Nyalakan, mainkan, lalu potret sambil mengulang.
await p.click('[data-testid="tombol-ulang-bagian"]')
await wait(600)
await p.click('[data-testid="tombol-mulai"]')
await wait(2600)
await p.evaluate(() => {
  document.querySelector('[data-testid="kartu-ulang-bagian"]')?.scrollIntoView({ block: 'center' })
})
await wait(400)
await p.screenshot({
  path: '/home/user/shots/m2-ulang-bagian-main.png',
  clip: { x: 0, y: 0, width: 1280, height: 950 },
})
const birama = await p.evaluate(
  () => document.querySelector('[data-testid="birama-ke"]')?.textContent.trim() ?? null,
)
console.log('birama saat dipotret   :', birama, '(harap di antara 17–24)')
await p.click('[data-testid="tombol-mulai"]')
await wait(500)

console.log('selesai')
await browser.close()
