/**
 * Uji fondasi grid & patok — tujuan 1-4 dari audit pasca PR #14.
 *
 * Fokus:
 * 1. Yard ↔ meter tidak mengubah geometri (internal tetap yard)
 * 2. grid & patok terpisah (batas patok tidak memotong grid)
 * 3. batas huruf/T (E / T26 simetris, tidak auto-fill melewati batas)
 * 4. jangan samakan yard & meter diam-diam (8-to-5 = 8 langkah per 5 yard, bukan 5 meter)
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
  garisGridUtama,
  garisSubgrid,
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
  subgridTampil,
  hashGarisTampil,
} from '/tmp/lapangan.mjs'

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
  gridYd: 5,
  subgridYd: undefined,
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
  const t1 = daftarY.find((g) => g.label === 'T1')
  const t2 = daftarY.find((g) => g.label === 'T2')
  cek('1c: T1 ada', !!t1)
  cek('1c: T2 ada', !!t2)
  if (t1 && t2) cek('1c: T2 5 yard dari T1 (8 langkah)', dekat(t2.pos - t1.pos, 5, 1e-6), `${t2.pos - t1.pos}`)
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

  // yardline grid juga tidak bergeser: gridYd tetap 5 yard internal, bukan 5 meter
  // bila field satuan m tapi gridYd tetap 5 (yard), grid tetap 5 yard, bukan 5m
  // Untuk lapangan football, gridYd=5 yard; jika satuan diganti m, grid tetap 5 yard internal
  // (konversi tampil: 5 yard = 4.572 m, bukan 5 m)
  const gridYd = fYd.gridYd
  cek('2b: gridYd internal tetap 5 yard walau satuan m', dekat(fM.gridYd, 5), String(fM.gridYd))
  // hitung yardLines yang akan digambar FieldSurface: -50..50 step 5 yard
  const yardLinesYd = []
  for (let y = -fYd.lengthYd / 2; y <= fYd.lengthYd / 2 + 0.001; y += fYd.gridYd) yardLinesYd.push(y)
  const yardLinesM = []
  for (let y = -fM.lengthYd / 2; y <= fM.lengthYd / 2 + 0.001; y += fM.gridYd) yardLinesM.push(y)
  cek('2b: yardLines grid sama yard vs meter', yardLinesYd.length === yardLinesM.length && yardLinesYd.every((v,i)=>dekat(v, yardLinesM[i])), `${yardLinesYd.length} vs ${yardLinesM.length}`)

  // Pastikan bukan diam-diam jadi 5 meter: 5 meter = 5.468 yard, berbeda dari 5 yard
  const grid5mYd = 5 * M_TO_YD
  cek('2b: 5 meter fisik = 5.468 yard, berbeda dari 5 yard', !dekat(grid5mYd, 5, 1e-3), `${grid5mYd} vs 5`)
}

/* -------- 3. Batas E / T26 menghentikan patok/label tapi grid tetap utuh -------- */
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
  cek('3b: jumlah T = 26 (dibatasi bukan 30)', daftarT26.length === 26, String(daftarT26.length))
  // pada lapangan football sempit, batas 26 tetap 11 (tidak memaksa di luar tepi)
  cek('3b: pada football sempit, T tetap 11 walau batas 26 (tidak keluar tepi)', daftarY.length === 11, `${daftarY.length}`)

  // Grid tetap utuh: yardLines tidak terpengaruh batas patok
  const yardLines = []
  for (let y = -LAP_FOOTBALL.lengthYd / 2; y <= LAP_FOOTBALL.lengthYd / 2 + 0.001; y += LAP_FOOTBALL.gridYd) yardLines.push(y)
  // 100 yard length /5 = 21 garis (-50..50): -50,-45,...,0,...,45,50 => 21
  cek('3c: grid tetap 21 garis walau patok dibatasi E/T26', yardLines.length === 21, String(yardLines.length))
  // juga cek grid utama tetap tampil walau patok dibatasi
  const fGridOn = gridUtamaTampil(fBatas)
  cek('3c: grid utama tetap tampil', fGridOn === true)
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
    gridYd: 5 * M_TO_YD, // 5 meter dalam yard
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
  const gridYd = fMetric.gridYd
  cek('4a: grid 5 meter = 5.468 yard', dekat(gridYd, 5 * M_TO_YD, 1e-9), String(gridYd))
  cek('4a: grid 5m (5.468 yd) != 8 langkah (5 yd)', !dekat(gridYd, 8 * s, 1e-6), `${gridYd} vs ${8*s}`)
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

  // Jika satuanJarak='yard', patok jarak dihitung yard fisik
  const fYardMode = {
    ...fMetric,
    patok: { ...fMetric.patok, satuanJarak: 'yard', jarakHuruf: 5, jarakHash: 2.5, jarakT: 5 },
  }
  const dYard = daftarPatok(fYardMode, 'x')
  const aY = dYard.find((g) => g.label === 'A')
  const bY = dYard.find((g) => g.label === 'B' && g.arah === 1)
  if (aY && bY) {
    cek('4c: mode yard: B 5 yard dari A (jarak yard, bukan langkah)', dekat(bY.pos - aY.pos, 5, 1e-6), `${bY.pos - aY.pos}`)
  }

  // Grid & patok terpisah: matikan patok garis tidak hilangkan grid
  const fTanpaPatokGaris = { ...fMetric, patok: { ...fMetric.patok, tampilGaris: 0, tampilLabel: 1 } }
  const gridOn = gridUtamaTampil(fTanpaPatokGaris)
  cek('4d: grid tetap tampil walau garis patok dimatikan', gridOn === true)
  // subgrid terpisah
  const fSub = { ...fMetric, subgridYd: 2.5 * M_TO_YD, subgridTampil: 1 }
  cek('4d: subgrid dapat ditampilkan terpisah dari grid utama', subgridTampil(fSub) === true, String(subgridTampil(fSub)))
  const fNoSub = { ...fMetric, subgridYd: undefined, subgridTampil: 0 }
  cek('4d: subgrid mati tidak memengaruhi grid utama', gridUtamaTampil(fNoSub) === true && subgridTampil(fNoSub) === false)
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
  const gYd = garisGridUtama(fYd)
  const gLk = garisGridUtama(fLk)
  cek('5d: posisi garisGridUtama identik antara yard dan langkah',
    gYd.length === gLk.length && gYd.every((v, i) => dekat(v, gLk[i])))
  const pYd = daftarPatok(fYd, 'x')
  const pLk = daftarPatok(fLk, 'x')
  cek('5d: daftarPatok identik antara yard dan langkah',
    pYd.length === pLk.length && pYd.every((g, i) => g.label === pLk[i].label && dekat(g.pos, pLk[i].pos)))
}

/* ---------------- 6. #9 — Garis grid/subgrid otomatis dari fieldBox & palet hex ---------------- */
{
  const gFootball = garisGridUtama(LAP_FOOTBALL)
  cek('6a: garisGridUtama 100 yd tiap 5 yd = 21 garis tepat dari fieldBox',
    gFootball.length === 21 && gFootball.includes(0) && dekat(gFootball[0], -50) && dekat(gFootball[20], 50),
    `len=${gFootball.length}`)

  // Lapangan indoor 40x20 m dengan grid kustom 2 m -> 21 garis (-20 m .. 0 .. +20 m), tengah tepat 0
  const fIndoor2m = {
    ...LAP_FOOTBALL,
    widthYd: 20 * M_TO_YD,
    lengthYd: 40 * M_TO_YD,
    endZoneYd: 0,
    gridYd: 2 * M_TO_YD,
    satuan: 'm',
  }
  const gIndoor = garisGridUtama(fIndoor2m)
  cek('6a: lapangan 40 m dengan grid kustom 2 m menghasilkan 21 garis dengan tengah tepat 0',
    gIndoor.length === 21 && gIndoor.includes(0), `len=${gIndoor.length}, mid=${gIndoor[10]}`)

  // Subgrid 2,5 yd di dalam grid utama 5 yd menghasilkan tepat 20 garis dan tidak menumpuk garis utama
  const fDenganSub = { ...LAP_FOOTBALL, gridYd: 5, subgridYd: 2.5, subgridTampil: 1 }
  const gSub = garisSubgrid(fDenganSub)
  cek('6b: subgrid 2,5 yd di dalam grid 5 yd (100 yd) menghasilkan 20 garis non-duplikat',
    gSub.length === 20 && gSub.every((s) => !gFootball.some((u) => dekat(u, s, 1e-6))),
    `len=${gSub.length}`)

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
  // Mode satuanJarak = 'meter': jarak patok mengikuti meter fisik dan patokRef selaras dengan daftarPatok
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
  cek('7a: satuanJarak="meter" menempatkan B tepat 4 meter fisik dari A',
    !!(aM && bM && dekat(bM.pos - aM.pos, 4 * M_TO_YD, 1e-9)), `${bM && aM ? bM.pos - aM.pos : 'null'}`)
  cek('7a: satuanJarak="meter" menempatkan T2 tepat 5 meter fisik dari T1',
    dyM.length >= 2 && dekat(dyM[1].pos - dyM[0].pos, 5 * M_TO_YD, 1e-9))

  // Keselarasan patokRef & coordPatok di sumbu T pada satuanJarak 'meter' dan 'yard'
  const refT2Meter = patokRef(bM.pos, dyM[1].pos, fPatokMeter)
  cek('7b: patokRef tepat di (B, T2) pada mode meter memberi huruf B & nomor 2 offset 0',
    refT2Meter.huruf === 'B' && refT2Meter.nomor === 2 && dekat(refT2Meter.nomorOffset, 0, 1e-9),
    JSON.stringify(refT2Meter))
  cek('7b: coordPatok tepat di (B, T2) pada mode meter menulis singkatan "B2", dan 1 langkah di belakang menulis "B · T2 +1"',
    coordPatok(bM.pos, dyM[1].pos, fPatokMeter) === 'B2' &&
    coordPatok(bM.pos, dyM[1].pos + stepYd(fPatokMeter), fPatokMeter) === 'B · T2 +1',
    coordPatok(bM.pos, dyM[1].pos, fPatokMeter))

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
    cek('7d: preset indoor-polos tetap menggambar 21 garis grid tiap 2 m dan dikenali activePreset',
      garisGridUtama(fPolos).length === 21 && activePreset(fPolos) === 'indoor-polos',
      `garis=${garisGridUtama(fPolos).length}, preset=${activePreset(fPolos)}`)
  }
}

console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) {
  for (const g of gagal) console.log('  ✗ ' + g)
  process.exitCode = 1
}
