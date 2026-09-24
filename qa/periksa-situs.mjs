/**
 * Uji `scripts/periksa-situs.sh` — alat yang dipakai pelatih untuk
 * memeriksa situsnya sendiri.
 *
 * Mengapa skrip ini perlu diuji juga: ia adalah alat DIAGNOSIS. Alat
 * diagnosis yang salah tidak pernah berteriak — ia mengatakan "semuanya
 * baik-baik saja" pada situs yang rusak, dan karena itu lebih berbahaya
 * daripada tidak punya alat sama sekali.
 *
 * Yang diuji:
 *   1. situs yang SEHAT → keluar 0 dan mengatakan berkasnya lengkap,
 *   2. situs yang BERKASNYA HILANG → keluar 1 dan MENYEBUT berkas itu,
 *   3. situs tanpa `paket.json` → diberitahukan, bukan didiamkan.
 *
 * Peladen sederhana di bawah ini sengaja TIDAK menerapkan `_redirects`:
 * itulah keadaan host yang belum dikonfigurasi, dan pemeriksaan harus
 * bisa membedakannya.
 *
 * Pakai: node periksa-situs.mjs
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { execFile } from 'node:child_process'
import { AKAR, DIST } from './lokasi.mjs'

const SKRIP = path.join(AKAR, 'scripts/periksa-situs.sh')

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

/** Salin hasil build ke folder sementara. */
function salinSitus(ke) {
  fs.rmSync(ke, { recursive: true, force: true })
  fs.mkdirSync(ke, { recursive: true })
  fs.cpSync(DIST, ke, { recursive: true })
}

/** Peladen statis sederhana: 404 untuk apa pun yang tidak ada. */
function jalankan(root) {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent((req.url || '/').split('?')[0])
    const p = path.join(root, url === '/' ? 'index.html' : url)
    if (!p.startsWith(root)) {
      res.writeHead(403).end()
      return
    }
    if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' }).end('404')
      return
    }
    const ekstensi = path.extname(p)
    const jenis =
      ekstensi === '.js'
        ? 'text/javascript'
        : ekstensi === '.css'
          ? 'text/css'
          : ekstensi === '.json'
            ? 'application/json'
            : 'text/html'
    res.writeHead(200, { 'Content-Type': jenis }).end(fs.readFileSync(p))
  })
  return new Promise((selesai) => {
    server.listen(0, '127.0.0.1', () => selesai(server))
  })
}

const peladen = []
async function buka(nama) {
  const root = path.join(os.tmpdir(), 'uji-periksa-' + nama)
  salinSitus(root)
  const server = await jalankan(root)
  peladen.push(server)
  return { root, alamat: `http://127.0.0.1:${server.address().port}` }
}

/**
 * JALANKAN SECARA ASINKRON, jangan `spawnSync`.
 *
 * Peladen HTTP ujiannya hidup di dalam proses Node yang sama.
 * `spawnSync` memblokir putaran eventnya, sehingga peladen itu tidak
 * pernah menjawab permintaan `curl` dari dalam skrip — skrip menunggu
 * jawaban yang tidak akan datang, dan ujiannya menggantung sampai
 * waktu habis. Kegagalannya tidak menghasilkan satu baris pun, jadi
 * tampak seolah skripnya yang rusak, bukan ujiannya.
 */
function periksa(alamat) {
  return new Promise((selesai) => {
    execFile('bash', [SKRIP, alamat], { encoding: 'utf8' }, (err, stdout, stderr) => {
      selesai({
        kode: typeof err?.code === 'number' ? err.code : err ? 1 : 0,
        keluar: (stdout || '') + (stderr || ''),
      })
    })
  })
}

try {
  cek('0: dist/ ada — jalankan vite build lebih dulu', fs.existsSync(`${DIST}/index.html`))

  /* -------------------------- 1. situs sehat -------------------------- */
  console.log('\n— Situs sehat: keluar 0 —')
  {
    const { root, alamat } = await buka('sehat')
    // paket.json tidak pernah ikut dalam build; tambahkan supaya cabang
    // "berkas materi ada" ikut teruji.
    fs.writeFileSync(
      path.join(root, 'paket.json'),
      JSON.stringify({ format: 'drillkit-share', team: { teamName: 'Tim Uji' } }),
    )
    const r = await periksa(alamat)
    cek('1: keluar 0 pada situs yang sehat', r.kode === 0, 'kode ' + r.kode)
    cek('1: mengatakan berkas aplikasinya lengkap', /semua \d+ berkas aplikasi ada/.test(r.keluar),
      r.keluar.split('\n').find((b) => /berkas aplikasi/.test(b)) ?? '')
    cek('1: mengatakan paket.json ada', /paket\.json ada/.test(r.keluar),
      r.keluar.split('\n').find((b) => /paket\.json/.test(b)) ?? '')
    cek('1: tidak mengada-ada kegagalan', !/HILANG/.test(r.keluar))
  }

  /* --------------------- 2. berkas aplikasi hilang --------------------- */
  console.log('\n— Berkas aplikasi hilang: keluar 1 dan MENYEBUTNYA —')
  {
    const { root, alamat } = await buka('rusak')
    const aset = fs.readdirSync(path.join(root, 'assets')).filter((f) => /^index-.*\.js$/.test(f))
    cek('2: berkas utamanya ketemu untuk dihapus', aset.length > 0, JSON.stringify(aset))
    for (const f of aset) fs.rmSync(path.join(root, 'assets', f))

    const r = await periksa(alamat)
    cek('2: keluar 1 — ada yang gagal', r.kode === 1, 'kode ' + r.kode)
    cek('2: mengatakan ada berkas yang HILANG', /berkas aplikasi HILANG/.test(r.keluar),
      r.keluar.split('\n').find((b) => /HILANG/.test(b)) ?? '')
    cek('2: dan MENYEBUT berkas mana yang hilang',
      aset.some((f) => r.keluar.includes(f)), aset.join() + ' | ' +
      (r.keluar.split('\n').find((b) => /berkas hilang/.test(b)) ?? '-'))
    cek('2: memberitahu bahwa unggahannya harus SELURUH folder',
      /SELURUH folder/.test(r.keluar))
  }

  /* ----------------------- 3. tanpa berkas materi ---------------------- */
  console.log('\n— Tanpa paket.json: diberitahukan, bukan didiamkan —')
  {
    const { alamat } = await buka('tanpa-paket')
    const r = await periksa(alamat)
    cek('3: keluar 0 — ini peringatan, bukan kegagalan aplikasi', r.kode === 0, 'kode ' + r.kode)
    cek('3: menyebut bahwa paket.json tidak ada', /paket\.json tidak ada/.test(r.keluar),
      r.keluar.split('\n').find((b) => /paket\.json/.test(b)) ?? '')
    cek('3: dan menyebut akibatnya pada tombol Perbarui anggota',
      /Perbarui/.test(r.keluar))
  }

  /* -------------------------- 4. salah pakai -------------------------- */
  console.log('\n— Salah pakai: ditolak dengan jelas —')
  {
    const r = await new Promise((selesai) => {
      execFile('bash', [SKRIP], { encoding: 'utf8' }, (err, stdout, stderr) => {
        selesai({
          kode: typeof err?.code === 'number' ? err.code : err ? 1 : 0,
          keluar: (stdout || '') + (stderr || ''),
        })
      })
    })
    cek('4: tanpa alamat, minta alamatnya (bukan menggalat)', /Pakai:/.test(r.keluar),
      r.keluar.slice(0, 80))
    cek('4: dan keluar dengan kode khusus', r.kode === 2, 'kode ' + r.kode)
  }
} finally {
  for (const s of peladen) s.close()
}

console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) {
  for (const g of gagal) console.log('  ✗ ' + g)
  process.exitCode = 1
}
