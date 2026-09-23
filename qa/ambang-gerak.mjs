/**
 * Uji antarmuka — ambang kesulitan gerak yang bisa diatur.
 *
 * Inti yang diuji: **analitik dan buku saku harus berkata sama**. Dulu analitik
 * hanya menilai kecepatan, jadi ia bisa berkata "semua nyaman" sementara
 * lembaran yang dicetak penuh warna merah. Kini ukuran langkah tampil di
 * analitik juga, dan ambangnya bisa diatur di Pengaturan.
 *
 * Cara membuktikannya lewat antarmuka tanpa menyiapkan formasi khusus:
 * gerakannya dibiarkan apa adanya, lalu ambangnya yang diperketat & dilonggarkan.
 * Kalau analitik benar-benar menilai ukuran langkah, verdict-nya harus berubah.
 */
import puppeteer from 'puppeteer'
import { lewatSambutan } from './sambutan.mjs'
/* N14 — dialihkan dari server pengembangan (:5173) ke hasil build
   (:4173). Server pengembangan menyajikan ratusan modul sekali muat dan
   kehabisan memori di kotak pasir; karena itu rangkaian ini dulu tidak
   pernah bisa masuk daftar regresi. */
const BASE = process.env.BASE || 'http://localhost:4173'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--mute-audio'] })
const p = await b.newPage()
await p.setViewport({ width: 1440, height: 1100 })
const errs = []
p.on('pageerror', (e) => errs.push(e.message.slice(0, 160)))
p.on('console', (m) => {
  if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160))
})

let lulus = 0
let gagal = 0
const catat = []
function cek(nama, syarat, keterangan = '') {
  if (syarat) lulus++
  else {
    gagal++
    catat.push(`GAGAL: ${nama}${keterangan ? ' — ' + keterangan : ''}`)
  }
}
const R = {}

const keHalaman = async (hash) => {
  await p.evaluate((h) => {
    location.hash = h
  }, hash)
  await wait(2600)
}
const tombol = (t) =>
  p.evaluate((x) => {
    const el = [...document.querySelectorAll('button')].find((y) => y.textContent.trim() === x)
    if (!el || el.disabled) return false
    el.click()
    return true
  }, t)
const isi = (sel, v) =>
  p.evaluate(
    (s, val) => {
      const el = document.querySelector(s)
      if (!el) return false
      const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      set.call(el, String(val))
      el.dispatchEvent(new Event('input', { bubbles: true }))
      return true
    },
    sel,
    v,
  )
const baca = (sel) => p.evaluate((s) => document.querySelector(s)?.value ?? null, sel)
const teks = (sel) =>
  p.evaluate((s) => document.querySelector(s)?.textContent.replace(/\s+/g, ' ').trim() ?? null, sel)

/** Keadaan panel analitik gerakan. */
const keadaanAnalitik = () =>
  p.evaluate(() => {
    const ukuran = document.querySelector('[data-testid="analitik-ukuran-langkah"]')
    const peringatan = document.querySelector('[data-testid="analitik-peringatan"]')
    const semua = [...document.querySelectorAll('p')].find((x) =>
      /gerakan berat|Semua gerakan masih nyaman/.test(x.textContent),
    )
    return {
      langkahTerbesar: ukuran ? ukuran.textContent.replace(/\s+/g, ' ').trim() : null,
      jmlPeringatan: peringatan ? peringatan.querySelectorAll('li').length : null,
      kesimpulan: semua ? semua.textContent.replace(/\s+/g, ' ').trim().slice(0, 90) : null,
    }
  })

/* =============================== Persiapan =============================== */
await p.goto(BASE + '/', { waitUntil: 'networkidle2' })
/* Layar sambutan muncul di setiap profil baru; tanpa ini rangkaian
   tidak bisa menyentuh apa pun. */
await lewatSambutan(p)
await wait(1600)
await p.evaluate(() => {
  const x = [...document.querySelectorAll('button')].find((y) =>
    y.textContent.includes('Muat data contoh'),
  )
  x && x.click()
})
await wait(3600)
await keHalaman('#/drill')

/* ============== 1. Analitik kini menampilkan ukuran langkah =============== */
R.awal = await keadaanAnalitik()
R.adaUkuran = await p.evaluate(
  () => !!document.querySelector('[data-testid="analitik-ukuran-langkah"]'),
)
cek('analitik menampilkan baris "Langkah terbesar"', R.adaUkuran === true)
cek(
  'baris ukuran langkah berisi angka inci',
  R.awal.langkahTerbesar !== null && /Langkah terbesar\s*[\d.]+\s*″/.test(R.awal.langkahTerbesar),
  String(R.awal.langkahTerbesar),
)
cek(
  'dengan ambang bawaan: nyaman atau padat (bukan mustahil)',
  R.awal.langkahTerbesar !== null && /Nyaman|Padat/.test(R.awal.langkahTerbesar),
  String(R.awal.langkahTerbesar),
)
R.peringatanAwal = R.awal.jmlPeringatan

/* ==================== 2. Pengaturan menampilkan ambang =================== */
await keHalaman('#/pengaturan')
R.kartuAda = await p.evaluate(() => !!document.querySelector('[data-testid="kartu-ambang-gerak"]'))
cek('kartu ambang gerak ada di Pengaturan', R.kartuAda === true)

R.nilaiBawaan = {
  perMenitPadat: await baca('[data-testid="ambang-perMenit-padat"]'),
  perMenitBerat: await baca('[data-testid="ambang-perMenit-berat"]'),
  perMenitMustahil: await baca('[data-testid="ambang-perMenit-mustahil"]'),
  inciPadat: await baca('[data-testid="ambang-inci-padat"]'),
  inciBerat: await baca('[data-testid="ambang-inci-berat"]'),
  inciMustahil: await baca('[data-testid="ambang-inci-mustahil"]'),
}
cek('bawaan kecepatan 120 / 150 / 180',
  R.nilaiBawaan.perMenitPadat === '120' &&
  R.nilaiBawaan.perMenitBerat === '150' &&
  R.nilaiBawaan.perMenitMustahil === '180',
  JSON.stringify(R.nilaiBawaan))
cek('bawaan ukuran langkah 22.5 / 30 / 45',
  Number(R.nilaiBawaan.inciPadat) === 22.5 &&
  Number(R.nilaiBawaan.inciBerat) === 30 &&
  Number(R.nilaiBawaan.inciMustahil) === 45,
  JSON.stringify(R.nilaiBawaan))

/* ============ 3. Perketat ambang ukuran langkah → analitik berubah ======= */
await isi('[data-testid="ambang-inci-padat"]', 8)
await isi('[data-testid="ambang-inci-berat"]', 12)
await isi('[data-testid="ambang-inci-mustahil"]', 16)
await wait(600)
R.simpan1 = await tombol('Simpan')
await wait(1200)

await keHalaman('#/drill')
R.ketat = await keadaanAnalitik()
cek(
  'ambang ketat → ukuran langkah jadi Mustahil',
  R.ketat.langkahTerbesar !== null && /Mustahil/.test(R.ketat.langkahTerbesar),
  String(R.ketat.langkahTerbesar),
)
cek(
  'ambang ketat → muncul peringatan di analitik',
  R.ketat.jmlPeringatan !== null && R.ketat.jmlPeringatan > 0,
  `${R.ketat.jmlPeringatan}`,
)
cek(
  'kesimpulan analitik ikut berubah',
  R.ketat.kesimpulan !== null && /berat/.test(R.ketat.kesimpulan),
  String(R.ketat.kesimpulan),
)

/* ============ 4. Longgarkan kembali → peringatan hilang ================== */
await keHalaman('#/pengaturan')
await isi('[data-testid="ambang-inci-padat"]', 80)
await isi('[data-testid="ambang-inci-berat"]', 100)
await isi('[data-testid="ambang-inci-mustahil"]', 130)
await wait(600)
R.simpan2 = await tombol('Simpan')
await wait(1200)

await keHalaman('#/drill')
R.longgar = await keadaanAnalitik()
cek(
  'ambang longgar → ukuran langkah kembali Nyaman',
  R.longgar.langkahTerbesar !== null && /Nyaman/.test(R.longgar.langkahTerbesar),
  String(R.longgar.langkahTerbesar),
)
cek(
  'ambang longgar → tidak ada peringatan ukuran langkah',
  R.longgar.jmlPeringatan !== null &&
    (R.peringatanAwal === null || R.longgar.jmlPeringatan <= R.peringatanAwal),
  `${R.peringatanAwal} → ${R.longgar.jmlPeringatan}`,
)

/* ============ 5. "Kembalikan ke bawaan" ================================= */
await keHalaman('#/pengaturan')
R.kembali = await p.evaluate(() => {
  const el = document.querySelector('[data-testid="ambang-kembali-bawaan"]')
  if (!el) return false
  el.click()
  return true
})
await wait(800)
R.setelahKembali = {
  inciPadat: await baca('[data-testid="ambang-inci-padat"]'),
  inciMustahil: await baca('[data-testid="ambang-inci-mustahil"]'),
}
await tombol('Simpan')
await wait(1200)
// Muat ulang untuk membuktikan tersimpan (bukan cuma di memori).
await p.reload({ waitUntil: 'networkidle2' })
await wait(3000)
await keHalaman('#/pengaturan')
R.setelahMuatUlang = {
  inciPadat: await baca('[data-testid="ambang-inci-padat"]'),
  perMenitPadat: await baca('[data-testid="ambang-perMenit-padat"]'),
}
cek('tombol "Kembalikan ke bawaan" ada', R.kembali === true)
cek('kembali ke bawaan mengisi 22.5 / 45',
  Number(R.setelahKembali.inciPadat) === 22.5 && Number(R.setelahKembali.inciMustahil) === 45,
  JSON.stringify(R.setelahKembali))
cek('tersimpan setelah dimuat ulang',
  Number(R.setelahMuatUlang.inciPadat) === 22.5 && R.setelahMuatUlang.perMenitPadat === '120',
  JSON.stringify(R.setelahMuatUlang))

/* ============ 6. Buku saku memakai ambang yang sama ===================== */
/**
 * Pratinjau cetak dirender di dalam **iframe** (`srcDoc`), jadi tidak bisa
 * dihitung dari `document.body` — itu akan menghitung UI aplikasi sendiri dan
 * selalu menghasilkan angka, betapapun isi kertasnya. Harus masuk ke framenya.
 */
async function merahDiBukuSaku() {
  const el = await p.$('iframe[title="Pratinjau cetak"]')
  if (!el) return null
  const frame = await el.contentFrame()
  if (!frame) return null
  return frame.evaluate(() => (document.body.innerHTML.match(/#ef4444/g) || []).length)
}

/** Buka dot sheet → Pratinjau, lalu hitung tanda merahnya. */
async function bukaPratinjau() {
  const buka = await p.evaluate(() => {
    const el = [...document.querySelectorAll('button')].find((b) =>
      (b.getAttribute('title') || '').includes('dot sheet'),
    )
    if (!el) return false
    el.click()
    return true
  })
  await wait(1800)
  const pratinjau = await p.evaluate(() => {
    const el = [...document.querySelectorAll('button')].find(
      (b) => b.textContent.trim() === 'Pratinjau',
    )
    if (!el) return false
    el.click()
    return true
  })
  await wait(2800)
  return { buka, pratinjau }
}

// Ambang ketat: kertasnya seharusnya penuh tanda merah.
await keHalaman('#/pengaturan')
await isi('[data-testid="ambang-inci-padat"]', 8)
await isi('[data-testid="ambang-inci-berat"]', 12)
await isi('[data-testid="ambang-inci-mustahil"]', 16)
await wait(500)
await tombol('Simpan')
await wait(1200)
await keHalaman('#/drill')
R.buka1 = await bukaPratinjau()
R.merahKetat = await merahDiBukuSaku()
await p.keyboard.press('Escape')
await wait(900)
await p.keyboard.press('Escape')
await wait(900)

// Ambang bawaan: tanda merahnya harus jauh berkurang.
await keHalaman('#/pengaturan')
R.kembali2 = await p.evaluate(() => {
  const el = document.querySelector('[data-testid="ambang-kembali-bawaan"]')
  if (!el) return false
  el.click()
  return true
})
await wait(600)
await tombol('Simpan')
await wait(1200)
await keHalaman('#/drill')
R.buka2 = await bukaPratinjau()
R.merahBawaan = await merahDiBukuSaku()

cek('pratinjau buku saku bisa dibuka (ketat)', R.buka1.buka === true && R.buka1.pratinjau === true)
cek('pratinjau buku saku bisa dibuka (bawaan)', R.buka2.buka === true && R.buka2.pratinjau === true)
cek('merah terbaca di dalam iframe pratinjau', R.merahKetat !== null && R.merahBawaan !== null,
  `${R.merahKetat} / ${R.merahBawaan}`)
cek('ambang ketat membuat buku saku menandai merah', R.merahKetat > 0, `${R.merahKetat}`)
cek('ambang bawaan jauh lebih sedikit merahnya — buku saku mengikuti ambang yang sama',
  R.merahKetat !== null && R.merahBawaan !== null && R.merahBawaan < R.merahKetat,
  `ketat ${R.merahKetat} vs bawaan ${R.merahBawaan}`)

/* ================================ Ringkasan ============================== */
R.error = errs
cek('tidak ada error di konsol', errs.length === 0, errs.join(' | ').slice(0, 200))

console.log(JSON.stringify(R, null, 2))
console.log(`\n${lulus} lulus, ${gagal} gagal`)
if (catat.length) console.log(catat.join('\n'))
await b.close()
process.exit(gagal ? 1 : 0)
