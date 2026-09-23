/**
 * Uji M-putar-jalan — rotasi lingkaran yang pusatnya ikut berjalan.
 *
 * Sifat terpenting yang diuji di sini bukan "apakah angkanya keluar", melainkan
 * apakah **formasi tetap utuh**: kalau satu blok berputar sambil pusatnya
 * bergeser, jarak antar pemain harus tetap sama di sepanjang jalan. Kalau
 * tidak, bloknya mengkerut di tengah jalan lalu mengembang lagi — cacat yang
 * justru ingin dihindari oleh jalur busur.
 */
import { putarPosisi, titikBusur, deltaBusur, cocokPutaran, turunkanPusatAkhir } from '/tmp/gerak.mjs'

let lulus = 0
let gagal = 0
const dekat = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol
function cek(nama, syarat, keterangan = '') {
  if (syarat) {
    lulus++
  } else {
    gagal++
    console.log(`  GAGAL: ${nama}${keterangan ? ' — ' + keterangan : ''}`)
  }
}
/** Jarak dua titik. */
const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1])
const grup = (n) => console.log(`\n${n}`)

/* ========================================================================== */
/*  1. geser nol = perilaku lama (kompatibilitas mundur)                      */
/* ========================================================================== */
grup('1. geser nol = berputar di tempat')

{
  const pusat = { x: 10, y: 4 }
  const P = [3, 7]
  // Tanpa argumen geser sama sekali.
  cek('titikBusur tanpa geser = putarPosisi', dekat(titikBusur(1, P[0], P[1], pusat, 90)[0], putarPosisi(P[0], P[1], pusat, 90)[0]))
  // Geser eksplisit nol.
  const a = titikBusur(0.5, P[0], P[1], pusat, 90)
  const b = titikBusur(0.5, P[0], P[1], pusat, 90, { x: 0, y: 0 })
  cek('geser {0,0} identik dengan tanpa geser', dekat(a[0], b[0]) && dekat(a[1], b[1]))
  // Progres 0 = posisi awal.
  const t0 = titikBusur(0, P[0], P[1], pusat, 90, { x: 5, y: -2 })
  cek('t=0 persis di posisi awal', dekat(t0[0], P[0]) && dekat(t0[1], P[1]))
  // deltaBusur di t=0 = nol.
  const dl = deltaBusur(0, P[0], P[1], pusat, 90, { x: 5, y: -2 })
  cek('deltaBusur t=0 = (0,0)', dekat(dl[0], 0) && dekat(dl[1], 0))
}

/* ========================================================================== */
/*  2. Ujungnya benar: putar, lalu geser                                      */
/* ========================================================================== */
grup('2. posisi akhir = putar(P0, sudut) + geser')

{
  const pusat = { x: 10, y: 4 }
  const sudut = 90
  const geser = { x: 6, y: -3 }
  const P = [3, 7]
  const akhir = titikBusur(1, P[0], P[1], pusat, sudut, geser)
  const murni = putarPosisi(P[0], P[1], pusat, sudut)
  cek('x akhir = putar + geser.x', dekat(akhir[0], murni[0] + geser.x))
  cek('y akhir = putar + geser.y', dekat(akhir[1], murni[1] + geser.y))

  // Putaran 90°: (3,7) mengitari (10,4) → jarum lawan? rumus baku CCW.
  // dx=-7, dy=3 → cos0 sin1 → x = 10 + (-7*0 - 3*1) = 7, y = 4 + (-7*1 + 3*0) = -3
  cek('putaran 90° tanpa geser = (7,-3)', dekat(murni[0], 7) && dekat(murni[1], -3))
  cek('dengan geser = (13,-6)', dekat(akhir[0], 13) && dekat(akhir[1], -6))
}

/* ========================================================================== */
/*  3. Sifat yang menentukan: formasi tidak berubah bentuk                    */
/* ========================================================================== */
grup('3. jarak antar pemain terjaga sepanjang jalan')

{
  const pusat = { x: 10, y: 4 }
  const sudut = 90
  const geser = { x: 6, y: -3 }
  // Empat pemain membentuk blok 4×4.
  const blok = [
    [2, 2],
    [6, 2],
    [6, 6],
    [2, 6],
  ]
  // Jarak asli antar pasangan.
  const pasang = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 0],
    [0, 2],
    [1, 3],
  ]
  const asli = pasang.map(([i, j]) => d(blok[i], blok[j]))

  for (const t of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]) {
    const kini = blok.map((p) => titikBusur(t, p[0], p[1], pusat, sudut, geser))
    pasang.forEach(([i, j], k) => {
      cek(
        `jarak ${i}-${j} tetap di t=${t}`,
        dekat(d(kini[i], kini[j]), asli[k], 1e-9),
        `menjadi ${d(kini[i], kini[j]).toFixed(6)} dari ${asli[k].toFixed(6)}`,
      )
    })
  }
}

{
  // Jarak ke pusat yang SEDANG BERJALAN juga tetap.
  const pusat = { x: 10, y: 4 }
  const geser = { x: 6, y: -3 }
  const P = [3, 7]
  const r0 = Math.hypot(P[0] - pusat.x, P[1] - pusat.y)
  for (const t of [0, 0.25, 0.5, 0.75, 1]) {
    const kini = titikBusur(t, P[0], P[1], pusat, 90, geser)
    const pusatKini = { x: pusat.x + geser.x * t, y: pusat.y + geser.y * t }
    const r = Math.hypot(kini[0] - pusatKini.x, kini[1] - pusatKini.y)
    cek(`jari-jari ke pusat berjalan tetap di t=${t}`, dekat(r, r0, 1e-9), `${r} vs ${r0}`)
  }
}

/* ========================================================================== */
/*  4. Pusat benar-benar berjalan lurus                                       */
/* ========================================================================== */
grup('4. pusat bergerak lurus & merata')

{
  const pusat = { x: 0, y: 0 }
  const geser = { x: 10, y: 0 }
  // Pemain tepat di pusat tidak berputar (jari-jari nol), tapi ikut berjalan.
  const P = [0, 0]
  const setengah = titikBusur(0.5, P[0], P[1], pusat, 180, geser)
  cek('titik di pusat ikut berjalan ke tengah geseran', dekat(setengah[0], 5) && dekat(setengah[1], 0))
  const penuh = titikBusur(1, P[0], P[1], pusat, 180, geser)
  cek('titik di pusat tiba di ujung geseran', dekat(penuh[0], 10) && dekat(penuh[1], 0))

  // Pemain yang berdiri tepat di pusat tidak ikut berputar (jari-jari nol),
  // jadi ia mengikuti pusatnya — jalannya harus lurus & merata.
  const langkah = []
  for (let i = 0; i <= 10; i++) langkah.push(titikBusur(i / 10, 0, 0, pusat, 90, geser))
  const loncat = []
  for (let i = 1; i < langkah.length; i++) loncat.push(d(langkah[i - 1], langkah[i]))
  const min = Math.min(...loncat)
  const max = Math.max(...loncat)
  cek('pusat berjalan merata (tidak meloncat)', max - min < 1e-9, `min ${min} max ${max}`)
  cek('pusat menempuh 1 yard tiap 1/10 perjalanan', dekat(min, 1, 1e-9), `${min}`)
}

{
  /*
   * Catatan penting, sengaja diuji supaya tidak "diperbaiki" nanti.
   *
   * Pemain yang BERPUTAR sambil pusatnya berjalan **kecepatannya tidak
   * konstan**: ia melaju lebih cepat saat kecepatan putarannya searah dengan
   * arah jalan, dan lebih pelan saat berlawanan. Ini bukan cacat — memang
   * begitu kenyataannya di lapangan. Pemain di sisi luar menempuh jarak lebih
   * jauh dalam hitungan yang sama, dan justru itulah yang dihitung peringkat
   * kesulitannya. Yang penting mereka **berangkat dan tiba bersama**, dan
   * bentuk formasinya utuh — keduanya sudah diuji di bagian 3.
   */
  const pusat = { x: 0, y: 0 }
  const geser = { x: 10, y: 0 }
  const tanpaGeser = []
  const denganGeser = []
  for (let i = 0; i <= 10; i++) tanpaGeser.push(titikBusur(i / 10, 5, 0, pusat, 90, { x: 0, y: 0 }))
  for (let i = 0; i <= 10; i++) denganGeser.push(titikBusur(i / 10, 5, 0, pusat, 90, geser))
  const rentang = (a) => {
    const l = []
    for (let i = 1; i < a.length; i++) l.push(d(a[i - 1], a[i]))
    return Math.max(...l) - Math.min(...l)
  }
  cek('putaran di tempat: kecepatan konstan', rentang(tanpaGeser) < 1e-9, `${rentang(tanpaGeser)}`)
  cek('sambil berjalan: kecepatan memang berubah (wajar)', rentang(denganGeser) > 0.01, `${rentang(denganGeser)}`)
}

/* ========================================================================== */
/*  5. cocokPutaran dengan geser                                              */
/* ========================================================================== */
grup('5. cocokPutaran')

{
  const pusat = { x: 10, y: 4 }
  const sudut = 90
  const geser = { x: 6, y: -3 }
  const P = [3, 7]
  const murni = putarPosisi(P[0], P[1], pusat, sudut)

  cek('cocok kalau geser sudah diperhitungkan', cocokPutaran(P[0], P[1], murni[0] + geser.x, murni[1] + geser.y, pusat, sudut, geser))
  cek('tidak cocok kalau geser diabaikan', !cocokPutaran(P[0], P[1], murni[0] + geser.x, murni[1] + geser.y, pusat, sudut))
  cek('cocok untuk putaran di tempat', cocokPutaran(P[0], P[1], murni[0], murni[1], pusat, sudut))
  cek('tidak cocok kalau sudut nol', !cocokPutaran(P[0], P[1], murni[0], murni[1], pusat, 0))
  // Toleransi: 0,4 yard masih lewat, 0,6 tidak.
  cek('dalam toleransi 0,4 yard diterima', cocokPutaran(P[0], P[1], murni[0] + geser.x + 0.4, murni[1] + geser.y, pusat, sudut, geser))
  cek('luar toleransi 0,6 yard ditolak', !cocokPutaran(P[0], P[1], murni[0] + geser.x + 0.6, murni[1] + geser.y, pusat, sudut, geser))
}

/* ========================================================================== */
/*  6. turunkanPusatAkhir — memulihkan geseran yang diketahui                 */
/* ========================================================================== */
grup('6. turunkanPusatAkhir memulihkan geseran')

{
  const pusat = { x: 10, y: 4 }
  const sudut = 90
  const geser = { x: 6, y: -3 }
  const blok = [
    [2, 2],
    [6, 2],
    [6, 6],
    [2, 6],
    [4, 4],
  ]
  // Bangun posisi akhir yang sebenarnya pakai rumus, lalu minta diturunkan.
  const titik = blok.map((p) => {
    const a = titikBusur(1, p[0], p[1], pusat, sudut, geser)
    return { x0: p[0], y0: p[1], x1: a[0], y1: a[1] }
  })
  const r = turunkanPusatAkhir(titik, pusat, sudut)
  cek('hasil tidak null', r !== null)
  cek('ikut semua pemain', r.ikut === blok.length, `ikut ${r.ikut}`)
  cek('pusat akhir x benar', dekat(r.x, pusat.x + geser.x, 1e-9), `${r.x}`)
  cek('pusat akhir y benar', dekat(r.y, pusat.y + geser.y, 1e-9), `${r.y}`)
}

{
  // Geseran nol (berputar di tempat) harus pulih jadi pusat itu sendiri.
  const pusat = { x: -5, y: 2 }
  const blok = [
    [0, 0],
    [4, 0],
    [4, 4],
  ]
  const titik = blok.map((p) => {
    const a = putarPosisi(p[0], p[1], pusat, 45)
    return { x0: p[0], y0: p[1], x1: a[0], y1: a[1] }
  })
  const r = turunkanPusatAkhir(titik, pusat, 45)
  cek('putaran di tempat → pusat akhir = pusat awal', r !== null && dekat(r.x, pusat.x, 1e-9) && dekat(r.y, pusat.y, 1e-9))
}

/* ========================================================================== */
/*  7. turunkanPusatAkhir kebal terhadap pemain yang tidak ikut              */
/* ========================================================================== */
grup('7. pemain yang tidak ikut berputar tidak boleh merusak hasil')

{
  const pusat = { x: 10, y: 4 }
  const sudut = 90
  const geser = { x: 6, y: -3 }
  const blok = [
    [2, 2],
    [6, 2],
    [6, 6],
    [2, 6],
    [4, 4],
    [3, 5],
  ]
  const titik = blok.map((p) => {
    const a = titikBusur(1, p[0], p[1], pusat, sudut, geser)
    return { x0: p[0], y0: p[1], x1: a[0], y1: a[1] }
  })
  // Sisipkan 3 pemain "pengacau": diam di tempat.
  titik.push({ x0: -20, y0: -20, x1: -20, y1: -20 })
  titik.push({ x0: 25, y0: 18, x1: 25, y1: 18 })
  titik.push({ x0: 0, y0: 30, x1: -14, y1: 2 })
  const r = turunkanPusatAkhir(titik, pusat, sudut)
  cek('hasil tidak null walau ada pengacau', r !== null)
  cek('ikut = 6 pemain blok, bukan 9', r.ikut === 6, `ikut ${r.ikut}`)
  cek('dari = 9 pemain dipertimbangkan', r.dari === 9, `dari ${r.dari}`)
  cek('pusat akhir tetap benar', r !== null && dekat(r.x, pusat.x + geser.x, 1e-9) && dekat(r.y, pusat.y + geser.y, 1e-9))
}

{
  // Kalau hanya SATU pemain yang konsisten → tidak bisa membuktikan putaran.
  const pusat = { x: 0, y: 0 }
  const titik = [
    { x0: 5, y0: 0, x1: 5, y1: 3 }, // satu-satunya yang "konsisten"
    { x0: -20, y0: -20, x1: -20, y1: -20 },
    { x0: 25, y0: 18, x1: 25, y1: 18 },
  ]
  const r = turunkanPusatAkhir(titik, pusat, 90)
  cek('satu pemain saja → null', r === null, `hasil ${JSON.stringify(r)}`)
}

{
  // Kurang dari dua pemain → null.
  cek('satu titik saja → null', turunkanPusatAkhir([{ x0: 5, y0: 0, x1: 5, y1: 3 }], { x: 0, y: 0 }, 90) === null)
  cek('daftar kosong → null', turunkanPusatAkhir([], { x: 0, y: 0 }, 90) === null)
  // Sudut nol → null.
  cek(
    'sudut nol → null',
    turunkanPusatAkhir(
      [
        { x0: 5, y0: 0, x1: 6, y1: 0 },
        { x0: 6, y0: 0, x1: 7, y1: 0 },
      ],
      { x: 0, y: 0 },
      0,
    ) === null,
  )
}

/* ========================================================================== */
/*  8. Putaran besar & sudut negatif                                          */
/* ========================================================================== */
grup('8. sudut besar & negatif')

{
  const pusat = { x: 2, y: -3 }
  const geser = { x: -8, y: 4 }
  for (const sudut of [-180, -90, -45, 45, 180, 270, 360]) {
    const blok = [
      [0, 0],
      [4, 0],
      [4, 4],
    ]
    const titik = blok.map((p) => {
      const a = titikBusur(1, p[0], p[1], pusat, sudut, geser)
      return { x0: p[0], y0: p[1], x1: a[0], y1: a[1] }
    })
    const r = turunkanPusatAkhir(titik, pusat, sudut)
    cek(
      `sudut ${sudut}° pulih`,
      r !== null && dekat(r.x, pusat.x + geser.x, 1e-9) && dekat(r.y, pusat.y + geser.y, 1e-9),
      `hasil ${r && r.x},${r && r.y}`,
    )
  }
  // 360° dengan geser = kembali ke bentuk semula, tapi sudah bergeser.
  const P = [6, 1]
  const a = titikBusur(1, P[0], P[1], pusat, 360, geser)
  cek('360° = posisi awal + geser', dekat(a[0], P[0] + geser.x, 1e-9) && dekat(a[1], P[1] + geser.y, 1e-9))
}

/* ========================================================================== */
/*  9. Progres di luar 0..1 dijepit                                           */
/* ========================================================================== */
grup('9. progres dijepit')

{
  const pusat = { x: 0, y: 0 }
  const geser = { x: 4, y: 0 }
  const a = titikBusur(-1, 5, 0, pusat, 90, geser)
  const b = titikBusur(0, 5, 0, pusat, 90, geser)
  cek('t negatif dijepit ke t=0', dekat(a[0], b[0]) && dekat(a[1], b[1]))
  const c = titikBusur(2, 5, 0, pusat, 90, geser)
  const e = titikBusur(1, 5, 0, pusat, 90, geser)
  cek('t > 1 dijepit ke t=1', dekat(c[0], e[0]) && dekat(c[1], e[1]))
}

/* ========================================================================== */
console.log(`\n${lulus} lulus, ${gagal} gagal`)
process.exit(gagal ? 1 : 0)
