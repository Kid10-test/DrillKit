/**
 * Uji logika murni Pacu v2 (v2.11) — perubahan rundown di lapangan.
 *
 * Yang dijaga di sini:
 *
 * 1. **Mulai menutup blok yang berjalan** — tidak pernah ada dua blok
 *    berjalan, dan blok yang dimulai di luar urutan dipindah ke posisinya.
 * 2. **Rencana awal dibekukan sekali**, pada perubahan pertama, lalu tidak
 *    ikut berubah; semua perubahan berikutnya masuk jejak.
 * 3. **Usul potong** mengikuti prioritas: potong dulu → biasa (paling banyak
 *    separuh, sisa ≥ 5 menit) → kunci tidak pernah disentuh.
 * 4. **Laporan realisasi** menyandingkan rencana awal dengan kenyataan.
 *
 * Semua waktu diturunkan dari satu titik nol supaya hasilnya pasti.
 */
import {
  bawaKeSesi,
  batalCatat,
  epochJamSesi,
  koreksiBlok,
  laporanRealisasi,
  lewatiBlok,
  mulaiBlok,
  pindahBlok,
  posisiSesi,
  selesaiBlok,
  sesiBerikutnya,
  tambahBlok,
  terapkanUsulan,
  ubahMenit,
  ulangSemua,
  usulPotong,
} from '/tmp/pacu.mjs'

let lulus = 0
const gagal = []
const cek = (nama, syarat, keterangan = '') => {
  if (syarat) lulus += 1
  else gagal.push(`${nama}${keterangan ? ' — ' + keterangan : ''}`)
}

const MNT = 60_000
const NOL = new Date(2026, 10, 17, 0, 0, 0, 0).getTime()
const m = (j) => {
  const [h, n] = j.split(':').map(Number)
  return h * 60 + n
}
const E = (j) => NOL + m(j) * MNT
let nomor = 0
const buatId = (awalan) => `${awalan}${++nomor}`
const blok = (id, judul, menit, jenis = 'section', lain = {}) => ({ id, judul, jenis, menit, ...lain })
const terap = (s, p) => {
  const hasil = { ...s, ...p }
  for (const [k, v] of Object.entries(p)) if (v === undefined) delete hasil[k]
  return hasil
}
const bulat = (x) => Math.round(x)

// Rundown P3 yang diringkas: apel, pemanasan, klinik, simulasi, post-test, pendinginan.
const sesiAwal = () => ({
  id: 's_p3',
  title: 'P3 Jalur T',
  date: '2026-11-17',
  startTime: '17:30',
  endTime: '18:55',
  type: 'latihan',
  rencanaLatihan: [
    blok('apel', 'Apel', 10, 'apel'),
    blok('panas', 'Warm up', 10, 'pemanasan'),
    blok('klinik', 'Klinik 3 pos', 30, 'drill'),
    blok('simulasi', 'Simulasi 2×', 20, 'drill', { prioritas: 'potong' }),
    blok('post', 'Post-test', 10, 'tes'),
    blok('dingin', 'Pendinginan', 5, 'pendingin'),
  ],
  realisasiLatihan: [],
})

// ------------------------------------------------------------- mulai & selesai
{
  let s = sesiAwal()
  const p1 = mulaiBlok(s, 'apel', E('17:40'))
  cek('mulai pertama membekukan rencana awal', p1.rencanaAwal?.blok.length === 6 && p1.rencanaAwal.mulai === '17:30')
  cek('mulai pertama: satu blok berjalan', p1.realisasiLatihan.length === 1 && p1.realisasiLatihan[0].selesai === null)
  s = terap(s, p1)
  const pos1 = posisiSesi(s, E('17:42'))
  cek('apel mulai 17:40 → terlambat 10', bulat(pos1.geser) === 10, String(pos1.geser))

  // Mulai warm up tanpa menekan Selesai apel → apel ditutup otomatis.
  const p2 = mulaiBlok(s, 'panas', E('17:52'))
  cek('mulai berikutnya tidak membekukan ulang', p2.rencanaAwal === undefined)
  s = terap(s, p2)
  const apel = s.realisasiLatihan.find((r) => r.id === 'apel')
  cek('Mulai menutup blok yang berjalan', apel.selesai === E('17:52'))
  cek('tidak pernah dua blok berjalan', s.realisasiLatihan.filter((r) => r.selesai == null).length === 1)

  s = terap(s, selesaiBlok(s, 'panas', E('18:02')))
  cek('selesai mengisi jam selesai', s.realisasiLatihan.find((r) => r.id === 'panas').selesai === E('18:02'))
  const pos2 = posisiSesi(s, E('18:05'))
  cek('jeda 3 menit sesudah warm up ikut dihitung (+15)', bulat(pos2.geser) === 15, String(pos2.geser))
  cek('jeda berjalan terbaca 3', bulat(pos2.jeda) === 3, String(pos2.jeda))

  // Mulai di luar urutan: simulasi dulu → dipindah tepat sesudah warm up.
  const p3 = mulaiBlok(s, 'simulasi', E('18:05'))
  cek('mulai di luar urutan memindah blok', p3.rencanaLatihan?.map((b) => b.id).join(',') === 'apel,panas,simulasi,klinik,post,dingin',
    p3.rencanaLatihan?.map((b) => b.id).join(','))
  cek('pemindahan masuk jejak', p3.jejakPacu?.at(-1)?.jenis === 'pindah')
  s = terap(s, p3)
  const pos3 = posisiSesi(s, E('18:06'))
  cek('klinik yang dilompati tetap "belum" dan dihitung', pos3.baris.find((b) => b.id === 'klinik').status === 'belum')
  cek('rencana awal tidak ikut berubah urutan', s.rencanaAwal.blok[2].id === 'klinik')
}

// ------------------------------------------------------- lewati, ubah, tambah
{
  let s = sesiAwal()
  s = terap(s, mulaiBlok(s, 'apel', E('17:30')))
  s = terap(s, mulaiBlok(s, 'panas', E('17:40')))
  const pl = lewatiBlok(s, 'post', E('17:45'))
  cek('lewati mencatat dilewati', pl.realisasiLatihan.find((r) => r.id === 'post')?.dilewati === true)
  cek('lewati masuk jejak', pl.jejakPacu.at(-1).jenis === 'lewati' && pl.jejakPacu.at(-1).teks.includes('Post-test'))
  s = terap(s, pl)
  const pos = posisiSesi(s, E('17:45'))
  cek('blok dilewati tidak menghentikan hitungan (−10)', bulat(pos.geser) === -10, String(pos.geser))
  cek('lewati blok yang sedang berjalan ditolak', Object.keys(lewatiBlok(s, 'panas', E('17:46'))).length === 0)

  const pu = ubahMenit(s, 'klinik', 21, E('17:46'))
  cek('ubah menit mengubah rencana', pu.rencanaLatihan.find((b) => b.id === 'klinik').menit === 21)
  cek('ubah menit masuk jejak "30 → 21"', pu.jejakPacu.at(-1).teks.includes('30 → 21'))
  s = terap(s, pu)
  cek('rencana awal tetap 30', s.rencanaAwal.blok.find((b) => b.id === 'klinik').menit === 30)
  cek('ubah menit ke angka sama → tanpa perubahan', Object.keys(ubahMenit(s, 'klinik', 21, E('17:47'))).length === 0)
  cek('ubah menit ke 0 ditolak', Object.keys(ubahMenit(s, 'klinik', 0, E('17:47'))).length === 0)
  const posU = posisiSesi(s, E('17:46'))
  cek('memangkas 9 menit terlihat di selisih (−19)', bulat(posU.geser) === -19, String(posU.geser))

  const pt = tambahBlok(s, { judul: 'Briefing hujan', menit: 5 }, E('17:47'), buatId)
  const urut = pt.rencanaLatihan.map((b) => b.judul)
  cek('blok tambahan langsung sesudah blok berjalan', urut[2] === 'Briefing hujan', urut.join(','))
  cek('blok tambahan masuk jejak', pt.jejakPacu.at(-1).jenis === 'tambah')
  cek('blok tambahan tanpa judul ditolak', Object.keys(tambahBlok(s, { judul: ' ', menit: 5 }, E('17:47'), buatId)).length === 0)
  s = terap(s, pt)
  const posT = posisiSesi(s, E('17:47'))
  cek('blok tambahan menambah selisih (+5 → −14)', bulat(posT.geser) === -14, String(posT.geser))

  // Tukar urutan: hanya di antara blok yang belum dikerjakan.
  const idTambah = s.rencanaLatihan[2].id
  const pp = pindahBlok(s, 'klinik', -1, E('17:48'))
  cek('pindah naik menukar dengan tetangga', pp.rencanaLatihan[2].id === 'klinik' && pp.rencanaLatihan[3].id === idTambah)
  cek('pindah ke blok yang sudah berjalan ditolak', Object.keys(pindahBlok(s, idTambah, -1, E('17:48'))).length === 0)
  cek('pindah blok yang sudah tercatat ditolak', Object.keys(pindahBlok(s, 'apel', 1, E('17:48'))).length === 0)
  // Melompati blok yang dilewati (post) saat turun.
  const pd = pindahBlok(s, 'simulasi', 1, E('17:48'))
  cek('pindah turun melompati blok yang dilewati', pd.rencanaLatihan.map((b) => b.id).indexOf('simulasi') === 6,
    pd.rencanaLatihan.map((b) => b.id).join(','))
}

// ---------------------------------------------------------------- koreksi
{
  let s = sesiAwal()
  s = terap(s, mulaiBlok(s, 'apel', E('17:30')))
  s = terap(s, mulaiBlok(s, 'panas', E('17:45')))
  // Tombol Mulai warm up terlambat ditekan: sebenarnya mulai 17:40.
  const pk = koreksiBlok(s, 'apel', { mulai: E('17:30'), selesai: E('17:40') }, E('17:46'))
  cek('koreksi mengubah jam satu blok', pk.realisasiLatihan.find((r) => r.id === 'apel').selesai === E('17:40'))
  cek('koreksi tidak menghapus catatan lain', pk.realisasiLatihan.find((r) => r.id === 'panas')?.mulai === E('17:45'))
  cek('koreksi masuk jejak dengan jam lama & baru', pk.jejakPacu.at(-1).teks.includes('17.30–17.45 → 17.30–17.40'), pk.jejakPacu.at(-1).teks)
  s = terap(s, pk)
  s = terap(s, koreksiBlok(s, 'panas', { mulai: E('17:40'), selesai: null }, E('17:46')))
  const pos = posisiSesi(s, E('17:46'))
  cek('sesudah koreksi warm up mulai 17:40 → tepat waktu', bulat(pos.geser) === 0, String(pos.geser))
  cek('koreksi selesai < mulai ditolak', Object.keys(koreksiBlok(s, 'apel', { mulai: E('17:40'), selesai: E('17:30') }, E('17:47'))).length === 0)
  // Blok tanpa catatan bisa diberi jam belakangan.
  const pb = koreksiBlok(s, 'klinik', { mulai: E('17:50'), selesai: E('18:20') }, E('18:30'))
  cek('koreksi blok tanpa catatan → tercatat', pb.realisasiLatihan.some((r) => r.id === 'klinik'))
  cek('jejak menyebut "tanpa catatan"', pb.jejakPacu.at(-1).teks.includes('tanpa catatan'))

  const pbatal = batalCatat(s, 'panas', E('17:48'))
  cek('batal catat membuang satu catatan', !pbatal.realisasiLatihan.some((r) => r.id === 'panas') && pbatal.realisasiLatihan.some((r) => r.id === 'apel'))
  cek('batal catat masuk jejak', pbatal.jejakPacu.at(-1).jenis === 'batal-catat')

  // Batal lewati blok yang posisinya sudah terlampaui → kembali menjadi blok berikutnya.
  let t = sesiAwal()
  t = terap(t, lewatiBlok(t, 'panas', E('17:30')))
  t = terap(t, mulaiBlok(t, 'apel', E('17:30')))
  t = terap(t, mulaiBlok(t, 'klinik', E('17:40')))
  const pl = batalCatat(t, 'panas', E('17:45'))
  cek('batal lewati: blok dipindah sesudah blok berjalan', pl.rencanaLatihan?.map((b) => b.id).slice(0, 3).join(',') === 'apel,klinik,panas',
    pl.rencanaLatihan?.map((b) => b.id).join(','))
  t = terap(t, pl)
  cek('batal lewati: blok kembali "belum" dan dihitung', posisiSesi(t, E('17:45')).baris.find((b) => b.id === 'panas').status === 'belum')

  const pu = ulangSemua(s, E('17:50'))
  cek('ulangi pencatatan mengosongkan realisasi', pu.realisasiLatihan.length === 0)
  cek('ulangi pencatatan membuang rencana awal', 'rencanaAwal' in pu && pu.rencanaAwal === undefined)
  cek('ulangi pencatatan menyimpan jejak', pu.jejakPacu.length === (s.jejakPacu?.length ?? 0) + 1)
}

// ------------------------------------------------------- bawa ke sesi berikutnya
{
  const semua = [
    { id: 's_p3', date: '2026-11-17', startTime: '17:30', type: 'latihan' },
    { id: 's_rapat', date: '2026-11-18', startTime: '19:00', type: 'rapat' },
    { id: 's_p4', date: '2026-11-19', startTime: '17:30', type: 'latihan' },
    { id: 's_p2', date: '2026-11-14', startTime: '17:30', type: 'latihan' },
  ]
  cek('sesi berikutnya: latihan sesudahnya, melompati rapat', sesiBerikutnya(semua[0], semua)?.id === 's_p4')
  cek('sesi berikutnya: tidak ada → null', sesiBerikutnya({ id: 'x', date: '2027-01-01', startTime: '10:00' }, semua) === null)
  cek('sesi berikutnya: tanpa latihan → sesi apa pun', sesiBerikutnya(semua[0], semua.slice(0, 2))?.id === 's_rapat')

  let s = sesiAwal()
  s = terap(s, mulaiBlok(s, 'apel', E('17:30')))
  const tujuan = { id: 's_p4', title: 'P4', date: '2026-11-19', rencanaLatihan: [blok('x', 'Apel', 10, 'apel')] }
  const h = bawaKeSesi(s, 'simulasi', tujuan, E('17:35'), buatId)
  cek('bawa: blok ditandai dibawa', h.asal.realisasiLatihan.find((r) => r.id === 'simulasi')?.dibawaKe === 's_p4')
  cek('bawa: masuk jejak', h.asal.jejakPacu.at(-1).jenis === 'bawa' && h.asal.jejakPacu.at(-1).teks.includes('P4'))
  const salinan = h.tujuan.rencanaLatihan.at(-1)
  cek('bawa: salinan di akhir rencana tujuan', h.tujuan.rencanaLatihan.length === 2 && salinan.judul === 'Simulasi 2×')
  cek('bawa: salinan ber-id baru', salinan.id !== 'simulasi')
  cek('bawa: salinan mencatat asal', salinan.dibawaDari === 's_p3' && salinan.catatan.startsWith('Dibawa dari P3 Jalur T'))
  cek('bawa: prioritas ikut terbawa', salinan.prioritas === 'potong')
  cek('bawa: blok yang sedang berjalan ditolak', bawaKeSesi(s, 'apel', tujuan, E('17:35'), buatId) === null)
  cek('bawa: ke sesi sendiri ditolak', bawaKeSesi(s, 'klinik', { ...tujuan, id: 's_p3' }, E('17:35'), buatId) === null)
  s = terap(s, h.asal)
  const pos = posisiSesi(s, E('17:35'))
  cek('bawa: blok dibawa tidak dihitung ke proyeksi (−20)', bulat(pos.geser) === -20, String(pos.geser))
}

// ---------------------------------------------------------------- usul potong
{
  let s = sesiAwal()
  // Apel mulai 17:55 — terlambat 25 menit.
  s = terap(s, mulaiBlok(s, 'apel', E('17:55')))
  let pos = posisiSesi(s, E('17:56'))
  cek('usul: terlambat 25', bulat(pos.geser) === 25, String(pos.geser))
  const u = usulPotong(pos)
  const sim = u.usulan.find((x) => x.blokId === 'simulasi')
  cek('usul: blok potong-dulu dilewati seluruhnya', sim?.aksi === 'lewati' && sim.hemat === 20)
  const kl = u.usulan.find((x) => x.blokId === 'klinik')
  cek('usul: sisa 5 diambil dari blok biasa', kl?.aksi === 'kurangi' && kl.ke === 25, JSON.stringify(kl))
  cek('usul: blok kunci tidak disentuh', !u.usulan.some((x) => ['apel', 'post', 'dingin'].includes(x.blokId)))
  cek('usul: blok yang berjalan tidak disentuh', !u.usulan.some((x) => x.blokId === 'apel'))
  cek('usul: hemat 25, sisa 0', u.hemat === 25 && u.sisa === 0)
  cek('usul: urut menurut rundown', u.usulan.map((x) => x.blokId).join(',') === 'klinik,simulasi')

  const p = terapkanUsulan(s, u.usulan, E('17:57'))
  s = terap(s, p)
  pos = posisiSesi(s, E('17:57'))
  cek('terapkan usulan: kembali tepat waktu', Math.abs(bulat(pos.geser)) <= 1, String(pos.geser))
  cek('terapkan usulan: dua baris jejak', (s.jejakPacu ?? []).filter((j) => j.jenis === 'lewati' || j.jenis === 'ubah-menit').length === 2)

  // Terlambat jauh: blok biasa maksimal separuh & sisa ≥ 5, sisanya dilaporkan.
  let t = sesiAwal()
  t = terap(t, mulaiBlok(t, 'apel', E('18:50')))
  const pt = posisiSesi(t, E('18:50'))
  const ut = usulPotong(pt)
  const klinik = ut.usulan.find((x) => x.blokId === 'klinik')
  const panas = ut.usulan.find((x) => x.blokId === 'panas')
  cek('usul jauh: klinik paling banyak separuh (30 → 15)', klinik?.ke === 15, JSON.stringify(klinik))
  cek('usul jauh: warm up 10 → 5 (sisa ≥ 5)', panas?.ke === 5, JSON.stringify(panas))
  cek('usul jauh: sisa yang tak terkejar dilaporkan', ut.sisa === 80 - 20 - 15 - 5, String(ut.sisa))
  cek('tidak terlambat → tanpa usulan', usulPotong({ baris: pt.baris, geser: -3 }).usulan.length === 0)
}

// ------------------------------------------------------------- laporan realisasi
{
  let s = sesiAwal()
  s = terap(s, mulaiBlok(s, 'apel', E('17:38')))
  s = terap(s, mulaiBlok(s, 'panas', E('17:50')))
  s = terap(s, selesaiBlok(s, 'panas', E('18:00')))
  s = terap(s, ubahMenit(s, 'klinik', 25, E('18:01')))
  s = terap(s, mulaiBlok(s, 'klinik', E('18:02')))
  s = terap(s, tambahBlok(s, { judul: 'Minum', menit: 5, jenis: 'istirahat' }, E('18:10'), buatId))
  s = terap(s, mulaiBlok(s, s.rencanaLatihan[3].id, E('18:27')))
  s = terap(s, lewatiBlok(s, 'simulasi', E('18:30')))
  s = terap(s, mulaiBlok(s, 'post', E('18:32')))
  s = terap(s, mulaiBlok(s, 'dingin', E('18:42')))
  s = terap(s, selesaiBlok(s, 'dingin', E('18:47')))
  const pos = posisiSesi(s, E('19:00'))
  const l = laporanRealisasi(s, pos)
  cek('laporan: rencana 17:30–18:55', l.rencanaMulai === m('17:30') && l.rencanaSelesai === m('18:55'))
  cek('laporan: nyata 17:38–18:47', l.nyataMulai === m('17:38') && l.nyataSelesai === m('18:47'))
  cek('laporan: selisih akhir −8', bulat(l.selisihAkhir) === -8, String(l.selisihAkhir))
  cek('laporan: telat mulai 8', bulat(l.telatMulai) === 8)
  cek('laporan: jeda antarblok 2 (18:00–18:02)', bulat(l.totalJeda) === 2, String(l.totalJeda))
  cek('laporan: hitungan', l.hitung.selesai === 6 && l.hitung.dilewati === 1 && l.hitung.tambahan === 1,
    JSON.stringify(l.hitung))
  cek('laporan: kunci 3/3', l.kunci.terlaksana === 3 && l.kunci.total === 3, JSON.stringify(l.kunci))
  const klinik = l.baris.find((b) => b.id === 'klinik')
  cek('laporan: menit diubah tercatat (30 → 25)', klinik.rencanaMenit === 30 && klinik.menitDiubah === 25)
  cek('laporan: selisih dari rencana awal (25 nyata − 30)', bulat(klinik.selisih) === -5, String(klinik.selisih))
  const minum = l.baris.find((b) => b.judul === 'Minum')
  cek('laporan: blok tambahan ditandai', minum.tambahan && minum.rencanaMenit === null && minum.menitDiubah === 5)
  cek('laporan: teks menyebut judul & tanggal', l.teks.startsWith('Laporan realisasi: P3 Jalur T (Sel 17 Nov 2026)'), l.teks.split('\n')[0])
  cek('laporan: teks menyebut selesai lebih cepat', l.teks.includes('selesai lebih cepat 8 mnt'))
  cek('laporan: teks memuat blok kunci', l.teks.includes('Post-test [kunci]'))
  cek('laporan: teks memuat perubahan', l.teks.includes('Perubahan:') && l.teks.includes('Klinik 3 pos” 30 → 25 mnt'))
  cek('laporan: blok yang dilewati tetap di urutannya', l.baris[4].id === 'simulasi', l.baris.map((b) => b.id).join(','))
  cek('laporan: melanjutkan sesudah blok dilewati bukan "pindah"', !(s.jejakPacu ?? []).some((j) => j.jenis === 'pindah'))
  cek('laporan: teks memuat yang dilewati', /Simulasi 2×: 18\.20 20′ \| dilewati/.test(l.teks), l.teks)

  // Blok yang dihapus dari rencana sesudah dibekukan tetap muncul di laporan.
  const tanpaPost = { ...s, rencanaLatihan: s.rencanaLatihan.filter((b) => b.id !== 'post'), realisasiLatihan: s.realisasiLatihan.filter((r) => r.id !== 'post') }
  const l2 = laporanRealisasi(tanpaPost, posisiSesi(tanpaPost, E('19:00')))
  cek('laporan: blok yang dihapus tetap tampil', l2.baris.some((b) => b.id === 'post' && b.status === 'dihapus'))
  cek('laporan: kunci 2/3 bila post-test dihapus', l2.kunci.terlaksana === 2 && l2.kunci.total === 3)

  // Sesi tanpa perubahan apa pun: laporan dari rencana sekarang.
  const polos = sesiAwal()
  const l3 = laporanRealisasi(polos, posisiSesi(polos, E('17:00')))
  cek('laporan tanpa catatan: semua belum', l3.hitung.belum === 6 && l3.nyataMulai === null)
  cek('laporan tanpa catatan: teks "belum dimulai"', l3.teks.includes('belum dimulai'))
}

// ---------------------------------------------------------------- jam sesi
{
  cek('epochJamSesi: jam biasa', epochJamSesi('2026-11-17', '18:05', '17:30') === E('18:05'))
  cek('epochJamSesi: lewat tengah malam pada sesi malam', epochJamSesi('2026-11-17', '01:30', '19:00') === E('01:30') + 1440 * MNT)
  cek('epochJamSesi: jam tak sah → null', epochJamSesi('2026-11-17', 'xx', '17:30') === null)
}

console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) {
  console.log('GAGAL:\n - ' + gagal.join('\n - '))
  process.exit(1)
}
