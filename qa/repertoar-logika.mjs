/**
 * Uji logika murni tukar repertoar (M4).
 *
 * Yang paling penting di sini: **id lagu tidak boleh berubah**. `Drill.songId`
 * dan `SetList.songIds` menyimpan id, jadi kalau impor mengganti id, tautan
 * drill ke lagu putus dan set list jadi kosong. Itu cacat yang tidak
 * terlihat saat berkas dibuka — baru terasa berminggu-minggu kemudian.
 */
import {
  FORMAT_REPERTOAR,
  bacaPaket,
  bangunPaket,
  perluPeringatan,
  ringkasanImpor,
} from '/tmp/repertoar.mjs'

let lulus = 0
const gagal = []
const cek = (nama, syarat, keterangan = '') => {
  if (syarat) lulus += 1
  else gagal.push(`${nama}${keterangan ? ' — ' + keterangan : ''}`)
}

const lagu = (id, title, ekstra = {}) => ({
  id, title, bpm: 120, beats: 4, tempoMap: [], createdAt: 1, ...ekstra,
})

const LAGU = [lagu('L1', 'Mars Pembuka'), lagu('L2', 'Balada'), lagu('L3', 'Finale')]
const SETLIST = [
  { id: 'SL1', name: 'Show 2026', songIds: ['L1', 'L2'], createdAt: 1, updatedAt: 1 },
  { id: 'SL2', name: 'Parade', songIds: ['L3'], createdAt: 1, updatedAt: 1 },
  { id: 'SL3', name: 'Tanpa lagu terpilih', songIds: ['L9'], createdAt: 1, updatedAt: 1 },
]
const DRILL = [
  { id: 'D1', name: 'Drill Mars', songId: 'L1' },
  { id: 'D2', name: 'Drill Finale', songId: 'L3' },
  { id: 'D3', name: 'Drill tanpa lagu', songId: undefined },
]
const SET = [
  { id: 'S1', drillId: 'D1', order: 0, name: 'A', counts: 8, points: {} },
  { id: 'S2', drillId: 'D2', order: 0, name: 'A', counts: 8, points: {} },
  { id: 'S3', drillId: 'D99', order: 0, name: 'A', counts: 8, points: {} },
]

/* ==================== 1. Penyusunan mengikuti pilihan =================== */
const semua = bangunPaket({ songs: LAGU, setlists: SETLIST, drills: DRILL, sets: SET })
cek('tanpa pilihan, semua lagu ikut', semua.songs.length === 3)
cek('set list yang ikut hanya yang memuat lagu terpilih',
  semua.setlists.map((s) => s.id).sort().join(',') === 'SL1,SL2',
  semua.setlists.map((s) => s.id).join(','))
cek('drill yang ikut hanya yang menaut ke lagu terpilih',
  semua.drills.map((d) => d.id).sort().join(',') === 'D1,D2',
  semua.drills.map((d) => d.id).join(','))
cek('set yang ikut hanya milik drill yang ikut',
  semua.sets.map((s) => s.id).sort().join(',') === 'S1,S2',
  semua.sets.map((s) => s.id).join(','))

const sebagian = bangunPaket({
  songs: LAGU, setlists: SETLIST, drills: DRILL, sets: SET, songIds: ['L2'],
})
cek('pilih satu lagu: cuma itu yang ikut',
  sebagian.songs.map((s) => s.id).join(',') === 'L2')
cek('set list mengikuti lagu yang dipilih',
  sebagian.setlists.map((s) => s.id).join(',') === 'SL1')
cek('drill yg tidak menaut ke lagu terpilih tidak ikut',
  sebagian.drills.length === 0)
cek('set tidak ikut kalau drill-nya tidak ikut', sebagian.sets.length === 0)
cek('paket ditandai dengan formatnya', semua.format === FORMAT_REPERTOAR)

/* ======================== 2. Pembacaan & penolakan ====================== */
cek('teks bukan JSON ditolak', bacaPaket('{bukan json').ok === false)
cek('JSON asing ditolak', bacaPaket('{"format":"lain"}').ok === false)
cek('paket tanpa lagu ditolak',
  bacaPaket(JSON.stringify({ format: FORMAT_REPERTOAR })).ok === false)
cek('objek kosong ditolak', bacaPaket('{}').ok === false)
const dibaca = bacaPaket(JSON.stringify(semua))
cek('paket sah diterima', dibaca.ok === true, dibaca.alasan ?? '')
// Bekas versi lama yang belum punya set list/drill harus tetap bisa dibuka.
const lama = bacaPaket(JSON.stringify({
  format: FORMAT_REPERTOAR, version: 1, exportedAt: 5, songs: [lagu('L1', 'X')],
}))
cek('paket tanpa set list & drill tetap terbaca', lama.ok === true)
cek('bagian yang hilang dinormalisasi jadi larik kosong',
  lama.ok && lama.paket.setlists.length === 0 && lama.paket.drills.length === 0)

/* ======================= 3. ID TIDAK BOLEH BERUBAH ====================== */
// Inilah inti fitur ini. Kalau impor memberi id baru, Drill.songId dan
// SetList.songIds akan menunjuk ke lagu yang tidak ada lagi.
const paketL1 = bangunPaket({
  songs: [lagu('L1', 'Mars Pembuka')], setlists: [], drills: [], sets: [],
})
cek('id lagu dalam paket sama dengan aslinya', paketL1.songs[0].id === 'L1')
cek('lagu tidak disalin ulang (objek sama referensinya bisa beda, id sama)',
  paketL1.songs[0].id === LAGU[0].id)

/* ========================= 4. Ringkasan impor =========================== */
const punyaKosong = { songs: [], setlists: [], drills: [] }
const rKosong = ringkasanImpor(semua, punyaKosong)
cek('di perangkat kosong, semua serba baru', rKosong.baru.songs.length === 3)
cek('di perangkat kosong, tidak ada yang ditimpa', rKosong.timpa.songs.length === 0)
cek('ringkasan menghitung set yang ikut', rKosong.jumlahSet === 2)

// Perangkat yang sudah punya L1 (dengan isi BERBEDA) dan SL1.
const punya = {
  songs: [lagu('L1', 'Mars Pembuka — suntingan lokal', { bpm: 96 })],
  setlists: [{ id: 'SL1', name: 'Show 2026', songIds: ['L1'], createdAt: 1, updatedAt: 1 }],
  drills: [],
}
const r = ringkasanImpor(semua, punya)
cek('lagu yang sudah ada masuk hitungan "timpa"',
  r.timpa.songs.map((s) => s.id).join(',') === 'L1',
  r.timpa.songs.map((s) => s.id).join(','))
cek('lagu yang belum ada masuk "baru"',
  r.baru.songs.map((s) => s.id).sort().join(',') === 'L2,L3',
  r.baru.songs.map((s) => s.id).join(','))
cek('set list yang sudah ada ikut ditimpa', r.timpa.setlists.length === 1)
cek('drill semua baru di perangkat ini', r.baru.drills.length === 2)
cek('ringkasan ini patut diperingatkan', perluPeringatan(r) === true)
cek('ringkasan di perangkat kosong tidak perlu peringatan',
  perluPeringatan(rKosong) === false)

/* ============= 5. Rujukan yang hilang (lubang di set list) ============== */
// SL3 merujuk L9 yang tidak ada di paket maupun di perangkat.
const paketLubang = {
  format: FORMAT_REPERTOAR, version: 1, exportedAt: 1,
  songs: [lagu('L1', 'Mars Pembuka')],
  setlists: [{ id: 'SL3', name: 'Parade', songIds: ['L1', 'L9'], createdAt: 1, updatedAt: 1 }],
  drills: [], sets: [],
}
const rLubang = ringkasanImpor(paketLubang, punyaKosong)
cek('rujukan yang tak tersedia dilaporkan',
  rLubang.rujukanHilang.join(',') === 'L9', rLubang.rujukanHilang.join(','))
// Tapi kalau lagunya SUDAH ada di perangkat, bukan lubang.
const rAman = ringkasanImpor(paketLubang, {
  songs: [lagu('L9', 'Selingan')], setlists: [], drills: [],
})
cek('lagu yang sudah ada di perangkat bukan rujukan hilang',
  rAman.rujukanHilang.length === 0, rAman.rujukanHilang.join(','))
cek('tanpa lubang dan tanpa timpa, tidak ada peringatan',
  perluPeringatan(rAman) === false && rAman.rujukanHilang.length === 0)

/* ========================= 6. Rujukan dari drill ======================== */
const rDrill = ringkasanImpor(
  { ...paketLubang, setlists: [], drills: [{ id: 'D7', name: 'X', songId: 'L4' }] },
  punyaKosong,
)
cek('rujukan dari drill ikut diperiksa', rDrill.rujukanHilang.join(',') === 'L4',
  rDrill.rujukanHilang.join(','))

console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) {
  console.log('GAGAL:\n - ' + gagal.join('\n - '))
  process.exit(1)
}
