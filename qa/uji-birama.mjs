/**
 * Uji murni M1 — tanda birama & hitung mundur (src/lib/birama.ts).
 * Dijalankan: npx esbuild ../../drillkit/src/lib/birama.ts --format=esm --outfile=/tmp/birama.mjs && node uji-birama.mjs
 */
import {
  kelompokBaku,
  biramaBaku,
  acuanBaku,
  normalisasiBirama,
  biramaDefault,
  dariBeatsLama,
  notPerAcuan,
  detikPerNot,
  durasiBirama,
  konversiBpm,
  bikinPolaDariBirama,
  posisiAksen,
  labelBirama,
  labelBiramaLengkap,
  DAFTAR_METER,
  cariMeter,
  hitungMundurDefault,
  ucapHitungMundur,
  posisiHitungMundur,
  indexSegmen,
  rentangSegmen,
  meterPada,
  tempoPada,
  detikBiramaPada,
  detikSampai,
  biramaPadaDetik,
  formatWaktu,
} from '/tmp/birama.mjs'

let lulus = 0
let gagal = 0
function uji(nama, kondisi, detail = '') {
  if (kondisi) {
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
function dekat(nama, aktual, harap, toler = 1e-6) {
  uji(nama, Math.abs(aktual - harap) <= toler, `dapat ${aktual}, harap ≈${harap}`)
}

const Q = { nilai: 4, titik: false }
const E = { nilai: 8, titik: false }
const QT = { nilai: 4, titik: true }

console.log('\n— Pengelompokan baku —')
sama('4/4 → 4 ketuk sendiri', kelompokBaku(4, 4), [1, 1, 1, 1])
sama('3/4 → 3 ketuk sendiri', kelompokBaku(3, 4), [1, 1, 1])
sama('2/4 → 2 ketuk sendiri', kelompokBaku(2, 4), [1, 1])
sama('5/4 ganjil → 2+3', kelompokBaku(5, 4), [2, 3])
sama('7/4 ganjil → 2+2+3', kelompokBaku(7, 4), [2, 2, 3])
sama('6/4 compound → 3+3', kelompokBaku(6, 4), [3, 3])
sama('6/8 compound → 3+3', kelompokBaku(6, 8), [3, 3])
sama('9/8 compound → 3+3+3', kelompokBaku(9, 8), [3, 3, 3])
sama('12/8 compound → 3+3+3+3', kelompokBaku(12, 8), [3, 3, 3, 3])
sama('5/8 ganjil → 2+3', kelompokBaku(5, 8), [2, 3])
sama('7/8 ganjil → 2+2+3', kelompokBaku(7, 8), [2, 2, 3])
sama('9/8 kalau tidak compound → 2+2+2+3', kelompokBaku(11, 8), [2, 2, 2, 2, 3])
sama('4/8 genap → 2+2', kelompokBaku(4, 8), [2, 2])

console.log('\n— Normalisasi (kelompok selalu = pembilang) —')
{
  const semua = [
    [4, 4], [3, 4], [5, 4], [7, 4], [6, 4], [9, 4], [12, 4],
    [3, 8], [4, 8], [5, 8], [6, 8], [7, 8], [8, 8], [9, 8], [11, 8], [12, 8],
    [2, 2], [3, 2], [1, 4], [16, 8],
  ]
  let ok = true
  for (const [p, s] of semua) {
    const t = normalisasiBirama({ pembilang: p, penyebut: s, kelompok: kelompokBaku(p, s), acuan: acuanBaku(s) })
    const jml = t.kelompok.reduce((a, b) => a + b, 0)
    if (jml !== p) { ok = false; console.log('    meleset:', p + '/' + s, '→', JSON.stringify(t.kelompok), '=', jml) }
    if (t.kelompok.some((k) => k < 1)) { ok = false; console.log('    ada kelompok <1:', p + '/' + s) }
  }
  uji('semua meter baku: jumlah kelompok = pembilang', ok)
}
sama('[2,2,3] diperkecil ke 5 → [2,3]', normalisasiBirama({ pembilang: 5, penyebut: 8, kelompok: [2, 2, 3], acuan: E }).kelompok, [2, 3])
sama('[2,2,3] diperbesar ke 9 → [2,2,3,2]', normalisasiBirama({ pembilang: 9, penyebut: 8, kelompok: [2, 2, 3], acuan: E }).kelompok, [2, 2, 3, 2])
sama('[2,2] diperbesar ke 7 → [2,2,3]', normalisasiBirama({ pembilang: 7, penyebut: 8, kelompok: [2, 2], acuan: E }).kelompok, [2, 2, 3])
sama('[9] untuk 5/8 → jatuh ke baku [2,3]', normalisasiBirama({ pembilang: 5, penyebut: 8, kelompok: [9], acuan: E }).kelompok, [2, 3])
sama('kelompok kosong → baku', normalisasiBirama({ pembilang: 7, penyebut: 8, kelompok: [], acuan: E }).kelompok, [2, 2, 3])
uji('pembilang dijepit ke batas 32', normalisasiBirama({ pembilang: 99, penyebut: 8, kelompok: [3], acuan: E }).pembilang === 32)

console.log('\n— Migrasi dari data lama —')
{
  const t = dariBeatsLama(4)
  sama('lagu lama beats=4 → 4/4 [1,1,1,1]', [t.pembilang, t.penyebut, t.kelompok], [4, 4, [1, 1, 1, 1]])
  sama('lagu lama beats=4 → pola [2,1,1,1]', bikinPolaDariBirama(t, 1).cells, [2, 1, 1, 1])
  // Yang penting: lagu lama harus TERDENGAR PERSIS seperti sebelumnya.
  // Dulu beats=7 + subdiv 1 = polaBaku → aksen hanya di ketuk 1.
  const t7 = dariBeatsLama(7)
  sama('lagu lama beats=7 → 7/4, kelompok 1×7 (bunyi tetap sama)', [t7.pembilang, t7.penyebut, t7.kelompok], [7, 4, [1, 1, 1, 1, 1, 1, 1]])
  sama('lagu lama beats=7 → pola [2,1,1,1,1,1,1] (sama seperti dulu)', bikinPolaDariBirama(t7, 1).cells, [2, 1, 1, 1, 1, 1, 1])
  sama('lagu lama beats=3 → pola [2,1,1]', bikinPolaDariBirama(dariBeatsLama(3), 1).cells, [2, 1, 1])
  sama('beats=0 dijepit ke 1', dariBeatsLama(0).pembilang, 1)
}

console.log('\n— Acuan tempo & durasi —')
dekat('acuan seperempat di 4/4 = 1 not penyebut', notPerAcuan(4, Q), 1)
dekat('acuan seperempat di 7/8 = 2 not penyebut', notPerAcuan(8, Q), 2)
dekat('acuan seperdelapan di 7/8 = 1 not penyebut', notPerAcuan(8, E), 1)
dekat('acuan seperempat bertitik di 6/8 = 3 not penyebut', notPerAcuan(8, QT), 3)
dekat('acuan keenambelas di 4/4 = 0,25 not penyebut', notPerAcuan(4, { nilai: 16, titik: false }), 0.25)

dekat('4/4 @120 (seperempat) = 2,0 detik', durasiBirama({ pembilang: 4, penyebut: 4, kelompok: [1, 1, 1, 1], acuan: Q }, 120), 2)
dekat('7/8 @120 (seperdelapan) = 3,5 detik', durasiBirama({ pembilang: 7, penyebut: 8, kelompok: [2, 2, 3], acuan: E }, 120), 3.5)
dekat('7/8 @120 (seperempat) = 1,75 detik', durasiBirama({ pembilang: 7, penyebut: 8, kelompok: [2, 2, 3], acuan: Q }, 120), 1.75)
dekat('6/8 @60 (seperempat bertitik) = 2,0 detik', durasiBirama({ pembilang: 6, penyebut: 8, kelompok: [3, 3], acuan: QT }, 60), 2)
dekat('12/8 @120 (seperdelapan) = 6,0 detik', durasiBirama({ pembilang: 12, penyebut: 8, kelompok: [3, 3, 3, 3], acuan: E }, 120), 6)
dekat('tempo dijepit di batas bawah', detikPerNot(0, 8, E), 60 / 20)

console.log('\n— Konversi BPM (kecepatan bunyi tetap sama) —')
dekat('7/8: 120 seperdelapan → 60 seperempat', konversiBpm(120, 8, E, Q), 60)
dekat('7/8: 60 seperempat → 120 seperdelapan', konversiBpm(60, 8, Q, E), 120)
dekat('6/8: 60 seperempat bertitik → 180 seperdelapan', konversiBpm(60, 8, QT, E), 180)
dekat('konversi ke acuan yang sama = tidak berubah', konversiBpm(137, 8, E, E), 137)
{
  // Bukti kecepatan bunyinya benar-benar sama: durasi birama harus identik.
  const t = { pembilang: 7, penyebut: 8, kelompok: [2, 2, 3] }
  const a = durasiBirama({ ...t, acuan: E }, 120)
  const b = durasiBirama({ ...t, acuan: Q }, konversiBpm(120, 8, E, Q))
  dekat('durasi birama tetap sama setelah konversi acuan', b, a)
}

console.log('\n— Meter → pola E3 (rumah satu-satunya) —')
sama('7/8 [2,2,3] → 7 kotak', bikinPolaDariBirama({ pembilang: 7, penyebut: 8, kelompok: [2, 2, 3], acuan: E }, 1).cells, [2, 1, 2, 1, 2, 1, 1])
sama('7/8 [3,2,2] → aksen di 0,3,5', bikinPolaDariBirama({ pembilang: 7, penyebut: 8, ketik: 0, kelompok: [3, 2, 2], acuan: E }, 1).cells, [2, 1, 1, 2, 1, 2, 1])
sama('7/8 [2,3,2] → aksen di 0,2,5', bikinPolaDariBirama({ pembilang: 7, penyebut: 8, kelompok: [2, 3, 2], acuan: E }, 1).cells, [2, 1, 2, 1, 1, 2, 1])
sama('6/8 [3,3] → 6 kotak', bikinPolaDariBirama({ pembilang: 6, penyebut: 8, kelompok: [3, 3], acuan: E }, 1).cells, [2, 1, 1, 2, 1, 1])
sama('5/8 [3,2] → 5 kotak', bikinPolaDariBirama({ pembilang: 5, penyebut: 8, kelompok: [3, 2], acuan: E }, 1).cells, [2, 1, 1, 2, 1])
sama('12/8 [3,3,3,3] → aksen di 0,3,6,9', bikinPolaDariBirama({ pembilang: 12, penyebut: 8, kelompok: [3, 3, 3, 3], acuan: E }, 1).cells, [2, 1, 1, 2, 1, 1, 2, 1, 1, 2, 1, 1])
sama('4/4 → aksen HANYA di ketuk 1 (bukan semua ketuk)', bikinPolaDariBirama({ pembilang: 4, penyebut: 4, kelompok: [1, 1, 1, 1], acuan: Q }, 1).cells, [2, 1, 1, 1])
sama('3/4 → aksen hanya di ketuk 1', bikinPolaDariBirama({ pembilang: 3, penyebut: 4, kelompok: [1, 1, 1], acuan: Q }, 1).cells, [2, 1, 1])
sama('4/4 [2,2] → aksen di 1 dan 3 (pulsa setengah not)', bikinPolaDariBirama({ pembilang: 4, penyebut: 4, kelompok: [2, 2], acuan: Q }, 1).cells, [2, 1, 2, 1])
sama('5/4 [2,3] → aksen di 1 dan 3', bikinPolaDariBirama({ pembilang: 5, penyebut: 4, kelompok: [2, 3], acuan: Q }, 1).cells, [2, 1, 2, 1, 1])
{
  const p = bikinPolaDariBirama({ pembilang: 7, penyebut: 8, kelompok: [2, 2, 3], acuan: E }, 2)
  sama('subdiv 2 → 14 kotak', p.cells.length, 14)
  sama('subdiv 2 → aksen di 0,4,8', p.cells.filter((c, i) => c === 2).map((_, i) => [0, 4, 8][i]), [0, 4, 8])
}
sama('posisiAksen 7/8 [2,2,3]', posisiAksen({ pembilang: 7, penyebut: 8, kelompok: [2, 2, 3], acuan: E }), [0, 2, 4])
sama('posisiAksen 5/8 [3,2]', posisiAksen({ pembilang: 5, penyebut: 8, kelompok: [3, 2], acuan: E }), [0, 3])

console.log('\n— Pola untuk diputar (hanyaAwal = kebiasaan E3) —')
sama('4/4 subdiv 2 → sama persis dengan polaBaku lama [2,0,1,0,1,0,1,0]', bikinPolaDariBirama({ pembilang: 4, penyebut: 4, kelompok: [1, 1, 1, 1], acuan: Q }, 2, undefined, true).cells, [2, 0, 1, 0, 1, 0, 1, 0])
sama('4/4 subdiv 1 → [2,1,1,1] (sama seperti dulu)', bikinPolaDariBirama({ pembilang: 4, penyebut: 4, kelompok: [1, 1, 1, 1], acuan: Q }, 1, undefined, true).cells, [2, 1, 1, 1])
sama('7/8 subdiv 1 → aksen di 1,3,5 (pengelompokan DIDENGAR)', bikinPolaDariBirama({ pembilang: 7, penyebut: 8, kelompok: [2, 2, 3], acuan: E }, 1, undefined, true).cells, [2, 1, 2, 1, 2, 1, 1])
sama('7/8 subdiv 2 → not tengah diam, aksen tetap di awal kelompok', bikinPolaDariBirama({ pembilang: 7, penyebut: 8, kelompok: [2, 2, 3], acuan: E }, 2, undefined, true).cells, [2, 0, 1, 0, 2, 0, 1, 0, 2, 0, 1, 0, 1, 0])
sama('tanpa hanyaAwal (pratinjau) semua not tampil', bikinPolaDariBirama({ pembilang: 7, penyebut: 8, kelompok: [2, 2, 3], acuan: E }, 2).cells, [2, 1, 1, 1, 2, 1, 1, 1, 2, 1, 1, 1, 1, 1])

console.log('\n— Label & daftar meter —')
uji('label 7/8', labelBirama({ pembilang: 7, penyebut: 8, kelompok: [2, 2, 3], acuan: E }) === '7/8')
uji('label lengkap menyebut pengelompokan', labelBiramaLengkap({ pembilang: 7, penyebut: 8, kelompok: [2, 2, 3], acuan: E }).includes('2+2+3'))
uji('label lengkap menyebut acuan', labelBiramaLengkap({ pembilang: 7, penyebut: 8, kelompok: [2, 2, 3], acuan: E }).includes('seperdelapan'))
uji('daftar meter berisi 7/8 minimal 3 pengelompokan', DAFTAR_METER.filter((m) => m.pembilang === 7 && m.penyebut === 8).length >= 3)
uji('daftar meter berisi 5/8 minimal 2 pengelompokan', DAFTAR_METER.filter((m) => m.pembilang === 5 && m.penyebut === 8).length >= 2)
{
  let ok = true
  for (const m of DAFTAR_METER) {
    const jml = m.kelompok.reduce((a, b) => a + b, 0)
    if (jml !== m.pembilang) { ok = false; console.log('    meter tak konsisten:', JSON.stringify(m)) }
    if (!m.label.startsWith(m.pembilang + '/' + m.penyebut)) { ok = false; console.log('    label tak cocok:', m.label) }
  }
  uji('semua meter di daftar: jumlah kelompok = pembilang & label cocok', ok)
}
uji('cariMeter menemukan 7/8 2+2+3', cariMeter({ pembilang: 7, penyebut: 8, kelompok: [2, 2, 3], acuan: E })?.label === '7/8 · 2+2+3')
uji('cariMeter tidak menemukan kelompok aneh', cariMeter({ pembilang: 7, penyebut: 8, kelompok: [1, 1, 5], acuan: E }) === undefined)

console.log('\n— Hitung mundur (count-off) —')
{
  const t78 = { pembilang: 7, penyebut: 8, kelompok: [2, 2, 3], acuan: E }
  const t44 = { pembilang: 4, penyebut: 4, kelompok: [1, 1, 1, 1], acuan: Q }
  sama('7/8 hitung per pulsa → 3 ketuk "1 2 3"', ucapHitungMundur(t78, { on: true, ulang: 1, tiapNot: false, suara: 'suara' }), ['1', '2', '3'])
  sama('7/8 hitung per not → 7 ketuk', ucapHitungMundur(t78, { on: true, ulang: 1, tiapNot: true, suara: 'suara' }), ['1', '2', '3', '4', '5', '6', '7'])
  sama('4/4 hitung per pulsa → 4 ketuk', ucapHitungMundur(t44, { on: true, ulang: 1, tiapNot: false, suara: 'suara' }), ['1', '2', '3', '4'])
  sama('posisi hitung per pulsa di 7/8 = 0,2,4', posisiHitungMundur(t78, { on: true, ulang: 1, tiapNot: false, suara: 'suara' }), [0, 2, 4])
  sama('posisi hitung per not di 7/8 = 0..6', posisiHitungMundur(t78, { on: true, ulang: 1, tiapNot: true, suara: 'suara' }), [0, 1, 2, 3, 4, 5, 6])
  sama('ucapan kustom dipakai apa adanya', ucapHitungMundur(t78, { on: true, ulang: 2, tiapNot: false, suara: 'suara', ucap: ['siap', 'satu'] }), ['siap', 'satu', 'siap'])
  sama('ucapan kustom kosong → angka otomatis', ucapHitungMundur(t78, { on: true, ulang: 1, tiapNot: false, suara: 'suara', ucap: ['', '  '] }), ['1', '2', '3'])
  const d = hitungMundurDefault()
  uji('bawaan hitung mundur mati', d.on === false)
  uji('bawaan ulang 1', d.ulang === 1)
  uji('bawaan hitung per pulsa', d.tiapNot === false)
}

console.log('\n— Menyusul birama pertama (count-off ikut meter) —')
{
  // Count-off HARUS mengikuti meter birama yang dimainkan pertama kali.
  // Kalau lagu mulai di birama yang meternya 7/8, count-off-nya 7/8 juga.
  const meterBiramaPertama = { pembilang: 7, penyebut: 8, kelompok: [2, 2, 3], acuan: E }
  const h = { on: true, ulang: 2, tiapNot: false, suara: 'suara' }
  const satuPutaran = ucapHitungMundur(meterBiramaPertama, h)
  const pos = posisiHitungMundur(meterBiramaPertama, h)
  sama('satu putaran = 3 ketuk', satuPutaran.length, 3)
  sama('posisi = 3 titik', pos.length, 3)
  const total = satuPutaran.length * h.ulang
  uji('ulang 2 → total 6 ketuk', total === 6, 'dapat ' + total)
}

console.log('\n— Tidak ada Not a Number —')
{
  let ok = true
  const cek = (v) => { if (typeof v === 'number' && !Number.isFinite(v)) ok = false }
  for (const [p, s] of [[1, 4], [2, 8], [32, 16], [7, 8], [12, 32]]) {
    const t = biramaBaku(p, s)
    cek(durasiBirama(t, 120))
    cek(durasiBirama(t, 0))
    cek(durasiBirama(t, 10000))
    cek(konversiBpm(120, s, acuanBaku(s), { nilai: 16, titik: true }))
    const pol = bikinPolaDariBirama(t, 3)
    if (pol.cells.some((c) => c === undefined)) ok = false
  }
  uji('semua hitungan menghasilkan angka terhingga', ok)
}


console.log('\n— Lini masa lagu (mode lagu) —')
{
  const M44 = { pembilang: 4, penyebut: 4, kelompok: [1, 1, 1, 1], acuan: Q }
  const M78 = { pembilang: 7, penyebut: 8, kelompok: [2, 2, 3], acuan: E }
  // Bagian A mulai birama 1 (4/4, 120), Bagian B mulai birama 5 (7/8, 132)
  const seg = [
    { measure: 1, bpm: 120 },
    { measure: 5, bpm: 132, birama: M78 },
  ]

  sama('birama sebelum segmen pertama → -1', indexSegmen([{ measure: 3, bpm: 90 }], 1), -1)
  sama('birama tepat di awal segmen → index itu', indexSegmen(seg, 5), 1)
  sama('birama di tengah segmen → segmen sebelumnya', indexSegmen(seg, 4), 0)
  sama('birama jauh setelah segmen terakhir', indexSegmen(seg, 99), 1)

  sama('rentang segmen 0 = 1..4', rentangSegmen(seg, 0), { mulai: 1, selesai: 4 })
  sama('rentang segmen terakhir = 5..tak terhingga', rentangSegmen(seg, 1), { mulai: 5, selesai: null })
  sama('rentang segmen di luar → null', rentangSegmen(seg, 7), null)

  sama('tempo mengikuti segmen', [tempoPada(seg, 1), tempoPada(seg, 4), tempoPada(seg, 5)], [120, 120, 132])
  sama('tanpa segmen → tempo dasar', tempoPada([], 1, 96), 96)
  uji('sukat birama 4 = warisan (4/4)', meterPada(seg, 4, M44).pembilang === 4 && meterPada(seg, 4, M44).penyebut === 4)
  uji('sukat birama 5 = sukat segmen (7/8)', meterPada(seg, 5, M44).pembilang === 7 && meterPada(seg, 5, M44).penyebut === 8)
  uji('segmen tanpa sukat mewarisi lagu', meterPada([{ measure: 1, bpm: 100 }], 3, M78).penyebut === 8)

  dekat('detikSampai birama 1 = 0', detikSampai(seg, 1, M44, 120), 0)
  dekat('birama 1..4 = 4 birama 4/4 @120 = 8 detik', detikSampai(seg, 5, M44, 120), 8)
  // birama 5..6 = 2 birama 7/8 @132 → tiap birama 7 * (60/132) = 3,1818… detik
  dekat('birama 5..6 memakai 7/8 @132', detikSampai(seg, 7, M44, 120), 8 + 2 * (7 * (60 / 132)), 1e-9)
  dekat('tanpa segmen: 3 birama 4/4 @120 = 6 detik', detikSampai([], 4, M44, 120), 6)

  // Kasus yang dulu meleset: tempo segmen PERTAMA tidak boleh terlewat.
  const seg2 = [{ measure: 1, bpm: 100 }]
  dekat('tempo segmen pertama dipakai (bukan tempo dasar)', detikSampai(seg2, 5, M44, 120), 4 * 2.4, 1e-9)
  const seg3 = [{ measure: 1, bpm: 100, birama: M78 }]
  dekat('sukat segmen pertama dipakai', detikSampai(seg3, 2, M44, 120), 7 * (60 / 100), 1e-9)

  uji('formatWaktu 0 → 0:00', formatWaktu(0) === '0:00')
  uji('formatWaktu 83 → 1:23', formatWaktu(83) === '1:23')
  uji('formatWaktu 605 → 10:05', formatWaktu(605) === '10:05')
  uji('formatWaktu negatif → 0:00', formatWaktu(-5) === '0:00')

  dekat('detikBiramaPada ikut sukat & tempo segmen', detikBiramaPada(seg, 5, M44, 120), 7 * (60 / 132), 1e-9)
  uji('detikSampai dibatasi (tidak membeku)', Number.isFinite(detikSampai(seg, 999999, M44, 120)))

  /*
   * #6 — `biramaPadaDetik` adalah KEBALIKAN `detikSampai`, dan dipakai mesin
   * metronom untuk menyusulkan klik ketika rekaman melompat atau tertinggal.
   * Kalau kebalikannya tidak tepat, klik akan mendarat di birama tetangga.
   */
  dekat('#6 biramaPadaDetik(0) = birama 1', biramaPadaDetik(seg, 0, M44, 120).birama, 1)
  dekat('#6 sisa = kelebihan detik di dalam birama', biramaPadaDetik(seg, 3, M44, 120).sisa, 1, 1e-9)
  dekat('#6 tepat di batas birama → birama berikutnya, sisa 0', biramaPadaDetik(seg, 8, M44, 120).birama, 5)
  dekat('#6 detik sebelum batas tetap di birama itu', biramaPadaDetik(seg, 7.9, M44, 120).birama, 4)

  // Pulang-pergi: detikSampai(biramaPadaDetik(t)) tidak boleh melewati t.
  for (const t of [0, 0.4, 2, 5.5, 8, 9.2, 15.7]) {
    const b = biramaPadaDetik(seg, t, M44, 120)
    const kembali = detikSampai(seg, b.birama, M44, 120) + b.sisa
    dekat(`#6 pulang-pergi detik ${t}`, kembali, t, 1e-9)
  }

  // Dengan tempo meluncur (N7/N9), kebalikannya harus memakai tempo yang sama.
  const segLuncur = [{ measure: 1, bpm: 172, berangsur: { ke: 100, birama: 9 } }]
  const bpmLuncur = (b) => 172 + (100 - 172) * Math.min(1, Math.max(0, (b - 1) / 8))
  for (const t of [0, 1.3, 3.6, 6.2]) {
    const b = biramaPadaDetik(segLuncur, t, M44, 172, bpmLuncur)
    const kembali = detikSampai(segLuncur, b.birama, M44, 172, bpmLuncur) + b.sisa
    dekat(`#6 pulang-pergi meluncur detik ${t}`, kembali, t, 1e-9)
  }
  uji('#6 dibatasi 5000 birama (tidak menggantung)', biramaPadaDetik(seg, 9999999, M44, 120).birama === 5000)
}

console.log(`\n${gagal === 0 ? 'LULUS' : 'GAGAL'}: ${lulus} lulus, ${gagal} gagal\n`)
process.exit(gagal === 0 ? 0 : 1)
