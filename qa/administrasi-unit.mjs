/**
 * Rangkaian uji E2E peramban #21 — Audisi Anggota Baru (#21a), Generator Surat Dispensasi
 * & Kartu Medis AES-256-GCM (#21b), serta Buku Kas/Iuran TC & Season Rollover (#21c) (v2.1.0).
 */
import puppeteer from 'puppeteer'
import { lewatSambutan } from './sambutan.mjs'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const BASE = (process.env.BASE || process.argv[2] || 'http://localhost:4173').replace(/\/+$/, '')
const EXEC = process.env.PUPPETEER_EXECUTABLE_PATH || undefined
const tunggu = (ms) => new Promise((r) => setTimeout(r, ms))

const UNDUH = path.join(os.tmpdir(), `unduh-admin21-${Date.now()}`)
fs.mkdirSync(UNDUH, { recursive: true })

let lulus = 0
let gagal = 0
function cek(kondisi, pesan, detail = '') {
  if (kondisi) {
    lulus += 1
    console.log(`  ✓ ${pesan}`)
  } else {
    gagal += 1
    console.error(`  ✗ GAGAL: ${pesan}${detail ? ' -> ' + detail : ''}`)
  }
}

const browser = await puppeteer.launch({
  executablePath: EXEC,
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  defaultViewport: { width: 1360, height: 920 },
})

const galatKonsol = []
const page = await browser.newPage()
page.on('pageerror', (e) => galatKonsol.push(`pageerror: ${e.message}`))
page.on('console', (m) => {
  if (m.type() === 'error') galatKonsol.push(`console.error: ${m.text()}`)
})

const cdp = await page.target().createCDPSession()
await cdp.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: UNDUH })

async function tungguBerkasUnduhan(filterFn, batasMs = 10000) {
  const mulai = Date.now()
  while (Date.now() - mulai < batasMs) {
    const daftar = fs.readdirSync(UNDUH).filter((f) => !f.endsWith('.crdownload') && filterFn(f))
    if (daftar.length > 0) return path.join(UNDUH, daftar[0])
    await tunggu(200)
  }
  return null
}

try {
  await page.goto(BASE, { waitUntil: 'networkidle2' })
  await lewatSambutan(page)
  await tunggu(1200)

  // Muat data contoh tim
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Muat data contoh'),
    )
    btn?.click()
  })
  await tunggu(3500)

  const jmlAnggotaAwal = await page.evaluate(async () => {
    const req = indexedDB.open('drillkit')
    const db = await new Promise((res) => {
      req.onsuccess = () => res(req.result)
    })
    return await new Promise((res) => {
      const q = db.transaction(['members'], 'readonly').objectStore('members').count()
      q.onsuccess = () => res(q.result)
    })
  })
  cek(jmlAnggotaAwal > 0, 'Data contoh berhasil dimuat ke IndexedDB', `members=${jmlAnggotaAwal}`)

  /* ---------------- 1. #21a Audisi & Promosi 1-Klik ---------------- */
  await page.goto(`${BASE}/#/anggota?tab=audisi`, { waitUntil: 'networkidle2' })
  await page.waitForSelector('[data-testid="panel-audisi-anggota"]', { timeout: 10000 })
  await page.click('[data-testid="muat-contoh-audisi"]')
  await page.waitForSelector('[data-testid="tabel-peringkat-audisi"]', { timeout: 8000 })
  await tunggu(600)

  // Saring peminatan Brass
  await page.select('[data-testid="filter-seksi-audisi"]', 'brass')
  await tunggu(400)
  const teksTabelAudisi = await page.$eval(
    '[data-testid="tabel-peringkat-audisi"]',
    (el) => el.textContent || '',
  )
  cek(
    teksTabelAudisi.includes('Raka Mahendra') && !teksTabelAudisi.includes('Nadia Kusumawardani'),
    'Filter peminatan seksi Brass menyaring calon secara akurat',
  )

  // Luluskan 1-klik calon peringkat #1 (Raka Mahendra)
  await page.evaluate(() => {
    const tombol = document.querySelector('[data-testid^="luluskan-calon-"]')
    tombol?.click()
  })
  await tunggu(900)

  const anggotaRaka = await page.evaluate(async () => {
    const req = indexedDB.open('drillkit')
    const db = await new Promise((res) => {
      req.onsuccess = () => res(req.result)
    })
    const semua = await new Promise((res) => {
      const q = db.transaction(['members'], 'readonly').objectStore('members').getAll()
      q.onsuccess = () => res(q.result)
    })
    return semua.find((m) => m.name === 'Raka Mahendra') || null
  })
  cek(
    !!anggotaRaka && anggotaRaka.instansiAsal === 'SMA Negeri 3 Yogyakarta',
    'Promosi 1-klik menambahkan Raka Mahendra ke anggota aktif lengkap instansiAsal',
    JSON.stringify(anggotaRaka?.code),
  )

  await page.click('[data-testid="pratinjau-cetak-audisi"]')
  await page.waitForSelector('[data-testid="iframe-pratinjau-audisi"]', { timeout: 6000 })
  const htmlAudisi = await page.$eval('[data-testid="iframe-pratinjau-audisi"]', (el) =>
    el.getAttribute('srcdoc') || '',
  )
  cek(
    htmlAudisi.includes('Raka Mahendra') && !/oklch\(|color-mix\(|rgba\(/i.test(htmlAudisi),
    'Pratinjau cetak A4 Rekap Audisi tampil bersih & 100% warna #hex murni',
  )
  await page.keyboard.press('Escape')
  await tunggu(400)

  /* ---------------- 2. #21b Generator Surat Dispensasi A4 ---------------- */
  await page.click('[data-testid="tab-administrasi-medis"]')
  await page.waitForSelector('[data-testid="bagian-surat-dispensasi"]', { timeout: 10000 })
  await tunggu(500)

  // Isi instansi berbeda pada anggota aktif pertama selain Raka agar terbentuk multi-surat
  await page.evaluate((idRaka) => {
    const inputs = [...document.querySelectorAll('input[data-testid^="input-instansi-"]')]
    const target = inputs.find((inp) => inp.getAttribute('data-testid') !== `input-instansi-${idRaka}`)
    if (target) {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
      setter?.call(target, 'Fakultas Teknik UGM')
      target.dispatchEvent(new Event('input', { bubbles: true }))
      target.dispatchEvent(new Event('change', { bubbles: true }))
    }
  }, anggotaRaka.id)
  await tunggu(700)

  const teksRingkasanInstansi = await page.$eval(
    '[data-testid="ringkasan-instansi-dispensasi"]',
    (el) => el.textContent || '',
  )
  cek(
    teksRingkasanInstansi.includes('SMA Negeri 3 Yogyakarta') &&
      teksRingkasanInstansi.includes('Fakultas Teknik UGM'),
    'Generator dispensasi otomatis mengelompokkan peserta per sekolah/fakultas tujuan',
  )

  await page.click('[data-testid="pratinjau-surat-dispensasi"]')
  await page.waitForSelector('[data-testid="iframe-pratinjau-dispensasi"]', { timeout: 6000 })
  const htmlDispensasi = await page.$eval('[data-testid="iframe-pratinjau-dispensasi"]', (el) =>
    el.getAttribute('srcdoc') || '',
  )
  cek(
    htmlDispensasi.includes('pisah-halaman') &&
      htmlDispensasi.includes('SMA Negeri 3 Yogyakarta') &&
      htmlDispensasi.includes('Fakultas Teknik UGM') &&
      !/oklch\(|color-mix\(|rgba\(/i.test(htmlDispensasi),
    'Surat Dispensasi A4 menghasilkan halaman terpisah per instansi & 100% #hex murni',
  )
  await page.keyboard.press('Escape')
  await tunggu(400)

  /* ---------------- 3. #21b Kartu Medis & Enkripsi Sandi AES-256-GCM ---------------- */
  await page.click('[data-testid="subtab-medis"]')
  await page.waitForSelector('[data-testid="bagian-kartu-medis"]', { timeout: 8000 })
  await page.click(`[data-testid="isi-medis-${anggotaRaka.id}"]`)
  await page.waitForSelector('[data-testid="modal-kartu-medis"]', { timeout: 6000 })

  await page.select('[data-testid="select-goldarah-medis"]', 'O+')
  await page.type('[data-testid="input-alergi-obat"]', 'Penisilin Darurat')
  await page.type('[data-testid="input-riwayat-medis"]', 'Asma ringan udara dingin')
  await page.type('[data-testid="input-wali-medis"]', 'Ibu Sari Mahendra')
  await page.type('[data-testid="input-telp-wali-medis"]', '081999888777')
  await page.click('[data-testid="simpan-kartu-medis"]')
  await tunggu(700)

  const teksBarisMedis = await page.$eval(
    `[data-testid="baris-medis-${anggotaRaka.id}"]`,
    (el) => el.textContent || '',
  )
  cek(
    teksBarisMedis.includes('Penisilin Darurat') && teksBarisMedis.includes('081999888777'),
    'Kartu medis & kontak darurat wali tersimpan dan langsung disorot sebagai perhatian khusus',
  )

  // Ekspor arsip medis terenkripsi AES-256-GCM
  for (const f of fs.readdirSync(UNDUH)) fs.rmSync(path.join(UNDUH, f), { force: true })
  await page.click('[data-testid="ekspor-medis-sandi"]')
  await page.waitForSelector('[data-testid="input-sandi-medis"]', { timeout: 5000 })
  await page.type('[data-testid="input-sandi-medis"]', 'MedisAman2026')
  await page.click('[data-testid="konfirmasi-sandi-medis"]')

  const berkasMedisSandi = await tungguBerkasUnduhan((f) => f.startsWith('medis-terenkripsi-'))
  cek(!!berkasMedisSandi, 'Berkas arsip medis terenkripsi AES-256-GCM berhasil diunduh')
  const isiJsonMedis = fs.readFileSync(berkasMedisSandi, 'utf8')
  cek(
    !isiJsonMedis.includes('Penisilin Darurat') && !isiJsonMedis.includes('081999888777'),
    'Berkas ekspor medis terenkripsi tidak memuat plaintext alergi/nomor wali sedikit pun',
  )

  // Hapus kartu medis di DB lalu pulihkan dari berkas terenkripsi
  await page.evaluate(async () => {
    const req = indexedDB.open('drillkit')
    const db = await new Promise((res) => {
      req.onsuccess = () => res(req.result)
    })
    const tx = db.transaction(['medisAnggota'], 'readwrite')
    tx.objectStore('medisAnggota').clear()
    await new Promise((res) => {
      tx.oncomplete = res
    })
  })
  await page.reload({ waitUntil: 'networkidle2' })
  await page.click('[data-testid="subtab-medis"]')
  await tunggu(600)

  const inputMedisFile = await page.$('input[type="file"][accept=".json,application/json"]')
  await inputMedisFile.uploadFile(berkasMedisSandi)
  await page.waitForSelector('[data-testid="input-sandi-medis"]', { timeout: 6000 })
  await page.type('[data-testid="input-sandi-medis"]', 'MedisAman2026')
  await page.click('[data-testid="konfirmasi-sandi-medis"]')
  await tunggu(800)

  const teksPulihMedis = await page.$eval(
    `[data-testid="baris-medis-${anggotaRaka.id}"]`,
    (el) => el.textContent || '',
  )
  cek(
    teksPulihMedis.includes('Penisilin Darurat') && teksPulihMedis.includes('081999888777'),
    'Arsip medis terenkripsi AES-256-GCM berhasil didekripsi & dipulihkan utuh di peramban',
  )

  /* ---------------- 4. #21c Buku Kas / Iuran TC & Kwitansi ---------------- */
  await page.click('[data-testid="tab-kas-iuran"]')
  await page.waitForSelector('[data-testid="panel-kas-iuran"]', { timeout: 10000 })
  await page.click(`[data-testid="bayar-cepat-${anggotaRaka.id}"]`)
  await page.waitForSelector('[data-testid="modal-transaksi-kas"]', { timeout: 6000 })
  await page.click('[data-testid="simpan-transaksi-kas"]')
  await tunggu(700)

  const saldoTeks = await page.$eval('[data-testid="saldo-akhir-kas"]', (el) => el.textContent || '')
  const barisIuranRaka = await page.$eval(
    `[data-testid="baris-iuran-${anggotaRaka.id}"]`,
    (el) => el.textContent || '',
  )
  cek(
    saldoTeks.includes('Rp350.000') && barisIuranRaka.includes('LUNAS'),
    'Setoran iuran TC memperbarui saldo kas unit & menandai anggota LUNAS seketika',
    `${saldoTeks} | ${barisIuranRaka}`,
  )

  await page.click(`[data-testid="cetak-kwitansi-${anggotaRaka.id}"]`)
  await page.waitForSelector('[data-testid="iframe-pratinjau-kwitansi"]', { timeout: 6000 })
  const htmlKwitansi = await page.$eval('[data-testid="iframe-pratinjau-kwitansi"]', (el) =>
    el.getAttribute('srcdoc') || '',
  )
  cek(
    htmlKwitansi.includes('KWT-') &&
      htmlKwitansi.includes('Raka Mahendra') &&
      !/oklch\(|color-mix\(|rgba\(/i.test(htmlKwitansi),
    'Kwitansi pembayaran iuran tampil bernomor resmi & 100% warna #hex murni',
  )
  await page.keyboard.press('Escape')
  await tunggu(400)

  /* ---------------- 5. Pagar Privasi Paket Grup & Season Rollover ---------------- */
  for (const f of fs.readdirSync(UNDUH)) fs.rmSync(path.join(UNDUH, f), { force: true })
  await page.goto(`${BASE}/#/berbagi`, { waitUntil: 'networkidle2' })
  await page.waitForSelector('[data-testid="unduh-grup"]', { timeout: 10000 })
  await page.click('[data-testid="unduh-grup"]')

  const berkasPaketGrup = await tungguBerkasUnduhan((f) => f.endsWith('.json'))
  cek(!!berkasPaketGrup, 'Paket grup berhasil diunduh di halaman Berbagi')
  const teksPaketGrup = fs.readFileSync(berkasPaketGrup, 'utf8')
  cek(
    !teksPaketGrup.includes('Penisilin Darurat') &&
      !teksPaketGrup.includes('081999888777') &&
      !teksPaketGrup.includes('SMA Negeri 3 Yogyakarta') &&
      !teksPaketGrup.includes('Iuran TC Kejuaraan') &&
      !teksPaketGrup.includes('Nadia Kusumawardani'),
    'PAGAR PRIVASI E2E: Paket grup sama sekali tidak membocorkan kartu medis, NIS/sekolah, kas, maupun audisi',
  )

  // Season Rollover di Pengaturan
  await page.goto(`${BASE}/#/pengaturan`, { waitUntil: 'networkidle2' })
  await page.waitForSelector('[data-testid="panel-arsip-musim"]', { timeout: 12000 })
  await page.$eval('[data-testid="input-nama-musim"]', (el) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
    setter?.call(el, 'Musim Kejuaraan GPMB 2026')
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await page.type('[data-testid="input-catatan-musim"]', 'Juara Umum 2 Divisi Open')
  await page.click('[data-testid="buka-konfirmasi-rollover"]')
  await page.waitForSelector('[data-testid="konfirmasi-bekukan-musim"]', { timeout: 6000 })
  await page.click('[data-testid="konfirmasi-bekukan-musim"]')
  await tunggu(1200)

  const pascaRollover = await page.evaluate(async () => {
    const req = indexedDB.open('drillkit')
    const db = await new Promise((res) => {
      req.onsuccess = () => res(req.result)
    })
    const hitung = (nama) =>
      new Promise((res) => {
        const q = db.transaction([nama], 'readonly').objectStore(nama).count()
        q.onsuccess = () => res(q.result)
      })
    return {
      members: await hitung('members'),
      medisAnggota: await hitung('medisAnggota'),
      arsipMusim: await hitung('arsipMusim'),
      drills: await hitung('drills'),
      sessions: await hitung('sessions'),
      kasIuran: await hitung('kasIuran'),
      audisi: await hitung('audisi'),
    }
  })
  cek(
    pascaRollover.arsipMusim === 1 &&
      pascaRollover.drills === 0 &&
      pascaRollover.sessions === 0 &&
      pascaRollover.kasIuran === 0 &&
      pascaRollover.audisi === 0 &&
      pascaRollover.members === jmlAnggotaAwal + 1 &&
      pascaRollover.medisAnggota === 1,
    'Season Rollover membekukan musim ke arsip & membersihkan tabel musiman sambil menjaga anggota aktif & medis tetap utuh',
    JSON.stringify(pascaRollover),
  )

  // Uji pratinjau Piagam A4 & Muat Ulang arsip musim (anti-jalan-buntu)
  await page.evaluate(() => {
    document.querySelector('[data-testid^="piagam-musim-"]')?.click()
  })
  await page.waitForSelector('[data-testid="iframe-pratinjau-piagam-musim"]', { timeout: 6000 })
  const htmlPiagam = await page.$eval('[data-testid="iframe-pratinjau-piagam-musim"]', (el) =>
    el.getAttribute('srcdoc') || '',
  )
  cek(
    htmlPiagam.includes('Musim Kejuaraan GPMB 2026') &&
      !/oklch\(|color-mix\(|rgba\(/i.test(htmlPiagam),
    'Piagam Arsip Musim A4 tampil utuh & 100% warna #hex murni',
  )
  await page.keyboard.press('Escape')
  await tunggu(400)

  await page.evaluate(() => {
    document.querySelector('[data-testid^="muat-ulang-musim-"]')?.click()
  })
  await tunggu(1200)
  const drillsPulih = await page.evaluate(async () => {
    const req = indexedDB.open('drillkit')
    const db = await new Promise((res) => {
      req.onsuccess = () => res(req.result)
    })
    return await new Promise((res) => {
      const q = db.transaction(['drills'], 'readonly').objectStore('drills').count()
      q.onsuccess = () => res(q.result)
    })
  })
  cek(drillsPulih > 0, 'Tombol Muat Ulang di Arsip Musim memulihkan kembali drill & data musim tanpa jalan buntu')

  cek(galatKonsol.length === 0, 'Tidak ada pageerror maupun console.error sepanjang alur #21', galatKonsol.join(' | '))
} finally {
  await browser.close()
  fs.rmSync(UNDUH, { recursive: true, force: true })
}

console.log(`\nadministrasi-unit: ${lulus} lulus, ${gagal} gagal`)
process.exit(gagal > 0 ? 1 : 0)
