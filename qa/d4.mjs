// D4 — Paket laporan admin (dev 5173)
import puppeteer from 'puppeteer'
import fs from 'node:fs'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const R = {}
const DL = '/home/user/drillkit/qa/dld4'; fs.rmSync(DL, { recursive: true, force: true }); fs.mkdirSync(DL, { recursive: true })

const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--mute-audio'] })
const p = await b.newPage(); await p.setViewport({ width: 1400, height: 950 })
const errs = []
p.on('pageerror', (e) => errs.push(e.message.slice(0, 160)))
p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)) })
const cdp = await p.target().createCDPSession()
await cdp.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: DL })

await p.goto('http://localhost:5173/', { waitUntil: 'networkidle2' }); await wait(2200)
await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((y) => y.textContent.includes('Muat data contoh')); x && x.click() })
await wait(3200)

const keRekap = async () => {
  await p.evaluate(() => { location.hash = '#/absensi' }); await wait(1200)
  await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((y) => y.textContent.trim() === 'Rekap'); x && x.click() })
  await wait(1200)
}
await keRekap()

/* -------------------- A. Kartu paket laporan -------------------- */
R.kartuAda = await p.evaluate(() => !!document.querySelector('[data-testid="kartu-laporan-admin"]'))
R.kalimat = await p.evaluate(() => document.querySelector('[data-testid="kalimat-ringkasan"]')?.innerText.trim() ?? '')
R.periodeBadge = await p.evaluate(() => document.querySelector('[data-testid="kartu-laporan-admin"]')?.innerText.split('\n')[1] ?? '')

/* -------------------- B. Laporan bulanan -------------------- */
const bukaJendela = async (testid) => {
  const sebelum = (await b.pages()).length
  await p.click(`[data-testid="${testid}"]`)
  let halaman = null
  for (let i = 0; i < 40 && !halaman; i++) {
    await wait(250)
    const semua = await b.pages()
    if (semua.length > sebelum) halaman = semua[semua.length - 1]
  }
  if (!halaman) return null
  await wait(700)
  const html = await halaman.content()
  await halaman.close()
  return html
}

const hitung = (html, needle) => html.split(needle).length - 1

const hLaporan = await bukaJendela('tombol-laporan-bulanan')
R.laporan = hLaporan
  ? {
      judul: /<h1 class="judul">Laporan Kehadiran<\/h1>/.test(hLaporan),
      namaTim: hLaporan.includes('Marching Band Saya'),
      periode: (hLaporan.match(/Periode ([^<·]+)/) ?? [])[1]?.trim() ?? '',
      tabel: hitung(hLaporan, '<table'),
      tandaTangan: hLaporan.includes('Pelatih') && hLaporan.includes('Pembina / Ketua Tim'),
      ringkasan: hLaporan.includes('class="ringkas"'),
      perSection: hLaporan.includes('Rekap per section'),
      perJenis: hLaporan.includes('Kehadiran per jenis kegiatan'),
      perAnggota: hLaporan.includes('Rekap per anggota'),
      rincianSesi: hLaporan.includes('Rincian per sesi'),
      oklch: /oklch\(|lab\(|color-mix\(/.test(hLaporan),
    }
  : null

/* -------------------- C. Kartu per anggota -------------------- */
const opsi = await p.evaluate(() => {
  const s = document.querySelector('[data-testid="pilih-anggota-kartu"]')
  return { jumlah: s.options.length, satu: s.options[1]?.value ?? '', nama: s.options[1]?.textContent ?? '' }
})
R.opsiAnggota = opsi
await p.select('[data-testid="pilih-anggota-kartu"]', opsi.satu); await wait(400)
const hKartuSatu = await bukaJendela('tombol-kartu-anggota')
R.kartuSatu = hKartuSatu
  ? {
      jumlahKartu: hitung(hKartuSatu, 'class="kartu"'),
      namaAnggota: hKartuSatu.includes(opsi.nama),
      identitas: hKartuSatu.includes('Section') && hKartuSatu.includes('Instrumen'),
      paraf: hKartuSatu.includes('Paraf anggota'),
      predikat: /Baik|Cukup|Perlu perhatian|Belum ada catatan/.test(hKartuSatu),
      status: hKartuSatu.includes('>H<') || hKartuSatu.includes('>I<') || hKartuSatu.includes('>S<') || hKartuSatu.includes('>A<'),
    }
  : null

await p.select('[data-testid="pilih-anggota-kartu"]', ''); await wait(400)
const hKartuSemua = await bukaJendela('tombol-kartu-anggota')
R.kartuSemua = hKartuSemua ? { jumlahKartu: hitung(hKartuSemua, 'class="kartu"') } : null

/* -------------------- D. Paket lengkap -------------------- */
const hPaket = await bukaJendela('tombol-paket-lengkap')
R.paket = hPaket
  ? {
      adaLaporan: hPaket.includes('<h1 class="judul">Laporan Kehadiran</h1>'),
      adaKartu: hPaket.includes('class="kartu"'),
      jumlahKartu: hitung(hPaket, 'class="kartu"'),
      pagebreak: hPaket.includes('pagebreak'),
    }
  : null

/* -------------------- E. CSV -------------------- */
await p.click('[data-testid="tombol-csv-matriks"]'); await wait(1200)
await p.click('[data-testid="tombol-csv-ringkas"]'); await wait(1200)
const fileCsv = fs.readdirSync(DL).filter((f) => f.endsWith('.csv'))
R.berkasCsv = fileCsv
for (const f of fileCsv) {
  const isi = fs.readFileSync(`${DL}/${f}`, 'utf8')
  const baris = isi.replace(/^﻿/, '').split('\r\n').filter((x) => x.length)
  R[f] = {
    bom: isi.charCodeAt(0) === 0xfeff,
    baris: baris.length,
    kolom: (baris[0].match(/,/g) ?? []).length + 1,
    header: baris[0].slice(0, 90),
    contohBaris2: baris[1]?.slice(0, 110) ?? '',
  }
}

/* -------------------- F. Periode tertentu ikut tercetak -------------------- */
const bulan = await p.evaluate(() => {
  const s = [...document.querySelectorAll('select')].find((x) => [...x.options].some((o) => o.textContent.includes('Semua periode')))
  if (!s) return null
  const o = [...s.options].find((x) => x.value !== 'all')
  if (!o) return null
  s.value = o.value
  s.dispatchEvent(new Event('change', { bubbles: true }))
  return { nilai: o.value, label: o.textContent.trim() }
})
await wait(1200)
R.pilihBulan = bulan
R.badanPeriode = await p.evaluate(() => document.querySelector('[data-testid="kartu-laporan-admin"]')?.innerText.split('\n')[1] ?? '')
const hLaporanBulan = await bukaJendela('tombol-laporan-bulanan')
R.laporanBulan = hLaporanBulan
  ? {
      periode: (hLaporanBulan.match(/Periode ([^<·]+)/) ?? [])[1]?.trim() ?? '',
      sesuai: hLaporanBulan.includes(bulan.label),
    }
  : null

/* --------- G. Jalan keluar saat jendela cetak diblokir --------- */
await p.evaluate(() => { window.open = () => null })
await p.click('[data-testid="tombol-laporan-bulanan"]'); await wait(1500)
const htmlFallback = fs.readdirSync(DL).filter((f) => f.endsWith('.html'))
R.fallback = {
  berkas: htmlFallback,
  toast: await p.evaluate(() => document.body.innerText.match(/Jendela cetak diblokir[^\n]*/)?.[0] ?? ''),
}
R.fallbackIsi = htmlFallback[0]
  ? fs.readFileSync(`${DL}/${htmlFallback[0]}`, 'utf8').includes('<h1 class="judul">Laporan Kehadiran</h1>')
  : false
await p.reload({ waitUntil: 'networkidle2' }); await wait(2000)
await keRekap()

/* -------------------- H. HP 390 px -------------------- */
await p.setViewport({ width: 390, height: 844 }); await wait(1200)
R.hp = await p.evaluate(() => {
  const k = document.querySelector('[data-testid="kartu-laporan-admin"]')
  if (!k) return { ada: false }
  const r = k.getBoundingClientRect()
  return {
    ada: true,
    lebar: Math.round(r.width),
    meluber: r.right > window.innerWidth + 1 || document.documentElement.scrollWidth > window.innerWidth + 1,
    tinggiTombol: [...k.querySelectorAll('button')].map((b) => Math.round(b.getBoundingClientRect().height)).slice(0, 5),
  }
})

R.error = errs
console.log(JSON.stringify(R, null, 2))
await b.close()
