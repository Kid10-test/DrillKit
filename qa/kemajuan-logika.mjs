/**
 * Uji logika murni kemajuan latihan (K3).
 *
 * Dijalankan di node, tanpa browser: yang diuji hanya keputusan "kapan sebuah
 * set dianggap selesai" — bagian yang paling mudah salah dan paling menyusahkan
 * kalau sampai keliru. Penulisan ke Dexie diuji terpisah lewat browser
 * (`kemajuan-presenter`), karena butuh IndexedDB sungguhan.
 */
import {
  KUNCI_SEMUA,
  cariLanjut,
  hitungSelesai,
  seksiSelesai,
  setSelesai,
  tandaSet,
} from '/tmp/kemajuan.mjs'

let lulus = 0
const gagal = []
const cek = (nama, syarat, keterangan = '') => {
  if (syarat) lulus += 1
  else gagal.push(`${nama}${keterangan ? ' — ' + keterangan : ''}`)
}

const SEKSI = ['battery', 'brass', 'cg', 'pit']
const SET = ['s1', 's2', 's3', 's4']

/** Rekaman kemajuan buatan: { setId: { kunci: waktu } } */
const buat = (o) => ({ key: 'd1', centang: o, diubah: 0 })

/* -------------------- 1. Keadaan kosong & tanpa data --------------------- */
cek('tanpa rekaman, set tidak selesai', setSelesai(undefined, 's1', SEKSI) === false)
cek('tanpa rekaman, hitung 0', hitungSelesai(undefined, SET, SEKSI) === 0)
cek('rekaman kosong, tanda set kosong',
  Object.keys(tandaSet(buat({}), 's1')).length === 0)
cek('set yang tidak ada di rekaman, tandanya kosong',
  Object.keys(tandaSet(buat({ s2: { brass: 1 } }), 's1')).length === 0)

/* ------------------- 2. Centang seluruh formasi ('*') ------------------- */
const semuaS1 = buat({ s1: { [KUNCI_SEMUA]: 1000 } })
cek("'*' menandai set selesai", setSelesai(semuaS1, 's1', SEKSI) === true)
cek("'*' berarti tiap seksi selesai",
  SEKSI.every((s) => seksiSelesai(semuaS1, 's1', s)))
cek("'*' di s1 tidak menandai s2", setSelesai(semuaS1, 's2', SEKSI) === false)
cek("'*' tidak mengubah seksi lain di set lain",
  seksiSelesai(semuaS1, 's2', 'brass') === false)

/* ---------------- 3. Centang per seksi (int dari mode K2) --------------- */
const brassSaja = buat({ s1: { brass: 1000 } })
cek('seksi yang dicentang selesai', seksiSelesai(brassSaja, 's1', 'brass') === true)
cek('seksi lain di set yang sama belum selesai',
  seksiSelesai(brassSaja, 's1', 'pit') === false)
cek('set belum selesai kalau baru separuh seksi',
  setSelesai(brassSaja, 's1', SEKSI) === false)

const hampirSemua = buat({ s1: { brass: 1, pit: 2, battery: 3 } })
cek('set belum selesai walau 3 dari 4 seksi sudah',
  setSelesai(hampirSemua, 's1', SEKSI) === false)
const lengkap = buat({ s1: { brass: 1, pit: 2, battery: 3, cg: 4 } })
cek('set selesai setelah SEMUA seksi dicentang',
  setSelesai(lengkap, 's1', SEKSI) === true)
// Kontrak yang sengaja: seksiSelesai TIDAK tahu daftar seksi, jadi untuk
// kunci '*' ia hanya menjawab "apakah '*' dicentang" — bukan "apakah set
// sudah rampung". Karena itulah presenter memakai setSelesai untuk chip
// "Kuasai" saat mode "Semua".
cek('seksiSelesai untuk "*" hanya melihat kunci itu sendiri',
  seksiSelesai(lengkap, 's1', KUNCI_SEMUA) === false)
cek('...dan setSelesai yang menjawab "sudah rampung"',
  setSelesai(lengkap, 's1', SEKSI) === true)

/* ------------------------- 4. Perhitungan ringkasan ---------------------- */
const campur = buat({
  s1: { [KUNCI_SEMUA]: 1 },
  s2: { brass: 1, pit: 2, battery: 3, cg: 4 },
  s3: { brass: 1 },
})
cek('ringkasan menghitung dua cara selesai', hitungSelesai(campur, SET, SEKSI) === 2,
  `dapat ${hitungSelesai(campur, SET, SEKSI)}`)
cek('ringkasan pada daftar set kosong = 0', hitungSelesai(campur, [], SEKSI) === 0)

/* --------------------------- 5. Titik sambung ---------------------------- */
cek('lanjut dari set pertama yang belum', cariLanjut(campur, SET, SEKSI, 0) === 2,
  `dapat ${cariLanjut(campur, SET, SEKSI, 0)}`)
cek('lanjut berhenti di yang belum, tanpa memutar kalau belum perlu',
  cariLanjut(campur, SET, SEKSI, 3) === 3, `dapat ${cariLanjut(campur, SET, SEKSI, 3)}`)
// Ekornya sudah rampung semua, jadi dari set terakhir ia harus memutar ke awal.
const ekorRampung = buat({
  s1: { brass: 1 },
  s2: { [KUNCI_SEMUA]: 1 },
  s3: { [KUNCI_SEMUA]: 1 },
  s4: { [KUNCI_SEMUA]: 1 },
})
cek('lanjut memutari akhir kembali ke awal',
  cariLanjut(ekorRampung, SET, SEKSI, 3) === 0,
  `dapat ${cariLanjut(ekorRampung, SET, SEKSI, 3)}`)
cek('lanjut dari awal tidak memutar kalau yang dicari ada di depan',
  cariLanjut(ekorRampung, SET, SEKSI, 0) === 0)
const semuaSelesai = buat({
  s1: { [KUNCI_SEMUA]: 1 }, s2: { [KUNCI_SEMUA]: 1 },
  s3: { [KUNCI_SEMUA]: 1 }, s4: { [KUNCI_SEMUA]: 1 },
})
cek('kalau semua selesai, tidak ada yang tersisa (-1)',
  cariLanjut(semuaSelesai, SET, SEKSI, 0) === -1)
cek('daftar set kosong = -1', cariLanjut(campur, [], SEKSI, 0) === -1)

/* ----------------------------- 6. Sudut-sudut ---------------------------- */
// Drill yang seluruhnya satu seksi: daftar seksi kosong. Centang '*' harus
// tetap dihormati, sebab itulah satu-satunya cara menandai di drill semacam itu.
cek('tanpa daftar seksi, "*" tetap selesai',
  setSelesai(buat({ s1: { [KUNCI_SEMUA]: 1 } }), 's1', []) === true)
cek('tanpa daftar seksi dan tanpa "*", tidak selesai',
  setSelesai(buat({ s1: { brass: 1 } }), 's1', []) === false)
// Waktu centang dicatat, jadi "terakhir dilatih" bisa dijawab nanti.
cek('waktu centang tersimpan apa adanya', tandaSet(lengkap, 's1').brass === 1)

console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) {
  console.log('GAGAL:\n - ' + gagal.join('\n - '))
  process.exit(1)
}
