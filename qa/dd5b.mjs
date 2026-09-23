// Perbandingan jalur lurus vs busur pada putaran 90°
import puppeteer from 'puppeteer'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--mute-audio'] })
const p = await b.newPage(); await p.setViewport({ width: 1440, height: 1000 })
const errs=[]; p.on('pageerror',e=>errs.push(e.message.slice(0,160)))
p.on('console',m=>{ if(m.type()==='error') errs.push('console: '+m.text().slice(0,160)) })
const tombol = (t) => p.evaluate((x)=>{ const el=[...document.querySelectorAll('button')].find(y=>y.textContent.trim()===x); if(!el||el.disabled) return false; el.click(); return true }, t)
const setSudut = (v) => p.evaluate((val)=>{
  const btn=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='↺ Kiri')
  const sel=btn&&btn.parentElement.querySelector('select')
  if(!sel) return false
  const set=Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype,'value').set
  set.call(sel,String(val)); sel.dispatchEvent(new Event('change',{bubbles:true})); return true
}, v)
const setSelect = (lab,val) => p.evaluate((l,v)=>{
  const f=[...document.querySelectorAll('label')].find(x=>x.textContent.includes(l))
  const sel=f&&f.parentElement.querySelector('select'); if(!sel) return false
  const set=Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype,'value').set
  set.call(sel,String(v)); sel.dispatchEvent(new Event('change',{bubbles:true})); return true
}, lab, val)
const scrub = (v) => p.evaluate((n)=>{
  const s=document.querySelector('[data-testid="garis-waktu"]'); if(!s) throw new Error('no slider')
  const set=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set
  set.call(s,String(n)); s.dispatchEvent(new Event('input',{bubbles:true}))
}, v)
const posisi = () => p.evaluate(()=>[...document.querySelectorAll('g.cursor-move')].map(g=>{
  const c=g.querySelector('circle[data-titik="1"]'); if(!c) return null
  const m=/translate\(([-\d.e]+) ([-\d.e]+)\)/.exec(g.getAttribute('transform')||'')
  return [Number(c.getAttribute('cx'))+(m?+m[1]:0), Number(c.getAttribute('cy'))+(m?+m[2]:0)]
}).filter(Boolean))
const kePusat=(d)=>[d.reduce((a,q)=>a+q[0],0)/d.length, d.reduce((a,q)=>a+q[1],0)/d.length]
const ringkas=(awal,pusat,skrg)=>{ const r=skrg.map((q,i)=>Math.hypot(q[0]-pusat[0],q[1]-pusat[1])/Math.hypot(awal[i][0]-pusat[0],awal[i][1]-pusat[1])); return {min:Math.round(Math.min(...r)*1000)/1000, maks:Math.round(Math.max(...r)*1000)/1000} }
await p.goto('http://localhost:5173/', { waitUntil: 'networkidle2' }); await wait(1600)
await p.evaluate(()=>{ const x=[...document.querySelectorAll('button')].find(y=>y.textContent.includes('Muat data contoh')); x&&x.click() })
await wait(3400); await p.evaluate(()=>{ location.hash='#/drill' }); await wait(2800)
await tombol('Blok'); await wait(1200)
await p.keyboard.press('BracketRight'); await wait(1400)
await tombol('Blok'); await wait(1200)
await setSudut(90); await wait(700)
await tombol('Kanan ↻'); await wait(1700)
await p.keyboard.press('BracketLeft'); await wait(1500)
async function ukur(label){
  await scrub(0); await wait(400)
  const A=await posisi(); const pusat=kePusat(A); const out={}
  for (const t of [0.25,0.5,0.75]) { await scrub(t); await wait(350); out['t'+t]=ringkas(A,pusat,await posisi()) }
  return out
}
const R={}
R.putaran90_busur = await ukur('busur')
await setSelect('Bentuk jalur','lurus'); await wait(1100)
R.putaran90_lurus = await ukur('lurus')
R.error=errs
console.log(JSON.stringify(R,null,2))
await b.close()
