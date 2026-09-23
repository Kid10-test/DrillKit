/**
 * Uji halaman Evaluasi & kemajuan anggota (H2).
 *
 * Dua aturan yang paling dikuji, karena salahnya menghasilkan angka yang
 * tampak pasti padahal menipu:
 *
 * 1. **"Belum dinilai" bukan "nilai terendah."** Aspek yang tidak dinilai
 *    harus tampil "—", bukan 0.
 * 2. **Tren hanya pada aspek yang dinilai di KEDUA evaluasi.** Kalau tidak,
 *    anggota bisa tampak "naik" hanya karena aspek tersulitnya tidak dinilai
 *    kali ini. Di antarmuka, keadaan ini harus tertulis "belum bisa
 *    dibandingkan", bukan sebuah angka.
 */
import puppeteer from 'puppeteer'
import { lewatSambutan } from './sambutan.mjs'

const BASE = process.env.BASE || 'http://localhost:5173'
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
const teks = (sel) => p.$eval(sel, (e) => e.textContent.replace(/\s+/g, ' ').trim())
const ada = async (sel) => (await p.$(sel)) != null
const klik = async (sel) => { await p.waitForSelector(sel, { timeout: 10000 }); await p.click(sel) }
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

// Ambil dua anggota sungguhan dari basis data.
const anggota = await p.evaluate(async () => {
  const r = await new Promise((res) => { const q = indexedDB.open('drillkit'); q.onsuccess = () => res(q.result) })
  return await new Promise((res) => {
    const tx = r.transaction(['members'], 'readonly')
    const q = tx.objectStore('members').getAll()
    q.onsuccess = () => res(q.result.map((m) => ({ id: m.id, name: m.name, section: m.section })))
  })
})
cek('ada anggota contoh', anggota.length >= 2, String(anggota.length))
const A = anggota[0]
const B = anggota[1]

await p.evaluate(() => { location.hash = '#/evaluasi' })
await wait(2200)

// ------------------------------------------------------------------ HALAMAN
cek('halaman evaluasi terbuka', await ada('[data-testid="saring-section"]'))
cek('baris anggota tampil', await ada(`[data-testid="baris-${A.id}"]`))
cek('belum dinilai → rata "—", BUKAN "0.0"',
  (await teks(`[data-testid="rata-${A.id}"]`)) === '—', await teks(`[data-testid="rata-${A.id}"]`))
cek('belum ada tren', (await teks(`[data-testid="tren-${A.id}"]`)) === '—')
cek('belum ada badge perhatian saat belum dinilai', !(await ada(`[data-testid="perhatian-${A.id}"]`)))

/** Isi modal evaluasi untuk anggota tertentu. */
async function nilai(idAnggota, nilaiAspek, tanggal, catatan = '') {
  await klik(`[data-testid="nilai-${idAnggota}"]`)
  await wait(800)
  await p.select('[data-testid="pilih-anggota"]', idAnggota)
  await wait(300)
  // Tanggal eksplisit: dua evaluasi di hari yang sama membuat urutannya
  // bergantung pada id, dan id tidak boleh menentukan urutan riwayat.
  await p.$eval('[data-testid="tanggal-evaluasi"]', (e, v) => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    set.call(e, v)
    e.dispatchEvent(new Event('input', { bubbles: true }))
    e.dispatchEvent(new Event('change', { bubbles: true }))
  }, tanggal)
  await wait(200)
  for (const [aspek, n] of Object.entries(nilaiAspek)) {
    await klik(`[data-testid="nilai-${aspek}-${n}"]`)
    await wait(150)
  }
  if (catatan) await p.type('[data-testid="catatan-evaluasi"]', catatan)
  await klik('[data-testid="simpan-evaluasi"]')
  await wait(1500)
}

// ------------------------------------------- EVALUASI PERTAMA: sebagian aspek
await nilai(A.id, { teknik: 3, kerjasama: 3 }, '2026-08-01')
cek('rata setelah evaluasi pertama', (await teks(`[data-testid="rata-${A.id}"]`)) === '3.0',
  await teks(`[data-testid="rata-${A.id}"]`))
cek('satu evaluasi → tren masih "—"', (await teks(`[data-testid="tren-${A.id}"]`)) === '—')
cek('jumlah evaluasi tampil', (await teks(`[data-testid="riwayat-${A.id}"]`)).includes('1'),
  await teks(`[data-testid="riwayat-${A.id}"]`))

// Aspek yang tidak dinilai harus "—", bukan 0.
const selAspek = await p.$$eval(`[data-testid="baris-${A.id}"] td`, (n) => n.map((x) => x.textContent.trim()))
cek('aspek tidak dinilai tampil "—"', selAspek.includes('—'), JSON.stringify(selAspek))
cek('tidak ada "0.0" pada baris', !selAspek.includes('0.0'), JSON.stringify(selAspek))

// ---------------------------------------------- EVALUASI KEDUA: nilai naik
await nilai(A.id, { teknik: 5, kerjasama: 5 }, '2026-09-01', 'Tekniknya jauh membaik.')
cek('rata setelah evaluasi kedua', (await teks(`[data-testid="rata-${A.id}"]`)) === '5.0',
  await teks(`[data-testid="rata-${A.id}"]`))
const t1 = await teks(`[data-testid="tren-${A.id}"]`)
cek('tren naik 2.0', t1 === 'naik 2.0', t1)
cek('dua evaluasi tercatat', (await teks(`[data-testid="riwayat-${A.id}"]`)).includes('2'))

// ------------------------------------------------- ANGGOTA B: nilai rendah
await nilai(B.id, { teknik: 2, musikalitas: 2 }, '2026-08-01')
cek('rata anggota B rendah', (await teks(`[data-testid="rata-${B.id}"]`)) === '2.0',
  await teks(`[data-testid="rata-${B.id}"]`))
cek('badge perhatian muncul untuk nilai rendah', await ada(`[data-testid="perhatian-${B.id}"]`))
cek('anggota bernilai tinggi tidak berbadge perhatian', !(await ada(`[data-testid="perhatian-${A.id}"]`)))

// ------------------------- ATURAN PENTING: aspek tak bersinggungan → tak bisa dibandingkan
await nilai(B.id, { kerjasama: 5 }, '2026-09-01')
// Evaluasi terbaru B: cuma kerjasama 5. Sebelumnya: teknik 2 & musikalitas 2.
// Tidak ada aspek yang sama → harus "belum bisa dibandingkan", bukan angka.
const tB = await teks(`[data-testid="tren-${B.id}"]`)
cek('aspek tak bersinggungan → tren "—", bukan mengarang angka', tB === '—', tB)

await klik(`[data-testid="riwayat-${B.id}"]`)
await wait(1200)
const isiRiwayat = await teks('[data-testid="daftar-riwayat"]')
cek('riwayat memuat kedua evaluasi', (await p.$$eval('[data-testid^="riwayat-ev_"]', (n) => n.length)) === 2,
  String(await p.$$eval('[data-testid^="riwayat-ev_"]', (n) => n.length)))
cek('riwayat menjelaskan aturan perbandingan', isiRiwayat.includes('belum bisa dibandingkan'),
  isiRiwayat.slice(0, 120))
// Modal tidak punya testid pada tombol ✕-nya; ia menutup dengan Escape.
await p.keyboard.press('Escape')
await wait(700)
cek('modal riwayat tertutup dengan Escape', !(await ada('[data-testid="daftar-riwayat"]')))

// ------------------------------------------------------------- PENGURUTAN
await p.select('[data-testid="urut-evaluasi"]', 'nilai')
await wait(1000)
const urutanNilai = await p.$$eval('[data-testid^="baris-"]', (n) => n.map((x) => x.getAttribute('data-testid')))
cek('urut menurut nilai: A (5.0) sebelum B', urutanNilai.indexOf(`baris-${A.id}`) < urutanNilai.indexOf(`baris-${B.id}`),
  JSON.stringify(urutanNilai.slice(0, 3)))

// --------------------------------------------------------------- PENYARINGAN
// Nilai opsi section adalah id-nya, bukan labelnya — baca dulu, jangan menebak.
const opsi = await p.$$eval('[data-testid="saring-section"] option', (n) =>
  n.map((o) => ({ v: o.value, t: o.textContent.trim() })).filter((o) => o.v !== 'all'))
cek('ada lebih dari satu section', opsi.length > 1, JSON.stringify(opsi.slice(0, 4)))
const target = opsi[0]
await p.select('[data-testid="saring-section"]', target.v)
await wait(1000)
const jumlahTersaring = await p.$$eval('[data-testid^="baris-"]', (n) => n.length)
cek('penyaringan section mengurangi baris', jumlahTersaring < anggota.length,
  `${jumlahTersaring} vs ${anggota.length} (section ${target.t})`)
const semuaTersaring = await p.$$eval('[data-testid^="baris-"] td:nth-child(2)',
  (n) => n.map((x) => x.textContent.trim()))
cek('yang tersisa semuanya section itu',
  semuaTersaring.every((t) => t === target.t), JSON.stringify([...new Set(semuaTersaring)]))
await p.select('[data-testid="saring-section"]', 'all')
await wait(800)

// ------------------------------------------------------------------- HAPUS
await klik(`[data-testid="riwayat-${A.id}"]`)
await wait(1400)
const idPertama = await p.$eval('[data-testid^="riwayat-ev_"]', (e) => e.getAttribute('data-testid').replace('riwayat-', ''))
await klik(`[data-testid="hapus-${idPertama}"]`)
await wait(1200)
const sisaRiwayat = await p.$$eval('[data-testid^="riwayat-ev_"]', (n) => n.length)
cek('evaluasi terhapus dari riwayat', sisaRiwayat === 1, String(sisaRiwayat))
await p.keyboard.press('Escape')
await wait(800)
// Yang dihapus adalah yang TERBARU (5/5, 2026-09-01), jadi yang tersisa
// bernilai 3.0, dan trennya kembali "—" karena tinggal satu evaluasi.
cek('setelah dihapus, rata A mengikuti evaluasi yang tersisa',
  (await teks(`[data-testid="rata-${A.id}"]`)) === '3.0', await teks(`[data-testid="rata-${A.id}"]`))
cek('setelah dihapus, tren A kembali "—"',
  (await teks(`[data-testid="tren-${A.id}"]`)) === '—', await teks(`[data-testid="tren-${A.id}"]`))

cek('tidak ada error konsol', errors.length === 0, errors.slice(0, 3).join(' | '))

console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) {
  console.log('GAGAL:\n - ' + gagal.join('\n - '))
  await browser.close()
  process.exit(1)
}
await browser.close()
console.log('selesai')
