/**
 * Uji K1 — mode asisten di presenter.
 *
 * B3 (urutan latihan) sudah menjalankan set berurutan, tapi tidak pernah
 * mengatakan apa yang sedang terjadi. Asisten menambah lapisan pemberitahuan:
 * sebelum bergerak ia mengumumkan ke mana, berapa count, catatan perancang,
 * dan section yang gerakannya paling berat — lalu menghitung mundur.
 *
 * Yang diuji bukan hanya "kartunya muncul", melainkan urutannya benar:
 * SIAP (berdetak) → JALAN → … → SELESAI, dan bahwa mematikan asisten
 * mengembalikan perilaku lama tanpa kartu.
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
  if (syarat) lulus++
  else {
    gagal++
    catat.push(`GAGAL: ${nama}${keterangan ? ' — ' + keterangan : ''}`)
  }
}
const R = {}

const tombol = (t) =>
  p.evaluate((x) => {
    const el = [...document.querySelectorAll('button')].find((y) => y.textContent.trim() === x)
    if (!el || el.disabled) return false
    el.click()
    return true
  }, t)
const tombolJudul = (j) =>
  p.evaluate((x) => {
    const el = [...document.querySelectorAll('button')].find((y) =>
      (y.getAttribute('title') || '').includes(x),
    )
    if (!el || el.disabled) return false
    el.click()
    return true
  }, j)
/** Isi input yang mengikuti sebuah label. */
const isiLabel = (label, nilai) =>
  p.evaluate(
    (l, v) => {
      const lab = [...document.querySelectorAll('label')].find((x) => x.textContent.includes(l))
      const el = lab?.parentElement?.querySelector('input, textarea')
      if (!el) return false
      const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement : HTMLInputElement
      const set = Object.getOwnPropertyDescriptor(proto.prototype, 'value').set
      set.call(el, String(v))
      el.dispatchEvent(new Event('input', { bubbles: true }))
      return true
    },
    label,
    nilai,
  )

/** Isi sebuah input/textarea berdasar penyeleksi CSS. */
const isi = (sel, nilai) =>
  p.evaluate(
    (s, v) => {
      const el = document.querySelector(s)
      if (!el) return false
      const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement : HTMLInputElement
      const set = Object.getOwnPropertyDescriptor(proto.prototype, 'value').set
      set.call(el, String(v))
      el.dispatchEvent(new Event('input', { bubbles: true }))
      return true
    },
    sel,
    nilai,
  )

/** Keadaan kartu asisten saat ini, atau null kalau tidak tampil. */
const kartu = () =>
  p.evaluate(() => {
    const el = document.querySelector('[data-testid="kartu-asisten"]')
    if (!el) return null
    return {
      tahap: el.getAttribute('data-tahap'),
      hitung: el.querySelector('[data-testid="asisten-hitung"]')?.textContent?.trim() ?? null,
      catatan: el.querySelector('[data-testid="asisten-catatan"]')?.textContent?.trim() ?? null,
      seksi: el.querySelector('[data-testid="asisten-seksi"]')?.textContent?.trim() ?? null,
      sebab: el.querySelector('[data-testid="asisten-seksi"]')?.getAttribute('data-sebab') ?? null,
      teks: el.textContent.replace(/\s+/g, ' ').trim().slice(0, 140),
    }
  })

/**
 * Amati kartu selama `ms`. Mengembalikan tahap yang terlihat, urutan kemunculan,
 * dan nilai hitung mundur yang sempat terbaca.
 */
async function amati(ms, tiap = 90) {
  const urutan = []
  const tahapTerlihat = new Set()
  const hitungan = []
  const contoh = {}
  const setAkhir = new Set()
  const t0 = Date.now()
  let terakhir = null
  while (Date.now() - t0 < ms) {
    const k = await kartu()
    const kemajuan = await p.evaluate(
      () => document.querySelector('[data-testid="info-set"]')?.textContent?.trim() ?? null,
    )
    if (kemajuan) setAkhir.add(kemajuan)

    if (k) {
      if (k.tahap !== terakhir) urutan.push(k.tahap)
      terakhir = k.tahap
      tahapTerlihat.add(k.tahap)
      if (k.hitung != null) hitungan.push(k.hitung)
      contoh[k.tahap] = k
    } else if (terakhir !== null) {
      urutan.push('hilang')
      terakhir = null
    }
    await wait(tiap)
  }
  return { urutan, tahap: [...tahapTerlihat], hitungan, contoh, set: [...setAkhir] }
}

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
await p.evaluate(() => {
  location.hash = '#/drill'
})
await wait(2800)

// Data contoh hanya 2 set. Tambah satu lagi supaya ada dua perpindahan.
await p.keyboard.press('BracketRight')
await wait(1400)
R.tambahSet = await tombol('Set baru')
await wait(1800)

/**
 * "Set baru" **menyalin** set sebelumnya, jadi tanpa digeser perpindahan
 * 2→3 tidak menggerakkan siapa pun — analitik pun tidak punya yang dinilai
 * dan peringatan section tidak akan pernah muncul. Geser dulu supaya ada
 * perpindahan sungguhan.
 */
R.pilihJarak = await p.evaluate(() => {
  const lab = [...document.querySelectorAll('label')].find((x) => x.textContent.includes('Geser blok'))
  const sel = lab?.parentElement?.querySelector('select')
  if (!sel) return false
  const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set
  set.call(sel, '8')
  sel.dispatchEvent(new Event('change', { bubbles: true }))
  return true
})
await wait(700)
R.geser = await tombol('Ke depan')
await wait(1500)

/**
 * Catatan ditulis pada set **tujuan**, karena asisten membacakan catatan set
 * yang akan dibentuk — itulah yang perlu didengar pemain sesaat sebelum
 * bergerak. Jadi set 2 (tujuan 1→2) dan set 3 (tujuan 2→3) keduanya diberi
 * catatan, supaya kedua perpindahan punya "suara".
 */
const tulis = (teks) =>
  p.evaluate((t) => {
    const el = document.querySelector('[data-testid="catatan-set"]')
    if (!el) return false
    const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set
    set.call(el, t)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  }, teks)

// Kita berada di set 3 (baru dibuat). Tulis catatannya.
R.tulis3 = await tulis('Tutup formasi, blok rapat, mata ke penonton')
await wait(900)

// Mundur ke set 2: counts 4 (supaya urutan cepat selesai) + catatan.
await p.keyboard.press('BracketLeft')
await wait(1500)
R.isiCount2 = await isiLabel('Count ke set berikutnya', 4)
await wait(700)
R.tulis2 = await tulis('Bentuk busur, jaga jarak dua langkah')
await wait(1000)

// Mundur ke set 1: counts 4.
await p.keyboard.press('BracketLeft')
await wait(1500)
R.isiCount1 = await isiLabel('Count ke set berikutnya', 4)
await wait(900)
cek('isian catatan set ada di editor', R.tulis2 === true && R.tulis3 === true)
cek('count bisa diisi', R.isiCount1 === true && R.isiCount2 === true)

/* ===================== 1. Buka presenter & nyalakan asisten =============== */
R.bukaPresenter = await tombolJudul('Mode presenter')
await wait(2400)
R.adaChip = await p.evaluate(() => !!document.querySelector('[data-testid="chip-asisten"]'))
cek('presenter terbuka', R.adaChip === true)
R.nyalakan = await p.evaluate(() => {
  const el = document.querySelector('[data-testid="chip-asisten"]')
  if (!el) return false
  el.click()
  return true
})
await wait(700)
cek('chip asisten bisa dinyalakan', R.nyalakan === true)

/** Hentikan urutan kalau sedang berjalan, lalu mulai dari awal. */
async function mulaiBersih() {
  for (let i = 0; i < 4; i++) {
    const jalan = await p.evaluate(() =>
      (document.querySelector('[data-testid="tombol-urutan"]')?.textContent ?? '').includes('berjalan'),
    )
    if (!jalan) break
    await p.evaluate(() => document.querySelector('[data-testid="tombol-urutan"]')?.click())
    await wait(800)
  }
  await p.evaluate(() => document.querySelector('[data-testid="tombol-urutan"]')?.click())
}

/* ==================== 2. Jalankan urutan dengan asisten ================== */
await mulaiBersih()
R.pengamatan = await amati(14000)

R.tahapTerlihat = R.pengamatan.tahap
R.contoh = R.pengamatan.contoh
R.setTerlihat = R.pengamatan.set

cek('kartu asisten muncul saat urutan berjalan', R.tahapTerlihat.length > 0, JSON.stringify(R.tahapTerlihat))
cek('tahap SIAP terlihat', R.tahapTerlihat.includes('siap'), JSON.stringify(R.tahapTerlihat))
cek('tahap JALAN terlihat', R.tahapTerlihat.includes('jalan'), JSON.stringify(R.tahapTerlihat))
cek('urutan tahap: siap mendahului jalan',
  R.pengamatan.urutan.indexOf('siap') >= 0 &&
    R.pengamatan.urutan.indexOf('siap') < R.pengamatan.urutan.indexOf('jalan'),
  JSON.stringify(R.pengamatan.urutan))

// Hitung mundur harus benar-benar berdetak, bukan diam di satu angka.
R.angkaHitung = [...new Set(R.pengamatan.hitungan)]
cek('hitung mundur berdetak (lebih dari satu angka)', R.angkaHitung.length >= 2, JSON.stringify(R.pengamatan.hitungan))
cek('hitung mundur berisi angka 2 (diam = 2 count)', R.angkaHitung.includes('2'), JSON.stringify(R.angkaHitung))

// Kartu menyebut tujuan & count.
const contohSiap = R.contoh.siap
cek('kartu menyebut set asal → tujuan', contohSiap && /→/.test(contohSiap.teks), contohSiap && contohSiap.teks)
cek('kartu menyebut jumlah count & tempo',
  contohSiap && /\d+ count · \d+ BPM/.test(contohSiap.teks), contohSiap && contohSiap.teks)

// Catatan perancang dibacakan — inilah "suara" asistennya.
R.catatanTerbaca = R.contoh.siap?.catatan ?? null
cek('catatan set tujuan dibacakan asisten',
  R.catatanTerbaca !== null && /busur|blok rapat/.test(R.catatanTerbaca), String(R.catatanTerbaca))

/* ==================== 3. Matikan asisten → kartu hilang ================== */
await p.evaluate(() => document.querySelector('[data-testid="chip-asisten"]')?.click())
await wait(700)
await mulaiBersih()
R.setelahDimatikan = await amati(4000)
cek('mematikan asisten menghilangkan kartu',
  R.setelahDimatikan.tahap.length === 0, JSON.stringify(R.setelahDimatikan.tahap))
// Tapi urutannya sendiri tetap berjalan — B3 tidak boleh ikut mati.
R.setMaju = R.setelahDimatikan.set
cek('urutan tetap berjalan walau asisten dimatikan', R.setMaju.length >= 1, JSON.stringify(R.setMaju))

/* ============================== 4. Sampai selesai ======================== */
await p.evaluate(() => document.querySelector('[data-testid="chip-asisten"]')?.click())
await wait(700)
await mulaiBersih()
R.akhir = await amati(16000)
R.tahapAkhir = R.akhir.tahap
cek('tahap SELESAI tampil di akhir urutan', R.tahapAkhir.includes('selesai'), JSON.stringify(R.tahapAkhir))
R.teksSelesai = R.akhir.contoh.selesai?.teks ?? null
cek('kartu selesai menyebut jumlah set',
  R.teksSelesai !== null && /SELESAI/.test(R.teksSelesai), String(R.teksSelesai))

/* ===== 5a. Sebab harus jujur: jangan salahkan ukuran langkah kalau yang
   berat kecepatannya. Dengan ambang BAWAAN, langkah 22,5 inci itu nyaman —
   jadi kalau ada peringatan, sebabnya pasti kecepatan, bukan langkah. */
R.sebabBawaan = [...new Set(Object.values(R.pengamatan.contoh).map((k) => k.sebab).filter(Boolean))]
R.teksBawaan = Object.values(R.pengamatan.contoh).map((k) => k.seksi).filter(Boolean)
if (R.teksBawaan.length > 0) {
  cek('dengan ambang bawaan, peringatan tidak menyalahkan ukuran langkah 22,5\u2033',
    !R.teksBawaan.some((t) => /langkah 22\.5\u2033 \(mustahil\)/.test(t)),
    JSON.stringify(R.teksBawaan))
}

/* ======= 5. Peringatan section mengikuti ambang yang sama dengan analitik ===
   Kalau ambang ukuran langkah diperketat di Pengaturan, asisten harus ikut
   memperingatkan — bukti bahwa ia memakai modul & ambang yang sama dengan
   panel analitik, bukan perhitungan sendiri. */
await p.keyboard.press('Escape')
await wait(1800)
await p.evaluate(() => {
  location.hash = '#/pengaturan'
})
await wait(2600)
await isi('[data-testid="ambang-inci-padat"]', 8)
await isi('[data-testid="ambang-inci-berat"]', 12)
await isi('[data-testid="ambang-inci-mustahil"]', 16)
await wait(600)
await tombol('Simpan')
await wait(1300)
await p.evaluate(() => {
  location.hash = '#/drill'
})
await wait(2800)

R.bukaPresenter2 = await tombolJudul('Mode presenter')
await wait(2400)
await p.evaluate(() => document.querySelector('[data-testid="chip-asisten"]')?.click())
await wait(700)
await mulaiBersih()
R.denganAmbangKetat = await amati(9000)
R.seksiTerlihat = []
for (const k of Object.values(R.denganAmbangKetat.contoh)) if (k.seksi) R.seksiTerlihat.push(k.seksi)
cek('kartu asisten muncul lagi dengan ambang ketat',
  R.denganAmbangKetat.tahap.length > 0, JSON.stringify(R.denganAmbangKetat.tahap))
cek('asisten memperingatkan section yang langkahnya berat',
  R.seksiTerlihat.length > 0, JSON.stringify(R.seksiTerlihat))
cek('peringatan menyebut nama section & ukuran langkah',
  R.seksiTerlihat.some((t) => /Perhatian .+ langkah [\d.]+\u2033/.test(t)),
  JSON.stringify(R.seksiTerlihat))
// Sebabnya harus "langkah": ambang UKURAN langkah yang diperketat, jadi
// ukuran langkah memang yang bermasalah.
R.sebabTerlihat = [...new Set(Object.values(R.denganAmbangKetat.contoh).map((k) => k.sebab))]
cek('sebab yang disebut = ukuran langkah (bukan kecepatan)',
  R.sebabTerlihat.includes('langkah'), JSON.stringify(R.sebabTerlihat))

/* ================================ Ringkasan ============================== */
R.error = errs
cek('tidak ada error di konsol', errs.length === 0, errs.join(' | ').slice(0, 200))

console.log(JSON.stringify(R, null, 2))
console.log(`\n${lulus} lulus, ${gagal} gagal`)
if (catat.length) console.log(catat.join('\n'))
await b.close()
process.exit(gagal ? 1 : 0)
