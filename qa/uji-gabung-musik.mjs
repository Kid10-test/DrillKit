/**
 * Uji murni M1 — pemetaan set drill ke tempo & segmen lagu.
 * npx esbuild ../../drillkit/src/lib/gabungMusik.ts --format=esm --outfile=/tmp/gabung.mjs && node uji-gabung-musik.mjs
 */
import {
  ketukPerBirama,
  petakanSetKeMusik,
  tempoSet,
  daftarTempo,
  totalDetik,
  lamaBirama,
} from '/tmp/gabung.mjs'

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
function dekat(nama, aktual, harap, tol = 1e-6) {
  uji(nama, Math.abs(aktual - harap) <= tol, `dapat ${aktual}, harap ≈${harap}`)
}

const Q = { nilai: 4, titik: false }
const E = { nilai: 8, titik: false }
const QT = { nilai: 4, titik: true }
const M44 = { pembilang: 4, penyebut: 4, kelompok: [1, 1, 1, 1], acuan: Q }
const M78 = { pembilang: 7, penyebut: 8, kelompok: [2, 2, 3], acuan: E }

console.log('\n— Ketuk per birama —')
dekat('4/4 acuan seperempat → 4 ketuk', ketukPerBirama(M44), 4)
dekat('7/8 acuan seperdelapan → 7 ketuk', ketukPerBirama(M78), 7)
dekat('7/8 acuan seperempat → 3,5 ketuk', ketukPerBirama({ ...M78, acuan: Q }), 3.5)
dekat('6/8 acuan seperempat bertitik → 2 ketuk', ketukPerBirama({ pembilang: 6, penyebut: 8, kelompok: [3, 3], acuan: QT }), 2)
dekat('4/4 acuan keenambelas → 16 ketuk', ketukPerBirama({ ...M44, acuan: { nilai: 16, titik: false } }), 16)

console.log('\n— Lagu tempo datar 4/4 @120 —')
{
  const lagu = { bpm: 120, tandaBirama: M44, tempoMap: [] }
  const p = petakanSetKeMusik([{ counts: 8 }, { counts: 8 }], 1, lagu)
  sama('dua set terpetakan', p.length, 2)
  dekat('set 0 mulai birama 1', p[0].biramaMulai, 1)
  dekat('set 0 tempo 120', p[0].bpm, 120)
  dekat('set 0 = 8 ketuk @120 = 4 detik', p[0].detik, 4)
  dekat('set 0 memajukan 2 birama → set 1 mulai birama 3', p[1].biramaMulai, 3)
  dekat('set 1 juga 4 detik', p[1].detik, 4)
  dekat('total 8 detik', totalDetik(p), 8)

  /*
   * #6 — `detik` adalah LAMA set; `detikMulai` adalah POSISI mulai di lini
   * masa lagu. Dulu pemutar rekaman memakai `detik` untuk posisi, sehingga
   * rekaman selalu berbunyi satu set terlalu jauh — dan pada lagu dengan set
   * berlainan lama, makin jauh lagi.
   */
  dekat('#6 set 0 mulai di detik 0', p[0].detikMulai, 0)
  dekat('#6 set 1 mulai di detik 4 (jumlah set sebelumnya)', p[1].detikMulai, 4)
  dekat('#6 ujung lini masa = detikMulai + detik set terakhir', p[1].detikMulai + p[1].detik, totalDetik(p))

  // Tiga set: detikMulai harus menjumlah, bukan mengulang lama set terakhir.
  const t = petakanSetKeMusik([{ counts: 4 }, { counts: 8 }, { counts: 4 }], 1, lagu)
  dekat('#6 set 2 mulai = lama set 0 + set 1', t[2].detikMulai, t[0].detik + t[1].detik)
  dekat('#6 ujung tetap totalDetik', t[2].detikMulai + t[2].detik, totalDetik(t))
}

console.log('\n— Tempo berubah di tengah (4/4 @112 → 7/8 @132 di birama 9) —')
{
  const lagu = {
    bpm: 112,
    tandaBirama: M44,
    tempoMap: [
      { measure: 1, bpm: 112 },
      { measure: 9, bpm: 132, birama: M78 },
    ],
  }
  // Set 0: 32 hitungan @112 → 32 ketuk → 8 birama 4/4 → posisi 1 → 9
  const p = petakanSetKeMusik([{ counts: 32 }, { counts: 14 }], 1, lagu)
  dekat('set 0 tempo 112', p[0].bpm, 112)
  dekat('set 0 sukat 4/4', p[0].birama.pembilang, 4)
  dekat('set 0 = 32 ketuk @112', p[0].detik, 32 * (60 / 112))
  dekat('set 0 memajukan 8 birama', p[1].biramaMulai, 9)
  dekat('SET 1 tempo ikut lagu → 132', p[1].bpm, 132)
  dekat('SET 1 sukat ikut lagu → 7/8', p[1].birama.pembilang, 7)
  dekat('SET 1 penyebut 8', p[1].birama.penyebut, 8)
  dekat('set 1 = 14 ketuk @132', p[1].detik, 14 * (60 / 132))
  // Set berlainan lama: `detikMulai` tidak boleh tertukar dengan `detik`.
  dekat('#6 set 1 mulai sesudah lama set 0', p[1].detikMulai, p[0].detik)
  // 14 ketuk pada 7/8 (1 ketuk = 1 not penyebut) = 2 birama
  uji('set 1 maju 2 birama 7/8', Math.abs(p[1].detik - 2 * lamaBirama(M78, 132)) < 1e-9, String(p[1].detik))
}

console.log('\n— Sukat berganti, beatsPerCount 2 (mark time) —')
{
  const lagu = { bpm: 120, tandaBirama: M44, tempoMap: [{ measure: 5, bpm: 150, birama: M78 }] }
  // 4 hitungan × 2 ketuk = 8 ketuk @120 = 4 detik = 2 birama 4/4 → posisi 3
  const p = petakanSetKeMusik([{ counts: 4 }, { counts: 4 }], 2, lagu)
  dekat('set 0 = 8 ketuk @120 = 4 detik', p[0].detik, 4)
  dekat('set 0 memajukan 2 birama → 3', p[1].biramaMulai, 3)
  dekat('set 1 masih sebelum birama 5 → tempo 120', p[1].bpm, 120)
  // Tambah lagi supaya melewati birama 5
  const p2 = petakanSetKeMusik([{ counts: 4 }, { counts: 4 }, { counts: 4 }], 2, lagu)
  dekat('set 2 mulai birama 5 → tempo 150', p2[2].bpm, 150)
  dekat('set 2 sukat 7/8', p2[2].birama.penyebut, 8)
}

console.log('\n— Cadangan & batas —')
{
  const lagu = { bpm: 120, tandaBirama: M44, tempoMap: [] }
  sama('tanpa set → kosong', petakanSetKeMusik([], 1, lagu), [])
  const p = petakanSetKeMusik([{ counts: 0 }], 1, lagu)
  dekat('counts 0 dijepit ke 1', p[0].counts, 1)
  dekat('tempoSet tanpa peta → tempo drill', tempoSet(null, 3, 96), 96)
  dekat('tempoSet index di luar → set terakhir', tempoSet([{ index: 0, bpm: 100 }], 9, 96), 100)
  sama('daftarTempo mengikuti jumlah set', daftarTempo([{ bpm: 100 }, { bpm: 140 }], 120, 3), [100, 140, 140])
  sama('daftarTempo tanpa peta → tempo drill semua', daftarTempo(null, 120, 2), [120, 120])

  // Tidak boleh ada NaN walau data iseng.
  let ok = true
  const iseng = petakanSetKeMusik([{ counts: 1 }, { counts: 999 }], 1, { bpm: 120, tandaBirama: M44, tempoMap: [] })
  for (const s of iseng) {
    if (!Number.isFinite(s.detik) || !Number.isFinite(s.biramaMulai) || !Number.isFinite(s.bpm)) ok = false
  }
  uji('tidak ada NaN walau counts besar', ok, JSON.stringify(iseng))
  const bpc0 = petakanSetKeMusik([{ counts: 8 }], 0, lagu)
  uji('beatsPerCount 0 dijepit (tidak jadi nol)', bpc0[0].detik > 0, String(bpc0[0].detik))
}

/* ----------- N9 — pemetaan drill mengikuti LUNCURAN lagu ------------- */
/*
 * Mengapa butir ini ada: pemetaan set→musik memakai `tempoPada`, yang
 * hanya tahu tempo TANGGA per segmen. Kalau lagunya meluncur
 * 172 → 161,3 → 150,7 → 140, tiap set di dalam rentang itu dipetakan
 * seolah temponya masih 172. Drill-nya berjalan lebih cepat daripada
 * musiknya, dan pemain tiba di set berikutnya sebelum lagunya sampai.
 *
 * Susunannya: 4/4, 8 ketuk per set, 1 ketuk per count → 2 birama per set.
 *   segmen bar 1 = 172 (ditandai berangsur) → segmen bar 4 = 140
 *   bar 1 → 172 | bar 2 → 161,3 | bar 3 → 150,7 | bar 4 → 140
 */
console.log('\n— N9: set mengikuti luncuran, bukan tangga —')
{
  const dasar = { bpm: 120, tandaBirama: M44 }
  const tangga = {
    ...dasar,
    tempoMap: [
      { measure: 1, bpm: 172 },
      { measure: 4, bpm: 140 },
    ],
  }
  const luncur = {
    ...dasar,
    tempoMap: [
      { measure: 1, bpm: 172, berangsur: 1 },
      { measure: 4, bpm: 140 },
    ],
  }
  const sets = [{ counts: 8 }, { counts: 8 }, { counts: 8 }]

  const pTangga = petakanSetKeMusik(sets, 1, tangga)
  const pLuncur = petakanSetKeMusik(sets, 1, luncur)

  dekat('tanpa tanda: set 1 masih 172 (perilaku lama terjaga)', pTangga[1].bpm, 172, 1e-6)
  dekat('dengan tanda: set 1 sudah meluncur ke 150,7', pLuncur[1].bpm, 150 + 2 / 3, 1e-2)
  uji(
    'yang membedakan bukan kebetulan — bedanya lebih dari 20 BPM',
    Math.abs(pTangga[1].bpm - pLuncur[1].bpm) > 20,
    `${pTangga[1].bpm} vs ${pLuncur[1].bpm}`,
  )

  // Titik awalnya tidak boleh bergeser: bar 1 tetap 172 di kedua keadaan.
  dekat('set 0 tetap 172 — titik awal luncuran', pLuncur[0].bpm, 172, 1e-6)
  dekat('dan sama dengan versi tangganya', pLuncur[0].bpm, pTangga[0].bpm, 1e-9)

  // Birama lebih lambat → waktunya lebih panjang, jadi detiknya ikut.
  uji(
    'set yang meluncur lebih LAMA waktu tempuhnya (lagu melambat)',
    pLuncur[1].detik > pTangga[1].detik,
    `${pTangga[1].detik.toFixed(4)} → ${pLuncur[1].detik.toFixed(4)}`,
  )
  uji(
    'total detiknya ikut memanjang',
    totalDetik(pLuncur) > totalDetik(pTangga),
    `${totalDetik(pTangga).toFixed(4)} → ${totalDetik(pLuncur).toFixed(4)}`,
  )

  // Posisi birama tidak boleh berubah hanya karena temponya meluncur.
  sama(
    'posisi birama tiap set tidak bergeser',
    pLuncur.map((x) => x.biramaMulai),
    pTangga.map((x) => x.biramaMulai),
  )

  // Yang diturunkan ke presenter ikut memakai tempo yang sama.
  sama(
    'daftarTempo untuk presenter ikut luncuran',
    daftarTempo(pLuncur, 120, 3),
    pLuncur.map((x) => x.bpm),
  )

  /*
   * Luncuran menyeluruh (latih) pun harus terbaca oleh pemetaan.
   *
   * HATI-HATI dengan hitungannya — ini kesalahan yang kuulang untuk
   * ketiga kalinya di rangkaian uji yang berbeda. Dengan `tiap: 1`,
   * birama ke-`n` memakai `siklus = floor((n - 1) / 1)`:
   *
   *   bar 1 → siklus 0 → 120 + 0×20  = 120   (BELUM bergerak)
   *   bar 2 → siklus 1 → 120 + 1×20  = 140
   *   bar 3 → siklus 2 → 120 + 2×20  = 160
   *
   * Jadi jangan menuntut 140 di bar 1. Set 1 mulai di bar 3 (8 ketuk =
   * 2 birama), maka temponya 160.
   */
  const latih = { on: true, dari: 120, ke: 200, langkah: 20, tiap: 1 }
  const pLatih = petakanSetKeMusik([{ counts: 8 }, { counts: 8 }], 1, {
    ...dasar,
    tempoMap: [],
    latih,
  })
  dekat('luncuran menyeluruh: bar 1 belum bergerak (120)', pLatih[0].bpm, 120, 1e-6)
  dekat('luncuran menyeluruh: set 1 di bar 3 sudah 160', pLatih[1].bpm, 160, 1e-6)
}

console.log(`\n${gagal === 0 ? 'LULUS' : 'GAGAL'}: ${lulus} lulus, ${gagal} gagal\n`)
process.exit(gagal === 0 ? 0 : 1)
