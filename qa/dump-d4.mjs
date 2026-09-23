import puppeteer from 'puppeteer'
import fs from 'node:fs'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--mute-audio'] })
const p = await b.newPage(); await p.setViewport({ width: 1200, height: 900 })
await p.goto('http://localhost:4173/', { waitUntil: 'networkidle2' }); await wait(2200)
await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((y) => y.textContent.includes('Muat data contoh')); x && x.click() }); await wait(3400)
await p.evaluate(() => { location.hash = '#/absensi' }); await wait(1200)
await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((y) => y.textContent.trim() === 'Rekap'); x && x.click() }); await wait(1400)
const ambil = async (testid) => {
  const sebelum = (await b.pages()).length
  await p.click(`[data-testid="${testid}"]`)
  let h = null
  for (let i = 0; i < 40 && !h; i++) { await wait(250); const s = await b.pages(); if (s.length > sebelum) h = s[s.length - 1] }
  if (!h) return ''
  await wait(800)
  const html = await h.content(); await h.close(); return html
}
const paket = await ambil('tombol-paket-lengkap')
fs.writeFileSync('/home/user/contoh-laporan-kehadiran.html', paket)
// versi teks untuk diperiksa
const teks = paket
  .replace(/<style[\s\S]*?<\/style>/g, '')
  .replace(/<\/tr>/g, '\n')
  .replace(/<[^>]+>/g, ' | ')
  .replace(/&nbsp;/g, ' ')
  .replace(/\s*\|\s*(\|\s*)+/g, ' | ')
  .split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter((l) => l.replace(/[|\s]/g, '').length)
console.log(teks.slice(0, 46).join('\n'))
console.log('\n... [dipotong] ...\n')
console.log(teks.slice(-14).join('\n'))
await b.close()
