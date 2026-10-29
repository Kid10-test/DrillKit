/**
 * #14 (Uji Logika Node) — Matriks Setoran Hafalan (*Music & Visual Pass-Off Tracker*).
 *
 * Menguji modul murni hasil rakitan `qa/bangun-logika.sh`:
 *   - `/tmp/setoran.mjs` (jenjang 6 tahap, batas kelulusan per seksi, generator segmen lagu,
 *     ringkasan kesiapan tim/seksi/target/anggota, resolusi konflik, & HTML cetak A4 murni hex)
 *   - `/tmp/bagikan.mjs` + `/tmp/terbit.mjs` + `/tmp/kunci.mjs` (privasi paket grup vs pribadi
 *     per anggota + enkripsi kunci pribadi AES-256-GCM #2 + `gabungPembaruan`)
 *   - `/tmp/pindah.mjs` + `/tmp/namaAnggota.mjs` + `/tmp/bukaBerkas.mjs` (rujukan longgar
 *     Pusat Data, penggabungan anggota ganda dengan id deterministik, & pratinjau backup/paket)
 */
import {
  URUTAN_JENJANG_SETORAN,
  apakahLulusSetoran,
  bangunHtmlCetakMatriksSetoran,
  buatSaranTargetDariLagu,
  gabungCatatanSetoran,
  hitungRingkasanSetoranTim,
  idCatatanSetoran,
  jenjangBerikutnya,
  skorJenjangSetoran,
  targetBerlakuUntukAnggota,
} from '/tmp/setoran.mjs'
import { paketAnggota, paketGrup } from '/tmp/bagikan.mjs'
import {
  bukaDataPribadi,
  gabungPembaruan,
  muatBerkasTerbit,
  siapTerbitLengkap,
} from '/tmp/terbit.mjs'
import { buatKunciBaru } from '/tmp/kunci.mjs'
import { putusRujukan } from '/tmp/pindah.mjs'
import { rencanakanGabung, tulisUlangSetoran } from '/tmp/namaAnggota.mjs'
import { ringkasBackup, ringkasPaket } from '/tmp/bukaBerkas.mjs'

let lulus = 0
let gagal = 0

function cek(nama, kondisi, detail = '') {
  if (kondisi) {
    lulus += 1
    console.log(`  ✓ ${nama}`)
  } else {
    gagal += 1
    console.error(`  ✗ ${nama}${detail ? ` — ${detail}` : ''}`)
  }
}

console.log('== #14 Uji Logika Matriks Setoran Hafalan ==')

/* -------------------- 1. Jenjang Bertahap & Skor ------------------------- */
{
  const jejak = []
  let kini = 'belum'
  for (let i = 0; i < 6; i += 1) {
    kini = jenjangBerikutnya(kini, 'lulus_gerak')
    jejak.push(kini)
  }
  cek(
    '1. Siklus ketuk-cepat menelusuri 6 jenjang lalu kembali ke "belum"',
    JSON.stringify(jejak) ===
      JSON.stringify([
        'baca_lancar',
        'tempo_latihan',
        'tempo_asli',
        'hafal_musik',
        'lulus_gerak',
        'belum',
      ]),
    JSON.stringify(jejak),
  )

  // Untuk seksi Pit statis dengan batasLulus = 'hafal_musik', ketuk setelah 'hafal_musik' kembali ke 'belum'
  cek(
    '2. Batas lulus kustom "hafal_musik" langsung dihitung 100% lulus & berputar bersih',
    apakahLulusSetoran('hafal_musik', 'hafal_musik') &&
      skorJenjangSetoran('hafal_musik', 'hafal_musik') === 1 &&
      jenjangBerikutnya('hafal_musik', 'hafal_musik') === 'belum',
  )

  cek(
    '3. Skor pecahan jenjang proporsional 0..1 terhadap batasLulus',
    skorJenjangSetoran('belum', 'lulus_gerak') === 0 &&
      Math.abs(skorJenjangSetoran('tempo_asli', 'lulus_gerak') - 0.6) < 1e-9 &&
      skorJenjangSetoran('lulus_gerak', 'lulus_gerak') === 1 &&
      URUTAN_JENJANG_SETORAN.length === 6,
  )
}

/* ----------- 2. Id Deterministik & Resolusi Konflik Setoran -------------- */
{
  cek(
    '4. idCatatanSetoran membentuk kunci deterministik "${targetId}__${memberId}"',
    idCatatanSetoran('ts_1', 'm_7') === 'ts_1__m_7',
  )

  const rendahBaru = {
    id: 'ts_1__m_1',
    targetId: 'ts_1',
    memberId: 'm_1',
    jenjang: 'baca_lancar',
    tanggal: '2026-10-30',
    diubahAt: 2000,
    penguji: 'Asisten A',
  }
  const tinggiLama = {
    id: 'ts_1__m_1',
    targetId: 'ts_1',
    memberId: 'm_1',
    jenjang: 'hafal_musik',
    tanggal: '2026-10-29',
    diubahAt: 1000,
    penguji: 'Pelatih Utama',
  }
  const pemenang = gabungCatatanSetoran(rendahBaru, tinggiLama)
  cek(
    '5. gabungCatatanSetoran memenangkan jenjang lebih tinggi walau diubah lebih dulu',
    pemenang.jenjang === 'hafal_musik' && pemenang.penguji === 'Pelatih Utama',
  )

  const seriBaru = { ...tinggiLama, diubahAt: 5000, catatan: 'Sudah rapi' }
  cek(
    '6. gabungCatatanSetoran memenangkan diubahAt terbaru bila jenjang seri',
    gabungCatatanSetoran(tinggiLama, seriBaru).catatan === 'Sudah rapi',
  )
}

/* ---------------- 3. Generator Target dari Segmen Lagu ------------------- */
{
  const laguSegmen = {
    id: 'song_1',
    title: 'Mars Nusantara',
    bpm: 132,
    beats: 4,
    panjangBirama: 40,
    tempoMap: [
      { id: 'tm1', label: 'Intro', measure: 1, bpm: 112, beats: 4 },
      { id: 'tm2', label: 'Tema A', measure: 9, bpm: 132, beats: 4 },
      { id: 'tm3', label: 'Coda', measure: 25, bpm: 144, beats: 4 },
    ],
    createdAt: 1,
  }
  const draf = buatSaranTargetDariLagu(laguSegmen)
  cek(
    '7. buatSaranTargetDariLagu memecah tempoMap menjadi rentang birama berurutan (1–8, 9–24, 25–40)',
    draf.length === 3 &&
      draf[0].biramaDari === 1 &&
      draf[0].biramaSampai === 8 &&
      draf[1].biramaDari === 9 &&
      draf[1].biramaSampai === 24 &&
      draf[2].biramaDari === 25 &&
      draf[2].biramaSampai === 40,
    JSON.stringify(draf),
  )

  const laguPolos = {
    id: 'song_2',
    title: 'Warm-up Bb',
    bpm: 100,
    beats: 4,
    panjangBirama: 36,
    tempoMap: [],
    createdAt: 1,
  }
  const drafPolos = buatSaranTargetDariLagu(laguPolos)
  cek(
    '8. Lagu tanpa tempoMap otomatis dibagi per blok 16 birama (1–16, 17–32, 33–36)',
    drafPolos.length === 3 &&
      drafPolos[0].biramaSampai === 16 &&
      drafPolos[1].biramaDari === 17 &&
      drafPolos[2].biramaDari === 33 &&
      drafPolos[2].biramaSampai === 36,
    JSON.stringify(drafPolos),
  )
}

/* ----------- 4. Ringkasan Kesiapan Tim, Seksi, & Cetak A4 Hex ------------ */
{
  const members = [
    { id: 'm1', code: 'B1', name: 'Andi', section: 'brass', instrument: 'Trumpet', role: 'member', joinYear: 2025, active: 1, token: 'tok1', phone: '0811', notes: 'rahasia1', createdAt: 1 },
    { id: 'm2', code: 'P1', name: 'Budi', section: 'percussion', instrument: 'Snare', role: 'sectionLeader', joinYear: 2024, active: 1, token: 'tok2', phone: '0822', notes: 'rahasia2', createdAt: 2 },
    { id: 'm3', code: 'B2', name: 'Cici Alumni', section: 'brass', instrument: 'Horn', role: 'member', joinYear: 2022, active: 0, token: 'tok3', createdAt: 3 },
  ]
  const targets = [
    {
      id: 't_semua',
      judul: 'Opener Bar 1–16',
      kategori: 'gabungan',
      songId: 'song_1',
      biramaDari: 1,
      biramaSampai: 16,
      tenggat: '2026-10-15',
      urutan: 1,
      createdAt: 1,
    },
    {
      id: 't_perc',
      judul: 'Cadence Battery',
      kategori: 'musik',
      sections: ['percussion'],
      tenggat: '2026-11-20',
      urutan: 2,
      createdAt: 2,
    },
  ]
  const catatan = [
    {
      id: 't_semua__m1',
      targetId: 't_semua',
      memberId: 'm1',
      jenjang: 'lulus_gerak',
      tanggal: '2026-10-12',
      diubahAt: 100,
      penguji: 'Pelatih',
    },
    {
      id: 't_semua__m2',
      targetId: 't_semua',
      memberId: 'm2',
      jenjang: 'tempo_latihan', // skor 2/5 = 0.4, belum lulus & tenggat 2026-10-15 < 2026-10-30!
      tanggal: '2026-10-20',
      diubahAt: 200,
      penguji: 'Ketua Perc',
      catatan: 'Jaga aksen birama 12',
    },
    {
      id: 't_perc__m2',
      targetId: 't_perc',
      memberId: 'm2',
      jenjang: 'lulus_gerak',
      tanggal: '2026-10-25',
      diubahAt: 300,
    },
  ]
  const sectionsTim = [
    { id: 'brass', label: 'Brass', dot: '#f59e0b' },
    { id: 'percussion', label: 'Percussion', dot: '#ef4444' },
  ]

  cek(
    '9. targetBerlakuUntukAnggota membatasi target khusus seksi dengan tepat',
    !targetBerlakuUntukAnggota(targets[1], members[0]) &&
      targetBerlakuUntukAnggota(targets[1], members[1]),
  )

  const r = hitungRingkasanSetoranTim(targets, catatan, members, sectionsTim, '2026-10-30')
  // Sel wajib: m1 punya 1 (lulus 1.0), m2 punya 2 (0.4 + 1.0 = 1.4); m3 nonaktif diabaikan!
  // Total wajib = 3, lulus = 2 (67%), skor = 2.4 / 3 = 80%, terlambat = 1 (t_semua__m2).
  cek(
    '10. hitungRingkasanSetoranTim menghitung wajib=3, lulus=2, persenSiap=80%, terlambat=1 & mengabaikan nonaktif',
    r.jumlahAnggotaAktif === 2 &&
      r.totalWajib === 3 &&
      r.totalLulus === 2 &&
      r.persenSiap === 80 &&
      r.persenLulus === 67 &&
      r.totalTerlambat === 1 &&
      r.perAnggota.m3 === undefined,
    JSON.stringify({
      wajib: r.totalWajib,
      lulus: r.totalLulus,
      siap: r.persenSiap,
      terlambat: r.totalTerlambat,
    }),
  )

  const brassStat = r.perSeksi.find((s) => s.sectionId === 'brass')
  const percStat = r.perSeksi.find((s) => s.sectionId === 'percussion')
  cek(
    '11. Statistik per seksi memisahkan Brass (100%) dan Percussion (70%) secara akurat',
    brassStat?.persenSiap === 100 && percStat?.persenSiap === 70,
    JSON.stringify(r.perSeksi),
  )

  const html = bangunHtmlCetakMatriksSetoran({
    namaTim: 'Gita Bahana',
    subjudulSeksi: 'Semua Seksi',
    tanggalCetak: '2026-10-30',
    targets,
    members,
    catatan,
    sectionsTim,
  })
  cek(
    '12. HTML cetak A4 memuat judul tim, nama anggota, capaian 80%, & 100% bebas oklch()/color-mix()',
    html.includes('Gita Bahana') &&
      html.includes('Andi') &&
      html.includes('80%') &&
      !/oklch\(|color-mix\(/i.test(html),
  )

  /* -------------- 5. Privasi Berbagi & Kunci Pribadi (#2) ---------------- */
  const bundleMentah = {
    format: 'drillkit-share',
    version: 1,
    exportedAt: 1730000000000,
    team: {
      teamName: 'Gita Bahana',
      coachName: 'Kak Budi',
      city: 'Yogyakarta',
      defaultField: null,
      sections: sectionsTim,
      memberMode: 1,
    },
    members,
    sessions: [],
    drills: [],
    sets: [],
    songs: [],
    targetSetoran: targets,
    setoran: catatan,
    attendance: [],
    memberNotes: [],
    mode: 'member',
  }

  const grup = paketGrup(bundleMentah)
  cek(
    '13. paketGrup menyertakan targetSetoran (kurikulum) namun mengosongkan setoran pribadi (0 bocoran)',
    grup.targetSetoran?.length === 2 &&
      Array.isArray(grup.setoran) &&
      grup.setoran.length === 0 &&
      grup.members.every((m) => !m.token && !m.phone && !m.notes),
  )

  const pAndi = paketAnggota(bundleMentah, 'm1')
  const pBudi = paketAnggota(bundleMentah, 'm2')
  const pAsing = paketAnggota(bundleMentah, 'orang_tak_dikenal')
  cek(
    '14. paketAnggota hanya menyertakan setoran milik penerima sendiri (Andi=1, Budi=2)',
    pAndi.setoran?.length === 1 &&
      pAndi.setoran[0].memberId === 'm1' &&
      pBudi.setoran?.length === 2 &&
      pBudi.setoran.every((s) => s.memberId === 'm2'),
  )
  cek(
    '15. paketAnggota dengan memberId tak dikenal menghasilkan setoran & targetSetoran kosong',
    pAsing.setoran?.length === 0 &&
      pAsing.targetSetoran?.length === 0 &&
      pAsing.forMember === undefined,
  )

  // Enkripsi AES-256-GCM lewat siapTerbitLengkap -> muatBerkasTerbit -> bukaDataPribadi
  const kunciM2 = await buatKunciBaru('m2')
  const terbit = await siapTerbitLengkap(bundleMentah, { m2: kunciM2 })
  const dimuat = muatBerkasTerbit(terbit.json)
  const dibukaM2 = await bukaDataPribadi(dimuat.locked, 'm2', kunciM2)
  cek(
    '16. Terbitan situs menyimpan setoran=0 di bagian terbuka & mendekripsi utuh 2 catatan Budi dengan kuncinya',
    dimuat.grup.setoran?.length === 0 &&
      dibukaM2?.setoran?.length === 2 &&
      dibukaM2.setoran.some((s) => s.catatan === 'Jaga aksen birama 12'),
  )

  const diperbarui = gabungPembaruan(dimuat.grup, pBudi, [])
  cek(
    '17. gabungPembaruan menjaga riwayat setoran pribadi anggota di HP saat materi grup diperbarui',
    diperbarui.setoran?.length === 2 && diperbarui.forMember === 'm2',
  )

  const rp = ringkasPaket(pBudi)
  cek(
    '18. ringkasPaket melaporkan jumlahTargetSetoran & jumlahSetoran dengan tepat',
    rp?.jumlahTargetSetoran === 2 && rp?.jumlahSetoran === 2,
  )
}

/* -------- 6. Rujukan Longgar Pusat Data & Penggabungan Anggota ----------- */
{
  const berkasPindah = {
    format: 'drillkit-data',
    versi: 1,
    dibuat: 1000,
    targetSetoran: [
      { id: 't1', judul: 'Bagian 1', kategori: 'musik', songId: 'lagu_hilang', urutan: 1, createdAt: 1 },
    ],
    setoran: [
      { id: 't1__m_hilang', targetId: 't1', memberId: 'm_hilang', jenjang: 'hafal_musik', tanggal: '2026-10-30', diubahAt: 1 },
    ],
  }
  const hasilPutus = putusRujukan(berkasPindah, { anggota: [], lagu: [], targetSetoran: [] })
  cek(
    '19. putusRujukan (pindah.ts) mengosongkan songId & memberId yang hilang dan melaporkannya tanpa membuang target',
    hasilPutus.berkas.targetSetoran[0].songId === undefined &&
      hasilPutus.berkas.setoran[0].memberId === '' &&
      hasilPutus.putus.length === 2,
    JSON.stringify(hasilPutus.putus),
  )

  // Penggabungan dua anggota ganda yang punya catatan setoran pada target yang sama & berbeda
  const mSimpan = { id: 'm_utama', code: 'B1', name: 'Andra Pratama', section: 'brass', instrument: 'Trumpet', role: 'member', joinYear: 2024, active: 1, token: 't1', createdAt: 1 }
  const mBuang = { id: 'm_duplikat', code: 'B1', name: 'Dede', section: 'brass', instrument: 'Trumpet', role: 'member', joinYear: 2024, active: 1, token: 't2', createdAt: 2 }
  const rencana = rencanakanGabung({
    simpan: mSimpan,
    buang: mBuang,
    absensi: [],
    evaluasi: [],
    setoran: [
      { id: 't1__m_utama', targetId: 't1', memberId: 'm_utama', jenjang: 'baca_lancar', tanggal: '2026-10-20', diubahAt: 10 },
      { id: 't1__m_duplikat', targetId: 't1', memberId: 'm_duplikat', jenjang: 'hafal_musik', tanggal: '2026-10-25', diubahAt: 20 },
      { id: 't2__m_duplikat', targetId: 't2', memberId: 'm_duplikat', jenjang: 'tempo_asli', tanggal: '2026-10-26', diubahAt: 30 },
    ],
    catatan: [],
    sets: [],
    drills: [],
    riwayat: [],
    kemajuan: [],
  })
  const keT1 = rencana.setoran.find((s) => s.targetId === 't1')
  const keT2 = rencana.setoran.find((s) => s.targetId === 't2')
  cek(
    '20. rencanakanGabung menulis ulang id deterministik setoran, memenangkan jenjang tertinggi saat bentrok, & menghapus id lama',
    rencana.jumlah.setoran === 2 &&
      keT1?.id === 't1__m_utama' &&
      keT1?.jenjang === 'hafal_musik' &&
      keT2?.id === 't2__m_utama' &&
      keT2?.memberId === 'm_utama' &&
      rencana.setoranHapus.includes('t1__m_duplikat') &&
      rencana.setoranHapus.includes('t2__m_duplikat'),
    JSON.stringify({ setoran: rencana.setoran, hapus: rencana.setoranHapus }),
  )

  const rb = ringkasBackup(
    { targetSetoran: [{ id: 't1' }], setoran: [{ id: 't1__m1' }, { id: 't2__m1' }] },
    { targetSetoran: ['t1'], setoran: ['t1__m1'] },
  )
  cek(
    '21. ringkasBackup mengenali tabel Target setoran & Setoran hafalan (baru vs ditimpa)',
    rb.baris.length === 2 && rb.baris[1].baru === 1 && rb.baris[1].ditimpa === 1,
    JSON.stringify(rb.baris),
  )

  const u = tulisUlangSetoran(
    [{ id: 't9__m_lama', targetId: 't9', memberId: 'm_lama', jenjang: 'lulus_gerak', tanggal: '2026-10-30', diubahAt: 1 }],
    { m_lama: 'm_baru' },
  )
  cek(
    '22. tulisUlangSetoran mengganti id "t9__m_lama" menjadi "t9__m_baru" & menandai id lama untuk dihapus',
    u.rows[0].id === 't9__m_baru' && u.hapus[0] === 't9__m_lama',
  )
}

console.log(`\nRingkasan #14 Logika: ${lulus} lulus, ${gagal} gagal`)
if (gagal > 0) process.exit(1)
