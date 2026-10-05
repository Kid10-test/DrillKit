/**
 * Uji murni #5 sisa — Drill × segmen lagu: penggaris dua baris, bantuan
 * hitungan, dan pecah/gabung set.
 *
 * Rakit dulu modulnya:
 *   npx esbuild src/lib/segmenDrill.ts --bundle --format=esm --platform=neutral \
 *     --outfile=/tmp/segmen.mjs && node qa/segmen-drill-logika.mjs
 *
 * Yang diuji (sesuai rancangan #5 butir 1, 2, dan 4):
 *  - penggaris: rentang hitungan & birama tiap segmen dan tiap set;
 *  - tanda ⚡ untuk set yang melewati perubahan tempo atau sukat;
 *  - bantuan "mulai di hitungan … / sisa segmen …" dan "Pas ke batas segmen";
 *  - pecah set: posisi peralihan diambil dari jalur yang ada (lurus, busur,
 *    melengkung) dan animasinya tetap sama;
 *  - gabung set: hitungan menjumlah, busur hasil pecahan kembali utuh;
 *  - panjang segmen dalam hitungan drill untuk editor lagu.
 */
import {
  bantuanSet,
  bulatkanHitungan,
  fmtAngka,
  gabungGerak,
  panjangSegmenLagu,
  pecahSet,
  petaPenggaris,
} from '/tmp/segmen.mjs'
import { deltaBusur, gerakOf, progresPemain, titikJalur } from '/tmp/gerak.mjs'

let lulus = 0
let gagal = 0
function uji(nama, ok, detail = '') {
  if (ok) {
    lulus++
    console.log('  ✓ ' + nama)
  } else {
    gagal++
    console.log('  ✗ ' + nama + (detail ? ' → ' + detail : ''))
  }
}
function sama(nama, aktual, harap) {
  const a = JSON.stringify(aktual)
  const h = JSON.stringify(harap)
  uji(nama, a === h, `dapat ${a}, harap ${h}`)
}
function dekat(nama, aktual, harap, tol = 1e-6) {
  uji(nama, Math.abs(aktual - harap) <= tol, `dapat ${aktual}, harap ≈${harap}`)
}
function mengandung(nama, teks, bagian) {
  uji(nama, String(teks).includes(bagian), `"${teks}" tidak memuat "${bagian}"`)
}

const Q = { nilai: 4, titik: false }
const E = { nilai: 8, titik: false }
const M44 = { pembilang: 4, penyebut: 4, kelompok: [2, 2], acuan: Q }
const M78 = { pembilang: 7, penyebut: 8, kelompok: [2, 2, 3], acuan: E }

/*
 * Lagu uji: 4/4 @120 mulai birama 1.
 *  - birama 4 ketuk 2 → 160 BPM  (tengah hitungan ke-7 drill)
 *  - birama 6        → 7/8       (tepat di batas hitungan ke-11)
 * Drill: beatsPerCount = 2 (1 hitungan = 2 ketuk), set 8 + 8 + 4 hitungan.
 */
const LAGU = {
  bpm: 120,
  tandaBirama: M44,
  tempoMap: [
    { measure: 4, beat: 2, bpm: 160, label: 'Bagian A' },
    { measure: 6, bpm: 160, birama: M78, label: 'Bagian B' },
  ],
}
const SETS = [{ counts: 8, name: 'Set 1' }, { counts: 8, name: 'Set 2' }, { counts: 4, name: 'Set 3' }]
const OPSI = { beatsPerCount: 2 }

console.log('\n— Penggaris: baris segmen & baris set —')
const peta = petaPenggaris(SETS, LAGU, OPSI)
sama('20 hitungan total', peta.totalHitungan, 20)
sama('tiga set', peta.set.length, 3)
sama('tiga blok segmen (Awal + 2 baris)', peta.segmen.length, 3)

{
  const s0 = peta.set[0]
  sama('set 1: hitungan 0–8', [s0.mulai, s0.akhir], [0, 8])
  dekat('set 1 mulai birama 1', s0.mulaiBirama, 1)
  dekat('set 1 berakhir di birama 5 (4 birama 4/4)', s0.akhirBirama, 5, 1e-3)
  dekat('set 1 tempo 120', s0.bpm, 120)
  uji('set 1 melewati perubahan tempo → ⚡', s0.lintasTempo === true)
  uji('set 1 tidak melewati perubahan sukat', s0.lintasSukat === false)
  mengandung('keterangan ⚡ menyebut 120 → 160', s0.keterangan[0], '120 → 160 BPM')
  mengandung('keterangan ⚡ menyebut hitungan 7', s0.keterangan[0], 'hitungan 7')

  const s1 = peta.set[1]
  dekat('set 2 mulai pada tempo 160', s1.bpm, 160)
  uji('set 2 melewati perubahan sukat → ⚡', s1.lintasSukat === true)
  mengandung('keterangan ⚡ menyebut 4/4 → 7/8', s1.keterangan[0], '4/4 → 7/8')
  mengandung('keterangan ⚡ menyebut birama 6', s1.keterangan[0], 'birama 6')

  const s2 = peta.set[2]
  uji('set 3 tidak melewati perubahan', s2.lintasTempo === false && s2.lintasSukat === false)
  dekat('set 3 mulai setelah 16 hitungan', s2.mulai, 16)
}

{
  const [a, b, c] = peta.segmen
  sama('blok awal bernama "Awal"', a.label, 'Awal')
  uji('blok awal ditandai dasar', a.dasar === true)
  dekat('blok awal: hitungan 0 – 6,5', a.mulai, 0)
  dekat('blok awal berakhir di hitungan 6,5', a.akhir, 6.5)
  dekat('blok awal tempo 120', a.bpm, 120)
  dekat('segmen A mulai di hitungan 6,5', b.mulai, 6.5, 1e-9)
  dekat('segmen A tempo 160', b.bpm, 160)
  dekat('segmen A berakhir di hitungan 10', b.akhir, 10)
  dekat('segmen A mulai birama 4,25', b.mulaiBirama, 4.25, 1e-3)
  sama('segmen B bersukat 7/8', b.birama && c.birama.penyebut, 8)
  dekat('segmen B mulai di hitungan 10', c.mulai, 10)
  dekat('segmen B berakhir di ujung drill (20)', c.akhir, 20)
}

console.log('\n— Bantuan mengisi hitungan —')
{
  const b1 = bantuanSet(peta, 1, true)
  uji('bantuan ada untuk set 2', b1.ada === true)
  dekat('mulai di hitungan 9 (1-based)', b1.mulaiHitungan, 9)
  sama('segmen yang memuatnya: Bagian A', b1.segmen?.label, 'Bagian A')
  dekat('sisa segmen 2 hitungan', b1.sisa, 2, 1e-9)
  sama('sisa bulat 2', b1.sisaBulat, 2)
  uji('batasnya tepat di batas hitungan', b1.tepat === true)
  mengandung('teks: mulai di hitungan 9', b1.teks, 'Mulai di hitungan 9')
  mengandung('teks: sisa segmen Bagian A: 2', b1.teks, 'sisa segmen Bagian A: 2 hitungan')
  uji('"Pas ke batas segmen" tersedia', b1.bisaPas === true)

  const b0 = bantuanSet(peta, 0, true)
  dekat('set 1 sisa segmen 6,5 hitungan (batas di tengah hitungan)', b0.sisa, 6.5, 1e-9)
  sama('dibulatkan ke hitungan terdekat', b0.sisaBulat, 7)
  uji('ditandai tidak tepat', b0.tepat === false)
  mengandung('teks rinci menjelaskan pembulatannya', b0.teksRinci, 'dibulatkan ke 7')

  const b2 = bantuanSet(peta, 2, false)
  uji('set terakhir: tombol Pas dimatikan (tidak ada tujuan)', b2.bisaPas === false)
  uji('set terakhir tetap dapat keterangan', b2.ada === true)

  sama('pembulatan minimal 1 hitungan', bulatkanHitungan(0.4), 1)
  sama('format angka: bulat tanpa desimal', fmtAngka(5), '5')
  sama('format angka: pecahan satu desimal (koma)', fmtAngka(6.5), '6,5')
}

console.log('\n— Pecah set: jalur lurus, animasi tetap identik —')
{
  const P0 = { a: { x: 0, y: 0, facing: 'front' }, b: { x: 2, y: 1, facing: 'front' } }
  const P1 = { a: { x: 8, y: 4, facing: 'front' }, b: { x: 10, y: -2, facing: 'front' } }
  const hasil = pecahSet({ counts: 8, points: P0, tujuan: P1, di: 4 })
  uji('hasil pecah ada', !!hasil)
  dekat('hitungan bagian pertama 4', hasil.hitunganPertama, 4)
  dekat('hitungan bagian kedua 4', hasil.hitunganKedua, 4)
  dekat('titik tengah a = (4,2)', hasil.tengah.a.x, 4)
  dekat('titik tengah a.y = 2', hasil.tengah.a.y, 2)
  dekat('titik tengah b = (6, -0,5)', hasil.tengah.b.x, 6)
  dekat('titik tengah b.y = -0,5', hasil.tengah.b.y, -0.5)
  sama('jalur bagian pertama tetap lurus', hasil.gerakPertama.jalur, 'lurus')
  sama('jalur bagian kedua tetap lurus', hasil.gerakKedua.jalur, 'lurus')

  // Animasi identik: posisi tiap hitungan sesudah dipecah = sebelum dipecah.
  const g1 = gerakOf(hasil.gerakPertama)
  const g2 = gerakOf(hasil.gerakKedua)
  let maks = 0
  for (const id of ['a', 'b']) {
    for (let c = 0; c <= 8; c += 1) {
      const a = titikJalur(c / 8, P1[id].x - P0[id].x, P1[id].y - P0[id].y, 0)
      const asli = [P0[id].x + a[0], P0[id].y + a[1]]
      let pecah
      if (c <= 4) {
        const t = progresPemain(c / 4, g1, undefined, 4)
        const d = titikJalur(t, hasil.tengah[id].x - P0[id].x, hasil.tengah[id].y - P0[id].y, 0)
        pecah = [P0[id].x + d[0], P0[id].y + d[1]]
      } else {
        const t = progresPemain((c - 4) / 4, g2, undefined, 4)
        const d = titikJalur(
          t,
          P1[id].x - hasil.tengah[id].x,
          P1[id].y - hasil.tengah[id].y,
          0,
        )
        pecah = [hasil.tengah[id].x + d[0], hasil.tengah[id].y + d[1]]
      }
      maks = Math.max(maks, Math.hypot(asli[0] - pecah[0], asli[1] - pecah[1]))
    }
  }
  uji('seluruh posisi hitungan sama persis (lurus)', maks < 1e-9, `selisih ${maks}`)

  uji('pecah mustahil pada set 1 hitungan', pecahSet({ counts: 1, points: P0, tujuan: P1, di: 1 }) === null)

  // Pemain yang tidak ada di set berikutnya tetap di tempatnya.
  const hasil2 = pecahSet({
    counts: 8,
    points: { ...P0, c: { x: 1, y: 1, facing: 'front' } },
    tujuan: P1,
    di: 2,
  })
  dekat('pemain tanpa tujuan tetap di tempat', hasil2.tengah.c.x, 1)
}

console.log('\n— Pecah set: busur putaran —')
{
  const pusat = { x: 0, y: 0 }
  const P0 = { a: { x: 10, y: 0, facing: 'front' }, b: { x: 0, y: 10, facing: 'front' } }
  const putar = { pusat, sudut: 90 }
  const gerak = { jalur: 'busur', putar }
  // Tujuan tiap pemain = hasil putaran penuh → semua cocok dengan busurnya.
  const P1 = { a: { x: 0, y: 10, facing: 'front' }, b: { x: -10, y: 0, facing: 'front' } }
  const hasil = pecahSet({ counts: 8, points: P0, tujuan: P1, gerak, di: 4 })
  const tengah = hasil.tengah
  dekat('titik tengah a pada busur 45°', tengah.a.x, 10 * Math.cos(Math.PI / 4), 1e-9)
  dekat('titik tengah a.y pada busur 45°', tengah.a.y, 10 * Math.sin(Math.PI / 4), 1e-9)
  dekat('sudut bagian pertama 45°', hasil.gerakPertama.putar.sudut, 45, 1e-9)
  dekat('sudut bagian kedua 45°', hasil.gerakKedua.putar.sudut, 45, 1e-9)

  const g1 = gerakOf(hasil.gerakPertama)
  const g2 = gerakOf(hasil.gerakKedua)
  let maks = 0
  for (const id of ['a', 'b']) {
    for (let c = 0; c <= 8; c += 1) {
      const a = deltaBusur(c / 8, P0[id].x, P0[id].y, pusat, 90)
      const asli = [P0[id].x + a[0], P0[id].y + a[1]]
      let pecah
      if (c <= 4) {
        const d = deltaBusur(progresPemain(c / 4, g1, undefined, 4), P0[id].x, P0[id].y, pusat, g1.putar.sudut)
        pecah = [P0[id].x + d[0], P0[id].y + d[1]]
      } else {
        const t = progresPemain((c - 4) / 4, g2, undefined, 4)
        const d = deltaBusur(t, tengah[id].x, tengah[id].y, g2.putar.pusat, g2.putar.sudut)
        pecah = [tengah[id].x + d[0], tengah[id].y + d[1]]
      }
      maks = Math.max(maks, Math.hypot(asli[0] - pecah[0], asli[1] - pecah[1]))
    }
  }
  uji('seluruh posisi hitungan sama persis (busur)', maks < 1e-9, `selisih ${maks}`)

  // Busur yang pusatnya bergeser (pusatAkhir) juga harus terjaga.
  const gerakGeser = { jalur: 'busur', putar: { pusat, sudut: 90, pusatAkhir: { x: 2, y: 0 } } }
  const P1g = {
    a: { x: 0 + 2, y: 10, facing: 'front' },
    b: { x: -10 + 2, y: 0, facing: 'front' },
  }
  const hasilG = pecahSet({ counts: 8, points: P0, tujuan: P1g, gerak: gerakGeser, di: 4 })
  const tg = hasilG.tengah
  dekat('busur berjalan: titik tengah x', tg.a.x, 10 * Math.cos(Math.PI / 4) + 1, 1e-9)
  dekat('busur berjalan: titik tengah y', tg.a.y, 10 * Math.sin(Math.PI / 4), 1e-9)
  dekat('busur berjalan: pusat akhir bagian pertama', hasilG.gerakPertama.putar.pusatAkhir.x, 1, 1e-9)
  dekat('busur berjalan: pusat akhir bagian kedua', hasilG.gerakKedua.putar.pusatAkhir.x, 2, 1e-9)

  // Gabung kembali: sudut & geser menjumlah → bentuknya utuh seperti semula.
  const gabung = gabungGerak(hasilG.gerakPertama, hasilG.gerakKedua)
  sama('gabung busur: jalurnya busur', gabung.jalur, 'busur')
  dekat('gabung busur: sudut 90°', gabung.putar.sudut, 90, 1e-9)
  dekat('gabung busur: pusat akhir kembali ke (2,0)', gabung.putar.pusatAkhir.x, 2, 1e-9)
  dekat('gabung busur: pusat akhir y tetap 0', gabung.putar.pusatAkhir.y, 0, 1e-9)

  const gabung2 = gabungGerak(hasil.gerakPertama, hasil.gerakKedua)
  dekat('gabung busur tanpa geser: sudut 90°', gabung2.putar.sudut, 90, 1e-9)
  uji('gabung busur tanpa geser: tidak membuat pusatAkhir', gabung2.putar.pusatAkhir === undefined)

  // Busur berbeda pusat tidak bisa dijumlahkan → diturunkan jadi lurus.
  const lain = gabungGerak(gerak, { jalur: 'busur', putar: { pusat: { x: 5, y: 5 }, sudut: 30 } })
  sama('busur beda pusat → jalur lurus', lain.jalur, 'lurus')
}

console.log('\n— Pecah set: jalur melengkung —')
{
  const P0 = { a: { x: 0, y: 0, facing: 'front' } }
  const P1 = { a: { x: 10, y: 0, facing: 'front' } }
  const gerak = { jalur: 'lengkung', lengkung: 0.6 }
  const hasil = pecahSet({ counts: 8, points: P0, tujuan: P1, gerak, di: 4 })
  const asli = titikJalur(0.5, 10, 0, 0.6)
  dekat('titik pecah di tengah kurva asli (x)', hasil.tengah.a.x, asli[0], 1e-9)
  dekat('titik pecah di tengah kurva asli (y)', hasil.tengah.a.y, asli[1], 1e-9)
  uji(
    'kelengkungan kedua bagian diturunkan dari kurva aslinya',
    hasil.gerakPertama.lengkung > 0.2 && hasil.gerakPertama.lengkung < 0.35,
    `bagian pertama ${hasil.gerakPertama.lengkung}`,
  )

  const g1 = gerakOf(hasil.gerakPertama)
  const g2 = gerakOf(hasil.gerakKedua)
  let maks = 0
  for (let c = 0; c <= 8; c += 1) {
    const d0 = titikJalur(c / 8, 10, 0, 0.6)
    const a = [P0.a.x + d0[0], P0.a.y + d0[1]]
    let p
    if (c <= 4) {
      const d = titikJalur(progresPemain(c / 4, g1, undefined, 4), hasil.tengah.a.x, hasil.tengah.a.y, g1.lengkung)
      p = [P0.a.x + d[0], P0.a.y + d[1]]
    } else {
      const d = titikJalur(
        progresPemain((c - 4) / 4, g2, undefined, 4),
        P1.a.x - hasil.tengah.a.x,
        P1.a.y - hasil.tengah.a.y,
        g2.lengkung,
      )
      p = [hasil.tengah.a.x + d[0], hasil.tengah.a.y + d[1]]
    }
    maks = Math.max(maks, Math.hypot(a[0] - p[0], a[1] - p[1]))
  }
  /*
   * Kurva melengkung tidak bisa dinyatakan persis oleh dua kurva dengan
   * parameter `lengkung` yang sama: titik kendali sub-kurva hasil de Casteljau
   * tidak selalu tegak lurus pada talinya. Yang dijamin: titik pecahnya tepat
   * di kurva asli, dan sisa simpangan antar-hitungannya tetap di bawah ±0,15
   * yard (≈13 cm) untuk perpindahan 10 yard yang melengkung kuat (0,6).
   */
  uji('penyimpangan kurva tetap kecil (< 0,15 yard)', maks < 0.15, `selisih ${maks}`)
}

console.log('\n— Pecah set: tempo berubah di dalam set —')
{
  const P0 = { a: { x: 0, y: 0, facing: 'front' } }
  const P1 = { a: { x: 16, y: 0, facing: 'front' } }
  // 8 hitungan, porsi waktu 0,4 (mis. temponya melambat di paruh kedua).
  const hasil = pecahSet({ counts: 8, points: P0, tujuan: P1, di: 4, porsi: 0.4 })
  dekat('titik pecah memakai porsi waktu, bukan di/counts', hasil.tengah.a.x, 16 * 0.4, 1e-9)
}

console.log('\n— Panjang segmen dalam hitungan drill (editor lagu) —')
{
  const lagu = {
    bpm: 120,
    tandaBirama: M44,
    tempoMap: [
      { measure: 1, bpm: 120, label: 'Bagian A' },
      { measure: 5, bpm: 150, label: 'Bagian B' },
    ],
  }
  const p = panjangSegmenLagu(lagu, 2, { akhirBirama: 8 })
  sama('dua segmen', p.length, 2)
  sama('segmen A panjangnya 8 hitungan', p[0].hitungan, 8)
  sama('segmen B panjangnya 8 hitungan', p[1].hitungan, 8)
  dekat('segmen A mulai birama 1', p[0].mulaiBirama, 1)
  dekat('segmen A berakhir di birama 5', p[0].akhirBirama, 5, 1e-3)
  sama('tanpa panjang lagu, segmen terakhir belum tentu', panjangSegmenLagu(lagu, 2)[1].hitungan, null)
  sama('ketukan per hitungan 1 → panjangnya dua kali', panjangSegmenLagu(lagu, 1, { akhirBirama: 8 })[0].hitungan, 16)
  sama('lagu tanpa segmen → daftar kosong', panjangSegmenLagu({ ...lagu, tempoMap: [] }, 2).length, 0)
}

console.log(`\n${gagal === 0 ? 'LULUS' : 'GAGAL'}: ${lulus} lulus, ${gagal} gagal\n`)
process.exit(gagal === 0 ? 0 : 1)
