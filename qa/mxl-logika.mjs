/**
 * #11b — Pengurai arsip `.mxl` (MusicXML terkompresi): uji logika murni.
 *
 * Seluruh berkas ini berjalan langsung di Node tanpa peramban (menggunakan
 * `DecompressionStream('deflate-raw')` bawaan Node ≥ 18, identik dengan API
 * Web di peramban modern).
 *
 * Yang diuji:
 *   1. `apakahMxl` & `namaMusicXmlDariMxl`.
 *   2. `.mxl` terkompresi *deflate* (metode 8) multi-part > 30 KB → bita XML
 *      identik byte-per-byte & lulus `putusanPartitur`.
 *   3. `.mxl` dengan *streaming data descriptor* (`bendera = 0x0808`,
 *      `compSize = 0` & `crc = 0` di tajuk lokal + ekstra lokal ≠ ekstra pusat)
 *      → tetap terurai utuh lewat *Central Directory*.
 *   4. `.mxl` metode 0 (*stored*), `score-timewise`, UTF-16 LE BOM, jalur
 *      bersubfolder dengan entitas XML `&amp;`, pencocokan huruf besar/kecil,
 *      serta komentar di ekor EOCD.
 *   5. `META-INF/container.xml` multi-`rootfile` (melewati `.png` & `.pdf`,
 *      memilih berkas MusicXML).
 *   6. Ketahanan terhadap berkas rusak & jahat: kosong, bukan ZIP, EOCD
 *      terpotong, tanpa `container.xml`, `rootfile` hilang, *deflate* cacat,
 *      CRC-32 meleset, metode tak didukung (bzip2 #12), bendera enkripsi, isi
 *      bukan MusicXML, serta bom ZIP > 8 MB (baik jujur di tajuk maupun ukuran
 *      tajuk dipalsukan kecil) — tanpa satu pun `unhandledRejection`.
 *   7. Cadangan peramban lama saat `globalThis.DecompressionStream` tidak ada.
 *
 * Pakai: bash qa/bangun-logika.sh && node qa/mxl-logika.mjs
 */
import { deflateRawSync } from 'node:zlib'
import { bikinZip, crc32 } from '/tmp/zip.mjs'
import { BATAS_BITA, putusanPartitur } from '/tmp/partitur.mjs'
import {
  PESAN_MXL_PERAMBAN_LAMA,
  apakahMxl,
  namaMusicXmlDariMxl,
  uraiMxl,
} from '/tmp/mxl.mjs'

let lulus = 0
const gagal = []
let tolakTakTertangani = 0

process.on('unhandledRejection', (alasan) => {
  tolakTakTertangani += 1
  gagal.push(`unhandledRejection terdeteksi: ${String(alasan)}`)
})

const cek = (nama, syarat, keterangan = '') => {
  if (syarat) {
    lulus += 1
  } else {
    const baris = `${nama}${keterangan ? ' — ' + keterangan : ''}`
    gagal.push(baris)
    console.log('  ✗ ' + baris)
  }
}

const keBita = (teks) => new TextEncoder().encode(teks)
const samaBita = (a, b) => a.length === b.length && a.every((v, i) => v === b[i])

/* -------------------- Perakit ZIP Uji Serbaguna ------------------------- */

/**
 * Rakit arsip ZIP khusus pengujian yang mendukung:
 * - metode 0 (stored) atau 8 (deflate-raw) atau metode arbitrer,
 * - streaming data descriptor (`streaming: true` → bit 3 `0x0008`, `crc` &
 *   `compSize` di tajuk lokal sengaja ditulis 0 + descriptor 16 bita sesudah
 *   data),
 * - kolom ekstra lokal ≠ kolom ekstra direktori pusat (seperti Info-ZIP/macOS),
 * - pemalsuan `ukuranAsliTajuk` atau `crcTajuk` atau `bendera` untuk uji rusak,
 * - komentar ZIP di ekor EOCD.
 */
function rakitZipUji(daftarEntri, { komentarZip = '' } = {}) {
  const potongan = []
  const rekamanPusat = []
  let offset = 0

  for (const item of daftarEntri) {
    const namaBita = keBita(item.nama)
    const mentah = typeof item.isi === 'string' ? keBita(item.isi) : item.isi
    const metode = item.metode ?? 8
    const padat =
       item.bitaPadatMentah ??
      (metode === 8 ? new Uint8Array(deflateRawSync(mentah)) : new Uint8Array(mentah))

    const crcAsli = crc32(mentah)
    const crc = item.crcPalsu ?? crcAsli
    const ukuranPadat = item.ukuranPadatPalsu ?? padat.length
    const ukuranAsli = item.ukuranAsliPalsu ?? mentah.length
    const streaming = Boolean(item.streaming)
    const bendera = item.bendera ?? (0x0800 | (streaming ? 0x0008 : 0))
    const ekstraLokal = item.ekstraLokal ?? new Uint8Array(0)
    const ekstraPusat = item.ekstraPusat ?? new Uint8Array(0)

    const offsetLokal = offset
    const headerLokal = new Uint8Array(30 + namaBita.length + ekstraLokal.length)
    const dvLokal = new DataView(headerLokal.buffer)
    dvLokal.setUint32(0, 0x04034b50, true)
    dvLokal.setUint16(4, 20, true)
    dvLokal.setUint16(6, bendera, true)
    dvLokal.setUint16(8, metode, true)
    dvLokal.setUint16(10, 0, true)
    dvLokal.setUint16(12, 0x21, true)
    // Bila streaming bit 3 aktif, tajuk lokal menulis 0 pada crc & ukuran!
    dvLokal.setUint32(14, streaming ? 0 : crc, true)
    dvLokal.setUint32(18, streaming ? 0 : ukuranPadat, true)
    dvLokal.setUint32(22, streaming ? 0 : ukuranAsli, true)
    dvLokal.setUint16(26, namaBita.length, true)
    dvLokal.setUint16(28, ekstraLokal.length, true)
    headerLokal.set(namaBita, 30)
    headerLokal.set(ekstraLokal, 30 + namaBita.length)

    potongan.push(headerLokal, padat)
    offset += headerLokal.length + padat.length

    if (streaming) {
      const desc = new Uint8Array(16)
      const dvDesc = new DataView(desc.buffer)
      dvDesc.setUint32(0, 0x08074b50, true)
      dvDesc.setUint32(4, crc, true)
      dvDesc.setUint32(8, ukuranPadat, true)
      dvDesc.setUint32(12, ukuranAsli, true)
      potongan.push(desc)
      offset += desc.length
    }

    const headerPusat = new Uint8Array(46 + namaBita.length + ekstraPusat.length)
    const dvPusat = new DataView(headerPusat.buffer)
    dvPusat.setUint32(0, 0x02014b50, true)
    dvPusat.setUint16(4, 20, true)
    dvPusat.setUint16(6, 20, true)
    dvPusat.setUint16(8, bendera, true)
    dvPusat.setUint16(10, metode, true)
    dvPusat.setUint16(12, 0, true)
    dvPusat.setUint16(14, 0x21, true)
    dvPusat.setUint32(16, crc, true)
    dvPusat.setUint32(20, ukuranPadat, true)
    dvPusat.setUint32(24, ukuranAsli, true)
    dvPusat.setUint16(28, namaBita.length, true)
    dvPusat.setUint16(30, ekstraPusat.length, true)
    dvPusat.setUint16(32, 0, true)
    dvPusat.setUint16(34, 0, true)
    dvPusat.setUint16(36, 0, true)
    dvPusat.setUint32(38, 0, true)
    dvPusat.setUint32(42, offsetLokal, true)
    headerPusat.set(namaBita, 46)
    headerPusat.set(ekstraPusat, 46 + namaBita.length)

    rekamanPusat.push(headerPusat)
  }

  const offsetPusat = offset
  let ukuranPusat = 0
  for (const r of rekamanPusat) {
    potongan.push(r)
    ukuranPusat += r.length
  }
  offset += ukuranPusat

  const bitaKomentar = keBita(komentarZip)
  const eocd = new Uint8Array(22 + bitaKomentar.length)
  const dvEocd = new DataView(eocd.buffer)
  dvEocd.setUint32(0, 0x06054b50, true)
  dvEocd.setUint16(4, 0, true)
  dvEocd.setUint16(6, 0, true)
  dvEocd.setUint16(8, daftarEntri.length, true)
  dvEocd.setUint16(10, daftarEntri.length, true)
  dvEocd.setUint32(12, ukuranPusat, true)
  dvEocd.setUint32(16, offsetPusat, true)
  dvEocd.setUint16(20, bitaKomentar.length, true)
  eocd.set(bitaKomentar, 22)
  potongan.push(eocd)
  offset += eocd.length

  const utuh = new Uint8Array(offset)
  let pos = 0
  for (const p of potongan) {
    utuh.set(p, pos)
    pos += p.length
  }
  return utuh
}

/* --------------------------- Fixture MusicXML ---------------------------- */

const containerStandar = (jalur = 'score.xml', mediaType = 'application/vnd.recordare.musicxml+xml') =>
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<container>\n' +
  '  <rootfiles>\n' +
  `    <rootfile full-path="${jalur}"${mediaType ? ` media-type="${mediaType}"` : ''}/>\n` +
  '  </rootfiles>\n' +
  '</container>\n'

const barisanNot = Array.from(
  { length: 16 },
  (_, k) =>
    `<note><pitch><step>${['C', 'D', 'E', 'F', 'G', 'A', 'B'][k % 7]}</step>` +
    `<octave>${4 + (k % 2)}</octave></pitch><duration>1</duration><type>16th</type></note>`,
).join('')

function buatSkorPartwise(biramaTotal = 20) {
  const daftarPart =
    '<part-list>' +
    '<score-part id="P1"><part-name>Trumpet 1</part-name><part-abbreviation>Tpt. 1</part-abbreviation></score-part>' +
    '<score-part id="P2"><part-name>Snare Drum</part-name><part-abbreviation>Sn.</part-abbreviation></score-part>' +
    '<score-part id="P3"><part-name>Marimba</part-name><part-abbreviation>Mba.</part-abbreviation></score-part>' +
    '</part-list>'

  const bangunPart = (id) => {
    let s = `<part id="${id}">`
    for (let b = 1; b <= biramaTotal; b += 1) {
      let attr = ''
      if (b === 1) {
        attr =
          '<attributes><divisions>4</divisions><time><beats>4</beats><beat-type>4</beat-type></time></attributes>' +
          (id === 'P1' ? '<direction><sound tempo="136"/></direction>' : '')
      } else if (b === 9) {
        attr = '<attributes><time><beats>7</beats><beat-type>8</beat-type></time></attributes>'
      } else if (b === 13) {
        attr = '<attributes><time><beats>4</beats><beat-type>4</beat-type></time></attributes>'
      }
      s += `<measure number="${b}">${attr}${barisanNot}</measure>`
    }
    return s + '</part>'
  }

  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">\n' +
    '<score-partwise version="4.0">\n' +
    '  <work><work-title>Mars Fajar</work-title></work>\n' +
    '  <identification><creator type="composer">Sari Dewi</creator></identification>\n' +
    `  ${daftarPart}\n` +
    `  ${['P1', 'P2', 'P3'].map(bangunPart).join('\n  ')}\n` +
    '</score-partwise>\n'
  )
}

const xmlUtamaTeks = buatSkorPartwise(20)
const xmlUtamaBita = keBita(xmlUtamaTeks)
cek('0.1: fixture MusicXML > 30 KB untuk menguji aliran multi-potongan', xmlUtamaBita.length > 30_000, String(xmlUtamaBita.length))

/* ================ 1. apakahMxl & namaMusicXmlDariMxl ==================== */
{
  const mxlDeflate = rakitZipUji([
    { nama: 'META-INF/container.xml', isi: containerStandar(), metode: 8 },
    { nama: 'score.xml', isi: xmlUtamaBita, metode: 8 },
  ])
  const mxlBackslash = rakitZipUji([
    { nama: 'META-INF\\container.xml', isi: containerStandar(), metode: 0 },
    { nama: 'score.xml', isi: xmlUtamaBita, metode: 0 },
  ])
  const zipBiasa = bikinZip([{ nama: 'backup.json', isi: '{"format":"drillkit-backup"}' }])

  cek('1.1: apakahMxl true untuk .mxl deflate', apakahMxl(mxlDeflate) === true)
  cek('1.2: apakahMxl true untuk pemisah garis miring terbalik Windows', apakahMxl(mxlBackslash) === true)
  cek('1.3: apakahMxl false untuk ZIP backup biasa tanpa container.xml', apakahMxl(zipBiasa) === false)
  cek('1.4: apakahMxl false untuk XML mentah, PDF, dan kosong', !apakahMxl(xmlUtamaBita) && !apakahMxl(keBita('%PDF-1.7')) && !apakahMxl(new Uint8Array(0)))

  cek('1.5: namaMusicXmlDariMxl mengubah .mxl huruf kecil', namaMusicXmlDariMxl('pembuka.mxl') === 'pembuka.musicxml')
  cek('1.6: namaMusicXmlDariMxl mengubah .MXL huruf besar', namaMusicXmlDariMxl('MARS TIM.MXL') === 'MARS TIM.musicxml')
  cek('1.7: namaMusicXmlDariMxl mempertahankan .musicxml dan .xml', namaMusicXmlDariMxl('a.musicxml') === 'a.musicxml' && namaMusicXmlDariMxl('b.xml') === 'b.xml')
  cek('1.8: namaMusicXmlDariMxl memberi akhiran pada nama tanpa ekstensi & kosong', namaMusicXmlDariMxl('skor-baru') === 'skor-baru.musicxml' && namaMusicXmlDariMxl('   ') === 'partitur.musicxml')
}

/* ============ 2. .mxl Deflate Standar (Gaya MuseScore 3/4) ============== */
{
  const mxl = rakitZipUji([
    { nama: 'META-INF/container.xml', isi: containerStandar('lg-mars.xml'), metode: 8 },
    { nama: 'lg-mars.xml', isi: xmlUtamaBita, metode: 8 },
  ])
  cek('2.1: ukuran .mxl deflate jauh lebih kecil daripada XML aslinya', mxl.length < xmlUtamaBita.length / 4, `${mxl.length} vs ${xmlUtamaBita.length}`)

  const hasil = await uraiMxl(mxl)
  cek('2.2: uraiMxl berhasil pada .mxl deflate', hasil.ok === true, hasil.ok ? '' : hasil.alasan)
  if (hasil.ok) {
    cek('2.3: jalurUtama tercatat persis', hasil.jalurUtama === 'lg-mars.xml', hasil.jalurUtama)
    cek('2.4: bita hasil ekstraksi identik byte-per-byte dengan XML asli', samaBita(hasil.bitaXml, xmlUtamaBita))

    const putusan = putusanPartitur(hasil.bitaXml)
    cek('2.5: hasil ekstraksi lulus putusanPartitur dengan judul & pengarang tepat', putusan.boleh && putusan.ringkas?.judul === 'Mars Fajar' && putusan.ringkas?.pengarang === 'Sari Dewi')
    cek('2.6: jumlahBirama 20, 3 part, tempo 136, dan 3 entri perubahanSukat', putusan.ringkas?.jumlahBirama === 20 && putusan.ringkas?.jumlahPart === 3 && putusan.ringkas?.tempo === 136 && putusan.ringkas?.perubahanSukat.length === 3)
  }
}

/* ====== 3. Streaming Data Descriptor (flag 0x0808 + ekstra beda) ======== */
{
  // Kasus nyata Java/Qt/macOS: entri pertama memakai bit 3 (compSize=0 di lokal),
  // ekstra lokal 9 bita sedangkan ekstra pusat 5 bita, dan container.xml ditaruh
  // sebagai entri kedua!
  const mxlStreaming = rakitZipUji([
    {
      nama: 'scores/utama.musicxml',
      isi: xmlUtamaBita,
      metode: 8,
      streaming: true,
      ekstraLokal: new Uint8Array([0x55, 0x54, 5, 0, 1, 2, 3, 4, 5]),
      ekstraPusat: new Uint8Array([0x55, 0x54, 1, 0, 1]),
    },
    {
      nama: 'META-INF/container.xml',
      isi: containerStandar('scores/utama.musicxml'),
      metode: 8,
      streaming: true,
    },
  ])

  const hasil = await uraiMxl(mxlStreaming)
  cek('3.1: .mxl ber-data-descriptor (compSize lokal = 0) berhasil diurai', hasil.ok === true, hasil.ok ? '' : hasil.alasan)
  if (hasil.ok) {
    cek('3.2: bita XML dari .mxl streaming identik byte-per-byte', samaBita(hasil.bitaXml, xmlUtamaBita))
    cek('3.3: jalurUtama membaca dari direktori pusat dengan benar', hasil.jalurUtama === 'scores/utama.musicxml', hasil.jalurUtama)
  }
}

/* === 4. Stored, Timewise, UTF-16 BOM, Entitas Jalur, & Komentar EOCD ==== */
{
  const xmlTimewise =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<score-timewise version="3.1">' +
    '<work><work-title>Langkah Serentak</work-title></work>' +
    '<part-list><score-part id="P1"><part-name>Horn</part-name></score-part></part-list>' +
    '<measure number="1"><part id="P1"><attributes><time><beats>3</beats><beat-type>4</beat-type></time></attributes>' +
    '<note><rest/><duration>3</duration></note></part></measure>' +
    '</score-timewise>'

  const mxlStored = bikinZip([
    { nama: 'META-INF/container.xml', isi: containerStandar('MusicXML/Lagu &amp; Nada.xml', '') },
    { nama: 'MusicXML/Lagu & Nada.xml', isi: xmlTimewise },
  ])
  const hasilStored = await uraiMxl(mxlStored)
  cek('4.1: .mxl stored dengan entitas &amp; pada full-path berhasil diurai', hasilStored.ok === true, hasilStored.ok ? '' : hasilStored.alasan)
  if (hasilStored.ok) {
    const p = putusanPartitur(hasilStored.bitaXml)
    cek('4.2: isi score-timewise di dalam .mxl terbaca utuh', p.boleh && p.ringkas?.susunan === 'timewise' && p.ringkas?.judul === 'Langkah Serentak')
  }

  // UTF-16 LE ber-BOM di dalam .mxl + pencocokan nama berkas beda kapitalisasi + komentar EOCD
  const keUtf16LeBom = (s) => {
    const out = new Uint8Array(2 + s.length * 2)
    out[0] = 0xff
    out[1] = 0xfe
    for (let i = 0; i < s.length; i += 1) {
      const k = s.charCodeAt(i)
      out[2 + i * 2] = k & 0xff
      out[2 + i * 2 + 1] = k >>> 8
    }
    return out
  }
  const bitaUtf16 = keUtf16LeBom(xmlTimewise)
  const mxlUtf16 = rakitZipUji(
    [
      { nama: 'meta-inf/CONTAINER.XML', isi: containerStandar('Sub/Skor-Lama.XML'), metode: 8 },
      { nama: 'sub/skor-lama.xml', isi: bitaUtf16, metode: 8 },
    ],
    { komentarZip: 'Diekspor oleh Dolet 8 — komentar berpenanda PK\x05\x06 palsu' },
  )
  const hasilUtf16 = await uraiMxl(mxlUtf16)
  cek('4.3: .mxl ber-UTF-16 LE BOM + beda kapitalisasi + komentar EOCD berhasil diurai', hasilUtf16.ok === true, hasilUtf16.ok ? '' : hasilUtf16.alasan)
  if (hasilUtf16.ok) {
    cek('4.4: bita UTF-16 terjaga persis dan putusanPartitur berhasil membacanya', samaBita(hasilUtf16.bitaXml, bitaUtf16) && putusanPartitur(hasilUtf16.bitaXml).ringkas?.judul === 'Langkah Serentak')
  }
}

/* ======= 5. Multi-rootfile (Thumbnail PNG + PDF + MusicXML) ============= */
{
  const containerCampur =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<container><rootfiles>\n' +
    '  <rootfile full-path="Thumbnails/thumbnail.png" media-type="image/png"/>\n' +
    '  <rootfile full-path="cetakan/pratinjau.pdf" media-type="application/pdf"/>\n' +
    '  <rootfile full-path="skor/utama.xml" media-type="application/vnd.recordare.musicxml+xml"/>\n' +
    '</rootfiles></container>'

  const mxlCampur = rakitZipUji([
    { nama: 'META-INF/container.xml', isi: containerCampur, metode: 8 },
    { nama: 'Thumbnails/thumbnail.png', isi: new Uint8Array([0x89, 0x50, 0x4e, 0x47]), metode: 0 },
    { nama: 'cetakan/pratinjau.pdf', isi: '%PDF-1.7\n%%EOF', metode: 8 },
    { nama: 'skor/utama.xml', isi: xmlUtamaBita, metode: 8 },
  ])
  const h1 = await uraiMxl(mxlCampur)
  cek('5.1: multi-rootfile memilih MusicXML dan melewati PNG serta PDF', h1.ok === true && h1.jalurUtama === 'skor/utama.xml', h1.ok ? h1.jalurUtama : h1.alasan)

  // Tanpa atribut media-type: tetap melewati .pdf dan memilih .musicxml
  const containerTanpaMedia =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<container><rootfiles>' +
    "<rootfile full-path='lampiran.pdf'/>" +
    "<rootfile full-path='notasi.musicxml'/>" +
    '</rootfiles></container>'
  const mxlTanpaMedia = rakitZipUji([
    { nama: 'META-INF/container.xml', isi: containerTanpaMedia, metode: 8 },
    { nama: 'lampiran.pdf', isi: '%PDF-1.7', metode: 0 },
    { nama: 'notasi.musicxml', isi: xmlUtamaBita, metode: 8 },
  ])
  const h2 = await uraiMxl(mxlTanpaMedia)
  cek('5.2: multi-rootfile tanpa media-type tetap memilih .musicxml', h2.ok === true && h2.jalurUtama === 'notasi.musicxml', h2.ok ? h2.jalurUtama : h2.alasan)
}

/* ============= 6. Berkas Rusak, Cacat, dan Bom ZIP (> 8 MB) ============= */
{
  const k0 = await uraiMxl(new Uint8Array(0))
  cek('6.1: berkas kosong ditolak jelas', !k0.ok && /kosong/i.test(k0.alasan), k0.ok ? 'lolos' : k0.alasan)

  const kBukanZip = await uraiMxl(keBita('%PDF-1.7 bukan mxl'))
  cek('6.2: bukan ZIP ditolak menyebut tanda tangan PK', !kBukanZip.ok && /PK/i.test(kBukanZip.alasan), kBukanZip.ok ? 'lolos' : kBukanZip.alasan)

  const kBesarMentah = await uraiMxl(new Uint8Array(BATAS_BITA + 100))
  cek('6.3: arsip mentah > 8 MB ditolak sebelum membaca direktori', !kBesarMentah.ok && /8 MB/.test(kBesarMentah.alasan), kBesarMentah.ok ? 'lolos' : kBesarMentah.alasan)

  const sah = rakitZipUji([
    { nama: 'META-INF/container.xml', isi: containerStandar(), metode: 8 },
    { nama: 'score.xml', isi: xmlUtamaBita, metode: 8 },
  ])
  const kTerpotong = await uraiMxl(sah.subarray(0, sah.length - 12))
  cek('6.4: .mxl terpotong ekornya (tanpa EOCD) ditolak jelas', !kTerpotong.ok && /EOCD|terpotong/i.test(kTerpotong.alasan), kTerpotong.ok ? 'lolos' : kTerpotong.alasan)

  const kTanpaContainer = await uraiMxl(bikinZip([{ nama: 'score.xml', isi: xmlUtamaBita }]))
  cek('6.5: ZIP tanpa META-INF/container.xml ditolak menyebut container.xml', !kTanpaContainer.ok && /container\.xml/.test(kTanpaContainer.alasan), kTanpaContainer.ok ? 'lolos' : kTanpaContainer.alasan)

  const kTanpaRootfile = await uraiMxl(
    bikinZip([{ nama: 'META-INF/container.xml', isi: '<container><rootfiles/></container>' }]),
  )
  cek('6.6: container.xml tanpa <rootfile> ditolak jelas', !kTanpaRootfile.ok && /rootfile/i.test(kTanpaRootfile.alasan), kTanpaRootfile.ok ? 'lolos' : kTanpaRootfile.alasan)

  const kRootHilang = await uraiMxl(
    bikinZip([{ nama: 'META-INF/container.xml', isi: containerStandar('hilang.xml') }]),
  )
  cek('6.7: rootfile menunjuk entri yang tidak ada ditolak menyebut nama berkasnya', !kRootHilang.ok && /hilang\.xml/.test(kRootHilang.alasan), kRootHilang.ok ? 'lolos' : kRootHilang.alasan)

  const kDeflateRusak = await uraiMxl(
    rakitZipUji([
      { nama: 'META-INF/container.xml', isi: containerStandar(), metode: 8 },
      { nama: 'score.xml', isi: xmlUtamaBita, metode: 8, bitaPadatMentah: new Uint8Array([0xff, 0x00, 0x12, 0x34]) },
    ]),
  )
  cek('6.8: aliran deflate rusak ditolak bersih tanpa melempar error', !kDeflateRusak.ok && /deflate|mendekompresi/i.test(kDeflateRusak.alasan), kDeflateRusak.ok ? 'lolos' : kDeflateRusak.alasan)

  const kCrcSalah = await uraiMxl(
    rakitZipUji([
      { nama: 'META-INF/container.xml', isi: containerStandar(), metode: 8 },
      { nama: 'score.xml', isi: xmlUtamaBita, metode: 8, crcPalsu: 0xdeadbeef },
    ]),
  )
  cek('6.9: CRC-32 tidak cocok terdeteksi dan ditolak', !kCrcSalah.ok && /CRC-32/.test(kCrcSalah.alasan), kCrcSalah.ok ? 'lolos' : kCrcSalah.alasan)

  const kMetodeAsing = await uraiMxl(
    rakitZipUji([
      { nama: 'META-INF/container.xml', isi: containerStandar(), metode: 0 },
      { nama: 'score.xml', isi: xmlUtamaBita, metode: 12, bitaPadatMentah: new Uint8Array([1, 2, 3]) },
    ]),
  )
  cek('6.10: metode kompresi #12 (bzip2) ditolak menyebut nomor metodenya', !kMetodeAsing.ok && /#12/.test(kMetodeAsing.alasan), kMetodeAsing.ok ? 'lolos' : kMetodeAsing.alasan)

  const kTerenkripsi = await uraiMxl(
    rakitZipUji([
      { nama: 'META-INF/container.xml', isi: containerStandar(), metode: 0 },
      { nama: 'score.xml', isi: xmlUtamaBita, metode: 0, bendera: 0x0801 },
    ]),
  )
  cek('6.11: entri terenkripsi (bit 0) ditolak jelas', !kTerenkripsi.ok && /terenkripsi|sandi/i.test(kTerenkripsi.alasan), kTerenkripsi.ok ? 'lolos' : kTerenkripsi.alasan)

  const kIsiHtml = await uraiMxl(
    rakitZipUji([
      { nama: 'META-INF/container.xml', isi: containerStandar('halaman.xml'), metode: 8 },
      { nama: 'halaman.xml', isi: '<!DOCTYPE html><html><body>Bukan partitur</body></html>', metode: 8 },
    ]),
  )
  cek('6.12: isi rootfile berupa HTML ditolak sebagai bukan MusicXML', !kIsiHtml.ok && /bukan MusicXML/i.test(kIsiHtml.alasan) && /<html>/.test(kIsiHtml.alasan), kIsiHtml.ok ? 'lolos' : kIsiHtml.alasan)

  // Bom ZIP (~9 KB padat → 9 MB saat dibuka):
  // (a) ukuranAsli jujur di tajuk pusat → langsung ditolak sebelum dekompresi
  // (b) ukuranAsli dipalsukan kecil (1.024 B) → diputus oleh pembaca aliran di tengah jalan!
  const sembilanMb = new Uint8Array(BATAS_BITA + 1024 * 1024).fill(65)
  const sembilanMbPadat = new Uint8Array(deflateRawSync(sembilanMb))
  cek('6.13: payload bom uji terkompresi < 25 KB untuk 9 MB', sembilanMbPadat.length < 25_000, String(sembilanMbPadat.length))

  const bomJujur = await uraiMxl(
    rakitZipUji([
      { nama: 'META-INF/container.xml', isi: containerStandar(), metode: 8 },
      { nama: 'score.xml', isi: sembilanMb, metode: 8, bitaPadatMentah: sembilanMbPadat },
    ]),
  )
  cek('6.14: entri > 8 MB di tajuk pusat langsung ditolak menyebut batas 8 MB', !bomJujur.ok && /8 MB/.test(bomJujur.alasan), bomJujur.ok ? 'lolos' : bomJujur.alasan)

  const bomPalsu = await uraiMxl(
    rakitZipUji([
      { nama: 'META-INF/container.xml', isi: containerStandar(), metode: 8 },
      {
        nama: 'score.xml',
        isi: new Uint8Array(1024),
        metode: 8,
        bitaPadatMentah: sembilanMbPadat,
        ukuranAsliPalsu: 1024,
      },
    ]),
  )
  cek('6.15: bom ZIP bertajuk ukuran palsu dihentikan aliran pada batas 8 MB', !bomPalsu.ok && /8 MB/.test(bomPalsu.alasan), bomPalsu.ok ? 'lolos' : bomPalsu.alasan)
}

/* ======= 7. Cadangan Peramban Lama (Tanpa DecompressionStream) ========== */
{
  const asli = globalThis.DecompressionStream
  try {
    // @ts-ignore — simulasi iOS 15 / Firefox lama
    globalThis.DecompressionStream = undefined

    const mxlDeflate = rakitZipUji([
      { nama: 'META-INF/container.xml', isi: containerStandar(), metode: 8 },
      { nama: 'score.xml', isi: xmlUtamaBita, metode: 8 },
    ])
    const hDeflate = await uraiMxl(mxlDeflate)
    cek(
      '7.1: tanpa DecompressionStream, .mxl deflate mengembalikan PESAN_MXL_PERAMBAN_LAMA (tidak crash)',
      !hDeflate.ok && hDeflate.alasan === PESAN_MXL_PERAMBAN_LAMA && /MuseScore/.test(hDeflate.alasan),
      hDeflate.ok ? 'lolos' : hDeflate.alasan,
    )

    // Sebaliknya bila seluruh entri di dalam .mxl kebetulan metode 0 (stored),
    // tetap berhasil dibuka meski DecompressionStream tidak tersedia!
    const mxlStored = bikinZip([
      { nama: 'META-INF/container.xml', isi: containerStandar() },
      { nama: 'score.xml', isi: xmlUtamaBita },
    ])
    const hStored = await uraiMxl(mxlStored)
    cek('7.2: tanpa DecompressionStream, .mxl stored (metode 0) tetap terbuka mulus', hStored.ok === true && samaBita(hStored.bitaXml, xmlUtamaBita))
  } finally {
    globalThis.DecompressionStream = asli
  }
}

// Beri satu putaran mikrotask untuk memastikan tidak ada janji aliran liar yang tertinggal.
await new Promise((r) => setTimeout(r, 30))
cek('8.1: nol unhandledRejection selama seluruh uji aliran baik maupun rusak', tolakTakTertangani === 0, String(tolakTakTertangani))

console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length > 0) {
  console.log('GAGAL:\n - ' + gagal.join('\n - '))
  process.exit(1)
}
