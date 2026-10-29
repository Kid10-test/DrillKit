/**
 * Uji #12 — Polesan cepat v1.0.1:
 *   - #12a: Pemangkasan bundel JS awal (< 420 kB), pemisahan malas
 *           `PratinjauBerkasModal`, `bukaBerkas`, `Panduan`, dan `seed`,
 *           tanpa mengunduh modul berat saat Dashboard pertama dibuka.
 *   - #12b: Navigasi bawah HP mode pelatih (4 menu utama + laci "Lainnya"
 *           bebas geser horizontal di 360px, target sentuh >= 44px di laci,
 *           tetap ringkas <= 2 tautan di mode anggota), serta pengaitan
 *           `<label for>` otomatis pada `<Field>` dan `aria-label` tombol tutup Modal.
 *   - #12d: Konfigurasi CI `.github/workflows/ci.yml` memakai runtime Node 24
 *           (`actions/checkout@v5`, `actions/setup-node@v5`) dan `paths-ignore`
 *           untuk berkas dokumentasi `**.md`.
 */
import puppeteer from 'puppeteer'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { AKAR, DIST } from './lokasi.mjs'
import { lewatSambutan } from './sambutan.mjs'

const BASE = process.env.BASE || 'http://localhost:4173'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

let lulus = 0
const gagal = []
function cek(nama, ok, ket = '') {
  if (ok) {
    lulus++
    console.log('  ✓ ' + nama)
  } else {
    gagal.push(nama + (ket ? ' — ' + ket : ''))
    console.log('  ✗ ' + nama + (ket ? ' → ' + ket : ''))
  }
}

/* ---------------- 1. Audit bundel hasil build (#12a) & CI (#12d) --------- */
const dirAset = path.join(DIST, 'assets')
const daftarAset = fs.existsSync(dirAset) ? fs.readdirSync(dirAset) : []
const berkasIndex = daftarAset.find((f) => /^index-.*\.js$/.test(f))
const ukuranIndexKb = berkasIndex ? fs.statSync(path.join(dirAset, berkasIndex)).size / 1024 : 9999

cek(
  '12a: berkas JS utama ada dan terpangkas di bawah 420 KB (sebelumnya ~538 KB)',
  Boolean(berkasIndex) && ukuranIndexKb > 100 && ukuranIndexKb < 420,
  `${berkasIndex ?? 'tidak-ada'} = ${ukuranIndexKb.toFixed(1)} KB`,
)
cek(
  '12a: PratinjauBerkasModal terpisah jadi chunk malas sendiri',
  daftarAset.some((f) => /^PratinjauBerkasModal-.*\.js$/.test(f)),
)
cek(
  '12a: pengurai bukaBerkas terpisah jadi chunk malas sendiri',
  daftarAset.some((f) => /^bukaBerkas-.*\.js$/.test(f)),
)
cek(
  '12a: modul Panduan (+ qrcode) terpisah jadi chunk malas sendiri',
  daftarAset.some((f) => /^Panduan-.*\.js$/.test(f)),
)
cek(
  '12a: modul data contoh (seed) terpisah jadi chunk malas sendiri',
  daftarAset.some((f) => /^seed-.*\.js$/.test(f)),
)

const ciYml = fs.readFileSync(path.join(AKAR, '.github', 'workflows', 'ci.yml'), 'utf8')
cek('12d: CI memakai actions/checkout@v5 (Node 24)', /actions\/checkout@v5/.test(ciYml))
cek('12d: CI memakai actions/setup-node@v5 (Node 24)', /actions\/setup-node@v5/.test(ciYml))
cek(
  '12d: CI mengabaikan perubahan murni dokumentasi (paths-ignore **.md)',
  (ciYml.match(/paths-ignore:/g) ?? []).length >= 2 && /\*\*\.md/.test(ciYml),
)

/* --------- 2. Uji peramban: pemuatan malas, laci HP, & aksesibilitas ----- */
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dk-v101-'))
const berkasUji = path.join(tmpDir, 'acak.json')
fs.writeFileSync(berkasUji, JSON.stringify({ bukanDrillKit: true }))

const browser = await puppeteer.launch({
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  defaultViewport: { width: 1280, height: 860 },
})
const errors = []

try {
  const p = await browser.newPage()
  const skripDimuat = new Set()
  p.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  p.on('pageerror', (e) => errors.push(String(e)))
  p.on('response', (res) => {
    const u = res.url()
    if (u.endsWith('.js')) skripDimuat.add(u.split('/').pop() ?? u)
  })

  await p.goto(BASE, { waitUntil: 'networkidle2' })
  await wait(800)
  await lewatSambutan(p)
  await wait(1000)

  const muatAwal = [...skripDimuat]
  cek(
    '12a: saat Dashboard pertama tampil, bukaBerkas & OSMD belum diunduh',
    !muatAwal.some((f) => /^(bukaBerkas|PratinjauBerkasModal|opensheetmusicdisplay)/.test(f)),
    muatAwal.join(', '),
  )

  // Unggah berkas di Dashboard -> chunk malas dimuat & modal pratinjau tampil
  const inputDasbor = await p.$('[data-testid="buka-berkas-dasbor-input"]')
  if (!inputDasbor) {
    // Saat belum ada anggota, muat data contoh dulu supaya kartu buka berkas dasbor tampil
    await p.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) =>
        /Muat data contoh/i.test(x.textContent ?? ''),
      )
      b?.click()
    })
    await wait(2000)
  }
  const inputAktif = await p.$('[data-testid="buka-berkas-dasbor-input"]')
  cek('12a: input buka berkas tersedia di Dashboard', Boolean(inputAktif))
  if (inputAktif) {
    await inputAktif.uploadFile(berkasUji)
    await p.waitForSelector('[data-testid="modal-buka-berkas"]', { timeout: 8000 })
    await wait(500)
    const teksModal = await p.$eval('[data-testid="modal-buka-berkas"]', (el) => el.textContent ?? '')
    cek(
      '12a: pratinjau malas tampil utuh saat berkas dipilih',
      /Tidak dikenal|tidak dikenali/i.test(teksModal),
      teksModal.slice(0, 120),
    )
    const btnTutupIkon = await p.$eval(
      '[data-testid="modal-buka-berkas"] button[aria-label="Tutup"]',
      (el) => el.getAttribute('aria-label'),
    )
    cek('12b: tombol silang Modal memiliki aria-label="Tutup"', btnTutupIkon === 'Tutup')
    await p.click('[data-testid="buka-tutup"]')
    await wait(400)
  }

  // Uji navigasi bawah HP 360x800 (4 menu utama + laci Lainnya)
  await p.setViewport({ width: 360, height: 800, isMobile: true, hasTouch: true })
  await wait(500)

  const infoNavHp = await p.evaluate(() => {
    const nav = document.querySelector('[data-testid="nav-bawah-hp"]')
    if (!nav) return null
    const baris = nav.firstElementChild
    const tautan = [...nav.querySelectorAll('a')].map((a) => a.textContent?.trim() ?? '')
    const btnLain = nav.querySelector('[data-testid="tombol-menu-lainnya"]')
    const rLain = btnLain?.getBoundingClientRect()
    return {
      overflowBar: baris ? baris.scrollWidth - baris.clientWidth : 999,
      overflowDok: document.documentElement.scrollWidth - window.innerWidth,
      tautan,
      adaLainnya: Boolean(btnLain),
      expanded: btnLain?.getAttribute('aria-expanded'),
      tinggiLainnya: rLain ? Math.round(rLain.height) : 0,
    }
  })

  cek('12b: nav bawah HP pelatih tampil', Boolean(infoNavHp))
  cek(
    '12b: nav bawah HP tidak perlu geser horizontal di layar 360px',
    (infoNavHp?.overflowBar ?? 99) <= 1 && (infoNavHp?.overflowDok ?? 99) <= 1,
    JSON.stringify(infoNavHp),
  )
  cek(
    '12b: nav bawah HP menampilkan tepat 4 menu utama + tombol Lainnya',
    infoNavHp?.tautan.length === 4 && infoNavHp?.adaLainnya === true,
    JSON.stringify(infoNavHp?.tautan),
  )
  cek(
    '12b: tombol Lainnya bertinggi nyaman (>= 48px) & aria-expanded="false"',
    (infoNavHp?.tinggiLainnya ?? 0) >= 48 && infoNavHp?.expanded === 'false',
    `h=${infoNavHp?.tinggiLainnya}, exp=${infoNavHp?.expanded}`,
  )

  // Buka laci Lainnya
  await p.click('[data-testid="tombol-menu-lainnya"]')
  await wait(350)
  const infoLaci = await p.evaluate(() => {
    const laci = document.querySelector('[data-testid="laci-menu-lainnya"]')
    const btnLain = document.querySelector('[data-testid="tombol-menu-lainnya"]')
    if (!laci) return null
    const item = [...laci.querySelectorAll('a')]
    const minTinggi = Math.min(...item.map((a) => Math.round(a.getBoundingClientRect().height)))
    return {
      expanded: btnLain?.getAttribute('aria-expanded'),
      jmlItem: item.length,
      labelItem: item.map((a) => a.textContent?.trim() ?? ''),
      minTinggi,
    }
  })
  cek(
    '12b: laci Lainnya menampilkan 7 menu sekunder pelatih dengan tinggi >= 44px',
    infoLaci?.expanded === 'true' && infoLaci?.jmlItem === 7 && (infoLaci?.minTinggi ?? 0) >= 44,
    JSON.stringify(infoLaci),
  )

  // Klik Pengaturan dari dalam laci -> pindah rute, laci menutup otomatis, tombol Lainnya menampilkan "Setelan"
  await p.evaluate(() => {
    const a = [...document.querySelectorAll('[data-testid="laci-menu-lainnya"] a')].find((el) =>
      /Pengaturan/.test(el.textContent ?? ''),
    )
    a?.click()
  })
  await wait(800)

  const sesudahPindah = await p.evaluate(() => {
    const laciMasihAda = Boolean(document.querySelector('[data-testid="laci-menu-lainnya"]'))
    const teksTombolLain =
      document.querySelector('[data-testid="tombol-menu-lainnya"]')?.textContent?.trim() ?? ''
    // Cek bahwa <Input> di dalam <Field> pada Pengaturan kini terhubung ke <label for="...">
    const inputBerlabel = [...document.querySelectorAll('input[id]')]
      .filter((el) => el.offsetParent !== null)
      .filter((el) => document.querySelector(`label[for="${CSS.escape(el.id)}"]`) != null).length
    return { hash: location.hash, laciMasihAda, teksTombolLain, inputBerlabel }
  })
  cek(
    '12b: memilih menu di laci memindahkan rute & menutup laci otomatis',
    sesudahPindah.hash === '#/pengaturan' && !sesudahPindah.laciMasihAda,
    JSON.stringify(sesudahPindah),
  )
  cek(
    '12b: tombol Lainnya menampilkan nama pendek rute sekunder aktif ("Setelan")',
    sesudahPindah.teksTombolLain === 'Setelan',
    sesudahPindah.teksTombolLain,
  )
  cek(
    '12b: komponen Field otomatis mengaitkan <label for> ke <input id>',
    sesudahPindah.inputBerlabel >= 3,
    `inputBerlabel=${sesudahPindah.inputBerlabel}`,
  )

  // Pastikan di Mode Anggota tombol Lainnya tidak muncul dan jumlah tautan nav <= 2
  await p.evaluate(() => localStorage.setItem('drillkit.mode', 'member'))
  await p.goto(`${BASE}/#/berbagi`, { waitUntil: 'networkidle2' })
  await p.reload({ waitUntil: 'networkidle2' })
  await wait(1200)
  const navAnggota = await p.evaluate(() => ({
    jmlTautanNav: document.querySelectorAll('nav a[href^="#/"]').length,
    adaLainnya: Boolean(document.querySelector('[data-testid="tombol-menu-lainnya"]')),
  }))
  cek(
    '12b: Mode Anggota tetap bersih (<= 2 tautan nav, tanpa tombol Lainnya pelatih)',
    navAnggota.jmlTautanNav > 0 && navAnggota.jmlTautanNav <= 2 && !navAnggota.adaLainnya,
    JSON.stringify(navAnggota),
  )
  await p.evaluate(() => localStorage.setItem('drillkit.mode', 'coach'))
} finally {
  await browser.close()
  fs.rmSync(tmpDir, { recursive: true, force: true })
}

cek('0 galat konsol / pageerror selama uji v1.0.1', errors.length === 0, errors.slice(0, 3).join(' | '))

console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) {
  console.log('\nYang gagal:')
  for (const g of gagal) console.log('  ✗ ' + g)
  process.exit(1)
}
