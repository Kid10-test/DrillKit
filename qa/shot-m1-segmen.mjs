import puppeteer from 'puppeteer'
const BASE = process.argv[2] || 'http://localhost:5173'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] })
const p = await b.newPage()
await p.setViewport({ width: 1180, height: 1000, deviceScaleFactor: 2 })
await p.goto(BASE.startsWith('file:') ? BASE : BASE + '/', { waitUntil: 'networkidle2' })
await wait(2200)
await p.evaluate(() => { location.hash = '#/musik' })
await wait(2200)

const klik = async (lb) => { await p.evaluate((x) => {
  ;[...document.querySelectorAll('button')].find(b => b.textContent.includes(x))?.click() }, lb); await wait(600) }
const pilihTeks = async (sel, label) => {
  const v = await p.$$eval(sel + ' option', (o, lb) => { const x = o.find(q => q.textContent.trim() === lb); return x ? x.value : null }, label)
  if (v === null) throw new Error('tidak ketemu ' + label)
  await p.select(sel, v); await wait(400)
}

await klik('Tambah lagu')
await p.evaluate(() => {
  const m = document.querySelector('[data-testid="modal-lagu"]')
  const i = m?.querySelector('input')
  if (i) { const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set
    s.call(i,'Contohh Ganti Meter'); i.dispatchEvent(new Event('input',{bubbles:true})) }
})
await wait(300)
await klik('Segmen'); await klik('Segmen')
const ids = await p.$$eval('[data-testid^="segmen-"]', els => els.map(e=>e.getAttribute('data-testid'))
  .filter(t => t && !t.includes('meter') && !t.includes('label')))
// isi birama & bpm
await p.evaluate((a) => {
  const setV = (el,v)=>{const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set
    s.call(el,String(v)); el.dispatchEvent(new Event('input',{bubbles:true}))}
  a.forEach((id,ix) => {
    const w = document.querySelector(`[data-testid="${id}"]`); if(!w) return
    const n = w.querySelectorAll('input[type="number"]')
    if (n[0]) setV(n[0], ix===0?1:9)
    if (n[1]) setV(n[1], ix===0?112:132)
  })
}, ids)
await wait(400)
// label
await p.evaluate((a) => {
  const setV=(el,v)=>{const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set
    s.call(el,String(v)); el.dispatchEvent(new Event('input',{bubbles:true}))}
  a.forEach((id,ix)=>{ const w=document.querySelector(`[data-testid="${id}"]`); const i=w?.querySelector('input')
    if(i) setV(i, ix===0?'A — pembuka':'B — ganti meter') })
}, ids)
await wait(400)
// sukat segmen 2 = 7/8
const sel2 = `[data-testid="segmen-meter-${ids[1].replace('segmen-','')}"] select`
await pilihTeks(sel2, '7/8 · 2+2+3')
await wait(700)
await p.evaluate(() => document.querySelector('[data-testid="modal-lagu"]')?.scrollIntoView())
await wait(300)
await p.screenshot({ path: '/home/user/shots/m1-sukat-segmen.png' })
await b.close()
console.log('ok')
