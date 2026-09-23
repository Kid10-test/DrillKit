/**
 * Uji **tim besar** — 80 pemain, ukuran marching band yang sebenarnya.
 *
 * Mengapa ini ada: rencana pelatihnya jelas — dicoba di section (18 orang)
 * dulu, lalu dikomersialkan ke marching bandnya. README sudah mengklaim
 * editor formasinya teruji sampai 160 pemain, tetapi yang belum pernah
 * diukur adalah BESAR BERKAS MATERI, karena dua alasan yang saling
 * berkaitan:
 *
 *   1. Berkas itulah yang diambil anggota setiap kali menekan **Perbarui**.
 *      Kuotanya mereka yang membayar, bukan pelatih — dan pelatihnya sudah
 *      dua kali menanyakan biaya. Klaim "nol rupiah" tidak ada nilainya
 *      bila tiap pembaruan menghabiskan puluhan megabita.
 *   2. Berkas yang membengkak akan lambat diurai pada HP kelas bawah,
 *      tepat pada perangkat yang dipakai anggotanya.
 *
 * Yang dijaga di sini: 80 anggota harus menghasilkan berkas yang masih
 * jauh di bawah 1 MB, dan halaman-halaman utama tidak boleh melambat
 * sampai tak terpakai.
 */
import puppeteer from 'puppeteer'
import { lewatSambutan } from './sambutan.mjs'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const BASE = process.env.BASE || 'http://localhost:4173'
const UNDUH = path.join(os.tmpdir(), 'unduh-besar')
fs.rmSync(UNDUH, { recursive: true, force: true })
fs.mkdirSync(UNDUH, { recursive: true })
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

let lulus = 0
const gagal = []
const cek = (nama, syarat, keterangan = '') => {
  if (syarat) lulus += 1
  else gagal.push(`${nama}${keterangan ? ' — ' + keterangan : ''}`)
}
/** Batas yang masih wajar ditarik anggota lewat kuota HP-nya sendiri. */
const BATAS_MB = 1

const browser = await puppeteer.launch({
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  defaultViewport: { width: 1300, height: 1000 },
})

try {
  const A = await browser.newPage()
  A.on('dialog', async (d) => { await d.accept() })
  A.on('pageerror', (e) => console.log('GALAT:', String(e).slice(0, 160)))
  await A.goto(BASE, { waitUntil: 'networkidle2' })
  await wait(1200)
  await lewatSambutan(A)
  await wait(1200)
  await A.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((y) => y.textContent.includes('Muat data contoh'))
    if (b) b.click()
  })
  await wait(4500)

  const cdp = await A.target().createCDPSession()
  await cdp.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: UNDUH })

  const unduhGrup = async (label) => {
    await A.goto(`${BASE}/#/berbagi`, { waitUntil: 'networkidle2' })
    await wait(2200)
    const t0 = Date.now()
    await (await A.$('[data-testid="unduh-grup"]')).click()
    let f = null
    for (let i = 0; i < 200 && !f; i += 1) {
      await wait(250)
      const x = fs.readdirSync(UNDUH).filter((y) => y.endsWith('.json'))
      if (x.length) f = path.join(UNDUH, x[0])
    }
    const ms = Date.now() - t0
    if (!f) { console.log(label, 'GAGAL terunduh'); return null }
    const ukuran = fs.statSync(f).size
    const j = JSON.parse(fs.readFileSync(f, 'utf8'))
    console.log(`${label.padEnd(16)} ${(ukuran / 1024).toFixed(0).padStart(6)} KB  (${ms} ms)  anggota=${(j.members ?? []).length} sesi=${(j.sessions ?? []).length} set=${(j.sets ?? []).length} absen=${(j.attendance ?? []).length}`)
    if (label.startsWith('80')) {
      cek('2: berkas grup 80 anggota MASIH di bawah 1 MB',
        ukuran < BATAS_MB * 1048576, `${(ukuran / 1048576).toFixed(2)} MB`)
      cek('2: berkas grup 80 anggota tidak membengkak lebih dari 10x lipat ukuran 18 anggota',
        ukuran80Ref.value === 0 || ukuran < ukuran80Ref.value * 10,
        `${(ukuran / 1024).toFixed(0)} KB lawan ${(ukuran80Ref.value / 1024).toFixed(0)} KB`)
    }
    fs.unlinkSync(f)
    return ukuran
  }

  const ukuran80Ref = { value: 0 }
  const ukuran18 = await unduhGrup('18 anggota:')
  cek('1: berkas grup 18 anggota terunduh', ukuran18 != null && ukuran18 > 0, String(ukuran18))
  ukuran80Ref.value = ukuran18

  // Tambah jadi 80 anggota — ukuran marching band yang sebenarnya.
  await A.evaluate(async () => {
    const db = await new Promise((res) => { const q = indexedDB.open('drillkit'); q.onsuccess = () => res(q.result) })
    const s = await new Promise((res) => {
      const q = db.transaction(['members'], 'readonly').objectStore('members').getAll()
      q.onsuccess = () => res(q.result)
    })
    const contoh = s[0]
    const baru = []
    for (let i = s.length; i < 80; i += 1) {
      baru.push({
        ...contoh,
        id: `m_besar_${i}`,
        name: `Pemain ${i + 1}`,
        code: `P${String(i + 1).padStart(3, '0')}`,
        section: contoh.section,
        token: `tok_${i}`,
      })
    }
    const tx = db.transaction(['members'], 'readwrite')
    for (const m of baru) tx.objectStore('members').put(m)
    await new Promise((res) => { tx.oncomplete = res })
    db.close()
  })
  await A.reload({ waitUntil: 'networkidle2' })
  await wait(3000)

  const ukuran80 = await unduhGrup('80 anggota:')
  cek('2: berkas grup 80 anggota terunduh', ukuran80 != null && ukuran80 > 0, String(ukuran80))

  // Berapa lama halaman-halaman utama merender dengan 80 anggota?
  for (const [hash, nama] of [['#/anggota', 'Anggota'], ['#/absensi', 'Absensi'], ['#/rekap', 'Rekap'], ['#/evaluasi', 'Evaluasi'], ['#/berbagi', 'Berbagi']]) {
    const t0 = Date.now()
    await A.goto(BASE + '/' + hash, { waitUntil: 'networkidle2' })
    await wait(2500)
    const ms = Date.now() - t0 - 2500
    const teks = await A.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').trim())
    console.log(`  ${nama.padEnd(10)} +${String(ms).padStart(5)} ms  isi=${teks.length} huruf`)
    cek(`3: halaman ${nama} tetap merender dengan 80 anggota`, teks.length > 40, `${teks.length} huruf`)
    cek(`3: halaman ${nama} tidak melambat sampai tak terpakai`, ms < 8000, `${ms} ms`)
  }

  if (ukuran18 && ukuran80) {
    console.log(`\n  lipat ukuran: ${(ukuran80 / ukuran18).toFixed(1)}×`)
    console.log(`  perkiraan biaya kuota anggota per Perbarui (80): ${(ukuran80 / 1048576).toFixed(2)} MB`)
  }
} finally {
  await browser.close()
}

console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) {
  for (const g of gagal) console.log('  \u2717 ' + g)
  process.exitCode = 1
}
