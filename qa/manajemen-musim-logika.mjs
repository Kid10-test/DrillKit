/**
 * #34a — Musim TC (H-Minus & gerbang kesiapan mundur) + Papan Tindak Lanjut
 * Staf: logika murni.
 *
 * Yang dijaga:
 * - musim baru membangkitkan 6 gerbang bawaan (H-90 … H-3), tanggalnya mundur dari H-0
 * - label H-n / H-0 / H+n & teks sisa hari
 * - bukti otomatis tiap jenis gerbang: partitur lagu (set list sesi H-0 atau
 *   semua lagu), Kemajuan set (seluruh formasi / per seksi), simulasi juri
 *   terakhir ≥ 80% (Box 4), inventaris, manifes truk; full-run manual
 * - status: tercapai (bukti / tanda pelatih) · lewat tenggat · segera (≤ 7 hari) · belum waktunya
 * - musim aktif = H-0 terdekat yang belum lewat
 * - titik hitung mundur terpadu: tonggak Program Latsar (camp tanpa tanggal di
 *   akhir, libur tidak ikut), H-0 & gerbang belum tercapai, penampilan Jadwal
 *   tanpa duplikat sesi H-0
 * - tindak lanjut: saring per asal, geser kolom tanpa berputar, kartu dari
 *   komentar Judge Tape (prioritas, set, birama, asal), cari kartu kembar
 */
import {
  GERBANG_BAKU, musimBaru, periksaMusim, urutkanGerbang, tanggalGerbang, labelH, teksSisa, laguMusim,
  buktiGerbang, statusGerbang, ringkasMusim, musimAktif, titikHMinus, AMBANG_SEGERA,
} from '/tmp/manajemenMusim.mjs'
import {
  saringTindakLanjut, geserStatusTL, cariTLPenanda, tindakLanjutDariPenanda, LABEL_SUMBER_TL, BATAS_FOKUS, buatTindakLanjut,
} from '/tmp/tindakLanjut.mjs'

let lulus = 0
const gagal = []
const cek = (nama, syarat, ket = '') => {
  if (syarat) {
    lulus++
    console.log('  ✓ ' + nama)
  } else {
    gagal.push(nama)
    console.log('  ✗ ' + nama + (ket ? ' — ' + ket : ''))
  }
}
let seq = 0
const buatId = (a) => `${a}${++seq}`

/* -------------------------------- musim baru -------------------------------- */
console.log('\n— Musim & gerbang —')
const m = musimBaru(buatId, '2027-05-20', 'GPMB 2027', 1000)
cek('6 gerbang bawaan', m.gerbang.length === 6 && GERBANG_BAKU.length === 6)
cek('gerbang H-90/60/30/30/14/3', m.gerbang.map((g) => g.hMinus).join() === '90,60,30,30,14,3')
cek('id gerbang unik', new Set(m.gerbang.map((g) => g.id)).size === 6)
cek('tanggal gerbang H-90 = 19 Feb 2027', tanggalGerbang(m, m.gerbang[0]) === '2027-02-19', tanggalGerbang(m, m.gerbang[0]))
cek('tanggal gerbang H-3 = 17 Mei 2027', tanggalGerbang(m, m.gerbang[5]) === '2027-05-17')
cek('musim valid tanpa masalah', periksaMusim(m).length === 0)
cek('periksa: nama & tanggal kosong', periksaMusim({ ...m, nama: ' ', tanggalH0: '' }).length === 2)
cek('periksa: H-minus negatif', periksaMusim({ ...m, gerbang: [{ ...m.gerbang[0], hMinus: -1 }] }).length === 1)
cek('urutkan gerbang dari terjauh', urutkanGerbang([...m.gerbang].reverse()).map((g) => g.hMinus).join() === '90,60,30,30,14,3')
cek('labelH', labelH(12) === 'H-12' && labelH(0) === 'H-0' && labelH(-3) === 'H+3')
cek('teksSisa', teksSisa(0) === 'hari ini' && teksSisa(1) === 'besok' && teksSisa(5) === '5 hari lagi' && teksSisa(-1) === 'kemarin' && teksSisa(-4) === '4 hari lalu')

/* -------------------------------- bukti -------------------------------- */
console.log('\n— Bukti otomatis —')
const kosong = { songs: [], setlists: [], sessions: [], drills: [], sets: [], members: [], kemajuan: [], penilaian: [], inventaris: [], manifes: [], hariIni: '2027-03-01' }
const g = (jenis) => m.gerbang.find((x) => x.jenis === jenis)
const songs = [
  { id: 'L1', title: 'Opener', partitur: { nama: 'x' } },
  { id: 'L2', title: 'Ballad', partitur: null },
  { id: 'L3', title: 'Closer', partitur: { nama: 'y' } },
]
const setlists = [{ id: 'SL', name: 'Show', songIds: ['L1', 'L3'] }]
const sessions = [{ id: 'S0', title: 'GPMB 2027', type: 'penampilan', date: '2027-05-20', startTime: '08:00', endTime: '17:00', checklist: [], createdAt: 0, setListId: 'SL' }]
let b = buktiGerbang(m, g('musik'), { ...kosong, songs })
cek('musik tanpa sesi: semua lagu 2/3 berpartitur → belum', b.ok === false && b.teks.startsWith('2/3'), b.teks)
const mS = { ...m, sessionId: 'S0' }
cek('lagu musim = set list sesi H-0', laguMusim(mS, { songs, setlists, sessions }).map((s) => s.id).join() === 'L1,L3')
b = buktiGerbang(mS, g('musik'), { ...kosong, songs, setlists, sessions })
cek('musik dengan set list: 2/2 → tercapai', b.ok === true && b.teks.startsWith('2/2'), b.teks)
cek('musik tanpa lagu → belum', buktiGerbang(m, g('musik'), kosong).ok === false)

cek('drill belum dipilih → manual (null)', buktiGerbang(m, g('drill'), kosong).ok === null)
const drills = [{ id: 'D1', name: 'Show', rosterIds: ['a', 'b'] }]
const members = [{ id: 'a', section: 'brass' }, { id: 'b', section: 'guard' }]
const sets = [{ id: 'T1', drillId: 'D1', order: 0 }, { id: 'T2', drillId: 'D1', order: 1 }, { id: 'T3', drillId: 'D1', order: 2 }, { id: 'X', drillId: 'D2', order: 0 }]
const kemajuan = [{ key: 'D1', centang: { T1: { '*': 1 }, T2: { brass: 1, guard: 2 }, T3: { brass: 1 } } }]
const mD = { ...m, drillId: 'D1' }
b = buktiGerbang(mD, g('drill'), { ...kosong, drills, members, sets, kemajuan })
cek('drill: 2/3 set (seluruh formasi + per seksi lengkap)', b.ok === false && b.teks.startsWith('2/3'), b.teks)
b = buktiGerbang(mD, g('drill'), { ...kosong, drills, members, sets, kemajuan: [{ key: 'D1', centang: { ...kemajuan[0].centang, T3: { '*': 3 } } }] })
cek('drill: 3/3 → tercapai', b.ok === true)
cek('drill tanpa set → belum', buktiGerbang(mD, g('drill'), { ...kosong, drills, sets: [] }).ok === false)

cek('full-run selalu manual', buktiGerbang(m, g('fullrun'), kosong).ok === null)
cek('perlengkapan tanpa inventaris → manual', buktiGerbang(m, g('perlengkapan'), kosong).ok === null)
const inv = (kondisi) => ({ id: kondisi, kodeAset: kondisi, nama: kondisi, kategori: 'brass', kondisi, jumlah: 1, updatedAt: 0 })
b = buktiGerbang(m, g('perlengkapan'), { ...kosong, inventaris: [inv('baik'), inv('rusak')] })
cek('perlengkapan: ada aset rusak → belum', b.ok === false && b.teks.includes('1 aset'), b.teks)
cek('perlengkapan: semua baik → tercapai', buktiGerbang(m, g('perlengkapan'), { ...kosong, inventaris: [inv('baik')] }).ok === true)

const cap = (nilai) => [{ id: 'c', kelompok: 'musik', nama: 'M', maksKomposisi: 10, maksEksekusi: 10, nilaiKomposisi: nilai, nilaiEksekusi: nilai, pengaliBobot: 1 }]
const penilaian = [
  { id: 'P1', judul: 'Sim 1', tanggal: '2027-02-01', captions: cap(7), penalti: [], updatedAt: 1 },
  { id: 'P2', judul: 'Sim 2', tanggal: '2027-02-20', captions: cap(8.5), penalti: [], updatedAt: 2 },
  { id: 'P3', judul: 'Sim masa depan', tanggal: '2027-04-01', captions: cap(9.5), penalti: [], updatedAt: 3 },
]
cek('juri tanpa simulasi → belum', buktiGerbang(m, g('juri'), kosong).ok === false)
b = buktiGerbang(m, g('juri'), { ...kosong, penilaian })
cek('juri: simulasi terakhir (bukan masa depan) 85% Box 4 → tercapai', b.ok === true && b.teks.includes('Box 4') && b.teks.includes('20 Feb'), b.teks)
b = buktiGerbang(m, g('juri'), { ...kosong, penilaian: penilaian.slice(0, 1) })
cek('juri: 70% Box 3 → belum', b.ok === false && b.teks.includes('Box 3'), b.teks)
cek('juri: drill lain diabaikan', buktiGerbang(mD, g('juri'), { ...kosong, penilaian: [{ ...penilaian[1], drillId: 'D9' }] }).ok === false)

cek('logistik tanpa manifes → belum', buktiGerbang(m, g('logistik'), kosong).ok === false)
const man = (muat) => ({ id: 'M', judul: 'Truk', tanggal: '2027-05-19', butir: [{ id: 'x', nama: 'Snare', jumlah: 4, muatBerangkat: 1 }, { id: 'y', nama: 'Bendera', jumlah: 1, muatBerangkat: muat }], createdAt: 0, updatedAt: 0 })
b = buktiGerbang(m, g('logistik'), { ...kosong, manifes: [man(0)] })
cek('logistik: 1/2 barang dimuat → belum', b.ok === false && b.teks.startsWith('1/2'), b.teks)
cek('logistik: semua dimuat → tercapai', buktiGerbang(m, g('logistik'), { ...kosong, manifes: [man(1)] }).ok === true)
cek('logistik: manifes jauh dari H-0 diabaikan', buktiGerbang(m, g('logistik'), { ...kosong, manifes: [{ ...man(1), tanggal: '2027-01-01' }] }).ok === false)

/* -------------------------------- status -------------------------------- */
console.log('\n— Status gerbang —')
const tak = { ok: false, teks: '' }
cek('lewat tenggat', statusGerbang({}, '2027-02-19', tak, '2027-03-01') === 'terlambat')
cek('segera (≤ 7 hari)', statusGerbang({}, '2027-03-08', tak, '2027-03-01') === 'dekat' && AMBANG_SEGERA === 7)
cek('belum waktunya (> 7 hari)', statusGerbang({}, '2027-03-09', tak, '2027-03-01') === 'nanti')
cek('tanda pelatih menang atas tenggat', statusGerbang({ tercapaiAt: 5 }, '2027-02-19', tak, '2027-03-01') === 'tercapai')
cek('bukti otomatis → tercapai', statusGerbang({}, '2027-02-19', { ok: true, teks: '' }, '2027-03-01') === 'tercapai')

const mR = { ...mS, gerbang: mS.gerbang.map((x) => (x.jenis === 'fullrun' ? { ...x, tercapaiAt: 9 } : x)) }
const r = ringkasMusim(mR, { ...kosong, songs, setlists, sessions, penilaian, hariIni: '2027-03-01' })
cek('ringkas: sisa H-0 = 80 hari', r.sisaH0 === 80, String(r.sisaH0))
cek('ringkas: musik & juri tercapai (bukti), full-run manual', r.baris.find((x) => x.gerbang.jenis === 'musik').status === 'tercapai' && r.baris.find((x) => x.gerbang.jenis === 'fullrun').manual === true && r.baris.find((x) => x.gerbang.jenis === 'juri').manual === false)
cek('ringkas: drill H-60 (21 Mar, 20 hari lagi) → belum waktunya', r.baris.find((x) => x.gerbang.jenis === 'drill').status === 'nanti')
cek('ringkas: jumlah status konsisten', Object.values(r.jumlah).reduce((a, x) => a + x, 0) === 6 && r.jumlah.tercapai === 3, JSON.stringify(r.jumlah))
const rLewat = ringkasMusim(m, { ...kosong, hariIni: '2027-03-01' })
cek('H-90 musik tanpa lagu, sudah lewat → terlambat', rLewat.baris[0].status === 'terlambat')

cek('musim aktif: H-0 terdekat yang belum lewat', musimAktif([{ ...m, id: 'a', tanggalH0: '2027-08-01' }, { ...m, id: 'b', tanggalH0: '2027-05-20' }, { ...m, id: 'c', tanggalH0: '2026-01-01' }], '2027-03-01').id === 'b')
cek('musim aktif: semua lewat → terakhir', musimAktif([{ ...m, id: 'a', tanggalH0: '2026-08-01' }, { ...m, id: 'c', tanggalH0: '2026-01-01' }], '2027-03-01').id === 'a')
cek('musim aktif: kosong → null', musimAktif(undefined, '2027-03-01') === null)

/* ----------------------------- titik hitung mundur ----------------------------- */
console.log('\n— Titik hitung mundur terpadu —')
const program = [
  {
    id: 'P', nama: 'Latsar CAB 42', mulai: '2026-11-12', selesai: '2026-12-18', hari: [1, 3, 4], jamMulai: '18:00', jamSelesai: '20:00',
    tambahan: [], libur: [], fase: [], sesiIds: ['SH', 'SP'], wajibIds: [], peserta: [], aturan: {}, dibuat: 0, diubah: 0,
    tonggak: [
      { id: 'h', nama: 'Hakrab', jenis: 'acara', dari: '2026-11-22' },
      { id: 'p', nama: 'Pelantikan', jenis: 'pelantikan', dari: '2026-12-05', sampai: '2026-12-06' },
      { id: 'c', nama: 'Camp', jenis: 'camp' },
      { id: 'l', nama: 'Libur UAS', jenis: 'libur', dari: '2026-12-08', sampai: '2026-12-11' },
    ],
  },
]
const sesiJadwal = [
  { id: 'SP', title: 'Pelantikan (sesi program)', type: 'penampilan', date: '2026-12-05' },
  { id: 'S1', title: 'Pentas HUT Kota', type: 'penampilan', date: '2026-12-01' },
  { id: 'S2', title: 'Latihan', type: 'latihan', date: '2026-11-20' },
  { id: 'S3', title: 'Pentas lalu', type: 'penampilan', date: '2026-11-01' },
]
let t = titikHMinus({ program, sessions: sesiJadwal, hariIni: '2026-11-10' })
cek('tonggak Hakrab, Pelantikan, Camp + pentas Jadwal', t.map((x) => x.nama).join('|') === 'Hakrab|Pentas HUT Kota|Pelantikan|Camp', t.map((x) => x.nama).join('|'))
cek('libur tidak dihitung mundur', !t.some((x) => x.nama.startsWith('Libur')))
cek('sesi milik program tidak dobel', !t.some((x) => x.id === 'SP'))
cek('camp tanpa tanggal: di akhir, sisa null', t[t.length - 1].nama === 'Camp' && t[t.length - 1].sisa === null && t[t.length - 1].tanggal === '')
cek('sisa hari Hakrab = 12', t[0].sisa === 12 && t[0].asal === 'program')
t = titikHMinus({ program, sessions: sesiJadwal, hariIni: '2026-12-06' })
cek('pelantikan 2 hari masih tampil di hari kedua', t.some((x) => x.nama === 'Pelantikan'))
t = titikHMinus({ program, sessions: [], hariIni: '2026-12-19' })
cek('program selesai → camp tanpa tanggal tidak tampil lagi', !t.some((x) => x.nama === 'Camp'))

const rT = ringkasMusim(mS, { ...kosong, songs, setlists, sessions, hariIni: '2027-03-01' })
t = titikHMinus({ ringkas: [rT], sessions, hariIni: '2027-03-01' })
cek('H-0 musim tampil, sesi H-0 tidak dobel', t.filter((x) => x.asal === 'musim').length === 1 && !t.some((x) => x.id === 'S0'))
cek('gerbang tercapai tidak ikut; gerbang belum tercapai ikut', !t.some((x) => x.nama === 'Skor musik lengkap') && t.some((x) => x.status === 'nanti' && x.nama === 'Seluruh drill terpasang'))
const rT2 = ringkasMusim(m, { ...kosong, hariIni: '2027-03-01' })
t = titikHMinus({ ringkas: [rT2], sessions: [], hariIni: '2027-03-01', cakrawala: 30 })
cek('cakrawala 30 hari: H-0 (80 hari) tidak ikut, gerbang terlambat tetap ikut', !t.some((x) => x.asal === 'musim') && t.some((x) => x.status === 'terlambat'))
cek('gerbang berketerangan H-n + nama musim', t.find((x) => x.asal === 'gerbang').keterangan === 'H-90 GPMB 2027')
t = titikHMinus({ ringkas: [ringkasMusim(m, { ...kosong, hariIni: '2027-06-01' })], sessions: [], hariIni: '2027-06-01' })
cek('musim sudah lewat → tidak ada titik', t.length === 0)

/* ------------------------------- tindak lanjut ------------------------------- */
console.log('\n— Papan tindak lanjut —')
const tl = (id, sumber, status = 'temuan') => ({ ...buatTindakLanjut({ id, judul: id, sumber, sekarang: 1 }), status })
const daftar = [tl('a', 'cleaning'), tl('b', 'juri', 'fokus'), tl('c', 'staf', 'beres'), tl('d', 'juri')]
cek('label asal', LABEL_SUMBER_TL.cleaning === 'Cleaning' && LABEL_SUMBER_TL.juri === 'Juri' && LABEL_SUMBER_TL.staf === 'Staf')
cek('batas fokus 5', BATAS_FOKUS === 5)
cek('saring asal juri', saringTindakLanjut(daftar, { sumber: 'juri' }).map((x) => x.id).join() === 'b,d')
cek('saring asal semua', saringTindakLanjut(daftar, { sumber: 'semua' }).length === 4)
cek('geser kanan temuan → fokus', geserStatusTL(daftar[0], 1, 5).status === 'fokus')
cek('geser kanan fokus → beres + beresAt', (() => { const x = geserStatusTL(daftar[1], 1, 7); return x.status === 'beres' && x.beresAt === 7 })())
cek('geser kiri beres → fokus, beresAt dihapus', (() => { const x = geserStatusTL({ ...daftar[2], beresAt: 3 }, -1, 9); return x.status === 'fokus' && x.beresAt === undefined })())
cek('tidak berputar di ujung', geserStatusTL(daftar[0], -1) === daftar[0] && geserStatusTL(daftar[2], 1) === daftar[2])

const pen = { id: 'PJ', judul: 'Simulasi 2', drillId: 'D1' }
const c = { id: 'C1', detik: 83.4, fokus: 'visual', teks: '  Sayap kanan   maju  ', setId: 'T2', labelSet: 'Set 2', birama: 25, tingkat: 'penting' }
const dariJuri = tindakLanjutDariPenanda(pen, c, { id: 'tlj', setNomor: 2, labelFokus: 'Visual', sekarang: 50 })
cek('kartu dari Judge Tape: asal juri, judul dirapikan', dariJuri.sumber === 'juri' && dariJuri.judul === 'Sayap kanan maju' && dariJuri.status === 'temuan')
cek('kartu dari Judge Tape: drill, set, birama', dariJuri.drillId === 'D1' && dariJuri.setId === 'T2' && dariJuri.setNomor === 2 && dariJuri.biramaDari === 25)
cek('kartu dari Judge Tape: penting → prioritas tinggi', dariJuri.prioritas === 'tinggi')
cek('kartu dari Judge Tape: catatan menyebut simulasi, waktu, caption', dariJuri.catatan === 'Judge Tape “Simulasi 2” 1:23 · Visual', dariJuri.catatan)
cek('kartu menyimpan asal komentar', dariJuri.penilaianId === 'PJ' && dariJuri.penandaId === 'C1')
cek('teks kosong → null', tindakLanjutDariPenanda(pen, { ...c, teks: '  ' }, { id: 'x' }) === null)
cek('komentar biasa → prioritas normal (tidak diisi)', tindakLanjutDariPenanda(pen, { ...c, tingkat: 'biasa' }, { id: 'y' }).prioritas === undefined)
cek('cari kartu kembar per komentar', cariTLPenanda([dariJuri], 'PJ', 'C1') === dariJuri && cariTLPenanda([dariJuri], 'PJ', 'C2') === undefined)

console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) process.exit(1)
