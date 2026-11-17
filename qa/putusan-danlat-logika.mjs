/**
 * v2.13 — putusan danlat (izin/sakit/telat/pulang awal), batas lapor sakit
 * pada hari-H, dan keterangan telat/pulang dari Form gabungan.
 *
 * Aturan sumber: putusan Danlat 17 Nov — izin ≤ 15.00, sakit ≤ 15.30 (dua jam
 * sebelum apel), telat 18.31–19.00 beralasan = telat berjatah, bukti wajib,
 * sakit sesudah 15.30 diputus danlat per orang. Sesi P3 17.30–20.15 dengan
 * latihan inti 18.00–20.00.
 *
 * Jalankan: bash qa/bangun-logika.sh && node qa/putusan-danlat-logika.mjs
 */
import { ATURAN_BAKU, lengkapiAturan, batasLapor, keabsahanIzin, statusDatang, kodeKehadiran, teksBatasSakit } from '/tmp/programLatsar.mjs'
import { bacaCsvForm, tebakKolomGForm, rencanakanImporForm, terapkanImporForm, keteranganIsian, lengkapiDariForm } from '/tmp/imporGForm.mjs'
import {
  butirPutusan,
  daftarPutusan,
  teksWaPutusan,
  bacaBalasanDanlat,
  nilaiVonis,
  labelPutusan,
  ubahanPutusan,
  ringkasAturan,
} from '/tmp/putusanDanlat.mjs'

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

const A = lengkapiAturan({ ...ATURAN_BAKU, batasIzin: '15:00', batasSakit: '15:30', praMenit: 30, penutupMenit: 15 })
const P3 = { id: 'p3', date: '2026-11-17', startTime: '17:30', endTime: '20:15', title: 'P3', type: 'latihan', checklist: [], createdAt: 0 }
const ms = (h, m, d = 17) => new Date(2026, 10, d, h, m).getTime()
const I = (o) => ({ id: 'r' + Math.random(), sessionId: 'p3', memberId: 'm', status: 'izin', kategoriIzin: 'kuliah', bukti: 'ada', ...o })

console.log('== batas lapor sakit ==')
cek('lengkapiAturan menyimpan batasSakit', A.batasSakit === '15:30')
cek('jam tak sah dibuang', lengkapiAturan({ batasSakit: '25:00' }).batasSakit === undefined)
cek('batas sakit = 15.30 hari-H', batasLapor('sakit', P3, A) === ms(15, 30))
cek('tanpa batasSakit → mulai + sakitMaksJam', batasLapor('sakit', P3, { ...A, batasSakit: undefined }) === ms(17, 30) + 24 * 3_600_000)
cek('sakit 15.30 tepat → sah', keabsahanIzin(I({ status: 'sakit', kategoriIzin: 'sakit', dilaporAt: ms(15, 30) }), P3, A) === 'sah')
cek('sakit 15.31 → telat', keabsahanIzin(I({ status: 'sakit', kategoriIzin: 'sakit', dilaporAt: ms(15, 31) }), P3, A) === 'telat')
cek('izin 14.59 sah, 15.00 telat', keabsahanIzin(I({ dilaporAt: ms(14, 59) }), P3, A) === 'sah' && keabsahanIzin(I({ dilaporAt: ms(15, 0) }), P3, A) === 'telat')
cek('teks ringkas sakit', teksBatasSakit(A) === 'sakit ≤ 15.30' && teksBatasSakit({ sakitMaksJam: 24 }) === 'sakit ≤ 24 jam')
cek('ringkasAturan', ringkasAturan(P3, A) === 'izin ≤ 15.00 · sakit ≤ 15.30 · bukti wajib', ringkasAturan(P3, A))

console.log('== putusan jatah pada catatan hadir ==')
const AL = { alasanTelat: 'kelas pengganti', bukti: 'ada' }
const H = (o) => ({ id: 'h' + Math.random(), sessionId: 'p3', memberId: 'm', status: 'hadir', ...o })
cek('telat 19.10 beralasan → lewat-batas', statusDatang(H({ datangAt: ms(19, 10), ...AL }), P3, A) === 'lewat-batas')
cek('… diputus jatah → jatah', statusDatang(H({ datangAt: ms(19, 10), ...AL, putusanIzin: 'jatah' }), P3, A) === 'jatah')
cek('telat tanpa bukti diputus jatah → jatah', statusDatang(H({ datangAt: ms(18, 45), alasanTelat: 'x', putusanIzin: 'jatah' }), P3, A) === 'jatah')
cek('putusan sah tetap putusan-sah', statusDatang(H({ datangAt: ms(19, 10), putusanIzin: 'sah' }), P3, A) === 'putusan-sah')
cek('tepat waktu + putusan jatah → tepat', statusDatang(H({ datangAt: ms(18, 10), putusanIzin: 'jatah' }), P3, A) === 'tepat')
cek('kode: jatah → telat-jatah', kodeKehadiran(H({ datangAt: ms(19, 10), ...AL, putusanIzin: 'jatah' }), P3, A, '2026-12-01') === 'telat-jatah')
const P3F = { ...P3, formPresensi: { lain: ms(12, 0) } }
cek('kode: tanpa Form + putusan jatah tidak jatuh ke tanpa-form', kodeKehadiran(H({ datangAt: ms(18, 45), ...AL, putusanIzin: 'jatah' }), P3F, A, '2026-12-01') === 'telat-jatah')
cek('kode: tanpa Form tanpa putusan → tanpa-form', kodeKehadiran(H({ datangAt: ms(18, 10) }), P3F, A, '2026-12-01') === 'tanpa-form')

console.log('== butir putusan ==')
const bIzin = butirPutusan(I({ dilaporAt: ms(13, 10), note: 'praktikum' }), P3, A)
cek('izin sesuai aturan → usul terima', bIzin?.jenis === 'izin' && bIzin.usul === 'terima')
cek('keterangan izin', bIzin?.keterangan.join(' · ') === 'lapor 13.10 · Praktikum / asistensi · bukti ada', bIzin?.keterangan.join(' · '))
const bSakit = butirPutusan(I({ status: 'sakit', kategoriIzin: 'sakit', dilaporAt: ms(16, 5) }), P3, A)
cek('sakit 16.05 → usul tolak, sebut lewat 15.30', bSakit?.usul === 'tolak' && bSakit.keterangan[0] === 'lapor 16.05, lewat 15.30', bSakit?.keterangan[0])
cek('izin kemarin malam → tanggal disebut', butirPutusan(I({ dilaporAt: ms(21, 40, 16) }), P3, A)?.keterangan[0] === 'lapor 16/11 21.40')
cek('izin yang sudah diputus tetap tampil dengan putusannya', butirPutusan(I({ dilaporAt: ms(16, 0), putusanIzin: 'sah' }), P3, A)?.putusan === 'sah')
cek('usul dihitung tanpa putusan (putusan sah atas izin telat tetap usul tolak)', butirPutusan(I({ dilaporAt: ms(16, 0), putusanIzin: 'sah' }), P3, A)?.usul === 'tolak')
cek('hadir tepat → tidak perlu putusan', butirPutusan(H({ datangAt: ms(18, 10) }), P3, A) === null)
cek('hadir tanpa jam → tidak perlu putusan', butirPutusan(H({}), P3, A) === null)
cek('alpa → tidak perlu putusan', butirPutusan({ ...H({}), status: 'alpha' }, P3, A) === null)
const bTelat = butirPutusan(H({ datangAt: ms(18, 45), ...AL }), P3, A)
cek('telat berjatah → usul terima', bTelat?.jenis === 'telat' && bTelat.usul === 'terima' && bTelat.alasan === 'kelas pengganti')
const bLewat = butirPutusan(H({ datangAt: ms(19, 10), ...AL }), P3, A)
cek('telat 19.10 → usul tolak, sebut batas 19.00', bLewat?.usul === 'tolak' && bLewat.keterangan[0] === 'datang 19.10, lewat 19.00', bLewat?.keterangan[0])
const bPulang = butirPutusan(H({ pulangAt: ms(19, 0), alasanTelat: 'les' }), P3, A)
cek('pulang awal tanpa bukti → jenis pulang, usul tolak', bPulang?.jenis === 'pulang' && bPulang.usul === 'tolak' && bPulang.keterangan.includes('tanpa bukti'))
cek('telat & pulang → jenis telat-pulang', butirPutusan(H({ datangAt: ms(18, 40), pulangAt: ms(19, 20), ...AL }), P3, A)?.jenis === 'telat-pulang')
const bForm = butirPutusan(H({ memberId: 'x' }), P3F, A)
cek('hadir tanpa Form → jenis tanpa-form, usul tolak', bForm?.jenis === 'tanpa-form' && bForm.usul === 'tolak')
cek('tautan bukti dikenali', butirPutusan(I({ dilaporAt: ms(13, 0), bukti: 'https://drive.google.com/open?id=abc' }), P3, A)?.tautanBukti === 'https://drive.google.com/open?id=abc')

console.log('== nilai & label putusan ==')
cek('terima izin → sah, terima telat → jatah, tolak → tidak-sah', nilaiVonis('izin', 'terima') === 'sah' && nilaiVonis('telat', 'terima') === 'jatah' && nilaiVonis('pulang', 'tolak') === 'tidak-sah')
cek('terima hadir tanpa Form → sah', nilaiVonis('tanpa-form', 'terima') === 'sah')
cek('label', labelPutusan('izin', 'sah') === 'Diizinkan' && labelPutusan('sakit', 'sah') === 'Disahkan' && labelPutusan('telat', 'jatah').startsWith('Disahkan') && labelPutusan('izin', 'tidak-sah') === 'Ditolak')
const u = ubahanPutusan('sah', '  ', 123, ' bukti menyusul ')
cek('ubahan: pemutus kosong → Danlat, catatan dirapikan', u.putusanIzin === 'sah' && u.putusanOleh === 'Danlat' && u.putusanAt === 123 && u.putusanCatatan === 'bukti menyusul')
const k = ubahanPutusan(null, 'Danlat', 1)
cek('ubahan null menghapus semua field', 'putusanIzin' in k && k.putusanIzin === undefined && k.putusanOleh === undefined && k.putusanAt === undefined)

console.log('== daftar & pesan WA ==')
const NAMA = { a: 'Ayu', b: 'Bima', c: 'Citra', d: 'Dodi', e: 'Eka' }
const cat = [
  I({ id: '1', memberId: 'c', dilaporAt: ms(16, 0) }), // izin telat → tolak
  I({ id: '2', memberId: 'b', dilaporAt: ms(12, 0) }), // izin sah → terima
  H({ id: '3', memberId: 'a', datangAt: ms(18, 45), ...AL }), // telat jatah → terima
  I({ id: '4', memberId: 'd', dilaporAt: ms(12, 0), putusanIzin: 'sah', putusanOleh: 'Danlat' }), // sudah diputus
  H({ id: '5', memberId: 'e', datangAt: ms(18, 5) }), // tepat → tidak masuk
  I({ id: '6', memberId: 'a', sessionId: 'lain', dilaporAt: ms(12, 0) }), // sesi lain
]
const nama = (id) => NAMA[id] ?? id
const daftar = daftarPutusan(cat, P3, A, nama)
cek('daftar: 4 butir (tepat & sesi lain tidak masuk)', daftar.length === 4, daftar.map((b) => b.r.id).join())
cek('urutan: belum diputus dulu, sesuai aturan dulu, izin sebelum telat', daftar.map((b) => b.r.id).join() === '2,3,1,4', daftar.map((b) => b.r.id).join())
cek('anggota nonaktif disaring', daftarPutusan(cat, P3, A, nama, new Set(['a', 'b', 'd'])).length === 3)
const menunggu = daftar.filter((b) => !b.putusan)
const wa = teksWaPutusan(menunggu, P3, A, { judulSesi: 'P3 · Selasa, 17 November 2026', nama })
cek('pesan: judul & aturan', wa.startsWith('*Putusan izin & telat — P3 · Selasa, 17 November 2026*\nAturan: izin ≤ 15.00 · sakit ≤ 15.30 · bukti wajib'))
cek('pesan: kelompok sesuai aturan memuat 1 & 2', /Sesuai aturan[^\n]*\n1\. Bima — Izin[\s\S]*\n2\. Ayu — Telat/.test(wa), wa)
cek('pesan: kelompok dipertimbangkan memuat 3', /Perlu dipertimbangkan[^\n]*\n3\. Citra — Izin · lapor 16\.00, lewat 15\.00/.test(wa))
cek('pesan: alasan ditulis', wa.includes('   Alasan: kelas pengganti'))
cek('pesan: petunjuk balasan', wa.trimEnd().endsWith('"semua terima kecuali 5".'))
cek('pesan kosong', teksWaPutusan([], P3, A, { judulSesi: 'P3', nama }).includes('Tidak ada yang menunggu putusan.'))
const urutWa = teksWaPutusan(
  [daftar[2], daftar[0]],
  P3,
  A,
  { judulSesi: 'P3', nama },
)
cek('nomor mengikuti urutan masukan walau dikelompokkan', urutWa.includes('2. Bima') && urutWa.includes('1. Citra'))

console.log('== balasan danlat ==')
const v = (t, n = 6) => {
  const h = bacaBalasanDanlat(t, n)
  return [...h.vonis].sort((a, b) => a[0] - b[0]).map(([no, x]) => `${no}${x === 'terima' ? '+' : '-'}`).join(' ')
}
cek('"1-3 terima, 4 tolak"', v('1-3 terima, 4 tolak') === '1+ 2+ 3+ 4-', v('1-3 terima, 4 tolak'))
cek('"terima 1, 2, 5"', v('terima 1, 2, 5') === '1+ 2+ 5+', v('terima 1, 2, 5'))
cek('"1, 2, 3 ok; 4 ❌"', v('1, 2, 3 ok; 4 ❌') === '1+ 2+ 3+ 4-', v('1, 2, 3 ok; 4 ❌'))
cek('"semua terima kecuali 4 dan 6"', v('semua terima kecuali 4 dan 6') === '1+ 2+ 3+ 4- 5+ 6-', v('semua terima kecuali 4 dan 6'))
cek('"1 tidak sah, 2 sah"', v('1 tidak sah, 2 sah') === '1- 2+', v('1 tidak sah, 2 sah'))
cek('"1 ✅\\n2 ✅\\n3 ❌"', v('1 ✅\n2 ✅\n3 ❌') === '1+ 2+ 3-', v('1 ✅\n2 ✅\n3 ❌'))
cek('"1 s.d. 3 diizinkan"', v('1 s.d. 3 diizinkan') === '1+ 2+ 3+', v('1 s.d. 3 diizinkan'))
cek('"1-2 acc. 3 gak"', v('1-2 acc, 3 gak') === '1+ 2+ 3-', v('1-2 acc, 3 gak'))
cek('"tolak 2 dan 3, sisanya terima"', v('tolak 2 dan 3, sisanya terima', 4) === '1+ 2- 3- 4+', v('tolak 2 dan 3, sisanya terima', 4))
const h9 = bacaBalasanDanlat('1-2 terima, 9 tolak', 3)
cek('nomor di luar daftar dilaporkan', h9.diLuar.join() === '9' && h9.belum.join() === '3')
cek('nomor tanpa putusan tidak ditebak', bacaBalasanDanlat('1, 2', 3).vonis.size === 0)
cek('"nomor 1 ok" tidak dibaca sebagai tolak', v('nomor 1 ok') === '1+', v('nomor 1 ok'))

console.log('== keterangan Form gabungan ==')
cek('Hadir penuh → tanpa keterangan', keteranganIsian('Hadir penuh', 1, { alasan: 'x' }) === null)
cek('Izin → tanpa keterangan', keteranganIsian('Izin', 1, { alasan: 'x' }) === null)
const kt = keteranganIsian('Datang terlambat', 5, { alasan: 'asistensi', bukti: 'https://x', jamDatang: 18 * 60 + 40, jamPulang: 20 * 60 })
cek('telat: alasan, bukti, jam datang (jam pulang dibuang)', kt?.status === 'telat' && kt.alasan === 'asistensi' && kt.jamDatang === 1120 && kt.jamPulang === undefined)
cek('telat & pulang', keteranganIsian('Datang terlambat dan pulang lebih awal', 1, { alasan: 'x' })?.status === 'telat-pulang')
cek('pulang: jam datang dibuang', keteranganIsian('Pulang lebih awal', 1, { jamDatang: 1100, jamPulang: 1150 })?.jamDatang === undefined)
cek('telat tanpa isi apa pun → null', keteranganIsian('Datang terlambat', 1, {}) === null)
cek('lengkapiDariForm hanya mengisi yang kosong', JSON.stringify(lengkapiDariForm({ memberId: 'm', alasanTelat: 'lama' }, { formKeterangan: { m: { status: 'telat', alasan: 'baru', bukti: 'b', capWaktu: 1 } } })) === '{"bukti":"b"}')

const CSV = `Stempel waktu,Nama Lengkap,Section,Tanggal Latihan,Status Kehadiran,Kategori Alasan,Alasan,Perkiraan Jam Datang,Rencana Jam Pulang,Unggah Bukti
17/11/2026 10:00:00,Ayu Lestari,Brass,"Selasa, 17 November 2026 (P3)",Hadir penuh,,,,,
17/11/2026 11:00:00,Bima Sakti,Perkusi,"Selasa, 17 November 2026 (P3)",Datang terlambat,Praktikum / asistensi,Asistensi lab sampai 18.30,18:40,,https://drive.google.com/open?id=b1
17/11/2026 12:00:00,Citra Dewi,CG,"Selasa, 17 November 2026 (P3)",Izin,Praktikum / asistensi,Praktikum,,,https://drive.google.com/open?id=c1
17/11/2026 13:00:00,Dodi Pratama,Brass,"Selasa, 17 November 2026 (P3)",Pulang lebih awal,Lainnya,Les,,19:00,`
const tabel = bacaCsvForm(CSV)
const peta = tebakKolomGForm(tabel[0])
const anggota = [
  { id: 'a', name: 'Ayu Lestari', active: true },
  { id: 'b', name: 'Bima Sakti', active: true },
  { id: 'c', name: 'Citra Dewi', active: true },
  { id: 'd', name: 'Dodi Pratama', active: true },
]
const hadirD = { id: 'rd', sessionId: 'p3', memberId: 'd', status: 'hadir', pulangAt: ms(19, 0) }
const rencana = rencanakanImporForm({ jenis: 'presensi', baris: tabel.slice(1), peta, urutan: 'dmy', anggota, sesi: [P3], catatan: [hadirD], kategori: A.kategoriIzin })
cek('presensi: 3 ditulis, izin dilewati', rencana.filter((b) => b.aksi === 'tambah').length === 3 && rencana.find((b) => b.nama === 'Citra Dewi')?.aksi === 'lewati')
cek('presensi: Bima membawa keterangan telat', rencana.find((b) => b.nama === 'Bima Sakti')?.keterangan?.status === 'telat')
const h = terapkanImporForm('presensi', rencana, [hadirD], [P3], () => 'baru')
cek('terapkan: formPresensi 3 anak', Object.keys(h.form.p3 ?? {}).length === 3)
cek('terapkan: keterangan Bima & Dodi disimpan di sesi', Object.keys(h.keterangan.p3 ?? {}).sort().join() === 'b,d')
cek('terapkan: Dodi yang sudah hadir langsung dapat alasan', h.catatan.length === 1 && h.catatan[0].id === 'rd' && h.catatan[0].alasanTelat === 'Les')
cek('terapkan: Bima belum hadir → tidak ada catatan absen baru', !h.catatan.some((r) => r.memberId === 'b'))
const P3K = { ...P3, formPresensi: h.form.p3, formKeterangan: h.keterangan.p3 }
const ulang = rencanakanImporForm({ jenis: 'presensi', baris: tabel.slice(1), peta, urutan: 'dmy', anggota, sesi: [P3K], catatan: [h.catatan[0]], kategori: A.kategoriIzin })
cek('tarik ulang: semua "sama" (tidak menulis apa pun)', ulang.every((b) => b.aksi === 'sama' || b.aksi === 'lewati'), ulang.map((b) => b.aksi).join())
// absen fisik Bima datang 18.45 tanpa alasan → alasan & bukti dari Form
const FISIK = `Nama,Tanggal,Jam datang\nBima Sakti,17/11/2026,18:45`
const tf = bacaCsvForm(FISIK)
const rf = rencanakanImporForm({ jenis: 'datang', baris: tf.slice(1), peta: tebakKolomGForm(tf[0]), urutan: 'dmy', anggota, sesi: [P3K], catatan: [], kategori: A.kategoriIzin })
const hf = terapkanImporForm('datang', rf, [], [P3K], () => 'rb')
const rb = hf.catatan[0]
cek('absen fisik: alasan & bukti Bima diambil dari Form', rb?.alasanTelat === 'Asistensi lab sampai 18.30' && rb.bukti === 'https://drive.google.com/open?id=b1')
cek('… sehingga telat 18.45 berjatah tanpa mengetik ulang', statusDatang(rb, P3K, A) === 'jatah')
const lama = { id: 'rb', sessionId: 'p3', memberId: 'b', status: 'hadir', datangAt: ms(18, 45) }
const rf2 = rencanakanImporForm({ jenis: 'datang', baris: tf.slice(1), peta: tebakKolomGForm(tf[0]), urutan: 'dmy', anggota, sesi: [P3K], catatan: [lama], kategori: A.kategoriIzin })
cek('absen fisik ulang tanpa alasan → "perbarui" karena Form punya alasan', rf2[0].aksi === 'perbarui')

console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) process.exit(1)
