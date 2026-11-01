/**
 * Rangkaian uji logika murni #18 — Manajemen Inventaris Alat, Seragam (Uniform Fitting),
 * & Manifes Logistik Hari Lomba 3-Tahap (`v1.2.2`).
 *
 * Menguji:
 *  1. Kode aset otomatis, ringkasan inventaris, biaya perawatan, & wajib lomba
 *  2. Ringkasan fitting/distribusi seragam, penggabungan profil ukuran aman, & CSV satu arah
 *  3. Pagar privasi keras (`paketGrup`, `paketAnggota`, `susunTerkunci`/`bukaTerkunci`,
 *     `gabungPembaruan`, `bersihkanAnggotaSeksi`)
 *  4. Manifes logistik hari lomba 3-tahap: tarik dari inventaris, deteksi barang belum kembali
 *     merah otomatis (`belum_kembali_merah`), & keutuhan rujukan `pindah.ts` + `namaAnggota.ts`
 *  5. Keempat pembangun cetak A4 (`Berita Acara`, `Buku Induk`, `Seragam`, `Manifes`) 100%
 *     memakai `#hex` murni (`0` `oklch()` / `0` `color-mix()`) dan meng-escape XSS
 */
import {
  buatKodeAsetOtomatis,
  eksporCsvUkuranSeragam,
  gabungProfilUkuranSeragam,
  ringkasInventaris,
  ringkasManifesLogistik,
  ringkasSeragamTim,
  statusBarisManifes,
  susunButirManifesDariInventaris,
  susunPetaPerlengkapanPerAnggota,
} from '/tmp/inventarisLogistik.mjs'
import {
  bangunHtmlBeritaAcaraPinjam,
  bangunHtmlBukuInventaris,
  bangunHtmlDistribusiSeragam,
  bangunHtmlManifesLogistik,
} from '/tmp/inventarisLogistikCetak.mjs'
import { paketAnggota, paketGrup } from '/tmp/bagikan.mjs'
import { bukaTerkunci, gabungPembaruan, susunTerkunci } from '/tmp/terbit.mjs'
import { buatKunci } from '/tmp/kunci.mjs'
import { bersihkanAnggotaSeksi } from '/tmp/kolaborasiSeksi.mjs'
import { putusRujukan } from '/tmp/pindah.mjs'
import { catatanCsvSatuArah, kenaliBerkas } from '/tmp/bukaBerkas.mjs'
import {
  rencanakanGabung,
  terapkanCocok,
  tulisUlangInventaris,
  tulisUlangLogistikLomba,
} from '/tmp/namaAnggota.mjs'

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

/* --------------------- 1. Buku Induk Inventaris --------------------- */
const members = [
  {
    id: 'm1',
    code: 'B01',
    name: 'Raka Pratama',
    section: 'brass',
    instrument: 'Trumpet',
    role: 'sectionLeader',
    joinYear: 2025,
    phone: '0811111111',
    active: 1,
    notes: 'Catatan rahasia pelatih 1',
    token: 'tok-rahasia-1',
    createdAt: 1000,
    ukuranSeragam: {
      sepatu: '42',
      jaketTunic: 'L',
      lingkarDadaCm: 98,
      bibber: 'L',
      panjangCelanaCm: 101,
      shakoTopi: '58 cm',
      nomorSeriSeragam: 'SRG-001',
      statusPinjam: 'dipinjam',
      tanggalAmbil: '2026-10-20',
    },
  },
  {
    id: 'm2',
    code: 'G01',
    name: 'Nadia Putri',
    section: 'colorGuard',
    instrument: 'Flag',
    role: 'member',
    joinYear: 2026,
    phone: '0822222222',
    active: 1,
    notes: 'Catatan rahasia pelatih 2',
    token: 'tok-rahasia-2',
    createdAt: 1001,
    ukuranSeragam: {
      sepatu: '38',
      kostumGuard: 'Custom M',
      nomorSeriSeragam: 'SRG-022',
      statusPinjam: 'dicuci',
      sudahDicuci: 1,
    },
  },
  {
    id: 'm3',
    code: 'D01',
    name: 'Bima Sakti',
    section: 'battery',
    instrument: 'Snare',
    role: 'member',
    joinYear: 2026,
    active: 1,
    token: 'tok-3',
    createdAt: 1002,
  },
]

const asetAwal = [
  {
    id: 'inv1',
    kodeAset: 'BRS-01',
    nomorSeri: 'YTR-99881',
    nama: 'Trumpet Bb Utama',
    kategori: 'brass',
    merekTipe: 'Yamaha Xeno YTR-8335',
    kondisi: 'siap_pakai',
    pemegangId: 'm1',
    tanggalPinjam: '2026-10-01',
    kelengkapanPinjam: 'Hardcase + Mouthpiece Bach 3C',
    wajibBawaLomba: 1,
    catatan: 'Catatan gudang internal tidak boleh bocor',
    riwayatServis: [
      { id: 's1', tanggal: '2026-09-15', jenis: 'Cuci kimia & pelumasan valve', biaya: 175000 },
    ],
    createdAt: 100,
    updatedAt: 200,
  },
  {
    id: 'inv2',
    kodeAset: 'GRD-01',
    nomorSeri: 'RFL-39',
    nama: 'Rifle 39 Inci Putih',
    kategori: 'guard',
    merekTipe: 'DSI Elite',
    kondisi: 'perlu_servis',
    pemegangId: 'm2',
    wajibBawaLomba: 1,
    riwayatServis: [
      { id: 's2', tanggal: '2026-10-10', jenis: 'Ganti baut strap', biaya: 45000 },
    ],
    createdAt: 100,
    updatedAt: 200,
  },
  {
    id: 'inv3',
    kodeAset: 'PIT-01',
    nama: 'Marimba 4.3 Octave',
    kategori: 'pit',
    kondisi: 'rusak',
    lokasiSimpan: 'Gudang Pit',
    wajibBawaLomba: 1,
    riwayatServis: [],
    createdAt: 100,
    updatedAt: 200,
  },
]

uji('buatKodeAsetOtomatis melanjutkan penomoran kategori', buatKodeAsetOtomatis('brass', asetAwal) === 'BRS-02')
const rInv = ringkasInventaris(asetAwal)
uji(
  'ringkasInventaris menghitung kondisi, peminjaman, & biaya servis akurat',
  rInv.total === 3 &&
    rInv.siapPakai === 1 &&
    rInv.perluServis === 1 &&
    rInv.rusak === 1 &&
    rInv.sedangDipinjam === 2 &&
    rInv.diGudang === 1 &&
    rInv.totalBiayaServis === 220000,
)

/* --------------------- 2. Seragam & CSV Satu Arah --------------------- */
const rSrg = ringkasSeragamTim(members)
uji(
  'ringkasSeragamTim menghitung fitting, sedang dipinjam, & sudah dicuci',
  rSrg.totalAnggotaAktif === 3 &&
    rSrg.sudahFitting === 2 &&
    rSrg.belumFitting === 1 &&
    rSrg.sedangDipinjam === 1 &&
    rSrg.sudahDicuci === 1,
)

const csvSrg = eksporCsvUkuranSeragam(members, (s) => s)
uji('eksporCsvUkuranSeragam memuat header & nomor seri seragam', csvSrg.includes('No. Seri Seragam') && csvSrg.includes('SRG-001'))
uji('catatanCsvSatuArah mengenali CSV ukuran seragam sebagai laporan satu arah', Boolean(catatanCsvSatuArah(csvSrg)))
const kenalCsvSrg = kenaliBerkas('ukuran-seragam.csv', new TextEncoder().encode(csvSrg))
uji('kenaliBerkas tidak salah mengimpor CSV ukuran seragam sebagai CSV anggota', kenalCsvSrg.jenis !== 'csv-anggota')

/* --------------------- 3. Pagar Privasi Paket & Enkripsi --------------------- */
const petaPerlengkapan = susunPetaPerlengkapanPerAnggota(members, asetAwal)
const masterBundle = {
  format: 'drillkit-share',
  version: 1,
  exportedAt: Date.now(),
  team: { teamName: 'MB Gita Nusantara', memberMode: 1 },
  members,
  sessions: [],
  drills: [],
  sets: [],
  songs: [],
  attendance: [],
  memberNotes: [],
  perlengkapanPerAnggota: petaPerlengkapan,
  mode: 'member',
}

const grup = paketGrup(masterBundle)
const teksGrup = JSON.stringify(grup)
uji(
  'paketGrup mengupas bersih ukuranSeragam, perlengkapanPribadi, & catatan gudang',
  grup.perlengkapanPribadi === undefined &&
    grup.perlengkapanPerAnggota === undefined &&
    grup.members.every((m) => m.ukuranSeragam === undefined && !m.phone && !m.notes && !m.token) &&
    !teksGrup.includes('SRG-001') &&
    !teksGrup.includes('YTR-99881') &&
    !teksGrup.includes('Catatan gudang'),
)

const pktM1 = paketAnggota(masterBundle, 'm1')
const teksM1 = JSON.stringify(pktM1)
uji(
  'paketAnggota(m1) hanya menyertakan alat & ukuran seragam m1 (tanpa bocoran m2 atau biaya servis)',
  pktM1.forMember === 'm1' &&
    pktM1.perlengkapanPerAnggota === undefined &&
    pktM1.perlengkapanPribadi?.memberId === 'm1' &&
    pktM1.perlengkapanPribadi?.alatDipinjam.length === 1 &&
    pktM1.perlengkapanPribadi?.alatDipinjam[0].kodeAset === 'BRS-01' &&
    pktM1.perlengkapanPribadi?.ukuranSeragam?.nomorSeriSeragam === 'SRG-001' &&
    pktM1.members.every((m) => m.ukuranSeragam === undefined) &&
    !teksM1.includes('SRG-022') &&
    !teksM1.includes('RFL-39') &&
    !teksM1.includes('175000') &&
    !teksM1.includes('Catatan gudang'),
)

const pktAsing = paketAnggota(masterBundle, 'anggota-tidak-dikenal')
uji(
  'paketAnggota untuk memberId tak dikenal menghasilkan perlengkapanPribadi kosong',
  pktAsing.perlengkapanPribadi === undefined,
)

// Enkripsi AES-256-GCM (#2) & gabungPembaruan
const kunciM1 = await buatKunci()
const kunciM2 = await buatKunci()
const { terkunci } = await susunTerkunci(masterBundle, { m1: kunciM1, m2: kunciM2 })
const hasilDekripsiM1 = await bukaTerkunci(terkunci.m1, kunciM1)
const gagalKunciSalah = await bukaTerkunci(terkunci.m1, kunciM2)
uji(
  'susunTerkunci + bukaTerkunci mengenkripsi perlengkapanPribadi per anggota & menolak kunci rekan lain',
  hasilDekripsiM1?.perlengkapanPribadi?.ukuranSeragam?.nomorSeriSeragam === 'SRG-001' &&
    hasilDekripsiM1?.perlengkapanPribadi?.alatDipinjam[0]?.kodeAset === 'BRS-01' &&
    gagalKunciSalah === null,
)

const setelahPerbaruiGrup = gabungPembaruan({ ...grup, exportedAt: Date.now() + 5000 }, pktM1)
uji(
  'gabungPembaruan mempertahankan perlengkapanPribadi milik anggota saat menarik paket grup baru',
  setelahPerbaruiGrup.perlengkapanPribadi?.ukuranSeragam?.nomorSeriSeragam === 'SRG-001' &&
    setelahPerbaruiGrup.perlengkapanPribadi?.alatDipinjam[0]?.kodeAset === 'BRS-01',
)

// Kolaborasi asisten seksi (#15a) tidak membocorkan ukuranSeragam & tidak menghapus ukuran lokal saat digabung
const anggotaSeksiBersih = members
  .filter((m) => m.section === 'brass')
  .map(bersihkanAnggotaSeksi)
uji(
  'bersihkanAnggotaSeksi mengupas ukuranSeragam dari daftar anggota seksi',
  anggotaSeksiBersih.every((m) => m.ukuranSeragam === undefined && !m.phone && !m.notes),
)
const hasilCocokSeksi = terapkanCocok({
  lokal: members,
  masuk: anggotaSeksiBersih,
  keputusan: { m1: { jenis: 'sama', idLokal: 'm1' } },
  arah: 'lokal',
  timpaSamaId: true,
})
uji(
  'terapkanCocok(timpaSamaId:true) tidak menghapus ukuranSeragam lokal saat berkas asisten seksi masuk',
  hasilCocokSeksi.anggotaTulis.find((m) => m.id === 'm1')?.ukuranSeragam?.nomorSeriSeragam === 'SRG-001',
)
uji(
  'gabungProfilUkuranSeragam melengkapi kolom kosong dari profil kedua',
  gabungProfilUkuranSeragam({ sepatu: '42' }, { sepatu: '40', shakoTopi: '58 cm' })?.shakoTopi === '58 cm',
)

/* --------------------- 4. Manifes Truk 3-Tahap & Rujukan --------------------- */
const butirTarik = susunButirManifesDariInventaris({
  inventaris: asetAwal,
  sertakanStandarUmum: true,
})
uji(
  'susunButirManifesDariInventaris menarik aset wajib lomba non-rusak (BRS-01 & GRD-01, mengecualikan PIT-01 rusak) + perlengkapan standar',
  butirTarik.some((b) => b.kodeAset === 'BRS-01') &&
    butirTarik.some((b) => b.kodeAset === 'GRD-01') &&
    !butirTarik.some((b) => b.kodeAset === 'PIT-01') &&
    butirTarik.length >= 7,
)

const manifesUji = {
  id: 'mnf1',
  judul: 'GPMB Hari Final',
  tanggal: '2026-11-15',
  tahapAktif: 'berangkat',
  butir: [
    {
      id: 'b1',
      inventarisId: 'inv1',
      kodeAset: 'BRS-01',
      nama: 'Trumpet Bb Utama',
      kategori: 'brass',
      jumlah: 1,
      penanggungJawabId: 'm1',
      muatBerangkat: 1,
      cekLokasi: 1,
      kembaliGudang: 1,
    },
    {
      id: 'b2',
      inventarisId: 'inv2',
      kodeAset: 'GRD-01',
      nama: 'Rifle 39 Inci Putih',
      kategori: 'guard',
      jumlah: 1,
      penanggungJawabId: 'm2',
      muatBerangkat: 1,
      cekLokasi: 1,
      kembaliGudang: 0,
    },
  ],
  createdAt: 100,
  updatedAt: 200,
}
const rManifes = ringkasManifesLogistik(manifesUji)
uji(
  'ringkasManifesLogistik otomatis menandai merah barang yang belum kembali saat sebagian barang sudah masuk gudang',
  rManifes.sudahBerangkat === 2 &&
    rManifes.sudahCekLokasi === 2 &&
    rManifes.sudahKembaliGudang === 1 &&
    rManifes.belumKembaliMerah.length === 1 &&
    rManifes.belumKembaliMerah[0].kodeAset === 'GRD-01' &&
    statusBarisManifes(manifesUji.butir[1], 'pulang', false) === 'belum_kembali_merah',
)

// putusRujukan (`pindah.ts`) & tulisUlang (`namaAnggota.ts`)
const { berkas: hasilPutus, putus: daftarPutus } = putusRujukan(
  {
    format: 'drillkit-data',
    versi: 1,
    dibuat: Date.now(),
    inventaris: [{ ...asetAwal[0], pemegangId: 'id-hilang' }],
    logistikLomba: [
      {
        ...manifesUji,
        sessionId: 'sesi-hilang',
        butir: [
          {
            ...manifesUji.butir[0],
            inventarisId: 'inv-hilang',
            penanggungJawabId: 'id-hilang',
          },
        ],
      },
    ],
  },
  {
    anggota: ['m1'],
    jadwal: [],
    inventaris: [],
  },
)
uji(
  'putusRujukan membersihkan pemegangId, sessionId, inventarisId, & penanggungJawabId yatim',
  hasilPutus.inventaris[0].pemegangId === undefined &&
    hasilPutus.logistikLomba[0].sessionId === undefined &&
    hasilPutus.logistikLomba[0].butir[0].inventarisId === undefined &&
    hasilPutus.logistikLomba[0].butir[0].penanggungJawabId === undefined &&
    daftarPutus.length === 4,
)

const invTulisUlang = asetAwal.map((it) => tulisUlangInventaris(it, { m2: 'm1' }))
const mnfTulisUlang = [manifesUji].map((mf) => tulisUlangLogistikLomba(mf, { m2: 'm1' }))
const rencanaGabung = rencanakanGabung({
  simpan: members[0],
  buang: members[1],
  absensi: [],
  evaluasi: [],
  setoran: [],
  catatan: [],
  sets: [],
  drills: [],
  riwayat: [],
  kemajuan: [],
  inventaris: asetAwal,
  logistikLomba: [manifesUji],
})
uji(
  'penggabungan dua kartu anggota memindahkan pemegangId inventaris, penanggungJawabId manifes, & melengkapi ukuranSeragam',
  invTulisUlang.find((x) => x.id === 'inv2')?.pemegangId === 'm1' &&
    mnfTulisUlang[0].butir[1].penanggungJawabId === 'm1' &&
    rencanaGabung.simpan.ukuranSeragam?.kostumGuard === 'Custom M' &&
    rencanaGabung.inventaris?.some((x) => x.id === 'inv2' && x.pemegangId === 'm1'),
)

/* --------------------- 5. Cetak A4 #HEX Murni & Anti-XSS --------------------- */
const htmlBA = bangunHtmlBeritaAcaraPinjam({
  namaTim: 'MB Uji <script>alert(1)</script>',
  namaPelatih: 'Kak Andi',
  kota: 'Yogyakarta',
  inventaris: asetAwal,
  members,
})
const htmlBuku = bangunHtmlBukuInventaris({
  namaTim: 'MB Uji',
  inventaris: asetAwal,
  members,
})
const htmlSeragam = bangunHtmlDistribusiSeragam({
  namaTim: 'MB Uji',
  members,
})
const htmlManifes = bangunHtmlManifesLogistik({
  namaTim: 'MB Uji',
  manifes: manifesUji,
  members,
})

for (const [label, html] of [
  ['Berita Acara Peminjaman', htmlBA],
  ['Buku Induk Inventaris', htmlBuku],
  ['Distribusi Seragam', htmlSeragam],
  ['Manifes Logistik Lomba', htmlManifes],
]) {
  const bebasWarnaModern = !/oklch\s*\(|color-mix\s*\(/i.test(html)
  uji(`cetak A4 ${label} 100% memakai #hex/rgb murni (0 oklch/color-mix)`, bebasWarnaModern)
}
uji(
  'Berita Acara meng-escape XSS & menampilkan nomor seri serta klausul tanda tangan',
  !htmlBA.includes('<script>alert(1)</script>') &&
    htmlBA.includes('YTR-99881') &&
    htmlBA.includes('Yang Menerima (Pihak Kedua)'),
)
uji(
  'Cetak Manifes menampilkan peringatan merah barang yang belum kembali ke gudang',
  htmlManifes.includes('BELUM KEMBALI KE GUDANG') && htmlManifes.includes('Rifle 39 Inci Putih'),
)

console.log(`\n${lulus} lulus, ${gagal} gagal`)
process.exit(gagal ? 1 : 0)
