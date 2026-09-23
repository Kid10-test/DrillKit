// E4 — Penala & nada dengung (dev 5173), mikrofon palsu dari berkas WAV
import puppeteer from 'puppeteer'
import fs from 'node:fs'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const R = {}
const DASAR = [
  '--no-sandbox',
  '--mute-audio',
  '--use-fake-ui-for-media-stream',
  '--use-fake-device-for-media-stream',
  '--autoplay-policy=no-user-gesture-required',
]

const mataMata = () => {
  window.__osc = []
  const buat = AudioContext.prototype.createOscillator
  AudioContext.prototype.createOscillator = function () {
    const n = buat.call(this)
    window.__osc.push(n)
    return n
  }
  const gum = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
  navigator.mediaDevices.getUserMedia = async (c) => {
    const s = await gum(c)
    window.__stream = s
    return s
  }
}

async function bukaHalaman(berkasWav) {
  const args = berkasWav ? [...DASAR, `--use-file-for-fake-audio-capture=${berkasWav}`] : DASAR
  const b = await puppeteer.launch({ headless: 'new', args })
  const p = await b.newPage(); await p.setViewport({ width: 1280, height: 900 })
  const errs = []
  p.on('pageerror', (e) => errs.push(e.message.slice(0, 140)))
  p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 140)) })
  await p.evaluateOnNewDocument(mataMata)
  await p.goto('http://localhost:5173/', { waitUntil: 'networkidle2' }); await wait(1800)
  await p.evaluate(() => { location.hash = '#/musik' }); await wait(1500)
  return { b, p, errs }
}

const baca = (p) =>
  p.evaluate(() => ({
    nada: document.querySelector('[data-testid="nada-terdeteksi"]')?.textContent?.trim() ?? '',
    sen: document.querySelector('[data-testid="sen-terdeteksi"]')?.textContent?.trim() ?? '',
    hz: document.querySelector('[data-testid="hz-terdeteksi"]')?.textContent?.trim() ?? '',
    ket: document.querySelector('[data-testid="keterangan-penala"]')?.textContent?.trim() ?? '',
  }))

/* ------------------------- Penala: beberapa nada ------------------------- */
const KASUS = [
  ['nada-a4-440.wav', 'A4 440 Hz'],
  ['nada-bb4.wav', 'Bb4 466,16 Hz'],
  ['nada-442.wav', 'A4 442 Hz (acuan 440)'],
  ['nada-e2.wav', 'E2 82,41 Hz'],
  ['nada-hening.wav', 'Hening'],
]

for (const [berkas, label] of KASUS) {
  const { b, p, errs } = await bukaHalaman(`/home/user/drillkit/qa/${berkas}`)
  await p.click('[data-testid="tombol-mikrofon"]')
  await wait(2600)
  const s1 = await baca(p)
  await wait(900)
  const s2 = await baca(p)
  await wait(900)
  const s3 = await baca(p)
  R[label] = { s1, s2, s3, errs }

  // Mikrofon harus benar-benar dilepas saat berhenti
  if (label === 'A4 440 Hz') {
    await p.click('[data-testid="tombol-mikrofon"]'); await wait(700)
    R.lepasMikrofon = await p.evaluate(() => {
      const s = window.__stream
      return s ? { trek: s.getTracks().length, mati: s.getTracks().every((t) => t.readyState === 'ended') } : null
    })
  }
  await b.close()
}

/* --------------------------- Nada dengung --------------------------- */
{
  const { b, p, errs } = await bukaHalaman(null)
  const DL = '/home/user/drillkit/qa/dle4'; fs.rmSync(DL, { recursive: true, force: true }); fs.mkdirSync(DL, { recursive: true })

  // acuan A4 → 440, nada Bb3 (233,08 Hz)
  await p.evaluate(() => { location.reload({ waitUntil: 'networkidle2' }) }).catch(() => {})
  await wait(2000)
  await p.evaluate(() => { location.hash = '#/musik' }); await wait(1200)

  await p.click('[data-testid="preset-bb"]'); await wait(400)
  await p.click('[data-testid="tombol-dengung"]'); await wait(1200)
  R.dengungNyala = await p.evaluate(() => ({
    jumlah: window.__osc.length,
    hz: window.__osc.map((o) => Math.round(o.frequency.value)),
    jenis: window.__osc.map((o) => o.type),
    tombol: document.querySelector('[data-testid="tombol-dengung"]')?.textContent?.trim(),
  }))

  // ganti nada → frekuensi harus mengikuti tanpa berhenti
  await p.click('[data-testid="preset-f"]'); await wait(900)
  R.gantiNada = await p.evaluate(() => ({
    jumlah: window.__osc.length,
    hz: window.__osc.map((o) => Math.round(o.frequency.value)),
    label: document.querySelector('[data-testid="nada-dengung"]')?.textContent?.trim(),
  }))

  // ganti acuan A4 ke 442 → nada dengung ikut naik
  await p.select('[data-testid="pilih-a4"]', '442'); await wait(900)
  R.gantiA4 = await p.evaluate(() => window.__osc.map((o) => Math.round(o.frequency.value)))

  // matikan nada kelima → osilator baru hanya 1
  await p.click('[data-testid="toggle-kelima"]'); await wait(1200)
  R.tanpaKelima = await p.evaluate(() => ({
    jumlah: window.__osc.length,
    hzTerakhir: window.__osc.slice(-1).map((o) => Math.round(o.frequency.value)),
  }))

  // volume
  await p.evaluate(() => {
    const el = document.querySelector('[data-testid="geser-volume-dengung"]')
    el.value = '0.8'
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await wait(500)
  R.volume = await p.evaluate(() => document.querySelector('[data-testid="geser-volume-dengung"]').value)

  await p.click('[data-testid="tombol-dengung"]'); await wait(900)
  R.dengungBerhenti = await p.evaluate(() => document.querySelector('[data-testid="tombol-dengung"]')?.textContent?.trim())

  // HP 390 px
  await p.setViewport({ width: 390, height: 844 }); await wait(1000)
  R.hp = await p.evaluate(() => {
    const k = document.querySelector('[data-testid="kartu-penala"]')
    const r = k.getBoundingClientRect()
    return {
      lebar: Math.round(r.width),
      meluber: document.documentElement.scrollWidth > window.innerWidth + 1,
      tombol: [...k.querySelectorAll('button')].map((x) => Math.round(x.getBoundingClientRect().height)),
    }
  })
  R.errDengung = errs
  await b.close()
}

console.log(JSON.stringify(R, null, 2))
