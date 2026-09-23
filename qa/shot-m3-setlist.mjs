/**
 * Tangkapan layar M3 — set list.
 *
 * Membuat tiga lagu, menyusunnya jadi set list, lalu memotret kartunya
 * (sekali diam, sekali sambil memutar lagu kedua supaya sorotannya kelihatan).
 *
 * Digerakkan antarmuka — jalan di dev, produksi, maupun berkas portabel.
 *
 * Pakai: node shot-m3-setlist.mjs [BASE_URL]
 */
import puppeteer from 'puppeteer'

const BASE = process.argv[2] || 'http://localhost:5173'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'],
})
const p = await browser.newPage()
await p.setViewport({ width: 1280, height: 1250, deviceScaleFactor: 2 })
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

/** Buat lagu: judul, tempo, dan panjang birama. */
async function buatLagu(judul, bpm, birama) {
  await klikMengandung('Tambah lagu')
  await p.evaluate(
    (j, b) => {
      const m = document.querySelector('[data-testid="modal-lagu"]')
      const ins = m?.querySelectorAll('input') ?? []
      const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      if (ins[0]) {
        set.call(ins[0], j)
        ins[0].dispatchEvent(new Event('input', { bubbles: true }))
      }
      if (ins[2]) {
        set.call(ins[2], String(b))
        ins[2].dispatchEvent(new Event('input', { bubbles: true }))
      }
    },
    judul,
    bpm,
  )
  await wait(400)
  await klikTepat('Simpan')
  await wait(900)
  // Pilih lalu isi panjangnya.
  await p.evaluate((j) => {
    const b = [...document.querySelectorAll('button')].find(
      (e) => e.textContent.includes(j) && e.getAttribute('data-testid')?.startsWith('pilih-lagu-'),
    )
    b?.click()
  }, judul)
  await wait(800)
  await isi('[data-testid="panjang-lagu"]', birama)
}

await buatLagu('1. Pembuka', 132, 32)
await buatLagu('2. Ballad', 72, 24)
await buatLagu('3. Penutup', 148, 40)

// Susun set list.
await klikMengandung('Baru')
await wait(700)
await isi('[data-testid="setlist-nama"]', 'Show 2026 — Putaran Musik')

for (const j of ['1. Pembuka', '2. Ballad', '3. Penutup']) {
  const v = await p.$$eval(
    '[data-testid="setlist-pilih-tambah"] option',
    (o, judul) => {
      const x = o.find((q) => q.textContent.trim() === judul)
      return x ? x.value : null
    },
    j,
  )
  if (v === null) continue
  await p.select('[data-testid="setlist-pilih-tambah"]', v)
  await wait(350)
  await p.click('[data-testid="setlist-tambah"]')
  await wait(700)
}

// Laporkan isi kartunya supaya angka di tangkapan layar bisa dipastikan.
const ringkas = await p.evaluate(() => {
  const t = (s) => document.querySelector(s)?.textContent.trim() ?? null
  return {
    jumlah: t('[data-testid="setlist-jumlah"]'),
    total: t('[data-testid="setlist-total"]'),
    baris: [...document.querySelectorAll('[data-testid^="setlist-baris-"]')].map((e) =>
      e.textContent.replace(/\s+/g, ' ').trim(),
    ),
  }
})
console.log('isi kartu set list:')
console.log('  jumlah lagu :', ringkas.jumlah)
console.log('  total durasi:', ringkas.total)
ringkas.baris.forEach((b) => console.log('   ·', b))

// Potret keadaan diam: gulir ke kartu set list.
await p.evaluate(() => {
  document.querySelector('[data-testid="kartu-setlist"]')?.scrollIntoView({ block: 'center' })
})
await wait(700)
await p.screenshot({
  path: '/home/user/shots/m3-setlist-diam.png',
  clip: { x: 0, y: 0, width: 1280, height: 900 },
})

// Potret sambil memutar lagu kedua — sorotan & statusnya kelihatan.
await p.click('[data-testid="setlist-mainkan-1"]')
await wait(1800)
await p.evaluate(() => {
  document.querySelector('[data-testid="kartu-setlist"]')?.scrollIntoView({ block: 'center' })
})
await wait(500)
await p.screenshot({
  path: '/home/user/shots/m3-setlist-main.png',
  clip: { x: 0, y: 0, width: 1280, height: 900 },
})
await p.click('[data-testid="setlist-mainkan-1"]')
await wait(500)

console.log('selesai')
await browser.close()
