import puppeteer from 'puppeteer'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
async function jalankan(alamat, label) {
  const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--mute-audio','--allow-file-access-from-files'] })
  const p = await b.newPage(); await p.setViewport({ width: 1440, height: 1000 })
  const errs=[]; p.on('pageerror',e=>errs.push(e.message.slice(0,160)))
  p.on('console',m=>{ if(m.type()==='error') errs.push('console: '+m.text().slice(0,160)) })
  const R={label}
  const tombol=(t)=>p.evaluate((x)=>{const el=[...document.querySelectorAll('button')].find(y=>y.textContent.trim()===x); if(!el||el.disabled) return false; el.click(); return true},t)
  const setSudut=(v)=>p.evaluate((val)=>{const btn=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='↺ Kiri'); const sel=btn&&btn.parentElement.querySelector('select'); if(!sel) return false; const s=Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype,'value').set; s.call(sel,String(val)); sel.dispatchEvent(new Event('change',{bubbles:true})); return true},v)
  const setSelect=(lab,val)=>p.evaluate((l,v)=>{const f=[...document.querySelectorAll('label')].find(x=>x.textContent.includes(l)); const sel=f&&f.parentElement.querySelector('select'); if(!sel) return false; const s=Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype,'value').set; s.call(sel,String(v)); sel.dispatchEvent(new Event('change',{bubbles:true})); return true},lab,val)
  const scrub=(v)=>p.evaluate((n)=>{const s=document.querySelector('[data-testid="garis-waktu"]'); if(!s) throw new Error('no slider'); const set=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; set.call(s,String(n)); s.dispatchEvent(new Event('input',{bubbles:true}))},v)
  const posisi=()=>p.evaluate(()=>[...document.querySelectorAll('g.cursor-move')].map(g=>{const c=g.querySelector('circle[data-titik="1"]'); if(!c) return null; const m=/translate\(([-\d.e]+) ([-\d.e]+)\)/.exec(g.getAttribute('transform')||''); return [Number(c.getAttribute('cx'))+(m?+m[1]:0), Number(c.getAttribute('cy'))+(m?+m[2]:0)]}).filter(Boolean))
  const kePusat=(d)=>[d.reduce((a,q)=>a+q[0],0)/d.length, d.reduce((a,q)=>a+q[1],0)/d.length]
  const ringkas=(awal,pusat,skrg)=>{const r=skrg.map((q,i)=>Math.hypot(q[0]-pusat[0],q[1]-pusat[1])/Math.hypot(awal[i][0]-pusat[0],awal[i][1]-pusat[1])); return {min:Math.round(Math.min(...r)*1000)/1000, maks:Math.round(Math.max(...r)*1000)/1000}}
  const jejak=()=>p.evaluate(()=>{const el=document.querySelector('[data-trail="keluar"]'); return el?{tag:el.tagName.toLowerCase(), segmen:((el.getAttribute('d')||'').match(/L/g)||[]).length}:null})
  await p.goto(alamat,{waitUntil:'networkidle2'}); await wait(2200)
  await p.evaluate(()=>{const x=[...document.querySelectorAll('button')].find(y=>y.textContent.includes('Muat data contoh')); x&&x.click()})
  await wait(3600); await p.evaluate(()=>{location.hash='#/drill'}); await wait(2800)
  await tombol('Blok'); await wait(1200)
  await p.keyboard.press('BracketRight'); await wait(1400)
  await tombol('Blok'); await wait(1200)
  await setSudut(90); await wait(700)
  R.putar=await tombol('Kanan ↻'); await wait(1700)
  await p.keyboard.press('BracketLeft'); await wait(1500)
  R.jejakBusur=await jejak()
  await scrub(0); await wait(400); const A=await posisi(); const pusat=kePusat(A)
  await scrub(0.5); await wait(400); R.radiusBusur=ringkas(A,pusat,await posisi())
  await setSelect('Bentuk jalur','lurus'); await wait(1100)
  R.jejakLurus=await jejak()
  await scrub(0); await wait(400); const A2=await posisi(); const pusat2=kePusat(A2)
  await scrub(0.5); await wait(400); R.radiusLurus=ringkas(A2,pusat2,await posisi())
  R.error=errs
  await b.close(); return R
}
console.log(JSON.stringify(await jalankan('http://localhost:4173/','produksi (4173)'),null,2))
console.log(JSON.stringify(await jalankan('file:///home/user/drillkit/portable/DrillKit.html','portabel'),null,2))
