/**
 * v2.11.2 — memasukkan banyak pemain ke satu set sekaligus.
 *
 * Dipakai tombol "Masukkan semua" di editor drill dan saat drill baru dibuat.
 * Aturannya sengaja sederhana supaya hasilnya bisa ditebak pelatih:
 *
 * 1. Pemain yang sudah punya titik di **set sebelumnya** diletakkan di titik
 *    itu juga — biasanya memang di situ ia berdiri saat set ini dimulai.
 * 2. Sisanya disusun **satu blok per section**, berjajar dari Side 1 ke
 *    Side 2 mengikuti urutan section di Pengaturan. Blok yang tidak muat di
 *    satu jajaran turun ke jajaran berikutnya (ke arah belakang).
 * 3. Kalau di set ini sudah ada titik, blok baru diletakkan di belakang
 *    titik-titik itu; kalau di belakang tidak muat, di depannya. Tidak ada
 *    titik lama yang digeser.
 *
 * Modul ini murni (tanpa DOM/Dexie) supaya bisa diuji di Node.
 */
import type { DrillPoint, FieldConfig } from '../db/types'
import { fieldBox, stepYd } from './field'
import { OPSI_BENTUK_BAWAAN, susunBentukCepat } from './bentukFormasi'

export interface AnggotaTempat {
  id: string
  section: string
}

export interface OpsiMasukkanSemua {
  /** Jarak antarpemain di dalam blok, dalam langkah (bawaan 4 = satu meteran patok). */
  intervalLangkah?: number
  /** Celah antarblok, dalam langkah (bawaan 2× interval). */
  celahBlokLangkah?: number
  /** Urutan section dari Side 1 ke Side 2. Section yang tak tercantum menyusul sesuai urutan muncul. */
  urutanSection?: string[]
  /** Ambil posisi dari set sebelumnya bila ada (bawaan true). */
  ikutSetSebelumnya?: boolean
  /** Bulatkan ke grid ¼ langkah (bawaan true). */
  snap?: boolean
}

export interface BlokSection {
  section: string
  ids: string[]
  kolom: number
  baris: number
  pusat: { x: number; y: number }
}

export interface HasilMasukkanSemua {
  /** Hanya titik BARU — gabungkan sendiri dengan titik set yang sudah ada. */
  points: Record<string, DrillPoint>
  /** Pemain yang posisinya diambil dari set sebelumnya. */
  dariSetSebelumnya: string[]
  /** Blok per section untuk pemain yang belum punya posisi sebelumnya. */
  blok: BlokSection[]
}

export const INTERVAL_MASUKKAN_BAWAAN = 4

/** Jumlah kolom blok: dibuat agak melebar (baris ≤ kolom) supaya tidak menutupi pandangan penonton. */
export function kolomBlokUntuk(n: number): number {
  if (n <= 0) return 0
  if (n <= 4) return n
  return Math.ceil(Math.sqrt(n * 1.5))
}

/** Kelompokkan pemain per section dengan urutan yang stabil. */
export function kelompokkanPerSection(
  anggota: AnggotaTempat[],
  urutanSection: string[] = [],
): { section: string; ids: string[] }[] {
  const peta = new Map<string, string[]>()
  for (const a of anggota) {
    const s = a.section || ''
    const daftar = peta.get(s)
    if (daftar) daftar.push(a.id)
    else peta.set(s, [a.id])
  }
  const urut = (s: string) => {
    const i = urutanSection.indexOf(s)
    return i < 0 ? urutanSection.length : i
  }
  const kunci = [...peta.keys()]
  return kunci
    .map((section, asli) => ({ section, asli }))
    .sort((a, b) => urut(a.section) - urut(b.section) || a.asli - b.asli)
    .map(({ section }) => ({ section, ids: peta.get(section)! }))
}

/** Batas y (min/max) dari kumpulan titik, atau null bila kosong. */
function rentangY(points: Record<string, DrillPoint>): { min: number; max: number } | null {
  let min = Infinity
  let max = -Infinity
  for (const p of Object.values(points)) {
    if (!Number.isFinite(p.y)) continue
    if (p.y < min) min = p.y
    if (p.y > max) max = p.y
  }
  return Number.isFinite(min) ? { min, max } : null
}

export function rencanaMasukkanSemua(
  belum: AnggotaTempat[],
  pointsSekarang: Record<string, DrillPoint>,
  pointsSebelumnya: Record<string, DrillPoint> | undefined,
  field: FieldConfig,
  opsi: OpsiMasukkanSemua = {},
): HasilMasukkanSemua {
  const hasil: HasilMasukkanSemua = { points: {}, dariSetSebelumnya: [], blok: [] }
  const sisa: AnggotaTempat[] = []
  const ikut = opsi.ikutSetSebelumnya !== false
  for (const a of belum) {
    if (pointsSekarang[a.id]) continue
    const lama = ikut ? pointsSebelumnya?.[a.id] : undefined
    if (lama && Number.isFinite(lama.x) && Number.isFinite(lama.y)) {
      hasil.points[a.id] = { x: lama.x, y: lama.y, facing: lama.facing ?? 'front', ...(lama.facingDeg !== undefined ? { facingDeg: lama.facingDeg } : {}) }
      hasil.dariSetSebelumnya.push(a.id)
    } else {
      sisa.push(a)
    }
  }
  if (!sisa.length) return hasil

  const sYd = stepYd(field)
  const intervalL = Math.max(1, opsi.intervalLangkah ?? INTERVAL_MASUKKAN_BAWAAN)
  const iv = intervalL * sYd
  const celah = Math.max(1, opsi.celahBlokLangkah ?? intervalL * 2) * sYd
  const box = fieldBox(field)
  const tepi = iv / 2
  const lebarPakai = box.maxX - box.minX - tepi * 2

  // 1) Ukuran tiap blok.
  const grup = kelompokkanPerSection(sisa, opsi.urutanSection).map((g) => {
    const kolom = kolomBlokUntuk(g.ids.length)
    const baris = Math.ceil(g.ids.length / kolom)
    return { ...g, kolom, baris, lebar: (kolom - 1) * iv, tinggi: (baris - 1) * iv }
  })

  // 2) Bagi ke jajaran (Side 1 → Side 2), turun ke belakang kalau tak muat.
  const jajaran: (typeof grup)[] = []
  let kini: typeof grup = []
  let lebarKini = 0
  for (const g of grup) {
    const tambah = (kini.length ? celah : 0) + g.lebar
    if (kini.length && lebarKini + tambah > lebarPakai) {
      jajaran.push(kini)
      kini = []
      lebarKini = 0
    }
    lebarKini += (kini.length ? celah : 0) + g.lebar
    kini.push(g)
  }
  if (kini.length) jajaran.push(kini)
  const tinggiJajaran = jajaran.map((j) => Math.max(...j.map((g) => g.tinggi)))
  const tinggiTotal = tinggiJajaran.reduce((a, b) => a + b, 0) + celah * (jajaran.length - 1)

  // 3) Tentukan y awal (sisi depan rombongan baru). y < 0 = sisi penonton.
  const terpakai = { ...pointsSekarang, ...hasil.points }
  const ada = rentangY(terpakai)
  let yAwal: number
  if (!ada) {
    yAwal = -tinggiTotal / 2
  } else if (ada.max + celah + tinggiTotal <= box.maxY - tepi) {
    yAwal = ada.max + celah
  } else if (ada.min - celah - tinggiTotal >= box.minY + tepi) {
    yAwal = ada.min - celah - tinggiTotal
  } else {
    // Tidak muat di mana pun — letakkan di belakang sebisanya (akan dijepit ke lapangan).
    yAwal = Math.max(box.minY + tepi, box.maxY - tepi - tinggiTotal)
  }

  // 4) Susun tiap blok memakai generator Grid Blok yang sudah ada.
  let y = yAwal
  jajaran.forEach((j, ji) => {
    const lebarJ = j.reduce((a, g) => a + g.lebar, 0) + celah * (j.length - 1)
    let x = lebarJ / 2 // ujung Side 1 (x positif)
    for (const g of j) {
      const pusat = { x: x - g.lebar / 2, y: y + g.tinggi / 2 }
      const titik = susunBentukCepat(g.ids, {}, field, {
        ...OPSI_BENTUK_BAWAAN,
        jenis: 'blok',
        intervalLangkah: intervalL,
        jarakBarisLangkah: intervalL,
        kolomBlok: g.kolom,
        pusatYd: pusat,
        snap: opsi.snap !== false,
      })
      Object.assign(hasil.points, titik)
      hasil.blok.push({ section: g.section, ids: g.ids, kolom: g.kolom, baris: g.baris, pusat })
      x -= g.lebar + celah
    }
    y += tinggiJajaran[ji] + celah
  })
  return hasil
}

/**
 * Pemain berikutnya untuk mode "tempatkan beruntun": yang belum punya titik,
 * sesudah `idKini` dalam urutan daftar; berputar ke awal bila perlu.
 */
export function berikutnyaBelumDitempatkan(
  urutanIds: string[],
  sudahAda: (id: string) => boolean,
  idKini: string | null,
): string | null {
  if (!urutanIds.length) return null
  const mulai = idKini ? urutanIds.indexOf(idKini) : -1
  for (let k = 1; k <= urutanIds.length; k++) {
    const id = urutanIds[(mulai + k + urutanIds.length) % urutanIds.length]
    if (id !== idKini && !sudahAda(id)) return id
  }
  return null
}
