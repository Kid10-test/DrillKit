/**
 * Diagnosa: seberapa jujur angka "KEHADIRAN" di layar anggota.
 *
 * Kodenya (`MemberAttendance`) menghitung persentase dari
 * `pct(hadir, mine.length)` — `mine` adalah catatan yang ADA di paket.
 * Jadi sesi yang tidak dicatat pelatih tidak masuk penyebut sama sekali.
 *
 * Dugaan: kalau pelatih hanya mencatat 2 sesi dan keduanya "hadir", anggota
 * melihat **KEHADIRAN 100%** padahal ada 3 sesi lain yang tidak tercatat.
 * Angka persentase adalah hal yang paling tampak berwibawa di tab itu, dan
 * ia menyanjung tanpa bisa dicek pembacaannya.
 *
 * Tidak ada asersi. Dua keadaan dicetak berdampingan supaya bedanya jelas.
 */
import puppeteer from 'puppeteer'
import { lewatSambutan } from './sambutan.mjs'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const BASE = process.env.BASE || 'http://localhost:4173'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const bersih = (t) => (t ?? '').replace(/\s*\n\s*/g, ' | ').trim()

async function jalan(berapaDicatat) {
  const UNDUH = path.join(os.tmpdir(), `unduh-p-${Date.now()}-${berapaDicatat}`)
  const BUKA = path.join(os.tmpdir(), `buka-p-${Date.now()}-${berapaDicatat}`)
  fs.mkdirSync(UNDUH, { recursive: true })
  fs.mkdirSync(BUKA, { recursive: true })

  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
    defaultViewport: { width: 1300, height: 1000 },
  })

  /* -------------------------------- pelatih ------------------------------- */
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

  const info = await A.evaluate(async (n) => {
    const db = await new Promise((res) => { const q = indexedDB.open('drillkit'); q.onsuccess = () => res(q.result) })
    const baca = (nama) => new Promise((res) => {
      const q = db.transaction([nama], 'readonly').objectStore(nama).getAll()
      q.onsuccess = () => res(q.result)
    })
    const anggota = await baca('members')
    const sesi = await baca('sessions')
    const absenLama = await baca('attendance')
    const andra = anggota.find((m) => /Andra/.test(m.name))

    // BERSIHKAN absensi Andra, lalu tulis tepat `n` catatan "hadir".
    await new Promise((res) => {
      const tx = db.transaction(['attendance'], 'readwrite')
      const os2 = tx.objectStore('attendance')
      absenLama.filter((a) => a.memberId === andra.id).forEach((a) => os2.delete(a.id))
      tx.oncomplete = res
    })
    await new Promise((res) => {
      const tx = db.transaction(['attendance'], 'readwrite')
      const os2 = tx.objectStore('attendance')
      for (let i = 0; i < n; i += 1) {
        os2.put({ id: `at_h${i}`, sessionId: sesi[i].id, memberId: andra.id,
                  status: 'hadir', at: Date.now(), source: 'manual' })
      }
      tx.oncomplete = res
    })
    db.close()
    return { totalSesi: sesi.length, dicatat: n,
             sesi: sesi.map((s) => s.date) }
  }, berapaDicatat)

  await wait(500)
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
  const berkas = fs.readdirSync(BUKA).find((f) => f.startsWith('DrillKit-Andra'))

  /* -------------------------------- anggota ------------------------------- */
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
  await (await B.$('#pkg-input')).uploadFile(path.join(BUKA, berkas))
  await wait(3000)
  await B.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((y) => y.textContent.trim().toLowerCase() === 'absensi')
    if (b) b.click()
  })
  await wait(1500)
  const t = bersih(await B.evaluate(() => document.body.innerText))
  // Ambil hanya bagian ubin statistiknya.
  const mulai = t.indexOf('HADIR')
  await browser.close()
  return { info, tampil: t.slice(mulai, mulai + 240), panjangDaftar: t.length }
}

for (const n of [2, 5]) {
  const r = await jalan(n)
  console.log(`\n===== pelatih mencatat ${n} dari ${r.info.totalSesi} sesi, SEMUA "hadir" =====`)
  console.log('tanggal sesi :', r.info.sesi.join(', '))
  console.log('yang tampil  :', r.tampil)
}
