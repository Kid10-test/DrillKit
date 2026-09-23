/**
 * N13 — uji logika pendeteksi rilis baru (`src/lib/rilis.ts`).
 *
 * Mengapa diuji tanpa peramban: penanda ini bisa saja SALAH di dua arah,
 * dan dua-duanya merugikan. Tidak pernah berbunyi → perangkat memakai
 * versi lama berhari-hari tanpa ada yang tahu. Terlalu sering berbunyi
 * → penandanya diabaikan, dan penanda yang diabaikan sama dengan tidak
 * ada penanda.
 *
 * Karena itu yang diuji bukan hanya "bedanya ketemu", melainkan juga
 * disiplinnya: **bila ada yang tidak diketahui, diamlah.**
 *
 * Pakai: node uji-rilis.mjs
 */
import { adaRilisBaru, berkasBerjalan, berkasDiSitus } from '/tmp/rilis.mjs'

let lulus = 0
const gagal = []
const cek = (nama, ok, detail = '') => {
  if (ok) {
    lulus += 1
    console.log('  ✓ ' + nama)
  } else {
    gagal.push(`${nama}${detail ? ' — ' + detail : ''}`)
    console.log('  ✗ ' + nama + (detail ? ' → ' + detail : ''))
  }
}

/* --------------------------- 1. yang sedang berjalan ------------------------ */
{
  cek('1: nama bundel terbaca dari alamat berkasnya',
    berkasBerjalan('https://situs.netlify.app/assets/index-abc123.js') === 'assets/index-abc123.js',
    String(berkasBerjalan('https://situs.netlify.app/assets/index-abc123.js')))
  // Server pengembangan: tidak ada bundel, jadi tidak ada yang bisa dibandingkan.
  cek('1: kode sumber (dev) tidak dianggap bundel',
    berkasBerjalan('http://localhost:5173/src/lib/rilis.ts') === null,
    String(berkasBerjalan('http://localhost:5173/src/lib/rilis.ts')))
  cek('1: alamat kosong tidak menghasilkan apa pun', berkasBerjalan('') === null)
}

/* ------------------------------ 2. yang di situs ---------------------------- */
{
  const html = '<!doctype html><script type="module" crossorigin src="./assets/index-def456.js"></script>'
  cek('2: nama bundel terbaca dari isi index.html',
    berkasDiSitus(html) === 'assets/index-def456.js', String(berkasDiSitus(html)))
  // Awalan ./ dan / harus dibuang supaya bisa dibandingkan langsung.
  cek('2: awalan ./ dibuang',
    berkasDiSitus('<script src="./assets/index-x.js">') === 'assets/index-x.js',
    String(berkasDiSitus('<script src="./assets/index-x.js">')))
  cek('2: awalan / dibuang',
    berkasDiSitus('<script src="/assets/index-y.js">') === 'assets/index-y.js',
    String(berkasDiSitus('<script src="/assets/index-y.js">')))
  cek('2: halaman tanpa bundel menghasilkan null', berkasDiSitus('<html></html>') === null)
}

/* --------------------------- 3. membandingkannya ---------------------------- */
{
  cek('3: nama berbeda → ada rilis baru',
    adaRilisBaru('assets/index-abc.js', 'assets/index-def.js') === true)
  cek('3: nama sama → tidak ada rilis baru',
    adaRilisBaru('assets/index-abc.js', 'assets/index-abc.js') === false)

  /*
   * Disiplin yang paling penting: bila salah satunya TIDAK diketahui,
   * jawabannya harus "tidak ada". Menyimpulkan dari setengah
   * pengetahuan akan membuat penanda ini berbunyi pada setiap
   * pemeriksaan yang gagal — dan penanda yang berbunyi tanpa sebab
   * akan berhenti dipercaya.
   */
  cek('3: bundel berjalan tidak diketahui → DIAM, bukan berbunyi',
    adaRilisBaru(null, 'assets/index-def.js') === false)
  cek('3: bundel di situs tidak terbaca → DIAM, bukan berbunyi',
    adaRilisBaru('assets/index-abc.js', null) === false)
  cek('3: keduanya tidak diketahui → DIAM', adaRilisBaru(null, null) === false)
}

/* ------------------- 4. keadaan yang paling sering terjadi ------------------ */
{
  /*
   * Inilah kejadiannya: pelatih mengunggah ulang, nama bundelnya
   * berganti, dan perangkat yang belum dimuat ulang masih memakai
   * nama yang lama.
   */
  const berjalan = 'assets/index-lama99.js'
  const situs = '<script src="./assets/index-baru12.js"></script>'
  cek('4: unggahan baru terdeteksi', adaRilisBaru(berjalan, berkasDiSitus(situs)) === true,
    `${berjalan} vs ${String(berkasDiSitus(situs))}`)
  // Dan setelah dimuat ulang, penandanya harus berhenti berbunyi.
  const setelahMuatUlang = 'assets/index-baru12.js'
  cek('4: setelah dimuat ulang, penandanya berhenti',
    adaRilisBaru(setelahMuatUlang, berkasDiSitus(situs)) === false)
}

console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) {
  for (const g of gagal) console.log('  ✗ ' + g)
  process.exitCode = 1
}
