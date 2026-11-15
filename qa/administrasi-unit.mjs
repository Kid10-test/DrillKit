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

async function bacaIdb(page, fn) {
  return page.evaluate(async (badan) => {
    const req = indexedDB.open('drillkit')
    const db = await new Promise((res) => {
      req.onsuccess = () => res(req.result)
    })
    const semua = (nama) =>
      new Promise((res) => {
        const q = db.transaction([nama], 'readonly').objectStore(nama).getAll()
        q.onsuccess = () => res(q.result)
      })
    const hasil = await new Function('semua', `return (async () => { ${badan} })()`)(semua)
    db.close()
    return hasil
  }, fn)
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

  // v2.10 — satu berkas partitur untuk lagu musim ini: harus selamat melewati pindah musim.
  const laguBerkas = await page.evaluate(async () => {
    const req = indexedDB.open('drillkit')
    const db = await new Promise((res) => {
      req.onsuccess = () => res(req.result)
    })
    const lagu = await new Promise((res) => {
      const q = db.transaction(['songs'], 'readonly').objectStore('songs').getAll()
      q.onsuccess = () => res(q.result[0])
    })
    if (!lagu) return null
    await new Promise((res) => {
      const tx = db.transaction(['partiturBerkas'], 'readwrite')
      tx.objectStore('partiturBerkas').put({
        id: lagu.id, songId: lagu.id, blob: new Blob(['<score-partwise/>'], { type: 'application/xml' }),
        namaFile: 'uji.musicxml', tipe: 'musicxml', ukuran: 17, hash: 'uji', updatedAt: Date.now(),
      })
      tx.oncomplete = () => res()
    })
    db.close()
    return lagu.id
  })
  cek(!!laguBerkas, 'Berkas partitur uji tertanam pada lagu musim berjalan')

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
  // v2.10 — tombol bekukan terkunci sampai backup akhir musim diunduh.
  cek(
    await page.$eval('[data-testid="konfirmasi-bekukan-musim"]', (el) => el.disabled),
    'Bekukan musim terkunci sebelum backup akhir musim diunduh',
  )
  for (const f of fs.readdirSync(UNDUH)) fs.rmSync(path.join(UNDUH, f), { force: true })
  await page.click('[data-testid="unduh-backup-akhir-musim"]')
  const berkasAkhir = await tungguBerkasUnduhan((f) => f.includes('BACKUP AKHIR MUSIM') && f.endsWith('.zip'), 20000)
  cek(
    !!berkasAkhir && path.basename(berkasAkhir).includes('Musim Kejuaraan GPMB 2026') && fs.statSync(berkasAkhir).size > 1000,
    'Backup ZIP akhir musim terunduh dengan nama musimnya',
    berkasAkhir ? path.basename(berkasAkhir) : 'tidak ada berkas',
  )
  await page.waitForFunction(
    () => !document.querySelector('[data-testid="konfirmasi-bekukan-musim"]')?.disabled,
    { timeout: 8000 },
  )
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
      partiturBerkas: await hitung('partiturBerkas'),
    }
  })
  cek(
    pascaRollover.arsipMusim === 1 &&
      pascaRollover.drills === 0 &&
      pascaRollover.sessions === 0 &&
      pascaRollover.kasIuran <= 1 &&
      pascaRollover.audisi === 0 &&
      pascaRollover.members === jmlAnggotaAwal + 1 &&
      pascaRollover.medisAnggota === 1,
    'Season Rollover membekukan musim ke arsip & membersihkan tabel musiman sambil menjaga data anggota & medis tetap utuh',
    JSON.stringify(pascaRollover),
  )
  cek(pascaRollover.partiturBerkas >= 1, 'v2.10 — berkas partitur tidak ikut terhapus saat pindah musim', JSON.stringify(pascaRollover))

  const pascaDetail = await bacaIdb(
    page,
    `const m = await semua('members'); const k = await semua('kasIuran'); const a = (await semua('arsipMusim'))[0]
     return { aktif: m.filter((x) => x.active === 1).length, kas: k, saldoArsip: a.ringkasan.saldoAkhirKas }`,
  )
  cek(pascaDetail.aktif === 0, 'v2.10 — semua anggota nonaktif sesudah pindah musim', `aktif=${pascaDetail.aktif}`)
  const saldoBaru = pascaDetail.kas[0]
  cek(
    pascaDetail.saldoArsip === 0
      ? pascaDetail.kas.length === 0
      : pascaDetail.kas.length === 1 &&
          saldoBaru.nominal === Math.abs(pascaDetail.saldoArsip) &&
          saldoBaru.nomorKwitansi === 'SALDO-AWAL',
    'v2.10 — saldo akhir kas terbawa sebagai satu transaksi saldo awal',
    JSON.stringify(pascaDetail),
  )

  // v2.10 — banner di Anggota & aktifkan kembali secara massal.
  await page.goto(`${BASE}/#/anggota`, { waitUntil: 'networkidle2' })
  await page.waitForSelector('[data-testid="banner-musim-baru"]', { timeout: 8000 })
  cek(true, 'v2.10 — Anggota menampilkan petunjuk mengaktifkan lagi anggota yang lanjut')
  await page.click('[data-testid="mulai-aktifkan-lagi"]')
  await tunggu(500)
  const opsiAngkatan = await page.$$eval('[data-testid="filter-tag-anggota"] option', (os) =>
    os.map((o) => o.value).filter((v) => v.startsWith('angkatan:')),
  )
  cek(opsiAngkatan.length > 0, 'v2.10 — saringan Anggota memuat pilihan per angkatan', JSON.stringify(opsiAngkatan))
  if (opsiAngkatan.length) {
    await page.select('[data-testid="filter-tag-anggota"]', opsiAngkatan[0])
    await tunggu(300)
    await page.click('[data-testid="pilih-semua-tampil"]')
    await tunggu(200)
    await page.click('[data-testid="massal-aktifkan"]')
    await tunggu(800)
    const th = Number(opsiAngkatan[0].slice(9))
    const aktifLagi = await bacaIdb(
      page,
      `const m = await semua('members'); return { aktif: m.filter((x) => x.active === 1).map((x) => x.joinYear), seangkatan: m.filter((x) => x.joinYear === ${th}).length }`,
    )
    cek(
      aktifLagi.aktif.length === aktifLagi.seangkatan && aktifLagi.aktif.every((y) => y === th),
      'v2.10 — aktifkan kembali massal per angkatan hanya menyentuh angkatan itu',
      JSON.stringify(aktifLagi),
    )
  }

  // v2.10 — halaman Jadwal kosong menunjuk ke arsip.
  await page.goto(`${BASE}/#/jadwal`, { waitUntil: 'networkidle2' })
  await page.waitForSelector('[data-testid="petunjuk-ambil-jadwal"]', { timeout: 8000 })
  cek(true, 'v2.10 — Jadwal kosong menunjuk ke Ambil dari arsip')

  // v2.10 — Ambil dari arsip: satu drill + satu sesi jadwal, ditambahkan tanpa menimpa.
  await page.goto(`${BASE}/#/pengaturan`, { waitUntil: 'networkidle2' })
  await page.waitForSelector('[data-testid^="ambil-arsip-"]', { timeout: 12000 })
  await page.click('[data-testid^="ambil-arsip-"]')
  await page.waitForSelector('[data-testid="modal-ambil-arsip"]', { timeout: 6000 })
  await page.click('[data-testid="ambil-drill"] input[type="checkbox"]')
  await page.click('[data-testid="ambil-jadwal"] input[type="checkbox"]')
  await tunggu(300)
  const ringkasAmbil = await page.$eval('[data-testid="ringkasan-ambil"]', (el) => el.textContent || '')
  cek(/1 drill/.test(ringkasAmbil) && /1 sesi jadwal/.test(ringkasAmbil), 'Ringkasan Ambil dari arsip menyebut 1 drill & 1 sesi', ringkasAmbil)
  await page.click('[data-testid="tambahkan-dari-arsip"]')
  await tunggu(1000)
  const pascaAmbil = await bacaIdb(
    page,
    `const d = await semua('drills'); const s = await semua('sessions'); const st = await semua('sets')
     return { drills: d.length, sesi: s, sets: st.length, drillSet: d[0] ? st.filter((x) => x.drillId === d[0].id).length : 0 }`,
  )
  cek(
    pascaAmbil.drills === 1 && pascaAmbil.sesi.length === 1 && pascaAmbil.drillSet === pascaAmbil.sets,
    'v2.10 — Ambil dari arsip menambahkan drill (dengan set-nya) & satu sesi jadwal',
    JSON.stringify({ ...pascaAmbil, sesi: pascaAmbil.sesi.length }),
  )
  const sesiAmbil = pascaAmbil.sesi[0]
  cek(
    sesiAmbil && sesiAmbil.date >= new Date(Date.now() - 4 * 864e5).toISOString().slice(0, 10) &&
      (sesiAmbil.checklist ?? []).every((c) => c.done === 0),
    'v2.10 — sesi hasil ambil digeser ke musim ini & centang checklist dikosongkan',
    JSON.stringify(sesiAmbil && { date: sesiAmbil.date }),
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

  for (const f of fs.readdirSync(UNDUH)) fs.rmSync(path.join(UNDUH, f), { force: true })
  await page.evaluate(() => {
    document.querySelector('[data-testid^="muat-ulang-musim-"]')?.click()
  })
  await page.waitForSelector('[data-testid="konfirmasi-muat-ulang-musim"]', { timeout: 6000 })
  await page.click('[data-testid="konfirmasi-muat-ulang-musim"]')
  const backupMuat = await tungguBerkasUnduhan((f) => f.endsWith('.zip'), 20000)
  cek(!!backupMuat, 'v2.10 — Muat Ulang mengunduh backup isi musim berjalan sebelum menimpa')
  await tunggu(1500)
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

  // v2.10 — hapus arsip: berkas partitur yang masih dipakai musim berjalan tetap ada.
  await page.click('[data-testid^="hapus-arsip-"]')
  await page.waitForSelector('[data-testid="konfirmasi-hapus-arsip"]', { timeout: 6000 })
  await page.click('[data-testid="konfirmasi-hapus-arsip"]')
  await tunggu(1000)
  const pascaHapus = await bacaIdb(
    page,
    `return { arsip: (await semua('arsipMusim')).length, partitur: (await semua('partiturBerkas')).map((p) => p.id) }`,
  )
  cek(
    pascaHapus.arsip === 0 && pascaHapus.partitur.includes(laguBerkas),
    'v2.10 — hapus arsip tidak menghapus berkas yang masih dirujuk musim berjalan',
    JSON.stringify(pascaHapus),
  )

  cek(galatKonsol.length === 0, 'Tidak ada pageerror maupun console.error sepanjang alur #21', galatKonsol.join(' | '))
} finally {
  await browser.close()
  fs.rmSync(UNDUH, { recursive: true, force: true })
}

console.log(`\nadministrasi-unit: ${lulus} lulus, ${gagal} gagal`)
process.exit(gagal > 0 ? 1 : 0)
