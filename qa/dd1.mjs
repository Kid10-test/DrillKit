// DD1 — Mode lapangan & patok kustom (dev 5173)
import puppeteer from 'puppeteer'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const R = {}

const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--mute-audio'] })
const p = await b.newPage()
await p.setViewport({ width: 1440, height: 980 })
const errs = []
p.on('pageerror', (e) => errs.push(e.message.slice(0, 160)))
p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)) })

const klikTeks = (teks) => p.evaluate((t) => {
  const x = [...document.querySelectorAll('button')].find((y) => y.textContent.trim() === t)
  if (!x) return false
  x.click(); return true
}, teks)
const klikJudul = (judul) => p.evaluate((t) => {
  const x = [...document.querySelectorAll('button')].find((y) => (y.title || '') === t)
  if (!x) return false
  x.click(); return true
}, judul)
const bukaPengaturan = async () => { await klikJudul('Pengaturan drill'); await wait(1000) }
const preset = (nama) => p.evaluate((t) => {
  const x = [...document.querySelectorAll('button')].find((y) => y.textContent.trim() === t)
  if (!x) return false
  x.click(); return true
}, nama)
const ringkasan = () => p.evaluate(() => {
  const el = [...document.querySelectorAll('p')].find((y) => y.textContent.includes('patok huruf'))
  return el ? el.textContent.replace(/\s+/g, ' ').trim() : null
})
const isiInput = (label, nilai) => p.evaluate((lab, val) => {
  const f = [...document.querySelectorAll('label')].find((l) => l.textContent.includes(lab))
  const wrap = f && f.parentElement
  const inp = wrap && wrap.querySelector('input')
  if (!inp) return false
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(inp, String(val))
  inp.dispatchEvent(new Event('input', { bubbles: true }))
  return true
}, label, nilai)

await p.goto('http://localhost:5173/', { waitUntil: 'networkidle2' }); await wait(1500)
await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((y) => y.textContent.includes('Muat data contoh')); x && x.click() })
await wait(3200)
await p.evaluate(() => { location.hash = '#/drill' }); await wait(2600)

/* ---------- A. Keadaan awal: DCI, format lama ---------- */
R.awal = await p.evaluate(() => {
  const t = [...document.querySelectorAll('svg text')].map((x) => x.textContent.trim())
  return { adaA: t.includes('A'), adaT1: t.includes('T1'), adaS1: t.includes('S1') }
})

/* ---------- B. Ganti ke lapangan sepak bola ---------- */
await bukaPengaturan()
R.modal = await p.evaluate(() => document.body.innerText.includes('Lapangan drill ini'))
R.presetBola = await preset('Sepak bola (Indonesia)'); await wait(900)
R.labelMeter = await p.evaluate(() => [...document.querySelectorAll('label')].some((l) => l.textContent.includes('(meter)')))
R.ringkasanBola = await ringkasan()
R.togglePatok = await p.evaluate(() => [...document.querySelectorAll('button')].some((x) => x.textContent.includes('Pakai sistem patok')))
R.ukuranMeter = await p.evaluate(() => {
  const f = [...document.querySelectorAll('label')].find((l) => l.textContent.includes('Lebar lapangan'))
  const v = f && f.parentElement.querySelector('input')
  const f2 = [...document.querySelectorAll('label')].find((l) => l.textContent.includes('Panjang area main'))
  const v2 = f2 && f2.parentElement.querySelector('input')
  return v && v2 ? `${v.value} × ${v2.value}` : null
})

/* ---------- C. Ubah jarak patok & lihat jumlahnya berubah ---------- */
R.setJarak = await isiInput('Jarak patok huruf', 4); await wait(700)
R.ringkasanRapat = await ringkasan()
R.setJarak2 = await isiInput('Jarak patok huruf', 8); await wait(700)
R.ringkasanKembali = await ringkasan()

/* ---------- D. Sumbu huruf bisa dipindah ---------- */
R.gantiSumbu = await p.evaluate(() => {
  const f = [...document.querySelectorAll('label')].find((l) => l.textContent.includes('Patok huruf dipasang'))
  const sel = f && f.parentElement.querySelector('select')
  if (!sel) return false
  const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set
  setter.call(sel, 'x')
  sel.dispatchEvent(new Event('change', { bubbles: true }))
  return true
}); await wait(700)
R.ringkasanSumbuX = await ringkasan()
await p.evaluate(() => {
  const f = [...document.querySelectorAll('label')].find((l) => l.textContent.includes('Patok huruf dipasang'))
  const sel = f && f.parentElement.querySelector('select')
  const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set
  setter.call(sel, 'y')
  sel.dispatchEvent(new Event('change', { bubbles: true }))
}); await wait(600)

await klikTeks('Simpan'); await wait(2200)

/* ---------- E. Patok tergambar di lapangan ---------- */
R.lapangan = await p.evaluate(() => {
  const t = [...document.querySelectorAll('svg text')].map((x) => x.textContent.trim())
  const patok = t.filter((x) => /^(T\d+|[A-Z]#?)$/.test(x))
  return {
    adaA: t.includes('A'), adaAKres: t.includes('A#'), adaT1: t.includes('T1'),
    hilangS1: !t.includes('S1'),
    jmlPatok: patok.length, contoh: patok.slice(0, 10),
  }
})

/* ---------- F. Buku saku / dot sheet memakai koordinat patok ---------- */
await klikJudul('Kartu/dot sheet per pemain'); await wait(1200)
R.modalDot = await p.evaluate(() => document.body.innerText.includes('Dot sheet & buku saku'))
await klikTeks('Pratinjau'); await wait(2200)
R.iframe = await p.evaluate(() => {
  const f = [...document.querySelectorAll('iframe')].pop()
  return f ? f.getAttribute('srcdoc')?.slice(0, 200) !== undefined : false
})
const bingkai = p.frames().find((f) => f.url() === 'about:srcdoc' || f.url().startsWith('data:'))
if (bingkai) {
  const html = await bingkai.content()
  const teks = html.replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ')
  R.koorPatok = (teks.match(/[A-Z]#?\d+/g) || []).slice(0, 8)
  R.sisaFormatLama = /YL\d+|S1 ·|FH |BH /.test(teks)
  R.ditemukanA6 = /[A-Z]#?\d+/.test(teks)
}
await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((y) => y.textContent.trim() === 'Tutup'); x && x.click() })
await wait(900)
await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((y) => y.textContent.trim() === 'Tutup'); x && x.click() })
await wait(900)

/* ---------- G. Kembali ke DCI: format lama harus pulih ---------- */
await bukaPengaturan()
R.presetDci = await preset('DCI / kampus'); await wait(900)
R.ringkasanDci = await ringkasan()
await klikTeks('Simpan'); await wait(2200)
R.kembaliDci = await p.evaluate(() => {
  const t = [...document.querySelectorAll('svg text')].map((x) => x.textContent.trim())
  return { adaA: t.includes('A'), adaT1: t.includes('T1'), adaS1: t.includes('S1'), adaFRONT: t.some((x) => x.includes('FRONT')) }
})
await klikJudul('Kartu/dot sheet per pemain'); await wait(1200)
await klikTeks('Pratinjau'); await wait(2200)
const bingkai2 = p.frames().find((f) => f.url() === 'about:srcdoc' || f.url().startsWith('data:'))
if (bingkai2) {
  const html = await bingkai2.content()
  const teks = html.replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ')
  R.dotDci = { formatLama: /YL\d+/.test(teks), tanpaPatok: !/[A-Z]#?\d+/.test(teks) }
}

R.error = errs
console.log(JSON.stringify(R, null, 2))
await b.close()
