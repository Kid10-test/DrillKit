/**
 * Uji 31e — dasar jarak di antarmuka.
 *
 * Yang diuji bukan rumusnya (itu sudah diuji di node, `jarak-logika`),
 * melainkan bahwa **kedua permukaan mengikuti pilihan yang sama**: panel
 * analitik di editor *dan* lembar buku saku yang dicetak untuk pemain.
 * Kalau cuma satu yang mengikuti, pelatih melihat dua angka berbeda untuk
 * perpindahan yang sama — dan itu lebih buruk daripada tidak ada pilihan.
 */
import puppeteer from 'puppeteer'
import { lewatSambutan } from './sambutan.mjs'

const BASE = process.env.BASE || 'http://localhost:5173'
const browser = await puppeteer.launch({
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  defaultViewport: { width: 1440, height: 1000 },
})
const p = await browser.newPage()
const error = []
p.on('console', (m) => { if (m.type() === 'error') error.push(m.text()) })
p.on('pageerror', (e) => error.push(String(e)))

const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const tombol = (teks) =>
  p.evaluate((t) => {
    const x = [...document.querySelectorAll('button')].find((y) => y.textContent.includes(t))
    if (!x || x.disabled) return false
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
const ada = async (sel) => (await p.$(sel)) !== null
const angka = async (sel) => Number((await teks(sel)).replace(/[^\d.-]/g, ''))

let lulus = 0
const gagal = []
const cek = (nama, syarat, keterangan = '') => {
  if (syarat) lulus += 1
  else gagal.push(`${nama}${keterangan ? ' — ' + keterangan : ''}`)
}

await p.goto(BASE, { waitUntil: 'networkidle2' })
await lewatSambutan(p)
await wait(1500)
await tombol('Muat data contoh')
await wait(4000)
await p.evaluate(() => { location.hash = '#/drill' })
await wait(2600)

/* ------------- Jadikan jalurnya MELENGKUNG, supaya kedua dasar beda ------- */
// Disetel langsung ke IndexedDB; UI lengkungannya sendiri sudah diuji
// dd5b. Yang diuji di sini adalah dampak pilihan dasar jaraknya.
await p.evaluate(() => new Promise((res) => {
  const r = indexedDB.open('drillkit')
  r.onsuccess = () => {
    const tx = r.result.transaction('sets', 'readwrite')
    const os = tx.objectStore('sets')
    const q = os.getAll()
    q.onsuccess = () => {
      for (const s of q.result) os.put({ ...s, gerak: { jalur: 'lengkung', lengkung: 1 } })
    }
    tx.oncomplete = res
  }
  r.onerror = res
}))
await p.reload({ waitUntil: 'networkidle2' })
await wait(3000)
await p.evaluate(() => { location.hash = '#/drill' })
await wait(2500)

cek('ubin langkah terjauh terbaca', await ada('[data-testid="analitik-langkah-terjauh"]'))
const awal = await angka('[data-testid="analitik-langkah-terjauh"]')
cek('ada angka langkah terjauh', awal > 0, String(awal))

/* --------------------- Buka pengaturan drill ----------------------------- */
await tombolJudul('Pengaturan drill')
await wait(1200)
cek('pengaturan drill terbuka', await ada('[data-testid="setelan-jarak"]'))
cek('kontrol "Jarak tempuh" ada', await ada('[data-testid="jarak-jalur"]'))
cek('kontrol "Garis lurus" ada', await ada('[data-testid="jarak-lurus"]'))

/* ------------------- Pilih GARIS LURUS, lalu simpan ---------------------- */
await klik('[data-testid="jarak-lurus"]')
await wait(600)
await tombol('Simpan')
await wait(2000)

const lurus = await angka('[data-testid="analitik-langkah-terjauh"]')
cek('garis lurus MENGURANGI jumlah langkah pada jalur melengkung',
  lurus < awal, `${awal} → ${lurus}`)
// Bedanya harus nyata: kelengkungan 1 menambah ~14,8%.
cek('selisihnya nyata (lebih dari 5%)', (awal - lurus) / awal > 0.05,
  `${(((awal - lurus) / awal) * 100).toFixed(1)}%`)

/* ------------- Kembali ke JARAK TEMPUH: angka harus pulih ---------------- */
await tombolJudul('Pengaturan drill')
await wait(1200)
await klik('[data-testid="jarak-jalur"]')
await wait(600)
await tombol('Simpan')
await wait(2000)
const kembali = await angka('[data-testid="analitik-langkah-terjauh"]')
cek('kembali ke jarak tempuh memulihkan angka semula',
  kembali === awal, `${awal} → ${lurus} → ${kembali}`)

/* -------------------- Pilihan tersimpan lintas muat ----------------------- */
await tombolJudul('Pengaturan drill')
await wait(1200)
await klik('[data-testid="jarak-lurus"]')
await wait(600)
await tombol('Simpan')
await wait(1800)
await p.reload({ waitUntil: 'networkidle2' })
await wait(3200)
await p.evaluate(() => { location.hash = '#/drill' })
await wait(2600)
const setelahMuat = await angka('[data-testid="analitik-langkah-terjauh"]')
cek('pilihan tersimpan setelah halaman dimuat ulang',
  setelahMuat === lurus, `${lurus} vs ${setelahMuat}`)

/* ----------- PERMUKAAN KEDUA: lembar buku saku ikut memakainya ----------- */
// Lembar ini dihitung oleh fungsi yang BERBEDA dari panel analitik
// (`jumlahLangkah` di Drill.tsx, bukan `analisisPerpindahan`). Kalau cuma
// salah satu yang mengikuti pilihan, pelatih melihat dua angka berbeda
// untuk perpindahan yang sama.
async function bukaLembar() {
  await tombolJudul('Kartu/dot sheet per pemain')
  await wait(1800)
  await tombol('Pratinjau')
  await wait(2200)
  let doc = false
  for (let i = 0; i < 20 && !doc; i += 1) {
    doc = await p.evaluate(() => {
      const el = document.querySelector('iframe[title="Pratinjau cetak"]')
      return Boolean(el?.contentDocument?.body?.innerText?.length)
    })
    if (!doc) await wait(500)
  }
  return p.evaluate(() => {
    const el = document.querySelector('iframe[title="Pratinjau cetak"]')
    const d = el?.contentDocument
    if (!d) return { langkah: [], teks: '' }
    // Kolom ke-5 (0-based: 4) adalah "Langkah & arah", mis. "30 ←".
    const langkah = [...d.querySelectorAll('tbody tr')]
      .map((tr) => (tr.children[4]?.textContent ?? '').trim())
      .filter((x) => x && x !== '-')
      .map((x) => Number(x.replace(/[^\d.]/g, '')))
      .filter((n) => Number.isFinite(n) && n > 0)
    return { langkah, teks: d.body.innerText ?? '' }
  })
}

// Keadaan sekarang: dasar = garis lurus (disetel sebelum memuat ulang).
const lembarLurus = await bukaLembar()
cek('lembar buku saku terisi', lembarLurus.teks.length > 0, `panjang ${lembarLurus.teks.length}`)
cek('lembar memuat kolom langkah', lembarLurus.langkah.length > 0,
  JSON.stringify(lembarLurus.langkah.slice(0, 4)))
// Hurufnya kapital karena CSS, jadi pencocokan dibuat tak-peka-huruf.
const hurufKecil = lembarLurus.teks.toLowerCase()
cek('lembar menyebut dasar jarak yang dipakai (garis lurus)',
  hurufKecil.includes('garis lurus'), lembarLurus.teks.slice(0, 200))

// Tutup pratinjau & modal, lalu balik ke jarak tempuh dan buka lagi.
await tombol('Tutup')
await wait(900)
await tombol('Batal')
await wait(900)
await tombolJudul('Pengaturan drill')
await wait(1200)
await klik('[data-testid="jarak-jalur"]')
await wait(600)
await tombol('Simpan')
await wait(2000)
const langkahPanelJalur = await angka('[data-testid="analitik-langkah-terjauh"]')
cek('panel kembali ke angka jarak tempuh', langkahPanelJalur === awal,
  `${awal} vs ${langkahPanelJalur}`)

const lembarJalur = await bukaLembar()
cek('lembar jarak tempuh juga punya kolom langkah', lembarJalur.langkah.length > 0,
  JSON.stringify(lembarJalur.langkah.slice(0, 4)))
// Inti permukaan kedua: angka di lembar ikut berubah mengikuti pilihan.
const maksLurus = Math.max(...lembarLurus.langkah)
const maksJalur = Math.max(...lembarJalur.langkah)
cek('LEMBAR BUKU SAKU IKUT MENGIKUTI PILIHAN DASAR JARAK',
  maksJalur > maksLurus, `${maksLurus} → ${maksJalur}`)
cek('lembar jarak tempuh TIDAK menyebut garis lurus',
  !lembarJalur.teks.toLowerCase().includes('garis lurus'),
  lembarJalur.teks.slice(0, 200))

/* --------------------------- Kebersihan ---------------------------------- */
cek('tidak ada error konsol', error.length === 0, error.slice(0, 3).join(' | '))

console.log('\n' + JSON.stringify({
  langkahJarakTempuh: awal,
  langkahGarisLurus: lurus,
  selisihPersen: (((awal - lurus) / awal) * 100).toFixed(1),
  setelahMuatUlang: setelahMuat,
  maksLangkahLembar: { garisLurus: maksLurus, jarakTempuh: maksJalur },
  contohBarisLembar: lembarJalur.langkah.slice(0, 4),
  error: error.slice(0, 3),
}, null, 2))
console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) console.log('GAGAL:\n - ' + gagal.join('\n - '))
await browser.close()
if (gagal.length) process.exit(1)
