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

  // Hit-test Modal di Mode Pelatih (360x740): tombol footer modal di dasar layar
  // wajib berada DI ATAS nav-bawah-hp (tidak tertutup dan bisa dipencet).
  await A.goto(BASE + '/#/berbagi', { waitUntil: 'networkidle2' })
  await wait(800)
  await A.click('[data-testid="masuk-mode-anggota"]')
  await wait(350)
  const hitModalPelatih = await A.evaluate(() => {
    const modal = document.querySelector('[data-testid="modal-masuk-anggota"]')
    if (!modal) return { ada: false }
    const btns = [...modal.querySelectorAll('button')].filter((b) => /Masuk mode anggota|Batal/i.test(b.textContent || ''))
    const hasil = btns.map((b) => {
      const r = b.getBoundingClientRect()
      const topEl = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
      return {
        teks: (b.textContent || '').trim(),
        bisaDipencet: Boolean(topEl && (b.contains(topEl) || topEl.contains(b))),
        tertutupOleh: topEl ? (topEl.textContent || '').trim().slice(0, 30) : 'null',
      }
    })
    return { ada: btns.length >= 2, hasil }
  })
  cek(
    'Mode Pelatih HP: tombol aksi di dasar Modal tidak tertutup nav-bawah-hp',
    hitModalPelatih.ada && hitModalPelatih.hasil.every((h) => h.bisaDipencet),
    JSON.stringify(hitModalPelatih),
  )

  // Mode Anggota di HP (360x740): bilah bawah "Tim" mubazir tidak tampil &
  // tombol keluar Mode Pelatih / modal bawah bisa dipencet 100%.
  const ctxAnggota = await browser.createBrowserContext()
  const M = await ctxAnggota.newPage()
  M.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  M.on('pageerror', (e) => errors.push(String(e)))
  await M.setViewport({ width: LEBAR, height: 740 })
  await M.goto(BASE + '/#/', { waitUntil: 'networkidle2' })
  await wait(800)
  await lewatSambutan(M, 'member')
  await wait(1000)

  const infoAnggotaHp = await M.evaluate(() => {
    const navBawah = document.querySelector('[data-testid="nav-bawah-hp"]')
    window.scrollTo(0, document.documentElement.scrollHeight)
    const tombolBawah = [...document.querySelectorAll('main button, main label')].filter((el) => {
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.height > 0 && r.bottom <= window.innerHeight && r.top >= 0
    })
    const palingBawah = tombolBawah.sort((a, b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom)[0]
    let palingBawahBisaDipencet = true
    if (palingBawah) {
      const r = palingBawah.getBoundingClientRect()
      const topEl = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
      palingBawahBisaDipencet = Boolean(topEl && (palingBawah.contains(topEl) || topEl.contains(palingBawah)))
    }
    return {
      dok: document.documentElement.scrollWidth,
      layar: window.innerWidth,
      adaNavBawahTim: Boolean(navBawah),
      palingBawahBisaDipencet,
    }
  })
  cek(
    'Mode Anggota HP: tidak ada bilah bawah "Tim" yang menutupi dasar layar & tombol terbawah bisa dipencet',
    !infoAnggotaHp.adaNavBawahTim && infoAnggotaHp.palingBawahBisaDipencet && infoAnggotaHp.dok <= infoAnggotaHp.layar + 1,
    JSON.stringify(infoAnggotaHp),
  )

  await M.click('[data-testid="keluar-mode-anggota"]')
  await wait(350)
  const hitModalAnggota = await M.evaluate(() => {
    const btnLanjut = document.querySelector('[data-testid="lanjut-keluar-anggota"]')
    if (!btnLanjut) return { ok: false, alasan: 'tombol lanjut tidak ditemukan' }
    const r = btnLanjut.getBoundingClientRect()
    const topEl = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
    return {
      ok: Boolean(topEl && (btnLanjut.contains(topEl) || topEl.contains(btnLanjut))),
      tertutupOleh: topEl ? (topEl.textContent || '').trim().slice(0, 30) : 'null',
    }
  })
  cek(
    'Mode Anggota HP: tombol Lanjut di dasar modal "Keluar dari mode anggota" bisa dipencet penuh',
    hitModalAnggota.ok,
    JSON.stringify(hitModalAnggota),
  )
  await ctxAnggota.close()

  cek('tidak ada galat di konsol', errors.length === 0, errors.slice(0, 3).join(' | '))
} finally {
  await browser.close()
}

console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) {
  for (const g of gagal) console.log('  ✗ ' + g)
  process.exitCode = 1
}
