// DD8 — apakah warna peringatan benar-benar tercetak?
import puppeteer from 'puppeteer'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--mute-audio'] })
const p = await b.newPage(); await p.setViewport({ width: 1440, height: 1000 })
const errs=[]; p.on('pageerror',e=>errs.push(e.message.slice(0,160)))
p.on('console',m=>{ if(m.type()==='error') errs.push('console: '+m.text().slice(0,160)) })
const setCount = (v) => p.evaluate((val)=>{
  const lab=[...document.querySelectorAll('label')].find(l=>l.textContent.includes('Count ke set berikutnya'))
  const inp=lab&&lab.parentElement.querySelector('input'); if(!inp) return false
  const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set
  s.call(inp,String(val)); inp.dispatchEvent(new Event('input',{bubbles:true})); return true
}, v)
const baca = async () => { await wait(1500)
  for (const f of p.frames()) {
    const h = await f.evaluate(()=>document.body?document.body.innerHTML:'').catch(()=> '')
    if (h.includes('<table')) return f.evaluate(()=>{
      const t=document.querySelector('table')
      const kepala=[...t.querySelectorAll('thead th')].map(x=>x.textContent.trim())
      const tr=t.querySelector('tbody tr')
      return { kepala, selTerakhir: tr ? tr.children[tr.children.length-1].innerHTML : null }
    })
  }
  return null
}
await p.goto('http://localhost:5173/', { waitUntil: 'networkidle2' }); await wait(1600)
await p.evaluate(()=>{ const x=[...document.querySelectorAll('button')].find(y=>y.textContent.includes('Muat data contoh')); x&&x.click() })
await wait(3400); await p.evaluate(()=>{ location.hash='#/drill' }); await wait(2800)
// paksa gerakan jadi berat: semua jarak ditempuh dalam 1 count
await setCount(1); await wait(1300)
await p.evaluate(()=>{ const el=document.querySelector('[title="Kartu/dot sheet per pemain"]'); el&&el.click() })
await wait(1500)
await p.evaluate(()=>{ const el=[...document.querySelectorAll('button')].find(y=>y.textContent.trim().includes('Pratinjau')); el&&el.click() })
const R = { berat: await baca(), error: errs }
console.log(JSON.stringify(R,null,2))
await b.close()
