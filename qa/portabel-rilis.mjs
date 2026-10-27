/**
 * Uji rakitan portabel satu berkas (`npm run build:portable` -> `DrillKit.html`)
 * dan bundel rilis pasca-#11.
 *
 * Yang dibuktikan:
 *   1. `npm run build:portable` berhasil merakit `dist-standalone/index.html`
 *      mandiri utuh: seluruh JS & CSS tertanam inline (`0` `<script src=…>`,
 *      `0` `<link rel="stylesheet" href=…>`), serta CSS telah diturunkan oleh
 *      LightningCSS sehingga memiliki fallback `rgb(...)` untuk peramban lama.
 *   2. Dibuka langsung lewat protokol `file:///…/DrillKit.html` di Chromium
 *      tanpa peladen HTTP sama sekali:
 *      - lolos layar sambutan & memuat data contoh ke IndexedDB,
 *      - Panduan Pelatih (`tombol-pratinjau-panduan`) memakai cabang
 *        `portabel: true` (menyebut `DrillKit.html`),
 *      - Panduan Anggota (`tombol-pratinjau-panduan-anggota`) otomatis memakai
 *        cabang berkas portabel (menyebut `DrillKit.html`, tanpa QR, tanpa
 *        `Ambil materi dari situs`, tanpa `Perbarui`),
 *      - halaman Musik menerima berkas MusicXML dan merender `<svg>` partitur
 *        OSMD + kotak sorot birama `#11d` secara 100% luring di `file://`
 *        dengan `0` `oklch()` / `color-mix()`.
 *   3. `0` error konsol / `pageerror` dan `0` permintaan jaringan keluar.
 *
 * Pakai: node qa/portabel-rilis.mjs
 */
import puppeteer from 'puppeteer'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { AKAR } from './lokasi.mjs'
import { lewatSambutan } from './sambutan.mjs'

let lulus = 0
const gagal = []
function cek(nama, ok, detail = '') {
  if (ok) {
    lulus++
    console.log('  ✓ ' + nama)
  } else {
    gagal.push(nama + (detail ? ' — ' + detail : ''))
    console.log('  ✗ ' + nama + (detail ? ' → ' + detail : ''))
  }
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

/* ----- 1. Bangun versi portabel & audit berkas HTML mandiri tunggal ------ */
console.log('\n== 1. Rakitan portabel satu berkas (dist-standalone/index.html) ==')
execFileSync('npm', ['run', 'build:portable'], { cwd: AKAR, stdio: 'pipe' })

const jalurStandalone = path.join(AKAR, 'dist-standalone', 'index.html')
cek('dist-standalone/index.html berhasil dirakit', fs.existsSync(jalurStandalone))

const isiHtml = fs.readFileSync(jalurStandalone, 'utf8')
const tagScriptLuar = isiHtml.match(/<script\b[^>]*\bsrc\s*=/gi) ?? []
const tagCssLuar = isiHtml.match(/<link\b[^>]*rel=["']stylesheet["'][^>]*>/gi) ?? []
cek(
  'seluruh JavaScript tertanam inline (0 <script src=...>)',
  tagScriptLuar.length === 0 && /<script\b/i.test(isiHtml),
  `scriptLuar=${tagScriptLuar.length}`,
)
cek(
  'seluruh CSS tertanam inline (0 <link rel="stylesheet">)',
  tagCssLuar.length === 0 && /<style\b/i.test(isiHtml),
  `cssLuar=${tagCssLuar.length}`,
)
cek(
  'CSS hasil LightningCSS memuat fallback rgb() untuk peramban lama',
  /rgb\(/.test(isiHtml),
)
cek(
  'ukuran berkas tunggal masuk akal (> 1 MB dan < 8 MB)',
  isiHtml.length > 1_000_000 && isiHtml.length < 8_000_000,
  `ukuran=${isiHtml.length}`,
)

/* ----- 2. Buka langsung lewat protokol file:// tanpa peladen HTTP -------- */
console.log('\n== 2. Uji jalan langsung lewat file:///.../DrillKit.html ==')
const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'dk-portabel-'))
const jalurDrillKitHtml = path.join(TMP_DIR, 'DrillKit.html')
fs.copyFileSync(jalurStandalone, jalurDrillKitHtml)

const skorUjiPath = path.join(TMP_DIR, 'skor-portabel.musicxml')
fs.writeFileSync(
  skorUjiPath,
  `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <work><work-title>Uji Portabel</work-title></work>
  <part-list>
    <score-part id="P1"><part-name>Trumpet 1</part-name></score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      <note><pitch><step>C</step><octave>5</octave></pitch><duration>4</duration><type>whole</type></note>
    </measure>
    <measure number="2">
      <note><pitch><step>E</step><octave>5</octave></pitch><duration>4</duration><type>whole</type></note>
    </measure>
    <measure number="3">
      <note><pitch><step>G</step><octave>5</octave></pitch><duration>4</duration><type>whole</type></note>
    </measure>
    <measure number="4">
      <note><pitch><step>C</step><octave>6</octave></pitch><duration>4</duration><type>whole</type></note>
    </measure>
  </part>
</score-partwise>`,
)

const browser = await puppeteer.launch({
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  defaultViewport: { width: 1360, height: 960 },
  env: { ...process.env, LANG: process.env.LANG || 'C.UTF-8' },
})

try {
  const p = await browser.newPage()
  const errors = []
  const permintaanHttp = []

  p.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  p.on('pageerror', (e) => errors.push(String(e)))
  p.on('request', (req) => {
    const u = req.url()
    if (/^https?:/i.test(u)) permintaanHttp.push(u)
  })

  const urlFile = pathToFileURL(jalurDrillKitHtml).href
  await p.goto(urlFile, { waitUntil: 'load' })
  await wait(800)

  const protokol = await p.evaluate(() => location.protocol)
  cek('berjalan murni di protokol file:', protokol === 'file:', protokol)

  await lewatSambutan(p)
  await wait(700)

  await p.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) =>
      x.textContent?.includes('Muat data contoh'),
    )
    if (b) b.click()
  })
  await wait(2500)

  // Periksa Panduan Pelatih & Panduan Anggota di mode portabel (`file:`)
  await p.evaluate(() => {
    location.hash = '#/pengaturan'
  })
  await wait(800)

  await p.click('[data-testid="tombol-pratinjau-panduan"]')
  await p.waitForSelector('[data-testid="bingkai-panduan"]', { timeout: 8000 })
  await wait(500)
  const htmlPelatih = await p.$eval(
    '[data-testid="bingkai-panduan"]',
    (el) => el.getAttribute('srcdoc') ?? '',
  )
  cek(
    'panduan pelatih di file:// mengaktifkan petunjuk khusus DrillKit.html (portabel: true)',
    htmlPelatih.includes('Berkas DrillKit.html dibuka di dalam pratinjau'),
  )
  await p.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent?.trim() === 'Tutup')
    if (b) b.click()
  })
  await wait(350)

  await p.click('[data-testid="tombol-pratinjau-panduan-anggota"]')
  await p.waitForSelector('[data-testid="bingkai-panduan"]', { timeout: 8000 })
  await wait(500)
  const htmlAnggota = await p.$eval(
    '[data-testid="bingkai-panduan"]',
    (el) => el.getAttribute('srcdoc') ?? '',
  )
  cek(
    'panduan anggota di file:// memakai cabang berkas portabel (menyebut DrillKit.html, tanpa QR/Perbarui)',
    htmlAnggota.includes('DrillKit.html') &&
      !htmlAnggota.includes('Kode QR') &&
      !htmlAnggota.includes('Ambil materi dari situs') &&
      !htmlAnggota.includes('Perbarui'),
  )
  await p.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent?.trim() === 'Tutup')
    if (b) b.click()
  })
  await wait(350)

  // Buka halaman Musik -> unggah MusicXML -> render OSMD + sorot #11d di protokol file://!
  await p.evaluate(() => {
    location.hash = '#/musik'
  })
  await wait(800)
  const idTombolLagu = await p.evaluate(() => {
    const btn = document.querySelector('[data-testid^="pilih-lagu-"]')
    if (!btn) return null
    btn.click()
    return btn.getAttribute('data-testid')
  })
  cek('data contoh lagu termuat di IndexedDB pada file://', Boolean(idTombolLagu))

  await p.waitForSelector('#partitur-input', { timeout: 8000 })
  const inputPartitur = await p.$('#partitur-input')
  await inputPartitur.uploadFile(skorUjiPath)
  await p.evaluate(() => {
    const el = document.querySelector('#partitur-input')
    if (el) el.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await p.waitForSelector('[data-testid="partitur-simpan"]', { timeout: 8000 })
  await p.click('[data-testid="partitur-simpan"]')
  await p.waitForSelector('[data-testid="partitur-buka"]', { timeout: 8000 })
  await p.click('[data-testid="partitur-buka"]')

  const t0 = Date.now()
  let terender = false
  while (Date.now() - t0 < 15000) {
    terender = await p.evaluate(
      () =>
        Boolean(document.querySelector('[data-testid="partitur-info-sesi"]')) &&
        document.querySelectorAll('[data-testid="partitur-kanvas-svg"] svg').length > 0,
    )
    if (terender) break
    await wait(150)
  }
  cek('OSMD merender SVG partitur 100% luring di dalam berkas tunggal file://', terender)

  const cekSorotDanHex = await p.evaluate(() => {
    const layar = document.querySelector('[data-testid="layar-partitur"]')
    const sorot = document.querySelector('[data-testid="partitur-sorot-aktif"]')
    return {
      sorotBirama: sorot?.getAttribute('data-birama-aktif'),
      adaOklch: layar ? /oklch\(|color-mix\(/i.test(layar.outerHTML) : true,
    }
  })
  cek(
    'kotak sorot birama #11d aktif dan layar-partitur tetap 0 oklch/color-mix di file://',
    cekSorotDanHex.sorotBirama === '1' && cekSorotDanHex.adaOklch === false,
    JSON.stringify(cekSorotDanHex),
  )

  cek('0 error konsol / pageerror di file://', errors.length === 0, errors.join(' | '))
  cek('0 permintaan HTTP/HTTPS keluar di file://', permintaanHttp.length === 0, permintaanHttp.join(', '))
} finally {
  await browser.close().catch(() => {})
  fs.rmSync(TMP_DIR, { recursive: true, force: true })
}

console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length > 0) process.exit(1)
