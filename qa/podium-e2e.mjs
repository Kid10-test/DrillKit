/**
 * #31 — Mode Podium di dalam `DrillPresenter`: uji peramban ujung ke ujung.
 *
 * Logika murninya diuji di `podium-logika.mjs`. Di sini sambungannya:
 *
 *   1. Chip 📣 Podium membuka panel komando DI DALAM presenter (bukan
 *      halaman/pemutar baru); klik lapangan menyala; tombol ▶▶ urutan & pip
 *      kemajuan disembunyikan (digantikan "▶ Hitung masuk & jalan").
 *   2. Pemilih Set ↔ Huruf latihan ↔ Birama melompat ke set yang benar
 *      (huruf dari label segmen tempo map lagu).
 *   3. Tempo latihan 70–100% menulis tempo latihan lagu (#4) yang sama
 *      dengan halaman Musik; tempo presenter ikut turun.
 *   4. Papan aba-aba 40 m: plakat layar penuh hex murni, baris muat layar,
 *      palet, teks sendiri; Esc/ketuk menutup plakat, bukan presenter.
 *   5. Count-in "4 Standby + 4 Mark Time" dengan klik lapangan #29 (filter
 *      Dr. Beat / Cowbell terdeteksi), hitungan besar, lalu blok Set 2–4
 *      berjalan tanpa jeda dan berhenti di akhir blok.
 *   6. Rep Counter: putaran blok, ulang blok (kembali ke awal blok, bukan
 *      set 1), dan perpindahan tunggal tercatat ke sesi hari ini (IndexedDB)
 *      → tampil di kartu Jadwal & layar Pacu.
 *   7. Drill tanpa lagu: tempo lokal 70–100% + tombol Tempo asli.
 *   8. Tata letak lanskap (panel di samping) & HP tegak (di bawah, tanpa
 *      gulir mendatar); nol galat konsol.
 *
 * Pakai: npm run build && npx vite preview --port 4173 &
 *        BASE=http://localhost:4173 node qa/podium-e2e.mjs
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
/** FOTO=/folder → simpan tangkapan layar untuk pemeriksaan visual (tidak dipakai CI). */
const FOTO = process.env.FOTO || ''

const browser = await puppeteer.launch({
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required'],
  defaultViewport: { width: 1280, height: 800 },
})
const errors = []
const ABAIKAN = /favicon|Failed to load resource|net::ERR/i

try {
  const p = await browser.newPage()
  p.on('console', (m) => {
    if (m.type() === 'error' && !ABAIKAN.test(m.text())) errors.push(m.text())
  })
  p.on('pageerror', (e) => errors.push(String(e)))
  // Mata-mata filter Web Audio: profil klik lapangan #29 memakai bandpass berforman khas.
  await p.evaluateOnNewDocument(() => {
    window.__filter = []
    const asli = BaseAudioContext.prototype.createBiquadFilter
    BaseAudioContext.prototype.createBiquadFilter = function (...a) {
      const f = asli.apply(this, a)
      window.__filter.push(f)
      return f
    }
    window.__formanBandpass = () =>
      [...new Set(window.__filter.filter((f) => f.type === 'bandpass').map((f) => Math.round(f.frequency.value)))]
  })

  const ada = async (sel) => (await p.$(sel)) != null
  const teks = (sel) => p.$eval(sel, (e) => (e.textContent ?? '').replace(/\s+/g, ' ').trim())
  const klik = async (sel) => {
    await p.waitForSelector(sel, { timeout: 15000 })
    await p.$eval(sel, (e) => e.scrollIntoView({ block: 'center' }))
    await p.click(sel)
  }
  const infoSet = () => teks('[data-testid="info-set"]')
  const tungguInfoSet = (nilai, timeout = 8000) =>
    p
      .waitForFunction((v) => document.querySelector('[data-testid="info-set"]')?.textContent?.trim() === v, { timeout }, nilai)
      .then(() => true)
      .catch(() => false)
  const tombolJudul = (j) =>
    p.evaluate((t) => {
      const x = [...document.querySelectorAll('button')].find((y) => (y.getAttribute('title') || '').includes(t))
      if (!x || x.disabled) return false
      x.click()
      return true
    }, j)
  const pilih = async (sel, nilai) => {
    await p.waitForSelector(sel, { timeout: 10000 })
    await p.select(sel, String(nilai))
  }
  const bacaSesi = () =>
    p.evaluate(
      () =>
        new Promise((res, rej) => {
          const r = indexedDB.open('drillkit')
          r.onerror = () => rej(r.error)
          r.onsuccess = () => {
            const db = r.result
            const q = db.transaction('sessions').objectStore('sessions').get('sesi_podium')
            q.onsuccess = () => {
              res(q.result ?? null)
              db.close()
            }
          }
        }),
    )
  const repBaris = () =>
    p.$$eval('[data-testid="podium-rep-baris"]', (xs) =>
      xs.map((x) => ({ dari: +x.dataset.dari, sampai: +x.dataset.sampai, kali: +x.dataset.kali })),
    )
  const kaliRep = async (dari, sampai) => (await repBaris()).find((r) => r.dari === dari && r.sampai === sampai)?.kali ?? 0

  /* ============================== Persiapan ============================== */
  await p.goto(BASE, { waitUntil: 'networkidle2' })
  await lewatSambutan(p)
  await p.evaluate(async () => {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('drillkit')
      r.onsuccess = () => res(r.result)
      r.onerror = () => rej(r.error)
    })
    const tx = db.transaction(['members', 'drills', 'sets', 'songs', 'sessions'], 'readwrite')
    const ids = ['p1', 'p2', 'p3', 'p4']
    ids.forEach((id, i) =>
      tx.objectStore('members').put({
        id,
        name: `Pemain ${i + 1}`,
        code: `P${i + 1}`,
        section: i < 2 ? 'brass' : 'battery',
        instrument: 'Trumpet',
        role: 'member',
        joinYear: 2026,
        active: 1,
      }),
    )
    const kini = Date.now() + 600_000
    tx.objectStore('songs').put({
      id: 'lagu_podium',
      title: 'Lagu Podium',
      bpm: 240,
      beats: 4,
      createdAt: kini,
      tempoMap: [
        { id: 'sa', label: 'A', measure: 1, bpm: 240, beats: 4 },
        { id: 'sb', label: 'B', measure: 3, bpm: 240, beats: 4 },
        { id: 'sc', label: 'C', measure: 5, bpm: 240, beats: 4 },
      ],
    })
    tx.objectStore('drills').put({
      id: 'drill_podium',
      name: 'Uji Podium',
      showTitle: 'Uji Podium #31',
      tempo: 240,
      beatsPerCount: 1,
      songId: 'lagu_podium',
      rosterIds: ids,
      createdAt: kini,
      updatedAt: kini,
      field: { widthYd: 53.33, lengthYd: 100, endZoneYd: 10, hash: 'ncaa', gridYd: 5, step: '8to5', customStepYd: 0.625, showLabels: 1 },
    })
    for (let s = 0; s < 6; s++) {
      const points = {}
      ids.forEach((id, i) => (points[id] = { x: -15 + i * 10 + (s % 2) * 4, y: 10 + s * 2, facing: 'front' }))
      tx.objectStore('sets').put({ id: `sp_${s}`, drillId: 'drill_podium', order: s, name: `Set ${s + 1}`, counts: 4, notes: '', points })
    }
    const d = new Date()
    const tgl = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    tx.objectStore('sessions').put({
      id: 'sesi_podium',
      title: 'Latihan Gabungan Podium',
      type: 'gabungan',
      date: tgl,
      startTime: '00:00',
      endTime: '23:59',
      checklist: [],
      createdAt: kini,
      rencanaLatihan: [{ id: 'b1', judul: 'Full run', jenis: 'gabungan', menit: 30 }],
    })
    await new Promise((res, rej) => {
      tx.oncomplete = () => res(true)
      tx.onerror = () => rej(tx.error)
    })
    db.close()
  })
  await p.goto(`${BASE}/#/drill`, { waitUntil: 'networkidle2' })
  await p.reload({ waitUntil: 'networkidle2' })
  await p.waitForSelector('[data-testid="kanvas-drill-svg"]', { timeout: 20000 })
  await wait(800)

  const bukaPresenter = async () => {
    for (let i = 0; i < 10 && !(await ada('[data-testid="presenter"]')); i++) {
      await tombolJudul('Mode presenter')
      await wait(500)
    }
    await p.waitForSelector('[data-testid="presenter"]', { timeout: 10000 })
  }
  await bukaPresenter()
  if ((await infoSet()) !== '1/6') {
    for (let i = 0; i < 6; i++) await p.keyboard.press('ArrowLeft')
  }
  cek('presenter terbuka di set 1 dari 6', await tungguInfoSet('1/6'), await infoSet())

  /* ======================= 1. Panel podium di presenter ======================= */
  console.log('1. Mode Podium di dalam presenter')
  cek('panel podium belum tampil sebelum chip ditekan', !(await ada('[data-testid="panel-podium"]')))
  await klik('[data-testid="chip-podium"]')
  await p.waitForSelector('[data-testid="panel-podium"]', { timeout: 5000 })
  cek('panel podium tampil di DALAM presenter', await p.$eval('[data-testid="presenter"]', (e) => !!e.querySelector('[data-testid="panel-podium"]')))
  cek('hanya satu presenter (tanpa pemutar tandingan)', (await p.$$('[data-testid="presenter"]')).length === 1)
  cek('klik lapangan langsung menyala', await p.$eval('[data-testid="chip-klik"]', (e) => e.className.includes('emerald')))
  cek(
    'tombol ▶▶ urutan & pip kemajuan disembunyikan',
    await p.evaluate(() => {
      const u = document.querySelector('[data-testid="tombol-urutan"]')
      const k = document.querySelector('[data-testid="baris-kemajuan"]')
      return !!u && u.offsetParent === null && !!k && k.offsetParent === null
    }),
  )
  if (FOTO) await p.screenshot({ path: `${FOTO}/podium-lanskap.png` })
  cek('Rep Counter menyebut sesi hari ini', (await teks('[data-testid="podium-rep-sesi"]')).includes('Latihan Gabungan Podium'))

  /* ===================== 2. Pemilih Set ↔ Huruf ↔ Birama ===================== */
  console.log('2. Pemilih Set ↔ Huruf latihan ↔ Birama')
  await klik('[data-testid="podium-tab-huruf"]')
  const jmlHuruf = await p.$$eval('[data-testid^="podium-huruf-"]', (xs) => xs.filter((x) => /^podium-huruf-\d+$/.test(x.dataset.testid)).length)
  cek('tiga huruf latihan dari tempo map lagu (A, B, C)', jmlHuruf === 3, String(jmlHuruf))
  await klik('[data-testid="podium-huruf-2"]')
  cek('Huruf C (birama 5) → Set 5', await tungguInfoSet('5/6'), await infoSet())
  cek('keterangan lompat huruf', (await teks('[data-testid="podium-hasil-lompat"]')).includes('Huruf C (birama 5) → Set 5'))
  await klik('[data-testid="podium-tab-birama"]')
  await p.type('[data-testid="podium-input-birama"]', '3')
  await klik('[data-testid="podium-lompat-birama"]')
  cek('Birama 3 → Set 3', await tungguInfoSet('3/6'), await infoSet())
  cek('keterangan lompat birama', (await teks('[data-testid="podium-hasil-lompat"]')).includes('Birama 3 → Set 3 (birama 3–3)'))
  await p.focus('[data-testid="podium-input-birama"]')
  await p.keyboard.press('ArrowRight')
  cek('mengetik di kolom birama tidak memicu pintasan presenter', (await infoSet()) === '3/6')
  await klik('[data-testid="podium-tab-set"]')
  await pilih('[data-testid="podium-pilih-dari"]', 1)
  cek('pilih Dari = Set 2', await tungguInfoSet('2/6'), await infoSet())
  await pilih('[data-testid="podium-pilih-sampai"]', 3)
  cek(
    'pilihan Sampai hanya set sesudah Dari',
    await p.$$eval('[data-testid="podium-pilih-sampai"] option', (os) => os.map((o) => +o.value).every((v) => v > 1)),
  )

  /* ========================== 3. Tempo latihan 70–100% ========================== */
  console.log('3. Tempo latihan (#4) dari podium')
  await klik('[data-testid="podium-tempo-85"]')
  const latihan85 = await p
    .waitForFunction(() => document.querySelector('[data-testid="presenter-latihan"]')?.textContent?.includes('Latihan 85%'), { timeout: 5000 })
    .then(() => true)
    .catch(() => false)
  cek('banner "Latihan 85%" muncul', latihan85)
  cek('tempo presenter 240 → 204 BPM', Math.round(Number(await teks('[data-testid="tempo-presenter"]'))) === 204, await teks('[data-testid="tempo-presenter"]'))
  const simpanTempo = await p.evaluate(() => JSON.parse(localStorage.getItem('drillkit.tempoLatihan.v1') || '{}'))
  cek('tersimpan sebagai tempo latihan lagu yang sama dengan halaman Musik', simpanTempo?.lagu_podium?.tempo?.persen === 85, JSON.stringify(simpanTempo))
  cek('tombol 85% aktif', (await p.$eval('[data-testid="podium-tempo-85"]', (e) => e.getAttribute('aria-pressed'))) === 'true')

  /* ============================ 4. Papan aba-aba 40 m ============================ */
  console.log('4. Papan aba-aba 40 m')
  await klik('[data-testid="podium-plakat-rentang"]')
  await p.waitForSelector('[data-testid="plakat-podium"]', { timeout: 4000 })
  const plakat1 = await p.$eval('[data-testid="plakat-podium"]', (e) => ({
    baris: [...e.querySelectorAll('[data-testid="plakat-baris"]')].map((b) => b.textContent),
    gaya: e.getAttribute('style') || '',
    muat: [...e.querySelectorAll('[data-testid="plakat-baris"]')].every((b) => b.getBoundingClientRect().width <= window.innerWidth + 1),
    penuh: (() => {
      const r = e.getBoundingClientRect()
      return r.width >= window.innerWidth - 1 && r.height >= window.innerHeight - 1
    })(),
    hurufPx: parseFloat(getComputedStyle(e.querySelector('[data-testid="plakat-baris"]')).fontSize),
  }))
  cek('plakat "SET 2 – 4 · TEMPO 85%" dua baris', plakat1.baris.join('|') === 'SET 2 – 4|TEMPO 85%', plakat1.baris.join('|'))
  if (FOTO) await p.screenshot({ path: `${FOTO}/podium-plakat.png` })
  cek('plakat memenuhi layar', plakat1.penuh)
  // Sumbernya hex murni (diuji di podium-logika); peramban menyerialkan gaya sebagai rgb().
  cek(
    'warna plakat murni kuning di hitam (#ffff00 / #000000)',
    /background:\s*rgb\(0, 0, 0\)/.test(plakat1.gaya) && /(^|;\s*)color:\s*rgb\(255, 255, 0\)/.test(plakat1.gaya) && !/oklch|color-mix|rgba/i.test(plakat1.gaya),
    plakat1.gaya,
  )
  cek('tiap baris muat lebar layar', plakat1.muat)
  cek('huruf raksasa (≥ 120 px di layar 1280×800)', plakat1.hurufPx >= 120, String(plakat1.hurufPx))
  await p.keyboard.press('Escape')
  await wait(300)
  cek('Esc menutup plakat, presenter tetap terbuka', !(await ada('[data-testid="plakat-podium"]')) && (await ada('[data-testid="presenter"]')))
  await klik('[data-testid="podium-palet-terbalik"]')
  await klik('[data-testid="podium-plakat-reset"]')
  await p.waitForSelector('[data-testid="plakat-podium"]', { timeout: 4000 })
  const plakat2 = await p.$eval('[data-testid="plakat-podium"]', (e) => ({
    baris: [...e.querySelectorAll('[data-testid="plakat-baris"]')].map((b) => b.textContent),
    gaya: e.getAttribute('style') || '',
  }))
  cek('plakat "RESET KE SET 1 · FULL RUN"', plakat2.baris.join('|') === 'RESET KE SET 1|FULL RUN', plakat2.baris.join('|'))
  cek('palet terbalik: hitam di putih (#ffffff latar)', /background:\s*rgb\(255, 255, 255\)/.test(plakat2.gaya) && /(^|;\s*)color:\s*rgb\(0, 0, 0\)/.test(plakat2.gaya), plakat2.gaya)
  await klik('[data-testid="plakat-podium"]')
  await wait(300)
  cek('ketuk plakat menutupnya', !(await ada('[data-testid="plakat-podium"]')))
  await p.type('[data-testid="podium-plakat-kustom"]', 'barisan rapat · tahan')
  await klik('[data-testid="podium-plakat-kustom-tampil"]')
  await p.waitForSelector('[data-testid="plakat-podium"]', { timeout: 4000 })
  cek(
    'teks sendiri dikapitalkan & dipecah per baris',
    (await p.$$eval('[data-testid="plakat-baris"]', (xs) => xs.map((x) => x.textContent).join('|'))) === 'BARISAN RAPAT|TAHAN',
  )
  await klik('[data-testid="plakat-podium"]')
  await klik('[data-testid="podium-palet-kuning"]')
  await wait(200)

  /* ===================== 5. Count-in Standby + Mark Time & blok ===================== */
  console.log('5. Count-in Standby + Mark Time & blok Set 2–4')
  await klik('[data-testid="podium-tempo-100"]')
  await p
    .waitForFunction(() => !document.querySelector('[data-testid="presenter-latihan"]'), { timeout: 5000 })
    .catch(() => undefined)
  cek('tempo 100% → banner latihan hilang', !(await ada('[data-testid="presenter-latihan"]')))
  cek('setelan bawaan count-in 4 + 4', (await teks('[data-testid="podium-mulai"]')).includes('Hitung masuk & jalan · Set 2–4'), await teks('[data-testid="podium-mulai"]'))
  await p.evaluate(() => {
    window.__jejak = []
    const t0 = performance.now()
    const catat = () => {
      const l = document.querySelector('[data-testid="hitungan-besar-label"]')?.textContent?.trim() ?? ''
      const a = document.querySelector('[data-testid="hitungan-besar-angka"]')?.textContent?.trim() ?? ''
      const s = document.querySelector('[data-testid="info-set"]')?.textContent?.trim() ?? ''
      const k = `${l}#${a}#${s}`
      const akhir = window.__jejak[window.__jejak.length - 1]
      if (!akhir || akhir.k !== k) window.__jejak.push({ k, l, a, s, t: performance.now() - t0 })
      window.__rafJejak = requestAnimationFrame(catat)
    }
    catat()
  })
  await klik('[data-testid="podium-mulai"]')
  await wait(200)
  if (FOTO) await p.screenshot({ path: `${FOTO}/podium-countin.png` })
  cek('tombol berubah jadi ■ Stop selama berjalan', (await teks('[data-testid="podium-mulai"]')).includes('Stop'))
  const selesai1 = await p
    .waitForFunction(
      () => document.querySelector('[data-testid="podium-mulai"]')?.textContent?.includes('▶') && (window.__jejak?.length ?? 0) > 8,
      { timeout: 15000 },
    )
    .then(() => true)
    .catch(() => false)
  const jejak = await p.evaluate(() => {
    cancelAnimationFrame(window.__rafJejak)
    return window.__jejak
  })
  cek('blok selesai sendiri', selesai1)
  const hitungMasuk = jejak.filter((j) => j.l === 'STANDBY' || j.l === 'MARK TIME').map((j) => `${j.l}${j.a}`)
  const unik = hitungMasuk.filter((x, i) => x !== hitungMasuk[i - 1])
  cek(
    'hitungan besar: STANDBY 1–4 lalu MARK TIME 1–4',
    unik.join(',') === 'STANDBY1,STANDBY2,STANDBY3,STANDBY4,MARK TIME1,MARK TIME2,MARK TIME3,MARK TIME4',
    unik.join(','),
  )
  const tStandby = jejak.find((j) => j.l === 'STANDBY')?.t ?? 0
  const tJalan = jejak.find((j) => j.l.startsWith('SET '))?.t ?? 0
  cek('count-in 8 ketuk @240 BPM ≈ 2 detik sebelum gerak', tJalan - tStandby > 1500 && tJalan - tStandby < 2700, `${Math.round(tJalan - tStandby)} ms`)
  const labelJalan = [...new Set(jejak.filter((j) => j.l.includes('→')).map((j) => j.l))]
  cek('lalu SET 2 → 3, SET 3 → 4 berjalan tanpa jeda', labelJalan.join(',') === 'SET 2 → 3,SET 3 → 4', labelJalan.join(','))
  const angkaJalan = jejak.filter((j) => j.l === 'SET 2 → 3').map((j) => j.a)
  cek('hitungan besar berdetak 1…4 saat bergerak', ['1', '2', '3', '4'].every((x) => angkaJalan.includes(x)), angkaJalan.join(','))
  cek('berhenti di akhir blok (Set 4), bukan set terakhir', (await infoSet()) === '4/6', await infoSet())
  const forman1 = await p.evaluate(() => window.__formanBandpass())
  cek('klik lapangan Dr. Beat (#29) dipakai', forman1.some((f) => f === 3200 || f === 3584), forman1.join(','))

  /* ================================ 6. Rep Counter ================================ */
  console.log('6. Rep Counter')
  await p.waitForFunction(() => document.querySelectorAll('[data-testid="podium-rep-baris"]').length > 0, { timeout: 5000 }).catch(() => undefined)
  cek('putaran blok Set 2–4 tercatat ×1', (await kaliRep(2, 4)) === 1, JSON.stringify(await repBaris()))
  let sesi = await bacaSesi()
  cek(
    'tersimpan ke sesi hari ini (IndexedDB logRep)',
    sesi?.logRep?.some((r) => r.drillId === 'drill_podium' && r.dari === 2 && r.sampai === 4 && r.kali === 1),
    JSON.stringify(sesi?.logRep),
  )
  // Ulang blok tanpa count-in (0 + 0).
  await pilih('[data-testid="podium-pilih-dari"]', 1)
  await tungguInfoSet('2/6')
  await klik('[data-testid="podium-standby-0"]')
  await klik('[data-testid="podium-mark-0"]')
  cek('tanpa count-in: tombol "▶ Jalan · Set 2–4"', (await teks('[data-testid="podium-mulai"]')).includes('▶ Jalan · Set 2–4'), await teks('[data-testid="podium-mulai"]'))
  const tMulai = Date.now()
  await klik('[data-testid="podium-mulai"]')
  const geraknya = await p
    .waitForFunction(() => document.querySelector('[data-testid="hitungan-besar-label"]')?.textContent?.startsWith('SET '), { timeout: 3000 })
    .then(() => Date.now() - tMulai)
    .catch(() => 99999)
  cek('tanpa count-in langsung bergerak', geraknya < 1200, `${geraknya} ms`)
  await p.waitForFunction(() => document.querySelector('[data-testid="podium-mulai"]')?.textContent?.includes('▶'), { timeout: 10000 }).catch(() => undefined)
  await wait(300)
  cek('putaran kedua → ×2', (await kaliRep(2, 4)) === 2, JSON.stringify(await repBaris()))
  // Ulang otomatis: blok kembali ke Set 2 (awal blok), bukan Set 1.
  await pilih('[data-testid="podium-pilih-dari"]', 1)
  await tungguInfoSet('2/6')
  await p.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('↻ Ulang urutan'))?.click())
  await p.evaluate(() => {
    window.__set = []
    const t = setInterval(() => {
      const s = document.querySelector('[data-testid="info-set"]')?.textContent?.trim()
      if (s && window.__set[window.__set.length - 1] !== s) window.__set.push(s)
    }, 20)
    window.__hentiSet = () => clearInterval(t)
  })
  await klik('[data-testid="podium-mulai"]')
  const ulangOk = await p
    .waitForFunction(
      () => +([...document.querySelectorAll('[data-testid="podium-rep-baris"]')].find((x) => x.dataset.dari === '2' && x.dataset.sampai === '4')?.dataset.kali ?? 0) >= 4,
      { timeout: 15000 },
    )
    .then(() => true)
    .catch(() => false)
  await klik('[data-testid="podium-mulai"]') // ■ Stop
  await wait(400)
  const jejakSet = await p.evaluate(() => {
    window.__hentiSet()
    return window.__set
  })
  cek('ulang blok menambah hitungan tiap putaran (≥ ×4)', ulangOk, JSON.stringify(await repBaris()))
  cek('ulang blok kembali ke Set 2, tidak pernah ke Set 1/5', jejakSet.includes('2/6') && !jejakSet.includes('1/6') && !jejakSet.includes('5/6'), jejakSet.join(' '))
  cek('Stop menghentikan blok', (await teks('[data-testid="podium-mulai"]')).includes('▶'))
  await p.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('↻ Ulang urutan'))?.click())
  // Perpindahan tunggal (tombol Mainkan) = satu pengulangan rentang set itu.
  await pilih('[data-testid="podium-pilih-dari"]', 4)
  await tungguInfoSet('5/6')
  await klik('[data-testid="presenter-mainkan"]')
  await tungguInfoSet('6/6', 6000)
  await wait(400)
  cek('perpindahan tunggal Set 5 → 6 tercatat ×1', (await kaliRep(5, 6)) === 1, JSON.stringify(await repBaris()))
  sesi = await bacaSesi()
  const totalSesi = (sesi?.logRep ?? []).reduce((t, r) => t + r.kali, 0)
  cek('total di panel = total di sesi', Number(await teks('[data-testid="podium-rep-total"]')) === totalSesi, `${await teks('[data-testid="podium-rep-total"]')} vs ${totalSesi}`)

  // Profil Cowbell untuk count-in & klik.
  await p.evaluate(() => (window.__filter.length = 0))
  await klik('[data-testid="podium-profil-cowbell"]')
  await klik('[data-testid="podium-standby-2"]')
  await pilih('[data-testid="podium-pilih-dari"]', 0)
  await tungguInfoSet('1/6')
  await klik('[data-testid="podium-mulai"]')
  await p.waitForFunction(() => document.querySelector('[data-testid="hitungan-besar-label"]')?.textContent?.startsWith('SET '), { timeout: 5000 }).catch(() => undefined)
  const forman2 = await p.evaluate(() => window.__formanBandpass())
  await klik('[data-testid="podium-mulai"]')
  cek('profil Cowbell (#29) dipakai untuk count-in', forman2.includes(2800), forman2.join(','))
  const setelan = await p.evaluate(() => JSON.parse(localStorage.getItem('drillkit.podium.v1') || '{}'))
  cek('setelan podium tersimpan per perangkat', setelan.profil === 'cowbell' && setelan.standby === 2 && setelan.markTime === 0, JSON.stringify(setelan))

  /* ======================== 8a. Tata letak lanskap ======================== */
  console.log('8. Tata letak')
  const lanskap = await p.evaluate(() => {
    const k = document.querySelector('[data-testid="kanvas-presenter"]').getBoundingClientRect()
    const a = document.querySelector('[data-testid="aside-podium"]').getBoundingClientRect()
    return { kanan: a.left >= k.right - 1, lebarKanvas: k.width }
  })
  cek('lanskap: panel di samping lapangan', lanskap.kanan && lanskap.lebarKanvas > 600, JSON.stringify(lanskap))

  await klik('[data-testid="tutup-presenter"]')
  await wait(500)

  /* ===================== 6b. Ringkasan sesi: Jadwal & Pacu ===================== */
  await p.goto(`${BASE}/#/jadwal`, { waitUntil: 'networkidle2' })
  await p.waitForSelector('[data-testid="ringkas-rep-sesi_podium"]', { timeout: 10000 }).catch(() => undefined)
  const ringkas = (await ada('[data-testid="ringkas-rep-sesi_podium"]')) ? await teks('[data-testid="ringkas-rep-sesi_podium"]') : ''
  cek('kartu Jadwal meringkas pengulangan blok', ringkas.includes('Pengulangan blok') && ringkas.includes('Set 2–4'), ringkas)
  await klik('[data-testid="pacu-sesi_podium"]')
  await p.waitForSelector('[data-testid="log-rep-pacu"]', { timeout: 8000 }).catch(() => undefined)
  const barisPacu = await p.$$eval('[data-testid="baris-log-rep"]', (xs) => xs.map((x) => x.textContent.replace(/\s+/g, ' ').trim()))
  cek('layar Pacu menampilkan log pengulangan per drill', barisPacu.some((b) => b.includes('Uji Podium') && b.includes('Set 2–4')), barisPacu.join(' | '))
  await klik('[data-testid="tutup-pacu"]')

  /* ========================= 7. Drill tanpa lagu ========================= */
  console.log('7. Drill tanpa lagu')
  await p.evaluate(async () => {
    const db = await new Promise((res) => {
      const r = indexedDB.open('drillkit')
      r.onsuccess = () => res(r.result)
    })
    const tx = db.transaction('drills', 'readwrite')
    const st = tx.objectStore('drills')
    const g = st.get('drill_podium')
    g.onsuccess = () => {
      const d = g.result
      delete d.songId
      st.put(d)
    }
    await new Promise((res) => (tx.oncomplete = res))
    db.close()
  })
  await p.goto(`${BASE}/#/drill`, { waitUntil: 'networkidle2' })
  await p.reload({ waitUntil: 'networkidle2' })
  await p.waitForSelector('[data-testid="kanvas-drill-svg"]', { timeout: 20000 })
  await wait(600)
  await bukaPresenter()
  await klik('[data-testid="chip-podium"]')
  await klik('[data-testid="podium-tempo-80"]')
  const lokal80 = await p
    .waitForFunction(() => document.querySelector('[data-testid="presenter-latihan"]')?.textContent?.includes('Latihan 80%'), { timeout: 4000 })
    .then(() => true)
    .catch(() => false)
  cek('tanpa lagu: tempo lokal "Latihan 80%"', lokal80)
  cek('tempo presenter 240 → 192 BPM', Math.round(Number(await teks('[data-testid="tempo-presenter"]'))) === 192, await teks('[data-testid="tempo-presenter"]'))
  await klik('[data-testid="podium-tab-huruf"]')
  cek('tanpa lagu: huruf latihan meminta tautan lagu', (await teks('[data-testid="panel-podium"]')).includes('Tautkan drill ke lagu'))
  await klik('[data-testid="presenter-tempo-asli"]')
  await wait(300)
  cek('Tempo asli mengembalikan 100%', !(await ada('[data-testid="presenter-latihan"]')) && Math.round(Number(await teks('[data-testid="tempo-presenter"]'))) === 240)

  /* ====================== 8b. HP tegak 360 px ====================== */
  await p.setViewport({ width: 360, height: 760 })
  await wait(600)
  const tegak = await p.evaluate(() => {
    const k = document.querySelector('[data-testid="kanvas-presenter"]').getBoundingClientRect()
    const a = document.querySelector('[data-testid="aside-podium"]').getBoundingClientRect()
    return {
      bawah: a.top >= k.bottom - 1,
      gulir: document.documentElement.scrollWidth <= window.innerWidth,
      kanvasTinggi: k.height,
    }
  })
  cek('HP tegak: panel di bawah lapangan', tegak.bawah && tegak.kanvasTinggi > 80, JSON.stringify(tegak))
  cek('HP tegak: tanpa gulir mendatar (360 px)', tegak.gulir)
  if (FOTO) await p.screenshot({ path: `${FOTO}/podium-tegak.png` })
  await klik('[data-testid="podium-plakat-reset"]')
  await p.waitForSelector('[data-testid="plakat-podium"]', { timeout: 4000 })
  cek(
    'HP tegak: plakat tetap muat lebar layar',
    await p.$$eval('[data-testid="plakat-baris"]', (xs) => xs.every((b) => b.getBoundingClientRect().width <= window.innerWidth + 1)),
  )
  await klik('[data-testid="plakat-podium"]')

  cek('nol galat konsol', errors.length === 0, errors.slice(0, 3).join(' | '))
} catch (e) {
  gagal.push('pengecualian: ' + (e?.stack || e))
  console.log('  ✗ pengecualian: ' + (e?.stack || e))
} finally {
  await browser.close()
}

console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) {
  for (const g of gagal) console.log('  ✗ ' + g)
  process.exit(1)
}
