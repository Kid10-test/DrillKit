import puppeteer from 'puppeteer'
import fs from 'node:fs'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
fs.mkdirSync('/home/user/shots', { recursive: true })
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--mute-audio'] })
const p = await b.newPage(); await p.setViewport({ width: 1500, height: 1000 })
const tombol = (t) => p.evaluate((x)=>{ const el=[...document.querySelectorAll('button')].find(y=>y.textContent.trim()===x); if(!el||el.disabled) return false; el.click(); return true }, t)
const setSudut = (v) => p.evaluate((val)=>{
  const btn=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='↺ Kiri')
  const sel=btn&&btn.parentElement.querySelector('select'); if(!sel) return false
  const set=Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype,'value').set
  set.call(sel,String(val)); sel.dispatchEvent(new Event('change',{bubbles:true})); return true
}, v)
const scrub = (v) => p.evaluate((n)=>{
  const s=document.querySelector('[data-testid="garis-waktu"]'); if(!s) return
  const set=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set
  set.call(s,String(n)); s.dispatchEvent(new Event('input',{bubbles:true}))
}, v)
await p.goto('http://localhost:5173/', { waitUntil: 'networkidle2' }); await wait(1600)
await p.evaluate(()=>{ const x=[...document.querySelectorAll('button')].find(y=>y.textContent.includes('Muat data contoh')); x&&x.click() })
await wait(3400); await p.evaluate(()=>{ location.hash='#/drill' }); await wait(2800)
await tombol('Blok'); await wait(1200)
await p.keyboard.press('BracketRight'); await wait(1400)
await tombol('Blok'); await wait(1200)
await setSudut(90); await wait(700)
await tombol('Kanan ↻'); await wait(1700)
await p.keyboard.press('BracketLeft'); await wait(1500)
await scrub(0.45); await wait(600)
await p.screenshot({ path: '/home/user/shots/dd5-busur.png' })
console.log('selesai')
await b.close()
