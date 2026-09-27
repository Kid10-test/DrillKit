/**
 * #3 — Jadwal: kalender & agenda (uji peramban).
 *
 * Yang dijaga:
 * - laptop: tampilan Bulan bawaan, kolom pertama Senin, hari ini disorot
 * - ketuk hari kosong → modal Tambah jadwal dengan tanggal terisi
 * - ulangi mingguan membuat seri sampai tanggal akhir
 * - ubah "semua berikutnya" tidak menyentuh sesi sebelumnya; "hanya sesi ini" melepas dari seri
 * - hapus seri mempertahankan sesi berabsensi
 * - duplikat ke tanggal lain
 * - seret-pindah dengan Batalkan
 * - cetak bulan tidak buntu (popup atau unduhan HTML)
 * - pilihan tampilan diingat per perangkat
 * - HP 360 px: Agenda bawaan, kartu sesi berikutnya, tanpa gulir mendatar
 */
import puppeteer from 'puppeteer'
import { lewatSambutan } from './sambutan.mjs'

const BASE = process.env.BASE || 'http://localhost:4173'
const browser = await puppeteer.launch({
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  defaultViewport: { width: 1280, height: 1000 },
})
const p = await browser.newPage()
const errors = []
p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
p.on('pageerror', (e) => errors.push(String(e)))

let lulus = 0
const gagal = []
const cek = (nama, syarat, ket = '') => (syarat ? lulus++ : gagal.push(`${nama}${ket ? ' — ' + ket : ''}`))
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const ada = async (sel) => (await p.$(sel)) != null
const klik = async (sel) => { await p.waitForSelector(sel, { timeout: 10000 }); await p.click(sel) }
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** Semua sesi langsung dari IndexedDB. */
const semuaSesi = () =>
  p.evaluate(async () => {
    const r = await new Promise((res) => { const q = indexedDB.open('drillkit'); q.onsuccess = () => res(q.result) })
    return await new Promise((res) => {
      const q = r.transaction('sessions').objectStore('sessions').getAll()
      q.onsuccess = () => { r.close(); res(q.result) }
    })
  })

await p.goto(BASE, { waitUntil: 'networkidle2' })
await lewatSambutan(p)
await p.evaluate(() => { location.hash = '#/jadwal' })
await wait(1500)

/* ---------------- laptop: bulan ---------------- */
cek('laptop: tampilan Bulan bawaan', await ada('[data-testid="kotak-bulan"]'))
cek('tab Bulan terpilih', (await p.$eval('[data-testid="tampilan-bulan"]', (e) => e.getAttribute('aria-selected'))) === 'true')
const selPertama = await p.$eval('[data-testid="kotak-bulan"] > div', (e) => e.getAttribute('data-testid'))
const tglPertama = selPertama.replace('hari-', '')
cek('kolom pertama hari Senin', new Date(tglPertama + 'T12:00').getDay() === 1, tglPertama)
cek('hari ini disorot', await ada(`[data-testid="hari-${iso(new Date())}"] .bg-emerald-500`))

// Pindah ke bulan depan supaya semua hari kosong.
await klik('[data-testid="bulan-maju"]')
await wait(300)
const now = new Date()
const bulanDepan = new Date(now.getFullYear(), now.getMonth() + 1, 1, 12)
// Senin pertama bulan depan.
const senin = new Date(bulanDepan)
while (senin.getDay() !== 1) senin.setDate(senin.getDate() + 1)
const tSenin = iso(senin)
await klik(`[data-testid="hari-${tSenin}"]`)
await wait(500)
const tglModal = await p.$eval('[data-testid="atur-ulang"]', (e) => e.closest('[role="dialog"], div').parentElement?.querySelector('input[type="date"]')?.value).catch(() => null)
cek('ketuk hari kosong → modal dengan tanggal terisi', tglModal === tSenin, String(tglModal))

// Isi judul, ulangi Senin & Kamis selama 2 minggu.
await p.type('input[placeholder^="mis. Latihan rutin"]', 'Latihan Seri Uji')
await klik('[data-testid="ulangi-mingguan"]')
await klik('[data-testid="ulang-hari-3"]')
const akhir = new Date(senin); akhir.setDate(akhir.getDate() + 10) // Kamis minggu kedua
await p.$eval('[data-testid="ulang-akhir"]', (e, v) => {
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
  set.call(e, v); e.dispatchEvent(new Event('input', { bubbles: true }))
}, iso(akhir))
await wait(200)
const ringkas = await p.$eval('[data-testid="ulang-ringkas"]', (e) => e.textContent)
cek('ringkasan seri: 4 sesi', ringkas.includes('4 sesi'), ringkas)
await klik('[data-testid="simpan-jadwal"]')
await wait(800)
let sesi = (await semuaSesi()).filter((s) => s.title === 'Latihan Seri Uji').sort((a, b) => a.date.localeCompare(b.date))
cek('seri tersimpan 4 sesi', sesi.length === 4, String(sesi.length))
cek('seri berhenti di tanggal akhir', sesi.at(-1)?.date === iso(akhir))
const seriId = sesi[0]?.seriId
cek('semua sesi satu seriId', !!seriId && sesi.every((s) => s.seriId === seriId))
cek('label tampil di kalender', await ada(`[data-testid="label-${sesi[0].id}"]`))

/* ---------------- ubah semua berikutnya ---------------- */
await klik(`[data-testid="hari-${sesi[1].date}"]`)
await wait(300)
await p.evaluate((id) => {
  const k = document.querySelector(`[data-testid="kartu-${id}"]`)
  ;[...k.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Edit').click()
}, sesi[1].id)
await wait(400)
await p.$eval('input[type="time"]', (e) => {
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
  set.call(e, '16:45'); e.dispatchEvent(new Event('input', { bubbles: true }))
})
cek('sesi seri lama: pilihan ulangi tidak tampil', !(await ada('[data-testid="atur-ulang"]')))
await klik('[data-testid="simpan-jadwal"]')
await wait(400)
cek('muncul pertanyaan seri', await ada('[data-testid="modal-ubah-seri"]'))
await klik('[data-testid="ubah-berikutnya"]')
await wait(600)
sesi = (await semuaSesi()).filter((s) => s.seriId === seriId).sort((a, b) => a.date.localeCompare(b.date))
cek('semua berikutnya: sesi pertama tetap 15:30', sesi[0].startTime === '15:30')
cek('semua berikutnya: sesi 2–4 jadi 16:45', sesi.slice(1).every((s) => s.startTime === '16:45'), sesi.map((s) => s.startTime).join())

/* ---------------- hanya sesi ini ---------------- */
await p.evaluate((id) => {
  const k = document.querySelector(`[data-testid="kartu-${id}"]`)
  ;[...k.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Edit').click()
}, sesi[1].id)
await wait(400)
await p.$eval('input[placeholder^="mis. Latihan rutin"]', (e) => {
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
  set.call(e, 'Latihan Khusus'); e.dispatchEvent(new Event('input', { bubbles: true }))
})
await klik('[data-testid="simpan-jadwal"]')
await wait(300)
await klik('[data-testid="ubah-ini"]')
await wait(600)
const semua1 = await semuaSesi()
const khusus = semua1.find((s) => s.id === sesi[1].id)
cek('hanya sesi ini: judul berubah & lepas dari seri', khusus.title === 'Latihan Khusus' && !khusus.seriId)
cek('hanya sesi ini: sesi lain tidak berubah', semua1.filter((s) => s.seriId === seriId).every((s) => s.title === 'Latihan Seri Uji'))

/* ---------------- hapus seri, sesi berabsensi dipertahankan ---------------- */
const idBerabsen = sesi[2].id
await p.evaluate(async (sid) => {
  const r = await new Promise((res) => { const q = indexedDB.open('drillkit'); q.onsuccess = () => res(q.result) })
  const tx = r.transaction('attendance', 'readwrite')
  tx.objectStore('attendance').put({ id: 'a_uji', sessionId: sid, memberId: 'm_uji', status: 'hadir' })
  await new Promise((res) => { tx.oncomplete = res })
  r.close()
}, idBerabsen)
await p.reload({ waitUntil: 'networkidle2' })
await wait(1500)
await klik('[data-testid="bulan-maju"]')
await wait(300)
await klik(`[data-testid="hari-${sesi[0].date}"]`)
await wait(300)
await klik(`[data-testid="hapus-seri-${sesi[0].id}"]`)
await wait(300)
const teksHapus = await p.$eval('[data-testid="modal-hapus-seri"]', (e) => e.textContent)
cek('pratinjau hapus menyebut sesi berabsensi', /1\s*sesi yang sudah punya absensi/.test(teksHapus.replace(/\s+/g, ' ')), teksHapus)
await klik('[data-testid="hapus-seri-ya"]')
await wait(600)
const sisa = (await semuaSesi()).filter((s) => s.seriId === seriId)
cek('hapus seri: hanya sesi berabsensi yang tersisa', sisa.length === 1 && sisa[0].id === idBerabsen, sisa.map((s) => s.date).join())

/* ---------------- duplikat ---------------- */
await klik(`[data-testid="hari-${khusus.date}"]`)
await wait(300)
await klik(`[data-testid="duplikat-${khusus.id}"]`)
await wait(300)
await klik('[data-testid="duplikat-simpan"]')
await wait(600)
const tDup = new Date(khusus.date + 'T12:00'); tDup.setDate(tDup.getDate() + 7)
const dup = (await semuaSesi()).filter((s) => s.title === 'Latihan Khusus')
cek('duplikat: salinan di +7 hari', dup.length === 2 && dup.some((s) => s.date === iso(tDup)) && new Set(dup.map((s) => s.id)).size === 2)

/* ---------------- seret-pindah + batalkan ---------------- */
const target = new Date(khusus.date + 'T12:00'); target.setDate(target.getDate() + 1)
await p.evaluate((id, tgl) => {
  const src = document.querySelector(`[data-testid="label-${id}"]`)
  const dst = document.querySelector(`[data-testid="hari-${tgl}"]`)
  const dt = new DataTransfer()
  src.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }))
  dst.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }))
  dst.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }))
  src.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: dt }))
}, khusus.id, iso(target))
await wait(600)
let pindah = (await semuaSesi()).find((s) => s.id === khusus.id)
cek('seret-pindah: tanggal berubah', pindah.date === iso(target), pindah.date)
cek('bilah Batalkan tampil', await ada('[data-testid="bilah-undo"]'))
await klik('[data-testid="batal-pindah"]')
await wait(600)
pindah = (await semuaSesi()).find((s) => s.id === khusus.id)
cek('Batalkan: tanggal kembali', pindah.date === khusus.date, pindah.date)

/* ---------------- cetak ---------------- */
const jumlahHalaman = (await browser.pages()).length
await klik('[data-testid="cetak-bulan"]')
await wait(1200)
const halaman = await browser.pages()
let isiCetak = ''
if (halaman.length > jumlahHalaman) isiCetak = await halaman.at(-1).content()
cek('cetak: jendela cetak terbuka atau HTML diunduh', halaman.length > jumlahHalaman || errors.length === 0)
if (isiCetak) {
  cek('cetak: berisi kalender tanpa oklch', isiCetak.includes('Jadwal ') && !/oklch|color-mix/.test(isiCetak))
  await halaman.at(-1).close()
}

/* ---------------- pilihan tampilan diingat ---------------- */
await klik('[data-testid="tampilan-agenda"]')
await wait(300)
await p.reload({ waitUntil: 'networkidle2' })
await wait(1500)
cek('pilihan Agenda diingat setelah muat ulang', (await p.$eval('[data-testid="tampilan-agenda"]', (e) => e.getAttribute('aria-selected'))) === 'true')
cek('agenda: kartu sesi berikutnya', await ada('[data-testid="sesi-berikutnya"]'))
await klik('[data-testid="tampilan-daftar"]')
await wait(300)
cek('tampilan Daftar lama tersedia', (await p.evaluate(() => document.body.textContent.includes('Sudah lewat'))))

/* ---------------- HP 360 px ---------------- */
const hp = await browser.newPage()
await hp.setViewport({ width: 360, height: 740 })
await hp.goto(BASE, { waitUntil: 'networkidle2' })
await hp.evaluate(() => localStorage.removeItem('drillkit.jadwal.tampilan'))
await hp.evaluate(() => { location.hash = '#/jadwal' })
await wait(1500)
cek('HP: Agenda bawaan', (await hp.$eval('[data-testid="tampilan-agenda"]', (e) => e.getAttribute('aria-selected'))) === 'true')
cek('HP: tanpa gulir mendatar (agenda)', await hp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1))
await hp.click('[data-testid="tampilan-bulan"]')
await wait(400)
cek('HP: tanpa gulir mendatar (bulan)', await hp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  String(await hp.evaluate(() => document.documentElement.scrollWidth)))
await hp.close()

cek('tanpa galat konsol', errors.length === 0, errors.slice(0, 3).join(' | '))

await browser.close()
console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) {
  for (const g of gagal) console.log('  ✗ ' + g)
  process.exit(1)
}
