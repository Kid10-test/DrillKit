import puppeteer from 'puppeteer'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--disable-setuid-sandbox'] })
const p = await browser.newPage()
await p.goto('http://localhost:5173/', { waitUntil: 'networkidle2' })
await wait(2500)
const r = await p.evaluate(async () => {
  const { db } = await import('/src/db/db.ts')
  return {
    drills: (await db.drills.toArray()).map(d => ({ id: d.id, name: d.name, songId: d.songId })),
    songs: (await db.songs.toArray()).map(s => ({ id: s.id, title: s.title })),
    sets: (await db.sets.toArray()).length,
  }
})
console.log(JSON.stringify(r, null, 1))
await browser.close()
