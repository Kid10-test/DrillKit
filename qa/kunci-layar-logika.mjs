/**
 * Uji logika kunci layar presenter (G2b).
 *
 * Yang paling dikuji justru yang paling tidak kentara: **kunci menahan
 * papan ketik, bukan hanya sentuhan**, dan ia melakukannya dengan
 * **menelan segalanya kecuali Escape** — bukan dengan daftar tombol yang
 * dicegat. Daftar pasti ada yang luput, dan yang luput berbahaya karena
 * presenter berjalan di atas editor.
 */
import {
  BATAS_COBA,
  PINTASAN_URUTAN,
  TOMBOL_BEBAS,
  TUNGGU_COBA,
  bolehLewat,
  keteranganKunci,
  kunciMenahan,
  masihTunggu,
} from '/tmp/kunciLayar.mjs'

let lulus = 0
const gagal = []
const cek = (nama, syarat, keterangan = '') => {
  if (syarat) lulus += 1
  else gagal.push(`${nama}${keterangan ? ' — ' + keterangan : ''}`)
}

// --------------------------------------------------------------- Escape bebas
cek('Escape boleh lewat', bolehLewat('Escape') === true)
cek('hanya Escape yang bebas', TOMBOL_BEBAS === 'Escape')

// ------------------------------------------- pintasan presenter wajib tertahan
for (const k of ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'PageDown', 'PageUp', ' ', 'r', 'R']) {
  cek(`"${k}" ditahan`, bolehLewat(k) === false)
}
{
  // Daftar PINTASAN_URUTAN mendokumentasikan tombol yang mengubah urutan.
  // Semuanya WAJIB tertahan — kalau ada yang lolos, kuncinya bocor.
  const bocor = PINTASAN_URUTAN.filter((k) => bolehLewat(k))
  cek('tak satu pun pintasan urutan yang lolos', bocor.length === 0, bocor.join(', '))
}

// --------------------------- tombol yang tidak dikenal presenter juga tertahan
// Inilah celah yang ditutup oleh keputusan "telan semua": presenter hanya
// mencegat panah/spasi/R, jadi tombol lain menembus ke editor.
for (const k of ['Delete', 'Backspace', 'z', 'Z', 'd', 'F', 'Enter', 'Tab', 'Home', 'End', '1', 'a']) {
  cek(`tombol asing "${k}" ditahan (tidak tembus ke editor)`, bolehLewat(k) === false)
}
{
  // Huruf besar-kecil tidak boleh jadi celah.
  cek('"R" tertahan sama seperti "r"', bolehLewat('R') === bolehLewat('r'))
}

// -------------------------------------------------------- keterangan di layar
{
  const a = keteranganKunci(true)
  cek('keterangan menyebut PIN bila PIN terpasang', /PIN/.test(a), a ?? '')
  cek('keterangan menyebut papan ketik', /papan ketik/.test(a), a ?? '')
  cek('keterangan menyebut remote', /remote/.test(a), a ?? '')
  const b = keteranganKunci(false)
  cek('tanpa PIN tidak menyebut PIN', !/PIN/.test(b), b ?? '')
  cek('tanpa PIN menyebut tombol Buka', /Buka/.test(b), b ?? '')
  cek('kedua keterangan menyebut sentuhan', /[Ss]entuhan/.test(a) && /[Ss]entuhan/.test(b))
}

// -------------------------------------------------------------- penjaga sumber
// Penjaga inilah yang dipakai penangan tombol presenter. Kalau ia lupa
// memeriksa keadaan kunci, tombol akan lolas walau layar terkunci.
{
  cek('tidak terkunci: tombol apa pun tidak ditahan',
    kunciMenahan(false, 'ArrowRight') === false)
  cek('tidak terkunci: Escape pun tidak ditahan',
    kunciMenahan(false, 'Escape') === false)
  cek('terkunci: panah kanan ditahan', kunciMenahan(true, 'ArrowRight') === true)
  cek('terkunci: spasi ditahan', kunciMenahan(true, ' ') === true)
  cek('terkunci: R ditahan', kunciMenahan(true, 'R') === true)
  cek('terkunci: Delete ditahan', kunciMenahan(true, 'Delete') === true)
  cek('terkunci: Escape TIDAK ditahan', kunciMenahan(true, 'Escape') === false)
}

// ------------------------------------------- cacat kebuntuan: kolom PIN HARUS lolos
// Kunci menelan semua tombol, dan preventDefault pada keydown mencegah
// karakter masuk ke kolom. Tanpa pengecualian ini, memasang PIN berarti
// mengunci layar selamanya — PIN yang benar pun tak pernah bisa diketik.
{
  cek('ketikan di layar kunci DITERIMA',
    kunciMenahan(true, '1', true) === false)
  cek('huruf di layar kunci diterima', kunciMenahan(true, 'a', true) === false)
  cek('Escape di layar kunci tetap diterima', kunciMenahan(true, 'Escape', true) === false)
  cek('panah di LUAR layar kunci tetap ditahan',
    kunciMenahan(true, 'ArrowRight', false) === true)
  cek('angka di LUAR layar kunci tetap ditahan', kunciMenahan(true, '1', false) === true)
  cek('tidak terkunci: ketikan tidak pernah ditahan',
    kunciMenahan(false, '1', true) === false)
}

// ------------------------------------------------------- tahan percobaan salah
{
  const N = 1_000_000
  cek('belum mencapai batas: tidak ditahan', masihTunggu(0, null, N) === false)
  cek('salah 1 kali: tidak ditahan', masihTunggu(1, null, N) === false)
  cek('mencapai batas tetapi tanpa waktu: tidak ditahan',
    masihTunggu(BATAS_COBA, null, N) === false)
  cek('mencapai batas, baru saja: ditahan', masihTunggu(BATAS_COBA, N, N) === true)
  cek('mencapai batas, hampir lewat waktu: ditahan',
    masihTunggu(BATAS_COBA, N, N + TUNGGU_COBA * 1000 - 1) === true)
  cek('mencapai batas, tepat lewat waktu: tidak ditahan',
    masihTunggu(BATAS_COBA, N, N + TUNGGU_COBA * 1000) === false)
  cek('mencapai batas, jauh lewat waktu: tidak ditahan',
    masihTunggu(BATAS_COBA, N, N + TUNGGU_COBA * 1000 * 10) === false)
  cek('lebih dari batas tetap ditahan', masihTunggu(BATAS_COBA + 7, N, N) === true)
  cek('batasnya 5 percobaan', BATAS_COBA === 5)
  cek('tunggunya 15 detik', TUNGGU_COBA === 15)
}

console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) {
  console.log('\nYang gagal:')
  gagal.forEach((g) => console.log('  ✗ ' + g))
  process.exit(1)
}
