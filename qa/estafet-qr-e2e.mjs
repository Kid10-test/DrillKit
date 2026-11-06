/**
 * #30 — Estafet QR berantai & Bagikan langsung: uji peramban ujung ke ujung.
 *
 * Logika murninya diuji di `estafet-qr-logika.mjs`. Di sini sambungannya,
 * dengan beberapa "HP" (konteks peramban terpisah = IndexedDB terpisah):
 *
 *   1. Pengirim (pelatih): tombol Kirim lewat QR di Kolaborasi seksi & Ekspor
 *      data; `qrcode` tidak dimuat sebelum dibutuhkan; kanvas QR identik
 *      dengan matriks QR bingkai (mode L), jeda/langkah/ukuran/kecepatan.
 *   2. Penerima (HP pelatih lain): `BarcodeDetector` tiruan disuapi bingkai
 *      ACAK + dobel + buram + kartu absensi → kisi kemajuan → rakit →
 *      pratinjau Pintu #7 (data 80 anggota, setoran seksi).
 *   3. Pagar mode: paket anggota lewat QR DITOLAK di mode pelatih; di mode
 *      anggota paket pribadi diterima (hai, nama!) & berkas pelatih ditolak.
 *   4. Peramban tanpa pemindai bawaan → pesan jelas, tanpa galat.
 *   5. Bagikan langsung (navigator.share tiruan): backup, berkas grup, ZIP
 *      per anggota, setoran seksi — nama/MIME/isi benar; tersembunyi bila
 *      peramban tak mendukung berbagi berkas.
 *   6. Scan QR absensi (kamera bersama) tetap mencatat hadir.
 *   7. Lebar HP 360 px tanpa gulir mendatar; nol galat konsol.
 *
 * Pakai: bash qa/bangun-logika.sh && BASE=http://localhost:4173 node qa/estafet-qr-e2e.mjs
 */
import puppeteer from 'puppeteer'
import QRCode from 'qrcode'
import { lewatSambutan } from './sambutan.mjs'
import { penampungBaru, rakitEstafet, tampung } from '/tmp/estafetQr.mjs'
import { kenaliBerkas } from '/tmp/bukaBerkas.mjs'

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
const ada = async (hal, sel) => (await hal.$(sel)) != null
const teks = (hal, sel) => hal.$eval(sel, (e) => (e.textContent ?? '').replace(/\s+/g, ' ').trim())
const klik = async (hal, sel) => {
  await hal.waitForSelector(sel, { timeout: 15000 })
  await hal.$eval(sel, (e) => e.scrollIntoView({ block: 'center' }))
  await hal.click(sel)
}

// PRNG deterministik (xorshift32)
let benih = 2024
const acak = () => {
  benih ^= benih << 13
  benih ^= benih >>> 17
  benih ^= benih << 5
  return (benih >>> 0) / 2 ** 32
}
const kocok = (arr) => {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(acak() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const errors = []
const ABAIKAN = /favicon|Failed to load resource|net::ERR/i
const HARI_INI = new Date().toISOString().slice(0, 10)
const SEKARANG = Date.now()

const browser = await puppeteer.launch({
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  defaultViewport: { width: 1280, height: 900 },
})

/** "HP" baru: konteks terpisah, opsi pemindai tiruan & lembar berbagi tiruan. */
async function hpBaru(label, { mode = 'coach', pemindai = false, berbagi = false } = {}) {
  const ctx = await browser.createBrowserContext()
  const p = await ctx.newPage()
  p.on('console', (x) => {
    if (x.type() === 'error' && !ABAIKAN.test(x.text())) errors.push(`[${label}] ${x.text()}`)
  })
  p.on('pageerror', (e) => errors.push(`[${label}] ${String(e)}`))
  p.on('dialog', (d) => d.accept())
  p.__permintaan = []
  p.on('request', (r) => p.__permintaan.push(r.url()))
  await p.evaluateOnNewDocument(
    (pemindai, berbagi) => {
      // Unduhan biasa tidak benar-benar disimpan.
      HTMLAnchorElement.prototype.click = function () {}
      if (pemindai) {
        window.__antrianQr = []
        window.__deteksi = 0
        window.BarcodeDetector = class {
          static async getSupportedFormats() {
            return ['qr_code']
          }
          async detect() {
            window.__deteksi++
            const t = window.__antrianQr.shift()
            return t ? [{ rawValue: t, format: 'qr_code' }] : []
          }
        }
      } else {
        delete window.BarcodeDetector
      }
      if (berbagi) {
        window.__dibagikan = []
        navigator.canShare = (d) => Array.isArray(d?.files) && d.files.length > 0
        navigator.share = async (d) => {
          const f = d.files[0]
          const isi = new Uint8Array(await f.arrayBuffer())
          window.__dibagikan.push({ nama: f.name, mime: f.type, ukuran: f.size, judul: d.title, awal: Array.from(isi.slice(0, 4)), teks: f.type.includes('json') ? new TextDecoder().decode(isi) : '' })
        }
      }
    },
    pemindai,
    berbagi,
  )
  await p.goto(BASE, { waitUntil: 'networkidle2' })
  await lewatSambutan(p, mode)
  return p
}

async function isiData(p) {
  await p.evaluate(
    async ({ hariIni, skrg, anggota }) => {
      const req = indexedDB.open('drillkit')
      const db = await new Promise((res, rej) => {
        req.onsuccess = () => res(req.result)
        req.onerror = () => rej(req.error)
      })
      const putAll = (store, items) =>
        new Promise((res, rej) => {
          const tx = db.transaction(store, 'readwrite')
          const st = tx.objectStore(store)
          for (const it of items) st.put(it)
          tx.oncomplete = () => res()
          tx.onerror = () => rej(tx.error)
        })
      await putAll('members', anggota)
      await putAll('sessions', [
        { id: 'ses_qr', title: 'Latihan Estafet', type: 'latihan', date: hariIni, startTime: '08:00', endTime: '11:00', checklist: [], createdAt: skrg },
      ])
      await putAll('attendance', [{ id: 'att_qr_0', sessionId: 'ses_qr', memberId: 'm0', status: 'hadir', checkInAt: skrg }])
      db.close()
    },
    {
      hariIni: HARI_INI,
      skrg: SEKARANG,
      anggota: Array.from({ length: 80 }, (_, i) => ({
        id: `m${i}`,
        code: `K${i}`,
        name: `Anggota ${['Andra', 'Bunga', 'Citra', 'Dimas', 'Eka'][i % 5]} ${i}`,
        section: ['brass', 'percussion', 'colorguard', 'woodwind'][i % 4],
        instrument: ['Trumpet', 'Snare', 'Bendera', 'Klarinet'][i % 4],
        role: 'member',
        active: 1,
        joinYear: 2025,
        createdAt: SEKARANG,
        token: `tok_${Math.floor(acak() * 2 ** 32).toString(36)}${Math.floor(acak() * 2 ** 32).toString(36)}`,
        phone: `08${Math.floor(acak() * 1e10)}`,
      })),
    },
  )
  await p.reload({ waitUntil: 'networkidle2' })
  await wait(800)
}

/** Kumpulkan semua teks bingkai dari modal pengirim (jeda lalu melangkah). */
async function kumpulkanBingkai(p) {
  await p.waitForSelector('[data-testid="kirim-qr-kanvas"]', { timeout: 15000 })
  await klik(p, '[data-testid="kirim-qr-jeda"]')
  await wait(200)
  const n = Number((await teks(p, '[data-testid="kirim-qr-status"]')).match(/Bingkai \d+\/(\d+)/)?.[1] ?? 0)
  const bingkai = new Map()
  for (let k = 0; k < n + 2 && bingkai.size < n; k++) {
    const { ke, t } = await p.$eval('[data-testid="kirim-qr-kanvas"]', (c) => ({ ke: Number(c.dataset.bingkaiKe), t: c.dataset.teks }))
    bingkai.set(ke, t)
    if (n > 1) {
      await p.click('[aria-label="Bingkai berikutnya"]')
      await wait(60)
    }
  }
  return [...bingkai.entries()].sort((a, b) => a[0] - b[0]).map((x) => x[1])
}

/** Bandingkan piksel kanvas dengan matriks QR teks bingkainya. */
async function kanvasCocokQr(p) {
  await wait(250)
  const data = await p.$eval('[data-testid="kirim-qr-kanvas"]', (c) => {
    const ctx = c.getContext('2d')
    const img = ctx.getImageData(0, 0, c.width, c.height)
    return { w: c.width, h: c.height, teks: c.dataset.teks, px: Array.from(img.data.filter((_, i) => i % 4 === 0)) }
  })
  const qr = QRCode.create(data.teks, { errorCorrectionLevel: 'L' })
  const ukuran = qr.modules.size
  const skala = data.w / (ukuran + 8)
  let salah = 0
  for (let r = 0; r < ukuran; r++) {
    for (let c = 0; c < ukuran; c++) {
      const x = Math.floor((4 + c + 0.5) * skala)
      const y = Math.floor((4 + r + 0.5) * skala)
      const gelap = data.px[y * data.w + x] < 128
      if (gelap !== !!qr.modules.get(r, c)) salah++
    }
  }
  return { salah, ukuran, versi: qr.version, mode: qr.segments.map((s) => s.mode.id).join(',') }
}

async function suapi(p, daftar, jedaMs = 0) {
  if (!jedaMs) return p.evaluate((d) => window.__antrianQr.push(...d), daftar)
  for (const t of daftar) {
    await p.evaluate((x) => window.__antrianQr.push(x), t)
    await wait(jedaMs)
  }
}

async function lebarAman(p, label) {
  await p.setViewport({ width: 360, height: 780 })
  await wait(700)
  const lebar = await p.evaluate(() => document.documentElement.scrollWidth)
  cek(`${label}: lebar HP 360 px tanpa gulir mendatar`, lebar <= 360, String(lebar))
  await p.setViewport({ width: 1280, height: 900 })
  await wait(300)
}

try {
  /* ================================================================ */
  console.log('1. Pengirim: Kolaborasi seksi & Ekspor data → Kirim lewat QR')
  const A = await hpBaru('pengirim', { berbagi: true })
  await isiData(A)
  await A.goto(`${BASE}/#/data`, { waitUntil: 'networkidle2' })
  await A.waitForSelector('[data-testid="kartu-kolaborasi-seksi"]', { timeout: 15000 })
  cek('qrcode belum dimuat sebelum dibutuhkan', !A.__permintaan.some((u) => /\/(KirimEstafetQr|browser)-[\w-]+\.js/.test(u)), A.__permintaan.filter((u) => /assets\/.*\.js/.test(u)).map((u) => u.split('/').pop()).join(' '))
  cek('tombol Kirim lewat QR di Kolaborasi seksi', await ada(A, '[data-testid="kirim-setoran-seksi-qr"]'))
  cek('tombol Unduh setoran seksi tetap ada', await ada(A, '[data-testid="kirim-setoran-seksi"]'))
  cek('tombol Terima lewat QR di pintu Buka berkas (Data)', await ada(A, '[data-testid="terima-qr-data"]'))
  await A.select('[data-testid="pilih-seksi-kolaborasi"]', 'brass')
  await wait(300)
  await klik(A, '[data-testid="kirim-setoran-seksi-qr"]')
  await A.waitForSelector('[data-testid="modal-kirim-qr"]', { timeout: 15000 })
  const bingkaiSetoran = await kumpulkanBingkai(A)
  cek('KirimEstafetQr dimuat malas saat dibuka', A.__permintaan.some((u) => /KirimEstafetQr-[\w-]+\.js/.test(u)))
  cek('setoran seksi → ≥ 1 bingkai DK1', bingkaiSetoran.length >= 1 && bingkaiSetoran.every((b) => b.startsWith('DK1/')), String(bingkaiSetoran.length))
  let pp = penampungBaru()
  for (const b of bingkaiSetoran) pp = tampung(pp, b).p
  const rakitSetoran = await rakitEstafet(pp)
  const jenisSetoran = rakitSetoran.ok ? kenaliBerkas(rakitSetoran.nama, rakitSetoran.isi).jenis : '-'
  cek('bingkai pengirim terakit utuh = berkas setoran seksi', rakitSetoran.ok && /SETORAN SEKSI Brass/.test(rakitSetoran.nama), `${rakitSetoran.nama} ${jenisSetoran}`)
  await klik(A, '[data-testid="kirim-qr-tutup"]')
  await wait(300)

  // Ekspor 80 anggota (token acak → banyak bingkai).
  await klik(A, '[data-testid="centang-jenis-anggota"]')
  await wait(300)
  await klik(A, '[data-testid="ekspor-data-qr"]')
  await A.waitForSelector('[data-testid="kirim-qr-kanvas"]', { timeout: 15000 })
  const statusAwal = await teks(A, '[data-testid="kirim-qr-status"]')
  await wait(1500)
  const statusSesudah = await teks(A, '[data-testid="kirim-qr-status"]')
  cek('bingkai berputar otomatis', statusAwal !== statusSesudah, `${statusAwal} → ${statusSesudah}`)
  const cocok = await kanvasCocokQr(A)
  cek('kanvas = matriks QR bingkainya (mode L, alfanumerik)', cocok.salah === 0 && cocok.mode === 'Alphanumeric', JSON.stringify(cocok))
  await A.select('[data-testid="kirim-qr-ukuran"]', 'kecil')
  await wait(800)
  const bingkaiData = await kumpulkanBingkai(A)
  const cocokKecil = await kanvasCocokQr(A)
  cek('ukuran "Renggang": QR lebih kecil (≤ versi 14) & bingkai lebih banyak', cocokKecil.versi <= 14 && cocokKecil.versi < cocok.versi && cocokKecil.salah === 0, JSON.stringify(cocokKecil))
  cek('data 80 anggota → banyak bingkai (≥ 8)', bingkaiData.length >= 8, String(bingkaiData.length))
  const statusJeda = await teks(A, '[data-testid="kirim-qr-status"]')
  await wait(900)
  cek('Jeda menghentikan putaran', statusJeda === (await teks(A, '[data-testid="kirim-qr-status"]')))
  await A.select('[data-testid="kirim-qr-fps"]', '2')
  cek('perkiraan per putaran ikut fps', /±\d+ dtk per putaran/.test(await teks(A, '[data-testid="kirim-qr-status"]')))
  await klik(A, '[data-testid="kirim-qr-tutup"]')
  await wait(300)

  /* ================================================================ */
  console.log('\n2. Penerima (HP pelatih lain): bingkai acak, dobel, buram → pratinjau')
  const B = await hpBaru('penerima', { pemindai: true })
  cek('Bagikan langsung tersembunyi bila peramban tak mendukung', !(await ada(B, '[data-testid="kirim-setoran-seksi-bagikan"]')))
  await B.waitForSelector('[data-testid="terima-qr-dasbor"]', { timeout: 15000 })
  await klik(B, '[data-testid="terima-qr-dasbor"]')
  await B.waitForSelector('[data-testid="modal-terima-qr"]', { timeout: 15000 })
  await B.waitForFunction(() => window.__deteksi > 3, { timeout: 15000 })
  cek('kamera + pemindai berjalan (tanpa pesan tak-didukung)', !(await ada(B, '[data-testid="terima-qr-tak-didukung"]')))
  const buram = bingkaiData[2].slice(0, -4) + (bingkaiData[2].at(-4) === 'A' ? 'B' : 'A') + bingkaiData[2].slice(-3)
  const separuh = kocok(bingkaiData).slice(0, Math.ceil(bingkaiData.length / 2))
  await suapi(B, ['tok_kartu_absensi', buram, ...separuh, separuh[0], separuh[1]], 0)
  await B.waitForFunction((n) => Number(document.querySelector('[data-testid="terima-qr-status"]')?.dataset.diterima) >= n, { timeout: 15000 }, separuh.length)
  const stTengah = await teks(B, '[data-testid="terima-qr-status"]')
  cek('kemajuan sebagian: n/N bingkai & persen', new RegExp(`${separuh.length}/${bingkaiData.length} bingkai`).test(stTengah), stTengah)
  cek('bingkai buram dibuang & dilaporkan', /1 bingkai buram dibuang/.test(stTengah), stTengah)
  cek('kisi kemajuan: satu kotak per bingkai', (await B.$$eval('[data-testid="terima-qr-kisi"] span', (x) => x.length)) === bingkaiData.length)
  // Bingkai dari kiriman lain (setoran seksi) tidak tercampur.
  await suapi(B, [bingkaiSetoran[0]])
  await wait(500)
  cek('bingkai kiriman lain diabaikan', /dari kiriman lain diabaikan/.test(await teks(B, '[data-testid="terima-qr-status"]')))
  await suapi(B, kocok(bingkaiData))
  await B.waitForSelector('[data-testid="modal-buka-berkas"]', { timeout: 20000 })
  cek('lengkap → modal estafet tertutup', !(await ada(B, '[data-testid="modal-terima-qr"]')))
  await B.waitForFunction(() => !/Menghitung isi berkas/.test(document.querySelector('[data-testid="modal-buka-berkas"]')?.textContent ?? ''), { timeout: 10000 }).catch(() => undefined)
  const isiPratinjau = await teks(B, '[data-testid="modal-buka-berkas"]')
  cek('pratinjau Pintu #7: data 80 anggota', /Anggota/.test(isiPratinjau) && /80/.test(isiPratinjau), isiPratinjau.slice(0, 200))
  await klik(B, '[data-testid="buka-tutup"]')
  await wait(300)

  // Setoran seksi lewat Terima di halaman Data.
  await B.goto(`${BASE}/#/data`, { waitUntil: 'networkidle2' })
  await klik(B, '[data-testid="terima-qr-data"]')
  await B.waitForSelector('[data-testid="modal-terima-qr"]', { timeout: 15000 })
  await B.waitForFunction(() => window.__deteksi > 2, { timeout: 15000 })
  // Sisa kiriman lama masih berputar di depan kamera → terkunci ke sesi lama,
  // setoran (sesi lain) diabaikan + saran Ulangi; Ulangi → beralih.
  await B.evaluate(() => (window.__antrianQr.length = 0))
  await suapi(B, [bingkaiData[0], bingkaiData[1], ...bingkaiSetoran])
  await B.waitForSelector('[data-testid="terima-qr-saran-ulangi"]', { timeout: 10000 })
  await B.waitForFunction(() => window.__antrianQr.length === 0, { timeout: 10000 })
  await wait(300)
  cek('sesi lama masih terkunci → saran Ulangi', /2\/\d+ bingkai/.test(await teks(B, '[data-testid="terima-qr-status"]')))
  await klik(B, '[data-testid="terima-qr-ulangi"]')
  await wait(300)
  cek('Ulangi mengosongkan kemajuan', /Menunggu bingkai pertama/.test(await teks(B, '[data-testid="terima-qr-status"]')))
  await suapi(B, bingkaiSetoran)
  // Berkas setoran seksi dibuka persis seperti dari tombol Buka berkas:
  // pratinjau → konfirmasi "Gabung Setoran Asisten Seksi" di Data.
  await B.waitForSelector('[data-testid="modal-buka-berkas"]', { timeout: 15000 })
  await wait(500)
  cek('pratinjau mengenali Setoran Asisten Seksi: Brass', /Setoran Asisten Seksi: Brass/.test(await teks(B, '[data-testid="modal-buka-berkas"]')))
  await klik(B, '[data-testid="buka-lanjut-data"]')
  await B.waitForSelector('[data-testid="ringkasan-gabung-seksi"]', { timeout: 15000 })
  cek('setoran seksi lewat QR → konfirmasi Gabung Setoran Asisten Seksi', /Gabung Setoran Asisten Seksi: Brass/.test(await teks(B, '[data-testid="konfirmasi-impor"]')))

  /* ================================================================ */
  console.log('\n3. Pagar mode: paket anggota lewat QR')
  await A.goto(`${BASE}/#/berbagi`, { waitUntil: 'networkidle2' })
  await A.waitForSelector('[data-testid="pilih-anggota-kirim"]', { timeout: 15000 })
  cek('Kirim langsung ke satu anak: tombol muncul setelah memilih', !(await ada(A, '[data-testid="kirim-satu-anggota-qr"]')))
  await A.select('[data-testid="pilih-anggota-kirim"]', 'm1')
  await wait(300)
  await klik(A, '[data-testid="kirim-satu-anggota-qr"]')
  await A.waitForSelector('[data-testid="modal-kirim-qr"]', { timeout: 15000 })
  cek('peringatan privasi saat menayangkan berkas pribadi', /hanya ke HP anak/.test(await teks(A, '[data-testid="modal-kirim-qr"]')))
  const bingkaiPaket = await kumpulkanBingkai(A)
  let pk = penampungBaru()
  for (const b of bingkaiPaket) pk = tampung(pk, b).p
  const rk = await rakitEstafet(pk)
  const kenalPaket = rk.ok ? kenaliBerkas(rk.nama, rk.isi) : null
  cek('berkas satu anak = paket anggota pribadi', kenalPaket?.jenis === 'paket' && /UNTUK ANGGOTA/.test(rk.nama), `${rk.nama} ${kenalPaket?.jenis}`)
  const paketTeks = rk.ok ? new TextDecoder().decode(rk.isi) : ''
  cek('privasi: paket tidak memuat token/telepon anggota lain', !paketTeks.includes('tok_') && !/08\d{6,}/.test(paketTeks))
  await klik(A, '[data-testid="kirim-qr-tutup"]')
  await wait(300)

  // Pelatih menerima paket anggota → ditolak.
  await B.goto(`${BASE}/#/`, { waitUntil: 'networkidle2' })
  await klik(B, '[data-testid="terima-qr-dasbor"]')
  await B.waitForFunction(() => window.__deteksi > 2, { timeout: 15000 })
  await B.evaluate(() => (window.__antrianQr.length = 0))
  await suapi(B, kocok(bingkaiPaket))
  await B.waitForSelector('[data-testid="modal-buka-berkas"]', { timeout: 15000 })
  await wait(500)
  cek('mode pelatih menolak paket anggota (pagar #7 tetap berlaku)', /tidak bisa dibuka di mode pelatih/.test(await teks(B, '[data-testid="modal-buka-berkas"]')))
  await klik(B, '[data-testid="buka-tutup"]')

  // HP anggota: berkas pelatih ditolak, paket pribadi diterima.
  const M = await hpBaru('anggota', { mode: 'member', pemindai: true })
  await M.goto(`${BASE}/#/berbagi`, { waitUntil: 'networkidle2' })
  await klik(M, '[data-testid="terima-qr-anggota"]')
  await M.waitForSelector('[data-testid="modal-terima-qr"]', { timeout: 15000 })
  cek('petunjuk penerima menyebut langkah pelatih', /Kirim langsung ke satu anak/.test(await teks(M, '[data-testid="modal-terima-qr"]')))
  await M.waitForFunction(() => window.__deteksi > 2, { timeout: 15000 })
  await suapi(M, bingkaiSetoran)
  await M.waitForSelector('[data-testid="modal-buka-berkas"]', { timeout: 15000 })
  await wait(500)
  cek('mode anggota menolak berkas pelatih lewat QR', /Mode anggota hanya bisa membuka paket/.test(await teks(M, '[data-testid="modal-buka-berkas"]')))
  await klik(M, '[data-testid="buka-tutup"]')
  await wait(300)
  await klik(M, '[data-testid="terima-qr-anggota"]')
  await M.waitForFunction(() => window.__deteksi > 2, { timeout: 15000 })
  await suapi(M, kocok(bingkaiPaket))
  await M.waitForFunction(() => /hai, /.test(document.body.textContent ?? ''), { timeout: 15000 })
  cek('paket pribadi lewat QR dibuka di HP anggota (hai, nama!)', true)
  await wait(1500)
  cek('Ganti paket juga bisa lewat QR', await ada(M, '[data-testid="terima-qr-anggota-ganti"]'))
  await lebarAman(M, 'Berbagi (anggota)')

  /* ================================================================ */
  console.log('\n4. Peramban tanpa pemindai bawaan')
  const T = await hpBaru('tanpa-pemindai')
  await T.waitForSelector('[data-testid="terima-qr-dasbor"]', { timeout: 15000 })
  await klik(T, '[data-testid="terima-qr-dasbor"]')
  await T.waitForSelector('[data-testid="terima-qr-tak-didukung"]', { timeout: 15000 })
  cek('pesan jelas: pakai Chrome/Edge Android atau Bagikan langsung', /Chrome atau Edge di Android/.test(await teks(T, '[data-testid="terima-qr-tak-didukung"]')))
  await klik(T, '[data-testid="terima-qr-tutup"]')

  /* ================================================================ */
  console.log('\n5. Bagikan langsung (lembar berbagi OS)')
  await A.goto(`${BASE}/#/pengaturan`, { waitUntil: 'networkidle2' })
  await klik(A, '[data-testid="backup-bagikan"]')
  await A.waitForFunction(() => window.__dibagikan.length >= 1, { timeout: 15000 })
  let dibagi = await A.evaluate(() => window.__dibagikan)
  const bk = dibagi.at(-1)
  let jsonBackup = null
  try {
    jsonBackup = JSON.parse(bk.teks)
  } catch {
    /* biarkan null */
  }
  cek('backup dibagikan: JSON + 80 anggota', bk.mime === 'application/json' && /\.json$/.test(bk.nama) && jsonBackup?.members?.length === 80, `${bk.nama} ${bk.mime}`)
  await A.waitForFunction(() => /80 anggota|Terakhir|hari ini/i.test(document.body.textContent ?? ''), { timeout: 5000 }).catch(() => undefined)
  const riwayat = await A.evaluate(() => localStorage.getItem('drillkit.backup.notes'))
  cek('backup yang dibagikan tercatat di riwayat', /"members":80/.test(riwayat ?? ''), (riwayat ?? '').slice(0, 120))

  await A.goto(`${BASE}/#/berbagi`, { waitUntil: 'networkidle2' })
  await klik(A, '[data-testid="kirim-grup-bagikan"]')
  await A.waitForFunction(() => window.__dibagikan.length >= 2, { timeout: 15000 })
  await klik(A, '[data-testid="kirim-zip-anggota-bagikan"]')
  await A.waitForFunction(() => window.__dibagikan.length >= 3, { timeout: 15000 })
  dibagi = await A.evaluate(() => window.__dibagikan)
  const grup = dibagi[1]
  const kenalGrup = kenaliBerkas(grup.nama, new TextEncoder().encode(grup.teks))
  cek('berkas grup dibagikan = paket tanpa token siapa pun', kenalGrup.jenis === 'paket' && !grup.teks.includes('tok_'), `${grup.nama} ${kenalGrup.jenis}`)
  const zip = dibagi[2]
  cek('ZIP per anggota dibagikan (application/zip, tanda PK)', zip.mime === 'application/zip' && zip.awal[0] === 0x50 && zip.awal[1] === 0x4b && /\.zip$/.test(zip.nama), `${zip.nama} ${zip.mime}`)
  cek('ZIP per anggota tidak ditawarkan lewat QR (terlalu besar)', !(await ada(A, '[data-testid="kirim-zip-anggota-qr"]')))
  await A.goto(`${BASE}/#/data`, { waitUntil: 'networkidle2' })
  await A.select('[data-testid="pilih-seksi-kolaborasi"]', 'brass')
  await wait(300)
  await klik(A, '[data-testid="kirim-setoran-seksi-bagikan"]')
  await A.waitForFunction(() => window.__dibagikan.length >= 4, { timeout: 15000 })
  const st = (await A.evaluate(() => window.__dibagikan))[3]
  cek('setoran seksi dibagikan dengan nama jelas', /SETORAN SEKSI Brass/.test(st.nama) && st.mime === 'application/json', st.nama)
  await lebarAman(A, 'Data (pelatih)')
  await A.goto(`${BASE}/#/berbagi`, { waitUntil: 'networkidle2' })
  await A.select('[data-testid="pilih-anggota-kirim"]', 'm1')
  await lebarAman(A, 'Berbagi (pelatih)')

  /* ================================================================ */
  console.log('\n6. Scan QR absensi memakai kamera bersama')
  await B.evaluate(
    async ({ hariIni, skrg }) => {
      const req = indexedDB.open('drillkit')
      const db = await new Promise((res) => (req.onsuccess = () => res(req.result)))
      await new Promise((res) => {
        const tx = db.transaction(['members', 'sessions'], 'readwrite')
        tx.objectStore('members').put({ id: 'mx', code: 'X1', name: 'Pemindai Uji', section: 'brass', instrument: 'Trumpet', role: 'member', active: 1, joinYear: 2025, createdAt: skrg, token: 'tok_scan_x1' })
        tx.objectStore('sessions').put({ id: 'ses_scan', title: 'Latihan Scan', type: 'latihan', date: hariIni, startTime: '08:00', endTime: '11:00', checklist: [], createdAt: skrg })
        tx.oncomplete = res
      })
      db.close()
    },
    { hariIni: HARI_INI, skrg: SEKARANG },
  )
  await B.goto(`${BASE}/#/absensi`, { waitUntil: 'networkidle2' })
  await B.reload({ waitUntil: 'networkidle2' })
  await wait(1000)
  const tombolScan = await B.evaluateHandle(() => [...document.querySelectorAll('button')].find((b) => /Scan QR/.test(b.textContent ?? '')))
  await tombolScan.click()
  await B.waitForFunction(() => window.__deteksi > 2, { timeout: 15000 })
  await suapi(B, ['tok_scan_x1'])
  await B.waitForSelector('[data-testid="recent-list"] li', { timeout: 10000 })
  cek('scan kartu anggota tetap mencatat hadir', /Pemindai Uji/.test(await teks(B, '[data-testid="recent-list"]')))
  await suapi(B, [bingkaiSetoran[0]])
  await wait(800)
  cek('bingkai estafet di Scan absensi → "Kode tidak dikenal" (tidak mogok)', /Kode tidak dikenal/.test(await B.evaluate(() => document.body.textContent ?? '')))

  /* ================================================================ */
  console.log('\n7. Galat konsol')
  cek('nol galat konsol / halaman', errors.length === 0, errors.slice(0, 5).join(' | '))
} catch (e) {
  gagal.push('PENGECUALIAN: ' + (e?.stack ?? e))
  console.log('  ✗ PENGECUALIAN', e)
} finally {
  await browser.close()
}

console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) {
  console.log(gagal.map((g) => ' - ' + g).join('\n'))
  process.exit(1)
}
