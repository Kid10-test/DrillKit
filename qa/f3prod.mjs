// F3 — uji di produksi (4173) & portabel (file://)
import puppeteer from 'puppeteer'
import fs from 'node:fs'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const R = {}

for (const [nama, url] of [['produksi', 'http://localhost:4173/'], ['portabel', 'file:///home/user/drillkit/portable/DrillKit.html']]) {
  const DL = `/home/user/drillkit/qa/dlf3-${nama}`
  fs.rmSync(DL, { recursive: true, force: true }); fs.mkdirSync(DL, { recursive: true })
  const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--mute-audio', '--allow-file-access-from-files'] })
  const p = await b.newPage(); await p.setViewport({ width: 1400, height: 950 })
  const errs = []
  p.on('pageerror', (e) => errs.push(e.message.slice(0, 160)))
  p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)) })
  const cdp = await p.target().createCDPSession()
  await cdp.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: DL })
  await p.goto(url, { waitUntil: 'networkidle2' }); await wait(2400)
  await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((y) => y.textContent.includes('Muat data contoh')); x && x.click() }); await wait(3200)

  await p.evaluate(() => { location.hash = '#/drill' }); await wait(2400)
  await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((b) => b.title?.includes('Pengaturan drill')); x && x.click() }); await wait(900)
  const h = { kartuAda: await p.evaluate(() => !!document.querySelector('[data-testid="kartu-berbagi-show"]')) }

  await p.click('[data-testid="tombol-ekspor-show"]'); await wait(2200)
  const f = fs.readdirSync(DL).filter((x) => x.endsWith('.json'))
  h.berkas = f
  if (f.length) {
    const d = JSON.parse(fs.readFileSync(`${DL}/${f[0]}`, 'utf8'))
    h.isi = { format: d.format, drill: d.drill?.name, set: d.sets?.length, lagu: d.songs?.length, anggota: d.members?.length, tokenKosong: (d.members ?? []).every((m) => !m.token) }
    // sunting seperti pelatih lain, lalu impor balik
    d.sets.push({ id: 'st_teman_prod', drillId: d.drill.id, order: 90, name: 'Set dari pelatih lain', counts: 8, points: { ...d.sets[0].points }, createdAt: Date.now() })
    const berkas = `${DL}/revisi.json`
    fs.writeFileSync(berkas, JSON.stringify(d))
    const input = await p.$('[data-testid="berkas-show"]')
    await input.uploadFile(berkas); await wait(1500)
    h.modal = await p.evaluate(() => !!document.querySelector('[data-testid="pilih-mode-impor"]'))
    await p.select('[data-testid="pilih-mode-impor"]', 'gabung'); await wait(300)
    await p.click('[data-testid="tombol-proses-impor"]'); await wait(1800)
    h.toast = await p.evaluate(() => document.body.innerText.match(/Show "[^"]+" masuk[^\n]*/)?.[0] ?? '')
    h.setBertambah = await p.evaluate(() => {
      const el = [...document.querySelectorAll('option,button')].find((x) => x.textContent?.includes('Set dari pelatih lain'))
      return !!el
    })
  }
  h.errors = errs
  R[nama] = h
  await b.close()
}
console.log(JSON.stringify(R, null, 1))
