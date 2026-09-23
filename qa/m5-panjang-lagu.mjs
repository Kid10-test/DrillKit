/**
 * M5 — panjang lagu: metronom berhenti sendiri di akhir lagu, bisa mengulang,
 * dan lagu yang belum diisi panjangnya tetap berjalan seperti dulu.
 *
 * Lagu uji: 4/4 @240 → 60/240 × 4 = 1 detik per birama.
 *   "Lagu Pendek"   = 4 birama  → 4 detik, berhenti sendiri.
 *   "Lagu Tak Terbatas" = tanpa panjang → terus berjalan.
 *
 * Pakai: node m5-panjang-lagu.mjs [BASE_URL]
 */
import puppeteer from 'puppeteer'
import { lewatSambutan } from './sambutan.mjs'
import { segar, tanamLagu } from './db-mentah.mjs'

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

await p.goto(BASE.startsWith('file:') ? BASE : BASE + '/', { waitUntil: 'networkidle2' })

// N8 — layar sambutan menutupi semua yang ada di bawahnya, dan tiap
// peluncuran Puppeteer membawa perangkat baru. Tanpa ini rangkaian
// uji ini mogok di klik pertamanya dan tidak pernah sampai ke
// periksaannya — yang membuatnya tampak "tidak ada ringkasannya"
// alih-alih gagal terang-terangan.
await lewatSambutan(p)
await wait(2200)
await p.evaluate(() => {
  location.hash = '#/musik'
})
await wait(2000)

/* ------------------------------- persiapan -------------------------------- */

console.log('\n— Persiapan: dua lagu —')
/*
 * N8 — dulu data ditanam dengan menyisipkan modul aplikasinya sendiri
 * (`await import('/src/db/db.ts')`). Itu hanya ada di server
 * pengembangan; di versi jadi impornya gagal dan rangkaian ini mogok
 * sebelum periksaannya yang pertama. Sekarang ditulis langsung ke
 * IndexedDB (lihat `db-mentah.mjs`).
 *
 * Catatan penting: tulisan mentah tidak memberitahu `useLiveQuery`,
 * jadi halamannya dimuat ulang sesudahnya — tanpa itu lagunya sudah
 * ada di basis data tetapi tidak pernah muncul di repertoar.
 */
await tanamLagu(
  p,
  [
    {
      id: 'uji-lagu-pendek',
      title: 'Lagu Pendek Uji',
      bpm: 240,
      beats: 4,
      tempoMap: [],
      panjangBirama: 4,
      ulang: 0,
      createdAt: Date.now(),
    },
    {
      id: 'uji-lagu-takterbatas',
      title: 'Lagu Tak Terbatas Uji',
      bpm: 240,
      beats: 4,
      tempoMap: [],
      createdAt: Date.now(),
    },
  ],
  ['Lagu Pendek Uji', 'Lagu Tak Terbatas Uji'],
)
await segar(p)
await p.evaluate(() => {
  location.hash = '#/musik'
})
await wait(1800)
uji('kedua lagu muncul di repertoar', (await p.evaluate(() => document.body.textContent)).includes('Lagu Pendek Uji'))

const pilihLagu = async (id) => {
  await p.click(`[data-testid="pilih-lagu-${id}"]`)
  await wait(900)
}

/* --------------------- 1. lagu berpanjang: tampilannya -------------------- */

console.log('\n— 1. Lagu berpanjang: kartu panjang lagu —')
await pilihLagu('uji-lagu-pendek')
uji('kartu panjang lagu muncul', await ada('[data-testid="kartu-panjang"]'))
sama('total birama = 4', await angka('[data-testid="birama-total"]'), 4)
uji('teks sisa waktu ada', await ada('[data-testid="teks-sisa"]'))
uji('batang progres ada', await ada('[data-testid="batang-progres"]'))
uji('tombol ulang ada', await ada('[data-testid="tombol-ulang"]'))
sama('panjang lagu terbaca di kolom setelan', await p.$eval('[data-testid="panjang-lagu"]', (e) => e.value), '4')

const sisaAwal = await teks('[data-testid="teks-sisa"]')
uji('durasi total 0:04 ditampilkan', sisaAwal.includes('0:04'), sisaAwal)
uji('keterangan: berhenti di akhir', (await teks('[data-testid="keterangan-akhir"]')).includes('berhenti'))

/* ---------------- 2. berhenti sendiri di akhir lagu ---------------------- */

console.log('\n— 2. Berhenti sendiri di akhir lagu (4 birama @240 = 4 dtk) —')
await p.click('[data-testid="tombol-mulai"]')
await wait(900)
uji('metronom berjalan (tombol jadi Berhenti)', (await tombolMulai()).includes('Berhenti'), await tombolMulai())
const biramaSaatJalan = await angka('[data-testid="birama-ke"]')
uji('birama berjalan di antara 1 dan 4', biramaSaatJalan >= 1 && biramaSaatJalan <= 4, String(biramaSaatJalan))

await wait(5000) // total 5,9 dtk — lagu habis di 4 dtk
uji('berhenti sendiri (tombol kembali ke Mulai)', (await tombolMulai()).includes('Mulai'), await tombolMulai())
const biramaAkhir = await angka('[data-testid="birama-ke"]')
uji('birama berhenti di 4, tidak lebih', biramaAkhir === 4, String(biramaAkhir))

// Progres harus penuh, bukan setengah.
const lebarAkhir = await p.$eval('[data-testid="batang-progres"] > div', (e) => e.style.width)
uji('batang progres penuh di akhir', parseInt(lebarAkhir, 10) >= 99, lebarAkhir)

/* ---------------------------- 3. mode ulang ------------------------------ */

console.log('\n— 3. Mode ulang —')
await p.click('[data-testid="tombol-ulang"]')
await wait(800)
uji('keterangan berubah jadi mengulang', (await teks('[data-testid="keterangan-akhir"]')).includes('mengulang'))

await p.click('[data-testid="tombol-mulai"]')
await wait(900)
uji('metronom jalan lagi', (await tombolMulai()).includes('Berhenti'))
// Lewati akhir lagu (4 dtk): kalau benar mengulang, masih berjalan dan
// biramanya kembali ke awal, bukan terus naik.
await wait(5200)
uji('masih berjalan setelah lewat 4 dtk (tanda benar-benar mengulang)', (await tombolMulai()).includes('Berhenti'), await tombolMulai())
const biramaUlang = await angka('[data-testid="birama-ke"]')
uji('birama kembali ke rentang 1–4, bukan terus naik', biramaUlang >= 1 && biramaUlang <= 4, String(biramaUlang))

await p.click('[data-testid="tombol-mulai"]') // berhentikan
await wait(700)
uji('bisa dihentikan manual saat mengulang', (await tombolMulai()).includes('Mulai'))

/* ------------------- 4. lagu tanpa panjang: perilaku lama ---------------- */

console.log('\n— 4. Lagu tanpa panjang: tetap berjalan (perilaku lama) —')
await pilihLagu('uji-lagu-takterbatas')
uji('kartu panjang TIDAK muncul', !(await ada('[data-testid="kartu-panjang"]')))
sama('isian panjang kosong', await p.$eval('[data-testid="panjang-lagu"]', (e) => e.value), '')

await p.click('[data-testid="tombol-mulai"]')
await wait(900)
uji('metronom jalan', (await tombolMulai()).includes('Berhenti'))
await wait(5200) // jauh melampaui 4 birama
uji('MASIH berjalan — lagu tanpa panjang tidak berhenti sendiri', (await tombolMulai()).includes('Berhenti'), await tombolMulai())
const biramaBebas = await angka('[data-testid="birama-ke"]')
uji('birama terus naik lewat 4', biramaBebas > 4, String(biramaBebas))
await p.click('[data-testid="tombol-mulai"]')
await wait(600)

/* --------------- 5. mengisi panjang dari editor lagu --------------------- */

console.log('\n— 5. Isi panjang lewat kolom setelan —')
await pilihLagu('uji-lagu-takterbatas')
await p.evaluate(() => {
  const i = document.querySelector('[data-testid="panjang-lagu"]')
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  set.call(i, '8')
  i.dispatchEvent(new Event('input', { bubbles: true }))
})
await wait(1200)
uji('kartu panjang muncul setelah diisi', await ada('[data-testid="kartu-panjang"]'))
sama('total birama = 8', await angka('[data-testid="birama-total"]'), 8)
const sisa8 = await teks('[data-testid="teks-sisa"]')
uji('durasi total 0:08', sisa8.includes('0:08'), sisa8)

/* -------------------- 6. mulai dari birama > panjang --------------------- */

console.log('\n— 6. Mulai dari birama melebihi panjang —')
await p.evaluate(() => {
  const i = document.querySelector('[data-testid="mulai-dari"]')
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  set.call(i, '99')
  i.dispatchEvent(new Event('input', { bubbles: true }))
})
await wait(700)
await p.click('[data-testid="tombol-mulai"]')
await wait(2500)
uji('tidak memutar apa pun & langsung berhenti', (await tombolMulai()).includes('Mulai'), await tombolMulai())

// Pemulihan: setelah kasus di atas, kembalikan ke birama 1 dan pastikan
// lagu bisa diputar normal lagi (mesin tidak terkunci).
await p.evaluate(() => {
  const i = document.querySelector('[data-testid="mulai-dari"]')
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  set.call(i, '1')
  i.dispatchEvent(new Event('input', { bubbles: true }))
})
await wait(700)
await p.click('[data-testid="tombol-mulai"]')
await wait(1200)
uji('lagu bisa diputar normal lagi setelahnya', (await tombolMulai()).includes('Berhenti'), await tombolMulai())
uji('birama kembali ke rentang wajar (1–8)', (await angka('[data-testid="birama-ke"]')) <= 8)
await p.click('[data-testid="tombol-mulai"]')
await wait(600)

console.log('\n— Konsol —')
const errNyata = errors.filter((e) => !/favicon|Download the React/i.test(e))
uji('tidak ada error konsol', errNyata.length === 0, errNyata.slice(0, 3).join(' | '))

console.log(`\n=== ${lulus} lulus, ${gagal} gagal ===`)
await browser.close()
process.exit(gagal > 0 ? 1 : 0)
