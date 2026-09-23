// Tangkapan layar Pusat Data.
// Sengaja menampilkan tiga keadaan yang menjadi inti fitur ini: pilihan
// ekspor, konfirmasi sebelum menulis, dan laporan rujukan yang diputus.
import puppeteer from 'puppeteer'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.BASE || 'http://localhost:5173'
const BERKAS = '/home/user/drillkit/qa/berkas-shot'
fs.rmSync(BERKAS, { recursive: true, force: true })
fs.mkdirSync(BERKAS, { recursive: true })
fs.mkdirSync('/home/user/shots', { recursive: true })

const browser = await puppeteer.launch({
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  defaultViewport: { width: 1280, height: 1150 },
})
const p = await browser.newPage()
p.on('console', (m) => { if (m.type() === 'error') console.log('KONSOL:', m.text()) })
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const teks = (sel) => p.$eval(sel, (e) => e.textContent.replace(/\s+/g, ' ').trim())
const klik = async (sel) => { await p.waitForSelector(sel, { timeout: 10000 }); await p.click(sel) }
const tombol = (t) =>
  p.evaluate((x) => {
    const b = [...document.querySelectorAll('button')].find((y) => y.textContent.includes(x))
    if (!b || b.disabled) return false
    b.click()
    return true
  }, t)
const potret = async (nama) => {
  await p.screenshot({ path: `/home/user/shots/${nama}.png` })
  console.log('terpotret:', nama)
}

await p.goto(BASE, { waitUntil: 'networkidle2' })
await wait(1500)
await tombol('Muat data contoh')
await wait(4000)

await p.evaluate(async () => {
  const r = await new Promise((res) => { const q = indexedDB.open('drillkit'); q.onsuccess = () => res(q.result) })
  const skrg = new Date()
  const iso = `${skrg.getFullYear()}-${String(skrg.getMonth() + 1).padStart(2, '0')}-${String(skrg.getDate()).padStart(2, '0')}`
  const tx = r.transaction(['songs', 'setlists', 'sessions'], 'readwrite')
  tx.objectStore('songs').put({ id: 'song_sh_a', title: 'Pembuka — Fanfare', bpm: 132, beats: 4, tempoMap: [], createdAt: 1, panjangBirama: 64 })
  tx.objectStore('songs').put({ id: 'song_sh_b', title: 'Balada — Senja', bpm: 76, beats: 4, tempoMap: [], createdAt: 1, panjangBirama: 48 })
  tx.objectStore('songs').put({ id: 'song_sh_c', title: 'Finale — Kemenangan', bpm: 144, beats: 4, tempoMap: [], createdAt: 1, panjangBirama: 56 })
  tx.objectStore('setlists').put({ id: 'sl_sh_1', name: 'Show Kejuaraan 2026', songIds: ['song_sh_a', 'song_sh_b', 'song_sh_c'], createdAt: 1, updatedAt: 1 })
  tx.objectStore('sessions').put({
    id: 's_sh_1', title: 'Gladi Resik — Kejuaraan', type: 'gabungan', date: iso,
    startTime: '08:00', endTime: '11:00', place: 'Stadion Utama',
    checklist: [], createdAt: Date.now(), setListId: 'sl_sh_1',
  })
  await new Promise((res) => { tx.oncomplete = res })
})
await p.reload({ waitUntil: 'networkidle2' })
await wait(2500)

// ---- Frame 1: pilihan ekspor
await p.evaluate(() => { location.hash = '#/data' })
await wait(2200)
await klik('[data-testid="centang-jenis-lagu"]')
await wait(400)
await klik('[data-testid="centang-jenis-setlist"]')
await wait(400)
console.log('jenis lagu:', await teks('[data-testid="jenis-lagu"]'))
console.log('jenis set list:', await teks('[data-testid="jenis-setlist"]'))
console.log('jenis absensi:', await teks('[data-testid="jenis-absensi"]'))
await potret('data-1-pilih')

// ---- Frame 2: konfirmasi sebelum menulis
const masuk = {
  format: 'drillkit-data',
  versi: 1,
  dibuat: Date.now(),
  lagu: [
    { id: 'song_sh_a', title: 'Pembuka — Fanfare (revisi)', bpm: 132, beats: 4, tempoMap: [], createdAt: 1 },
    { id: 'song_sh_d', title: 'Interlude — Jembatan', bpm: 96, beats: 4, tempoMap: [], createdAt: 1 },
  ],
  setlist: [
    { id: 'sl_sh_1', name: 'Show Kejuaraan 2026 (revisi)', songIds: ['song_sh_a', 'song_sh_d'], createdAt: 1, updatedAt: 1 },
  ],
  jadwal: [
    {
      id: 's_sh_2', title: 'Penampilan — Kejuaraan Daerah', type: 'penampilan',
      date: '2026-10-10', startTime: '09:00', endTime: '09:12', place: 'Stadion Utama',
      checklist: [], createdAt: Date.now(), setListId: 'sl_tidak_ikut',
    },
  ],
}
const jalur = path.join(BERKAS, 'masuk.json')
fs.writeFileSync(jalur, JSON.stringify(masuk))
await (await p.$('[data-testid="berkas-masuk"]')).uploadFile(jalur)
await wait(2200)
console.log('baru lagu:', await teks('[data-testid="baru-lagu"]'))
console.log('timpa lagu:', await teks('[data-testid="timpa-lagu"]'))
console.log('baru setlist:', await teks('[data-testid="baru-setlist"]'))
console.log('timpa setlist:', await teks('[data-testid="timpa-setlist"]'))
console.log('baru jadwal:', await teks('[data-testid="baru-jadwal"]'))
await potret('data-2-konfirmasi')

// ---- Frame 3: laporan rujukan putus
await klik('[data-testid="terapkan-data"]')
await wait(2500)
console.log('laporan:', (await teks('[data-testid="laporan-impor"]')).slice(0, 160))
await potret('data-3-laporan')

// ---- Frame 4: alur CSV
await klik('[data-testid="alur-csv"]')
await wait(1200)
console.log('kolom:', (await p.$eval('[data-testid="pilih-jenis-csv"]', (e) => e.parentElement.textContent.replace(/\s+/g, ' ').trim())).slice(0, 200))
await potret('data-4-csv')

fs.rmSync(BERKAS, { recursive: true, force: true })
await browser.close()
console.log('selesai')
