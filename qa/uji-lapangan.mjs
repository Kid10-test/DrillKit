/**
 * Uji logika `src/lib/field.ts` — sistem koordinat lapangan.
 *
 * Mengapa rangkaian ini ada: ini modul terbesar di aplikasi (656 baris)
 * dan sampai sekarang **tidak punya uji logika sama sekali**. Ia
 * menentukan ke mana seorang pemain berdiri. Kalau ia salah, anak-anak
 * berbaris ke tempat yang salah — dan tidak ada yang menyadarinya
 * sampai seluruh formasi tampak miring.
 *
 * Yang diuji di sini bukan angka hasil hitungan semata, melainkan
 * **konvensi** yang dipakai bersama oleh beberapa fungsi sekaligus:
 *   - S1 di kiri layar, S2 di kanan (`sx = halfL − x`);
 *   - depan/penonton di bawah, belakang di atas (`sy = halfW − y`);
 *   - koordinat yang DITULIS harus sama dengan patok yang DIGAMBAR.
 *
 * Bila dua fungsi memakai konvensi yang berbeda, pemain akan berdiri
 * di tempat yang benar menurut satu layar dan salah menurut layar lain.
 *
 * Pakai: node uji-lapangan.mjs
 */
import {
  HASH_OFFSET_YD,
  STEP_YD,
  activePreset,
  coordPatok,
  coordText,
  daftarPatok,
  describe,
  facingDeg,
  fieldBox,
  hashOffsetYd,
  hurufPatok,
  labelT,
  panahArah,
  patokRef,
  patokTerdekat,
  stepYd,
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
const dekat = (a, b, batas = 1e-6) => Math.abs(a - b) <= batas

/** Lapangan standar DCI: 100 × 53,33 yard, end zone 10, hash NCAA, langkah 8-to-5. */
const LAP = {
  widthYd: 53.33,
  lengthYd: 100,
  endZoneYd: 10,
  gridYd: 5,
  hash: 'ncaa',
  step: '8to5',
  customStepYd: 0.625,
  showLabels: 1,
  patok: {
    aktif: 0,
    sumbuHuruf: 'x',
    dariTengah: 1,
    awalanT: 1,
    penandaSisi: 1,
    jarakHuruf: 8,
    jarakHash: 4,
    jarakT: 8,
    tampil: 1,
  },
}

/* ----------------------------- 1. ukuran langkah ---------------------------- */
{
  cek('1: langkah 8-to-5 = 5/8 yard', dekat(STEP_YD['8to5'], 0.625), String(STEP_YD['8to5']))
  cek('1: langkah 6-to-5 = 5/6 yard', dekat(STEP_YD['6to5'], 5 / 6), String(STEP_YD['6to5']))
  cek('1: ukuran khusus dipakai bila step = custom', dekat(stepYd({ ...LAP, step: 'custom', customStepYd: 1.25 }), 1.25))
  cek('1: ukuran khusus DIABAIKAN bila step bukan custom',
    dekat(stepYd({ ...LAP, step: '6to5', customStepYd: 99 }), 5 / 6))

  /*
   * N16 — ukuran langkah yang tidak bisa dipakai.
   *
   * `customStepYd` diketik bebas pelatih, dan mengosongkan kolomnya
   * menghasilkan `0` (bukan NaN — jadi tidak ketahuan). Tanpa
   * penjagaan, seluruh koordinat menjadi NaN.
   */
  cek('1: ukuran langkah 0 dikembalikan ke ukuran baku',
    dekat(stepYd({ ...LAP, step: 'custom', customStepYd: 0 }), 0.625),
    String(stepYd({ ...LAP, step: 'custom', customStepYd: 0 })))
  cek('1: ukuran langkah negatif pun dikembalikan',
    dekat(stepYd({ ...LAP, step: 'custom', customStepYd: -3 }), 0.625))
  cek('1: NaN tidak pernah lolos', dekat(stepYd({ ...LAP, step: 'custom', customStepYd: NaN }), 0.625))
  cek('1: preset yang tidak dikenal tidak menghasilkan undefined',
    dekat(stepYd({ ...LAP, step: 'apa' }), 0.625), String(stepYd({ ...LAP, step: 'apa' })))
  cek('1: ukuran khusus yang MASUK AKAL tetap dipakai apa adanya',
    dekat(stepYd({ ...LAP, step: 'custom', customStepYd: 1.25 }), 1.25))

  /*
   * Yang menentukan bukan angkanya, melainkan akibatnya: koordinatnya
   * tidak boleh mengandung NaN. Buku saku yang berisi "NaN" tidak bisa
   * dipakai siapa pun.
   */
  {
    const rusak = { ...LAP, step: 'custom', customStepYd: 0 }
    let bersih = true
    let contoh = ''
    for (let x = -50; x <= 50; x += 7.3) {
      for (const y of [-20, 0, 13.5]) {
        const c = describe(x, y, rusak)
        const t = coordText(x, y, rusak)
        for (const v of [c.xSteps, c.ySteps, c.fromYardLineSteps, c.fromHashSteps]) {
          if (!Number.isFinite(v)) { bersih = false; contoh = `x=${x} y=${y}`; break }
        }
        if (/NaN|Infinity|undefined/.test(t)) { bersih = false; contoh = `teks: ${t}` }
        if (!bersih) break
      }
      if (!bersih) break
    }
    cek('1: ukuran langkah nol TIDAK menghasilkan NaN pada koordinat mana pun',
      bersih, contoh)
  }
}

/* ------------------------------ 2. jarak hash ------------------------------- */
/*
 * Angka-angka ini tertulis di dalam keterangan kodenya. Kalau konstanta
 * dan keterangannya berbeda, salah satunya berbohong — dan jarak hash
 * yang meleset beberapa kaki akan membuat seluruh barisan miring.
 */
{
  cek('2: hash NFHS ≈ 8,889 yard (53′ 4″ terpisah)', dekat(HASH_OFFSET_YD.nfhs, (53 + 4 / 12) / 3 / 2, 1e-9),
    String(HASH_OFFSET_YD.nfhs))
  cek('2: dan nilainya masuk akal (8–9 yard)', HASH_OFFSET_YD.nfhs > 8 && HASH_OFFSET_YD.nfhs < 9,
    String(HASH_OFFSET_YD.nfhs))
  cek('2: hash NCAA ≈ 6,667 yard (40′ terpisah)', dekat(HASH_OFFSET_YD.ncaa, 40 / 3 / 2, 1e-9),
    String(HASH_OFFSET_YD.ncaa))
  cek('2: hash NFL ≈ 3,083 yard (18′ 6″ terpisah)', dekat(HASH_OFFSET_YD.nfl, (18 + 6 / 12) / 3 / 2, 1e-9),
    String(HASH_OFFSET_YD.nfl))
  cek('2: tanpa hash = 0', HASH_OFFSET_YD.none === 0)
  cek('2: hash yang tidak dikenal tidak menghasilkan NaN', dekat(hashOffsetYd({ hash: 'apa' }), 0),
    String(hashOffsetYd({ hash: 'apa' })))
  cek('2: NCAA lebih dekat ke tengah daripada NFHS', HASH_OFFSET_YD.ncaa < HASH_OFFSET_YD.nfhs)
}

/* ----------------------------- 3. batas lapangan ---------------------------- */
{
  const b = fieldBox(LAP)
  cek('3: panjang total termasuk DUA end zone', dekat(b.totalLengthYd, 120), String(b.totalLengthYd))
  cek('3: lebarnya tidak berubah', dekat(b.totalWidthYd, 53.33))
  cek('3: batasnya setangkup', dekat(b.minX, -b.maxX) && dekat(b.minY, -b.maxY),
    `${b.minX}..${b.maxX}`)
  // x = membujur (S1↔S2, ada end zone); y = melintang (depan↔belakang).
  cek('3: sumbu x membujur — lebarnya 120 yard, bukan 53', dekat(b.maxX - b.minX, 120))
  cek('3: sumbu y melintang — lebarnya 53,33 yard', dekat(b.maxY - b.minY, 53.33))
}

/* -------------------- 4. describe(): garis yard & sisi ---------------------- */
{
  const s = stepYd(LAP) // 0,625 yard per langkah
  const tengah = describe(0, 0, LAP)
  cek('4: titik tengah berada di garis 50', tengah.yardLine === 50, String(tengah.yardLine))
  cek('4: dan tidak berjarak dari garisnya', dekat(tengah.fromYardLineSteps, 0),
    String(tengah.fromYardLineSteps))
  cek('4: titik tengah dihitung sebagai Side 1', tengah.side === 'S1')

  // Garis yard: setiap 5 yard dari tengah menurun nilainya.
  cek('4: 5 yard ke S1 = garis 45', describe(5, 0, LAP).yardLine === 45,
    String(describe(5, 0, LAP).yardLine))
  cek('4: 20 yard ke S1 = garis 30', describe(20, 0, LAP).yardLine === 30,
    String(describe(20, 0, LAP).yardLine))
  cek('4: 50 yard ke S1 = garis 0 (garis gawang)', describe(50, 0, LAP).yardLine === 0)
  cek('4: di dalam end zone pun tidak pernah negatif', describe(58, 0, LAP).yardLine === 0,
    String(describe(58, 0, LAP).yardLine))

  // Berdiri tepat di garis → jaraknya nol.
  for (const x of [-45, -20, -5, 0, 5, 20, 45]) {
    cek(`4: berdiri di x=${x} tidak berjarak dari garisnya`,
      dekat(describe(x, 0, LAP).fromYardLineSteps, 0, 1e-9),
      String(describe(x, 0, LAP).fromYardLineSteps))
  }

  // Sisi.
  cek('4: x positif = Side 1', describe(3, 0, LAP).side === 'S1')
  cek('4: x negatif = Side 2', describe(-3, 0, LAP).side === 'S2')

  // Simetri: dua sisi lapangan harus tercermin sempurna.
  {
    const a = describe(12.5, 4, LAP)
    const b = describe(-12.5, 4, LAP)
    cek('4: dua sisi memberi nomor garis yang sama', a.yardLine === b.yardLine,
      `${a.yardLine} vs ${b.yardLine}`)
    cek('4: dan jarak dari garisnya berlawanan tanda',
      dekat(a.fromYardLineSteps, -b.fromYardLineSteps, 1e-9),
      `${a.fromYardLineSteps} vs ${b.fromYardLineSteps}`)
    cek('4: dan jarak melintangnya sama', dekat(a.ySteps, b.ySteps))
  }

  // Sumbu melintang diukur dari garis DEPAN (penonton).
  cek('4: y = −halfW (garis depan) = 0 langkah dari depan',
    dekat(describe(0, -LAP.widthYd / 2, LAP).ySteps, 0, 1e-9),
    String(describe(0, -LAP.widthYd / 2, LAP).ySteps))
  cek('4: y = +halfW (garis belakang) = lebar penuh dalam langkah',
    dekat(describe(0, LAP.widthYd / 2, LAP).ySteps, LAP.widthYd / s, 1e-6),
    String(describe(0, LAP.widthYd / 2, LAP).ySteps))
}

/* ------------------- 5. describe(): acuan hash terdekat --------------------- */
{
  const ho = HASH_OFFSET_YD.ncaa
  cek('5: tepat di front hash → acuannya front hash',
    describe(0, -ho, LAP).hashRef === 'front hash', describe(0, -ho, LAP).hashRef)
  cek('5: tepat di back hash → acuannya back hash',
    describe(0, ho, LAP).hashRef === 'back hash', describe(0, ho, LAP).hashRef)
  cek('5: di garis depan → acuannya front sideline',
    describe(0, -LAP.widthYd / 2, LAP).hashRef === 'front sideline',
    describe(0, -LAP.widthYd / 2, LAP).hashRef)
  cek('5: di garis belakang → acuannya back sideline',
    describe(0, LAP.widthYd / 2, LAP).hashRef === 'back sideline',
    describe(0, LAP.widthYd / 2, LAP).hashRef)

  /*
   * Yang menentukan: acuan yang dipilih memang yang TERDEKAT. Bila yang
   * dipilih bukan yang terdekat, jarak yang tercetak di buku saku akan
   * lebih panjang daripada yang seharusnya.
   */
  let semuaDekat = true
  let counter = ''
  for (let y = -26; y <= 26; y += 0.37) {
    const c = describe(0, y, LAP)
    const ho2 = HASH_OFFSET_YD.ncaa
    const pilihan = {
      'front hash': -ho2,
      'back hash': ho2,
      'front sideline': -LAP.widthYd / 2,
      'back sideline': LAP.widthYd / 2,
    }
    const palingDekat = Math.min(...Object.values(pilihan).map((p) => Math.abs(y - p)))
    if (Math.abs(y - pilihan[c.hashRef]) > palingDekat + 1e-9) {
      semuaDekat = false
      counter = `y=${y.toFixed(2)} memilih ${c.hashRef}`
      break
    }
  }
  cek('5: acuannya SELALU yang terdekat di seluruh lebar lapangan', semuaDekat, counter)

  // Tanpa hash, acuan yang tersisa hanya dua garis tepi.
  /*
   * N15 — cacat yang ditemukan rangkaian ini: dengan pilihan "Tanpa
   * hash", `hashOffsetYd` = 0 menempatkan kedua hash tepat di garis
   * tengah lapangan. Maka setiap pemain diberi acuan "FH" (front hash)
   * padahal di lapangannya tidak ada hash sama sekali — anak-anak
   * disuruh berdiri sekian langkah dari garis yang tidak ada.
   */
  {
    const tanpa = { ...LAP, hash: 'none' }
    cek('5: tanpa hash, titik tengah memakai sideline, bukan hash',
      describe(0, 0, tanpa).hashRef.includes('sideline'),
      describe(0, 0, tanpa).hashRef)
    let bebasDariHash = true
    let contohFH = ''
    for (let y = -26; y <= 26; y += 0.5) {
      const c = describe(0, y, tanpa)
      if (c.hashRef.includes('hash')) { bebasDariHash = false; contohFH = `y=${y} → ${c.hashRef}`; break }
    }
    cek('5: tanpa hash, TIDAK ADA satu pun posisi yang menyebut hash',
      bebasDariHash, contohFH)
    cek('5: dan teks koordinatnya pun tidak menyebut FH/BH',
      !/FH|BH/.test(coordText(0, 4, tanpa)), coordText(0, 4, tanpa))
    // Sebaliknya: dengan hash, acuan hash HARUS tetap dipakai — jangan
    // sampai penjagaannya mematikan fitur yang benar.
    cek('5: dengan hash NCAA, acuan hash tetap dipakai di dekatnya',
      describe(0, HASH_OFFSET_YD.ncaa, LAP).hashRef === 'back hash',
      describe(0, HASH_OFFSET_YD.ncaa, LAP).hashRef)
  }
}

/* ------------------------------ 6. coordText -------------------------------- */
{
  const t = coordText(0, 0, LAP)
  cek('6: koordinatnya menyebut sisi, garis, dan acuan', /^S1 · YL50 · /.test(t), t)
  cek('6: dan tidak menulis "+0"', !/\+0(\s|$)/.test(t), t)
  cek('6: jarak ditulis seperempat langkah, bukan desimal panjang',
    /^[+-]?\d+(\.\d{1,2})?$/.test(coordText(3.1, 1.7, LAP).split(' · ')[1].split(' ').pop()),
    coordText(3.1, 1.7, LAP))
  // Pemain di S2 harus tertulis S2.
  cek('6: pemain di sisi seberang tertulis S2', coordText(-12, 0, LAP).startsWith('S2'),
    coordText(-12, 0, LAP))
}

/* --------------------------- 7. penamaan patok ------------------------------ */
{
  cek('7: patok ke-0 = A', hurufPatok(0) === 'A', hurufPatok(0))
  cek('7: patok ke-25 = Z', hurufPatok(25) === 'Z', hurufPatok(25))
  cek('7: patok ke-26 = AA (bukan BA)', hurufPatok(26) === 'AA', hurufPatok(26))
  cek('7: patok ke-27 = AB', hurufPatok(27) === 'AB', hurufPatok(27))
  cek('7: patok ke-51 = AZ', hurufPatok(51) === 'AZ', hurufPatok(51))
  cek('7: patok ke-52 = BA', hurufPatok(52) === 'BA', hurufPatok(52))
  // Labelnya tidak boleh pernah mengandung karakter aneh.
  let semuaHuruf = true
  for (let k = 0; k < 300; k += 1) if (!/^[A-Z]+$/.test(hurufPatok(k))) semuaHuruf = false
  cek('7: 300 patok pertamanya semuanya huruf kapital murni', semuaHuruf)
  cek('7: label T memakai awalan T', labelT({ awalanT: 1 }, 6) === 'T6', labelT({ awalanT: 1 }, 6))
  cek('7: dan bisa tanpa awalan', labelT({ awalanT: 0 }, 6) === '6', labelT({ awalanT: 0 }, 6))
}

/* --------------------- 8. patok: gambar & tulisan sama ---------------------- */
{
  /*
   * Inilah butir yang paling menentukan. `patokRef` mengambil daftarnya
   * LANGSUNG dari `daftarPatok` agar koordinat yang ditulis sama dengan
   * patok yang digambar. Bila dua-duanya berbeda sumber, buku saku
   * menyebut patok yang tidak ada di lapangan.
   */
  const aktif = { ...LAP, patok: { ...LAP.patok, aktif: 1 } }
  const daftar = daftarPatok(aktif, 'x')
  cek('8: patok hurufnya digambar', daftar.length > 0, String(daftar.length))
  cek('8: A berada di titik tengah (pola dari tengah)',
    daftar.some((g) => g.label === 'A' && dekat(g.pos, 0, 1e-9)),
    JSON.stringify(daftar.slice(0, 3)))
  cek('8: patoknya setangkup — ada di dua sisi A',
    daftar.some((g) => g.pos > 0.1) && daftar.some((g) => g.pos < -0.1))

  /*
   * Tanda # harus berada DI ANTARA dua huruf, tidak boleh melewatinya.
   * Kalau sampai melewati, urutan patok di lapangan terbalik.
   */
  const huruf = daftar.filter((g) => !g.label.replace(/'$/, '').endsWith('#'))
  const kres = daftar.filter((g) => g.label.replace(/'$/, '').endsWith('#'))
  cek('8: tanda # ada', kres.length > 0, String(kres.length))
  /*
   * Setiap tanda # harus terjepit di antara DUA huruf yang mengapitnya.
   * (Uji pertama saya mengukur celahnya dari celah pertama saja — 0→5 —
   * sehingga B# di 7,5 dinyatakan melampaui padahal ia terjepit rapi
   * antara B di 5 dan C di 10. Kegagalannya ada pada ujinya, bukan
   * pada kodenya.)
   */
  {
    const posHuruf = huruf.map((g) => Math.abs(g.pos)).sort((a, b) => a - b)
    let kresDiAntara = true
    let contoh = ''
    for (const g of kres) {
      const p = Math.abs(g.pos)
      const bawah = posHuruf.filter((q) => q < p - 1e-9)
      const atas = posHuruf.filter((q) => q > p + 1e-9)
      if (bawah.length === 0 || atas.length === 0) {
        kresDiAntara = false
        contoh = `${g.label} di ${p.toFixed(3)} tidak terjepit dua huruf`
        break
      }
    }
    cek('8: setiap tanda # terjepit di antara dua huruf, tidak pernah melewatinya',
      kresDiAntara, contoh)
    cek('8: dan tidak ada tanda # yang menempati posisi sebuah huruf',
      kres.every((g) => huruf.every((h) => Math.abs(Math.abs(h.pos) - Math.abs(g.pos)) > 1e-9)))
  }

  // Koordinat yang ditulis harus memakai patok, bukan format football.
  const teks = coordPatok(0, 0, aktif)
  cek('8: koordinat memakai patok bila patok dinyalakan', !/YL/.test(teks), teks)
  cek('8: dan menyebut patok hurufnya', /^A/.test(teks), teks)
  cek('8: serta patok angkanya', /T\d/.test(teks), teks)
  cek('8: coordText mengikuti pilihan patok', coordText(0, 0, LAP).includes('YL50'),
    coordText(0, 0, LAP))
  cek('8: dan coordText memakai patok bila patok aktif', !coordText(0, 0, aktif).includes('YL50'),
    coordText(0, 0, aktif))

  /*
   * A berdiri sendirian di tengah. Dua langkah di sebelah S2 tidak boleh
   * tercetak "A −3.25", karena anak-anak akan membacanya "mendekati A"
   * lalu berdiri di seberang lapangan.
   */
  {
    const r = patokRef(-2, 0, aktif)
    cek('8: posisi di sisi negatif A ditandai koma atas, bukan tanda minus',
      r.huruf === "A'", JSON.stringify(r))
    cek('8: dan jaraknya positif — selalu diukur menjauhi A', r.hurufOffset > 0,
      String(r.hurufOffset))
  }

  // Menempel ke patok terdekat.
  {
    const daftarY = daftarPatok(aktif, 'y')
    if (daftarY.length > 1) {
      const target = daftarY[1].pos
      const nempel = patokTerdekat(aktif, 'y', target + 0.4)
      cek('8: titik bisa menempel ke patok terdekat', dekat(nempel, target, 1e-9),
        `${nempel} vs ${target}`)
    }
    cek('8: tanpa patok, nilai dikembalikan apa adanya',
      dekat(patokTerdekat({ ...LAP, patok: { ...LAP.patok, tampil: 0 } }, 'x', 7.5), 7.5))
  }
}

/* ------------------------------ 9. panah arah ------------------------------- */
/*
 * Konvensi layar (terbukti dari sx = halfL − x dan sy = halfW − y):
 *   atas = belakang · bawah = penonton · kiri = S1 · kanan = S2.
 * Panah yang meleset 90° membuat anak-anak berjalan ke arah yang salah.
 */
{
  cek('9: bergerak ke arah S1 → panah kiri (S1 di kiri layar)', panahArah(1, 0) === '←', panahArah(1, 0))
  cek('9: bergerak ke arah S2 → panah kanan', panahArah(-1, 0) === '→', panahArah(-1, 0))
  cek('9: bergerak ke arah belakang → panah atas', panahArah(0, 1) === '↑', panahArah(0, 1))
  cek('9: bergerak ke arah penonton → panah bawah', panahArah(0, -1) === '↓', panahArah(0, -1))
  cek('9: diam tidak menghasilkan panah', panahArah(0, 0) === '')
  cek('9: diagonalnya pun masuk akal', panahArah(1, 1) === '↖', panahArah(1, 1))
}

/* ------------------------------ 10. arah hadap ------------------------------ */
{
  cek('10: menghadap penonton = 0°', facingDeg('front') === 0)
  cek('10: membelakangi penonton = 180°', facingDeg('back') === 180)
  cek('10: menghadap kiri (S1) = 90°', facingDeg('left') === 90)
  cek('10: menghadap kanan (S2) = −90°', facingDeg('right') === -90)
  cek('10: arah tak dikenal memakai sudutnya sendiri', facingDeg('apa', 42) === 42)
  cek('10: arah tak dikenal tanpa sudut jatuh ke 0', facingDeg('apa') === 0)
}

/* ------------------------------ 11. preset ---------------------------------- */
{
  cek('11: pengaturan standar dikenali sebagai preset', activePreset(LAP) != null,
    String(activePreset(LAP)))
  cek('11: pengaturan aneh tidak dianggap preset mana pun',
    activePreset({ ...LAP, widthYd: 47.3, lengthYd: 93.7 }) === null,
    String(activePreset({ ...LAP, widthYd: 47.3 })))
}

console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) {
  for (const g of gagal) console.log('  ✗ ' + g)
  process.exitCode = 1
}
