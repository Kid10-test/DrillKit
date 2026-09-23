/**
 * Uji: mode anggota tidak bisa masuk mode pelatih.
 *
 * Tiga jalan keluar yang diuji, karena yang pertama saja tidak cukup:
 *
 * 1. **Tombol "Mode pelatih"** — harus ditahan PIN.
 * 2. **Rute pelatih lewat URL langsung** — menyaring menu tidak menghalangi
 *    mengetik `#/anggota` di bilah alamat. Ini jalan yang paling mudah
 *    luput, dan yang paling sering dipakai anak yang penasaran.
 * 3. **Tanpa PIN** — keluar tetap diizinkan, supaya pelatih tidak pernah
 *    mengurung dirinya sendiri.
 */
import puppeteer from 'puppeteer'
import { lewatSambutan } from './sambutan.mjs'

const BASE = process.env.BASE || 'http://localhost:5173'
const browser = await puppeteer.launch({
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  defaultViewport: { width: 1400, height: 1100 },
})
const p = await browser.newPage()
const errors = []
p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
p.on('pageerror', (e) => errors.push(String(e)))
p.on('dialog', async (d) => { await d.accept() })

let lulus = 0
const gagal = []
const cek = (nama, syarat, keterangan = '') => {
  if (syarat) lulus += 1
  else gagal.push(`${nama}${keterangan ? ' — ' + keterangan : ''}`)
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const ada = async (sel) => (await p.$(sel)) != null
const tombol = (t) =>
  p.evaluate((x) => {
    const b = [...document.querySelectorAll('button')].find((y) => y.textContent.includes(x))
    if (!b || b.disabled) return false
    b.click()
    return true
  }, t)
const klik = async (sel) => {
  const e = await p.$(sel)
  if (!e) throw new Error(`tidak ketemu: ${sel}`)
  await e.click()
  await wait(300)
}
const hashPin = (pin) => {
  let h = 5381
  const s = `drillkit::${pin}`
  for (let i = 0; i < s.length; i += 1) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return `k${(h >>> 0).toString(36)}`
}

await p.goto(BASE, { waitUntil: 'networkidle2' })
await lewatSambutan(p)
await wait(1500)
await tombol('Muat data contoh')
await wait(4000)
await p.reload({ waitUntil: 'networkidle2' })
await wait(2500)

// ------------------------- pasang PIN, lalu masuk mode anggota lewat antarmuka
await p.evaluate((h) => {
  localStorage.setItem('drillkit.kiosk.pin', h)
  localStorage.setItem('drillkit.kiosk.hint', 'angka punggung')
}, hashPin('1234'))

await p.goto(`${BASE}/#/berbagi`, { waitUntil: 'networkidle2' })
await wait(2000)

const tombolMasuk = await p.$('[data-testid="masuk-mode-anggota"]')
cek('tombol masuk mode anggota ada', tombolMasuk != null)
if (tombolMasuk) {
  await tombolMasuk.click()
  await wait(700)
}
{
  // PIN sudah terpasang, jadi modalnya mengatakan mode akan TERKUNCI.
  const t = await p.evaluate(() => {
    const e = document.querySelector('[data-testid="modal-masuk-anggota"]')
    return e ? e.innerText.replace(/\s+/g, ' ') : null
  })
  cek('modal masuk menyebut terkunci', /terkunci/i.test(t ?? ''), (t ?? '').slice(0, 120))
  cek('modal masuk sudah tidak menawarkan PIN baru',
    !(await ada('[data-testid="pin-baru-mode"]')))
}
if (await ada('[data-testid="lanjut-masuk-anggota"]')) {
  await klik('[data-testid="lanjut-masuk-anggota"]')
  await wait(2500)
}

const mode = () => p.evaluate(() => localStorage.getItem('drillkit.mode'))
const lokasi = () => p.evaluate(() => location.hash)
const menu = () =>
  p.evaluate(() => [...document.querySelectorAll('nav a[href^="#/"]')].map((a) => a.textContent.trim()))

cek('perangkat kini mode anggota', (await mode()) === 'member', String(await mode()))

// ============================ 1. RUTE PELATIH DIBLOKIR ======================
{
  // Ini jalan yang paling mudah luput: menu sudah disaring, tetapi URL
  // langsung tidak melewati menu sama sekali.
  for (const r of ['/anggota', '/pengaturan', '/evaluasi', '/data']) {
    await p.goto(`${BASE}/#${r}`, { waitUntil: 'networkidle2' })
    await wait(1200)
    cek(`rute ${r} dialihkan ke /berbagi`, (await lokasi()) === '#/berbagi', await lokasi())
  }
  // Dashboard pun — rute bawaan, mudah luput.
  await p.goto(`${BASE}/#/`, { waitUntil: 'networkidle2' })
  await wait(1200)
  cek('dashboard dialihkan ke /berbagi', (await lokasi()) === '#/berbagi', await lokasi())
}
{
  const m = await menu()
  cek('menu tinggal sedikit', m.length <= 2, JSON.stringify(m))
  cek('tidak ada menu pelatih di menu',
    !m.some((l) => /Pengaturan|Impor & ekspor|Evaluasi &|Absensi|Dashboard/.test(l)),
    JSON.stringify(m))
}

// ========================= 2. TOMBOL KELUAR DITAHAN PIN =====================
await p.goto(`${BASE}/#/berbagi`, { waitUntil: 'networkidle2' })
await wait(1800)
{
  const tombolKeluar = await p.$('[data-testid="keluar-mode-anggota"]')
  cek('tombol keluar ada', tombolKeluar != null)
  if (tombolKeluar) {
    await tombolKeluar.click()
    await wait(700)
  }
  cek('modal keluar tampil', await ada('[data-testid="modal-keluar-anggota"]'))
  cek('kolom PIN diminta', await ada('[data-testid="pin-mode"]'))
  cek('petunjuk PIN ditampilkan', /angka punggung/.test(
    await p.evaluate(() => {
      const e = document.querySelector('[data-testid="modal-keluar-anggota"]')
      return e ? e.innerText : ''
    })))

  // PIN salah -> tetap anggota.
  await p.type('[data-testid="pin-mode"]', '9999')
  await klik('[data-testid="lanjut-keluar-anggota"]')
  await wait(900)
  cek('PIN salah: galat tampil', await ada('[data-testid="galat-mode"]'))
  cek('PIN salah: tetap mode anggota', (await mode()) === 'member', String(await mode()))
  cek('PIN salah: tidak kembali ke mode pelatih', (await lokasi()) === '#/berbagi', await lokasi())

  // PIN benar -> keluar.
  await p.type('[data-testid="pin-mode"]', '1234')
  await klik('[data-testid="lanjut-keluar-anggota"]')
  await wait(2500)
  cek('PIN benar: kembali ke mode pelatih', (await mode()) === 'coach', String(await mode()))
}
{
  // Keluar memuat ulang halaman supaya mode dibaca ulang. Menunggu
  // keadaannya, bukan menebak-nebak waktunya — kalau tidak, menu terbaca
  // kosong hanya karena halaman belum selesai dimuat.
  let m = []
  for (let i = 0; i < 20 && m.length === 0; i += 1) {
    await wait(700)
    m = await menu()
  }
  if (m.length === 0) {
    console.log('DIAG lokasi:', await p.evaluate(() => location.hash))
    console.log('DIAG jumlah <nav>:', await p.evaluate(() => document.querySelectorAll('nav').length))
    console.log('DIAG isi halaman:', await p.evaluate(() =>
      (document.body.innerText || '').replace(/\s*\n\s*/g, ' | ').slice(0, 200)))
    console.log('DIAG mode:', await p.evaluate(() => localStorage.getItem('drillkit.mode')))
  }
  cek('mode pelatih: menu lengkap lagi', m.length >= 8, String(m.length))
}

// ================== 3. TANPA PIN: KELUAR TETAP BOLEH (anti-jebakan) =========
{
  await p.evaluate(() => localStorage.removeItem('drillkit.kiosk.pin'))
  await p.evaluate(() => localStorage.setItem('drillkit.mode', 'member'))
  await p.reload({ waitUntil: 'networkidle2' })
  await wait(2200)
  cek('masuk mode anggota tanpa PIN', (await mode()) === 'member')

  const tombolKeluar = await p.$('[data-testid="keluar-mode-anggota"]')
  if (tombolKeluar) { await tombolKeluar.click(); await wait(700) }
  cek('tanpa PIN: modal tetap tampil', await ada('[data-testid="modal-keluar-anggota"]'))
  cek('tanpa PIN: kolom PIN TIDAK diminta', !(await ada('[data-testid="pin-mode"]')))
  cek('tanpa PIN: peringatan bahwa belum terkunci', await ada('[data-testid="tanpa-pin-mode"]'))
  {
    const t = await p.evaluate(() => {
      const e = document.querySelector('[data-testid="tanpa-pin-mode"]')
      return e ? e.innerText.replace(/\s+/g, ' ') : ''
    })
    cek('tanpa PIN: jujur mengakui belum terkunci', /belum terkunci|belum dikunci/i.test(t), t)
  }
  if (await ada('[data-testid="lanjut-keluar-anggota"]')) {
    await klik('[data-testid="lanjut-keluar-anggota"]')
    await wait(2500)
  }
  // Inilah yang mencegah pelatih mengurung dirinya sendiri.
  cek('tanpa PIN: keluar DIizinkan (tidak mengurung pelatih)',
    (await mode()) === 'coach', String(await mode()))
}

// ============ 4. ANJURAN PASANG PIN saat masuk tanpa PIN ====================
{
  await p.goto(`${BASE}/#/berbagi`, { waitUntil: 'networkidle2' })
  await wait(1800)
  const tombolMasuk = await p.$('[data-testid="masuk-mode-anggota"]')
  if (tombolMasuk) { await tombolMasuk.click(); await wait(700) }
  cek('tanpa PIN: masuk mode anggota menawarkan PIN baru',
    await ada('[data-testid="pin-baru-mode"]'))
  cek('tanpa PIN: kolom petunjuk tersedia', await ada('[data-testid="petunjuk-mode"]'))
  {
    const t = await p.evaluate(() => {
      const e = document.querySelector('[data-testid="modal-masuk-anggota"]')
      return e ? e.innerText.replace(/\s+/g, ' ') : ''
    })
    cek('modal jujur: menyebut ini bukan pengaman', /bukan pengaman/i.test(t), t.slice(0, 160))
  }
  // Isi PIN lalu masuk — mode anggota jadi terkunci.
  await p.type('[data-testid="pin-baru-mode"]', '4321')
  if (await ada('[data-testid="lanjut-masuk-anggota"]')) {
    await klik('[data-testid="lanjut-masuk-anggota"]')
    await wait(2500)
  }
  cek('PIN baru tersimpan', (await p.evaluate(() => localStorage.getItem('drillkit.kiosk.pin'))) != null)
  cek('masuk mode anggota setelah pasang PIN', (await mode()) === 'member', String(await mode()))
  // Dan kini keluarnya benar-benar ditahan.
  const tombolKeluar = await p.$('[data-testid="keluar-mode-anggota"]')
  if (tombolKeluar) { await tombolKeluar.click(); await wait(700) }
  cek('setelah pasang PIN: kolom PIN diminta', await ada('[data-testid="pin-mode"]'))
  await p.type('[data-testid="pin-mode"]', '0000')
  await klik('[data-testid="lanjut-keluar-anggota"]')
  await wait(900)
  cek('setelah pasang PIN: PIN salah ditahan', (await mode()) === 'member', String(await mode()))
}

cek('tidak ada galat di konsol', errors.length === 0, errors.slice(0, 3).join(' | '))

console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) {
  console.log('\nYang gagal:')
  gagal.forEach((g) => console.log('  ✗ ' + g))
}
await browser.close()
if (gagal.length) process.exit(1)
