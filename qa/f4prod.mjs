// F4 — Panduan 1 halaman: produksi (4173) & portabel (file://)
import puppeteer from 'puppeteer'
import { execSync } from 'node:child_process'
import fs from 'node:fs'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const R = {}
const DL = '/home/user/drillkit/qa/dlf4p'; fs.rmSync(DL, { recursive: true, force: true }); fs.mkdirSync(DL, { recursive: true })

for (const [nama, url] of [
  ['produksi', 'http://localhost:4173/'],
  ['portabel', 'file:///home/user/drillkit/portable/DrillKit.html'],
]) {
  const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--mute-audio', '--allow-file-access-from-files'] })
  const p = await b.newPage(); await p.setViewport({ width: 1280, height: 900 })
  const errs = []
  p.on('pageerror', (e) => errs.push(e.message.slice(0, 140)))
  p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 140)) })
  await p.goto(url, { waitUntil: 'networkidle2' }); await wait(2400)
  await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((y) => y.textContent.includes('Muat data contoh')); x && x.click() })
  await wait(3600)

  const h = {}
  await p.evaluate(() => { location.hash = '#/' }); await wait(1400)
  h.tombolDasbor = await p.evaluate(() => !!document.querySelector('[data-testid="tombol-panduan-dasbor"]'))
  await p.click('[data-testid="tombol-panduan-dasbor"]'); await wait(1200)
  const f0 = p.frames().find((x) => x.url() === 'about:srcdoc' || x.url().startsWith('data:'))
  const isi0 = f0 ? await f0.content() : ''
  h.dasborBuka = !!f0
  h.dariDasbor = isi0.includes('Panduan Singkat DrillKit') && isi0.includes('Marching Band Saya')
  await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((y) => y.textContent.trim() === 'Tutup'); x && x.click() })
  await wait(600)

  await p.evaluate(() => { location.hash = '#/pengaturan' }); await wait(1600)
  h.kartuAda = await p.evaluate(() => !!document.querySelector('[data-testid="kartu-panduan"]'))
  await p.click('[data-testid="tombol-pratinjau-panduan"]'); await wait(1200)
  const f = p.frames().find((x) => x.url() === 'about:srcdoc' || x.url().startsWith('data:'))
  const isi = f ? await f.content() : ''
  h.isi = {
    tim: isi.includes('Marching Band Saya'),
    shortcut: isi.includes('Ctrl + Shift + Z'),
    macet: isi.includes('Kalau macet'),
    oklch: /oklch\(|lab\(|color-mix\(/.test(isi),
  }
  // cetak ke PDF & hitung halaman
  if (isi) {
    const ber = `${DL}/${nama}.pdf`
    const hp = await b.newPage()
    await hp.setContent(isi, { waitUntil: 'load' })
    fs.writeFileSync(ber, await hp.pdf({ format: 'A4', printBackground: true }))
    h.halaman = Number(execSync(`python3 -c "import pypdf;print(len(pypdf.PdfReader(r'${ber}').pages))"`).toString().trim())
    await hp.close()
  }
  await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((y) => y.textContent.trim() === 'Tutup'); x && x.click() })
  await wait(500)

  await p.setViewport({ width: 390, height: 844 }); await wait(900)
  h.hp = await p.evaluate(() => {
    const k = document.querySelector('[data-testid="kartu-panduan"]')
    return { lebar: k ? Math.round(k.getBoundingClientRect().width) : 0, meluber: document.documentElement.scrollWidth > window.innerWidth + 1 }
  })
  h.errors = errs
  R[nama] = h
  await b.close()
}
console.log(JSON.stringify(R, null, 2))
