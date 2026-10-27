/**
 * #11d — Uji logika murni frasa partitur, sorot birama, *auto-scroll*, dan
 * tautan frasa ↔ set drill (`src/lib/partiturFrasa.ts`).
 *
 * Pakai: bash qa/bangun-logika.sh && node qa/partitur-frasa-logika.mjs
 */
import {
  KUNCI_SIMPAN_FRASA,
  WARNA_SOROT_PARTITUR_HEX,
  bacaSemuaFrasa,
  bacaTautanFrasaBaris,
  biramaPadaProgresSet,
  cariBiramaDariTitikKlik,
  cariKotakBiramaAktif,
  formatLencanaFrasa,
  formatTautanSetBirama,
  frasaAktifSah,
  frasaEfektifUntukLagu,
  gabungKotakFrasaPerBaris,
  gabungRentangSetKeBirama,
  hitungPetaSetKeBirama,
  hitungRentangFrasaSegmen,
  hitungTargetGulirBirama,
  hitunganPadaBirama,
  keUlangBagian,
  kunciTautanSetList,
  petakanKotakBiramaSumber,
  rapikanFrasaLatihan,
  susunFrasaTerurut,
  tulisSemuaFrasa,
} from '/tmp/partiturFrasa.mjs'

let lulus = 0
let gagal = 0

function uji(nama, ok, detail = '') {
  if (ok) {
    lulus++
    console.log('  ✓ ' + nama)
  } else {
    gagal++
    console.log('  ✗ ' + nama + (detail ? ' → ' + detail : ''))
  }
}

function sama(nama, aktual, harap) {
  const a = JSON.stringify(aktual)
  const h = JSON.stringify(harap)
  uji(nama, a === h, `dapat ${a}, harap ${h}`)
}

function bikinPenyimpanPalsu() {
  const isi = new Map()
  return {
    getItem: (k) => (isi.has(k) ? isi.get(k) : null),
    setItem: (k, v) => isi.set(k, String(v)),
  }
}

const EMPAT_EMPAT = {
  pembilang: 4,
  penyebut: 4,
  kelompok: [2, 2],
  acuan: { nilai: 4, titik: false },
}

const ENAM_DELAPAN_TITIK = {
  pembilang: 6,
  penyebut: 8,
  kelompok: [3, 3],
  acuan: { nilai: 4, titik: true },
}

console.log('\n== 1. Palet warna sorot murni hex/rgba (nol oklch / color-mix) ==')
const gabungPalet = Object.values(WARNA_SOROT_PARTITUR_HEX).join(' ')
uji('tidak ada oklch() atau color-mix() di palet sorot', !/oklch\(|color-mix\(/i.test(gabungPalet), gabungPalet)
uji('semua nilai warna berupa #hex atau rgba()', Object.values(WARNA_SOROT_PARTITUR_HEX).every((w) => /^(#[0-9a-f]{6}|rgba\(\d+,\s*\d+,\s*\d+,\s*0\.\d+\))$/i.test(w)))

console.log('\n== 2. Simpanan per perangkat & penyatuan dengan M2 ulangBagian ==')
const simpan = bikinPenyimpanPalsu()
sama('penyimpan kosong → objek kosong', bacaSemuaFrasa(simpan), {})

const fTerurut = susunFrasaTerurut(8, 5, 1, '  Reff Brass  ')
sama('susunFrasaTerurut membalik 8..5 menjadi 5..8 dan memangkas label', fTerurut, {
  dari: 5,
  sampai: 8,
  aktif: 1,
  label: 'Reff Brass',
})

// Input angka M2 tidak membalik otomatis bila diketik terbalik, supaya ulang-tidak-sah tetap jalan.
const fMentahTerbalik = rapikanFrasaLatihan({ dari: 9, sampai: 4, aktif: 1 })
sama('rapikanFrasaLatihan mempertahankan dari > sampai untuk validasi input', fMentahTerbalik, {
  dari: 9,
  sampai: 4,
  aktif: 1,
})
uji('frasaAktifSah menolak rentang terbalik 9..4', !frasaAktifSah(fMentahTerbalik, 16))
uji('frasaAktifSah menolak rentang melebihi panjangBirama', !frasaAktifSah({ dari: 5, sampai: 20, aktif: 1 }, 16))
uji('frasaAktifSah menerima rentang sah 5..8 pada lagu 32 birama', frasaAktifSah(fTerurut, 32))

tulisSemuaFrasa({ lagu_1: fTerurut }, simpan)
uji('kunci localStorage sesuai spesifikasi', simpan.getItem(KUNCI_SIMPAN_FRASA) !== null)
sama('bacaSemuaFrasa memulihkan data utuh', bacaSemuaFrasa(simpan), { lagu_1: fTerurut })

// Prioritas perangkat > song.ulangBagian, dan fallback ke song.ulangBagian bila belum ada di perangkat.
sama(
  'frasaEfektifUntukLagu mengutamakan simpanan perangkat di atas ulangBagian lagu',
  frasaEfektifUntukLagu(bacaSemuaFrasa(simpan), 'lagu_1', { dari: 1, sampai: 2, aktif: 0 }),
  fTerurut,
)
sama(
  'frasaEfektifUntukLagu jatuh ke song.ulangBagian bila perangkat belum menyimpan',
  frasaEfektifUntukLagu(bacaSemuaFrasa(simpan), 'lagu_lama', { dari: 3, sampai: 6, aktif: 1 }),
  { dari: 3, sampai: 6, aktif: 1 },
)
sama('keUlangBagian mengonversi ke struktur M2', keUlangBagian(fTerurut), {
  dari: 5,
  sampai: 8,
  aktif: 1,
})

console.log('\n== 3. Format lencana "Frasa 5–8 · 80%" ==')
sama(
  'frasa aktif 5–8 + tempo latihan 80% → "Frasa 5–8 · 80%"',
  formatLencanaFrasa(
    { dari: 5, sampai: 8, aktif: 1 },
    { mode: 'persen', persen: 80, geser: 0 },
    32,
  ),
  'Frasa 5–8 · 80%',
)
sama(
  'frasa aktif 5–8 + tempo latihan −20 BPM → "Frasa 5–8 · −20 BPM"',
  formatLencanaFrasa(
    { dari: 5, sampai: 8, aktif: 1 },
    { mode: 'bpm', persen: 100, geser: -20 },
    32,
  ),
  'Frasa 5–8 · −20 BPM',
)
sama(
  'frasa aktif 5–8 pada tempo asli 100% → "Frasa 5–8"',
  formatLencanaFrasa(
    { dari: 5, sampai: 8, aktif: 1 },
    { mode: 'persen', persen: 100, geser: 0 },
    32,
  ),
  'Frasa 5–8',
)
sama(
  'frasa 1 birama (birama 12) + 75% → "Frasa 12 · 75%"',
  formatLencanaFrasa(
    { dari: 12, sampai: 12, aktif: 1 },
    { mode: 'persen', persen: 75, geser: 0 },
  ),
  'Frasa 12 · 75%',
)
sama(
  'frasa tersimpan tetapi aktif: 0 → null (lencana disembunyikan)',
  formatLencanaFrasa({ dari: 5, sampai: 8, aktif: 0 }, { mode: 'persen', persen: 80, geser: 0 }),
  null,
)

console.log('\n== 4. Pemetaan kotak birama: pickup 0, multi-rest, klik, & pita baris ==')
// Skor dengan pickup (bar 0) + 12 birama:
// Baris 1 (y=40): bar 0..4; Baris 2 (y=200): bar 5..8; Baris 3 (y=360): bar 9..12 terlipat multi-rest 4 birama!
const daftarSumber = [
  { indeksUrut: 0, nomorBiramaXml: 0, idGrafis: '0' },
  { indeksUrut: 1, nomorBiramaXml: 1, idGrafis: '1' },
  { indeksUrut: 2, nomorBiramaXml: 2, idGrafis: '2' },
  { indeksUrut: 3, nomorBiramaXml: 3, idGrafis: '3' },
  { indeksUrut: 4, nomorBiramaXml: 4, idGrafis: '4' },
  { indeksUrut: 5, nomorBiramaXml: 5, idGrafis: '5' },
  { indeksUrut: 6, nomorBiramaXml: 6, idGrafis: '6' },
  { indeksUrut: 7, nomorBiramaXml: 7, idGrafis: '7' },
  { indeksUrut: 8, nomorBiramaXml: 8, idGrafis: '8' },
  { indeksUrut: 9, nomorBiramaXml: 9, idGrafis: '9', jumlahMultiRest: 4 },
  { indeksUrut: 10, nomorBiramaXml: 10, idGrafis: null },
  { indeksUrut: 11, nomorBiramaXml: 11, idGrafis: null },
  { indeksUrut: 12, nomorBiramaXml: 12, idGrafis: null },
]
const petaGrafis = new Map([
  ['0', { x: 20, y: 40, lebar: 80, tinggi: 90 }],
  ['1', { x: 100, y: 40, lebar: 150, tinggi: 90 }],
  ['2', { x: 250, y: 40, lebar: 150, tinggi: 90 }],
  ['3', { x: 400, y: 40, lebar: 150, tinggi: 90 }],
  ['4', { x: 550, y: 40, lebar: 150, tinggi: 90 }],
  ['5', { x: 20, y: 200, lebar: 170, tinggi: 90 }],
  ['6', { x: 190, y: 200, lebar: 170, tinggi: 90 }],
  ['7', { x: 360, y: 200, lebar: 170, tinggi: 90 }],
  ['8', { x: 530, y: 200, lebar: 170, tinggi: 90 }],
  ['9', { x: 20, y: 360, lebar: 680, tinggi: 90 }],
])

const kotakTerpeta = petakanKotakBiramaSumber(daftarSumber, petaGrafis)
sama('seluruh 13 source measure (0..12) mendapat kotak piksel', kotakTerpeta.length, 13)
sama('pickup birama 0 tidak menggeser birama 5', cariKotakBiramaAktif(kotakTerpeta, 5)?.x, 20)
const sorotBar11 = cariKotakBiramaAktif(kotakTerpeta, 11)
sama('birama 11 di tengah istirahat multi-birama 9–12 meminjam kotak grafis bar 9', {
  x: sorotBar11?.x,
  y: sorotBar11?.y,
  lebar: sorotBar11?.lebar,
  rentangMultiRest: sorotBar11?.rentangMultiRest,
}, {
  x: 20,
  y: 360,
  lebar: 680,
  rentangMultiRest: [9, 12],
})

// Hit-test klik langsung, toleransi angka birama di atas paranada, dan multi-rest.
sama('klik di tengah birama 6 mengenai birama 6', cariBiramaDariTitikKlik(kotakTerpeta, 240, 230)?.birama, 6)
sama('klik 10 px di atas garis atas birama 5 masih mengenai birama 5', cariBiramaDariTitikKlik(kotakTerpeta, 60, 190)?.birama, 5)
const klikMulti = cariBiramaDariTitikKlik(kotakTerpeta, 300, 395)
sama('klik pada kotak multi-rest mengembalikan pembuka rentang beserta rentangMultiRest', {
  birama: klikMulti?.birama,
  rentangMultiRest: klikMulti?.rentangMultiRest,
}, {
  birama: 9,
  rentangMultiRest: [9, 12],
})
sama('klik jauh di luar skor mengembalikan null', cariBiramaDariTitikKlik(kotakTerpeta, 1200, 900), null)

// Penggabungan pita sorot per baris sistem: Frasa 4–6 melintasi akhir baris 1 (bar 4) dan awal baris 2 (bar 5–6).
const pita46 = gabungKotakFrasaPerBaris(kotakTerpeta, 4, 6)
sama('frasa lintas baris menghasilkan 2 pita bersih (1 per sistem)', pita46, [
  { x: 550, y: 40, lebar: 150, tinggi: 90 },
  { x: 20, y: 200, lebar: 340, tinggi: 90 },
])
const pita58 = gabungKotakFrasaPerBaris(kotakTerpeta, 5, 8)
sama('frasa 5–8 satu baris menyatu menjadi 1 pita utuh', pita58, [
  { x: 20, y: 200, lebar: 680, tinggi: 90 },
])

console.log('\n== 5. Auto-scroll pintar (diam bila sudah di zona nyaman) ==')
sama(
  'vertikal: birama di tengah layar (y=200 pada scrollTop=100, tinggi=420) tidak memicu gulir',
  hitungTargetGulirBirama(
    { x: 20, y: 200, lebar: 170, tinggi: 90 },
    { scrollTop: 100, scrollLeft: 0, clientHeight: 420, clientWidth: 800 },
    'vertikal',
  ),
  null,
)
sama(
  'vertikal: birama turun ke y=620 di bawah layar memicu gulir mulus',
  hitungTargetGulirBirama(
    { x: 20, y: 620, lebar: 170, tinggi: 90 },
    { scrollTop: 100, scrollLeft: 0, clientHeight: 400, clientWidth: 800 },
    'vertikal',
  ),
  { top: 540 },
)
sama(
  'mendatar: birama melewati tepi kanan menggulir scrollLeft ke depan',
  hitungTargetGulirBirama(
    { x: 920, y: 40, lebar: 180, tinggi: 90 },
    { scrollTop: 0, scrollLeft: 100, clientHeight: 320, clientWidth: 800 },
    'mendatar',
  ),
  { left: 744 },
)

console.log('\n== 6. Segmen lagu & Tautan Frasa ↔ Set Drill ("Set 4–6 = Bar 9–16") ==')
const daftarFrasaSegmen = hitungRentangFrasaSegmen(
  [
    { id: 's1', label: 'Intro', measure: 1, bpm: 120 },
    { id: 's2', label: 'Frase A', measure: 5, bpm: 120 },
    { id: 's3', label: 'Reff', measure: 9, bpm: 132 },
  ],
  16,
)
sama('hitungRentangFrasaSegmen menurunkan rentang inklusif tiap segmen', daftarFrasaSegmen, [
  { id: 's1', label: 'Intro', dari: 1, sampai: 4, bpm: 120 },
  { id: 's2', label: 'Frase A', dari: 5, sampai: 8, bpm: 120 },
  { id: 's3', label: 'Reff', dari: 9, sampai: 16, bpm: 132 },
])

// Lagu 4/4 (beatsPerCount = 1 → 4 hitungan = 1 birama):
// Set 1 = 8 hitungan (Bar 1–2)
// Set 2 = 8 hitungan (Bar 3–4)
// Set 3 = 16 hitungan (Bar 5–8)
// Set 4 = 8 hitungan (Bar 9–10)
// Set 5 = 16 hitungan (Bar 11–14)
// Set 6 = 8 hitungan (Bar 15–16)
const setDrill = [
  { counts: 8, name: 'Set 1' },
  { counts: 8, name: 'Set 2' },
  { counts: 16, name: 'Set 3' },
  { counts: 8, name: 'Set 4' },
  { counts: 16, name: 'Set 5' },
  { counts: 8, name: 'Set 6' },
]
const lagu44 = {
  bpm: 120,
  tandaBirama: EMPAT_EMPAT,
  tempoMap: [],
  latih: null,
}
const petaSet = hitungPetaSetKeBirama(setDrill, lagu44, { beatsPerCount: 1 })
sama(
  'setiap set drill terpetakan ke birama bulat inklusif yang tepat',
  petaSet.map((s) => `${s.nomorSet}:${s.biramaDari}-${s.biramaSampai}`),
  ['1:1-2', '2:3-4', '3:5-8', '4:9-10', '5:11-14', '6:15-16'],
)
const tautan46 = gabungRentangSetKeBirama(petaSet, 4, 6)
sama('gabungRentangSetKeBirama(4, 6) menghasilkan Set 4–6 = Bar 9–16', tautan46, {
  setAwal: 4,
  setAkhir: 6,
  biramaDari: 9,
  biramaSampai: 16,
})
sama('formatTautanSetBirama merangkai "Set 4–6 = Bar 9–16"', formatTautanSetBirama(tautan46), 'Set 4–6 = Bar 9–16')
sama('formatTautanSetBirama untuk 1 set tunggal', formatTautanSetBirama({ setAwal: 3, setAkhir: 3, biramaDari: 5, biramaSampai: 8 }), 'Set 3 = Bar 5–8')

// Kunci baris set list mendukung lagu unik maupun lagu berulang.
const petaTautan = {
  [kunciTautanSetList(1, 'lagu_a')]: { setAwal: 4, setAkhir: 6, biramaDari: 9, biramaSampai: 16 },
  lagu_b: { setAwal: 1, setAkhir: 2, biramaDari: 1, biramaSampai: 4 },
}
sama('bacaTautanFrasaBaris menemukan kunci berindeks', bacaTautanFrasaBaris(petaTautan, 1, 'lagu_a')?.biramaDari, 9)
sama('bacaTautanFrasaBaris jatuh ke songId murni', bacaTautanFrasaBaris(petaTautan, 0, 'lagu_b')?.biramaSampai, 4)

console.log('\n== 7. Sinkron progres animasi DrillEditor ↔ birama TempoTimeline ==')
// Set 5 (indeks 4) berjalan dari Bar 11.0 sampai 15.0 (16 hitungan = 4 birama):
// p = 0.0 -> bar 11; p = 0.5 -> bar 13; p = 0.8 -> bar 14.
sama('awal Set 5 (p=0) berada di birama 11', biramaPadaProgresSet(setDrill, lagu44, 4, 0, { beatsPerCount: 1 }), 11)
sama('tengah Set 5 (p=0.5) berada di birama 13', biramaPadaProgresSet(setDrill, lagu44, 4, 0.5, { beatsPerCount: 1 }), 13)
sama('akhir Set 5 (p=0.85) berada di birama 14', biramaPadaProgresSet(setDrill, lagu44, 4, 0.85, { beatsPerCount: 1 }), 14)

// Kebalikannya: klik Bar 9 di partitur -> hitungan ke-32 (awal Set 4)!
sama('klik birama 9 pada partitur melompat tepat ke hitungan ke-32 (awal Set 4)', hitunganPadaBirama(setDrill, lagu44, 9, { beatsPerCount: 1 }), 32)

// Sukat majemuk 6/8 bertitik (2 ketuk acuan per birama): 8 hitungan (bpc=1) = 4 birama!
const lagu68 = { bpm: 112, tandaBirama: ENAM_DELAPAN_TITIK, tempoMap: [], latih: null }
const peta68 = hitungPetaSetKeBirama([{ counts: 8, name: 'Set 1' }, { counts: 8, name: 'Set 2' }], lagu68, { beatsPerCount: 1 })
sama('sukat 6/8 acuan krotchet bertitik: 8 hitungan = Bar 1–4, berikutnya Bar 5–8', peta68.map((s) => `${s.biramaDari}-${s.biramaSampai}`), ['1-4', '5-8'])

console.log(`\n${lulus} lulus, ${gagal} gagal`)
if (gagal > 0) process.exit(1)
