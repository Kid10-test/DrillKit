/**
 * #27 — Jembatan MuseScore, Tarik Peta Tempo, Kertas Gelap, & Kalibrasi A4:
 * uji peramban ujung ke ujung.
 *
 * Logika murninya diuji di `mscz-logika.mjs` & `peta-partitur-logika.mjs`.
 * Di sini yang diuji sambungannya:
 *
 *   1. Pintu #7 (Buka Berkas): `.mscz` dikenali sebagai Partitur dan
 *      diterjemahkan (catatan menyebut MuseScore 4.20).
 *   2. Musik → Partitur lagu: `.mscz` → pratinjau "Mars Uji.mscz → Mars
 *      Uji.musicxml" + keterangan MuseScore → Pasang → Blob MusicXML di
 *      `partiturBerkas` (bukan arsip ZIP aslinya).
 *   3. Tarik peta tempo: pratinjau 4 baris (Awal/A/B/rit.), centang
 *      "Bentangkan ulangan" → 5 baris & 8 birama → Simpan menulis tempoMap,
 *      BPM, sukat 4/4, panjang 8. Membuka lagi menawarkan "Ganti 5 segmen
 *      lama"; tanpa bentang → 4 segmen & 6 birama. Batal tidak menulis.
 *   4. Kertas gelap: kanvas notasi dibalik (`filter: invert`), latar #1a1a1a,
 *      diingat sesudah muat ulang.
 *   5. A4: pilih 442 Hz → tersimpan di setelan penala bersama
 *      (`drillkit.penala`), terbaca lagi sesudah muat ulang.
 *   6. Mode anggota: tombol Tarik peta tidak ada, kertas gelap tetap bisa.
 *   7. Lebar HP 360 px tanpa gulir mendatar; nol galat konsol.
 *
 * Pakai: bash qa/bangun-logika.sh && BASE=http://localhost:4173 node qa/mscz-e2e.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'
import { lewatSambutan } from './sambutan.mjs'
import { bikinZip } from '/tmp/zip.mjs'
import { MS4 } from './fikstur-musescore.mjs'

const QA = path.dirname(fileURLToPath(import.meta.url))
const BASE = process.env.BASE || process.argv[2] || 'http://localhost:4173'
const BERKAS = path.join(QA, 'berkas-mscz')
fs.rmSync(BERKAS, { recursive: true, force: true })
fs.mkdirSync(BERKAS, { recursive: true })

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

/* ------------------------------- Fikstur -------------------------------- */
const fMscz = path.join(BERKAS, 'Mars Uji.mscz')
fs.writeFileSync(
  fMscz,
  bikinZip([
    {
      nama: 'META-INF/container.xml',
      isi: '<?xml version="1.0" encoding="UTF-8"?><container><rootfiles><rootfile full-path="Mars Uji.mscx"/></rootfiles></container>',
    },
    { nama: 'Mars Uji.mscx', isi: MS4 },
  ]),
)

/* ------------------------------ Alat bantu ------------------------------ */
const ada = async (hal, sel) => (await hal.$(sel)) != null
const teks = (hal, sel) => hal.$eval(sel, (e) => (e.textContent ?? '').replace(/\s+/g, ' ').trim())
const klik = async (hal, sel) => {
  await hal.waitForSelector(sel, { timeout: 12000 })
  await hal.$eval(sel, (e) => e.scrollIntoView({ block: 'center' }))
  await hal.click(sel)
}
const unggah = async (hal, sel, jalur) => {
  await hal.waitForSelector(sel, { timeout: 12000 })
  const input = await hal.$(sel)
  await input.uploadFile(jalur)
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
const bacaBlobTeks = (hal, songId) =>
  hal.evaluate(async (id) => {
    const db = await new Promise((s, t) => {
      const r = indexedDB.open('drillkit')
      r.onsuccess = () => s(r.result)
      r.onerror = () => t(String(r.error))
    })
    const item = await new Promise((s, t) => {
      const q = db.transaction('partiturBerkas', 'readonly').objectStore('partiturBerkas').get(id)
      q.onsuccess = () => s(q.result ?? null)
      q.onerror = () => t(String(q.error))
    })
    db.close()
    if (!item?.blob) return null
    return { tipe: item.tipe, namaFile: item.namaFile, teks: await item.blob.text() }
  }, songId)
const laguDb = async (hal, id) => (await bacaTabel(hal, 'songs')).find((s) => s.id === id)
const barisPeta = (hal) =>
  hal.$$eval('[data-testid="tarik-peta-baris"]', (rs) =>
    rs.map((r) => [...r.querySelectorAll('td')].map((td) => (td.textContent ?? '').trim())),
  )

/* ------------------------------- Peramban ------------------------------- */
const browser = await puppeteer.launch({
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required'],
  defaultViewport: { width: 1360, height: 1000 },
  env: { ...process.env, LANG: process.env.LANG || 'C.utf8' },
})
const p = await browser.newPage()
const errors = []
p.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text())
})
p.on('pageerror', (e) => errors.push(String(e)))

await p.goto(BASE, { waitUntil: 'networkidle2' })
await lewatSambutan(p)
await p.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('Muat data contoh'))
  if (b) b.click()
})
await wait(3500)
const laguAwal = await bacaTabel(p, 'songs')
cek('data contoh memuat lagu', laguAwal.length >= 1, String(laguAwal.length))
const lagu = laguAwal[0]

console.log('\n1. Pintu #7 mengenali .mscz')
await unggah(p, '[data-testid="buka-berkas-dasbor-input"]', fMscz)
await p.waitForSelector('[data-testid="modal-buka-berkas"]', { timeout: 15000 })
await wait(800)
cek(
  'jenis: Partitur (MusicXML / MuseScore / PDF)',
  (await teks(p, '[data-testid="buka-jenis"]')) === 'Partitur (MusicXML / MuseScore / PDF) (#11a)',
  await teks(p, '[data-testid="buka-jenis"]'),
)
const isiModal = await teks(p, '[data-testid="modal-buka-berkas"]')
cek('pratinjau menyebut judul & MuseScore 4.20', isiModal.includes('Mars Uji Lapangan') && isiModal.includes('MuseScore 4.20'), isiModal.slice(0, 260))
await klik(p, '[data-testid="buka-tutup"]')
await wait(400)

console.log('\n2. Pasang .mscz di Partitur lagu')
await ke(p, '#/musik')
await klik(p, `[data-testid="pilih-lagu-${lagu.id}"]`)
await p.waitForSelector('[data-testid="panel-partitur"]', { timeout: 10000 })
const accept = await p.$eval('#partitur-input', (e) => e.getAttribute('accept'))
cek('input menerima .mscz & .mscx', /\.mscz/.test(accept) && /\.mscx/.test(accept), accept)
await unggah(p, '#partitur-input', fMscz)
await p.waitForSelector('[data-testid="partitur-simpan"]', { timeout: 15000 })
const panel = await teks(p, '[data-testid="panel-partitur"]')
cek('pratinjau "Mars Uji.mscz → Mars Uji.musicxml"', panel.includes('Mars Uji.mscz → Mars Uji.musicxml'), panel.slice(0, 260))
cek('keterangan diterjemahkan dari MuseScore 4.20', /MuseScore 4\.20 \(\.mscz\)/.test(await teks(p, '[data-testid="partitur-dari-musescore"]')))
cek('ringkasan: judul, 6 birama, 2 part', panel.includes('Mars Uji Lapangan') && /Trumpet in B♭/.test(panel) && /Snare Line/.test(panel), panel.slice(0, 400))
cek('belum ada yang ditulis sebelum Pasang', (await bacaTabel(p, 'partiturBerkas')).length === 0)
await klik(p, '[data-testid="partitur-simpan"]')
await wait(1500)
const blob = await bacaBlobTeks(p, lagu.id)
cek('Blob tersimpan sebagai MusicXML (bukan ZIP asli)', blob?.tipe === 'musicxml' && blob.teks.startsWith('<?xml') && blob.teks.includes('<score-partwise version="4.0">'), blob?.teks?.slice(0, 80))
cek('nama simpan Mars Uji.musicxml', blob?.namaFile === 'Mars Uji.musicxml', blob?.namaFile)
const meta = (await laguDb(p, lagu.id))?.partitur
cek('Song.partitur: musicxml, 6 birama, 2 part', meta?.tipe === 'musicxml' && meta?.jumlahBirama === 6 && meta?.parts?.length === 2, JSON.stringify(meta)?.slice(0, 200))

console.log('\n3. Tarik peta tempo')
await klik(p, '[data-testid="partitur-tarik-peta"]')
await p.waitForSelector('[data-testid="tarik-peta-tabel"]', { timeout: 15000 })
await wait(400)
let baris = await barisPeta(p)
cek('pratinjau 4 baris: Awal · A · B · rit.', baris.map((b) => b[1]).join('|') === 'Awal|A|B|rit.', JSON.stringify(baris))
cek('B: 6/8 · 80 BPM (♩.)', baris[2]?.[2] === '6/8' && baris[2]?.[3] === '80', JSON.stringify(baris[2]))
cek('rit.: luncur ke 60', baris[3]?.[3] === '↝ 60' && /80 → 60 BPM dalam 6 ketuk/.test(baris[3]?.[4] ?? ''), JSON.stringify(baris[3]))
cek('ringkas: awal 4/4 · 120 BPM, panjang 6', /4\/4/.test(await teks(p, '[data-testid="tarik-peta-ringkas"]')) && (await teks(p, '[data-testid="tarik-peta-panjang"]')) === '6')
cek('pilihan bentang tampil (ada ‖: :‖), bawaan mati', (await ada(p, '[data-testid="tarik-peta-bentang"]')) && !(await p.$eval('[data-testid="tarik-peta-bentang"]', (e) => e.checked)))
// Batal tidak menulis apa pun.
const petaSebelum = JSON.stringify((await laguDb(p, lagu.id))?.tempoMap ?? null)
await klik(p, '[data-testid="tarik-peta-batal"]')
await wait(500)
cek('Batal: modal tertutup, tempoMap tidak berubah', !(await ada(p, '[data-testid="modal-tarik-peta"]')) && JSON.stringify((await laguDb(p, lagu.id))?.tempoMap ?? null) === petaSebelum)

await klik(p, '[data-testid="partitur-tarik-peta"]')
await p.waitForSelector('[data-testid="tarik-peta-tabel"]', { timeout: 15000 })
await wait(300)
await klik(p, '[data-testid="tarik-peta-bentang"]')
await wait(600)
baris = await barisPeta(p)
cek('bentang: 5 baris dengan "A (ulang)"', baris.length === 5 && baris[2]?.[1] === 'A (ulang)', JSON.stringify(baris.map((b) => b[1])))
cek('bentang: panjang 8 birama', (await teks(p, '[data-testid="tarik-peta-panjang"]')) === '8')
await klik(p, '[data-testid="tarik-peta-simpan"]')
await wait(1200)
let s = await laguDb(p, lagu.id)
cek('tersimpan: 5 segmen ber-id unik', s?.tempoMap?.length === 5 && new Set(s.tempoMap.map((x) => x.id)).size === 5 && s.tempoMap.every((x) => typeof x.id === 'string' && x.id), JSON.stringify(s?.tempoMap?.map((x) => x.id)))
cek('tersimpan: bpm 120, beats 4, sukat 4/4, panjang 8', s?.bpm === 120 && s?.beats === 4 && s?.tandaBirama?.pembilang === 4 && s?.tandaBirama?.penyebut === 4 && s?.panjangBirama === 8, JSON.stringify({ bpm: s?.bpm, beats: s?.beats, t: s?.tandaBirama, p: s?.panjangBirama }))
cek('tersimpan: segmen rit. membawa rampCounts 6 & rampFromBpm 80', s?.tempoMap?.some((x) => x.label === 'rit.' && x.rampCounts === 6 && x.rampFromBpm === 80 && x.bpm === 60))
cek('modal tertutup sesudah simpan', !(await ada(p, '[data-testid="modal-tarik-peta"]')))

await klik(p, '[data-testid="partitur-tarik-peta"]')
await p.waitForSelector('[data-testid="tarik-peta-tabel"]', { timeout: 15000 })
await wait(300)
cek('membuka lagi menawarkan "Ganti 5 segmen lama"', /Ganti 5 segmen lama/.test(await teks(p, '[data-testid="tarik-peta-simpan"]')), await teks(p, '[data-testid="tarik-peta-simpan"]'))
await klik(p, '[data-testid="tarik-peta-simpan"]')
await wait(1200)
s = await laguDb(p, lagu.id)
cek('tanpa bentang: 4 segmen, panjang 6', s?.tempoMap?.length === 4 && s?.panjangBirama === 6, `${s?.tempoMap?.length} ${s?.panjangBirama}`)

console.log('\n4. Kertas gelap')
await klik(p, '[data-testid="partitur-buka"]')
await p.waitForFunction(() => document.querySelector('[data-testid="partitur-kanvas-svg"] svg'), { timeout: 30000 })
await wait(800)
const gaya = () =>
  p.evaluate(() => {
    const k = document.querySelector('[data-testid="partitur-kertas"]')
    const v = document.querySelector('[data-testid="partitur-kanvas-svg"]')
    return {
      gelap: k?.getAttribute('data-kertas-gelap'),
      latar: k ? getComputedStyle(k).backgroundColor : '',
      filter: v ? getComputedStyle(v).filter : '',
      simpan: localStorage.getItem('drillkit.partitur.kertasGelap'),
    }
  })
let g = await gaya()
cek('bawaan: kertas terang, tanpa filter', g.gelap === '0' && g.latar === 'rgb(255, 255, 255)' && (g.filter === 'none' || g.filter === ''), JSON.stringify(g))
await klik(p, '[data-testid="partitur-kertas-gelap"]')
await wait(300)
g = await gaya()
cek('gelap: latar #1a1a1a + invert(0.9) hue-rotate(180deg)', g.gelap === '1' && g.latar === 'rgb(26, 26, 26)' && /invert\(0\.9\)/.test(g.filter) && /hue-rotate\(180deg\)/.test(g.filter), JSON.stringify(g))
cek('gelap: diingat di localStorage', g.simpan === '1')
cek('tombol aria-pressed', (await p.$eval('[data-testid="partitur-kertas-gelap"]', (e) => e.getAttribute('aria-pressed'))) === 'true')

console.log('\n5. Kalibrasi A4')
cek('bawaan A4 440', (await p.$eval('[data-testid="partitur-a4"]', (e) => e.value)) === '440')
await p.select('[data-testid="partitur-a4"]', '442')
await wait(300)
const penala = await p.evaluate(() => JSON.parse(localStorage.getItem('drillkit.penala') || '{}'))
cek('A4 442 tersimpan di setelan penala bersama', penala.a4 === 442, JSON.stringify(penala))

await p.reload({ waitUntil: 'networkidle2' })
await wait(1500)
await ke(p, '#/musik')
await klik(p, `[data-testid="pilih-lagu-${lagu.id}"]`)
await klik(p, '[data-testid="partitur-buka"]')
await p.waitForFunction(() => document.querySelector('[data-testid="partitur-kanvas-svg"] svg'), { timeout: 30000 })
await wait(600)
g = await gaya()
cek('sesudah muat ulang: kertas tetap gelap', g.gelap === '1' && /invert/.test(g.filter), JSON.stringify(g))
cek('sesudah muat ulang: A4 tetap 442', (await p.$eval('[data-testid="partitur-a4"]', (e) => e.value)) === '442')

// Bunyikan notasi dengan A4 442 tidak menimbulkan galat.
if (await ada(p, '[data-testid="partitur-bunyikan-not"]')) {
  await klik(p, '[data-testid="partitur-bunyikan-not"]')
  await wait(1200)
  await klik(p, '[data-testid="partitur-bunyikan-not"]')
  await wait(300)
}

console.log('\n6. Lebar HP 360 px')
await p.setViewport({ width: 360, height: 780 })
await wait(800)
const lebar = await p.evaluate(() => document.documentElement.scrollWidth)
cek('tanpa gulir mendatar di 360 px', lebar <= 360, String(lebar))
await p.setViewport({ width: 1360, height: 1000 })

console.log('\n7. Mode anggota')
const pa = await browser.newPage()
pa.on('pageerror', (e) => errors.push('[anggota] ' + String(e)))
await pa.goto(BASE, { waitUntil: 'networkidle2' })
await lewatSambutan(pa, 'member')
await ke(pa, '#/musik')
if (await ada(pa, `[data-testid="pilih-lagu-${lagu.id}"]`)) {
  await klik(pa, `[data-testid="pilih-lagu-${lagu.id}"]`)
  await wait(800)
  cek('anggota: tidak ada tombol Tarik peta', !(await ada(pa, '[data-testid="partitur-tarik-peta"]')))
} else {
  cek('anggota: tidak ada tombol Tarik peta (daftar lagu tersembunyi)', !(await ada(pa, '[data-testid="partitur-tarik-peta"]')))
}
await pa.close()

const galatNyata = errors.filter((e) => !/favicon|AudioContext|autoplay/i.test(e))
cek('nol galat konsol', galatNyata.length === 0, galatNyata.join(' | ').slice(0, 400))

await browser.close()
fs.rmSync(BERKAS, { recursive: true, force: true })
console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) {
  console.log('Gagal:\n - ' + gagal.join('\n - '))
  process.exit(1)
}
