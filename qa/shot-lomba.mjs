// Tangkapan layar G1 — run sheet hari lomba.
// Dua keadaan: linimasa yang aman, dan linimasa dengan peringatan.
import puppeteer from 'puppeteer'
import fs from 'node:fs'

const BASE = process.env.BASE || 'http://localhost:5173'
fs.mkdirSync('/home/user/shots', { recursive: true })
const browser = await puppeteer.launch({
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  defaultViewport: { width: 1280, height: 1150 },
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
const potret = async (nama) => {
  await p.screenshot({ path: `/home/user/shots/${nama}.png` })
  console.log('terpotret:', nama)
}

await p.goto(BASE, { waitUntil: 'networkidle2' })
await wait(1500)
await tombol('Muat data contoh')
await wait(4000)

// Susun hari lomba yang realistis: pemanasan → pementasan → penampilan,
// dengan set list yang TIDAK muat di slot penampilan (inti fiturnya).
const hasil = await p.evaluate(async () => {
  const r = await new Promise((res) => { const q = indexedDB.open('drillkit'); q.onsuccess = () => res(q.result) })
  const baca = (n) => new Promise((res) => {
    const q = r.transaction(n, 'readonly').objectStore(n).getAll()
    q.onsuccess = () => res(q.result)
  })
  const sessions = await baca('sessions')
  const tampil = sessions.find((s) => s.type === 'penampilan')
  const tgl = tampil.date
  const bersih = (id, title, panjang) => ({
    id, title, bpm: 120, beats: 4, tempoMap: [], createdAt: Date.now(), panjangBirama: panjang,
  })
  const tx = r.transaction(['songs', 'setlists', 'sessions'], 'readwrite')
  tx.objectStore('songs').put(bersih('song_lb_a', 'Pembuka — Fanfare', 64))
  tx.objectStore('songs').put(bersih('song_lb_b', 'Balada — Malam', 96))
  tx.objectStore('songs').put(bersih('song_lb_c', 'Finale — Kemenangan', 80))
  tx.objectStore('setlists').put({
    id: 'sl_lomba', name: 'Show Kejuaraan 2026',
    songIds: ['song_lb_a', 'song_lb_b', 'song_lb_c'], createdAt: 1, updatedAt: 1,
  })
  tx.objectStore('sessions').put({
    id: 's_lb_panas', title: 'Pemanasan & tuning', type: 'latihan', date: tgl,
    startTime: '06:30', endTime: '07:15', place: 'Lapangan A',
    notes: 'Bawa metronom & air minum.', checklist: [], createdAt: Date.now(),
  })
  // 3 lagu = 64+96+80 birama @ 120 BPM 4/4 = 2 detik/birama = 480 detik
  // (8 menit). Slot 5 menit (300 detik) → TIDAK MUAT, supaya peringatannya
  // benar-benar tampil di tangkapan layar.
  tx.objectStore('sessions').put({ ...tampil,
    title: 'Penampilan — Kejuaraan Daerah', startTime: '08:00', endTime: '08:05',
    place: 'Stadion Utama', notes: 'Slot ketat: 5 menit.', setListId: 'sl_lomba',
  })
  tx.objectStore('sessions').put({
    id: 's_lb_eval', title: 'Evaluasi & pembagian piala', type: 'rapat', date: tgl,
    startTime: '08:20', endTime: '09:00', place: 'Tribun Timur',
    checklist: [], createdAt: Date.now(),
  })
  await new Promise((res) => { tx.oncomplete = res })
  return { tgl, idTampil: tampil.id }
})
const TGL = hasil.tgl
const ID_TAMPIL = hasil.idTampil
// Dexie tidak bereaksi pada tulisan IndexedDB mentah — wajib dimuat ulang.
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
}, TGL)
await wait(1600)
console.log('status penampilan:', await p.evaluate(() =>
  [...document.querySelectorAll('[data-testid^="baris-run-"]')]
    .map((e) => `${e.getAttribute('data-status')}`).join(',')))
console.log('ada blok peringatan:', await p.evaluate(() =>
  Boolean(document.querySelector('[data-testid="daftar-peringatan"]'))))
console.log('isi peringatan:', await p.evaluate(() =>
  document.querySelector('[data-testid="daftar-peringatan"]')?.innerText?.slice(0, 120) ?? '-'))
await potret('lomba-1-runsheet')

// Keadaan aman: perlebar slot penampilan sampai muat.
await p.evaluate((idTampil) => new Promise((res) => {
  const r = indexedDB.open('drillkit')
  r.onsuccess = () => {
    const tx = r.result.transaction('sessions', 'readwrite')
    const os = tx.objectStore('sessions')
    // Perlebar slot PENAMPILAN sampai isinya muat (12 menit > 8 menit),
    // dan kembalikan pemanasan ke jamnya semula.
    const q = os.get(idTampil)
    q.onsuccess = () => os.put({ ...q.result, startTime: '08:00', endTime: '08:12' })
    const q2 = os.get('s_lb_panas')
    q2.onsuccess = () => os.put({ ...q2.result, startTime: '06:30', endTime: '07:15' })
    const q3 = os.get('s_lb_eval')
    q3.onsuccess = () => os.put({ ...q3.result, startTime: '08:20', endTime: '09:00' })
    tx.oncomplete = res
  }
}), ID_TAMPIL)
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
}, TGL)
await wait(1600)
console.log('status sesudah diperlebar:', await p.evaluate(() =>
  [...document.querySelectorAll('[data-testid^="baris-run-"]')]
    .map((e) => `${e.getAttribute('data-status')}`).join(',')))
console.log('peringatan hilang:', await p.evaluate(() =>
  !document.querySelector('[data-testid="daftar-peringatan"]')))
await potret('lomba-2-aman')

await browser.close()
console.log('selesai; tanggal', TGL)
