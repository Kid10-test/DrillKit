import puppeteer from 'puppeteer'
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] })
const p = await b.newPage(); await p.setViewport({ width: 760, height: 640 })
await p.goto('file:///home/user/mockup-buku-saku.html', { waitUntil: 'load' })
await new Promise(r=>setTimeout(r,700))
await p.screenshot({ path: '/home/user/shots/mockup-buku-saku.png' })
await b.close(); console.log('ok')
