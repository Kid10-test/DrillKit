/**
 * #18 — Mesin murni Manajemen Inventaris Alat, Ukuran & Distribusi Seragam
 * (*Uniform Fitting*), serta Manifes Logistik Hari Lomba 3-Tahap (`v1.2.2`).
 *
 * Seluruh fungsi di berkas ini murni (tanpa Dexie, React, atau DOM) sehingga
 * dapat diuji langsung di Node (`qa/inventaris-logistik-logika.mjs`) dan seluruh
 * pembangun HTML cetaknya dijamin 100% memakai warna `#hex` murni
 * (`0` `oklch()` / `color-mix()`).
 */
import type {
  ButirManifesLogistik,
  ItemInventaris,
  KategoriInventaris,
  KondisiInventaris,
  ManifesLogistikLomba,
  Member,
  PerlengkapanPribadiAnggota,
  PinjamanAlatAnggota,
  ProfilUkuranSeragam,
  StatusPinjamSeragam,
} from '../db/types'
import { toCSV, uid } from './utils'

/* ------------------------- Konstanta & Label ------------------------------ */

export const DAFTAR_KATEGORI_INVENTARIS: KategoriInventaris[] = [
  'brass',
  'woodwind',
  'battery',
  'pit',
  'elektronik',
  'guard',
  'podium_properti',
  'seragam_aksesoris',
  'lainnya',
]

export const LABEL_KATEGORI_INVENTARIS: Record<KategoriInventaris, string> = {
  brass: 'Brass (Tiup Logam)',
  woodwind: 'Woodwind (Tiup Kayu)',
  battery: 'Battery (Perkusi Jalan)',
  pit: 'Pit / Front Ensemble',
  elektronik: 'Elektronik & Sound System',
  guard: 'Color Guard (Flag/Rifle/Sabre)',
  podium_properti: 'Podium & Properti Panggung',
  seragam_aksesoris: 'Seragam, Shako, & Aksesoris',
  lainnya: 'Perlengkapan Umum & Logistik',
}

export const LABEL_PENDEK_KATEGORI: Record<KategoriInventaris, string> = {
  brass: 'Brass',
  woodwind: 'Woodwind',
  battery: 'Battery',
  pit: 'Pit',
  elektronik: 'Sound',
  guard: 'Guard',
  podium_properti: 'Podium/Prop',
  seragam_aksesoris: 'Seragam',
  lainnya: 'Umum',
}

export const DAFTAR_KONDISI_INVENTARIS: KondisiInventaris[] = [
  'siap_pakai',
  'perlu_servis',
  'rusak',
]

export const LABEL_KONDISI_INVENTARIS: Record<KondisiInventaris, string> = {
  siap_pakai: 'Siap Pakai',
  perlu_servis: 'Perlu Servis',
  rusak: 'Rusak / Karantina',
}

export const WARNA_KONDISI_HEX: Record<
  KondisiInventaris,
  { latar: string; garis: string; teks: string }
> = {
  siap_pakai: { latar: '#ecfdf5', garis: '#6ee7b7', teks: '#065f46' },
  perlu_servis: { latar: '#fffbeb', garis: '#fcd34d', teks: '#92400e' },
  rusak: { latar: '#fef2f2', garis: '#fca5a5', teks: '#991b1b' },
}

export const DAFTAR_STATUS_SERAGAM: StatusPinjamSeragam[] = [
  'belum',
  'dipinjam',
  'dikembalikan',
  'dicuci',
]

export const LABEL_STATUS_SERAGAM: Record<StatusPinjamSeragam, string> = {
  belum: 'Belum Dibagikan',
  dipinjam: 'Sedang Dipinjam',
  dikembalikan: 'Sudah Kembali (Belum Cuci)',
  dicuci: 'Kembali & Sudah Dicuci',
}

export const WARNA_STATUS_SERAGAM_HEX: Record<
  StatusPinjamSeragam,
  { latar: string; garis: string; teks: string }
> = {
  belum: { latar: '#f8fafc', garis: '#cbd5e1', teks: '#475569' },
  dipinjam: { latar: '#fffbeb', garis: '#fcd34d', teks: '#92400e' },
  dikembalikan: { latar: '#eff6ff', garis: '#93c5fd', teks: '#1e40af' },
  dicuci: { latar: '#ecfdf5', garis: '#6ee7b7', teks: '#065f46' },
}

/* --------------------- Ringkasan Buku Induk Inventaris -------------------- */

export interface RingkasanInventaris {
  total: number
  siapPakai: number
  perluServis: number
  rusak: number
  sedangDipinjam: number
  diGudang: number
  wajibLomba: number
  totalBiayaServis: number
  perKategori: Record<KategoriInventaris, number>
}

export function ringkasInventaris(daftar: ItemInventaris[]): RingkasanInventaris {
  const perKategori: Record<KategoriInventaris, number> = {
    brass: 0,
    woodwind: 0,
    battery: 0,
    pit: 0,
    elektronik: 0,
    guard: 0,
    podium_properti: 0,
    seragam_aksesoris: 0,
    lainnya: 0,
  }
  let siapPakai = 0
  let perluServis = 0
  let rusak = 0
  let sedangDipinjam = 0
  let wajibLomba = 0
  let totalBiayaServis = 0

  for (const it of daftar) {
    perKategori[it.kategori] = (perKategori[it.kategori] ?? 0) + 1
    if (it.kondisi === 'siap_pakai') siapPakai += 1
    else if (it.kondisi === 'perlu_servis') perluServis += 1
    else if (it.kondisi === 'rusak') rusak += 1
    if (it.pemegangId?.trim()) sedangDipinjam += 1
    if (it.wajibBawaLomba === 1) wajibLomba += 1
    for (const sv of it.riwayatServis ?? []) {
      if (typeof sv.biaya === 'number' && Number.isFinite(sv.biaya) && sv.biaya > 0) {
        totalBiayaServis += sv.biaya
      }
    }
  }

  return {
    total: daftar.length,
    siapPakai,
    perluServis,
    rusak,
    sedangDipinjam,
    diGudang: Math.max(0, daftar.length - sedangDipinjam),
    wajibLomba,
    totalBiayaServis,
    perKategori,
  }
}

export function buatKodeAsetOtomatis(
  kategori: KategoriInventaris,
  daftarAda: Pick<ItemInventaris, 'kodeAset'>[],
): string {
  const awalanPeta: Record<KategoriInventaris, string> = {
    brass: 'BRS',
    woodwind: 'WWD',
    battery: 'BAT',
    pit: 'PIT',
    elektronik: 'SND',
    guard: 'GRD',
    podium_properti: 'PRP',
    seragam_aksesoris: 'SRG',
    lainnya: 'LOG',
  }
  const awalan = awalanPeta[kategori] ?? 'INV'
  const terpakai = new Set(daftarAda.map((x) => (x.kodeAset || '').trim().toUpperCase()))
  let n = 1
  let kandidat = `${awalan}-${String(n).padStart(2, '0')}`
  while (terpakai.has(kandidat)) {
    n += 1
    kandidat = `${awalan}-${String(n).padStart(2, '0')}`
  }
  return kandidat
}

/* ------------------ Ukuran & Distribusi Seragam (Fitting) ----------------- */

export function apakahUkuranSeragamTerisi(u?: ProfilUkuranSeragam | null): boolean {
  if (!u) return false
  return Boolean(
    u.sepatu?.trim() ||
      u.bibber?.trim() ||
      u.jaketTunic?.trim() ||
      u.shakoTopi?.trim() ||
      u.sarungTangan?.trim() ||
      u.kostumGuard?.trim() ||
      u.nomorSeriSeragam?.trim() ||
      u.nomorShako?.trim() ||
      (typeof u.panjangCelanaCm === 'number' && u.panjangCelanaCm > 0) ||
      (typeof u.lingkarDadaCm === 'number' && u.lingkarDadaCm > 0) ||
      (u.statusPinjam && u.statusPinjam !== 'belum'),
  )
}

/**
 * Gabungkan profil ukuran seragam saat dua anggota ganda digabung (`namaAnggota.ts`).
 * Nilai pada `simpan` diutamakan; kolom yang kosong diisi dari `buang`.
 */
export function gabungProfilUkuranSeragam(
  simpan?: ProfilUkuranSeragam,
  buang?: ProfilUkuranSeragam,
): ProfilUkuranSeragam | undefined {
  if (!simpan && !buang) return undefined
  if (!buang) return simpan ? { ...simpan } : undefined
  if (!simpan) return { ...buang }
  return {
    sepatu: simpan.sepatu?.trim() || buang.sepatu?.trim() || undefined,
    bibber: simpan.bibber?.trim() || buang.bibber?.trim() || undefined,
    panjangCelanaCm: simpan.panjangCelanaCm ?? buang.panjangCelanaCm,
    jaketTunic: simpan.jaketTunic?.trim() || buang.jaketTunic?.trim() || undefined,
    lingkarDadaCm: simpan.lingkarDadaCm ?? buang.lingkarDadaCm,
    shakoTopi: simpan.shakoTopi?.trim() || buang.shakoTopi?.trim() || undefined,
    sarungTangan: simpan.sarungTangan?.trim() || buang.sarungTangan?.trim() || undefined,
    kostumGuard: simpan.kostumGuard?.trim() || buang.kostumGuard?.trim() || undefined,
    nomorSeriSeragam: simpan.nomorSeriSeragam?.trim() || buang.nomorSeriSeragam?.trim() || undefined,
    nomorShako: simpan.nomorShako?.trim() || buang.nomorShako?.trim() || undefined,
    statusPinjam:
      simpan.statusPinjam && simpan.statusPinjam !== 'belum'
        ? simpan.statusPinjam
        : buang.statusPinjam,
    tanggalAmbil: simpan.tanggalAmbil || buang.tanggalAmbil,
    tanggalKembali: simpan.tanggalKembali || buang.tanggalKembali,
    sudahDicuci: simpan.sudahDicuci ?? buang.sudahDicuci,
    catatanFitting: simpan.catatanFitting?.trim() || buang.catatanFitting?.trim() || undefined,
  }
}

export interface RingkasanSeragamTim {
  totalAnggotaAktif: number
  sudahFitting: number
  belumFitting: number
  sedangDipinjam: number
  sudahKembaliBelumCuci: number
  sudahDicuci: number
}

export function ringkasSeragamTim(members: Member[]): RingkasanSeragamTim {
  const aktif = members.filter((m) => m.active === 1)
  let sudahFitting = 0
  let sedangDipinjam = 0
  let sudahKembaliBelumCuci = 0
  let sudahDicuci = 0

  for (const m of aktif) {
    const u = m.ukuranSeragam
    if (
      u &&
      Boolean(
        u.sepatu?.trim() ||
          u.bibber?.trim() ||
          u.jaketTunic?.trim() ||
          u.shakoTopi?.trim() ||
          u.kostumGuard?.trim(),
      )
    ) {
      sudahFitting += 1
    }
    const st = u?.statusPinjam ?? 'belum'
    if (st === 'dipinjam') sedangDipinjam += 1
    else if (st === 'dikembalikan') {
      if (u?.sudahDicuci === 1) sudahDicuci += 1
      else sudahKembaliBelumCuci += 1
    } else if (st === 'dicuci') {
      sudahDicuci += 1
    }
  }

  return {
    totalAnggotaAktif: aktif.length,
    sudahFitting,
    belumFitting: Math.max(0, aktif.length - sudahFitting),
    sedangDipinjam,
    sudahKembaliBelumCuci,
    sudahDicuci,
  }
}

export const JUDUL_CSV_SERAGAM = [
  'Kode',
  'Nama',
  'Section',
  'Instrumen',
  'Sepatu',
  'Jaket / Tunic',
  'Lingkar Dada (cm)',
  'Bibber / Celana',
  'Panjang Celana (cm)',
  'Shako / Topi',
  'Sarung Tangan',
  'Kostum Guard',
  'No. Seri Seragam',
  'No. Shako',
  'Status Seragam',
  'Catatan Fitting',
]

export function eksporCsvUkuranSeragam(
  members: Member[],
  labelSeksi: (seksi: string) => string = (s) => s,
): string {
  const aktif = [...members]
    .filter((m) => m.active === 1)
    .sort((a, b) => a.section.localeCompare(b.section) || a.code.localeCompare(b.code))
  const baris: unknown[][] = [JUDUL_CSV_SERAGAM]
  for (const m of aktif) {
    const u = m.ukuranSeragam
    baris.push([
      m.code,
      m.name,
      labelSeksi(m.section),
      m.instrument,
      u?.sepatu ?? '',
      u?.jaketTunic ?? '',
      u?.lingkarDadaCm ?? '',
      u?.bibber ?? '',
      u?.panjangCelanaCm ?? '',
      u?.shakoTopi ?? '',
      u?.sarungTangan ?? '',
      u?.kostumGuard ?? '',
      u?.nomorSeriSeragam ?? '',
      u?.nomorShako ?? '',
      LABEL_STATUS_SERAGAM[u?.statusPinjam ?? 'belum'],
      u?.catatanFitting ?? '',
    ])
  }
  return toCSV(baris)
}

/* --------------- Pagar Privasi Paket Anggota (#18 §5) --------------------- */

/**
 * Rakit informasi alat & ukuran seragam **hanya untuk satu anggota penerima**.
 * Tidak pernah menyertakan riwayat biaya servis internal, catatan gudang,
 * ataupun aset milik anggota lain.
 */
export function susunPerlengkapanPribadiAnggota(
  member: Member,
  daftarInventaris: ItemInventaris[],
): PerlengkapanPribadiAnggota | undefined {
  const alatMilik: PinjamanAlatAnggota[] = daftarInventaris
    .filter((it) => it.pemegangId === member.id)
    .sort((a, b) => a.kodeAset.localeCompare(b.kodeAset))
    .map((it) => ({
      id: it.id,
      kodeAset: it.kodeAset,
      nama: it.nama,
      kategori: it.kategori,
      merekTipe: it.merekTipe,
      nomorSeri: it.nomorSeri,
      kondisi: it.kondisi,
      tanggalPinjam: it.tanggalPinjam,
      targetKembali: it.targetKembali,
      kelengkapanPinjam: it.kelengkapanPinjam,
    }))

  const adaSeragam = apakahUkuranSeragamTerisi(member.ukuranSeragam)
  if (!adaSeragam && alatMilik.length === 0) return undefined

  return {
    memberId: member.id,
    ukuranSeragam: adaSeragam && member.ukuranSeragam ? { ...member.ukuranSeragam } : undefined,
    alatDipinjam: alatMilik,
  }
}

export function susunPetaPerlengkapanPerAnggota(
  members: Member[],
  daftarInventaris: ItemInventaris[],
): Record<string, PerlengkapanPribadiAnggota> {
  const peta: Record<string, PerlengkapanPribadiAnggota> = {}
  for (const m of members) {
    const p = susunPerlengkapanPribadiAnggota(m, daftarInventaris)
    if (p) peta[m.id] = p
  }
  return peta
}

/* ----------- Manifes Logistik & Loading Truk 3-Tahap Hari Lomba ----------- */

export const PERLENGKAPAN_STANDAR_LOMBA: {
  nama: string
  kategori: KategoriInventaris
  jumlah: number
  satuan: string
}[] = [
  { nama: 'Podium Konduktor Utama + Tangga Pengaman', kategori: 'podium_properti', jumlah: 1, satuan: 'set' },
  { nama: 'Kotak Plume & Shako Cadangan', kategori: 'seragam_aksesoris', jumlah: 2, satuan: 'boks' },
  { nama: 'Toolkit Lapangan (Kunci Drum, Valve Oil, Slide Grease, Lakban)', kategori: 'lainnya', jumlah: 1, satuan: 'koper' },
  { nama: 'Kotak P3K Medis, Oksigen Portabel, & Galon/Air Minum Tim', kategori: 'lainnya', jumlah: 1, satuan: 'paket' },
  { nama: 'Kabel Roll, Baterai Cadangan, & Mixer/Sound Pit', kategori: 'elektronik', jumlah: 1, satuan: 'set' },
]

/**
 * Tarik daftar barang dari Buku Induk Inventaris ke dalam Manifes Hari Lomba
 * tanpa menduplikasi `inventarisId` atau nama perlengkapan standar yang sudah ada.
 */
export function susunButirManifesDariInventaris(opsi: {
  inventaris: ItemInventaris[]
  butirSaatIni?: ButirManifesLogistik[]
  hanyaWajibLomba?: boolean
  sertakanStandarUmum?: boolean
}): ButirManifesLogistik[] {
  const awal = [...(opsi.butirSaatIni ?? [])]
  const idSudahAda = new Set(awal.map((b) => b.inventarisId).filter(Boolean))
  const namaSudahAda = new Set(awal.map((b) => b.nama.trim().toLowerCase()))

  const kandidatAset = opsi.inventaris
    .filter((it) => it.kondisi !== 'rusak')
    .filter((it) =>
      opsi.hanyaWajibLomba ? it.wajibBawaLomba === 1 : it.wajibBawaLomba === 1 || Boolean(it.pemegangId),
    )
    .sort((a, b) => a.kategori.localeCompare(b.kategori) || a.kodeAset.localeCompare(b.kodeAset))

  for (const it of kandidatAset) {
    if (idSudahAda.has(it.id)) continue
    idSudahAda.add(it.id)
    awal.push({
      id: uid('bml_'),
      inventarisId: it.id,
      kodeAset: it.kodeAset,
      nama: it.merekTipe ? `${it.nama} (${it.merekTipe})` : it.nama,
      kategori: it.kategori,
      jumlah: 1,
      satuan: 'unit',
      penanggungJawabId: it.pemegangId || undefined,
      muatBerangkat: 0,
      cekLokasi: 0,
      kembaliGudang: 0,
      catatan: it.kelengkapanPinjam || undefined,
    })
  }

  if (opsi.sertakanStandarUmum) {
    for (const std of PERLENGKAPAN_STANDAR_LOMBA) {
      if (namaSudahAda.has(std.nama.toLowerCase())) continue
      namaSudahAda.add(std.nama.toLowerCase())
      awal.push({
        id: uid('bml_'),
        nama: std.nama,
        kategori: std.kategori,
        jumlah: std.jumlah,
        satuan: std.satuan,
        muatBerangkat: 0,
        cekLokasi: 0,
        kembaliGudang: 0,
      })
    }
  }

  return awal
}

export type StatusBarisManifes =
  | 'lengkap_gudang'
  | 'belum_kembali_merah'
  | 'di_lokasi'
  | 'baru_berangkat'
  | 'belum_dimuat'

/**
 * Tentukan status baris manifes 3-tahap.
 *
 * Aturan penanda merah hari lomba (`PETA-JALAN-v2.md` #18.3):
 * Barang yang sudah dibawa (atau saat `tahapAktif === 'pulang'`, maupun saat
 * sebagian barang lain sudah mulai masuk gudang) tetapi **belum tercentang
 * `kembaliGudang === 1`** langsung berstatus `'belum_kembali_merah'`.
 */
export function statusBarisManifes(
  butir: ButirManifesLogistik,
  tahapAktif: ManifesLogistikLomba['tahapAktif'] = 'berangkat',
  adaYangSudahPulang = false,
): StatusBarisManifes {
  if (butir.kembaliGudang === 1) return 'lengkap_gudang'
  const sedangFasePulang =
    tahapAktif === 'pulang' ||
    (adaYangSudahPulang && (butir.muatBerangkat === 1 || butir.cekLokasi === 1))
  if (sedangFasePulang) return 'belum_kembali_merah'
  if (butir.cekLokasi === 1) return 'di_lokasi'
  if (butir.muatBerangkat === 1) return 'baru_berangkat'
  return 'belum_dimuat'
}

export interface RingkasanManifesLogistik {
  totalButir: number
  totalUnit: number
  sudahBerangkat: number
  sudahCekLokasi: number
  sudahKembaliGudang: number
  persenBerangkat: number
  persenLokasi: number
  persenKembali: number
  /** Daftar barang yang wajib diperingatkan merah karena belum kembali ke gudang. */
  belumKembaliMerah: ButirManifesLogistik[]
  /** Daftar barang yang dimuat berangkat tetapi belum tercentang saat cek di lokasi. */
  belumCekLokasi: ButirManifesLogistik[]
}

export function ringkasManifesLogistik(manifes: ManifesLogistikLomba): RingkasanManifesLogistik {
  const butir = manifes.butir ?? []
  const totalButir = butir.length
  const totalUnit = butir.reduce((s, b) => s + Math.max(1, b.jumlah || 1), 0)
  const sudahBerangkat = butir.filter((b) => b.muatBerangkat === 1).length
  const sudahCekLokasi = butir.filter((b) => b.cekLokasi === 1).length
  const sudahKembaliGudang = butir.filter((b) => b.kembaliGudang === 1).length
  const adaYangSudahPulang = sudahKembaliGudang > 0

  const belumKembaliMerah = butir.filter(
    (b) => statusBarisManifes(b, manifes.tahapAktif, adaYangSudahPulang) === 'belum_kembali_merah',
  )
  const belumCekLokasi = butir.filter((b) => b.muatBerangkat === 1 && b.cekLokasi !== 1)

  const pct = (n: number) => (totalButir > 0 ? Math.round((n / totalButir) * 100) : 0)

  return {
    totalButir,
    totalUnit,
    sudahBerangkat,
    sudahCekLokasi,
    sudahKembaliGudang,
    persenBerangkat: pct(sudahBerangkat),
    persenLokasi: pct(sudahCekLokasi),
    persenKembali: pct(sudahKembaliGudang),
    belumKembaliMerah,
    belumCekLokasi,
  }
}
