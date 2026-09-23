/**
 * Uji **Musik & Metronom untuk anggota** — mode hanya-putar.
 *
 * Mengapa ini ada: metronom ikut terkirim di dalam materi, tetapi anggota
 * tidak punya jalan memanggilnya. Mode anggota hanya punya empat tab
 * (jadwal/formasi/absensi/catatan), jadi satu-satunya alat latihan mandiri
 * yang sesungguhnya — ketukan — tidak bisa dipakai oleh orang yang paling
 * membutuhkannya.
 *
 * Yang diuji di sini bukan sekadar "tabnya muncul", melainkan dua hal yang
 * mudah salah:
 *
 *   1. Tab Musik harus bisa dipakai **walau belum memilih nama**. Berlatih
 *      ketukan tidak perlu identitas. Kalau anggota harus memilih namanya
 *      dulu hanya untuk memakai metronom, itu rintangan yang tidak memberi
 *      apa pun.
 *   2. Yang disembunyikan harus **tepat** yang menulis ke basis data.
 *      Repertoar itu milik pelatih: kalau anggota bisa mengurutkan set list
 *      atau menghapus lagu, perubahannya lenyap begitu saja saat mereka
 *      menekan Perbarui — dan mereka tidak akan mengerti mengapa.
 *      Sebaliknya, metronom, pemilihan lagu, dan pemutaran set list harus
 *      tetap utuh; menyembunyikan semuanya akan membuat tab ini sia-sia.
 *
 * Alur:
 *   1. Pelatih punya 2 lagu + 1 set list -> semua alat sunting ADA.
 *   2. Pelatih menerbitkan berkas grup (lagu ikut di dalamnya).
 *   3. Anggota mengambil materi -> tab Musik bisa dipakai TANPA pilih nama.
 *   4. Lagu & set list bisa dipilih dan diputar.
 *   5. Alat sunting TIDAK ada, dan data pelatih tidak berubah sedikit pun.
 */
import puppeteer from 'puppeteer'
import { lewatSambutan } from './sambutan.mjs'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const BASE = process.env.BASE || 'http://localhost:4173'
const DIST = '/home/user/drillkit/dist'
const PAKET = path.join(DIST, 'paket.json')
const UNDUH = path.join(os.tmpdir(), `unduh-musik-${Date.now()}`)
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
const ada = (h, id) => h.evaluate((x) => document.querySelector(`[data-testid="${x}"]`) != null, id)

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

/** Baca lagu & set list langsung dari basis data perangkat ini. */
const bacaRepertoar = (h) => h.evaluate(async () => {
  const db = await new Promise((res) => { const q = indexedDB.open('drillkit'); q.onsuccess = () => res(q.result) })
  const baca = (nama) => new Promise((res) => {
    const q = db.transaction([nama], 'readonly').objectStore(nama).getAll()
    q.onsuccess = () => res(q.result ?? [])
  })
  const lagu = await baca('songs')
  const setlist = await baca('setlists')
  db.close()
  return {
    lagu: lagu.map((s) => s.title).sort(),
    setlist: setlist.map((s) => `${s.name}:${(s.songIds ?? []).join(',')}`).sort(),
  }
})

try {
  /* =============== 1. Pelatih: semua alat sunting harus ADA =============== */
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

  // Dua lagu dan satu set list, ditulis langsung lalu dimuat ulang karena
  // `useLiveQuery` mengabaikan tulisan mentah ke IndexedDB.
  await A.evaluate(async () => {
    const db = await new Promise((res) => { const q = indexedDB.open('drillkit'); q.onsuccess = () => res(q.result) })
    const tx = db.transaction(['songs', 'setlists'], 'readwrite')
    tx.objectStore('songs').put({ id: 'song_uji_a', title: 'Mars Uji A', bpm: 120, beats: 4, tempoMap: [], createdAt: 1, panjangBirama: 16 })
    tx.objectStore('songs').put({ id: 'song_uji_b', title: 'Mars Uji B', bpm: 96, beats: 4, tempoMap: [], createdAt: 2, panjangBirama: 16 })
    tx.objectStore('setlists').put({ id: 'sl_uji', name: 'Show Uji', songIds: ['song_uji_a', 'song_uji_b'], createdAt: 1, updatedAt: 2 })
    await new Promise((res) => { tx.oncomplete = res })
    db.close()
  })
  await A.reload({ waitUntil: 'networkidle2' })
  await wait(3000)

  const punya = await bacaRepertoar(A)
  cek('1: pelatih punya dua lagu uji', punya.lagu.filter((t) => t.startsWith('Mars Uji')).length === 2,
    punya.lagu.join(' | '))

  await A.goto(`${BASE}/#/musik`, { waitUntil: 'networkidle2' })
  await wait(2500)
  {
    const t = await teks(A)
    cek('1: pelatih melihat judul halamannya', /Musik & Metronom/.test(t), t.slice(0, 160))
    cek('1: pelatih BISA menambah lagu', /Tambah lagu/.test(t))
    cek('1: pelatih punya editor pola ritme', await ada(A, 'kartu-pola'))
    cek('1: pelatih bisa tukar repertoar', await ada(A, 'tukar-repertoar'))
    await A.evaluate(() => {
      const sel = document.querySelector('[data-testid="pilih-setlist"]')
      if (sel) { sel.value = 'sl_uji'; sel.dispatchEvent(new Event('change', { bubbles: true })) }
    })
    await wait(1600)
    cek('1: pelatih bisa membuat set list', await ada(A, 'setlist-baru'))
    cek('1: pelatih bisa mengurutkan isi set list', await ada(A, 'setlist-naik-0'))
  }

  /* ================== 2. Pelatih menerbitkan berkas grup ================= */
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
  cek('2: berkas grup terunduh', berkas != null)
  const grup = JSON.parse(fs.readFileSync(berkas, 'utf8'))

  cek('2: lagu ikut di dalam materi', (grup.songs ?? []).filter((s) => s.title.startsWith('Mars Uji')).length === 2,
    String((grup.songs ?? []).length))
  // Syarat yang tidak bisa ditawar: yang diterbitkan HARUS berkas grup.
  cek('2: materi yang diterbitkan NOL absensi', (grup.attendance ?? []).length === 0)
  cek('2: materi yang diterbitkan NOL catatan', (grup.memberNotes ?? []).length === 0)

  fs.writeFileSync(PAKET, JSON.stringify(grup))

  /* ============ 3. Anggota mengambil materi, lalu membuka Musik ========== */
  const B = await perangkatAnggota()
  await (await B.$('[data-testid="ambil-materi"]')).click()
  await wait(3200)

  const punyaB = await bacaRepertoar(B)
  cek('3: lagu pelatih sampai ke perangkat anggota',
    punyaB.lagu.filter((t) => t.startsWith('Mars Uji')).length === 2, punyaB.lagu.join(' | '))
  cek('3: set list pelatih ikut sampai', punyaB.setlist.some((s) => s.startsWith('Show Uji:')),
    punyaB.setlist.join(' | '))

  // Tab Musik harus ada di deretan tab anggota.
  const tabMusik = await B.$('[data-testid="tab-musik"]')
  cek('3: tab Musik ada di deretan tab anggota', tabMusik != null,
    (await teks(B)).slice(0, 200))
  if (tabMusik) await tabMusik.click()
  await wait(2200)
  {
    const t = await teks(B)
    cek('3: anggota punya tab Musik', /Musik & Metronom/.test(t), t.slice(0, 200))
    cek('3: metronomnya bisa dipakai', await ada(B, 'tombol-mulai'))
  }

  /* ================ 4. Metronom benar-benar berdetak ==================== */
  {
    await (await B.$('[data-testid="tombol-mulai"]')).click()
    await wait(600)
    const jalan = await teks(B)
    cek('4: tombolnya berubah jadi Berhenti saat berjalan', /Berhenti/.test(jalan), jalan.slice(0, 200))
    cek('4: birama ditampilkan', await ada(B, 'birama-ke'))
    // Birama harus bertambah dengan sendirinya — kalau tidak, ia hanya
    // mengganti tulisan tombol tanpa benar-benar berdetak.
    const m1 = await B.evaluate(() => document.querySelector('[data-testid="birama-ke"]')?.textContent ?? '')
    await wait(2600)
    const m2 = await B.evaluate(() => document.querySelector('[data-testid="birama-ke"]')?.textContent ?? '')
    cek('4: birama bertambah dengan sendirinya', m1 !== m2, `${m1} -> ${m2}`)
    await (await B.$('[data-testid="tombol-mulai"]')).click()
    await wait(500)
  }

  /* ============ 5. Lagu & set list bisa dipilih dan diputar ============== */
  {
    const dipilih = await B.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((y) => y.textContent.includes('Mars Uji A'))
      if (!b) return false
      b.click()
      return true
    })
    await wait(1500)
    cek('5: anggota bisa memilih lagu', dipilih)
    const t = await teks(B)
    cek('5: lagu yang dipilih tampil di metronom', /Mars Uji A/.test(t), t.slice(0, 220))
    cek('5: panel lagu yang sedang diputar tampil', await ada(B, 'panel-lagu'))
  }
  {
    await B.evaluate(() => {
      const sel = document.querySelector('[data-testid="pilih-setlist"]')
      if (sel) { sel.value = 'sl_uji'; sel.dispatchEvent(new Event('change', { bubbles: true })) }
    })
    await wait(1600)
    const mainkan = await ada(B, 'setlist-mainkan-0')
    cek('5: anggota bisa memutar set list', mainkan)
    if (mainkan) {
      await (await B.$('[data-testid="setlist-mainkan-0"]')).click()
      await wait(1200)
      cek('5: set list benar-benar berbunyi', /Berhenti/.test(await teks(B)))
      await (await B.$('[data-testid="tombol-mulai"]')).click()
      await wait(500)
    }
  }

  /* ============ 6. Yang menulis ke basis data TIDAK boleh ada ============ */
  {
    const t = await teks(B)
    cek('6: anggota TIDAK bisa menambah lagu', !/Tambah lagu/.test(t), t.slice(0, 220))
    cek('6: anggota TIDAK melihat editor pola ritme', !(await ada(B, 'kartu-pola')))
    cek('6: anggota TIDAK melihat tukar repertoar', !(await ada(B, 'tukar-repertoar')))
    cek('6: anggota TIDAK bisa membuat set list', !(await ada(B, 'setlist-baru')))
    cek('6: anggota TIDAK bisa menghapus set list', !(await ada(B, 'setlist-hapus')))
    cek('6: anggota TIDAK bisa mengurutkan set list', !(await ada(B, 'setlist-naik-0')))
    cek('6: anggota TIDAK bisa menambah lagu ke set list', !(await ada(B, 'setlist-tambah')))
    // Penala tetap ada: ia tidak menulis apa pun, dan menala alat justru
    // paling sering dilakukan anggota sendiri.
    cek('6: penala TETAP tersedia untuk anggota', await ada(B, 'kartu-penala'))
  }

  /* ===== 7. Setelah dipakai, repertoar pelatih tidak berubah sedikit pun = */
  {
    const akhir = await bacaRepertoar(B)
    cek('7: lagu tidak berubah setelah dipakai anggota',
      akhir.lagu.join('|') === punyaB.lagu.join('|'), akhir.lagu.join(' | '))
    cek('7: urutan set list tidak berubah setelah dipakai anggota',
      akhir.setlist.join('|') === punyaB.setlist.join('|'), akhir.setlist.join(' | '))
  }

  /* ==== 8. Tab yang lama tidak rusak oleh tab yang baru ditambahkan ===== */
  {
    await (await B.$('[data-testid="tab-jadwal"]')).click()
    await wait(1400)
    const t = await teks(B)
    cek('8: tab Jadwal masih meminta nama dipilih dulu', /Pilih nama di atas/.test(t), t.slice(0, 200))
    // Nama dipilih lewat kolom pencarian, persis seperti pemakai sungguhan.
    const kolom = await B.$('input[placeholder="Ketik nama atau kode…"]')
    cek('8: kolom pencarian nama tersedia', kolom != null)
    if (kolom) {
      await kolom.click({ clickCount: 3 })
      await B.keyboard.down('Control'); await B.keyboard.press('KeyA'); await B.keyboard.up('Control')
      await B.keyboard.type('Andra', { delay: 20 })
      await wait(700)
    }
    await B.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((y) => y.textContent.includes('Andra'))
      if (b) b.click()
    })
    await wait(1800)
    const t2 = await teks(B)
    cek('8: setelah memilih nama, jadwalnya tampil', !/Pilih nama di atas/.test(t2), t2.slice(0, 200))
  }

  /* ===== 9. Bar tab harus muat di HP — cacat ini lahir dari tab ke-5 =====
   *
   * Menambahkan tab Musik membuat bar tab anggota meluber 12px pada layar
   * 360px: tombol terakhir sebagian keluar dari layar. Seluruh rangkaian
   * uji berjalan di lebar 1300px, jadi cacatnya tidak pernah terlihat —
   * padahal mode anggota justru dipakai di HP. Baris ini menjaganya.
   */
  {
    await B.setViewport({ width: 360, height: 740 })
    await wait(900)
    const bar = await B.evaluate(() => {
      const el = document.querySelector('[data-testid="bar-tab-anggota"]')
      if (!el) return null
      const r = el.getBoundingClientRect()
      return {
        lebar: Math.round(r.width),
        isi: el.scrollWidth,
        tombol: document.querySelectorAll('[data-testid^="tab-"]').length,
      }
    })
    cek('9: bar tab anggota ada', bar != null)
    cek('9: kelima tab semuanya ada', bar?.tombol === 5, String(bar?.tombol))
    cek('9: bar tab TIDAK meluber di HP 360px', bar != null && bar.isi <= bar.lebar + 1,
      `isi ${bar?.isi} lawan lebar ${bar?.lebar}`)

    // Tab Musik anggota: dulu meluber 30px. Sumbernya bukan tabnya,
    // melainkan kartu metronom — item grid dengan `min-width: auto` tidak
    // bisa menyusut di bawah <select> yang pilihannya panjang. Hal yang
    // sama membuat halaman Musik PELATIH meluber, jadi keduanya dijaga.
    await B.evaluate((x) => document.querySelector(`[data-testid="tab-${x}"]`)?.click(), 'musik')
    await wait(1800)
    const luap = await B.evaluate(() => ({
      dok: document.documentElement.scrollWidth,
      layar: window.innerWidth,
    }))
    cek('9: tab Musik TIDAK melebarkan halaman di HP 360px', luap.dok <= luap.layar + 1,
      `dok ${luap.dok} lawan layar ${luap.layar}`)
    await B.setViewport({ width: 1300, height: 1000 })
    await wait(700)
  }

  /* ===== 10. Halaman Musik PELATIH juga harus muat di HP 360px ===========
   *
   * Cacat yang sama, bukan cacat yang lahir dari tab anggota: kartu
   * metronom memaksa halaman melebar. Pelatih pun memakai HP di lapangan,
   * jadi ini dijaga di sini agar tidak perlu rangkaian tersendiri.
   */
  {
    await A.setViewport({ width: 360, height: 740 })
    await A.goto(`${BASE}/#/musik`, { waitUntil: 'networkidle2' })
    await wait(2500)
    const l = await A.evaluate(() => ({
      dok: document.documentElement.scrollWidth,
      layar: window.innerWidth,
    }))
    cek('10: halaman Musik pelatih TIDAK melebarkan halaman di HP 360px',
      l.dok <= l.layar + 1, `dok ${l.dok} lawan layar ${l.layar}`)
    await A.setViewport({ width: 1300, height: 1000 })
    await wait(700)
  }

  cek('tidak ada galat di konsol', errors.length === 0, errors.slice(0, 3).join(' | '))
} finally {
  try { fs.unlinkSync(PAKET) } catch { /* tidak apa-apa */ }
  await browser.close()
}

console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) {
  for (const g of gagal) console.log('  ✗ ' + g)
  process.exitCode = 1
}
