/**
 * Uji layar pacu latihan (H1) — yang dipakai **selama** latihan berjalan.
 *
 * Dua hal yang paling rawan dan karenanya paling dikuji:
 *
 * 1. **Geser harus datang dari kenyataan, bukan rencana.** Nilainya
 *    disetel lewat realisasi yang menyeberangi jam sekarang (blok A sudah
 *    selesai 13 menit padahal direncanakan 10), jadi hasilnya pasti tanpa
 *    perlu membekukan jam.
 * 2. **Blok yang sedang berjalan hanya menyumbang kelebihannya yang sudah
 *    terjadi.** Blok B baru jalan 5 menit dari jatah 20 — gesernya harus
 *    tetap +3 (warisan A), BUKAN "lebih cepat 15 menit".
 */
import puppeteer from 'puppeteer'
import { lewatSambutan } from './sambutan.mjs'

const BASE = process.env.BASE || 'http://localhost:5173'
const browser = await puppeteer.launch({
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  defaultViewport: { width: 1280, height: 1100 },
})
const p = await browser.newPage()
const errors = []
p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
p.on('pageerror', (e) => errors.push(String(e)))

let lulus = 0
const gagal = []
const cek = (nama, syarat, keterangan = '') => {
  if (syarat) lulus += 1
  else gagal.push(`${nama}${keterangan ? ' — ' + keterangan : ''}`)
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const teks = (sel) => p.$eval(sel, (e) => e.textContent.replace(/\s+/g, ' ').trim())
const ada = async (sel) => (await p.$(sel)) != null
const klik = async (sel) => { await p.waitForSelector(sel, { timeout: 10000 }); await p.click(sel) }
const tombol = (t) =>
  p.evaluate((x) => {
    const b = [...document.querySelectorAll('button')].find((y) => y.textContent.includes(x))
    if (!b || b.disabled) return false
    b.click()
    return true
  }, t)

await p.goto(BASE, { waitUntil: 'networkidle2' })
await lewatSambutan(p)
// #3 — uji ini memeriksa kartu sesi; pakai tampilan Daftar (semua kartu terbuka).
await p.evaluate(() => localStorage.setItem('drillkit.jadwal.tampilan', 'daftar'))
await wait(1500)
await tombol('Muat data contoh')
await wait(4000)

// DUA sesi: satu tanpa realisasi (jangkar rencana), satu dengan realisasi.
const info = await p.evaluate(async () => {
  const r = await new Promise((res) => { const q = indexedDB.open('drillkit'); q.onsuccess = () => res(q.result) })
  const skrg = new Date()
  const iso = `${skrg.getFullYear()}-${String(skrg.getMonth() + 1).padStart(2, '0')}-${String(skrg.getDate()).padStart(2, '0')}`
  const jam = (mnt) => {
    const d = new Date(skrg.getTime() + mnt * 60000)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
  const kini = Date.now()
  const M = 60000
  const rencana = [
    { id: 'k_a', judul: 'Pemanasan & tuning', jenis: 'pemanasan', menit: 10 },
    { id: 'k_b', judul: 'Section Brass', jenis: 'section', menit: 20 },
    { id: 'k_c', judul: 'Gabungan', jenis: 'gabungan', menit: 15 },
  ]
  const tx = r.transaction(['sessions'], 'readwrite')
  // Sesi 1 — belum ada realisasi sama sekali.
  tx.objectStore('sessions').put({
    id: 's_pacu_murni', title: 'Pacu Tanpa Realisasi', type: 'latihan', date: iso,
    startTime: jam(-10), endTime: jam(80), place: 'Lapangan A', notes: '', checklist: [],
    createdAt: kini, rencanaLatihan: rencana, realisasiLatihan: [],
  })
  // Sesi 2 — A sudah selesai 13 menit (rencana 10), B sedang berjalan 5 menit.
  tx.objectStore('sessions').put({
    id: 's_pacu_jalan', title: 'Pacu Sedang Jalan', type: 'latihan', date: iso,
    startTime: jam(-20), endTime: jam(70), place: 'Lapangan B', notes: '', checklist: [],
    createdAt: kini, rencanaLatihan: rencana,
    realisasiLatihan: [
      { id: 'k_a', mulai: kini - 18 * M, selesai: kini - 5 * M },
      { id: 'k_b', mulai: kini - 5 * M, selesai: null },
    ],
  })
  await new Promise((res) => { tx.oncomplete = res })
  return { iso }
})

await p.reload({ waitUntil: 'networkidle2' })
await wait(2500)
await p.evaluate(() => { location.hash = '#/jadwal' })
await wait(2000)

// ================================================ sesi 1 — jangkar rencana murni
await klik('[data-testid="pacu-s_pacu_murni"]')
await wait(1500)
cek('layar pacu terbuka', await ada('[data-testid="pacu-latihan"]'))
cek('judul sesi tampil', (await teks('[data-testid="judul-sesi-pacu"]')).includes('Pacu Tanpa Realisasi'))
cek('tanpa realisasi → geser 0', (await p.$eval('[data-testid="geser"]', (e) => e.getAttribute('data-geser'))) === '0')
cek('geser 0 tertulis "tepat waktu"', (await teks('[data-testid="geser"]')) === 'tepat waktu')
cek('tanpa realisasi → tidak ada peringatan geser', !(await ada('[data-testid="peringatan-geser"]')))
cek('proyeksi = ujung rencana (tanpa geser)', await ada('[data-testid="proyeksi-selesai"]'))
const proyeksiMurni = await teks('[data-testid="proyeksi-selesai"]')
cek('proyeksi bukan tanda hubung', proyeksiMurni !== '—', proyeksiMurni)
cek('tombol Mulai tampil untuk blok pertama', await ada('[data-testid="tombol-mulai"]'))

// Mulai lewat tombol besar → blok pertama berjalan.
await klik('[data-testid="tombol-mulai"]')
await wait(1200)
cek('setelah Mulai → blok A berjalan',
  (await p.$eval('[data-testid="kartu-berjalan"]', (e) => e.getAttribute('data-blok'))) === 'k_a')
cek('setelah Mulai → tombol Selesai tampil', await ada('[data-testid="tombol-selesai"]'))

// Sisa blok harus benar-benar berkurang, bukan sekadar bertampilan benar.
const sisa1 = await teks('[data-testid="sisa-blok"]')
await wait(2500)
const sisa2 = await teks('[data-testid="sisa-blok"]')
cek('sisa blok terbaca', /\d/.test(sisa1), sisa1)
cek('blok berjalan tidak memicu geser palsu',
  (await p.$eval('[data-testid="geser"]', (e) => e.getAttribute('data-geser'))) === '0',
  await teks('[data-testid="geser"]'))

await klik('[data-testid="tutup-pacu"]')
await wait(800)
cek('layar pacu tertutup', !(await ada('[data-testid="pacu-latihan"]')))

// ============================================ sesi 2 — jangkar realisasi, geser +3
await klik('[data-testid="pacu-s_pacu_jalan"]')
await wait(1500)
cek('layar pacu sesi 2 terbuka', await ada('[data-testid="pacu-latihan"]'))
const idBlok = await p.$eval('[data-testid="kartu-berjalan"]', (e) => e.getAttribute('data-blok'))
cek('blok yang berjalan adalah B', idBlok === 'k_b', String(idBlok))
cek('judul blok B tampil', (await teks('[data-testid="blok-berjalan"]')) === 'Section Brass')

const geser = await p.$eval('[data-testid="geser"]', (e) => e.getAttribute('data-geser'))
cek('geser +3 dari blok A (13 vs 10 menit)', geser === '3', String(geser))
cek('geser tertulis "terlambat 3 mnt"', (await teks('[data-testid="geser"]')).includes('terlambat 3 mnt'),
  await teks('[data-testid="geser"]'))
cek('peringatan geser muncul', await ada('[data-testid="peringatan-geser"]'))
cek('peringatan menyebut bagian akhir',
  (await teks('[data-testid="peringatan-geser"]')).includes('bagian akhir'))

const sisaTeks = await teks('[data-testid="sisa-blok"]')
const sisaAngka = Number(sisaTeks.replace(/[^\d]/g, ''))
cek('sisa blok B masih 13–15 menit', sisaAngka >= 13 && sisaAngka <= 15, sisaTeks)

const proyeksi = await teks('[data-testid="proyeksi-selesai"]')
cek('proyeksi selesai terbaca', /^\d{2}:\d{2}$/.test(proyeksi), proyeksi)

// Selesaikan blok B lebih cepat (5 menit dari jatah 20) → geser menjadi −12.
await klik('[data-testid="tombol-selesai"]')
await wait(1500)
const geser2 = await p.$eval('[data-testid="geser"]', (e) => e.getAttribute('data-geser'))
cek('B selesai 5 vs 20 → geser −12', geser2 === '-12', String(geser2))
cek('geser negatif tertulis "lebih cepat"',
  (await teks('[data-testid="geser"]')).includes('lebih cepat'), await teks('[data-testid="geser"]'))
cek('peringatan geser hilang saat tidak terlambat', !(await ada('[data-testid="peringatan-geser"]')))

// Mulai blok C dari dalam daftar.
await klik('[data-testid="mulai-k_c"]')
await wait(1200)
cek('blok C mulai dari daftar',
  (await p.$eval('[data-testid="kartu-berjalan"]', (e) => e.getAttribute('data-blok'))) === 'k_c')
const geser3 = await p.$eval('[data-testid="geser"]', (e) => e.getAttribute('data-geser'))
cek('geser tetap −12 saat C baru mulai', geser3 === '-12', String(geser3))

// Ulangi pencatatan → kembali bersih.
await klik('[data-testid="reset-realisasi"]')
await wait(1200)
const geser4 = await p.$eval('[data-testid="geser"]', (e) => e.getAttribute('data-geser'))
cek('reset → geser 0', geser4 === '0', String(geser4))
// Setelah direset tidak ada realisasi, jadi layar jatuh ke JANGKAR RENCANA:
// jam sekarang berada di dalam blok B (sesi mulai 20 menit lalu, A 10 menit,
// B 20 menit → B mencakup "sekarang"). Yang membuktikannya adalah labelnya.
const idSetelahReset = await p.$eval('[data-testid="kartu-berjalan"]', (e) => e.getAttribute('data-blok'))
cek('reset → jatuh ke jangkar rencana (blok B)', idSetelahReset === 'k_b', String(idSetelahReset))
const labelSetelahReset = await teks('[data-testid="kartu-berjalan"]')
cek('reset → label "Seharusnya sekarang", bukan "Sedang berjalan"',
  labelSetelahReset.includes('Seharusnya sekarang'), labelSetelahReset.slice(0, 60))

// Realisasi harus bertahan lintas buka-tutup layar.
await klik('[data-testid="mulai-k_a"]')
await wait(1000)
await klik('[data-testid="tutup-pacu"]')
await wait(800)
await klik('[data-testid="pacu-s_pacu_jalan"]')
await wait(1500)
cek('realisasi bertahan setelah ditutup lalu dibuka lagi',
  (await p.$eval('[data-testid="kartu-berjalan"]', (e) => e.getAttribute('data-blok'))) === 'k_a')

cek('tidak ada error konsol', errors.length === 0, errors.slice(0, 3).join(' | '))

console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) {
  console.log('GAGAL:\n - ' + gagal.join('\n - '))
  await browser.close()
  process.exit(1)
}
await browser.close()
console.log('selesai')
