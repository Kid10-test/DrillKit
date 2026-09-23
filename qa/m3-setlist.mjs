/**
 * M3 — set list: susun, urutkan, hitung total, dan putar berurutan.
 *
 * Digerakkan antarmuka (tidak memakai modul internal) supaya bisa dijalankan
 * di dev, produksi, dan berkas portabel `file://`.
 *
 * Tiga lagu @240 BPM, masing-masing 2 birama → 60/240 × 4 × 2 = 2 dtk per
 * lagu. Set list lengkap = 6 dtk, dan metronom harus pindah sendiri tiap
 * 2 detik.
 *
 * Pakai: node m3-setlist.mjs [BASE_URL]
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
await p.setViewport({ width: 1280, height: 1400 })
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
  await wait(400)
  return ok
}

/** Buat satu lagu lewat modal. Input modal: [judul, komposer, bpm, tangga nada]. */
async function buatLagu(judul, bpm) {
  await klikMengandung('Tambah lagu')
  await wait(500)
  await p.evaluate(
    (j, b) => {
      const m = document.querySelector('[data-testid="modal-lagu"]')
      const ins = m?.querySelectorAll('input') ?? []
      const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      if (ins[0]) {
        set.call(ins[0], j)
        ins[0].dispatchEvent(new Event('input', { bubbles: true }))
      }
      if (ins[2]) {
        set.call(ins[2], String(b))
        ins[2].dispatchEvent(new Event('input', { bubbles: true }))
      }
    },
    judul,
    bpm,
  )
  await wait(400)
  await klikTepat('Simpan')
  await wait(900)
  return (await p.evaluate(() => document.body.textContent)).includes(judul)
}

/** Pilih lagu di repertoar berdasarkan judul. */
async function pilihLagu(judul) {
  const ok = await p.evaluate((j) => {
    const b = [...document.querySelectorAll('button')].find(
      (e) => e.textContent.includes(j) && e.getAttribute('data-testid')?.startsWith('pilih-lagu-'),
    )
    if (!b) return false
    b.click()
    return true
  }, judul)
  await wait(900)
  return ok
}

/** Judul lagu yang sedang tampil di panel "sedang diputar". */
const judulDiputar = () => teks('[data-testid="panel-judul"]')

/** Indeks baris set list yang sedang diputar (disorot hijau). */
const indeksAktif = () =>
  p.evaluate(() => {
    const el = [...document.querySelectorAll('[data-testid^="setlist-baris-"]')].find((e) =>
      e.className.includes('border-emerald-600/50'),
    )
    if (!el) return null
    return Number(el.getAttribute('data-testid').replace('setlist-baris-', ''))
  })

/**
 * Daftar judul lagu dalam set list, sesuai urutan tampil.
 * Hanya anak teks pertama yang dibaca — lencana "dimuat" ikut berada di
 * dalam <p> yang sama, jadi tidak boleh memakai textContent mentah.
 */
const urutanSetList = () =>
  p.$$eval('[data-testid^="setlist-pilih-"]', (els) =>
    els.map((e) => (e.querySelector('p')?.firstChild?.textContent ?? '').trim()),
  )

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

/* ---------------------------- 1. tiga lagu ------------------------------ */

console.log('\n— 1. Siapkan tiga lagu @240 BPM —')
uji('lagu A dibuat', await buatLagu('SL-A', 240))
uji('lagu B dibuat', await buatLagu('SL-B', 240))
uji('lagu C dibuat', await buatLagu('SL-C', 240))
uji('ketiga lagu ada di repertoar', (await p.evaluate(() => document.body.textContent)).includes('SL-C'))

// Tiap lagu diberi panjang 2 birama → 2 dtk @240.
for (const j of ['SL-A', 'SL-B', 'SL-C']) {
  await pilihLagu(j)
  await isi('[data-testid="panjang-lagu"]', 2)
  await wait(600)
}
uji('panjang lagu tersimpan', (await p.$eval('[data-testid="panjang-lagu"]', (e) => e.value)) === '2')

/* --------------------------- 2. kartu set list -------------------------- */

console.log('\n— 2. Kartu set list —')
uji('kartu set list ada', await ada('[data-testid="kartu-setlist"]'))
uji('belum ada set list → ada keterangan', await ada('[data-testid="setlist-kosong"]'))

uji('tombol Baru ada', await klikMengandung('Baru'))
await wait(900)
uji('set list baru terpilih otomatis', (await p.$eval('[data-testid="pilih-setlist"]', (e) => e.value)) !== '')
uji('form nama muncul', await ada('[data-testid="setlist-nama"]'))
await isi('[data-testid="setlist-nama"]', 'Show Uji')
await wait(600)
uji('nama tersimpan', (await p.$eval('[data-testid="setlist-nama"]', (e) => e.value)) === 'Show Uji')

/* ---------------------------- 3. tambah lagu ---------------------------- */

console.log('\n— 3. Tambah lagu ke set list —')
const pilihTambah = async (judul) => {
  const v = await p.$$eval(
    '[data-testid="setlist-pilih-tambah"] option',
    (o, j) => {
      const x = o.find((q) => q.textContent.trim() === j)
      return x ? x.value : null
    },
    judul,
  )
  if (v === null) return false
  await p.select('[data-testid="setlist-pilih-tambah"]', v)
  await wait(400)
  await p.click('[data-testid="setlist-tambah"]')
  await wait(800)
  return true
}

uji('tambah SL-A', await pilihTambah('SL-A'))
uji('tambah SL-B', await pilihTambah('SL-B'))
uji('tambah SL-C', await pilihTambah('SL-C'))

sama('jumlah lagu = 3', await angka('[data-testid="setlist-jumlah"]'), 3)
sama('total durasi = 0:06', await teks('[data-testid="setlist-total"]'), '0:06')
sama('urutan sesuai urutan menambahkan', await urutanSetList(), ['SL-A', 'SL-B', 'SL-C'])
uji('tidak ada peringatan (semua lagu punya panjang)', !(await ada('[data-testid="setlist-peringatan"]')))

/* ---------------------------- 4. pengurutan ----------------------------- */

console.log('\n— 4. Naik & turun —')
await p.click('[data-testid="setlist-turun-0"]')
await wait(800)
sama('turunkan A → B, A, C', await urutanSetList(), ['SL-B', 'SL-A', 'SL-C'])
await p.click('[data-testid="setlist-naik-1"]')
await wait(800)
sama('naikkan A lagi → A, B, C', await urutanSetList(), ['SL-A', 'SL-B', 'SL-C'])

console.log('\n— 5. Keluarkan & tambah kembali —')
await p.click('[data-testid="setlist-buang-2"]')
await wait(800)
sama('C keluar → 2 lagu', await angka('[data-testid="setlist-jumlah"]'), 2)
sama('total jadi 0:04', await teks('[data-testid="setlist-total"]'), '0:04')
// Kembalikan C supaya uji pemutaran utuh.
uji('tambah C kembali', await pilihTambah('SL-C'))
sama('kembali 3 lagu', await angka('[data-testid="setlist-jumlah"]'), 3)
sama('urutan C di akhir', await urutanSetList(), ['SL-A', 'SL-B', 'SL-C'])

/* --------------------- 6. putar berurutan tanpa henti ------------------- */

console.log('\n— 6. Putar set list berurutan (3 × 2 dtk = 6 dtk) —')
await p.click('[data-testid="setlist-mainkan-0"]')
await wait(700)
uji('metronom berjalan', (await tombolMulai()).includes('Berhenti'), await tombolMulai())
sama('lagu pertama yang diputar = SL-A', await judulDiputar(), 'SL-A')
sama('baris 0 disorot', await indeksAktif(), 0)

// Lewati lagu A (2 dtk) → harus sudah di lagu B.
await wait(2100)
sama('setelah ±2,8 dtk pindah ke lagu B', await judulDiputar(), 'SL-B')
sama('baris 1 disorot', await indeksAktif(), 1)

// Lewati lagu B → harus sudah di lagu C.
await wait(2100)
sama('setelah ±4,9 dtk pindah ke lagu C', await judulDiputar(), 'SL-C')
sama('baris 2 disorot', await indeksAktif(), 2)

// Lewati lagu C → set list habis, metronom berhenti sendiri.
await wait(2600)
uji('berhenti sendiri setelah lagu terakhir', (await tombolMulai()).includes('Mulai'), await tombolMulai())
sama('sorotan dilepas', await indeksAktif(), null)

/* ------------------- 7. mainkan dari tengah & berhenti ------------------ */

console.log('\n— 7. Mainkan dari lagu ke-2, lalu hentikan —')
await p.click('[data-testid="setlist-mainkan-1"]')
await wait(700)
uji('metronom jalan', (await tombolMulai()).includes('Berhenti'))
sama('langsung mulai dari SL-B', await judulDiputar(), 'SL-B')
sama('baris 1 disorot', await indeksAktif(), 1)

// Tekan lagi pada lagu yang sama → berhenti.
await p.click('[data-testid="setlist-mainkan-1"]')
await wait(800)
uji('tombol yang sama menghentikan', (await tombolMulai()).includes('Mulai'), await tombolMulai())
sama('sorotan dilepas', await indeksAktif(), null)

/* --------------------- 8. pilih lagu dari set list --------------------- */

console.log('\n— 8. Klik judul = muat lagu itu di metronom —')
await p.click('[data-testid="setlist-pilih-2"]')
await wait(900)
uji('lagu C dimuat di metronom', await ada('[data-testid="setlist-dimuat-2"]'))
sama('dan tertulis di panel', await judulDiputar(), 'SL-C')

/* -------------------- 9. lagu tanpa panjang diperingatkan -------------- */

console.log('\n— 9. Lagu tanpa panjang diperingatkan —')
// Kosongkan panjang salah satu lagu → total jadi perkiraan.
await isi('[data-testid="panjang-lagu"]', '')
await wait(900)
uji('peringatan muncul', await ada('[data-testid="setlist-peringatan"]'))
const peringatan = await teks('[data-testid="setlist-peringatan"]')
uji('peringatan menyebut 1 lagu', peringatan.includes('1 lagu'), peringatan)
sama('total tinggal 0:04 (dua lagu lain)', await teks('[data-testid="setlist-total"]'), '0:04')

console.log('\n— Konsol —')
const errNyata = errors.filter((e) => !/favicon|Download the React/i.test(e))
uji('tidak ada error konsol', errNyata.length === 0, errNyata.slice(0, 3).join(' | '))

console.log(`\n=== ${lulus} lulus, ${gagal} gagal ===`)
await browser.close()
process.exit(gagal > 0 ? 1 : 0)
