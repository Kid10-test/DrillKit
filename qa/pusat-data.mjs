/**
 * Uji Pusat Data (impor/ekspor lintas fitur).
 *
 * Yang paling menentukan: **konfirmasi harus tampil SEBELUM apa pun
 * ditulis.** Uji ini mengecek isi basis data tepat sebelum tombol "Terapkan"
 * ditekan — kalau datanya sudah berubah pada saat itu, berarti konfirmasinya
 * hanya hiasan.
 *
 * Yang kedua: aturan **longgar** untuk rujukan — data tetap masuk, rujukan
 * yang tidak ketemu dikosongkan, dan yang dikosongkan **dilaporkan**.
 * Rujukan yang diam-diam menghilang jauh lebih berbahaya daripada rujukan
 * yang putus dengan kabar.
 */
import puppeteer from 'puppeteer'
import { lewatSambutan } from './sambutan.mjs'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.BASE || 'http://localhost:5173'
const UNDUH = '/home/user/drillkit/qa/unduhan-data'
const BERKAS = '/home/user/drillkit/qa/berkas-data'
for (const d of [UNDUH, BERKAS]) {
  fs.rmSync(d, { recursive: true, force: true })
  fs.mkdirSync(d, { recursive: true })
}

const browser = await puppeteer.launch({
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  defaultViewport: { width: 1280, height: 1100 },
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
const klik = async (sel) => { await p.waitForSelector(sel, { timeout: 10000 }); await p.click(sel) }
const tombol = (t) =>
  p.evaluate((x) => {
    const b = [...document.querySelectorAll('button')].find((y) => y.textContent.includes(x))
    if (!b || b.disabled) return false
    b.click()
    return true
  }, t)
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
const tungguUnduh = async (akhiran = '.json') => {
  for (let i = 0; i < 40; i += 1) {
    await wait(250)
    const f = fs.readdirSync(UNDUH).filter((x) => x.endsWith(akhiran))
    if (f.length) return path.join(UNDUH, f[0])
  }
  return null
}

await p.goto(BASE, { waitUntil: 'networkidle2' })
await lewatSambutan(p)
await wait(1500)
await tombol('Muat data contoh')
await wait(4000)

// Fixture: dua lagu & satu set list, supaya ada yang bisa dipilih satu-satu.
await p.evaluate(async () => {
  const r = await new Promise((res) => { const q = indexedDB.open('drillkit'); q.onsuccess = () => res(q.result) })
  const tx = r.transaction(['songs', 'setlists'], 'readwrite')
  tx.objectStore('songs').put({ id: 'song_dt_a', title: 'Lagu Data A', bpm: 120, beats: 4, tempoMap: [], createdAt: 1 })
  tx.objectStore('songs').put({ id: 'song_dt_b', title: 'Lagu Data B', bpm: 100, beats: 4, tempoMap: [], createdAt: 1 })
  tx.objectStore('setlists').put({ id: 'sl_dt_1', name: 'Set List Data', songIds: ['song_dt_a', 'song_dt_b'], createdAt: 1, updatedAt: 1 })
  await new Promise((res) => { tx.oncomplete = res })
})
await p.reload({ waitUntil: 'networkidle2' })
await wait(2500)

// ====================================================================== HALAMAN
await p.evaluate(() => { location.hash = '#/data' })
await wait(2000)
cek('halaman Data terbuka', await ada('[data-testid="alur-pindah"]'))
cek('daftar jenis tampil', await ada('[data-testid="pilih-jenis"]'))

// ============================================================== ALUR 1: EKSPOR
cek('jenis lagu tercantum', await ada('[data-testid="centang-jenis-lagu"]'))
const jmlLagu = await teks('[data-testid="jenis-lagu"]')
cek('jumlah lagu terbaca', /\d/.test(jmlLagu), jmlLagu)

await klik('[data-testid="centang-jenis-lagu"]')
await wait(500)
cek('pilihan per entitas muncul untuk lagu', await ada('[data-testid="centang-entitas-song_dt_a"]'))

// Hanya satu lagu yang dipilih — ini inti "pilih-pilih".
await p.$eval('[data-testid="centang-entitas-song_dt_b"]', (e) => e.click())
await wait(300)
await klik('[data-testid="ekspor-data"]')
const berkas = await tungguUnduh('.json')
cek('berkas data terunduh', berkas != null, berkas ?? 'tidak ada')

const isi = JSON.parse(fs.readFileSync(berkas, 'utf8'))
cek('formatnya drillkit-data', isi.format === 'drillkit-data', isi.format)
// Data contoh juga punya satu lagu, jadi yang tersisa dua: song_dt_a dan
// lagu contoh. Yang membuktikan pilihannya bekerja adalah song_dt_b TIDAK
// ikut — bukan hitungan pastinya.
const idLagu = (isi.lagu ?? []).map((l) => l.id)
cek('lagu yang dipilih ikut', idLagu.includes('song_dt_a'), JSON.stringify(idLagu))
cek('lagu yang dilepas TIDAK ikut', !idLagu.includes('song_dt_b'), JSON.stringify(idLagu))
cek('set list tidak ikut karena tidak dicentang', isi.setlist == null)
fs.rmSync(berkas)

// ================================================== ALUR 1: IMPOR + KONFIRMASI
// Berkas berisi: 1 lagu baru, 1 lagu yang SUDAH ada (song_dt_a), dan
// 1 jadwal yang menunjuk set list yang TIDAK ikut (rujukan putus).
const berkasMasuk = {
  format: 'drillkit-data',
  versi: 1,
  dibuat: Date.now(),
  lagu: [
    { id: 'song_dt_a', title: 'Lagu Data A — disunting', bpm: 120, beats: 4, tempoMap: [], createdAt: 1 },
    { id: 'song_dt_baru', title: 'Lagu Baru', bpm: 90, beats: 4, tempoMap: [], createdAt: 1 },
  ],
  jadwal: [
    {
      id: 's_dt_1', title: 'Sesi Impor Data', type: 'latihan', date: '2026-10-03',
      startTime: '08:00', endTime: '09:00', checklist: [], createdAt: 1, setListId: 'sl_tak_ada',
    },
  ],
}
// 2a — satu evaluasi ikut di berkas masuk. `terapkan` menulis semua jenis
// dalam SATU transaksi Dexie. Dulu `evaluasi` dipakai di dalamnya tanpa
// tercantum di cakupannya, sehingga berkas APA PUN yang memuat evaluasi batal
// seluruhnya ("Gagal menerapkan data"), lagu dan jadwalnya pun tidak masuk.
// Rujukannya ke anggota yang ada, supaya tidak ikut dikosongkan.
const anggotaAda = (await bacaDb('members'))[0]?.id
berkasMasuk.evaluasi = [{
  id: 'ev_dt_1', memberId: anggotaAda, tanggal: '2026-09-01',
  nilai: { teknik: 3 }, oleh: 'Pelatih', createdAt: 1,
}]
const jalurMasuk = path.join(BERKAS, 'masuk.json')
fs.writeFileSync(jalurMasuk, JSON.stringify(berkasMasuk))

const sebelum = await bacaDb('songs')
const idSebelum = sebelum.map((s) => s.id).sort()

await (await p.$('[data-testid="berkas-masuk"]')).uploadFile(jalurMasuk)
await wait(2000)
cek('konfirmasi tampil sebelum diterapkan', await ada('[data-testid="konfirmasi-impor"]'))

// --- INTI: belum boleh ada yang berubah.
const sesudahKonfirmasi = await bacaDb('songs')
cek('belum ada yang ditulis sebelum disetujui',
  JSON.stringify(sesudahKonfirmasi.map((s) => s.id).sort()) === JSON.stringify(idSebelum),
  `${idSebelum.length} → ${sesudahKonfirmasi.length}`)

cek('ringkasan lagu tampil', await ada('[data-testid="ringkas-lagu"]'))
const baru = await teks('[data-testid="baru-lagu"]')
const timpa = await teks('[data-testid="timpa-lagu"]')
cek('lagu baru terhitung 1', baru.includes('1 baru'), baru)
cek('lagu yang ditimpa terhitung 1', timpa.includes('1 ditimpa'), timpa)
cek('ringkasan jadwal tampil', await ada('[data-testid="ringkas-jadwal"]'))

// ================================================== TERAPKAN + LAPORAN RUJUKAN
await klik('[data-testid="terapkan-data"]')
await wait(2500)
cek('konfirmasi tertutup setelah diterapkan', !(await ada('[data-testid="konfirmasi-impor"]')))
cek('laporan impor tampil', await ada('[data-testid="laporan-impor"]'))

const laguSesudah = await bacaDb('songs')
cek('lagu baru masuk', laguSesudah.some((s) => s.id === 'song_dt_baru'))
cek('lagu lama tertimpa', laguSesudah.find((s) => s.id === 'song_dt_a')?.title === 'Lagu Data A — disunting')

const jadwalSesudah = await bacaDb('sessions')
const j1 = jadwalSesudah.find((s) => s.id === 's_dt_1')
cek('jadwal tetap masuk walau rujukannya putus', j1 != null)
cek('rujukan yang putus dikosongkan', j1 && (j1.setListId == null || j1.setListId === ''),
  JSON.stringify(j1?.setListId))
// Laporan yang tidak muncul adalah KEGAGALAN yang dilaporkan, bukan mogok
// tanpa ringkasan (dulu `teks()` melempar di sini bila terapkan gagal).
const laporan = (await ada('[data-testid="laporan-impor"]')) ? await teks('[data-testid="laporan-impor"]') : ''
cek('rujukan yang dikosongkan DILAPORKAN', laporan.includes('dikosongkan'), laporan.slice(0, 120) || 'laporan tidak tampil')

const evaluasiSesudah = await bacaDb('evaluasi')
cek('evaluasi ikut masuk', evaluasiSesudah.some((e) => e.id === 'ev_dt_1'),
  JSON.stringify(evaluasiSesudah.map((e) => e.id)))
cek('rujukan evaluasi ke anggota tetap utuh',
  anggotaAda != null && evaluasiSesudah.find((e) => e.id === 'ev_dt_1')?.memberId === anggotaAda)

// Bila terapkan gagal, dialog konfirmasinya tetap terbuka dan menghalangi
// alur berikutnya. Tutup (Escape) supaya sisa uji tetap berjalan, dan
// kegagalan di atas tetap muncul di ringkasan alih-alih berujung mogok.
if (await ada('[data-testid="konfirmasi-impor"]')) {
  await p.keyboard.press('Escape')
  await wait(500)
}

// ============================================================ ALUR 2: CSV
await klik('[data-testid="alur-csv"]')
await wait(1000)
cek('alur CSV terbuka', await ada('[data-testid="pilih-jenis-csv"]'))
cek('tombol ekspor CSV ada', await ada('[data-testid="ekspor-csv"]'))

await klik('[data-testid="ekspor-csv"]')
const csv = await tungguUnduh('.csv')
cek('CSV jadwal terunduh', csv != null, csv ?? 'tidak ada')
if (csv) {
  const teksCsv = fs.readFileSync(csv, 'utf8')
  const barisPertama = teksCsv.split('\n')[0]
  cek('kepala CSV memuat id & judul', barisPertama.includes('id') && barisPertama.includes('judul'), barisPertama)
  cek('CSV memuat sesi yang ada', teksCsv.includes('Sesi Impor Data'), teksCsv.split('\n')[1] ?? '')
}

// Impor CSV yang disunting: ubah judul sesi, dan tambah satu baris baru.
const csvMasuk = [
  'id,judul,jenis,tanggal,mulai,selesai,tempat,setListId',
  's_dt_1,Sesi Impor Data — disunting,latihan,2026-10-03,08:00,09:00,Lapangan A,',
  ',Sesi Baru Dari CSV,latihan,2026-10-04,10:00,11:00,Lapangan B,',
].join('\n')
const jalurCsv = path.join(BERKAS, 'jadwal.csv')
fs.writeFileSync(jalurCsv, csvMasuk)

await (await p.$('[data-testid="csv-masuk"]')).uploadFile(jalurCsv)
await wait(2000)
cek('konfirmasi CSV tampil', await ada('[data-testid="konfirmasi-csv"]'))
const konfCsv = await teks('[data-testid="konfirmasi-csv"]')
cek('konfirmasi menyebut 2 baris', konfCsv.includes('2') && konfCsv.includes('baris'), konfCsv.slice(0, 120))

await klik('[data-testid="terapkan-csv"]')
await wait(2500)
const jadwalAkhir = await bacaDb('sessions')
cek('judul sesi berubah dari CSV', jadwalAkhir.find((s) => s.id === 's_dt_1')?.title === 'Sesi Impor Data — disunting')
cek('sesi baru dari CSV masuk', jadwalAkhir.some((s) => s.title === 'Sesi Baru Dari CSV'))

cek('tidak ada error konsol', errors.length === 0, errors.slice(0, 3).join(' | '))

for (const d of [UNDUH, BERKAS]) fs.rmSync(d, { recursive: true, force: true })
console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) {
  console.log('GAGAL:\n - ' + gagal.join('\n - '))
  await browser.close()
  process.exit(1)
}
await browser.close()
console.log('selesai')
