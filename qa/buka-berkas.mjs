/**
 * Uji #7 — satu pintu "Buka berkas DrillKit".
 *
 * Yang diuji, sesuai rancangan:
 *  1. Setiap jenis lewat pintu baru (Data & Dashboard): pratinjau tampil
 *     (jenis, tanggal, isi, baru/ditimpa) lalu diarahkan ke alurnya.
 *  2. Setiap jenis lewat tombol lama yang SALAH tempat: dialihkan ke
 *     pratinjau yang benar, bukan ditolak mentah-mentah.
 *  3. Pratinjau pemulihan backup: belum ada yang ditulis sebelum "Lanjut".
 *  4. Paket anggota ditolak di pemulihan backup (Pengaturan).
 *  5. Mode anggota hanya menerima paket.
 *  6. Nama berkas unduhan yang jelas (bagian B).
 */
import puppeteer from 'puppeteer'
import { lewatSambutan } from './sambutan.mjs'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { QA } from './lokasi.mjs'

const BASE = process.env.BASE || 'http://localhost:5173'
const UNDUH = path.join(QA, 'unduhan-buka')
const BERKAS = path.join(QA, 'berkas-buka')
for (const d of [UNDUH, BERKAS]) {
  fs.rmSync(d, { recursive: true, force: true })
  fs.mkdirSync(d, { recursive: true })
}
const HARI_INI = new Date().toISOString().slice(0, 10)

const browser = await puppeteer.launch({
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  defaultViewport: { width: 1300, height: 1000 },
})
const p = await browser.newPage()
const errors = []
p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
p.on('pageerror', (e) => errors.push(String(e)))

const cdp = await p.createCDPSession()
await cdp.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: UNDUH })

let lulus = 0
const gagal = []
const cek = (nama, syarat, keterangan = '') => {
  if (syarat) lulus += 1
  else gagal.push(`${nama}${keterangan ? ' — ' + keterangan : ''}`)
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const teks = (sel) => p.$eval(sel, (e) => e.textContent.replace(/\s+/g, ' ').trim())
const ada = async (sel) => (await p.$(sel)) != null
const isiBody = () => p.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').trim())
const klik = async (sel) => { await p.waitForSelector(sel, { timeout: 10000 }); await p.click(sel) }
const unggah = async (sel, berkas) => {
  await p.waitForSelector(sel, { timeout: 10000 })
  await (await p.$(sel)).uploadFile(berkas)
}
const bukaModal = async () => {
  await p.waitForSelector('[data-testid="modal-buka-berkas"]', { timeout: 10000 })
}
const tutupModal = async () => {
  if (await ada('[data-testid="buka-tutup"]')) await p.click('[data-testid="buka-tutup"]')
  await wait(400)
}
const bacaDb = (tabel) =>
  p.evaluate(async (t) => {
    const r = await new Promise((res) => { const q = indexedDB.open('drillkit'); q.onsuccess = () => res(q.result) })
    if (!r.objectStoreNames.contains(t)) return []
    return await new Promise((res) => {
      const tx = r.transaction([t], 'readonly')
      const q = tx.objectStore(t).getAll()
      q.onsuccess = () => res(q.result)
    })
  }, tabel)
const kosongUnduh = () => {
  for (const f of fs.readdirSync(UNDUH)) fs.rmSync(path.join(UNDUH, f), { recursive: true, force: true })
}
const tungguUnduh = async (pola) => {
  for (let i = 0; i < 40; i += 1) {
    await wait(250)
    const f = fs.readdirSync(UNDUH).filter((x) => pola.test(x))
    if (f.length) return f[0]
  }
  return null
}
const ke = async (rute) => {
  await p.evaluate((r) => { location.hash = r }, rute)
  await wait(2000)
}

// ------------------------------------------------------------- fixture
const tulis = (nama, isi) => {
  const j = path.join(BERKAS, nama)
  fs.writeFileSync(j, isi)
  return j
}
const fData = tulis('data-pilihan.json', JSON.stringify({
  format: 'drillkit-data', versi: 1, dibuat: Date.UTC(2026, 9, 1),
  lagu: [{ id: 'song_bk7_1', title: 'Lagu BK7', bpm: 120, beats: 4, tempoMap: [], createdAt: 1 }],
}))
const fShow = tulis('show.json', JSON.stringify({
  format: 'drillkit-show', versi: 1, dibuat: Date.UTC(2026, 9, 2), tim: 'Tim Uji',
  drill: {
    id: 'dr_bk7_baru', name: 'Show BK7', showTitle: '', tempo: 120, beatsPerCount: 1,
    rosterIds: [], createdAt: 1, updatedAt: 1,
  },
  sets: [{ id: 'st_bk7_1', drillId: 'dr_bk7_baru', order: 0, name: 'Set 1', counts: 8, points: {}, createdAt: 1 }],
  songs: [], members: [],
}))
const fRep = tulis('repertoar.json', JSON.stringify({
  format: 'drillkit-repertoar', version: 1, exportedAt: Date.UTC(2026, 9, 3),
  team: { teamName: 'Tim Uji' },
  songs: [{ id: 'song_bk7_rep', title: 'Lagu Rep BK7', bpm: 100, beats: 4, tempoMap: [], createdAt: 1 }],
  setlists: [], drills: [], sets: [],
}))
const fBackup = tulis('backup.json', JSON.stringify({
  format: 'drillkit-backup', version: 1, exportedAt: Date.UTC(2026, 9, 4),
  members: [],
  evaluasi: [{ id: 'ev_bk7_1', memberId: 'tak-ada', tanggal: '2026-10-05', nilai: { teknik: 4 }, createdAt: 1 }],
}))
const fPaket = tulis('paket-anggota.json', JSON.stringify({
  format: 'drillkit-share', version: 1, exportedAt: Date.UTC(2026, 9, 5),
  team: { teamName: 'Tim BK7' }, members: [], sessions: [], drills: [], sets: [],
  songs: [], setlists: [], attendance: [], memberNotes: [], mode: 'member',
}))
const fJadwal = tulis('jadwal.csv', 'id,judul,jenis,tanggal,mulai,selesai,tempat,setListId\ns_bk7_1,Latihan BK7,latihan,2026-10-09,08:00,10:00,Lapangan,\n')
const fAnggota = tulis('anggota.csv',
  'Kode,Nama,Panggilan,Section,Instrumen,Peran,Tahun Masuk,No. HP,Status,Catatan\nBK7,Buka Kirana,,Brass,Trumpet,Anggota,2024,,Aktif,\n')
const fAcak = tulis('acak.txt', 'halo ini bukan berkas drillkit sama sekali\n')

// ------------------------------------------------------------------ siap
await p.goto(BASE, { waitUntil: 'networkidle2' })
await lewatSambutan(p)
await wait(1500)
await p.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((y) => y.textContent.includes('Muat data contoh'))
  if (b) b.click()
})
await wait(4000)
await p.reload({ waitUntil: 'networkidle2' })
await wait(2500)

// ------------------------------------------- B: nama berkas yang jelas
await ke('#/pengaturan')
kosongUnduh()
await p.evaluate(() => {
  [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Ekspor backup (JSON)'))?.click()
})
cek('nama backup jelas', (await tungguUnduh(/^DrillKit - BACKUP LENGKAP - /)) === `DrillKit - BACKUP LENGKAP - ${HARI_INI}.json`,
  JSON.stringify(fs.readdirSync(UNDUH)))
kosongUnduh()
await p.evaluate(() => {
  [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Backup + rekaman (ZIP)'))?.click()
})
cek('nama backup zip jelas', (await tungguUnduh(/^DrillKit - BACKUP LENGKAP \+ REKAMAN - /)) === `DrillKit - BACKUP LENGKAP + REKAMAN - ${HARI_INI}.zip`,
  JSON.stringify(fs.readdirSync(UNDUH)))

await ke('#/data')
await klik('[data-testid="centang-jenis-lagu"]')
await wait(400)
kosongUnduh()
await klik('[data-testid="ekspor-data"]')
cek('nama data jelas', (await tungguUnduh(/^DrillKit - DATA PILIHAN - /)) === `DrillKit - DATA PILIHAN - ${HARI_INI}.json`,
  JSON.stringify(fs.readdirSync(UNDUH)))

await ke('#/drill')
await p.evaluate(() => {
  [...document.querySelectorAll('button')].find((b) => b.title?.includes('Pengaturan drill'))?.click()
})
await wait(1200)
cek('kartu berbagi show ada', await ada('[data-testid="kartu-berbagi-show"]'))
kosongUnduh()
await klik('[data-testid="tombol-ekspor-show"]')
{
  const f = await tungguUnduh(/\.json$/)
  cek('nama show jelas', f != null && f.startsWith('DrillKit - SHOW ') && f.endsWith(` - ${HARI_INI}.json`), String(f))
}

await ke('#/musik')
await wait(1500)
if (await ada('[data-testid="ekspor-repertoar"]')) {
  kosongUnduh()
  await klik('[data-testid="ekspor-repertoar"]')
  await wait(800)
  await klik('[data-testid="unduh-repertoar"]')
  const f = await tungguUnduh(/\.json$/)
  cek('nama repertoar jelas', f != null && /^DrillKit - LAGU \(\d+ lagu\) - /.test(f), String(f))
} else {
  cek('nama repertoar jelas (tombol ada)', false, 'ekspor-repertoar tidak ketemu')
}

await ke('#/berbagi')
kosongUnduh()
await klik('[data-testid="unduh-grup"]')
cek('nama grup jelas', (await tungguUnduh(/\.json$/)) === 'DrillKit - UNTUK ANGGOTA - semua (grup).json',
  JSON.stringify(fs.readdirSync(UNDUH)))
kosongUnduh()
await klik('[data-testid="unduh-per-anggota"]')
{
  const f = await tungguUnduh(/\.zip$/)
  cek('nama zip per anggota jelas',
    f != null && f.startsWith('DrillKit - UNTUK ANGGOTA - ') && f.endsWith(` - ${HARI_INI}.zip`), String(f))
  if (f) {
    const daftar = execFileSync('unzip', ['-l', path.join(UNDUH, f)]).toString().split('\n')
    const nama = daftar.map((b) => (b.match(/^\s*\d+\s+\S+\s+\S+\s+(.+)$/) ?? [])[1]).filter(Boolean)
    cek('nama berkas dalam zip jelas',
      nama.length > 0 && nama.every((n) => n.startsWith('DrillKit - UNTUK ANGGOTA - ') && n.endsWith('.json')),
      JSON.stringify(nama.slice(0, 2)))
  }
}

// --------------------------------- pintu baru: dasbor menolak paket
await ke('#/')
cek('kartu buka berkas di dasbor', await ada('[data-testid="kartu-buka-berkas"]'))
await unggah('[data-testid="buka-berkas-dasbor-input"]', fPaket)
await bukaModal()
cek('pintu dasbor mengenali paket', (await teks('[data-testid="buka-jenis"]')) === 'Paket untuk anggota')
cek('paket ditolak di mode pelatih', /mode pelatih/.test(await teks('[data-testid="buka-tolak"]')))
await tutupModal()

// --------------------------------- pintu baru: menu Data + "Mau apa?"
await ke('#/data')
cek('bagian Mau apa ada', await ada('[data-testid="mau-apa"]'))
cek('mau semua', await ada('[data-testid="mau-semua"]'))
cek('mau sebagian', await ada('[data-testid="mau-sebagian"]'))
cek('mau show', await ada('[data-testid="mau-show"]'))
cek('mau anggota', await ada('[data-testid="mau-anggota"]'))

// Data pilihan: pratinjau -> lanjut -> konfirmasi -> terapkan.
await unggah('[data-testid="buka-berkas-data-input"]', fData)
await bukaModal()
cek('pintu mengenali data', (await teks('[data-testid="buka-jenis"]')) === 'Data pilihan')
cek('tanggal data tampil', /1 Oktober 2026/.test(await teks('[data-testid="buka-tanggal"]')))
cek('pratinjau data menyebut baru', /1 baru/.test(await isiBody()))
await klik('[data-testid="buka-lanjut-data"]')
await p.waitForSelector('[data-testid="konfirmasi-impor"]', { timeout: 10000 })
cek('diteruskan ke impor Data', await ada('[data-testid="konfirmasi-impor"]'))
await klik('[data-testid="terapkan-data"]')
await wait(1500)
cek('lagu data masuk', (await bacaDb('songs')).some((s) => s.id === 'song_bk7_1'))

// Show: pratinjau -> impor langsung.
await unggah('[data-testid="buka-berkas-data-input"]', fShow)
await bukaModal()
cek('pintu mengenali show', (await teks('[data-testid="buka-jenis"]')) === 'Show (antar pelatih)')
cek('nama show tampil', /Show BK7/.test(await isiBody()))
await klik('[data-testid="buka-show-proses"]')
await wait(2000)
cek('show masuk', (await bacaDb('drills')).some((d) => d.id === 'dr_bk7_baru'))
// DIAG-SEMENTARA: lacak layar blank setelah impor show.
console.log('DIAG url=' + p.url())
console.log('DIAG body-drill=' + (await isiBody()).slice(0, 250))
console.log('DIAG errors=' + JSON.stringify(errors.slice(0, 4)).slice(0, 600))
await ke('#/data')
console.log('DIAG url-data=' + p.url())
console.log('DIAG tombol-data=' + (await ada('[data-testid="buka-berkas-data"]')))
console.log('DIAG body-data=' + (await isiBody()).slice(0, 250))

// Repertoar: pratinjau -> terapkan.
await unggah('[data-testid="buka-berkas-data-input"]', fRep)
await bukaModal()
cek('pintu mengenali repertoar', (await teks('[data-testid="buka-jenis"]')) === 'Repertoar (lagu)')
await klik('[data-testid="buka-repertoar-terapkan"]')
await wait(1500)
cek('lagu repertoar masuk', (await bacaDb('songs')).some((s) => s.id === 'song_bk7_rep'))

// Backup: pratinjau dulu, BELUM menulis; "Lanjut" baru menulis.
await unggah('[data-testid="buka-berkas-data-input"]', fBackup)
await bukaModal()
cek('pintu mengenali backup', (await teks('[data-testid="buka-jenis"]')) === 'Backup lengkap')
cek('pratinjau backup menyebut evaluasi', /Evaluasi/.test(await isiBody()))
cek('belum menulis sebelum Lanjut', !(await bacaDb('evaluasi')).some((e) => e.id === 'ev_bk7_1'))
await klik('[data-testid="buka-pulih-tombol"]')
await wait(2500)
cek('backup dipulihkan setelah Lanjut', (await bacaDb('evaluasi')).some((e) => e.id === 'ev_bk7_1'))

// CSV jadwal: pratinjau -> diteruskan ke tab CSV.
await unggah('[data-testid="buka-berkas-data-input"]', fJadwal)
await bukaModal()
cek('pintu mengenali csv jadwal', (await teks('[data-testid="buka-jenis"]')) === 'CSV jadwal')
await klik('[data-testid="buka-lanjut-csv"]')
await p.waitForSelector('[data-testid="konfirmasi-csv"]', { timeout: 10000 })
cek('diteruskan ke impor CSV', await ada('[data-testid="konfirmasi-csv"]'))
await klik('[data-testid="terapkan-csv"]')
await wait(1500)
cek('jadwal csv masuk', (await bacaDb('sessions')).some((s) => s.id === 's_bk7_1'))

// CSV anggota: pratinjau -> diteruskan ke Anggota.
await unggah('[data-testid="buka-berkas-data-input"]', fAnggota)
await bukaModal()
cek('pintu mengenali csv anggota', (await teks('[data-testid="buka-jenis"]')) === 'CSV anggota')
await klik('[data-testid="buka-lanjut-csv"]')
await wait(2500)
cek('diteruskan ke halaman Anggota', (await isiBody()).includes('Buka Kirana'))

// Berkas asing: dikenali sebagai tak-dikenal, tidak ada yang diubah.
await ke('#/data')
await unggah('[data-testid="buka-berkas-data-input"]', fAcak)
await bukaModal()
cek('berkas asing tak-dikenal', await ada('[data-testid="buka-tak-dikenal"]'))
await tutupModal()

// ------------------------------- tombol lama yang salah tempat
await unggah('[data-testid="berkas-masuk"]', fShow)
await bukaModal()
cek('impor Data mengalihkan show', (await teks('[data-testid="buka-jenis"]')) === 'Show (antar pelatih)')
await tutupModal()

await ke('#/berbagi')
await wait(1000)
await unggah('[data-testid="berkas-repertoar"]', fBackup)
await bukaModal()
cek('impor repertoar mengalihkan backup', (await teks('[data-testid="buka-jenis"]')) === 'Backup lengkap')
await tutupModal()

await ke('#/anggota')
await unggah('[data-testid="berkas-anggota"]', fJadwal)
await bukaModal()
cek('impor Anggota mengalihkan csv jadwal', (await teks('[data-testid="buka-jenis"]')) === 'CSV jadwal')
await tutupModal()

await ke('#/drill')
await p.evaluate(() => {
  [...document.querySelectorAll('button')].find((b) => b.title?.includes('Pengaturan drill'))?.click()
})
await wait(1200)
await unggah('[data-testid="berkas-show"]', fData)
await bukaModal()
cek('impor show mengalihkan data', (await teks('[data-testid="buka-jenis"]')) === 'Data pilihan')
await tutupModal()

// ------------------------------- paket ditolak di pemulihan backup
await ke('#/pengaturan')
await unggah('#restore-input', fPaket)
await wait(1200)
cek('pemulihan menolak paket', /paket untuk anggota/.test(await isiBody()))
cek('penolakan tidak membuka modal', !(await ada('[data-testid="modal-pulih-backup"]')))

// Jenis lain di pemulihan dialihkan ke pratinjau yang benar.
await unggah('#restore-input', fRep)
await bukaModal()
cek('pemulihan mengalihkan repertoar', (await teks('[data-testid="buka-jenis"]')) === 'Repertoar (lagu)')
await tutupModal()

// Backup lewat pemulihan: pratinjau dulu, baru menulis.
await unggah('#restore-input', fBackup)
await p.waitForSelector('[data-testid="modal-pulih-backup"]', { timeout: 10000 })
cek('pemulihan menampilkan pratinjau', await ada('[data-testid="modal-pulih-backup"]'))
cek('pratinjau pemulihan menyebut isi', /Evaluasi/.test(await isiBody()))
await klik('[data-testid="pulih-backup-tombol"]')
await wait(2500)
cek('pemulihan menulis setelah Lanjut', (await bacaDb('evaluasi')).some((e) => e.id === 'ev_bk7_1'))

cek('tidak ada error konsol (pelatih)', errors.length === 0, errors.slice(0, 3).join(' | '))

// ----------------------------------------------- mode anggota
const ctx = await browser.createBrowserContext()
const m = await ctx.newPage()
const errorsM = []
m.on('console', (e) => { if (e.type() === 'error') errorsM.push(e.text()) })
m.on('pageerror', (e) => errorsM.push(String(e)))
await m.goto(BASE, { waitUntil: 'networkidle2' })
await lewatSambutan(m, 'member')
await m.goto(`${BASE}/#/berbagi`, { waitUntil: 'networkidle2' })
await wait(2000)
await (await m.$('#pkg-input')).uploadFile(fBackup)
await m.waitForSelector('[data-testid="modal-buka-berkas"]', { timeout: 10000 })
{
  const t = await m.$eval('[data-testid="buka-tolak"]', (e) => e.textContent)
  cek('mode anggota menolak backup', /hanya bisa membuka paket/.test(t), t.slice(0, 120))
}
await m.click('[data-testid="buka-tutup"]')
await wait(400)
await (await m.$('#pkg-input')).uploadFile(fPaket)
await wait(2000)
{
  const body = await m.evaluate(() => document.body.innerText)
  cek('mode anggota membuka paket', body.includes('Tim BK7'), body.slice(0, 150))
}
cek('tidak ada error konsol (anggota)', errorsM.length === 0, errorsM.slice(0, 3).join(' | '))

await browser.close()
console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) {
  console.log('GAGAL:\n - ' + gagal.join('\n - '))
  process.exit(1)
}
