/**
 * Tangkapan layar — mode asisten di presenter.
 *
 * Menyiapkan drill 3 set dengan catatan pada tiap set tujuan, lalu menjalankan
 * urutan latihan dan memotr et saat asisten mengumumkan persiapan (lengkap
 * dengan hitung mundur, catatan perancang, dan peringatan section).
 */
import puppeteer from 'puppeteer'

const BASE = process.argv[2] || 'http://localhost:5173'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--mute-audio'] })
const p = await b.newPage()
await p.setViewport({ width: 1100, height: 820, deviceScaleFactor: 2 })
await p.goto(BASE.startsWith('file:') ? BASE : BASE + '/', { waitUntil: 'networkidle2' })
await wait(1600)
await p.evaluate(() => {
  const x = [...document.querySelectorAll('button')].find((y) =>
    y.textContent.includes('Muat data contoh'),
  )
  x && x.click()
})
await wait(3600)
await p.evaluate(() => {
  location.hash = '#/drill'
})
await wait(2800)

const tombol = (t) =>
  p.evaluate((x) => {
    const el = [...document.querySelectorAll('button')].find((y) => y.textContent.trim() === x)
    if (!el || el.disabled) return false
    el.click()
    return true
  }, t)
const tombolJudul = (j) =>
  p.evaluate((x) => {
    const el = [...document.querySelectorAll('button')].find((y) =>
      (y.getAttribute('title') || '').includes(x),
    )
    if (!el || el.disabled) return false
    el.click()
    return true
  }, j)
const tulis = (teks) =>
  p.evaluate((t) => {
    const el = document.querySelector('[data-testid="catatan-set"]')
    if (!el) return false
    const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set
    set.call(el, t)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  }, teks)
const isiLabel = (label, nilai) =>
  p.evaluate(
    (l, v) => {
      const lab = [...document.querySelectorAll('label')].find((x) => x.textContent.includes(l))
      const el = lab?.parentElement?.querySelector('input, textarea')
      if (!el) return false
      const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement : HTMLInputElement
      const set = Object.getOwnPropertyDescriptor(proto.prototype, 'value').set
      set.call(el, String(v))
      el.dispatchEvent(new Event('input', { bubbles: true }))
      return true
    },
    label,
    nilai,
  )

/* ------------------------- Siapkan drill 3 set ------------------------- */
await p.keyboard.press('BracketRight')
await wait(1400)
await tombol('Set baru')
await wait(1800)
// "Set baru" menyalin set sebelumnya — geser supaya ada perpindahan sungguhan.
await p.evaluate(() => {
  const lab = [...document.querySelectorAll('label')].find((x) => x.textContent.includes('Geser blok'))
  const sel = lab?.parentElement?.querySelector('select')
  if (!sel) return false
  const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set
  set.call(sel, '8')
  sel.dispatchEvent(new Event('change', { bubbles: true }))
  return true
})
await wait(700)
await tombol('Ke depan')
await wait(1500)

// Set 3 (tujuan): catatan + nama yang lebih bermakna.
await isiLabel('Nama set', 'Set 3 — Blok rapat')
await wait(700)
await tulis('Blok rapat 4 baris, mata ke penonton, jaga jarak dua langkah')
await wait(1000)

// Set 2: count 4 + catatan.
await p.keyboard.press('BracketLeft')
await wait(1500)
await isiLabel('Count ke set berikutnya', 16)
await wait(700)
await tulis('Bentuk busur terbuka, bahu rata')
await wait(1000)

// Set 1: count 6.
await p.keyboard.press('BracketLeft')
await wait(1500)
await isiLabel('Count ke set berikutnya', 16)
await wait(900)

/* --------------------- Buka presenter & jalankan ---------------------- */
await tombolJudul('Mode presenter')
await wait(2400)
await p.evaluate(() => document.querySelector('[data-testid="chip-asisten"]')?.click())
await wait(700)
// Diam 4 count supaya hitung mundurnya lebih jelas terbaca di potret.
for (let i = 0; i < 3; i++) {
  await p.evaluate(() => {
    const el = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Diam'))
    el?.click()
  })
  await wait(350)
  const sudah = await p.evaluate(() => {
    const el = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Diam'))
    return (el?.textContent ?? '').includes('Diam 4')
  })
  if (sudah) break
}
await wait(500)
await p.evaluate(() => document.querySelector('[data-testid="tombol-urutan"]')?.click())

/** Tunggu sampai tahap tertentu, lalu potret. */
async function potretSaat(tahap, berkas, batas = 9000) {
  const t0 = Date.now()
  while (Date.now() - t0 < batas) {
    const k = await p.evaluate(() => {
      const el = document.querySelector('[data-testid="kartu-asisten"]')
      return el
        ? {
            tahap: el.getAttribute('data-tahap'),
            teks: el.textContent.replace(/\s+/g, ' ').trim(),
          }
        : null
    })
    if (k && k.tahap === tahap) {
      await p.screenshot({ path: berkas, clip: { x: 0, y: 0, width: 1100, height: 560 } })
      console.log(`${tahap}: ${k.teks}`)
      return true
    }
    await wait(70)
  }
  console.log(`tahap "${tahap}" tidak tertangkap`)
  return false
}

await potretSaat('siap', '/home/user/shots/asisten-siap.png')
await potretSaat('jalan', '/home/user/shots/asisten-jalan.png', 6000)

// Tunggu selesai.
const t0 = Date.now()
while (Date.now() - t0 < 20000) {
  const k = await p.evaluate(
    () => document.querySelector('[data-testid="kartu-asisten"]')?.getAttribute('data-tahap') ?? null,
  )
  if (k === 'selesai') {
    await p.screenshot({ path: '/home/user/shots/asisten-selesai.png', clip: { x: 0, y: 0, width: 1100, height: 560 } })
    console.log('selesai: tercatat')
    break
  }
  await wait(80)
}

console.log('selesai')
await b.close()
