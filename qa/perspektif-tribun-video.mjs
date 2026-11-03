/**
 * #25 (`v2.2.3`) — Uji E2E Puppeteer:
 *  - #25.1 Tombol "Tribun & Video" (lazy chunk `ModalPerspektifTribun`) membuka kanvas 2,5D
 *          `kanvas-perspektif-tribun` dengan 4 preset sudut (Podium 3 m, Tribun 8 m,
 *          Press Box 18 m, Atas 90°) yang benar-benar mengubah piksel gambar.
 *  - #25.2 Deteksi halangan pandang: properti `tinggiMeter` 2,4 m menutup solois dari Podium 3 m,
 *          tetapi bebas dari Press Box 18 m; simulasi kontras Jaket/Celana/Plume/Bendera terhadap
 *          rumput, termasuk warna kain per-blok Count Sheet (#17), dan skema tersimpan ke Dexie.
 *  - #25.3 Perekam video `.webm` luring (`captureStream` + `MediaRecorder`) menghasilkan Blob
 *          video bertipe `video/webm` dengan ukuran > 0 dan pratinjau `<video>`.
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
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'],
})

/** Sidik sederhana piksel kanvas pratinjau (untuk memastikan ganti preset benar-benar menggambar ulang). */
const sidikKanvas = (page) =>
  page.evaluate(() => {
    const c = document.querySelector('[data-testid="kanvas-perspektif-tribun"]')
    if (!c) return ''
    const ctx = c.getContext('2d')
    const d = ctx.getImageData(0, 0, c.width, c.height).data
    let h = 0
    for (let i = 0; i < d.length; i += 397) h = (h * 31 + d[i]) >>> 0
    return String(h)
  })

try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 960 })
  const galat = []
  page.on('pageerror', (e) => galat.push(e.message))

  await page.goto(BASE, { waitUntil: 'networkidle0' })
  await lewatSambutan(page)
  await tunggu(600)

  // Drill uji: solois T1 berdiri 3,75 yd di belakang backdrop 2,4 m di garis tengah depan,
  // 2 pemain Color Guard dengan Count Sheet berkain hijau tua (#166534) yang tenggelam di rumput.
  await page.evaluate(async () => {
    const bukaDb = () =>
      new Promise((resolve, reject) => {
        const req = indexedDB.open('drillkit')
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      })
    const db = await bukaDb()
    const tx = db.transaction(['members', 'drills', 'sets', 'countSheets'], 'readwrite')
    const anggota = [
      { id: 'u25_t1', name: 'Solois Terompet', code: 'T1', section: 'brass', instrument: 'Trumpet', role: 'member', joinYear: 2026, active: 1 },
      { id: 'u25_t2', name: 'Terompet Sayap', code: 'T2', section: 'brass', instrument: 'Trumpet', role: 'member', joinYear: 2026, active: 1 },
      { id: 'u25_g1', name: 'Guard Satu', code: 'G1', section: 'color_guard', instrument: 'Flag', role: 'member', joinYear: 2026, active: 1 },
      { id: 'u25_g2', name: 'Guard Dua', code: 'G2', section: 'color_guard', instrument: 'Flag', role: 'member', joinYear: 2026, active: 1 },
    ]
    for (const m of anggota) tx.objectStore('members').put(m)

    const kini = Date.now() + 180_000
    tx.objectStore('drills').put({
      id: 'drill_uji_25',
      name: 'Uji Tribun & Video #25',
      showTitle: 'Uji #25',
      tempo: 240,
      beatsPerCount: 1,
      rosterIds: anggota.map((a) => a.id),
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
      markers: [
        {
          id: 'mk25_backdrop',
          jenis: 'kotak',
          label: 'Backdrop',
          x: -2,
          y: -18.75,
          x2: 2,
          y2: -17.25,
          warna: '#475569',
          tinggiMeter: 2.4,
        },
      ],
    })
    tx.objectStore('sets').put({
      id: 'set25_1',
      drillId: 'drill_uji_25',
      order: 0,
      name: 'Set 1',
      counts: 8,
      notes: '',
      points: {
        u25_t1: { x: 0, y: -14, facing: 'front' },
        u25_t2: { x: 12, y: -14, facing: 'front' },
        u25_g1: { x: -10, y: 4, facing: 'front' },
        u25_g2: { x: -14, y: 4, facing: 'front' },
      },
    })
    tx.objectStore('sets').put({
      id: 'set25_2',
      drillId: 'drill_uji_25',
      order: 1,
      name: 'Set 2',
      counts: 8,
      notes: '',
      points: {
        u25_t1: { x: 0, y: -14, facing: 'front' },
        u25_t2: { x: 8, y: -10, facing: 'front' },
        u25_g1: { x: 10, y: 4, facing: 'front' },
        u25_g2: { x: 14, y: 4, facing: 'front' },
      },
    })
    tx.objectStore('countSheets').put({
      id: 'cs25',
      judul: 'Guard Opener',
      drillId: 'drill_uji_25',
      seksi: 'color_guard',
      alatUtama: 'flag',
      blok: [
        {
          id: 'b25_1',
          urutan: 0,
          setId: 'set25_1',
          offsetDalamSet: 0,
          labelBagian: 'Opener Hijau',
          counts: 8,
          alat: 'flag',
          teknik: 'Drop spin',
          aksenCount: [4],
          warnaBendera: '#166534',
        },
      ],
      createdAt: kini,
      updatedAt: kini,
    })
    await new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(true)
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  })

  await page.goto(`${BASE}/#/drill`, { waitUntil: 'networkidle0' })
  await page.reload({ waitUntil: 'networkidle0' })
  await page.waitForSelector('[data-testid="kanvas-drill-svg"]', { timeout: 15000 })
  await tunggu(500)

  /* ---- 1. Buka Studio Tribun lewat tombol lazy-load ---- */
  await page.waitForSelector('[data-testid="tombol-tribun-video"]', { timeout: 8000 })
  await page.click('[data-testid="tombol-tribun-video"]')
  await page.waitForSelector('[data-testid="kanvas-perspektif-tribun"]', { timeout: 10000 })
  await tunggu(500)

  const auditAwal = await page.evaluate(() => ({
    jmlPreset: document.querySelectorAll('[data-testid^="preset-tribun-"]').length,
    jmlModal: document.querySelectorAll('[data-testid="modal-perspektif-tribun"]').length,
    lencanaHalangan: document.querySelector('[data-testid="lencana-halangan-tribun"]')?.textContent || '',
  }))
  cek(
    auditAwal.jmlPreset === 4 && auditAwal.jmlModal === 1,
    `Studio Tribun dimuat malas dengan tepat 4 preset sudut (${auditAwal.jmlPreset}) dalam satu modal tunggal`,
  )
  cek(
    /bebas halangan/i.test(auditAwal.lencanaHalangan),
    `Press Box 18 m (bawaan): solois di belakang backdrop 2,4 m tetap terlihat — "${auditAwal.lencanaHalangan}"`,
  )

  const sidikPressBox = await sidikKanvas(page)
  await page.click('[data-testid="preset-tribun-podium"]')
  await tunggu(400)
  const sidikPodium = await sidikKanvas(page)
  await page.click('[data-testid="tab-tribun-halangan"]')
  await tunggu(250)
  const auditPodium = await page.evaluate(() => ({
    lencana: document.querySelector('[data-testid="lencana-halangan-tribun"]')?.textContent || '',
    daftar: [...document.querySelectorAll('[data-testid^="fokus-halangan-"]')].map((b) => b.textContent || ''),
  }))
  cek(
    sidikPressBox && sidikPodium && sidikPressBox !== sidikPodium,
    'Ganti preset Press Box → Podium benar-benar menggambar ulang proyeksi kanvas 2,5D',
  )
  cek(
    /terhalang/i.test(auditPodium.lencana) && auditPodium.daftar.some((t) => /T1/.test(t) && /Backdrop/.test(t)),
    `Podium 3 m: T1 terdeteksi terhalang Backdrop 2,4 m (${auditPodium.daftar.join(' | ')})`,
  )

  await page.click('[data-testid="preset-tribun-atas"]')
  await tunggu(300)
  const lencanaAtas = await page.$eval('[data-testid="lencana-halangan-tribun"]', (e) => e.textContent || '')
  cek(/90/.test(lencanaAtas), `Preset Atas 90° menampilkan denah ortografis ("${lencanaAtas}")`)
  await page.click('[data-testid="preset-tribun-press_box"]')
  await tunggu(250)

  /* ---- 2. Simulasi Kontras Seragam/Bendera & Persistensi Dexie ---- */
  await page.click('[data-testid="tab-tribun-kontras"]')
  await tunggu(250)
  const kontrasAwal = await page.evaluate(() => ({
    jmlButir: document.querySelectorAll('[data-testid^="kontras-butir-"]').length,
    benderaBlok: [...document.querySelectorAll('[data-testid^="kontras-butir-bendera_blok"]')].map((e) => e.textContent || ''),
    lencana: document.querySelector('[data-testid="lencana-kontras-tribun"]')?.textContent || '',
  }))
  cek(
    kontrasAwal.jmlButir >= 5 && kontrasAwal.benderaBlok.some((t) => /Opener Hijau/.test(t) && /Tenggelam/.test(t)),
    `Kain bendera blok Count Sheet #17 (#166534) dievaluasi & ditandai tenggelam di rumput (${kontrasAwal.benderaBlok.join(' | ')})`,
  )

  // Jaket hijau tua → harus tenggelam; lalu disimpan ke Dexie `drills.skemaVisualTribun`
  await page.click('[data-testid="swatch-jaketHex-166534"]')
  await tunggu(500)
  const kontrasJaket = await page.evaluate(async () => {
    const teks = document.querySelector('[data-testid="kontras-butir-jaket"]')?.textContent || ''
    const db = await new Promise((resolve, reject) => {
      const req = indexedDB.open('drillkit')
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    const drill = await new Promise((resolve) => {
      const r = db.transaction('drills').objectStore('drills').get('drill_uji_25')
      r.onsuccess = () => resolve(r.result)
    })
    db.close()
    return { teks, jaketTersimpan: drill?.skemaVisualTribun?.jaketHex }
  })
  cek(
    /Tenggelam/.test(kontrasJaket.teks) && kontrasJaket.jaketTersimpan === '#166534',
    `Jaket hijau tua ditandai tenggelam & skema tersimpan aditif ke Dexie (${kontrasJaket.jaketTersimpan})`,
  )

  const rasioRumput = await page.$eval('[data-testid="kontras-butir-jaket"]', (e) => e.textContent || '')
  await page.select('[data-testid="pilih-latar-tribun"]', 'biru_indoor')
  await tunggu(350)
  const rasioIndoor = await page.$eval('[data-testid="kontras-butir-jaket"]', (e) => e.textContent || '')
  await page.click('[data-testid="swatch-jaketHex-f8fafc"]')
  await tunggu(350)
  const jaketPutihIndoor = await page.$eval('[data-testid="kontras-butir-jaket"]', (e) => e.textContent || '')
  cek(
    rasioRumput !== rasioIndoor && /Tajam/.test(jaketPutihIndoor),
    `Ganti latar ke terpal biru indoor menghitung ulang rasio jaket ("${rasioRumput.trim()}" → "${rasioIndoor.trim()}"), jaket putih = "${jaketPutihIndoor.trim()}"`,
  )

  /* ---- 3. Rekam Video .webm Luring ---- */
  await page.click('[data-testid="tab-tribun-video"]')
  await tunggu(250)
  await page.select('[data-testid="pilih-audio-video"]', 'bisu')
  await tunggu(150)
  await page.select('[data-testid="pilih-cepat-bisu"]', '4')
  await page.evaluate(() => {
    // Tahan unduhan otomatis agar uji tidak menulis berkas ke disk
    HTMLAnchorElement.prototype.click = function () {}
  })
  await page.click('[data-testid="tombol-rekam-webm"]')
  await page.waitForSelector('[data-testid="info-hasil-webm"]', { timeout: 30000 })
  const infoVideo = await page.evaluate(async () => {
    const v = document.querySelector('[data-testid="pratinjau-video-webm"]')
    const blob = v ? await fetch(v.src).then((r) => r.blob()) : null
    return {
      nama: document.querySelector('[data-testid="info-hasil-webm"]')?.textContent || '',
      tipe: blob?.type || '',
      ukuran: blob?.size || 0,
    }
  })
  cek(
    /\.webm/.test(infoVideo.nama) && /^video\/webm/.test(infoVideo.tipe) && infoVideo.ukuran > 2000,
    `Perekam luring menghasilkan video ${infoVideo.tipe} (${infoVideo.ukuran} bita) beserta pratinjau <video>`,
  )

  /* ---- 4. Palet Perintah Ctrl+K ---- */
  await page.keyboard.press('Escape')
  await tunggu(400)
  const modalTertutup = await page.evaluate(
    () => !document.querySelector('[data-testid="modal-perspektif-tribun"]'),
  )
  cek(modalTertutup, 'Esc menutup Studio Tribun & Video')

  await page.keyboard.down('Control')
  await page.keyboard.press('KeyK')
  await page.keyboard.up('Control')
  await page.waitForSelector('[data-testid="input-cari-perintah"]', { timeout: 5000 })
  await page.type('[data-testid="input-cari-perintah"]', 'video webm')
  await tunggu(200)
  await page.keyboard.press('Enter')
  await page.waitForSelector('[data-testid="panel-ekspor-video"]', { timeout: 6000 }).catch(() => null)
  const tabVideoLewatPalet = await page.evaluate(() =>
    Boolean(document.querySelector('[data-testid="panel-ekspor-video"]')),
  )
  cek(tabVideoLewatPalet, 'Ctrl+K → "video webm" → Enter langsung membuka tab Ekspor Video .webm')

  /* ---- 5. Ketahanan Lebar HP 360px ---- */
  await page.setViewport({ width: 360, height: 640 })
  await tunggu(450)
  const lebarDokumenHp = await page.evaluate(() => document.documentElement.scrollWidth)
  cek(lebarDokumenHp <= 360, `Tata letak HP 360px bebas luapan horizontal (scrollWidth = ${lebarDokumenHp}px)`)
  cek(galat.length === 0, `Tidak ada galat halaman selama skenario E2E #25 (${galat.length} galat${galat.length ? ': ' + galat[0] : ''})`)
} finally {
  await browser.close()
}

console.log(`\n${lulus} lulus, ${gagal} gagal`)
process.exit(gagal > 0 ? 1 : 0)
