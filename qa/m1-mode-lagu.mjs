/**
 * M1 — mode lagu: panel "sedang diputar", strip segmen, indikator ketuk,
 * dan tombol tambah segmen di bawah.
 *
 * Pakai: node m1-mode-lagu.mjs [BASE_URL]
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
const klikTeks = (lb) =>
  p.evaluate((x) => {
    ;[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === x)?.click()
  }, lb)
async function klikMengandung(lb) {
  await p.evaluate((x) => {
    ;[...document.querySelectorAll('button')].find((b) => b.textContent.includes(x))?.click()
  }, lb)
  await wait(500)
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
  if (v === null) throw new Error('opsi tidak ketemu: ' + label)
  await p.select(sel, v)
  await wait(350)
}

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

/* ------------------------- siapkan lagu dua segmen ------------------------- */

console.log('\n— Tombol tambah segmen juga ada di BAWAH daftar —')
await klikMengandung('Tambah lagu')
await wait(400)
await p.evaluate(() => {
  const m = document.querySelector('[data-testid="modal-lagu"]')
  const i = m?.querySelector('input')
  if (i) {
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    set.call(i, 'Lagu Mode Uji')
    i.dispatchEvent(new Event('input', { bubbles: true }))
  }
})
await wait(300)
uji('tombol tambah segmen di bawah ada', await ada('[data-testid="tambah-segmen-bawah"]'))
uji('ada keterangan saat segmen masih kosong', (await p.evaluate(() => document.body.textContent)).includes('Belum ada segmen'))

// Tambah dua segmen lewat tombol BAWAH (bukan yang di atas).
await p.click('[data-testid="tambah-segmen-bawah"]')
await wait(400)
await p.click('[data-testid="tambah-segmen-bawah"]')
await wait(500)

/*
 * N8 — dulu satu segmen hanya punuh satu testid (`segmen-<id>`), jadi
 * menyaring yang mengandung "meter" & "label" sudah cukup. Kini satu
 * segmen punuh BEBERAPA testid (`-label-`, `-birama-`, `-bpm-`,
 * `-berangsur-`), sehingga saringan itu mengembalikan 8 untuk dua segmen
 * dan seluruh urutan sesudahnya meleset.
 *
 * Yang dipakai sekarang: hanya **wadahnya** — testid `segmen-<id>` yang
 * tepat punya satu tanda hubung, sedangkan testid anaknya punya dua.
 * Kalau lain hari sebuah testid anak ditambahkan tanpa tanda hubung,
 * hitungan ini kembali meleset; karena itu disaring dari id-nya, bukan
 * dari daftar nama yang harus diingat.
 */
const ids = await p.$$eval('[data-testid^="segmen-"]', (els) =>
  els
    .map((e) => e.getAttribute('data-testid'))
    .filter((t) => t && t.indexOf('-') === t.lastIndexOf('-')),
)
sama('tombol bawah menambah 2 segmen', ids.length, 2)

// Isi: segmen 1 = birama 1, 112 BPM, ikuti lagu (4/4)
//      segmen 2 = birama 5, 132 BPM, 7/8
await p.evaluate((a) => {
  const setV = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, String(v))
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }
  a.forEach((id, ix) => {
    const w = document.querySelector(`[data-testid="${id}"]`)
    if (!w) return
    const t = w.querySelector('input')
    if (t) setV(t, ix === 0 ? 'A — pembuka' : 'B — ganti meter')
    const n = w.querySelectorAll('input[type="number"]')
    if (n[0]) setV(n[0], ix === 0 ? 1 : 5)
    if (n[1]) setV(n[1], ix === 0 ? 112 : 132)
  })
}, ids)
await wait(400)
await pilihTeks(`[data-testid="segmen-meter-${ids[1].replace('segmen-', '')}"] select`, '7/8 · 2+2+3')
await wait(300)

await p.evaluate(() => {
  const m = document.querySelector('[data-testid="modal-lagu"]')
  ;[...(m?.querySelectorAll('button') ?? [])].find((b) => b.textContent.trim() === 'Simpan')?.click()
})
await wait(1200)

// Pilih lagu
await p.evaluate(() => {
  ;[...document.querySelectorAll('button')].find((b) => b.textContent.includes('Lagu Mode Uji'))?.click()
})
await wait(1000)
// Nyalakan tempo map
await p.evaluate(() => {
  const s = [...document.querySelectorAll('select')].find((x) =>
    [...x.options].some((o) => o.textContent.includes('Ikuti tempo map')),
  )
  const opt = s && [...s.options].find((o) => o.textContent.includes('Ikuti tempo map'))
  if (s && opt) {
    s.value = opt.value
    s.dispatchEvent(new Event('change', { bubbles: true }))
  }
})
await wait(500)

/* ------------------------------ panel & strip ------------------------------ */

console.log('\n— Panel "sedang diputar" —')
uji('panel tampil saat lagu dipilih', await ada('[data-testid="panel-lagu"]'))
uji('panel menampilkan judul lagu', (await teks('[data-testid="panel-judul"]')) === 'Lagu Mode Uji')
uji('panel menampilkan tempo segmen 1 (112)', (await teks('[data-testid="panel-tempo"]')) === '112 BPM')
uji('panel menampilkan sukat 4/4', (await teks('[data-testid="panel-sukat"]')) === '4/4')
uji('panel menampilkan nama segmen', (await teks('[data-testid="panel-segmen"]')) === 'A — pembuka')
uji('panel menampilkan waktu 0:00', (await teks('[data-testid="panel-waktu"]'))?.startsWith('0:00'))
uji('tanpa peringatan karena tempo map menyala', !(await ada('[data-testid="panel-peringatan-map"]')))

console.log('\n— Strip segmen (mirip strip set di drill) —')
uji('strip segmen tampil', await ada('[data-testid="strip-segmen"]'))
uji('dua chip segmen', (await p.$$('[data-testid^="chip-segmen-"]')).length === 2)
uji('chip 0 aktif di birama 1', (await p.$eval('[data-testid="chip-segmen-0"]', (e) => e.getAttribute('data-aktif'))) === '1')
uji('chip 1 tidak aktif', (await p.$eval('[data-testid="chip-segmen-1"]', (e) => e.getAttribute('data-aktif'))) === '0')
uji('chip menampilkan rentang birama & tempo', /birama 5\+? · 132 BPM · 7\/8/.test(await teks('[data-testid="chip-segmen-1"]')), await teks('[data-testid="chip-segmen-1"]'))

console.log('\n— Klik chip → loncat & panel ikut berubah —')
await p.click('[data-testid="chip-segmen-1"]')
await wait(700)
uji('mulai dari birama berubah ke 5', (await p.$eval('[data-testid="mulai-dari"]', (e) => e.value)) === '5')
uji('panel tempo ikut ke 132', (await teks('[data-testid="panel-tempo"]')) === '132 BPM')
uji('panel sukat ikut ke 7/8', (await teks('[data-testid="panel-sukat"]')) === '7/8')
uji('panel segmen ikut ke B', (await teks('[data-testid="panel-segmen"]')) === 'B — ganti meter')
uji('chip 1 kini aktif', (await p.$eval('[data-testid="chip-segmen-1"]', (e) => e.getAttribute('data-aktif'))) === '1')
{
  const w = await teks('[data-testid="panel-waktu"]')
  // birama 1..4 = 4 × (4 × 60/112) = 8,571 dtk → 0:08
  uji('waktu berjalan dihitung dari tempo map (' + w + ')', /^0:0[89]/.test(w), w)
}

console.log('\n— Indikator ketuk mengikuti sukat 7/8 —')
{
  const kotak = await p.$$eval('[data-testid="indikator-ketuk"] div[data-tingkat]', (els) =>
    els.map((e) => Number(e.getAttribute('data-tingkat'))),
  )
  sama('7 kotak karena sukat 7/8', kotak.length, 7)
  sama('aksen di 1,3,5 (2+2+3)', kotak.map((v, i) => (v === 2 ? i : -1)).filter((i) => i >= 0), [0, 2, 4])
  const ket = await teks('[data-testid="keterangan-indikator"]')
  uji('keterangan menyebut 7/8 & 2+2+3', /7\/8/.test(ket) && /2\+2\+3/.test(ket), ket)
}

console.log('\n— Saat diputar: birama & panel bergerak —')
await klikTeks('Mulai')
await wait(2600)
const b1 = await teks('[data-testid="panel-birama"]')
await wait(2200)
const b2 = await teks('[data-testid="panel-birama"]')
uji(`birama bertambah (${b1} → ${b2})`, Number(b2) > Number(b1), `${b1} → ${b2}`)
{
  const menyala = await p.$$eval('[data-testid="indikator-ketuk"] div[data-aktif="1"]', (e) => e.length)
  uji('ada kotak yang menyala saat diputar', menyala >= 1, 'menyala ' + menyala)
}
await klikTeks('Berhenti')
await wait(400)

console.log('\n— Konsol —')
const errorNyata = errors.filter((e) => !/favicon|manifest|ERR_FILE_NOT_FOUND|net::ERR/i.test(e))
uji('tidak ada error di konsol', errorNyata.length === 0, errorNyata.slice(0, 3).join(' | '))

await browser.close()
console.log(`\n${gagal === 0 ? 'LULUS' : 'GAGAL'}: ${lulus} lulus, ${gagal} gagal — ${BASE}\n`)
process.exit(gagal === 0 ? 0 : 1)
