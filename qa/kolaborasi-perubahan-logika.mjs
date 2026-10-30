/**
 * Uji Logika Murni #15 — Kolaborasi Multi-Pelatih Seksi & Log Perubahan Show (I1).
 *
 * Yang diuji tanpa peramban:
 *  1. #15a `susunBerkasSetoranSeksi`:
 *     - Membatasi ekspor secara ketat hanya ke anggota seksi yang dipilih
 *       (absensi, evaluasi, setoran #14, catatan anggota, dan centang `kemajuan`),
 *     - Menghormati rentang tanggal (`hari-ini`, `7-hari`, `semua`),
 *     - Membersihkan kolom rahasia anggota (`token: ''`, `phone: undefined`, `notes: undefined`),
 *     - Menyertakan jadwal sesi & target setoran rujukan agar tidak yatim.
 *  2. #15a Penggabungan Aman di Pelatih Kepala:
 *     - `ringkasGabungSeksi` mendeteksi seksi yang masuk, bentrokan absensi,
 *       dan membuktikan seksi lain tidak tersentuh,
 *     - `gabungKemajuanAman` menggabungkan centang seksi asisten tanpa menghapus
 *       centang seksi lain (`percussion`, `guard`, `'*'`),
 *     - `gabungSetoranAman` mempertahankan jenjang tertinggi,
 *     - `gabungAbsensiAsisten` menghormati pilihan `utamakanAsisten` (true vs false)
 *       sambil menjaga `id` lokal pada indeks unik `[sessionId+memberId]`.
 *  3. #15a Pintu #7 (`ringkasDataPindah` & `namaSetoranSeksi`):
 *     - Mengenali `asistenSeksi` dan membentuk nama berkas ASCII aman.
 *  4. #15b Log Perubahan Show Otomatis (`I1`):
 *     - Mengelompokkan set berurutan & memadatkan kode pemain (`Set 8–11: posisi T1–T6 berubah > 2 langkah`),
 *     - Mendeteksi pemecahan set (`Set 14 dipecah menjadi 14 & 14A`),
 *     - Mendeteksi perubahan tempo segmen lagu (`Tempo Segmen B berubah 132 → 140 BPM`),
 *     - Mendeteksi perubahan jadwal & target setoran baru,
 *     - `apakahButirMenyangkutAnggota` menyorot tepat pemain yang titik/seksinya terdampak,
 *     - `pilihAcuanPerubahan` menjaga diff tetap utuh saat mengunduh berkas grup lalu ZIP per anggota,
 *     - Pagar privasi: `paketGrup`, `paketAnggota`, dan `gabungPembaruan` membawa `perubahanPaket`
 *       tanpa pernah membocorkan data pribadi anggota.
 */
import {
  gabungAbsensiAsisten,
  gabungKemajuanAman,
  gabungSetoranAman,
  hitungPratinjauSetoranSeksi,
  ringkasGabungSeksi,
  susunBerkasSetoranSeksi,
} from '/tmp/kolaborasiSeksi.mjs'
import {
  apakahButirMenyangkutAnggota,
  bandingkanKeadaanShow,
  bandingkanPaketShow,
  cicipKeadaanShow,
  ekstrakKeadaanShow,
  pilihAcuanPerubahan,
  ringkasKodePemain,
} from '/tmp/logPerubahan.mjs'
import { namaSetoranSeksi, ringkasDataPindah } from '/tmp/bukaBerkas.mjs'
import { paketAnggota, paketGrup } from '/tmp/bagikan.mjs'

let lulus = 0
let gagal = 0
function cek(nama, ok, detail = '') {
  if (ok) {
    lulus += 1
    console.log('  ✓ ' + nama)
  } else {
    gagal += 1
    console.error('  ✗ ' + nama + (detail ? ' → ' + detail : ''))
  }
}

console.log('== #15 Uji Logika Kolaborasi Pelatih Seksi & Log Perubahan Show (I1) ==')

/* ---------------------- 1. #15a Ekspor Setoran Seksi ---------------------- */
const anggotaUji = [
  {
    id: 'm_t1',
    code: 'T1',
    name: 'Andi Pratama',
    section: 'brass',
    instrument: 'Trumpet',
    role: 'member',
    active: 1,
    token: 'rahasia_t1',
    phone: '081111111',
    notes: 'Catatan rahasia pelatih',
  },
  {
    id: 'm_s1',
    code: 'S1',
    name: 'Budi Santoso',
    section: 'percussion',
    instrument: 'Snare',
    role: 'member',
    active: 1,
    token: 'rahasia_s1',
    phone: '082222222',
    notes: 'Catatan rahasia Budi',
  },
  {
    id: 'm_g1',
    code: 'G1',
    name: 'Citra Ayu',
    section: 'guard',
    instrument: 'Flag',
    role: 'member',
    active: 1,
    token: 'rahasia_g1',
  },
]

const epochHariIni = Date.parse('2026-10-30T09:00:00Z')
const epochLama = Date.parse('2026-10-01T09:00:00Z')

const sumberAsisten = {
  anggota: anggotaUji,
  jadwal: [
    { id: 'ses_hari_ini', title: 'Latihan Seksi Brass', type: 'latihan', date: '2026-10-30', startTime: '08:00', endTime: '11:00', checklist: [], createdAt: 1 },
    { id: 'ses_lama', title: 'Latihan Lama', type: 'latihan', date: '2026-10-01', startTime: '08:00', endTime: '11:00', checklist: [], createdAt: 1 },
  ],
  absensi: [
    { id: 'att_t1_baru', sessionId: 'ses_hari_ini', memberId: 'm_t1', status: 'hadir', checkInAt: epochHariIni, note: 'Tepat waktu' },
    { id: 'att_t1_lama', sessionId: 'ses_lama', memberId: 'm_t1', status: 'hadir', checkInAt: epochLama },
    { id: 'att_s1_baru', sessionId: 'ses_hari_ini', memberId: 'm_s1', status: 'hadir', checkInAt: epochHariIni },
  ],
  evaluasi: [
    { id: 'ev_t1', memberId: 'm_t1', tanggal: '2026-10-28', nilai: { teknik: 5 }, createdAt: 1 },
    { id: 'ev_s1', memberId: 'm_s1', tanggal: '2026-10-28', nilai: { teknik: 4 }, createdAt: 1 },
  ],
  catatan: [
    { id: 'nt_t1', memberId: 'm_t1', at: epochHariIni, text: 'Artikulasi bersih', by: 'Kak Raka' },
    { id: 'nt_s1', memberId: 'm_s1', at: epochHariIni, text: 'Roll rata', by: 'Kak Dito' },
  ],
  targetSetoran: [
    { id: 'tg_1', judul: 'Intro Bar 1–16', kategori: 'musik', urutan: 1, createdAt: 1 },
    { id: 'tg_tak_dipakai', judul: 'Coda', kategori: 'musik', urutan: 2, createdAt: 1 },
  ],
  setoran: [
    { id: 'tg_1__m_t1', targetId: 'tg_1', memberId: 'm_t1', jenjang: 'hafal_musik', tanggal: '2026-10-30', diubahAt: epochHariIni, penguji: 'Kak Raka' },
    { id: 'tg_1__m_s1', targetId: 'tg_1', memberId: 'm_s1', jenjang: 'tempo_asli', tanggal: '2026-10-30', diubahAt: epochHariIni },
  ],
  kemajuan: [
    {
      key: 'drill_utama',
      centang: {
        set_1: { brass: epochHariIni, percussion: epochHariIni, '*': epochHariIni },
        set_2: { percussion: epochHariIni },
        set_3: { brass: epochLama },
      },
      diubah: epochHariIni,
    },
  ],
}

const pratinjau7Hari = hitungPratinjauSetoranSeksi(sumberAsisten, 'brass', '7-hari', '2026-10-30')
cek(
  '1. Pratinjau 7 hari Brass menyaring tepat seksi & rentang tanggal',
  pratinjau7Hari.anggota === 1 &&
    pratinjau7Hari.absensi === 1 &&
    pratinjau7Hari.evaluasi === 1 &&
    pratinjau7Hari.setoran === 1 &&
    pratinjau7Hari.catatan === 1 &&
    pratinjau7Hari.kemajuanCentang === 1,
  JSON.stringify(pratinjau7Hari),
)

const berkasBrass = susunBerkasSetoranSeksi(sumberAsisten, {
  seksi: 'brass',
  labelSeksi: 'Brass',
  oleh: 'Kak Raka — Brass',
  rentang: '7-hari',
  tanggalAcuan: '2026-10-30',
  dibuat: epochHariIni,
})

cek(
  '2. Berkas setoran seksi berformat drillkit-data & hanya memuat anggota Brass tanpa kolom rahasia',
  berkasBrass.format === 'drillkit-data' &&
    berkasBrass.anggota?.length === 1 &&
    berkasBrass.anggota[0].id === 'm_t1' &&
    berkasBrass.anggota[0].token === '' &&
    berkasBrass.anggota[0].phone === undefined &&
    berkasBrass.anggota[0].notes === undefined,
  JSON.stringify(berkasBrass.anggota),
)

cek(
  '3. Berkas setoran seksi membuang data Percussion/Guard & centang kemajuan seksi lain',
  berkasBrass.absensi?.every((a) => a.memberId === 'm_t1') &&
    berkasBrass.evaluasi?.every((e) => e.memberId === 'm_t1') &&
    berkasBrass.setoran?.every((s) => s.memberId === 'm_t1') &&
    JSON.stringify(berkasBrass.kemajuan?.[0]?.centang) === JSON.stringify({ set_1: { brass: epochHariIni } }) &&
    berkasBrass.jadwal?.length === 1 &&
    berkasBrass.targetSetoran?.length === 1,
  JSON.stringify(berkasBrass.kemajuan),
)

const fnSeksi = namaSetoranSeksi('Brass', 'Kak Raka — Brass', new Date('2026-10-30T00:00:00Z'))
cek(
  '4. Nama berkas setoran seksi murni ASCII (tanda pisah Unicode dinormalisasi)',
  fnSeksi === 'DrillKit - SETORAN SEKSI Brass (Kak Raka - Brass) - 2026-10-30.json' && !/[^\x20-\x7E]/.test(fnSeksi),
  fnSeksi,
)

const ringkasPintu7 = ringkasDataPindah(berkasBrass, {})
cek(
  '5. Pintu #7 ringkasDataPindah mengenali metadata asistenSeksi',
  ringkasPintu7.asistenSeksi?.seksi === 'brass' &&
    ringkasPintu7.asistenSeksi?.oleh === 'Kak Raka — Brass' &&
    ringkasPintu7.asistenSeksi?.rentang === '7-hari',
  JSON.stringify(ringkasPintu7.asistenSeksi),
)

/* ------------ 2. #15a Penggabungan Aman di Pelatih Kepala ----------------- */
const lokalKepala = {
  anggota: anggotaUji,
  jadwal: sumberAsisten.jadwal,
  absensi: [
    // Bentrok di Brass: Pelatih Kepala sempat menandai izin, asisten di lapangan menandai hadir
    { id: 'att_lokal_t1', sessionId: 'ses_hari_ini', memberId: 'm_t1', status: 'izin' },
    // Seksi Percussion milik Pelatih Kepala
    { id: 'att_lokal_s1', sessionId: 'ses_hari_ini', memberId: 'm_s1', status: 'sakit' },
  ],
}

const ringkasGabung = ringkasGabungSeksi(berkasBrass, lokalKepala, [
  { id: 'brass', label: 'Brass', short: 'BRS', dot: '#f59e0b' },
  { id: 'percussion', label: 'Percussion', short: 'PRC', dot: '#10b981' },
  { id: 'guard', label: 'Color Guard', short: 'CG', dot: '#ec4899' },
])

cek(
  '6. ringkasGabungSeksi melaporkan seksi Brass, 1 bentrok absensi, & seksi lain aman tak tersentuh',
  ringkasGabung.perSeksi.length === 1 &&
    ringkasGabung.perSeksi[0].seksi === 'brass' &&
    ringkasGabung.bentrokAbsensi.length === 1 &&
    ringkasGabung.bentrokAbsensi[0].statusLokal === 'izin' &&
    ringkasGabung.bentrokAbsensi[0].statusMasuk === 'hadir' &&
    ringkasGabung.seksiTakTersentuh.map((s) => s.seksi).sort().join(',') === 'guard,percussion',
  JSON.stringify(ringkasGabung),
)

const hasilKemajuan = gabungKemajuanAman(berkasBrass.kemajuan, [
  {
    key: 'drill_utama',
    centang: {
      set_1: { percussion: 1000, '*': 2000 },
      set_2: { guard: 3000 },
    },
    diubah: 3000,
  },
])
cek(
  '7. gabungKemajuanAman menyisipkan centang Brass tanpa menghapus centang Percussion, Guard, maupun "*"',
  hasilKemajuan.tulis[0].centang.set_1.brass === epochHariIni &&
    hasilKemajuan.tulis[0].centang.set_1.percussion === 1000 &&
    hasilKemajuan.tulis[0].centang.set_1['*'] === 2000 &&
    hasilKemajuan.tulis[0].centang.set_2.guard === 3000,
  JSON.stringify(hasilKemajuan.tulis[0].centang),
)

const hasilSetoran = gabungSetoranAman(
  [
    { id: 'tg_1__m_t1', targetId: 'tg_1', memberId: 'm_t1', jenjang: 'baca', tanggal: '2026-10-30', diubahAt: epochHariIni + 500 },
  ],
  [
    { id: 'tg_1__m_t1', targetId: 'tg_1', memberId: 'm_t1', jenjang: 'lulus_gerak', tanggal: '2026-10-29', diubahAt: epochHariIni },
  ],
)
cek(
  '8. gabungSetoranAman menjaga jenjang lokal yang lebih tinggi agar tidak turun tak sengaja',
  hasilSetoran.tulis[0].jenjang === 'lulus_gerak' && hasilSetoran.laporan.length === 1,
  JSON.stringify(hasilSetoran),
)

const absUtamakanAsisten = gabungAbsensiAsisten(berkasBrass.absensi, lokalKepala.absensi, true)
const absPertahanLokal = gabungAbsensiAsisten(berkasBrass.absensi, lokalKepala.absensi, false)
cek(
  '9. gabungAbsensiAsisten mempertahankan id lokal saat memperbarui status & menghormati saklar utamakanAsisten',
  absUtamakanAsisten.tulis.length === 1 &&
    absUtamakanAsisten.tulis[0].id === 'att_lokal_t1' &&
    absUtamakanAsisten.tulis[0].status === 'hadir' &&
    absPertahanLokal.tulis.length === 0 &&
    absPertahanLokal.laporan.length === 1,
  JSON.stringify({ absUtamakanAsisten, absPertahanLokal }),
)

/* ------------ 3. #15b Log Perubahan Show Otomatis (I1) -------------------- */
const anggotaTrumpet = [1, 2, 3, 4, 5, 6].map((n) => ({
  id: `m_trp_${n}`,
  code: `T${n}`,
  name: `Trumpet ${n}`,
  section: 'brass',
}))
const semuaAnggotaShow = [...anggotaTrumpet, anggotaUji[1]]

function buatTitikAwal(geserYd = 0) {
  const pts = {}
  anggotaTrumpet.forEach((m, i) => {
    pts[m.id] = { x: i * 1.25 + geserYd, y: 0, facing: 'front' }
  })
  pts.m_s1 = { x: -5, y: -5, facing: 'front' }
  return pts
}

const fieldStandar = {
  widthYd: 53.33,
  lengthYd: 100,
  endZoneYd: 10,
  hash: 'ncaa',
  gridYd: 5,
  step: '8to5', // 1 langkah = 0.625 yd -> 2.5 yd = tepat 4 langkah!
  customStepYd: 0.625,
  showLabels: 1,
}

const keadaanA = ekstrakKeadaanShow({
  dibuatAt: 1000,
  defaultField: fieldStandar,
  members: semuaAnggotaShow,
  drills: [
    { id: 'd1', name: 'Opening Show', showTitle: 'Gema Nusantara', field: fieldStandar, tempo: 120, beatsPerCount: 1, rosterIds: [], createdAt: 1, updatedAt: 1 },
  ],
  sets: [
    { id: 's8', drillId: 'd1', order: 0, name: '8', counts: 16, points: buatTitikAwal(0), createdAt: 1 },
    { id: 's9', drillId: 'd1', order: 1, name: '9', counts: 16, points: buatTitikAwal(0), createdAt: 1 },
    { id: 's10', drillId: 'd1', order: 2, name: '10', counts: 16, points: buatTitikAwal(0), createdAt: 1 },
    { id: 's11', drillId: 'd1', order: 3, name: '11', counts: 16, points: buatTitikAwal(0), createdAt: 1 },
    { id: 's14', drillId: 'd1', order: 4, name: '14', counts: 16, points: buatTitikAwal(0), createdAt: 1 },
  ],
  songs: [
    {
      id: 'lagu_2',
      title: 'Lagu 2',
      bpm: 120,
      beats: 4,
      tempoMap: [
        { id: 'tm_a', label: 'A', measure: 1, bpm: 120, beats: 4 },
        { id: 'tm_b', label: 'B', measure: 17, bpm: 132, beats: 4 },
      ],
      createdAt: 1,
    },
  ],
  sessions: [
    { id: 'ses_1', title: 'Latihan Gabungan', type: 'latihan', date: '2026-11-01', startTime: '08:00', endTime: '11:00', checklist: [], createdAt: 1 },
  ],
  targetSetoran: [],
})

const keadaanB = ekstrakKeadaanShow({
  dibuatAt: 2000,
  defaultField: fieldStandar,
  members: semuaAnggotaShow,
  drills: keadaanA.drills,
  sets: [
    // Set 8–11: T1..T6 bergeser +2.5 yd (= 4 langkah > 2 langkah), m_s1 diam
    { id: 's8', drillId: 'd1', order: 0, name: '8', counts: 16, points: buatTitikAwal(2.5), createdAt: 1 },
    { id: 's9', drillId: 'd1', order: 1, name: '9', counts: 16, points: buatTitikAwal(2.5), createdAt: 1 },
    { id: 's10', drillId: 'd1', order: 2, name: '10', counts: 16, points: buatTitikAwal(2.5), createdAt: 1 },
    { id: 's11', drillId: 'd1', order: 3, name: '11', counts: 16, points: buatTitikAwal(2.5), createdAt: 1 },
    // Set 14 dipecah menjadi 14 & 14A
    { id: 's14', drillId: 'd1', order: 4, name: '14', counts: 8, points: buatTitikAwal(0), createdAt: 1 },
    { id: 's14a', drillId: 'd1', order: 5, name: '14A', counts: 8, points: buatTitikAwal(0), createdAt: 1 },
  ],
  songs: [
    {
      id: 'lagu_2',
      title: 'Lagu 2',
      bpm: 120,
      beats: 4,
      tempoMap: [
        { id: 'tm_a', label: 'A', measure: 1, bpm: 120, beats: 4 },
        { id: 'tm_b', label: 'B', measure: 17, bpm: 140, beats: 4 },
      ],
      createdAt: 1,
    },
  ],
  sessions: [
    { id: 'ses_1', title: 'Latihan Gabungan', type: 'latihan', date: '2026-11-01', startTime: '09:00', endTime: '12:00', checklist: [], createdAt: 1 },
  ],
  targetSetoran: [
    { id: 'tg_baru', judul: 'Segmen B Brass', kategori: 'musik', biramaDari: 17, biramaSampai: 32, sections: ['brass'], tenggat: '2026-11-05', urutan: 1, createdAt: 2 },
  ],
})

cek('10. ringkasKodePemain memadatkan T1..T6 menjadi T1–T6', ringkasKodePemain(['T3', 'T1', 'T2', 'T5', 'T4', 'T6']) === 'T1–T6')

const diffShow = bandingkanKeadaanShow(keadaanA, keadaanB, {
  catatanPelatih: 'Perhatikan tempo baru Segmen B!',
  sekarang: 2000,
})

const semuaTeks = diffShow.butir.map((b) => `${b.subjek}: ${b.teks}`).join(' | ')
cek(
  '11. Deteksi pengelompokan set berurutan & pergeseran > 2 langkah ("Set 8–11: posisi T1–T6 berubah > 2 langkah")',
  diffShow.butir.some((b) => b.teks.includes('Set 8–11: posisi T1–T6 berubah > 2 langkah (maks 4 langkah)')),
  semuaTeks,
)
cek(
  '12. Deteksi pemecahan set ("Set 14 dipecah menjadi 14 & 14A") tanpa duplikasi perubahan hitungan induk',
  diffShow.butir.some((b) => b.teks === 'Set 14 dipecah menjadi 14 & 14A') &&
    !diffShow.butir.some((b) => b.teks.includes('Set 14: hitungan berubah')),
  semuaTeks,
)
cek(
  '13. Deteksi perubahan tempo segmen lagu ("Tempo Segmen B berubah 132 → 140 BPM")',
  diffShow.butir.some((b) => b.subjek === 'Lagu 2' && b.teks === 'Tempo Segmen B berubah 132 → 140 BPM'),
  semuaTeks,
)
cek(
  '14. Deteksi perubahan waktu jadwal & penambahan target setoran baru',
  diffShow.butir.some((b) => b.kategori === 'jadwal' && b.teks.includes('08:00 → 09:00')) &&
    diffShow.butir.some((b) => b.kategori === 'target' && b.subjek === 'Segmen B Brass'),
  semuaTeks,
)

const butirGeser = diffShow.butir.find((b) => b.teks.includes('Set 8–11'))
const butirTargetBrass = diffShow.butir.find((b) => b.kategori === 'target')
cek(
  '15. apakahButirMenyangkutAnggota menyorot T1 (Brass) dan mengabaikan S1 (Percussion)',
  apakahButirMenyangkutAnggota(butirGeser, { code: 'T1', section: 'brass' }) === true &&
    apakahButirMenyangkutAnggota(butirGeser, { code: 'S1', section: 'percussion' }) === false &&
    apakahButirMenyangkutAnggota(butirTargetBrass, { code: 'T6', section: 'brass' }) === true &&
    apakahButirMenyangkutAnggota(butirTargetBrass, { code: 'S1', section: 'percussion' }) === false,
)

const riwayatSimulasi = [
  {
    id: 'log_2',
    dibuatAt: 2000,
    label: 'Terbitan 2',
    cicipSebelum: cicipKeadaanShow(keadaanA),
    cicipSesudah: cicipKeadaanShow(keadaanB),
    ringkasan: diffShow,
    keadaanSesudah: keadaanB,
  },
  {
    id: 'log_1',
    dibuatAt: 1000,
    label: 'Acuan 1',
    cicipSebelum: undefined,
    cicipSesudah: cicipKeadaanShow(keadaanA),
    ringkasan: { dibuatAt: 1000, dibandingkanDariAt: 1000, butir: [] },
    keadaanSesudah: keadaanA,
  },
]
const acuanSaatUlangEkspor = pilihAcuanPerubahan(keadaanB, riwayatSimulasi)
cek(
  '16. pilihAcuanPerubahan menjaga acuan A saat mengunduh ulang keadaan B (grup -> ZIP anggota)',
  cicipKeadaanShow(acuanSaatUlangEkspor.acuan) === cicipKeadaanShow(keadaanA) &&
    acuanSaatUlangEkspor.pakaiUlangEntri?.id === 'log_2',
)

// 4. Pagar privasi pada paketGrup & paketAnggota
const paketDasar = {
  format: 'drillkit-share',
  version: 1,
  exportedAt: 2000,
  team: { teamName: 'MB Gema', coachName: 'Pelatih', memberMode: 1 },
  members: anggotaUji,
  sessions: keadaanB.sessions,
  drills: keadaanB.drills,
  sets: keadaanB.sets,
  songs: keadaanB.songs,
  targetSetoran: keadaanB.targetSetoran,
  setoran: sumberAsisten.setoran,
  perubahanPaket: diffShow,
  attendance: sumberAsisten.absensi,
  memberNotes: sumberAsisten.catatan,
}
const grupHasil = paketGrup(paketDasar)
const perAnggotaT1 = paketAnggota(paketDasar, 'm_t1')
const teksPerubahanJson = JSON.stringify(grupHasil.perubahanPaket)
cek(
  '17. paketGrup & paketAnggota menyertakan perubahanPaket publik tanpa bocoran data rahasia sedikit pun',
  grupHasil.perubahanPaket?.butir.length === diffShow.butir.length &&
    perAnggotaT1.perubahanPaket?.butir.length === diffShow.butir.length &&
    !teksPerubahanJson.includes('rahasia_') &&
    !teksPerubahanJson.includes('081111111') &&
    !teksPerubahanJson.includes('Catatan rahasia'),
)

const paketLamaTanpaLog = { ...paketGrup({ ...paketDasar, drills: keadaanA.drills, sets: keadaanA.sets, songs: keadaanA.songs, perubahanPaket: undefined }), exportedAt: 1000 }
const paketBaruTanpaLog = { ...paketGrup({ ...paketDasar, perubahanPaket: undefined }), exportedAt: 2000 }
const diffDariPaket = bandingkanPaketShow(paketLamaTanpaLog, paketBaruTanpaLog)
cek(
  '18. bandingkanPaketShow mampu menghitung diff otomatis antar dua ShareBundle di HP anggota',
  diffDariPaket.butir.some((b) => b.teks.includes('Set 8–11')) &&
    diffDariPaket.butir.some((b) => b.teks.includes('Tempo Segmen B berubah 132 → 140 BPM')),
)

console.log(`\nRingkasan #15 Logika: ${lulus} lulus, ${gagal} gagal`)
if (gagal > 0) process.exit(1)
