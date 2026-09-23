// D4 — mode pratinjau paket laporan (dev 5173)
import puppeteer from 'puppeteer'
import fs from 'node:fs'
import { lewatSambutan } from './sambutan.mjs'
/* N14 — dialihkan dari server pengembangan (:5173) ke hasil build
   (:4173). Server pengembangan menyajikan ratusan modul sekali muat dan
   kehabisan memori di kotak pasir; karena itu rangkaian ini dulu tidak
   pernah bisa masuk daftar regresi. */
const BASE = process.env.BASE || 'http://localhost:4173'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const R = {}
const DL = '/home/user/drillkit/qa/dlpratinjau'; fs.rmSync(DL, { recursive: true, force: true }); fs.mkdirSync(DL, { recursive: true })

const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--mute-audio'] })
const p = await b.newPage(); await p.setViewport({ width: 1400, height: 950 })
const errs = []
p.on('pageerror', (e) => errs.push(e.message.slice(0, 140)))
p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 140)) })
const cdp = await p.target().createCDPSession()
await cdp.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: DL })

await p.goto(BASE + '/', { waitUntil: 'networkidle2' }); await wait(2000)
/* Layar sambutan muncul di setiap profil baru; tanpa ini rangkaian
   tidak bisa menyentuh apa pun. */
await lewatSambutan(p)
await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((y) => y.textContent.includes('Muat data contoh')); x && x.click() })
await wait(3400)
await p.evaluate(() => { location.hash = '#/absensi' }); await wait(1200)
await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((y) => y.textContent.trim() === 'Rekap'); x && x.click() })
await wait(1400)

const isiBingkai = async () => {
  await wait(900)
  const f = p.frames().find((x) => x.url() === 'about:srcdoc' || x.url().startsWith('data:'))
  if (!f) return null
  return f.content()
}
const hitung = (s, n) => s.split(n).length - 1

R.kartuAda = await p.evaluate(() => !!document.querySelector('[data-testid="kartu-laporan-admin"]'))

// --- laporan ---
await p.click('[data-testid="tombol-pratinjau-laporan"]')
R.modalTerbuka = await p.evaluate(() => !!document.querySelector('[data-testid="bingkai-pratinjau"]'))
const hLap = await isiBingkai()
R.laporan = hLap ? {
  judul: hLap.includes('<h1 class="judul">Laporan Kehadiran</h1>'),
  namaTim: hLap.includes('Marching Band Saya'),
  tabel: hitung(hLap, '<table'),
  tandaTangan: hLap.includes('Pembina / Ketua Tim'),
  oklch: /oklch\(|lab\(|color-mix\(/.test(hLap),
} : null

// unduh HTML dari dalam modal
await p.click('[data-testid="tombol-unduh-html"]'); await wait(1500)
R.unduhan = fs.readdirSync(DL)

// cetak dari dalam modal → jendela baru
const sebelum = (await b.pages()).length
await p.click('[data-testid="tombol-cetak-pratinjau"]')
let jendela = null
for (let i = 0; i < 24 && !jendela; i++) { await wait(250); const s = await b.pages(); if (s.length > sebelum) jendela = s[s.length - 1] }
R.jendelaCetak = !!jendela
if (jendela) await jendela.close()
await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((y) => y.textContent.trim() === 'Tutup'); x && x.click() })
await wait(600)

// --- kartu per anggota ---
const opsi = await p.evaluate(() => {
  const s = document.querySelector('[data-testid="pilih-anggota-kartu"]')
  return { nilai: s.options[1].value, nama: s.options[1].textContent }
})
await p.select('[data-testid="pilih-anggota-kartu"]', opsi.nilai); await wait(400)
await p.click('[data-testid="tombol-pratinjau-kartu"]')
const hKartu = await isiBingkai()
R.kartuSatu = hKartu ? { jumlah: hitung(hKartu, 'class="kartu"'), nama: hKartu.includes(opsi.nama), paraf: hKartu.includes('Paraf anggota') } : null
await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((y) => y.textContent.trim() === 'Tutup'); x && x.click() }); await wait(500)

// --- paket lengkap ---
await p.select('[data-testid="pilih-anggota-kartu"]', ''); await wait(300)
await p.click('[data-testid="tombol-pratinjau-paket"]')
const hPaket = await isiBingkai()
R.paket = hPaket ? { laporan: hPaket.includes('<h1 class="judul">Laporan Kehadiran</h1>'), kartu: hitung(hPaket, 'class="kartu"') } : null

// --- cetak diblokir → harus tetap menghasilkan berkas ---
await p.evaluate(() => { window.open = () => null })
await p.click('[data-testid="tombol-cetak-pratinjau"]'); await wait(1600)
R.blokir = {
  berkas: fs.readdirSync(DL).filter((f) => f.endsWith('.html')),
  toast: await p.evaluate(() => document.body.innerText.match(/Jendela cetak diblokir[^\n]*/)?.[0] ?? ''),
}
await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((y) => y.textContent.trim() === 'Tutup'); x && x.click() }); await wait(500)

// --- HP 390 px, modal pratinjau ---
await p.setViewport({ width: 390, height: 844 }); await wait(900)
await p.click('[data-testid="tombol-pratinjau-laporan"]'); await wait(1000)
R.hp = await p.evaluate(() => {
  const f = document.querySelector('[data-testid="bingkai-pratinjau"]')
  const m = f?.closest('.fixed')
  return {
    bingkaiAda: !!f,
    lebar: f ? Math.round(f.getBoundingClientRect().width) : 0,
    tinggi: f ? Math.round(f.getBoundingClientRect().height) : 0,
    meluber: document.documentElement.scrollWidth > window.innerWidth + 1,
    modalLebar: m ? Math.round(m.getBoundingClientRect().width) : 0,
  }
})

R.error = errs
console.log(JSON.stringify(R, null, 2))
await b.close()
