/**
 * #13 (Uji Peramban E2E) — Partitur Tersaring Per-Suara & Audio Panduan di Paket Anggota,
 * Sintesis Bunyi Notasi WebAudio (`Bunyikan not`), serta Akor/Temperamen Drone Penala.
 *
 * Skenario yang dibuktikan ujung-ke-ujung di Chromium:
 *   1. Pelatih memasang skor MusicXML 3-part (Flute, Trumpet in Bb 1, Snare Drum)
 *      dan rekaman WAV panduan pada lagu di `#/musik`, serta memiliki 2 anggota
 *      (`Andi` — Trumpet 1, `Budi` — Snare Drum).
 *   2. Di `#/musik` (`LayarPartitur`), tombol `partitur-bunyikan-not` ("Bunyikan not")
 *      menyintesis bunyi notasi WebAudio secara langsung, memajukan indikator birama
 *      & sorot aktif (`partitur-sorot-aktif`) secara real-time mengikuti tempo,
 *      serta berhenti bersih saat ditekan kembali ("Hentikan not").
 *   3. Di `TunerDrone` (`kartu-penala`), memilih instrumen `Bb` + preset `Bb konser` +
 *      harmoni `Akor Mayor (1–3–5)` + temperamen `Murni / Just (Brass)` menampilkan
 *      panduan susunan nada tertulis `C4 · E4 (-14 sen) · G4 (+2 sen)` tanpa meluap
 *      di layar sempit 390px, serta berbunyi & berhenti bersih tanpa galat.
 *   4. Di `#/berbagi` pelatih, saklar `toggle-partitur-paket` aktif bawaan dan
 *      `toggle-rekaman-zip` tersedia; mengunduh `Unduh per anggota (ZIP)` menghasilkan
 *      ZIP berisi paket `Andi` (partitur sudah terpangkas khusus ke `P2` Trumpet 1!)
 *      dan paket `Budi` (terpangkas khusus ke `P3` Snare Drum!) beserta audio panduan.
 *   5. Di konteks peramban segar **Mode Anggota** (IndexedDB kosong), anggota membuka
 *      paket `Andi`, melihat pratinjau `"1 partitur siap baca"`, dan saat membuka tab
 *      **Musik → Buka partitur**, notasi SVG Trumpet langsung ter-render secara luring
 *      tanpa mengunggah berkas `.musicxml` terpisah, lengkap dengan tombol `Bunyikan not`!
 */
import puppeteer from 'puppeteer'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { lewatSambutan } from './sambutan.mjs'
import { bukaZip, bikinZip } from '/tmp/zip.mjs'

const BASE = process.env.BASE || process.argv[2] || 'http://localhost:4173'
const ORIGIN_LOKAL = new URL(BASE).origin
const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'dk-13-e2e-'))
const BERKAS = path.join(TMP_ROOT, 'berkas')
const UNDUH = path.join(TMP_ROOT, 'unduh')
fs.mkdirSync(BERKAS, { recursive: true })
fs.mkdirSync(UNDUH, { recursive: true })

let lulus = 0
const gagal = []
function cek(nama, ok, detail = '') {
  if (ok) {
    lulus += 1
    console.log('  ✓ ' + nama)
  } else {
    gagal.push(nama + (detail ? ' — ' + detail : ''))
    console.log('  ✗ ' + nama + (detail ? ' → ' + detail : ''))
  }
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

function adalahUrlLokal(url) {
  return (
    url.startsWith('data:') ||
    url.startsWith('blob:') ||
    url.startsWith('about:') ||
    url.startsWith('chrome') ||
    url.startsWith(ORIGIN_LOKAL)
  )
}

const SKOR_TIGA_PART = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <work><work-title>Gita Nusantara</work-title></work>
  <part-list>
    <score-part id="P1"><part-name>Flute</part-name></score-part>
    <score-part id="P2"><part-name>Trumpet in Bb 1</part-name></score-part>
    <score-part id="P3"><part-name>Snare Drum</part-name></score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      <direction placement="above">
        <direction-type><rehearsal>A</rehearsal></direction-type>
        <sound tempo="240"/>
      </direction>
      <note><pitch><step>G</step><octave>5</octave></pitch><duration>4</duration><type>whole</type></note>
    </measure>
    <measure number="2">
      <note><pitch><step>A</step><octave>5</octave></pitch><duration>4</duration><type>whole</type></note>
    </measure>
    <measure number="3">
      <note><pitch><step>B</step><octave>5</octave></pitch><duration>4</duration><type>whole</type></note>
    </measure>
    <measure number="4">
      <note><pitch><step>C</step><octave>6</octave></pitch><duration>4</duration><type>whole</type></note>
    </measure>
  </part>
  <part id="P2">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key><fifths>2</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
        <transpose><diatonic>-1</diatonic><chromatic>-2</chromatic></transpose>
      </attributes>
      <note><pitch><step>C</step><octave>5</octave></pitch><duration>2</duration><type>half</type></note>
      <note><pitch><step>D</step><octave>5</octave></pitch><duration>2</duration><type>half</type></note>
    </measure>
    <measure number="2">
      <note><pitch><step>E</step><octave>5</octave></pitch><duration>2</duration><type>half</type></note>
      <note><pitch><step>G</step><octave>5</octave></pitch><duration>2</duration><type>half</type></note>
    </measure>
    <measure number="3">
      <note><pitch><step>F</step><octave>5</octave></pitch><duration>2</duration><type>half</type></note>
      <note><pitch><step>E</step><octave>5</octave></pitch><duration>2</duration><type>half</type></note>
    </measure>
    <measure number="4">
      <note><pitch><step>D</step><octave>5</octave></pitch><duration>4</duration><type>whole</type></note>
    </measure>
  </part>
  <part id="P3">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>percussion</sign></clef>
      </attributes>
      <note><unpitched><display-step>C</display-step><display-octave>5</display-octave></unpitched><duration>1</duration><type>quarter</type></note>
      <note><unpitched><display-step>C</display-step><display-octave>5</display-octave></unpitched><duration>1</duration><type>quarter</type></note>
      <note><unpitched><display-step>C</display-step><display-octave>5</display-octave></unpitched><duration>2</duration><type>half</type></note>
    </measure>
    <measure number="2">
      <note><unpitched><display-step>C</display-step><display-octave>5</display-octave></unpitched><duration>4</duration><type>whole</type></note>
    </measure>
    <measure number="3">
      <note><unpitched><display-step>C</display-step><display-octave>5</display-octave></unpitched><duration>4</duration><type>whole</type></note>
    </measure>
    <measure number="4">
      <note><unpitched><display-step>C</display-step><display-octave>5</display-octave></unpitched><duration>4</duration><type>whole</type></note>
    </measure>
  </part>
</score-partwise>`

const jalurSkor = path.join(BERKAS, 'gita-nusantara.musicxml')
fs.writeFileSync(jalurSkor, SKOR_TIGA_PART)

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

async function tungguRenderPartitur(p) {
  const t0 = Date.now()
  while (Date.now() - t0 < 20000) {
    const s = await p.evaluate(() => {
      const info = document.querySelector('[data-testid="partitur-info-sesi"]')
      const svg = document.querySelectorAll('[data-testid="partitur-kanvas-svg"] svg').length
      const galat = document.querySelector('[data-testid="partitur-render-galat"]')
      return { siap: Boolean(info && svg > 0), galat: galat ? galat.textContent.trim() : null }
    })
    if (s.galat) throw new Error('Render gagal: ' + s.galat)
    if (s.siap) return
    await wait(140)
  }
  throw new Error('Waktu tunggu render OSMD habis')
}

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required'],
  defaultViewport: { width: 1280, height: 860 },
})

try {
  const p = await browser.newPage()
  const errors = []
  const permintaanLuar = []

  const pantau = (hal) => {
    hal.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text())
    })
    hal.on('pageerror', (e) => errors.push(String(e)))
    hal.on('request', (req) => {
      if (!adalahUrlLokal(req.url())) permintaanLuar.push(req.url())
    })
  }
  pantau(p)

  const cdp = await p.createCDPSession()
  await cdp.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: UNDUH })

  await p.goto(BASE, { waitUntil: 'networkidle2' })
  await lewatSambutan(p)
  await wait(500)

  // Tanam lagu + WAV rekaman + 2 anggota (Andi Trumpet 1, Budi Snare Drum)
  await p.evaluate(async () => {
    const sr = 8000
    const n = sr * 2
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
    const blobWav = new Blob([buf], { type: 'audio/wav' })

    const lagu = {
      id: 'lagu-gita',
      title: 'Gita Nusantara',
      bpm: 240,
      beats: 4,
      panjangBirama: 4,
      tempoMap: [{ id: 'seg1', label: 'Utama', measure: 1, bpm: 240, beats: 4 }],
      rekaman: {
        namaFile: 'panduan-gita.wav',
        tipe: 'audio/wav',
        durasi: 2,
        ukuran: blobWav.size,
        titikMulaiDetik: 0,
        volumeAudio: 0.4,
        volumeKlik: 0.8,
        modeBunyi: 'keduanya',
        hash: 'wavhash13',
      },
      createdAt: Date.now(),
    }

    const anggota = [
      {
        id: 'm_andi_trp',
        code: 'B01',
        name: 'Andi Pratama',
        panggilan: 'Andi',
        section: 'brass',
        instrument: 'Trumpet 1',
        role: 'member',
        yearJoined: 2025,
        active: 1,
        token: 'tok-andi',
        createdAt: Date.now(),
      },
      {
        id: 'm_budi_snr',
        code: 'P01',
        name: 'Budi Santoso',
        panggilan: 'Budi',
        section: 'battery',
        instrument: 'Snare Drum',
        role: 'member',
        yearJoined: 2025,
        active: 1,
        token: 'tok-budi',
        createdAt: Date.now(),
      },
    ]

    await new Promise((resolve, reject) => {
      const req = indexedDB.open('drillkit')
      req.onerror = () => reject(req.error)
      req.onsuccess = () => {
        const db = req.result
        const tx = db.transaction(['songs', 'rekamanAudio', 'members'], 'readwrite')
        tx.objectStore('songs').clear()
        tx.objectStore('members').clear()
        tx.objectStore('songs').put(lagu)
        tx.objectStore('rekamanAudio').put({
          id: 'lagu-gita',
          songId: 'lagu-gita',
          blob: blobWav,
          namaFile: 'panduan-gita.wav',
          tipe: 'audio/wav',
          ukuran: blobWav.size,
          durasi: 2,
          hash: 'wavhash13',
          updatedAt: Date.now(),
        })
        for (const m of anggota) tx.objectStore('members').put(m)
        tx.oncomplete = () => {
          db.close()
          resolve()
        }
        tx.onerror = () => {
          db.close()
          reject(tx.error)
        }
      }
    })
  })

  /* ====== 1. Pasang partitur & uji sintesis bunyi notasi WebAudio (#13b) === */
  console.log('\n== 1. Sintesis Bunyi Notasi WebAudio di LayarPartitur (#13b) ==')
  await ke(p, '#/musik')
  await klik(p, '[data-testid="pilih-lagu-lagu-gita"]')
  await p.waitForSelector('[data-testid="panel-partitur"]', { timeout: 10000 })
  await unggah(p, '#partitur-input', jalurSkor)
  await klik(p, '[data-testid="partitur-simpan"]')
  await klik(p, '[data-testid="partitur-buka"]')
  await p.waitForSelector('[data-testid="layar-partitur"]', { timeout: 10000 })
  await tungguRenderPartitur(p)

  const adaTombolBunyi = await p.$('[data-testid="partitur-bunyikan-not"]')
  cek('13b: tombol "Bunyikan not" tampil pada LayarPartitur MusicXML', Boolean(adaTombolBunyi))

  const labelAwal = await p.$eval('[data-testid="partitur-bunyikan-not"]', (el) => el.textContent?.trim() ?? '')
  cek('13b: label awal adalah "Bunyikan not"', labelAwal === 'Bunyikan not', labelAwal)

  await p.click('[data-testid="partitur-bunyikan-not"]')
  await wait(350)
  const labelSaatJalan = await p.$eval('[data-testid="partitur-bunyikan-not"]', (el) => el.textContent?.trim() ?? '')
  cek('13b: saat aktif, label berubah menjadi "Hentikan not"', labelSaatJalan === 'Hentikan not', labelSaatJalan)

  // Pada 240 BPM (4/4 = 1,0 detik per birama), setelah ~1,25 detik indikator maju ke Bar 2+
  await wait(1150)
  const teksIndikator = await p.$eval('[data-testid="partitur-indikator-birama"]', (el) => el.textContent?.trim() ?? '')
  const sorotBirama = await p.$eval('[data-testid="partitur-sorot-aktif"]', (el) => Number(el.getAttribute('data-birama-aktif') || '0'))
  cek(
    '13b: indikator & sorot birama bergerak maju secara real-time mengikuti bunyi notasi',
    /Bar [234] · Ketuk \d/.test(teksIndikator) && sorotBirama >= 2,
    `${teksIndikator} (sorot=${sorotBirama})`,
  )

  await p.click('[data-testid="partitur-bunyikan-not"]')
  await wait(200)
  const labelSetelahHenti = await p.$eval('[data-testid="partitur-bunyikan-not"]', (el) => el.textContent?.trim() ?? '')
  cek('13b: klik kedua menghentikan pemutar kembali ke "Bunyikan not"', labelSetelahHenti === 'Bunyikan not', labelSetelahHenti)

  /* ====== 2. Akor Mayor/Minor & Temperamen Just vs 12-TET di Penala (#13c) == */
  console.log('\n== 2. Harmoni Akor & Temperamen Murni di Penala (#13c) ==')
  await p.waitForSelector('[data-testid="kartu-penala"]', { timeout: 10000 })
  await p.select('[data-testid="pilih-transposisi"]', 'bb')
  await p.click('[data-testid="preset-bb"]')
  await p.select('[data-testid="pilih-harmoni-dengung"]', 'mayor')
  await p.select('[data-testid="pilih-temperamen-dengung"]', 'murni')
  await wait(200)

  const teksPanduanMayor = await p.$eval('[data-testid="panduan-akor-dengung"]', (el) => el.textContent?.replace(/\s+/g, ' ').trim() ?? '')
  cek(
    '13c: panduan akor Bb Mayor Murni untuk instrumen Bb menampilkan C4 · E4 (-14 sen) · G4 (+2 sen)',
    teksPanduanMayor.includes('C4') &&
      teksPanduanMayor.includes('E4') &&
      teksPanduanMayor.includes('-14 sen') &&
      teksPanduanMayor.includes('G4') &&
      teksPanduanMayor.includes('+2 sen'),
    teksPanduanMayor,
  )

  await p.click('[data-testid="tombol-dengung"]')
  await wait(450)
  const dengungJalan = await p.$eval('[data-testid="tombol-dengung"]', (el) => el.textContent?.trim() ?? '')
  cek('13c: drone akor mayor murni menyala bersih ("Hentikan")', /Hentikan/.test(dengungJalan), dengungJalan)

  await p.select('[data-testid="pilih-temperamen-dengung"]', 'setara')
  await wait(250)
  const teksPanduanSetara = await p.$eval('[data-testid="panduan-akor-dengung"]', (el) => el.textContent?.replace(/\s+/g, ' ').trim() ?? '')
  cek(
    '13c: beralih ke 12-TET menghilangkan koreksi sen (-14/+2) untuk selaras instrumen pit',
    teksPanduanSetara.includes('C4') && teksPanduanSetara.includes('E4') && !teksPanduanSetara.includes('sen)'),
    teksPanduanSetara,
  )

  await p.click('[data-testid="tombol-dengung"]')
  await wait(200)

  // Uji responsif 390px pada kartu penala + layar partitur
  await p.setViewport({ width: 390, height: 844 })
  await wait(250)
  const meluap390 = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
  cek('13b+13c: tidak ada luapan horizontal pada lebar HP 390px', !meluap390)
  await p.setViewport({ width: 1280, height: 860 })

  /* ====== 3. Ekspor Paket Per-Suara & Audio ZIP di Berbagi (#13a) ========= */
  console.log('\n== 3. Ekspor Paket Per Anggota Tersaring Per-Suara + Audio ZIP (#13a) ==')
  await p.goto(BASE + '/#/berbagi', { waitUntil: 'networkidle2' })
  await p.waitForSelector('[data-testid="toggle-partitur-paket"]', { timeout: 10000 })
  const labelTogglePartitur = await p.$eval('[data-testid="toggle-partitur-paket"]', (el) => el.textContent?.trim() ?? '')
  cek('13a: saklar partitur paket tampil & mendeteksi "(1)" berkas siap', /\(1\)/.test(labelTogglePartitur), labelTogglePartitur)

  const adaToggleAudioZip = await p.$('[data-testid="toggle-rekaman-zip"]')
  cek('13a: saklar opsional rekaman panduan di ZIP tampil ("1 audio")', Boolean(adaToggleAudioZip))
  await p.click('[data-testid="toggle-rekaman-zip"]')
  await wait(150)

  // Bersihkan folder unduhan sebelum klik Unduh per anggota
  for (const f of fs.readdirSync(UNDUH)) fs.unlinkSync(path.join(UNDUH, f))
  await p.click('[data-testid="unduh-per-anggota"]')

  let berkasZip = null
  for (let i = 0; i < 30; i += 1) {
    const daftar = fs.readdirSync(UNDUH).filter((f) => f.endsWith('.zip') && !f.endsWith('.crdownload'))
    if (daftar.length > 0) {
      berkasZip = path.join(UNDUH, daftar[0])
      break
    }
    await wait(250)
  }
  cek('13a: ZIP paket per anggota berhasil diunduh', Boolean(berkasZip))

  const bitaZipUtuh = fs.readFileSync(berkasZip)
  const entriZip = bukaZip(new Uint8Array(bitaZipUtuh))
  const entriAndi = entriZip.find((e) => e.nama.includes('Andi'))
  const entriBudi = entriZip.find((e) => e.nama.includes('Budi'))
  const entriAudio = entriZip.filter((e) => e.nama.startsWith('audio/') && !e.nama.endsWith('.json'))
  const entriManifestAudio = entriZip.find((e) => e.nama === 'audio/manifest.json')

  cek('13a: ZIP memuat berkas Andi, berkas Budi, serta rekaman panduan di audio/', Boolean(entriAndi && entriBudi && entriAudio.length === 1 && entriManifestAudio))

  const jsonAndi = JSON.parse(entriAndi.teks())
  const jsonBudi = JSON.parse(entriBudi.teks())
  cek(
    '13a: berkas Andi hanya memuat part P2 (Trumpet 1) tanpa part Flute/Snare',
    JSON.stringify(jsonAndi.partiturPaket?.['lagu-gita']?.partTersaring) === '["P2"]' &&
      !jsonAndi.partiturPaket['lagu-gita'].xml.includes('<part id="P1">') &&
      jsonAndi.partiturPaket['lagu-gita'].xml.includes('<rehearsal>A</rehearsal>'),
  )
  cek(
    '13a: berkas Budi hanya memuat part P3 (Snare Drum)',
    JSON.stringify(jsonBudi.partiturPaket?.['lagu-gita']?.partTersaring) === '["P3"]' &&
      !jsonBudi.partiturPaket['lagu-gita'].xml.includes('<part id="P2">'),
  )

  // Bungkus ZIP personal untuk Andi saja (1 JSON + audio/) seperti saat dikirim pelatih ke Andi
  const bitaZipPersonalAndi = bikinZip([
    { nama: entriAndi.nama, isi: entriAndi.bita },
    { nama: entriAudio[0].nama, isi: entriAudio[0].bita },
    { nama: entriManifestAudio.nama, isi: entriManifestAudio.bita },
  ])
  const jalurZipAndi = path.join(BERKAS, 'Paket-Andi-Dengan-Audio.zip')
  fs.writeFileSync(jalurZipAndi, Buffer.from(bitaZipPersonalAndi))

  /* ====== 4. Konteks Peramban Segar Mode Anggota — Buka & Baca Luring! ==== */
  console.log('\n== 4. Mode Anggota: Impor Paket & Render Partitur Luring Langsung (#13a+13b) ==')
  const konteksAnggota = await browser.createBrowserContext()
  const pa = await konteksAnggota.newPage()
  pantau(pa)

  await pa.goto(BASE, { waitUntil: 'networkidle2' })
  await lewatSambutan(pa, 'member')
  await wait(500)

  // Mode anggota otomatis mendarat di `#/berbagi` (`#pkg-input`).
  // 4a. Uji pratinjau modal lewat seret-jatuhkan berkas (`lapisan-seret` / `File` drop) ke jendela,
  //     atau langsung buka lewat `#pkg-input`!
  const bitaZipBase64 = Buffer.from(bitaZipPersonalAndi).toString('base64')
  await pa.evaluate((b64) => {
    const bin = atob(b64)
    const arr = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
    const file = new File([arr], 'Paket-Andi-Dengan-Audio.zip', { type: 'application/zip' })
    const dt = new DataTransfer()
    dt.items.add(file)
    window.dispatchEvent(new DragEvent('dragenter', { bubbles: true, cancelable: true, dataTransfer: dt }))
    window.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }))
  }, bitaZipBase64)

  await pa.waitForSelector('[data-testid="buka-paket"]', { timeout: 10000 })
  const infoPartiturPratinjau = await pa.$eval(
    '[data-testid="buka-paket-partitur"]',
    (el) => el.textContent?.trim() ?? '',
  )
  cek(
    '13a: modal pratinjau paket anggota menyebut "1 partitur siap baca · 1 rekaman panduan"',
    infoPartiturPratinjau.includes('1 partitur siap baca') &&
      infoPartiturPratinjau.includes('1 rekaman panduan'),
    infoPartiturPratinjau,
  )
  await klik(pa, '[data-testid="buka-paket-buka"]')
  await wait(800)

  // Pindah ke tab Musik di Mode Anggota -> buka partitur langsung tanpa unggah .musicxml!
  await pa.evaluate(() => {
    const btns = [...document.querySelectorAll('button')]
    const btn = btns.find((b) => /^\s*Musik\s*$/i.test(b.textContent || ''))
    if (btn) btn.click()
  })
  await wait(600)

  await klik(pa, '[data-testid="pilih-lagu-lagu-gita"]')
  await klik(pa, '[data-testid="partitur-buka"]')
  await pa.waitForSelector('[data-testid="layar-partitur"]', { timeout: 10000 })
  await tungguRenderPartitur(pa)

  const infoPartiturAnggota = await pa.$eval('[data-testid="partitur-info-sesi"]', (el) => el.textContent?.trim() ?? '')
  const jmlSvgAnggota = await pa.$$eval('[data-testid="partitur-kanvas-svg"] svg', (els) => els.length)
  cek(
    '13a: Mode Anggota langsung merender SVG partitur Trumpet secara luring dari paket tanpa unggah .musicxml terpisah',
    jmlSvgAnggota > 0 && /4 birama/.test(infoPartiturAnggota),
    infoPartiturAnggota,
  )

  const adaBunyiNotAnggota = await pa.$('[data-testid="partitur-bunyikan-not"]')
  const adaRekamanTerpulihkan = await pa.evaluate(async () => {
    return await new Promise((resolve) => {
      const req = indexedDB.open('drillkit')
      req.onsuccess = () => {
        const db = req.result
        const tx = db.transaction('rekamanAudio', 'readonly')
        const g = tx.objectStore('rekamanAudio').get('lagu-gita')
        g.onsuccess = () => {
          db.close()
          resolve(Boolean(g.result && g.result.ukuran > 40))
        }
      }
    })
  })
  cek('13a+13b: tombol "Bunyikan not" & rekaman panduan WAV keduanya siap di HP anggota', Boolean(adaBunyiNotAnggota) && adaRekamanTerpulihkan)

  // Pastikan 0 oklch() / color-mix() di dalam layar-partitur
  const bebasOklch = await pa.evaluate(() => {
    const el = document.querySelector('[data-testid="layar-partitur"]')
    if (!el) return false
    const html = el.innerHTML
    return !/oklch\(|color-mix\(/i.test(html)
  })
  cek('13b: LayarPartitur tetap 100% murni hex/rgb (nol oklch / color-mix)', bebasOklch)

  cek('E2E: nol galat konsol/halaman selama seluruh alur #13', errors.length === 0, errors.join(' | '))
  cek('E2E: nol permintaan jaringan eksternal (100% luring)', permintaanLuar.length === 0, permintaanLuar.join(', '))

  await konteksAnggota.close()
} finally {
  await browser.close()
  fs.rmSync(TMP_ROOT, { recursive: true, force: true })
}

console.log(`\nRingkasan #13 Peramban: ${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length > 0) process.exit(1)
