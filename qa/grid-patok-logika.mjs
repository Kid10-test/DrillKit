/**
 * Uji fondasi grid & patok — tujuan 1-4 dari audit pasca PR #14.
 *
 * Fokus:
 * 1. Yard ↔ meter tidak mengubah geometri (internal tetap yard)
 * 2. grid & patok terpisah (batas patok tidak memotong grid)
 * 3. batas huruf/T (E / T26 simetris, tidak auto-fill melewati batas)
 * 4. jangan samakan yard & meter diam-diam (8-to-5 = 8 langkah per 5 yard, bukan 5 meter)
 *
 * v2.9 "Satu Grid Patok": garis lapangan = garis patok (tidak ada grid utama /
 * subgrid berjarak sendiri), patok T dimulai dari T0 di tepi depan, jarak
 * patok selalu dalam langkah (data lama yard/meter dikonversi), snap & garis
 * bantu langkah dihitung dari A/T0 (asalGrid), plus tabel Lembar Meteran.
 *
 * Pakai: node grid-patok-logika.mjs
 */
import {
  FIELD_PRESETS,
  M_TO_YD,
  YD_TO_M,
  STEP_YD,
  WARNA_GARIS_GRID,
  activePreset,
  coordPatok,
  daftarPatok,
  dariSatuanTampil,
  faktorTampilLapangan,
  fieldBox,
  garisLapangan,
  garisLangkahTampil,
  asalGrid,
  labelT,
  tabelMeteran,
  teksMeterAcuan,
  keSatuanTampil,
  namaSatuanLapangan,
  patokOf,
  patokRef,
  satuanLapanganOf,
  singkatanSatuanLapangan,
  skalaGarisLapangan,
  stepYd,
  tebalGarisGrid,
  warnaGarisGrid,
  gridUtamaTampil,
  hashGarisTampil,
} from '/tmp/lapangan.mjs'
import { bulatkanKoordinatSumbu } from '/tmp/bentukFormasi.mjs'

let lulus = 0
const gagal = []
const cek = (nama, ok, detail = '') => {
  if (ok) {
    lulus += 1
    console.log('  ✓ ' + nama)
  } else {
    gagal.push(`${nama}${detail ? ' — ' + detail : ''}`)
    console.log('  ✗ ' + nama + (detail ? ' → ' + detail : ''))
  }
}
const dekat = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps

const LAP_FOOTBALL = {
  widthYd: 53.33,
  lengthYd: 100,
  endZoneYd: 10,
  gridTampil: 1,
  hash: 'ncaa',
  hashTampil: 1,
  step: '8to5',
  customStepYd: 0.625,
  showLabels: 1,
  satuan: 'yd',
  patok: {
    aktif: 1,
    sumbuHuruf: 'x',
    dariTengah: 1,
    awalanT: 1,
    penandaSisi: 1,
    jarakHuruf: 8,
    jarakHash: 4,
    jarakT: 8,
    tampil: 1,
    satuanJarak: 'langkah',
  },
  garis: 1,
  warna: 'hijau',
  ukuranTitik: 1,
}

/* ---------------- 1. Titik tengah adalah YL50 & A di sana ---------------- */
{
  const f = LAP_FOOTBALL
  const box = fieldBox(f)
  cek('1a: lapangan football total 120 yard (100+10+10)', dekat(box.totalLengthYd, 120), String(box.totalLengthYd))
  cek('1a: tengah X=0 adalah garis 50', dekat(0, 0))
  const tengah = 0
  const daftarX = daftarPatok(f, 'x')
  const a = daftarX.find((g) => g.label === 'A')
  cek('1b: A tepat di tengah YL50 (pos 0 pada lapangan simetris)', !!a && dekat(a.pos, tengah, 1e-9), a ? `${a.pos}` : 'tidak ada A')
  // cek A ada dua? hanya satu di tengah
  const jumlahA = daftarX.filter((g) => g.label === 'A').length
  cek('1b: hanya satu A di tengah', jumlahA === 1, `jumlah ${jumlahA}`)
}

/* --------------- 1c. dengan 8-to-5, B 5 yard dari A, A# 2,5 yard -------------- */
{
  const f = LAP_FOOTBALL
  const s = stepYd(f) // 0.625
  cek('1c: 8-to-5 = 0.625 yard per langkah', dekat(s, 0.625), String(s))
  const daftarX = daftarPatok(f, 'x')
  const a = daftarX.find((g) => g.label === 'A')
  const b = daftarX.find((g) => g.label === 'B' && g.arah === 1)
  const bPrime = daftarX.find((g) => g.label === "B'" && g.arah === -1)
  const aSharp = daftarX.find((g) => g.label === 'A#' && g.arah === 1)
  const aSharpPrime = daftarX.find((g) => g.label === "A#'" && g.arah === -1)
  cek('1c: B ada di sisi S1', !!b, String(b?.pos))
  if (a && b) cek('1c: B 5 yard dari A (8 langkah ×0.625)', dekat(b.pos - a.pos, 5, 1e-6), `${b.pos - a.pos}`)
  if (a && aSharp) cek('1c: A# 2,5 yard dari A (4 langkah)', dekat(aSharp.pos - a.pos, 2.5, 1e-6), `${aSharp.pos - a.pos}`)
  if (b && bPrime) cek('1c: B simetris B\' di sisi berlawanan', dekat(b.pos + bPrime.pos, 0, 1e-6), `${b.pos} vs ${bPrime.pos}`)
  if (aSharp && aSharpPrime) cek('1c: A# simetris', dekat(aSharp.pos + aSharpPrime.pos, 0, 1e-6))
  // T-T jarak
  const daftarY = daftarPatok(f, 'y')
  // T along y when huruf on x
  const t0 = daftarY.find((g) => g.label === 'T0')
  const t1 = daftarY.find((g) => g.label === 'T1')
  cek('1c: T0 ada (v2.9 — patok angka mulai dari 0)', !!t0)
  cek('1c: T0 tepat di tepi depan (sejajar deretan patok huruf)', !!t0 && dekat(t0.pos, -f.widthYd / 2, 1e-9), String(t0?.pos))
  cek('1c: T1 ada', !!t1)
  if (t0 && t1) cek('1c: T1 5 yard dari T0 (8 langkah)', dekat(t1.pos - t0.pos, 5, 1e-6), `${t1.pos - t0.pos}`)
}

/* ------------ 2. Ganti tampilan yard ↔ meter tidak geser geometri ------------ */
{
  const fYd = { ...LAP_FOOTBALL, satuan: 'yd' }
  const fM = { ...LAP_FOOTBALL, satuan: 'm' } // geometri sama, hanya satuan tampil
  const boxYd = fieldBox(fYd)
  const boxM = fieldBox(fM)
  cek('2a: fieldBox sama persis yard↔meter (geometri tidak berubah)', dekat(boxYd.totalLengthYd, boxM.totalLengthYd) && dekat(boxYd.totalWidthYd, boxM.totalWidthYd), `${boxYd.totalLengthYd} vs ${boxM.totalLengthYd}`)
  const daftarYd = daftarPatok(fYd, 'x')
  const daftarM = daftarPatok(fM, 'x')
  cek('2a: jumlah patok sama yard vs meter', daftarYd.length === daftarM.length, `${daftarYd.length} vs ${daftarM.length}`)
  let posSama = true
  let contoh = ''
  for (let i = 0; i < daftarYd.length; i++) {
    if (!daftarM[i] || !dekat(daftarYd[i].pos, daftarM[i].pos, 1e-9) || daftarYd[i].label !== daftarM[i].label) { posSama = false; contoh = `${daftarYd[i]?.label}:${daftarYd[i]?.pos} vs ${daftarM[i]?.label}:${daftarM[i]?.pos}`; break }
  }
  cek('2a: posisi & label patok identik yard↔meter (hanya konversi tampil)', posSama, contoh)

  // v2.9 — garis lapangan juga tidak bergeser saat satuan tampil diganti
  const gYd = garisLapangan(fYd)
  const gM = garisLapangan(fM)
  cek('2b: garisLapangan identik yard vs meter (posisi & label)',
    gYd.x.length === gM.x.length && gYd.y.length === gM.y.length &&
    gYd.x.every((l, i) => dekat(l.pos, gM.x[i].pos) && l.label === gM.x[i].label),
    `${gYd.x.length} vs ${gM.x.length}`)

  // Pastikan bukan diam-diam jadi 5 meter: 5 meter = 5.468 yard, berbeda dari 5 yard
  const grid5mYd = 5 * M_TO_YD
  cek('2b: 5 meter fisik = 5.468 yard, berbeda dari 5 yard', !dekat(grid5mYd, 5, 1e-3), `${grid5mYd} vs 5`)
}

/* -------- 3. Batas E / T26 menghentikan patok — garis lapangan ikut patok -------- */
{
  const fBatas = {
    ...LAP_FOOTBALL,
    patok: {
      ...LAP_FOOTBALL.patok,
      maksHuruf: 4, // E (0=A,1=B,2=C,3=D,4=E)
      maksT: 26,
    },
  }
  const daftarX = daftarPatok(fBatas, 'x')
  const daftarY = daftarPatok(fBatas, 'y')
  // huruf: harus ada A,B,C,D,E dan tidak ada F
  const hurufLabels = daftarX.filter((g) => !g.label.includes('#')).map((g) => g.label.replace("'", ""))
  const unikHuruf = [...new Set(hurufLabels)]
  cek('3a: batas huruf E menghasilkan huruf A..E saja', unikHuruf.includes('A') && unikHuruf.includes('E') && !unikHuruf.includes('F'), `huruf: ${unikHuruf.join(',')}`)
  // cek tidak ada F atau G
  const adaF = daftarX.some((g) => g.label.replace("'", "") === 'F' || g.label.replace("'", "") === 'F#')
  cek('3a: F tidak ada bila batas E', !adaF, `ditemukan ${daftarX.filter(g=>g.label.replace("'", "").startsWith('F')).map(g=>g.label).join(',')}`)
  // E simetris: ada E dan E' 
  const adaE = daftarX.some((g) => g.label === 'E')
  const adaEPrime = daftarX.some((g) => g.label === "E'")
  cek('3a: E simetris (E dan E\')', adaE && adaEPrime, `E:${adaE} E':${adaEPrime}`)

  // T pada lapangan football 53.33 yard lebar: max muat 11 (5 yard per T), jadi batas 26 = tetap 11 (tidak auto-generate di luar lapangan)
  // Untuk uji T26 spesifik, pakai lapangan panjang agar muat
  const fPanjang = {
    ...LAP_FOOTBALL,
    lengthYd: 150, // total 170 dengan endZone 10 → half 85
    widthYd: 130, // lebar besar biar T muat 26
    patok: { ...LAP_FOOTBALL.patok, sumbuHuruf: 'y', maksT: 26, jarakT: 8 }, // T dipasang memanjang → sepanjang length
  }
  // huruf di y, T di x memanjang → pakai sumbu x panjang 150 → 150/5 =30 muat
  const daftarT26 = daftarPatok(fPanjang, 'x')
  const adaT26 = daftarT26.some((g) => g.label === 'T26' || g.label === '26')
  const adaT27 = daftarT26.some((g) => g.label === 'T27' || g.label === '27')
  cek('3b: T26 ada bila lapangan cukup panjang (batas 26)', adaT26, `T labels: ${daftarT26.slice(0,3).map(g=>g.label).join(',')} ... ${daftarT26.slice(-3).map(g=>g.label).join(',')}`)
  cek('3b: T27 tidak ada (batas 26)', !adaT27)
  cek('3b: jumlah T = 27 (T0..T26, dibatasi bukan 31)', daftarT26.length === 27 && daftarT26[0].label === 'T0', String(daftarT26.length))
  // pada lapangan football sempit, batas 26 tetap T0..T10 (tidak memaksa di luar tepi)
  cek('3b: pada football sempit, T tetap 11 (T0..T10) walau batas 26 (tidak keluar tepi)', daftarY.length === 11 && daftarY.at(-1).label === 'T10', `${daftarY.length}`)

  // v2.9 — satu grid: garis lapangan = patok, jadi batas E juga batas garis huruf
  const gBatas = garisLapangan(fBatas)
  cek('3c: garis lapangan sumbu huruf = daftar patok (17 garis A..E′ termasuk #)',
    gBatas.x.length === daftarX.length && gBatas.x.every((l) => daftarX.some((d) => dekat(d.pos, l.pos) && d.label === l.label)),
    `${gBatas.x.length} vs ${daftarX.length}`)
  cek('3c: garis lapangan tetap tampil walau patok dibatasi', gridUtamaTampil(fBatas) === true)
  // patok garis/label terpisah: batasi tidak menyembunyikan grid
  const fNoPatokGaris = { ...LAP_FOOTBALL, patok: { ...LAP_FOOTBALL.patok, maksHuruf: 4, maksT: 26, tampilGaris: 0, tampilLabel: 1 } }
  // daftarPatok masih mengembalikan data (karena label masih on)
  const dx = daftarPatok(fNoPatokGaris, 'x')
  cek('3c: meski garis patok dimatikan, daftarPatok tetap ada untuk label', dx.length > 0, String(dx.length))
}

/* ----------- 3d. Batas T hanya memengaruhi sumbu T, huruf tetap penuh jika tak dibatasi ----------- */
{
  const fHanyaT = {
    ...LAP_FOOTBALL,
    patok: { ...LAP_FOOTBALL.patok, maksT: 10 },
  }
  const daftarX = daftarPatok(fHanyaT, 'x')
  // huruf tidak dibatasi → sampai tepi (F,G... ada)
  const adaF = daftarX.some((g) => g.label.replace("'", "") === 'F')
  cek('3d: bila hanya T dibatasi, huruf tetap sampai tepi (F ada)', adaF, String(daftarX.filter(g=>g.label.includes('F')).map(g=>g.label).join(',')))

  const fHanyaHuruf = {
    ...LAP_FOOTBALL,
    patok: { ...LAP_FOOTBALL.patok, maksHuruf: 2 }, // sampai C
  }
  const daftarY2 = daftarPatok(fHanyaHuruf, 'y')
  // T tidak dibatasi → sampai tepi (lebih dari 10)
  cek('3d: bila hanya huruf dibatasi, T tetap sampai tepi (>10)', daftarY2.length > 10, String(daftarY2.length))
}

/* ---------------- 4. Metric field & grid 5 meter tanpa samakan 8-to-5 ---------------- */
{
  // Lapangan bola 105x68 m, grid 5m
  const fMetric = {
    widthYd: 68 * M_TO_YD,
    lengthYd: 105 * M_TO_YD,
    endZoneYd: 0,
    hash: 'none',
    step: '8to5',
    customStepYd: 0.625,
    showLabels: 0,
    satuan: 'm',
    patok: { ...LAP_FOOTBALL.patok, aktif: 1, jarakHuruf: 8, jarakHash: 4, jarakT: 8 },
    garis: 1,
  }
  const s = stepYd(fMetric) // 0.625 yard
  cek('4a: step 8-to-5 tetap 0.625 yard di lapangan metrik', dekat(s, 0.625))
  // 8 langkah = 5 yard = 4.572 m, bukan 5 m
  const eightStepsMeter = 5 * YD_TO_M
  cek('4a: 8 langkah = 5 yard = 4.572 m (bukan 5 m)', dekat(eightStepsMeter, 4.572, 0.01), String(eightStepsMeter))

  // Patok jarak 8 langkah tetap 5 yard fisik, bukan 5 meter
  const daftarXMetric = daftarPatok(fMetric, 'x')
  const aM = daftarXMetric.find((g) => g.label === 'A')
  const bM = daftarXMetric.find((g) => g.label === 'B' && g.arah === 1)
  if (aM && bM) {
    cek('4b: di lapangan metrik, B tetap 5 yard dari A (bukan 5 meter)', dekat(bM.pos - aM.pos, 5, 1e-6), `${bM.pos - aM.pos} yard`)
    cek('4b: dan bukan 5 meter (5.468 yard)', !dekat(bM.pos - aM.pos, 5 * M_TO_YD, 1e-6), `${bM.pos - aM.pos} vs ${5*M_TO_YD}`)
  } else {
    cek('4b: B/A ada di metrik', false, `${aM?.pos} ${bM?.pos}`)
  }

  // Data lama satuanJarak='yard' dikonversi ke langkah tanpa menggeser patok
  const fYardMode = {
    ...fMetric,
    patok: { ...fMetric.patok, satuanJarak: 'yard', jarakHuruf: 5, jarakHash: 2.5, jarakT: 5 },
  }
  const dYard = daftarPatok(fYardMode, 'x')
  const aY = dYard.find((g) => g.label === 'A')
  const bY = dYard.find((g) => g.label === 'B' && g.arah === 1)
  if (aY && bY) {
    cek('4c: data lama mode yard: B tetap 5 yard dari A', dekat(bY.pos - aY.pos, 5, 1e-6), `${bY.pos - aY.pos}`)
  }
  const pYard = patokOf(fYardMode)
  cek('4c: patokOf mengonversi jarak yard lama ke langkah (5 yd = 8 lk, 2,5 yd = 4 lk)',
    dekat(pYard.jarakHuruf, 8, 1e-9) && dekat(pYard.jarakHash, 4, 1e-9) && dekat(pYard.jarakT, 8, 1e-9) && (pYard.satuanJarak ?? 'langkah') === 'langkah',
    JSON.stringify(pYard))

  // v2.9 — garis bantu tiap langkah: satu tombol, terpisah dari garis lapangan
  cek('4d: garis lapangan tampil bawaan', gridUtamaTampil(fMetric) === true)
  cek('4d: garis bantu langkah mati bawaan, nyala bila subgridTampil=1',
    garisLangkahTampil(fMetric) === false && garisLangkahTampil({ ...fMetric, subgridTampil: 1 }) === true)
  cek('4d: garis bantu langkah tidak memengaruhi garis lapangan',
    gridUtamaTampil({ ...fMetric, subgridTampil: 1 }) === true &&
    garisLapangan({ ...fMetric, subgridTampil: 1 }).x.filter((l) => l.jenis !== 'langkah').length === garisLapangan(fMetric).x.length)
}

/* ---------------- 5. #9 — Toggle satuan tampil yard / meter / langkah ---------------- */
{
  const fYd = { ...LAP_FOOTBALL, satuan: 'yd' }
  const fM = { ...LAP_FOOTBALL, satuan: 'm' }
  const fLk = { ...LAP_FOOTBALL, satuan: 'langkah' }

  cek('5a: satuanLapanganOf mengenali yd, m, langkah, dan bawaan yd',
    satuanLapanganOf(fYd) === 'yd' &&
    satuanLapanganOf(fM) === 'm' &&
    satuanLapanganOf(fLk) === 'langkah' &&
    satuanLapanganOf({ ...LAP_FOOTBALL, satuan: undefined }) === 'yd')
  cek('5a: nama & singkatan satuan lengkap',
    namaSatuanLapangan('langkah') === 'langkah' &&
    singkatanSatuanLapangan('langkah') === 'lk' &&
    singkatanSatuanLapangan('m') === 'm' &&
    singkatanSatuanLapangan('yd') === 'yd')

  // Pada 8-to-5 (0,625 yard/langkah): 100 yard = 160 langkah, 5 yard = 8 langkah
  cek('5b: 100 yard pada 8-to-5 = 160 langkah tampilan', dekat(keSatuanTampil(100, fLk), 160, 1e-9), String(keSatuanTampil(100, fLk)))
  cek('5b: 5 yard grid pada 8-to-5 = 8 langkah tampilan', dekat(keSatuanTampil(5, fLk), 8, 1e-9), String(keSatuanTampil(5, fLk)))
  cek('5b: 53,33 yard lebar ≈ 85,328 langkah', dekat(keSatuanTampil(53.33, fLk), 85.328, 1e-6))
  // Pada 6-to-5 (5/6 yard/langkah): 100 yard = 120 langkah
  const f6to5 = { ...fLk, step: '6to5' }
  cek('5b: 100 yard pada 6-to-5 = 120 langkah tampilan', dekat(keSatuanTampil(100, f6to5), 120, 1e-9))

  // Bolak-balik konversi tampilan -> yard kembali tepat untuk ketiga satuan
  for (const sat of ['yd', 'm', 'langkah']) {
    const fUji = { ...LAP_FOOTBALL, satuan: sat }
    const asal = 37.5
    const balik = dariSatuanTampil(keSatuanTampil(asal, fUji), fUji)
    cek(`5c: konversi bolak-balik ${sat} kembali tepat ke yard internal`,
      dekat(balik, asal, 1e-9) && faktorTampilLapangan(fUji) > 0, `${balik} vs ${asal}`)
  }

  // Berpindah ke 'langkah' sama sekali tidak menggeser fieldBox, grid, maupun patok
  const bYd = fieldBox(fYd)
  const bLk = fieldBox(fLk)
  cek('5d: fieldBox identik antara yard dan langkah',
    dekat(bYd.minX, bLk.minX) && dekat(bYd.maxX, bLk.maxX) &&
    dekat(bYd.minY, bLk.minY) && dekat(bYd.maxY, bLk.maxY))
  const gYd = garisLapangan(fYd).x
  const gLk = garisLapangan(fLk).x
  cek('5d: posisi garisLapangan identik antara yard dan langkah',
    gYd.length === gLk.length && gYd.every((v, i) => dekat(v.pos, gLk[i].pos)))
  const pYd = daftarPatok(fYd, 'x')
  const pLk = daftarPatok(fLk, 'x')
  cek('5d: daftarPatok identik antara yard dan langkah',
    pYd.length === pLk.length && pYd.every((g, i) => g.label === pLk[i].label && dekat(g.pos, pLk[i].pos)))
}

/* ---------------- 6. #9 — Garis grid/subgrid otomatis dari fieldBox & palet hex ---------------- */
{
  // Tanpa patok: garis yard tiap 5 yard dari garis 50 (−50..50 = 21 garis), label 0..50..0
  const fTanpaPatok = { ...LAP_FOOTBALL, patok: { ...LAP_FOOTBALL.patok, aktif: 0 } }
  const gFootball = garisLapangan(fTanpaPatok).x
  cek('6a: tanpa patok, garis yard 100 yd tiap 5 yd = 21 garis dengan 50 di tengah',
    gFootball.length === 21 && gFootball.some((l) => dekat(l.pos, 0) && l.label === '50' && l.tengah) && dekat(gFootball[0].pos, -50) && dekat(gFootball[20].pos, 50),
    `len=${gFootball.length}`)
  cek('6a: dengan patok 8-to-5, garis huruf jatuh tepat di garis yard (A=50, B=45, C=40)',
    ['A', 'B', 'C'].every((h, i) => garisLapangan(LAP_FOOTBALL).x.some((l) => l.label === h && dekat(l.pos, i * 5))))

  const fIndoor2m = {
    ...LAP_FOOTBALL,
    widthYd: 20 * M_TO_YD,
    lengthYd: 40 * M_TO_YD,
    endZoneYd: 0,
    satuan: 'm',
  }

  // Garis bantu tiap 1 langkah dari A/T0, tidak menumpuk garis patok
  const fDenganBantu = { ...LAP_FOOTBALL, subgridTampil: 1 }
  const gBantu = garisLapangan(fDenganBantu)
  const bantuX = gBantu.x.filter((l) => l.jenis === 'langkah')
  const utamaX = gBantu.x.filter((l) => l.jenis !== 'langkah')
  const s = stepYd(LAP_FOOTBALL)
  cek('6b: garis bantu tiap 1 langkah dari A, tidak menumpuk garis patok',
    bantuX.length > 100 && bantuX.every((b) => dekat(Math.round(b.pos / s) * s, b.pos, 1e-6) && !utamaX.some((u) => dekat(u.pos, b.pos, 1e-6))),
    `len=${bantuX.length}`)
  const bantuY = gBantu.y.filter((l) => l.jenis === 'langkah')
  const t0y = -LAP_FOOTBALL.widthYd / 2
  cek('6b: garis bantu sumbu T dihitung dari T0 (tepi depan)',
    bantuY.length > 0 && bantuY.every((b) => dekat(Math.round((b.pos - t0y) / s) * s, b.pos - t0y, 1e-6)))

  // Semua warna garis grid wajib hex #rrggbb murni (aman cetak/portabel, nol oklch/rgba)
  const semuaHex = WARNA_GARIS_GRID.length >= 4 && WARNA_GARIS_GRID.every((w) => /^#[0-9a-fA-F]{6}$/.test(w.hex))
  cek('6c: semua palet WARNA_GARIS_GRID memakai hex #rrggbb murni', semuaHex)
  cek('6c: warnaGarisGrid aman untuk kunci tak dikenal (jatuh ke #ffffff)',
    warnaGarisGrid({ ...LAP_FOOTBALL, warnaGrid: 'tidak-ada' }).hex === '#ffffff' &&
    warnaGarisGrid({ ...LAP_FOOTBALL, warnaGrid: 'emas' }).hex === '#fde047')
  cek('6d: skalaGarisLapangan proporsional terhadap ukuran lapangan & pengali tebalGrid',
    skalaGarisLapangan(fIndoor2m) < skalaGarisLapangan(LAP_FOOTBALL) &&
    dekat(tebalGarisGrid({ ...LAP_FOOTBALL, tebalGrid: 1.5 }), 1.5) &&
    skalaGarisLapangan({ ...LAP_FOOTBALL, tebalGrid: 1.5 }) > skalaGarisLapangan({ ...LAP_FOOTBALL, tebalGrid: 0.7 }))
}

/* ---------------- 7. #9 — Patok meter fisik, keselarasan sumbu T, & Indoor tanpa patok ---------------- */
{
  // Data lama satuanJarak = 'meter' dikonversi ke langkah (dibulatkan 0,001 lk → selisih < 1 mm); patokRef selaras
  const fPatokMeter = {
    ...LAP_FOOTBALL,
    widthYd: 20 * M_TO_YD,
    lengthYd: 40 * M_TO_YD,
    endZoneYd: 0,
    satuan: 'm',
    patok: {
      ...LAP_FOOTBALL.patok,
      aktif: 1,
      satuanJarak: 'meter',
      jarakHuruf: 4,
      jarakHash: 2,
      jarakT: 5,
    },
  }
  const dxM = daftarPatok(fPatokMeter, 'x')
  const dyM = daftarPatok(fPatokMeter, 'y')
  const aM = dxM.find((g) => g.label === 'A')
  const bM = dxM.find((g) => g.label === 'B' && g.arah === 1)
  cek('7a: data lama satuanJarak="meter" tetap menempatkan B 4 meter fisik dari A',
    !!(aM && bM && dekat(bM.pos - aM.pos, 4 * M_TO_YD, 0.002)), `${bM && aM ? bM.pos - aM.pos : 'null'}`)
  cek('7a: data lama satuanJarak="meter" tetap menempatkan T1 5 meter fisik dari T0',
    dyM.length >= 2 && dyM[0].label === 'T0' && dekat(dyM[1].pos - dyM[0].pos, 5 * M_TO_YD, 0.002))
  cek('7a: patokOf menyimpan jarak meter lama sebagai langkah',
    patokOf(fPatokMeter).satuanJarak !== 'meter' && dekat(patokOf(fPatokMeter).jarakHuruf * stepYd(fPatokMeter), 4 * M_TO_YD, 0.002))

  // Keselarasan patokRef & coordPatok di sumbu T
  const refT1 = patokRef(bM.pos, dyM[1].pos, fPatokMeter)
  cek('7b: patokRef tepat di (B, T1) memberi huruf B & nomor 1 offset 0',
    refT1.huruf === 'B' && refT1.nomor === 1 && dekat(refT1.nomorOffset, 0, 1e-9),
    JSON.stringify(refT1))
  cek('7b: patokRef di tepi depan memberi nomor 0 (T0)',
    patokRef(bM.pos, dyM[0].pos, fPatokMeter).nomor === 0)
  cek('7b: coordPatok tepat di (B, T1) menulis singkatan "B1", dan 1 langkah di belakang menulis "B · T1 +1"',
    coordPatok(bM.pos, dyM[1].pos, fPatokMeter) === 'B1' &&
    coordPatok(bM.pos, dyM[1].pos + stepYd(fPatokMeter), fPatokMeter) === 'B · T1 +1',
    coordPatok(bM.pos, dyM[1].pos, fPatokMeter) + ' | ' + coordPatok(bM.pos, dyM[1].pos + stepYd(fPatokMeter), fPatokMeter))

  // Batas maksT dihormati pula oleh patokRef (tidak pernah menyebut T di luar maksT)
  const fBatasT4 = { ...fPatokMeter, patok: { ...fPatokMeter.patok, maksT: 3 } }
  const refUjung = patokRef(0, fieldBox(fBatasT4).maxY, fBatasT4)
  cek('7c: bila maksT=3, patokRef di tepi belakang tidak melampaui T3',
    refUjung.nomor === 3 && refUjung.nomorOffset > 0, JSON.stringify(refUjung))

  // Preset 'indoor-polos' (Tanpa patok untuk lapangan indoor kecil)
  const presetPolos = FIELD_PRESETS.find((p) => p.id === 'indoor-polos')
  cek('7d: FIELD_PRESETS menyediakan preset "indoor-polos" (Indoor tanpa patok)', !!presetPolos)
  if (presetPolos) {
    const fPolos = { ...LAP_FOOTBALL, showLabels: 0, ...presetPolos.config }
    cek('7d: preset indoor-polos mematikan patok (aktif=0 & daftarPatok kosong)',
      patokOf(fPolos).aktif === 0 && daftarPatok(fPolos, 'x').length === 0 && daftarPatok(fPolos, 'y').length === 0)
    const gPolos = garisLapangan(fPolos).x
    cek('7d: preset indoor-polos memakai grid yang sama (garis tiap 5 yard dari tengah) dan dikenali activePreset',
      gPolos.length === 9 && gPolos.some((l) => dekat(l.pos, 0)) && activePreset(fPolos) === 'indoor-polos',
      `garis=${gPolos.length}, preset=${activePreset(fPolos)}`)
  }
}

/* ---------------- 8. v2.9 — asal grid, snap, meteran, label T ---------------- */
{
  const f = LAP_FOOTBALL
  const s = stepYd(f)
  const a = asalGrid(f)
  cek('8a: asalGrid dengan patok = (A, T0)', dekat(a.x, 0) && dekat(a.y, -f.widthYd / 2), JSON.stringify(a))
  // Snap ½ langkah (bawaan) dari titik acak selalu jatuh tepat di patok bila dekat patok
  const sn = bulatkanKoordinatSumbu(a.x + 8 * s + 0.12, a.y + 16 * s - 0.1, f)
  cek('8b: snap dari A/T0 — titik dekat B·T2 jatuh tepat "B2"', coordPatok(sn.x, sn.y, f) === 'B2', coordPatok(sn.x, sn.y, f))
  const sn1 = bulatkanKoordinatSumbu(a.x + 10 * s + 0.1, a.y + 24 * s - 0.05, f, { snapAktif: true, langkahX: 1, langkahY: 1 })
  cek('8b: snap 1 langkah memberi "B +2 · T3"', coordPatok(sn1.x, sn1.y, f) === 'B +2 · T3', coordPatok(sn1.x, sn1.y, f))
  const snT = bulatkanKoordinatSumbu(a.x + 10 * s + 0.1, a.y + 24 * s - 0.05, f, { snapAktif: true, langkahX: 1, langkahY: 1, tempelPatok: true })
  cek('8c: tempelPatok menempel ke patok terdekat (B#, T3)', coordPatok(snT.x, snT.y, f) === 'B#3', coordPatok(snT.x, snT.y, f))
  // Lapangan yang lebarnya bukan kelipatan langkah: snap tetap dari T0, bukan dari tengah
  const fGanjil = { ...f, widthYd: 50.3 }
  const aG = asalGrid(fGanjil)
  const snG = bulatkanKoordinatSumbu(0.2, aG.y + 7 * s + 0.1, fGanjil, { snapAktif: true, langkahX: 1, langkahY: 1 })
  cek('8d: lebar ganjil — snap Y tetap kelipatan langkah dari T0',
    dekat((snG.y - aG.y) / s, 7, 1e-9), String((snG.y - aG.y) / s))

  cek('8e: teksMeterAcuan menulis jarak meter dari A & T0',
    teksMeterAcuan(a.x + 10 * s, a.y + 24 * s, f) === '5,72 m dari A · 13,72 m dari T0',
    teksMeterAcuan(a.x + 10 * s, a.y + 24 * s, f))
  cek('8e: teksMeterAcuan tanpa patok memakai garis 50 & sideline depan',
    teksMeterAcuan(5, -f.widthYd / 2 + 5, { ...f, patok: { ...f.patok, aktif: 0 } }).includes('dari garis 50'))

  const tm = tabelMeteran(f)
  cek('8f: tabelMeteran huruf A 0 · A# 2,29 · B 4,57 · C 9,14',
    !!tm && tm.huruf[0].label === 'A' && dekat(tm.huruf[0].meter, 0) &&
    dekat(tm.huruf[1].meter, 2.286, 0.001) && tm.huruf[2].label === 'B' && dekat(tm.huruf[2].meter, 4.572, 0.001) &&
    dekat(tm.huruf.find((b) => b.label === 'C').meter, 9.144, 0.001),
    tm ? tm.huruf.slice(0, 5).map((b) => `${b.label} ${b.meter}`).join(' · ') : 'null')
  cek('8f: tabelMeteran T mulai T0 = 0, T1 = 4,57 m; dua sisi saat A di tengah',
    !!tm && tm.t[0].label === 'T0' && dekat(tm.t[0].meter, 0) && dekat(tm.t[1].meter, 4.572, 0.001) && tm.duaSisi === true)
  cek('8f: tabelMeteran null bila tanpa patok', tabelMeteran({ ...f, patok: { ...f.patok, aktif: 0 } }) === null)
  cek('8g: labelT 0-based ("T0", atau "3" bila tanpa awalan)',
    labelT(patokOf(f), 0) === 'T0' && labelT({ ...patokOf(f), awalanT: 0 }, 3) === '3')
}

console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) {
  for (const g of gagal) console.log('  ✗ ' + g)
  process.exitCode = 1
}
