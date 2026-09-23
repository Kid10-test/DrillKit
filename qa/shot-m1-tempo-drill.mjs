/**
 * Tangkapan layar M1 lanjutan C — tempo & segmen lagu dipakai drill.
 *
 * Menyemai lagu bertempo map (4/4 @120 → 7/8 @150 di birama 5), menautkannya
 * ke drill 4 set, lalu memotret editor dan presenter.
 *
 * Pakai: node shot-m1-tempo-drill.mjs [BASE_URL]
 */
import puppeteer from 'puppeteer'

const BASE = process.argv[2] || 'http://localhost:5173'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'],
})
const p = await browser.newPage()
await p.setViewport({ width: 1280, height: 1100, deviceScaleFactor: 2 })
await p.goto(BASE + '/', { waitUntil: 'networkidle2' })
await wait(2500)

await p.evaluate(async () => {
  const { db } = await import('/src/db/db.ts')

  const songId = 'shot-lagu-tempo'
  await db.songs.put({
    id: songId,
    title: 'Mars Uji — 4/4 lalu 7/8',
    bpm: 120,
    beats: 4,
    tempoMap: [
      { measure: 1, bpm: 120, birama: { pembilang: 4, penyebut: 4, notPerAcuan: 4, kelompok: [2, 2] } },
      { measure: 5, bpm: 150, birama: { pembilang: 7, penyebut: 8, notPerAcuan: 4, kelompok: [2, 2, 3] } },
    ],
  })

  // Drill dengan 6 set — beberapa anggota supaya formasi kelihatan.
  const drillId = 'shot-drill-tempo'
  await db.drills.put({
    id: drillId,
    name: 'Formasi Uji Tempo Lagu',
    showTitle: 'Formasi Uji Tempo Lagu',
    tempo: 120,
    beatsPerCount: 2,
    rosterIds: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    field: {
      widthYd: 53.33,
      lengthYd: 100,
      endZoneYd: 10,
      gridYd: 5,
      hash: 'ncaa',
      step: '8to5',
      customStepYd: 0.8333,
      showLabels: 1,
      satuan: 'yd',
    },
  })
  await db.sets.where('drillId').equals(drillId).delete()

  // Anggota contoh, ditata dalam blok 4×3 yang bergeser tiap set.
  const memberIds = []
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      const id = 'shot-anggota-' + r + '-' + c
      memberIds.push(id)
      await db.members.put({
        id,
        name: 'P' + (r * 4 + c + 1),
        code: String(r * 4 + c + 1),
        section: 'Brass',
        instrument: 'Trumpet',
      })
    }
  }

  for (let s = 0; s < 6; s++) {
    const points = {}
    memberIds.forEach((m, k) => {
      const r = Math.floor(k / 4)
      const c = k % 4
      points[m] = { x: 20 + c * 6 + s * 4, y: 25 + r * 8 + (s % 2) * 2 }
    })
    await db.sets.put({
      id: 'shot-set-' + s,
      drillId,
      order: s,
      name: 'Set ' + (s + 1),
      counts: 8,
      points,
      createdAt: Date.now(),
    })
  }
  await db.drills.update(drillId, { rosterIds: memberIds })
  await db.drills.update(drillId, { songId, updatedAt: Date.now() })
})

await p.evaluate(() => {
  location.hash = '#/drill'
})
await wait(1800)
await p.evaluate(() => {
  const el = [...document.querySelectorAll('button,a,li,div')].find(
    (b) => b.textContent.trim() === 'Formasi Uji Tempo Lagu' && b.offsetParent !== null,
  )
  el?.click()
})
await wait(1800)

// Pilih Set 2 — yang sudah melewati pergantian tempo di birama 5.
await p.evaluate(() => {
  const el = [...document.querySelectorAll('button')].find(
    (b) => b.textContent.includes('Set 2') && b.offsetParent !== null,
  )
  el?.click()
})
await wait(1000)

await p.screenshot({ path: '/home/user/shots/m1-tempo-drill-editor.png', fullPage: false })

// Presenter
const tombol = await p.$('[title*="Mode presenter"]')
if (tombol) {
  await tombol.click()
  await wait(1600)
  await p.screenshot({ path: '/home/user/shots/m1-tempo-drill-presenter.png', fullPage: false })
}

console.log('selesai')
await browser.close()
