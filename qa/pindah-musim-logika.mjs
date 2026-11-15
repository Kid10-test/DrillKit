/**
 * v2.10 — Pindah musim "mulai dari nol" tanpa kehilangan apa pun (logika murni).
 *
 * Laporan pemakai: setelah pindah musim, semua harus terekap di arsip, musim
 * baru bersih, anggota nonaktif dulu, dan materi/jadwal bisa dihidupkan
 * kembali satu per satu. Uji ini memagari aturan-aturan yang mudah salah:
 * berkas biner tidak boleh ikut dihapus, anggota dinonaktifkan tanpa
 * kehilangan data, saldo kas terbawa, berkas yatim hanya yang benar-benar
 * yatim, dan "ambil dari arsip" tidak pernah menimpa serta tidak meninggalkan
 * rujukan bolong diam-diam.
 *
 * Jalankan: bash qa/bangun-logika.sh && node qa/pindah-musim-logika.mjs
 */
import {
  TABEL_BERKAS_DIPERTAHANKAN, nonaktifkanSemua, transaksiSaldoAwal, kumpulkanRujukanBerkas, berkasYatim,
  geserTanggal, hitungGeserHari, rencanaAmbilArsip, teksRencanaAmbil,
} from '/tmp/pindahMusim.mjs'
import { TABEL_MUSIMAN_DIARSIPKAN } from '/tmp/administrasiUnit.mjs'
import { namaBackupAkhirMusim, namaBackupZip } from '/tmp/namaBerkas.mjs'

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

console.log('— Tabel yang dibersihkan —')
for (const t of TABEL_BERKAS_DIPERTAHANKAN) {
  cek(`berkas ${t} TIDAK ikut dibersihkan`, !TABEL_MUSIMAN_DIARSIPKAN.includes(t))
}
for (const t of ['sessions', 'attendance', 'songs', 'drills', 'kasIuran', 'evaluasi']) {
  cek(`tabel musiman ${t} tetap dibersihkan`, TABEL_MUSIMAN_DIARSIPKAN.includes(t))
}
for (const t of ['members', 'inventaris', 'medisAnggota', 'settings', 'arsipMusim']) {
  cek(`tabel ${t} tidak pernah dibersihkan`, !TABEL_MUSIMAN_DIARSIPKAN.includes(t))
}

console.log('— Anggota dinonaktifkan —')
const ANG = [
  { id: 'm1', name: 'A', active: 1, token: 't1', tags: ['CAB 42'] },
  { id: 'm2', name: 'B', active: 0, token: 't2' },
  { id: 'm3', name: 'C', active: 1, token: 't3' },
]
const non = nonaktifkanSemua(ANG)
cek('hanya yang aktif yang diubah', non.length === 2 && non.every((m) => m.active === 0))
cek('data lain (token QR, tag) utuh', non[0].token === 't1' && non[0].tags[0] === 'CAB 42')
cek('masukan tidak diubah (murni)', ANG[0].active === 1)
cek('daftar kosong aman', nonaktifkanSemua([]).length === 0 && nonaktifkanSemua(undefined).length === 0)

console.log('— Saldo awal kas —')
const s1 = transaksiSaldoAwal(1250000, 'Musim 2026', '2027-02-01', 'k1', 5)
cek('surplus → pemasukan_umum "Saldo awal"', s1.jenis === 'pemasukan_umum' && s1.nominal === 1250000 && s1.kategoriProgram === 'Saldo awal')
cek('keterangan menyebut musim asal', s1.keterangan.includes('Musim 2026') && s1.tanggal === '2027-02-01')
const s2 = transaksiSaldoAwal(-300000, 'Musim 2026', '2027-02-01', 'k2', 5)
cek('defisit → pengeluaran bernominal positif', s2.jenis === 'pengeluaran' && s2.nominal === 300000)
cek('saldo nol / NaN → tidak ada transaksi', transaksiSaldoAwal(0, 'x', '2027-01-01', 'k', 1) === null && transaksiSaldoAwal(NaN, 'x', '2027-01-01', 'k', 1) === null)

console.log('— Berkas yatim saat arsip dihapus —')
const arsipA = { id: 'a', muatanMusim: { songs: [{ id: 'lagu1' }, { id: 'lagu2' }], penilaianLomba: [{ id: 'p1' }] } }
const arsipB = { id: 'b', muatanMusim: { songs: [{ id: 'lagu2' }], penilaianLomba: [] } }
const rujukan = kumpulkanRujukanBerkas({ songs: [{ id: 'lagu3' }], penilaianLomba: [] }, [arsipB])
const yatim = berkasYatim(arsipA, rujukan, {
  partitur: [{ id: 'lagu1', songId: 'lagu1' }, { id: 'lagu2', songId: 'lagu2' }, { id: 'lagu3', songId: 'lagu3' }, { id: 'lain', songId: 'lain' }],
  audio: [{ id: 'lagu1', songId: 'lagu1' }],
  judgeTape: [{ id: 'p1', penilaianId: 'p1' }],
})
cek('berkas lagu yang hanya ada di arsip itu → dihapus', yatim.partitur.includes('lagu1') && yatim.audio.includes('lagu1') && yatim.judgeTape.includes('p1'))
cek('berkas yang masih dirujuk arsip lain → tetap', !yatim.partitur.includes('lagu2'))
cek('berkas lagu musim berjalan → tetap', !yatim.partitur.includes('lagu3'))
cek('berkas yang bukan milik arsip itu → tidak disentuh', !yatim.partitur.includes('lain'))

console.log('— Tanggal —')
cek('geser melewati akhir tahun', geserTanggal('2026-12-29', 7) === '2027-01-05')
cek('geser mundur', geserTanggal('2027-03-01', -1) === '2027-02-28')
// 8 Des 2026 = Selasa. Target 2 Feb 2027 = Selasa → 56 hari.
cek('pertahankan hari: Selasa → Selasa', hitungGeserHari('2026-12-08', '2027-02-02', true) === 56)
// Target Kamis 4 Feb → dibulatkan ke Selasa 2 Feb (selisih 58 → 56).
cek('pertahankan hari: dibulatkan ke kelipatan 7 terdekat', hitungGeserHari('2026-12-08', '2027-02-04', true) === 56)
cek('tanpa pertahankan hari: tepat', hitungGeserHari('2026-12-08', '2027-02-04', false) === 58)

console.log('— Ambil dari arsip —')
const ARSIP = {
  id: 'arsip1',
  namaMusim: 'Musim 2026',
  muatanMusim: {
    songs: [
      { id: 'L1', title: 'Pembuka', bpm: 120 },
      { id: 'L2', title: 'Balada', bpm: 80 },
      { id: 'L3', title: 'Penutup', bpm: 140 },
    ],
    drills: [{ id: 'D1', name: 'Show 1', songId: 'L2', rosterIds: ['m1'] }],
    sets: [
      { id: 'S1', drillId: 'D1', order: 0 },
      { id: 'S2', drillId: 'D1', order: 1 },
      { id: 'SX', drillId: 'D9', order: 0 },
    ],
    setlists: [{ id: 'SL1', name: 'Konser', songIds: ['L1', 'L3'] }],
    countSheets: [
      { id: 'C1', judul: 'Guard Show 1', drillId: 'D1', songId: 'L2' },
      { id: 'C2', judul: 'Guard Pembuka', songId: 'L1' },
      { id: 'C3', judul: 'Guard drill lain', drillId: 'D9' },
    ],
    anotasiPartitur: [{ id: 'L1', songId: 'L1' }, { id: 'L3', songId: 'L3' }],
    sessions: [
      { id: 'J2', title: 'Latihan Kamis', type: 'latihan', date: '2026-12-10', startTime: '18:00', endTime: '20:00', checklist: [{ id: 'c', text: 'Pad', done: 1 }], seriId: 'seri1', setListId: 'SL1', realisasiLatihan: [{}], mulaiNyata: 1, logRep: [{}], formPresensi: { m1: 1 } },
      { id: 'J1', title: 'Latihan Selasa', type: 'latihan', date: '2026-12-08', startTime: '18:00', endTime: '20:00', checklist: [], seriId: 'seri1' },
      { id: 'J3', title: 'Rapat', type: 'rapat', date: '2026-12-11', startTime: '18:00', endTime: '19:00', checklist: [] },
    ],
  },
}
const kosong = { songIds: new Set(), drillIds: new Set(), setlistIds: new Set() }
let n = 0
const buatId = (a) => `${a}${++n}`

const r1 = rencanaAmbilArsip(ARSIP, { songIds: [], drillIds: ['D1'], setlistIds: [], sessionIds: [] }, kosong, { geserHari: 0, buatId })
cek('drill membawa set miliknya saja', r1.drills.length === 1 && r1.sets.map((s) => s.id).join() === 'S1,S2')
cek('drill membawa lagunya (dilaporkan ikut terbawa)', r1.songs.map((s) => s.id).join() === 'L2' && r1.laguIkut.join() === 'Balada')
cek('lembar hitungan milik drill ikut, milik drill lain tidak', r1.countSheets.map((c) => c.id).join() === 'C1')
cek('lagu memakai id lama (berkas partitur tersambung lagi)', r1.songs[0].id === 'L2')

const r2 = rencanaAmbilArsip(ARSIP, { songIds: ['L1'], drillIds: [], setlistIds: ['SL1'], sessionIds: [] }, kosong, { geserHari: 0, buatId })
cek('set list membawa semua lagunya', r2.songs.map((s) => s.id).sort().join() === 'L1,L3' && r2.laguIkut.join() === 'Penutup')
cek('lagu yang dipilih langsung tidak dihitung "ikut terbawa"', !r2.laguIkut.includes('Pembuka'))
cek('anotasi partitur ikut lagunya', r2.anotasiPartitur.map((a) => a.id).sort().join() === 'L1,L3')
cek('lembar hitungan tanpa drill ikut lagunya', r2.countSheets.map((c) => c.id).join() === 'C2')

const ada = { songIds: new Set(['L1']), drillIds: new Set(['D1']), setlistIds: new Set() }
const r3 = rencanaAmbilArsip(ARSIP, { songIds: ['L1', 'L2'], drillIds: ['D1'], setlistIds: [], sessionIds: [] }, ada, { geserHari: 0, buatId })
cek('tidak pernah menimpa: lagu & drill yang sudah ada dilewati', !r3.songs.some((s) => s.id === 'L1') && r3.drills.length === 0)
cek('yang dilewati dilaporkan', r3.sudahAda.includes('Lagu "Pembuka"') && r3.sudahAda.includes('Drill "Show 1"'))
cek('lagu lain tetap ditambahkan', r3.songs.map((s) => s.id).join() === 'L2')

n = 0
const r4 = rencanaAmbilArsip(ARSIP, { songIds: [], drillIds: [], setlistIds: [], sessionIds: ['J1', 'J2', 'J3'] }, kosong, { geserHari: 56, buatId })
cek('sesi diurutkan menurut tanggal & digeser', r4.sessions.map((s) => s.date).join() === '2027-02-02,2027-02-04,2027-02-05')
cek('sesi mendapat id baru', r4.sessions.every((s) => !['J1', 'J2', 'J3'].includes(s.id)))
cek('seri berulang tetap satu seri dengan id baru', r4.sessions[0].seriId && r4.sessions[0].seriId === r4.sessions[1].seriId && r4.sessions[0].seriId !== 'seri1')
const kamis = r4.sessions[1]
cek('centang checklist dikosongkan', kamis.checklist[0].done === 0 && kamis.checklist[0].text === 'Pad')
cek('jejak pelaksanaan musim lalu dibuang', !('realisasiLatihan' in kamis) && !('mulaiNyata' in kamis) && !('logRep' in kamis) && !('formPresensi' in kamis))
cek('rujukan set list yang tidak diambil dikosongkan & dilaporkan', kamis.setListId === undefined && r4.rujukanDiputus.some((x) => x.includes('Latihan Kamis')))
cek('arsip tidak berubah (murni)', ARSIP.muatanMusim.sessions[0].checklist[0].done === 1 && ARSIP.muatanMusim.sessions[0].date === '2026-12-10')

const r5 = rencanaAmbilArsip(ARSIP, { songIds: [], drillIds: [], setlistIds: ['SL1'], sessionIds: ['J2'] }, kosong, { geserHari: 0, buatId })
cek('sesi tetap menunjuk set list bila ikut diambil', r5.sessions[0].setListId === 'SL1' && r5.rujukanDiputus.length === 0)
cek('ringkasan teks', teksRencanaAmbil(r5) === '2 lagu, 1 set list, 1 sesi jadwal' && teksRencanaAmbil(rencanaAmbilArsip(ARSIP, { songIds: [], drillIds: [], setlistIds: [], sessionIds: [] }, kosong, { geserHari: 0, buatId })) === 'tidak ada yang baru')

console.log('— Nama berkas backup akhir musim —')
const t = new Date('2027-01-31T10:00:00Z')
const nm = namaBackupAkhirMusim('Musim Kompetisi 2026/2027', t)
cek('nama menyebut AKHIR MUSIM & musimnya, garis miring jadi tanda hubung', nm === 'DrillKit - BACKUP AKHIR MUSIM - Musim Kompetisi 2026-2027 - 2027-01-31.zip', nm)
cek('nama musim kosong tetap aman', namaBackupAkhirMusim('  ', t).includes('BACKUP AKHIR MUSIM - Musim - '))
cek('nama backup biasa tidak berubah', namaBackupZip(t) === 'DrillKit - BACKUP LENGKAP + REKAMAN - 2027-01-31.zip')

console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) process.exit(1)
