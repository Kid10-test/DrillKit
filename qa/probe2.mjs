import puppeteer from 'puppeteer'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
for (const putaran of [1, 2]) {
  const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--mute-audio','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--use-file-for-fake-audio-capture=/home/user/drillkit/qa/nada-a4-440.wav'] })
  const p = await b.newPage()
  await p.goto('http://localhost:5173/', { waitUntil: 'networkidle2' }); await wait(1800)
  await p.evaluate(() => { location.hash = '#/musik' }); await wait(1200)
  await p.click('[data-testid="tombol-mikrofon"]'); await wait(2500)
  const baca = () => p.evaluate(() => ({
    n: document.querySelector('[data-testid="nada-terdeteksi"]')?.textContent?.trim(),
    s: document.querySelector('[data-testid="sen-terdeteksi"]')?.textContent?.trim(),
    h: document.querySelector('[data-testid="hz-terdeteksi"]')?.textContent?.trim(),
  }))
  const deret = []
  for (let i = 0; i < 8; i++) { deret.push(await baca()); await wait(500) }
  console.log('putaran', putaran, JSON.stringify(deret))
  await b.close()
}
