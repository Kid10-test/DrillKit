import puppeteer from 'puppeteer'
import fs from 'node:fs'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
fs.mkdirSync('/home/user/shots', { recursive: true })
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--mute-audio'] })
const p = await b.newPage(); await p.setViewport({ width: 1440, height: 900 })
await p.goto('http://localhost:5173/', { waitUntil: 'networkidle2' }); await wait(1600)
await p.evaluate(() => { const x=[...document.querySelectorAll('button')].find(y=>y.textContent.includes('Muat data contoh')); x&&x.click() })
await wait(3400)
await p.evaluate(() => { location.hash = '#/drill' }); await wait(2800)
const ganti = async (nama) => {
  await p.evaluate(() => { const x=[...document.querySelectorAll('button')].find(y=>(y.title||'')==='Pengaturan drill'); x&&x.click() }); await wait(1100)
  await p.evaluate((t) => { const x=[...document.querySelectorAll('button')].find(y=>y.textContent.trim()===t); x&&x.click() }, nama); await wait(900)
  const set = (lab, val) => p.evaluate((l,v)=>{ const f=[...document.querySelectorAll('label')].find(x=>x.textContent.includes(l)); const s2=f&&f.parentElement.querySelector('select'); if(!s2) return false; const st=Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype,'value').set; st.call(s2,String(v)); s2.dispatchEvent(new Event('change',{bubbles:true})); return true }, lab, val)
  if (nama.includes('Indoor')) { await set('Warna lapangan','abu'); await wait(600) }
  await p.evaluate(() => { const x=[...document.querySelectorAll('button')].find(y=>y.textContent.trim()==='Simpan'); x&&x.click() }); await wait(2400)
}
await ganti('Indoor / GOR')
await p.screenshot({ path: '/home/user/shots/dd1g-indoor.png' })
await ganti('Sepak bola (Indonesia)')
await p.screenshot({ path: '/home/user/shots/dd1g-bola.png' })
console.log('selesai')
await b.close()
