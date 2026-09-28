/**
 * M6 lanjutan — rekaman lagu di pemutar drill (editor & presenter).
 *
 * Mengapa ada: waktu "klik melambat saat diputar bersama lagu" diperbaiki,
 * ditemukan cacat sekelas di pemutar drill — `PetaSet.detik` (LAMA sebuah
 * set) dipakai sebagai **titik mulai** rekaman, dan posisi rekaman dihitung
 * dengan tempo latihan alih-alih tempo partitur. Akibatnya rekaman melompat
 * ke tempat yang salah begitu drill punya lebih dari satu set; makin tidak
 * sama panjang set-setnya, makin jauh melesetnya.
 *
 * Uji peramban ini karena cacatnya hanya muncul dari rangkaian utuh
 * (db → tautan lagu → petaSet → posisi rekaman), bukan di fungsi murni.
 * Rekaman uji dibuat sendiri: WAV @120 BPM, ketukan pertama di `TITIK_MULAI`.
 *
 * Bentuk uji: tiga set dengan lama BERBEDA (8 s, 16 s, 8 s pada 120 BPM),
 * supaya "lama set" dan "titik mulai set" tidak mungkin tertukar lagi.
 *
 *   set 0: detikMulai  0 → rekaman mulai di 0,5 s
 *   set 1: detikMulai  8 → rekaman mulai di 8,5 s
 *   set 2: detikMulai 24 → rekaman mulai di 24,5 s
 *
 * Skenario:
 *   dasar — tanpa tempo latihan, laju rekaman harus 1
 *   bpm   — tempo latihan mode BPM (−20 → 100 BPM), laju harus 100/120
 *
 * Pakai: BASE=http://localhost:4173 node m6-drill-rekaman.mjs
 */
import fs from 'node:fs'
import puppeteer from 'puppeteer'
import { lewatSambutan } from './sambutan.mjs'
import { segar } from './db-mentah.mjs'

const BASE = process.env.BASE || process.argv[2] || 'http://localhost:4173'
const BPM = 120
const TITIK_MULAI = 0.5
const BEAT = 60 / BPM
const DURASI = 60
const BEATS_PER_COUNT = 2
const COUNTS = [8, 16, 8]
const SONG = 'uji-drill-rekaman'
const DRILL = 'uji-drill-rekaman'

/** Lama tiap set dalam detik partitur: counts × beatsPerCount × 60/BPM. */
const DETIK = COUNTS.map((c) => (c * BEATS_PER_COUNT * 60) / BPM)
/** Titik mulai tiap set di lini masa lagu — jumlah lama set sebelumnya. */
const MULAI_SET = [0, ...DETIK.slice(0, -1).reduce((ak, d) => (ak.push((ak.at(-1) ?? 0) + d), ak), [])]
/** Ujung lini masa drill — harus masuk ke dalam durasi rekaman uji. */
const UJUNG = MULAI_SET[MULAI_SET.length - 1] + DETIK[DETIK.length - 1]
if (UJUNG + TITIK_MULAI > DURASI) throw new Error('rekaman uji terlalu pendek untuk lini masa drill')

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

let lulus = 0
let gagal = 0
function uji(nama, ok, detail = '') {
  if (ok) {
    lulus++
    console.log('  ✓ ' + nama)
  } else {
    gagal++
    console.log('  ✗ ' + nama + (detail ? ' → ' + detail : ''))
  }
}
function dekat(nama, aktual, harap, tol, satuan = '') {
  const ok = Number.isFinite(aktual) && Math.abs(aktual - harap) <= tol
  uji(nama, ok, `dapat ${aktual === null ? 'null' : Number(aktual).toFixed(3)}${satuan}, harap ${harap}±${tol}${satuan}`)
}

/* ------------------------- penanaman data (di halaman) --------------------- */

/**
 * Semua baris ditulis mentah ke IndexedDB, termasuk blob rekaman: bundel yang
 * sudah dibangun tidak punya `/src/db/db.ts` untuk diimpor (N8/N14).
 */
async function tanamDiHalaman(arg) {
  const { db, songId, drillId, bpm, beat, titikMulai, durasi, counts, beatsPerCount } = arg

  function bikinWav() {
    const sr = 44100
    const n = Math.floor(sr * durasi)
    const buf = new ArrayBuffer(44 + n * 2)
    const v = new DataView(buf)
    const tulis = (pos, teks) => {
      for (let i = 0; i < teks.length; i++) v.setUint8(pos + i, teks.charCodeAt(i))
    }
    tulis(0, 'RIFF')
    v.setUint32(4, 36 + n * 2, true)
    tulis(8, 'WAVE')
    tulis(12, 'fmt ')
    v.setUint32(16, 16, true)
    v.setUint16(20, 1, true)
    v.setUint16(22, 1, true)
    v.setUint32(24, sr, true)
    v.setUint32(28, sr * 2, true)
    v.setUint16(32, 2, true)
    v.setUint16(34, 16, true)
    tulis(36, 'data')
    v.setUint32(40, n * 2, true)
    for (let k = 0; k * beat + titikMulai < durasi; k++) {
      const mulai = Math.floor((titikMulai + k * beat) * sr)
      for (let i = 0; i < sr * 0.012 && mulai + i < n; i++) {
        const t = i / sr
        v.setInt16(44 + (mulai + i) * 2, Math.round(Math.sin(2 * Math.PI * 1000 * t) * Math.exp(-t * 300) * 28000), true)
      }
    }
    return new Blob([buf], { type: 'audio/wav' })
  }

  const koneksi = await new Promise((selesai) => {
    const m = indexedDB.open(db)
    m.onsuccess = () => selesai(m.result)
    m.onerror = () => selesai(null)
  })
  if (!koneksi) return { ok: false, alasan: 'basis data belum ada' }

  const jalan = (tabel, fn) =>
    new Promise((selesai, gagal) => {
      const tx = koneksi.transaction(tabel, 'readwrite')
      const r = fn(tx.objectStore(tabel))
      tx.oncomplete = () => selesai(true)
      tx.onerror = () => gagal(tx.error)
      tx.onabort = () => gagal(tx.error)
      if (r) r.onerror = () => gagal(r.error)
    })

  try {
    await jalan('songs', (s) => s.delete(songId))
    await jalan('rekamanAudio', (s) => s.delete(songId))
    await jalan('drills', (s) => s.delete(drillId))
    const blob = bikinWav()
    await jalan('songs', (s) =>
      s.put({
        id: songId,
        title: 'UJI Drill x Rekaman',
        bpm,
        beats: 4,
        key: '',
        notes: '',
        tempoMap: [{ measure: 1, bpm }],
        createdAt: Date.now(),
        tandaBirama: { pembilang: 4, penyebut: 4, kelompok: [1, 1, 1, 1], acuan: { nilai: 4, titik: false } },
        panjangBirama: 64,
        ulang: 0,
        volume: 0.8,
        suara: 'klik',
        getar: 0,
        hitungMundur: { on: false, ulang: 1, tiapNot: false, suara: 'bel' },
        rekaman: {
          namaFile: 'uji-drill.wav',
          tipe: 'audio/wav',
          ukuran: blob.size,
          durasi,
          hash: 'uji',
          titikMulaiDetik: titikMulai,
          volumeAudio: 1,
          volumeKlik: 1,
          modeBunyi: 'rekaman',
        },
      }),
    )
    await jalan('rekamanAudio', (s) =>
      s.put({
        id: songId,
        songId,
        blob,
        namaFile: 'uji-drill.wav',
        tipe: 'audio/wav',
        ukuran: blob.size,
        durasi,
        hash: 'uji',
        updatedAt: Date.now(),
      }),
    )
    await jalan('drills', (s) =>
      s.put({
        id: drillId,
        name: 'Drill Uji Rekaman',
        showTitle: 'Drill Uji Rekaman',
        tempo: bpm,
        beatsPerCount,
        songId,
        rosterIds: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        field: {
          widthYd: 53.33,
          lengthYd: 100,
          endZoneYd: 10,
          gridYd: 5,
          hash: 'ncaa',
          step: '8to5',
          customStepYd: 0.8333,
          showLabels: 1,
          satuan: 'yd',
        },
      }),
    )
    for (let i = 0; i < counts.length; i++) {
      const id = `${drillId}-set-${i}`
      await jalan('sets', (s) =>
        s.put({
          id,
          drillId,
          order: i,
          name: `Set ${i + 1}`,
          counts: counts[i],
          points: {},
          createdAt: Date.now(),
        }),
      )
    }
  } catch (e) {
    koneksi.close()
    return { ok: false, alasan: String(e) }
  }
  koneksi.close()
  return { ok: true }
}

/* --------------------------------- skenario -------------------------------- */
const CHROME =
  process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME || (fs.existsSync('/tmp/chromium') ? '/tmp/chromium' : undefined)
const LIB = process.env.CHROME_LIB || '/tmp/br/lib'

async function jalankan(skenario) {
  const browser = await puppeteer.launch({
    headless: 'new',
    ...(CHROME ? { executablePath: CHROME, env: { ...process.env, LD_LIBRARY_PATH: LIB } } : {}),
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required', '--mute-audio'],
  })
  const errors = []
  const p = await browser.newPage()
  await p.setViewport({ width: 1280, height: 1000 })
  p.on('pageerror', (e) => errors.push(String(e)))
  p.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })

  /*
   * Rekaman drill diputar lewat elemen `<audio>` milik `PemutarRekaman`.
   * Tiap `play()` dicatat bersama waktu & posisinya: dari situ posisi awal
   * rekaman dan lajunya dibaca tanpa menebak.
   */
  await p.evaluateOnNewDocument(() => {
    window.__play = []
    window.__audio = null
    const playAsli = HTMLMediaElement.prototype.play
    HTMLMediaElement.prototype.play = function (...a) {
      window.__audio = this
      window.__play.push({ t: performance.now(), ct: this.currentTime, rate: this.playbackRate })
      const hasil = playAsli.apply(this, a)
      /*
       * Penangan kosong di bawah menandai penolakan `play()` sebagai
       * "sudah ditangani". Aplikasi sendiri juga menanganinya (mode bunyi
       * bisa saja menolak sebelum rekaman siap); tanpa ini, penolakan yang
       * sama kadang muncul sebagai galat konsol dan menggagalkan
       * pemeriksaan "tidak ada error konsol" karena sebab yang salah.
       */
      if (hasil && hasil.catch) hasil.catch(() => {})
      return hasil
    }
  })

  await p.goto(BASE, { waitUntil: 'networkidle2' })
  await lewatSambutan(p)

  const tempo = skenario === 'bpm' ? { mode: 'bpm', persen: 100, geser: -20 } : { mode: 'persen', persen: 100, geser: 0 }
  await p.evaluate(
    (id, t) => localStorage.setItem('drillkit.tempoLatihan.v1', JSON.stringify({ [id]: { tempo: t } })),
    SONG,
    tempo,
  )

  const tanam = await p.evaluate(tanamDiHalaman, {
    db: 'drillkit',
    songId: SONG,
    drillId: DRILL,
    bpm: BPM,
    beat: BEAT,
    titikMulai: TITIK_MULAI,
    durasi: DURASI,
    counts: COUNTS,
    beatsPerCount: BEATS_PER_COUNT,
  })
  if (!tanam?.ok) {
    await browser.close()
    throw new Error(`gagal menanam data uji: ${tanam?.alasan}`)
  }
  await segar(p, 2000)

  /* ------------------------------ alat bantu ------------------------------- */

  /** Pilih set aktif dari strip set (chip berisi nama + keterangan). */
  async function pilihSet(nama) {
    const ok = await p.evaluate((x) => {
      const el = [...document.querySelectorAll('button')].find((b) => b.textContent.includes(x) && b.offsetParent !== null)
      if (el) {
        el.click()
        return true
      }
      return false
    }, nama)
    await wait(600)
    return ok
  }

  /**
   * Geser bilah waktu editor (scrub) dan kembalikan progres yang benar-benar
   * diminta bilahnya.
   *
   * Bilah itu punya dua mode, dan mode terakhir diingat di perangkat:
   * **per hitungan** (langkah bulat, maksimum = jumlah hitungan set ini) atau
   * **bebas** (0..1). Memasang nilai 0,5 pada mode per hitungan tidak berarti
   * setengah jalan — ia dibulatkan ke langkah terdekat. Karena itu nilai yang
   * dipasang dihitung dari mode yang sedang dipakai, lalu progresnya
   * dikembalikan supaya harapannya sama dengan yang benar-benar diminta.
   */
  async function scrub(p0, counts) {
    const hasil = await p.evaluate(
      (v, c) => {
        const el = document.querySelector('[data-testid="garis-waktu"]')
        if (!el) return null
        const perHitungan = Number(el.max) > 1
        const nilai = perHitungan ? Math.round(v * c) : v
        const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
        set.call(el, String(nilai))
        el.dispatchEvent(new Event('input', { bubbles: true }))
        return { perHitungan, nilai }
      },
      p0,
      counts,
    )
    await wait(500)
    if (!hasil) return null
    return hasil.perHitungan ? Number(hasil.nilai) / counts : Number(hasil.nilai)
  }

  /** Semua yang perlu diketahui dari elemen audio, dibaca dalam satu jalan. */
  const bacaAudio = () =>
    p.evaluate(() => ({
      t: performance.now(),
      ada: !!window.__audio,
      ct: window.__audio ? window.__audio.currentTime : null,
      rate: window.__audio ? window.__audio.playbackRate : null,
      paused: window.__audio ? window.__audio.paused : null,
      err: window.__audio ? (window.__audio.error?.message ?? null) : 'tidak ada elemen audio',
      play: window.__play.slice(-1)[0] ?? null,
      baca: document.querySelector('[data-live-count]')?.textContent?.trim() ?? null,
    }))

  await p.goto(`${BASE}/#/drill`, { waitUntil: 'networkidle2' })
  await wait(1600)
  await p.evaluate((nama) => {
    const el = [...document.querySelectorAll('button,a,li,div')].find((b) => b.textContent.trim() === nama && b.offsetParent !== null)
    el?.click()
  }, 'Drill Uji Rekaman')
  await wait(1600)

  const hasil = { editorTerbuka: !!(await p.$('[data-testid="garis-waktu"]')), langkah: [] }

  /* ------------------- 1. editor: set 1 (detikMulai 8 s) ------------------- */

  await pilihSet('Set 2')
  const bacaSet2 = await bacaAudio()
  hasil.langkah.push({ nama: 'set 2 terpilih (16 count)', nilai: bacaSet2.baca, harap: 'Count 0/16' })
  hasil.langkah.push({ nama: 'rekaman belum diputar sebelum tombol main', nilai: bacaSet2.play === null && bacaSet2.paused !== false })

  await p.click('[data-testid="tombol-main"]')
  await wait(900)
  const s1 = await bacaAudio()
  const s2 = (await wait(1200), await bacaAudio())

  hasil.langkah.push({ nama: 'elemen audio ada', nilai: s1.ada })
  hasil.langkah.push({ nama: 'rekaman termuat tanpa galat', nilai: s1.err === null, detail: String(s1.err) })
  hasil.langkah.push({ nama: 'rekaman berbunyi', nilai: s1.paused === false })
  const lajuHarap = skenario === 'bpm' ? 100 / BPM : 1
  hasil.langkah.push({
    nama: 'laju rekaman = tempo latihan / tempo partitur',
    nilai: s1.rate,
    harap: lajuHarap,
    tol: 1e-6,
    satuan: 'x',
  })
  if (s1.play && Number.isFinite(s1.ct)) {
    const awal = s1.ct - ((s1.t - s1.play.t) / 1000) * (s1.rate ?? 1)
    hasil.langkah.push({
      nama: 'posisi awal rekaman = titik mulai + detikMulai set (8,5 s)',
      nilai: awal,
      harap: TITIK_MULAI + MULAI_SET[1],
      tol: 0.4,
      satuan: ' s',
    })
    const hanyut = s2.ct - s1.ct - ((s2.t - s1.t) / 1000) * (s2.rate ?? 1)
    hasil.langkah.push({ nama: 'posisi rekaman tidak hanyut dari laju yang diminta', nilai: hanyut, harap: 0, tol: 0.25, satuan: ' s' })
  } else {
    hasil.langkah.push({ nama: 'posisi awal rekaman = titik mulai + detikMulai set (8,5 s)', nilai: null, harap: TITIK_MULAI + MULAI_SET[1], tol: 0.4 })
  }

  /* --------------- 2. editor: scrub memindah rekaman sesuai set ------------ */

  await p.click('[data-testid="tombol-main"]') // jeda
  await wait(500)
  const pSet2 = await scrub(0.5, COUNTS[1])
  const sc1 = await bacaAudio()
  hasil.langkah.push({ nama: 'bilah waktu bisa digeser', nilai: sc1.ct !== null })
  hasil.langkah.push({
    nama: 'scrub set 2 di tengah = 0,5 s + 8 s + 8 s',
    nilai: sc1.ct,
    harap: TITIK_MULAI + MULAI_SET[1] + pSet2 * DETIK[1],
    tol: 0.3,
    satuan: ' s',
  })

  /* --------------- 3. editor: set terakhir (detikMulai 24 s) --------------- */

  await pilihSet('Set 3')
  const pSet3 = await scrub(0.25, COUNTS[2])
  const sc2 = await bacaAudio()
  hasil.langkah.push({
    nama: 'scrub set 3 = 0,5 s + 24 s + 2 s',
    nilai: sc2.ct,
    harap: TITIK_MULAI + MULAI_SET[2] + pSet3 * DETIK[2],
    tol: 0.3,
    satuan: ' s',
  })

  /* ------------------------ 4. presenter ikut set ini ---------------------- */

  await pilihSet('Set 2')
  const tombol = await p.$('[title*="Mode presenter"]')
  if (tombol) {
    await tombol.click()
    await wait(1300)
    await p.click('[data-testid="presenter-mainkan"]')
    await wait(900)
    const pr = await bacaAudio()
    hasil.langkah.push({ nama: 'presenter memutar rekaman', nilai: pr.play !== null && pr.paused === false })
    if (pr.play && Number.isFinite(pr.ct)) {
      const awal = pr.ct - ((pr.t - pr.play.t) / 1000) * (pr.rate ?? 1)
      hasil.langkah.push({
        nama: 'presenter mulai di titik mulai set (8,5 s)',
        nilai: awal,
        harap: TITIK_MULAI + MULAI_SET[1],
        tol: 0.4,
        satuan: ' s',
      })
    }
    hasil.langkah.push({
      nama: 'presenter memakai laju tempo latihan',
      nilai: pr.rate,
      harap: lajuHarap,
      tol: 1e-6,
      satuan: 'x',
    })
    await p.click('[data-testid="tutup-presenter"]').catch(() => {})
    await wait(600)
  } else {
    hasil.langkah.push({ nama: 'tombol mode presenter ada', nilai: false })
  }

  await browser.close()
  return { ...hasil, errors }
}

/* ---------------------------------- laporan -------------------------------- */
console.log(`\n=== M6 drill x rekaman — ${BASE} ===`)
console.log(
  `    ${COUNTS.length} set · ${DETIK.join('/')} s · mulai ${MULAI_SET.join('/')} s (+${TITIK_MULAI} s) · ${BPM} BPM @ ${BEATS_PER_COUNT} ketuk/hitungan`,
)

for (const skenario of ['dasar', 'bpm']) {
  console.log(`\n— skenario: ${skenario} —`)
  const hasil = await jalankan(skenario)
  uji('editor drill terbuka dengan bilah waktu', hasil.editorTerbuka)
  for (const l of hasil.langkah) {
    if (l.tol !== undefined) dekat(l.nama, l.nilai, l.harap, l.tol, l.satuan ?? '')
    else if (l.harap !== undefined && typeof l.nilai === 'string') uji(l.nama, l.nilai === l.harap, `dapat ${l.nilai}, harap ${l.harap}`)
    else uji(l.nama, !!l.nilai, l.detail ?? '')
  }
  const errNyata = hasil.errors.filter((e) => !/favicon|Download the React|React DevTools/i.test(e))
  uji('tidak ada error konsol', errNyata.length === 0, errNyata.slice(0, 2).join(' | '))
}

console.log(`\n=== ${lulus} lulus, ${gagal} gagal ===`)
process.exit(gagal > 0 ? 1 : 0)
