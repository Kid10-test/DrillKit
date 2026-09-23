/**
 * N12 — uji tampilan pemeriksa situs di halaman Pengaturan.
 *
 * Mengapa ini perlu, padahal logikanya sudah diuji tanpa peramban
 * (`uji-situs.mjs`): yang diuji di sini adalah **apakah hasilnya benar-
 * benar sampai ke mata pemakai**, dan apakah kartunya tidak menjalankan
 * pemeriksaan dengan sendirinya setiap kali halaman dibuka.
 *
 * Dua keadaan yang diuji:
 *   A. situs sehat → hasilnya tampil, berkasnya lengkap, dan
 *      `paket.json` yang tidak ada diberitahukan beserta akibatnya;
 *   B. satu berkas aplikasi sengaja diputus setelah aplikasi hidup →
 *      pemeriksaan harus MENYEBUT berkas itu, bukan diam saja.
 *
 * Pakai: BASE=http://localhost:4173 node situs-ui.mjs
 */
import puppeteer from 'puppeteer'
import { lewatSambutan } from './sambutan.mjs'

const BASE = process.env.BASE || 'http://localhost:4173'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

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
const ada = (h, id) => h.evaluate((x) => document.querySelector(`[data-testid="${x}"]`) != null, id)
const isi = (h, id) =>
  h.evaluate((x) => document.querySelector(`[data-testid="${x}"]`)?.textContent ?? '', id)

const browser = await puppeteer.launch({
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required'],
  defaultViewport: { width: 1300, height: 1000 },
})
const errors = []

/** Buka aplikasi sampai halaman Pengaturan siap. */
async function bukaPengaturan(h) {
  h.on('pageerror', (e) => errors.push(String(e)))
  await h.goto(BASE, { waitUntil: 'networkidle2' })
  await wait(1200)
  await lewatSambutan(h)
  await wait(1200)
  await h.goto(`${BASE}/#/pengaturan`, { waitUntil: 'networkidle2' })
  await wait(2000)
}

try {
  /* ===================== A. situs yang sehat ===================== */
  console.log('\n— Situs sehat: hasilnya tampil dan bisa dibaca —')
  {
    const p = await browser.newPage()
    await bukaPengaturan(p)

    cek('A: Pengaturan punya kartu kesehatan situs', await ada(p, 'kartu-situs'))
    cek('A: tombolnya ada', await ada(p, 'tombol-periksa-situs'))

    /*
     * Pemeriksaan TIDAK boleh berjalan sendiri saat halaman dibuka:
     * setiap pemeriksaan memicu permintaan jaringan, dan halaman ini
     * dibuka juga oleh perangkat yang sedang hemat kuota.
     */
    cek('A: hasilnya TIDAK tampil sebelum tombolnya ditekan',
      !(await ada(p, 'ringkasan-periksa-situs')))

    await p.click('[data-testid="tombol-periksa-situs"]')
    let ringkasan = ''
    for (let i = 0; i < 30; i += 1) {
      await wait(300)
      ringkasan = await isi(p, 'ringkasan-periksa-situs')
      if (ringkasan.trim()) break
    }
    cek('A: menekan tombolnya menampilkan ringkasan', ringkasan.trim().length > 0, ringkasan)

    {
      const aset = await isi(p, 'hasil-periksa-aset')
      cek('A: berkas aplikasinya dinyatakan ADA', /Semua \d+ berkas/.test(aset), aset.slice(0, 120))
    }
    /*
     * Yang terpenting bagi pelatih: `paket.json` memang tidak ada di
     * peladen uji ini, dan pemeriksaannya harus MENYEBUT akibatnya
     * (tombol Perbarui anggota), bukan sekadar "tidak ada".
     */
    {
      const paket = await isi(p, 'hasil-periksa-paket')
      cek('A: paket.json yang tidak ada diberitahukan', /tidak ada|bukan berkas materi/.test(paket),
        paket.slice(0, 140))
      cek('A: dan akibatnya pada tombol Perbarui disebutkan', /Perbarui/.test(paket),
        paket.slice(0, 200))
    }
    cek('A: pemeriksaan tidak menghasilkan galat di konsol', errors.length === 0,
      errors.slice(0, 2).join(' | '))
    await p.close()
  }

  /* ============ B. satu berkas diputus: harus disebut namanya ============ */
  console.log('\n— Satu berkas aplikasi hilang: disebut namanya —')
  {
    const ctx = await browser.createBrowserContext()
    const p = await ctx.newPage()
    await bukaPengaturan(p)

    /*
     * Putuskan SETELAH aplikasi hidup. Kalau diputus sejak awal,
     * aplikasinya tidak pernah berjalan dan yang tampil justru panel
     * darurat — keadaan lain yang sudah diuji tersendiri.
     */
    await p.setRequestInterception(true)
    p.on('request', (r) => {
      if (r.method() === 'HEAD' && /assets\/index-[A-Za-z0-9_-]+\.js$/.test(r.url())) {
        return r.abort()
      }
      return r.continue()
    })

    await p.click('[data-testid="tombol-periksa-situs"]')
    let aset = ''
    for (let i = 0; i < 30; i += 1) {
      await wait(300)
      aset = await isi(p, 'hasil-periksa-aset')
      if (/TIDAK ADA/.test(aset)) break
    }
    cek('B: berkas yang hilang dilaporkan', /TIDAK ADA/.test(aset), aset.slice(0, 160))
    cek('B: dan MENYEBUT berkas mana yang hilang',
      /assets\/index-[A-Za-z0-9_-]+\.js/.test(aset), aset.slice(0, 200))
    cek('B: sarannya menyebut bahwa unggahannya harus seluruh folder',
      /SELURUH folder|penggantian/.test(aset), aset.slice(0, 300))
    await p.close()
    await ctx.close()
  }
} finally {
  await browser.close()
}

console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) {
  for (const g of gagal) console.log('  ✗ ' + g)
  process.exitCode = 1
}
