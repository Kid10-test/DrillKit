/**
 * N16 — uji tampilan kolom ukuran lapangan di Pengaturan.
 *
 * Mengapa perlu, padahal `stepYd` sudah dijaga di modulnya: penjagaan di
 * modul menyelamatkan **perhitungannya**, tetapi nilai yang tersimpan
 * tetap bisa berisi angka yang tidak masuk akal — dan kelak ada yang
 * membacanya tanpa penjagaan. Kolom isiannya harus menolaknya sejak
 * awal.
 *
 * Yang diuji:
 *   1. ukuran langkah tidak bisa diisi 0 atau dikosongkan;
 *   2. **end zone BOLEH 0** — itu pilihan yang sah untuk lapangan bola
 *      & indoor, dan penjagaan yang seragam akan merusaknya;
 *   3. setelah semua itu, aplikasinya tetap hidup dan tidak menampilkan
 *      NaN di mana pun.
 *
 * Pakai: BASE=http://localhost:4173 node lapangan-ui.mjs
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
const nilai = (h, id) => h.evaluate((x) => document.querySelector(`[data-testid="${x}"]`)?.value ?? '', id)

/** Kosongkan kolom lalu ketik yang baru — Ctrl+A tidak memilih isi kolom angka. */
async function isiKolom(h, id, teks) {
  const el = await h.$(`[data-testid="${id}"]`)
  await el.click({ clickCount: 3 })
  await h.evaluate((x) => document.querySelector(`[data-testid="${x}"]`)?.select?.(), id)
  await h.keyboard.down('Control')
  await h.keyboard.press('KeyA')
  await h.keyboard.up('Control')
  /*
   * Jangan tekan Backspace bila hendak mengetik: kolom kosong membuat
   * React menggambar ulang nilainya dan pilihannya hilang, sehingga
   * angka yang diketik menempel di belakang nilai lama ("00").
   * Mengetik langsung di atas pilihan justru menggantinya bersih.
   */
  if (teks === '') await h.keyboard.press('Backspace')
  else await h.keyboard.type(teks, { delay: 20 })
  await wait(500)
}

const browser = await puppeteer.launch({
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  defaultViewport: { width: 1300, height: 1000 },
})
const errors = []

try {
  const p = await browser.newPage()
  p.on('pageerror', (e) => errors.push(String(e)))
  p.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  await p.goto(BASE, { waitUntil: 'networkidle2' })
  await wait(1200)
  await lewatSambutan(p)
  await wait(1200)
  await p.goto(`${BASE}/#/pengaturan`, { waitUntil: 'networkidle2' })
  await wait(2000)

  cek('0: Pengaturan menampilkan kolom ukuran lapangan', await ada(p, 'kolom-lebar'))
  cek('0: dan pilihan ukuran langkah', await ada(p, 'pilih-step'))

  /* ------------- 1. end zone BOLEH nol — itu pilihan yang sah -------------- */
  /*
   * Ini butir yang paling mudah rusak oleh penjagaan yang seragam.
   * Lapangan bola & indoor tidak punya end zone, dan keterangan kolomnya
   * sendiri menyuruh pelatih mengisi 0.
   */
  {
    await isiKolom(p, 'kolom-endzone', '0')
    cek('1: end zone BOLEH diisi 0 (lapangan bola & indoor)',
      (await nilai(p, 'kolom-endzone')) === '0', await nilai(p, 'kolom-endzone'))
  }

  /* ------------------- 2. ukuran langkah tidak boleh nol ------------------- */
  {
    // Tampilkan dulu kolomnya: ia hanya muncul bila langkahnya "ukuran khusus".
    await p.select('[data-testid="pilih-step"]', 'custom')
    await wait(800)
    cek('2: kolom ukuran langkah muncul bila memilih ukuran khusus',
      await ada(p, 'kolom-step-khusus'))

    const mula = await nilai(p, 'kolom-step-khusus')
    cek('2: dan terisi ukuran bawaan', mula !== '' && Number(mula) > 0, mula)

    await isiKolom(p, 'kolom-step-khusus', '0')
    {
      const v = await nilai(p, 'kolom-step-khusus')
      cek('2: mengisi 0 TIDAH dibiarkan menjadi 0', v !== '0' && v !== '', `nilainya "${v}"`)
      cek('2: dan nilainya tetap angka yang bisa dipakai', Number(v) > 0, `nilainya "${v}"`)
    }

    /*
     * Yang paling berbahaya bukan mengetik 0, melainkan MENGOSONGKAN
     * kolomnya: `Number('')` adalah 0 — bukan NaN — jadi tidak pernah
     * ketahuan sebagai kesalahan.
     */
    await isiKolom(p, 'kolom-step-khusus', '')
    {
      const v = await nilai(p, 'kolom-step-khusus')
      cek('2: mengosongkan kolomnya pun tidak menghasilkan 0', v !== '0' && v !== '',
        `nilainya "${v}"`)
      cek('2: dan tidak menghasilkan NaN', Number.isFinite(Number(v)), `nilainya "${v}"`)
    }
  }

  /* --------------------- 3. lebarnya pun dijaga --------------------------- */
  {
    await isiKolom(p, 'kolom-lebar', '0')
    {
      const v = await nilai(p, 'kolom-lebar')
      cek('3: lebar lapangan tidak bisa diisi 0', v !== '0' && v !== '', `nilainya "${v}"`)
      cek('3: dan tetap angka yang bisa dipakai', Number(v) > 0, `nilainya "${v}"`)
    }
    await isiKolom(p, 'kolom-panjang', '')
    {
      const v = await nilai(p, 'kolom-panjang')
      cek('3: panjang lapangan yang dikosongkan tidak menjadi 0', Number(v) > 0, `nilainya "${v}"`)
    }
  }

  /* ------------------- 4. aplikasinya tetap hidup ------------------------- */
  {
    const teks = await p.evaluate(() => document.body.innerText)
    cek('4: tidak ada NaN di layar', !/NaN/.test(teks),
      (teks.match(/.{0,40}NaN.{0,40}/) ?? [''])[0])
    cek('4: tidak ada Infinity di layar', !/Infinity/.test(teks))
    // Halaman drill memakai koordinat paling berat — ia harus tetap terbuka.
    await p.goto(`${BASE}/#/drill`, { waitUntil: 'networkidle2' })
    await wait(2500)
    const teksDrill = await p.evaluate(() => document.body.innerText)
    cek('4: halaman drill tetap terbuka tanpa NaN', !/NaN/.test(teksDrill),
      (teksDrill.match(/.{0,40}NaN.{0,40}/) ?? [''])[0])
  }

  cek('tidak ada galat di konsol', errors.length === 0, errors.slice(0, 3).join(' | '))
} finally {
  await browser.close()
}

console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) {
  for (const g of gagal) console.log('  ✗ ' + g)
  process.exitCode = 1
}
