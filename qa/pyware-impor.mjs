/**
 * #10 — Impor drill Pyware lewat layar (uji peramban).
 *
 * Yang diuji di sini adalah alurnya, bukan aturannya (aturan ada di
 * `pyware-logika.mjs`):
 *
 *  1. Tombol **Pyware** di halaman Drill membuka jendela impor.
 *  2. Pratinjau menyebut jumlah set, pemain, dan titik **sebelum** apa pun
 *     ditulis — dan tidak ada set yang bertambah sebelum tombolnya ditekan.
 *  3. Setelah impor: setnya masuk, titiknya lengkap per pemain, dan riwayat
 *     menyimpan foto `sebelum-impor-pyware` (jaminan undo).
 *  4. Pintu #7 "Buka berkas DrillKit" mengenali lembar Pyware sebagai jenis
 *     sendiri, mengarahkannya ke Drill, dan jendela impor terbuka **sudah
 *     terisi** — tanpa menulis apa pun.
 *
 * Data contoh dipakai apa adanya: kode & nama anggotanya dibaca dari IndexedDB
 * lalu dipakai menyusun CSV, jadi pencocokan #1 yang diuji adalah pencocokan
 * sungguhan (kode + nama sama → dipasangkan otomatis).
 *
 * Pakai: BASE=http://localhost:4173 node qa/pyware-impor.mjs
 */
import puppeteer from 'puppeteer'
import fs from 'node:fs'
import path from 'node:path'
import { lewatSambutan } from './sambutan.mjs'
import { QA } from './lokasi.mjs'

const BASE = process.env.BASE || process.argv[2] || 'http://localhost:4173'
const DIR = path.join(QA, 'berkas-pyware')
fs.rmSync(DIR, { recursive: true, force: true })
fs.mkdirSync(DIR, { recursive: true })

const browser = await puppeteer.launch({
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  defaultViewport: { width: 1400, height: 1100 },
})
const p = await browser.newPage()
const errors = []
p.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text())
})
p.on('pageerror', (e) => errors.push(String(e)))

const wait = (ms) => new Promise((r) => setTimeout(r, ms))
let lulus = 0
const gagal = []
const cek = (nama, syarat, keterangan = '') => {
  if (syarat) lulus += 1
  else gagal.push(`${nama}${keterangan ? ' — ' + keterangan : ''}`)
}

/** Baca satu object store IndexedDB aplikasi (nama DB: `drillkit`). */
const baca = (toko) =>
  p.evaluate(
    (t) =>
      new Promise((selesai, tolak) => {
        const req = indexedDB.open('drillkit')
        req.onerror = () => tolak(new String(req.error))
        req.onsuccess = () => {
          const db = req.result
          const tx = db.transaction(t, 'readonly')
          const r = tx.objectStore(t).getAll()
          r.onsuccess = () => {
            db.close()
            selesai(r.result)
          }
          r.onerror = () => tolak(new String(r.error))
        }
      }),
    toko,
  )

/** Isi textarea dengan cara yang dilihat React (bukan `el.value = …`). */
const isiTextarea = (sel, nilai) =>
  p.evaluate(
    (s, v) => {
      const el = document.querySelector(s)
      if (!el) return false
      const set = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
      set.call(el, v)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      return true
    },
    sel,
    nilai,
  )

/* --------------------------- siapkan keadaan ---------------------------- */
await p.goto(BASE, { waitUntil: 'networkidle2' })
await lewatSambutan(p)
await p.goto(`${BASE}/#/`, { waitUntil: 'networkidle2' })
await wait(1500)
await p.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) =>
    x.textContent.includes('Muat data contoh'),
  )
  b && b.click()
})
await wait(4000)
await p.goto(`${BASE}/#/drill`, { waitUntil: 'networkidle2' })
await wait(3000)

const anggota = (await baca('members'))
  .filter((m) => (m.code ?? '').trim() && (m.name ?? '').trim())
  .slice(0, 10)
cek('data contoh punya anggota', anggota.length >= 3, String(anggota.length))

/** Lembar koordinat gaya Pyware: 3 set × semua anggota, dalam langkah. */
const csvPyware = [
  'Set,Count,Code,Name,X (Sidelong),Y (Depth)',
  ...[0, 1, 2].flatMap((s) =>
    anggota.map((m, i) =>
      ['Pyware A', 'Pyware B', 'Pyware C'][s] +
      `,${[1, 9, 17][s]},${m.code},${m.name},${-12 + i + s * 2},${12 + i}`,
    ),
  ),
].join('\n')
const berkasPyware = path.join(DIR, 'opener-pyware.csv')
fs.writeFileSync(berkasPyware, csvPyware)

/* ------------------------- 1. tombol & pratinjau ------------------------ */
await p.waitForSelector('[data-testid="tombol-pyware"]', { timeout: 15000 })
await p.click('[data-testid="tombol-pyware"]')
await p.waitForSelector('[data-testid="impor-pyware"]', { timeout: 10000 })
cek('jendela impor Pyware terbuka', await p.$('[data-testid="pyware-teks"]') != null)

const sebelum = (await baca('sets')).length
cek('isian textarea diterima', await isiTextarea('[data-testid="pyware-teks"]', csvPyware))
await wait(1500)

const ringkas = await p.$eval('[data-testid="pyware-ringkas"]', (e) =>
  e.textContent.replace(/\s+/g, ' ').trim(),
)
cek('pratinjau menyebut 3 set', /\b3\b\s*set/.test(ringkas), ringkas.slice(0, 140))
cek(
  'pratinjau menyebut jumlah pemain',
  new RegExp(`\\b${anggota.length}\\b\\s*pemain`).test(ringkas),
  ringkas.slice(0, 140),
)
cek(
  'pratinjau menyebut jumlah titik',
  new RegExp(`\\b${anggota.length * 3}\\b\\s*titik`).test(ringkas),
  ringkas.slice(0, 140),
)
cek(
  'pratinjau menyebut rentang hitungan',
  /Hitungan 1\s*[–-]\s*17/.test(ringkas),
  ringkas.slice(0, 200),
)
cek('tidak ada peringatan di luar lapangan', !/di luar lapangan/.test(ringkas), ringkas.slice(0, 200))
cek(
  'belum ada yang ditulis sebelum tombol ditekan',
  (await baca('sets')).length === sebelum,
  String((await baca('sets')).length),
)

/* ------------------------------- 2. impor ------------------------------- */
await p.waitForSelector('[data-testid="pyware-proses"]:not([disabled])', { timeout: 10000 })
await p.click('[data-testid="pyware-proses"]')
await wait(2500)

const sesudah = await baca('sets')
cek('impor menambah 3 set', sesudah.length === sebelum + 3, `${sebelum} → ${sesudah.length}`)
const masuk = sesudah.filter((s) => /^Pyware [ABC]$/.test(s.name))
cek('nama set dari berkas dipakai', masuk.length === 3, masuk.map((s) => s.name).join(','))
cek(
  'titik tiap set lengkap',
  masuk.every((s) => Object.keys(s.points ?? {}).length === anggota.length),
  masuk.map((s) => `${s.name}:${Object.keys(s.points ?? {}).length}`).join(','),
)
cek(
  'counts dari kolom Count',
  masuk.find((s) => s.name === 'Pyware A')?.counts === 8,
  String(masuk.find((s) => s.name === 'Pyware A')?.counts),
)
cek(
  'titik menempel ke anggota yang dicocokkan',
  Object.keys(masuk[0]?.points ?? {}).every((id) => anggota.some((m) => m.id === id)),
  Object.keys(masuk[0]?.points ?? {}).slice(0, 3).join(','),
)
cek(
  'jendela impor tertutup setelah selesai',
  (await p.$('[data-testid="impor-pyware"]')) == null,
)

const riwayat = await baca('riwayat')
cek(
  'riwayat menyimpan foto sebelum impor',
  riwayat.some((r) => r.alasan === 'sebelum-impor-pyware'),
  riwayat.map((r) => r.alasan).join(','),
)
const foto = riwayat.find((r) => r.alasan === 'sebelum-impor-pyware')
cek('foto memuat jumlah set sebelum impor', foto?.jumlahSet === sebelum, String(foto?.jumlahSet))

/* -------------------------- 3. lewat pintu #7 --------------------------- */
const sebelumPintu = (await baca('sets')).length
await p.goto(`${BASE}/#/data`, { waitUntil: 'networkidle2' })
await wait(2000)
await p.waitForSelector('[data-testid="buka-berkas-data-input"]', { timeout: 15000 })
await (await p.$('[data-testid="buka-berkas-data-input"]')).uploadFile(berkasPyware)
await p.waitForSelector('[data-testid="modal-buka-berkas"]', { timeout: 10000 })
await wait(800)

const jenis = await p.$eval('[data-testid="buka-jenis"]', (e) => e.textContent.trim())
cek('pintu mengenali CSV Pyware', jenis === 'CSV koordinat Pyware (#10)', jenis)
cek('pintu mengarahkan ke Drill', /Drill/.test(await p.$eval('[data-testid="buka-csv"]', (e) => e.textContent)))

await p.click('[data-testid="buka-lanjut-csv"]')
await wait(3000)
cek('pindah ke halaman Drill', (await p.evaluate(() => location.hash)).includes('/drill'))
cek(
  'jendela impor terbuka sendiri dari titipan',
  (await p.$('[data-testid="impor-pyware"]')) != null,
)
const isi = await p.$eval('[data-testid="pyware-teks"]', (e) => e.value)
cek('isi berkas sudah terisi', isi.includes('Pyware A'), isi.slice(0, 60))
cek(
  'pintu tidak menulis apa pun',
  (await baca('sets')).length === sebelumPintu,
  String((await baca('sets')).length),
)

/* ------------------------------ 4. konsol ------------------------------- */
cek('tidak ada error konsol', errors.length === 0, errors.slice(0, 3).join(' | '))

await browser.close()
console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) {
  console.log('GAGAL:\n - ' + gagal.join('\n - '))
  process.exit(1)
}
