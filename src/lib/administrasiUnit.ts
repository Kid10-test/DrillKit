import type {
  ArsipMusim,
  AttendanceRecord,
  CalonAudisi,
  CatatanSetoran,
  CountSheet,
  Drill,
  DrillSet,
  Evaluasi,
  ItemLogPerubahan,
  KartuMedisAnggota,
  Kemajuan,
  ManifesLogistikLomba,
  Member,
  MemberNote,
  NilaiTesAudisi,
  PenilaianLomba,
  Section,
  Session,
  SetList,
  Song,
  StatusCalonAudisi,
  TargetSetoran,
  TransaksiKasIuran,
  TindakLanjut,
} from '../db/types'
import { hitungRekapPenilaian } from './penilaianJuri'

/**
 * Mesin Murni #21 — Audisi Anggota Baru (`#21a`), Surat Izin / Dispensasi & Kartu Medis
 * Darurat (`#21b`), serta Buku Kas/Iuran TC & Arsip Lintas-Musim (`#21c`).
 *
 * 100% murni TypeScript + WebCrypto standar (bebas DOM, Dexie, dan React) agar dapat
 * diuji langsung di Node (`qa/administrasi-unit-logika.mjs`).
 */

function jepit(v: number, min: number, maks: number): number {
  if (!Number.isFinite(v)) return min
  return Math.max(min, Math.min(maks, v))
}

function bulat2(v: number): number {
  return Math.round(v * 100) / 100
}

/* ========================================================================== */
/*  #21a — Modul Audisi & Seleksi Anggota Baru (Open Recruitment)             */
/* ========================================================================== */

export const LABEL_STATUS_AUDISI: Record<StatusCalonAudisi, string> = {
  terdaftar: 'Terdaftar',
  dinilai: 'Sudah Dinilai',
  diterima: 'Diterima',
  cadangan: 'Daftar Tunggu / Cadangan',
  ditolak: 'Belum Lolos',
}

export interface HasilSkorAudisi {
  ritmik: number
  kepekaanNada: number
  posturLangkah: number
  koordinasiAlat: number
  rataRata: number
  predikat: 'Sangat Direkomendasikan' | 'Direkomendasikan' | 'Cadangan Potensial' | 'Perlu Pembinaan Dasar'
}

export function hitungSkorAudisi(nilai?: Partial<NilaiTesAudisi> | null): HasilSkorAudisi | null {
  if (!nilai) return null
  const ritmik = bulat2(jepit(Number(nilai.ritmik ?? 0), 0, 100))
  const kepekaanNada = bulat2(jepit(Number(nilai.kepekaanNada ?? 0), 0, 100))
  const posturLangkah = bulat2(jepit(Number(nilai.posturLangkah ?? 0), 0, 100))
  const koordinasiAlat = bulat2(jepit(Number(nilai.koordinasiAlat ?? 0), 0, 100))
  // Bobot seimbang 25% × 4 aspek dasar marching band
  const rataRata = bulat2((ritmik + kepekaanNada + posturLangkah + koordinasiAlat) / 4)
  const predikat =
    rataRata >= 85
      ? 'Sangat Direkomendasikan'
      : rataRata >= 72
        ? 'Direkomendasikan'
        : rataRata >= 60
          ? 'Cadangan Potensial'
          : 'Perlu Pembinaan Dasar'
  return { ritmik, kepekaanNada, posturLangkah, koordinasiAlat, rataRata, predikat }
}

export interface BarisPeringkatAudisi {
  peringkat: number
  calon: CalonAudisi
  skor: HasilSkorAudisi | null
  pilihanKe: 1 | 2
}

/**
 * Susun daftar peringkat calon anggota baru (keseluruhan atau per peminatan seksi ke-1/ke-2).
 */
export function susunPeringkatAudisi(
  daftar: CalonAudisi[],
  opsi?: { seksi?: Section | 'all'; hanyaSudahDinilai?: boolean },
): BarisPeringkatAudisi[] {
  const seksi = opsi?.seksi ?? 'all'
  const cocok = (daftar ?? []).filter((c) => {
    if (opsi?.hanyaSudahDinilai && !c.nilai) return false
    if (seksi === 'all') return true
    return c.minatSeksi1 === seksi || c.minatSeksi2 === seksi
  })

  const diurut = cocok
    .map((calon) => ({
      calon,
      skor: hitungSkorAudisi(calon.nilai),
      pilihanKe: (seksi === 'all' || calon.minatSeksi1 === seksi ? 1 : 2) as 1 | 2,
    }))
    .sort((a, b) => {
      const sa = a.skor?.rataRata ?? -1
      const sb = b.skor?.rataRata ?? -1
      if (sb !== sa) return sb - sa
      // Jika skor seri, utamakan pilihan minat ke-1 dibanding ke-2
      if (a.pilihanKe !== b.pilihanKe) return a.pilihanKe - b.pilihanKe
      return (a.calon.nama ?? '').localeCompare(b.calon.nama ?? '', 'id')
    })

  return diurut.map((item, idx) => ({
    peringkat: idx + 1,
    ...item,
  }))
}

/**
 * Buat kode chart unik baru (mis. `BR06`, `GD05`) tanpa menabrak kode anggota lama.
 */
export function buatKodeAnggotaBaru(seksi: Section, anggotaYangAda: Pick<Member, 'code'>[]): string {
  const awalan =
    (seksi || 'MB')
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 2)
      .toUpperCase() || 'MB'
  const terpakai = new Set(anggotaYangAda.map((m) => (m.code || '').trim().toUpperCase()))
  let nomor = 1
  while (nomor < 9999) {
    const kandidat = `${awalan}${String(nomor).padStart(2, '0')}`
    if (!terpakai.has(kandidat)) return kandidat
    nomor += 1
  }
  return `${awalan}${Date.now().toString().slice(-3)}`
}

/**
 * 1-Klik Luluskan Calon Audisi menjadi `Member` aktif + perbarui status `CalonAudisi`.
 * Bila calon sudah pernah diluluskan (`memberIdTertaut` masih ada di daftar anggota),
 * fungsi menolak duplikasi dan mengembalikan anggota yang sudah tertaut.
 */
export function luluskanCalonKeAnggota(
  calon: CalonAudisi,
  anggotaYangAda: Member[],
  opsi?: {
    seksiFinal?: Section
    instrumenFinal?: string
    buatId?: () => string
    buatToken?: () => string
    sekarang?: number
  },
): { sudahAda: boolean; member: Member; calonDiperbarui: CalonAudisi } {
  const skrg = opsi?.sekarang ?? Date.now()
  if (calon.memberIdTertaut) {
    const lama = anggotaYangAda.find((m) => m.id === calon.memberIdTertaut)
    if (lama) {
      return {
        sudahAda: true,
        member: lama,
        calonDiperbarui: { ...calon, status: 'diterima', updatedAt: skrg },
      }
    }
  }

  const seksi = opsi?.seksiFinal || calon.seksiDiterima || calon.minatSeksi1 || 'brass'
  const instrumen =
    opsi?.instrumenFinal ||
    calon.instrumenDiterima ||
    (seksi === calon.minatSeksi2 ? calon.minatInstrumen2 : calon.minatInstrumen1) ||
    calon.minatInstrumen1 ||
    'Anggota Baru'

  const idBaru = opsi?.buatId ? opsi.buatId() : `m_${skrg.toString(36)}_${Math.random().toString(36).slice(2, 6)}`
  const tokenBaru = opsi?.buatToken ? opsi.buatToken() : `t_${skrg.toString(36)}_${Math.random().toString(36).slice(2, 8)}`
  const kode = buatKodeAnggotaBaru(seksi, anggotaYangAda)

  const member: Member = {
    id: idBaru,
    code: kode,
    name: calon.nama.trim(),
    panggilan: calon.panggilan?.trim() || undefined,
    section: seksi,
    instrument: instrumen.trim(),
    role: 'member',
    joinYear: calon.tahunAngkatan || new Date(skrg).getFullYear(),
    active: 1,
    phone: calon.telepon?.trim() || undefined,
    instansiAsal: calon.instansiAsal?.trim() || undefined,
    kelasJurusan: calon.kelasJurusan?.trim() || undefined,
    nomorInduk: calon.nomorInduk?.trim() || undefined,
    notes: calon.catatanPenguji ? `Hasil Audisi: ${calon.catatanPenguji}` : undefined,
    token: tokenBaru,
    createdAt: skrg,
  }

  const calonDiperbarui: CalonAudisi = {
    ...calon,
    status: 'diterima',
    seksiDiterima: seksi,
    instrumenDiterima: instrumen.trim(),
    memberIdTertaut: member.id,
    updatedAt: skrg,
  }

  return { sudahAda: false, member, calonDiperbarui }
}

/* ========================================================================== */
/*  #21b (1) — Pengelompokan Surat Izin / Dispensasi Kolektif per Instansi    */
/* ========================================================================== */

export interface KelompokDispensasiInstansi {
  kunci: string
  namaInstansiTujuan: string
  peserta: Member[]
}

const ANGKA_ROMAWI_BULAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']

export function buatNomorSuratDispensasi(urutan: number, kodeUnit = 'MB', tanggalIso?: string): string {
  const d = tanggalIso ? new Date(`${tanggalIso}T00:00:00`) : new Date()
  const bln = ANGKA_ROMAWI_BULAN[d.getMonth()] ?? 'I'
  const thn = Number.isFinite(d.getFullYear()) ? d.getFullYear() : new Date().getFullYear()
  const singkatan = kodeUnit.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8) || 'MB'
  return `${String(Math.max(1, urutan)).padStart(3, '0')}/DISP/${singkatan}/${bln}/${thn}`
}

/**
 * Kelompokkan anggota peserta kegiatan berdasarkan asal sekolah / fakultas / instansi
 * sehingga 1 klik langsung mencetak bundel surat dispensasi terpisah per tujuan!
 */
export function kelompokkanPesertaDispensasi(peserta: Member[]): KelompokDispensasiInstansi[] {
  const peta = new Map<string, { namaInstansiTujuan: string; peserta: Member[] }>()
  for (const m of peserta ?? []) {
    const mentah = (m.instansiAsal ?? '').trim()
    const label = mentah || 'Instansi Umum / Belum Diisi Asal Sekolah-Fakultas'
    const kunci = mentah ? mentah.toLowerCase().replace(/\s+/g, ' ') : '__umum__'
    const grup = peta.get(kunci)
    if (grup) {
      grup.peserta.push(m)
    } else {
      peta.set(kunci, { namaInstansiTujuan: label, peserta: [m] })
    }
  }

  const hasil: KelompokDispensasiInstansi[] = []
  for (const [kunci, val] of peta.entries()) {
    const pesertaUrut = [...val.peserta].sort((a, b) => {
      const ka = (a.kelasJurusan ?? '').localeCompare(b.kelasJurusan ?? '', 'id')
      if (ka !== 0) return ka
      return a.name.localeCompare(b.name, 'id')
    })
    hasil.push({ kunci, namaInstansiTujuan: val.namaInstansiTujuan, peserta: pesertaUrut })
  }

  return hasil.sort((a, b) => {
    if (a.kunci === '__umum__') return 1
    if (b.kunci === '__umum__') return -1
    return a.namaInstansiTujuan.localeCompare(b.namaInstansiTujuan, 'id')
  })
}

/* ========================================================================== */
/*  #21b (2) — Kartu Medis Darurat & Enkripsi Sandi AES-256-GCM               */
/* ========================================================================== */

export interface StatusSiagaMedis {
  punyaAlergi: boolean
  punyaRiwayat: boolean
  bawaObatPribadi: boolean
  kontakDaruratLengkap: boolean
  tingkatSiaga: 'perhatian_khusus' | 'normal' | 'belum_lengkap'
}

export function evaluasiSiagaMedis(kartu?: KartuMedisAnggota | null): StatusSiagaMedis {
  if (!kartu) {
    return {
      punyaAlergi: false,
      punyaRiwayat: false,
      bawaObatPribadi: false,
      kontakDaruratLengkap: false,
      tingkatSiaga: 'belum_lengkap',
    }
  }
  const punyaAlergi = Boolean(kartu.alergiMakanan?.trim() || kartu.alergiObat?.trim())
  const punyaRiwayat = Boolean(kartu.riwayatMedis?.trim())
  const bawaObatPribadi = Boolean(kartu.obatPribadi?.trim())
  const kontakDaruratLengkap = Boolean(
    kartu.kontakDaruratNama?.trim() && kartu.kontakDaruratTelepon?.trim(),
  )
  const tingkatSiaga =
    punyaAlergi || punyaRiwayat || bawaObatPribadi
      ? 'perhatian_khusus'
      : kontakDaruratLengkap
        ? 'normal'
        : 'belum_lengkap'
  return {
    punyaAlergi,
    punyaRiwayat,
    bawaObatPribadi,
    kontakDaruratLengkap,
    tingkatSiaga,
  }
}

export interface BerkasMedisTerenkripsi {
  format: 'drillkit-medis-terenkripsi'
  versi: 1
  dibuat: number
  namaTim: string
  jumlahKartu: number
  garamB64: string
  ivB64: string
  cipherB64: string
}

function keB64(bita: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bita.length; i++) bin += String.fromCharCode(bita[i])
  return btoa(bin)
}

function dariB64(teks: string): Uint8Array {
  const bin = atob(teks)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function turunkanKunciSandiMedis(sandi: string, garam: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const bahan = await crypto.subtle.importKey('raw', enc.encode(sandi), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: garam as BufferSource, iterations: 100_000, hash: 'SHA-256' },
    bahan,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

/**
 * Ekspor terpisah Kartu Medis & Kontak Darurat dengan enkripsi kata sandi **AES-256-GCM**
 * khusus serah-terima rahasia antar pelatih kepala & tim medis lapangan.
 */
export async function eksporMedisTerenkripsi(
  daftarMedis: KartuMedisAnggota[],
  sandi: string,
  namaTim = 'Unit Marching Band',
): Promise<string> {
  if (!sandi || sandi.trim().length < 4) {
    throw new Error('Kata sandi enkripsi medis minimal 4 karakter')
  }
  const garam = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const kunci = await turunkanKunciSandiMedis(sandi, garam)
  const muatan = JSON.stringify({ medisAnggota: daftarMedis })
  const terenkripsi = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    kunci,
    new TextEncoder().encode(muatan),
  )
  const bungkus: BerkasMedisTerenkripsi = {
    format: 'drillkit-medis-terenkripsi',
    versi: 1,
    dibuat: Date.now(),
    namaTim,
    jumlahKartu: daftarMedis.length,
    garamB64: keB64(garam),
    ivB64: keB64(iv),
    cipherB64: keB64(new Uint8Array(terenkripsi)),
  }
  return JSON.stringify(bungkus, null, 2)
}

export async function bukaMedisTerenkripsi(
  teksJson: string,
  sandi: string,
): Promise<KartuMedisAnggota[]> {
  let bungkus: BerkasMedisTerenkripsi
  try {
    bungkus = JSON.parse(teksJson)
  } catch {
    throw new Error('Berkas arsip medis tidak valid (bukan JSON)')
  }
  if (bungkus?.format !== 'drillkit-medis-terenkripsi') {
    throw new Error('Bukan berkas arsip medis terenkripsi DrillKit')
  }
  try {
    const garam = dariB64(bungkus.garamB64)
    const iv = dariB64(bungkus.ivB64)
    const cipher = dariB64(bungkus.cipherB64)
    const kunci = await turunkanKunciSandiMedis(sandi, garam)
    const terang = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      kunci,
      cipher as BufferSource,
    )
    const isi = JSON.parse(new TextDecoder().decode(terang)) as { medisAnggota?: KartuMedisAnggota[] }
    return Array.isArray(isi.medisAnggota) ? isi.medisAnggota : []
  } catch {
    throw new Error('Kata sandi salah atau berkas medis telah berubah')
  }
}

/* ========================================================================== */
/*  #21c (1) — Buku Kas & Iuran Kegiatan / TC                                 */
/* ========================================================================== */

export function formatRupiah(nominal: number): string {
  const aman = Math.round(Number.isFinite(nominal) ? nominal : 0)
  const tanda = aman < 0 ? '-' : ''
  const angka = Math.abs(aman).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${tanda}Rp${angka}`
}

export function buatNomorKwitansiKas(urutan: number, tanggalIso?: string): string {
  const tgl = (tanggalIso || new Date().toISOString().slice(0, 10)).replace(/-/g, '')
  return `KWT-${tgl}-${String(Math.max(1, urutan)).padStart(3, '0')}`
}

export interface RingkasanKasUnit {
  totalIuranAnggota: number
  totalPemasukanUmum: number
  totalPemasukan: number
  totalPengeluaran: number
  saldoAkhir: number
  programIuran: {
    kategoriProgram: string
    targetPerAnggota: number
    terkumpul: number
    jumlahTransaksi: number
  }[]
}

export function hitungRekapKasIuran(daftar: TransaksiKasIuran[]): RingkasanKasUnit {
  let totalIuranAnggota = 0
  let totalPemasukanUmum = 0
  let totalPengeluaran = 0
  const petaProgram = new Map<
    string,
    { kategoriProgram: string; targetPerAnggota: number; terkumpul: number; jumlahTransaksi: number }
  >()

  for (const t of daftar ?? []) {
    const nom = Math.max(0, Math.round(Number.isFinite(t.nominal) ? t.nominal : 0))
    if (t.jenis === 'iuran_anggota') {
      totalIuranAnggota += nom
      const kat = (t.kategoriProgram || 'Iuran Umum').trim()
      const ada = petaProgram.get(kat)
      const target = Math.max(ada?.targetPerAnggota ?? 0, Math.round(t.targetPerAnggota ?? 0))
      if (ada) {
        ada.terkumpul += nom
        ada.jumlahTransaksi += 1
        ada.targetPerAnggota = target
      } else {
        petaProgram.set(kat, {
          kategoriProgram: kat,
          targetPerAnggota: target,
          terkumpul: nom,
          jumlahTransaksi: 1,
        })
      }
    } else if (t.jenis === 'pemasukan_umum') {
      totalPemasukanUmum += nom
    } else if (t.jenis === 'pengeluaran') {
      totalPengeluaran += nom
    }
  }

  const totalPemasukan = totalIuranAnggota + totalPemasukanUmum
  return {
    totalIuranAnggota,
    totalPemasukanUmum,
    totalPemasukan,
    totalPengeluaran,
    saldoAkhir: totalPemasukan - totalPengeluaran,
    programIuran: [...petaProgram.values()].sort((a, b) =>
      a.kategoriProgram.localeCompare(b.kategoriProgram, 'id'),
    ),
  }
}

export interface BarisTunggakanAnggota {
  member: Member
  terbayar: number
  targetTagihan: number
  sisaTunggakan: number
  status: 'lunas' | 'cicilan' | 'belum_bayar'
  jumlahCicilan: number
  transaksiTerakhir?: TransaksiKasIuran
}

export function hitungStatusIuranAnggota(
  anggotaAktif: Member[],
  transaksi: TransaksiKasIuran[],
  kategoriProgram: string,
  targetManual?: number,
): BarisTunggakanAnggota[] {
  const katNorm = (kategoriProgram ?? '').trim().toLowerCase()
  const transProgram = (transaksi ?? []).filter(
    (t) => t.jenis === 'iuran_anggota' && (t.kategoriProgram ?? '').trim().toLowerCase() === katNorm,
  )
  const targetOtomatis = transProgram.reduce(
    (maks, t) => Math.max(maks, Math.round(t.targetPerAnggota ?? 0)),
    0,
  )
  const targetTagihan = Math.max(0, Math.round(targetManual ?? targetOtomatis))

  return [...(anggotaAktif ?? [])]
    .filter((m) => m.active !== 0)
    .sort((a, b) => a.name.localeCompare(b.name, 'id'))
    .map((member) => {
      const milik = transProgram
        .filter((t) => t.memberId === member.id)
        .sort((a, b) => b.tanggal.localeCompare(a.tanggal))
      const terbayar = milik.reduce((s, t) => s + Math.max(0, Math.round(t.nominal || 0)), 0)
      const sisaTunggakan = Math.max(0, targetTagihan - terbayar)
      const status: BarisTunggakanAnggota['status'] =
        targetTagihan > 0
          ? terbayar >= targetTagihan
            ? 'lunas'
            : terbayar > 0
              ? 'cicilan'
              : 'belum_bayar'
          : terbayar > 0
            ? 'lunas'
            : 'belum_bayar'
      return {
        member,
        terbayar,
        targetTagihan,
        sisaTunggakan,
        status,
        jumlahCicilan: milik.length,
        transaksiTerakhir: milik[0],
      }
    })
}

/* ========================================================================== */
/*  #21c (2) — Arsip Lintas-Musim (Season Rollover)                           */
/* ========================================================================== */

export interface MasukanSeasonRollover {
  idArsip: string
  namaMusim: string
  tahunMusim: string
  tanggalArsip: string
  catatanPenutup?: string
  members: Member[]
  sessions: Session[]
  attendance: AttendanceRecord[]
  drills: Drill[]
  sets: DrillSet[]
  songs: Song[]
  setlists: SetList[]
  kemajuan: Kemajuan[]
  memberNotes: MemberNote[]
  evaluasi: Evaluasi[]
  targetSetoran: TargetSetoran[]
  setoran: CatatanSetoran[]
  logPerubahan: ItemLogPerubahan[]
  countSheets: CountSheet[]
  logistikLomba: ManifesLogistikLomba[]
  penilaianLomba: PenilaianLomba[]
  kasIuran: TransaksiKasIuran[]
  audisi: CalonAudisi[]
  /** #26 — catatan cleaning/tindak lanjut musim berjalan. */
  tindakLanjut?: TindakLanjut[]
  skorSimulasiPuncak?: number | null
}

/**
 * Daftar tabel musiman yang dibersihkan saat *Season Rollover*.
 *
 * **DIJAMIN TIDAK DIHAPUS:** `members`, `inventaris`, `medisAnggota`, `settings`, dan `arsipMusim`!
 */
export const TABEL_MUSIMAN_DIARSIPKAN = [
  'sessions',
  'attendance',
  'drills',
  'sets',
  'songs',
  'setlists',
  'kemajuan',
  'memberNotes',
  'evaluasi',
  'targetSetoran',
  'setoran',
  'logPerubahan',
  'countSheets',
  'logistikLomba',
  'penilaianLomba',
  'judgeTapeAudio',
  'rekamanAudio',
  'partiturBerkas',
  'kasIuran',
  'audisi',
  'tindakLanjut',
] as const

export function susunArsipMusim(m: MasukanSeasonRollover): ArsipMusim {
  const anggotaAktif = (m.members ?? []).filter((x) => x.active !== 0)
  const hadir = (m.attendance ?? []).filter((a) => a.status === 'hadir').length
  const totalAbsen = (m.attendance ?? []).length
  const rataKehadiranPersen = totalAbsen > 0 ? bulat2((hadir / totalAbsen) * 100) : 0
  const rekapKas = hitungRekapKasIuran(m.kasIuran ?? [])
  const skorDariPenilaian =
    (m.penilaianLomba ?? []).length > 0
      ? Math.max(...(m.penilaianLomba ?? []).map((p) => hitungRekapPenilaian(p).skorAkhir))
      : null
  const skorPuncak =
    m.skorSimulasiPuncak !== undefined ? m.skorSimulasiPuncak : skorDariPenilaian

  return {
    id: m.idArsip,
    namaMusim: m.namaMusim.trim() || `Musim Kejuaraan ${m.tahunMusim}`,
    tahunMusim: m.tahunMusim.trim() || String(new Date().getFullYear()),
    tanggalArsip: m.tanggalArsip,
    catatanPenutup: m.catatanPenutup?.trim() || undefined,
    ringkasan: {
      jmlAnggotaAktif: anggotaAktif.length,
      jmlSesi: (m.sessions ?? []).length,
      rataKehadiranPersen,
      jmlLagu: (m.songs ?? []).length,
      jmlDrill: (m.drills ?? []).length,
      skorPuncakSimulasi: skorPuncak,
      saldoAkhirKas: rekapKas.saldoAkhir,
      daftarRepertoar: (m.songs ?? []).map((s) => s.title),
      daftarDrill: (m.drills ?? []).map((d) => d.name),
    },
    muatanMusim: {
      membersSnapshot: m.members ?? [],
      sessions: m.sessions ?? [],
      attendance: m.attendance ?? [],
      drills: m.drills ?? [],
      sets: m.sets ?? [],
      songs: m.songs ?? [],
      setlists: m.setlists ?? [],
      kemajuan: m.kemajuan ?? [],
      memberNotes: m.memberNotes ?? [],
      evaluasi: m.evaluasi ?? [],
      targetSetoran: m.targetSetoran ?? [],
      setoran: m.setoran ?? [],
      logPerubahan: m.logPerubahan ?? [],
      countSheets: m.countSheets ?? [],
      logistikLomba: m.logistikLomba ?? [],
      penilaianLomba: m.penilaianLomba ?? [],
      kasIuran: m.kasIuran ?? [],
      tindakLanjut: m.tindakLanjut ?? [],
      audisi: m.audisi ?? [],
    },
    createdAt: Date.now(),
  }
}
