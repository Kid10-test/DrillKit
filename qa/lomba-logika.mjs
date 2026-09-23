/**
 * Uji logika murni mode lomba (G2).
 *
 * Yang dikuji di sini adalah **keadaan batas** — jam tepat di ujung sebuah
 * slot. Di situlah letak kesalahan yang paling menjengkelkan pada hari H:
 * pada pukul 08:00:00 tampilan masih bilang "Pemanasan", padahal penampilan
 * sudah dimulai. Karena itu rentang slot dibuat setengah terbuka:
 * mulai ≤ now < selesai.
 */
import { formatHitungMundur, formatMenit, posisiHari } from '/tmp/lomba.mjs'
import { susunRunSheet } from '/tmp/runsheet.mjs'

let lulus = 0
const gagal = []
const cek = (nama, syarat, keterangan = '') => {
  if (syarat) lulus += 1
  else gagal.push(`${nama}${keterangan ? ' — ' + keterangan : ''}`)
}

const TGL = '2026-10-03'
const m = (j) => {
  const [h, n] = j.split(':').map(Number)
  return h * 60 + n
}
const sesi = (id, judul, mulai, selesai, ekstra = {}) => ({
  id, judul, type: 'penampilan', date: TGL, startTime: mulai, endTime: selesai,
  checklist: [], createdAt: 1, ...ekstra,
})
const lagu = (id) => ({ id, title: id, bpm: 120, beats: 4, tempoMap: [], createdAt: 1, panjangBirama: 32 })

const HARI = [
  sesi('a', 'Pemanasan', '06:30', '07:15', { type: 'latihan' }),
  sesi('b', 'Penampilan', '08:00', '08:12', { setListId: 'sl' }),
  sesi('c', 'Evaluasi', '08:20', '09:00', { type: 'rapat' }),
]
const RUN = (songs = [lagu('L1')], setlists = [{ id: 'sl', name: 'Show', songIds: ['L1'], createdAt: 1, updatedAt: 1 }]) =>
  susunRunSheet({ tanggal: TGL, sessions: HARI, setlists, songs })

/* ===================== Sebelum hari dimulai ============================ */
const p1 = posisiHari(RUN(), m('05:00'))
cek('sebelum sesi pertama: fase belumMulai', p1.fase === 'belumMulai', p1.fase)
cek('belum ada sesi berjalan', p1.sekarang === null)
cek('berikutnya = pemanasan', p1.berikutnya?.id === 'a', p1.berikutnya?.id)
cek('hitung mundur 90 menit', p1.menitKeBerikutnya === 90, `${p1.menitKeBerikutnya}`)
cek('belum ada yang lewat', p1.sudahLewat === 0)
cek('tidak ada sisa slot', p1.sisaSlot === null)

/* ============== Tepat di UJUNG slot — batas yang menentukan ============= */
// 07:15 adalah waktu SELESAI pemanasan sekaligus bukan waktu mulai apa pun.
const p2 = posisiHari(RUN(), m('07:15'))
cek('07:15 bukan lagi pemanasan (rentang setengah terbuka)', p2.sekarang === null,
  p2.sekarang?.id ?? 'null')
cek('07:15 → fase senggang', p2.fase === 'senggang', p2.fase)
cek('pemanasan sudah terhitung lewat', p2.sudahLewat === 1, `${p2.sudahLewat}`)
cek('berikutnya = penampilan', p2.berikutnya?.id === 'b')

// 08:00 tepat: penampilan BARU saja dimulai, pemanasan sudah selesai.
const p3 = posisiHari(RUN(), m('08:00'))
cek('08:00 → sedang penampilan', p3.sekarang?.id === 'b', p3.sekarang?.id ?? 'null')
cek('08:00 → fase sedang', p3.fase === 'sedang')
cek('sisa slot penuh 12 menit', p3.sisaSlot === 12, `${p3.sisaSlot}`)
cek('pemanasan sudah lewat', p3.sudahLewat === 1)

// 08:11:59 masih di dalam; 08:12 sudah keluar.
const p3b = posisiHari(RUN(), m('08:11'))
cek('08:11 masih penampilan', p3b.sekarang?.id === 'b')
cek('sisa slot tinggal 1 menit', p3b.sisaSlot === 1, `${p3b.sisaSlot}`)
const p3c = posisiHari(RUN(), m('08:12'))
cek('08:12 sudah bukan penampilan', p3c.sekarang === null)
cek('08:12 → senggang menunggu evaluasi', p3c.fase === 'senggang', p3c.fase)
cek('dua sesi sudah lewat', p3c.sudahLewat === 2, `${p3c.sudahLewat}`)
cek('berikutnya = evaluasi', p3c.berikutnya?.id === 'c')

/* ===================== Hari selesai =================================== */
const p4 = posisiHari(RUN(), m('09:00'))
cek('09:00 → fase rampung', p4.fase === 'rampung', p4.fase)
cek('tidak ada berikutnya', p4.berikutnya === null)
cek('semua sesi terhitung lewat', p4.sudahLewat === 3, `${p4.sudahLewat}`)
const p5 = posisiHari(RUN(), m('23:59'))
cek('jauh setelah hari selesai tetap rampung', p5.fase === 'rampung')

/* ============== Penampilan yang perlu dipersiapkan ===================== */
const p6 = posisiHari(RUN(), m('06:30'))
cek('sedang pemanasan: tampilan = penampilan berikutnya',
  p6.tampilan?.id === 'b', p6.tampilan?.id ?? 'null')
const p7 = posisiHari(RUN(), m('08:05'))
cek('sedang tampil: tampilan = sesi itu sendiri', p7.tampilan?.id === 'b')
// Sesi terakhir tidak punya set list → tak ada yang perlu dipersiapkan.
const p8 = posisiHari(RUN(), m('08:25'))
cek('sesi tanpa set list tidak jadi "tampilan"', p8.tampilan === null, p8.tampilan?.id ?? 'null')
// Set list hilang (id tak ketemu) → tanpa isi, jadi bukan tampilan.
const p9 = posisiHari(RUN([lagu('L1')], []), m('06:30'))
cek('set list yang tak ketemu tidak jadi "tampilan"', p9.tampilan === null)

/* ==================== Baris tanpa waktu diabaikan ====================== */
const RUN_TANPA = susunRunSheet({
  tanggal: TGL,
  sessions: [...HARI, sesi('z', 'Tanpa jam', '', '')],
  setlists: [{ id: 'sl', name: 'Show', songIds: ['L1'], createdAt: 1, updatedAt: 1 }],
  songs: [lagu('L1')],
})
const pA = posisiHari(RUN_TANPA, m('06:30'))
cek('baris tanpa waktu tidak dihitung sebagai sesi', pA.totalSesi === 3, `${pA.totalSesi}`)
cek('baris tanpa waktu tidak pernah jadi "berikutnya"',
  pA.berikutnya?.id !== 'z', pA.berikutnya?.id ?? 'null')
const pB = posisiHari(RUN_TANPA, m('09:30'))
cek('hari tetap rampung walau ada baris tanpa waktu', pB.fase === 'rampung', pB.fase)

/* ======================== Hari tanpa sesi ============================= */
const KOSONG = susunRunSheet({ tanggal: TGL, sessions: [], setlists: [], songs: [] })
const pC = posisiHari(KOSONG, m('08:00'))
cek('hari kosong → rampung', pC.fase === 'rampung', pC.fase)
cek('hari kosong: total 0', pC.totalSesi === 0)
cek('hari kosong: tidak ada tampilan', pC.tampilan === null)

/* ========================= Format tampilan ============================ */
cek('45 menit → "45 mnt"', formatMenit(45) === '45 mnt')
cek('1 menit → "1 mnt"', formatMenit(1) === '1 mnt')
cek('0 → "0 mnt"', formatMenit(0) === '0 mnt')
cek('60 → "1 jam"', formatMenit(60) === '1 jam', formatMenit(60))
cek('80 → "1 jam 20 mnt"', formatMenit(80) === '1 jam 20 mnt', formatMenit(80))
cek('negatif digenapkan ke 0', formatMenit(-5) === '0 mnt')

cek('0 detik → "00:00"', formatHitungMundur(0) === '00:00')
cek('59 detik → "00:59"', formatHitungMundur(59) === '00:59')
cek('90 detik → "01:30"', formatHitungMundur(90) === '01:30', formatHitungMundur(90))
cek('3725 detik → "1:02:05"', formatHitungMundur(3725) === '1:02:05', formatHitungMundur(3725))
cek('detik negatif digenapkan', formatHitungMundur(-10) === '00:00')

console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) {
  console.log('GAGAL:\n - ' + gagal.join('\n - '))
  process.exit(1)
}
