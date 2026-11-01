/**
 * Rangkaian uji E2E peramban #20 — Simulasi Penilaian Juri (Caption Recap Sheet) & Judge Tape Berpenanda Waktu (v2.0.0):
 *   1. Pelatih memuat data contoh -> berpindah dari `/#/evaluasi` (`pintasan-simulasi-juri`) ke `/#/lomba?tab=juri`
 *   2. Memuat 2 simulasi contoh (`muat-contoh-simulasi`) -> verifikasi kurva tren SVG (`svg-tren-juri`, `lencana-kenaikan-tren`)
 *      murni `#hex` (0 `oklch()` / `color-mix()`)
 *   3. Mengubah nilai sub-caption & menambah penalti (`preset-penalti-waktu`) -> verifikasi skor bersih & lencana Box terhitung seketika
 *   4. Mengunggah berkas audio WAV Judge Tape (`unggah-audio-judgetape`) + menandai komentar pada detik ke-6 ->
 *      verifikasi pemetaan otomatis ke **Nomor Set + Hitungan + Birama** (`tautan-set-birama-...`) & pemutar `<audio>` berpindah detik saat diklik
 *   5. Membuka modal Pratinjau Cetak A4 (`pratinjau-cetak-juri`) -> verifikasi HTML resmi 100% `#hex` (bebas `oklch`/`color-mix`)
 *   6. Mengekspor **Backup Lengkap ZIP** di `/#/pengaturan`, menghapus seluruh data (`clearAll`), lalu memulihkan ZIP ->
 *      verifikasi `db.penilaianLomba` DAN Blob `db.judgeTapeAudio` pulih 100% utuh!
 *   7. Mengekspor Paket Grup di `/#/berbagi` -> verifikasi **pagar privasi keras**: komentar rahasia juri, `penilaianLomba`,
 *      dan `judgeTapeAudio` sama sekali tidak ikut ke berkas anggota!
 */
import puppeteer from 'puppeteer'
import { lewatSambutan } from './sambutan.mjs'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const BASE = (process.env.BASE || process.argv[2] || 'http://localhost:4173').replace(/\/+$/, '')
const EXEC = process.env.PUPPETEER_EXECUTABLE_PATH || undefined
const tunggu = (ms) => new Promise((r) => setTimeout(r, ms))

const UNDUH = path.join(os.tmpdir(), `unduh-juri-${Date.now()}`)
fs.mkdirSync(UNDUH, { recursive: true })

/** Buat berkas WAV PCM hening valid berdurasi ~1 detik untuk uji unggah Judge Tape */
function buatWavUji(lokasi) {
  const sampleRate = 8000
  const numSamples = 8000
  const buf = Buffer.alloc(44 + numSamples)
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + numSamples, 4)
  buf.write('WAVE', 8)
  buf.write('fmt ', 12)
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20) // PCM
  buf.writeUInt16LE(1, 22) // Mono
  buf.writeUInt32LE(sampleRate, 24)
  buf.writeUInt32LE(sampleRate, 28)
  buf.writeUInt16LE(1, 32)
  buf.writeUInt16LE(8, 34) // 8-bit
  buf.write('data', 36)
  buf.writeUInt32LE(numSamples, 40)
  buf.fill(128, 44)
  fs.writeFileSync(lokasi, buf)
}

const FILE_WAV = path.join(UNDUH, 'judgetape-runthrough.wav')
buatWavUji(FILE_WAV)

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
  headless: true,
  executablePath: EXEC,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
})

try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 860 })
  const cdp = await page.target().createCDPSession()
  await cdp.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: UNDUH })

  const galat = []
  page.on('pageerror', (e) => galat.push(e.message))

  await page.goto(`${BASE}/#/`, { waitUntil: 'networkidle0' })
  await lewatSambutan(page)

  // Muat data contoh supaya punya anggota, drill, set, dan lagu
  const adaTombolContoh = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Muat data contoh'),
    )
    if (btn) {
      btn.click()
      return true
    }
    return false
  })
  cek(adaTombolContoh, 'memuat data contoh awal dari Dashboard')
  await tunggu(700)

  // 1. Pintasan dari halaman Evaluasi -> Lomba?tab=juri
  await page.goto(`${BASE}/#/evaluasi`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('[data-testid="pintasan-simulasi-juri"]', { timeout: 6000 })
  await page.click('[data-testid="pintasan-simulasi-juri"]')
  await page.waitForSelector('[data-testid="panel-penilaian-juri-kosong"]', { timeout: 8000 })
  cek(
    page.url().includes('/lomba?tab=juri'),
    'pintasan dari halaman Evaluasi membuka tab Simulasi Penilaian Juri di /#/lomba?tab=juri',
  )

  // 2. Muat 2 simulasi contoh & periksa kurva tren SVG murni hex
  await page.click('[data-testid="muat-contoh-simulasi"]')
  await page.waitForSelector('[data-testid="panel-penilaian-juri"]', { timeout: 8000 })
  await page.waitForSelector('[data-testid="svg-tren-juri"]', { timeout: 6000 })

  const infoAwal = await page.evaluate(() => {
    const skor = document.querySelector('[data-testid="skor-akhir-juri"]')?.textContent?.trim() || ''
    const box = document.querySelector('[data-testid="lencana-box-juri"]')?.textContent?.trim() || ''
    const tren = document.querySelector('[data-testid="lencana-kenaikan-tren"]')?.textContent?.trim() || ''
    const svgHtml = document.querySelector('[data-testid="svg-tren-juri"]')?.outerHTML || ''
    return { skor, box, tren, svgHtml }
  })
  cek(infoAwal.skor === '84,00', 'skor bersih simulasi H-1 contoh terhitung 84,00', `dapat=${infoAwal.skor}`)
  cek(infoAwal.box.includes('Box 4'), 'klasifikasi Box 4 tampil pada simulasi 84,00%', `dapat=${infoAwal.box}`)
  cek(infoAwal.tren.includes('+14,50'), 'lencana kenaikan tren H-14 -> H-1 (+14,50 poin) tampil akurat', `dapat=${infoAwal.tren}`)
  cek(
    !/oklch\(|color-mix\(/i.test(infoAwal.svgHtml),
    'grafik SVG tren skor simulasi murni #hex (0 oklch / color-mix)',
  )

  // 3. Tambah penalti Overtime (-0,50) -> verifikasi skor langsung turun ke 83,50
  await page.click('[data-testid="preset-penalti-waktu"]')
  await tunggu(250)
  const skorSetelahPenalti = await page.$eval(
    '[data-testid="skor-akhir-juri"]',
    (el) => el.textContent?.trim() || '',
  )
  cek(
    skorSetelahPenalti === '83,50',
    'penambahan penalti Overtime (−0,50) langsung menurunkan skor bersih ke 83,50',
    `dapat=${skorSetelahPenalti}`,
  )

  // 4. Unggah berkas audio Judge Tape + tandai komentar pada detik ke-6
  const inputAudio = await page.$('[data-testid="unggah-audio-judgetape"]')
  await inputAudio.uploadFile(FILE_WAV)
  await page.waitForSelector('[data-testid="pemutar-audio-judgetape"]', { timeout: 8000 })
  cek(true, 'unggah berkas WAV Judge Tape tersimpan dan memunculkan pemutar <audio>')

  await page.click('[data-testid="input-detik-judgetape"]', { clickCount: 3 })
  await page.type('[data-testid="input-detik-judgetape"]', '6')
  await page.type(
    '[data-testid="input-teks-judgetape"]',
    'RAHASIA_JURI_BARIS_DEPAN: artikulasi mellophone perlu ditegaskan',
  )
  await page.click('[data-testid="tambah-catatan-judgetape"]')
  await tunggu(300)

  const infoCatatan = await page.evaluate(() => {
    const items = [...document.querySelectorAll('[data-testid^="item-judgetape-"]')]
    const cocok = items.find((el) => el.textContent?.includes('RAHASIA_JURI_BARIS_DEPAN'))
    if (!cocok) return null
    const btnPutar = cocok.querySelector('button[data-testid^="putar-catatan-"]')
    btnPutar?.click()
    const audio = document.querySelector('[data-testid="pemutar-audio-judgetape"]')
    return {
      teks: cocok.textContent || '',
      waktuAudio: audio ? audio.currentTime : -1,
    }
  })
  cek(
    !!infoCatatan &&
      infoCatatan.teks.includes('00:06') &&
      infoCatatan.teks.includes('Set ') &&
      infoCatatan.teks.includes('Birama '),
    'komentar Judge Tape pada detik ke-6 otomatis tertaut ke Nomor Set & Nomor Birama',
    infoCatatan?.teks || 'tidak ketemu',
  )

  // 5. Buka Modal Pratinjau Cetak A4 -> pastikan murni #hex
  await page.click('[data-testid="pratinjau-cetak-juri"]')
  await page.waitForSelector('[data-testid="iframe-pratinjau-rekap-juri"]', { timeout: 6000 })
  const srcDocA4 = await page.$eval(
    '[data-testid="iframe-pratinjau-rekap-juri"]',
    (el) => el.getAttribute('srcdoc') || '',
  )
  cek(
    srcDocA4.includes('CAPTION RECAP SHEET') &&
      srcDocA4.includes('RAHASIA_JURI_BARIS_DEPAN') &&
      !/oklch\(|color-mix\(|rgba\(/i.test(srcDocA4),
    'pratinjau cetak A4 memuat rekap lengkap & transkrip Judge Tape dengan warna 100% #hex',
  )
  await page.keyboard.press('Escape')
  await tunggu(200)

  // 6. Pagar Privasi Keras: unduh Paket Grup di /#/berbagi -> pastikan 0 jejak penilaianLomba / Judge Tape
  await page.goto(`${BASE}/#/berbagi`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('[data-testid="unduh-grup"]', { timeout: 8000 })
  const sebelumGrup = new Set(fs.readdirSync(UNDUH))
  await page.click('[data-testid="unduh-grup"]')
  let berkasGrup = null
  for (let i = 0; i < 30; i++) {
    await tunggu(150)
    const baru = fs.readdirSync(UNDUH).find((f) => !sebelumGrup.has(f) && !f.endsWith('.crdownload'))
    if (baru) {
      berkasGrup = path.join(UNDUH, baru)
      break
    }
  }
  cek(!!berkasGrup, 'mengunduh berkas Paket Grup dari halaman Berbagi')
  if (berkasGrup) {
    const isiPaketGrup = fs.readFileSync(berkasGrup, 'utf8')
    cek(
      !isiPaketGrup.includes('penilaianLomba') &&
        !isiPaketGrup.includes('judgeTapeAudio') &&
        !isiPaketGrup.includes('RAHASIA_JURI_BARIS_DEPAN'),
      'pagar privasi keras: berkas Paket Grup sama sekali tidak membocorkan penilaianLomba, judgeTapeAudio, maupun komentar juri',
    )
  }

  // 7. Backup Lengkap ZIP -> Hapus Semua Data -> Pulihkan ZIP -> Verifikasi penilaianLomba & audio Judge Tape pulih utuh!
  await page.goto(`${BASE}/#/pengaturan`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('#restore-input', { timeout: 8000 })
  const sebelumZip = new Set(fs.readdirSync(UNDUH))
  const klikZip = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Backup + rekaman (ZIP)'),
    )
    if (btn) {
      btn.click()
      return true
    }
    return false
  })
  cek(klikZip, 'menekan tombol "Backup + rekaman (ZIP)" di Pengaturan')

  let berkasZip = null
  for (let i = 0; i < 40; i++) {
    await tunggu(150)
    const baru = fs
      .readdirSync(UNDUH)
      .find((f) => !sebelumZip.has(f) && f.endsWith('.zip') && !f.endsWith('.crdownload'))
    if (baru) {
      berkasZip = path.join(UNDUH, baru)
      break
    }
  }
  cek(!!berkasZip, 'berkas Backup ZIP berhasil terunduh')

  if (berkasZip) {
    // Kosongkan database penilaianLomba & judgeTapeAudio langsung lewat halaman untuk simulasi perangkat baru
    await page.evaluate(async () => {
      const dbs = await indexedDB.databases()
      for (const info of dbs) {
        if (!info.name) continue
        await new Promise((resolve) => {
          const req = indexedDB.open(info.name)
          req.onsuccess = () => {
            const idb = req.result
            if (idb.objectStoreNames.contains('penilaianLomba')) {
              const tx = idb.transaction(['penilaianLomba', 'judgeTapeAudio'], 'readwrite')
              tx.objectStore('penilaianLomba').clear()
              tx.objectStore('judgeTapeAudio').clear()
              tx.oncomplete = () => {
                idb.close()
                resolve(true)
              }
            } else {
              idb.close()
              resolve(false)
            }
          }
        })
      }
    })

    // Unggah kembali Backup ZIP lewat input file pemulihan di Pengaturan
    const inputPulih = await page.$('input[type="file"][accept*=".zip"]')
    await inputPulih.uploadFile(berkasZip)
    await page.waitForSelector('[data-testid="pulih-backup"]', { timeout: 8000 })

    const teksPratinjauPulih = await page.$eval(
      '[data-testid="pulih-backup"]',
      (el) => el.textContent || '',
    )
    cek(
      teksPratinjauPulih.includes('Simulasi penilaian juri') &&
        teksPratinjauPulih.includes('Judge Tape'),
      'pratinjau Pulihkan Backup mengenali Simulasi penilaian juri & rekaman Judge Tape di dalam ZIP',
      teksPratinjauPulih,
    )

    await page.click('[data-testid="pulih-backup-tombol"]')
    await tunggu(800)
    // Bila muncul langkah pencocokan anggota, klik sekali lagi
    const masihAdaTombol = await page.$('[data-testid="pulih-backup-tombol"]')
    if (masihAdaTombol) {
      await masihAdaTombol.click()
      await tunggu(800)
    }

    // Kembali ke /#/lomba?tab=juri dan pastikan komentar + pemutar audio Judge Tape pulih 100%!
    await page.goto(`${BASE}/#/lomba?tab=juri`, { waitUntil: 'networkidle0' })
    await page.waitForSelector('[data-testid="panel-penilaian-juri"]', { timeout: 8000 })
    await page.waitForSelector('[data-testid="pemutar-audio-judgetape"]', { timeout: 8000 })
    const teksSetelahPulih = await page.$eval(
      '[data-testid="panel-penilaian-juri"]',
      (el) => el.textContent || '',
    )
    cek(
      teksSetelahPulih.includes('RAHASIA_JURI_BARIS_DEPAN') &&
        teksSetelahPulih.includes('judgetape-runthrough.wav'),
      'rekaman suara Judge Tape & komentar tertaut Set/Birama pulih 100% dari Backup ZIP',
    )
  }

  cek(galat.length === 0, 'tidak ada pageerror sepanjang pengujian E2E penilaian juri', galat.join('; '))
} finally {
  await browser.close()
  fs.rmSync(UNDUH, { recursive: true, force: true })
}

console.log(`\n${lulus} lulus, ${gagal} gagal`)
process.exit(gagal > 0 ? 1 : 0)
