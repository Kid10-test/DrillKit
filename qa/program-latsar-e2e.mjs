/**
 * #36 — Program Latsar, izin/sakit bercap jam, & Pemantau Syarat
 * Pelantikan: uji peramban ujung ke ujung.
 *
 * Logika murninya diuji di `program-latsar-logika.mjs`. Di sini sambungannya:
 *
 *   1. Jadwal → Program: susun program CAB 42 lewat formulir (Sel/Kam/Jum
 *      18.00–20.00 mulai Kamis 12 Nov, tambahan Minggu 29 Nov, Hakrab,
 *      Pelantikan 5–6 Des, Camp tanpa tanggal, batas gabung 24 Nov), usulkan
 *      3 fase (pola Latsar A/B/C ditambahkan ke pustaka), pratinjau 18 sesi
 *      latihan & 12 wajib, terapkan → sesi tertulis, program tersimpan.
 *   2. Program kedua bertanggal relatif (sebagian sesi sudah lewat) ditulis
 *      langsung ke IndexedDB untuk menguji status: lulus / berjalan / kritis /
 *      susulan (kurang hadir & bergabung terlambat), dan peringatan izin tanpa
 *      jam lapor. Kartu sesi di Jadwal menampilkan chip program.
 *   3. Absensi: banner sesi program, izin bercap otomatis (v2.8: sah sebelum
 *      jam mulai + kategori + bukti), ubah jam lapor → tidak sah, putusan
 *      pelatih, sakit ≤ 24 jam. Syarat v2.8 berbasis rasio (7/12 · 1/4 · 1/6).
 *   4. Tab Syarat pelantikan: ringkasan, saring status, daftar susulan, kelola
 *      peserta (saring tahun masuk, pilih yang tampil), cetak A4.
 *   5. HP 360 px tanpa gulir mendatar; nol galat konsol.
 *
 * Pakai: npm run build && npx vite preview --port 4173 &
 *        BASE=http://localhost:4173 node qa/program-latsar-e2e.mjs
 */
import puppeteer from 'puppeteer'
import { lewatSambutan } from './sambutan.mjs'

const BASE = process.env.BASE || process.argv[2] || 'http://localhost:4173'
const FOTO = process.env.FOTO || '' // folder tangkapan layar (opsional)

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

function isoLokal(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const kini = new Date()
const hari = (n) => isoLokal(new Date(kini.getFullYear(), kini.getMonth(), kini.getDate() + n))

/* Program uji bertanggal relatif: 10 sesi wajib sudah lewat, 2 mendatang. */
const GESER = [-30, -27, -24, -21, -18, -15, -12, -9, -6, -3, 3, 6]
const SESI_UJI = GESER.map((n, i) => ({ id: `s_w${i + 1}`, date: hari(n), title: 'Latsar Uji' }))
const LEWAT = SESI_UJI.slice(0, 10).map((s) => s.id)
const ANGGOTA = [
  ['mA', 'Ari Berjalan', 'brass', 2026],
  ['mB', 'Bima Kritis', 'brass', 2026],
  ['mC', 'Caca Kurang', 'percussion', 2026],
  ['mD', 'Dodi Lulus', 'percussion', 2026],
  ['mE', 'Eka Telat', 'guard', 2026],
  ['mF', 'Fani Izin', 'guard', 2026],
  ['mG', 'Gita Senior', 'brass', 2025],
]
/** status per sesi lewat (10) untuk tiap anggota; '-' = kosong. */
const POLA = {
  // v2.8 rasio: N = 12 → hadir ≥ 7, alpa ≤ 3, jatah telat 2.
  mA: 'HHHHHHAAII', // hadir 6 + sisa 2, alpa 2 → berjalan (boleh tidak hadir 1×, alpa maks 1×)
  mB: 'HHHHHIIIAA', // hadir 5 + sisa 2 = 7 = butuh → kritis
  mC: 'HHHAAAAAAA', // alpa 7 > 3 → susulan
  mD: 'HHHHHHHHHI', // hadir 9 ≥ 7 → lulus
  mE: '----------', // bergabung sesudah batas → susulan
  mF: 'HHHHHHHHHN', // izin tanpa jam lapor → peringatan; hadir 9 → tetap lulus
}

try {
  const p = await browser.newPage()
  p.on('console', (m) => {
    if (m.type() === 'error' && !ABAIKAN.test(m.text())) errors.push(m.text())
  })
  p.on('pageerror', (e) => errors.push(String(e)))
  await p.evaluateOnNewDocument(() => {
    window.__cetak = []
    window.open = () => ({
      document: { write: (h) => window.__cetak.push(h), close() {} },
      focus() {},
      setTimeout() {},
      print() {},
    })
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
  const tim = async () => (await semua('settings')).find((x) => x.key === 'team') ?? {}
  const foto = async (nama) => FOTO && p.screenshot({ path: `${FOTO}/${nama}.png`, fullPage: true })
  const sah = (id) => p.$eval(`[data-testid="lapor-${id}"]`, (e) => e.dataset.sah).catch(() => null)

  /* ============================== Persiapan ============================== */
  await p.goto(BASE, { waitUntil: 'networkidle2' })
  await lewatSambutan(p)
  await idb(
    (db, anggota) =>
      new Promise((res, rej) => {
        const tx = db.transaction(['members'], 'readwrite')
        for (const [id, name, section, joinYear] of anggota)
          tx.objectStore('members').put({ id, name, code: id.toUpperCase(), section, instrument: '', role: 'member', joinYear, active: 1, createdAt: 0 })
        tx.oncomplete = () => res(true)
        tx.onerror = () => rej(tx.error)
      }),
    ANGGOTA,
  )
  await p.goto(`${BASE}/#/jadwal`, { waitUntil: 'networkidle2' })
  await p.reload({ waitUntil: 'networkidle2' })
  await wait(800)

  /* ============================== 1. Program CAB 42 ============================== */
  console.log('\n— Program Latsar (Jadwal) —')
  await klik('[data-testid="buka-program"]')
  await p.waitForSelector('[data-testid="modal-program"]')
  cek('modal program: kosong di awal', await ada('[data-testid="program-kosong"]'))
  await klik('[data-testid="program-baru"]')
  await isi('[data-testid="prog-nama"]', 'Latsar CAB 42')
  await isi('[data-testid="prog-mulai"]', '2026-11-12')
  await isi('[data-testid="prog-selesai"]', '2026-12-18')
  const hariNyala = await p.$$eval('[data-testid^="prog-hari-"]', (xs) => xs.filter((x) => x.getAttribute('aria-pressed') === 'true').map((x) => x.dataset.testid))
  cek('hari bawaan Selasa/Kamis/Jumat', hariNyala.join() === 'prog-hari-1,prog-hari-3,prog-hari-4', hariNyala.join())
  await isi('[data-testid="prog-tambahan-isi"]', '2026-11-29')
  await klik('[data-testid="prog-tambahan-tambah"]')
  cek('tanggal tambahan 29 Nov tercatat', await ada('[data-testid="prog-tambahan-2026-11-29"]'))

  const tonggak = [
    ['Hakrab', 'acara', '2026-11-22', '', '08:00', '16:00'],
    ['Pelantikan', 'pelantikan', '2026-12-05', '2026-12-06', '07:00', '17:00'],
    ['Camp', 'camp', '', '', '', ''],
  ]
  for (const [i, [nama, jenis, dari, sampai, jm, js]] of tonggak.entries()) {
    await klik('[data-testid="tambah-tonggak"]')
    await isi(`[data-testid="tonggak-nama-${i}"]`, nama)
    await p.select(`[data-testid="tonggak-jenis-${i}"]`, jenis)
    if (dari) await isi(`[data-testid="tonggak-dari-${i}"]`, dari)
    if (sampai) await isi(`[data-testid="tonggak-sampai-${i}"]`, sampai)
    if (jm) await isi(`[data-testid="tonggak-jam-mulai-${i}"]`, jm)
    if (js) await isi(`[data-testid="tonggak-jam-selesai-${i}"]`, js)
  }
  await isi('[data-testid="aturan-batas"]', '2026-11-24')
  cek('editor aturan: rasio bawaan 7/12 · 1/4 · 1/6', (await p.$eval('[data-testid="aturan-rasio-hadir-a"]', (e) => e.value)) === '7' && (await p.$eval('[data-testid="aturan-rasio-hadir-b"]', (e) => e.value)) === '12')
  await klik('[data-testid="usul-fase"]')
  await p.waitForSelector('[data-testid="fase-2"]', { timeout: 8000 }).catch(() => {})
  const fase = await p.$$eval('[data-testid^="fase-nama-"]', (xs) => xs.map((x) => x.value))
  cek('usulan 3 fase', fase.length === 3, fase.join(' | '))
  const polaPustaka = (await tim()).polaSesi ?? []
  cek('pola Latsar A/B/C ditambahkan ke pustaka', polaPustaka.length === 3 && polaPustaka.every((x) => /Latsar [ABC]/.test(x.nama)))
  await p.waitForSelector('[data-testid="daftar-rencana-program"]', { timeout: 8000 })
  const rencana = await p.$$eval('[data-testid^="rencana-"]', (xs) => xs.map((x) => x.dataset.testid))
  const latihan = rencana.filter((t) => /^rencana-\d{4}-\d\d-\d\d$/.test(t))
  cek('pratinjau: 18 sesi latihan', latihan.length === 18, String(latihan.length))
  cek('pratinjau: 12 sesi wajib', (await teks('[data-testid="program-jumlah-wajib"]')) === '12')
  const nAturan = [await teks('[data-testid="aturan-n-hadir"]'), await teks('[data-testid="aturan-n-alpa"]'), await teks('[data-testid="aturan-n-telat"]')].join('/')
  cek('editor aturan: N = 12 → hadir 7 · alpa 3 · telat 2', nAturan === '7/3/2', nAturan)
  await isi('[data-testid="aturan-rasio-hadir-a"]', '8')
  await wait(150)
  cek('editor aturan: rasio 8/12 → hadir 8', (await teks('[data-testid="aturan-n-hadir"]')) === '8')
  await isi('[data-testid="aturan-rasio-hadir-a"]', '7')
  cek('Kamis 12 Nov sesi pertama, Selasa 10 Nov tidak ada', latihan[0] === 'rencana-2026-11-12' && !latihan.includes('rencana-2026-11-10'))
  cek('Hakrab & pelantikan ikut dijadwalkan sebagai tonggak', rencana.some((t) => t.startsWith('rencana-2026-11-22-')) && rencana.some((t) => t.startsWith('rencana-2026-12-05-')))
  const wajibHakrab = await p.$$eval('[data-testid^="wajib-2026-11-22"]', (xs) => xs.map((x) => x.checked ?? x.getAttribute('aria-pressed')))
  cek('Hakrab tidak dihitung wajib', wajibHakrab.every((v) => v === false || v === 'false' || v == null), JSON.stringify(wajibHakrab))
  await foto('1-modal-program')
  await klik('[data-testid="program-terapkan"]')
  await wait(800)
  const t1 = await tim()
  const cab = (t1.programLatihan ?? []).find((x) => x.nama === 'Latsar CAB 42')
  cek('program tersimpan', !!cab)
  cek('program: 12 sesi wajib, batas gabung 24 Nov', cab?.wajibIds.length === 12 && cab?.aturan.batasGabung === '2026-11-24')
  cek('program: aturan rasio lengkap tersimpan (tanpa persenMin)', cab?.aturan.rasioHadir?.join('/') === '7/12' && cab?.aturan.kategoriIzin?.length === 7 && !('persenMin' in (cab?.aturan ?? {})))
  const sesiDb = await semua('sessions')
  const sesiCab = sesiDb.filter((s) => cab?.sesiIds.includes(s.id))
  cek('sesi latihan tertulis 18:00–20:00', sesiCab.filter((s) => s.type === 'latihan').length === 18 && sesiCab.filter((s) => s.type === 'latihan').every((s) => s.startTime === '18:00' && s.endTime === '20:00'))
  cek('sesi latihan berisi rencana dari pola fase', sesiCab.filter((s) => s.type === 'latihan').every((s) => (s.rencanaLatihan ?? []).length > 0))
  const wajibTerakhir = sesiDb.filter((s) => cab?.wajibIds.includes(s.id)).map((s) => s.date).sort()
  cek('wajib = 12 Nov … 4 Des (sebelum pelantikan)', wajibTerakhir[0] === '2026-11-12' && wajibTerakhir[11] === '2026-12-04', wajibTerakhir.join(','))
  await p.keyboard.press('Escape')
  await wait(300)

  /* ============================== 2. Program uji bertanggal relatif ============================== */
  console.log('\n— Program uji (IndexedDB) —')
  await idb(
    (db, a) =>
      new Promise((res, rej) => {
        const tx = db.transaction(['sessions', 'attendance', 'settings'], 'readwrite')
        for (const s of a.sesi)
          tx.objectStore('sessions').put({ type: 'latihan', startTime: '18:00', endTime: '20:00', checklist: [], createdAt: 0, ...s })
        let n = 0
        for (const [m, pola] of Object.entries(a.pola))
          [...pola].forEach((c, i) => {
            if (c === '-') return
            const s = a.sesi[i]
            const mulai = new Date(`${s.date}T18:00`).getTime()
            const rec = { id: `a_${++n}`, sessionId: s.id, memberId: m, status: { H: 'hadir', A: 'alpha', I: 'izin', N: 'izin' }[c] }
            if (c === 'I') Object.assign(rec, { dilaporAt: mulai - 3 * 3600000, bukti: 'ada', kategoriIzin: 'kuliah' })
            tx.objectStore('attendance').put(rec)
          })
        const g = tx.objectStore('settings').get('team')
        g.onsuccess = () => {
          const t = g.result
          t.programLatihan = [
            ...(t.programLatihan ?? []),
            {
              id: 'prog_uji', nama: 'Latsar Uji', mulai: a.sesi[0].date, selesai: a.sesi[11].date, hari: [], jamMulai: '18:00', jamSelesai: '20:00',
              tambahan: a.sesi.map((s) => s.date), libur: [], fase: [], tonggak: [{ id: 'tc', nama: 'Camp', jenis: 'camp' }],
              sesiIds: a.sesi.map((s) => s.id), wajibIds: a.sesi.map((s) => s.id),
              peserta: a.peserta, aturan: { persenMin: 70, hadirMin: 7, sakitMaksJam: 24, batasGabung: a.batas }, dibuat: 1, diubah: 1,
            },
          ]
          tx.objectStore('settings').put(t)
        }
        tx.oncomplete = () => res(true)
        tx.onerror = () => rej(tx.error)
      }),
    {
      sesi: SESI_UJI,
      pola: POLA,
      batas: hari(-20),
      peserta: ['mA', 'mB', 'mC', 'mD', 'mF'].map((memberId) => ({ memberId, bergabung: hari(-30) })).concat([{ memberId: 'mE', bergabung: hari(-10) }]),
    },
  )
  await p.reload({ waitUntil: 'networkidle2' })
  await wait(800)
  await klik('[data-testid="tampilan-agenda"]').catch(() => {})
  // Sesi terdekat tampil sebagai kartu besar; sisanya baris yang dibuka dulu.
  await p.waitForSelector('[data-testid="kartu-s_w11"], [data-testid="baris-s_w11"]', { timeout: 8000 }).catch(() => {})
  if (!(await ada('[data-testid="kartu-s_w11"]'))) await p.$eval('[data-testid="baris-s_w11"]', (e) => e.click()).catch(() => {})
  await p.waitForSelector('[data-testid="program-s_w11"]', { timeout: 5000 }).catch(() => {})
  const chip = (await ada('[data-testid="program-s_w11"]')) ? await teks('[data-testid="program-s_w11"]') : ''
  cek('kartu sesi: chip program "wajib 11/12"', chip.includes('11/12'), chip)

  /* ============================== 3. Absensi: izin bercap ============================== */
  console.log('\n— Absensi: izin & sakit —')
  await p.goto(`${BASE}/#/absensi`, { waitUntil: 'networkidle2' })
  await p.waitForSelector('[data-testid="tab-absensi-pelantikan"]', { timeout: 8000 }).catch(() => {})
  cek('tab Syarat pelantikan muncul bila ada program', await ada('[data-testid="tab-absensi-pelantikan"]'))
  await p.select('select[data-kiosk-allow]', 's_w11')
  await p.waitForSelector('[data-testid="info-sesi-program"]', { timeout: 5000 }).catch(() => {})
  const banner = (await ada('[data-testid="info-sesi-program"]')) ? await teks('[data-testid="info-sesi-program"]') : ''
  cek('banner: program & urutan wajib', banner.includes('Latsar Uji') && banner.includes('sesi wajib 11/12'), banner)
  await klik('[data-testid="absen-mA-izin"]')
  await p.waitForSelector('[data-testid="lapor-mA"]', { timeout: 5000 })
  cek('izin sebelum jam mulai tanpa bukti → bukti?', (await sah('mA')) === 'tanpa-bukti')
  await klik('[data-testid="lapor-mA"]')
  await p.waitForSelector('[data-testid="modal-lapor-izin"]')
  await p.select('[data-testid="lapor-kategori"]', 'kuliah')
  await klik('[data-testid="bukti-ada"]')
  await wait(150)
  cek('modal lapor: kategori + bukti → pratinjau sah', (await teks('[data-testid="lapor-hasil"]')).startsWith('Sah'))
  await klik('[data-testid="lapor-simpan"]')
  await wait(400)
  cek('izin sebelum jam mulai + bukti → sah', (await sah('mA')) === 'sah')
  const recA = (await semua('attendance')).find((r) => r.sessionId === 's_w11' && r.memberId === 'mA')
  cek('kategori & bukti tersimpan', recA?.kategoriIzin === 'kuliah' && recA?.bukti === 'ada')
  await klik('[data-testid="lapor-mA"]')
  await p.waitForSelector('[data-testid="modal-lapor-izin"]')
  await isi('[data-testid="lapor-waktu"]', `${hari(3)}T19:00`)
  await wait(150)
  const hasil = await teks('[data-testid="lapor-hasil"]')
  cek('modal lapor: pratinjau "tidak sah" saat jam lapor sesudah mulai', /tidak sah|telat|terlambat/i.test(hasil), hasil)
  await klik('[data-testid="lapor-simpan"]')
  await wait(400)
  cek('izin sesudah jam mulai → tidak sah', (await sah('mA')) === 'telat')
  await klik('[data-testid="lapor-mA"]')
  await p.waitForSelector('[data-testid="modal-lapor-izin"]')
  await p.select('[data-testid="lapor-putusan"]', 'sah')
  await klik('[data-testid="lapor-simpan"]')
  await wait(400)
  cek('putusan pelatih menjadikan sah', (await sah('mA')) === 'sah')
  await klik('[data-testid="absen-mB-sakit"]')
  await p.waitForSelector('[data-testid="lapor-mB"]')
  await klik('[data-testid="lapor-mB"]')
  await p.waitForSelector('[data-testid="modal-lapor-izin"]')
  await isi('[data-testid="lapor-waktu"]', `${hari(3)}T21:30`)
  await isi('[data-testid="bukti-tautan"]', 'https://drive.google.com/open?id=surat')
  await klik('[data-testid="lapor-simpan"]')
  await wait(400)
  cek('sakit dilaporkan 3½ jam sesudahnya → sah', (await sah('mB')) === 'sah')
  await klik('[data-testid="absen-mB-hadir"]')
  await wait(300)
  cek('ganti ke hadir → chip lapor hilang', !(await ada('[data-testid="lapor-mB"]')))
  const recB = (await semua('attendance')).find((r) => r.sessionId === 's_w11' && r.memberId === 'mB')
  cek('cap jam lapor, kategori & bukti dilepas saat status bukan izin/sakit', recB && recB.status === 'hadir' && recB.dilaporAt == null && recB.bukti == null && recB.kategoriIzin == null)
  await klik('[data-testid="absen-mA-izin"]') // hapus lagi agar rekap status tidak bergeser
  await wait(300)
  await klik('[data-testid="absen-mB-hadir"]')
  await wait(300)
  // v2.9 — tunggu kondisi nyata di basis data (bukan jeda tetap): kedua catatan s_w11 sudah terhapus
  for (let i = 0; i < 40; i++) {
    const sisa = (await semua('attendance')).filter(
      (r) => r.sessionId === 's_w11' && (r.memberId === 'mA' || r.memberId === 'mB') && r.status,
    )
    if (sisa.length === 0) break
    await wait(200)
  }

  /* ============================== 4. Syarat pelantikan ============================== */
  console.log('\n— Syarat pelantikan —')
  await klik('[data-testid="tab-absensi-pelantikan"]')
  await p.waitForSelector('[data-testid="pemantau-pelantikan"]', { timeout: 10000 })
  cek('program terbaru dipilih bawaan', (await p.$eval('[data-testid="pemantau-program"]', (e) => e.value)) === 'prog_uji')
  await p.waitForSelector('[data-testid="status-mA"]', { timeout: 8000 })
  const status = {}
  for (const id of ['mA', 'mB', 'mC', 'mD', 'mE', 'mF']) status[id] = await p.$eval(`[data-testid="peserta-${id}"]`, (e) => e.dataset.status).catch(() => null)
  cek('berjalan: hadir 6, butuh 7, sisa 2', status.mA === 'berjalan', JSON.stringify(status))
  cek('kritis: wajib hadir di semua sisa sesi', status.mB === 'kritis')
  cek('susulan: alpa melebihi batas', status.mC === 'susulan')
  cek('lulus: hadir ≥ 7/12 × 12', status.mD === 'lulus')
  cek('susulan: bergabung sesudah batas', status.mE === 'susulan')
  cek('anggota bukan peserta tidak tampil', !(await ada('[data-testid="peserta-mG"]')))
  cek('alasan berjalan menyebut kelonggaran & jatah alpa', (await teks('[data-testid="alasan-mA"]')).includes('boleh tidak hadir 1× (alpa maks. 1×)'), await teks('[data-testid="alasan-mA"]'))
  cek('baris: hadir/butuh · alpa/batas · telat/jatah', (await teks('[data-testid="hadir-mA"]')) === 'hadir 6/7' && (await teks('[data-testid="alpa-mC"]')) === 'alpa 7/3' && (await teks('[data-testid="telat-mA"]')) === 'telat 0/2')
  const atr = await teks('[data-testid="aturan-pelantikan"]')
  cek('teks aturan: rasio & angka N = 12 (aturan lama dibaca sebagai rasio)', atr.includes('7/12') && atr.includes('N = 12 → hadir min. 7, alpa maks. 3, jatah telat 2') && atr.includes('18.30') && atr.includes('19.00'), atr)
  const jumlah = {}
  for (const s of ['lulus', 'berjalan', 'kritis', 'susulan']) jumlah[s] = (await teks(`[data-testid="jumlah-${s}"]`)).replace(/\D/g, '')
  cek('ringkasan: 2 lulus (mD, mF) · 1 berjalan · 1 kritis · 2 susulan', JSON.stringify(jumlah) === '{"lulus":"2","berjalan":"1","kritis":"1","susulan":"2"}', JSON.stringify(jumlah))
  cek('peringatan izin tanpa jam lapor', (await ada('[data-testid="peringatan-tanpa-cap"]')) && (await teks('[data-testid="peringatan-tanpa-cap"]')).startsWith('1 '))
  const sel = await p.$$eval('[data-testid="peserta-mE"] [aria-label="Kehadiran per sesi wajib"] > span', (xs) => xs.length)
  cek('sel per sesi wajib (12)', sel === 12, String(sel))
  await foto('2-pemantau')
  await klik('[data-testid="saring-susulan"]')
  await wait(200)
  const tampil = await p.$$eval('[data-testid^="peserta-m"]', (xs) => xs.map((x) => x.dataset.testid))
  cek('saring susulan → hanya 2 baris', tampil.length === 2 && tampil.includes('peserta-mC') && tampil.includes('peserta-mE'), tampil.join())
  await klik('[data-testid="saring-semua"]')
  const susulan = await teks('[data-testid="daftar-susulan"]')
  cek('daftar susulan: camp belum bertanggal', susulan.includes('Camp') && susulan.includes('belum ditentukan') && susulan.includes('Caca Kurang') && susulan.includes('Eka Telat'), susulan)

  await klik('[data-testid="cetak-pelantikan"]')
  await wait(500)
  const html = (await p.evaluate(() => window.__cetak.splice(0)))[0] ?? ''
  cek('cetak A4 tegak berjudul', html.includes('size: A4 portrait') && html.includes('Rekap Syarat Pelantikan — Latsar Uji'))
  cek('cetak: 6 baris peserta + daftar susulan', (html.match(/<td class="nm">/g) ?? []).length === 6 && html.includes('Pelantikan susulan'))
  cek('cetak: warna hex saja', !/(?:bg|text)-(?:slate|rose|emerald)-|oklch|var\(--/.test(html))
  cek('cetak: aturan rasio & kolom alpa/telat', html.includes('7/12') && html.includes('<th class="num">Alpa</th>') && html.includes('<th class="num">Telat</th>'))

  await klik('[data-testid="kelola-peserta"]')
  await p.waitForSelector('[data-testid="modal-peserta"]')
  await p.waitForFunction(() => document.querySelector('[data-testid="peserta-jumlah"]')?.textContent?.startsWith('6'), { timeout: 5000 }).catch(() => {})
  cek('kelola: 6 dipilih', (await teks('[data-testid="peserta-jumlah"]')).startsWith('6'))
  await p.select('[data-testid="peserta-tahun"]', '2025')
  await wait(150)
  await klik('[data-testid="peserta-pilih-semua"]')
  cek('pilih yang tampil (tahun 2025) → 7', (await teks('[data-testid="peserta-jumlah"]')).startsWith('7'))
  cek('bergabung bawaan = mulai program', (await p.$eval('[data-testid="peserta-gabung-mG"]', (e) => e.value)) === hari(-30))
  await klik('[data-testid="peserta-simpan"]')
  await wait(600)
  const uji = ((await tim()).programLatihan ?? []).find((x) => x.id === 'prog_uji')
  cek('peserta tersimpan (7)', uji?.peserta.length === 7 && uji.peserta.some((x) => x.memberId === 'mG'))
  cek('peserta baru tampil (kosong → susulan)', (await p.$eval('[data-testid="peserta-mG"]', (e) => e.dataset.status).catch(() => null)) === 'susulan')

  /* ============================== 5. HP 360 px ============================== */
  console.log('\n— HP 360 px —')
  await p.setViewport({ width: 360, height: 780 })
  await wait(500)
  const lebar = async () => p.evaluate(() => document.documentElement.scrollWidth)
  await foto('3-pemantau-360')
  cek('Syarat pelantikan muat 360 px', (await lebar()) <= 360, String(await lebar()))
  await klik('[data-testid="tab-absensi-isi"]')
  await p.select('select[data-kiosk-allow]', 's_w10')
  await wait(400)
  cek('Isi absensi + chip lapor muat 360 px', (await lebar()) <= 360 && (await ada('[data-testid="lapor-mF"]')), String(await lebar()))
  await foto('4-absensi-360')
  cek('chip izin tanpa jam lapor', (await sah('mF')) === 'tanpa-cap')
  await p.goto(`${BASE}/#/jadwal`, { waitUntil: 'networkidle2' })
  await wait(600)
  await klik('[data-testid="buka-program"]')
  await p.waitForSelector('[data-testid="modal-program"]')
  await wait(400)
  cek('modal program muat 360 px', (await lebar()) <= 360, String(await lebar()))

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
