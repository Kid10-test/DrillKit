/**
 * Uji logika penanda sesi (G3).
 *
 * Empat aturan yang paling dikuji, karena salahnya menghasilkan angka yang
 * tampak pasti padahal menipu:
 *
 * 1. Belum ditandai BUKAN tepat waktu (dan tidak ikut menghitung rata-rata).
 * 2. Penanda di luar hari sesinya tidak dipakai.
 * 3. Penanda mundur tidak menghasilkan durasi negatif.
 * 4. Ambang "tepat waktu" menahan presisi semu.
 */
import {
  AMBANG_TEPAT,
  epochRencana,
  formatDurasi,
  formatLampau,
  formatTelat,
  rataLampau,
  rataTelat,
  ringkasanSesi,
  statusSesi,
} from '/tmp/sesi.mjs'

let lulus = 0
const gagal = []
const cek = (nama, syarat, keterangan = '') => {
  if (syarat) lulus += 1
  else gagal.push(`${nama}${keterangan ? ' — ' + keterangan : ''}`)
}
const dekat = (a, b) => a != null && Math.abs(a - b) < 1e-6

// ------------------------------------------------------------ pembantu tanggal
const HARI = '2026-09-20'
const jam = (j) => epochRencana(HARI, j)
const pada = (j) => jam(j) // epoch pada hari sesi

const sesi = (x) => ({
  id: 's1',
  title: 'Latihan',
  type: 'latihan',
  date: HARI,
  startTime: '08:00',
  endTime: '10:00',
  checklist: [],
  createdAt: 1,
  ...x,
})

// --------------------------------------------------------------- epochRencana
cek('epochRencana membaca jam', epochRencana(HARI, '08:00') != null)
cek('epochRencana: 08:00 lebih awal dari 09:00',
  epochRencana(HARI, '08:00') < epochRencana(HARI, '09:00'))
cek('epochRencana: selisih satu jam = 3.600.000 ms',
  epochRencana(HARI, '09:00') - epochRencana(HARI, '08:00') === 3_600_000)
cek('epochRencana menolak jam ngawur', epochRencana(HARI, '99:99') === null)
cek('epochRencana menolak jam kosong', epochRencana(HARI, '') === null)
cek('epochRencana menolak tanggal rusak', epochRencana('bukan-tanggal', '08:00') === null)

// ------------------------------------------------------------------ statusSesi
cek('tanpa penanda = belum', statusSesi(null, null) === 'belum')
cek('tanpa penanda (undefined) = belum', statusSesi(undefined, undefined) === 'belum')
cek('mulai tanpa selesai = berjalan', statusSesi(1, null) === 'berjalan')
cek('mulai dan selesai = rampung', statusSesi(1, 2) === 'rampung')
{
  // Sesi yang dimulai lama sekali lalu ditinggalkan tetap "berjalan" —
  // lebih jujur daripada menebak kapan ia berakhir.
  const lama = pada('08:00') - 1000 * 60 * 60 * 24 * 30
  cek('berjalan berbulan-bulan tetap berjalan', statusSesi(lama, null) === 'berjalan')
}

// ------------------------------------------------------------ telat & lampau
{
  const r = ringkasanSesi(sesi({ mulaiNyata: pada('08:12'), selesaiNyata: pada('10:05') }))
  cek('telat 12 menit', dekat(r.telat, 12), String(r.telat))
  cek('molor 5 menit', dekat(r.lampau, 5), String(r.lampau))
  cek('durasi nyata 113 menit', dekat(r.durasi, 113), String(r.durasi))
  cek('durasi rencana 120 menit', dekat(r.durasiRencana, 120), String(r.durasiRencana))
  cek('statusnya rampung', r.status === 'rampung')
  cek('tidak ditandai hari lain', r.hariLain === false)
}
{
  const r = ringkasanSesi(sesi({ mulaiNyata: pada('07:50'), selesaiNyata: pada('09:50') }))
  cek('lebih awal 10 menit (negatif)', dekat(r.telat, -10), String(r.telat))
  cek('lebih cepat 10 menit (negatif)', dekat(r.lampau, -10), String(r.lampau))
}
{
  // Aturan 1: yang belum ditandai tidak boleh jadi "tepat waktu".
  const r = ringkasanSesi(sesi({}))
  cek('tanpa penanda: telat null', r.telat === null, String(r.telat))
  cek('tanpa penanda: lampau null', r.lampau === null, String(r.lampau))
  cek('tanpa penanda: durasi null', r.durasi === null, String(r.durasi))
  cek('tanpa penanda: status belum', r.status === 'belum')
}
{
  // Mulai ditandai, selesai belum — molor belum bisa diketahui.
  const r = ringkasanSesi(sesi({ mulaiNyata: pada('08:30') }))
  cek('mulai saja: telat terbaca', dekat(r.telat, 30), String(r.telat))
  cek('mulai saja: lampau null', r.lampau === null, String(r.lampau))
  cek('mulai saja: durasi null', r.durasi === null, String(r.durasi))
  cek('mulai saja: status berjalan', r.status === 'berjalan')
}

// ------------------------------------------------- aturan 2: penanda beda hari
{
  const besok = pada('08:00') + 24 * 60 * 60_000
  const r = ringkasanSesi(sesi({ mulaiNyata: besok, selesaiNyata: besok + 60 * 60_000 }))
  cek('penanda besok ditandai hariLain', r.hariLain === true)
  cek('penanda besok: telat tidak dihitung', r.telat === null, String(r.telat))
  cek('penanda besok: lampau tidak dihitung', r.lampau === null, String(r.lampau))
  cek('penanda besok: statusnya tetap rampung', r.status === 'rampung')
}
{
  const kemarin = pada('08:00') - 24 * 60 * 60_000
  const r = ringkasanSesi(sesi({ mulaiNyata: kemarin, selesaiNyata: kemarin + 60 * 60_000 }))
  cek('penanda kemarin ditandai hariLain', r.hariLain === true)
  cek('penanda kemarin: telat tidak dihitung', r.telat === null)
}

// ------------------------------------------------- aturan 3: penanda mundur
{
  const r = ringkasanSesi(sesi({ mulaiNyata: pada('10:00'), selesaiNyata: pada('09:00') }))
  cek('penanda mundur: durasi null', r.durasi === null, String(r.durasi))
  cek('penanda mundur: tidak menghasilkan angka negatif', (r.durasi ?? 0) >= 0)
  // Keterlambatan mulainya tetap bisa dibaca: mulainya sendiri sah.
  cek('penanda mundur: telat tetap terbaca', dekat(r.telat, 120), String(r.telat))
}

// ---------------------------------------------------- aturan 4: ambang tepat
{
  const r = ringkasanSesi(sesi({ mulaiNyata: pada('08:00') + 40_000 })) // 40 detik
  cek('telat 40 detik masuk ambang', dekat(r.telat, 40 / 60), String(r.telat))
  cek('telat 40 detik terbaca "tepat waktu"', formatTelat(r.telat) === 'tepat waktu',
    formatTelat(r.telat))
}
{
  const r = ringkasanSesi(sesi({ mulaiNyata: pada('08:00') - 30_000 }))
  cek('lebih awal 30 detik terbaca "tepat waktu"', formatTelat(r.telat) === 'tepat waktu')
}
{
  const r = ringkasanSesi(sesi({ mulaiNyata: pada('07:59') }))
  cek('lebih awal 1 menit tidak lagi "tepat waktu"',
    formatTelat(r.telat) === '1 menit lebih awal', formatTelat(r.telat))
}
cek('AMBANG_TEPAT satu menit', AMBANG_TEPAT === 1)

// -------------------------------------------------------- rata-rata terboboti
{
  // Aturan 1 yang paling mudah dilanggar: sesi tanpa penanda tidak boleh
  // menarik rata-rata ke nol.
  const daftar = [
    ringkasanSesi(sesi({ id: 'a', mulaiNyata: pada('08:10'), selesaiNyata: pada('10:00') })), // telat 10
    ringkasanSesi(sesi({ id: 'b', mulaiNyata: pada('08:20'), selesaiNyata: pada('10:00') })), // telat 20
    ringkasanSesi(sesi({ id: 'c' })), // belum ditandai
    ringkasanSesi(sesi({ id: 'd' })), // belum ditandai
  ]
  cek('rata-rata hanya dari yang ditandai', dekat(rataTelat(daftar), 15), String(rataTelat(daftar)))
  cek('bila dihitung semua (salah) hasilnya 7,5',
    dekat((10 + 20 + 0 + 0) / 4, 7.5))
  cek('rata-rata molor hanya dari yang rampung', dekat(rataLampau(daftar), 0), String(rataLampau(daftar)))
}
{
  const daftar = [ringkasanSesi(sesi({ id: 'a' })), ringkasanSesi(sesi({ id: 'b' }))]
  cek('rataTelat tanpa penanda sama sekali = null', rataTelat(daftar) === null)
  cek('rataLampau tanpa penanda = null', rataLampau(daftar) === null)
}
{
  const daftar = []
  cek('rataTelat daftar kosong = null', rataTelat(daftar) === null)
}
{
  // Sesi yang ditandai pada hari lain tidak ikut merusak rata-rata.
  const daftar = [
    ringkasanSesi(sesi({ id: 'a', mulaiNyata: pada('08:10'), selesaiNyata: pada('10:00') })),
    ringkasanSesi(sesi({ id: 'b', mulaiNyata: pada('08:00') + 24 * 3600_000, selesaiNyata: pada('10:00') + 24 * 3600_000 })),
  ]
  cek('penanda beda hari tidak ikut rata-rata', dekat(rataTelat(daftar), 10), String(rataTelat(daftar)))
}

// ------------------------------------------------------------- formatTelat
cek('format null = belum ditandai', formatTelat(null) === 'belum ditandai')
cek('format 0 = tepat waktu', formatTelat(0) === 'tepat waktu')
cek('format 12 = telat 12 menit', formatTelat(12) === 'telat 12 menit')
cek('format 12.4 membulat', formatTelat(12.4) === 'telat 12 menit', formatTelat(12.4))
cek('format -12 = lebih awal', formatTelat(-12) === '12 menit lebih awal')
cek('format lampau null', formatLampau(null) === 'belum ditandai')
cek('format lampau 7 = molor', formatLampau(7) === 'molor 7 menit')
cek('format lampau -7 = lebih cepat', formatLampau(-7) === '7 menit lebih cepat')

// ------------------------------------------------------------ formatDurasi
cek('formatDurasi null = —', formatDurasi(null) === '—')
cek('formatDurasi 45 = 45 menit', formatDurasi(45) === '45 menit')
cek('formatDurasi 60 = 1 jam', formatDurasi(60) === '1 jam')
cek('formatDurasi 80 = 1 jam 20 menit', formatDurasi(80) === '1 jam 20 menit', formatDurasi(80))
cek('formatDurasi 120 = 2 jam', formatDurasi(120) === '2 jam')

// ------------------------------------------------- sesi lewat tengah malam
{
  const r = ringkasanSesi(sesi({ startTime: '23:00', endTime: '01:00', date: HARI }))
  cek('sesi lewat tengah malam: durasi rencana 120 menit',
    dekat(r.durasiRencana, 120), String(r.durasiRencana))
}

// ------------------------------------------------------- blok menggantung
{
  const r = ringkasanSesi(sesi({
    realisasiLatihan: [
      { id: 'b1', mulai: pada('08:00'), selesai: pada('08:30') },
      { id: 'b2', mulai: pada('08:30'), selesai: null },
    ],
  }))
  cek('blok menggantung dihitung 1', r.blokMenggantung === 1, String(r.blokMenggantung))
}
{
  const r = ringkasanSesi(sesi({ realisasiLatihan: [] }))
  cek('tanpa blok = 0 menggantung', r.blokMenggantung === 0)
}

// --------------------------------- penanda sesi TIDAK disimpulkan dari blok
{
  // Ini alasan G3 ada. Blok pertama mulai 08:15, tetapi penanda sesi
  // mencatat 08:05 — berkumpul lebih dulu, baru mulai. Bila penanda sesi
  // disimpulkan dari blok, selisih 10 menit ini hilang.
  const r = ringkasanSesi(sesi({
    mulaiNyata: pada('08:05'),
    selesaiNyata: pada('10:00'),
    realisasiLatihan: [{ id: 'b1', mulai: pada('08:15'), selesai: pada('08:45') }],
  }))
  cek('telat dihitung dari penanda sesi (5), bukan blok pertama (15)',
    dekat(r.telat, 5), String(r.telat))
  cek('penanda sesi tidak menimpa catatan blok', r.blokMenggantung === 0)
}

// -------------------------------------------- ringkasanSesi tidak mengubah data
{
  const asli = sesi({ mulaiNyata: pada('08:10'), selesaiNyata: pada('10:00') })
  const salin = JSON.parse(JSON.stringify(asli))
  ringkasanSesi(asli)
  cek('ringkasanSesi tidak mengubah sesinya', JSON.stringify(asli) === JSON.stringify(salin))
}

console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) {
  console.log('\nYang gagal:')
  gagal.forEach((g) => console.log('  ✗ ' + g))
  process.exit(1)
}
