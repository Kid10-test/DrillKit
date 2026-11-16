/**
 * Uji peramban Pacu v2 (v2.11) — rundown yang berubah di lapangan.
 *
 * Satu sesi dijalankan dari awal sampai laporan, dengan semua perubahan
 * yang lazim terjadi: apel terlambat, Mulai/Lanjut tanpa menekan Selesai,
 * jeda, blok tambahan, ubah menit, tukar urutan, lewati, bawa ke sesi
 * berikutnya, koreksi jam, batal catat, dan ulangi pencatatan. Satu sesi lain
 * berisi data lama dengan dua blok berjalan sekaligus.
 *
 * Isi IndexedDB ikut diperiksa — tampilan yang benar di atas data yang salah
 * tetap kegagalan.
 */
import puppeteer from 'puppeteer'
import { lewatSambutan } from './sambutan.mjs'

const BASE = process.env.BASE || 'http://localhost:4173'
const browser = await puppeteer.launch({
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  defaultViewport: { width: 1280, height: 1100 },
})
await browser.defaultBrowserContext().overridePermissions(new URL(BASE).origin, ['clipboard-read', 'clipboard-write', 'clipboard-sanitized-write'])
const p = await browser.newPage()
const errors = []
p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
p.on('pageerror', (e) => errors.push(String(e)))

let lulus = 0
const gagal = []
const cek = (nama, syarat, keterangan = '') => {
  if (syarat) lulus += 1
  else gagal.push(`${nama}${keterangan ? ' — ' + keterangan : ''}`)
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const teks = (sel) => p.$eval(sel, (e) => e.textContent.replace(/\s+/g, ' ').trim())
const ada = async (sel) => (await p.$(sel)) != null
const klik = async (sel) => { await p.waitForSelector(sel, { timeout: 10000 }); await p.click(sel); await wait(700) }
const atr = (sel, a) => p.$eval(sel, (e, x) => e.getAttribute(x), a)
const geser = async () => Number(await atr('[data-testid="geser"]', 'data-geser'))
const isi = async (sel, nilai) => {
  await p.waitForSelector(sel, { timeout: 10000 })
  await p.$eval(sel, (e, v) => {
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(e), 'value').set
    setter.call(e, v)
    e.dispatchEvent(new Event('input', { bubbles: true }))
    e.dispatchEvent(new Event('change', { bubbles: true }))
  }, nilai)
  await wait(200)
}
const sesiDb = (id) =>
  p.evaluate(async (x) => {
    const r = await new Promise((res) => { const q = indexedDB.open('drillkit'); q.onsuccess = () => res(q.result) })
    return await new Promise((res) => {
      const g = r.transaction('sessions').objectStore('sessions').get(x)
      g.onsuccess = () => res(g.result)
    })
  }, id)
const urutan = () => p.$$eval('[data-testid^="baris-blok-"]', (el) => el.map((e) => e.getAttribute('data-testid').slice('baris-blok-'.length)))
const status = (id) => atr(`[data-testid="baris-blok-${id}"]`, 'data-status')
const tombol = (t) =>
  p.evaluate((x) => {
    const b = [...document.querySelectorAll('button')].find((y) => y.textContent.includes(x))
    if (!b || b.disabled) return false
    b.click()
    return true
  }, t)

// Jam yang aman: hindari sesi yang menyeberang tengah malam.
await p.evaluateOnNewDocument(() => {
  const asli = Date.now()
  const d = new Date(asli)
  const mnt = d.getHours() * 60 + d.getMinutes()
  if (mnt < 60 || mnt >= 21 * 60) {
    const target = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 10, 0, d.getSeconds()).getTime()
    const selisih = target - asli
    const AsliDate = Date
    // eslint-disable-next-line no-global-assign
    Date = class extends AsliDate {
      constructor(...args) {
        super(...(args.length === 0 ? [AsliDate.now() + selisih] : args))
      }
      static now() {
        return AsliDate.now() + selisih
      }
    }
  }
})
await p.goto(BASE, { waitUntil: 'networkidle2' })
await lewatSambutan(p)
await p.evaluate(() => localStorage.setItem('drillkit.jadwal.tampilan', 'daftar'))
await wait(1500)
await tombol('Muat data contoh')
await wait(4000)

await p.evaluate(async () => {
  const r = await new Promise((res) => { const q = indexedDB.open('drillkit'); q.onsuccess = () => res(q.result) })
  const skrg = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const M = 60000
  const awal = new Date(skrg.getTime() - 15 * M)
  awal.setSeconds(0, 0)
  const jam = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`
  const besok = new Date(skrg.getTime() + 2 * 86400000)
  const tx = r.transaction(['sessions'], 'readwrite')
  const st = tx.objectStore('sessions')
  st.put({
    id: 's_v2', title: 'Pacu V2', type: 'latihan', date: iso(skrg),
    startTime: jam(awal), endTime: jam(new Date(awal.getTime() + 90 * M)), place: 'Lapangan', notes: '', checklist: [],
    createdAt: Date.now(),
    rencanaLatihan: [
      { id: 'apel', judul: 'Apel', jenis: 'apel', menit: 10 },
      { id: 'panas', judul: 'Warm up', jenis: 'pemanasan', menit: 10 },
      { id: 'klinik', judul: 'Klinik 3 pos', jenis: 'drill', menit: 30 },
      { id: 'simulasi', judul: 'Simulasi', jenis: 'drill', menit: 20, prioritas: 'potong' },
      { id: 'post', judul: 'Post-test', jenis: 'tes', menit: 10 },
      { id: 'dingin', judul: 'Pendinginan', jenis: 'pendingin', menit: 5 },
    ],
    realisasiLatihan: [],
  })
  st.put({
    id: 's_v2_p4', title: 'Pacu V2 Lanjutan', type: 'latihan', date: iso(besok),
    startTime: '17:30', endTime: '19:00', place: 'Lapangan', notes: '', checklist: [], createdAt: Date.now(),
    rencanaLatihan: [{ id: 'p4_apel', judul: 'Apel', jenis: 'apel', menit: 10 }],
  })
  // Data lama: dua blok berjalan sekaligus.
  st.put({
    id: 's_v2_ganda', title: 'Pacu Ganda', type: 'latihan', date: iso(skrg),
    startTime: jam(awal), endTime: jam(new Date(awal.getTime() + 60 * M)), place: 'Lapangan', notes: '', checklist: [],
    createdAt: Date.now(),
    rencanaLatihan: [
      { id: 'g_a', judul: 'Satu', jenis: 'pemanasan', menit: 10 },
      { id: 'g_b', judul: 'Dua', jenis: 'section', menit: 20 },
      { id: 'g_c', judul: 'Tiga', jenis: 'gabungan', menit: 20 },
    ],
    realisasiLatihan: [
      { id: 'g_a', mulai: awal.getTime(), selesai: null },
      { id: 'g_b', mulai: awal.getTime() + 12 * M, selesai: null },
    ],
  })
  await new Promise((res) => { tx.oncomplete = res })
})

await p.reload({ waitUntil: 'networkidle2' })
await wait(2500)
await p.evaluate(() => { location.hash = '#/jadwal' })
await wait(2000)

// ======================================================= data lama: dua berjalan
await klik('[data-testid="pacu-s_v2_ganda"]')
await wait(1200)
cek('dua berjalan: layar terbuka', await ada('[data-testid="pacu-latihan"]'))
const berjalanGanda = await p.$$eval('[data-status="berjalan"]', (el) => el.map((e) => e.getAttribute('data-testid')))
cek('dua berjalan: hanya satu baris berjalan', berjalanGanda.length === 1 && berjalanGanda[0] === 'baris-blok-g_b', berjalanGanda.join(','))
cek('dua berjalan: blok lama terbaca selesai', (await status('g_a')) === 'selesai')
await klik('[data-testid="tutup-pacu"]')

// ============================================================ apel terlambat
await klik('[data-testid="pacu-s_v2"]')
await wait(1200)
const g0 = await geser()
cek('apel belum mulai 15 mnt sesudah jadwal → terlambat 15/16', g0 === 15 || g0 === 16, String(g0))
cek('kartu: seharusnya sekarang Warm up', (await atr('[data-testid="kartu-berjalan"]', 'data-blok')) === 'panas')
cek('kartu: belum ada blok yang dimulai, berikutnya Apel', (await teks('[data-testid="belum-ada-blok"]')).includes('Apel'))
cek('tombol Mulai untuk Apel', (await teks('[data-testid="tombol-mulai"]')).includes('Apel'))
cek('usul potong muncul', await ada('[data-testid="usul-potong"]'))
cek('usul: simulasi (potong dulu) dikurangi', (await teks('[data-testid="usul-simulasi"]')).includes('Simulasi 20 →'))
cek('usul: blok kunci tidak diusulkan', !(await ada('[data-testid="usul-post"]')) && !(await ada('[data-testid="usul-apel"]')))
cek('tanda kunci di Post-test', (await teks('[data-testid="baris-blok-post"]')).includes('kunci'))
cek('tanda potong dulu di Simulasi', (await teks('[data-testid="baris-blok-simulasi"]')).includes('potong dulu'))

await klik('[data-testid="tombol-mulai"]')
cek('Apel berjalan', (await atr('[data-testid="kartu-berjalan"]', 'data-blok')) === 'apel')
let s = await sesiDb('s_v2')
cek('rencana awal dibekukan saat Mulai pertama', s.rencanaAwal?.blok?.length === 6)
cek('selisih tetap terlambat sesudah apel mulai', (await geser()) >= 15)
cek('rincian: mulai terlambat', (await teks('[data-testid="rincian-geser"]')).includes('mulai terlambat'))

// ======================================================= Lanjut menutup yang berjalan
await klik('[data-testid="tombol-lanjut"]')
s = await sesiDb('s_v2')
cek('Lanjut: Warm up berjalan', (await atr('[data-testid="kartu-berjalan"]', 'data-blok')) === 'panas')
cek('Lanjut: Apel ditutup otomatis', s.realisasiLatihan.find((r) => r.id === 'apel')?.selesai != null)
cek('Lanjut: hanya satu blok berjalan di data', s.realisasiLatihan.filter((r) => r.selesai == null).length === 1)

await klik('[data-testid="tombol-selesai"]')
cek('jeda: kartu dalam keadaan jeda', (await atr('[data-testid="kartu-berjalan"]', 'data-keadaan')) === 'jeda')
cek('jeda: berikutnya Klinik', (await teks('[data-testid="blok-berikut"]')).includes('Klinik 3 pos'))
cek('jeda: hitungan jeda tampil', await ada('[data-testid="jeda"]'))

// ============================================================ blok tambahan
const gSebelumTambah = await geser()
await klik('[data-testid="tombol-tambah"]')
await isi('[data-testid="tambah-judul"]', 'Briefing hujan')
await isi('[data-testid="tambah-menit"]', '5')
await klik('[data-testid="tambah-simpan"]')
let u = await urutan()
const idTambah = u[2]
cek('tambahan: masuk sesudah Warm up', u.length === 7 && !['apel', 'panas', 'klinik'].includes(idTambah), u.join(','))
cek('tambahan: bertanda tambahan', (await teks(`[data-testid="baris-blok-${idTambah}"]`)).includes('tambahan'))
const gSesudahTambah = await geser()
cek('tambahan: selisih bertambah 5', gSesudahTambah - gSebelumTambah >= 4 && gSesudahTambah - gSebelumTambah <= 6, `${gSebelumTambah} → ${gSesudahTambah}`)

// ================================================================ ubah menit
await klik('[data-testid="menu-klinik"]')
await isi('[data-testid="ubah-menit-klinik"]', '20')
await klik('[data-testid="simpan-menit-klinik"]')
cek('ubah menit: info menyebut menit awal', (await teks('[data-testid="info-blok-klinik"]')).includes('20 mnt (awal 30)'))
const gSesudahUbah = await geser()
cek('ubah menit: selisih turun 10', gSesudahTambah - gSesudahUbah >= 9 && gSesudahTambah - gSesudahUbah <= 11, `${gSesudahTambah} → ${gSesudahUbah}`)
s = await sesiDb('s_v2')
cek('ubah menit: rencana awal tetap 30', s.rencanaAwal.blok.find((b) => b.id === 'klinik').menit === 30)
await klik('[data-testid="menu-klinik"]')

// ============================================================ tukar urutan
await klik('[data-testid="naik-klinik"]')
u = await urutan()
cek('tukar: Klinik naik di depan blok tambahan', u.indexOf('klinik') === 2 && u.indexOf(idTambah) === 3, u.join(','))
cek('tukar: blok yang sudah selesai tidak bisa dinaikkan', await p.$eval('[data-testid="naik-klinik"]', (e) => e.disabled))

// ================================================================== lewati
await klik('[data-testid="menu-simulasi"]')
await klik('[data-testid="lewati-simulasi"]')
cek('lewati: status dilewati', (await status('simulasi')) === 'dilewati')
const gSesudahLewati = await geser()
cek('lewati: selisih turun ±20', gSesudahUbah - gSesudahLewati >= 19 && gSesudahUbah - gSesudahLewati <= 21, `${gSesudahUbah} → ${gSesudahLewati}`)

// ======================================================== bawa ke sesi berikutnya
await klik(`[data-testid="menu-${idTambah}"]`)
cek('bawa: tombol menyebut sesi tujuan', (await teks(`[data-testid="bawa-${idTambah}"]`)).includes('Pacu V2 Lanjutan'))
await klik(`[data-testid="bawa-${idTambah}"]`)
cek('bawa: status dibawa', (await status(idTambah)) === 'dibawa')
cek('bawa: info menyebut tujuan', (await teks(`[data-testid="info-blok-${idTambah}"]`)).includes('Pacu V2 Lanjutan'))
const p4 = await sesiDb('s_v2_p4')
const salinan = p4.rencanaLatihan.at(-1)
cek('bawa: salinan di sesi tujuan', p4.rencanaLatihan.length === 2 && salinan.judul === 'Briefing hujan' && salinan.dibawaDari === 's_v2')
cek('bawa: salinan ber-id baru', salinan.id !== idTambah)

// ======================================================= mulai di luar urutan
await klik('[data-testid="tombol-mulai"]')
cek('Klinik berjalan', (await atr('[data-testid="kartu-berjalan"]', 'data-blok')) === 'klinik')
await wait(1200)
await klik('[data-testid="mulai-post"]')
s = await sesiDb('s_v2')
cek('mulai dari daftar: Post-test berjalan', (await atr('[data-testid="kartu-berjalan"]', 'data-blok')) === 'post')
cek('mulai dari daftar: Klinik ditutup otomatis', s.realisasiLatihan.find((r) => r.id === 'klinik')?.selesai != null)
cek('lanjut sesudah blok dilewati/dibawa tidak dicatat sebagai pindah', !s.jejakPacu.some((j) => j.jenis === 'pindah' && j.blokId === 'post'))

// ================================================================== koreksi
const klinikMulai = s.realisasiLatihan.find((r) => r.id === 'klinik').mulai
const dKoreksi = new Date(klinikMulai - 2 * 60000)
const jamKoreksi = `${String(dKoreksi.getHours()).padStart(2, '0')}:${String(dKoreksi.getMinutes()).padStart(2, '0')}`
await klik('[data-testid="menu-klinik"]')
await isi('[data-testid="koreksi-mulai-klinik"]', jamKoreksi)
await klik('[data-testid="koreksi-simpan-klinik"]')
s = await sesiDb('s_v2')
const klinikBaru = s.realisasiLatihan.find((r) => r.id === 'klinik')
cek('koreksi: jam mulai berubah', new Date(klinikBaru.mulai).getMinutes() === dKoreksi.getMinutes())
cek('koreksi: catatan blok lain tetap', s.realisasiLatihan.find((r) => r.id === 'post')?.selesai === null)
cek('koreksi: masuk jejak', s.jejakPacu.some((j) => j.jenis === 'koreksi' && j.blokId === 'klinik'))

// ====================================================== selesai → laporan
await klik('[data-testid="tombol-lanjut"]')
await klik('[data-testid="tombol-selesai"]')
cek('rampung: kartu selesai', (await atr('[data-testid="kartu-berjalan"]', 'data-keadaan')) === 'rampung')
cek('rampung: laporan terbuka', await ada('[data-testid="tabel-laporan"]'))
cek('laporan: simulasi dilewati', (await teks('[data-testid="laporan-simulasi"]')).includes('Dilewati'))
cek('laporan: blok tambahan dibawa', (await teks(`[data-testid="laporan-${idTambah}"]`)).includes('Dibawa'))
cek('laporan: menit diubah tampil', (await teks('[data-testid="laporan-klinik"]')).includes('30′ → 20′'))
cek('laporan: ringkasan kunci 3/3', (await teks('[data-testid="ringkas-laporan"]')).includes('kunci 3/3'))
const nJejak = (await p.$$('[data-testid="baris-jejak"]')).length
cek('laporan: jejak perubahan tampil', nJejak >= 5, String(nJejak))
await klik('[data-testid="salin-laporan"]')
cek('laporan: tombol salin memberi tanda', (await teks('[data-testid="salin-laporan"]')) === 'Tersalin')
const papan = await p.evaluate(() => navigator.clipboard.readText().catch(() => ''))
cek('laporan: teks tersalin berisi judul sesi', papan === '' || papan.startsWith('Laporan realisasi: Pacu V2'), papan.slice(0, 60))

// ================================================================ batal catat
await klik('[data-testid="menu-simulasi"]')
await klik('[data-testid="batal-catat-simulasi"]')
cek('batal lewati: simulasi kembali belum', (await status('simulasi')) === 'belum')
cek('batal lewati: sesi kembali berjalan (ada blok tersisa)', (await atr('[data-testid="kartu-berjalan"]', 'data-keadaan')) === 'jeda')
await klik('[data-testid="tombol-lewati"]')
cek('tombol Lewati besar: simulasi dilewati lagi', (await status('simulasi')) === 'dilewati')

// ============================================================ ulangi pencatatan
const jejakSebelum = (await sesiDb('s_v2')).jejakPacu.length
await klik('[data-testid="reset-realisasi"]')
await klik('[data-testid="reset-realisasi-yakin"]')
s = await sesiDb('s_v2')
cek('ulangi: realisasi kosong', (s.realisasiLatihan ?? []).length === 0)
cek('ulangi: rencana awal dibuang', !('rencanaAwal' in s))
cek('ulangi: jejak tetap disimpan (+1)', s.jejakPacu.length === jejakSebelum + 1)

await klik('[data-testid="tutup-pacu"]')
cek('tidak ada error konsol', errors.length === 0, errors.slice(0, 3).join(' | '))

console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) {
  console.log('GAGAL:\n - ' + gagal.join('\n - '))
  await browser.close()
  process.exit(1)
}
await browser.close()
console.log('selesai')
