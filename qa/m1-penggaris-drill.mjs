/**
 * #5 sisa — penggaris musik × drill, bantuan hitungan, pecah & gabung set.
 *
 * Diuji dari antarmuka sungguhan (bukan dari modulnya):
 *  1. penggaris dua baris muncul saat drill ditautkan ke lagu: baris segmen
 *     (nama, tempo, rentang hitungan & birama) dan baris set;
 *  2. tanda ⚡ + keterangannya untuk set yang melewati perubahan tempo/sukat;
 *  3. bantuan "mulai di hitungan … / sisa segmen …" dan tombol
 *     "Pas ke batas segmen" (mengubah hitungan set di basis data);
 *  4. pecah set di batas segmen: set peralihan lahir dengan posisi pemain yang
 *     diambil dari jalur yang ada, dan keadaannya difoto ke riwayat formasi;
 *  5. gabung set: set peralihan dilebur kembali, hitungannya menjumlah;
 *  6. ketukan blok penggaris memindahkan set aktif.
 *
 * Pakai: BASE=http://localhost:4173 node m1-penggaris-drill.mjs
 */
import puppeteer from 'puppeteer'
import { lewatSambutan } from './sambutan.mjs'
import { bacaSemua, segar, tanamBaris, tanamLagu } from './db-mentah.mjs'

const BASE = process.env.BASE || process.argv[2] || 'http://localhost:4173'
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
const nilai = async (sel) => p.$eval(sel, (e) => e.value).catch(() => null)

await p.goto(BASE.startsWith('file:') ? BASE : BASE + '/', { waitUntil: 'networkidle2' })
await lewatSambutan(p)
await wait(2200)

/* -------------------------- Siapkan data lewat db -------------------------- */

console.log('\n— Persiapan: lagu bersegmen + drill 4 set @8 hitungan —')

const songId = 'uji-penggaris-lagu'
const drillId = 'uji-penggaris-drill'
const M44 = { pembilang: 4, penyebut: 4, kelompok: [2, 2], acuan: { nilai: 4, titik: false } }
const M78 = { pembilang: 7, penyebut: 8, kelompok: [2, 2, 3], acuan: { nilai: 8, titik: false } }

/*
 * 4/4 @120. Tempo naik ke 150 di birama 3 ketuk 2 (tengah hitungan ke-5),
 * sukat berganti ke 7/8 di birama 6. Dengan 2 ketuk per hitungan, batas
 * segmen pertama jatuh di hitungan 4,5 — sengaja, supaya pembulatannya ikut
 * diuji. Perubahan sukat di birama 6 berada di dalam set 2 (hitungan 9–16).
 */
await tanamLagu(
  p,
  [
    {
      id: songId,
      title: 'Lagu Uji Penggaris',
      bpm: 120,
      beats: 4,
      tempoMap: [
        { id: 'tm-a', label: 'Bagian A', measure: 3, beat: 2, bpm: 150, beats: 4, birama: M44 },
        { id: 'tm-b', label: 'Bagian B', measure: 6, bpm: 150, beats: 7, birama: M78 },
      ],
    },
  ],
  ['Lagu Uji Penggaris'],
)

await tanamBaris(p, 'drills', {
  id: drillId,
  name: 'Drill Uji Penggaris',
  showTitle: 'Drill Uji Penggaris',
  tempo: 120,
  beatsPerCount: 2,
  rosterIds: [],
  songId,
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

// Empat set 8 hitungan, dengan dua titik contoh yang bergerak lurus 10 yard.
const setLama = (await bacaSemua(p, 'sets')).filter((x) => x.drillId === drillId)
await tanamBaris(
  p,
  'sets',
  [0, 1, 2, 3].map((s) => ({
    id: `uji-pp-set-${s}`,
    drillId,
    order: s,
    name: `Set ${s + 1}`,
    counts: 8,
    points: {
      m1: { x: s * 4, y: 0, facing: 'front' },
      m2: { x: s * 4, y: 4, facing: 'front' },
    },
    createdAt: Date.now(),
  })),
  setLama.map((x) => x.id),
)
await segar(p)

const setDB = async () =>
  (await bacaSemua(p, 'sets'))
    .filter((x) => x.drillId === drillId)
    .sort((a, b) => a.order - b.order)

const riwayatDB = async () => (await bacaSemua(p, 'riwayat')).filter((x) => x.drillId === drillId)

/* ------------------------------ Buka editor ------------------------------- */

const bukaDrill = async (nama) => {
  await p.evaluate(() => {
    location.hash = '#/drill'
  })
  await wait(1600)
  await p.evaluate((n) => {
    const el = [...document.querySelectorAll('button,a,li,div')].find(
      (b) => b.textContent.trim() === n && b.offsetParent !== null,
    )
    el?.click()
  }, nama)
  await wait(1400)
  return ada('[data-testid="penggaris-drill"]')
}
uji('editor drill terbuka dengan penggarisnya', await bukaDrill('Drill Uji Penggaris'))

/* --------------------------- 1. Penggaris dua baris ------------------------ */

console.log('\n— 1. Penggaris: baris segmen + baris set —')
uji('penggaris tampil', await ada('[data-testid="penggaris-drill"]'))
uji(
  'ringkasan menyebut 32 hitungan',
  (await teks('[data-testid="penggaris-ringkas"]'))?.includes('32 hitungan'),
  await teks('[data-testid="penggaris-ringkas"]'),
)
const blokSegmen = await p.$$('[data-testid="penggaris-baris-segmen"] > button')
const blokSet = await p.$$('[data-testid="penggaris-baris-set"] > button')
uji('baris segmen berisi 3 blok (Awal + 2 segmen)', blokSegmen.length === 3, String(blokSegmen.length))
uji('baris set berisi 4 blok', blokSet.length === 4, String(blokSet.length))

const segA = await teks('[data-testid="penggaris-segmen-1"]')
uji(
  'segmen A: nama, tempo, rentang hitungan & birama',
  /Bagian A/.test(segA) && /150 BPM/.test(segA) && /5,5–10/.test(segA) && /br 3,25–6/.test(segA),
  segA,
)
const set1 = await teks('[data-testid="penggaris-set-0"]')
uji('set 1: rentang hitungan & birama', /1–8/.test(set1) && /birama 1–5/.test(set1), set1)

/* ------------------------- 2. Tanda ⚡ & keterangan ------------------------- */

console.log('\n— 2. Tanda ⚡ untuk set yang melewati perubahan —')
uji('set 1 ditandai ⚡ (melewati perubahan tempo)', await ada('[data-testid="penggaris-lintas-0"]'))
const catatan0 = await teks('[data-testid="penggaris-catatan-0"]')
uji('keterangan set 1 menyebut 120 → 150 BPM', /120 → 150 BPM/.test(catatan0), catatan0)
uji('keterangan set 1 menyebut di hitungan 5', /hitungan 5/.test(catatan0), catatan0)
uji('set 2 ditandai ⚡ (melewati perubahan sukat)', await ada('[data-testid="penggaris-lintas-1"]'))
const catatan1 = await teks('[data-testid="penggaris-catatan-1"]')
uji('keterangan set 2 menyebut 4/4 → 7/8 di birama 6', /4\/4 → 7\/8/.test(catatan1) && /birama 6/.test(catatan1), catatan1)
uji('set 3 tidak ditandai ⚡', !(await ada('[data-testid="penggaris-lintas-2"]')))

/* --------------------------- 3. Bantuan hitungan --------------------------- */

console.log('\n— 3. Bantuan mengisi hitungan set —')
uji('kartu bantuan tampil', await ada('[data-testid="bantuan-segmen"]'))
const bantuan = await teks('[data-testid="bantuan-segmen"]')
uji('keterangan mulai di hitungan 1 (segmen Awal)', /Mulai di hitungan 1 \(segmen Awal/.test(bantuan), bantuan)
uji('keterangan sisa segmen 4,5 hitungan', /sisa segmen Awal: 4,5 hitungan/.test(bantuan), bantuan)
const rinci = await teks('[data-testid="bantuan-segmen-rinci"]')
uji('keterangan rinci menyebut pembulatan ke 5', /dibulatkan ke 5/.test(rinci), rinci)

/* ---------------------------- 4. Ketukan penggaris ------------------------- */

console.log('\n— 4. Ketuk blok penggaris memindahkan set aktif —')
await p.click('[data-testid="penggaris-set-2"]')
await wait(900)
uji('set aktif berpindah ke Set 3', (await nilai('[data-testid="nama-set"]')) === 'Set 3', await nilai('[data-testid="nama-set"]'))
await p.click('[data-testid="penggaris-set-0"]')
await wait(900)

/* ------------------------------- 5. Pecah set ------------------------------ */

console.log('\n— 5. Pecah set di batas segmen —')
await p.click('[data-testid="tombol-pecah"]')
await wait(700)
uji('panel pecah terbuka', await ada('[data-testid="panel-pecah"]'))
uji('ada tombol cepat batas segmen (hitungan 5)', await ada('[data-testid="pecah-batas-5"]'))
await p.click('[data-testid="pecah-batas-5"]')
await wait(400)
uji('hitungan pecah terisi 5', (await nilai('[data-testid="pecah-hitungan"]')) === '5', await nilai('[data-testid="pecah-hitungan"]'))
await p.click('[data-testid="pecah-jalankan"]')
await wait(1600)

let sets = await setDB()
uji('set bertambah jadi 5', sets.length === 5, String(sets.length))
uji('bagian pertama 5 hitungan', sets[0]?.counts === 5, String(sets[0]?.counts))
uji('set peralihan 3 hitungan', sets[1]?.counts === 3, String(sets[1]?.counts))
const tengah = sets[1]?.points?.m1
uji('set peralihan punya posisi pemain', !!tengah)
uji(
  'posisi peralihan di antara set 1 dan set 3 (di jalur, bukan di ujung)',
  !!tengah && tengah.x > 0.01 && tengah.x < 4 - 0.01,
  JSON.stringify(tengah),
)
uji('posisi peralihan tetap segaris (y sama)', !!tengah && Math.abs(tengah.y - 0) < 1e-6, JSON.stringify(tengah))
uji('jalur bagian pertama tersimpan', sets[0]?.gerak?.jalur === 'lurus', JSON.stringify(sets[0]?.gerak))
uji(
  'keadaan sebelum pecah difoto ke riwayat formasi',
  (await riwayatDB()).some((r) => r.alasan === 'sebelum-pecah-set'),
)

/* ------------------------------ 6. Gabung set ------------------------------ */

console.log('\n— 6. Gabung set kembali —')
// Kembali ke set pertama dulu: yang digabung selalu set aktif + set berikutnya.
await p.click('[data-testid="penggaris-set-0"]')
await wait(900)
uji('set aktif kembali ke Set 1', (await nilai('[data-testid="nama-set"]')) === 'Set 1', await nilai('[data-testid="nama-set"]'))
await p.click('[data-testid="tombol-gabung"]')
await wait(700)
uji('tombol gabung minta konfirmasi', await ada('[data-testid="tombol-gabung-konfirmasi"]'))
await p.click('[data-testid="tombol-gabung-konfirmasi"]')
await wait(1600)
sets = await setDB()
uji('set kembali jadi 4', sets.length === 4, String(sets.length))
uji('hitungan set pertama menjumlah kembali (8)', sets[0]?.counts === 8, String(sets[0]?.counts))
uji('nama set berikutnya tidak lagi "(pecahan)"', !sets.some((s) => s.name.includes('(pecahan)')), JSON.stringify(sets.map((s) => s.name)))
uji(
  'keadaan sebelum gabung difoto ke riwayat formasi',
  (await riwayatDB()).some((r) => r.alasan === 'sebelum-gabung-set'),
)

/* --------------------------- 7. Pas ke batas segmen ------------------------ */

console.log('\n— 7. Pas ke batas segmen —')
uji('tombol Pas ke batas segmen tersedia', await ada('[data-testid="tombol-pas-segmen"]'))
await p.click('[data-testid="tombol-pas-segmen"]')
await wait(1400)
uji('hitungan set diisi 5', (await nilai('[data-testid="hitungan-set"]')) === '5', await nilai('[data-testid="hitungan-set"]'))
sets = await setDB()
uji('perubahan tersimpan di basis data', sets[0]?.counts === 5, String(sets[0]?.counts))

/* ------------------- 8. Editor lagu: panjang segmen (hitungan) ------------- */

console.log('\n— 8. Editor lagu: panjang tiap segmen dalam hitungan drill —')
await p.evaluate(() => {
  location.hash = '#/musik'
})
await wait(1800)
await p.click(`[data-testid="pilih-lagu-${songId}"]`)
await wait(1200)
const panjangA = await teks('[data-testid="daftar-segmen-panjang-tm-a"]')
uji(
  'segmen A: ≈ 5,5 hitungan (2 ketuk per hitungan, diambil dari drill)',
  /≈ 5,5 hitungan/.test(panjangA),
  panjangA,
)
const panjangB = await teks('[data-testid="daftar-segmen-panjang-tm-b"]')
uji(
  'segmen terakhir: panjang bebas selama panjang lagu belum diisi',
  /panjang bebas/.test(panjangB),
  panjangB,
)

/* --------------------------------- Penutup -------------------------------- */

console.log('\n— Konsol —')
const errNyata = errors.filter((e) => !/favicon|Download the React/i.test(e))
uji('tidak ada error konsol', errNyata.length === 0, errNyata.slice(0, 3).join(' | '))

console.log(`\n=== ${lulus} lulus, ${gagal} gagal ===`)
await browser.close()
process.exit(gagal > 0 ? 1 : 0)
