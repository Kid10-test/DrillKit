/**
 * Uji Peramban E2E #15 — Kolaborasi Multi-Pelatih Seksi & Log Perubahan Show (I1).
 *
 * Skenario nyata lintas 3 konteks peramban (100% luring):
 *  1. Perangkat Asisten Pelatih Brass:
 *     - Membuka Evaluasi -> Matriks Setoran Hafalan, menyaring seksi Brass,
 *       menekan pintasan "Kirim Setoran Seksi" -> otomatis masuk ke #/data?seksi=brass,
 *     - Mengisi nama asisten ("Kak Raka") dan mengunduh berkas setoran seksi Brass.
 *  2. Perangkat Pelatih Kepala:
 *     - Membuka berkas asisten lewat Pintu #7 (input buka-berkas di Dashboard),
 *       memverifikasi lencana "Setoran Asisten Seksi: Brass · oleh Kak Raka",
 *     - Melihat ringkasan per seksi di menu Data, bukti seksi Percussion & Color Guard
 *       aman tak tersentuh, serta daftar bentrokan absensi (izin vs hadir),
 *     - Menerapkan penggabungan dan membuktikan di IndexedDB bahwa token QR kepala,
 *       absensi Percussion, dan centang kemajuan Percussion/Guard tetap 100% utuh,
 *     - Menandai acuan show di #/berbagi, merevisi koordinat T1 (> 2 langkah di Set 1–2),
 *       memecah Set 2 -> 2 & 2A, serta menaikkan tempo Segmen B 132 -> 140 BPM,
 *     - Memverifikasi pratinjau Log Perubahan Show otomatis tampil, lalu mengunduh
 *       berkas grup DAN ZIP per anggota secara berurutan (keduanya tetap membawa diff utuh).
 *  3. Perangkat Anggota (Mode Anggota):
 *     - Membuka paket Andi (T1, Brass) -> kartu "Apa yang berubah di paket ini" tampil
 *       lengkap pesan pelatih dan lencana "Menyangkut titikmu!" pada perubahan T1,
 *     - Menguji tombol Sembunyikan -> Lihat apa yang berubah (bebas jalan buntu),
 *     - Mengganti nama ke Budi (S1, Percussion) pada berkas grup -> lencana
 *       "Menyangkut titikmu!" tidak muncul pada pergeseran titik T1.
 */
import puppeteer from 'puppeteer'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { lewatSambutan } from './sambutan.mjs'
import { bukaZip } from '/tmp/zip.mjs'

const BASE = (process.argv[2] || process.env.BASE || 'http://localhost:4173').replace(/\/$/, '')
const dirUnduhAsisten = fs.mkdtempSync(path.join(os.tmpdir(), 'dk-15-asisten-'))
const dirUnduhKepala = fs.mkdtempSync(path.join(os.tmpdir(), 'dk-15-kepala-'))

let lulus = 0
let gagal = 0
function cek(nama, ok, detail = '') {
  if (ok) {
    lulus += 1
    console.log('  ✓ ' + nama)
  } else {
    gagal += 1
    console.error('  ✗ ' + nama + (detail ? ' → ' + detail : ''))
  }
}

const tunggu = (ms) => new Promise((r) => setTimeout(r, ms))

async function tungguBerkas(dir, predikat, batasMs = 8000) {
  const mulai = Date.now()
  while (Date.now() - mulai < batasMs) {
    const daftar = fs.readdirSync(dir).filter((f) => !f.endsWith('.crdownload') && predikat(f))
    if (daftar.length > 0) return path.join(dir, daftar[0])
    await tunggu(120)
  }
  return null
}

console.log('== #15 Uji Peramban Kolaborasi Pelatih Seksi & Log Perubahan Show (I1) ==')

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
})

const galat = []
const reqLuar = []

function pasangPemantau(page) {
  page.on('pageerror', (e) => galat.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error') galat.push(`console: ${m.text()}`)
  })
  page.on('request', (req) => {
    const u = req.url()
    if (
      !u.startsWith(BASE) &&
      !u.startsWith('data:') &&
      !u.startsWith('blob:') &&
      !u.startsWith('about:')
    ) {
      reqLuar.push(u)
    }
  })
}

const HARI_INI = new Date().toISOString().slice(0, 10)
const EPOCH_SKRG = Date.now()

try {
  /* ======================================================================== */
  /* 1. Perangkat Asisten Pelatih Seksi Brass                                 */
  /* ======================================================================== */
  const ctxAsisten = await browser.createBrowserContext()
  const pAsisten = await ctxAsisten.newPage()
  await pAsisten.setViewport({ width: 1280, height: 860 })
  pasangPemantau(pAsisten)

  const cdpAsisten = await pAsisten.target().createCDPSession()
  await cdpAsisten.send('Page.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath: dirUnduhAsisten,
  })

  await pAsisten.goto(`${BASE}/#/`, { waitUntil: 'networkidle0' })
  await lewatSambutan(pAsisten, 'coach')

  await pAsisten.evaluate(
    async ({ hariIni, skrg }) => {
      const req = indexedDB.open('drillkit')
      const db = await new Promise((res, rej) => {
        req.onsuccess = () => res(req.result)
        req.onerror = () => rej(req.error)
      })
      const putAll = (store, items) =>
        new Promise((res, rej) => {
          const tx = db.transaction(store, 'readwrite')
          const st = tx.objectStore(store)
          st.clear()
          for (const it of items) st.put(it)
          tx.oncomplete = () => res()
          tx.onerror = () => rej(tx.error)
        })

      await putAll('members', [
        { id: 'm_t1', code: 'T1', name: 'Andi Pratama', section: 'brass', instrument: 'Trumpet', role: 'member', active: 1, token: 'tok_asisten_t1', phone: '08123456789' },
        { id: 'm_s1', code: 'S1', name: 'Budi Santoso', section: 'percussion', instrument: 'Snare', role: 'member', active: 1, token: 'tok_asisten_s1' },
      ])
      await putAll('sessions', [
        { id: 'ses_sabtu', title: 'Latihan Sabtu', type: 'latihan', date: hariIni, startTime: '08:00', endTime: '11:00', checklist: [], createdAt: skrg },
      ])
      await putAll('attendance', [
        { id: 'att_asisten_t1', sessionId: 'ses_sabtu', memberId: 'm_t1', status: 'hadir', checkInAt: skrg, note: 'Hadir di seksi Brass' },
        { id: 'att_asisten_s1', sessionId: 'ses_sabtu', memberId: 'm_s1', status: 'alpha', checkInAt: skrg },
      ])
      await putAll('evaluasi', [
        { id: 'ev_t1_sabtu', memberId: 'm_t1', tanggal: hariIni, nilai: { teknik: 5, musik: 4 }, catatan: 'Tone mantap', createdAt: skrg },
      ])
      await putAll('memberNotes', [
        { id: 'mn_t1_sabtu', memberId: 'm_t1', at: skrg, text: 'Jaga artikulasi birama 9', by: 'Kak Raka' },
      ])
      await putAll('targetSetoran', [
        { id: 'tg_intro', judul: 'Intro Mars', kategori: 'musik', biramaDari: 1, biramaSampai: 16, urutan: 1, createdAt: skrg },
      ])
      await putAll('setoran', [
        { id: 'tg_intro__m_t1', targetId: 'tg_intro', memberId: 'm_t1', jenjang: 'hafal_musik', tanggal: hariIni, diubahAt: skrg, penguji: 'Kak Raka', catatan: 'Lancar' },
      ])
      await putAll('drills', [
        {
          id: 'd_show',
          name: 'Opening Show',
          showTitle: 'Gema Nusantara',
          field: { widthYd: 53.33, lengthYd: 100, endZoneYd: 10, hash: 'ncaa', gridYd: 5, step: '8to5', customStepYd: 0.625, showLabels: 1 },
          tempo: 120,
          beatsPerCount: 1,
          rosterIds: ['m_t1', 'm_s1'],
          createdAt: skrg,
          updatedAt: skrg,
        },
      ])
      await putAll('kemajuan', [
        { key: 'd_show', centang: { set_1: { brass: skrg } }, diubah: skrg },
      ])
      db.close()
    },
    { hariIni: HARI_INI, skrg: EPOCH_SKRG },
  )
  await pAsisten.reload({ waitUntil: 'networkidle0' })

  // Buka Matriks Setoran Hafalan -> pilih seksi Brass -> klik pintasan Kirim Setoran Seksi
  await pAsisten.goto(`${BASE}/#/evaluasi?tab=setoran`, { waitUntil: 'networkidle0' })
  await pAsisten.waitForSelector('[data-testid="saring-seksi-setoran"]')
  await pAsisten.select('[data-testid="saring-seksi-setoran"]', 'brass')
  await tunggu(150)
  await pAsisten.click('[data-testid="pintasan-kirim-seksi"]')
  await pAsisten.waitForSelector('[data-testid="kartu-kolaborasi-seksi"]')

  const seksiTerpilih = await pAsisten.$eval('[data-testid="pilih-seksi-kolaborasi"]', (el) => el.value)
  cek('1. Pintasan Kirim Setoran Seksi dari Evaluasi melompat ke #/data dengan seksi Brass terpilih', seksiTerpilih === 'brass', seksiTerpilih)

  const teksPratinjauAsisten = await pAsisten.$eval('[data-testid="pratinjau-kirim-seksi"]', (el) => el.textContent || '')
  cek(
    '2. Pratinjau kirim seksi menampilkan tepat hitungan Brass (1 anggota, 1 absensi, 1 evaluasi, 1 setoran, 1 catatan, 1 centang)',
    teksPratinjauAsisten.includes('1 anggota') &&
      teksPratinjauAsisten.includes('1 absensi') &&
      teksPratinjauAsisten.includes('1 evaluasi') &&
      teksPratinjauAsisten.includes('1 setoran hafalan') &&
      teksPratinjauAsisten.includes('1 centang kemajuan'),
    teksPratinjauAsisten,
  )

  await pAsisten.type('[data-testid="input-nama-asisten"]', 'Kak Raka')
  await pAsisten.click('[data-testid="kirim-setoran-seksi"]')

  const pathSetoranBrass = await tungguBerkas(dirUnduhAsisten, (f) => f.startsWith('DrillKit - SETORAN SEKSI Brass') && f.endsWith('.json'))
  cek('3. Berkas setoran seksi Brass berhasil diunduh dengan nama jelas', Boolean(pathSetoranBrass), String(pathSetoranBrass))

  /* ======================================================================== */
  /* 2. Perangkat Pelatih Kepala: Gabung Seksi (#15a) & Log Show (#15b)       */
  /* ======================================================================== */
  const ctxKepala = await browser.createBrowserContext()
  const pKepala = await ctxKepala.newPage()
  await pKepala.setViewport({ width: 1280, height: 860 })
  pasangPemantau(pKepala)

  const cdpKepala = await pKepala.target().createCDPSession()
  await cdpKepala.send('Page.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath: dirUnduhKepala,
  })

  await pKepala.goto(`${BASE}/#/`, { waitUntil: 'networkidle0' })
  await lewatSambutan(pKepala, 'coach')

  await pKepala.evaluate(
    async ({ hariIni, skrg }) => {
      const req = indexedDB.open('drillkit')
      const db = await new Promise((res, rej) => {
        req.onsuccess = () => res(req.result)
        req.onerror = () => rej(req.error)
      })
      const putAll = (store, items) =>
        new Promise((res, rej) => {
          const tx = db.transaction(store, 'readwrite')
          const st = tx.objectStore(store)
          st.clear()
          for (const it of items) st.put(it)
          tx.oncomplete = () => res()
          tx.onerror = () => rej(tx.error)
        })

      await putAll('settings', [
        {
          key: 'team',
          teamName: 'MB Gema Nusantara',
          coachName: 'Pelatih Kepala',
          memberMode: 0,
          defaultField: { widthYd: 53.33, lengthYd: 100, endZoneYd: 10, hash: 'ncaa', gridYd: 5, step: '8to5', customStepYd: 0.625, showLabels: 1 },
          sections: [
            { id: 'brass', label: 'Brass', short: 'BRS', dot: '#f59e0b' },
            { id: 'percussion', label: 'Percussion', short: 'PRC', dot: '#10b981' },
            { id: 'guard', label: 'Color Guard', short: 'CG', dot: '#ec4899' },
          ],
        },
      ])
      await putAll('members', [
        { id: 'm_t1', code: 'T1', name: 'Andi Pratama', section: 'brass', instrument: 'Trumpet', role: 'member', active: 1, token: 'qr_kepala_utuh_t1', phone: '089999999' },
        { id: 'm_s1', code: 'S1', name: 'Budi Santoso', section: 'percussion', instrument: 'Snare', role: 'member', active: 1, token: 'qr_kepala_utuh_s1' },
        { id: 'm_g1', code: 'G1', name: 'Citra Ayu', section: 'guard', instrument: 'Flag', role: 'member', active: 1, token: 'qr_kepala_utuh_g1' },
      ])
      await putAll('sessions', [
        { id: 'ses_sabtu', title: 'Latihan Sabtu', type: 'latihan', date: hariIni, startTime: '08:00', endTime: '11:00', checklist: [], createdAt: skrg - 5000 },
      ])
      await putAll('attendance', [
        // Pelatih kepala sempat mencatat Andi "izin", sementara asisten Brass mencatat "hadir"
        { id: 'att_kepala_t1', sessionId: 'ses_sabtu', memberId: 'm_t1', status: 'izin', checkInAt: skrg - 5000 },
        { id: 'att_kepala_s1', sessionId: 'ses_sabtu', memberId: 'm_s1', status: 'hadir', checkInAt: skrg - 5000 },
      ])
      await putAll('drills', [
        {
          id: 'd_show',
          name: 'Opening Show',
          showTitle: 'Gema Nusantara',
          field: { widthYd: 53.33, lengthYd: 100, endZoneYd: 10, hash: 'ncaa', gridYd: 5, step: '8to5', customStepYd: 0.625, showLabels: 1 },
          tempo: 120,
          beatsPerCount: 1,
          rosterIds: ['m_t1', 'm_s1', 'm_g1'],
          createdAt: skrg - 5000,
          updatedAt: skrg - 5000,
        },
      ])
      await putAll('sets', [
        {
          id: 'st_1',
          drillId: 'd_show',
          order: 0,
          name: '1',
          counts: 16,
          points: {
            m_t1: { x: 0, y: 0, facing: 'front' },
            m_s1: { x: -5, y: -5, facing: 'front' },
            m_g1: { x: 5, y: 5, facing: 'front' },
          },
          createdAt: skrg - 5000,
        },
        {
          id: 'st_2',
          drillId: 'd_show',
          order: 1,
          name: '2',
          counts: 16,
          points: {
            m_t1: { x: 0, y: 2.5, facing: 'front' },
            m_s1: { x: -5, y: -5, facing: 'front' },
            m_g1: { x: 5, y: 5, facing: 'front' },
          },
          createdAt: skrg - 5000,
        },
      ])
      await putAll('songs', [
        {
          id: 'song_mars',
          title: 'Mars Nusantara',
          bpm: 120,
          beats: 4,
          tempoMap: [
            { id: 'tm_a', label: 'A', measure: 1, bpm: 120, beats: 4 },
            { id: 'tm_b', label: 'B', measure: 17, bpm: 132, beats: 4 },
          ],
          createdAt: skrg - 5000,
        },
      ])
      await putAll('kemajuan', [
        {
          key: 'd_show',
          centang: {
            set_1: { percussion: skrg - 3000, guard: skrg - 2000 },
          },
          diubah: skrg - 2000,
        },
      ])
      db.close()
    },
    { hariIni: HARI_INI, skrg: EPOCH_SKRG },
  )
  await pKepala.reload({ waitUntil: 'networkidle0' })

  // Buka berkas asisten Brass lewat Pintu #7 di Dashboard
  const inputPintu7 = await pKepala.waitForSelector('[data-testid="buka-berkas-dasbor-input"]')
  await inputPintu7.uploadFile(pathSetoranBrass)
  await pKepala.waitForSelector('[data-testid="buka-info-asisten-seksi"]')
  const teksInfoPintu7 = await pKepala.$eval('[data-testid="buka-info-asisten-seksi"]', (el) => el.textContent || '')
  cek(
    '4. Pintu #7 mengenali berkas Setoran Asisten Seksi Brass & menampilkan nama Kak Raka',
    teksInfoPintu7.includes('Brass') && teksInfoPintu7.includes('Kak Raka'),
    teksInfoPintu7,
  )

  await pKepala.click('[data-testid="buka-lanjut-data"]')
  await pKepala.waitForSelector('[data-testid="ringkasan-gabung-seksi"]')

  const teksSeksiAman = await pKepala.$eval('[data-testid="seksi-aman-tak-tersentuh"]', (el) => el.textContent || '')
  const teksBentrokAbs = await pKepala.$eval('[data-testid="daftar-bentrok-absensi"]', (el) => el.textContent || '')
  cek(
    '5. Modal konfirmasi Data menampilkan seksi aman tak tersentuh (Percussion, Color Guard) & bentrok absensi Andi',
    teksSeksiAman.includes('Percussion') &&
      teksSeksiAman.includes('Color Guard') &&
      teksBentrokAbs.includes('Andi Pratama') &&
      teksBentrokAbs.includes('izin') &&
      teksBentrokAbs.includes('hadir'),
    `${teksSeksiAman} | ${teksBentrokAbs}`,
  )

  await pKepala.click('[data-testid="terapkan-data"]')
  await pKepala.waitForSelector('[data-testid="laporan-impor"]')
  await tunggu(250)

  const hasilDbKepala = await pKepala.evaluate(async () => {
    const req = indexedDB.open('drillkit')
    const db = await new Promise((res, rej) => {
      req.onsuccess = () => res(req.result)
      req.onerror = () => rej(req.error)
    })
    const getAll = (st) =>
      new Promise((res) => {
        const q = db.transaction(st, 'readonly').objectStore(st).getAll()
        q.onsuccess = () => res(q.result)
      })
    const members = await getAll('members')
    const attendance = await getAll('attendance')
    const evaluasi = await getAll('evaluasi')
    const setoran = await getAll('setoran')
    const kemajuan = await getAll('kemajuan')
    db.close()
    return { members, attendance, evaluasi, setoran, kemajuan }
  })

  const andiKepala = hasilDbKepala.members.find((m) => m.id === 'm_t1')
  const absAndi = hasilDbKepala.attendance.filter((a) => a.memberId === 'm_t1')
  const absBudi = hasilDbKepala.attendance.find((a) => a.memberId === 'm_s1')
  const kemShow = hasilDbKepala.kemajuan.find((k) => k.key === 'd_show')

  cek(
    '6. Penggabungan seksi menjaga token QR kepala, memperbarui absensi Andi tanpa duplikat, & menjaga centang Percussion/Guard utuh',
    andiKepala?.token === 'qr_kepala_utuh_t1' &&
      andiKepala?.phone === '089999999' &&
      absAndi.length === 1 &&
      absAndi[0].status === 'hadir' &&
      absBudi?.status === 'hadir' &&
      hasilDbKepala.evaluasi.length === 1 &&
      hasilDbKepala.setoran.some((s) => s.memberId === 'm_t1' && s.jenjang === 'hafal_musik') &&
      Boolean(kemShow?.centang?.set_1?.brass) &&
      Boolean(kemShow?.centang?.set_1?.percussion) &&
      Boolean(kemShow?.centang?.set_1?.guard),
    JSON.stringify({ token: andiKepala?.token, absAndi, centang: kemShow?.centang }),
  )

  // #15b — Tandai acuan di #/berbagi, ubah formasi & lagu, lalu periksa Log Perubahan Show Otomatis
  await pKepala.goto(`${BASE}/#/berbagi`, { waitUntil: 'networkidle0' })
  await pKepala.waitForSelector('[data-testid="simpan-acuan-perubahan"]')
  await pKepala.click('[data-testid="simpan-acuan-perubahan"]')
  await tunggu(300)

  // Revisi show: T1 bergeser +2.5 yd (4 langkah > 2 langkah) di Set 1 & Set 2, Set 2 dipecah jadi 2 & 2A, Segmen B 132 -> 140 BPM
  await pKepala.evaluate(async (skrg) => {
    const req = indexedDB.open('drillkit')
    const db = await new Promise((res, rej) => {
      req.onsuccess = () => res(req.result)
      req.onerror = () => rej(req.error)
    })
    const tx = db.transaction(['sets', 'songs'], 'readwrite')
    const stSets = tx.objectStore('sets')
    stSets.put({
      id: 'st_1',
      drillId: 'd_show',
      order: 0,
      name: '1',
      counts: 16,
      points: {
        m_t1: { x: 2.5, y: 0, facing: 'front' },
        m_s1: { x: -5, y: -5, facing: 'front' },
        m_g1: { x: 5, y: 5, facing: 'front' },
      },
      createdAt: skrg,
    })
    stSets.put({
      id: 'st_2',
      drillId: 'd_show',
      order: 1,
      name: '2',
      counts: 8,
      points: {
        m_t1: { x: 2.5, y: 2.5, facing: 'front' },
        m_s1: { x: -5, y: -5, facing: 'front' },
        m_g1: { x: 5, y: 5, facing: 'front' },
      },
      createdAt: skrg,
    })
    stSets.put({
      id: 'st_2a',
      drillId: 'd_show',
      order: 2,
      name: '2A',
      counts: 8,
      points: {
        m_t1: { x: 2.5, y: 2.5, facing: 'front' },
        m_s1: { x: -5, y: -5, facing: 'front' },
        m_g1: { x: 5, y: 5, facing: 'front' },
      },
      createdAt: skrg,
    })
    tx.objectStore('songs').put({
      id: 'song_mars',
      title: 'Mars Nusantara',
      bpm: 120,
      beats: 4,
      tempoMap: [
        { id: 'tm_a', label: 'A', measure: 1, bpm: 120, beats: 4 },
        { id: 'tm_b', label: 'B', measure: 17, bpm: 140, beats: 4 },
      ],
      createdAt: skrg,
    })
    await new Promise((res, rej) => {
      tx.oncomplete = () => res()
      tx.onerror = () => rej(tx.error)
    })
    db.close()
  }, EPOCH_SKRG)
  await pKepala.reload({ waitUntil: 'networkidle0' })
  await pKepala.waitForSelector('[data-testid="daftar-butir-perubahan-pelatih"]')

  const teksLogPelatih = await pKepala.$eval(
    '[data-testid="daftar-butir-perubahan-pelatih"]',
    (el) => el.textContent || '',
  )
  cek(
    '7. Kartu Log Perubahan Show di halaman Berbagi Pelatih mendeteksi Set 1–2 T1 > 2 langkah, pecahan 2 & 2A, & Segmen B 132 → 140 BPM',
    teksLogPelatih.includes('Set 1–2: posisi T1 berubah > 2 langkah') &&
      teksLogPelatih.includes('Set 2 dipecah menjadi 2 & 2A') &&
      teksLogPelatih.includes('Tempo Segmen B berubah 132 → 140 BPM'),
    teksLogPelatih,
  )

  await pKepala.type('[data-testid="input-catatan-perubahan"]', 'Fokus latihan Sabtu di Set 1–2')
  await pKepala.click('[data-testid="unduh-grup-atas"]')
  const pathGrup = await tungguBerkas(dirUnduhKepala, (f) => f.includes('semua (grup)') && f.endsWith('.json'))

  await pKepala.click('[data-testid="unduh-per-anggota-atas"]')
  const pathZipAnggota = await tungguBerkas(dirUnduhKepala, (f) => f.endsWith('.zip'))

  const jsonGrup = JSON.parse(fs.readFileSync(pathGrup, 'utf8'))
  const entriZip = bukaZip(new Uint8Array(fs.readFileSync(pathZipAnggota)))
  const entriAndi = entriZip.find((e) => e.nama.includes('Andi Pratama'))
  const jsonAndi = JSON.parse(entriAndi.teks())

  const pathPaketAndi = path.join(dirUnduhKepala, 'paket-andi-15.json')
  fs.writeFileSync(pathPaketAndi, entriAndi.teks(), 'utf8')

  cek(
    '8. Unduh grup lalu Unduh ZIP anggota berurutan sama-sama membawa perubahanPaket utuh (0 bocoran rahasia)',
    jsonGrup.perubahanPaket?.butir?.length === 3 &&
      jsonAndi.perubahanPaket?.butir?.length === 3 &&
      jsonAndi.perubahanPaket?.catatanPelatih === 'Fokus latihan Sabtu di Set 1–2' &&
      !JSON.stringify(jsonGrup.perubahanPaket).includes('qr_kepala'),
    JSON.stringify({ grup: jsonGrup.perubahanPaket?.butir?.length, andi: jsonAndi.perubahanPaket?.butir?.length }),
  )

  /* ======================================================================== */
  /* 3. Perangkat Anggota: Kartu "Apa yang berubah di paket ini"              */
  /* ======================================================================== */
  const ctxAnggota = await browser.createBrowserContext()
  const pAnggota = await ctxAnggota.newPage()
  await pAnggota.setViewport({ width: 390, height: 844 })
  pasangPemantau(pAnggota)

  await pAnggota.goto(`${BASE}/#/`, { waitUntil: 'networkidle0' })
  await lewatSambutan(pAnggota, 'member')
  await pAnggota.waitForSelector('#pkg-input')
  const inputPkg = await pAnggota.$('#pkg-input')
  await inputPkg.uploadFile(pathPaketAndi)

  await pAnggota.waitForSelector('[data-testid="kartu-perubahan-paket"]')
  const teksKartuAnggota = await pAnggota.$eval('[data-testid="kartu-perubahan-paket"]', (el) => el.textContent || '')
  const jmlLencanaAndi = await pAnggota.$$eval('[data-testid="lencana-menyangkut-saya"]', (els) => els.length)
  cek(
    '9. Mode Anggota (Andi T1) menampilkan kartu "Apa yang berubah di paket ini", pesan pelatih, & lencana "Menyangkut titikmu!"',
    teksKartuAnggota.includes('Apa yang berubah di paket ini') &&
      teksKartuAnggota.includes('Fokus latihan Sabtu di Set 1–2') &&
      teksKartuAnggota.includes('Set 1–2: posisi T1 berubah > 2 langkah') &&
      jmlLencanaAndi === 1,
    `lencana=${jmlLencanaAndi} | ${teksKartuAnggota}`,
  )

  // Uji tombol Sembunyikan -> Lihat apa yang berubah (bebas jalan buntu)
  await pAnggota.click('[data-testid="tutup-perubahan-paket"]')
  await pAnggota.waitForSelector('[data-testid="buka-perubahan-paket"]')
  await pAnggota.click('[data-testid="buka-perubahan-paket"]')
  await pAnggota.waitForSelector('[data-testid="kartu-perubahan-paket"]')
  cek('10. Kartu perubahan di Mode Anggota dapat disembunyikan & dibuka kembali tanpa jalan buntu', true)

  // Buka berkas grup & pilih Budi (S1, Percussion) -> lencana "Menyangkut titikmu!" harus 0
  const inputPkg2 = await pAnggota.$('#pkg-input2')
  await inputPkg2.uploadFile(pathGrup)
  await tunggu(500)
  // Ganti nama ke Budi Santoso
  await pAnggota.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('Ganti nama'))
    btn?.click()
  })
  await tunggu(200)
  await pAnggota.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('Budi Santoso'))
    btn?.click()
  })
  await tunggu(250)
  const jmlLencanaBudi = await pAnggota.$$eval('[data-testid="lencana-menyangkut-saya"]', (els) => els.length)
  cek(
    '11. Saat Budi (S1, Percussion) dipilih, perubahan titik T1 tidak salah menyorot "Menyangkut titikmu!"',
    jmlLencanaBudi === 0,
    String(jmlLencanaBudi),
  )

  // Pastikan jumlah tab utama Mode Anggota tetap tepat 6 ([data-testid^="tab-"])
  const jmlTabAnggota = await pAnggota.$$eval('[data-testid^="tab-"]', (els) => els.length)
  cek('12. Jumlah tab navigasi Mode Anggota tetap terjaga tepat 6', jmlTabAnggota === 6, String(jmlTabAnggota))

  cek('13. Nol galat konsol/halaman sepanjang alur E2E #15', galat.length === 0, galat.join(' | '))
  cek('14. Nol permintaan jaringan eksternal (100% luring)', reqLuar.length === 0, reqLuar.join(', '))

  await ctxAsisten.close()
  await ctxKepala.close()
  await ctxAnggota.close()
} finally {
  await browser.close()
  fs.rmSync(dirUnduhAsisten, { recursive: true, force: true })
  fs.rmSync(dirUnduhKepala, { recursive: true, force: true })
}

console.log(`\nRingkasan #15 Peramban: ${lulus} lulus, ${gagal} gagal`)
if (gagal > 0) process.exit(1)
