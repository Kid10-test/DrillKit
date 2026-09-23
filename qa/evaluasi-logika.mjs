/**
 * Uji logika murni evaluasi anggota (H2).
 *
 * Dua aturan yang paling dikuji, karena keduanya mudah salah dan salahnya
 * menghasilkan angka yang tampak pasti padahal menipu:
 *
 * 1. **"Belum dinilai" bukan "nilai terendah."** `rataRata` harus
 *    mengembalikan `null`, bukan 0.
 * 2. **Tren hanya pada aspek yang dinilai di KEDUA evaluasi.** Kalau tidak,
 *    anggota bisa tampak "naik" hanya karena aspek tersulitnya tidak dinilai
 *    kali ini.
 */
import {
  MAX_NILAI,
  aspekTren,
  formatNilai,
  formatTren,
  nilaiSah,
  perluPerhatian,
  rataRata,
  rataTim,
  ringkasan,
  sebelumnya,
  terbaru,
  tren,
  urutEvaluasi,
} from '/tmp/evaluasi.mjs'

let lulus = 0
const gagal = []
const cek = (nama, syarat, keterangan = '') => {
  if (syarat) lulus += 1
  else gagal.push(`${nama}${keterangan ? ' — ' + keterangan : ''}`)
}

const ev = (id, memberId, tanggal, nilai, ekstra = {}) => ({
  id, memberId, tanggal, nilai, createdAt: 1, ...ekstra,
})

// --------------------------------------------------------------- nilaiSah
cek('nilai 1 sah', nilaiSah(1))
cek('nilai 5 sah', nilaiSah(5))
cek('nilai 0 tidak sah', !nilaiSah(0))
cek('nilai 6 tidak sah', !nilaiSah(6))
cek('nilai negatif tidak sah', !nilaiSah(-2))
cek('teks tidak sah', !nilaiSah('4'))
cek('undefined tidak sah', !nilaiSah(undefined))
cek('NaN tidak sah', !nilaiSah(NaN))
cek('rentang batas', MAX_NILAI === 5)

// --------------------------------------------------------------- rataRata
cek('tanpa aspek → null, BUKAN 0', rataRata(ev('e0', 'm1', '2026-01-01', {})) === null,
  String(rataRata(ev('e0', 'm1', '2026-01-01', {}))))
cek('evaluasi kosong → null', rataRata(null) === null)
cek('satu aspek', rataRata(ev('e1', 'm1', '2026-01-01', { teknik: 4 })) === 4)
cek('dua aspek dirata-rata', rataRata(ev('e2', 'm1', '2026-01-01', { teknik: 4, kerjasama: 3 })) === 3.5)
cek('empat aspek', rataRata(ev('e3', 'm1', '2026-01-01', { teknik: 5, musikalitas: 4, kedisiplinan: 3, kerjasama: 2 })) === 3.5)
cek('aspek di luar rentang diabaikan',
  rataRata(ev('e4', 'm1', '2026-01-01', { teknik: 4, musikalitas: 99 })) === 4,
  String(rataRata(ev('e4', 'm1', '2026-01-01', { teknik: 4, musikalitas: 99 }))))

// -------------------------------------------------- urut / terbaru / sebelumnya
{
  const daftar = [
    ev('a', 'm1', '2026-01-10', { teknik: 3 }),
    ev('b', 'm1', '2026-03-01', { teknik: 5 }),
    ev('c', 'm1', '2026-02-01', { teknik: 4 }),
  ]
  const u = urutEvaluasi(daftar)
  cek('diurutkan terbaru lebih dulu', u[0].id === 'b' && u[1].id === 'c' && u[2].id === 'a')
  cek('terbaru benar', terbaru(daftar)?.id === 'b')
  cek('sebelumnya benar', sebelumnya(daftar)?.id === 'c')
  cek('daftar kosong → terbaru null', terbaru([]) === null)
  cek('satu evaluasi → sebelumnya null',
    sebelumnya([ev('z', 'm1', '2026-01-01', { teknik: 3 })]) === null)
  // Tanggal sama → yang lebih baru menurut createdAt yang menang.
  const kembar = [
    ev('lama', 'm1', '2026-01-01', { teknik: 3 }, { createdAt: 10 }),
    ev('baru', 'm1', '2026-01-01', { teknik: 4 }, { createdAt: 20 }),
  ]
  cek('tanggal sama → createdAt menentukan', terbaru(kembar)?.id === 'baru')
}

// ------------------------------------------------------------------- tren
{
  const naik = [
    ev('a', 'm1', '2026-01-01', { teknik: 3, kerjasama: 3 }),
    ev('b', 'm1', '2026-02-01', { teknik: 4, kerjasama: 4 }),
  ]
  cek('naik 1.0', Math.round((tren(naik) ?? 0) * 100) / 100 === 1, String(tren(naik)))

  const turun = [
    ev('a', 'm1', '2026-01-01', { teknik: 5 }),
    ev('b', 'm1', '2026-02-01', { teknik: 3 }),
  ]
  cek('turun 2.0', Math.round((tren(turun) ?? 0) * 100) / 100 === -2, String(tren(turun)))

  cek('satu evaluasi → tren null', tren([ev('a', 'm1', '2026-01-01', { teknik: 3 })]) === null)
  cek('tanpa evaluasi → tren null', tren([]) === null)

  // INTI: himpunan aspek tidak bersinggungan → tidak bisa dibandingkan.
  const takBersinggungan = [
    ev('a', 'm1', '2026-01-01', { teknik: 2 }),
    ev('b', 'm1', '2026-02-01', { kerjasama: 5 }),
  ]
  cek('aspek tak bersinggungan → tren null, bukan mengarang',
    tren(takBersinggungan) === null, String(tren(takBersinggungan)))

  // Hanya aspek yang sama yang dibandingkan.
  const sebagian = [
    ev('a', 'm1', '2026-01-01', { teknik: 2, musikalitas: 5 }),
    ev('b', 'm1', '2026-02-01', { teknik: 4 }),
  ]
  // Yang dibandingkan cuma teknik: 4 − 2 = 2 (bukan rata-rata 4 − 3.5).
  cek('hanya aspek bersama yang dihitung', Math.round((tren(sebagian) ?? 0) * 100) / 100 === 2,
    String(tren(sebagian)))
  cek('aspek tren dilaporkan', aspekTren(sebagian).join(',') === 'teknik', aspekTren(sebagian).join(','))

  // Kasus yang berbahaya: tampak naik padahal aspek sulitnya tak dinilai.
  const menipu = [
    ev('a', 'm1', '2026-01-01', { teknik: 5, musikalitas: 2 }),
    ev('b', 'm1', '2026-02-01', { musikalitas: 4 }),
  ]
  // Rata-rata kasar: 3.5 → 4 = "naik 0.5". Yang benar: cuma musikalitas
  // yang bisa dibandingkan → 4 − 2 = naik 2.
  const tMenipu = tren(menipu)
  cek('tren tidak memakai himpunan aspek yang berbeda',
    Math.round((tMenipu ?? 0) * 100) / 100 === 2, String(tMenipu))
}

// --------------------------------------------------------------- ringkasan
{
  const daftar = [
    ev('a', 'm1', '2026-01-01', { teknik: 3, kerjasama: 3 }),
    ev('b', 'm1', '2026-02-01', { teknik: 5, musikalitas: 4 }),
  ]
  const r = ringkasan(daftar)
  cek('jumlah evaluasi', r.jumlah === 2)
  cek('rata terbaru', r.rata === 4.5, String(r.rata))
  cek('perAspek teknik terbaru', r.perAspek.teknik === 5)
  cek('perAspek kerjasama null karena tidak dinilai ulang', r.perAspek.kerjasama === null,
    String(r.perAspek.kerjasama))
  cek('perAspek musikalitas terbaru', r.perAspek.musikalitas === 4)

  cek('ringkasan kosong → rata null', ringkasan([]).rata === null)
  cek('ringkasan kosong → perAspek semua null',
    Object.values(ringkasan([]).perAspek).every((v) => v === null))
}

// ----------------------------------------------------------------- rataTim
{
  const daftar = [
    ev('a', 'm1', '2026-01-01', { teknik: 3 }),
    ev('b', 'm1', '2026-02-01', { teknik: 5 }), // m1 terbaru: 5
    ev('c', 'm2', '2026-02-01', { teknik: 3 }), // m2 terbaru: 3
  ]
  // Hanya evaluasi TERBARU tiap anggota yang dihitung: (5 + 3) / 2 = 4.
  cek('rata tim dari evaluasi terbaru tiap anggota', rataTim(daftar) === 4, String(rataTim(daftar)))
  cek('rata tim tanpa data → null', rataTim([]) === null)

  // Anggota yang evaluasi terbarunya kosong tidak ikut merusak hitungan.
  const adaKosong = [
    ev('a', 'm1', '2026-01-01', { teknik: 4 }),
    ev('b', 'm2', '2026-02-01', {}),
  ]
  cek('anggota tanpa aspek tidak ikut hitungan', rataTim(adaKosong) === 4, String(rataTim(adaKosong)))
}

// ---------------------------------------------------------- perluPerhatian
{
  const daftar = [
    ev('a', 'm1', '2026-02-01', { teknik: 2, kerjasama: 2 }),   // rata 2 → masuk
    ev('b', 'm2', '2026-02-01', { teknik: 4, kerjasama: 4 }),   // rata 4 → aman
    ev('c', 'm3', '2026-02-01', {}),                            // belum dinilai
  ]
  const p = perluPerhatian(daftar, 3)
  cek('yang rendah masuk', p.length === 1 && p[0].memberId === 'm1', JSON.stringify(p.map((x) => x.memberId)))
  cek('yang belum dinilai TIDAK masuk (bukan nilai terendah)',
    !p.some((x) => x.memberId === 'm3'), JSON.stringify(p.map((x) => x.memberId)))
  cek('diurutkan dari yang terendah',
    perluPerhatian([
      ev('a', 'x', '2026-02-01', { teknik: 2 }),
      ev('b', 'y', '2026-02-01', { teknik: 1 }),
    ], 5)[0].memberId === 'y')
  cek('ambang tepat di batas tidak masuk',
    perluPerhatian([ev('a', 'z', '2026-02-01', { teknik: 3 })], 3).length === 0)
}

// ----------------------------------------------------------------- format
cek('format nilai 4.25 → "4.3"', formatNilai(4.25) === '4.3', formatNilai(4.25))
cek('format nilai 4 → "4.0"', formatNilai(4) === '4.0', formatNilai(4))
cek('format nilai null → "—"', formatNilai(null) === '—')
cek('format nilai undefined → "—"', formatNilai(undefined) === '—')
cek('format tren naik', formatTren(0.5) === 'naik 0.5', formatTren(0.5))
cek('format tren turun', formatTren(-0.35) === 'turun 0.4', formatTren(-0.35))
cek('format tren tetap', formatTren(0.02) === 'tetap', formatTren(0.02))
cek('format tren null → "—"', formatTren(null) === '—')

console.log(`\n${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) {
  console.log('GAGAL:\n - ' + gagal.join('\n - '))
  process.exit(1)
}
