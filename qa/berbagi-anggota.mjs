/**
 * Uji berbagi ke anggota — berkas grup vs berkas per anggota.
 *
 * Asersi yang menentukan bukan "tampilannya disaring", melainkan:
 *
 * 1. **Berkas grup memuat NOL data pribadi** — absensi, catatan, telepon,
 *    dan catatan pribadi pelatih semuanya kosong.
 * 2. **Tiap berkas anggota memuat NOL data anggota lain.** Ini yang
 *    penting: sebelum perbaikan, satu berkas memuat 36 catatan absensi
 *    padahal hanya 2 yang milik penerimanya.
 * 3. ZIP-nya **benar-benar bisa dibuka** — diperiksa dengan `zipfile`
 *    Python, bukan sekadar diunduh.
 * 4. Nilai evaluasi H2 tidak pernah ikut, ke mana pun.
 */
import puppeteer from 'puppeteer'
import { lewatSambutan } from './sambutan.mjs'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const BASE = process.env.BASE || 'http://localhost:5173'
const UNDUH = path.join(os.tmpdir(), `unduh-berbagi-${Date.now()}`)
fs.mkdirSync(UNDUH, { recursive: true })

const browser = await puppeteer.launch({
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  defaultViewport: { width: 1400, height: 1200 },
})
const p = await browser.newPage()
const errors = []
p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
p.on('pageerror', (e) => errors.push(String(e)))
p.on('dialog', async (d) => { await d.accept() })

let lulus = 0
const gagal = []
const cek = (nama, syarat, keterangan = '') => {
  if (syarat) lulus += 1
  else gagal.push(`${nama}${keterangan ? ' — ' + keterangan : ''}`)
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const tombol = (t) =>
  p.evaluate((x) => {
    const b = [...document.querySelectorAll('button')].find((y) => y.textContent.includes(x))
    if (!b || b.disabled) return false
    b.click()
    return true
  }, t)

await p.goto(BASE, { waitUntil: 'networkidle2' })
await lewatSambutan(p)
await wait(1500)
await tombol('Muat data contoh')
await wait(4000)
await p.reload({ waitUntil: 'networkidle2' })
await wait(2500)

// ------------------------------------------ siapkan data pribadi untuk 4 anggota
const DISEM = await p.evaluate(async () => {
  const db = await new Promise((res) => { const q = indexedDB.open('drillkit'); q.onsuccess = () => res(q.result) })
  const anggota = await new Promise((res) => {
    const q = db.transaction(['members'], 'readonly').objectStore('members').getAll()
    q.onsuccess = () => res(q.result)
  })
  const s = Date.now()
  const empat = anggota.slice(0, 4)
  const catatan = empat.map((m, i) => ({
    id: `mn_${i}`, memberId: m.id, at: s - i * 1000, by: 'Pelatih',
    text: `RAHASIA ${m.name}`,
  }))
  const sesi = await new Promise((res) => {
    const q = db.transaction(['sessions'], 'readonly').objectStore('sessions').getAll()
    q.onsuccess = () => res(q.result)
  })
  const absen = []
  empat.forEach((m, i) => {
    for (let k = 0; k <= i; k += 1) {
      absen.push({ id: `at_${i}_${k}`, sessionId: sesi[0]?.id ?? 's1', memberId: m.id,
        status: 'hadir', at: s, source: 'manual' })
    }
  })
  // Nilai evaluasi terstruktur (H2) — tidak boleh ikut ke mana pun.
  const evaluasi = empat.map((m, i) => ({
    id: `ev_${i}`, memberId: m.id, tanggal: '2026-09-01',
    nilai: { teknik: 3, musikalitas: 4 }, catatan: '', createdAt: s,
  }))
  await new Promise((res) => {
    const tx = db.transaction(['memberNotes', 'attendance', 'evaluasi'], 'readwrite')
    catatan.forEach((x) => tx.objectStore('memberNotes').put(x))
    absen.forEach((x) => tx.objectStore('attendance').put(x))
    evaluasi.forEach((x) => tx.objectStore('evaluasi').put(x))
    tx.oncomplete = res
  })
  const totalAbsen = await new Promise((res) => {
    const q = db.transaction(['attendance'], 'readonly').objectStore('attendance').count()
    q.onsuccess = () => res(q.result)
  })
  const totalCatatan = await new Promise((res) => {
    const q = db.transaction(['memberNotes'], 'readonly').objectStore('memberNotes').count()
    q.onsuccess = () => res(q.result)
  })
  db.close()
  return { anggota: empat.map((m) => ({ id: m.id, name: m.name, code: m.code })),
           disuntik: absen.length, catatan: catatan.length, totalAbsen, totalCatatan }
})
await wait(500)
await p.reload({ waitUntil: 'networkidle2' })
await wait(2200)
// Data contoh sudah memuat absensinya sendiri, jadi yang diuji bukan angka
// mutlak melainkan KESEDIAAN antara basis data dan berkas yang dibagikan.
cek('data contoh disiapkan', DISEM.anggota.length === 4 && DISEM.disuntik === 10,
  JSON.stringify(DISEM.disuntik))

const klien = await p.target().createCDPSession()
await klien.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: UNDUH })
await p.goto(`${BASE}/#/berbagi`, { waitUntil: 'networkidle2' })
await wait(2000)

const tungguBerkas = async (ekstensi) => {
  let berkas = null
  for (let i = 0; i < 80 && !berkas; i += 1) {
    await wait(250)
    const f = fs.readdirSync(UNDUH).filter((x) => x.endsWith(ekstensi))
    if (f.length) berkas = path.join(UNDUH, f[0])
  }
  return berkas
}

// ============================== 1. BERKAS GRUP ==============================
const tombolGrup = await p.$('[data-testid="unduh-grup"]')
cek('tombol berkas grup ada', tombolGrup != null)
if (tombolGrup) await tombolGrup.click()
const berkasGrup = await tungguBerkas('.json')
cek('berkas grup terunduh', berkasGrup != null)

if (berkasGrup) {
  const g = JSON.parse(fs.readFileSync(berkasGrup, 'utf8'))
  cek('GRUP: nol absensi', (g.attendance ?? []).length === 0, String((g.attendance ?? []).length))
  cek('GRUP: nol catatan evaluasi', (g.memberNotes ?? []).length === 0)
  cek('GRUP: daftar anggota tetap ada', (g.members ?? []).length >= 4)
  cek('GRUP: telepon anggota tidak ikut',
    g.members.every((m) => m.phone === undefined))
  cek('GRUP: catatan pribadi pelatih tidak ikut',
    g.members.every((m) => m.notes === undefined))
  cek('GRUP: token QR dikosongkan', g.members.every((m) => !m.token))
  cek('GRUP: nilai evaluasi H2 tidak ikut', g.evaluasi === undefined)
  cek('GRUP: jadwal tetap ikut', (g.sessions ?? []).length >= 1)
  cek('GRUP: formasi tetap ikut', (g.drills ?? []).length >= 1)
  // Tidak boleh ada satu pun jejak teks rahasia di seluruh berkas.
  const teksGrup = fs.readFileSync(berkasGrup, 'utf8')
  cek('GRUP: tidak ada satu pun teks "RAHASIA"', !/RAHASIA/.test(teksGrup))
}
fs.rmSync(berkasGrup)

// ========================= 2. BERKAS PER ANGGOTA (ZIP) ======================
const tombolPer = await p.$('[data-testid="unduh-per-anggota"]')
cek('tombol per anggota ada', tombolPer != null)
if (tombolPer) await tombolPer.click()
const berkasZip = await tungguBerkas('.zip')
cek('berkas ZIP per anggota terunduh', berkasZip != null)

if (berkasZip) {
  // Buka dengan Python zipfile — kalau strukturnya salah, ini akan error.
  const laporan = execFileSync('python3', ['-c', `
import zipfile, json, sys
z = zipfile.ZipFile(${JSON.stringify(berkasZip)})
rusak = z.testzip()
print('RUSAK' if rusak else 'BAIK')
nama = z.namelist()
print('JUMLAH', len(nama))
for n in nama:
    d = json.loads(z.read(n).decode('utf-8'))
    anggota = {m['id'] for m in d.get('members', [])}
    absen = d.get('attendance', [])
    cat = d.get('memberNotes', [])
    # Siapa pemilik berkas ini? Yang absensi/catatannya paling banyak.
    pemilik = None
    if absen:
        pemilik = absen[0]['memberId']
    elif cat:
        pemilik = cat[0]['memberId']
    asing_absen = [a for a in absen if a['memberId'] != pemilik]
    asing_cat = [c for c in cat if c['memberId'] != pemilik]
    telepon = [m for m in d.get('members', []) if m.get('phone') is not None]
    catatan_pribadi = [m for m in d.get('members', []) if m.get('notes') is not None]
    token = [m for m in d.get('members', []) if m.get('token')]
    print('BERKAS', n, 'pemilik=' + str(pemilik),
          'absen=' + str(len(absen)),
          'asing_absen=' + str(len(asing_absen)),
          'cat=' + str(len(cat)),
          'asing_cat=' + str(len(asing_cat)),
          'telepon=' + str(len(telepon)),
          'catatan_pribadi=' + str(len(catatan_pribadi)),
          'token=' + str(len(token)),
          'evaluasi=' + str('evaluasi' in d))
`]).toString().trim().split('\n')

  cek('ZIP terbuka & lulus uji integritas Python', laporan[0] === 'BAIK', laporan[0])
  const jumlah = Number((laporan.find((b) => b.startsWith('JUMLAH')) ?? 'JUMLAH 0').split(' ')[1])
  cek('ZIP memuat satu berkas per anggota', jumlah >= 4, String(jumlah))

  const baris = laporan.filter((b) => b.startsWith('BERKAS'))
  cek('laporan per berkas ada', baris.length >= 4, String(baris.length))

  let totalAsingAbsen = 0
  let totalAsingCat = 0
  let totalTelepon = 0
  let totalCatatanPribadi = 0
  let totalToken = 0
  let adaEvaluasi = false
  let totalAbsen = 0
  let totalCatatan = 0
  for (const b of baris) {
    const ambil = (k) => Number((b.match(new RegExp(k + '=(\\S+)')) ?? [])[1] ?? -1)
    totalAsingAbsen += ambil('asing_absen')
    totalAsingCat += ambil('asing_cat')
    totalTelepon += ambil('telepon')
    totalCatatanPribadi += ambil('catatan_pribadi')
    totalToken += ambil('token')
    totalAbsen += ambil('absen')
    totalCatatan += ambil('cat')
    if ((b.match(/evaluasi=(\S+)/) ?? [])[1] === 'True') adaEvaluasi = true
  }
  cek('PER ANGGOTA: NOL absensi anggota lain', totalAsingAbsen === 0, String(totalAsingAbsen))
  cek('PER ANGGOTA: NOL catatan anggota lain', totalAsingCat === 0, String(totalAsingCat))
  // Tidak ada yang hilang dan tidak ada yang ganda: jumlah seluruh absensi
  // di semua berkas harus sama persis dengan yang ada di basis data.
  cek('PER ANGGOTA: seluruh absensi tersalur, tanpa ada yang ganda',
    totalAbsen === DISEM.totalAbsen, `${totalAbsen} vs ${DISEM.totalAbsen}`)
  cek('PER ANGGOTA: seluruh catatan tersalur, tanpa ada yang ganda',
    totalCatatan === DISEM.totalCatatan, `${totalCatatan} vs ${DISEM.totalCatatan}`)
  cek('PER ANGGOTA: nol nomor telepon', totalTelepon === 0, String(totalTelepon))
  cek('PER ANGGOTA: nol catatan pribadi pelatih', totalCatatanPribadi === 0,
    String(totalCatatanPribadi))
  cek('PER ANGGOTA: nol token QR', totalToken === 0, String(totalToken))
  cek('PER ANGGOTA: nilai evaluasi H2 tidak pernah ikut', adaEvaluasi === false)

  // Nama berkas harus memuat nama anggotanya, supaya mudah dikirim.
  //
  // 2a — dicocokkan dengan NAMA LENGKAP, bukan nama depan saja. "Anggota
  // pertama" diambil dari IndexedDB, yang urutannya mengikuti `id`
  // berakhiran acak; bila yang terambil Kirana Ayu, kata "kirana" juga cocok
  // dengan Indah Kirana — dua berkas, dan uji ini gagal sekali tiap ±18
  // putaran tanpa ada yang rusak.
  //
  // #7 — nama berkas mengandung spasi
  // (`DrillKit - UNTUK ANGGOTA - Andra Pratama A07.json`), jadi namanya
  // dipotong dari `BERKAS ... pemilik=` (bukan `split(' ')[1]`), dan kedua
  // sisi dinormalisasi yang sama (aksen dibuang, non-alfanumerik dibuang).
  const norm = (x) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '')
  const namaBerkas = baris.map((b) => b.slice('BERKAS '.length, b.indexOf(' pemilik=')))
  const pertama = DISEM.anggota[0]
  const namaDiBerkas = norm(pertama.name)
  const cocok = namaBerkas.filter((n) => norm(n).includes(namaDiBerkas))
  cek('nama berkas memuat nama anggotanya', cocok.length === 1,
    JSON.stringify(namaBerkas.slice(0, 3)))
  cek('nama berkas berakhiran .json', namaBerkas.every((n) => n.endsWith('.json')))
  cek('nama berkas berawalan jelas #7',
    namaBerkas.every((n) => n.startsWith('DrillKit - UNTUK ANGGOTA - ')),
    JSON.stringify(namaBerkas.slice(0, 2)))
}
fs.rmSync(berkasZip)

// ============== 3. SAKLAR CATATAN DIHORMATI (dulu selalu ikut) ==============
{
  const hidup = await p.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /^Catatan evaluasi/.test(x.textContent))
    return b ? !!b.querySelector('.bg-emerald-500') : null
  })
  cek('saklar catatan ada', hidup !== null)
  if (hidup) {
    await p.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) => /^Catatan evaluasi/.test(x.textContent))
      b.click()
    })
    await wait(600)
    const tg = await p.$('[data-testid="unduh-grup"]')
    if (tg) await tg.click()
    const bg = await tungguBerkas('.json')
    if (bg) {
      const g = JSON.parse(fs.readFileSync(bg, 'utf8'))
      cek('saklar catatan mati: grup tanpa catatan', (g.memberNotes ?? []).length === 0)
      fs.rmSync(bg)
    }
  }
}

// ==================== 4. MODE ANGGOTA: menu disaring =======================
{
  await p.evaluate(() => localStorage.setItem('drillkit.mode', 'member'))
  await wait(500)
  await p.reload({ waitUntil: 'networkidle2' })
  await wait(2200)
  const jumlah = await p.evaluate(() =>
    document.querySelectorAll('nav a[href^="#/"]').length)
  cek('mode anggota: menu disaring jadi sedikit', jumlah > 0 && jumlah <= 4, String(jumlah))
  const label = await p.evaluate(() =>
    [...document.querySelectorAll('nav a[href^="#/"]')].map((a) => a.textContent.trim()))
  cek('mode anggota: tidak ada menu pelatih',
    !label.some((l) => /Pengaturan|Impor & ekspor|Evaluasi &|Absensi/.test(l)),
    JSON.stringify(label))
  cek('mode anggota: menu "Tim saya" ada',
    label.some((l) => /Tim saya/.test(l)) || label.some((l) => /Berbagi/.test(l)),
    JSON.stringify(label))
  // Kembalikan ke mode pelatih supaya tidak mengganggu uji lain.
  await p.evaluate(() => localStorage.setItem('drillkit.mode', 'coach'))
}

cek('tidak ada galat di konsol', errors.length === 0, errors.slice(0, 3).join(' | '))

console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) {
  console.log('\nYang gagal:')
  gagal.forEach((g) => console.log('  ✗ ' + g))
}
await browser.close()
fs.rmSync(UNDUH, { recursive: true, force: true })
if (gagal.length) process.exit(1)
