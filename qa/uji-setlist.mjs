/**
 * M3 — set list: durasi & pengurutan (modul murni `src/lib/setlist.ts`).
 *
 * Angka harapannya dihitung dengan tangan:
 *   4/4 @120 → 60/120 × 4 = 2 dtk per birama
 *   7/8 @150 → 60/150 × 7 = 2,8 dtk per birama
 *
 * Pakai: node uji-setlist.mjs
 */
import {
  bisaDiputar,
  durasiSatu,
  hitungSetList,
  naik,
  pindah,
  setListBaru,
  turun,
} from '/tmp/setlist.mjs'

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

/** Lagu uji ringkas. */
const lagu = (id, judul, opsi = {}) => ({
  id,
  title: judul,
  bpm: opsi.bpm ?? 120,
  beats: opsi.beats ?? 4,
  tempoMap: opsi.tempoMap ?? [],
  tandaBirama: opsi.tandaBirama ?? EMPAT_EMPAT,
  panjangBirama: opsi.panjangBirama,
  createdAt: 0,
})

const A = lagu('a', 'Pembuka', { panjangBirama: 8 }) // 8 × 2 dtk = 16 dtk
const B = lagu('b', 'Ballad', { bpm: 60, panjangBirama: 4 }) // 4 × (60/60×4) = 16 dtk
const C = lagu('c', 'Penutup', {
  bpm: 150,
  tandaBirama: TUJUH_DELAPAN,
  panjangBirama: 5,
}) // 5 × 2,8 = 14 dtk
const TANPA = lagu('d', 'Belum Diukur') // tanpa panjang

const sl = (ids) => ({ id: 's1', name: 'Show', songIds: ids, createdAt: 0, updatedAt: 0 })

/* -------------------------------- durasi -------------------------------- */

console.log('\n— durasiSatu —')
dekat('Pembuka 8 birama @120 = 16 dtk', durasiSatu(A), 16)
dekat('Ballad 4 birama @60 = 16 dtk', durasiSatu(B), 16)
dekat('Penutup 5 birama 7/8 @150 = 14 dtk', durasiSatu(C), 14)
sama('tanpa panjang → null', durasiSatu(TANPA), null)
sama('panjang 0 → null', durasiSatu(lagu('z', 'Z', { panjangBirama: 0 })), null)

console.log('\n— durasiSatu ikut tempo map —')
// 4/4 @120 sampai birama 4 (8 dtk), lalu 7/8 @150 (4 × 2,8 = 11,2) = 19,2
const gantiMeter = lagu('g', 'Ganti Meter', {
  tempoMap: [{ measure: 1, bpm: 120 }, { measure: 5, bpm: 150, birama: TUJUH_DELAPAN }],
  panjangBirama: 8,
})
dekat('8 birama 4/4 lalu 7/8 = 19,2 dtk', durasiSatu(gantiMeter), 19.2)

/* ----------------------------- hitungSetList ----------------------------- */

console.log('\n— hitungSetList —')
const h1 = hitungSetList(sl(['a', 'b', 'c']), [A, B, C])
dekat('total = 16 + 16 + 14 = 46 dtk', h1.total, 46)
sama('tidak ada yang tanpa panjang', h1.tanpaPanjang, 0)
sama('urutan baris mengikuti songIds', h1.baris.map((b) => b.judul), ['Pembuka', 'Ballad', 'Penutup'])
sama('bisa diputar', bisaDiputar(h1), true)

console.log('\n— lagu tanpa panjang tidak merusak total —')
const h2 = hitungSetList(sl(['a', 'd', 'c']), [A, TANPA, C])
dekat('total hanya yang punya panjang = 16 + 14 = 30', h2.total, 30)
sama('satu lagu dilaporkan tanpa panjang', h2.tanpaPanjang, 1)
sama('tidak bisa diputar seluruhnya', bisaDiputar(h2), false)

console.log('\n— lagu yang sudah dihapus dilewati —')
const h3 = hitungSetList(sl(['a', 'hilang', 'c']), [A, C])
dekat('total tetap 30, lagu hilang dilewati', h3.total, 30)
sama('baris hanya berisi lagu yang ada', h3.baris.map((b) => b.id), ['a', 'c'])

console.log('\n— set list kosong —')
const h4 = hitungSetList(sl([]), [A])
dekat('total 0', h4.total, 0)
sama('tidak ada baris', h4.baris.length, 0)
sama('tidak bisa diputar', bisaDiputar(h4), false)
const h5 = hitungSetList(null, [A])
sama('set list null aman', h5.total, 0)
sama('set list null: tanpa baris', h5.baris.length, 0)

console.log('\n— urutan songIds menentukan, bukan urutan tabel lagu —')
const h6 = hitungSetList(sl(['c', 'a']), [A, B, C])
sama('urutan dibalik', h6.baris.map((b) => b.judul), ['Penutup', 'Pembuka'])
dekat('total tetap sama', h6.total, 30)

/* ------------------------------ pengurutan ------------------------------- */

console.log('\n— pindah —')
sama('pindah 0→1', pindah([1, 2, 3], 0, 1), [2, 1, 3])
sama('pindah 2→0', pindah([1, 2, 3], 2, 0), [3, 1, 2])
sama('pindah ke indeks sama = tidak berubah', pindah([1, 2, 3], 1, 1), [1, 2, 3])
sama('pindah 1→0', pindah(['a', 'b', 'c'], 1, 0), ['b', 'a', 'c'])

console.log('\n— batas aman pindah —')
sama('indeks dari negatif → daftar utuh', pindah([1, 2, 3], -1, 0), [1, 2, 3])
sama('indeks dari melebihi → daftar utuh', pindah([1, 2, 3], 9, 0), [1, 2, 3])
sama('tujuan di bawah 0 dijepit ke 0', pindah([1, 2, 3], 2, -5), [3, 1, 2])
sama('tujuan di atas panjang dijepit ke akhir', pindah([1, 2, 3], 0, 99), [2, 3, 1])
sama('daftar kosong aman', pindah([], 0, 0), [])
sama('daftar satu item aman', pindah(['x'], 0, 0), ['x'])

console.log('\n— naik & turun —')
sama('naik item tengah', naik(['a', 'b', 'c'], 1), ['b', 'a', 'c'])
sama('naik item pertama = tidak berubah', naik(['a', 'b', 'c'], 0), ['a', 'b', 'c'])
sama('turun item tengah', turun(['a', 'b', 'c'], 1), ['a', 'c', 'b'])
sama('turun item terakhir = tidak berubah', turun(['a', 'b', 'c'], 2), ['a', 'b', 'c'])
sama('naik lalu turun = kembali semula', turun(naik(['a', 'b', 'c'], 2), 1), ['a', 'b', 'c'])

console.log('\n— pindah tidak mengubah daftar asli —')
const asli = ['a', 'b', 'c']
pindah(asli, 0, 2)
sama('daftar asli tetap utuh', asli, ['a', 'b', 'c'])

/* -------------------------------- lain ---------------------------------- */

console.log('\n— setListBaru —')
const baru = setListBaru('x', 'Show Baru')
sama('songIds kosong', baru.songIds, [])
sama('nama tersimpan', baru.name, 'Show Baru')
uji('punya cap waktu', baru.createdAt > 0 && baru.updatedAt > 0)
sama('set list baru belum bisa diputar', bisaDiputar(hitungSetList(baru, [A])), false)

console.log('\n— konsistensi urutan acak —')
for (let putaran = 0; putaran < 60; putaran++) {
  const n = 2 + (putaran % 5)
  const daftar = Array.from({ length: n }, (_, i) => i)
  const i = putaran % n
  const j = (putaran * 3 + 1) % n
  const hasil = pindah(daftar, i, j)
  uji(
    `putaran ${putaran}: panjang & isi terjaga`,
    hasil.length === n && [...hasil].sort((x, y) => x - y).join() === daftar.join(),
  )
}

/* ----------- N9 — durasi set list ikut LUNCURAN lagunya -------------- */
/*
 * Mengapa butir ini ada: `durasiSatu` menghitung waktu dengan tempo
 * tangga. Saat set list MEMUTAR lagunya (lihat `opsiDariLagu` di halaman
 * Musik) tempo map-nya justru diikuti. Jadi durasi yang DITAMPILKAN
 * dihitung dengan aturan yang berbeda dari durasi yang DIMAINKAN —
 * selisihnya kecil, tidak pernah berteriak, dan karena itu mengendap.
 *
 * Lagu 4 birama: segmen bar 1 = 172 → segmen bar 4 = 140.
 *   tangga : 172, 172, 172, 140
 *   luncur : 172, 161,3, 150,7
 */
console.log('\n— N9: durasi mengikuti luncuran —')
{
  const dasar = { panjangBirama: 4, tempoMap: [
    { measure: 1, bpm: 172 },
    { measure: 4, bpm: 140 },
  ] }
  const tangga = lagu('t1', 'Tangga', dasar)
  const luncur = lagu('t2', 'Luncur', {
    ...dasar,
    tempoMap: [
      { measure: 1, bpm: 172, berangsur: 1 },
      { measure: 4, bpm: 140 },
    ],
  })

  const dTangga = durasiSatu(tangga)
  const dLuncur = durasiSatu(luncur)
  uji(
    'lagu yang meluncur LEBIH PANJANG dari kiraan tangga',
    dLuncur > dTangga,
    `${dTangga.toFixed(4)} → ${dLuncur.toFixed(4)}`,
  )
  // Birama 2 & 3 melambat: (240/161,3 − 240/172) + (240/150,7 − 240/172) ≈ 0,29 dtk
  dekat('selisihnya sekitar 0,29 dtk — bukan kebetulan pembulatan',
    dLuncur - dTangga, 0.29, 2)

  // Lagu TANPA tanda berangsur tidak boleh berubah sedetik pun.
  const polos = lagu('t3', 'Polos', { panjangBirama: 4, tempoMap: [] })
  dekat('lagu tanpa tempo map tetap 4 × 2 dtk', durasiSatu(polos), 8, 1e-9)

  // Dan total set list menjumlahkan durasi yang sudah benar.
  const h = hitungSetList(sl(['t2']), [luncur])
  dekat('total set list memakai durasi yang ikut luncuran', h.total, dLuncur, 1e-9)
  sama('lagu tanpa panjang tetap dilaporkan terpisah', hitungSetList(sl(['d']), [TANPA]).tanpaPanjang, 1)
}

console.log(`\n=== ${lulus} lulus, ${gagal} gagal ===`)
process.exit(gagal > 0 ? 1 : 0)
