/**
 * Uji aturan mode perangkat: anggota tidak boleh masuk mode pelatih.
 *
 * Dua asersi yang paling menentukan, dan keduanya berlawanan arah:
 *
 * 1. **PIN terpasang + PIN salah = tertahan.** Inilah yang diminta.
 * 2. **PIN belum terpasang = tetap boleh keluar.** Sengaja: mengunci mode
 *    anggota tanpa ada kuncinya berarti pelatih bisa mengurung dirinya
 *    sendiri, dan satu-satunya jalan keluar tinggal membersihkan data
 *    peramban. Mengunci pemilik yang sah lebih buruk daripada membiarkan
 *    anggota melihat menu yang kosong.
 */
import {
  KUNCI_MODE,
  RUTE_ANGGOTA,
  bacaMode,
  bolehBuka,
  pernahMemilih,
  bolehKePelatih,
  simpanMode,
  teksKunci,
  teksTanpaPin,
  wajibPasangPin,
} from '/tmp/modePerangkat.mjs'

let lulus = 0
const gagal = []
const cek = (nama, syarat, keterangan = '') => {
  if (syarat) lulus += 1
  else gagal.push(`${nama}${keterangan ? ' — ' + keterangan : ''}`)
}

// ------------------------------------------------------------ penjaga rute
{
  cek('rute anggota cuma /berbagi', RUTE_ANGGOTA === '/berbagi')

  cek('anggota boleh di /berbagi', bolehBuka('member', '/berbagi') === true)
  // Menyaring menu tidak cukup — rute pelatih harus ikut ditahan, karena
  // mengetik #/anggota di bilah alamat tidak melewati menu sama sekali.
  for (const r of ['/', '/anggota', '/absensi', '/jadwal', '/drill', '/musik',
                   '/lomba', '/data', '/evaluasi', '/pengaturan']) {
    cek(`anggota DITAHAN di ${r}`, bolehBuka('member', r) === false)
  }
  // Dashboard ikut tertahan — mudah luput karena ia rute bawaan.
  cek('anggota ditahan di dashboard (rute bawaan)',
    bolehBuka('member', '/') === false)

  for (const r of ['/', '/anggota', '/berbagi', '/pengaturan']) {
    cek(`pelatih bebas di ${r}`, bolehBuka('coach', r) === true)
  }
}

// -------------------------------------------------------------- keharusan PIN
{
  cek('tanpa PIN: dianjurkan pasang PIN', wajibPasangPin(false) === true)
  cek('dengan PIN: tidak perlu lagi', wajibPasangPin(true) === false)
}

// -------------------------------------------------- bolehKePelatih (yang inti)
{
  cek('PIN terpasang + PIN benar = boleh', bolehKePelatih(true, true) === true)
  cek('PIN terpasang + PIN salah = DITAHAN', bolehKePelatih(true, false) === false)
  // Anti-jebakan: tanpa PIN tidak boleh mengurung pelatih.
  cek('tanpa PIN + tidak ada PIN benar = tetap boleh (tidak mengurung)',
    bolehKePelatih(false, false) === true)
  cek('tanpa PIN + PIN benar = boleh', bolehKePelatih(false, true) === true)
}

// ------------------------------------------------------------------- teks
{
  const a = teksKunci(true)
  cek('teks kunci menyebut PIN', /PIN/.test(a), a)
  const b = teksKunci(false)
  // Yang diuji bukan "menyebut kata PIN" — ia memang menjelaskan bahwa PIN
  // belum ada — melainkan bahwa ia tidak MEMINTA PIN dimasukkan.
  cek('teks kunci tanpa PIN tidak meminta PIN', !/Masukkan PIN/.test(b), b)
  cek('teks kunci tanpa PIN mengakui belum terkunci', /belum dikunci/.test(b), b)

  const t = teksTanpaPin()
  cek('peringatan mengakui belum terkunci', /belum dikunci/.test(t), t)
  cek('peringatan menyebut Pengaturan', /Pengaturan/.test(t), t)
  // Jujur: tidak boleh mengaku "terkunci" padahal belum ada PIN-nya.
  cek('peringatan tidak mengaku terkunci', !/\bterkunci\b(?!.)/.test(t) || /belum terkunci/.test(t))
}

// --------------------------------------------- pernah memilih (layar sambutan)
{
  // Di node tidak ada localStorage. Yang diuji di sini adalah KEGAGALANNYA:
  // bila pilihan tidak bisa diingat, jangan menanyai berulang-ulang.
  cek('tanpa localStorage: dianggap sudah memilih (jangan mengganggu)',
    pernahMemilih() === true)
  // Keadaan "belum memilih" dan "memilih pelatih" harus bisa dibedakan —
  // tanpa itu pelatih akan ditanya ulang setiap kali membuka aplikasi.
  cek('bacaMode saja tidak cukup untuk membedakan "belum memilih"',
    bacaMode() === 'coach')
}

// ------------------------------------------------------------- simpanan mode
{
  cek('kunci mode stabil', KUNCI_MODE === 'drillkit.mode')
  // Di node tidak ada localStorage; bacaMode harus balik ke 'coach', bukan error.
  cek('bacaMode tanpa localStorage = coach', bacaMode() === 'coach')
  let meledak = false
  try { simpanMode('member') } catch { meledak = true }
  cek('simpanMode tidak meledak walau localStorage absen', meledak === false)
}

console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) {
  console.log('\nYang gagal:')
  gagal.forEach((g) => console.log('  ✗ ' + g))
  process.exit(1)
}
