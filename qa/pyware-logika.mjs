/**
 * #10 — Impor drill Pyware: uji logika.
 *
 * Yang diuji di sini adalah aturan impornya, bukan layarnya: pengurai lembar
 * koordinat, konversi satuan, pratinjau (termasuk titik di luar lapangan),
 * interpolasi antar set, pencocokan anggota yang **diingat**, dan penulisan
 * ke basis data yang selalu bisa dibatalkan.
 *
 * Lima asersi yang paling menentukan, diambil dari rencana #10:
 *   1. CSV 3 set × 20 pemain masuk **utuh** — 60 titik, tidak kurang satu pun.
 *   2. Konversi meter↔yard **tepat** (bukan "kira-kira 1,09").
 *   3. Pemain yang tidak dikenal dicocokkan sendiri lalu **diingat** — impor
 *      kedua langsung cocok tanpa ditanya.
 *   4. Titik di luar `fieldBox` **diperingatkan sebelum ditulis**, bukan
 *      sesudah formasi berantakan.
 *   5. Undo (Riwayat) **menghapus hasil impor**.
 *
 * Pakai: bash qa/bangun-logika.sh && node qa/pyware-logika.mjs
 */
import 'fake-indexeddb/auto'
import { db } from '/tmp/dbk.mjs'
import { daftar, foto, pulihkan } from '/tmp/riwayat.mjs'
import { susunSaran, terapkanCocok } from '/tmp/namaAnggota.mjs'
import {
  AWALAN_ID_PYWARE,
  KAKI_KE_M,
  deteksiPyware,
  faktorKeYard,
  idPyware,
  isiCelahLinear,
  angkaPyware,
  pemainKeAnggota,
  rapikanJudul,
  rentangHitungan,
  ringkasPyware,
  saranAsalY,
  saranPemetaanPyware,
  susunSetPyware,
  tebakAsalY,
  tebakSatuan,
  titikLuarKotak,
  uraiPyware,
} from '/tmp/pyware.mjs'
import { tulisImporPyware } from '/tmp/pywareTulis.mjs'
import { simpanAnggota } from '/tmp/simpanAnggota.mjs'
import { M_TO_YD } from '/tmp/lapangan.mjs'

let lulus = 0
const gagal = []
const cek = (nama, syarat, keterangan = '') => {
  if (syarat) lulus += 1
  else gagal.push(`${nama}${keterangan ? ' — ' + keterangan : ''}`)
}
const dekat = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol

/* ------------------------------- Perkakas -------------------------------- */

/** Lapangan DCI: 100 + 2×10 yard panjang, 53,3333 yard lebar. */
const FIELD = {
  widthYd: 53.3333,
  lengthYd: 100,
  endZoneYd: 10,
  hash: 'nfhs',
  gridYd: 5,
  step: '8to5',
  customStepYd: 0.625,
  showLabels: 1,
}
const S_YD = 0.625
const OPSI = { sYd: S_YD, lebarYd: FIELD.widthYd }

const KODE = [
  ...Array.from({ length: 8 }, (_, i) => `T${i + 1}`),
  ...Array.from({ length: 4 }, (_, i) => `B${i + 1}`),
  ...Array.from({ length: 4 }, (_, i) => `G${i + 1}`),
  ...Array.from({ length: 4 }, (_, i) => `P${i + 1}`),
]

/** Lembar koordinat gaya Pyware: 3 set × 20 pemain, dalam langkah. */
function lembarPyware({ judulSet = 'Set', count = [1, 9, 25], x = -12, y = 20 } = {}) {
  const baris = [`${judulSet},Count,Performer,Instrument,X (Sidelong),Y (Depth)`]
  for (let s = 0; s < 3; s++) {
    KODE.forEach((k, i) => {
      const xs = x + i + s * 2
      const ys = y - s
      baris.push(`${s + 1},${count[s]},${k},${k[0] === 'T' ? 'Trumpet' : 'Battery'},${xs},${ys}`)
    })
  }
  return baris.join('\n')
}

/* ------------------------------------------------------- 1. deteksi berkas */
{
  const pyware = deteksiPyware(lembarPyware())
  cek('lembar Pyware terdeteksi', pyware.ya, JSON.stringify(pyware.alasan))
  cek('deteksi menyebut penandanya', pyware.alasan.some((a) => /sidelong|depth|count|performer/.test(a)))

  // Lembar koordinat ekspor DrillKit sendiri TIDAK boleh dibajak ke sini:
  // pintu DD7 (Tukar CSV) yang harus menerimanya.
  const eksporSendiri = 'Set,Kode,Nama,Section,Instrumen,X (steps),Y (steps),Koordinat\n1,T1,Andra,Brass,Trumpet,-8,20,B#4'
  cek('lembar ekspor DrillKit tidak dianggap Pyware', deteksiPyware(eksporSendiri).ya === false)

  const csvAnggota = 'Kode,Nama,Panggilan,Section,Instrumen,Peran,Tahun Masuk\nT1,Andra,Dede,Brass,Trumpet,member,2024'
  cek('CSV anggota tidak dianggap Pyware', deteksiPyware(csvAnggota).ya === false)
}

/* --------------------------------------------------- 2. judul kolom & angka */
{
  const p = saranPemetaanPyware(['Set', 'Count', 'Performer', 'Instrument', 'X (Sidelong)', 'Y (Depth)'])
  cek('kolom set dikenali', p.set === 0)
  cek('kolom count dikenali', p.count === 1)
  cek('kolom nama pemain dikenali', p.nama === 2)
  cek('kolom instrumen dikenali', p.instrumen === 3)
  cek('kolom X dikenali', p.x === 4)
  cek('kolom Y dikenali', p.y === 5)

  const p2 = saranPemetaanPyware(['Page', 'Transition Counts', 'Member', 'X', 'Y', 'Z', 'Direction'])
  cek('judul gaya lain: set = Page', p2.set === 0)
  cek('judul gaya lain: count = Transition Counts', p2.count === 1)
  cek('judul gaya lain: nama = Member', p2.nama === 2)
  cek('judul gaya lain: Z tidak direbut Y', p2.z === 5 && p2.y === 4)
  cek('judul gaya lain: arah tidak direbut X', p2.arah === 6)

  cek('angka polos', angkaPyware('-12') === -12)
  cek('angka desimal koma', dekat(angkaPyware('12,5') ?? 0, 12.5))
  cek('pecahan campuran', dekat(angkaPyware('4 1/2') ?? 0, 4.5))
  cek('pecahan biasa', dekat(angkaPyware('1/2') ?? 0, 0.5))
  cek('minus unicode Excel', angkaPyware('\u221212') === -12)
  cek('angka + satuan teks', angkaPyware('8 counts') === 8)
  cek('sel kosong bukan nol', angkaPyware('') === null)
  cek('teks tanpa angka bukan nol', angkaPyware('n/a') === null)
}

/* ------------------------- 2b. judul kolom yang terpecah koma ------------ */
{
  cek('judul terpecah disambung lagi',
    JSON.stringify(rapikanJudul(['Set', 'X (Sidelong', ' meters)', 'Y (Depth)'])) ===
      JSON.stringify(['Set', 'X (Sidelong, meters)', 'Y (Depth)']))
  cek('judul yang utuh tidak diubah',
    JSON.stringify(rapikanJudul(['Set', 'X', 'Y'])) === JSON.stringify(['Set', 'X', 'Y']))

  // Berkas yang koma di dalam kurungnya TIDAK dikutip: tanpa penyambungan,
  // kolom X bergeser dan angka yang terbaca salah tanpa pesan apa pun.
  const csvRusak = [
    'Set,Count,Performer,X (Sidelong, meters),Y (Depth, meters)',
    '1,1,T1,-10,10',
    '2,9,T1,-5,8',
  ].join('\n')
  const hr = uraiPyware(csvRusak, OPSI)
  cek('judul terpecah tetap terbaca sebagai pyware', hr.bentuk === 'pyware', hr.bentuk)
  cek('judul terpecah: satuan meter dikenali', hr.satuan === 'meter', hr.satuan)
  cek('judul terpecah: X tidak bergeser', dekat(hr.pemain[0].pos[0].x, -10 * M_TO_YD, 1e-9),
    String(hr.pemain[0].pos[0].x))
}

/* -------------------------------------------- 3. 3 set × 20 pemain utuh (#10) */
const h = uraiPyware(lembarPyware(), OPSI)
{
  cek('bentuk pyware', h.bentuk === 'pyware')
  cek('3 set terbaca', h.set.length === 3, String(h.set.length))
  cek('20 pemain terbaca', h.pemain.length === 20, String(h.pemain.length))
  cek('tidak ada baris dilewati', h.dilewati === 0, String(h.dilewati))

  const r = ringkasPyware(h, FIELD)
  cek('60 titik utuh (3 set × 20 pemain)', r.jumlahTitik === 60, String(r.jumlahTitik))
  cek('tidak ada interpolasi bila semua set terisi', r.interpolasi === 0)

  // Set 1: pemain pertama X = -12 langkah = -7,5 yard; Y = 20 langkah dari
  // garis depan = 12,5 − 26,66665 yard.
  const t1 = h.pemain[0].pos[0]
  cek('X langkah → yard', dekat(t1.x, -12 * S_YD), String(t1.x))
  cek('Y dari garis depan → yard internal', dekat(t1.y, 20 * S_YD - FIELD.widthYd / 2), String(t1.y))
  // Set 2 bergeser +2 langkah di X.
  cek('posisi set 2 ikut bergeser', dekat(h.pemain[0].pos[1].x, -10 * S_YD), String(h.pemain[0].pos[1].x))
  cek('set terakhir punya titik', h.pemain[19].pos[2] !== null)
}

/* ------------------------------------------------------- 4. konversi satuan */
{
  cek('faktor langkah', dekat(faktorKeYard('langkah', S_YD), S_YD))
  cek('faktor yard = 1', faktorKeYard('yard', S_YD) === 1)
  cek('faktor meter = M_TO_YD', dekat(faktorKeYard('meter', S_YD), M_TO_YD))
  cek('faktor kaki = 0,3048 m', dekat(faktorKeYard('kaki', S_YD), KAKI_KE_M * M_TO_YD))

  // Meter: judul kolom menyebut satuannya, jadi tidak perlu ditanya.
  // Judul kolom berkoma harus dikutip — itu yang ditulis Excel. Baris ini
  // sekaligus menguji bahwa pengurai menghormati tanda kutip.
  const csvM = [
    'Set,Count,Performer,"X (Sidelong, meters)","Y (Depth, meters)"',
    '1,1,T1,-10,10',
    '2,9,T1,-5,8',
  ].join('\n')
  const hm = uraiPyware(csvM, OPSI)
  cek('satuan meter terbaca dari judul', hm.satuan === 'meter' && hm.satuanTebak === false)
  cek('10 m = 10 × M_TO_YD yard (tepat)', dekat(hm.pemain[0].pos[0].x, -10 * M_TO_YD, 1e-9), String(hm.pemain[0].pos[0].x))
  cek('meter→yard bolak-balik 100 m', dekat((100 * M_TO_YD) / M_TO_YD, 100, 1e-9))

  const csvYd = 'Set,Count,Performer,X (yd),Y (yd)\n1,1,T1,-8,12\n2,9,T1,-4,10'
  const hy = uraiPyware(csvYd, OPSI)
  cek('satuan yard terbaca', hy.satuan === 'yard')
  cek('yard tidak dikali lagi', dekat(hy.pemain[0].pos[0].x, -8))

  const csvKaki = 'Set,Count,Performer,X (feet),Y (feet)\n1,1,T1,3,6\n2,9,T1,0,0'
  const hk = uraiPyware(csvKaki, OPSI)
  cek('3 kaki ≈ 1 yard', dekat(hk.pemain[0].pos[0].x, 1, 1e-4), String(hk.pemain[0].pos[0].x))

  // Tanpa petunjuk satuan: dianggap langkah, tetapi DIKATAKAN, bukan didiamkan.
  const csvPolos = 'Set,Count,Performer,X,Y\n1,1,T1,-8,20\n2,9,T1,-4,18'
  const hp = uraiPyware(csvPolos, OPSI)
  cek('tanpa petunjuk → langkah', hp.satuan === 'langkah' && hp.satuanTebak === true)
  cek('tebakan satuan disebut di catatan', hp.catatan.some((c) => /satuan/i.test(c)))
  // Pilihan pelatih menang atas tebakan.
  const hpYard = uraiPyware(csvPolos, { ...OPSI, satuan: 'yard' })
  cek('pilihan satuan menang atas tebakan', dekat(hpYard.pemain[0].pos[0].x, -8))

  // Kolom satuan terpisah ("Units").
  const csvUnit = 'Set,Count,Performer,X,Y,Units\n1,1,T1,-8,20,meters\n2,9,T1,-4,18,meters'
  const hu = uraiPyware(csvUnit, OPSI)
  cek('kolom Units dibaca', hu.satuan === 'meter', hu.satuan)
}

/* ----------------------------------------------------- 5. asal pengukuran Y */
{
  cek('tebak Y: from center', tebakAsalY(['Y (Depth from center)']).asalY === 'tengah')
  cek('tebak Y: front sideline', tebakAsalY(['Y (Depth from front sideline)']).asalY === 'garis-depan')
  cek('tebak Y: from back', tebakAsalY(['Y (Depth from back)']).asalY === 'garis-belakang')
  cek('tebak Y tanpa petunjuk tidak yakin', tebakAsalY(['Y']).yakin === false)

  const csv = 'Set,Count,Performer,X,Y\n1,1,T1,0,0\n2,9,T1,0,0'
  const tengah = uraiPyware(csv, { ...OPSI, asalY: 'tengah' })
  const depan = uraiPyware(csv, { ...OPSI, asalY: 'garis-depan' })
  const belakang = uraiPyware(csv, { ...OPSI, asalY: 'garis-belakang' })
  cek('Y=0 dari tengah = garis tengah', dekat(tengah.pemain[0].pos[0].y, 0))
  cek('Y=0 dari depan = garis depan', dekat(depan.pemain[0].pos[0].y, -FIELD.widthYd / 2))
  cek('Y=0 dari belakang = garis belakang', dekat(belakang.pemain[0].pos[0].y, FIELD.widthYd / 2))
}

/* ------------------------------------------- 6. kolom Count → panjang set */
{
  const mutlak = uraiPyware(lembarPyware({ count: [1, 9, 25] }), OPSI)
  cek('count naik dibaca sebagai mutlak', mutlak.artiCount === 'mutlak')
  const r1 = rentangHitungan(mutlak.set, 'mutlak')
  cek('rentang hitungan 1–25', r1.min === 1 && r1.max === 25, JSON.stringify(r1))
  const susun1 = susunSetPyware(mutlak)
  cek('set 1: 8 hitungan ke set 2', susun1.set[0].counts === 8, String(susun1.set[0].counts))
  cek('set 2: 16 hitungan ke set 3', susun1.set[1].counts === 16, String(susun1.set[1].counts))

  const transisi = uraiPyware(lembarPyware({ count: [8, 16, 8] }), OPSI)
  cek('count berulang dibaca sebagai transisi', transisi.artiCount === 'transisi', transisi.artiCount)
  const susun2 = susunSetPyware(transisi)
  cek('transisi: counts dipakai apa adanya', susun2.set[0].counts === 8 && susun2.set[1].counts === 16)

  // Set terakhir tidak boleh 0 hitungan (0 = set diam) kecuali memang begitu.
  cek('set terakhir punya counts bawaan', susun1.set[2].counts === 16, String(susun1.set[2].counts))
  const susun3 = susunSetPyware(mutlak, { countsBawaan: 32 })
  cek('counts bawaan dihormati', susun3.set[2].counts === 32)
}

/* ------------------------------------------------------- 7. interpolasi */
{
  // T1 tidak punya baris di set 2 (di Pyware ia tetap berjalan di antaranya).
  const csv = [
    'Set,Count,Performer,X (Sidelong),Y (Depth)',
    '1,1,T1,0,0',
    '1,1,T2,8,8',
    '2,9,T2,10,10',
    '3,17,T1,16,16',
    '3,17,T2,8,8',
  ].join('\n')
  const h2 = uraiPyware(csv, OPSI)
  cek('3 set terbaca walau satu pemain bolong', h2.set.length === 3, String(h2.set.length))
  cek('set tengah kosong sebelum interpolasi', h2.pemain[0].pos[1] === null)
  const { pemain: isi, interpolasi } = isiCelahLinear(h2.pemain, h2.set)
  cek('satu titik diisi', interpolasi === 1, String(interpolasi))
  // Titik tengahnya dihitung dengan konvensi yang sama: X 0 → 16 langkah
  // (0 → 10 yard), Y 0 → 16 langkah dari garis depan (−26,667 → −16,667 yard).
  const ySet1 = 0 * S_YD - FIELD.widthYd / 2
  const ySet3 = 16 * S_YD - FIELD.widthYd / 2
  cek('interpolasi tepat di tengah (X)', dekat(isi[0].pos[1].x, 8 * S_YD), String(isi[0].pos[1].x))
  cek('interpolasi tepat di tengah (Y)', dekat(isi[0].pos[1].y, (ySet1 + ySet3) / 2),
    JSON.stringify(isi[0].pos[1]))
  cek('pemain yang tidak berpindah tetap di tempatnya', dekat(isi[1].pos[1].x, 10 * S_YD))

  // Ujung yang kosong TIDAK diisi: pemain yang belum masuk formasi tidak
  // tiba-tiba muncul di tengah lapangan.
  const csv2 = [
    'Set,Count,Performer,X,Y',
    '2,9,T1,8,8',
    '3,17,T1,16,16',
  ].join('\n')
  const h3 = uraiPyware(csv2, OPSI)
  const { interpolasi: i3 } = isiCelahLinear(h3.pemain, h3.set)
  cek('set sebelum pemain muncul tidak diisi', i3 === 0)

  // Bobot mengikuti hitungan: set yang lebih panjang mendapat bagian lebih
  // besar. T1 berpindah 0 → 24 langkah dalam 24 hitungan (8 lalu 16), jadi di
  // hitungan ke-8 ia baru menempuh sepertiganya = 8 langkah. Tanpa bobot
  // hasilnya 12 langkah — persis kesalahan yang diuji di sini.
  const csv3 = [
    'Set,Count,Performer,X,Y',
    '1,1,T1,0,0',
    '2,9,T2,0,0',
    '3,25,T1,24,0',
    '3,25,T2,0,0',
  ].join('\n')
  const h4 = uraiPyware(csv3, OPSI)
  const { pemain: isi4 } = isiCelahLinear(h4.pemain, h4.set)
  cek('bobot interpolasi mengikuti hitungan', dekat(isi4[0].pos[1].x, 8 * S_YD),
    String(isi4[0].pos[1]?.x))

  // Sel yang kosong bukan titik (0,0), tetapi setnya TIDAK hilang: pemainnya
  // tetap terdaftar di set itu dengan posisi `null`, dan celahnya bisa diisi.
  const csv4 = ['Set,Count,Performer,X,Y', '1,1,T1,,', '2,9,T1,8,8'].join('\n')
  const h5a = uraiPyware(csv4, OPSI)
  cek('baris tanpa koordinat dihitung sebagai kosong', h5a.kosong === 1, String(h5a.kosong))
  cek('baris tanpa koordinat tidak dianggap dilewati', h5a.dilewati === 0)
  cek('setnya tetap ada walau barisnya kosong', h5a.set.length === 2, String(h5a.set.length))
  cek('posisi kosong bukan titik nol', h5a.pemain[0].pos[0] === null)
  cek('baris tanpa identitas tetap dilewati',
    uraiPyware('Set,Count,Performer,X,Y\n,,,', OPSI).dilewati === 1)
}

/* ------------------------------------- 8. titik di luar lapangan & saran Y */
{
  // 200 langkah = 125 yard ke samping: jelas keluar lapangan (maks 60 yard).
  const csv = [
    'Set,Count,Performer,X (Sidelong),Y (Depth)',
    '1,1,T1,200,20',
    '2,9,T1,210,20',
  ].join('\n')
  const h5 = uraiPyware(csv, OPSI)
  const r5 = ringkasPyware(h5, FIELD)
  cek('titik di luar lapangan terhitung', r5.diLuarJumlah === 2, String(r5.diLuarJumlah))
  cek('sumbu yang keluar disebut', r5.diLuar[0].sumbu === 'x', r5.diLuar[0]?.sumbu)
  cek('nama set ikut dilaporkan', r5.diLuar[0].namaSet === '1')
  cek('titikLuarKotak: di dalam = null', titikLuarKotak({ x: 0, y: 0 }, FIELD) === null)
  cek('titikLuarKotak: melewati ujung = x', titikLuarKotak({ x: 70, y: 0 }, FIELD) === 'x')
  cek('titikLuarKotak: melewati tepi = y', titikLuarKotak({ x: 0, y: 40 }, FIELD) === 'y')

  // Berkas yang Y-nya ternyata dari tengah: pratinjau harus MENYARANKAN
  // pilihan lain, bukan membiarkan pelatih menebak.
  // Y negatif = di depan garis tengah. Dibaca "dari garis depan" nilainya
  // keluar lapangan; dibaca "dari tengah" semuanya sah.
  const csvTengah = [
    'Set,Count,Performer,X,Y',
    '1,1,T1,0,-20',
    '1,1,T2,0,-10',
    '2,9,T1,0,-18',
    '2,9,T2,0,-8',
  ].join('\n')
  const h6 = uraiPyware(csvTengah, { ...OPSI, asalY: 'garis-depan' })
  const r6 = ringkasPyware(h6, FIELD)
  cek('asal Y keliru menghasilkan titik keluar', r6.diLuarJumlah > 0, String(r6.diLuarJumlah))
  const saran = saranAsalY(csvTengah, { ...OPSI, asalY: 'garis-depan' }, FIELD)
  cek('saran asal Y diberikan', !!saran && saran.asalY === 'tengah', JSON.stringify(saran))
  cek('saran menyebut jumlahnya membaik', !!saran && saran.saran < saran.sekarang)
  const h7 = uraiPyware(csvTengah, { ...OPSI, asalY: 'tengah' })
  cek('dengan asal Y yang benar tidak ada titik keluar', ringkasPyware(h7, FIELD).diLuarJumlah === 0)
  cek('tanpa masalah tidak ada saran', saranAsalY(csvTengah, { ...OPSI, asalY: 'tengah' }, FIELD) === null)
}

/* ----------------------------- 9. pencocokan anggota yang diingat (#1 + #10) */
const anggotaLokal = [
  {
    id: 'm_andra', code: 'A01', name: 'Andra Pratama', section: 'Brass', instrument: 'Trumpet',
    role: 'member', joinYear: 2024, active: 1, token: 't1', createdAt: 1,
  },
  {
    id: 'm_budi', code: 'B02', name: 'Budi Santoso', section: 'Battery', instrument: 'Snare',
    role: 'member', joinYear: 2023, active: 1, token: 't2', createdAt: 1,
  },
]
{
  const pemain = [{ kunci: 't1', kode: 'T1', nama: 'Andra P', instrumen: 'Trumpet', pos: [] }]
  const masuk = pemainKeAnggota(pemain)
  cek('id tiruan berawalan pyware:', masuk[0].id === `${AWALAN_ID_PYWARE}t1` && masuk[0].id === idPyware('T1', 'Andra P'))
  cek('kode Pyware jadi code', masuk[0].code === 'T1')
  cek('instrumen Pyware ikut', masuk[0].instrument === 'Trumpet')

  const saran = susunSaran(masuk, anggotaLokal)
  cek('belum dikenal → tidak otomatis', !saran[0].otomatis)
  cek('ada saran berdasarkan nama/kemiripan', saran[0].saran.length > 0)

  // Pelatih memilih Andra; hasilnya ditulis (alias ikut tersimpan).
  const cocok = terapkanCocok({
    masuk,
    lokal: anggotaLokal,
    keputusan: { [masuk[0].id]: { jenis: 'sama', idLokal: 'm_andra' } },
    arah: 'lokal',
  })
  cek('peta: id Pyware → id lokal', cocok.peta[masuk[0].id] === 'm_andra', JSON.stringify(cocok.peta))
  cek('alias ikut ditulis', (cocok.anggotaTulis[0]?.alias ?? []).includes(masuk[0].id),
    JSON.stringify(cocok.anggotaTulis[0]?.alias))

  // Impor kedua: alias sudah diingat → cocok otomatis, tidak ditanya lagi.
  const lokalBerikut = anggotaLokal.map((m) => cocok.anggotaTulis.find((t) => t.id === m.id) ?? m)
  const saran2 = susunSaran(pemainKeAnggota(pemain), lokalBerikut)
  cek('impor berikutnya cocok otomatis', saran2[0].otomatis?.idLokal === 'm_andra')
  cek('lewat alias, bukan kebetulan nama', saran2[0].otomatis?.lewat === 'alias')

  // Pemain yang tidak ada pasangannya masuk sebagai anggota baru, bukan hilang.
  const asing = pemainKeAnggota([{ kunci: 'x9', kode: 'X9', nama: 'Tanpa Pasangan', instrumen: '', pos: [] }])
  const cocok2 = terapkanCocok({
    masuk: asing,
    lokal: anggotaLokal,
    keputusan: { [asing[0].id]: { jenis: 'baru' } },
    arah: 'lokal',
  })
  cek('pemain asing jadi anggota baru', cocok2.anggotaTulis.some((m) => m.id === asing[0].id))
  cek('anggota baru dapat token QR', !!cocok2.anggotaTulis.find((m) => m.id === asing[0].id)?.token)
}

/**
 * 20 anggota lokal, satu untuk tiap pemain Pyware.
 *
 * Sengaja sebanyak itu: memetakan 20 kode Pyware ke 2 anggota akan membuat
 * titik-titiknya saling menimpa, dan "60 titik masuk utuh" tidak bisa diuji
 * sama sekali.
 */
const anggotaBanyak = KODE.map((k, i) => ({
  id: `m_${i}`,
  code: k,
  name: `Pemain ${k}`,
  section: k[0] === 'T' ? 'Brass' : 'Battery',
  instrument: k[0] === 'T' ? 'Trumpet' : 'Snare',
  role: 'member',
  joinYear: 2024,
  active: 1,
  token: `tk_${i}`,
  createdAt: 1,
}))
const ID_BANYAK = anggotaBanyak.map((m) => m.id)

/* ----------------------- 10. tulis ke basis data + undo lewat riwayat (#10) */
const DRILL = 'd-pyware-uji'
const LAPANGAN_AWAL = { widthYd: 53.3333, lengthYd: 100, endZoneYd: 10, hash: 'nfhs', gridYd: 5, step: '8to5', customStepYd: 0.625, showLabels: 1 }

async function siapkanDrill(rosterIds = []) {
  await db.riwayat.clear()
  await db.sets.clear()
  await db.drills.clear()
  await db.members.bulkPut([...anggotaLokal, ...anggotaBanyak])
  await db.drills.put({
    id: DRILL,
    name: 'Uji Pyware',
    showTitle: 'Uji Pyware',
    field: LAPANGAN_AWAL,
    tempo: 120,
    beatsPerCount: 1,
    rosterIds,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  })
  await db.sets.put({
    id: 'set-lama',
    drillId: DRILL,
    order: 0,
    name: 'Set Pembuka',
    counts: 8,
    points: { m_andra: { x: 1, y: 1, facing: 'front' } },
    createdAt: Date.now(),
  })
}

/** Peta penuh: setiap pemain Pyware → anggota DrillKit. */
function petaKode(hasil, idLokal) {
  const peta = {}
  hasil.pemain.forEach((p, i) => {
    peta[p.kunci] = idLokal[i % idLokal.length]
  })
  return peta
}

await siapkanDrill()
{
  const hasil = uraiPyware(lembarPyware(), OPSI)
  const rancangan = susunSetPyware(hasil).set
  const h = await tulisImporPyware({
    drillId: DRILL,
    rancangan,
    peta: petaKode(hasil, ID_BANYAK),
    mode: 'gabung',
  })

  const set = await db.sets.where('drillId').equals(DRILL).toArray()
  cek('gabung: 3 set baru + 1 set lama', set.length === 4, String(set.length))
  cek('gabung: set lama tidak dihapus', set.some((s) => s.id === 'set-lama'))
  cek('gabung: 60 titik tertulis', h.titikDitulis === 60, String(h.titikDitulis))
  cek('gabung: counts dari kolom Count', set.find((s) => s.name === '1')?.counts === 8)
  cek('gabung: titik punya facing', set.find((s) => s.name === '1')?.points.m_0?.facing === 'front')
  cek('gabung: tiap set berisi 20 pemain',
    Object.keys(set.find((s) => s.name === '1').points).length === 20)
  cek('gabung: foto riwayat dibuat', !!h.snapshotId)

  const snap = h.snapshotId ? await db.riwayat.get(h.snapshotId) : null
  cek('foto beralasan sebelum-impor-pyware', snap?.alasan === 'sebelum-impor-pyware')
  cek('foto memuat keadaan sebelum impor', snap?.jumlahSet === 1, String(snap?.jumlahSet))
  cek('foto tersemat (tidak dipangkas foto otomatis)', snap?.pin === 1)
  cek('riwayat memberi nama yang bisa dibaca',
    (await import('/tmp/riwayat.mjs')).labelAlasan(snap) === 'Sebelum impor Pyware')

  // Undo: kembali ke satu set, hasil impor hilang.
  await pulihkan(h.snapshotId)
  const setelah = await db.sets.where('drillId').equals(DRILL).toArray()
  cek('undo menghapus hasil impor', setelah.length === 1, String(setelah.length))
  cek('undo mengembalikan set lama', setelah[0]?.id === 'set-lama')

  // Daftar riwayat tetap menyebut foto impor.
  const semua = await daftar(DRILL)
  cek('riwayat menyimpan jejak impor', semua.some((s) => s.alasan === 'sebelum-impor-pyware'))
}

/* ---------------------------------------- 11. set bernama sama diperbarui */
{
  await siapkanDrill()
  await db.sets.put({
    id: 'set-sama',
    drillId: DRILL,
    order: 5,
    name: '1',
    counts: 4,
    points: { m_andra: { x: -1, y: -1, facing: 'back' } },
    createdAt: Date.now(),
  })
  const hasil = uraiPyware(lembarPyware(), OPSI)
  const h = await tulisImporPyware({
    drillId: DRILL,
    rancangan: susunSetPyware(hasil).set,
    peta: petaKode(hasil, ID_BANYAK),
    mode: 'gabung',
  })
  const sama = await db.sets.get('set-sama')
  cek('gabung: set bernama sama diperbarui', h.setDiperbarui === 1, String(h.setDiperbarui))
  cek('gabung: titik pemain dari berkas masuk ke set itu',
    dekat(sama.points.m_0.x, -12 * S_YD), String(sama.points.m_0?.x))
  cek('gabung: pemain yang tidak ada di berkas tidak diusir', dekat(sama.points.m_andra.x, -1),
    String(sama.points.m_andra?.x))
  cek('gabung: facing lama dipertahankan', sama.points.m_andra.facing === 'back', sama.points.m_andra.facing)
  cek('gabung: counts ikut diperbarui', sama.counts === 8, String(sama.counts))
}

/* ------------------------------------------------- 12. timpa & salinan */
{
  await siapkanDrill()
  const hasil = uraiPyware(lembarPyware(), OPSI)
  const peta = petaKode(hasil, ID_BANYAK)
  const h = await tulisImporPyware({
    drillId: DRILL,
    rancangan: susunSetPyware(hasil).set,
    peta,
    mode: 'timpa',
  })
  const set = await db.sets.where('drillId').equals(DRILL).toArray()
  cek('timpa: set lama diganti', !set.some((s) => s.id === 'set-lama'))
  cek('timpa: hanya set impor yang ada', set.length === 3, String(set.length))
  cek('timpa: tetap difoto dulu', !!h.snapshotId)
  await pulihkan(h.snapshotId)
  cek('timpa bisa dibatalkan', (await db.sets.where('drillId').equals(DRILL).toArray()).length === 1)
}
{
  await siapkanDrill()
  const hasil = uraiPyware(lembarPyware(), OPSI)
  const peta = petaKode(hasil, ID_BANYAK)
  const h = await tulisImporPyware({
    drillId: DRILL,
    rancangan: susunSetPyware(hasil).set,
    peta,
    mode: 'salinan',
    namaSalinan: 'Uji Pyware (salinan)',
  })
  cek('salinan: drill baru dibuat', h.baru === true && h.drillId !== DRILL)
  const baru = await db.drills.get(h.drillId)
  cek('salinan: namanya dipakai', baru?.name === 'Uji Pyware (salinan)')
  cek('salinan: lapangan ikut disalin', baru?.field.widthYd === LAPANGAN_AWAL.widthYd)
  cek('salinan: set masuk ke drill baru',
    (await db.sets.where('drillId').equals(h.drillId).toArray()).length === 3)
  cek('salinan: drill asal tidak disentuh',
    (await db.sets.where('drillId').equals(DRILL).toArray()).length === 1)
  cek('salinan: tidak ada foto (tidak ada yang ditimpa)', h.snapshotId === null)
}

/* ------------------------------------------- 13. roster drill ikut diperbarui */
{
  await siapkanDrill(['m_andra'])
  const hasil = uraiPyware(lembarPyware(), OPSI)
  await tulisImporPyware({
    drillId: DRILL,
    rancangan: susunSetPyware(hasil).set,
    peta: petaKode(hasil, ID_BANYAK),
    mode: 'gabung',
    anggotaBaru: ['m_baru'],
  })
  const drill = await db.drills.get(DRILL)
  cek('roster: pemain dari berkas dimasukkan', drill.rosterIds.includes('m_0') && drill.rosterIds.includes('m_19'),
    JSON.stringify(drill.rosterIds))
  cek('roster: anggota baru ikut dimasukkan', drill.rosterIds.includes('m_baru'))
  cek('roster: anggota lama tetap ada', drill.rosterIds.includes('m_andra'))

  // roster kosong = semua anggota; jangan diubah menjadi daftar terbatas.
  await siapkanDrill([])
  await tulisImporPyware({
    drillId: DRILL,
    rancangan: susunSetPyware(hasil).set,
    peta: petaKode(hasil, ID_BANYAK),
    mode: 'gabung',
  })
  cek('roster kosong tetap kosong', (await db.drills.get(DRILL)).rosterIds.length === 0)
}

/* ------------------------------------------ 14. kesalahan dilaporkan, bukan diam */
{
  const hKosong = uraiPyware('halo,dunia\n1,2', OPSI)
  cek('CSV tanpa X/Y → tidak dikenal', hKosong.bentuk === 'tidak-dikenal')
  cek('CSV tanpa X/Y punya catatan', hKosong.catatan.length > 0)
  cek('CSV kosong → tidak dikenal', uraiPyware('', OPSI).bentuk === 'tidak-dikenal')

  // Judul kolom tidak harus di baris pertama (Pyware sering menaruh judul drill).
  const denganJudul = ['Fall Show 2026', 'Drill: Opener', lembarPyware()].join('\n')
  const hJudul = uraiPyware(denganJudul, OPSI)
  cek('judul drill di atas tabel dilewati', hJudul.bentuk === 'pyware' && hJudul.indeksHeader === 2,
    String(hJudul.indeksHeader))
  cek('titik tetap 60 walau ada judul', ringkasPyware(hJudul, FIELD).jumlahTitik === 60)

  // Titik ganda untuk set+pemain yang sama: yang terakhir dipakai, dan dikatakan.
  const kembar = [
    'Set,Count,Performer,X,Y',
    '1,1,T1,0,0',
    '1,1,T1,8,8',
    '2,9,T1,16,16',
  ].join('\n')
  const hKembar = uraiPyware(kembar, OPSI)
  cek('titik kembar dihitung', hKembar.kembar === 1, String(hKembar.kembar))
  cek('titik kembar disebut di catatan', hKembar.catatan.some((c) => /dua kali/.test(c)))
  cek('yang terakhir dipakai', dekat(hKembar.pemain[0].pos[0].x, 8 * S_YD))

  let melempar = false
  try {
    await tulisImporPyware({ drillId: 'tidak-ada', rancangan: susunSetPyware(h).set, peta: {}, mode: 'gabung' })
  } catch {
    melempar = true
  }
  cek('drill tujuan tidak ada → error, bukan diam', melempar)
}

/* ------------------------------------------------------- 15. simpanAnggota */
{
  await db.members.clear()
  await simpanAnggota(anggotaLokal, [])
  cek('simpanAnggota menulis anggota', (await db.members.toArray()).length === 2)
  // Alias yang tersimpan membuat impor berikutnya otomatis (jalur nyata, bukan
  // hanya di memori).
  await simpanAnggota(
    [{ ...anggotaLokal[0], alias: [idPyware('T1', 'Andra P')] }],
    [],
  )
  const dariDb = await db.members.toArray()
  const saran = susunSaran(
    pemainKeAnggota([{ kunci: 't1', kode: 'T1', nama: 'Andra P', instrumen: 'Trumpet', pos: [] }]),
    dariDb,
  )
  cek('alias dari basis data cocok otomatis', saran[0].otomatis?.idLokal === 'm_andra')
}

/* ------------------------------------------------------------------ bersih */
await db.riwayat.clear()
await db.drills.clear()
await db.sets.clear()
await db.members.clear()
void foto

console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) {
  console.log('\nYang gagal:')
  gagal.forEach((g) => console.log('  ✗ ' + g))
  process.exit(1)
}
