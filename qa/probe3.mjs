import puppeteer from 'puppeteer'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--mute-audio','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--use-file-for-fake-audio-capture=/home/user/drillkit/qa/nada-a4-440.wav'] })
const p = await b.newPage()
await p.goto('http://localhost:5173/', { waitUntil: 'networkidle2' }); await wait(1800)
await p.evaluate(() => { location.hash = '#/musik' }); await wait(1200)
await p.click('[data-testid="tombol-mikrofon"]'); await wait(3000)
const r = await p.evaluate(() => ({
  tampil: document.querySelector('[data-testid="hz-terdeteksi"]')?.textContent?.trim(),
  mentah: (window.__mentah ?? []).slice(-14).map((h) => +h.toFixed(1)),
  sr: (window.__mentah ?? []).length,
}))
console.log(JSON.stringify(r))
await b.close()
