/**
 * Uji kunci layar presenter (G2b) di peramban.
 *
 * Ujian sebenarnya ada di sini, bukan di logika murninya: apakah masukan
 * betul-betul tertahan. Yang diuji:
 *
 * 1. **Papan ketik tertahan** — bukan hanya sentuhan. Kalau tombol panah
 *    masih mengubah set, kuncinya tidak mengunci apa-apa, karena remote
 *    presenter mengirim tombol panah.
 * 2. **Tombol asing tidak tembus ke editor** — presenter hanya mencegat
 *    panah/spasi/R; yang lain diteruskan ke editor di belakangnya.
 * 3. **Escape tetap lewat** — pemakai tidak boleh terjebak.
 * 4. Setelah dibuka, navigasi bekerja lagi seperti sediakala.
 */
import puppeteer from 'puppeteer'
import { lewatSambutan } from './sambutan.mjs'

const BASE = process.env.BASE || 'http://localhost:5173'
const browser = await puppeteer.launch({
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  defaultViewport: { width: 1400, height: 1000 },
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
const teks = async (sel) => {
  const e = await p.$(sel)
  return e ? (await p.evaluate((x) => x.textContent, e)).replace(/\s+/g, ' ').trim() : null
}
const klik = async (sel) => {
  const e = await p.$(sel)
  if (!e) throw new Error(`tidak ketemu: ${sel}`)
  await e.click()
  await wait(300)
}
const tombol = (t) =>
  p.evaluate((x) => {
    const b = [...document.querySelectorAll('button')].find((y) => y.textContent.includes(x))
    if (!b || b.disabled) return false
    b.click()
    return true
  }, t)

await p.goto(BASE, { waitUntil: 'networkidle2' })
await lewatSambutan(p)
await wait(1500)
await tombol('Muat data contoh')
await wait(4000)
await p.reload({ waitUntil: 'networkidle2' })
await wait(2500)

// ------------------------------------------------------- buka mode presenter
await p.goto(`${BASE}/#/drill`, { waitUntil: 'networkidle2' })
await wait(2000)

const bukaPresenter = await p.$('button[title^="Mode presenter"]')
cek('tombol mode presenter ketemu', bukaPresenter != null)
if (bukaPresenter) {
  await bukaPresenter.click()
  await wait(1500)
}
cek('presenter terbuka', await ada('[data-testid="presenter"]'))

const posisi = () => teks('[data-testid="info-set"]')
const indeks = async () => Number((await posisi())?.split('/')[0] ?? '0')

// ----------------------------------------- keadaan dasar: navigasi bekerja dulu
const mula = await indeks()
await p.keyboard.press('ArrowRight')
await wait(700)
const setelahTombol = await indeks()
cek('sebelum dikunci: tombol panah mengubah set', setelahTombol !== mula,
  `${mula} -> ${setelahTombol}`)

// Kembalikan ke posisi awal supaya hitungan di bawah mudah dibaca.
await p.keyboard.press('ArrowLeft')
await wait(700)
cek('kembali ke posisi mula', (await indeks()) === mula, `${await indeks()} vs ${mula}`)

// -------------------------------------------------------------- kunci layarnya
cek('tombol kunci ada', await ada('[data-testid="kunci-presenter"]'))
await klik('[data-testid="kunci-presenter"]')
await wait(600)
cek('lapisan kunci tampil', await ada('[data-testid="layar-terkunci"]'))
cek('presenter ditandai terkunci',
  (await p.$eval('[data-testid="presenter"]', (e) => e.dataset.layarTerkunci)) === 'ya')
cek('keterangan kunci tampil', (await teks('[data-testid="keterangan-kunci"]')) != null)

// ----------------------------------------------- uji 1: papan ketik tertahan
{
  const sebelum = await indeks()
  await p.keyboard.press('ArrowRight')
  await wait(600)
  cek('terkunci: panah kanan TIDAK mengubah set', (await indeks()) === sebelum,
    `${sebelum} -> ${await indeks()}`)

  await p.keyboard.press('PageDown')
  await wait(500)
  cek('terkunci: PageDown tidak mengubah set', (await indeks()) === sebelum)

  await p.keyboard.press('ArrowLeft')
  await wait(500)
  cek('terkunci: panah kiri tidak mengubah set', (await indeks()) === sebelum)
}

// ------------------------------------ uji 2: tombol asing tidak tembus editor
{
  // Presenter hanya mencegat panah/spasi/R. Tombol lain diteruskan ke
  // editor di belakangnya — Delete bisa menghapus titik. Karena kunci
  // menelan SEMUA tombol, ini tidak boleh terjadi.
  const sebelumTitik = await p.evaluate(() =>
    document.querySelectorAll('[data-testid="presenter"] [data-pemain], [data-testid="presenter"] circle').length)
  await p.keyboard.press('Delete')
  await wait(500)
  await p.keyboard.press('Backspace')
  await wait(500)
  const sesudahTitik = await p.evaluate(() =>
    document.querySelectorAll('[data-testid="presenter"] [data-pemain], [data-testid="presenter"] circle').length)
  cek('terkunci: Delete/Backspace tidak mengubah isi lapangan',
    sebelumTitik === sesudahTitik, `${sebelumTitik} -> ${sesudahTitik}`)
  cek('terkunci: presenter masih terbuka setelah tombol asing',
    await ada('[data-testid="presenter"]'))
}

// ------------------------------------------ uji 3: sentuhan tertahan (kanvas)
{
  const sebelum = await indeks()
  // Ketuk di tengah kanvas — kalau lapisan kunci tidak menutupinya, ini
  // akan memajukan set (tapNext) atau setidaknya tidak mengubah apa pun.
  const kotak = await p.$eval('[data-testid="kanvas-presenter"]', (e) => {
    const r = e.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  })
  await p.mouse.click(kotak.x, kotak.y)
  await wait(600)
  cek('terkunci: ketuk kanvas tidak mengubah set', (await indeks()) === sebelum,
    `${sebelum} -> ${await indeks()}`)
}

// ------------------------------------- uji 4: tombol navigasi tertutup lapisan
{
  const sebelum = await indeks()
  const tombolAda = await ada('[data-testid="presenter-berikutnya"]')
  cek('tombol berikutnya ada di DOM', tombolAda)
  if (tombolAda) {
    // Klik pada koordinat tombolnya: yang menerima adalah lapisan kunci.
    const e = await p.$('[data-testid="presenter-berikutnya"]')
    await e.click().catch(() => {})
    await wait(600)
    cek('terkunci: tombol berikutnya tidak mengubah set', (await indeks()) === sebelum,
      `${sebelum} -> ${await indeks()}`)
  }
}

// ---------------------------------------------------------- buka kunci (tanpa PIN)
{
  const berlabuh = await ada('[data-testid="pin-presenter"]')
  cek('tanpa PIN: kolom PIN tidak ditampilkan', berlabuh === false)
  await klik('[data-testid="buka-kunci-presenter"]')
  await wait(700)
  cek('setelah buka: lapisan kunci hilang', !(await ada('[data-testid="layar-terkunci"]')))
  cek('setelah buka: presenter tidak lagi ditandai terkunci',
    (await p.$eval('[data-testid="presenter"]', (e) => e.dataset.layarTerkunci)) === 'tidak')
}

// ------------------------------------------ navigasi bekerja lagi setelah buka
{
  const sebelum = await indeks()
  await p.keyboard.press('ArrowRight')
  await wait(700)
  cek('setelah buka: tombol panah bekerja lagi', (await indeks()) !== sebelum,
    `${sebelum} -> ${await indeks()}`)
}

// --------------------------------------------------- uji 5: Escape tetap lewat
await klik('[data-testid="kunci-presenter"]')
await wait(600)
cek('terkunci lagi', await ada('[data-testid="layar-terkunci"]'))
await p.keyboard.press('Escape')
await wait(900)
cek('terkunci: Escape tetap menutup presenter (tidak menjebak)',
  !(await ada('[data-testid="presenter"]')),
  'presenter masih terbuka')

// --------------------------------------------------- uji 6: PIN salah ditahan
{
  // Pasang PIN lewat localStorage (mekanisme yang sama dengan F2), lalu
  // buka presenter lagi dan coba PIN yang salah.
  await p.evaluate(() => {
    // hashPin yang ASLI (djb2, dari src/lib/kiosk.ts). Memakai hash
    // buatan sendiri akan membuat PIN benar pun selalu ditolak, dan
    // ujinya gagal bukan karena cacat kode.
    const hashPin = (pin) => {
      let h = 5381
      const s = `drillkit::${pin}`
      for (let i = 0; i < s.length; i += 1) h = ((h << 5) + h + s.charCodeAt(i)) | 0
      return `k${(h >>> 0).toString(36)}`
    }
    localStorage.setItem('drillkit.kiosk.pin', hashPin('1234'))
    localStorage.setItem('drillkit.kiosk.hint', 'angka punggung')
  })
  await p.reload({ waitUntil: 'networkidle2' })
  await wait(2000)
  await p.goto(`${BASE}/#/drill`, { waitUntil: 'networkidle2' })
  await wait(2000)
  const buka2 = await p.$('button[title^="Mode presenter"]')
  if (buka2) { await buka2.click(); await wait(1500) }
  cek('presenter terbuka lagi', await ada('[data-testid="presenter"]'))

  await klik('[data-testid="kunci-presenter"]')
  await wait(600)
  cek('dengan PIN: kolom PIN ditampilkan', await ada('[data-testid="pin-presenter"]'))
  {
    const k = await teks('[data-testid="keterangan-kunci"]')
    cek('dengan PIN: keterangan menyebut PIN', /PIN/.test(k ?? ''), k ?? '')
  }

  // PIN salah: tidak boleh terbuka.
  await p.type('[data-testid="pin-presenter"]', '9999')
  await klik('[data-testid="buka-kunci-presenter"]')
  await wait(600)
  cek('PIN salah: tetap terkunci', await ada('[data-testid="layar-terkunci"]'))
  cek('PIN salah: galat ditampilkan', await ada('[data-testid="galat-kunci"]'))

  // PIN benar: terbuka.
  await p.type('[data-testid="pin-presenter"]', '1234')
  await klik('[data-testid="buka-kunci-presenter"]')
  await wait(700)
  cek('PIN benar: kunci terbuka', !(await ada('[data-testid="layar-terkunci"]')))
}

cek('tidak ada galat di konsol', errors.length === 0, errors.slice(0, 3).join(' | '))

console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) {
  console.log('\nYang gagal:')
  gagal.forEach((g) => console.log('  ✗ ' + g))
}
await browser.close()
if (gagal.length) process.exit(1)
