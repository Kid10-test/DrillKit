/**
 * Satu anggota, dua nama — uji logika murni.
 *
 * Yang harus tetap benar:
 * - panggilan kosong tidak pernah menyembunyikan nama lengkap
 * - cetakan resmi tidak lewat fungsi ini (nama lengkap tetap `name`)
 * - penggabungan memindahkan rujukan, melaporkan bentrok, dan yang
 *   dipertahankan menang
 * - pencocokan diingat lewat alias, jadi impor berikutnya tidak ditanya lagi
 * - pertukaran dua arah berakhir dengan id yang sama
 * - paket anggota memuat jadwal sekaligus posisi drill, dan menulis
 *   "Andra Pratama (Dede)"
 */
import {
  bacaBarisCsvAnggota,
  bacaModeNama,
  cocokCari,
  keputusanAwal,
  kemiripanNama,
  namaDenganPanggilan,
  namaTampil,
  perluDitanya,
  rencanakanGabung,
  rencanakanInduk,
  sarankanGanda,
  saringBentrokLokal,
  susunSaran,
  terapkanCocok,
  tulisUlangMuatan,
  tulisUlangSet,
} from '/tmp/namaAnggota.mjs'
import { namaBerkasAnggota, paketAnggota } from '/tmp/bagikan.mjs'

let lulus = 0
const gagal = []
const cek = (nama, syarat, keterangan = '') => {
  if (syarat) lulus += 1
  else gagal.push(`${nama}${keterangan ? ' — ' + keterangan : ''}`)
}

const anggota = (id, name, extra = {}) => ({
  id,
  code: extra.code ?? 'T1',
  name,
  section: extra.section ?? 'brass',
  instrument: extra.instrument ?? 'Trumpet',
  role: 'member',
  joinYear: 2024,
  active: 1,
  token: extra.token ?? `t_${id}`,
  createdAt: 1,
  ...extra,
  id,
  name,
})

const titik = (x, y) => ({ x, y, facing: 'front' })
const set = (id, drillId, points, langkah) => ({
  id, drillId, order: 0, name: id, counts: 8, points, langkah, createdAt: 1,
})

// --------------------------------------------------------------- nama tampil
{
  const andra = anggota('m_andra', 'Andra Pratama', { panggilan: 'Dede' })
  cek('mode lengkap memakai nama lengkap', namaTampil(andra, 'lengkap') === 'Andra Pratama')
  cek('mode panggilan memakai panggilan', namaTampil(andra, 'panggilan') === 'Dede')
  cek('panggilan kosong jatuh ke nama lengkap', namaTampil(anggota('a', 'Bunga'), 'panggilan') === 'Bunga')
  cek('panggilan spasi jatuh ke nama lengkap', namaTampil({ name: 'Bunga', panggilan: '  ' }, 'panggilan') === 'Bunga')
  cek('paket menulis kedua nama', namaDenganPanggilan(andra) === 'Andra Pratama (Dede)')
  cek('tanpa panggilan tidak ada kurung', namaDenganPanggilan(anggota('a', 'Bunga')) === 'Bunga')
  cek('panggilan sama dengan nama tidak diulang', namaDenganPanggilan({ name: 'Dede', panggilan: 'Dede' }) === 'Dede')
  cek('cari menemukan nama lengkap', cocokCari(andra, 'pratama'))
  cek('cari menemukan panggilan', cocokCari(andra, 'dede'))
  cek('cari menemukan kode', cocokCari(andra, 't1'))
  cek('cari kosong menampilkan semua', cocokCari(andra, '   '))
  cek('cari yang tidak ada ditolak', !cocokCari(andra, 'melati'))
  cek('mode tak dikenal di penyimpanan jatuh ke lengkap', bacaModeNama() === 'lengkap')
}

// ---------------------------------------------------------------- kemiripan
{
  cek('nama sama', kemiripanNama('Andra Pratama', 'andra pratama') === 1)
  cek('nama pendek termuat', kemiripanNama('Andra', 'Andra Pratama') >= 0.8)
  cek('panggilan tak mirip nama lengkap', kemiripanNama('Dede', 'Andra Pratama') < 0.45)
}

// ------------------------------------------------------------------ CSV
{
  const judulBaru = ['Kode', 'Nama', 'Panggilan', 'Section', 'Instrumen', 'Peran', 'Tahun Masuk', 'No. HP', 'Status', 'Catatan']
  const judulLama = ['Kode', 'Nama', 'Section', 'Instrumen', 'Peran', 'Tahun Masuk', 'No. HP', 'Status', 'Catatan']
  const sections = [{ id: 'brass', label: 'Brass' }, { id: 'percussion', label: 'Battery' }]
  const baru = bacaBarisCsvAnggota(
    ['T1', 'Andra Pratama', 'Dede', 'Brass', 'Trumpet', 'Ketua Section', '2024', '0812', 'Aktif', 'catatan'],
    judulBaru,
    sections,
  )
  cek('csv baru: panggilan terbaca', baru?.panggilan === 'Dede', JSON.stringify(baru))
  cek('csv baru: section dari label', baru?.section === 'brass')
  cek('csv baru: peran dari label', baru?.role === 'sectionLeader')
  const lama = bacaBarisCsvAnggota(
    ['T2', 'Bunga Lestari', 'Battery', 'Snare', 'Anggota', '2025', '', 'Nonaktif', ''],
    judulLama,
    sections,
  )
  cek('csv lama: section tidak tergeser jadi panggilan', lama?.section === 'percussion' && !lama?.panggilan, JSON.stringify(lama))
  cek('csv lama: nama tetap', lama?.name === 'Bunga Lestari')
  cek('baris tanpa nama ditolak', bacaBarisCsvAnggota(['T3', '', 'Brass'], judulLama, sections) == null)
}

// -------------------------------------------------------------- saran ganda
{
  const andra = anggota('m_andra', 'Andra Pratama', { code: 'T1' })
  const dede = anggota('m_dede', 'Dede', { code: 'T1' })
  const bunga = anggota('m_bunga', 'Bunga', { code: 'T2', section: 'woodwind' })
  const saran = sarankanGanda([andra, dede, bunga], { absensi: ['m_andra'], posisi: ['m_dede'] })
  cek('kode sama disarankan', saran.some((s) => s.a === 'm_andra' && s.b === 'm_dede'))
  cek('alasan menyebut kode dan data pelengkap', saran[0].alasan.includes('kode chart sama') && saran[0].alasan.some((a) => a.includes('absensi')))
  cek('section berbeda tanpa sinyal tidak ikut', !saran.some((s) => s.a === 'm_bunga' || s.b === 'm_bunga'))
  const seksi = sarankanGanda(
    [anggota('a', 'Satu', { code: 'A', section: 'brass' }), anggota('b', 'Dua', { code: 'B', section: 'brass' })],
    { absensi: [], posisi: [] },
  )
  cek('section sama saja tidak disarankan', seksi.length === 0)
  const sudah = sarankanGanda(
    [anggota('a', 'Andra', { alias: ['b'], code: 'T1' }), anggota('b', 'Dede', { code: 'T1' })],
    { absensi: [], posisi: [] },
  )
  cek('yang sudah beralias tidak disarankan lagi', sudah.length === 0)
}

// ------------------------------------------------------- penggabungan penuh
{
  const andra = anggota('m_andra', 'Andra Pratama', { code: 'T1', token: 'qr-andra', phone: '0811' })
  const dede = anggota('m_dede', 'Dede', { code: 'T9', token: 'qr-dede', notes: 'catatan dede' })
  const absensi = [
    { id: 'ab1', sessionId: 's1', memberId: 'm_andra', status: 'hadir' },
    { id: 'ab2', sessionId: 's1', memberId: 'm_dede', status: 'alpha' },
    { id: 'ab3', sessionId: 's2', memberId: 'm_dede', status: 'hadir' },
  ]
  const evaluasi = [
    { id: 'ev1', memberId: 'm_dede', tanggal: '2026-09-01', nilai: { teknik: 3 }, createdAt: 1 },
    { id: 'ev2', memberId: 'm_andra', tanggal: '2026-09-01', nilai: { teknik: 5 }, createdAt: 1 },
    { id: 'ev3', memberId: 'm_dede', tanggal: '2026-09-08', nilai: { kerjasama: 4 }, createdAt: 1 },
  ]
  const catatan = [
    { id: 'n1', memberId: 'm_dede', at: 1, text: 'pribadi dede' },
    { id: 'n2', memberId: 'm_andra', at: 2, text: 'pribadi andra' },
  ]
  const sets = [
    set('st1', 'd1', { m_dede: titik(1, 2), m_andra: titik(9, 9) }, { m_dede: { mode: 'tetap' } }),
    set('st2', 'd2', { m_dede: titik(3, 4) }),
  ]
  const drills = [
    { id: 'd1', name: 'Buka', showTitle: '', field: {}, tempo: 120, beatsPerCount: 1, rosterIds: ['m_dede', 'm_andra'], createdAt: 1, updatedAt: 1 },
    { id: 'd2', name: 'Tutup', showTitle: '', field: {}, tempo: 100, beatsPerCount: 1, rosterIds: ['m_dede'], createdAt: 1, updatedAt: 1 },
  ]
  const riwayat = [{
    id: 'rw1', drillId: 'd1', at: 1, alasan: 'tandai', pin: 1, jumlahSet: 1, jumlahTitik: 1, cicip: 'c',
    isiDrill: { name: 'Buka', showTitle: '', field: {}, tempo: 120, beatsPerCount: 1, rosterIds: ['m_dede'] },
    isiSet: [set('st1', 'd1', { m_dede: titik(1, 2) })],
  }]
  const kemajuan = [{ key: 'd1', centang: { st1: { m_dede: 5, '*': 1 } }, diubah: 1 }]
  const asliTitik = sets[1].points.m_dede
  const rencana = rencanakanGabung({
    simpan: andra, buang: dede, absensi, evaluasi, catatan, sets, drills, riwayat, kemajuan,
  })
  cek('rencana ada', !!rencana)
  cek('nama dibuang jadi panggilan', rencana.simpan.panggilan === 'Dede', rencana.simpan.panggilan)
  cek('id lama jadi alias', (rencana.simpan.alias ?? []).includes('m_dede'))
  cek('token yang dipertahankan tidak berubah', rencana.simpan.token === 'qr-andra')
  cek('catatan profil kosong diisi dari yang dibuang', rencana.simpan.notes === 'catatan dede')
  cek('HP yang sudah ada tidak ditimpa', rencana.simpan.phone === '0811')
  cek('absensi sesi lain dipindah', rencana.absensi.some((a) => a.id === 'ab3' && a.memberId === 'm_andra'))
  cek('bentrok sesi sama: yang dibuang dihapus', rencana.absensiHapus.includes('ab2'), JSON.stringify(rencana.absensiHapus))
  cek('bentrok dilaporkan', rencana.bentrok.some((b) => b.includes('Absensi')))
  cek('evaluasi tanggal lain dipindah', rencana.evaluasi.some((e) => e.id === 'ev3' && e.memberId === 'm_andra'))
  cek('evaluasi tanggal sama: milik yang dibuang dihapus', rencana.evaluasiHapus.includes('ev1'), JSON.stringify(rencana.evaluasiHapus))
  cek('evaluasi yang dipertahankan tidak dihapus', !rencana.evaluasiHapus.includes('ev2'))
  const evSisa = [...evaluasi.filter((e) => !rencana.evaluasiHapus.includes(e.id)), ...rencana.evaluasi]
  const evTanggal = evSisa.find((e) => e.tanggal === '2026-09-01' && e.memberId === 'm_andra')
  cek('evaluasi 1 Sep tetap milik Andra bernilai 5', evTanggal?.nilai?.teknik === 5, JSON.stringify(evSisa))
  cek('catatan pribadi dipindah', rencana.catatan.some((n) => n.id === 'n1' && n.memberId === 'm_andra'))
  cek('titik di dua drill', rencana.jumlah.titik === 2 && rencana.jumlah.drill === 2, JSON.stringify(rencana.jumlah))
  cek('titik bentrok: posisi Andra menang', rencana.sets.find((s) => s.id === 'st1')?.points.m_andra.x === 9)
  cek('titik tak bentrok pindah', rencana.sets.find((s) => s.id === 'st2')?.points.m_andra.x === 3)
  cek('titik Dede tidak tersisa di set yang dipindah', !rencana.sets.find((s) => s.id === 'st2')?.points.m_dede)
  cek('langkah dipindah', rencana.sets.find((s) => s.id === 'st1')?.langkah?.m_andra?.mode === 'tetap')
  cek('roster dua drill', rencana.drills.length === 2)
  cek('roster tidak ganda', rencana.drills.find((d) => d.id === 'd1').rosterIds.filter((id) => id === 'm_andra').length === 1)
  cek('riwayat formasi ikut', rencana.riwayat[0].isiSet[0].points.m_andra && !rencana.riwayat[0].isiSet[0].points.m_dede)
  cek('riwayat roster ikut', rencana.riwayat[0].isiDrill.rosterIds.includes('m_andra') && !rencana.riwayat[0].isiDrill.rosterIds.includes('m_dede'))
  cek('kemajuan yang berkunci id anggota ikut', rencana.kemajuan[0].centang.st1.m_andra === 5 && rencana.kemajuan[0].centang.st1['*'] === 1)
  cek('asli tidak berubah', asliTitik.x === 3 && sets[1].points.m_dede === asliTitik)
  cek('orang yang sama tidak digabung', rencanakanGabung({ simpan: andra, buang: andra, absensi, evaluasi, catatan, sets, drills, riwayat, kemajuan }) == null)
}

// ------------------------------------------------ pencocokan impor diingat
{
  const andra = anggota('m_andra', 'Andra Pratama', { code: 'T1' })
  const dede = anggota('m_dede', 'Dede', { code: 'T1', section: 'brass', instrument: 'Trumpet' })
  const asing = anggota('m_asing', 'Tamu Baru', { code: 'Z9', section: 'guard', instrument: 'Flag' })
  const saran = susunSaran([dede, asing, andra], [andra])
  cek('id sama dikenali otomatis', saran.find((s) => s.masuk.id === 'm_andra')?.otomatis?.lewat === 'id')
  cek('kode sama disarankan', saran.find((s) => s.masuk.id === 'm_dede')?.saran[0]?.idLokal === 'm_andra')
  cek('alasan saran menyebut kode', saran.find((s) => s.masuk.id === 'm_dede')?.saran[0]?.alasan.includes('kode chart sama'))
  // Kode + section + instrumen sama (95) boleh diprapilih — layarnya tetap
  // tampil, dan pelatih bisa mengubahnya. Yang lemah tidak boleh, supaya
  // anggota baru di section yang sama tidak terseret diam-diam.
  cek('kode+section+instrumen boleh diprapilih', keputusanAwal(saran).m_dede.jenis === 'sama')
  const lemah = susunSaran([anggota('m_lemah', 'Tamu Lain', { code: 'Z1', section: 'brass', instrument: 'Trumpet' })], [andra])
  cek('section+instrumen saja tidak diprapilih', keputusanAwal(lemah).m_lemah.jenis === 'baru', JSON.stringify(keputusanAwal(lemah)))
  const namaSama = susunSaran([anggota('m_nama', 'Andra Pratama', { code: 'ZZ', section: 'guard', instrument: 'Flag' })], [andra])
  cek('nama sama diprapilih', keputusanAwal(namaSama).m_nama.jenis === 'sama')
  cek('perlu ditanya bila ada yang asing', perluDitanya(saran, 1))
  cek('perangkat kosong tidak ditanya', !perluDitanya(saran, 0))

  const hasil = terapkanCocok({
    masuk: [dede],
    lokal: [andra],
    keputusan: { m_dede: { jenis: 'sama', idLokal: 'm_andra' } },
    arah: 'lokal',
    tokenBaru: () => 'tok-baru',
  })
  cek('peta berkas ke lokal', hasil.peta.m_dede === 'm_andra')
  cek('nama berkas jadi panggilan', hasil.anggotaTulis[0].panggilan === 'Dede')
  cek('alias mencatat id berkas', hasil.anggotaTulis[0].alias.includes('m_dede'))
  cek('identitas lokal tidak ditimpa', hasil.anggotaTulis[0].name === 'Andra Pratama' && hasil.anggotaTulis[0].token === 't_m_andra')
  const setMasuk = set('st', 'd1', { m_dede: titik(4, 5) })
  const ditulis = tulisUlangSet(setMasuk, hasil.peta)
  cek('posisi drill pindah ke id yang dipilih', ditulis.set.points.m_andra.x === 4 && !ditulis.set.points.m_dede)
  cek('set asli tidak berubah', setMasuk.points.m_dede.x === 4)

  const saran2 = susunSaran([dede], hasil.anggotaTulis)
  cek('impor berikut dikenali lewat alias', saran2[0].otomatis?.lewat === 'alias' && saran2[0].otomatis.idLokal === 'm_andra')
  cek('impor berikut tidak ditanya', !perluDitanya(saran2, 1))
  const hasil2 = terapkanCocok({
    masuk: [dede],
    lokal: hasil.anggotaTulis,
    keputusan: keputusanAwal(saran2),
    arah: 'lokal',
  })
  cek('alias kedua kali tetap memetakan', hasil2.peta.m_dede === 'm_andra' && hasil2.idSudahCocok.includes('m_dede'))
}

// --------------------------------------- pertukaran dua arah, id jadi sama
{
  const andra = anggota('m_andra', 'Andra Pratama', { code: 'T1', token: 'qr-utama' })
  const dede = anggota('m_dede', 'Dede', { code: 'T9', token: 'qr-kedua' })
  const setKedua = set('stB', 'dB', { m_dede: titik(7, 8) }, { m_dede: { mode: 'menyesuaikan', langkahPerCount: 1 } })
  const keUtama = terapkanCocok({
    masuk: [dede],
    lokal: [andra],
    keputusan: { m_dede: { jenis: 'sama', idLokal: 'm_andra' } },
    arah: 'lokal',
  })
  const setDiUtama = tulisUlangSet(setKedua, keUtama.peta).set
  const andraInduk = keUtama.anggotaTulis.find((m) => m.id === 'm_andra')
  const saranBalik = susunSaran([andraInduk], [dede])
  cek('perangkat kedua mengenali alias induk', saranBalik[0].otomatis?.lewat === 'alias')
  const keKedua = terapkanCocok({
    masuk: [andraInduk],
    lokal: [dede],
    keputusan: keputusanAwal(saranBalik),
    arah: 'berkas',
    tokenBaru: () => 'jangan',
  })
  cek('id lokal berganti ke id induk', keKedua.peta.m_dede === 'm_andra', JSON.stringify(keKedua.peta))
  cek('anggota yang ditulis ber-id induk', keKedua.anggotaTulis[0].id === 'm_andra')
  cek('panggilan lokal dipertahankan', keKedua.anggotaTulis[0].panggilan === 'Dede', keKedua.anggotaTulis[0].panggilan)
  cek('token QR lokal tidak diganti', keKedua.anggotaTulis[0].token === 'qr-kedua')
  cek('id lama dihapus', keKedua.anggotaHapus.includes('m_dede'))
  const rencana = rencanakanInduk({
    hasil: keKedua,
    absensi: [{ id: 'ab', sessionId: 's1', memberId: 'm_dede', status: 'hadir' }],
    evaluasi: [],
    catatan: [{ id: 'n', memberId: 'm_dede', at: 1, text: 'catatan kedua' }],
    sets: [setKedua],
    drills: [{ id: 'dB', name: 'Drill kedua', showTitle: '', field: {}, tempo: 120, beatsPerCount: 1, rosterIds: ['m_dede'], createdAt: 1, updatedAt: 1 }],
    riwayat: [],
    kemajuan: [],
  })
  cek('absensi lokal ikut id induk', rencana.absensi[0].memberId === 'm_andra')
  cek('posisi lokal ikut id induk', rencana.sets[0].points.m_andra.x === 7 && !rencana.sets[0].points.m_dede)
  cek('langkah lokal ikut', rencana.sets[0].langkah.m_andra.mode === 'menyesuaikan')
  cek('kedua perangkat ber-id sama', setDiUtama.points.m_andra && rencana.sets[0].points.m_andra && keKedua.anggotaTulis[0].id === 'm_andra')
}

// -------------------------------- paket: jadwal + posisi + nama ganda
{
  const andra = anggota('m_andra', 'Andra Pratama', { code: 'A07', panggilan: 'Dede', token: 'rahasia', phone: '0812', notes: 'rahasia pelatih' })
  const bundle = {
    format: 'drillkit-share',
    version: 1,
    exportedAt: 1,
    team: null,
    members: [andra],
    sessions: [{ id: 's1', title: 'Latihan', type: 'latihan', date: '2026-10-01', startTime: '15:00', endTime: '17:00', checklist: [], createdAt: 1 }],
    drills: [{ id: 'd1', name: 'Buka' }],
    sets: [set('st1', 'd1', { m_andra: titik(2, 3) })],
    songs: [],
    attendance: [{ id: 'ab', sessionId: 's1', memberId: 'm_andra', status: 'hadir' }],
    memberNotes: [],
    mode: 'member',
  }
  const paket = paketAnggota(bundle, 'm_andra')
  cek('paket memuat jadwal', paket.sessions.length === 1 && paket.sessions[0].title === 'Latihan')
  cek('paket memuat posisi drill', paket.sets[0].points.m_andra.x === 2)
  cek('paket menulis Andra Pratama (Dede)', paket.namaPenerima === 'Andra Pratama (Dede)', paket.namaPenerima)
  cek('nama berkas memuat panggilan', namaBerkasAnggota(andra) === 'DrillKit - UNTUK ANGGOTA - Andra Pratama (Dede) A07.json', namaBerkasAnggota(andra))
  cek('tanpa panggilan nama berkas seperti semula', namaBerkasAnggota(anggota('m1', 'Andra Pratama', { code: 'A07' })) === 'DrillKit - UNTUK ANGGOTA - Andra Pratama A07.json')
  cek('telepon tidak ikut paket', paket.members[0].phone == null)
  cek('panggilan ikut paket', paket.members[0].panggilan === 'Dede')
}

// ------------------------------------------------ bentrok absensi saat impor
{
  const lokal = [{ id: 'abL', sessionId: 's1', memberId: 'm_andra', status: 'hadir' }]
  const masuk = [{ id: 'abM', sessionId: 's1', memberId: 'm_andra', status: 'alpha' }]
  const saring = saringBentrokLokal(masuk, lokal)
  cek('absensi lokal menang atas berkas', saring.tulis.length === 0 && saring.bentrok.length === 1)
  const sama = saringBentrokLokal([{ id: 'abL', sessionId: 's1', memberId: 'm_andra', status: 'izin' }], lokal)
  cek('rekaman yang sama boleh diperbarui', sama.tulis.length === 1)
}

// ------------------------------------ backup menimpa id yang sama, show tidak
{
  const lokal = anggota('m_andra', 'Andra Pratama', { token: 'qr-lokal', phone: '0811', panggilan: 'Dede' })
  const berkas = anggota('m_andra', 'Andra Diperbarui', { token: '', phone: '0899', code: 'T1' })
  const lewatPilihan = terapkanCocok({
    masuk: [berkas],
    lokal: [lokal],
    keputusan: { m_andra: { jenis: 'sama', idLokal: 'm_andra' } },
    arah: 'lokal',
    timpaSamaId: true,
  })
  const tulis = lewatPilihan.anggotaTulis[0]
  cek('backup menimpa nama walau pencocokan lewat pilihan', tulis?.name === 'Andra Diperbarui', tulis?.name)
  cek('backup tidak mengosongkan token QR', tulis?.token === 'qr-lokal')
  cek('backup mempertahankan panggilan lokal bila berkas tidak punya', tulis?.panggilan === 'Dede', tulis?.panggilan)
  cek('backup menimpa HP', tulis?.phone === '0899')
  const show = terapkanCocok({
    masuk: [berkas],
    lokal: [lokal],
    keputusan: { m_andra: { jenis: 'sama', idLokal: 'm_andra' } },
    arah: 'lokal',
  })
  cek('show tidak menimpa nama', !show.anggotaTulis.some((m) => m.name === 'Andra Diperbarui'))
  cek('show tidak menulis ulang anggota yang tidak berubah', show.anggotaTulis.length === 0, String(show.anggotaTulis.length))
}

// --------------------------------------- dua baris tidak merebut orang sama
{
  const lokal = [anggota('m_andra', 'Andra Pratama', { code: 'T1' })]
  const a = anggota('m_a', 'Dede', { code: 'T1' })
  const b = anggota('m_b', 'Dede Lain', { code: 'T1' })
  const hasil = terapkanCocok({
    masuk: [a, b],
    lokal,
    keputusan: {
      m_a: { jenis: 'sama', idLokal: 'm_andra' },
      m_b: { jenis: 'sama', idLokal: 'm_andra' },
    },
    arah: 'lokal',
  })
  cek('baris pertama yang menang', hasil.peta.m_a === 'm_andra' && !hasil.peta.m_b)
  cek('baris kedua masuk sebagai anggota baru', hasil.anggotaTulis.some((m) => m.id === 'm_b'))
  cek('perebutan dilaporkan', hasil.laporan.some((l) => l.includes('sudah dipilih baris lain')))
}

// ------------------------------------------------ muatan show tidak bermutasi
{
  const berkas = {
    drill: { id: 'd', name: 'X', showTitle: '', field: {}, tempo: 120, beatsPerCount: 1, rosterIds: ['m_dede'], createdAt: 1, updatedAt: 1 },
    sets: [set('st', 'd', { m_dede: titik(1, 1) })],
    members: [anggota('m_dede', 'Dede')],
  }
  const { data } = tulisUlangMuatan(berkas, { m_dede: 'm_andra' })
  cek('roster show dipetakan', data.drill.rosterIds[0] === 'm_andra')
  cek('berkas asli tidak berubah', berkas.drill.rosterIds[0] === 'm_dede' && berkas.sets[0].points.m_dede)
}

console.log(`${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) {
  for (const g of gagal) console.log('  ✗ ' + g)
  process.exit(1)
}
