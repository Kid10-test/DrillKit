/**
 * v2.10.1 — rundown, Google Drive, jam pulang, sesi ganda: uji peramban
 * ujung ke ujung. Google tidak pernah dipanggil sungguhan — semua permintaan
 * ke googleapis.com dicegat dan dijawab tiruan; pustaka Google (gsi/picker)
 * diblokir, persis seperti perangkat yang belum memuatnya.
 *
 *   1. Jadwal › Sesi ganda: bilah peringatan → pilih sesi dipertahankan →
 *      gabung → absensi pindah (status terkuat menang), program dialihkan.
 *   2. Hapus sesi berabsensi → modal berisi jumlah catatan (bukan konfirmasi singkat).
 *   3. Impor rundown (Tempel HTML dari Docs) → pratinjau 6 blok 17.30–20.15 →
 *      sesuaikan jam → simpan → rencana & jam sesi tersimpan.
 *   4. Pola sesi › Pola dari rundown (teks WhatsApp) → sunting → simpan.
 *   5. Pengaturan › Google Drive: pengenal salah ditandai → simpan → belum tersambung.
 *   6. Tersambung (izin tiruan): akun tampil, backup ke Drive mengunggah ke
 *      folder "DrillKit Backup"; rundown Drive yang berubah ditandai → ambil
 *      ulang → tautan diperbarui; Impor Form › Tarik isian terbaru.
 *   7. Absensi: jam pulang 19.00 beralasan + bukti → pulang awal berjatah.
 *   8. Offline: tombol Drive mati dengan keterangan; tempel tetap jalan.
 *   9. HP 360 px tanpa gulir mendatar; nol galat konsol.
 *
 * Pakai: npm run build && npx vite preview --port 4173 &
 *        BASE=http://localhost:4173 node qa/drive-rundown-e2e.mjs
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
const ABAIKAN = /favicon|Failed to load resource|net::ERR|Pustaka Google/i

const dua = (n) => String(n).padStart(2, '0')
const kini = new Date()
const hari = (n) => {
  const d = new Date(kini.getFullYear(), kini.getMonth(), kini.getDate() + n)
  return `${d.getFullYear()}-${dua(d.getMonth() + 1)}-${dua(d.getDate())}`
}

const ANGGOTA = [
  ['k1', 'Kirana Satu', 'brass'],
  ['k2', 'Kevin Dua', 'brass'],
  ['k3', 'Kiki Tiga', 'percussion'],
  ['k4', 'Koko Empat', 'guard'],
]
const SESI = [
  { id: 's_r', date: hari(2), title: 'Latsar P5' },
  { id: 'm_g', date: hari(-3), title: 'Latsar P3 (manual)', startTime: '17:30', endTime: '20:15' },
  { id: 's_g', date: hari(-3), title: 'Latsar', seriId: 'seri_x' },
  { id: 's_d', date: hari(-1), title: 'Latsar P4' },
  { id: 's_dr', date: hari(4), title: 'Latsar P6', rundownDrive: { id: 'doc_rd', nama: 'Rundown P6', mimeType: 'application/vnd.google-apps.document', diubah: '2026-01-01T00:00:00.000Z', tabel: 0, diambil: 1 } },
]
const ABSEN = [
  ['a1', 'm_g', 'k1', 'hadir'],
  ['a2', 'm_g', 'k2', 'izin'],
  ['a3', 's_g', 'k2', 'alpha'],
  ['a4', 's_g', 'k3', 'hadir'],
  ['a5', 's_d', 'k1', 'hadir'],
]
const HTML_RUNDOWN = `<meta charset="utf-8"><b>Rundown Latsar P5</b><table><tbody>
<tr><td>Waktu</td><td>Kegiatan</td><td>PJ</td><td>Tempat</td></tr>
<tr><td>17.30 – 17.40</td><td>Apel pembuka</td><td>Danlat</td><td>Lapangan</td></tr>
<tr><td>17.40 – 17.55</td><td>Maghrib</td><td></td><td>Musala</td></tr>
<tr><td>17.55 – 18.05</td><td>Pemanasan</td><td>Fisik</td><td>Lapangan</td></tr>
<tr><td>18.05 – 18.40</td><td>Tes II per saf</td><td>Danlat</td><td>Lapangan</td></tr>
<tr><td>18.40 – 20.00</td><td>Section</td><td>Pelatih seksi</td><td>Kelas</td></tr>
<tr><td>20.00 – 20.15</td><td>Apel penutup</td><td>Danlat</td><td>Lapangan</td></tr>
</tbody></table>`
const WA = '*Rundown P6*\n17.30 – 17.40 Apel pembuka\n17.40 – 17.55 Maghrib\n17.55 – 18.05 Pemanasan\n18.05 – 18.40 Drill dasar\n18.40 – 20.00 Section\n20.00 – 20.15 Apel penutup'

/* ------------------------------ Google tiruan ------------------------------ */
const google = { unggah: [], folderDibuat: 0, panggilan: [] }
const MODIF_BARU = '2026-11-20T10:00:00.000Z'
function jawabGoogle(url, method, body) {
  const u = new URL(url)
  const j = (status, data, ct = 'application/json') => ({ status, contentType: ct, body: typeof data === 'string' ? data : JSON.stringify(data), headers: { 'Access-Control-Allow-Origin': '*' } })
  google.panggilan.push(`${method} ${u.pathname}`)
  if (u.pathname.endsWith('/drive/v3/about')) return j(200, { user: { emailAddress: 'pelatih.uji@example.com', displayName: 'Pelatih Uji' } })
  if (u.pathname === '/drive/v3/files/doc_rd') return j(200, { id: 'doc_rd', name: 'Rundown P6', mimeType: 'application/vnd.google-apps.document', modifiedTime: MODIF_BARU })
  if (u.pathname === '/drive/v3/files/doc_rd/export') return j(200, HTML_RUNDOWN.replace('Tes II per saf', 'Drill dasar'), 'text/html')
  if (u.pathname === '/drive/v3/files' && method === 'GET') return j(200, { files: [] })
  if (u.pathname === '/drive/v3/files' && method === 'POST') {
    google.folderDibuat++
    return j(200, { id: 'folder_bk', webViewLink: 'https://drive.google.com/drive/folders/folder_bk' })
  }
  if (u.pathname === '/upload/drive/v3/files' && method === 'POST') {
    google.unggah.push(body ?? '')
    return j(200, { id: 'bk_1' })
  }
  if (u.pathname === '/v4/spreadsheets/sheet_izin') return j(200, { sheets: [{ properties: { title: 'Form Responses 1', index: 0 } }, { properties: { title: 'Izin untuk DrillKit', index: 1 } }] })
  if (u.pathname.startsWith('/v4/spreadsheets/sheet_izin/values/')) {
    const tab = decodeURIComponent(u.pathname.split('/values/')[1])
    const besok = new Date(kini.getFullYear(), kini.getMonth(), kini.getDate() + 2)
    const capW = `${kini.getDate()}/${kini.getMonth() + 1}/${kini.getFullYear()} 09:00:00`
    const tgl = `${besok.getDate()}/${besok.getMonth() + 1}/${besok.getFullYear()}`
    return j(200, {
      values: tab.includes('DrillKit')
        ? [['Timestamp', 'Nama lengkap', 'Tanggal latihan', 'Status', 'Kategori izin', 'Alasan', 'Upload bukti'], [capW, 'Kevin Dua', tgl, 'Izin', 'Kuliah', 'praktikum', 'https://drive.google.com/open?id=bk']]
        : [['Timestamp', 'Nama'], [capW, 'Salah tab']],
    })
  }
  return j(404, { error: { message: 'tiruan: tidak ada ' + u.pathname } })
}

try {
  const p = await browser.newPage()
  p.on('console', (m) => {
    if (m.type() === 'error' && !ABAIKAN.test(m.text())) errors.push(m.text())
  })
  p.on('pageerror', (e) => errors.push(String(e)))
  await p.setRequestInterception(true)
  p.on('request', async (r) => {
    const url = r.url()
    if (/accounts\.google\.com|apis\.google\.com/.test(url)) return r.abort()
    if (/googleapis\.com/.test(url)) {
      if (r.method() === 'OPTIONS') return r.respond({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' } })
      // Badan multipart (Blob) tidak ikut di postData(); ambil lewat CDP.
      const body = r.hasPostData() ? ((await r.fetchPostData().catch(() => undefined)) ?? r.postData()) : undefined
      return r.respond(jawabGoogle(url, r.method(), body))
    }
    r.continue()
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
  const tim = async () => (await semua('settings')).find((x) => x.key === 'team')
  const foto = async (nama) => FOTO && p.screenshot({ path: `${FOTO}/${nama}.png`, fullPage: true })
  const data = (sel, kunci) => p.$eval(sel, (e, k) => e.dataset[k], kunci).catch(() => null)
  const lebar = () => p.evaluate(() => document.documentElement.scrollWidth)
  const bukaKartu = async (id) => {
    if (await p.$(`[data-testid="kartu-${id}"]`)) return
    if (!(await p.$(`[data-testid="baris-${id}"]`)) && (await p.$('[data-testid="lihat-lewat"]'))) await klik('[data-testid="lihat-lewat"]')
    await p.waitForSelector(`[data-testid="baris-${id}"], [data-testid="kartu-${id}"]`, { timeout: 5000 })
    if (!(await p.$(`[data-testid="kartu-${id}"]`))) await p.$eval(`[data-testid="baris-${id}"]`, (e) => e.click())
    await p.waitForSelector(`[data-testid="kartu-${id}"]`, { timeout: 5000 })
  }
  const editSesi = async (id) => {
    await bukaKartu(id)
    await p.evaluate((i) => {
      const k = document.querySelector(`[data-testid="kartu-${i}"]`)
      ;[...k.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Edit').click()
    }, id)
    await p.waitForSelector('[data-testid="buka-impor-rundown"]', { timeout: 8000 })
  }
  const tempelHtml = (sel, html, teksPolos) =>
    p.$eval(
      sel,
      (el, h, t) => {
        const dt = new DataTransfer()
        dt.setData('text/html', h)
        dt.setData('text/plain', t)
        el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
      },
      html,
      teksPolos,
    )

  /* ============================== Persiapan ============================== */
  await p.goto(BASE, { waitUntil: 'networkidle2' })
  await lewatSambutan(p)
  await idb(
    (db, a) =>
      new Promise((res, rej) => {
        const tx = db.transaction(['members', 'sessions', 'attendance', 'settings'], 'readwrite')
        for (const [id, name, section] of a.anggota)
          tx.objectStore('members').put({ id, name, code: id.toUpperCase(), section, instrument: '', role: 'member', joinYear: 2026, active: 1, createdAt: 0 })
        for (const s of a.sesi) tx.objectStore('sessions').put({ type: 'latihan', startTime: '18:00', endTime: '20:00', checklist: [], createdAt: 0, ...s })
        for (const [id, sessionId, memberId, status] of a.absen) tx.objectStore('attendance').put({ id, sessionId, memberId, status })
        const g = tx.objectStore('settings').get('team')
        g.onsuccess = () => {
          const t = g.result
          t.programLatihan = [
            {
              id: 'prog_x', nama: 'Latsar Uji', mulai: a.sesi[1].date, selesai: a.sesi[4].date, hari: [], jamMulai: '18:00', jamSelesai: '20:00',
              tambahan: [], libur: [], fase: [], tonggak: [], sesiIds: ['s_g', 's_d', 's_r'], wajibIds: ['s_g', 's_d', 's_r'],
              peserta: a.anggota.map(([memberId]) => ({ memberId, bergabung: a.sesi[1].date })), aturan: { sakitMaksJam: 24 }, dibuat: 1, diubah: 1,
            },
          ]
          t.sumberForm = { izin: { id: 'sheet_izin', nama: 'Form Izin (Jawaban)' } }
          tx.objectStore('settings').put(t)
        }
        tx.oncomplete = () => res(true)
        tx.onerror = () => rej(tx.error)
      }),
    { anggota: ANGGOTA, sesi: SESI, absen: ABSEN },
  )
  await p.goto(`${BASE}/#/jadwal`, { waitUntil: 'networkidle2' })
  await p.reload({ waitUntil: 'networkidle2' })
  await wait(800)
  await klik('[data-testid="tampilan-agenda"]')

  /* ============================== 1. Sesi ganda ============================== */
  console.log('\n— Sesi ganda —')
  await p.waitForSelector('[data-testid="bilah-sesi-ganda"]', { timeout: 8000 }).catch(() => {})
  cek('bilah peringatan: 1 tanggal ganda', (await ada('[data-testid="bilah-sesi-ganda"]')) && (await teks('[data-testid="bilah-sesi-ganda"]')).startsWith('1 tanggal'))
  await klik('[data-testid="buka-sesi-ganda"]')
  await p.waitForSelector('[data-testid="modal-sesi-ganda"]')
  const isiGanda = await teks(`[data-testid="ganda-${hari(-3)}"]`)
  cek('modal: dua sesi dengan jumlah absensi', isiGanda.includes('17:30–20:15') && isiGanda.includes('18:00–20:00') && isiGanda.includes('2 absensi'), isiGanda)
  cek('usulan bawaan: milik program (seri)', await p.$eval('[data-testid="utama-s_g"]', (e) => e.checked))
  await klik('[data-testid="utama-m_g"]')
  await klik(`[data-testid="gabung-${hari(-3)}"]`)
  await wait(700)
  const sesiSesudah = await semua('sessions')
  const absSesudah = await semua('attendance')
  cek('kembaran dihapus, sesi manual dipertahankan', !sesiSesudah.some((s) => s.id === 's_g') && sesiSesudah.some((s) => s.id === 'm_g'))
  const aMg = absSesudah.filter((r) => r.sessionId === 'm_g')
  cek('absensi: k1 hadir, k2 izin (menang atas alpa), k3 hadir dipindah', aMg.length === 3 && aMg.find((r) => r.memberId === 'k2')?.status === 'izin' && aMg.find((r) => r.memberId === 'k3')?.status === 'hadir', JSON.stringify(aMg))
  cek('tidak ada catatan yatim', !absSesudah.some((r) => r.sessionId === 's_g'))
  const prog = (await tim()).programLatihan[0]
  cek('program dialihkan ke sesi manual', prog.sesiIds.includes('m_g') && !prog.sesiIds.includes('s_g') && prog.wajibIds.includes('m_g'))
  await p.waitForSelector('[data-testid="sesi-ganda-kosong"]', { timeout: 4000 }).catch(() => {})
  cek('modal: tidak ada lagi sesi ganda', await ada('[data-testid="sesi-ganda-kosong"]'))
  await p.keyboard.press('Escape')
  await wait(300)
  cek('bilah peringatan hilang', !(await ada('[data-testid="bilah-sesi-ganda"]')))

  /* ============================== 2. Hapus sesi berabsensi ============================== */
  console.log('\n— Hapus sesi berabsensi —')
  await bukaKartu('s_d')
  await klik('[data-testid="hapus-s_d"]')
  await p.waitForSelector('[data-testid="modal-hapus-berabsen"]', { timeout: 5000 }).catch(() => {})
  cek('modal penjelasan muncul (bukan konfirmasi singkat)', await ada('[data-testid="modal-hapus-berabsen"]'))
  cek('jumlah catatan disebut: 1', (await teks('[data-testid="hapus-berabsen-jumlah"]').catch(() => '')) === '1')
  cek('tanpa kembaran → saran backup', (await teks('[data-testid="modal-hapus-berabsen"]')).includes('backup'))
  await p.keyboard.press('Escape')
  await wait(300)
  cek('batal: sesi & absensi tetap', (await semua('sessions')).some((s) => s.id === 's_d') && (await semua('attendance')).some((r) => r.sessionId === 's_d'))

  /* ============================== 3. Impor rundown (tempel) ============================== */
  console.log('\n— Impor rundown: tempel dari Docs —')
  await editSesi('s_r')
  await klik('[data-testid="buka-impor-rundown"]')
  await p.waitForSelector('[data-testid="modal-impor-rundown"]', { timeout: 8000 })
  await tempelHtml('[data-testid="rundown-tempel"]', HTML_RUNDOWN, 'Waktu\tKegiatan')
  await p.waitForSelector('[data-testid="rundown-ringkas"]', { timeout: 5000 }).catch(() => {})
  const ringkas = await teks('[data-testid="rundown-ringkas"]').catch(() => '')
  cek('pratinjau: 6 blok, 2j 45m', ringkas.startsWith('6 blok'), ringkas)
  cek('pratinjau: jam rundown 17.30–20.15', (await teks('[data-testid="rundown-jam"]').catch(() => '')) === '17.30–20.15')
  cek('kolom terbaca: Jam, Kegiatan, PJ, Tempat', /Jam.*Kegiatan.*Penanggung jawab|Kegiatan/.test(await teks('[data-testid="rundown-kolom"] summary')), await teks('[data-testid="rundown-kolom"] summary'))
  cek('tawarkan sesuaikan jam sesi (18:00–20:00 → 17:30–20:15)', await p.$eval('[data-testid="rundown-sesuaikan-jam"]', (e) => e.checked).catch(() => false))
  await foto('rundown-pratinjau')
  await klik('[data-testid="rundown-terapkan"]')
  await wait(400)
  cek('modal tertutup, 6 blok di penyunting', !(await ada('[data-testid="modal-impor-rundown"]')) && (await p.$$('[data-testid="daftar-blok"] > li')).length === 6)
  await klik('[data-testid="simpan-jadwal"]')
  await wait(600)
  const sR = (await semua('sessions')).find((s) => s.id === 's_r')
  cek('tersimpan: jam 17:30–20:15', sR.startTime === '17:30' && sR.endTime === '20:15', `${sR.startTime}–${sR.endTime}`)
  cek('tersimpan: 6 blok, total 165 menit', sR.rencanaLatihan?.length === 6 && sR.rencanaLatihan.reduce((a, b) => a + b.menit, 0) === 165)
  cek('tersimpan: judul & PJ blok', sR.rencanaLatihan[0].judul === 'Apel pembuka' && sR.rencanaLatihan[3].judul.startsWith('Tes II'), JSON.stringify(sR.rencanaLatihan[0]))
  cek('tempel bukan dari Drive → tanpa tautan', !sR.rundownDrive)

  /* ============================== 4. Pola dari rundown ============================== */
  console.log('\n— Pola dari rundown (WhatsApp) —')
  await klik('[data-testid="buka-pola-sesi"]')
  await p.waitForSelector('[data-testid="modal-pola-sesi"]')
  await klik('[data-testid="pola-dari-rundown"]')
  await p.waitForSelector('[data-testid="modal-impor-rundown"]', { timeout: 8000 })
  await isi('[data-testid="rundown-tempel"]', WA)
  await p.waitForSelector('[data-testid="rundown-nama-pola"]', { timeout: 5000 }).catch(() => {})
  cek('nama pola dari judul WA', (await p.$eval('[data-testid="rundown-nama-pola"]', (e) => e.value).catch(() => '')) === 'Rundown P6')
  cek('tanpa pilihan jam sesi untuk pola', !(await ada('[data-testid="rundown-sesuaikan-jam"]')))
  await klik('[data-testid="rundown-terapkan"]')
  await p.waitForSelector('[data-testid="sunting-pola"]', { timeout: 5000 }).catch(() => {})
  cek('langsung ke penyunting pola', await ada('[data-testid="sunting-pola"]'))
  await klik('[data-testid="simpan-sunting-pola"]')
  await wait(500)
  const pola = ((await tim()).polaSesi ?? []).find((x) => x.nama === 'Rundown P6')
  cek('pola tersimpan: 6 blok, 165 menit', pola?.rencana.length === 6 && pola.rencana.reduce((a, b) => a + b.menit, 0) === 165)
  await p.keyboard.press('Escape')
  await wait(300)

  /* ============================== 5. Pengaturan › Google Drive ============================== */
  console.log('\n— Pengaturan › Google Drive —')
  await p.goto(`${BASE}/#/pengaturan`, { waitUntil: 'networkidle2' })
  await p.waitForSelector('[data-testid="kartu-google-drive"]', { timeout: 8000 })
  cek('kartu: belum diatur', (await teks('[data-testid="kartu-google-drive"]')).includes('belum diatur'))
  cek('tanpa pengenal: tidak ada tombol Sambungkan', !(await ada('[data-testid="google-sambung"]')))
  await klik('[data-testid="google-atur"]')
  await p.waitForSelector('[data-testid="modal-pengenal-google"]')
  cek('origin ditampilkan untuk didaftarkan', (await teks('[data-testid="google-origin"]')) === new URL(BASE).origin)
  await isi('[data-testid="google-client-id"]', '111-abc')
  await isi('[data-testid="google-api-key"]', 'kunci-salah')
  await isi('[data-testid="google-app-id"]', 'drillkit-uji')
  await wait(200)
  cek('pengenal salah bentuk ditandai (3)', (await p.$$('[data-testid="google-masalah"] li')).length === 3)
  await isi('[data-testid="google-client-id"]', '123456789012-uji.apps.googleusercontent.com')
  await isi('[data-testid="google-api-key"]', 'AIzaSyUjiUjiUjiUjiUjiUjiUjiUjiUjiUji')
  await isi('[data-testid="google-app-id"]', '123456789012')
  await wait(200)
  cek('pengenal benar → tanpa peringatan', !(await ada('[data-testid="google-masalah"]')))
  await klik('[data-testid="google-simpan"]')
  await wait(500)
  cek('tersimpan di pengaturan tim', (await tim()).google?.appId === '123456789012')
  cek('kartu: belum tersambung + tombol Sambungkan', (await teks('[data-testid="kartu-google-drive"]')).includes('belum tersambung') && (await ada('[data-testid="google-sambung"]')))
  await klik('[data-testid="backup-drive-aktif"]')
  await wait(300)
  cek('backup aktif tanpa izin → menunggu tersambung, tidak mengunggah', (await ada('[data-testid="backup-drive-menunggu"]')) && google.unggah.length === 0)

  /* ============================== 6. Tersambung (izin tiruan) ============================== */
  console.log('\n— Tersambung (izin tiruan) —')
  await p.evaluate(() => sessionStorage.setItem('drillkit.google.token', JSON.stringify({ akses: 'tok_uji', habis: Date.now() + 3_000_000 })))
  await p.reload({ waitUntil: 'networkidle2' })
  await p.waitForSelector('[data-testid="google-akun"]', { timeout: 8000 }).catch(() => {})
  cek('kartu: tersambung + akun Google', (await teks('[data-testid="kartu-google-drive"]').catch(() => '')).includes('tersambung') && (await teks('[data-testid="google-akun"]').catch(() => '')).includes('pelatih.uji@example.com'))
  await p.waitForFunction(() => !!JSON.parse(localStorage.getItem('drillkit.backupDrive') || '{}').at, { timeout: 10000 }).catch(() => {})
  cek('backup otomatis mengunggah sendiri sesudah tersambung', google.unggah.length >= 1 && google.folderDibuat === 1, `${google.unggah.length} unggah, ${google.folderDibuat} folder`)
  const isiUnggah = google.unggah[0] ?? ''
  cek('unggahan: berkas JSON harian di folder DrillKit Backup', /DrillKit - BACKUP LENGKAP - \d{4}-\d{2}-\d{2}\.json/.test(isiUnggah) && isiUnggah.includes('folder_bk') && isiUnggah.includes('"members"'))
  const n0 = google.unggah.length
  await klik('[data-testid="backup-drive-sekarang"]')
  await wait(1200)
  cek('Backup sekarang → unggah lagi', google.unggah.length === n0 + 1)

  // Rundown Drive yang berubah
  await p.goto(`${BASE}/#/jadwal`, { waitUntil: 'networkidle2' })
  await klik('[data-testid="tampilan-agenda"]')
  await editSesi('s_dr')
  await p.waitForSelector('[data-testid="rundown-drive-berubah"]', { timeout: 8000 }).catch(() => {})
  cek('tautan rundown Drive tampil & ditandai berubah', (await teks('[data-testid="tautan-rundown"]')).includes('Rundown P6') && (await ada('[data-testid="rundown-drive-berubah"]')))
  await klik('[data-testid="rundown-ambil-ulang-sesi"]')
  await p.waitForSelector('[data-testid="rundown-ambil-ulang"]', { timeout: 8000 })
  await klik('[data-testid="rundown-ambil-ulang"]')
  await p.waitForSelector('[data-testid="rundown-ringkas"]', { timeout: 8000 }).catch(() => {})
  cek('ambil ulang: 6 blok dari Docs', (await teks('[data-testid="rundown-ringkas"]').catch(() => '')).startsWith('6 blok'))
  cek('ambil ulang: perubahan disebut', (await teks('[data-testid="rundown-berubah"]').catch(() => '')).includes('sudah diubah'))
  await klik('[data-testid="rundown-terapkan"]')
  await wait(300)
  cek('tanda "berubah" hilang sesudah diterapkan', !(await ada('[data-testid="rundown-drive-berubah"]')))
  await klik('[data-testid="simpan-jadwal"]')
  await wait(600)
  const sDr = (await semua('sessions')).find((s) => s.id === 's_dr')
  cek('tautan diperbarui (modifiedTime baru) & rencana berisi "Drill dasar"', sDr.rundownDrive?.diubah === MODIF_BARU && sDr.rencanaLatihan?.some((b) => b.judul === 'Drill dasar'))

  // Tarik isian Form
  await p.goto(`${BASE}/#/absensi`, { waitUntil: 'networkidle2' })
  await klik('[data-testid="buka-impor-gform"]')
  await p.waitForSelector('[data-testid="modal-impor-gform"]', { timeout: 8000 })
  await klik('[data-testid="gform-jenis-izin"]')
  await klik('[data-testid="gform-tarik"]')
  await p.waitForSelector('[data-testid="gform-ringkas"]', { timeout: 8000 }).catch(() => {})
  await wait(400)
  cek('tarik: tab "Izin untuk DrillKit" dipilih sendiri', (await teks('[data-testid="gform-drive"]')).includes('Izin untuk DrillKit'))
  cek('tarik: 1 izin baru siap diterapkan', (await teks('[data-testid="gform-jumlah-tambah"]').catch(() => '')).includes('1'))
  cek('tab diingat di pengaturan', (await tim()).sumberForm?.izin?.tab === 'Izin untuk DrillKit')
  await klik('[data-testid="gform-terapkan"]')
  await wait(500)
  const izinK2 = (await semua('attendance')).find((r) => r.sessionId === 's_r' && r.memberId === 'k2')
  cek('izin tersimpan dengan kategori & bukti', izinK2?.status === 'izin' && izinK2.kategoriIzin === 'kuliah' && izinK2.bukti?.includes('open?id='))

  /* ============================== 7. Jam pulang ============================== */
  console.log('\n— Absensi: jam pulang —')
  await p.waitForSelector('select[data-kiosk-allow]', { timeout: 10000 })
  await p.select('select[data-kiosk-allow]', 's_d')
  await wait(500)
  await klik('[data-testid="datang-k1"]')
  await p.waitForSelector('[data-testid="modal-datang"]')
  await isi('[data-testid="pulang-jam"]', '19:00')
  await wait(100)
  cek('waktu ikut: 60 menit · pulang awal', (await teks('[data-testid="datang-ikut"]')).includes('60 menit') && (await teks('[data-testid="datang-ikut"]')).includes('pulang awal'))
  cek('tanpa alasan → tidak dihitung (pulang awal)', (await teks('[data-testid="datang-hasil"]')).includes('pulang awal'))
  await isi('[data-testid="datang-alasan"]', 'kontrol ke dokter')
  await klik('[data-testid="bukti-ada"]')
  await wait(100)
  cek('alasan + bukti → pulang awal berjatah', (await teks('[data-testid="datang-hasil"]')).startsWith('Pulang awal berjatah'))
  await isi('[data-testid="pulang-jam"]', '18:50')
  await wait(100)
  cek('ikut < 60′ → tidak dihitung (waktu ikut kurang)', (await teks('[data-testid="datang-hasil"]')).includes('waktu ikut'))
  await isi('[data-testid="pulang-jam"]', '19:00')
  await klik('[data-testid="datang-simpan"]')
  await wait(400)
  cek('chip: pulang 19.00 · jatah', (await data('[data-testid="datang-k1"]', 'pulang')) === 'awal' && (await teks('[data-testid="datang-k1"]')).includes('pulang 19.00'))
  const rK1 = (await semua('attendance')).find((r) => r.sessionId === 's_d' && r.memberId === 'k1')
  cek('tersimpan: pulangAt', rK1?.pulangAt === new Date(`${hari(-1)}T19:00`).getTime())

  // Jam inti: sesi 17.30–20.15, pra-latihan 30 + penutup 15 → dihitung 18.00–20.00.
  await idb(
    (db) =>
      new Promise((res) => {
        const tx = db.transaction(['sessions', 'settings'], 'readwrite')
        const gs = tx.objectStore('sessions').get('s_d')
        gs.onsuccess = () => tx.objectStore('sessions').put({ ...gs.result, startTime: '17:30', endTime: '20:15' })
        const g = tx.objectStore('settings').get('team')
        g.onsuccess = () => {
          const t = g.result
          t.programLatihan[0].aturan = { ...t.programLatihan[0].aturan, praMenit: 30, penutupMenit: 15 }
          tx.objectStore('settings').put(t)
        }
        tx.oncomplete = () => res(true)
      }),
  )
  await p.reload({ waitUntil: 'networkidle2' })
  await p.waitForSelector('select[data-kiosk-allow]', { timeout: 10000 })
  await p.select('select[data-kiosk-allow]', 's_d')
  await wait(500)
  await klik('[data-testid="datang-k1"]')
  await p.waitForSelector('[data-testid="modal-datang"]')
  // Aturan program dibaca lewat live query; di runner yang sibuk teks hasil
  // bisa muncul sesaat setelah modal terbuka. Tunggu, jangan baca seketika.
  await p
    .waitForFunction(
      () =>
        (document.querySelector('[data-testid="datang-inti"]')?.textContent ?? '').includes('18.00') &&
        /\S/.test(document.querySelector('[data-testid="datang-hasil"]')?.textContent ?? ''),
      { timeout: 10000, polling: 200 },
    )
    .catch(() => {})
  cek('jam inti disebut: 18.00–20.00', (await teks('[data-testid="datang-inti"]').catch(() => '')).includes('18.00–20.00'))
  cek('isian pulang: "sebelum 20.00" (bukan 20.15)', (await p.$eval('[data-testid="pulang-jam"]', (e) => e.closest('label').textContent)).includes('sebelum 20.00'))
  cek('pulang 19.00 tetap berjatah (ikut 60′ dari 18.00)', (await teks('[data-testid="datang-hasil"]')).startsWith('Pulang awal berjatah'))
  await isi('[data-testid="datang-jam"]', '17:30')
  await isi('[data-testid="pulang-jam"]', '18:55')
  await wait(100)
  cek('datang 17.30 pulang 18.55 → ikut 55′, tidak dihitung', (await teks('[data-testid="datang-ikut"]')).includes('55 menit') && (await teks('[data-testid="datang-hasil"]')).includes('waktu ikut'))
  await p.keyboard.press('Escape')
  await wait(300)

  /* ============================== 8. Offline ============================== */
  console.log('\n— Offline —')
  await p.goto(`${BASE}/#/pengaturan`, { waitUntil: 'networkidle2' })
  await p.waitForSelector('[data-testid="kartu-google-drive"]')
  await p.setOfflineMode(true)
  await wait(500)
  cek('kartu: butuh internet, tombol Drive mati', (await teks('[data-testid="kartu-google-drive"]')).includes('butuh internet') && (await p.$eval('[data-testid="pulihkan-dari-drive"]', (e) => e.disabled)))
  await p.goto(`${BASE}/#/jadwal`, { waitUntil: 'domcontentloaded' }).catch(() => {})
  await wait(800)
  await klik('[data-testid="tampilan-agenda"]')
  await editSesi('s_r')
  await klik('[data-testid="buka-impor-rundown"]')
  await p.waitForSelector('[data-testid="modal-impor-rundown"]', { timeout: 8000 })
  await klik('[data-testid="rundown-sumber-drive"]')
  cek('rundown › Drive: offline dijelaskan', await ada('[data-testid="rundown-drive-offline"]'))
  await klik('[data-testid="rundown-sumber-tempel"]')
  await isi('[data-testid="rundown-tempel"]', WA)
  await wait(200)
  cek('tempel tetap jalan tanpa internet', (await teks('[data-testid="rundown-ringkas"]').catch(() => '')).startsWith('6 blok'))
  cek('rencana sudah ada → pilihan ganti / tambah', (await ada('[data-testid="rundown-mode-ganti"]')) && (await ada('[data-testid="rundown-mode-tambah"]')))
  await p.keyboard.press('Escape')
  await p.keyboard.press('Escape')
  await p.setOfflineMode(false)

  /* ============================== 9. HP 360 px ============================== */
  console.log('\n— HP 360 px —')
  await p.setViewport({ width: 360, height: 780 })
  await p.goto(`${BASE}/#/pengaturan`, { waitUntil: 'networkidle2' })
  await wait(500)
  cek('Pengaturan 360 px tanpa gulir mendatar', (await lebar()) <= 362, String(await lebar()))
  await p.goto(`${BASE}/#/jadwal`, { waitUntil: 'networkidle2' })
  await klik('[data-testid="tampilan-agenda"]')
  await editSesi('s_r')
  await klik('[data-testid="buka-impor-rundown"]')
  await isi('[data-testid="rundown-tempel"]', WA)
  await wait(300)
  cek('modal impor rundown 360 px tanpa gulir mendatar', (await lebar()) <= 362, String(await lebar()))
  await foto('rundown-360')

  console.log('\n— Konsol —')
  cek('nol galat konsol', errors.length === 0, errors.slice(0, 3).join(' | '))
} catch (e) {
  gagal.push('mogok: ' + (e?.stack ?? e))
  console.log('  ✗ mogok: ' + (e?.stack ?? e))
} finally {
  await browser.close()
}

console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) process.exit(1)
