/**
 * Uji ambang kesulitan gerak yang bisa diatur.
 *
 * Uji yang paling penting ada di bagian 5: reproduksi persis keluhan yang
 * dilaporkan — analitik berkata "nyaman" sementara buku saku mencetak
 * "mustahil". Dulu analitik hanya menilai kecepatan; kini harus menilai
 * keduanya dan memakai yang lebih buruk.
 */
import {
  AMBANG,
  AMBANG_LANGKAH,
  ambangEfektif,
  analisisPerpindahan,
  lebihBerat,
  setTerberat,
  tingkatDari,
  tingkatLangkahDari,
} from '/tmp/analitik.mjs'

let lulus = 0
let gagal = 0
const catat = []
function cek(nama, syarat, keterangan = '') {
  if (syarat) lulus++
  else {
    gagal++
    catat.push(`GAGAL: ${nama}${keterangan ? ' — ' + keterangan : ''}`)
  }
}
const grup = (n) => console.log(`\n${n}`)
const dekat = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol

/* ---------------------------- Pembantu ----------------------------------- */
const titik = (x, y) => ({ x, y, facing: 'front' })
const anggota = (id, nama = id, seksi = 'battery') => ({
  id,
  name: nama,
  section: seksi,
  role: 'member',
})
const set = (name, counts, points, ekstra = {}) => ({
  id: name,
  drillId: 'd1',
  order: 0,
  name,
  counts,
  points,
  createdAt: 0,
  ...ekstra,
})

/* ========================================================================== */
/*  1. ambangEfektif                                                          */
/* ========================================================================== */
grup('1. ambangEfektif')
{
  const a = ambangEfektif()
  cek('kosong → ambang bawaan kecepatan', dekat(a.perMenit.padat, AMBANG.padat) && dekat(a.perMenit.mustahil, AMBANG.mustahil))
  cek('kosong → ambang bawaan ukuran langkah', dekat(a.inci.padat, AMBANG_LANGKAH.padat) && dekat(a.inci.mustahil, AMBANG_LANGKAH.mustahil))
  cek('hasil lengkap, tidak ada undefined', a.perMenit && a.inci && a.perMenit.berat !== undefined && a.inci.berat !== undefined)

  const b = ambangEfektif({ perMenit: { padat: 100, berat: 130, mustahil: 160 } })
  cek('kecepatan diganti, ukuran langkah tetap bawaan', b.perMenit.padat === 100 && dekat(b.inci.padat, 22.5))

  const c = ambangEfektif({ inci: { padat: 20, berat: 26, mustahil: 34 } })
  cek('ukuran langkah diganti, kecepatan tetap bawaan', c.inci.mustahil === 34 && dekat(c.perMenit.mustahil, 180))

  // Tidak boleh mengubah objek aslinya — kalau iya, bawaan ikut berubah.
  const bawaan = { padat: 22.5, berat: 30, mustahil: 45 }
  ambangEfektif({ inci: { padat: 1, berat: 2, mustahil: 3 } })
  cek('bawaan tidak berubah setelah dipakai', AMBANG_LANGKAH.padat === 22.5 && AMBANG_LANGKAH.mustahil === 45)
}

/* ========================================================================== */
/*  2. tingkat dengan ambang ubahan                                           */
/* ========================================================================== */
grup('2. tingkat memakai ambang tim')
{
  const standar = { padat: 120, berat: 150, mustahil: 180 }
  cek('140 dgn ambang bawaan → padat', tingkatDari(140) === 'padat')
  cek('140 dgn ambang longgar → nyaman', tingkatDari(140, { padat: 200, berat: 250, mustahil: 300 }) === 'nyaman')
  cek('140 dgn ambang ketat → mustahil', tingkatDari(140, { padat: 90, berat: 110, mustahil: 130 }) === 'mustahil')
  cek('batas tepat: 180 → berat (bukan mustahil)', tingkatDari(180, standar) === 'berat')
  cek('batas tepat: 180.01 → mustahil', tingkatDari(180.01, standar) === 'mustahil')

  cek('26 inci dgn bawaan → padat', tingkatLangkahDari(26) === 'padat')
  cek('26 inci dgn ambang longgar → nyaman', tingkatLangkahDari(26, { padat: 30, berat: 40, mustahil: 60 }) === 'nyaman')
  cek('26 inci dgn ambang ketat → mustahil', tingkatLangkahDari(26, { padat: 15, berat: 20, mustahil: 25 }) === 'mustahil')
}

/* ========================================================================== */
/*  3. Ambang yang tidak urut                                                 */
/* ========================================================================== */
grup('3. ambang salah ketik (tidak urut) diurutkan')
{
  // Salah ketik: berat lebih kecil dari padat.
  const kacau = { padat: 180, berat: 120, mustahil: 150 }
  cek('100 → nyaman (padat terkecil = 120)', tingkatDari(100, kacau) === 'nyaman')
  cek('130 → padat', tingkatDari(130, kacau) === 'padat')
  cek('160 → berat', tingkatDari(160, kacau) === 'berat')
  cek('200 → mustahil', tingkatDari(200, kacau) === 'mustahil')
  // Angka NaN tidak boleh membuat semuanya mustahil.
  const nan = { padat: NaN, berat: 150, mustahil: 180 }
  cek('NaN diabaikan, bukan jadi mustahil', tingkatDari(100, nan) === 'nyaman')
}

/* ========================================================================== */
/*  4. lebihBerat                                                             */
/* ========================================================================== */
grup('4. lebihBerat')
{
  cek('nyaman vs mustahil → mustahil', lebihBerat('nyaman', 'mustahil') === 'mustahil')
  cek('mustahil vs nyaman → mustahil', lebihBerat('mustahil', 'nyaman') === 'mustahil')
  cek('berat vs padat → berat', lebihBerat('berat', 'padat') === 'berat')
  cek('sama → sama', lebihBerat('padat', 'padat') === 'padat')
  cek('nyaman vs nyaman → nyaman', lebihBerat('nyaman', 'nyaman') === 'nyaman')
}

/* ========================================================================== */
/*  5. REPRODUKSI KELUHAN: kecepatan aman, ukuran langkah mustahil            */
/* ========================================================================== */
grup('5. keluhan yang dilaporkan: analitik "nyaman" tapi buku saku "mustahil"')
{
  /**
   * Pemain menempuh 8 yard dalam 4 hitungan, mode `menyesuaikan`,
   * 1 langkah per hitungan, tempo 120 BPM, 1 ketuk per hitungan.
   *
   * - Kecepatan: 1 langkah/hitungan × 120 = 120 langkah/menit → "nyaman"
   * - Ukuran langkah: 8 yard ÷ 4 langkah = 2 yard = 72 inci → "mustahil"
   */
  const dari = set('A', 4, { m1: titik(0, 0) }, {
    langkah: { m1: { mode: 'menyesuaikan', langkahPerCount: 1 } },
  })
  const ke = set('B', 4, { m1: titik(8, 0) })
  const h = analisisPerpindahan(dari, ke, [anggota('m1')], 0.625, 120, 1)

  cek('ada hasil', h.daftar.length === 1)
  const m = h.daftar[0]
  cek('kecepatan = 120 langkah/menit', dekat(m.langkahPerMenit, 120, 0.01), `${m.langkahPerMenit}`)
  cek('kecepatan → nyaman (itulah yang dulu dilihat analitik)', m.tingkat === 'nyaman', m.tingkat)
  cek('ukuran langkah = 72 inci', dekat(m.ukuranLangkahInci, 72, 0.01), `${m.ukuranLangkahInci}`)
  cek('ukuran langkah → mustahil (itulah yang dicetak buku saku)', m.tingkatLangkah === 'mustahil', m.tingkatLangkah)
  cek('tingkat akhir = mustahil', m.tingkatAkhir === 'mustahil', m.tingkatAkhir)
  // Inilah inti perbaikannya: dulu pemain ini TIDAK masuk peringatan.
  cek('PEMAIN INI MASUK PERINGATAN', h.peringatan.length === 1, `${h.peringatan.length}`)
  cek('ukuran langkah terbesar tercatat', dekat(h.langkahTerbesarInci, 72, 0.01), `${h.langkahTerbesarInci}`)
}

/* ========================================================================== */
/*  6. Sebaliknya: gerakan pelan dengan langkah wajar tetap aman              */
/* ========================================================================== */
grup('6. gerakan wajar tidak boleh jadi peringatan')
{
  // 2 yard dalam 8 hitungan, mode tetap (8-to-5 = 22,5 inci).
  const dari = set('A', 8, { m1: titik(0, 0) })
  const ke = set('B', 8, { m1: titik(2, 0) })
  const h = analisisPerpindahan(dari, ke, [anggota('m1')], 0.625, 120, 1)
  const m = h.daftar[0]
  cek('ukuran langkah = 22,5 inci', dekat(m.ukuranLangkahInci, 22.5, 0.01), `${m.ukuranLangkahInci}`)
  cek('ukuran langkah → nyaman', m.tingkatLangkah === 'nyaman', m.tingkatLangkah)
  cek('kecepatan → nyaman', m.tingkat === 'nyaman', m.tingkat)
  cek('tidak masuk peringatan', h.peringatan.length === 0, `${h.peringatan.length}`)
}

/* ========================================================================== */
/*  7. Peringatan dari kecepatan saja (perilaku lama tetap bekerja)           */
/* ========================================================================== */
grup('7. peringatan kecepatan tetap berfungsi seperti dulu')
{
  // Mode tetap: langkah 22,5 inci, tapi jarak jauh dalam waktu singkat.
  const dari = set('A', 2, { m1: titik(0, 0) })
  const ke = set('B', 2, { m1: titik(20, 0) })
  const h = analisisPerpindahan(dari, ke, [anggota('m1')], 0.625, 120, 1)
  const m = h.daftar[0]
  cek('ukuran langkah tetap 22,5 inci (mode tetap)', dekat(m.ukuranLangkahInci, 22.5, 0.01), `${m.ukuranLangkahInci}`)
  cek('kecepatan tinggi', m.langkahPerMenit > 180, `${m.langkahPerMenit}`)
  cek('kecepatan → mustahil', m.tingkat === 'mustahil', m.tingkat)
  cek('masuk peringatan', h.peringatan.length === 1)
  cek('tingkat akhir mustahil', m.tingkatAkhir === 'mustahil')
}

/* ========================================================================== */
/*  8. Ambang ubahan mengubah hasil analisis                                  */
/* ========================================================================== */
grup('8. ambang tim benar-benar mengubah analisis')
{
  const dari = set('A', 4, { m1: titik(0, 0) }, {
    langkah: { m1: { mode: 'menyesuaikan', langkahPerCount: 1 } },
  })
  const ke = set('B', 4, { m1: titik(8, 0) }) // 72 inci

  const ketat = analisisPerpindahan(dari, ke, [anggota('m1')], 0.625, 120, 1, undefined, undefined, {
    inci: { padat: 15, berat: 20, mustahil: 25 },
  })
  // Langkahnya 72 inci, jadi ambang "longgar" harus betul-betul di atas itu
  // supaya hasilnya nyaman — kalau cuma 60 ia tetap kena "padat".
  const longgar = analisisPerpindahan(dari, ke, [anggota('m1')], 0.625, 120, 1, undefined, undefined, {
    inci: { padat: 80, berat: 100, mustahil: 130 },
  })
  cek('ambang ketat → tetap mustahil', ketat.daftar[0].tingkatLangkah === 'mustahil')
  cek('ambang longgar → jadi nyaman', longgar.daftar[0].tingkatLangkah === 'nyaman', longgar.daftar[0].tingkatLangkah)
  cek('ambang longgar → tidak ada peringatan', longgar.peringatan.length === 0, `${longgar.peringatan.length}`)
  cek('ambang ketat → ada peringatan', ketat.peringatan.length === 1)
}

/* ========================================================================== */
/*  9. Ringkasan section ikut menilai ukuran langkah                          */
/* ========================================================================== */
grup('9. ringkasan section')
{
  // Dua pemain satu section: satu aman, satu bermasalah di ukuran langkah.
  const dari = set('A', 4, { m1: titik(0, 0), m2: titik(0, 5) }, {
    langkah: {
      m1: { mode: 'menyesuaikan', langkahPerCount: 1 },
      m2: { mode: 'menyesuaikan', langkahPerCount: 1 },
    },
  })
  const ke = set('B', 4, { m1: titik(1, 0), m2: titik(8, 5) }) // m1 = 9 inci, m2 = 72 inci
  const h = analisisPerpindahan(dari, ke, [anggota('m1'), anggota('m2')], 0.625, 120, 1)
  cek('satu section', h.seksi.length === 1, `${h.seksi.length}`)
  const sc = h.seksi[0]
  cek('ukuran langkah terbesar = 72 inci (bukan rata-rata)', dekat(sc.langkahTerbesarInci, 72, 0.01), `${sc.langkahTerbesarInci}`)
  cek('tingkat akhir section = mustahil', sc.tingkatAkhir === 'mustahil', sc.tingkatAkhir)
  cek('tingkat kecepatan section tetap nyaman', sc.tingkat === 'nyaman', sc.tingkat)
}

/* ========================================================================== */
/*  10. setTerberat memilih yang paling bermasalah                            */
/* ========================================================================== */
grup('10. setTerberat')
{
  // Set 1: cepat sekali (kecepatan mustahil) tapi langkah wajar.
  const s1 = set('Cepat', 2, { m1: titik(0, 0) })
  const s1b = set('CepatB', 2, { m1: titik(20, 0) })
  // Set 2: pelan, tapi langkah raksasa — dulu TIDAK pernah terdeteksi.
  const s2 = set('Raksasa', 4, { m1: titik(0, 0) }, {
    langkah: { m1: { mode: 'menyesuaikan', langkahPerCount: 1 } },
  })
  const s2b = set('RaksasaB', 4, { m1: titik(8, 0) })

  const hanya = [anggota('m1')]
  const a = analisisPerpindahan(s1, s1b, hanya, 0.625, 120, 1)
  const b = analisisPerpindahan(s2, s2b, hanya, 0.625, 120, 1)
  cek('set cepat: kecepatan mustahil', a.daftar[0].tingkat === 'mustahil', a.daftar[0].tingkat)
  cek('set raksasa: kecepatan nyaman', b.daftar[0].tingkat === 'nyaman', b.daftar[0].tingkat)
  cek('set raksasa: langkah mustahil', b.daftar[0].tingkatLangkah === 'mustahil')

  const t = setTerberat([s1, s1b, s2, s2b], hanya, 0.625, 120, 1)
  cek('setTerberat tidak null', t !== null)
  cek('setTerberat tingkat = mustahil', t && t.tingkat === 'mustahil', t && t.tingkat)
  cek('setTerberat mencatat ukuran langkah terbesar', t && t.langkahTerbesarInci > 0, t && `${t.langkahTerbesarInci}`)
}

/* ========================================================================== */
/*  11. Kompatibilitas mundur: tanpa argumen ambang                           */
/* ========================================================================== */
grup('11. kompatibilitas mundur')
{
  const dari = set('A', 8, { m1: titik(0, 0) })
  const ke = set('B', 8, { m1: titik(2, 0) })
  // Dipanggil tanpa dua argumen terakhir sama sekali.
  const h = analisisPerpindahan(dari, ke, [anggota('m1')], 0.625, 120, 1)
  cek('tetap menghasilkan tingkat', typeof h.daftar[0].tingkat === 'string')
  cek('tingkatAkhir selalu terisi', typeof h.daftar[0].tingkatAkhir === 'string')
  cek('langkahTerbesarInci terisi', h.langkahTerbesarInci > 0)
  // setTerberat tanpa ambang baru.
  const t = setTerberat([dari, ke], [anggota('m1')], 0.625, 120, 1)
  cek('setTerberat tanpa ambang baru bekerja', t !== null)
}

console.log(`\n${lulus} lulus, ${gagal} gagal`)
if (catat.length) console.log(catat.join('\n'))
process.exit(gagal ? 1 : 0)
