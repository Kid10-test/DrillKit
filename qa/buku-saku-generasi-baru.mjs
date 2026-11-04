/**
 * #26 (`v2.2.4`) — Uji E2E Puppeteer "Buku Saku Generasi Baru":
 *  - #26.4 Panel "Dress, Hole & Bayangan" di editor: dress set tersimpan ke Dexie, pratinjau
 *          pemandu, Jadikan Hole (lingkar putus-putus di kanvas) → Isi Hole kembali, bayangan.
 *  - #26.5 Catatan cleaning terpadu (`db.tindakLanjut`): tambah, siklus status, Lembar Fokus A4.
 *  - #26.1 Dot sheet: kolom "Tengah & xCount" (Lembar A4), sub-baris xCount kartu lipat
 *          (opsional), baris dress, dan kompas perspektif pemain 180°.
 *  - #26.3 Presenter: chip Partitur (Beam) membuka partitur birama set aktif (MusicXML sungguhan,
 *          dirender lazy), chip Cleaning membuka laci ±40vh; mengetik tidak memicu pintasan.
 *  - #26.1/2/3 Mode Anggota (HP 360px) dari paket ZIP asli: xCount, dress, bayangan,
 *          sudut pandang pemain (S1/S2 tertukar, tersimpan), laci partitur, privasi hole.
 */
import puppeteer from 'puppeteer'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { lewatSambutan } from './sambutan.mjs'

const BASE = process.env.BASE || 'http://localhost:4173'
const tunggu = (ms) => new Promise((r) => setTimeout(r, ms))
const UNDUH = fs.mkdtempSync(path.join(os.tmpdir(), 'dk26-unduh-'))
const BUKA = fs.mkdtempSync(path.join(os.tmpdir(), 'dk26-buka-'))

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

/** Baca satu store Dexie mentah. */
const bacaStore = (page, store) =>
  page.evaluate(async (s) => {
    const db = await new Promise((resolve, reject) => {
      const req = indexedDB.open('drillkit')
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    const isi = await new Promise((resolve) => {
      const r = db.transaction(s).objectStore(s).getAll()
      r.onsuccess = () => resolve(r.result)
    })
    db.close()
    return isi
  }, store)

/** Klik titik pemain berkode `kode` di kanvas editor (tetikus sungguhan). */
async function klikTitik(page, kode, shift = false) {
  const pos = await page.evaluate((k) => {
    const c = [...document.querySelectorAll('svg circle[data-titik="1"]')].find((el) => {
      const g = el.closest('g.cursor-move')
      return g && [...g.querySelectorAll('text')].some((t) => t.textContent.trim() === k)
    })
    if (!c) return null
    c.scrollIntoView({ block: 'center' })
    const r = c.getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
  }, kode)
  if (!pos) return false
  await tunggu(150)
  const pos2 = await page.evaluate((k) => {
    const c = [...document.querySelectorAll('svg circle[data-titik="1"]')].find((el) => {
      const g = el.closest('g.cursor-move')
      return g && [...g.querySelectorAll('text')].some((t) => t.textContent.trim() === k)
    })
    const r = c.getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
  }, kode)
  if (shift) await page.keyboard.down('Shift')
  await page.mouse.click(pos2.x, pos2.y)
  if (shift) await page.keyboard.up('Shift')
  await tunggu(250)
  return true
}

/** Klik tombol berdasarkan teks di dalam jendela berjudul `judul` (atau seluruh dokumen). */
const klikTeks = (page, teks, judul = null) =>
  page.evaluate(
    (t, j) => {
      let akar = document
      if (j) {
        const h = [...document.querySelectorAll('h3')].find((x) => x.textContent.trim().startsWith(j))
        akar = h && h.closest('.relative')
        if (!akar) return false
      }
      const el = [...akar.querySelectorAll('button')].find((b) => b.textContent.trim() === t)
      if (!el || el.disabled) return false
      el.click()
      return true
    },
    teks,
    judul,
  )

/** Buka pratinjau buku saku, kembalikan isi HTML bingkai, lalu tutup pratinjaunya. */
async function bacaPratinjau(page) {
  await klikTeks(page, 'Pratinjau', 'Dot sheet & buku saku')
  const el = await page.waitForSelector('iframe[title="Pratinjau cetak"]', { timeout: 8000 })
  const bingkai = await el.contentFrame()
  await bingkai.waitForSelector('section.page table, .kartu table', { timeout: 8000 })
  await bingkai.waitForFunction(() => document.readyState === 'complete', { timeout: 8000 })
  const isi = await bingkai.evaluate(() => ({
    html: document.documentElement.outerHTML,
    kepala: [...document.querySelectorAll('thead th')].map((th) => th.textContent.replace(/\s+/g, ' ').trim()),
    xcountA4: [...document.querySelectorAll('td.xcount')].map((td) => td.textContent.trim()),
    barisXc: [...document.querySelectorAll('tr.baris-xcount')].map((tr) => tr.textContent.trim()),
    kompas: [...document.querySelectorAll('.kompas')].map((k) => k.textContent.replace(/\s+/g, ' ').trim()),
    luapLipat: [...document.querySelectorAll('.muka')].filter((m) => m.scrollHeight > m.clientHeight + 1).length,
  }))
  await klikTeks(page, 'Tutup', 'Pratinjau hasil cetak')
  await tunggu(300)
  return isi
}

try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 960 })
  const galat = []
  page.on('pageerror', (e) => galat.push(e.message))

  await page.goto(BASE, { waitUntil: 'networkidle0' })
  await lewatSambutan(page)
  await tunggu(600)

  // 3 pemain brass bergerak dari S1 melintasi YL45 S1 menuju YL50; G2 = bayangan T1 (tanpa titik sendiri).
  await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const req = indexedDB.open('drillkit')
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    // Lagu 120 BPM 4/4 dengan partitur MusicXML 8 birama (1 part Trumpet).
    const birama = Array.from({ length: 8 }, (_, i) =>
      `<measure number="${i + 1}">${i === 0 ? '<attributes><divisions>1</divisions><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>' : ''}${'<note><pitch><step>C</step><octave>5</octave></pitch><duration>1</duration><type>quarter</type></note>'.repeat(4)}</measure>`,
    ).join('')
    const xml = `<?xml version="1.0" encoding="UTF-8"?><score-partwise version="3.1"><work><work-title>Mars Uji 26</work-title></work><part-list><score-part id="P1"><part-name>Trumpet</part-name></score-part></part-list><part id="P1">${birama}</part></score-partwise>`
    const blob = new Blob([xml], { type: 'application/vnd.recordare.musicxml+xml' })
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(xml)))]
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
    const tx = db.transaction(['members', 'drills', 'sets', 'songs', 'partiturBerkas'], 'readwrite')
    const kiniLagu = Date.now()
    tx.objectStore('songs').put({
      id: 'lagu_uji_26',
      title: 'Mars Uji 26',
      bpm: 120,
      beats: 4,
      tempoMap: [],
      createdAt: kiniLagu,
      partitur: {
        namaFile: 'mars-uji-26.musicxml',
        tipe: 'musicxml',
        ukuran: blob.size,
        hash,
        susunan: 'partwise',
        judul: 'Mars Uji 26',
        jumlahBirama: 8,
        jumlahPart: 1,
        parts: [{ id: 'P1', nama: 'Trumpet' }],
        sukat: { beats: 4, beatType: 4 },
        perubahanSukat: [{ birama: 1, beats: 4, beatType: 4 }],
        terurai: true,
        dipasangiAt: kiniLagu,
      },
    })
    tx.objectStore('partiturBerkas').put({
      id: 'lagu_uji_26',
      songId: 'lagu_uji_26',
      blob,
      namaFile: 'mars-uji-26.musicxml',
      tipe: 'musicxml',
      ukuran: blob.size,
      hash,
      updatedAt: kiniLagu,
    })
    const anggota = [
      { id: 'u26_t1', name: 'Terompet Satu', code: 'T1', section: 'brass', instrument: 'Trumpet', role: 'member', joinYear: 2026, active: 1 },
      { id: 'u26_t2', name: 'Terompet Dua', code: 'T2', section: 'brass', instrument: 'Trumpet', role: 'member', joinYear: 2026, active: 1 },
      { id: 'u26_t3', name: 'Terompet Tiga', code: 'T3', section: 'brass', instrument: 'Trumpet', role: 'member', joinYear: 2026, active: 1 },
      { id: 'u26_g1', name: 'Guard Satu', code: 'G1', section: 'color_guard', instrument: 'Flag', role: 'member', joinYear: 2026, active: 1 },
      { id: 'u26_g2', name: 'Guard Cadangan', code: 'G2', section: 'color_guard', instrument: 'Flag', role: 'member', joinYear: 2026, active: 1 },
    ]
    for (const m of anggota) tx.objectStore('members').put(m)
    const kini = Date.now() + 180_000
    tx.objectStore('drills').put({
      id: 'drill_uji_26',
      name: 'Uji Buku Saku #26',
      showTitle: 'Uji #26',
      tempo: 120,
      beatsPerCount: 1,
      rosterIds: anggota.map((a) => a.id),
      createdAt: kini,
      updatedAt: kini,
      field: { widthYd: 53.33, lengthYd: 100, endZoneYd: 10, hash: 'ncaa', gridYd: 5, step: '8to5', customStepYd: 0.625, showLabels: 1 },
      bayangan: [{ memberId: 'u26_g2', indukId: 'u26_t1', mode: 'offset', offsetLangkah: 1, arahOffset: 'belakang' }],
      songId: 'lagu_uji_26',
    })
    tx.objectStore('sets').put({
      id: 'set26_1', drillId: 'drill_uji_26', order: 0, name: 'Set 1', counts: 8, notes: '',
      points: {
        u26_t1: { x: 2, y: 0, facing: 'front' },
        u26_t2: { x: 6, y: 0, facing: 'front' },
        u26_t3: { x: 10, y: 0, facing: 'front' },
        u26_g1: { x: -10, y: 8, facing: 'front' },
      },
    })
    tx.objectStore('sets').put({
      id: 'set26_2', drillId: 'drill_uji_26', order: 1, name: 'Set 2', counts: 8, notes: '',
      points: {
        u26_t1: { x: -8, y: 0, facing: 'front' },
        u26_t2: { x: -4, y: 0, facing: 'front' },
        u26_t3: { x: 0, y: 0, facing: 'front' },
        u26_g1: { x: 10, y: 8, facing: 'front' },
      },
    })
    await new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(true)
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  })

  await page.goto(`${BASE}/#/drill`, { waitUntil: 'networkidle0' })
  await page.reload({ waitUntil: 'networkidle0' })
  await page.waitForSelector('[data-testid="kanvas-drill-svg"]', { timeout: 15000 })
  await tunggu(600)

  /* ---- 1. Dress, Hole & Bayangan ---- */
  await page.waitForSelector('[data-testid="toggle-panel-titik-khusus"]', { timeout: 8000 })
  await page.evaluate(() => document.querySelector('[data-testid="toggle-panel-titik-khusus"]').click())
  await page.waitForSelector('[data-testid="panel-titik-khusus"]', { timeout: 4000 })
  await page.select('[data-testid="dress-set"]', 'tengah')
  await tunggu(500)
  const setDb1 = (await bacaStore(page, 'sets')).find((s) => s.id === 'set26_1')
  cek(setDb1?.dress?.acuan === 'tengah', `Dress set "Tengah" tersimpan aditif ke Dexie (${JSON.stringify(setDb1?.dress)})`)

  cek(await klikTitik(page, 'T3'), 'Titik T3 bisa dipilih di kanvas editor')
  const pratinjauDress = await page.$eval('[data-testid="pratinjau-dress"]', (e) => e.textContent.trim()).catch(() => '')
  cek(/T3: Luruskan ke: Tengah \(T2\)/.test(pratinjauDress), `Pratinjau pemandu dress untuk T3 = "${pratinjauDress}"`)
  const bayanganAwal = await page.$$eval('[data-testid="baris-bayangan"]', (els) => els.map((e) => e.textContent))
  cek(bayanganAwal.length === 1 && /G2/.test(bayanganAwal[0]) && /T1/.test(bayanganAwal[0]), `Daftar bayangan memuat G2 → T1 (${bayanganAwal.join(' | ')})`)

  await klikTitik(page, 'T2')
  await page.evaluate(() => document.querySelector('[data-testid="jadikan-hole"]').click())
  await tunggu(600)
  const setelahHole = await page.evaluate(() => ({
    baris: [...document.querySelectorAll('[data-testid="baris-hole"]')].map((e) => e.textContent),
    lapisan: document.querySelectorAll('[data-testid="lapisan-hole"] circle').length,
  }))
  const setsHole = await bacaStore(page, 'sets')
  const drillHole = (await bacaStore(page, 'drills')).find((d) => d.id === 'drill_uji_26')
  const idHole = drillHole?.holes?.[0]?.id ?? ''
  cek(
    setelahHole.baris.length === 1 && /H1/.test(setelahHole.baris[0]) && setelahHole.lapisan >= 1,
    `Jadikan Hole: baris H1 & lingkar putus-putus di kanvas (${setelahHole.baris.join(' | ')}, ${setelahHole.lapisan} lingkar)`,
  )
  cek(
    idHole.startsWith('hole_') && setsHole.every((s) => s.points[idHole] && !s.points.u26_t2),
    'Titik T2 di semua set diambil alih slot hole_… (interval bentuk tetap utuh)',
  )
  await page.select('[data-testid="isi-hole"]', 'u26_t2')
  await tunggu(600)
  const setsIsi = await bacaStore(page, 'sets')
  const drillIsi = (await bacaStore(page, 'drills')).find((d) => d.id === 'drill_uji_26')
  cek(
    setsIsi.every((s) => s.points.u26_t2 && !s.points[idHole]) && (drillIsi?.holes?.length ?? 0) === 0,
    'Isi Hole oleh pemain asal mengembalikan titik T2 & menghapus slot hole',
  )

  /* ---- 2. Catatan cleaning terpadu ---- */
  await page.waitForSelector('[data-testid="input-cleaning"]', { timeout: 6000 })
  await page.evaluate(() => document.querySelector('[data-testid="input-cleaning"]').scrollIntoView({ block: 'center' }))
  await page.type('[data-testid="input-cleaning"]', 'Interval trompet terlalu rapat di YL45')
  await page.select('[data-testid="seksi-cleaning"]', 'brass').catch(() => null)
  await page.click('[data-testid="tambah-cleaning"]')
  await tunggu(500)
  await page.click('[data-testid="status-cleaning"]')
  await tunggu(500)
  const tlDb = await bacaStore(page, 'tindakLanjut')
  const barisTl = await page.$$eval('[data-testid="baris-cleaning"]', (els) => els.map((e) => e.getAttribute('data-status')))
  cek(
    tlDb.length === 1 && tlDb[0].status === 'fokus' && tlDb[0].setNomor === 1 && tlDb[0].drillId === 'drill_uji_26' && !('memberId' in tlDb[0]),
    `Catatan cleaning tersimpan di db.tindakLanjut (status ${tlDb[0]?.status}, Set ${tlDb[0]?.setNomor}, seksi ${tlDb[0]?.seksi ?? '-'})`,
  )
  cek(barisTl.join() === 'fokus', `Baris catatan berganti status temuan → fokus (${barisTl.join()})`)

  await page.evaluate(() => {
    window.__blobUji = []
    const asli = URL.createObjectURL.bind(URL)
    URL.createObjectURL = (b) => {
      window.__blobUji.push(b)
      return asli(b)
    }
    HTMLAnchorElement.prototype.click = function () {}
  })
  await page.click('[data-testid="unduh-fokus-cleaning"]')
  await tunggu(800)
  const lembar = await page.evaluate(async () => {
    const b = window.__blobUji?.[window.__blobUji.length - 1]
    return b ? await b.text() : ''
  })
  cek(
    lembar.includes('data-lembar-cleaning="1"') && /Interval trompet terlalu rapat/.test(lembar) && /A4 portrait/.test(lembar) && !/oklch\(|color-mix\(|rgba\(/i.test(lembar),
    `Lembar Fokus Cleaning Harian A4 terunduh (hex murni, ${lembar.length} karakter)`,
  )

  /* ---- 3. Dot sheet & buku saku ---- */
  await page.evaluate(() => document.querySelector('button[title="Kartu/dot sheet per pemain"]')?.click())
  await page.waitForFunction(() => [...document.querySelectorAll('h3')].some((h) => h.textContent.trim().startsWith('Dot sheet & buku saku')), { timeout: 8000 })
  const xcLipatAwal = await page.$eval('[data-testid="centang-dot-xcount"]', (e) => e.checked)
  cek(xcLipatAwal === false, 'Kartu lipat: xCount bawaan mati (kapasitas kartu terjaga)')
  const lipatPolos = await bacaPratinjau(page)
  cek(lipatPolos.barisXc.length === 0 && /Luruskan ke: Tengah \(T2\)/.test(lipatPolos.html), 'Kartu lipat bawaan: tanpa sub-baris xCount, baris dress tercetak di sel Set')
  await page.click('[data-testid="centang-dot-xcount"]')
  await page.click('[data-testid="centang-dot-perspektif"]')
  await tunggu(200)
  const lipatXc = await bacaPratinjau(page)
  cek(
    lipatXc.barisXc.some((t) => /xCount: YL45 S1 hit\. 4/.test(t) && /Tengah \[hit\. 4\]/.test(t)),
    `Kartu lipat + xCount: sub-baris "${lipatXc.barisXc.find((t) => /YL45 S1/.test(t)) ?? lipatXc.barisXc[0] ?? '-'}"`,
  )
  cek(
    lipatXc.kompas.length > 0 && lipatXc.kompas.every((k) => /Sudut pandang pemain/.test(k) && /PENONTON/.test(k)) && lipatXc.luapLipat === 0,
    `Kompas perspektif pemain 180° tercetak & tidak ada muka kartu yang meluap (${lipatXc.luapLipat})`,
  )
  cek(/Bayangan T1 — geser 1 langkah ke belakang/.test(lipatXc.html), 'Kartu G2 mencantumkan status bayangan T1 & memakai titik turunannya')

  await klikTeks(page, 'Lembar A4', 'Dot sheet & buku saku')
  await tunggu(200)
  const xcA4 = await page.$eval('[data-testid="centang-dot-xcount"]', (e) => e.checked)
  const a4 = await bacaPratinjau(page)
  cek(xcA4 === true && a4.kepala.includes('Tengah & xCount') && a4.kepala[a4.kepala.length - 1] === 'Tengah & xCount', 'Lembar A4: kolom terakhir "Tengah & xCount" bawaan menyala')
  cek(a4.xcountA4.some((t) => /YL45 S1 hit\. 4/.test(t)), `Lembar A4 menulis xCount per perpindahan (${a4.xcountA4.filter((t) => t !== '-').slice(0, 2).join(' | ')})`)
  cek(!/oklch\(|color-mix\(|rgba\(/i.test(a4.html + lipatXc.html), 'HTML dot sheet tetap hex/rgb murni')
  await page.keyboard.press('Escape')
  await tunggu(400)

  /* ---- 4. Presenter: chip Cleaning ---- */
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => (x.getAttribute('title') || '').startsWith('Mode presenter'))
    b?.click()
  })
  await page.waitForSelector('[data-testid="chip-cleaning"]', { timeout: 8000 })
  await page.click('[data-testid="chip-beam"]')
  await page.waitForSelector('[data-testid="laci-presenter-beam"] [data-testid="beam-lencana"]', { timeout: 8000 })
  const svgBeam = await page
    .waitForFunction(() => document.querySelectorAll('[data-testid="laci-presenter-beam"] svg').length > 0, { timeout: 20000 })
    .then(() => true, () => false)
  const beam1 = await page.evaluate(() => ({
    rentang: document.querySelector('[data-testid="laci-beam"]')?.getAttribute('data-beam-rentang'),
    lencana: document.querySelector('[data-testid="beam-lencana"]')?.textContent?.trim(),
  }))
  cek(beam1.rentang === '1-2' && /Set 1/.test(beam1.lencana) && /Birama 1/.test(beam1.lencana) && svgBeam, `Beam: partitur dirender lazy untuk Set 1 = birama ${beam1.rentang} ("${beam1.lencana}")`)
  await page.evaluate(() => document.querySelector('[data-testid="pip-kemajuan-1"]')?.click())
  await tunggu(500)
  const rentang2 = await page.$eval('[data-testid="laci-beam"]', (e) => e.getAttribute('data-beam-rentang'))
  cek(rentang2 === '3-4', `Ganti ke Set 2 → birama partitur ikut bergeser (${rentang2})`)
  await page.click('[data-testid="beam-ulang-set"]')
  await tunggu(200)
  const kelasUlang = await page.$eval('[data-testid="beam-ulang-set"]', (e) => e.className)
  cek(/emerald/.test(kelasUlang), 'Tombol "Ulang set ini" aktif (frasa birama set dikunci untuk diputar berulang)')
  await page.click('[data-testid="tutup-laci-presenter"]')
  await tunggu(250)
  cek(!(await page.$('[data-testid="laci-presenter-beam"]')), 'Tombol Tutup menutup laci partitur')
  await page.evaluate(() => document.querySelector('[data-testid="pip-kemajuan-0"]')?.click())
  await tunggu(300)
  await page.click('[data-testid="chip-cleaning"]')
  await page.waitForSelector('[data-testid="laci-presenter-cleaning"] [data-testid="input-cleaning"]', { timeout: 6000 })
  const tinggiLaci = await page.$eval('[data-testid="laci-presenter-cleaning"]', (e) => e.getBoundingClientRect().height / window.innerHeight)
  const setSebelum = await page.$eval('[data-testid="info-urutan"]', (e) => e.textContent)
  await page.type('[data-testid="laci-presenter-cleaning"] [data-testid="input-cleaning"]', 'Snare telat  r ')
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Enter')
  await tunggu(500)
  const presenterMasihBuka = await page.$('[data-testid="chip-cleaning"]')
  const tlDb2 = await bacaStore(page, 'tindakLanjut')
  cek(tinggiLaci > 0.25 && tinggiLaci <= 0.41, `Laci Cleaning presenter setinggi ±40vh (${Math.round(tinggiLaci * 100)}vh)`)
  cek(
    Boolean(presenterMasihBuka) && tlDb2.length === 2 && tlDb2.some((t) => /Snare telat r/.test(t.judul)),
    `Mengetik "r"/spasi/panah di laci tidak memicu pintasan presenter; Enter menyimpan catatan (${tlDb2.length} catatan, ${setSebelum?.trim()})`,
  )
  await page.keyboard.press('Escape')
  await tunggu(300)
  const laciTutup = !(await page.$('[data-testid="laci-presenter-cleaning"]'))
  const presenterTetap = Boolean(await page.$('[data-testid="chip-cleaning"]'))
  cek(laciTutup && presenterTetap, 'Esc pertama menutup laci, presenter tetap terbuka')
  await page.keyboard.press('Escape')
  await tunggu(400)

  /* ---- 5. Mode Anggota dari paket ZIP asli (HP 360px) ---- */
  const cdp = await page.target().createCDPSession()
  await cdp.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: UNDUH })
  await page.evaluate(() => {
    delete HTMLAnchorElement.prototype.click
  })
  await page.goto(`${BASE}/#/berbagi`, { waitUntil: 'networkidle2' })
  await tunggu(1200)
  await page.click('[data-testid="unduh-per-anggota"]')
  let zipPath = null
  for (let i = 0; i < 60 && !zipPath; i += 1) {
    await tunggu(250)
    const files = fs.readdirSync(UNDUH).filter((x) => x.endsWith('.zip'))
    if (files.length) zipPath = path.join(UNDUH, files[0])
  }
  cek(Boolean(zipPath), 'ZIP paket per anggota terunduh dari halaman Berbagi')
  execFileSync('unzip', ['-o', '-q', zipPath, '-d', BUKA])
  const paket = Object.fromEntries(
    fs
      .readdirSync(BUKA)
      .filter((f) => f.endsWith('.json'))
      .map((f) => {
        const o = JSON.parse(fs.readFileSync(path.join(BUKA, f), 'utf8'))
        return [o.forMember, f]
      }),
  )
  const isiT3 = JSON.parse(fs.readFileSync(path.join(BUKA, paket.u26_t3), 'utf8'))
  cek(!('tindakLanjut' in isiT3), 'Paket anggota bebas catatan cleaning staf (tindakLanjut)')

  async function bukaSebagaiAnggota(idAnggota) {
    const ctx = await browser.createBrowserContext()
    const hp = await ctx.newPage()
    hp.on('pageerror', (e) => galat.push(e.message))
    await hp.setViewport({ width: 360, height: 740, isMobile: true, hasTouch: true })
    await hp.goto(`${BASE}/`, { waitUntil: 'networkidle2' })
    await tunggu(800)
    await hp.click('[data-testid="pilih-member"]')
    await tunggu(200)
    await hp.click('[data-testid="lanjut-pilih-mode"]')
    await tunggu(800)
    await hp.goto(`${BASE}/#/berbagi`, { waitUntil: 'networkidle2' })
    await tunggu(800)
    const input = await hp.$('#pkg-input')
    await input.uploadFile(path.join(BUKA, paket[idAnggota]))
    await tunggu(1800)
    await hp.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').trim().toLowerCase() === 'formasi')
      b?.click()
    })
    await tunggu(700)
    return { ctx, hp }
  }

  const { ctx: ctxT3, hp } = await bukaSebagaiAnggota('u26_t3')
  const kartuT3 = await hp.evaluate(() => ({
    xc: document.querySelector('[data-testid="anggota-xcount"]')?.textContent || '',
    dress: document.querySelector('[data-testid="anggota-dress"]')?.textContent || '',
    label: [...document.querySelectorAll('svg text')].map((t) => t.textContent.trim()).filter((t) => /^(S1|S2)$/.test(t)),
  }))
  cek(/xCount: YL45 S1 hit\. 4/.test(kartuT3.xc) && /Tengah \[hit\. 4\]/.test(kartuT3.xc), `Kartu Posisiku menampilkan xCount & titik tengah ("${kartuT3.xc}")`)
  cek(/Luruskan ke: Tengah \(T2\)/.test(kartuT3.dress), `Kartu Posisiku menampilkan acuan dress ("${kartuT3.dress}")`)
  await hp.click('[data-testid="toggle-perspektif-pemain"]')
  await tunggu(300)
  const labelBalik = await hp.evaluate(() => [...document.querySelectorAll('svg text')].map((t) => t.textContent.trim()).filter((t) => /^(S1|S2)$/.test(t)))
  const tersimpan = await hp.evaluate(() => localStorage.getItem('drillkit_perspektif_pemain_v1'))
  cek(
    kartuT3.label.join() === 'S1,S2' && labelBalik.join() === 'S2,S1' && tersimpan === '1',
    `Sudut pandang pemain 180°: label tepi ${kartuT3.label.join('/')} → ${labelBalik.join('/')}, tersimpan di perangkat`,
  )
  await hp.reload({ waitUntil: 'networkidle2' })
  await tunggu(800)
  await hp.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').trim().toLowerCase() === 'formasi')
    b?.click()
  })
  await tunggu(600)
  const masihBalik = await hp.$eval('[data-testid="toggle-perspektif-pemain"]', (e) => e.getAttribute('aria-pressed')).catch(() => null)
  cek(masihBalik === 'true', 'Pilihan sudut pandang pemain bertahan setelah muat ulang')
  await hp.click('[data-testid="toggle-beam"]')
  await hp.waitForSelector('[data-testid="laci-beam"]', { timeout: 6000 }).catch(() => null)
  await tunggu(800)
  const beamHp = await hp.evaluate(() => ({
    rentang: document.querySelector('[data-testid="laci-beam"]')?.getAttribute('data-beam-rentang') ?? null,
    teks: document.querySelector('[data-testid="laci-beam"]')?.textContent ?? '',
  }))
  cek(
    beamHp.rentang === '1-2' || /belum punya partitur/.test(beamHp.teks),
    `Laci partitur Mode Anggota: ${beamHp.rentang ? 'birama ' + beamHp.rentang : beamHp.teks.slice(0, 90)}`,
  )
  const lebarHp = await hp.evaluate(() => document.documentElement.scrollWidth)
  cek(lebarHp <= 360, `Mode Anggota HP 360px bebas luapan horizontal (scrollWidth = ${lebarHp}px)`)
  await ctxT3.close()

  const { ctx: ctxG2, hp: hpG2 } = await bukaSebagaiAnggota('u26_g2')
  const kartuG2 = await hpG2.evaluate(() => ({
    bayangan: document.querySelector('[data-testid="anggota-bayangan"]')?.textContent || '',
    posisi: (() => {
      const t = document.body.innerText
      const i = t.indexOf('Posisiku')
      return i >= 0 ? t.slice(i, i + 600).replace(/\s+/g, ' ') : t.slice(0, 200)
    })(),
  }))
  cek(
    /Bayangan T1 — geser 1 langkah ke belakang/.test(kartuG2.bayangan) && /S1\s*·\s*YL50 \+3\.25/.test(kartuG2.posisi) && !/tidak di lapangan/i.test(kartuG2.posisi),
    `Pemain bayangan G2 melihat statusnya & koordinat turunan dari T1 ("${kartuG2.bayangan}" · ${kartuG2.posisi.slice(12, 110)})`,
  )
  await ctxG2.close()

  cek(galat.length === 0, `Tidak ada galat halaman selama skenario E2E #26 (${galat.length} galat${galat.length ? ': ' + galat[0] : ''})`)
} finally {
  await browser.close()
  fs.rmSync(UNDUH, { recursive: true, force: true })
  fs.rmSync(BUKA, { recursive: true, force: true })
}

console.log(`\n${lulus} lulus, ${gagal} gagal`)
process.exit(gagal > 0 ? 1 : 0)
