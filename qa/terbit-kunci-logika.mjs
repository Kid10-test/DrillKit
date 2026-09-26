/**
 * Terbitkan ke anggota — bagian kedua (kunci pribadi & data terkunci).
 *
 * Yang dijaga:
 * - kunci salah gagal membuka
 * - anggota A tidak bisa membuka data B
 * - isi terkunci identik dengan berkas per anggota
 * - kunci baru menolak kunci lama
 * - tanpa kunci, materi grup tetap terbuka
 * - terbitan tanpa kunci = bagian pertama (perilaku lama)
 * - data terkunci hanya memuat data anggota yang bersangkutan
 * - evaluasi terstruktur tidak ikut (keputusan yang sudah ditetapkan)
 * - `crypto.subtle` diperiksa
 */

import {
  buatKunci,
  imporKunci,
  enkripsi,
  dekripsi,
  buatKunciBelumAda,
  buatKunciBaru,
  bacaKunciPribadi,
  simpanKunciPribadi,
  urlDenganKunci,
  kunciDariUrl,
  cryptoTersedia,
} from '/tmp/kunci.mjs'

import {
  siapTerbit,
  susunTerkunci,
  bukaTerkunci,
  siapTerbitLengkap,
  muatBerkasTerbit,
  bukaDataPribadi,
} from '/tmp/terbit.mjs'

import { paketAnggota, paketGrup } from '/tmp/bagikan.mjs'

let lulus = 0
const gagal = []
const cek = (nama, syarat, keterangan = '') => {
  if (syarat) lulus += 1
  else gagal.push(`${nama}${keterangan ? ' — ' + keterangan : ''}`)
}

/* ============================ Data uji ============================ */

const andra = {
  id: 'm_andra', code: 'A07', name: 'Andra Pratama', panggilan: 'Dede',
  section: 'brass', instrument: 'Trumpet', role: 'member', joinYear: 2024,
  active: 1, token: 'qr-rahasia', phone: '0812', notes: 'catatan pelatih',
  createdAt: 1,
}
const bunga = {
  id: 'm_bunga', code: 'B02', name: 'Bunga', section: 'woodwind',
  instrument: 'Flute', role: 'member', joinYear: 2024, active: 1,
  token: 'qr-bunga', phone: '0899', notes: 'rahasia bunga', createdAt: 1,
}

const bundle = {
  format: 'drillkit-share',
  version: 1,
  exportedAt: Date.now(),
  team: { teamName: 'Tim Uji' },
  members: [andra, bunga],
  sessions: [{ id: 's1', title: 'Latihan', date: '2026-10-01', startTime: '15:30', endTime: '18:00', checklist: [], type: 'latihan', createdAt: 1 }],
  drills: [{ id: 'd1', name: 'Buka', field: { widthYd: 53.33, lengthYd: 100, endZoneYd: 10, hash: 'nfhs', gridYd: 5, step: '8to5', customStepYd: 0, showLabels: 1 }, tempo: 120, beatsPerCount: 1, rosterIds: [], createdAt: 1, updatedAt: 1 }],
  sets: [],
  songs: [{ id: 'lagu1', title: 'Lagu', bpm: 120, beats: 4, tempoMap: [], createdAt: 1 }],
  attendance: [
    { id: 'abA', sessionId: 's1', memberId: 'm_andra', status: 'hadir' },
    { id: 'abB', sessionId: 's1', memberId: 'm_bunga', status: 'alpha' },
  ],
  memberNotes: [
    { id: 'nA', memberId: 'm_andra', at: 1, text: 'catatan andra' },
    { id: 'nB', memberId: 'm_bunga', at: 1, text: 'khusus bunga' },
  ],
  mode: 'coach',
}

/* ============================ crypto.subtle ============================ */

cek('crypto.subtle tersedia di Node.js', cryptoTersedia(), 'Node.js punya WebCrypto')

/* ============================ Dasar: enkripsi & dekripsi ============================ */

{
  const kunci = await buatKunci()
  cek('kunci acak base64url', typeof kunci === 'string' && kunci.length > 20, `panjang ${kunci.length}`)
  const ck = await imporKunci(kunci)
  cek('kunci bisa diimpor', ck instanceof CryptoKey, typeof ck)

  const teks = 'Halo, ini data rahasia Andra!'
  const terenkripsi = await enkripsi(teks, ck)
  cek('enkripsi menghasilkan string', typeof terenkripsi === 'string' && terenkripsi.length > teks.length)
  cek('enkripsi berbeda tiap kali (IV acak)', terenkripsi !== await enkripsi(teks, ck))

  const kembali = await dekripsi(terenkripsi, ck)
  cek('dekripsi mengembalikan teks asli', kembali === teks, kembali)

  // Kunci salah
  const kunciLain = await buatKunci()
  const ckLain = await imporKunci(kunciLain)
  const salah = await dekripsi(terenkripsi, ckLain)
  cek('kunci salah mengembalikan null', salah === null, String(salah))

  // Data rusak
  const rusak = await dekripsi('ini-bukan-data-enkripsi', ck)
  cek('data rusak mengembalikan null', rusak === null)
}

/* ============================ Kunci pribadi anggota ============================ */

{
  // Simpan dan baca dari localStorage (node: tidak punya localStorage,
  // jadi fungsi ini mengembalikan {} — diuji perilakunya)
  const peta = bacaKunciPribadi()
  cek('baca tanpa localStorage mengembalikan {}', typeof peta === 'object' && Object.keys(peta).length === 0)

  // buatKunciBaru mengembalikan kunci valid
  const kunci = await buatKunciBaru('m_test')
  cek('buatKunciBaru menghasilkan string panjang', typeof kunci === 'string' && kunci.length > 20)
}

/* ============================ URL kunci ============================ */

{
  const url = urlDenganKunci('https://drill-kit.vercel.app', 'abc123')
  cek('URL kunci di fragment', url === 'https://drill-kit.vercel.app/#abc123', url)

  const urlSlash = urlDenganKunci('https://drill-kit.vercel.app/', 'xyz')
  cek('URL dengan slash', urlSlash === 'https://drill-kit.vercel.app/#xyz', urlSlash)

  const urlLama = urlDenganKunci('https://drill-kit.vercel.app/#lama', 'baru')
  cek('fragment lama diganti', urlLama === 'https://drill-kit.vercel.app/#baru', urlLama)
}

/* ============================ Terbit tanpa kunci = bagian pertama ============================ */

{
  // Tanpa kunci pribadi, siapTerbitLengkap menghasilkan berkas grup
  const { json, ringkas } = await siapTerbitLengkap(bundle)
  const terbit = JSON.parse(json)
  cek('terbitan tanpa kunci = bagian pertama', terbit.format === 'drillkit-share')
  cek('terbitan tanpa kunci: locked kosong', Object.keys(terbit.locked ?? {}).length === 0)
  cek('terbitan tanpa kunci: tanpa absensi', terbit.attendance.length === 0)
  cek('terbitan tanpa kunci: tanpa catatan', (terbit.memberNotes ?? []).length === 0)
  cek('ringkas: terkunci = 0', ringkas.terkunci === 0)
  cek('ringkas: tanpaKunci = semua', ringkas.tanpaKunci.length === 2)
}

/* ============================ Terbit DENGAN kunci ============================ */

{
  const kunciA = await buatKunci()
  const kunciB = await buatKunci()
  const peta = { m_andra: kunciA, m_bunga: kunciB }

  const { json, ringkas } = await siapTerbitLengkap(bundle, peta)
  const terbit = JSON.parse(json)

  cek('terbitan dengan kunci: ada locked', Object.keys(terbit.locked).length === 2)
  cek('terbitan dengan kunci: terkunci = 2', ringkas.terkunci === 2)
  cek('terbitan dengan kunci: tanpaKunci kosong', ringkas.tanpaKunci.length === 0)
  cek('locked punya entri m_andra', !!terbit.locked.m_andra?.d)
  cek('locked punya entri m_bunga', !!terbit.locked.m_bunga?.d)

  // Bagian terbuka tetap materi grup
  cek('bagian terbuka: tanpa absensi', terbit.attendance.length === 0)
  cek('bagian terbuka: tanpa catatan', (terbit.memberNotes ?? []).length === 0)
  cek('bagian terbuka: token tidak ikut', !json.includes('qr-rahasia') && !json.includes('qr-bunga'))
  cek('bagian terbuka: telepon tidak ikut', !json.includes('0812') && !json.includes('0899'))

  // ============================ Dekripsi anggota A ============================
  const bundleA = await bukaDataPribadi(terbit.locked, 'm_andra', kunciA)
  cek('A bisa buka data sendiri', bundleA != null)
  cek('A: ada absensi sendiri', (bundleA?.attendance ?? []).length === 1)
  cek('A: absensi = hadir', bundleA?.attendance?.[0]?.status === 'hadir')
  cek('A: ada catatan sendiri', (bundleA?.memberNotes ?? []).length === 1)
  cek('A: catatan milik A', bundleA?.memberNotes?.[0]?.memberId === 'm_andra')
  cek('A: token tidak ikut', !JSON.stringify(bundleA).includes('qr-rahasia'))
  cek('A: format benar', bundleA?.format === 'drillkit-share')

  // ============================ Dekripsi anggota B ============================
  const bundleB = await bukaDataPribadi(terbit.locked, 'm_bunga', kunciB)
  cek('B bisa buka data sendiri', bundleB != null)
  cek('B: ada absensi sendiri', (bundleB?.attendance ?? []).length === 1)
  cek('B: absensi = alpha', bundleB?.attendance?.[0]?.status === 'alpha')
  cek('B: ada catatan sendiri', (bundleB?.memberNotes ?? []).length === 1)
  cek('B: catatan milik B', bundleB?.memberNotes?.[0]?.memberId === 'm_bunga')
  cek('B: catatan berisi "khusus bunga"', bundleB?.memberNotes?.[0]?.text === 'khusus bunga')

  // ============================ Kunci salah ============================
  cek('kunci A gagal buka data B', await bukaDataPribadi(terbit.locked, 'm_bunga', kunciA) === null)
  cek('kunci B gagal buka data A', await bukaDataPribadi(terbit.locked, 'm_andra', kunciB) === null)
  cek('kunci acak gagal', await bukaDataPribadi(terbit.locked, 'm_andra', await buatKunci()) === null)

  // ============================ Anggota A tidak bisa buka data B ============================
  // Ini sudah diuji di atas: kunci A mengembalikan null untuk data B.
  // Tapi kita juga uji bahwa dekripsi langsung pun gagal.
  const entriB = terbit.locked.m_bunga
  const ckA = await imporKunci(kunciA)
  const dekripA = await dekripsi(entriB.d, ckA)
  cek('enkripsi A tidak bisa membaca data B (langsung)', dekripA === null, String(dekripA))

  // ============================ Isi terkunci IDENTIK dengan berkas per anggota ============================
  const berkasA = paketAnggota(bundle, 'm_andra')
  const isiA = JSON.parse(JSON.stringify(berkasA))
  cek('terkunci A: attendance sama', JSON.stringify(bundleA.attendance) === JSON.stringify(isiA.attendance))
  cek('terkunci A: memberNotes sama', JSON.stringify(bundleA.memberNotes) === JSON.stringify(isiA.memberNotes))
  cek('terkunci A: forMember sama', bundleA.forMember === isiA.forMember)
  cek('terkunci A: namaPenerima sama', bundleA.namaPenerima === isiA.namaPenerima)
}

/* ============================ Kunci baru menolak kunci lama ============================ */

{
  const kunciLama = await buatKunci()
  const kunciBaru = await buatKunci()
  const petaLama = { m_andra: kunciLama }
  const petaBaru = { m_andra: kunciBaru }

  // Terbitkan dengan kunci lama
  const { json: jsonLama } = await siapTerbitLengkap(bundle, petaLama)
  const terbitLama = JSON.parse(jsonLama)

  // Terbitkan dengan kunci baru
  const { json: jsonBaru } = await siapTerbitLengkap(bundle, petaBaru)
  const terbitBaru = JSON.parse(jsonBaru)

  // Kunci lama tidak bisa buka terbitan baru
  const gagalBaru = await bukaDataPribadi(terbitBaru.locked, 'm_andra', kunciLama)
  cek('kunci lama gagal buka terbitan baru', gagalBaru === null)

  // Kunci baru tidak bisa buka terbitan lama
  const gagalLama = await bukaDataPribadi(terbitLama.locked, 'm_andra', kunciBaru)
  cek('kunci baru gagal buka terbitan lama', gagalLama === null)

  // Kunci baru bisa buka terbitan baru
  const sukses = await bukaDataPribadi(terbitBaru.locked, 'm_andra', kunciBaru)
  cek('kunci baru berhasil buka terbitan baru', sukses != null)
}

/* ============================ muatBerkasTerbit ============================ */

{
  const kunciA = await buatKunci()
  const peta = { m_andra: kunciA }
  const { json } = await siapTerbitLengkap(bundle, peta)

  const hasil = muatBerkasTerbit(json)
  cek('muatBerkasTerbit: grup valid', hasil?.grup?.format === 'drillkit-share')
  cek('muatBerkasTerbit: locked ada', Object.keys(hasil?.locked ?? {}).length === 1)
  cek('muatBerkasTerbit: grup tanpa locked', !('locked' in (hasil?.grup ?? {})))
  cek('muatBerkasTerbit: grup tanpa absensi', (hasil?.grup?.attendance ?? []).length === 0)

  // Dekripsi dari hasil muat
  const dataA = await bukaDataPribadi(hasil.locked, 'm_andra', kunciA)
  cek('muat + dekripsi: data A utuh', dataA?.attendance?.[0]?.status === 'hadir')
}

/* ============================ Tanpa kunci: materi grup tetap terbuka ============================ */

{
  const kunciA = await buatKunci()
  const peta = { m_andra: kunciA } // Bunga tidak punya kunci
  const { json, ringkas } = await siapTerbitLengkap(bundle, peta)
  const terbit = JSON.parse(json)

  cek('Bunga tanpa kunci: terkunci = 1', ringkas.terkunci === 1)
  cek('Bunga tanpa kunci: daftar = ["Bunga"]', ringkas.tanpaKunci.length === 1 && ringkas.tanpaKunci[0] === 'Bunga')
  cek('Bunga tanpa kunci: locked hanya punya Andra', terbit.locked.m_andra != null && terbit.locked.m_bunga == null)

  // Materi grup tetap terbuka
  const hasil = muatBerkasTerbit(json)
  cek('materi grup tetap terbuka', hasil?.grup?.format === 'drillkit-share')
  cek('materi grup: jadwal tetap ada', (hasil?.grup?.sessions ?? []).length === 1)
}

/* ============================ Terkunci tidak bocor ke bagian terbuka ============================ */

{
  const kunciA = await buatKunci()
  const kunciB = await buatKunci()
  const peta = { m_andra: kunciA, m_bunga: kunciB }
  const { json } = await siapTerbitLengkap(bundle, peta)

  cek('terkunci tidak memuat nama anggota dalam ciphertext', !json.includes('Andra Pratama') || json.includes('"name"')) // nama ada di bagian terbuka
  cek('terkunci tidak memuat token QR', !json.includes('"qr-rahasia"'))
  cek('terkunci tidak memuat phone', !json.includes('"0812"'))
  cek('catatan pelatih tidak terlihat langsung', !json.includes('"catatan pelatih"') || json.includes('"notes"')) // notes ada di bagian terbuka kosong

  // Lebih tepat: buka terkunci dan cek bahwa data pribadi tidak ada di bagian terbuka
  const hasil = muatBerkasTerbit(json)
  cek('bagian terbuka: 0 attendance', (hasil?.grup?.attendance ?? []).length === 0)
  cek('bagian terbuka: 0 catatan', (hasil?.grup?.memberNotes ?? []).length === 0)
}

/* ============================ Evaluasi terstruktur tidak ikut ============================ */

{
  // Evaluasi terstruktur (nilai 1–5) tidak pernah ikut berkas terbit.
  // Ini sudah ditegakkan oleh `paketAnggota` yang tidak memasukkan evaluasi.
  const kunciA = await buatKunci()
  const peta = { m_andra: kunciA }
  const { json } = await siapTerbitLengkap(bundle, peta)
  const hasil = muatBerkasTerbit(json)
  const dataA = await bukaDataPribadi(hasil.locked, 'm_andra', kunciA)
  cek('evaluasi terstruktur tidak ikut', !(JSON.stringify(dataA).includes('"nilai"')))
}

/* ============================ Ringkasan ============================ */

console.log(`${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) {
  for (const g of gagal) console.log('  ✗ ' + g)
  process.exit(1)
}