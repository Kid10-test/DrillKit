// DD10b — override per gerakan harus ikut tercetak di buku saku,
// dibaca pada kartu anggota YANG SAMA dengan titik yang diubah (dev 5173)
import puppeteer from 'puppeteer'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--mute-audio'] })
const p = await b.newPage()
await p.setViewport({ width: 1440, height: 1000 })
const errs = []
p.on('pageerror', (e) => errs.push(e.message.slice(0, 160)))
p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)) })

const bukaDetail = async () => {
  const l = await p.$$('circle[data-titik="1"]')
  if (!l.length) return false
  await l[0].click()
  await wait(900)
  return p.evaluate(() => {
    const el = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Detail')
    if (!el) return false
    el.click()
    return true
  })
}

/** Nama anggota dari judul panel Detail. */
const namaDetail = () => p.evaluate(() => {
  const j = [...document.querySelectorAll('h2,h3')].find((h) => (h.textContent || '').startsWith('Detail —'))
  return j ? j.textContent.replace('Detail —', '').trim() : null
})

const bacaMode = (n) => p.evaluate((i) => {
  const j = [...document.querySelectorAll('h2,h3')].find((h) => (h.textContent || '').startsWith('Detail —'))
  const k = j?.closest('div[class*="rounded"]')?.parentElement?.parentElement
  const t = k?.querySelector('table')
  const tr = t?.querySelectorAll('tbody tr')[i]
  return tr?.querySelector('td:last-child button')?.textContent.trim() ?? null
}, n)

const klikMode = (n) => p.evaluate((i) => {
  const j = [...document.querySelectorAll('h2,h3')].find((h) => (h.textContent || '').startsWith('Detail —'))
  const k = j?.closest('div[class*="rounded"]')?.parentElement?.parentElement
  const t = k?.querySelector('table')
  const tr = t?.querySelectorAll('tbody tr')[i]
  const tombol = tr?.querySelector('td:last-child button')
  if (!tombol) return null
  tombol.click()
  return true
}, n)

const bacaTabelDetail = () => p.evaluate(() => {
  const j = [...document.querySelectorAll('h2,h3')].find((h) => (h.textContent || '').startsWith('Detail —'))
  const k = j?.closest('div[class*="rounded"]')?.parentElement?.parentElement
  const t = k?.querySelector('table')
  if (!t) return null
  return [...t.querySelectorAll('tbody tr')].slice(0, 1).map((tr) =>
    [...tr.children].map((td) => td.textContent.trim()),
  )
})

/** Buka buku saku, pilih anggota tertentu, lalu baca tabelnya. */
const pratinjauAnggota = async (nama) => {
  await p.evaluate(() => { const el = document.querySelector('[title="Kartu/dot sheet per pemain"]'); el && el.click() })
  await wait(1300)
  await p.evaluate((n) => {
    const sel = [...document.querySelectorAll('select')].find((s) =>
      [...s.options].some((o) => o.textContent.includes(n)),
    )
    if (!sel) return false
    const opt = [...sel.options].find((o) => o.textContent.includes(n))
    const set = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set
    set.call(sel, opt.value)
    sel.dispatchEvent(new Event('change', { bubbles: true }))
    return true
  }, nama)
  await wait(900)
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
        return [...t.querySelectorAll('tbody tr')].slice(0, 2).map((tr) =>
          [...tr.children].map((td) => td.textContent.trim()),
        )
      })
      break
    }
  }
  await p.keyboard.press('Escape')
  await wait(1200)
  return data
}

await p.goto('http://localhost:5173/', { waitUntil: 'networkidle2' }); await wait(1600)
await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((y) => y.textContent.includes('Muat data contoh')); x && x.click() })
await wait(3400)
await p.evaluate(() => { location.hash = '#/drill' }); await wait(2800)

const R = {}
R.buka1 = await bukaDetail(); await wait(1500)
R.nama = await namaDetail()

// putar mode sampai benar-benar "hitungan" (maks 4 kali)
R.siklus = []
for (let i = 0; i < 4; i++) {
  const m = await bacaMode(0)
  R.siklus.push(m)
  if (m === 'hitungan') break
  await klikMode(0); await wait(1200)
}
R.modeAkhir = await bacaMode(0)
R.tabelDetail = await bacaTabelDetail()
await p.keyboard.press('Escape'); await wait(1000)

R.kartu = await pratinjauAnggota(R.nama)

console.log(JSON.stringify({ ...R, error: errs }, null, 2))
await b.close()
