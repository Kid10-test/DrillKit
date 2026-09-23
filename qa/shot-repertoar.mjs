// Tangkapan layar tukar repertoar (M4).
// Tiga keadaan yang ingin terlihat: panelnya, pilihan lagu saat ekspor, dan
// peringatan sebelum menimpa saat impor.
import puppeteer from 'puppeteer'
import fs from 'node:fs'

const BASE = process.env.BASE || 'http://localhost:5173'
const UNDUH = '/tmp/unduh-shot-repertoar'
fs.rmSync(UNDUH, { recursive: true, force: true })
fs.mkdirSync(UNDUH, { recursive: true })
fs.mkdirSync('/home/user/shots', { recursive: true })

const browser = await puppeteer.launch({
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  defaultViewport: { width: 1440, height: 900 },
})
const p = await browser.newPage()
p.on('console', (m) => { if (m.type() === 'error') console.log('KONSOL:', m.text()) })
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const tombol = (teks) =>
  p.evaluate((t) => {
    const x = [...document.querySelectorAll('button')].find((y) => y.textContent.includes(t))
    if (!x || x.disabled) return false
    x.click()
    return true
  }, teks)
const klik = async (sel) => { await p.waitForSelector(sel, { timeout: 10000 }); await p.click(sel) }
const potret = async (nama) => {
  await p.screenshot({ path: `/home/user/shots/${nama}.png` })
  console.log('terpotret:', nama)
}

const cdp = await p.createCDPSession()
await cdp.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: UNDUH })

await p.goto(BASE, { waitUntil: 'networkidle2' })
await wait(1500)
await tombol('Muat data contoh')
await wait(4000)

// Tambah satu lagu lagi supaya daftar pilihannya tidak cuma sebaris.
await p.evaluate(async () => {
  const r = await new Promise((res) => {
    const q = indexedDB.open('drillkit')
    q.onsuccess = () => res(q.result)
  })
  const baca = (n) => new Promise((res) => {
    const t = r.transaction(n, 'readonly')
    const q = t.objectStore(n).getAll()
    q.onsuccess = () => res(q.result)
  })
  const songs = await baca('songs')
  const drills = await baca('drills')
  const tx = r.transaction(['songs', 'drills'], 'readwrite')
  tx.objectStore('songs').put({
    id: 'song_balada_shot', title: 'Balada Sore', bpm: 76, beats: 4,
    composer: 'Tim Musik', key: 'F mayor',
    tempoMap: [{ id: 'tm1', measure: 1, bpm: 76 }, { id: 'tm2', measure: 33, bpm: 96 }],
    createdAt: Date.now(),
  })
  if (drills[0]) {
    const d = { ...drills[0], songId: songs[0]?.id }
    tx.objectStore('drills').put(d)
  }
  await new Promise((res) => { tx.oncomplete = res })
})
await p.reload({ waitUntil: 'networkidle2' })
await wait(2500)

await p.evaluate(() => { location.hash = '#/musik' })
await wait(2500)
// 1. Panel di halaman Musik (menggulir ke bagian repertoar).
await p.evaluate(() => {
  const el = [...document.querySelectorAll('h2')].find((h) => h.textContent.includes('Repertoar'))
  el?.scrollIntoView({ block: 'center' })
})
await wait(700)
await potret('repertoar-1-panel')

// 2. Pilihan lagu saat ekspor.
await klik('[data-testid="ekspor-repertoar"]')
await wait(900)
await potret('repertoar-2-ekspor')
await klik('[data-testid="unduh-repertoar"]')
await wait(2500)

// 3. Peringatan sebelum menimpa — impor berkas yang baru saja dibuat ke
//    perangkat yang sama, jadi semuanya jadi "ditimpa".
const berkas = fs.readdirSync(UNDUH).filter((f) => f.endsWith('.json'))
console.log('berkas:', berkas)
if (berkas.length) {
  const input = await p.$('[data-testid="berkas-repertoar"]')
  await input.uploadFile(`${UNDUH}/${berkas[0]}`)
  await wait(1800)
  await potret('repertoar-3-peringatan')
}

await browser.close()
console.log('selesai')
