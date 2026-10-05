/**
 * Uji M4 — tukar repertoar antar perangkat.
 *
 * Yang diuji bukan sekadar "berkas bisa diunduh", melainkan hal yang membuat
 * fitur ini berguna:
 *
 * 1. Impor dilakukan ke **perangkat benar-benar kosong** (konteks browser
 *    terpisah = IndexedDB sendiri). Mengimpor ke perangkat yang sudah
 *    berisi lagu yang sama tidak membuktikan apa-apa.
 * 2. **Id lagu tidak berubah.** `Drill.songId` dan `SetList.songIds` menyimpan
 *    id, jadi kalau impor memberi id baru, tautan drill ke lagu putus dan set
 *    list jadi kosong. Inilah cacat yang paling mungkin dan paling tidak
 *    terlihat saat berkas dibuka.
 * 3. Menimpa memang menimpa — dan memperingatkan dulu.
 */
import puppeteer from 'puppeteer'
import { lewatSambutan } from './sambutan.mjs'
import fs from 'node:fs'

const BASE = process.env.BASE || 'http://localhost:5173'
const UNDUH = '/tmp/unduh-repertoar'
fs.rmSync(UNDUH, { recursive: true, force: true })
fs.mkdirSync(UNDUH, { recursive: true })

const browser = await puppeteer.launch({
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  defaultViewport: { width: 1440, height: 900 },
})

const error = []
let lulus = 0
const gagal = []
const cek = (nama, syarat, keterangan = '') => {
  if (syarat) lulus += 1
  else gagal.push(`${nama}${keterangan ? ' — ' + keterangan : ''}`)
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

async function halaman(konteks) {
  const h = await konteks.newPage()
  h.on('console', (m) => { if (m.type() === 'error') error.push(m.text()) })
  h.on('pageerror', (e) => error.push(String(e)))
  return h
}

const tombol = (h, teks) =>
  h.evaluate((t) => {
    const x = [...document.querySelectorAll('button')].find((y) => y.textContent.includes(t))
    if (!x || x.disabled) return false
    x.click()
    return true
  }, teks)
const klik = async (h, sel) => { await h.waitForSelector(sel, { timeout: 10000 }); await h.click(sel) }
const teks = (h, sel) => h.$eval(sel, (e) => e.textContent.trim())
const ada = async (h, sel) => (await h.$(sel)) !== null

/** Baca seluruh isi satu tabel lewat IndexedDB mentah. */
const bacaTabel = (h, nama) =>
  h.evaluate((n) => new Promise((res) => {
    const r = indexedDB.open('drillkit')
    r.onsuccess = () => {
      const q = r.result.transaction(n, 'readonly').objectStore(n).getAll()
      q.onsuccess = () => res(q.result)
      q.onerror = () => res([])
    }
    r.onerror = () => res([])
  }), nama)

/** Tulis rekaman ke satu tabel (dipakai untuk menyiapkan fixture). */
const tulisTabel = (h, nama, rekaman) =>
  h.evaluate(([n, daftar]) => new Promise((res) => {
    const r = indexedDB.open('drillkit')
    r.onsuccess = () => {
      const tx = r.result.transaction(n, 'readwrite')
      const os = tx.objectStore(n)
      for (const x of daftar) os.put(x)
      tx.oncomplete = () => res(true)
      tx.onerror = () => res(false)
    }
    r.onerror = () => res(false)
  }), [nama, rekaman])

/* ==================== Perangkat A: siapkan & ekspor ====================== */
const ctxA = await browser.createBrowserContext()
const A = await halaman(ctxA)
// Arahkan unduhan ke direktori yang kita pantau. Sesinya milik halaman
// (bukan browser) pada versi puppeteer yang baru.
const cdpA = await A.createCDPSession()
await cdpA.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: UNDUH })

await A.goto(BASE, { waitUntil: 'networkidle2' })
await lewatSambutan(A)
await wait(1500)
await tombol(A, 'Muat data contoh')
await wait(4000)

const laguAwal = await bacaTabel(A, 'songs')
const drillAwal = await bacaTabel(A, 'drills')
cek('data contoh punya lagu', laguAwal.length >= 1, `${laguAwal.length}`)
cek('data contoh punya drill', drillAwal.length >= 1, `${drillAwal.length}`)

// Fixture: lagu kedua, set list yang memuat kedua lagu, dan tautan drill → lagu.
// Dibuat langsung ke IndexedDB karena UI pembuatnya sudah diuji di tempat lain;
// yang diuji di sini adalah mekanisme tukar-menukarnya.
const LAGU_ID = laguAwal[0].id
const DRILL_ID = drillAwal[0].id
await tulisTabel(A, 'songs', [{
  ...laguAwal[0],
}, {
  id: 'song_kedua_uji',
  title: 'Uji — Balada Malam',
  bpm: 84,
  beats: 4,
  tempoMap: [{ id: 'ts1', measure: 1, bpm: 84 }],
  createdAt: Date.now(),
}])
await tulisTabel(A, 'setlists', [{
  id: 'setlist_uji',
  name: 'Show Uji 2026',
  songIds: [LAGU_ID, 'song_kedua_uji'],
  catatan: 'urutan uji',
  createdAt: Date.now(),
  updatedAt: Date.now(),
}])
await tulisTabel(A, 'drills', [{ ...drillAwal[0], songId: LAGU_ID }])
await A.reload({ waitUntil: 'networkidle2' })
await wait(2500)

// Buka halaman Musik.
await A.evaluate(() => { location.hash = '#/musik' })
await wait(2200)
cek('panel tukar repertoar ada di halaman Musik', await ada(A, '[data-testid="tukar-repertoar"]'))
cek('tombol ekspor ada', await ada(A, '[data-testid="ekspor-repertoar"]'))
cek('tombol impor ada', await ada(A, '[data-testid="impor-repertoar"]'))

await klik(A, '[data-testid="ekspor-repertoar"]')
await wait(900)
cek('modal ekspor terbuka', await ada(A, '[data-testid="modal-ekspor-repertoar"]'))
const ringkasanEkspor = await teks(A, '[data-testid="ringkasan-ekspor"]')
cek('ringkasan ekspor menyebut 2 lagu', ringkasanEkspor.startsWith('2 lagu'), ringkasanEkspor)
cek('ringkasan ekspor menyebut 1 set list', ringkasanEkspor.includes('1 set list'), ringkasanEkspor)
cek('ringkasan ekspor menyebut 1 drill', ringkasanEkspor.includes('1 drill'), ringkasanEkspor)

await klik(A, '[data-testid="unduh-repertoar"]')
await wait(2500)
const berkas = fs.readdirSync(UNDUH).filter((f) => f.endsWith('.json'))
cek('berkas repertoar terunduh', berkas.length === 1, JSON.stringify(fs.readdirSync(UNDUH)))
if (!berkas.length) { console.log('GAGAL: berkas tak pernah terunduh'); await browser.close(); process.exit(1) }
const isi = JSON.parse(fs.readFileSync(`${UNDUH}/${berkas[0]}`, 'utf8'))
cek('berkas ditandai format repertoar', isi.format === 'drillkit-repertoar')
cek('berkas berisi 2 lagu', isi.songs.length === 2, `${isi.songs.length}`)
cek('berkas berisi 1 set list', isi.setlists.length === 1)
cek('berkas berisi 1 drill', isi.drills.length === 1)
cek('set milik drill ikut terbawa', isi.sets.length === 2, `${isi.sets.length}`)
const PATH = `${UNDUH}/${berkas[0]}`

/* ================= Perangkat B: kosong, lalu impor ====================== */
const ctxB = await browser.createBrowserContext()
const B = await halaman(ctxB)
await B.goto(BASE, { waitUntil: 'networkidle2' })
await lewatSambutan(B)
await wait(2500)
cek('perangkat B benar-benar kosong: belum ada lagu',
  (await bacaTabel(B, 'songs')).length === 0)
cek('perangkat B kosong: belum ada drill',
  (await bacaTabel(B, 'drills')).length === 0)

await B.evaluate(() => { location.hash = '#/musik' })
await wait(2200)
const input = await B.$('[data-testid="berkas-repertoar"]')
await input.uploadFile(PATH)
await wait(1600)
cek('modal pratinjau terbuka', await ada(B, '[data-testid="modal-pratinjau-repertoar"]'))
cek('di perangkat kosong tidak ada peringatan timpa',
  !(await ada(B, '[data-testid="peringatan-timpa"]')))
cek('tidak ada peringatan rujukan hilang',
  !(await ada(B, '[data-testid="peringatan-rujukan"]')))

await klik(B, '[data-testid="terapkan-repertoar"]')
await wait(2000)

const laguB = await bacaTabel(B, 'songs')
const setlistB = await bacaTabel(B, 'setlists')
const drillB = await bacaTabel(B, 'drills')
const setB = await bacaTabel(B, 'sets')
cek('lagu masuk ke perangkat B', laguB.length === 2, `${laguB.length}`)
cek('set list masuk', setlistB.length === 1)
cek('drill masuk', drillB.length === 1)
cek('set drill masuk', setB.length === 2, `${setB.length}`)

/* -------------------- INTI: id tidak boleh berubah ----------------------- */
const idB = laguB.map((s) => s.id).sort()
const idA = isi.songs.map((s) => s.id).sort()
cek('ID LAGU TIDAK BERUBAH', JSON.stringify(idB) === JSON.stringify(idA),
  `${JSON.stringify(idB)} vs ${JSON.stringify(idA)}`)
cek('tautan drill → lagu tetap utuh', drillB[0]?.songId === LAGU_ID,
  `${drillB[0]?.songId}`)
cek('set list masih menunjuk ke lagu yang ada',
  (setlistB[0]?.songIds ?? []).every((id) => idB.includes(id)),
  JSON.stringify(setlistB[0]?.songIds))
// Bukti akhirnya: lagu yang ditaut drill benar-benar ketemu.
cek('lagu yang ditaut drill ada di perangkat B',
  idB.includes(drillB[0]?.songId), `${drillB[0]?.songId}`)

/* ================ Menimpa: ada peringatan, lalu menimpa ================= */
// Sunting judul lagu di perangkat B, lalu impor ulang berkas yang sama.
const judulDiubah = 'Judul yang disunting di perangkat B'
await tulisTabel(B, 'songs', [{ ...laguB.find((s) => s.id === LAGU_ID), title: judulDiubah }])
await B.reload({ waitUntil: 'networkidle2' })
await wait(2200)
await B.evaluate(() => { location.hash = '#/musik' })
await wait(2000)
const input2 = await B.$('[data-testid="berkas-repertoar"]')
await input2.uploadFile(PATH)
await wait(1600)
cek('peringatan timpa muncul kalau lagunya sudah ada',
  await ada(B, '[data-testid="peringatan-timpa"]'))
await klik(B, '[data-testid="terapkan-repertoar"]')
await wait(2000)
const laguB2 = await bacaTabel(B, 'songs')
cek('lagu yang sudah ada ditimpa isinya',
  laguB2.find((s) => s.id === LAGU_ID)?.title !== judulDiubah,
  laguB2.find((s) => s.id === LAGU_ID)?.title ?? '(hilang)')
cek('penimpaan tidak menggandakan lagu', laguB2.length === 2, `${laguB2.length}`)

/* ======================= Berkas yang bukan repertoar ===================== */
fs.writeFileSync(`${UNDUH}/bukan-repertoar.json`, JSON.stringify({ format: 'lain', songs: [] }))
await B.reload({ waitUntil: 'networkidle2' })
await wait(2200)
await B.evaluate(() => { location.hash = '#/musik' })
await wait(2000)
const input3 = await B.$('[data-testid="berkas-repertoar"]')
await input3.uploadFile(`${UNDUH}/bukan-repertoar.json`)
await wait(1500)
cek('berkas asing tidak membuka modal',
  !(await ada(B, '[data-testid="modal-pratinjau-repertoar"]')))
// #7 — berkas asing dialihkan ke pratinjau global "tak dikenali"; tutup lagi
// supaya klik berikutnya tidak terhalang overlay.
cek('berkas asing dialihkan ke pratinjau global',
  await ada(B, '[data-testid="modal-buka-berkas"]'))
cek('pratinjau menyebut tak dikenali',
  await ada(B, '[data-testid="buka-tak-dikenal"]'))
await klik(B, '[data-testid="buka-tutup"]')
await wait(600)

/* ====================== Titik pemasangan kedua ========================== */
await B.evaluate(() => { location.hash = '#/berbagi' })
await wait(2000)
cek('panel juga ada di halaman Berbagi', await ada(B, '[data-testid="tukar-repertoar"]'))
cek('ada tautan ke halaman Musik', await ada(B, '[data-testid="ke-halaman-musik"]'))
await klik(B, '[data-testid="ke-halaman-musik"]')
await wait(1800)
cek('tautan itu mengarah ke halaman Musik', B.url().includes('#/musik'), B.url())

/* ============================== Kebersihan =============================== */
cek('tidak ada error konsol', error.length === 0, error.slice(0, 3).join(' | '))

console.log('\n' + JSON.stringify({
  berkas: berkas[0],
  ukuranBerkas: fs.statSync(PATH).size,
  idLaguPerangkatA: idA,
  idLaguPerangkatB: idB,
  setlistB: setlistB[0]?.songIds,
  tautanDrill: drillB[0]?.songId,
  error: error.slice(0, 3),
}, null, 2))
console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) console.log('GAGAL:\n - ' + gagal.join('\n - '))
await browser.close()
if (gagal.length) process.exit(1)
