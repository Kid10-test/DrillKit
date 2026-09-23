// Tangkapan layar H1 — rencana latihan & layar pacu.
// Dua frame, keduanya sengaja dibuat MENAMPILKAN peringatan, karena itu
// inti fitur ini: rencana yang kelebihan slot, dan latihan yang melenceng.
import puppeteer from 'puppeteer'
import fs from 'node:fs'

const BASE = process.env.BASE || 'http://localhost:5173'
fs.mkdirSync('/home/user/shots', { recursive: true })
const browser = await puppeteer.launch({
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  defaultViewport: { width: 1280, height: 1100 },
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

const info = await p.evaluate(async () => {
  const r = await new Promise((res) => { const q = indexedDB.open('drillkit'); q.onsuccess = () => res(q.result) })
  const skrg = new Date()
  const iso = `${skrg.getFullYear()}-${String(skrg.getMonth() + 1).padStart(2, '0')}-${String(skrg.getDate()).padStart(2, '0')}`
  const jam = (mnt) => {
    const d = new Date(skrg.getTime() + mnt * 60000)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
  const kini = Date.now()
  const M = 60000
  const rencana = [
    { id: 'p_a', judul: 'Pemanasan & tuning', jenis: 'pemanasan', menit: 15 },
    { id: 'p_b', judul: 'Section Brass — formasi A', jenis: 'section', menit: 35 },
    { id: 'p_c', judul: 'Section Battery — transisi', jenis: 'section', menit: 25 },
    { id: 'p_d', judul: 'Gabungan — run through', jenis: 'gabungan', menit: 30 },
    { id: 'p_e', judul: 'Pendingin & evaluasi', jenis: 'pendingin', menit: 10 },
  ]
  const tx = r.transaction(['sessions'], 'readwrite')
  // Frame 1: rencana 115 menit di slot 90 menit → peringatan kelebihan.
  tx.objectStore('sessions').put({
    id: 's_h1_rencana', title: 'Latihan Rutin — Persiapan Kejuaraan', type: 'latihan', date: iso,
    startTime: jam(-10), endTime: jam(80), place: 'Lapangan Sekolah', notes: '', checklist: [],
    createdAt: kini, rencanaLatihan: rencana,
  })
  // Frame 2: pemanasan molor 22 menit dari rencana 15, section sedang jalan.
  tx.objectStore('sessions').put({
    id: 's_h1_pacu', title: 'Gladi Resik — Kejuaraan Daerah', type: 'gabungan', date: iso,
    startTime: jam(-40), endTime: jam(80), place: 'Stadion Utama', notes: '', checklist: [],
    createdAt: kini, rencanaLatihan: rencana,
    realisasiLatihan: [
      { id: 'p_a', mulai: kini - 40 * M, selesai: kini - 18 * M },
      { id: 'p_b', mulai: kini - 18 * M, selesai: null },
    ],
  })
  await new Promise((res) => { tx.oncomplete = res })
  return { iso }
})

await p.reload({ waitUntil: 'networkidle2' })
await wait(2500)
await p.evaluate(() => { location.hash = '#/jadwal' })
await wait(2200)
await potret('latihan-1-daftar')

// ---- Frame 2: modal sunting dengan peringatan kelebihan slot
// Cari tombol Edit yang KARTUNYA memuat judul sesi — bukan sekadar tombol
// Edit pertama, karena ada lebih dari satu sesi di halaman ini.
const dibuka = await p.evaluate((judul) => {
  for (const b of document.querySelectorAll('button')) {
    if (b.textContent.trim() !== 'Edit') continue
    let n = b
    for (let i = 0; i < 6 && n; i += 1) {
      // Pagar: begitu sebuah leluhur memuat LEBIH DARI SATU tombol Edit,
      // kita sudah keluar dari kartu sesi dan masuk ke wadah daftarnya.
      // Tanpa pagar ini, judul sesi lain ikut terbaca dan kita mengklik
      // kartu yang salah.
      const jumEdit = [...n.querySelectorAll('button')].filter(
        (x) => x.textContent.trim() === 'Edit',
      ).length
      if (jumEdit > 1) break
      if (n.textContent.includes(judul)) {
        b.click()
        return true
      }
      n = n.parentElement
    }
  }
  return false
}, 'Latihan Rutin — Persiapan Kejuaraan')
console.log('modal terbuka:', dibuka)
// Tunggu elemen sungguhan, jangan mengandalkan perkiraan waktu.
await p.waitForSelector('[data-testid="daftar-blok"]', { timeout: 10000 })
await wait(600)
console.log('peringatan rencana:', (await teks('[data-testid="rencana-lebih"]')))
console.log('ringkasan:', (await teks('[data-testid="ringkasan-rencana"]')).slice(0, 90))
console.log('jumlah blok:', await p.$$eval('[data-testid^="blok-"]', (n) => n.length))
await potret('latihan-2-penyunting')

await tombol('Batal')
await wait(800)

// ---- Frame 3: layar pacu
await klik('[data-testid="pacu-s_h1_pacu"]')
await wait(1600)
console.log('sesi:', await teks('[data-testid="judul-sesi-pacu"]'))
console.log('blok berjalan:', await teks('[data-testid="blok-berjalan"]'))
console.log('sisa blok:', await teks('[data-testid="sisa-blok"]'))
console.log('geser:', await teks('[data-testid="geser"]'), '| data-geser =',
  await p.$eval('[data-testid="geser"]', (e) => e.getAttribute('data-geser')))
console.log('proyeksi:', await teks('[data-testid="proyeksi-selesai"]'))
console.log('peringatan:', (await teks('[data-testid="peringatan-geser"]')).slice(0, 80))
await potret('latihan-3-pacu')

await browser.close()
console.log('selesai')
