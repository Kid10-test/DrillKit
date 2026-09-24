/**
 * Uji murni C2 — mode kuis/hafalan anggota (src/lib/kuis.ts).
 *
 * Yang diuji tanpa peramban: penyusunan soal dari pasangan set (termasuk
 * melewati pasangan yang anggotanya tidak lengkap), penilaian tebakan
 * terhadap toleransinya, dan acakan berbenih (deterministik).
 *
 * Pakai: bash qa/bangun-logika.sh && node qa/uji-kuis.mjs
 */
import { acakUrutan, bangunSoal, nilaiTebakan, TOLERANSI_LANGKAH } from '/tmp/kuis.mjs'

let lulus = 0
let gagal = 0
function uji(nama, kondisi, detail = '') {
  if (kondisi) {
    lulus++
    console.log('  ✓ ' + nama)
  } else {
    gagal++
    console.log(`  ✗ ${nama}${detail ? ' → ' + detail : ''}`)
  }
}
const set = (id, order, name, counts, points) => ({ id, drillId: 'd1', order, name, counts, points, createdAt: 0 })
const titik = (x, y) => ({ x, y, facing: 'front' })

/* ------------------------- bangunSoal ------------------------- */
{
  const sets = [
    set('s1', 0, 'Set 1 — Blok', 16, { m1: titik(0, 0), m2: titik(1, 1) }),
    set('s2', 1, 'Set 2 — Busur', 12, { m1: titik(4, 0), m2: titik(1, 5) }),
    set('s3', 2, 'Set 3 — Garis', 0, { m1: titik(4, 4), m2: titik(1, 5) }),
  ]
  const soal = bangunSoal(sets, 'm1')
  uji('tiga set → dua soal', soal.length === 2, String(soal.length))
  uji('soal 1: nama & count dari set asal',
    soal[0]?.dariNama === 'Set 1 — Blok' && soal[0]?.keNama === 'Set 2 — Busur' && soal[0]?.counts === 16,
    JSON.stringify(soal[0]))
  uji('soal 1: kunci = titik di set tujuan',
    soal[0]?.kunci.x === 4 && soal[0]?.kunci.y === 0, JSON.stringify(soal[0]?.kunci))
  uji('soal 2: memakai count set asalnya (12)',
    soal[1]?.counts === 12 && soal[1]?.kunci.x === 4 && soal[1]?.kunci.y === 4,
    JSON.stringify(soal[1]))

  // Anggota yang tidak ada di set tengah: kedua pasangan dilewati.
  const bolong = [
    set('s1', 0, 'A', 8, { m1: titik(0, 0) }),
    set('s2', 1, 'B', 8, {}),
    set('s3', 2, 'C', 0, { m1: titik(2, 2) }),
  ]
  uji('set tengah kosong → nol soal', bangunSoal(bolong, 'm1').length === 0)
  // Tidak ada di set terakhir: hanya pasangan pertama yang bersoal.
  const ujung = [
    set('s1', 0, 'A', 8, { m1: titik(0, 0) }),
    set('s2', 1, 'B', 8, { m1: titik(2, 0) }),
    set('s3', 2, 'C', 0, {}),
  ]
  const soalUjung = bangunSoal(ujung, 'm1')
  uji('set terakhir kosong → satu soal', soalUjung.length === 1, String(soalUjung.length))
  // Masukan tak berurutan tetap diurutkan.
  const acak = [sets[2], sets[0], sets[1]]
  const soalAcak = bangunSoal(acak, 'm1')
  uji('masukan diurutkan dulu', soalAcak[0]?.dariSetId === 's1' && soalAcak[1]?.dariSetId === 's2')
  uji('tanpa set → tanpa soal', bangunSoal([], 'm1').length === 0)
  uji('satu set → tanpa soal', bangunSoal([sets[0]], 'm1').length === 0)
  uji('anggota asing → tanpa soal', bangunSoal(sets, 'tak-ada').length === 0)
}

/* ------------------------- nilaiTebakan ------------------------- */
{
  const SYD = 1.6 // langkah per yard (8-to-5 ≈ 1,6)
  uji('toleransi bawaan 2 langkah', TOLERANSI_LANGKAH === 2, String(TOLERANSI_LANGKAH))
  const pas = nilaiTebakan({ x: 1, y: 1 }, { x: 1, y: 1 }, SYD)
  uji('tepat di kunci: jarak 0, benar', pas.jarakLangkah === 0 && pas.benar === true, JSON.stringify(pas))
  // Segitiga 3-4-5 yard = 5 yard = 3,125 langkah.
  const jauh = nilaiTebakan({ x: 0, y: 0 }, { x: 3, y: 4 }, SYD)
  uji('jarak 5 yard → 3,13 langkah', jauh.jarakLangkah === 3.13, String(jauh.jarakLangkah))
  uji('3,13 langkah → salah', jauh.benar === false)
  const tepi = nilaiTebakan({ x: 0, y: 0 }, { x: 3.2, y: 0 }, SYD)
  uji('tepat 2 langkah → benar', tepi.jarakLangkah === 2 && tepi.benar === true, JSON.stringify(tepi))
  const lewat = nilaiTebakan({ x: 0, y: 0 }, { x: 3.201, y: 0 }, SYD)
  uji('2,0006 langkah → salah', lewat.benar === false, JSON.stringify(lewat))
  const longgar = nilaiTebakan({ x: 0, y: 0 }, { x: 8, y: 0 }, SYD, 5)
  uji('toleransi sendiri dihormati', longgar.benar === true && longgar.jarakLangkah === 5, JSON.stringify(longgar))
}

/* ------------------------- acakUrutan ------------------------- */
{
  const daftar = [1, 2, 3, 4, 5, 6]
  const nol = acakUrutan(daftar, 0)
  uji('benih 0 = urutan asli', JSON.stringify(nol) === JSON.stringify(daftar))
  uji('benih 0 = salinan, bukan aslinya', nol !== daftar)
  const a = acakUrutan(daftar, 42)
  const b = acakUrutan(daftar, 42)
  uji('benih sama → urutan sama', JSON.stringify(a) === JSON.stringify(b), JSON.stringify(a))
  uji('hasilnya permutasi', [...a].sort((x, y) => x - y).join(',') === '1,2,3,4,5,6', JSON.stringify(a))
  uji('aslinya tidak diubah', JSON.stringify(daftar) === '[1,2,3,4,5,6]')
  const c = acakUrutan(daftar, 7)
  uji('benih 7 mengocok betulan', JSON.stringify(c) === '[5,2,3,4,6,1]', JSON.stringify(c))
  uji('daftar kosong aman', acakUrutan([], 42).length === 0)
  uji('satu unsur tetap', JSON.stringify(acakUrutan([9], 42)) === '[9]')
}

console.log(`\n${lulus} lulus, ${gagal} gagal`)
process.exit(gagal === 0 ? 0 : 1)
