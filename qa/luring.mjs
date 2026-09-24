/**
 * Uji **luring** — aplikasi harus tetap bekerja tanpa jaringan sama sekali.
 *
 * Mengapa ini ada: luring adalah ALASAN arsitektur ini dipilih. Menolak
 * server bukan untuk menghemat uang, melainkan karena latihan berlangsung
 * di lapangan yang belum tentu ada sinyal. Kalau luring ini rusah, seluruh
 * argumen itu runtuh — dan tidak ada uji yang akan memberitahu kita.
 *
 * Diuji dalam keadaan jaringan benar-benar dimatikan (bukan sekadar
 * peladen yang lambat): aplikasi dimuat ulang, materinya harus masih ada,
 * dan tombol Perbarui harus gagal dengan JUJUR tanpa merusak materi yang
 * sudah tersimpan — karena salinan terakhir itulah jaring pengamannya.
 */
import puppeteer from 'puppeteer'
import { lewatSambutan } from './sambutan.mjs'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { DIST } from './lokasi.mjs'

const BASE = process.env.BASE || 'http://localhost:4173'
const PAKET = path.join(DIST, 'paket.json')
const UNDUH = path.join(os.tmpdir(), 'unduh-luring')
fs.mkdirSync(UNDUH, { recursive: true })
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

let lulus = 0
const gagal = []
const cek = (nama, syarat, keterangan = '') => {
  if (syarat) lulus += 1
  else gagal.push(`${nama}${keterangan ? ' — ' + keterangan : ''}`)
}

const browser = await puppeteer.launch({
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  defaultViewport: { width: 1300, height: 1000 },
})

const matikan = async (h, on) => {
  const c = await h.target().createCDPSession()
  await c.send('Network.enable')
  await c.send('Network.emulateNetworkConditions', {
    offline: on, latency: 0, downloadThroughput: -1, uploadThroughput: -1,
  })
}

try {
  // Pelatih: ekspor materi, lalu terbitkan sebagai paket.json
  const A = await browser.newPage()
  A.on('dialog', async (d) => { await d.accept() })
  await A.goto(BASE, { waitUntil: 'networkidle2' })
  await wait(1200)
  await lewatSambutan(A)
  await wait(1200)
  await A.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((y) => y.textContent.includes('Muat data contoh'))
    if (b) b.click()
  })
  await wait(4500)
  const cdp = await A.target().createCDPSession()
  await cdp.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: UNDUH })
  await A.goto(`${BASE}/#/berbagi`, { waitUntil: 'networkidle2' })
  await wait(2200)
  await (await A.$('[data-testid="unduh-grup"]')).click()
  let f = null
  for (let i = 0; i < 120 && !f; i += 1) {
    await wait(250)
    const x = fs.readdirSync(UNDUH).filter((y) => y.endsWith('.json'))
    if (x.length) f = path.join(UNDUH, x[0])
  }
  fs.writeFileSync(PAKET, fs.readFileSync(f))
  cek('1: materi diterbitkan di alamatnya', fs.existsSync(PAKET))

  /* ===== Anggota ambil materi, lalu LURING ===== */
  const B = await (await browser.createBrowserContext()).newPage()
  B.on('dialog', async (d) => { await d.accept() })
  await B.goto(BASE, { waitUntil: 'networkidle2' })
  await wait(2500)
  await B.click('[data-testid="pilih-member"]')
  await wait(300)
  await B.click('[data-testid="lanjut-pilih-mode"]')
  await wait(1500)
  await B.goto(`${BASE}/#/berbagi`, { waitUntil: 'networkidle2' })
  await wait(2500)
  await (await B.$('[data-testid="ambil-materi"]')).click()
  await wait(3200)

  // Tunggu service worker benar-benar menguasai halaman, atau "luring" hanya
  // berarti "halamannya sudah keburu dimuat".
  const siap = await B.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return 'tidak didukung'
    for (let i = 0; i < 60; i += 1) {
      const r = await navigator.serviceWorker.getRegistration()
      if (r && r.active) return 'aktif'
      await new Promise((x) => setTimeout(x, 500))
    }
    return 'tidak pernah aktif'
  })
  cek('2: service worker aktif — tanpa ini "luring" hanya berarti halamannya keburu dimuat',
    siap === 'aktif', String(siap))

  const teks = (h) => h.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').trim())

  await matikan(B, true)
  await wait(600)
  const err = []
  B.on('pageerror', (e) => err.push(String(e).slice(0, 120)))
  await B.reload({ waitUntil: 'domcontentloaded' })
  await wait(3500)
  const t = await teks(B)
  cek('3: aplikasi KEMBALI saat dimuat ulang tanpa jaringan', t.length > 40, t.slice(0, 160))
  cek('3: tidak ada galat saat luring', err.length === 0, err.slice(0, 2).join(' | '))

  const keadaan = await B.evaluate(async () => {
    const db = await new Promise((res) => { const q = indexedDB.open('drillkit'); q.onsuccess = () => res(q.result) })
    const p = await new Promise((res) => {
      const q = db.transaction(['packages'], 'readonly').objectStore('packages').get('current')
      q.onsuccess = () => res(q.result)
    })
    db.close()
    return { tim: p?.data?.team?.teamName ?? null, anggota: (p?.data?.members ?? []).length }
  })
  cek('4: materi masih ADA setelah luring', keadaan.tim != null, JSON.stringify(keadaan))
  cek('4: daftar anggotanya utuh', keadaan.anggota === 18, String(keadaan.anggota))

  // Tombol Perbarui saat luring: harus gagal dengan jujur, tanpa merusak materi.
  const tombol = await B.$('[data-testid="perbarui-alamat"]')
  cek('5: tombol Perbarui tetap ada saat luring', tombol != null)
  if (tombol) {
    await tombol.click()
    let terlihat = ''
    for (let i = 0; i < 20; i += 1) {
      await wait(300)
      const s = await teks(B)
      if (/Gagal mengambil|Tidak ada berkas/i.test(s)) { terlihat = s; break }
    }
    cek('5: Perbarui saat luring gagal dengan JUJUR, bukan diam saja',
      terlihat !== '', terlihat.slice(-160))
    const sisa = await B.evaluate(async () => {
      const db = await new Promise((res) => { const q = indexedDB.open('drillkit'); q.onsuccess = () => res(q.result) })
      const p = await new Promise((res) => {
        const q = db.transaction(['packages'], 'readonly').objectStore('packages').get('current')
        q.onsuccess = () => res(q.result)
      })
      db.close()
      return p?.data?.team?.teamName ?? null
    })
    cek('5: materi yang tersimpan TIDAK rusak karena gagal mengambil',
      sisa === keadaan.tim, `${sisa} lawan ${keadaan.tim}`)
  }
  await matikan(B, false)
} finally {
  try { fs.unlinkSync(PAKET) } catch { /* tidak apa-apa */ }
  await browser.close()
}

console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) {
  for (const g of gagal) console.log('  \u2717 ' + g)
  process.exitCode = 1
}
