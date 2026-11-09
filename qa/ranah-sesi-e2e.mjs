/**
 * #35 — isi sesi per ranah, blok paralel per seksi, pola sesi, neraca
 * mingguan, & cetakan A4 Jadwal: uji peramban ujung ke ujung.
 *
 * Logika murninya diuji di `ranah-sesi-logika.mjs`. Di sini sambungannya:
 *
 *   1. Modal "Pola sesi": tambah 3 contoh pola Latsar (blok section paralel
 *      untuk seksi yang punya anggota aktif), lalu terapkan Pola A ke Selasa,
 *      B ke Kamis, C ke Jumat — hanya sesi latihan, Hakrab tidak tersentuh;
 *      penerapan ulang mode "hanya yang kosong" melewati sesi berencana.
 *   2. Kartu sesi & agenda: label isi otomatis ("Fisik + Visual"), bilah
 *      komposisi, penanda ⇉ paralel.
 *   3. Modal jadwal: ranah blok, panel jalur paralel (seksi, ranah jalur,
 *      pelatih, tempat), peringatan langsung (pelatih di dua jalur, seksi
 *      tanpa kegiatan), simpan & muat pola.
 *   4. Tab Neraca: menit per ranah per seksi, tabel, target preset, selisih
 *      target, peringatan, tautan dari kepala minggu Agenda.
 *   5. Cetak: lembar rencana minggu (kolom per seksi) & kalender A4 tegak
 *      bergaya poster (Goals/Catatan, komposisi) atau A4 mendatar lama.
 *   6. Pacu latihan menampilkan jalur paralel; HP 360 px tanpa gulir mendatar;
 *      nol galat konsol.
 *
 * Pakai: npm run build && npx vite preview --port 4173 &
 *        BASE=http://localhost:4173 node qa/ranah-sesi-e2e.mjs
 */
import puppeteer from 'puppeteer'
import { writeFileSync, mkdirSync } from 'node:fs'
import { lewatSambutan } from './sambutan.mjs'

const BASE = process.env.BASE || process.argv[2] || 'http://localhost:4173'
const FOTO = process.env.FOTO || ''

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

const browser = await puppeteer.launch({
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  defaultViewport: { width: 1280, height: 900 },
})
const errors = []
const ABAIKAN = /favicon|Failed to load resource|net::ERR/i

/** Senin minggu depan & seterusnya — uji tidak bergantung tanggal hari ini. */
function isoLokal(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const kini = new Date()
const senin = new Date(kini.getFullYear(), kini.getMonth(), kini.getDate() + ((8 - kini.getDay()) % 7 || 7))
const tgl = (n) => isoLokal(new Date(senin.getFullYear(), senin.getMonth(), senin.getDate() + n))
const W1 = tgl(0)
const SESI = [
  { id: 's_sel1', date: tgl(1), title: 'Latsar Cab 42' },
  { id: 's_kam1', date: tgl(3), title: 'Latsar Cab 42' },
  { id: 's_jum1', date: tgl(4), title: 'Latsar Cab 42' },
  { id: 's_hakrab', date: tgl(6), title: 'Hakrab Cab 42', type: 'lainnya', startTime: '09:00', endTime: '15:00' },
  { id: 's_sel2', date: tgl(8), title: 'Latsar Cab 42' },
  { id: 's_kam2', date: tgl(10), title: 'Latsar Cab 42' },
]

try {
  const p = await browser.newPage()
  p.on('console', (m) => {
    if (m.type() === 'error' && !ABAIKAN.test(m.text())) errors.push(m.text())
  })
  p.on('pageerror', (e) => errors.push(String(e)))
  // Tangkap HTML cetak alih-alih membuka jendela baru.
  await p.evaluateOnNewDocument(() => {
    window.__cetak = []
    window.open = () => ({
      document: { write: (h) => window.__cetak.push(h), close() {} },
      focus() {},
      setTimeout() {},
      print() {},
    })
  })

  const ada = async (sel) => (await p.$(sel)) != null
  const teks = (sel) => p.$eval(sel, (e) => (e.textContent ?? '').replace(/\s+/g, ' ').trim())
  const klik = async (sel) => {
    await p.waitForSelector(sel, { timeout: 15000 })
    await p.$eval(sel, (e) => e.scrollIntoView({ block: 'center' }))
    await p.click(sel)
  }
  const isi = async (sel, nilai) => {
    await p.waitForSelector(sel, { timeout: 10000 })
    await p.$eval(
      sel,
      (el, v) => {
        const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
        Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v)
        el.dispatchEvent(new Event('input', { bubbles: true }))
        el.dispatchEvent(new Event('change', { bubbles: true }))
      },
      String(nilai),
    )
  }
  const idb = (fn, arg) =>
    p.evaluate(
      (src, a) =>
        new Promise((res, rej) => {
          const r = indexedDB.open('drillkit')
          r.onerror = () => rej(r.error)
          r.onsuccess = () => {
            const db = r.result
            Promise.resolve(new Function('db', 'arg', src)(db, a)).then((x) => {
              db.close()
              res(x)
            }, rej)
          }
        }),
      `return (${fn})(db, arg)`,
      arg,
    )
  const ambil = (store, key) =>
    idb(
      (db, [s, k]) =>
        new Promise((res) => {
          const q = db.transaction(s).objectStore(s).get(k)
          q.onsuccess = () => res(q.result ?? null)
        }),
      [store, key],
    )
  /** Sesi terdekat tampil sebagai kartu besar "berikutnya"; sisanya baris yang dibuka. */
  const bukaKartu = async (h, id) => {
    if (await h.$(`[data-testid="kartu-${id}"]`)) return
    await h.$eval(`[data-testid="baris-${id}"]`, (e) => e.click())
    await h.waitForSelector(`[data-testid="kartu-${id}"]`, { timeout: 5000 })
  }
  const cetakan = async () => p.evaluate(() => window.__cetak.splice(0))

  /* ============================== Persiapan ============================== */
  await p.goto(BASE, { waitUntil: 'networkidle2' })
  await lewatSambutan(p)
  await idb(
    (db, sesi) =>
      new Promise((res, rej) => {
        const tx = db.transaction(['members', 'sessions'], 'readwrite')
        const seksi = ['brass', 'brass', 'percussion', 'percussion', 'guard', 'guard']
        seksi.forEach((s, i) =>
          tx.objectStore('members').put({
            id: `m${i}`, name: `Anggota ${i + 1}`, code: `A${i + 1}`, section: s, instrument: '', role: 'member',
            joinYear: 2026, active: 1, createdAt: 0,
          }),
        )
        for (const x of sesi)
          tx.objectStore('sessions').put({
            type: 'latihan', startTime: '18:00', endTime: '20:00', checklist: [], createdAt: 0, ...x,
          })
        tx.oncomplete = () => res(true)
        tx.onerror = () => rej(tx.error)
      }),
    SESI,
  )
  await p.goto(`${BASE}/#/jadwal`, { waitUntil: 'networkidle2' })
  await p.reload({ waitUntil: 'networkidle2' }) // Dexie tidak melihat tulisan IDB mentah
  await wait(800)
  await klik('[data-testid="tampilan-agenda"]')

  /* ============================== 1. Pola sesi ============================== */
  console.log('\n— Pola sesi —')
  await klik('[data-testid="buka-pola-sesi"]')
  await p.waitForSelector('[data-testid="modal-pola-sesi"]')
  cek('modal pola: kosong di awal', (await teks('[data-testid="daftar-pola"]')).includes('Belum ada pola'))
  await klik('[data-testid="contoh-pola"]')
  await p.waitForFunction(() => document.querySelectorAll('[data-testid^="pola-pola_"]').length === 3, { timeout: 8000 }).catch(() => {})
  const namaPola = await p.$$eval('[data-testid^="pola-pola_"]', (xs) => xs.map((x) => x.textContent))
  cek('3 contoh pola Latsar ditambahkan', namaPola.length === 3 && namaPola[0].includes('Latsar A') && namaPola[2].includes('Latsar C'))
  cek('contoh pola 120 menit & berlabel', namaPola.every((t) => t.includes('2 jam')) && namaPola[0].includes('Fisik + Visual'))
  cek('contoh B ditandai paralel per seksi', namaPola[1].includes('paralel per seksi'))
  const pengaturan = await ambil('settings', 'team')
  const polaB = pengaturan.polaSesi[1]
  const sectionB = polaB.rencana.find((b) => b.cabang)
  cek('pola B: jalur untuk seksi beranggota (brass, percussion, guard)', sectionB && sectionB.cabang.map((c) => c.seksi[0]).join() === 'brass,percussion,guard')

  const pilihPola = async (i) => {
    const id = pengaturan.polaSesi[i].id
    await p.select('[data-testid="terap-pola-pilih"]', id)
  }
  await isi('[data-testid="terap-dari"]', W1)
  await isi('[data-testid="terap-sampai"]', tgl(13))
  const terapHari = async (i, nyala) => {
    const on = (await p.$eval(`[data-testid="terap-hari-${i}"]`, (e) => e.getAttribute('aria-pressed'))) === 'true'
    if (on !== nyala) await klik(`[data-testid="terap-hari-${i}"]`)
  }
  await pilihPola(0)
  await terapHari(1, true)
  await wait(200)
  const ringkas1 = await teks('[data-testid="terap-ringkas"]')
  cek('ringkas: 2 Selasa akan diisi', ringkas1.startsWith('2 sesi akan diisi'), ringkas1 + ' | ' + (await p.$$eval('[data-testid^="terap-"]', (xs) => xs.map((e) => e.dataset.testid + '=' + (e.value || e.getAttribute('aria-pressed') || '')).join(' '))))
  await klik('[data-testid="terap-ya"]')
  await wait(400)
  await pilihPola(1)
  await terapHari(1, false)
  await terapHari(3, true)
  await wait(200)
  await klik('[data-testid="terap-ya"]')
  await wait(400)
  await pilihPola(2)
  await terapHari(3, false)
  await terapHari(4, true)
  await wait(200)
  await klik('[data-testid="terap-ya"]')
  await wait(500)
  const sel1 = await ambil('sessions', 's_sel1')
  const kam1 = await ambil('sessions', 's_kam1')
  const jum1 = await ambil('sessions', 's_jum1')
  const kam2 = await ambil('sessions', 's_kam2')
  const hakrab = await ambil('sessions', 's_hakrab')
  cek('Selasa → Pola A (7 blok)', sel1.rencanaLatihan?.length === 7 && sel1.rencanaLatihan[2].jenis === 'fisik')
  cek('Kamis → Pola B (6 blok, section paralel)', kam1.rencanaLatihan?.length === 6 && kam1.rencanaLatihan.some((b) => b.cabang?.length === 3))
  cek('Kamis minggu kedua juga terisi', kam2.rencanaLatihan?.length === 6)
  cek('Jumat → Pola C (7 blok)', jum1.rencanaLatihan?.length === 7 && jum1.rencanaLatihan.some((b) => b.jenis === 'gabungan'))
  cek('Hakrab (jenis lain) tidak tersentuh', !hakrab.rencanaLatihan)
  cek('id blok tiap sesi unik', new Set([...kam1.rencanaLatihan, ...kam2.rencanaLatihan].map((b) => b.id)).size === 12)
  await pilihPola(0)
  await terapHari(4, false)
  await terapHari(1, true)
  await wait(200)
  const ringkasUlang = await teks('[data-testid="terap-ringkas"]')
  cek('terap ulang mode kosong: 2 sesi dilewati', ringkasUlang.startsWith('0 sesi') && ringkasUlang.includes('2 dilewati karena sudah punya rencana'), ringkasUlang)
  await p.keyboard.press('Escape')
  await wait(300)

  /* ============================== 2. Kartu & agenda ============================== */
  console.log('\n— Kartu & agenda —')
  await bukaKartu(p, 's_sel1')
  await p.waitForSelector('[data-testid="komposisi-s_sel1"]', { timeout: 5000 }).catch(() => {})
  cek('kartu Selasa: isi otomatis "Fisik + Visual"', (await ada('[data-testid="komposisi-s_sel1"]')) && (await teks('[data-testid="komposisi-s_sel1"]')).includes('Fisik + Visual'))
  await bukaKartu(p, 's_kam1')
  await p.waitForSelector('[data-testid="komposisi-s_kam1"]', { timeout: 5000 }).catch(() => {})
  const kompKam = (await ada('[data-testid="komposisi-s_kam1"]')) ? await teks('[data-testid="komposisi-s_kam1"]') : ''
  cek('kartu Kamis: musik + section & ⇉ paralel', kompKam.includes('Section') && kompKam.includes('paralel per seksi'), kompKam)
  cek('bilah komposisi hex', await p.$eval('[data-testid="komposisi-s_kam1"] [data-ranah="section"]', (e) => getComputedStyle(e).backgroundColor === 'rgb(6, 182, 212)').catch(() => false))
  cek('kepala minggu: tautan Neraca', await ada(`[data-testid="ke-neraca-${W1}"]`))

  /* ============================== 3. Modal jadwal ============================== */
  console.log('\n— Penyunting rencana —')
  await p.evaluate(() => {
    const k = document.querySelector('[data-testid="kartu-s_kam1"]')
    ;[...k.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Edit').click()
  })
  await p.waitForSelector('[data-testid="komposisi-rencana"]', { timeout: 8000 })
  cek('modal: komposisi rencana tampil', (await teks('[data-testid="label-komposisi"]')).includes('Section'))
  cek('modal: komposisi per seksi', (await ada('[data-testid="komposisi-seksi-guard"]')) && (await ada('[data-testid="komposisi-seksi-brass"]')))
  const blokSection = kam1.rencanaLatihan.find((b) => b.cabang)
  const [cBrass, cPerk, cCg] = blokSection.cabang.map((c) => c.id)
  await klik(`[data-testid="detail-${blokSection.id}"]`)
  await p.waitForSelector(`[data-testid="panel-blok-${blokSection.id}"]`)
  cek('panel jalur: 3 jalur', (await p.$$(`[data-testid="cabang-blok-${blokSection.id}"] [data-testid^="cabang-j_"]`)).length === 3)
  await p.select(`[data-testid="cabang-jenis-${cCg}"]`, 'visual')
  await isi(`[data-testid="cabang-pelatih-${cBrass}"]`, 'Kak Dimas')
  await isi(`[data-testid="cabang-pelatih-${cPerk}"]`, 'kak dimas')
  await isi(`[data-testid="cabang-tempat-${cBrass}"]`, 'Aula')
  await wait(200)
  const per1 = (await ada('[data-testid="peringatan-rencana"]')) ? await teks('[data-testid="peringatan-rencana"]') : ''
  cek('peringatan: pelatih di dua jalur', per1.includes('Kak Dimas dijadwalkan di 2 jalur'), per1)
  await klik(`[data-testid="cabang-seksi-${cCg}-guard"]`)
  await wait(200)
  const per2 = await teks('[data-testid="peringatan-rencana"]')
  cek('peringatan: CG tanpa kegiatan', per2.includes('Color Guard tidak punya kegiatan'), per2)
  await klik(`[data-testid="cabang-seksi-${cCg}-guard"]`)
  await isi(`[data-testid="cabang-pelatih-${cPerk}"]`, 'Kak Rani')
  await wait(200)
  cek('peringatan hilang setelah dibetulkan', !(await ada('[data-testid="peringatan-rencana"]')))
  await isi(`[data-testid="cabang-pelatih-${cPerk}"]`, 'Kak Dimas')
  // simpan sebagai pola
  await klik('[data-testid="simpan-pola"]')
  await isi('[data-testid="nama-pola"]', 'Pola uji Kamis')
  await klik('[data-testid="simpan-pola-ya"]')
  await wait(400)
  cek('simpan sebagai pola → pustaka 4 pola', (await ambil('settings', 'team')).polaSesi.length === 4)
  await klik('[data-testid="simpan-jadwal"]')
  await wait(500)
  const kam1b = await ambil('sessions', 's_kam1')
  const sb = kam1b.rencanaLatihan.find((b) => b.cabang)
  cek('tersimpan: ranah jalur CG = visual', sb.cabang.find((c) => c.id === cCg)?.jenis === 'visual')
  cek('tersimpan: pelatih & tempat jalur', sb.cabang[0].pelatih === 'Kak Dimas' && sb.cabang[0].tempat === 'Aula')

  // muat pola di sesi lain (dibatalkan)
  await bukaKartu(p, 's_jum1')
  await p.evaluate(() => {
    const k = document.querySelector('[data-testid="kartu-s_jum1"]')
    ;[...k.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Edit').click()
  })
  await p.waitForSelector('[data-testid="muat-pola"]', { timeout: 8000 })
  const polaUji = (await ambil('settings', 'team')).polaSesi.find((x) => x.nama === 'Pola uji Kamis')
  await p.select('[data-testid="muat-pola"]', polaUji.id)
  await wait(300)
  cek('muat pola mengganti blok di modal', (await p.$$('[data-testid="daftar-blok"] > li')).length === 6)
  await p.keyboard.press('Escape')
  await wait(300)
  cek('dibatalkan: Jumat tetap Pola C', (await ambil('sessions', 's_jum1')).rencanaLatihan.length === 7)

  /* ============================== 4. Neraca ============================== */
  console.log('\n— Neraca —')
  await klik(`[data-testid="ke-neraca-${W1}"]`)
  await p.waitForSelector('[data-testid="tampilan-neraca"]', { timeout: 8000 })
  cek('tautan agenda membuka tab Neraca minggu itu', (await p.$eval('[data-testid="tampilan-neraca"]', () => true)) && (await p.$eval('[data-testid="tampilan-neraca"]', (e) => e.textContent)).length > 0)
  cek('neraca: 3 sesi latihan (Hakrab tidak dihitung)', (await p.$$('[data-testid^="sesi-neraca-"]')).length === 3)
  cek('neraca: baris per seksi', (await ada('[data-testid="neraca-seksi-brass"]')) && (await ada('[data-testid="neraca-seksi-percussion"]')) && (await ada('[data-testid="neraca-seksi-guard"]')))
  const brassTeks = await teks('[data-testid="neraca-seksi-brass"]')
  const cgTeks = await teks('[data-testid="neraca-seksi-guard"]')
  cek('neraca: menit materi Brass 3 × ~100′', /materi 3\d\d′/.test(brassTeks), brassTeks)
  cek('neraca: CG punya visual lebih banyak (jalur visual)', Number(/Visual (\d+)%/.exec(cgTeks)?.[1] ?? 0) > Number(/Visual (\d+)%/.exec(brassTeks)?.[1] ?? 0), `${cgTeks} | ${brassTeks}`)
  cek('neraca: tabel', await ada('[data-testid="tabel-neraca"]'))
  const awas = (await ada('[data-testid="peringatan-neraca"]')) ? await teks('[data-testid="peringatan-neraca"]') : ''
  cek('neraca: peringatan pelatih ganda dengan tanggal', awas.includes('Kak Dimas dijadwalkan'), awas)
  await klik('[data-testid="ubah-target"]')
  await klik('[data-testid="preset-target-0"]')
  cek('target preset jumlah 100%', (await teks('[data-testid="jumlah-target"]')).startsWith('Jumlah 100%'))
  await klik('[data-testid="simpan-target"]')
  await wait(400)
  cek('target tersimpan', (await teks('[data-testid="nama-target"]')) === 'Dasar bersama' && (await ambil('settings', 'team')).targetNeraca?.persen?.musik === 35)
  const selisih = (await ada('[data-testid="selisih-neraca"]')) ? await teks('[data-testid="selisih-neraca"]') : ''
  cek('selisih target dilaporkan', selisih.includes('target'), selisih)
  cek('bilah target tampil', (await p.$$('[data-testid="neraca-seksi-brass"] [role="img"]')).length === 2)
  await klik('[data-testid="neraca-maju"]')
  await wait(300)
  cek('navigasi minggu: minggu kedua 2 sesi', (await p.$$('[data-testid^="sesi-neraca-"]')).length === 2)
  await klik('[data-testid="neraca-mundur"]')
  await wait(300)

  /* ============================== 5. Cetak ============================== */
  console.log('\n— Cetak —')
  await p.waitForFunction(() => !document.querySelector('[data-testid="cetak-minggu"]')?.disabled, { timeout: 8000 }).catch(() => {})
  await cetakan()
  await klik('[data-testid="cetak-minggu"]')
  await wait(400)
  const [rm] = await cetakan()
  cek('rencana minggu tercetak', !!rm && rm.includes('Rencana Latihan'))
  cek('rencana minggu: kolom per seksi', !!rm && rm.includes('>Brass</th>') && rm.includes('>Color Guard</th>'))
  cek('rencana minggu: pelatih & tempat jalur', !!rm && rm.includes('Kak Dimas · Aula'))
  cek('rencana minggu: target & neraca', !!rm && rm.includes('Target · Dasar bersama'))
  cek('rencana minggu: hex murni', !!rm && !/oklch|color-mix/.test(rm))
  if (FOTO && rm) {
    mkdirSync(FOTO, { recursive: true })
    writeFileSync(`${FOTO}/rencana-minggu.html`, rm)
  }

  await klik('[data-testid="tampilan-bulan"]')
  await wait(400)
  const target = Number(tgl(1).slice(5, 7))
  for (let i = 0; i < 3; i++) {
    const judul = await teks('[data-testid="judul-bulan"]')
    if (judul.startsWith(['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'][target - 1])) break
    await klik('[data-testid="bulan-maju"]')
    await wait(200)
  }
  await klik('[data-testid="cetak-bulan"]')
  await p.waitForSelector('[data-testid="modal-cetak-jadwal"]')
  cek('modal cetak: tegak terpilih bawaan', await p.$eval('[data-testid="cetak-tegak"]', (e) => e.checked))
  await isi('[data-testid="cetak-goal-0"]', 'Penempatan seksi selesai')
  await isi('[data-testid="cetak-catatan"]', 'Bawa air minum')
  await klik('[data-testid="cetak-komposisi"]')
  await p.waitForFunction(() => !document.querySelector('[data-testid="cetak-ya"]')?.disabled, { timeout: 8000 })
  await klik('[data-testid="cetak-ya"]')
  await wait(400)
  const [kal] = await cetakan()
  cek('kalender tegak tercetak A4 portrait', !!kal && kal.includes('size: A4 portrait'))
  cek('kalender tegak: Goals & Catatan', !!kal && kal.includes('Penempatan seksi selesai') && kal.includes('Bawa air minum'))
  cek('kalender tegak: judul kapital & komposisi', !!kal && kal.includes('LATSAR CAB 42') && kal.includes('Fisik + Visual'))
  cek('kalender tegak: hex murni', !!kal && !/oklch|color-mix/.test(kal))
  if (FOTO && kal) writeFileSync(`${FOTO}/kalender-tegak.html`, kal)
  await klik('[data-testid="cetak-bulan"]')
  await p.waitForSelector('[data-testid="modal-cetak-jadwal"]')
  cek('goals diingat per bulan', (await p.$eval('[data-testid="cetak-goal-0"]', (e) => e.value)) === 'Penempatan seksi selesai')
  await klik('[data-testid="cetak-mendatar"]')
  await klik('[data-testid="cetak-ya"]')
  await wait(400)
  const [kal2] = await cetakan()
  cek('kalender mendatar lama tetap ada', !!kal2 && kal2.includes('A4 landscape'))

  /* ============================== 6. Pacu & HP ============================== */
  console.log('\n— Pacu & HP —')
  await klik('[data-testid="tampilan-agenda"]')
  await wait(300)
  await bukaKartu(p, 's_kam1')
  await klik('[data-testid="pacu-s_kam1"]')
  await p.waitForSelector('[data-testid="pacu-latihan"]')
  cek('pacu: jalur paralel per seksi tampil', await ada('[data-testid="pacu-latihan"] [data-testid="jalur-paralel"]'))
  cek('pacu: label ranah baru', (await teks('[data-testid="daftar-blok-pacu"]')).includes('Musik bersama'))
  await klik('[data-testid="tutup-pacu"]')

  const hp = await browser.newPage()
  hp.on('pageerror', (e) => errors.push(String(e)))
  await hp.setViewport({ width: 360, height: 740 })
  await hp.goto(`${BASE}/#/jadwal`, { waitUntil: 'networkidle2' })
  await wait(800)
  await hp.click('[data-testid="tampilan-neraca"]')
  await wait(300)
  await hp.$eval('[data-testid="neraca-maju"]', (e) => e.click())
  await wait(400)
  cek('HP 360: neraca tanpa gulir mendatar', await hp.evaluate(() => document.documentElement.scrollWidth <= 360))
  if (FOTO) await hp.screenshot({ path: `${FOTO}/neraca-hp.png`, fullPage: true })
  await hp.$eval('[data-testid="tampilan-agenda"]', (e) => e.click())
  await wait(300)
  await bukaKartu(hp, 's_kam1')
  await wait(300)
  await hp.evaluate(() => {
    const k = document.querySelector('[data-testid="kartu-s_kam1"]')
    ;[...k.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Edit').click()
  })
  await hp.waitForSelector('[data-testid="komposisi-rencana"]')
  const idBlok = (await ambil('sessions', 's_kam1')).rencanaLatihan.find((b) => b.cabang).id
  await hp.$eval(`[data-testid="detail-${idBlok}"]`, (e) => e.click())
  await wait(300)
  await hp.$eval(`[data-testid="panel-blok-${idBlok}"]`, (e) => e.scrollIntoView({ block: 'center' }))
  const lebar = await hp.evaluate(() => {
    const lebih = [...document.querySelectorAll('body *')]
      .filter((e) => e.getBoundingClientRect().right > 361)
      .slice(0, 4)
      .map((e) => `${e.tagName}.${(e.getAttribute('class') || '').slice(0, 60)}[${e.dataset.testid || ''}]`)
    return { sw: document.documentElement.scrollWidth, lebih }
  })
  cek('HP 360: modal jalur tanpa gulir mendatar', lebar.sw <= 360 && lebar.lebih.length === 0, JSON.stringify(lebar))
  if (FOTO) await hp.screenshot({ path: `${FOTO}/modal-hp.png` })
  if (FOTO) {
    await p.bringToFront()
    await klik('[data-testid="tampilan-neraca"]')
    await wait(400)
    await p.screenshot({ path: `${FOTO}/neraca-laptop.png`, fullPage: true })
  }

  cek('nol galat konsol', errors.length === 0, errors.slice(0, 3).join(' | '))
} catch (e) {
  cek('rangkaian berjalan tanpa pengecualian', false, String(e?.stack || e))
} finally {
  await browser.close()
}

console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) {
  for (const g of gagal) console.log('  ✗ ' + g)
  process.exit(1)
}
