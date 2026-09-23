/**
 * Uji logika murni run sheet hari lomba (G1).
 *
 * Yang paling penting di sini: **"mungkin cukup" tidak boleh dilaporkan
 * sebagai "cukup"**. Set list yang belum lengkap panjang lagunya menghasilkan
 * total sementara; menyebutnya "cukup" akan membuat pelatih berhenti
 * mengecek, padahal angkanya belum final. Karena itu statusnya terpisah.
 */
import {
  bisaBerisiSetList,
  formatDetik,
  jamDariMenit,
  lamaSlot,
  menitDariJam,
  susunRunSheet,
} from '/tmp/runsheet.mjs'

let lulus = 0
const gagal = []
const cek = (nama, syarat, keterangan = '') => {
  if (syarat) lulus += 1
  else gagal.push(`${nama}${keterangan ? ' — ' + keterangan : ''}`)
}

const TGL = '2026-10-03'
const sesi = (id, judul, mulai, selesai, ekstra = {}) => ({
  id, judul, type: 'penampilan', date: TGL, startTime: mulai, endTime: selesai,
  checklist: [], createdAt: 1, ...ekstra,
})
const lagu = (id, title, detik, panjangBirama = 32) => ({
  id, title, bpm: 120, beats: 4, tempoMap: [], createdAt: 1, panjangBirama,
  // Durasi dikendalikan lewat tempo & panjang; 32 birama @120BPM/4 = 64 detik.
  ...(detik ? {} : {}),
})
const setlist = (id, name, songIds) => ({ id, name, songIds, createdAt: 1, updatedAt: 1 })

/* ----------------------------- Waktu ----------------------------------- */
cek('"15:30" → 930 menit', menitDariJam('15:30') === 930, `${menitDariJam('15:30')}`)
cek('"09:05" → 545 menit', menitDariJam('09:05') === 545)
cek('nol jam "00:00" → 0', menitDariJam('00:00') === 0)
cek('jam kosong → null', menitDariJam('') === null)
cek('jam undefined → null', menitDariJam(undefined) === null)
cek('format ngawur → null', menitDariJam('jam 9') === null)
cek('menit 60 → null', menitDariJam('09:60') === null)
cek('jam 24 → null', menitDariJam('24:00') === null)
cek('930 menit → "15:30"', jamDariMenit(930) === '15:30')
cek('0 menit → "00:00"', jamDariMenit(0) === '00:00')
cek('menit digulung dalam sehari', jamDariMenit(1440 + 90) === '01:30')

cek('lama slot 60 menit', lamaSlot(540, 600) === 60)
cek('slot terbalik → null', lamaSlot(600, 540) === null)
cek('slot nol → null', lamaSlot(600, 600) === null)
cek('slot dengan waktu hilang → null', lamaSlot(null, 600) === null)

/* -------------------- Susunan & urutan linimasa ------------------------- */
const SESI = [
  sesi('s2', 'Penampilan', '15:00', '15:10'),
  sesi('s1', 'Pemanasan', '13:00', '13:45'),
  sesi('s3', 'Rapat', '16:00', '16:30'),
]
const r = susunRunSheet({ tanggal: TGL, sessions: SESI, setlists: [], songs: [] })
cek('baris terurut menurut jam mulai',
  r.baris.map((b) => b.id).join(',') === 's1,s2,s3', r.baris.map((b) => b.id).join(','))
cek('hanya sesi pada tanggal itu yang masuk', r.baris.length === 3)
cek('jeda antar baris dihitung', r.baris[0].jeda === 75, `${r.baris[0].jeda}`)
cek('baris terakhir tidak punya jeda', r.baris[2].jeda === null)
cek('tanpa set list → status tanpaIsi',
  r.baris.every((b) => b.status === 'tanpaIsi'))
cek('total slot = 45 + 10 + 30 = 85', r.totalSlot === 85, `${r.totalSlot}`)

// Sesi di tanggal lain tidak boleh ikut.
const lain = susunRunSheet({
  tanggal: TGL,
  sessions: [...SESI, sesi('sX', 'Hari lain', '10:00', '11:00', { date: '2026-10-04' })],
  setlists: [], songs: [],
})
cek('sesi tanggal lain tidak ikut', lain.baris.length === 3)
cek('tanggal kosong → run sheet kosong',
  susunRunSheet({ tanggal: '2026-01-01', sessions: SESI, setlists: [], songs: [] }).baris.length === 0)

/* ------------------------- Bentrok & jeda negatif ----------------------- */
const bentrok = susunRunSheet({
  tanggal: TGL,
  sessions: [sesi('a', 'Pemanasan', '13:00', '13:45'), sesi('b', 'Penampilan', '13:30', '14:00')],
  setlists: [], songs: [],
})
cek('bentrok terdeteksi', bentrok.bentrok.length === 1, JSON.stringify(bentrok.bentrok))
cek('jeda bernilai negatif saat bentrok', bentrok.baris[0].jeda === -15, `${bentrok.baris[0].jeda}`)
cek('peringatan menyebut bentrok',
  bentrok.peringatan.some((p) => p.includes('tumpang-tindih')),
  JSON.stringify(bentrok.peringatan))

const rapat = susunRunSheet({
  tanggal: TGL,
  sessions: [sesi('a', 'Pemanasan', '13:00', '13:45'), sesi('b', 'Penampilan', '13:45', '14:00')],
  setlists: [], songs: [],
})
cek('jeda nol bukan bentrok', rapat.bentrok.length === 0)

/* ---------------- Slot tak sah & urutan baris tanpa waktu --------------- */
const takSah = susunRunSheet({
  tanggal: TGL,
  sessions: [
    sesi('a', 'Pemanasan', '13:00', '13:45'),
    sesi('b', 'Tanpa jam', '', ''),
    sesi('c', 'Penampilan', '14:00', '14:15'),
  ],
  setlists: [], songs: [],
})
cek('baris tanpa waktu diletakkan di akhir',
  takSah.baris.map((b) => b.id).join(',') === 'a,c,b', takSah.baris.map((b) => b.id).join(','))
cek('statusnya slotTakSah', takSah.baris[2].status === 'slotTakSah')
cek('peringatan menyebut waktu tak terbaca',
  takSah.peringatan.some((p) => p.includes('tidak terbaca')))

/* ------------------- ISI vs SLOT — inti fitur ini ---------------------- */
// 32 birama @ 120 BPM, 4 ketuk/birama = 64 detik per lagu.
const SONGS = [lagu('L1', 'Satu', true), lagu('L2', 'Dua', true)]
const SL = setlist('sl1', 'Show 2026', ['L1', 'L2'])

const muat = susunRunSheet({
  tanggal: TGL,
  sessions: [sesi('p', 'Penampilan', '15:00', '15:10', { setListId: 'sl1' })],
  setlists: [SL], songs: SONGS,
})
// 2 lagu × 64 detik = 128 detik di slot 10 menit = 600 detik.
cek('isi 128 detik tercatat', Math.abs((muat.baris[0].lamaIsi ?? 0) - 128) < 1,
  `${muat.baris[0].lamaIsi}`)
cek('slot 10 menit: status cukup', muat.baris[0].status === 'cukup', muat.baris[0].status)
cek('tidak ada peringatan kalau muat', muat.peringatan.length === 0,
  JSON.stringify(muat.peringatan))

// Slot 1 menit = 60 detik, isinya 128 detik → melebihi.
const sempit = susunRunSheet({
  tanggal: TGL,
  sessions: [sesi('p', 'Penampilan', '15:00', '15:01', { setListId: 'sl1' })],
  setlists: [SL], songs: SONGS,
})
cek('slot lebih sempit dari isi → melebihi', sempit.baris[0].status === 'melebihi',
  sempit.baris[0].status)
cek('peringatan menyebut isi lebih panjang dari slot',
  sempit.peringatan.some((p) => p.includes('lebih panjang dari slot')),
  JSON.stringify(sempit.peringatan))

/* --------- Lagu tanpa panjang: "mungkin cukup" BUKAN "cukup" ----------- */
const TANPA = [{ ...lagu('L1', 'Satu', true) }, { ...lagu('L2', 'Dua', true) }]
delete TANPA[1].panjangBirama
const takPasti = susunRunSheet({
  tanggal: TGL,
  sessions: [sesi('p', 'Penampilan', '15:00', '16:00', { setListId: 'sl1' })],
  setlists: [SL], songs: TANPA,
})
cek('lagu tanpa panjang → status takPasti, BUKAN cukup',
  takPasti.baris[0].status === 'takPasti', takPasti.baris[0].status)
cek('jumlah lagu tanpa panjang dilaporkan', takPasti.baris[0].tanpaPanjang === 1,
  `${takPasti.baris[0].tanpaPanjang}`)
cek('peringatan menyebut lagu belum diisi panjangnya',
  takPasti.peringatan.some((p) => p.includes('belum diisi panjangnya')),
  JSON.stringify(takPasti.peringatan))

/* ------------- Set list yang ditaut tapi id-nya tak ada ---------------- */
const hilang = susunRunSheet({
  tanggal: TGL,
  sessions: [sesi('p', 'Penampilan', '15:00', '15:10', { setListId: 'sl_tak_ada' })],
  setlists: [SL], songs: SONGS,
})
// Set list tak ketemu: dianggap tanpa isi, bukan error.
cek('set list hilang → tanpaIsi, tidak menjatuhkan',
  hilang.baris[0].status === 'tanpaIsi', hilang.baris[0].status)

/* --------------------------- Format tampilan --------------------------- */
cek('128 detik → "2:08"', formatDetik(128) === '2:08', formatDetik(128))
cek('0 detik → "0:00"', formatDetik(0) === '0:00')
cek('3725 detik → "1:02:05"', formatDetik(3725) === '1:02:05', formatDetik(3725))
cek('penampilan bisa berisi set list', bisaBerisiSetList('penampilan') === true)
cek('gabungan bisa berisi set list', bisaBerisiSetList('gabungan') === true)
cek('rapat tidak bisa berisi set list', bisaBerisiSetList('rapat') === false)

console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) {
  console.log('GAGAL:\n - ' + gagal.join('\n - '))
  process.exit(1)
}
