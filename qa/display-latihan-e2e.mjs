/**
 * Uji peramban v2.12 — Display Latihan.
 *
 * Alur pelatih: buka Drill → Display → pilih konsep, lapangan, dan sesi →
 * pratinjau → Buat drill. Yang diperiksa: daftar pemain diambil dari
 * kehadiran sesi (hanya yang 'hadir'), pemain bisa dikeluarkan, ukuran
 * Student Center/indoor ikut tersimpan, set & hitungan tertulis ke
 * IndexedDB, dan editor langsung membuka drill baru.
 */
import puppeteer from 'puppeteer'
import { lewatSambutan } from './sambutan.mjs'

const BASE = process.env.BASE || 'http://localhost:4173'
const browser = await puppeteer.launch({
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  defaultViewport: { width: 1366, height: 1000 },
})
const p = await browser.newPage()
const errors = []
p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
p.on('pageerror', (e) => errors.push(String(e)))

let lulus = 0
const gagal = []
const cek = (nama, syarat, keterangan = '') => {
  if (syarat) lulus += 1
  else gagal.push(`${nama}${keterangan ? ' — ' + keterangan : ''}`)
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const ada = async (sel) => (await p.$(sel)) != null
const tombol = (t) =>
  p.evaluate((x) => {
    const b = [...document.querySelectorAll('button')].find((y) => y.textContent.trim() === x || y.textContent.includes(x))
    if (!b || b.disabled) return false
    b.click()
    return true
  }, t)
const semua = (store) =>
  p.evaluate(async (s) => {
    const r = await new Promise((res) => { const q = indexedDB.open('drillkit'); q.onsuccess = () => res(q.result) })
    return await new Promise((res) => { const g = r.transaction(s).objectStore(s).getAll(); g.onsuccess = () => res(g.result) })
  }, store)
const teksRingkas = () => p.$eval('[data-testid="modal-display-latihan"] details summary', (e) => e.textContent.trim())
const jumlahIkut = async () => Number((await teksRingkas()).match(/^(\d+) orang/)?.[1] ?? -1)

await p.goto(BASE, { waitUntil: 'networkidle2' })
await lewatSambutan(p)
await wait(1200)
await tombol('Muat data contoh')
await wait(4000)

// Sesi uji hari ini: 12 anggota aktif hadir, 3 izin, sisanya tidak dicatat.
const seed = await p.evaluate(async () => {
  const r = await new Promise((res) => { const q = indexedDB.open('drillkit'); q.onsuccess = () => res(q.result) })
  const ambil = (store) =>
    new Promise((res) => { const g = r.transaction(store).objectStore(store).getAll(); g.onsuccess = () => res(g.result) })
  const anggota = (await ambil('members')).filter((m) => m.active)
  const sesiLama = (await ambil('sessions'))[0]
  const hadir = anggota.slice(0, 12)
  const izin = anggota.slice(12, 15)
  const tgl = '2099-12-31'
  const tx = r.transaction(['sessions', 'attendance'], 'readwrite')
  tx.objectStore('sessions').put({
    ...(sesiLama ?? { type: 'latihan', checklist: [] }),
    id: 'ses_uji_display',
    title: 'Latihan uji display',
    date: tgl,
    startTime: '18:00',
    endTime: '20:00',
    createdAt: Date.now(),
  })
  for (const m of hadir)
    tx.objectStore('attendance').put({ id: `att_uji_${m.id}`, sessionId: 'ses_uji_display', memberId: m.id, status: 'hadir' })
  for (const m of izin)
    tx.objectStore('attendance').put({ id: `att_uji_${m.id}`, sessionId: 'ses_uji_display', memberId: m.id, status: 'izin' })
  await new Promise((res) => { tx.oncomplete = res })
  return { aktif: anggota.length, hadir: hadir.map((m) => m.id), izin: izin.map((m) => m.id) }
})
cek('seed: cukup anggota aktif', seed.aktif >= 15, String(seed.aktif))
const drillSebelum = (await semua('drills')).length

// Tulisan langsung ke IndexedDB tidak lewat cache kueri Dexie: muat ulang.
await p.evaluate(() => { location.hash = '#/drill' })
await p.reload({ waitUntil: 'networkidle2' })
await p.waitForSelector('[data-testid="buka-display-latihan"]', { timeout: 15000 })
await wait(600)
await p.click('[data-testid="buka-display-latihan"]')
await p.waitForSelector('[data-testid="modal-display-latihan"]', { timeout: 5000 })
await wait(800)

// --- sumber pemain: sesi terbaru otomatis terpilih --------------------
cek('sesi uji terpilih otomatis', await p.$eval('[data-testid="display-sesi"]', (e) => e.value) === 'ses_uji_display')
cek('hanya yang hadir ikut (12)', (await jumlahIkut()) === 12, await teksRingkas())
cek('izin tidak ikut', !(await p.$eval('[data-testid="modal-display-latihan"]', (e) => e.textContent)).includes('15 orang'))
await p.select('[data-testid="display-sumber"]', 'aktif')
await wait(300)
cek('semua anggota aktif', (await jumlahIkut()) === seed.aktif, await teksRingkas())
await p.select('[data-testid="display-sumber"]', 'sesi')
await wait(300)
cek('kembali ke sesi (12)', (await jumlahIkut()) === 12)

// --- konsep & pratinjau ---------------------------------------------
cek('Konsep 1 terpilih bawaan', await p.$eval('[data-testid="konsep-display-1"]', (e) => e.getAttribute('aria-pressed') === 'true'))
cek('pratinjau Konsep 1: 2 set', (await p.$$('[data-testid="pratinjau-display"] figure')).length === 2)
cek('Konsep 1: tanpa alat', (await p.$eval('[data-testid="modal-display-latihan"]', (e) => e.textContent)).includes('Tanpa alat'))
await p.click('[data-testid="konsep-display-2"]')
await wait(400)
cek('Konsep 2: 3 set', (await p.$$('[data-testid="pratinjau-display"] figure')).length === 3)
cek('Konsep 2: 2 baris transisi', (await p.$$('[data-testid="baris-transisi-display"]')).length === 2)
const barisHitungan = await p.$$eval('[data-testid="baris-transisi-display"]', (r) => r.map((x) => Number(x.children[1].textContent)))
cek('hitungan kelipatan 8', barisHitungan.every((c) => c >= 16 && c % 8 === 0), JSON.stringify(barisHitungan))
const dotPratinjau = await p.$$eval('[data-testid="pratinjau-display"] figure:first-child circle', (c) => c.length)
cek('pratinjau set 1: 12 dot', dotPratinjau === 12, String(dotPratinjau))

// --- lapangan indoor -------------------------------------------------
await p.click('[data-testid="display-lapangan-indoor"]')
await wait(300)
cek('isian ukuran indoor muncul', await ada('[data-testid="display-panjang"]'))
const isi = async (sel, v) => {
  await p.click(sel, { clickCount: 3 })
  await p.keyboard.type(String(v))
}
await isi('[data-testid="display-panjang"]', 30)
await isi('[data-testid="display-lebar"]', 18)
await wait(400)
const bingkaiSvg = await p.$eval('[data-testid="pratinjau-display"] svg', (s) => ({ w: s.viewBox.baseVal.width, h: s.viewBox.baseVal.height, garis: [...s.querySelectorAll('line')].map((l) => Number(l.getAttribute('x2'))) }))
// Garis tepi depan membentang sepanjang lapangan 30 m.
cek('pratinjau mengikuti 30 × 18 m', bingkaiSvg.garis.some((x) => Math.abs(x - 30 * 1.09361) < 1e-3) && bingkaiSvg.w <= 30 * 1.09361 + 1e-6 && bingkaiSvg.h <= 18 * 1.09361 + 1e-6, JSON.stringify(bingkaiSvg))

// --- keluarkan satu pemain -------------------------------------------
await p.evaluate(() => { document.querySelector('[data-testid="modal-display-latihan"] details').open = true })
await wait(200)
const kotak = await p.$$('[data-testid="modal-display-latihan"] details input[type="checkbox"]')
cek('12 kotak centang', kotak.length === 12, String(kotak.length))
await kotak[0].click()
await wait(300)
cek('satu dikeluarkan → 11', (await jumlahIkut()) === 11, await teksRingkas())
cek('ringkasan menyebut dikeluarkan', (await teksRingkas()).includes('1 dikeluarkan'))

// --- buat drill -------------------------------------------------------
await p.click('[data-testid="buat-display"]')
await wait(1500)
cek('modal tertutup', !(await ada('[data-testid="modal-display-latihan"]')))
const drills = await semua('drills')
cek('satu drill baru', drills.length === drillSebelum + 1, `${drillSebelum} → ${drills.length}`)
const d = drills.find((x) => x.name.startsWith('Display Latihan 2'))
cek('nama drill', d?.name === 'Display Latihan 2 — Garis ke Busur', d?.name)
cek('judul menyebut jumlah & lapangan', d?.showTitle.includes('11 orang') && d?.showTitle.includes('30 × 18 m'), d?.showTitle)
cek('roster 11', d?.rosterIds.length === 11)
cek('roster hanya yang hadir', d?.rosterIds.every((id) => seed.hadir.includes(id)))
const M_TO_YD = 1.09361 // sama dengan src/lib/field.ts
cek('lapangan 30 × 18 m', Math.abs(d?.field.lengthYd - 30 * M_TO_YD) < 1e-6 && Math.abs(d?.field.widthYd - 18 * M_TO_YD) < 1e-6, `${d?.field.lengthYd} × ${d?.field.widthYd}`)
cek('patok aktif', d?.field.patok?.aktif === 1)
const sets = (await semua('sets')).filter((s) => s.drillId === d?.id).sort((a, b) => a.order - b.order)
cek('3 set', sets.length === 3, String(sets.length))
cek('nama set', sets.map((s) => s.name).join('|') === 'Set 1 · Blok|Set 2 · Company front|Set 3 · Busur terbuka', sets.map((s) => s.name).join('|'))
cek('tiap set 11 dot', sets.every((s) => Object.keys(s.points).length === 11))
cek('set terakhir diam (0 hitungan)', sets[2]?.counts === 0)
cek('hitungan sama dengan pratinjau', sets[0]?.counts === barisHitungan[0] && sets[1]?.counts === barisHitungan[1])
cek('catatan set 1 berisi count sheet', sets[0]?.notes?.includes('Konsep 2 — Garis ke Busur'))
cek('catatan set 1 berisi aturan alat', sets[0]?.notes?.includes('dua repetisi'))
const S = 5 / 8
const minY = -d.field.widthYd / 2
cek(
  'dot di langkah bulat dari A & T0',
  sets.every((s) => Object.values(s.points).every((q) => Math.abs(q.x / S - Math.round(q.x / S)) < 1e-6 && Math.abs((q.y - minY) / S - Math.round((q.y - minY) / S)) < 1e-6)),
)
cek('editor membuka drill baru', await p.evaluate(() => document.body.innerText.includes('Display Latihan 2 — Garis ke Busur')))

// --- dari header (sudah ada drill): Konsep 1 di lapangan sepak bola ----
await p.click('[data-testid="buka-display-latihan"]')
await p.waitForSelector('[data-testid="modal-display-latihan"]', { timeout: 5000 })
await wait(500)
await p.click('[data-testid="display-lapangan-sepakbola"]')
await p.select('[data-testid="display-sumber"]', 'aktif')
await wait(400)
cek('Konsep 1 tanpa peringatan di lapangan bola', !(await ada('[data-testid="peringatan-display"]')) || !(await p.$eval('[data-testid="peringatan-display"]', (e) => /berpapasan|keluar|hanya berjarak/.test(e.textContent))))
await p.click('[data-testid="buat-display"]')
await wait(1500)
const d2 = (await semua('drills')).find((x) => x.name.startsWith('Display Latihan 1'))
cek('drill Konsep 1 dibuat', Boolean(d2))
cek('lapangan sepak bola 105 m', d2 && Math.abs(d2.field.lengthYd - 105 * M_TO_YD) < 1e-6)
cek('roster = anggota aktif', d2?.rosterIds.length === seed.aktif)

// --- Esc menutup tanpa membuat drill ----------------------------------
const nSebelumEsc = (await semua('drills')).length
await p.click('[data-testid="buka-display-latihan"]')
await p.waitForSelector('[data-testid="modal-display-latihan"]', { timeout: 5000 })
await p.keyboard.press('Escape')
await wait(400)
cek('Esc menutup modal', !(await ada('[data-testid="modal-display-latihan"]')))
cek('Esc tidak membuat drill', (await semua('drills')).length === nSebelumEsc)

cek('tanpa galat konsol', errors.length === 0, errors.slice(0, 3).join(' | '))

await browser.close()
console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) {
  console.log('GAGAL:\n - ' + gagal.join('\n - '))
  process.exit(1)
}
