// Uji murni modul DD7 — src/lib/csvKoordinat.ts
//
// 2a — modulnya dirakit oleh bangun-logika.sh (`/tmp/csvk.mjs`), seperti uji
// logika lainnya. Dulu rangkaian ini merakitnya sendiri lewat `execSync` di
// `/home/user/drillkit` — jalur yang tidak ada di checkout lain (huruf besar
// DrillKit), sehingga ia mogok dengan `spawnSync /bin/sh ENOENT`. Ringkasannya
// pun berbentuk "36/36 lulus", yang tidak dikenali regresi.sh: ia tercatat
// "(tanpa ringkasan)" baik saat sehat maupun saat mogok, dan kode keluarnya
// tidak pernah 1. Kini: "N lulus, M gagal", ✓/✗, dan exit 1 bila ada yang gagal.
const K = await import('/tmp/csvk.mjs')

const sYd = 0.625          // 8-to-5: 1 langkah = 0,625 yard
const lebarYd = 53.3333    // lebar lapangan DCI
const OPSI = { sYd, lebarYd, satuan: 'langkah', asalY: 'belakang' }

let lulus = 0
let total = 0
function uji(nama, dapat, mau, toleransi = 0.001) {
  total++
  const ok = typeof mau === 'number'
    ? Math.abs(dapat - mau) <= toleransi
    : JSON.stringify(dapat) === JSON.stringify(mau)
  if (ok) lulus++
  console.log(`  ${ok ? '✓' : '✗'} ${nama}${ok ? '' : `  dapat ${JSON.stringify(dapat)} mau ${JSON.stringify(mau)}`}`)
}

/* ---- 1. bentuk LEBAR: round-trip dengan rumus ekspor aplikasi ---- */
const titikAsli = [
  { kode: 'C01', nama: 'Andra', x: -5, y: 10 },
  { kode: 'C02', nama: 'Budi', x: 3.75, y: -8.125 },
  { kode: 'C03', nama: 'Citra', x: 0, y: 0 },
]
const keXCsv = (p) => Math.round((p.x / sYd) * 4) / 4
const keYCsv = (p) => Math.round(((p.y + lebarYd / 2) / sYd) * 4) / 4

const lebar = [
  ['Kode', 'Nama', 'Set 1 X', 'Set 1 Y', 'Set 2 X', 'Set 2 Y'],
  ...titikAsli.map((p) => [p.kode, p.nama, String(keXCsv(p)), String(keYCsv(p)), '0', '0']),
]
  .map((r) => r.join(','))
  .join('\n')

const h1 = K.bacaCsvKoordinat(lebar, OPSI)
uji('lebar: bentuk terbaca', h1.bentuk, 'lebar')
uji('lebar: jumlah set', h1.namaSet.length, 2)
uji('lebar: jumlah pemain', h1.baris.length, 3)
uji('lebar: header terdeteksi', h1.adaHeader, true)
uji('lebar: kode baris 1', h1.baris[0].kode, 'C01')
uji('lebar: X kembali (toleransi ¼ langkah)', h1.baris[0].pos[0].x, -5, sYd / 8 + 0.001)
uji('lebar: Y kembali (toleransi ¼ langkah)', h1.baris[0].pos[0].y, 10, sYd / 8 + 0.001)
uji('lebar: X pemain 2', h1.baris[1].pos[0].x, 3.75, sYd / 8 + 0.001)
uji('lebar: Y pemain 2', h1.baris[1].pos[0].y, -8.125, sYd / 8 + 0.001)

/* ---- 2. bentuk PANJANG (lembar koordinat hasil ekspor sendiri) ---- */
const panjang = [
  ['Set', 'Kode', 'Nama', 'X (steps)', 'Y (steps)'],
  ['Set 1 — Blok', 'C01', 'Andra', '-8', '12'],
  ['Set 1 — Blok', 'C02', 'Budi', '6', '-13'],
  ['Set 2 — Busur', 'C01', 'Andra', '-4', '20'],
]
  .map((r) => r.join(','))
  .join('\n')
const h2 = K.bacaCsvKoordinat(panjang, OPSI)
uji('panjang: bentuk terbaca', h2.bentuk, 'panjang')
uji('panjang: nama set', h2.namaSet, ['Set 1 — Blok', 'Set 2 — Busur'])
uji('panjang: pemain', h2.baris.length, 2)
uji('panjang: X andra set1', h2.baris[0].pos[0].x, -8 * sYd)
uji('panjang: Y andra set1', h2.baris[0].pos[0].y, 12 * sYd - lebarYd / 2)
uji('panjang: andra set2 terisi', h2.baris[0].pos.length, 2)
uji('panjang: budi set2 kosong', h2.baris[1].pos[1], null)

/* ---- 3. pemisah kolom ---- */
uji('pemisah: koma', K.deteksiDelimiter('Kode,Nama,X,Y\nC01,A,1,2'), ',')
uji('pemisah: titik koma', K.deteksiDelimiter('Kode;Nama;X;Y\nC01;A;1;2'), ';')
uji('pemisah: tab', K.deteksiDelimiter('Kode\tNama\tX\tY\nC01\tA\t1\t2'), '\t')
uji('pemisah: koma di dalam kutip diabaikan', K.deteksiDelimiter('"Kode,Nama",X,Y'), ',')

const semi = 'Kode;Nama;Set 1 X;Set 1 Y\nC01;Andra;-8;12'
const h3 = K.bacaCsvKoordinat(semi, OPSI)
uji('titik koma: tetap terbaca', h3.baris[0].pos[0].x, -8 * sYd)

/* ---- 4. satuan & asal Y ---- */
uji('satuan yard: X', K.bacaCsvKoordinat(lebar, { ...OPSI, satuan: 'yard' }).baris[0].pos[0].x, -8)
uji('satuan meter -> yard', K.bacaCsvKoordinat('Kode,Set 1 X,Set 1 Y\nC01,1,1', { ...OPSI, satuan: 'meter' }).baris[0].pos[0].x, 1.09361, 0.0001)
uji('asal Y tengah: tidak digeser', K.bacaCsvKoordinat('Kode,Set 1 X,Set 1 Y\nC01,0,8', { ...OPSI, asalY: 'tengah' }).baris[0].pos[0].y, 8 * sYd)
uji('asal Y belakang: digeser', K.bacaCsvKoordinat('Kode,Set 1 X,Set 1 Y\nC01,0,8', { ...OPSI, asalY: 'belakang' }).baris[0].pos[0].y, 8 * sYd - lebarYd / 2)

/* ---- 5. tanpa header & koma desimal ---- */
const tanpaHeader = 'C01,Andra,-8,5\nC02,Budi,4,25'
const h5 = K.bacaCsvKoordinat(tanpaHeader, OPSI)
uji('tanpa header: terbaca', h5.baris.length, 2)
uji('tanpa header: kode', h5.baris[0].kode, 'C01')

const h6 = K.bacaCsvKoordinat('Kode,Set 1 X,Set 1 Y\nC01,-8,12', OPSI)
uji('koma desimal: 12 tetap 12', h6.baris[0].pos[0].y, 12 * sYd - lebarYd / 2)

/* ---- 6. berkas tidak dikenal ---- */
const h7 = K.bacaCsvKoordinat('Halo,Dunia\n1,2', OPSI)
uji('tidak dikenal: bentuk', h7.bentuk, 'tidak-dikenal')

/* ---- 7. nama set tanpa angka (bug yang ketemu saat diuji di browser) ---- */
const h8 = K.bacaCsvKoordinat(
  ['Kode,Nama,Set A X,Set A Y,Set B X,Set B Y', 'C01,Andra,-8,12,-4,20'].join('\n'),
  OPSI,
)
uji('set tak berangka: jumlah set', h8.namaSet.length, 2)
uji('set tak berangka: nama set', h8.namaSet, ['Set A', 'Set B'])
uji('set tak berangka: posisi set 1', h8.baris[0].pos[0].x, -8 * sYd)
uji('set tak berangka: posisi set 2', h8.baris[0].pos[1].x, -4 * sYd)

const h9 = K.bacaCsvKoordinat(
  ['Kode,Nama,Formasi A X,Formasi A Y,Formasi B X,Formasi B Y', 'C01,Andra,-8,12,-4,20'].join('\n'),
  OPSI,
)
uji('formasi A/B: nama set', h9.namaSet, ['Formasi A', 'Formasi B'])

const h10 = K.bacaCsvKoordinat(
  ['Kode,Nama,Set 1 X,Set 1 Y,Set 2 X,Set 2 Y', 'C01,Andra,-8,12,-4,20'].join('\n'),
  OPSI,
)
uji('set berangka: nama set', h10.namaSet, ['Set 1', 'Set 2'])
uji('set berangka: posisi set 2', h10.baris[0].pos[1].x, -4 * sYd)

console.log(`\n${lulus} lulus, ${total - lulus} gagal`)
if (lulus !== total) process.exitCode = 1
