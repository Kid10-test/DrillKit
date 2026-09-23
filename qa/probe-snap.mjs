import puppeteer from 'puppeteer'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--mute-audio'] })
const p = await b.newPage(); await p.setViewport({ width: 1440, height: 980 })
await p.goto('http://localhost:5173/', { waitUntil: 'networkidle2' }); await wait(1500)
await p.evaluate(() => { const x=[...document.querySelectorAll('button')].find(y=>y.textContent.includes('Muat data contoh')); x&&x.click() })
await wait(3200)
await p.evaluate(() => { location.hash = '#/drill' }); await wait(2600)
console.log('tampilan tersimpan:', await p.evaluate(() => localStorage.getItem('drillkit.drillView')))
console.log('ada tombol snap?', await p.evaluate(() => [...document.querySelectorAll('button')].filter(x=>/snap|magnet|tempel/i.test(x.title||x.textContent)).map(x=>({t:x.title,tx:x.textContent.trim().slice(0,20)}))))
// ganti ke lapangan bola
await p.evaluate(() => { const x=[...document.querySelectorAll('button')].find(y=>(y.title||'')==='Pengaturan drill'); x&&x.click() }); await wait(1000)
await p.evaluate(() => { const x=[...document.querySelectorAll('button')].find(y=>y.textContent.trim()==='Sepak bola (Indonesia)'); x&&x.click() }); await wait(900)
await p.evaluate(() => { const x=[...document.querySelectorAll('button')].find(y=>y.textContent.trim()==='Simpan'); x&&x.click() }); await wait(2200)
// baca konfigurasi lapangan dari IndexedDB
const cfg = await p.evaluate(async () => {
  const db = await new Promise((res, rej) => { const r = indexedDB.open('drillkit'); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error) })
  const names = [...db.objectStoreNames]
  const out = {}
  for (const n of names) {
    const v = await new Promise((res) => { const tx = db.transaction(n,'readonly'); const q = tx.objectStore(n).getAll(); q.onsuccess=()=>res(q.result); q.onerror=()=>res(null) })
    out[n] = Array.isArray(v) ? v.length : typeof v
    if (n === 'drills' && Array.isArray(v)) out.drillField = v[0] ? v[0].field : null
  }
  return out
})
console.log(JSON.stringify(cfg, null, 2))
await b.close()
