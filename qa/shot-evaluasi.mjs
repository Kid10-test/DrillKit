// Tangkap H2 (Evaluasi & kemajuan): daftar, modal nilai, riwayat.
// Basis data di origin target bisa kosong, jadi contoh dimuat dulu dan
// evaluasi disuntik langsung lewat IndexedDB (lalu dimuat ulang, karena
// useLiveQuery Dexie tidak melihat tulisan IndexedDB mentah).
import puppeteer from 'puppeteer'

const BASE = process.argv[2] ?? 'http://localhost:4173'
const browser = await puppeteer.launch({
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  defaultViewport: { width: 1400, height: 1050 },
})
const p = await browser.newPage()
p.on('dialog', async (d) => { await d.accept() })

const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const tombol = (t) =>
  p.evaluate((x) => {
    const b = [...document.querySelectorAll('button')].find((y) => y.textContent.includes(x))
    if (!b || b.disabled) return false
    b.click()
    return true
  }, t)

await p.goto(BASE, { waitUntil: 'networkidle2' })
await wait(1500)
await tombol('Muat data contoh')
await wait(4000)
await p.reload({ waitUntil: 'networkidle2' })
await wait(2500)

// Suntik tiga anggota dengan riwayat yang berbeda supaya tabelnya bercerita:
//   1) dua evaluasi pada aspek yang sama -> tren naik
//   2) satu evaluasi                -> tren "belum bisa dibandingkan"
//   3) nilai rendah                 -> lencana perhatian
await p.evaluate(async () => {
  const buka = () =>
    new Promise((res, rej) => {
      const q = indexedDB.open('drillkit')
      q.onsuccess = () => res(q.result)
      q.onerror = () => rej(q.error)
    })
  const db = await buka()
  const anggota = await new Promise((res) => {
    const q = db.transaction(['members'], 'readonly').objectStore('members').getAll()
    q.onsuccess = () => res(q.result)
  })
  const a = anggota.slice(0, 3)
  if (!a.length) return
  const sekarang = Date.now()
  const baris = []
  if (a[0]) {
    baris.push({ id: 'ev_shot_1', memberId: a[0].id, tanggal: '2026-08-01',
      nilai: { teknik: 3, musikalitas: 2, kedisiplinan: 3 }, catatan: 'Teknik dasar belum stabil.', createdAt: sekarang })
    baris.push({ id: 'ev_shot_2', memberId: a[0].id, tanggal: '2026-09-01',
      nilai: { teknik: 4, musikalitas: 4, kedisiplinan: 4 }, catatan: 'Sudah jauh lebih rapi.', createdAt: sekarang + 1 })
  }
  if (a[1]) baris.push({ id: 'ev_shot_3', memberId: a[1].id, tanggal: '2026-09-01',
    nilai: { teknik: 5, musikalitas: 5, kerjasama: 5 }, catatan: '', createdAt: sekarang + 2 })
  if (a[2]) baris.push({ id: 'ev_shot_4', memberId: a[2].id, tanggal: '2026-09-01',
    nilai: { teknik: 2, musikalitas: 2, kedisiplinan: 2, kerjasama: 2 }, catatan: 'Perlu pendampingan.', createdAt: sekarang + 3 })
  await new Promise((res) => {
    const tx = db.transaction(['evaluasi'], 'readwrite')
    const s = tx.objectStore('evaluasi')
    baris.forEach((b) => s.put(b))
    tx.oncomplete = res
  })
  db.close()
})
await wait(600)
await p.goto(`${BASE}/#/evaluasi`, { waitUntil: 'networkidle2' })
await wait(2000)
await p.screenshot({ path: '/home/user/shots/evaluasi-daftar.jpg', type: 'jpeg', quality: 80 })

// Modal nilai: buka lewat tombol "Nilai" di baris pertama.
const idPertama = await p.evaluate(() => {
  const e = document.querySelector('[data-testid^="baris-"]')
  return e ? e.dataset.testid.replace('baris-', '') : null
})
if (idPertama) {
  const t = await p.$(`[data-testid="nilai-${idPertama}"]`)
  if (t) {
    await t.click()
    await wait(1000)
    await p.screenshot({ path: '/home/user/shots/evaluasi-modal.jpg', type: 'jpeg', quality: 80 })
    await p.keyboard.press('Escape')
    await wait(700)
  }
  // Riwayat: butuh DUA evaluasi, jadi pakai anggota pertama pemilik ev_shot_1.
  const pemilik = await p.evaluate(() => {
    const e = [...document.querySelectorAll('[data-testid^="riwayat-"]')]
      .find((x) => x.dataset.testid.replace('riwayat-', '') && x.textContent.trim() !== '0')
    return e ? e.dataset.testid.replace('riwayat-', '') : null
  })
  if (pemilik) {
    await p.click(`[data-testid="riwayat-${pemilik}"]`)
    await wait(1000)
    await p.screenshot({ path: '/home/user/shots/evaluasi-riwayat.jpg', type: 'jpeg', quality: 80 })
  }
}
console.log('selesai', idPertama ?? 'tanpa baris')
await browser.close()
