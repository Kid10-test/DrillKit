/**
 * M2 — ulang bagian (modul murni `src/lib/ulang.ts`).
 *
 * Angka harapannya dihitung dengan tangan:
 *   4/4 @120 → 60/120 × 4 = 2 dtk per birama
 *   7/8 @150 → 60/150 × 7 = 2,8 dtk per birama
 *
 * Pakai: node uji-ulang.mjs
 */
import {
  detikSatuPutaran,
  jumlahBirama,
  normalisasiUlangBagian,
  rentangValid,
} from '/tmp/ulang.mjs'

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
const sama = (nama, aktual, harap) => {
  const a = JSON.stringify(aktual)
  const h = JSON.stringify(harap)
  uji(nama, a === h, `dapat ${a}, harap ${h}`)
}
const dekat = (nama, a, h, p = 6) => uji(nama, Math.abs(a - h) < 10 ** -p, `dapat ${a}, harap ${h}`)

const EMPAT_EMPAT = { pembilang: 4, penyebut: 4, kelompok: [2, 2], acuan: { nilai: 4, titik: false } }
const TUJUH_DELAPAN = { pembilang: 7, penyebut: 8, kelompok: [2, 2, 3], acuan: { nilai: 8, titik: false } }

const DATAR = []
const GANTI_METER = [{ measure: 1, bpm: 120 }, { measure: 5, bpm: 150, birama: TUJUH_DELAPAN }]

const r = (dari, sampai, aktif = 1) => ({ dari, sampai, aktif })

/* ------------------------------ rentangValid ----------------------------- */

console.log('\n— rentangValid —')
uji('32–48 sah', rentangValid(r(32, 48)))
uji('satu birama (5–5) sah', rentangValid(r(5, 5)))
uji('dari 1 sah', rentangValid(r(1, 8)))
uji('null → tidak sah', !rentangValid(null))
uji('dari > sampai → tidak sah', !rentangValid(r(10, 5)))
uji('dari 0 → tidak sah', !rentangValid(r(0, 5)))
uji('sampai 0 → tidak sah', !rentangValid(r(1, 0)))
uji('negatif → tidak sah', !rentangValid(r(-3, 5)))
uji('NaN → tidak sah', !rentangValid(r(NaN, 5)))

console.log('\n— rentangValid terhadap panjang lagu —')
uji('sampai sama dengan panjang → sah', rentangValid(r(1, 8), 8))
uji('sampai melebihi panjang → tidak sah', !rentangValid(r(1, 9), 8))
uji('tanpa panjang lagu → tidak dibatasi', rentangValid(r(1, 9999)))

/* ----------------------- normalisasiUlangBagian -------------------------- */

console.log('\n— normalisasiUlangBagian —')
sama('rentang sudah rapi tidak berubah', normalisasiUlangBagian(r(32, 48), 64), r(32, 48))
sama('pecahan dibulatkan ke bawah', normalisasiUlangBagian(r(3.7, 9.2), 64), r(3, 9))
sama('dari < 1 dijepit ke 1', normalisasiUlangBagian(r(0, 8), 64), r(1, 8))
sama('sampai < dari → sampai disamakan', normalisasiUlangBagian(r(10, 4), 64), r(10, 10))
sama('sampai dijepit ke panjang lagu', normalisasiUlangBagian(r(1, 999), 8), r(1, 8))
sama('dari dijepit ke panjang lagu', normalisasiUlangBagian(r(999, 999), 8), r(8, 8))
sama('null tetap null', normalisasiUlangBagian(null, 8), null)
sama('aktif=0 tetap tersimpan', normalisasiUlangBagian(r(4, 8, 0), 64), r(4, 8, 0))

/* --------------------------- detikSatuPutaran ---------------------------- */

console.log('\n— detikSatuPutaran: lagu datar 4/4 @120 —')
dekat('birama 3–6 = 4 birama = 8 dtk', detikSatuPutaran(DATAR, 3, 6, EMPAT_EMPAT, 120), 8)
dekat('birama 1–8 = 16 dtk', detikSatuPutaran(DATAR, 1, 8, EMPAT_EMPAT, 120), 16)
dekat('satu birama = 2 dtk', detikSatuPutaran(DATAR, 5, 5, EMPAT_EMPAT, 120), 2)

console.log('\n— detikSatuPutaran: melewati pergantian sukat —')
// birama 3–4 masih 4/4 @120 (2 × 2 dtk = 4), birama 5–6 sudah 7/8 @150
// (2 × 2,8 = 5,6) → total 9,6 dtk
dekat('birama 3–6 = 4 + 5,6 = 9,6 dtk', detikSatuPutaran(GANTI_METER, 3, 6, EMPAT_EMPAT, 120), 9.6)
dekat('birama 1–4 = 8 dtk (semua sebelum ganti)', detikSatuPutaran(GANTI_METER, 1, 4, EMPAT_EMPAT, 120), 8)
dekat('birama 5–8 = 11,2 dtk (semua sesudah ganti)', detikSatuPutaran(GANTI_METER, 5, 8, EMPAT_EMPAT, 120), 11.2)

console.log('\n— detikSatuPutaran: batas aman —')
// Rentang terbalik adalah masukan tak sah. Ia runtuh jadi satu birama —
// sama seperti `normalisasiUlangBagian` yang menyamakan sampai = dari.
dekat('sampai < dari → runtuh jadi 1 birama', detikSatuPutaran(DATAR, 6, 3, EMPAT_EMPAT, 120), 2)
dekat('dari 0 dijepit ke 1', detikSatuPutaran(DATAR, 0, 4, EMPAT_EMPAT, 120), 8)
uji('tidak pernah negatif', detikSatuPutaran(DATAR, 2, 2, EMPAT_EMPAT, 120) >= 0)
uji('angka jauh tetap terhingga', Number.isFinite(detikSatuPutaran(DATAR, 1, 1e6, EMPAT_EMPAT, 120)))

/* ----------------------------- jumlahBirama ------------------------------ */

console.log('\n— jumlahBirama —')
sama('32–48 = 17 birama', jumlahBirama(r(32, 48)), 17)
sama('5–5 = 1 birama', jumlahBirama(r(5, 5)), 1)
sama('1–8 = 8 birama', jumlahBirama(r(1, 8)), 8)
sama('null = 0', jumlahBirama(null), 0)
sama('terbalik → 0, bukan negatif', jumlahBirama(r(9, 4)), 0)

/* --------------------------- konsistensi -------------------------------- */

console.log('\n— Konsistensi: durasi rentang = jumlah birama × durasi birama (lagu datar) —')
for (const [a, b] of [[1, 1], [1, 4], [2, 5], [3, 3], [1, 16], [7, 9]]) {
  const d = detikSatuPutaran(DATAR, a, b, EMPAT_EMPAT, 120)
  dekat(`${a}–${b}: ${jumlahBirama(r(a, b))} birama × 2 dtk`, d, jumlahBirama(r(a, b)) * 2)
}

console.log(`\n=== ${lulus} lulus, ${gagal} gagal ===`)
process.exit(gagal > 0 ? 1 : 0)
