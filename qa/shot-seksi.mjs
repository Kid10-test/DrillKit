// Tangkapan layar mode latihan per seksi (K2).
// Tujuan: memperlihatkan SATU frame di mana seksi yang dipilih terang dan
// bergerak, sementara seksi lain redup diam sebagai acuan posisi.
// Alur persiapan meniru asisten-seksi.mjs (yang sudah lolos), supaya
// nama tombol dan jeda waktunya sama persis.
import puppeteer from 'puppeteer'
import fs from 'node:fs'

const BASE = process.env.BASE || 'http://localhost:5173'
const browser = await puppeteer.launch({
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  defaultViewport: { width: 1440, height: 900 },
})
const p = await browser.newPage()
p.on('console', (m) => { if (m.type() === 'error') console.log('KONSOL:', m.text()) })
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

const tombol = (teks) =>
  p.evaluate((t) => {
    const x = [...document.querySelectorAll('button')].find((y) => y.textContent.includes(t))
    if (!x) return false
    x.click()
    return true
  }, teks)
// Judul tombol bisa panjang ("Mode presenter — layar penuh…"), jadi dicocokkan
// sebagian; tombol yang dinonaktifkan dianggap tidak ada.
const tombolJudul = (judul) =>
  p.evaluate((t) => {
    const x = [...document.querySelectorAll('button')].find((y) =>
      (y.getAttribute('title') || '').includes(t))
    if (!x || x.disabled) return false
    x.click()
    return true
  }, judul)
const klik = async (sel) => { await p.waitForSelector(sel, { timeout: 10000 }); await p.click(sel) }

// — Persiapan: data contoh, lalu tambah dan geser set ke-3 (8 langkah).
await p.goto(BASE, { waitUntil: 'networkidle2' })
await wait(1600)
await tombol('Muat data contoh')
await wait(3600)
await p.evaluate(() => { location.hash = '#/drill' })
await wait(2800)

await p.keyboard.press('BracketRight')
await wait(1400)
await tombol('Set baru')
await wait(1800)
await p.evaluate(() => {
  const lab = [...document.querySelectorAll('label')].find((x) => x.textContent.includes('Geser blok'))
  const sel = lab?.parentElement?.querySelector('select')
  if (!sel) return false
  const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set
  set.call(sel, '8')
  sel.dispatchEvent(new Event('change', { bubbles: true }))
  return true
})
await wait(700)
await tombol('Ke depan')
await wait(1500)

// Nama set yang enak dilihat, dan count 4 supaya gerakannya cepat.
const isi = (label, nilai) =>
  p.evaluate(([lb, nl]) => {
    const lab = [...document.querySelectorAll('label')].find((x) => x.textContent.includes(lb))
    const el = lab?.parentElement?.querySelector('input')
    if (!el) return false
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    set.call(el, String(nl))
    el.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  }, [label, nilai])
await isi('Count ke set berikutnya', 4)
await wait(800)
await p.keyboard.press('BracketLeft')
await wait(1500)
await isi('Count ke set berikutnya', 4)
await wait(900)
await isi('Nama set', 'Blok ke Busur')
await wait(900)

fs.mkdirSync('/home/user/shots', { recursive: true })
const potret = async (nama) => {
  await p.screenshot({ path: `/home/user/shots/${nama}.png` })
  console.log('terpotret:', nama)
}

const judul = await p.evaluate(() =>
  [...document.querySelectorAll('button[title]')].map((b) => b.title).filter(Boolean))
console.log('judul tombol:', JSON.stringify(judul))
const bukaPresenter = await tombolJudul('Mode presenter')
await wait(1600)
console.log('presenter terbuka:', bukaPresenter)
console.log('elemen presenter ada:', await p.$('[data-testid="presenter"]') !== null)
console.log('baris seksi ada:', await p.$('[data-testid="baris-seksi"]') !== null)
// Keadaan awal: semua seksi terang.
await potret('seksi-1-semua')

// Pilih satu seksi — tampak kontras terang/redup dengan jelas.
const chips = await p.$$('[data-testid="baris-seksi"] button')
console.log('jumlah chip seksi:', chips.length)
await chips[1].click()   // chips[0] = "Semua", jadi ambil seksi pertama
await wait(900)
await potret('seksi-2-dipilih')

// Sedang berjalan: seksi terpilih benar-benar bergerak, sisanya diam.
await klik('[data-testid="tombol-urutan"]')
await wait(1500)
await potret('seksi-3-bergerak')

await browser.close()
console.log('selesai')
