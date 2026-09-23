// DD1 — selidiki isi kolom koordinat di buku saku
import puppeteer from 'puppeteer'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--mute-audio'] })
const p = await b.newPage()
await p.setViewport({ width: 1440, height: 980 })
const errs = []
p.on('pageerror', (e) => errs.push(e.message.slice(0, 160)))
p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)) })

await p.goto('http://localhost:5173/', { waitUntil: 'networkidle2' }); await wait(1500)
await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((y) => y.textContent.includes('Muat data contoh')); x && x.click() })
await wait(3200)
await p.evaluate(() => { location.hash = '#/drill' }); await wait(2600)

const bukaDot = async () => {
  await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((y) => (y.title || '') === 'Kartu/dot sheet per pemain'); x && x.click() })
  await wait(1200)
  await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((y) => y.textContent.trim() === 'Pratinjau'); x && x.click() })
  await wait(2400)
  const f = p.frames().find((x) => x.url() === 'about:srcdoc' || x.url().startsWith('data:'))
  if (!f) return null
  const html = await f.content()
  return html.replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, '|').replace(/\s+/g, ' ').replace(/\|+/g, '|')
}

async function gantiPreset(nama) {
  await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((y) => (y.title || '') === 'Pengaturan drill'); x && x.click() })
  await wait(1000)
  await p.evaluate((t) => { const x = [...document.querySelectorAll('button')].find((y) => y.textContent.trim() === t); x && x.click() }, nama)
  await wait(900)
  await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((y) => y.textContent.trim() === 'Simpan'); x && x.click() })
  await wait(2200)
}

await gantiPreset('Sepak bola (Indonesia)')
const bola = await bukaDot()
console.log('=== BUKU SAKU — LAPANGAN SEPAK BOLA (patok) ===')
console.log((bola || 'TIDAK ADA').slice(0, 1400))
console.log('\n--- kolom koordinat saja ---')
console.log((bola || '').split('|').filter((x) => /[A-Z]#?(\s*[-+]|\s*\d+\s*·|$)/.test(x.trim()) || /^[A-Z]#?\d+$/.test(x.trim())).slice(0, 24).join(' | '))

// tutup
await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((y) => y.textContent.trim() === 'Tutup'); x && x.click() })
await wait(800)
await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((y) => y.textContent.trim() === 'Batal'); x && x.click() })
await wait(800)

await gantiPreset('DCI / kampus')
const dci = await bukaDot()
console.log('\n=== BUKU SAKU — DCI (format lama) ===')
console.log((dci || 'TIDAK ADA').slice(0, 900))
console.log('\nerror:', errs)
await b.close()
