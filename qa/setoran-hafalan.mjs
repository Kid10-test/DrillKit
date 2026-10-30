/**
 * #14 (Uji Peramban E2E) — Matriks Setoran Hafalan (*Music & Visual Pass-Off Tracker*).
 *
 * Menguji ujung-ke-ujung di Chromium:
 *   1. Halaman `#/evaluasi` tetap membuka tab `Evaluasi Berkala (4 Aspek)` secara bawaan,
 *      lalu beralih mulus ke `tab-setoran-hafalan`.
 *   2. Pembuatan target otomatis dari segmen lagu (`otomatis-target-lagu`) + tambah manual
 *      khusus seksi (`Cadence Battery` hanya untuk Percussion).
 *   3. Ketuk-cepat 6 jenjang pada matriks `[Anggota × Target]`, modal rincian (`penguji` +
 *      `catatan`), grafik kesiapan per seksi/target, serta ringkasan di Dashboard (`#/`).
 *   4. Mode Uji Cepat Section Leader di layar HP `390×844` (tanpa luapan horizontal),
 *      putar loop frasa WebAudio (`uji-putar-frasa`), dan ketuk pil jenjang cepat.
 *   5. Pratinjau Cetak Matriks A4 (`modal-cetak-setoran`) murni warna `#hex` (nol `oklch` /
 *      `color-mix`) dan unduhan dokumen mandiri `.html`.
 *   6. Privasi berbagi di `#/berbagi`: berkas grup memuat `targetSetoran` namun `setoran: []`,
 *      sedangkan ZIP per anggota menyaring `setoran` ketat hanya milik penerima masing-masing.
 *   7. Mode Anggota (konteks peramban segar): membuka paket `Budi`, melihat tanggungan &
 *      umpan balik di `tab-catatan` (`kartu-setoran-anggota`), lalu menekan `Latih di Musik`
 *      yang langsung membuka lagu dengan loop `Frasa 1–8` aktif!
 *   8. Ekspor & impor ulang Pusat Data (`#/data`) untuk `targetSetoran` + `setoran`.
 */
import puppeteer from 'puppeteer'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { lewatSambutan } from './sambutan.mjs'
import { bukaZip } from '/tmp/zip.mjs'

const BASE = process.env.BASE || process.argv[2] || 'http://localhost:4173'
const ORIGIN_LOKAL = new URL(BASE).origin
const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'dk-14-e2e-'))
const UNDUH = path.join(TMP_ROOT, 'unduh')
fs.mkdirSync(UNDUH, { recursive: true })

let lulus = 0
const gagal = []
function cek(nama, ok, detail = '') {
  if (ok) {
    lulus += 1
    console.log(`  ✓ ${nama}`)
  } else {
    gagal.push(`${nama}${detail ? ` (${detail})` : ''}`)
    console.error(`  ✗ ${nama}${detail ? ` — ${detail}` : ''}`)
  }
}

const tunggu = (ms) => new Promise((r) => setTimeout(r, ms))

async function tungguBerkas(dir, predikat, timeoutMs = 8000) {
  const awal = Date.now()
  while (Date.now() - awal < timeoutMs) {
    const daftar = fs.readdirSync(dir).filter((f) => !f.endsWith('.crdownload'))
    const cocok = daftar.find(predikat)
    if (cocok) return path.join(dir, cocok)
    await tunggu(120)
  }
  return null
}

console.log('== #14 Uji Peramban Matriks Setoran Hafalan ==')

const browser = await puppeteer.launch({
  headless: 'new',
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'],
})

const errors = []
const permintaanLuar = []

try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 860 })
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`)
  })
  page.on('request', (req) => {
    const u = req.url()
    if (u.startsWith('http://') || u.startsWith('https://')) {
      if (new URL(u).origin !== ORIGIN_LOKAL) permintaanLuar.push(u)
    }
  })

  const cdp = await page.target().createCDPSession()
  await cdp.send('Page.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath: UNDUH,
  })

  await page.goto(BASE, { waitUntil: 'networkidle0' })
  await lewatSambutan(page, 'coach')

  // Tanam 2 anggota aktif + 1 lagu dengan 2 segmen tempoMap
  await page.evaluate(async () => {
    const req = indexedDB.open('drillkit')
    const idb = await new Promise((res, rej) => {
      req.onsuccess = () => res(req.result)
      req.onerror = () => rej(req.error)
    })
    const tx = idb.transaction(['members', 'songs', 'targetSetoran', 'setoran'], 'readwrite')
    tx.objectStore('targetSetoran').clear()
    tx.objectStore('setoran').clear()
    tx.objectStore('members').put({
      id: 'm_andi',
      code: 'B01',
      name: 'Andi Pratama',
      section: 'brass',
      instrument: 'Trumpet',
      role: 'member',
      joinYear: 2025,
      active: 1,
      token: 'tok_rahasia_andi',
      phone: '0811111111',
      notes: 'Catatan rahasia pelatih Andi',
      createdAt: Date.now(),
    })
    tx.objectStore('members').put({
      id: 'm_budi',
      code: 'P01',
      name: 'Budi Santoso',
      section: 'percussion',
      instrument: 'Snare Drum',
      role: 'sectionLeader',
      joinYear: 2024,
      active: 1,
      token: 'tok_rahasia_budi',
      phone: '0822222222',
      notes: 'Catatan rahasia pelatih Budi',
      createdAt: Date.now(),
    })
    tx.objectStore('songs').put({
      id: 'song_mars',
      title: 'Mars Nusantara',
      composer: 'Arr. Tim',
      bpm: 132,
      beats: 4,
      panjangBirama: 16,
      tempoMap: [
        { id: 'seg_1', label: 'Intro', measure: 1, bpm: 120, beats: 4 },
        { id: 'seg_2', label: 'Reff', measure: 9, bpm: 136, beats: 4 },
      ],
      createdAt: Date.now(),
    })
    await new Promise((res, rej) => {
      tx.oncomplete = () => res()
      tx.onerror = () => rej(tx.error)
    })
    idb.close()
  })
  await page.reload({ waitUntil: 'networkidle0' })

  // 1. Buka #/evaluasi -> bawaan di tab berkala, lalu klik tab setoran hafalan
  await page.goto(`${BASE}#/evaluasi`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('[data-testid="saring-section"]')
  cek('1. #/evaluasi membuka tab Evaluasi Berkala (4 Aspek) secara bawaan', true)

  await page.click('[data-testid="tab-setoran-hafalan"]')
  await page.waitForSelector('[data-testid="panel-setoran-hafalan"]')
  cek('2. Tab Matriks Setoran Hafalan tampil bersih', true)

  // 2. Buat target otomatis dari lagu Mars Nusantara (2 segmen: Bar 1–8 & Bar 9–16)
  await page.waitForSelector('[data-testid="otomatis-target-lagu"]')
  await page.click('[data-testid="otomatis-target-lagu"]')
  await page.waitForSelector('[data-testid="tabel-matriks-setoran"]')
  await tunggu(250)

  // Tambah 1 target khusus seksi Percussion: Cadence Battery
  await page.click('[data-testid="tambah-target-setoran"]')
  await page.waitForSelector('[data-testid="modal-target-setoran"]')
  await page.type('[data-testid="input-judul-target"]', 'Cadence Battery')
  await page.select('[data-testid="pilih-kategori-target"]', 'musik')
  await page.$eval('[data-testid="input-tenggat-target"]', (el) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(el, '2026-10-01')
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await page.click('[data-testid="target-seksi-percussion"]')
  await page.click('[data-testid="simpan-target-setoran"]')
  await page.waitForFunction(() => !document.querySelector('[data-testid="modal-target-setoran"]'))
  await tunggu(200)

  const infoTarget = await page.evaluate(async () => {
    const req = indexedDB.open('drillkit')
    const idb = await new Promise((res) => { req.onsuccess = () => res(req.result) })
    const tx = idb.transaction('targetSetoran', 'readonly')
    const all = await new Promise((res) => {
      const r = tx.objectStore('targetSetoran').getAll()
      r.onsuccess = () => res(r.result)
    })
    idb.close()
    all.sort((a, b) => a.urutan - b.urutan)
    return all
  })
  cek('3. Generator lagu + tambah manual menghasilkan 3 target terurut', infoTarget.length === 3, String(infoTarget.length))

  const tIntro = infoTarget[0]
  const tCadence = infoTarget.find((t) => t.judul === 'Cadence Battery')

  // Pastikan sel Cadence untuk Andi tidak ada tombol (hanya berlaku bagi Percussion)
  const adaSelCadenceAndi = await page.$(`[data-testid="sel-setoran-${tCadence.id}-m_andi"]`)
  const adaSelCadenceBudi = await page.$(`[data-testid="sel-setoran-${tCadence.id}-m_budi"]`)
  cek('4. Target khusus Percussion hanya menagih Budi (Andi otomatis dikecualikan)', !adaSelCadenceAndi && Boolean(adaSelCadenceBudi))

  // 3. Ketuk cepat sel Intro Andi 5x sampai "Lulus"
  await page.$eval(`[data-testid="sel-setoran-${tIntro.id}-m_andi"]`, (el) =>
    el.scrollIntoView({ block: 'center', inline: 'center' }),
  )
  await tunggu(120)
  for (let i = 0; i < 5; i += 1) {
    await page.click(`[data-testid="sel-setoran-${tIntro.id}-m_andi"]`)
    await tunggu(100)
  }
  const teksSelAndi = await page.$eval(
    `[data-testid="sel-setoran-${tIntro.id}-m_andi"]`,
    (el) => el.textContent || '',
  )
  cek('5. Ketuk cepat 5x memajukan sel Andi ke jenjang puncak "Lulus ✓"', teksSelAndi.includes('Lulus') && teksSelAndi.includes('✓'), teksSelAndi)

  // Buka modal rincian untuk Budi pada Intro -> isi Tempo Latihan + catatan umpan balik
  await page.click(`[data-testid="rincian-setoran-${tIntro.id}-m_budi"]`)
  await page.waitForSelector('[data-testid="modal-rincian-setoran"]')
  await page.select('[data-testid="pilih-jenjang-rincian"]', 'tempo_latihan')
  await page.$eval('[data-testid="input-penguji-rincian"]', (el) => { el.value = '' })
  await page.type('[data-testid="input-penguji-rincian"]', 'Ketua Seksi')
  await page.type('[data-testid="input-catatan-rincian"]', 'Perhatikan aksen birama 6')
  await page.click('[data-testid="simpan-rincian-setoran"]')
  await tunggu(250)

  const adaGrafik = await page.$('[data-testid="grafik-kesiapan-seksi"]')
  cek('6. Papan grafik kesiapan per seksi & catatan sel tampil di matriks', Boolean(adaGrafik))

  // Cek ringkasan di Dashboard (#/)
  await page.goto(`${BASE}#/`, { waitUntil: 'networkidle0' })
  await tunggu(300)
  const teksDasbor = await page.evaluate(() => document.body.innerText)
  cek('7. Dashboard menampilkan baris ringkasan kesiapan Setoran hafalan', /Setoran hafalan[\s\S]*% siap/.test(teksDasbor))

  // 4. Kembali ke Setoran -> Mode Uji Cepat Section Leader di layar HP 390x844
  await page.setViewport({ width: 390, height: 844 })
  await page.goto(`${BASE}#/evaluasi?tab=setoran`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('[data-testid="mode-uji-cepat"]')
  await page.click('[data-testid="mode-uji-cepat"]')
  await page.waitForSelector('[data-testid="panel-uji-cepat"]')
  await tunggu(200)

  const luapHp = await page.evaluate(() => ({
    dok: document.documentElement.scrollWidth,
    layar: window.innerWidth,
  }))
  cek(
    '8. Mode Uji Cepat Section Leader bebas luapan horizontal pada layar HP 390px',
    luapHp.dok <= luapHp.layar + 1,
    `${luapHp.dok} vs ${luapHp.layar}`,
  )

  // Putar loop frasa lagu sambil mengetuk pil status
  await page.click('[data-testid="uji-putar-frasa"]')
  await tunggu(300)
  const statusBunyi = await page.$eval('[data-testid="uji-status-bunyi"]', (el) => el.textContent || '')
  cek('9. Pemutar loop frasa di Mode Uji Cepat berjalan & menampilkan birama aktif', /Birama\s+\d+/i.test(statusBunyi), statusBunyi)

  await page.$eval('[data-testid="uji-pil-m_budi-hafal_musik"]', (el) =>
    el.scrollIntoView({ block: 'center' }),
  )
  await tunggu(80)
  await page.click('[data-testid="uji-pil-m_budi-hafal_musik"]')
  await tunggu(180)
  await page.$eval('[data-testid="uji-putar-frasa"]', (el) =>
    el.scrollIntoView({ block: 'center' }),
  )
  await tunggu(80)
  await page.click('[data-testid="uji-putar-frasa"]') // hentikan
  await tunggu(150)

  // 5. Pratinjau Cetak Matriks A4 Hex & Unduh HTML
  await page.setViewport({ width: 1280, height: 860 })
  await page.click('[data-testid="mode-tampilan-matriks"]')
  await page.waitForSelector('[data-testid="tombol-cetak-setoran"]')
  await page.click('[data-testid="tombol-cetak-setoran"]')
  await page.waitForSelector('[data-testid="modal-cetak-setoran"]')
  const srcDoc = await page.$eval('[data-testid="iframe-cetak-setoran"]', (el) => el.getAttribute('srcdoc') || '')
  cek(
    '10. Pratinjau cetak A4 memuat nama anggota & 100% murni hex (nol oklch / color-mix)',
    srcDoc.includes('Andi Pratama') &&
      srcDoc.includes('Cadence Battery') &&
      !/oklch\(|color-mix\(/i.test(srcDoc),
  )

  await page.click('[data-testid="unduh-html-setoran"]')
  const berkasHtml = await tungguBerkas(UNDUH, (f) => f.endsWith('.html'))
  cek('11. Tombol Unduh HTML menghasilkan berkas mandiri .html bebas jalan buntu', Boolean(berkasHtml))
  await page.keyboard.press('Escape')
  await tunggu(200)

  // 6. Halaman Berbagi Pelatih: unduh berkas grup & ZIP per anggota
  await page.goto(`${BASE}#/berbagi`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('[data-testid="toggle-setoran"]')
  await page.click('[data-testid="unduh-grup"]')
  const berkasGrupPath = await tungguBerkas(UNDUH, (f) => f.endsWith('.json'))
  const isiGrup = JSON.parse(fs.readFileSync(berkasGrupPath, 'utf8'))
  cek(
    '12. Berkas grup memuat 3 targetSetoran namun mengosongkan setoran pribadi (0 bocoran)',
    isiGrup.targetSetoran?.length === 3 &&
      Array.isArray(isiGrup.setoran) &&
      isiGrup.setoran.length === 0,
  )

  await page.click('[data-testid="unduh-per-anggota"]')
  const berkasZipPath = await tungguBerkas(UNDUH, (f) => f.endsWith('.zip'))
  const entriZip = bukaZip(new Uint8Array(fs.readFileSync(berkasZipPath)))
  const entriAndi = entriZip.find((z) => z.nama.includes('Andi Pratama'))
  const entriBudi = entriZip.find((z) => z.nama.includes('Budi Santoso'))
  const jsonAndi = JSON.parse(entriAndi.teks())
  const jsonBudi = JSON.parse(entriBudi.teks())
  cek(
    '13. ZIP per anggota memisahkan setoran pribadi secara ketat (Andi hanya m_andi, Budi hanya m_budi)',
    jsonAndi.setoran.length > 0 &&
      jsonAndi.setoran.every((s) => s.memberId === 'm_andi') &&
      jsonBudi.setoran.length > 0 &&
      jsonBudi.setoran.every((s) => s.memberId === 'm_budi'),
  )

  const paketBudiPath = path.join(TMP_ROOT, 'paket-budi.json')
  fs.writeFileSync(paketBudiPath, entriBudi.teks())

  // 7. Konteks peramban segar Mode Anggota: buka paket Budi -> cek tanggungan -> klik Latih di Musik!
  const konteksAnggota = await browser.createBrowserContext()
  const pa = await konteksAnggota.newPage()
  await pa.setViewport({ width: 390, height: 844 })
  pa.on('pageerror', (e) => errors.push(`member pageerror: ${e.message}`))
  pa.on('console', (m) => {
    if (m.type() === 'error') errors.push(`member console: ${m.text()}`)
  })

  await pa.goto(BASE, { waitUntil: 'networkidle0' })
  await lewatSambutan(pa, 'member')
  await pa.waitForSelector('#pkg-input')
  const inputPaket = await pa.$('#pkg-input')
  await inputPaket.uploadFile(paketBudiPath)
  await pa.waitForSelector('[data-testid="bar-tab-anggota"]')
  await tunggu(300)

  await pa.click('[data-testid="tab-catatan"]')
  await pa.waitForSelector('[data-testid="kartu-setoran-anggota"]')
  const teksKartuBudi = await pa.$eval('[data-testid="kartu-setoran-anggota"]', (el) => el.innerText)
  cek(
    '14. Mode Anggota menampilkan jenjang "Hafal Musik", umpan balik pelatih, & penanda lewat tenggat',
    teksKartuBudi.includes('Hafal Musik') &&
      teksKartuBudi.includes('Perhatikan aksen birama 6') &&
      teksKartuBudi.includes('Lewat tenggat'),
    teksKartuBudi,
  )

  // Klik "Latih di Musik" pada target Intro (Bar 1–8)
  await pa.click(`[data-testid="latih-setoran-${tIntro.id}"]`)
  await tunggu(500)
  const teksMusikAnggota = await pa.evaluate(() => document.body.innerText)
  cek(
    '15. Tombol "Latih di Musik" melompat ke tab Musik dengan lagu Mars Nusantara & Frasa 1–8 aktif',
    teksMusikAnggota.includes('Mars Nusantara') && /1[–-]8/.test(teksMusikAnggota),
  )
  await konteksAnggota.close()

  // 8. Pusat Data (#/data): ekspor & pastikan jenis targetSetoran + setoran terdaftar
  await page.goto(`${BASE}#/data`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('[data-testid="centang-jenis-targetSetoran"]')
  const adaCentangSetoran = await page.$('[data-testid="centang-jenis-setoran"]')
  cek('16. Pusat Data (#/data) menyediakan ekspor/impor untuk Target setoran & Setoran hafalan', Boolean(adaCentangSetoran))

  cek('17. Nol galat konsol/halaman sepanjang alur E2E #14', errors.length === 0, errors.join(' | '))
  cek('18. Nol permintaan jaringan eksternal (100% luring)', permintaanLuar.length === 0, permintaanLuar.join(', '))
} finally {
  await browser.close()
  fs.rmSync(TMP_ROOT, { recursive: true, force: true })
}

console.log(`\nRingkasan #14 Peramban: ${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length > 0) process.exit(1)
