import puppeteer from 'puppeteer'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
async function jalankan(alamat, label) {
  const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--mute-audio','--allow-file-access-from-files'] })
  const p = await b.newPage(); await p.setViewport({ width: 1440, height: 1000 })
  const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0,160)))
  p.on('console', m => { if (m.type()==='error') errs.push('console: '+m.text().slice(0,160)) })
  const R = { label }
  const posisi = () => p.evaluate(() => [...document.querySelectorAll('circle[data-titik="1"]')].map(c => [Number(c.getAttribute('cx')), Number(c.getAttribute('cy'))]))
  const tombol = (t) => p.evaluate((x)=>{ const el=[...document.querySelectorAll('button')].find(y=>y.textContent.trim()===x); if(!el||el.disabled) return false; el.click(); return true }, t)
  const tombolNonaktif = (t) => p.evaluate((x)=>{ const el=[...document.querySelectorAll('button')].find(y=>y.textContent.trim()===x); return el?el.disabled:null }, t)
  const pusat = (d) => [d.reduce((a,q)=>a+q[0],0)/d.length, d.reduce((a,q)=>a+q[1],0)/d.length]
  const beda = (a,c) => a.every((q,i)=>Math.hypot(q[0]-c[i][0], q[1]-c[i][1])<0.02)
  await p.goto(alamat, { waitUntil: 'networkidle2' }); await wait(2200)
  await p.evaluate(() => { const x=[...document.querySelectorAll('button')].find(y=>y.textContent.includes('Muat data contoh')); x&&x.click() })
  await wait(3600); await p.evaluate(() => { location.hash = '#/drill' }); await wait(2800)
  R.adaPanel = await p.evaluate(() => !!([...document.querySelectorAll('h2')].find(h=>h.textContent.includes('Alat gerak massa'))))
  const A = await posisi()
  R.putar = await tombol('Kanan ↻'); await wait(900)
  const B = await posisi(); const cA = pusat(A), cB = pusat(B)
  R.pusatTetap = Math.hypot(cA[0]-cB[0], cA[1]-cB[1]) < 0.02
  R.bentukKekal = A.map(q=>Math.hypot(q[0]-cA[0],q[1]-cA[1])).sort((x,y)=>x-y)
    .every((v,i)=>Math.abs(v - B.map(q=>Math.hypot(q[0]-cB[0],q[1]-cB[1])).sort((x,y)=>x-y)[i]) < 0.02)
  await p.keyboard.down('Control'); await p.keyboard.press('KeyZ'); await p.keyboard.up('Control'); await wait(1000)
  R.undoKembali = beda(A, await posisi())
  R.cermin = await tombol('Kiri ⇄ Kanan'); await wait(900)
  const C = await posisi(); const SP = (pusat(A)[0]+pusat(C)[0])/2
  R.cerminTepat = A.every((q,i)=>Math.abs(C[i][0]-(2*SP-q[0]))<0.02)
  await p.keyboard.down('Control'); await p.keyboard.press('KeyZ'); await p.keyboard.up('Control'); await wait(1000)
  R.geser = await tombol('Ke depan'); await wait(900)
  const D = await posisi()
  R.geserJarak = Math.round((D[0][1]-A[0][1])*1000)/1000
  await p.keyboard.down('Control'); await p.keyboard.press('KeyZ'); await p.keyboard.up('Control'); await wait(1000)
  const ling = await p.$$('circle[data-titik="1"]')
  await ling[0].click(); await wait(600)
  R.putarNonaktifSatuTitik = await tombolNonaktif('Kanan ↻')
  R.cerminAktifSatuTitik = !(await tombolNonaktif('Kiri ⇄ Kanan'))
  R.error = errs
  await b.close(); return R
}
console.log(JSON.stringify(await jalankan('http://localhost:4173/', 'produksi (4173)'), null, 2))
console.log(JSON.stringify(await jalankan('file:///home/user/drillkit/portable/DrillKit.html', 'portabel'), null, 2))
