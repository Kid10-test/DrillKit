/**
 * #25 (`v2.2.3`) — Pratinjau Perspektif Tribun Juri (*Press Box View*),
 * Deteksi Halangan Pandang (*Visual Occlusion*), & Simulasi Kontras Seragam/Bendera.
 *
 * Seluruh proyeksi kamera 3D → 2D, uji potong sinar (*ray-box occlusion*), perhitungan
 * rasio kontras luminansi WCAG 2.1, serta penggambaran kanvas 2.5D ditulis 100%
 * clean-room dalam TypeScript murni tanpa pustaka 3D/WebGL eksternal (`0` dependensi baru)
 * dan hanya memakai warna `#hex` murni (`#rrggbb` + `globalAlpha`).
 */

import type {
  AlatGuard,
  CountSheet,
  DrillSet,
  FieldConfig,
  FieldMarker,
  Member,
  PresetLatarTribun,
  PresetSudutTribun,
  SkemaVisualTribun,
} from '../db/types'
import { WARNA_ALAT_GUARD_HEX, apakahAnggotaGuard, urutkanBlokCountSheet } from './countSheet'
import {
  HASH_OFFSET_YD,
  M_TO_YD,
  apakahModeParade,
  daftarPatok,
  facingDeg,
  garisGridUtama,
  garisSubgrid,
  gridUtamaTampil,
  hashGarisTampil,
  paradeOf,
  patokGarisTampil,
  patokOf,
  subgridTampil,
  warnaGarisGrid,
  warnaLapangan,
} from './field'
import {
  bangunPetaFtl,
  cocokPutaran,
  deltaBusur,
  deltaMidsets,
  deltaPoliFtl,
  gerakOf,
  kelompokPemain,
  progresPemain,
  sinkronkanKelompokDariTag,
  titikJalur,
} from './gerak'
import { penandaEfektifPadaSet } from './propertiGerak'

/* ============================================================================
 * 1. Konstanta Preset Sudut Pandang, Latar Lapangan, & Skema Seragam Bawaan
 * ========================================================================== */

export interface InfoPresetSudutTribun {
  id: PresetSudutTribun
  label: string
  labelPendek: string
  /** Ketinggian mata pengamat di atas permukaan lapangan (meter). */
  tinggiMataM: number
  /** Jarak mundur pengamat di depan Front Sideline ke arah tribun (meter). */
  jarakMundurM: number
  keterangan: string
}

export const DAFTAR_PRESET_SUDUT_TRIBUN: readonly InfoPresetSudutTribun[] = [
  {
    id: 'podium',
    label: 'Podium Gitapati (3 m)',
    labelPendek: 'Podium 3 m',
    tinggiMataM: 3.0,
    jarakMundurM: 7.5,
    keterangan: 'Sudut pandang rendah dari menara komando Gitapati di tepi depan lapangan.',
  },
  {
    id: 'tribun_rendah',
    label: 'Tribun Rendah (8 m)',
    labelPendek: 'Tribun 8 m',
    tinggiMataM: 8.0,
    jarakMundurM: 16.0,
    keterangan: 'Sudut pandang stadion daerah / GOR menengah (~18°–22°).',
  },
  {
    id: 'press_box',
    label: 'Tribun Stadion / Press Box (18 m)',
    labelPendek: 'Press Box 18 m',
    tinggiMataM: 18.0,
    jarakMundurM: 28.0,
    keterangan: 'Sudut pandang juri General Effect & Visual di balkon stadion utama (~28°).',
  },
  {
    id: 'atas',
    label: 'Atas Tegak Lurus (90°)',
    labelPendek: 'Atas 90°',
    tinggiMataM: 90.0,
    jarakMundurM: 0,
    keterangan: 'Tampilan denah atas murni tanpa pemendekan perspektif untuk pembanding 1:1.',
  },
]

export const DAFTAR_PRESET_LATAR_TRIBUN: readonly {
  id: PresetLatarTribun
  label: string
  rumputHex: string
  zonaHex: string
  garisHex: string
}[] = [
  {
    id: 'sesuai_drill',
    label: 'Ikuti Pengaturan Lapangan Drill',
    rumputHex: '#0c261c',
    zonaHex: '#091c15',
    garisHex: '#dcfce7',
  },
  {
    id: 'rumput_stadion',
    label: 'Rumput Hijau Stadion Terbuka',
    rumputHex: '#166534',
    zonaHex: '#14532d',
    garisHex: '#f8fafc',
  },
  {
    id: 'biru_indoor',
    label: 'Terpal / Karpet Biru Indoor',
    rumputHex: '#1e3a8a',
    zonaHex: '#172554',
    garisHex: '#e0f2fe',
  },
  {
    id: 'abu_gor',
    label: 'Lantai Semen / Parket Abu-abu GOR',
    rumputHex: '#475569',
    zonaHex: '#334155',
    garisHex: '#f8fafc',
  },
  {
    id: 'aspal_parade',
    label: 'Aspal Jalan Raya / Kirab',
    rumputHex: '#1f2937',
    zonaHex: '#374151',
    garisHex: '#fef08a',
  },
]

export const SKEMA_VISUAL_TRIBUN_BAWAAN: SkemaVisualTribun = {
  jaketHex: '#1d4ed8', // biru royal tegas
  celanaHex: '#f8fafc', // putih kontras langkah kaki
  plumeHex: '#fde047', // kuning emas topi/plume
  warnaBenderaHex: '#f43f5e', // merah kirmizi bendera Guard
  latar: 'rumput_stadion',
  tinggiPemainMeter: 1.72,
}

export const PALET_CEPAT_SERAGAM_HEX: readonly string[] = [
  '#f8fafc', // putih bersih
  '#0f172a', // hitam navy
  '#1d4ed8', // biru royal
  '#38bdf8', // biru langit
  '#dc2626', // merah menyala
  '#f43f5e', // merah mawar
  '#f59e0b', // emas oranye
  '#fde047', // kuning cerah
  '#10b981', // zamrud
  '#166534', // hijau tua (contoh rawan tenggelam di rumput!)
  '#9333ea', // ungu kerajaan
  '#ec4899', // magenta bendera
]

export function normalisasiSkemaVisualTribun(
  masuk?: Partial<SkemaVisualTribun> | null,
): SkemaVisualTribun {
  return {
    jaketHex: bersihkanWarnaHex(masuk?.jaketHex, SKEMA_VISUAL_TRIBUN_BAWAAN.jaketHex),
    celanaHex: bersihkanWarnaHex(masuk?.celanaHex, SKEMA_VISUAL_TRIBUN_BAWAAN.celanaHex),
    plumeHex: bersihkanWarnaHex(masuk?.plumeHex, SKEMA_VISUAL_TRIBUN_BAWAAN.plumeHex),
    warnaBenderaHex: bersihkanWarnaHex(
      masuk?.warnaBenderaHex,
      SKEMA_VISUAL_TRIBUN_BAWAAN.warnaBenderaHex,
    ),
    latar: masuk?.latar ?? SKEMA_VISUAL_TRIBUN_BAWAAN.latar,
    tinggiPemainMeter: Math.min(2.15, Math.max(1.35, Number(masuk?.tinggiPemainMeter) || 1.72)),
  }
}

export function warnaLatarEfektifTribun(
  latar: PresetLatarTribun,
  field: FieldConfig,
): { rumputHex: string; zonaHex: string; garisHex: string } {
  if (latar === 'sesuai_drill') {
    const wl = warnaLapangan(field)
    const wg = warnaGarisGrid(field)
    return {
      rumputHex: bersihkanWarnaHex(wl.rumput, '#0c261c'),
      zonaHex: bersihkanWarnaHex(wl.zona, '#091c15'),
      garisHex: bersihkanWarnaHex(wg.hex, '#dcfce7'),
    }
  }
  const ketemu = DAFTAR_PRESET_LATAR_TRIBUN.find((p) => p.id === latar)
  return ketemu
    ? { rumputHex: ketemu.rumputHex, zonaHex: ketemu.zonaHex, garisHex: ketemu.garisHex }
    : { rumputHex: '#166534', zonaHex: '#14532d', garisHex: '#f8fafc' }
}

/* ============================================================================
 * 2. Utilitas Warna Murni #hex & Rasio Kontras Luminansi WCAG 2.1
 * ========================================================================== */

export function bersihkanWarnaHex(input: string | undefined | null, cadangan = '#f8fafc'): string {
  const s = (input ?? '').trim()
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toLowerCase()
  if (/^#[0-9a-fA-F]{3}$/.test(s)) {
    const r = s[1]
    const g = s[2]
    const b = s[3]
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase()
  }
  return cadangan.toLowerCase()
}

export function uraiRgbHex(hex: string): { r: number; g: number; b: number } {
  const bersih = bersihkanWarnaHex(hex, '#000000')
  return {
    r: parseInt(bersih.slice(1, 3), 16),
    g: parseInt(bersih.slice(3, 5), 16),
    b: parseInt(bersih.slice(5, 7), 16),
  }
}

/** Terangkan (> 1) atau gelapkan (< 1) warna `#hex` dan kembalikan `#rrggbb` murni. */
export function ubahKecerahanHex(hex: string, faktor: number): string {
  const { r, g, b } = uraiRgbHex(hex)
  const jepit = (v: number) => Math.max(0, Math.min(255, Math.round(v * faktor)))
  const ke2 = (v: number) => jepit(v).toString(16).padStart(2, '0')
  return `#${ke2(r)}${ke2(g)}${ke2(b)}`
}

/** Luminansi relatif sRGB menurut rumus baku WCAG 2.1 (`0.0` hitam .. `1.0` putih). */
export function luminansiRelatifHex(hex: string): number {
  const { r, g, b } = uraiRgbHex(hex)
  const lin = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

/** Rasio kontras antara dua warna `#hex` (`1,00` identik s.d. `21,00` hitam-putih). */
export function hitungRasioKontrasHex(hexA: string, hexB: string): number {
  const l1 = luminansiRelatifHex(hexA)
  const l2 = luminansiRelatifHex(hexB)
  const terang = Math.max(l1, l2)
  const gelap = Math.min(l1, l2)
  return Math.round(((terang + 0.05) / (gelap + 0.05)) * 100) / 100
}

export type TingkatKontrasVisual = 'tajam' | 'cukup' | 'tenggelam'

export interface ButirEvaluasiKontras {
  id: string
  elemen: string
  warnaHex: string
  latarHex: string
  rasio: number
  tingkat: TingkatKontrasVisual
  catatan: string
}

export interface HasilEvaluasiKontras {
  latarHex: string
  butir: ButirEvaluasiKontras[]
  jmlTenggelam: number
  jmlCukup: number
}

function tingkatDariRasio(rasio: number): TingkatKontrasVisual {
  if (rasio >= 3.0) return 'tajam'
  if (rasio >= 1.8) return 'cukup'
  return 'tenggelam'
}

/**
 * Evaluasi keterbacaan kontras Jaket, Celana (langkah kaki!), Plume, & Kain Bendera Guard
 * terhadap warna permukaan lapangan dari jarak pandang tribun juri.
 */
export function evaluasiKontrasVisual(
  skemaInput: Partial<SkemaVisualTribun> | undefined,
  field: FieldConfig,
  warnaBenderaTambahan: readonly { label: string; warnaHex: string }[] = [],
): HasilEvaluasiKontras {
  const skema = normalisasiSkemaVisualTribun(skemaInput)
  const { rumputHex } = warnaLatarEfektifTribun(skema.latar, field)

  const calon: { id: string; elemen: string; warnaHex: string; fungsi: string }[] = [
    {
      id: 'jaket',
      elemen: 'Jaket Seragam',
      warnaHex: skema.jaketHex,
      fungsi: 'garis bentuk blok tubuh dari Press Box',
    },
    {
      id: 'celana',
      elemen: 'Celana / Kaki',
      warnaHex: skema.celanaHex,
      fungsi: 'keterbacaan keseragaman teknik langkah kaki',
    },
    {
      id: 'plume',
      elemen: 'Plume / Topi',
      warnaHex: skema.plumeHex,
      fungsi: 'penegas titik kepala & tinggi barisan',
    },
    {
      id: 'bendera_utama',
      elemen: 'Bendera Guard Utama',
      warnaHex: skema.warnaBenderaHex,
      fungsi: 'efek visual kibaran kain Color Guard',
    },
  ]

  const sudahWarnaBendera = new Set<string>([bersihkanWarnaHex(skema.warnaBenderaHex)])
  warnaBenderaTambahan.forEach((wb, i) => {
    const bersih = bersihkanWarnaHex(wb.warnaHex)
    if (sudahWarnaBendera.has(bersih)) return
    sudahWarnaBendera.add(bersih)
    calon.push({
      id: `bendera_blok_${i}`,
      elemen: wb.label || `Bendera Blok #${i + 1}`,
      warnaHex: bersih,
      fungsi: 'pergantian kain bendera pada lembar hitungan',
    })
  })

  const butir: ButirEvaluasiKontras[] = calon.map((c) => {
    const rasio = hitungRasioKontrasHex(c.warnaHex, rumputHex)
    const tingkat = tingkatDariRasio(rasio)
    const catatan =
      tingkat === 'tajam'
        ? `Kontras sangat jelas (${rasio.toFixed(2)}:1) untuk ${c.fungsi}.`
        : tingkat === 'cukup'
          ? `Kontras sedang (${rasio.toFixed(2)}:1) — masih terbaca namun kurang menonjol di lampu redup.`
          : `Rawan tenggelam di permukaan lapangan (${rasio.toFixed(2)}:1 < 1,8:1) — sulit dibaca juri tribun!`
    return {
      id: c.id,
      elemen: c.elemen,
      warnaHex: c.warnaHex,
      latarHex: rumputHex,
      rasio,
      tingkat,
      catatan,
    }
  })

  return {
    latarHex: rumputHex,
    butir,
    jmlTenggelam: butir.filter((b) => b.tingkat === 'tenggelam').length,
    jmlCukup: butir.filter((b) => b.tingkat === 'cukup').length,
  }
}

/* ============================================================================
 * 3. Proyeksi Kamera Perspektif 2.5D Murni Matematika
 * ========================================================================== */

export interface HasilProyeksiTitik {
  /** Koordinat X piksel di layar (`0` = kiri .. `lebarPx` = kanan). */
  sx: number
  /** Koordinat Y piksel di layar (`0` = atas .. `tinggiPx` = bawah). */
  sy: number
  /** Jarak kedalaman titik dari mata kamera dalam yard (untuk pengurutan *painter's algorithm*). */
  depthYd: number
  /** Skala ukuran tampak lokal pada kedalaman ini (piksel per 1 yard dunia nyata). */
  skalaPxPerYd: number
}

export interface KameraTribun {
  preset: PresetSudutTribun
  lebarPx: number
  tinggiPx: number
  /** Posisi mata pengamat di ruang lapangan `(xYd, yYd, zYd)`. */
  mataYd: { x: number; y: number; z: number }
  /** Proyeksi titik `(xYd, yYd, zMeter)` ke ruang piksel kanvas. */
  proyeksikan: (xYd: number, yYd: number, zMeter?: number) => HasilProyeksiTitik
}

/**
 * Bangun matriks proyeksi kamera perspektif (atau ortografik atas `90°`) yang
 * otomatis membingkai seluruh luas lapangan + tinggi siluet (`0..3,6 m`) secara proporsional.
 *
 * Konvensi sumbu internal DrillKit:
 *  - `xYd > 0` = Side 1 (kiri panggung penonton), `xYd < 0` = Side 2 (kanan panggung penonton).
 *  - `yYd = -halfW` = Front Sideline (dekat penonton/bawah layar), `yYd = +halfW` = Back Sideline (jauh/atas layar).
 *  - `zMeter >= 0` = tinggi vertikal di atas rumput (dikonversi ke yard lewat `M_TO_YD`).
 */
export function buatKameraTribun(
  field: FieldConfig,
  preset: PresetSudutTribun,
  lebarPx: number,
  tinggiPx: number,
  adaHudAtas = true,
): KameraTribun {
  const halfL = (field.lengthYd + field.endZoneYd * 2) / 2
  const halfW = field.widthYd / 2
  const W = Math.max(160, lebarPx)
  const H = Math.max(120, tinggiPx)
  const padKiriKanan = Math.max(18, W * 0.038)
  const padAtas = (adaHudAtas ? 42 : 16) + H * 0.025
  const padBawah = Math.max(16, H * 0.04)
  const ruangW = Math.max(60, W - padKiriKanan * 2)
  const ruangH = Math.max(60, H - padAtas - padBawah)

  if (preset === 'atas') {
    const skala = Math.min(ruangW / Math.max(1, halfL * 2), ruangH / Math.max(1, halfW * 2))
    const cx = W / 2
    const cy = padAtas + ruangH / 2
    const mataZ = 90 * M_TO_YD
    return {
      preset,
      lebarPx: W,
      tinggiPx: H,
      mataYd: { x: 0, y: 0, z: mataZ },
      proyeksikan(xYd: number, yYd: number, zMeter = 0): HasilProyeksiTitik {
        const zYd = zMeter * M_TO_YD
        return {
          sx: cx - xYd * skala,
          sy: cy - yYd * skala - zYd * skala * 0.1,
          // Urutkan sedikit dari Back Sideline (+y) ke Front Sideline (-y) serta dari bawah ke atas
          depthYd: mataZ - zYd + yYd * 0.05,
          skalaPxPerYd: skala,
        }
      },
    }
  }

  const info =
    DAFTAR_PRESET_SUDUT_TRIBUN.find((p) => p.id === preset) ?? DAFTAR_PRESET_SUDUT_TRIBUN[2]
  const camX = 0
  const camY = -halfW - info.jarakMundurM * M_TO_YD
  const camZ = info.tinggiMataM * M_TO_YD

  // Titik bidik sedikit di depan pusat lapangan agar proporsi depan–belakang seimbang
  const targetY = -halfW * 0.06
  const targetZ = 0.55
  const dyT = targetY - camY
  const dzT = targetZ - camZ
  const panjangF = Math.hypot(dyT, dzT) || 1
  const fy = dyT / panjangF // > 0 (mengarah ke Back Sideline)
  const fz = dzT / panjangF // < 0 (menunduk ke lapangan)

  // Vektor kamera:
  // Right  R = (-1,  0,   0) -> +xYd (Side 1) tampil di kiri, -xYd (Side 2) tampil di kanan
  // Forward F = ( 0, fy,  fz)
  // Up      U = ( 0, -fz, fy) -> komponen Z = fy > 0 sehingga kepala/properti berdiri tegak ke atas!
  const mentahNorm = (xYd: number, yYd: number, zYd: number) => {
    const rx = -(xYd - camX)
    const ry = yYd - camY
    const rz = zYd - camZ
    const depthYd = Math.max(1.2, ry * fy + rz * fz)
    const camUp = -ry * fz + rz * fy
    return {
      u: rx / depthYd,
      v: -camUp / depthYd,
      depthYd,
    }
  }

  // Bingkai otomatis 8 titik sudut kotak stadion (±halfL, ±halfW, tinggi 0..3.6 m)
  let uMin = Number.POSITIVE_INFINITY
  let uMax = Number.NEGATIVE_INFINITY
  let vMin = Number.POSITIVE_INFINITY
  let vMax = Number.NEGATIVE_INFINITY
  const zAtasYd = 3.6 * M_TO_YD

  for (const sxSudut of [-halfL, halfL]) {
    for (const sySudut of [-halfW, halfW]) {
      for (const szSudut of [0, zAtasYd]) {
        const pr = mentahNorm(sxSudut, sySudut, szSudut)
        if (pr.u < uMin) uMin = pr.u
        if (pr.u > uMax) uMax = pr.u
        if (pr.v < vMin) vMin = pr.v
        if (pr.v > vMax) vMax = pr.v
      }
    }
  }

  const rentangU = Math.max(1e-4, uMax - uMin)
  const rentangV = Math.max(1e-4, vMax - vMin)
  const fokusPx = Math.min(ruangW / rentangU, ruangH / rentangV)
  const uTengah = (uMin + uMax) / 2
  const vTengah = (vMin + vMax) / 2
  const pusatLayarX = W / 2
  const pusatLayarY = padAtas + ruangH / 2

  return {
    preset,
    lebarPx: W,
    tinggiPx: H,
    mataYd: { x: camX, y: camY, z: camZ },
    proyeksikan(xYd: number, yYd: number, zMeter = 0): HasilProyeksiTitik {
      const zYd = zMeter * M_TO_YD
      const { u, v, depthYd } = mentahNorm(xYd, yYd, zYd)
      return {
        sx: pusatLayarX + (u - uTengah) * fokusPx,
        sy: pusatLayarY + (v - vTengah) * fokusPx,
        depthYd,
        skalaPxPerYd: fokusPx / depthYd,
      }
    },
  }
}

/* ============================================================================
 * 4. Evaluasi Bingkai Show (Posisi Pemain, Arah Hadap, Properti, & Bendera #17)
 * ========================================================================== */

export interface BingkaiPemainTribun {
  id: string
  anggota: Member
  x: number
  y: number
  facingDeg: number
  sedangMelangkah: boolean
  faseLangkahRad: number
  apakahGuard: boolean
  alatGuard?: AlatGuard
  warnaBenderaHex?: string
  sedangTossGuard?: boolean
}

export interface BingkaiShowTribun {
  pemain: BingkaiPemainTribun[]
  markers: FieldMarker[]
  hitunganSaatIni: number
  totalHitunganSet: number
  warnaBenderaAktif: { label: string; warnaHex: string }[]
}

function selisihSudutTerpendek(dariDeg: number, keDeg: number): number {
  let d = ((keDeg - dariDeg + 540) % 360) - 180
  if (d === -180) d = 180
  return d
}

function cariStatusGuardPadaSet(
  memberId: string,
  setId: string,
  hitunganKe: number,
  countSheets: readonly CountSheet[] | undefined,
  warnaBawaanHex: string,
): {
  alat: AlatGuard
  warnaHex: string
  sedangToss: boolean
  labelBlok?: string
} {
  if (countSheets?.length) {
    for (const cs of countSheets) {
      if (cs.memberIds?.length && !cs.memberIds.includes(memberId)) continue
      const urut = urutkanBlokCountSheet(cs.blok)
      const blokSet = urut.filter((b) => b.setId === setId)
      for (const b of blokSet) {
        const mulai = b.offsetDalamSet ?? 0
        const akhir = mulai + Math.max(1, b.counts || 8)
        if (hitunganKe >= mulai - 0.01 && hitunganKe <= akhir + 0.01) {
          const hitLokal = Math.max(1, Math.round(hitunganKe - mulai))
          const sedangToss = Boolean(b.aksenCount?.includes(hitLokal))
          const warnaHex = b.warnaBendera
            ? bersihkanWarnaHex(b.warnaBendera, warnaBawaanHex)
            : b.alat === 'flag' || b.alat === 'swing_flag'
              ? warnaBawaanHex
              : WARNA_ALAT_GUARD_HEX[b.alat]?.titikGelap || warnaBawaanHex
          return {
            alat: b.alat,
            warnaHex,
            sedangToss,
            labelBlok: b.labelBagian,
          }
        }
      }
    }
  }
  return {
    alat: 'flag',
    warnaHex: warnaBawaanHex,
    sedangToss: false,
  }
}

/**
 * Evaluasi posisi interpolasi seluruh pemain, arah hadap, properti bergerak (`#16.4`),
 * serta kain/alat Color Guard (`#17`) pada progres `p` (`0..1`) di `sets[idxSet]`.
 */
export function interpolasiBingkaiShow(opsi: {
  sets: DrillSet[]
  idxSet: number
  p: number
  anggota: Member[]
  markers?: FieldMarker[]
  countSheets?: CountSheet[]
  skemaVisual?: Partial<SkemaVisualTribun>
  hanya?: Set<string>
}): BingkaiShowTribun {
  const { sets, idxSet, anggota, markers = [], countSheets, hanya } = opsi
  const skema = normalisasiSkemaVisualTribun(opsi.skemaVisual)
  const dari = sets[idxSet]
  const ke = sets[idxSet + 1]
  const p = ke ? Math.min(1, Math.max(0, opsi.p)) : 0

  if (!dari) {
    return {
      pemain: [],
      markers: [],
      hitunganSaatIni: 0,
      totalHitunganSet: 8,
      warnaBenderaAktif: [],
    }
  }

  const counts = Math.max(1, dari.counts || 8)
  const hitunganSaatIni = Math.round(p * counts * 10) / 10
  const mentahG = gerakOf(dari.gerak)
  const klpSinkron = sinkronkanKelompokDariTag(mentahG.kelompok, anggota)
  const g = klpSinkron !== mentahG.kelompok ? { ...mentahG, kelompok: klpSinkron } : mentahG

  const petaFtl =
    ke && g.kelompok?.some((k) => k.jalur === 'ftl')
      ? bangunPetaFtl(g.kelompok, dari.points, ke.points)
      : new Map()

  const pt = g.jalur === 'busur' ? g.putar : undefined
  const geserBusur =
    pt && pt.pusatAkhir
      ? { x: pt.pusatAkhir.x - pt.pusat.x, y: pt.pusatAkhir.y - pt.pusat.y }
      : { x: 0, y: 0 }

  const pemain: BingkaiPemainTribun[] = []
  const petaWarnaBendera = new Map<string, string>()

  for (const m of anggota) {
    if (hanya && !hanya.has(m.id)) continue
    const awal = dari.points[m.id]
    if (!awal) continue
    const akhir = ke?.points[m.id] ?? awal
    const diam = !ke || !ke.points[m.id] || Math.hypot(akhir.x - awal.x, akhir.y - awal.y) < 1e-4

    let x = awal.x
    let y = awal.y
    let sedangMelangkah = false

    if (!diam && p > 0) {
      const t = progresPemain(p, g, m.section, counts, m.id)
      sedangMelangkah = t > 0.001 && t < 0.999
      const ftl = petaFtl.get(m.id)
      const klp = kelompokPemain(g, m.id)
      const kAkhir = klp
        ? klp.jalur === 'lengkung'
          ? (klp.lengkung ?? 0.4)
          : 0
        : g.jalur === 'lengkung'
          ? g.lengkung
          : 0

      if (ftl) {
        const [dx, dy] = deltaPoliFtl(ftl, t)
        x = awal.x + dx
        y = awal.y + dy
      } else if (dari.midsets?.[m.id]?.length) {
        const [dx, dy] = deltaMidsets(
          awal,
          akhir,
          dari.midsets[m.id],
          counts,
          p,
          kAkhir,
          klp?.jalanCount ?? g.jalanCount,
        )
        x = awal.x + dx
        y = awal.y + dy
      } else if (klp) {
        const [dx, dy] = titikJalur(
          t,
          akhir.x - awal.x,
          akhir.y - awal.y,
          klp.jalur === 'lengkung' ? (klp.lengkung ?? 0.4) : 0,
        )
        x = awal.x + dx
        y = awal.y + dy
      } else if (
        pt &&
        pt.sudut &&
        cocokPutaran(awal.x, awal.y, akhir.x, akhir.y, pt.pusat, pt.sudut, geserBusur)
      ) {
        const [dx, dy] = deltaBusur(t, awal.x, awal.y, pt.pusat, pt.sudut, geserBusur)
        x = awal.x + dx
        y = awal.y + dy
      } else {
        const [dx, dy] = titikJalur(t, akhir.x - awal.x, akhir.y - awal.y, kAkhir)
        x = awal.x + dx
        y = awal.y + dy
      }
    }

    const degAwal = facingDeg(awal.facing, awal.facingDeg)
    const degAkhir = facingDeg(akhir.facing, akhir.facingDeg)
    const degMentah =
      !diam && p > 0 ? degAwal + selisihSudutTerpendek(degAwal, degAkhir) * p : degAwal
    const degKini = Math.round((((degMentah % 360) + 360) % 360) * 1000) / 1000 % 360

    const isGuard = apakahAnggotaGuard(m)
    let alatGuard: AlatGuard | undefined
    let warnaBenderaHex: string | undefined
    let sedangTossGuard = false

    if (isGuard) {
      const infoG = cariStatusGuardPadaSet(
        m.id,
        dari.id,
        hitunganSaatIni,
        countSheets,
        skema.warnaBenderaHex,
      )
      alatGuard = infoG.alat
      warnaBenderaHex = infoG.warnaHex
      sedangTossGuard = infoG.sedangToss
      if (infoG.labelBlok && !petaWarnaBendera.has(infoG.warnaHex)) {
        petaWarnaBendera.set(infoG.warnaHex, `Bendera ${infoG.labelBlok}`)
      }
    }

    pemain.push({
      id: m.id,
      anggota: m,
      x,
      y,
      facingDeg: degKini,
      sedangMelangkah,
      faseLangkahRad: p * counts * Math.PI,
      apakahGuard: isGuard,
      alatGuard,
      warnaBenderaHex,
      sedangTossGuard,
    })
  }

  const markersEfektif = markers.length
    ? penandaEfektifPadaSet(markers, sets, idxSet, p)
    : []

  return {
    pemain,
    markers: markersEfektif,
    hitunganSaatIni,
    totalHitunganSet: counts,
    warnaBenderaAktif: [...petaWarnaBendera.entries()].map(([warnaHex, label]) => ({
      label,
      warnaHex,
    })),
  }
}

/* ============================================================================
 * 5. Deteksi Halangan Pandang (*Visual Occlusion* dari Mata Tribun/Podium)
 * ========================================================================== */

export type JenisHalanganPandang = 'tertutup_properti' | 'tertutup_pemain'

export interface KejadianHalanganPandang {
  idPemain: string
  kodePemain: string
  namaPemain: string
  seksi: string
  jenis: JenisHalanganPandang
  idPenghalang: string
  labelPenghalang: string
  /** Persentase perkiraan tertutupnya siluet tubuh atas (`0..100`). */
  persenTertutup: number
  ringkasan: string
}

/**
 * Uji apakah sinar pandang 3D dari mata kamera `C` ke dada/instrumen pemain `P`
 * memotong kotak/silinder properti 3D bervolume (`tinggiMeter >= 0,9 m`).
 */
function ujiSinarTertutupProperti3D(
  mataYd: { x: number; y: number; z: number },
  pxYd: number,
  pyYd: number,
  tinggiSasaranM: number,
  prop: FieldMarker,
): { tertutup: boolean; persen: number } {
  const tinggiPropM = prop.tinggiMeter ?? 0
  if (tinggiPropM < 0.85) return { tertutup: false, persen: 0 }
  const propHYd = tinggiPropM * M_TO_YD
  const pzYd = tinggiSasaranM * M_TO_YD

  const vx = pxYd - mataYd.x
  const vy = pyYd - mataYd.y
  const vz = pzYd - mataYd.z

  if (prop.jenis === 'kotak') {
    const x2 = prop.x2 ?? prop.x
    const y2 = prop.y2 ?? prop.y
    const hx = Math.abs(x2 - prop.x) / 2
    const hy = Math.abs(y2 - prop.y) / 2
    if (hx < 0.08 || hy < 0.08) return { tertutup: false, persen: 0 }
    const cx = (prop.x + x2) / 2
    const cy = (prop.y + y2) / 2
    const rad = ((prop.rotasi ?? 0) * Math.PI) / 180
    const cos = Math.cos(rad)
    const sin = Math.sin(rad)

    // Transformasikan asal & arah sinar ke kerangka lokal kotak (-rad)
    const ox = (mataYd.x - cx) * cos + (mataYd.y - cy) * sin
    const oy = -(mataYd.x - cx) * sin + (mataYd.y - cy) * cos
    const dx = vx * cos + vy * sin
    const dy = -vx * sin + vy * cos

    let tMin = 0.02
    let tMax = 0.98

    if (Math.abs(dx) < 1e-8) {
      if (Math.abs(ox) > hx) return { tertutup: false, persen: 0 }
    } else {
      const t1 = (-hx - ox) / dx
      const t2 = (hx - ox) / dx
      tMin = Math.max(tMin, Math.min(t1, t2))
      tMax = Math.min(tMax, Math.max(t1, t2))
    }

    if (Math.abs(dy) < 1e-8) {
      if (Math.abs(oy) > hy) return { tertutup: false, persen: 0 }
    } else {
      const t1 = (-hy - oy) / dy
      const t2 = (hy - oy) / dy
      tMin = Math.max(tMin, Math.min(t1, t2))
      tMax = Math.min(tMax, Math.max(t1, t2))
    }

    if (tMin > tMax) return { tertutup: false, persen: 0 }
    const tTengah = (tMin + tMax) / 2
    const zPadaProp = mataYd.z + tTengah * vz
    if (zPadaProp >= 0 && zPadaProp <= propHYd) {
      const rasioTinggi = Math.min(1, (propHYd - zPadaProp) / Math.max(0.35, pzYd * 0.55))
      return { tertutup: true, persen: Math.max(45, Math.min(100, Math.round(50 + rasioTinggi * 50))) }
    }
    return { tertutup: false, persen: 0 }
  }

  if (prop.jenis === 'titik') {
    const rYd = Math.max(0.35, prop.r ?? 0.8)
    // Jarak terdekat titik pusat lingkaran (prop.x, prop.y) ke ruas sinar 2D
    const panjang2 = vx * vx + vy * vy
    if (panjang2 < 1e-6) return { tertutup: false, persen: 0 }
    const t = ((prop.x - mataYd.x) * vx + (prop.y - mataYd.y) * vy) / panjang2
    if (t <= 0.02 || t >= 0.98) return { tertutup: false, persen: 0 }
    const dekatX = mataYd.x + t * vx
    const dekatY = mataYd.y + t * vy
    if (Math.hypot(dekatX - prop.x, dekatY - prop.y) <= rYd) {
      const zPadaProp = mataYd.z + t * vz
      if (zPadaProp >= 0 && zPadaProp <= propHYd) {
        return { tertutup: true, persen: 75 }
      }
    }
  }

  return { tertutup: false, persen: 0 }
}

/**
 * Deteksi pemain yang terhalang oleh properti tinggi (`tinggiMeter > 0`) maupun tertutup
 * tepat di belakang bahu barisan depan (*un-windowed file*) pada sudut kamera aktif.
 */
export function deteksiHalanganPandang(opsi: {
  kamera: KameraTribun
  pemain: readonly BingkaiPemainTribun[]
  markers: readonly FieldMarker[]
  tinggiPemainMeter?: number
}): KejadianHalanganPandang[] {
  const { kamera, pemain, markers } = opsi
  if (kamera.preset === 'atas' || pemain.length === 0) return []

  const tinggiBadanM = Math.min(2.15, Math.max(1.35, opsi.tinggiPemainMeter ?? 1.72))
  const tinggiDadaMataM = tinggiBadanM * 0.78
  const tinggiPlumeM = tinggiBadanM + 0.22
  const hasil: KejadianHalanganPandang[] = []
  const sudahTercatat = new Set<string>()

  const propBervolume = markers.filter(
    (mk) => (mk.jenis === 'kotak' || mk.jenis === 'titik') && (mk.tinggiMeter ?? 0) >= 0.85,
  )

  // 1) Uji halangan oleh properti tinggi (backdrop, menara, panggung)
  for (const p of pemain) {
    for (const prop of propBervolume) {
      if (prop.kruIds?.includes(p.id)) continue
      const uji = ujiSinarTertutupProperti3D(kamera.mataYd, p.x, p.y, tinggiDadaMataM, prop)
      if (uji.tertutup) {
        const kode = p.anggota.code || p.anggota.name
        const lblProp = prop.label?.trim() || 'Properti Tinggi'
        hasil.push({
          idPemain: p.id,
          kodePemain: kode,
          namaPemain: p.anggota.name,
          seksi: p.anggota.section,
          jenis: 'tertutup_properti',
          idPenghalang: prop.id,
          labelPenghalang: lblProp,
          persenTertutup: uji.persen,
          ringkasan: `${kode} terhalang [${lblProp} · ${(prop.tinggiMeter ?? 0).toFixed(1)} m] (${uji.persen}%)`,
        })
        sudahTercatat.add(p.id)
        break
      }
    }
  }

  // 2) Uji halangan oleh siluet barisan depan pada sudut dangkal (Podium / Tribun Rendah / Press Box rapat)
  const proyeksiPemain = pemain
    .map((p) => {
      const kaki = kamera.proyeksikan(p.x, p.y, 0)
      const kepala = kamera.proyeksikan(p.x, p.y, tinggiBadanM)
      const puncak = kamera.proyeksikan(p.x, p.y, tinggiPlumeM)
      const dada = kamera.proyeksikan(p.x, p.y, tinggiBadanM * 0.62)
      const lebarBahuPx = Math.max(4, kaki.skalaPxPerYd * 0.56)
      return { p, kaki, kepala, puncak, dada, lebarBahuPx }
    })
    .sort((a, b) => a.kaki.depthYd - b.kaki.depthYd) // depan (dekat kamera) -> belakang

  for (let j = 1; j < proyeksiPemain.length; j++) {
    const belakang = proyeksiPemain[j]
    if (sudahTercatat.has(belakang.p.id)) continue
    for (let i = 0; i < j; i++) {
      const depan = proyeksiPemain[i]
      if (belakang.kaki.depthYd - depan.kaki.depthYd < 0.45) continue
      const selisihX = Math.abs(belakang.kaki.sx - depan.kaki.sx)
      if (selisihX > depan.lebarBahuPx * 0.68) continue

      // Zona tubuh atas pemain belakang di layar: [kepala.sy (atas) .. dada.sy (bawah)]
      const zAtasBelakang = belakang.kepala.sy
      const zBawahBelakang = belakang.dada.sy
      const tinggiZona = Math.max(1, zBawahBelakang - zAtasBelakang)
      // Siluet pemain depan membentang dari puncak.sy (atas) s.d. kaki.sy (bawah)
      const tumpangAtas = Math.max(zAtasBelakang, depan.puncak.sy)
      const tumpangBawah = Math.min(zBawahBelakang, depan.kaki.sy)
      const rasioTutup = (tumpangBawah - tumpangAtas) / tinggiZona
      if (rasioTutup >= 0.58) {
        const kodeB = belakang.p.anggota.code || belakang.p.anggota.name
        const kodeD = depan.p.anggota.code || depan.p.anggota.name
        const persen = Math.min(95, Math.round(rasioTutup * 100))
        hasil.push({
          idPemain: belakang.p.id,
          kodePemain: kodeB,
          namaPemain: belakang.p.anggota.name,
          seksi: belakang.p.anggota.section,
          jenis: 'tertutup_pemain',
          idPenghalang: depan.p.id,
          labelPenghalang: kodeD,
          persenTertutup: persen,
          ringkasan: `${kodeB} tertutup bahu ${kodeD} — geser selang-seling (window)`,
        })
        sudahTercatat.add(belakang.p.id)
        break
      }
    }
  }

  return hasil.sort((a, b) => {
    if (a.jenis !== b.jenis) return a.jenis === 'tertutup_properti' ? -1 : 1
    return b.persenTertutup - a.persenTertutup
  })
}

/* ============================================================================
 * 6. Perender Kanvas 2.5D Murni #hex (Pratinjau Interaktif & Perekam .webm)
 * ========================================================================== */

export interface OpsiGambarPerspektifCanvas {
  field: FieldConfig
  kamera: KameraTribun
  bingkai: BingkaiShowTribun
  skemaVisual?: Partial<SkemaVisualTribun>
  /** Kumpulan ID pemain yang terhalang pandang (digambar cincin merah #f43f5e). */
  idsTerhalang?: ReadonlySet<string>
  /** ID pemain yang sedang disorot khusus dari daftar halangan. */
  idSorotPemain?: string | null
  /** Tampilkan kode singkat pemain di atas plume/kepala. */
  tampilKode?: boolean
  /** Tampilkan pita informasi HUD di bagian atas kanvas (judul, set, hitungan, BPM). */
  hud?: {
    judulShow: string
    namaSet: string
    urutanSetTeks: string
    bpm: number
  } | null
}

function garis3D(
  ctx: CanvasRenderingContext2D,
  kamera: KameraTribun,
  x1: number,
  y1: number,
  z1: number,
  x2: number,
  y2: number,
  z2: number,
  pecahSegmen = 1,
) {
  ctx.beginPath()
  for (let i = 0; i <= pecahSegmen; i++) {
    const t = i / pecahSegmen
    const p = kamera.proyeksikan(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, z1 + (z2 - z1) * t)
    if (i === 0) ctx.moveTo(p.sx, p.sy)
    else ctx.lineTo(p.sx, p.sy)
  }
  ctx.stroke()
}

function poligon3D(
  ctx: CanvasRenderingContext2D,
  kamera: KameraTribun,
  titik: readonly [number, number, number][],
  isiHex: string,
  alphaIsi = 1,
  garisHex?: string,
  tebalGaris = 1,
) {
  if (titik.length < 3) return
  ctx.save()
  ctx.beginPath()
  titik.forEach(([x, y, z], idx) => {
    const pr = kamera.proyeksikan(x, y, z)
    if (idx === 0) ctx.moveTo(pr.sx, pr.sy)
    else ctx.lineTo(pr.sx, pr.sy)
  })
  ctx.closePath()
  ctx.fillStyle = isiHex
  ctx.globalAlpha = alphaIsi
  ctx.fill()
  if (garisHex) {
    ctx.globalAlpha = Math.min(1, alphaIsi + 0.15)
    ctx.strokeStyle = garisHex
    ctx.lineWidth = tebalGaris
    ctx.stroke()
  }
  ctx.restore()
}

function gambarPermukaanLapanganPerspektif(
  ctx: CanvasRenderingContext2D,
  field: FieldConfig,
  kamera: KameraTribun,
  skema: SkemaVisualTribun,
) {
  const halfL = (field.lengthYd + field.endZoneYd * 2) / 2
  const halfW = field.widthYd / 2
  const mainHalfL = field.lengthYd / 2
  const { rumputHex, zonaHex, garisHex } = warnaLatarEfektifTribun(skema.latar, field)

  // Latar langit / stadion gelap murni #hex
  const gradLatar = ctx.createLinearGradient(0, 0, 0, kamera.tinggiPx)
  gradLatar.addColorStop(0, '#020617')
  gradLatar.addColorStop(0.55, '#0f172a')
  gradLatar.addColorStop(1, '#090d16')
  ctx.fillStyle = gradLatar
  ctx.fillRect(0, 0, kamera.lebarPx, kamera.tinggiPx)

  // Trapesium permukaan lapangan penuh
  poligon3D(
    ctx,
    kamera,
    [
      [halfL, halfW, 0],
      [-halfL, halfW, 0],
      [-halfL, -halfW, 0],
      [halfL, -halfW, 0],
    ],
    rumputHex,
    1,
  )

  // End zone kiri (+x) & kanan (-x) atau bahu jalan Mode Kirab
  const modeParade = apakahModeParade(field)
  if (modeParade) {
    const prd = paradeOf(field)
    const bahuYd = Math.min(halfW * 0.7, Math.max(0, prd.bahuJalanM * M_TO_YD))
    if (bahuYd > 0) {
      poligon3D(
        ctx,
        kamera,
        [
          [halfL, halfW, 0],
          [-halfL, halfW, 0],
          [-halfL, halfW - bahuYd, 0],
          [halfL, halfW - bahuYd, 0],
        ],
        zonaHex,
        0.8,
      )
      poligon3D(
        ctx,
        kamera,
        [
          [halfL, -halfW + bahuYd, 0],
          [-halfL, -halfW + bahuYd, 0],
          [-halfL, -halfW, 0],
          [halfL, -halfW, 0],
        ],
        zonaHex,
        0.8,
      )
    }
  } else if (field.endZoneYd > 0) {
    poligon3D(
      ctx,
      kamera,
      [
        [halfL, halfW, 0],
        [mainHalfL, halfW, 0],
        [mainHalfL, -halfW, 0],
        [halfL, -halfW, 0],
      ],
      zonaHex,
      0.88,
    )
    poligon3D(
      ctx,
      kamera,
      [
        [-mainHalfL, halfW, 0],
        [-halfL, halfW, 0],
        [-halfL, -halfW, 0],
        [-mainHalfL, -halfW, 0],
      ],
      zonaHex,
      0.88,
    )
  }

  const garisMode = field.garis ?? 1
  if (garisMode === 0) return

  const pCfg = patokOf(field)
  const patokAktif = pCfg.aktif === 1

  ctx.save()
  ctx.strokeStyle = garisHex

  // Subgrid halus
  if (
    subgridTampil(field) &&
    field.subgridYd &&
    field.subgridYd > 0 &&
    field.subgridYd < field.gridYd
  ) {
    ctx.globalAlpha = 0.14
    ctx.lineWidth = 0.8
    for (const gx of garisSubgrid(field)) {
      const xInt = halfL - gx
      garis3D(ctx, kamera, xInt, -halfW, 0, xInt, halfW, 0)
    }
  }

  // Garis yard / grid utama
  if (gridUtamaTampil(field)) {
    for (const gx of garisGridUtama(field)) {
      const xInt = halfL - gx
      const diTengah50 = Math.abs(xInt) < 0.05
      ctx.globalAlpha = diTengah50 ? 0.65 : 0.34
      ctx.lineWidth = diTengah50 ? 1.8 : 1.05
      garis3D(ctx, kamera, xInt, -halfW, 0, xInt, halfW, 0)
    }
  }

  // Garis patok Indonesia bila diaktifkan pada lapangan ini
  if (patokAktif && patokGarisTampil(pCfg)) {
    ctx.globalAlpha = 0.28
    ctx.lineWidth = 0.9
    for (const px of daftarPatok(field, 'x')) {
      garis3D(ctx, kamera, px.pos, -halfW, 0, px.pos, halfW, 0)
    }
    for (const py of daftarPatok(field, 'y')) {
      garis3D(ctx, kamera, -mainHalfL, py.pos, 0, mainHalfL, py.pos, 0)
    }
  }

  // Hash marks depan & belakang
  const offsetHash = HASH_OFFSET_YD[field.hash] ?? 0
  if (!modeParade && hashGarisTampil(field) && offsetHash > 0 && offsetHash < halfW) {
    const yHashDepan = -halfW + offsetHash
    const yHashBelakang = halfW - offsetHash
    ctx.globalAlpha = 0.45
    ctx.lineWidth = 1.2
    ctx.setLineDash([4, 5])
    garis3D(ctx, kamera, mainHalfL, yHashDepan, 0, -mainHalfL, yHashDepan, 0)
    garis3D(ctx, kamera, mainHalfL, yHashBelakang, 0, -mainHalfL, yHashBelakang, 0)
    ctx.setLineDash([])
  }

  // Bingkai keliling lapangan utama
  if (garisMode === 1) {
    ctx.globalAlpha = 0.72
    ctx.lineWidth = 1.6
    garis3D(ctx, kamera, halfL, halfW, 0, -halfL, halfW, 0)
    garis3D(ctx, kamera, -halfL, halfW, 0, -halfL, -halfW, 0)
    garis3D(ctx, kamera, -halfL, -halfW, 0, halfL, -halfW, 0)
    garis3D(ctx, kamera, halfL, -halfW, 0, halfL, halfW, 0)
  }

  // Angka yard (10..50..10) di sisi depan lapangan agar titik acuan mudah dibaca juri/pelatih
  if (!modeParade && !patokAktif && (field.showLabels ?? 1) === 1 && field.lengthYd >= 60) {
    ctx.globalAlpha = 0.48
    ctx.fillStyle = garisHex
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (let yd = -40; yd <= 40; yd += 10) {
      if (Math.abs(yd) > mainHalfL - 4) continue
      const nilaiLabel = 50 - Math.abs(yd)
      if (nilaiLabel <= 0) continue
      const prDepan = kamera.proyeksikan(yd, -halfW + Math.min(7, halfW * 0.26), 0)
      const ukFont = Math.max(8, Math.min(16, prDepan.skalaPxPerYd * 2.1))
      ctx.font = `700 ${ukFont.toFixed(1)}px ui-sans-serif, system-ui, sans-serif`
      ctx.fillText(String(nilaiLabel), prDepan.sx, prDepan.sy)
    }
  }
  ctx.restore()
}

function gambarPropertiPerspektif(
  ctx: CanvasRenderingContext2D,
  kamera: KameraTribun,
  prop: FieldMarker,
) {
  const warna = bersihkanWarnaHex(prop.warna, '#fbbf24')
  const tinggiM = Math.max(0, prop.tinggiMeter ?? 0)
  const rotRad = ((prop.rotasi ?? 0) * Math.PI) / 180
  const cos = Math.cos(rotRad)
  const sin = Math.sin(rotRad)

  if (prop.jenis === 'kotak') {
    const x2 = prop.x2 ?? prop.x
    const y2 = prop.y2 ?? prop.y
    const cx = (prop.x + x2) / 2
    const cy = (prop.y + y2) / 2
    const hx = Math.abs(x2 - prop.x) / 2
    const hy = Math.abs(y2 - prop.y) / 2
    const putarSudut = (lx: number, ly: number, z: number): [number, number, number] => [
      cx + lx * cos - ly * sin,
      cy + lx * sin + ly * cos,
      z,
    ]

    const b0 = putarSudut(-hx, -hy, 0)
    const b1 = putarSudut(hx, -hy, 0)
    const b2 = putarSudut(hx, hy, 0)
    const b3 = putarSudut(-hx, hy, 0)

    if (tinggiM <= 0.05) {
      poligon3D(ctx, kamera, [b0, b1, b2, b3], warna, 0.24, warna, 1.3)
    } else {
      const t0 = putarSudut(-hx, -hy, tinggiM)
      const t1 = putarSudut(hx, -hy, tinggiM)
      const t2 = putarSudut(hx, hy, tinggiM)
      const t3 = putarSudut(-hx, hy, tinggiM)
      const sisiList: { poly: [number, number, number][]; hex: string; depth: number }[] = [
        { poly: [b0, b1, t1, t0], hex: ubahKecerahanHex(warna, 0.92), depth: 0 },
        { poly: [b1, b2, t2, t1], hex: ubahKecerahanHex(warna, 0.72), depth: 0 },
        { poly: [b2, b3, t3, t2], hex: ubahKecerahanHex(warna, 0.65), depth: 0 },
        { poly: [b3, b0, t0, t3], hex: ubahKecerahanHex(warna, 0.8), depth: 0 },
      ]
      for (const s of sisiList) {
        const mx = (s.poly[0][0] + s.poly[2][0]) / 2
        const my = (s.poly[0][1] + s.poly[2][1]) / 2
        const mz = (s.poly[0][2] + s.poly[2][2]) / 2
        s.depth = kamera.proyeksikan(mx, my, mz).depthYd
      }
      // Gambar sisi terjauh dulu lalu sisi terdekat + tutup atas paling akhir
      sisiList.sort((a, b) => b.depth - a.depth)
      for (const s of sisiList) {
        poligon3D(ctx, kamera, s.poly, s.hex, 0.88, ubahKecerahanHex(warna, 1.15), 1.1)
      }
      poligon3D(
        ctx,
        kamera,
        [t0, t1, t2, t3],
        ubahKecerahanHex(warna, 1.12),
        0.92,
        '#f8fafc',
        1.1,
      )
    }

    if (prop.label) {
      const prAtas = kamera.proyeksikan(cx, cy, tinggiM + 0.35)
      ctx.save()
      ctx.fillStyle = '#f8fafc'
      ctx.font = '600 10px ui-sans-serif, system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(prop.label, prAtas.sx, prAtas.sy)
      ctx.restore()
    }
    return
  }

  if (prop.jenis === 'titik') {
    const rYd = Math.max(0.45, prop.r ?? 0.9)
    const seg = 14
    const alas: [number, number, number][] = []
    const tutup: [number, number, number][] = []
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * Math.PI * 2
      const lx = prop.x + Math.cos(a) * rYd
      const ly = prop.y + Math.sin(a) * rYd
      alas.push([lx, ly, 0])
      tutup.push([lx, ly, tinggiM])
    }
    if (tinggiM <= 0.05) {
      poligon3D(ctx, kamera, alas, warna, 0.35, warna, 1.4)
    } else {
      for (let i = 0; i < seg; i++) {
        const j = (i + 1) % seg
        poligon3D(
          ctx,
          kamera,
          [alas[i], alas[j], tutup[j], tutup[i]],
          ubahKecerahanHex(warna, 0.82),
          0.9,
        )
      }
      poligon3D(ctx, kamera, tutup, ubahKecerahanHex(warna, 1.12), 0.95, '#f8fafc', 1)
    }
    return
  }

  if (prop.jenis === 'garis' || prop.jenis === 'panah') {
    ctx.save()
    ctx.strokeStyle = warna
    ctx.globalAlpha = 0.8
    ctx.lineWidth = 2
    garis3D(ctx, kamera, prop.x, prop.y, 0.02, prop.x2 ?? prop.x, prop.y2 ?? prop.y, 0.02)
    ctx.restore()
  }
}

function gambarSiluetPemain25D(
  ctx: CanvasRenderingContext2D,
  kamera: KameraTribun,
  p: BingkaiPemainTribun,
  skema: SkemaVisualTribun,
  terhalang: boolean,
  disorot: boolean,
  tampilKode: boolean,
) {
  const tinggiM = skema.tinggiPemainMeter ?? 1.72
  const kaki = kamera.proyeksikan(p.x, p.y, 0)
  const pinggang = kamera.proyeksikan(p.x, p.y, tinggiM * 0.52)
  const bahu = kamera.proyeksikan(p.x, p.y, tinggiM * 0.82)
  const kepala = kamera.proyeksikan(p.x, p.y, tinggiM)
  const plume = kamera.proyeksikan(p.x, p.y, tinggiM + 0.24)

  const skala = kaki.skalaPxPerYd

  // Mode Atas 90°: gambar titik seragam + plume + bendera tampak atas yang kontras
  if (kamera.preset === 'atas') {
    const rTitik = Math.max(3.5, skala * 0.42)
    ctx.save()
    if (terhalang || disorot) {
      ctx.beginPath()
      ctx.arc(kaki.sx, kaki.sy, rTitik + 4.5, 0, Math.PI * 2)
      ctx.strokeStyle = disorot ? '#fde047' : '#f43f5e'
      ctx.lineWidth = 2.2
      ctx.stroke()
    }
    ctx.beginPath()
    ctx.arc(kaki.sx, kaki.sy, rTitik, 0, Math.PI * 2)
    ctx.fillStyle = skema.jaketHex
    ctx.fill()
    ctx.strokeStyle = skema.celanaHex
    ctx.lineWidth = Math.max(1.2, rTitik * 0.32)
    ctx.stroke()

    // Titik plume di pusat
    ctx.beginPath()
    ctx.arc(kaki.sx, kaki.sy, Math.max(1.5, rTitik * 0.36), 0, Math.PI * 2)
    ctx.fillStyle = skema.plumeHex
    ctx.fill()

    // Kain bendera Guard tampak atas
    if (p.apakahGuard && p.warnaBenderaHex) {
      ctx.beginPath()
      ctx.moveTo(kaki.sx + rTitik * 0.8, kaki.sy)
      ctx.lineTo(kaki.sx + rTitik * 2.5, kaki.sy - rTitik * 0.9)
      ctx.lineTo(kaki.sx + rTitik * 2.2, kaki.sy + rTitik * 0.9)
      ctx.closePath()
      ctx.fillStyle = p.warnaBenderaHex
      ctx.fill()
    }
    ctx.restore()
    return
  }

  const setengahBahuPx = Math.max(2.3, skala * 0.27)
  const setengahPinggangPx = Math.max(1.8, skala * 0.2)
  const rKepalaPx = Math.max(1.8, skala * 0.15)
  const ayunLangkahPx = p.sedangMelangkah ? Math.sin(p.faseLangkahRad) * setengahPinggangPx * 0.65 : 0

  ctx.save()

  // 1) Bayangan pijakan di atas rumput
  ctx.beginPath()
  ctx.ellipse(
    kaki.sx,
    kaki.sy,
    Math.max(2.6, setengahBahuPx * 1.15),
    Math.max(1.3, setengahBahuPx * 0.45),
    0,
    0,
    Math.PI * 2,
  )
  ctx.fillStyle = '#020617'
  ctx.globalAlpha = 0.42
  ctx.fill()
  ctx.globalAlpha = 1

  // Cincin peringatan halangan pandang (#f43f5e) atau sorotan pilihan (#fde047)
  if (terhalang || disorot) {
    ctx.beginPath()
    ctx.ellipse(
      kaki.sx,
      (kaki.sy + kepala.sy) / 2,
      setengahBahuPx * 2.0,
      Math.max(6, Math.abs(kaki.sy - plume.sy) * 0.62),
      0,
      0,
      Math.PI * 2,
    )
    ctx.strokeStyle = disorot ? '#fde047' : '#f43f5e'
    ctx.lineWidth = disorot ? 2.5 : 1.8
    ctx.stroke()
  }

  // 2) Celana / kedua kaki (kunci penilaian Visual Execution langkah kaki!)
  ctx.strokeStyle = skema.celanaHex
  ctx.lineCap = 'round'
  ctx.lineWidth = Math.max(1.5, setengahPinggangPx * 0.72)
  ctx.beginPath()
  ctx.moveTo(pinggang.sx - setengahPinggangPx * 0.48, pinggang.sy)
  ctx.lineTo(kaki.sx - setengahPinggangPx * 0.48 - ayunLangkahPx * 0.35, kaki.sy - Math.max(0, ayunLangkahPx))
  ctx.moveTo(pinggang.sx + setengahPinggangPx * 0.48, pinggang.sy)
  ctx.lineTo(kaki.sx + setengahPinggangPx * 0.48 + ayunLangkahPx * 0.35, kaki.sy - Math.max(0, -ayunLangkahPx))
  ctx.stroke()

  // 3) Torso / Jaket Seragam
  ctx.beginPath()
  ctx.moveTo(bahu.sx - setengahBahuPx, bahu.sy)
  ctx.lineTo(bahu.sx + setengahBahuPx, bahu.sy)
  ctx.lineTo(pinggang.sx + setengahPinggangPx, pinggang.sy)
  ctx.lineTo(pinggang.sx - setengahPinggangPx, pinggang.sy)
  ctx.closePath()
  ctx.fillStyle = skema.jaketHex
  ctx.fill()
  ctx.strokeStyle = ubahKecerahanHex(skema.jaketHex, 0.65)
  ctx.lineWidth = 0.8
  ctx.stroke()

  // Selempang / aksen dada tipis dari warna plume agar arah hadap terbaca
  const radHadap = (p.facingDeg * Math.PI) / 180
  const menghadapDepan = Math.cos(radHadap) >= -0.25
  if (menghadapDepan) {
    ctx.strokeStyle = skema.plumeHex
    ctx.lineWidth = Math.max(0.9, setengahBahuPx * 0.28)
    ctx.beginPath()
    ctx.moveTo(bahu.sx - setengahBahuPx * 0.75, bahu.sy + 0.5)
    ctx.lineTo(pinggang.sx + setengahPinggangPx * 0.65, pinggang.sy - 0.5)
    ctx.stroke()
  }

  // 4) Kepala / Shako + Plume
  ctx.beginPath()
  ctx.arc(kepala.sx, (bahu.sy + kepala.sy) * 0.5, rKepalaPx, 0, Math.PI * 2)
  ctx.fillStyle = ubahKecerahanHex(skema.jaketHex, 0.85)
  ctx.fill()

  ctx.strokeStyle = skema.plumeHex
  ctx.lineWidth = Math.max(1.5, rKepalaPx * 0.78)
  ctx.beginPath()
  ctx.moveTo(kepala.sx, kepala.sy)
  ctx.lineTo(plume.sx, plume.sy)
  ctx.stroke()

  // 5) Siluet Instrumen / Bendera Color Guard (#17)
  const teksAlat = `${p.anggota.section} ${p.anggota.instrument || ''}`.toLowerCase()
  const arahLayarX = -Math.sin(radHadap) // +xYd (left/90°) -> kiri layar (-sx)

  if (p.apakahGuard) {
    const warnaKain = p.warnaBenderaHex || skema.warnaBenderaHex
    const zPangkalM = p.sedangTossGuard ? tinggiM + 0.55 : tinggiM * 0.58
    const zUjungM = p.sedangTossGuard ? tinggiM + 2.15 : tinggiM + 1.05
    const geserTiangYd = p.sedangTossGuard ? 0.15 : 0.48
    const pangkal = kamera.proyeksikan(p.x - 0.18, p.y, zPangkalM)
    const ujung = kamera.proyeksikan(p.x - 0.18 - geserTiangYd, p.y - 0.08, zUjungM)
    const tengahTiang = kamera.proyeksikan(
      p.x - 0.18 - geserTiangYd * 0.52,
      p.y - 0.04,
      (zPangkalM + zUjungM) * 0.5,
    )

    if (p.alatGuard === 'rifle' || p.alatGuard === 'sabre') {
      ctx.strokeStyle = p.alatGuard === 'rifle' ? '#f8fafc' : '#e2e8f0'
      ctx.lineWidth = Math.max(1.6, rKepalaPx * 0.7)
      ctx.beginPath()
      ctx.moveTo(pangkal.sx - setengahBahuPx, pangkal.sy)
      ctx.lineTo(pangkal.sx + setengahBahuPx * 1.9, pangkal.sy - setengahBahuPx * 1.4)
      ctx.stroke()
    } else {
      // Tiang 6 kaki + kibaran kain bendera berwarna #hex sesuai blok CountSheet aktif
      ctx.strokeStyle = '#e2e8f0'
      ctx.lineWidth = Math.max(1.1, rKepalaPx * 0.45)
      ctx.beginPath()
      ctx.moveTo(pangkal.sx, pangkal.sy)
      ctx.lineTo(ujung.sx, ujung.sy)
      ctx.stroke()

      const lebarKibaranPx = Math.max(5.5, setengahBahuPx * 2.55)
      const ayunKain = p.sedangMelangkah ? Math.cos(p.faseLangkahRad) * 2.2 : 0
      ctx.beginPath()
      ctx.moveTo(ujung.sx, ujung.sy)
      ctx.lineTo(ujung.sx + lebarKibaranPx, ujung.sy + lebarKibaranPx * 0.35 + ayunKain)
      ctx.lineTo(tengahTiang.sx + lebarKibaranPx * 0.88, tengahTiang.sy + lebarKibaranPx * 0.45 + ayunKain)
      ctx.lineTo(tengahTiang.sx, tengahTiang.sy)
      ctx.closePath()
      ctx.fillStyle = warnaKain
      ctx.globalAlpha = 0.94
      ctx.fill()
      ctx.globalAlpha = 1
      ctx.strokeStyle = ubahKecerahanHex(warnaKain, 0.7)
      ctx.lineWidth = 0.8
      ctx.stroke()
    }
  } else if (/tuba|sousa|contra/.test(teksAlat)) {
    // Corong besar Sousaphone melingkar di atas bahu
    ctx.beginPath()
    ctx.arc(
      bahu.sx - setengahBahuPx * 0.55,
      kepala.sy - rKepalaPx * 0.55,
      Math.max(2.6, rKepalaPx * 1.55),
      0,
      Math.PI * 2,
    )
    ctx.fillStyle = '#fbbf24'
    ctx.fill()
    ctx.strokeStyle = '#92400e'
    ctx.lineWidth = 0.9
    ctx.stroke()
  } else if (/percussion|battery|drum|snare|tenor|quint|bass/.test(teksAlat)) {
    // Tabung drum di depan pinggang
    ctx.fillStyle = '#e2e8f0'
    ctx.strokeStyle = '#475569'
    ctx.lineWidth = 0.9
    const wDrum = setengahBahuPx * 1.45
    const hDrum = Math.max(2.2, wDrum * 0.58)
    ctx.fillRect(pinggang.sx - wDrum / 2, pinggang.sy - hDrum * 0.4, wDrum, hDrum)
    ctx.strokeRect(pinggang.sx - wDrum / 2, pinggang.sy - hDrum * 0.4, wDrum, hDrum)
  } else if (/brass|trumpet|mello|baritone|euphonium|horn|trombone/.test(teksAlat)) {
    // Corong horn ke arah hadap
    ctx.strokeStyle = '#fde047'
    ctx.lineWidth = Math.max(1.2, rKepalaPx * 0.55)
    ctx.beginPath()
    ctx.moveTo(bahu.sx, bahu.sy)
    ctx.lineTo(
      bahu.sx + arahLayarX * setengahBahuPx * 1.75,
      bahu.sy - (Math.cos(radHadap) > 0 ? rKepalaPx * 0.35 : -rKepalaPx * 0.15),
    )
    ctx.stroke()
  }

  // 6) Label kode pemain opsional
  if (tampilKode && (p.anggota.code || disorot)) {
    ctx.fillStyle = disorot ? '#fde047' : '#e2e8f0'
    ctx.font = `700 ${Math.max(8, Math.min(11, rKepalaPx * 2.8)).toFixed(0)}px ui-monospace, monospace`
    ctx.textAlign = 'center'
    ctx.fillText(p.anggota.code || p.anggota.name, plume.sx, plume.sy - 4)
  }

  ctx.restore()
}

/**
 * Gambar satu bingkai utuh Pratinjau Perspektif Tribun Juri ke dalam `<canvas>` 2D.
 * Dipakai bersama oleh kanvas pratinjau interaktif 60fps maupun perekam video `.webm`.
 */
export function gambarBingkaiPerspektifCanvas(
  ctx: CanvasRenderingContext2D,
  opsi: OpsiGambarPerspektifCanvas,
): void {
  const { field, kamera, bingkai, idsTerhalang, idSorotPemain, tampilKode = false, hud } = opsi
  const skema = normalisasiSkemaVisualTribun(opsi.skemaVisual)

  // 1) Latar stadion & garis lapangan berperspektif
  gambarPermukaanLapanganPerspektif(ctx, field, kamera, skema)

  // 2) Properti datar di lantai (terpal/garis) digambar lebih dulu di bawah kaki pemain
  const propVolume: { jenis: 'prop'; prop: FieldMarker; depth: number }[] = []
  for (const mk of bingkai.markers) {
    if ((mk.tinggiMeter ?? 0) > 0.05 && (mk.jenis === 'kotak' || mk.jenis === 'titik')) {
      const cx = mk.jenis === 'kotak' ? (mk.x + (mk.x2 ?? mk.x)) / 2 : mk.x
      const cy = mk.jenis === 'kotak' ? (mk.y + (mk.y2 ?? mk.y)) / 2 : mk.y
      propVolume.push({
        jenis: 'prop',
        prop: mk,
        depth: kamera.proyeksikan(cx, cy, (mk.tinggiMeter ?? 1) * 0.4).depthYd,
      })
    } else {
      gambarPropertiPerspektif(ctx, kamera, mk)
    }
  }

  // 3) Urutkan gabungan properti 3D & siluet pemain dari jauh (Back Sideline) ke dekat (Front Sideline)
  type ElemenKedalaman =
    | { jenis: 'prop'; prop: FieldMarker; depth: number }
    | { jenis: 'pemain'; p: BingkaiPemainTribun; depth: number }

  const antrean: ElemenKedalaman[] = [
    ...propVolume,
    ...bingkai.pemain.map((p) => ({
      jenis: 'pemain' as const,
      p,
      depth: kamera.proyeksikan(p.x, p.y, 0.6).depthYd,
    })),
  ]
  antrean.sort((a, b) => b.depth - a.depth)

  for (const item of antrean) {
    if (item.jenis === 'prop') {
      gambarPropertiPerspektif(ctx, kamera, item.prop)
    } else {
      gambarSiluetPemain25D(
        ctx,
        kamera,
        item.p,
        skema,
        Boolean(idsTerhalang?.has(item.p.id)),
        idSorotPemain === item.p.id,
        tampilKode,
      )
    }
  }

  // 4) Pita HUD skor/hitungan di tepi atas kanvas (berguna di video .webm & potret .png)
  if (hud) {
    const infoSudut =
      DAFTAR_PRESET_SUDUT_TRIBUN.find((s) => s.id === kamera.preset)?.labelPendek ?? kamera.preset
    ctx.save()
    ctx.fillStyle = '#020617'
    ctx.globalAlpha = 0.82
    ctx.fillRect(0, 0, kamera.lebarPx, 34)
    ctx.globalAlpha = 1
    ctx.strokeStyle = '#1e293b'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, 34)
    ctx.lineTo(kamera.lebarPx, 34)
    ctx.stroke()

    ctx.fillStyle = '#f8fafc'
    ctx.font = '700 12px ui-sans-serif, system-ui, sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(hud.judulShow, 14, 17)

    ctx.fillStyle = '#34d399'
    ctx.font = '700 12px ui-monospace, monospace'
    ctx.textAlign = 'right'
    const cBulat = Math.round(bingkai.hitunganSaatIni * 10) / 10
    const teksKanan = `${hud.namaSet} (${hud.urutanSetTeks}) · Count ${cBulat}/${bingkai.totalHitunganSet} · ${Math.round(hud.bpm)} BPM · ${infoSudut}`
    ctx.fillText(teksKanan, kamera.lebarPx - 14, 17)
    ctx.restore()
  }
}
