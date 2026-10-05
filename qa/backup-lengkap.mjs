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
 * Sejak 2a, setiap tabel itu juga harus PULIH dari berkasnya (langkah 5),
 * bukan hanya tersimpan: tersimpan-tapi-tidak-pulih sama buruknya.
 *
 * Dikecualikan, dengan alasan:
 * - `settings` — ditangani terpisah (`db.settings.put`), bukan bulkPut.
 * - `packages` — salinan paket berbagi di perangkat ANGGOTA, bukan data
 *   pelatih; menyertakannya akan membuat backup perangkat anggota berisi
 *   data yang bukan miliknya.
 * - `simpanan` (1b) — pegangan berkas/folder File System Access untuk simpan
 *   otomatis. Pegangan hanya berlaku di browser yang membuatnya dan tidak
 *   bisa ditulis ke JSON; di perangkat lain isinya tidak berarti apa pun.
 * - `riwayat` (1a) — foto keadaan untuk undo, milik perangkat. Diputuskan
 *   di 2a (24 Sep 2026) untuk TIDAK ikut backup: berkas backup memuat
 *   keadaan terkini, sedangkan riwayat bisa beberapa MB per drill dan akan
 *   ikut tertulis di setiap simpan otomatis (±15 menit). Pemulihan backup
 *   hanya menimpa tabel yang ada di berkas (bulkPut, tanpa clear), jadi
 *   riwayat dan simpanan di perangkat tetap utuh setelah backup dipulihkan.
 *   Bila kelak riwayat mau ikut backup, hapus dari daftar ini SEKALIGUS
 *   tambahkan ke `buildBackupPayload` dan ke transaksi `importBackup`.
 * - `rekamanAudio` (6) — berkas biner audio MP3/WAV/dll berukuran besar
 *   (bisa puluhan MB), sengaja tidak dimasukkan ke dalam JSON teks sesuai
 *   rancangan #6. Ditangani terpisah via "Backup + rekaman (ZIP)".
 */
import puppeteer from 'puppeteer'
import { lewatSambutan } from './sambutan.mjs'
import fs from 'node:fs'
import path from 'node:path'
import { QA } from './lokasi.mjs'

const BASE = process.env.BASE || 'http://localhost:5173'
const UNDUH = path.join(QA, 'unduhan-lengkap')
fs.rmSync(UNDUH, { recursive: true, force: true })
fs.mkdirSync(UNDUH, { recursive: true })

const DIKECUALIKAN = new Set(['settings', 'packages', 'simpanan', 'riwayat', 'rekamanAudio'])

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

/*
 * #7 — pemulihan backup kini selalu lewat PRATINJAU: unggah berkas hanya
 * membuka modal, belum menulis apa pun. Klik "Lanjut"; bila backup memuat
 * anggota yang belum dikenal, muncul langkah pencocokan dan tombolnya
 * diklik sekali lagi ("Pulihkan sekarang").
 */
const klikPulih = async () => {
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
}

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
  await klikPulih()
  await wait(1000)
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

// 5. SETIAP tabel wajib harus PULIH, bukan hanya tersimpan.
//
// Langkah 3 hanya memastikan kuncinya ada di berkas, dan itu belum menjamin
// pemulihannya. `importBackup` menulis semua tabel dalam SATU transaksi
// Dexie. Tabel yang dipakai tanpa tercantum di cakupan transaksi melempar
// NotFound, sehingga seluruh pemulihan batal dan tidak satu tabel pun pulih.
// Itu yang terjadi pada `memberNotes` (catatan anggota), ditemukan di 2a
// (24 Sep 2026): data contoh tidak punya catatan, jadi tidak ada uji yang
// pernah memulihkannya.
//
// Karena itu, di setiap tabel wajib ditandai satu baris: baris yang sudah
// ada, atau baris uji bila tabelnya kosong. Backup diekspor, baris-baris itu
// dihapus, backup dipulihkan, dan setiap baris harus kembali. Tabel yang
// kelak ditambahkan ikut teruji tanpa perlu diingat.
const tanda = await p.evaluate(async (daftar) => {
  const r = await new Promise((res) => { const q = indexedDB.open('drillkit'); q.onsuccess = () => res(q.result) })
  const hasil = []
  for (const t of daftar) {
    const s0 = r.transaction([t], 'readonly').objectStore(t)
    const kp = s0.keyPath
    const ada = await new Promise((res) => { const q = s0.getAllKeys(null, 1); q.onsuccess = () => res(q.result[0]) })
    if (ada !== undefined) { hasil.push({ t, kp, kunci: ada, ditanam: false }); continue }
    // Tabel kosong: tanam satu baris uji. IndexedDB hanya mewajibkan
    // kuncinya; indeks yang kolomnya tidak ada dilewati begitu saja.
    const k = 'uji_pulih_' + t
    const baris = { memberId: 'm_uji', at: 1, createdAt: 1, tanggal: '2026-09-01', text: 'uji pulih' }
    let kunci = k
    if (typeof kp === 'string') baris[kp] = k
    else if (Array.isArray(kp)) { for (const x of kp) baris[x] = k; kunci = kp.map(() => k) }
    const tx = r.transaction([t], 'readwrite')
    if (kp == null) tx.objectStore(t).put(baris, k)
    else tx.objectStore(t).put(baris)
    await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error) })
    hasil.push({ t, kp, kunci, ditanam: true })
  }
  return hasil
}, wajib)
console.log('baris yang ditandai:', tanda.map((x) => x.t + (x.ditanam ? ' (ditanam)' : '')).join(', '))
cek('setiap tabel wajib punya satu baris yang ditandai', tanda.length === wajib.length,
  `${tanda.length}/${wajib.length}`)

const adaBaris = () => p.evaluate(async (daftar) => {
  const r = await new Promise((res) => { const q = indexedDB.open('drillkit'); q.onsuccess = () => res(q.result) })
  const hasil = {}
  for (const x of daftar) {
    hasil[x.t] = await new Promise((res) => {
      const q = r.transaction([x.t], 'readonly').objectStore(x.t).get(x.kunci)
      q.onsuccess = () => res(q.result !== undefined)
    })
  }
  return hasil
}, tanda)
const bukaPengaturan = async () => {
  await p.reload({ waitUntil: 'networkidle2' })
  await wait(2200)
  await p.evaluate(() => { location.hash = '#/pengaturan' })
  await wait(1800)
}

await bukaPengaturan()
for (const f of fs.readdirSync(UNDUH)) fs.rmSync(path.join(UNDUH, f), { force: true })
await tombol('Ekspor backup')
let berkas3 = null
let isi3 = null
for (let i = 0; i < 60 && !berkas3; i += 1) {
  await wait(250)
  for (const f of fs.readdirSync(UNDUH).filter((x) => x.endsWith('.json'))) {
    try {
      isi3 = JSON.parse(fs.readFileSync(path.join(UNDUH, f), 'utf8'))
      berkas3 = path.join(UNDUH, f)
    } catch {}
  }
}
cek('berkas backup ketiga terunduh', berkas3 != null)
if (!berkas3) {
  console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
  console.log('GAGAL:\n - ' + gagal.join('\n - '))
  await browser.close()
  process.exit(1)
}
const kunciDari = (b, kp) => (Array.isArray(kp) ? kp.map((x) => b?.[x]) : b?.[kp])
const takTersimpan = tanda
  .filter((x) => !(isi3[x.t] ?? []).some((b) => JSON.stringify(kunciDari(b, x.kp)) === JSON.stringify(x.kunci)))
  .map((x) => x.t)
cek('setiap baris yang ditandai ada di berkas backup', takTersimpan.length === 0, takTersimpan.join(', '))

await p.evaluate(async (daftar) => {
  const r = await new Promise((res) => { const q = indexedDB.open('drillkit'); q.onsuccess = () => res(q.result) })
  for (const x of daftar) {
    const tx = r.transaction([x.t], 'readwrite')
    tx.objectStore(x.t).delete(x.kunci)
    await new Promise((res) => { tx.oncomplete = res })
  }
}, tanda)
await bukaPengaturan()
const masihAda = Object.entries(await adaBaris()).filter(([, v]) => v).map(([t]) => t)
cek('baris yang ditandai benar-benar terhapus sebelum dipulihkan', masihAda.length === 0, masihAda.join(', '))

await (await p.$('#restore-input')).uploadFile(berkas3)
/*
 * N19 — sejak #1 (satu anggota, dua nama) pemulihan **sengaja bertanya** dulu
 * bila backup memuat anggota yang belum ada di perangkat ini (langkah
 * pencocokan di dalam pratinjau #7). Dulu uji ini menunggu toast yang tidak
 * akan pernah muncul, lalu melaporkan 11 kegagalan "baris tidak pulih" —
 * padahal pemulihannya sendiri belum dijalankan. `klikPulih` mengeklik
 * "Lanjut" lalu "Pulihkan sekarang" bila langkah pencocokan muncul, yaitu
 * keputusan bawaan yang sama dengan yang diambil pelatih kalau ia tidak
 * mengubah apa pun.
 */
await klikPulih()
// Toast hanya tampil beberapa detik — tangkap selagi ada.
let pesan = ''
for (let i = 0; i < 40 && !pesan; i += 1) {
  await wait(100)
  pesan = await p.evaluate(() => {
    const t = document.body.innerText
    if (t.includes('Gagal memulihkan backup')) return 'Gagal memulihkan backup'
    return t.includes('Backup dipulihkan') ? 'Backup dipulihkan' : ''
  })
}
cek('pemulihan melapor "Backup dipulihkan"', pesan === 'Backup dipulihkan', pesan || 'tidak ada pesan')
await wait(1500)
const pulih = await adaBaris()
for (const x of tanda) {
  cek(`baris "${x.t}" pulih dari backup${x.ditanam ? ' (baris uji)' : ''}`, pulih[x.t] === true)
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
