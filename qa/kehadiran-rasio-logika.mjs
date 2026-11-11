/**
 * v2.8 — Kehadiran berbasis rasio, jatah telat, kategori izin + bukti,
 * Google Form presensi, dan impor CSV jawaban Google Form (logika murni).
 *
 * Aturan sumber: Lembar Info Musim CAB 42 — apel 17.30, latihan 18.00–20.00,
 * datang ≤ 18.30 hadir, 18.31–19.00 beralasan + bukti memakai jatah telat,
 * lewat 19.00 tidak hadir; N=12 → hadir 7, alpa 3, telat 2; oprec susulan
 * N=7 → 5/2/1; 7 kategori izin, semuanya berbukti; presensi = Google Form
 * (dibuka 24 jam) + absen fisik admin, keduanya wajib.
 *
 * Jalankan: bash qa/bangun-logika.sh && node qa/kehadiran-rasio-logika.mjs
 */
import {
  ATURAN_BAKU, KATEGORI_IZIN_BAKU, batasRasio, lengkapiAturan, jendelaDatang, statusDatang, keabsahanIzin, batasLapor,
  kodeKehadiran, nilaiPeserta, ringkasAturan, sesiBerForm,
} from '/tmp/programLatsar.mjs'
import {
  bacaCsvForm, tebakKolomGForm, tebakUrutanTanggal, bacaCapWaktu, bacaTanggalForm, bacaJamForm, tebakKategoriIzin,
  cocokkanNamaForm, sesiUntukIsian, rencanakanImporForm, terapkanImporForm, ringkasRencanaForm,
} from '/tmp/imporGForm.mjs'

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
const ms = (d, h, m = 0, bulan = 11) => new Date(2026, bulan - 1, d, h, m).getTime()
const A = lengkapiAturan(ATURAN_BAKU)

/* ------------------------------- rasio ------------------------------- */
console.log('\n— Batas dari N sesi —')
const TABEL = { 6: [4, 2, 1], 7: [5, 2, 1], 8: [5, 2, 1], 9: [6, 2, 2], 10: [6, 3, 2], 12: [7, 3, 2], 14: [9, 4, 2], 15: [9, 4, 3], 16: [10, 4, 3] }
for (const [n, [h, a, t]] of Object.entries(TABEL)) {
  const b = batasRasio(Number(n), A)
  cek(`N=${n} → hadir ${h} · alpa ${a} · telat ${t}`, b.hadir === h && b.alpa === a && b.telat === t, JSON.stringify(b))
}
cek('N=0 → semua 0', JSON.stringify(batasRasio(0, A)) === JSON.stringify({ hadir: 0, alpa: 0, telat: 0 }))
cek('rasio lain (2/3) → N=12 hadir 8', batasRasio(12, { ...A, rasioHadir: [2, 3] }).hadir === 8)
cek('ringkasan aturan memuat angka N', ringkasAturan(A, 12).includes('N = 12 → hadir min. 7, alpa maks. 3, jatah telat 2'))

console.log('\n— Melengkapi aturan —')
const lama = lengkapiAturan({ persenMin: 70, hadirMin: 7, sakitMaksJam: 12, batasGabung: '2026-11-24' })
cek('aturan #36: persenMin/hadirMin dibuang, rasio bawaan', !('persenMin' in lama) && !('hadirMin' in lama) && lama.rasioHadir.join('/') === '7/12')
cek('aturan #36: sakitMaksJam & batasGabung dipertahankan', lama.sakitMaksJam === 12 && lama.batasGabung === '2026-11-24')
cek('rasio rusak (a > b, b = 0) → bawaan', lengkapiAturan({ rasioAlpa: [5, 4], rasioTelat: [1, 0], sakitMaksJam: 24 }).rasioAlpa.join('/') === '1/4' && lengkapiAturan({ rasioTelat: [1, 0], sakitMaksJam: 24 }).rasioTelat.join('/') === '1/6')
cek('batas izin bukan HH:MM dibuang', lengkapiAturan({ batasIzin: '15.00', sakitMaksJam: 24 }).batasIzin === undefined && lengkapiAturan({ batasIzin: '15:00', sakitMaksJam: 24 }).batasIzin === '15:00')
cek('kategori "lain" tidak boleh jadi kategori diterima', !lengkapiAturan({ kategoriIzin: [{ id: 'lain', nama: 'Lain', bukti: '' }, { id: 'x', nama: 'X', bukti: '' }], sakitMaksJam: 24 }).kategoriIzin.some((k) => k.id === 'lain'))
cek('7 kategori bawaan', KATEGORI_IZIN_BAKU.length === 7 && A.kategoriIzin.length === 7 && A.kategoriIzin[0].id === 'sakit')
cek('kategori bawaan disalin (bukan rujukan bersama)', lengkapiAturan(null).kategoriIzin !== lengkapiAturan(null).kategoriIzin)

/* ------------------------------- jam datang ------------------------------- */
console.log('\n— Jam datang & jatah telat —')
const KAMIS = { id: 's1', date: '2026-11-19', startTime: '18:00', endTime: '20:00' }
const MINGGU = { id: 's2', date: '2026-11-29', startTime: '15:00', endTime: '19:00' }
const j = jendelaDatang(KAMIS, A)
cek('18.00–20.00: tepat ≤ 18.30, jatah s.d. 19.00 (½ durasi)', j.tepat === ms(19, 18, 30) && j.batasJatah === ms(19, 19))
const jm = jendelaDatang(MINGGU, A)
cek('Minggu 15.00–19.00: tepat ≤ 15.30, jatah s.d. 17.00', jm.tepat === ms(29, 15, 30) && jm.batasJatah === ms(29, 17))
cek('batas jatah diatur 45 menit → 18.45', jendelaDatang(KAMIS, { ...A, batasJatahMenit: 45 }).batasJatah === ms(19, 18, 45))
cek('batas jatah < toleransi → disamakan dengan toleransi', jendelaDatang(KAMIS, { ...A, batasJatahMenit: 10 }).batasJatah === ms(19, 18, 30))
const H = (h, m, x = {}) => ({ status: 'hadir', datangAt: ms(19, h, m), ...x })
const AL = { alasanTelat: 'praktikum', bukti: 'ada' }
cek('18.20 → tepat', statusDatang(H(18, 20), KAMIS, A) === 'tepat')
cek('18.30 tepat → masih tepat', statusDatang(H(18, 30), KAMIS, A) === 'tepat')
cek('18.31 beralasan + bukti → jatah', statusDatang(H(18, 31, AL), KAMIS, A) === 'jatah')
cek('19.00 tepat beralasan → jatah', statusDatang(H(19, 0, AL), KAMIS, A) === 'jatah')
cek('19.01 → lewat batas', statusDatang(H(19, 1, AL), KAMIS, A) === 'lewat-batas')
cek('18.45 tanpa alasan → tanpa-alasan', statusDatang(H(18, 45), KAMIS, A) === 'tanpa-alasan')
cek('18.45 beralasan tanpa bukti → tanpa-bukti', statusDatang(H(18, 45, { alasanTelat: 'macet' }), KAMIS, A) === 'tanpa-bukti')
cek('bukti tidak diwajibkan → jatah', statusDatang(H(18, 45, { alasanTelat: 'macet' }), KAMIS, { ...A, wajibBukti: false }) === 'jatah')
cek('putusan pelatih menang (19.20 → dihitung)', statusDatang(H(19, 20, { putusanIzin: 'sah' }), KAMIS, A) === 'putusan-sah')
cek('jam datang tidak dicatat → null (dianggap tepat)', statusDatang({ status: 'hadir' }, KAMIS, A) === null)
cek('checkInAt (jam tombol) tidak dipakai menilai telat', statusDatang({ status: 'hadir', checkInAt: ms(19, 21) }, KAMIS, A) === null)
cek('kode: telat berjatah / telat tak dihitung', kodeKehadiran({ ...H(18, 45, AL), memberId: 'a' }, KAMIS, A, '2026-11-20') === 'telat-jatah' && kodeKehadiran({ ...H(19, 15, AL), memberId: 'a' }, KAMIS, A, '2026-11-20') === 'telat')

/* ------------------------------- izin ------------------------------- */
console.log('\n— Izin: batas lapor, kategori, bukti —')
const A15 = { ...A, batasIzin: '15:00' }
const I = (h, m, x = {}) => ({ status: 'izin', dilaporAt: ms(19, h, m), bukti: 'ada', ...x })
cek('batas izin 15.00: 14.59 sah, 15.00 terlambat', keabsahanIzin(I(14, 59), KAMIS, A15) === 'sah' && keabsahanIzin(I(15, 0), KAMIS, A15) === 'telat')
cek('batas izin tidak boleh lewat jam mulai (19:00 → 18.00)', batasLapor('izin', KAMIS, { ...A, batasIzin: '19:00' }) === ms(19, 18))
cek('kategori di daftar → sah', keabsahanIzin(I(10, 0, { kategoriIzin: 'kuliah' }), KAMIS, A) === 'sah')
cek('kategori "lain" → ditolak', keabsahanIzin(I(10, 0, { kategoriIzin: 'lain' }), KAMIS, A) === 'ditolak')
cek('kategori yang dihapus dari daftar musim → ditolak', keabsahanIzin(I(10, 0, { kategoriIzin: 'organisasi' }), KAMIS, { ...A, kategoriIzin: A.kategoriIzin.filter((k) => k.id !== 'organisasi') }) === 'ditolak')
cek('tanpa bukti → tanpa-bukti; kode tanpa-bukti', keabsahanIzin(I(10, 0, { bukti: undefined }), KAMIS, A) === 'tanpa-bukti' && kodeKehadiran({ ...I(10, 0, { bukti: ' ' }), memberId: 'a' }, KAMIS, A, '2026-11-20') === 'tanpa-bukti')
cek('kode izin ditolak', kodeKehadiran({ ...I(10, 0, { kategoriIzin: 'lain' }), memberId: 'a' }, KAMIS, A, '2026-11-20') === 'izin-ditolak')

/* ------------------------------- Google Form ------------------------------- */
console.log('\n— Google Form presensi —')
const BERFORM = { ...KAMIS, formPresensi: { a: ms(18, 16) } }
cek('sesi berform hanya bila ada isian', sesiBerForm(BERFORM) && !sesiBerForm(KAMIS) && !sesiBerForm({ formPresensi: {} }))
cek('hadir + isi Form → hadir', kodeKehadiran({ status: 'hadir', memberId: 'a' }, BERFORM, A, '2026-11-20') === 'hadir')
cek('hadir tanpa Form → tanpa-form', kodeKehadiran({ status: 'hadir', memberId: 'b' }, BERFORM, A, '2026-11-20') === 'tanpa-form')
cek('putusan pelatih "sah" menghapus tanpa-form', kodeKehadiran({ status: 'hadir', memberId: 'b', putusanIzin: 'sah' }, BERFORM, A, '2026-11-20') === 'hadir')
cek('wajib Form dimatikan → hadir', kodeKehadiran({ status: 'hadir', memberId: 'b' }, BERFORM, { ...A, wajibForm: false }, '2026-11-20') === 'hadir')
cek('sesi tanpa impor Form tidak menghukum', kodeKehadiran({ status: 'hadir', memberId: 'b' }, KAMIS, A, '2026-11-20') === 'hadir')
cek('izin tidak butuh Form presensi', kodeKehadiran({ ...I(10, 0), memberId: 'b' }, BERFORM, A, '2026-11-20') === 'izin-sah')

/* ------------------------------- jatah telat urut ------------------------------- */
console.log('\n— Jatah telat dipakai urut tanggal (oprec N=7 → jatah 1) —')
const tujuh = Array.from({ length: 7 }, (_, i) => ({ id: `w${i}`, date: `2026-11-${String(24 + i).padStart(2, '0')}`, startTime: '18:00', endTime: '20:00' }))
const telatKe = (i) => ({ id: `r${i}`, sessionId: `w${i}`, memberId: 'z', status: 'hadir', datangAt: new Date(2026, 10, 24 + i, 18, 45).getTime(), ...AL })
const peta = new Map([0, 1, 2].map((i) => [`w${i}|z`, telatKe(i)]))
const prog = { aturan: A, peserta: [], wajibIds: tujuh.map((s) => s.id) }
const nz = nilaiPeserta(prog, { memberId: 'z', bergabung: '2026-11-24' }, tujuh, peta, '2026-11-27')
cek('N=7: jatah telat 1 → sesi 1 berjatah, sesi 2–3 tidak dihitung', nz.rincian.slice(0, 3).join() === 'telat-jatah,telat,telat' && nz.maksTelat === 1 && nz.telatJatah === 1 && nz.sisaTelat === 0, nz.rincian.join())
cek('N=7: alpa 2 = batas → kritis', nz.alpa === 2 && nz.maksAlpa === 2 && nz.status === 'kritis', nz.alasan)

/* ------------------------------- impor: CSV ------------------------------- */
console.log('\n— Impor Form: baca CSV —')
const csv1 = 'Timestamp,Nama Lengkap,Alasan izin\r\n12/11/2026 14:03:22,Budi Santoso,"Praktikum\nKimia, sampai malam"\r\n"13/11/2026 9:05:00","Rina ""Ina"" Putri",Sakit\r\n\r\n'
const t1 = bacaCsvForm(csv1)
cek('sel berkutip dengan baris baru & koma tetap satu sel', t1.length === 3 && t1[1][2] === 'Praktikum\nKimia, sampai malam')
cek('kutip ganda di dalam sel', t1[2][1] === 'Rina "Ina" Putri')
cek('pemisah titik koma (Excel Indonesia)', bacaCsvForm('Cap waktu;Nama\n12/11/2026 10:00:00;Budi, S.')[1][1] === 'Budi, S.')
const k1 = tebakKolomGForm(['Stempel waktu', 'Nama Lengkap', 'Nama Panggilan', 'Tanggal latihan yang ditinggalkan', 'Kategori izin', 'Alasan / keterangan', 'Upload bukti'])
cek('tebak kolom Form izin Indonesia', k1.waktu === 0 && k1.nama === 1 && k1.tanggal === 3 && k1.kategori === 4 && k1.alasan === 5 && k1.bukti === 6, JSON.stringify(k1))
const k2 = tebakKolomGForm(['Nama', 'Seksi', 'Jam datang', 'Keterangan'])
cek('tebak kolom absen fisik', k2.nama === 0 && k2.jam === 2 && k2.alasan === 3 && k2.waktu === -1)
cek('Timestamp bahasa Inggris', tebakKolomGForm(['Timestamp', 'Full name']).waktu === 0)

console.log('\n— Impor Form: tanggal, jam, kategori, nama —')
cek('urutan tanggal: 13/11 → d/m', tebakUrutanTanggal(['12/11/2026 10:00', '13/11/2026 11:00']) === 'dmy')
cek('urutan tanggal: 11/13 → m/d', tebakUrutanTanggal(['11/12/2026 10:00', '11/13/2026 11:00']) === 'mdy')
cek('urutan ambigu → d/m (Form Indonesia)', tebakUrutanTanggal(['01/02/2026']) === 'dmy')
cek('cap waktu d/m 14:03:22', bacaCapWaktu('12/11/2026 14:03:22') === ms(12, 14, 3))
cek('cap waktu m/d', bacaCapWaktu('11/12/2026 9:05:00', 'mdy') === ms(12, 9, 5))
cek('cap waktu ISO & titik jam', bacaCapWaktu('2026-11-12 14.03') === ms(12, 14, 3))
cek('cap waktu rusak → null', bacaCapWaktu('kemarin sore') === null && bacaCapWaktu('31/02/2026 10:00') === null)
cek('tanggal panjang "Kamis, 12 November 2026"', bacaTanggalForm('Kamis, 12 November 2026') === '2026-11-12')
cek('tanggal "12 Nov" memakai tahun cap waktu', bacaTanggalForm('12 Nov', 'dmy', 2026) === '2026-11-12')
cek('jam "18.45", "18:45:10", "6:45 PM"', bacaJamForm('18.45') === 1125 && bacaJamForm('18:45:10') === 1125 && bacaJamForm('6:45 PM') === 1125)
cek('jam rusak → null', bacaJamForm('-') === null && bacaJamForm('25:00') === null)
const K = A.kategoriIzin
cek('kategori dari nama persis (pilihan Form)', tebakKategoriIzin('Sakit parah', K) === 'sakit' && tebakKategoriIzin('Lomba mewakili kampus/daerah', K) === 'lomba')
cek('kategori dari kata kunci', tebakKategoriIzin('praktikum kimia dasar', K) === 'kuliah' && tebakKategoriIzin('Kakek datang dari Medan', K) === 'ortu' && tebakKategoriIzin('misa arwah', K) === 'agama' && tebakKategoriIzin('ikut PORDA renang', K) === 'lomba')
cek('rapat organisasi bukan izin → lain', tebakKategoriIzin('Rapat BEM', K) === 'lain')
cek('alasan tak dikenal → lain; kosong → undefined', tebakKategoriIzin('nonton konser', K) === 'lain' && tebakKategoriIzin('  ', K) === undefined)
const AG = [
  { id: 'm1', name: 'Budi Santoso', panggilan: 'Budi', code: 'B01' },
  { id: 'm2', name: 'Rina Putri', panggilan: 'Ina', code: 'B02' },
  { id: 'm3', name: 'Rina Kartika', code: 'P01' },
  { id: 'm4', name: 'Yohanes Bayu', panggilan: 'Bayu', code: 'G01' },
]
cek('nama persis', cocokkanNamaForm('budi santoso', AG).memberId === 'm1')
cek('nama panggilan', cocokkanNamaForm('Bayu', AG).memberId === 'm4')
cek('kode anggota', cocokkanNamaForm('p01', AG).memberId === 'm3')
cek('nama ambigu (dua Rina) → tidak dipilih otomatis, ada kandidat', cocokkanNamaForm('Rina', AG).memberId === null && cocokkanNamaForm('Rina', AG).kandidat.length >= 2)
cek('salah ketik ringan tetap cocok', cocokkanNamaForm('Budi Santosa', AG).memberId === 'm1')

console.log('\n— Impor Form: sesi —')
const SES = [
  { id: 'k19', date: '2026-11-19', startTime: '18:00', endTime: '20:00', title: 'Latsar', checklist: [] },
  { id: 'j20', date: '2026-11-20', startTime: '18:00', endTime: '20:00', title: 'Latsar', checklist: [] },
  { id: 'm29', date: '2026-11-29', startTime: '15:00', endTime: '19:00', title: 'Latsar', checklist: [] },
]
cek('presensi Rabu 15.00 → sesi Kamis', sesiUntukIsian('presensi', ms(18, 15), null, SES)?.id === 'k19')
cek('presensi Kamis 19.30 (sesi berjalan) → Kamis; 20.30 → Jumat', sesiUntukIsian('presensi', ms(19, 19, 30), null, SES)?.id === 'k19' && sesiUntukIsian('presensi', ms(19, 20, 30), null, SES)?.id === 'j20')
cek('presensi > 48 jam sebelum sesi → tidak ada', sesiUntukIsian('presensi', ms(25, 10), null, SES) === null)
cek('izin dengan kolom tanggal → sesi tanggal itu', sesiUntukIsian('izin', ms(10, 10), '2026-11-29', SES)?.id === 'm29')
cek('absen fisik tanpa tanggal → hari cap waktu', sesiUntukIsian('datang', ms(20, 18, 10), null, SES)?.id === 'j20')

/* ------------------------------- impor: rencana & terapkan ------------------------------- */
console.log('\n— Impor Form: rencana & terapkan —')
let seq = 0
const buatId = () => `n${++seq}`
const ANG = AG.map((m) => ({ ...m, section: 'brass', instrument: 'Trumpet', role: 'member', joinYear: 2026, active: true, createdAt: 1 }))
// presensi
const rowsP = bacaCsvForm('Timestamp,Nama\n18/11/2026 15:10:00,Budi Santoso\n18/11/2026 16:00:00,Yohanes Bayu\n18/11/2026 17:00:00,Budi Santoso\n19/11/2026 08:00:00,Orang Asing\n18/11/2026 19:00:00,Rina')
const petaP = tebakKolomGForm(rowsP[0])
const sesF = SES.map((s) => (s.id === 'k19' ? { ...s, formPresensi: { m4: ms(18, 15, 30) } } : s))
const rp = rencanakanImporForm({ jenis: 'presensi', baris: rowsP.slice(1), peta: petaP, urutan: 'dmy', anggota: ANG, sesi: sesF, catatan: [], kategori: K })
cek('presensi: Budi baru, Bayu sudah tercatat lebih awal → sama', rp[0].aksi === 'tambah' && rp[1].aksi === 'sama' && rp[0].sesiId === 'k19', rp.map((b) => b.aksi).join())
cek('presensi: isian ganda, nama asing, nama ambigu dilewati', rp[2].aksi === 'ganda' && rp[3].aksi === 'lewati' && rp[4].aksi === 'lewati' && rp[4].pesan.includes('pilih'))
const rp2 = rencanakanImporForm({ jenis: 'presensi', baris: rowsP.slice(1), peta: petaP, urutan: 'dmy', anggota: ANG, sesi: sesF, catatan: [], kategori: K, pilihan: { 5: 'm2' } })
cek('presensi: pilihan manual menyelesaikan nama ambigu', rp2[4].memberId === 'm2' && rp2[4].aksi === 'tambah')
const hp = terapkanImporForm('presensi', rp2, [], sesF, buatId)
cek('presensi: tersimpan di Session.formPresensi, tanpa catatan absen', hp.catatan.length === 0 && hp.form.k19.m1 === ms(18, 15, 10) && hp.form.k19.m4 === ms(18, 15, 30) && hp.form.k19.m2 === ms(18, 19) && hp.jumlah === 2)
const ringP = ringkasRencanaForm(rp)
cek('ringkasan per aksi', ringP.tambah === 1 && ringP.sama === 1 && ringP.ganda === 1 && ringP.lewati === 2)
// izin
const rowsI = bacaCsvForm(
  'Stempel waktu,Nama Lengkap,Tanggal latihan,Kategori izin,Alasan,Upload bukti\n' +
    '19/11/2026 10:00:00,Budi Santoso,19/11/2026,Praktikum / asistensi,praktikum fisika,https://drive.google.com/open?id=abc\n' +
    '19/11/2026 11:00:00,Yohanes Bayu,19/11/2026,,demam tinggi,\n' +
    '19/11/2026 12:00:00,Rina Kartika,19/11/2026,,Rapat HIMA,\n' +
    '20/11/2026 09:00:00,Rina Putri,20/11/2026,Berduka,,https://drive.google.com/open?id=def\n',
)
const ada = [
  { id: 'x1', sessionId: 'k19', memberId: 'm3', status: 'hadir' },
  { id: 'x2', sessionId: 'j20', memberId: 'm2', status: 'izin', dilaporAt: ms(20, 12), note: 'duka' },
]
const ri = rencanakanImporForm({ jenis: 'izin', baris: rowsI.slice(1), peta: tebakKolomGForm(rowsI[0]), urutan: 'dmy', anggota: ANG, sesi: SES, catatan: ada, kategori: K })
cek('izin: kategori dari pilihan & kata kunci', ri[0].kategori === 'kuliah' && ri[1].kategori === 'sakit' && ri[2].kategori === 'lain', ri.map((b) => b.kategori).join())
cek('izin: tercatat hadir → bentrok, izin lama → perbarui', ri[2].aksi === 'bentrok' && ri[3].aksi === 'perbarui', ri.map((b) => b.aksi).join())
const hi = terapkanImporForm('izin', ri, ada, SES, buatId)
const cBudi = hi.catatan.find((r) => r.memberId === 'm1')
const cBayu = hi.catatan.find((r) => r.memberId === 'm4')
const cRina = hi.catatan.find((r) => r.memberId === 'm2')
cek('izin: jam lapor = cap waktu, bukti = tautan unggah', cBudi.status === 'izin' && cBudi.dilaporAt === ms(19, 10) && cBudi.bukti.includes('id=abc') && cBudi.kategoriIzin === 'kuliah' && cBudi.note === 'praktikum fisika')
cek('izin: kategori sakit → status sakit (tanpa bukti)', cBayu.status === 'sakit' && !cBayu.bukti)
cek('izin: catatan lama dipertahankan, jam lapor diambil yang lebih awal', cRina.id === 'x2' && cRina.dilaporAt === ms(20, 9) && cRina.note === 'duka' && cRina.kategoriIzin === 'duka')
cek('izin: hasil impor dinilai aturan — Budi sah, Bayu tanpa bukti', kodeKehadiran(cBudi, SES[0], A, '2026-11-20') === 'izin-sah' && kodeKehadiran(cBayu, SES[0], A, '2026-11-20') === 'tanpa-bukti')
// datang
const rowsD = bacaCsvForm('Nama,Tanggal,Jam datang,Keterangan\nBudi Santoso,19/11/2026,18.20,\nYohanes Bayu,19/11/2026,18.50,kelas pengganti\nRina Putri,20/11/2026,18.10,\nRina Kartika,19/11/2026,19.20,')
const adaD = [
  { id: 'y1', sessionId: 'j20', memberId: 'm2', status: 'izin', dilaporAt: ms(20, 9) },
  { id: 'y2', sessionId: 'k19', memberId: 'm3', status: 'alpha' },
]
const rd = rencanakanImporForm({ jenis: 'datang', baris: rowsD.slice(1), peta: tebakKolomGForm(rowsD[0]), urutan: 'dmy', anggota: ANG, sesi: SES, catatan: adaD, kategori: K })
cek('absen fisik: baru, izin → bentrok, alpha → perbarui', rd[0].aksi === 'tambah' && rd[2].aksi === 'bentrok' && rd[3].aksi === 'perbarui', rd.map((b) => b.aksi).join())
const hd = terapkanImporForm('datang', rd, adaD, SES, buatId)
const dBayu = hd.catatan.find((r) => r.memberId === 'm4')
const dRk = hd.catatan.find((r) => r.memberId === 'm3')
cek('absen fisik: jam datang & alasan telat tersimpan', dBayu.status === 'hadir' && dBayu.datangAt === ms(19, 18, 50) && dBayu.alasanTelat === 'kelas pengganti')
cek('absen fisik: dinilai aturan — Bayu telat tanpa bukti, Rina K. lewat 19.00', statusDatang(dBayu, SES[0], A) === 'tanpa-bukti' && kodeKehadiran(dRk, SES[0], A, '2026-11-20') === 'telat' && dRk.id === 'y2')

console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) process.exit(1)
