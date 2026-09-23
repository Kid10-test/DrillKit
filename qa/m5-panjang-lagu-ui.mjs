/**
 * M5 — panjang lagu, versi yang digerakkan antarmuka.
 *
 * Sengaja tidak memakai `import('/src/db/db.ts')` supaya bisa dijalankan di
 * tiga target: dev, produksi, dan berkas portabel `file://`.
 *
 * Alurnya persis seperti pemakai: tambah lagu → pilih → atur tempo & panjang
 * → mainkan → pastikan metronom berhenti sendiri di birama terakhir.
 *
 * Pakai: node m5-panjang-lagu-ui.mjs [BASE_URL]
 */
import puppeteer from 'puppeteer'
import { lewatSambutan } from './sambutan.mjs'

/*
 * N8 — `process.argv[2]` dulunya satu-satunya jalan masuk, padahal
 * `regresi.sh` mengirim alamatnya lewat lingkungan (`BASE`). Akibatnya
 * rangkaian-rangkaian ini diam-diam berlari ke bawaan :5173 — server
 * pengembangan — dan gagal dengan cara yang tidak kentara. Sekarang
 * lingkungan menang, argumen tetap berlaku untuk dijalankan sendiri.
 */
const BASE = process.env.BASE || process.argv[2] || 'http://localhost:5173'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

let lulus = 0
let gagal = 0
function uji(nama, ok, detail = '') {
  if (ok) {
    lulus++
    console.log('  ✓ ' + nama)
  } else {
    gagal++
    console.log('  ✗ ' + nama + (detail ? ' → ' + detail : ''))
  }
}
function sama(nama, aktual, harap) {
  const a = JSON.stringify(aktual)
  const h = JSON.stringify(harap)
  uji(nama, a === h, `dapat ${a}, harap ${h}`)
}

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'],
})
const p = await browser.newPage()
await p.setViewport({ width: 1280, height: 1100 })
const errors = []
p.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text())
})
p.on('pageerror', (e) => errors.push(String(e)))

const ada = async (sel) => (await p.$(sel)) !== null
const teks = async (sel) => p.$eval(sel, (e) => e.textContent.trim()).catch(() => null)
const angka = async (sel) => {
  const t = await teks(sel)
  const n = Number(String(t ?? '').replace(/[^\d.-]/g, ''))
  return Number.isFinite(n) ? n : null
}
const tombolMulai = async () => (await teks('[data-testid="tombol-mulai"]')) ?? ''

/** Isi sebuah <input> seperti diketik pemakai (supaya React ikut memperbarui). */
async function isi(sel, nilai) {
  const ok = await p.evaluate(
    (s, v) => {
      const el = document.querySelector(s)
      if (!el) return false
      const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      set.call(el, String(v))
      el.dispatchEvent(new Event('input', { bubbles: true }))
      return true
    },
    sel,
    nilai,
  )
  await wait(450)
  return ok
}
async function klikMengandung(lb) {
  const ok = await p.evaluate((x) => {
    const b = [...document.querySelectorAll('button')].find((e) => e.textContent.includes(x))
    if (!b) return false
    b.click()
    return true
  }, lb)
  await wait(600)
  return ok
}
async function klikTepat(lb) {
  const ok = await p.evaluate((x) => {
    const b = [...document.querySelectorAll('button')].find((e) => e.textContent.trim() === x)
    if (!b) return false
    b.click()
    return true
  }, lb)
  await wait(600)
  return ok
}

/**
 * Catatan perilaku (bukan cacat): setiap kali data lagu berubah, metronom
 * memuat ulang pengaturan lagu itu — termasuk BPM. Jadi setelah menulis ke
 * lagu (mengisi panjang, menyalakan ulang), tempo harus diatur ulang supaya
 * hitungan waktu di tes ini tetap 1 detik per birama.
 */
async function aturTempo240() {
  await isi('[data-testid="bpm"]', 240)
  await wait(400)
  return (await p.$eval('[data-testid="bpm"]', (e) => e.value)) === '240'
}

await p.goto(BASE.startsWith('file:') ? BASE : BASE + '/', { waitUntil: 'networkidle2' })

// N8 — layar sambutan menutupi semua yang ada di bawahnya, dan tiap
// peluncuran Puppeteer membawa perangkat baru. Tanpa ini rangkaian
// uji ini mogok di klik pertamanya dan tidak pernah sampai ke
// periksaannya — yang membuatnya tampak "tidak ada ringkasannya"
// alih-alih gagal terang-terangan.
await lewatSambutan(p)
await wait(2500)
await p.evaluate(() => {
  location.hash = '#/musik'
})
await wait(2000)

/* -------------------------- 1. buat lagu lewat UI ------------------------ */

console.log('\n— 1. Tambah lagu lewat antarmuka —')
uji('tombol Tambah lagu ada', await klikMengandung('Tambah lagu'))
await p.evaluate(() => {
  const m = document.querySelector('[data-testid="modal-lagu"]')
  const i = m?.querySelector('input')
  if (i) {
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    set.call(i, 'Lagu Pendek M5')
    i.dispatchEvent(new Event('input', { bubbles: true }))
  }
})
await wait(400)
uji('tombol Simpan ada', await klikTepat('Simpan'))
await wait(1200)
uji('lagu muncul di repertoar', (await p.evaluate(() => document.body.textContent)).includes('Lagu Pendek M5'))

// Pilih lagu itu.
const dipilih = await p.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find(
    (e) => e.textContent.includes('Lagu Pendek M5') && e.getAttribute('data-testid')?.startsWith('pilih-lagu-'),
  )
  if (!b) return false
  b.click()
  return true
})
await wait(1000)
uji('lagu bisa dipilih', dipilih)

/* --------------------- 2. atur tempo & panjang lagu ---------------------- */

console.log('\n— 2. Atur tempo 240 & panjang 4 birama —')
uji('kartu panjang belum muncul (panjang masih kosong)', !(await ada('[data-testid="kartu-panjang"]')))

uji('tempo bisa diatur 240', await aturTempo240())

uji('isian panjang lagu ada', await isi('[data-testid="panjang-lagu"]', 4))
await wait(900)
// Mengisi panjang menulis ke lagu → BPM kembali ke 120. Atur ulang.
uji('tempo diatur ulang setelah mengisi panjang', await aturTempo240())
uji('kartu panjang muncul', await ada('[data-testid="kartu-panjang"]'))
sama('total birama = 4', await angka('[data-testid="birama-total"]'), 4)
const sisa = await teks('[data-testid="teks-sisa"]')
uji('durasi total 0:04 (4 birama × 1 dtk @240)', sisa.includes('0:04'), sisa)
uji('tombol ulang ada', await ada('[data-testid="tombol-ulang"]'))

/* --------------------- 3. berhenti sendiri di akhir ---------------------- */

console.log('\n— 3. Berhenti sendiri di akhir lagu —')
// Pastikan metronom dalam keadaan berhenti sebelum memulai.
if ((await tombolMulai()).includes('Berhenti')) {
  await p.click('[data-testid="tombol-mulai"]')
  await wait(700)
}
await p.click('[data-testid="tombol-mulai"]')
await wait(900)
uji('metronom berjalan', (await tombolMulai()).includes('Berhenti'), await tombolMulai())
const jalan = await angka('[data-testid="birama-ke"]')
uji('birama berjalan di 1–4', jalan >= 1 && jalan <= 4, String(jalan))

await wait(5000)
uji('berhenti sendiri setelah 4 dtk', (await tombolMulai()).includes('Mulai'), await tombolMulai())
sama('birama berhenti tepat di 4', await angka('[data-testid="birama-ke"]'), 4)
const lebar = await p.$eval('[data-testid="batang-progres"] > div', (e) => e.style.width)
uji('batang progres penuh 100%', parseInt(lebar, 10) >= 99, lebar)

/* ---------------------------- 4. mode ulang ----------------------------- */

console.log('\n— 4. Mode ulang —')
await p.click('[data-testid="tombol-ulang"]')
await wait(700)
uji('keterangan berubah jadi mengulang', (await teks('[data-testid="keterangan-akhir"]')).includes('mengulang'))
// Menyalakan ulang juga menulis ke lagu → tempo diatur ulang lagi.
uji('tempo diatur ulang setelah menyalakan ulang', await aturTempo240())
await p.click('[data-testid="tombol-mulai"]')
await wait(900)
uji('metronom jalan lagi', (await tombolMulai()).includes('Berhenti'))
await wait(5200)
uji('masih berjalan setelah lewat akhir (benar mengulang)', (await tombolMulai()).includes('Berhenti'), await tombolMulai())
const ulang = await angka('[data-testid="birama-ke"]')
uji('birama kembali ke rentang 1–4', ulang >= 1 && ulang <= 4, String(ulang))
await p.click('[data-testid="tombol-mulai"]')
await wait(700)

/* ------------------- 5. tombol ulang ringkas di kolom ------------------- */

console.log('\n— 5. Tombol ulang ringkas di kolom setelan —')
uji('tombol ulang ringkas ada', await ada('[data-testid="ulang-ringkas"]'))
const sebelum = (await teks('[data-testid="keterangan-akhir"]')).includes('mengulang')
await p.click('[data-testid="ulang-ringkas"]')
await wait(800)
const sesudah = (await teks('[data-testid="keterangan-akhir"]')).includes('mengulang')
uji('tombol ringkas ikut mengubah mode ulang', sebelum !== sesudah, `${sebelum} → ${sesudah}`)

// Kosongkan panjang → kembali seperti lagu lama (tanpa akhir).
console.log('\n— 6. Kosongkan panjang → perilaku lama —')
await isi('[data-testid="panjang-lagu"]', '')
await wait(900)
uji('kartu panjang hilang', !(await ada('[data-testid="kartu-panjang"]')))
uji('tempo diatur ulang setelah mengosongkan panjang', await aturTempo240())
await p.click('[data-testid="tombol-mulai"]')
await wait(900)
uji('metronom jalan', (await tombolMulai()).includes('Berhenti'))
await wait(5200)
uji('terus berjalan — tanpa panjang tidak berhenti sendiri', (await tombolMulai()).includes('Berhenti'), await tombolMulai())
uji('birama lewat 4', (await angka('[data-testid="birama-ke"]')) > 4)
await p.click('[data-testid="tombol-mulai"]')
await wait(600)

console.log('\n— Konsol —')
const errNyata = errors.filter((e) => !/favicon|Download the React/i.test(e))
uji('tidak ada error konsol', errNyata.length === 0, errNyata.slice(0, 3).join(' | '))

console.log(`\n=== ${lulus} lulus, ${gagal} gagal ===`)
await browser.close()
process.exit(gagal > 0 ? 1 : 0)
