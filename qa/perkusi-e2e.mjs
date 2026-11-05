/**
 * #28 — Studio Perkusi (Battery & Pit): uji peramban ujung ke ujung.
 *
 * Logika murninya diuji di `perkusi-logika.mjs`. Di sini sambungannya:
 *
 *   1. Pelatih memasang skor drumline → tombol 🥁 Perkusi muncul di Layar
 *      Partitur; studio menyerap 19 sticking tanpa diketik ulang.
 *   2. Grid birama: R L R R L R L L; ketuk not → editor R/L/B, aksen, flam,
 *      drag, diddle, buzz; revisi tersimpan di `anotasiPartitur` (berkas skor
 *      di `partiturBerkas` tidak berubah sebita pun); ↺ Asli; ◀ ▶ birama;
 *      ganti part (Bass: "B2+B4"); tampilkan/sembunyikan revisi; bunyi
 *      battery; Hapus semua revisi.
 *   3. Pemanasan perkusi di kartu Pola ritme: 8 on a Hand → 8 birama,
 *      sticking per kotak, bunyi Snare, latih tempo menyala; ubah ketukan
 *      memangkas sticking; metronom berjalan tanpa galat.
 *   4. Anggota snare membuka berkas pribadinya: partitur hanya P1, revisi P1
 *      tampil oranye, tanpa editor & tanpa Hapus semua.
 *   5. Lebar HP 360 px tanpa gulir mendatar; nol galat konsol.
 *
 * Pakai: bash qa/bangun-logika.sh && BASE=http://localhost:4173 node qa/perkusi-e2e.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'
import { lewatSambutan } from './sambutan.mjs'
import { SKOR_DRUMLINE } from './fikstur-perkusi.mjs'
import { paketAnggota } from '/tmp/bagikan.mjs'
import { buatLampiranPartiturPaket } from '/tmp/partiturPaket.mjs'
import { ringkasMusicXml } from '/tmp/partitur.mjs'

const QA = path.dirname(fileURLToPath(import.meta.url))
const BASE = process.env.BASE || process.argv[2] || 'http://localhost:4173'
const BERKAS = path.join(QA, 'berkas-perkusi')
fs.rmSync(BERKAS, { recursive: true, force: true })
fs.mkdirSync(BERKAS, { recursive: true })
const fSkor = path.join(BERKAS, 'Cadence Uji.musicxml')
fs.writeFileSync(fSkor, SKOR_DRUMLINE)

let lulus = 0
const gagal = []
const cek = (nama, syarat, keterangan = '') => {
  if (syarat) {
    lulus += 1
    console.log(`  ✓ ${nama}`)
  } else {
    const baris = `${nama}${keterangan ? ' — ' + keterangan : ''}`
    gagal.push(baris)
    console.log('  ✗ ' + baris)
  }
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const ada = async (hal, sel) => (await hal.$(sel)) != null
const teks = (hal, sel) => hal.$eval(sel, (e) => (e.textContent ?? '').replace(/\s+/g, ' ').trim())
const klik = async (hal, sel) => {
  await hal.waitForSelector(sel, { timeout: 12000 })
  await hal.$eval(sel, (e) => e.scrollIntoView({ block: 'center' }))
  await hal.click(sel)
}
const ke = async (hal, rute) => {
  await hal.evaluate((r) => {
    location.hash = r
  }, rute)
  await wait(1600)
}
const bacaTabel = (hal, t) =>
  hal.evaluate(
    (nama) =>
      new Promise((selesai, tolak) => {
        const req = indexedDB.open('drillkit')
        req.onerror = () => tolak(String(req.error))
        req.onsuccess = () => {
          const db = req.result
          if (!db.objectStoreNames.contains(nama)) {
            db.close()
            selesai([])
            return
          }
          const q = db.transaction(nama, 'readonly').objectStore(nama).getAll()
          q.onsuccess = () => {
            db.close()
            selesai(q.result)
          }
          q.onerror = () => tolak(String(q.error))
        }
      }),
    t,
  )
const teksBlob = (hal, songId) =>
  hal.evaluate(async (id) => {
    const db = await new Promise((s, t) => {
      const r = indexedDB.open('drillkit')
      r.onsuccess = () => s(r.result)
      r.onerror = () => t(String(r.error))
    })
    const item = await new Promise((s) => {
      const q = db.transaction('partiturBerkas', 'readonly').objectStore('partiturBerkas').get(id)
      q.onsuccess = () => s(q.result ?? null)
    })
    db.close()
    return item?.blob ? await item.blob.text() : null
  }, songId)
const urutan = (hal) => teks(hal, '[data-testid="studio-perkusi-urutan"]')
const revisiDb = async (hal, id) => (await bacaTabel(hal, 'anotasiPartitur')).find((a) => a.songId === id)?.revisi ?? []

const browser = await puppeteer.launch({
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required'],
  defaultViewport: { width: 1360, height: 1000 },
  env: { ...process.env, LANG: process.env.LANG || 'C.utf8' },
})
const errors = []
const p = await browser.newPage()
p.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text())
})
p.on('pageerror', (e) => errors.push(String(e)))
p.on('dialog', async (d) => {
  await d.accept()
})

try {
  await p.goto(BASE, { waitUntil: 'networkidle2' })
  await lewatSambutan(p)
  await p.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('Muat data contoh'))
    if (b) b.click()
  })
  await wait(3500)
  const lagu = (await bacaTabel(p, 'songs'))[0]
  cek('data contoh memuat lagu', Boolean(lagu?.id))

  console.log('\n1. Pasang skor drumline & buka Studio Perkusi')
  await ke(p, '#/musik')
  await klik(p, `[data-testid="pilih-lagu-${lagu.id}"]`)
  await p.waitForSelector('[data-testid="panel-partitur"]', { timeout: 10000 })
  const input = await p.$('#partitur-input')
  await input.uploadFile(fSkor)
  await klik(p, '[data-testid="partitur-simpan"]')
  await wait(1500)
  const blobAwal = await teksBlob(p, lagu.id)
  cek('skor tersimpan apa adanya', blobAwal === SKOR_DRUMLINE)
  await klik(p, '[data-testid="partitur-buka"]')
  await p.waitForFunction(() => document.querySelector('[data-testid="partitur-kanvas-svg"] svg'), { timeout: 30000 })
  await p.waitForSelector('[data-testid="partitur-studio-perkusi"]', { timeout: 10000 })
  cek('tombol 🥁 Perkusi muncul untuk skor drumline', /Perkusi/.test(await teks(p, '[data-testid="partitur-studio-perkusi"]')))
  await klik(p, '[data-testid="partitur-studio-perkusi"]')
  await p.waitForSelector('[data-testid="studio-perkusi"]', { timeout: 10000 })
  const ringkas = await teks(p, '[data-testid="studio-perkusi-ringkas"]')
  cek('ringkas: 4 part · 19 sticking terbaca dari skor', /4 part/.test(ringkas) && /19 sticking/.test(ringkas), ringkas)
  cek('pilihan part: Snare, Tenor, Bass, Marimba (Trumpet tidak ada)', JSON.stringify(await p.$$eval('[data-testid="studio-perkusi-part"] option', (o) => o.map((x) => x.value))) === '["P1","P2","P3","P4"]')
  cek('birama 1 snare: R L R R L R L L', (await urutan(p)) === 'R L R R L R L L', await urutan(p))
  cek('sel 1 beraksen (>) & sel 4 flam (ƒ)', /^R>/.test(await teks(p, '[data-testid="studio-perkusi-sel-0"]')) && /ƒ/.test(await teks(p, '[data-testid="studio-perkusi-sel-3"]')))

  console.log('\n2. Revisi lapangan')
  await klik(p, '[data-testid="studio-perkusi-sel-1"]')
  await p.waitForSelector('[data-testid="studio-perkusi-editor"]', { timeout: 5000 })
  await klik(p, '[data-testid="studio-perkusi-sticking-R"]')
  await wait(500)
  cek('L → R: urutan R R R R L R L L', (await urutan(p)) === 'R R R R L R L L', await urutan(p))
  cek('sel bertanda direvisi', (await p.$eval('[data-testid="studio-perkusi-sel-1"]', (e) => e.dataset.direvisi)) === '1')
  let rev = await revisiDb(p, lagu.id)
  cek('revisi tersimpan di anotasiPartitur', rev.length === 1 && rev[0].sticking === 'R' && rev[0].kunci === 'P1|1|1|0.5', JSON.stringify(rev))
  await klik(p, '[data-testid="studio-perkusi-sel-2"]')
  await klik(p, '[data-testid="studio-perkusi-drag"]')
  await klik(p, '[data-testid="studio-perkusi-marcato"]')
  await wait(500)
  rev = await revisiDb(p, lagu.id)
  cek('drag + marcato menjadi satu revisi', rev.length === 2 && rev.some((r) => r.kunci === 'P1|1|1|1' && r.flam === 2 && r.aksen === 2), JSON.stringify(rev))
  cek('tombol menghitung revisi (· 2)', /· 2/.test(await teks(p, '[data-testid="partitur-studio-perkusi"]')))
  await wait(1500)
  cek('berkas skor asli tidak berubah sebita pun', (await teksBlob(p, lagu.id)) === SKOR_DRUMLINE)
  cek('partitur tetap tergambar sesudah disuntik', await ada(p, '[data-testid="partitur-kanvas-svg"] svg'))
  await klik(p, '[data-testid="studio-perkusi-sel-1"]')
  await klik(p, '[data-testid="studio-perkusi-asli"]')
  await wait(500)
  cek('↺ Asli: tinggal 1 revisi, urutan kembali L', (await revisiDb(p, lagu.id)).length === 1 && (await urutan(p)) === 'R L R R L R L L')
  await klik(p, '[data-testid="studio-perkusi-ikuti"]')
  await klik(p, '[data-testid="studio-perkusi-birama-tambah"]')
  await wait(400)
  cek('▶ birama 2 / 2: R L R', /Birama 2 \/ 2/.test(await teks(p, '[data-testid="studio-perkusi-birama"]')) && (await urutan(p)) === 'R L R')
  cek('birama 2: diddle (≡) & buzz (z)', /≡/.test(await teks(p, '[data-testid="studio-perkusi-sel-1"]')) && /z/.test(await teks(p, '[data-testid="studio-perkusi-sel-2"]')))
  await klik(p, '[data-testid="studio-perkusi-birama-kurang"]')
  await p.select('[data-testid="studio-perkusi-part"]', 'P3')
  await wait(400)
  cek('part Bass: akor "B2+B4"', /B2\+B4/.test(await teks(p, '[data-testid="studio-perkusi-sel-0"]')), await teks(p, '[data-testid="studio-perkusi-sel-0"]'))
  await klik(p, '[data-testid="studio-perkusi-sel-1"]')
  await klik(p, '[data-testid="studio-perkusi-sticking-L"]')
  await wait(400)
  cek('bass tanpa sticking kini L', (await teks(p, '[data-testid="studio-perkusi-sel-1"]')).startsWith('L'))
  await klik(p, '[data-testid="studio-perkusi-tampil-revisi"]')
  await wait(900)
  await klik(p, '[data-testid="studio-perkusi-tampil-revisi"]')
  await wait(900)
  cek('sembunyikan/tampilkan revisi: partitur tetap tergambar', await ada(p, '[data-testid="partitur-kanvas-svg"] svg'))
  if (await ada(p, '[data-testid="partitur-bunyikan-not"]')) {
    await klik(p, '[data-testid="partitur-bunyikan-not"]')
    await wait(1500)
    await klik(p, '[data-testid="partitur-bunyikan-not"]')
    await wait(300)
  }
  cek('bunyi battery tanpa galat', errors.filter((e) => !/favicon|AudioContext|autoplay/i.test(e)).length === 0, errors.join(' | ').slice(0, 300))
  await klik(p, '[data-testid="studio-perkusi-hapus-semua"]')
  await wait(600)
  cek('Hapus semua revisi: tabel kosong', (await revisiDb(p, lagu.id)).length === 0)
  await p.select('[data-testid="studio-perkusi-part"]', 'P1')
  await wait(300)

  console.log('\n3. Pemanasan perkusi')
  await klik(p, '[data-testid="partitur-buka"]')
  await wait(500)
  await p.waitForSelector('[data-testid="pilih-pemanasan-perkusi"]', { timeout: 8000 })
  await p.select('[data-testid="pilih-pemanasan-perkusi"]', 'delapan-satu-tangan')
  await wait(700)
  cek('8 on a Hand: 8 birama di editor pola', (await ada(p, '[data-testid="editor-birama-7"]')) && !(await ada(p, '[data-testid="editor-birama-8"]')))
  cek('sticking per kotak: R×8 lalu L', (await teks(p, '[data-testid="sticking-0-0"]')).startsWith('R') && (await teks(p, '[data-testid="sticking-1-0"]')).startsWith('L'))
  cek('bunyi metronom: Snare', (await p.$eval('[data-testid="pilih-suara"]', (e) => e.value)) === 'snare')
  cek('latih tempo menyala 100 → 160', /100/.test(await teks(p, '[data-testid="latih-ringkasan"]')) && /160/.test(await teks(p, '[data-testid="latih-ringkasan"]')), await teks(p, '[data-testid="latih-ringkasan"]').catch(() => '—'))
  await p.$eval('[data-testid="editor-birama-0"] select', (s) => {
    s.value = '2'
    s.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await wait(400)
  cek('ubah ketukan → sticking ikut dipangkas (4 kotak)', (await p.$$('[data-testid^="sticking-0-"]')).length === 4)
  await klik(p, '[data-testid="tombol-mulai"]')
  await wait(1800)
  await klik(p, '[data-testid="tombol-mulai"]')
  await wait(300)
  cek('metronom snare berjalan tanpa galat', errors.filter((e) => !/favicon|AudioContext|autoplay/i.test(e)).length === 0, errors.join(' | ').slice(0, 300))

  console.log('\n4. Lebar HP 360 px')
  await klik(p, '[data-testid="partitur-buka"]')
  await p.waitForSelector('[data-testid="partitur-studio-perkusi"]', { timeout: 15000 })
  if (!(await ada(p, '[data-testid="studio-perkusi"]'))) await klik(p, '[data-testid="partitur-studio-perkusi"]')
  await p.setViewport({ width: 360, height: 780 })
  await wait(900)
  const lebar = await p.evaluate(() => document.documentElement.scrollWidth)
  cek('tanpa gulir mendatar di 360 px (studio terbuka)', lebar <= 360, String(lebar))
  await p.setViewport({ width: 1360, height: 1000 })

  console.log('\n5. Anggota snare membuka berkas pribadinya')
  const bita = new TextEncoder().encode(SKOR_DRUMLINE)
  const r = ringkasMusicXml(SKOR_DRUMLINE)
  const revisiPaket = [
    { kunci: 'P1|1|1|0.5', idPart: 'P1', birama: 1, sticking: 'R', diubah: 1 },
    { kunci: 'P3|1|1|1', idPart: 'P3', birama: 1, sticking: 'L', diubah: 2 },
  ]
  const dasar = {
    format: 'drillkit-share',
    version: 1,
    exportedAt: Date.now(),
    team: { teamName: 'MB Uji Studio', coachName: 'Raka', defaultField: {} },
    members: [
      { id: 'm-sn', code: 'P01', name: 'Budi Snare', section: 'battery', instrument: 'Snare Drum', role: 'member', yearJoined: 2025, active: 1, token: 't1' },
      { id: 'm-bd', code: 'P02', name: 'Sari Bass', section: 'battery', instrument: 'Bass Drums', role: 'member', yearJoined: 2025, active: 1, token: 't2' },
    ],
    sessions: [],
    drills: [],
    sets: [],
    songs: [{ id: 'lagu-perkusi', title: 'Cadence Uji Studio', bpm: 120, beats: 4, tempoMap: [], createdAt: 1, panjangBirama: 2, partitur: { namaFile: 'cadence.musicxml', tipe: 'musicxml', ukuran: bita.byteLength, hash: 'hash-c', jumlahBirama: 2, jumlahPart: 5, parts: r.ok ? r.ringkas.parts : [], terurai: true, dipasangiAt: 1 } }],
    partiturPaket: { 'lagu-perkusi': buatLampiranPartiturPaket('lagu-perkusi', 'cadence.musicxml', 'musicxml', bita, 'hash-c') },
    anotasiPartitur: [{ id: 'lagu-perkusi', songId: 'lagu-perkusi', revisi: revisiPaket, hashPartitur: 'hash-c', updatedAt: 3 }],
    attendance: [],
    memberNotes: [],
  }
  const pkt = paketAnggota(dasar, 'm-sn')
  cek('berkas anggota snare: revisi P1 saja', pkt.anotasiPartitur?.[0]?.revisi.length === 1 && pkt.anotasiPartitur[0].revisi[0].idPart === 'P1')
  const fPkt = path.join(BERKAS, 'DrillKit - UNTUK ANGGOTA - Budi Snare.json')
  fs.writeFileSync(fPkt, JSON.stringify(pkt))

  const ctx = await browser.createBrowserContext()
  const m = await ctx.newPage()
  m.on('console', (x) => {
    if (x.type() === 'error') errors.push('[anggota] ' + x.text())
  })
  m.on('pageerror', (e) => errors.push('[anggota] ' + String(e)))
  m.on('dialog', async (d) => {
    await d.accept()
  })
  await m.goto(BASE, { waitUntil: 'networkidle2' })
  await lewatSambutan(m, 'member')
  await m.goto(`${BASE}/#/berbagi`, { waitUntil: 'networkidle2' })
  await wait(2000)
  const masuk = await m.$('#pkg-input')
  await masuk.uploadFile(fPkt)
  await wait(3000)
  const revAnggota = (await bacaTabel(m, 'anotasiPartitur'))[0]?.revisi ?? []
  cek('HP anggota: revisi terpasang (1, P1)', revAnggota.length === 1 && revAnggota[0].idPart === 'P1', JSON.stringify(revAnggota))
  cek('paket di HP tidak menyalin ulang revisi', (await bacaTabel(m, 'packages'))[0]?.data?.anotasiPartitur === undefined)
  // Mode anggota: Musik adalah tab di halaman Berbagi.
  await klik(m, '[data-testid="tab-musik"]')
  await wait(2000)
  if (await ada(m, '[data-testid="pilih-lagu-lagu-perkusi"]')) await klik(m, '[data-testid="pilih-lagu-lagu-perkusi"]')
  else {
    await m.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((y) => y.textContent.includes('Cadence Uji Studio'))
      b?.click()
    })
  }
  await wait(1200)
  await klik(m, '[data-testid="partitur-buka"]')
  await m.waitForFunction(() => document.querySelector('[data-testid="partitur-kanvas-svg"] svg'), { timeout: 30000 })
  await m.waitForSelector('[data-testid="partitur-studio-perkusi"]', { timeout: 10000 })
  await klik(m, '[data-testid="partitur-studio-perkusi"]')
  await m.waitForSelector('[data-testid="studio-perkusi"]', { timeout: 10000 })
  cek('anggota: studio hanya part snare', JSON.stringify(await m.$$eval('[data-testid="studio-perkusi-part"] option', (o) => o.map((x) => x.value))) === '["P1"]')
  cek('anggota: revisi pelatih tampil (R R R R …, oranye)', (await urutan(m)) === 'R R R R L R L L' && (await m.$eval('[data-testid="studio-perkusi-sel-1"]', (e) => e.dataset.direvisi)) === '1', await urutan(m))
  await klik(m, '[data-testid="studio-perkusi-sel-1"]')
  await wait(300)
  cek('anggota: tanpa editor & tanpa Hapus semua', !(await ada(m, '[data-testid="studio-perkusi-editor"]')) && !(await ada(m, '[data-testid="studio-perkusi-hapus-semua"]')))
  cek('anggota: tanpa pemanasan perkusi (kartu pola milik pelatih)', !(await ada(m, '[data-testid="pilih-pemanasan-perkusi"]')))

  // Pelatih membatalkan revisinya → berkas baru tanpa revisi menghapus sisa di HP anggota.
  const pktBaru = paketAnggota({ ...dasar, exportedAt: Date.now() + 1000, anotasiPartitur: undefined }, 'm-sn')
  const fBaru = path.join(BERKAS, 'baru.json')
  fs.writeFileSync(fBaru, JSON.stringify(pktBaru))
  await m.goto(`${BASE}/#/berbagi`, { waitUntil: 'networkidle2' })
  await wait(1800)
  const masuk2 = (await m.$('#pkg-input2')) ?? (await m.$('#pkg-input'))
  await masuk2.uploadFile(fBaru)
  await wait(3000)
  cek('berkas baru tanpa revisi menghapus revisi lama di HP anggota', (await bacaTabel(m, 'anotasiPartitur')).length === 0)
  await ctx.close()
} catch (e) {
  cek('tanpa pengecualian tak terduga', false, String(e?.stack ?? e).slice(0, 400))
}

const galatNyata = errors.filter((e) => !/favicon|AudioContext|autoplay/i.test(e))
cek('nol galat konsol', galatNyata.length === 0, galatNyata.join(' | ').slice(0, 400))

await browser.close()
fs.rmSync(BERKAS, { recursive: true, force: true })
console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) {
  console.log('Gagal:\n - ' + gagal.join('\n - '))
  process.exit(1)
}
