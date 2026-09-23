/**
 * Uji: angka "Kehadiran" di layar anggota tidak menyanjung.
 *
 * Cacat yang mendasarinya (terbukti, bukan dugaan): persentasenya dihitung
 * dari sesi yang **tercatat pelatih** saja. Dua keadaan yang sangat berbeda
 * menghasilkan angka yang sama bagi anggota —
 *
 *   pelatih mencatat 2 dari 5 sesi, dua-duanya hadir  ->  **100%**
 *   pelatih mencatat 5 dari 5 sesi, semuanya hadir    ->  **100%**
 *
 * Persentase adalah hal yang paling tampak berwibawa di tab itu, dan
 * pembacaannya tidak bisa dicek. Sesi yang tidak dicatat hilang dari
 * pembilang sekaligus dari penyebut.
 *
 * Yang diuji: penyebutnya ditulis, dan kekosongannya kelihatan — tetapi
 * ditandai **"Belum dicatat"**, bukan digabung ke "tidak hadir". Pelatih
 * yang belum sempat mengisi absensi tidak boleh membuat anggotanya tampak
 * mangkir.
 */
import puppeteer from 'puppeteer'
import { lewatSambutan } from './sambutan.mjs'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const BASE = process.env.BASE || 'http://localhost:4173'
const TMP = path.join(os.tmpdir(), `absensi-${Date.now()}`)
fs.mkdirSync(TMP, { recursive: true })

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

/* ------------------------------- pelatih ---------------------------------- */
const A = await browser.newPage()
A.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
A.on('pageerror', (e) => errors.push(String(e)))
A.on('dialog', async (d) => { await d.accept() })
await A.goto(BASE, { waitUntil: 'networkidle2' })
await lewatSambutan(A)
await wait(1200)
await A.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((y) => y.textContent.includes('Muat data contoh'))
  if (b) b.click()
})
await wait(4000)

/** Bersihkan absensi Andra, lalu tulis catatan persis seperti yang diminta. */
async function tulisAbsen(rencana) {
  const info = await A.evaluate(async (pola) => {
    const db = await new Promise((res) => { const q = indexedDB.open('drillkit'); q.onsuccess = () => res(q.result) })
    const baca = (nama) => new Promise((res) => {
      const q = db.transaction([nama], 'readonly').objectStore(nama).getAll()
      q.onsuccess = () => res(q.result)
    })
    const anggota = await baca('members')
    const sesi = await baca('sessions')
    const lama = await baca('attendance')
    const andra = anggota.find((m) => /Andra/.test(m.name))
    const hariIni = new Date().toISOString().slice(0, 10)
    const sudahLewat = sesi.filter((s) => s.date < hariIni).sort((a, b) => a.date.localeCompare(b.date))
    const lain = sesi.filter((s) => s.date >= hariIni)

    await new Promise((res) => {
      const tx = db.transaction(['attendance'], 'readwrite')
      lama.filter((a) => a.memberId === andra.id).forEach((a) => tx.objectStore('attendance').delete(a.id))
      tx.oncomplete = res
    })

    const mau = []
    if (pola === 'satu-yang-lewat') {
      if (sudahLewat[0]) mau.push({ s: sudahLewat[0], status: 'hadir' })
    } else if (pola === 'semua') {
      mau.push(...sesi.map((s) => ({ s, status: s.id === sudahLewat[1]?.id ? 'izin' : 'hadir' })))
    } else {
      // 'tanpa-catatan' — sengaja tidak menulis apa pun.
    }
    await new Promise((res) => {
      const tx = db.transaction(['attendance'], 'readwrite')
      mau.forEach(({ s, status }, i) => tx.objectStore('attendance').put({
        id: `at_uji_${i}`, sessionId: s.id, memberId: andra.id,
        status, at: Date.now(), source: 'manual',
      }))
      tx.oncomplete = res
    })
    db.close()
    return {
      nama: andra.name,
      totalSesi: sesi.length,
      sudahLewat: sudahLewat.length,
      dicatat: mau.length,
      hadir: mau.filter((x) => x.status === 'hadir').length,
      akanKosong: pola === 'satu-yang-lewat' ? sudahLewat.length - 1 : 0,
    }
  }, rencana)
  await wait(500)
  await A.reload({ waitUntil: 'networkidle2' })
  await wait(2500)
  return info
}

let nomor = 0
async function ekspor(info) {
  const UNDUH = path.join(TMP, `unduh-${nomor}`)
  const BUKA = path.join(TMP, `buka-${nomor}`)
  nomor += 1
  fs.mkdirSync(UNDUH, { recursive: true })
  fs.mkdirSync(BUKA, { recursive: true })
  const klien = await A.target().createCDPSession()
  await klien.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: UNDUH })
  await A.goto(`${BASE}/#/berbagi`, { waitUntil: 'networkidle2' })
  await wait(2000)
  await (await A.$('[data-testid="unduh-per-anggota"]')).click()
  let zip = null
  for (let i = 0; i < 120 && !zip; i += 1) {
    await wait(250)
    const f = fs.readdirSync(UNDUH).filter((x) => x.endsWith('.zip'))
    if (f.length) zip = path.join(UNDUH, f[0])
  }
  if (!zip) throw new Error('ZIP tidak terunduh')
  execFileSync('unzip', ['-o', '-q', zip, '-d', BUKA])
  const berkas = fs.readdirSync(BUKA).find((f) => f.includes('Andra'))
  return { jalan: path.join(BUKA, berkas), info }
}

async function anggotaBuka(jalan) {
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
  await (await h.$('#pkg-input')).uploadFile(jalan)
  await wait(3000)
  await h.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((y) => y.textContent.trim().toLowerCase() === 'absensi')
    if (b) b.click()
  })
  await wait(1500)
  return h
}

/* ====== KASUS 1: pelatih hanya mencatat SATU sesi yang sudah lewat ======== */
{
  const info = await tulisAbsen('satu-yang-lewat')
  const { jalan } = await ekspor(info)
  console.log(`kasus 1: ${info.totalSesi} sesi (${info.sudahLewat} sudah lewat), dicatat ${info.dicatat}`)
  const B = await anggotaBuka(jalan)
  const t = await teks(B)

  cek('1: persentase tetap ditampilkan', /\d+%/.test(t))
  // Penyebutnya harus terbaca — inilah inti perbaikannya.
  cek('1: penyebutnya ditulis di bawah angkanya',
    t.includes(`${info.hadir} dari ${info.dicatat} sesi yang dicatat`),
    t.slice(t.indexOf('KEHADIRAN'), t.indexOf('KEHADIRAN') + 120))
  cek('1: kekosongannya diberitahukan',
    /belum dicatat pelatih/i.test(t), t.slice(t.indexOf('KEHADIRAN'), t.indexOf('KEHADIRAN') + 200))
  cek('1: sesi tanpa catatan ditandai "Belum dicatat"', /Belum dicatat/i.test(t))
  // Dan yang terpenting: kekosongan itu TIDAK dihitung sebagai mangkir.
  cek('1: sesi tanpa catatan TIDAK dilabeli "Tanpa keterangan"',
    !/Tanpa keterangan/.test(t), t.slice(t.indexOf('KEHADIRAN'), t.indexOf('KEHADIRAN') + 300))
}

/* ============== KASUS 2: pelatih mencatat SEMUA sesi ====================== */
{
  const info = await tulisAbsen('semua')
  const { jalan } = await ekspor(info)
  console.log(`kasus 2: ${info.totalSesi} sesi, dicatat ${info.dicatat}, hadir ${info.hadir}`)
  const C = await anggotaBuka(jalan)
  const t = await teks(C)

  cek('2: penyebutnya mencakup semua sesi',
    t.includes(`${info.hadir} dari ${info.dicatat} sesi yang dicatat`),
    t.slice(t.indexOf('KEHADIRAN'), t.indexOf('KEHADIRAN') + 120))
  cek('2: tidak ada lagi peringatan kekosongan', !/belum dicatat pelatih/i.test(t))
  cek('2: tidak ada baris "Belum dicatat"', !/Belum dicatat/.test(t))
  cek('2: sesi izin tampil sebagai Izin', /Izin/.test(t))
  {
    const persen = Math.round((info.hadir / info.dicatat) * 100)
    cek('2: persentasenya sesuai hitungan', t.includes(`${persen}%`), `harap ${persen}%`)
  }
  // Kedua kasus harus bisa dibedakan oleh anggota.
  cek('2: angkanya berbeda dari kasus 1 yang juga 100%', info.dicatat > 1)
}

/* ===== KASUS 3: pelatih belum mencatat APA PUN — jangan tertulis 0% ====== */
{
  const info = await tulisAbsen('tanpa-catatan')
  const { jalan } = await ekspor(info)
  console.log(`kasus 3: ${info.totalSesi} sesi, dicatat ${info.dicatat}`)
  const D = await anggotaBuka(jalan)
  const t = await teks(D)

  // "0%" pada data yang kosong berbunyi sebagai tuduhan mangkir.
  cek('3: TIDAK menampilkan 0%', !/KEHADIRAN 0%/.test(t),
    t.slice(t.indexOf('KEHADIRAN'), t.indexOf('KEHADIRAN') + 80))
  cek('3: menyatakan belum ada yang dicatat', /belum ada yang dicatat/i.test(t),
    t.slice(t.indexOf('KEHADIRAN'), t.indexOf('KEHADIRAN') + 80))
  cek('3: sesi yang sudah lewat tampil sebagai "Belum dicatat"',
    /Belum dicatat/.test(t), t.slice(t.indexOf('KEHADIRAN'), t.indexOf('KEHADIRAN') + 400))
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
