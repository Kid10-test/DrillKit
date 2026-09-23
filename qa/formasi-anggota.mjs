/**
 * Uji tab **Formasi** milik anggota — dikunci karena tidak ada cacatnya.
 *
 * Uji ini ditulis setelah memeriksa tab ini dan menyimpulkan ia **sehat**.
 * Alasan ia tetap perlu ada: dua kali berturut-turut saya hampir
 * melaporkan cacat yang sebenarnya tidak ada —
 *
 *   1. Angka "Langkah dari garis 50 = -16" tampak meleset, padahal saya
 *      membandingkannya dengan titik milik set yang lain.
 *   2. Animasi "Putar" tampak mandek, padahal saya membacanya pada detik
 *      ketujuh dari animasi delapan detik.
 *
 * Keduanya kesalahan penguji, bukan aplikasi. Tanpa uji ini, pemeriksaan
 * berikutnya akan mengulang dua kekeliruan yang sama.
 *
 * Yang dikunci, semuanya terukur:
 *   · titiknya sendiri ADA dan lebih besar berarti daripada titik lain;
 *   · koordinatnya ditulis, dan sejalan dengan data di berkas;
 *   · tombol Putar benar-benar menggerakkan titik lalu memajukan set.
 */
import puppeteer from 'puppeteer'
import { lewatSambutan } from './sambutan.mjs'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const BASE = process.env.BASE || 'http://localhost:4173'
const UNDUH = path.join(os.tmpdir(), `unduh-fm-${Date.now()}`)
const BUKA = path.join(os.tmpdir(), `buka-fm-${Date.now()}`)
fs.mkdirSync(UNDUH, { recursive: true })
fs.mkdirSync(BUKA, { recursive: true })

const browser = await puppeteer.launch({
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  defaultViewport: { width: 390, height: 844 }, // HP —beginilah anggota memakainya
})
const errors = []

let lulus = 0
const gagal = []
const cek = (nama, syarat, keterangan = '') => {
  if (syarat) lulus += 1
  else gagal.push(`${nama}${keterangan ? ' — ' + keterangan : ''}`)
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const teks = (h) => h.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').trim())

/* -------------------------------- pelatih --------------------------------- */
const A = await browser.newPage()
A.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
A.on('pageerror', (e) => errors.push(String(e)))
A.on('dialog', async (d) => { await d.accept() })
await A.goto(BASE, { waitUntil: 'networkidle2' })
await lewatSambutan(A)
await wait(1200)
await A.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((y) => y.textContent.includes('Muat data contoh'))
  if (b) b.click()
})
await wait(4000)
await A.reload({ waitUntil: 'networkidle2' })
await wait(2500)
const klien = await A.target().createCDPSession()
await klien.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: UNDUH })
await A.goto(`${BASE}/#/berbagi`, { waitUntil: 'networkidle2' })
await wait(2200)
await (await A.$('[data-testid="unduh-per-anggota"]')).click()
let zip = null
for (let i = 0; i < 120 && !zip; i += 1) {
  await wait(250)
  const f = fs.readdirSync(UNDUH).filter((x) => x.endsWith('.zip'))
  if (f.length) zip = path.join(UNDUH, f[0])
}
cek('ZIP per anggota terunduh', zip != null)
execFileSync('unzip', ['-o', '-q', zip, '-d', BUKA])

const berkas = fs.readdirSync(BUKA).find((f) => f.includes('Andra'))
const isi = JSON.parse(fs.readFileSync(path.join(BUKA, berkas), 'utf8'))
const andra = isi.members.find((m) => /Andra/.test(m.name))
const urut = (isi.sets ?? []).slice().sort((a, b) => a.order - b.order)
const set1 = urut[0]

/* -------------------------------- anggota --------------------------------- */
const ctx = await browser.createBrowserContext()
const h = await ctx.newPage()
await h.setViewport({ width: 390, height: 844 })
h.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
h.on('pageerror', (e) => errors.push(String(e)))
h.on('dialog', async (d) => { await d.accept() })
await h.goto(BASE, { waitUntil: 'networkidle2' })
await wait(2500)
await h.click('[data-testid="pilih-member"]')
await wait(300)
await h.click('[data-testid="lanjut-pilih-mode"]')
await wait(1500)
await h.goto(`${BASE}/#/berbagi`, { waitUntil: 'networkidle2' })
await wait(2200)
await (await h.$('#pkg-input')).uploadFile(path.join(BUKA, berkas))
await wait(3000)
await h.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((y) => y.textContent.trim().toLowerCase() === 'formasi')
  if (b) b.click()
})
await wait(1800)

/* ======= 1. Titiknya sendiri ditandai dan lebih besar dari yang lain ======= */
{
  const geo = await h.evaluate(() => {
    // Ambil peta lapangannya: SVG dengan titik (<circle>) paling banyak.
    const svg = [...document.querySelectorAll('svg')]
      .sort((a, b) => b.querySelectorAll('circle').length - a.querySelectorAll('circle').length)[0]
    const lingkar = [...svg.querySelectorAll('circle')].map((c) => c.getBoundingClientRect().width)
    const emas = [...svg.querySelectorAll('circle')]
      .filter((c) => (c.getAttribute('stroke') ?? '').toLowerCase() === '#fbbf24')
      .map((c) => c.getBoundingClientRect().width)
    return { jumlah: lingkar.length, min: Math.min(...lingkar), maks: Math.max(...lingkar),
             emas: emas.length ? Math.max(...emas) : 0 }
  })
  cek('peta lapangan tergambar', geo.jumlah >= 18, JSON.stringify(geo))
  // Lingkaran emasnya harus ada dan lebih besar daripada titik biasa.
  cek('lingkaran emas penanda titik sendiri ada', geo.emas > 0, JSON.stringify(geo))
  cek('penanda titik sendiri lebih besar dari titik lain',
    geo.emas > geo.min * 1.5, `emas=${geo.emas} titik lain=${geo.min}`)
  cek('keterangan "lingkaran emas" ditulis',
    /lingkaran emas/i.test(await teks(h)))
}

/* ============ 2. Koordinatnya tertulis dan sejalan dengan berkasnya ======== */
{
  const t = await teks(h)
  cek('koordinat posisinya ditulis', /S\d+\s*·\s*YL\d+/i.test(t), t.slice(t.indexOf('Posisiku'), t.indexOf('Posisiku') + 120))
  cek('langkah dari garis 50 dihitung',
    /LANGKAH DARI GARIS 50/i.test(t))
  cek('langkah dari garis depan dihitung', /LANGKAH DARI GARIS DEPAN/i.test(t))
  // Hitung sendiri dari berkasnya, jangan percaya angka di layar mentah-mentah.
  const sYd = 0.625 // 8-to-5: 5 yard dalam 8 langkah
  const harap50 = Math.round((set1.points[andra.id].x / sYd) * 4) / 4
  cek('langkah dari garis 50 sesuai hitungan dari berkas',
    t.includes(`LANGKAH DARI GARIS 50 ${harap50}`), `harap ${harap50}`)
  const lebar = isi.team?.defaultField?.widthYd ?? 53.33
  const harapDepan = Math.round(((set1.points[andra.id].y + lebar / 2) / sYd) * 4) / 4
  cek('langkah dari garis depan sesuai hitungan dari berkas',
    t.includes(`LANGKAH DARI GARIS DEPAN ${harapDepan}`), `harap ${harapDepan}`)
}

/* ============== 3. Tombol Putar menggerakkan titik lalu maju set ========== */
{
  const namaSet = () => h.evaluate(() => {
    const el = [...document.querySelectorAll('p')].find((p) => /^Set \d+ —/.test(p.textContent.trim()))
    return el ? el.textContent.trim() : null
  })
  const bergerak = () => h.evaluate(() => {
    const svg = [...document.querySelectorAll('svg')]
      .sort((a, b) => b.querySelectorAll('circle').length - a.querySelectorAll('circle').length)[0]
    return [...svg.querySelectorAll('g')].filter((g) => g.getAttribute('transform')).length
  })

  const awal = await namaSet()
  const tombol = await h.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((y) => /Putar perpindahan/.test(y.textContent))
    return b ? { teks: b.textContent.trim(), tinggi: Math.round(b.getBoundingClientRect().height) } : null
  })
  cek('tombol Putar ada', tombol != null)
  // Sasaran sentuh yang layak di HP.
  cek('tombol Putar cukup tinggi untuk disentuh', (tombol?.tinggi ?? 0) >= 32, String(tombol?.tinggi))

  await h.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((y) => /Putar perpindahan/.test(y.textContent))
    b.click()
  })
  await wait(600)
  cek('titik benar-benar bergerak selama animasi', (await bergerak()) > 0, String(await bergerak()))

  // 16 count pada 120 BPM = 8 detik. Tunggu sampai selesai — jangan dibaca
  // pada detik ketujuh seperti percobaan pertama.
  let detik = 0
  let akhir = await namaSet()
  while (detik < 25 && akhir === awal) {
    await wait(1000)
    detik += 1
    akhir = await namaSet()
  }
  cek('set MAJU setelah animasi selesai', akhir !== awal, `${awal} -> ${akhir}`)
  cek('animasinya rampung dalam wajar (<= 20 detik)', detik <= 20, `${detik} detik`)
  cek('transform dibersihkan setelah selesai', (await bergerak()) === 0, String(await bergerak()))
}

const galatNyata = errors.filter((e) => !/ERR_INSUFFICIENT_RESOURCES/.test(e))
cek('tidak ada galat di konsol', galatNyata.length === 0, galatNyata.slice(0, 3).join(' | '))

console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) {
  console.log('\nYang gagal:')
  gagal.forEach((g) => console.log('  ✗ ' + g))
}
await browser.close()
if (gagal.length) process.exit(1)
