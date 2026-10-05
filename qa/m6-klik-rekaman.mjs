/**
 * M6 — klik metronom seiring rekaman lagu (uji peramban, berasumsi).
 *
 * Mengapa ada: pelatih melaporkan "klik ku melambat atau terlambat" saat
 * metronom diputar bersama rekaman. Rekaman uji di sini dibuat sendiri (WAV
 * dengan ketukan tepat setiap 60/BPM detik), jadi posisi ketukannya diketahui
 * sampai milidetik — tidak ada yang perlu dipercaya begitu saja.
 *
 * Yang diperiksa:
 *   1. rekaman diputar pada laju yang sepadan dengan tempo latihan
 *      (`playbackRate` mode BPM — cacat yang membuat klik dan lagu berpisah
 *      2,7 detik dalam 25 detik);
 *   2. klik tidak mulai sebelum rekaman benar-benar berbunyi;
 *   3. setiap klik berbunyi di ketukan rekamannya (±50 ms), tanpa hanyut
 *      dari awal ke akhir lagu.
 *
 * Skenario dijalankan bergantian: `dasar` (tempo asli) dan `bpm` (tempo
 * latihan −20 BPM, yaitu cacat yang dilaporkan).
 *
 * Pakai: BASE=http://localhost:4173 node m6-klik-rekaman.mjs
 */
import fs from 'node:fs'
import puppeteer from 'puppeteer'
import { lewatSambutan } from './sambutan.mjs'
import { segar } from './db-mentah.mjs'

const BASE = process.env.BASE || process.argv[2] || 'http://localhost:4173'
const BPM = 172
const BEAT = 60 / BPM
const TITIK_MULAI = 0.5
const DURASI = 40
const SONG = 'uji-klik-rekaman'
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
  uji(nama, ok, `dapat ${aktual}${satuan}, harap ${harap}±${tol}${satuan}`)
}

/* ------------------------- penanaman data (di halaman) --------------------- */
async function tanamDiHalaman(arg) {
  const { db, songId, bpm, beat, titikMulai, durasi } = arg

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
    const blob = bikinWav()
    await jalan('songs', (s) =>
      s.put({
        id: songId,
        title: 'UJI Klik x Rekaman',
        bpm,
        beats: 4,
        key: '',
        notes: '',
        tempoMap: [],
        createdAt: Date.now(),
        tandaBirama: { pembilang: 4, penyebut: 4, kelompok: [1, 1, 1, 1], acuan: { nilai: 4, titik: false } },
        panjangBirama: 64,
        ulang: 0,
        volume: 0.8,
        suara: 'klik',
        getar: 0,
        hitungMundur: { on: false, ulang: 1, tiapNot: false, suara: 'bel' },
        rekaman: {
          namaFile: 'uji-klik.wav',
          tipe: 'audio/wav',
          ukuran: blob.size,
          durasi,
          hash: 'uji',
          titikMulaiDetik: titikMulai,
          volumeAudio: 1,
          volumeKlik: 1,
          modeBunyi: 'keduanya',
        },
      }),
    )
    await jalan('rekamanAudio', (s) =>
      s.put({
        id: songId,
        songId,
        blob,
        namaFile: 'uji-klik.wav',
        tipe: 'audio/wav',
        ukuran: blob.size,
        durasi,
        hash: 'uji',
        updatedAt: Date.now(),
      }),
    )
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
/*
 * Pustaka Chrome cadangan. Dulu bawaannya `/tmp/br/lib` saja — alamat yang
 * hanya benar di satu kotak pasir lama; `qa/pulihkan.sh` menyiapkannya di
 * `/home/user/chrome-lib`. Karena itu `/tmp` juga tidak ikut snapshot,
 * direktori pertama yang ada dipakai, dan `CHROME_LIB` tetap menang.
 */
const LIB =
  process.env.CHROME_LIB ||
  ['/home/user/chrome-lib', '/tmp/br/lib'].find((d) => fs.existsSync(d)) ||
  '/tmp/br/lib'
const LAMA = Number(process.env.LAMA_UKUR || 12)

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

  // Tiap `start()` oscillator dicatat bersama jam AudioContext dan posisi
  // rekaman saat itu: dari situ posisi rekaman ketika klik berbunyi dihitung.
  await p.evaluateOnNewDocument(() => {
    window.__klik = []
    window.__audio = null
    const AsliOsc = AudioContext.prototype.createOscillator
    AudioContext.prototype.createOscillator = function (...a) {
      const osc = AsliOsc.apply(this, a)
      const startAsli = osc.start.bind(osc)
      osc.start = (t) => {
        window.__klik.push({
          t: t === undefined ? this.currentTime : t,
          ctxNow: this.currentTime,
          a: window.__audio ? window.__audio.currentTime : null,
          rate: window.__audio ? window.__audio.playbackRate : 1,
          paused: window.__audio ? window.__audio.paused : null,
        })
        return startAsli(t)
      }
      return osc
    }
    const playAsli = HTMLMediaElement.prototype.play
    HTMLMediaElement.prototype.play = function (...a) {
      window.__audio = this
      return playAsli.apply(this, a)
    }
  })

  await p.goto(BASE, { waitUntil: 'networkidle2' })
  await lewatSambutan(p)

  const tempo = skenario === 'bpm' ? { mode: 'bpm', persen: 100, geser: -20 } : { mode: 'persen', persen: 100, geser: 0 }
  await p.evaluate((id, t) => localStorage.setItem('drillkit.tempoLatihan.v1', JSON.stringify({ [id]: { tempo: t } })), SONG, tempo)

  const tanam = await p.evaluate(tanamDiHalaman, {
    db: 'drillkit',
    songId: SONG,
    bpm: BPM,
    beat: BEAT,
    titikMulai: TITIK_MULAI,
    durasi: DURASI,
  })
  if (!tanam?.ok) {
    await browser.close()
    throw new Error(`gagal menanam data uji: ${tanam?.alasan}`)
  }

  await segar(p, 2000)
  await p.goto(`${BASE}/#/musik`, { waitUntil: 'networkidle2' })
  await wait(1200)
  const dipilih = await p.evaluate((id) => {
    const el = document.querySelector(`[data-testid="pilih-lagu-${id}"]`)
    if (!el) return false
    el.click()
    return true
  }, SONG)
  if (!dipilih) {
    await browser.close()
    throw new Error('lagu uji tidak ketemu di daftar Musik')
  }
  await wait(400)
  await p.click('[data-testid="tombol-mulai"]')
  await wait(LAMA * 1000)

  const data = await p.evaluate(() => ({
    klik: window.__klik,
    rate: window.__audio ? window.__audio.playbackRate : 0,
    err: window.__audio ? (window.__audio.error?.message ?? null) : 'tidak ada elemen audio',
  }))
  await browser.close()
  return { ...data, errors }
}

/** Selisih posisi rekaman terhadap ketukan yang seharusnya, per klik. */
function selisihPerKlik(klik) {
  const terpakai = klik.filter((k) => k.a != null && !k.paused && k.a > 0).sort((a, b) => a.t - b.t)
  const buang = klik.length - terpakai.length
  const baris = terpakai.map((k, i) => {
    const pos = k.a + (k.t - k.ctxNow) * k.rate
    return { i, selisihMs: (pos - (TITIK_MULAI + i * BEAT)) * 1000 }
  })
  return { terpakai, buang, baris }
}
const rata = (x) => (x.length ? x.reduce((s, b) => s + b.selisihMs, 0) / x.length : 0)

console.log(`\n=== M6 klik seiring rekaman — ${BASE} ===`)

for (const skenario of ['dasar', 'bpm']) {
  console.log(`\n— skenario: ${skenario} —`)
  const hasil = await jalankan(skenario)
  const { baris, buang } = selisihPerKlik(hasil.klik)

  uji('rekaman termuat tanpa galat', hasil.err === null, String(hasil.err))
  uji('klik terjadwal sesudah rekaman dibunyikan', baris.length >= 10, `${baris.length} klik`)
  uji('tidak ada klik yang dijadwalkan sebelum rekaman berbunyi', buang === 0, `${buang} klik terlalu awal`)

  if (skenario === 'dasar') {
    dekat('laju rekaman = 1 (tanpa tempo latihan)', hasil.rate, 1, 1e-6, 'x')
  } else {
    // Inilah cacat yang dilaporkan: 172 BPM @ −20 sementara rekaman tetap
    // 1,0 membuat klik dan lagu berpisah makin jauh tiap ketukan.
    dekat('laju rekaman = tempo latihan / tempo asli', hasil.rate, 152 / 172, 1e-6, 'x')
  }

  // Ketukan pertama boleh meleset sekejap (klik "ikut bergabung" dengan
  // rekaman yang sudah berjalan); selebihnya harus rapat.
  const sesudah = baris.slice(1)
  const maks = sesudah.reduce((m, b) => Math.max(m, Math.abs(b.selisihMs)), 0)
  uji('tiap klik dalam ±50 ms dari ketukan rekaman', maks <= 50, `maks ${maks.toFixed(1)} ms`)

  const awal = rata(baris.slice(1, 5))
  const akhir = rata(baris.slice(-4))
  uji('tidak hanyut dari awal ke akhir', Math.abs(akhir - awal) <= 40, `${awal.toFixed(1)} → ${akhir.toFixed(1)} ms`)

  const errNyata = hasil.errors.filter((e) => !/favicon|Download the React/i.test(e))
  uji('tidak ada error konsol', errNyata.length === 0, errNyata.slice(0, 2).join(' | '))
}

console.log(`\n=== ${lulus} lulus, ${gagal} gagal ===`)
process.exit(gagal > 0 ? 1 : 0)
