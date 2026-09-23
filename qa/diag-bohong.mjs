/**
 * Diagnosa: apa yang DIDAPAT anggota yang memilih "Saya pelatih".
 *
 * Pertanyaan pelatihnya: *"Ini kan berarti pemain bisa berbohong dan masuk
 * menggunakan fitur pelatih?"*
 *
 * Jawabannya bergantung pada satu hal yang sering tidak disadari: data
 * DrillKit tersimpan **di perangkat masing-masing**, bukan di server. Jadi
 * pertanyaannya bukan "apakah ia bisa masuk mode pelatih", melainkan
 * **"mode pelatih di perangkatnya berisi apa?"**
 *
 * Diuji dua keadaan:
 *   A. Perangkat benar-benar baru, langsung pilih "Saya pelatih".
 *   B. Perangkat yang sudah membuka paket tim, lalu pindah ke mode pelatih.
 *
 * Tidak ada asersi. Semua dihitung dan dicetak.
 */
import puppeteer from 'puppeteer'
import { lewatSambutan } from './sambutan.mjs'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const BASE = process.env.BASE || 'http://localhost:4173'
const UNDUH = path.join(os.tmpdir(), `unduh-bohong-${Date.now()}`)
const BUKA = path.join(os.tmpdir(), `buka-bohong-${Date.now()}`)
fs.mkdirSync(UNDUH, { recursive: true })
fs.mkdirSync(BUKA, { recursive: true })

const browser = await puppeteer.launch({
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  defaultViewport: { width: 1300, height: 1000 },
})
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

/* =================== PERANGKAT PELATIH: isi data sampai penuh ============= */
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
await A.reload({ waitUntil: 'networkidle2' })
await wait(2500)

const dataPelatih = await A.evaluate(async () => {
  const db = await new Promise((res) => { const q = indexedDB.open('drillkit'); q.onsuccess = () => res(q.result) })
  const hitung = (nama) => new Promise((res) => {
    const q = db.transaction([nama], 'readonly').objectStore(nama).count()
    q.onsuccess = () => res(q.result)
  })
  const nama = [...db.objectStoreNames]
  const out = {}
  for (const n of nama) out[n] = await hitung(n)
  db.close()
  return out
})
console.log('=== data di PERANGKAT PELATIH ===')
console.log(JSON.stringify(dataPelatih))

// Ekspor berkas grup — inilah yang kelak dibagikan ke anggota.
const klien = await A.target().createCDPSession()
await klien.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: UNDUH })
await A.goto(`${BASE}/#/berbagi`, { waitUntil: 'networkidle2' })
await wait(2200)
await (await A.$('[data-testid="unduh-grup"]')).click()
for (let i = 0; i < 120; i += 1) {
  await wait(250)
  if (fs.readdirSync(UNDUH).some((x) => x.endsWith('.json'))) break
}
const berkasGrup = path.join(UNDUH, fs.readdirSync(UNDUH).find((x) => x.endsWith('.json')))
const isiGrup = JSON.parse(fs.readFileSync(berkasGrup, 'utf8'))
console.log('\n=== isi BERKAS GRUP yang dibagikan ===')
console.log('anggota:', (isiGrup.members ?? []).length,
  '| sesi:', (isiGrup.sessions ?? []).length,
  '| drill:', (isiGrup.drills ?? []).length,
  '| set:', (isiGrup.sets ?? []).length,
  '| lagu:', (isiGrup.songs ?? []).length,
  '| absensi:', (isiGrup.attendance ?? []).length,
  '| catatan:', (isiGrup.memberNotes ?? []).length)

/* ============ KEADAAN A: perangkat baru, langsung pilih PELATIH ============ */
const ctxA = await browser.createBrowserContext()
const B = await ctxA.newPage()
B.on('dialog', async (d) => { await d.accept() })
await B.goto(BASE, { waitUntil: 'networkidle2' })
await wait(2500)
await B.click('[data-testid="pilih-coach"]')
await wait(300)
await B.click('[data-testid="lanjut-pilih-mode"]')
await wait(1500)
await B.goto(BASE, { waitUntil: 'networkidle2' })
await wait(2500)

const lihat = async (h, judul) => {
  console.log(`\n--- ${judul} ---`)
  console.log('menu  :', JSON.stringify(await h.evaluate(() =>
    [...document.querySelectorAll('nav a[href^="#/"]')].map((a) => a.textContent.trim()))))
  const isi = await h.evaluate(async () => {
    const db = await new Promise((res) => { const q = indexedDB.open('drillkit'); q.onsuccess = () => res(q.result) })
    const hitung = (nama) => new Promise((res) => {
      const q = db.transaction([nama], 'readonly').objectStore(nama).count()
      q.onsuccess = () => res(q.result)
    })
    const paket = await new Promise((res) => {
      const q = db.transaction(['packages'], 'readonly').objectStore('packages').get('current')
      q.onsuccess = () => res(q.result)
    })
    const out = { anggota: await hitung('members'), sesi: await hitung('sessions'),
                  drill: await hitung('drills'), absensi: await hitung('attendance'),
                  paketDibuka: paket ? Object.keys(paket.data ?? {}).length : 0 }
    db.close()
    return out
  })
  console.log('isi db di perangkat ini:', JSON.stringify(isi))
  const t = await h.evaluate(() => document.body.innerText.replace(/\s*\n\s*/g, ' | ').trim())
  console.log('layar :', t.slice(0, 320))
}

await lihat(B, 'KEADAAN A — perangkat baru, memilih "Saya pelatih"')

/* === KEADAAN B: sudah buka paket tim, lalu pindah ke mode pelatih ========= */
const ctxB = await browser.createBrowserContext()
const C = await ctxB.newPage()
C.on('dialog', async (d) => { await d.accept() })
await C.goto(BASE, { waitUntil: 'networkidle2' })
await wait(2500)
await C.click('[data-testid="pilih-member"]')
await wait(300)
await C.click('[data-testid="lanjut-pilih-mode"]')
await wait(1500)
await C.goto(`${BASE}/#/berbagi`, { waitUntil: 'networkidle2' })
await wait(2200)
await (await C.$('#pkg-input')).uploadFile(berkasGrup)
await wait(3000)
console.log('\n--- KEADAAN B — sebagai anggota, paket sudah dibuka ---')
console.log('menu  :', JSON.stringify(await C.evaluate(() =>
  [...document.querySelectorAll('nav a[href^="#/"]')].map((a) => a.textContent.trim()))))

// Sekarang "berbohong": pindah ke mode pelatih lewat localStorage,
// persis seperti yang bisa dilakukan siapa pun yang tahu caranya.
await C.evaluate(() => localStorage.setItem('drillkit.mode', 'coach'))
await C.goto(BASE, { waitUntil: 'networkidle2' })
await wait(2500)
await lihat(C, 'KEADAAN B — setelah berbohong menjadi pelatih')

await browser.close()
