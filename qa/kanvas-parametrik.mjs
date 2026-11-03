/**
 * #22 — Uji E2E Puppeteer Kanvas Parametrik Hidup (Persistent Bézier Shapes),
 * Seleksi Lasso Poligon Bebas, Gagang Stretch/Rotate Kotak Seleksi,
 * Inspektor Transformasi Terpadu (tanpa tumpang tindih), & Kunci Sumbu X/Y.
 */
import puppeteer from 'puppeteer'
import { lewatSambutan } from './sambutan.mjs'

const BASE = process.env.BASE || 'http://localhost:4173'
const tunggu = (ms) => new Promise((r) => setTimeout(r, ms))

let lulus = 0
let gagal = 0
function cek(kondisi, pesan) {
  if (kondisi) {
    lulus += 1
    console.log(`  ✓ ${pesan}`)
  } else {
    gagal += 1
    console.error(`  ✗ GAGAL: ${pesan}`)
  }
}

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
})

try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 960 })
  const galat = []
  page.on('pageerror', (e) => galat.push(e.message))

  await page.goto(BASE, { waitUntil: 'networkidle0' })
  await lewatSambutan(page)
  await tunggu(600)

  const adaContoh = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) =>
      /Muat data contoh/i.test(b.textContent || ''),
    )
    if (btn) {
      btn.click()
      return true
    }
    return false
  })
  if (adaContoh) await tunggu(2200)

  await page.evaluate(() => {
    location.hash = '#/drill'
  })
  await page.waitForSelector('[data-testid="kartu-alat-formasi"]', { timeout: 15000 })
  await tunggu(500)

  /* ---- 1. Audit Anti-Overlap: Panel Lama Dihapus, Panel Terpadu Hadir ---- */
  const auditUi = await page.evaluate(() => {
    const labels = [...document.querySelectorAll('label')].map((l) => (l.textContent || '').trim())
    return {
      adaSusunPilihanKembar: labels.includes('Susun pilihan'),
      adaBentukCepatLama: labels.includes('Bentuk cepat'),
      adaGeserBlokLama: labels.some((l) => l.includes('Geser blok')),
      adaInspektorTerpadu: Boolean(document.querySelector('[data-testid="panel-inspektor-transformasi"]')),
      adaAlatLasso: Boolean(document.querySelector('[data-testid="alat-lasso"]')),
      adaKunciSumbu: Boolean(document.querySelector('[data-testid="panel-kunci-sumbu"]')),
      adaSnapXY:
        Boolean(document.querySelector('[data-testid="pilih-snap-x"]')) &&
        Boolean(document.querySelector('[data-testid="pilih-snap-y"]')),
    }
  })
  cek(
    !auditUi.adaSusunPilihanKembar && !auditUi.adaBentukCepatLama && !auditUi.adaGeserBlokLama,
    'Panel kembar lama (Bentuk cepat 4 tombol, Susun pilihan, & Geser blok) sudah dipensiunkan bersih tanpa tumpang tindih',
  )
  cek(
    auditUi.adaInspektorTerpadu && auditUi.adaAlatLasso && auditUi.adaKunciSumbu && auditUi.adaSnapXY,
    'Inspektor seleksi terpadu, alat Lasso, pengunci sumbu X/Y, dan pembulatan langkah X/Y mandiri tampil lengkap',
  )

  /* ---- 2. Bentuk Parametrik Hidup (Kurva-S Bézier) + Tarik Gagang + Lepas Otomatis ---- */
  await page.select('[data-testid="pilih-jenis-bentuk"]', 'kurva_s')
  await tunggu(150)
  await page.click('[data-testid="terapkan-bentuk-cepat"]')
  await tunggu(500)

  const infoBentuk = await page.evaluate(() => {
    const garis = document.querySelector('[data-testid^="garis-bentuk-"]')
    const id = garis ? (garis.getAttribute('data-testid') || '').replace('garis-bentuk-', '') : ''
    return {
      id,
      adaPanelTerikat: Boolean(document.querySelector('[data-testid="panel-bentuk-terikat"]')),
      adaP0: Boolean(document.querySelector(`[data-testid="gagang-bentuk-${id}-p0"]`)),
      adaP1: Boolean(document.querySelector(`[data-testid="gagang-bentuk-${id}-p1"]`)),
      adaC1: Boolean(document.querySelector(`[data-testid="gagang-bentuk-${id}-c1"]`)),
      adaC2: Boolean(document.querySelector(`[data-testid="gagang-bentuk-${id}-c2"]`)),
      teksKartu: document.querySelector(`[data-testid="kartu-bentuk-terikat-${id}"]`)?.textContent || '',
    }
  })
  cek(
    Boolean(infoBentuk.id) &&
      infoBentuk.adaPanelTerikat &&
      infoBentuk.adaP0 &&
      infoBentuk.adaP1 &&
      infoBentuk.adaC1 &&
      infoBentuk.adaC2,
    'Menerapkan Kurva-S mengikat pemain ke BentukTerikat hidup lengkap dengan garis tulang punggung & 4 gagang (P0, P1, C1, C2)',
  )

  // Tarik gagang C1 di kanvas SVG dan pastikan koordinat titik pemain ikut berubah mulus
  await page.evaluate((id) => {
    document.querySelector(`[data-testid="gagang-bentuk-${id}-c1"]`)?.scrollIntoView({ block: 'center' })
  }, infoBentuk.id)
  await tunggu(200)

  const koorSebelumC1 = await page.evaluate(() =>
    [...document.querySelectorAll('svg circle[data-titik="1"]')].map((c) => [
      Number(c.getAttribute('cx')),
      Number(c.getAttribute('cy')),
    ]),
  )
  const kotakC1 = await page.evaluate((id) => {
    const el = document.querySelector(`[data-testid="gagang-bentuk-${id}-c1"]`)
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
  }, infoBentuk.id)

  await page.mouse.move(kotakC1.x, kotakC1.y)
  await page.mouse.down()
  await page.mouse.move(kotakC1.x, kotakC1.y - 48, { steps: 8 })
  await page.mouse.up()
  await tunggu(400)

  const koorSesudahC1 = await page.evaluate(() =>
    [...document.querySelectorAll('svg circle[data-titik="1"]')].map((c) => [
      Number(c.getAttribute('cx')),
      Number(c.getAttribute('cy')),
    ]),
  )
  const jmlBerubahC1 = koorSebelumC1.filter(
    (q, i) => Math.hypot(q[0] - koorSesudahC1[i][0], q[1] - koorSesudahC1[i][1]) > 0.25,
  ).length
  cek(
    jmlBerubahC1 >= 2,
    `Menarik gagang Bézier C1 di kanvas mendistribusikan ulang ${jmlBerubahC1} titik pemain sepanjang kurva baru`,
  )

  // Salin bentuk hidup ke Set 2, lalu geser 1 pemain manual di Set 1 → otomatis lepas dari ikatan
  await page.click(`[data-testid="bentuk-salin-berikut-${infoBentuk.id}"]`)
  await tunggu(450)

  const jmlAnggotaSebelumLepas = await page.evaluate((id) => {
    const teks = document.querySelector(`[data-testid="kartu-bentuk-terikat-${id}"]`)?.textContent || ''
    const m = /(\d+)\s*ttk/.exec(teks)
    return m ? Number(m[1]) : 0
  }, infoBentuk.id)

  await page.evaluate(() => {
    document.querySelector('svg circle[data-titik="1"]')?.scrollIntoView({ block: 'center' })
  })
  await tunggu(200)
  const titikPertama = await page.evaluate(() => {
    const c = document.querySelector('svg circle[data-titik="1"]')
    const r = c.getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
  })
  await page.mouse.move(titikPertama.x, titikPertama.y)
  await page.mouse.down()
  await page.mouse.move(titikPertama.x + 36, titikPertama.y + 28, { steps: 6 })
  await page.mouse.up()
  await tunggu(450)

  const jmlAnggotaSesudahLepas = await page.evaluate((id) => {
    const teks = document.querySelector(`[data-testid="kartu-bentuk-terikat-${id}"]`)?.textContent || ''
    const m = /(\d+)\s*ttk/.exec(teks)
    return m ? Number(m[1]) : 0
  }, infoBentuk.id)
  cek(
    jmlAnggotaSebelumLepas >= 4 && jmlAnggotaSesudahLepas === jmlAnggotaSebelumLepas - 1,
    `Menggeser 1 pemain secara mandiri otomatis melepasnya dari BentukTerikat (${jmlAnggotaSebelumLepas} → ${jmlAnggotaSesudahLepas} ttk)`,
  )

  // Pastikan salinan bentuk hidup hadir di Set 2
  await page.keyboard.press('BracketRight')
  await tunggu(450)
  const adaBentukSet2 = await page.evaluate(
    () => document.querySelectorAll('[data-testid^="kartu-bentuk-terikat-"]').length > 0,
  )
  cek(adaBentukSet2, 'Menyalin bentuk hidup ke set berikutnya menghadirkan BentukTerikat mandiri pada Set 2')
  await page.keyboard.press('BracketLeft')
  await tunggu(350)

  /* ---- 3. Seleksi Lasso Poligon Bebas di Kanvas ---- */
  await page.keyboard.press('Escape')
  await tunggu(150)
  await page.click('[data-testid="alat-lasso"]')
  await tunggu(150)

  const areaLasso = await page.evaluate(() => {
    const circles = [...document.querySelectorAll('svg circle[data-titik="1"]')].slice(0, 3)
    const boxes = circles.map((c) => {
      const r = c.getBoundingClientRect()
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
    })
    const minX = Math.min(...boxes.map((b) => b.x)) - 22
    const maxX = Math.max(...boxes.map((b) => b.x)) + 22
    const minY = Math.min(...boxes.map((b) => b.y)) - 22
    const maxY = Math.max(...boxes.map((b) => b.y)) + 22
    return { minX, maxX, minY, maxY }
  })

  await page.mouse.move(areaLasso.minX, areaLasso.minY)
  await page.mouse.down()
  await page.mouse.move(areaLasso.maxX, areaLasso.minY, { steps: 5 })
  await page.mouse.move(areaLasso.maxX, areaLasso.maxY, { steps: 5 })
  await page.mouse.move(areaLasso.minX, areaLasso.maxY, { steps: 5 })
  await page.mouse.move(areaLasso.minX, areaLasso.minY, { steps: 5 })
  await page.mouse.up()
  await tunggu(350)

  const hasilLasso = await page.evaluate(() => ({
    teksSel: document.querySelector('[data-selcount]')?.textContent || '',
    adaKotakSeleksi: Boolean(document.querySelector('[data-testid="kotak-seleksi-kanvas"]')),
    adaGagangSkalaW: Boolean(document.querySelector('[data-testid="gagang-skala-w"]')),
    adaGagangPutar: Boolean(document.querySelector('[data-testid="gagang-putar-bebas"]')),
  }))
  cek(
    /\d+\s+titik dipilih/.test(hasilLasso.teksSel) &&
      hasilLasso.adaKotakSeleksi &&
      hasilLasso.adaGagangSkalaW &&
      hasilLasso.adaGagangPutar,
    `Alat Lasso poligon bebas memilih titik di dalam poligon (${hasilLasso.teksSel.split('—')[0].trim()}) & memunculkan kotak batas Stretch/Rotate`,
  )

  /* ---- 4. Gagang Stretch/Squeeze, Gagang Putar Bebas, & Cermin Poros Pilihan ---- */
  await page.click('[data-testid="alat-select"]')
  await page.click('[data-testid="inspektor-pilih-semua"]')
  await tunggu(250)
  await page.evaluate(() => {
    document.querySelector('[data-testid="kotak-seleksi-kanvas"]')?.scrollIntoView({ block: 'center' })
  })
  await tunggu(200)

  const rentangAwal = await page.evaluate(() => {
    const xs = [...document.querySelectorAll('svg circle[data-titik="1"]')].map((c) =>
      Number(c.getAttribute('cx')),
    )
    const gagangW = document.querySelector('[data-testid="gagang-skala-w"]').getBoundingClientRect()
    return {
      lebarSvg: Math.max(...xs) - Math.min(...xs),
      kananMaks: Math.max(...xs),
      gx: gagangW.left + gagangW.width / 2,
      gy: gagangW.top + gagangW.height / 2,
    }
  })

  await page.mouse.move(rentangAwal.gx, rentangAwal.gy)
  await page.mouse.down()
  await page.mouse.move(rentangAwal.gx - 45, rentangAwal.gy, { steps: 8 })
  await page.mouse.up()
  await tunggu(350)

  const rentangAkhir = await page.evaluate(() => {
    const xs = [...document.querySelectorAll('svg circle[data-titik="1"]')].map((c) =>
      Number(c.getAttribute('cx')),
    )
    return {
      lebarSvg: Math.max(...xs) - Math.min(...xs),
      kananMaks: Math.max(...xs),
    }
  })
  cek(
    rentangAkhir.lebarSvg > rentangAwal.lebarSvg + 1 &&
      Math.abs(rentangAkhir.kananMaks - rentangAwal.kananMaks) < 1.2,
    'Menarik gagang skala kiri (w) merentangkan lebar formasi sambil menjaga sisi jangkar kanan tetap',
  )

  // Tarik gagang putar bebas di atas kotak seleksi
  const gagangPutarBox = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="gagang-putar-bebas"]')
    const r = el.getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
  })
  const sebelumPutarBebas = await page.evaluate(() =>
    [...document.querySelectorAll('svg circle[data-titik="1"]')].map((c) => [
      Number(c.getAttribute('cx')),
      Number(c.getAttribute('cy')),
    ]),
  )
  await page.mouse.move(gagangPutarBox.x, gagangPutarBox.y)
  await page.mouse.down()
  await page.mouse.move(gagangPutarBox.x + 55, gagangPutarBox.y + 25, { steps: 8 })
  await page.mouse.up()
  await tunggu(350)
  const sesudahPutarBebas = await page.evaluate(() =>
    [...document.querySelectorAll('svg circle[data-titik="1"]')].map((c) => [
      Number(c.getAttribute('cx')),
      Number(c.getAttribute('cy')),
    ]),
  )
  const berubahPutar = sebelumPutarBebas.some(
    (q, i) => Math.hypot(q[0] - sesudahPutarBebas[i][0], q[1] - sesudahPutarBebas[i][1]) > 0.4,
  )
  cek(berubahPutar, 'Menarik gagang tangkai putar bebas memutar formasi terpilih secara interaktif di kanvas')

  // Cermin berporos Tengah Pilihan
  await page.select('[data-testid="pilih-poros-cermin"]', 'pilihan')
  await tunggu(100)
  const pusatSebelumCermin = await page.evaluate(() => {
    const cs = [...document.querySelectorAll('svg circle[data-titik="1"]')]
    const xs = cs.map((c) => Number(c.getAttribute('cx')))
    return (Math.min(...xs) + Math.max(...xs)) / 2
  })
  await page.click('[data-testid="cermin-blok-x"]')
  await tunggu(300)
  const pusatSesudahCermin = await page.evaluate(() => {
    const cs = [...document.querySelectorAll('svg circle[data-titik="1"]')]
    const xs = cs.map((c) => Number(c.getAttribute('cx')))
    return (Math.min(...xs) + Math.max(...xs)) / 2
  })
  cek(
    Math.abs(pusatSesudahCermin - pusatSebelumCermin) < 0.05,
    'Cermin terpadu dengan poros "Tengah Pilihan" membalik blok tepat di tempat tanpa menggeser pusatnya',
  )

  /* ---- 5. Pengunci Sumbu Gerak (Axis Lock X & Y) & Kemurnian Warna SVG Hex ---- */
  await page.keyboard.press('Escape')
  await tunggu(150)
  await page.select('[data-testid="pilih-snap-x"]', '0.5')
  await page.select('[data-testid="pilih-snap-y"]', '0.25')
  await page.click('[data-testid="kunci-sumbu-x"]')
  await tunggu(150)

  const satuTitik = await page.evaluate(() => {
    const c = document.querySelector('svg circle[data-titik="1"]')
    const r = c.getBoundingClientRect()
    return {
      cx: Number(c.getAttribute('cx')),
      cy: Number(c.getAttribute('cy')),
      px: r.left + r.width / 2,
      py: r.top + r.height / 2,
    }
  })
  await page.mouse.move(satuTitik.px, satuTitik.py)
  await page.mouse.down()
  // Seret miring tajam (mendatar + vertikal sekaligus): Y wajib terkunci!
  await page.mouse.move(satuTitik.px + 52, satuTitik.py - 48, { steps: 8 })
  await page.mouse.up()
  await tunggu(350)

  const sesudahKunciX = await page.evaluate(() => {
    const c = document.querySelector('svg circle[data-titik="1"]')
    const r = c.getBoundingClientRect()
    return {
      cx: Number(c.getAttribute('cx')),
      cy: Number(c.getAttribute('cy')),
      px: r.left + r.width / 2,
      py: r.top + r.height / 2,
    }
  })
  cek(
    Math.abs(sesudahKunciX.cx - satuTitik.cx) > 1 && Math.abs(sesudahKunciX.cy - satuTitik.cy) < 0.01,
    `Kunci Sumbu X menahan koordinat depan-belakang tetap presisi saat diseret diagonal (Δcx=${(sesudahKunciX.cx - satuTitik.cx).toFixed(2)}, Δcy=${(sesudahKunciX.cy - satuTitik.cy).toFixed(3)})`,
  )

  await page.click('[data-testid="kunci-sumbu-y"]')
  await tunggu(150)
  await page.mouse.move(sesudahKunciX.px, sesudahKunciX.py)
  await page.mouse.down()
  await page.mouse.move(sesudahKunciX.px - 52, sesudahKunciX.py + 44, { steps: 8 })
  await page.mouse.up()
  await tunggu(350)

  const sesudahKunciY = await page.evaluate(() => {
    const c = document.querySelector('svg circle[data-titik="1"]')
    return { cx: Number(c.getAttribute('cx')), cy: Number(c.getAttribute('cy')) }
  })
  cek(
    Math.abs(sesudahKunciY.cy - sesudahKunciX.cy) > 1 &&
      Math.abs(sesudahKunciY.cx - sesudahKunciX.cx) < 0.01,
    `Kunci Sumbu Y menahan garis yard kiri-kanan tetap presisi saat diseret diagonal (Δcx=${(sesudahKunciY.cx - sesudahKunciX.cx).toFixed(3)}, Δcy=${(sesudahKunciY.cy - sesudahKunciX.cy).toFixed(2)})`,
  )

  await page.click('[data-testid="sumbu-bebas"]')

  const svgBersih = await page.evaluate(() => {
    const htmlSvg = document.querySelector('.drill-surface svg')?.outerHTML || ''
    return !/oklch\(|color-mix\(/i.test(htmlSvg)
  })
  cek(svgBersih, 'Seluruh lapisan kanvas SVG (kurva, gagang, lasso, kotak seleksi) memakai warna hex murni tanpa oklch()/color-mix()')
  cek(galat.length === 0, `Tidak ada galat halaman selama seluruh interaksi kanvas #22 (${galat.length} galat)`)
} finally {
  await browser.close()
}

console.log(`\n${lulus} lulus, ${gagal} gagal`)
process.exit(gagal > 0 ? 1 : 0)
