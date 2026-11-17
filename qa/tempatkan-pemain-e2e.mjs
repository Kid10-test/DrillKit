/**
 * Uji peramban v2.11.2 — menempatkan pemain di editor drill.
 *
 * Cacat yang dijaga: di drill yang baru dibuka, ketuk ⌖ pemain lalu ketuk
 * lapangan tidak berbuat apa-apa. Penyebabnya handler `pointerup` yang
 * dipasang sekali memakai `updatePoint` dari render pertama, ketika set belum
 * termuat. Karena itu drill uji dibuat langsung di IndexedDB dan editor
 * dibuka SEGAR — persis keadaan pelatih yang baru membuat drill.
 *
 * Yang diuji: tetikus, sentuh (jalur geser kanvas), tempatkan beruntun,
 * Esc, "Masukkan semua" (blok per section), undo/redo, dan set 2 yang
 * mengambil posisi dari set 1. Isi IndexedDB ikut diperiksa.
 */
import puppeteer from 'puppeteer'
import { lewatSambutan } from './sambutan.mjs'

const BASE = process.env.BASE || 'http://localhost:4173'
const browser = await puppeteer.launch({
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  defaultViewport: { width: 1366, height: 1000 },
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
const ada = async (sel) => (await p.$(sel)) != null
const tombol = (t) =>
  p.evaluate((x) => {
    const b = [...document.querySelectorAll('button')].find((y) => y.textContent.trim() === x || y.textContent.includes(x))
    if (!b || b.disabled) return false
    b.click()
    return true
  }, t)

const bacaSet = (id) =>
  p.evaluate(async (x) => {
    const r = await new Promise((res) => { const q = indexedDB.open('drillkit'); q.onsuccess = () => res(q.result) })
    return await new Promise((res) => {
      const g = r.transaction('sets').objectStore('sets').get(x)
      g.onsuccess = () => res(g.result)
    })
  }, id)
const jumlahTitik = async (id) => Object.keys((await bacaSet(id))?.points ?? {}).length
const siapPertama = () =>
  p.$$eval('[data-testid^="siap-letakkan-"]', (el) => el.map((e) => e.getAttribute('data-testid').slice('siap-letakkan-'.length)))
const bannerId = () =>
  p.evaluate(() => {
    const b = document.querySelector('[data-testid="banner-siap-letakkan"] b')
    return b ? b.textContent.trim() : null
  })
const kanvas = async () => {
  const r = await p.$eval('[data-testid="kanvas-drill-svg"]', (e) => {
    e.scrollIntoView({ block: 'center' })
    const k = e.getBoundingClientRect()
    return { x: k.left, y: k.top, w: k.width, h: k.height }
  })
  return { ...r, titik: (fx, fy) => ({ x: r.x + r.w * fx, y: r.y + r.h * fy }) }
}

await p.goto(BASE, { waitUntil: 'networkidle2' })
await lewatSambutan(p)
await wait(1200)
await tombol('Muat data contoh')
await wait(4000)

// Drill uji: 10 anggota aktif dari data contoh, Set 1 & Set 2 kosong.
const seed = await p.evaluate(async () => {
  const r = await new Promise((res) => { const q = indexedDB.open('drillkit'); q.onsuccess = () => res(q.result) })
  const semua = (store) =>
    new Promise((res) => { const g = r.transaction(store).objectStore(store).getAll(); g.onsuccess = () => res(g.result) })
  const anggota = (await semua('members')).filter((m) => m.active)
  const contoh = (await semua('drills'))[0]
  const pilih = anggota.slice(0, 10)
  const t = Date.now() + 60_000
  const tx = r.transaction(['drills', 'sets'], 'readwrite')
  tx.objectStore('drills').put({
    ...contoh,
    id: 'd_uji_tempat',
    name: 'Uji tempat',
    rosterIds: pilih.map((m) => m.id),
    markers: [],
    createdAt: t,
    updatedAt: t,
  })
  tx.objectStore('sets').put({ id: 'set_uji_1', drillId: 'd_uji_tempat', order: 0, name: 'Set 1', counts: 16, points: {}, createdAt: t })
  tx.objectStore('sets').put({ id: 'set_uji_2', drillId: 'd_uji_tempat', order: 1, name: 'Set 2', counts: 16, points: {}, createdAt: t + 1 })
  await new Promise((res) => { tx.oncomplete = res })
  return { n: pilih.length, sections: new Set(pilih.map((m) => m.section)).size, kode: Object.fromEntries(pilih.map((m) => [m.id, m.code])) }
})
cek('seed: 10 anggota', seed.n === 10, String(seed.n))

await p.evaluate(() => { location.hash = '#/drill' })
await p.waitForSelector('[data-testid="panel-belum-masuk"]', { timeout: 15000 })
await wait(800)
cek('drill uji terbuka (judul)', await p.evaluate(() => document.body.innerText.includes('Uji tempat')))
cek('tombol Masukkan semua (10)', await p.evaluate(() => document.querySelector('[data-testid="masukkan-semua"]')?.textContent.includes('(10)')))

// --- 1. tetikus di drill segar -----------------------------------------
let urut = await siapPertama()
const id1 = urut[0]
await p.click(`[data-testid="siap-letakkan-${id1}"]`)
await wait(300)
cek('⌖ menampilkan banner', await ada('[data-testid="banner-siap-letakkan"]'))
let k = await kanvas()
let t1 = k.titik(0.3, 0.4)
await p.mouse.click(t1.x, t1.y)
await wait(700)
let s1 = await bacaSet('set_uji_1')
cek('tetikus: pemain pertama tersimpan di Set 1', Boolean(s1.points[id1]), JSON.stringify(Object.keys(s1.points)))
cek('tetikus: bukan di titik (0,0)', s1.points[id1] && Math.hypot(s1.points[id1].x, s1.points[id1].y) > 1)
cek('tetikus: kiri kanvas = Side 1 (x positif)', s1.points[id1]?.x > 0, String(s1.points[id1]?.x))

// --- 2. beruntun + sentuh ----------------------------------------------
const id2 = await bannerId()
cek('beruntun: pemain berikutnya langsung disiapkan', id2 && id2 !== seed.kode[id1], String(id2))
cek('beruntun: banner menyebut sisa', await ada('[data-testid="sisa-beruntun"]'))
k = await kanvas()
const t2 = k.titik(0.6, 0.55)
await p.touchscreen.tap(t2.x, t2.y)
await wait(800)
s1 = await bacaSet('set_uji_1')
cek('sentuh: pemain kedua tersimpan', Object.keys(s1.points).length === 2, JSON.stringify(Object.keys(s1.points)))
const id2Id = Object.keys(s1.points).find((x) => x !== id1)
cek('sentuh: kode pemain kedua cocok banner', seed.kode[id2Id] === id2, `${seed.kode[id2Id]} vs ${id2}`)
cek('sentuh: kanan kanvas = Side 2 (x negatif)', s1.points[id2Id]?.x < 0, String(s1.points[id2Id]?.x))

// --- 3. Esc membatalkan, beruntun bisa dimatikan ------------------------
await p.keyboard.press('Escape')
await wait(300)
cek('Esc: banner hilang', !(await ada('[data-testid="banner-siap-letakkan"]')))
await p.click('[data-testid="letak-beruntun"]')
await wait(200)
urut = await siapPertama()
await p.click(`[data-testid="siap-letakkan-${urut[0]}"]`)
await wait(200)
k = await kanvas()
const t3 = k.titik(0.5, 0.25)
await p.mouse.click(t3.x, t3.y)
await wait(700)
cek('tanpa beruntun: pemain ketiga tersimpan', (await jumlahTitik('set_uji_1')) === 3)
cek('tanpa beruntun: banner tidak muncul lagi', !(await ada('[data-testid="banner-siap-letakkan"]')))

// --- 4. Masukkan semua ---------------------------------------------------
cek('Masukkan semua menghitung sisa (7)', await p.evaluate(() => document.querySelector('[data-testid="masukkan-semua"]')?.textContent.includes('(7)')))
const sebelumMassal = (await bacaSet('set_uji_1')).points
await p.click('[data-testid="masukkan-semua"]')
await wait(900)
s1 = await bacaSet('set_uji_1')
const v1 = Object.values(s1.points)
cek('Masukkan semua: 10 titik di Set 1', v1.length === 10, String(v1.length))
cek('Masukkan semua: 3 titik lama tidak bergeser', Object.entries(sebelumMassal).every(([id, q]) => s1.points[id].x === q.x && s1.points[id].y === q.y))
let dekat = Infinity
for (let i = 0; i < v1.length; i++) for (let j = i + 1; j < v1.length; j++) dekat = Math.min(dekat, Math.hypot(v1[i].x - v1[j].x, v1[i].y - v1[j].y))
cek('Masukkan semua: tidak ada titik bertumpuk', dekat > 1, dekat.toFixed(2))
cek('Masukkan semua: panel "Belum masuk" hilang', !(await ada('[data-testid="panel-belum-masuk"]')))

// --- 5. undo / redo satu langkah ----------------------------------------
await p.mouse.click(5, 5)
await p.keyboard.down('Control'); await p.keyboard.press('z'); await p.keyboard.up('Control')
await wait(800)
cek('undo: kembali ke 3 titik', (await jumlahTitik('set_uji_1')) === 3, String(await jumlahTitik('set_uji_1')))
await p.keyboard.down('Control'); await p.keyboard.press('y'); await p.keyboard.up('Control')
await wait(800)
cek('redo: 10 titik lagi', (await jumlahTitik('set_uji_1')) === 10)

// --- 6. Set 2 mengambil posisi Set 1 ------------------------------------
const pindah = await p.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((y) => y.textContent.trim().startsWith('Set 2'))
  if (!b) return false
  b.click()
  return true
})
await wait(900)
cek('pindah ke Set 2', pindah)
cek('Set 2: tombol Masukkan semua (10)', await p.evaluate(() => document.querySelector('[data-testid="masukkan-semua"]')?.textContent.includes('(10)')))
await p.click('[data-testid="masukkan-semua"]')
await wait(900)
const s2 = await bacaSet('set_uji_2')
const s1Akhir = await bacaSet('set_uji_1')
cek('Set 2: 10 titik', Object.keys(s2.points).length === 10)
cek(
  'Set 2: semua di posisi Set 1',
  Object.entries(s1Akhir.points).every(([id, q]) => s2.points[id] && s2.points[id].x === q.x && s2.points[id].y === q.y),
)
cek('Set 1 tidak ikut berubah', JSON.stringify(s1Akhir.points) === JSON.stringify(s1.points))

// --- 7. ⌖ di set 2 juga bekerja (closure set yang terbaru) --------------
// Keluarkan satu pemain lewat tombol tong sampah di daftar anggota (lewat Dexie,
// jadi editor ikut diperbarui), lalu tempatkan ulang dengan ⌖.
await p.click('[title="Keluarkan dari set ini"]')
await wait(700)
cek('keluarkan: Set 2 tinggal 9', (await jumlahTitik('set_uji_2')) === 9)
await p.waitForSelector('[data-testid^="siap-letakkan-"]', { timeout: 5000 })
urut = await siapPertama()
await p.click(`[data-testid="siap-letakkan-${urut[0]}"]`)
await wait(200)
k = await kanvas()
const t4 = k.titik(0.45, 0.7)
await p.mouse.click(t4.x, t4.y)
await wait(700)
const s2b = await bacaSet('set_uji_2')
const s1b = await bacaSet('set_uji_1')
cek('⌖ di Set 2 menulis ke Set 2', Object.keys(s2b.points).length === 10)
cek('⌖ di Set 2 tidak menyentuh Set 1', JSON.stringify(s1b.points) === JSON.stringify(s1.points))

cek('tanpa galat konsol', errors.length === 0, errors.slice(0, 3).join(' | '))

await browser.close()
console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) {
  console.log('GAGAL:\n - ' + gagal.join('\n - '))
  process.exit(1)
}
