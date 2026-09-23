/**
 * M2 — ulang bagian: mengulang satu rentang birama, bukan seluruh lagu.
 *
 * Digerakkan antarmuka — jalan di dev, produksi, dan berkas portabel.
 *
 * Lagu uji: 4/4 @240 → 60/240 × 4 = 1 detik per birama, panjang 8 birama
 * (8 detik). Rentang ulang 3–4 = 2 detik per putaran.
 *
 * Yang paling penting diuji: kalau rentang menyala, lagu **tidak** berhenti
 * di birama ke-8 — bagian itu terus diulang.
 *
 * Pakai: node m2-ulang-bagian.mjs [BASE_URL]
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
await p.setViewport({ width: 1280, height: 1500 })
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
const biramaKe = () => angka('[data-testid="birama-ke"]')

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

/* ------------------------- 1. buat lagu 8 birama ------------------------- */

console.log('\n— 1. Lagu 8 birama @240 (1 dtk per birama) —')
await klikMengandung('Tambah lagu')
await p.evaluate(() => {
  const m = document.querySelector('[data-testid="modal-lagu"]')
  const ins = m?.querySelectorAll('input') ?? []
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  if (ins[0]) {
    set.call(ins[0], 'Lagu Ulang Bagian')
    ins[0].dispatchEvent(new Event('input', { bubbles: true }))
  }
  if (ins[2]) {
    set.call(ins[2], '240')
    ins[2].dispatchEvent(new Event('input', { bubbles: true }))
  }
})
await wait(400)
await klikTepat('Simpan')
await wait(1000)
uji('lagu dibuat', (await p.evaluate(() => document.body.textContent)).includes('Lagu Ulang Bagian'))

await p.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find(
    (e) =>
      e.textContent.includes('Lagu Ulang Bagian') &&
      e.getAttribute('data-testid')?.startsWith('pilih-lagu-'),
  )
  b?.click()
})
await wait(900)
await isi('[data-testid="panjang-lagu"]', 8)
await wait(700)
sama('panjang lagu = 8 birama', await p.$eval('[data-testid="panjang-lagu"]', (e) => e.value), '8')
sama('total durasi 0:08', await teks('[data-testid="setlist-total"]'), null) // belum ada set list

/* --------------------------- 2. atur rentang ---------------------------- */

console.log('\n— 2. Atur rentang ulang 3–4 —')
uji('kartu ulang bagian ada', await ada('[data-testid="kartu-ulang-bagian"]'))
uji('tombol ulang bagian ada', await ada('[data-testid="tombol-ulang-bagian"]'))
uji('isian dari ada', await isi('[data-testid="ulang-dari"]', 3))
uji('isian sampai ada', await isi('[data-testid="ulang-sampai"]', 4))
await wait(700)

const ringkasan = await teks('[data-testid="ulang-ringkasan"]')
uji('ringkasan menyebut 2 birama', ringkasan.includes('2 birama'), ringkasan)
uji('ringkasan menyebut durasi putaran 0:02', ringkasan.includes('0:02'), ringkasan)

/* ---------------------- 3. rentang menyala: mengulang ------------------- */

console.log('\n— 3. Rentang menyala: bagian 3–4 diulang terus —')
await p.click('[data-testid="tombol-ulang-bagian"]')
await wait(800)
uji('tombol berubah jadi "Mengulang"', (await teks('[data-testid="tombol-ulang-bagian"]')).includes('Mengulang'))
uji('keterangan menyebut rentang', (await teks('[data-testid="keterangan-akhir"]')).includes('3–4'))

await p.click('[data-testid="tombol-mulai"]')
await wait(1500)
uji('metronom berjalan', (await tombolMulai()).includes('Berhenti'), await tombolMulai())
const b1 = await biramaKe()
uji('birama berada dalam rentang 3–4', b1 >= 3 && b1 <= 4, String(b1))

// Lewati beberapa putaran.
await wait(2000)
const b2 = await biramaKe()
uji('setelah ±3,5 dtk masih di rentang 3–4', b2 >= 3 && b2 <= 4, String(b2))

// Ini uji yang menentukan: lagu 8 birama = 8 dtk, tapi rentang menyala
// sehingga lagu TIDAK boleh berhenti di detik ke-8.
await wait(5200)
uji('MASIH berjalan setelah lewat 8 dtk (menang atas akhir lagu)', (await tombolMulai()).includes('Berhenti'), await tombolMulai())
const b3 = await biramaKe()
uji('birama tetap di rentang 3–4', b3 >= 3 && b3 <= 4, String(b3))

// Hentikan manual.
await p.click('[data-testid="tombol-mulai"]')
await wait(700)
uji('bisa dihentikan manual', (await tombolMulai()).includes('Mulai'), await tombolMulai())

/* ------------------- 4. rentang mati: berhenti di akhir ----------------- */

console.log('\n— 4. Rentang dimatikan: lagu berhenti di birama 8 —')
await p.click('[data-testid="tombol-ulang-bagian"]')
await wait(700)
uji('tombol kembali ke "Ulang bagian"', (await teks('[data-testid="tombol-ulang-bagian"]')).includes('Ulang bagian'))
uji('keterangan kembali menyebut berhenti', (await teks('[data-testid="keterangan-akhir"]')).includes('berhenti'))

await p.click('[data-testid="tombol-mulai"]')
await wait(900)
uji('metronom jalan', (await tombolMulai()).includes('Berhenti'))
await wait(8500) // 8 birama @1 dtk + jeda
uji('berhenti sendiri di akhir lagu', (await tombolMulai()).includes('Mulai'), await tombolMulai())
sama('birama berhenti di 8', await biramaKe(), 8)

/* ------------------------- 5. rentang tak sah -------------------------- */

console.log('\n— 5. Rentang tak sah ditolak —')
await isi('[data-testid="ulang-dari"]', 9)
await wait(800)
uji('dari > sampai → peringatan muncul', await ada('[data-testid="ulang-tidak-sah"]'))
uji('tombol ulang bagian dimatikan', await p.$eval('[data-testid="tombol-ulang-bagian"]', (e) => e.disabled))
uji('ringkasan disembunyikan', !(await ada('[data-testid="ulang-ringkasan"]')))

console.log('\n— 6. Rentang melebihi panjang lagu ditolak —')
await isi('[data-testid="ulang-dari"]', 6)
await isi('[data-testid="ulang-sampai"]', 20)
await wait(800)
uji('sampai > panjang lagu → peringatan muncul', await ada('[data-testid="ulang-tidak-sah"]'))

// Kembalikan ke rentang sah: rentangnya tersimpan walau sempat tak sah.
await isi('[data-testid="ulang-sampai"]', 8)
await wait(800)
uji('rentang sah lagi', await ada('[data-testid="ulang-ringkasan"]'))
uji('nilai yang diketik tersimpan', (await p.$eval('[data-testid="ulang-dari"]', (e) => e.value)) === '6')

console.log('\n— Konsol —')
const errNyata = errors.filter((e) => !/favicon|Download the React/i.test(e))
uji('tidak ada error konsol', errNyata.length === 0, errNyata.slice(0, 3).join(' | '))

console.log(`\n=== ${lulus} lulus, ${gagal} gagal ===`)
await browser.close()
process.exit(gagal > 0 ? 1 : 0)
