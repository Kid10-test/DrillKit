import puppeteer from 'puppeteer'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
async function jalankan(alamat, label) {
  const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--mute-audio','--allow-file-access-from-files'] })
  const p = await b.newPage(); await p.setViewport({ width: 1440, height: 1000 })
  const errs = []
  p.on('pageerror', (e) => errs.push(e.message.slice(0, 160)))
  p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)) })
  const R = { label }
  const toggle = (t) => p.evaluate((teks)=>{ const el=[...document.querySelectorAll('button,label')].find(x=>x.textContent.trim()===teks); if(el){el.click();return true} return false }, t)
  const warna = () => p.evaluate(() => [...new Set([...document.querySelectorAll('[data-trail="keluar"]')].map(e=>e.getAttribute('stroke')))])
  const panel = () => p.evaluate(() => {
    const j = [...document.querySelectorAll('h2')].find(h=>h.textContent.includes('Analitik gerakan'))
    if (!j) return null
    const c = j.closest('div[class*="rounded"]') || j.parentElement.parentElement
    return { angka: [...c.querySelectorAll('.text-\\[15px\\]')].map(e=>e.textContent.trim()), peringatan: (c.innerText.match(/(\d+) gerakan berat/)||[])[1] ?? '0' }
  })
  await p.goto(alamat, { waitUntil: 'networkidle2' }); await wait(2200)
  await p.evaluate(() => { const x=[...document.querySelectorAll('button')].find(y=>y.textContent.includes('Muat data contoh')); x&&x.click() })
  await wait(3600)
  await p.evaluate(() => { location.hash = '#/drill' }); await wait(2800)
  R.panel = await panel()
  R.warnaAwal = await warna()
  R.toggle = await toggle('Warnai jejak menurut kesulitan'); await wait(900)
  R.warnaSesudah = await warna()
  R.error = errs
  await b.close(); return R
}
console.log(JSON.stringify(await jalankan('http://localhost:4173/', 'produksi (4173)'), null, 2))
console.log(JSON.stringify(await jalankan('file:///home/user/drillkit/portable/DrillKit.html', 'portabel'), null, 2))
