/**
 * Uji simpan otomatis ke berkas (1b).
 *
 * Mengapa diuji tanpa peramban: File System Access API tidak ada di Node,
 * jadi yang diuji di sini bukan API-nya, melainkan **mesin keadaannya** —
 * apa yang dilakukan aplikasi ketika berkas belum dipasang, ketika izin
 * dicabut, ketika berkasnya sudah dipindah, dan kapan ia boleh berhenti
 * menulis. Semua itu murni logika dan tidak perlu peramban.
 *
 * Pegangan berkasnya dipalsukan dengan objek berbentuk sama (bebek-tiruan).
 * Bisa karena `Simpanan.pegangan` memang disimpan sebagai `unknown` —
 * lapisan penyimpanan tidak perlu tahu tentang API peramban.
 *
 * Pakai: bash qa/bangun-logika.sh && node qa/uji-simpan-otomatis.mjs
 */
import 'fake-indexeddb/auto'

/**
 * JEMBATAN KHUSUS UJI — bukan bagian aplikasi.
 *
 * Pegangan berkas yang asli (`FileSystemFileHandle`) bisa disimpan di
 * IndexedDB karena peramban membuatnya begitu. Tiruan kita tidak: ia
 * berisi fungsi, dan `structuredClone` menolak fungsi.
 *
 * Karena itu `structuredClone` disisipi jalan keluar: kalau kloning gagal,
 * kembalikan salinan yang tetap mempertahankan fungsinya. Ini hanya
 * menyiasati keterbatasan tiruan, tidak mengubah apa pun pada kode yang
 * diuji — `simpanOtomatis.ts` tetap membaca pegangannya dari IndexedDB
 * seperti pemakaian sebenarnya.
 */
const klonAsli = globalThis.structuredClone
globalThis.structuredClone = function klonUji(nilai, opsi) {
  try {
    return klonAsli(nilai, opsi)
  } catch {
    if (typeof nilai === 'function') return nilai
    if (Array.isArray(nilai)) return nilai.map((x) => klonUji(x, opsi))
    if (nilai && typeof nilai === 'object') {
      const keluar = {}
      for (const [k, v] of Object.entries(nilai)) keluar[k] = klonUji(v, opsi)
      return keluar
    }
    throw new Error('tetap tidak bisa dikloning')
  }
}

import { db } from '/tmp/dbk.mjs'
import {
  JEDA_PERIKSA_MS,
  JEDA_SIMPAN_MS,
  didukung,
  lepas,
  mintaIzin,
  pasang,
  simpan,
  simpanBilaPerlu,
  status,
  ukuran,
} from '/tmp/simpanOtomatis.mjs'

let lulus = 0
const gagal = []
const cek = (nama, syarat, keterangan = '') => {
  if (syarat) lulus += 1
  else gagal.push(`${nama}${keterangan ? ' — ' + keterangan : ''}`)
}

/** Pegangan berkas tiruan. `izin` bisa diatur untuk mensimulasikan cabut izin. */
function peganganPalsu({ izin = 'granted', gagal = false, catat = [] } = {}) {
  return {
    name: 'backup-palsu.json',
    queryPermission: async () => izin,
    requestPermission: async () => izin,
    createWritable: async () => {
      if (gagal) throw new Error('berkas tidak bisa ditulis')
      return {
        write: async (isi) => {
          catat.push(String(isi))
        },
        close: async () => {},
      }
    },
  }
}

async function terpasang(pegangan, at = 0) {
  await db.simpanan.put({ key: 'utama', pegangan, nama: 'backup-palsu.json', at })
}

await db.simpanan.clear()
await db.members.clear()
await db.drills.clear()
await db.sets.clear()

// ------------------------------------------------- 1. tanpa dukungan, diam saja
cek('di Node API-nya memang tidak ada', didukung() === false)
cek('memasang tanpa dukungan tidak meledak', (await pasang()).ok === false)
cek('status awal = belum terpasang', (await status()).terpasang === false)
cek('menyimpan tanpa berkas = tidak-terpasang', (await simpan()).hasil === 'tidak-terpasang')
cek('penjaga tanpa berkas = tidak-terpasang', (await simpanBilaPerlu()) === 'tidak-terpasang')
cek('melepas tanpa berkas tidak meledak', await lepas().then(() => true).catch(() => false))
cek('minta izin tanpa berkas = false', (await mintaIzin()) === false)

// --------------------------------------- 2. konstanta yang mudah tertukar arah
// Memeriksa lebih jarang daripada menyimpan berarti kesempatan menyimpan
// terlewat begitu saja — kekeliruan yang tidak terasa sampai ada yang hilang.
cek('pemeriksaan lebih sering daripada jarak simpan', JEDA_PERIKSA_MS < JEDA_SIMPAN_MS)
cek('jarak simpan masuk akal (menit, bukan detik)', JEDA_SIMPAN_MS >= 60_000)

// ---------------------------------------------- 3. izin dicabut browser
await terpasang(peganganPalsu({ izin: 'prompt' }))
cek('izin tercabut dilaporkan, bukan didiamkan', (await simpan()).hasil === 'perlu-izin')
cek('status ikut melaporkan izin', (await status()).izin === false)
cek('izin belum diberikan tidak menulis apa pun', (await status()).at === 0)

// ------------------------------------------- 4. berkas dipindah / tak bisa ditulis
await terpasang(peganganPalsu({ izin: 'granted', gagal: true }))
cek('gagal menulis dilaporkan sebagai gagal', (await simpan()).hasil === 'gagal')

// ------------------------------------------------------- 5. menyimpan berhasil
const tulisan = []
await terpasang(peganganPalsu({ izin: 'granted', catat: tulisan }))
const r = await simpan()
cek('menyimpan berhasil dilaporkan', r.hasil === 'tersimpan')
cek('isi benar-benar dituliskan', tulisan.length === 1)
cek('yang ditulis formatnya backup DrillKit', (tulisan[0] ?? '').includes('"format": "drillkit-backup"'))
cek('cap waktu tersimpan', (await status()).at > 0)

// ------------------------------- 6. penjaga tidak menulis berulang-ulang
const sebelum = tulisan.length
cek('penjaga melewatkan giliran kalau belum waktunya', (await simpanBilaPerlu()) === 'tersimpan')
cek('dan karena itu tidak menulis apa pun', tulisan.length === sebelum)

// Kalau sudah lewat jarnya, ia menulis — asalkan ada anggota.
await db.members.put({ id: 'm1', name: 'Uji', section: 'Brass', active: 1, code: 'U01' })
await db.simpanan.update('utama', { at: Date.now() - JEDA_SIMPAN_MS - 1 })
await simpanBilaPerlu()
cek('penjaga menulis setelah lewat jarak simpan', tulisan.length === sebelum + 1)

// --------------------------------- 7. aplikasi kosong tidak menulisi berkas orang
await db.members.clear()
await db.simpanan.update('utama', { at: Date.now() - JEDA_SIMPAN_MS - 1 })
const jumlah = tulisan.length
await simpanBilaPerlu()
cek('tanpa anggota, berkas tidak ditimpa dengan backup kosong', tulisan.length === jumlah)

// ------------------------------------------------------ 8. melepas & tulisan
await lepas()
cek('setelah dilepas, status kembali belum terpasang', (await status()).terpasang === false)
cek('ukuran ditulis dengan satuan yang terbaca', ukuran(2048) === '2 KB')

await db.simpanan.clear()
await db.members.clear()

console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) {
  console.log('\nYang gagal:')
  gagal.forEach((g) => console.log('  ✗ ' + g))
  process.exit(1)
}
