// Buat paket berbagi sungguhan, lalu periksa apa yang sebenarnya ikut di dalamnya.
import puppeteer from 'puppeteer'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { lewatSambutan } from './sambutan.mjs'

/* N14 — dialihkan dari server pengembangan (:5173) ke hasil build.
   (Baris ini pernah berbunyi `?? BASE` — merujuk dirinya sendiri, jadi
   skripnya mogok sebelum menyentuh apa pun.) */
const BASE = process.env.BASE || process.argv[2] || 'http://localhost:4173'
const UNDUH = path.join(os.tmpdir(), `unduh-paket-${Date.now()}`)
fs.mkdirSync(UNDUH, { recursive: true })

const b = await puppeteer.launch({ args: ['--no-sandbox'], defaultViewport: { width: 1400, height: 1100 } })
const p = await b.newPage()
p.on('dialog', async (d) => { await d.accept() })
const wait = (m) => new Promise((r) => setTimeout(r, m))
const tombol = (t) => p.evaluate((x) => {
  const e = [...document.querySelectorAll('button')].find((y) => y.textContent.includes(x))
  if (!e || e.disabled) return false
  e.click(); return true
}, t)

await p.goto(BASE, { waitUntil: 'networkidle2' })
/* Layar sambutan muncul di setiap profil baru; tanpa ini rangkaian
   tidak bisa menyentuh apa pun. */
await lewatSambutan(p)
await wait(1500)
await tombol('Muat data contoh')
await wait(4000)
await p.reload({ waitUntil: 'networkidle2' })
await wait(2500)

// Tambah catatan evaluasi & evaluasi terstruktur untuk satu anggota saja,
// supaya kentara apakah data anggota LAIN ikut terbawa.
await p.evaluate(async () => {
  const db = await new Promise((res) => { const q = indexedDB.open('drillkit'); q.onsuccess = () => res(q.result) })
  const anggota = await new Promise((res) => {
    const q = db.transaction(['members'], 'readonly').objectStore('members').getAll()
    q.onsuccess = () => res(q.result)
  })
  const s = Date.now()
  const catatan = anggota.slice(0, 3).map((m, i) => ({
    id: `mn_${i}`, memberId: m.id, at: s - i * 1000, by: 'Pelatih',
    text: `Catatan RAHASIA untuk ${m.name}`,
  }))
  const evaluasi = anggota.slice(0, 3).map((m, i) => ({
    id: `ev_${i}`, memberId: m.id, tanggal: '2026-09-01',
    nilai: { teknik: 3 + i, musikalitas: 2 + i }, catatan: '', createdAt: s,
  }))
  await new Promise((res) => {
    const tx = db.transaction(['memberNotes', 'evaluasi'], 'readwrite')
    catatan.forEach((x) => tx.objectStore('memberNotes').put(x))
    evaluasi.forEach((x) => tx.objectStore('evaluasi').put(x))
    tx.oncomplete = res
  })
  db.close()
})
await wait(500)
await p.reload({ waitUntil: 'networkidle2' })
await wait(2000)

const klien = await p.target().createCDPSession()
await klien.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: UNDUH })

await p.goto(`${BASE}/#/berbagi`, { waitUntil: 'networkidle2' })
await wait(2000)

// Pastikan keempat saklar MENYALA. Warna isi saklar dipakai sebagai
// penanda keadaan (hijau = nyala), karena Toggle tidak mengekspos aria-checked.
const saklar = await p.evaluate(() => {
  const daftar = [...document.querySelectorAll('button')].filter((b) =>
    /Jadwal & materi|Formasi\/drill|Repertoar & tempo|Rekap kehadiran/.test(b.textContent))
  const hasil = daftar.map((b) => {
    const nyala = !!b.querySelector('.bg-emerald-500')
    if (!nyala) b.click()
    return { label: b.textContent.trim().slice(0, 28), dinyalakan: !nyala }
  })
  return hasil
})
await wait(800)
console.log('saklar:', JSON.stringify(saklar))

const diekspor = await tombol('Buat & unduh paket')
console.log('tombol ekspor ditekan:', diekspor)

let berkas = null
for (let i = 0; i < 60 && !berkas; i += 1) {
  await wait(250)
  const f = fs.readdirSync(UNDUH).filter((x) => x.endsWith('.json'))
  if (f.length) berkas = path.join(UNDUH, f[0])
}
if (!berkas) {
  console.log('GAGAL: berkas tidak terunduh. isi folder:', fs.readdirSync(UNDUH))
  await b.close(); process.exit(1)
}

const data = JSON.parse(fs.readFileSync(berkas, 'utf8'))
console.log('\n=== kunci dalam berkas ===')
console.log(Object.keys(data).join(', '))
console.log('\n=== isi ===')
console.log('anggota          :', (data.members ?? []).length)
console.log('absensi          :', (data.attendance ?? []).length)
console.log('catatan evaluasi :', (data.memberNotes ?? []).length)
console.log('evaluasi (H2)    :', data.evaluasi ? data.evaluasi.length : 'TIDAK ADA di paket')
console.log('sesi             :', (data.sessions ?? []).length)
console.log('drill            :', (data.drills ?? []).length)

const pertama = (data.members ?? [])[0]
if (pertama) {
  console.log('\n=== bila paket dibuka oleh', pertama.name, '===')
  console.log('absensinya sendiri :', (data.attendance ?? []).filter((a) => a.memberId === pertama.id).length)
  console.log('absensi ORANG LAIN :', (data.attendance ?? []).filter((a) => a.memberId !== pertama.id).length)
  console.log('catatannya sendiri :', (data.memberNotes ?? []).filter((n) => n.memberId === pertama.id).length)
  console.log('catatan ORANG LAIN :', (data.memberNotes ?? []).filter((n) => n.memberId !== pertama.id).length)
  const cn = (data.memberNotes ?? [])[0]
  if (cn) console.log('contoh isi catatan orang lain:', JSON.stringify(cn.text))
}
console.log('\nukuran berkas:', fs.statSync(berkas).size, 'bita')
console.log('selesai')
await b.close()
fs.rmSync(UNDUH, { recursive: true, force: true })
