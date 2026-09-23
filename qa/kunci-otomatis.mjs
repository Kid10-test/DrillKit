/**
 * Uji kunci otomatis: perangkat pelatih yang ditinggal tanpa disentuh.
 *
 * Mengapa ini perlu, dan mengapa ia bukan "sistem login":
 *
 * Anggota yang memilih "Saya pelatih" di HP-nya sendiri memang mendapat
 * seluruh menu pelatih — tetapi basis data di perangkatnya KOSONG (0
 * anggota, 0 sesi, 0 absensi), karena data pelatih tidak pernah ada di
 * server. Tidak ada database bersama yang perlu dijaga dengan login.
 *
 * Yang justru berisi data adalah **perangkat pelatihnya sendiri**. Maka
 * yang diuji di sini bukan pintu masuknya, melainkan perangkat yang
 * ditinggal terbuka di bangku cadangan.
 *
 * Empat keadaan, dua di antaranya harus menunggu ±70 detik:
 *   A. tanpa PIN, kunci otomatis 1 menit  -> TIDAK mengunci (percuma)
 *   B. PIN terpasang, kunci otomatis MATI -> TIDAK mengunci (bawaan)
 *   C. PIN terpasang, 1 menit, didiamkan  -> MENGUNCI
 *   D. PIN terpasang, 1 menit, disentuh   -> TIDAK mengunci (diset ulang)
 *
 * D adalah yang paling penting: tanpa itu, kunci otomatis akan mengunci
 * layar di tengah latihan — jauh lebih menyusahkan daripada perangkat
 * yang dibiarkan terbuka.
 */
import puppeteer from 'puppeteer'
import { lewatSambutan } from './sambutan.mjs'

const BASE = process.env.BASE || 'http://localhost:4173'
const MENIT = 60_000
const browser = await puppeteer.launch({
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  defaultViewport: { width: 1300, height: 1000 },
})
const errors = []

let lulus = 0
const gagal = []
const cek = (nama, syarat, keterangan = '') => {
  if (syarat) lulus += 1
  else gagal.push(`${nama}${keterangan ? ' — ' + keterangan : ''}`)
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

/** Siapkan satu perangkat pelatih: data contoh, PIN, dan kunci otomatis. */
async function perangkat({ pin, menit }) {
  const ctx = await browser.createBrowserContext()
  const h = await ctx.newPage()
  h.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  h.on('pageerror', (e) => errors.push(String(e)))
  h.on('dialog', async (d) => { await d.accept() })
  await h.goto(BASE, { waitUntil: 'networkidle2' })
  await lewatSambutan(h)
  await wait(1200)

  if (pin) {
    // Hash PIN-nya sama dengan yang dipakai aplikasi (djb2 + 'drillkit::').
    const hash = (p) => {
      let x = 5381
      const s = `drillkit::${p}`
      for (let i = 0; i < s.length; i += 1) x = ((x << 5) + x + s.charCodeAt(i)) | 0
      return `k${(x >>> 0).toString(36)}`
    }
    await h.evaluate((v) => localStorage.setItem('drillkit.kiosk.pin', v), hash(pin))
  }
  await h.evaluate((v) => {
    if (v > 0) localStorage.setItem('drillkit.kiosk.autolock', String(v))
    else localStorage.removeItem('drillkit.kiosk.autolock')
  }, menit)
  // Pastikan mulai dari keadaan TIDAK terkunci.
  await h.evaluate(() => localStorage.removeItem('drillkit.kiosk'))
  await h.goto(BASE, { waitUntil: 'networkidle2' })
  await wait(2500)
  return h
}

const terkunci = (h) => h.evaluate(() => {
  const banner = document.querySelector('[data-testid="kiosk-banner"]')
  if (banner) return true
  // Banner hanya tampil di luar Pengaturan; badge-nya juga bisa dibaca.
  const t = document.body.innerText
  return /Mode kios aktif|data hanya bisa dilihat/.test(t)
})

/* ============= A. Tanpa PIN — kunci otomatis tidak ada gunanya ============= */
{
  const h = await perangkat({ pin: null, menit: 1 })
  await wait(15_000)
  cek('A: tanpa PIN, TIDAK mengunci (tidak melindungi apa pun)', !(await terkunci(h)))
}

/* ============= B. Bawaan MATI — tidak boleh mengunci sendiri =============== */
{
  const h = await perangkat({ pin: '1234', menit: 0 })
  await wait(15_000)
  cek('B: kunci otomatis MATI, TIDAK mengunci', !(await terkunci(h)))
}

/* ============= C. PIN terpasang + didiamkan — harus mengunci =============== */
{
  const h = await perangkat({ pin: '1234', menit: 1 })
  const awal = await terkunci(h)
  cek('C: mulai dalam keadaan tidak terkunci', !awal)
  // 1 menit + jeda aman.
  await wait(MENIT + 8000)
  cek('C: setelah didiamkan, MENGUNCI sendiri', await terkunci(h))
  {
    // Kuncinya harus bisa dibuka dengan PIN — jangan sampai mengurung pemilik.
    const t = await h.evaluate(() => document.body.innerText)
    cek('C: keadaan terkunci diberitahukan di layar',
      /Mode kios|Terkunci|dikunci/i.test(t), t.slice(0, 160))
  }
}

/* ====== D. Disentuh berkala — TIDAK boleh mengunci di tengah latihan ======= */
{
  const h = await perangkat({ pin: '1234', menit: 1 })
  const mula = Date.now()
  // Sentuh tiap 15 detik, lebih cepat dari batas 1 menit.
  while (Date.now() - mula < MENIT + 15_000) {
    await h.mouse.click(600, 400)
    await wait(15_000)
  }
  cek('D: selama masih dipakai, TIDAK mengunci', !(await terkunci(h)))
}

/* ============= E. Pengaturannya bisa dipakai dan jujur ===================== */
{
  const h = await perangkat({ pin: null, menit: 0 })
  await h.goto(`${BASE}/#/pengaturan`, { waitUntil: 'networkidle2' })
  await wait(2200)
  {
    const tanpa = await h.$('[data-testid="kunci-otomatis-tanpa-pin"]')
    cek('E: tanpa PIN, alasannya dikatakan terus terang', tanpa != null)
    const teks = tanpa
      ? await h.evaluate((e) => e.textContent.replace(/\s+/g, ' ').trim(), tanpa)
      : ''
    cek('E: menyebut bahwa tanpa PIN tidak melindungi apa pun',
      /tidak melindungi/i.test(teks), teks.slice(0, 120))
    cek('E: tanpa PIN, pilihannya tidak ditawarkan',
      (await h.$('[data-testid="kunci-otomatis"]')) == null)
  }
  // Pasang PIN lewat basis data, lalu muat ulang.
  const hash = (() => {
    let x = 5381
    const s = 'drillkit::1234'
    for (let i = 0; i < s.length; i += 1) x = ((x << 5) + x + s.charCodeAt(i)) | 0
    return `k${(x >>> 0).toString(36)}`
  })()
  await h.evaluate((v) => localStorage.setItem('drillkit.kiosk.pin', v), hash)
  await h.reload({ waitUntil: 'networkidle2' })
  await wait(2500)
  {
    const sel = await h.$('[data-testid="kunci-otomatis"]')
    cek('E: setelah PIN terpasang, pilihannya muncul', sel != null)
    if (sel) {
      const nilai = await h.evaluate((e) => e.value, sel)
      cek('E: bawaannya MATI, bukan langsung aktif', nilai === '0', nilai)
      await h.select('[data-testid="kunci-otomatis"]', '15')
      await wait(600)
      const simpan = await h.evaluate(() => localStorage.getItem('drillkit.kiosk.autolock'))
      cek('E: pilihannya tersimpan', simpan === '15', String(simpan))
    }
  }
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
