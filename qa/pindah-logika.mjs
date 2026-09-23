/**
 * Uji logika murni Pusat Data (impor/ekspor lintas fitur).
 *
 * Yang paling dikuji adalah **aturan longgar**: impor saja semuanya, rujukan
 * yang tidak ketemu dikosongkan dan dilaporkan. Aturan ini mudah salah di
 * dua arah yang berlawanan — terlalu ketat membuang data yang bagus, terlalu
 * longgar membiarkan rujukan rusak tanpa kabar.
 *
 * Satu hal lagi yang mudah luput: fungsinya boleh mengubah salinannya,
 * tetapi **tidak boleh mengubah berkas aslinya**.
 */
import {
  bacaBerkasPindah,
  hitungBentrok,
  putusRujukan,
  ringkasanBerkas,
  ringkasPutus,
  totalBerkas,
} from '/tmp/pindah.mjs'

let lulus = 0
const gagal = []
const cek = (nama, syarat, keterangan = '') => {
  if (syarat) lulus += 1
  else gagal.push(`${nama}${keterangan ? ' — ' + keterangan : ''}`)
}

const kosong = () => ({ format: 'drillkit-data', versi: 1, dibuat: 1 })
const lagu = (id) => ({ id, title: `Lagu ${id}`, bpm: 120, beats: 4, tempoMap: [], createdAt: 1 })
const anggota = (id) => ({
  id, code: id, name: `Anggota ${id}`, section: 'Brass', instrument: 'Trumpet',
  role: 'anggota', joinYear: 2024, active: 1, token: `t_${id}`, createdAt: 1,
})
const setlist = (id, songIds) => ({ id, name: `SL ${id}`, songIds, createdAt: 1, updatedAt: 1 })
const jadwal = (id, setListId) => ({
  id, title: `Sesi ${id}`, type: 'latihan', date: '2026-10-03',
  startTime: '08:00', endTime: '09:00', checklist: [], createdAt: 1, setListId,
})
const absensi = (id, sessionId, memberId) => ({ id, sessionId, memberId, status: 'hadir' })
const catatan = (id, memberId) => ({ id, memberId, at: 1, text: 'catatan' })
const drill = (id, songId) => ({ id, name: `Drill ${id}`, showTitle: 'x', field: {}, tempo: 120, beatsPerCount: 1, rosterIds: [], songId, createdAt: 1, updatedAt: 1 })
const set = (id, drillId) => ({ id, drillId, order: 1, name: `Set ${id}`, counts: 8, points: {}, createdAt: 1 })
const kemajuan = (key) => ({ key, centang: {}, diubah: 1 })
const evaluasi = (id, memberId) => ({ id, memberId, tanggal: '2026-09-01', nilai: { teknik: 4 }, createdAt: 1 })

// ------------------------------------------------------------- ringkasanBerkas
{
  const b = { ...kosong(), lagu: [lagu('a'), lagu('b')], anggota: [anggota('m1')] }
  const r = ringkasanBerkas(b)
  cek('hanya jenis yang tidak kosong', r.length === 2, JSON.stringify(r))
  cek('urutan sesuai URUTAN (anggota sebelum lagu)', r[0].jenis === 'anggota' && r[1].jenis === 'lagu')
  cek('jumlah lagu 2', r[1].jumlah === 2)
  cek('berkas kosong → ringkasan kosong', ringkasanBerkas(kosong()).length === 0)
  cek('total berkas', totalBerkas(b) === 3)
}

// --------------------------------------------------------------- hitungBentrok
{
  const b = { ...kosong(), lagu: [lagu('a'), lagu('b'), lagu('c')] }
  const r = hitungBentrok(b, { lagu: ['b', 'c', 'z'] })
  cek('satu jenis dilaporkan', r.length === 1)
  cek('ditimpa 2 (b & c)', r[0].ditimpa === 2, String(r[0].ditimpa))
  cek('baru 1 (a)', r[0].baru === 1, String(r[0].baru))
  cek('jumlah tetap 3', r[0].jumlah === 3)

  const r2 = hitungBentrok(b, {})
  cek('perangkat kosong → semua baru', r2[0].baru === 3 && r2[0].ditimpa === 0)

  // Bentrokan kemajuan dibandingkan dengan kemajuan yang sudah ada di
  // perangkat — kuncinya id drill, tetapi yang dibandingkan adalah
  // REKAMANnya, bukan drill-nya.
  const r3 = hitungBentrok({ ...kosong(), kemajuan: [kemajuan('d1')] }, { kemajuan: ['d1'] })
  cek('kemajuan dibaca lewat key, bukan id', r3[0].ditimpa === 1, JSON.stringify(r3))
  const r4 = hitungBentrok({ ...kosong(), kemajuan: [kemajuan('d1')] }, { drill: ['d1'] })
  cek('kemajuan tidak bentrok dengan drill', r4[0].ditimpa === 0, JSON.stringify(r4))
}

// ----------------------------------------------- putusRujukan: rujukan sah dari BERKAS
{
  const b = {
    ...kosong(),
    lagu: [lagu('s1')],
    setlist: [setlist('sl1', ['s1'])],
    jadwal: [jadwal('j1', 'sl1')],
  }
  const { berkas, putus } = putusRujukan(b, {})
  cek('rujukan yang ikut di berkas tetap sah', putus.length === 0, JSON.stringify(putus))
  cek('set list tidak dikosongkan', berkas.setlist[0].songIds.length === 1)
  cek('jadwal tidak dikosongkan', berkas.jadwal[0].setListId === 'sl1')
}

// ------------------------------------------- putusRujukan: rujukan sah dari PERANGKAT
{
  const b = { ...kosong(), setlist: [setlist('sl1', ['s1'])], jadwal: [jadwal('j1', 'sl9')] }
  const { berkas, putus } = putusRujukan(b, { lagu: ['s1'], setlist: ['sl9'] })
  cek('rujukan ke data di perangkat tetap sah', putus.length === 0, JSON.stringify(putus))
  cek('lagu yang ada di perangkat tidak dibuang', berkas.setlist[0].songIds.length === 1)
  cek('jadwal menunjuk set list perangkat', berkas.jadwal[0].setListId === 'sl9')
}

// ------------------------------------------------- putusRujukan: rujukan PUTUS
{
  const b = {
    ...kosong(),
    lagu: [lagu('s1')],
    setlist: [setlist('sl1', ['s1', 's_hilang'])],
    jadwal: [jadwal('j1', 'sl_hilang')],
    drill: [drill('d1', 's_hilang')],
  }
  const { berkas, putus } = putusRujukan(b, {})
  // jadwal 1 (sl_hilang) + setlist 1 (s_hilang) + drill 1 (s_hilang) = 3.
  // s1 ikut di berkas, jadi tidak boleh dilaporkan.
  cek('rujukan putus dilaporkan', putus.length === 3, JSON.stringify(putus.map((p) => `${p.jenis}:${p.nilai}`)))
  cek('lagu yang hilang dibuang dari set list', berkas.setlist[0].songIds.length === 1)
  cek('lagu yang ada tetap tinggal', berkas.setlist[0].songIds[0] === 's1')
  cek('setListId yang hilang dikosongkan', berkas.jadwal[0].setListId == null, String(berkas.jadwal[0].setListId))
  cek('songId drill yang hilang dikosongkan', berkas.drill[0].songId == null)
  const teks = ringkasPutus(putus)
  cek('ringkasan putus bisa dibaca', teks.length > 0 && teks.every((t) => t.includes('tidak ketemu')), JSON.stringify(teks))
}

// ------------------------------------------------------- absensi & catatan & set
{
  const b = {
    ...kosong(),
    absensi: [absensi('a1', 'j_hilang', 'm_hilang')],
    catatan: [catatan('n1', 'm_hilang')],
    set: [set('st1', 'd_hilang')],
  }
  const { berkas, putus } = putusRujukan(b, {})
  cek('empat rujukan putus terlapor', putus.length === 4, JSON.stringify(putus.map((p) => p.kolom)))
  cek('sessionId dikosongkan', berkas.absensi[0].sessionId === '')
  cek('memberId dikosongkan', berkas.absensi[0].memberId === '')
  cek('memberId catatan dikosongkan', berkas.catatan[0].memberId === '')
  cek('drillId set dikosongkan', berkas.set[0].drillId === '')
}

// --------------------------------------------------------------- kemajuan dibuang
{
  const b = { ...kosong(), drill: [drill('d1', undefined)], kemajuan: [kemajuan('d1'), kemajuan('d_hilang')] }
  const { berkas, putus } = putusRujukan(b, {})
  cek('kemajuan tanpa drill dibuang', berkas.kemajuan.length === 1, String(berkas.kemajuan.length))
  cek('kemajuan yang sah tinggal', berkas.kemajuan[0].key === 'd1')
  cek('kemajuan yang dibuang dilaporkan', putus.length === 1 && putus[0].jenis === 'kemajuan')
}

// ------------------------------------------------- evaluasi menunjuk anggota
{
  const b = { ...kosong(), anggota: [anggota('m1')], evaluasi: [evaluasi('e1', 'm1'), evaluasi('e2', 'm_hilang')] }
  const { berkas, putus } = putusRujukan(b, {})
  cek('evaluasi dengan anggota yang ikut tetap sah', berkas.evaluasi[0].memberId === 'm1')
  cek('evaluasi tanpa anggotanya dilaporkan', putus.length === 1 && putus[0].jenis === 'evaluasi',
    JSON.stringify(putus))
  cek('memberId-nya dikosongkan', berkas.evaluasi[1].memberId === '')
  cek('kolomnya terbaca "anggota"', putus[0].kolom === 'anggota', putus[0].kolom)
}
{
  // Evaluasi yang merujuk anggota di PERANGKAT juga sah.
  const b = { ...kosong(), evaluasi: [evaluasi('e1', 'm_perangkat')] }
  const { putus } = putusRujukan(b, { anggota: ['m_perangkat'] })
  cek('evaluasi merujuk anggota di perangkat tetap sah', putus.length === 0, JSON.stringify(putus))
}

// --------------------------------------------- berkas ASLI tidak boleh berubah
{
  const b = { ...kosong(), setlist: [setlist('sl1', ['s_hilang'])], jadwal: [jadwal('j1', 'sl_hilang')] }
  const salinanSebelum = JSON.stringify(b)
  putusRujukan(b, {})
  cek('berkas asli tidak berubah', JSON.stringify(b) === salinanSebelum,
    `${salinanSebelum} → ${JSON.stringify(b)}`)
}

// ------------------------------------------------------------ bacaBerkasPindah
{
  const b = { ...kosong(), lagu: [lagu('a')] }
  const ok = bacaBerkasPindah(JSON.stringify(b))
  cek('berkas sah terbaca', ok.ok === true && ok.berkas?.lagu?.length === 1)
  cek('JSON rusak ditolak dengan pesan', bacaBerkasPindah('{ bukan json').ok === false)
  cek('format lain ditolak', bacaBerkasPindah(JSON.stringify({ format: 'drillkit-backup' })).ok === false)
  cek('berkas tanpa data ditolak', bacaBerkasPindah(JSON.stringify(kosong())).ok === false)
  cek('teks kosong ditolak', bacaBerkasPindah('').ok === false)
  const alasan = bacaBerkasPindah('[]')
  cek('pesan penolakan manusIAwi', alasan.ok === false && alasan.alasan.length > 0)
}

console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) {
  console.log('GAGAL:\n - ' + gagal.join('\n - '))
  process.exit(1)
}
