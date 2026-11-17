/**
 * v2.13 — Putusan danlat: uji peramban ujung ke ujung.
 *
 * Logika murninya diuji di `putusan-danlat-logika.mjs`. Di sini sambungannya:
 *
 *   1. Absensi → panel "Putusan danlat": 4 butir menunggu (izin sah, telat
 *      berjatah, izin lewat 15.00, sakit lewat 15.30) dengan usul aturan.
 *   2. "Salin pesan untuk danlat" → nomor disimpan; "Tempel balasan danlat"
 *      → pratinjau → putusan tercatat beserta pemutus & jamnya.
 *   3. Riwayat putusan → Batalkan → kembali menunggu; tombol per baris +
 *      catatan; nama pemutus diganti dan diingat.
 *   4. Modal izin & jam datang menampilkan putusan (Diizinkan / pakai jatah)
 *      dan siapa yang memutus; batas sakit 15.30 tampil di banner.
 *   5. Bilah "Form" muncul bila Sheet jawaban sudah dipilih.
 *   6. HP 360 px tanpa gulir mendatar; nol galat konsol.
 *
 * Pakai: npm run build && npx vite preview --port 4173 &
 *        BASE=http://localhost:4173 node qa/putusan-danlat-e2e.mjs
 */
import puppeteer from 'puppeteer'
import { lewatSambutan } from './sambutan.mjs'

const BASE = process.env.BASE || process.argv[2] || 'http://localhost:4173'

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

const browser = await puppeteer.launch({
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  defaultViewport: { width: 1280, height: 900 },
})
const errors = []
const ABAIKAN = /favicon|Failed to load resource|net::ERR|apis\.google|accounts\.google|gsi/i

const dua = (n) => String(n).padStart(2, '0')
const kini = new Date()
const HARI = `${kini.getFullYear()}-${dua(kini.getMonth() + 1)}-${dua(kini.getDate())}`
const jam = (h, m) => new Date(`${HARI}T${dua(h)}:${dua(m)}`).getTime()

const ANGGOTA = [
  ['d1', 'Ayu Lestari', 'brass'],
  ['d2', 'Bima Sakti', 'percussion'],
  ['d3', 'Citra Dewi', 'guard'],
  ['d4', 'Dodi Pratama', 'brass'],
  ['d5', 'Eka Putri', 'brass'],
]

try {
  const p = await browser.newPage()
  await browser.defaultBrowserContext().overridePermissions(BASE, ['clipboard-read', 'clipboard-write', 'clipboard-sanitized-write'])
  p.on('console', (m) => {
    if (m.type() === 'error' && !ABAIKAN.test(m.text())) errors.push(m.text())
  })
  p.on('pageerror', (e) => errors.push(String(e)))

  const ada = async (sel) => (await p.$(sel)) != null
  const teks = (sel) => p.$eval(sel, (e) => (e.textContent ?? '').replace(/\s+/g, ' ').trim())
  const data = (sel, kunci) => p.$eval(sel, (e, k) => e.dataset[k], kunci).catch(() => null)
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
        const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
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
  const catatan = async (m) => (await semua('attendance')).find((r) => r.sessionId === 's_p3' && r.memberId === m)
  const tunggu = (fn, arg) => p.waitForFunction(fn, { timeout: 6000 }, arg).catch(() => {})

  /* ============================== Persiapan ============================== */
  await p.goto(BASE, { waitUntil: 'networkidle2' })
  await lewatSambutan(p)
  await idb(
    (db, a) =>
      new Promise((res, rej) => {
        const tx = db.transaction(['members', 'sessions', 'attendance', 'settings'], 'readwrite')
        tx.objectStore('sessions').clear()
        tx.objectStore('attendance').clear()
        for (const [id, name, section] of a.anggota)
          tx.objectStore('members').put({ id, name, code: id.toUpperCase(), section, instrument: '', role: 'member', joinYear: 2026, active: 1, createdAt: 0 })
        tx.objectStore('sessions').put({ id: 's_p3', type: 'latihan', title: 'P3', date: a.hari, startTime: '17:30', endTime: '20:15', checklist: [], createdAt: 0 })
        const put = (r) => tx.objectStore('attendance').put({ sessionId: 's_p3', ...r })
        put({ id: 'a1', memberId: 'd1', status: 'hadir', datangAt: a.j.d1, alasanTelat: 'kelas pengganti', bukti: 'ada' })
        put({ id: 'a2', memberId: 'd2', status: 'izin', dilaporAt: a.j.d2, kategoriIzin: 'kuliah', bukti: 'https://drive.google.com/open?id=b2', note: 'praktikum' })
        put({ id: 'a3', memberId: 'd3', status: 'izin', dilaporAt: a.j.d3, kategoriIzin: 'kuliah', bukti: 'ada' })
        put({ id: 'a4', memberId: 'd4', status: 'sakit', dilaporAt: a.j.d4, kategoriIzin: 'sakit', bukti: 'ada' })
        put({ id: 'a5', memberId: 'd5', status: 'hadir', datangAt: a.j.d5 })
        const g = tx.objectStore('settings').get('team')
        g.onsuccess = () => {
          const t = g.result
          t.programLatihan = [
            {
              id: 'prog_p', nama: 'Latsar CAB', mulai: a.hari, selesai: a.hari, hari: [], jamMulai: '17:30', jamSelesai: '20:15',
              tambahan: [a.hari], libur: [], fase: [], tonggak: [], sesiIds: ['s_p3'], wajibIds: ['s_p3'],
              peserta: a.anggota.map(([memberId]) => ({ memberId, bergabung: a.hari })),
              aturan: { sakitMaksJam: 24, batasIzin: '15:00', batasSakit: '15:30', praMenit: 30, penutupMenit: 15 }, dibuat: 1, diubah: 1,
            },
          ]
          delete t.pemutusPutusan
          delete t.sumberForm
          tx.objectStore('settings').put(t)
        }
        tx.oncomplete = () => res(true)
        tx.onerror = () => rej(tx.error)
      }),
    { anggota: ANGGOTA, hari: HARI, j: { d1: jam(18, 45), d2: jam(12, 0), d3: jam(16, 0), d4: jam(16, 5), d5: jam(18, 5) } },
  )
  await p.goto(`${BASE}/#/absensi`, { waitUntil: 'networkidle2' })
  await p.reload({ waitUntil: 'networkidle2' })
  await p.waitForSelector('[data-testid="panel-putusan"]', { timeout: 10000 }).catch(() => {})

  /* ============================== 1. Panel ============================== */
  console.log('\n— Panel putusan danlat —')
  cek('panel tampil', await ada('[data-testid="panel-putusan"]'))
  cek('4 menunggu', (await teks('[data-testid="putusan-menunggu"]')) === '4 menunggu', await teks('[data-testid="putusan-menunggu"]').catch(() => ''))
  cek('tautan "4 menunggu putusan" di kartu sesi', (await teks('[data-testid="lompat-putusan"]').catch(() => '')) === '4 menunggu putusan')
  const urut = await p.$$eval('[data-testid="putusan-daftar"] > li', (l) => l.map((x) => x.dataset.testid.replace('putusan-', '')))
  cek('urutan: sesuai aturan dulu (izin, telat), lalu izin & sakit lewat batas', urut.join() === 'd2,d1,d3,d4', urut.join())
  cek('usul aturan', (await data('[data-testid="putusan-d2"]', 'usul')) === 'terima' && (await data('[data-testid="putusan-d4"]', 'usul')) === 'tolak')
  cek('hadir tepat waktu tidak masuk daftar', !(await ada('[data-testid="putusan-d5"]')))
  cek('keterangan sakit menyebut 15.30', (await teks('[data-testid="putusan-d4"]')).includes('lewat 15.30'), await teks('[data-testid="putusan-d4"]'))
  cek('tombol izin = Diizinkan, sakit/telat = Disahkan', (await teks('[data-testid="putusan-terima-d2"]')) === 'Diizinkan' && (await teks('[data-testid="putusan-terima-d1"]')) === 'Disahkan')
  cek('tautan bukti tampil', await p.$eval('[data-testid="putusan-d2"] a', (a) => a.href.includes('id=b2')).catch(() => false))
  const banner = await teks('[data-testid="info-sesi-program"]').catch(() => '')
  cek('banner: sakit ≤ 15.30', banner.includes('sakit ≤ 15.30'), banner)

  /* ============================== 2. WA & balasan ============================== */
  console.log('\n— Pesan WA & balasan danlat —')
  await klik('[data-testid="putusan-salin-wa"]')
  await wait(300)
  const wa = await p.evaluate(() => navigator.clipboard.readText()).catch(() => '')
  cek('pesan tersalin dengan judul & aturan', wa.includes('*Putusan izin & telat — P3') && wa.includes('izin ≤ 15.00 · sakit ≤ 15.30 · bukti wajib'), wa.slice(0, 120))
  cek('pesan bernomor sesuai daftar', /1\. Bima Sakti \([^)]*\) — Izin/.test(wa) && /4\. Dodi Pratama \([^)]*\) — Sakit/.test(wa), wa)
  const nomor = await p.evaluate(() => JSON.parse(localStorage.getItem('drillkit-putusan-wa-s_p3') ?? '[]'))
  cek('nomor pesan diingat', nomor.join() === 'a2,a1,a3,a4', nomor.join())
  await klik('[data-testid="putusan-tempel"]')
  await p.waitForSelector('[data-testid="modal-balasan-danlat"]')
  await isi('[data-testid="balasan-teks"]', '1-2 terima, 3 tolak, 4 terima')
  await p.waitForSelector('[data-testid="balasan-pratinjau"]')
  const pra = await teks('[data-testid="balasan-pratinjau"]')
  cek('pratinjau balasan', pra.includes('Bima Sakti (Izin) → Diizinkan') && pra.includes('Ayu Lestari (Telat) → Disahkan · pakai jatah') && pra.includes('Citra Dewi (Izin) → Ditolak'), pra)
  await klik('[data-testid="balasan-terapkan"]')
  await tunggu(() => !document.querySelector('[data-testid="putusan-daftar"]'))
  const [r1, r2, r3, r4] = await Promise.all(['d1', 'd2', 'd3', 'd4'].map(catatan))
  cek('tercatat: izin sah, telat jatah, izin ditolak, sakit sah', r2?.putusanIzin === 'sah' && r1?.putusanIzin === 'jatah' && r3?.putusanIzin === 'tidak-sah' && r4?.putusanIzin === 'sah')
  cek('pemutus & jam tercatat', r2?.putusanOleh === 'Danlat' && Math.abs((r2?.putusanAt ?? 0) - Date.now()) < 60_000)
  cek('panel: semua sudah diputus', (await teks('[data-testid="putusan-menunggu"]')) === 'semua sudah diputus')
  cek('chip izin Citra kini tidak sah', (await data('[data-testid="lapor-d3"]', 'sah')) === 'ditolak')
  cek('chip izin Dodi (sakit telat) kini sah', (await data('[data-testid="lapor-d4"]', 'sah')) === 'sah')
  cek('chip telat Ayu: jatah · putusan', (await teks('[data-testid="datang-d1"]')).includes('putusan'), await teks('[data-testid="datang-d1"]'))

  /* ============================== 3. Riwayat, batal, per baris ============================== */
  console.log('\n— Riwayat & putusan per baris —')
  await klik('[data-testid="putusan-riwayat-buka"]')
  await p.waitForSelector('[data-testid="putusan-riwayat"]')
  cek('riwayat memuat 4 putusan dengan pemutus', (await p.$$('[data-testid="putusan-riwayat"] li')).length === 4 && (await teks('[data-testid="putusan-riwayat"]')).includes('Danlat'))
  await klik('[data-testid="putusan-batal-d3"]')
  await tunggu(() => document.querySelector('[data-testid="putusan-menunggu"]')?.textContent === '1 menunggu')
  cek('batalkan → kembali menunggu', (await teks('[data-testid="putusan-menunggu"]')) === '1 menunggu')
  const r3b = await catatan('d3')
  cek('putusan & pemutus terhapus', r3b?.putusanIzin === undefined && r3b?.putusanOleh === undefined)
  await isi('[data-testid="putusan-pemutus"]', 'Kak Eri')
  await p.$eval('[data-testid="putusan-pemutus"]', (e) => e.blur())
  await p.click('[data-testid="putusan-d3"] button')
  await isi('[data-testid="putusan-catatan-d3"]', 'bukti menyusul besok')
  await klik('[data-testid="putusan-terima-d3"]')
  await tunggu(() => document.querySelector('[data-testid="putusan-menunggu"]')?.textContent === 'semua sudah diputus')
  const r3c = await catatan('d3')
  cek('putusan per baris dengan catatan & pemutus baru', r3c?.putusanIzin === 'sah' && r3c?.putusanOleh === 'Kak Eri' && r3c?.putusanCatatan === 'bukti menyusul besok', JSON.stringify(r3c))
  const tim = (await semua('settings')).find((s) => s.key === 'team')
  cek('nama pemutus diingat', tim?.pemutusPutusan === 'Kak Eri')

  /* ============================== 4. Modal ============================== */
  console.log('\n— Modal izin & jam datang —')
  await klik('[data-testid="lapor-d3"]')
  await p.waitForSelector('[data-testid="modal-lapor-izin"]')
  // Isian modal diisi oleh efek React sesudah modal tampil — tunggu kondisinya, bukan jeda tetap.
  await tunggu(() => document.querySelector('[data-testid="lapor-putusan"]')?.value === 'sah' && !!document.querySelector('[data-testid="meta-putusan"]'))
  cek('modal izin: putusan Diizinkan', (await p.$eval('[data-testid="lapor-putusan"]', (e) => e.selectedOptions[0].textContent)).startsWith('Diizinkan'))
  cek('modal izin: siapa & catatan', (await teks('[data-testid="meta-putusan"]')).includes('Kak Eri') && (await teks('[data-testid="meta-putusan"]')).includes('bukti menyusul'))
  await p.keyboard.press('Escape')
  await wait(300)
  if (await ada('[data-testid="modal-lapor-izin"]')) await p.click('[data-testid="modal-lapor-izin"] button')
  await tunggu(() => !document.querySelector('[data-testid="modal-lapor-izin"]'))
  await klik('[data-testid="lapor-d4"]')
  await p.waitForSelector('[data-testid="modal-lapor-izin"]')
  await tunggu(() => (document.querySelector('[data-testid="modal-lapor-izin"]')?.textContent ?? '').includes('paling lambat 15.30'))
  cek('modal sakit: batas 15.30 disebut', (await teks('[data-testid="modal-lapor-izin"]')).includes('paling lambat 15.30'))
  await p.keyboard.press('Escape')
  await wait(300)
  await tunggu(() => !document.querySelector('[data-testid="modal-lapor-izin"]'))
  await klik('[data-testid="datang-d1"]')
  await p.waitForSelector('[data-testid="modal-datang"]')
  await tunggu(() => document.querySelector('[data-testid="datang-putusan"]')?.value === 'jatah')
  cek('modal jam datang: putusan pakai jatah', (await p.$eval('[data-testid="datang-putusan"]', (e) => e.value)) === 'jatah')
  cek('modal jam datang: hasil menyebut disahkan danlat', (await teks('[data-testid="datang-hasil"]')).includes('disahkan danlat'))
  await p.select('[data-testid="datang-putusan"]', 'tidak-sah')
  await klik('[data-testid="datang-simpan"]')
  await tunggu(() => !document.querySelector('[data-testid="modal-datang"]'))
  let r1b = await catatan('d1')
  for (let i = 0; i < 30 && r1b?.putusanIzin !== 'tidak-sah'; i++) {
    await wait(200)
    r1b = await catatan('d1')
  }
  cek('ubah putusan di modal → pemutus & jam diperbarui', r1b?.putusanIzin === 'tidak-sah' && r1b?.putusanOleh === 'Kak Eri')

  /* ============================== 5. Bilah Form ============================== */
  console.log('\n— Bilah tarik Form —')
  cek('tanpa Sheet terpilih → bilah tidak tampil', !(await ada('[data-testid="tarik-otomatis"]')))
  await idb(
    (db) =>
      new Promise((res) => {
        const tx = db.transaction('settings', 'readwrite')
        const g = tx.objectStore('settings').get('team')
        g.onsuccess = () => {
          const t = g.result
          t.google = { clientId: '123-abc.apps.googleusercontent.com', apiKey: 'AIzaUji', appId: '123' }
          t.sumberForm = { presensi: { id: 'sheet1', nama: 'Kehadiran CAB 42 (Jawaban)' }, izin: { id: 'sheet1', nama: 'Kehadiran CAB 42 (Jawaban)' } }
          tx.objectStore('settings').put(t)
        }
        tx.oncomplete = () => res(true)
      }),
  )
  await p.reload({ waitUntil: 'networkidle2' })
  await p.waitForSelector('[data-testid="tarik-otomatis"]', { timeout: 8000 }).catch(() => {})
  const bilah = await teks('[data-testid="tarik-otomatis"]').catch(() => '')
  cek('bilah Form tampil sekali per Sheet', bilah.includes('Kehadiran CAB 42 (Jawaban)') && bilah.split('Kehadiran CAB 42').length === 2, bilah)
  cek('izin Google belum ada → minta ketuk Tarik sekarang', bilah.includes('ketuk Tarik sekarang') && (await ada('[data-testid="tarik-sekarang"]')), bilah)
  await klik('[data-testid="tarik-otomatis-saklar"]')
  await wait(300)
  const tim2 = (await semua('settings')).find((s) => s.key === 'team')
  cek('saklar otomatis tersimpan', tim2?.tarikOtomatis === false)

  /* ============================== 6. HP ============================== */
  console.log('\n— HP 360 px —')
  await p.setViewport({ width: 360, height: 780 })
  await wait(400)
  const lebar = await p.evaluate(() => document.documentElement.scrollWidth)
  cek('tanpa gulir mendatar di 360 px', lebar <= 362, String(lebar))
  cek('nol galat konsol', errors.length === 0, errors.join(' | '))
} catch (e) {
  gagal.push(String(e?.stack ?? e))
  console.log('  ✗ ' + e)
} finally {
  await browser.close()
}

console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) process.exit(1)
