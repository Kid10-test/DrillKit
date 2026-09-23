/**
 * M5 — panjang lagu: detikTotal, detikSisa, rasioProgres.
 *
 * Angka harapannya dihitung dengan tangan dari rumus di `birama.ts`:
 *   4/4 @120 → acuan seperempat → 60/120 = 0,5 dtk per not → 4 × 0,5 = 2 dtk/birama
 *   7/8 @150 → acuan seperdelapan → 60/150 = 0,4 dtk per not → 7 × 0,4 = 2,8 dtk/birama
 *
 * Pakai: node uji-panjang-lagu.mjs
 */
import {
  biramaBaku,
  detikSampai,
  detikSisa,
  detikTotal,
  durasiBirama,
  formatWaktu,
  rasioProgres,
} from '/tmp/birama.mjs'

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
const dekat = (nama, aktual, harap, presisi = 6) =>
  uji(nama, Math.abs(aktual - harap) < 10 ** -presisi, `dapat ${aktual}, harap ${harap}`)
const sama = (nama, aktual, harap) => {
  const a = JSON.stringify(aktual)
  const h = JSON.stringify(harap)
  uji(nama, a === h, `dapat ${a}, harap ${h}`)
}

const EMPAT_EMPAT = biramaBaku(4, 4)
const TUJUH_DELAPAN = biramaBaku(7, 8)

// Lagu datar: 4/4 @120, tanpa segmen.
const DATAR = []
// Lagu dengan pergantian sukat: 4/4 @120 sampai birama 4, lalu 7/8 @150.
const GANTI_METER = [{ measure: 1, bpm: 120 }, { measure: 5, bpm: 150, birama: TUJUH_DELAPAN }]

/* ------------------------------- dasar ---------------------------------- */

console.log('\n— Dasar: durasi birama —')
dekat('4/4 @120 = 2 dtk per birama', durasiBirama(EMPAT_EMPAT, 120), 2)
dekat('7/8 @150 = 2,8 dtk per birama', durasiBirama(TUJUH_DELAPAN, 150), 2.8)

console.log('\n— detikTotal: lagu datar 8 birama —')
dekat('8 birama 4/4 @120 = 16 dtk', detikTotal(DATAR, 8, EMPAT_EMPAT, 120), 16)
dekat('1 birama = 2 dtk (durasi birama itu sendiri)', detikTotal(DATAR, 1, EMPAT_EMPAT, 120), 2)
dekat('4 birama = 8 dtk', detikTotal(DATAR, 4, EMPAT_EMPAT, 120), 8)

console.log('\n— detikTotal: tanpa panjang → null (lagu lama) —')
sama('kosong → null', detikTotal(DATAR, undefined, EMPAT_EMPAT, 120), null)
sama('nol → null', detikTotal(DATAR, 0, EMPAT_EMPAT, 120), null)
sama('negatif → null', detikTotal(DATAR, -5, EMPAT_EMPAT, 120), null)
sama('NaN → null', detikTotal(DATAR, NaN, EMPAT_EMPAT, 120), null)
sama('tak hingga → null', detikTotal(DATAR, Infinity, EMPAT_EMPAT, 120), null)

console.log('\n— detikTotal: pecahan dibulatkan ke bawah —')
dekat('8,7 birama dihitung sebagai 8', detikTotal(DATAR, 8.7, EMPAT_EMPAT, 120), 16)

/* --------------------------- pergantian sukat ---------------------------- */

console.log('\n— detikTotal: 4/4 lalu 7/8 (8 birama) —')
// birama 1–4 @120 (4 × 2 dtk) + birama 5–8 @150 (4 × 2,8 dtk) = 8 + 11,2
dekat('8 birama = 8 + 11,2 = 19,2 dtk', detikTotal(GANTI_METER, 8, EMPAT_EMPAT, 120), 19.2)
dekat('4 birama = 8 dtk (semua sebelum ganti)', detikTotal(GANTI_METER, 4, EMPAT_EMPAT, 120), 8)
dekat('5 birama = 8 + 2,8 = 10,8 dtk', detikTotal(GANTI_METER, 5, EMPAT_EMPAT, 120), 10.8)
uji(
  'sukat lagu dipakai untuk birama sebelum segmen mana pun',
  detikTotal(GANTI_METER, 2, EMPAT_EMPAT, 120) === 4,
)

/* ------------------------------- detikSisa ------------------------------- */

console.log('\n— detikSisa: lagu datar 8 birama —')
dekat('di birama 1 sisa 16 dtk', detikSisa(DATAR, 8, 1, EMPAT_EMPAT, 120), 16)
dekat('di birama 5 sisa 8 dtk', detikSisa(DATAR, 8, 5, EMPAT_EMPAT, 120), 8)
dekat('di birama 8 sisa 2 dtk (birama terakhir utuh)', detikSisa(DATAR, 8, 8, EMPAT_EMPAT, 120), 2)
dekat('di birama 9 (lewat akhir) sisa 0, bukan negatif', detikSisa(DATAR, 8, 9, EMPAT_EMPAT, 120), 0)
dekat('di birama 99 sisa 0', detikSisa(DATAR, 8, 99, EMPAT_EMPAT, 120), 0)
sama('tanpa panjang → null', detikSisa(DATAR, undefined, 3, EMPAT_EMPAT, 120), null)

console.log('\n— detikSisa: 4/4 lalu 7/8 —')
dekat('di birama 1 sisa 19,2 dtk', detikSisa(GANTI_METER, 8, 1, EMPAT_EMPAT, 120), 19.2)
dekat('di birama 5 sisa 11,2 dtk', detikSisa(GANTI_METER, 8, 5, EMPAT_EMPAT, 120), 11.2)
dekat('di birama 8 sisa 2,8 dtk', detikSisa(GANTI_METER, 8, 8, EMPAT_EMPAT, 120), 2.8)

/* ----------------------------- rasioProgres ------------------------------ */

console.log('\n— rasioProgres —')
dekat('di awal = 0', rasioProgres(DATAR, 8, 1, EMPAT_EMPAT, 120), 0)
dekat('di birama 5 = 0,5 (8 dari 16 dtk)', rasioProgres(DATAR, 8, 5, EMPAT_EMPAT, 120), 0.5)
dekat('lewat akhir = 1, tidak lebih', rasioProgres(DATAR, 8, 12, EMPAT_EMPAT, 120), 1)
sama('tanpa panjang → null', rasioProgres(DATAR, undefined, 3, EMPAT_EMPAT, 120), null)
sama('panjang 0 → null', rasioProgres(DATAR, 0, 3, EMPAT_EMPAT, 120), null)

console.log('\n— rasioProgres dihitung dari WAKTU, bukan jumlah birama —')
// 4 birama pertama = 8 dtk, total 19,2 dtk → 8/19,2 ≈ 0,4167.
// Kalau dihitung dari jumlah birama, birama 5 dari 8 = 0,5 — jadi beda.
dekat('birama 5 dari 8 = 8/19,2 (bukan 4/8)', rasioProgres(GANTI_METER, 8, 5, EMPAT_EMPAT, 120), 8 / 19.2)
uji(
  'dan memang berbeda dari hitungan per birama (0,5)',
  Math.abs(rasioProgres(GANTI_METER, 8, 5, EMPAT_EMPAT, 120) - 0.5) > 0.01,
)

/* --------------------------- konsistensi & batas -------------------------- */

console.log('\n— Konsistensi —')
for (const n of [1, 2, 4, 8, 16, 64, 200]) {
  for (const b of [1, 2, Math.ceil(n / 2), n, n + 1]) {
    const total = detikTotal(GANTI_METER, n, EMPAT_EMPAT, 120)
    const sisa = detikSisa(GANTI_METER, n, b, EMPAT_EMPAT, 120)
    const sudah = detikSampai(GANTI_METER, Math.min(b, n + 1), EMPAT_EMPAT, 120)
    uji(
      `n=${n} b=${b}: total = sudah + sisa`,
      Math.abs(total - (sudah + sisa)) < 1e-6,
      `${total} vs ${sudah} + ${sisa}`,
    )
    uji(`n=${n} b=${b}: sisa tidak pernah negatif`, sisa >= 0)
  }
}

console.log('\n— Batas aman —')
dekat('birama 5000 tidak membeku & tetap terhingga', detikTotal(DATAR, 5000, EMPAT_EMPAT, 120), 9998)
uji(
  'birama 99999 dibatasi, bukan hang',
  Number.isFinite(detikTotal(DATAR, 99999, EMPAT_EMPAT, 120)),
)
uji(
  'detikSisa tetap terhingga untuk birama jauh',
  Number.isFinite(detikSisa(DATAR, 8, 1e9, EMPAT_EMPAT, 120)),
)

console.log('\n— formatWaktu (sudah ada, ikut dicek) —')
sama('16 dtk → 0:16', formatWaktu(16), '0:16')
sama('19,2 dtk → 0:19', formatWaktu(19.2), '0:19')
sama('0 → 0:00', formatWaktu(0), '0:00')
sama('605 dtk → 10:05', formatWaktu(605), '10:05')
sama('negatif → 0:00', formatWaktu(-3), '0:00')

console.log(`\n=== ${lulus} lulus, ${gagal} gagal ===`)
process.exit(gagal > 0 ? 1 : 0)
