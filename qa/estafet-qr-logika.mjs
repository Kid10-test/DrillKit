/**
 * Uji murni #30 — Estafet QR berantai tanpa sinyal & Web Share:
 *  1. Base45 (RFC 9285): vektor resmi, bolak-balik acak, tolak masukan tak sah;
 *  2. kemas → bingkai alfanumerik QR, mampat deflate-raw hanya bila mengecil;
 *  3. penampung: urutan acak, dobel, bingkai buram (CRC), kiriman lain, QR lain;
 *  4. rakit: CRC32 isi asli, belum lengkap, campuran dua kiriman bersesi sama;
 *  5. batas ukuran & kapasitas QR (pustaka `qrcode`: mode alphanumeric, versi);
 *  6. bagikanBerkas: dukungan, dibagikan / batal / gagal / tak-didukung.
 *
 * Pakai: bash qa/bangun-logika.sh && node qa/estafet-qr-logika.mjs
 */
import QRCode from 'qrcode'
import {
  AWALAN_ESTAFET,
  MAKS_BINGKAI,
  UKURAN_BINGKAI,
  apakahAlfanumerikQr,
  apakahBingkaiEstafet,
  bacaBingkai,
  bingkaiKurang,
  dariBase45,
  detikPutaran,
  formatUkuran,
  kemasEstafet,
  keBase45,
  lengkap,
  penampungBaru,
  persenEstafet,
  rakitEstafet,
  tampung,
} from '/tmp/estafetQr.mjs'
import { bagikanBerkas, bisaBagikanBerkas, mimeDariNama } from '/tmp/bagikanBerkas.mjs'

let lulus = 0
let gagal = 0
function cek(nama, kondisi, info = '') {
  if (kondisi) {
    lulus++
    console.log(`  ✓ ${nama}`)
  } else {
    gagal++
    console.log(`  ✗ ${nama} ${info}`)
  }
}

const enc = new TextEncoder()
const dec = new TextDecoder()
const sama = (a, b) => a.length === b.length && a.every((x, i) => x === b[i])

// PRNG deterministik
let benih = 12345
const acak = () => {
  // xorshift32 — cukup acak supaya tidak termampatkan
  benih ^= benih << 13
  benih ^= benih >>> 17
  benih ^= benih << 5
  return (benih >>> 0) / 2 ** 32
}
const bitaAcak = (n) => Uint8Array.from({ length: n }, () => Math.floor(acak() * 256))
function kocok(arr) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(acak() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

console.log('1. Base45 (RFC 9285)')
cek('"AB" → "BB8"', keBase45(enc.encode('AB')) === 'BB8')
cek('"Hello!!" → "%69 VD92EX0"', keBase45(enc.encode('Hello!!')) === '%69 VD92EX0')
cek('"base-45" → "UJCLQE7W581"', keBase45(enc.encode('base-45')) === 'UJCLQE7W581')
cek('"ietf!" → "QED8WEX0"', keBase45(enc.encode('ietf!')) === 'QED8WEX0')
cek('urai "QED8WEX0" → "ietf!"', dec.decode(dariBase45('QED8WEX0')) === 'ietf!')
cek('tolak "GGW" (> 65535)', dariBase45('GGW') === null)
cek('tolak panjang sisa 1', dariBase45('ABCD') === null)
cek('tolak huruf kecil', dariBase45('bb8') === null)
let semuaBolakBalik = true
for (const n of [0, 1, 2, 3, 7, 64, 255, 700, 1001]) {
  const b = bitaAcak(n)
  const s = keBase45(b)
  if (!apakahAlfanumerikQr(s) || !sama(dariBase45(s), b)) semuaBolakBalik = false
}
cek('bolak-balik acak 0–1001 bita, semua alfanumerik QR', semuaBolakBalik)

console.log('2. Kemas')
const anggota = Array.from({ length: 120 }, (_, i) => ({
  id: `m${i}`,
  token: Math.floor(acak() * 2 ** 32).toString(36) + Math.floor(acak() * 2 ** 32).toString(36),
  name: `Anggota Nomor ${i}`,
  section: ['Brass', 'Battery', 'Colorguard'][i % 3],
  hadir: i % 4 !== 0,
}))
const teksJson = JSON.stringify({ format: 'drillkit-data', versi: 1, members: anggota }, null, 2)
const isiJson = enc.encode(teksJson)
const k1 = await kemasEstafet('setoran-seksi-brass.json', isiJson, { sesi: 'ab12', mime: 'application/json' })
cek('kemas ok', k1.ok, JSON.stringify(k1))
const kir = k1.kiriman
cek('sesi dinormalkan huruf besar', kir.sesi === 'AB12')
cek('JSON dimampatkan deflate-raw', kir.metode === 'deflate-raw' && kir.ukuranKirim < kir.ukuranAsli / 2, `${kir.ukuranKirim}/${kir.ukuranAsli}`)
cek('jumlah bingkai = ceil(kirim/700)', kir.bingkai.length === Math.ceil(kir.ukuranKirim / UKURAN_BINGKAI.besar))
cek('semua bingkai alfanumerik QR', kir.bingkai.every(apakahAlfanumerikQr))
cek(
  'tajuk DK1/SESI/I/N/ (base36)',
  kir.bingkai.every((b, i) => b.startsWith(`${AWALAN_ESTAFET}/AB12/${i.toString(36).toUpperCase()}/${kir.bingkai.length.toString(36).toUpperCase()}/`)),
)
cek('apakahBingkaiEstafet', apakahBingkaiEstafet(kir.bingkai[0]) && !apakahBingkaiEstafet('M-12345'))

const zipPalsu = bitaAcak(5000)
const k2 = await kemasEstafet('paket.zip', zipPalsu, { sesi: 'Z1' })
cek('isi acak (ZIP) tetap mentah', k2.ok && k2.kiriman.metode === 'mentah')
const k3 = await kemasEstafet('a.json', isiJson, { ukuranBingkai: UKURAN_BINGKAI.kecil })
cek('ukuran "kecil" ≈ 2× bingkai', k3.ok && k3.kiriman.bingkai.length >= kir.bingkai.length * 2 - 1)
cek('sesi acak 4 karakter', k3.ok && /^[0-9A-Z]{4}$/.test(k3.kiriman.sesi))
const k4 = await kemasEstafet('../../jahat/\u0001nama.json', enc.encode('{}'), { sesi: 'X' })
cek('nama berkas tanpa jalur/kontrol', k4.ok && k4.kiriman.nama === 'nama.json', k4.kiriman?.nama)
const besar = bitaAcak(MAKS_BINGKAI * UKURAN_BINGKAI.besar + 10)
const k5 = await kemasEstafet('besar.zip', besar)
cek('tolak > MAKS_BINGKAI dengan jumlah perlu', !k5.ok && k5.perluBingkai > MAKS_BINGKAI && /Bagikan langsung/.test(k5.alasan))

console.log('3. Bingkai & penampung')
const b0 = bacaBingkai(kir.bingkai[0])
cek('urai bingkai 0', b0.ok && b0.bingkai.indeks === 0 && b0.bingkai.jumlah === kir.bingkai.length && b0.bingkai.sesi === 'AB12')
const adaGaringMiring = k2.kiriman.bingkai.find((b) => b.split('/').slice(4).join('/').includes('/'))
cek('bingkai dengan "/" di dalam Base45 tetap terurai', !!adaGaringMiring && bacaBingkai(adaGaringMiring).ok)
const rusak = kir.bingkai[1].slice(0, -3) + (kir.bingkai[1].endsWith('A') ? 'B' : 'A') + kir.bingkai[1].slice(-2)
cek('bingkai buram → rusak (CRC)', !bacaBingkai(rusak).ok && bacaBingkai(rusak).galat === 'rusak')
cek('QR lain → bukan', bacaBingkai('https://contoh.id').galat === 'bukan')
cek('indeks ≥ jumlah → rusak', bacaBingkai('DK1/AB12/5/3/BB8').galat === 'rusak')

let p = penampungBaru()
const urutan = kocok([...kir.bingkai, ...kir.bingkai.slice(0, 3)])
let hitung = { baru: 0, dobel: 0, rusak: 0, asing: 0, bukan: 0 }
const sisip = (teks) => {
  const r = tampung(p, teks)
  p = r.p
  hitung[r.hasil]++
}
sisip('M-ANGGOTA-123') // kartu absensi
sisip(rusak)
sisip(k2.kiriman.bingkai[0]) // kiriman lain belum bisa mengambil alih? (penampung masih kosong → sesi Z1)
// Penampung yang masih kosong mengikuti bingkai sah pertama; mulai ulang supaya
// skenario "kiriman lain diabaikan" benar-benar teruji setelah sesi terkunci.
p = penampungBaru()
const tengah = Math.floor(urutan.length / 2)
for (const t of urutan.slice(0, tengah)) sisip(t)
sisip(k2.kiriman.bingkai[1])
sisip(k2.kiriman.bingkai[2])
cek('belum lengkap di tengah jalan', !lengkap(p) && persenEstafet(p) > 0 && persenEstafet(p) < 100)
cek('bingkaiKurang konsisten', bingkaiKurang(p).length === p.jumlah - p.diterima)
for (const t of urutan.slice(tengah)) sisip(t)
cek('lengkap setelah semua bingkai (urutan acak)', lengkap(p) && persenEstafet(p) === 100)
cek('dobel dihitung', p.dobel === 3, String(p.dobel))
cek('kiriman lain diabaikan', p.asing === 2, String(p.asing))
cek('QR lain tidak menambah apa pun', hitung.bukan === 1)
const r1 = await rakitEstafet(p)
cek('rakit: isi identik', r1.ok && sama(r1.isi, isiJson))
cek('rakit: nama & mime', r1.ok && r1.nama === 'setoran-seksi-brass.json' && r1.mime === 'application/json')

let pz = penampungBaru()
for (const t of kocok(k2.kiriman.bingkai)) pz = tampung(pz, t).p
const r2 = await rakitEstafet(pz)
cek('rakit mentah (ZIP) identik', r2.ok && sama(r2.isi, zipPalsu))

const rKurang = await rakitEstafet(tampung(penampungBaru(), kir.bingkai[0]).p)
cek('rakit belum lengkap → alasan', !rKurang.ok && /Baru 1 dari/.test(rKurang.alasan))

// Dua kiriman bersesi & jumlah sama → CRC per bingkai lolos, CRC isi gagal.
const isiA = enc.encode('A'.repeat(1500) + 'x'.repeat(10))
const isiB = enc.encode('B'.repeat(1500) + 'y'.repeat(10))
const kA = await kemasEstafet('a.txt', isiA, { sesi: 'SAMA', mampat: false })
const kB = await kemasEstafet('a.txt', isiB, { sesi: 'SAMA', mampat: false })
let pc = penampungBaru()
pc = tampung(pc, kA.kiriman.bingkai[0]).p
for (let i = 1; i < kB.kiriman.bingkai.length; i++) pc = tampung(pc, kB.kiriman.bingkai[i]).p
const r3 = await rakitEstafet(pc)
cek('campuran dua kiriman → ditolak CRC32', kA.kiriman.bingkai.length === kB.kiriman.bingkai.length && !r3.ok && /CRC32/.test(r3.alasan), JSON.stringify(r3))

console.log('4. Kapasitas QR (pustaka qrcode)')
const qrBesar = QRCode.create(kir.bingkai[0], { errorCorrectionLevel: 'L' })
cek('bingkai padat ≤ versi 20, mode alphanumeric', qrBesar.version <= 20 && qrBesar.segments.every((s) => s.mode.id === 'Alphanumeric'), `v${qrBesar.version} ${qrBesar.segments.map((s) => s.mode.id)}`)
const qrKecil = QRCode.create(k3.kiriman.bingkai[0], { errorCorrectionLevel: 'L' })
cek('bingkai renggang ≤ versi 14', qrKecil.version <= 14, `v${qrKecil.version}`)
cek('detikPutaran(52, 4) = 13', detikPutaran(52, 4) === 13)
cek('formatUkuran', formatUkuran(512) === '512 B' && formatUkuran(20480) === '20 KB' && formatUkuran(1572864) === '1,5 MB')

console.log('5. Bagikan langsung (Web Share)')
cek('mimeDariNama', mimeDariNama('a.JSON') === 'application/json' && mimeDariNama('b.zip') === 'application/zip' && mimeDariNama('x.bin') === 'application/octet-stream')
const navAsli = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
const pasangNav = (n) => Object.defineProperty(globalThis, 'navigator', { value: n, configurable: true, writable: true })
pasangNav({})
cek('tanpa navigator.share → tak-didukung', (await bagikanBerkas({ nama: 'a.json', isi: '{}' })) === 'tak-didukung')
cek('bisaBagikanBerkas false tanpa share', bisaBagikanBerkas() === false)
let diterima = null
pasangNav({ canShare: () => true, share: async (d) => void (diterima = d) })
const hOk = await bagikanBerkas({ nama: 'setoran.json', isi: '{"a":1}', judul: 'Setoran' })
cek('dibagikan + File bernama & ber-MIME', hOk === 'dibagikan' && diterima.files[0].name === 'setoran.json' && diterima.files[0].type === 'application/json' && diterima.title === 'Setoran')
cek('isi File utuh', (await diterima.files[0].text()) === '{"a":1}')
const hBin = await bagikanBerkas({ nama: 'tim.zip', isi: zipPalsu })
cek('biner ZIP: ukuran utuh', hBin === 'dibagikan' && diterima.files[0].size === zipPalsu.length && diterima.files[0].type === 'application/zip')
pasangNav({ canShare: () => true, share: async () => { throw Object.assign(new Error('x'), { name: 'AbortError' }) } })
cek('ditutup pemakai → batal', (await bagikanBerkas({ nama: 'a.json', isi: '{}' })) === 'batal')
pasangNav({ canShare: () => true, share: async () => { throw Object.assign(new Error('x'), { name: 'NotAllowedError' }) } })
cek('galat lain → gagal', (await bagikanBerkas({ nama: 'a.json', isi: '{}' })) === 'gagal')
pasangNav({ canShare: () => false, share: async () => {} })
cek('canShare(files) false → tak-didukung', (await bagikanBerkas({ nama: 'a.json', isi: '{}' })) === 'tak-didukung')
if (navAsli) Object.defineProperty(globalThis, 'navigator', navAsli)

console.log(`\n${lulus} lulus, ${gagal} gagal`)
process.exit(gagal ? 1 : 0)
