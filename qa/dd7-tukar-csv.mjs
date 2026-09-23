// DD7 — impor/ekspor koordinat CSV (dev 5173)
import puppeteer from 'puppeteer'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--mute-audio', '--allow-file-access-from-files'] })
const p = await b.newPage()
await p.setViewport({ width: 1440, height: 1100 })
const errs = []
p.on('pageerror', (e) => errs.push(e.message.slice(0, 160)))
p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)) })

const klik = (teks) => p.evaluate((t) => {
  const el = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === t)
  if (!el) return false
  el.click(); return true
}, teks)

/** Isi textarea (React-compatible). */
const ketik = (teks) => p.evaluate((v) => {
  const el = document.querySelector('textarea')
  if (!el) return false
  const set = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
  set.call(el, v)
  el.dispatchEvent(new Event('input', { bubbles: true }))
  return true
}, teks)

const jumlahSet = () => p.evaluate(() => {
  const el = [...document.querySelectorAll('span')].find((s) => /^\d+\/\d+$/.test(s.textContent.trim()))
  return el ? Number(el.textContent.trim().split('/')[1]) : null
})

const URL_DASAR = process.argv[2] || 'http://localhost:5173/'
await p.goto(URL_DASAR, { waitUntil: 'networkidle2' }); await wait(1600)
await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((y) => y.textContent.includes('Muat data contoh')); x && x.click() })
await wait(3400)
await p.evaluate(() => { location.hash = '#/drill' }); await wait(2800)

const R = {}
R.setAwal = await jumlahSet()

// ambil kode anggota dari pilihan di jendela kartu
await p.evaluate(() => { const el = document.querySelector('[title="Kartu/dot sheet per pemain"]'); el && el.click() })
await wait(1300)
R.kode = await p.evaluate(() => {
  // <select> anggota: nilainya id berawalan "m_", teksnya "KODE — Nama"
  const sel = [...document.querySelectorAll('select')].find((s) =>
    [...s.options].some((o) => o.value.startsWith('m_')),
  )
  if (!sel) return []
  // teks opsinya "KODE — Nama"; yang dipakai CSV adalah KODE-nya
  return [...sel.options]
    .filter((o) => o.value && o.value !== 'all')
    .slice(0, 3)
    .map((o) => o.textContent.split('—')[0].trim())
})
await p.keyboard.press('Escape'); await wait(1000)

// buka jendela tukar CSV
R.buka = await klik('CSV'); await wait(1200)
R.judul = await p.evaluate(() => {
  const h = [...document.querySelectorAll('h2,h3')].find((x) => /Tukar formasi/.test(x.textContent || ''))
  return h ? h.textContent.trim() : null
})

// tempel CSV bentuk lebar
const csv = ['Kode,Nama,Set A X,Set A Y,Set B X,Set B Y']
R.kode.forEach((k, i) => {
  csv.push(`${k},Pemain ${i + 1},${-8 + i * 2},${12 + i},${-4 + i * 2},${20 + i}`)
})
R.csv = csv.join('\n')
R.ketik = await ketik(R.csv)
await wait(1200)

R.pratinjau = await p.evaluate(() => {
  const h = [...document.querySelectorAll('h2,h3')].find((x) => /Tukar formasi/.test(x.textContent || ''))
  const k = h?.closest('div[class*="rounded"]')?.parentElement?.parentElement
  if (!k) return null
  const ps = [...k.querySelectorAll('p')].map((e) => e.innerText.trim()).filter(Boolean)
  const t = k.querySelector('table')
  return {
    ringkasan: ps.find((x) => /Bentuk/.test(x)) ?? null,
    asing: ps.find((x) => /tidak cocok/.test(x)) ?? null,
    baris: t ? [...t.querySelectorAll('tbody tr')].slice(0, 3).map((tr) => [...tr.children].map((td) => td.textContent.trim())) : null,
    kepala: t ? [...t.querySelectorAll('thead th')].map((th) => th.textContent.trim()) : null,
  }
})

// terapkan — buat set baru
R.tombol = await p.evaluate(() => {
  const el = [...document.querySelectorAll('button')].find((b) => /^Buat \d+ set baru$/.test(b.textContent.trim()))
  return el ? { teks: el.textContent.trim(), aktif: !el.disabled } : null
})
await p.evaluate(() => {
  const el = [...document.querySelectorAll('button')].find((b) => /^Buat \d+ set baru$/.test(b.textContent.trim()))
  el && el.click()
})
await wait(2200)
R.setSesudah = await jumlahSet()

// ---- fase 2: timpa set aktif (jalur yang bisa merusak data) ----
R.setSebelumTimpa = await jumlahSet()
R.buka2 = await klik('CSV'); await wait(1200)
const csv2 = ['Kode;Nama;Posisi Baru X;Posisi Baru Y']
R.kode.forEach((k, i) => csv2.push(`${k};Pemain ${i + 1};${4 + i};${30 + i}`))
R.ketik2 = await ketik(csv2.join('\n')); await wait(1200)
R.pratinjau2 = await p.evaluate(() => {
  const h = [...document.querySelectorAll('h2,h3')].find((x) => /Tukar formasi/.test(x.textContent || ''))
  const k = h?.closest('div[class*="rounded"]')?.parentElement?.parentElement
  if (!k) return null
  const ps = [...k.querySelectorAll('p')].map((e) => e.innerText.trim()).filter(Boolean)
  return ps.find((x) => /Bentuk/.test(x)) ?? null
})
// pilih target "Timpa set yang sedang dibuka"
R.pilihTimpa = await p.evaluate(() => {
  const sel = [...document.querySelectorAll('select')].find((s) =>
    [...s.options].some((o) => /Timpa set yang sedang dibuka/.test(o.textContent)),
  )
  if (!sel) return false
  const set = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set
  const opt = [...sel.options].find((o) => /Timpa set yang sedang dibuka/.test(o.textContent))
  set.call(sel, opt.value)
  sel.dispatchEvent(new Event('change', { bubbles: true }))
  return true
})
await wait(900)
R.tombol2 = await p.evaluate(() => {
  const el = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Timpa set aktif')
  return el ? { aktif: !el.disabled } : null
})
await p.evaluate(() => {
  const el = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Timpa set aktif')
  el && el.click()
})
await wait(2200)
R.setSesudahTimpa = await jumlahSet()

R.error = errs
console.log(JSON.stringify(R, null, 2))
await b.close()
