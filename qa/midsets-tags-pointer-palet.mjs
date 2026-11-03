/**
 * #23 (`v2.2.1`) — Uji E2E Puppeteer:
 *  - #23.1 Titik Singgah Per-Pemain (`Midsets`) langsung pada jejak biru kanvas,
 *          scrubber setengah jalan, Buku Saku kondisional (`tr.baris-midset`), & Mode Anggota
 *  - #23.2 Sistem `Tags` Lintas-Seksi Terpadu (Halaman Anggota, tag massal editor,
 *          chip pilih cepat 1-klik, warna/bentuk titik per-set, & sub-kelompok jalur ber-tag)
 *  - #23.3 Mesin Pointer Terpadu (`Otomatis / Sentuh / Tetikus`, `alat-place` lama dipensiunkan,
 *          target tangkap sentuh >= 40 px, pan 1 jari di kanvas kosong, & balon info tahan-lama)
 *  - #23.4 Palet Perintah & Pintasan Terpadu (`Ctrl+K` / `?` menggantikan modal statis lama)
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
  if (adaContoh) await tunggu(2400)

  /* ---- 1. #23.2 — Tambah Tag Lintas-Seksi di Halaman Anggota ---- */
  await page.evaluate(() => {
    location.hash = '#/anggota'
  })
  await page.waitForSelector('[data-testid="filter-tag-anggota"]', { timeout: 15000 })
  await tunggu(600)

  // Klik tombol Edit anggota pertama lalu isi kolom-tags-anggota
  const berhasilBukaModalAnggota = await page.evaluate(() => {
    const editBtn = [...document.querySelectorAll('button')].find(
      (b) => (b.textContent || '').trim() === 'Edit',
    )
    if (editBtn) {
      editBtn.click()
      return true
    }
    return false
  })
  if (berhasilBukaModalAnggota) {
    await page.waitForSelector('[data-testid="kolom-tags-anggota"]', { timeout: 6000 })
    await page.click('[data-testid="kolom-tags-anggota"]', { clickCount: 3 })
    await page.type('[data-testid="kolom-tags-anggota"]', 'Solois, Inti Pembuka')
    await page.evaluate(() => {
      const btnSimpan = [...document.querySelectorAll('button')].find(
        (b) => (b.textContent || '').trim() === 'Simpan',
      )
      btnSimpan?.click()
    })
    await tunggu(700)
  }
  const adaFilterTagAnggota = await page.evaluate(() => {
    const sel = document.querySelector('[data-testid="filter-tag-anggota"]')
    return Boolean(sel && sel.innerHTML.includes('#Solois'))
  })
  cek(adaFilterTagAnggota, 'Halaman Anggota menampilkan penyaring Tag lintas-seksi (#Solois) sesudah anggota diberi tag')

  /* ---- 2. Buka Editor Drill & Audit Anti-Overlap ---- */
  await page.evaluate(() => {
    location.hash = '#/drill'
  })
  await page.waitForSelector('[data-testid="kanvas-drill-svg"]', { timeout: 15000 })
  await tunggu(700)

  const auditEditor = await page.evaluate(() => ({
    alatPlaceLamaAda: Boolean(document.querySelector('[data-testid="alat-place"]')),
    alatPanBaruAda: Boolean(document.querySelector('[data-testid="alat-pan"]')),
    sakelarModeInputAda: Boolean(document.querySelector('[data-testid="sakelar-mode-input"]')),
    kontrolZoomAda: Boolean(document.querySelector('[data-testid="kontrol-zoom-kanvas"]')),
    chipSoloisAda: Boolean(document.querySelector('[data-testid="pilih-cepat-tag-Solois"]')),
  }))
  cek(
    !auditEditor.alatPlaceLamaAda &&
      auditEditor.alatPanBaruAda &&
      auditEditor.sakelarModeInputAda &&
      auditEditor.kontrolZoomAda,
    'Anti-overlap #23.3: mode kaku alat-place lama dipensiunkan dan diganti alat-pan + sakelar Mode Input + kontrol Zoom',
  )
  cek(auditEditor.chipSoloisAda, 'Tag #Solois dari Halaman Anggota langsung muncul sebagai chip pilih cepat di Editor Drill')

  /* ---- 3. #23.1 — Buat & Seret Midset Langsung pada Garis Jejak Biru ---- */
  // Pastikan berada di Set 1 dan pilih satu pemain yang bergerak ke Set 2
  const targetMid = await page.evaluate(() => {
    const semuaG = [...document.querySelectorAll('svg g.cursor-move')]
    const g = semuaG[0]
    if (!g) return null
    g.scrollIntoView({ block: 'center' })
    const c = g.querySelector('circle[data-titik="1"]')
    const r = c.getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
  })
  cek(Boolean(targetMid), 'Menemukan titik pemain pertama di Set 1 untuk uji Midset')

  await page.mouse.click(targetMid.x, targetMid.y)
  await tunggu(450)

  // Cari gagang '+' (`tambah-midset-kanvas-*`) pada garis jejak biru, lalu seret ke samping untuk membelokkan jalur!
  const infoTambahMid = await page.evaluate(() => {
    const el = document.querySelector('[data-testid^="tambah-midset-kanvas-"]')
    if (!el) return null
    el.scrollIntoView({ block: 'center' })
    const r = el.getBoundingClientRect()
    const id = (el.getAttribute('data-testid') || '').replace('tambah-midset-kanvas-', '')
    return { id, x: r.left + r.width / 2, y: r.top + r.height / 2 }
  })
  cek(
    Boolean(infoTambahMid),
    'Memilih 1 pemain memunculkan gagang + langsung di tengah garis jejak biru kanvas tanpa perlu menu Pecah Set',
  )

  await page.mouse.move(infoTambahMid.x, infoTambahMid.y)
  await page.mouse.down()
  await page.mouse.move(infoTambahMid.x + 48, infoTambahMid.y - 36, { steps: 10 })
  await page.mouse.up()
  await tunggu(600)

  const sesudahSeretMid = await page.evaluate((id) => {
    const gagang = document.querySelector(`[data-testid="gagang-midset-${id}-0"]`)
    const inspektor = document.querySelector('[data-testid="inspektur-midset"]')
    const jejak = document.querySelector('svg path[data-trail="keluar"][data-midset-trail="1"]')
    const c = document.querySelector(`[data-testid="gagang-midset-${id}-0"] polygon`)
    return {
      adaGagangMidset: Boolean(gagang),
      teksInspektor: inspektor?.textContent || '',
      adaJejakMidset: Boolean(jejak),
      dJejak: jejak?.getAttribute('d') || '',
      adaPoligonIntan: Boolean(c),
    }
  }, infoTambahMid.id)
  cek(
    sesudahSeretMid.adaGagangMidset &&
      sesudahSeretMid.adaPoligonIntan &&
      sesudahSeretMid.adaJejakMidset &&
      sesudahSeretMid.teksInspektor.includes('Hit.'),
    'Menyeret gagang pada garis jejak biru menciptakan titik singgah (Midset) hidup di kanvas & inspektor titik',
  )

  // Uji Undo lalu Redo pada Midset
  await page.keyboard.down('Control')
  await page.keyboard.press('z')
  await page.keyboard.up('Control')
  await tunggu(400)
  const midHilangSaatUndo = await page.evaluate(
    (id) => !document.querySelector(`[data-testid="gagang-midset-${id}-0"]`),
    infoTambahMid.id,
  )
  await page.keyboard.down('Control')
  await page.keyboard.press('y')
  await page.keyboard.up('Control')
  await tunggu(500)
  const midKembaliSaatRedo = await page.evaluate(
    (id) => Boolean(document.querySelector(`[data-testid="gagang-midset-${id}-0"]`)),
    infoTambahMid.id,
  )
  cek(midHilangSaatUndo && midKembaliSaatRedo, 'Undo (Ctrl+Z) & Redo (Ctrl+Y) memulihkan titik singgah Midset dengan utuh')

  // Uji Buku Saku (DotSheetModal -> Pratinjau): hanya pemain bermidset yang punya tr.baris-midset, pemain lain tetap bersih!
  await page.evaluate(() => {
    const btnKartu = [...document.querySelectorAll('button')].find((b) =>
      (b.textContent || '').includes('Kartu'),
    )
    btnKartu?.click()
  })
  await tunggu(500)
  await page.evaluate(() => {
    const btnPratinjau = [...document.querySelectorAll('button')].find((b) =>
      (b.textContent || '').trim() === 'Pratinjau',
    )
    btnPratinjau?.click()
  })
  await tunggu(700)
  const infoBukuSaku = await page.evaluate(() => {
    const ifr = document.querySelector('iframe[title="Pratinjau cetak"]')
    const srcDoc = ifr?.getAttribute('srcdoc') || ''
    const cocokMid = srcDoc.match(/class="baris-midset"/g) || []
    const cocokKartu = srcDoc.match(/class="card-sheet"|class="sheet"/g) || []
    return {
      barisMid: cocokMid.length,
      semuaKartu: cocokKartu.length,
      tanpaOklch: !/oklch\(|color-mix\(/i.test(srcDoc),
    }
  })
  cek(
    infoBukuSaku.barisMid === 1 && infoBukuSaku.tanpaOklch,
    `Buku Saku menyisipkan tepat 1 sub-baris midset hanya pada pemain yang berbelok (${infoBukuSaku.barisMid} baris-midset, murni hex)`,
  )
  await page.keyboard.press('Escape')
  await tunggu(300)
  await page.keyboard.press('Escape')
  await tunggu(350)

  /* ---- 4. #23.2 — Tag Massal, Sorotan Bentuk/Warna Per-Set, & Sub-Kelompok Tag ---- */
  // Pilih semua titik dengan Ctrl+A, lalu ambil 3 titik pertama lewat evaluasi klik Shift
  const tigaTitik = await page.evaluate(() => {
    const gs = [...document.querySelectorAll('svg g.cursor-move')].slice(0, 3)
    gs[0]?.scrollIntoView({ block: 'center' })
    return gs.map((g) => {
      const r = g.querySelector('circle[data-titik="1"]').getBoundingClientRect()
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
    })
  })
  await page.mouse.click(tigaTitik[0].x, tigaTitik[0].y)
  await page.keyboard.down('Shift')
  await page.mouse.click(tigaTitik[1].x, tigaTitik[1].y)
  await page.mouse.click(tigaTitik[2].x, tigaTitik[2].y)
  await page.keyboard.up('Shift')
  await tunggu(350)

  await page.waitForSelector('[data-testid="input-tag-massal"]', { timeout: 5000 })
  await page.type('[data-testid="input-tag-massal"]', 'Sayap Kiri')
  await page.click('[data-testid="simpan-tag-massal"]')
  await tunggu(600)

  // Kosongkan pilihan lalu uji klik 1x chip `#Sayap Kiri`
  await page.keyboard.press('Escape')
  await tunggu(250)
  await page.click('[data-testid="pilih-cepat-tag-Sayap Kiri"]')
  await tunggu(350)
  const terpilihDariTag = await page.evaluate(() =>
    Boolean(document.querySelector('[data-testid="kotak-seleksi-kanvas"]')),
  )
  cek(terpilihDariTag, 'Klik chip #Sayap Kiri langsung memilih 3 anggota lintas-seksi sekaligus di kanvas')

  // Ubah bentuk titik & warna untuk tag Sayap Kiri di PanelGerakSet + buat sub-kelompok jalur dari tag
  await page.select('[data-testid="pilih-tag-sorot-set"]', 'Sayap Kiri')
  await page.select('[data-testid="pilih-bentuk-tag-set"]', 'intan')
  await page.click('[data-testid="warna-tag-f43f5e"]')
  await page.click('[data-testid="pasang-sorot-tag-set"]')
  await page.select('[data-testid="pilih-jalur-kelompok"]', 'lengkung')
  await page.select('[data-testid="pilih-tag-kelompok"]', 'Sayap Kiri')
  await page.click('[data-testid="tambah-kelompok-tag"]')
  await tunggu(600)
  const titikIntan = await page.evaluate(() => ({
    jmlIntan: document.querySelectorAll('svg circle[data-titik="1"][data-bentuk-titik="intan"]').length,
    semuaTitikMasihAdaCircle: document.querySelectorAll('svg circle[data-titik="1"]').length >= 3,
    adaKelompokTag: (document.querySelector('[data-testid="daftar-kelompok-gerak"]')?.textContent || '').includes('#Sayap Kiri'),
  }))
  cek(
    titikIntan.jmlIntan === 3 &&
      titikIntan.semuaTitikMasihAdaCircle &&
      titikIntan.adaKelompokTag,
    'Sorotan Tag per-set mengubah 3 titik menjadi bentuk Intan ber-hex murni sekaligus membuat sub-kelompok gerak ber-tag',
  )

  /* ---- 5. #23.3 — Mode Sentuh (Target >= 40 px, Pan 1 Jari, & Balon Info Tahan-Lama) ---- */
  await page.click('[data-testid="mode-input-sentuh"]')
  await tunggu(400)

  const ukuranSentuh = await page.evaluate(() => {
    const hit = document.querySelector('svg circle[data-hit-sentuh="1"]')
    if (!hit) return null
    const r = hit.getBoundingClientRect()
    return { w: r.width, h: r.height }
  })
  cek(
    Boolean(ukuranSentuh) && ukuranSentuh.w >= 40 && ukuranSentuh.h >= 40,
    `Mode Sentuh memperbesar diameter target tangkap titik menjadi >= 40 px (${ukuranSentuh?.w.toFixed(1)}×${ukuranSentuh?.h.toFixed(1)} px)`,
  )

  // Perbesar zoom, lalu seret 1 jari di pojok kosong kanvas -> viewBox harus bergeser (pan), bukan marquee!
  await page.click('[data-testid="zoom-perbesar"]')
  await page.click('[data-testid="zoom-perbesar"]')
  await tunggu(300)

  const infoPanAwal = await page.evaluate(() => {
    const svg = document.querySelector('[data-testid="kanvas-drill-svg"]')
    svg.scrollIntoView({ block: 'center' })
    const r = svg.getBoundingClientRect()
    return {
      vb: svg.getAttribute('viewBox'),
      x: r.left + 28,
      y: r.top + 28,
    }
  })
  await page.mouse.move(infoPanAwal.x, infoPanAwal.y)
  await page.mouse.down()
  await page.mouse.move(infoPanAwal.x + 90, infoPanAwal.y + 45, { steps: 8 })
  await page.mouse.up()
  await tunggu(300)

  const vbSesudahPan = await page.evaluate(() =>
    document.querySelector('[data-testid="kanvas-drill-svg"]')?.getAttribute('viewBox'),
  )
  cek(
    vbSesudahPan !== infoPanAwal.vb,
    `Seret 1 jari di area kosong pada Mode Sentuh menggeser viewport kanvas (${infoPanAwal.vb} → ${vbSesudahPan})`,
  )

  // Tahan lama (long-press >= 450 ms) pada tombol ber-title di toolbar memunculkan balon-info-sentuh
  const posTombolKlik = await page.evaluate(() => {
    const b = document.querySelector('[data-testid="tombol-klik-editor"]')
    b.scrollIntoView({ block: 'center' })
    const r = b.getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
  })
  await page.mouse.move(posTombolKlik.x, posTombolKlik.y)
  await page.mouse.down()
  await tunggu(550)
  const adaBalonInfo = await page.evaluate(() =>
    Boolean(document.querySelector('[data-testid="balon-info-sentuh"]')),
  )
  await page.mouse.up()
  cek(adaBalonInfo, 'Tahan lama (long-press) pada kontrol toolbar di Mode Sentuh memunculkan balon-info-sentuh pengganti hover')

  // Kembalikan zoom 100% & mode Otomatis
  await page.click('[data-testid="zoom-reset"]')
  await page.click('[data-testid="mode-input-otomatis"]')
  await tunggu(300)

  /* ---- 6. #23.4 — Palet Perintah & Pintasan Terpadu (`?` dan `Ctrl+K`) ---- */
  await page.keyboard.press('?')
  await page.waitForSelector('[data-testid="palet-perintah"]', { timeout: 5000 })
  const isiPaletTanya = await page.evaluate(() => ({
    adaDaftarShortcut: Boolean(document.querySelector('[data-testid="daftar-shortcut"]')),
    jmlBaris: (document.querySelector('[data-testid="daftar-shortcut"]')?.innerText || '')
      .split('\n')
      .filter(Boolean).length,
  }))
  cek(
    isiPaletTanya.adaDaftarShortcut && isiPaletTanya.jmlBaris >= 15,
    'Menekan ? membuka Palet Perintah terpadu yang tetap memuat daftar-shortcut lengkap tanpa modal ganda',
  )
  await page.keyboard.press('Escape')
  await tunggu(350)

  const bacaTotalSet = () =>
    page.evaluate(() => {
      const bar = document.querySelector('.drill-surface')?.previousElementSibling
      const m = (bar?.innerText || '').match(/(\d+)\/(\d+)/)
      return m ? Number(m[2]) : 0
    })
  const jmlSetAwal = await bacaTotalSet()
  await page.keyboard.down('Control')
  await page.keyboard.press('k')
  await page.keyboard.up('Control')
  await page.waitForSelector('[data-testid="input-cari-perintah"]', { timeout: 5000 })
  await page.type('[data-testid="input-cari-perintah"]', 'duplikat')
  await tunggu(200)
  await page.keyboard.press('Enter')
  await tunggu(800)

  const jmlSetAkhir = await bacaTotalSet()
  cek(
    jmlSetAwal >= 2 && jmlSetAkhir === jmlSetAwal + 1,
    `Ctrl+K → ketik "duplikat" → Enter langsung mengeksekusi penggandaan set (${jmlSetAwal} → ${jmlSetAkhir} set)`,
  )

  const svgBersihHex = await page.evaluate(() => {
    const htmlSvg = document.querySelector('[data-testid="kanvas-drill-svg"]')?.outerHTML || ''
    return !/oklch\(|color-mix\(|rgba\(/i.test(htmlSvg)
  })
  cek(svgBersihHex, 'Seluruh elemen SVG kanvas #23 (bentuk tag, gagang midset, hit sentuh) 100% murni #hex tanpa oklch()/color-mix()/rgba()')
  cek(galat.length === 0, `Tidak ada galat halaman selama seluruh skenario E2E #23 (${galat.length} galat)`)
} finally {
  await browser.close()
}

console.log(`\n${lulus} lulus, ${gagal} gagal`)
process.exit(gagal > 0 ? 1 : 0)
