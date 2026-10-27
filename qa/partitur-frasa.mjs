/**
 * #11d — Sorot Birama Aktif Sinkron `TempoTimeline`, Pilih & Loop Frasa
 * (`"Frasa 5–8 · 80%"`), Fallback Tanpa MusicXML, serta Tautan Frasa ↔ Set Drill
 * (`"Set 4–6 = Bar 9–16"`) — uji peramban ujung-ke-ujung.
 *
 * Mencakup seluruh tolok ukur §11 `RANCANGAN-LANJUTAN.md` & `RANCANGAN-11d-PARTITUR-FRASA.md`:
 *   1. Skor MusicXML 32 birama dirender utuh pada Full score maupun part tunggal
 *      Trumpet 1 (termasuk istirahat multi-birama 4 birama pada Bar 9–12),
 *      dengan `0` `oklch()` / `color-mix()` di dalam `layar-partitur`.
 *   2. Sorot birama aktif (`partitur-sorot-aktif`) & gulir otomatis (`partitur-kertas`)
 *      sinkron ±1 birama mengikuti `TempoTimeline` bersama metronom mandiri
 *      maupun rekaman audio WAV (`#6`), serta tetap menyorot kotak multi-rest
 *      saat melewati Bar 9–12 pada tampilan part Trumpet.
 *   3. Pemilihan frasa langsung dengan mengeklik birama pada partitur SVG
 *      (`Bar 5` → `Bar 8`) + tempo latihan `80%`:
 *      - menampilkan pita `partitur-sorot-frasa` (`5-8`),
 *      - menampilkan lencana `"Frasa 5–8 · 80%"` di `LayarPartitur`, `PanelLagu`,
 *        dan `KartuSetList`,
 *      - mengulang **tepat 4 birama (`5, 6, 7, 8 → kembali ke 5`, tidak pernah
 *        bocor ke birama 9)** baik bersama rekaman WAV `#6` maupun metronom +
 *        hitung mundur M1,
 *      - bertahan per lagu per perangkat di `localStorage` seusai `page.reload()`.
 *   4. Fallback tanpa MusicXML: lagu kedua tanpa berkas partitur tetap dapat
 *      memilih & mengulang frasa `Bar 5–8` pada `80%` tempo via `TempoTimeline`
 *      dan menampilkan lencana `"Frasa 5–8 · 80%"`.
 *   5. Tautan frasa ↔ set drill (`Set 4–6 = Bar 9–16`) di `KartuSetList` +
 *      sorot partitur langsung di dalam `DrillEditor` saat animasi formasi berjalan.
 *   6. Mode Anggota (`Share.tsx`): keping `Set 4–6 = Bar 9–16` ikut terbawa
 *      dan mengaktifkan latihan frasa di perangkat anggota tanpa error konsol
 *      maupun permintaan jaringan eksternal.
 *
 * Pakai: bash qa/bangun-logika.sh && BASE=http://localhost:4173 node qa/partitur-frasa.mjs
 */
import puppeteer from 'puppeteer'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { lewatSambutan } from './sambutan.mjs'

const BASE = process.env.BASE || process.argv[2] || 'http://localhost:4173'
const ORIGIN_LOKAL = new URL(BASE).origin
const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'dk-partitur-frasa-'))
const BERKAS = path.join(TMP_ROOT, 'berkas')
const UNDUH = path.join(TMP_ROOT, 'unduh')
fs.mkdirSync(BERKAS, { recursive: true })
fs.mkdirSync(UNDUH, { recursive: true })

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

function adalahUrlLokalAtauInternalPeramban(url) {
  if (
    url.startsWith('data:') ||
    url.startsWith('blob:') ||
    url.startsWith('about:') ||
    url.startsWith('chrome')
  ) {
    return true
  }
  try {
    return new URL(url).origin === ORIGIN_LOKAL
  } catch {
    return false
  }
}

/**
 * Bangun MusicXML 32 birama (4/4) dengan 3 part marching band:
 * - P1: Trumpet 1 (melodi aktif di Bar 1–8 & 13–32, ISTIRAHAT PENUH 4 birama di Bar 9–12!)
 * - P2: Mellophone (aktif sepanjang 32 birama)
 * - P3: Snare Drum (aktif sepanjang 32 birama)
 */
function buatMusicXml32Birama() {
  const daftarTangga = ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C']
  function susunBiramaPart(idPart, b) {
    const attrAwal =
      b === 1
        ? `<attributes>
          <divisions>1</divisions>
          <key><fifths>0</fifths></key>
          <time><beats>4</beats><beat-type>4</beat-type></time>
          <clef><sign>${idPart === 'P3' ? 'percussion' : 'G'}</sign><line>${idPart === 'P3' ? '2' : '2'}</line></clef>
        </attributes>`
        : ''
    // Trumpet 1 beristirahat penuh pada birama 9..12 supaya pada tampilan 1 part
    // OSMD melipatnya menjadi lambang multi-rest 4 birama (`|— 4 —|`).
    if (idPart === 'P1' && b >= 9 && b <= 12) {
      return `    <measure number="${b}">
      ${attrAwal}
      <note><rest measure="yes"/><duration>4</duration><voice>1</voice></note>
    </measure>`
    }
    const nada = daftarTangga[(b - 1) % daftarTangga.length]
    const oktaf = idPart === 'P1' ? 5 : 4
    const empatNot = [0, 1, 2, 3]
      .map(
        (k) =>
          `<note><pitch><step>${daftarTangga[(b + k) % 7]}</step><octave>${oktaf}</octave></pitch><duration>1</duration><voice>1</voice><type>quarter</type></note>`,
      )
      .join('\n      ')
    const empatKetukSnare = [0, 1, 2, 3]
      .map(
        () =>
          `<note><unpitched><display-step>C</display-step><display-octave>5</display-octave></unpitched><duration>1</duration><voice>1</voice><type>quarter</type></note>`,
      )
      .join('\n      ')
    return `    <measure number="${b}">
      ${attrAwal}
      ${idPart === 'P3' ? empatKetukSnare : empatNot || nada}
    </measure>`
  }

  const biramaP1 = Array.from({ length: 32 }, (_, i) => susunBiramaPart('P1', i + 1)).join('\n')
  const biramaP2 = Array.from({ length: 32 }, (_, i) => susunBiramaPart('P2', i + 1)).join('\n')
  const biramaP3 = Array.from({ length: 32 }, (_, i) => susunBiramaPart('P3', i + 1)).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <work><work-title>Mars Nusantara 32 Birama</work-title></work>
  <part-list>
    <score-part id="P1"><part-name>Trumpet 1</part-name><part-abbreviation>Tpt. 1</part-abbreviation></score-part>
    <score-part id="P2"><part-name>Mellophone</part-name><part-abbreviation>Mello.</part-abbreviation></score-part>
    <score-part id="P3"><part-name>Snare Drum</part-name><part-abbreviation>S.D.</part-abbreviation></score-part>
  </part-list>
  <part id="P1">
${biramaP1}
  </part>
  <part id="P2">
${biramaP2}
  </part>
  <part id="P3">
${biramaP3}
  </part>
</score-partwise>`
}

const jalurSkor32 = path.join(BERKAS, 'mars-nusantara-32.musicxml')
fs.writeFileSync(jalurSkor32, buatMusicXml32Birama())

async function ke(halaman, hash) {
  await halaman.evaluate((h) => {
    location.hash = h
  }, hash)
  await wait(700)
}

async function klik(halaman, sel) {
  await halaman.waitForSelector(sel, { timeout: 10000 })
  await halaman.evaluate((s) => {
    const el = document.querySelector(s)
    if (el) el.click()
  }, sel)
  await wait(250)
}

async function teks(halaman, sel) {
  return halaman.$eval(sel, (e) => e.textContent.trim()).catch(() => null)
}

async function unggah(halaman, sel, filePath) {
  const input = await halaman.$(sel)
  if (!input) throw new Error('Input tidak ditemukan: ' + sel)
  await input.uploadFile(filePath)
  await halaman.evaluate((s) => {
    const el = document.querySelector(s)
    if (el) el.dispatchEvent(new Event('change', { bubbles: true }))
  }, sel)
  await wait(800)
}

async function tungguRenderSelesai(halaman, batasMs = 20000) {
  const t0 = Date.now()
  while (Date.now() - t0 < batasMs) {
    const s = await halaman.evaluate(() => {
      const info = document.querySelector('[data-testid="partitur-info-sesi"]')
      const svg = document.querySelectorAll('[data-testid="partitur-kanvas-svg"] svg').length
      const galat = document.querySelector('[data-testid="partitur-render-galat"]')
      return {
        siap: Boolean(info && svg > 0),
        galat: galat ? galat.textContent.trim() : null,
      }
    })
    if (s.galat) throw new Error('Render gagal: ' + s.galat)
    if (s.siap) return
    await wait(140)
  }
  throw new Error('Waktu tunggu render OSMD habis')
}

/** Klik titik tengah grup `<g class="vf-measure" id="…">` di kanvas SVG. */
async function klikBiramaDiSvg(halaman, idMeasureXml) {
  const titik = await halaman.evaluate((idTarget) => {
    const el = document.querySelector(
      `[data-testid="partitur-kanvas-svg"] g.vf-measure[id="${idTarget}"]`,
    )
    if (!el) return null
    el.scrollIntoView({ block: 'center', inline: 'center' })
    const r = el.getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + Math.min(r.height / 2, 28) }
  }, String(idMeasureXml))
  if (!titik) return false
  await wait(120)
  const titikSegar = await halaman.evaluate((idTarget) => {
    const el = document.querySelector(
      `[data-testid="partitur-kanvas-svg"] g.vf-measure[id="${idTarget}"]`,
    )
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + Math.min(r.height / 2, 28) }
  }, String(idMeasureXml))
  if (!titikSegar) return false
  await halaman.mouse.click(titikSegar.x, titikSegar.y)
  await wait(240)
  return true
}

const browser = await puppeteer.launch({
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--autoplay-policy=no-user-gesture-required',
  ],
  defaultViewport: { width: 1360, height: 1000 },
  env: { ...process.env, LANG: process.env.LANG || 'C.utf8' },
})

let ctxAnggota = null

try {
  const p = await browser.newPage()
  const errors = []
  const permintaanLuar = []

  const pasangPemantau = (halaman) => {
    halaman.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text())
    })
    halaman.on('pageerror', (e) => errors.push(String(e)))
    halaman.on('request', (req) => {
      const u = req.url()
      if (!adalahUrlLokalAtauInternalPeramban(u)) permintaanLuar.push(u)
    })
  }
  pasangPemantau(p)
  const cdp = await p.createCDPSession()
  await cdp.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: UNDUH })

  /* ====== 1. Siapkan 2 lagu, 1 drill 6 set, 1 set list, & WAV rekaman ===== */
  console.log('\n== 1. Render 32 birama (Full score & Trumpet 1 ber-multi-rest) + nol oklch ==')

  await p.goto(BASE, { waitUntil: 'networkidle2' })
  await lewatSambutan(p)
  await wait(600)

  // Tanam lagu utama 32 birama @ 300 BPM (4/4 -> 0,8 dtk/bar di 100%, 1,0 dtk/bar di 80%),
  // lagu kedua tanpa MusicXML, rekaman WAV 32 birama, drill 6 set, dan set list.
  await p.evaluate(async () => {
    const BPM = 300
    const BEAT = 60 / BPM
    const DURASI = 30 // 32 birama * 0,8 dtk = 25,6 dtk

    function bikinWav() {
      const sr = 22050
      const n = Math.floor(sr * DURASI)
      const buf = new ArrayBuffer(44 + n * 2)
      const v = new DataView(buf)
      const tulis = (pos, s) => {
        for (let i = 0; i < s.length; i++) v.setUint8(pos + i, s.charCodeAt(i))
      }
      tulis(0, 'RIFF')
      v.setUint32(4, 36 + n * 2, true)
      tulis(8, 'WAVE')
      tulis(12, 'fmt ')
      v.setUint32(16, 16, true)
      v.setUint16(20, 1, true)
      v.setUint16(22, 1, true)
      v.setUint32(24, sr, true)
      v.setUint32(28, sr * 2, true)
      v.setUint16(32, 2, true)
      v.setUint16(34, 16, true)
      tulis(36, 'data')
      v.setUint32(40, n * 2, true)
      for (let k = 0; k * BEAT < DURASI; k++) {
        const mulai = Math.floor(k * BEAT * sr)
        for (let i = 0; i < sr * 0.01 && mulai + i < n; i++) {
          const t = i / sr
          v.setInt16(
            44 + (mulai + i) * 2,
            Math.round(Math.sin(2 * Math.PI * 880 * t) * Math.exp(-t * 260) * 22000),
            true,
          )
        }
      }
      return new Blob([buf], { type: 'audio/wav' })
    }

    const blobWav = bikinWav()
    const sukat44 = {
      pembilang: 4,
      penyebut: 4,
      kelompok: [2, 2],
      acuan: { nilai: 4, titik: false },
    }
    const lagu32 = {
      id: 'lagu-mars-32',
      title: 'Mars Nusantara 32',
      bpm: BPM,
      beats: 4,
      tandaBirama: sukat44,
      panjangBirama: 32,
      createdAt: Date.now() - 2000,
      tempoMap: [
        { id: 'seg_intro', measure: 1, bpm: BPM, label: 'Intro' },
        { id: 'seg_frase1', measure: 5, bpm: BPM, label: 'Frase 1' },
        { id: 'seg_transisi', measure: 9, bpm: BPM, label: 'Transisi' },
        { id: 'seg_penutup', measure: 17, bpm: BPM, label: 'Penutup' },
      ],
      rekaman: {
        namaFile: 'mars-32.wav',
        tipe: 'audio/wav',
        ukuran: blobWav.size,
        durasi: DURASI,
        hash: 'deadbeef32',
        titikMulaiDetik: 0,
        volumeAudio: 0.4,
        volumeKlik: 0.8,
        modeBunyi: 'keduanya',
      },
    }
    const laguTanpaXml = {
      id: 'lagu-tanpa-xml',
      title: 'Pemanasan Tanpa Partitur',
      bpm: BPM,
      beats: 4,
      tandaBirama: sukat44,
      panjangBirama: 16,
      createdAt: Date.now() - 1000,
      tempoMap: [
        { id: 'tx_1', measure: 1, bpm: BPM, label: 'Pembuka' },
        { id: 'tx_2', measure: 5, bpm: BPM, label: 'Inti Brass' },
        { id: 'tx_3', measure: 9, bpm: BPM, label: 'Koda' },
      ],
    }

    const anggotaContoh = {
      id: 'm_tpt1',
      name: 'Andra Pratama',
      panggilan: 'Andra',
      section: 'brass',
      instrument: 'Trumpet',
      active: 1,
      code: 'B01',
      createdAt: Date.now() - 3000,
    }

    const drillId = 'drill-mars-32'
    const drillObj = {
      id: drillId,
      name: 'Formasi Mars Nusantara',
      showTitle: 'Nusantara 2026',
      rosterIds: ['m_tpt1'],
      songId: 'lagu-mars-32',
      tempo: BPM,
      beatsPerCount: 1,
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
      createdAt: Date.now() - 1500,
      updatedAt: Date.now(),
    }

    // 6 set di 4/4 (1 ketuk/hitungan -> 4 hitungan = 1 birama):
    // Set 1 (8) = Bar 1–2, Set 2 (8) = Bar 3–4, Set 3 (16) = Bar 5–8,
    // Set 4 (8) = Bar 9–10, Set 5 (16) = Bar 11–14, Set 6 (8) = Bar 15–16!
    const hitunganSet = [8, 8, 16, 8, 16, 8]
    const daftarSet = hitunganSet.map((c, idx) => ({
      id: `set_mars_${idx + 1}`,
      drillId,
      order: idx,
      name: `Set ${idx + 1}`,
      counts: c,
      notes: '',
      createdAt: Date.now() - 1400 + idx,
      points: {
        m_tpt1: { x: 20 + idx * 6, y: 20 + (idx % 2) * 5, facing: 'front' },
      },
    }))

    const setlistObj = {
      id: 'sl-show-utama',
      name: 'Show Utama 2026',
      songIds: ['lagu-mars-32', 'lagu-tanpa-xml'],
      createdAt: Date.now() - 500,
      updatedAt: Date.now(),
    }

    await new Promise((selesai, tolak) => {
      const req = indexedDB.open('drillkit')
      req.onerror = () => tolak(req.error)
      req.onsuccess = () => {
        const db = req.result
        const tx = db.transaction(
          ['songs', 'rekamanAudio', 'members', 'drills', 'sets', 'setlists'],
          'readwrite',
        )
        tx.objectStore('songs').put(lagu32)
        tx.objectStore('songs').put(laguTanpaXml)
        tx.objectStore('rekamanAudio').put({
          id: 'lagu-mars-32',
          songId: 'lagu-mars-32',
          blob: blobWav,
          namaFile: 'mars-32.wav',
          tipe: 'audio/wav',
          ukuran: blobWav.size,
          durasi: DURASI,
          hash: 'deadbeef32',
          updatedAt: Date.now(),
        })
        tx.objectStore('members').put(anggotaContoh)
        tx.objectStore('drills').put(drillObj)
        for (const st of daftarSet) tx.objectStore('sets').put(st)
        tx.objectStore('setlists').put(setlistObj)
        tx.oncomplete = () => {
          db.close()
          selesai()
        }
        tx.onerror = () => {
          db.close()
          tolak(tx.error)
        }
      }
    })
  })

  await ke(p, '#/musik')
  await klik(p, '[data-testid="pilih-lagu-lagu-mars-32"]')
  await p.waitForSelector('[data-testid="panel-partitur"]', { timeout: 10000 })

  // Unggah partitur 32 birama
  await unggah(p, '#partitur-input', jalurSkor32)
  await p.waitForSelector('[data-testid="partitur-simpan"]', { timeout: 10000 })
  await klik(p, '[data-testid="partitur-simpan"]')
  await p.waitForSelector('[data-testid="partitur-buka"]', { timeout: 10000 })

  await klik(p, '[data-testid="partitur-buka"]')
  await p.waitForSelector('[data-testid="layar-partitur"]', { timeout: 10000 })
  await tungguRenderSelesai(p)

  const infoFull = await teks(p, '[data-testid="partitur-info-sesi"]')
  cek(
    'skor 32 birama dirender utuh pada Full score (3 part)',
    Boolean(infoFull && infoFull.includes('32 birama') && infoFull.includes('Full score')),
    infoFull || '',
  )

  const sorotAwalAda = await p.$eval(
    '[data-testid="partitur-sorot-aktif"]',
    (el) => ({
      birama: el.getAttribute('data-birama-aktif'),
      lebar: el.getBoundingClientRect().width,
    }),
  )
  cek(
    'kotak sorot birama aktif tampil pada birama 1 dengan lebar > 0',
    sorotAwalAda.birama === '1' && sorotAwalAda.lebar > 20,
    JSON.stringify(sorotAwalAda),
  )

  // Saring ke 1 part spesifik: Trumpet 1 (memiliki multi-rest 4 birama di Bar 9–12!)
  await p.select('[data-testid="partitur-pilih-part"]', 'P1')
  await wait(350)
  await tungguRenderSelesai(p)

  const infoTrumpet = await teks(p, '[data-testid="partitur-info-sesi"]')
  cek(
    'part Trumpet 1 dirender utuh 32 birama',
    Boolean(infoTrumpet && infoTrumpet.includes('32 birama') && infoTrumpet.includes('1/3 part · Trumpet 1')),
    infoTrumpet || '',
  )

  // Loncat ke segmen Transisi (Bar 9) untuk menguji pemetaan multi-rest 9–12 pada Trumpet 1!
  await klik(p, '[data-testid="chip-segmen-2"]') // Transisi -> measure 9
  await wait(300)
  // Majukan ke Bar 11 lewat klik kotak multi-rest / loncat birama
  const multiRestAttr = await p.$eval(
    '[data-testid="partitur-sorot-aktif"]',
    (el) => ({
      birama: el.getAttribute('data-birama-aktif'),
      multirest: el.getAttribute('data-multirest'),
      lebar: el.getBoundingClientRect().width,
    }),
  )
  cek(
    'pada part Trumpet 1, istirahat 4 birama (Bar 9–12) terpetakan sebagai multi-rest dan tetap tersorot',
    multiRestAttr.birama === '9' && multiRestAttr.multirest === '9-12' && multiRestAttr.lebar > 20,
    JSON.stringify(multiRestAttr),
  )

  // Kembali ke Full score untuk menguji sinkronisasi penuh & klik tiap birama
  await klik(p, '[data-testid="partitur-filter-semua"]')
  await wait(300)
  await tungguRenderSelesai(p)

  /* ====== 2. Sinkron highlight ±1 birama & auto-scroll (WAV + Metronom) === */
  console.log('\n== 2. Sinkronisasi sorot ±1 birama & auto-scroll dengan rekaman WAV & metronom ==')

  // Loncat kembali ke Bar 1 lalu putar dari bilah partitur (bersama rekaman WAV #6!)
  await klik(p, '[data-testid="chip-segmen-0"]')
  await p.evaluate(() => {
    const k = document.querySelector('[data-testid="partitur-kertas"]')
    if (k) k.scrollTop = 0
  })
  await wait(200)

  await klik(p, '[data-testid="partitur-tombol-putar"]')

  // Pantau keselarasan antara birama metronom/rekaman (`panel-birama`) dan
  // kotak sorot SVG (`partitur-sorot-aktif`) selama ~4,5 detik (~5–6 birama).
  const sampelSinkron = []
  const tMulaiPantau = Date.now()
  while (Date.now() - tMulaiPantau < 4600) {
    const snap = await p.evaluate(() => {
      const bPanel = Number(document.querySelector('[data-testid="panel-birama"]')?.textContent ?? '0')
      const bSorot = Number(
        document.querySelector('[data-testid="partitur-sorot-aktif"]')?.getAttribute('data-birama-aktif') ?? '0',
      )
      return { bPanel, bSorot }
    })
    if (snap.bPanel >= 1 && snap.bSorot >= 1) sampelSinkron.push(snap)
    await wait(180)
  }

  // Loncat ke segmen Penutup (Bar 17, di sistem bawah) saat sedang berjalan untuk membuktikan auto-scroll!
  await klik(p, '[data-testid="chip-segmen-3"]')
  await wait(900)
  const scrollSaatBar17 = await p.$eval('[data-testid="partitur-kertas"]', (el) => el.scrollTop)

  await klik(p, '[data-testid="partitur-tombol-putar"]') // Berhenti
  await wait(250)

  const maksSelisih = sampelSinkron.reduce(
    (maks, s) => Math.max(maks, Math.abs(s.bPanel - s.bSorot)),
    0,
  )
  const biramaUnik = [...new Set(sampelSinkron.map((s) => s.bSorot))]
  cek(
    'sorot birama aktif bergerak maju mengikuti rekaman WAV & metronom',
    biramaUnik.length >= 4 && Math.max(...biramaUnik) >= 4,
    `birama dikunjungi: ${JSON.stringify(biramaUnik)}`,
  )
  cek(
    'selisih sorot partitur terhadap posisi rekaman/metronom <= 1 birama (0 birama)',
    sampelSinkron.length >= 6 && maksSelisih <= 1,
    `maksSelisih=${maksSelisih}`,
  )
  cek(
    'auto-scroll menggulir wadah kertas saat birama masuk sistem bawah (Bar 17+)',
    scrollSaatBar17 > 40,
    `scrollTop=${scrollSaatBar17}`,
  )

  /* ====== 3. Pilih & loop Frasa Bar 5–8 pada 80% tempo + ingatan perangkat = */
  console.log('\n== 3. Pilih & loop Bar 5–8 tepat 4 birama pada 80% tempo + lencana ==')

  // Pilih set list Show Utama 2026 supaya KartuSetList ikut memantau lencana frasa!
  await p.select('[data-testid="pilih-setlist"]', 'sl-show-utama')
  await wait(300)

  // Aktifkan mode pilih frasa 2-ketuk di partitur lalu klik birama 5 dan birama 8 langsung di SVG!
  await klik(p, '[data-testid="partitur-mode-pilih-frasa"]')
  const okKlik5 = await klikBiramaDiSvg(p, 5)
  const okKlik8 = await klikBiramaDiSvg(p, 8)
  cek('klik langsung birama 5 dan birama 8 pada SVG partitur berhasil', okKlik5 && okKlik8)

  // Setel tempo latihan ke 80% dari bilah partitur
  await klik(p, '[data-testid="partitur-tempo-80"]')
  await wait(300)

  const pitaFrasaAttr = await p.$eval(
    '[data-testid="partitur-sorot-frasa"]',
    (el) => ({
      rentang: el.getAttribute('data-frasa-rentang'),
      lebar: el.getBoundingClientRect().width,
    }),
  )
  cek(
    'pita sorot frasa tampil membentangi birama 5–8 di atas SVG',
    pitaFrasaAttr.rentang === '5-8' && pitaFrasaAttr.lebar > 80,
    JSON.stringify(pitaFrasaAttr),
  )

  const lencanaDiPartitur = await teks(p, '[data-testid="partitur-lencana-frasa"]')
  const lencanaDiPanel = await teks(p, '[data-testid="panel-lagu-lencana-frasa"]')
  const lencanaDiSetList = await teks(p, '[data-testid="setlist-lencana-frasa-0"]')
  cek(
    'lencana "Frasa 5–8 · 80%" tampil di LayarPartitur',
    lencanaDiPartitur === 'Frasa 5–8 · 80%',
    lencanaDiPartitur || '',
  )
  cek(
    'lencana "Frasa 5–8 · 80%" tampil di PanelLagu',
    lencanaDiPanel === 'Frasa 5–8 · 80%',
    lencanaDiPanel || '',
  )
  cek(
    'lencana "Frasa 5–8 · 80%" tampil di KartuSetList',
    lencanaDiSetList === 'Frasa 5–8 · 80%',
    lencanaDiSetList || '',
  )

  // Uji Shift+klik langsung pada birama 6 di SVG (tanpa menyalakan modePilihFrasa terlebih dahulu)
  await p.keyboard.down('Shift')
  await klikBiramaDiSvg(p, 6)
  await p.keyboard.up('Shift')
  await wait(200)
  const lencanaShift = await teks(p, '[data-testid="partitur-lencana-frasa"]')
  cek(
    'Shift+klik pada birama 6 di SVG langsung mengubah rentang frasa menjadi "Frasa 5–6 · 80%"',
    lencanaShift === 'Frasa 5–6 · 80%',
    lencanaShift || '',
  )

  // Kembalikan ke Bar 5–8 lewat Shift+klik pada birama 8
  await p.keyboard.down('Shift')
  await klikBiramaDiSvg(p, 8)
  await p.keyboard.up('Shift')
  await wait(200)

  // Uji Kunci Kios (data-kiosk="1"): seluruh tombol frasa & transport partitur tetap pointer-events: auto
  await p.evaluate(() => document.documentElement.setAttribute('data-kiosk', '1'))
  const interaktifKios11d = await p.evaluate(() => {
    const daftar = [
      '[data-testid="partitur-tombol-putar"]',
      '[data-testid="partitur-mode-pilih-frasa"]',
      '[data-testid="partitur-toggle-ulang"]',
      '[data-testid="partitur-tempo-80"]',
      '[data-testid="partitur-ikuti-birama"]',
    ]
    return daftar.every((sel) => {
      const el = document.querySelector(sel)
      return Boolean(el) && getComputedStyle(el).pointerEvents === 'auto'
    })
  })
  await p.evaluate(() => document.documentElement.removeAttribute('data-kiosk'))
  cek(
    'seluruh kendali transport, pilih frasa, & tempo di LayarPartitur tetap interaktif saat Kunci Kios aktif',
    interaktifKios11d === true,
  )

  // Audit ketat warna: saat sorot aktif + sorot frasa + lencana tampil, `layar-partitur` tetap 0 oklch / color-mix!
  const adaOklchSaatSorot = await p.$eval('[data-testid="layar-partitur"]', (el) =>
    /oklch\(|color-mix\(/i.test(el.outerHTML),
  )
  cek(
    'nol oklch() / color-mix() pada layar-partitur saat seluruh lapisan sorot & bilah frasa aktif',
    adaOklchSaatSorot === false,
  )

  // Putar selama ~5,6 detik bersama rekaman WAV #6 pada 80% tempo:
  // 300 BPM * 80% = 240 BPM -> 4/4 = 1,0 detik per birama -> 4 birama (5,6,7,8) = 4,0 detik,
  // lalu wajib kembali ke birama 5 tanpa pernah bocor ke birama 9!
  await klik(p, '[data-testid="partitur-tombol-putar"]')
  const jejakLoopWav = []
  const tLoop0 = Date.now()
  while (Date.now() - tLoop0 < 5600) {
    const b = await p.$eval('[data-testid="partitur-sorot-aktif"]', (el) =>
      Number(el.getAttribute('data-birama-aktif') ?? '0'),
    )
    if (b > 0 && jejakLoopWav[jejakLoopWav.length - 1] !== b) {
      jejakLoopWav.push(b)
    }
    await wait(120)
  }
  await klik(p, '[data-testid="partitur-tombol-putar"]')
  await wait(250)

  const hanya5Sampai8 = jejakLoopWav.length > 0 && jejakLoopWav.every((b) => b >= 5 && b <= 8)
  const idxBar8 = jejakLoopWav.indexOf(8)
  const kembaliKe5 = idxBar8 >= 0 && jejakLoopWav.slice(idxBar8 + 1).includes(5)
  cek(
    'loop Bar 5–8 bersama rekaman WAV #6 pada 80% tempo hanya mengunjungi birama 5, 6, 7, 8 (tidak bocor ke 9)',
    hanya5Sampai8 && [5, 6, 7, 8].every((b) => jejakLoopWav.includes(b)),
    `jejak=${JSON.stringify(jejakLoopWav)}`,
  )
  cek(
    'seusai birama 8, pemutaran rekaman & sorot partitur melompat tepat kembali ke birama 5',
    kembaliKe5,
    `jejak=${JSON.stringify(jejakLoopWav)}`,
  )

  // Muat ulang halaman untuk memverifikasi ingatan frasa per lagu per perangkat di localStorage!
  await p.reload({ waitUntil: 'networkidle2' })
  await wait(700)
  await ke(p, '#/musik')
  await klik(p, '[data-testid="pilih-lagu-lagu-mars-32"]')
  await wait(400)
  const lencanaSesudahReload = await teks(p, '[data-testid="panel-lagu-lencana-frasa"]')
  cek(
    'pilihan Frasa 5–8 · 80% diingat per lagu per perangkat seusai muat ulang halaman',
    lencanaSesudahReload === 'Frasa 5–8 · 80%',
    lencanaSesudahReload || '',
  )

  /* ====== 4. Fallback latihan frasa tanpa MusicXML + Count-off M1 ========= */
  console.log('\n== 4. Fallback latihan frasa tanpa MusicXML + hitung mundur M1 ==')

  await klik(p, '[data-testid="pilih-lagu-lagu-tanpa-xml"]')
  await wait(350)
  await p.select('[data-testid="pilih-setlist"]', 'sl-show-utama')
  await wait(250)

  // Pilih frasa dari keping segmen ke-2 ("Inti Brass" = Bar 5–8) walau tanpa MusicXML!
  await klik(p, '[data-testid="ulang-segmen-1"]')
  // Setel tempo latihan lagu kedua ke 80% lewat tombol -5% sebanyak 4 kali (100% -> 80%)
  for (let i = 0; i < 4; i++) {
    await klik(p, '[data-testid="latihan-kurang"]')
  }
  await wait(200)

  const lencanaFallbackPanel = await teks(p, '[data-testid="panel-lagu-lencana-frasa"]')
  const lencanaFallbackSetList = await teks(p, '[data-testid="setlist-lencana-frasa-1"]')
  cek(
    'tanpa MusicXML, keping segmen menyalakan "Frasa 5–8 · 80%" di PanelLagu & KartuSetList',
    lencanaFallbackPanel === 'Frasa 5–8 · 80%' && lencanaFallbackSetList === 'Frasa 5–8 · 80%',
    `panel=${lencanaFallbackPanel}, setlist=${lencanaFallbackSetList}`,
  )

  // Nyalakan hitung mundur M1 (1 birama sebelum masuk Bar 5) lalu putar metronom fallback
  await p.evaluate(() => {
    const kotakHitung = document.querySelector('[data-testid="kartu-hitung-mundur"] button[role="switch"], [data-testid="kartu-hitung-mundur"] input[type="checkbox"]')
    if (kotakHitung) kotakHitung.click()
  })
  await wait(200)
  await klik(p, '[data-testid="tombol-mulai"]')

  const jejakFallback = []
  const tFb0 = Date.now()
  while (Date.now() - tFb0 < 5600) {
    const b = Number((await teks(p, '[data-testid="panel-birama"]')) ?? '0')
    if (b > 0 && jejakFallback[jejakFallback.length - 1] !== b) jejakFallback.push(b)
    await wait(120)
  }
  await klik(p, '[data-testid="tombol-mulai"]')
  await wait(250)

  cek(
    'tanpa MusicXML, loop Bar 5–8 tetap berjalan via TempoTimeline dan kembali ke Bar 5',
    jejakFallback.length >= 4 &&
      jejakFallback.every((b) => b >= 5 && b <= 8) &&
      jejakFallback.indexOf(8) >= 0 &&
      jejakFallback.slice(jejakFallback.indexOf(8) + 1).includes(5),
    `jejakFallback=${JSON.stringify(jejakFallback)}`,
  )

  /* ====== 5. Tautan Set 4–6 = Bar 9–16 di Set List & Sorot di DrillEditor == */
  console.log('\n== 5. Tautan "Set 4–6 = Bar 9–16" & sorot partitur saat drill berjalan ==')

  await klik(p, '[data-testid="setlist-atur-tautan-0"]')
  await p.waitForSelector('[data-testid="setlist-panel-tautan-0"]', { timeout: 6000 })
  await p.select('[data-testid="setlist-tautan-set-awal-0"]', '4')
  await wait(150)
  await p.select('[data-testid="setlist-tautan-set-akhir-0"]', '6')
  await wait(150)

  const pratinjauTautan = await teks(p, '[data-testid="setlist-pratinjau-tautan-0"]')
  cek(
    'pemilih rentang set drill otomatis menghitung "Set 4–6 = Bar 9–16"',
    pratinjauTautan === 'Set 4–6 = Bar 9–16',
    pratinjauTautan || '',
  )

  await klik(p, '[data-testid="setlist-tautan-simpan-0"]')
  await wait(450)
  await tungguRenderSelesai(p)

  const kepingTautanSetList = await teks(p, '[data-testid="setlist-tautan-set-0"]')
  const lencana916 = await teks(p, '[data-testid="panel-lagu-lencana-frasa"]')
  cek(
    'keping "Set 4–6 = Bar 9–16" tersimpan di KartuSetList dan mengaktifkan Frasa 9–16 · 80%',
    kepingTautanSetList === 'Set 4–6 = Bar 9–16' && lencana916 === 'Frasa 9–16 · 80%',
    `keping=${kepingTautanSetList}, lencana=${lencana916}`,
  )

  // Buka editor formasi (DrillEditor) -> buka partitur pendamping -> jalankan urutan mulai Set 4!
  await ke(p, '#/drill')
  await p.waitForSelector('[data-testid="drill-tombol-partitur"]', { timeout: 10000 })
  await klik(p, '[data-testid="drill-tombol-partitur"]')
  await p.waitForSelector('[data-testid="drill-panel-partitur"] [data-testid="layar-partitur"]', {
    timeout: 10000,
  })
  await tungguRenderSelesai(p)

  // Klik keping Set 3 (Bar 5–8) langsung dari dalam LayarPartitur pendamping -> penggaris drill ikut loncat ke Set 3!
  await klik(p, '[data-testid="partitur-chip-set-3"]')
  await wait(250)
  const biramaDrillSet3 = await p.$eval(
    '[data-testid="partitur-sorot-aktif"]',
    (el) => Number(el.getAttribute('data-birama-aktif') ?? '0'),
  )
  cek(
    'mengeklik keping "Set 3 (Bar 5–8)" di LayarPartitur menggeser posisi drill ke birama 5',
    biramaDrillSet3 === 5,
    `biramaDrillSet3=${biramaDrillSet3}`,
  )

  // Klik Set 4 di penggaris drill (mulai di Bar 9)
  await klik(p, '[data-testid="penggaris-set-3"]')
  await wait(250)
  const biramaDrillSet4 = await p.$eval(
    '[data-testid="partitur-sorot-aktif"]',
    (el) => Number(el.getAttribute('data-birama-aktif') ?? '0'),
  )
  cek(
    'di DrillEditor, memilih Set 4 langsung menyorot birama 9 pada partitur pendamping',
    biramaDrillSet4 === 9,
    `biramaDrillSet4=${biramaDrillSet4}`,
  )

  // Putar animasi drill dari bilah partitur dan pastikan birama aktif bergerak maju (9 -> 10+)!
  await klik(p, '[data-testid="partitur-tombol-putar"]')
  const jejakDrill = []
  const tDr0 = Date.now()
  while (Date.now() - tDr0 < 2300) {
    const b = await p.$eval('[data-testid="partitur-sorot-aktif"]', (el) =>
      Number(el.getAttribute('data-birama-aktif') ?? '0'),
    )
    if (b > 0 && jejakDrill[jejakDrill.length - 1] !== b) jejakDrill.push(b)
    await wait(120)
  }
  const masihJalan = await p.$eval('[data-testid="partitur-tombol-putar"]', (el) =>
    el.textContent?.includes('Berhenti'),
  )
  if (masihJalan) await klik(p, '[data-testid="partitur-tombol-putar"]')

  cek(
    'saat animasi drill berjalan, sorot birama di partitur ikut maju melintasi Bar 9 → 10',
    jejakDrill.includes(9) && jejakDrill.includes(10),
    `jejakDrill=${JSON.stringify(jejakDrill)}`,
  )

  /* ====== 6. Mode Anggota: paket membawa tautan Set 4–6 = Bar 9–16 ======== */
  console.log('\n== 6. Mode Anggota & audit konsol / jaringan ==')

  await ke(p, '#/berbagi')
  await klik(p, '[data-testid="unduh-grup"]')
  let berkasUnduh = []
  for (let i = 0; i < 30; i++) {
    berkasUnduh = fs.readdirSync(UNDUH).filter((f) => f.endsWith('.json') && !f.endsWith('.crdownload'))
    if (berkasUnduh.length >= 1) break
    await wait(200)
  }
  cek('paket grup berhasil diunduh untuk diuji di perangkat anggota', berkasUnduh.length >= 1)

  if (berkasUnduh.length >= 1) {
    const jalurPaket = path.join(UNDUH, berkasUnduh[0])
    ctxAnggota = await browser.createBrowserContext()
    const pa = await ctxAnggota.newPage()
    pasangPemantau(pa)
    pa.on('dialog', async (d) => {
      await d.accept()
    })

    await pa.goto(BASE, { waitUntil: 'networkidle2' })
    await wait(900)
    await klik(pa, '[data-testid="pilih-member"]')
    await klik(pa, '[data-testid="lanjut-pilih-mode"]')
    await wait(800)
    await ke(pa, '#/berbagi')

    const selInputPaket = (await pa.$('#pkg-input')) ? '#pkg-input' : '#pkg-input2'
    await unggah(pa, selInputPaket, jalurPaket)
    await wait(1500)

    await klik(pa, '[data-testid="tab-musik"]')
    await wait(700)
    await pa.select('[data-testid="pilih-setlist"]', 'sl-show-utama')
    await wait(300)

    const teksTautanAnggota = await teks(pa, '[data-testid="setlist-tautan-set-0"]')
    const tombolAturAdaDiAnggota = (await pa.$('[data-testid="setlist-atur-tautan-0"]')) !== null
    cek(
      'di mode anggota, tautan "Set 4–6 = Bar 9–16" ikut terbawa utuh sementara tombol sunting pelatih disembunyikan',
      teksTautanAnggota === 'Set 4–6 = Bar 9–16' && !tombolAturAdaDiAnggota,
      `teks=${teksTautanAnggota}, tombolSunting=${tombolAturAdaDiAnggota}`,
    )

    await klik(pa, '[data-testid="setlist-tautan-set-0"]')
    await wait(300)
    const lencanaAnggota = await teks(pa, '[data-testid="panel-lagu-lencana-frasa"]')
    cek(
      'anggota mengeklik "Set 4–6 = Bar 9–16" langsung mengaktifkan Frasa 9–16 pada perangkatnya',
      lencanaAnggota === 'Frasa 9–16',
      lencanaAnggota || '',
    )
  }

  cek('0 error konsol selama seluruh skenario #11d', errors.length === 0, errors.join(' | '))
  cek(
    '0 permintaan jaringan ke luar origin lokal (100% offline)',
    permintaanLuar.length === 0,
    permintaanLuar.join(', '),
  )
} finally {
  if (ctxAnggota) await ctxAnggota.close().catch(() => {})
  await browser.close().catch(() => {})
  fs.rmSync(TMP_ROOT, { recursive: true, force: true })
}

console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length > 0) process.exit(1)
