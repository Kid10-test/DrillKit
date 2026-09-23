/**
 * Uji riwayat formasi (1a) — "undo yang tidak hilang".
 *
 * Mengapa diuji tanpa peramban: mesinnya murni penyimpanan, tidak menyentuh
 * layar sama sekali. Mengujinya lewat peramban berarti setiap pemeriksaan
 * harus menunggu halaman dimuat — padahal yang diuji cuma "apa yang tersimpan
 * dan apa yang dikembalikan".
 *
 * Dua asersi yang paling menentukan, dan keduanya berlawanan arah:
 *
 * 1. **Keadaan yang sama persis TIDAK difoto dua kali.** Kalau ini meleset,
 *    pemotretan otomatis menghasilkan puluhan foto kembar dan menggeser foto
 *    penting — persis kegagalan yang paling merugikan.
 * 2. **Mengembalikan versi lama harus memotret keadaan sekarang lebih dulu.**
 *    Tanpa itu, mengembalikan jadi satu-satunya aksi di aplikasi ini yang
 *    tidak bisa dibatalkan — padahal justru itulah saatnya orang menekan
 *    tombol dengan yakin lalu menyesal.
 *
 * Pakai: bash qa/bangun-logika.sh && node qa/uji-riwayat.mjs
 */
import 'fake-indexeddb/auto'
import { db } from '/tmp/dbk.mjs'
import {
  daftar,
  foto,
  hapusRiwayat,
  keadaan,
  bedaDenganSekarang,
  labelAlasan,
  pulihkan,
  waktuRelatif,
} from '/tmp/riwayat.mjs'

let lulus = 0
const gagal = []
const cek = (nama, syarat, keterangan = '') => {
  if (syarat) lulus += 1
  else gagal.push(`${nama}${keterangan ? ' — ' + keterangan : ''}`)
}

/**
 * Penanda waktu buatan untuk foto-foto yang diundur-undur.
 *
 * Harus SELALU di masa depan terhadap `Date.now()`: foto yang tidak
 * diundur-undur (seperti foto penyelamat saat mengembalikan) memakai waktu
 * nyata. Kalau `jam` dimulai di masa lalu, foto yang diundur jadi tampak
 * lebih tua dari foto nyata dan urutan daftarnya terbalik — kegagalan yang
 * tampak seperti mesin riwayat yang salah, padahal ujinya yang keliru.
 */
let jam = Date.now() + 60_000

/**
 * Undur penanda waktu foto terakhir.
 *
 * Perlu karena `foto()` memakai `Date.now()`: dipanggil beruntun dalam satu
 * milidetik, beberapa foto bisa berbagi cap waktu yang sama dan urutannya
 * jadi tidak menentu.
 */
async function mundurkan(snapshot, waktu) {
  await db.riwayat.update(snapshot.id, { at: waktu })
}

const DRILL = 'd-uji'
const PEGANGAN = { x: 0, y: 0, facing: 'front' }

function setKe(indeks, titik) {
  return {
    id: `set-${indeks}`,
    drillId: DRILL,
    order: indeks,
    name: `Set ${indeks + 1}`,
    counts: 8,
    points: titik,
    createdAt: jam,
  }
}

// ------------------------------------------------------------------- bersihkan
await db.riwayat.clear()
await db.drills.clear()
await db.sets.clear()

await db.drills.put({
  id: DRILL,
  name: 'Uji',
  showTitle: 'Uji',
  field: { widthYd: 53.33, lengthYd: 100, hash: 'ncaa' },
  tempo: 120,
  beatsPerCount: 1,
  rosterIds: ['m1', 'm2'],
  createdAt: jam,
  updatedAt: jam,
})
await db.sets.bulkPut([setKe(0, { m1: { ...PEGANGAN }, m2: { x: 4, y: 0, facing: 'front' } })])

// ----------------------------------------------------------- 1. memotret
const f1 = await foto(DRILL, 'tandai', 'sebelum coba blok baru')
cek('foto pertama tersimpan', !!f1)
cek('foto beralasan "tandai" tersemat (pin=1)', f1?.pin === 1)
cek('label tersimpan', f1?.label === 'sebelum coba blok baru')
cek('label tampil di antarmuka', labelAlasan(f1) === 'sebelum coba blok baru')
cek('jumlah titik terhitung', f1?.jumlahTitik === 2, `dapat ${f1?.jumlahTitik}`)

// ------------------------------------------- 2. keadaan kembar tidak difoto
const f2 = await foto(DRILL, 'otomatis')
cek('keadaan sama persis TIDAK difoto ulang', f2?.id === f1?.id)
cek('jumlah foto tetap satu', (await daftar(DRILL)).length === 1)

// ---------------------------------------------- 3. keadaan berubah difoto
await db.sets.put(setKe(0, { m1: { x: 12, y: 3, facing: 'front' } }))
jam += 60_000
const f3 = await foto(DRILL, 'otomatis')
cek('keadaan berubah menghasilkan foto baru', !!f3 && f3.id !== f1?.id)
cek('foto otomatis tidak tersemat (pin=0)', f3?.pin === 0)
await mundurkan(f3, jam)
cek('jumlah foto jadi dua', (await daftar(DRILL)).length === 2)

// ------------------------------------------------- 4. urutan & ringkasan
const daftarFoto = await daftar(DRILL)
cek('daftar terbaru di atas', daftarFoto[0].id === f3.id)

const sekarang = await keadaan(DRILL)
cek('keadaan sekarang terbaca', sekarang?.jumlahTitik === 1, `dapat ${sekarang?.jumlahTitik}`)
cek(
  'selisih dilaporkan sebagai "-1 titik"',
  bedaDenganSekarang(f1, sekarang) === '−1 titik',
  `dapat "${bedaDenganSekarang(f1, sekarang)}"`,
)
cek('foto yang sama dengan sekarang dilaporkan demikian', bedaDenganSekarang(f3, sekarang) === 'sama dengan sekarang')

// ------------------------------------------------------- 5. mengembalikan
await pulihkan(f1.id)
const sudahPulih = await db.sets.get('set-0')
cek('titik yang hilang hidup kembali', Object.keys(sudahPulih.points).length === 2)
cek('posisinya persis seperti difoto', sudahPulih.points.m2.x === 4)

// Mengembalikan harus memotret keadaan sekarang lebih dulu.
const setelahPulih = await daftar(DRILL)
const fotoPenyelamat = setelahPulih.find((s) => s.alasan === 'sebelum-kembalikan')
cek('keadaan sekarang difoto sebelum ditimpa', !!fotoPenyelamat)
cek('foto penyelamat tersemat', fotoPenyelamat?.pin === 1)

// Dan karena itu, pemulihannya sendiri bisa dibatalkan.
await pulihkan(fotoPenyelamat.id)
const dibatalkan = await db.sets.get('set-0')
cek('pemulihan bisa dibatalkan', Object.keys(dibatalkan.points).length === 1)

// ------------------------------------- 6. pemangkasan tidak menggeser yang penting
await db.riwayat.clear()
for (let i = 0; i < 30; i++) {
  await db.sets.put(setKe(0, { m1: { x: i, y: 0, facing: 'front' } }))
  jam += 60_000
  const f = await foto(DRILL, 'otomatis')
  await mundurkan(f, jam)
}
await foto(DRILL, 'sebelum-hapus-set')
const setelahBanyak = await daftar(DRILL)
const otomatis = setelahBanyak.filter((s) => s.pin === 0)
const tersemat = setelahBanyak.filter((s) => s.pin === 1)
cek('foto otomatis dipangkas', otomatis.length <= 25, `tersisa ${otomatis.length}`)
cek('foto penting tidak ikut terpangkas', tersemat.some((s) => s.alasan === 'sebelum-hapus-set'))

// ------------------------------ 7. drill yang sudah dihapus bisa hidup kembali
await hapusRiwayat(DRILL)
const fotoPenghapus = await foto(DRILL, 'sebelum-hapus-drill')
await db.drills.delete(DRILL)
await db.sets.clear()

await pulihkan(fotoPenghapus.id)
const drillHidup = await db.drills.get(DRILL)
const setHidup = await db.sets.where('drillId').equals(DRILL).toArray()
cek('baris drill ikut hidup kembali', !!drillHidup)
cek('set-nya ikut hidup kembali', setHidup.length === 1)

// ------------------------------------------------------- 8. tulisan antarmuka
cek('waktu "baru saja"', waktuRelatif(Date.now()) === 'baru saja')
cek('waktu menit lalu', waktuRelatif(Date.now() - 5 * 60_000) === '5 menit lalu')
cek('waktu jam lalu', waktuRelatif(Date.now() - 4 * 3_600_000) === '4 jam lalu')
cek('foto tanpa label pakai nama bakunya', labelAlasan({ alasan: 'sebelum-impor' }) === 'Sebelum impor show')

// ------------------------------------------------------------------ bersihkan
await db.riwayat.clear()
await db.drills.clear()
await db.sets.clear()

console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) {
  console.log('\nYang gagal:')
  gagal.forEach((g) => console.log('  ✗ ' + g))
  process.exit(1)
}
