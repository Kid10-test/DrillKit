import puppeteer from 'puppeteer'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--mute-audio'] })
const p = await b.newPage(); await p.setViewport({ width: 1000, height: 1400 })
await p.goto('http://localhost:4173/', { waitUntil: 'networkidle2' }); await wait(2200)
await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((y) => y.textContent.includes('Muat data contoh')); x && x.click() }); await wait(3400)
await p.evaluate(() => { location.hash = '#/absensi' }); await wait(1200)
await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((y) => y.textContent.trim() === 'Rekap'); x && x.click() }); await wait(1400)
const ambil = async (testid, file) => {
  const sebelum = (await b.pages()).length
  await p.click(`[data-testid="${testid}"]`)
  let h = null
  for (let i = 0; i < 40 && !h; i++) { await wait(250); const s = await b.pages(); if (s.length > sebelum) h = s[s.length - 1] }
  if (!h) return console.log('GAGAL ' + testid)
  await wait(900)
  await h.emulateMediaType('print')
  await h.setViewport({ width: 794, height: 1123 })
  await wait(400)
  await h.screenshot({ path: file, fullPage: true })
  await h.close()
  console.log('ok ' + file)
}
await ambil('tombol-laporan-bulanan', '/home/user/shots/d4-laporan.png')
await ambil('tombol-kartu-anggota', '/home/user/shots/d4-kartu.png')
await b.close()
