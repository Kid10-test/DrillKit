/**
 * #24 (`v2.2.2`) — Uji logika murni:
 *  - #24.1 Detektor benturan lintasan tiap `0,25` hitungan berbasis Spatial Hash Grid
 *          (`periksaTabrakanSet`, lurus, `#23` Midsets, `FTL`, `Move+Hold` / `Ripple`,
 *          & properti bergerak `Moving Props` `#16.4` + pengecualian `kruIds`).
 *  - #24.2 Radius ruang aman sadar-instrumen (`radiusAmanInstrumen`: Tuba, Battery,
 *          Color Guard, Pit, Standar) & deteksi `apakahJalanMundur` (> 120° berlawanan arah).
 *  - #24.3 Pemeriksa kerataan spasi barisan (`periksaKerataanSpasi` & `ratakanSpasiBarisan`),
 *          melewati titik yang sudah terikat ke `bentukTerikat` (#22).
 *  - #24.4 Penyelesai jalur bersilang 1-klik (`segmenJalurBersilangan`, `cariSaranTukarSilang`,
 *          `terapkanTukarTujuan`, `tukarAnggotaPadaBentukTerikat`, & `selesaikanSemuaSilang2Opt`).
 *
 * Jalankan: bash qa/bangun-logika.sh && node qa/tabrakan-spasi-silang-logika.mjs
 */
import {
  apakahJalanMundur,
  cariSaranTukarSilang,
  jarakTitikKePropertiYd,
  periksaKerataanSpasi,
  periksaTabrakanSet,
  radiusAmanInstrumen,
  ratakanSpasiBarisan,
  segmenJalurBersilangan,
  selesaikanSemuaSilang2Opt,
  terapkanTukarTujuan,
  tukarAnggotaPadaBentukTerikat,
} from '/tmp/tabrakanDrill.mjs'

let lulus = 0
let gagal = 0
function cek(kondisi, pesan) {
  if (kondisi) {
    lulus += 1
    console.log(`  ✓ ${pesan}`)
  } else {
    gagal += 1
    console.error(`  ✗ GAGAL: ${pesan}`)
  }
}

const SYD = 5 / 8 // 8-to-5 = 0.625 yard/langkah

/* ---------------- 1. Radius instrumen & jalan mundur ---------------- */
{
  const rTuba = radiusAmanInstrumen({ id: 'm1', name: 'Bima', code: 'TB1', section: 'brass', instrument: 'Sousaphone' }, SYD)
  const rSnare = radiusAmanInstrumen({ id: 'm2', name: 'Raka', code: 'SN1', section: 'percussion', instrument: 'Snare Drum' }, SYD)
  const rGuard = radiusAmanInstrumen({ id: 'm3', name: 'Alya', code: 'CG1', section: 'guard', instrument: 'Flag' }, SYD)
  const rPit = radiusAmanInstrumen({ id: 'm4', name: 'Nina', code: 'PT1', section: 'pit', instrument: 'Marimba' }, SYD)
  const rHorn = radiusAmanInstrumen({ id: 'm5', name: 'Dito', code: 'TP1', section: 'brass', instrument: 'Trumpet' }, SYD)

  cek(
    rTuba.kategori === 'tuba' &&
      rSnare.kategori === 'perkusi' &&
      rGuard.kategori === 'guard' &&
      rPit.kategori === 'pit' &&
      rHorn.kategori === 'standar',
    'radiusAmanInstrumen mengelompokkan Sousaphone, Snare, Color Guard, Pit, dan Trumpet dengan benar',
  )
  cek(
    rGuard.radiusLangkah > rTuba.radiusLangkah &&
      rTuba.radiusLangkah > rSnare.radiusLangkah &&
      rSnare.radiusLangkah > rHorn.radiusLangkah &&
      rHorn.radiusLangkah * 2 < 1.0,
    'Urutan radius aman masuk akal (Guard > Tuba > Battery > Horn) dan blok tiup 1,0 langkah tidak memicu alarm palsu',
  )

  // Sumbu lapangan DrillKit: y menurun (-y) = ke depan sideline penonton (facing 0°),
  // y membesar (+y) = ke belakang sideline belakang (jalan mundur bila menghadap 0°).
  cek(
    apakahJalanMundur(0, +2, 'front') === true &&
      apakahJalanMundur(0, -2, 'front') === false &&
      apakahJalanMundur(0, -2, 'back') === true &&
      apakahJalanMundur(-2, 0, 'left') === true,
    'apakahJalanMundur mengenali gerak mundur > 120° terhadap arah hadap pemain di sumbu yard DrillKit',
  )
}

/* ---------------- 2. Deteksi tabrakan lintasan & midset penghindar ---------------- */
{
  const anggota = [
    { id: 'a1', name: 'Trumpet 1', code: 'T1', section: 'brass', instrument: 'Trumpet' },
    { id: 'a2', name: 'Trumpet 2', code: 'T2', section: 'brass', instrument: 'Trumpet' },
    { id: 'tb1', name: 'Tuba 1', code: 'U1', section: 'brass', instrument: 'Sousaphone' },
    { id: 'tb2', name: 'Tuba 2', code: 'U2', section: 'brass', instrument: 'Tuba' },
  ]

  // T1 & T2 berpapasan tepat di titik (0, 26.67) pada count 4 dari 8
  const setAwal = {
    id: 's1',
    name: 'Set 1',
    counts: 8,
    points: {
      a1: { x: -5, y: 26.67, facing: 'front' },
      a2: { x: 5, y: 26.67, facing: 'front' },
    },
  }
  const setTujuan = {
    id: 's2',
    name: 'Set 2',
    counts: 8,
    points: {
      a1: { x: 5, y: 26.67, facing: 'front' },
      a2: { x: -5, y: 26.67, facing: 'front' },
    },
  }

  const hasilTabrak = periksaTabrakanSet({
    dari: setAwal,
    ke: setTujuan,
    anggota,
    stepYd: SYD,
  })
  cek(
    hasilTabrak.jmlTabrakan === 1 &&
      hasilTabrak.kejadian[0].padaCount === 4 &&
      Math.abs(hasilTabrak.kejadian[0].x - 0) < 0.05 &&
      hasilTabrak.kejadian[0].jarakLangkah < 0.1,
    'periksaTabrakanSet mendeteksi tabrakan adu-depan tepat di count 4 dan koordinat tengah (0, 26.67)',
  )

  // Bila T1 diberi Midset penghindar di count 4 (melambung 3 yard ke depan), benturan lenyap!
  const setDenganMidset = {
    ...setAwal,
    midsets: {
      a1: [{ padaCount: 4, x: 0, y: 23.0 }],
    },
  }
  const hasilHindar = periksaTabrakanSet({
    dari: setDenganMidset,
    ke: setTujuan,
    anggota,
    stepYd: SYD,
  })
  cek(
    hasilHindar.kejadian.length === 0,
    'Penambahan titik singgah Midset (#23.1) untuk melambung menghindari lawan langsung menghilangkan benturan',
  )

  // Blok rapat 1,0 langkah untuk Trumpet = AMAN, tapi untuk dua Sousaphone = TABRAKAN!
  const selisih1Langkah = 1.0 * SYD // 0.625 yd
  const blokHornDari = {
    id: 'bh1',
    counts: 8,
    points: {
      a1: { x: 0, y: 20, facing: 'front' },
      a2: { x: selisih1Langkah, y: 20, facing: 'front' },
    },
  }
  const blokHornKe = {
    id: 'bh2',
    counts: 8,
    points: {
      a1: { x: 0, y: 15, facing: 'front' },
      a2: { x: selisih1Langkah, y: 15, facing: 'front' },
    },
  }
  const cekBlokHorn = periksaTabrakanSet({ dari: blokHornDari, ke: blokHornKe, anggota, stepYd: SYD })

  const selisihTubaNyaris = 1.1 * SYD // < 0.72 + 0.72 = 1.44 langkah -> nyaris senggol!
  const selisihTubaTabrak = 0.85 * SYD // <= 0.65 * 1.44 langkah -> tabrakan keras!
  const cekBlokTubaNyaris = periksaTabrakanSet({
    dari: {
      id: 'bt1',
      counts: 8,
      points: {
        tb1: { x: 0, y: 20, facing: 'front' },
        tb2: { x: selisihTubaNyaris, y: 20, facing: 'front' },
      },
    },
    ke: {
      id: 'bt2',
      counts: 8,
      points: {
        tb1: { x: 0, y: 15, facing: 'front' },
        tb2: { x: selisihTubaNyaris, y: 15, facing: 'front' },
      },
    },
    anggota,
    stepYd: SYD,
  })
  const cekBlokTubaTabrak = periksaTabrakanSet({
    dari: {
      id: 'btt1',
      counts: 8,
      points: {
        tb1: { x: 0, y: 20, facing: 'front' },
        tb2: { x: selisihTubaTabrak, y: 20, facing: 'front' },
      },
    },
    ke: {
      id: 'btt2',
      counts: 8,
      points: {
        tb1: { x: 0, y: 15, facing: 'front' },
        tb2: { x: selisihTubaTabrak, y: 15, facing: 'front' },
      },
    },
    anggota,
    stepYd: SYD,
  })
  cek(
    cekBlokHorn.kejadian.length === 0 &&
      cekBlokTubaNyaris.jmlNyaris === 1 &&
      cekBlokTubaTabrak.jmlTabrakan === 1,
    'Blok paralel 1,0 langkah bebas alarm untuk Trumpet, tetapi memicu nyaris (1,1 lk) & tabrakan (0,85 lk) untuk 2 Sousaphone/Tuba',
  )

  // Blind back-march: T1 jalan mundur cepat (+y sambil menghadap front/0°) menyilang dekat T2
  const mundurDari = {
    id: 'bm1',
    counts: 8,
    points: {
      a1: { x: 0, y: 20, facing: 'front' }, // hadap penonton (0°), bergerak ke y=26 (+6 yd = jalan mundur!)
      a2: { x: -3, y: 23 + 1.02 * SYD, facing: 'front' },
    },
  }
  const mundurKe = {
    id: 'bm2',
    counts: 8,
    points: {
      a1: { x: 0, y: 26, facing: 'front' },
      a2: { x: 3, y: 23 + 1.02 * SYD, facing: 'front' },
    },
  }
  const cekMundur = periksaTabrakanSet({ dari: mundurDari, ke: mundurKe, anggota, stepYd: SYD })
  cek(
    cekMundur.jmlJalanMundur === 1 && cekMundur.kejadian[0]?.jalanMundur === true,
    'Perluasan ruang aman Blind Back-March menangkap pemain yang jalan mundur cepat memotong jalur rekan',
  )
}

/* ---------------- 3. Benturan Properti Panggung Berputar (#16.4) & Kru ---------------- */
{
  const propPanggung = {
    id: 'prop_ramp',
    jenis: 'kotak',
    label: 'Panggung Tengah',
    warna: '#ef4444',
    x: -2,
    y: 25,
    x2: 2,
    y2: 28,
    rotasi: 45,
    kruIds: ['kru1'],
    perSet: {
      s1: { x: -2, y: 25, x2: 2, y2: 28, rotasi: 0 },
      s2: { x: -2, y: 25, x2: 2, y2: 28, rotasi: 90 },
    },
  }
  const kotakZonaLebar = {
    id: 'zona_pit',
    jenis: 'kotak',
    label: 'Batas Pit',
    warna: '#64748b',
    x: -25,
    y: 0,
    x2: 25,
    y2: 5, // lebar 50 yd (> 22 yd) -> zona garis lantai, bukan properti fisik penghalang
  }

  cek(
    jarakTitikKePropertiYd(0, 26.5, propPanggung, SYD)?.jarakTepiYd === 0 &&
      jarakTitikKePropertiYd(0, 2.5, kotakZonaLebar, SYD) === null,
    'jarakTitikKePropertiYd menghitung kotak berputar (OBB) secara akurat dan mengabaikan zona garis lantai > 22 yd',
  )

  const anggotaProp = [
    { id: 'p1', name: 'Pemain Tiup', code: 'B1', section: 'brass', instrument: 'Baritone' },
    { id: 'kru1', name: 'Kru Pendorong', code: 'KR1', section: 'guard', instrument: 'Crew' },
  ]
  const sProp1 = {
    id: 's1',
    counts: 8,
    points: {
      p1: { x: -6, y: 26.5, facing: 'front' },
      kru1: { x: 0, y: 25.05, facing: 'front' }, // menempel mendorong tepi panggung!
    },
  }
  const sProp2 = {
    id: 's2',
    counts: 8,
    points: {
      p1: { x: 6, y: 26.5, facing: 'front' }, // menembus tengah panggung!
      kru1: { x: 0, y: 24.6, facing: 'front' }, // ikut berputar bersama panggung -> dikecualikan dari benturan prop!
    },
  }
  const cekProp = periksaTabrakanSet({
    dari: sProp1,
    ke: sProp2,
    anggota: anggotaProp,
    stepYd: SYD,
    markers: [propPanggung, kotakZonaLebar],
  })
  cek(
    cekProp.kejadian.some((k) => k.jenis === 'pemain_properti' && k.idA === 'p1') &&
      !cekProp.kejadian.some((k) => k.jenis === 'pemain_properti' && k.idA === 'kru1'),
    'periksaTabrakanSet menangkap pemain yang menembus panggung berputar sekaligus mengecualikan anggota kruIds pendorongnya',
  )
}

/* ---------------- 4. Kerataan Spasi Barisan (Spacing Drift) ---------------- */
{
  const anggotaSpasi = [
    { id: 's_1', name: 'A', code: 'M1', section: 'brass' },
    { id: 's_2', name: 'B', code: 'M2', section: 'brass' },
    { id: 's_3', name: 'C', code: 'M3', section: 'brass' },
    { id: 's_4', name: 'D', code: 'M4', section: 'brass' },
    { id: 'lain', name: 'Solois', code: 'SL1', section: 'woodwind' },
  ]
  // Barisan 4 orang dari x = 0 s.d. x = 6 langkah (3.75 yd), seharusnya tiap 2 langkah (0, 2, 4, 6),
  // tapi M2 melenceng ke 1.2 langkah (celah: 1.2, 2.8, 2.0 langkah -> simpangan 0.8 langkah!).
  const setMiring = {
    points: {
      s_1: { x: 0, y: 20, facing: 'front' },
      s_2: { x: 1.2 * SYD, y: 20, facing: 'front' },
      s_3: { x: 4.0 * SYD, y: 20, facing: 'front' },
      s_4: { x: 6.0 * SYD, y: 20, facing: 'front' },
      lain: { x: -12, y: 10, facing: 'back' },
    },
  }

  const temuan = periksaKerataanSpasi({ set: setMiring, anggota: anggotaSpasi, stepYd: SYD })
  cek(
    temuan.length === 1 &&
      temuan[0].memberIds.length === 4 &&
      Math.abs(temuan[0].spasiRataLangkah - 2.0) < 0.05 &&
      temuan[0].simpanganMaksLangkah >= 0.75,
    'periksaKerataanSpasi mendeteksi barisan lurus 4 pemain yang intervalnya melenceng tidak rata',
  )

  const diratakan = ratakanSpasiBarisan(setMiring.points, temuan[0])
  const temuanSesudah = periksaKerataanSpasi({
    set: { points: diratakan },
    anggota: anggotaSpasi,
    stepYd: SYD,
  })
  cek(
    temuanSesudah.length === 0 &&
      Math.abs(diratakan.s_2.x - 2.0 * SYD) < 0.005 &&
      diratakan.lain.x === -12,
    'ratakanSpasiBarisan meratakan interval menjadi tepat 2,0 langkah sekaligus menjaga titik pemain lain tetap utuh',
  )

  // Jika sudah diikat ke bentukTerikat (#22), periksaKerataanSpasi tidak memunculkan peringatan duplikat
  const temuanTerikat = periksaKerataanSpasi({
    set: {
      points: setMiring.points,
      bentukTerikat: [
        {
          id: 'btk_1',
          nama: 'Garis Brass',
          jenis: 'garis',
          memberIds: ['s_1', 's_2', 's_3', 's_4'],
          p0: { x: 0, y: 20 },
          p1: { x: 6 * SYD, y: 20 },
          arahHadap: 'tetap',
        },
      ],
    },
    anggota: anggotaSpasi,
    stepYd: SYD,
  })
  cek(
    temuanTerikat.length === 0,
    'periksaKerataanSpasi otomatis melewati barisan yang sudah terikat ke Bentuk Hidup (#22)',
  )
}

/* ---------------- 5. Penyelesai Silang 1-Klik (2-Opt Uncrosser) ---------------- */
{
  cek(
    segmenJalurBersilangan({ x: -4, y: 10 }, { x: 4, y: 20 }, { x: -4, y: 20 }, { x: 4, y: 10 }) === true &&
      segmenJalurBersilangan({ x: -4, y: 10 }, { x: -4, y: 20 }, { x: 4, y: 10 }, { x: 4, y: 20 }) === false,
    'segmenJalurBersilangan membedakan jalur menyilang X vs jalur sejajar tanpa silang',
  )

  const anggotaSilang = [
    { id: 'b1', name: 'Brass 1', code: 'B1', section: 'brass' },
    { id: 'b2', name: 'Brass 2', code: 'B2', section: 'brass' },
    { id: 'b3', name: 'Brass 3', code: 'B3', section: 'brass' },
    { id: 'b4', name: 'Brass 4', code: 'B4', section: 'brass' },
    { id: 'w1', name: 'Woodwind 1', code: 'W1', section: 'woodwind' },
  ]

  // 4 pemain Brass terbalik urutannya (B1->kanan jauh, B4->kiri jauh = 6 persilangan sekaligus!)
  // ditambah W1 (woodwind) yang menyilang B1 (beda seksi -> TIDAK boleh ditukar dengan Brass!)
  const dariSilang = {
    id: 'ds1',
    counts: 16,
    points: {
      b1: { x: -6, y: 20, facing: 'front' },
      b2: { x: -2, y: 20, facing: 'front' },
      b3: { x: 2, y: 20, facing: 'front' },
      b4: { x: 6, y: 20, facing: 'front' },
      w1: { x: -8, y: 18, facing: 'front' },
    },
  }
  const keSilang = {
    id: 'ds2',
    counts: 16,
    points: {
      b1: { x: 6, y: 12, facing: 'right', facingDeg: 90 },
      b2: { x: 2, y: 12, facing: 'front', facingDeg: 30 },
      b3: { x: -2, y: 12, facing: 'front', facingDeg: -30 },
      b4: { x: -6, y: 12, facing: 'left', facingDeg: -90 },
      w1: { x: 8, y: 14, facing: 'front' },
    },
    bentukTerikat: [
      {
        id: 'btk_tujuan',
        nama: 'Busur Brass',
        jenis: 'garis',
        memberIds: ['b4', 'b3', 'b2', 'b1'],
        p0: { x: -6, y: 12 },
        p1: { x: 6, y: 12 },
        arahHadap: 'tetap',
      },
    ],
  }

  const saranAwal = cariSaranTukarSilang({
    dari: dariSilang,
    ke: keSilang,
    anggota: anggotaSilang,
    stepYd: SYD,
  })
  cek(
    saranAwal.length === 2 &&
      saranAwal.every((s) => s.seksi === 'brass' && s.idA !== 'w1' && s.idB !== 'w1'),
    'cariSaranTukarSilang menemukan pasangan disjoin terbaik di dalam seksi yang sama dan tidak pernah menukar lintas-seksi',
  )

  // FTL dikecualikan agar koreografi rantai Follow-the-Leader sengaja tidak diacak
  const saranDenganFtl = cariSaranTukarSilang({
    dari: {
      ...dariSilang,
      gerak: {
        kelompok: [{ id: 'ftl_1', nama: 'Rantai Brass', memberIds: ['b1', 'b2', 'b3', 'b4'], jalur: 'ftl' }],
      },
    },
    ke: keSilang,
    anggota: anggotaSilang,
    stepYd: SYD,
  })
  cek(
    saranDenganFtl.length === 0,
    'cariSaranTukarSilang menghormati rantai Follow-the-Leader (FTL) dan tidak menyarankan tukar tujuan',
  )

  const uraiPenuh = selesaikanSemuaSilang2Opt({
    dari: dariSilang,
    ke: keSilang,
    anggota: anggotaSilang,
    stepYd: SYD,
  })
  const sisaSilang = cariSaranTukarSilang({
    dari: dariSilang,
    ke: { ...keSilang, points: uraiPenuh.kePointsBaru },
    anggota: anggotaSilang,
    stepYd: SYD,
  })
  cek(
    uraiPenuh.jumlahPertukaran >= 2 &&
      uraiPenuh.totalHematLangkah > 10 &&
      sisaSilang.length === 0 &&
      uraiPenuh.kePointsBaru.b1.x === -6 &&
      uraiPenuh.kePointsBaru.b1.facingDeg === -90 &&
      uraiPenuh.kePointsBaru.b4.x === 6 &&
      uraiPenuh.kePointsBaru.b4.facingDeg === 90 &&
      uraiPenuh.bentukTerikatBaru?.[0]?.memberIds.join(',') === 'b1,b2,b3,b4' &&
      uraiPenuh.kePointsBaru.w1.x === 8,
    'selesaikanSemuaSilang2Opt mengurai simpul 4 pemain hingga 0 silang, menjaga arah hadap slot formasi tujuan, dan menyelaraskan urutan memberIds bentukTerikat',
  )

  // Uji langsung terapkanTukarTujuan & tukarAnggotaPadaBentukTerikat 1 pasangan
  const satuTukar = terapkanTukarTujuan(keSilang.points, [{ idA: 'b1', idB: 'b4' }])
  const btkSatu = tukarAnggotaPadaBentukTerikat(keSilang.bentukTerikat, [{ idA: 'b1', idB: 'b4' }])
  cek(
    satuTukar.b1.x === -6 &&
      satuTukar.b4.x === 6 &&
      btkSatu?.[0]?.memberIds.join(',') === 'b1,b3,b2,b4',
    'terapkanTukarTujuan & tukarAnggotaPadaBentukTerikat menukar 1 pasangan secara atomik',
  )
}

console.log(`\n${lulus} lulus, ${gagal} gagal`)
process.exit(gagal > 0 ? 1 : 0)
