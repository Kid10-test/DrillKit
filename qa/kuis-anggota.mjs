/**
 * Uji **Kuis/hafalan anggota (C2)** — tebak posisi sendiri di set berikutnya.
 *
 * Mengapa end-to-end: yang dinilai bukan sekadar munculnya tab, melainkan
 * rantai yang mudah putus di tengah — ketukan piksel harus menjadi yard
 * yang benar (proyeksi peta), yard menjadi langkah (ukuran langkah
 * lapangan), dan langkah menjadi benar/salah (toleransi). Rantai itu hanya
 * bisa diuji dengan mengetuk sungguhan di peramban.
 *
 * Alur:
 *   1. Pelatih: data contoh + 3 duplikat Set 1 → 5 set, 4 soal.
 *   2. Pelatih menerbitkan berkas grup; anggota mengambil materi.
 *   3. Soal 1: ketuk TEPAT di kunci (dihitung dari paketnya sendiri) → Tepat.
 *   4. Soal 2: ketuk sudut terjauh → Belum tepat + jarak + kunci ditampilkan.
 *   5. Soal 3: ketuk dua kali (penanda pindah), lalu kunci yang benar.
 *   6. Soal 4: benar → skor akhir 3 dari 4 → Main lagi → Acak.
 *   7. Layar 360px: tab Kuis tidak melebarkan dokumen.
 */
import puppeteer from 'puppeteer'
import { lewatSambutan } from './sambutan.mjs'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { DIST } from './lokasi.mjs'

const BASE = process.env.BASE || 'http://localhost:4173'
const PAKET = path.join(DIST, 'paket.json')
const UNDUH = path.join(os.tmpdir(), `unduh-kuis-${Date.now()}`)
fs.mkdirSync(UNDUH, { recursive: true })

const browser = await puppeteer.launch({
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  defaultViewport: { width: 1300, height: 1000 },
})
const errors = []

let lulus = 0
const gagal = []
const cek = (nama, syarat, keterangan = '') => {
  if (syarat) lulus += 1
  else gagal.push(`${nama}${keterangan ? ' — ' + keterangan : ''}`)
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const teks = (h, id) => h.evaluate((x) => document.querySelector(`[data-testid="${x}"]`)?.textContent.replace(/\s+/g, ' ').trim() ?? '', id)
const ada = (h, id) => h.evaluate((x) => document.querySelector(`[data-testid="${x}"]`) != null, id)
const klikTeks = (h, t) => h.evaluate((x) => {
  const b = [...document.querySelectorAll('button')].find((y) => y.textContent.trim() === x)
  if (!b || b.disabled) return false
  b.click()
  return true
}, t)

/** Anggota baru: lewat layar pengantar seperti pemakai sungguhan. */
async function perangkatAnggota() {
  const ctx = await browser.createBrowserContext()
  const h = await ctx.newPage()
  h.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  h.on('pageerror', (e) => errors.push(String(e)))
  h.on('dialog', async (d) => { await d.accept() })
  await h.goto(BASE, { waitUntil: 'networkidle2' })
  await wait(2500)
  await h.click('[data-testid="pilih-member"]')
  await wait(300)
  await h.click('[data-testid="lanjut-pilih-mode"]')
  await wait(1500)
  await h.goto(`${BASE}/#/berbagi`, { waitUntil: 'networkidle2' })
  await wait(2200)
  return h
}

/** Baca paket anggota langsung dari basis data perangkatnya. */
const bacaPaket = (h) => h.evaluate(async () => {
  const db = await new Promise((res) => { const q = indexedDB.open('drillkit'); q.onsuccess = () => res(q.result) })
  const paket = await new Promise((res) => {
    const q = db.transaction(['packages'], 'readonly').objectStore('packages').get('current')
    q.onsuccess = () => res(q.result ?? null)
  })
  db.close()
  return { paket: paket?.data ?? null, meId: localStorage.getItem('drillkit.meId') ?? '' }
})

/** Piksel untuk satu titik yard pada peta kuis (proyeksi yang sama dengan aplikasi). */
const pikselUntuk = (h, x, y) => h.evaluate((px, py) => {
  const svg = document.querySelector('[data-testid="peta-kuis"]')
  svg.scrollIntoView({ block: 'center' })
  const r = svg.getBoundingClientRect()
  const [,, vw, vh] = svg.viewBox.baseVal ? [0, 0, svg.viewBox.baseVal.width, svg.viewBox.baseVal.height] : [0, 0, 0, 0]
  return { x: r.left + (px / vw) * r.width, y: r.top + (py / vh) * r.height }
}, x, y)

try {
  /* ================= 1. Pelatih: 5 set via Duplikat ================= */
  const A = await browser.newPage()
  A.on('dialog', async (d) => { await d.accept() })
  await A.goto(BASE, { waitUntil: 'networkidle2' })
  await lewatSambutan(A)
  await wait(1200)
  await A.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((y) => y.textContent.includes('Muat data contoh'))
    if (b) b.click()
  })
  await wait(4500)
  await A.goto(`${BASE}/#/drill`, { waitUntil: 'networkidle2' })
  await A.waitForFunction(() => document.querySelectorAll('circle[data-titik="1"]').length >= 18, { timeout: 20000 })
  await wait(800)
  await A.evaluate(() => {
    [...document.querySelectorAll('button')].find((x) => x.textContent.includes('Set 1 — Blok'))?.click()
  })
  await wait(500)
  for (let i = 0; i < 3; i++) {
    if (!(await klikTeks(A, 'Duplikat'))) throw new Error(`klik Duplikat ke-${i + 1} gagal`)
    await A.waitForFunction(
      (n) => [...document.querySelectorAll('button')].filter((x) => x.textContent.includes('titik ·')).length >= n,
      { timeout: 8000 }, i + 3)
  }
  const nSet = await A.evaluate(async () => {
    const db = await new Promise((res) => { const q = indexedDB.open('drillkit'); q.onsuccess = () => res(q.result) })
    const sets = await new Promise((res) => {
      const q = db.transaction(['sets'], 'readonly').objectStore('sets').getAll()
      q.onsuccess = () => res(q.result ?? [])
    })
    db.close()
    return sets.length
  })
  cek('1: pelatih punya 5 set', nSet === 5, `dapat ${nSet}`)

  /* ================= 2. Terbitkan berkas grup ================= */
  const klien = await A.target().createCDPSession()
  await klien.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: UNDUH })
  await A.goto(`${BASE}/#/berbagi`, { waitUntil: 'networkidle2' })
  await wait(2200)
  await (await A.$('[data-testid="unduh-grup"]')).click()
  let berkas = null
  for (let i = 0; i < 120 && !berkas; i += 1) {
    await wait(250)
    const f = fs.readdirSync(UNDUH).filter((x) => x.endsWith('.json'))
    if (f.length) berkas = path.join(UNDUH, f[0])
  }
  cek('2: berkas grup terunduh', berkas != null)
  const grup = JSON.parse(fs.readFileSync(berkas, 'utf8'))
  cek('2: formasi ikut (1 drill, 5 set)',
    (grup.drills ?? []).length === 1 && (grup.sets ?? []).length === 5,
    `${(grup.drills ?? []).length} drill, ${(grup.sets ?? []).length} set`)
  fs.writeFileSync(PAKET, JSON.stringify(grup))

  /* ================= 3. Anggota: ambil materi + pilih nama ================= */
  const B = await perangkatAnggota()
  await (await B.$('[data-testid="ambil-materi"]')).click()
  await wait(3200)
  const tabKuis = await B.$('[data-testid="tab-kuis"]')
  cek('3: tab Kuis ada di deretan tab anggota', tabKuis != null)
  const namaDiklik = await B.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) =>
      [...x.querySelectorAll('span')].some((s) => s.textContent.trim() === 'Citra Dewi'))
    if (!b) return false
    b.click()
    return true
  })
  cek('3: anggota memilih namanya', namaDiklik)
  await wait(600)
  if (tabKuis) await tabKuis.click()
  await wait(1500)
  cek('3: soal pertama dari empat', (await teks(B, 'soal-ke')) === 'Soal 1 dari 4', await teks(B, 'soal-ke'))
  cek('3: peta kuis tampil', await ada(B, 'peta-kuis'))
  cek('3: kunci mati sebelum mengetuk',
    await B.evaluate(() => document.querySelector('[data-testid="kunci-jawaban"]')?.disabled === true))
  cek('3: skor awal nol', (await teks(B, 'skor-kuis')) === 'Benar 0 dari 0', await teks(B, 'skor-kuis'))

  // Data untuk menghitung ketukan yang tepat: dari paketnya sendiri.
  const { paket, meId } = await bacaPaket(B)
  cek('3: paket terbaca dari HP anggota', paket != null && meId !== '', `meId=${meId.slice(0, 8)}`)
  const f = paket.drills[0].field
  const halfL = (f.lengthYd + f.endZoneYd * 2) / 2
  const halfW = f.widthYd / 2
  const VW = f.lengthYd + f.endZoneYd * 2
  const VH = f.widthYd
  const sx = (x) => halfL - x
  const sy = (y) => halfW - y
  const sets = [...paket.sets].sort((a, b) => a.order - b.order)
  const kunciSoal = (i) => sets[i + 1].points[meId]

  /* ================= 4. Soal 1: ketuk tepat → Tepat ================= */
  {
    const k = kunciSoal(0)
    const pk = await pikselUntuk(B, sx(k.x), sy(k.y))
    await B.mouse.click(pk.x, pk.y)
    await B.waitForSelector('[data-testid="penanda-tebakan"]', { timeout: 5000 })
    cek('4: penanda tebakan muncul', true)
    await (await B.$('[data-testid="kunci-jawaban"]')).click()
    await B.waitForSelector('[data-testid="hasil-kuis"]', { timeout: 5000 })
    const hasil = await teks(B, 'hasil-kuis')
    cek('4: ketukan tepat dinilai Tepat', hasil.startsWith('Tepat!'), hasil.slice(0, 60))
    const j1 = parseFloat((hasil.match(/jarak tebakanmu ([\d.]+) langkah/i) ?? [])[1] ?? 'NaN')
    cek('4: jaraknya mendekati nol (< 0,5 langkah)', Number.isFinite(j1) && j1 < 0.5, hasil.slice(0, 80))
    cek('4: skor 1 dari 1', (await teks(B, 'skor-kuis')) === 'Benar 1 dari 1', await teks(B, 'skor-kuis'))
    cek('4: kunci peta ditampilkan', await ada(B, 'penanda-kunci'))
  }

  /* ================= 5. Soal 2: sudut terjauh → Belum tepat ================= */
  await (await B.$('[data-testid="lanjut-kuis"]')).click()
  await wait(900)
  cek('5: maju ke soal 2', (await teks(B, 'soal-ke')) === 'Soal 2 dari 4', await teks(B, 'soal-ke'))
  {
    const k = kunciSoal(1)
    // Sudut terjauh dari kunci — pasti puluhan yard, toleransinya 2 langkah.
    const sudut = [
      { x: -halfL, y: -halfW }, { x: halfL, y: -halfW }, { x: -halfL, y: halfW }, { x: halfL, y: halfW },
    ].sort((a, b) => Math.hypot(b.x - k.x, b.y - k.y) - Math.hypot(a.x - k.x, a.y - k.y))[0]
    // Mundur sedikit ke dalam supaya ketukannya tidak miss di tepi svg.
    const px = sx(k.x) + (sx(sudut.x) - sx(k.x)) * 0.92
    const py = sy(k.y) + (sy(sudut.y) - sy(k.y)) * 0.92
    const pk = await pikselUntuk(B, px, py)
    await B.mouse.click(pk.x, pk.y)
    await B.waitForSelector('[data-testid="penanda-tebakan"]', { timeout: 5000 })
    await (await B.$('[data-testid="kunci-jawaban"]')).click()
    await B.waitForSelector('[data-testid="hasil-kuis"]', { timeout: 5000 })
    const hasil = await teks(B, 'hasil-kuis')
    cek('5: ketukan jauh dinilai Belum tepat', hasil.startsWith('Belum tepat'), hasil.slice(0, 60))
    cek('5: jaraknya ditampilkan', /jarak tebakanmu [\d.]+ langkah/i.test(hasil), hasil.slice(0, 80))
    const koor = await teks(B, 'kunci-koor')
    cek('5: koordinat kunci ditampilkan', koor.length > 3, koor.slice(0, 40))
    cek('5: skor tetap 1 dari 2', (await teks(B, 'skor-kuis')) === 'Benar 1 dari 2', await teks(B, 'skor-kuis'))
  }

  /* ================= 6. Soal 3: geser lalu kunci → Tepat ================= */
  await (await B.$('[data-testid="lanjut-kuis"]')).click()
  await wait(900)
  {
    const k = kunciSoal(2)
    const salah = await pikselUntuk(B, VW / 2, VH / 2)
    await B.mouse.click(salah.x, salah.y)
    await B.waitForSelector('[data-testid="penanda-tebakan"]', { timeout: 5000 })
    const cx1 = await B.evaluate(() => document.querySelector('[data-testid="penanda-tebakan"] circle')?.getAttribute('cx') ?? '')
    const pk = await pikselUntuk(B, sx(k.x), sy(k.y))
    await B.mouse.click(pk.x, pk.y)
    await wait(500)
    const cx2 = await B.evaluate(() => document.querySelector('[data-testid="penanda-tebakan"] circle')?.getAttribute('cx') ?? '')
    cek('6: ketukan kedua menggeser penanda', cx1 !== '' && cx2 !== '' && cx1 !== cx2, `${cx1} → ${cx2}`)
    await (await B.$('[data-testid="kunci-jawaban"]')).click()
    await B.waitForSelector('[data-testid="hasil-kuis"]', { timeout: 5000 })
    cek('6: sesudah digeser ke kunci → Tepat', (await teks(B, 'hasil-kuis')).startsWith('Tepat!'))
    cek('6: skor 2 dari 3', (await teks(B, 'skor-kuis')) === 'Benar 2 dari 3', await teks(B, 'skor-kuis'))
  }

  /* ================= 7. Soal 4 + selesai + ulangi + acak ================= */
  await (await B.$('[data-testid="lanjut-kuis"]')).click()
  await wait(900)
  {
    const k = kunciSoal(3)
    const pk = await pikselUntuk(B, sx(k.x), sy(k.y))
    await B.mouse.click(pk.x, pk.y)
    await B.waitForSelector('[data-testid="penanda-tebakan"]', { timeout: 5000 })
    await (await B.$('[data-testid="kunci-jawaban"]')).click()
    await B.waitForSelector('[data-testid="hasil-kuis"]', { timeout: 5000 })
    const labelLanjut = await B.evaluate(() => document.querySelector('[data-testid="lanjut-kuis"]')?.textContent.trim() ?? '')
    cek('7: soal terakhir menawari Lihat skor', labelLanjut === 'Lihat skor', labelLanjut)
    await (await B.$('[data-testid="lanjut-kuis"]')).click()
    await B.waitForSelector('[data-testid="selesai-kuis"]', { timeout: 5000 })
    const selesai = await teks(B, 'selesai-kuis')
    cek('7: skor akhir 3 dari 4', /3.*dari 4/.test(selesai), selesai.slice(0, 80))
    await (await B.$('[data-testid="ulang-kuis"]')).click()
    await wait(900)
    cek('7: main lagi mengulang dari soal 1', (await teks(B, 'soal-ke')) === 'Soal 1 dari 4', await teks(B, 'soal-ke'))
    cek('7: skor di-nol-kan', (await teks(B, 'skor-kuis')) === 'Benar 0 dari 0', await teks(B, 'skor-kuis'))
    await (await B.$('[data-testid="acak-kuis"]')).click()
    await wait(900)
    const acak = await teks(B, 'soal-ke')
    cek('7: acak menandai urutan acak', acak === 'Soal 1 dari 4 · acak', acak)
  }

  /* ================= 8. Layar 360px tidak melebar ================= */
  {
    await B.setViewport({ width: 360, height: 740 })
    await B.goto(`${BASE}/#/berbagi`, { waitUntil: 'networkidle2' })
    await wait(2200)
    await B.evaluate(() => document.querySelector('[data-testid="tab-kuis"]')?.click())
    await wait(1500)
    const l = await B.evaluate(() => ({
      dok: document.documentElement.scrollWidth,
      layar: window.innerWidth,
      tab: document.querySelector('[data-testid="tab-kuis"]') != null,
      peta: document.querySelector('[data-testid="peta-kuis"]') != null,
    }))
    cek('8: tab Kuis tampil di 360px', l.tab && l.peta, JSON.stringify(l))
    cek('8: dokumen tidak melebarkan layar 360px', l.dok <= l.layar + 1, `dok ${l.dok} lawan layar ${l.layar}`)
  }

  cek('tidak ada galat di konsol', errors.length === 0, errors.slice(0, 3).join(' | '))
} finally {
  try { fs.unlinkSync(PAKET) } catch { /* tidak apa-apa */ }
  await browser.close()
}

console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) {
  for (const g of gagal) console.log('  ✗ ' + g)
  process.exitCode = 1
}
