/**
 * #11c — Partitur per instrumen/section & cetak HTML murni hex: uji logika murni
 * (§7.1 `RANCANGAN-11c-PARTITUR-PART-CETAK.md`).
 *
 * Menguji `src/lib/partiturBagian.ts` dan `src/lib/partiturCetak.ts` langsung di
 * Node tanpa peramban:
 *   1. Klasifikasi instrumen dwibahasa (Inggris + Indonesia + singkatan MuseScore/Sibelius/Finale)
 *      dan ekstraksi nomor suara (`Trumpet in Bb 2`, `Tpt. II`, `2nd Clarinet`, vs rentang `1-5`).
 *   2. Penanganan istilah ambigu (anti salah-kamar: `Baritone Sax`, `Tenor Sax`, `Bass Clarinet`,
 *      `Bass Drum`, `Electric Bass`, `Drumset`).
 *   3. Pengelompokan ke `SectionDef[]` dinamis tim (`percussion` → `Battery`, seksi kustom `Pianika`,
 *      `woodwind` tersembunyi tetap muncul bila ada di skor, dan part asing → `Part lainnya`).
 *   4. Pilihan awal cerdas anggota (`pilihFilterAwalAnggota`): tanpa nama, cocok instrumen tunggal,
 *      cocok instrumen jamak, cocok nomor suara spesifik, jatuh ke kelompok seksi, & jatuh ramah
 *      ke `Full score` untuk anggota `Color Guard` / `FC`.
 *   5. Penyimpanan preferensi filter per lagu (batas FIFO 50 lagu & validasi ulang saat skor berubah).
 *   6. Pembangkit HTML cetak murni hex (`partiturCetak.ts`): injeksi `viewBox` SVG VexFlow, pembersihan
 *      `oklch()` / `color-mix()`, aturan `@page` untuk `A4_P` / `A4_L` / `A5_L`, `.no-print`, pelolosan
 *      karakter khusus HTML, dan nama berkas bersih bergaya pintu #7.
 *
 * Pakai: bash qa/bangun-logika.sh && node qa/partitur-bagian-logika.mjs
 */
import {
  bacaFilterPartiturTersimpan,
  bacaNomorSuara,
  daftarIdPartAktif,
  kelompokkanPartSkor,
  kenaliInstrumen,
  labelFilterPartitur,
  normalisasiTeksInstrumen,
  pilihFilterAwalAnggota,
  samaFilterPartitur,
  sesuaikanFilterKePartSkor,
  simpanFilterPartitur,
} from '/tmp/partiturBagian.mjs'
import {
  SPESIFIKASI_KERTAS_PARTITUR,
  htmlCetakPartitur,
  kertasBawaanUntukJumlahPart,
  namaBerkasCetakPartitur,
  siapkanSvgHalamanCetak,
  zoomUntukSkalaCetak,
} from '/tmp/partiturCetak.mjs'

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

/* --------- 1. Normalisasi, nomor suara, & kamus dwibahasa ---------------- */

cek(
  'normalisasi membuang keterangan transposisi in Bb / in F & merapikan singkatan bertitik',
  normalisasiTeksInstrumen('Trumpet in Bb 1') === 'trumpet 1' &&
    normalisasiTeksInstrumen('F Horn (in F)') === 'f horn' &&
    normalisasiTeksInstrumen('S.D.') === 'sd' &&
    normalisasiTeksInstrumen('B.D.') === 'bd',
)

cek('bacaNomorSuara mengenali angka Arab di akhir', bacaNomorSuara('Trumpet in Bb 2') === 2)
cek('bacaNomorSuara mengenali angka Romawi (Tpt. III → 3)', bacaNomorSuara('Tpt. III') === 3)
cek('bacaNomorSuara mengenali urutan Inggris (2nd Clarinet → 2)', bacaNomorSuara('2nd Clarinet') === 2)
cek('bacaNomorSuara mengembalikan null untuk instrumen tanpa nomor', bacaNomorSuara('Mellophone') === null)
cek(
  'bacaNomorSuara mengembalikan null untuk rentang suara gabungan (Bass Drum 1-5 & Flute 1/2)',
  bacaNomorSuara('Bass Drum 1-5') === null && bacaNomorSuara('Flute 1/2') === null,
)

// Brass (Inggris, Indonesia, singkatan)
for (const [nama, singkat, harapkanKanon] of [
  ['Trumpet in Bb 1', 'Tpt. 1', 'trumpet'],
  ['Terompet 2', '', 'trumpet'],
  ['Cornet', 'Crnt.', 'cornet'],
  ['Flugelhorn', 'Flgh.', 'flugelhorn'],
  ['Mellophone', 'Mello.', 'mellophone'],
  ['Melofon', '', 'mellophone'],
  ['French Horn in F', 'Hn.', 'horn'],
  ['Trombone 1', 'Tbn. 1', 'trombone'],
  ['Trombon', '', 'trombone'],
  ['Baritone', 'Bar.', 'baritone'],
  ['Euphonium', 'Euph.', 'euphonium'],
  ['Tuba', '', 'tuba'],
  ['Sousaphone', 'Sousa', 'tuba'],
  ['Contrabass Bugle', 'Contra', 'tuba'],
]) {
  const h = kenaliInstrumen(nama, singkat)
  cek(
    `kamus Brass: "${nama}" → brass (${harapkanKanon})`,
    h.keluarga === 'brass' && h.kanon === harapkanKanon,
    JSON.stringify(h),
  )
}

// Woodwind
for (const [nama, singkat, harapkanKanon] of [
  ['Piccolo', 'Picc.', 'piccolo'],
  ['Flute 1', 'Fl. 1', 'flute'],
  ['Suling', '', 'flute'],
  ['Clarinet in Bb', 'Cl.', 'clarinet'],
  ['Klarinet 1', '', 'clarinet'],
  ['Alto Saxophone', 'A. Sax.', 'alto-sax'],
  ['Soprano Sax', 'S. Sax.', 'soprano-sax'],
  ['Bassoon', 'Bsn.', 'bassoon'],
  ['Rekorder', '', 'recorder'],
]) {
  const h = kenaliInstrumen(nama, singkat)
  cek(
    `kamus Woodwind: "${nama}" → woodwind (${harapkanKanon})`,
    h.keluarga === 'woodwind' && h.kanon === harapkanKanon,
    JSON.stringify(h),
  )
}

// Battery (percussion)
for (const [nama, singkat, harapkanKanon] of [
  ['Marching Snare', 'S.D.', 'snare'],
  ['Senar', '', 'snare'],
  ['Tenor Drums', 'Quads', 'tenor-drum'],
  ['Quints', '', 'tenor-drum'],
  ['Timotom', '', 'tenor-drum'],
  ['Marching Bass Drums', 'B.D.', 'bass-drum'],
  ['Marching Cymbals', 'Cym.', 'cymbal'],
  ['Simbal', '', 'cymbal'],
]) {
  const h = kenaliInstrumen(nama, singkat)
  cek(
    `kamus Battery: "${nama}" → percussion (${harapkanKanon})`,
    h.keluarga === 'percussion' && h.kanon === harapkanKanon,
    JSON.stringify(h),
  )
}

// Pit (front ensemble)
for (const [nama, singkat, harapkanKanon] of [
  ['Marimba 1', 'Mba. 1', 'marimba'],
  ['Vibraphone', 'Vib.', 'vibraphone'],
  ['Xylophone', 'Xyl.', 'xylophone'],
  ['Glockenspiel', 'Glock.', 'glockenspiel'],
  ['Bell Lyra', '', 'glockenspiel'],
  ['Belira 1', '', 'glockenspiel'],
  ['Tubular Bells', 'Chimes', 'chimes'],
  ['Timpani', 'Timp.', 'timpani'],
  ['Synthesizer', 'Synth', 'synth'],
  ['Pianika', '', 'pianika'],
  ['Melodica', '', 'pianika'],
  ['Aux Percussion', 'Rack', 'aux-percussion'],
]) {
  const h = kenaliInstrumen(nama, singkat)
  cek(
    `kamus Pit: "${nama}" → pit (${harapkanKanon})`,
    h.keluarga === 'pit' && h.kanon === harapkanKanon,
    JSON.stringify(h),
  )
}

/* --------- 2. Anti salah-kamar pada istilah instrumen ambigu ------------- */

const bariSax = kenaliInstrumen('Baritone Saxophone', 'B. Sax.')
cek(
  'ambigu: Baritone Saxophone masuk woodwind (bukan brass)',
  bariSax.keluarga === 'woodwind' && bariSax.kanon === 'bari-sax',
  JSON.stringify(bariSax),
)

const bariSaxSingkat = kenaliInstrumen('Bari Sax')
cek(
  'ambigu: Bari Sax masuk woodwind (bukan brass)',
  bariSaxSingkat.keluarga === 'woodwind' && bariSaxSingkat.kanon === 'bari-sax',
)

const tenorSax = kenaliInstrumen('Tenor Saxophone', 'T. Sax.')
cek(
  'ambigu: Tenor Saxophone masuk woodwind (bukan percussion/tenor drum)',
  tenorSax.keluarga === 'woodwind' && tenorSax.kanon === 'tenor-sax',
  JSON.stringify(tenorSax),
)

const bassCl = kenaliInstrumen('Bass Clarinet', 'B. Cl.')
cek(
  'ambigu: Bass Clarinet masuk woodwind (bukan bass drum)',
  bassCl.keluarga === 'woodwind' && bassCl.kanon === 'bass-clarinet',
)

const elBass = kenaliInstrumen('Electric Bass')
cek(
  'ambigu: Electric Bass masuk pit (bukan battery)',
  elBass.keluarga === 'pit' && elBass.kanon === 'electric-bass',
)

const drumset = kenaliInstrumen('Drum Set', 'D. Set')
cek(
  'ambigu: Drum Set masuk pit (bukan marching snare)',
  drumset.keluarga === 'pit' && drumset.kanon === 'drumset',
)

const singkatanSaja = kenaliInstrumen('Part 1', 'Tpt. 1')
cek(
  'bila nama generik ("Part 1"), singkatan "Tpt. 1" tetap dikenali sebagai trumpet',
  singkatanSaja.keluarga === 'brass' && singkatanSaja.kanon === 'trumpet' && singkatanSaja.nomorSuara === 1,
)

/* -------- 3. Pemetaan ke SectionDef[] dinamis & tersembunyi -------------- */

const SECTIONS_BAWAAN = [
  { id: 'brass', label: 'Brass', short: 'BR', dot: '#f59e0b', hidden: 0 },
  { id: 'woodwind', label: 'Woodwind', short: 'WW', dot: '#38bdf8', hidden: 1 },
  { id: 'percussion', label: 'Battery', short: 'PC', dot: '#fb7185', hidden: 0 },
  { id: 'pit', label: 'Pit', short: 'PT', dot: '#a78bfa', hidden: 0 },
  { id: 'guard', label: 'Color Guard', short: 'CG', dot: '#34d399', hidden: 0 },
  { id: 'fc', label: 'FC', short: 'FC', dot: '#f472b6', hidden: 0 },
]

const PARTS_SKOR_LENGKAP = [
  { id: 'P1', nama: 'Trumpet 1', singkatan: 'Tpt. 1' },
  { id: 'P2', nama: 'Trumpet 2', singkatan: 'Tpt. 2' },
  { id: 'P3', nama: 'Mellophone', singkatan: 'Mello.' },
  { id: 'P4', nama: 'Clarinet in Bb', singkatan: 'Cl.' },
  { id: 'P5', nama: 'Snare Drum', singkatan: 'S.D.' },
  { id: 'P6', nama: 'Tenor Drums', singkatan: 'Quads' },
  { id: 'P7', nama: 'Marimba', singkatan: 'Mba.' },
  { id: 'P8', nama: 'Paduan Suara', singkatan: 'Choir' },
]

const kelompok = kelompokkanPartSkor(PARTS_SKOR_LENGKAP, SECTIONS_BAWAAN)
cek('kelompokkanPartSkor menghasilkan 5 kelompok sesuai isi skor', kelompok.length === 5, String(kelompok.length))
cek(
  'kelompok Brass menghimpun P1, P2, P3 dengan warna hex #f59e0b',
  kelompok[0]?.id === 'brass' &&
    kelompok[0]?.partIds.join(',') === 'P1,P2,P3' &&
    kelompok[0]?.warnaHex === '#f59e0b',
)
cek(
  'kelompok Woodwind tetap muncul meski hidden: 1 di pengaturan tim agar Clarinet tidak hilang',
  kelompok.some((k) => k.id === 'woodwind' && k.partIds.join(',') === 'P4'),
)
cek(
  'percussion dipetakan tepat ke id "percussion" berlabel "Battery"',
  kelompok.some(
    (k) => k.id === 'percussion' && k.label === 'Battery' && k.partIds.join(',') === 'P5,P6',
  ),
)
cek(
  'part di luar 4 keluarga (Paduan Suara) ditampung di kelompok "lainnya"',
  kelompok.some((k) => k.id === 'lainnya' && k.partIds.join(',') === 'P8'),
)

// Seksi kustom buatan pelatih (mis. unit SD dengan seksi khusus Pianika & Belira)
const SECTIONS_KUSTOM = [
  { id: 'pianika', label: 'Barisan Pianika', short: 'PN', dot: '#22c55e', hidden: 0 },
  { id: 'belira', label: 'Belira', short: 'BL', dot: '#eab308', hidden: 0 },
  { id: 'perkusi', label: 'Perkusi Lapangan', short: 'PK', dot: '#ef4444', hidden: 0 },
]
const kelompokKustom = kelompokkanPartSkor(
  [
    { id: 'P1', nama: 'Pianika 1' },
    { id: 'P2', nama: 'Pianika 2' },
    { id: 'P3', nama: 'Belira' },
    { id: 'P4', nama: 'Snare Drum' },
  ],
  SECTIONS_KUSTOM,
)
cek(
  'seksi kustom "pianika" dan "belira" dikenali langsung dari SectionDef tim',
  kelompokKustom.some((k) => k.id === 'pianika' && k.partIds.join(',') === 'P1,P2') &&
    kelompokKustom.some((k) => k.id === 'belira' && k.partIds.join(',') === 'P3') &&
    kelompokKustom.some((k) => k.id === 'perkusi' && k.partIds.join(',') === 'P4'),
  JSON.stringify(kelompokKustom),
)

/* -------- 4. Pilihan awal cerdas anggota (pilihFilterAwalAnggota) -------- */

const awalTanpaNama = pilihFilterAwalAnggota(PARTS_SKOR_LENGKAP, null, SECTIONS_BAWAAN)
cek(
  'tanpa anggota terpilih → Full score tanpa keterangan tambahan',
  awalTanpaNama.filter.jenis === 'semua' && awalTanpaNama.keterangan === null,
)

const awalTrumpetUmum = pilihFilterAwalAnggota(
  PARTS_SKOR_LENGKAP,
  { name: 'Andra Pratama', section: 'brass', instrument: 'Trumpet' },
  SECTIONS_BAWAAN,
)
cek(
  'anggota berinstrumen "Trumpet" otomatis mendapat kedua part Trumpet (P1 & P2)',
  awalTrumpetUmum.filter.jenis === 'instrumen' &&
    awalTrumpetUmum.filter.partIds.join(',') === 'P1,P2' &&
    /Trumpet/i.test(awalTrumpetUmum.keterangan ?? ''),
  JSON.stringify(awalTrumpetUmum),
)

const awalTrumpet2 = pilihFilterAwalAnggota(
  PARTS_SKOR_LENGKAP,
  { name: 'Dede', section: 'brass', instrument: 'Trumpet 2' },
  SECTIONS_BAWAAN,
)
cek(
  'anggota berinstrumen spesifik "Trumpet 2" otomatis mendapat tepat part P2',
  awalTrumpet2.filter.jenis === 'part' && awalTrumpet2.filter.partId === 'P2',
  JSON.stringify(awalTrumpet2),
)

const awalQuad = pilihFilterAwalAnggota(
  PARTS_SKOR_LENGKAP,
  { name: 'Kirana Ayu', section: 'percussion', instrument: 'Quad' },
  SECTIONS_BAWAAN,
)
cek(
  'anggota berinstrumen "Quad" otomatis cocok dengan part "Tenor Drums" (P6)',
  awalQuad.filter.jenis === 'part' && awalQuad.filter.partId === 'P6',
  JSON.stringify(awalQuad),
)

const awalJatuhKeSeksi = pilihFilterAwalAnggota(
  PARTS_SKOR_LENGKAP,
  { name: 'Eka Wulandari', section: 'brass', instrument: 'Tuba' },
  SECTIONS_BAWAAN,
)
cek(
  'bila part Tuba tidak ada di skor, anggota Brass jatuh ke kelompok Brass (P1,P2,P3)',
  awalJatuhKeSeksi.filter.jenis === 'kelompok' &&
    awalJatuhKeSeksi.filter.kelompokId === 'brass' &&
    awalJatuhKeSeksi.filter.partIds.join(',') === 'P1,P2,P3' &&
    /Tuba.*Brass/i.test(awalJatuhKeSeksi.keterangan ?? ''),
  JSON.stringify(awalJatuhKeSeksi),
)

const awalColorGuard = pilihFilterAwalAnggota(
  PARTS_SKOR_LENGKAP,
  { name: 'Putri Ramadhani', section: 'guard', instrument: 'Flag' },
  SECTIONS_BAWAAN,
)
cek(
  'anggota Color Guard tetap mendapat Full score dengan keterangan ramah (tanpa kosong/galat)',
  awalColorGuard.filter.jenis === 'semua' &&
    /Color Guard/i.test(awalColorGuard.keterangan ?? ''),
  JSON.stringify(awalColorGuard),
)

/* -------- 5. Validasi ulang & penyimpanan FIFO 50 lagu ------------------- */

cek(
  'daftarIdPartAktif mengembalikan null untuk Full score & daftar ID sah untuk filter part',
  daftarIdPartAktif({ jenis: 'semua' }, PARTS_SKOR_LENGKAP) === null &&
    daftarIdPartAktif({ jenis: 'part', partId: 'P5', label: 'Snare' }, PARTS_SKOR_LENGKAP)?.join(',') === 'P5',
)
cek(
  'sesuaikanFilterKePartSkor menjatuhkan filter usang (P99) kembali ke Full score',
  sesuaikanFilterKePartSkor({ jenis: 'part', partId: 'P99', label: 'Lama' }, PARTS_SKOR_LENGKAP).jenis === 'semua',
)
cek(
  'labelFilterPartitur & samaFilterPartitur konsisten',
  labelFilterPartitur({ jenis: 'semua' }, 8) === 'Full Score (8 part)' &&
    samaFilterPartitur(
      { jenis: 'kelompok', kelompokId: 'brass', label: 'Brass', partIds: ['P1', 'P2'] },
      { jenis: 'kelompok', kelompokId: 'brass', label: 'Brass', partIds: ['P1', 'P2'] },
    ) === true,
)

const memStorage = (() => {
  const m = new Map()
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
  }
})()

for (let i = 1; i <= 55; i += 1) {
  simpanFilterPartitur(
    `song_${i}`,
    { jenis: 'part', partId: `P${i}`, label: `Part ${i}` },
    memStorage,
  )
}
cek(
  'simpanFilterPartitur membatasi maksimal 50 lagu secara FIFO (song_1..5 terbuang, song_6..55 utuh)',
  bacaFilterPartiturTersimpan('song_1', memStorage) === null &&
    bacaFilterPartiturTersimpan('song_5', memStorage) === null &&
    bacaFilterPartiturTersimpan('song_6', memStorage)?.partId === 'P6' &&
    bacaFilterPartiturTersimpan('song_55', memStorage)?.partId === 'P55',
)

/* -------- 6. Pembangkit HTML cetak murni hex (partiturCetak.ts) ---------- */

cek(
  'kertasBawaanUntukJumlahPart memilih A4_P untuk 1–3 part dan A4_L untuk >= 4 part',
  kertasBawaanUntukJumlahPart(1) === 'A4_P' &&
    kertasBawaanUntukJumlahPart(3) === 'A4_P' &&
    kertasBawaanUntukJumlahPart(4) === 'A4_L' &&
    kertasBawaanUntukJumlahPart(10) === 'A4_L',
)

cek(
  'zoomUntukSkalaCetak merapatkan skala sedikit pada ukuran A5_L (Buku Saku/Lyre)',
  zoomUntukSkalaCetak('normal', 'A5_L') < zoomUntukSkalaCetak('normal', 'A4_P') &&
    zoomUntukSkalaCetak('padat', 'A4_P') < zoomUntukSkalaCetak('besar', 'A4_P'),
)

const svgTanpaViewBox =
  '<svg id="osmdSvgPage1" width="794" height="1123" style="width: 794px; background-color: oklch(0.99 0 0);"><path d="M0 0 L10 10" stroke="color-mix(in srgb, #000 80%, #fff)"/></svg>'
const svgSiap = siapkanSvgHalamanCetak(svgTanpaViewBox)
cek(
  'siapkanSvgHalamanCetak menyuntikkan viewBox="0 0 794 1123" saat belum ada',
  svgSiap.includes('viewBox="0 0 794 1123"'),
  svgSiap,
)
cek(
  'siapkanSvgHalamanCetak mengatur style responsif width:100%;height:auto & membersihkan oklch/color-mix',
  svgSiap.includes('width:100%;height:auto;display:block;background:#ffffff;') &&
    !/oklch\(|color-mix\(/i.test(svgSiap),
  svgSiap,
)

const svgSudahViewBox = '<svg viewBox="0 0 500 700" width="500" height="700"><g/></svg>'
cek(
  'siapkanSvgHalamanCetak mempertahankan viewBox asli bila sudah tertulis',
  siapkanSvgHalamanCetak(svgSudahViewBox).includes('viewBox="0 0 500 700"'),
)

for (const ukuran of ['A4_P', 'A4_L', 'A5_L']) {
  const html = htmlCetakPartitur({
    namaTim: 'Gita Bahana <Uji>',
    judulLagu: 'Mars "Fajar" & Senja',
    pengarang: 'Budi Santoso',
    labelBagian: 'Trumpet 1',
    ringkasanMusik: '132 BPM · 4/4 · 16 birama',
    ukuranKertas: ukuran,
    halamanSvg: [
      '<svg width="794" height="1123"><path d="M1 1 L9 9" stroke="#0f172a"/></svg>',
      '<svg width="794" height="1123"><path d="M2 2 L8 8" stroke="#0f172a"/></svg>',
    ],
    dicetakPada: '24 Okt 2026',
  })

  cek(
    `htmlCetakPartitur (${ukuran}): dokumen <!doctype html> mandiri bebas oklch() & color-mix()`,
    html.startsWith('<!doctype html>') && !/oklch\(|color-mix\(/i.test(html),
  )
  cek(
    `htmlCetakPartitur (${ukuran}): memuat aturan @page ${SPESIFIKASI_KERTAS_PARTITUR[ukuran].cssPageSize} & 2 lembar halaman`,
    html.includes(`size: ${SPESIFIKASI_KERTAS_PARTITUR[ukuran].cssPageSize};`) &&
      html.includes('data-halaman="1"') &&
      html.includes('data-halaman="2"') &&
      html.includes('Hal. 2 / 2'),
  )
  cek(
    `htmlCetakPartitur (${ukuran}): memuat bilah .no-print dengan tombol window.print() & meloloskan karakter HTML berbahaya`,
    html.includes('class="bilah-atas no-print"') &&
      html.includes('window.print()') &&
      html.includes('Gita Bahana &lt;Uji&gt;') &&
      html.includes('Mars &quot;Fajar&quot; &amp; Senja') &&
      !html.includes('<Uji>'),
  )
}

const namaBerkas = namaBerkasCetakPartitur('Mars: Fajar/Senja?', 'Trumpet 1 *Solo*', 'A5_L')
cek(
  'namaBerkasCetakPartitur membersihkan karakter terlarang sistem berkas dan menyebut ukuran kertas',
  namaBerkas === 'DrillKit - PARTITUR - Mars Fajar Senja - Trumpet 1 Solo (A5 Lyre).html',
  namaBerkas,
)

console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) {
  console.log('GAGAL:\n - ' + gagal.join('\n - '))
  process.exit(1)
}
