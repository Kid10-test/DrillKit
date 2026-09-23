// DD2 — uji di produksi (4173) & berkas portabel
import puppeteer from 'puppeteer'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

async function jalankan(alamat, label) {
  const b = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--mute-audio', '--allow-file-access-from-files'],
  })
  const p = await b.newPage()
  await p.setViewport({ width: 1440, height: 980 })
  const errs = []
  p.on('pageerror', (e) => errs.push(e.message.slice(0, 160)))
  p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)) })
  const R = { label }

  const scrub = (v) => p.evaluate((n) => {
    const s = document.querySelector('[data-testid="garis-waktu"]')
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    set.call(s, String(n)); s.dispatchEvent(new Event('input', { bubbles: true }))
  }, v)
  const trafo = () => p.evaluate(() => [...document.querySelectorAll('g.cursor-move')].map((g) => g.getAttribute('transform') || 'translate(0 0)'))
  const setSelect = (lab, val) => p.evaluate((l, v) => {
    const f = [...document.querySelectorAll('label')].find((x) => x.textContent.includes(l))
    const sel = f && f.parentElement.querySelector('select')
    const set = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set
    set.call(sel, String(v)); sel.dispatchEvent(new Event('change', { bubbles: true }))
  }, lab, val)
  const setRange = (a, val) => p.evaluate((aria, v) => {
    const el = document.querySelector(`input[aria-label="${aria}"]`)
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    set.call(el, String(v)); el.dispatchEvent(new Event('input', { bubbles: true }))
  }, a, val)
  const setTunda = (val) => p.evaluate((v) => {
    const lab = [...document.querySelectorAll('label')].find((l) => l.textContent.includes('Tunda mulai per section'))
    const inp = lab && lab.parentElement.querySelector('input[type="number"]')
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    set.call(inp, String(v)); inp.dispatchEvent(new Event('input', { bubbles: true }))
  }, val)
  const jejak = () => p.evaluate(() => {
    const el = [...document.querySelectorAll('[data-trail="keluar"]')]
    return { jml: el.length, tag: el[0] ? el[0].tagName.toLowerCase() : null }
  })
  const angka = (t) => { const m = /translate\(([-\d.e]+) ([-\d.e]+)\)/.exec(t); return m ? [Number(m[1]), Number(m[2])] : [0, 0] }
  const diam = (d) => d.filter((t) => !t || !/translate/.test(t) || /translate\(0 0\)/.test(t)).length

  await p.goto(alamat, { waitUntil: 'networkidle2' }); await wait(2200)
  await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((y) => y.textContent.includes('Muat data contoh')); x && x.click() })
  await wait(3600)
  await p.evaluate(() => { location.hash = '#/drill' }); await wait(2800)

  R.jejakAwal = await jejak()

  // melengkung 100%
  await setSelect('Bentuk jalur', 'lengkung'); await wait(800)
  await setRange('Lengkungan jalur', 100); await wait(800)
  R.jejakLengkung = await jejak()
  await scrub(1); await wait(350); const akhir = (await trafo()).map(angka)
  await scrub(0.5); await wait(350); const tengah = (await trafo()).map(angka)
  let maks = 0
  for (let i = 0; i < akhir.length; i++) {
    const [dx, dy] = akhir[i]; const len = Math.hypot(dx, dy)
    if (len < 0.5) continue
    const ex = dx / 2 + (-dy / len) * (len * 0.5) * 0.5
    const ey = dy / 2 + (dx / len) * (len * 0.5) * 0.5
    maks = Math.max(maks, Math.hypot(tengah[i][0] - ex, tengah[i][1] - ey))
  }
  R.selisihKurva = Math.round(maks * 10000) / 10000

  // tunda per section
  await scrub(0.25); await wait(300); R.diamTanpaTunda = diam(await trafo())
  await setTunda(4); await wait(900)
  await scrub(0.25); await wait(300); R.diamDenganTunda = diam(await trafo())
  await scrub(1); await wait(300); R.diamAkhir = diam(await trafo())

  // kembali lurus
  await setSelect('Bentuk jalur', 'lurus'); await wait(800)
  R.jejakAkhir = await jejak()

  R.error = errs
  await b.close()
  return R
}

console.log(JSON.stringify(await jalankan('http://localhost:4173/', 'produksi (4173)'), null, 2))
console.log(JSON.stringify(await jalankan('file:///home/user/drillkit/portable/DrillKit.html', 'portabel'), null, 2))
