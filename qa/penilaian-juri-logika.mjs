/**
 * Uji murni logika #20 — Simulasi Penilaian Juri (Caption Recap Sheet) & Judge Tape Berpenanda Waktu (v2.0.0).
 *
 * Mencakup:
 *   1. Keenam skema kejuaraan (`field_show`, `street_parade`, `indoor_winds`, `indoor_perc`, `indoor_guard`, `kustom`):
 *      - Seluruh 5 skema kejuaraan resmi memiliki `maksSubtotal === 100.00`
 *      - Perhitungan terbobot (`0.5×` & `1.0×`), jepitan batas nilai, penalti, skor akhir bersih, & predikat `Box 1..5`
 *   2. Pemetaan cap waktu Judge Tape (`petakanDetikKeSetDanBirama` & `detikMulaiUntukSet`):
 *      - Melintasi multi-segmen `Song.tempoMap` (`120 BPM` -> `150 BPM`) & `DrillSet[]` secara presisi
 *   3. Analisis tren multi-simulasi (`hitungTrenSkorSimulasi`): urutan kronologis, selisih, & kenaikan total
 *   4. Cetakan A4 Caption Recap Sheet (`bangunHtmlRekapPenilaian`): 100% `#hex` murni (`0` `oklch`/`color-mix`/`rgba`) & aman XSS
 *   5. Ekstraksi arsip ZIP Judge Tape (`ekstrakJudgeTapeZip`) bolak-balik dengan `bikinZip` (`judgetape/manifest.json` + fallback nama berkas)
 *   6. Pusat Data & Pemutus Rujukan (`pindah.ts` + `bukaBerkas.ts`): pangkas rujukan `sessionId`, `drillId`, `songId`, dan `catatanWaktu[].setId` yatim
 *   7. Pagar privasi keras staf pelatih: `paketGrup`, `paketAnggota`, & `siapTerbit` tidak pernah membocorkan `penilaianLomba` / `judgeTapeAudio`
 */
import {
  buatSubCaptionDariSkema,
  detikMulaiUntukSet,
  formatWaktuDetik,
  hitungRekapPenilaian,
  hitungTrenSkorSimulasi,
  petakanDetikKeSetDanBirama,
  tentukanBoxKejuaraan,
} from '/tmp/penilaianJuri.mjs'
import { bangunHtmlRekapPenilaian } from '/tmp/penilaianJuriCetak.mjs'
import { ekstrakJudgeTapeZip } from '/tmp/judgeTapeZip.mjs'
import { bikinZip } from '/tmp/zip.mjs'
import { putusRujukan } from '/tmp/pindah.mjs'
import { ringkasBackup, ringkasDataPindah } from '/tmp/bukaBerkas.mjs'
import { paketAnggota, paketGrup } from '/tmp/bagikan.mjs'
import { siapTerbit } from '/tmp/terbit.mjs'

let lulus = 0
let gagal = 0

function cek(kondisi, pesan, detail = '') {
  if (kondisi) {
    lulus += 1
    console.log(`  ✓ ${pesan}`)
  } else {
    gagal += 1
    console.error(`  ✗ GAGAL: ${pesan}${detail ? ' -> ' + detail : ''}`)
  }
}

/* ---------------- 1. Templat Caption Recap & Klasifikasi Box ---------------- */
const SKEMA_100 = ['field_show', 'street_parade', 'indoor_winds', 'indoor_perc', 'indoor_guard']
for (const sk of SKEMA_100) {
  const caps = buatSubCaptionDariSkema(sk)
  const rekap = hitungRekapPenilaian({ captions: caps, penalti: [] })
  cek(
    rekap.maksSubtotal === 100,
    `skema "${sk}" memiliki total bobot maksimum tepat 100,00 poin`,
    `dapat=${rekap.maksSubtotal}`,
  )
  cek(
    Math.abs(rekap.skorAkhir - 75) <= 0.05 && rekap.predikatBox === 'Box 3',
    `skema "${sk}" nilai awal ~75% berada di Box 3`,
    `skor=${rekap.skorAkhir} box=${rekap.predikatBox}`,
  )
}

// Uji perhitungan terbobot, jepitan nilai di luar batas, penalti, terkuat/terlemah, & Box 1-5
{
  const caps = buatSubCaptionDariSkema('field_show').map((c) => {
    if (c.id === 'ge-1') return { ...c, nilaiKomposisi: 9.6, nilaiEksekusi: 9.4 } // 19.0 / 20 (95%)
    if (c.id === 'vis-cg') return { ...c, nilaiKomposisi: 6.0, nilaiEksekusi: 5.0 } // 5.5 / 10 (55%)
    return { ...c, nilaiKomposisi: 9.0, nilaiEksekusi: 9.0 } // 90%
  })
  const rekap = hitungRekapPenilaian({
    captions: caps,
    penalti: [
      { id: 'p1', alasan: 'Overtime', poin: 0.5 },
      { id: 'p2', alasan: 'Boundary', poin: 0.2 },
    ],
  })
  // Subtotal: ge-1 (19) + ge-2 (18) + vis-prof (9) + vis-anal (9) + vis-cg (5.5) + mus-brass (9) + mus-anal (9) + mus-perc (9) = 87.5
  cek(rekap.subtotal === 87.5, 'subtotal terbobot Field Show akurat (87,50)', `dapat=${rekap.subtotal}`)
  cek(rekap.totalPenalti === 0.7, 'total penalti dijumlahkan akurat (0,70)', `dapat=${rekap.totalPenalti}`)
  cek(rekap.skorAkhir === 86.8, 'skor bersih akhir = subtotal - penalti (86,80)', `dapat=${rekap.skorAkhir}`)
  cek(rekap.predikatBox === 'Box 4', 'skor 86,80% masuk klasifikasi Box 4', `dapat=${rekap.predikatBox}`)
  cek(rekap.terkuat?.id === 'ge-1', 'sub-caption terkuat terdeteksi (ge-1 95%)', `dapat=${rekap.terkuat?.id}`)
  cek(rekap.terlemah?.id === 'vis-cg', 'sub-caption terlemah terdeteksi (vis-cg 55%)', `dapat=${rekap.terlemah?.id}`)

  // Uji batas Box 1 s.d. Box 5 & jepitan penalti berlebih
  cek(tentukanBoxKejuaraan(59.9).box === 'Box 1', '59,9% -> Box 1')
  cek(tentukanBoxKejuaraan(60.0).box === 'Box 2', '60,0% -> Box 2')
  cek(tentukanBoxKejuaraan(79.99).box === 'Box 3', '79,99% -> Box 3')
  cek(tentukanBoxKejuaraan(89.99).box === 'Box 4', '89,99% -> Box 4')
  cek(tentukanBoxKejuaraan(90.0).box === 'Box 5', '90,0% -> Box 5')

  const rekapJepit = hitungRekapPenilaian({
    captions: [{ id: 'x', kelompok: 'ge', label: 'Uji', maksKomposisi: 10, nilaiKomposisi: 99, maksEksekusi: 10, nilaiEksekusi: -5, pengaliBobot: 1 }],
    penalti: [{ id: 'p', alasan: 'Diskualifikasi parsial', poin: 50 }],
  })
  cek(rekapJepit.subtotal === 10 && rekapJepit.skorAkhir === 0, 'nilai dijepit 0..maks dan skor bersih tidak pernah negatif')
}

/* ---------------- 2. Peta Detik Judge Tape <-> Set & Birama ---------------- */
{
  // Lagu: Segmen A = 4 birama @ 120 BPM (4/4 -> 2 detik/birama -> 0..8 dtk)
  //       Segmen B = 4 birama @ 150 BPM (4/4 -> 1,6 detik/birama -> 8..14,4 dtk)
  const song = {
    bpm: 120,
    beats: 4,
    tempoMap: [
      { id: 't1', label: 'Intro', measure: 4, bpm: 120, beats: 4 },
      { id: 't2', label: 'Allegro', measure: 4, bpm: 150, beats: 4 },
    ],
  }
  const drill = { tempo: 120, beatsPerCount: 1 }
  // Set 1: 16 counts @ 120 BPM = 8.0 dtk (birama 1..4)
  // Set 2: 16 counts @ 150 BPM = 6.4 dtk (8.0..14.4 dtk, birama 5..8)
  // Set 3: 0 counts (set penutup)
  const sets = [
    { id: 's1', name: 'Set 1', order: 0, counts: 16 },
    { id: 's2', name: 'Set 2', order: 1, counts: 16 },
    { id: 's3', name: 'Set 3', order: 2, counts: 0 },
  ]

  const p0 = petakanDetikKeSetDanBirama(0, { sets, drill, song })
  cek(p0.setId === 's1' && p0.hitunganSet === 1 && p0.birama === 1, 'detik 0,0 -> Set 1 Hitungan 1 Birama 1')

  const p45 = petakanDetikKeSetDanBirama(4.5, { sets, drill, song })
  // 4.5s -> Birama 3 (mulai 4.0s), Set 1 hitungan ke-10 (4.5 / 0.5 = 9 -> +1 = 10)
  cek(
    p45.setId === 's1' && p45.hitunganSet === 10 && p45.birama === 3,
    'detik 4,5 -> Set 1 Hitungan 10 Birama 3',
    JSON.stringify(p45),
  )

  const p96 = petakanDetikKeSetDanBirama(9.6, { sets, drill, song })
  // 9.6s -> Segmen B (mulai 8.0s, durasi bar 1.6s -> 9.6s tepat awal Birama 6), Set 2 (8.0..14.4s -> 1.6s = 4 count -> hitungan ke-5)
  cek(
    p96.setId === 's2' && p96.hitunganSet === 5 && p96.birama === 6,
    'detik 9,6 (segmen 150 BPM) -> Set 2 Hitungan 5 Birama 6',
    JSON.stringify(p96),
  )

  cek(detikMulaiUntukSet('s1', { sets, drill, song }) === 0, 'detikMulaiUntukSet Set 1 = 0,0 dtk')
  cek(detikMulaiUntukSet('s2', { sets, drill, song }) === 8, 'detikMulaiUntukSet Set 2 = 8,0 dtk')
  cek(detikMulaiUntukSet('s3', { sets, drill, song }) === 14.4, 'detikMulaiUntukSet Set 3 = 14,4 dtk')
  cek(formatWaktuDetik(84.9) === '01:24', 'formatWaktuDetik 84,9 -> 01:24')
}

/* ---------------- 3. Grafik Tren Skor Multi-Simulasi ---------------- */
{
  const buatSim = (id, tanggal, rasio) => ({
    id,
    judul: id,
    tanggal,
    skema: 'field_show',
    captions: buatSubCaptionDariSkema('field_show').map((c) => ({
      ...c,
      nilaiKomposisi: c.maksKomposisi * rasio,
      nilaiEksekusi: c.maksEksekusi * rasio,
    })),
    penalti: [],
    catatanWaktu: [],
    createdAt: 1,
    updatedAt: 1,
  })
  const tren = hitungTrenSkorSimulasi([
    buatSim('sim-3', '2026-11-14', 0.88),
    buatSim('sim-1', '2026-11-01', 0.70),
    buatSim('sim-2', '2026-11-07', 0.79),
  ])
  cek(
    tren.titik.map((t) => t.id).join(',') === 'sim-1,sim-2,sim-3',
    'tren mengurutkan simulasi secara kronologis (H-14 -> H-7 -> H-1)',
  )
  cek(tren.titik[1].selisihDariSebelumnya === 9, 'selisih simulasi #2 dari #1 = +9,00 poin')
  cek(tren.kenaikanTotal === 18, 'kenaikan total dari simulasi pertama ke terakhir = +18,00 poin')
  cek(tren.skorTertinggi === 88, 'skor tertinggi tercatat 88,00')
}

/* ---------------- 4. Cetak A4 Resmi Hex Murni & Anti-XSS ---------------- */
{
  const html = bangunHtmlRekapPenilaian({
    namaTim: 'MB Bahana <script>alert(1)</script>',
    penilaian: {
      id: 'j1',
      judul: 'Gladi Bersih H-1',
      tanggal: '2026-11-01',
      skema: 'field_show',
      juriUtama: 'Bpk. Budi',
      captions: buatSubCaptionDariSkema('field_show'),
      penalti: [{ id: 'p1', alasan: 'Overtime 3 detik', poin: 0.3 }],
      catatanWaktu: [
        {
          id: 'c1',
          detik: 18,
          fokus: 'musik',
          teks: 'Artikulasi trumpet harus kompak <img src=x onerror=alert(1)>',
          setId: 's2',
          labelSet: 'Set 2',
          hitunganSet: 5,
          birama: 10,
          tingkat: 'penting',
        },
      ],
      catatanUmum: 'Siap tampil penuh percaya diri.',
      createdAt: 1,
      updatedAt: 1,
    },
    namaDrill: 'Show Utama',
    namaLagu: 'Nusantara Jaya',
  })
  cek(!/oklch\(|color-mix\(|rgba\(/i.test(html), 'HTML cetak A4 murni #hex (0 oklch / color-mix / rgba)')
  cek(!html.includes('<script>') && !html.includes('<img src=x'), 'HTML cetak mensterilkan tag berbahaya (anti-XSS)')
  cek(
    html.includes('Set 2 (Cnt 5) · Birama 10') && html.includes('00:18') && html.includes('[PRIORITAS]'),
    'HTML cetak memuat transkrip Judge Tape lengkap dengan Set, Hitungan, & Birama',
  )
}

/* ---------------- 5. Arsip ZIP Judge Tape Bolak-Balik ---------------- */
{
  const sampelSuara = new Uint8Array([82, 73, 70, 70, 1, 2, 3, 4, 87, 65, 86, 69])
  const bitaZip = bikinZip([
    {
      nama: 'judgetape/juri_01_komentar-run1.wav',
      isi: sampelSuara,
    },
    {
      nama: 'judgetape/manifest.json',
      isi: JSON.stringify({
        'judgetape/juri_01_komentar-run1.wav': {
          penilaianId: 'juri_01',
          namaFile: 'komentar-run1.wav',
          tipe: 'audio/wav',
          ukuran: sampelSuara.byteLength,
          durasiDetik: 42.5,
          hash: 'deadbeef',
        },
      }),
    },
  ])
  const pulih = ekstrakJudgeTapeZip(bitaZip)
  cek(pulih.length === 1, 'ekstrakJudgeTapeZip memulihkan 1 rekaman suara dari ZIP')
  cek(
    pulih[0]?.penilaianId === 'juri_01' &&
      pulih[0]?.namaFile === 'komentar-run1.wav' &&
      pulih[0]?.durasiDetik === 42.5 &&
      pulih[0]?.ukuran === sampelSuara.byteLength,
    'metadata rekaman Judge Tape (penilaianId, namaFile, durasi, ukuran) pulih utuh',
  )
}

/* ---------------- 6. Pusat Data & Pemutus Rujukan Yatim ---------------- */
{
  const berkasMasuk = {
    format: 'drillkit-data',
    versi: 1,
    dibuat: Date.now(),
    penilaianLomba: [
      {
        id: 'j_uji',
        judul: 'Simulasi Uji',
        tanggal: '2026-11-01',
        skema: 'field_show',
        sessionId: 'sesi_hilang',
        drillId: 'drill_ada',
        songId: 'lagu_hilang',
        captions: buatSubCaptionDariSkema('field_show'),
        penalti: [],
        catatanWaktu: [
          { id: 'c_aman', detik: 4, fokus: 'ge', teks: 'Bagus', setId: 'set_ada', labelSet: 'Set 1' },
          { id: 'c_yatim', detik: 19, fokus: 'visual', teks: 'Renggang', setId: 'set_hilang', labelSet: 'Set 9' },
        ],
        createdAt: 1,
        updatedAt: 1,
      },
    ],
  }
  const { berkas, putus } = putusRujukan(berkasMasuk, {
    drill: ['drill_ada'],
    set: ['set_ada'],
  })
  const hasil = berkas.penilaianLomba[0]
  cek(
    hasil.sessionId === undefined && hasil.songId === undefined && hasil.drillId === 'drill_ada',
    'putusRujukan memangkas sessionId & songId yatim namun menjaga drillId yang sah',
  )
  cek(
    hasil.catatanWaktu[0].setId === 'set_ada' && hasil.catatanWaktu[1].setId === undefined && hasil.catatanWaktu[1].labelSet === 'Set 9',
    'putusRujukan memangkas catatanWaktu[].setId yatim sambil mempertahankan teks & labelSet historis',
  )
  cek(putus.length === 3, 'putusRujukan melaporkan tepat 3 rujukan yatim yang dipangkas', `dapat=${putus.length}`)

  const rBackup = ringkasBackup({ penilaianLomba: [{ id: 'j1' }], judgeTapeAudio: [{ id: 'j1' }] }, {})
  const rData = ringkasDataPindah(berkasMasuk, {})
  cek(
    rBackup.baris.some((b) => b.label === 'Simulasi penilaian juri') &&
      rBackup.baris.some((b) => b.label === 'Rekaman suara Judge Tape'),
    'ringkasBackup mengenali tabel penilaianLomba & judgeTapeAudio',
  )
  cek(
    rData.baris.some((b) => b.label === 'Simulasi penilaian juri'),
    'ringkasDataPindah mengenali jenis data penilaianLomba',
  )
}

/* ---------------- 7. Pagar Privasi Keras Paket Anggota & Terbit ---------------- */
{
  const bundleKotor = {
    version: 1,
    teamName: 'MB Uji',
    exportedAt: Date.now(),
    members: [{ id: 'm1', code: 'BR01', name: 'Andra', section: 'brass', instrument: 'Trumpet', role: 'member', joinYear: 2025, active: 1, token: 'rahasia', createdAt: 1 }],
    sessions: [],
    attendance: [],
    drills: [],
    sets: [],
    songs: [],
    setlists: [],
    // Seandainya seseorang menyuntikkan properti penilaianLomba/judgeTapeAudio secara paksa:
    penilaianLomba: [{ id: 'rahasia_juri', catatanUmum: 'RAHASIA_STAF_JURI' }],
    judgeTapeAudio: [{ id: 'rahasia_audio' }],
  }
  // Bersihkan lewat paketGrup dan paketAnggota — bahkan jika disuntik paksa di input, harus terhapus!
  const grup = paketGrup(bundleKotor)
  const perAnak = paketAnggota(bundleKotor, 'm1')
  const jsonGrup = JSON.stringify(grup)
  const jsonAnak = JSON.stringify(perAnak)
  const jsonTerbit = siapTerbit(bundleKotor)
  cek(
    !('penilaianLomba' in grup) && !('judgeTapeAudio' in grup),
    'paketGrup aktif mengupas properti rahasia penilaianLomba & judgeTapeAudio',
  )
  cek(
    !('penilaianLomba' in perAnak) && !('judgeTapeAudio' in perAnak),
    'paketAnggota aktif mengupas properti rahasia penilaianLomba & judgeTapeAudio',
  )
  cek(
    !jsonGrup.includes('RAHASIA_STAF_JURI') &&
      !jsonAnak.includes('RAHASIA_STAF_JURI') &&
      !jsonTerbit.includes('RAHASIA_STAF_JURI'),
    'keluaran JSON paketGrup, paketAnggota, & siapTerbit 100% bebas penilaianLomba, judgeTapeAudio, & catatan juri',
  )
}

console.log(`\n${lulus} lulus, ${gagal} gagal`)
process.exit(gagal > 0 ? 1 : 0)
