// Tangkapan layar checklist kemajuan (K3).
// Tujuan: memperlihatkan baris kemajuan dengan beberapa set bercentang dan
// satu set yang masih kosong — keadaan yang dilihat pelatih saat menyambung
// latihan minggu lalu.
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

// Paksa ke set 1 supaya presenter terbuka di awal.
for (let i = 0; i < 4; i += 1) { await p.keyboard.press('BracketLeft'); await wait(500) }
await wait(700)

await tombolJudul('Mode presenter')
await wait(1800)
console.log('presenter terbuka:', await p.$('[data-testid="presenter"]') !== null)
console.log('set awal:', await p.$eval('[data-testid="info-set"]', (e) => e.textContent.trim()))

// 1. Belum ada yang dikuasai.
await potret('kemajuan-1-kosong')

// 2. Centang dua set, sisakan satu — keadaan "sedang berjalan".
await klik('[data-testid="chip-kuasai"]')
await wait(700)
await klik('[data-testid="presenter-berikutnya"]')
await wait(900)
await klik('[data-testid="chip-kuasai"]')
await wait(900)
console.log('ringkasan:', await p.$eval('[data-testid="info-kemajuan"]', (e) => e.textContent.trim()))
await potret('kemajuan-2-dicentang')

// 3. Dengan satu seksi dipilih, chip menyebut seksi itu.
await klik('[data-testid="presenter-berikutnya"]')
await wait(900)
const chips = await p.$$('[data-testid="baris-seksi"] button')
await chips[1].click()
await wait(800)
await klik('[data-testid="chip-kuasai"]')
await wait(800)
await potret('kemajuan-3-per-seksi')

await browser.close()
console.log('selesai')
