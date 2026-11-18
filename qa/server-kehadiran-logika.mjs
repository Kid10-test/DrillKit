/**
 * v2.14 — Kehadiran bersama: logika murni (tanpa jaringan, tanpa peramban).
 *
 * Yang dijaga:
 *   - peran & haknya (isi / putus / kerangka);
 *   - pengenal server: kunci rahasia (sb_secret_, JWT service_role) ditolak,
 *     kunci publik & alamat proyek diperiksa bentuknya;
 *   - daftar putih field: nomor HP, token QR, catatan, kartu medis, ukuran
 *     seragam, rundown, Pacu TIDAK pernah ikut ke server;
 *   - sidik stabil terhadap urutan field; rencana kirim (berubah, baru, hapus);
 *   - kehadiran hanya untuk sesi/anggota yang dikenal server; id lokal tidak ikut;
 *   - menerapkan tarikan tidak menghapus field lokal (HP, rundown);
 *   - alamat kembali masuk Google (HashRouter) & kalimat galatnya;
 *   - kursor tarik mundur 2 menit.
 *
 * Jalankan: bash qa/bangun-logika.sh && node qa/server-kehadiran-logika.mjs
 */
import {
  LABEL_PERAN,
  KET_PERAN,
  bolehIsi,
  bolehPutus,
  bolehKerangka,
  peranSah,
  kunciRahasia,
  periksaKonfigServer,
  konfigServer,
  refProyek,
  emailSah,
  alamatKembali,
  bacaKembaliOAuth,
  pesanGalatMasuk,
  dataAnggota,
  dataSesi,
  dataKehadiran,
  dataKonfig,
  anggotaUntukServer,
  petaKerangka,
  petaKehadiran,
  kenalDari,
  jsonUrut,
  sidik,
  rencanakanKirim,
  kunciMenyimpang,
  terapkanAnggota,
  terapkanSesi,
  terapkanKehadiran,
  kursorTarik,
  kursorBaru,
  kapanSinkron,
  kunciKehadiran,
  kunciKerangka,
  pecahKunci,
  sidikKosong,
} from '/tmp/kehadiranBersama.mjs'

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

const jwt = (payload) => `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.tanda`

console.log('== peran ==')
cek('4 label peran', Object.values(LABEL_PERAN).join('/') === 'Pemilik/Danlat/Pencatat/PH & asisten')
cek('tiap peran berketerangan', Object.values(KET_PERAN).every((t) => t.length > 20))
cek('isi: pemilik/danlat/pencatat', bolehIsi('pemilik') && bolehIsi('danlat') && bolehIsi('pencatat') && !bolehIsi('pengamat') && !bolehIsi(undefined))
cek('putus: pemilik/danlat saja', bolehPutus('pemilik') && bolehPutus('danlat') && !bolehPutus('pencatat') && !bolehPutus('pengamat'))
cek('kerangka: pemilik saja', bolehKerangka('pemilik') && !bolehKerangka('danlat') && !bolehKerangka(null))
cek('peranSah menolak yang asing', peranSah('danlat') && !peranSah('admin') && !peranSah(3))

console.log('== pengenal server ==')
const URL_OK = 'https://abcdefghijklmnopqrst.supabase.co'
const KUNCI_OK = 'sb_publishable_Contoh0Kunci0Publik0Uji000'
cek('kunci sb_secret_ = rahasia', kunciRahasia('sb_secret_abcdefghijklmnop'))
cek('JWT service_role = rahasia', kunciRahasia(jwt({ role: 'service_role', iss: 'supabase' })))
cek('JWT anon bukan rahasia', !kunciRahasia(jwt({ role: 'anon' })))
cek('publishable bukan rahasia', !kunciRahasia(KUNCI_OK))
cek('konfig benar tanpa masalah', periksaKonfigServer({ url: URL_OK, kunci: KUNCI_OK }).length === 0)
cek('secret key ditolak dengan kata RAHASIA', periksaKonfigServer({ kunci: 'sb_secret_abcdefghijklmnop' }).some((m) => /RAHASIA/.test(m)))
cek('alamat http ditolak', periksaKonfigServer({ url: 'http://x.supabase.co' }).length === 1)
cek('alamat /rest/v1 diperingatkan', periksaKonfigServer({ url: URL_OK + '/rest/v1' }).some((m) => /rest\/v1/.test(m)))
cek('Supabase lokal (http://127.0.0.1:54321) boleh', periksaKonfigServer({ url: 'http://127.0.0.1:54321' }).length === 0 && !!konfigServer({ url: 'http://127.0.0.1:54321', kunci: KUNCI_OK }, {}))
cek('kunci asal-asalan diperingatkan', periksaKonfigServer({ kunci: 'abc' }).some((m) => /sb_publishable_/.test(m)))
cek('konfig dari env build', konfigServer(undefined, { VITE_SUPABASE_URL: URL_OK + '/', VITE_SUPABASE_PUBLISHABLE_KEY: KUNCI_OK })?.url === URL_OK)
cek('pengaturan tim menang atas env', konfigServer({ url: 'https://lain.supabase.co', kunci: KUNCI_OK }, { VITE_SUPABASE_URL: URL_OK, VITE_SUPABASE_PUBLISHABLE_KEY: KUNCI_OK })?.url === 'https://lain.supabase.co')
cek('env berisi secret → tidak dipakai', konfigServer(undefined, { VITE_SUPABASE_URL: URL_OK, VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_abcdefghijk' }) === null)
cek('tanpa kunci → null', konfigServer({ url: URL_OK }, {}) === null)
cek('ref proyek', refProyek(URL_OK) === 'abcdefghijklmnopqrst')

console.log('== email & masuk Google ==')
cek('email dirapikan', emailSah('  Danlat.MBA@Gmail.com ') === 'danlat.mba@gmail.com')
cek('email salah → null', emailSah('danlat@') === null && emailSah('a b@c.id') === null)
cek('alamat kembali tanpa hash/query', alamatKembali({ origin: 'https://drill-kit.vercel.app', pathname: '/' }) === 'https://drill-kit.vercel.app/')
let k = bacaKembaliOAuth('?code=abc-123&state=x')
cek('kode dibaca, query bersih', k.kode === 'abc-123' && k.galat === null && k.sisa === '')
k = bacaKembaliOAuth('?a=1&error=access_denied&error_description=Akses+ditolak')
cek('galat dibaca, query lain dipertahankan', k.kode === null && k.galat === 'Akses ditolak' && k.sisa === '?a=1')
cek('tanpa parameter → kosong', bacaKembaliOAuth('').kode === null && bacaKembaliOAuth('').galat === null)
cek('galat ditolak → sebut test user', /test user/.test(pesanGalatMasuk('access_denied')))
cek('galat provider → arahkan ke Providers', /Providers/.test(pesanGalatMasuk('Unsupported provider: provider is not enabled')))
cek('galat verifier → ulangi dari perangkat sama', /perangkat dan browser yang sama/.test(pesanGalatMasuk('invalid flow state, no valid flow state found / code verifier')))

console.log('== daftar putih field ==')
const M = {
  id: 'm1', code: 'T1', name: 'Anggota Satu', panggilan: 'Satu', alias: ['lama1'], section: 'percussion', instrument: 'Snare', role: 'member', joinYear: 2026, active: 1,
  phone: '0812xxxx', notes: 'catatan pribadi', token: 't_rahasia', createdAt: 1, ukuranSeragam: { baju: 'M' }, instansiAsal: 'SMA X', nomorInduk: '123', tags: ['CAB 42'],
}
const dA = dataAnggota(M)
cek('anggota: field kehadiran ikut', dA.id === 'm1' && dA.name === 'Anggota Satu' && dA.panggilan === 'Satu' && dA.section === 'percussion' && dA.active === 1 && dA.code === 'T1')
cek('anggota: HP/token/catatan/seragam/instansi/NIS tidak ikut', !['phone', 'notes', 'token', 'createdAt', 'ukuranSeragam', 'instansiAsal', 'nomorInduk', 'tags'].some((f) => f in dA))
cek('anggota: field kosong dibuang', !('panggilan' in dataAnggota({ ...M, panggilan: '' })) && !('alias' in dataAnggota({ ...M, alias: [] })))
const S = {
  id: 's1', title: 'P4', type: 'latihan', date: '2026-11-19', startTime: '17:30', endTime: '20:15', place: 'Lapangan', notes: 'catatan staf', checklist: [{ id: 'c', text: 'x', done: 0 }], createdAt: 1,
  rencanaLatihan: [{ id: 'b', judul: 'Apel', menit: 10 }], jejakPacu: [{}], rundownDrive: { id: 'd' }, formPresensi: { m1: 5 }, formKeterangan: { m1: { status: 'telat', capWaktu: 1 } },
}
const dS = dataSesi(S)
cek('sesi: jadwal + isian Form ikut', dS.title === 'P4' && dS.startTime === '17:30' && dS.formPresensi.m1 === 5 && dS.formKeterangan.m1.status === 'telat')
cek('sesi: rundown/Pacu/catatan/ceklis tidak ikut', !['notes', 'checklist', 'createdAt', 'rencanaLatihan', 'jejakPacu', 'rundownDrive'].some((f) => f in dS))
cek('sesi: formPresensi kosong dibuang', !('formPresensi' in dataSesi({ ...S, formPresensi: {} })))
const R = { id: 'a_lokal', sessionId: 's1', memberId: 'm1', status: 'izin', kategoriIzin: 'kuliah', bukti: 'https://drive/x', note: '', putusanIzin: 'sah', putusanOleh: 'Danlat', dilaporAt: 9 }
const dR = dataKehadiran(R)
cek('kehadiran: tanpa id lokal & field kosong', !('id' in dR) && !('note' in dR) && dR.putusanIzin === 'sah' && dR.sessionId === 's1')
cek('konfig program', dataKonfig(undefined).programLatihan.length === 0 && dataKonfig([{ id: 'p' }]).programLatihan[0].id === 'p')

console.log('== pilihan anggota & peta ==')
const alumni = { ...M, id: 'm2', active: 0 }
const alumniTercatat = { ...M, id: 'm3', active: 0 }
const pilih = anggotaUntukServer([M, alumni, alumniTercatat], [{ ...R, memberId: 'm3' }])
cek('aktif + yang punya catatan; alumni tanpa catatan tidak', pilih.map((m) => m.id).join() === 'm1,m3')
const pk = petaKerangka([M, alumni], [S], [], [])
cek('peta kerangka: 1 anggota + 1 sesi + konfig', pk.size === 3 && pk.has('anggota|m1') && pk.has('sesi|s1') && pk.has('konfig|program') && !pk.has('anggota|m2'))
const kenal = kenalDari({ 'anggota|m1': 'x', 'sesi|s1': 'y', 'konfig|program': 'z' })
cek('kenalDari', kenal.sesi.has('s1') && kenal.anggota.has('m1') && kenal.anggota.size === 1)
const ph = petaKehadiran([R, { ...R, id: 'dup', status: 'hadir' }, { ...R, id: 'r2', sessionId: 'demo' }, { ...R, id: 'r3', memberId: 'asing' }], kenal)
cek('peta kehadiran: sesi/anggota tak dikenal disaring, duplikat → pertama', ph.size === 1 && ph.get('s1|m1').status === 'izin')
cek('kunci', kunciKehadiran('s1', 'm1') === 's1|m1' && kunciKerangka('sesi', 'a|b') === 'sesi|a|b' && pecahKunci('sesi|a|b').join('/') === 'sesi/a|b')

console.log('== sidik & rencana ==')
cek('jsonUrut tidak peduli urutan', jsonUrut({ b: 1, a: [2, { d: 1, c: 2 }] }) === jsonUrut({ a: [2, { c: 2, d: 1 }], b: 1 }))
cek('undefined diabaikan', jsonUrut({ a: 1, b: undefined }) === jsonUrut({ a: 1 }))
cek('sidik sama untuk isi sama', sidik({ x: 1, y: 'ä' }) === sidik({ y: 'ä', x: 1 }))
cek('sidik beda untuk isi beda', sidik({ s: 'hadir' }) !== sidik({ s: 'izin' }) && sidik('ab') !== sidik('ba'))
const lokal = new Map([
  ['a', { v: 1 }],
  ['b', { v: 2 }],
  ['c', { v: 3 }],
])
const r = rencanakanKirim(lokal, { a: sidik({ v: 1 }), b: sidik({ v: 9 }), z: 'lama' })
cek('rencana: b berubah, c baru, z dihapus', r.kirim.map((x) => x.kunci).join() === 'b,c' && r.hapus.join() === 'z')
cek('rencana kosong bila sama', rencanakanKirim(new Map([['a', { v: 1 }]]), { a: sidik({ v: 1 }) }).kirim.length === 0)
cek('menyimpang: berubah + hilang', kunciMenyimpang(lokal, { a: sidik({ v: 1 }), b: 'beda', z: 'x' }).join() === 'b,z')
cek('sidik kosong', sidikKosong('t').timId === 't' && Object.keys(sidikKosong().kehadiran).length === 0)

console.log('== terapkan tarikan ==')
const lokalM = { ...M, name: 'Nama Lama', phone: '0812' }
const baruM = terapkanAnggota(lokalM, { ...dA, name: 'Nama Baru', panggilan: undefined }, () => 'tok', 5)
cek('anggota: nama diganti, HP & token lokal tetap', baruM.name === 'Nama Baru' && baruM.phone === '0812' && baruM.token === 't_rahasia')
cek('anggota: panggilan yang dihapus server ikut hilang', !('panggilan' in baruM))
const segar = terapkanAnggota(undefined, { id: 'm9', name: 'Baru', section: 'brass', role: 'member', active: 1 }, () => 't_baru', Date.UTC(2026, 10, 18))
cek('anggota baru: token baru, field wajib terisi', segar.token === 't_baru' && segar.instrument === '' && segar.code === '' && segar.joinYear === 2026 && segar.createdAt > 0)
const baruS = terapkanSesi(S, { ...dS, startTime: '18:00', formPresensi: undefined }, 7)
cek('sesi: jam diganti, rundown & Pacu lokal tetap', baruS.startTime === '18:00' && baruS.rencanaLatihan.length === 1 && baruS.jejakPacu.length === 1 && !('formPresensi' in baruS))
const segarS = terapkanSesi(undefined, dS, 7)
cek('sesi baru: ceklis kosong', Array.isArray(segarS.checklist) && segarS.checklist.length === 0 && segarS.createdAt === 7)
const kh = terapkanKehadiran({ ...R, id: 'lokal-1' }, { ...dR, status: 'hadir', id: 'id-perangkat-lain' }, 's1', 'm1', () => 'baru')
cek('kehadiran: id lokal dipertahankan', kh.id === 'lokal-1' && kh.status === 'hadir' && kh.sessionId === 's1')
cek('kehadiran baru: id dibuat', terapkanKehadiran(undefined, dR, 's1', 'm1', () => 'a_baru').id === 'a_baru')
cek('setelah diterapkan, sidik sama dengan server', sidik(dataKehadiran(kh)) === sidik({ ...dR, status: 'hadir' }))

console.log('== kursor & waktu ==')
cek('kursor kosong → awal zaman', kursorTarik(null) === '1970-01-01T00:00:00Z')
cek('kursor mundur 2 menit', kursorTarik('2026-11-18T10:00:00.000Z') === '2026-11-18T09:58:00.000Z')
cek('kursor baru = terbesar', kursorBaru('2026-11-18T10:00:00Z', [{ diubah_at: '2026-11-18T09:00:00Z' }, { diubah_at: '2026-11-18T11:00:00.5Z' }]) === '2026-11-18T11:00:00.5Z')
cek('kursor tetap bila tak ada baris', kursorBaru('2026-11-18T10:00:00Z', []) === '2026-11-18T10:00:00Z')
const kini = Date.UTC(2026, 10, 18, 12)
cek('kapan sinkron', kapanSinkron(undefined, kini) === 'belum pernah' && kapanSinkron(kini - 5000, kini) === 'baru saja' && kapanSinkron(kini - 5 * 60_000, kini) === '5 menit lalu' && kapanSinkron(kini - 26 * 3_600_000, kini) === 'kemarin')

console.log(`\nRingkasan: ${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) process.exit(1)
