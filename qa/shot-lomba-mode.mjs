// Tangkapan layar G2 — mode lomba (tampilan hari H).
// Sesi disusun mengapit jam sekarang supaya ketiga keadaan tampil sekaligus:
// sudah lewat, sedang berjalan, dan berikutnya.
import puppeteer from 'puppeteer'
import fs from 'node:fs'

const BASE = process.env.BASE || 'http://localhost:5173'
fs.mkdirSync('/home/user/shots', { recursive: true })
const browser = await puppeteer.launch({
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  defaultViewport: { width: 1280, height: 1100 },
})
const p = await browser.newPage()
p.on('console', (m) => { if (m.type() === 'error') console.log('KONSOL:', m.text()) })
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
const potret = async (nama) => {
  await p.screenshot({ path: `/home/user/shots/${nama}.png` })
  console.log('terpotret:', nama)
}

await p.goto(BASE, { waitUntil: 'networkidle2' })
await wait(1500)
await tombol('Muat data contoh')
await wait(4000)

const info = await p.evaluate(async () => {
  const r = await new Promise((res) => { const q = indexedDB.open('drillkit'); q.onsuccess = () => res(q.result) })
  const skrg = new Date()
  const iso = `${skrg.getFullYear()}-${String(skrg.getMonth() + 1).padStart(2, '0')}-${String(skrg.getDate()).padStart(2, '0')}`
  const jam = (mnt) => {
    const d = new Date(skrg.getTime() + mnt * 60000)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
  const bersih = (id, title, panjang) => ({
    id, title, bpm: 120, beats: 4, tempoMap: [], createdAt: Date.now(), panjangBirama: panjang,
  })
  const tx = r.transaction(['songs', 'setlists', 'sessions'], 'readwrite')
  tx.objectStore('songs').put(bersih('song_ml_a', 'Pembuka — Fanfare', 64))
  tx.objectStore('songs').put(bersih('song_ml_b', 'Balada — Malam', 96))
  tx.objectStore('songs').put(bersih('song_ml_c', 'Finale — Kemenangan', 80))
  tx.objectStore('setlists').put({
    id: 'sl_ml', name: 'Show Kejuaraan 2026',
    songIds: ['song_ml_a', 'song_ml_b', 'song_ml_c'], createdAt: 1, updatedAt: 1,
  })
  tx.objectStore('sessions').put({
    id: 's_ml_lewat', title: 'Pemanasan & tuning', type: 'latihan', date: iso,
    startTime: jam(-80), endTime: jam(-60), place: 'Lapangan A', checklist: [], createdAt: Date.now(),
  })
  tx.objectStore('sessions').put({
    id: 's_ml_kini', title: 'Gladi Resik Terakhir', type: 'latihan', date: iso,
    startTime: jam(-12), endTime: jam(18), place: 'Lapangan A',
    notes: 'Fokus formasi akhir & transisi.',
    checklist: [
      { id: 'c1', text: 'Seragam lengkap', done: 1 },
      { id: 'c2', text: 'Alat sudah dicek', done: 1 },
      { id: 'c3', text: 'Air minum & P3K', done: 0 },
    ],
    createdAt: Date.now(),
  })
  tx.objectStore('sessions').put({
    id: 's_ml_nanti', title: 'Penampilan — Kejuaraan Daerah', type: 'penampilan',
    date: iso, startTime: jam(30), endTime: jam(45), place: 'Stadion Utama',
    notes: 'Slot 15 menit. Masuk lewat gerbang timur.', setListId: 'sl_ml',
    checklist: [], createdAt: Date.now(),
  })
  await new Promise((res) => { tx.oncomplete = res })
  return { iso }
})

// Wajib dimuat ulang: Dexie tidak melihat tulisan IndexedDB mentah.
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
await potret('lomba-mode-1-run-sheet')

await klik('[data-testid="buka-mode-lomba"]')
await wait(2000)
// Verifikasi isi frame lewat DOM — gambar tidak bisa saya lihat.
console.log('fase:', await p.$eval('[data-testid="fase-hari"]', (e) => e.getAttribute('data-fase')))
console.log('sedang:', (await teks('[data-testid="kartu-sekarang"]')).replace(/\s+/g, ' ').slice(0, 90))
console.log('berikutnya:', (await teks('[data-testid="kartu-berikutnya"]')).replace(/\s+/g, ' ').slice(0, 90))
console.log('hitung mundur:', await teks('[data-testid="hitung-mundur"]'))
console.log('set list:', (await teks('[data-testid="kartu-setlist"]')).replace(/\s+/g, ' ').slice(0, 120))
console.log('persiapan:', (await teks('[data-testid="kartu-periksa"]')).replace(/\s+/g, ' ').slice(0, 60))
await potret('lomba-mode-2-layar')

await browser.close()
console.log('selesai')
