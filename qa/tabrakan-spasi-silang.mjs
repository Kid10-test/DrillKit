/**
 * #24 (`v2.2.2`) — Uji E2E Puppeteer:
 *  - #24.1 & #24.2 Pemeriksa Tabrakan Lintasan & Properti terpadu di dalam kartu
 *          `Analitik gerakan & keselamatan` (nol kartu kembar), cincin peringatan `#hex`
 *          di kanvas (`lapisan-tabrakan-kanvas`), penanda tik pada scrubber
 *          (`penanda-tabrakan-scrubber`), serta klik-lompat scrubber ke hitungan benturan.
 *  - #24.4 Penyelesai Silang 1-Klik (`panel-tukar-silang`), pratinjau panah zamrud `#10b981`
 *          di kanvas (`lapisan-pratinjau-tukar`), pertukaran tujuan `⇄ Tukar` yang langsung
 *          menghapus silang & tabrakan, serta `Ctrl+Z` (Undo 1 langkah tanpa berpindah set).
 *  - #24.3 Pemeriksa Kerataan Interval Barisan (`panel-kerataan-spasi`), tombol `⌗ Ratakan spasi`,
 *          serta `⟋ Ikat ke Garis #22` yang langsung mengikat barisan ke Bentuk Hidup (`#22`).
 *  - Integrasi Palet Perintah `Ctrl+K` & ketahanan tata letak layar sempit `360px`.
 */
import puppeteer from 'puppeteer'
import { lewatSambutan } from './sambutan.mjs'

const BASE = process.env.BASE || 'http://localhost:4173'
const tunggu = (ms) => new Promise((r) => setTimeout(r, ms))

let lulus = 0
let gagal = 0
function cek(kondisi, pesan) {
  if (kondisi) {
    lulus += 1
    console.log(`  ✓ ${pesan}`)
  } else {
    gagal += 1
    console.error(`  ✗ GAGAL: ${pesan}`)
  }
}

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
})

try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 960 })
  const galat = []
  page.on('pageerror', (e) => galat.push(e.message))

  await page.goto(BASE, { waitUntil: 'networkidle0' })
  await lewatSambutan(page)
  await tunggu(600)

  // Tanam drill uji deterministik di IndexedDB `drillkit`:
  // - 4 pemain Brass dalam 1 barisan y=22 dengan spasi melenceng (-6, -3.5, +1.5, +6)
  // - Pasangan u24_1 & u24_4 menyilang X simetris menuju Set 2 sehingga beradu tepat di count 4!
  await page.evaluate(async () => {
    const bukaDb = () =>
      new Promise((resolve, reject) => {
        const req = indexedDB.open('drillkit')
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      })
    const db = await bukaDb()
    const tx = db.transaction(['members', 'drills', 'sets'], 'readwrite')
    const stMembers = tx.objectStore('members')
    const stDrills = tx.objectStore('drills')
    const stSets = tx.objectStore('sets')

    const anggota = [
      { id: 'u24_1', name: 'Brass Satu', code: 'X1', section: 'brass', instrument: 'Trumpet', role: 'member', joinYear: 2026, active: 1 },
      { id: 'u24_2', name: 'Brass Dua', code: 'X2', section: 'brass', instrument: 'Trumpet', role: 'member', joinYear: 2026, active: 1 },
      { id: 'u24_3', name: 'Brass Tiga', code: 'X3', section: 'brass', instrument: 'Trumpet', role: 'member', joinYear: 2026, active: 1 },
      { id: 'u24_4', name: 'Brass Empat', code: 'X4', section: 'brass', instrument: 'Trumpet', role: 'member', joinYear: 2026, active: 1 },
    ]
    for (const m of anggota) stMembers.put(m)

    const kini = Date.now() + 120_000
    stDrills.put({
      id: 'drill_uji_24',
      name: 'Uji Tabrakan & 2-Opt #24',
      showTitle: 'Uji #24',
      tempo: 120,
      beatsPerCount: 1,
      rosterIds: ['u24_1', 'u24_2', 'u24_3', 'u24_4'],
      createdAt: kini,
      updatedAt: kini,
      field: {
        widthYd: 53.33,
        lengthYd: 100,
        endZoneYd: 10,
        hash: 'ncaa',
        gridYd: 5,
        step: '8to5',
        customStepYd: 0.625,
        showLabels: 1,
      },
    })

    // Set 1: barisan y=22 tidak rata (-6, -3.5, +1.5, +6 yd); X1 & X4 menyilang X ke Set 2!
    stSets.put({
      id: 'set24_1',
      drillId: 'drill_uji_24',
      order: 0,
      name: 'Set 1',
      counts: 8,
      notes: '',
      points: {
        u24_1: { x: -6, y: 22, facing: 'front' },
        u24_2: { x: -3.5, y: 22, facing: 'front' },
        u24_3: { x: 1.5, y: 22, facing: 'front' },
        u24_4: { x: 6, y: 22, facing: 'front' },
      },
    })
    stSets.put({
      id: 'set24_2',
      drillId: 'drill_uji_24',
      order: 1,
      name: 'Set 2',
      counts: 8,
      notes: '',
      points: {
        u24_1: { x: 6, y: 12, facing: 'front' },
        u24_2: { x: -2, y: 8, facing: 'front' },
        u24_3: { x: 2, y: 8, facing: 'front' },
        u24_4: { x: -6, y: 12, facing: 'front' },
      },
    })

    await new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(true)
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  })

  // Muat ulang ke #/drill agar Dexie useLiveQuery membaca transaksi IDB mentah secara segar
  await page.goto(`${BASE}/#/drill`, { waitUntil: 'networkidle0' })
  await page.reload({ waitUntil: 'networkidle0' })
  await page.waitForSelector('[data-testid="kanvas-drill-svg"]', { timeout: 15000 })
  await page.waitForSelector('[data-testid="panel-tabrakan-lintasan"]', { timeout: 10000 })
  await tunggu(600)

  /* ---- 1. Audit Integrasi Anti-Overlap & Indikator #hex ---- */
  const auditAwal = await page.evaluate(() => {
    const kartuAnalitik = [...document.querySelectorAll('h2')].filter((h) =>
      /Analitik gerakan/i.test(h.textContent || ''),
    )
    const lencana = document.querySelector('[data-testid="lencana-ringkas-tabrakan"]')?.textContent || ''
    const jmlCincin = document.querySelectorAll('[data-testid^="cincin-tabrakan-"]').length
    const jmlTikScrubber = document.querySelectorAll('[data-testid^="tik-benturan-"]').length
    const jmlSaranTukar = document.querySelectorAll('[data-testid^="baris-tukar-silang-"]').length
    const jmlTemuanSpasi = document.querySelectorAll('[data-testid^="baris-temuan-spasi-"]').length
    const svgHtml = document.querySelector('[data-testid="kanvas-drill-svg"]')?.outerHTML || ''
    return {
      jmlKartuAnalitik: kartuAnalitik.length,
      lencana,
      jmlCincin,
      jmlTikScrubber,
      jmlSaranTukar,
      jmlTemuanSpasi,
      svgMurniHex: !/oklch\(|color-mix\(|rgba\(/i.test(svgHtml),
    }
  })

  cek(
    auditAwal.jmlKartuAnalitik === 1,
    'Anti-overlap #24: seluruh pemeriksa benturan, silang, & spasi terpadu di satu kartu Analitik gerakan tunggal',
  )
  cek(
    /tabrakan/i.test(auditAwal.lencana) && auditAwal.jmlCincin >= 1 && auditAwal.jmlTikScrubber >= 1,
    `Detektor benturan menampilkan lencana "${auditAwal.lencana}", cincin kanvas (${auditAwal.jmlCincin}), dan tik scrubber (${auditAwal.jmlTikScrubber})`,
  )
  cek(
    auditAwal.svgMurniHex,
    'Cincin peringatan benturan di kanvas SVG 100% memakai warna #hex murni tanpa oklch()/color-mix()/rgba()',
  )
  cek(
    auditAwal.jmlSaranTukar >= 1 && auditAwal.jmlTemuanSpasi >= 1,
    `Penyelesai silang 2-Opt (${auditAwal.jmlSaranTukar} saran) dan pemeriksa kerataan spasi (${auditAwal.jmlTemuanSpasi} barisan) aktif bersamaan`,
  )

  /* ---- 2. Klik Baris Benturan → Lompat Scrubber ke Count 4 ---- */
  await page.click('[data-testid="fokus-benturan-0"]')
  await tunggu(350)
  const teksCountSesudahFokus = await page.evaluate(() => {
    const el = document.querySelector('[data-live-count]')
    return el?.textContent || ''
  })
  cek(
    /Count 4\/8/i.test(teksCountSesudahFokus),
    `Klik baris benturan langsung menggeser garis waktu ke hitungan benturan (${teksCountSesudahFokus})`,
  )

  /* ---- 3. Pratinjau Kanvas & Tukar 1-Klik (2-Opt) + Undo 1 Langkah ---- */
  await page.click('[data-testid="pratinjau-tukar-0"]')
  // Tunggu lapisannya benar-benar tergambar (bukan jeda tetap 250 ms yang
  // pernah terlalu pendek di runner CI yang lambat — v2.4.0, PR #48).
  await page
    .waitForFunction(
      () => document.querySelector('[data-testid="lapisan-pratinjau-tukar"]')?.outerHTML.includes('#10b981'),
      { timeout: 8000 },
    )
    .catch(() => undefined)
  const adaPratinjauKanvas = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="lapisan-pratinjau-tukar"]')
    if (!el) return false
    const html = el.outerHTML
    return html.includes('#10b981') && !/oklch\(|color-mix\(|rgba\(/i.test(html)
  })
  cek(
    adaPratinjauKanvas,
    'Pratinjau 2-Opt menggambar garis tujuan bebas-silang berwarna zamrud murni (#10b981) di atas kanvas',
  )

  // Klik tombol Tukar semua (atau Tukar pasangan pertama bila hanya 1 pasangan)
  const adaTombolSemua = await page.$('[data-testid="tombol-tukar-semua-silang"]')
  if (adaTombolSemua) {
    await adaTombolSemua.click()
  } else {
    await page.click('[data-testid="tombol-tukar-pasangan-0"]')
  }
  await tunggu(500)

  const sesudahTukar = await page.evaluate(() => ({
    aman: Boolean(document.querySelector('[data-testid="status-tabrakan-aman"]')),
    panelSilangMasihAda: Boolean(document.querySelector('[data-testid="panel-tukar-silang"]')),
    cincinMasihAda: Boolean(document.querySelector('[data-testid="lapisan-tabrakan-kanvas"]')),
  }))
  cek(
    sesudahTukar.aman && !sesudahTukar.panelSilangMasihAda && !sesudahTukar.cincinMasihAda,
    'Pertukaran tujuan 2-Opt langsung mengurai jalur silang dan menghilangkan benturan menjadi "Jalur aman"',
  )

  // Uji Ctrl+Z (Undo 1 langkah): silang & tabrakan harus kembali sementara tetap berada di Set 1!
  await page.keyboard.down('Control')
  await page.keyboard.press('KeyZ')
  await page.keyboard.up('Control')
  await tunggu(500)

  const sesudahUndoTukar = await page.evaluate(() => ({
    panelSilangKembali: Boolean(document.querySelector('[data-testid="panel-tukar-silang"]')),
    cincinKembali: Boolean(document.querySelector('[data-testid="lapisan-tabrakan-kanvas"]')),
  }))
  cek(
    sesudahUndoTukar.panelSilangKembali && sesudahUndoTukar.cincinKembali,
    'Ctrl+Z membatalkan pertukaran 2-Opt lintas-set dalam satu langkah Undo utuh tanpa berpindah set',
  )

  /* ---- 4. Kerataan Spasi Barisan: Ratakan Spasi & Ikat ke Garis #22 ---- */
  await page.click('[data-testid="ratakan-spasi-0"]')
  await tunggu(450)
  const spasiSesudahRatakan = await page.evaluate(() =>
    Boolean(document.querySelector('[data-testid="status-spasi-rata"]')),
  )
  cek(
    spasiSesudahRatakan,
    'Klik "⌗ Ratakan spasi" langsung meratakan interval barisan dan mengubah status menjadi rata',
  )

  // Undo lagi supaya kita menguji tombol "⟋ Ikat ke Garis #22"
  await page.keyboard.down('Control')
  await page.keyboard.press('KeyZ')
  await page.keyboard.up('Control')
  await tunggu(450)

  await page.waitForSelector('[data-testid="ikat-garis-spasi-0"]', { timeout: 5000 })
  await page.click('[data-testid="ikat-garis-spasi-0"]')
  await tunggu(500)
  const sesudahIkatGaris = await page.evaluate(() => ({
    spasiRata: Boolean(document.querySelector('[data-testid="status-spasi-rata"]')),
    gagangBentukHidupAda: Boolean(document.querySelector('[data-testid="lapisan-gagang-bentuk"]')),
  }))
  cek(
    sesudahIkatGaris.spasiRata && sesudahIkatGaris.gagangBentukHidupAda,
    'Klik "⟋ Ikat ke Garis #22" meratakan interval sekaligus memasang gagang Bentuk Garis Hidup (#22) di kanvas',
  )

  /* ---- 5. Palet Perintah Ctrl+K untuk Aksi #24 ---- */
  await page.keyboard.down('Control')
  await page.keyboard.press('KeyK')
  await page.keyboard.up('Control')
  await page.waitForSelector('[data-testid="input-cari-perintah"]', { timeout: 5000 })
  await page.type('[data-testid="input-cari-perintah"]', 'urai semua')
  await tunggu(200)
  await page.keyboard.press('Enter')
  await tunggu(500)

  const amanLewatPalet = await page.evaluate(() =>
    Boolean(document.querySelector('[data-testid="status-tabrakan-aman"]')),
  )
  cek(
    amanLewatPalet,
    'Ctrl+K → "urai semua" → Enter langsung mengeksekusi penyelesai silang 2-Opt hingga jalur aman',
  )

  /* ---- 6. Ketahanan Lebar HP 360px (Tanpa Luapan Horizontal) ---- */
  await page.setViewport({ width: 360, height: 640 })
  await tunggu(450)
  const lebarDokumenHp = await page.evaluate(() => document.documentElement.scrollWidth)
  cek(
    lebarDokumenHp <= 360,
    `Tata letak HP 360px bebas luapan horizontal (scrollWidth = ${lebarDokumenHp}px <= 360px)`,
  )
  cek(
    galat.length === 0,
    `Tidak ada galat halaman selama seluruh skenario E2E #24 (${galat.length} galat)`,
  )
} finally {
  await browser.close()
}

console.log(`\n${lulus} lulus, ${gagal} gagal`)
process.exit(gagal > 0 ? 1 : 0)
