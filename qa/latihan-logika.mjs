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
 *
 * v2.11 — selisih berpatokan pada jam nyata: skenario A–D (apel terlambat,
 * jeda antarblok, blok dilewati, dua blok berjalan) diuji di sini; tindakan
 * mengubah rundown diuji di `pacu-logika.mjs`.
 */
import {
  formatGeser,
  formatMenit,
  lebihRencana,
  posisiLatihan,
  prioritasBlok,
  rapikanRealisasi,
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
//
// v2.11 — selisih berpatokan pada JAM NYATA. Jam dinding (`kini`) dan menit
// sesi (`menit`) harus menunjuk detik yang sama, jadi semua waktu di bawah
// diturunkan dari satu titik nol (00.00 hari sesi).
const NOL = new Date(2026, 10, 17, 0, 0, 0, 0).getTime()
const E = (j) => NOL + m(j) * MNT
const posPada = (rencana, realisasi, jam, lain = {}) =>
  posisiLatihan({ rencana, realisasi, menit: m(jam), kini: E(jam), nol: NOL, ...lain })
const bulat = (x) => Math.round(x)
{
  const rencana = susunRencana(m('15:30'), [
    blok('a', 'Pemanasan', 10),
    blok('b', 'Section', 20),
    blok('c', 'Gabungan', 15),
  ])

  // Blok A selesai 13 menit (rencana 10) → terlambat 3.
  const realisasiA = [{ id: 'a', mulai: E('15:30'), selesai: E('15:43') }]
  const pa = posPada(rencana, realisasiA, '15:43')
  cek('A selesai 13 vs 10 → geser +3', bulat(pa.geser) === 3, String(pa.geser))
  cek('blok yang sudah selesai tidak jadi "sedang berjalan"', pa.blok === null || pa.blok?.id !== 'a')

  // Blok B sedang berjalan 5 menit dari 20 → belum melenceng, geser tetap +3.
  const realisasiAB = [{ id: 'a', mulai: E('15:30'), selesai: E('15:43') }, { id: 'b', mulai: E('15:43'), selesai: null }]
  const pb = posPada(rencana, realisasiAB, '15:48')
  cek('B berjalan → blok B', pb.blok?.id === 'b')
  cek('B berjalan 5 dari 20 → sisa 15', bulat(pb.sisaBlok) === 15, String(pb.sisaBlok))
  cek('B baru 5 menit → geser TETAP +3, bukan lebih cepat', bulat(pb.geser) === 3, String(pb.geser))
  cek('B berjalan → status berjalan', pb.berjalan?.id === 'b' && pb.baris[1].status === 'berjalan')
  cek('B berjalan → perkiraan C mulai 16:03', pb.baris[2].kiraMulai === m('16:03'), String(pb.baris[2].kiraMulai))

  // Blok B sudah jalan 25 menit dari 20 → kelebihan 5 sudah terjadi.
  const pb2 = posPada(rencana, realisasiAB, '16:08')
  cek('B jalan 25 dari 20 → kelebihan 5 ikut terhitung', bulat(pb2.geser) === 8, String(pb2.geser))
  cek('B jalan 25 dari 20 → sisa negatif', pb2.sisaBlok < 0, String(pb2.sisaBlok))

  // Blok A selesai lebih cepat (8 vs 10) → geser negatif.
  const pc = posPada(rencana, [{ id: 'a', mulai: E('15:30'), selesai: E('15:38') }], '15:38')
  cek('A selesai 8 vs 10 → geser −2', bulat(pc.geser) === -2, String(pc.geser))

  // Blok B tidak pernah dicatat, C sudah dimulai → B dianggap lewat, hitungan JALAN TERUS.
  const pd = posPada(rencana, [{ id: 'a', mulai: E('15:30'), selesai: E('15:43') }, { id: 'c', mulai: E('15:50'), selesai: null }], '15:55')
  cek('blok C berjalan walau B terlompati', pd.blok?.id === 'c')
  cek('B tanpa catatan sebelum C → takTercatat', pd.baris[1].status === 'takTercatat', pd.baris[1].status)
  cek('B tak tercatat TIDAK menghentikan hitungan (C 15:50+15 = 16:05 → −10)', bulat(pd.geser) === -10, String(pd.geser))
}

// ------------------------------------------- v2.11 — skenario A–D (jam nyata)
{
  const rencana = susunRencana(m('15:30'), [
    blok('a', 'Apel', 10, 'apel'),
    blok('b', 'Section', 20),
    blok('c', 'Gabungan', 15),
  ])

  // A — apel terlambat.
  const a0 = posPada(rencana, [], '15:40')
  cek('A: belum ada yang dimulai pada 15:40 → terlambat 10', bulat(a0.geser) === 10, String(a0.geser))
  cek('A: blok berikutnya tetap apel', a0.berikut?.id === 'a')
  cek('A: proyeksi 16:25', a0.proyeksiSelesai === m('16:25'), String(a0.proyeksiSelesai))
  const a1 = posPada(rencana, [{ id: 'a', mulai: E('15:40'), selesai: null }], '15:42')
  cek('A: apel mulai 15:40 → terlambat 10', bulat(a1.geser) === 10, String(a1.geser))
  cek('A: telatMulai 10', bulat(a1.telatMulai) === 10, String(a1.telatMulai))
  cek('A: sebelum jam mulai & tanpa catatan → 0', posPada(rencana, [], '15:20').geser === 0)
  cek('A: sebelum jam mulai → belumMulai', posPada(rencana, [], '15:20').fase === 'belumMulai')

  // B — jeda di antara blok.
  const b0 = posPada(rencana, [{ id: 'a', mulai: E('15:30'), selesai: E('15:40') }], '15:45')
  cek('B: jeda 5 menit sesudah apel → terlambat 5', bulat(b0.geser) === 5, String(b0.geser))
  cek('B: jeda terbaca 5', bulat(b0.jeda) === 5, String(b0.jeda))
  cek('B: saat jeda tidak ada blok berjalan', b0.blok === null && b0.berjalan === null)
  cek('B: saat jeda fase tetap berjalan', b0.fase === 'berjalan')
  cek('B: blok berikutnya Section', b0.berikut?.id === 'b')
  const b1 = posPada(rencana, [
    { id: 'a', mulai: E('15:30'), selesai: E('15:40') },
    { id: 'b', mulai: E('15:44'), selesai: E('16:04') },
  ], '16:04')
  cek('B: total jeda antarblok 4', bulat(b1.totalJeda) === 4, String(b1.totalJeda))
  cek('B: jeda 4 terbawa ke selisih', bulat(b1.geser) === 4, String(b1.geser))

  // C — blok dilewati.
  const c0 = posPada(rencana, [
    { id: 'a', mulai: E('15:30'), selesai: E('15:40') },
    { id: 'b', mulai: E('15:40'), selesai: E('15:40'), dilewati: true },
  ], '15:42')
  cek('C: B dilewati → status dilewati', c0.baris[1].status === 'dilewati')
  cek('C: hitungan jalan terus (15:42 + 15 = 15:57 → −18)', bulat(c0.geser) === -18, String(c0.geser))
  cek('C: berikutnya C', c0.berikut?.id === 'c')
  const c1 = posPada(rencana, [
    { id: 'a', mulai: E('15:30'), selesai: E('15:40') },
    { id: 'b', mulai: E('15:40'), selesai: E('15:40'), dilewati: true },
    { id: 'c', mulai: E('15:41'), selesai: null },
  ], '15:45')
  cek('C: C berjalan sesudah B dilewati → −19', bulat(c1.geser) === -19, String(c1.geser))
  cek('C: blok yang dilewati masuk sudahLewat', c1.sudahLewat.some((x) => x.id === 'b'))
  // Dilewati jauh di depan tidak membuat blok di antaranya "tak tercatat".
  const c2 = posPada(rencana, [
    { id: 'a', mulai: E('15:30'), selesai: null },
    { id: 'c', mulai: E('15:35'), selesai: E('15:35'), dilewati: true },
  ], '15:35')
  cek('C: melewati blok di depan → blok di antaranya tetap belum', c2.baris[1].status === 'belum', c2.baris[1].status)
  cek('C: … dan masih dihitung (15:40 + 20 = 16:00 → −15)', bulat(c2.geser) === -15, String(c2.geser))
  const c3 = posPada(rencana, [{ id: 'b', mulai: E('15:30'), selesai: E('15:30'), dibawaKe: 's_lain' }], '15:30')
  cek('C: dibawa ke sesi lain → status dibawa', c3.baris[1].status === 'dibawa' && c3.baris[1].dibawaKe === 's_lain')

  // D — dua blok berjalan (data lama).
  const d0 = posPada(rencana, [
    { id: 'a', mulai: E('15:30'), selesai: null },
    { id: 'b', mulai: E('15:42'), selesai: null },
  ], '15:45')
  cek('D: hanya satu blok berjalan (yang terakhir dimulai)', d0.berjalan?.id === 'b' && d0.baris.filter((x) => x.status === 'berjalan').length === 1)
  cek('D: blok sebelumnya dianggap selesai saat B mulai', d0.baris[0].status === 'selesai' && bulat(d0.baris[0].nyataMenit) === 12)
  cek('D: selisih (15:42 + 20 + 15 = 16:17 → +2)', bulat(d0.geser) === 2, String(d0.geser))
}

// ------------------------------------------- v2.11 — acuan rencana awal
{
  // Rencana sekarang: B dipangkas 20 → 10. Acuan tetap rencana awal (45 mnt).
  const rencana = susunRencana(m('15:30'), [blok('a', 'A', 10), blok('b', 'B', 10), blok('c', 'C', 15)])
  const p = posPada(rencana, [{ id: 'a', mulai: E('15:30'), selesai: E('15:40') }], '15:40', { mulaiAcuan: m('15:30'), totalAcuan: 45 })
  cek('acuan: target = jam selesai rencana awal 16:15', p.target === m('16:15'), String(p.target))
  cek('acuan: memangkas 10 menit terlihat sebagai −10', bulat(p.geser) === -10, String(p.geser))
  const tanpaAcuan = posPada(rencana, [{ id: 'a', mulai: E('15:30'), selesai: E('15:40') }], '15:40')
  cek('tanpa acuan: target = rencana sekarang', tanpaAcuan.target === m('16:05') && bulat(tanpaAcuan.geser) === 0)

  // Semua blok selesai → proyeksi = jam selesai nyata.
  const full = susunRencana(m('15:30'), [blok('a', 'A', 10), blok('b', 'B', 20), blok('c', 'C', 15)])
  const r = posPada(full, [
    { id: 'a', mulai: E('15:30'), selesai: E('15:41') },
    { id: 'b', mulai: E('15:41'), selesai: E('16:00') },
    { id: 'c', mulai: E('16:02'), selesai: E('16:20') },
  ], '17:00')
  cek('rampung: fase rampung', r.fase === 'rampung')
  cek('rampung: proyeksi = selesai nyata 16:20', r.proyeksiSelesai === m('16:20'), String(r.proyeksiSelesai))
  cek('rampung: geser +5', bulat(r.geser) === 5, String(r.geser))
  cek('rampung: total jeda 2', bulat(r.totalJeda) === 2, String(r.totalJeda))

  // Sesi yang sudah lewat tanpa pernah dicatat: 0, bukan terlambat berjam-jam.
  const lewat = posPada(full, [], '18:00')
  cek('sesi lewat tanpa catatan → geser 0', lewat.geser === 0 && lewat.fase === 'rampung')

  // Sesi ditandai selesai padahal C belum dikerjakan → tidak diproyeksikan dari jam sekarang.
  const tutup = posPada(full, [
    { id: 'a', mulai: E('15:30'), selesai: E('15:40') },
    { id: 'b', mulai: E('15:40'), selesai: E('16:00') },
  ], '19:00', { selesaiSesi: E('16:05') })
  cek('sesi ditutup → fase rampung', tutup.fase === 'rampung')
  cek('sesi ditutup → tidak ada jeda berjalan', tutup.jeda === null)

  // Rencana tanpa jam: jangkar = mulai nyata blok pertama.
  const tanpaJam = susunRencana(null, [blok('a', 'A', 10), blok('b', 'B', 20)])
  const tj = posPada(tanpaJam, [{ id: 'a', mulai: E('10:00'), selesai: null }], '10:05')
  cek('tanpa jam: proyeksi dari mulai nyata (10:30)', tj.proyeksiSelesai === m('10:30'), String(tj.proyeksiSelesai))
  cek('tanpa jam: geser 0', bulat(tj.geser) === 0)
}

// -------------------------------------------------------------- proyeksi selesai
{
  const rencana = susunRencana(m('15:30'), [blok('a', 'A', 10), blok('b', 'B', 20), blok('c', 'C', 15)])
  // Ujung rencana 16:15. A makan 18 menit, B langsung menyusul → proyeksi 16:23.
  const p = posPada(rencana, [{ id: 'a', mulai: E('15:30'), selesai: E('15:48') }], '15:48')
  cek('proyeksi selesai = ujung + geser', p.proyeksiSelesai === m('16:15') + 8, String(p.proyeksiSelesai))
  cek('proyeksi 16:23', p.proyeksiSelesai === m('16:23'))

  const q = posisiLatihan({ rencana, realisasi: [], menit: m('15:30'), kini: T0 })
  cek('tanpa geser → proyeksi = ujung rencana', q.proyeksiSelesai === m('16:15'))

  const tanpa = susunRencana(null, [blok('a', 'A', 10)])
  const r = posisiLatihan({ rencana: tanpa, realisasi: [], menit: 0, kini: T0 })
  cek('rencana tanpa jam → proyeksi null', r.proyeksiSelesai === null)
}

// ------------------------------------------------------------- prioritas & rapikan
{
  cek('prioritas bawaan apel = kunci', prioritasBlok({ jenis: 'apel' }) === 'kunci')
  cek('prioritas bawaan tes = kunci', prioritasBlok({ jenis: 'tes' }) === 'kunci')
  cek('prioritas bawaan section = biasa', prioritasBlok({ jenis: 'section' }) === 'biasa')
  cek('prioritas diisi menang', prioritasBlok({ jenis: 'apel', prioritas: 'potong' }) === 'potong')
  cek('susunRencana membawa prioritas', susunRencana(0, [{ id: 'x', judul: 'X', jenis: 'pendingin', menit: 5 }])[0].prioritas === 'kunci')
  const r = rapikanRealisasi([
    { id: 'a', mulai: 100, selesai: null },
    { id: 'a', mulai: 200, selesai: 300 },
    { id: 'b', mulai: 400, selesai: null, dilewati: true },
    { id: 'c', mulai: 500, selesai: null },
    { id: 'd', mulai: 600, selesai: null },
  ])
  cek('rapikan: satu catatan per blok (yang terakhir)', r.filter((x) => x.id === 'a').length === 1 && r.find((x) => x.id === 'a').mulai === 200)
  cek('rapikan: dilewati selalu punya selesai', r.find((x) => x.id === 'b').selesai === 400)
  cek('rapikan: hanya satu berjalan', r.filter((x) => x.selesai == null).length === 1 && r.find((x) => x.id === 'd').selesai === null)
  cek('rapikan: yang lebih awal ditutup saat berikutnya mulai', r.find((x) => x.id === 'c').selesai === 600)
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
