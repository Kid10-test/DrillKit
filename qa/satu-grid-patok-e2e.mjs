/**
 * v2.9 — "Satu Grid Patok" dari antarmuka sungguhan (editor drill).
 *
 * Lapangan sepak bola dengan patok (A di tengah, 8-to-5):
 *  1. garis lapangan yang digambar = garis patok (huruf, #, T) — tidak ada
 *     grid kedua yang berjarak lain; label T dimulai dari T0 di tepi depan;
 *  2. inspektor titik menulis koordinat patok + jarak pita meteran
 *     ("5,72 m dari A · 13,72 m dari T0");
 *  3. panel snap memakai titik nol A & T0 dan menyediakan tombol
 *     "Tempel ke patok" (hanya bila patok aktif);
 *  4. garis bantu tiap langkah bisa dinyalakan dan jatuh tepat di kelipatan
 *     langkah dari A.
 *
 * Pakai: BASE=http://localhost:4173 node satu-grid-patok-e2e.mjs
 */
import puppeteer from 'puppeteer'
import { lewatSambutan } from './sambutan.mjs'
import { bacaSemua, segar, tanamBaris } from './db-mentah.mjs'

const BASE = process.env.BASE || process.argv[2] || 'http://localhost:4173'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

let lulus = 0
let gagal = 0
function uji(nama, ok, detail = '') {
  if (ok) {
    lulus++
    console.log('  ✓ ' + nama)
  } else {
    gagal++
    console.log('  ✗ ' + nama + (detail ? ' → ' + detail : ''))
  }
}

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
})
const p = await browser.newPage()
await p.setViewport({ width: 1366, height: 1000 })
const errors = []
p.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text())
})
p.on('pageerror', (e) => errors.push(String(e)))

await p.goto(BASE.startsWith('file:') ? BASE : BASE + '/', { waitUntil: 'networkidle2' })
await lewatSambutan(p)
await wait(1800)

/* -------------------------------- Data uji -------------------------------- */
const M_TO_YD = 1 / 0.9144
const LEBAR = 68 * M_TO_YD
const S = 0.625 // 8-to-5
const T0Y = -LEBAR / 2
const drillId = 'uji-satu-grid'
const memberId = 'uji-sg-m1'

await tanamBaris(p, 'members', {
  id: memberId,
  name: 'Pemain Grid',
  code: 'PG',
  section: 'brass',
  instrument: 'Trumpet',
  role: 'member',
  joinYear: 2026,
  active: 1,
})
await tanamBaris(p, 'drills', {
  id: drillId,
  name: 'Drill Satu Grid',
  showTitle: 'Drill Satu Grid',
  tempo: 120,
  beatsPerCount: 1,
  rosterIds: [memberId],
  createdAt: Date.now(),
  updatedAt: Date.now(),
  field: {
    widthYd: LEBAR,
    lengthYd: 105 * M_TO_YD,
    endZoneYd: 0,
    hash: 'none',
    step: '8to5',
    customStepYd: 0.625,
    showLabels: 1,
    satuan: 'm',
    gridTampil: 1,
    patok: {
      aktif: 1,
      sumbuHuruf: 'x',
      dariTengah: 1,
      awalanT: 1,
      penandaSisi: 1,
      jarakHuruf: 8,
      jarakHash: 4,
      jarakT: 8,
    },
  },
})
const setLama = (await bacaSemua(p, 'sets')).filter((x) => x.drillId === drillId)
await tanamBaris(
  p,
  'sets',
  [
    {
      id: 'uji-sg-set-0',
      drillId,
      order: 0,
      name: 'Set 1',
      counts: 8,
      // B +2 · T3 = 10 langkah dari A, 24 langkah dari tepi depan
      points: { [memberId]: { x: 10 * S, y: T0Y + 24 * S, facing: 'front' } },
      createdAt: Date.now(),
    },
  ],
  setLama.map((x) => x.id),
)
await segar(p)

await p.evaluate(() => {
  location.hash = '#/drill'
})
await wait(1500)
await p.evaluate(() => {
  const el = [...document.querySelectorAll('button,a,li,div')].find(
    (b) => b.textContent.trim() === 'Drill Satu Grid' && b.offsetParent !== null,
  )
  el?.click()
})
await p.waitForSelector('[data-lap="rumput"]', { timeout: 15000 }).catch(() => {})
await wait(800)

/* ---------------------- 1. garis lapangan = garis patok ---------------------- */
console.log('\n— 1. Garis lapangan = garis patok, T dimulai T0 —')
const lap = await p.evaluate(() => {
  const teks = [...document.querySelectorAll('svg text')].map((t) => t.textContent.trim())
  const garis = [...document.querySelectorAll('[data-lap="garis"],[data-lap="garis-tengah"]')]
  return {
    jmlGaris: garis.length,
    labelGaris: garis.map((g) => g.getAttribute('data-label-garis')).filter(Boolean),
    adaT0: teks.includes('T0'),
    adaA: teks.includes('A'),
    adaSub: document.querySelectorAll('[data-lap="subgrid"]').length,
    adaYard45: teks.includes('45'),
  }
})
// 105 m / 4,572 m per huruf → A ± 11 huruf+# ; 68 m / 4,572 → T0..T14
uji('label T0 tergambar di lapangan', lap.adaT0, JSON.stringify(lap).slice(0, 200))
uji('label A tergambar di lapangan', lap.adaA)
uji('label yard (45) TIDAK ikut tergambar saat label patok', !lap.adaYard45)
uji('setiap garis lapangan berlabel patok (A, A#, B…, T0, T1…)',
  lap.jmlGaris > 30 && lap.labelGaris.length === lap.jmlGaris &&
  lap.labelGaris.every((l) => /^(T\d+|[A-Z]'?#?'?)$/.test(l)),
  `${lap.jmlGaris} garis, contoh ${lap.labelGaris.slice(0, 6).join(',')}`)
uji('garis bantu langkah mati secara bawaan', lap.adaSub === 0, String(lap.adaSub))

// Opsional: TANGKAP=/tmp/x.png menyimpan tangkapan layar editor untuk diperiksa mata
if (process.env.TANGKAP) await p.screenshot({ path: process.env.TANGKAP })

/* ---------------------- 2. inspektor: patok + meter ---------------------- */
console.log('\n— 2. Inspektor titik —')
const kotak = await p.evaluate(() => {
  const g = document.querySelector('g.cursor-move')
  if (!g) return null
  g.scrollIntoView({ block: 'center' })
  const r = g.getBoundingClientRect()
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
})
if (kotak) {
  await p.mouse.click(kotak.x, kotak.y)
}
await p.waitForSelector('[data-testid="meter-titik"]', { timeout: 6000 }).catch(() => {})
const insp = await p.evaluate(() => ({
  koor: document.querySelector('[data-live-coord]')?.textContent.trim() ?? null,
  meter: document.querySelector('[data-testid="meter-titik"]')?.textContent.trim() ?? null,
}))
uji('koordinat patok titik = "B +2 · T3"', insp.koor === 'B +2 · T3', String(insp.koor))
uji('jarak meteran = "5,72 m dari A · 13,72 m dari T0"', insp.meter === '5,72 m dari A · 13,72 m dari T0', String(insp.meter))

/* ---------------------- 3. panel snap & tempel ke patok ---------------------- */
console.log('\n— 3. Snap dari A & T0 + Tempel ke patok —')
const snap = await p.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Snap ke langkah'))
  return {
    label: btn?.textContent.trim() ?? '',
    tempel: !!document.querySelector('[data-testid="tempel-patok"]'),
  }
})
uji('label snap menyebut titik nol A & T0', /dari A & T0/.test(snap.label), snap.label)
uji('tombol "Tempel ke patok" tersedia saat patok aktif', snap.tempel)
if (snap.tempel) {
  await p.click('[data-testid="tempel-patok"]')
  await wait(300)
}
const nyala = await p.evaluate(
  () => document.querySelector('[data-testid="tempel-patok"] span:last-child')?.className.includes('bg-emerald') ?? false,
)
uji('"Tempel ke patok" bisa dinyalakan', nyala)

/* ---------------------- 4. garis bantu tiap langkah ---------------------- */
console.log('\n— 4. Garis bantu tiap langkah —')
// Nyalakan lewat basis data (setara pilihan "Garis bantu tiap langkah" di Pengaturan drill)
const drill = (await bacaSemua(p, 'drills')).find((d) => d.id === drillId)
await tanamBaris(p, 'drills', { ...drill, field: { ...drill.field, subgridTampil: 1 } })
await segar(p)
await p.evaluate(() => {
  location.hash = '#/drill'
})
await wait(1500)
await p.evaluate(() => {
  const el = [...document.querySelectorAll('button,a,li,div')].find(
    (b) => b.textContent.trim() === 'Drill Satu Grid' && b.offsetParent !== null,
  )
  el?.click()
})
await p.waitForSelector('[data-lap="subgrid"]', { timeout: 15000 }).catch(() => {})
const sub = await p.evaluate(() => document.querySelectorAll('[data-lap="subgrid"]').length)
uji('garis bantu langkah tergambar bila dinyalakan (ratusan garis tipis)', sub > 200, String(sub))

uji('tanpa galat konsol', errors.length === 0, errors.slice(0, 3).join(' | '))

await browser.close()
console.log(`\n${lulus} lulus, ${gagal} gagal`)
process.exit(gagal ? 1 : 0)
