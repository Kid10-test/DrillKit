/**
 * v2.10.1 — jam pulang (pulang awal memakai jatah telat; waktu ikut minimal
 * setengah sesi) dan kolom Status / Jam pulang pada impor Google Form.
 *
 * Aturan sumber: Aturan Absensi Latsar CAB 42 — latihan 18.00–20.00,
 * toleransi 30 menit, telat/pulang awal beralasan + bukti memakai jatah,
 * waktu ikut minimal 50% latihan. Sesi 17.30–20.15 dihitung dari jam inti
 * 18.00–20.00 (pra-latihan 30 menit, penutup 15 menit).
 *
 * Jalankan: bash qa/bangun-logika.sh && node qa/jam-pulang-logika.mjs
 */
import { ATURAN_BAKU, lengkapiAturan, statusDatang, kodeKehadiran, pulangAwal, menitIkut, labelDatang, jendelaDatang, intiSesi } from '/tmp/programLatsar.mjs'
import { bacaCsvForm, tebakKolomGForm, rencanakanImporForm, terapkanImporForm, bacaStatusIsian, POLA_KOLOM, alasanIsian, bacaJamForm, jamUntukSesi, bacaCapWaktu, isianBermakna, keteranganIsian } from '/tmp/imporGForm.mjs'

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

const A = lengkapiAturan({ ...ATURAN_BAKU, wajibBukti: true })
const KAMIS = { id: 'k19', date: '2026-11-19', startTime: '18:00', endTime: '20:00', title: 'Latsar', type: 'latihan', checklist: [], createdAt: 0 }
const ms = (h, m) => new Date(2026, 10, 19, h, m).getTime()
const AL = { alasanTelat: 'kontrol ke dokter', bukti: 'ada' }
const H = (o) => ({ status: 'hadir', ...o })

console.log('== jam pulang: penilaian ==')
cek('tanpa jam datang & pulang → null', statusDatang(H({}), KAMIS, A) === null)
cek('pulang 20.00 → tepat', statusDatang(H({ pulangAt: ms(20, 0) }), KAMIS, A) === 'tepat')
cek('pulang 19.30 (dalam toleransi 30′) → tepat', statusDatang(H({ pulangAt: ms(19, 30) }), KAMIS, A) === 'tepat')
cek('pulang 19.29 tanpa alasan → tanpa-alasan', statusDatang(H({ pulangAt: ms(19, 29) }), KAMIS, A) === 'tanpa-alasan')
cek('pulang 19.00 beralasan + bukti → jatah', statusDatang(H({ pulangAt: ms(19, 0), ...AL }), KAMIS, A) === 'jatah')
cek('pulang 19.00 beralasan tanpa bukti → tanpa-bukti', statusDatang(H({ pulangAt: ms(19, 0), alasanTelat: 'x' }), KAMIS, A) === 'tanpa-bukti')
cek('pulang 18.59 (ikut 59′ < 60′) → lewat-batas', statusDatang(H({ pulangAt: ms(18, 59), ...AL }), KAMIS, A) === 'lewat-batas')
cek('telat 18.40 + pulang 19.40 (ikut 60′) → jatah', statusDatang(H({ datangAt: ms(18, 40), pulangAt: ms(19, 40), ...AL }), KAMIS, A) === 'jatah')
cek('telat 18.40 + pulang 19.20 (ikut 40′) → lewat-batas', statusDatang(H({ datangAt: ms(18, 40), pulangAt: ms(19, 20), ...AL }), KAMIS, A) === 'lewat-batas')
cek('datang 18.20 + pulang 19.20 beralasan (ikut 60′) → jatah', statusDatang(H({ datangAt: ms(18, 20), pulangAt: ms(19, 20), ...AL }), KAMIS, A) === 'jatah')
cek('datang 18.20 + pulang 19.10 (ikut 50′) → lewat-batas', statusDatang(H({ datangAt: ms(18, 20), pulangAt: ms(19, 10), ...AL }), KAMIS, A) === 'lewat-batas')
cek('putusan pelatih menang atas pulang awal', statusDatang(H({ pulangAt: ms(18, 30), putusanIzin: 'sah' }), KAMIS, A) === 'putusan-sah')
cek('jam datang lama tetap sama (19.01 → lewat batas)', statusDatang(H({ datangAt: ms(19, 1), ...AL }), KAMIS, A) === 'lewat-batas')
cek('jam datang lama tetap sama (18.45 beralasan → jatah)', statusDatang(H({ datangAt: ms(18, 45), ...AL }), KAMIS, A) === 'jatah')

console.log('== jam pulang: bantuan ==')
cek('pulangAwal: 19.29 ya, 19.30 tidak', pulangAwal(H({ pulangAt: ms(19, 29) }), KAMIS, A) && !pulangAwal(H({ pulangAt: ms(19, 30) }), KAMIS, A))
cek('pulangAwal: bukan hadir → tidak', !pulangAwal({ status: 'izin', pulangAt: ms(18, 30) }, KAMIS, A))
cek('menitIkut: penuh = 120', menitIkut({}, KAMIS) === 120)
cek('menitIkut: 18.40–19.40 = 60', menitIkut({ datangAt: ms(18, 40), pulangAt: ms(19, 40) }, KAMIS) === 60)
cek('menitIkut: datang sebelum mulai dihitung dari 18.00', menitIkut({ datangAt: ms(17, 30), pulangAt: ms(19, 0) }, KAMIS) === 60)
cek('menitIkut: pulang sebelum datang → 0', menitIkut({ datangAt: ms(19, 0), pulangAt: ms(18, 50) }, KAMIS) === 0)
cek('label: pulang awal berjatah', labelDatang('jatah', H({ pulangAt: ms(19, 0) }), KAMIS, A) === 'pulang awal berjatah')
cek('label: telat & pulang awal', labelDatang('jatah', H({ datangAt: ms(18, 40), pulangAt: ms(19, 0) }), KAMIS, A).startsWith('telat & pulang awal'))
cek('label: lewat batas karena pulang menyebut waktu ikut', labelDatang('lewat-batas', H({ pulangAt: ms(18, 30) }), KAMIS, A).includes('waktu ikut'))
cek('label: telat biasa tidak berubah', labelDatang('jatah', H({ datangAt: ms(18, 45) }), KAMIS, A) === 'telat berjatah')

console.log('== jam pulang: kode kehadiran ==')
const rec = (o) => ({ id: 'r', sessionId: 'k19', memberId: 'm1', status: 'hadir', ...o })
cek('pulang 19.00 berjatah → telat-jatah', kodeKehadiran(rec({ pulangAt: ms(19, 0), ...AL }), KAMIS, A, '2026-11-20') === 'telat-jatah')
cek('pulang 18.30 → telat (tidak dihitung)', kodeKehadiran(rec({ pulangAt: ms(18, 30), ...AL }), KAMIS, A, '2026-11-20') === 'telat')
cek('pulang 19.45 → hadir', kodeKehadiran(rec({ pulangAt: ms(19, 45) }), KAMIS, A, '2026-11-20') === 'hadir')

console.log('== impor Form: kolom Status & Jam pulang ==')
cek('POLA_KOLOM diekspor & memuat pulang/status', Array.isArray(POLA_KOLOM) && POLA_KOLOM.some(([k]) => k === 'pulang') && POLA_KOLOM.some(([k]) => k === 'status'))
const judulD2 = ['Timestamp', 'Nama lengkap', 'Section', 'Tanggal latihan', 'Status', 'Kategori izin', 'Alasan', 'Jam datang', 'Jam pulang', 'Upload bukti']
const k = tebakKolomGForm(judulD2)
cek('tebak: Status = kolom 4', k.status === 4, JSON.stringify(k))
cek('tebak: Jam datang = 7, Jam pulang = 8', k.jam === 7 && k.pulang === 8, JSON.stringify(k))
cek('tebak: Tanggal = 3, Alasan = 6, Bukti = 9, Kategori = 5', k.tanggal === 3 && k.alasan === 6 && k.bukti === 9 && k.kategori === 5, JSON.stringify(k))
cek('tebak: "Keterangan" saja tetap alasan', tebakKolomGForm(['Nama', 'Keterangan']).alasan === 1 && tebakKolomGForm(['Nama', 'Keterangan']).status === -1)
cek('tebak: "Waktu pulang" → pulang', tebakKolomGForm(['Nama', 'Waktu pulang']).pulang === 1)
cek('status: Hadir', bacaStatusIsian('Hadir') === 'hadir')
cek('status: Izin / Tidak hadir', bacaStatusIsian('Izin') === 'izin' && bacaStatusIsian('Tidak hadir') === 'izin')
cek('status: Sakit', bacaStatusIsian('Sakit') === 'sakit')
cek('status: Datang terlambat', bacaStatusIsian('Datang terlambat') === 'telat')
cek('status: Pulang lebih awal', bacaStatusIsian('Pulang lebih awal') === 'pulang')
cek('status: kode H / I / S / TP', bacaStatusIsian('H') === 'hadir' && bacaStatusIsian('I') === 'izin' && bacaStatusIsian('S') === 'sakit' && bacaStatusIsian('TP') === 'pulang')
cek('status: kosong / tak dikenal → null', bacaStatusIsian('') === null && bacaStatusIsian('lainnya') === null)

const ANG = [
  { id: 'm1', name: 'Budi Santoso', active: true },
  { id: 'm2', name: 'Rina Putri', active: true },
  { id: 'm3', name: 'Yohanes Bayu', active: true },
  { id: 'm4', name: 'Dewi Lestari', active: true },
]
const SES = [KAMIS]
const KAT = A.kategoriIzin
const csv = [
  judulD2.join(','),
  '18/11/2026 20:00:00,Budi Santoso,Brass,19/11/2026,Hadir,,,,,',
  '19/11/2026 12:00:00,Rina Putri,Perkusi,19/11/2026,Izin,Kuliah,praktikum,,,https://drive.google.com/open?id=a',
  '19/11/2026 13:00:00,Yohanes Bayu,Brass,19/11/2026,Sakit,,demam,,,',
  '18/11/2026 21:00:00,Dewi Lestari,CG,19/11/2026,Pulang lebih awal,,kontrol dokter,18.05,19.10,https://drive.google.com/open?id=b',
].join('\n')
const rows = bacaCsvForm(csv)
const peta = tebakKolomGForm(rows[0])
const opsi = (jenis) => ({ jenis, baris: rows.slice(1), peta, urutan: 'dmy', anggota: ANG, sesi: SES, catatan: [], kategori: KAT })
const rp = rencanakanImporForm(opsi('presensi'))
cek('presensi: Hadir & Pulang awal ditambah', rp[0].aksi === 'tambah' && rp[3].aksi === 'tambah', rp.map((b) => b.aksi).join())
cek('presensi: isian Izin/Sakit dilewati dengan petunjuk', rp[1].aksi === 'lewati' && rp[2].aksi === 'lewati' && rp[1].pesan.includes('Izin'), rp[1].pesan)
const ri = rencanakanImporForm(opsi('izin'))
cek('izin: Hadir & Pulang awal dilewati', ri[0].aksi === 'lewati' && ri[3].aksi === 'lewati', ri.map((b) => b.aksi).join())
cek('izin: Rina izin kuliah, Bayu sakit (dari Status)', ri[1].aksi === 'tambah' && ri[1].kategori === 'kuliah' && ri[2].kategori === 'sakit', `${ri[1].kategori} ${ri[2].kategori}`)
const hi = terapkanImporForm('izin', ri, [], SES, () => 'n' + Math.random())
cek('izin: Bayu tercatat sakit', hi.catatan.find((r) => r.memberId === 'm3')?.status === 'sakit')
const rd = rencanakanImporForm(opsi('datang'))
cek('absen fisik: Dewi tambah dengan jam datang & pulang', rd[3].aksi === 'tambah' && rd[3].jamDatang === 18 * 60 + 5 && rd[3].jamPulang === 19 * 60 + 10)
cek('absen fisik: isian izin/sakit dilewati', rd[1].aksi === 'lewati' && rd[2].aksi === 'lewati')
const hd = terapkanImporForm('datang', rd, [], SES, () => 'd' + Math.random())
const dDewi = hd.catatan.find((r) => r.memberId === 'm4')
cek('absen fisik: pulangAt tersimpan', dDewi.pulangAt === ms(19, 10) && dDewi.datangAt === ms(18, 5))
cek('absen fisik: Dewi dinilai pulang awal berjatah', statusDatang(dDewi, KAMIS, A) === 'jatah' && pulangAwal(dDewi, KAMIS, A))
const ada = [{ ...dDewi }]
const rd2 = rencanakanImporForm({ ...opsi('datang'), catatan: ada })
cek('absen fisik: impor ulang sama → sama', rd2[3].aksi === 'sama', rd2[3].aksi + ' ' + rd2[3].pesan)
const ada2 = [{ ...dDewi, pulangAt: undefined }]
const rd3 = rencanakanImporForm({ ...opsi('datang'), catatan: ada2 })
cek('absen fisik: jam pulang baru → perbarui', rd3[3].aksi === 'perbarui')
const hiz = terapkanImporForm('izin', rencanakanImporForm({ ...opsi('izin'), catatan: [{ id: 'q', sessionId: 'k19', memberId: 'm2', status: 'alpha', pulangAt: ms(19, 0) }] }), [{ id: 'q', sessionId: 'k19', memberId: 'm2', status: 'alpha', pulangAt: ms(19, 0) }], SES, () => 'z')
cek('izin menimpa alpa: jam pulang lama dibuang', hiz.catatan.find((r) => r.memberId === 'm2')?.pulangAt === undefined)
const tanpaStatus = bacaCsvForm('Timestamp,Nama\n18/11/2026 20:00:00,Budi Santoso')
cek('Form tanpa kolom Status: perilaku lama', rencanakanImporForm({ ...opsi('presensi'), baris: tanpaStatus.slice(1), peta: tebakKolomGForm(tanpaStatus[0]) })[0].aksi === 'tambah')
cek('Form gabungan: tanpa alasanLain', peta.alasanLain === undefined, JSON.stringify(peta))

console.log('== impor Form lama: alasan dipecah per keadaan ==')
// Bentuk Form presensi MBA sebelum Form gabungan (dipakai sampai P3): tiga
// kolom alasan, kolom "Pulang duluan" berisi alasan + jam, isian "-" / "Tdk ada".
const judulLama = ['Timestamp', 'Nama Lengkap', 'Tanggal Latihan', 'Section', 'Status Kehadiran', 'Alasan Datang Terlambat (+ Jam Menyusul)', 'Alasan Tidak Hadir', 'Pulang Duluan (Alasan + Jam Pulang Duluan) ', 'Unggah Bukti Alasan Izin/Tidak Hadir/Pulang Duluan', 'Score']
const kl = tebakKolomGForm(judulLama)
cek('lama: Alasan = 5, alasanLain = [6], Pulang = 7, Bukti = 8', kl.alasan === 5 && JSON.stringify(kl.alasanLain) === '[6]' && kl.pulang === 7 && kl.bukti === 8, JSON.stringify(kl))
const bLama = (nama, status, a1, a2, a3, bukti = '') => ['19/11/2026 12:00:00', nama, 'Kamis, 19 November 2026', 'Brass', status, a1, a2, a3, bukti, '']
const barisLama = [
  bLama('Yohanes Bayu', 'Tidak Hadir', '-', 'sakit (diare), salah makan', '-', 'https://drive.google.com/open?id=c'),
  bLama('Rina Putri', 'Tidak Hadir', 'Tidak bisa hadir', 'praktikum kimia', 'Tidak bisa hadir'),
  bLama('Dewi Lestari', 'Datang Terlambat', 'kelas sesi 4 (18.30)', '-', '-'),
  bLama('Budi Santoso', 'Hadir Tepat Waktu', 'Tdk ada', 'Tdk ada', 'Tdk ada'),
]
cek('alasanIsian: "-" dilewati, kolom Tidak hadir terbaca', alasanIsian(barisLama[0], kl) === 'sakit (diare), salah makan')
cek('alasanIsian: isian pengisi dibuang, tidak diulang', alasanIsian(barisLama[1], kl) === 'praktikum kimia')
cek('alasanIsian: "Tdk ada" semua → kosong', alasanIsian(barisLama[3], kl) === '')
cek('alasanIsian: teks alasan di kolom Pulang ikut, jam saja tidak', alasanIsian(['', '', '', '', '', '.', '.', 'asistensi matkul (19.00)'], kl) === 'asistensi matkul (19.00)' && alasanIsian(['', '', '', '', '', 'rapat', '', '19.00'], kl) === 'rapat')
const ril = rencanakanImporForm({ ...opsi('izin'), baris: barisLama, peta: kl })
cek('lama izin: Bayu sakit dari alasan Tidak hadir', ril[0].aksi === 'tambah' && ril[0].kategori === 'sakit' && ril[0].alasan.startsWith('sakit'), `${ril[0].kategori} ${ril[0].alasan}`)
cek('lama izin: Rina kategori kuliah', ril[1].kategori === 'kuliah', `${ril[1].kategori} ${ril[1].alasan}`)
const rpl = rencanakanImporForm({ ...opsi('presensi'), baris: barisLama, peta: kl })
cek('lama presensi: keterangan telat Dewi memakai kolom Alasan terlambat', rpl[2].keterangan?.alasan === 'kelas sesi 4 (18.30)', JSON.stringify(rpl[2].keterangan))

console.log('== jam inti: sesi 17.30–20.15, pra 30 + penutup 15 ==')
const SESI_P = { ...KAMIS, startTime: '17:30', endTime: '20:15' }
const AI = lengkapiAturan({ ...ATURAN_BAKU, wajibBukti: true, praMenit: 30, penutupMenit: 15 })
cek('lengkapiAturan menyimpan pra & penutup', AI.praMenit === 30 && AI.penutupMenit === 15)
cek('lengkapiAturan: 0 / negatif / teks dibuang', !('praMenit' in lengkapiAturan({ praMenit: 0, penutupMenit: -5 })) && !('penutupMenit' in lengkapiAturan({ penutupMenit: '15' })))
const ji = jendelaDatang(SESI_P, AI)
cek('inti 18.00–20.00', ji.mulai === ms(18, 0) && ji.selesai === ms(20, 0))
cek('tepat 18.30, batas jatah 19.00 (½ dari 120′)', ji.tepat === ms(18, 30) && ji.batasJatah === ms(19, 0))
cek('tanpa pra/penutup: perilaku lama (mulai 17.30, batas 18.52)', jendelaDatang(SESI_P, A).mulai === ms(17, 30) && jendelaDatang(SESI_P, A).batasJatah === ms(18, 52))
cek('datang 17.30 pulang 18.55 → ikut 55′ (bukan 85′)', menitIkut({ datangAt: ms(17, 30), pulangAt: ms(18, 55) }, SESI_P, AI) === 55)
cek('… dinilai lewat batas (aturan absensi: < 60′)', statusDatang(H({ datangAt: ms(17, 30), pulangAt: ms(18, 55), ...AL }), SESI_P, AI) === 'lewat-batas')
cek('… padahal tanpa jam inti lolos (inilah yang diperbaiki)', statusDatang(H({ datangAt: ms(17, 30), pulangAt: ms(18, 55), ...AL }), SESI_P, A) === 'jatah')
cek('pulang 19.00 beralasan → jatah (ikut 60′)', statusDatang(H({ pulangAt: ms(19, 0), ...AL }), SESI_P, AI) === 'jatah')
cek('pulang 19.45 → tepat (inti selesai 20.00, toleransi 30′)', statusDatang(H({ pulangAt: ms(19, 45) }), SESI_P, AI) === 'tepat')
cek('pulang 19.29 tanpa alasan → pulang awal', pulangAwal(H({ pulangAt: ms(19, 29) }), SESI_P, AI) && statusDatang(H({ pulangAt: ms(19, 29) }), SESI_P, AI) === 'tanpa-alasan')
cek('pulang 20.00 sebelum apel penutup → tepat (apel penutup tidak dihitung)', statusDatang(H({ pulangAt: ms(20, 0) }), SESI_P, AI) === 'tepat')
cek('datang 18.25 → tepat (toleransi dari inti)', statusDatang(H({ datangAt: ms(18, 25) }), SESI_P, AI) === 'tepat')
cek('datang 19.01 → lewat batas', statusDatang(H({ datangAt: ms(19, 1), ...AL }), SESI_P, AI) === 'lewat-batas')
cek('label menyebut pulang awal', labelDatang('lewat-batas', H({ pulangAt: ms(18, 55) }), SESI_P, AI).startsWith('pulang awal'))
const MINGGU_P = { ...KAMIS, date: '2026-11-29', startTime: '14:30', endTime: '19:15' }
const msM = (h, m) => new Date(2026, 10, 29, h, m).getTime()
const jm = jendelaDatang(MINGGU_P, AI)
cek('Minggu 14.30–19.15 → inti 15.00–19.00, batas jatah 17.00', jm.mulai === msM(15, 0) && jm.selesai === msM(19, 0) && jm.batasJatah === msM(17, 0))
cek('Minggu: ikut 119′ → lewat batas, 120′ → jatah', statusDatang(H({ pulangAt: msM(16, 59), ...AL }), MINGGU_P, AI) === 'lewat-batas' && statusDatang(H({ pulangAt: msM(17, 0), ...AL }), MINGGU_P, AI) === 'jatah')
const pendek = { ...KAMIS, startTime: '18:00', endTime: '18:40' }
cek('potongan menyisakan < 30′ → jam sesi utuh', intiSesi(pendek, AI).mulai === ms(18, 0) && intiSesi(pendek, AI).selesai === ms(18, 40))
cek('kodeKehadiran ikut jam inti', kodeKehadiran({ id: 'x', sessionId: 'k19', memberId: 'm', status: 'hadir', datangAt: ms(17, 30), pulangAt: ms(18, 55), ...AL }, SESI_P, AI, '2026-12-01') === 'telat')

console.log('== v2.15: jam dari teks bebas ==')
const S1730 = { startTime: '17:30' }
const PAGI = { startTime: '07:00' }
cek('"jm 6" tanpa sesi → 06.00 (tidak menebak)', bacaJamForm('jm 6') === 360)
cek('"setelah sesi 4 menyusul jm 6" → bukan 04.00; sesi malam → 18.00', bacaJamForm('setelah sesi 4 menyusul jm 6') === 360 && jamUntukSesi('setelah sesi 4 menyusul jm 6', S1730) === 1080)
cek('sesi pagi: "jm 6" tetap 06.00', jamUntukSesi('jm 6', PAGI) === 360)
cek('"7.15" pada sesi malam → 19.15, "18.05" tetap', jamUntukSesi('7.15', S1730) === 1155 && jamUntukSesi('18.05', S1730) === 1085)
cek('AM/PM & "malam" dihormati', jamUntukSesi('6 am', S1730) === 360 && bacaJamForm('6:45 PM') === 1125 && bacaJamForm('pukul 7 malam') === 1140)
cek('jam 12 tanpa AM/PM tidak digeser', jamUntukSesi('12.30', S1730) === 750)
cek('jam datang: dua jam → yang terakhir', jamUntukSesi('kelas sesi 4 selesai jam 18:30, menyusul jam 18:40', S1730, 'akhir') === 1120)
cek('jam pulang: alasan + jam', jamUntukSesi('ACC RESMI LAPORAN 19:00', S1730) === 1140 && jamUntukSesi('Latihan di gereja + 19:30', S1730) === 1170)
cek('titik di akhir kalimat tidak menggagalkan', bacaJamForm('kelas selesai 18.30.') === 1110)
cek('teks tanpa jam → null; angka lepas tidak dibaca jam', bacaJamForm('Mengikuti delegasi') === null && bacaJamForm('kerja kelompok 3 orang') === null && bacaJamForm('25:00') === null)
cek('sel berisi angka saja tetap terbaca', bacaJamForm('18') === 1080 && bacaJamForm('6 pm') === 1080 && bacaJamForm('18 WIB') === 1080)
cek('cap waktu Form tetap terbaca (tanpa sore-isasi)', bacaCapWaktu('19/11/2026 1:35:55') === new Date(2026, 10, 19, 1, 35).getTime() && bacaCapWaktu('19/11/2026 18:05:00') === new Date(2026, 10, 19, 18, 5).getTime())

console.log('== v2.15: pulang awal dengan status "Hadir Tepat Waktu" ==')
cek('isian pengisi bukan jawaban', ['', '-', '.', 'tidak ada', 'Tdk ada', 'belum tau', 'Hadir', 'tepat waktu', 'tidak pulang duluan', 'sampai selesai'].every((t) => !isianBermakna(t)))
cek('alasan pulang = jawaban', ['Kerkom', 'ACC RESMI LAPORAN 19:00', '19.30', 'jm 7'].every((t) => isianBermakna(t)))
const kp = keteranganIsian('Hadir Tepat Waktu', 1, { alasan: 'laporan praktikum', bukti: 'https://x', jamPulang: 1140, pulangDiisi: true })
cek('Hadir Tepat Waktu + kolom Pulang diisi → keterangan pulang', kp?.status === 'pulang' && kp.jamPulang === 1140 && kp.alasan === 'laporan praktikum', JSON.stringify(kp))
cek('Hadir Tepat Waktu tanpa isian Pulang → tanpa keterangan', keteranganIsian('Hadir Tepat Waktu', 1, { alasan: 'x', pulangDiisi: false }) === null)
cek('Datang Terlambat + kolom Pulang diisi → telat-pulang', keteranganIsian('Datang Terlambat', 1, { alasan: 'x', jamDatang: 1120, jamPulang: 1170, pulangDiisi: true })?.status === 'telat-pulang')
cek('Izin + kolom Pulang diisi → tetap tanpa keterangan presensi', keteranganIsian('Izin', 1, { alasan: 'x', pulangDiisi: true }) === null)
// Bentuk Form P4 (nama rekaan): Status, tiga kolom alasan, tanpa kolom jam datang.
const judulP4 = ['Timestamp', 'Nama Lengkap', 'Tanggal Latihan', 'Section', 'Status Kehadiran', 'Alasan Datang Terlambat (+ Jam Menyusul)', 'Alasan Tidak Hadir', 'Pulang Duluan (Alasan + Jam Pulang Duluan) ', 'Unggah Bukti Alasan Izin/Tidak Hadir/Pulang Duluan']
const P4 = { ...KAMIS, id: 'p4', startTime: '17:30', endTime: '20:15' }
const b4 = (nama, status, telat, absen, pulang, bukti = '') => ['19/11/2026 12:00:00', nama, '19/11/2026', 'Brass', status, telat, absen, pulang, bukti]
const baris4 = [
  b4('Budi Santoso', 'Hadir Tepat Waktu', '-', '-', 'ACC RESMI LAPORAN 19:00', 'https://drive.google.com/open?id=p1'),
  b4('Rina Putri', 'Hadir Tepat Waktu', '-', '-', 'belum tau'),
  b4('Yohanes Bayu', 'Datang Terlambat', 'setelah sesi 4 menyusul jm 6', '-', '-', 'https://drive.google.com/open?id=p2'),
  b4('Dewi Lestari', 'Hadir Tepat Waktu', '-', '-', 'Kerkom'),
]
const p4 = tebakKolomGForm(judulP4)
const r4 = rencanakanImporForm({ jenis: 'presensi', baris: baris4, peta: p4, urutan: 'dmy', anggota: ANG, sesi: [P4], catatan: [], kategori: KAT })
cek('P4: Hadir Tepat Waktu + alasan & jam pulang → keterangan pulang 19.00', r4[0].keterangan?.status === 'pulang' && r4[0].keterangan.jamPulang === 1140 && r4[0].keterangan.bukti?.includes('id=p1'), JSON.stringify(r4[0].keterangan))
cek('P4: "belum tau" di kolom Pulang → hadir biasa', r4[1].keterangan === undefined, JSON.stringify(r4[1].keterangan))
cek('P4: telat "menyusul jm 6" → jam datang 18.00', r4[2].keterangan?.status === 'telat' && r4[2].keterangan.jamDatang === 1080, JSON.stringify(r4[2].keterangan))
cek('P4: pulang tanpa jam → tetap keterangan pulang (alasan saja)', r4[3].keterangan?.status === 'pulang' && r4[3].keterangan.jamPulang === undefined && r4[3].keterangan.alasan === 'Kerkom', JSON.stringify(r4[3].keterangan))
const h4 = terapkanImporForm('presensi', r4, [{ id: 'x1', sessionId: 'p4', memberId: 'm1', status: 'hadir' }], [P4], () => 'n')
const rx = h4.catatan.find((r) => r.memberId === 'm1')
cek('P4: catatan hadir yang ada dapat alasan & bukti dari kolom Pulang', rx?.alasanTelat === 'ACC RESMI LAPORAN 19:00' && rx.bukti?.includes('id=p1'), JSON.stringify(rx))
cek('P4: keterangan pulang 19.00 disimpan di sesi (jam hadir tetap dari absen fisik)', h4.keterangan.p4?.m1?.status === 'pulang' && h4.keterangan.p4.m1.jamPulang === 1140 && rx.pulangAt === undefined)
cek('P4: Rina ("belum tau") & Dewi — hanya Dewi yang punya keterangan', !h4.keterangan.p4?.m2 && h4.keterangan.p4?.m4?.status === 'pulang')
const rxf = { ...rx, formPresensi: true, pulangAt: new Date(2026, 10, 19, 19, 0).getTime() }
cek('P4: sesudah absen fisik pulang 19.00 → pulang awal berjatah (alasan + bukti dari Form)', statusDatang(rxf, P4, AI) === 'jatah', statusDatang(rxf, P4, AI))
cek('P4: tanpa jam di Form izin/presensi berkolom jam, perilaku lama', rencanakanImporForm({ ...opsi('presensi') })[3].keterangan?.jamPulang === 1150)

console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) process.exit(1)
