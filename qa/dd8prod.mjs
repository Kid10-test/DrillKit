import puppeteer from 'puppeteer'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
async function jalankan(alamat, label) {
  const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--mute-audio','--allow-file-access-from-files'] })
  const p = await b.newPage(); await p.setViewport({ width: 1440, height: 1000 })
  const errs=[]; p.on('pageerror',e=>errs.push(e.message.slice(0,160)))
  p.on('console',m=>{ if(m.type()==='error') errs.push('console: '+m.text().slice(0,160)) })
  const R={label}
  const setCount=(v)=>p.evaluate((val)=>{
    const lab=[...document.querySelectorAll('label')].find(l=>l.textContent.includes('Count ke set berikutnya'))
    const inp=lab&&lab.parentElement.querySelector('input'); if(!inp) return false
    const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set
    s.call(inp,String(val)); inp.dispatchEvent(new Event('input',{bubbles:true})); return true
  }, v)
  const baca = async () => { await wait(1600)
    for (const f of p.frames()) {
      const h = await f.evaluate(()=>document.body?document.body.innerHTML:'').catch(()=> '')
      if (h.includes('<table')) return f.evaluate(()=>{
        const t=document.querySelector('table')
        const kepala=[...t.querySelectorAll('thead th')].map(x=>x.textContent.trim())
        const baris=[...t.querySelectorAll('tbody tr')].slice(0,3).map(tr=>[...tr.children].map(td=>td.textContent.trim()))
        const legenda=(document.querySelector('.legend')||{}).textContent||null
        const warna=[...t.querySelectorAll('tbody tr')].slice(0,3).map(tr=>tr.children[tr.children.length-1].innerHTML)
        return { kepala, baris, legenda, warna }
      })
    }
    return null
  }
  await p.goto(alamat,{waitUntil:'networkidle2'}); await wait(2200)
  await p.evaluate(()=>{ const x=[...document.querySelectorAll('button')].find(y=>y.textContent.includes('Muat data contoh')); x&&x.click() })
  await wait(3600); await p.evaluate(()=>{ location.hash='#/drill' }); await wait(2800)
  await setCount(1); await wait(1300)
  await p.evaluate(()=>{ const el=document.querySelector('[title="Kartu/dot sheet per pemain"]'); el&&el.click() })
  await wait(1500)
  await p.evaluate(()=>{ const el=[...document.querySelectorAll('button')].find(y=>y.textContent.trim().includes('Pratinjau')); el&&el.click() })
  R.hasil = await baca()
  R.error=errs
  await b.close(); return R
}
console.log(JSON.stringify(await jalankan('http://localhost:4173/','produksi (4173)'),null,2))
console.log(JSON.stringify(await jalankan('file:///home/user/drillkit/portable/DrillKit.html','portabel'),null,2))
