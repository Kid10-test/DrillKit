/**
 * Uji murni logika #21 — Audisi Anggota Baru (#21a), Surat Dispensasi A4 & Kartu Medis
 * AES-256-GCM (#21b), serta Buku Kas/Iuran TC & Arsip Lintas-Musim (#21c) (v2.1.0).
 */
import {
  TABEL_MUSIMAN_DIARSIPKAN,
  buatKodeAnggotaBaru,
  buatNomorKwitansiKas,
  buatNomorSuratDispensasi,
  bukaMedisTerenkripsi,
  eksporMedisTerenkripsi,
  evaluasiSiagaMedis,
  formatRupiah,
  hitungRekapKasIuran,
  hitungSkorAudisi,
  hitungStatusIuranAnggota,
  kelompokkanPesertaDispensasi,
  luluskanCalonKeAnggota,
  susunArsipMusim,
  susunPeringkatAudisi,
} from '/tmp/administrasiUnit.mjs'
import {
  bangunHtmlKwitansiIuran,
  bangunHtmlLembarMedisDarurat,
  bangunHtmlPiagamArsipMusim,
  bangunHtmlRekapAudisi,
  bangunHtmlRekapKasIuran,
  bangunHtmlSuratDispensasi,
} from '/tmp/administrasiUnitCetak.mjs'
import { buatSubCaptionDariSkema } from '/tmp/penilaianJuri.mjs'
import { putusRujukan } from '/tmp/pindah.mjs'
import { ringkasBackup, ringkasDataPindah } from '/tmp/bukaBerkas.mjs'
import { rencanakanGabung } from '/tmp/namaAnggota.mjs'
import { bersihkanAnggota, kupasDataKhususStaf, paketAnggota, paketGrup } from '/tmp/bagikan.mjs'
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

/* ---------------- 1. #21a Audisi & Seleksi Anggota Baru ---------------- */
const skorTinggi = hitungSkorAudisi({ ritmik: 90, kepekaanNada: 92, posturLangkah: 86, koordinasiAlat: 88 })
cek(
  skorTinggi?.rataRata === 89 && skorTinggi?.predikat === 'Sangat Direkomendasikan',
  'hitungSkorAudisi menghitung rata-rata 4 aspek & predikat puncak secara akurat',
  JSON.stringify(skorTinggi),
)
const skorJepit = hitungSkorAudisi({ ritmik: 120, kepekaanNada: -10, posturLangkah: 60, koordinasiAlat: 60 })
cek(
  skorJepit?.ritmik === 100 && skorJepit?.kepekaanNada === 0 && skorJepit?.rataRata === 55,
  'hitungSkorAudisi menjepit nilai di luar 0..100 secara aman',
)

const daftarCalon = [
  {
    id: 'aud_1',
    nama: 'Raka Mahendra',
    panggilan: 'Raka',
    instansiAsal: 'SMA Negeri 3 Yogyakarta',
    kelasJurusan: 'X MIPA 1',
    nomorInduk: '26101',
    telepon: '08123456789',
    minatSeksi1: 'brass',
    minatInstrumen1: 'Trumpet',
    minatSeksi2: 'percussion',
    tahunAngkatan: 2026,
    nilai: { ritmik: 80, kepekaanNada: 80, posturLangkah: 80, koordinasiAlat: 80 },
    status: 'dinilai',
    createdAt: 1,
    updatedAt: 1,
  },
  {
    id: 'aud_2',
    nama: 'Nadia Kusuma',
    minatSeksi1: 'guard',
    minatInstrumen1: 'Flag',
    minatSeksi2: 'brass',
    minatInstrumen2: 'Mellophone',
    tahunAngkatan: 2026,
    nilai: { ritmik: 80, kepekaanNada: 80, posturLangkah: 80, koordinasiAlat: 80 },
    status: 'dinilai',
    createdAt: 2,
    updatedAt: 2,
  },
]
const urutBrass = susunPeringkatAudisi(daftarCalon, { seksi: 'brass' })
cek(
  urutBrass.length === 2 && urutBrass[0].calon.id === 'aud_1' && urutBrass[0].pilihanKe === 1 && urutBrass[1].pilihanKe === 2,
  'susunPeringkatAudisi mengutamakan peminat ke-1 dibanding ke-2 saat skor seri',
)

const anggotaLama = [
  {
    id: 'm_1',
    code: 'BR01',
    name: 'Andi Pratama',
    section: 'brass',
    instrument: 'Trumpet',
    role: 'member',
    joinYear: 2025,
    active: 1,
    token: 'tok_1',
    instansiAsal: 'SMA Negeri 3 Yogyakarta',
    kelasJurusan: 'XI MIPA 2',
    nomorInduk: '25099',
    createdAt: 1,
  },
]
cek(
  buatKodeAnggotaBaru('brass', anggotaLama) === 'BR02',
  'buatKodeAnggotaBaru menghindari tabrakan kode anggota lama (BR01 -> BR02)',
)

const hasilPromosi = luluskanCalonKeAnggota(daftarCalon[0], anggotaLama)
cek(
  !hasilPromosi.sudahAda &&
    hasilPromosi.member.code === 'BR02' &&
    hasilPromosi.member.instansiAsal === 'SMA Negeri 3 Yogyakarta' &&
    hasilPromosi.member.nomorInduk === '26101' &&
    hasilPromosi.calonDiperbarui.status === 'diterima' &&
    hasilPromosi.calonDiperbarui.memberIdTertaut === hasilPromosi.member.id,
  'luluskanCalonKeAnggota mempromosikan calon 1-klik lengkap data sekolah & menautkan ID',
)
const promosiUlang = luluskanCalonKeAnggota(
  hasilPromosi.calonDiperbarui,
  [...anggotaLama, hasilPromosi.member],
)
cek(
  promosiUlang.sudahAda && promosiUlang.member.id === hasilPromosi.member.id,
  'luluskanCalonKeAnggota menolak duplikasi jika calon sudah aktif di roster',
)

/* ---------------- 2. #21b Dispensasi Resmi & Medis AES-256-GCM ---------------- */
const anggotaGabungan = [
  ...anggotaLama,
  hasilPromosi.member,
  {
    id: 'm_3',
    code: 'GD01',
    name: 'Citra Dewi',
    section: 'guard',
    instrument: 'Flag',
    role: 'member',
    joinYear: 2025,
    active: 1,
    token: 'tok_3',
    instansiAsal: 'Fakultas Teknik UGM',
    kelasJurusan: 'Teknik Sipil',
    nomorInduk: '491002',
    createdAt: 3,
  },
  {
    id: 'm_4',
    code: 'PC01',
    name: 'Dimas',
    section: 'percussion',
    instrument: 'Snare',
    role: 'member',
    joinYear: 2025,
    active: 1,
    token: 'tok_4',
    instansiAsal: '  sma negeri 3 yogyakarta ',
    createdAt: 4,
  },
]
const kelompokSurat = kelompokkanPesertaDispensasi(anggotaGabungan)
cek(
  kelompokSurat.length === 2 &&
    kelompokSurat.find((k) => k.namaInstansiTujuan.includes('Fakultas Teknik'))?.peserta.length === 1 &&
    kelompokSurat.find((k) => k.namaInstansiTujuan.toLowerCase().includes('sma negeri 3'))?.peserta.length === 3,
  'kelompokkanPesertaDispensasi menggabungkan variasi huruf besar/spasi instansi yang sama',
  JSON.stringify(kelompokSurat.map((k) => [k.namaInstansiTujuan, k.peserta.length])),
)
cek(
  buatNomorSuratDispensasi(5, 'GB', '2026-11-02') === '005/DISP/GB/XI/2026',
  'buatNomorSuratDispensasi menyusun penomoran resmi bulan Romawi',
)

const kartuMedis = [
  {
    id: 'm_1',
    memberId: 'm_1',
    golonganDarah: 'O+',
    alergiObat: 'Amoxicillin Rahasia',
    riwayatMedis: 'Asma ringan saat dingin',
    obatPribadi: 'Inhaler Salbutamol',
    kontakDaruratNama: 'Bapak Hendra',
    kontakDaruratHubungan: 'Ayah',
    kontakDaruratTelepon: '0811222333',
    updatedAt: 100,
  },
]
const siaga = evaluasiSiagaMedis(kartuMedis[0])
cek(
  siaga.tingkatSiaga === 'perhatian_khusus' && siaga.kontakDaruratLengkap,
  'evaluasiSiagaMedis menandai alergi/asma sebagai perhatian_khusus',
)

const arsipTerenkripsi = await eksporMedisTerenkripsi(kartuMedis, 'SandiMedis#2026', 'MB Uji')
cek(
  !arsipTerenkripsi.includes('Amoxicillin') &&
    !arsipTerenkripsi.includes('Salbutamol') &&
    !arsipTerenkripsi.includes('0811222333'),
  'eksporMedisTerenkripsi menyandikan seluruh teks rahasia medis menjadi ciphertext AES-256-GCM',
)
let sandiSalahTertolak = false
try {
  await bukaMedisTerenkripsi(arsipTerenkripsi, 'SandiSalah999')
} catch {
  sandiSalahTertolak = true
}
cek(sandiSalahTertolak, 'bukaMedisTerenkripsi menolak kata sandi yang salah (autentikasi GCM)')

const hasilDekripsi = await bukaMedisTerenkripsi(arsipTerenkripsi, 'SandiMedis#2026')
cek(
  hasilDekripsi.length === 1 &&
    hasilDekripsi[0].alergiObat === 'Amoxicillin Rahasia' &&
    hasilDekripsi[0].kontakDaruratTelepon === '0811222333',
  'bukaMedisTerenkripsi memulihkan kartu medis utuh 100% dengan kata sandi benar',
)

/* ---------------- 3. #21c Buku Kas/Iuran TC & Season Rollover ---------------- */
const daftarKas = [
  {
    id: 'kas_1',
    tanggal: '2026-11-01',
    jenis: 'iuran_anggota',
    kategoriProgram: 'Iuran TC Kejuaraan',
    targetPerAnggota: 300000,
    memberId: 'm_1',
    nominal: 300000,
    nomorKwitansi: buatNomorKwitansiKas(1, '2026-11-01'),
    metode: 'transfer',
    createdAt: 1,
    updatedAt: 1,
  },
  {
    id: 'kas_2',
    tanggal: '2026-11-02',
    jenis: 'iuran_anggota',
    kategoriProgram: 'Iuran TC Kejuaraan',
    targetPerAnggota: 300000,
    memberId: 'm_3',
    nominal: 125000,
    nomorKwitansi: buatNomorKwitansiKas(2, '2026-11-02'),
    metode: 'tunai',
    createdAt: 2,
    updatedAt: 2,
  },
  {
    id: 'kas_3',
    tanggal: '2026-11-02',
    jenis: 'pengeluaran',
    kategoriProgram: 'Konsumsi TC',
    nominal: 100000,
    nomorKwitansi: buatNomorKwitansiKas(3, '2026-11-02'),
    createdAt: 3,
    updatedAt: 3,
  },
]
const rekapKas = hitungRekapKasIuran(daftarKas)
cek(
  rekapKas.totalPemasukan === 425000 &&
    rekapKas.totalPengeluaran === 100000 &&
    rekapKas.saldoAkhir === 325000 &&
    formatRupiah(rekapKas.saldoAkhir) === 'Rp325.000',
  'hitungRekapKasIuran & formatRupiah menghitung pemasukan, pengeluaran, & saldo bersih',
)

const matriksIuran = hitungStatusIuranAnggota(anggotaGabungan, daftarKas, 'Iuran TC Kejuaraan')
const stM1 = matriksIuran.find((b) => b.member.id === 'm_1')
const stM3 = matriksIuran.find((b) => b.member.id === 'm_3')
const stM4 = matriksIuran.find((b) => b.member.id === 'm_4')
cek(
  stM1?.status === 'lunas' &&
    stM3?.status === 'cicilan' &&
    stM3?.sisaTunggakan === 175000 &&
    stM4?.status === 'belum_bayar' &&
    stM4?.sisaTunggakan === 300000,
  'hitungStatusIuranAnggota mengklasifikasikan LUNAS, CICILAN, dan BELUM BAYAR secara tepat',
)

const arsipMusim = susunArsipMusim({
  idArsip: 'musim_2026',
  namaMusim: 'Musim GPMB 2026',
  tahunMusim: '2026',
  tanggalArsip: '2026-11-02',
  catatanPenutup: 'Juara Umum 2',
  members: anggotaGabungan,
  sessions: [{ id: 's_1', title: 'TC 1', date: '2026-10-01', startTime: '08:00', endTime: '12:00', type: 'rehearsal', createdAt: 1 }],
  attendance: [
    { id: 'a_1', sessionId: 's_1', memberId: 'm_1', status: 'hadir', updatedAt: 1 },
    { id: 'a_2', sessionId: 's_1', memberId: 'm_3', status: 'izin', updatedAt: 1 },
  ],
  drills: [{ id: 'd_1', name: 'Opener Nusantara', bpm: 140, stepSize: 8, createdAt: 1, updatedAt: 1 }],
  sets: [],
  songs: [{ id: 'sg_1', title: 'Fanfare', bpm: 140, beatsPerBar: 4, totalBars: 32, createdAt: 1 }],
  setlists: [],
  kemajuan: [],
  memberNotes: [],
  evaluasi: [],
  targetSetoran: [],
  setoran: [],
  logPerubahan: [],
  countSheets: [],
  logistikLomba: [],
  penilaianLomba: [
    {
      id: 'pj_1',
      judul: 'Preview Show',
      tanggal: '2026-10-25',
      skema: 'field_show',
      captions: buatSubCaptionDariSkema('field_show').map((c) => ({
        ...c,
        nilaiKomposisi: c.maksKomposisi * 0.85,
        nilaiEksekusi: c.maksEksekusi * 0.85,
      })),
      penalti: [],
      catatanWaktu: [],
      createdAt: 1,
      updatedAt: 1,
    },
  ],
  kasIuran: daftarKas,
  audisi: daftarCalon,
})
cek(
  arsipMusim.ringkasan.jmlAnggotaAktif === 4 &&
    arsipMusim.ringkasan.rataKehadiranPersen === 50 &&
    arsipMusim.ringkasan.skorPuncakSimulasi === 85 &&
    arsipMusim.ringkasan.saldoAkhirKas === 325000,
  'susunArsipMusim membekukan statistik kehadiran, skor puncak juri, & saldo kas musim',
  JSON.stringify(arsipMusim.ringkasan),
)
cek(
  !TABEL_MUSIMAN_DIARSIPKAN.includes('members') &&
    !TABEL_MUSIMAN_DIARSIPKAN.includes('inventaris') &&
    !TABEL_MUSIMAN_DIARSIPKAN.includes('medisAnggota') &&
    !TABEL_MUSIMAN_DIARSIPKAN.includes('settings') &&
    !TABEL_MUSIMAN_DIARSIPKAN.includes('arsipMusim'),
  'TABEL_MUSIMAN_DIARSIPKAN menjamin members, inventaris, medisAnggota, settings, & arsipMusim tetap utuh saat rollover',
)

/* ---------------- 4. Keenam Cetakan HTML A4/A5 Murni #hex & Anti-XSS ---------------- */
const petaMedis = new Map(kartuMedis.map((k) => [k.memberId, k]))
const semuaHtml = [
  ['Rekap Audisi', bangunHtmlRekapAudisi({ namaTim: 'MB <script>x</script>', daftarCalon })],
  [
    'Surat Dispensasi',
    bangunHtmlSuratDispensasi({
      namaTim: 'MB Gita Buana',
      kota: 'Yogyakarta',
      perihal: 'Dispensasi TC',
      namaKegiatan: 'Kejuaraan Nasional <img src=x onerror=alert(1)>',
      tanggalMulai: '2026-11-10',
      tanggalSelesai: '2026-11-12',
      peserta: anggotaGabungan,
    }),
  ],
  ['Lembar Medis', bangunHtmlLembarMedisDarurat({ namaTim: 'MB Gita Buana', anggota: anggotaGabungan, petaMedis })],
  ['Kwitansi Kas', bangunHtmlKwitansiIuran({ namaTim: 'MB Gita Buana', transaksi: daftarKas[0], namaAnggota: 'Andi', sisaTunggakan: 0 })],
  ['Rekap Kas', bangunHtmlRekapKasIuran({ namaTim: 'MB Gita Buana', anggotaAktif: anggotaGabungan, transaksi: daftarKas })],
  ['Piagam Musim', bangunHtmlPiagamArsipMusim('MB Gita Buana', arsipMusim)],
]
for (const [label, html] of semuaHtml) {
  cek(
    !/oklch\(|color-mix\(|rgba\(/i.test(html) &&
      !html.includes('<script>x') &&
      !html.includes('<img src=x'),
    `Cetakan ${label} 100% murni #hex (tanpa oklch/color-mix/rgba) & bebas XSS`,
  )
}
cek(
  semuaHtml[1][1].includes('pisah-halaman') &&
    semuaHtml[1][1].includes('Fakultas Teknik UGM') &&
    semuaHtml[1][1].toLowerCase().includes('sma negeri 3 yogyakarta'),
  'Cetakan Surat Dispensasi membuat halaman terpisah per sekolah/fakultas tujuan',
)

/* ---------------- 5. Pusat Data, Gabung Anggota, & Pagar Privasi Keras ---------------- */
const { berkas: bersihRujukan, putus: daftarPutus } = putusRujukan(
  {
    format: 'drillkit-data',
    version: 1,
    exportedAt: 1,
    anggota: [anggotaLama[0]],
    audisi: [{ ...hasilPromosi.calonDiperbarui, memberIdTertaut: 'm_yatim' }],
    medisAnggota: [kartuMedis[0], { ...kartuMedis[0], id: 'm_yatim', memberId: 'm_yatim' }],
    kasIuran: [daftarKas[0], { ...daftarKas[1], memberId: 'm_yatim' }],
  },
  {},
)
cek(
  bersihRujukan.audisi[0].memberIdTertaut === undefined &&
    bersihRujukan.medisAnggota.length === 1 &&
    bersihRujukan.kasIuran[1].memberId === undefined &&
    daftarPutus.length === 3,
  'putusRujukan memutus tautan yatim pada audisi, medisAnggota, dan kasIuran',
)

const ringkasB = ringkasBackup(
  {
    audisi: daftarCalon,
    medisAnggota: kartuMedis,
    kasIuran: daftarKas,
    arsipMusim: [arsipMusim],
  },
  {},
)
const ringkasP = ringkasDataPindah(
  {
    audisi: daftarCalon,
    medisAnggota: kartuMedis,
    kasIuran: daftarKas,
    arsipMusim: [arsipMusim],
  },
  {},
)
cek(
  ringkasB.baris.some((x) => x.label.toLowerCase().includes('audisi')) &&
    ringkasB.baris.some((x) => x.label.toLowerCase().includes('medis')) &&
    ringkasP.baris.some((x) => x.label.toLowerCase().includes('kas')) &&
    ringkasP.baris.some((x) => x.label.toLowerCase().includes('arsip')),
  'ringkasBackup & ringkasDataPindah mengenali keempat store baru #21',
)

const rencanaGabung = rencanakanGabung({
  simpan: { ...anggotaLama[0], instansiAsal: undefined },
  buang: { ...anggotaGabungan[2], id: 'm_duplikat' },
  absensi: [],
  evaluasi: [],
  catatan: [],
  sets: [],
  drills: [],
  riwayat: [],
  kemajuan: [],
  audisi: [{ ...daftarCalon[0], memberIdTertaut: 'm_duplikat' }],
  medisAnggota: [{ ...kartuMedis[0], id: 'm_duplikat', memberId: 'm_duplikat' }],
  kasIuran: [{ ...daftarKas[1], memberId: 'm_duplikat' }],
})
cek(
  rencanaGabung?.simpan.instansiAsal === 'Fakultas Teknik UGM' &&
    rencanaGabung?.audisi?.[0]?.memberIdTertaut === 'm_1' &&
    rencanaGabung?.kasIuran?.[0]?.memberId === 'm_1' &&
    rencanaGabung?.medisAnggota?.[0]?.id === 'm_1' &&
    rencanaGabung?.medisAnggotaHapus?.includes('m_duplikat'),
  'rencanakanGabung memindahkan instansiAsal, audisi, kasIuran, & medisAnggota (serta menghapus kunci medis lama)',
)

// Pagar privasi keras: medis, audisi, kas, arsip musim, & asal sekolah/NIS TIDAK BOLEH bocor!
const mBersih = bersihkanAnggota(anggotaLama[0])
cek(
  mBersih.instansiAsal === undefined &&
    mBersih.kelasJurusan === undefined &&
    mBersih.nomorInduk === undefined &&
    mBersih.token === '',
  'bersihkanAnggota mengupas instansiAsal, kelasJurusan, nomorInduk, & token pribadi',
)

const calonBelumLulus = {
  ...daftarCalon[1],
  nama: 'Calon Belum Lulus Rahasia',
  catatanPenguji: 'Catatan Penguji Audisi Rahasia',
}
const sumberPenuhRahasia = {
  teamName: 'MB Uji Privasi',
  members: anggotaGabungan,
  sessions: [],
  attendance: [],
  drills: [],
  sets: [],
  songs: [],
  setlists: [],
  memberNotes: [],
  targetSetoran: [],
  setoran: [],
  countSheets: [],
  inventaris: [],
  logistikLomba: [],
  audisi: [calonBelumLulus],
  medisAnggota: kartuMedis,
  kasIuran: daftarKas,
  arsipMusim: [arsipMusim],
}
const bGrup = JSON.stringify(paketGrup(sumberPenuhRahasia))
const bAnak = JSON.stringify(paketAnggota(sumberPenuhRahasia, 'm_1'))
const bTerbit = JSON.stringify(await siapTerbit(sumberPenuhRahasia))
const bKupas = kupasDataKhususStaf({ ...JSON.parse(bGrup), medisAnggota: kartuMedis, kasIuran: daftarKas, audisi: [calonBelumLulus], arsipMusim: [arsipMusim] })

cek(
  !bGrup.includes('Amoxicillin') &&
    !bGrup.includes('SMA Negeri 3') &&
    !bGrup.includes('Iuran TC Kejuaraan') &&
    !bGrup.includes('Calon Belum Lulus Rahasia') &&
    !bGrup.includes('Catatan Penguji Audisi Rahasia') &&
    !bAnak.includes('Amoxicillin') &&
    !bAnak.includes('25099') &&
    !bTerbit.includes('Amoxicillin') &&
    !bTerbit.includes('Iuran TC Kejuaraan') &&
    !bTerbit.includes('Calon Belum Lulus Rahasia') &&
    !('medisAnggota' in bKupas) &&
    !('kasIuran' in bKupas) &&
    !('audisi' in bKupas) &&
    !('arsipMusim' in bKupas),
  'PAGAR PRIVASI KERAS: paketGrup, paketAnggota, siapTerbit, & kupasDataKhususStaf bebas 100% dari medis, audisi, kas, arsip musim, & NIS/sekolah',
)

console.log(`\nadministrasi-unit-logika: ${lulus} lulus, ${gagal} gagal`)
process.exit(gagal > 0 ? 1 : 0)
