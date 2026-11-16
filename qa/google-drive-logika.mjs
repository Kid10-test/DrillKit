/**
 * v2.10.1 — lapisan Google Drive (lib/googleDrive.ts) dan backup ke Drive
 * (lib/backupDrive.ts), diuji dengan `fetch` tiruan: tidak ada panggilan ke
 * Google sungguhan. Yang dijaga: konfigurasi & pemeriksaan pengenal, izin
 * (token) per tab, pemetaan galat ke kalimat yang bisa ditindaklanjuti,
 * ambil isi rundown per jenis berkas, Sheet → CSV, folder & rotasi backup,
 * dan aturan "unggah hanya bila berubah".
 *
 * Jalankan: bash qa/bangun-logika.sh && node qa/google-drive-logika.mjs
 */
let lulus = 0
const gagal = []
const cek = (nama, syarat, ket = '') => {
  if (syarat) {
    lulus++
    console.log('  ✓ ' + nama)
  } else {
    gagal.push(nama)
    console.log('  ✗ ' + nama + (ket ? ' — ' + ket : ''))
  }
}

/* ------------------------------- lingkungan ------------------------------- */
const simpan = () => {
  const m = new Map()
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _m: m }
}
globalThis.sessionStorage = simpan()
globalThis.localStorage = simpan()
let onLine = true
Object.defineProperty(globalThis, 'navigator', { value: { get onLine() { return onLine } }, configurable: true })

/** fetch tiruan: daftar [cocok(url, init) → jawaban]. Semua panggilan dicatat. */
let rute = []
const panggilan = []
const jawab = (status, body, headers = {}) =>
  status === 204
    ? new Response(null, { status, headers })
    : new Response(typeof body === 'string' || body instanceof Uint8Array ? body : JSON.stringify(body), { status, headers })
globalThis.fetch = async (url, init = {}) => {
  panggilan.push({ url: String(url), method: init.method ?? 'GET', init })
  for (const [cocok, f] of rute) if (cocok(String(url), init)) return f(String(url), init)
  return jawab(500, { error: { message: 'rute tiruan tidak ada: ' + url } })
}
const ada = (s) => (u) => u.includes(s)

const g = await import('/tmp/googleDrive.mjs')
const bd = await import('/tmp/backupDrive.mjs')
const { bacaCsvForm } = await import('/tmp/imporGForm.mjs')

console.log('== konfigurasi ==')
cek('tanpa pengenal → null', g.konfigGoogle(undefined) === null && g.konfigGoogle({ clientId: 'x' }) === null)
const K = g.konfigGoogle({ clientId: ' 123456789012-abc.apps.googleusercontent.com ', apiKey: 'AIzaSyA1234567890123456789012345', appId: '123456789012' })
cek('pengenal lengkap dirapikan', K && K.clientId === '123456789012-abc.apps.googleusercontent.com' && K.appId === '123456789012')
cek('periksa: pengenal benar → tanpa masalah', g.periksaKonfig({ clientId: K.clientId, apiKey: K.apiKey, appId: K.appId }).length === 0)
const salah = g.periksaKonfig({ clientId: '99-abc.apps.googleusercontent.com', apiKey: 'kunci', appId: 'drillkit-123' })
cek('periksa: API key, nomor proyek salah bentuk', salah.some((m) => m.includes('AIza')) && salah.some((m) => m.includes('angka')), salah.join(' | '))
cek('periksa: Client ID bukan googleusercontent', g.periksaKonfig({ clientId: 'abc' }).length === 1)
cek('periksa: angka Client ID ≠ nomor proyek', g.periksaKonfig({ clientId: '111111-a.apps.googleusercontent.com', appId: '222222' }).some((m) => m.includes('nomor proyek')))
cek('scope hanya drive.file', g.SCOPE_DRIVE === 'https://www.googleapis.com/auth/drive.file')

console.log('== izin per tab ==')
cek('belum tersambung', !g.tersambung() && g.habisPada() === 0)
let galat = null
try {
  await g.infoBerkas('f1')
} catch (e) {
  galat = e
}
cek('tanpa izin: galat kedaluwarsa, tidak memanggil Google', galat instanceof g.GalatGoogle && galat.kode === 'kedaluwarsa' && panggilan.length === 0)
sessionStorage.setItem(g.KUNCI_TOKEN, JSON.stringify({ akses: 'tok', habis: Date.now() + 3_000_000 }))
cek('token di sessionStorage → tersambung', g.tersambung() && g.habisPada() > Date.now())

console.log('== galat ==')
const coba = async (f) => {
  try {
    await f()
    return null
  } catch (e) {
    return e
  }
}
rute = [[ada('/files/hilang'), () => jawab(404, { error: { message: 'File not found' } })]]
let e = await coba(() => g.infoBerkas('hilang'))
cek('404 → tidak-ada', e?.kode === 'tidak-ada' && e.message.includes('tidak ditemukan'))
rute = [[ada('/files/x'), () => jawab(403, { error: { status: 'PERMISSION_DENIED', message: 'Google Drive API has not been used in project 1 before or it is disabled.' } })]]
e = await coba(() => g.infoBerkas('x'))
cek('API belum diaktifkan → arahkan ke panduan', e?.kode === 'api' && e.message.includes('panduan'))
cek('pesanGalat: GalatGoogle apa adanya, Error lain berawalan', g.pesanGalat(e) === e.message && g.pesanGalat(new Error('x')) === 'Google Drive: x')
onLine = false
e = await coba(() => g.infoBerkas('x'))
cek('offline → galat offline tanpa memanggil', e?.kode === 'offline')
onLine = true
cek('Authorization: Bearer token', panggilan.at(-1).init.headers.Authorization === 'Bearer tok')
rute = [[ada('/files/y'), () => jawab(401, {})]]
e = await coba(() => g.infoBerkas('y'))
cek('401 → kedaluwarsa & izin dilupakan', e?.kode === 'kedaluwarsa' && !g.tersambung() && sessionStorage.getItem(g.KUNCI_TOKEN) === null)
sessionStorage.setItem(g.KUNCI_TOKEN, JSON.stringify({ akses: 'tok2', habis: Date.now() + 3_000_000 }))

console.log('== ambil isi rundown ==')
rute = [
  [ada('/files/doc1/export'), (u) => jawab(200, u.includes('mimeType=text%2Fhtml') ? '<table><tr><td>17.30</td></tr></table>' : 'salah')],
  [ada('/spreadsheets/sh1?fields'), () => jawab(200, { sheets: [{ properties: { title: 'P4', index: 1 } }, { properties: { title: 'P3', index: 0 } }] })],
  [ada('/spreadsheets/sh1/values/'), (u) => jawab(200, { values: [['Jam', 'Kegiatan'], ['17.30', u.includes(encodeURIComponent("'P4'")) ? 'Apel P4' : 'Apel P3']] })],
  [ada('/files/dx1?alt=media'), () => jawab(200, new Uint8Array([0x50, 0x4b, 3, 4]))],
  [ada('/files/tx1?alt=media'), () => jawab(200, '17.30 – 17.40 Apel')],
]
const iDoc = await g.ambilIsiRundown({ id: 'doc1', name: 'Rundown', mimeType: g.MIME.docs })
cek('Docs → ekspor HTML', iDoc.jenis === 'html' && iDoc.html.includes('<table>'))
const iSh = await g.ambilIsiRundown({ id: 'sh1', name: 'R', mimeType: g.MIME.sheets })
cek('Sheets → tab pertama menurut urutan (P3) + daftar tab', iSh.jenis === 'sheet' && iSh.tab === 'P3' && iSh.tabs.join() === 'P3,P4' && iSh.nilai[1][1] === 'Apel P3')
const iSh2 = await g.ambilIsiRundown({ id: 'sh1', name: 'R', mimeType: g.MIME.sheets }, 'P4')
cek('Sheets → tab pilihan', iSh2.tab === 'P4' && iSh2.nilai[1][1] === 'Apel P4')
const iDx = await g.ambilIsiRundown({ id: 'dx1', name: 'r.docx', mimeType: g.MIME.docx })
cek('.docx → bita mentah', iDx.jenis === 'docx' && iDx.bita[0] === 0x50 && iDx.bita.length === 4)
const iTx = await g.ambilIsiRundown({ id: 'tx1', name: 'r.txt', mimeType: 'text/plain' })
cek('.txt → teks', iTx.jenis === 'teks' && iTx.teks.startsWith('17.30'))

console.log('== Sheet jawaban Form → CSV ==')
cek('keCsv: kutip koma, kutip ganda, baris baru; lebar seragam', g.keCsv([['a', 'b,c'], ['he said "hi"'], ['x\ny', '', 'z']]) === 'a,"b,c",\n"he said ""hi""",,\n"x\ny",,z')
const balik = bacaCsvForm(g.keCsv([['Timestamp', 'Nama', 'Alasan'], ['18/11/2026 20:00:00', 'Budi', 'praktikum, lalu "rapat"\nlanjut']]))
cek('keCsv ↔ bacaCsvForm pulang-pergi', balik.length === 2 && balik[1][2] === 'praktikum, lalu "rapat"\nlanjut')
rute = [
  [ada('/spreadsheets/f1?fields'), () => jawab(200, { sheets: [{ properties: { title: 'Form Responses 1', index: 0 } }, { properties: { title: 'Izin untuk DrillKit', index: 1 } }] })],
  [ada('/spreadsheets/f1/values/'), (u) => jawab(200, { values: u.includes('DrillKit') ? [['Nama'], ['Budi']] : [['Nama', 'Status'], ['Budi', 'Izin']] })],
]
const c1 = await g.ambilCsvForm({ id: 'f1', mimeType: g.MIME.sheets })
cek('ambilCsvForm: tab pertama + daftar tab', c1.tab === 'Form Responses 1' && c1.tabs.length === 2 && c1.teks === 'Nama,Status\nBudi,Izin')
const c2 = await g.ambilCsvForm({ id: 'f1', mimeType: g.MIME.sheets }, 'Izin untuk DrillKit')
cek('ambilCsvForm: tab pilihan', c2.tab === 'Izin untuk DrillKit' && c2.teks === 'Nama\nBudi')
const c3 = await g.ambilCsvForm({ id: 'f1', mimeType: g.MIME.sheets }, 'tab yang sudah dihapus')
cek('ambilCsvForm: tab hilang → kembali ke tab pertama', c3.tab === 'Form Responses 1')

console.log('== folder & rotasi backup ==')
let dibuat = 0
rute = [
  [(u) => u.includes('/files/lama?'), () => jawab(200, { id: 'lama', trashed: true })],
  [(u, i) => u.includes('/files?q=') && u.includes('folder'), () => jawab(200, { files: [] })],
  [(u, i) => i.method === 'POST' && u.includes('/drive/v3/files?fields'), (u, i) => (dibuat++, jawab(200, { id: 'folderBaru', webViewLink: 'https://drive/f', name: JSON.parse(i.body).name }))],
]
const f = await g.folderBackup('lama')
cek('folder lama di sampah → cari → buat baru "DrillKit Backup"', f.id === 'folderBaru' && dibuat === 1 && JSON.parse(panggilan.at(-1).init.body).name === 'DrillKit Backup')
rute = [[(u) => u.includes('/files/ok?'), () => jawab(200, { id: 'ok', trashed: false, webViewLink: 'L' })]]
cek('folder lama masih ada → dipakai', (await g.folderBackup('ok')).id === 'ok')

const nama = (d) => `DrillKit - BACKUP LENGKAP - 2026-11-${String(d).padStart(2, '0')}.json`
let isiFolder = Array.from({ length: 15 }, (_, i) => ({ id: 'b' + (i + 1), name: nama(i + 1), mimeType: 'application/json' }))
isiFolder.push({ id: 'lain', name: 'catatan saya.json', mimeType: 'application/json' })
const dihapus = []
let unggahan = null
rute = [
  [(u, i) => u.includes('/files?q=') && (i.method ?? 'GET') === 'GET', () => jawab(200, { files: [...isiFolder].reverse() })],
  [ada('/upload/drive/v3/files'), (u, i) => {
    unggahan = { u, method: i.method }
    if (i.method === 'POST') isiFolder.push({ id: 'b16', name: nama(16), mimeType: 'application/json' })
    return jawab(200, { id: i.method === 'PATCH' ? u.match(/files\/([^?]+)/)[1] : 'b16' })
  }],
  [(u, i) => i.method === 'DELETE', (u) => {
    const id = u.match(/files\/([^?]+)/)[1]
    dihapus.push(id)
    isiFolder = isiFolder.filter((x) => x.id !== id)
    return jawab(204, '')
  }],
]
const u1 = await g.unggahBackup('folderBaru', nama(16), '{"a":1}')
cek('berkas hari baru → POST multipart', unggahan.method === 'POST' && unggahan.u.includes('uploadType=multipart'))
cek('rotasi: 16 berkas → 2 tertua dibuang, berkas lain tidak disentuh', u1.dibuang === 2 && dihapus.join() === 'b2,b1' && isiFolder.some((x) => x.id === 'lain'), dihapus.join())
const u2 = await g.unggahBackup('folderBaru', nama(16), '{"a":2}')
cek('berkas hari yang sama → PATCH (ditimpa), tanpa rotasi', unggahan.method === 'PATCH' && unggahan.u.includes('/files/b16') && u2.dibuang === 0)
const meta = await (async () => {
  const body = panggilan.filter((p) => p.url.includes('/upload/')).at(-1).init.body
  return await body.text()
})()
cek('PATCH tidak memindah folder (tanpa parents)', meta.includes('"name"') && !meta.includes('parents'))

console.log('== backup otomatis ==')
cek('sidik: sama untuk isi sama, beda untuk isi beda', bd.sidikTeks('abc') === bd.sidikTeks('abc') && bd.sidikTeks('abc') !== bd.sidikTeks('abd'))
cek('cap waktu ekspor diabaikan', bd.sidikTeks(bd.tanpaCapWaktu('{"exportedAt": 123,"x":1}')) === bd.sidikTeks(bd.tanpaCapWaktu('{"exportedAt": 999,"x":1}')))
cek('status awal: nonaktif', bd.bacaStatusBackupDrive().aktif === false)
cek('nonaktif → tidak berjalan', (await bd.backupKeDrive(undefined)).hasil === 'nonaktif')
bd.tulisStatusBackupDrive({ aktif: true })
cek('status tersimpan per perangkat (localStorage)', bd.bacaStatusBackupDrive().aktif === true && localStorage.getItem('drillkit.backupDrive').includes('true'))
cek('aktif tanpa pengenal → belum-diatur', (await bd.backupKeDrive(undefined)).hasil === 'belum-diatur')
const KT = { clientId: K.clientId, apiKey: K.apiKey, appId: K.appId }
onLine = false
cek('offline → offline', (await bd.backupKeDrive(KT)).hasil === 'offline')
onLine = true
sessionStorage.removeItem(g.KUNCI_TOKEN)
// token di memori modul masih ada; buat kedaluwarsa lewat 401.
rute = [[() => true, () => jawab(401, {})]]
await coba(() => g.infoBerkas('z'))
const jumlahSebelum = panggilan.length
cek('izin habis → perlu-sambung, tidak membuka jendela Google', (await bd.backupKeDrive(KT)).hasil === 'perlu-sambung' && panggilan.length === jumlahSebelum)
sessionStorage.setItem(g.KUNCI_TOKEN, JSON.stringify({ akses: 'tok3', habis: Date.now() + 3_000_000 }))
bd.tulisStatusBackupDrive({ at: Date.now() - 60_000 })
cek('baru saja diunggah (< jeda) → sama, tanpa membangun backup', (await bd.backupKeDrive(KT)).hasil === 'sama' && panggilan.length === jumlahSebelum)
cek('jeda backup otomatis 10 menit', bd.JEDA_BACKUP_DRIVE_MS === 600_000)

console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) process.exit(1)
