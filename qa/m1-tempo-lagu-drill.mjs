/**
 * M1 lanjutan C — tempo & segmen lagu dipakai untuk drill display.
 *
 * Diuji:
 * 1. Drill TANPA lagu → semua set tetap memakai tempo datar (perilaku lama).
 * 2. Drill DITautkan ke lagu bertempo map → tiap set memakai tempo lagu pada
 *    birama tempat set itu mulai.
 * 3. Presenter ikut memakai tempo lagu pada set yang sedang tampil.
 * 4. `setTerberat` tidak meledak saat tempo per set berbeda.
 *
 * Pakai: node m1-tempo-lagu-drill.mjs [BASE_URL]
 */
import puppeteer from 'puppeteer'
import { lewatSambutan } from './sambutan.mjs'
import { bacaSemua, segar, tanamBaris, tanamLagu } from './db-mentah.mjs'

/*
 * N8 — `process.argv[2]` dulunya satu-satunya jalan masuk, padahal
 * `regresi.sh` mengirim alamatnya lewat lingkungan (`BASE`). Akibatnya
 * rangkaian-rangkaian ini diam-diam berlari ke bawaan :5173 — server
 * pengembangan — dan gagal dengan cara yang tidak kentara. Sekarang
 * lingkungan menang, argumen tetap berlaku untuk dijalankan sendiri.
 */
const BASE = process.env.BASE || process.argv[2] || 'http://localhost:5173'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

let lulus = 0
let gagal = 0
function uji(nama, ok, detail = '') {
  if (ok) {
    lulus++
    console.log('  ✓ ' + nama)
  } else {
    gagal++
    console.log('  ✗ ' + nama + (detail ? ' → ' + detail : ''))
  }
}
function sama(nama, aktual, harap) {
  const a = JSON.stringify(aktual)
  const h = JSON.stringify(harap)
  uji(nama, a === h, `dapat ${a}, harap ${h}`)
}

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'],
})
const p = await browser.newPage()
await p.setViewport({ width: 1280, height: 1000 })
const errors = []
p.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text())
})
p.on('pageerror', (e) => errors.push(String(e)))

const ada = async (sel) => (await p.$(sel)) !== null
const teks = async (sel) => p.$eval(sel, (e) => e.textContent.trim()).catch(() => null)

/** Pilih set aktif dari strip set — chip-nya berisi nama + keterangan. */
async function pilihSet(nama) {
  const ok = await p.evaluate((x) => {
    const el = [...document.querySelectorAll('button')].find(
      (b) => b.textContent.includes(x) && b.offsetParent !== null,
    )
    if (el) {
      el.click()
      return true
    }
    return false
  }, nama)
  await wait(600)
  return ok
}

async function klikMengandung(lb) {
  await p.evaluate((x) => {
    ;[...document.querySelectorAll('button')].find((b) => b.textContent.includes(x))?.click()
  }, lb)
  await wait(500)
}

await p.goto(BASE.startsWith('file:') ? BASE : BASE + '/', { waitUntil: 'networkidle2' })

// N8 — layar sambutan menutupi semua yang ada di bawahnya, dan tiap
// peluncuran Puppeteer membawa perangkat baru. Tanpa ini rangkaian
// uji ini mogok di klik pertamanya dan tidak pernah sampai ke
// periksaannya — yang membuatnya tampak "tidak ada ringkasannya"
// alih-alih gagal terang-terangan.
await lewatSambutan(p)
await wait(2200)

/* --------------------------- siapkan data lewat db -------------------------- */

console.log('\n— Persiapan: lagu bertempo map + drill 4 set —')

// Lagu: 4/4 @120 mulai birama 1, lalu 7/8 @150 mulai birama 5.
// Drill: beatsPerCount 2, tiap set 8 count → 16 ketuk.
//   set 0: 16 ketuk @120 → 4 birama (4/4) → set 1 mulai birama 5 → 150
//   set 1..3: 150
const HARAP = [120, 150, 150, 150]

/*
 * N8 — data ditanam langsung ke IndexedDB, bukan lewat
 * `await import('/src/db/db.ts')` yang hanya ada di server
 * pengembangan. Lihat keterangan panjangnya di `db-mentah.mjs`.
 */
const songId = 'uji-lagu-tempo'
const drillId = 'uji-drill-tempo'

await tanamLagu(
  p,
  [
    {
      id: songId,
      title: 'Lagu Uji Tempo Drill',
      bpm: 120,
      beats: 4,
      tempoMap: [
        { measure: 1, bpm: 120, birama: { pembilang: 4, penyebut: 4, notPerAcuan: 4, kelompok: [2, 2] } },
        { measure: 5, bpm: 150, birama: { pembilang: 7, penyebut: 8, notPerAcuan: 4, kelompok: [2, 2, 3] } },
      ],
    },
  ],
  ['Lagu Uji Tempo Drill'],
)

// Drill dengan 4 set @ 8 count, beatsPerCount 2. Titik pemain diisi
// terpisah supaya analitik punya jarak untuk dinilai.
await tanamBaris(p, 'drills', {
  id: drillId,
  name: 'Drill Uji Tempo Lagu',
  showTitle: 'Drill Uji Tempo Lagu',
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

// Hapus set lama drill ini kalau ada, lalu buat 4 set baru.
const setLama = (await bacaSemua(p, 'sets')).filter((x) => x.drillId === drillId)
const setIds = []
for (let s = 0; s < 4; s++) {
  const id = 'uji-set-' + s
  setIds.push(id)
}
await tanamBaris(
  p,
  'sets',
  setIds.map((id, s) => ({
    id,
    drillId,
    order: s,
    name: 'Set ' + (s + 1),
    counts: 8,
    points: {},
    createdAt: Date.now(),
  })),
  setLama.map((x) => x.id),
)

// Tulisan mentah tidak memberitahu useLiveQuery — muat ulang.
await segar(p)

const seeded = { songId, drillId, setIds }
uji('lagu & drill berhasil disiapkan', !!seeded.songId && !!seeded.drillId)

const bukaDrill = async (drillId) => {
  await p.evaluate(() => {
    location.hash = '#/drill'
  })
  await wait(1600)
  // Pilih drill yang baru dibuat dari daftar.
  await p.evaluate((nama) => {
    const el = [...document.querySelectorAll('button,a,li,div')].find(
      (b) => b.textContent.trim() === nama && b.offsetParent !== null,
    )
    el?.click()
  }, 'Drill Uji Tempo Lagu')
  await wait(1400)
  // Penanda bahwa editor terbuka: strip set & kartu tautan lagu tampil.
  return (
    (await ada('[data-testid="kartu-lagu-drill"]')) &&
    (await p.evaluate(() => document.body.textContent)).includes('Set 1')
  )
}
uji('editor drill terbuka', await bukaDrill(seeded.drillId))

/* ------------------- 1. tanpa lagu → tempo datar seperti dulu -------------- */

console.log('\n— 1. Tanpa lagu: tempo datar (perilaku lama) —')
uji('kartu tautan lagu ada', await ada('[data-testid="kartu-lagu-drill"]'))
uji('pilihan lagu ada', await ada('[data-testid="pilih-lagu-drill"]'))
sama('pilihan lagu belum diisi', await p.$eval('[data-testid="pilih-lagu-drill"]', (e) => e.value), '')
uji(
  'ada keterangan "tanpa lagu"',
  (await teks('[data-testid="kartu-lagu-drill"]')).includes('tempo datar'),
)

// Buka presenter, baca tempo di tiap set.
const tempoPresenter = async (jml = 4) => {
  // Presenter dibuka ulang untuk tiap set: begini urutannya pasti, tanpa
  // bergantung pada tombol panah (yang gampang salah klik karena editor
  // ikut punya tombol serupa di balik overlay).
  const daftar = []
  for (let i = 0; i < jml; i++) {
    await pilihSet('Set ' + (i + 1))
    const tombol = await p.$('[title*="Mode presenter"]')
    if (!tombol) {
      daftar.push(-1)
      continue
    }
    await tombol.click()
    await wait(1300)
    daftar.push(Number(await teks('[data-testid="tempo-presenter"]')))
    await p.click('[data-testid="tutup-presenter"]').catch(() => {})
    await wait(900)
  }
  return daftar
}

const tanpa = await tempoPresenter()
sama('tanpa lagu: semua set tempo datar', tanpa, [120, 120, 120, 120])

/* ----------------------- 2. ditautkan → ikuti tempo lagu -------------------- */

console.log('\n— 2. Ditautkan ke lagu: tempo per set mengikuti birama lagu —')
/*
 * N8 — ditautkan lewat PILIHANnya, bukan lewat db. Dulu uji ini
 * menyisipkan modul aplikasinya sendiri untuk menyunting songId
 * langsung; selain hanya jalan di server pengembangan, itu juga
 * melewati satu-satunya jalan yang dipakai pemakai sungguhan — jadi
 * cacat pada pilihan lagunya tidak akan pernah ketahuan.
 */
await p.select('[data-testid="pilih-lagu-drill"]', seeded.songId)
await wait(1400)

uji('info lagu muncul', await ada('[data-testid="info-lagu-drill"]'))
uji(
  'info lagu menyebut judul lagu',
  (await teks('[data-testid="info-lagu-drill"]')).includes('Lagu Uji Tempo Drill'),
)
uji('info set→birama muncul', await ada('[data-testid="info-set-ke-birama"]'))
// Presenter tadi meninggalkan set terakhir aktif; pilih Set 1 dulu.
await pilihSet('Set 1')
const infoNol = await teks('[data-testid="info-set-ke-birama"]')
uji('set 1 di birama 1 · 120 BPM · 4/4', infoNol.includes('birama 1') && infoNol.includes('120 BPM') && infoNol.includes('4/4'), infoNol)

const dengan = await tempoPresenter()
sama('ditautkan: tempo per set mengikuti lagu', dengan, HARAP)
uji('set 1 berbeda dari tanpa-lagu (akhirnya 150 di set 2)', dengan[1] === 150, JSON.stringify(dengan))
uji('set 1 tetap 120 (belum melewati birama 5)', dengan[0] === 120, JSON.stringify(dengan))

/* ----------- 3. set aktif: keterangan berubah saat ganti set langsung ------- */

console.log('\n— 3. Keterangan set aktif mengikuti set yang dipilih —')
await p.evaluate(() => {
  const el = [...document.querySelectorAll('button')].find((b) =>
    b.textContent.includes('Set 2') && b.offsetParent !== null,
  )
  el?.click()
})
await wait(900)
const infoSatu = await teks('[data-testid="info-set-ke-birama"]')
uji('set 2: birama 5 · 150 BPM · 7/8', infoSatu.includes('150 BPM') && infoSatu.includes('7/8'), infoSatu)
uji('set 2 menampilkan kelompok ketuk 2+2+3', infoSatu.includes('2+2+3'), infoSatu)

uji('ringkasan perubahan tempo ada', await ada('[data-testid="ringkas-perubahan"]'))
const ringkas = await teks('[data-testid="ringkas-perubahan"]')
uji('ringkasan menyebut set 2 → 150 BPM', ringkas.includes('set 2') && ringkas.includes('150 BPM'), ringkas)

/* ------------- 4. putar: tidak ada error, tempo map tidak meledak ---------- */

console.log('\n— 4. Pemutaran —')
await p.evaluate(() => {
  const el = [...document.querySelectorAll('button')].find((b) =>
    b.textContent.trim() === 'Set 1' && b.offsetParent !== null,
  )
  el?.click()
})
await wait(700)
await p.evaluate(() => {
  const el = [...document.querySelectorAll('button')].find((b) =>
    (b.textContent.includes('Mainkan') || b.textContent.includes('Putar')) && b.offsetParent !== null,
  )
  el?.click()
})
await wait(2200)
await p.evaluate(() => {
  const el = [...document.querySelectorAll('button')].find((b) =>
    b.textContent.includes('Jeda') && b.offsetParent !== null,
  )
  el?.click()
})
await wait(600)

// Balikkan ke tanpa lagu, pastikan kembali ke tempo datar.
await p.select('[data-testid="pilih-lagu-drill"]', '')
await wait(1400)
uji(
  'lepas tautan → kembali ke tempo datar',
  !(await ada('[data-testid="info-lagu-drill"]')),
)

console.log('\n— Konsol —')
const errNyata = errors.filter((e) => !/favicon|Download the React/i.test(e))
uji('tidak ada error konsol', errNyata.length === 0, errNyata.slice(0, 3).join(' | '))

console.log(`\n=== ${lulus} lulus, ${gagal} gagal ===`)
await browser.close()
process.exit(gagal > 0 ? 1 : 0)
