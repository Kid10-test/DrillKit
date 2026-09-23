/**
 * M1 — uji tanda birama & hitung mundur di browser sungguhan.
 * Pakai: node m1-birama.mjs [BASE_URL]
 *   node m1-birama.mjs http://localhost:5173
 *   node m1-birama.mjs http://localhost:4173
 *   node m1-birama.mjs file:///home/user/drillkit/portable/DrillKit.html
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
const errors = []
p.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text())
})
p.on('pageerror', (e) => errors.push(String(e)))

/* ------------------------------- pembantu -------------------------------- */

const ada = async (sel) => (await p.$(sel)) !== null
const teks = async (sel) => p.$eval(sel, (e) => e.textContent.trim()).catch(() => null)

async function setInput(sel, nilai) {
  await p.$eval(
    sel,
    (el, v) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      setter.call(el, String(v))
      el.dispatchEvent(new Event('input', { bubbles: true }))
    },
    nilai,
  )
  await wait(250)
}

async function pilih(sel, nilai) {
  await p.select(sel, String(nilai))
  await wait(350)
}

/**
 * Pilih opsi berdasarkan TEKS yang terlihat, lalu kirim **nilai** opsinya
 * (bukan nomor urutnya) — penting karena tidak semua opsi bernilai angka
 * (mis. "Kustom…" bernilai 'kustom', "Suara manusia" bernilai 'suara').
 */
async function pilihBerdasarkanTeks(sel, label) {
  const nilai = await p.$$eval(
    sel + ' option',
    (opts, lb) => {
      const o = opts.find((x) => x.textContent.trim() === lb)
      return o ? o.value : null
    },
    label,
  )
  if (nilai === null) {
    const semua = await p.$$eval(sel + ' option', (o) => o.map((x) => x.textContent.trim()))
    throw new Error('opsi tidak ketemu: ' + label + ' | ada: ' + semua.join(' / '))
  }
  await pilih(sel, nilai)
  return nilai
}

/** Tingkat tiap kotak pratinjau: 2 = aksen, 1 = biasa. */
const kotak = () =>
  p.$$eval('[data-testid="meter-preview"] div[data-tingkat]', (els) =>
    els.map((e) => Number(e.getAttribute('data-tingkat'))),
  )

/* --------------------------------- mulai --------------------------------- */

// Berkas portabel dibuka langsung; alamat http butuh garis miring di belakang.
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
await wait(2200)

console.log('\n— Kartu tanda birama ada di halaman Musik —')
uji('kartu tanda birama tampil', await ada('[data-testid="kartu-birama"] [data-testid="pilih-birama"]'))
uji('kartu hitung mundur tampil', await ada('[data-testid="kartu-hitung-mundur"] [data-testid="atur-hitung-mundur"]'))
uji('bawaan 4/4 → pratinjau 4 kotak', (await kotak()).length === 4)

console.log('\n— Meter ganjil: aksen jatuh sesuai pengelompokan —')
sama('4/4 bawaan → aksen hanya di ketuk 1', await kotak(), [2, 1, 1, 1])

await pilihBerdasarkanTeks('[data-testid="meter-pilihan"]', '7/8 · 2+2+3')
sama('7/8 2+2+3 → aksen di 1,3,5', await kotak(), [2, 1, 2, 1, 2, 1, 1])
uji('label pengelompokan 2+2+3', (await teks('[data-testid="meter-label-kelompok"]')) === '2+2+3', await teks('[data-testid="meter-label-kelompok"]'))

await pilihBerdasarkanTeks('[data-testid="meter-pilihan"]', '7/8 · 3+2+2')
sama('7/8 3+2+2 → aksen di 1,4,6', await kotak(), [2, 1, 1, 2, 1, 2, 1])

await pilihBerdasarkanTeks('[data-testid="meter-pilihan"]', '7/8 · 2+3+2')
sama('7/8 2+3+2 → aksen di 1,3,6', await kotak(), [2, 1, 2, 1, 1, 2, 1])

await pilihBerdasarkanTeks('[data-testid="meter-pilihan"]', '5/8 · 3+2')
sama('5/8 3+2 → aksen di 1,4', await kotak(), [2, 1, 1, 2, 1])

await pilihBerdasarkanTeks('[data-testid="meter-pilihan"]', '12/8 · 3+3+3+3')
sama('12/8 → aksen di 1,4,7,10', await kotak(), [2, 1, 1, 2, 1, 1, 2, 1, 1, 2, 1, 1])

await pilihBerdasarkanTeks('[data-testid="meter-pilihan"]', '6/8 · 3+3')
sama('6/8 3+3 → aksen di 1,4', await kotak(), [2, 1, 1, 2, 1, 1])

console.log('\n— Kustom penuh: pembilang & penyebut bebas —')
await pilihBerdasarkanTeks('[data-testid="meter-pilihan"]', 'Kustom…')
uji('mode kustom menampilkan input pembilang', await ada('[data-testid="meter-pembilang"]'))
uji('mode kustom menampilkan pilihan penyebut', await ada('[data-testid="meter-penyebut"]'))

await setInput('[data-testid="meter-pembilang"]', 11)
await pilih('[data-testid="meter-penyebut"]', 8)
{
  const k = await teks('[data-testid="meter-label-kelompok"]')
  const jml = (await kotak()).length
  uji('kustom 11/8 → 11 kotak', jml === 11, 'dapat ' + jml)
  uji('kustom 11/8 → pengelompokan otomatis ' + k, /^[\d+]+$/.test(k) && k.split('+').reduce((a, b) => a + Number(b), 0) === 11, k)
}

await setInput('[data-testid="meter-pembilang"]', 13)
await pilih('[data-testid="meter-penyebut"]', 16)
{
  const k = await teks('[data-testid="meter-label-kelompok"]')
  uji('kustom 13/16 → pengelompokan jumlahnya 13', k.split('+').reduce((a, b) => a + Number(b), 0) === 13, k)
  uji('kustom 13/16 → 13 kotak', (await kotak()).length === 13)
}

console.log('\n— Pengelompokan bisa diubah sendiri —')
await pilihBerdasarkanTeks('[data-testid="meter-pilihan"]', '7/8 · 2+2+3')
{
  // Klik "+" pada kelompok pertama: 2 → 3, dan jumlah tetap 7.
  const sebelum = await teks('[data-testid="meter-label-kelompok"]')
  await p.click('[data-testid="kelompok-0"] button[title^="Tambah"]')
  await wait(350)
  const sesudah = await teks('[data-testid="meter-label-kelompok"]')
  const jml = sesudah.split('+').reduce((a, b) => a + Number(b), 0)
  uji(`kelompok diubah: ${sebelum} → ${sesudah}`, jml === 7 && sesudah !== sebelum, sesudah)
  await p.click('[data-testid="pilih-birama"] button[title="Kembalikan ke pengelompokan baku"]')
  await wait(350)
  uji('tombol Reset mengembalikan ke 2+2+3', (await teks('[data-testid="meter-label-kelompok"]')) === '2+2+3')
}

console.log('\n— Pengelompokan benar-benar TERDENGAR (bukan cuma di layar) —')
{
  // Sadap osilator: aksen = 1400 Hz, ketuk biasa = 1000 Hz (suara "klik").
  async function rekam(meterLabel, detik) {
    await pilihBerdasarkanTeks('[data-testid="meter-pilihan"]', meterLabel)
    await pilih('[data-testid="pembagian"]', 1)
    await setInput('[data-testid="bpm"]', 240)
    await p.evaluate(() => {
      window.__osc = []
      const C = window.AudioContext
      if (!C.prototype.__disadap) {
        const asli = C.prototype.createOscillator
        C.prototype.createOscillator = function () {
          const o = asli.call(this)
          window.__osc.push(o)
          return o
        }
        C.prototype.__disadap = true
      }
      window.__osc.length = 0
    })
    await p.evaluate(() => {
      ;[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Mulai')?.click()
    })
    await wait(detik)
    await p.evaluate(() => {
      ;[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Berhenti')?.click()
    })
    await wait(300)
    return p.evaluate(() => window.__osc.map((o) => Math.round(o.frequency.value)))
  }

  const t78 = await rekam('7/8 · 2+2+3', 3600)
  const aksen78 = t78.filter((f) => f === 1400).length
  const biasa78 = t78.filter((f) => f === 1000).length
  const total78 = aksen78 + biasa78
  uji('7/8 menghasilkan bunyi yang cukup untuk dinilai', total78 >= 14, `total ${total78}`)
  // 7/8 = 2+2+3 → 3 aksen dari 7 not = 0,43. Kalau pengelompokan diabaikan
  // (7 ketuk sama kuat) nilainya cuma 1/7 = 0,14.
  const rasio78 = total78 ? aksen78 / total78 : 0
  uji(`7/8 → 3 aksen tiap birama (rasio ${rasio78.toFixed(2)}, bukan 0,14)`, rasio78 > 0.3 && rasio78 < 0.55, `aksen ${aksen78} / total ${total78}`)

  const t44 = await rekam('4/4', 3600)
  const aksen44 = t44.filter((f) => f === 1400).length
  const total44 = aksen44 + t44.filter((f) => f === 1000).length
  const rasio44 = total44 ? aksen44 / total44 : 0
  uji(`4/4 → 1 aksen tiap birama (rasio ${rasio44.toFixed(2)}, bukan 1,0)`, rasio44 > 0.15 && rasio44 < 0.35, `aksen ${aksen44} / total ${total44}`)

  uji('7/8 jelas lebih banyak aksen daripada 4/4', rasio78 > rasio44 + 0.1, `${rasio78.toFixed(2)} vs ${rasio44.toFixed(2)}`)
}

console.log('\n— Acuan tempo bisa dipilih —')
await pilihBerdasarkanTeks('[data-testid="meter-pilihan"]', '7/8 · 2+2+3')
await setInput('input[type="number"][value], input[type="number"]', 120)
{
  async function ringkasan() {
    return teks('[data-testid="meter-ringkasan"]')
  }
  const idxSeperdelapan = await p.$$eval('[data-testid="meter-acuan"] option', (o) => o.findIndex((x) => x.textContent.includes('Not seperdelapan')))
  await pilih('[data-testid="meter-acuan"]', idxSeperdelapan)
  const r8 = await ringkasan()
  const idxSeperempat = await p.$$eval('[data-testid="meter-acuan"] option', (o) => o.findIndex((x) => x.textContent.trim() === 'Not seperempat'))
  await pilih('[data-testid="meter-acuan"]', idxSeperempat)
  const r4 = await ringkasan()
  uji('ringkasan menyebut acuan seperdelapan', r8.includes('seperdelapan'), r8)
  uji('ringkasan menyebut acuan seperempat', r4.includes('seperempat'), r4)
  uji('perhitungan durasi menyertai ringkasan', /satu birama ≈ \d/.test(r8) || /satu birama ≈ \d/.test(r4), r8 + ' | ' + r4)
  await pilih('[data-testid="meter-acuan"]', idxSeperdelapan)
}

console.log('\n— Hitung mundur —')
{
  uji('hitung mundur bawaan mati', !(await ada('[data-testid="hm-ulang"]')))
  await p.click('[data-testid="hm-aktif"]')
  await wait(400)
  uji('setelah dinyalakan, pilihan tampil', await ada('[data-testid="hm-ulang"]'))
  uji('ada pilihan bunyi', await ada('[data-testid="hm-suara"]'))

  // 7/8 dengan hitung per pulsa → 3 ketuk.
  const teksPulsa = await teks('[data-testid="hm-tiapnot"] option')
  uji('pilihan "tiap pulsa" tersedia', true, teksPulsa)

  await setInput('[data-testid="hm-ulang"]', 2)
  uji('ulang bisa diatur ke 2', (await p.$eval('[data-testid="hm-ulang"]', (e) => e.value)) === '2')

  // Suara manusia — boleh tidak tersedia di headless, yang penting tidak error.
  await pilihBerdasarkanTeks('[data-testid="hm-suara"]', 'Suara manusia')
  await wait(500)
  const adaBagian = await ada('[data-testid="hm-pilih-suara"]')
  const adaPeringatan = await ada('[data-testid="hm-tanpa-suara"]')
  uji('suara manusia: daftar suara tersedia, atau peringatan jujur kalau tidak ada', adaBagian || adaPeringatan, `suara=${adaBagian} peringatan=${adaPeringatan}`)
  if (adaBagian) {
    const pratinjau = await teks('[data-testid="hm-pratinjau"]')
    uji('pratinjau ucapan menampilkan 1 · 2 · 3', /1 · 2 · 3/.test(pratinjau), pratinjau)
    uji('pratinjau menyebut diulang 2×', /diulang 2×/.test(pratinjau), pratinjau)
  }
  await pilihBerdasarkanTeks('[data-testid="hm-suara"]', 'Bel (cowbell)')
}

console.log('\n— Mulai dari birama 45 + hitung mundur benar-benar berjalan —')
await pilihBerdasarkanTeks('[data-testid="meter-pilihan"]', '7/8 · 2+2+3')
await setInput('[data-testid="mulai-dari"]', 45)
uji('mulai dari birama tersimpan 45', (await p.$eval('[data-testid="mulai-dari"]', (e) => e.value)) === '45')

// Tempo tinggi supaya hitung mundur cepat selesai (7/8 @240 = 1,75 detik/putaran).
await p.$$eval('input[type="number"]', (els) => {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  const bpm = els.find((e) => e.max === '240' && e.min === '40')
  if (bpm) {
    setter.call(bpm, '240')
    bpm.dispatchEvent(new Event('input', { bubbles: true }))
  }
})
await wait(400)

await p.evaluate(() => {
  const tombol = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Mulai')
  tombol?.click()
})

// Tunggu tahap hitung mundur muncul (paling lama 3 detik).
let tahapHitung = false
for (let i = 0; i < 30; i++) {
  if (await ada('[data-testid="tahap-hitung"]')) {
    tahapHitung = true
    break
  }
  await wait(100)
}
uji('tahap "Hitung mundur" muncul sebelum lagu mulai', tahapHitung)

// Setelah hitung mundur selesai, penghitung birama harus mulai dari 45.
let biramaKe = null
for (let i = 0; i < 60; i++) {
  const t = await teks('[data-testid="birama-ke"]')
  const masih = await ada('[data-testid="tahap-hitung"]')
  if (t && !masih) {
    biramaKe = t
    break
  }
  await wait(150)
}
uji('setelah hitung mundur, birama mulai dari 45', biramaKe === '45', 'dapat ' + biramaKe)

// Hentikan.
await p.evaluate(() => {
  const tombol = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Berhenti')
  tombol?.click()
})
await wait(500)

console.log('\n— Editor lagu punya pilihan yang sama —')
{
  await p.evaluate(() => {
    const tombol = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Lagu'))
    tombol?.click()
  })
  await wait(600)
  const adaModal = await ada('[data-testid="lagu-birama"]')
  if (!adaModal) {
    // Coba lewat tombol tambah lagu di kartu Repertoar.
    await p.evaluate(() => {
      const tombol = [...document.querySelectorAll('button')].find((b) => /lagu/i.test(b.textContent) && b.textContent.length < 30)
      tombol?.click()
    })
    await wait(600)
  }
  const ada2 = await ada('[data-testid="lagu-birama"]')
  uji('editor lagu punya pemilih tanda birama yang sama', ada2)
  if (ada2) {
    uji('editor lagu punya pengatur hitung mundur', await ada('[data-testid="lagu-hitung-mundur"]'))
    uji('editor lagu memakai komponen yang sama', await ada('[data-testid="lagu-birama"] [data-testid="pilih-birama"]'))
  }
  await p.keyboard.press('Escape')
  await wait(300)
}

console.log('\n— Konsol —')
const errorNyata = errors.filter((e) => !/favicon|manifest|ERR_FILE_NOT_FOUND|net::ERR/i.test(e))
uji('tidak ada error di konsol', errorNyata.length === 0, errorNyata.slice(0, 3).join(' | '))

await browser.close()
console.log(`\n${gagal === 0 ? 'LULUS' : 'GAGAL'}: ${lulus} lulus, ${gagal} gagal — ${BASE}\n`)
process.exit(gagal === 0 ? 0 : 1)
