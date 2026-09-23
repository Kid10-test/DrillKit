import puppeteer from 'puppeteer'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--mute-audio'] })
const p = await b.newPage(); await p.setViewport({ width: 1440, height: 1000 })
const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0,160)))
p.on('console', m => { if (m.type()==='error') errs.push('console: '+m.text().slice(0,160)) })
const tombol = (t) => p.evaluate((x)=>{
  const el=[...document.querySelectorAll('button')].find(y=>y.textContent.trim()===x)
  return el ? el.disabled : null
}, t)
const status = async () => ({
  kiri: await tombol('↺ Kiri'), kanan: await tombol('Kanan ↻'),
  kecil: await tombol('Kecilkan'), besar: await tombol('Besarkan'),
  cermin: await tombol('Kiri ⇄ Kanan'), geser: await tombol('Ke depan'),
})
const info = () => p.evaluate(() => {
  const h=[...document.querySelectorAll('h2')].find(x=>x.textContent.includes('Alat gerak massa'))
  const card=h&&h.closest('div[class*="rounded"]')
  return card ? card.innerText.replace(/\s+/g,' ').slice(0,180) : null
})
await p.goto('http://localhost:5173/', { waitUntil: 'networkidle2' }); await wait(1600)
await p.evaluate(() => { const x=[...document.querySelectorAll('button')].find(y=>y.textContent.includes('Muat data contoh')); x&&x.click() })
await wait(3400); await p.evaluate(() => { location.hash = '#/drill' }); await wait(2800)
const R = {}
R.tanpaPilihan = await status(); R.infoTanpa = await info()
const ling = await p.$$('circle[data-titik="1"]')
await ling[0].click(); await wait(600)
R.satuDipilih = await status(); R.infoSatu = await info()
await p.keyboard.down('Shift'); await ling[1].click(); await p.keyboard.up('Shift'); await wait(600)
R.duaDipilih = await status()
R.error = errs
console.log(JSON.stringify(R, null, 2))
await b.close()
