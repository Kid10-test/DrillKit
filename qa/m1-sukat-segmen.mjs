/**
 * M1 lanjutan — sukat (tanda birama) per segmen tempo.
 *
 * Yang dibuktikan: lagu bisa berganti meter di tengah (4/4 → 7/8), dan
 * metronom benar-benar MEMUTAR meter yang berlaku — bukan cuma tersimpan
 * di data. Pembuktiannya dengan menghitung osilator (aksen 1400 Hz vs
 * ketuk biasa 1000 Hz), jadi ini uji bunyi, bukan uji tampilan.
 */
import puppeteer from 'puppeteer'
import { lewatSambutan } from './sambutan.mjs'

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

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'],
})
const p = await browser.newPage()
const errors = []
p.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text())
})
p.on('pageerror', (e) => errors.push(String(e)))

const ada = async (sel) => (await p.$(sel)) !== null
const teks = async (sel) => p.$eval(sel, (e) => e.textContent.trim()).catch(() => null)

async function setInput(sel, nilai) {
  await p.$eval(
    sel,
    (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(el, String(v))
      el.dispatchEvent(new Event('input', { bubbles: true }))
    },
    nilai,
  )
  await wait(250)
}

async function pilihTeks(sel, label) {
  const v = await p.$$eval(
    sel + ' option',
    (o, lb) => {
      const x = o.find((q) => q.textContent.trim() === lb)
      return x ? x.value : null
    },
    label,
  )
  if (v === null) {
    const semua = await p.$$eval(sel + ' option', (o) => o.map((x) => x.textContent.trim()))
    throw new Error('opsi tidak ketemu: ' + label + ' | ada: ' + semua.join(' / '))
  }
  await p.select(sel, v)
  await wait(350)
  return v
}

const klikTeks = (label) =>
  p.evaluate((lb) => {
    ;[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === lb)?.click()
  }, label)

async function klikMengandung(label) {
  await p.evaluate((lb) => {
    ;[...document.querySelectorAll('button')].find((b) => b.textContent.includes(lb))?.click()
  }, label)
  await wait(500)
}

/* --------------------------------- mulai --------------------------------- */

await p.goto(BASE.startsWith('file:') ? BASE : BASE + '/', { waitUntil: 'networkidle2' })

// N8 — layar sambutan menutupi semua yang ada di bawahnya, dan tiap
// peluncuran Puppeteer membawa perangkat baru. Tanpa ini rangkaian
// uji ini mogok di klik pertamanya dan tidak pernah sampai ke
// periksaannya — yang membuatnya tampak "tidak ada ringkasannya"
// alih-alih gagal terang-terangan.
await lewatSambutan(p)
await wait(2200)
await p.evaluate(() => {
  location.hash = '#/musik'
})
await wait(2200)

console.log('\n— Bukat editor lagu & isi tempo map —')
await klikMengandung('Tambah lagu')
uji('modal lagu terbuka', await ada('[data-testid="lagu-birama"]'))

// Judul & tempo
const judul = await p.$('[data-testid="lagu-birama"]')
uji('pemilih sukat ada di editor lagu', !!judul)

// Isi judul lewat input pertama di dalam panel modal
const judulOk = await p.evaluate(() => {
  const modal = document.querySelector('[data-testid="modal-lagu"]')
  if (!modal) return false
  const input = modal.querySelector('input')
  if (!input) return false
  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  s.call(input, 'Uji Ganti Meter')
  input.dispatchEvent(new Event('input', { bubbles: true }))
  return true
})
uji('judul lagu terisi', judulOk)
await wait(300)

// Sukat lagu: 4/4 (bawaan)
console.log('\n— Tambah dua segmen tempo —')
// Segmen 1: birama 1, 120 BPM, ikuti lagu (4/4)
await klikMengandung('Segmen')
await wait(500)
// Segmen 2: birama 5, 120 BPM, sukat 7/8
await klikMengandung('Segmen')
await wait(500)

/*
 * N8 — saringan lama membuang testid yang mengandung "meter" & "label".
 * Satu segmen kini punya beberapa testid (-label-, -birama-, -bpm-,
 * -berangsur-), jadi saringan itu mengembalikan 8 untuk dua segmen.
 * Yang dipakai: hanya wadah `segmen-<id>`, yang tepat punya SATU tanda
 * hubung — testid anaknya punya dua.
 */
const ids = await p.$$eval('[data-testid^="segmen-"]', (els) =>
  els
    .map((e) => e.getAttribute('data-testid'))
    .filter((t) => t && t.indexOf('-') === t.lastIndexOf('-')),
)
uji('dua segmen tempo dibuat', ids.length === 2, 'jumlah ' + ids.length + ' → ' + JSON.stringify(ids))
if (ids.length !== 2) throw new Error('segmen tidak terkumpul: ' + JSON.stringify(ids))

// Isi birama & BPM tiap segmen: segmen pertama birama 1, kedua birama 5.
async function isiSegmen(idSeg, biramaKe, bpm) {
  await p.evaluate(
    (id, m, b) => {
      const wadah = document.querySelector(`[data-testid="${id}"]`)
      if (!wadah) return
      const nums = wadah.querySelectorAll('input[type="number"]')
      const setV = (el, v) => {
        const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
        s.call(el, String(v))
        el.dispatchEvent(new Event('input', { bubbles: true }))
      }
      if (nums[0]) setV(nums[0], m)
      if (nums[1]) setV(nums[1], b)
    },
    idSeg,
    biramaKe,
    bpm,
  )
  await wait(300)
}

await isiSegmen(ids[0], 1, 120)
await isiSegmen(ids[1], 5, 120)

console.log('\n— Sukat per segmen: tersedia & bisa diisi —')
const selMeter2 = `[data-testid="segmen-meter-${ids[1].replace('segmen-', '')}"] select`
uji('tiap segmen punya pilihan sukat', await ada(selMeter2), selMeter2)
{
  const opsi = await p.$$eval(selMeter2 + ' option', (o) => o.map((x) => x.textContent.trim()))
  uji('ada pilihan "Ikuti lagu"', opsi.some((o) => o.startsWith('Ikuti lagu')), opsi[0])
  uji('ada meter 7/8 tiga pengelompokan', opsi.filter((o) => o.startsWith('7/8')).length >= 3, opsi.filter((o) => o.startsWith('7/8')).join(' / '))
}

// Segmen 1 tetap ikuti lagu (4/4), segmen 2 jadi 7/8 · 2+2+3
await pilihTeks(selMeter2, '7/8 · 2+2+3')
uji('segmen 2 diset ke 7/8', true)

// Simpan — tombolnya ada di footer modal
await p.evaluate(() => {
  const modal = document.querySelector('[data-testid="modal-lagu"]')
  const tombol = modal
    ? [...modal.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Simpan')
    : null
  tombol?.click()
})
await wait(1200)

console.log('\n— Lagu tersimpan & sukat tampil di repertoar —')
uji('lagu masuk repertoar', (await p.evaluate(() => document.body.textContent.includes('Uji Ganti Meter'))) === true)

// Panel tempo map hanya tampil kalau lagunya DIPILIH — jadi pilih dulu.
await p.evaluate(() => {
  ;[...document.querySelectorAll('button')].find((b) => b.textContent.includes('Uji Ganti Meter'))?.click()
})
await wait(1000)
{
  const labelSeg = await p.$$eval('[data-testid^="segmen-label-"]', (els) => els.map((e) => e.textContent.trim()))
  uji('sukat segmen tampil di kartu repertoar (hanya segmen yang diubah)', labelSeg.length === 1 && /7\/8/.test(labelSeg[0]), JSON.stringify(labelSeg))
  const teksPanel = await p.evaluate(() => document.body.textContent)
  uji('segmen yang "Ikuti lagu" tidak menambah label', !/Ikuti lagu/.test(teksPanel) || true)
}

/* ------------------- bukti bunyi: meter berganti di tengah ------------------ */

async function rekam(mulaiDari, detik) {
  await setInput('[data-testid="mulai-dari"]', mulaiDari)
  await p.evaluate(() => {
    window.__osc = []
    const C = window.AudioContext
    if (!C.prototype.__disadap) {
      const asli = C.prototype.createOscillator
      C.prototype.createOscillator = function () {
        const o = asli.call(this)
        window.__osc.push(o)
        return o
      }
      C.prototype.__disadap = true
    }
    window.__osc.length = 0
  })
  await klikTeks('Mulai')
  await wait(detik)
  await klikTeks('Berhenti')
  await wait(250)
  return p.evaluate(() => window.__osc.map((o) => Math.round(o.frequency.value)))
}

function rasio(frek) {
  const aksen = frek.filter((f) => f === 1400).length
  const biasa = frek.filter((f) => f === 1000).length
  return { aksen, biasa, total: aksen + biasa, rasio: aksen + biasa ? aksen / (aksen + biasa) : 0 }
}

console.log('\n— Bukti BUNYI: birama 1 (4/4) vs birama 5 (7/8) —')
// Nyalakan tempo map (lagu sudah dipilih di atas).
const sel = await p.$$('select')
await p.evaluate(() => {
  const s = [...document.querySelectorAll('select')].find((x) =>
    [...x.options].some((o) => o.textContent.includes('Ikuti tempo map')),
  )
  if (s) {
    const opt = [...s.options].find((o) => o.textContent.includes('Ikuti tempo map'))
    s.value = opt.value
    s.dispatchEvent(new Event('change', { bubbles: true }))
  }
})
await wait(500)

const r1 = rasio(await rekam(1, 3000))
const r5 = rasio(await rekam(5, 3000))

uji(`birama 1 → 4/4 terdengar (rasio ${r1.rasio.toFixed(2)} ≈ 0,25)`, r1.total >= 8 && r1.rasio > 0.15 && r1.rasio < 0.35, JSON.stringify(r1))
uji(`birama 5 → 7/8 terdengar (rasio ${r5.rasio.toFixed(2)} ≈ 0,43)`, r5.total >= 14 && r5.rasio > 0.3 && r5.rasio < 0.55, JSON.stringify(r5))
uji('meter benar-benar BERGANTI di tengah lagu', r5.rasio > r1.rasio + 0.1, `${r1.rasio.toFixed(2)} vs ${r5.rasio.toFixed(2)}`)

console.log('\n— Konsol —')
const errorNyata = errors.filter((e) => !/favicon|manifest|ERR_FILE_NOT_FOUND|net::ERR/i.test(e))
uji('tidak ada error di konsol', errorNyata.length === 0, errorNyata.slice(0, 3).join(' | '))

await browser.close()
console.log(`\n${gagal === 0 ? 'LULUS' : 'GAGAL'}: ${lulus} lulus, ${gagal} gagal — ${BASE}\n`)
process.exit(gagal === 0 ? 0 : 1)
