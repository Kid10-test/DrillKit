// F3 — berbagi show dua arah
import puppeteer from 'puppeteer'
import fs from 'node:fs'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const R = {}
const DL = '/home/user/drillkit/qa/dlf3'; fs.rmSync(DL, { recursive: true, force: true }); fs.mkdirSync(DL, { recursive: true })
const jalan = async (nama, fn) => { try { await fn() } catch (e) { R[nama] = { GAGAL: String(e).split('\n')[0] } } }

async function buka(lebar = 1400, tinggi = 950, mobile = false) {
  const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--mute-audio'] })
  const p = await b.newPage()
  await p.setViewport({ width: lebar, height: tinggi, isMobile: mobile, hasTouch: mobile })
  const errs = []
  p.on('pageerror', (e) => errs.push(e.message.slice(0, 160)))
  p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)) })
  const cdp = await p.target().createCDPSession()
  await cdp.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: DL })
  await p.goto('http://localhost:5173/', { waitUntil: 'networkidle2' }); await wait(2400)
  await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((y) => y.textContent.includes('Muat data contoh')); x && x.click() }); await wait(3000)
  return { b, p, errs }
}
const bukaModal = async (p) => {
  await p.evaluate(() => { location.hash = '#/drill' }); await wait(2200)
  await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((b) => b.title?.includes('Pengaturan drill')); x && x.click() }); await wait(900)
}

// ---------- A. Kartu berbagi & ekspor ----------
await jalan('ekspor', async () => {
  const { b, p, errs } = await buka()
  await bukaModal(p)
  R.kartuAda = await p.evaluate(() => !!document.querySelector('[data-testid="kartu-berbagi-show"]'))
  await p.click('[data-testid="tombol-ekspor-show"]'); await wait(1500)
  const file = fs.readdirSync(DL).filter((f) => f.endsWith('.json'))
  R.berkas = { nama: file, jumlah: file.length }
  if (file.length) {
    const data = JSON.parse(fs.readFileSync(`${DL}/${file[0]}`, 'utf8'))
    R.isi = {
      format: data.format,
      versi: data.versi,
      namaDrill: data.drill?.name,
      jumlahSet: data.sets?.length,
      jumlahLagu: data.songs?.length,
      jumlahAnggota: data.members?.length,
      tokenKosong: (data.members ?? []).every((m) => !m.token),
      adaField: !!data.drill?.field,
      urutanSet: (data.sets ?? []).map((s) => s.order),
      tim: data.tim,
    }
  }
  R.ekspor = { errors: errs }
  await b.close()
})

// ---------- B. Impor — mode gabung ----------
await jalan('gabung', async () => {
  const { b, p, errs } = await buka()
  await bukaModal(p)
  await p.click('[data-testid="tombol-ekspor-show"]'); await wait(1500)
  const f = fs.readdirSync(DL).filter((x) => x.endsWith('.json'))[0]
  const data = JSON.parse(fs.readFileSync(`${DL}/${f}`, 'utf8'))

  // seolah-olah pelatih lain menyunting: ganti nama set, geser titik, tambah set,
  // dan menambah seorang anggota baru.
  data.drill.name = data.drill.name + ' (revisi teman)'
  data.sets[0].name = 'Set 1 — disusun ulang'
  const idTitik = Object.keys(data.sets[1].points)[0]
  data.sets[1].points[idTitik] = { ...data.sets[1].points[idTitik], x: data.sets[1].points[idTitik].x + 3 }
  data.sets.push({
    id: 'st_baru_teman',
    drillId: data.drill.id,
    order: 99,
    name: 'Set tambahan teman',
    counts: 8,
    points: { ...data.sets[0].points },
    createdAt: Date.now(),
  })
  data.members.push({
    id: 'm_teman_baru', code: 'T90', name: 'Anggota Baru Teman', section: 'brass',
    instrument: 'Trumpet', role: 'member', joinYear: 2026, active: 1, token: '', createdAt: Date.now(),
  })
  const berkas = '/home/user/drillkit/qa/dlf3/ubah-gabung.json'
  fs.writeFileSync(berkas, JSON.stringify(data))

  // set lokal yang hanya ada di sini
  await p.evaluate(async () => {
    const { db } = await import('/src/db/db.ts')
    const drills = await db.drills.toArray()
    const sets = await db.sets.where('drillId').equals(drills[0].id).toArray()
    await db.sets.put({ id: 'st_lokal_saja', drillId: drills[0].id, order: 50, name: 'Set lokal saja', counts: 4, points: { ...sets[0].points }, createdAt: Date.now() })
  })
  await wait(800)
  const input = await p.$('[data-testid="berkas-show"]')
  await input.uploadFile(berkas); await wait(1400)
  R.modalImpor = await p.evaluate(() => ({
    terbuka: !!document.querySelector('[data-testid="pilih-mode-impor"]'),
    ringkasan: document.body.innerText.replace(/\s+/g, ' ').match(/(\d+ set · \d+ pemain di formasi · \d+ lagu)/)?.[1] ?? '',
    opsi: [...document.querySelectorAll('[data-testid="pilih-mode-impor"] option')].map((o) => o.textContent.trim()),
  }))
  await p.select('[data-testid="pilih-mode-impor"]', 'gabung'); await wait(300)
  await p.click('[data-testid="tombol-proses-impor"]'); await wait(1600)
  R.hasilGabung = await p.evaluate(async () => {
    const { db } = await import('/src/db/db.ts')
    const drills = await db.drills.toArray()
    const sets = await db.sets.where('drillId').equals(drills[0].id).toArray()
    const anggota = await db.members.toArray()
    return {
      namaDrill: drills[0].name,
      jumlahSet: sets.length,
      namaSet1: sets.find((s) => s.order === 0)?.name,
      adaSetTeman: sets.some((s) => s.name === 'Set tambahan teman'),
      setLokalTetap: sets.some((s) => s.name === 'Set lokal saja'),
      anggotaBaru: anggota.some((m) => m.name === 'Anggota Baru Teman'),
      tokenAnggotaBaru: anggota.find((m) => m.name === 'Anggota Baru Teman')?.token ? 'ada' : 'kosong',
      toast: document.body.innerText.match(/Show "[^"]+" masuk[^\n]*/)?.[0] ?? '',
    }
  })
  R.gabung = { errors: errs }
  await b.close()
})

// ---------- C. Impor — mode timpa & salinan ----------
await jalan('timpaSalinan', async () => {
  const { b, p, errs } = await buka()
  await bukaModal(p)
  await p.click('[data-testid="tombol-ekspor-show"]'); await wait(1500)
  const f = fs.readdirSync(DL).filter((x) => x.endsWith('.json')).slice(-1)[0]
  const data = JSON.parse(fs.readFileSync(`${DL}/${f}`, 'utf8'))
  // simpan set lokal yang hanya ada di sini
  await p.evaluate(async () => {
    const { db } = await import('/src/db/db.ts')
    const drills = await db.drills.toArray()
    const sets = await db.sets.where('drillId').equals(drills[0].id).toArray()
    await db.sets.put({ id: 'st_lokal_saja', drillId: drills[0].id, order: 50, name: 'Set lokal saja', counts: 4, points: { ...sets[0].points }, createdAt: Date.now() })
  })
  await wait(700)

  // --- timpa ---
  const berkasTimpa = '/home/user/drillkit/qa/dlf3/ubah-timpa.json'
  fs.writeFileSync(berkasTimpa, JSON.stringify(data))
  let input = await p.$('[data-testid="berkas-show"]')
  await input.uploadFile(berkasTimpa); await wait(1300)
  await p.select('[data-testid="pilih-mode-impor"]', 'ganti'); await wait(300)
  await p.click('[data-testid="tombol-proses-impor"]'); await wait(1400)
  R.hasilTimpa = await p.evaluate(async () => {
    const { db } = await import('/src/db/db.ts')
    const drills = await db.drills.toArray()
    const sets = await db.sets.where('drillId').equals(drills[0].id).toArray()
    return {
      setLokalHilang: !sets.some((s) => s.name === 'Set lokal saja'),
      jumlahSet: sets.length,
      toast: document.body.innerText.match(/Show "[^"]+" masuk[^\n]*/)?.[0] ?? '',
    }
  })

  // --- salinan ---
  await bukaModal(p)
  input = await p.$('[data-testid="berkas-show"]')
  await input.uploadFile(berkasTimpa); await wait(1300)
  await p.select('[data-testid="pilih-mode-impor"]', 'salinan'); await wait(300)
  await p.click('[data-testid="tombol-proses-impor"]'); await wait(1800)
  R.hasilSalinan = await p.evaluate(async () => {
    const { db } = await import('/src/db/db.ts')
    const drills = await db.drills.toArray()
    const semua = await db.sets.toArray()
    return {
      jumlahDrill: drills.length,
      nama: drills.map((d) => d.name),
      setPerDrill: drills.map((d) => semua.filter((s) => s.drillId === d.id).length),
      drillDipilih: document.querySelector('header select, select')?.value ?? null,
      toast: document.body.innerText.match(/Show "[^"]+" masuk[^\n]*/)?.[0] ?? '',
    }
  })
  R.timpaSalinan = { errors: errs }
  await b.close()
})

// ---------- D. Berkas salah & penolakan ----------
await jalan('tolak', async () => {
  const { b, p, errs } = await buka()
  await bukaModal(p)
  const sebelum = await p.evaluate(async () => {
    const { db } = await import('/src/db/db.ts')
    return (await db.drills.toArray()).length
  })
  // #7 — berkas bukan show dialihkan ke pratinjau "tak dikenali", bukan ditolak.
  // (Dulu: toast "Bukan berkas show…"; kini: pratinjau menjelaskan + tak ada yang berubah.)
  fs.writeFileSync('/home/user/drillkit/qa/dlf3/bukan.json', JSON.stringify({ format: 'lain', versi: 9 }))
  let input = await p.$('[data-testid="berkas-show"]')
  await input.uploadFile('/home/user/drillkit/qa/dlf3/bukan.json'); await wait(1000)
  R.tolakFormat = await p.evaluate(() => ({
    pratinjau: !!document.querySelector('[data-testid="modal-buka-berkas"]'),
    takDikenal: !!document.querySelector('[data-testid="buka-tak-dikenal"]'),
  }))
  await p.click('[data-testid="buka-tutup"]'); await wait(600)

  // JSON rusak → pratinjau "tak dikenali" juga (dulu: toast "Berkas tidak bisa dibaca…").
  fs.writeFileSync('/home/user/drillkit/qa/dlf3/rusak.json', '{ ini bukan json')
  input = await p.$('[data-testid="berkas-show"]')
  await input.uploadFile('/home/user/drillkit/qa/dlf3/rusak.json'); await wait(1000)
  R.tolakRusak = await p.evaluate(() => ({
    pratinjau: !!document.querySelector('[data-testid="modal-buka-berkas"]'),
    takDikenal: !!document.querySelector('[data-testid="buka-tak-dikenal"]'),
  }))
  await p.click('[data-testid="buka-tutup"]'); await wait(600)

  // format benar tapi isinya rusak
  fs.writeFileSync('/home/user/drillkit/qa/dlf3/kurang.json', JSON.stringify({ format: 'drillkit-show', versi: 1, drill: { id: 'x' }, sets: 'bukan-array' }))
  input = await p.$('[data-testid="berkas-show"]')
  await input.uploadFile('/home/user/drillkit/qa/dlf3/kurang.json'); await wait(1000)
  R.tolakKurang = await p.evaluate(() => document.body.innerText.match(/(Daftar set di dalam[^\n]*|Data drill di dalam[^\n]*|Ada set di dalam[^\n]*)/)?.[1] ?? 'tidak ada')

  R.setelahTolak = await p.evaluate(async () => {
    const { db } = await import('/src/db/db.ts')
    return (await db.drills.toArray()).length
  })
  R.sebelum = sebelum
  R.tolak = { errors: errs }
  await b.close()
})

// ---------- E. Rapi di HP 390 ----------
await jalan('hp', async () => {
  const { b, p, errs } = await buka(390, 844, true)
  await bukaModal(p)
  R.hp = await p.evaluate(() => {
    const kartu = document.querySelector('[data-testid="kartu-berbagi-show"]')
    const r = kartu?.getBoundingClientRect()
    const tombol = [...(kartu?.querySelectorAll('button') ?? [])].map((b) => Math.round(b.getBoundingClientRect().height))
    return {
      ada: !!kartu,
      lebar: r ? Math.round(r.width) : -1,
      meluber: kartu ? kartu.scrollWidth > kartu.clientWidth + 1 : null,
      tinggiTombol: tombol,
      lebarLayar: document.documentElement.clientWidth,
    }
  })
  R.hpCase = { errors: errs }
  await b.close()
})

console.log(JSON.stringify(R, null, 1))
