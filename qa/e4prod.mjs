// E4 + pratinjau laporan — produksi (4173) & portabel (file://)
import puppeteer from 'puppeteer'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const R = {}

for (const [nama, url, wav] of [
  ['produksi', 'http://localhost:4173/', '/home/user/drillkit/qa/nada-bb4.wav'],
  ['portabel', 'file:///home/user/drillkit/portable/DrillKit.html', '/home/user/drillkit/qa/nada-bb4.wav'],
]) {
  const b = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--mute-audio', '--allow-file-access-from-files',
           '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
           `--use-file-for-fake-audio-capture=${wav}`],
  })
  const p = await b.newPage(); await p.setViewport({ width: 1280, height: 900 })
  const errs = []
  p.on('pageerror', (e) => errs.push(e.message.slice(0, 140)))
  p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 140)) })
  await p.evaluateOnNewDocument(() => {
    window.__osc = []
    const buat = AudioContext.prototype.createOscillator
    AudioContext.prototype.createOscillator = function () { const n = buat.call(this); window.__osc.push(n); return n }
  })
  await p.goto(url, { waitUntil: 'networkidle2' }); await wait(2400)
  await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((y) => y.textContent.includes('Muat data contoh')); x && x.click() })
  await wait(3600)

  const h = {}

  /* ---------- Penala & dengung ---------- */
  await p.evaluate(() => { location.hash = '#/musik' }); await wait(1600)
  h.kartuPenala = await p.evaluate(() => !!document.querySelector('[data-testid="kartu-penala"]'))
  await p.click('[data-testid="tombol-mikrofon"]'); await wait(3000)
  h.penala = await p.evaluate(() => ({
    nada: document.querySelector('[data-testid="nada-terdeteksi"]')?.textContent?.trim(),
    sen: document.querySelector('[data-testid="sen-terdeteksi"]')?.textContent?.trim(),
    hz: document.querySelector('[data-testid="hz-terdeteksi"]')?.textContent?.trim(),
    pesan: document.querySelector('[data-testid="pesan-penala"]')?.textContent?.trim().slice(0, 90) ?? '',
  }))
  await p.click('[data-testid="tombol-mikrofon"]'); await wait(500)

  await p.click('[data-testid="tombol-dengung"]'); await wait(1200)
  h.dengung = await p.evaluate(() => ({
    jumlah: window.__osc.length,
    hz: window.__osc.map((o) => Math.round(o.frequency.value)),
    tombol: document.querySelector('[data-testid="tombol-dengung"]')?.textContent?.trim(),
  }))
  await p.click('[data-testid="tombol-dengung"]'); await wait(600)

  /* ---------- Pratinjau laporan ---------- */
  await p.evaluate(() => { location.hash = '#/absensi' }); await wait(1200)
  await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((y) => y.textContent.trim() === 'Rekap'); x && x.click() })
  await wait(1400)
  h.kartuLaporan = await p.evaluate(() => !!document.querySelector('[data-testid="kartu-laporan-admin"]'))
  await p.click('[data-testid="tombol-pratinjau-paket"]'); await wait(1200)
  const f = p.frames().find((x) => x.url() === 'about:srcdoc' || x.url().startsWith('data:'))
  const isi = f ? await f.content() : ''
  h.pratinjau = {
    bingkai: !!f,
    laporan: isi.includes('<h1 class="judul">Laporan Kehadiran</h1>'),
    kartu: isi.split('class="kartu"').length - 1,
    oklch: /oklch\(|lab\(|color-mix\(/.test(isi),
  }
  await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((y) => y.textContent.trim() === 'Tutup'); x && x.click() })
  await wait(500)

  /* ---------- HP ---------- */
  await p.evaluate(() => { location.hash = '#/musik' }); await wait(1400)
  await p.setViewport({ width: 390, height: 844 }); await wait(900)
  h.hp = await p.evaluate(() => {
    const k = document.querySelector('[data-testid="kartu-penala"]')
    return {
      meluber: document.documentElement.scrollWidth > window.innerWidth + 1,
      lebarKartu: k ? Math.round(k.getBoundingClientRect().width) : 0,
    }
  })

  h.errors = errs
  R[nama] = h
  await b.close()
}
console.log(JSON.stringify(R, null, 2))
