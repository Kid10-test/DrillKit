// Tangkapan layar: jendela tukar CSV dengan pratinjau terisi (dev 5173)
import puppeteer from 'puppeteer'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--mute-audio'] })
const p = await b.newPage()
await p.setViewport({ width: 1440, height: 1200 })

await p.goto('http://localhost:5173/', { waitUntil: 'networkidle2' }); await wait(1600)
await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((y) => y.textContent.includes('Muat data contoh')); x && x.click() })
await wait(3400)
await p.evaluate(() => { location.hash = '#/drill' }); await wait(2800)

// ambil kode anggota
await p.evaluate(() => { const el = document.querySelector('[title="Kartu/dot sheet per pemain"]'); el && el.click() })
await wait(1400)
const kode = await p.evaluate(() => {
  const sel = [...document.querySelectorAll('select')].find((s) =>
    [...s.options].some((o) => o.value.startsWith('m_')),
  )
  if (!sel) return []
  return [...sel.options]
    .filter((o) => o.value.startsWith('m_'))
    .slice(0, 4)
    .map((o) => o.textContent.split('—')[0].trim())
})
await p.keyboard.press('Escape'); await wait(1000)

// buka jendela CSV lalu tempel
await p.evaluate(() => { const el = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'CSV'); el && el.click() })
await wait(1300)
const csv = ['Kode,Nama,Blok Awal X,Blok Awal Y,Blok Akhir X,Blok Akhir Y']
kode.forEach((k, i) => csv.push(`${k},Pemain ${i + 1},${-8 + i * 2},${12 + i},${-4 + i * 2},${20 + i}`))
await p.evaluate((v) => {
  const el = document.querySelector('textarea')
  const set = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
  set.call(el, v)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}, csv.join('\n'))
await wait(1300)

const berkas = process.argv[2] || '/home/user/shots/dd7-tukar-csv.png'
await p.screenshot({ path: berkas })
console.log('tersimpan:', berkas)
await b.close()
