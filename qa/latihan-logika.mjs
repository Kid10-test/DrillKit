/**
 * Uji logika murni rencana latihan (H1).
 *
 * Yang paling dikuji di sini bukanlah aritmetikanya, melainkan **dua
 * keputusan semantik** yang mudah salah:
 *
 * 1. **Rentang setengah terbuka** — pada menit ke-945, blok 15:30–15:45
 *    sudah selesai dan blok berikutnya yang berjalan. Tanpa ini, menit
 *    pertama sebuah blok masih dihitung milik blok sebelumnya.
 * 2. **Blok yang sedang berjalan hanya menyumbang kelebihannya yang sudah
 *    terjadi.** Kalau tidak, baru 5 menit masuk blok 20 menit akan terbaca
 *    "lebih cepat 15 menit" — angka yang menenangkan padahal kosong.
 */
import {
  formatGeser,
  formatMenit,
  lebihRencana,
  posisiLatihan,
  susunRencana,
  totalRencana,
} from '/tmp/latihan.mjs'

let lulus = 0
const gagal = []
const cek = (nama, syarat, keterangan = '') => {
  if (syarat) lulus += 1
  else gagal.push(`${nama}${keterangan ? ' — ' + keterangan : ''}`)
}

const m = (j) => {
  const [h, n] = j.split(':').map(Number)
  return h * 60 + n
}
const blok = (id, judul, menit, jenis = 'section') => ({ id, judul, jenis, menit })
/** Epoch tetap supaya hitungan menitnya pasti. */
const T0 = 1_700_000_000_000
const MNT = 60_000

// ---------------------------------------------------------------- totalRencana
cek('tanpa rencana → 0', totalRencana(undefined) === 0)
cek('daftar kosong → 0', totalRencana([]) === 0)
cek('tiga blok dijumlahkan', totalRencana([blok('a', 'A', 15), blok('b', 'B', 30), blok('c', 'C', 20)]) === 65)
cek('durasi nol diabaikan', totalRencana([blok('a', 'A', 10), blok('b', 'B', 0)]) === 10)
cek('durasi negatif diabaikan', totalRencana([blok('a', 'A', 10), blok('b', 'B', -5)]) === 10)

// ---------------------------------------------------------------- susunRencana
{
  const r = susunRencana(m('15:30'), [blok('a', 'Pemanasan', 15), blok('b', 'Section', 30), blok('c', 'Gabungan', 20)])
  cek('blok 1 mulai di jam sesi', r[0].mulai === m('15:30'))
  cek('blok 1 selesai 15:45', r[0].selesai === m('15:45'))
  cek('blok 2 mulai persis di ujung blok 1', r[1].mulai === m('15:45'))
  cek('blok 2 selesai 16:15', r[1].selesai === m('16:15'))
  cek('blok 3 mulai 16:15', r[2].mulai === m('16:15'))
  cek('blok 3 selesai 16:35', r[2].selesai === m('16:35'))
  cek('urutan terisi', r[2].urutan === 2)
  cek('jenis terbawa', r[0].jenis === 'section')
}
{
  // Jam mulai tidak sah: rencananya tetap tersusun, hanya tanpa waktu.
  const r = susunRencana(null, [blok('a', 'A', 10), blok('b', 'B', 10)])
  cek('jam mulai null → mulai null', r[0].mulai === null)
  cek('jam mulai null → selesai null', r[1].selesai === null)
  cek('jam mulai null → bloknya tetap ada', r.length === 2)
  cek('jam mulai null → menitnya tetap terbaca', r[0].menit === 10)
}
{
  // Blok berdurasi nol tidak boleh menggeser blok sesudahnya.
  const r = susunRencana(m('08:00'), [blok('a', 'A', 0), blok('b', 'B', 10)])
  cek('blok nol tidak menggeser', r[1].mulai === m('08:00'))
  cek('blok nol selesai di titik yang sama', r[0].selesai === m('08:00'))
}
cek('rencana kosong → daftar kosong', susunRencana(m('08:00'), []).length === 0)
cek('rencana undefined → daftar kosong', susunRencana(m('08:00'), undefined).length === 0)

// ---------------------------------------------------------------- lebihRencana
{
  const b = [blok('a', 'A', 30), blok('b', 'B', 30)]
  cek('slot tak sah → null, bukan "muat"', lebihRencana(null, b) === null)
  cek('pas muat → 0', lebihRencana(60, b) === 0)
  cek('masih muat → negatif', lebihRencana(75, b) === -15)
  cek('kelebihan 10 menit → 10', lebihRencana(50, b) === 10)
  cek('tanpa rencana di slot 60 → sisa 60 menit', lebihRencana(60, undefined) === -60)
}

// ------------------------------------------------- posisiLatihan: jangkar rencana
{
  const rencana = susunRencana(m('15:30'), [
    blok('a', 'Pemanasan', 15),
    blok('b', 'Section', 30),
    blok('c', 'Gabungan', 20),
  ])
  const pos = (menit) => posisiLatihan({ rencana, realisasi: [], menit, kini: T0 })

  cek('sebelum mulai → fase belumMulai', pos(m('15:29')).fase === 'belumMulai')
  cek('sebelum mulai → blok null', pos(m('15:29')).blok === null)

  // Batas bawah: menit pertama sudah milik blok 1.
  const p0 = pos(m('15:30'))
  cek('15:30 → blok 1', p0.blok?.id === 'a')
  cek('15:30 → sisa 15 menit', p0.sisaBlok === 15)
  cek('15:30 → fase berjalan', p0.fase === 'berjalan')

  cek('15:44 → masih blok 1', pos(m('15:44')).blok?.id === 'a')
  cek('15:44 → sisa 1 menit', pos(m('15:44')).sisaBlok === 1)

  // Batas atas: setengah terbuka — 15:45 sudah blok 2.
  const p1 = pos(m('15:45'))
  cek('15:45 → sudah blok 2 (setengah terbuka)', p1.blok?.id === 'b')
  cek('15:45 → sisa 30 menit', p1.sisaBlok === 30)
  cek('15:45 → blok 1 masuk sudahLewat', p1.sudahLewat.length === 1)

  cek('16:14 → masih blok 2', pos(m('16:14')).blok?.id === 'b')
  const p2 = pos(m('16:15'))
  cek('16:15 → blok 3', p2.blok?.id === 'c')
  cek('16:15 → dua blok sudahLewat', p2.sudahLewat.length === 2)
  cek('16:15 → tidak ada tersisa', p2.tersisa.length === 0)

  cek('16:34 → masih blok 3', pos(m('16:34')).blok?.id === 'c')
  const p3 = pos(m('16:35'))
  cek('16:35 → tidak ada blok', p3.blok === null)
  cek('16:35 → fase rampung', p3.fase === 'rampung')

  cek('tanpa realisasi → geser 0 (belum tahu, bukan tepat waktu)', p0.geser === 0)
  cek('tanpa realisasi → tercatat 0', p0.tercatat === 0)
  cek('total rencana terbaca', p0.totalRencana === 65)
}

// ---------------------------------------------- posisiLatihan: jangkar realisasi
{
  const rencana = susunRencana(m('15:30'), [
    blok('a', 'Pemanasan', 10),
    blok('b', 'Section', 20),
    blok('c', 'Gabungan', 15),
  ])

  // Blok A selesai 13 menit (rencana 10) → terlambat 3.
  const realisasiA = [{ id: 'a', mulai: T0, selesai: T0 + 13 * MNT }]
  const pa = posisiLatihan({ rencana, realisasi: realisasiA, menit: m('16:30'), kini: T0 + 13 * MNT })
  cek('A selesai 13 vs 10 → geser +3', Math.round(pa.geser) === 3, String(pa.geser))
  cek('blok yang sudah selesai tidak jadi "sedang berjalan"', pa.blok === null || pa.blok?.id !== 'a')

  // Blok B sedang berjalan 5 menit dari 20 → belum melenceng, geser tetap +3.
  const realisasiAB = [{ id: 'a', mulai: T0, selesai: T0 + 13 * MNT }, { id: 'b', mulai: T0 + 13 * MNT, selesai: null }]
  const pb = posisiLatihan({ rencana, realisasi: realisasiAB, menit: m('16:30'), kini: T0 + 18 * MNT })
  cek('B berjalan → blok B', pb.blok?.id === 'b')
  cek('B berjalan 5 dari 20 → sisa 15', Math.round(pb.sisaBlok) === 15, String(pb.sisaBlok))
  cek('B baru 5 menit → geser TETAP +3, bukan lebih cepat', Math.round(pb.geser) === 3, String(pb.geser))

  // Blok B sudah jalan 25 menit dari 20 → kelebihan 5 sudah terjadi.
  const pb2 = posisiLatihan({ rencana, realisasi: realisasiAB, menit: m('16:30'), kini: T0 + 38 * MNT })
  cek('B jalan 25 dari 20 → kelebihan 5 ikut terhitung', Math.round(pb2.geser) === 8, String(pb2.geser))
  cek('B jalan 25 dari 20 → sisa negatif', pb2.sisaBlok < 0, String(pb2.sisaBlok))

  // Blok A selesai lebih cepat (8 vs 10) → geser negatif.
  const pc = posisiLatihan({
    rencana,
    realisasi: [{ id: 'a', mulai: T0, selesai: T0 + 8 * MNT }],
    menit: m('16:30'),
    kini: T0 + 8 * MNT,
  })
  cek('A selesai 8 vs 10 → geser −2', Math.round(pc.geser) === -2, String(pc.geser))

  // Blok C belum punya catatan → geser berhenti di situ.
  const pd = posisiLatihan({
    rencana,
    realisasi: [{ id: 'a', mulai: T0, selesai: T0 + 13 * MNT }, { id: 'c', mulai: T0 + 20 * MNT, selesai: null }],
    menit: m('16:30'),
    kini: T0 + 25 * MNT,
  })
  cek('blok B dilompati → geser hanya dari A', Math.round(pd.geser) === 3, String(pd.geser))
  cek('blok C berjalan walau B terlompati', pd.blok?.id === 'c')
}

// -------------------------------------------------------------- proyeksi selesai
{
  const rencana = susunRencana(m('15:30'), [blok('a', 'A', 10), blok('b', 'B', 20), blok('c', 'C', 15)])
  // Ujung rencana 16:15. Terlambat 8 menit → proyeksi 16:23.
  const p = posisiLatihan({
    rencana,
    realisasi: [{ id: 'a', mulai: T0, selesai: T0 + 18 * MNT }],
    menit: m('16:00'),
    kini: T0 + 18 * MNT,
  })
  cek('proyeksi selesai = ujung + geser', p.proyeksiSelesai === m('16:15') + 8, String(p.proyeksiSelesai))
  cek('proyeksi 16:23', p.proyeksiSelesai === m('16:23'))

  const q = posisiLatihan({ rencana, realisasi: [], menit: m('15:30'), kini: T0 })
  cek('tanpa geser → proyeksi = ujung rencana', q.proyeksiSelesai === m('16:15'))

  const tanpa = susunRencana(null, [blok('a', 'A', 10)])
  const r = posisiLatihan({ rencana: tanpa, realisasi: [], menit: 0, kini: T0 })
  cek('rencana tanpa jam → proyeksi null', r.proyeksiSelesai === null)
}

// --------------------------------------------------------------------- fase
{
  const rencana = susunRencana(m('15:30'), [blok('a', 'A', 10)])
  cek('tanpa blok → fase rampung', posisiLatihan({ rencana: [], realisasi: [], menit: 0, kini: T0 }).fase === 'rampung')
  const tanpaWaktu = susunRencana(null, [blok('a', 'A', 10)])
  cek('rencana tanpa jam → belumMulai, bukan rampung',
    posisiLatihan({ rencana: tanpaWaktu, realisasi: [], menit: 0, kini: T0 }).fase === 'belumMulai')
}

// ------------------------------------------------------------------- format
cek('45 menit', formatMenit(45) === '45 mnt')
cek('60 menit → 1 jam', formatMenit(60) === '1 jam')
cek('80 menit → 1 jam 20 mnt', formatMenit(80) === '1 jam 20 mnt')
cek('menit negatif digenapkan', formatMenit(-10) === '0 mnt')
cek('0 menit', formatMenit(0) === '0 mnt')

cek('geser 0 → tepat waktu', formatGeser(0) === 'tepat waktu')
cek('geser 0.4 → tepat waktu (ambang 1 menit)', formatGeser(0.4) === 'tepat waktu')
cek('geser 3 → terlambat', formatGeser(3) === 'terlambat 3 mnt')
cek('geser −2 → lebih cepat', formatGeser(-2) === 'lebih cepat 2 mnt')
cek('geser 70 → 1 jam 10 mnt', formatGeser(70) === 'terlambat 1 jam 10 mnt')

console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) {
  console.log('GAGAL:\n - ' + gagal.join('\n - '))
  process.exit(1)
}
