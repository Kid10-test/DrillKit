/**
 * Uji K2 — latihan per section di presenter.
 *
 * Pilih satu section: hanya section itu yang bergerak, sisanya tampil redup
 * sebagai patokan. Bisa diulang terus tanpa maju ke set berikutnya — persis
 * yang dilakukan pelatih: "Battery, ulangi lagi."
 *
 * Yang diuji bukan sekadar "tombolnya ada", melainkan tiga hal yang bisa
 * salah diam-diam:
 *   1. titik yang diredup benar-benar tidak ikut bergerak;
 *   2. "Ulang terus" mengulang tanpa pernah maju ke set berikutnya;
 *   3. formasi kembali utuh ke posisi awal tiap kali mengulang.
 */
import puppeteer from 'puppeteer'
import { lewatSambutan } from './sambutan.mjs'
/* N14 — dialihkan dari server pengembangan (:5173) ke hasil build
   (:4173). Server pengembangan menyajikan ratusan modul sekali muat dan
   kehabisan memori di kotak pasir; karena itu rangkaian ini dulu tidak
   pernah bisa masuk daftar regresi. */
const BASE = process.env.BASE || 'http://localhost:4173'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--mute-audio'] })
const p = await b.newPage()
await p.setViewport({ width: 1440, height: 1000 })
const errs = []
p.on('pageerror', (e) => errs.push(e.message.slice(0, 160)))
p.on('console', (m) => {
  if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160))
})

let lulus = 0
let gagal = 0
const catat = []
function cek(nama, syarat, keterangan = '') {
  if (syarat) lulus++
  else {
    gagal++
    catat.push(`GAGAL: ${nama}${keterangan ? ' — ' + keterangan : ''}`)
  }
}
const R = {}

const tombol = (t) =>
  p.evaluate((x) => {
    const el = [...document.querySelectorAll('button')].find((y) => y.textContent.trim() === x)
    if (!el || el.disabled) return false
    el.click()
    return true
  }, t)
const tombolJudul = (j) =>
  p.evaluate((x) => {
    const el = [...document.querySelectorAll('button')].find((y) =>
      (y.getAttribute('title') || '').includes(x),
    )
    if (!el || el.disabled) return false
    el.click()
    return true
  }, j)
const isi = (sel, v) =>
  p.evaluate(
    (s, val) => {
      const el = document.querySelector(s)
      if (!el) return false
      const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement : HTMLInputElement
      const set = Object.getOwnPropertyDescriptor(proto.prototype, 'value').set
      set.call(el, String(val))
      el.dispatchEvent(new Event('input', { bubbles: true }))
      return true
    },
    sel,
    v,
  )
const klik = (sel) =>
  p.evaluate((s) => {
    const el = document.querySelector(s)
    if (!el) return false
    el.click()
    return true
  }, sel)

/** Keadaan semua titik pemain: opasitas & punya transform atau tidak. */
const titik = () =>
  p.evaluate(() => {
    const out = []
    for (const g of document.querySelectorAll('g[data-pemain]')) {
      const tr = g.getAttribute('transform')
      const m = tr ? /translate\(([-\d.e]+) ([-\d.e]+)\)/.exec(tr) : null
      out.push({
        id: g.getAttribute('data-pemain'),
        redup: Number(g.getAttribute('opacity') ?? '1') < 1,
        bergerak: m ? Math.hypot(Number(m[1]), Number(m[2])) > 0.5 : false,
      })
    }
    return out
  })

const infoSet = () =>
  p.evaluate(
    () => document.querySelector('[data-testid="info-set"]')?.textContent?.trim() ?? null,
  )

/** Amati titik-titik selama `ms`, kembalikan cuplikan per detik. */
async function amati(ms, tiap = 120) {
  const cuplikan = []
  const setTerlihat = new Set()
  const t0 = Date.now()
  while (Date.now() - t0 < ms) {
    const t = await titik()
    cuplikan.push(t)
    const s = await infoSet()
    if (s) setTerlihat.add(s)
    await wait(tiap)
  }
  return { cuplikan, set: [...setTerlihat] }
}

/* =============================== Persiapan =============================== */
await p.goto(BASE + '/', { waitUntil: 'networkidle2' })
/* Layar sambutan muncul di setiap profil baru; tanpa ini rangkaian
   tidak bisa menyentuh apa pun. */
await lewatSambutan(p)
await wait(1600)
await p.evaluate(() => {
  const x = [...document.querySelectorAll('button')].find((y) =>
    y.textContent.includes('Muat data contoh'),
  )
  x && x.click()
})
await wait(3600)
await p.evaluate(() => {
  location.hash = '#/drill'
})
await wait(2800)

// Data contoh hanya 2 set. Tambah satu supaya "maju" bisa dibedakan dari
// "mengulang", lalu perkecil count-nya supaya uji cepat.
await p.keyboard.press('BracketRight')
await wait(1400)
await tombol('Set baru')
await wait(1800)
await p.evaluate(() => {
  const lab = [...document.querySelectorAll('label')].find((x) => x.textContent.includes('Geser blok'))
  const sel = lab?.parentElement?.querySelector('select')
  if (!sel) return false
  const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set
  set.call(sel, '8')
  sel.dispatchEvent(new Event('change', { bubbles: true }))
  return true
})
await wait(700)
await tombol('Ke depan')
await wait(1500)
const isiCount = (v) =>
  p.evaluate((nilai) => {
    const lab = [...document.querySelectorAll('label')].find((x) =>
      x.textContent.includes('Count ke set berikutnya'),
    )
    const el = lab?.parentElement?.querySelector('input')
    if (!el) return false
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    set.call(el, String(nilai))
    el.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  }, v)
await isiCount(4)
await wait(800)
await p.keyboard.press('BracketLeft')
await wait(1500)
await isiCount(4)
await wait(900)

/* ===================== 1. Buka presenter ================================ */
R.bukaPresenter = await tombolJudul('Mode presenter')
await wait(2400)

R.barisAda = await p.evaluate(() => !!document.querySelector('[data-testid="baris-seksi"]'))
R.daftarSeksi = await p.evaluate(() =>
  [...document.querySelectorAll('[data-testid="baris-seksi"] button')].map((b) =>
    b.textContent.trim(),
  ),
)
cek('baris pilihan section tampil', R.barisAda === true)
cek('ada pilihan "Semua"', R.daftarSeksi.includes('Semua'), JSON.stringify(R.daftarSeksi))
cek('ada lebih dari satu section', R.daftarSeksi.length > 2, JSON.stringify(R.daftarSeksi))

// Awalnya "Semua": tidak boleh ada titik yang diredup.
const semua = await titik()
R.jumlahTitik = semua.length
R.redupAwal = semua.filter((t) => t.redup).length
cek('titik pemain terbaca', R.jumlahTitik > 0, `${R.jumlahTitik}`)
cek('awalnya tidak ada titik yang diredup', R.redupAwal === 0, `${R.redupAwal}`)

/* ============ 2. Pilih satu section → sisanya diredup =================== */
R.seksiDipilih = R.daftarSeksi.find((s) => s !== 'Semua')
R.klikSeksi = await p.evaluate((nama) => {
  const el = [...document.querySelectorAll('[data-testid="baris-seksi"] button')].find(
    (b) => b.textContent.trim() === nama,
  )
  if (!el) return false
  el.click()
  return true
}, R.seksiDipilih)
await wait(900)
const setelah = await titik()
R.redup = setelah.filter((t) => t.redup).length
R.terang = setelah.filter((t) => !t.redup).length
cek('chip section bisa diklik', R.klikSeksi === true, String(R.seksiDipilih))
cek('sebagian titik diredup', R.redup > 0, `${R.redup} redup`)
cek('sebagian titik tetap terang', R.terang > 0, `${R.terang} terang`)
cek('yang diredup + yang terang = semua titik', R.redup + R.terang === R.jumlahTitik,
  `${R.redup}+${R.terang} vs ${R.jumlahTitik}`)

/* ======= 3. Yang diredup benar-benar tidak ikut bergerak ================ */
await klik('[data-testid="chip-ulang-perpindahan"]')
await wait(600)
// Presenter dibuka pada set yang sedang aktif di editor, jadi set awalnya
// dicatat apa adanya — jangan ditebak.
R.setAwal = await infoSet()
await klik('[data-testid="tombol-urutan"]')
const pengamatan = await amati(7000)

let pernahBergerakRedup = 0
let pernahBergerakTerang = 0
for (const c of pengamatan.cuplikan) {
  if (c.some((t) => t.redup && t.bergerak)) pernahBergerakRedup++
  if (c.some((t) => !t.redup && t.bergerak)) pernahBergerakTerang++
}
R.pernahBergerakRedup = pernahBergerakRedup
R.pernahBergerakTerang = pernahBergerakTerang
R.jumlahCuplikan = pengamatan.cuplikan.length

cek('selama latihan, titik terang benar-benar bergerak', pernahBergerakTerang > 0,
  `${pernahBergerakTerang}/${R.jumlahCuplikan}`)
cek('titik yang diredup TIDAK PERNAH bergerak', pernahBergerakRedup === 0,
  `${pernahBergerakRedup} cuplikan memuat titik redup yang bergerak`)

/* ====== 4. "Ulang terus": tidak pernah maju ke set berikutnya =========== */
R.setTerlihat = pengamatan.set
cek('set tidak pernah maju walau latihan berjalan lama',
  R.setTerlihat.length === 1, JSON.stringify(R.setTerlihat))
cek('set bertahan di tempat latihan dimulai', R.setTerlihat[0] === R.setAwal,
  `${R.setAwal} → ${JSON.stringify(R.setTerlihat)}`)
// Dan set itu bukan set terakhir — kalau iya, "tidak maju" bukan bukti apa pun.
cek('setnya bukan set terakhir (jadi ia memang bisa maju, tapi tidak)',
  R.setAwal !== '3/3', String(R.setAwal))

/* ====== 5. Formasi kembali utuh tiap kali mengulang ==================== */
/**
 * Kalau mengulang tidak membersihkan transform, titik akan terus merayap
 * menjauhi posisi awalnya. Di akhir setiap putaran semua titik harus kembali
 * ke posisi semula — jadi jarak totalnya mengecil lagi mendekati nol.
 */
R.jarakMaks = 0
R.jarakMinSepanjang = Infinity
for (const c of pengamatan.cuplikan) {
  const bergerak = c.filter((t) => t.bergerak).length
  R.jarakMaks = Math.max(R.jarakMaks, bergerak)
  R.jarakMinSepanjang = Math.min(R.jarakMinSepanjang, bergerak)
}
cek('perpindahan benar-benar terjadi berulang (titik bergerak)',
  R.jarakMaks > 0, `maks ${R.jarakMaks}`)
cek('ada saat titik kembali diam (putaran selesai & diulang dari awal)',
  R.jarakMinSepanjang === 0, `min ${R.jarakMinSepanjang}`)

/* ====== 6. Kembali ke "Semua" → tidak ada yang diredup ================= */
await klik('[data-testid="tombol-urutan"]') // hentikan dulu
await wait(900)
await klik('[data-testid="chip-seksi-semua"]')
await wait(900)
const akhir = await titik()
R.redupAkhir = akhir.filter((t) => t.redup).length
cek('kembali ke Semua menghapus semua peredupan', R.redupAkhir === 0, `${R.redupAkhir}`)

/* ====== 7. Tanpa "Ulang terus", set harus maju seperti sediakala ======= */
await klik('[data-testid="chip-ulang-perpindahan"]')
await wait(600)
await klik('[data-testid="tombol-urutan"]')
const maju = await amati(8000)
R.setMaju = maju.set
cek('tanpa Ulang terus, urutan tetap maju (B3 tidak rusak)',
  R.setMaju.length >= 2, JSON.stringify(R.setMaju))

/* ================================ Ringkasan ============================== */
R.error = errs
cek('tidak ada error di konsol', errs.length === 0, errs.join(' | ').slice(0, 200))

console.log(JSON.stringify(R, null, 2))
console.log(`\n${lulus} lulus, ${gagal} gagal`)
if (catat.length) console.log(catat.join('\n'))
await b.close()
process.exit(gagal ? 1 : 0)
