/**
 * v2.8 — Kehadiran berbasis rasio: uji peramban ujung ke ujung.
 *
 * Logika murninya diuji di `kehadiran-rasio-logika.mjs`. Di sini sambungannya:
 *
 *   1. Absensi → chip jam datang: 18.45 beralasan + bukti = telat berjatah,
 *      19.15 = tidak dihitung, kosongkan = tepat waktu.
 *   2. Impor Form (presensi): CSV ditempel → kolom ditebak → pratinjau
 *      (tambah / lewati nama asing) → terapkan → `Session.formPresensi`
 *      terisi, tanda "Form ✓", dan anak hadir tanpa Form ditandai.
 *   3. Impor Form (izin): kategori dari pilihan Form, tautan bukti → izin sah;
 *      "Rapat BEM" → tidak diterima.
 *   4. Syarat pelantikan: N = 8 → hadir 5 · alpa 2 · telat 1, kolom alpa &
 *      telat per anak, hadir tanpa Form dihitung alpa, peringatan tanpa bukti.
 *   5. HP 360 px tanpa gulir mendatar; nol galat konsol.
 *
 * Pakai: npm run build && npx vite preview --port 4173 &
 *        BASE=http://localhost:4173 node qa/kehadiran-rasio-e2e.mjs
 */
import puppeteer from 'puppeteer'
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

const browser = await puppeteer.launch({
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  defaultViewport: { width: 1280, height: 900 },
})
const errors = []
const ABAIKAN = /favicon|Failed to load resource|net::ERR/i

const dua = (n) => String(n).padStart(2, '0')
const kini = new Date()
const tanggal = (n) => new Date(kini.getFullYear(), kini.getMonth(), kini.getDate() + n)
const hari = (n) => {
  const d = tanggal(n)
  return `${d.getFullYear()}-${dua(d.getMonth() + 1)}-${dua(d.getDate())}`
}
/** Cap waktu gaya Google Form Indonesia: d/m/yyyy HH:mm:ss */
const cap = (n, jam) => {
  const d = tanggal(n)
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()} ${jam}:00`
}

/* 8 sesi wajib: 5 sudah lewat, 3 mendatang → N = 8 → hadir 5, alpa 2, telat 1. */
const GESER = [-10, -8, -6, -4, -2, 1, 3, 5]
const SESI = GESER.map((n, i) => ({ id: `s_k${i + 1}`, date: hari(n), title: 'Latsar Rasio' }))
const ANGGOTA = [
  ['k1', 'Kirana Satu', 'brass'],
  ['k2', 'Kevin Dua', 'brass'],
  ['k3', 'Kiki Tiga', 'percussion'],
  ['k4', 'Koko Empat', 'percussion'],
  ['k5', 'Kurnia Lima', 'guard'],
]
/** Empat sesi pertama; H hadir, A alpha, B izin tanpa bukti. */
const POLA = { k1: 'HHHH', k2: 'BBHH', k3: 'HHHH', k4: 'HAHH', k5: 'HHHH' }

try {
  const p = await browser.newPage()
  p.on('console', (m) => {
    if (m.type() === 'error' && !ABAIKAN.test(m.text())) errors.push(m.text())
  })
  p.on('pageerror', (e) => errors.push(String(e)))

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
  const foto = async (nama) => FOTO && p.screenshot({ path: `${FOTO}/${nama}.png`, fullPage: true })
  const data = (sel, kunci) => p.$eval(sel, (e, k) => e.dataset[k], kunci).catch(() => null)
  const lebar = () => p.evaluate(() => document.documentElement.scrollWidth)

  /* ============================== Persiapan ============================== */
  await p.goto(BASE, { waitUntil: 'networkidle2' })
  await lewatSambutan(p)
  await idb(
    (db, a) =>
      new Promise((res, rej) => {
        const tx = db.transaction(['members', 'sessions', 'attendance', 'settings'], 'readwrite')
        for (const [id, name, section] of a.anggota)
          tx.objectStore('members').put({ id, name, code: id.toUpperCase(), section, instrument: '', role: 'member', joinYear: 2026, active: 1, createdAt: 0 })
        for (const s of a.sesi) tx.objectStore('sessions').put({ type: 'latihan', startTime: '18:00', endTime: '20:00', checklist: [], createdAt: 0, ...s })
        let n = 0
        for (const [m, pola] of Object.entries(a.pola))
          [...pola].forEach((c, i) => {
            const s = a.sesi[i]
            const mulai = new Date(`${s.date}T18:00`).getTime()
            const rec = { id: `a_${++n}`, sessionId: s.id, memberId: m, status: { H: 'hadir', A: 'alpha', B: 'izin' }[c] }
            if (c === 'B') rec.dilaporAt = mulai - 5 * 3600000
            tx.objectStore('attendance').put(rec)
          })
        const g = tx.objectStore('settings').get('team')
        g.onsuccess = () => {
          const t = g.result
          t.programLatihan = [
            {
              id: 'prog_rasio', nama: 'Latsar Rasio', mulai: a.sesi[0].date, selesai: a.sesi[7].date, hari: [], jamMulai: '18:00', jamSelesai: '20:00',
              tambahan: a.sesi.map((s) => s.date), libur: [], fase: [], tonggak: [],
              sesiIds: a.sesi.map((s) => s.id), wajibIds: a.sesi.map((s) => s.id),
              peserta: a.anggota.map(([memberId]) => ({ memberId, bergabung: a.sesi[0].date })),
              aturan: { sakitMaksJam: 24 }, dibuat: 1, diubah: 1,
            },
          ]
          tx.objectStore('settings').put(t)
        }
        tx.oncomplete = () => res(true)
        tx.onerror = () => rej(tx.error)
      }),
    { anggota: ANGGOTA, sesi: SESI, pola: POLA },
  )
  await p.goto(`${BASE}/#/absensi`, { waitUntil: 'networkidle2' })
  await p.reload({ waitUntil: 'networkidle2' })
  await wait(800)

  /* ============================== 1. Jam datang ============================== */
  console.log('\n— Absensi: jam datang & jatah telat —')
  await p.waitForSelector('select[data-kiosk-allow]', { timeout: 10000 })
  await p.select('select[data-kiosk-allow]', 's_k5')
  await p.waitForSelector('[data-testid="info-sesi-program"]', { timeout: 5000 }).catch(() => {})
  const banner = await teks('[data-testid="info-sesi-program"]').catch(() => '')
  cek('banner: batas 18.30 & jatah s.d. 19.00', banner.includes('18.30') && banner.includes('19.00'), banner)
  await klik('[data-testid="absen-k1-hadir"]')
  await p.waitForSelector('[data-testid="datang-k1"]', { timeout: 5000 })
  cek('hadir → chip jam datang (belum dicatat)', (await data('[data-testid="datang-k1"]', 'datang')) === '')
  await klik('[data-testid="datang-k1"]')
  await p.waitForSelector('[data-testid="modal-datang"]')
  await isi('[data-testid="datang-jam"]', '18:45')
  await isi('[data-testid="datang-alasan"]', 'kelas pengganti')
  await wait(100)
  cek('pratinjau: telat tanpa bukti → tidak dihitung', (await teks('[data-testid="datang-hasil"]')).includes('tanpa bukti'), await teks('[data-testid="datang-hasil"]'))
  await klik('[data-testid="bukti-ada"]')
  await wait(100)
  cek('pratinjau: + bukti → telat berjatah', (await teks('[data-testid="datang-hasil"]')).startsWith('Telat berjatah'))
  await klik('[data-testid="datang-simpan"]')
  await wait(400)
  cek('chip: 18.45 · jatah telat', (await data('[data-testid="datang-k1"]', 'datang')) === 'jatah' && (await teks('[data-testid="datang-k1"]')).includes('18.45'))
  const r1 = (await semua('attendance')).find((r) => r.sessionId === 's_k5' && r.memberId === 'k1')
  cek('tersimpan: datangAt, alasan, bukti', r1?.datangAt === new Date(`${hari(-2)}T18:45`).getTime() && r1?.alasanTelat === 'kelas pengganti' && r1?.bukti === 'ada')
  await klik('[data-testid="datang-k1"]')
  await p.waitForSelector('[data-testid="modal-datang"]')
  await isi('[data-testid="datang-jam"]', '19:15')
  await klik('[data-testid="datang-simpan"]')
  await wait(400)
  cek('19.15 → lewat batas, tidak dihitung', (await data('[data-testid="datang-k1"]', 'datang')) === 'lewat-batas' && (await teks('[data-testid="datang-k1"]')).includes('tak dihitung'))
  await klik('[data-testid="datang-k1"]')
  await p.waitForSelector('[data-testid="modal-datang"]')
  await klik('[data-testid="datang-hapus"]')
  await klik('[data-testid="datang-simpan"]')
  await wait(400)
  cek('kosongkan jam → dianggap tepat waktu', (await data('[data-testid="datang-k1"]', 'datang')) === '')
  await klik('[data-testid="absen-k3-hadir"]')
  await wait(300)

  /* ============================== 2. Impor Form presensi ============================== */
  console.log('\n— Impor Form: presensi —')
  await klik('[data-testid="buka-impor-gform"]')
  await p.waitForSelector('[data-testid="modal-impor-gform"]', { timeout: 10000 })
  const csvP = `Timestamp,Nama Lengkap,Seksi\n${cap(-3, '15:05')},Kirana Satu,Brass\n${cap(-3, '16:20')},Kevin Dua,Brass\n${cap(-3, '17:00')},Orang Asing,Brass\n`
  await isi('[data-testid="gform-tempel"]', csvP)
  await p.waitForSelector('[data-testid="gform-ringkas"]', { timeout: 5000 })
  cek('kolom ditebak: cap waktu & nama', (await p.$eval('[data-testid="gform-kolom-waktu"]', (e) => e.value)) === '0' && (await p.$eval('[data-testid="gform-kolom-nama"]', (e) => e.value)) === '1')
  cek('pratinjau: 2 tambah, 1 lewati (nama asing)', (await teks('[data-testid="gform-jumlah-tambah"]')) === 'Tambah 2' && (await teks('[data-testid="gform-jumlah-lewati"]')) === 'Lewati 1')
  cek('sesi otomatis dari cap waktu (H-1 15.05 → sesi H 18.00)', (await teks('[data-testid="gform-baris-1"]')).includes(hari(-2)), await teks('[data-testid="gform-baris-1"]'))
  await foto('1-impor-presensi')
  await klik('[data-testid="gform-terapkan"]')
  await p.waitForFunction(() => !document.querySelector('[data-testid="modal-impor-gform"]'), { timeout: 5000 }).catch(() => {})
  await wait(400)
  const s5 = (await semua('sessions')).find((s) => s.id === 's_k5')
  cek('Session.formPresensi: k1 & k2', Object.keys(s5?.formPresensi ?? {}).sort().join() === 'k1,k2', JSON.stringify(s5?.formPresensi))
  const recK2 = (await semua('attendance')).find((r) => r.sessionId === 's_k5' && r.memberId === 'k2')
  cek('isi Form tidak membuat catatan hadir', !recK2)
  cek('tanda "Form ✓" di baris anggota', (await ada('[data-testid="form-k1"]')) && !(await ada('[data-testid="form-k3"]')))
  cek('hadir tanpa Form → chip "tanpa Form"', (await data('[data-testid="datang-k3"]', 'form')) === 'tanpa' && (await data('[data-testid="datang-k1"]', 'form')) === '')

  /* ============================== 3. Impor Form izin ============================== */
  console.log('\n— Impor Form: izin —')
  await klik('[data-testid="buka-impor-gform"]')
  await p.waitForSelector('[data-testid="modal-impor-gform"]', { timeout: 10000 })
  await klik('[data-testid="gform-jenis-izin"]')
  const csvI =
    `Stempel waktu,Nama Lengkap,Tanggal latihan,Kategori izin,Alasan,Upload bukti\n` +
    `${cap(0, '08:00')},Koko Empat,${hari(1)},Praktikum / asistensi,praktikum kimia,https://drive.google.com/open?id=abc\n` +
    `${cap(0, '08:30')},Kurnia Lima,${hari(1)},,Rapat BEM,\n`
  await isi('[data-testid="gform-tempel"]', csvI)
  await p.waitForSelector('[data-testid="gform-ringkas"]', { timeout: 5000 })
  cek('izin: kolom tanggal, kategori, bukti ditebak', (await p.$eval('[data-testid="gform-kolom-tanggal"]', (e) => e.value)) === '2' && (await p.$eval('[data-testid="gform-kolom-kategori"]', (e) => e.value)) === '3' && (await p.$eval('[data-testid="gform-kolom-bukti"]', (e) => e.value)) === '5')
  cek('izin: pratinjau kategori', (await teks('[data-testid="gform-baris-1"]')).includes('Praktikum') && (await teks('[data-testid="gform-baris-2"]')).includes('di luar daftar'))
  await klik('[data-testid="gform-terapkan"]')
  await p.waitForFunction(() => !document.querySelector('[data-testid="modal-impor-gform"]'), { timeout: 5000 }).catch(() => {})
  await wait(400)
  const att = await semua('attendance')
  const i4 = att.find((r) => r.sessionId === 's_k6' && r.memberId === 'k4')
  cek('izin tercatat: jam lapor = cap waktu, kategori, tautan bukti', i4?.status === 'izin' && i4.kategoriIzin === 'kuliah' && i4.bukti?.includes('id=abc') && i4.dilaporAt === new Date(`${hari(0)}T08:00`).getTime())
  await p.select('select[data-kiosk-allow]', 's_k6')
  await p.waitForSelector('[data-testid="lapor-k4"]', { timeout: 5000 })
  cek('chip izin hasil impor: sah', (await data('[data-testid="lapor-k4"]', 'sah')) === 'sah')
  cek('"Rapat BEM" → tidak diterima', (await data('[data-testid="lapor-k5"]', 'sah')) === 'ditolak')

  /* ============================== 4. Syarat pelantikan ============================== */
  console.log('\n— Syarat pelantikan (rasio) —')
  await klik('[data-testid="tab-absensi-pelantikan"]')
  await p.waitForSelector('[data-testid="pemantau-pelantikan"]', { timeout: 10000 })
  await p.waitForSelector('[data-testid="status-k1"]', { timeout: 8000 })
  const atr = await teks('[data-testid="aturan-pelantikan"]')
  cek('aturan: N = 8 → hadir 5 · alpa 2 · telat 1', atr.includes('N = 8 → hadir min. 5, alpa maks. 2, jatah telat 1'), atr)
  cek('aturan: Google Form wajib (1 sesi diimpor)', atr.includes('Google Form wajib (1 sesi diimpor)'))
  cek('k3 hadir tanpa Form → alpa 1/2', (await teks('[data-testid="alpa-k3"]')) === 'alpa 1/2' && (await teks('[data-testid="hadir-k3"]')) === 'hadir 4/5')
  cek('k1: hadir 5/5 → Memenuhi', (await teks('[data-testid="hadir-k1"]')) === 'hadir 5/5' && (await data('[data-testid="peserta-k1"]', 'status')) === 'lulus')
  cek('k2: 2 izin tanpa bukti = alpa 2/2 → Kritis', (await teks('[data-testid="alpa-k2"]')) === 'alpa 2/2' && (await data('[data-testid="peserta-k2"]', 'status')) === 'kritis')
  cek('peringatan izin tanpa bukti (2)', (await teks('[data-testid="peringatan-tanpa-bukti"]').catch(() => '')).startsWith('2 '))
  cek('peringatan sel belum diisi', (await teks('[data-testid="peringatan-kosong"]').catch(() => '')).startsWith('3 '))
  const sel = await p.$eval('[data-testid="peserta-k3"]', (e) => [...e.querySelectorAll('[aria-label="Kehadiran per sesi wajib"] > span')].map((x) => x.textContent).join(','))
  cek('sel k3: H,H,H,H,F! lalu mendatang', sel === 'H,H,H,H,F!,,,', sel)
  await foto('2-pemantau')

  /* ============================== 5. HP 360 px ============================== */
  console.log('\n— HP 360 px —')
  await p.setViewport({ width: 360, height: 780 })
  await wait(400)
  cek('Syarat pelantikan muat 360 px', (await lebar()) <= 360, String(await lebar()))
  await klik('[data-testid="tab-absensi-isi"]')
  await p.select('select[data-kiosk-allow]', 's_k5')
  await wait(400)
  cek('Isi absensi + chip jam datang muat 360 px', (await lebar()) <= 360 && (await ada('[data-testid="datang-k3"]')), String(await lebar()))
  await foto('3-absensi-360')
  await klik('[data-testid="buka-impor-gform"]')
  await p.waitForSelector('[data-testid="modal-impor-gform"]', { timeout: 10000 })
  await isi('[data-testid="gform-tempel"]', csvP)
  await wait(300)
  cek('modal impor muat 360 px', (await lebar()) <= 360, String(await lebar()))
  cek('impor ulang presensi yang sama → "Sama", tidak ada yang ditulis', (await teks('[data-testid="gform-jumlah-sama"]').catch(() => '')) === 'Sama 2' && (await p.$eval('[data-testid="gform-terapkan"]', (e) => e.disabled)))
  await foto('4-impor-360')

  cek('nol galat konsol', errors.length === 0, errors.slice(0, 3).join(' | '))
} catch (e) {
  gagal.push('PENGECUALIAN: ' + (e?.stack ?? e))
  console.log('  ✗ PENGECUALIAN', e)
} finally {
  await browser.close()
}
console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) {
  for (const g of gagal) console.log('  ✗ ' + g)
  process.exit(1)
}
