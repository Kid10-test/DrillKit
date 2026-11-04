/**
 * Uji murni #26 — Buku Saku Generasi Baru: xCounts & Titik Tengah, Perspektif
 * Pemain 180°, Dress/Guiding, Hole & Bayangan, Catatan Cleaning terpadu
 * (`tindakLanjut`), dan Lembar Fokus Cleaning Harian A4.
 *
 * Pakai: bash qa/bangun-logika.sh && node qa/buku-saku-generasi-baru-logika.mjs
 */

import {
  fmtHitungan,
  daftarGarisAcuan,
  hitungXCounts,
  infoXCountPemain,
  proyeksiLapangan,
  panahArahPerspektif,
  apakahIdHole,
  labelHoleBerikut,
  jadikanHole,
  isiHole,
  hapusHoleDariSet,
  terapkanBayangan,
  keteranganBayangan,
  resolusiDress,
} from '/tmp/bukuSakuPemain.mjs'
import { buatPenjejakSet } from '/tmp/jejakJalur.mjs'
import {
  statusBerikut,
  buatTindakLanjut,
  ubahStatusTL,
  saringTindakLanjut,
  urutkanTindakLanjut,
  hitungStatusTL,
  konteksTL,
  rapikanJudulTL,
} from '/tmp/tindakLanjut.mjs'
import { buatLembarFokusCleaningHtml, KAP_BARIS_LEMBAR_CLEANING } from '/tmp/cleaningCetak.mjs'
import { paketGrup, paketAnggota } from '/tmp/bagikan.mjs'

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
const dekat = (a, b, tol = 0.15) => typeof a === 'number' && Math.abs(a - b) <= tol

const LAPANGAN = {
  widthYd: 53.33,
  lengthYd: 100,
  endZoneYd: 10,
  hash: 'ncaa',
  gridYd: 5,
  step: '8to5',
  customStepYd: 0.625,
  showLabels: 1,
}
const SYD = 0.625

const anggota = [
  { id: 'a1', code: 'A01', name: 'Andra', section: 'brass' },
  { id: 'a2', code: 'A02', name: 'Bima', section: 'brass' },
  { id: 'a3', code: 'A03', name: 'Citra', section: 'brass' },
  { id: 'p1', code: 'P01', name: 'Dewi', section: 'perkusi' },
  { id: 'b1', code: 'A09', name: 'Eko', section: 'brass' },
]

function set(id, order, points, extra = {}) {
  return { id, drillId: 'd1', order, name: `Set ${order + 1}`, counts: 8, points, ...extra }
}

/* ------------------------------------------------------------------ */
console.log('\n== #26.1 xCounts & Titik Tengah (Halfway) ==')

uji('fmtHitungan memakai koma desimal Indonesia', fmtHitungan(4.5) === '4,5' && fmtHitungan(6) === '6' && fmtHitungan(3.04) === '3')

const garis = daftarGarisAcuan(LAPANGAN)
uji(
  'Garis acuan football: yard line tiap 5 yd (21 garis) + FH/BH',
  garis.filter((g) => g.jenis === 'yard').length === 21 &&
    garis.some((g) => g.label === 'YL50') &&
    garis.some((g) => g.label === 'YL45 S1' && g.pos === 5) &&
    garis.some((g) => g.label === 'YL45 S2' && g.pos === -5) &&
    garis.some((g) => g.label === 'FH' && g.pos < 0) &&
    garis.some((g) => g.label === 'BH' && g.pos > 0),
  JSON.stringify(garis.slice(0, 3)),
)
uji('Mode Kirab (parade) tidak punya garis acuan', daftarGarisAcuan({ ...LAPANGAN, parade: { aktif: 1 } }).length === 0)
const garisPatok = daftarGarisAcuan({ ...LAPANGAN, patok: { aktif: 1 } })
uji('Lapangan berpatok memakai label patok, bukan yard line', garisPatok.length > 0 && garisPatok.every((g) => g.jenis === 'patok'))

// Lurus dari x=+2 (S1) ke x=−8 (S2) dalam 8 count: lintas YL50 @1,6 dan YL45 S2 @5,6.
const s1 = set('s1', 0, { a1: { x: 2, y: 0 } })
const s2 = set('s2', 1, { a1: { x: -8, y: 0 } })
const penj = buatPenjejakSet({ dari: s1, ke: s2, anggota })
const xc = hitungXCounts(penj, 'a1', garis)
uji(
  'Jalur lurus: tepat 2 perlintasan, berurutan (YL50 lalu YL45 S2)',
  xc.length === 2 && xc[0].label === 'YL50' && xc[1].label === 'YL45 S2' && xc[0].hitungan < xc[1].hitungan,
  JSON.stringify(xc),
)
uji('Hitungan perlintasan presisi ±0,15 (1,6 & 5,6)', dekat(xc[0]?.hitungan, 1.6) && dekat(xc[1]?.hitungan, 5.6), JSON.stringify(xc))

// Berangkat tepat di garis & berhenti tepat di garis → bukan perlintasan.
const pGaris = buatPenjejakSet({
  dari: set('g1', 0, { a1: { x: 5, y: 0 } }),
  ke: set('g2', 1, { a1: { x: 10, y: 0 } }),
  anggota,
})
uji('Berangkat & berhenti tepat di garis tidak dihitung melintas', hitungXCounts(pGaris, 'a1', garis).length === 0)

// Melintas front hash (y = −6,665 pada NCAA) dalam 4 count.
const pHash = buatPenjejakSet({
  dari: { ...set('h1', 0, { a1: { x: 1, y: -10 } }), counts: 4 },
  ke: set('h2', 1, { a1: { x: 1, y: 0 } }),
  anggota,
})
const xHash = hitungXCounts(pHash, 'a1', garis)
uji('Perlintasan hash FH terdeteksi pada hitungan ±1,3 dari 4', xHash.length === 1 && xHash[0].label === 'FH' && dekat(xHash[0].hitungan, 1.33, 0.2), JSON.stringify(xHash))

// Titik singgah #23: ke S2 lalu kembali → YL50 & YL45 S2 masing-masing dilintasi dua kali.
const sMid = set('m1', 0, { a1: { x: 2, y: 0 } }, { midsets: { a1: [{ padaCount: 4, x: -7, y: 0 }] } })
const pMid = buatPenjejakSet({ dari: sMid, ke: set('m2', 1, { a1: { x: 2, y: 2 } }), anggota })
const xMid = hitungXCounts(pMid, 'a1', garis)
uji(
  'Jalur bertitik singgah: 4 perlintasan (YL50, YL45 S2, YL45 S2, YL50)',
  xMid.length === 4 && xMid.filter((x) => x.label === 'YL50').length === 2 && xMid.filter((x) => x.label === 'YL45 S2').length === 2,
  JSON.stringify(xMid),
)
uji('Perlintasan titik singgah berpisah di sekitar hitungan 4', xMid[1]?.hitungan < 4 && xMid[2]?.hitungan > 4, JSON.stringify(xMid))

const info = infoXCountPemain({ dari: s1, ke: s2, anggota, memberId: 'a1', field: LAPANGAN })
uji(
  'Ringkasan teks: "xCount: YL50 hit. 1,6 · YL45 S2 hit. 5,6"',
  info?.teksXCount === 'xCount: YL50 hit. 1,6 · YL45 S2 hit. 5,6',
  info?.teksXCount,
)
uji('Titik tengah tepat di hitungan 4 & x = −3', info?.tengah?.hitungan === 4 && dekat(info.tengah.x, -3, 0.01) && info.teksTengah.startsWith('Tengah [hit. 4]: '), JSON.stringify(info?.tengah))
uji('Pemain diam / set terakhir → tanpa info xCount', infoXCountPemain({ dari: s1, ke: set('s3', 2, { a1: { x: 2, y: 0 } }), anggota, memberId: 'a1', field: LAPANGAN }) === null && infoXCountPemain({ dari: s1, anggota, memberId: 'a1', field: LAPANGAN }) === null)
const infoMaks = infoXCountPemain({ dari: sMid, ke: set('m2', 1, { a1: { x: 2, y: 2 } }), anggota, memberId: 'a1', field: LAPANGAN, maks: 2 })
uji('Batas tampil `maks` meringkas sisanya "+n lagi"', /\+2 lagi$/.test(infoMaks?.teksXCount ?? ''), infoMaks?.teksXCount)

/* ------------------------------------------------------------------ */
console.log('\n== #26.2 Perspektif Pemain 180° ==')
const VW = 120
const VH = 53.33
const n = proyeksiLapangan(LAPANGAN, false)
const b = proyeksiLapangan(LAPANGAN, true)
uji(
  'Proyeksi terbalik = cermin 180° (sx + sx\' = VW, sy + sy\' = VH)',
  [-40, -7, 0, 12.5, 50].every((x) => dekat(n.sx(x) + b.sx(x), VW, 1e-9)) && [-20, 0, 6.6].every((y) => dekat(n.sy(y) + b.sy(y), VH, 1e-9)),
)
uji('Normal: S1 (+x) di kiri & penonton di bawah; terbalik: S1 di kanan & penonton di atas', n.sx(10) < n.sx(-10) && n.sy(-20) > n.sy(20) && b.sx(10) > b.sx(-10) && b.sy(-20) < b.sy(20))
uji('Arah hadap ikut berbalik (arahHadap −1)', n.arahHadap === 1 && b.arahHadap === -1)
uji('Panah arah perspektif = panah arah berlawanan', panahArahPerspektif(1, 0, true) === panahArahPerspektif(-1, 0, false) && panahArahPerspektif(0, 1, true) === panahArahPerspektif(0, -1, false) && panahArahPerspektif(1, 0, true) !== panahArahPerspektif(1, 0, false))

/* ------------------------------------------------------------------ */
console.log('\n== #26.3 Hole & Bayangan/Alternate ==')
const setsH = [
  set('x1', 0, { a1: { x: 0, y: 0 }, a2: { x: 2, y: 0 } }, { midsets: { a2: [{ padaCount: 4, x: 3, y: 1 }] } }),
  set('x2', 1, { a1: { x: 0, y: 4 }, a2: { x: 2, y: 4 } }, { bentukTerikat: [{ id: 'bt', memberIds: ['a1', 'a2'] }] }),
  set('x3', 2, { a1: { x: 0, y: 8 } }),
]
uji('Id hole berawalan hole_; label mengisi nomor kosong lebih dulu', apakahIdHole('hole_x') && !apakahIdHole('a1') && labelHoleBerikut([]) === 'H1' && labelHoleBerikut([{ label: 'H1' }, { label: 'H3' }]) === 'H2')
const jh = jadikanHole({ drill: { holes: [] }, sets: setsH, memberId: 'a2', dariIdx: 0, idBaru: 'hole_1', alasan: 'cedera' })
uji('Jadikan Hole: titik a2 di set 1–2 pindah ke hole_1 (set tanpa a2 dilewati)', jh?.patchSets.length === 2 && jh.patchSets.every((p) => p.patch.points.hole_1 && !p.patch.points.a2) && jh.hole.label === 'H1' && jh.hole.memberIdAsal === 'a2')
uji('Jadikan Hole ikut memindahkan titik singgah & anggota bentuk terikat', jh.patchSets[0].patch.midsets?.hole_1?.length === 1 && jh.patchSets[1].patch.bentukTerikat?.[0].memberIds.join() === 'a1,hole_1')
uji('Jadikan Hole pada pemain tanpa titik → null', jadikanHole({ drill: {}, sets: setsH, memberId: 'zz', dariIdx: 0, idBaru: 'hole_2' }) === null)
const setsSesudah = setsH.map((s) => ({ ...s, ...(jh.patchSets.find((p) => p.id === s.id)?.patch ?? {}) }))
const ih = isiHole({ drill: { holes: [jh.hole] }, sets: setsSesudah, holeId: 'hole_1', memberId: 'b1' })
uji('Isi Hole oleh pemain baru: 2 set dipindah, hole dihapus dari drill', ih.patchSets.length === 2 && ih.dilewati === 0 && ih.holesBaru.length === 0 && ih.patchSets[1].patch.bentukTerikat[0].memberIds.join() === 'a1,b1')
const ihBentrok = isiHole({ drill: { holes: [jh.hole] }, sets: setsSesudah, holeId: 'hole_1', memberId: 'a1' })
uji('Isi Hole oleh pemain yang sudah punya titik: dilewati & hole dipertahankan', ihBentrok.dilewati === 2 && ihBentrok.patchSets.length === 0 && ihBentrok.holesBaru.length === 1)
const hh = hapusHoleDariSet(setsSesudah[1], 'hole_1')
uji('Hapus hole merapatkan bentuk terikat', !hh.points.hole_1 && hh.bentukTerikat[0].memberIds.join() === 'a1' && hapusHoleDariSet(setsSesudah[2], 'hole_1') === null)

const drillB = { field: LAPANGAN, bayangan: [{ memberId: 'b1', indukId: 'a1', mode: 'offset', offsetLangkah: 2, arahOffset: 'belakang' }] }
const setsB = [
  set('y1', 0, { a1: { x: 4, y: 0 } }, { midsets: { a1: [{ padaCount: 4, x: 6, y: 1 }] } }),
  set('y2', 1, { a1: { x: 4, y: 4 }, b1: { x: -10, y: -10 } }),
]
const salinanAsli = JSON.stringify(setsB)
const turunan = terapkanBayangan(setsB, drillB)
uji('Bayangan offset 2 langkah ke belakang: y + 2×0,625 yd', dekat(turunan[0].points.b1?.x, 4, 1e-9) && dekat(turunan[0].points.b1?.y, 2 * SYD, 1e-9), JSON.stringify(turunan[0].points.b1))
uji('Titik singgah induk ikut digeser sejajar', dekat(turunan[0].midsets?.b1?.[0]?.y, 1 + 2 * SYD, 1e-9))
uji('Set yang memberi titik sendiri ke bayangan tidak ditimpa', turunan[1].points.b1.x === -10 && turunan[1] === setsB[1])
uji('terapkanBayangan murni (masukan tidak berubah)', JSON.stringify(setsB) === salinanAsli && !setsB[0].points.b1)
const berbagi = terapkanBayangan(setsB, { field: LAPANGAN, bayangan: [{ memberId: 'b1', indukId: 'a1', mode: 'berbagi' }] })
uji('Mode berbagi: titik identik dengan induk', berbagi[0].points.b1.x === 4 && berbagi[0].points.b1.y === 0)
uji(
  'Keterangan bayangan berbahasa Indonesia',
  keteranganBayangan(drillB, 'b1', anggota) === 'Bayangan A01 — geser 2 langkah ke belakang' &&
    keteranganBayangan({ bayangan: [{ memberId: 'b1', indukId: 'a1', mode: 'berbagi' }] }, 'b1', anggota) === 'Bayangan A01 — berbagi nomor & titik' &&
    keteranganBayangan(drillB, 'a1', anggota) === null,
)

/* ------------------------------------------------------------------ */
console.log('\n== #26.4 Dress / Guiding ==')
const sDress = set(
  'z1',
  0,
  { a1: { x: -6, y: 0 }, a2: { x: 0, y: 0 }, a3: { x: 6, y: 0 }, p1: { x: -20, y: 0 }, hole_9: { x: -30, y: 0 } },
  { dress: { acuan: 'kiri' } },
)
const dA3 = resolusiDress(sDress, 'a3', anggota)
uji('Dress set "Kiri" = rekan seksi paling S2 (−x), seksi lain & hole diabaikan', dA3?.pemanduId === 'a1' && dA3.teks === 'Luruskan ke: Kiri (A01)' && dA3.dari === 'set', JSON.stringify(dA3))
uji('Pemandu sendiri mendapat "Kamu pemandu dress (Kiri)"', resolusiDress(sDress, 'a1', anggota)?.teks === 'Kamu pemandu dress (Kiri)')
uji('Dress "Tengah" memilih titik terdekat pusat kelompok', resolusiDress({ ...sDress, dress: { acuan: 'tengah' } }, 'a1', anggota)?.pemanduId === 'a2')
const sBentuk = { ...sDress, bentukTerikat: [{ id: 'bt1', memberIds: ['a2', 'a3', 'p1'], dress: { acuan: 'kanan' } }] }
const dBentuk = resolusiDress(sBentuk, 'p1', anggota)
uji('Dress bentuk #22 menimpa dress set & lintas seksi', dBentuk?.pemanduId === 'a3' && dBentuk.dari === 'bentuk' && dBentuk.teks === 'Luruskan ke: Kanan (A03)', JSON.stringify(dBentuk))
uji('Acuan pemandu tertentu', resolusiDress({ ...sDress, dress: { acuan: 'anggota', anggotaId: 'a2' } }, 'a3', anggota)?.teks === 'Luruskan ke: Pemandu (A02)')
uji('Tanpa dress / tanpa titik → null', resolusiDress(set('k', 0, { a1: { x: 0, y: 0 } }), 'a1', anggota) === null && resolusiDress(sDress, 'b1', anggota) === null)

/* ------------------------------------------------------------------ */
console.log('\n== #26.5 Catatan Cleaning terpadu (tindakLanjut) ==')
const T0 = new Date(2026, 10, 4, 18, 0, 0).getTime()
uji('Judul kosong ditolak; spasi dirapikan & dibatasi 160 karakter', buatTindakLanjut({ id: 'x', judul: '   ' }) === null && rapikanJudulTL('  a   b ') === 'a b' && rapikanJudulTL('x'.repeat(200)).length === 160)
const tl1 = buatTindakLanjut({ id: 't1', judul: 'Interval trompet rapat', drillId: 'd1', setId: 's7', setNomor: 7, biramaDari: 25, biramaSampai: 28, seksi: 'brass', sekarang: T0 })
uji('Catatan baru berstatus temuan, sumber cleaning, tanpa id anggota', tl1.status === 'temuan' && tl1.sumber === 'cleaning' && !('memberId' in tl1) && tl1.createdAt === T0)
uji('Siklus status temuan → fokus → beres → temuan', statusBerikut('temuan') === 'fokus' && statusBerikut('fokus') === 'beres' && statusBerikut('beres') === 'temuan')
const tlBeres = ubahStatusTL(tl1, 'beres', T0 + 5)
uji('Beres mencatat beresAt; dibuka lagi menghapusnya', tlBeres.beresAt === T0 + 5 && !('beresAt' in ubahStatusTL(tlBeres, 'fokus', T0 + 6)))
uji('Konteks ringkas "Set 7 · Birama 25–28"', konteksTL(tl1) === 'Set 7 · Birama 25–28' && konteksTL({ setNomor: 2, biramaDari: 5, biramaSampai: 5 }) === 'Set 2 · Birama 5')
const daftarTL = [
  tl1,
  buatTindakLanjut({ id: 't2', judul: 'Snare telat', drillId: 'd1', setNomor: 3, sekarang: T0 + 1 }),
  { ...buatTindakLanjut({ id: 't3', judul: 'Bendera', drillId: 'd1', setNomor: 9, prioritas: 'tinggi', sekarang: T0 + 2 }), status: 'fokus' },
  { ...buatTindakLanjut({ id: 't4', judul: 'Selesai', drillId: 'd1', setNomor: 1, sekarang: T0 + 3 }), status: 'beres', beresAt: T0 + 3 },
  buatTindakLanjut({ id: 't5', judul: 'Drill lain', drillId: 'd2', sekarang: T0 }),
]
uji('Saring per drill & "terbuka" (bukan beres)', saringTindakLanjut(daftarTL, { drillId: 'd1', status: 'terbuka' }).map((t) => t.id).join() === 't1,t2,t3')
uji('Saring per set', saringTindakLanjut(daftarTL, { drillId: 'd1', setId: 's7' }).map((t) => t.id).join() === 't1')
uji('Urutan: fokus → temuan (nomor set) → beres', urutkanTindakLanjut(saringTindakLanjut(daftarTL, { drillId: 'd1' })).map((t) => t.id).join() === 't3,t2,t1,t4')
const jml = hitungStatusTL(daftarTL)
uji('Hitung status', jml.temuan === 3 && jml.fokus === 1 && jml.beres === 1)

/* ------------------------------------------------------------------ */
console.log('\n== #26.6 Lembar Fokus Cleaning Harian A4 ==')
const banyak = Array.from({ length: 30 }, (_, i) =>
  buatTindakLanjut({ id: `c${i}`, judul: `Catatan ${i + 1}`, drillId: 'd1', setNomor: i + 1, sekarang: T0 }),
)
const kemarin = { ...buatTindakLanjut({ id: 'old', judul: 'Beres kemarin', drillId: 'd1', sekarang: T0 - 86400000 }), status: 'beres', beresAt: T0 - 86400000 }
const hariIni = { ...buatTindakLanjut({ id: 'new', judul: 'Beres sore ini', drillId: 'd1', sekarang: T0 - 3600000 }), status: 'beres', beresAt: T0 - 3600000 }
const html = buatLembarFokusCleaningHtml({ namaTim: 'Gita Bahana', namaDrill: 'Show 2026', tanggal: '4 November 2026', daftar: [...banyak, kemarin, hariIni], sekarang: T0 })
const jumlahBaris = (html.match(/<tr[^>]*data-status=/g) ?? []).length
uji('Lembar memakai A4 portrait & penanda data-lembar-cleaning', /size:\s*A4 portrait/.test(html) && html.includes('data-lembar-cleaning="1"'))
uji(`Maksimal ${KAP_BARIS_LEMBAR_CLEANING} baris, sisanya "+n catatan lain"`, KAP_BARIS_LEMBAR_CLEANING === 22 && jumlahBaris === 22 && /\+9 catatan lain/.test(html), `baris=${jumlahBaris}`)
uji('Hanya warna hex/rgb (tanpa oklch, color-mix, rgba)', !/oklch\(|color-mix\(|rgba\(/i.test(html))
const htmlKecil = buatLembarFokusCleaningHtml({ namaTim: 'T', namaDrill: 'D', tanggal: 'x', daftar: [tl1, kemarin, hariIni], sekarang: T0 })
uji('Beres kemarin disembunyikan, beres hari ini tetap tampil', !htmlKecil.includes('Beres kemarin') && htmlKecil.includes('Beres sore ini') && htmlKecil.includes('Interval trompet rapat'))
const htmlXss = buatLembarFokusCleaningHtml({ namaTim: '<b>x</b>', namaDrill: 'D', tanggal: 'x', daftar: [buatTindakLanjut({ id: 'z', judul: '<script>alert(1)</script>', sekarang: T0 })], sekarang: T0 })
uji('Teks pengguna di-escape', !htmlXss.includes('<script>alert') && htmlXss.includes('&lt;script&gt;'))

/* ------------------------------------------------------------------ */
console.log('\n== #26.7 Privasi paket anggota ==')
const bundel = {
  version: 1,
  mode: 'coach',
  team: { teamName: 'T' },
  members: anggota,
  drills: [{ id: 'd1', name: 'D', field: LAPANGAN, holes: [{ id: 'hole_1', label: 'H1', alasan: 'cedera', memberIdAsal: 'a2', createdAt: 1 }] }],
  sets: [],
  attendance: [],
  memberNotes: [],
  tindakLanjut: [tl1],
}
const pg = paketGrup(bundel)
const pa = paketAnggota(bundel, 'a1')
uji('tindakLanjut tidak ikut paket grup/anggota', !('tindakLanjut' in pg) && !('tindakLanjut' in pa))
uji(
  'Alasan hole (cedera) & pemain asalnya dikupas; label tetap',
  [pg, pa].every((p) => p.drills[0].holes[0].label === 'H1' && !('alasan' in p.drills[0].holes[0]) && !('memberIdAsal' in p.drills[0].holes[0])) &&
    bundel.drills[0].holes[0].alasan === 'cedera',
)

console.log(`\nBuku Saku Generasi Baru Logika: ${lulus} lulus, ${gagal} gagal`)
if (gagal > 0) process.exit(1)
