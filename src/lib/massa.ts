import type { DrillPoint, Facing } from '../db/types'
import { facingDeg } from './field'

/**
 * DD4 — Alat gerak massa (putar, kembang-kempis, cermin, geser blok).
 *
 * Sengaja dipisah dari halaman editor supaya:
 *  - hitungannya bisa diuji sendiri tanpa browser,
 *  - kelak bisa dipakai lagi dari "bentuk cepat" atau alat baris-baris.
 *
 * Catatan sumbu (lihat `src/lib/field.ts`):
 *   x = memanjang lapangan, 0 di garis 50, positif ke arah SIDE 1
 *   y = melintang lapangan, 0 di tengah, positif ke arah BACK SIDELINE
 */

export type Titik = { x: number; y: number }

/** Titik tengah (pusat) sekumpulan titik. `null` kalau kosong. */
export function pusatKumpulan(daftar: DrillPoint[]): Titik | null {
  if (!daftar.length) return null
  let sx = 0
  let sy = 0
  for (const p of daftar) {
    sx += p.x
    sy += p.y
  }
  return { x: sx / daftar.length, y: sy / daftar.length }
}

/* -------------------------------------------------------------------------- */
/*  Arah hadap                                                                 */
/* -------------------------------------------------------------------------- */

/** Derajat → arah hadap tetap; kalau tidak pas, jadi `custom`. */
function hadapDariDerajat(derajat: number): { facing: Facing; facingDeg?: number } {
  const d = ((derajat % 360) + 360) % 360
  const TETAP: [Facing, number][] = [
    ['front', 0],
    ['left', 90],
    ['back', 180],
    ['right', 270],
  ]
  for (const [f, v] of TETAP) {
    const beda = Math.abs(((d - v + 540) % 360) - 180)
    if (beda < 0.5) return { facing: f }
  }
  return { facing: 'custom', facingDeg: Math.round(d * 10) / 10 }
}

/**
 * Putar arah hadap sebesar `derajat`.
 *
 * Kalau hasilnya jatuh tepat pada front/left/back/right, disimpan sebagai arah
 * tetap supaya tetap mudah dibaca. Selain itu disimpan sebagai `custom`.
 */
export function putarHadap(p: DrillPoint, derajat: number): Pick<DrillPoint, 'facing' | 'facingDeg'> {
  const awal = facingDeg(p.facing, p.facingDeg)
  return hadapDariDerajat(awal + derajat)
}

/**
 * Cerminkan arah hadap.
 *  - sumbu `x` (kiri ⇄ kanan): arah hadap dibalik terhadap sumbu melintang,
 *    jadi `left` ⇄ `right` — front & back tetap.
 *  - sumbu `y` (depan ⇄ belakang): `front` ⇄ `back` — left & right tetap.
 */
export function cerminHadap(p: DrillPoint, sumbu: 'x' | 'y'): Pick<DrillPoint, 'facing' | 'facingDeg'> {
  const awal = facingDeg(p.facing, p.facingDeg)
  return hadapDariDerajat(sumbu === 'x' ? -awal : 180 - awal)
}

/* -------------------------------------------------------------------------- */
/*  Transformasi                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Putar titik mengitari `pusat` sebesar `derajat` (positif = searah jarum jam
 * jika dilihat dari atas lapangan).
 *
 * Arah hadap ikut berputar **hanya kalau kelipatan 90°** — kelipatan lain
 * (15°, 30°, 45°) menghasilkan arah diagonal yang tidak ada padanannya di
 * pilihan arah hadap, jadi sengaja dibiarkan.
 */
export function putarTitik(p: DrillPoint, pusat: Titik, derajat: number): DrillPoint {
  const r = (derajat * Math.PI) / 180
  const cos = Math.cos(r)
  const sin = Math.sin(r)
  const dx = p.x - pusat.x
  const dy = p.y - pusat.y
  const baru: DrillPoint = {
    ...p,
    x: pusat.x + dx * cos - dy * sin,
    y: pusat.y + dx * sin + dy * cos,
  }
  if (Math.abs(derajat % 90) < 1e-9) Object.assign(baru, putarHadap(p, derajat))
  return baru
}

/**
 * Kembang-kempis: jarak titik dari `pusat` dikalikan `faktor`.
 * `1.1` = 10% lebih besar, `0.9` = 10% lebih kecil. Arah hadap tidak berubah.
 */
export function skalaTitik(p: DrillPoint, pusat: Titik, faktor: number): DrillPoint {
  return {
    ...p,
    x: pusat.x + (p.x - pusat.x) * faktor,
    y: pusat.y + (p.y - pusat.y) * faktor,
  }
}

/**
 * Cermin terhadap garis tengah lapangan.
 *  - `x`: kiri ⇄ kanan (sepanjang garis yard)
 *  - `y`: depan ⇄ belakang (satu sideline ke sideline lain)
 */
export function cerminTitik(p: DrillPoint, sumbu: 'x' | 'y'): DrillPoint {
  const baru: DrillPoint = sumbu === 'x' ? { ...p, x: -p.x } : { ...p, y: -p.y }
  Object.assign(baru, cerminHadap(p, sumbu))
  return baru
}

/** Geser titik sejauh `dx`/`dy` yard. Arah hadap tidak berubah. */
export function geserTitik(p: DrillPoint, dx: number, dy: number): DrillPoint {
  return { ...p, x: p.x + dx, y: p.y + dy }
}
