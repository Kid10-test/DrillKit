/**
 * Uji G1 — run sheet hari lomba di peramban.
 *
 * Yang diuji bukan sekadar "halaman bisa dibuka", melainkan tiga hal yang
 * membuatnya berguna:
 *
 * 1. **Penilaian muat/tidak muat lewat antarmuka sungguhan** — tautan set
 *    list dipilih dari dropdown yang baru, bukan disuntik ke basis data.
 * 2. **Lembar cetaknya benar-benar berisi datanya.** Run sheet pada hari
 *    lomba dipakai sebagai kertas; kalau cetakannya kosong atau tidak
 *    memuat peringatan, fiturnya sia-sia. Karena itu berkas unduhannya
 *    ditangkap dan diperiksa isinya.
 * 3. Tautan set list tersimpan lintas muat.
 */
import puppeteer from 'puppeteer'
import { lewatSambutan } from './sambutan.mjs'
import fs from 'node:fs'

const BASE = process.env.BASE || 'http://localhost:5173'
const UNDUH = '/tmp/unduh-runsheet'
fs.rmSync(UNDUH, { recursive: true, force: true })
fs.mkdirSync(UNDUH, { recursive: true })

const browser = await puppeteer.launch({
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  defaultViewport: { width: 1440, height: 1000 },
})
const p = await browser.newPage()
const error = []
p.on('console', (m) => { if (m.type() === 'error') error.push(m.text()) })
p.on('pageerror', (e) => error.push(String(e)))
const cdp = await p.createCDPSession()
await cdp.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: UNDUH })

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

/* =========================== Persiapan data ============================= */
await p.goto(BASE, { waitUntil: 'networkidle2' })
await lewatSambutan(p)
await wait(1500)
await tombol('Muat data contoh')
await wait(4000)

const info = await p.evaluate(async () => {
  const r = await new Promise((res) => {
    const q = indexedDB.open('drillkit')
    q.onsuccess = () => res(q.result)
  })
  const baca = (n) => new Promise((res) => {
    const q = r.transaction(n, 'readonly').objectStore(n).getAll()
    q.onsuccess = () => res(q.result)
  })
  const [sessions, songs] = await Promise.all([baca('sessions'), baca('songs')])
  const tampil = sessions.find((s) => s.type === 'penampilan')
  // Dua lagu BARU yang benar-benar bersih, bukan lagu contoh: lagu contoh
  // punya tempo map sendiri, jadi durasinya tidak bisa ditebak dari luar.
  // 32 birama @ 120 BPM, 4/4 = 64 detik per lagu → total 128 detik (2:08).
  const bersih = (id, title) => ({
    id, title, bpm: 120, beats: 4, tempoMap: [],
    createdAt: Date.now(), panjangBirama: 32,
  })
  const tx = r.transaction(['songs', 'setlists'], 'readwrite')
  tx.objectStore('songs').put(bersih('song_rs_a', 'Uji — Pembuka'))
  tx.objectStore('songs').put(bersih('song_rs_b', 'Uji — Balada'))
  tx.objectStore('setlists').put({
    id: 'sl_runsheet', name: 'Show Uji 2026',
    songIds: ['song_rs_a', 'song_rs_b'], createdAt: 1, updatedAt: 1,
  })
  await new Promise((res) => { tx.oncomplete = res })
  return { idTampil: tampil.id, tanggal: tampil.date, judul: tampil.title }
})
const TGL = info.tanggal
cek('data contoh punya sesi penampilan', Boolean(info.idTampil), JSON.stringify(info))

// WAJIB dimuat ulang setelah menulis fixture. useLiveQuery milik Dexie hanya
// bereaksi pada perubahan yang lewat Dexie sendiri — tulisan IndexedDB mentah
// dari koneksi lain tidak memicunya, jadi tampilan akan terus memakai data
// lama tanpa reload.
await p.reload({ waitUntil: 'networkidle2' })
await wait(3000)

/* ===================== 1. Buka halaman run sheet ======================== */
await p.evaluate(() => { location.hash = '#/lomba' })
await wait(2600)
cek('halaman run sheet terbuka', await ada('[data-testid="pilih-tanggal"]'))
cek('tanggal terisi otomatis', (await p.$eval('[data-testid="pilih-tanggal"]', (e) => e.value)).length === 10)

// Arahkan ke tanggal sesi penampilan.
await p.evaluate((t) => {
  const el = document.querySelector('[data-testid="pilih-tanggal"]')
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
  set.call(el, t)
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
}, TGL)
await wait(1500)

const baris = `[data-testid="baris-run-${info.idTampil}"]`
cek('baris sesi penampilan tampil', await ada(baris))
cek('awalnya belum ada set list', (await atribut(baris, 'data-status')) === 'tanpaIsi',
  await atribut(baris, 'data-status'))
cek('dropdown set list tersedia', await ada(`[data-testid="setlist-${info.idTampil}"]`))
cek('nama set list ada di pilihan',
  await p.$eval(`[data-testid="setlist-${info.idTampil}"]`, (e) =>
    [...e.options].some((o) => o.textContent.includes('Show Uji 2026'))))

/* ============== 2. Tautkan set list lewat antarmuka ==================== */
await p.select(`[data-testid="setlist-${info.idTampil}"]`, 'sl_runsheet')
await wait(1500)
cek('setelah ditautkan, statusnya cukup (128 detik di slot 4 jam)',
  (await atribut(baris, 'data-status')) === 'cukup', await atribut(baris, 'data-status'))
const isi = await teks('[data-testid="ringkasan-isi"]')
cek('ringkasan isi menunjukkan 2:08', isi.includes('2:08'), isi)
cek('tidak ada peringatan selama muat',
  !(await ada('[data-testid="daftar-peringatan"]')))

/* ================ 3. Persempit slot → harus "TIDAK MUAT" =============== */
await p.evaluate((id) => new Promise((res) => {
  const r = indexedDB.open('drillkit')
  r.onsuccess = () => {
    const tx = r.result.transaction('sessions', 'readwrite')
    const os = tx.objectStore('sessions')
    const q = os.get(id)
    q.onsuccess = () => os.put({ ...q.result, startTime: '08:00', endTime: '08:01' })
    tx.oncomplete = res
  }
}), info.idTampil)
await p.reload({ waitUntil: 'networkidle2' })
await wait(3200)
await p.evaluate(() => { location.hash = '#/lomba' })
await wait(2600)
await p.evaluate((t) => {
  const el = document.querySelector('[data-testid="pilih-tanggal"]')
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
  set.call(el, t)
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
}, TGL)
await wait(1500)

cek('slot 1 menit tidak cukup untuk isi 128 detik',
  (await atribut(baris, 'data-status')) === 'melebihi', await atribut(baris, 'data-status'))
const daftarPeringatan = await ada('[data-testid="daftar-peringatan"]')
  ? await teks('[data-testid="daftar-peringatan"]') : ''
cek('peringatan muncul', daftarPeringatan.includes('lebih panjang dari slot'),
  daftarPeringatan.slice(0, 160))
cek('jumlah peringatan terhitung',
  Number((await teks('[data-testid="ringkasan-peringatan"]')).replace(/\D/g, '')) >= 1)

/* ============== 4. Unduh & periksa lembar cetaknya ===================== */
await klik('[data-testid="unduh-runsheet"]')
await wait(2200)
const berkas = fs.readdirSync(UNDUH).filter((f) => f.endsWith('.html'))
cek('berkas run sheet terunduh', berkas.length === 1, JSON.stringify(fs.readdirSync(UNDUH)))
if (berkas.length) {
  const html = fs.readFileSync(`${UNDUH}/${berkas[0]}`, 'utf8')
  cek('lembar memuat nama tim', html.includes('Marching Band') || html.length > 500)
  cek('lembar memuat judul sesi', html.includes('Penampilan'), html.slice(0, 200))
  cek('lembar memuat nama set list', html.includes('Show Uji 2026'))
  cek('lembar memuat peringatan', html.includes('lebih panjang dari slot'))
  cek('lembar menandai baris yang tak muat', html.includes('class="melebihi"'))
}

/* ============ 5. Bentrok: dua sesi waktunya tumpang-tindih ============= */
await p.evaluate((id) => new Promise((res) => {
  const r = indexedDB.open('drillkit')
  r.onsuccess = () => {
    const tx = r.result.transaction('sessions', 'readwrite')
    const os = tx.objectStore('sessions')
    const q = os.get(id)
    q.onsuccess = () => {
      const s = q.result
      os.put({ ...s, startTime: '08:00', endTime: '09:00' })
      os.put({
        id: 's_bentrok', title: 'Pemanasan Bentrok', type: 'latihan', date: s.date,
        startTime: '08:30', endTime: '08:50', checklist: [], createdAt: Date.now(),
      })
    }
    tx.oncomplete = res
  }
}), info.idTampil)
await p.reload({ waitUntil: 'networkidle2' })
await wait(3200)
await p.evaluate(() => { location.hash = '#/lomba' })
await wait(2600)
await p.evaluate((t) => {
  const el = document.querySelector('[data-testid="pilih-tanggal"]')
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
  set.call(el, t)
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
}, TGL)
await wait(1500)

const peringatan2 = await ada('[data-testid="daftar-peringatan"]')
  ? await teks('[data-testid="daftar-peringatan"]') : ''
cek('bentrok terdeteksi di antarmuka', peringatan2.includes('tumpang-tindih'),
  peringatan2.slice(0, 200))
cek('baris bentrok ditandai', await ada('[data-testid="baris-run-s_bentrok"]'))

/* ==================== 6. Tautan tersimpan lintas muat ================== */
await p.reload({ waitUntil: 'networkidle2' })
await wait(3200)
await p.evaluate(() => { location.hash = '#/lomba' })
await wait(2600)
await p.evaluate((t) => {
  const el = document.querySelector('[data-testid="pilih-tanggal"]')
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
  set.call(el, t)
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
}, TGL)
await wait(1500)
cek('tautan set list tersimpan setelah dimuat ulang',
  await p.$eval(`[data-testid="setlist-${info.idTampil}"]`, (e) => e.value) === 'sl_runsheet',
  await p.$eval(`[data-testid="setlist-${info.idTampil}"]`, (e) => e.value))

/* ========================== 7. Kebersihan ============================== */
cek('tidak ada error konsol', error.length === 0, error.slice(0, 3).join(' | '))

console.log('\n' + JSON.stringify({
  tanggal: TGL,
  idSesi: info.idTampil,
  jumlahPeringatan: await teks('[data-testid="ringkasan-peringatan"]').catch(() => '-'),
  error: error.slice(0, 3),
}, null, 2))
console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) console.log('GAGAL:\n - ' + gagal.join('\n - '))
await browser.close()
if (gagal.length) process.exit(1)
