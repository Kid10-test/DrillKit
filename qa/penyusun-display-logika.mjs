/**
 * Uji logika v2.12 — Penyusun Display Latihan.
 *
 * Yang dijaga:
 *
 * 1. Basics block 58 orang = 9 banjar, brass di dua sisi, perkusi di tengah,
 *    guard di saf belakang; blok simetris terhadap A.
 * 2. Setiap dot berada di dalam lapangan dan di langkah bulat dari A dan T0.
 * 3. Tidak ada dua pemain di dot yang sama; jarak dot ≥ 2 langkah bila
 *    lapangan cukup.
 * 4. Hitungan dinaikkan (kelipatan 8) sampai langkah terbesar ≤ 8 to 5.
 * 5. Di lapangan sepak bola, semua konsep untuk 58/44/25/12 orang bebas
 *    papasan (≥ 1,5 langkah); di lapangan sempit penyusun memadatkan dan
 *    memberi peringatan, bukan diam-diam menumpuk.
 * 6. Pit diam di depan, pemimpin di depan tengah, peran ditebak dari section.
 * 7. Penugasan Hungarian benar (dibanding brute force kecil).
 */
import {
  KONSEP_DISPLAY,
  JARAK_PAPASAN_MIN,
  jarakDotTerdekat,
  konsepById,
  peranDisplay,
  susunDisplay,
  teksCountSheet,
  tugaskan,
  ukurTransisi,
} from '/tmp/penyusunDisplay.mjs'

let lulus = 0
const gagal = []
const cek = (nama, syarat, keterangan = '') => {
  if (syarat) lulus += 1
  else gagal.push(`${nama}${keterangan ? ' — ' + keterangan : ''}`)
}

const S = 5 / 8
const M_TO_YD = 1.09361 // sama dengan src/lib/field.ts
const DASAR = { hash: 'none', step: '8to5', customStepYd: S, showLabels: 1, endZoneYd: 0 }
// Sama dengan preset `sepakbola` (105 × 68 m) dan `indoor` (40 × 20 m).
const BOLA = { ...DASAR, widthYd: 68 * M_TO_YD, lengthYd: 105 * M_TO_YD }
const INDOOR = { ...DASAR, widthYd: 20 * M_TO_YD, lengthYd: 40 * M_TO_YD }
// Student Center perkiraan kasar 30 × 18 m: dipakai untuk melihat perilaku "sempit".
const SC_KECIL = { ...DASAR, widthYd: 18 * M_TO_YD, lengthYd: 30 * M_TO_YD }

const pemain = (n, section, labelSection, awalan) =>
  Array.from({ length: n }, (_, i) => ({
    id: `${awalan}${i}`,
    section,
    labelSection,
    code: `${awalan.toUpperCase()}${String(i + 1).padStart(2, '0')}`,
  }))
const tim = (brass, perkusi, guard, ekstra = []) => [
  ...pemain(brass, 'brass', 'Brass', 'b'),
  ...pemain(perkusi, 'sec_perkusi', 'Perkusi', 'p'),
  ...pemain(guard, 'sec_cg', 'Colour Guard', 'g'),
  ...ekstra,
]
// Komposisi realistis rekrutan MBA: 58 orang.
const TIM58 = tim(24, 16, 18)
const TIM44 = tim(18, 11, 15)
const TIM25 = tim(10, 6, 9)
const TIM12 = tim(5, 3, 4)

const batas = (f) => ({
  minX: -f.lengthYd / 2,
  maxX: f.lengthYd / 2,
  minY: -f.widthYd / 2,
  maxY: f.widthYd / 2,
})
const bulatLangkah = (v) => Math.abs(v / S - Math.round(v / S)) < 1e-6

// ------------------------------------------------------------ peran
{
  cek('peran: Brass', peranDisplay({ section: 'brass', labelSection: 'Brass' }) === 'brass')
  cek('peran: Perkusi (id acak)', peranDisplay({ section: 'sec_mwam02rc916r8u', labelSection: 'Perkusi' }) === 'perkusi')
  cek('peran: Battery', peranDisplay({ section: 'percussion', labelSection: 'Battery' }) === 'perkusi')
  cek('peran: Colour Guard', peranDisplay({ section: 'sec_x', labelSection: 'Colour Guard' }) === 'guard')
  cek('peran: Color Guard bawaan', peranDisplay({ section: 'guard', labelSection: 'Color Guard' }) === 'guard')
  cek('peran: Pit', peranDisplay({ section: 'pit', labelSection: 'Pit' }) === 'pit')
  cek('peran: FC', peranDisplay({ section: 'fc', labelSection: 'FC' }) === 'pemimpin')
  cek('peran: drum major lewat role', peranDisplay({ section: 'brass', labelSection: 'Brass', role: 'drumMajor' }) === 'pemimpin')
  cek('peran: lainnya', peranDisplay({ section: 'other', labelSection: 'Lainnya' }) === 'lain')
}

// ------------------------------------------------------------ konsep
{
  cek('konsep: 7 konsep', KONSEP_DISPLAY.length === 7)
  cek('konsep: id 1..7 berurutan', KONSEP_DISPLAY.every((k, i) => k.id === i + 1))
  cek(
    'konsep: jumlah hitungan = jumlah set − 1',
    KONSEP_DISPLAY.every((k) => k.hitungan.length === k.momen.length - 1 && k.fokus.length === k.hitungan.length),
  )
  cek('konsep: Konsep 1 tanpa alat', /tanpa alat/i.test(konsepById(1).alat))
  cek('konsep: id tak dikenal → Konsep 1', konsepById(99).id === 1)
}

// ------------------------------------------------------------ basics block 58
{
  const h = susunDisplay(TIM58, { konsep: 1, field: BOLA })
  const blok = h.sets[0].points
  const musik = TIM58.filter((p) => p.id[0] !== 'g')
  const kolom = new Set(musik.map((p) => blok[p.id].x.toFixed(3)))
  cek('blok 58: 9 banjar', kolom.size === 9, `dapat ${kolom.size}`)
  cek('blok 58: interval blok 4 langkah', h.interval.blok === 4)
  const xs = [...kolom].map(Number).sort((a, b) => a - b)
  cek('blok 58: banjar berjarak 4 langkah', xs.every((x, i) => i === 0 || Math.abs(x - xs[i - 1] - 4 * S) < 1e-6))
  cek('blok 58: simetris terhadap A', Math.abs(xs[0] + xs[xs.length - 1]) < 1e-6)
  const maxYMusik = Math.max(...musik.map((p) => blok[p.id].y))
  const minYGuard = Math.min(...TIM58.filter((p) => p.id[0] === 'g').map((p) => blok[p.id].y))
  cek('blok 58: guard di belakang musik', minYGuard > maxYMusik)
  const xP = TIM58.filter((p) => p.id[0] === 'p').map((p) => Math.abs(blok[p.id].x))
  const xB = TIM58.filter((p) => p.id[0] === 'b').map((p) => Math.abs(blok[p.id].x))
  cek('blok 58: perkusi di pita tengah', Math.max(...xP) < Math.min(...xB))
  // Tiap kolom hanya satu kelompok (tidak ada kolom campuran).
  const isiKolom = {}
  for (const p of musik) (isiKolom[blok[p.id].x.toFixed(3)] ??= new Set()).add(p.id[0])
  cek('blok 58: kolom tidak campuran', Object.values(isiKolom).every((s) => s.size === 1))
  const b = batas(BOLA)
  const t0 = b.minY
  const depan = Math.min(...Object.values(blok).map((p) => p.y))
  cek('blok 58: garis depan 8 langkah dari T0', Math.abs((depan - t0) / S - 8) < 1e-6, `${((depan - t0) / S).toFixed(2)}`)
  cek('blok 58: kode B01 di depan Side 1', blok.b0.x > 0 && blok.b0.y === depan)
}

// ------------------------------------------------------------ semua konsep × lapangan × jumlah
const kasus = [
  ['bola', BOLA, TIM58],
  ['bola', BOLA, TIM44],
  ['bola', BOLA, TIM25],
  ['bola', BOLA, TIM12],
  ['indoor', INDOOR, TIM44],
  ['indoor', INDOOR, TIM25],
  ['indoor', INDOOR, TIM12],
  ['indoor', INDOOR, TIM58],
  ['sc-kecil', SC_KECIL, TIM58],
]
for (const [namaF, f, t] of kasus) {
  const b = batas(f)
  for (const k of KONSEP_DISPLAY) {
    const label = `${namaF} ${t.length} K${k.id}`
    const h = susunDisplay(t, { konsep: k.id, field: f })
    cek(`${label}: jumlah set`, h.sets.length === k.momen.length)
    cek(`${label}: jumlah transisi`, h.transisi.length === k.momen.length - 1)
    let semuaAda = true
    let diLapangan = true
    let bulat = true
    let unik = true
    for (const st of h.sets) {
      const ids = Object.keys(st.points)
      if (ids.length !== t.length || !t.every((p) => st.points[p.id])) semuaAda = false
      const seen = new Set()
      for (const p of Object.values(st.points)) {
        if (p.x < b.minX - 1e-6 || p.x > b.maxX + 1e-6 || p.y < b.minY - 1e-6 || p.y > b.maxY + 1e-6) diLapangan = false
        if (!bulatLangkah(p.x) || !bulatLangkah(p.y - b.minY)) bulat = false
        const key = `${p.x.toFixed(3)},${p.y.toFixed(3)}`
        if (seen.has(key)) unik = false
        seen.add(key)
      }
    }
    cek(`${label}: semua pemain punya dot di tiap set`, semuaAda)
    const adaPeringatanKeluar = h.peringatan.some((p) => /keluar dari lapangan/.test(p))
    cek(`${label}: dot di lapangan, atau diperingatkan`, diLapangan || adaPeringatanKeluar)
    if (namaF === 'bola' || t.length <= 44) cek(`${label}: semua dot di lapangan`, diLapangan)
    cek(`${label}: dot di langkah bulat dari A dan T0`, bulat)
    cek(`${label}: tidak ada dot ganda`, unik)
    // Hitungan kelipatan 8 dan langkah ≤ 8 to 5.
    const okHitungan = h.transisi.every((tr) => tr.counts % 8 === 0 && tr.counts >= 16 && tr.langkahPerHitungan <= 1 + 1e-9)
    cek(`${label}: hitungan kelipatan 8, langkah ≤ 8 to 5`, okHitungan, JSON.stringify(h.transisi.map((x) => [x.counts, x.langkahPerHitungan])))
    // Hitungan di transisi = counts set asal (dipakai editor).
    cek(`${label}: counts set = counts transisi`, h.transisi.every((tr, i) => tr.counts === h.sets[i].counts))
    // Peringatan hitungan muncul tepat bila dinaikkan.
    const naik = h.transisi.some((tr, i) => tr.counts > k.hitungan[i])
    cek(`${label}: peringatan hitungan sesuai`, naik === h.peringatan.some((p) => /hitungan dinaikkan/.test(p)))
    if (namaF === 'bola') {
      const papasan = Math.min(...h.transisi.map((tr) => tr.jarakMinLangkah))
      cek(`${label}: bebas papasan (≥ ${JARAK_PAPASAN_MIN})`, papasan >= JARAK_PAPASAN_MIN, `min ${papasan}`)
      const rapat = Math.min(...h.sets.map((st) => jarakDotTerdekat(st.points, S)))
      cek(`${label}: dot ≥ 2 langkah`, rapat >= 2 - 1e-6, `min ${rapat.toFixed(2)}`)
      cek(`${label}: interval tidak dipadatkan`, h.interval.musik === 3 && h.interval.guard === 6 && h.interval.blok === 4)
      cek(`${label}: tanpa peringatan papasan/rapat`, !h.peringatan.some((p) => /berpapasan|hanya berjarak/.test(p)))
    }
    // Setiap papasan < 1,5 atau dot rapat harus tercatat, di lapangan mana pun.
    const adaPapasan = h.transisi.some((tr) => tr.jarakMinLangkah < JARAK_PAPASAN_MIN)
    cek(`${label}: papasan dekat selalu diperingatkan`, !adaPapasan || h.peringatan.some((p) => /berpapasan/.test(p)))
    const adaRapat = h.sets.some((st) => jarakDotTerdekat(st.points, S) < JARAK_PAPASAN_MIN)
    cek(`${label}: dot rapat selalu diperingatkan`, !adaRapat || h.peringatan.some((p) => /hanya berjarak/.test(p)))
    const dipadatkan = h.interval.musik < 3 || h.interval.guard < 6 || h.interval.blok < 4
    cek(`${label}: pemadatan diperingatkan`, !dipadatkan || h.peringatan.some((p) => /dipadatkan/.test(p)))
  }
}

// ------------------------------------------------------------ lapangan sempit
{
  const h = susunDisplay(TIM58, { konsep: 3, field: SC_KECIL })
  cek('sempit: interval musik dipadatkan', h.interval.musik < 3)
  cek('sempit: ada peringatan', h.peringatan.length > 0)
  const h2 = susunDisplay(TIM12, { konsep: 1, field: INDOOR })
  cek('indoor 12: tidak dipadatkan', h2.interval.musik === 3 && h2.interval.blok === 4)
}

// ------------------------------------------------------------ konsep 1 pendek untuk kelompok kecil
{
  const h12 = susunDisplay(TIM12, { konsep: 1, field: BOLA })
  cek('K1 12 orang: tetap 16 hitungan', h12.transisi[0].counts === 16, `${h12.transisi[0].counts}`)
  const h44 = susunDisplay(TIM44, { konsep: 1, field: BOLA })
  cek('K1 44 orang: 16 hitungan', h44.transisi[0].counts === 16, `${h44.transisi[0].counts}`)
  const cf = h44.sets[1].points
  const yDepan = Math.min(...Object.values(cf).map((p) => p.y))
  const garisDepan = Object.entries(cf).filter(([, p]) => Math.abs(p.y - yDepan) < 1e-6)
  const xsP = garisDepan.filter(([id]) => id[0] === 'p').map(([, p]) => Math.abs(p.x))
  const xsB = garisDepan.filter(([id]) => id[0] === 'b').map(([, p]) => Math.abs(p.x))
  cek('K1: perkusi di tengah garis depan', xsP.length > 0 && Math.max(...xsP) < Math.min(...xsB))
}

// ------------------------------------------------------------ pit & pemimpin
{
  const ekstra = [
    ...pemain(3, 'pit', 'Pit', 'k'),
    { id: 'fc1', section: 'fc', labelSection: 'FC', code: 'FC1' },
  ]
  const t = tim(12, 8, 8, ekstra)
  const h = susunDisplay(t, { konsep: 2, field: BOLA })
  const t0 = batas(BOLA).minY
  const pitTetap = h.sets.every((st, i) => i === 0 || ['k0', 'k1', 'k2'].every((id) => st.points[id].x === h.sets[0].points[id].x && st.points[id].y === h.sets[0].points[id].y))
  cek('pit: tidak bergerak antar-set', pitTetap)
  cek('pit: di depan semua pemain lain', h.sets.every((st) => ['k0', 'k1', 'k2'].every((id) => Object.entries(st.points).every(([oid, p]) => oid[0] === 'k' || oid === 'fc1' || st.points[id].y < p.y))))
  cek('pemimpin: di A', h.sets.every((st) => st.points.fc1.x === 0))
  cek('pemimpin: antara T0 dan garis depan', h.sets.every((st) => st.points.fc1.y > t0))
  cek('jumlah: pit 3, pemimpin 1', h.jumlah.pit === 3 && h.jumlah.pemimpin === 1)
}

// ------------------------------------------------------------ kosong & satu orang
{
  const h = susunDisplay([], { konsep: 1, field: BOLA })
  cek('kosong: tanpa set', h.sets.length === 0)
  cek('kosong: ada peringatan', h.peringatan.length === 1)
  const h1 = susunDisplay(tim(1, 0, 0), { konsep: 5, field: BOLA })
  cek('satu orang: tetap tersusun', h1.sets.length === 3 && h1.sets.every((s) => s.points.b0))
  const hg = susunDisplay(tim(0, 0, 6), { konsep: 6, field: BOLA })
  cek('hanya guard: tetap tersusun', hg.sets.every((s) => Object.keys(s.points).length === 6))
}

// ------------------------------------------------------------ Hungarian
{
  const permutasi = (a) => (a.length <= 1 ? [a] : a.flatMap((x, i) => permutasi([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p])))
  let acak = 7
  const rnd = () => ((acak = (acak * 16807) % 2147483647) / 2147483647)
  let semuaOptimal = true
  for (let uji = 0; uji < 40; uji++) {
    const n = 1 + (uji % 6)
    const c = Array.from({ length: n }, () => Array.from({ length: n }, () => Math.round(rnd() * 100)))
    const hasil = tugaskan(c)
    const biaya = hasil.reduce((s, j, i) => s + c[i][j], 0)
    const terbaik = Math.min(...permutasi([...Array(n).keys()]).map((p) => p.reduce((s, j, i) => s + c[i][j], 0)))
    if (biaya !== terbaik || new Set(hasil).size !== n) semuaOptimal = false
  }
  cek('hungarian: sama dengan brute force (40 matriks acak)', semuaOptimal)
  cek('hungarian: matriks kosong', tugaskan([]).length === 0)
}

// ------------------------------------------------------------ ukurTransisi
{
  const a = { x: { x: 0, y: 0 }, y: { x: 10 * S, y: 0 } }
  const b = { x: { x: 10 * S, y: 0 }, y: { x: 0, y: 0 } }
  const u = ukurTransisi(a, b, 16, S)
  cek('ukur: tukar tempat → papasan 0', u.jarakMinLangkah < 1e-6)
  cek('ukur: 10 langkah / 16 hitungan', Math.abs(u.langkahPerHitungan - 10 / 16) < 1e-9)
}

// ------------------------------------------------------------ count sheet
{
  const h = susunDisplay(TIM44, { konsep: 3, field: BOLA })
  const teks = teksCountSheet(h)
  const baris = teks.split('\n')
  cek('count sheet: judul konsep', baris[0] === 'Konsep 3 — Busur ke Baji')
  cek('count sheet: satu baris per set + tahan', baris.length === 1 + h.sets.length + 1)
  const total = h.transisi.reduce((s, t) => s + t.counts, 0)
  cek('count sheet: hitungan tersambung', baris[baris.length - 2].endsWith(`–${total}`), baris[baris.length - 2])
  cek('count sheet: tanpa angka desimal', !/\d\.\d/.test(teks))
}

console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) {
  console.log('GAGAL:\n - ' + gagal.join('\n - '))
  process.exit(1)
}
