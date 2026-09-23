import puppeteer from 'puppeteer'
const BASE = process.argv[2] || 'http://localhost:5173'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--disable-setuid-sandbox'] })
const p = await b.newPage()
await p.setViewport({ width: 1280, height: 1150, deviceScaleFactor: 2 })
await p.goto(BASE.startsWith('file:') ? BASE : BASE + '/', { waitUntil: 'networkidle2' })
await wait(2200); await p.evaluate(() => { location.hash = '#/musik' }); await wait(2200)

const klik = async (x) => { await p.evaluate((y) => {
  ;[...document.querySelectorAll('button')].find(b=>b.textContent.includes(y))?.click() }, x); await wait(600) }
const pilihTeks = async (sel,label) => { const v = await p.$$eval(sel+' option',(o,lb)=>{
  const x=o.find(q=>q.textContent.trim()===lb); return x?x.value:null }, label); if(v===null) throw new Error('x')
  await p.select(sel,v); await wait(400) }

await klik('Tambah lagu')
await p.evaluate(() => { const m=document.querySelector('[data-testid="modal-lagu"]'); const i=m?.querySelector('input')
  if(i){const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set
    s.call(i,'Contohh Mode Lagu'); i.dispatchEvent(new Event('input',{bubbles:true}))} })
await wait(300)
await p.click('[data-testid="tambah-segmen-bawah"]'); await wait(350)
await p.click('[data-testid="tambah-segmen-bawah"]'); await wait(350)
await p.click('[data-testid="tambah-segmen-bawah"]'); await wait(450)

const ids = await p.$$eval('[data-testid^="segmen-"]', els => els.map(e=>e.getAttribute('data-testid'))
  .filter(t=>t && !t.includes('meter') && !t.includes('label')))
const isi = [ {m:1,b:112,l:'A — pembuka'}, {m:9,b:132,l:'B — ganti meter'}, {m:17,b:120,l:'C — penutup'} ]
await p.evaluate((a,cfg) => { const setV=(el,v)=>{const s=Object.getOwnPropertyDescriptor(
  window.HTMLInputElement.prototype,'value').set; s.call(el,String(v)); el.dispatchEvent(new Event('input',{bubbles:true}))}
  a.forEach((id,ix)=>{ const w=document.querySelector(`[data-testid="${id}"]`); if(!w) return
    const t=w.querySelector('input'); if(t) setV(t, cfg[ix].l)
    const n=w.querySelectorAll('input[type="number"]'); if(n[0]) setV(n[0],cfg[ix].m); if(n[1]) setV(n[1],cfg[ix].b) }) }, ids, isi)
await wait(400)
await pilihTeks(`[data-testid="segmen-meter-${ids[1].replace('segmen-','')}"] select`, '7/8 · 2+2+3')
await wait(300)
await p.evaluate(() => { const m=document.querySelector('[data-testid="modal-lagu"]')
  ;[...(m?.querySelectorAll('button')??[])].find(b=>b.textContent.trim()==='Simpan')?.click() })
await wait(1200)
await p.evaluate(() => { ;[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Contohh Mode Lagu'))?.click() })
await wait(900)
await p.evaluate(() => { const s=[...document.querySelectorAll('select')].find(x=>
  [...x.options].some(o=>o.textContent.includes('Ikuti tempo map')))
  const o=s&&[...s.options].find(o=>o.textContent.includes('Ikuti tempo map'))
  if(s&&o){s.value=o.value; s.dispatchEvent(new Event('change',{bubbles:true}))} })
await wait(500)
// loncat ke segmen B supaya terlihat sukat 7/8
await p.click('[data-testid="chip-segmen-1"]'); await wait(800)
await p.evaluate(() => window.scrollTo(0,0)); await wait(300)
await p.screenshot({ path: '/home/user/shots/m1-mode-lagu.png' })
await b.close(); console.log('ok')
