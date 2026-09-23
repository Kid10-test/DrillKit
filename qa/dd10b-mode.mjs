// DD10b — mode langkah: tetap vs menyesuaikan, di buku saku (dev 5173)
import puppeteer from 'puppeteer'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--mute-audio', '--allow-file-access-from-files'] })
const p = await b.newPage()
await p.setViewport({ width: 1440, height: 1000 })
const errs = []
p.on('pageerror', (e) => errs.push(e.message.slice(0, 160)))
p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)) })
const R = {}

const klik = (teks) => p.evaluate((t) => {
  const el = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === t)
  if (!el) return false
  el.click(); return true
}, teks)

const pratinjau = async (berkas) => {
  await p.evaluate(() => { const el = document.querySelector('[title="Kartu/dot sheet per pemain"]'); el && el.click() })
  await wait(1300)
  await p.evaluate(() => {
    const el = [...document.querySelectorAll('button')].find((x) => x.textContent.trim().includes('Pratinjau'))
    el && el.click()
  })
  await wait(1700)
  let data = null
  for (const f of p.frames()) {
    const h = await f.evaluate(() => (document.body ? document.body.innerHTML : '')).catch(() => '')
    if (h.includes('<table')) {
      data = await f.evaluate(() => {
        const t = document.querySelector('table')
        return {
          kepala: [...t.querySelectorAll('thead th')].map((x) => x.textContent.trim()),
          baris: [...t.querySelectorAll('tbody tr')].slice(0, 3).map((tr) =>
            [...tr.children].map((td) => td.textContent.trim()),
          ),
          legenda: [...document.querySelectorAll('.legend')].map((e) => e.innerText),
        }
      })
      break
    }
  }
  if (berkas) {
    const h = await p.$('iframe[srcdoc]')
    if (h) await h.screenshot({ path: berkas })
  }
  await p.keyboard.press('Escape'); await wait(1200)
  return data
}

const bukaSetelan = async () => { await klik('⚙'); await wait(1200) }

const URL_DASAR = process.argv[2] || 'http://localhost:5173/'
await p.goto(URL_DASAR, { waitUntil: 'networkidle2' }); await wait(1600)
await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((y) => y.textContent.includes('Muat data contoh')); x && x.click() })
await wait(3400)
await p.evaluate(() => { location.hash = '#/drill' }); await wait(2800)

// ---- 1. bawaan = ukuran langkah tetap
R.tetap = await pratinjau('/home/user/shots/dd10b-tetap.png')

// ---- 2. ganti ke "Langkah ikut hitungan"
await bukaSetelan()
R.pilihMenyesuaikan = await klik('Langkah ikut hitungan')
await wait(900)
R.simpan = await klik('Simpan')
await wait(1700)
R.menyesuaikan = await pratinjau('/home/user/shots/dd10b-sesuai.png')

R.error = errs

// Ringkas + uji keajegan: Langkah / Cnt harus sama dengan Lk/cnt di dua mode.
function ringkas(d) {
  if (!d) return null
  return { kepala: d.kepala.join(' | '), baris: d.baris.slice(0, 2) }
}
function uji(label, d) {
  if (!d) return console.log(label, 'TIDAK ADA')
  for (const b of d.baris.slice(0, 2)) {
    const [no, set, cnt, koord, langkahArah, lpc, ukuran] = b
    if (langkahArah === '-') { console.log(`${label} baris ${no}: set terakhir, dilewati`); continue }
    const langkah = parseFloat(langkahArah)
    const hitung = parseFloat(cnt)
    const lpcN = parseFloat(lpc)
    const turunan = Math.round((langkah / hitung) * 100) / 100
    const ok = Math.abs(turunan - lpcN) <= 0.02
    console.log(
      `${label} baris ${no}: ${langkah} lk / ${hitung} cnt = ${turunan} vs Lk/cnt ${lpcN}  ${ok ? 'COCOK' : 'TIDAK-COCOK'}  · ukuran ${ukuran} · ${koord}`,
    )
  }
}
console.log('KOLOM:', R.tetap?.kepala.join(' | '))
uji('TETAP       ', R.tetap)
uji('MENYESUAIKAN', R.menyesuaikan)
console.log('error:', JSON.stringify(errs))
await b.close()
