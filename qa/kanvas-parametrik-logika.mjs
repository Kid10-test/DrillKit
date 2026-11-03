/**
 * #22 — Uji logika murni Kanvas Parametrik Hidup (Persistent Bézier Shapes),
 * Seleksi Lasso Poligon Bebas, Gagang Stretch/Rotate Kotak Batas, Cermin Terpadu,
 * Kunci Sumbu X/Y, & Pembulatan Langkah Mandiri X/Y.
 *
 * Jalankan: bash qa/bangun-logika.sh && node qa/kanvas-parametrik-logika.mjs
 */
import {
  OPSI_BENTUK_BAWAAN,
  buatBentukTerikatDariOpsi,
  bulatkanKoordinatSumbu,
  cerminBentukTerikat,
  cerminTitikFormasi,
  evaluasiBezierKuadrat,
  evaluasiBezierKubik,
  geserBentukTerikat,
  hitungTitikBentukTerikat,
  kotakBatasTitik,
  lepaskanAnggotaDariBentuk,
  pasangBentukTerikatPadaSet,
  pilihTitikDenganLasso,
  putarBebasTitik,
  putarBentukTerikat,
  rentangTitikKotakBatas,
  sampelGarisBentukUntukSvg,
  sebarMerataSepanjangKurva,
  skalaBentukTerikat,
  terapkanKunciSumbu,
  titikDiDalamPoligon,
} from '/tmp/bentukFormasi.mjs'
import { tulisUlangSet } from '/tmp/namaAnggota.mjs'

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

const FIELD_DCI = {
  preset: 'dci',
  name: 'Standar DCI',
  lengthYd: 100,
  widthYd: 53.33,
  endZoneYd: 10,
  frontHashYd: 20,
  backHashYd: 20,
  stepSize: 8, // 0,625 yd / langkah
}

console.log('== #22 Kanvas Parametrik, Lasso, Kotak Seleksi, & Kunci Sumbu — Uji Logika ==')

/* ---- 1. Parameterisasi Panjang Busur (Arc-Length LUT) Kurva Bézier ---- */
{
  const p0 = { x: 25, y: 0 }
  const c1 = { x: 22, y: 20 }
  const c2 = { x: -22, y: -20 }
  const p1 = { x: -25, y: 0 }

  const awal = evaluasiBezierKubik(p0, c1, c2, p1, 0)
  const akhir = evaluasiBezierKubik(p0, c1, c2, p1, 1)
  cek(awal.x === 25 && awal.y === 0 && akhir.x === -25 && akhir.y === 0, 'Evaluasi Bézier kubik tepat di ujung t=0 dan t=1')

  const kuadTengah = evaluasiBezierKuadrat({ x: 10, y: 0 }, { x: 0, y: 12 }, { x: -10, y: 0 }, 0.5)
  cek(Math.abs(kuadTengah.x) < 1e-6 && Math.abs(kuadTengah.y - 6) < 1e-6, 'Evaluasi Bézier kuadrat pada t=0,5 berada tepat di puncak 1/2 tinggi c1')

  const merata = sebarMerataSepanjangKurva((t) => evaluasiBezierKubik(p0, c1, c2, p1, t), 9)
  cek(merata.length === 9, 'sebarMerataSepanjangKurva menghasilkan 9 titik pemain')
  const naif = Array.from({ length: 9 }, (_, i) => evaluasiBezierKubik(p0, c1, c2, p1, i / 8))
  const jarakLut = []
  const jarakNaif = []
  for (let i = 1; i < 9; i += 1) {
    jarakLut.push(Math.hypot(merata[i].x - merata[i - 1].x, merata[i].y - merata[i - 1].y))
    jarakNaif.push(Math.hypot(naif[i].x - naif[i - 1].x, naif[i].y - naif[i - 1].y))
  }
  const rataLut = jarakLut.reduce((a, b) => a + b, 0) / jarakLut.length
  const rataNaif = jarakNaif.reduce((a, b) => a + b, 0) / jarakNaif.length
  const devLut = Math.max(...jarakLut.map((d) => Math.abs(d - rataLut))) / rataLut
  const devNaif = Math.max(...jarakNaif.map((d) => Math.abs(d - rataNaif))) / rataNaif
  cek(
    devLut < 0.05 && devLut < devNaif * 0.25,
    `LUT panjang busur membuat spasi pemain jauh lebih seragam daripada t mentah (deviasi ${(devLut * 100).toFixed(1)}% vs ${(devNaif * 100).toFixed(1)}%)`,
  )
}

/* ---- 2. BentukTerikat Hidup: Buat, Evaluasi, Tarik Gagang, & Lepas Otomatis ---- */
{
  const ids = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6']
  const ptsAwal = Object.fromEntries(ids.map((id, i) => [id, { x: (2.5 - i) * 1.25, y: 0, facing: 'front' }]))

  const bKurvaS = buatBentukTerikatDariOpsi(
    ids,
    ptsAwal,
    FIELD_DCI,
    { ...OPSI_BENTUK_BAWAAN, jenis: 'kurva_s', intervalLangkah: 4, lengkunganLangkah: 8 },
    'btk_s1',
  )
  cek(
    Boolean(bKurvaS) && bKurvaS.jenis === 'kurva_s' && Boolean(bKurvaS.c1) && Boolean(bKurvaS.c2),
    'buatBentukTerikatDariOpsi menyusun BentukTerikat kurva_s lengkap dengan gagang p0, p1, c1, dan c2',
  )

  const hasilAwal = hitungTitikBentukTerikat(bKurvaS, ptsAwal, FIELD_DCI, {
    snapAktif: false,
    langkahX: 0,
    langkahY: 0,
  })
  // Tarik gagang c1 ke arah Back Sideline (+Y) → bagian kiri kurva wajib ikut naik ke +Y
  const bDitarik = { ...bKurvaS, c1: { x: bKurvaS.c1.x, y: bKurvaS.c1.y + 10 } }
  const hasilDitarik = hitungTitikBentukTerikat(bDitarik, ptsAwal, FIELD_DCI, {
    snapAktif: false,
    langkahX: 0,
    langkahY: 0,
  })
  cek(
    hasilDitarik.m2.y > hasilAwal.m2.y + 1.5 && Math.abs(hasilDitarik.m1.y - hasilAwal.m1.y) < 1e-6,
    'Menarik gagang lengkung c1 mendistribusikan ulang posisi pemain di sepanjang kurva secara real-time sementara p0 tetap',
  )

  const garisSvg = sampelGarisBentukUntukSvg(bDitarik, 32)
  cek(garisSvg.length === 33, 'sampelGarisBentukUntukSvg menghasilkan polilin mulus untuk tulang punggung kanvas')

  // Bentuk lingkaran & blok
  const bLing = buatBentukTerikatDariOpsi(
    ids,
    ptsAwal,
    FIELD_DCI,
    { ...OPSI_BENTUK_BAWAAN, jenis: 'lingkaran', jariJariLangkah: 8 },
    'btk_c1',
  )
  const ptsLing = hitungTitikBentukTerikat(bLing, ptsAwal, FIELD_DCI, {
    snapAktif: false,
    langkahX: 0,
    langkahY: 0,
  })
  const semuaJariSama = ids.every((id) => Math.abs(Math.hypot(ptsLing[id].x, ptsLing[id].y) - 5) < 0.02)
  cek(semuaJariSama, 'BentukTerikat lingkaran menjaga radius seragam (8 langkah = 5 yard) untuk semua anggota')

  // Pasang bentuk baru yang menimpa sebagian anggota → anggota lama otomatis lepas
  let daftar = pasangBentukTerikatPadaSet([], bKurvaS)
  const bKecil = buatBentukTerikatDariOpsi(
    ['m1', 'm2', 'm3', 'm4', 'm5'],
    ptsAwal,
    FIELD_DCI,
    { ...OPSI_BENTUK_BAWAAN, jenis: 'company_front' },
    'btk_g1',
  )
  daftar = pasangBentukTerikatPadaSet(daftar, bKecil)
  cek(
    daftar.length === 1 && daftar[0].id === 'btk_g1',
    'pasangBentukTerikatPadaSet membubarkan bentuk lama yang anggotanya tersisa < 2 setelah ditimpa bentuk baru',
  )

  // Lepaskan 1 anggota yang digeser manual terpisah → sisa 4 anggota tetap terikat
  const sisaSetelahGeser1 = lepaskanAnggotaDariBentuk(daftar, ['m1'])
  cek(
    sisaSetelahGeser1?.length === 1 &&
      sisaSetelahGeser1[0].memberIds.length === 4 &&
      !sisaSetelahGeser1[0].memberIds.includes('m1'),
    'lepaskanAnggotaDariBentuk melepas 1 titik yang digeser manual tanpa merusak ikatan 4 anggota lainnya',
  )

  // Transformasi gagang bentuk hidup (geser, putar, skala, cermin)
  const bGeser = geserBentukTerikat(bKecil, 5, -2.5, FIELD_DCI)
  cek(
    Math.abs(bGeser.p0.x - (bKecil.p0.x + 5)) < 1e-6 &&
      Math.abs(bGeser.p0.y - (bKecil.p0.y - 2.5)) < 1e-6,
    'geserBentukTerikat menggeser seluruh gagang kendali seiring perpindahan blok',
  )
  const bPutar = putarBentukTerikat(bKecil, { x: 0, y: 0 }, 90, FIELD_DCI)
  cek(
    Math.abs(bPutar.p0.x) < 1e-6 && Math.abs(bPutar.p0.y - bKecil.p0.x) < 1e-6,
    'putarBentukTerikat memutar gagang p0/p1 sebesar 90° searah jarum jam',
  )
  const bSkala = skalaBentukTerikat(bKecil, { x: 0, y: 0 }, 2, 1, FIELD_DCI)
  cek(
    Math.abs(bSkala.p0.x - bKecil.p0.x * 2) < 1e-6,
    'skalaBentukTerikat merentangkan gagang kendali proporsional terhadap jangkar',
  )
  const bCermin = cerminBentukTerikat(bGeser, { x: 0, y: 0 }, 'x', FIELD_DCI)
  cek(
    Math.abs(bCermin.p0.x + bGeser.p0.x) < 1e-6,
    'cerminBentukTerikat membalik gagang kendali terhadap poros cermin',
  )

  // Integrasi tulisUlangSet (penggabungan anggota kembar)
  const setUji = {
    id: 'set_1',
    drillId: 'd1',
    order: 0,
    name: 'Set 1',
    counts: 8,
    points: ptsAwal,
    bentukTerikat: [{ ...bKecil, memberIds: ['m_lama', 'm2', 'm3'] }],
    createdAt: 1,
  }
  const { set: setDitulisUlang } = tulisUlangSet(setUji, { m_lama: 'm1' })
  cek(
    setDitulisUlang.bentukTerikat?.[0]?.memberIds[0] === 'm1',
    'tulisUlangSet memetakan ulang ID anggota di dalam bentukTerikat saat anggota digabung',
  )
}

/* ---- 3. Seleksi Lasso Poligon Bebas (Ray-Casting Cekung) ---- */
{
  // Poligon huruf L cekung: menangkap (2,2) dan (8,2) serta (2,8), tetapi MENOLAK (8,8) di lekukan!
  const poligonL = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 4 },
    { x: 4, y: 4 },
    { x: 4, y: 10 },
    { x: 0, y: 10 },
  ]
  cek(titikDiDalamPoligon({ x: 2, y: 2 }, poligonL) === true, 'titikDiDalamPoligon menerima titik di dasar huruf L')
  cek(titikDiDalamPoligon({ x: 8, y: 2 }, poligonL) === true, 'titikDiDalamPoligon menerima titik di lengan kanan huruf L')
  cek(titikDiDalamPoligon({ x: 2, y: 8 }, poligonL) === true, 'titikDiDalamPoligon menerima titik di lengan atas huruf L')
  cek(titikDiDalamPoligon({ x: 8, y: 8 }, poligonL) === false, 'titikDiDalamPoligon menolak titik di rongga cekung luar huruf L')

  const pts = {
    a: { x: 2, y: 2, facing: 'front' },
    b: { x: 8, y: 2, facing: 'front' },
    c: { x: 8, y: 8, facing: 'front' },
    d: { x: 2, y: 8, facing: 'front' },
  }
  const dipilih = pilihTitikDenganLasso(pts, poligonL, new Set(['a', 'b', 'c']))
  cek(
    dipilih.length === 2 && dipilih.includes('a') && dipilih.includes('b') && !dipilih.includes('d'),
    'pilihTitikDenganLasso memilih titik di dalam poligon sekaligus menghormati filter seksi tampil',
  )
}

/* ---- 4. Gagang Kotak Seleksi: Stretch/Squeeze, Putar Bebas, & Cermin Poros Pilihan ---- */
{
  const pts = {
    p1: { x: 10, y: 5, facing: 'front' },
    p2: { x: 0, y: -5, facing: 'front' },
  }
  const kotak = kotakBatasTitik(['p1', 'p2'], pts)
  cek(
    kotak && kotak.minX === 0 && kotak.maxX === 10 && kotak.minY === -5 && kotak.maxY === 5,
    'kotakBatasTitik menghitung batas min/max dan pusat seleksi dengan tepat',
  )

  // Tarik gagang kiri layar ('w' = sisi +X maksimum) dari x=10 menjadi x=20 → jangkar kanan (x=0) wajib diam!
  const direntang = rentangTitikKotakBatas(
    pts,
    ['p1', 'p2'],
    kotak,
    'w',
    { x: 20, y: 0 },
    FIELD_DCI,
    { snapAktif: false, langkahX: 0, langkahY: 0 },
  )
  cek(
    Math.abs(direntang.points.p1.x - 20) < 1e-6 &&
      Math.abs(direntang.points.p2.x - 0) < 1e-6 &&
      Math.abs(direntang.fx - 2) < 1e-6,
    'rentangTitikKotakBatas menggandakan lebar pada gagang w sambil mengunci jangkar sisi seberang (x=0)',
  )

  // Putar bebas +45° searah jarum jam → arah hadap 'front' (0°) ikut menjadi custom 45°
  const diputar45 = putarBebasTitik(
    pts,
    ['p1', 'p2'],
    { x: kotak.cx, y: kotak.cy },
    45,
    FIELD_DCI,
    { snapAktif: false, langkahX: 0, langkahY: 0 },
  )
  cek(
    diputar45.p1.facing === 'custom' && Math.abs((diputar45.p1.facingDeg ?? 0) - 45) < 0.2,
    'putarBebasTitik memutar koordinat sekaligus memperbarui arah hadap ke sudut bebas 45°',
  )

  // Cermin berporos tengah pilihan (di tempat) vs poros lapangan (garis 50)
  const cerminPilihan = cerminTitikFormasi(
    ['p1', 'p2'],
    {
      p1: { x: 20, y: 4, facing: 'left' },
      p2: { x: 10, y: 4, facing: 'left' },
    },
    FIELD_DCI,
    'x',
    'pilihan',
    false,
  )
  cek(
    Math.abs(cerminPilihan.p1.x - 10) < 1e-6 &&
      Math.abs(cerminPilihan.p2.x - 20) < 1e-6 &&
      cerminPilihan.p1.facing === 'right',
    'cerminTitikFormasi dengan poros="pilihan" mencerminkan blok di tempat (pusat 15 yd tetap) & membalik arah hadap',
  )
}

/* ---- 5. Pengunci Sumbu X / Y & Pembulatan Langkah Mandiri X vs Y ---- */
{
  const gerakX = terapkanKunciSumbu({ x: 10, y: -4 }, { x: 5, y: 9 }, 'hanya_x')
  const gerakY = terapkanKunciSumbu({ x: 10, y: -4 }, { x: 5, y: 9 }, 'hanya_y')
  cek(gerakX.x === 15 && gerakX.y === -4, 'terapkanKunciSumbu("hanya_x") mengunci posisi depan-belakang (Y) tetap')
  cek(gerakY.x === 10 && gerakY.y === 5, 'terapkanKunciSumbu("hanya_y") mengunci garis yard kiri-kanan (X) tetap')

  // 1 langkah = 0,625 yd → 0,5 langkah = 0,3125 yd; 0,25 langkah = 0,15625 yd
  const bulat = bulatkanKoordinatSumbu(0.3, -26.665 + 0.16, FIELD_DCI, {
    snapAktif: true,
    langkahX: 0.5,
    langkahY: 0.25,
    hormatiPatok: false,
  })
  cek(
    Math.abs(bulat.x - 0.3125) < 1e-6 && Math.abs(bulat.y - (-26.665 + 0.15625)) < 1e-6,
    'bulatkanKoordinatSumbu membulatkan X ke 1/2 langkah dan Y ke 1/4 langkah secara independen',
  )

  const bebasXBulatY = bulatkanKoordinatSumbu(1.123, -26.665 + 0.61, FIELD_DCI, {
    snapAktif: true,
    langkahX: 0,
    langkahY: 1,
    hormatiPatok: false,
  })
  cek(
    Math.abs(bebasXBulatY.x - 1.123) < 1e-6 && Math.abs(bebasXBulatY.y - (-26.665 + 0.625)) < 1e-6,
    'bulatkanKoordinatSumbu mengizinkan sumbu X bebas (0) sambil tetap menempelkan Y ke 1 langkah penuh',
  )
}

console.log(`\n${lulus} lulus, ${gagal} gagal`)
process.exit(gagal > 0 ? 1 : 0)
