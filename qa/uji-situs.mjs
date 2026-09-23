/**
 * N12 — uji logika pemeriksa situs (`src/lib/situs.ts`).
 *
 * Mengapa diuji tanpa peramban: modul ini adalah ALAT DIAGNOSIS.
 * Alat diagnosis yang salah tidak pernah berteriak — ia mengatakan
 * "semuanya baik-baik saja" pada situs yang rusak, dan karena itu
 * lebih berbahaya daripada tidak punya alat sama sekali.
 *
 * Yang diuji bukan "apakah ia mengembalikan larik", melainkan:
 *   1. situs sehat → semua baik,
 *   2. berkas yang hilang → GAGAL dan disebut namanya,
 *   3. `sw.js` yang boleh disimpan perambah → peringatan, sebab
 *      itulah akar keadaan "link rusak",
 *   4. `paket.json` yang menjawab HTML → peringatan dengan saran,
 *   5. situs yang tidak menjawab sama sekali → tidak melempar galat.
 *
 * Pakai: BASE=http://localhost:4173 node uji-situs.mjs
 */
import { periksaSitus, petikAset, ringkasPeriksa } from '/tmp/situs.mjs'

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
const cari = (hasil, id) => hasil.find((h) => h.id === id)

/** Pengambil pura-pura: jawab dari peta alamat → balasan. */
function buatAmbil(peta, { html = '', lempar = false } = {}) {
  return async (alamat, metode = 'GET') => {
    if (lempar) throw new Error('jaringan putus')
    const aturan = peta[alamat]
    if (!aturan) return { status: 404, jenis: 'text/plain', teks: '', cacheKontrol: '' }
    return {
      status: aturan.status ?? 200,
      jenis: aturan.jenis ?? 'text/html',
      teks: metode === 'GET' ? (aturan.teks ?? '') : '',
      cacheKontrol: aturan.cacheKontrol ?? '',
    }
  }
}

const INDEKS_BAIK = '<script type="module" src="./assets/index-abc123.js"></script>' +
  '<link rel="stylesheet" href="./assets/index-abc123.css">'

/* ------------------------------ 1. situs sehat ------------------------------ */
{
  const peta = {
    'index.html': { teks: INDEKS_BAIK, cacheKontrol: 'no-store' },
    'sw.js': { jenis: 'text/javascript', cacheKontrol: 'no-store' },
    'assets/index-abc123.js': { jenis: 'text/javascript' },
    'assets/index-abc123.css': { jenis: 'text/css' },
    'paket.json': { jenis: 'application/json' },
    __drillkit_periksa_alihtujuan__: {},
  }
  peta['__drillkit-periksa-alihtujuan__'] = {}
  const hasil = await periksaSitus(buatAmbil(peta))
  cek('1: situs sehat — tidak ada yang gagal', !hasil.some((h) => h.keadaan === 'gagal'),
    JSON.stringify(hasil.filter((h) => h.keadaan !== 'baik').map((h) => h.id)))
  cek('1: dan tidak ada peringatan', !hasil.some((h) => h.keadaan === 'peringatan'),
    JSON.stringify(hasil.filter((h) => h.keadaan === 'peringatan').map((h) => h.id)))
  cek('1: berkas aplikasinya dinyatakan lengkap',
    /Semua 2 berkas/.test(cari(hasil, 'aset')?.rincian ?? ''), cari(hasil, 'aset')?.rincian)
  cek('1: ringkasannya mengatakan semua baik', ringkasPeriksa(hasil) === 'Semua pemeriksaan baik.',
    ringkasPeriksa(hasil))
}

/* ------------------- 2. berkas aplikasi hilang: GAGAL & disebut ------------- */
{
  const peta = {
    'index.html': { teks: INDEKS_BAIK, cacheKontrol: 'no-store' },
    'sw.js': { jenis: 'text/javascript', cacheKontrol: 'no-store' },
    'assets/index-abc123.css': { jenis: 'text/css' },
    'paket.json': { jenis: 'application/json' },
  }
  // assets/index-abc123.js sengaja tidak ada — itulah keadaan yang
  // membuat perambah lama menampilkan "link rusak".
  const hasil = await periksaSitus(buatAmbil(peta))
  const aset = cari(hasil, 'aset')
  cek('2: berkas yang hilang membuat pemeriksaan GAGAL', aset?.keadaan === 'gagal',
    String(aset?.keadaan))
  cek('2: dan MENYEBUT berkas mana yang hilang',
    /assets\/index-abc123\.js/.test(aset?.rincian ?? ''), aset?.rincian)
  cek('2: sarannya menyebut bahwa unggahan harus seluruh folder',
    /SELURUH folder|penggantian/.test(aset?.saran ?? ''), aset?.saran)
  cek('2: ringkasannya menghitung kegagalannya', /1 gagal/.test(ringkasPeriksa(hasil)),
    ringkasPeriksa(hasil))
  // Kegagalan berkas tidak boleh menutupi pemeriksaan lain.
  cek('2: pemeriksaan lain tetap dijalankan', hasil.length >= 5, String(hasil.length))
}

/* ------------- 3. sw.js boleh disimpan: akar keadaan "link rusak" ----------- */
{
  const peta = {
    'index.html': { teks: INDEKS_BAIK, cacheKontrol: 'no-store' },
    'sw.js': { jenis: 'text/javascript', cacheKontrol: 'public, max-age=3600' },
    'assets/index-abc123.js': { jenis: 'text/javascript' },
    'assets/index-abc123.css': { jenis: 'text/css' },
    'paket.json': { jenis: 'application/json' },
  }
  const hasil = await periksaSitus(buatAmbil(peta))
  const swc = cari(hasil, 'sw-cache')
  cek('3: sw.js yang boleh disimpan jadi PERINGATAN', swc?.keadaan === 'peringatan',
    String(swc?.keadaan))
  cek('3: sarannya menyebut _headers', /_headers/.test(swc?.saran ?? ''), swc?.saran)
  cek('3: dan menyebut akibatnya: "link rusak"', /link rusak/.test(swc?.saran ?? ''),
    swc?.saran)

  // index.html yang boleh disimpan sama berbahayanya.
  const peta2 = { ...peta, 'index.html': { teks: INDEKS_BAIK, cacheKontrol: 'max-age=600' } }
  const hasil2 = await periksaSitus(buatAmbil(peta2))
  cek('3: index.html yang boleh disimpan juga diperingatkan',
    cari(hasil2, 'indeks-cache')?.keadaan === 'peringatan',
    String(cari(hasil2, 'indeks-cache')?.keadaan))
}

/* ------------------- 4. paket.json: tiga keadaan berbeda -------------------- */
{
  const dasar = {
    'index.html': { teks: INDEKS_BAIK, cacheKontrol: 'no-store' },
    'sw.js': { jenis: 'text/javascript', cacheKontrol: 'no-store' },
    'assets/index-abc123.js': { jenis: 'text/javascript' },
    'assets/index-abc123.css': { jenis: 'text/css' },
  }
  // a. menjawab HTML — berkasnya sudah ikut terhapus, alamatnya
  //    dilayani oleh pengalih situs.
  {
    const hasil = await periksaSitus(buatAmbil({ ...dasar, 'paket.json': { jenis: 'text/html' } }))
    const p = cari(hasil, 'paket')
    cek('4a: paket.json yang menjawab HTML diperingatkan', p?.keadaan === 'peringatan',
      String(p?.keadaan))
    cek('4a: dan dikatakan bahwa berkasnya tidak ada di situs',
      /tidak ada di situs|bukan berkas materi/.test(p?.rincian ?? ''), p?.rincian)
    cek('4a: sarannya menyebut tombol Perbarui anggota', /Perbarui/.test(p?.saran ?? ''),
      p?.saran)
  }
  // b. tidak ada sama sekali (404).
  {
    const hasil = await periksaSitus(buatAmbil(dasar))
    cek('4b: paket.json yang tidak ada diperingatkan',
      cari(hasil, 'paket')?.keadaan === 'peringatan', String(cari(hasil, 'paket')?.keadaan))
  }
  // c. ada dan benar.
  {
    const hasil = await periksaSitus(
      buatAmbil({ ...dasar, 'paket.json': { jenis: 'application/json' } }),
    )
    cek('4c: paket.json yang ada dinyatakan baik', cari(hasil, 'paket')?.keadaan === 'baik',
      String(cari(hasil, 'paket')?.keadaan))
  }
  // Peringatan paket.json TIDAK boleh membuat seluruh pemeriksaan gagal.
  {
    const hasil = await periksaSitus(buatAmbil(dasar))
    cek('4d: paket.json yang hilang tidak membuat aplikasi dinyatakan gagal',
      !hasil.some((h) => h.keadaan === 'gagal'),
      JSON.stringify(hasil.filter((h) => h.keadaan === 'gagal').map((h) => h.id)))
  }
}

/* ------------------- 5. situs yang tidak menjawab sama sekali --------------- */
/*
 * Inilah keadaan yang paling perlu dijawab dengan tenang: koneksi
 * putus, atau alamatnya salah. Alat diagnosis yang malah melempar
 * galat pada keadaan terburuk tidak ada gunanya.
 */
{
  const hasil = await periksaSitus(buatAmbil({}, { lempar: true }))
  cek('5: pengambil yang selalu galat TIDAK membuat pemeriksaan melempar',
    Array.isArray(hasil), typeof hasil)
  cek('5: halaman utamanya dinyatakan gagal', cari(hasil, 'indeks')?.keadaan === 'gagal',
    String(cari(hasil, 'indeks')?.keadaan))
  cek('5: dan sarannya menyebut koneksi', /koneksi/i.test(cari(hasil, 'indeks')?.saran ?? ''),
    cari(hasil, 'indeks')?.saran)
}

/* --------------------------- 6. petik aset --------------------------------- */
{
  const aset = petikAset(
    '<script src="./assets/index-abc.js"></script><link href="/assets/index-abc.css">' +
      '<script src="./assets/index-abc.js"></script>',
  )
  cek('6: aset yang sama tidak dihitung dua kali', aset.length === 2, JSON.stringify(aset))
  cek('6: awalan ./ dan / dibuang supaya alamatnya bisa dipakai apa adanya',
    aset.every((a) => a.startsWith('assets/')), JSON.stringify(aset))
  cek('6: teks tanpa aset menghasilkan larik kosong', petikAset('<html></html>').length === 0)
}

/* --------------------------- 7. ringkasan ---------------------------------- */
{
  cek('7: ringkasan kosong', ringkasPeriksa([]) === 'Semua pemeriksaan baik.', ringkasPeriksa([]))
  cek('7: ringkasan mencampur gagal & peringatan',
    ringkasPeriksa([
      { id: 'a', judul: 'a', keadaan: 'gagal', rincian: '' },
      { id: 'b', judul: 'b', keadaan: 'peringatan', rincian: '' },
      { id: 'c', judul: 'c', keadaan: 'baik', rincian: '' },
    ]) === '1 gagal, 1 peringatan.',
    ringkasPeriksa([
      { id: 'a', judul: 'a', keadaan: 'gagal', rincian: '' },
      { id: 'b', judul: 'b', keadaan: 'peringatan', rincian: '' },
    ]))
}

console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) {
  for (const g of gagal) console.log('  ✗ ' + g)
  process.exitCode = 1
}
