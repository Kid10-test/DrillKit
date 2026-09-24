/**
 * Uji G2 — mode lomba (tampilan hari H).
 *
 * Tantangannya: mode ini bergantung pada **jam sungguhan**, yang tidak bisa
 * diatur dari luar. Daripada mencoba membekukan waktu, uji ini menyusun
 * sesinya **mengapit saat ini** — dihitung dari jam peramban pada saat uji
 * berjalan:
 *
 *   satu jam lalu  →  [sesi A: sedang berjalan]  →  30 mnt lagi  →  [sesi B]
 *
 * Dengan begitu hasilnya pasti, dan keadaan batas (rentang setengah
 * terbuka: mulai ≤ now < selesai) benar-benar teruji.
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
const klik = async (sel) => { await p.waitForSelector(sel, { timeout: 10000 }); await p.click(sel) }
const teks = (sel) => p.$eval(sel, (e) => e.textContent.trim())
const ada = async (sel) => (await p.$(sel)) !== null
const atribut = (sel, a) => p.$eval(sel, (e, b) => e.getAttribute(b), a)

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

/* ------------- Susun hari yang mengapit saat ini ------------------------ */
const info = await p.evaluate(async () => {
  const r = await new Promise((res) => { const q = indexedDB.open('drillkit'); q.onsuccess = () => res(q.result) })
  const sekarang = new Date()
  const iso = `${sekarang.getFullYear()}-${String(sekarang.getMonth() + 1).padStart(2, '0')}-${String(sekarang.getDate()).padStart(2, '0')}`
  const jam = (menitKeDepan) => {
    const d = new Date(sekarang.getTime() + menitKeDepan * 60000)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
  const bersih = (id, title) => ({
    id, title, bpm: 120, beats: 4, tempoMap: [], createdAt: Date.now(), panjangBirama: 32,
  })
  const tx = r.transaction(['songs', 'setlists', 'sessions'], 'readwrite')
  /*
   * 2a — sesi data contoh yang jatuh HARI INI dibuang dulu. Data contoh
   * punya "Latihan Rutin" hari ini pukul 15:30–18:00; bila uji berjalan
   * kira-kira pukul 15:00–18:00 (jam perangkat), sesi itu menjadi "sedang
   * berjalan" atau "berikutnya" menggantikan sesi yang disiapkan di bawah,
   * kartu set list tidak muncul, dan uji MOGOK di `daftar-lagu` tanpa
   * ringkasan — setiap sore, tanpa ada yang rusak (terjadi pada regresi
   * penuh 23 Sep 2026, 15:30). Yang diuji hanya tiga sesi milik uji ini.
   */
  const lama = tx.objectStore('sessions').getAll()
  lama.onsuccess = () => {
    for (const s of lama.result) {
      if (s.date === iso && !String(s.id).startsWith('s_ml_')) tx.objectStore('sessions').delete(s.id)
    }
  }
  tx.objectStore('songs').put(bersih('song_ml_a', 'Pembuka'))
  tx.objectStore('songs').put(bersih('song_ml_b', 'Balada'))
  tx.objectStore('setlists').put({
    id: 'sl_ml', name: 'Show Uji', songIds: ['song_ml_a', 'song_ml_b'],
    createdAt: 1, updatedAt: 1,
  })
  // Sudah lewat (1 jam lalu), sedang berjalan (mulai 10 mnt lalu, habis
  // 20 mnt lagi), berikutnya (mulai 30 mnt lagi).
  tx.objectStore('sessions').put({
    id: 's_ml_lewat', title: 'Pemanasan Pagi', type: 'latihan', date: iso,
    startTime: jam(-75), endTime: jam(-60), checklist: [], createdAt: Date.now(),
  })
  tx.objectStore('sessions').put({
    id: 's_ml_kini', title: 'Gladi Resik', type: 'latihan', date: iso,
    startTime: jam(-10), endTime: jam(20), place: 'Lapangan A',
    notes: 'Fokus pada formasi akhir.',
    checklist: [
      { id: 'c1', text: 'Seragam lengkap', done: 0 },
      { id: 'c2', text: 'Alat sudah dicek', done: 1 },
    ],
    createdAt: Date.now(),
  })
  tx.objectStore('sessions').put({
    id: 's_ml_nanti', title: 'Penampilan — Kejuaraan', type: 'penampilan', date: iso,
    startTime: jam(30), endTime: jam(70), place: 'Stadion Utama',
    notes: 'Slot 40 menit.', setListId: 'sl_ml', checklist: [], createdAt: Date.now(),
  })
  await new Promise((res) => { tx.oncomplete = res })
  return { iso, jamKini: jam(0) }
})

// Dexie tidak melihat tulisan IndexedDB mentah — wajib dimuat ulang.
await p.reload({ waitUntil: 'networkidle2' })
await wait(3000)

await p.evaluate(() => { location.hash = '#/lomba' })
await wait(2600)
await p.evaluate((t) => {
  const el = document.querySelector('[data-testid="pilih-tanggal"]')
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
  set.call(el, t)
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
}, info.iso)
await wait(1600)

// Periksa bahwa ketiga sesi yang disiapkan uji ada (sesi data contoh yang
// jatuh hari ini sudah dibuang di atas).
for (const id of ['s_ml_lewat', 's_ml_kini', 's_ml_nanti']) {
  cek(`sesi ${id} tampil di run sheet`, await ada(`[data-testid="baris-run-${id}"]`))
}

/* ========================= Buka mode lomba ============================== */
await klik('[data-testid="buka-mode-lomba"]')
await wait(1800)
cek('mode lomba terbuka', await ada('[data-testid="mode-lomba"]'))
cek('fase = sedang (ada sesi yang berjalan)',
  (await atribut('[data-testid="fase-hari"]', 'data-fase')) === 'sedang',
  await atribut('[data-testid="fase-hari"]', 'data-fase'))

cek('kartu "sedang berjalan" menampilkan Gladi Resik',
  (await teks('[data-testid="kartu-sekarang"]')).includes('Gladi Resik'),
  (await teks('[data-testid="kartu-sekarang"]')).slice(0, 120))
cek('kartu "berikutnya" menampilkan Penampilan',
  (await teks('[data-testid="kartu-berikutnya"]')).includes('Penampilan'),
  (await teks('[data-testid="kartu-berikutnya"]')).slice(0, 120))

/* ------------------- Sisa slot & hitung mundur -------------------------- */
const sisaSlot = await teks('[data-testid="sisa-slot"]')
const angkaSisa = Number(sisaSlot.replace(/\D/g, ''))
// Sesi berjalan habis 20 menit lagi; boleh 19 atau 20 tergantung detiknya.
cek('sisa slot ~20 menit', angkaSisa >= 18 && angkaSisa <= 20, sisaSlot)

const mundur1 = await teks('[data-testid="hitung-mundur"]')
cek('hitung mundur berbentuk MM:SS', /^\d{2}:\d{2}$/.test(mundur1), mundur1)
const detik1 = (() => {
  const [m, s] = mundur1.split(':').map(Number)
  return m * 60 + s
})()
cek('hitung mundur mendekati 30 menit', Math.abs(detik1 - 1800) <= 120, `${mundur1} = ${detik1}s`)

// Jam harus benar-benar berdetak.
const jam1 = await teks('[data-testid="jam-besar"]')
await wait(2500)
const mundur2 = await teks('[data-testid="hitung-mundur"]')
const detik2 = (() => {
  const [m, s] = mundur2.split(':').map(Number)
  return m * 60 + s
})()
cek('hitung mundur BERKURANG seiring waktu', detik2 < detik1, `${detik1} → ${detik2}`)
cek('selisihnya wajar (2–5 detik)', detik1 - detik2 >= 1 && detik1 - detik2 <= 6,
  `${detik1 - detik2}`)
console.log('jam:', jam1, '→', await teks('[data-testid="jam-besar"]'))

/* ---------------- Yang perlu dipersiapkan: set list --------------------- */
cek('kartu set list tampil', await ada('[data-testid="kartu-setlist"]'))
const laguTeks = await teks('[data-testid="daftar-lagu"]')
cek('daftar lagu memuat Pembuka', laguTeks.includes('Pembuka'), laguTeks.slice(0, 120))
cek('daftar lagu memuat Balada', laguTeks.includes('Balada'))
cek('urutan lagu benar (Pembuka sebelum Balada)',
  laguTeks.indexOf('Pembuka') < laguTeks.indexOf('Balada'))

/* ----------------------------- Checklist -------------------------------- */
cek('kartu persiapan tampil', await ada('[data-testid="kartu-periksa"]'))
cek('persiapan menunjukkan 1/2',
  (await teks('[data-testid="kartu-periksa"]')).includes('1/2'),
  (await teks('[data-testid="kartu-periksa"]')).slice(0, 80))
await klik('[data-testid="centang-c1"]')
await wait(1200)
cek('mencentang menambah hitungan jadi 2/2',
  (await teks('[data-testid="kartu-periksa"]')).includes('2/2'),
  (await teks('[data-testid="kartu-periksa"]')).slice(0, 80))

/* ------------------- Centang tersimpan lintas buka ---------------------- */
await klik('[data-testid="tutup-lomba"]')
await wait(900)
await klik('[data-testid="buka-mode-lomba"]')
await wait(1800)
cek('centang tersimpan setelah mode ditutup & dibuka lagi',
  (await teks('[data-testid="kartu-periksa"]')).includes('2/2'),
  (await teks('[data-testid="kartu-periksa"]')).slice(0, 80))
await klik('[data-testid="tutup-lomba"]')
await wait(900)

/* ---------------- Peringatan rencana ikut tampil di hari H -------------- */
// Persempit slot penampilan sampai isinya tidak muat, lalu buka lagi.
await p.evaluate(() => new Promise((res) => {
  const r = indexedDB.open('drillkit')
  r.onsuccess = () => {
    const tx = r.result.transaction('sessions', 'readwrite')
    const os = tx.objectStore('sessions')
    const q = os.get('s_ml_nanti')
    // 2 lagu × 32 birama @120 BPM 4/4 = 128 detik; slot 1 menit tak cukup.
    q.onsuccess = () => os.put({ ...q.result, startTime: '23:00', endTime: '23:01' })
    tx.oncomplete = res
  }
}))
await p.reload({ waitUntil: 'networkidle2' })
await wait(3000)
await p.evaluate(() => { location.hash = '#/lomba' })
await wait(2600)
await p.evaluate((t) => {
  const el = document.querySelector('[data-testid="pilih-tanggal"]')
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
  set.call(el, t)
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
}, info.iso)
await wait(1600)
await klik('[data-testid="buka-mode-lomba"]')
await wait(1800)
cek('peringatan rencana tampil juga di mode lomba',
  await ada('[data-testid="peringatan-lomba"]'))
cek('peringatannya menyebut isi lebih panjang dari slot',
  (await teks('[data-testid="peringatan-lomba"]')).includes('lebih panjang dari slot'),
  (await teks('[data-testid="peringatan-lomba"]')).slice(0, 160))

/* =========================== Kebersihan ================================ */
cek('tidak ada error konsol', error.length === 0, error.slice(0, 3).join(' | '))

console.log('\n' + JSON.stringify({
  tanggal: info.iso,
  jamUji: info.jamKini,
  hitungMundur: `${detik1}s → ${detik2}s`,
  error: error.slice(0, 3),
}, null, 2))
console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) console.log('GAGAL:\n - ' + gagal.join('\n - '))
await browser.close()
if (gagal.length) process.exit(1)
