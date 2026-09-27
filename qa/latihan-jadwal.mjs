/**
 * Uji penyunting rencana latihan (H1) di halaman Jadwal.
 *
 * Yang diuji adalah **peringatan sebelum latihan** — inti keluhan "bagian
 * akhir kehabisan waktu". Rencana yang sejak awal sudah lebih panjang dari
 * slotnya tidak akan pernah muat, bagaimanapun ia dijalankan.
 */
import puppeteer from 'puppeteer'
import { lewatSambutan } from './sambutan.mjs'

const BASE = process.env.BASE || 'http://localhost:5173'
const browser = await puppeteer.launch({
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  defaultViewport: { width: 1280, height: 1000 },
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

// Sesi yang slotnya mengapit jam sekarang, supaya keadaan batasnya ikut teruji.
const info = await p.evaluate(async () => {
  const r = await new Promise((res) => { const q = indexedDB.open('drillkit'); q.onsuccess = () => res(q.result) })
  const skrg = new Date()
  const iso = `${skrg.getFullYear()}-${String(skrg.getMonth() + 1).padStart(2, '0')}-${String(skrg.getDate()).padStart(2, '0')}`
  const jam = (mnt) => {
    const d = new Date(skrg.getTime() + mnt * 60000)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
  const tx = r.transaction(['sessions'], 'readwrite')
  tx.objectStore('sessions').put({
    id: 's_h1_uji',
    title: 'Latihan H1 Uji',
    type: 'latihan',
    date: iso,
    startTime: jam(-20),
    endTime: jam(100),
    place: 'Lapangan A',
    notes: '',
    checklist: [],
    createdAt: Date.now(),
    rencanaLatihan: [
      { id: 'b_a', judul: 'Pemanasan & tuning', jenis: 'pemanasan', menit: 15 },
      { id: 'b_b', judul: 'Section Brass', jenis: 'section', menit: 30 },
      { id: 'b_c', judul: 'Gabungan', jenis: 'gabungan', menit: 20 },
    ],
  })
  await new Promise((res) => { tx.oncomplete = res })
  return { iso }
})

// WAJIB dimuat ulang: Dexie tidak melihat tulisan IndexedDB mentah.
await p.reload({ waitUntil: 'networkidle2' })
await wait(2500)
await p.evaluate(() => { location.hash = '#/jadwal' })
await wait(2000)

// ------------------------------------------------------------ ringkasan di kartu
cek('kartu sesi tampil', await ada('[data-testid="ringkas-muat"]'))
const ringkas = await teks('[data-testid="ringkas-muat"]')
cek('ringkasan menyebut 3 blok', await p.$eval('[data-testid="ringkas-muat"]',
  (e) => e.parentElement.textContent.includes('3 blok')), ringkas)
cek('ringkasan menyebut sisa slot', ringkas.includes('55 mnt'), ringkas)

// ------------------------------------------------------------------ modal sunting
await klik('[data-testid="s_h1_uji"]').catch(() => {})
await p.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Edit')
  b?.click()
})
// Ambil modal sesi yang benar kalau ada lebih dari satu kartu.
await wait(600)
if (!(await ada('[data-testid="daftar-blok"]'))) {
  await p.evaluate(() => {
    const kartu = [...document.querySelectorAll('div')].find((d) => d.textContent.includes('Latihan H1 Uji'))
    let el = kartu
    for (let i = 0; i < 8 && el; i += 1) {
      const b = [...el.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Edit')
      if (b) { b.click(); return }
      el = el.parentElement
    }
  })
  await wait(600)
}

cek('modal sunting terbuka', await ada('[data-testid="daftar-blok"]'))
const baris = await p.$$eval('[data-testid^="blok-"]', (n) => n.length)
cek('tiga blok tercantum di modal', baris === 3, String(baris))

const urutanAwal = await p.$$eval('[data-testid^="blok-"]', (n) => n.map((x) => x.textContent.match(/·?\s*(\d+) mnt/)?.[1] ?? ''))
cek('durasi blok terbaca 15/30/20', urutanAwal.join(',') === '15,30,20', urutanAwal.join(','))

// ------------------------------------------------------- peringatan kelebihan slot
await p.$eval('[data-testid="nama-blok"]', (e) => { e.value = '' })
await p.type('[data-testid="nama-blok"]', 'Blok kelebihan')
await p.$eval('[data-testid="menit-blok"]', (e) => { e.value = '' })
await p.type('[data-testid="menit-blok"]', '60')
await klik('[data-testid="tambah-blok"]')
await wait(400)

cek('blok keempat bertambah', (await p.$$eval('[data-testid^="blok-"]', (n) => n.length)) === 4)
cek('peringatan kelebihan muncul', await ada('[data-testid="rencana-lebih"]'))
const teksLebih = await teks('[data-testid="rencana-lebih"]')
cek('kelebihannya 5 menit', teksLebih.includes('5 mnt'), teksLebih)
cek('peringatan menyebut bagian akhir', teksLebih.includes('bagian akhir'), teksLebih)

// ------------------------------------------------------------------ hapus kembali
await klik('[data-testid="hapus-b_d"]').catch(async () => {
  const id = await p.$$eval('[data-testid^="blok-"]', (n) => n[3].getAttribute('data-testid'))
  await klik(`[data-testid="hapus-${id.replace('blok-', '')}"]`)
})
await wait(400)
cek('setelah dihapus kembali muat', await ada('[data-testid="rencana-muat"]'))
cek('peringatan kelebihan hilang', !(await ada('[data-testid="rencana-lebih"]')))

// ----------------------------------------------------------------------- pengurutan
const sebelum = await p.$$eval('[data-testid^="blok-"]', (n) => n.map((x) => x.textContent.trim()))
await klik('[data-testid="turun-b_a"]')
await wait(400)
const sesudah = await p.$$eval('[data-testid^="blok-"]', (n) => n.map((x) => x.textContent.trim()))
cek('urutan berubah setelah diturunkan', sebelum[0] !== sesudah[0], `${sebelum[0]} → ${sesudah[0]}`)
cek('blok pertama kini Section Brass', sesudah[0].includes('Section Brass'), sesudah[0])

// -------------------------------------------------------------------------- simpan
await tombol('Simpan')
await wait(1200)
cek('kartu menampilkan ringkasan setelah disimpan', await ada('[data-testid="ringkas-muat"]'))

// ----------------------------------------------------------- tombol pacu tersedia
cek('tombol Pacu tampil karena ada rencana', await ada('[data-testid="pacu-s_h1_uji"]'))

cek('tidak ada error konsol', errors.length === 0, errors.slice(0, 3).join(' | '))

console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) {
  console.log('GAGAL:\n - ' + gagal.join('\n - '))
  await browser.close()
  process.exit(1)
}
await browser.close()
console.log('selesai')
