// Buku saku — patok menyala vs mati: legenda, panah, dan koordinat (dev 5173)
import puppeteer from 'puppeteer'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--mute-audio', '--allow-file-access-from-files'] })
const p = await b.newPage()
await p.setViewport({ width: 1440, height: 1000 })
const errs = []
p.on('pageerror', (e) => errs.push(e.message.slice(0, 160)))
p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)) })
const R = {}

const klik = (teks) => p.evaluate((t) => {
  const el = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === t)
  if (!el) return false
  el.click(); return true
}, teks)

/** Toggle aplikasi = <button> biasa (span .bg-emerald-500 bila menyala). */
const setAktif = (t, nilai) => p.evaluate((teks, v) => {
  const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === teks)
  if (btn) {
    if (!!btn.querySelector('.bg-emerald-500') !== v) btn.click()
    return true
  }
  const lab = [...document.querySelectorAll('label')].find((l) => l.textContent.includes(teks))
  const cb = lab && lab.querySelector('input[type="checkbox"]')
  if (cb) { if (cb.checked !== v) cb.click(); return true }
  return false
}, t, nilai)

const bukaSetelan = async (nilai) => {
  await klik('⚙'); await wait(1200)
  const ok = await setAktif('Pakai sistem patok', nilai)
  await wait(700)
  await klik('Simpan'); await wait(1600)
  return ok
}

const pratinjau = async (berkas) => {
  await p.evaluate(() => {
    const el = document.querySelector('[title="Kartu/dot sheet per pemain"]')
    el && el.click()
  })
  await wait(1300)
  await p.evaluate(() => {
    const el = [...document.querySelectorAll('button')].find((x) => x.textContent.trim().includes('Pratinjau'))
    el && el.click()
  })
  await wait(1700)
  let data = null
  for (const f of p.frames()) {
    const h = await f.evaluate(() => (document.body ? document.body.innerHTML : '')).catch(() => '')
    if (h.includes('<table')) {
      data = await f.evaluate(() => {
        const t = document.querySelector('table')
        return {
          kepala: [...t.querySelectorAll('thead th')].map((x) => x.textContent.trim()),
          baris: [...t.querySelectorAll('tbody tr')].slice(0, 3).map((tr) =>
            [...tr.children].map((td) => td.textContent.trim()),
          ),
          panah: [...t.querySelectorAll('.panah')].slice(0, 3).map((e) => e.textContent),
          kompasTeks: (document.querySelector('.kompas') || {}).innerText || null,
        }
      })
      break
    }
  }
  if (berkas) {
    const h = await p.$('iframe[srcdoc]')
    if (h) await h.screenshot({ path: berkas })
  }
  await p.keyboard.press('Escape'); await wait(1200)
  return data
}

const URL_DASAR = process.argv[2] || 'http://localhost:5173/'
await p.goto(URL_DASAR, { waitUntil: 'networkidle2' }); await wait(1600)
await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((y) => y.textContent.includes('Muat data contoh')); x && x.click() })
await wait(3400)
await p.evaluate(() => { location.hash = '#/drill' }); await wait(2800)

R.patokOn = await bukaSetelan(true)
R.saatPatok = await pratinjau('/home/user/shots/dd9-patok' + (process.argv[3] || '') + '.png')

R.patokOff = await bukaSetelan(false)
R.saatBola = await pratinjau('/home/user/shots/dd9-bola' + (process.argv[3] || '') + '.png')

R.error = errs
console.log(JSON.stringify(R, null, 2))
await b.close()
