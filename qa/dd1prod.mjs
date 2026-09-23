// DD1 — uji di versi produksi (4173) & berkas portabel (file://)
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

  await p.goto(alamat, { waitUntil: 'networkidle2' }); await wait(2200)
  await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((y) => y.textContent.includes('Muat data contoh')); x && x.click() })
  await wait(3600)
  await p.evaluate(() => { location.hash = '#/drill' }); await wait(2800)

  const gantiPreset = async (nama) => {
    await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((y) => (y.title || '') === 'Pengaturan drill'); x && x.click() })
    await wait(1100)
    const ok = await p.evaluate((t) => { const x = [...document.querySelectorAll('button')].find((y) => y.textContent.trim() === t); if (!x) return false; x.click(); return true }, nama)
    await wait(1000)
    await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((y) => y.textContent.trim() === 'Simpan'); x && x.click() })
    await wait(2400)
    return ok
  }
  const koor = () => p.evaluate(() => { const e = document.querySelector('[data-live-coord]'); return e ? e.textContent.trim() : null })

  // 1. Lapangan bola + patok
  R.presetBola = await gantiPreset('Sepak bola (Indonesia)')
  R.patokTergambar = await p.evaluate(() => {
    const t = [...document.querySelectorAll('svg text')].map((x) => x.textContent.trim())
    const patok = t.filter((x) => /^(T\d+|[A-Z]#?)$/.test(x))
    return { adaA: t.includes('A'), adaT1: t.includes('T1'), jml: patok.length, hilangS1: !t.includes('S1') }
  })

  // 2. Geser titik → harus menempel ke patok
  const kotak = await p.evaluate(() => {
    const g = document.querySelector('g.cursor-move')
    if (!g) return null
    const r = g.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  })
  if (kotak) {
    await p.mouse.move(kotak.x, kotak.y); await p.mouse.down()
    await p.mouse.move(kotak.x + 26, kotak.y + 20, { steps: 5 }); await p.mouse.up()
    await wait(1100)
  }
  R.koorSetelahGeser = await koor()
  R.tepatDiPatok = R.koorSetelahGeser ? /^[A-Z]#?\d+$/.test(R.koorSetelahGeser) : false

  // 3. Buku saku memakai koordinat patok
  await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((y) => (y.title || '') === 'Kartu/dot sheet per pemain'); x && x.click() })
  await wait(1400)
  await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((y) => y.textContent.trim() === 'Pratinjau'); x && x.click() })
  await wait(2600)
  const f = p.frames().find((x) => x.url() === 'about:srcdoc' || x.url().startsWith('data:'))
  if (f) {
    const html = await f.content()
    const teks = html.replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, '|')
    const kolom = teks.split('|').map((x) => x.trim()).filter((x) => /^[A-Z]#?\s*[+-]?[\d.]*\s*·\s*T\d+/.test(x) || /^[A-Z]#?\d+$/.test(x))
    R.koorBukuSaku = kolom.slice(0, 5)
    R.formatLamaTertinggal = /YL\d+/.test(teks)
  }
  await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((y) => y.textContent.trim() === 'Tutup'); x && x.click() })
  await wait(800)
  await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((y) => y.textContent.trim() === 'Batal'); x && x.click() })
  await wait(800)

  // 4. Kembali ke DCI → format lama pulih
  R.presetDci = await gantiPreset('DCI / kampus')
  R.kembaliDci = await p.evaluate(() => {
    const t = [...document.querySelectorAll('svg text')].map((x) => x.textContent.trim())
    return { adaA: t.includes('A'), adaT1: t.includes('T1'), adaS1: t.includes('S1') }
  })

  R.error = errs
  await b.close()
  return R
}

console.log(JSON.stringify(await jalankan('http://localhost:4173/', 'produksi (4173)'), null, 2))
console.log(JSON.stringify(await jalankan('file:///home/user/drillkit/portable/DrillKit.html', 'portabel'), null, 2))
