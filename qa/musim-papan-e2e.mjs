/**
 * #34a — Musim TC (H-Minus) & Papan Tindak Lanjut Staf: uji peramban ujung ke ujung.
 *
 * Logika murninya diuji di `manajemen-musim-logika.mjs`. Di sini sambungannya:
 *
 *   1. Dashboard: kartu hitung mundur terpadu — tonggak Program Latsar
 *      (Hakrab, Camp tanpa tanggal) & penampilan Jadwal.
 *   2. Evaluasi → Musim & Papan Staf: buat musim dari tanggal H-0 (nama &
 *      sesi penampilan terisi otomatis), 6 gerbang mundur dengan bukti
 *      otomatis (partitur set list, simulasi juri Box 4), gerbang lewat
 *      tenggat, tanda tercapai manual, ubah/tambah/hapus gerbang.
 *   3. Papan: tambah tugas staf berprioritas, geser Temuan → Fokus, saring
 *      per asal, peringatan fokus > 5, cetak Lembar Fokus A4 (hex, lencana asal).
 *   4. Lomba → Judge Tape: "→ Tindak lanjut" membuat kartu Juri (set, birama,
 *      prioritas) sekali saja; komentar pujian tidak ditawari.
 *   5. Dashboard: H-0 musim tanpa duplikat sesi, "Fokus minggu ini" & tandai beres.
 *   6. HP 360 px tanpa gulir mendatar; nol galat konsol.
 *
 * Pakai: npm run build && npx vite preview --port 4173 &
 *        BASE=http://localhost:4173 node qa/musim-papan-e2e.mjs
 */
import puppeteer from 'puppeteer'
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

function isoLokal(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const kini = new Date()
const hari = (n) => isoLokal(new Date(kini.getFullYear(), kini.getMonth(), kini.getDate() + n))
const cap = (nilai) => [{ id: 'c1', kelompok: 'musik', label: 'Music', maksKomposisi: 10, maksEksekusi: 10, nilaiKomposisi: nilai, nilaiEksekusi: nilai, pengaliBobot: 1 }]

try {
  const p = await browser.newPage()
  p.on('console', (m) => {
    if (m.type() === 'error' && !ABAIKAN.test(m.text())) errors.push(m.text())
  })
  p.on('pageerror', (e) => errors.push(String(e)))
  await p.evaluateOnNewDocument(() => {
    window.__cetak = []
    window.open = () => ({
      document: { write: (h) => window.__cetak.push(h), close() {}, open() {} },
      focus() {},
      setTimeout() {},
      print() {},
      addEventListener() {},
      close() {},
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
  const semua = (store) =>
    idb(
      (db, s) =>
        new Promise((res) => {
          const q = db.transaction(s).objectStore(s).getAll()
          q.onsuccess = () => res(q.result)
        }),
      store,
    )
  const tim = async () => (await semua('settings')).find((x) => x.key === 'team') ?? {}
  const foto = async (nama) => FOTO && p.screenshot({ path: `${FOTO}/${nama}.png`, fullPage: true })
  const status = (sel) => p.$eval(sel, (e) => e.dataset.status).catch(() => null)

  /* ============================== Persiapan ============================== */
  await p.goto(BASE, { waitUntil: 'networkidle2' })
  await lewatSambutan(p)
  await idb(
    (db, a) =>
      new Promise((res, rej) => {
        const tx = db.transaction(['members', 'sessions', 'songs', 'setlists', 'penilaianLomba', 'tindakLanjut', 'settings'], 'readwrite')
        tx.objectStore('members').put({ id: 'ma', name: 'Ari', code: 'A1', section: 'brass', instrument: '', role: 'member', joinYear: 2026, active: 1, createdAt: 0 })
        tx.objectStore('members').put({ id: 'mb', name: 'Bela', code: 'B1', section: 'guard', instrument: '', role: 'member', joinYear: 2026, active: 1, createdAt: 0 })
        tx.objectStore('songs').put({ id: 'L1', title: 'Opener', bpm: 120, createdAt: 0, partitur: { namaFile: 'opener.musicxml', tipe: 'musicxml', ukuran: 10, hash: 'x' } })
        tx.objectStore('songs').put({ id: 'L2', title: 'Encore', bpm: 120, createdAt: 0 })
        tx.objectStore('setlists').put({ id: 'SL', name: 'Show GPMB', songIds: ['L1'], createdAt: 0, updatedAt: 0 })
        tx.objectStore('sessions').put({ id: 'S0', title: 'GPMB Final', type: 'penampilan', date: a.h0, startTime: '08:00', endTime: '17:00', checklist: [], createdAt: 0, setListId: 'SL' })
        tx.objectStore('penilaianLomba').put({
          id: 'P1', judul: 'Simulasi 1', tanggal: a.sim, skema: 'field_show', captions: a.cap, penalti: [], createdAt: 1, updatedAt: 1,
          catatanWaktu: [
            { id: 'C1', detik: 83, fokus: 'visual', teks: 'Sayap kanan maju satu langkah', birama: 25, tingkat: 'penting' },
            { id: 'C2', detik: 120, fokus: 'musik', teks: 'Ballad indah', tingkat: 'pujian' },
          ],
        })
        tx.objectStore('tindakLanjut').put({ id: 'tl_cl', judul: 'Busur kiri renggang', status: 'temuan', sumber: 'cleaning', setNomor: 3, createdAt: 1, updatedAt: 1 })
        const g = tx.objectStore('settings').get('team')
        g.onsuccess = () => {
          const t = g.result
          t.programLatihan = [
            {
              id: 'P', nama: 'Latsar CAB 42', mulai: a.mulai, selesai: a.selesai, hari: [1, 3, 4], jamMulai: '18:00', jamSelesai: '20:00', tambahan: [], libur: [], fase: [],
              tonggak: [{ id: 'h', nama: 'Hakrab', jenis: 'acara', dari: a.hakrab }, { id: 'c', nama: 'Camp', jenis: 'camp' }],
              sesiIds: [], wajibIds: [], peserta: [], aturan: { persenMin: 70, hadirMin: 7, sakitMaksJam: 24 }, dibuat: 1, diubah: 1,
            },
          ]
          tx.objectStore('settings').put(t)
        }
        tx.oncomplete = () => res(true)
        tx.onerror = () => rej(tx.error)
      }),
    { h0: hari(40), sim: hari(-5), cap: cap(8.5), mulai: hari(-3), selesai: hari(30), hakrab: hari(5) },
  )
  await p.reload({ waitUntil: 'networkidle2' })
  await wait(800)

  /* ============================== 1. Dashboard awal ============================== */
  console.log('\n— Dashboard: hitung mundur terpadu —')
  await p.waitForSelector('[data-testid="kartu-musim-dasbor"]', { timeout: 8000 }).catch(() => {})
  cek('kartu hitung mundur tampil', await ada('[data-testid="kartu-musim-dasbor"]'))
  const titik = await p.$$eval('[data-testid^="titik-"]', (xs) => xs.map((x) => `${x.dataset.asal}:${(x.textContent ?? '').replace(/\s+/g, ' ').trim()}`))
  cek('Hakrab H-5 dari Program Latsar', titik[0]?.startsWith('program:H-5') && titik[0].includes('Hakrab'), titik.join(' | '))
  cek('penampilan Jadwal H-40', titik.some((t) => t.startsWith('jadwal:H-40') && t.includes('GPMB Final')))
  cek('Camp tanpa tanggal di akhir ("?")', titik[titik.length - 1]?.startsWith('program:?') && titik[titik.length - 1].includes('belum ditentukan'))
  cek('belum ada kolom fokus', !(await ada('[data-testid="fokus-dasbor"]')))

  /* ============================== 2. Musim ============================== */
  console.log('\n— Musim TC & gerbang —')
  await p.goto(`${BASE}/#/evaluasi?tab=papan`, { waitUntil: 'networkidle2' })
  await p.waitForSelector('[data-testid="panel-musim"]', { timeout: 10000 })
  cek('tab Musim & Papan Staf aktif dari URL', (await p.$eval('[data-testid="tab-papan-staf"]', (e) => e.className)).includes('bg-emerald-600'))
  await isi('[data-testid="musim-h0-baru"]', hari(40))
  await klik('[data-testid="musim-buat"]')
  await p.waitForSelector('[data-testid="daftar-gerbang"]', { timeout: 8000 })
  const musim = (await tim()).musimTc?.[0]
  cek('musim tersimpan dengan 6 gerbang', musim?.gerbang.length === 6)
  cek('nama & sesi H-0 diisi dari penampilan di tanggal itu', musim?.nama === 'GPMB Final' && musim?.sessionId === 'S0')
  cek('hitung mundur H-40', (await teks('[data-testid="musim-sisa"]')) === 'H-40')
  const gid = (jenis) => musim.gerbang.find((g) => g.jenis === jenis).id
  cek('H-90 musik: set list 1/1 berpartitur → tercapai', (await status(`[data-testid="gerbang-${gid('musik')}"]`)) === 'tercapai' && (await teks(`[data-testid="gerbang-bukti-${gid('musik')}"]`)).startsWith('1/1'))
  cek('H-60 drill (20 hari lalu, drill belum dipilih) → lewat tenggat', (await status(`[data-testid="gerbang-${gid('drill')}"]`)) === 'terlambat')
  cek('H-14 juri: simulasi 85% Box 4 → tercapai', (await status(`[data-testid="gerbang-${gid('juri')}"]`)) === 'tercapai' && (await teks(`[data-testid="gerbang-bukti-${gid('juri')}"]`)).includes('Box 4'))
  cek('H-30 full-run → belum waktunya', (await status(`[data-testid="gerbang-${gid('fullrun')}"]`)) === 'nanti')
  cek('ringkas: 2 tercapai · 1 lewat tenggat', (await teks('[data-testid="musim-ringkas"]')).includes('2 tercapai') && (await teks('[data-testid="musim-ringkas"]')).includes('1 lewat tenggat'))
  await klik(`[data-testid="gerbang-cek-${gid('drill')}"]`)
  await p.waitForFunction((id) => document.querySelector(`[data-testid="gerbang-${id}"]`)?.dataset.status === 'tercapai', { timeout: 5000 }, gid('drill')).catch(() => {})
  cek('tanda manual → tercapai, "ditandai pelatih"', (await status(`[data-testid="gerbang-${gid('drill')}"]`)) === 'tercapai' && (await teks(`[data-testid="gerbang-bukti-${gid('drill')}"]`)).includes('ditandai pelatih'))
  cek('gerbang bukti otomatis tidak punya centang manual', !(await ada(`[data-testid="gerbang-cek-${gid('musik')}"]`)))

  await klik('[data-testid="musim-ubah-gerbang"]')
  await klik('[data-testid="gerbang-tambah"]')
  await wait(400)
  const baru = (await tim()).musimTc[0].gerbang.find((g) => g.nama === 'Gerbang baru')
  cek('tambah gerbang', !!baru)
  await isi(`[data-testid="gerbang-nama-${baru.id}"]`, 'Gladi kostum')
  await isi(`[data-testid="gerbang-h-${baru.id}"]`, '10')
  await wait(400)
  const g2 = (await tim()).musimTc[0].gerbang.find((g) => g.id === baru.id)
  cek('ubah nama & H-minus gerbang', g2?.nama === 'Gladi kostum' && g2?.hMinus === 10)
  const urutan = await p.$$eval('[data-testid^="gerbang-gb_"], [data-testid^="gerbang-"][data-status]', (xs) => [...new Set(xs.map((x) => x.dataset.testid))].filter((t) => /^gerbang-[^-]+$/.test(t)).length)
  cek('7 gerbang tampil', urutan === 7, String(urutan))
  await klik(`[data-testid="gerbang-hapus-${baru.id}"]`)
  await wait(400)
  cek('hapus gerbang', (await tim()).musimTc[0].gerbang.length === 6)
  await klik('[data-testid="musim-ubah-gerbang"]')

  /* ============================== 3. Papan ============================== */
  console.log('\n— Papan tindak lanjut —')
  cek('kartu cleaning yang sudah ada tampil di Temuan', (await status('[data-testid="kartu-tl-tl_cl"]')) === 'temuan')
  await isi('[data-testid="tl-input"]', 'Ulang transisi Ballad ke Closer')
  await p.select('[data-testid="tl-seksi"]', 'brass')
  await klik('[data-testid="tl-prioritas"]')
  await klik('[data-testid="tl-tambah"]')
  await wait(500)
  const staf = (await semua('tindakLanjut')).find((t) => t.sumber === 'staf')
  cek('tugas staf tersimpan: prioritas tinggi, seksi brass', staf?.prioritas === 'tinggi' && staf?.seksi === 'brass' && staf?.status === 'temuan')
  cek('kolom Temuan berisi 2', (await p.$eval('[data-testid="kolom-temuan"]', (e) => e.dataset.jumlah)) === '2')
  await klik(`[data-testid="tl-kanan-${staf.id}"]`)
  await wait(400)
  cek('geser → Fokus minggu ini', (await status(`[data-testid="kartu-tl-${staf.id}"]`)) === 'fokus' && (await p.$eval('[data-testid="kolom-fokus"]', (e) => e.dataset.jumlah)) === '1')
  cek('tombol ← di Temuan nonaktif', await p.$eval('[data-testid="tl-kiri-tl_cl"]', (e) => e.disabled))
  await klik('[data-testid="papan-sumber-staf"]')
  await wait(200)
  const kartuStaf = await p.$$eval('[data-testid^="kartu-tl-"]', (xs) => xs.map((x) => x.dataset.sumber))
  cek('saring asal Staf', kartuStaf.length === 1 && kartuStaf[0] === 'staf', kartuStaf.join())
  await klik('[data-testid="papan-sumber-semua"]')

  /* ============================== 4. Judge Tape ============================== */
  console.log('\n— Judge Tape → tindak lanjut —')
  await p.goto(`${BASE}/#/lomba?tab=juri`, { waitUntil: 'networkidle2' })
  await p.waitForSelector('[data-testid="jadikan-tl-C1"]', { timeout: 10000 }).catch(() => {})
  cek('tombol "→ Tindak lanjut" di komentar', await ada('[data-testid="jadikan-tl-C1"]'))
  cek('komentar pujian tidak ditawari', !(await ada('[data-testid="jadikan-tl-C2"]')))
  await klik('[data-testid="jadikan-tl-C1"]')
  await p.waitForSelector('[data-testid="tl-judgetape-C1"]', { timeout: 5000 }).catch(() => {})
  cek('setelah diklik: penanda "✓ Papan: Temuan", tombol hilang', (await ada('[data-testid="tl-judgetape-C1"]')) && !(await ada('[data-testid="jadikan-tl-C1"]')) && (await teks('[data-testid="tl-judgetape-C1"]')).includes('Temuan'))
  const juri = (await semua('tindakLanjut')).filter((t) => t.sumber === 'juri')
  cek('satu kartu Juri: birama 25, prioritas tinggi, asal tersimpan', juri.length === 1 && juri[0].biramaDari === 25 && juri[0].prioritas === 'tinggi' && juri[0].penilaianId === 'P1' && juri[0].penandaId === 'C1')
  cek('catatan kartu menyebut simulasi & waktu', juri[0]?.catatan?.includes('Simulasi 1') && juri[0]?.catatan?.includes('1:23'), juri[0]?.catatan)

  await p.goto(`${BASE}/#/evaluasi?tab=papan`, { waitUntil: 'networkidle2' })
  await p.waitForSelector('[data-testid="papan-staf"]', { timeout: 10000 })
  cek('kartu Juri tampil di Papan (Temuan)', (await p.$eval(`[data-testid="kartu-tl-${juri[0].id}"]`, (e) => `${e.dataset.sumber}/${e.dataset.status}`).catch(() => '')) === 'juri/temuan')

  // fokus berlebih
  await idb(
    (db) =>
      new Promise((res) => {
        const tx = db.transaction('tindakLanjut', 'readwrite')
        for (let i = 0; i < 5; i++) tx.objectStore('tindakLanjut').put({ id: `tl_f${i}`, judul: `Fokus ${i}`, status: 'fokus', sumber: 'staf', createdAt: 2, updatedAt: 2 })
        tx.oncomplete = () => res(true)
      }),
  )
  await p.reload({ waitUntil: 'networkidle2' })
  await p.waitForSelector('[data-testid="papan-staf"]', { timeout: 10000 })
  cek('peringatan fokus > 5', (await ada('[data-testid="fokus-berlebih"]')) && (await teks('[data-testid="fokus-berlebih"]')).startsWith('6 butir'))
  await foto('papan')
  await klik('[data-testid="papan-cetak"]')
  await wait(600)
  const html = (await p.evaluate(() => window.__cetak.splice(0)))[0] ?? ''
  cek('cetak: Lembar Fokus Latihan & Cleaning A4', html.includes('Lembar Fokus Latihan &amp; Cleaning') && html.includes('A4'))
  cek('cetak: lencana asal Juri/Staf & catatan cleaning', html.includes('class="sumber">Juri') && html.includes('class="sumber">Staf') && html.includes('Busur kiri renggang'))
  cek('cetak: tanpa warna non-hex', !/oklch|color-mix|rgba\(|var\(--/.test(html))
  await idb(
    (db) =>
      new Promise((res) => {
        const tx = db.transaction('tindakLanjut', 'readwrite')
        for (let i = 0; i < 5; i++) tx.objectStore('tindakLanjut').delete(`tl_f${i}`)
        tx.oncomplete = () => res(true)
      }),
  )

  /* ============================== 5. Dashboard ============================== */
  console.log('\n— Dashboard: musim & fokus —')
  await p.goto(`${BASE}/#/`, { waitUntil: 'networkidle2' })
  await p.reload({ waitUntil: 'networkidle2' })
  await p.waitForSelector('[data-testid="kartu-musim-dasbor"]', { timeout: 8000 })
  await p.waitForSelector('[data-testid^="titik-musim_"]', { timeout: 8000 }).catch(() => {})
  const titik2 = await p.$$eval('[data-testid^="titik-"]', (xs) => xs.map((x) => `${x.dataset.asal}:${(x.textContent ?? '').replace(/\s+/g, ' ').trim()}`))
  cek('H-0 musim tampil sebagai Kejuaraan', titik2.some((t) => t.startsWith('musim:H-40') && t.includes('GPMB Final')), titik2.join(' | '))
  cek('sesi H-0 tidak dobel dari Jadwal', !titik2.some((t) => t.startsWith('jadwal:')))
  cek('gerbang "belum waktunya" tidak memenuhi Dashboard', !titik2.some((t) => t.startsWith('gerbang:')))
  cek('Camp tanpa tanggal tetap tampil', titik2.some((t) => t.startsWith('program:?') && t.includes('Camp')))
  // Gerbang yang mendesak (H-38 = 2 hari lagi) & yang lewat tenggat naik ke Dashboard.
  await idb(
    (db) =>
      new Promise((res) => {
        const tx = db.transaction('settings', 'readwrite')
        const g = tx.objectStore('settings').get('team')
        g.onsuccess = () => {
          const t = g.result
          t.musimTc[0].gerbang = t.musimTc[0].gerbang.map((x) => (x.jenis === 'fullrun' ? { ...x, hMinus: 38 } : x.jenis === 'drill' ? { ...x, tercapaiAt: undefined } : x))
          tx.objectStore('settings').put(t)
        }
        tx.oncomplete = () => res(true)
      }),
  )
  await p.reload({ waitUntil: 'networkidle2' })
  await p.waitForSelector('[data-testid="dasbor-gerbang-terlambat"]', { timeout: 8000 }).catch(() => {})
  const titik3 = await p.$$eval('[data-testid^="titik-"]', (xs) => xs.map((x) => `${x.dataset.asal}:${(x.textContent ?? '').replace(/\s+/g, ' ').trim()}`))
  cek('gerbang segera (H-2) tampil di Dashboard', titik3.some((t) => t.startsWith('gerbang:H-2') && t.includes('Full-run')), titik3.join(' | '))
  cek('gerbang lewat tenggat: lencana merah', (await ada('[data-testid="dasbor-gerbang-terlambat"]')) && titik3.some((t) => t.startsWith('gerbang:') && t.includes('Seluruh drill')))
  cek('Fokus minggu ini berisi tugas staf', await ada(`[data-testid="fokus-dasbor-${staf.id}"]`))
  await foto('dasbor')
  await klik(`[data-testid="fokus-beres-${staf.id}"]`)
  await wait(500)
  cek('tandai beres dari Dashboard', !(await ada(`[data-testid="fokus-dasbor-${staf.id}"]`)) && (await semua('tindakLanjut')).find((t) => t.id === staf.id)?.status === 'beres')

  /* ============================== 6. HP 360 px ============================== */
  console.log('\n— HP 360 px —')
  await p.setViewport({ width: 360, height: 780 })
  const lebar = () => p.evaluate(() => document.documentElement.scrollWidth)
  await wait(400)
  cek('Dashboard muat 360 px', (await lebar()) <= 360, String(await lebar()))
  await p.goto(`${BASE}/#/evaluasi?tab=papan`, { waitUntil: 'networkidle2' })
  await p.waitForSelector('[data-testid="papan-staf"]', { timeout: 10000 })
  await klik('[data-testid="musim-ubah-gerbang"]')
  await wait(300)
  cek('Musim & Papan Staf (mode ubah) muat 360 px', (await lebar()) <= 360, String(await lebar()))
  await foto('papan-360')
  await p.goto(`${BASE}/#/lomba?tab=juri`, { waitUntil: 'networkidle2' })
  await p.waitForSelector('[data-testid="tl-judgetape-C1"]', { timeout: 10000 }).catch(() => {})
  cek('Judge Tape dengan penanda papan muat 360 px', (await lebar()) <= 360, String(await lebar()))

  cek('nol galat konsol', errors.length === 0, errors.slice(0, 3).join(' | '))
} catch (e) {
  gagal.push('PENGECUALIAN: ' + (e?.stack ?? e))
  console.log('  ✗ PENGECUALIAN', e)
} finally {
  await browser.close()
}
console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) {
  for (const g of gagal) console.log('  ✗ ' + g)
  process.exit(1)
}
