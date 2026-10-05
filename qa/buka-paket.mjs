/**
 * Uji: berkas per anggota mengenali pemiliknya.
 *
 * Cacat yang mendasarinya: berkas per anggota **sudah difilter hanya untuk
 * satu orang** (berkas Andra hanya memuat 2 absensi Andra), tetapi tidak
 * mencatat untuk siapa ia dibuat. Jadi begitu Andra membuka berkasnya
 * sendiri, aplikasi menyuruhnya "Pilih namamu dulu" dari daftar 18 nama —
 * **pertanyaan yang bisa dijawab sendiri oleh aplikasi**. Delapan belas
 * anggota akan melewatinya, di HP, dengan nama-nama yang mirip.
 *
 * Yang diuji bukan saja bahwa ia tidak ditanya lagi, melainkan bahwa
 * pengenalan ini:
 *   · **tidak diam-diam** — namanya disebut dan tampil, bisa diganti;
 *   · **tidak berlaku untuk berkas grup** — berkas itu untuk semua orang;
 *   · **tidak mengidentifikasi orang yang salah** bila penerimanya tidak
 *     dikenal atau berkasnya dibuat versi lama.
 */
import puppeteer from 'puppeteer'
import { lewatSambutan } from './sambutan.mjs'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const BASE = process.env.BASE || 'http://localhost:4173'
const UNDUH = path.join(os.tmpdir(), `unduh-paket-${Date.now()}`)
const BUKA = path.join(os.tmpdir(), `buka-paket-${Date.now()}`)
fs.mkdirSync(UNDUH, { recursive: true })
fs.mkdirSync(BUKA, { recursive: true })

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
const teks = (h) => h.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').trim())

async function perangkat(mode = 'coach') {
  const ctx = await browser.createBrowserContext()
  const h = await ctx.newPage()
  h.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  h.on('pageerror', (e) => errors.push(String(e)))
  h.on('dialog', async (d) => { await d.accept() })
  await h.goto(BASE, { waitUntil: 'networkidle2' })
  await wait(2500)
  if (mode === 'coach') {
    await lewatSambutan(h)
  } else {
    // Perangkat anggota dibiarkan lewat layar sambutan seperti pemakai
    // sungguhan — sekaligus menguji bahwa sambutannya memang muncul.
    await h.click('[data-testid="pilih-member"]')
    await wait(300)
    await h.click('[data-testid="lanjut-pilih-mode"]')
    await wait(1500)
    await h.goto(BASE, { waitUntil: 'networkidle2' })
    await wait(2500)
  }
  return h
}

/* ==================== PERANGKAT A — pelatih mengekspor ==================== */
const A = await perangkat('coach')
await wait(1200)
await A.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((y) => y.textContent.includes('Muat data contoh'))
  if (b) b.click()
})
await wait(4000)
await A.reload({ waitUntil: 'networkidle2' })
await wait(2500)

const klien = await A.target().createCDPSession()
await klien.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: UNDUH })
await A.goto(`${BASE}/#/berbagi`, { waitUntil: 'networkidle2' })
await wait(2200)

// Berkas GRUP — dipakai di bagian 3.
const unduh = async (testid, ekstensi) => {
  const b = await A.$(testid)
  if (b) await b.click()
  for (let i = 0; i < 120; i += 1) {
    await wait(250)
    const f = fs.readdirSync(UNDUH).filter((x) => x.endsWith(ekstensi))
    if (f.length) return path.join(UNDUH, f[0])
  }
  return null
}
const berkasGrup = await unduh('[data-testid="unduh-grup"]', '.json')
cek('berkas grup terunduh', berkasGrup != null)
fs.copyFileSync(berkasGrup, path.join(BUKA, 'grup.json'))

const zip = await unduh('[data-testid="unduh-per-anggota"]', '.zip')
cek('ZIP per anggota terunduh', zip != null)
execFileSync('unzip', ['-o', '-q', zip, '-d', BUKA])

const berkasAndra = fs.readdirSync(BUKA).find((f) => f.startsWith('DrillKit - UNTUK ANGGOTA - Andra'))
const isiAndra = JSON.parse(fs.readFileSync(path.join(BUKA, berkasAndra), 'utf8'))
cek('berkas Andra berasal dari ZIP', berkasAndra != null, String(berkasAndra))
cek('berkas Andra menyebut untuk siapa', isiAndra.forMember != null, String(isiAndra.forMember))
{
  const dia = (isiAndra.members ?? []).find((m) => m.id === isiAndra.forMember)
  cek('penerima yang disebut ada di daftar anggota', dia != null)
  cek('penerima yang disebut adalah Andra', /Andra/.test(dia?.name ?? ''), dia?.name ?? '—')
  cek('berkas Andra hanya memuat absensi Andra',
    (isiAndra.attendance ?? []).every((a) => a.memberId === isiAndra.forMember),
    JSON.stringify([...new Set((isiAndra.attendance ?? []).map((a) => a.memberId))]))
}

/* ============ 1. Anggota membuka berkasnya sendiri: namanya dikenali ====== */
const B = await perangkat('member')
await B.goto(`${BASE}/#/berbagi`, { waitUntil: 'networkidle2' })
await wait(2000)
// Sebelum ada paket, yang tampil justru keadaan kosong — pemilih nama baru
// muncul setelah paket dibuka dan tidak mengenali pemiliknya.
cek('mulanya: keadaan kosong, belum ada paket', /Belum ada paket dibuka/i.test(await teks(B)))

const masukan = await B.$('#pkg-input')
cek('input berkas tersedia', masukan != null)
await masukan.uploadFile(path.join(BUKA, berkasAndra))
await wait(3000)

{
  const t = await teks(B)
  cek('setelah dibuka: TIDAK diminta memilih nama lagi', !/Pilih namamu dulu/i.test(t), t.slice(0, 160))
  cek('setelah dibuka: tidak lagi mengatakan "Pilih nama di atas"', !/Pilih nama di atas/i.test(t))
  // Pengenalannya tidak boleh diam-diam: namanya disebut dengan jelas.
  cek('pengenalannya disebutkan, tidak diam-diam', /hai, Andra/i.test(t), t.slice(0, 200))
  cek('kartu menampilkan nama Andra', /Andra Pratama/.test(t))
  cek('kartu menampilkan kodenya', /BR01/.test(t))
  cek('tetap ada tombol "Ganti nama"', await B.evaluate(() =>
    [...document.querySelectorAll('button')].some((b) => /Ganti nama/i.test(b.textContent))))
}
{
  const meId = await B.evaluate(() => localStorage.getItem('drillkit.meId'))
  cek('namanya tersimpan di perangkat ini', meId === isiAndra.forMember, String(meId))
}
/* ==================== 2. Tab benar-benar terisi untuknya ================== */
{
  const klik = async (label) => {
    const ok = await B.evaluate((x) => {
      const b = [...document.querySelectorAll('button')].find((y) => y.textContent.trim().toLowerCase() === x)
      if (!b) return false
      b.click()
      return true
    }, label)
    await wait(1400)
    return ok
  }
  cek('tab jadwal bisa dibuka', await klik('jadwal'))
  const jadwal = await teks(B)
  cek('tab jadwal menampilkan sesi', /Mendatang|jadwal/i.test(jadwal), jadwal.slice(0, 140))
  cek('tab formasi bisa dibuka', await klik('formasi'))
  cek('tab absensi bisa dibuka', await klik('absensi'))
  const absen = await teks(B)
  cek('tab absensi menampilkan sesuatu untuknya', absen.length > 120, String(absen.length))
}

/* ============ 3. Berkas GRUP tetap menanyakan nama (bukan untuk siapa pun) = */
{
  const C = await perangkat('member')
  await C.goto(`${BASE}/#/berbagi`, { waitUntil: 'networkidle2' })
  await wait(2000)
  const masuk = await C.$('#pkg-input')
  await masuk.uploadFile(path.join(BUKA, 'grup.json'))
  await wait(3000)
  const t = await teks(C)
  cek('berkas grup: tetap diminta memilih nama', /Pilih namamu dulu/i.test(t), t.slice(0, 160))
  cek('berkas grup: tidak mengaku mengenali siapa pun', !/hai,/i.test(t))
}

/* ====== 4. Berkas versi lama & penerima yang tidak dikenal: ditanya lagi === */
{
  const lama = { ...isiAndra }
  delete lama.forMember
  const jalanLama = path.join(BUKA, 'lama.json')
  fs.writeFileSync(jalanLama, JSON.stringify(lama))
  const D = await perangkat('member')
  await D.goto(`${BASE}/#/berbagi`, { waitUntil: 'networkidle2' })
  await wait(2000)
  const masuk = await D.$('#pkg-input')
  await masuk.uploadFile(jalanLama)
  await wait(3000)
  const t = await teks(D)
  cek('berkas versi lama (tanpa penanda): ditanya seperti dulu', /Pilih namamu dulu/i.test(t), t.slice(0, 160))
}
{
  const asing = { ...isiAndra, forMember: 'm-bukan-siapa-siapa' }
  const jalanAsing = path.join(BUKA, 'asing.json')
  fs.writeFileSync(jalanAsing, JSON.stringify(asing))
  const E = await perangkat('member')
  await E.goto(`${BASE}/#/berbagi`, { waitUntil: 'networkidle2' })
  await wait(2000)
  const masuk = await E.$('#pkg-input')
  await masuk.uploadFile(jalanAsing)
  await wait(3000)
  const t = await teks(E)
  cek('penerima tak dikenal: TIDAK mengidentifikasi orang asing', !/hai,/i.test(t), t.slice(0, 160))
  cek('penerima tak dikenal: ditanya namanya', /Pilih namamu dulu/i.test(t), t.slice(0, 160))
  const meId = await E.evaluate(() => localStorage.getItem('drillkit.meId'))
  cek('penerima tak dikenal: tidak menuliskan id asing ke perangkat', meId == null || meId === '', String(meId))
}

const galatNyata = errors.filter((e) => !/ERR_INSUFFICIENT_RESOURCES/.test(e))
cek('tidak ada galat di konsol', galatNyata.length === 0, galatNyata.slice(0, 3).join(' | '))

console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) {
  console.log('\nYang gagal:')
  gagal.forEach((g) => console.log('  ✗ ' + g))
}
await browser.close()
if (gagal.length) process.exit(1)
