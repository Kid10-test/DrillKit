/**
 * Uji antarmuka J1 — tiga polesan, lewat peramban sungguhan (versi jadi).
 *
 * A. **Transposisi penala.** Mikrofon palsu memutar Bb4 konser (466,16 Hz,
 *    `nada-bb4.wav`). Yang harus tampil: C5 untuk Bb, G5 untuk Eb, F5 untuk
 *    F — dengan nada konsernya tetap disebut — dan kembali Bb4 untuk konser.
 *    Pilihan instrumen diingat setelah muat ulang. Sen tidak ikut bergeser.
 * B. **Ambang predikat.** Diatur lewat Pengaturan (diketik, bukan ditulis ke
 *    basis data), lalu dibuktikan di tiga tempat: pengaturan tersimpan,
 *    kartu kehadiran (tiap kartu: predikat cocok dengan % & ambang), dan
 *    CSV ringkas. Urutan terbalik dirapikan; kolom dikosongkan ≠ nol.
 * C. **Panduan anggota.** Dari menu Berbagi dan dari Pengaturan: isinya versi
 *    anggota (bukan tertukar dengan versi pelatih), memuat alamat situs ini
 *    + kode QR, dan **benar-benar satu halaman A4** — juga kasus terberat.
 * D. **Lebar HP 360px**: kotak instrumen & kotak panduan tidak meluber.
 *
 * Pakai: BASE=http://localhost:4173 node qa/j1-polesan.mjs
 */
import puppeteer from 'puppeteer'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { lewatSambutan } from './sambutan.mjs'
import { QA } from './lokasi.mjs'
import { htmlPanduanAnggota } from '/tmp/panduan.mjs'

const BASE = process.env.BASE || 'http://localhost:4173'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const UNDUH = path.join(os.tmpdir(), `unduh-j1-${Date.now()}`)
fs.mkdirSync(UNDUH, { recursive: true })

let lulus = 0
const gagal = []
const cek = (nama, syarat, ket = '') => {
  if (syarat) lulus++
  else gagal.push(`${nama}${ket ? ' — ' + ket : ''}`)
}
const errors = []

async function luncur(extra = []) {
  const b = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--mute-audio', ...extra],
    defaultViewport: { width: 1300, height: 1000 },
  })
  const p = await b.newPage()
  p.on('pageerror', (e) => errors.push(e.message.slice(0, 160)))
  p.on('console', (m) => {
    if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 160))
  })
  await p.goto(BASE + '/', { waitUntil: 'networkidle2' })
  await lewatSambutan(p)
  return { b, p }
}
const teks = (p, id) =>
  p.evaluate((x) => document.querySelector(`[data-testid="${x}"]`)?.textContent.replace(/\s+/g, ' ').trim() ?? null, id)
const ada = (p, id) => p.evaluate((x) => document.querySelector(`[data-testid="${x}"]`) != null, id)
const ke = async (p, hash, ms = 1800) => {
  await p.evaluate((h) => {
    location.hash = h
  }, hash)
  await wait(ms)
}
const tombol = (p, t) =>
  p.evaluate((x) => {
    const el = [...document.querySelectorAll('button')].find((y) => y.textContent.trim() === x)
    if (!el || el.disabled) return false
    el.click()
    return true
  }, t)
/** Ketik ke kolom React: klik tiga kali → Ctrl+A → ketik (lihat qa/README.md). */
async function ketik(p, id, nilai) {
  const sel = `[data-testid="${id}"]`
  await p.click(sel, { clickCount: 3 })
  await p.keyboard.down('Control')
  await p.keyboard.press('a')
  await p.keyboard.up('Control')
  await p.keyboard.press('Backspace')
  if (nilai !== '') await p.keyboard.type(String(nilai))
  await wait(250)
}
const bacaPengaturan = (p) =>
  p.evaluate(
    () =>
      new Promise((res) => {
        const r = indexedDB.open('drillkit')
        r.onsuccess = () => {
          const g = r.result.transaction('settings').objectStore('settings').get('team')
          g.onsuccess = () => res(g.result ?? null)
          g.onerror = () => res(null)
        }
        r.onerror = () => res(null)
      }),
  )
/** Hitung halaman PDF: objek `/Type /Page` (bukan `/Pages`). */
const jumlahHalaman = (buf) => (Buffer.from(buf).toString('latin1').match(/\/Type\s*\/Page(?![s\w])/g) ?? []).length
async function halamanA4(b, html) {
  const h = await b.newPage()
  await h.setContent(html, { waitUntil: 'load' })
  await wait(300)
  const pdf = await h.pdf({ format: 'A4', printBackground: true })
  await h.close()
  return jumlahHalaman(pdf)
}

/* ========================================================================== */
/*  A. Transposisi penala                                                     */
/* ========================================================================== */
{
  const wav = path.join(QA, 'nada-bb4.wav')
  const { b, p } = await luncur([
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    `--use-file-for-fake-audio-capture=${wav}`,
    '--autoplay-policy=no-user-gesture-required',
  ])
  await ke(p, '#/musik', 2200)
  cek('A: kotak Instrumen ada', await ada(p, 'pilih-transposisi'))
  const opsi = await p.evaluate(() => [...document.querySelectorAll('[data-testid="pilih-transposisi"] option')].map((o) => o.value))
  cek('A: enam pilihan instrumen', opsi.join(',') === 'c,bb,bb8,eb,eb8,f', opsi.join(','))
  cek('A: bawaan konser → tanpa baris "konser"', !(await ada(p, 'nada-konser')))

  await p.click('[data-testid="tombol-mikrofon"]')
  const tunggu = async () => {
    await wait(1800)
    return {
      nada: await teks(p, 'nada-terdeteksi'),
      konser: await teks(p, 'nada-konser'),
      sen: await teks(p, 'sen-terdeteksi'),
    }
  }
  const konser = await tunggu()
  cek('A: konser → Bb4', konser.nada === 'A#4 / Bb4', JSON.stringify(konser))
  const senKonser = parseInt(konser.sen ?? '', 10)
  cek('A: sen terbaca (±3)', Math.abs(senKonser) <= 3, konser.sen)

  const HARAP = [
    ['bb', 'C5'],
    ['eb', 'G5'],
    ['f', 'F5'],
    ['bb8', 'C6'], // Bb4 konser di sax tenor = C6 tertulis (M9)
    ['eb8', 'G6'],
  ]
  for (const [id, harap] of HARAP) {
    await p.select('[data-testid="pilih-transposisi"]', id)
    const h = await tunggu()
    cek(`A: ${id} → ${harap}`, h.nada === harap, JSON.stringify(h))
    cek(`A: ${id} → nada konser tetap disebut`, (h.konser ?? '').includes('A#4 / Bb4'), h.konser)
    cek(`A: ${id} → sen tidak bergeser`, Math.abs(parseInt(h.sen ?? '', 10) - senKonser) <= 2, `${h.sen} vs ${senKonser}`)
  }

  // Nada dengung: Bb konser (A#3) → C4 tertulis untuk trumpet.
  await p.select('[data-testid="pilih-transposisi"]', 'bb')
  await p.click('[data-testid="preset-bb"]')
  await wait(300)
  cek('A: dengung Bb3 → "C4 di partitur Bb"', /C4 di partitur Bb/.test((await teks(p, 'dengung-tertulis')) ?? ''), await teks(p, 'dengung-tertulis'))

  // Diingat setelah muat ulang.
  await p.reload({ waitUntil: 'networkidle2' })
  await wait(2000)
  const nilai = await p.evaluate(() => document.querySelector('[data-testid="pilih-transposisi"]')?.value)
  cek('A: pilihan instrumen diingat', nilai === 'bb', nilai)
  cek('A: sebelum mendengar, keterangan instrumen tampil', /nada tertulis untuk instrumen Bb/.test((await teks(p, 'nada-konser')) ?? ''))

  // Kembali ke konser → tampilan lama persis.
  await p.select('[data-testid="pilih-transposisi"]', 'c')
  await wait(300)
  cek('A: konser lagi → baris konser hilang', !(await ada(p, 'nada-konser')) && !(await ada(p, 'dengung-tertulis')))
  await b.close()
}

/* ========================================================================== */
/*  B. Ambang predikat laporan                                                */
/* ========================================================================== */
{
  const { b, p } = await luncur()
  const cdp = await p.target().createCDPSession()
  await cdp.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: UNDUH })
  await p.evaluate(() => [...document.querySelectorAll('button')].find((y) => y.textContent.includes('Muat data contoh'))?.click())
  await wait(3600)
  // Absensi data contoh ACAK (82% hadir). Supaya bukti "ambang mengubah
  // predikat" tidak bergantung pada untung-untungan, satu anggota dipastikan
  // 50% (1 hadir, 1 alpha). Tulisan mentah → muat ulang (lihat qa/README.md).
  await p.evaluate(
    () =>
      new Promise((res) => {
        const r = indexedDB.open('drillkit')
        r.onsuccess = () => {
          const st = r.result.transaction('attendance', 'readwrite').objectStore('attendance')
          const g = st.getAll()
          g.onsuccess = () => {
            const semua = g.result
            const id = semua[0]?.memberId
            semua.filter((x) => x.memberId === id).forEach((x, i) => st.put({ ...x, status: i === 0 ? 'hadir' : 'alpha' }))
            st.transaction.oncomplete = () => res(true)
          }
        }
      }),
  )
  await p.reload({ waitUntil: 'networkidle2' })
  await wait(1500)

  // J1a — ambang "Perlu perhatian" di Rekap mengikuti ambang Cukup (bawaan 70),
  // bukan lagi angka 60 yang tidak terhubung ke apa pun.
  const nilaiBatas = () => p.evaluate(() => document.querySelector('[data-testid="pilih-batas-rendah"]')?.value ?? null)
  const labelBatas = () =>
    p.evaluate(() => {
      const s = document.querySelector('[data-testid="pilih-batas-rendah"]')
      return s ? s.options[s.selectedIndex].text : null
    })
  const pilihBatas = (v) =>
    p.evaluate((x) => {
      const s = document.querySelector('[data-testid="pilih-batas-rendah"]')
      const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set
      set.call(s, x)
      s.dispatchEvent(new Event('change', { bubbles: true }))
    }, String(v))
  await ke(p, '#/absensi', 1600)
  await tombol(p, 'Rekap')
  await wait(1600)
  cek('J1a: ambang Rekap bawaan = Cukup 70', (await nilaiBatas()) === '70', await nilaiBatas())
  cek('J1a: pilihan ditandai "(Cukup)"', /\(Cukup\)/.test((await labelBatas()) ?? ''), await labelBatas())
  cek('J1a: tanpa peringatan beda', !(await ada(p, 'batas-beda-cukup')))
  await pilihBatas(60)
  await wait(500)
  cek('J1a: memilih 60 → peringatan beda dari Cukup', await ada(p, 'batas-beda-cukup'))
  cek('J1a: laporan ikut ambang yang dipilih (60)', /di bawah (ambang )?60%/.test((await teks(p, 'kalimat-ringkasan')) ?? ''), await teks(p, 'kalimat-ringkasan'))
  await p.click('[data-testid="batas-ikut-cukup"]')
  await wait(500)
  cek('J1a: "Kembali ke 70%" → ikut Cukup lagi', (await nilaiBatas()) === '70' && !(await ada(p, 'batas-beda-cukup')))
  cek('J1a: laporan memakai 70%', /di bawah (ambang )?70%/.test((await teks(p, 'kalimat-ringkasan')) ?? ''), await teks(p, 'kalimat-ringkasan'))

  await ke(p, '#/pengaturan', 2200)
  cek('B: kartu predikat ada', await ada(p, 'kartu-ambang-predikat'))
  cek('B: bawaan tertulis', (await teks(p, 'pratinjau-predikat')) === 'Baik ≥ 85% · Cukup 70–84% · Perlu perhatian < 70%', await teks(p, 'pratinjau-predikat'))

  // Mengosongkan kolom bukan berarti nol: pratinjau tetap bawaan.
  await ketik(p, 'predikat-cukup', '')
  cek('B: kolom dikosongkan ≠ 0', (await teks(p, 'pratinjau-predikat')) === 'Baik ≥ 85% · Cukup 70–84% · Perlu perhatian < 70%', await teks(p, 'pratinjau-predikat'))
  // Urutan terbalik: Baik 0, Cukup 100 → dirapikan menjadi 100/0. Cukup 0
  // berarti tidak ada yang "Perlu perhatian" — keterangannya tidak boleh
  // menulis "< 0%".
  await ketik(p, 'predikat-baik', 0)
  await ketik(p, 'predikat-cukup', 100)
  const T = 'Baik ≥ 100% · Cukup 0–99%'
  cek('B: terbalik → pratinjau dirapikan', (await teks(p, 'pratinjau-predikat')) === T, await teks(p, 'pratinjau-predikat'))
  cek('B: Simpan ditekan', await tombol(p, 'Simpan'))
  await wait(900)
  const st = await bacaPengaturan(p)
  cek('B: tersimpan rapi {baik:100, cukup:0}', st?.ambangPredikat?.baik === 100 && st?.ambangPredikat?.cukup === 0, JSON.stringify(st?.ambangPredikat))
  cek('B: kolom menampilkan hasil rapi 100/0 sesudah simpan', (await p.evaluate(() => [document.querySelector('[data-testid="predikat-baik"]').value, document.querySelector('[data-testid="predikat-cukup"]').value].join('/'))) === '100/0')

  // Rekap → info predikat + kartu + CSV.
  await ke(p, '#/absensi', 1600)
  await tombol(p, 'Rekap')
  await wait(1600)
  if (!(await ada(p, 'kartu-laporan-admin'))) {
    await p.evaluate(() => {
      const s = [...document.querySelectorAll('select')].find((x) => [...x.options].some((o) => o.value === 'all' && o.text === 'Semua periode'))
      if (!s) return
      const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set
      set.call(s, 'all')
      s.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await wait(1200)
  }
  cek('B: kartu laporan admin tampil', await ada(p, 'kartu-laporan-admin'))
  cek('J1a: ambang Rekap ikut Cukup tersimpan (0)', (await nilaiBatas()) === '0' && !(await ada(p, 'batas-beda-cukup')), await nilaiBatas())
  cek('B: info predikat di Rekap memakai ambang tim', (await teks(p, 'teks-predikat')) === T, await teks(p, 'teks-predikat'))
  cek('B: tanpa label "(bawaan)"', !/\(bawaan\)/.test((await teks(p, 'info-predikat')) ?? ''))

  await p.click('[data-testid="tombol-pratinjau-kartu"]')
  await wait(1500)
  const kartu = await p.evaluate(() => document.querySelector('[data-testid="bingkai-pratinjau"]')?.getAttribute('srcdoc') ?? '')
  cek('B: kartu memuat keterangan ambang tim', kartu.includes(`Predikat: ${T}</p>`))
  // Setiap kartu: predikat harus cocok dengan % kehadirannya.
  const pasangan = [...kartu.matchAll(/<td><b>(\d+)%<\/b><\/td><td>([^<]+)<\/td>/g)].map((m) => [Number(m[1]), m[2]])
  const harapTim = (r) => (r >= 100 ? 'Baik' : 'Cukup')
  const salah = pasangan.filter(([r, pr]) => pr !== harapTim(r) && pr !== 'Belum ada catatan')
  cek('B: kartu terbaca (≥ 10 anggota)', pasangan.length >= 10, String(pasangan.length))
  cek('B: tiap kartu: predikat cocok dengan % & ambang', salah.length === 0, JSON.stringify(salah.slice(0, 3)))
  // Bukti bahwa ambangnya benar-benar berpengaruh: sedikitnya satu anggota
  // mendapat predikat yang BERBEDA dari yang akan diberikan ambang bawaan.
  const bawaan = (r) => (r >= 85 ? 'Baik' : r >= 70 ? 'Cukup' : 'Perlu perhatian')
  const berubah = pasangan.filter(([r, pr]) => pr !== 'Belum ada catatan' && pr !== bawaan(r))
  cek('B: ambang tim mengubah predikat sedikitnya satu anggota', berubah.length > 0,
    JSON.stringify(pasangan.map(([r]) => r)))
  await tombol(p, 'Tutup')
  await wait(500)

  for (const f of fs.readdirSync(UNDUH)) fs.rmSync(path.join(UNDUH, f))
  await p.click('[data-testid="tombol-csv-ringkas"]')
  let csv = ''
  for (let i = 0; i < 30 && !csv; i++) {
    await wait(200)
    const f = fs.readdirSync(UNDUH).find((x) => x.endsWith('.csv'))
    if (f) csv = fs.readFileSync(path.join(UNDUH, f), 'utf8')
  }
  cek('B: CSV ringkas terunduh', csv.length > 0)
  if (csv) {
    const baris = csv.replace(/^\uFEFF/, '').trim().split(/\r?\n/).map((l) => l.split(/[;,](?=(?:[^"]*"[^"]*")*[^"]*$)/).map((x) => x.replace(/^"|"$/g, '')))
    const iPr = baris[0].indexOf('Predikat')
    const iPct = baris[0].indexOf('% Kehadiran')
    const iTotal = baris[0].indexOf('Total sesi')
    const salahCsv = baris.slice(1).filter((r) => {
      if (Number(r[iTotal]) === 0) return r[iPr] !== 'Belum ada catatan'
      const v = parseInt(r[iPct], 10)
      return r[iPr] !== (v >= 100 ? 'Baik' : 'Cukup')
    })
    cek('B: CSV: kolom Predikat & % ada', iPr > 0 && iPct > 0, baris[0].join('|'))
    cek('B: CSV: tiap baris memakai ambang tim', salahCsv.length === 0, JSON.stringify(salahCsv.slice(0, 2)))
    cek('B: CSV: tidak ada "Perlu perhatian" (Cukup 0%)', !csv.includes('Perlu perhatian'))
  }

  // Kembalikan ke bawaan.
  await p.click('[data-testid="ubah-predikat"]')
  await wait(1800)
  cek('B: tautan "Ubah di Pengaturan" membuka Pengaturan', await ada(p, 'kartu-ambang-predikat'))
  await p.click('[data-testid="predikat-kembali-bawaan"]')
  await wait(300)
  cek('B: bawaan → kolom kembali 85/70', (await p.evaluate(() => [document.querySelector('[data-testid="predikat-baik"]').value, document.querySelector('[data-testid="predikat-cukup"]').value].join('/'))) === '85/70')
  await tombol(p, 'Simpan')
  await wait(900)
  const st2 = await bacaPengaturan(p)
  cek('B: bawaan tersimpan (kolom dihapus)', st2 && st2.ambangPredikat === undefined, JSON.stringify(st2?.ambangPredikat))
  await b.close()
}

/* ========================================================================== */
/*  C. Panduan anggota                                                        */
/* ========================================================================== */
{
  const { b, p } = await luncur()
  const cdp = await p.target().createCDPSession()
  await cdp.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: UNDUH })
  await p.evaluate(() => [...document.querySelectorAll('button')].find((y) => y.textContent.includes('Muat data contoh'))?.click())
  await wait(3600)
  const alamat = await p.evaluate(() => location.origin + location.pathname)

  const isiBingkai = () =>
    p.evaluate(() => {
      const f = document.querySelector('[data-testid="bingkai-panduan"]')
      return f ? { jenis: f.getAttribute('data-jenis'), html: f.getAttribute('srcdoc') ?? '' } : null
    })

  // Dari menu Berbagi.
  await ke(p, '#/berbagi', 2000)
  cek('C: kotak panduan di Berbagi', await ada(p, 'kotak-panduan-anggota'))
  await p.click('[data-testid="tombol-panduan-anggota-berbagi"]')
  await wait(1500)
  const dariBerbagi = await isiBingkai()
  cek('C: Berbagi → versi anggota', dariBerbagi?.jenis === 'anggota', dariBerbagi?.jenis)
  const html = dariBerbagi?.html ?? ''
  cek('C: judul Panduan Anggota', html.includes('Panduan Anggota DrillKit'))
  cek('C: alamat situs ini tercetak (tanpa #/berbagi)', html.includes(alamat) && !html.includes('#/berbagi'), alamat)
  cek('C: kode QR tercetak', /<img src="data:image\/png;base64,[A-Za-z0-9+/=]{200,}" alt="Kode QR/.test(html))
  cek('C: nama tim dari pengaturan', html.includes('Marching Band Saya'))
  cek('C: tidak ada shortcut editor', !html.includes('Shortcut') && !html.includes('Ctrl + Z'))
  cek('C: tidak ada oklch/color-mix', !/oklch\(|color-mix\(/.test(html))
  cek('C: satu halaman A4', (await halamanA4(b, html)) === 1)
  // Pratinjau berjalan di localhost → pelatih harus diperingatkan bahwa QR-nya tidak terbuka di HP lain.
  cek('C: peringatan alamat lokal (localhost) tampil', !/^https?:\/\/(localhost|127\.)/.test(alamat) || (await ada(p, 'peringatan-alamat-lokal-berbagi')))
  await tombol(p, 'Tutup')
  await wait(500)

  // Dari Pengaturan: dua versi tidak tertukar.
  await ke(p, '#/pengaturan', 2000)
  cek('C: bagian versi anggota di kartu panduan', await ada(p, 'bagian-panduan-anggota'))
  await p.click('[data-testid="tombol-pratinjau-panduan-anggota"]')
  await wait(1500)
  const dariSetelan = await isiBingkai()
  cek('C: Pengaturan → versi anggota', dariSetelan?.jenis === 'anggota' && dariSetelan.html.includes('Panduan Anggota DrillKit'))
  await tombol(p, 'Tutup')
  await wait(500)
  await p.click('[data-testid="tombol-pratinjau-panduan"]')
  await wait(1500)
  const pelatih = await isiBingkai()
  cek('C: tombol lama tetap versi pelatih', pelatih?.jenis === 'pelatih' && pelatih.html.includes('Panduan Singkat DrillKit') && !pelatih.html.includes('Panduan Anggota'))
  cek('C: panduan pelatih masih satu halaman', (await halamanA4(b, pelatih?.html ?? '')) === 1)
  await tombol(p, 'Tutup')
  await wait(500)

  // Unduhan bernama sendiri, tidak menimpa panduan pelatih.
  for (const f of fs.readdirSync(UNDUH)) fs.rmSync(path.join(UNDUH, f))
  await p.click('[data-testid="tombol-unduh-panduan-anggota"]')
  let nama = ''
  for (let i = 0; i < 30 && !nama; i++) {
    await wait(200)
    nama = fs.readdirSync(UNDUH).find((x) => x.endsWith('.html')) ?? ''
  }
  cek('C: unduhan "panduan-anggota-drillkit.html"', nama === 'panduan-anggota-drillkit.html', nama)

  // Kasus terberat: nama tim panjang, logo, alamat panjang, versi situs & berkas.
  const logo = 'data:image/png;base64,' + fs.readFileSync(path.join(QA, '..', 'public', fs.readdirSync(path.join(QA, '..', 'public')).find((f) => f.endsWith('.png')) ?? '')).toString('base64')
  const berat = {
    namaTim: 'Marching Band Garuda Nusantara Sejahtera Yogyakarta Raya',
    kota: 'Yogyakarta',
    pelatih: 'Bapak Pelatih Dengan Nama Yang Sangat Panjang Sekali',
    logo,
    sesiMendatang: 42,
    drill: 12,
    lagu: 30,
  }
  const qr = dariBerbagi?.html.match(/src="(data:image\/png;base64,[^"]+)"/)?.[1]
  cek('C: terberat (situs + QR + logo) satu halaman',
    (await halamanA4(b, htmlPanduanAnggota({ ...berat, alamat: 'https://drillkit-garuda-nusantara-yogyakarta.netlify.app/latihan/aplikasi/', qr }))) === 1)
  cek('C: terberat (berkas portabel) satu halaman', (await halamanA4(b, htmlPanduanAnggota(berat))) === 1)
  // Penghitung halaman sendiri harus bisa berkata "2" — kalau tidak, cek di atas tidak berarti.
  cek('C: penghitung halaman bisa melihat 2 halaman', (await halamanA4(b, '<div style="height:200mm"></div><div style="height:200mm"></div>')) === 2)
  await b.close()
}

/* ========================================================================== */
/*  D. Lebar HP 360px                                                         */
/* ========================================================================== */
{
  const { b, p } = await luncur()
  await p.setViewport({ width: 360, height: 780, isMobile: true, hasTouch: true })
  const luber = () => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  await ke(p, '#/musik', 2200)
  cek('D: Musik 360px tidak meluber (kotak Instrumen)', (await luber()) <= 0, String(await luber()))
  const lebarSelect = await p.evaluate(() => document.querySelector('[data-testid="pilih-transposisi"]')?.getBoundingClientRect().right ?? 999)
  cek('D: kotak Instrumen di dalam layar', lebarSelect <= 360, String(lebarSelect))
  await ke(p, '#/berbagi', 2000)
  cek('D: Berbagi 360px tidak meluber', (await luber()) <= 0, String(await luber()))
  await ke(p, '#/pengaturan', 2000)
  cek('D: Pengaturan 360px tidak meluber', (await luber()) <= 0, String(await luber()))
  await b.close()
}

cek('tanpa error halaman', errors.length === 0, errors.slice(0, 3).join(' | '))
fs.rmSync(UNDUH, { recursive: true, force: true })
for (const g of gagal) console.log('  ✗ ' + g)
console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
process.exit(gagal.length ? 1 : 0)
