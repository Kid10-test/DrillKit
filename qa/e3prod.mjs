// E3 + B5 — uji di build produksi (4173) & portabel file://
import puppeteer from 'puppeteer'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const R = {}
const tekan = (p, label) => p.evaluate((label) => {
  const x = [...document.querySelectorAll('button')].find((e) => e.innerText.trim() === label)
  if (!x) return false
  x.click(); return true
}, label)

for (const [nama, url] of [['produksi', 'http://localhost:4173/'], ['portabel', 'file:///home/user/drillkit/portable/DrillKit.html']]) {
  const b = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--allow-file-access-from-files', '--autoplay-policy=no-user-gesture-required', '--mute-audio'],
  })
  const p = await b.newPage(); await p.setViewport({ width: 1400, height: 950 })
  await p.evaluateOnNewDocument(() => {
    window.__osc = 0
    const C = window.AudioContext || window.webkitAudioContext
    const asli = C.prototype.createOscillator
    C.prototype.createOscillator = function () { window.__osc++; return asli.call(this) }
  })
  const errs = []
  p.on('pageerror', (e) => errs.push(e.message.slice(0, 160)))
  p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)) })
  await p.goto(url, { waitUntil: 'networkidle2' }); await wait(2400)
  await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((y) => y.textContent.includes('Muat data contoh')); x && x.click() }); await wait(3000)

  const h = {}
  // ---- halaman Musik: pola, simpan, jalankan ----
  await p.evaluate(() => { location.hash = '#/musik' }); await wait(1600)
  h.kartuAda = await p.evaluate(() => !!document.querySelector('[data-testid="kartu-pola"]'))
  await p.click('[data-testid="tombol-pola-baru"]'); await wait(500)
  h.sel = await p.evaluate(() => [...document.querySelectorAll('[data-testid^="sel-0-"]')].map((s) => s.getAttribute('data-tingkat')))
  await p.click('[data-testid="sel-0-2"]'); await wait(300)
  h.setelahKlik = await p.evaluate(() => document.querySelector('[data-testid="sel-0-2"]').getAttribute('data-tingkat'))
  await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((e) => /BPM/.test(e.innerText)); x && x.click() })
  await wait(700)
  await p.click('[data-testid="tombol-simpan-pola"]'); await wait(1200)
  h.toast = await p.evaluate(() => document.body.innerText.match(/(Pola metronom disimpan|Pilih lagu dulu)/)?.[0] ?? 'tidak ada')
  const oscAwal = await p.evaluate(() => window.__osc)
  await tekan(p, 'Mulai'); await wait(2200)
  h.osilatorSaatJalan = (await p.evaluate(() => window.__osc)) - oscAwal
  h.indikator = await p.evaluate(() => {
    const ind = document.querySelector('[data-testid="indikator-pola"]')
    return ind ? [...ind.querySelectorAll('div')].filter((d) => d.className.includes('bg-emerald-400')).length : -1
  })
  await tekan(p, 'Berhenti'); await wait(800)
  const oscSetelah = await p.evaluate(() => window.__osc)
  await wait(800)
  h.osilatorSetelahBerhenti = (await p.evaluate(() => window.__osc)) - oscSetelah

  // ---- B5: klik di editor drill ----
  await p.evaluate(async () => {
    const q = indexedDB.open('drillkit')
    q.onsuccess = () => {
      const db = q.result
      const tx = db.transaction(['drills', 'sets'], 'readwrite')
      const dr = tx.objectStore('drills').getAll()
      dr.onsuccess = () => {
        const id = dr.result[0].id
        tx.objectStore('drills').put({ ...dr.result[0], tempo: 200, beatsPerCount: 1 })
        const st = tx.objectStore('sets').getAll()
        st.onsuccess = () => st.result.forEach((s) => tx.objectStore('sets').put({ ...s, counts: 4 }))
      }
    }
  })
  await p.reload({ waitUntil: 'networkidle2' }); await wait(3000)
  await p.evaluate(() => { location.hash = '#/drill' }); await wait(2400)
  await p.click('[data-testid="tombol-klik-editor"]'); await wait(400)
  h.klikTersimpan = await p.evaluate(() => { try { return JSON.parse(localStorage.getItem('drillkit.drillView') ?? '{}').klik } catch { return null } })
  const osc2 = await p.evaluate(() => window.__osc)
  await tekan(p, 'Mainkan'); await wait(2600)
  h.osilatorSaatMain = (await p.evaluate(() => window.__osc)) - osc2
  await wait(1600)
  const osc3 = await p.evaluate(() => window.__osc)
  await wait(1000)
  h.osilatorSetelahMain = (await p.evaluate(() => window.__osc)) - osc3

  // ---- B5: klik di presenter (urutan latihan) ----
  await p.keyboard.press('KeyF'); await wait(1800)
  h.chipKlik = await p.evaluate(() => !!document.querySelector('[data-testid="presenter"] [data-testid="chip-klik"]'))
  await p.click('[data-testid="presenter"] [data-testid="chip-klik"]'); await wait(400)
  const osc4 = await p.evaluate(() => window.__osc)
  await p.click('[data-testid="presenter"] [data-testid="tombol-urutan"]'); await wait(3200)
  h.osilatorSaatUrutan = (await p.evaluate(() => window.__osc)) - osc4
  await p.keyboard.press('Escape'); await wait(1400)
  const osc5 = await p.evaluate(() => window.__osc)
  await wait(1000)
  h.osilatorSetelahTutup = (await p.evaluate(() => window.__osc)) - osc5

  h.errors = errs
  R[nama] = h
  await b.close()
}

console.log(JSON.stringify(R, null, 1))
