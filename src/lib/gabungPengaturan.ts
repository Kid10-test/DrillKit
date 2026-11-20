/**
 * v2.15.1 — pulihkan backup **menggabungkan** pengaturan tim, bukan
 * menggantinya.
 *
 * Kejadiannya: `tulisMuatanBackup` dulu menulis
 * `db.settings.put({ ...berkasSettings, key: 'team' })`. Semua tabel lain
 * digabung (`bulkPut` per id), tetapi pengaturan **diganti utuh**. Backup
 * yang dibuat sebelum program latihan disusun (atau backup dari perangkat
 * lain) tidak punya `programLatihan`, sehingga memulihkannya menghapus
 * program Latsar beserta aturan pelantikannya. Sambungan perangkat ikut
 * hilang: server kehadiran, Google Drive, Sheet Form terpilih, nama
 * pemutus, tarik otomatis. Bila sinkron otomatis menyala, perangkat pemilik
 * lalu mengirim program kosong ke server dan menimpa program di sana.
 *
 * Aturan gabung di modul ini (murni, tanpa Dexie — diuji tanpa peramban):
 *
 *  1. Daftar ber-id (`programLatihan`, `polaSesi`, `musimTc`) digabung per
 *     id, sama dengan tabel lain: yang sama id-nya ditimpa isi berkas, yang
 *     hanya ada di perangkat dipertahankan, yang hanya ada di berkas
 *     ditambahkan.
 *  2. Sambungan perangkat (`serverKehadiran`, `google`, `sumberForm`,
 *     `pemutusPutusan`, `tarikOtomatis`) tidak pernah diganti berkas. Berkas
 *     hanya mengisinya bila perangkat ini belum punya.
 *  3. Field lain diambil dari berkas, kecuali nilainya kosong (tidak ada,
 *     teks kosong, daftar kosong, objek kosong) sementara perangkat punya
 *     isinya. Backup lama tidak boleh mengosongkan apa pun.
 */
import type { TeamSettings } from '../db/types'

/** Field yang melekat ke perangkat/sambungan: berkas hanya mengisi bila perangkat belum punya. */
export const FIELD_SAMBUNGAN = ['serverKehadiran', 'google', 'sumberForm', 'pemutusPutusan', 'tarikOtomatis'] as const

/** Daftar ber-id yang digabung per id. */
export const FIELD_DAFTAR_ID = ['programLatihan', 'polaSesi', 'musimTc'] as const

/** Label untuk pratinjau. */
export const LABEL_FIELD_PENGATURAN: Record<string, string> = {
  serverKehadiran: 'Server kehadiran bersama',
  google: 'Sambungan Google Drive',
  sumberForm: 'Sheet Google Form terpilih',
  pemutusPutusan: 'Nama pemutus putusan',
  tarikOtomatis: 'Tarik isian otomatis',
  programLatihan: 'Program latihan',
  polaSesi: 'Pola sesi',
  musimTc: 'Musim TC',
  sections: 'Section',
  kelompokRoster: 'Kelompok roster',
  kopSurat: 'Kop surat',
  targetNeraca: 'Target neraca',
  ambangGerak: 'Ambang gerak',
  ambangPredikat: 'Ambang predikat',
  logo: 'Logo',
  city: 'Kota',
  teamName: 'Nama tim',
  coachName: 'Nama pelatih',
}

const SAMBUNGAN = new Set<string>(FIELD_SAMBUNGAN)
const DAFTAR_ID = new Set<string>(FIELD_DAFTAR_ID)

/** Kosong = tidak ada, null, teks kosong, daftar kosong, atau objek tanpa kunci. */
export function nilaiKosong(v: unknown): boolean {
  if (v === undefined || v === null || v === '') return true
  if (Array.isArray(v)) return v.length === 0
  if (typeof v === 'object') return Object.keys(v as Record<string, unknown>).length === 0
  return false
}

type BerId = { id: string }

function daftarBerId(v: unknown): BerId[] {
  if (!Array.isArray(v)) return []
  return v.filter((x): x is BerId => !!x && typeof x === 'object' && typeof (x as BerId).id === 'string' && (x as BerId).id !== '')
}

export interface HasilGabungDaftar<T extends BerId> {
  daftar: T[]
  baru: number
  ditimpa: number
  dipertahankan: number
}

/**
 * Gabung per id: urutan perangkat dipertahankan, yang sama id-nya diganti
 * isi berkas di tempatnya, yang baru dari berkas ditambahkan di belakang.
 */
export function gabungPerId<T extends BerId>(lokal: unknown, berkas: unknown): HasilGabungDaftar<T> {
  const l = daftarBerId(lokal) as T[]
  const b = daftarBerId(berkas) as T[]
  // Id ganda di berkas: yang pertama dipakai (sama dengan aturan duplikat di sinkron).
  const dariBerkas = new Map<string, T>()
  for (const x of b) if (!dariBerkas.has(x.id)) dariBerkas.set(x.id, x)
  const idLokal = new Set(l.map((x) => x.id))
  let ditimpa = 0
  let dipertahankan = 0
  const daftar: T[] = l.map((x) => {
    const pengganti = dariBerkas.get(x.id)
    if (pengganti) {
      ditimpa++
      return pengganti
    }
    dipertahankan++
    return x
  })
  let baru = 0
  for (const x of b) {
    if (idLokal.has(x.id)) continue
    idLokal.add(x.id)
    daftar.push(x)
    baru++
  }
  return { daftar, baru, ditimpa, dipertahankan }
}

export interface RingkasProgramPulih {
  /** Program di berkas. */
  berkas: number
  /** Program di perangkat sebelum dipulihkan. */
  lokal: number
  /** Program sesudah dipulihkan. */
  hasil: number
  baru: number
  ditimpa: number
  /** Program perangkat yang tidak ada di berkas dan tetap dipakai. */
  dipertahankan: number
}

export interface HasilGabungPengaturan {
  hasil: TeamSettings
  program: RingkasProgramPulih
  /** Field yang isinya di perangkat dipertahankan (berkas kosong, atau sambungan perangkat). */
  dipertahankan: string[]
  /** Sambungan yang diisi dari berkas karena perangkat belum punya. */
  diisiDariBerkas: string[]
}

/** Gabungkan pengaturan berkas backup ke pengaturan perangkat. */
export function gabungPengaturan(lokal: Partial<TeamSettings> | undefined | null, berkas: unknown): HasilGabungPengaturan {
  const l = (lokal ?? {}) as Record<string, unknown>
  const b = (berkas && typeof berkas === 'object' ? berkas : {}) as Record<string, unknown>
  const hasil: Record<string, unknown> = { ...l }
  const dipertahankan: string[] = []
  const diisiDariBerkas: string[] = []

  for (const k of Object.keys(b)) {
    if (k === 'key') continue
    const vb = b[k]
    const vl = l[k]
    if (SAMBUNGAN.has(k)) {
      if (nilaiKosong(vl)) {
        if (!nilaiKosong(vb)) {
          hasil[k] = vb
          diisiDariBerkas.push(k)
        }
      } else if (JSON.stringify(vl) !== JSON.stringify(vb)) {
        dipertahankan.push(k)
      }
      continue
    }
    if (DAFTAR_ID.has(k)) {
      if (!Array.isArray(vb)) {
        if (!nilaiKosong(vl)) dipertahankan.push(k)
        continue
      }
      const g = gabungPerId(vl, vb)
      hasil[k] = g.daftar
      if (g.dipertahankan > 0) dipertahankan.push(k)
      continue
    }
    if (nilaiKosong(vb) && !nilaiKosong(vl)) {
      dipertahankan.push(k)
      continue
    }
    hasil[k] = vb
  }

  // Daftar ber-id yang sama sekali tidak disebut berkas juga dihitung "dipertahankan".
  for (const k of FIELD_DAFTAR_ID) if (!(k in b) && !nilaiKosong(l[k]) && !dipertahankan.includes(k)) dipertahankan.push(k)
  for (const k of FIELD_SAMBUNGAN) if (!(k in b) && !nilaiKosong(l[k]) && !dipertahankan.includes(k)) dipertahankan.push(k)

  hasil.key = 'team'
  const gp = gabungPerId(l.programLatihan, Array.isArray(b.programLatihan) ? b.programLatihan : [])
  const program: RingkasProgramPulih = {
    berkas: daftarBerId(b.programLatihan).length,
    lokal: daftarBerId(l.programLatihan).length,
    hasil: daftarBerId(hasil.programLatihan).length,
    baru: gp.baru,
    ditimpa: gp.ditimpa,
    dipertahankan: gp.dipertahankan,
  }
  return { hasil: hasil as unknown as TeamSettings, program, dipertahankan, diisiDariBerkas }
}

/** Kalimat pratinjau soal program latihan; `null` bila tidak ada yang perlu dikatakan. */
export function kalimatProgramPulih(r: RingkasProgramPulih): { teks: string; peringatan: boolean } | null {
  if (r.berkas === 0 && r.lokal === 0) return null
  if (r.berkas === 0) {
    return {
      teks: `Berkas ini tidak membawa program latihan. ${r.lokal} program di perangkat ini tetap dipakai.`,
      peringatan: false,
    }
  }
  const bagian: string[] = []
  if (r.baru) bagian.push(`${r.baru} baru`)
  if (r.ditimpa) bagian.push(`${r.ditimpa} ditimpa isi berkas`)
  if (r.dipertahankan) bagian.push(`${r.dipertahankan} dari perangkat ini dipertahankan`)
  return {
    teks: `Program latihan: ${r.berkas} di berkas, ${r.lokal} di perangkat ini → ${r.hasil} sesudah dipulihkan (${bagian.join(', ')}).`,
    peringatan: r.ditimpa > 0,
  }
}
