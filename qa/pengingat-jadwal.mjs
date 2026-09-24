/**
 * Uji **pengingat jadwal (C3)** — spanduk jadwal terdekat, notifikasi
 * sistem saat dibuka, dan berkas kalender (.ics).
 *
 * Batasan yang diuji secara jujur: tanpa server tidak ada alarm sungguhan.
 * Yang dijaga: (1) spanduk muncul saat dibuka bila ada sesi hari ini/besok,
 * (2) tutup-ingatkan bertahan sampai besok, (3) notifikasi sistem terkirim
 * sekali per sesi per hari bila izin ada, (4) .ics-nya valid dan memuat dua
 * alarm — dialah "pengingat saat aplikasi tutup" yang sesungguhnya.
 *
 * Alur:
 *   1. Pelatih: data contoh + sesi "Uji Ingat" (besok) + "Uji Notif" (30 mnt lagi).
 *   2. Dashboard: spanduk ada, memuat keduanya, sesi jauh (+10 hari) tidak ikut.
 *   3. Tutup "Uji Ingat" → hilang, tetap hilang sesudah muat ulang.
 *   4. Unduh .ics "Uji Ingat" → struktur + 2 alarm valid.
 *   5. Anggota: spanduk + .ics + notifikasi (izin granted, Notification dicatat).
 */
import puppeteer from 'puppeteer'
import { lewatSambutan } from './sambutan.mjs'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { DIST } from './lokasi.mjs'

const BASE = process.env.BASE || 'http://localhost:4173'
const PAKET = path.join(DIST, 'paket.json')
const UNDUH = path.join(os.tmpdir(), `unduh-ingat-${Date.now()}`)
fs.mkdirSync(UNDUH, { recursive: true })

const dua = (n) => String(n).padStart(2, '0')
const isoTanggal = (d) => `${d.getFullYear()}-${dua(d.getMonth() + 1)}-${dua(d.getDate())}`
const isoJam = (d) => `${dua(d.getHours())}:${dua(d.getMinutes())}`
const besok = new Date(Date.now() + 86400000)
const TGL_BESOK = isoTanggal(besok)
const TGL_HARI_INI = isoTanggal(new Date())
const notifPada = new Date(Date.now() + 30 * 60000)
const TGL_NOTIF = isoTanggal(notifPada)
const JAM_NOTIF = isoJam(notifPada)
const JAM_NOTIF_AKHIR = isoJam(new Date(Date.now() + 90 * 60000))

const browser = await puppeteer.launch({
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  defaultViewport: { width: 1300, height: 1000 },
})
const errors = []

let lulus = 0
const gagal = []
const cek = (nama, syarat, keterangan = '') => {
  if (syarat) lulus += 1
  else gagal.push(`${nama}${keterangan ? ' — ' + keterangan : ''}`)
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const teks = (h, id) => h.evaluate((x) => document.querySelector(`[data-testid="${x}"]`)?.textContent.replace(/\s+/g, ' ').trim() ?? '', id)
const ada = (h, id) => h.evaluate((x) => document.querySelector(`[data-testid="${x}"]`) != null, id)

/** Isi <input> yang dikontrol React (termasuk type=date/time). */
const isiInput = (h, selektor, nilai) => h.evaluate((sel, v) => {
  const el = document.querySelector(sel)
  if (!el) return false
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  set.call(el, v)
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
  return true
}, selektor, nilai)

/** Tambah satu sesi lewat modal Tambah jadwal. */
async function tambahSesi(h, judul, tanggal, mulai, selesai) {
  await h.evaluate(() => {
    [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Tambah jadwal'))?.click()
  })
  await h.waitForSelector('input[type="date"]', { timeout: 8000 })
  await wait(400)
  await isiInput(h, 'input[placeholder^="mis. Latihan"]', judul)
  await isiInput(h, 'input[type="date"]', tanggal)
  const waktu = await h.$$('input[type="time"]')
  if (waktu.length < 2) throw new Error('kolom jam modal tidak lengkap')
  await h.evaluate((v) => {
    const els = document.querySelectorAll('input[type="time"]')
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    set.call(els[0], v[0])
    els[0].dispatchEvent(new Event('input', { bubbles: true }))
    set.call(els[1], v[1])
    els[1].dispatchEvent(new Event('input', { bubbles: true }))
  }, [mulai, selesai])
  const simpan = await h.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Simpan')
    if (!b) return false
    b.click()
    return true
  })
  if (!simpan) throw new Error('tombol Simpan modal tidak ketemu')
  await h.waitForFunction(
    (t) => document.body.textContent.includes(t), { timeout: 8000 }, judul)
}

/** Tunggu berkas .json/.ics pertama di folder unduhan. */
async function tungguUnduhan(ekstensi) {
  for (let i = 0; i < 120; i += 1) {
    await wait(250)
    const f = fs.readdirSync(UNDUH).filter((x) => x.endsWith(ekstensi))
    if (f.length) return path.join(UNDUH, f[0])
  }
  return null
}

try {
  /* ================= 1. Pelatih: data contoh + 2 sesi uji ================= */
  const A = await browser.newPage()
  A.on('dialog', async (d) => { await d.accept() })
  await A.goto(BASE, { waitUntil: 'networkidle2' })
  await lewatSambutan(A)
  await wait(1200)
  await A.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((y) => y.textContent.includes('Muat data contoh'))
    if (b) b.click()
  })
  await wait(4500)
  await A.goto(`${BASE}/#/jadwal`, { waitUntil: 'networkidle2' })
  await wait(2200)
  await tambahSesi(A, 'Uji Ingat', TGL_BESOK, '15:00', '17:00')
  await wait(600)
  await tambahSesi(A, 'Uji Notif', TGL_NOTIF, JAM_NOTIF, JAM_NOTIF_AKHIR)
  await wait(600)
  cek('1: dua sesi uji tersimpan', await A.evaluate(() =>
    document.body.textContent.includes('Uji Ingat') && document.body.textContent.includes('Uji Notif')))

  /* ================= 2. Spanduk Dashboard ================= */
  await A.goto(BASE, { waitUntil: 'networkidle2' })
  await wait(2200)
  cek('2: spanduk pelatih muncul', await ada(A, 'ingat-coach-spanduk'))
  const spanduk = await teks(A, 'ingat-coach-spanduk')
  cek('2: sesi besok ikut diingatkan', spanduk.includes('Uji Ingat'), spanduk.slice(0, 120))
  cek('2: sesi 30 mnt lagi ikut diingatkan', spanduk.includes('Uji Notif'), spanduk.slice(0, 120))
  cek('2: sesi +10 hari tidak ikut', !spanduk.includes('Hari Ulang Tahun'), spanduk.slice(0, 160))
  cek('2: tombol Kalender ada di spanduk',
    await A.evaluate(() => document.querySelectorAll('[data-testid^="ingat-coach-ics-"]').length >= 2))

  /* ================= 3. Tutup bertahan sampai besok ================= */
  const tutupId = await A.evaluate(() => {
    const tombol = [...document.querySelectorAll('[data-testid^="ingat-coach-tutup-"]')]
    // Cari tombol milik "Uji Ingat" lewat barisnya.
    const baris = tombol.find((b) => b.closest('li')?.textContent.includes('Uji Ingat'))
    if (!baris) return ''
    baris.click()
    return baris.getAttribute('data-testid')
  })
  cek('3: tombol tutup Uji Ingat ketemu & diklik', tutupId !== '', tutupId)
  await wait(800)
  const spanduk2 = await teks(A, 'ingat-coach-spanduk')
  cek('3: Uji Ingat hilang dari spanduk', !spanduk2.includes('Uji Ingat'), spanduk2.slice(0, 120))
  cek('3: sesi lain tetap ada', spanduk2.includes('Uji Notif'), spanduk2.slice(0, 120))
  await A.reload({ waitUntil: 'networkidle2' })
  await wait(2200)
  const spanduk3 = await teks(A, 'ingat-coach-spanduk')
  cek('3: tetap hilang sesudah muat ulang', !spanduk3.includes('Uji Ingat'), spanduk3.slice(0, 120))

  /* ================= 4. Berkas .ics pelatih ================= */
  const klien = await A.target().createCDPSession()
  await klien.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: UNDUH })
  await A.goto(`${BASE}/#/jadwal`, { waitUntil: 'networkidle2' })
  await wait(2200)
  // ID sesi dari tombol tutup spanduk (§3) — pasti milik Uji Ingat.
  const idUji = tutupId.replace('ingat-coach-tutup-', '')
  const tombolIcs = await A.$(`[data-testid="ics-${idUji}"]`)
  cek('4: tombol Kalender Uji Ingat ada', tombolIcs != null, idUji)
  if (tombolIcs) await tombolIcs.click()
  const berkasIcs = await tungguUnduhan('.ics')
  cek('4: berkas .ics terunduh', berkasIcs != null)
  if (berkasIcs) {
    const isi = fs.readFileSync(berkasIcs, 'utf8')
    cek('4: struktur VCALENDAR/VEVENT', isi.includes('BEGIN:VCALENDAR') && isi.includes('BEGIN:VEVENT') && isi.includes('END:VEVENT'))
    cek('4: judul & jam tepat',
      isi.includes('SUMMARY:Uji Ingat') && isi.includes(`DTSTART:${TGL_BESOK.replaceAll('-', '')}T150000`),
      (isi.match(/DTSTART.*/) ?? ['?'])[0])
    cek('4: dua alarm ikut', isi.includes('TRIGGER:-P1D') && isi.includes('TRIGGER:-PT60M'))
    fs.unlinkSync(berkasIcs)
  }

  /* ================= 5. Anggota: spanduk + .ics + notifikasi ================= */
  await A.goto(`${BASE}/#/berbagi`, { waitUntil: 'networkidle2' })
  await wait(2200)
  await (await A.$('[data-testid="unduh-grup"]')).click()
  const berkasGrup = await tungguUnduhan('.json')
  cek('5: berkas grup terunduh', berkasGrup != null)
  const grup = JSON.parse(fs.readFileSync(berkasGrup, 'utf8'))
  fs.writeFileSync(PAKET, JSON.stringify(grup))

  const ctxB = await browser.createBrowserContext()
  // Izin notifikasi granted + Notification diganti pencatat SEBELUM skrip jalan.
  await ctxB.overridePermissions(new URL(BASE).origin, ['notifications'])
  const B = await ctxB.newPage()
  B.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  B.on('pageerror', (e) => errors.push(String(e)))
  B.on('dialog', async (d) => { await d.accept() })
  await B.evaluateOnNewDocument(() => {
    window.__notif = []
    window.__NotifAsli = window.Notification
    class Catat {
      static permission = 'granted'
      static async requestPermission() { return 'granted' }
      constructor(judul, opsi) { window.__notif.push({ judul, isi: opsi?.body ?? '' }) }
    }
    window.Notification = Catat
  })
  const klienB = await B.target().createCDPSession()
  await klienB.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: UNDUH })
  await B.goto(BASE, { waitUntil: 'networkidle2' })
  await wait(2500)
  await B.click('[data-testid="pilih-member"]')
  await wait(300)
  await B.click('[data-testid="lanjut-pilih-mode"]')
  await wait(1500)
  await B.goto(`${BASE}/#/berbagi`, { waitUntil: 'networkidle2' })
  await wait(2200)
  await (await B.$('[data-testid="ambil-materi"]')).click()
  await wait(3200)
  await B.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) =>
      [...x.querySelectorAll('span')].some((s) => s.textContent.trim() === 'Citra Dewi'))
    b?.click()
  })
  await wait(1200)
  const spandukA = await teks(B, 'ingat-anggota-spanduk')
  cek('5: spanduk anggota muncul & memuat Uji Ingat', spandukA.includes('Uji Ingat'), spandukA.slice(0, 120))
  // Notifikasi: hanya sesi dalam jendela 3 jam yang tercatat.
  const notif = await B.evaluate(() => window.__notif ?? [])
  const untukUji = notif.filter((n) => n.judul.startsWith('Uji Notif'))
  cek('5: notifikasi Uji Notif terkirim', untukUji.length === 1, JSON.stringify(notif).slice(0, 160))
  cek('5: teksnya menyebut sisa menit',
    untukUji.length === 1 && /Uji Notif \d+ menit lagi/.test(untukUji[0].judul), untukUji[0]?.judul ?? '')
  // Muat ulang: tidak dikirim dua kali.
  await B.reload({ waitUntil: 'networkidle2' })
  await wait(2500)
  const notif2 = await B.evaluate(() => window.__notif ?? [])
  cek('5: muat ulang tidak mengirim lagi (pencatat segar, nol kiriman baru)',
    notif2.filter((n) => n.judul.startsWith('Uji Notif')).length === 0, `dapat ${notif2.length}`)
  // .ics anggota.
  // ID sesi dari spanduk anggota (baris <li> hanya memuat satu sesi).
  const idUjiB = await B.evaluate(() => {
    const tombol = [...document.querySelectorAll('[data-testid^="ingat-anggota-ics-"]')]
    const milik = tombol.find((b) => b.closest('li')?.textContent.includes('Uji Ingat'))
    return milik?.getAttribute('data-testid')?.replace('ingat-anggota-ics-', '') ?? ''
  })
  const tombolIcsB = idUjiB ? await B.$(`[data-testid="ics-anggota-${idUjiB}"]`) : null
  cek('5: tombol Kalender anggota diklik', tombolIcsB != null, idUjiB)
  if (tombolIcsB) await tombolIcsB.click()
  const berkasIcsB = await tungguUnduhan('.ics')
  cek('5: .ics anggota terunduh & beralarm', berkasIcsB != null &&
    (() => {
      const isi = fs.readFileSync(berkasIcsB, 'utf8')
      const ok = isi.includes('SUMMARY:Uji Ingat') && isi.includes('TRIGGER:-P1D') && isi.includes('TRIGGER:-PT60M')
      fs.unlinkSync(berkasIcsB)
      return ok
    })())

  /* ================= 6. Layar 360px tidak melebar ================= */
  {
    await B.setViewport({ width: 360, height: 740 })
    await B.goto(`${BASE}/#/berbagi`, { waitUntil: 'networkidle2' })
    await wait(2200)
    const l = await B.evaluate(() => ({
      dok: document.documentElement.scrollWidth,
      layar: window.innerWidth,
      spanduk: document.querySelector('[data-testid="ingat-anggota-spanduk"]') != null,
    }))
    cek('6: spanduk tampil di 360px', l.spanduk, JSON.stringify(l))
    cek('6: dokumen tidak melebar', l.dok <= l.layar + 1, `dok ${l.dok} lawan layar ${l.layar}`)
  }

  cek('tidak ada galat di konsol', errors.length === 0, errors.slice(0, 3).join(' | '))
} finally {
  try { fs.unlinkSync(PAKET) } catch { /* tidak apa-apa */ }
  await browser.close()
}

console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) {
  for (const g of gagal) console.log('  ✗ ' + g)
  process.exitCode = 1
}
