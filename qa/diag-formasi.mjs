/**
 * Diagnosa: tab **Formasi** milik anggota — apakah angkanya bisa dipakai.
 *
 * Titiknya sendiri sudah ditandai lingkaran emas dan ada panel "Posisiku"
 * berisi koordinat, langkah dari garis 50, langkah dari garis depan, asal,
 * dan tujuan. Yang belum pernah diperiksa: apakah angka-angka itu
 * **konsisten satu sama lain** dan dengan konfigurasi lapangan pelatih.
 *
 * Kalau seorang anak disuruh berdiri di "12,25 langkah dari garis 50",
 * angka itu harus bisa ia hitung sendiri di lapangan. Kalau dua angka di
 * layar yang seharusnya sejalan malah berbeda, ia tidak akan tahu yang
 * mana yang dipakai.
 *
 * Tidak ada asersi. Semua dicetak, lalu dibandingkan dengan tangan.
 */
import puppeteer from 'puppeteer'
import { lewatSambutan } from './sambutan.mjs'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const BASE = process.env.BASE || 'http://localhost:4173'
const UNDUH = path.join(os.tmpdir(), `unduh-f-${Date.now()}`)
const BUKA = path.join(os.tmpdir(), `buka-f-${Date.now()}`)
fs.mkdirSync(UNDUH, { recursive: true })
fs.mkdirSync(BUKA, { recursive: true })

const browser = await puppeteer.launch({
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  defaultViewport: { width: 1300, height: 1100 },
})
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const bersih = (t) => (t ?? '').replace(/\s*\n\s*/g, ' | ').trim()

/* -------------------------------- pelatih --------------------------------- */
const A = await browser.newPage()
A.on('dialog', async (d) => { await d.accept() })
await A.goto(BASE, { waitUntil: 'networkidle2' })
await lewatSambutan(A)
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
await (await A.$('[data-testid="unduh-per-anggota"]')).click()
let zip = null
for (let i = 0; i < 120 && !zip; i += 1) {
  await wait(250)
  const f = fs.readdirSync(UNDUH).filter((x) => x.endsWith('.zip'))
  if (f.length) zip = path.join(UNDUH, f[0])
}
execFileSync('unzip', ['-o', '-q', zip, '-d', BUKA])

/* -------------------------------- anggota --------------------------------- */
const ctx = await browser.createBrowserContext()
const B = await ctx.newPage()
B.on('dialog', async (d) => { await d.accept() })
await B.goto(BASE, { waitUntil: 'networkidle2' })
await wait(2500)
await B.click('[data-testid="pilih-member"]')
await wait(300)
await B.click('[data-testid="lanjut-pilih-mode"]')
await wait(1500)
await B.goto(`${BASE}/#/berbagi`, { waitUntil: 'networkidle2' })
await wait(2200)

const berkas = fs.readdirSync(BUKA).find((f) => f.includes('Andra'))
const isi = JSON.parse(fs.readFileSync(path.join(BUKA, berkas), 'utf8'))
const andra = isi.members.find((m) => /Andra/.test(m.name))
await (await B.$('#pkg-input')).uploadFile(path.join(BUKA, berkas))
await wait(3000)
await B.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((y) => y.textContent.trim().toLowerCase() === 'formasi')
  if (b) b.click()
})
await wait(1800)

console.log('=== data mentah di berkas ===')
console.log('konfigurasi lapangan :', JSON.stringify(isi.team?.defaultField))
console.log('drill                :', (isi.drills ?? []).map((d) => d.name).join(', '))
console.log('jumlah set           :', (isi.sets ?? []).length)
// Cetak SEMUA set dengan urutannya — `find` terdahulu bisa saja bukan
// set yang sedang ditampilkan aplikasi.
;(isi.sets ?? [])
  .slice()
  .sort((a, b) => a.order - b.order)
  .forEach((s, i) => {
    const p = s.points?.[andra.id]
    console.log(`  set[${i}] order=${s.order} "${s.name}" counts=${s.counts ?? '-'} titik Andra=${JSON.stringify(p)}`)
  })

const t = bersih(await B.evaluate(() => document.body.innerText))
console.log('\n=== TAB FORMASI (seluruhnya) ===')
console.log(t.slice(t.indexOf('Jadwal') >= 0 ? t.lastIndexOf('Catatan') + 7 : 0))

await browser.close()
