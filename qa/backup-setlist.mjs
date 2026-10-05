/**
 * Uji regresi: **backup harus menyertakan set list.**
 *
 * Cacat aslinya: `buildBackupPayload` tidak mengumpulkan `setlists` (baru ada
 * sejak M3), dan `importBackup` tidak memulihkannya. Alurnya: backup →
 * bersihkan data → pulihkan = **seluruh set list hilang**, dan karena
 * `Session.setListId` merujuk set list, run sheet hari lomba ikut rusak.
 *
 * Uji ini menjalankan alur itu secara sungguhan: ekspor berkasnya, kosongkan
 * tabelnya, impor balik, lalu periksa isinya. Membaca ulang kodenya saja
 * tidak akan menangkap cacat ini — yang hilang adalah sesuatu yang tidak
 * tertulis di mana pun.
 */
import puppeteer from 'puppeteer'
import fs from 'node:fs'
import path from 'node:path'
import { lewatSambutan } from './sambutan.mjs'
import { QA } from './lokasi.mjs'

const BASE = process.env.BASE || BASE
const UNDUH = path.join(QA, 'unduhan-uji')
fs.rmSync(UNDUH, { recursive: true, force: true })
fs.mkdirSync(UNDUH, { recursive: true })

const browser = await puppeteer.launch({
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  defaultViewport: { width: 1280, height: 1000 },
})
const p = await browser.newPage()
const errors = []
p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
p.on('pageerror', (e) => errors.push(String(e)))

// Arahkan unduhan ke folder yang kita kendalani.
const cdp = await p.createCDPSession()
await cdp.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: UNDUH })

let lulus = 0
const gagal = []
const cek = (nama, syarat, keterangan = '') => {
  if (syarat) lulus += 1
  else gagal.push(`${nama}${keterangan ? ' — ' + keterangan : ''}`)
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const tombol = (t) =>
  p.evaluate((x) => {
    const b = [...document.querySelectorAll('button')].find((y) => y.textContent.includes(x))
    if (!b || b.disabled) return false
    b.click()
    return true
  }, t)

await p.goto(BASE, { waitUntil: 'networkidle2' })
/* Layar sambutan muncul di setiap profil baru; tanpa ini rangkaian
   tidak bisa menyentuh apa pun. */
await lewatSambutan(p)
await wait(1500)
await tombol('Muat data contoh')
await wait(4000)

// Dua set list, masing-masing merujuk lagu yang ada.
const dibuat = await p.evaluate(async () => {
  const r = await new Promise((res) => { const q = indexedDB.open('drillkit'); q.onsuccess = () => res(q.result) })
  const tx = r.transaction(['songs', 'setlists'], 'readwrite')
  tx.objectStore('songs').put({ id: 'song_bk_a', title: 'Lagu Backup A', bpm: 120, beats: 4, tempoMap: [], createdAt: 1, panjangBirama: 32 })
  tx.objectStore('songs').put({ id: 'song_bk_b', title: 'Lagu Backup B', bpm: 100, beats: 4, tempoMap: [], createdAt: 1, panjangBirama: 16 })
  tx.objectStore('setlists').put({ id: 'sl_bk_1', name: 'Set List Backup 1', songIds: ['song_bk_a', 'song_bk_b'], createdAt: 1, updatedAt: 1 })
  tx.objectStore('setlists').put({ id: 'sl_bk_2', name: 'Set List Backup 2', songIds: ['song_bk_a'], createdAt: 1, updatedAt: 1 })
  await new Promise((res) => { tx.oncomplete = res })
  return true
})
cek('fixture set list ditulis', dibuat)

await p.reload({ waitUntil: 'networkidle2' })
await wait(2500)

// ---------------------------------------------------------------- 1. ekspor
await p.evaluate(() => { location.hash = '#/pengaturan' })
await wait(2000)
cek('tombol ekspor backup ada', await tombol('Ekspor backup'))

// Tunggu berkasnya mendarat.
let berkas = null
for (let i = 0; i < 40 && !berkas; i += 1) {
  await wait(250)
  const isi = fs.readdirSync(UNDUH).filter((f) => f.endsWith('.json'))
  if (isi.length) berkas = path.join(UNDUH, isi[0])
}
cek('berkas backup terunduh', berkas != null, berkas ?? 'tidak ada berkas')

const isi = JSON.parse(fs.readFileSync(berkas, 'utf8'))
cek('formatnya drillkit-backup', isi.format === 'drillkit-backup', isi.format)
cek('berkas memuat setlists', Array.isArray(isi.setlists), typeof isi.setlists)
cek('kedua set list ikut tersimpan', isi.setlists?.length === 2, String(isi.setlists?.length))
cek('nama set list terbawa', isi.setlists?.some((s) => s.name === 'Set List Backup 1'))
cek('rujukan lagunya tidak berubah', isi.setlists?.find((s) => s.id === 'sl_bk_1')?.songIds?.length === 2)
cek('lagu yang dirujuk ikut tersimpan', isi.songs?.some((s) => s.id === 'song_bk_a'))

// ------------------------------------------------- 2. kosongkan, 3. pulihkan
await p.evaluate(async () => {
  const r = await new Promise((res) => { const q = indexedDB.open('drillkit'); q.onsuccess = () => res(q.result) })
  const tx = r.transaction(['setlists'], 'readwrite')
  tx.objectStore('setlists').clear()
  await new Promise((res) => { tx.oncomplete = res })
})
await p.reload({ waitUntil: 'networkidle2' })
await wait(2500)
await p.evaluate(() => { location.hash = '#/pengaturan' })
await wait(2000)

const sebelum = await p.evaluate(async () => {
  const r = await new Promise((res) => { const q = indexedDB.open('drillkit'); q.onsuccess = () => res(q.result) })
  return await new Promise((res) => {
    const tx = r.transaction(['setlists'], 'readonly')
    const q = tx.objectStore('setlists').count()
    q.onsuccess = () => res(q.result)
  })
})
cek('set list benar-benar kosong sebelum dipulihkan', sebelum === 0, String(sebelum))

// Unggah berkasnya lewat input sungguhan. #7: unggah hanya membuka
// PRATINJAU — pemulihannya berjalan setelah "Lanjut" ditekan.
const input = await p.$('#restore-input')
await input.uploadFile(berkas)
for (let i = 0; i < 12; i += 1) {
  if (await p.$('[data-testid="modal-pulih-backup"]')) break
  await wait(250)
}
await wait(1200)
for (let i = 0; i < 2; i += 1) {
  const t = await p.$('[data-testid="pulih-backup-tombol"]')
  if (!t) break
  await t.click()
  await wait(1500)
}
await wait(1000)

const sesudah = await p.evaluate(async () => {
  const r = await new Promise((res) => { const q = indexedDB.open('drillkit'); q.onsuccess = () => res(q.result) })
  return await new Promise((res) => {
    const tx = r.transaction(['setlists'], 'readonly')
    const q = tx.objectStore('setlists').getAll()
    q.onsuccess = () => res(q.result)
  })
})
cek('set list pulih setelah impor', sesudah.length === 2, String(sesudah.length))
cek('nama set list pulih utuh', sesudah.some((s) => s.name === 'Set List Backup 1'))
cek('rujukan lagu pulih utuh', sesudah.find((s) => s.id === 'sl_bk_1')?.songIds?.length === 2,
  JSON.stringify(sesudah.find((s) => s.id === 'sl_bk_1')?.songIds ?? []))

cek('tidak ada error konsol', errors.length === 0, errors.slice(0, 3).join(' | '))

fs.rmSync(UNDUH, { recursive: true, force: true })
console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) {
  console.log('GAGAL:\n - ' + gagal.join('\n - '))
  await browser.close()
  process.exit(1)
}
await browser.close()
console.log('selesai')
