/**
 * #3 — Jadwal: kalender & agenda (logika murni).
 *
 * Yang dijaga:
 * - minggu mulai Senin, termasuk bulan yang melintasi pergantian tahun
 * - seri mingguan berhenti tepat di tanggal akhir, dibatasi MAKS_SERI
 * - "ubah sesi ini" melepas dari seri; "semua berikutnya" tidak menyentuh sesi sebelumnya
 * - hapus seri tidak pernah menghapus sesi berabsensi
 * - salinan sesi: id baru, checklist belum dicentang, realisasi dikosongkan
 * - ringkasan kehadiran: tanpa absensi = null, bukan 0%
 * - sesi berikutnya, hitung mundur, kelompok per minggu, cetak hex, .ics gabungan
 */
import {
  susunBulan, hariSenin, awalMinggu, geserBulan, tambahHari,
  tanggalSeri, MAKS_SERI, buatSeri, salinSesi, ubahSeri, rencanaHapusSeri,
  ringkasSesi, nadaKehadiran, sesiBerikutnya, penampilanTerdekat, teksHitungMundur,
  kelompokPerMinggu, sesiPerTanggal, htmlKalenderBulan, gabungICS, tampilanAwal,
} from '/tmp/kalender.mjs'
import { bangunICS } from '/tmp/pengingat.mjs'

let lulus = 0
const gagal = []
const cek = (nama, ok) => (ok ? lulus++ : gagal.push(nama))

let n = 0
const id = () => `x${++n}`
const sesi = (o = {}) => ({
  id: id(), title: 'Latihan', type: 'latihan', date: '2026-09-28', startTime: '15:30', endTime: '18:00',
  checklist: [{ id: 'c1', text: 'Tuning', done: 1 }, { id: 'c2', text: 'Drill set 1-5', done: 0 }],
  createdAt: 0, ...o,
})

/* ---------------- tanggal & kotak bulan ---------------- */
cek('28 Sep 2026 adalah Senin', hariSenin('2026-09-28') === 0)
cek('awal minggu dari Minggu 4 Okt = Senin 28 Sep', awalMinggu('2026-10-04') === '2026-09-28')
const sep = susunBulan(2026, 9)
cek('Sep 2026: baris pertama mulai Senin 31 Agu', sep[0][0].tanggal === '2026-08-31' && !sep[0][0].bulanIni)
cek('Sep 2026: tiap baris 7 sel', sep.every((b) => b.length === 7))
cek('Sep 2026: memuat 30 hari bulan ini', sep.flat().filter((s) => s.bulanIni).length === 30)
cek('Sep 2026: sel terakhir hari Minggu', hariSenin(sep.at(-1)[6].tanggal) === 6)
const jan = susunBulan(2027, 1)
cek('Jan 2027 melintasi tahun: mulai Senin 28 Des 2026', jan[0][0].tanggal === '2026-12-28')
cek('Jan 2027: 31 hari', jan.flat().filter((s) => s.bulanIni).length === 31)
const des = susunBulan(2026, 12)
cek('Des 2026: berakhir Minggu 3 Jan 2027', des.at(-1)[6].tanggal === '2027-01-03')
cek('geser bulan Des→Jan', JSON.stringify(geserBulan(2026, 12, 1)) === '{"tahun":2027,"bulan":1}')
cek('geser bulan Jan→Des mundur', JSON.stringify(geserBulan(2027, 1, -1)) === '{"tahun":2026,"bulan":12}')
cek('tambah hari melintasi tahun', tambahHari('2026-12-31', 1) === '2027-01-01')
cek('Feb 2028 kabisat 29 hari', susunBulan(2028, 2).flat().filter((s) => s.bulanIni).length === 29)

/* ---------------- seri mingguan ---------------- */
const tgl = tanggalSeri({ hari: [1, 4], mulai: '2026-09-28', akhir: '2026-10-20' })
cek('seri Selasa & Jumat: tanggal benar', JSON.stringify(tgl) === JSON.stringify(['2026-09-29', '2026-10-02', '2026-10-06', '2026-10-09', '2026-10-13', '2026-10-16', '2026-10-20']))
cek('seri berhenti tepat di tanggal akhir (inklusif)', tgl.at(-1) === '2026-10-20')
cek('seri tanpa hari = kosong', tanggalSeri({ hari: [], mulai: '2026-09-28', akhir: '2026-12-01' }).length === 0)
cek('seri akhir < mulai = kosong', tanggalSeri({ hari: [0], mulai: '2026-09-28', akhir: '2026-09-01' }).length === 0)
cek('seri dibatasi MAKS_SERI', tanggalSeri({ hari: [0, 1, 2, 3, 4, 5, 6], mulai: '2026-01-01', akhir: '2036-01-01' }).length === MAKS_SERI)
cek('seri melintasi tahun', tanggalSeri({ hari: [3], mulai: '2026-12-20', akhir: '2027-01-10' }).join() === '2026-12-24,2026-12-31,2027-01-07')

const contoh = sesi({ date: '2026-09-29', rencanaLatihan: [{ id: 'b1', judul: 'Pemanasan', jenis: 'pemanasan', menit: 15 }], realisasiLatihan: [{ id: 'r', blokId: 'b1', mulai: 1, selesai: 2 }], mulaiNyata: 5 })
const seri = buatSeri(contoh, { hari: [1], mulai: '2026-09-29', akhir: '2026-10-20' }, id, 'seri1')
cek('seri 4 Selasa', seri.length === 4)
cek('sesi contoh tetap memakai id-nya', seri[0].id === contoh.id && seri[0].seriId === 'seri1')
cek('semua anggota seri punya seriId', seri.every((s) => s.seriId === 'seri1'))
cek('id salinan unik', new Set(seri.map((s) => s.id)).size === 4)
cek('rencana latihan ikut tersalin', seri[2].rencanaLatihan?.[0]?.judul === 'Pemanasan')
cek('checklist ikut tersalin tapi belum dicentang', seri[1].checklist.length === 2 && seri[1].checklist.every((c) => c.done === 0))
cek('realisasi & penanda nyata tidak tersalin', !seri[1].realisasiLatihan && !seri[1].mulaiNyata)
cek('contoh tidak diubah oleh penyalinan', contoh.checklist[0].done === 1)
const luar = buatSeri(sesi({ date: '2026-09-28' }), { hari: [2], mulai: '2026-09-28', akhir: '2026-10-07' }, id, 's2')
cek('contoh di luar aturan tetap disimpan tanpa seriId', luar.length === 3 && luar[0].date === '2026-09-28' && !luar[0].seriId)

/* ---------------- salin / duplikat ---------------- */
const dup = salinSesi(sesi({ seriId: 'z', mulaiNyata: 9 }), '2026-11-01', id)
cek('duplikat: tanggal baru, tanpa seri, tanpa penanda', dup.date === '2026-11-01' && !dup.seriId && !dup.mulaiNyata)

/* ---------------- ubah seri ---------------- */
const semua = seri.map((s) => ({ ...s }))
semua[3].checklist = semua[3].checklist.map((c) => (c.text === 'Tuning' ? { ...c, done: 1 } : c))
const target = semua[1]
const baru = { ...target, startTime: '16:00', title: 'Latihan baru', checklist: [...target.checklist, { id: 'c3', text: 'Lagu 2', done: 0 }] }
const hanya = ubahSeri(semua, target, baru, 'ini')
cek('ubah hanya sesi ini: satu sesi', hanya.length === 1 && hanya[0].startTime === '16:00')
cek('ubah hanya sesi ini: dilepas dari seri', !hanya[0].seriId)
const lanjut = ubahSeri(semua, target, baru, 'berikutnya')
cek('ubah semua berikutnya: sesi ini + 2 sesudahnya', lanjut.length === 3)
cek('ubah semua berikutnya: sesi sebelumnya tidak tersentuh', !lanjut.some((s) => s.id === semua[0].id))
cek('ubah semua berikutnya: jam & judul ikut', lanjut.every((s) => s.startTime === '16:00' && s.title === 'Latihan baru'))
cek('ubah semua berikutnya: tanggal tidak berubah', lanjut.find((s) => s.id === semua[3].id).date === semua[3].date)
const s3 = lanjut.find((s) => s.id === semua[3].id)
cek('ubah semua berikutnya: centang lama dipertahankan', s3.checklist.find((c) => c.text === 'Tuning').done === 1 && s3.checklist.length === 3)
cek('ubah semua berikutnya: tetap satu seri', lanjut.every((s) => s.seriId === 'seri1'))

/* ---------------- hapus seri ---------------- */
const absen = [{ id: 'a1', sessionId: semua[0].id, memberId: 'm1', status: 'hadir' }]
const rh = rencanaHapusSeri(semua, 'seri1', absen)
cek('hapus seri: sesi berabsensi dipertahankan', rh.dipertahankan.join() === semua[0].id && !rh.hapus.includes(semua[0].id))
cek('hapus seri: sisanya dihapus', rh.hapus.length === 3)
const rh2 = rencanaHapusSeri(semua, 'seri1', [], semua[2].date)
cek('hapus seri mulai tanggal: hanya sesudahnya', rh2.hapus.length === 2)
cek('hapus seri tidak menyentuh seri lain', rencanaHapusSeri([sesi({ seriId: 'lain' })], 'seri1', []).hapus.length === 0)

/* ---------------- ringkasan ---------------- */
const s1 = sesi()
cek('tanpa absensi → persen null', ringkasSesi(s1, []).persenHadir === null)
const ab = ['hadir', 'hadir', 'hadir', 'izin'].map((st, i) => ({ id: 'r' + i, sessionId: s1.id, memberId: 'm' + i, status: st }))
const r = ringkasSesi(s1, [...ab, { id: 'z', sessionId: 'lain', memberId: 'm', status: 'alpha' }])
cek('persen hadir 75 (absensi sesi lain diabaikan)', r.persenHadir === 75 && r.jumlahAbsensi === 4)
cek('checklist 1/2', r.checklistSelesai === 1 && r.checklistTotal === 2)
cek('nada mengikuti ambang predikat', nadaKehadiran(85, { baik: 85, cukup: 70 }) === 'baik' && nadaKehadiran(75, { baik: 85, cukup: 70 }) === 'cukup' && nadaKehadiran(50, { baik: 85, cukup: 70 }) === 'kurang')

/* ---------------- agenda ---------------- */
const daftar = [
  sesi({ id: 'lalu', date: '2026-09-20' }),
  sesi({ id: 'pagi', date: '2026-09-27', startTime: '07:00', endTime: '09:00' }),
  sesi({ id: 'sore', date: '2026-09-27', startTime: '15:30', endTime: '18:00' }),
  sesi({ id: 'konser', type: 'penampilan', date: '2026-10-10' }),
]
cek('sesi berikutnya: lewati sesi pagi yang sudah selesai', sesiBerikutnya(daftar, '2026-09-27', '10:00')?.id === 'sore')
cek('sesi berikutnya: sesi yang sedang berjalan masih dihitung', sesiBerikutnya(daftar, '2026-09-27', '08:00')?.id === 'pagi')
cek('penampilan terdekat', penampilanTerdekat(daftar, '2026-09-27')?.id === 'konser')
cek('hitung mundur hari', teksHitungMundur(daftar[3], new Date(2026, 8, 27, 10)) === '13 hari lagi')
cek('hitung mundur besok', teksHitungMundur(sesi({ date: '2026-09-28' }), new Date(2026, 8, 27, 10)) === 'besok')
cek('hitung mundur jam', teksHitungMundur(daftar[2], new Date(2026, 8, 27, 13, 15)) === '2 jam 15 menit lagi')
const kel = kelompokPerMinggu(daftar, '2026-09-27')
cek('kelompok per minggu: 3 minggu', kel.length === 3)
cek('kelompok: minggu ini berlabel', kel[1].label.startsWith('Minggu ini') && kel[1].sesi.length === 2)
cek('kelompok: minggu lalu berlabel', kel[0].label.startsWith('Minggu lalu'))
cek('per tanggal urut jam', sesiPerTanggal(daftar).get('2026-09-27').map((s) => s.id).join() === 'pagi,sore')

/* ---------------- ekspor ---------------- */
const html = htmlKalenderBulan(2026, 9, [sesi({ title: '<Latihan & drill>' })], { namaTim: 'Tim A' })
cek('cetak: tanpa oklch/color-mix', !/oklch|color-mix/.test(html))
cek('cetak: judul bulan', html.includes('Jadwal September 2026'))
cek('cetak: judul di-escape', html.includes('&lt;Latihan &amp; drill&gt;'))
cek('cetak: kolom pertama Senin', /<th>Senin<\/th>/.test(html.split('<thead>')[1].slice(0, 30)))
const ics = gabungICS([bangunICS(sesi({ id: 'a' })), bangunICS(sesi({ id: 'b' }))])
cek('.ics gabungan: satu VCALENDAR', ics.match(/BEGIN:VCALENDAR/g).length === 1)
cek('.ics gabungan: dua VEVENT', ics.match(/BEGIN:VEVENT/g).length === 2 && ics.includes('UID:a@drillkit') && ics.includes('UID:b@drillkit'))
cek('.ics gabungan: alarm ikut', ics.match(/BEGIN:VALARM/g).length === 4)

/* ---------------- pilihan tampilan ---------------- */
cek('tampilan bawaan laptop = bulan', tampilanAwal(null, 1280) === 'bulan')
cek('tampilan bawaan HP = agenda', tampilanAwal(null, 360) === 'agenda')
cek('pilihan tersimpan menang', tampilanAwal('agenda', 1280) === 'agenda')
cek('tampilan daftar lama tetap bisa dipilih', tampilanAwal('daftar', 360) === 'daftar')
cek('nilai tersimpan rusak → bawaan', tampilanAwal('xyz', 360) === 'agenda')

console.log(`${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) {
  for (const g of gagal) console.log('  ✗ ' + g)
  process.exit(1)
}
