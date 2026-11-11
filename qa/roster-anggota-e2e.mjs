/**
 * v2.7.1 — Roster pergantian musim: uji peramban ujung ke ujung.
 *
 * Logika murninya diuji di `roster-anggota-logika.mjs`. Di sini sambungannya:
 *
 *   1. Template CSV punya kolom Tag (contoh kelompok roster).
 *   2. Impor CSV ber-pemisah `;` (Excel Indonesia): pratinjau dulu — Baru /
 *      Diperbarui / Tanpa perubahan / Perlu dicek; returner yang sudah ada
 *      diperbarui (status & tag digabung), bukan digandakan; nama mirip
 *      dipilih "Sama dengan …"; kode bentrok diganti; Batal tidak menulis.
 *   3. Pilih banyak: saring tag + tampilkan nonaktif → pilih semua → pasang
 *      tag, aktifkan, lepas tag.
 *   4. Rekap roster: kelompok tebakan dari tag, tambah/keluarkan kelompok
 *      (tersimpan di pengaturan), angka per section/instrumen, Unduh CSV,
 *      Cetak A4 (hex murni, lampiran nama).
 *   5. HP 360 px tanpa gulir mendatar; nol galat konsol.
 *
 * Pakai: npm run build && npx vite preview --port 4173 &
 *        BASE=http://localhost:4173 node qa/roster-anggota-e2e.mjs
 */
import puppeteer from 'puppeteer'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { lewatSambutan } from './sambutan.mjs'

const BASE = process.env.BASE || process.argv[2] || 'http://localhost:4173'
const FOTO = process.env.FOTO || ''

let lulus = 0
const gagal = []
const cek = (nama, syarat, keterangan = '') => {
  if (syarat) {
    lulus += 1
    console.log(`  ✓ ${nama}`)
  } else {
    const baris = `${nama}${keterangan ? ' — ' + keterangan : ''}`
    gagal.push(baris)
    console.log('  ✗ ' + baris)
  }
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'roster-'))
// Nama-nama rekaan (repo publik — tidak pernah memakai data anggota asli).
const CSV = [
  'Kode;Nama;Panggilan;Section;Instrumen;Peran;Tahun Masuk;No. HP;Status;Catatan;Tag',
  ';Rara Anindya;Rara;Brass;Trumpet;Anggota;2026;;Aktif;;CAB 42, Latsar',
  ';Bima Sakti;;Brass;Trumpet;Anggota;2026;;Aktif;;CAB 42',
  'C01;Sekar Wangi;;Color Guard;Flag;Anggota;2026;;Aktif;;CAB 42',
  ';Dimas Prakoso;;;;;;;Aktif;;Returner 2027',
  ';Cika;;Battery;Snare;;;;Aktif;;CAB 42',
  ';Joko Santoso;;;;;;;;;',
].join('\r\n')
const fCsv = path.join(DIR, 'cab-42.csv')
fs.writeFileSync(fCsv, '\ufeff' + CSV)

const browser = await puppeteer.launch({
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  defaultViewport: { width: 1280, height: 900 },
})
const errors = []
const ABAIKAN = /favicon|Failed to load resource|net::ERR/i

try {
  const p = await browser.newPage()
  p.on('console', (m) => {
    if (m.type() === 'error' && !ABAIKAN.test(m.text())) errors.push(m.text())
  })
  p.on('pageerror', (e) => errors.push(String(e)))
  await p.evaluateOnNewDocument(() => {
    window.__cetak = []
    window.__unduh = []
    window.open = () => ({
      document: { write: (h) => window.__cetak.push(h), close() {}, open() {} },
      focus() {},
      setTimeout() {},
      print() {},
      addEventListener() {},
      close() {},
    })
    const asli = URL.createObjectURL.bind(URL)
    URL.createObjectURL = (b) => {
      if (b instanceof Blob) b.text().then((t) => window.__unduh.push(t))
      return asli(b)
    }
  })

  const ada = async (sel) => (await p.$(sel)) != null
  const teks = (sel) => p.$eval(sel, (e) => (e.textContent ?? '').replace(/\s+/g, ' ').trim())
  const klik = async (sel) => {
    await p.waitForSelector(sel, { timeout: 15000 })
    await p.$eval(sel, (e) => e.scrollIntoView({ block: 'center' }))
    await p.click(sel)
  }
  const isi = async (sel, nilai) => {
    await p.waitForSelector(sel, { timeout: 10000 })
    await p.$eval(
      sel,
      (el, v) => {
        const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype
        Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v)
        el.dispatchEvent(new Event('input', { bubbles: true }))
        el.dispatchEvent(new Event('change', { bubbles: true }))
      },
      String(nilai),
    )
  }
  const idb = (fn, arg) =>
    p.evaluate(
      (src, a) =>
        new Promise((res, rej) => {
          const r = indexedDB.open('drillkit')
          r.onerror = () => rej(r.error)
          r.onsuccess = () => {
            const db = r.result
            Promise.resolve(new Function('db', 'arg', src)(db, a)).then((x) => {
              db.close()
              res(x)
            }, rej)
          }
        }),
      `return (${fn})(db, arg)`,
      arg,
    )
  const semua = (store) =>
    idb(
      (db, s) =>
        new Promise((res) => {
          const q = db.transaction(s).objectStore(s).getAll()
          q.onsuccess = () => res(q.result)
        }),
      store,
    )
  const anggota = async () => semua('members')
  const tim = async () => (await semua('settings')).find((x) => x.key === 'team') ?? {}
  const foto = async (nama) => FOTO && p.screenshot({ path: `${FOTO}/${nama}.png`, fullPage: true })
  const unduhan = () => p.evaluate(() => window.__unduh.slice())

  /* ============================== Persiapan ============================== */
  await p.goto(BASE, { waitUntil: 'networkidle2' })
  await lewatSambutan(p)
  await idb(
    (db) =>
      new Promise((res, rej) => {
        const tx = db.transaction(['members'], 'readwrite')
        const s = tx.objectStore('members')
        s.clear()
        const m = (o) => s.put({ instrument: '', role: 'member', joinYear: 2024, active: 1, token: 'tk_' + o.id, createdAt: 1, ...o })
        m({ id: 'r1', code: 'BR01', name: 'Dimas Prakoso', section: 'brass', instrument: 'Trumpet', active: 0, tags: ['Returner – menunggu'], phone: '0811' })
        m({ id: 'r2', code: 'BT01', name: 'Cika Ayu Lestari', section: 'percussion', instrument: 'Snare', active: 0 })
        m({ id: 'r3', code: 'C01', name: 'Joko Santoso', section: 'brass', instrument: 'Tuba' })
        m({ id: 'r4', code: 'CG01', name: 'Lina Marlina', section: 'guard', instrument: 'Flag', active: 0, tags: ['Returner – menunggu'] })
        tx.oncomplete = () => res(true)
        tx.onerror = () => rej(tx.error)
      }),
  )
  await p.goto(`${BASE}/#/anggota`, { waitUntil: 'networkidle2' })
  await p.reload({ waitUntil: 'networkidle2' })
  await p.waitForSelector('[data-testid="tombol-rekap-roster"]', { timeout: 10000 })

  /* ============================== 1. Template ============================== */
  console.log('\n— Template CSV —')
  await p.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.title === 'Unduh contoh berkas CSV')?.click())
  await p.waitForFunction(() => window.__unduh.length > 0, { timeout: 5000 }).catch(() => {})
  const template = (await unduhan())[0] ?? ''
  const judulTemplate = template.replace(/^\ufeff/, '').split(/\r?\n/)[0]
  cek('judul template diakhiri kolom Tag', judulTemplate.endsWith(',Tag'), judulTemplate)
  cek('contoh memakai kelompok roster (tag returner yang menunggu)', template.includes('Returner – menunggu'), template.slice(0, 300))

  /* ============================== 2. Impor ============================== */
  console.log('\n— Impor CSV: pratinjau & cocok nama —')
  await (await p.$('[data-testid="berkas-anggota"]')).uploadFile(fCsv)
  await p.waitForSelector('[data-testid="impor-csv-anggota"]', { timeout: 10000 })
  const ringkas = await teks('[data-testid="impor-csv-ringkasan"]')
  cek('ringkasan: 3 baru · 1 diperbarui · 1 tanpa perubahan · 1 perlu dicek', /Baru 3/.test(ringkas) && /Diperbarui 1/.test(ringkas) && /Tanpa perubahan 1/.test(ringkas) && /Perlu dicek 1/.test(ringkas), ringkas)
  const jenis = await p.$$eval('[data-testid^="impor-csv-baris-"]', (xs) => xs.map((x) => x.dataset.jenis))
  cek('urutan jenis per baris', jenis.join() === 'baru,baru,baru,perbarui,mirip,sama', jenis.join())
  cek('baris diperbarui merangkum perubahan', (await teks('[data-testid="impor-csv-baris-3"]')).includes('diaktifkan') && (await teks('[data-testid="impor-csv-baris-3"]')).includes('tag + Returner 2027'))
  cek('pemisah ; — sel Tag berkoma tetap utuh', (await teks('[data-testid="impor-csv-baris-0"]')).includes('#CAB 42') && (await teks('[data-testid="impor-csv-baris-0"]')).includes('#Latsar'))
  cek('belum ada yang ditulis sebelum Terapkan', (await anggota()).length === 4)
  await foto('impor')
  // Batal tidak menulis apa pun.
  await p.evaluate(() => [...document.querySelectorAll('[data-testid="impor-csv-anggota"] button')].find((b) => b.textContent?.trim() === 'Batal')?.click())
  await wait(300)
  cek('Batal: pratinjau tertutup, tidak ada yang ditulis', !(await ada('[data-testid="impor-csv-anggota"]')) && (await anggota()).length === 4)

  await (await p.$('[data-testid="berkas-anggota"]')).uploadFile(fCsv)
  await p.waitForSelector('[data-testid="impor-csv-pilih-4"]', { timeout: 10000 })
  const opsi = await p.$$eval('[data-testid="impor-csv-pilih-4"] option', (os) => os.map((o) => o.value))
  cek('nama mirip: kandidat kartu lama ditawarkan', opsi.includes('r2'), opsi.join())
  await p.select('[data-testid="impor-csv-pilih-4"]', 'r2')
  await wait(200)
  const tombol = await teks('[data-testid="impor-csv-terapkan"]')
  cek('tombol Terapkan ikut berubah (3 baru · 2 diperbarui)', tombol.includes('3 baru') && tombol.includes('2 diperbarui'), tombol)
  await klik('[data-testid="impor-csv-terapkan"]')
  await p.waitForFunction(() => !document.querySelector('[data-testid="impor-csv-anggota"]'), { timeout: 8000 })
  const m1 = await anggota()
  const cari = (nama) => m1.find((m) => m.name === nama)
  cek('total 7 anggota (tidak ada kartu ganda)', m1.length === 7, String(m1.length))
  cek('returner diperbarui: aktif, tag digabung, no. HP & instrumen tetap', cari('Dimas Prakoso')?.active === 1 && JSON.stringify(cari('Dimas Prakoso')?.tags) === '["Returner – menunggu","Returner 2027"]' && cari('Dimas Prakoso')?.phone === '0811' && cari('Dimas Prakoso')?.instrument === 'Trumpet', JSON.stringify(cari('Dimas Prakoso')))
  cek('"Cika" → kartu lama "Cika Ayu Lestari" diperbarui', m1.find((m) => m.id === 'r2')?.active === 1 && m1.find((m) => m.id === 'r2')?.tags?.[0] === 'CAB 42' && !cari('Cika'))
  cek('CAB baru: tag dari CSV (dua tag)', JSON.stringify(cari('Rara Anindya')?.tags) === '["CAB 42","Latsar"]' && cari('Rara Anindya')?.panggilan === 'Rara')
  cek('kode C01 bentrok → kode unik baru', cari('Sekar Wangi')?.code && cari('Sekar Wangi').code !== 'C01', cari('Sekar Wangi')?.code)
  cek('anggota baru punya token QR', !!cari('Bima Sakti')?.token)
  cek('baris kosong tidak mengubah Joko', cari('Joko Santoso')?.instrument === 'Tuba' && cari('Joko Santoso')?.code === 'C01')

  /* ============================== 3. Pilih banyak ============================== */
  console.log('\n— Pilih banyak (aksi massal) —')
  await isi('[data-testid="filter-tag-anggota"]', 'tag:Returner – menunggu')
  await klik('[data-testid="toggle-anggota-nonaktif"]')
  await klik('[data-testid="tombol-pilih-anggota"]')
  await p.waitForSelector('[data-testid="bilah-aksi-massal"]', { timeout: 5000 })
  cek('kotak centang muncul di tiap baris', await ada('[data-testid="pilih-r4"]'))
  await klik('[data-testid="pilih-semua-tampil"]')
  cek('pilih semua yang tampil (2 returner menunggu)', (await teks('[data-testid="jumlah-terpilih"]')) === '2 dipilih', await teks('[data-testid="jumlah-terpilih"]'))
  await isi('[data-testid="tag-massal"]', 'Returner 2027')
  await klik('[data-testid="massal-tambah-tag"]')
  await wait(400)
  await klik('[data-testid="massal-aktifkan"]')
  await wait(400)
  await isi('[data-testid="tag-massal"]', 'Returner – menunggu')
  await klik('[data-testid="massal-lepas-tag"]')
  await wait(500)
  const m2 = await anggota()
  const lina = m2.find((m) => m.id === 'r4')
  cek('Lina: aktif & tag Returner 2027, tag menunggu dilepas', lina?.active === 1 && JSON.stringify(lina?.tags) === '["Returner 2027"]', JSON.stringify(lina))
  cek('Dimas: tag menunggu dilepas, tag 2027 tidak dobel', JSON.stringify(m2.find((m) => m.id === 'r1')?.tags) === '["Returner 2027"]')
  cek('yang tidak dipilih tidak tersentuh', JSON.stringify(m2.find((m) => m.name === 'Rara Anindya')?.tags) === '["CAB 42","Latsar"]')
  await klik('[data-testid="kosongkan-pilihan"]')
  cek('kosongkan pilihan', (await teks('[data-testid="jumlah-terpilih"]')) === '0 dipilih')
  cek('tombol aksi nonaktif tanpa pilihan', await p.$eval('[data-testid="massal-aktifkan"]', (b) => b.disabled))
  await foto('pilih')
  await klik('[data-testid="tombol-pilih-anggota"]')
  cek('Selesai memilih: kotak centang hilang', !(await ada('[data-testid="pilih-r4"]')))
  await isi('[data-testid="filter-tag-anggota"]', 'all')

  /* ============================== 4. Rekap roster ============================== */
  console.log('\n— Rekap roster —')
  await klik('[data-testid="tombol-rekap-roster"]')
  await p.waitForSelector('[data-testid="tabel-rekap-roster"]', { timeout: 10000 })
  const kel = await p.$$eval('[data-testid="kelompok-roster"] > span', (xs) => xs.map((x) => (x.textContent ?? '').replace(/[‹›×]/g, '').trim()))
  cek('kelompok ditebak dari tag (CAB 42 terbanyak di depan, tanpa "Lainnya")', kel[0] === '#CAB 42' && kel.includes('#Returner 2027') && kel.includes('#Latsar'), kel.join(' | '))
  // Latsar bukan kelompok roster di tim ini → keluarkan; tambah Alumni.
  const iLatsar = kel.indexOf('#Latsar')
  await klik(`[data-testid="kelompok-hapus-${iLatsar}"]`)
  // Tunggu kondisi nyata, bukan jeda tetap (runner CI lambat): Latsar hilang dari chip,
  // tombol tambah aktif setelah input terisi, lalu Alumni tersimpan.
  const chipKelompok = () => [...document.querySelectorAll('[data-testid="kelompok-roster"] > span')].map((x) => (x.textContent ?? '').replace(/[‹›×]/g, '').trim())
  await p.waitForFunction(`!(${chipKelompok})().includes('#Latsar')`, { timeout: 10000 })
  await isi('[data-testid="kelompok-baru"]', 'Alumni')
  await p.waitForFunction(() => !document.querySelector('[data-testid="kelompok-tambah"]')?.disabled, { timeout: 10000 })
  await klik('[data-testid="kelompok-tambah"]')
  await p.waitForFunction(`(${chipKelompok})().includes('#Alumni')`, { timeout: 10000 }).catch(() => {})
  await wait(200)
  cek('kelompok tersimpan di pengaturan tim', JSON.stringify((await tim()).kelompokRoster) === '["CAB 42","Returner 2027","Alumni"]', JSON.stringify((await tim()).kelompokRoster))
  const total = await p.$$eval('[data-testid="rekap-total"] td', (xs) => xs.map((x) => x.textContent?.trim()))
  // Kolom: Total | CAB 42 | Returner 2027 | Alumni | Lainnya | Total aktif
  cek('baris total: CAB 4 · Returner 2 · Alumni – · Lainnya 1 · aktif 7', total.join('|') === 'Total|4|2|–|1|7', total.join('|'))
  const brass = await p.$$eval('[data-testid="rekap-seksi-brass"] tr', (xs) => xs.map((x) => (x.textContent ?? '').replace(/\s+/g, ' ').trim()))
  cek('brass per instrumen (Trumpet: 2 CAB + 1 returner)', brass.some((t) => /^Trumpet\s*2\s*1/.test(t)), brass.join(' | '))
  cek('Joko (tanpa kelompok) di Lainnya, baris Tuba', brass.some((t) => /^Tuba/.test(t)))
  await p.evaluate(() => (window.__unduh.length = 0))
  await klik('[data-testid="rekap-unduh-csv"]')
  await p.waitForFunction(() => window.__unduh.length > 0, { timeout: 5000 }).catch(() => {})
  const csvRekap = (await unduhan())[0] ?? ''
  cek('Unduh CSV rekap', csvRekap.includes('CAB 42 (aktif)') && csvRekap.includes('Semua'), csvRekap.slice(0, 120))
  await klik('[data-testid="rekap-cetak"]')
  await p.waitForFunction(() => window.__cetak.length > 0, { timeout: 8000 }).catch(() => {})
  const html = (await p.evaluate(() => window.__cetak.at(-1))) ?? ''
  cek('Cetak A4: lembar rekap + lampiran nama', html.includes('data-lembar-roster') && html.includes('Daftar nama per kelompok') && html.includes('Rara Anindya'))
  cek('Cetak A4: warna hex murni', html.length > 0 && !/oklch|rgba?\(|var\(--/.test(html))
  await foto('rekap')

  /* ============================== 5. HP 360 px ============================== */
  console.log('\n— HP 360 px —')
  await p.setViewport({ width: 360, height: 780 })
  const lebar = () => p.evaluate(() => document.documentElement.scrollWidth)
  await wait(400)
  cek('Rekap roster muat 360 px', (await lebar()) <= 360, String(await lebar()))
  await p.keyboard.press('Escape')
  await wait(300)
  await klik('[data-testid="tombol-pilih-anggota"]')
  await wait(300)
  cek('Anggota + bilah aksi massal muat 360 px', (await lebar()) <= 360, String(await lebar()))
  await foto('anggota-360')
  await (await p.$('[data-testid="berkas-anggota"]')).uploadFile(fCsv)
  await p.waitForSelector('[data-testid="impor-csv-anggota"]', { timeout: 10000 })
  await wait(300)
  cek('Pratinjau impor muat 360 px', (await lebar()) <= 360, String(await lebar()))
  const ringkas2 = await teks('[data-testid="impor-csv-ringkasan"]')
  cek('impor ulang berkas yang sama: tanpa kartu baru (5 tanpa perubahan, 1 perlu dicek)', !/Baru \d/.test(ringkas2) && /Tanpa perubahan 5/.test(ringkas2) && /Perlu dicek 1/.test(ringkas2), ringkas2)

  cek('nol galat konsol', errors.length === 0, errors.slice(0, 3).join(' | '))
} catch (e) {
  gagal.push('PENGECUALIAN: ' + (e?.stack ?? e))
  console.log('  ✗ PENGECUALIAN', e)
} finally {
  await browser.close()
  fs.rmSync(DIR, { recursive: true, force: true })
}
console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) {
  for (const g of gagal) console.log('  ✗ ' + g)
  process.exit(1)
}
