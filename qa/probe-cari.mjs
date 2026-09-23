import puppeteer from 'puppeteer'
import { lewatSambutan } from './sambutan.mjs'
const BASE='http://localhost:4173'
const wait=(ms)=>new Promise(r=>setTimeout(r,ms))
const b=await puppeteer.launch({args:['--no-sandbox','--disable-dev-shm-usage'],defaultViewport:{width:1300,height:1000}})
const A=await b.newPage(); A.on('dialog',async d=>await d.accept())
await A.goto(BASE,{waitUntil:'networkidle2'}); await wait(1200)
await lewatSambutan(A); await wait(1200)
await A.evaluate(()=>{const x=[...document.querySelectorAll('button')].find(y=>y.textContent.includes('Muat data contoh'));if(x)x.click()})
await wait(4500)
await A.goto(`${BASE}/#/musik`,{waitUntil:'networkidle2'}); await wait(2500)

// Di kartu metronom (bukan modal):
console.log('== KARTU METRONOM: bagian-bagiannya ==')
console.log(await A.evaluate(()=>[...document.querySelectorAll('h2,h3')].map(h=>' - '+h.textContent.trim()).join('\n')))

// Buka modal lagu
await A.evaluate(()=>{const x=[...document.querySelectorAll('button')].find(y=>y.textContent.includes('Tambah lagu'));if(x)x.click()})
await wait(1500)
console.log('\n== MODAL LAGU: bagian-bagiannya, berurutan ==')
console.log(await A.evaluate(()=>{
  const m=document.querySelector('[data-testid="modal-lagu"]')
  if(!m) return 'MODAL TIDAK ADA'
  return [...m.querySelectorAll('h3,label,span')].map(h=>h.textContent.trim()).filter(t=>t&&t.length<60).join('\n - ')
}))
console.log('\n== tombol di modal lagu ==')
console.log(await A.evaluate(()=>{
  const m=document.querySelector('[data-testid="modal-lagu"]')
  return [...m.querySelectorAll('button')].map(x=>x.textContent.trim()).filter(Boolean).join(' | ')
}))
await b.close()
