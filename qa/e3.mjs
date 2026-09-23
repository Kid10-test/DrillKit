// E3 + B5 — metronom lanjutan & klik tempo saat latihan
import puppeteer from 'puppeteer'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const R = {}
const jalan = async (nama, fn) => { try { await fn() } catch (e) { R[nama] = { GAGAL: String(e).split('\n')[0] } } }

async function buka(lebar = 1400, tinggi = 950, mobile = false) {
  const b = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--mute-audio', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
  })
  const p = await b.newPage()
  await p.setViewport({ width: lebar, height: tinggi, isMobile: mobile, hasTouch: mobile })
  // Penghitung osilator: bukti bahwa bunyi benar-benar dijadwalkan.
  await p.evaluateOnNewDocument(() => {
    window.__osc = 0
    const C = window.AudioContext || window.webkitAudioContext
    const asli = C.prototype.createOscillator
    C.prototype.createOscillator = function () { window.__osc++; return asli.call(this) }
  })
  const errs = []
  p.on('pageerror', (e) => errs.push(e.message.slice(0, 160)))
  p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)) })
  await p.goto('http://localhost:5173/', { waitUntil: 'networkidle2' }); await wait(2200)
  await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((y) => y.textContent.includes('Muat data contoh')); x && x.click() }); await wait(2800)
  return { b, p, errs }
}

const tekan = (p, label) => p.evaluate((label) => {
  const x = [...document.querySelectorAll('button')].find((e) => e.innerText.trim() === label)
  if (!x) return false
  x.click(); return true
}, label)

// ---------- A. Mesin: ketepatan detak, pola, latih tempo ----------
await jalan('mesin', async () => {
  const { b, p, errs } = await buka()
  R.mesin = await p.evaluate(async () => {
    const { Metronom, polaBaku, klikUntukDrill } = await import('/src/lib/metronome.ts')
    const tidur = (ms) => new Promise((r) => setTimeout(r, ms))
    const kumpul = []
    const m = new Metronom()
    // 4/4, 240 BPM → 4 ketuk per detik
    m.mulai({ bpm: 240, beats: 4, subdiv: 1, onKetuk: (i) => kumpul.push({ t: performance.now(), i }) })
    await tidur(2100)
    m.berhenti()
    const selisih = []
    for (let i = 1; i < kumpul.length; i++) selisih.push(kumpul[i].t - kumpul[i - 1].t)
    const rata = selisih.reduce((a, x) => a + x, 0) / Math.max(1, selisih.length)
    const aksen = kumpul.filter((k) => k.i.sel === 2).length
    const biasa = kumpul.filter((k) => k.i.sel === 1).length

    // Pola: hanya ketuk 1 & 3 yang bunyi
    const pola = { bars: [{ id: 'x', beats: 4, subdiv: 1, cells: [2, 0, 1, 0] }], poly: null }
    const k2 = []
    const m2 = new Metronom()
    m2.mulai({ bpm: 240, beats: 4, subdiv: 1, pola, onKetuk: (i) => k2.push(i) })
    await tidur(1100)
    m2.berhenti()
    const selUnik = [...new Set(k2.map((k) => k.beat))].sort()

    // Latih tempo: 100 → 140, +10 tiap birama
    const k3 = []
    const m3 = new Metronom()
    m3.mulai({
      bpm: 100, beats: 4, subdiv: 1,
      latih: { on: true, dari: 100, ke: 140, langkah: 10, tiap: 1 },
      onKetuk: (i) => k3.push(i),
    })
    await tidur(2600)
    m3.berhenti()
    const bpm3 = [...new Set(k3.map((k) => Math.round(k.bpm)))]

    // Poliritme: suara kedua ikut berbunyi
    const k4 = []
    const m4 = new Metronom()
    m4.mulai({
      bpm: 240, beats: 4, subdiv: 1,
      pola: { bars: [polaBaku(4, 1)], poly: { beats: 3, subdiv: 1, cells: [2, 1, 1] } },
      onKetuk: (i) => k4.push(i),
    })
    await tidur(1100)
    m4.berhenti()

    return {
      jumlahKetuk: kumpul.length,
      rataMs: Math.round(rata),
      targetMs: 250,
      aksen, biasa,
      polaBeatUnik: selUnik,
      jumlahPola: k2.length,
      latihBpm: bpm3,
      suaraKedua: k4.filter((k) => k.suara === 2).length,
      klikDrill: klikUntukDrill(120, 2, 8),
    }
  })
  R.mesin.errors = errs
  await b.close()
})

// ---------- B. Antarmuka halaman Musik ----------
await jalan('antarmuka', async () => {
  const { b, p, errs } = await buka()
  await p.evaluate(() => { location.hash = '#/musik' }); await wait(1600)
  R.kartuAda = await p.evaluate(() => !!document.querySelector('[data-testid="kartu-pola"]'))
  await p.click('[data-testid="tombol-pola-baru"]'); await wait(700)
  R.setelahPolaBaru = await p.evaluate(() => {
    const bar = document.querySelector('[data-testid="editor-birama-0"]')
    return {
      ada: !!bar,
      sel: [...(bar?.querySelectorAll('[data-testid^="sel-0-"]') ?? [])].map((s) => s.getAttribute('data-tingkat')),
    }
  })
  // klik kotak → siklus 0→1→2→0 (kotak 3 yang tadinya "1")
  await p.click('[data-testid="sel-0-2"]'); await wait(250)
  R.setelahKlik1 = await p.evaluate(() => document.querySelector('[data-testid="sel-0-2"]').getAttribute('data-tingkat'))
  await p.click('[data-testid="sel-0-2"]'); await wait(250)
  R.setelahKlik2 = await p.evaluate(() => document.querySelector('[data-testid="sel-0-2"]').getAttribute('data-tingkat'))
  await p.click('[data-testid="sel-0-2"]'); await wait(250)
  R.setelahKlik3 = await p.evaluate(() => document.querySelector('[data-testid="sel-0-2"]').getAttribute('data-tingkat'))

  // ubah ketukan & pembagian
  await p.evaluate(() => {
    const sel = document.querySelectorAll('[data-testid="editor-birama-0"] select')
    return sel.length
  })
  await p.select('[data-testid="editor-birama-0"] select:nth-of-type(1)', '6').catch(() => {})
  await p.evaluate(() => {
    const sels = document.querySelectorAll('[data-testid="editor-birama-0"] select')
    const set = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set
    set.call(sels[0], '6'); sels[0].dispatchEvent(new Event('change', { bubbles: true }))
  })
  await wait(400)
  R.setelah6Ketuk = await p.evaluate(() => document.querySelectorAll('[data-testid^="sel-0-"]').length)
  await p.evaluate(() => {
    const sels = document.querySelectorAll('[data-testid="editor-birama-0"] select')
    const set = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set
    set.call(sels[1], '2'); sels[1].dispatchEvent(new Event('change', { bubbles: true }))
  })
  await wait(400)
  R.setelahSubdiv2 = await p.evaluate(() => document.querySelectorAll('[data-testid^="sel-0-"]').length)

  // tambah / salin / hapus birama
  await p.click('[data-testid="tombol-tambah-birama"]'); await wait(400)
  R.jumlahBirama = await p.evaluate(() => document.querySelectorAll('[data-testid^="editor-birama-"]').length)
  await p.evaluate(() => { const x = [...document.querySelectorAll('[data-testid="editor-birama-0"] button')].find((b) => b.innerText.trim() === 'Salin'); x && x.click() })
  await wait(400)
  R.setelahSalin = await p.evaluate(() => document.querySelectorAll('[data-testid^="editor-birama-"]').length)
  await p.evaluate(() => { const x = [...document.querySelectorAll('[data-testid="editor-birama-1"] button')].find((b) => b.innerText.trim() === 'Hapus'); x && x.click() })
  await wait(400)
  R.setelahHapus = await p.evaluate(() => document.querySelectorAll('[data-testid^="editor-birama-"]').length)

  // poliritme
  await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((e) => e.innerText.includes('Poliritme')); x && x.click() })
  await wait(500)
  R.poliritme = await p.evaluate(() => {
    const ed = document.querySelector('[data-testid="editor-poliritme"]')
    return { ada: !!ed, kotak: ed ? ed.querySelectorAll('button[data-tingkat]').length : 0, id: ed ? ed.querySelectorAll('button[data-testid^="sel-poly-"]').length : 0 }
  })
  await p.evaluate(() => { const x = document.querySelector('[data-testid="sel-poly-0"]'); x && x.click() })
  await wait(300)
  R.poliritme.setelahKlik = await p.evaluate(() => document.querySelector('[data-testid="sel-poly-0"]').getAttribute('data-tingkat'))

  // latih tempo
  await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((e) => e.innerText.includes('Latih tempo')); x && x.click() })
  await wait(400)
  R.latih = await p.evaluate(() => {
    const k = document.querySelector('[data-testid="kartu-latih-tempo"]')
    return { ada: !!k, isian: k ? k.querySelectorAll('input[type="number"]').length : 0 }
  })

  // simpan ke lagu (perlu lagu dipilih dulu)
  await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((e) => e.innerText.trim().includes('BPM')); x && x.click() })
  await wait(800)
  R.laguDipilih = await p.evaluate(() => !!document.querySelector('[data-testid="tombol-simpan-pola"]'))
  R.kotorSebelumSimpan = await p.evaluate(() => !!document.querySelector('[data-testid="tanda-belum-simpan"]'))
  await p.click('[data-testid="tombol-simpan-pola"]').catch(async () => {
    await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((e) => e.innerText.includes('Simpan ke lagu')); x && x.click() })
  })
  await wait(1200)
  R.setelahSimpan = await p.evaluate(async () => {
    const { db } = await import('/src/db/db.ts')
    const lagu = await db.songs.toArray()
    const punya = lagu.filter((s) => s.pola && s.pola.bars.length > 0)
    return {
      jumlahLagu: lagu.length,
      tersimpan: punya.length,
      birama: punya[0]?.pola?.bars.length ?? 0,
      poly: !!punya[0]?.pola?.poly,
      latih: !!punya[0]?.latih?.on,
      suara: punya[0]?.suara ?? null,
    }
  })
  // muat ulang → pola terbaca lagi
  await p.reload({ waitUntil: 'networkidle2' }); await wait(2600)
  await p.evaluate(() => { location.hash = '#/musik' }); await wait(1500)
  await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((e) => e.innerText.trim().includes('BPM')); x && x.click() })
  await wait(1000)
  R.kotorSetelahSimpan = await p.evaluate(() => !!document.querySelector('[data-testid="tanda-belum-simpan"]'))
  R.setelahMuatUlang = await p.evaluate(() => ({
    birama: document.querySelectorAll('[data-testid^="editor-birama-"]').length,
    poliritme: !!document.querySelector('[data-testid="editor-poliritme"]'),
    latih: !!document.querySelector('[data-testid="kartu-latih-tempo"] input'),
  }))
  R.antarmuka = { errors: errs }
  await b.close()
})

// ---------- C. Metronom jalan & pola disorot ----------
await jalan('berjalan', async () => {
  const { b, p, errs } = await buka()
  await p.evaluate(() => { location.hash = '#/musik' }); await wait(1500)
  await p.click('[data-testid="tombol-pola-baru"]'); await wait(500)
  const sebelum = await p.evaluate(() => window.__osc)
  await tekan(p, 'Mulai'); await wait(2500)
  const sesudah = await p.evaluate(() => window.__osc)
  R.jalan = await p.evaluate(() => {
    const ind = document.querySelector('[data-testid="indikator-pola"]')
    const menyala = [...(ind?.querySelectorAll('div') ?? [])].filter((d) => d.className.includes('bg-emerald-400')).length
    return { kotakMenyala: menyala, adaIndikator: !!ind }
  })
  R.jalan.osilator = sesudah - sebelum
  await tekan(p, 'Berhenti'); await wait(600)
  const setelah = await p.evaluate(() => window.__osc)
  await wait(900)
  R.jalan.osilatorSetelahBerhenti = (await p.evaluate(() => window.__osc)) - setelah
  R.berjalan = { errors: errs }
  await b.close()
})

// ---------- D. B5 — klik saat animasi di editor ----------
await jalan('klikEditor', async () => {
  const { b, p, errs } = await buka()
  await p.evaluate(() => { location.hash = '#/drill' }); await wait(2400)
  R.klikEditor = { tombolAda: await p.evaluate(() => !!document.querySelector('[data-testid="tombol-klik-editor"]')) }
  await p.click('[data-testid="tombol-klik-editor"]'); await wait(500)
  R.klikEditor.tersimpan = await p.evaluate(() => {
    try { return JSON.parse(localStorage.getItem('drillkit.drillView') ?? '{}').klik } catch { return null }
  })
  // atur tempo & count supaya singkat
  await p.evaluate(async () => {
    const { db } = await import('/src/db/db.ts')
    const drills = await db.drills.toArray()
    await db.drills.update(drills[0].id, { tempo: 200, updatedAt: Date.now() })
    const sets = await db.sets.where('drillId').equals(drills[0].id).toArray()
    for (const s of sets) await db.sets.put({ ...s, counts: 4 })
  })
  await p.reload({ waitUntil: 'networkidle2' }); await wait(2800)
  await p.evaluate(() => { location.hash = '#/drill' }); await wait(2400)
  const sebelum = await p.evaluate(() => window.__osc)
  await tekan(p, 'Mainkan'); await wait(2600)
  const selama = (await p.evaluate(() => window.__osc)) - sebelum
  await wait(1500)
  const setelah = (await p.evaluate(() => window.__osc))
  await wait(1200)
  R.klikEditor.osilatorSaatMain = selama
  R.klikEditor.osilatorSetelahSelesai = (await p.evaluate(() => window.__osc)) - setelah
  R.klikEditor.errors = errs
  await b.close()
})

// ---------- E. B5 — klik saat urutan latihan di presenter ----------
await jalan('klikPresenter', async () => {
  const { b, p, errs } = await buka(390, 844, true)
  await p.evaluate(() => { location.hash = '#/drill' }); await wait(2400)
  await p.evaluate(async () => {
    const { db } = await import('/src/db/db.ts')
    const drills = await db.drills.toArray()
    await db.drills.update(drills[0].id, { tempo: 200, beatsPerCount: 1, updatedAt: Date.now() })
    const sets = await db.sets.where('drillId').equals(drills[0].id).toArray()
    for (const s of sets) await db.sets.put({ ...s, counts: 2 })
  })
  await p.reload({ waitUntil: 'networkidle2' }); await wait(2800)
  await p.evaluate(() => { location.hash = '#/drill' }); await wait(2400)
  await p.keyboard.press('KeyF'); await wait(1600)
  R.klikPresenter = { chipAda: await p.evaluate(() => !!document.querySelector('[data-testid="presenter"] [data-testid="chip-klik"]')) }
  await p.click('[data-testid="presenter"] [data-testid="chip-klik"]'); await wait(400)
  const sebelum = await p.evaluate(() => window.__osc)
  await p.click('[data-testid="presenter"] [data-testid="tombol-urutan"]'); await wait(3000)
  const selama = (await p.evaluate(() => window.__osc)) - sebelum
  await p.keyboard.press('Escape'); await wait(1200)
  const setelah = await p.evaluate(() => window.__osc)
  await wait(1200)
  R.klikPresenter.osilatorSaatUrutan = selama
  R.klikPresenter.osilatorSetelahTutup = (await p.evaluate(() => window.__osc)) - setelah
  R.klikPresenter.errors = errs
  await b.close()
})

// ---------- F. Rapi di HP 390 ----------
await jalan('hp', async () => {
  const { b, p, errs } = await buka(390, 844, true)
  await p.evaluate(() => { location.hash = '#/musik' }); await wait(1500)
  await p.click('[data-testid="tombol-pola-baru"]'); await wait(600)
  await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((e) => e.innerText.includes('Poliritme')); x && x.click() })
  await wait(400)
  R.hp = await p.evaluate(() => {
    const dok = document.documentElement
    const lebar = dok.clientWidth
    const dalamWadahGeser = (el) => {
      let n = el.parentElement
      while (n && n !== document.body) {
        const ox = getComputedStyle(n).overflowX
        if (ox === 'auto' || ox === 'scroll') return true
        n = n.parentElement
      }
      return false
    }
    const meluber = [...document.querySelectorAll('body *')]
      .filter((el) => el.getBoundingClientRect().right > lebar + 2 && getComputedStyle(el).position !== 'fixed')
      .filter((el) => !dalamWadahGeser(el))
      .slice(0, 5)
      .map((el) => ({ t: el.tagName + '.' + String(el.className).slice(0, 34), kanan: Math.round(el.getBoundingClientRect().right) }))
    return { geser: dok.scrollWidth > dok.clientWidth + 1, meluber, lebarLayar: lebar }
  })
  R.hpCase = { errors: errs }
  await b.close()
})

console.log(JSON.stringify(R, null, 1))
