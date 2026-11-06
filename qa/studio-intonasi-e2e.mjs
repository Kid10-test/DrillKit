/**
 * #29 — Studio Intonasi & Ketuk Presisi: uji peramban ujung ke ujung.
 *
 * Logika murninya diuji di `studio-intonasi-logika.mjs`. Di sini sambungannya:
 *
 *   1. Penala + mikrofon tiruan (nada bertiup ber-scoop & ekor turun):
 *      jarum, grafik jejak nada bergulir, tahan stabil, catatan scoop &
 *      ekor, 3 jenjang toleransi (pita hijau melebar/menyempit, tersimpan).
 *   2. Peta kecenderungan nada: mikrofon memainkan tangga Bb mayor dengan
 *      selisih yang diketahui → peta terekam otomatis per nada, tersimpan,
 *      tampil sesudah muat ulang, kartu A6/A5 tercetak (#hex saja).
 *   3. Spektrum klik lapangan (OfflineAudioContext): Dr. Beat / Cowbell /
 *      Rim berenergi di 2,5–4 kHz & lebih nyaring dari klik biasa; hitung
 *      bernada naik setangga & "siap-" ganda.
 *   4. Metronom: lagu lama ber-suara "bel" terbaca Cowbell; hitung mundur
 *      bernada (tanpa TTS); birama hening 1+1 benar-benar membisu;
 *      pelatih ketuk mengukur −20 ms (bunyi) vs −60 ms (hening) → vonis.
 *   5. Kuis Show anggota: pilihan ganda dari paket sendiri, skor & rekap.
 *   6. Lebar HP 360 px tanpa gulir mendatar; nol galat konsol.
 *
 * Pakai: bash qa/bangun-logika.sh && BASE=http://localhost:4173 node qa/studio-intonasi-e2e.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'
import { lewatSambutan } from './sambutan.mjs'
import { paketAnggota } from '/tmp/bagikan.mjs'

const QA = path.dirname(fileURLToPath(import.meta.url))
const AKAR = path.resolve(QA, '..')
const BASE = process.env.BASE || process.argv[2] || 'http://localhost:4173'
const BERKAS = path.join(QA, 'berkas-intonasi')
fs.rmSync(BERKAS, { recursive: true, force: true })
fs.mkdirSync(BERKAS, { recursive: true })

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
const pilih = async (hal, sel, nilai) => {
  await hal.waitForSelector(sel, { timeout: 12000 })
  await hal.select(sel, nilai)
}
const angka = (s) => Number(String(s).replace(/[^\d,.\-−+]/g, '').replace('−', '-').replace(',', '.'))

/* ------------------------------------------------------------------ */
/* WAV sintetis 48 kHz mono 16-bit, fase bersambung.                    */
const SR = 48000
function tulisWav(berkas, frekuensi /* (t) => Hz | 0 */, detik) {
  const n = Math.round(SR * detik)
  const data = Buffer.alloc(n * 2)
  let fase = 0
  for (let i = 0; i < n; i++) {
    const f = frekuensi(i / SR)
    let v = 0
    if (f > 0) {
      fase += (2 * Math.PI * f) / SR
      v = 0.55 * Math.sin(fase) + 0.18 * Math.sin(2 * fase) + 0.07 * Math.sin(3 * fase)
    }
    data.writeInt16LE(Math.round(v * 0.8 * 32767), i * 2)
  }
  const h = Buffer.alloc(44)
  h.write('RIFF', 0)
  h.writeUInt32LE(36 + data.length, 4)
  h.write('WAVE', 8)
  h.write('fmt ', 12)
  h.writeUInt32LE(16, 16)
  h.writeUInt16LE(1, 20)
  h.writeUInt16LE(1, 22)
  h.writeUInt32LE(SR, 24)
  h.writeUInt32LE(SR * 2, 28)
  h.writeUInt16LE(2, 32)
  h.writeUInt16LE(16, 34)
  h.write('data', 36)
  h.writeUInt32LE(data.length, 40)
  fs.writeFileSync(berkas, Buffer.concat([h, data]))
}
const hz = (midi, sen = 0, a4 = 440) => a4 * 2 ** ((midi - 69 + sen / 100) / 12)

// Tiupan Bb3 konser: scoop −35 sen (300 ms) → lurus 2,5 dtk → ekor melorot ke −40 sen (500 ms) → hening 0,8 dtk.
const fScoop = path.join(BERKAS, 'tiupan-scoop.wav')
tulisWav(
  fScoop,
  (t) => {
    if (t < 0.3) return hz(58, -35 * (1 - t / 0.3))
    if (t < 2.8) return hz(58)
    if (t < 3.3) return hz(58, -40 * ((t - 2.8) / 0.5))
    return 0
  },
  4.1,
)
// Tangga Bb mayor (MIDI 58…70) dengan selisih yang diketahui; tiap nada 2,3 dtk + jeda 0,3 dtk.
const SELISIH = [2, -9, 13, 0, -3, 6, -16, 4]
const NADA_BB = [58, 60, 62, 63, 65, 67, 69, 70]
const fTangga = path.join(BERKAS, 'tangga-bb.wav')
tulisWav(
  fTangga,
  (t) => {
    const k = Math.floor(t / 2.6)
    const u = t - k * 2.6
    if (k >= 8 || u > 2.3) return 0
    return hz(NADA_BB[k], SELISIH[k])
  },
  8 * 2.6,
)

const errors = []
const ABAIKAN = /favicon|Failed to load resource|net::ERR|AudioContext was not allowed/i
async function luncurkan(wav) {
  const args = [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--autoplay-policy=no-user-gesture-required',
  ]
  if (wav) args.push('--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${wav}`)
  return puppeteer.launch({ args, defaultViewport: { width: 1360, height: 1000 } })
}
async function halamanBaru(browser, label, mode = 'coach') {
  const p = await browser.newPage()
  p.on('console', (x) => {
    if (x.type() === 'error' && !ABAIKAN.test(x.text())) errors.push(`[${label}] ${x.text()}`)
  })
  p.on('pageerror', (e) => errors.push(`[${label}] ${String(e)}`))
  p.on('dialog', async (d) => {
    await d.accept()
  })
  // Tangkap jendela cetak (tanpa membuka dialog cetak sungguhan).
  await p.evaluateOnNewDocument(() => {
    window.__cetak = []
    window.open = () => {
      const isi = []
      return {
        document: { write: (h) => isi.push(h), close: () => window.__cetak.push(isi.join('')) },
        focus() {},
        setTimeout() {},
        print() {},
      }
    }
  })
  await p.goto(BASE, { waitUntil: 'networkidle2' })
  await lewatSambutan(p, mode)
  return p
}
async function keMusik(p) {
  await p.goto(`${BASE}/#/musik`, { waitUntil: 'networkidle2' })
  await p.waitForSelector('[data-testid="kartu-penala"]', { timeout: 20000 })
  await wait(800)
}

let b1, b2, b3
try {
  /* ================================================================ */
  console.log('\n1. Penala: grafik kestabilan & tiga jenjang toleransi')
  b1 = await luncurkan(fScoop)
  const p = await halamanBaru(b1, 'penala')
  await keMusik(p)
  cek('panel kestabilan tampil sebelum mikrofon menyala', await ada(p, '[data-testid="panel-kestabilan"]'))
  cek('jenjang bawaan Menengah (±8)', (await p.$eval('[data-testid="toleransi-menengah"]', (e) => e.getAttribute('aria-checked'))) === 'true')
  const lebarPita = () => p.$eval('[data-testid="pita-toleransi"]', (e) => parseFloat(e.style.width))
  cek('pita hijau ±8 sen = 16% lebar skala', (await lebarPita()) === 16, String(await lebarPita()))
  await klik(p, '[data-testid="tombol-mikrofon"]')
  await p.waitForFunction(() => /Bb|A#/.test(document.querySelector('[data-testid="nada-konser"]')?.textContent ?? document.querySelector('[data-testid="nada-terdeteksi"]')?.textContent ?? ''), { timeout: 15000 }).catch(() => {})
  await wait(9500)
  const titik = await p.$eval('[data-testid="grafik-jejak-nada"]', (e) => Number(e.dataset.titik))
  cek('grafik jejak nada terisi (> 60 cuplikan)', titik > 60, String(titik))
  const catatan = await teks(p, '[data-testid="catatan-intonasi"]')
  cek('diagnosis: scoop terdeteksi', /scoop/i.test(catatan), catatan)
  cek('diagnosis: ekor nada turun terdeteksi', /Ekor nada turun/.test(catatan), catatan)
  const terbaik = angka(await teks(p, '[data-testid="tahan-terbaik"]'))
  cek('tahan stabil terbaik ≈ 2–3 dtk', terbaik >= 1.6 && terbaik <= 3.4, String(terbaik))
  const persenMenengah = angka(await teks(p, '[data-testid="persen-dalam"]'))
  // Grafik kanvas benar-benar tergambar (ada piksel hijau garis/pita).
  const piksel = await p.$eval('[data-testid="grafik-jejak-nada"]', (c) => {
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data
    let hijau = 0
    for (let i = 0; i < d.length; i += 4) if (d[i + 1] > 150 && d[i] < 80 && d[i + 2] > 90 && d[i + 2] < 160) hijau++
    return hijau
  })
  cek('kanvas jejak menggambar garis hijau (#10b981)', piksel > 30, String(piksel))

  await klik(p, '[data-testid="toleransi-mahir"]')
  await wait(400)
  cek('Mahir/DCI: pita menyempit ke 6%', (await lebarPita()) === 6, String(await lebarPita()))
  const persenMahir = angka(await teks(p, '[data-testid="persen-dalam"]'))
  cek('Mahir lebih ketat → % dalam toleransi tidak naik', persenMahir <= persenMenengah, `${persenMahir} vs ${persenMenengah}`)
  await klik(p, '[data-testid="toleransi-pemula"]')
  await wait(300)
  cek('Pemula: pita ±15 = 30%', (await lebarPita()) === 30)
  await p.reload({ waitUntil: 'networkidle2' })
  await p.waitForSelector('[data-testid="toleransi-pemula"]', { timeout: 15000 })
  cek('jenjang toleransi diingat sesudah muat ulang', (await p.$eval('[data-testid="toleransi-pemula"]', (e) => e.getAttribute('aria-checked'))) === 'true')
  await b1.close()
  b1 = null

  /* ================================================================ */
  console.log('\n2. Peta kecenderungan nada (tangga Bb mayor dari mikrofon)')
  b2 = await luncurkan(fTangga)
  const q = await halamanBaru(b2, 'peta')
  await keMusik(q)
  await pilih(q, '[data-testid="pilih-transposisi"]', 'bb')
  await klik(q, '[data-testid="buat-peta-nada"]')
  await q.type('[data-testid="nama-peta"]', 'Rani — Trumpet 2')
  await pilih(q, '[data-testid="tangga-peta"]', 'bb-mayor')
  await pilih(q, '[data-testid="wilayah-peta"]', 'tengah')
  await klik(q, '[data-testid="mulai-peta-nada"]')
  await q.waitForSelector('[data-testid="sasaran-peta"]', { timeout: 8000 })
  const sasaran1 = (await teks(q, '[data-testid="sasaran-peta"]')) + ' / ' + (await teks(q, '[data-testid="sasaran-konser-peta"]'))
  cek('sasaran pertama: C4 tertulis (konser Bb3) untuk trumpet Bb', /^C4 \/ konser Bb3$/.test(sasaran1), sasaran1)
  cek('langkah 1 dari 8', /1\D+8/.test(await teks(q, '[data-testid="langkah-peta"]')), await teks(q, '[data-testid="langkah-peta"]'))
  await q.waitForSelector('[data-testid="hasil-peta-nada"]', { timeout: 70000 })
  const baris = {}
  for (const m of NADA_BB) {
    baris[m] = (await ada(q, `[data-testid="baris-peta-${m}"]`))
      ? await q.$$eval(`[data-testid="baris-peta-${m}"] td`, (td) => td.map((x) => x.textContent.trim()).join(' | '))
      : ''
  }
  const senBaris = (m) => Number((baris[m].split(' | ')[1] ?? '').replace('¢', '').replace('−', '-'))
  cek('8 nada terekam otomatis', NADA_BB.every((m) => baris[m]), JSON.stringify(baris))
  const meleset = NADA_BB.map((m, i) => Math.abs(senBaris(m) - SELISIH[i]))
  cek('selisih tiap nada ±3 sen dari yang dimainkan', meleset.every((d) => d <= 3), JSON.stringify(NADA_BB.map(senBaris)))
  cek('nada A (−16) ditandai rendah', /rendah/i.test(baris[69]), baris[69])
  cek('baris memakai nada tertulis (B4 untuk A4 konser)', /B4/.test(baris[69]), baris[69])
  await klik(q, '[data-testid="cetak-peta-a6"]')
  await wait(1200)
  const cetak = await q.evaluate(() => window.__cetak)
  cek('cetak kartu A6 (HTML @page A6, 8 baris)', cetak.length === 1 && /size: A6/.test(cetak[0]) && (cetak[0].match(/<tr>/g) ?? []).length === 9, String(cetak.length))
  cek('kartu murni #hex (tanpa rgba/oklch)', cetak[0] && !/rgba\(|oklch\(/.test(cetak[0]))
  await klik(q, '[data-testid="cetak-peta-a5"]')
  await wait(1200)
  cek('cetak A5', (await q.evaluate(() => window.__cetak.length)) === 2 && /size: A5/.test(await q.evaluate(() => window.__cetak[1])))
  await q.reload({ waitUntil: 'networkidle2' })
  await q.waitForSelector('[data-testid="daftar-peta-nada"]', { timeout: 15000 })
  cek('peta tersimpan di perangkat (muncul sesudah muat ulang)', /Rani — Trumpet 2/.test(await teks(q, '[data-testid="daftar-peta-nada"]')))
  await b2.close()
  b2 = null

  /* ================================================================ */
  console.log('\n3. Spektrum klik lapangan & hitung bernada (OfflineAudioContext)')
  b3 = await luncurkan(null)
  const r = await halamanBaru(b3, 'metronom')
  const iife = execFileSync(path.join(AKAR, 'node_modules/.bin/esbuild'), [
    'src/lib/metronome.ts', '--bundle', '--format=iife', '--global-name=__M', '--log-level=error',
  ], { cwd: AKAR, encoding: 'utf8' })
  await r.addScriptTag({ content: iife })
  const spek = await r.evaluate(async () => {
    const SRx = 48000
    async function render(suara) {
      const ctx = new OfflineAudioContext(1, Math.round(SRx * 0.25), SRx)
      __M.bunyikanKlik(ctx, suara, 0.01, 0.8, true)
      const buf = await ctx.startRendering()
      return buf.getChannelData(0)
    }
    // Energi per pita (Goertzel tiap 100 Hz).
    function pita(x) {
      const N = Math.min(x.length, 8192)
      let total = 0
      let dalam = 0
      let pusat = 0
      for (let f = 100; f <= 12000; f += 100) {
        const w = (2 * Math.PI * f) / SRx
        const c = 2 * Math.cos(w)
        let s1 = 0
        let s2 = 0
        for (let i = 0; i < N; i++) {
          const s0 = x[i] + c * s1 - s2
          s2 = s1
          s1 = s0
        }
        const e = s1 * s1 + s2 * s2 - c * s1 * s2
        total += e
        pusat += e * f
        if (f >= 2500 && f <= 4000) dalam += e
      }
      let puncak = 0
      for (const v of x) puncak = Math.max(puncak, Math.abs(v))
      return { porsi: dalam / total, pusat: pusat / total, puncak }
    }
    const hasil = {}
    for (const s of ['klik', 'kayu', 'drbeat', 'cowbell', 'rim']) hasil[s] = pita(await render(s))
    return hasil
  })
  for (const s of ['drbeat', 'cowbell', 'rim']) {
    cek(`${s}: ≥ 40% energi di 2,5–4 kHz`, spek[s].porsi >= 0.4, JSON.stringify(spek[s]))
    cek(`${s}: puncak lebih nyaring dari klik biasa`, spek[s].puncak > spek.klik.puncak, `${spek[s].puncak.toFixed(2)} vs ${spek.klik.puncak.toFixed(2)}`)
  }
  cek('klik biasa berpusat di bawah 2,5 kHz (pembanding)', spek.klik.porsi < 0.4, JSON.stringify(spek.klik))

  /* ================================================================ */
  console.log('\n4. Metronom: bel→cowbell, hitung bernada, birama hening, uji ketuk')
  await r.evaluate(
    () =>
      new Promise((ok, tolak) => {
        const req = indexedDB.open('drillkit')
        req.onerror = () => tolak(String(req.error))
        req.onsuccess = () => {
          const db = req.result
          const tx = db.transaction('songs', 'readwrite')
          tx.objectStore('songs').put({
            id: 'lagu-bel',
            title: 'Mars Lama Bel',
            bpm: 120,
            beats: 4,
            tempoMap: [],
            createdAt: 1,
            suara: 'bel',
            hitungMundur: { on: true, ulang: 1, tiapNot: false, suara: 'bel' },
          })
          tx.oncomplete = () => {
            db.close()
            ok()
          }
          tx.onerror = () => tolak(String(tx.error))
        }
      }),
  )
  // Mata-mata osilator: catat frekuensi & waktu mulai per AudioContext.
  await r.evaluateOnNewDocument(() => {
    window.__osc = []
    const asli = AudioContext.prototype.createOscillator
    AudioContext.prototype.createOscillator = function () {
      const o = asli.call(this)
      const ctx = this
      const mulai = o.start.bind(o)
      o.start = (when = 0) => {
        window.__osc.push({ f: o.frequency.value, t: when })
        window.__ctxM = ctx
        return mulai(when)
      }
      return o
    }
  })
  await r.reload({ waitUntil: 'networkidle2' })
  await keMusik(r)
  const opsiSuara = await r.$$eval('[data-testid="pilih-suara"] option', (o) => o.map((x) => x.value))
  cek('pilihan bunyi: klik, kayu, snare + 3 klik lapangan; tanpa "bel"', ['drbeat', 'cowbell', 'rim'].every((s) => opsiSuara.includes(s)) && !opsiSuara.includes('bel'), JSON.stringify(opsiSuara))
  cek('grup "Klik lapangan" ada', (await r.$$eval('[data-testid="pilih-suara"] optgroup', (g) => g.map((x) => x.label))).some((l) => /lapangan/i.test(l)))
  await klik(r, '[data-testid="pilih-lagu-lagu-bel"]')
  await wait(800)
  cek('lagu lama "bel" → bunyi Cowbell (lapangan)', (await r.$eval('[data-testid="pilih-suara"]', (e) => e.value)) === 'cowbell')
  cek('hitung mundur lama "bel" → cowbell', (await r.$eval('[data-testid="hm-suara"]', (e) => e.value)) === 'cowbell')
  const opsiHm = await r.$$eval('[data-testid="hm-suara"] option', (o) => o.map((x) => x.value))
  cek('hitung mundur menawarkan "nada" (bernada, tanpa suara HP)', opsiHm.includes('nada') && !opsiHm.includes('bel'), JSON.stringify(opsiHm))

  await pilih(r, '[data-testid="hm-suara"]', 'nada')
  await wait(300)
  cek('keterangan hitung mundur menyebut nada', /nada/i.test(await teks(r, '[data-testid="hm-info"]')), await teks(r, '[data-testid="hm-info"]'))
  await r.evaluate(() => {
    window.__osc = []
  })
  await klik(r, '[data-testid="tombol-mulai"]')
  await wait(2600)
  await klik(r, '[data-testid="tombol-mulai"]')
  await wait(400)
  const fHitung = await r.evaluate(() => window.__osc.map((o) => Math.round(o.f * 100) / 100))
  const butuh = [880, 987.77, 1108.73, 1174.66]
  cek('hitung bernada: 4 nada naik setangga (880 → 1174,66 Hz)', butuh.every((f) => fHitung.some((x) => Math.abs(x - f) < 0.2)), JSON.stringify(fHitung.slice(0, 12)))
  cek('"siap-" ganda: oktaf atas nada terakhir (2349 Hz)', fHitung.some((x) => Math.abs(x - 2349.32) < 0.3))

  // Matikan hitung mundur supaya uji ketuk langsung pada klik.
  if (await ada(r, '[data-testid="hm-suara"]')) await klik(r, '[data-testid="hm-aktif"]')
  await wait(200)
  cek('hitung mundur dimatikan untuk uji ketuk', !(await ada(r, '[data-testid="hm-suara"]')))
  await wait(300)
  await pilih(r, '[data-testid="pilih-suara"]', 'klik')
  await pilih(r, '[data-testid="pilih-hening"]', '1-1')
  await wait(300)
  cek('kartu pelatih ketuk tampil', await ada(r, '[data-testid="kartu-pelatih-ketuk"]'))
  await r.evaluate(() => {
    window.__osc = []
  })
  await klik(r, '[data-testid="mulai-uji-ketuk"]')
  await r.waitForSelector('[data-testid="pad-ketuk"]', { timeout: 6000 })
  // Ketuk otomatis: −20 ms saat klik berbunyi, −60 ms saat birama hening (tempo batin tergesa).
  const jadwal = await r.evaluate(
    () =>
      new Promise((ok) => {
        const tunggu = () => {
          const o = window.__osc.filter((x) => x.t > 0)
          if (!o.length) return setTimeout(tunggu, 5)
          const ctx = window.__ctxM
          const t0 = Math.min(...o.map((x) => x.t))
          const lat = (ctx.outputLatency || 0) || ctx.baseLatency || 0
          const pad = document.querySelector('[data-testid="pad-ketuk"]')
          const sasaran = Array.from({ length: 16 }, (_, k) => {
            const hening = Math.floor(k / 4) % 2 === 1
            return { t: t0 + k * 0.5 + lat + (hening ? -0.06 : -0.02), hening }
          })
          let i = 0
          const status = []
          const batas = performance.now() + 20000
          const id = setInterval(() => {
            if (performance.now() > batas) {
              clearInterval(id)
              ok({ t0, lat, status, telat: -1, macet: i })
              return
            }
            while (i < sasaran.length && ctx.currentTime >= sasaran[i].t) {
              pad.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerType: 'touch' }))
              status.push(document.querySelector('[data-testid="status-hening"]')?.textContent ?? '')
              i++
            }
            if (i >= sasaran.length) {
              clearInterval(id)
              ok({ t0, lat, status, telat: Math.round((ctx.currentTime - sasaran[sasaran.length - 1].t) * 1000) })
            }
          }, 1)
        }
        tunggu()
      }),
  )
  cek('16 ketukan terkirim', /16 ketukan/.test(await teks(r, '[data-testid="jumlah-ketuk"]')), await teks(r, '[data-testid="jumlah-ketuk"]'))
  cek('bantalan berubah ke "birama hening" saat klik diam', jadwal.status.some((s) => /birama hening/.test(s)), JSON.stringify(jadwal.status))
  const klikBirama = await r.evaluate((t0) => window.__osc.filter((o) => o.t >= t0 - 0.001 && o.t < t0 + 7.9).map((o) => Math.round((o.t - t0) * 2)), jadwal.t0)
  cek('birama hening 1+1: hanya birama 1 & 3 berbunyi (8 klik dari 16 ketukan)', JSON.stringify([...new Set(klikBirama)]) === JSON.stringify([0, 1, 2, 3, 8, 9, 10, 11]), JSON.stringify(klikBirama))
  await klik(r, '[data-testid="selesai-uji-ketuk"]')
  await r.waitForSelector('[data-testid="hasil-uji-ketuk"]', { timeout: 6000 })
  const msBunyi = angka(await teks(r, '[data-testid="ketuk-bunyi"]'))
  const msHening = angka(await teks(r, '[data-testid="ketuk-hening"]'))
  cek('rata ketuk saat berbunyi ≈ −20 ms (±15)', Math.abs(msBunyi + 20) <= 15, `${msBunyi} (lat ${jadwal.lat})`)
  cek('rata ketuk saat hening ≈ −60 ms (±15)', Math.abs(msHening + 60) <= 15, String(msHening))
  const vonis = await teks(r, '[data-testid="vonis-ketuk"]')
  cek('vonis: tempo batin terlalu CEPAT saat klik diam', /tempo batin terlalu CEPAT/.test(vonis), vonis)
  cek('grafik ketuk tergambar', await ada(r, '[data-testid="grafik-ketuk"]'))
  cek('metronom berhenti sesudah dinilai', /Mulai/.test(await teks(r, '[data-testid="tombol-mulai"]')), await teks(r, '[data-testid="tombol-mulai"]'))

  await r.setViewport({ width: 360, height: 900 })
  await wait(600)
  const lebar1 = await r.evaluate(() => document.documentElement.scrollWidth)
  cek('Musik tanpa gulir mendatar di 360 px', lebar1 <= 360, String(lebar1))
  await r.setViewport({ width: 1360, height: 1000 })

  /* ================================================================ */
  console.log('\n5. Kuis Show di HP anggota')
  const LAP = { widthYd: 53.33, lengthYd: 100, endZoneYd: 10, hash: 'ncaa', gridYd: 5, step: '8to5', customStepYd: 0.625, showLabels: 1 }
  const dasar = {
    format: 'drillkit-share',
    version: 1,
    exportedAt: Date.now(),
    team: { teamName: 'MB Uji Intonasi', coachName: 'Raka', defaultField: LAP },
    members: [
      { id: 'a1', code: 'A01', name: 'Andra Trumpet', section: 'brass', role: 'member', yearJoined: 2025, active: 1, token: 't1' },
      { id: 'a2', code: 'A02', name: 'Bima', section: 'brass', role: 'member', yearJoined: 2025, active: 1, token: 't2' },
      { id: 'a3', code: 'A03', name: 'Citra', section: 'brass', role: 'member', yearJoined: 2025, active: 1, token: 't3' },
    ],
    sessions: [],
    drills: [{ id: 'd1', name: 'Show Uji', showTitle: 'Show Uji', field: LAP, tempo: 120, beatsPerCount: 1, rosterIds: ['a1', 'a2', 'a3'] }],
    sets: [
      { id: 's1', drillId: 'd1', order: 0, name: 'Set 1', counts: 8, points: { a1: { x: 2, y: 0 }, a2: { x: 6, y: 0 }, a3: { x: 10, y: 0 } } },
      { id: 's2', drillId: 'd1', order: 1, name: 'Set 2', counts: 8, points: { a1: { x: -8, y: 0 }, a2: { x: -4, y: 0 }, a3: { x: 0, y: 0 } }, dress: { acuan: 'kiri' }, visual: { simbol: ['horn_up'] } },
    ],
    songs: [
      { id: 'L1', title: 'Gita Bahari', bpm: 132, beats: 4, tempoMap: [], createdAt: 1 },
      { id: 'L2', title: 'Rayuan Pulau Kelapa', bpm: 96, beats: 3, tempoMap: [], createdAt: 2 },
    ],
    setlists: [{ id: 'SL', name: 'Show Final', songIds: ['L1', 'L2'], createdAt: 1, updatedAt: 1 }],
    attendance: [],
    memberNotes: [],
  }
  const pkt = paketAnggota(dasar, 'a1')
  const fPkt = path.join(BERKAS, 'DrillKit - UNTUK ANGGOTA - Andra Trumpet.json')
  fs.writeFileSync(fPkt, JSON.stringify(pkt))
  const ctx = await b3.createBrowserContext()
  const m = await ctx.newPage()
  m.on('console', (x) => {
    if (x.type() === 'error' && !ABAIKAN.test(x.text())) errors.push('[anggota] ' + x.text())
  })
  m.on('pageerror', (e) => errors.push('[anggota] ' + String(e)))
  m.on('dialog', async (d) => {
    await d.accept()
  })
  await m.goto(BASE, { waitUntil: 'networkidle2' })
  await lewatSambutan(m, 'member')
  await m.goto(`${BASE}/#/berbagi`, { waitUntil: 'networkidle2' })
  await wait(2000)
  await (await m.$('#pkg-input')).uploadFile(fPkt)
  await wait(3000)
  await klik(m, '[data-testid="tab-kuis"]')
  await wait(800)
  cek('tab Kuis punya dua mode', (await ada(m, '[data-testid="mode-kuis-posisi"]')) && (await ada(m, '[data-testid="mode-kuis-show"]')))
  cek('mode bawaan tetap Tebak posisi (peta kuis lama)', await ada(m, '[data-testid="peta-kuis"]'))
  await klik(m, '[data-testid="mode-kuis-show"]')
  await m.waitForSelector('[data-testid="kuis-show"]', { timeout: 6000 })
  const saring = await m.$$eval('[data-testid="saring-kuis-show"] button', (b) => b.map((x) => x.dataset.testid))
  cek('saringan per jenis: xcount, dress, simbol, lagu', ['saring-xcount', 'saring-dress', 'saring-simbol', 'saring-lagu'].every((s) => saring.includes(s)), JSON.stringify(saring))
  const jumlahSoal = Number((await teks(m, '[data-testid="soal-show-ke"]')).match(/dari (\d+)/)?.[1] ?? 0)
  cek('soal show dibuat dari paket sendiri (≥ 8)', jumlahSoal >= 8, String(jumlahSoal))
  // Selalu jawab A; kunci tersebar acak sehingga sebagian benar, sebagian salah.
  for (let i = 0; i < jumlahSoal; i++) {
    await m.waitForSelector('[data-testid="soal-show"]', { timeout: 4000 })
    const n = await m.$$eval('[data-testid^="pilihan-show-"]', (x) => x.length)
    await klik(m, '[data-testid="pilihan-show-0"]')
    await m.waitForSelector('[data-testid="hasil-show"]', { timeout: 3000 })
    if (i === 0) {
      cek('sesudah menjawab: kunci disorot & penjelasan tampil', (await m.$$eval('[data-kunci="1"]', (x) => x.length)) === 1 && (await teks(m, '[data-testid="hasil-show"]')).length > 12)
      cek('pilihan terkunci sesudah dijawab', await m.$eval('[data-testid="pilihan-show-1"]', (e) => e.disabled))
      cek('soal pilihan ganda 2–4 opsi', n >= 2 && n <= 4, String(n))
    }
    await klik(m, '[data-testid="lanjut-kuis-show"]')
  }
  await m.waitForSelector('[data-testid="selesai-kuis-show"]', { timeout: 4000 })
  const skor = await teks(m, '[data-testid="skor-kuis-show"]')
  const benar = Number(skor.match(/Benar (\d+)/)?.[1] ?? -1)
  cek('skor dihitung dari jawaban', new RegExp(`dari ${jumlahSoal}`).test(skor) && benar >= 0 && benar <= jumlahSoal, skor)
  const rekap = await teks(m, '[data-testid="rekap-kuis-show"]')
  cek('rekap per jenis tampil', /Lagu, tempo & sukat/.test(rekap) && /xCount/i.test(rekap), rekap)
  await klik(m, '[data-testid="ulang-kuis-show"]')
  await wait(300)
  cek('Main lagi → kembali ke soal 1', /Soal 1 dari/.test(await teks(m, '[data-testid="soal-show-ke"]')))
  await m.setViewport({ width: 360, height: 800 })
  await wait(500)
  const lebar2 = await m.evaluate(() => document.documentElement.scrollWidth)
  cek('Kuis Show tanpa gulir mendatar di 360 px', lebar2 <= 360, String(lebar2))
} catch (e) {
  gagal.push('PENGECUALIAN: ' + (e?.stack ?? e))
  console.log('  ✗ PENGECUALIAN: ' + (e?.stack ?? e))
} finally {
  for (const b of [b1, b2, b3]) await b?.close().catch(() => {})
  fs.rmSync(BERKAS, { recursive: true, force: true })
}

cek('nol galat konsol', errors.length === 0, errors.slice(0, 5).join(' | '))
console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) {
  console.log('\nGAGAL:\n- ' + gagal.join('\n- '))
  process.exit(1)
}
