import puppeteer from 'puppeteer'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--mute-audio','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--use-file-for-fake-audio-capture=/home/user/drillkit/qa/nada-bb4.wav'] })
const p = await b.newPage(); await p.setViewport({ width: 1280, height: 900 })
await p.goto('http://localhost:4173/', { waitUntil: 'networkidle2' }); await wait(2200)
await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((y) => y.textContent.includes('Muat data contoh')); x && x.click() }); await wait(3400)
await p.evaluate(() => { location.hash = '#/musik' }); await wait(1600)
// nyalakan penala & dengung supaya tampilannya sedang hidup
await p.click('[data-testid="tombol-mikrofon"]'); await wait(2600)
await p.click('[data-testid="tombol-dengung"]'); await wait(1200)
const el = await p.$('[data-testid="kartu-penala"]')
await el.screenshot({ path: '/home/user/shots/e4-penala.png' })
console.log('ok')
await b.close()
