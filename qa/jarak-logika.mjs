/**
 * Uji 31e — dasar jarak: jarak tempuh (mengikuti kelengkungan) vs garis lurus.
 *
 * Yang paling penting di sini justru yang **tidak** berubah: pada jalur lurus
 * kedua dasar harus memberi hasil yang sama persis. Kalau tidak, fitur ini
 * diam-diam mengubah angka di semua drill lama — cacat yang jauh lebih
 * menyusahkan daripada fitur yang tidak ada.
 */
import { analisisPerpindahan, rasioLengkung } from '/tmp/analitik.mjs'

let lulus = 0
const gagal = []
const cek = (nama, syarat, keterangan = '') => {
  if (syarat) lulus += 1
  else gagal.push(`${nama}${keterangan ? ' — ' + keterangan : ''}`)
}

const STEP_YD = 0.625 // 8-to-5 = 22,5 inci
const ANGGOTA = [{ id: 'm1', name: 'Pemain Uji', section: 'brass', active: 1 }]
const buatSet = (points, gerak) => ({
  id: 'a',
  drillId: 'd',
  order: 0,
  name: 'A',
  counts: 8,
  points,
  ...(gerak ? { gerak } : {}),
})

const jalankan = (dari, ke, dasarJarak) =>
  analisisPerpindahan(dari, ke, ANGGOTA, STEP_YD, 120, 1, undefined, undefined, undefined, dasarJarak)

/* ============= 1. Jalur lurus: kedua dasar HARUS sama persis ============= */
const A = { m1: { x: 0, y: 0, facing: 0 } }
const B = { m1: { x: 10, y: 0, facing: 0 } }
const lurusJalur = jalankan(buatSet(A, { jalur: 'lurus' }), buatSet(B), 'jalur')
const lurusLurus = jalankan(buatSet(A, { jalur: 'lurus' }), buatSet(B), 'lurus')
cek('jalur lurus: jaraknya 10 yard', Math.abs(lurusJalur.daftar[0].jarakYd - 10) < 1e-9,
  `${lurusJalur.daftar[0].jarakYd}`)
cek('JALUR LURUS TIDAK BERUBAH oleh pilihan dasar',
  Math.abs(lurusJalur.daftar[0].jarakYd - lurusLurus.daftar[0].jarakYd) < 1e-9,
  `${lurusJalur.daftar[0].jarakYd} vs ${lurusLurus.daftar[0].jarakYd}`)
cek('jumlah langkah pun sama di jalur lurus',
  Math.abs(lurusJalur.daftar[0].jarakLangkah - lurusLurus.daftar[0].jarakLangkah) < 1e-9)

// Tanpa pengaturan gerak sama sekali (drill lama) harus tetap sama.
const polos = jalankan(buatSet(A), buatSet(B), undefined)
cek('drill tanpa pengaturan gerak: jarak 10 yard', Math.abs(polos.daftar[0].jarakYd - 10) < 1e-9)
cek('dasar jarak kosong sama dengan "jalur"',
  Math.abs(polos.daftar[0].jarakYd - lurusJalur.daftar[0].jarakYd) < 1e-9)

/* ================ 2. Jalur melengkung: kedua dasar berbeda =============== */
const lengkung = { jalur: 'lengkung', lengkung: 1 }
const kJalur = jalankan(buatSet(A, lengkung), buatSet(B), 'jalur')
const kLurus = jalankan(buatSet(A, lengkung), buatSet(B), 'lurus')
const dJalur = kJalur.daftar[0].jarakYd
const dLurus = kLurus.daftar[0].jarakYd

cek('jalur melengkung: jarak tempuh LEBIH PANJANG dari garis lurus',
  dJalur > dLurus + 1e-9, `${dJalur} vs ${dLurus}`)
cek('garis lurus pada jalur melengkung = perpindahan sebenarnya (10 yard)',
  Math.abs(dLurus - 10) < 1e-9, `${dLurus}`)
cek('jarak tempuh = perpindahan × rasio kelengkungan',
  Math.abs(dJalur - 10 * rasioLengkung(1)) < 1e-9, `${dJalur} vs ${10 * rasioLengkung(1)}`)
cek('lengkungan 1 membuat jarak ~14,8% lebih panjang',
  Math.abs(dJalur / dLurus - 1.148) < 0.002, `${(dJalur / dLurus).toFixed(4)}`)

/* ============ 3. Jumlah langkah mengikuti dasar yang dipilih ============= */
cek('langkah pada "lurus" lebih sedikit daripada "jalur"',
  kLurus.daftar[0].jarakLangkah < kJalur.daftar[0].jarakLangkah,
  `${kLurus.daftar[0].jarakLangkah} vs ${kJalur.daftar[0].jarakLangkah}`)
cek('langkah "lurus" = 10 yard / 22,5 inci = 16 langkah',
  Math.abs(kLurus.daftar[0].jarakLangkah - 16) < 1e-9,
  `${kLurus.daftar[0].jarakLangkah}`)
cek('langkah "jalur" = 16 × rasio',
  Math.abs(kJalur.daftar[0].jarakLangkah - 16 * rasioLengkung(1)) < 1e-9,
  `${kJalur.daftar[0].jarakLangkah}`)

/* ========= 4. Mode tetap: ukuran langkah terkunci, yang berubah kecepatan = */
// Pada mode 'tetap' ukuran langkah dikunci 22,5", jadi yang berbeda hanya
// langkah per hitungan — bukan ukuran langkahnya.
cek('mode tetap: ukuran langkah tetap 22,5" di kedua dasar',
  Math.abs(kJalur.daftar[0].ukuranLangkahInci - 22.5) < 1e-9 &&
  Math.abs(kLurus.daftar[0].ukuranLangkahInci - 22.5) < 1e-9)
cek('mode tetap: langkah/menit "jalur" lebih tinggi',
  kJalur.daftar[0].langkahPerMenit > kLurus.daftar[0].langkahPerMenit,
  `${kJalur.daftar[0].langkahPerMenit} vs ${kLurus.daftar[0].langkahPerMenit}`)

/* ====== 5. Mode menyesuaikan: ukuran langkah yang mengecil/membesar ====== */
const menyesuaikan = { mode: 'menyesuaikan', langkahPerCount: 1 }
const sJalur = analisisPerpindahan(buatSet(A, lengkung), buatSet(B), ANGGOTA, STEP_YD, 120, 1,
  undefined, menyesuaikan, undefined, 'jalur')
const sLurus = analisisPerpindahan(buatSet(A, lengkung), buatSet(B), ANGGOTA, STEP_YD, 120, 1,
  undefined, menyesuaikan, undefined, 'lurus')
// Jumlah langkah ditentukan hitungan (8 × 1 = 8), jadi ukuran langkahnya
// yang menyesuaikan — dan lebih besar pada jarak tempuh yang lebih panjang.
cek('mode menyesuaikan: jumlah langkah sama di kedua dasar (8)',
  Math.abs(sJalur.daftar[0].jarakLangkah - 8) < 1e-9 &&
  Math.abs(sLurus.daftar[0].jarakLangkah - 8) < 1e-9,
  `${sJalur.daftar[0].jarakLangkah} / ${sLurus.daftar[0].jarakLangkah}`)
cek('mode menyesuaikan: ukuran langkah "jalur" lebih besar',
  sJalur.daftar[0].ukuranLangkahInci > sLurus.daftar[0].ukuranLangkahInci,
  `${sJalur.daftar[0].ukuranLangkahInci.toFixed(2)} vs ${sLurus.daftar[0].ukuranLangkahInci.toFixed(2)}`)

console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) {
  console.log('GAGAL:\n - ' + gagal.join('\n - '))
  process.exit(1)
}
