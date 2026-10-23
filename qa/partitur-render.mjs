/**
 * #11b — Render Partitur di Layar (OSMD SVG, Lembar PDF, dan Dukungan .mxl)
 * (uji peramban ujung-ke-ujung, §7.2 & §10 `RANCANGAN-11b-PARTITUR-RENDER.md`).
 *
 * Logika murni pengurai `.mxl` sudah diuji di `mxl-logika.mjs` (42 asersi).
 * Rangkaian ini menguji sambungan visual, pemuatan malas (lazy-loading),
 * warna heksadesimal, kendali baca, serta anti-jalan-buntu di Chromium:
 *
 *   1. Lazy-load ketat & luring murni:
 *      - Di Dasbor (`#/`) maupun halaman Musik (`#/musik`) sebelum tombol
 *        `Buka partitur` ditekan, chunk `opensheetmusicdisplay` BELUM dimuat.
 *      - Sepanjang seluruh skenario tidak ada satu pun permintaan jaringan ke
 *        luar origin lokal (`0` font/CDN eksternal).
 *   2. Berkas `.mxl` terkompresi deflate ber-data-descriptor (bit 3):
 *      - Diseret ke jendela (pintu #7) → dikenali sebagai Partitur dengan
 *        judul, pengarang, birama, part, dan keterangan asal `.mxl`.
 *      - Dipasang di `PanelPartitur` → disimpan ke `partiturBerkas` sebagai
 *        MusicXML tak terkompresi (`tipe: 'musicxml'`) dan utuh lintas muat ulang.
 *   3. Render SVG Full Score (OSMD) & palet warna heksadesimal:
 *      - Klik `partitur-buka` → chunk OSMD dimuat, `<svg>` terender nyata
 *        dengan dimensi > 0, glif vektor `<path>`, judul skor, dan nama part.
 *      - Seluruh markup `layar-partitur` bebas dari `oklch(` dan `color-mix(`,
 *        serta kertas memakai latar `#ffffff` (`rgb(255, 255, 255)`) dan tinta
 *        `#0f172a` (`rgb(15, 23, 42)`).
 *      - Tombol `Unduh asli` mengunduh berkas `.musicxml` yang identik bit-per-bit.
 *   4. Kendali baca & ketahanan antarmuka:
 *      - Zoom `+` / `−` mengubah skala (`100%` → `130%` → `115%`) dan bertahan
 *        di `localStorage` sesudah `reload()`.
 *      - Tata letak berganti antara `Halaman` (vertikal) dan `Mendatar` (1 baris).
 *      - Mode `Layar penuh` mengunci gulir `body` dan keluar dengan tombol `Escape`.
 *      - Tetap bisa dioperasikan saat Kunci Kios (`html[data-kiosk="1"]`) aktif
 *        berkat `data-kiosk-allow`.
 *   5. Janji D4 (`#11a` → `#11b`) & XML rusak tanpa jalan buntu:
 *      - Skor `<score-timewise>` berentitas `&nbsp;` (yang ditandai `terurai: false`
 *        oleh pemindai kecil `#11a`) berhasil dinormalisasi & ditransposisi oleh
 *        `partiturRender.ts` sehingga tetap merender `<svg>` utuh di OSMD.
 *      - Skor berakar `<score-partwise>` tetapi tag dalamnya rusak menampilkan
 *        `partitur-render-galat` + tombol unduh berkas asli tanpa menjatuhkan
 *        halaman atau memicu `console.error`.
 *   6. Lembar PDF (`%PDF-`) tanpa membebani OSMD:
 *      - Dalam konteks peramban bersih yang langsung membuka partitur PDF,
 *        `partitur-pdf-bingkai` (`blob:` URL) beserta tombol `Buka tab baru` &
 *        `Unduh PDF` tampil lengkap sementara chunk `opensheetmusicdisplay`
 *        sama sekali TIDAK diunduh; melepas partitur otomatis menutup lembar baca.
 *
 * Pakai: bash qa/bangun-logika.sh && BASE=http://localhost:4173 node qa/partitur-render.mjs
 */
import puppeteer from 'puppeteer'
import fs from 'node:fs'
import path from 'node:path'
import { deflateRawSync } from 'node:zlib'
import { lewatSambutan } from './sambutan.mjs'
import { QA } from './lokasi.mjs'
import { crc32 } from '/tmp/zip.mjs'

const BASE = process.env.BASE || process.argv[2] || 'http://localhost:4173'
const ORIGIN_LOKAL = new URL(BASE).origin
const BERKAS = path.join(QA, 'berkas-partitur-render')
const UNDUH = path.join(QA, 'unduhan-partitur-render')
for (const d of [BERKAS, UNDUH]) {
  fs.rmSync(d, { recursive: true, force: true })
  fs.mkdirSync(d, { recursive: true })
}

let lulus = 0
const gagal = []
const cek = (nama, syarat, keterangan = '') => {
  if (syarat) {
    lulus += 1
  } else {
    const baris = `${nama}${keterangan ? ' — ' + keterangan : ''}`
    gagal.push(baris)
    console.log('  ✗ ' + baris)
  }
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const samaBita = (a, b) => a.length === b.length && a.every((v, i) => v === b[i])

/* ------------------------ Fixture buatan tangan -------------------------- */

function bangunPartNadawi(id, jumlahBirama, oktafDasar = 4) {
  const tangga = ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C']
  const birama = []
  for (let no = 1; no <= jumlahBirama; no += 1) {
    const sukat =
      no === 1
        ? '<divisions>1</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef>'
        : no === 9
          ? '<time><beats>3</beats><beat-type>4</beat-type></time>'
          : ''
    const arah =
      no === 1 && id === 'P1'
        ? '<direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>132</per-minute></metronome></direction-type><sound tempo="132"/></direction>'
        : ''
    const ketukan = no >= 9 ? 3 : 4
    const notasi = []
    for (let k = 0; k < ketukan; k += 1) {
      const step = tangga[(no + k) % tangga.length]
      const oktaf = step === 'C' && (no + k) % tangga.length === 7 ? oktafDasar + 1 : oktafDasar
      notasi.push(
        `<note><pitch><step>${step}</step><octave>${oktaf}</octave></pitch><duration>1</duration><type>quarter</type></note>`,
      )
    }
    birama.push(
      `<measure number="${no}">${sukat ? `<attributes>${sukat}</attributes>` : ''}${arah}${notasi.join('')}</measure>`,
    )
  }
  return `<part id="${id}">${birama.join('')}</part>`
}

function bangunPartPerkusi(id, jumlahBirama) {
  const birama = []
  for (let no = 1; no <= jumlahBirama; no += 1) {
    const sukat =
      no === 1
        ? '<divisions>1</divisions><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>percussion</sign></clef>'
        : no === 9
          ? '<time><beats>3</beats><beat-type>4</beat-type></time>'
          : ''
    const ketukan = no >= 9 ? 3 : 4
    const notasi = Array.from(
      { length: ketukan },
      () =>
        '<note><unpitched><display-step>C</display-step><display-octave>5</display-octave></unpitched><duration>1</duration><type>quarter</type></note>',
    ).join('')
    birama.push(
      `<measure number="${no}">${sukat ? `<attributes>${sukat}</attributes>` : ''}${notasi}</measure>`,
    )
  }
  return `<part id="${id}">${birama.join('')}</part>`
}

const teksSkorUtama =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<score-partwise version="3.1">\n' +
  '  <work><work-title>Mars Latihan Sore</work-title></work>\n' +
  '  <identification><creator type="composer">Budi Santoso</creator></identification>\n' +
  '  <part-list>\n' +
  '    <score-part id="P1"><part-name>Trumpet 1</part-name><part-abbreviation>Tpt. 1</part-abbreviation></score-part>\n' +
  '    <score-part id="P2"><part-name>Mellophone</part-name><part-abbreviation>Mello.</part-abbreviation></score-part>\n' +
  '    <score-part id="P3"><part-name>Snare Drum</part-name><part-abbreviation>S.D.</part-abbreviation></score-part>\n' +
  '  </part-list>\n' +
  `  ${bangunPartNadawi('P1', 12, 5)}\n` +
  `  ${bangunPartNadawi('P2', 12, 4)}\n` +
  `  ${bangunPartPerkusi('P3', 12)}\n` +
  '</score-partwise>\n'
const bitaSkorUtama = new TextEncoder().encode(teksSkorUtama)

/**
 * Rakit arsip `.mxl` deflate dengan general-purpose bit 3 (data descriptor):
 * ukuran & CRC di Local File Header sengaja dikosongkan (0), dan ukuran sahnya
 * hanya tertulis di Data Descriptor + Central Directory — persis keluaran
 * pengekspor ZIP streaming yang wajib ditangani `src/lib/mxl.ts` (keputusan D3).
 */
function bikinMxlStreamingDeflate(daftar) {
  const enc = new TextEncoder()
  const potongan = []
  const pusat = []
  let pos = 0
  for (const e of daftar) {
    const namaBita = enc.encode(e.nama)
    const mentah = typeof e.isi === 'string' ? enc.encode(e.isi) : e.isi
    const padat = new Uint8Array(deflateRawSync(mentah))
    const c = crc32(mentah)

    // Local File Header dengan bit 3 (0x0008) + bit 11 UTF-8 (0x0800) = 0x0808,
    // serta CRC/ukuran 0 di header lokal.
    const hLokal = new Uint8Array(30 + namaBita.length)
    const dvL = new DataView(hLokal.buffer)
    dvL.setUint32(0, 0x04034b50, true)
    dvL.setUint16(4, 20, true)
    dvL.setUint16(6, 0x0808, true)
    dvL.setUint16(8, 8, true)
    dvL.setUint32(14, 0, true)
    dvL.setUint32(18, 0, true)
    dvL.setUint32(22, 0, true)
    dvL.setUint16(26, namaBita.length, true)
    hLokal.set(namaBita, 30)

    const desc = new Uint8Array(16)
    const dvD = new DataView(desc.buffer)
    dvD.setUint32(0, 0x08074b50, true)
    dvD.setUint32(4, c, true)
    dvD.setUint32(8, padat.length, true)
    dvD.setUint32(12, mentah.length, true)

    const offsetLokal = pos
    potongan.push(hLokal, padat, desc)
    pos += hLokal.length + padat.length + desc.length

    const hPusat = new Uint8Array(46 + namaBita.length)
    const dvP = new DataView(hPusat.buffer)
    dvP.setUint32(0, 0x02014b50, true)
    dvP.setUint16(4, 20, true)
    dvP.setUint16(6, 20, true)
    dvP.setUint16(8, 0x0808, true)
    dvP.setUint16(10, 8, true)
    dvP.setUint32(16, c, true)
    dvP.setUint32(20, padat.length, true)
    dvP.setUint32(24, mentah.length, true)
    dvP.setUint16(28, namaBita.length, true)
    dvP.setUint32(42, offsetLokal, true)
    hPusat.set(namaBita, 46)
    pusat.push(hPusat)
  }

  const awalPusat = pos
  let ukuranPusat = 0
  for (const p of pusat) ukuranPusat += p.length
  const eocd = new Uint8Array(22)
  const dvE = new DataView(eocd.buffer)
  dvE.setUint32(0, 0x06054b50, true)
  dvE.setUint16(8, pusat.length, true)
  dvE.setUint16(10, pusat.length, true)
  dvE.setUint32(12, ukuranPusat, true)
  dvE.setUint32(16, awalPusat, true)

  const total = awalPusat + ukuranPusat + eocd.length
  const hasil = new Uint8Array(total)
  let kursor = 0
  for (const bag of [...potongan, ...pusat, eocd]) {
    hasil.set(bag, kursor)
    kursor += bag.length
  }
  return hasil
}

const bitaMxlUtama = bikinMxlStreamingDeflate([
  {
    nama: 'META-INF/container.xml',
    isi:
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<container><rootfiles>' +
      '<rootfile full-path="skor/mars-latihan.musicxml" media-type="application/vnd.recordare.musicxml+xml"/>' +
      '</rootfiles></container>',
  },
  { nama: 'skor/mars-latihan.musicxml', isi: bitaSkorUtama },
])
const fMxlUtama = path.join(BERKAS, 'mars-latihan.mxl')
fs.writeFileSync(fMxlUtama, bitaMxlUtama)

// Kasus D4: `<score-timewise>` + entitas HTML `&nbsp;` yang sengaja gagal
// diringkas pemindai kecil `#11a` (`terurai: false`), tetapi dinormalisasi
// & ditransposisi oleh `partiturRender.ts` sehingga tetap tampil utuh di OSMD.
const teksTimewiseD4 =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<score-timewise version="3.1">\n' +
  '  <movement-title>Pemanasan&nbsp;Timewise</movement-title>\n' +
  '  <part-list>\n' +
  '    <score-part id="P1"><part-name>Flute</part-name></score-part>\n' +
  '    <score-part id="P2"><part-name>Clarinet</part-name></score-part>\n' +
  '  </part-list>\n' +
  '  <measure number="1">\n' +
  '    <part id="P1"><attributes><divisions>1</divisions><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes><note><pitch><step>G</step><octave>5</octave></pitch><duration>4</duration><type>whole</type></note></part>\n' +
  '    <part id="P2"><attributes><divisions>1</divisions><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes><note><pitch><step>E</step><octave>5</octave></pitch><duration>4</duration><type>whole</type></note></part>\n' +
  '  </measure>\n' +
  '  <measure number="2">\n' +
  '    <part id="P1"><note><pitch><step>A</step><octave>5</octave></pitch><duration>4</duration><type>whole</type></note></part>\n' +
  '    <part id="P2"><note><pitch><step>F</step><octave>5</octave></pitch><duration>4</duration><type>whole</type></note></part>\n' +
  '  </measure>\n' +
  '</score-timewise>\n'
const fTimewiseD4 = path.join(BERKAS, 'pemanasan-timewise.musicxml')
fs.writeFileSync(fTimewiseD4, teksTimewiseD4)

// XML berakar `<score-partwise>` (diterima sebagai D4 oleh `#11a`) namun tag
// di dalamnya tidak tertutup sehingga DOMParser/OSMD menolaknya → harus
// menampilkan `partitur-render-galat` + tombol unduh berkas asli.
const teksXmlRusak =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<score-partwise version="3.1">\n' +
  '  <part-list><score-part id="P1"><part-name>Rusak</score-part></part-list>\n' +
  '</score-partwise>\n'
const bitaXmlRusak = new TextEncoder().encode(teksXmlRusak)
const fXmlRusak = path.join(BERKAS, 'potongan-rusak.musicxml')
fs.writeFileSync(fXmlRusak, bitaXmlRusak)

// PDF minimal sah untuk menguji penampil lembar PDF & ketiadaan muat OSMD.
const bitaPdf = new TextEncoder().encode(
  '%PDF-1.7\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 0/Kids[]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n',
)
const fPdf = path.join(BERKAS, 'lembar-lapangan.pdf')
fs.writeFileSync(fPdf, bitaPdf)

/* ------------------------- Alat bantu halaman ---------------------------- */

const ada = async (hal, sel) => (await hal.$(sel)) != null
const teks = (hal, sel) =>
  hal.$eval(sel, (e) => (e.textContent ?? '').replace(/\s+/g, ' ').trim())
const klik = async (hal, sel) => {
  await hal.waitForSelector(sel, { timeout: 12000 })
  await hal.click(sel)
}
const unggah = async (hal, sel, jalurBerkas) => {
  await hal.waitForSelector(sel, { timeout: 12000 })
  const input = await hal.$(sel)
  await input.uploadFile(jalurBerkas)
}
const ke = async (hal, rute) => {
  await hal.evaluate((r) => {
    location.hash = r
  }, rute)
  await wait(1400)
}

const adalahUrlLokalAtauInternalPeramban = (u) =>
  u.startsWith(ORIGIN_LOKAL) ||
  u.startsWith('blob:') ||
  u.startsWith('data:') ||
  u.startsWith('about:') ||
  u.startsWith('chrome:') ||
  u.startsWith('chrome-extension:') ||
  u.startsWith('devtools:')

const sudahMuatOsmd = (hal) =>
  hal.evaluate(() =>
    performance.getEntriesByType('resource').some((r) => /opensheetmusicdisplay/i.test(r.name)),
  )

const bacaTabel = (hal, namaTabel) =>
  hal.evaluate(
    (t) =>
      new Promise((selesai, tolak) => {
        const req = indexedDB.open('drillkit')
        req.onerror = () => tolak(String(req.error))
        req.onsuccess = () => {
          const db = req.result
          if (!db.objectStoreNames.contains(t)) {
            db.close()
            selesai([])
            return
          }
          const tx = db.transaction(t, 'readonly')
          const q = tx.objectStore(t).getAll()
          q.onsuccess = () => {
            db.close()
            selesai(q.result)
          }
          q.onerror = () => {
            db.close()
            tolak(String(q.error))
          }
        }
      }),
    namaTabel,
  )

const bacaPartiturBerkas = (hal, songId) =>
  hal.evaluate(async (id) => {
    const item = await new Promise((selesai, tolak) => {
      const req = indexedDB.open('drillkit')
      req.onerror = () => tolak(String(req.error))
      req.onsuccess = () => {
        const db = req.result
        const tx = db.transaction('partiturBerkas', 'readonly')
        const q = tx.objectStore('partiturBerkas').get(id)
        q.onsuccess = () => {
          db.close()
          selesai(q.result ?? null)
        }
        q.onerror = () => {
          db.close()
          tolak(String(q.error))
        }
      }
    })
    if (!item) return null
    const ab = await item.blob.arrayBuffer()
    return {
      songId: item.songId,
      namaFile: item.namaFile,
      tipe: item.tipe,
      ukuran: item.ukuran,
      hash: item.hash,
      bytes: Array.from(new Uint8Array(ab)),
    }
  }, songId)

const seretBerkasKeJendela = async (hal, namaBerkas, bitaBerkas, mime) => {
  await hal.evaluate(() => {
    const dt = new DataTransfer()
    dt.items.add(new File([new Uint8Array([1])], 'masuk.tmp'))
    window.dispatchEvent(
      new DragEvent('dragenter', { bubbles: true, cancelable: true, dataTransfer: dt }),
    )
  })
  await hal.waitForSelector('[data-testid="lapisan-seret"]', { timeout: 5000 })
  await hal.evaluate(
    ({ nama, arr, tipe }) => {
      const dt = new DataTransfer()
      dt.items.add(new File([new Uint8Array(arr)], nama, { type: tipe }))
      window.dispatchEvent(
        new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }),
      )
      window.dispatchEvent(
        new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }),
      )
    },
    { nama: namaBerkas, arr: Array.from(bitaBerkas), tipe: mime },
  )
  await hal.waitForSelector('[data-testid="modal-buka-berkas"]', { timeout: 10000 })
  await wait(400)
}

const kosongkanUnduh = () => {
  for (const f of fs.readdirSync(UNDUH)) {
    fs.rmSync(path.join(UNDUH, f), { recursive: true, force: true })
  }
}

const tungguUnduh = async (pola) => {
  for (let i = 0; i < 50; i += 1) {
    await wait(200)
    const daftar = fs.readdirSync(UNDUH).filter((f) => !f.endsWith('.crdownload'))
    const cocok = daftar.find((f) => pola.test(f))
    if (cocok) return path.join(UNDUH, cocok)
  }
  return null
}

/* =========================== Mulai peramban ============================== */

const browser = await puppeteer.launch({
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  defaultViewport: { width: 1360, height: 1000 },
  env: { ...process.env, LANG: process.env.LANG || 'C.utf8' },
})

let ctxPdf = null

try {
  const p = await browser.newPage()
  const errors = []
  const permintaanLuar = []

  p.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  p.on('pageerror', (e) => errors.push(String(e)))
  p.on('request', (req) => {
    const u = req.url()
    if (!adalahUrlLokalAtauInternalPeramban(u)) {
      permintaanLuar.push(u)
    }
  })

  const cdp = await p.createCDPSession()
  await cdp.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: UNDUH })

  /* --------------- 1. Verifikasi lazy-load di Dasbor & Musik ------------- */

  await p.goto(BASE, { waitUntil: 'networkidle2' })
  await lewatSambutan(p)
  await wait(1000)

  cek(
    'chunk OSMD belum dimuat saat Dasbor dibuka',
    (await sudahMuatOsmd(p)) === false,
  )

  await p.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) =>
      x.textContent.includes('Muat data contoh'),
    )
    if (b) b.click()
  })
  await wait(3000)

  const daftarLagu = await bacaTabel(p, 'songs')
  cek('data contoh memuat lagu awal', daftarLagu.length >= 1, String(daftarLagu.length))
  const laguUji = daftarLagu[0]

  /* ------ 2. Seret .mxl ber-data-descriptor ke pintu #7 & pasang --------- */

  await seretBerkasKeJendela(
    p,
    'mars-latihan.mxl',
    bitaMxlUtama,
    'application/vnd.recordare.musicxml',
  )
  cek(
    'pintu #7 mengenali .mxl streaming deflate (bit 3) sebagai Partitur',
    (await teks(p, '[data-testid="buka-jenis"]')) === 'Partitur (MusicXML / PDF) (#11a)',
  )
  const teksModalMxl = await teks(p, '[data-testid="modal-buka-berkas"]')
  cek(
    'pratinjau pintu #7 menampilkan judul, pengarang, birama, & part dari .mxl',
    teksModalMxl.includes('Mars Latihan Sore') &&
      teksModalMxl.includes('Budi Santoso') &&
      teksModalMxl.includes('12') &&
      teksModalMxl.includes('Trumpet 1'),
    teksModalMxl.slice(0, 200),
  )
  await klik(p, '[data-testid="buka-tutup"]')
  await wait(300)

  await ke(p, '#/musik')
  await klik(p, `[data-testid="pilih-lagu-${laguUji.id}"]`)
  await p.waitForSelector('[data-testid="panel-partitur"]', { timeout: 10000 })

  cek(
    'chunk OSMD masih belum dimuat di halaman Musik sebelum partitur dibuka',
    (await sudahMuatOsmd(p)) === false,
  )
  cek(
    'tombol Buka partitur belum tampil saat lagu belum punya partitur',
    !(await ada(p, '[data-testid="partitur-buka"]')),
  )

  await unggah(p, '#partitur-input', fMxlUtama)
  await p.waitForSelector('[data-testid="partitur-simpan"]', { timeout: 10000 })
  await klik(p, '[data-testid="partitur-simpan"]')
  await p.waitForSelector('[data-testid="partitur-buka"]', { timeout: 10000 })

  const binerMxlTersimpan = await bacaPartiturBerkas(p, laguUji.id)
  cek(
    '.mxl disimpan di IndexedDB sebagai XML tak terkompresi (tipe musicxml)',
    binerMxlTersimpan !== null &&
      binerMxlTersimpan.tipe === 'musicxml' &&
      binerMxlTersimpan.namaFile === 'mars-latihan.musicxml' &&
      samaBita(binerMxlTersimpan.bytes, bitaSkorUtama),
  )

  // Muat ulang penuh untuk membuktikan baik penyimpanan maupun lazy-load tetap terjaga.
  await p.reload({ waitUntil: 'networkidle2' })
  await wait(1200)
  await klik(p, `[data-testid="pilih-lagu-${laguUji.id}"]`)
  await p.waitForSelector('[data-testid="partitur-buka"]', { timeout: 10000 })
  cek(
    'sesudah reload, chunk OSMD tetap belum dimuat sebelum tombol Buka partitur diklik',
    (await sudahMuatOsmd(p)) === false,
  )

  /* --------- 3. Klik Buka partitur: render SVG & palet heksadesimal ------ */

  await klik(p, '[data-testid="partitur-buka"]')
  await p.waitForSelector('[data-testid="layar-partitur"]', { timeout: 10000 })
  await p.waitForFunction(
    () =>
      document.querySelectorAll('[data-testid="partitur-kanvas-svg"] svg').length > 0 &&
      !!document.querySelector('[data-testid="partitur-info-sesi"]'),
    { timeout: 20000 },
  )

  cek(
    'chunk OSMD dimuat secara lazy tepat setelah Buka partitur diklik',
    (await sudahMuatOsmd(p)) === true,
  )
  cek(
    'label tombol berubah menjadi Sembunyikan partitur saat lembar terbuka',
    /Sembunyikan partitur/.test(await teks(p, '[data-testid="partitur-buka"]')),
  )

  const rincianSvg = await p.evaluate(() => {
    const layar = document.querySelector('[data-testid="layar-partitur"]')
    const kertas = document.querySelector('[data-testid="partitur-kertas"]')
    const kanvas = document.querySelector('[data-testid="partitur-kanvas-svg"]')
    const svg = kanvas?.querySelector('svg')
    const kotak = svg?.getBoundingClientRect()
    const gayaKertas = kertas ? getComputedStyle(kertas) : null
    const gayaLayar = layar ? getComputedStyle(layar) : null
    const htmlLayar = layar?.outerHTML ?? ''
    const teksSvg = kanvas?.textContent ?? ''
    return {
      jumlahSvg: kanvas?.querySelectorAll('svg').length ?? 0,
      jumlahPath: kanvas?.querySelectorAll('svg path').length ?? 0,
      lebarSvg: kotak?.width ?? 0,
      tinggiSvg: kotak?.height ?? 0,
      infoSesi: document.querySelector('[data-testid="partitur-info-sesi"]')?.textContent?.trim() ?? '',
      adaOklchAtauColorMix: /oklch\(|color-mix\(/i.test(htmlLayar),
      latarKertas: gayaKertas?.backgroundColor ?? '',
      tintaKertas: gayaKertas?.color ?? '',
      latarLayar: gayaLayar?.backgroundColor ?? '',
      adaJudulSkor: teksSvg.includes('Mars Latihan Sore'),
      adaPartTrumpet: /Trumpet|Tpt/i.test(teksSvg),
      adaPartSnare: /Snare|S\.D\./i.test(teksSvg),
    }
  })

  cek(
    'info sesi melaporkan 12 birama · 3 part terender · Full score (halaman)',
    rincianSvg.infoSesi.includes('12 birama') &&
      rincianSvg.infoSesi.includes('3 part terender') &&
      rincianSvg.infoSesi.includes('(halaman)'),
    rincianSvg.infoSesi,
  )
  cek(
    'kanvas OSMD menghasilkan elemen <svg> nyata berdimensi > 200x100 px',
    rincianSvg.jumlahSvg >= 1 && rincianSvg.lebarSvg > 200 && rincianSvg.tinggiSvg > 100,
    `${rincianSvg.jumlahSvg} svg, ${Math.round(rincianSvg.lebarSvg)}x${Math.round(rincianSvg.tinggiSvg)}`,
  )
  cek(
    'SVG memuat puluhan path glif vektor VexFlow tanpa font eksternal',
    rincianSvg.jumlahPath >= 30,
    String(rincianSvg.jumlahPath),
  )
  cek(
    'SVG menampilkan judul skor dan label instrumen full score',
    rincianSvg.adaJudulSkor && rincianSvg.adaPartTrumpet && rincianSvg.adaPartSnare,
  )
  cek(
    'seluruh HTML LayarPartitur bebas dari oklch() dan color-mix()',
    rincianSvg.adaOklchAtauColorMix === false,
  )
  cek(
    'kertas partitur memakai latar putih #ffffff dan tinta gelap #0f172a',
    rincianSvg.latarKertas === 'rgb(255, 255, 255)' && rincianSvg.tintaKertas === 'rgb(15, 23, 42)',
    `${rincianSvg.latarKertas} / ${rincianSvg.tintaKertas}`,
  )

  kosongkanUnduh()
  await klik(p, '[data-testid="partitur-unduh-asli"]')
  const jalurUnduhXml = await tungguUnduh(/\.musicxml$/i)
  cek('tombol Unduh asli mengunduh berkas .musicxml', jalurUnduhXml !== null)
  if (jalurUnduhXml) {
    const bitaUnduh = new Uint8Array(fs.readFileSync(jalurUnduhXml))
    cek(
      'isi berkas .musicxml yang diunduh identik bit-per-bit dengan XML hasil urai .mxl',
      samaBita(bitaUnduh, bitaSkorUtama),
    )
  }

  /* ---- 4. Kendali baca: Zoom, Tata letak, Layar penuh, & Kunci Kios ----- */

  cek(
    'nilai zoom awal adalah 100%',
    (await teks(p, '[data-testid="partitur-zoom-nilai"]')) === '100%',
  )

  await klik(p, '[data-testid="partitur-zoom-tambah"]')
  await p.waitForFunction(
    () =>
      (document.querySelector('[data-testid="partitur-zoom-nilai"]')?.textContent ?? '').trim() ===
        '115%' && !!document.querySelector('[data-testid="partitur-info-sesi"]'),
    { timeout: 15000 },
  )
  await klik(p, '[data-testid="partitur-zoom-tambah"]')
  await p.waitForFunction(
    () =>
      (document.querySelector('[data-testid="partitur-zoom-nilai"]')?.textContent ?? '').trim() ===
        '130%' && !!document.querySelector('[data-testid="partitur-info-sesi"]'),
    { timeout: 15000 },
  )
  cek(
    'dua klik zoom + menaikkan skala ke 130%',
    (await teks(p, '[data-testid="partitur-zoom-nilai"]')) === '130%',
  )

  await klik(p, '[data-testid="partitur-zoom-kurang"]')
  await p.waitForFunction(
    () =>
      (document.querySelector('[data-testid="partitur-zoom-nilai"]')?.textContent ?? '').trim() ===
        '115%' && !!document.querySelector('[data-testid="partitur-info-sesi"]'),
    { timeout: 15000 },
  )
  const zoomTersimpan = await p.evaluate(() => localStorage.getItem('drillkit_partitur_zoom'))
  cek('zoom 115% tersimpan di localStorage', zoomTersimpan === '1.15', String(zoomTersimpan))

  // Ganti tata letak ke baris mendatar, lalu kembali ke halaman.
  await klik(p, '[data-testid="partitur-tata-letak"]')
  await p.waitForFunction(
    () =>
      document.querySelectorAll('[data-testid="partitur-kanvas-svg"] svg').length > 0 &&
      (document.querySelector('[data-testid="partitur-info-sesi"]')?.textContent ?? '').includes(
        '(mendatar)',
      ),
    { timeout: 20000 },
  )
  const lebarMendatar = await p.evaluate(
    () =>
      document.querySelector('[data-testid="partitur-kanvas-svg"] svg')?.getBoundingClientRect()
        .width ?? 0,
  )
  cek(
    'tata letak Mendatar merender ulang 12 birama memanjang dengan lebar > 800 px',
    /Tata letak: Mendatar/.test(await teks(p, '[data-testid="partitur-tata-letak"]')) &&
      lebarMendatar > 800,
    String(Math.round(lebarMendatar)),
  )

  await klik(p, '[data-testid="partitur-tata-letak"]')
  await p.waitForFunction(
    () =>
      (document.querySelector('[data-testid="partitur-info-sesi"]')?.textContent ?? '').includes(
        '(halaman)',
      ),
    { timeout: 20000 },
  )
  cek(
    'tata letak kembali ke Halaman sesudah diklik lagi',
    /Tata letak: Halaman/.test(await teks(p, '[data-testid="partitur-tata-letak"]')),
  )

  // Layar penuh + keluar dengan Escape.
  await klik(p, '[data-testid="partitur-layar-penuh"]')
  await wait(300)
  const statusLayarPenuh = await p.evaluate(() => {
    const el = document.querySelector('[data-testid="layar-partitur"]')
    return {
      posisi: el ? getComputedStyle(el).position : '',
      overflowBody: document.body.style.overflow,
    }
  })
  cek(
    'mode layar penuh memasang position: fixed dan mengunci gulir body',
    statusLayarPenuh.posisi === 'fixed' && statusLayarPenuh.overflowBody === 'hidden',
    `${statusLayarPenuh.posisi} / ${statusLayarPenuh.overflowBody}`,
  )

  await p.keyboard.press('Escape')
  await wait(300)
  const sesudahEscape = await p.evaluate(() => {
    const el = document.querySelector('[data-testid="layar-partitur"]')
    return {
      posisi: el ? getComputedStyle(el).position : '',
      overflowBody: document.body.style.overflow,
    }
  })
  cek(
    'tombol Escape menutup mode layar penuh dan memulihkan gulir body',
    sesudahEscape.posisi !== 'fixed' && sesudahEscape.overflowBody !== 'hidden',
  )

  // Kunci Kios (`html[data-kiosk="1"]`): pastikan tombol baca tidak dibekukan CSS.
  const pointerSaatKios = await p.evaluate(() => {
    document.documentElement.dataset.kiosk = '1'
    const zoomBtn = document.querySelector('[data-testid="partitur-zoom-tambah"]')
    const bukaBtn = document.querySelector('[data-testid="partitur-buka"]')
    const hasil = {
      zoomPointer: zoomBtn ? getComputedStyle(zoomBtn).pointerEvents : '',
      bukaPointer: bukaBtn ? getComputedStyle(bukaBtn).pointerEvents : '',
    }
    delete document.documentElement.dataset.kiosk
    return hasil
  })
  cek(
    'kendali baca partitur tetap interaktif (pointer-events: auto) saat Kunci Kios aktif',
    pointerSaatKios.zoomPointer === 'auto' && pointerSaatKios.bukaPointer === 'auto',
    `${pointerSaatKios.zoomPointer} / ${pointerSaatKios.bukaPointer}`,
  )

  // Muat ulang → buka lagi → pastikan preferensi zoom 115% dipulihkan.
  await p.reload({ waitUntil: 'networkidle2' })
  await wait(1200)
  await klik(p, `[data-testid="pilih-lagu-${laguUji.id}"]`)
  await klik(p, '[data-testid="partitur-buka"]')
  await p.waitForSelector('[data-testid="partitur-info-sesi"]', { timeout: 20000 })
  cek(
    'preferensi zoom 115% bertahan lintas reload halaman',
    (await teks(p, '[data-testid="partitur-zoom-nilai"]')) === '115%',
  )

  await klik(p, '[data-testid="partitur-tutup"]')
  await wait(250)
  cek(
    'tombol Tutup menyembunyikan LayarPartitur dengan bersih',
    !(await ada(p, '[data-testid="layar-partitur"]')),
  )

  /* ------- 5. Kasus D4 (<score-timewise> + &nbsp;) & XML rusak ----------- */

  // Ganti partitur dengan berkas D4 (`<score-timewise>` + `&nbsp;`).
  await unggah(p, '#partitur-input', fTimewiseD4)
  await p.waitForSelector('[data-testid="partitur-simpan"]', { timeout: 10000 })
  await klik(p, '[data-testid="partitur-simpan"]')
  await wait(600)

  const laguD4 = (await bacaTabel(p, 'songs')).find((s) => s.id === laguUji.id)
  cek(
    'berkas <score-timewise> berentitas &nbsp; ditandai terurai: false oleh pemindai #11a (D4)',
    laguD4?.partitur?.terurai === false && /&nbsp;/.test(laguD4?.partitur?.ringkasGagal ?? ''),
  )

  await klik(p, '[data-testid="partitur-buka"]')
  await p.waitForFunction(
    () =>
      document.querySelectorAll('[data-testid="partitur-kanvas-svg"] svg').length > 0 &&
      (document.querySelector('[data-testid="partitur-info-sesi"]')?.textContent ?? '').includes(
        '2 birama · 2 part terender',
      ),
    { timeout: 20000 },
  )
  const teksKanvasD4 = await teks(p, '[data-testid="partitur-kanvas-svg"]')
  cek(
    'janji D4 terpenuhi: berkas <score-timewise> + &nbsp; tetap berhasil dirender utuh oleh OSMD',
    teksKanvasD4.includes('Pemanasan') &&
      teksKanvasD4.includes('Flute') &&
      teksKanvasD4.includes('Clarinet'),
    teksKanvasD4.slice(0, 140),
  )

  // Ganti dengan XML berakar `<score-partwise>` tetapi tag dalamnya rusak (lembar terbuka).
  await unggah(p, '#partitur-input', fXmlRusak)
  await p.waitForSelector('[data-testid="partitur-simpan"]', { timeout: 10000 })
  await klik(p, '[data-testid="partitur-simpan"]')
  await p.waitForSelector('[data-testid="partitur-render-galat"]', { timeout: 15000 })

  const teksGalatXml = await teks(p, '[data-testid="partitur-render-galat"]')
  cek(
    'XML rusak menampilkan partitur-render-galat yang ramah tanpa menjatuhkan halaman',
    /rusak|belum bisa digambar/i.test(teksGalatXml) &&
      (await ada(p, '[data-testid="panel-partitur"]')),
    teksGalatXml.slice(0, 160),
  )
  cek(
    'saat render XML gagal, tombol Unduh asli tetap tersedia agar tidak jadi jalan buntu',
    await ada(p, '[data-testid="partitur-unduh-asli"]'),
  )

  /* ------ 6. Lembar PDF di konteks peramban bersih (tanpa muat OSMD) ----- */

  ctxPdf = await browser.createBrowserContext()
  const pPdf = await ctxPdf.newPage()
  const errorsPdf = []
  pPdf.on('console', (m) => {
    if (m.type() === 'error') errorsPdf.push(m.text())
  })
  pPdf.on('pageerror', (e) => errorsPdf.push(String(e)))
  pPdf.on('request', (req) => {
    const u = req.url()
    if (!adalahUrlLokalAtauInternalPeramban(u)) {
      permintaanLuar.push(u)
    }
  })

  await pPdf.goto(BASE, { waitUntil: 'networkidle2' })
  await lewatSambutan(pPdf)
  await wait(800)
  await pPdf.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) =>
      x.textContent.includes('Muat data contoh'),
    )
    if (b) b.click()
  })
  await wait(2800)

  const laguPdf = (await bacaTabel(pPdf, 'songs'))[0]
  await ke(pPdf, '#/musik')
  await klik(pPdf, `[data-testid="pilih-lagu-${laguPdf.id}"]`)
  await unggah(pPdf, '#partitur-input', fPdf)
  await pPdf.waitForSelector('[data-testid="partitur-simpan"]', { timeout: 10000 })
  await klik(pPdf, '[data-testid="partitur-simpan"]')
  await pPdf.waitForSelector('[data-testid="partitur-buka"]', { timeout: 10000 })

  await klik(pPdf, '[data-testid="partitur-buka"]')
  await pPdf.waitForSelector('[data-testid="partitur-pdf-bingkai"]', { timeout: 10000 })
  await wait(500)

  const rincianPdf = await pPdf.evaluate(() => {
    const iframe = document.querySelector('[data-testid="partitur-pdf-bingkai"]')
    const buka = document.querySelector('[data-testid="partitur-pdf-buka"]')
    const unduh = document.querySelector('[data-testid="partitur-pdf-unduh"]')
    const layar = document.querySelector('[data-testid="layar-partitur"]')
    return {
      srcIframe: iframe?.getAttribute('src') ?? '',
      hrefBuka: buka?.getAttribute('href') ?? '',
      targetBuka: buka?.getAttribute('target') ?? '',
      namaUnduh: unduh?.getAttribute('download') ?? '',
      adaZoom: !!document.querySelector('[data-testid="partitur-zoom-tambah"]'),
      adaOklch: /oklch\(|color-mix\(/i.test(layar?.outerHTML ?? ''),
    }
  })

  cek(
    'partitur PDF merender iframe dengan blob: URL yang sah',
    rincianPdf.srcIframe.startsWith('blob:'),
    rincianPdf.srcIframe,
  )
  cek(
    'partitur PDF menyediakan tombol Buka tab baru (target=_blank) & Unduh PDF eksplisit',
    rincianPdf.hrefBuka.startsWith('blob:') &&
      rincianPdf.targetBuka === '_blank' &&
      rincianPdf.namaUnduh === 'lembar-lapangan.pdf',
    `${rincianPdf.targetBuka} / ${rincianPdf.namaUnduh}`,
  )
  cek(
    'kendali zoom MusicXML tidak ditampilkan saat lembar bertipe PDF',
    rincianPdf.adaZoom === false && rincianPdf.adaOklch === false,
  )
  cek(
    'membuka partitur PDF sama sekali TIDAK memuat chunk opensheetmusicdisplay',
    (await sudahMuatOsmd(pPdf)) === false,
  )

  // Melepas partitur ketika lembar terbuka harus menutup LayarPartitur otomatis.
  await klik(pPdf, '[data-testid="partitur-hapus"]')
  await pPdf.waitForSelector('[data-testid="partitur-hapus-konfirmasi"]', { timeout: 5000 })
  await klik(pPdf, '[data-testid="partitur-hapus-konfirmasi"]')
  await wait(600)
  cek(
    'melepas partitur otomatis menutup LayarPartitur',
    !(await ada(pPdf, '[data-testid="layar-partitur"]')),
  )

  /* ------------------- 7. Jaringan luring & konsol bersih ---------------- */

  cek(
    'nol permintaan jaringan ke luar origin lokal sepanjang seluruh uji (100% offline)',
    permintaanLuar.length === 0,
    permintaanLuar.slice(0, 3).join(' | '),
  )
  cek(
    'tidak ada error konsol atau pageerror (konteks utama MusicXML/.mxl/D4)',
    errors.length === 0,
    errors.slice(0, 3).join(' | '),
  )
  cek(
    'tidak ada error konsol atau pageerror (konteks bersih PDF)',
    errorsPdf.length === 0,
    errorsPdf.slice(0, 3).join(' | '),
  )
} finally {
  if (ctxPdf) await ctxPdf.close().catch(() => {})
  await browser.close().catch(() => {})
  for (const d of [BERKAS, UNDUH]) {
    fs.rmSync(d, { recursive: true, force: true })
  }
}

console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) {
  console.log('GAGAL:\n - ' + gagal.join('\n - '))
  process.exit(1)
}
