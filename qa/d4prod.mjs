// D4 — uji di produksi (4173) & portabel (file://)
import puppeteer from 'puppeteer'
import fs from 'node:fs'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const R = {}

for (const [nama, url] of [
  ['produksi', 'http://localhost:4173/'],
  ['portabel', 'file:///home/user/drillkit/portable/DrillKit.html'],
]) {
  const DL = `/home/user/drillkit/qa/dld4-${nama}`
  fs.rmSync(DL, { recursive: true, force: true }); fs.mkdirSync(DL, { recursive: true })
  const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--mute-audio', '--allow-file-access-from-files'] })
  const p = await b.newPage(); await p.setViewport({ width: 1400, height: 950 })
  const errs = []
  p.on('pageerror', (e) => errs.push(e.message.slice(0, 160)))
  p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)) })
  const cdp = await p.target().createCDPSession()
  await cdp.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: DL })
  await p.goto(url, { waitUntil: 'networkidle2' }); await wait(2400)
  await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((y) => y.textContent.includes('Muat data contoh')); x && x.click() })
  await wait(3600)

  await p.evaluate(() => { location.hash = '#/absensi' }); await wait(1400)
  await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((y) => y.textContent.trim() === 'Rekap'); x && x.click() })
  await wait(1400)

  const bukaJendela = async (testid) => {
    const sebelum = (await b.pages()).length
    await p.click(`[data-testid="${testid}"]`)
    let h = null
    for (let i = 0; i < 40 && !h; i++) {
      await wait(250)
      const semua = await b.pages()
      if (semua.length > sebelum) h = semua[semua.length - 1]
    }
    if (!h) return null
    await wait(700)
    const html = await h.content()
    await h.close()
    return html
  }
  const hitung = (s, n) => s.split(n).length - 1

  const h = {}
  h.kartuAda = await p.evaluate(() => !!document.querySelector('[data-testid="kartu-laporan-admin"]'))
  h.kalimat = await p.evaluate(() => document.querySelector('[data-testid="kalimat-ringkasan"]')?.innerText.trim().slice(0, 120) ?? '')

  const hLap = await bukaJendela('tombol-laporan-bulanan')
  h.laporan = hLap
    ? {
        judul: /<h1 class="judul">Laporan Kehadiran<\/h1>/.test(hLap),
        namaTim: hLap.includes('Marching Band Saya'),
        tabel: hitung(hLap, '<table'),
        tandaTangan: hLap.includes('Pelatih') && hLap.includes('Pembina / Ketua Tim'),
        oklch: /oklch\(|lab\(|color-mix\(/.test(hLap),
      }
    : null

  const hKartu = await bukaJendela('tombol-kartu-anggota')
  h.kartuSemua = hKartu ? { jumlah: hitung(hKartu, 'class="kartu"'), paraf: hKartu.includes('Paraf anggota') } : null

  await p.click('[data-testid="tombol-csv-matriks"]'); await wait(1300)
  await p.click('[data-testid="tombol-csv-ringkas"]'); await wait(1300)
  const csv = fs.readdirSync(DL).filter((f) => f.endsWith('.csv'))
  h.csv = csv
  for (const f of csv) {
    const isi = fs.readFileSync(`${DL}/${f}`, 'utf8')
    const baris = isi.replace(/^﻿/, '').split('\r\n').filter((x) => x.length)
    h[f] = { baris: baris.length, kolom: (baris[0].match(/,/g) ?? []).length + 1, contoh: baris[1]?.slice(0, 80) ?? '' }
  }

  // jalan keluar saat popup diblokir
  await p.evaluate(() => { window.open = () => null })
  await p.click('[data-testid="tombol-paket-lengkap"]'); await wait(1600)
  const htmlF = fs.readdirSync(DL).filter((f) => f.endsWith('.html'))
  h.fallback = { berkas: htmlF, toast: await p.evaluate(() => document.body.innerText.match(/Jendela cetak diblokir[^\n]*/)?.[0] ?? '') }

  await p.setViewport({ width: 390, height: 844 }); await wait(900)
  h.hp = await p.evaluate(() => {
    const k = document.querySelector('[data-testid="kartu-laporan-admin"]')
    if (!k) return { ada: false }
    const r = k.getBoundingClientRect()
    return { lebar: Math.round(r.width), meluber: document.documentElement.scrollWidth > window.innerWidth + 1 }
  })

  h.errors = errs
  R[nama] = h
  await b.close()
}

console.log(JSON.stringify(R, null, 2))
