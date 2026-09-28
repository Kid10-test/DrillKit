/**
 * DIAGNOSA — seberapa tepat klik metronom berbaris dengan rekaman lagu?
 *
 * Mengapa ada: pelatih melaporkan "klik melambat atau terlambat" saat metronom
 * diputar bersama rekaman. Rekaman uji di sini dibuat sendiri (WAV dengan klik
 * tepat tiap 60/BPM detik, ketukan pertama di `TITIK_MULAI`), jadi posisi
 * ketukan sebenarnya diketahui sampai milidetik — tidak ada yang perlu
 * dipercaya begitu saja.
 *
 * Yang diukur: posisi rekaman pada saat tiap klik berbunyi, dibandingkan
 * dengan ketukan rekaman yang seharusnya. Tetap ~0 sepanjang lagu = kedua
 * pemutar berjalan bersama. Tumbuh = hanyut (laju berbeda). Tetap besar =
 * salah titik mulai.
 *
 * Skenario (env `SKAENARIO`):
 *   dasar  — setelan bawaan
 *   hitung — hitung mundur lagu menyala (dilewati bila rekaman dipakai)
 *   bpm    — tempo latihan mode BPM (−20 BPM)
 *   persen — tempo latihan mode persen (80%)
 *
 * Pakai: SKAENARIO=bpm node qa/diagnosa-klik-rekaman.mjs
 * (perhatikan: SKAENARIO, bukan SKENARIO — salah nama berarti diam-diam
 *  memakai skenario 'dasar')
 */
import puppeteer from 'puppeteer'
import fs from 'node:fs'
import { lewatSambutan } from './sambutan.mjs'
import { segar } from './db-mentah.mjs'

const BASE = process.env.BASE || 'http://localhost:4173'
const SKENARIO = process.env.SKAENARIO || 'dasar'
const BPM = 172
const BEAT = 60 / BPM
const TITIK_MULAI = 0.5
const DURASI = 60
const LAMA_UKUR = Number(process.env.LAMA_UKUR || 25)
const SONG = 'uji-klik-rekaman'

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

/* --------------------------- penanaman data ------------------------------- */
/* Dijalankan DI DALAM halaman — mandiri, semua parameter lewat argumen. */
async function tanamDiHalaman(arg) {
  const { db, songId, bpm, beat, titikMulai, durasi, hitungMundur } = arg

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
        title: 'UJI Klik × Rekaman',
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
        hitungMundur,
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

/* ------------------------------- peramban --------------------------------- */
const CHROME = process.env.CHROME || (fs.existsSync('/tmp/chromium') ? '/tmp/chromium' : undefined)
const LIB = process.env.CHROME_LIB || '/tmp/br/lib'
const browser = await puppeteer.launch({
  headless: true,
  ...(CHROME ? { executablePath: CHROME, env: { ...process.env, LD_LIBRARY_PATH: LIB } } : {}),
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--autoplay-policy=no-user-gesture-required',
    '--mute-audio',
  ],
})
const p = await browser.newPage()
await p.setViewport({ width: 1280, height: 1000 })

/*
 * Dipasang pada setiap pemuatan halaman, sebelum skrip aplikasi berjalan.
 * Tiap `start()` mencatat BERSAMAAN: waktu yang dijadwalkan (jam AudioContext),
 * jam AudioContext saat itu, posisi rekaman saat itu, dan laju pemutarannya.
 * Karena jarak jadwalkan→bunyi hanya sependek lookahead, posisi rekaman pada
 * saat klik berbunyi bisa dihitung dengan galat beberapa milidetik.
 */
await p.evaluateOnNewDocument(() => {
  window.__klik = []
  window.__ctx = null
  window.__audio = null
  const AsliOsc = AudioContext.prototype.createOscillator
  AudioContext.prototype.createOscillator = function (...a) {
    if (!window.__ctx) window.__ctx = this
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

// tempo latihan (localStorage) — di luar basis data, jadi ditulis langsung
function tempoLatihan() {
  if (SKENARIO === 'bpm') return { mode: 'bpm', persen: 100, geser: -20 }
  if (SKENARIO === 'persen') return { mode: 'persen', persen: 80, geser: 0 }
  return { mode: 'persen', persen: 100, geser: 0 }
}
await p.evaluate(
  (id, tempo) => {
    localStorage.setItem('drillkit.tempoLatihan.v1', JSON.stringify({ [id]: { tempo } }))
  },
  SONG,
  tempoLatihan(),
)

const tanam = await p.evaluate(tanamDiHalaman, {
  db: 'drillkit',
  songId: SONG,
  bpm: BPM,
  beat: BEAT,
  titikMulai: TITIK_MULAI,
  durasi: DURASI,
  hitungMundur:
    SKENARIO === 'hitung' ? { on: true, ulang: 1, tiapNot: false, suara: 'bel' } : { on: false, ulang: 1, tiapNot: false, suara: 'bel' },
})
if (!tanam?.ok) {
  console.error('gagal menanam data uji:', tanam?.alasan)
  await browser.close()
  process.exit(1)
}

await segar(p, 2500)
await p.goto(`${BASE}/#/musik`, { waitUntil: 'networkidle2' })
await wait(1500)

const dipilih = await p.evaluate((id) => {
  const el = document.querySelector(`[data-testid="pilih-lagu-${id}"]`)
  if (!el) return false
  el.click()
  return true
}, SONG)
if (!dipilih) {
  const isi = await p.evaluate(() => document.body.innerText.slice(0, 600))
  console.error('lagu uji tidak ketemu. Isi halaman:\n' + isi)
  await browser.close()
  process.exit(1)
}
await wait(500)

// Peramban lambat disimulasikan: utas utama yang sibuk adalah tersangka
// utama "klik melambat/terlambat", dan hanya bisa dibuktikan dengan
// memperlambatnya, bukan dengan menunggu di mesin cepat.
const LAMBAT = Number(process.env.LAMBAT || 1)
if (LAMBAT > 1) {
  await p.emulateCPUThrottling(LAMBAT)
  console.log(`(utas utama diperlambat ${LAMBAT}×)`)
}

await p.evaluate(() => {
  window.__klik = []
  window.__sampel = []
  setInterval(() => {
    if (!window.__audio) return
    window.__sampel.push({ w: performance.now(), ctx: window.__ctx ? window.__ctx.currentTime : 0, a: window.__audio.currentTime, p: window.__audio.paused, rate: window.__audio.playbackRate })
  }, 100)
})
await p.click('[data-testid="tombol-mulai"]')
await wait(LAMA_UKUR * 1000)

const data = await p.evaluate(() => ({
  klik: window.__klik,
  sampel: window.__sampel ?? [],
  durasi: window.__audio ? window.__audio.duration : 0,
  rate: window.__audio ? window.__audio.playbackRate : 0,
  err: window.__audio ? (window.__audio.error?.message ?? null) : 'tidak ada elemen audio',
}))
await browser.close()

/* ------------------------------- analisa ---------------------------------- */
const klik = data.klik.slice().sort((a, b) => a.t - b.t)

// Klik yang dijadwalkan SEBELUM rekaman benar-benar berbunyi tidak bisa
// dibandingkan: posisinya masih 0 dan lajunya belum berlaku.
const terpakai = klik.filter((k) => k.a != null && !k.paused && k.a > 0)
const buang = klik.length - terpakai.length

console.log(`\n=== SKENARIO: ${SKENARIO} ===`)
console.log(`rate rekaman=${data.rate} · durasi=${data.durasi?.toFixed(1)}s · error=${data.err}`)
console.log(`klik terjadwal: ${klik.length} (${terpakai.length} sesudah rekaman berbunyi, ${buang} dibuang)`)

/* Hanyut jam: laju rekaman vs laju AudioContext, diukur langsung. */
const smp = (data.sampel ?? []).filter((s) => !s.p && s.a > 0.2 && s.ctx > 0)
if (smp.length > 3) {
  const n = smp.length
  const mx = smp.reduce((t, x) => t + x.ctx, 0) / n
  const my = smp.reduce((t, x) => t + x.a, 0) / n
  let num = 0
  let den = 0
  for (const x of smp) {
    num += (x.ctx - mx) * (x.a - my)
    den += (x.ctx - mx) ** 2
  }
  const laju = num / den
  // Rekaman memang diperlambat, jadi yang dibandingkan adalah laju jamnya:
  // laju / playbackRate. 1,0 = kedua jam berjalan sama cepat.
  const jam = data.rate ? laju / data.rate : laju
  console.log(
    `laju rekaman/ctx = ${laju.toFixed(6)} (rate ${data.rate?.toFixed(4)}) → jam ${jam.toFixed(6)}` +
      ` · ${(((jam - 1) * 60000)).toFixed(1)} ms hanyut per menit`,
  )
}

/*
 * Selisih TANPA pembulatan: klik ke-`i` seharusnya berbunyi tepat pada ketukan
 * ke-`i` rekaman (grid rekaman itu sendiri: TITIK_MULAI + i·BEAT). Karena itu
 * hanyut sekecil apa pun langsung terlihat menumpuk, bukan tersembunyi di
 * dalam pembulatan setengah ketukan.
 */
const baris = []
for (let i = 0; i < terpakai.length; i++) {
  const k = terpakai[i]
  const pos = k.a + (k.t - k.ctxNow) * k.rate // posisi rekaman saat klik berbunyi
  /*
   * Acuan selalu grid rekaman itu sendiri: rekaman melambat/dipercepat, tetapi
   * ketukan di dalam berkasnya tetap berjarak BEAT detik MEDIA. Klik yang
   * seiring akan berbunyi tepat saat rekaman melewati ketukan ke-`i`.
   * (Versi pertama skrip ini mengalikan acuan dengan faktor tempo — dan
   * "menemukan" hanyut 5 detik yang sebenarnya hanya salah hitung sendiri.)
   */
  const offsetKlik = 0
  const harap = TITIK_MULAI + (i + offsetKlik) * BEAT
  baris.push({ i, pos, harap, selisihMs: (pos - harap) * 1000 })
}

if (!baris.length) {
  console.log('TIDAK ADA klik yang bisa dibandingkan.')
} else {
  const rata = (x) => (x.length ? x.reduce((s, b) => s + b.selisihMs, 0) / x.length : 0)
  const jendela = (dari, ke) => baris.slice(dari, Math.min(ke, baris.length))
  console.log('\n  jendela klik   rata-rata selisih')
  for (const [a, b] of [[0, 4], [4, 8], [12, 16], [24, 28], [40, 44], [baris.length - 4, baris.length]]) {
    if (a >= baris.length) continue
    console.log(`  ${String(a).padStart(4)}–${String(Math.min(b, baris.length) - 1).padStart(4)}        ${rata(jendela(a, b)) >= 0 ? '+' : ''}${rata(jendela(a, b)).toFixed(1)} ms`)
  }
  const awal = rata(jendela(0, 8))
  const akhir = rata(jendela(baris.length - 5, baris.length))
  const detik = baris.length ? terpakai.at(-1).t - terpakai[0].t : 0
  console.log(`\nselisih awal (±klik 0–7) : ${awal >= 0 ? '+' : ''}${awal.toFixed(1)} ms`)
  console.log(`selisih akhir            : ${akhir >= 0 ? '+' : ''}${akhir.toFixed(1)} ms`)
  console.log(`perubahan                : ${(akhir - awal) >= 0 ? '+' : ''}${(akhir - awal).toFixed(1)} ms dalam ${detik.toFixed(1)}s`)

  const jeda = []
  for (let i = 1; i < terpakai.length; i++) jeda.push(terpakai[i].t - terpakai[i - 1].t)
  // Jarak antar-klik yang benar ikut tempo latihan: BEAT / playbackRate.
  const jarak = BEAT / (data.rate || 1)
  const galat = jeda.map((j) => Math.abs(j - jarak) * 1000)
  console.log(`galat jeda antar-klik    : maks ${Math.max(...galat).toFixed(1)} ms · rata ${(galat.reduce((a, b) => a + b, 0) / galat.length).toFixed(2)} ms`)
}
