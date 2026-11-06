/**
 * Uji murni #29 — Studio Intonasi & Ketuk Presisi:
 *  1. klik lapangan (forman 2,5–4 kHz), peleburan `bel` → `cowbell`,
 *     hitung bernada tanpa TTS, & birama hening (drop-out click);
 *  2. jejak nada bergulir, 3 jenjang toleransi, tahan stabil, diagnosis
 *     scoop / goyangan / ekor turun;
 *  3. peta kecenderungan nada (sasaran, ringkas median, simpan, kartu A6/A5);
 *  4. pelatih ketuk (pencocokan ±ms, bunyi vs hening, vonis);
 *  5. Kuis Show (xCount, dress, count sheet guard, simbol visual, lagu).
 *
 * Pakai: bash qa/bangun-logika.sh && node qa/studio-intonasi-logika.mjs
 */
import {
  PROFIL_KLIK_LAPANGAN,
  PILIHAN_HENING,
  biramaHening,
  klikLapangan,
  nadaHitungBernada,
  normalisasiSuaraKlik,
  rapikanPolaHening,
} from '/tmp/metronome.mjs'
import {
  JENJANG_TOLERANSI,
  analisisJejak,
  bacaDaftarPeta,
  cariToleransi,
  hapusPeta,
  labelNadaPeta,
  nadaSasaranPeta,
  proyeksiJejak,
  rapikanPeta,
  ringkasPeta,
  ringkasSampelNada,
  saranKecenderungan,
  segmenNada,
  simpanPeta,
  tambahJejak,
  warnaSen,
  wilayahBawaan,
  MAKS_PETA,
} from '/tmp/intonasi.mjs'
import { arahKetuk, nilaiKetukan, vonisKetuk } from '/tmp/pelatihKetuk.mjs'
import { bangunHtmlKartuPeta, KAP_BARIS_PETA } from '/tmp/petaNadaCetak.mjs'
import { bangunSoalShow, susunPilihan, rekapSkorShow, LABEL_JENIS_SOAL, bangunSoal } from '/tmp/kuis.mjs'
import { hitungMundurDefault } from '/tmp/birama.mjs'

let lulus = 0
let gagal = 0
function uji(nama, kondisi, detail = '') {
  if (kondisi) {
    lulus++
    console.log('  ✓ ' + nama)
  } else {
    gagal++
    console.log(`  ✗ ${nama}${detail ? ' → ' + detail : ''}`)
  }
}

// localStorage tiruan untuk penyimpanan peta.
const toko = new Map()
globalThis.localStorage = {
  getItem: (k) => (toko.has(k) ? toko.get(k) : null),
  setItem: (k, v) => toko.set(k, String(v)),
  removeItem: (k) => toko.delete(k),
}

/* ------------------------------------------------------------------ */
console.log('\n== #29.3 Klik lapangan, bel → cowbell, hitung bernada ==')
for (const [id, p] of Object.entries(PROFIL_KLIK_LAPANGAN)) {
  uji(`Forman ${id} ${p.forman} Hz di 2,5–4 kHz`, p.forman >= 2500 && p.forman <= 4000)
}
uji('Tiga profil lapangan: drbeat, cowbell, rim', Object.keys(PROFIL_KLIK_LAPANGAN).join(',') === 'drbeat,cowbell,rim')
uji('klikLapangan hanya untuk tiga profil', klikLapangan('drbeat') && klikLapangan('rim') && !klikLapangan('klik') && !klikLapangan('snare'))
uji('Lagu lama bersuara "bel" dibaca sebagai "cowbell"', normalisasiSuaraKlik('bel') === 'cowbell')
uji('Nilai sah lain tidak diubah', ['klik', 'kayu', 'snare', 'drbeat', 'cowbell', 'rim'].every((s) => normalisasiSuaraKlik(s) === s))
uji('Nilai asing/kosong → klik', normalisasiSuaraKlik('gong') === 'klik' && normalisasiSuaraKlik(undefined) === 'klik')
uji('Hitung mundur bawaan kini cowbell (bukan bel)', hitungMundurDefault().suara === 'cowbell')

const n0 = nadaHitungBernada(0, 4, false)
const n1 = nadaHitungBernada(1, 4, false)
const n3 = nadaHitungBernada(3, 4, true)
uji('Hitung bernada: ketukan 1 = 880 Hz beraksen', n0.hz === 880 && n0.aksen && !n0.ganda, JSON.stringify(n0))
uji('Nada naik setangga mayor (ketukan 2 = +2 semitone)', Math.abs(n1.hz - 880 * 2 ** (2 / 12)) < 0.02 && n1.hz > n0.hz)
uji('Ketukan terakhir putaran terakhir berbunyi ganda "siap-"', n3.ganda && !nadaHitungBernada(3, 4, false).ganda)
uji('Tiap angka hitungan punya nada berbeda (7/8 → 7 nada unik)', new Set(Array.from({ length: 7 }, (_, i) => nadaHitungBernada(i, 7, false).hz)).size === 7)

console.log('\n== #29.4 Birama hening (drop-out click) ==')
const p22 = { bunyi: 2, hening: 2 }
uji('2+2: birama 0,1 bunyi; 2,3 hening; 4 bunyi lagi', [0, 1, 2, 3, 4, 5, 6].map((k) => biramaHening(k, p22)).join(',') === 'false,false,true,true,false,false,true')
uji('4+2: birama 4 & 5 hening', biramaHening(4, { bunyi: 4, hening: 2 }) && biramaHening(5, { bunyi: 4, hening: 2 }) && !biramaHening(6, { bunyi: 4, hening: 2 }))
uji('Tanpa pola → tidak pernah hening', !biramaHening(3, null) && !biramaHening(3, undefined))
uji('Pola tidak sah (0 bunyi / 0 hening) dimatikan', rapikanPolaHening({ bunyi: 0, hening: 2 }) === null && rapikanPolaHening({ bunyi: 2, hening: 0 }) === null)
uji('Pola dijepit ≤ 16 & dibulatkan', JSON.stringify(rapikanPolaHening({ bunyi: 2.7, hening: 99 })) === '{"bunyi":2,"hening":16}')
uji('Pilihan siap pakai diawali "mati"', PILIHAN_HENING[0].id === 'mati' && PILIHAN_HENING[0].pola === null && PILIHAN_HENING.some((p) => p.id === '2-2'))

/* ------------------------------------------------------------------ */
console.log('\n== #29.1 Jejak nada & 3 jenjang toleransi ==')
uji('Tiga jenjang: Pemula ±15 · Menengah ±8 · Mahir/DCI ±3', JENJANG_TOLERANSI.map((j) => `${j.label}:${j.sen}`).join(' ') === 'Pemula:15 Menengah:8 Mahir/DCI:3')
uji('Jenjang tak dikenal → Menengah', cariToleransi('x').id === 'menengah')
uji('warnaSen: hijau dalam tol, kuning ≤2×, merah lebih, abu hening', warnaSen(3, 3) === '#10b981' && warnaSen(5, 3) === '#f59e0b' && warnaSen(-7, 3) === '#f43f5e' && warnaSen(null, 3) === '#64748b')

let jj = []
for (let t = 0; t <= 12000; t += 60) jj = tambahJejak(jj, { t, sen: 0, midi: 58 })
uji('Jejak memangkas cuplikan di luar jendela 8 dtk', jj[0].t >= 12000 - 8000 && jj.length <= 8000 / 60 + 2, `${jj[0].t} n=${jj.length}`)

/** Satu tiupan sintetis: scoop −25 → 0 dalam 250 ms, badan ±amp, ekor turun −20 di 300 ms terakhir. */
function tiupan({ t0 = 0, panjang = 3000, scoop = 0, goyang = 0, ekor = 0, midi = 58, dasar = 0 }) {
  const out = []
  for (let t = t0; t <= t0 + panjang; t += 60) {
    const u = t - t0
    let sen = dasar + goyang * Math.sin(u / 90)
    if (u < 250) sen += scoop * (1 - u / 250)
    if (u > panjang - 300) sen += ekor * ((u - (panjang - 300)) / 300)
    out.push({ t, sen: Math.round(sen), midi })
  }
  return out
}
const stabil = [...tiupan({ panjang: 3000 }), { t: 3060, sen: null }]
const aStabil = analisisJejak(stabil, 8)
uji('Tiupan stabil: tahan terbaik ≈ 3 dtk, 100% dalam ±8', aStabil.tahanTerbaik >= 2.9 && aStabil.persenDalam === 100, JSON.stringify(aStabil))
uji('Tiupan stabil dipuji', aStabil.catatan.some((c) => /stabil/i.test(c)), aStabil.catatan.join(' | '))
uji('Sesudah hening, tahan kini kembali 0', aStabil.tahanKini === 0)

const berjalan = tiupan({ panjang: 2000 })
uji('Masih berbunyi: tahan kini = durasi tiupan (≈2 dtk)', Math.abs(analisisJejak(berjalan, 8).tahanKini - 2) <= 0.1, String(analisisJejak(berjalan, 8).tahanKini))

const masalah = [...tiupan({ panjang: 3000, scoop: -30, ekor: -24, goyang: 0 }), { t: 3060, sen: null }]
const aM = analisisJejak(masalah, 8)
uji('Scoop terdeteksi (serangan ≤ −8 sen)', aM.serangan !== null && aM.serangan <= -8 && aM.catatan.some((c) => /scoop/i.test(c)), JSON.stringify(aM))
uji('Ekor nada turun terdeteksi', aM.ekor !== null && aM.ekor <= -8 && aM.catatan.some((c) => /Ekor nada turun/.test(c)), JSON.stringify(aM))
const lanjut = [...masalah, ...tiupan({ t0: 3600, panjang: 1500 })]
const aL = analisisJejak(lanjut, 8)
uji('Tiupan berikutnya dimulai: catatan ekor tiupan sebelumnya tetap tampil', aL.ekor !== null && aL.ekor <= -8 && aL.tahanKini > 1, JSON.stringify(aL))
const aG = analisisJejak([...tiupan({ panjang: 3000, goyang: 9 }), { t: 3060, sen: null }], 8)
uji('Goyangan napas terdeteksi (±sen)', aG.goyang !== null && aG.goyang > 4.8 && aG.catatan.some((c) => /Goyangan napas/.test(c)), JSON.stringify(aG))
uji('Jenjang Mahir lebih ketat: tiupan bergoyang turun persentasenya', analisisJejak(aG && [...tiupan({ panjang: 3000, goyang: 9 })], 3).persenDalam < analisisJejak([...tiupan({ panjang: 3000, goyang: 9 })], 15).persenDalam)
const dua = [...tiupan({ panjang: 1200, midi: 58 }), ...tiupan({ t0: 1260, panjang: 1200, midi: 60 })]
uji('Ganti nada memecah segmen', segmenNada(dua).length === 2)
const pr = proyeksiJejak([{ t: 0, sen: 0, midi: 1 }, { t: 60, sen: 50, midi: 1 }, { t: 120, sen: null }, { t: 180, sen: -50, midi: 1 }], 180, 800, 120, 50, 8000)
uji('Proyeksi: hening memutus garis (null), +50 di atas, −50 di bawah', pr.includes(null) && pr[1].y === 0 && pr[pr.length - 1].y === 120, JSON.stringify(pr))

/* ------------------------------------------------------------------ */
console.log('\n== #29.2 Peta kecenderungan nada ==')
const sasaranBb = nadaSasaranPeta('bb-mayor', 3)
uji('Bb konser mayor oktaf 3 = MIDI 58…70 (8 nada)', sasaranBb.length === 8 && sasaranBb[0] === 58 && sasaranBb[7] === 70, sasaranBb.join(','))
uji('Kromatik 13 nada; 2 oktaf 15 nada', nadaSasaranPeta('kromatik', 3).length === 13 && nadaSasaranPeta('bb-mayor-2', 2).length === 15)
const lb = labelNadaPeta(58, 'bb')
uji('Bb3 konser = C4 tertulis untuk trumpet (Bb)', lb.tertulis === 'C4' && lb.konser === 'Bb3', JSON.stringify(lb))
uji('Wilayah bawaan: trumpet tengah, sax tenor rendah', wilayahBawaan('bb') === 'tengah' && wilayahBawaan('bb8') === 'rendah')

const sampel = []
for (let t = 0; t <= 2000; t += 60) sampel.push({ t, sen: t < 350 ? -40 : t === 1200 ? 45 : 12 })
const rs = ringkasSampelNada(sampel)
uji('Ringkas: serangan 350 ms dibuang, median tahan bacaan sesat (+12)', rs?.sen === 12, JSON.stringify(rs))
uji('Tiupan 2 dtk dianggap cukup', rs?.cukup === true)
uji('Tiupan 0,8 dtk belum cukup', ringkasSampelNada(sampel.filter((s) => s.t <= 800))?.cukup === false)
uji('Saran: <5 aman, +9 tinggi, −20 sangat rendah', saranKecenderungan(4).arah === 'aman' && saranKecenderungan(9).arah === 'tinggi' && /sangat rendah/.test(saranKecenderungan(-20).teks))

const peta = {
  id: 'p1',
  nama: 'Rani — Trumpet 2',
  transposisi: 'bb',
  a4: 442,
  tangga: 'bb-mayor',
  dibuat: 1000,
  nada: sasaranBb.map((m, i) => ({ midi: m, sen: [2, -9, 13, 0, -3, 6, -16, 4][i], n: 20, sebaran: 3 })),
}
const rk = ringkasPeta(peta)
uji('Ringkas peta: tertinggi D (+13), terendah A (−16)', rk.tertinggi?.sen === 13 && rk.terendah?.sen === -16 && rk.rataAbs === 7, JSON.stringify(rk))
uji('rapikanPeta menolak sampah & menjepit sen', rapikanPeta(null) === null && rapikanPeta({ id: 'x', nada: [{ midi: 60, sen: 99 }] }).nada[0].sen === 50)
simpanPeta(peta)
simpanPeta({ ...peta, id: 'p2', nama: 'Bima', dibuat: 2000 })
uji('Simpan dua peta → terbaru dulu', bacaDaftarPeta().map((p) => p.id).join(',') === 'p2,p1')
simpanPeta({ ...peta, nama: 'Rani (ulang)', dibuat: 3000 })
uji('Id sama menimpa, tidak menggandakan', bacaDaftarPeta().length === 2 && bacaDaftarPeta()[0].nama === 'Rani (ulang)')
for (let i = 0; i < 15; i++) simpanPeta({ ...peta, id: `q${i}`, dibuat: 4000 + i })
uji(`Paling banyak ${MAKS_PETA} peta per perangkat`, bacaDaftarPeta().length === MAKS_PETA)
hapusPeta('q14')
uji('Hapus peta', !bacaDaftarPeta().some((p) => p.id === 'q14'))
toko.set('drillkit.petaNada', '{rusak')
uji('JSON rusak → daftar kosong, tidak error', bacaDaftarPeta().length === 0)

const kartu = bangunHtmlKartuPeta(peta, 'a6', 'Garuda')
uji('Kartu A6: @page A6, judul, 8 baris nada', /size: A6 portrait/.test(kartu) && /Rani — Trumpet 2/.test(kartu) && (kartu.match(/<tr>/g) ?? []).length === 9, String((kartu.match(/<tr>/g) ?? []).length))
uji('Kartu memakai nada tertulis + konser (C4 · Bb3)', /<b>C4<\/b><span class="ks"> Bb3<\/span>/.test(kartu))
uji('Kartu murni #hex (tanpa rgba/oklch/color-mix)', !/rgba\(|oklch\(|color-mix\(/i.test(kartu))
const kartuPanjang = bangunHtmlKartuPeta({ ...peta, nada: Array.from({ length: 20 }, (_, i) => ({ midi: 50 + i, sen: i - 10, n: 9, sebaran: 2 })) }, 'a6')
uji(`A6 memotong di ${KAP_BARIS_PETA.a6} baris + ajakan cetak A5`, /\+5 nada lain tidak muat/.test(kartuPanjang))
uji('A5 memakai @page A5', /size: A5 portrait/.test(bangunHtmlKartuPeta(peta, 'a5')))

/* ------------------------------------------------------------------ */
console.log('\n== #29.4 Pelatih ketuk ==')
const bpm = 120
const ket = 60 / bpm
const sasaranK = Array.from({ length: 16 }, (_, i) => ({ waktu: 10 + i * ket, hening: Math.floor(i / 4) % 2 === 1 }))
const pas = nilaiKetukan(sasaranK, sasaranK.map((s) => s.waktu))
uji('Ketukan tepat: rata 0 ms, 100% tepat, 0 terlewat', pas.semua.rataMs === 0 && pas.persenTepat === 100 && pas.terlewat === 0 && pas.ketukLebih === 0)
const gesa = nilaiKetukan(sasaranK, sasaranK.map((s) => s.waktu - 0.03))
uji('Mendahului 30 ms: rata −30, arah tergesa', gesa.semua.rataMs === -30 && arahKetuk(gesa.semua.rataMs) === 'tergesa')
uji('Vonis menyebut TERGESA', vonisKetuk(gesa).some((v) => /TERGESA/.test(v)))
const drift = nilaiKetukan(sasaranK, sasaranK.map((s) => s.waktu + (s.hening ? -0.045 : 0.002)))
uji('Bunyi ≈ +2 ms, hening ≈ −45 ms dipisah', drift.bunyi.rataMs === 2 && drift.hening.rataMs === -45, JSON.stringify([drift.bunyi, drift.hening]))
uji('Vonis: tempo batin terlalu CEPAT saat klik diam', vonisKetuk(drift).some((v) => /tempo batin terlalu CEPAT/.test(v)), vonisKetuk(drift).join(' | '))
const lambat = nilaiKetukan(sasaranK, sasaranK.map((s) => s.waktu + (s.hening ? 0.06 : 0)))
uji('Vonis: tempo batin MELAMBAT', vonisKetuk(lambat).some((v) => /MELAMBAT/.test(v)))
const bolong = nilaiKetukan(sasaranK, sasaranK.filter((_, i) => i !== 5 && i !== 6).map((s) => s.waktu))
uji('Dua ketukan dilewati → terlewat 2', bolong.terlewat === 2 && bolong.pasangan.length === 14)
const lebih = nilaiKetukan(sasaranK, [...sasaranK.map((s) => s.waktu), 10 + 2.5 * ket, 10 + 0.02])
uji('Ketukan di tengah-tengah = lebih; dobel dekat = lebih, yang terdekat dipakai', lebih.ketukLebih === 2 && lebih.semua.rataMs === 0, JSON.stringify({ l: lebih.ketukLebih, r: lebih.semua }))
const sebagian = nilaiKetukan(sasaranK, sasaranK.slice(0, 6).map((s) => s.waktu))
uji('Berhenti mengetuk: sasaran sesudahnya tidak dihitung terlewat', sebagian.terlewat === 0 && sebagian.pasangan.length === 6)
uji('Tanpa ketukan → vonis jujur', vonisKetuk(nilaiKetukan(sasaranK, []))[0].startsWith('Belum ada ketukan'))

/* ------------------------------------------------------------------ */
console.log('\n== #29.4 Kuis Show ==')
const LAP = { widthYd: 53.33, lengthYd: 100, endZoneYd: 10, hash: 'ncaa', gridYd: 5, step: '8to5', customStepYd: 0.625, showLabels: 1 }
const anggota = [
  { id: 'a1', code: 'A01', name: 'Andra', section: 'brass' },
  { id: 'a2', code: 'A02', name: 'Bima', section: 'brass' },
  { id: 'a3', code: 'A03', name: 'Citra', section: 'brass' },
  { id: 'g1', code: 'G01', name: 'Gita', section: 'guard' },
]
const sets = [
  { id: 's1', drillId: 'd1', order: 0, name: 'Set 1', counts: 8, points: { a1: { x: 2, y: 0 }, a2: { x: 6, y: 0 }, a3: { x: 10, y: 0 }, g1: { x: 0, y: 8 } } },
  {
    id: 's2', drillId: 'd1', order: 1, name: 'Set 2', counts: 8,
    points: { a1: { x: -8, y: 0 }, a2: { x: -4, y: 0 }, a3: { x: 0, y: 0 }, g1: { x: 0, y: 10 } },
    dress: { acuan: 'kiri' },
    visual: { simbol: ['horn_up'], catatan: 'snap di count 1' },
  },
  { id: 's3', drillId: 'd1', order: 2, name: 'Set 3', counts: 8, points: { a1: { x: -8, y: 4 }, a2: { x: -4, y: 4 } }, visual: { simbol: ['mark_time'], seksi: ['guard'] } },
]
const songs = [
  { id: 'L1', title: 'Gita Bahari', bpm: 132, beats: 4, tempoMap: [], createdAt: 0 },
  { id: 'L2', title: 'Rayuan Pulau Kelapa', bpm: 96, beats: 3, tempoMap: [], createdAt: 0, tandaBirama: { pembilang: 6, penyebut: 8 } },
  { id: 'L3', title: 'Bendera', bpm: 144, beats: 4, tempoMap: [{ measure: 9, bpm: 160 }], createdAt: 0 },
]
const setlists = [{ id: 'SL', name: 'Show Final', songIds: ['L1', 'L2', 'L3'], createdAt: 0, updatedAt: 0 }]
const countSheets = [{
  id: 'cs1', judul: 'Opener Guard', seksi: 'guard', alatUtama: 'flag', createdAt: 0, updatedAt: 0,
  blok: [
    { id: 'b1', urutan: 0, labelBagian: 'Intro A', counts: 8, alat: 'flag', teknik: 'Drop spin', aksenCount: [5] },
    { id: 'b2', urutan: 1, labelBagian: 'Intro B', counts: 8, alat: 'rifle', teknik: 'Toss 45' },
  ],
}]
const soalA1 = bangunSoalShow({ sets, members: anggota, memberId: 'a1', field: LAP, countSheets, songs, setlists })
const jenis = (j) => soalA1.filter((s) => s.jenis === j)
uji('Anggota brass: ada soal xCount', jenis('xcount').length >= 1, JSON.stringify(soalA1.map((s) => s.jenis)))
const sx = jenis('xcount')[0]
uji('Soal xCount: kunci = hitungan YL50 (1,6)', sx && sx.pilihan[sx.kunci] === '1,6' && /YL50/.test(sx.tanya), JSON.stringify(sx))
uji('Pengecoh xCount unik & dalam 0,5…8', sx && new Set(sx.pilihan).size === sx.pilihan.length && sx.pilihan.length === 4)
const sd = jenis('dress')[0]
uji('Soal dress: a1 paling S2 → "Kamu sendiri pemandunya"', sd && sd.pilihan[sd.kunci] === 'Kamu sendiri pemandunya', JSON.stringify(sd))
const soalA3 = bangunSoalShow({ sets, members: anggota, memberId: 'a3', field: LAP, countSheets, songs, setlists })
const sd3 = soalA3.find((s) => s.jenis === 'dress')
uji('Soal dress a3: kunci "Kiri — ikut A01"', sd3 && sd3.pilihan[sd3.kunci] === 'Kiri — ikut A01', JSON.stringify(sd3?.pilihan))
const ss = jenis('simbol')
uji('Simbol visual: Horn Up di Set 2; Set 3 khusus guard tidak muncul untuk brass', ss.length === 1 && ss[0].pilihan[ss[0].kunci] === 'Horn Up', JSON.stringify(ss.map((s) => s.pilihan)))
uji('Brass tidak mendapat soal count sheet guard', jenis('guard').length === 0)
const lagu = jenis('lagu')
uji('Lagu: 3 soal urutan + 3 tempo + 3 sukat', lagu.length === 9, String(lagu.length))
const urutan2 = lagu.find((s) => s.id === 'urutan:SL:1')
uji('Urutan: lagu ke-2 = Rayuan Pulau Kelapa', urutan2 && urutan2.pilihan[urutan2.kunci] === 'Rayuan Pulau Kelapa')
const sukatL2 = lagu.find((s) => s.id === 'sukat:L2')
uji('Sukat Rayuan = 6/8 (tanda birama), Gita Bahari = 4/4 (beats lama)', sukatL2?.pilihan[sukatL2.kunci] === '6/8' && lagu.find((s) => s.id === 'sukat:L1')?.pilihan.includes('4/4'))
const tempoL3 = lagu.find((s) => s.id === 'tempo:L3')
uji('Tempo: 144 BPM + menyebut perubahan tempo', tempoL3?.pilihan[tempoL3.kunci] === '144 BPM' && /1 perubahan tempo/.test(tempoL3.penjelasan))

const soalG1 = bangunSoalShow({ sets, members: anggota, memberId: 'g1', field: LAP, countSheets, songs, setlists })
const guard = soalG1.filter((s) => s.jenis === 'guard')
uji('Guard: soal alat Intro A & Intro B + aksen Intro A', guard.length === 3, JSON.stringify(guard.map((g) => g.id)))
uji('Guard: Intro B = Rifle (Senapan)', guard.find((g) => g.id === 'guard-alat:cs1:b2')?.pilihan.includes('Rifle (Senapan)'))
const aksen = guard.find((g) => g.id.startsWith('guard-aksen'))
uji('Guard: aksen di count 5 dengan pengecoh 4/6/3/7', aksen && aksen.pilihan[aksen.kunci] === '5' && aksen.pilihan.length === 4)
uji('Guard melihat simbol Set 3 khusus guard? (tidak — g1 tidak ada di Set 3)', !soalG1.some((s) => s.id === 'simbol:s3'))

const p = susunPilihan('B', ['A', 'B', 'C', 'C', 'D', 'E'], 7)
uji('susunPilihan: 4 pilihan unik, kunci menunjuk jawaban', p.pilihan.length === 4 && new Set(p.pilihan).size === 4 && p.pilihan[p.kunci] === 'B')
uji('susunPilihan deterministik untuk benih sama', JSON.stringify(susunPilihan('B', ['A', 'C', 'D', 'E'], 7)) === JSON.stringify(susunPilihan('B', ['A', 'C', 'D', 'E'], 7)))
const posisiKunci = new Set(soalA1.map((s) => s.kunci))
uji('Kunci tidak selalu di pilihan A', posisiKunci.size > 1, [...posisiKunci].join(','))
const jawab = Object.fromEntries(soalA1.map((s) => [s.id, s.jenis === 'lagu' ? s.kunci : (s.kunci + 1) % s.pilihan.length]))
const rekap = rekapSkorShow(soalA1, jawab)
uji('Rekap skor per jenis', rekap.find((r) => r.jenis === 'lagu')?.benar === 9 && rekap.find((r) => r.jenis === 'xcount')?.benar === 0)
uji('Label jenis berbahasa Indonesia', LABEL_JENIS_SOAL.lagu === 'Lagu, tempo & sukat')
uji('Kuis posisi lama tetap utuh', bangunSoal(sets, 'a1').length === 2)

console.log(`\n${lulus} lulus, ${gagal} gagal`)
process.exit(gagal ? 1 : 0)
