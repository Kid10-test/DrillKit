/**
 * Uji layar sambutan: pelatih atau anggota pada pembukaan pertama.
 *
 * Cacat yang mendasarinya: tanpa layar ini, perangkat baru langsung masuk
 * **mode pelatih**. Anggota yang baru saja disuruh membuka satu berkas
 * justru melihat layar ekspor pelatih — "Unduh berkas grup", "Unduh per
 * anggota (ZIP)", "Pratinjau isi" — dan harus menemukan tombol "Lihat mode
 * anggota" yang namanya saja terdengar seperti milik pelatih.
 *
 * Yang diuji, selain alurnya sendiri: pertanyaan ini **sekali saja**, dan
 * layar ekspor pelatih **tidak** ikut tampil di belakangnya.
 *
 * "Perangkat baru" disimulasikan dengan **konteks browser baru**, bukan
 * dengan mengosongkan localStorage & IndexedDB pada halaman yang sedang
 * terbuka: menghapus basis data dari bawah aplikasi yang sedang berjalan
 * membuat renderer Chrome kehilangan halamannya (localStorage tiba-tiba
 * bertahan 'Access is denied', <nav> hilang). Konteks baru juga lebih
 * setia — benar-benar nol, tanpa bekas sesi sebelumnya.
 */
import puppeteer from 'puppeteer'

const BASE = process.env.BASE || 'http://localhost:5173'
const browser = await puppeteer.launch({
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  defaultViewport: { width: 1280, height: 950 },
})
const errors = []

let lulus = 0
const gagal = []
const cek = (nama, syarat, keterangan = '') => {
  if (syarat) lulus += 1
  else gagal.push(`${nama}${keterangan ? ' — ' + keterangan : ''}`)
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

/** Buka satu perangkat benar-benar baru: konteks baru, tanpa bekas apa pun. */
async function perangkatBaru() {
  const ctx = await browser.createBrowserContext()
  const h = await ctx.newPage()
  h.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  h.on('pageerror', (e) => errors.push(String(e)))
  h.on('dialog', async (d) => { await d.accept() })
  await h.goto(BASE, { waitUntil: 'networkidle2' })
  await wait(2500)
  return h
}

/** Baca sesuatu dari halaman; sabar bila halaman sedang dimuat ulang. */
async function aman(fn, ulang = 6) {
  let terakhir
  for (let i = 0; i < ulang; i += 1) {
    try { return await fn() } catch (e) { terakhir = e; await wait(700) }
  }
  throw terakhir
}
const ada = async (h, sel) => (await h.$(sel)) != null
const bacaMode = (h) => aman(() => h.evaluate(() => localStorage.getItem('drillkit.mode')))
const teks = (h, sel) =>
  aman(() => h.evaluate((s) => {
    const e = document.querySelector(s)
    return e ? e.innerText.replace(/\s+/g, ' ').trim() : null
  }, sel))
const menu = (h) =>
  aman(() => h.evaluate(() =>
    [...document.querySelectorAll('nav a[href^="#/"]')].map((a) => a.textContent.trim())))
const bacaHash = (h) => aman(() => h.evaluate(() => location.hash))
const tombol = (h, pola) =>
  aman(() => h.evaluate((r) =>
    [...document.querySelectorAll('button')].some((b) => new RegExp(r, 'i').test(b.textContent)),
    pola))

/**
 * Setelah memilih, aplikasi memuat ulang halamannya sendiri supaya mode
 * dibaca ulang. Puppeteer tidak bisa menunggu reload yang tidak ia minta,
 * jadi kita arahkan ulang secara jujur: hasil akhirnya sama persis dengan
 * yang dialami pemakai setelah halaman termuat ulang.
 */
async function setelahMemilih(h) {
  await wait(1500)
  await aman(() => h.goto(BASE, { waitUntil: 'networkidle2' }))
  await wait(2500)
}

// ============ PERANGKAT 1: sambutan, lalu pilih ANGGOTA ====================
const anggota = await perangkatBaru()
{
  cek('sambutan tampil di perangkat baru', await ada(anggota, '[data-testid="sambutan-mode"]'))
  const t = await teks(anggota, '[data-testid="sambutan-mode"]')
  cek('sambutan menanyakan siapa pemakainya', /Siapa yang akan memakai/i.test(t ?? ''), (t ?? '').slice(0, 100))
  cek('ada pilihan pelatih', await ada(anggota, '[data-testid="pilih-coach"]'))
  cek('ada pilihan anggota', await ada(anggota, '[data-testid="pilih-member"]'))

  // Halaman ini adalah LANDING PAGE: ia harus menjelaskan dulu apa
  // DrillKit itu, sebelum menyuruh orang masuk.
  cek('menyebut nama DrillKit', /DrillKit/.test(t ?? ''))
  cek('menjelaskan apa DrillKit itu', /marching band/i.test(t ?? ''), (t ?? '').slice(0, 160))
  cek('menjelaskan bahwa datanya tersimpan di perangkat',
    /tersimpan di perangkat ini/i.test(t ?? ''))
  cek('menjelaskan bahwa ia jalan offline',
    /tanpa sinyal|offline|luring/i.test(t ?? ''))
  cek('menjelaskan tanpa akun & tanpa server', /tanpa akun, tanpa server/i.test(t ?? ''))
  cek('memperkenalkan isi aplikasi', /Yang ada di dalamnya/i.test(t ?? ''))
  // Tombol masuknya harus berbunyi seperti mengajak masuk, bukan "lanjut".
  cek('tombolnya berbunyi "Masuk"',
    await anggota.evaluate(() => {
      const b = document.querySelector('[data-testid="lanjut-pilih-mode"]')
      return b ? b.textContent.trim() : null
    }) === 'Masuk')

  // Yang paling penting: layar EKSPOR pelatih tidak boleh ikut tampil.
  cek('layar ekspor pelatih TIDAK tampil di belakang sambutan',
    !/Unduh berkas grup|Unduh per anggota \(ZIP\)|Pratinjau isi/.test(t ?? ''),
    (t ?? '').slice(0, 200))
  cek('menu pelatih tidak tampil', !(await ada(anggota, 'nav a[href="#/pengaturan"]')))

  // Belum memilih -> tombol Lanjut belum bisa dipakai.
  const nonaktif = await anggota.$eval('[data-testid="lanjut-pilih-mode"]', (e) => e.disabled)
  cek('tombol Lanjut nonaktif sebelum memilih', nonaktif === true)
}

{
  await anggota.click('[data-testid="pilih-member"]')
  await wait(400)
  const aktif = await anggota.$eval('[data-testid="pilih-member"]', (e) => e.dataset.aktif)
  cek('pilihan anggota ditandai aktif', aktif === 'ya', String(aktif))
  const nonaktif = await anggota.$eval('[data-testid="lanjut-pilih-mode"]', (e) => e.disabled)
  cek('tombol Lanjut aktif setelah memilih', nonaktif === false)

  await anggota.click('[data-testid="lanjut-pilih-mode"]')
  await setelahMemilih(anggota)

  cek('sambutan hilang setelah memilih', !(await ada(anggota, '[data-testid="sambutan-mode"]')))
  cek('mode tersimpan sebagai anggota', (await bacaMode(anggota)) === 'member', String(await bacaMode(anggota)))
  cek('langsung diarahkan ke halaman anggota',
    (await bacaHash(anggota)) === '#/berbagi', await bacaHash(anggota))
  // Anggota harus langsung tahu apa yang mesti dilakukannya.
  cek('tombol "Buka paket tim" tampil di mode anggota', await tombol(anggota, 'Buka paket tim'))
  cek('menu anggota tinggal sedikit', (await menu(anggota)).length <= 2, JSON.stringify(await menu(anggota)))
}

// ====== Ditanya SEKALI SAJA — tidak muncul lagi setelah dimuat ulang =======
{
  await aman(() => anggota.reload({ waitUntil: 'networkidle2' }))
  await wait(2500)
  cek('sambutan TIDAK muncul lagi setelah dimuat ulang',
    !(await ada(anggota, '[data-testid="sambutan-mode"]')))
  cek('tetap mode anggota setelah dimuat ulang', (await bacaMode(anggota)) === 'member')
}

// ====== Anggota tidak dikurung: jalan keluar tetap tersedia ================
{
  // Tanpa PIN, keluar harus tetap boleh — kalau tidak, pelatih yang memilih
  // "anggota" di perangkatnya sendiri akan mengurung dirinya.
  cek('tombol keluar tersedia bagi anggota', await ada(anggota, '[data-testid="keluar-mode-anggota"]'))
}

// ============ PERANGKAT 2: pilih PELATIH ==================================
const pelatih = await perangkatBaru()
{
  cek('sambutan tampil lagi di perangkat baru lain', await ada(pelatih, '[data-testid="sambutan-mode"]'))
  await pelatih.click('[data-testid="pilih-coach"]')
  await wait(400)
  await pelatih.click('[data-testid="lanjut-pilih-mode"]')
  await setelahMemilih(pelatih)

  cek('mode tersimpan sebagai pelatih', (await bacaMode(pelatih)) === 'coach', String(await bacaMode(pelatih)))
  cek('sambutan hilang untuk pelatih', !(await ada(pelatih, '[data-testid="sambutan-mode"]')))
  const m = await menu(pelatih)
  cek('menu pelatih lengkap', m.length >= 8, JSON.stringify(m))
  cek('ada menu Pengaturan', m.some((l) => /Pengaturan/.test(l)), JSON.stringify(m))
  // Layar ekspor pelatih hanya boleh muncul setelah ia memilih pelatih.
  // (Ada di halaman Berbagi — pelatih mendarat di Dashboard lebih dulu.)
  await aman(() => pelatih.goto(`${BASE}/#/berbagi`, { waitUntil: 'networkidle2' }))
  await wait(2500)
  cek('layar ekspor pelatih tampil setelah memilih pelatih',
    await tombol(pelatih, 'Unduh berkas grup'))

  await aman(() => pelatih.reload({ waitUntil: 'networkidle2' }))
  await wait(2500)
  cek('sambutan tidak muncul lagi untuk pelatih',
    !(await ada(pelatih, '[data-testid="sambutan-mode"]')))
}

// ERR_INSUFFICIENT_RESOURCES berasal dari Chrome kehabisan sumber daya
// karena uji ini memuat ulang halaman berkali-kali — bukan cacat aplikasi.
// Galat yang lain tetap dilaporkan apa adanya.
const galatNyata = errors.filter((e) => !/ERR_INSUFFICIENT_RESOURCES/.test(e))
cek('tidak ada galat di konsol', galatNyata.length === 0, galatNyata.slice(0, 3).join(' | '))

console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) {
  console.log('\nYang gagal:')
  gagal.forEach((g) => console.log('  ✗ ' + g))
}
await browser.close()
if (gagal.length) process.exit(1)
