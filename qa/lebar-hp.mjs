/**
 * Uji **lebar HP** — tidak ada satu halaman pun yang boleh melebarkan layar.
 *
 * Mengapa ini ada: seluruh rangkaian uji berjalan di lebar 1300px, jadi
 * cacat tata letak di HP tidak pernah terlihat. Padahal yang memakai mode
 * anggota adalah 18 orang dengan HP, dan pelatih memakainya sambil berdiri
 * di lapangan.
 *
 * Cacat yang menuntut rangkaian ini dibuat: halaman Musik melebarkan
 * halaman 30px pada layar 360px — **baik untuk pelatih maupun anggota**.
 * Sumbernya bukan apa yang baru ditambahkan, melainkan item grid dengan
 * `min-width: auto` yang tidak bisa menyusut di bawah `<select>` yang
 * pilihannya panjang ("4/4 · 2+2", "Not setengah", …). Ia bersembunyi
 * selama berbulan-bulan karena tidak ada uji yang melihatnya.
 *
 * Yang diuji di sini sederhana dan sengaja tidak muluk: untuk setiap
 * halaman, `document.documentElement.scrollWidth` tidak boleh lebih besar
 * dari lebar layarnya. Itu saja. Tetapi ia menangkap seluruh golongan cacat
 * yang tidak pernah muncul di layar lebar.
 */
import puppeteer from 'puppeteer'
import { lewatSambutan } from './sambutan.mjs'

const BASE = process.env.BASE || 'http://localhost:4173'
/** Lebar HP terkecil yang masih wajar dipakai anggota. */
const LEBAR = 360

const browser = await puppeteer.launch({
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  defaultViewport: { width: LEBAR, height: 740 },
})
const errors = []

let lulus = 0
const gagal = []
const cek = (nama, syarat, keterangan = '') => {
  if (syarat) lulus += 1
  else gagal.push(`${nama}${keterangan ? ' — ' + keterangan : ''}`)
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

try {
  const A = await browser.newPage()
  A.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  A.on('pageerror', (e) => errors.push(String(e)))
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

  const halaman = [
    ['#/', 'Dasbor'],
    ['#/anggota', 'Anggota'],
    ['#/jadwal', 'Jadwal'],
    ['#/drill', 'Drill'],
    ['#/musik', 'Musik'],
    ['#/absensi', 'Absensi'],
    ['#/rekap', 'Rekap'],
    ['#/evaluasi', 'Evaluasi'],
    ['#/berbagi', 'Berbagi'],
    ['#/pengaturan', 'Pengaturan'],
    ['#/lomba', 'Lomba'],
    ['#/data', 'Pusat Data'],
  ]

  for (const [hash, nama] of halaman) {
    await A.goto(BASE + '/' + hash, { waitUntil: 'networkidle2' })
    await wait(2000)
    const r = await A.evaluate(() => ({
      dok: document.documentElement.scrollWidth,
      layar: window.innerWidth,
    }))
    cek(`${nama}: tidak melebarkan layar ${LEBAR}px`, r.dok <= r.layar + 1,
      `lebar dokumen ${r.dok} lawan layar ${r.layar}`)
  }

  cek('tidak ada galat di konsol', errors.length === 0, errors.slice(0, 3).join(' | '))
} finally {
  await browser.close()
}

console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) {
  for (const g of gagal) console.log('  ✗ ' + g)
  process.exitCode = 1
}
