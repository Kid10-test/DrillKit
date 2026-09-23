import puppeteer from 'puppeteer'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--disable-setuid-sandbox'] })
const p = await browser.newPage()
await p.setViewport({ width: 1280, height: 1400 })
p.on('pageerror', (e) => console.log('PAGEERROR', String(e)))
await p.goto('http://localhost:5173/', { waitUntil: 'networkidle2' })
await wait(2200)
await p.evaluate(() => { location.hash = '#/drill' })
await wait(1800)
console.log('URL', p.url())
console.log('body punya "Drill Uji":', await p.evaluate(() => document.body.textContent.includes('Drill Uji Tempo Lagu')))
await p.evaluate(() => {
  const el = [...document.querySelectorAll('button,a,li,div')].find(b => b.textContent.trim() === 'Drill Uji Tempo Lagu' && b.offsetParent !== null)
  console.log('ketemu?', !!el)
  el?.click()
})
await wait(1500)
console.log('kartu-lagu:', await p.evaluate(() => !!document.querySelector('[data-testid="kartu-lagu-drill"]')))
console.log('judul2 tombol:', await p.evaluate(() => [...document.querySelectorAll('button[title]')].map(b=>b.getAttribute('title')).filter(t=>/present|Present/.test(t))))
console.log('teks Set 1 ada:', await p.evaluate(() => document.body.textContent.includes('Set 1')))
// tautkan lagu dulu
await p.evaluate(async () => {
  const { db } = await import('/src/db/db.ts')
  const s = await db.songs.where('title').equals('Lagu Uji Tempo Drill').first()
  const d = await db.drills.where('name').equals('Drill Uji Tempo Lagu').first()
  await db.drills.update(d.id, { songId: s.id, updatedAt: Date.now() })
})
await wait(1400)
await p.evaluate(() => {
  const el = [...document.querySelectorAll('button')].find(b => b.textContent.includes('Set 1') && b.offsetParent !== null)
  el?.click()
})
await wait(800)
console.log('info editor:', await p.$eval('[data-testid="info-set-ke-birama"]', e => e.textContent.trim()).catch(()=>'TIDAK ADA'))
const pr = await p.$('[title*="Mode presenter"]')
console.log('tombol presenter ketemu:', !!pr)
if (pr) {
  await pr.click()
  await wait(1500)
  console.log('tempo presenter:', await p.$eval('[data-testid="tempo-presenter"]', e => e.textContent.trim()).catch(()=>'TIDAK ADA'))
  console.log('counter presenter:', await p.evaluate(() => {
    const m = document.body.textContent.match(/Set\s*(\d+)\s*(?:dari|\/)\s*(\d+)/)
    return m ? m[0] : '?'
  }))
}
await browser.close()
