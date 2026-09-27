/**
 * #4 — uji peramban tempo latihan.
 *
 * Lagu uji: 4/4 @240 = 1 dtk per birama pada tempo asli.
 *   1. Kendali −5% ×10 → 50%, lencana & "120 BPM (asli 240)", panel ikut.
 *   2. Diingat setelah dimuat ulang; daftar lagu & set list menandainya;
 *      "Semua ke tempo asli".
 *   3. Naik otomatis 70% +10% tiap putaran sampai 100%, lalu berhenti.
 *   4. Presenter drill ikut melambat & bisa kembali ke tempo asli.
 *   (Mode anggota diperiksa di musik-anggota.mjs, yang sudah menyiapkan materi.)
 *
 * Pakai: BASE=http://localhost:4173 node tempo-latihan.mjs
 */
import puppeteer from 'puppeteer'
import { lewatSambutan } from './sambutan.mjs'
import { segar, tanamBaris, tanamLagu } from './db-mentah.mjs'

const BASE = process.env.BASE || process.argv[2] || 'http://localhost:5173'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
let lulus = 0
const gagal = []
const uji = (nama, ok, ket = '') => {
  if (ok) { lulus++; console.log('  ✓ ' + nama) } else { gagal.push(nama); console.log('  ✗ ' + nama + (ket ? ' → ' + ket : '')) }
}

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'],
})
const errors = []
const p = await browser.newPage()
await p.setViewport({ width: 1280, height: 1500 })
p.on('pageerror', (e) => errors.push(String(e)))
const teks = (sel, h = p) => h.$eval(sel, (e) => e.textContent.trim()).catch(() => null)
const ada = async (sel, h = p) => (await h.$(sel)) !== null
const klik = async (sel, h = p) => { await h.click(sel); await wait(350) }
const isi = async (sel, v) => {
  await p.evaluate((s, v) => {
    const el = document.querySelector(s)
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    set.call(el, String(v)); el.dispatchEvent(new Event('input', { bubbles: true }))
  }, sel, v)
  await wait(400)
}
const pilihLagu = async (id) => { await p.click(`[data-testid="pilih-lagu-${id}"]`); await wait(900) }

try {
  await p.goto(BASE + '/', { waitUntil: 'networkidle2' })
  await lewatSambutan(p)
  await tanamLagu(p, [
    { id: 'tl_a', title: 'Lagu Latihan A', bpm: 240, beats: 4, tempoMap: [], createdAt: 1, panjangBirama: 8, ulangBagian: { dari: 1, sampai: 1, aktif: 0 } },
    { id: 'tl_b', title: 'Lagu Latihan B', bpm: 100, beats: 4, tempoMap: [], createdAt: 2, panjangBirama: 8 },
  ], ['Lagu Latihan A', 'Lagu Latihan B'])
  await tanamBaris(p, 'setlists', { id: 'sl_tl', name: 'Show Latihan', songIds: ['tl_a', 'tl_b'], createdAt: 1, updatedAt: 1 })
  await segar(p)
  await p.evaluate(() => { location.hash = '#/musik' })
  await wait(2000)

  console.log('\n— 1. Kendali tempo latihan —')
  await pilihLagu('tl_a')
  uji('kartu tempo latihan ada', await ada('[data-testid="kartu-tempo-latihan"]'))
  uji('awal: 100%', (await teks('[data-testid="latihan-nilai"]')) === '100%')
  for (let i = 0; i < 10; i++) await klik('[data-testid="latihan-kurang"]')
  uji('−5% ×10 → 50%', (await teks('[data-testid="latihan-nilai"]')) === '50%', await teks('[data-testid="latihan-nilai"]'))
  uji('lencana "Latihan 50%"', (await teks('[data-testid="lencana-tempo-latihan"]')) === 'Latihan 50%')
  uji('"120 BPM (asli 240)"', (await teks('[data-testid="latihan-bpm"]')) === '120 BPM (asli 240)', await teks('[data-testid="latihan-bpm"]'))
  uji('panel lagu ikut: 120 BPM', (await teks('[data-testid="panel-tempo"]'))?.startsWith('120 BPM'), await teks('[data-testid="panel-tempo"]'))
  uji('data lagu tidak berubah (bpm 240)', (await p.$eval('[data-testid="bpm"]', (e) => e.value)) === '240')

  console.log('\n— 2. Diingat, ditandai, set list —')
  await p.reload({ waitUntil: 'networkidle2' }); await wait(2000)
  await pilihLagu('tl_a')
  uji('setelah dimuat ulang tetap 50%', (await teks('[data-testid="latihan-nilai"]')) === '50%')
  uji('daftar lagu menandai lagu A', (await teks('[data-testid="lencana-tempo-latihan-tl_a"]')) === 'Latihan 50%')
  uji('lagu B tidak ditandai', !(await ada('[data-testid="lencana-tempo-latihan-tl_b"]')))
  await pilihLagu('tl_b')
  uji('lagu B tempo asli (per lagu)', (await teks('[data-testid="latihan-nilai"]')) === '100%')
  await p.select('[data-testid="pilih-setlist"]', 'sl_tl'); await wait(900)
  uji('set list menandai tempo latihan', await ada('[data-testid="setlist-ada-latihan"]'))
  uji('baris lagu A: 120 BPM (asli 240)', (await teks('[data-testid="setlist-latihan-0"]'))?.includes('120 BPM (asli 240)'), await teks('[data-testid="setlist-latihan-0"]'))
  uji('total set list memakai tempo latihan (16 + 19,2 dtk = 0:35)', (await teks('[data-testid="setlist-total"]')) === '0:35', await teks('[data-testid="setlist-total"]'))
  await klik('[data-testid="setlist-semua-asli"]')
  uji('Semua ke tempo asli', !(await ada('[data-testid="setlist-ada-latihan"]')))
  uji('total kembali 0:27 (8 + 19,2)', (await teks('[data-testid="setlist-total"]')) === '0:27', await teks('[data-testid="setlist-total"]'))

  console.log('\n— 3. Naik otomatis —')
  await pilihLagu('tl_a')
  await klik('[data-testid="tombol-ulang-bagian"]')
  await p.click('[data-testid="naik-otomatis"]'); await wait(400)
  // 70% +10% tiap putaran sampai 100%, lalu berhenti.
  await p.$eval('[data-testid="naik-langkah"]', (e) => e.focus())
  await p.keyboard.down('Control'); await p.keyboard.press('a'); await p.keyboard.up('Control')
  await p.keyboard.type('10'); await p.keyboard.press('Enter'); await wait(300)
  await p.select('[data-testid="naik-akhir"]', 'berhenti'); await wait(300)
  await klik('[data-testid="tombol-mulai"]')
  await wait(400)
  uji('putaran 1 · 70%', (await teks('[data-testid="naik-putaran"]'))?.startsWith('Putaran 1 · 70% → 100%'), await teks('[data-testid="naik-putaran"]'))
  await wait(2200)
  const t2 = await teks('[data-testid="naik-putaran"]')
  uji('putaran naik (2 atau 3)', /Putaran [23] · (80|90)%/.test(t2 ?? ''), t2)
  await wait(4500)
  uji('berhenti sendiri di tujuan', (await teks('[data-testid="tombol-mulai"]'))?.includes('Mulai'), await teks('[data-testid="tombol-mulai"]'))
  uji('tempo terakhir diingat: 100%', (await teks('[data-testid="latihan-nilai"]')) === '100%', await teks('[data-testid="latihan-nilai"]'))
  // matikan kembali
  await p.click('[data-testid="naik-otomatis"]'); await wait(300)
  await klik('[data-testid="tombol-ulang-bagian"]')

  console.log('\n— 4. Presenter drill —')
  await tanamBaris(p, 'drills', {
    id: 'tl_drill', name: 'Drill Tempo Latihan', showTitle: 'Drill Tempo Latihan', tempo: 120, beatsPerCount: 1,
    rosterIds: [], songId: 'tl_b', createdAt: Date.now(), updatedAt: Date.now(),
    field: { widthYd: 53.33, lengthYd: 100, endZoneYd: 10, gridYd: 5, hash: 'ncaa', step: '8to5', customStepYd: 0.8333, showLabels: 1, satuan: 'yd' },
  })
  await tanamBaris(p, 'sets', [0, 1].map((s) => ({ id: 'tl_set' + s, drillId: 'tl_drill', order: s, name: 'Set ' + (s + 1), counts: 8, points: {}, createdAt: Date.now() })))
  await segar(p)
  await p.evaluate(() => { location.hash = '#/musik' }); await wait(1500)
  await pilihLagu('tl_b')
  for (let i = 0; i < 4; i++) await klik('[data-testid="latihan-kurang"]')
  await p.evaluate(() => { location.hash = '#/drill' }); await wait(1500)
  await p.evaluate(() => {
    ;[...document.querySelectorAll('button,a,li,div')].find((b) => b.textContent.trim() === 'Drill Tempo Latihan' && b.offsetParent !== null)?.click()
  })
  await wait(1500)
  uji('editor: lencana tempo latihan disatukan dgn kecepatan', (await teks('[data-testid="drill-latihan"]'))?.includes('Latihan 80%'), await teks('[data-testid="drill-latihan"]'))
  await (await p.$('[title*="Mode presenter"]'))?.click(); await wait(1300)
  uji('presenter ikut melambat (80)', Number(await teks('[data-testid="tempo-presenter"]')) === 80, await teks('[data-testid="tempo-presenter"]'))
  uji('presenter: lencana', (await teks('[data-testid="presenter-latihan"]'))?.includes('Latihan 80% · 80 BPM (asli 100)'), await teks('[data-testid="presenter-latihan"]'))
  await klik('[data-testid="presenter-tempo-asli"]'); await wait(400)
  uji('presenter: tombol tempo asli', Number(await teks('[data-testid="tempo-presenter"]')) === 100, await teks('[data-testid="tempo-presenter"]'))
  uji('presenter: lencana hilang', !(await ada('[data-testid="presenter-latihan"]')))
  await p.click('[data-testid="tutup-presenter"]').catch(() => {})

  // 5. Mode anggota: diperiksa di musik-anggota.mjs (butuh materi pelatih).
} catch (e) {
  gagal.push('pengecualian: ' + e.message)
  console.log(e)
}
uji('tanpa galat halaman', errors.length === 0, errors.join(' | '))
await browser.close()
console.log(`\n=== ${lulus} lulus, ${gagal.length} gagal ===`)
if (gagal.length) process.exitCode = 1
