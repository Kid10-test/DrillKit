/**
 * #11a — Partitur (MusicXML/PDF): uji logika murni.
 *
 * Seluruh isi berkas ini berjalan tanpa peramban, dan itu memang tujuannya:
 * 11a tidak merender apa pun, jadi tak ada alasan menunggu Chrome untuk
 * membuktikan bahwa pemindainya benar. Pola yang sama dengan
 * `qa/pyware-logika.mjs`.
 *
 * Yang diuji:
 *
 *   1. **Deteksi dari isi, bukan nama** — `%PDF-`, ZIP + `META-INF/container.xml`
 *      (`.mxl`, ditolak dengan pesan petunjuk), akar `score-partwise`/
 *      `score-timewise`.
 *   2. **Ringkasan** untuk fixture lima sumber (MuseScore 3, MuseScore 4,
 *      Sibelius, Finale, plug-in Dolet) + satu `score-timewise`.
 *   3. **Sukat campur** — 4/4 → 7/8 di birama 17 → 4/4 di birama 33; juga
 *      penomoran anacrusis (`number="0"`) dan `<attributes>` yang diulang di
 *      setiap part (satu birama = satu entri, bukan enam).
 *   4. **Batas yang disengaja** — XML terpotong, > 8 MB, 6.000 birama,
 *      entitas tak dikenal, DOCTYPE & komentar sebelum akar, CDATA mentah.
 *   5. **D1 & D4** — `.mxl` ditolak; MusicXML yang gagal diringkas **tetap
 *      boleh dipasang** dengan `ringkasGagal` terisi.
 *   6. **ZIP & hash** — round-trip `bikinZip` → `bukaZip` beserta manifest,
 *      dan hash SHA-256 yang dipakai ulang dari `rekaman.ts` (stabil untuk
 *      bita yang sama, berubah untuk satu bita berbeda).
 *
 * Pakai: bash qa/bangun-logika.sh && node qa/partitur-logika.mjs
 */
import { bikinZip, bukaZip } from '/tmp/zip.mjs'
import { hitungHashAudio } from '/tmp/rekaman.mjs'
import {
  BATAS_BIRAMA,
  BATAS_BITA,
  PESAN_MXL,
  deteksiPartitur,
  putusanPartitur,
  ringkasMusicXml,
  teksPartitur,
} from '/tmp/partitur.mjs'

let lulus = 0
const gagal = []
const cek = (nama, syarat, keterangan = '') => {
  if (syarat) lulus += 1
  else gagal.push(`${nama}${keterangan ? ' — ' + keterangan : ''}`)
}
const bita = (teks) => new TextEncoder().encode(teks)
/** Bandingkan bita tanpa Buffer, supaya alat bantunya netral seperti modulnya. */
const samaBita = (a, b) => a.length === b.length && a.every((v, i) => v === b[i])

/* ------------------------------ Fixture ---------------------------------- */

/** `<attributes>` dengan sukat tertentu; `<divisions>` ikut supaya mirip ekspor asli. */
const ATTR = (beats, beatType) =>
  `<attributes><divisions>2</divisions><key><fifths>0</fifths></key>` +
  `<time><beats>${beats}</beats><beat-type>${beatType}</beat-type></time></attributes>`

/** Penanda tempo seperti ekspor asli: `<sound tempo>` ada di dalam `<direction>`. */
const TEMPO = (t) =>
  `<direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit>` +
  `<per-minute>${t}</per-minute></metronome></direction-type><sound tempo="${t}"/></direction>`

/** Satu `<part>` berisi `n` birama; `awalan(birama)` menyisipkan isi sebelum not. */
const bagian = (id, n, awalan = () => '') => {
  let keluar = `<part id="${id}">`
  for (let b = 1; b <= n; b += 1) {
    keluar +=
      `<measure number="${b}">${awalan(b)}` +
      '<note><rest measure="yes"/><duration>2</duration></note></measure>'
  }
  return keluar + '</part>'
}

/** `<part-list>` dari baris [id, nama, singkatan?]. */
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

/** Enam part — bentuk yang paling sering dipakai tim marching band. */
const PART_6 = [
  ['P1', 'Piccolo', 'Picc.'],
  ['P2', 'Clarinet 1', 'Cl. 1'],
  ['P3', 'Alto Sax 1', 'A. Sx. 1'],
  ['P4', 'Trumpet 1', 'Tpt. 1'],
  ['P5', 'Snare Drum', 'Sn.'],
  ['P6', 'Bass Drum', 'BD.'],
]

/** MuseScore 3: BOM + CRLF, DOCTYPE, komentar berisi `&` sebelum akar, 6 part, 32 birama. */
const MS3 =
  '\uFEFF<?xml version="1.0" encoding="UTF-8"?>\r\n' +
  '<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" ' +
  '"http://www.musicxml.org/dtds/partwise.dtd">\r\n' +
  '<!-- diekspor MuseScore 3.6.2 & diedit tangan; & di komentar bukan entitas -->\r\n' +
  '<score-partwise version="3.1">\r\n' +
  '<movement-title>Pembuka &amp; Penutup</movement-title>\r\n' +
  '<identification>\r\n' +
  '<creator type="composer">Budi Santoso</creator>\r\n' +
  '<creator type="lyricist">Rina Pratiwi</creator>\r\n' +
  '<encoding><software>MuseScore 3.6.2</software><encoding-date>2026-10-02</encoding-date></encoding>\r\n' +
  '</identification>\r\n' +
  daftarPart(PART_6) +
  '\r\n' +
  PART_6.map(([id]) => bagian(id, 32, (b) => (b === 1 ? ATTR(4, 4) + TEMPO(120) : ''))).join('\r\n') +
  '\r\n</score-partwise>\r\n'

/** MuseScore 4: judul gerak menang atas judul karya, tanpa tempo, 24 birama. */
const MS4 =
  '<?xml version="1.0" encoding="UTF-8"?>' +
  '<score-partwise version="4.0">' +
  '<work><work-title>Sketsa Nusantara</work-title></work>' +
  '<movement-title>Pembukaan</movement-title>' +
  '<identification><creator type="composer">Dewi Lestari</creator>' +
  '<creator type="arranger">Tio</creator></identification>' +
  daftarPart([
    ['P1', 'Flute', 'Fl.'],
    ['P2', 'Tuba', 'Tb.'],
  ]) +
  bagian('P1', 24, (b) => (b === 1 ? ATTR(4, 4) : '')) +
  bagian('P2', 24, (b) => (b === 1 ? ATTR(4, 4) : '')) +
  '</score-partwise>'

/**
 * Sibelius: hanya `<work-title>`, tanpa singkatan, **birama anacrusis**
 * (`number="0"`) yang membawa tanda sukat 7/8, tanpa tempo.
 */
const SIBELIUS =
  '<?xml version="1.0" encoding="UTF-8"?>' +
  '<score-partwise version="3.1">' +
  '<work><work-title>Suite No. 2</work-title></work>' +
  '<identification><creator type="composer">Jean S.</creator></identification>' +
  daftarPart([
    ['P1', 'Cornet', undefined],
    ['P2', 'Percussion', undefined],
  ]) +
  `<part id="P1"><measure number="0">${ATTR(7, 8)}<note><rest/></note></measure>` +
  '<measure number="1"><note><rest/></note></measure>' +
  '<measure number="2"><note><rest/></note></measure>' +
  '<measure number="3"><note><rest/></note></measure>' +
  '<measure number="4"><note><rest/></note></measure></part>' +
  '<part id="P2"><measure number="0"><note><rest/></note></measure>' +
  '<measure number="1"><note><rest/></note></measure>' +
  '<measure number="2"><note><rest/></note></measure>' +
  '<measure number="3"><note><rest/></note></measure>' +
  '<measure number="4"><note><rest/></note></measure></part>' +
  '</score-partwise>'

/**
 * Finale: `<time>` diulang di setiap birama **dan** di setiap part — hanya
 * perubahan yang boleh tercatat, jadi ringkasannya tetap satu entri.
 */
const FINALE =
  '<?xml version="1.0" encoding="UTF-8"?>' +
  '<score-partwise version="3.0">' +
  '<movement-title>Finale March</movement-title>' +
  '<identification><creator type="composer">R. B. Hall</creator></identification>' +
  daftarPart([
    ['P1', 'Soprano Sax', 'S. Sx.'],
    ['P2', 'Mellophone', 'Mel.'],
    ['P3', 'Tenor Drum', 'Ten.'],
  ]) +
  ['P1', 'P2', 'P3'].map((id) => bagian(id, 12, () => ATTR(4, 4))).join('') +
  '</score-partwise>'

/** Plug-in Dolet: `<work-title>` **dan** `<movement-title>`, plus `<credit>`. */
const DOLET =
  '<?xml version="1.0" encoding="UTF-8"?>' +
  '<score-partwise version="2.0">' +
  '<work><work-title>Dolet Works</work-title></work>' +
  '<movement-title>Fanfare</movement-title>' +
  '<identification><creator type="composer">Plug-in Dolet</creator></identification>' +
  '<credit page="1"><credit-words>Fanfare</credit-words></credit>' +
  daftarPart(PART_6) +
  PART_6.map(([id]) => bagian(id, 8, () => ATTR(4, 4))).join('') +
  '</score-partwise>'

/** `score-timewise`: measure-major — birama di luar, part di dalam. */
const TIMEWISE =
  '<?xml version="1.0" encoding="UTF-8"?>' +
  '<score-timewise version="3.1">' +
  '<part-list><score-part id="P1"><part-name>Alto 1</part-name></score-part>' +
  '<score-part id="P2"><part-name>Alto 2</part-name></score-part></part-list>' +
  [1, 2, 3]
    .map(
      (n) =>
        `<measure number="${n}">` +
        `<part id="P1">${n === 1 ? ATTR(7, 8) : ''}<note><rest/></note></part>` +
        `<part id="P2"><note><rest/></note></part></measure>`,
    )
    .join('') +
  '</score-timewise>'

/** Sukat campur: 4/4 → 7/8 di birama 17 → 4/4 di birama 33, pada dua part. */
const CAMPUR =
  '<?xml version="1.0" encoding="UTF-8"?>' +
  '<score-partwise version="3.1">' +
  '<movement-title>Sukat Campur</movement-title>' +
  daftarPart([
    ['P1', 'Bagian 1', undefined],
    ['P2', 'Bagian 2', undefined],
  ]) +
  ['P1', 'P2']
    .map((id) =>
      bagian(id, 40, (b) => {
        if (b === 1) return ATTR(4, 4) + TEMPO(88)
        if (b === 17) return ATTR(7, 8)
        if (b === 33) return ATTR(4, 4)
        return ''
      }),
    )
    .join('') +
  '</score-partwise>'

/** Tanpa atribut `number` sama sekali — penomoran mengikuti urutan. */
const TANPA_NOMOR =
  '<score-partwise version="3.1">' +
  daftarPart([['P1', 'Tanpa Nomor', undefined]]) +
  '<part id="P1"><measure>' +
  ATTR(2, 2) +
  '<note><rest/></note></measure><measure><note><rest/></note></measure>' +
  '<measure><note><rest/></note></measure></part>' +
  '</score-partwise>'

const PDF = '%PDF-1.4\n1 0 obj\n<</Type/Catalog>>\nendobj\ntrailer\n%%EOF'

/** Ringkasan sebuah fixture — dipakai berulang supaya asersinya pendek. */
const ringkasDari = (teks) => (ringkasMusicXml(teks).ok ? ringkasMusicXml(teks).ringkas : {})
/** Pesan galat sebuah fixture ('' bila ternyata berhasil). */
const galatDari = (teks) => (ringkasMusicXml(teks).ok ? '' : ringkasMusicXml(teks).galat)

/* ============================ 1. Deteksi ================================ */

{
  const h = deteksiPartitur(bita(MS3))
  cek('1.1: .musicxml dikenali dari isi, bukan dari namanya', h.ya === true && h.tipe === 'musicxml', h.alasan)
  cek('1.2: BOM sebelum <?xml …?> tidak menghalangi deteksi', deteksiPartitur(bita('\uFEFF' + MS3)).ya === true)
  cek('1.3: score-timewise dikenali juga', deteksiPartitur(bita(TIMEWISE)).ya === true)

  const p = deteksiPartitur(bita(PDF))
  cek('1.4: PDF dikenali dari magic %PDF-', p.ya === true && p.tipe === 'pdf', p.alasan)

  const kosong = deteksiPartitur(new Uint8Array(0))
  cek('1.5: berkas kosong ditolak dengan alasannya', kosong.ya === false && kosong.alasan === 'berkas kosong (0 bita)', kosong.alasan)

  const csv = deteksiPartitur(bita('Kode,Nama,Section\r\nA01,Andra,Percussion\r\n'))
  cek('1.6: CSV bukan partitur, dan alasannya menyebut XML', csv.ya === false && /bukan XML/.test(csv.alasan ?? ''), csv.alasan)

  const html = deteksiPartitur(bita('<html><body>Halo</body></html>'))
  cek(
    '1.7: akar asing ditolak dengan menyebut namanya',
    html.ya === false && html.alasan === 'elemen akar <html>, bukan <score-partwise>/<score-timewise>',
    html.alasan,
  )

  const ns = deteksiPartitur(bita('<mx:score-partwise xmlns:mx="urn:x"></mx:score-partwise>'))
  cek('1.8: namespace di luar default tidak ditebak', ns.ya === false && /<mx:score-partwise>/.test(ns.alasan ?? ''), ns.alasan)
}

/* ============================== 2. MuseScore 3 =========================== */

{
  const hasil = ringkasMusicXml(MS3)
  cek('2.1: ringkasan MuseScore 3 berhasil & susunannya partwise', hasil.ok === true && hasil.ringkas.susunan === 'partwise', hasil.ok ? '' : hasil.galat)
  const r = ringkasDari(MS3)
  cek('2.2: judul terbaca & &amp; didekode (bukan dibuang)', r.judul === 'Pembuka & Penutup', r.judul)
  cek('2.3: komposer menang atas penulis lirik', r.pengarang === 'Budi Santoso', r.pengarang)
  cek('2.4: jumlah part', r.jumlahPart === 6, String(r.jumlahPart))
  cek('2.5: jumlah birama = yang terbanyak antar part', r.jumlahBirama === 32, String(r.jumlahBirama))
  cek('2.6: part pertama sesuai urutan part-list', r.parts?.[0]?.id === 'P1' && r.parts?.[0]?.nama === 'Piccolo', JSON.stringify(r.parts?.[0]))
  cek('2.7: part ketiga beserta singkatannya', r.parts?.[2]?.nama === 'Alto Sax 1' && r.parts?.[2]?.singkatan === 'A. Sx. 1', JSON.stringify(r.parts?.[2]))
  cek('2.8: part terakhir beserta singkatannya', r.parts?.[5]?.nama === 'Bass Drum' && r.parts?.[5]?.singkatan === 'BD.', JSON.stringify(r.parts?.[5]))
  cek('2.9: urutan part mengikuti <part-list>', r.parts?.map((x) => x.id).join(',') === 'P1,P2,P3,P4,P5,P6', r.parts?.map((x) => x.id).join(','))
  cek('2.10: sukat pertama 4/4', r.sukat?.beats === 4 && r.sukat?.beatType === 4, JSON.stringify(r.sukat))
  cek('2.11: 4/4 murni = satu entri perubahan di birama 1', r.perubahanSukat?.length === 1 && r.perubahanSukat[0].birama === 1, JSON.stringify(r.perubahanSukat))
  cek('2.12: tempo pertama terbaca sebagai angka', r.tempo === 120 && typeof r.tempo === 'number', String(r.tempo))
  cek('2.13: ringkasan tidak membawa hash/ukuran (itu urusan penyimpanan)', !('hash' in r) && !('ukuran' in r) && !('terurai' in r))

  // Part dengan jumlah birama berbeda: yang dilaporkan adalah yang terbanyak.
  const beda = ringkasDari(
    '<score-partwise version="3.1">' +
      daftarPart([
        ['P1', 'Panjang', undefined],
        ['P2', 'Pendek', undefined],
      ]) +
      bagian('P1', 32) +
      bagian('P2', 28) +
      '</score-partwise>',
  )
  cek('2.14: part pendek tidak menurunkan jumlah birama', beda.jumlahBirama === 32, String(beda.jumlahBirama))
}

/* ============================== 3. MuseScore 4 =========================== */

{
  const r = ringkasDari(MS4)
  cek('3.1: movement-title menang atas work-title', r.judul === 'Pembukaan', r.judul)
  cek('3.2: creator composer jadi pengarang; arranger tidak menggantikannya', r.pengarang === 'Dewi Lestari', r.pengarang)
  cek('3.3: jumlah birama & part MS4', r.jumlahBirama === 24 && r.jumlahPart === 2, `${r.jumlahBirama}/${r.jumlahPart}`)
  cek('3.4: singkatan part kedua', r.parts?.[1]?.singkatan === 'Tb.', r.parts?.[1]?.singkatan)
  cek('3.5: tanpa <sound tempo> = tempo kosong, sukat tetap terbaca', r.tempo === undefined && r.sukat?.beats === 4, String(r.tempo))

  // Dua penanda tempo (yang kedua = perubahan di tengah lagu): yang pertama
  // yang dilaporkan, sebab itu tempo pembukanya.
  const duaTempo = ringkasDari(
    '<score-partwise version="3.1">' +
      daftarPart([['P1', 'Tempo', undefined]]) +
      bagian('P1', 8, (b) => (b === 1 ? ATTR(4, 4) + TEMPO(120) : b === 5 ? TEMPO(72) : '')) +
      '</score-partwise>',
  )
  cek('3.6: <sound tempo> pertama yang dipakai, bukan yang terakhir', duaTempo.tempo === 120, String(duaTempo.tempo))
}

/* ======================== 4. Sibelius / anacrusis ======================= */

{
  const r = ringkasDari(SIBELIUS)
  cek('4.1: work-title dipakai bila movement-title tidak ada', r.judul === 'Suite No. 2', r.judul)
  cek('4.2: anacrusis number="0" jadi birama 0 dengan sukat 7/8', r.perubahanSukat?.[0]?.birama === 0 && r.sukat?.beats === 7 && r.sukat?.beatType === 8, JSON.stringify(r.perubahanSukat))
  cek('4.3: lima elemen measure dihitung semuanya', r.jumlahBirama === 5, String(r.jumlahBirama))
  cek('4.4: part tanpa singkatan = undefined, namanya tetap utuh', r.parts?.[0]?.singkatan === undefined && r.parts?.[1]?.nama === 'Percussion', JSON.stringify(r.parts))
  cek('4.5: hanya satu perubahan sukat & tempo tetap kosong', r.perubahanSukat?.length === 1 && r.tempo === undefined, JSON.stringify(r.perubahanSukat))
}

/* ===================== 5. Finale: pengulangan <time> ==================== */

{
  const r = ringkasDari(FINALE)
  cek('5.1: <time> berulang 36× tetap satu entri', r.perubahanSukat?.length === 1, JSON.stringify(r.perubahanSukat))
  cek('5.2: tiga part, dua belas birama', r.jumlahPart === 3 && r.jumlahBirama === 12, `${r.jumlahPart}/${r.jumlahBirama}`)
  cek('5.3: judul & pengarang Finale', r.judul === 'Finale March' && r.pengarang === 'R. B. Hall', `${r.judul}/${r.pengarang}`)
  cek('5.4: singkatan part kedua & ketiga', r.parts?.[1]?.singkatan === 'Mel.' && r.parts?.[2]?.singkatan === 'Ten.', JSON.stringify(r.parts?.map((p) => p.singkatan)))
}

/* ================= 6. Dolet & part di luar <part-list> ================== */

{
  const r = ringkasDari(DOLET)
  cek('6.1: movement-title tetap menang di ekspor Dolet', r.judul === 'Fanfare', r.judul)
  cek('6.2: enam part & delapan birama Dolet', r.jumlahPart === 6 && r.jumlahBirama === 8, `${r.jumlahPart}/${r.jumlahBirama}`)
  cek('6.3: pengarang Dolet terbaca', r.pengarang === 'Plug-in Dolet', r.pengarang)

  // Part yang berisi not tetapi tidak tercatat di <part-list> tidak boleh hilang.
  const nyasar = ringkasDari(
    '<score-partwise version="3.1">' +
      daftarPart([['P1', 'Terdaftar', undefined]]) +
      bagian('P1', 2) +
      bagian('P9', 2) +
      '</score-partwise>',
  )
  cek('6.4: part di luar part-list tetap dilaporkan', nyasar.jumlahPart === 2, String(nyasar.jumlahPart))
  cek('6.5: nama part nyasar jatuh ke id-nya', nyasar.parts?.[1]?.nama === 'P9', JSON.stringify(nyasar.parts?.[1]))

  // <part-name> kosong (print-object="no") juga jatuh ke id.
  const tanpaNama = ringkasDari(
    '<score-partwise version="3.1"><part-list><score-part id="P7"><part-name/></score-part></part-list>' +
      '<part id="P7"><measure number="1"><note><rest/></note></measure></part></score-partwise>',
  )
  cek('6.6: part tanpa nama memakai id-nya', tanpaNama.parts?.[0]?.nama === 'P7', JSON.stringify(tanpaNama.parts?.[0]))
}

/* ========================== 7. score-timewise ========================== */

{
  const hasil = ringkasMusicXml(TIMEWISE)
  cek('7.1: timewise berhasil diringkas & dilaporkan timewise', hasil.ok === true && hasil.ringkas.susunan === 'timewise', hasil.ok ? '' : hasil.galat)
  const r = hasil.ok ? hasil.ringkas : {}
  cek('7.2: tiga birama & dua part', r.jumlahBirama === 3 && r.jumlahPart === 2, `${r.jumlahBirama}/${r.jumlahPart}`)
  cek('7.3: nama part di dalam measure terbaca', r.parts?.[0]?.nama === 'Alto 1', r.parts?.[0]?.nama)
  cek('7.4: sukat 7/8 di birama 1', r.perubahanSukat?.[0]?.birama === 1 && r.sukat?.beats === 7, JSON.stringify(r.perubahanSukat))
  cek('7.5: satu entri perubahan sukat', r.perubahanSukat?.length === 1, JSON.stringify(r.perubahanSukat))
}

/* ========================== 8. Sukat campur ============================ */

{
  const r = ringkasDari(CAMPUR)
  cek('8.1: tiga entri, part kedua tidak menggandakannya', r.perubahanSukat?.length === 3, JSON.stringify(r.perubahanSukat))
  cek('8.2: 4/4 mulai birama 1', r.perubahanSukat?.[0]?.birama === 1 && r.perubahanSukat[0].beats === 4 && r.perubahanSukat[0].beatType === 4, JSON.stringify(r.perubahanSukat?.[0]))
  cek('8.3: 7/8 mulai birama 17', r.perubahanSukat?.[1]?.birama === 17 && r.perubahanSukat[1].beats === 7 && r.perubahanSukat[1].beatType === 8, JSON.stringify(r.perubahanSukat?.[1]))
  cek('8.4: kembali 4/4 di birama 33', r.perubahanSukat?.[2]?.birama === 33 && r.perubahanSukat[2].beats === 4 && r.perubahanSukat[2].beatType === 4, JSON.stringify(r.perubahanSukat?.[2]))
  cek('8.5: sukat pertama tetap 4/4', r.sukat?.beats === 4 && r.sukat?.beatType === 4, JSON.stringify(r.sukat))
  cek('8.6: 40 birama & tempo 88', r.jumlahBirama === 40 && r.tempo === 88, `${r.jumlahBirama}/${r.tempo}`)

  const tn = ringkasDari(TANPA_NOMOR)
  cek('8.7: tanpa atribut number, birama dihitung urut', tn.jumlahBirama === 3, String(tn.jumlahBirama))
  cek('8.8: sukat tanpa number tetap dapat birama 1', tn.perubahanSukat?.[0]?.birama === 1, JSON.stringify(tn.perubahanSukat))
}

/* ============================== 9. Galat =============================== */

{
  const potong = galatDari(MS3.replace('</score-partwise>\r\n', ''))
  cek('9.1: XML terpotong ditolak, pesannya menyebut tag yang belum ditutup', /terpotong/.test(potong) && /<score-partwise>/.test(potong), potong)

  const tagTerbuka = galatDari('<score-partwise></score-partwise')
  cek('9.2: tag yang tidak ditutup dengan > dilaporkan', /tidak ditutup dengan '>'/.test(tagTerbuka), tagTerbuka)

  const salahTutup = galatDari('<score-partwise><part-list></score-partwise>')
  cek('9.3: tag penutup tak cocok disebut bersama keduanya', /tidak cocok/.test(salahTutup) && /<\/score-partwise>/.test(salahTutup) && /<part-list>/.test(salahTutup), salahTutup)

  const entitas = galatDari('<score-partwise><movement-title>Lagu &nbsp; Gembira</movement-title></score-partwise>')
  cek('9.4: entitas tak dikenal ditolak dengan menyebut entitasnya', /entitas &nbsp; tidak dikenal/.test(entitas) && /&amp;/.test(entitas), entitas)

  const ampersand = galatDari('<score-partwise><movement-title>A & B</movement-title></score-partwise>')
  cek('9.5: & tanpa entitas dilaporkan, bukan diterima diam-diam', /bukan awal entitas/.test(ampersand), ampersand)

  const komentar = galatDari('<score-partwise><!-- belum ditutup')
  cek('9.6: komentar tak ditutup dilaporkan', /komentar tidak ditutup/.test(komentar), komentar)

  // 8,4 MB ruang kosong: ditolak sebelum dipindai, bukan menggantung.
  const besar = galatDari(' '.repeat(8808038) + MS4)
  cek('9.7: berkas di atas 8 MB ditolak dengan ukuran & batasnya', besar === '8,4 MB melebihi batas 8 MB', besar)

  const banyak = galatDari(
    '<score-partwise version="3.1">' +
      daftarPart([['P1', 'Panjang', undefined]]) +
      '<part id="P1">' +
      Array.from({ length: 6000 }, (_, i) => `<measure number="${i + 1}"><note><rest/></note></measure>`).join('') +
      '</part></score-partwise>',
  )
  cek('9.8: 6.000 birama ditolak dengan batas biramanya', banyak === '6.000 birama melebihi batas pemindai 5.000 birama', banyak)

  const akarAsing = galatDari('<buku><judul>Halo</judul></buku>')
  cek('9.9: akar tak dikenal menghasilkan galat yang menyebut akarnya', akarAsing === 'elemen akar <buku>, bukan <score-partwise>/<score-timewise>', akarAsing)

  cek('9.10: batas ukuran berkas 8 MB', BATAS_BITA === 8 * 1024 * 1024, String(BATAS_BITA))
  cek('9.11: batas birama 5.000', BATAS_BIRAMA === 5000, String(BATAS_BIRAMA))
}

/* ==================== 10. DOCTYPE, CDATA, komentar ==================== */

{
  const cdata = ringkasDari(
    '<!DOCTYPE score-partwise SYSTEM "partwise.dtd">' +
      '<?xml-stylesheet type="text/xsl" href="x.xsl"?>' +
      '<score-partwise version="3.1"><movement-title><![CDATA[Rock & Roll]]></movement-title></score-partwise>',
  )
  cek('10.1: CDATA diterima sebagai teks mentah (& tidak jadi entitas)', cdata.judul === 'Rock & Roll', JSON.stringify(cdata))

  const komentar = ringkasDari(
    '<!-- komentar & aneh --><score-partwise version="3.1"><!-- & juga di sini -->' +
      '<movement-title>Judul</movement-title></score-partwise>',
  )
  cek('10.2: & di dalam komentar tidak memicu galat & judul tetap terbaca', komentar.judul === 'Judul', JSON.stringify(komentar))

  const doctypeInternal = ringkasDari(
    '<!DOCTYPE score-partwise [<!ENTITY foo "bar">]><score-partwise version="3.1">' +
      '<movement-title>Nama</movement-title></score-partwise>',
  )
  cek('10.3: DOCTYPE dengan internal subset dilewati', doctypeInternal.judul === 'Nama', JSON.stringify(doctypeInternal))

  const spasi = ringkasDari(
    '<score-partwise version="3.1"><movement-title>\n   Mars   Gembira \n </movement-title>' +
      '<part-list><score-part id="P1"><part-name>  Flute  </part-name></score-part></part-list></score-partwise>',
  )
  cek('10.4: judul & nama part dirapikan', spasi.judul === 'Mars Gembira' && spasi.parts?.[0]?.nama === 'Flute', `${spasi.judul}/${spasi.parts?.[0]?.nama}`)

  const entitasJudul = ringkasDari(
    '<score-partwise version="3.1"><part-list><score-part id="P1">' +
      '<part-name>Snare &amp; Tenor</part-name></score-part></part-list></score-partwise>',
  )
  cek('10.5: entitas di nama part didekode', entitasJudul.parts?.[0]?.nama === 'Snare & Tenor', entitasJudul.parts?.[0]?.nama)

  const kosong = ringkasDari('<score-partwise version="3.1"></score-partwise>')
  cek('10.6: skor kosong tetap sah diringkas (0 part, 0 birama)', kosong.jumlahPart === 0 && kosong.jumlahBirama === 0, JSON.stringify(kosong))
}

/* ======================= 11. Bita → teks (BOM UTF-16) ================== */

{
  cek('11.1: BOM UTF-8 dibuang, teks tanpa BOM apa adanya', teksPartitur(bita('\uFEFF<m/>')) === '<m/>' && teksPartitur(bita('<m/>')) === '<m/>')

  const utf16le = new Uint8Array([0xff, 0xfe, 0x3c, 0x00, 0x6d, 0x00, 0x2f, 0x00, 0x3e, 0x00])
  cek('11.2: BOM UTF-16 LE diuraikan', teksPartitur(utf16le) === '<m/>', teksPartitur(utf16le))

  const utf16be = new Uint8Array([0xfe, 0xff, 0x00, 0x3c, 0x00, 0x6d, 0x00, 0x2f, 0x00, 0x3e])
  cek('11.3: BOM UTF-16 BE diuraikan', teksPartitur(utf16be) === '<m/>', teksPartitur(utf16be))

  // Ekspor UTF-16 nyata (Finale/Sibelius lama) harus tetap dikenali & diringkas.
  const xml16 = new Uint8Array(2 + MS4.length * 2)
  xml16[0] = 0xff
  xml16[1] = 0xfe
  for (let i = 0; i < MS4.length; i += 1) {
    const k = MS4.charCodeAt(i)
    xml16[2 + i * 2] = k & 0xff
    xml16[3 + i * 2] = (k >> 8) & 0xff
  }
  const d16 = deteksiPartitur(xml16)
  cek('11.4: MusicXML UTF-16 dikenali & diringkas judulnya', d16.ya === true && d16.tipe === 'musicxml' && ringkasMusicXml(teksPartitur(xml16)).ringkas?.judul === 'Pembukaan', d16.alasan)
}

/* ========================== 12. .mxl & PDF (D1) ======================== */

{
  const mxl = bikinZip(
    [
      { nama: 'META-INF/container.xml', isi: '<container><rootfiles/></container>' },
      { nama: 'score.xml', isi: MS4 },
    ],
    new Date('2026-10-13T00:00:00Z'),
  )
  const d = deteksiPartitur(mxl)
  cek('12.1: .mxl dikenali sebagai mxl dari META-INF/container.xml', d.ya === false && d.tipe === 'mxl', d.alasan)
  cek('12.2: pesannya persis pesan petunjuk .mxl', d.alasan === PESAN_MXL, d.alasan)
  cek('12.3: pesannya menyebut MuseScore & bentuk .musicxml', /MuseScore/.test(PESAN_MXL) && /\.musicxml/.test(PESAN_MXL))

  const putusanMxl = putusanPartitur(mxl)
  cek('12.4: .mxl tidak boleh dipasang (D1) dan tipenya dilaporkan', putusanMxl.boleh === false && putusanMxl.tipe === 'mxl' && putusanMxl.alasan === PESAN_MXL, JSON.stringify(putusanMxl))

  const zipBiasa = deteksiPartitur(bikinZip([{ nama: 'audio/manifest.json', isi: '[]' }], new Date('2026-10-13T00:00:00Z')))
  cek('12.5: ZIP biasa bukan partitur, alasannya menyebut container.xml', zipBiasa.ya === false && zipBiasa.tipe === undefined && /META-INF\/container\.xml/.test(zipBiasa.alasan ?? ''), zipBiasa.alasan)

  const putusanPdf = putusanPartitur(bita(PDF))
  cek('12.6: PDF boleh dipasang tanpa ringkasan, dan itu bukan kegagalan', putusanPdf.boleh === true && putusanPdf.tipe === 'pdf' && putusanPdf.ringkas === null && putusanPdf.ringkasGagal === undefined, JSON.stringify(putusanPdf))
  cek('12.7: PDF tidak pernah masuk pemindai MusicXML', ringkasMusicXml(PDF).ok === false, galatDari(PDF))
}

/* ============================== 13. D4 ================================= */

{
  // XML yang sah dan berakar benar, tetapi pemindainya menyerah (entitas
  // eksotis). Deteksi bilang ya, ringkasan gagal — berkasnya tetap dipasang.
  const xmlAneh = '<score-partwise version="3.1"><movement-title>Lagu &nbsp; Kita</movement-title></score-partwise>'
  cek('13.1: deteksi tetap yakin ini MusicXML, sementara ringkasannya gagal', deteksiPartitur(bita(xmlAneh)).ya === true && ringkasMusicXml(xmlAneh).ok === false)

  const putusan = putusanPartitur(bita(xmlAneh))
  cek('13.2: berkas tetap boleh dipasang (D4), tipe tetap musicxml', putusan.boleh === true && putusan.tipe === 'musicxml', JSON.stringify(putusan))
  cek('13.3: ringkasannya kosong, bukan setengah jadi (terurai: false)', putusan.ringkas === null)
  cek('13.4: pesan pemindai diteruskan apa adanya untuk ditampilkan', putusan.ringkasGagal === 'entitas &nbsp; tidak dikenal (hanya &amp; &lt; &gt; &quot; &apos; yang didukung)', putusan.ringkasGagal)

  const putusanMs3 = putusanPartitur(bita(MS3))
  cek('13.5: MusicXML normal boleh dipasang dengan ringkasan & tanpa pesan gagal', putusanMs3.boleh === true && putusanMs3.ringkas?.judul === 'Pembuka & Penutup' && putusanMs3.ringkasGagal === undefined, JSON.stringify(putusanMs3.ringkas))
  cek('13.6: berkas kosong tidak boleh dipasang, alasannya diteruskan', putusanPartitur(new Uint8Array(0)).boleh === false && putusanPartitur(new Uint8Array(0)).alasan === 'berkas kosong (0 bita)')
  cek('13.7: CSV tidak boleh dipasang sebagai partitur', putusanPartitur(bita('Kode,Nama\nA01,Andra')).boleh === false)
}

/* ====================== 14. ZIP round-trip & manifest ================== */

{
  const isi = bita(MS3)
  const manifest = JSON.stringify({
    lagu: [{ songId: 'L1', namaFile: 'Pembuka.musicxml', hash: await hitungHashAudio(isi), ukuran: isi.length }],
  })
  const zip = bikinZip(
    [
      { nama: 'partitur/L1_Pembuka.musicxml', isi },
      { nama: 'partitur/manifest.json', isi: manifest },
    ],
    new Date('2026-10-13T00:00:00Z'),
  )
  const keluar = bukaZip(zip)
  cek('14.1: dua entri partitur kembali dari ZIP', keluar.length === 2, String(keluar.length))
  cek('14.2: nama entri dipertahankan apa adanya', keluar[0].nama === 'partitur/L1_Pembuka.musicxml' && keluar[1].nama === 'partitur/manifest.json', keluar.map((k) => k.nama).join(','))
  cek('14.3: bita MusicXML identik setelah round-trip', samaBita(keluar[0].bita, isi))
  const kembali = JSON.parse(keluar[1].teks())
  cek('14.4: manifest bisa dibaca lagi', kembali.lagu?.[0]?.songId === 'L1' && kembali.lagu?.[0]?.namaFile === 'Pembuka.musicxml', JSON.stringify(kembali))
  cek('14.5: hash di manifest cocok dengan bita hasil ekstraksi', kembali.lagu?.[0]?.hash === (await hitungHashAudio(keluar[0].bita)))
  cek('14.6: entri hasil ekstraksi tetap dikenali sebagai MusicXML', deteksiPartitur(keluar[0].bita).ya === true)
}

/* =============================== 15. Hash ============================== */

{
  const a = bita(MS4)
  const ha = await hitungHashAudio(a)
  cek('15.1: hash stabil untuk bita yang sama', ha === (await hitungHashAudio(bita(MS4))))
  cek('15.2: hash berubah karena satu karakter berbeda', ha !== (await hitungHashAudio(bita(MS4.replace('Dewi Lestari', 'Dewi Lestarii')))))
  cek('15.3: hash berbentuk SHA-256 hex 64 huruf', /^[0-9a-f]{64}$/.test(ha), ha)
  cek('15.4: ArrayBuffer & Uint8Array menghasilkan hash yang sama', (await hitungHashAudio(a.buffer)) === ha)
}

console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) {
  console.log('GAGAL:\n' + gagal.map((g) => ` ✗ ${g}`).join('\n'))
  process.exit(1)
}
