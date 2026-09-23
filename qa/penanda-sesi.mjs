/**
 * Uji penanda mulai & selesai sesi (G3) di peramban.
 *
 * Dua hal yang paling dikuji, karena salahnya menghasilkan angka yang
 * tampak pasti padahal menipu:
 *
 * 1. **Sesi yang belum ditandai tidak boleh tampak sebagai tepat waktu**,
 *    dan tidak boleh ikut menarik rata-rata ke nol.
 * 2. **Sesi yang belum terjadi tidak boleh disebut "belum ditandai"** —
 *    itu tuduhan yang salah, lebih buruk daripada tidak memberi angka.
 *
 * Satu hal lagi yang diuji karena ia alasan G3 ada: penanda sesi dihitung
 * dari **penanda sesinya sendiri**, bukan dari blok pertama.
 */
import puppeteer from 'puppeteer'
import { lewatSambutan } from './sambutan.mjs'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const BASE = process.env.BASE || 'http://localhost:5173'
const browser = await puppeteer.launch({
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  defaultViewport: { width: 1400, height: 1200 },
})
const p = await browser.newPage()
const errors = []
p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
p.on('pageerror', (e) => errors.push(String(e)))
p.on('dialog', async (d) => { await d.accept() })

let lulus = 0
const gagal = []
const cek = (nama, syarat, keterangan = '') => {
  if (syarat) lulus += 1
  else gagal.push(`${nama}${keterangan ? ' — ' + keterangan : ''}`)
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const ada = async (sel) => (await p.$(sel)) != null
const teks = async (sel) => {
  const e = await p.$(sel)
  return e ? (await p.evaluate((x) => x.textContent, e)).replace(/\s+/g, ' ').trim() : null
}
const klik = async (sel) => {
  const e = await p.$(sel)
  if (!e) throw new Error(`tidak ketemu: ${sel}`)
  await e.click()
  await wait(250)
}
const tombol = (t) =>
  p.evaluate((x) => {
    const b = [...document.querySelectorAll('button')].find((y) => y.textContent.includes(x))
    if (!b || b.disabled) return false
    b.click()
    return true
  }, t)

await p.goto(BASE, { waitUntil: 'networkidle2' })
await lewatSambutan(p)
await wait(1500)
await tombol('Muat data contoh')
await wait(4000)
await p.reload({ waitUntil: 'networkidle2' })
await wait(2500)

// ------------------------------------------------------------------- persiapan
const hari = (n) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  const b = (x) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${b(d.getMonth() + 1)}-${b(d.getDate())}`
}
const KEMARIN = hari(-1)
const BESOK = hari(1)

const ID = {
  telat: 'ps_telat',   // kemarin, ditandai terlambat
  rapi: 'ps_rapi',     // kemarin, ditandaitepat waktu
  lupa: 'ps_lupa',     // kemarin, tidak pernah ditandai
  besok: 'ps_besok',   // belum terjadi — tidak boleh dituduh
}

await p.goto(`${BASE}/#/jadwal`, { waitUntil: 'networkidle2' })
await wait(1500)

await p.evaluate(async (id, kemarin, besok) => {
  const db = await new Promise((res, rej) => {
    const q = indexedDB.open('drillkit')
    q.onsuccess = () => res(q.result)
    q.onerror = () => rej(q.error)
  })
  const dasar = {
    title: 'Latihan uji', type: 'latihan', checklist: [], createdAt: Date.now(),
  }
  const baris = [
    { ...dasar, id: id.telat, date: kemarin, startTime: '08:00', endTime: '10:00' },
    { ...dasar, id: id.rapi, date: kemarin, startTime: '13:00', endTime: '15:00' },
    { ...dasar, id: id.lupa, date: kemarin, startTime: '19:00', endTime: '21:00' },
    { ...dasar, id: id.besok, date: besok, startTime: '08:00', endTime: '10:00' },
  ]
  await new Promise((res) => {
    const tx = db.transaction(['sessions'], 'readwrite')
    const s = tx.objectStore('sessions')
    s.clear()
    baris.forEach((b) => s.put(b))
    tx.oncomplete = res
  })
  db.close()
}, ID, KEMARIN, BESOK)
// WAJIB dimuat ulang: useLiveQuery Dexie tidak melihat tulisan IndexedDB
// mentah, jadi tanpa reload baris baru tidak pernah dirender.
await wait(600)
await p.reload({ waitUntil: 'networkidle2' })
await wait(2500)

// ---------------------------------------------------------- keadaan mula-mula
cek('panel rekap tampil', await ada('[data-testid="rekap-penanda"]'))
{
  const t = await teks('[data-testid="rekap-asal"]')
  cek('rekap menyebut "belum ada" saat murni kosong', /belum ada/.test(t ?? ''), t ?? 'tidak ada')
  // Yang dihitung: 3 sesi kemarin. Sesi besok TIDAK boleh ikut.
  cek('rekap menghitung 3 sesi lewat, bukan 4', /3 sesi/.test(t ?? ''), t ?? '')
}
for (const id of Object.values(ID)) {
  cek(`penanda tampil untuk ${id}`, await ada(`[data-testid="penanda-${id}"]`))
}
{
  const s = await teks(`[data-testid="status-sesi-${ID.lupa}"]`)
  cek('sesi tanpa penanda = belum dimulai', s === 'Belum dimulai', s ?? '')
}
{
  // Yang belum ditandai tidak boleh punya angka keterlambatan.
  const t = await teks(`[data-testid="telat-${ID.lupa}"]`)
  cek('tanpa penanda tidak menampilkan "tepat waktu"', t !== 'tepat waktu', t ?? '')
}

// ------------------------------------------------------- tombol mulai & selesai
await klik(`[data-testid="mulai-sesi-${ID.telat}"]`)
await wait(600)
{
  const s = await teks(`[data-testid="status-sesi-${ID.telat}"]`)
  cek('setelah mulai: status berjalan', s === 'Sedang berjalan', s ?? '')
}
await klik(`[data-testid="selesai-sesi-${ID.telat}"]`)
await wait(600)
{
  const s = await teks(`[data-testid="status-sesi-${ID.telat}"]`)
  cek('setelah selesai: status rampung', s === 'Sudah rampung', s ?? '')
  cek('tombol mulai hilang setelah rampung', !(await ada(`[data-testid="mulai-sesi-${ID.telat}"]`)))
  cek('tombol tandai ulang muncul', await ada(`[data-testid="ulang-sesi-${ID.telat}"]`))
}

// ---------------------------------------- penanda tidak disimpulkan dari blok
{
  // Alasan G3 ada: beri sesi ini blok yang mulainya BERBEDA dari penanda
  // sesi. Keterlambatan harus tetap dihitung dari penanda sesi.
  await p.evaluate(async (id) => {
    const db = await new Promise((res) => {
      const q = indexedDB.open('drillkit'); q.onsuccess = () => res(q.result)
    })
    const s = await new Promise((res) => {
      const q = db.transaction(['sessions'], 'readonly').objectStore('sessions').get(id)
      q.onsuccess = () => res(q.result)
    })
    s.realisasiLatihan = [{ id: 'b1', mulai: s.mulaiNyata + 600_000, selesai: s.mulaiNyata + 2_400_000 }]
    await new Promise((res) => {
      const tx = db.transaction(['sessions'], 'readwrite')
      tx.objectStore('sessions').put(s)
      tx.oncomplete = res
    })
    db.close()
  }, ID.telat)
  await wait(500)
  await p.reload({ waitUntil: 'networkidle2' })
  await wait(2000)
}

// ------------------------------------------------------ menyunting jam penanda
const setJam = async (sel, nilai) => {
  await p.evaluate((s, v) => {
    const el = document.querySelector(s)
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    set.call(el, v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }, sel, nilai)
  await wait(700)
}

await setJam(`[data-testid="jam-mulai-${ID.telat}"]`, '08:12')
await setJam(`[data-testid="jam-selesai-${ID.telat}"]`, '10:04')
{
  const t = await teks(`[data-testid="telat-${ID.telat}"]`)
  cek('telat 12 menit terbaca', t === 'telat 12 menit', t ?? '')
  const l = await teks(`[data-testid="lampau-${ID.telat}"]`)
  cek('molor 4 menit terbaca', l === 'molor 4 menit', l ?? '')
  const d = await teks(`[data-testid="durasi-${ID.telat}"]`)
  cek('durasi nyata 1 jam 52 menit', d === '1 jam 52 menit', d ?? '')
}

// Sesi kedua: tepat waktu.
await klik(`[data-testid="mulai-sesi-${ID.rapi}"]`)
await wait(500)
await klik(`[data-testid="selesai-sesi-${ID.rapi}"]`)
await wait(500)
await setJam(`[data-testid="jam-mulai-${ID.rapi}"]`, '13:00')
await setJam(`[data-testid="jam-selesai-${ID.rapi}"]`, '15:02')
{
  const t = await teks(`[data-testid="telat-${ID.rapi}"]`)
  cek('tepat waktu terbaca', t === 'tepat waktu', t ?? '')
}

// --------------------------------------------------------- rekap lintas sesi
{
  const asal = await teks('[data-testid="rekap-asal"]')
  // 2 ditandai (telat, rapi) dari 3 sesi lewat; sesi besok tidak ikut.
  cek('rekap: 2 dari 3 sesi', /dari 2 sesi yang ditandai/.test(asal ?? ''), asal ?? '')
  const t = await teks('[data-testid="rekap-telat"]')
  // Rata-rata (12 + 0)/2 = 6 menit — BUKAN (12+0+0)/3 = 4.
  cek('rata-rata telat 6 menit (bukan 4)', t === 'telat 6 menit', t ?? '')
  const l = await teks('[data-testid="rekap-lampau"]')
  // (4 + 2)/2 = 3. Sengaja bukan 2,5 supaya pembulatannya tidak ikut diuji.
  cek('rata-rata molor 3 menit', l === 'molor 3 menit', l ?? '')
  const b = await teks('[data-testid="rekap-belum"]')
  cek('1 sesi belum ditandai (bukan 2)', b === '1', b ?? '')
  cek('peringatan tampil', await ada('[data-testid="rekap-peringatan"]'))
}

// ------------------------------------------------ penanda di luar hari sesinya
{
  // Ketuk sesi yang belum terjadi: penandanya jatuh hari ini, sedangkan
  // sesinya besok. Selisihnya tidak boleh dihitung.
  await klik(`[data-testid="mulai-sesi-${ID.besok}"]`)
  await wait(700)
  cek('penanda beda hari diperingatkan', await ada(`[data-testid="hari-lain-${ID.besok}"]`))
  const t = await teks(`[data-testid="telat-${ID.besok}"]`)
  cek('penanda beda hari: selisih tidak dihitung', t === 'belum ditandai', t ?? '')
}
{
  // Sesi besok tidak boleh ikut rekap walaupun sudah ditandai.
  const asal = await teks('[data-testid="rekap-asal"]')
  cek('sesi besok tidak ikut rekap', /dari 2 sesi yang ditandai/.test(asal ?? ''), asal ?? '')
}

// --------------------------------------------------------------- tandai ulang
await klik(`[data-testid="ulang-sesi-${ID.telat}"]`)
await wait(700)
{
  const s = await teks(`[data-testid="status-sesi-${ID.telat}"]`)
  cek('setelah tandai ulang: belum dimulai', s === 'Belum dimulai', s ?? '')
  cek('setelah tandai ulang: tombol mulai muncul lagi',
    await ada(`[data-testid="mulai-sesi-${ID.telat}"]`))
  const asal = await teks('[data-testid="rekap-asal"]')
  cek('setelah tandai ulang: rekap jadi 1 sesi', /dari 1 sesi yang ditandai/.test(asal ?? ''), asal ?? '')
  const t = await teks('[data-testid="rekap-telat"]')
  // Yang tersisa hanya sesi "rapi" (tepat waktu) — bukan rata-rata 6 menit tadi.
  cek('rata-rata mengikuti penanda yang tersisa', t === 'tepat waktu', t ?? '')
}

// ------------------------------------------------------- penanda ikut tersimpan
{
  const simpan = await p.evaluate(async (id) => {
    const db = await new Promise((res) => {
      const q = indexedDB.open('drillkit'); q.onsuccess = () => res(q.result)
    })
    const s = await new Promise((res) => {
      const q = db.transaction(['sessions'], 'readonly').objectStore('sessions').get(id)
      q.onsuccess = () => res(q.result)
    })
    db.close()
    return { mulai: s.mulaiNyata ?? null, selesai: s.selesaiNyata ?? null }
  }, ID.rapi)
  cek('penanda benar-benar tersimpan di basis data', simpan.mulai != null && simpan.selesai != null,
    JSON.stringify(simpan))
}

// ------------------------------------------------------------------- pacu latihan
{
  // Penanda juga harus tersedia di layar Pacu — tempat pelatih berada saat
  // sesi berjalan.
  await p.evaluate(async (id) => {
    const db = await new Promise((res) => {
      const q = indexedDB.open('drillkit'); q.onsuccess = () => res(q.result)
    })
    const s = await new Promise((res) => {
      const q = db.transaction(['sessions'], 'readonly').objectStore('sessions').get(id)
      q.onsuccess = () => res(q.result)
    })
    s.rencanaLatihan = [{ id: 'bl1', judul: 'Pemanasan', jenis: 'pemanasan', menit: 20 }]
    await new Promise((res) => {
      const tx = db.transaction(['sessions'], 'readwrite')
      tx.objectStore('sessions').put(s)
      tx.oncomplete = res
    })
    db.close()
  }, ID.lupa)
  await wait(400)
  await p.reload({ waitUntil: 'networkidle2' })
  await wait(2000)
  const buka = await p.$(`[data-testid="pacu-${ID.lupa}"]`)
  if (buka) {
    await buka.click()
    await wait(1200)
    cek('penanda tampil di layar Pacu', await ada(`[data-testid="penanda-${ID.lupa}"]`))
    await p.keyboard.press('Escape').catch(() => {})
    const tutup = await p.$('[data-testid="tutup-pacu"]')
    if (tutup) await tutup.click()
    await wait(400)
  } else {
    cek('tombol pacu tersedia', false, 'tidak ketemu')
  }
}

// ------------------------------------------------- penanda ikut backup & pindah
// Cek-diri: kolom baru rawan luput terdaftar, persis seperti tabel
// `evaluasi` yang pernah hampir tertinggal dari backup.
{
  const UNDUH = path.join(os.tmpdir(), `unduh-penanda-${Date.now()}`)
  fs.mkdirSync(UNDUH, { recursive: true })
  const klien = await p.target().createCDPSession()
  await klien.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: UNDUH })

  await p.goto(`${BASE}/#/pengaturan`, { waitUntil: 'networkidle2' })
  await wait(2000)
  await tombol('Ekspor backup')
  let berkas = null
  for (let i = 0; i < 60 && !berkas; i += 1) {
    await wait(250)
    const f = fs.readdirSync(UNDUH).filter((x) => x.endsWith('.json'))
    if (f.length) berkas = path.join(UNDUH, f[0])
  }
  cek('berkas backup terunduh', berkas != null)
  if (berkas) {
    const isi = JSON.parse(fs.readFileSync(berkas, 'utf8'))
    const s = (isi.sessions ?? []).find((x) => x.id === ID.rapi)
    cek('sesi ada di backup', s != null)
    cek('mulaiNyata ikut tersimpan di backup', s?.mulaiNyata != null,
      JSON.stringify({ mulai: s?.mulaiNyata, selesai: s?.selesaiNyata }))
    cek('selesaiNyata ikut tersimpan di backup', s?.selesaiNyata != null)
  }
  fs.rmSync(UNDUH, { recursive: true, force: true })
}

cek('tidak ada galat di konsol', errors.length === 0, errors.slice(0, 3).join(' | '))

console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) {
  console.log('\nYang gagal:')
  gagal.forEach((g) => console.log('  ✗ ' + g))
}
await browser.close()
if (gagal.length) process.exit(1)
