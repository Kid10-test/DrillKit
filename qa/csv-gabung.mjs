/**
 * Uji: impor CSV harus **menggabungkan**, bukan menggantikan.
 *
 * Cacat yang dikejar: berkas CSV hanya memuat sebagian kolom (id, judul,
 * jenis, tanggal, …). Kalau impor menulis ulang seluruh rekamannya, maka
 * kolom-kolom yang **tidak** ada di CSV ikut terhapus — padahal pemakai
 * tidak pernah memintanya dihapus.
 *
 * Alur yang memicunya sangat lazim: ekspor jadwal → sunting satu judul di
 * Excel → impor balik. Tanpa penggabungan, seluruh **materi latihan**
 * (`checklist`) dan **rencana latihan** (`rencanaLatihan`, hasil H1) pada
 * sesi itu lenyap, bersama catatan evaluasinya. Pemakai hanya melihat
 * judulnya berubah — persis seperti yang diinginkannya.
 *
 * Yang sama berlaku pada absensi: `checkInAt` (waktu benar-benar hadir)
 * tidak ada di CSV, jadi ia tidak boleh hilang karena statusnya disunting.
 */
import puppeteer from 'puppeteer'
import { lewatSambutan } from './sambutan.mjs'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.BASE || 'http://localhost:5173'
const BERKAS = '/home/user/drillkit/qa/berkas-gabung'
fs.rmSync(BERKAS, { recursive: true, force: true })
fs.mkdirSync(BERKAS, { recursive: true })

const browser = await puppeteer.launch({
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  defaultViewport: { width: 1280, height: 1100 },
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
const klik = async (sel) => { await p.waitForSelector(sel, { timeout: 10000 }); await p.click(sel) }
const tombol = (t) =>
  p.evaluate((x) => {
    const b = [...document.querySelectorAll('button')].find((y) => y.textContent.includes(x))
    if (!b || b.disabled) return false
    b.click()
    return true
  }, t)
const baca = (tabel, id) =>
  p.evaluate(async ([t, i]) => {
    const r = await new Promise((res) => { const q = indexedDB.open('drillkit'); q.onsuccess = () => res(q.result) })
    return await new Promise((res) => {
      const tx = r.transaction([t], 'readonly')
      const q = tx.objectStore(t).get(i)
      q.onsuccess = () => res(q.result)
    })
  }, [tabel, id])

await p.goto(BASE, { waitUntil: 'networkidle2' })
await lewatSambutan(p)
await wait(1500)
await tombol('Muat data contoh')
await wait(4000)

// Sesi dengan materi latihan, rencana latihan (H1), realisasi, dan catatan.
await p.evaluate(async () => {
  const r = await new Promise((res) => { const q = indexedDB.open('drillkit'); q.onsuccess = () => res(q.result) })
  const kini = Date.now()
  const tx = r.transaction(['sessions', 'attendance'], 'readwrite')
  tx.objectStore('sessions').put({
    id: 's_gabung', title: 'Latihan Rutin — sebelum disunting', type: 'latihan',
    date: '2026-10-03', startTime: '15:30', endTime: '17:00', place: 'Lapangan A',
    notes: 'Catatan evaluasi yang tidak boleh hilang.',
    checklist: [
      { id: 'c1', text: 'Seragam lengkap', done: 1 },
      { id: 'c2', text: 'Alat dicek', done: 0 },
    ],
    createdAt: kini,
    rencanaLatihan: [
      { id: 'b1', judul: 'Pemanasan', jenis: 'pemanasan', menit: 15 },
      { id: 'b2', judul: 'Section Brass', jenis: 'section', menit: 30 },
    ],
    realisasiLatihan: [{ id: 'b1', mulai: kini - 900000, selesai: kini - 60000 }],
  })
  tx.objectStore('attendance').put({
    id: 'a_gabung', sessionId: 's_gabung', memberId: 'm_gabung',
    status: 'hadir', checkInAt: 1700000000000, note: 'Catatan absensi',
  })
  await new Promise((res) => { tx.oncomplete = res })
})
await p.reload({ waitUntil: 'networkidle2' })
await wait(2500)

const sebelum = await baca('sessions', 's_gabung')
cek('fixture sesi lengkap', sebelum?.checklist?.length === 2 && sebelum?.rencanaLatihan?.length === 2,
  JSON.stringify({ c: sebelum?.checklist?.length, r: sebelum?.rencanaLatihan?.length }))

// ============================================================ JADWAL: sunting judul
const csv = [
  'id,judul,jenis,tanggal,mulai,selesai,tempat,setListId',
  's_gabung,Latihan Rutin — sesudah disunting,latihan,2026-10-03,15:30,17:00,Lapangan A,',
].join('\n')
const jalur = path.join(BERKAS, 'jadwal.csv')
fs.writeFileSync(jalur, csv)

await p.evaluate(() => { location.hash = '#/data' })
await wait(2000)
await klik('[data-testid="alur-csv"]')
await wait(1200)
await (await p.$('[data-testid="csv-masuk"]')).uploadFile(jalur)
await wait(2000)
await klik('[data-testid="terapkan-csv"]')
await wait(2500)

const sesudah = await baca('sessions', 's_gabung')
cek('judul berubah sesuai CSV', sesudah?.title === 'Latihan Rutin — sesudah disunting', String(sesudah?.title))
// --- INTI
cek('MATERI LATIHAN tidak hilang', sesudah?.checklist?.length === 2, JSON.stringify(sesudah?.checklist))
cek('isi materi latihan utuh', sesudah?.checklist?.[0]?.text === 'Seragam lengkap')
cek('RENCANA LATIHAN (H1) tidak hilang', sesudah?.rencanaLatihan?.length === 2,
  JSON.stringify(sesudah?.rencanaLatihan))
cek('REALISASI latihan tidak hilang', sesudah?.realisasiLatihan?.length === 1,
  JSON.stringify(sesudah?.realisasiLatihan))
cek('catatan evaluasi tidak hilang', sesudah?.notes === 'Catatan evaluasi yang tidak boleh hilang.',
  String(sesudah?.notes))
cek('createdAt tidak diubah', sesudah?.createdAt === sebelum?.createdAt)

// ======================================================== ABSENSI: sunting status
await klik('[data-testid="csv-absensi"]')
await wait(800)
const csvAbs = [
  'id,sessionId,memberId,status,catatan',
  'a_gabung,s_gabung,m_gabung,izin,Catatan disunting',
].join('\n')
const jalurAbs = path.join(BERKAS, 'absensi.csv')
fs.writeFileSync(jalurAbs, csvAbs)
await (await p.$('[data-testid="csv-masuk"]')).uploadFile(jalurAbs)
await wait(2000)
await klik('[data-testid="terapkan-csv"]')
await wait(2500)

const abs = await baca('attendance', 'a_gabung')
cek('status absensi berubah', abs?.status === 'izin', String(abs?.status))
cek('catatan absensi berubah', abs?.note === 'Catatan disunting')
// --- INTI: waktu check-in tidak ada di CSV, jadi tidak boleh hilang.
cek('WAKTU CHECK-IN tidak hilang', abs?.checkInAt === 1700000000000, String(abs?.checkInAt))

// ================================================ BARIS BARU: tanpa id → dibuat baru
const csvBaru = [
  'id,judul,jenis,tanggal,mulai,selesai,tempat,setListId',
  ',Sesi Baru Tanpa Id,latihan,2026-10-05,09:00,10:00,Lapangan C,',
].join('\n')
await klik('[data-testid="csv-jadwal"]')
await wait(600)
const jalurBaru = path.join(BERKAS, 'baru.csv')
fs.writeFileSync(jalurBaru, csvBaru)
await (await p.$('[data-testid="csv-masuk"]')).uploadFile(jalurBaru)
await wait(2000)
await klik('[data-testid="terapkan-csv"]')
await wait(2500)

const semua = await p.evaluate(async () => {
  const r = await new Promise((res) => { const q = indexedDB.open('drillkit'); q.onsuccess = () => res(q.result) })
  return await new Promise((res) => {
    const tx = r.transaction(['sessions'], 'readonly')
    const q = tx.objectStore('sessions').getAll()
    q.onsuccess = () => res(q.result)
  })
})
cek('baris tanpa id dibuat baru', semua.some((s) => s.title === 'Sesi Baru Tanpa Id'))

cek('tidak ada error konsol', errors.length === 0, errors.slice(0, 3).join(' | '))

fs.rmSync(BERKAS, { recursive: true, force: true })
console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) {
  console.log('GAGAL:\n - ' + gagal.join('\n - '))
  await browser.close()
  process.exit(1)
}
await browser.close()
console.log('selesai')
