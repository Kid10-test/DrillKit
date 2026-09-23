import puppeteer from 'puppeteer'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
async function jalankan(alamat, label) {
  const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--mute-audio','--allow-file-access-from-files'] })
  const p = await b.newPage(); await p.setViewport({ width: 1440, height: 1000 })
  const errs=[]; p.on('pageerror',e=>errs.push(e.message.slice(0,160)))
  p.on('console',m=>{ if(m.type()==='error') errs.push('console: '+m.text().slice(0,160)) })
  const R={label}
  const modal=()=>p.evaluate(()=>{
    const j=[...document.querySelectorAll('h2,h3')].find(h=>(h.textContent||'').startsWith('Detail —'))
    if(!j) return null
    const k=j.closest('div[class*="rounded"]')?.parentElement?.parentElement
    if(!k) return null
    return {
      baris:[...k.querySelectorAll('tbody tr')].map(tr=>[...tr.children].map(td=>td.textContent.trim())),
      kepala:[...k.querySelectorAll('thead th')].map(th=>th.textContent.trim()),
      instrumen:(()=>{const el=[...k.querySelectorAll('input')].find(i=>i.placeholder.includes('Trumpet')); return el?el.value:null})(),
    }
  })
  await p.goto(alamat,{waitUntil:'networkidle2'}); await wait(2200)
  await p.evaluate(()=>{ const x=[...document.querySelectorAll('button')].find(y=>y.textContent.includes('Muat data contoh')); x&&x.click() })
  await wait(3600); await p.evaluate(()=>{ location.hash='#/drill' }); await wait(2800)
  const ling = await p.$$('circle[data-titik="1"]')
  await ling[0].click(); await wait(800)
  R.buka = await p.evaluate(()=>{ const el=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Detail'); if(!el) return false; el.click(); return true })
  await wait(1400)
  R.modal = await modal()
  // simpan instrumen
  R.ketik = await p.evaluate(()=>{ const el=[...document.querySelectorAll('input')].find(i=>i.placeholder.includes('Trumpet')); if(!el) return false
    const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; s.call(el,'Flag — merah')
    el.dispatchEvent(new Event('input',{bubbles:true})); return true })
  await wait(400)
  R.simpan = await p.evaluate(()=>{ const el=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Simpan'); if(!el) return false; el.click(); return true })
  await wait(1200)
  // klik baris tabel → modal tertutup & pindah set
  R.klikBaris = await p.evaluate(()=>{ const el=[...document.querySelectorAll('tbody tr button')][0]; if(!el) return false; el.click(); return true })
  await wait(1200)
  R.modalTertutup = (await modal()) === null
  R.error=errs
  await b.close(); return R
}
console.log(JSON.stringify(await jalankan('http://localhost:4173/','produksi (4173)'),null,2))
console.log(JSON.stringify(await jalankan('file:///home/user/drillkit/portable/DrillKit.html','portabel'),null,2))
