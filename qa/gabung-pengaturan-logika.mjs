/**
 * v2.15.1 — pulihkan backup tidak lagi menghapus program latihan.
 *
 * Yang dijaga:
 *   - pengaturan berkas DIGABUNG ke pengaturan perangkat, bukan menggantinya;
 *   - backup tanpa `programLatihan` (atau dengan daftar kosong) tidak
 *     mengosongkan program di perangkat;
 *   - program, pola sesi, & musim TC digabung per id (sama id → isi berkas,
 *     hanya di perangkat → tetap, hanya di berkas → ditambahkan);
 *   - sambungan perangkat (server kehadiran, Google, Sheet Form, pemutus,
 *     tarik otomatis) tidak diganti berkas, hanya diisi bila belum ada;
 *   - field biasa diambil dari berkas kecuali berkasnya kosong;
 *   - kalimat pratinjau program (jumlah berkas vs perangkat, peringatan);
 *   - penjaga sinkron: program kosong pemilik tidak dikirim tanpa diperiksa.
 *
 * Jalankan: bash qa/bangun-logika.sh && node qa/gabung-pengaturan-logika.mjs
 */
import {
  gabungPengaturan,
  gabungPerId,
  nilaiKosong,
  kalimatProgramPulih,
  FIELD_SAMBUNGAN,
  LABEL_FIELD_PENGATURAN,
} from '/tmp/gabungPengaturan.mjs'
import {
  KUNCI_PROGRAM,
  dataKonfig,
  jumlahProgramServer,
  pesanProgramDitahan,
  petaKerangka,
  programKosongPerluDicek,
  rencanakanKirim,
  sidik,
  tahanKunci,
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

const program = (id, nama = 'Program ' + id) => ({ id, nama, mulai: '2026-11-12', selesai: '2026-12-06', minimalHadir: 7 })

const LOKAL = {
  key: 'team',
  teamName: 'Tim Contoh',
  coachName: 'Pelatih',
  city: 'Yogyakarta',
  defaultField: { lebar: 100 },
  memberMode: 1,
  sections: [{ id: 'sec_a', nama: 'Perkusi' }],
  programLatihan: [program('prog_a'), program('prog_b')],
  polaSesi: [{ id: 'pola_1', nama: 'Weekday', rencana: [], dibuat: 1 }],
  musimTc: [{ id: 'musim_1', nama: 'TC 2026', tanggalH0: '2027-01-30' }],
  kelompokRoster: ['Rekrut 42'],
  serverKehadiran: { url: 'https://abcdefghijklmnopqrst.supabase.co', kunci: 'sb_publishable_x' },
  google: { clientId: 'lokal.apps.googleusercontent.com' },
  sumberForm: { presensi: { id: 'sheet_lokal' } },
  pemutusPutusan: 'Danlat',
  tarikOtomatis: false,
  backupIntervalDays: 3,
}

console.log('== nilai kosong ==')
cek('undefined/null/""/[]/{} kosong', [undefined, null, '', [], {}].every(nilaiKosong))
cek('false, 0, teks, daftar berisi tidak kosong', ![false, 0, 'a', [1], { a: 1 }].some(nilaiKosong))

console.log('== kejadian awal: backup lama tanpa program ==')
const berkasLama = {
  teamName: 'Tim Contoh',
  coachName: 'Pelatih Baru',
  defaultField: { lebar: 120 },
  memberMode: 2,
  sections: [{ id: 'sec_a', nama: 'Perkusi' }, { id: 'sec_b', nama: 'Brass' }],
}
const g1 = gabungPengaturan(LOKAL, berkasLama)
cek('program latihan TIDAK hilang', g1.hasil.programLatihan?.length === 2 && g1.hasil.programLatihan[0].id === 'prog_a')
cek('pola sesi & musim TC tetap', g1.hasil.polaSesi?.length === 1 && g1.hasil.musimTc?.length === 1)
cek('server kehadiran, Google, Sheet Form tetap', g1.hasil.serverKehadiran?.kunci === 'sb_publishable_x' && g1.hasil.google?.clientId === 'lokal.apps.googleusercontent.com' && g1.hasil.sumberForm?.presensi?.id === 'sheet_lokal')
cek('pemutus & tarik otomatis tetap', g1.hasil.pemutusPutusan === 'Danlat' && g1.hasil.tarikOtomatis === false)
cek('kelompok roster & interval backup tetap', g1.hasil.kelompokRoster?.[0] === 'Rekrut 42' && g1.hasil.backupIntervalDays === 3)
cek('field yang dibawa berkas tetap dipulihkan', g1.hasil.coachName === 'Pelatih Baru' && g1.hasil.memberMode === 2 && g1.hasil.defaultField.lebar === 120 && g1.hasil.sections.length === 2)
cek('kota tidak disebut berkas → tetap', g1.hasil.city === 'Yogyakarta')
cek('kunci selalu "team"', g1.hasil.key === 'team')
cek('ringkasan program: 0 berkas, 2 lokal, 2 hasil', g1.program.berkas === 0 && g1.program.lokal === 2 && g1.program.hasil === 2 && g1.program.dipertahankan === 2)
cek('daftar dipertahankan menyebut program & server', g1.dipertahankan.includes('programLatihan') && g1.dipertahankan.includes('serverKehadiran'))
cek('pengaturan lokal tidak diubah (murni)', LOKAL.programLatihan.length === 2 && LOKAL.coachName === 'Pelatih')

console.log('== berkas membawa daftar kosong / teks kosong ==')
const g2 = gabungPengaturan(LOKAL, { ...berkasLama, programLatihan: [], kelompokRoster: [], city: '', pemutusPutusan: '' })
cek('programLatihan: [] tidak mengosongkan', g2.hasil.programLatihan.length === 2)
cek('kelompokRoster: [] tidak mengosongkan', g2.hasil.kelompokRoster.length === 1)
cek('kota "" tidak mengosongkan', g2.hasil.city === 'Yogyakarta')
cek('pemutus "" tidak mengosongkan', g2.hasil.pemutusPutusan === 'Danlat')

console.log('== gabung per id ==')
const versiBerkasA = { ...program('prog_a'), nama: 'Latsar (dari berkas)', minimalHadir: 8 }
const g3 = gabungPengaturan(LOKAL, { ...berkasLama, programLatihan: [versiBerkasA, program('prog_c')] })
cek('sama id → isi berkas', g3.hasil.programLatihan.find((p) => p.id === 'prog_a')?.nama === 'Latsar (dari berkas)')
cek('hanya di perangkat → tetap', g3.hasil.programLatihan.some((p) => p.id === 'prog_b'))
cek('hanya di berkas → ditambahkan', g3.hasil.programLatihan.some((p) => p.id === 'prog_c'))
cek('urutan perangkat dipertahankan, baru di belakang', g3.hasil.programLatihan.map((p) => p.id).join() === 'prog_a,prog_b,prog_c')
cek('ringkasan: 2 berkas, 2 lokal → 3 (1 baru, 1 ditimpa, 1 tetap)', g3.program.berkas === 2 && g3.program.lokal === 2 && g3.program.hasil === 3 && g3.program.baru === 1 && g3.program.ditimpa === 1 && g3.program.dipertahankan === 1)
const gp = gabungPerId([{ id: 'x' }, { nama: 'tanpa id' }], [{ id: 'x', v: 2 }, { id: 'x', v: 3 }, null])
cek('gabungPerId: entri tanpa id & null dibuang, id ganda di berkas tidak dobel', gp.daftar.length === 1 && gp.daftar[0].v === 2)
const gMusim = gabungPengaturan(LOKAL, { musimTc: [{ id: 'musim_2', nama: 'TC 2027', tanggalH0: '2028-01-30' }] })
cek('musim TC digabung per id', gMusim.hasil.musimTc.map((m) => m.id).join() === 'musim_1,musim_2')
const gRusak = gabungPengaturan(LOKAL, { programLatihan: 'rusak' })
cek('program bukan daftar → perangkat tetap', gRusak.hasil.programLatihan.length === 2)

console.log('== sambungan perangkat ==')
const g4 = gabungPengaturan(LOKAL, { serverKehadiran: { url: 'https://zzzzzzzzzzzzzzzzzzzz.supabase.co', kunci: 'sb_publishable_lain' }, tarikOtomatis: true, google: { clientId: 'lain' } })
cek('sambungan yang sudah ada tidak diganti berkas', g4.hasil.serverKehadiran.kunci === 'sb_publishable_x' && g4.hasil.tarikOtomatis === false && g4.hasil.google.clientId === 'lokal.apps.googleusercontent.com')
cek('dan dicatat sebagai dipertahankan', g4.dipertahankan.includes('serverKehadiran') && g4.dipertahankan.includes('google') && g4.dipertahankan.includes('tarikOtomatis'))
const g5 = gabungPengaturan({ key: 'team', teamName: 'Baru' }, { serverKehadiran: { url: 'https://abcdefghijklmnopqrst.supabase.co', kunci: 'k' }, tarikOtomatis: true, programLatihan: [program('prog_a')] })
cek('perangkat baru: sambungan diisi dari berkas', g5.hasil.serverKehadiran?.kunci === 'k' && g5.hasil.tarikOtomatis === true && g5.diisiDariBerkas.includes('serverKehadiran'))
cek('perangkat baru: program dari berkas', g5.hasil.programLatihan.length === 1 && g5.program.lokal === 0 && g5.program.baru === 1)
cek('pengaturan perangkat belum ada (undefined) → aman', gabungPengaturan(undefined, berkasLama).hasil.teamName === 'Tim Contoh')
cek('berkas bukan objek → pengaturan perangkat utuh', gabungPengaturan(LOKAL, null).hasil.programLatihan.length === 2)
cek('5 field sambungan, semua berlabel', FIELD_SAMBUNGAN.length === 5 && FIELD_SAMBUNGAN.every((k) => LABEL_FIELD_PENGATURAN[k]))

console.log('== kalimat pratinjau ==')
const k1 = kalimatProgramPulih(g1.program)
cek('berkas tanpa program: kalimat menenangkan, bukan peringatan', !!k1 && !k1.peringatan && /tidak membawa program/.test(k1.teks) && /2 program/.test(k1.teks))
const k3 = kalimatProgramPulih(g3.program)
cek('ada yang ditimpa: peringatan + angka', !!k3 && k3.peringatan && /2 di berkas, 2 di perangkat ini → 3/.test(k3.teks) && /1 ditimpa/.test(k3.teks))
cek('tanpa program di mana pun: tidak ada kalimat', kalimatProgramPulih({ berkas: 0, lokal: 0, hasil: 0, baru: 0, ditimpa: 0, dipertahankan: 0 }) === null)
const k5 = kalimatProgramPulih(g5.program)
cek('hanya baru: bukan peringatan', !!k5 && !k5.peringatan && /1 baru/.test(k5.teks))

console.log('== penjaga sinkron: program kosong ==')
const sidikKosongProgram = sidik(dataKonfig([]))
const kirimKosong = rencanakanKirim(petaKerangka([], [], [], []), {})
cek('perangkat pemilik baru (belum pernah sinkron) + program kosong → dicek dulu', programKosongPerluDicek(kirimKosong, {}))
const pernahIsi = { [KUNCI_PROGRAM]: sidik(dataKonfig([program('prog_a')])) }
const r2 = rencanakanKirim(petaKerangka([], [], [], undefined), pernahIsi)
cek('program terhapus lokal (dulu berisi) → dicek dulu', programKosongPerluDicek(r2, pernahIsi))
const sudahKosong = { [KUNCI_PROGRAM]: sidikKosongProgram }
cek('server memang sudah kosong → tidak ada kiriman program sama sekali', !rencanakanKirim(petaKerangka([], [], [], []), sudahKosong).kirim.some((k) => k.kunci === KUNCI_PROGRAM))
cek('program berisi → tidak ditahan', !programKosongPerluDicek(rencanakanKirim(petaKerangka([], [], [], [program('prog_b')]), pernahIsi), pernahIsi))
const ditahan = tahanKunci(r2, KUNCI_PROGRAM)
cek('tahanKunci membuang kiriman program saja', !ditahan.kirim.some((k) => k.kunci === KUNCI_PROGRAM) && r2.kirim.some((k) => k.kunci === KUNCI_PROGRAM))
const anggota = { id: 'm1', code: 'A1', name: 'Anggota', section: 'brass', role: 'member', active: 1, token: 't', instrument: '', joinYear: 2026, createdAt: 1 }
const rCampur = rencanakanKirim(petaKerangka([anggota], [], [], []), pernahIsi)
cek('kiriman lain (anggota) tetap jalan saat program ditahan', tahanKunci(rCampur, KUNCI_PROGRAM).kirim.some((k) => k.kunci === 'anggota|m1'))
cek('jumlah program server: baris berisi', jumlahProgramServer({ data: { programLatihan: [program('a'), program('b')] }, dihapus: false }) === 2)
cek('jumlah program server: kosong/dihapus/null/rusak = 0', jumlahProgramServer({ data: { programLatihan: [] } }) === 0 && jumlahProgramServer({ data: { programLatihan: [program('a')] }, dihapus: true }) === 0 && jumlahProgramServer(null) === 0 && jumlahProgramServer({ data: 'x' }) === 0)
cek('pesan ditahan menyebut jumlah & dua pilihan', /3 program/.test(pesanProgramDitahan(3)) && /Ambil dari server/.test(pesanProgramDitahan(3)) && /Kosongkan di server/.test(pesanProgramDitahan(3)))

console.log(`\nRingkasan: ${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) process.exit(1)
