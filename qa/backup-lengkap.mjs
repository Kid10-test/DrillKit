/**
 * Uji regresi: **setiap tabel harus ikut dalam backup.**
 *
 * Cacat yang memicu uji ini: backup tidak menyertakan `setlists` (M3), jadi
 * memulihkan dari backup menghilangkan seluruh set list. Cacat itu muncul
 * lagi — kali ini hampir — saat H2 menambah tabel `evaluasi`.
 *
 * Menguji tabel satu per satu tidak akan pernah menutupnya: tabel yang baru
 * ditambah tidak tercantum di mana pun, jadi tidak ada yang ingat
 mengujinya. Karena itu uji ini membaca **daftar tabel langsung dari basis
 * data**, lalu menuntut setiap tabel (kecuali yang memang dikecualikan)
 * muncul di berkas backup. Menambah tabel baru tanpa mendaftarkannya di
 * backup akan langsung membuat uji ini gagal.
 *
 * Dikecualikan, dengan alasan:
 * - `settings` — ditangani terpisah (`db.settings.put`), bukan bulkPut.
 * - `packages` — salinan paket berbagi di perangkat ANGGOTA, bukan data
 *   pelatih; menyertakannya akan membuat backup perangkat anggota berisi
 *   data yang bukan miliknya.
 */
import puppeteer from 'puppeteer'
import { lewatSambutan } from './sambutan.mjs'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.BASE || 'http://localhost:5173'
const UNDUH = '/home/user/drillkit/qa/unduhan-lengkap'
fs.rmSync(UNDUH, { recursive: true, force: true })
fs.mkdirSync(UNDUH, { recursive: true })

const DIKECUALIKAN = new Set(['settings', 'packages'])

const browser = await puppeteer.launch({
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  defaultViewport: { width: 1280, height: 1000 },
})
const p = await browser.newPage()
const errors = []
p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
p.on('pageerror', (e) => errors.push(String(e)))

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
await lewatSambutan(p)
await wait(1500)
await tombol('Muat data contoh')
await wait(4000)
await p.reload({ waitUntil: 'networkidle2' })
await wait(2500)

// 1. Baca daftar tabel langsung dari IndexedDB — sumber kebenarannya.
const tabel = await p.evaluate(async () => {
  const r = await new Promise((res) => { const q = indexedDB.open('drillkit'); q.onsuccess = () => res(q.result) })
  return [...r.objectStoreNames]
})
cek('daftar tabel terbaca', tabel.length > 0, JSON.stringify(tabel))
const wajib = tabel.filter((t) => !DIKECUALIKAN.has(t))
console.log('tabel di db:', tabel.join(', '))
console.log('yang wajib ikut backup:', wajib.join(', '))

// 2. Ekspor backup.
await p.evaluate(() => { location.hash = '#/pengaturan' })
await wait(2000)
await tombol('Ekspor backup')

let berkas = null
for (let i = 0; i < 60 && !berkas; i += 1) {
  await wait(250)
  const f = fs.readdirSync(UNDUH).filter((x) => x.endsWith('.json'))
  if (f.length) berkas = path.join(UNDUH, f[0])
}
if (!berkas) console.log('DIAGNOSA isi folder:', JSON.stringify(fs.readdirSync(UNDUH)))
if (!berkas) console.log('DIAGNOSA tombol ada:', await p.evaluate(() => [...document.querySelectorAll('button')].map((b) => b.textContent.trim()).slice(0, 12)))
if (!berkas) console.log('DIAGNOSA hash:', await p.evaluate(() => location.hash))
cek('berkas backup terunduh', berkas != null, berkas ?? 'tidak ada')
if (!berkas) { await browser.close(); process.exit(1) }

const isi = JSON.parse(fs.readFileSync(berkas, 'utf8'))
cek('formatnya drillkit-backup', isi.format === 'drillkit-backup', isi.format)

// 3. INTI: setiap tabel wajib punya kunci di berkas backup.
const hilang = wajib.filter((t) => !(t in isi))
cek('SETIAP tabel punya kunci di backup', hilang.length === 0,
  hilang.length ? `tidak ada: ${hilang.join(', ')}` : '')

for (const t of wajib) {
  cek(`kunci "${t}" berbentuk daftar`, Array.isArray(isi[t]), typeof isi[t])
}
cek('settings ikut tersimpan walau dikecualikan dari daftar wajib', isi.settings != null)
cek('settings punya kunci "team"', isi.settings?.key === 'team', JSON.stringify(isi.settings?.key))

// 4. Kosongkan satu tabel yang baru (evaluasi), lalu pulihkan.
const adaEvaluasi = wajib.includes('evaluasi')
if (adaEvaluasi) {
  await p.evaluate(async () => {
    const r = await new Promise((res) => { const q = indexedDB.open('drillkit'); q.onsuccess = () => res(q.result) })
    const tx = r.transaction(['evaluasi'], 'readwrite')
    tx.objectStore('evaluasi').put({
      id: 'ev_uji', memberId: 'm_uji', tanggal: '2026-09-01',
      nilai: { teknik: 4 }, oleh: 'Pelatih', createdAt: 1,
    })
    await new Promise((res) => { tx.oncomplete = res })
  })
  await p.reload({ waitUntil: 'networkidle2' })
  await wait(2200)
  await p.evaluate(() => { location.hash = '#/pengaturan' })
  await wait(1800)
  // Ekspor ulang supaya evaluasinya ikut — dan TUNGGU berkasnya mendarat.
  // Tanpa penantian ini, pemindaian terjadi sebelum unduhan selesai dan
  // berkasnya ketemu null, yang gagalnya jauh di bawah dengan pesan path.
  await tombol('Ekspor backup')
  let berkas2 = null
  for (let i = 0; i < 60 && !berkas2; i += 1) {
    await wait(250)
    for (const f of fs.readdirSync(UNDUH)) {
      if (!f.endsWith('.json')) continue
      const j = path.join(UNDUH, f)
      try {
        if (JSON.parse(fs.readFileSync(j, 'utf8')).evaluasi?.some((e) => e.id === 'ev_uji')) berkas2 = j
      } catch {}
    }
  }
  cek('evaluasi ikut tersimpan di backup', berkas2 != null)
  if (!berkas2) {
    console.log('GAGAL: berkas backup kedua tidak ketemu')
    await browser.close()
    process.exit(1)
  }

  // Kosongkan, lalu pulihkan.
  await p.evaluate(async () => {
    const r = await new Promise((res) => { const q = indexedDB.open('drillkit'); q.onsuccess = () => res(q.result) })
    const tx = r.transaction(['evaluasi'], 'readwrite')
    tx.objectStore('evaluasi').clear()
    await new Promise((res) => { tx.oncomplete = res })
  })
  await p.reload({ waitUntil: 'networkidle2' })
  await wait(2200)
  await p.evaluate(() => { location.hash = '#/pengaturan' })
  await wait(1800)
  const sebelum = await p.evaluate(async () => {
    const r = await new Promise((res) => { const q = indexedDB.open('drillkit'); q.onsuccess = () => res(q.result) })
    return await new Promise((res) => {
      const tx = r.transaction(['evaluasi'], 'readonly')
      const q = tx.objectStore('evaluasi').count()
      q.onsuccess = () => res(q.result)
    })
  })
  cek('evaluasi benar-benar kosong sebelum dipulihkan', sebelum === 0, String(sebelum))

  await (await p.$('#restore-input')).uploadFile(berkas2)
  await wait(3000)
  const sesudah = await p.evaluate(async () => {
    const r = await new Promise((res) => { const q = indexedDB.open('drillkit'); q.onsuccess = () => res(q.result) })
    return await new Promise((res) => {
      const tx = r.transaction(['evaluasi'], 'readonly')
      const q = tx.objectStore('evaluasi').getAll()
      q.onsuccess = () => res(q.result)
    })
  })
  cek('evaluasi pulih setelah impor', sesudah.some((e) => e.id === 'ev_uji'), JSON.stringify(sesudah.map((e) => e.id)))
  cek('nilai evaluasi pulih utuh', sesudah.find((e) => e.id === 'ev_uji')?.nilai?.teknik === 4)
}

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
