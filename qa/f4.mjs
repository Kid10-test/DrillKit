// F4 — Panduan 1 halaman (dev 5173)
import puppeteer from 'puppeteer'
import fs from 'node:fs'
import { execSync } from 'node:child_process'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const R = {}
const DL = '/home/user/drillkit/qa/dlf4'; fs.rmSync(DL, { recursive: true, force: true }); fs.mkdirSync(DL, { recursive: true })

const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--mute-audio'] })
const p = await b.newPage(); await p.setViewport({ width: 1400, height: 950 })
const errs = []
p.on('pageerror', (e) => errs.push(e.message.slice(0, 140)))
p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 140)) })
const cdp = await p.target().createCDPSession()
await cdp.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: DL })

await p.goto('http://localhost:5173/', { waitUntil: 'networkidle2' }); await wait(1800)
await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((y) => y.textContent.includes('Muat data contoh')); x && x.click() })
await wait(3400)

/* ---------------- A. Tombol di Dashboard ---------------- */
R.dasbor = await p.evaluate(() => !!document.querySelector('[data-testid="tombol-panduan-dasbor"]'))
await p.click('[data-testid="tombol-panduan-dasbor"]'); await wait(1200)
R.dasborBuka = await p.evaluate(() => !!document.querySelector('[data-testid="bingkai-panduan"]'))
if (R.dasborBuka) {
  await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((y) => y.textContent.trim() === 'Tutup'); x && x.click() })
  await wait(600)
}

/* ---------------- B. Isi panduan ---------------- */
const isiBingkai = async () => {
  await wait(1000)
  const f = p.frames().find((x) => x.url() === 'about:srcdoc' || x.url().startsWith('data:'))
  return f ? f.content() : null
}

await p.evaluate(() => { location.hash = '#/pengaturan' }); await wait(1600)
R.kartuAda = await p.evaluate(() => !!document.querySelector('[data-testid="kartu-panduan"]'))
await p.click('[data-testid="tombol-pratinjau-panduan"]')
const html = await isiBingkai()
R.htmlDidapat = !!html
if (html) {
  const teks = html
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
  R.isi = {
    namaTim: html.includes('Marching Band Saya'),
    judul: html.includes('Panduan Singkat DrillKit'),
    anggota: /18 anggota aktif/.test(teks),
    sesiDrillLagu: /\d+ sesi · \d+ drill · \d+ lagu/.test(teks),
    section: teks.includes('Brass, Battery, Pit, Color Guard, FC') || teks.includes('Brass, Battery'),
    langkah: (html.match(/<li>/g) ?? []).length,
    tabel: (html.match(/<table/g) ?? []).length,
    mulaiDariSini: html.includes('Mulai dari sini'),
    isiMenu: html.includes('Isi tiap menu'),
    shortcut: html.includes('Shortcut di editor formasi') && html.includes('Ctrl + Shift + Z'),
    macet: html.includes('Kalau macet') && html.includes('Pulihkan backup'),
    ingat: html.includes('Yang perlu diingat') && html.includes('hanya di perangkat ini'),
    oklch: /oklch\(|lab\(|color-mix\(/.test(html),
    panjangKarakter: teks.length,
  }

  /* ---------------- C. Satu halaman A4? ---------------- */
  const h = await b.newPage()
  await h.setContent(html, { waitUntil: 'load' })
  const pdf = await h.pdf({ format: 'A4', printBackground: true })
  fs.writeFileSync(`${DL}/panduan.pdf`, pdf)
  R.halaman = Number(
    execSync(`python3 -c "import pypdf;print(len(pypdf.PdfReader(r'${DL}/panduan.pdf').pages))"`).toString().trim(),
  )
  await h.close()

  /* ---------------- C2. Kasus terberat: tim besar ---------------- */
  const berat = await p.evaluate(async () => {
    const { htmlPanduan } = await import('/src/lib/panduan.ts')
    return htmlPanduan({
      namaTim: 'Marching Band Garuda Nusantara Sejahtera Yogyakarta',
      kota: 'Yogyakarta',
      pelatih: 'Bapak Suryo Wibowo Santoso',
      section: [
        { id: 'a', label: 'Brass', short: 'BR', dot: '#f59e0b' },
        { id: 'b', label: 'Woodwind', short: 'WW', dot: '#38bdf8' },
        { id: 'c', label: 'Battery', short: 'PC', dot: '#fb7185' },
        { id: 'd', label: 'Pit', short: 'PT', dot: '#a78bfa' },
        { id: 'e', label: 'Color Guard', short: 'CG', dot: '#34d399' },
        { id: 'f', label: 'FC', short: 'FC', dot: '#f472b6' },
        { id: 'g', label: 'Drum Major', short: 'DM', dot: '#facc15' },
        { id: 'h', label: 'Percussion', short: 'PE', dot: '#fb923c' },
      ],
      anggotaAktif: 80, sesi: 42, drill: 7, lagu: 15, hariBackup: 7, portabel: true,
    })
  })
  const h2 = await b.newPage()
  await h2.setContent(berat, { waitUntil: 'load' })
  const pdf2 = await h2.pdf({ format: 'A4', printBackground: true })
  fs.writeFileSync(`${DL}/panduan-berat.pdf`, pdf2)
  R.halamanBerat = Number(
    execSync(`python3 -c "import pypdf;print(len(pypdf.PdfReader(r'${DL}/panduan-berat.pdf').pages))"`).toString().trim(),
  )
  R.beratTim = berat.includes('Marching Band Garuda Nusantara Sejahtera Yogyakarta') && berat.includes('80 anggota aktif')
  await h2.close()
}

/* ---------------- D. Unduh & cetak ---------------- */
await p.click('[data-testid="tombol-unduh-panduan"]'); await wait(1500)
R.unduhan = fs.readdirSync(DL).filter((f) => f.endsWith('.html'))

const sebelum = (await b.pages()).length
await p.click('[data-testid="tombol-cetak-panduan"]')
let jendela = null
for (let i = 0; i < 24 && !jendela; i++) { await wait(250); const s = await b.pages(); if (s.length > sebelum) jendela = s[s.length - 1] }
R.jendelaCetak = !!jendela
if (jendela) await jendela.close()
await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((y) => y.textContent.trim() === 'Tutup'); x && x.click() })
await wait(600)

/* ---------------- E. Cetak diblokir ---------------- */
await p.evaluate(() => { window.open = () => null })
await p.click('[data-testid="tombol-pratinjau-panduan"]'); await wait(1000)
await p.click('[data-testid="tombol-cetak-panduan"]'); await wait(1500)
R.blokir = {
  berkas: fs.readdirSync(DL).filter((f) => f.endsWith('.html')),
  toast: await p.evaluate(() => document.body.innerText.match(/Jendela cetak diblokir[^\n]*/)?.[0] ?? ''),
}
await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((y) => y.textContent.trim() === 'Tutup'); x && x.click() })
await wait(600)

/* ---------------- F. HP 390 px ---------------- */
await p.setViewport({ width: 390, height: 844 }); await wait(1000)
R.hp = await p.evaluate(() => {
  const k = document.querySelector('[data-testid="kartu-panduan"]')
  if (!k) return { ada: false }
  const r = k.getBoundingClientRect()
  return {
    ada: true,
    lebar: Math.round(r.width),
    meluber: document.documentElement.scrollWidth > window.innerWidth + 1,
    tombol: [...k.querySelectorAll('button')].map((x) => Math.round(x.getBoundingClientRect().height)),
  }
})

R.error = errs
console.log(JSON.stringify(R, null, 2))
await b.close()
