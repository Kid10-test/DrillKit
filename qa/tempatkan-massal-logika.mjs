/**
 * Uji logika v2.11.2 — memasukkan banyak pemain ke satu set sekaligus.
 *
 * Yang dijaga:
 *
 * 1. Pemain yang punya titik di set sebelumnya diletakkan di titik yang sama.
 * 2. Sisanya disusun satu blok per section, mengikuti urutan section,
 *    berjajar dari Side 1 (x positif) ke Side 2, tanpa saling tumpuk.
 * 3. Titik yang sudah ada tidak disentuh; blok baru diletakkan di belakang
 *    (atau di depan bila belakang penuh), dan semuanya tetap di lapangan.
 * 4. "Beruntun" memilih pemain berikutnya yang belum punya titik.
 */
import {
  berikutnyaBelumDitempatkan,
  kelompokkanPerSection,
  kolomBlokUntuk,
  rencanaMasukkanSemua,
} from '/tmp/tempatkanMassal.mjs'

let lulus = 0
const gagal = []
const cek = (nama, syarat, keterangan = '') => {
  if (syarat) lulus += 1
  else gagal.push(`${nama}${keterangan ? ' — ' + keterangan : ''}`)
}

const FOOTBALL = {
  widthYd: 160 / 3,
  lengthYd: 100,
  endZoneYd: 10,
  hash: 'hs',
  step: '8to5',
  customStepYd: 0.625,
  showLabels: 1,
}
// Lapangan terbuka kampus ±40 × 25 m tanpa end zone.
const TERBUKA = { ...FOOTBALL, widthYd: 27.34, lengthYd: 43.74, endZoneYd: 0, hash: 'none' }
const S = 5 / 8

const buat = (n, section, awalan = section) =>
  Array.from({ length: n }, (_, i) => ({ id: `${awalan}${i + 1}`, section }))

const dalamLapangan = (p, f) =>
  Math.abs(p.x) <= f.lengthYd / 2 + f.endZoneYd + 1e-6 && Math.abs(p.y) <= f.widthYd / 2 + 1e-6

const jarakMin = (pts) => {
  const v = Object.values(pts)
  let m = Infinity
  for (let i = 0; i < v.length; i++)
    for (let j = i + 1; j < v.length; j++) m = Math.min(m, Math.hypot(v[i].x - v[j].x, v[i].y - v[j].y))
  return m
}

// ------------------------------------------------------------ bentuk blok
{
  cek('kolom: 1 orang = 1 kolom', kolomBlokUntuk(1) === 1)
  cek('kolom: 4 orang = satu baris', kolomBlokUntuk(4) === 4)
  cek('kolom: 12 orang melebar (baris ≤ kolom)', kolomBlokUntuk(12) >= Math.ceil(12 / kolomBlokUntuk(12)))
  cek('kolom: 0 orang = 0', kolomBlokUntuk(0) === 0)

  const g = kelompokkanPerSection(
    [
      { id: 'a', section: 'guard' },
      { id: 'b', section: 'perkusi' },
      { id: 'c', section: 'brass' },
      { id: 'd', section: 'perkusi' },
      { id: 'e', section: 'lain' },
    ],
    ['brass', 'perkusi', 'guard'],
  )
  cek(
    'kelompok mengikuti urutan section, yang tak tercantum di belakang',
    g.map((x) => x.section).join(',') === 'brass,perkusi,guard,lain',
    g.map((x) => x.section).join(','),
  )
  cek('urutan pemain dalam section tetap', g[1].ids.join(',') === 'b,d')
}

// ---------------------------------------------------- set kosong (drill baru)
{
  const anggota = [...buat(9, 'brass'), ...buat(6, 'perkusi'), ...buat(5, 'guard')]
  const r = rencanaMasukkanSemua(anggota, {}, undefined, FOOTBALL, {
    intervalLangkah: 4,
    urutanSection: ['brass', 'perkusi', 'guard'],
  })
  const ids = Object.keys(r.points)
  cek('drill baru: semua 20 pemain dapat titik', ids.length === 20, String(ids.length))
  cek('drill baru: tidak ada dari set sebelumnya', r.dariSetSebelumnya.length === 0)
  cek('drill baru: 3 blok', r.blok.length === 3)
  cek('drill baru: urutan blok brass → perkusi → guard', r.blok.map((b) => b.section).join() === 'brass,perkusi,guard')
  cek(
    'drill baru: blok berjajar dari Side 1 ke Side 2',
    r.blok[0].pusat.x > r.blok[1].pusat.x && r.blok[1].pusat.x > r.blok[2].pusat.x,
  )
  cek('drill baru: jarak minimum = 4 langkah', Math.abs(jarakMin(r.points) - 4 * S) < 1e-6, String(jarakMin(r.points)))
  cek('drill baru: semua di dalam lapangan', Object.values(r.points).every((p) => dalamLapangan(p, FOOTBALL)))
  cek('drill baru: semua menghadap penonton', Object.values(r.points).every((p) => p.facing === 'front'))
  const xs = Object.values(r.points).map((p) => p.x)
  cek('drill baru: rombongan di tengah', Math.abs(Math.max(...xs) + Math.min(...xs)) < 4 * S + 1e-6)
  // Section tidak bercampur: setiap blok punya rentang x sendiri.
  const rentang = r.blok.map((b) => {
    const x = b.ids.map((id) => r.points[id].x)
    return [Math.min(...x), Math.max(...x)]
  })
  cek('drill baru: blok tidak saling tumpuk', rentang[0][0] > rentang[1][1] && rentang[1][0] > rentang[2][1])
}

// --------------------------------------------- ikut set sebelumnya (set 2)
{
  const anggota = buat(6, 'brass')
  const sebelum = {
    brass1: { x: 10, y: -5, facing: 'front' },
    brass2: { x: 12.5, y: -5, facing: 90, facingDeg: 90 },
    brass3: { x: 15, y: -5, facing: 'front' },
  }
  const sekarang = { brass1: { x: 0, y: 0, facing: 'front' } } // sudah ditempatkan, tidak boleh disentuh
  const r = rencanaMasukkanSemua(anggota, sekarang, sebelum, FOOTBALL, { intervalLangkah: 4 })
  cek('set 2: pemain yang sudah ada tidak ikut', !('brass1' in r.points))
  cek('set 2: brass2 & brass3 di posisi set sebelumnya', r.dariSetSebelumnya.join() === 'brass2,brass3')
  cek('set 2: koordinat sama persis', r.points.brass2.x === 12.5 && r.points.brass2.y === -5)
  cek('set 2: arah hadap ikut', r.points.brass2.facingDeg === 90)
  cek('set 2: sisanya (3) disusun dalam blok', r.blok.length === 1 && r.blok[0].ids.length === 3)
  const yBaru = r.blok[0].ids.map((id) => r.points[id].y)
  cek('set 2: blok baru di belakang titik yang ada', Math.min(...yBaru) > 0, yBaru.join())
  const tanpaIkut = rencanaMasukkanSemua(anggota, sekarang, sebelum, FOOTBALL, { ikutSetSebelumnya: false })
  cek('set 2: opsi ikut set sebelumnya bisa dimatikan', tanpaIkut.dariSetSebelumnya.length === 0 && Object.keys(tanpaIkut.points).length === 5)
}

// ------------------------------------- belakang penuh → blok pindah ke depan
{
  const halfW = FOOTBALL.widthYd / 2
  const sekarang = { x1: { x: 0, y: halfW - 1, facing: 'front' }, x2: { x: 0, y: 0, facing: 'front' } }
  const r = rencanaMasukkanSemua(buat(8, 'guard'), sekarang, undefined, FOOTBALL, { intervalLangkah: 4 })
  const ys = Object.values(r.points).map((p) => p.y)
  cek('belakang penuh: blok diletakkan di depan', Math.max(...ys) < 0, ys.join())
  cek('belakang penuh: tetap di lapangan', Object.values(r.points).every((p) => dalamLapangan(p, FOOTBALL)))
}

// --------------------------------------- lapangan terbuka kecil: blok turun
{
  const anggota = [...buat(14, 'brass'), ...buat(11, 'perkusi'), ...buat(8, 'guard'), ...buat(5, 'mayoret')]
  const r = rencanaMasukkanSemua(anggota, {}, undefined, TERBUKA, {
    intervalLangkah: 6,
    urutanSection: ['brass', 'perkusi', 'guard', 'mayoret'],
  })
  cek('lapangan kecil: 38 pemain dapat titik', Object.keys(r.points).length === 38)
  cek('lapangan kecil: semua di dalam lapangan', Object.values(r.points).every((p) => dalamLapangan(p, TERBUKA)))
  const yBlok = r.blok.map((b) => b.pusat.y)
  cek('lapangan kecil: blok yang tak muat turun ke jajaran berikutnya', new Set(yBlok.map((y) => y.toFixed(2))).size >= 2, yBlok.join())
  cek('lapangan kecil: tidak ada titik kembar', jarakMin(r.points) > 0.5, String(jarakMin(r.points)))
}

// -------------------------------------------------- interval & masukan aneh
{
  const r2 = rencanaMasukkanSemua(buat(4, 'a'), {}, undefined, FOOTBALL, { intervalLangkah: 2 })
  cek('interval 2 langkah dipakai', Math.abs(jarakMin(r2.points) - 2 * S) < 1e-6, String(jarakMin(r2.points)))
  const r0 = rencanaMasukkanSemua(buat(3, 'a'), {}, undefined, FOOTBALL, { intervalLangkah: 0 })
  cek('interval 0 dibulatkan ke 1 langkah', Math.abs(jarakMin(r0.points) - S) < 1e-6)
  const kosong = rencanaMasukkanSemua([], {}, undefined, FOOTBALL)
  cek('tanpa pemain: hasil kosong', Object.keys(kosong.points).length === 0 && kosong.blok.length === 0)
  const tanpaSection = rencanaMasukkanSemua([{ id: 'z', section: '' }], {}, undefined, FOOTBALL)
  cek('section kosong tetap dapat titik', Boolean(tanpaSection.points.z))
}

// --------------------------------------------------------------- beruntun
{
  const ada = new Set(['b', 'd'])
  const sudah = (id) => ada.has(id)
  const urut = ['a', 'b', 'c', 'd', 'e']
  cek('beruntun: sesudah a → c (b sudah ada)', berikutnyaBelumDitempatkan(urut, sudah, 'a') === 'c')
  cek('beruntun: sesudah e berputar ke a', berikutnyaBelumDitempatkan(urut, sudah, 'e') === 'a')
  cek('beruntun: tanpa id kini → yang pertama', berikutnyaBelumDitempatkan(urut, sudah, null) === 'a')
  cek('beruntun: tidak memilih dirinya sendiri', berikutnyaBelumDitempatkan(['a'], () => false, 'a') === null)
  cek('beruntun: semua sudah ada → null', berikutnyaBelumDitempatkan(urut, () => true, 'a') === null)
  cek('beruntun: daftar kosong → null', berikutnyaBelumDitempatkan([], sudah, null) === null)
}

console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) {
  console.log('GAGAL:\n - ' + gagal.join('\n - '))
  process.exit(1)
}
