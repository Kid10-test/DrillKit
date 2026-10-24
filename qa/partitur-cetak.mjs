/**
 * #11c — Filter Partitur per Instrumen / Section, Pencocokan Otomatis Anggota,
 * dan Cetak / Unduh HTML Mandiri Berpalet Hex Murni
 * (uji peramban ujung-ke-ujung, §7.2 & §10 `RANCANGAN-11c-PARTITUR-PART-CETAK.md`).
 *
 * Logika murni kamus instrumen, pengelompokan `SectionDef`, dan penyusun HTML
 * cetak sudah diuji di `partitur-bagian-logika.mjs` (87 asersi). Rangkaian ini
 * membuktikan alur penuh di Chromium tanpa jalan buntu:
 *
 *   1. Penyaringan tampilan partitur (skor marching band 6 part lintas 4 seksi:
 *      Trumpet 1, Trumpet 2, Mellophone, Clarinet in Bb, Snare Drum, Marimba —
 *      12 birama, dengan Marimba memiliki 4 birama istirahat beruntun m.5–8):
 *      - Bawaan `Full score (6)` merender keenam part.
 *      - Chip `Woodwind (1)` tetap muncul walau seksi Woodwind disembunyikan di
 *        pengaturan bawaan tim (keputusan D3).
 *      - Klik chip `Brass (3)` → `partitur-info-sesi` menjadi `3/6 part · Brass`,
 *        SVG memuat label Brass dan TIDAK memuat `Snare Drum` / `Marimba`.
 *      - Pilih 1 part spesifik (`P6` = `Marimba`) lewat `partitur-pilih-part` →
 *        `1/6 part · Marimba`, label kiri berulang dimatikan untuk lebar penuh,
 *        istirahat 4 birama beruntun digabung otomatis menjadi multi-istirahat,
 *        dan pilihan bertahan di `localStorage` sesudah `page.reload()`.
 *   2. Pratinjau Cetak & Unduh HTML mandiri murni hex (`modal-cetak-partitur`):
 *      - Saat `Full score` (6 part >= 4), klik `partitur-cetak-buka` memilih
 *        kertas bawaan `A4_L` (*A4 Mendatar*).
 *      - Saat 1 part (`Trumpet 1`), kertas bawaan otomatis `A4_P` (*A4 Tegak*)
 *        dan `cetak-partitur-bagian` mengikuti `part:P1`.
 *      - Ganti kertas ke `A5_L` (*Buku Saku / Lyre*) & skala `besar` → halaman
 *        `<svg>` terpaginasi ulang di `<iframe srcDoc>`, setiap `<svg>` punya
 *        `viewBox`, `@page` memakai `210mm 148mm`, dan `0` `oklch()`/`color-mix()`.
 *      - Klik `tombol-unduh-html-partitur` → berkas `.html` mandiri terunduh ke
 *        disk dengan tombol `.no-print`, `<svg viewBox>`, dan `0` `oklch`/`color-mix`.
 *      - Simulasi `window.open` diblokir → klik `tombol-cetak-partitur` tidak
 *        buntu melainkan otomatis mengunduh berkas `.html` disertai petunjuk.
 *   3. Kunci Kios (`html[data-kiosk="1"]`):
 *      - Seluruh tombol/pemilih filter & modal cetak tetap interaktif (`pointer-events: auto`).
 *   4. Mode Anggota (`Share.tsx` → tab `musik`, keputusan D4):
 *      - Tanpa memilih nama (`me === null`), tab Musik & buka partitur tetap
 *        berjalan pada `Full score (6)` tanpa rintangan.
 *      - Memilih `Andra Pratama` (*Trumpet*) otomatis menyaring 2 part Trumpet
 *        dengan lencana `partitur-info-anggota`; pindah manual ke `Full score`
 *        memunculkan tombol `partitur-ke-part-saya` untuk kembali 1 klik.
 *      - Berganti ke `Citra Dewi` (*Trombone*, tidak ada di skor) otomatis
 *        jatuh ke kelompok seksi `Brass (3)`.
 *      - Berganti ke `Putri Ramadhani` (*Color Guard*) tetap menampilkan
 *        `Full score (6)` disertai keterangan ramah tanpa kanvas kosong.
 *   5. Konsol peramban bersih (`0` error) dan `0` permintaan jaringan eksternal.
 *
 * Pakai: bash qa/bangun-logika.sh && BASE=http://localhost:4173 node qa/partitur-cetak.mjs
 */
import puppeteer from 'puppeteer'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { lewatSambutan } from './sambutan.mjs'

const BASE = process.env.BASE || process.argv[2] || 'http://localhost:4173'
const ORIGIN_LOKAL = new URL(BASE).origin
const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'dk-partitur-cetak-'))
const BERKAS = path.join(TMP_ROOT, 'berkas')
const UNDUH = path.join(TMP_ROOT, 'unduh')
fs.mkdirSync(BERKAS, { recursive: true })
fs.mkdirSync(UNDUH, { recursive: true })

let lulus = 0
const gagal = []
const cek = (nama, syarat, keterangan = '') => {
  if (syarat) {
    lulus += 1
  } else {
    const baris = `${nama}${keterangan ? ' — ' + keterangan : ''}`
    gagal.push(baris)
    console.log('  ✗ ' + baris)
  }
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

function adalahUrlLokalAtauInternalPeramban(url) {
  if (url.startsWith(ORIGIN_LOKAL)) return true
  return /^(blob:|data:|about:|chrome:|chrome-extension:|devtools:)/i.test(url)
}

/* ---------------- Fixture skor marching band 6 part (12 birama) ---------- */

function bangunPartNada(id, jumlahBirama, oktafDasar = 4, istirahatRentang = null) {
  const tangga = ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C']
  const birama = []
  for (let no = 1; no <= jumlahBirama; no += 1) {
    const atribut =
      no === 1
        ? '<attributes><divisions>1</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>'
        : ''
    const arah =
      no === 1 && id === 'P1'
        ? '<direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>136</per-minute></metronome></direction-type><sound tempo="136"/></direction>'
        : ''

    if (istirahatRentang && no >= istirahatRentang[0] && no <= istirahatRentang[1]) {
      birama.push(
        `<measure number="${no}">${atribut}${arah}<note><rest measure="yes"/><duration>4</duration><type>whole</type></note></measure>`,
      )
      continue
    }

    const notasi = []
    for (let k = 0; k < 4; k += 1) {
      const step = tangga[(no + k) % tangga.length]
      const oktaf = step === 'C' && (no + k) % tangga.length === 7 ? oktafDasar + 1 : oktafDasar
      notasi.push(
        `<note><pitch><step>${step}</step><octave>${oktaf}</octave></pitch><duration>1</duration><type>quarter</type></note>`,
      )
    }
    birama.push(`<measure number="${no}">${atribut}${arah}${notasi.join('')}</measure>`)
  }
  return `<part id="${id}">${birama.join('')}</part>`
}

function bangunPartPerkusi(id, jumlahBirama) {
  const birama = []
  for (let no = 1; no <= jumlahBirama; no += 1) {
    const atribut =
      no === 1
        ? '<attributes><divisions>1</divisions><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>percussion</sign></clef></attributes>'
        : ''
    const notasi = Array.from(
      { length: 4 },
      () =>
        '<note><unpitched><display-step>C</display-step><display-octave>5</display-octave></unpitched><duration>1</duration><type>quarter</type></note>',
    ).join('')
    birama.push(`<measure number="${no}">${atribut}${notasi}</measure>`)
  }
  return `<part id="${id}">${birama.join('')}</part>`
}

const XML_SKOR_6_PART = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <work><work-title>Gita Nusantara Opener</work-title></work>
  <identification>
    <creator type="composer">R. Wirawan</creator>
  </identification>
  <part-list>
    <score-part id="P1">
      <part-name>Trumpet in Bb 1</part-name>
      <part-abbreviation>Tpt. 1</part-abbreviation>
    </score-part>
    <score-part id="P2">
      <part-name>Trumpet in Bb 2</part-name>
      <part-abbreviation>Tpt. 2</part-abbreviation>
    </score-part>
    <score-part id="P3">
      <part-name>Mellophone</part-name>
      <part-abbreviation>Mello.</part-abbreviation>
    </score-part>
    <score-part id="P4">
      <part-name>Clarinet in Bb</part-name>
      <part-abbreviation>Cl.</part-abbreviation>
    </score-part>
    <score-part id="P5">
      <part-name>Snare Drum</part-name>
      <part-abbreviation>S.D.</part-abbreviation>
    </score-part>
    <score-part id="P6">
      <part-name>Marimba</part-name>
      <part-abbreviation>Mrb.</part-abbreviation>
    </score-part>
  </part-list>
  ${bangunPartNada('P1', 12, 5)}
  ${bangunPartNada('P2', 12, 4)}
  ${bangunPartNada('P3', 12, 4)}
  ${bangunPartNada('P4', 12, 5)}
  ${bangunPartPerkusi('P5', 12)}
  ${bangunPartNada('P6', 12, 4, [5, 8])}
</score-partwise>`

const jalurSkor6Part = path.join(BERKAS, 'gita-nusantara-opener.musicxml')
fs.writeFileSync(jalurSkor6Part, XML_SKOR_6_PART)

const XML_SKOR_SOLO = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <work><work-title>Solo Fanfare</work-title></work>
  <part-list>
    <score-part id="SOLO1">
      <part-name>Trumpet Solo</part-name>
    </score-part>
  </part-list>
  ${bangunPartNada('SOLO1', 4, 5)}
</score-partwise>`
const jalurSkorSolo = path.join(BERKAS, 'solo-fanfare.musicxml')
fs.writeFileSync(jalurSkorSolo, XML_SKOR_SOLO)

const jalurPdfMinimal = path.join(BERKAS, 'lembar-tetap.pdf')
fs.writeFileSync(
  jalurPdfMinimal,
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 595 842]/Parent 2 0 R>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n',
)

/* --------------------------- Pembantu Puppeteer -------------------------- */

const ke = async (hal, hash) => {
  await hal.evaluate((h) => {
    location.hash = h
  }, hash)
  await wait(800)
}

const ada = (hal, sel) => hal.evaluate((s) => !!document.querySelector(s), sel)
const teks = (hal, sel) =>
  hal.evaluate((s) => document.querySelector(s)?.textContent?.trim() ?? '', sel)

const klik = async (hal, sel) => {
  await hal.waitForSelector(sel, { timeout: 10000 })
  await hal.evaluate((s) => {
    const el = document.querySelector(s)
    if (el) el.click()
  }, sel)
  await wait(250)
}

const pilihSelect = async (hal, sel, nilai) => {
  await hal.waitForSelector(sel, { timeout: 10000 })
  await hal.select(sel, nilai)
  await wait(300)
}

const unggah = async (hal, sel, jalurBerkas) => {
  const input = await hal.waitForSelector(sel, { timeout: 10000 })
  await input.uploadFile(jalurBerkas)
  await wait(500)
}

const tungguRenderSelesai = async (hal) => {
  await hal.waitForFunction(
    () =>
      !document.querySelector('[data-testid="partitur-progres"]') &&
      document.querySelectorAll('[data-testid="partitur-kanvas-svg"] svg').length > 0 &&
      !!document.querySelector('[data-testid="partitur-info-sesi"]'),
    { timeout: 25000 },
  )
}

const tungguCetakSiap = async (hal) => {
  await hal.waitForFunction(
    () => {
      const bingkai = document.querySelector('[data-testid="bingkai-cetak-partitur"]')
      const infoHal =
        document.querySelector('[data-testid="cetak-partitur-halaman"]')?.textContent ?? ''
      return !!bingkai && bingkai.getAttribute('srcdoc')?.includes('<svg') && /halaman/i.test(infoHal) && !/Menyusun/i.test(infoHal)
    },
    { timeout: 25000 },
  )
}

const kosongkanUnduh = () => {
  for (const f of fs.readdirSync(UNDUH)) {
    fs.rmSync(path.join(UNDUH, f), { recursive: true, force: true })
  }
}

const tungguUnduh = async (pola) => {
  for (let i = 0; i < 60; i += 1) {
    await wait(200)
    const daftar = fs.readdirSync(UNDUH).filter((f) => !f.endsWith('.crdownload'))
    const cocok = daftar.find((f) => pola.test(f))
    if (cocok) return path.join(UNDUH, cocok)
  }
  return null
}

const bacaTabel = (hal, namaTabel) =>
  hal.evaluate(
    (t) =>
      new Promise((selesai, tolak) => {
        const req = indexedDB.open('drillkit')
        req.onerror = () => tolak(String(req.error))
        req.onsuccess = () => {
          const db = req.result
          const tx = db.transaction(t, 'readonly')
          const q = tx.objectStore(t).getAll()
          q.onsuccess = () => {
            db.close()
            selesai(q.result)
          }
          q.onerror = () => {
            db.close()
            tolak(String(q.error))
          }
        }
      }),
    namaTabel,
  )

/* =========================== Mulai peramban ============================== */

const browser = await puppeteer.launch({
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  defaultViewport: { width: 1360, height: 1000 },
  env: { ...process.env, LANG: process.env.LANG || 'C.utf8' },
})

let ctxAnggota = null

try {
  const p = await browser.newPage()
  const errors = []
  const permintaanLuar = []

  const pasangPemantau = (halaman) => {
    halaman.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text())
    })
    halaman.on('pageerror', (e) => errors.push(String(e)))
    halaman.on('request', (req) => {
      const u = req.url()
      if (!adalahUrlLokalAtauInternalPeramban(u)) {
        permintaanLuar.push(u)
      }
    })
  }
  pasangPemantau(p)

  const cdp = await p.createCDPSession()
  await cdp.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: UNDUH })

  /* --------- 1. Pelatih: muat data contoh & pasang skor 6 part ----------- */

  await p.goto(BASE, { waitUntil: 'networkidle2' })
  await lewatSambutan(p)
  await wait(900)

  await p.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) =>
      x.textContent.includes('Muat data contoh'),
    )
    if (b) b.click()
  })
  await wait(3000)

  const daftarLagu = await bacaTabel(p, 'songs')
  cek('data contoh menyediakan lagu untuk diuji', daftarLagu.length >= 1)
  const laguUji = daftarLagu[0]

  await ke(p, '#/musik')
  await klik(p, `[data-testid="pilih-lagu-${laguUji.id}"]`)
  await p.waitForSelector('[data-testid="panel-partitur"]', { timeout: 10000 })

  await unggah(p, '#partitur-input', jalurSkor6Part)
  await p.waitForSelector('[data-testid="partitur-simpan"]', { timeout: 10000 })
  await klik(p, '[data-testid="partitur-simpan"]')
  await p.waitForSelector('[data-testid="partitur-buka"]', { timeout: 10000 })

  /* --- 2. Penyaringan Full score, kelompok seksi, & part individu -------- */

  await klik(p, '[data-testid="partitur-buka"]')
  await p.waitForSelector('[data-testid="layar-partitur"]', { timeout: 10000 })
  await tungguRenderSelesai(p)

  const infoAwal = await teks(p, '[data-testid="partitur-info-sesi"]')
  cek(
    'bawaan pelatih merender Full score 6 part (12 birama)',
    infoAwal.includes('12 birama') &&
      infoAwal.includes('6 part terender') &&
      infoAwal.includes('Full score'),
    infoAwal,
  )
  cek(
    'bilah filter menampilkan Full score (6) beserta 4 chip kelompok seksi',
    (await ada(p, '[data-testid="partitur-filter-bar"]')) &&
      (await teks(p, '[data-testid="partitur-filter-semua"]')).includes('Full score (6)') &&
      (await teks(p, '[data-testid="partitur-filter-kelompok-brass"]')).includes('Brass (3)') &&
      (await teks(p, '[data-testid="partitur-filter-kelompok-percussion"]')).includes('Battery (1)') &&
      (await teks(p, '[data-testid="partitur-filter-kelompok-pit"]')).includes('Pit (1)'),
  )
  cek(
    'chip Woodwind (1) tetap tampil walau Woodwind tersembunyi di pengaturan bawaan (D3)',
    (await teks(p, '[data-testid="partitur-filter-kelompok-woodwind"]')).includes('Woodwind (1)'),
  )
  cek(
    'lencana info anggota TIDAK muncul di mode pelatih',
    !(await ada(p, '[data-testid="partitur-info-anggota"]')),
  )

  // Saring ke kelompok Brass (3 part)
  await klik(p, '[data-testid="partitur-filter-kelompok-brass"]')
  await tungguRenderSelesai(p)

  const cekBrass = await p.evaluate(() => {
    const kanvas = document.querySelector('[data-testid="partitur-kanvas-svg"]')
    const teksSvg = kanvas?.textContent ?? ''
    const htmlLayar = document.querySelector('[data-testid="layar-partitur"]')?.outerHTML ?? ''
    return {
      info: document.querySelector('[data-testid="partitur-info-sesi"]')?.textContent?.trim() ?? '',
      adaTrumpet: /Trumpet|Tpt/i.test(teksSvg),
      adaMello: /Mellophone|Mello/i.test(teksSvg),
      adaSnare: /Snare|S\.D\./i.test(teksSvg),
      adaMarimba: /Marimba|Mrb/i.test(teksSvg),
      adaOklchAtauMix: /oklch\(|color-mix\(/i.test(htmlLayar),
    }
  })

  cek(
    'klik chip Brass mengubah info sesi ke 3/6 part · Brass',
    cekBrass.info.includes('3/6 part · Brass'),
    cekBrass.info,
  )
  cek(
    'SVG kelompok Brass memuat Trumpet & Mellophone tanpa Snare Drum / Marimba',
    cekBrass.adaTrumpet && cekBrass.adaMello && !cekBrass.adaSnare && !cekBrass.adaMarimba,
    JSON.stringify(cekBrass),
  )
  cek(
    'LayarPartitur beserta bilah filter bebas dari oklch() dan color-mix()',
    cekBrass.adaOklchAtauMix === false,
  )

  // Pilih 1 part spesifik: P6 = Marimba (memiliki 4 birama istirahat beruntun m.5–8)
  await pilihSelect(p, '[data-testid="partitur-pilih-part"]', 'P6')
  await tungguRenderSelesai(p)

  const cekMarimba = await p.evaluate(() => {
    const kanvas = document.querySelector('[data-testid="partitur-kanvas-svg"]')
    const teksSvg = kanvas?.textContent ?? ''
    const grupBiramaVf = kanvas?.querySelectorAll('g.vf-measure').length ?? 0
    return {
      info: document.querySelector('[data-testid="partitur-info-sesi"]')?.textContent?.trim() ?? '',
      nilaiSelect: document.querySelector('[data-testid="partitur-pilih-part"]')?.value ?? '',
      adaLabelKiriPart: /Marimba|Mrb\./.test(teksSvg),
      grupBiramaVf,
      jumlahPath: kanvas?.querySelectorAll('svg path').length ?? 0,
    }
  })

  cek(
    'pilih Marimba mengubah info sesi ke 1/6 part · Marimba',
    cekMarimba.info.includes('1/6 part · Marimba'),
    cekMarimba.info,
  )
  cek(
    'mode 1 part mematikan label kiri berulang & meringkas 4 birama istirahat (12 -> 9 kotak birama)',
    cekMarimba.nilaiSelect === 'P6' &&
      cekMarimba.adaLabelKiriPart === false &&
      cekMarimba.grupBiramaVf === 9 &&
      cekMarimba.jumlahPath >= 20,
    JSON.stringify(cekMarimba),
  )

  // Muat ulang penuh untuk menguji ketahanan simpanan filter per lagu di localStorage
  await p.reload({ waitUntil: 'networkidle2' })
  await wait(1200)
  await klik(p, `[data-testid="pilih-lagu-${laguUji.id}"]`)
  await klik(p, '[data-testid="partitur-buka"]')
  await tungguRenderSelesai(p)

  const infoSesudahReload = await teks(p, '[data-testid="partitur-info-sesi"]')
  cek(
    'pilihan part Marimba bertahan di localStorage lintas reload halaman',
    infoSesudahReload.includes('1/6 part · Marimba'),
    infoSesudahReload,
  )

  /* --- 3. Pratinjau Cetak & Unduh HTML mandiri murni hex (D2 & D5) ------- */

  // Kembalikan dulu ke Full score (6 part) untuk menguji orientasi kertas otomatis A4_L
  await klik(p, '[data-testid="partitur-filter-semua"]')
  await tungguRenderSelesai(p)

  await klik(p, '[data-testid="partitur-cetak-buka"]')
  await p.waitForSelector('[data-testid="modal-cetak-partitur"]', { timeout: 10000 })
  await tungguCetakSiap(p)

  const cetakFull = await p.evaluate(() => {
    const bagian = document.querySelector('[data-testid="cetak-partitur-bagian"]')?.value ?? ''
    const kertas = document.querySelector('[data-testid="cetak-partitur-kertas"]')?.value ?? ''
    const infoHal =
      document.querySelector('[data-testid="cetak-partitur-halaman"]')?.textContent?.trim() ?? ''
    const srcDoc =
      document.querySelector('[data-testid="bingkai-cetak-partitur"]')?.getAttribute('srcdoc') ?? ''
    return {
      bagian,
      kertas,
      infoHal,
      adaPageA4L: srcDoc.includes('size: 297mm 210mm'),
      adaViewBox: /<svg\b[^>]*\bviewBox="/i.test(srcDoc),
      adaOklchAtauMix: /oklch\(|color-mix\(/i.test(srcDoc),
    }
  })

  cek(
    'saat Full score (6 part), modal cetak otomatis memilih A4 Mendatar (A4_L)',
    cetakFull.bagian === 'semua' &&
      cetakFull.kertas === 'A4_L' &&
      cetakFull.adaPageA4L &&
      cetakFull.infoHal.includes('A4 Mendatar'),
    JSON.stringify({ bagian: cetakFull.bagian, kertas: cetakFull.kertas, infoHal: cetakFull.infoHal }),
  )
  cek(
    'srcDoc cetak Full score memiliki viewBox SVG dan bebas oklch()/color-mix()',
    cetakFull.adaViewBox && !cetakFull.adaOklchAtauMix,
  )

  // Tutup modal, pilih 1 part (P1 = Trumpet in Bb 1), lalu buka lagi modal cetak
  await p.keyboard.press('Escape')
  await wait(300)
  cek(
    'Escape menutup modal cetak terlebih dahulu',
    !(await ada(p, '[data-testid="modal-cetak-partitur"]')),
  )

  await pilihSelect(p, '[data-testid="partitur-pilih-part"]', 'P1')
  await tungguRenderSelesai(p)
  await klik(p, '[data-testid="partitur-cetak-buka"]')
  await p.waitForSelector('[data-testid="modal-cetak-partitur"]', { timeout: 10000 })
  await tungguCetakSiap(p)

  const cetakSatuPart = await p.evaluate(() => ({
    bagian: document.querySelector('[data-testid="cetak-partitur-bagian"]')?.value ?? '',
    kertas: document.querySelector('[data-testid="cetak-partitur-kertas"]')?.value ?? '',
    infoHal:
      document.querySelector('[data-testid="cetak-partitur-halaman"]')?.textContent?.trim() ?? '',
  }))
  cek(
    'saat 1 part (Trumpet 1) aktif, modal cetak otomatis memilih part:P1 & A4 Tegak (A4_P)',
    cetakSatuPart.bagian === 'part:P1' &&
      cetakSatuPart.kertas === 'A4_P' &&
      cetakSatuPart.infoHal.includes('A4 Tegak'),
    JSON.stringify(cetakSatuPart),
  )

  // Ganti ke Buku Saku / Lyre (A5_L) & skala besar → verifikasi paginasi multi-halaman
  await pilihSelect(p, '[data-testid="cetak-partitur-kertas"]', 'A5_L')
  await pilihSelect(p, '[data-testid="cetak-partitur-skala"]', 'besar')
  await tungguCetakSiap(p)

  const cetakLyre = await p.evaluate(() => {
    const bingkai = document.querySelector('[data-testid="bingkai-cetak-partitur"]')
    const srcDoc = bingkai?.getAttribute('srcdoc') ?? ''
    const semuaTagSvg = srcDoc.match(/<svg\b[^>]*>/gi) ?? []
    const semuaPunyaViewBox =
      semuaTagSvg.length > 0 && semuaTagSvg.every((tag) => /\bviewBox="0 0 \d+/.test(tag))
    return {
      jumlahSvg: semuaTagSvg.length,
      semuaPunyaViewBox,
      adaPageA5L: srcDoc.includes('size: 210mm 148mm'),
      adaNoPrint: /\bno-print\b/.test(srcDoc),
      adaTrumpet1: srcDoc.includes('Trumpet in Bb 1'),
      adaOklchAtauMix: /oklch\(|color-mix\(/i.test(srcDoc),
      infoHal:
        document.querySelector('[data-testid="cetak-partitur-halaman"]')?.textContent?.trim() ?? '',
    }
  })

  cek(
    'ukuran Buku Saku / Lyre (A5_L) menyusun halaman SVG ber-@page 210mm 148mm',
    cetakLyre.jumlahSvg >= 1 &&
      cetakLyre.adaPageA5L &&
      cetakLyre.infoHal.includes('Buku Saku / Lyre'),
    `${cetakLyre.jumlahSvg} halaman, ${cetakLyre.infoHal}`,
  )
  cek(
    'setiap elemen <svg> di halaman cetak disuntik viewBox responsif & bebas oklch/color-mix',
    cetakLyre.semuaPunyaViewBox &&
      cetakLyre.adaNoPrint &&
      cetakLyre.adaTrumpet1 &&
      !cetakLyre.adaOklchAtauMix,
  )

  // Klik Unduh HTML → verifikasi berkas .html mandiri di disk
  kosongkanUnduh()
  await klik(p, '[data-testid="tombol-unduh-html-partitur"]')
  const jalurHtmlUnduh = await tungguUnduh(/^DrillKit - PARTITUR - .*\.html$/i)
  cek('tombol Unduh HTML mengunduh berkas bernama DrillKit - PARTITUR - ... .html', jalurHtmlUnduh !== null)
  if (jalurHtmlUnduh) {
    const isiHtml = fs.readFileSync(jalurHtmlUnduh, 'utf8')
    cek(
      'berkas HTML yang diunduh utuh mandiri (<!doctype html>, <svg viewBox>, .no-print, 0 oklch/color-mix)',
      isiHtml.startsWith('<!doctype html>') &&
        isiHtml.includes('<svg') &&
        isiHtml.includes('viewBox="0 0 ') &&
        isiHtml.includes('window.print()') &&
        isiHtml.includes('Gita Nusantara Opener') &&
        isiHtml.includes('Trumpet in Bb 1') &&
        !/oklch\(|color-mix\(/i.test(isiHtml),
    )
  }

  // Ganti bagian langsung di dalam modal cetak ke kelompok Brass tanpa menutup modal
  await pilihSelect(p, '[data-testid="cetak-partitur-bagian"]', 'kelompok:brass')
  await tungguCetakSiap(p)
  const srcDocKelompokBrass = await p.evaluate(
    () =>
      document.querySelector('[data-testid="bingkai-cetak-partitur"]')?.getAttribute('srcdoc') ??
      '',
  )
  cek(
    'mengganti bagian di dalam modal cetak langsung merender ulang kop Brass (3 part)',
    srcDocKelompokBrass.includes('Brass (3 part)') && srcDocKelompokBrass.includes('<svg'),
  )
  await pilihSelect(p, '[data-testid="cetak-partitur-bagian"]', 'part:P1')
  await tungguCetakSiap(p)

  // Jalur window.open diizinkan: dokumen cetak menerima HTML mandiri utuh
  const hasilWindowOpen = await p.evaluate(() => {
    let htmlTertulis = ''
    let diprint = false
    const asli = window.open
    window.open = () => ({
      document: {
        open() {},
        write(s) {
          htmlTertulis += s
        },
        close() {},
      },
      focus() {},
      print() {
        diprint = true
      },
    })
    try {
      document.querySelector('[data-testid="tombol-cetak-partitur"]')?.click()
    } finally {
      window.open = asli
    }
    return {
      panjang: htmlTertulis.length,
      adaSvg: htmlTertulis.includes('<svg'),
      bebasOklch: !/oklch\(|color-mix\(/i.test(htmlTertulis),
      diprint,
    }
  })
  await wait(350)
  cek(
    'saat window.open diizinkan, jendela cetak menerima dokumen HTML murni hex ber-<svg>',
    hasilWindowOpen.panjang > 500 && hasilWindowOpen.adaSvg && hasilWindowOpen.bebasOklch,
  )

  // Anti-jalan-buntu: simulasi window.open diblokir (WebView / iframe terkurung)
  kosongkanUnduh()
  await p.evaluate(() => {
    window.__openAsli = window.open
    window.open = () => null
  })
  await klik(p, '[data-testid="tombol-cetak-partitur"]')
  const jalurFallbackCetak = await tungguUnduh(/^DrillKit - PARTITUR - .*\.html$/i)
  const teksBodyFallback = await p.evaluate(() => document.body.innerText)
  await p.evaluate(() => {
    if (window.__openAsli) window.open = window.__openAsli
    delete window.__openAsli
  })
  cek(
    'saat window.open diblokir, tombol Cetak otomatis jatuh ke unduh HTML + petunjuk Ctrl+P',
    jalurFallbackCetak !== null && /Ctrl\+P/i.test(teksBodyFallback),
  )

  /* ------------------- 4. Ketahanan saat Kunci Kios aktif ---------------- */

  await p.evaluate(() => {
    document.documentElement.setAttribute('data-kiosk', '1')
  })
  const interaktifKios = await p.evaluate(() => {
    const daftarSelector = [
      '[data-testid="partitur-filter-semua"]',
      '[data-testid="partitur-pilih-part"]',
      '[data-testid="partitur-cetak-buka"]',
      '[data-testid="cetak-partitur-kertas"]',
      '[data-testid="tombol-unduh-html-partitur"]',
      '[data-testid="tombol-cetak-partitur"]',
    ]
    return daftarSelector.every((sel) => {
      const el = document.querySelector(sel)
      return !!el && getComputedStyle(el).pointerEvents === 'auto'
    })
  })
  await p.evaluate(() => {
    document.documentElement.removeAttribute('data-kiosk')
  })
  cek(
    'seluruh kendali filter & modal cetak tetap interaktif saat Kunci Kios aktif',
    interaktifKios === true,
  )

  await p.keyboard.press('Escape')
  await wait(300)

  /* --- 5. Mode Anggota: tanpa nama, Trumpet, seksi Brass, & Color Guard -- */

  kosongkanUnduh()
  await ke(p, '#/berbagi')
  await klik(p, '[data-testid="unduh-grup"]')
  const jalurPaketGrup = await tungguUnduh(/\.json$/i)
  cek('pelatih menerbitkan berkas paket grup untuk anggota', jalurPaketGrup !== null)

  ctxAnggota = await browser.createBrowserContext()
  const halAnggota = await ctxAnggota.newPage()
  pasangPemantau(halAnggota)
  halAnggota.on('dialog', async (d) => {
    await d.accept()
  })

  await halAnggota.goto(BASE, { waitUntil: 'networkidle2' })
  await wait(1500)
  await klik(halAnggota, '[data-testid="pilih-member"]')
  await klik(halAnggota, '[data-testid="lanjut-pilih-mode"]')
  await wait(1000)
  await ke(halAnggota, '#/berbagi')

  // Muat paket grup ke perangkat anggota tanpa menyentuh folder dist/
  const selectorInputPaket = (await ada(halAnggota, '#pkg-input')) ? '#pkg-input' : '#pkg-input2'
  await unggah(halAnggota, selectorInputPaket, jalurPaketGrup)
  await wait(2000)

  // 5a. Sebelum memilih nama (me === null): tab Musik & partitur tetap terbuka di Full score
  await klik(halAnggota, '[data-testid="tab-musik"]')
  await wait(900)
  await klik(halAnggota, `[data-testid="pilih-lagu-${laguUji.id}"]`)
  await halAnggota.waitForSelector('[data-testid="panel-partitur"]', { timeout: 10000 })
  cek(
    'anggota melihat tombol Tambahkan dari pelatih saat berkas partitur belum ada di HP',
    await ada(halAnggota, '[data-testid="partitur-tambah"]'),
  )
  await unggah(halAnggota, '#partitur-input', jalurSkor6Part)
  await klik(halAnggota, '[data-testid="partitur-simpan"]')
  await klik(halAnggota, '[data-testid="partitur-buka"]')
  await tungguRenderSelesai(halAnggota)

  const infoAnonim = await teks(halAnggota, '[data-testid="partitur-info-sesi"]')
  cek(
    'anggota tanpa memilih nama tetap bisa membuka partitur di Full score (6 part)',
    infoAnonim.includes('6 part terender') &&
      infoAnonim.includes('Full score') &&
      !(await ada(halAnggota, '[data-testid="partitur-info-anggota"]')),
    infoAnonim,
  )

  // 5b. Pilih Andra Pratama (Brass · Trumpet) → otomatis menyaring 2 part Trumpet
  const pilihNamaAnggota = async (potonganNama) => {
    const tombolGanti = await halAnggota.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((el) =>
        el.textContent?.includes('Ganti nama'),
      )
      if (b) {
        b.click()
        return true
      }
      return false
    })
    if (tombolGanti) await wait(400)

    const kolomCari = await halAnggota.$('input[placeholder="Ketik nama atau kode…"]')
    if (kolomCari) {
      await kolomCari.click({ clickCount: 3 })
      await halAnggota.keyboard.press('Backspace')
      await halAnggota.keyboard.type(potonganNama, { delay: 15 })
      await wait(400)
    }
    await halAnggota.evaluate((nama) => {
      const b = [...document.querySelectorAll('button')].find((el) =>
        el.textContent?.includes(nama),
      )
      if (b) b.click()
    }, potonganNama)
    await wait(800)
  }

  await pilihNamaAnggota('Andra Pratama')
  await tungguRenderSelesai(halAnggota)

  const infoAndra = await teks(halAnggota, '[data-testid="partitur-info-sesi"]')
  const lencanaAndra = await teks(halAnggota, '[data-testid="partitur-info-anggota"]')
  cek(
    'memilih Andra Pratama (Trumpet) otomatis menyaring 2/6 part Trumpet',
    infoAndra.includes('2/6 part · Trumpet'),
    infoAndra,
  )
  cek(
    'lencana info anggota menyebut Andra & penyaringan profil Trumpet secara jujur',
    lencanaAndra.includes('Andra') && lencanaAndra.includes('Trumpet'),
    lencanaAndra,
  )

  // Anggota pindah ke Full score, lalu kembali lewat tombol 1-klik `partitur-ke-part-saya`
  await klik(halAnggota, '[data-testid="partitur-filter-semua"]')
  await tungguRenderSelesai(halAnggota)
  cek(
    'saat anggota melihat Full score, tombol Ke part saya muncul',
    (await teks(halAnggota, '[data-testid="partitur-info-sesi"]')).includes('Full score') &&
      (await ada(halAnggota, '[data-testid="partitur-ke-part-saya"]')),
  )
  await klik(halAnggota, '[data-testid="partitur-ke-part-saya"]')
  await tungguRenderSelesai(halAnggota)
  cek(
    'klik Ke part saya mengembalikan tampilan ke 2/6 part Trumpet milik Andra',
    (await teks(halAnggota, '[data-testid="partitur-info-sesi"]')).includes('2/6 part · Trumpet'),
  )

  // 5c. Berganti ke Citra Dewi (Brass · Trombone — tidak ada Trombone di skor) → jatuh ke seksi Brass
  await pilihNamaAnggota('Citra Dewi')
  await tungguRenderSelesai(halAnggota)
  const infoCitra = await teks(halAnggota, '[data-testid="partitur-info-sesi"]')
  const lencanaCitra = await teks(halAnggota, '[data-testid="partitur-info-anggota"]')
  cek(
    'anggota Trombone (tak ada di skor) otomatis jatuh ke kelompok seksi Brass (3/6 part)',
    infoCitra.includes('3/6 part · Brass') && lencanaCitra.includes('Brass'),
    `${infoCitra} | ${lencanaCitra}`,
  )

  // 5d. Berganti ke Putri Ramadhani (Color Guard · Flag) → kembali ramah ke Full score
  await pilihNamaAnggota('Putri Ramadhani')
  await tungguRenderSelesai(halAnggota)
  const infoPutri = await teks(halAnggota, '[data-testid="partitur-info-sesi"]')
  const lencanaPutri = await teks(halAnggota, '[data-testid="partitur-info-anggota"]')
  cek(
    'anggota Color Guard tetap memperoleh Full score utuh dengan keterangan ramah (tanpa kanvas kosong)',
    infoPutri.includes('6 part terender') &&
      infoPutri.includes('Full score') &&
      lencanaPutri.includes('Color Guard') &&
      !(await ada(halAnggota, '[data-testid="partitur-ke-part-saya"]')),
    `${infoPutri} | ${lencanaPutri}`,
  )

  // Anggota pun bisa membuka modal cetak & mengunduh HTML part miliknya
  await pilihNamaAnggota('Maya Anggraini')
  await tungguRenderSelesai(halAnggota)
  cek(
    'anggota Pit (Maya · Marimba) langsung diarahkan ke 1/6 part Marimba',
    (await teks(halAnggota, '[data-testid="partitur-info-sesi"]')).includes('1/6 part · Marimba'),
  )
  await klik(halAnggota, '[data-testid="partitur-cetak-buka"]')
  await halAnggota.waitForSelector('[data-testid="modal-cetak-partitur"]', { timeout: 10000 })
  await tungguCetakSiap(halAnggota)
  cek(
    'anggota dapat membuka pratinjau cetak part miliknya (otomatis part:P6 · A4 Tegak)',
    (await halAnggota.evaluate(
      () => document.querySelector('[data-testid="cetak-partitur-bagian"]')?.value,
    )) === 'part:P6',
  )

  /* --- 6. Pemulihan ganti berkas 1-part solo & perilaku jujur skor PDF --- */

  await ke(p, '#/musik')
  await klik(p, `[data-testid="pilih-lagu-${laguUji.id}"]`)
  // Simpan filter P6 dulu di lagu ini, lalu ganti berkas ke skor solo 1-part (`SOLO1`)
  if (!(await ada(p, '[data-testid="layar-partitur"]'))) {
    await klik(p, '[data-testid="partitur-buka"]')
    await tungguRenderSelesai(p)
  }
  await pilihSelect(p, '[data-testid="partitur-pilih-part"]', 'P6')
  await tungguRenderSelesai(p)

  await klik(p, '[data-testid="partitur-ganti"]')
  await p.waitForSelector('[data-testid="partitur-ganti-konfirmasi"]', { timeout: 5000 })
  await unggah(p, '#partitur-input', jalurSkorSolo)
  await p.waitForSelector('[data-testid="partitur-simpan"]', { timeout: 10000 })
  await klik(p, '[data-testid="partitur-simpan"]')
  await tungguRenderSelesai(p)

  const cekSkorSolo = await p.evaluate(() => ({
    info: document.querySelector('[data-testid="partitur-info-sesi"]')?.textContent?.trim() ?? '',
    bar: document.querySelector('[data-testid="partitur-filter-bar"]')?.textContent?.trim() ?? '',
    adaDropdownPart: !!document.querySelector('[data-testid="partitur-pilih-part"]'),
  }))
  cek(
    'mengganti partitur ke skor solo 1-part pulih mulus dari filter lama ke Full score',
    cekSkorSolo.info.includes('1 part terender') && cekSkorSolo.info.includes('Full score'),
    cekSkorSolo.info,
  )
  cek(
    'skor 1-part menampilkan lencana tenang Part tunggal tanpa membingungkan dengan chip grup',
    cekSkorSolo.bar.includes('Part tunggal') &&
      cekSkorSolo.bar.includes('Trumpet Solo') &&
      !cekSkorSolo.adaDropdownPart,
    cekSkorSolo.bar,
  )

  // Ganti ke berkas PDF untuk memastikan penyaringan tidak tampil semu & tombol PDF tetap ada
  await klik(p, '[data-testid="partitur-ganti"]')
  await p.waitForSelector('[data-testid="partitur-ganti-konfirmasi"]', { timeout: 5000 })
  await unggah(p, '#partitur-input', jalurPdfMinimal)
  await p.waitForSelector('[data-testid="partitur-simpan"]', { timeout: 10000 })
  await klik(p, '[data-testid="partitur-simpan"]')
  await p.waitForSelector('[data-testid="partitur-pdf-bingkai"]', { timeout: 10000 })

  cek(
    'partitur PDF menyembunyikan filter instrumen & tetap menyediakan Buka di tab baru + Unduh PDF',
    !(await ada(p, '[data-testid="partitur-filter-bar"]')) &&
      !(await ada(p, '[data-testid="partitur-cetak-buka"]')) &&
      (await ada(p, '[data-testid="partitur-pdf-buka"]')) &&
      (await ada(p, '[data-testid="partitur-pdf-unduh"]')),
  )

  /* -------------- 7. Kebersihan konsol & 0 permintaan eksternal ---------- */

  cek(
    'tidak ada error konsol maupun pageerror sepanjang skenario pelatih & anggota',
    errors.length === 0,
    errors.slice(0, 3).join(' | '),
  )
  cek(
    '0 permintaan jaringan ke luar origin lokal (100% luring)',
    permintaanLuar.length === 0,
    permintaanLuar.slice(0, 3).join(' | '),
  )
} finally {
  if (ctxAnggota) await ctxAnggota.close().catch(() => {})
  await browser.close().catch(() => {})
  fs.rmSync(TMP_ROOT, { recursive: true, force: true })
}

console.log(`${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length > 0) {
  for (const g of gagal) console.log('  GAGAL:', g)
  process.exit(1)
}
