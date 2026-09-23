// F3 — mode timpa & salinan (berkas diambil dari unduhan sesi ini sendiri)
import puppeteer from 'puppeteer'
import fs from 'node:fs'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const R = {}
const DL = '/home/user/drillkit/qa/dlf3b'; fs.rmSync(DL, { recursive: true, force: true }); fs.mkdirSync(DL, { recursive: true })

const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--mute-audio'] })
const p = await b.newPage(); await p.setViewport({ width: 1400, height: 950 })
const errs = []
p.on('pageerror', (e) => errs.push(e.message.slice(0, 160)))
p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)) })
const cdp = await p.target().createCDPSession()
await cdp.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: DL })
await p.goto('http://localhost:5173/', { waitUntil: 'networkidle2' }); await wait(2400)
await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((y) => y.textContent.includes('Muat data contoh')); x && x.click() }); await wait(3000)

const bukaModal = async () => {
  await p.evaluate(() => { location.hash = '#/drill' }); await wait(2200)
  await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((b) => b.title?.includes('Pengaturan drill')); x && x.click() }); await wait(900)
}
const unduhShow = async () => {
  await p.click('[data-testid="tombol-ekspor-show"]'); await wait(1600)
  return fs.readdirSync(DL).filter((f) => /-show-\d{4}-\d{2}-\d{2}\.json$/.test(f))[0]
}

await bukaModal()
const f = await unduhShow()
R.berkas = f
const data = JSON.parse(fs.readFileSync(`${DL}/${f}`, 'utf8'))
data.drill.name = 'Show revisi'
fs.writeFileSync(`${DL}/revisi.json`, JSON.stringify(data))

// set yang hanya ada di perangkat ini
await p.evaluate(async () => {
  const { db } = await import('/src/db/db.ts')
  const drills = await db.drills.toArray()
  const sets = await db.sets.where('drillId').equals(drills[0].id).toArray()
  await db.sets.put({ id: 'st_lokal_saja', drillId: drills[0].id, order: 50, name: 'Set lokal saja', counts: 4, points: { ...sets[0].points }, createdAt: Date.now() })
})
await wait(700)
R.sebelum = await p.evaluate(async () => {
  const { db } = await import('/src/db/db.ts')
  const drills = await db.drills.toArray()
  return { drill: drills.length, set: (await db.sets.where('drillId').equals(drills[0].id).toArray()).length }
})

// --- TIMPA ---
let input = await p.$('[data-testid="berkas-show"]')
await input.uploadFile(`${DL}/revisi.json`); await wait(1300)
R.modalTimpa = await p.evaluate(() => !!document.querySelector('[data-testid="pilih-mode-impor"]'))
await p.select('[data-testid="pilih-mode-impor"]', 'ganti'); await wait(300)
await p.click('[data-testid="tombol-proses-impor"]'); await wait(1500)
R.hasilTimpa = await p.evaluate(async () => {
  const { db } = await import('/src/db/db.ts')
  const drills = await db.drills.toArray()
  const sets = await db.sets.where('drillId').equals(drills[0].id).toArray()
  return {
    namaDrill: drills[0].name,
    jumlahSet: sets.length,
    setLokalHilang: !sets.some((s) => s.name === 'Set lokal saja'),
    toast: document.body.innerText.match(/Show "[^"]+" masuk[^\n]*/)?.[0] ?? '',
  }
})

// --- SALINAN ---
await bukaModal()
input = await p.$('[data-testid="berkas-show"]')
await input.uploadFile(`${DL}/revisi.json`); await wait(1300)
await p.select('[data-testid="pilih-mode-impor"]', 'salinan'); await wait(300)
await p.click('[data-testid="tombol-proses-impor"]'); await wait(1800)
R.hasilSalinan = await p.evaluate(async () => {
  const { db } = await import('/src/db/db.ts')
  const drills = await db.drills.toArray()
  const semua = await db.sets.toArray()
  return {
    jumlahDrill: drills.length,
    nama: drills.map((d) => d.name),
    setPerDrill: drills.map((d) => semua.filter((s) => s.drillId === d.id).length),
    toast: document.body.innerText.match(/Show "[^"]+" masuk[^\n]*/)?.[0] ?? '',
  }
})
// apakah tampilan pindah ke show baru?
R.drillAktif = await p.evaluate(() => {
  const sel = [...document.querySelectorAll('select')].find((s) => s.className.includes('w-40') || [...s.options].some((o) => /Show|Demo/.test(o.textContent)))
  return sel ? sel.value : null
})
R.idDrill = await p.evaluate(async () => {
  const { db } = await import('/src/db/db.ts')
  return (await db.drills.toArray()).map((d) => d.id)
})
R.errors = errs
console.log(JSON.stringify(R, null, 1))
await b.close()
