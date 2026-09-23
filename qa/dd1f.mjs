// DD1 — ukuran titik pemain mengikuti luas lapangan
import puppeteer from 'puppeteer'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const R = {}
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--mute-audio'] })
const p = await b.newPage()
await p.setViewport({ width: 1440, height: 980 })
const errs = []
p.on('pageerror', (e) => errs.push(e.message.slice(0, 160)))
p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)) })

const gantiPreset = async (nama) => {
  await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((y) => (y.title || '') === 'Pengaturan drill'); x && x.click() })
  await wait(1100)
  const ok = await p.evaluate((t) => { const x = [...document.querySelectorAll('button')].find((y) => y.textContent.trim() === t); if (!x) return false; x.click(); return true }, nama)
  await wait(900)
  await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((y) => y.textContent.trim() === 'Simpan'); x && x.click() })
  await wait(2300)
  return ok
}
const setSelect = (label, nilai) => p.evaluate((lab, val) => {
  const f = [...document.querySelectorAll('label')].find((l) => l.textContent.includes(lab))
  const sel = f && f.parentElement.querySelector('select')
  if (!sel) return false
  const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set
  setter.call(sel, String(val))
  sel.dispatchEvent(new Event('change', { bubbles: true }))
  return true
}, label, nilai)

/** Ukur diameter titik yang TAMPAK di layar (px) dan radius-nya di satuan yard. */
const ukurTitik = () => p.evaluate(() => {
  const c = document.querySelector('[data-titik="1"]')
  if (!c) return null
  const kotak = c.getBoundingClientRect()
  const lap = document.querySelector('[data-lap="rumput"]')
  return {
    px: Math.round(kotak.width * 10) / 10,
    rYard: Math.round(Number(c.getAttribute('r')) * 100) / 100,
    lapPx: lap ? Math.round(lap.getBoundingClientRect().width) : null,
  }
})

await p.goto('http://localhost:5173/', { waitUntil: 'networkidle2' }); await wait(1600)
await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((y) => y.textContent.includes('Muat data contoh')); x && x.click() })
await wait(3400)
await p.evaluate(() => { location.hash = '#/drill' }); await wait(2600)

R.dci = await ukurTitik()
R.presetBola = await gantiPreset('Sepak bola (Indonesia)')
R.bola = await ukurTitik()
R.presetIndoor = await gantiPreset('Indoor / GOR')
R.indoor = await ukurTitik()

/* perkecil jadi 50% di lapangan indoor */
await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((y) => (y.title || '') === 'Pengaturan drill'); x && x.click() })
await wait(1100)
R.setKecil = await setSelect('Ukuran titik pemain', 0.5); await wait(800)
await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((y) => y.textContent.trim() === 'Simpan'); x && x.click() })
await wait(2300)
R.indoorKecil = await ukurTitik()

/* besarkan jadi 200% di lapangan indoor */
await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((y) => (y.title || '') === 'Pengaturan drill'); x && x.click() })
await wait(1100)
R.setBesar = await setSelect('Ukuran titik pemain', 2); await wait(800)
await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((y) => y.textContent.trim() === 'Simpan'); x && x.click() })
await wait(2300)
R.indoorBesar = await ukurTitik()

/* presenter ikut menyesuaikan */
await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((y) => (y.title || '').includes('Presenter') || y.textContent.includes('Presenter')); x && x.click() })
await wait(2400)
R.presenter = await p.evaluate(() => {
  const c = document.querySelector('[data-titik="1"]')
  return c ? Math.round(c.getBoundingClientRect().width * 10) / 10 : null
})
await p.keyboard.press('Escape'); await wait(1200)

/* kembali ke DCI harus pulih seperti semula */
R.kembaliDci = await gantiPreset('DCI / kampus')
R.dciAkhir = await ukurTitik()

R.error = errs
console.log(JSON.stringify(R, null, 2))
await b.close()
