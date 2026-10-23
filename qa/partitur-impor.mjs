/**
 * #11a — Partitur (MusicXML / PDF): alur layar, penyimpanan Blob, dan ZIP
 * (uji peramban, §9.2 & §12 `RANCANGAN-11a-PARTITUR-MUSICXML.md`).
 *
 * Logika murninya sudah diuji di `partitur-logika.mjs` (101 asersi) dan
 * `partitur-zip-logika.mjs` (9 asersi). Yang diuji di sini adalah sambungan
 * antarmuka dan penyimpanan peramban dari ujung ke ujung:
 *
 *   1. Seret `.musicxml` ke jendela aplikasi (pintu #7 `LapisanSeretBerkas`)
 *      → pratinjau menyebut *Partitur (MusicXML / PDF) (#11a)* beserta judul,
 *      pengarang, birama, part, perubahan sukat, tempo, dan tujuan `Musik →
 *      Partitur lagu`. Juga cek `.pdf`, penolakan `.mxl` (D1), dan izin di
 *      mode anggota (`aturMode`).
 *   2. Di halaman Musik (`PanelPartitur`): `.mxl` ditolak tanpa menulis (D1);
 *      XML yang gagal diringkas tetap dipasang dengan `terurai: false` dan
 *      pesan pemindainya tampil apa adanya (D4); mengganti partitur meminta
 *      konfirmasi yang menyebut berkas lama dan baru menulis sesudah ditekan
 *      Pasang; kuota > 50% memunculkan peringatan & `persist()` bisa diminta.
 *   3. Muat ulang halaman → Blob di IndexedDB (`partiturBerkas`) dan metadata
 *      `Song.partitur` tetap utuh.
 *   4. Ekspor repertoar & show hanya membawa metadata (tidak membengkak oleh
 *      isi XML).
 *   5. Unduh backup ZIP → di konteks peramban dengan DB bersih, pulihkan →
 *      partitur kembali utuh (`hash` SHA-256 & bita identik); melepas partitur
 *      mengosongkan metadata lalu menghapus Blob; lagu bermetadata tanpa Blob
 *      ditampilkan jujur sebagai "tercatat, berkasnya belum ada".
 *
 * Pakai: bash qa/bangun-logika.sh && BASE=http://localhost:4173 node qa/partitur-impor.mjs
 */
import puppeteer from 'puppeteer'
import fs from 'node:fs'
import path from 'node:path'
import { deflateRawSync } from 'node:zlib'
import { lewatSambutan } from './sambutan.mjs'
import { QA } from './lokasi.mjs'
import { bikinZip, bukaZip, crc32 } from '/tmp/zip.mjs'
import { hitungHashAudio } from '/tmp/rekaman.mjs'

const BASE = process.env.BASE || process.argv[2] || 'http://localhost:4173'
const BERKAS = path.join(QA, 'berkas-partitur')
const UNDUH = path.join(QA, 'unduhan-partitur')
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

const daftarPart = (baris) =>
  '<part-list>' +
  baris
    .map(
      ([id, nama, singkatan]) =>
        `<score-part id="${id}"><part-name>${nama}</part-name>` +
        (singkatan ? `<part-abbreviation>${singkatan}</part-abbreviation>` : '') +
        '</score-part>',
    )
    .join('') +
  '</part-list>'

const aturSukat = (beats, beatType) =>
  `<attributes><divisions>4</divisions><key><fifths>-2</fifths></key>` +
  `<time><beats>${beats}</beats><beat-type>${beatType}</beat-type></time></attributes>`

const tandaTempo = (bpm) =>
  `<direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit>` +
  `<per-minute>${bpm}</per-minute></metronome></direction-type><sound tempo="${bpm}"/></direction>`

// Setiap birama diisi rangkaian not penuh supaya ukuran MusicXML cukup besar
// (> 20 KB) — membuktikan secara terukur bahwa berkas show & repertoar tidak
// ikut membesar karena isi notasi (§12).
const isiNotEmpatKetuk = Array.from(
  { length: 16 },
  (_, k) =>
    `<note><pitch><step>${['C', 'D', 'E', 'F', 'G', 'A', 'B'][k % 7]}</step>` +
    `<octave>${4 + (k % 2)}</octave></pitch><duration>1</duration><type>16th</type></note>`,
).join('')

const bangunPart = (id, jumlahBirama) => {
  let out = `<part id="${id}">`
  for (let b = 1; b <= jumlahBirama; b += 1) {
    let kepala = ''
    if (b === 1) kepala = aturSukat(4, 4) + (id === 'P1' ? tandaTempo(132) : '')
    else if (b === 9) kepala = aturSukat(7, 8)
    else if (b === 13) kepala = aturSukat(4, 4)
    out += `<measure number="${b}">${kepala}${isiNotEmpatKetuk}</measure>`
  }
  return out + '</part>'
}

const PART_UJI = [
  ['P1', 'Trumpet 1', 'Tpt. 1'],
  ['P2', 'Snare Drum', 'Sn.'],
  ['P3', 'Marimba', 'Mba.'],
]

const teksMusicXml =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" ' +
  '"http://www.musicxml.org/dtds/partwise.dtd">\n' +
  '<score-partwise version="3.1">\n' +
  '  <movement-title>Gema Nusantara</movement-title>\n' +
  '  <identification>\n' +
  '    <creator type="composer">Budi Santoso</creator>\n' +
  '  </identification>\n' +
  '  ' +
  daftarPart(PART_UJI) +
  '\n' +
  PART_UJI.map(([id]) => bangunPart(id, 16)).join('\n') +
  '\n</score-partwise>\n'

const bitaXml = new TextEncoder().encode(teksMusicXml)
const hashXml = await hitungHashAudio(bitaXml)
const fMusicXml = path.join(BERKAS, 'pembuka-musescore.musicxml')
fs.writeFileSync(fMusicXml, bitaXml)

// Berkas XML yang sah akarnya (`<score-partwise>`) tetapi memakai entitas HTML
// `&nbsp;` yang sengaja ditolak pemindai kita → menguji keputusan D4.
const teksXmlD4 =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<score-partwise version="3.1">\n' +
  '  <movement-title>Latihan&nbsp;Pagi</movement-title>\n' +
  '  <part-list><score-part id="P1"><part-name>Trumpet</part-name></score-part></part-list>\n' +
  '  <part id="P1"><measure number="1"><note><rest/><duration>4</duration></note></measure></part>\n' +
  '</score-partwise>\n'
const bitaXmlD4 = new TextEncoder().encode(teksXmlD4)
const hashXmlD4 = await hitungHashAudio(bitaXmlD4)
const fXmlD4 = path.join(BERKAS, 'aneh-entitas.musicxml')
fs.writeFileSync(fXmlD4, bitaXmlD4)

// PDF minimal untuk menguji cabang `%PDF-`.
const bitaPdf = new TextEncoder().encode('%PDF-1.7\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n')
const fPdf = path.join(BERKAS, 'lembar-cadangan.pdf')
fs.writeFileSync(fPdf, bitaPdf)

// #11b — `.mxl` terkompresi deflate sungguhan (gaya MuseScore) kini diurai
// otomatis di pintu #7 dan PanelPartitur; ditambah satu `.mxl` rusak untuk
// memastikan penolakan pratinjau tetap tidak menulis apa pun ke IndexedDB.
function bikinMxlDeflate(daftar) {
  const enc = new TextEncoder()
  const potongan = []
  const pusat = []
  let pos = 0
  for (const e of daftar) {
    const namaBita = enc.encode(e.nama)
    const mentah = typeof e.isi === 'string' ? enc.encode(e.isi) : e.isi
    const padat = new Uint8Array(deflateRawSync(mentah))
    const c = crc32(mentah)
    const hLokal = new Uint8Array(30 + namaBita.length)
    const dvL = new DataView(hLokal.buffer)
    dvL.setUint32(0, 0x04034b50, true)
    dvL.setUint16(4, 20, true)
    dvL.setUint16(6, 0x0800, true)
    dvL.setUint16(8, 8, true)
    dvL.setUint32(14, c, true)
    dvL.setUint32(18, padat.length, true)
    dvL.setUint32(22, mentah.length, true)
    dvL.setUint16(26, namaBita.length, true)
    hLokal.set(namaBita, 30)
    const offsetLokal = pos
    potongan.push(hLokal, padat)
    pos += hLokal.length + padat.length

    const hPusat = new Uint8Array(46 + namaBita.length)
    const dvP = new DataView(hPusat.buffer)
    dvP.setUint32(0, 0x02014b50, true)
    dvP.setUint16(4, 20, true)
    dvP.setUint16(6, 20, true)
    dvP.setUint16(8, 0x0800, true)
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
  for (const p of pusat) {
    potongan.push(p)
    ukuranPusat += p.length
  }
  const eocd = new Uint8Array(22)
  const dvE = new DataView(eocd.buffer)
  dvE.setUint32(0, 0x06054b50, true)
  dvE.setUint16(8, daftar.length, true)
  dvE.setUint16(10, daftar.length, true)
  dvE.setUint32(12, ukuranPusat, true)
  dvE.setUint32(16, awalPusat, true)
  potongan.push(eocd)
  const out = new Uint8Array(pos + ukuranPusat + 22)
  let k = 0
  for (const pot of potongan) {
    out.set(pot, k)
    k += pot.length
  }
  return out
}

const bitaMxl = bikinMxlDeflate([
  {
    nama: 'META-INF/container.xml',
    isi:
      '<?xml version="1.0" encoding="UTF-8"?>' +
      '<container><rootfiles><rootfile full-path="score.xml"/></rootfiles></container>',
  },
  { nama: 'score.xml', isi: bitaXml },
])
const fMxl = path.join(BERKAS, 'terkompresi.mxl')
fs.writeFileSync(fMxl, bitaMxl)

const bitaMxlRusak = bikinZip([
  { nama: 'META-INF/container.xml', isi: '<container><rootfiles/></container>' },
])
const fMxlRusak = path.join(BERKAS, 'rusak.mxl')
fs.writeFileSync(fMxlRusak, bitaMxlRusak)

cek('fixture MusicXML cukup besar (> 20 KB) untuk uji ukuran paket', bitaXml.length > 20_000, String(bitaXml.length))

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
  await wait(1800)
}

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
    const db = await new Promise((selesai, tolak) => {
      const req = indexedDB.open('drillkit')
      req.onsuccess = () => selesai(req.result)
      req.onerror = () => tolak(String(req.error))
    })
    if (!db.objectStoreNames.contains('partiturBerkas')) {
      db.close()
      return null
    }
    const item = await new Promise((selesai, tolak) => {
      const tx = db.transaction('partiturBerkas', 'readonly')
      const q = tx.objectStore('partiturBerkas').get(id)
      q.onsuccess = () => selesai(q.result ?? null)
      q.onerror = () => tolak(String(q.error))
    })
    db.close()
    if (!item) return null
    const ab = await item.blob.arrayBuffer()
    return {
      id: item.id,
      songId: item.songId,
      namaFile: item.namaFile,
      tipe: item.tipe,
      ukuran: item.ukuran,
      hash: item.hash,
      bytes: Array.from(new Uint8Array(ab)),
    }
  }, songId)

/**
 * Simulasikan seret-lepas berkas dari penjelajah berkas ke jendela (`window`),
 * persis jalur `LapisanSeretBerkas` di `BukaBerkas.tsx`. Dipisah dua tahap
 * supaya React sempat me-render `lapisan-seret` di antara `dragenter` dan `drop`.
 */
const seretBerkasKeJendela = async (hal, namaBerkas, bitaBerkas, mime) => {
  await hal.evaluate(() => {
    const dt = new DataTransfer()
    dt.items.add(new File([new Uint8Array([1])], 'masuk.tmp'))
    window.dispatchEvent(new DragEvent('dragenter', { bubbles: true, cancelable: true, dataTransfer: dt }))
  })
  const lapisanMuncul = await hal
    .waitForSelector('[data-testid="lapisan-seret"]', { timeout: 5000 })
    .then(() => true)
    .catch(() => false)
  await hal.evaluate(
    ({ nama, arr, tipe }) => {
      const dt = new DataTransfer()
      dt.items.add(new File([new Uint8Array(arr)], nama, { type: tipe }))
      window.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }))
      window.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }))
    },
    { nama: namaBerkas, arr: Array.from(bitaBerkas), tipe: mime },
  )
  await hal.waitForSelector('[data-testid="modal-buka-berkas"]', { timeout: 10000 })
  await wait(400)
  return lapisanMuncul
}

const kosongkanUnduh = () => {
  for (const f of fs.readdirSync(UNDUH)) {
    fs.rmSync(path.join(UNDUH, f), { recursive: true, force: true })
  }
}

const tungguUnduh = async (pola) => {
  for (let i = 0; i < 60; i += 1) {
    await wait(250)
    const cocok = fs.readdirSync(UNDUH).filter((f) => !f.endsWith('.crdownload') && pola.test(f))
    if (cocok.length > 0) return path.join(UNDUH, cocok[0])
  }
  return null
}

/* =========================== Mulai peramban ============================== */

const browser = await puppeteer.launch({
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  defaultViewport: { width: 1360, height: 1000 },
  env: { ...process.env, LANG: process.env.LANG || 'C.utf8' },
})

const p = await browser.newPage()
const errors = []
p.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text())
})
p.on('pageerror', (e) => errors.push(String(e)))

const cdp = await p.createCDPSession()
await cdp.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: UNDUH })

await p.goto(BASE, { waitUntil: 'networkidle2' })
await lewatSambutan(p)
await wait(1200)
await p.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) =>
    x.textContent.includes('Muat data contoh'),
  )
  if (b) b.click()
})
await wait(3500)

const daftarLaguAwal = await bacaTabel(p, 'songs')
cek('data contoh memuat lagu awal', daftarLaguAwal.length >= 1, String(daftarLaguAwal.length))
const laguUji = daftarLaguAwal[0]

/* ----------------- 1. Seret .musicxml ke pintu #7 (§9.2) ----------------- */

const lapisanTampil = await seretBerkasKeJendela(
  p,
  'pembuka-musescore.musicxml',
  bitaXml,
  'application/vnd.recordare.musicxml+xml',
)
cek('seret berkas menampilkan lapisan-seret', lapisanTampil === true)
cek('lapisan-seret tertutup setelah berkas dilepas', !(await ada(p, '[data-testid="lapisan-seret"]')))
cek(
  'pintu #7 mengenali label Partitur (MusicXML / PDF) (#11a)',
  (await teks(p, '[data-testid="buka-jenis"]')) === 'Partitur (MusicXML / PDF) (#11a)',
  await teks(p, '[data-testid="buka-jenis"]'),
)
cek(
  'pintu #7 menampilkan nama berkas yang diseret',
  (await teks(p, '[data-testid="buka-nama"]')) === 'pembuka-musescore.musicxml',
)

const isiPratinjauPintu = await teks(p, '[data-testid="buka-partitur"]')
cek('pratinjau pintu #7 menyebut judul MusicXML', isiPratinjauPintu.includes('Gema Nusantara'), isiPratinjauPintu)
cek('pratinjau pintu #7 menyebut pengarang', isiPratinjauPintu.includes('Budi Santoso'), isiPratinjauPintu)
cek('pratinjau pintu #7 menyebut 16 birama', /Birama\s*16/.test(isiPratinjauPintu), isiPratinjauPintu)
cek(
  'pratinjau pintu #7 menyebut ketiga part',
  isiPratinjauPintu.includes('Trumpet 1, Snare Drum, Marimba'),
  isiPratinjauPintu,
)
cek(
  'pratinjau pintu #7 menyebut sukat campur (berubah 2×)',
  isiPratinjauPintu.includes('4/4 (berubah 2×)'),
  isiPratinjauPintu,
)
cek('pratinjau pintu #7 menyebut tempo 132 BPM', isiPratinjauPintu.includes('132 BPM'), isiPratinjauPintu)
cek(
  'pratinjau pintu #7 mengarahkan ke Musik → Partitur lagu',
  isiPratinjauPintu.includes('Musik → Partitur lagu'),
  isiPratinjauPintu,
)
await klik(p, '[data-testid="buka-tutup"]')
await wait(400)

// PDF di pintu #7: dikenali dari magic `%PDF-`, tanpa ringkasan palsu.
await unggah(p, '[data-testid="buka-berkas-dasbor-input"]', fPdf)
await p.waitForSelector('[data-testid="modal-buka-berkas"]', { timeout: 10000 })
await wait(400)
cek(
  'PDF dikenali pintu #7 sebagai Partitur',
  (await teks(p, '[data-testid="buka-jenis"]')) === 'Partitur (MusicXML / PDF) (#11a)',
)
cek(
  'pratinjau PDF menjelaskan tidak diringkas tetapi bisa disimpan',
  /Berkas PDF/.test(await teks(p, '[data-testid="buka-partitur-gagal"]')),
)
await klik(p, '[data-testid="buka-tutup"]')
await wait(400)

// #11b — `.mxl` deflate di pintu #7 dikenali sebagai Partitur & diringkas penuh.
await unggah(p, '[data-testid="buka-berkas-dasbor-input"]', fMxl)
await p.waitForSelector('[data-testid="modal-buka-berkas"]', { timeout: 10000 })
await wait(500)
const catatanMxlPintu = await teks(p, '[data-testid="modal-buka-berkas"]')
cek(
  'pintu #7 mengenali .mxl deflate sebagai Partitur beserta judulnya (#11b)',
  catatanMxlPintu.includes('Gema Nusantara') && catatanMxlPintu.includes('.mxl'),
  catatanMxlPintu.slice(0, 180),
)
await klik(p, '[data-testid="buka-tutup"]')
await wait(400)
cek('modal pintu #7 bisa ditutup sesudah pratinjau .mxl', !(await ada(p, '[data-testid="modal-buka-berkas"]')))

/* ------- 2. PanelPartitur di halaman Musik: .mxl, D4, pasang, ganti ------ */

await ke(p, '#/musik')
await klik(p, `[data-testid="pilih-lagu-${laguUji.id}"]`)
await p.waitForSelector('[data-testid="panel-partitur"]', { timeout: 10000 })
cek('panel partitur tampil saat lagu dipilih', await ada(p, '[data-testid="panel-partitur"]'))
cek(
  'keadaan awal lagu menyebut belum ada partitur',
  /Belum ada partitur/.test(await teks(p, '[data-testid="partitur-tak-ada"]')),
)

// `.mxl` rusak di PanelPartitur: berhenti di pratinjau tanpa menyentuh IndexedDB.
await unggah(p, '#partitur-input', fMxlRusak)
await p.waitForSelector('[data-testid="partitur-tolak"]', { timeout: 10000 })
const teksTolakPanel = await teks(p, '[data-testid="partitur-tolak"]')
cek(
  'PanelPartitur menolak .mxl rusak dengan alasan jelas',
  /rootfile/.test(teksTolakPanel),
  teksTolakPanel,
)
cek(
  'penolakan berkas rusak tidak menulis apa pun ke partiturBerkas',
  (await bacaTabel(p, 'partiturBerkas')).length === 0,
)

// #11b — `.mxl` deflate sah di PanelPartitur: diurai ke .musicxml di pratinjau, dan bisa dibatalkan.
await unggah(p, '#partitur-input', fMxl)
await p.waitForSelector('[data-testid="partitur-simpan"]', { timeout: 10000 })
const teksPanelSaatMxl = await teks(p, '[data-testid="panel-partitur"]')
cek(
  'PanelPartitur mengurai .mxl deflate ke pratinjau terkompresi.musicxml (#11b)',
  teksPanelSaatMxl.includes('terkompresi.mxl → terkompresi.musicxml') &&
    teksPanelSaatMxl.includes('Gema Nusantara'),
  teksPanelSaatMxl.slice(0, 220),
)
await klik(p, '[data-testid="partitur-batal"]')
await wait(300)

// D4 di PanelPartitur: XML yang menjegal pemindai tetap dipasang (`terurai: false`).
await unggah(p, '#partitur-input', fXmlD4)
await p.waitForSelector('[data-testid="partitur-simpan"]', { timeout: 10000 })
cek(
  'D4: belum masuk IndexedDB sebelum tombol Pasang ditekan',
  (await bacaTabel(p, 'partiturBerkas')).length === 0,
)
await klik(p, '[data-testid="partitur-simpan"]')
await wait(1200)

const laguSesudahD4 = (await bacaTabel(p, 'songs')).find((s) => s.id === laguUji.id)
const binerSesudahD4 = await bacaPartiturBerkas(p, laguUji.id)
cek(
  'D4: metadata mencatat terurai=false dan alasan pemindai',
  laguSesudahD4?.partitur?.terurai === false &&
    /entitas &nbsp; tidak dikenal/.test(laguSesudahD4?.partitur?.ringkasGagal ?? ''),
  JSON.stringify(laguSesudahD4?.partitur),
)
cek('D4: Blob tetap tersimpan utuh di IndexedDB', binerSesudahD4?.hash === hashXmlD4)
cek(
  'D4: pesan galat pemindai ditampilkan apa adanya di layar',
  /entitas &nbsp; tidak dikenal/.test(await teks(p, '[data-testid="partitur-ringkas"]')),
)

// Mengganti partitur di atas yang lama: tombol dua langkah menyebut nama lama (§8).
await klik(p, '[data-testid="partitur-ganti"]')
await p.waitForSelector('[data-testid="partitur-ganti-konfirmasi"]', { timeout: 5000 })
const teksKonfirmasiGanti = await teks(p, '[data-testid="partitur-ganti-konfirmasi"]')
cek(
  'konfirmasi ganti menyebut nama berkas lama',
  teksKonfirmasiGanti.includes('aneh-entitas.musicxml'),
  teksKonfirmasiGanti,
)

// Pilih MusicXML utama: pratinjau tampil lebih dulu, Blob lama belum tertimpa.
await unggah(p, '#partitur-input', fMusicXml)
await p.waitForSelector('[data-testid="partitur-simpan"]', { timeout: 10000 })
cek(
  'sebelum Pasang ditekan, Blob lama masih utuh di IndexedDB',
  (await bacaPartiturBerkas(p, laguUji.id))?.hash === hashXmlD4,
)

const teksRingkasPratinjau = await teks(p, '[data-testid="partitur-ringkas"]')
cek('ringkasan menampilkan judul & pengarang', teksRingkasPratinjau.includes('Gema Nusantara') && teksRingkasPratinjau.includes('Budi Santoso'))
cek(
  'ringkasan menampilkan perubahan sukat per birama (4/4@1, 7/8@9, 4/4@13)',
  teksRingkasPratinjau.includes('4/4@1, 7/8@9, 4/4@13'),
  teksRingkasPratinjau,
)
cek('ringkasan menampilkan tempo 132 BPM & susunan partwise', teksRingkasPratinjau.includes('132 BPM') && teksRingkasPratinjau.includes('partwise'))

const teksBadgePart = await teks(p, '[data-testid="partitur-part"]')
cek(
  'lencana part memuat singkatan dan nama instrumen',
  teksBadgePart.includes('Tpt. 1 — Trumpet 1') &&
    teksBadgePart.includes('Sn. — Snare Drum') &&
    teksBadgePart.includes('Mba. — Marimba'),
  teksBadgePart,
)

await klik(p, '[data-testid="partitur-simpan"]')
await wait(1200)

const semuaBarisBerkas = await bacaTabel(p, 'partiturBerkas')
const binerTerpasang = await bacaPartiturBerkas(p, laguUji.id)
const laguTerpasang = (await bacaTabel(p, 'songs')).find((s) => s.id === laguUji.id)
cek('mengganti partitur menimpa dalam satu baris per lagu', semuaBarisBerkas.length === 1, String(semuaBarisBerkas.length))
cek('hash SHA-256 Blob di IndexedDB cocok dengan berkas asli', binerTerpasang?.hash === hashXml, binerTerpasang?.hash)
cek('bita Blob di IndexedDB identik dengan berkas asli', binerTerpasang != null && samaBita(binerTerpasang.bytes, bitaXml))
cek(
  'Song.partitur menyimpan perubahanSukat tiga entri dengan nomor birama tepat',
  JSON.stringify(laguTerpasang?.partitur?.perubahanSukat) ===
    JSON.stringify([
      { birama: 1, beats: 4, beatType: 4 },
      { birama: 9, beats: 7, beatType: 8 },
      { birama: 13, beats: 4, beatType: 4 },
    ]),
  JSON.stringify(laguTerpasang?.partitur?.perubahanSukat),
)

/* ------------ 3. Muat ulang halaman + peringatan kuota (§12) ------------- */

// Pasang stub kuota > 50% sebelum muat ulang untuk menguji peringatan kuota
// dan tombol `Minta Persisten` sekaligus memastikan Blob selamat dari reload.
await p.evaluateOnNewDocument(() => {
  if (!navigator.storage) return
  let sudahPersisten = false
  navigator.storage.estimate = async () => ({
    usage: 640 * 1024 * 1024,
    quota: 1000 * 1024 * 1024,
  })
  navigator.storage.persisted = async () => sudahPersisten
  navigator.storage.persist = async () => {
    sudahPersisten = true
    return true
  }
})

await p.reload({ waitUntil: 'networkidle2' })
await wait(2200)
await ke(p, '#/musik')
await klik(p, `[data-testid="pilih-lagu-${laguUji.id}"]`)
await p.waitForSelector('[data-testid="partitur-ringkas"]', { timeout: 10000 })
await wait(600)

const binerSesudahReload = await bacaPartiturBerkas(p, laguUji.id)
cek(
  'Blob partitur di IndexedDB selamat setelah muat ulang (hash & bita sama)',
  binerSesudahReload?.hash === hashXml && samaBita(binerSesudahReload.bytes, bitaXml),
)
cek(
  'ringkasan partitur tetap tampil setelah muat ulang tanpa peringatan hilang',
  (await teks(p, '[data-testid="partitur-ringkas"]')).includes('Gema Nusantara') &&
    !(await ada(p, '[data-testid="partitur-tak-ada"]')),
)
cek(
  'peringatan kuota muncul saat penyimpanan > 50%',
  await ada(p, '[data-testid="partitur-kuota-ingat"]'),
)
cek('tombol Minta Persisten tersedia saat belum persisten', await ada(p, '[data-testid="partitur-persisten"]'))
await klik(p, '[data-testid="partitur-persisten"]')
await wait(800)
cek(
  'meminta persist() memperbarui status menjadi Persisten ✔',
  (await teks(p, '[data-testid="partitur-kuota"]')).includes('Persisten ✔'),
  await teks(p, '[data-testid="partitur-kuota"]'),
)

/* ---- 4. Repertoar & Show hanya membawa metadata, tidak membesar (§12) --- */

kosongkanUnduh()
await klik(p, '[data-testid="ekspor-repertoar"]')
await wait(600)
await klik(p, '[data-testid="unduh-repertoar"]')
const jalurRepertoarUnduhan = await tungguUnduh(/^DrillKit - LAGU /)
cek('berkas repertoar berhasil diunduh', jalurRepertoarUnduhan != null)
const fRepertoarSalinan = path.join(BERKAS, 'repertoar-ekspor.json')
if (jalurRepertoarUnduhan) fs.copyFileSync(jalurRepertoarUnduhan, fRepertoarSalinan)
const mentahRepertoar = jalurRepertoarUnduhan ? fs.readFileSync(fRepertoarSalinan, 'utf8') : ''
const jsonRepertoar = mentahRepertoar ? JSON.parse(mentahRepertoar) : null
const laguDiRepertoar = jsonRepertoar?.songs?.find((s) => s.id === laguUji.id)
cek(
  'berkas repertoar membawa metadata partitur (nama & hash)',
  laguDiRepertoar?.partitur?.namaFile === 'pembuka-musescore.musicxml' &&
    laguDiRepertoar?.partitur?.hash === hashXml,
)
cek(
  'berkas repertoar tidak memuat isi XML dan ukurannya jauh di bawah bita notasi',
  !mentahRepertoar.includes('<score-partwise') && Buffer.byteLength(mentahRepertoar, 'utf8') < bitaXml.length / 2,
  `${Buffer.byteLength(mentahRepertoar, 'utf8')} B vs XML ${bitaXml.length} B`,
)

await ke(p, '#/drill')
await klik(p, 'button[title="Pengaturan drill"]')
await p.waitForSelector('[data-testid="tombol-ekspor-show"]', { timeout: 10000 })
await p.$eval('[data-testid="tombol-ekspor-show"]', (b) => b.scrollIntoView({ block: 'center' }))
await wait(300)
kosongkanUnduh()
await klik(p, '[data-testid="tombol-ekspor-show"]')
const jalurShow = await tungguUnduh(/^DrillKit - SHOW /)
cek('berkas show berhasil diunduh', jalurShow != null)
const mentahShow = jalurShow ? fs.readFileSync(jalurShow, 'utf8') : ''
const jsonShow = mentahShow ? JSON.parse(mentahShow) : null
const laguDiShow = jsonShow?.songs?.find((s) => s.id === laguUji.id)
cek(
  'berkas show hanya membawa metadata partitur tanpa menyertakan notasi XML',
  laguDiShow?.partitur?.hash === hashXml && !mentahShow.includes('<score-partwise'),
)

/* --------- 5. Unduh ZIP → pulihkan di DB bersih → kembali utuh ----------- */

await ke(p, '#/pengaturan')
kosongkanUnduh()
await p.evaluate(() => {
  ;[...document.querySelectorAll('button')].find((b) => b.textContent.includes('Backup + rekaman (ZIP)'))?.click()
})
const jalurZipUnduhan = await tungguUnduh(/^DrillKit - BACKUP LENGKAP \+ REKAMAN - .*\.zip$/)
cek('backup lengkap ZIP berhasil diunduh', jalurZipUnduhan != null)
const fZipSalinan = path.join(BERKAS, 'backup-ekspor.zip')
if (jalurZipUnduhan) fs.copyFileSync(jalurZipUnduhan, fZipSalinan)

const bitaZipUnduhan = jalurZipUnduhan ? new Uint8Array(fs.readFileSync(fZipSalinan)) : new Uint8Array()
const entriZip = jalurZipUnduhan ? bukaZip(bitaZipUnduhan) : []
const namaEntriPartitur = `partitur/${laguUji.id}_pembuka-musescore.musicxml`
const entriPartiturZip = entriZip.find((e) => e.nama === namaEntriPartitur)
const entriManifestZip = entriZip.find((e) => e.nama === 'partitur/manifest.json')
cek(
  'ZIP memuat berkas partitur dan partitur/manifest.json',
  entriPartiturZip != null && entriManifestZip != null,
  entriZip.map((e) => e.nama).join(', '),
)
const isiManifestZip = entriManifestZip ? JSON.parse(entriManifestZip.teks()) : {}
cek(
  'manifest ZIP mencatat songId, tipe musicxml, ukuran, dan hash SHA-256 yang sama',
  isiManifestZip[namaEntriPartitur]?.songId === laguUji.id &&
    isiManifestZip[namaEntriPartitur]?.tipe === 'musicxml' &&
    isiManifestZip[namaEntriPartitur]?.ukuran === bitaXml.length &&
    isiManifestZip[namaEntriPartitur]?.hash === hashXml,
  JSON.stringify(isiManifestZip[namaEntriPartitur]),
)

// Konteks peramban baru = perangkat kedua dengan IndexedDB benar-benar bersih.
const ctxBersih = await browser.createBrowserContext()
const p2 = await ctxBersih.newPage()
const errorsBersih = []
p2.on('console', (m) => {
  if (m.type() === 'error') errorsBersih.push(m.text())
})
p2.on('pageerror', (e) => errorsBersih.push(String(e)))

await p2.goto(BASE, { waitUntil: 'networkidle2' })
await lewatSambutan(p2)
await wait(1200)

cek(
  'DB perangkat kedua benar-benar bersih sebelum pemulihan',
  (await bacaTabel(p2, 'songs')).length === 0 && (await bacaTabel(p2, 'partiturBerkas')).length === 0,
)

await ke(p2, '#/pengaturan')
await unggah(p2, '#restore-input', fZipSalinan)
await p2.waitForSelector('[data-testid="modal-pulih-backup"]', { timeout: 10000 })
await wait(800)

const teksPratinjauPulih = await teks(p2, '[data-testid="modal-pulih-backup"]')
cek(
  'pratinjau pemulihan menyebut 1 berkas partitur dari ZIP',
  teksPratinjauPulih.includes('1 berkas partitur') && teksPratinjauPulih.includes('Berkas partitur'),
  teksPratinjauPulih.slice(0, 200),
)
cek(
  'pratinjau pemulihan belum menulis ke DB bersih sebelum Lanjut ditekan',
  (await bacaTabel(p2, 'partiturBerkas')).length === 0,
)

await klik(p2, '[data-testid="pulih-backup-tombol"]')
await wait(2200)

const binerPulih = await bacaPartiturBerkas(p2, laguUji.id)
const laguPulih = (await bacaTabel(p2, 'songs')).find((s) => s.id === laguUji.id)
cek(
  'setelah pulih di DB bersih, hash partitur sama persis dengan aslinya',
  binerPulih?.hash === hashXml && laguPulih?.partitur?.hash === hashXml,
  `${binerPulih?.hash} vs ${hashXml}`,
)
cek(
  'setelah pulih di DB bersih, bita Blob partitur identik byte-per-byte',
  binerPulih != null && samaBita(binerPulih.bytes, bitaXml),
)

await ke(p2, '#/musik')
await klik(p2, `[data-testid="pilih-lagu-${laguUji.id}"]`)
await p2.waitForSelector('[data-testid="partitur-ringkas"]', { timeout: 10000 })
cek(
  'halaman Musik di perangkat kedua menampilkan ringkasan utuh tanpa peringatan hilang',
  (await teks(p2, '[data-testid="partitur-ringkas"]')).includes('Gema Nusantara') &&
    !(await ada(p2, '[data-testid="partitur-tak-ada"]')),
)

// Lepas partitur (§6 butir 4 & §8): metadata dikosongkan dan Blob dihapus.
await klik(p2, '[data-testid="partitur-hapus"]')
await p2.waitForSelector('[data-testid="partitur-hapus-konfirmasi"]', { timeout: 5000 })
await klik(p2, '[data-testid="partitur-hapus-konfirmasi"]')
await wait(1000)

const laguSesudahLepas = (await bacaTabel(p2, 'songs')).find((s) => s.id === laguUji.id)
cek(
  'melepas partitur mengosongkan Song.partitur dan menghapus Blob dari IndexedDB',
  laguSesudahLepas?.partitur == null && (await bacaPartiturBerkas(p2, laguUji.id)) === null,
)

// Impor repertoar JSON (hanya metadata, tanpa ZIP) → keadaan §3.2 tampil jujur.
if (jalurRepertoarUnduhan) {
  await ke(p2, '#/data')
  await unggah(p2, '[data-testid="buka-berkas-data-input"]', fRepertoarSalinan)
  await p2.waitForSelector('[data-testid="buka-repertoar-terapkan"]:not([disabled])', { timeout: 10000 })
  await klik(p2, '[data-testid="buka-repertoar-terapkan"]')
  await wait(1200)
  await ke(p2, '#/musik')
  await klik(p2, `[data-testid="pilih-lagu-${laguUji.id}"]`)
  await p2.waitForSelector('[data-testid="partitur-tak-ada"]', { timeout: 10000 })
  const teksTercatatTanpaBlob = await teks(p2, '[data-testid="partitur-tak-ada"]')
  cek(
    'metadata tanpa Blob ditampilkan sebagai tercatat tetapi berkasnya belum ada (§3.2)',
    teksTercatatTanpaBlob.includes('tercatat') &&
      teksTercatatTanpaBlob.includes('berkasnya belum ada di perangkat ini'),
    teksTercatatTanpaBlob,
  )
}

/* ----------- 6. Mode anggota mengizinkan partitur di pintu #7 ------------ */

const ctxAnggota = await browser.createBrowserContext()
const pAnggota = await ctxAnggota.newPage()
const errorsAnggota = []
pAnggota.on('console', (m) => {
  if (m.type() === 'error') errorsAnggota.push(m.text())
})
pAnggota.on('pageerror', (e) => errorsAnggota.push(String(e)))

await pAnggota.goto(BASE, { waitUntil: 'networkidle2' })
await lewatSambutan(pAnggota, 'member')
await wait(1000)
await seretBerkasKeJendela(
  pAnggota,
  'pembuka-musescore.musicxml',
  bitaXml,
  'application/vnd.recordare.musicxml+xml',
)
cek(
  'mode anggota mengizinkan partitur di pintu #7 (bukan buka-tolak)',
  (await ada(pAnggota, '[data-testid="buka-partitur"]')) &&
    !(await ada(pAnggota, '[data-testid="buka-tolak"]')),
)

/* ---------------------------- 7. Konsol bersih --------------------------- */

cek('tidak ada error konsol (pelatih)', errors.length === 0, errors.slice(0, 3).join(' | '))
cek('tidak ada error konsol (DB bersih)', errorsBersih.length === 0, errorsBersih.slice(0, 3).join(' | '))
cek('tidak ada error konsol (anggota)', errorsAnggota.length === 0, errorsAnggota.slice(0, 3).join(' | '))

await ctxAnggota.close()
await ctxBersih.close()
await browser.close()
for (const d of [BERKAS, UNDUH]) {
  fs.rmSync(d, { recursive: true, force: true })
}

console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) {
  console.log('GAGAL:\n - ' + gagal.join('\n - '))
  process.exit(1)
}
