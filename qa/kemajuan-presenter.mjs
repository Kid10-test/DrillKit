/**
 * Uji K3 — checklist kemajuan di presenter.
 *
 * Yang paling penting di sini: kemajuan harus **tersimpan lintas sesi**.
 * Jadi setelah mencentang, halaman dimuat ulang seluruhnya (bukan sekadar
 * menutup presenter) dan kemajuannya dicek kembali — kalau cuma tersimpan di
 * state React, uji ini yang akan menangkapnya.
 *
 * Alur persiapan meniru asisten-seksi.mjs supaya nama tombol & jedanya sama.
 */
import puppeteer from 'puppeteer'
import { lewatSambutan } from './sambutan.mjs'

const BASE = process.env.BASE || 'http://localhost:5173'
const browser = await puppeteer.launch({
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  defaultViewport: { width: 1440, height: 900 },
})
const p = await browser.newPage()
const error = []
p.on('console', (m) => { if (m.type() === 'error') error.push(m.text()) })
p.on('pageerror', (e) => error.push(String(e)))

const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const tombol = (teks) =>
  p.evaluate((t) => {
    const x = [...document.querySelectorAll('button')].find((y) => y.textContent.includes(t))
    if (!x) return false
    x.click()
    return true
  }, teks)
const tombolJudul = (j) =>
  p.evaluate((t) => {
    const x = [...document.querySelectorAll('button')].find((y) =>
      (y.getAttribute('title') || '').includes(t))
    if (!x || x.disabled) return false
    x.click()
    return true
  }, j)
const klik = async (sel) => { await p.waitForSelector(sel, { timeout: 10000 }); await p.click(sel) }
const teks = (sel) => p.$eval(sel, (e) => e.textContent.trim())
const atribut = (sel, a) => p.$eval(sel, (e, b) => e.getAttribute(b), a)
const aktif = (sel) => p.$eval(sel, (e) => e.className.includes('emerald'))
const jumlah = (sel) => p.$$eval(sel, (e) => e.length)

let lulus = 0
const gagal = []
const cek = (nama, syarat, keterangan = '') => {
  if (syarat) lulus += 1
  else gagal.push(`${nama}${keterangan ? ' — ' + keterangan : ''}`)
}

/* =============================== Persiapan =============================== */
await p.goto(BASE, { waitUntil: 'networkidle2' })
await lewatSambutan(p)
await wait(1600)
await tombol('Muat data contoh')
await wait(3600)
await p.evaluate(() => { location.hash = '#/drill' })
await wait(2800)

// Data contoh hanya 2 set. Tambah satu supaya kemajuan punya tiga kemungkinan.
await p.keyboard.press('BracketRight')
await wait(1400)
await tombol('Set baru')
await wait(1800)
await p.evaluate(() => {
  const lab = [...document.querySelectorAll('label')].find((x) => x.textContent.includes('Geser blok'))
  const sel = lab?.parentElement?.querySelector('select')
  if (!sel) return false
  const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set
  set.call(sel, '8')
  sel.dispatchEvent(new Event('change', { bubbles: true }))
  return true
})
await wait(700)
await tombol('Ke depan')
await wait(1500)
// Presenter mengikuti set yang aktif di editor. Paksa ke set 1 supaya uji
// ini tidak bergantung pada di mana editor kebetulan berhenti — jebakan yang
// sama pernah menggagalkan asisten-seksi.mjs.
for (let i = 0; i < 4; i += 1) { await p.keyboard.press('BracketLeft'); await wait(500) }
await wait(700)

await tombolJudul('Mode presenter')
await wait(1600)
cek('presenter dibuka di set 1', (await teks('[data-testid="info-set"]')) === '1/3',
  await teks('[data-testid="info-set"]'))

/* ===================== 1. Keadaan awal: belum ada centang ================ */
const JUMLAH_SET = await jumlah('[data-testid^="pip-kemajuan-"]')
cek('baris kemajuan tampil', await p.$('[data-testid="baris-kemajuan"]') !== null)
cek('jumlah pip sama dengan jumlah set', JUMLAH_SET === 3, `dapat ${JUMLAH_SET}`)
cek('mulai dari 0/3', (await teks('[data-testid="info-kemajuan"]')) === `0/${JUMLAH_SET}`,
  await teks('[data-testid="info-kemajuan"]'))
cek('chip kuasai belum aktif', (await aktif('[data-testid="chip-kuasai"]')) === false)
cek('belum ada pip yang selesai',
  (await p.$$eval('[data-testid^="pip-kemajuan-"]', (e) =>
    e.filter((x) => x.getAttribute('data-selesai') === '1').length)) === 0)

/* ==================== 2. Mencentang & membatalkan ======================= */
await klik('[data-testid="chip-kuasai"]')
await wait(700)
cek('centang menaikkan ringkasan jadi 1/3',
  (await teks('[data-testid="info-kemajuan"]')) === `1/${JUMLAH_SET}`,
  await teks('[data-testid="info-kemajuan"]'))
cek('chip kuasai kini aktif', (await aktif('[data-testid="chip-kuasai"]')) === true)
cek('pip pertama ditandai selesai',
  (await atribut('[data-testid="pip-kemajuan-0"]', 'data-selesai')) === '1')

await klik('[data-testid="chip-kuasai"]')
await wait(700)
cek('klik lagi membatalkan centang',
  (await teks('[data-testid="info-kemajuan"]')) === `0/${JUMLAH_SET}`,
  await teks('[data-testid="info-kemajuan"]'))

/* ============== 3. Centang dua set, lalu MAJU ke set berikut ============= */
await klik('[data-testid="chip-kuasai"]')       // set 1
await wait(600)
await klik('[data-testid="presenter-berikutnya"]')
await wait(900)
cek('berikutnya memindah ke set 2', (await teks('[data-testid="info-set"]')) === '2/3',
  await teks('[data-testid="info-set"]'))
cek('set 2 belum dikuasai', (await aktif('[data-testid="chip-kuasai"]')) === false)
await klik('[data-testid="chip-kuasai"]')       // set 2
await wait(700)
cek('dua set selesai', (await teks('[data-testid="info-kemajuan"]')) === `2/${JUMLAH_SET}`,
  await teks('[data-testid="info-kemajuan"]'))

/* ================== 4. Inti: tersimpan lintas sesi ====================== */
// Menutup presenter saja tidak cukup — state React bisa saja bertahan.
// Seluruh halaman dimuat ulang supaya benar-benar kosong.
await klik('[data-testid="tutup-presenter"]')
await wait(900)
await p.reload({ waitUntil: 'networkidle2' })
await wait(3200)
await p.evaluate(() => { location.hash = '#/drill' })
await wait(2600)
await tombolJudul('Mode presenter')
await wait(1800)
cek('setelah memuat ulang halaman, kemajuan tersisa',
  (await teks('[data-testid="info-kemajuan"]')) === `2/${JUMLAH_SET}`,
  await teks('[data-testid="info-kemajuan"]'))
cek('setelah memuat ulang, pip yang sama yang bercentang',
  (await p.$$eval('[data-testid^="pip-kemajuan-"]', (e) =>
    e.map((x) => x.getAttribute('data-selesai')).join(''))) === '110',
  await p.$$eval('[data-testid^="pip-kemajuan-"]', (e) =>
    e.map((x) => x.getAttribute('data-selesai')).join('')))

// Centang per seksi pada set 3. Arahkan lewat pip, bukan "berikutnya",
// karena set awal setelah memuat ulang tidak bisa dipastikan.
await klik('[data-testid="pip-kemajuan-2"]')
await wait(900)
cek('berada di set 3', (await teks('[data-testid="info-set"]')) === '3/3',
  await teks('[data-testid="info-set"]'))

const chipsSeksi = await p.$$('[data-testid="baris-seksi"] button')
const NAMA_SEKSI = await p.$$eval('[data-testid="baris-seksi"] button',
  (e) => e.map((x) => x.textContent.trim()))
// chips[0] = "Semua", sisanya seksi.
const SEKSI = NAMA_SEKSI.slice(1)
cek('ada lebih dari satu seksi untuk dicoba', SEKSI.length > 1, `${SEKSI.length}`)

await chipsSeksi[1].click()
await wait(700)
cek('chip kuasai menyebut seksi yang dipilih',
  (await teks('[data-testid="chip-kuasai"]')).includes(SEKSI[0]),
  await teks('[data-testid="chip-kuasai"]'))
await klik('[data-testid="chip-kuasai"]')
await wait(700)
cek('centang satu seksi belum menyelesaikan set',
  (await teks('[data-testid="info-kemajuan"]')) === `2/${JUMLAH_SET}`,
  await teks('[data-testid="info-kemajuan"]'))
cek('tapi chip untuk seksi itu kini aktif',
  (await aktif('[data-testid="chip-kuasai"]')) === true)

// Centang sisa seksinya satu-satu.
for (let i = 2; i < SEKSI.length + 1; i += 1) {
  await chipsSeksi[i].click()
  await wait(450)
  await klik('[data-testid="chip-kuasai"]')
  await wait(450)
}
cek('set rampung setelah SEMUA seksi dicentang',
  (await teks('[data-testid="info-kemajuan"]')) === `3/${JUMLAH_SET}`,
  await teks('[data-testid="info-kemajuan"]'))

// Kembali ke "Semua": chip harus mengakui set sudah rampung walau tidak ada
// centang '*'. Inilah cacat yang sempat ditemukan di uji logika.
await chipsSeksi[0].click()
await wait(700)
cek('mode Semua mengakui set rampung dari centang per seksi',
  (await aktif('[data-testid="chip-kuasai"]')) === true)

// Dan mengkliknya membersihkan, bukan menambah centang tak kelihatan.
await klik('[data-testid="chip-kuasai"]')
await wait(700)
cek('klik saat sudah rampung membersihkan set itu',
  (await teks('[data-testid="info-kemajuan"]')) === `2/${JUMLAH_SET}`,
  await teks('[data-testid="info-kemajuan"]'))
cek('setelah dibersihkan, chip tidak aktif lagi',
  (await aktif('[data-testid="chip-kuasai"]')) === false)

/* ================== 5. Pip juga berfungsi sebagai lompatan =============== */
await klik('[data-testid="pip-kemajuan-1"]')
await wait(800)
cek('pip bisa diklik untuk melompat ke set itu',
  (await teks('[data-testid="info-set"]')) === '2/3',
  await teks('[data-testid="info-set"]'))

/* ============================ 6. Kebersihan ============================== */
cek('tidak ada error konsol', error.length === 0, error.slice(0, 3).join(' | '))

console.log('\n' + JSON.stringify({
  jumlahSet: JUMLAH_SET,
  seksi: SEKSI,
  ringkasanAkhir: await teks('[data-testid="info-kemajuan"]'),
  error: error.slice(0, 3),
}, null, 2))
console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) console.log('GAGAL:\n - ' + gagal.join('\n - '))
await browser.close()
if (gagal.length) process.exit(1)
