/**
 * Uji murni J1 — ambang predikat laporan (src/lib/laporan.ts).
 *
 * Yang dijaga:
 * - tanpa pengaturan, predikatnya PERSIS seperti sebelum J1 (85/70);
 * - ambang dari pengaturan dipakai di kartu kehadiran DAN CSV ringkas —
 *   dua tempat yang dulu masing-masing menulis angka 85/70 sendiri;
 * - salah ketik dirapikan (jepit 0–100, bulatkan, tukar urutan terbalik,
 *   bukan-angka → bawaan) supaya predikat "Cukup" tidak pernah mustahil;
 * - keterangan ambang ikut tercetak di kartu, dan batasnya tepat (≥).
 *
 * Pakai: bash qa/bangun-logika.sh && node qa/uji-predikat.mjs
 */
import {
  PREDIKAT_BAKU,
  csvRingkas,
  htmlKartu,
  predikatKehadiran,
  rapikanPredikat,
  teksAmbangPredikat,
} from '/tmp/laporan.mjs'

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
const sama = (a, b) => JSON.stringify(a) === JSON.stringify(b)

/* ------------------------------ Bawaan ------------------------------ */
uji('bawaan 85/70 (sama dengan D4)', sama(PREDIKAT_BAKU, { baik: 85, cukup: 70 }))
{
  // Perilaku lama, ditulis ulang di sini sebagai acuan: 0–100 semua sama.
  const lama = (t, r) => (t === 0 ? 'Belum ada catatan' : r >= 85 ? 'Baik' : r >= 70 ? 'Cukup' : 'Perlu perhatian')
  let beda = []
  for (let r = 0; r <= 100; r++) {
    if (predikatKehadiran({ terisi: 5, rate: r }) !== lama(5, r)) beda.push(r)
    if (predikatKehadiran({ terisi: 5, rate: r }, undefined) !== lama(5, r)) beda.push('u' + r)
    if (predikatKehadiran({ terisi: 5, rate: r }, null) !== lama(5, r)) beda.push('n' + r)
  }
  uji('tanpa pengaturan: 0–100% identik dengan perilaku lama', beda.length === 0, beda.join(','))
}
uji('terisi 0 → "Belum ada catatan" (bukan Perlu perhatian)', predikatKehadiran({ terisi: 0, rate: 0 }, { baik: 90, cukup: 80 }) === 'Belum ada catatan')

/* ---------------------------- Ambang tim ---------------------------- */
{
  const a = { baik: 90, cukup: 75 }
  uji('90% → Baik (batas inklusif)', predikatKehadiran({ terisi: 10, rate: 90 }, a) === 'Baik')
  uji('89% → Cukup', predikatKehadiran({ terisi: 10, rate: 89 }, a) === 'Cukup')
  uji('75% → Cukup (batas inklusif)', predikatKehadiran({ terisi: 10, rate: 75 }, a) === 'Cukup')
  uji('74% → Perlu perhatian', predikatKehadiran({ terisi: 10, rate: 74 }, a) === 'Perlu perhatian')
  uji('85% (Baik lama) kini Cukup', predikatKehadiran({ terisi: 10, rate: 85 }, a) === 'Cukup')
}

/* ------------------------------ Rapikan ------------------------------ */
uji('kosong → bawaan', sama(rapikanPredikat(), PREDIKAT_BAKU))
uji('sebagian → sisanya bawaan', sama(rapikanPredikat({ baik: 95 }), { baik: 95, cukup: 70 }))
uji('terbalik ditukar (70/90 → 90/70)', sama(rapikanPredikat({ baik: 70, cukup: 90 }), { baik: 90, cukup: 70 }))
uji('di atas 100 dijepit', sama(rapikanPredikat({ baik: 150, cukup: 70 }), { baik: 100, cukup: 70 }))
uji('negatif dijepit ke 0', sama(rapikanPredikat({ baik: 80, cukup: -5 }), { baik: 80, cukup: 0 }))
uji('pecahan dibulatkan', sama(rapikanPredikat({ baik: 84.6, cukup: 69.4 }), { baik: 85, cukup: 69 }))
uji('NaN → bawaan', sama(rapikanPredikat({ baik: NaN, cukup: 60 }), { baik: 85, cukup: 60 }))
uji('teks → bawaan (bukan Number("") = 0)', sama(rapikanPredikat({ baik: '', cukup: '50' }), { baik: 85, cukup: 70 }))
uji('sama besar boleh (tanpa pita Cukup)', sama(rapikanPredikat({ baik: 80, cukup: 80 }), { baik: 80, cukup: 80 }))
uji('terbalik → predikat Cukup tetap bisa diraih',
  predikatKehadiran({ terisi: 4, rate: 80 }, { baik: 70, cukup: 90 }) === 'Cukup')
uji('sama besar: 80 → Baik, 79 → Perlu perhatian',
  predikatKehadiran({ terisi: 4, rate: 80 }, { baik: 80, cukup: 80 }) === 'Baik' &&
  predikatKehadiran({ terisi: 4, rate: 79 }, { baik: 80, cukup: 80 }) === 'Perlu perhatian')

/* --------------------------- Teks ambang --------------------------- */
uji('teks bawaan', teksAmbangPredikat() === 'Baik ≥ 85% · Cukup 70–84% · Perlu perhatian < 70%', teksAmbangPredikat())
uji('teks tim', teksAmbangPredikat({ baik: 90, cukup: 75 }) === 'Baik ≥ 90% · Cukup 75–89% · Perlu perhatian < 75%')
uji('teks pita satu angka', teksAmbangPredikat({ baik: 80, cukup: 79 }) === 'Baik ≥ 80% · Cukup 79% · Perlu perhatian < 79%',
  teksAmbangPredikat({ baik: 80, cukup: 79 }))
uji('teks tanpa pita Cukup', teksAmbangPredikat({ baik: 80, cukup: 80 }) === 'Baik ≥ 80% · Perlu perhatian < 80%')
uji('teks Cukup 0 → tanpa "Perlu perhatian < 0%"', teksAmbangPredikat({ baik: 50, cukup: 0 }) === 'Baik ≥ 50% · Cukup 0–49%',
  teksAmbangPredikat({ baik: 50, cukup: 0 }))
uji('teks terbalik ikut dirapikan', teksAmbangPredikat({ baik: 70, cukup: 90 }) === 'Baik ≥ 90% · Cukup 70–89% · Perlu perhatian < 70%')

/* ---------------------- Kartu & CSV memakai ambang ---------------------- */
{
  const anggota = (id, nama) => ({ id, name: nama, code: id.toUpperCase(), section: 'brass', instrument: 'Trumpet', role: 'pemain', active: true, joinYear: 2025, token: 't' + id })
  const sesi = Array.from({ length: 20 }, (_, i) => ({ id: 's' + i, title: 'Latihan ' + i, type: 'latihan', date: `2026-09-${String(i + 1).padStart(2, '0')}`, checklist: [], createdAt: 0 }))
  // a: 17/20 = 85% · b: 16/20 = 80% · c: 13/20 = 65%
  const hadir = { a: 17, b: 16, c: 13 }
  const catatan = []
  for (const [m, n] of Object.entries(hadir)) {
    sesi.forEach((s, i) => catatan.push({ id: `${m}-${s.id}`, sessionId: s.id, memberId: m, status: i < n ? 'hadir' : 'alpha', at: 0 }))
  }
  const data = (predikat) => ({
    namaTim: 'Tim Uji', periode: 'September 2026', kunci: '2026-09',
    anggota: [anggota('a', 'Andi'), anggota('b', 'Budi'), anggota('c', 'Citra')],
    sesi, catatan, batas: 60, predikat,
  })
  const kolomPredikat = (csv) => {
    const baris = csv.replace(/^\uFEFF/, '').trim().split(/\r?\n/).map((l) => l.split(/[;,]/))
    const i = baris[0].findIndex((h) => h.replace(/"/g, '') === 'Predikat')
    return Object.fromEntries(baris.slice(1).map((r) => [r[1].replace(/"/g, ''), r[i]?.replace(/"/g, '')]))
  }
  const pLama = kolomPredikat(csvRingkas(data(undefined)))
  uji('CSV bawaan: Andi 85% Baik · Budi 80% Cukup · Citra 65% Perlu perhatian',
    pLama.Andi === 'Baik' && pLama.Budi === 'Cukup' && pLama.Citra === 'Perlu perhatian', JSON.stringify(pLama))
  const pTim = kolomPredikat(csvRingkas(data({ baik: 80, cukup: 60 })))
  uji('CSV ambang 80/60: Andi Baik · Budi Baik · Citra Cukup',
    pTim.Andi === 'Baik' && pTim.Budi === 'Baik' && pTim.Citra === 'Cukup', JSON.stringify(pTim))

  const kartu = htmlKartu(data({ baik: 80, cukup: 60 }), 'c')
  uji('kartu Citra (65%) memakai ambang tim → Cukup', /<td>Cukup<\/td>/.test(kartu))
  uji('kartu mencetak keterangan ambang tim', kartu.includes('Predikat: Baik ≥ 80% · Cukup 60–79% · Perlu perhatian &lt; 60%') ||
    kartu.includes('Predikat: Baik ≥ 80% · Cukup 60–79% · Perlu perhatian < 60%'))
  const kartuLama = htmlKartu(data(undefined), 'c')
  uji('kartu tanpa pengaturan → Perlu perhatian & keterangan bawaan',
    /<td>Perlu perhatian<\/td>/.test(kartuLama) && kartuLama.includes('Baik ≥ 85%'))
  uji('kartu semua anggota: satu keterangan per kartu', (htmlKartu(data(undefined)).match(/class="kecil ambang-predikat"/g) ?? []).length === 3)
}

console.log(`\n${lulus} lulus, ${gagal} gagal`)
process.exit(gagal ? 1 : 0)
