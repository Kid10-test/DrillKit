/**
 * Uji tombol **Perbarui** — anggota mengambil materi terbaru dari alamatnya.
 *
 * Mengapa ini ada: tanpa tombol ini, setiap kali pelatih mengubah materi,
 * ia harus mengekspor berkas lalu mengirimkannya lagi ke 18 orang, dan
 * ke-18 orang itu harus menyimpannya sendiri. Dengan alamat materi yang
 * tetap, anggota cukup satu ketuk.
 *
 * Asersi yang menentukan ada pada **penggabungan**: berkas di alamat itu
 * adalah berkas GRUP, yang sengaja tidak memuat absensi siapa pun. Kalau
 * pembaruan menimpa seluruh isinya, riwayat kehadiran anggota akan kosong
 * **setiap kali** pelatih memperbarui materi. Karena itu yang diganti hanya
 * materi bersamanya; absensi dan catatan milik anggota dipertahankan.
 *
 * Alur:
 *   1. Pelatih mengekspor berkas grup -> dipasang sebagai `paket.json`.
 *   2. Perangkat anggota kosong -> tombol "Ambil materi dari situs".
 *   3. Anggota membuka berkas PER ANGGOTA (berisi absensinya).
 *   4. Pelatih memperbarui materi -> tombol "Perbarui".
 *   5. Materinya baru; absensinya TETAP ADA.
 */
import puppeteer from 'puppeteer'
import { lewatSambutan } from './sambutan.mjs'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const BASE = process.env.BASE || 'http://localhost:4173'
/** Berkas materi yang disajikan sejajar dengan aplikasinya (satu asal). */
const DIST = '/home/user/drillkit/dist'
const PAKET = path.join(DIST, 'paket.json')
const UNDUH = path.join(os.tmpdir(), `unduh-perbarui-${Date.now()}`)
fs.mkdirSync(UNDUH, { recursive: true })

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

/** Anggota baru: lewat layar pengantar seperti pemakai sungguhan. */
async function perangkatAnggota() {
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
  return h
}

/**
 * Baca isi paket yang tersimpan, langsung dari basis datanya.
 *
 * Dipakai untuk menguji penggabungan, karena membacanya dari teks layar
 * mudah keliru: ubin "Langkah dari garis 50" itu milik tab **Formasi**,
 * bukan tab Absensi — percobaan pertama mencarinya di tab yang salah.
 */
const bacaPaket = (h) => h.evaluate(async () => {
  const db = await new Promise((res) => { const q = indexedDB.open('drillkit'); q.onsuccess = () => res(q.result) })
  const p = await new Promise((res) => {
    const q = db.transaction(['packages'], 'readonly').objectStore('packages').get('current')
    q.onsuccess = () => res(q.result)
  })
  db.close()
  return {
    tim: p?.data?.team?.teamName ?? null,
    absen: (p?.data?.attendance ?? []).length,
    catatan: (p?.data?.memberNotes ?? []).length,
    forMember: p?.data?.forMember ?? null,
    sesi: (p?.data?.sessions ?? []).length,
  }
})

const bukaTab = async (h, label) => {
  await h.evaluate((x) => {
    const b = [...document.querySelectorAll('button')].find((y) => y.textContent.trim().toLowerCase() === x)
    if (b) b.click()
  }, label)
  await wait(1400)
}

try {
  /* ===================== 1. Pelatih mengekspor berkas grup ================ */
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

  const klien = await A.target().createCDPSession()
  await klien.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: UNDUH })
  await A.goto(`${BASE}/#/berbagi`, { waitUntil: 'networkidle2' })
  await wait(2200)
  await (await A.$('[data-testid="unduh-grup"]')).click()
  let berkas = null
  for (let i = 0; i < 120 && !berkas; i += 1) {
    await wait(250)
    const f = fs.readdirSync(UNDUH).filter((x) => x.endsWith('.json'))
    if (f.length) berkas = path.join(UNDUH, f[0])
  }
  cek('1: berkas grup terunduh', berkas != null)
  const grup = JSON.parse(fs.readFileSync(berkas, 'utf8'))

  // Ini syarat yang tidak bisa ditawar: yang dipublikasikan HARUS berkas grup.
  cek('1: berkas yang dipublikasikan NOL absensi', (grup.attendance ?? []).length === 0,
    String((grup.attendance ?? []).length))
  cek('1: berkas yang dipublikasikan NOL catatan', (grup.memberNotes ?? []).length === 0)

  const terbitkan = (namaTim) => {
    const salin = { ...grup, team: { ...(grup.team ?? {}), teamName: namaTim } }
    fs.writeFileSync(PAKET, JSON.stringify(salin))
  }
  terbitkan('Tim Uji')
  cek('1: materi diterbitkan di alamatnya', fs.existsSync(PAKET))

  /* ============ 2. Anggota baru: satu ketuk, tanpa berkas apa pun ========= */
  const B = await perangkatAnggota()
  {
    cek('2: keadaan kosong menawarkan "Ambil materi dari situs"',
      /Ambil materi dari situs/i.test(await teks(B)))
    const tombol = await B.$('[data-testid="ambil-materi"]')
    cek('2: tombolnya ada', tombol != null)
    await tombol.click()
    await wait(3000)
    const t = await teks(B)
    cek('2: materi langsung masuk tanpa berkas', /Tim Uji/.test(t), t.slice(0, 200))
    cek('2: jumlah anggota terbaca', /18 anggota/.test(t), t.slice(0, 240))
  }

  /* ===== 3. Anggota membuka berkas PER ANGGOTA — berisi absensinya sendiri = */
  await (await A.$('[data-testid="unduh-per-anggota"]')).click()
  let zip = null
  for (let i = 0; i < 120 && !zip; i += 1) {
    await wait(250)
    const f = fs.readdirSync(UNDUH).filter((x) => x.endsWith('.zip'))
    if (f.length) zip = path.join(UNDUH, f[0])
  }
  cek('3: ZIP per anggota terunduh', zip != null)
  const { execFileSync } = await import('node:child_process')
  const BUKA = path.join(os.tmpdir(), `buka-perbarui-${Date.now()}`)
  fs.mkdirSync(BUKA, { recursive: true })
  execFileSync('unzip', ['-o', '-q', zip, '-d', BUKA])
  const berkasAndra = fs.readdirSync(BUKA).find((f) => f.includes('Andra'))
  const isiAndra = JSON.parse(fs.readFileSync(path.join(BUKA, berkasAndra), 'utf8'))
  const jumlahAbsenAndra = (isiAndra.attendance ?? []).length
  cek('3: berkas Andra berisi absensinya', jumlahAbsenAndra > 0, String(jumlahAbsenAndra))

  await (await B.$('#pkg-input2')).uploadFile(path.join(BUKA, berkasAndra))
  await wait(3000)
  const sebelum = await bacaPaket(B)
  {
    cek('3: absensinya tersimpan di perangkat', sebelum.absen === jumlahAbsenAndra,
      `${sebelum.absen} lawan ${jumlahAbsenAndra}`)
    const meId = await B.evaluate(() => localStorage.getItem('drillkit.meId'))
    cek('3: identitasnya dikenali dari berkasnya', meId === isiAndra.forMember, String(meId))
  }

  /* ============ 4. Pelatih memperbarui materi, anggota menekan Perbarui === */
  terbitkan('Tim Uji — Diperbarui')
  {
    const tombol = await B.$('[data-testid="perbarui-alamat"]')
    cek('4: tombol Perbarui tersedia', tombol != null)
    await tombol.click()
    await wait(3500)
    const t = await teks(B)
    cek('4: materi yang BARU terbaca', /Tim Uji — Diperbarui/.test(t), t.slice(0, 220))
    cek('4: materi yang LAMA tidak tampil lagi', !/Paket dibuat[\s\S]{0,40}Tim Uji \" /.test(t))
  }

  /* ===== 5. Yang terpenting: absensinya TIDAK hilang karenanya ============ */
  {
    const sesudah = await bacaPaket(B)
    // Materi bersamanya HARUS berganti...
    cek('5: materi bersamanya memang berganti', sesudah.tim === 'Tim Uji — Diperbarui', String(sesudah.tim))
    cek('5: sesinya ikut diperbarui', sesudah.sesi === (grup.sessions ?? []).length,
      `${sesudah.sesi} lawan ${(grup.sessions ?? []).length}`)
    // ...tetapi data pribadinya TIDAK boleh hilang karenanya.
    cek('5: absensinya TETAP ADA setelah materi diperbarui',
      sesudah.absen === jumlahAbsenAndra, `${sesudah.absen} lawan ${jumlahAbsenAndra}`)
    cek('5: catatannya TETAP ADA', sesudah.catatan === (isiAndra.memberNotes ?? []).length,
      `${sesudah.catatan} lawan ${(isiAndra.memberNotes ?? []).length}`)
    cek('5: penanda pemiliknya tidak ikut terhapus',
      sesudah.forMember === isiAndra.forMember, String(sesudah.forMember))
    const meId = await B.evaluate(() => localStorage.getItem('drillkit.meId'))
    cek('5: identitasnya tidak ikut terhapus', meId === isiAndra.forMember, String(meId))
  }

  /* ================ 6. Alamat yang salah: gagal dengan jujur ============== */
  {
    // Ketik saja — penyetel nilai bawaan React mudah meleset.
    await B.click('[data-testid="alamat-materi"]', { clickCount: 3 })
    await B.keyboard.down('Control')
    await B.keyboard.press('KeyA')
    await B.keyboard.up('Control')
    await B.keyboard.type('tidak-ada-berkasnya.json')
    await wait(600)
    {
      const nilai = await B.$eval('[data-testid="alamat-materi"]', (e) => e.value)
      cek('6: alamatnya benar-benar berubah', nilai === 'tidak-ada-berkasnya.json', nilai)
    }
    await B.click('[data-testid="perbarui-alamat"]')
    /*
     * Pantau, jangan dibaca sekali pada waktu tertentu. Pesannya muncul
     * sebentar lalu hilang sendiri, dan server penyaji berkas statis
     * mengembalikan index.html untuk alamat yang tidak ada — jadi
     * kegagalannya datang dari berkas yang gagal diurai, agak lambat.
     */
    let terlihat = ''
    for (let i = 0; i < 24; i += 1) {
      await wait(250)
      const t = await teks(B)
      if (/Tidak ada berkas materi|Gagal mengambil materi/i.test(t)) { terlihat = t; break }
    }
    cek('6: alamat yang salah diberitahukan, tidak diam saja',
      terlihat !== '', terlihat.slice(0, 160))
    /*
     * Pesannya harus MENYEBUT kemungkinan yang paling sering terjadi dan
     * paling sulit dikenali: berkas materinya ikut terhapus saat aplikasi
     * diperbarui. Penyaji statis menjawab alamat kosong dengan index.html
     * (200), jadi tanpa pemeriksaan jenis isi, kegagalan ini tampak
     * seperti sekadar gagal mengambil — dan pelatih akan mencari
     * kesalahan pada koneksi yang sebenarnya baik-baik saja.
     */
    cek('6: pesannya menyebut bahwa berkasnya bisa ikut terhapus',
      /ikut terhapus|belum diunggah/i.test(terlihat), terlihat.slice(0, 200))
    // Dan materi yang lama tidak rusak karenanya.
    const akhir = await teks(B)
    cek('6: materi yang sudah ada TIDAK rusak karena gagal mengambil',
      /Tim Uji — Diperbarui/.test(akhir), akhir.slice(0, 220))
  }
} finally {
  try { fs.unlinkSync(PAKET) } catch { /* tidak apa-apa */ }
}

const galatNyata = errors.filter((e) => !/ERR_INSUFFICIENT_RESOURCES|Failed to fetch|404/.test(e))
cek('tidak ada galat di konsol', galatNyata.length === 0, galatNyata.slice(0, 3).join(' | '))

console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) {
  console.log('\nYang gagal:')
  gagal.forEach((g) => console.log('  ✗ ' + g))
}
await browser.close()
if (gagal.length) process.exit(1)
