/**
 * #12c & #16.2 — Generator Bentuk Cepat (Shape Generators) & Transformasi Blok.
 *
 * Modul geometri murni tanpa ketergantungan DOM/React, sehingga:
 *  - menghasilkan pratinjau langsung (*live ghost preview*) di kanvas SVG
 *    sebelum pelatih menekan "Terapkan",
 *  - menjaga arah hadap (`facing` / `facingDeg`) tetap konsisten saat cermin
 *    maupun putaran,
 *  - dapat diuji langsung di rangkaian uji logika murni (`qa/`).
 */
import type { DrillPoint, Facing, FieldConfig } from '../db/types'
import { facingDeg as hitungFacingDeg, fieldBox, stepYd } from './field'

function snapToStep(x: number, y: number, f: FieldConfig): { x: number; y: number } {
  const s = stepYd(f)
  return {
    x: (Math.round((x / s) * 4) / 4) * s,
    y: (Math.round((y / s) * 4) / 4) * s,
  }
}

function clampToField(x: number, y: number, f: FieldConfig): { x: number; y: number } {
  const box = fieldBox(f)
  return {
    x: Math.max(box.minX + 0.5, Math.min(box.maxX - 0.5, x)),
    y: Math.max(box.minY + 0.5, Math.min(box.maxY - 0.5, y)),
  }
}

export type JenisBentukCepat =
  | 'company_front'
  | 'busur'
  | 'lingkaran'
  | 'blok'
  | 'garis_diagonal'

export interface OpsiBentukCepat {
  jenis: JenisBentukCepat
  /** Jarak antar pemain dalam langkah (bawaan 2 langkah = 2-step interval) */
  intervalLangkah: number
  /** Jarak antar baris belakang-depan untuk Grid Blok, dalam langkah (bawaan 4) */
  jarakBarisLangkah: number
  /** Jumlah kolom untuk Grid Blok (bawaan 4) */
  kolomBlok: number
  /** Kedalaman lengkungan untuk Busur dalam langkah (positif = cekung ke penonton / Brass Arc) */
  lengkunganLangkah: number
  /** Jari-jari Lingkaran dalam langkah (bawaan 8) */
  jariJariLangkah: number
  /** Sudut kemiringan untuk Garis Diagonal dalam derajat (-60..60, bawaan 25) */
  sudutDerajat: number
  /** Titik pusat bentuk dalam yard (bawaan { x: 0, y: 0 } atau rata-rata titik terpilih) */
  pusatYd?: { x: number; y: number }
  /** Snap hasil akhir ke grid langkah lapangan */
  snap?: boolean
}

export const DAFTAR_BENTUK_CEPAT: {
  id: JenisBentukCepat
  label: string
  ringkas: string
}[] = [
  {
    id: 'company_front',
    label: 'Company Front',
    ringkas: 'Baris lurus sejajar menghadap penonton dengan interval langkah presisi',
  },
  {
    id: 'busur',
    label: 'Arc / Kurva',
    ringkas: 'Lengkungan akustik (Brass Arc) atau kubah menghadap penonton',
  },
  {
    id: 'lingkaran',
    label: 'Lingkaran',
    ringkas: 'Susunan melingkar merata mengitari titik pusat',
  },
  {
    id: 'blok',
    label: 'Grid Blok',
    ringkas: 'Barisan kotak kolom × saf dengan jarak samping & depan-belakang tetap',
  },
  {
    id: 'garis_diagonal',
    label: 'Garis Miring',
    ringkas: 'Baris lurus miring pada sudut derajat pilihan',
  },
]

export const OPSI_BENTUK_BAWAAN: OpsiBentukCepat = {
  jenis: 'company_front',
  intervalLangkah: 2,
  jarakBarisLangkah: 4,
  kolomBlok: 4,
  lengkunganLangkah: 6,
  jariJariLangkah: 8,
  sudutDerajat: 25,
  snap: true,
}

export function facingDariDerajat(deg: number): { facing: Facing; facingDeg?: number } {
  const n = ((Math.round(deg) % 360) + 360) % 360
  if (n === 0) return { facing: 'front' }
  if (n === 180) return { facing: 'back' }
  if (n === 90) return { facing: 'left' }
  if (n === 270) return { facing: 'right' }
  return { facing: 'custom', facingDeg: n }
}

/** Hitung titik tengah (centroid) dari himpunan pemain yang sudah ada di set. */
export function pusatTitikTerpilih(
  ids: string[],
  points: Record<string, DrillPoint>,
): { x: number; y: number } {
  const ada = ids.map((id) => points[id]).filter(Boolean)
  if (!ada.length) return { x: 0, y: 0 }
  const sx = ada.reduce((s, p) => s + p.x, 0) / ada.length
  const sy = ada.reduce((s, p) => s + p.y, 0) / ada.length
  return { x: sx, y: sy }
}

/**
 * Bangun peta koordinat baru (`memberId -> DrillPoint`) untuk bentuk cepat `#16.2`.
 * Urutan `ids` dipertahankan dari kiri ke kanan (Side 1 ke Side 2) agar nomor
 * kode pemain (`T1, T2, T3...`) berjejer rapi tanpa bersilangan!
 */
export function susunBentukCepat(
  ids: string[],
  pointsSekarang: Record<string, DrillPoint>,
  field: FieldConfig,
  opsi: OpsiBentukCepat,
): Record<string, DrillPoint> {
  const n = ids.length
  if (!n) return {}
  const sYd = stepYd(field)
  const intervalYd = Math.max(0.5, opsi.intervalLangkah) * sYd
  const pusat = opsi.pusatYd ?? pusatTitikTerpilih(ids, pointsSekarang)
  const hasil: Record<string, DrillPoint> = {}

  const rapikan = (x: number, y: number, base?: DrillPoint): DrillPoint => {
    const disnap = opsi.snap !== false ? snapToStep(x, y, field) : { x, y }
    const dijepit = clampToField(disnap.x, disnap.y, field)
    return {
      ...(base ?? {}),
      x: Math.round(dijepit.x * 1000) / 1000,
      y: Math.round(dijepit.y * 1000) / 1000,
      facing: base?.facing ?? 'front',
      facingDeg: base?.facing ? base.facingDeg : undefined,
    }
  }

  if (opsi.jenis === 'company_front') {
    // Di koordinat lapangan DrillKit: +x = Side 1 (kiri penonton), -x = Side 2 (kanan penonton),
    // -y = depan (dekat penonton), +y = belakang.
    const lebarTotal = (n - 1) * intervalYd
    ids.forEach((id, i) => {
      const x = pusat.x + lebarTotal / 2 - i * intervalYd
      const pt = rapikan(x, pusat.y, pointsSekarang[id])
      pt.facing = 'front'
      delete pt.facingDeg
      hasil[id] = pt
    })
    return hasil
  }

  if (opsi.jenis === 'garis_diagonal') {
    const rad = (opsi.sudutDerajat * Math.PI) / 180
    const panjangTotal = (n - 1) * intervalYd
    const dx = -Math.cos(rad)
    const dy = Math.sin(rad)
    ids.forEach((id, i) => {
      const offset = i * intervalYd - panjangTotal / 2
      hasil[id] = rapikan(pusat.x - offset * -dx, pusat.y + offset * dy, pointsSekarang[id])
    })
    return hasil
  }

  if (opsi.jenis === 'busur') {
    const lebarTotal = Math.max(intervalYd, (n - 1) * intervalYd)
    const tinggiYd = opsi.lengkunganLangkah * sYd
    ids.forEach((id, i) => {
      const u = n === 1 ? 0 : (i / (n - 1)) * 2 - 1 // -1 .. +1
      const x = pusat.x - u * (lebarTotal / 2)
      // Parabola simetris: di tengah (u = 0) bergeser sejauh +tinggiYd ke belakang (+y)
      // sehingga membentuk Brass Arc cekung menghadap penonton di -y!
      const offsetTengah = (1 - u * u) * tinggiYd - tinggiYd * 0.5
      const pt = rapikan(x, pusat.y + offsetTengah, pointsSekarang[id])
      pt.facing = 'front'
      delete pt.facingDeg
      hasil[id] = pt
    })
    return hasil
  }

  if (opsi.jenis === 'lingkaran') {
    const rYd = Math.max(sYd, opsi.jariJariLangkah * sYd)
    ids.forEach((id, i) => {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2
      const x = pusat.x + Math.cos(a) * rYd
      const y = pusat.y + Math.sin(a) * rYd
      hasil[id] = rapikan(x, y, pointsSekarang[id])
    })
    return hasil
  }

  // 'blok' (Grid Blok kolom × baris)
  const cols = Math.max(1, Math.round(opsi.kolomBlok || Math.ceil(Math.sqrt(n))))
  const rows = Math.ceil(n / cols)
  const spX = intervalYd
  const spY = Math.max(0.5, opsi.jarakBarisLangkah) * sYd
  ids.forEach((id, i) => {
    const c = i % cols
    const r = Math.floor(i / cols)
    const x = pusat.x + ((cols - 1) / 2 - c) * spX
    const y = pusat.y + (r - (rows - 1) / 2) * spY
    const pt = rapikan(x, y, pointsSekarang[id])
    pt.facing = 'front'
    delete pt.facingDeg
    hasil[id] = pt
  })
  return hasil
}

/**
 * Cerminkan titik terpilih/semua terhadap:
 * - `'lapangan'` (garis 50 yard untuk kiri-kanan, garis tengah y=0 untuk depan-belakang), atau
 * - `'pilihan'` (titik tengah blok pilihan sendiri).
 */
export function cerminTitikFormasi(
  ids: string[],
  pointsSekarang: Record<string, DrillPoint>,
  field: FieldConfig,
  sumbu: 'x' | 'y',
  poros: 'lapangan' | 'pilihan' = 'lapangan',
  snap = true,
): Record<string, DrillPoint> {
  const ada = ids.filter((id) => pointsSekarang[id])
  if (!ada.length) return {}
  const pusat = poros === 'pilihan' ? pusatTitikTerpilih(ada, pointsSekarang) : { x: 0, y: 0 }
  const hasil: Record<string, DrillPoint> = {}

  for (const id of ada) {
    const p = pointsSekarang[id]
    const rawX = sumbu === 'x' ? 2 * pusat.x - p.x : p.x
    const rawY = sumbu === 'y' ? 2 * pusat.y - p.y : p.y
    const disnap = snap ? snapToStep(rawX, rawY, field) : { x: rawX, y: rawY }
    const dijepit = clampToField(disnap.x, disnap.y, field)
    const degLama = hitungFacingDeg(p.facing, p.facingDeg)
    const degBaru = sumbu === 'x' ? (360 - degLama) % 360 : (180 - degLama + 360) % 360
    hasil[id] = {
      ...p,
      ...dijepit,
      ...facingDariDerajat(degBaru),
    }
  }
  return hasil
}
