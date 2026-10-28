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
  cek('0: pratinjau lapangan langsung hadir di FieldConfigEditor', await ada(p, 'pratinjau-lapangan-editor'))

  /* ------- 0b. #9 — toggle satuan yard/meter/langkah, pratinjau langsung, & Tanpa patok ------- */
  {
    // Pastikan mulai dari preset DCI standar (100 x 53,33 yd, langkah 8-to-5 = 0,625 yd)
    await p.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'DCI / kampus')
      btn?.click()
    })
    await wait(400)
    cek('0b: panjang awal DCI = 100 yard', (await nilai(p, 'kolom-panjang')) === '100', await nilai(p, 'kolom-panjang'))
    cek('0b: grid awal DCI = 5 yard', (await nilai(p, 'kolom-grid-jarak')) === '5', await nilai(p, 'kolom-grid-jarak'))

    // Ganti ke meter -> 100 yd ≈ 91.44 m, grid 5 yd ≈ 4.57 m
    await p.click('[data-testid="satuan-m"]')
    await wait(300)
    cek('0b: satuan meter menampilkan panjang 91.44 m', (await nilai(p, 'kolom-panjang')) === '91.44', await nilai(p, 'kolom-panjang'))
    cek('0b: satuan meter menampilkan grid 4.57 m', (await nilai(p, 'kolom-grid-jarak')) === '4.57', await nilai(p, 'kolom-grid-jarak'))

    // Ganti ke langkah -> pada 8-to-5, 100 yd = 160 langkah, grid 5 yd = 8 langkah
    await p.click('[data-testid="satuan-langkah"]')
    await wait(300)
    cek('0b: satuan langkah menampilkan panjang 160 langkah', (await nilai(p, 'kolom-panjang')) === '160', await nilai(p, 'kolom-panjang'))
    cek('0b: satuan langkah menampilkan grid 8 langkah', (await nilai(p, 'kolom-grid-jarak')) === '8', await nilai(p, 'kolom-grid-jarak'))

    // Kembali ke yard -> kembali tepat 100 yd & 5 yd tanpa pergeseran geometri
    await p.click('[data-testid="satuan-yd"]')
    await wait(300)
    cek('0b: kembali ke yard tetap tepat 100 yd tanpa geser geometri', (await nilai(p, 'kolom-panjang')) === '100', await nilai(p, 'kolom-panjang'))
    cek('0b: kembali ke yard tetap tepat grid 5 yd', (await nilai(p, 'kolom-grid-jarak')) === '5', await nilai(p, 'kolom-grid-jarak'))

    // Pratinjau SVG memakai hex murni (tanpa oklch/rgba/color-mix) & 5 titik contoh ikut skala titik
    const auditSvg = await p.evaluate(() => {
      const svg = document.querySelector('[data-testid="svg-pratinjau-lapangan"]')
      if (!svg) return null
      const els = [...svg.querySelectorAll('*')]
      const warna = els
        .flatMap((el) => [el.getAttribute('fill'), el.getAttribute('stroke')])
        .filter((v) => v && v !== 'none')
      const nonHex = warna.filter((v) => !/^#[0-9a-fA-F]{6}$/.test(v))
      const titik = [...svg.querySelectorAll('circle[data-pratinjau-titik="1"]')]
      const garis = svg.querySelectorAll('[data-pratinjau-lap="garis"]').length
      return {
        nonHex,
        jmlTitik: titik.length,
        r0: Number(titik[0]?.getAttribute('r') || 0),
        garis,
      }
    })
    cek('0c: seluruh warna SVG pratinjau murni hex #rrggbb (aman cetak/portabel)',
      !!auditSvg && auditSvg.nonHex.length === 0, JSON.stringify(auditSvg?.nonHex))
    cek('0c: pratinjau menampilkan 5 titik contoh dan 21 garis grid utama',
      auditSvg?.jmlTitik === 5 && auditSvg?.garis === 21, JSON.stringify(auditSvg))

    // Ubah ukuran titik pemain ke 150% -> radius titik pratinjau langsung membesar
    await p.select('[data-testid="pilih-ukuran-titik"]', '1.5')
    await wait(300)
    const rBesar = await p.evaluate(() =>
      Number(document.querySelector('circle[data-pratinjau-titik="1"]')?.getAttribute('r') || 0),
    )
    cek('0c: titik contoh di pratinjau langsung membesar saat ukuran titik diubah ke 150%',
      rBesar > (auditSvg?.r0 ?? 0) * 1.4, `${auditSvg?.r0} -> ${rBesar}`)

    // Ubah warna garis grid ke emas (#fde047) & jarak grid kustom ke 10 yd -> 11 garis + subgrid aktif
    await p.select('[data-testid="pilih-warna-grid"]', 'emas')
    await isiKolom(p, 'kolom-grid-jarak', '10')
    await p.select('[data-testid="pilih-subgrid-tampil"]', '1')
    await wait(400)
    const setelahKustom = await p.evaluate(() => {
      const svg = document.querySelector('[data-testid="svg-pratinjau-lapangan"]')
      const garisEls = [...(svg?.querySelectorAll('[data-pratinjau-lap="garis"]') ?? [])]
      const subEls = [...(svg?.querySelectorAll('[data-pratinjau-lap="subgrid"]') ?? [])]
      const info = document.querySelector('[data-testid="info-jumlah-garis-grid"]')?.textContent ?? ''
      return {
        jmlGaris: garisEls.length,
        stroke: garisEls[0]?.getAttribute('stroke') ?? '',
        jmlSub: subEls.length,
        info,
      }
    })
    cek('0d: jarak grid kustom 10 yd langsung memperbarui pratinjau menjadi 11 garis emas (#fde047)',
      setelahKustom.jmlGaris === 11 && setelahKustom.stroke === '#fde047' && setelahKustom.info.includes('11 garis grid'),
      JSON.stringify(setelahKustom))
    cek('0d: mengaktifkan subgrid menampilkan garis subgrid di pratinjau',
      setelahKustom.jmlSub > 0, String(setelahKustom.jmlSub))

    // Uji preset Indoor / GOR (patok aktif) lalu klik opsi cepat "Tanpa patok (indoor kecil)" & preset "Indoor tanpa patok"
    await p.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Indoor / GOR')
      btn?.click()
    })
    await wait(350)
    const adaPatokIndoor = await p.evaluate(
      () => document.querySelectorAll('[data-pratinjau-lap="patok"]').length > 0,
    )
    cek('0e: preset Indoor / GOR menyalakan patok di pratinjau', adaPatokIndoor)

    await p.click('[data-testid="opsi-tanpa-patok"]')
    await wait(350)
    const setelahTanpaPatok = await p.evaluate(() => ({
      patokDom: document.querySelectorAll('[data-pratinjau-lap="patok"]').length,
      garisDom: document.querySelectorAll('[data-pratinjau-lap="garis"]').length,
      info: document.querySelector('[data-testid="info-jumlah-garis-grid"]')?.textContent ?? '',
    }))
    cek('0e: tombol cepat "Tanpa patok" mematikan patok namun menjaga garis grid tetap utuh',
      setelahTanpaPatok.patokDom === 0 && setelahTanpaPatok.garisDom > 0 && setelahTanpaPatok.info.includes('Tanpa patok'),
      JSON.stringify(setelahTanpaPatok))

    await p.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Indoor tanpa patok')
      btn?.click()
    })
    await wait(350)
    const indoorPolos = await p.evaluate(() => ({
      panjang: document.querySelector('[data-testid="kolom-panjang"]')?.value,
      lebar: document.querySelector('[data-testid="kolom-lebar"]')?.value,
      grid: document.querySelector('[data-testid="kolom-grid-jarak"]')?.value,
      garisDom: document.querySelectorAll('[data-pratinjau-lap="garis"]').length,
      patokDom: document.querySelectorAll('[data-pratinjau-lap="patok"]').length,
    }))
    cek('0e: preset "Indoor tanpa patok" mengatur 40 × 20 m, grid 2 m (21 garis), tanpa patok',
      indoorPolos.panjang === '40' && indoorPolos.lebar === '20' && indoorPolos.grid === '2' &&
      indoorPolos.garisDom === 21 && indoorPolos.patokDom === 0,
      JSON.stringify(indoorPolos))

    // Kembalikan ke DCI standar sebelum lanjut ke uji batas N16 di bawah
    await p.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'DCI / kampus')
      btn?.click()
    })
    await wait(350)
  }

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
