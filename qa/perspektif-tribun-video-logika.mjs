/**
 * Uji murni #25 — Pratinjau Perspektif Tribun Juri (Press Box View 2,5D),
 * Deteksi Halangan Pandang 3D, Kontras Seragam/Bendera WCAG 2.1, & Jadwal Video (.webm).
 *
 * Pakai: bash qa/bangun-logika.sh && node qa/perspektif-tribun-video-logika.mjs
 */

import {
  DAFTAR_PRESET_SUDUT_TRIBUN,
  DAFTAR_PRESET_LATAR_TRIBUN,
  SKEMA_VISUAL_TRIBUN_BAWAAN,
  normalisasiSkemaVisualTribun,
  luminansiRelatifHex,
  hitungRasioKontrasHex,
  evaluasiKontrasVisual,
  buatKameraTribun,
  interpolasiBingkaiShow,
  deteksiHalanganPandang,
} from '/tmp/perspektifTribun.mjs'
import {
  pilihMimeVideoWebm,
  susunJadwalWaktuVideo,
} from '/tmp/eksporVideoDrill.mjs'

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

console.log('\n== #25.1 Proyeksi Perspektif 2,5D Tribun Juri (4 Preset Sudut) ==')

const LAPANGAN_STD = {
  preset: 'football',
  lengthYd: 100,
  widthYd: 53.3333,
  endZoneYd: 10,
  hash: 'college',
  gridYd: 5,
  step: '8to5',
  customStepYd: 0.625,
  showLabels: true,
}

const LAPANGAN_INDOOR = {
  preset: 'indoor',
  lengthYd: 32.808,
  widthYd: 21.872,
  endZoneYd: 0,
  hash: 'none',
  gridYd: 2,
  step: '8to5',
  customStepYd: 0.625,
  showLabels: true,
}

uji(
  'Tersedia tepat 4 preset sudut pandang tribun (Podium 3m, Tribun Rendah 8m, Press Box 18m, Atas 90°)',
  DAFTAR_PRESET_SUDUT_TRIBUN.length === 4 &&
    DAFTAR_PRESET_SUDUT_TRIBUN.map((p) => p.id).join(',') === 'podium,tribun_rendah,press_box,atas' &&
    DAFTAR_PRESET_SUDUT_TRIBUN[0].tinggiMataM === 3 &&
    DAFTAR_PRESET_SUDUT_TRIBUN[1].tinggiMataM === 8 &&
    DAFTAR_PRESET_SUDUT_TRIBUN[2].tinggiMataM === 18,
)

for (const p of DAFTAR_PRESET_SUDUT_TRIBUN) {
  const kam = buatKameraTribun(LAPANGAN_STD, p.id, 960, 540)
  const depanTengah = kam.proyeksikan(0, -26.666, 0)
  const belakangTengah = kam.proyeksikan(0, 26.666, 0)
  const sisi1 = kam.proyeksikan(40, 0, 0)
  const sisi2 = kam.proyeksikan(-40, 0, 0)

  uji(
    `Preset ${p.id}: garis depan tampil di bawah garis belakang & Sisi 1 (+x) di sebelah kiri Sisi 2 (-x)`,
    depanTengah.sy > belakangTengah.sy && sisi1.sx < sisi2.sx,
    `depan.sy=${depanTengah.sy.toFixed(1)}, blkg.sy=${belakangTengah.sy.toFixed(1)}, s1.sx=${sisi1.sx.toFixed(1)}, s2.sx=${sisi2.sx.toFixed(1)}`,
  )

  const pojok = [
    kam.proyeksikan(-60, -26.666, 0),
    kam.proyeksikan(60, -26.666, 0),
    kam.proyeksikan(-60, 26.666, 0),
    kam.proyeksikan(60, 26.666, 0),
    kam.proyeksikan(0, -26.666, 3.5),
  ]
  const semuaMasuk = pojok.every(
    (pt) => pt.sx >= 0 && pt.sx <= 960 && pt.sy >= 0 && pt.sy <= 540,
  )
  uji(`Preset ${p.id}: seluruh pojok lapangan + menara 3,5 m termuat utuh dalam kanvas 960×540`, semuaMasuk)
}

const kamPressBox = buatKameraTribun(LAPANGAN_STD, 'press_box', 960, 540)
const lebarDepanPx =
  kamPressBox.proyeksikan(-50, -26.666, 0).sx - kamPressBox.proyeksikan(50, -26.666, 0).sx
const lebarBelakangPx =
  kamPressBox.proyeksikan(-50, 26.666, 0).sx - kamPressBox.proyeksikan(50, 26.666, 0).sx
const dasar50 = kamPressBox.proyeksikan(0, 0, 0)
const puncakPlume50 = kamPressBox.proyeksikan(0, 0, 2.0)

uji(
  'Press Box 18 m menghasilkan trapesium perspektif (garis depan tampak lebih lebar daripada garis belakang)',
  lebarDepanPx > lebarBelakangPx * 1.15,
  `depan=${lebarDepanPx.toFixed(1)}px vs belakang=${lebarBelakangPx.toFixed(1)}px`,
)
uji(
  'Tinggi vertikal z > 0 m terproyeksi naik ke atas layar (sy puncak plume < sy telapak kaki)',
  puncakPlume50.sy < dasar50.sy - 6,
  `puncak=${puncakPlume50.sy.toFixed(1)} vs kaki=${dasar50.sy.toFixed(1)}`,
)

const kamAtas = buatKameraTribun(LAPANGAN_STD, 'atas', 960, 540)
const atasDepanW = kamAtas.proyeksikan(-50, -26.666, 0).sx - kamAtas.proyeksikan(50, -26.666, 0).sx
const atasBlkgW = kamAtas.proyeksikan(-50, 26.666, 0).sx - kamAtas.proyeksikan(50, 26.666, 0).sx
uji(
  'Preset Atas (90°) bersifat ortografis murni (lebar depan === lebar belakang)',
  Math.abs(atasDepanW - atasBlkgW) < 0.01,
)

const kamIndoor = buatKameraTribun(LAPANGAN_INDOOR, 'tribun_rendah', 960, 540)
uji(
  'Lapangan Indoor/GOR 30×20 m terbingkai proporsional di tengah kanvas',
  kamIndoor.proyeksikan(-16, -10.9, 0).sx <= 950 && kamIndoor.proyeksikan(16, -10.9, 0).sx >= 10,
)

console.log('\n== #25.2 Deteksi Halangan Pandang 3D (Properti Panggung & Barisan Depan) ==')

const PEMAIN_PROP = [
  {
    id: 'm_solo',
    anggota: { id: 'm_solo', code: 'T1', name: 'Solois Terompet', section: 'brass' },
    x: 0,
    y: -14,
    facingDeg: 180,
    sedangMelangkah: false,
    faseLangkahRad: 0,
    apakahGuard: false,
  },
  {
    id: 'm_kru',
    anggota: { id: 'm_kru', code: 'K1', name: 'Kru Pendorong', section: 'pit' },
    x: -1.5,
    y: -19.2,
    facingDeg: 180,
    sedangMelangkah: false,
    faseLangkahRad: 0,
    apakahGuard: false,
  },
  {
    id: 'm_sisi1',
    anggota: { id: 'm_sisi1', code: 'T2', name: 'Sayap Kiri', section: 'brass' },
    x: 12,
    y: -14,
    facingDeg: 180,
    sedangMelangkah: false,
    faseLangkahRad: 0,
    apakahGuard: false,
  },
]

const PROP_BACKDROP = [
  {
    id: 'prop_backdrop',
    label: 'Backdrop Tengah',
    jenis: 'kotak',
    x: -2,
    y: -18.75,
    x2: 2,
    y2: -17.25,
    rotasi: 0,
    tinggiMeter: 2.4,
    warna: '#475569',
    kruIds: ['m_kru'],
  },
]

const kamPodium = buatKameraTribun(LAPANGAN_STD, 'podium', 960, 540)
const halanganPodium = deteksiHalanganPandang({
  kamera: kamPodium,
  pemain: PEMAIN_PROP,
  markers: PROP_BACKDROP,
  tinggiPemainMeter: 1.7,
})
const halanganPressBox = deteksiHalanganPandang({
  kamera: kamPressBox,
  pemain: PEMAIN_PROP,
  markers: PROP_BACKDROP,
  tinggiPemainMeter: 1.7,
})
const halanganAtas = deteksiHalanganPandang({
  kamera: kamAtas,
  pemain: PEMAIN_PROP,
  markers: PROP_BACKDROP,
  tinggiPemainMeter: 1.7,
})

uji(
  'Dari Podium Gitapati (3 m), pemain di belakang backdrop 2,4 m terdeteksi TERTUTUP PROPERTI (kru pendorong dikecualikan)',
  halanganPodium.length === 1 &&
    halanganPodium[0].idPemain === 'm_solo' &&
    halanganPodium[0].jenis === 'tertutup_properti' &&
    halanganPodium[0].persenTertutup >= 50,
  JSON.stringify(halanganPodium),
)
uji(
  'Dari Press Box Juri (18 m), garis pandang curam melampaui atas backdrop 2,4 m sehingga pemain yang sama terlihat jelas',
  halanganPressBox.length === 0,
  JSON.stringify(halanganPressBox),
)
uji('Sudut Atas (90°) menghasilkan 0 halangan vertikal', halanganAtas.length === 0)

const PEMAIN_SEGARIS = [
  {
    id: 'm_depan',
    anggota: { id: 'm_depan', code: 'B1', name: 'Baris Depan', section: 'brass' },
    x: 0,
    y: -16,
    facingDeg: 180,
    sedangMelangkah: false,
    faseLangkahRad: 0,
    apakahGuard: false,
  },
  {
    id: 'm_belakang_segaris',
    anggota: { id: 'm_belakang_segaris', code: 'B2', name: 'Belakang Segaris', section: 'brass' },
    x: 0,
    y: -14.2,
    facingDeg: 180,
    sedangMelangkah: false,
    faseLangkahRad: 0,
    apakahGuard: false,
  },
  {
    id: 'm_belakang_window',
    anggota: { id: 'm_belakang_window', code: 'B3', name: 'Belakang Selang-Seling', section: 'brass' },
    x: 1.25,
    y: -14.2,
    facingDeg: 180,
    sedangMelangkah: false,
    faseLangkahRad: 0,
    apakahGuard: false,
  },
]

const halanganBarisan = deteksiHalanganPandang({
  kamera: kamPodium,
  pemain: PEMAIN_SEGARIS,
  markers: [],
  tinggiPemainMeter: 1.72,
})

uji(
  'Barisan segaris (x sama) terdeteksi tertutup siluet pemain depan dari Podium 3 m, sedangkan posisi selang-seling (windowing) aman',
  halanganBarisan.some((h) => h.idPemain === 'm_belakang_segaris' && h.jenis === 'tertutup_pemain') &&
    !halanganBarisan.some((h) => h.idPemain === 'm_belakang_window'),
  JSON.stringify(halanganBarisan),
)

console.log('\n== #25.2b Simulasi Kontras Seragam & Bendera Color Guard (WCAG 2.1) ==')

uji(
  'Rasio kontras WCAG 2.1 hitam vs putih tepat 21,00:1 & warna identik tepat 1,00:1',
  Math.abs(hitungRasioKontrasHex('#ffffff', '#000000') - 21) < 0.01 &&
    Math.abs(hitungRasioKontrasHex('#166534', '#166534') - 1) < 0.01 &&
    luminansiRelatifHex('#ffffff') > 0.99,
)

const evaluasiTenggelam = evaluasiKontrasVisual(
  {
    latar: 'rumput_stadion',
    jaketHex: '#15803d', // hijau senada rumput -> tenggelam!
    celanaHex: '#f8fafc', // putih terang -> tajam!
    plumeHex: '#facc15', // emas terang -> tajam!
    warnaBenderaHex: '#f43f5e',
    tinggiPemainMeter: 1.72,
  },
  LAPANGAN_STD,
  [{ label: 'Bendera Blok Pembuka', warnaHex: '#166534' }],
)

const butirJaket = evaluasiTenggelam.butir.find((b) => b.id === 'jaket')
const butirCelana = evaluasiTenggelam.butir.find((b) => b.id === 'celana')
const butirBendera0 = evaluasiTenggelam.butir.find((b) => b.id === 'bendera_blok_0')

uji(
  'Jaket & bendera hijau tua di atas rumput stadion terdeteksi TENGGELAM, sementara celana putih TAJAM',
  butirJaket?.tingkat === 'tenggelam' &&
    butirBendera0?.tingkat === 'tenggelam' &&
    butirCelana?.tingkat === 'tajam' &&
    evaluasiTenggelam.jmlTenggelam === 2 &&
    DAFTAR_PRESET_LATAR_TRIBUN.length >= 4,
  JSON.stringify({ butirJaket, butirCelana, butirBendera0 }),
)

console.log('\n== #25.2c Interpolasi Bingkai Pertunjukan (Midsets #23 + CountSheet #17 + Toss) ==')

const SETS_UJI = [
  {
    id: 's1',
    name: '1',
    counts: 8,
    points: {
      g1: { x: -10, y: 0, facing: 'custom', facingDeg: 350 },
    },
    midsets: {
      // Di p=0,5 pemain berbelok lewat (x=0, y=-6)
      g1: [{ padaCount: 4, x: 0, y: -6 }],
    },
  },
  {
    id: 's2',
    name: '2',
    counts: 8,
    points: {
      g1: { x: 10, y: 0, facing: 'custom', facingDeg: 10 },
    },
  },
]

const ANGGOTA_UJI = [
  { id: 'g1', code: 'CG1', name: 'Ayu', section: 'color_guard', instrument: 'Flag' },
]

const LEMBAR_GUARD = [
  {
    id: 'cs1',
    drillId: 'd1',
    judul: 'Koreo Opener',
    blok: [
      {
        id: 'b1',
        setId: 's1',
        counts: 8,
        alat: 'flag',
        istilah: 'toss',
        labelBagian: 'Opener Ungu',
        aksenCount: [4],
        warnaBendera: '#a855f7',
      },
    ],
  },
]

const MARKERS_UJI = [
  {
    id: 'p1',
    label: 'Rampa Guard',
    jenis: 'kotak',
    x: -6.5,
    y: 4,
    x2: -3.5,
    y2: 6,
    rotasi: 0,
    warna: '#475569',
    tinggiMeter: 1.8,
    perSet: {
      s1: { x: -6.5, y: 4, x2: -3.5, y2: 6, rotasi: 0 },
      s2: { x: 3.5, y: 4, x2: 6.5, y2: 6, rotasi: 90 },
    },
  },
]

// p = 0.5 pada counts=8 -> hitunganSaatIni = 4 (tepat pada aksenCount [4]!)
const bingkaiTengah = interpolasiBingkaiShow({
  sets: SETS_UJI,
  idxSet: 0,
  p: 0.5,
  anggota: ANGGOTA_UJI,
  markers: MARKERS_UJI,
  countSheets: LEMBAR_GUARD,
  skemaVisual: normalisasiSkemaVisualTribun(SKEMA_VISUAL_TRIBUN_BAWAAN),
})

uji(
  'Interpolasi bingkai menghormati kurva Midsets (#23), pergerakan properti (#16.4), warna bendera blok CountSheet (#17), & lonjakan Toss',
  Math.abs(bingkaiTengah.pemain[0].x - 0) < 0.01 &&
    Math.abs(bingkaiTengah.pemain[0].y - -6) < 0.01 &&
    Math.abs(bingkaiTengah.pemain[0].facingDeg - 0) < 0.01 &&
    bingkaiTengah.pemain[0].warnaBenderaHex === '#a855f7' &&
    bingkaiTengah.pemain[0].sedangTossGuard === true &&
    Math.abs((bingkaiTengah.markers[0].x + (bingkaiTengah.markers[0].x2 ?? 0)) / 2 - 0) < 0.01 &&
    Math.abs((bingkaiTengah.markers[0].rotasi ?? 0) - 45) < 0.01,
  JSON.stringify(bingkaiTengah),
)

console.log('\n== #25.3 Penjadwal Waktu Ekspor Video (.webm) ==')

const DRILL_UJI = {
  id: 'd1',
  name: 'Show Uji',
  tempo: 120,
  beatsPerCount: 1,
  field: LAPANGAN_STD,
  sets: SETS_UJI,
}

const jadwalPenuh = susunJadwalWaktuVideo({
  drill: DRILL_UJI,
  sets: SETS_UJI,
  cakupan: 'seluruh_show',
  idxSetAktif: 0,
})

uji(
  'Jadwal seluruh show 2 set (8 hit @ 120 BPM) menghitung durasi transisi tepat 4,00 dtk',
  Math.abs(jadwalPenuh.totalDetik - 4.0) < 0.01 &&
    jadwalPenuh.segmen.length === 1 &&
    jadwalPenuh.segmen[0].counts === 8 &&
    Math.abs(jadwalPenuh.segmen[0].durasiDetik - 4.0) < 0.01 &&
    jadwalPenuh.segmen[0].adaPerpindahan === true,
  JSON.stringify(jadwalPenuh),
)

const jadwalPoseAkhir = susunJadwalWaktuVideo({
  drill: DRILL_UJI,
  sets: SETS_UJI,
  cakupan: 'set_aktif',
  idxSetAktif: 1,
})

uji(
  'Set terakhir tanpa set tujuan merekam tahan formasi (hold pose) selama 2,0 dtk & pemilih MIME aman di Node',
  Math.abs(jadwalPoseAkhir.totalDetik - 2.0) < 0.01 &&
    jadwalPoseAkhir.segmen[0].adaPerpindahan === false &&
    typeof pilihMimeVideoWebm() === 'string',
)

console.log(`\nPerspektif Tribun & Video Logika: ${lulus} lulus, ${gagal} gagal`)
if (gagal > 0) process.exit(1)
