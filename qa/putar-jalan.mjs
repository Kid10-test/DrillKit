/**
 * Uji antarmuka — rotasi lingkaran yang pusatnya ikut berjalan.
 *
 * Skenario: set 1 dan set 2 sama-sama blok. Set 2 lalu diputar 90° (yang
 * memasang jalur busur pada set 1) **dan digeser**. Maka set 1 → set 2 adalah
 * "putar 90° sambil pusatnya berjalan" — persis yang diminta.
 *
 * Urutan ini sengaja dipakai karena memperlihatkan masalahnya: begitu blok
 * digeser, pemain tidak lagi cocok dengan putaran murni, jadi busur kehilangan
 * semua pemainnya. Tombol "Hitung" harus memulihkan keadaan.
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
await p.setViewport({ width: 1440, height: 1000 })
const errs = []
p.on('pageerror', (e) => errs.push(e.message.slice(0, 160)))
p.on('console', (m) => {
  if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160))
})

let lulus = 0
let gagal = 0
const catat = []
function cek(nama, syarat, keterangan = '') {
  if (syarat) {
    lulus++
  } else {
    gagal++
    catat.push(`GAGAL: ${nama}${keterangan ? ' — ' + keterangan : ''}`)
  }
}

// PENTING: bilah waktu memakai mode per hitungan, jadi rentangnya 0..counts
// (bukan 0..1, dan step = 1). Kalau dikirim 0,5 ia dibulatkan jadi hitungan,
// sehingga progres yang tercapai cuma 1/(2·counts) — uji bentuk lalu lolos
// tanpa menguji apa pun karena titiknya nyaris tidak bergerak.
const scrub = async (t) => {
  const maks = await p.evaluate(() => {
    const s = document.querySelector('[data-testid="garis-waktu"]')
    return s ? Number(s.max) : 0
  })
  const v = Math.round(t * maks)
  await p.evaluate((n) => {
    const s = document.querySelector('[data-testid="garis-waktu"]')
    if (!s) throw new Error('Bilah waktu tidak ada')
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    set.call(s, String(n))
    s.dispatchEvent(new Event('input', { bubbles: true }))
  }, v)
}

const tombol = (t) =>
  p.evaluate((x) => {
    const el = [...document.querySelectorAll('button')].find((y) => y.textContent.trim() === x)
    if (!el || el.disabled) return false
    el.click()
    return true
  }, t)

const setSelect = (lab, val) =>
  p.evaluate(
    (l, v) => {
      const f = [...document.querySelectorAll('label')].find((x) => x.textContent.includes(l))
      const sel = f && f.parentElement.querySelector('select')
      if (!sel) return false
      const set = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set
      set.call(sel, String(v))
      sel.dispatchEvent(new Event('change', { bubbles: true }))
      return true
    },
    lab,
    val,
  )

const posisi = () =>
  p.evaluate(() =>
    [...document.querySelectorAll('g.cursor-move')]
      .map((g) => {
        const c = g.querySelector('circle[data-titik="1"]')
        if (!c) return null
        const m = /translate\(([-\d.e]+) ([-\d.e]+)\)/.exec(g.getAttribute('transform') || '')
        return [Number(c.getAttribute('cx')) + (m ? +m[1] : 0), Number(c.getAttribute('cy')) + (m ? +m[2] : 0)]
      })
      .filter(Boolean),
  )

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
const cekTercentang = (sel) => p.evaluate((s) => document.querySelector(s)?.checked ?? null, sel)

const teksKeterangan = () =>
  p.evaluate(() => {
    const el = document.querySelector('[data-testid="putar-jalan-keterangan"]')
    return el ? el.textContent.replace(/\s+/g, ' ').trim() : null
  })

/** "N dari M pemain mengikuti busur" → { ikut, total }. */
const ikutBusur = async () => {
  const t = await teksKeterangan()
  if (!t) return null
  const m = /(\d+) dari (\d+) pemain mengikuti/.exec(t)
  return m ? { ikut: +m[1], total: +m[2] } : null
}

/**
 * Seberapa utuh bentuk formasinya: perbandingan jarak antar pasangan pemain
 * terhadap keadaan awal. 1 = bentuknya tidak berubah sedikit pun.
 */
function bentuk(awal, kini) {
  if (kini.length !== awal.length) return null
  const r = []
  for (let i = 0; i < awal.length; i++)
    for (let j = i + 1; j < awal.length; j++)
      r.push(Math.hypot(kini[i][0] - kini[j][0], kini[i][1] - kini[j][1]) / Math.hypot(awal[i][0] - awal[j][0], awal[i][1] - awal[j][1]))
  const min = Math.min(...r)
  const maks = Math.max(...r)
  return { min: Math.round(min * 1000) / 1000, maks: Math.round(maks * 1000) / 1000 }
}

async function ukurBentuk(label) {
  await scrub(0)
  await wait(420)
  const A = await posisi()
  const out = {}
  for (const t of [0.25, 0.5, 0.75, 1]) {
    await scrub(t)
    await wait(380)
    out['t' + t] = bentuk(A, await posisi())
  }
  R[label] = out
  return out
}

const R = {}

/* ================================ Persiapan ================================ */
await p.goto(BASE + '/', { waitUntil: 'networkidle2' })
/* Layar sambutan muncul di setiap profil baru; tanpa ini rangkaian
   tidak bisa menyentuh apa pun. */
await lewatSambutan(p)
await wait(1600)
await p.evaluate(() => {
  const x = [...document.querySelectorAll('button')].find((y) => y.textContent.includes('Muat data contoh'))
  x && x.click()
})
await wait(3400)
await p.evaluate(() => {
  location.hash = '#/drill'
})
await wait(2800)

// set 1 = blok
R.blok1 = await tombol('Blok')
await wait(1300)
// set 2 = blok yang sama
await p.keyboard.press('BracketRight')
await wait(1500)
R.blok2 = await tombol('Blok')
await wait(1300)
// putar set 2 → sekaligus memasang jalur busur pada set 1 (putaran murni 90°)
R.putar = await tombol('Kanan ↻')
await wait(1700)
// geser set 2 → sekarang perpindahannya "putar sambil jalan"
R.pilihJarak = await setSelect('Geser blok', 8)
await wait(700)
R.geser = await tombol('Ke Side 1')
await wait(1600)

// kembali ke set 1, tempat pengaturan gerakannya berada
await p.keyboard.press('BracketLeft')
await wait(1600)

/* ===================== 1. Keadaan sebelum dihitung ========================= */
R.jumlahTitik = (await posisi()).length
R.sebelum = await ikutBusur()
R.jejakSebelum = await p.evaluate(() => {
  const el = document.querySelector('[data-trail="keluar"]')
  return el ? { tag: el.tagName.toLowerCase(), segmen: ((el.getAttribute('d') || '').match(/L/g) || []).length } : null
})

cek('blok punya beberapa pemain', R.jumlahTitik >= 4, `${R.jumlahTitik} titik`)
cek('keterangan busur terbaca', R.sebelum !== null, String(R.sebelum))
// Setelah digeser, putaran murni tidak lagi cocok → pemain ikut busur menyusut.
cek(
  'sebelum dihitung: pemain tidak lagi cocok dengan putaran murni',
  R.sebelum !== null && R.sebelum.ikut < R.sebelum.total,
  JSON.stringify(R.sebelum),
)

/* ===================== 2. Tombol Hitung ================================== */
R.tombolHitungSebelumCentang = await p.evaluate(
  () => !!document.querySelector('[data-testid="putar-jalan-hitung"]'),
)
// Centang dulu supaya isiannya muncul.
R.centang = await p.evaluate(() => {
  const el = document.querySelector('[data-testid="putar-jalan-aktif"]')
  if (!el) return false
  el.click()
  return true
})
await wait(800)
R.tombolHitungAda = await p.evaluate(
  () => !!document.querySelector('[data-testid="putar-jalan-hitung"]'),
)
R.pusatX = await baca('input[aria-label="Pusat putaran, sumbu x (langkah)"]')
R.pusatY = await baca('input[aria-label="Pusat putaran, sumbu y (langkah)"]')
R.x2Sebelum = await baca('[data-testid="putar-jalan-x2"]')
R.y2Sebelum = await baca('[data-testid="putar-jalan-y2"]')

R.klikHitung = await p.evaluate(() => {
  const el = document.querySelector('[data-testid="putar-jalan-hitung"]')
  if (!el) return false
  el.click()
  return true
})
await wait(1400)
R.x2Sesudah = await baca('[data-testid="putar-jalan-x2"]')
R.y2Sesudah = await baca('[data-testid="putar-jalan-y2"]')
R.sesudah = await ikutBusur()

cek('kotak centang ada & bisa diklik', R.centang === true)
cek('tombol Hitung belum ada sebelum dicentang', R.tombolHitungSebelumCentang === false)
cek('tombol Hitung muncul setelah dicentang', R.tombolHitungAda === true)
cek('pusat awal terbaca', R.pusatX !== null && R.pusatY !== null, `${R.pusatX},${R.pusatY}`)
cek('isian tujuan muncul', R.x2Sebelum !== null && R.y2Sebelum !== null, `${R.x2Sebelum},${R.y2Sebelum}`)
cek('tombol Hitung bisa diklik', R.klikHitung === true)
// Blok digeser 8 langkah ke Side 1 → tujuan harus bergeser 8 langkah dari pusat.
R.selisihX = R.x2Sesudah !== null ? Math.round((Number(R.x2Sesudah) - Number(R.pusatX)) * 100) / 100 : null
R.selisihY = R.y2Sesudah !== null ? Math.round((Number(R.y2Sesudah) - Number(R.pusatY)) * 100) / 100 : null
cek(
  'tujuan bergeser 8 langkah di sumbu x',
  R.selisihX !== null && Math.abs(R.selisihX - 8) < 0.01,
  `selisih ${R.selisihX}`,
)
cek('tujuan tidak bergeser di sumbu y', R.selisihY !== null && Math.abs(R.selisihY) < 0.01, `selisih ${R.selisihY}`)
cek(
  'sesudah dihitung: semua pemain kembali mengikuti busur',
  R.sesudah !== null && R.sesudah.ikut === R.sesudah.total && R.sesudah.total > 0,
  JSON.stringify(R.sesudah),
)
cek(
  'jumlah pemain mengikuti busur bertambah',
  R.sebelum !== null && R.sesudah !== null && R.sesudah.ikut > R.sebelum.ikut,
  `${R.sebelum?.ikut} → ${R.sesudah?.ikut}`,
)

/* ============ 3. Bentuk formasi terjaga sambil lingkaran berjalan ========== */
const busur = await ukurBentuk('bentukBusur')
for (const t of ['t0.25', 't0.5', 't0.75', 't1']) {
  const v = busur[t]
  cek(
    `busur: bentuk utuh di ${t}`,
    v !== null && Math.abs(v.min - 1) < 0.02 && Math.abs(v.maks - 1) < 0.02,
    JSON.stringify(v),
  )
}

/* ======== 4. Pembanding: jalur lurus mengkerutkan formasi ================= */
R.setLurus = await setSelect('Bentuk jalur', 'lurus')
await wait(1200)
const lurus = await ukurBentuk('bentukLurus')
// Kalau pembanding ini juga "utuh", berarti uji bentuknya tidak menguji apa-apa.
cek(
  'pembanding: jalur lurus memang mengkerutkan formasi',
  Math.abs(lurus['t0.5'].min - 1) > 0.05,
  JSON.stringify(lurus['t0.5']),
)

/* ======== 5. Kembali ke busur, lalu matikan perjalanan lingkarannya ======== */
R.setBusur = await setSelect('Bentuk jalur', 'busur')
await wait(1200)
const busurLagi = await ukurBentuk('bentukBusurLagi')
cek(
  'kembali ke busur: bentuk utuh lagi',
  busurLagi['t0.5'] !== null && Math.abs(busurLagi['t0.5'].min - 1) < 0.02,
  JSON.stringify(busurLagi['t0.5']),
)

// Matikan "lingkaran ikut berjalan" → pemain kembali tidak cocok.
await p.evaluate(() => document.querySelector('[data-testid="putar-jalan-aktif"]')?.click())
await wait(1200)
R.dimatifkan = await ikutBusur()
R.x2SetelahDimatikan = await baca('[data-testid="putar-jalan-x2"]')
cek(
  'mematikan perjalanan mengembalikan ke putaran di tempat',
  R.dimatifkan !== null && R.dimatifkan.ikut < R.dimatifkan.total,
  JSON.stringify(R.dimatifkan),
)
cek('isian tujuan hilang setelah dimatikan', R.x2SetelahDimatikan === null, String(R.x2SetelahDimatikan))

// Nyalakan lagi & isi manual — angkanya harus menetap.
await p.evaluate(() => document.querySelector('[data-testid="putar-jalan-aktif"]')?.click())
await wait(900)
await isi('[data-testid="putar-jalan-x2"]', 3)
await wait(900)
R.x2Manual = await baca('[data-testid="putar-jalan-x2"]')
cek('isian tujuan bisa diubah manual', R.x2Manual === '3', String(R.x2Manual))

/* ================================ 6. Keterangan =========================== */
R.keterangan = await teksKeterangan()
cek(
  'keterangan menyebut perjalanan lingkaran',
  R.keterangan !== null && /Lingkaran berputar sambil pusatnya bergeser/.test(R.keterangan),
  String(R.keterangan).slice(0, 120),
)

/* ====== 7. Penjaga: scrub harus benar-benar menggerakkan titik ============ */
await scrub(0); await wait(420)
const A0 = await posisi()
await scrub(1); await wait(450)
const A1 = await posisi()
const geserPusat = Math.hypot(
  A1.reduce((a, q) => a + q[0], 0) / A1.length - A0.reduce((a, q) => a + q[0], 0) / A0.length,
  A1.reduce((a, q) => a + q[1], 0) / A1.length - A0.reduce((a, q) => a + q[1], 0) / A0.length,
)
R.geserPusat = Math.round(geserPusat * 100) / 100
// 8 langkah × 0,625 yard/langkah = 5 yard. Kalau ini nyaris nol, berarti
// scrub tidak bekerja dan semua uji "bentuk utuh" di atas lolos dengan sia-sia.
cek('scrub benar-benar menggeser blok (±5 yard untuk 8 langkah)',
  Math.abs(R.geserPusat - 5) < 0.35, `${R.geserPusat}`)

/* ================================ Ringkasan =============================== */
R.error = errs
cek('tidak ada error di konsol', errs.length === 0, errs.join(' | ').slice(0, 200))

console.log(JSON.stringify(R, null, 2))
console.log(`\n${lulus} lulus, ${gagal} gagal`)
if (catat.length) console.log(catat.join('\n'))
await b.close()
process.exit(gagal ? 1 : 0)
