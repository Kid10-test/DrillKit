/**
 * Diagnosa: apa yang dilihat anggota di tab **Absensi** dan **Catatan**.
 *
 * Belum pernah diperiksa isinya — yang diuji selama ini hanya berkasnya.
 * Dua hal yang dicurigai dari membaca kodenya, keduanya harus dibuktikan
 * dengan data nyata sebelum dinilai:
 *
 *   1. Persentase kehadiran dihitung dari sesi yang **tercatat** saja,
 *      jadi sesi yang tidak dicatat pelatih tidak ikut menjadi penyebut.
 *   2. Tab Catatan kosong bila pelatih belum menulis catatan.
 *
 * Tidak ada asersi. Semua dicetak apa adanya.
 */
import puppeteer from 'puppeteer'
import { lewatSambutan } from './sambutan.mjs'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const BASE = process.env.BASE || 'http://localhost:4173'
const UNDUH = path.join(os.tmpdir(), `unduh-tab-${Date.now()}`)
const BUKA = path.join(os.tmpdir(), `buka-tab-${Date.now()}`)
fs.mkdirSync(UNDUH, { recursive: true })
fs.mkdirSync(BUKA, { recursive: true })

const browser = await puppeteer.launch({
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  defaultViewport: { width: 1300, height: 1000 },
})
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const bersih = (t) => (t ?? '').replace(/\s*\n\s*/g, ' | ').trim()

/* ------------------------------- pelatih ---------------------------------- */
const A = await browser.newPage()
A.on('dialog', async (d) => { await d.accept() })
await A.goto(BASE, { waitUntil: 'networkidle2' })
await lewatSambutan(A)
await wait(1200)
await A.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((y) => y.textContent.includes('Muat data contoh'))
  if (b) b.click()
})
await wait(4000)

// Suntikkan catatan pelatih untuk Andra supaya tab Catatan terisi, dan
// tandai satu sesi sebagai IZIN supaya persentasenya tidak selalu 100%.
const SUNTIK = await A.evaluate(async () => {
  const db = await new Promise((res) => { const q = indexedDB.open('drillkit'); q.onsuccess = () => res(q.result) })
  const baca = (nama) => new Promise((res) => {
    const q = db.transaction([nama], 'readonly').objectStore(nama).getAll()
    q.onsuccess = () => res(q.result)
  })
  const anggota = await baca('members')
  const sesi = await baca('sessions')
  const andra = anggota.find((m) => /Andra/.test(m.name))
  const s = Date.now()
  const absen = (sesi.slice(0, 3)).map((x, i) => ({
    id: `at_andra_${i}`, sessionId: x.id, memberId: andra.id,
    status: i === 2 ? 'izin' : 'hadir', at: s, source: 'manual',
  }))
  const catatan = [
    { id: 'n1', memberId: andra.id, at: s - 86400000, by: 'Pelatih', text: 'Jaga jarak 8-to-5 saat pivot.' },
    { id: 'n2', memberId: andra.id, at: s, by: 'Pelatih', text: 'Suara lebih stabil minggu ini. Bagus.' },
  ]
  await new Promise((res) => {
    const tx = db.transaction(['attendance', 'memberNotes'], 'readwrite')
    absen.forEach((x) => tx.objectStore('attendance').put(x))
    catatan.forEach((x) => tx.objectStore('memberNotes').put(x))
    tx.oncomplete = res
  })
  db.close()
  return { nama: andra.name, kode: andra.code, id: andra.id,
           sesi: sesi.map((x) => ({ id: x.id, judul: x.title, tanggal: x.date })) }
})
await wait(500)
await A.reload({ waitUntil: 'networkidle2' })
await wait(2500)

const klien = await A.target().createCDPSession()
await klien.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: UNDUH })
await A.goto(`${BASE}/#/berbagi`, { waitUntil: 'networkidle2' })
await wait(2200)
const tombolZip = await A.$('[data-testid="unduh-per-anggota"]')
await tombolZip.click()
let zip = null
for (let i = 0; i < 120 && !zip; i += 1) {
  await wait(250)
  const f = fs.readdirSync(UNDUH).filter((x) => x.endsWith('.zip'))
  if (f.length) zip = path.join(UNDUH, f[0])
}
execFileSync('unzip', ['-o', '-q', zip, '-d', BUKA])
const berkas = fs.readdirSync(BUKA).find((f) => f.startsWith('DrillKit-Andra'))
const isi = JSON.parse(fs.readFileSync(path.join(BUKA, berkas), 'utf8'))

console.log('=== isi berkas Andra ===')
console.log('sesi di paket  :', (isi.sessions ?? []).map((s) => `${s.date} ${s.title}`).join(' · '))
console.log('absensinya     :', (isi.attendance ?? []).map((a) => a.status).join(', '))
console.log('catatannya     :', (isi.memberNotes ?? []).length)
console.log('hari ini       :', new Date().toISOString().slice(0, 10))
console.log('sesi sudah lewat:', (isi.sessions ?? []).filter((s) => s.date < new Date().toISOString().slice(0, 10)).length,
  'dari', (isi.sessions ?? []).length)

/* ------------------------------- anggota ---------------------------------- */
const ctx = await browser.createBrowserContext()
const B = await ctx.newPage()
B.on('dialog', async (d) => { await d.accept() })
await B.goto(BASE, { waitUntil: 'networkidle2' })
await wait(2500)
await B.click('[data-testid="pilih-member"]')
await wait(300)
await B.click('[data-testid="lanjut-pilih-mode"]')
await wait(1500)
await B.goto(`${BASE}/#/berbagi`, { waitUntil: 'networkidle2' })
await wait(2200)
const masuk = await B.$('#pkg-input')
await masuk.uploadFile(path.join(BUKA, berkas))
await wait(3000)

const bukaTab = async (label) => {
  const ok = await B.evaluate((x) => {
    const b = [...document.querySelectorAll('button')].find((y) => y.textContent.trim().toLowerCase() === x)
    if (!b) return false
    b.click()
    return true
  }, label)
  await wait(1400)
  return ok
}

for (const t of ['jadwal', 'formasi', 'absensi', 'catatan']) {
  const ok = await bukaTab(t)
  console.log(`\n===== TAB ${t.toUpperCase()} =====`)
  if (!ok) { console.log('(tombol tidak ketemu)'); continue }
  console.log(bersih(await B.evaluate(() => document.body.innerText)).slice(0, 700))
}

await browser.close()
