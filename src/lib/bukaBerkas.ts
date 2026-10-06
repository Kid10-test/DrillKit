/**
 * #7 — Satu pintu "Buka berkas DrillKit": kenali, pratinjau, arahkan.
 *
 * Masalahnya: ada 6+ pintu ekspor dan semuanya `.json`, sehingga pelatih
 * harus hapal tombol mana untuk berkas mana. Setiap impor hanya menerima
 * jenisnya sendiri tanpa memberi tahu tempat yang benar.
 *
 * Modul ini murni (tidak menyentuh Dexie, React, atau DOM) supaya bisa
 * diuji di node:
 *
 * 1. **Kenali dari isi** (`kenaliBerkas`) — bukan dari nama/ekstensi.
 *    JSON dikenali dari field `format`, CSV dari judul kolomnya, ZIP dari
 *    magic bytes-nya lalu dibuka dengan `bukaZip` dan tiap entri JSON di
 *    dalamnya dikenali lagi satu per satu.
 * 2. **Pratinjau** — tiap jenis punya peringkas (isi + tanggal + yang akan
 *    ditambah/ditimpa) yang dipakai modal pratinjau sebelum apa pun ditulis.
 * 3. **Nama berkas yang jelas** (`namaBackup`, `namaData`, ...) — dipakai
 *    semua tombol unduh supaya berkasnya dikenali dari namanya.
 * 4. **Aturan mode** (`aturMode`) — paket anggota ditolak di mode pelatih,
 *    dan mode anggota hanya menerima paket.
 *
 * Audit jenis (5 Okt 2026): di kode ada **5** nilai `format` JSON —
 * `drillkit-backup`, `drillkit-data`, `drillkit-show`, `drillkit-repertoar`,
 * `drillkit-share` — ditambah varian CSV (anggota, koordinat, koordinat
 * Pyware #10, jadwal, absensi) dan ZIP (backup+rekaman, per-anggota). Nilai `drillkit-*` lain
 * yang muncul kelak tetap dilaporkan apa adanya (tidak ditelan), supaya
 * berkas dari versi baru tidak gagal secara misterius.
 */
import { bukaZip } from './zip'
import { deteksiPyware } from './pyware'

/* ------------------------------ Jenis ---------------------------------- */

/** Semua jenis berkas yang dikenali pintu baru. */
export type JenisBerkas =
  | 'backup'
  | 'data'
  | 'show'
  | 'repertoar'
  | 'paket'
  | 'zip-backup'
  | 'zip-anggota'
  | 'csv-anggota'
  | 'csv-koordinat'
  | 'csv-pyware'
  | 'csv-jadwal'
  | 'csv-absensi'
  | 'tak-dikenal'

/** Label manusiawi tiap jenis — yang tampil di pratinjau. */
export const LABEL_JENIS: Record<JenisBerkas, string> = {
  backup: 'Backup lengkap',
  data: 'Data pilihan',
  show: 'Show (antar pelatih)',
  repertoar: 'Repertoar (lagu)',
  paket: 'Paket untuk anggota',
  'zip-backup': 'Backup lengkap + rekaman (ZIP)',
  'zip-anggota': 'Kumpulan paket anggota (ZIP)',
  'csv-anggota': 'CSV anggota',
  'csv-koordinat': 'CSV koordinat formasi',
  'csv-pyware': 'CSV koordinat Pyware (#10)',
  'csv-jadwal': 'CSV jadwal',
  'csv-absensi': 'CSV absensi',
  'tak-dikenal': 'Tidak dikenal',
}

/** Nilai `format` JSON → jenis. Sengaja eksplisit, bukan turunan string. */
const FORMAT_KE_JENIS: Record<string, JenisBerkas> = {
  'drillkit-backup': 'backup',
  'drillkit-data': 'data',
  'drillkit-show': 'show',
  'drillkit-repertoar': 'repertoar',
  'drillkit-share': 'paket',
}

/** Ke mana tiap jenis diarahkan (rute + tempat tombol lamanya). */
export const TUJUAN_JENIS: Record<JenisBerkas, { rute: string; tempat: string }> = {
  backup: { rute: '/pengaturan', tempat: 'Pengaturan → Pulihkan backup' },
  data: { rute: '/data', tempat: 'menu Data' },
  show: { rute: '/drill', tempat: 'Drill → ⚙ → Berbagi show' },
  repertoar: { rute: '/musik', tempat: 'Musik → Tukar repertoar' },
  paket: { rute: '/berbagi', tempat: 'mode anggota → Buka paket tim' },
  'zip-backup': { rute: '/pengaturan', tempat: 'Pengaturan → Pulihkan backup' },
  'zip-anggota': { rute: '/berbagi', tempat: 'mode anggota → Buka paket tim' },
  'csv-anggota': { rute: '/anggota', tempat: 'Anggota → Impor' },
  'csv-koordinat': { rute: '/drill', tempat: 'Drill → Tukar CSV' },
  'csv-pyware': { rute: '/drill', tempat: 'Drill → Impor Pyware' },
  'csv-jadwal': { rute: '/data', tempat: 'Data → Round-trip CSV' },
  'csv-absensi': { rute: '/data', tempat: 'Data → Round-trip CSV' },
  'tak-dikenal': { rute: '/data', tempat: 'menu Data' },
}

/* --------------------------- Hasil deteksi ------------------------------ */

export interface EntriDikenal {
  nama: string
  jenis: JenisBerkas
  data: unknown
}

/** Hasil `kenaliBerkas` — cukup untuk pratinjau + pengarahan tanpa baca ulang. */
export interface BerkasDikenal {
  jenis: JenisBerkas
  /** Nama berkas seperti yang dipilih (untuk tampilan saja, bukan deteksi). */
  nama: string
  /** Nilai field `format`, bila berkasnya JSON DrillKit. */
  format?: string
  /** Kapan berkas dibuat (`exportedAt`/`dibuat`), bila ada. */
  tanggal?: number
  /** Isi teks (JSON/CSV). Tidak diisi untuk ZIP. */
  teks?: string
  /** Hasil parse JSON — satu berkas (bukan daftar ZIP). */
  data?: unknown
  /** Tiap entri JSON di dalam ZIP, sudah dikenali satu per satu. */
  daftarZip?: EntriDikenal[]
  /** Jumlah entri `audio/*` di dalam ZIP (rekaman biner). */
  audioZip?: number
  /** Catatan tambahan untuk pratinjau, mis. "dari dalam ZIP …". */
  catatan?: string
}

/* ------------------------------ Deteksi --------------------------------- */

const AWALAN_ZIP = [0x50, 0x4b, 0x03, 0x04]

function magicZip(bita: Uint8Array): boolean {
  return (
    bita.length >= 4 &&
    bita[0] === AWALAN_ZIP[0] &&
    bita[1] === AWALAN_ZIP[1] &&
    bita[2] === AWALAN_ZIP[2] &&
    bita[3] === AWALAN_ZIP[3]
  )
}

/** Ambil tanggal pembuatan dari muatan JSON (dua nama kolom dipakai bergantian). */
export function tanggalMuatan(data: unknown): number | undefined {
  if (!data || typeof data !== 'object') return undefined
  const d = data as { exportedAt?: unknown; dibuat?: unknown }
  if (typeof d.exportedAt === 'number') return d.exportedAt
  if (typeof d.dibuat === 'number') return d.dibuat
  return undefined
}

/** Kenali satu objek JSON dari field `format`-nya. */
export function kenaliJson(data: unknown): { jenis: JenisBerkas; format?: string } {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { jenis: 'tak-dikenal' }
  }
  const format = (data as { format?: unknown }).format
  if (typeof format !== 'string') return { jenis: 'tak-dikenal' }
  return { jenis: FORMAT_KE_JENIS[format] ?? 'tak-dikenal', format }
}

/** Tebak pemisah kolom dari baris pertama yang tidak kosong. */
function deteksiPemisah(teks: string): ',' | ';' | '\t' {
  const baris = teks.split(/\r?\n/).find((b) => b.trim() !== '') ?? ''
  const hitung: Record<string, number> = { ',': 0, ';': 0, '\t': 0 }
  let kutip = false
  for (const ch of baris) {
    if (ch === '"') kutip = !kutip
    else if (!kutip && (ch === ',' || ch === ';' || ch === '\t')) hitung[ch] += 1
  }
  return ([';', '\t'] as const).find((p) => hitung[p] > hitung[',']) ?? ','
}

/** Pecah satu baris CSV dengan menghargai tanda kutip. */
function pecahSatuBaris(baris: string, pemisah: string): string[] {
  const out: string[] = []
  let cur = ''
  let kutip = false
  for (let i = 0; i < baris.length; i += 1) {
    const ch = baris[i]
    if (kutip) {
      if (ch === '"') {
        if (baris[i + 1] === '"') {
          cur += '"'
          i += 1
        } else kutip = false
      } else cur += ch
    } else if (ch === '"') kutip = true
    else if (ch === pemisah) {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out.map((s) => s.trim())
}

const adalahX = (h: string): boolean => /(^|[^a-z])x([^a-z]|$)/i.test(h) || /^x/i.test(h.trim())
const adalahY = (h: string): boolean => /(^|[^a-z])y([^a-z]|$)/i.test(h) || /^y/i.test(h.trim())
const adalahSet = (h: string): boolean => /(^|[^a-z])(set|formasi|formation)([^a-z]|$)/i.test(h)

/**
 * Kenali CSV dari judul kolomnya. Urutannya penting: yang paling khas
 * diperiksa dulu, karena "Kode, Nama" muncul di DUA jenis (anggota dan
 * koordinat bentuk lebar) — pembedanya adalah kolom X/Y/set.
 */
export function kenaliCsv(
  teks: string,
): 'csv-anggota' | 'csv-koordinat' | 'csv-pyware' | 'csv-jadwal' | 'csv-absensi' | null {
  const barisPertama = teks
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .find((b) => b.trim() !== '')
  if (!barisPertama) return null
  const judul = pecahSatuBaris(barisPertama, deteksiPemisah(teks)).map((h) =>
    h.toLowerCase(),
  )
  if (judul.length < 2) return null
  const punya = new Set(judul)

  // Absensi round-trip Data: id,sessionId,memberId,status,catatan.
  if (punya.has('sessionid') && punya.has('memberid')) return 'csv-absensi'
  // #10 — lembar koordinat Pyware dikenali LEBIH DULU dari CSV koordinat
  // biasa, karena keduanya sama-sama punya kolom X/Y. Pembedanya adalah
  // penanda khas Pyware (`sidelong`, `depth`, `count`, `performer`, …).
  // Penanda itu sengaja tidak memuat `set` atau `instrumen`: lembar
  // koordinat ekspor DrillKit sendiri punya keduanya, dan berkas itu harus
  // tetap lewat pintu DD7.
  if (deteksiPyware(teks).ya) return 'csv-pyware'
  // Jadwal round-trip Data: id,judul,jenis,tanggal,mulai,.... `id` wajib
  // ada — tanpa itu ini CSV laporan jadwal (satu arah), bukan round-trip.
  if (punya.has('id') && punya.has('judul') && punya.has('tanggal')) return 'csv-jadwal'
  // Koordinat: bentuk lebar (…,Set 1 X,Set 1 Y,…) atau panjang
  // (Set,Kode,Nama,X (steps),Y (steps)).
  const adaX = judul.some(adalahX)
  const adaY = judul.some(adalahY)
  if ((adaX && adaY) || (judul.some(adalahSet) && adaX && adaY)) return 'csv-koordinat'
  // Anggota: Kode,Nama,Panggilan,Section,Instrumen,Peran,Tahun Masuk,…
  // `tahun masuk` wajib ada: tanpa itu, CSV absensi per sesi dan CSV laporan
  // kehadiran (yang juga berjudul Kode/Nama/Section/Status) akan salah
  // dikenali sebagai CSV anggota — dan baris laporannya masuk sebagai anggota
  // baru. Ekspor/template Anggota selalu memuat kolom itu.
  const penandaAnggota = [
    'kode',
    'nama',
    'panggilan',
    'section',
    'instrumen',
    'peran',
    'tahun masuk',
    'no. hp',
    'status',
    'catatan',
  ]
  const cocok = penandaAnggota.filter((p) => punya.has(p)).length
  if (punya.has('nama') && punya.has('tahun masuk') && cocok >= 3) return 'csv-anggota'
  return null
}

/** Judul kolom CSV (huruf kecil), atau [] bila tidak terbaca. */
function judulCsv(teks: string): string[] {
  const barisPertama = teks
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .find((b) => b.trim() !== '')
  if (!barisPertama) return []
  return pecahSatuBaris(barisPertama, deteksiPemisah(teks)).map((h) => h.toLowerCase())
}

/**
 * Kenali CSV **satu arah** (laporan untuk dibaca, tidak bisa diimpor balik).
 *
 * DrillKit mengekspor beberapa CSV yang memang satu arah: laporan jadwal,
 * absensi per sesi, dan paket laporan kehadiran. Tanpa pengenalan ini,
 * berkasnya gagal secara misterius ("tidak dikenal") — atau lebih buruk,
 * laporan kehadiran salah dikenali sebagai CSV anggota. Pesannya menyebut
 * bahwa berkas itu memang tidak untuk dibuka kembali.
 */
export function catatanCsvSatuArah(teks: string): string | null {
  const judul = judulCsv(teks)
  if (judul.length < 2) return null
  const punya = new Set(judul)
  const ekor = 'Berkas ini memang satu arah — untuk dibaca/dicetak, tidak bisa diimpor balik.'
  // Laporan jadwal (Jadwal → Ekspor).
  if (punya.has('materi') && punya.has('judul') && punya.has('tanggal')) {
    return `CSV laporan jadwal. ${ekor} Yang bisa keluar-masuk (round-trip) ada di Data → Round-trip CSV.`
  }
  // Absensi satu sesi (Absensi → Ekspor).
  if (punya.has('sesi') && punya.has('jam masuk') && punya.has('status')) {
    return `CSV absensi satu sesi. ${ekor}`
  }
  // CSV ringkas/matriks/rekap kehadiran (Absensi → Rekap).
  if (
    punya.has('% kehadiran') &&
    (punya.has('hadir') || punya.has('terisi') || punya.has('predikat'))
  ) {
    return `CSV laporan kehadiran. ${ekor}`
  }
  return null
}

/**
 * Longgar: mungkinkah ini CSV anggota? Dipakai HANYA sebagai jalan terakhir
 * impor Anggota untuk berkas lama/buatan tangan yang kolomnya tidak lengkap
 * (dulu pengimpornya menerima kolom apa pun yang ada).
 */
export function tampakCsvAnggota(teks: string): boolean {
  const punya = new Set(judulCsv(teks))
  return punya.has('nama') || (punya.has('kode') && punya.size >= 2)
}

const dekoder = new TextDecoder('utf-8')

/**
 * Kenali berkas dari **isi**nya. Nama berkas hanya dipakai untuk tampilan
 * dan catatan — tidak pernah untuk menentukan jenis.
 */
export function kenaliBerkas(nama: string, bita: Uint8Array): BerkasDikenal {
  // --- ZIP: buka lalu kenali tiap entri JSON di dalamnya. ---
  if (magicZip(bita)) {
    let entri: { nama: string; bita: Uint8Array; teks: () => string }[]
    try {
      entri = bukaZip(bita)
    } catch {
      return { jenis: 'tak-dikenal', nama, catatan: 'Berkas ZIP-nya rusak, tidak bisa dibuka.' }
    }
    const audioZip = entri.filter((e) => e.nama.startsWith('audio/') && !e.nama.endsWith('.json')).length
    const json = entri.filter((e) => e.nama.endsWith('.json') && !e.nama.startsWith('audio/'))
    const daftar: EntriDikenal[] = []
    let gagal = 0
    for (const e of json) {
      try {
        const data = JSON.parse(e.teks())
        daftar.push({ nama: e.nama, jenis: kenaliJson(data).jenis, data })
      } catch {
        gagal += 1
      }
    }
    if (!daftar.length) {
      return {
        jenis: 'tak-dikenal',
        nama,
        audioZip,
        catatan:
          gagal > 0
            ? `ZIP ini memuat ${gagal} berkas JSON yang rusak.`
            : 'ZIP ini tidak memuat berkas JSON DrillKit.',
      }
    }
    const backup = daftar.filter((d) => d.jenis === 'backup')
    const paket = daftar.filter((d) => d.jenis === 'paket')
    // Satu-satunya JSON di dalam ZIP: perlakukan seperti berkas itu sendiri.
    if (daftar.length === 1 && daftar[0].jenis !== 'tak-dikenal') {
      const satu = daftar[0]
      // Backup ZIP dari #6 selalu satu JSON + audio/ — labeli sebagai ZIP
      // supaya pratinjau menyebut rekamannya.
      if (satu.jenis === 'backup') {
        return {
          jenis: 'zip-backup',
          nama,
          format: 'drillkit-backup',
          tanggal: tanggalMuatan(satu.data),
          data: satu.data,
          daftarZip: daftar,
          audioZip,
        }
      }
      return {
        jenis: satu.jenis,
        nama,
        tanggal: tanggalMuatan(satu.data),
        data: satu.data,
        daftarZip: daftar,
        audioZip,
        catatan: `Dari dalam ZIP ${nama} (berkas ${satu.nama}).`,
      }
    }
    // Kumpulan paket anggota (hasil "Unduh per anggota").
    if (paket.length === daftar.length && paket.length > 0) {
      return { jenis: 'zip-anggota', nama, daftarZip: daftar, audioZip }
    }
    if (backup.length === 1 && daftar.length > 1) {
      return {
        jenis: 'zip-backup',
        nama,
        format: 'drillkit-backup',
        tanggal: tanggalMuatan(backup[0].data),
        data: backup[0].data,
        daftarZip: daftar,
        audioZip,
        catatan: `ZIP ini juga memuat ${daftar.length - 1} berkas lain yang akan diabaikan.`,
      }
    }
    return {
      jenis: 'tak-dikenal',
      nama,
      daftarZip: daftar,
      audioZip,
      catatan: `ZIP ini memuat ${daftar.length} berkas JSON campuran yang tidak saling berkaitan.`,
    }
  }

  if (/\.zip$/i.test(nama.trim())) {
    return {
      jenis: 'tak-dikenal',
      nama,
      catatan: 'Berekstensi .zip tetapi isinya bukan ZIP yang sah.',
    }
  }

  // --- Teks: coba JSON dulu, lalu CSV. ---
  const teks = dekoder.decode(bita).replace(/^﻿/, '')
  if (!teks.trim()) return { jenis: 'tak-dikenal', nama, teks, catatan: 'Berkasnya kosong.' }
  try {
    const data = JSON.parse(teks)
    const { jenis, format } = kenaliJson(data)
    if (jenis === 'tak-dikenal' && typeof format === 'string' && format.startsWith('drillkit-')) {
      return {
        jenis,
        nama,
        format,
        tanggal: tanggalMuatan(data),
        teks,
        data,
        catatan:
          `Formatnya "${format}" — belum dikenal aplikasi ini. ` +
          'Mungkin berkas dari DrillKit yang lebih baru; perbarui dulu aplikasinya.',
      }
    }
    if (jenis === 'tak-dikenal') {
      return { jenis, nama, teks, data, catatan: 'JSON ini bukan berkas DrillKit (tidak ada field format).' }
    }
    return { jenis, nama, format, tanggal: tanggalMuatan(data), teks, data }
  } catch {
    // Bukan JSON — mungkin CSV.
  }
  const jenisCsv = kenaliCsv(teks)
  if (jenisCsv) return { jenis: jenisCsv, nama, teks }
  const satuArah = catatanCsvSatuArah(teks)
  if (satuArah) return { jenis: 'tak-dikenal', nama, teks, catatan: satuArah }
  return {
    jenis: 'tak-dikenal',
    nama,
    teks,
    catatan: 'Bukan JSON, CSV, atau ZIP yang dikenal.',
  }
}

/** Varian teks (untuk pemanggil yang sudah membaca berkas sebagai teks). */
export function kenaliTeks(nama: string, teks: string): BerkasDikenal {
  return kenaliBerkas(nama, new TextEncoder().encode(teks))
}

/* ------------------------- Aturan mode perangkat ------------------------ */

export type ModeBuka = 'coach' | 'member'

/**
 * Bolehkah jenis ini dibuka dalam mode ini?
 *
 * - Mode pelatih **menolak paket anggota** (termasuk ZIP-nya): paket itu
 *   salinan baca-saja yang isinya lebih sedikit — membukanya sebagai data
 *   pelatih akan mencampur/menghilangkan data.
 * - Mode anggota **hanya menerima paket**: satu pengecualian kecil, ZIP
 *   yang isinya tepat satu paket (pelatih mengirim satu berkas ZIP untuk
 *   satu anak) tetap dibuka.
 */
export function aturMode(
  jenis: JenisBerkas,
  mode: ModeBuka,
  jumlahPaketZip = 0,
): { boleh: boolean; alasan: string } {
  if (jenis === 'tak-dikenal') {
    return {
      boleh: false,
      alasan:
        'Berkas ini tidak dikenali sebagai berkas DrillKit. ' +
        'Yang bisa dibuka: backup, data pilihan, show, lagu, paket anggota, CSV, dan ZIP.',
    }
  }
  if (mode === 'coach' && (jenis === 'paket' || jenis === 'zip-anggota')) {
    return {
      boleh: false,
      alasan:
        'Ini paket untuk anggota — tidak bisa dibuka di mode pelatih. ' +
        'Paket itu hanya salinan baca-saja (tanpa token absensi dan sebagian data), ' +
        'jadi tidak bisa dipakai sebagai data pelatih. Minta berkas backup, data, show, atau lagunya.',
    }
  }
  if (mode === 'member' && jenis === 'zip-anggota' && jumlahPaketZip === 1) {
    return { boleh: true, alasan: '' }
  }
  if (mode === 'member' && jenis !== 'paket') {
    return {
      boleh: false,
      alasan:
        `Mode anggota hanya bisa membuka paket dari pelatih. Berkas ini adalah ` +
        `"${LABEL_JENIS[jenis]}". Minta berkas paket (.json) dari pelatih.`,
    }
  }
  return { boleh: true, alasan: '' }
}

/* ------------------------------ Pratinjau ------------------------------- */

export interface BarisPratinjau {
  label: string
  jumlah: number
  baru: number
  ditimpa: number
}

/** Kunci entitas: `id`, kecuali kemajuan yang memakai `key`. */
function kunci(e: unknown): string | null {
  if (!e || typeof e !== 'object') return null
  const r = e as { id?: unknown; key?: unknown }
  if (typeof r.id === 'string' && r.id) return r.id
  if (typeof r.key === 'string' && r.key) return r.key
  return null
}

/** Bagi daftar menjadi "baru" vs "sudah ada (akan ditimpa)". */
export function hitungBaruTimpa(
  daftar: unknown,
  ada: string[] | Set<string>,
): { jumlah: number; baru: number; ditimpa: number } {
  const list = Array.isArray(daftar) ? daftar : []
  const punya = ada instanceof Set ? ada : new Set(ada)
  let ditimpa = 0
  for (const e of list) {
    const k = kunci(e)
    if (k != null && punya.has(k)) ditimpa += 1
  }
  return { jumlah: list.length, baru: list.length - ditimpa, ditimpa }
}

/** Tabel backup → label pratinjau, sesuai urutan tampil. */
export const TABEL_BACKUP: { kolom: string; label: string }[] = [
  { kolom: 'members', label: 'Anggota' },
  { kolom: 'sessions', label: 'Jadwal' },
  { kolom: 'attendance', label: 'Absensi' },
  { kolom: 'songs', label: 'Lagu' },
  { kolom: 'setlists', label: 'Set list' },
  { kolom: 'drills', label: 'Drill' },
  { kolom: 'sets', label: 'Set formasi' },
  { kolom: 'memberNotes', label: 'Catatan anggota' },
  { kolom: 'kemajuan', label: 'Kemajuan' },
  { kolom: 'evaluasi', label: 'Evaluasi' },
]

/**
 * Ringkas isi backup: jumlah per tabel + berapa yang baru/ditimpa.
 * `ada` = id yang sudah ada di perangkat, per kolom tabel.
 */
export function ringkasBackup(
  data: unknown,
  ada: Record<string, string[]> = {},
): { baris: BarisPratinjau[]; total: number; adaPengaturan: boolean } {
  const d = (data ?? {}) as Record<string, unknown>
  const baris: BarisPratinjau[] = []
  for (const t of TABEL_BACKUP) {
    const h = hitungBaruTimpa(d[t.kolom], ada[t.kolom] ?? [])
    if (h.jumlah === 0) continue
    baris.push({ label: t.label, ...h })
  }
  const total = baris.reduce((a, b) => a + b.jumlah, 0)
  const s = d.settings as { teamName?: unknown } | undefined
  return { baris, total, adaPengaturan: !!s && typeof s === 'object' }
}

/** Kolom BerkasPindah (`drillkit-data`) → label pratinjau. */
export const TABEL_DATA: { kolom: string; label: string }[] = [
  { kolom: 'anggota', label: 'Anggota' },
  { kolom: 'jadwal', label: 'Jadwal' },
  { kolom: 'absensi', label: 'Absensi' },
  { kolom: 'lagu', label: 'Lagu' },
  { kolom: 'setlist', label: 'Set list' },
  { kolom: 'drill', label: 'Drill' },
  { kolom: 'set', label: 'Set formasi' },
  { kolom: 'kemajuan', label: 'Kemajuan' },
  { kolom: 'catatan', label: 'Catatan anggota' },
  { kolom: 'evaluasi', label: 'Evaluasi' },
]

/** Ringkas isi berkas data pilihan (dipakai pratinjau pintu baru). */
export function ringkasDataPindah(
  data: unknown,
  ada: Record<string, string[]> = {},
): { baris: BarisPratinjau[]; total: number } {
  const d = (data ?? {}) as Record<string, unknown>
  const baris: BarisPratinjau[] = []
  for (const t of TABEL_DATA) {
    const h = hitungBaruTimpa(d[t.kolom], ada[t.kolom] ?? [])
    if (h.jumlah === 0) continue
    baris.push({ label: t.label, ...h })
  }
  return { baris, total: baris.reduce((a, b) => a + b.jumlah, 0) }
}

export interface RingkasanShow {
  nama: string
  judul: string
  tim: string
  jumlahSet: number
  jumlahPemain: number
  jumlahLagu: number
  dibuat?: number
}

/** Ringkas isi berkas show (cerminan `ringkasBerkas` tanpa ketergantungan db). */
export function ringkasShow(data: unknown): RingkasanShow | null {
  const d = data as {
    drill?: { name?: unknown; showTitle?: unknown }
    tim?: unknown
    sets?: { points?: Record<string, unknown> }[]
    songs?: unknown[]
    dibuat?: unknown
  }
  if (!d || typeof d !== 'object' || !d.drill) return null
  const pemain = new Set<string>()
  for (const s of d.sets ?? []) {
    for (const id of Object.keys(s?.points ?? {})) pemain.add(id)
  }
  return {
    nama: typeof d.drill.name === 'string' ? d.drill.name : '(tanpa nama)',
    judul: typeof d.drill.showTitle === 'string' ? d.drill.showTitle : '',
    tim: typeof d.tim === 'string' && d.tim ? d.tim : '—',
    jumlahSet: (d.sets ?? []).length,
    jumlahPemain: pemain.size,
    jumlahLagu: (d.songs ?? []).length,
    dibuat: typeof d.dibuat === 'number' ? d.dibuat : undefined,
  }
}

export interface RingkasanPaket {
  tim: string
  tanggal?: number
  penerima: { jenis: 'grup' } | { jenis: 'anggota'; nama: string }
  jumlahAnggota: number
  jumlahJadwal: number
  jumlahDrill: number
  jumlahSet: number
  jumlahLagu: number
  jumlahAbsensi: number
  jumlahCatatan: number
  terkunci: number
}

/** Ringkas isi paket anggota (termasuk berkas terbit `paket.json`). */
export function ringkasPaket(data: unknown): RingkasanPaket | null {
  const d = data as {
    team?: { teamName?: unknown }
    exportedAt?: unknown
    forMember?: unknown
    namaPenerima?: unknown
    members?: unknown[]
    sessions?: unknown[]
    drills?: unknown[]
    sets?: unknown[]
    songs?: unknown[]
    attendance?: unknown[]
    memberNotes?: unknown[]
    locked?: Record<string, unknown>
  }
  if (!d || typeof d !== 'object') return null
  const anggota = Array.isArray(d.members) ? d.members : []
  let penerima: RingkasanPaket['penerima'] = { jenis: 'grup' }
  if (typeof d.forMember === 'string' && d.forMember) {
    const orang = anggota.find((m) => (m as { id?: unknown })?.id === d.forMember) as
      | { name?: unknown }
      | undefined
    const nama =
      (typeof d.namaPenerima === 'string' && d.namaPenerima) ||
      (typeof orang?.name === 'string' ? orang.name : d.forMember)
    penerima = { jenis: 'anggota', nama }
  }
  return {
    tim: typeof d.team?.teamName === 'string' && d.team.teamName ? d.team.teamName : '—',
    tanggal: typeof d.exportedAt === 'number' ? d.exportedAt : undefined,
    penerima,
    jumlahAnggota: anggota.length,
    jumlahJadwal: Array.isArray(d.sessions) ? d.sessions.length : 0,
    jumlahDrill: Array.isArray(d.drills) ? d.drills.length : 0,
    jumlahSet: Array.isArray(d.sets) ? d.sets.length : 0,
    jumlahLagu: Array.isArray(d.songs) ? d.songs.length : 0,
    jumlahAbsensi: Array.isArray(d.attendance) ? d.attendance.length : 0,
    jumlahCatatan: Array.isArray(d.memberNotes) ? d.memberNotes.length : 0,
    terkunci: d.locked && typeof d.locked === 'object' ? Object.keys(d.locked).length : 0,
  }
}

/** Ringkas CSV: jumlah baris data (tanpa judul) + judul kolomnya. */
export function ringkasCsv(teks: string): { baris: number; kolom: string[] } {
  const semua = teks
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .filter((b) => b.trim() !== '')
  if (!semua.length) return { baris: 0, kolom: [] }
  const kolom = pecahSatuBaris(semua[0], deteksiPemisah(teks))
  return { baris: Math.max(0, semua.length - 1), kolom }
}

/* ------------------------- Nama berkas yang jelas ----------------------- */

/** Cap tanggal `2026-10-05` (UTC, sama seperti semua penanda sebelumnya). */
export function capTanggal(d = new Date()): string {
  return d.toISOString().slice(0, 10)
}

/**
 * Bersihkan teks untuk nama berkas: buang karakter terlarang
 * (`/ \ : * ? " < > |`), rapikan spasi, batasi panjangnya.
 */
export function bersihNama(s: string, batas = 60): string {
  return s
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, batas)
    .replace(/[. ]+$/, '')
}

/** Buang aksara beraksen supaya aman di semua sistem berkas. */
function tanpaAksen(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

export function namaBackup(t?: Date): string {
  return `DrillKit - BACKUP LENGKAP - ${capTanggal(t)}.json`
}

export function namaBackupZip(t?: Date): string {
  return `DrillKit - BACKUP LENGKAP + REKAMAN - ${capTanggal(t)}.zip`
}

export function namaData(t?: Date): string {
  return `DrillKit - DATA PILIHAN - ${capTanggal(t)}.json`
}

export function namaShow(namaDrill: string, t?: Date): string {
  const nama = bersihNama(tanpaAksen(namaDrill), 50) || 'show'
  return `DrillKit - SHOW ${nama} - ${capTanggal(t)}.json`
}

export function namaRepertoar(jumlahLagu: number, t?: Date): string {
  return `DrillKit - LAGU (${jumlahLagu} lagu) - ${capTanggal(t)}.json`
}

export function namaPaketGrup(t?: Date): string {
  void t
  return 'DrillKit - UNTUK ANGGOTA - semua (grup).json'
}

/** `DrillKit - UNTUK ANGGOTA - Andra Pratama (Dede) A07.json`. */
export function namaPaketAnggota(nama: string, panggilan: string | undefined, kode: string): string {
  const n = bersihNama(tanpaAksen(nama), 40) || 'anggota'
  const p = panggilan && panggilan.trim() ? ` (${bersihNama(tanpaAksen(panggilan.trim()), 20)})` : ''
  const k = bersihNama(tanpaAksen(kode), 12)
  const ekor = k ? ` ${k}` : ''
  return `DrillKit - UNTUK ANGGOTA - ${n}${p}${ekor}.json`
}

/** ZIP kumpulan paket per anggota (isinya berkas-berkas `namaPaketAnggota`). */
export function namaZipAnggota(namaTim: string, t?: Date): string {
  const tim = bersihNama(tanpaAksen(namaTim), 40) || 'tim'
  return `DrillKit - UNTUK ANGGOTA - ${tim} - ${capTanggal(t)}.zip`
}
