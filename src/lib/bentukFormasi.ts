/**
 * #12c, #16.2, & #22 — Mesin Bentuk Parametrik Hidup (Persistent Bézier Shapes),
 * Seleksi Lasso Poligon, Kotak Batas Rentang/Putar Kanvas, & Kunci/Bulat Sumbu.
 *
 * Seluruh fungsi di modul ini adalah matematika 2D murni (100% clean-room,
 * bebas DOM/React) sehingga dapat diuji langsung di Node (`qa/`) maupun
 * dipanggil 60fps dari kanvas SVG `DrillEditor`.
 */
import type {
  BentukTerikat,
  DrillPoint,
  Facing,
  FieldConfig,
  JenisBentukParametrik,
  TitikKendaliYd,
} from '../db/types'
import {
  facingDeg as hitungFacingDeg,
  fieldBox,
  patokOf,
  patokTerdekat,
  stepYd,
} from './field'

/* ========================================================================== */
/*  Pembulatan Koordinat Terpisah per Sumbu & Kunci Sumbu (#22.4)             */
/* ========================================================================== */

export type ModeKunciSumbu = 'bebas' | 'hanya_x' | 'hanya_y'

/** `0` = bebas (tanpa pembulatan); selain itu kelipatan langkah (mis. `1`, `0.5`, `0.25`). */
export type LangkahBulat = 0 | 0.25 | 0.5 | 1

export interface OpsiPembulatanSumbu {
  snapAktif: boolean
  langkahX: LangkahBulat
  langkahY: LangkahBulat
  /** Jika true (bawaan), saat patok aktif & langkah=1 maka menempel ke garis patok. */
  hormatiPatok?: boolean
}

export const OPSI_PEMBULATAN_BAWAAN: OpsiPembulatanSumbu = {
  snapAktif: true,
  langkahX: 1,
  langkahY: 1,
  hormatiPatok: true,
}

/**
 * Terapkan pengunci sumbu gerak (`bebas`, `hanya_x`, `hanya_y`) pada perpindahan `(dx, dy)`.
 * - `hanya_x`: pemain hanya bergeser kiri–kanan (sepanjang garis yard; `y` dikunci tetap).
 * - `hanya_y`: pemain hanya bergeser maju–mundur (depan–belakang; `x` dikunci tetap).
 */
export function terapkanKunciSumbu(
  awal: TitikKendaliYd,
  delta: TitikKendaliYd,
  mode: ModeKunciSumbu,
): TitikKendaliYd {
  if (mode === 'hanya_x') return { x: awal.x + delta.x, y: awal.y }
  if (mode === 'hanya_y') return { x: awal.x, y: awal.y + delta.y }
  return { x: awal.x + delta.x, y: awal.y + delta.y }
}

/**
 * Bulatkan koordinat `(x, y)` dalam yard mengikuti resolusi langkah mandiri per sumbu (`X` vs `Y`).
 */
export function bulatkanKoordinatSumbu(
  x: number,
  y: number,
  field: FieldConfig,
  opsi: OpsiPembulatanSumbu = OPSI_PEMBULATAN_BAWAAN,
): TitikKendaliYd {
  if (!opsi.snapAktif) return { x, y }
  const s = stepYd(field)
  const pakaiPatok = (opsi.hormatiPatok ?? true) && patokOf(field).aktif === 1

  let gx = x
  if (opsi.langkahX > 0) {
    if (pakaiPatok && opsi.langkahX === 1) {
      gx = patokTerdekat(field, 'x', x)
    } else {
      const unitX = s * opsi.langkahX
      gx = Math.round(x / unitX) * unitX
    }
  }

  let gy = y
  if (opsi.langkahY > 0) {
    if (pakaiPatok && opsi.langkahY === 1) {
      gy = patokTerdekat(field, 'y', y)
    } else {
      const unitY = s * opsi.langkahY
      const setengah = field.widthYd / 2
      gy = Math.round((y + setengah) / unitY) * unitY - setengah
    }
  }

  return {
    x: Math.round(gx * 1_000_000) / 1_000_000,
    y: Math.round(gy * 1_000_000) / 1_000_000,
  }
}

function snapToQuarterStep(x: number, y: number, f: FieldConfig): TitikKendaliYd {
  const s = stepYd(f)
  return {
    x: (Math.round((x / s) * 4) / 4) * s,
    y: (Math.round((y / s) * 4) / 4) * s,
  }
}

export function jepitKeLapangan(x: number, y: number, f: FieldConfig): TitikKendaliYd {
  const box = fieldBox(f)
  return {
    x: Math.max(box.minX + 0.5, Math.min(box.maxX - 0.5, x)),
    y: Math.max(box.minY + 0.5, Math.min(box.maxY - 0.5, y)),
  }
}

/* ========================================================================== */
/*  Generator Bentuk Cepat & Preset (#16.2 + #22 Kurva Ganda S-Curve)         */
/* ========================================================================== */

export type JenisBentukCepat =
  | 'company_front'
  | 'busur'
  | 'kurva_s'
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
  /** Kedalaman lengkungan untuk Busur / Kurva S dalam langkah (positif = cekung ke penonton) */
  lengkunganLangkah: number
  /** Jari-jari Lingkaran dalam langkah (bawaan 8) */
  jariJariLangkah: number
  /** Sudut kemiringan untuk Garis Diagonal dalam derajat (-75..75, bawaan 25) */
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
    label: 'Arc / Kurva Bézier',
    ringkas: 'Lengkungan akustik (Brass Arc) berjarak busur merata dengan gagang hidup',
  },
  {
    id: 'kurva_s',
    label: 'Kurva Ganda (S-Curve)',
    ringkas: 'Gelombang S kubik (2 gagang lengkung) dengan distribusi langkah sama rata',
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
  const n = ((Math.round(deg * 10) / 10) % 360 + 360) % 360
  if (Math.abs(n - 0) < 0.5 || Math.abs(n - 360) < 0.5) return { facing: 'front' }
  if (Math.abs(n - 180) < 0.5) return { facing: 'back' }
  if (Math.abs(n - 90) < 0.5) return { facing: 'left' }
  if (Math.abs(n - 270) < 0.5) return { facing: 'right' }
  return { facing: 'custom', facingDeg: Math.round(n * 10) / 10 }
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

/* ========================================================================== */
/*  Matematika Kurva Bézier & Parameterisasi Panjang Busur (#22.1)            */
/* ========================================================================== */

/** Evaluasi Quadratic Bézier B(t) = (1-t)² p0 + 2(1-t)t c1 + t² p1 pada t ∈ [0, 1]. */
export function evaluasiBezierKuadrat(
  p0: TitikKendaliYd,
  c1: TitikKendaliYd,
  p1: TitikKendaliYd,
  t: number,
): TitikKendaliYd {
  const u = 1 - t
  return {
    x: u * u * p0.x + 2 * u * t * c1.x + t * t * p1.x,
    y: u * u * p0.y + 2 * u * t * c1.y + t * t * p1.y,
  }
}

/** Evaluasi Cubic Bézier B(t) = (1-t)³ p0 + 3(1-t)²t c1 + 3(1-t)t² c2 + t³ p1 pada t ∈ [0, 1]. */
export function evaluasiBezierKubik(
  p0: TitikKendaliYd,
  c1: TitikKendaliYd,
  c2: TitikKendaliYd,
  p1: TitikKendaliYd,
  t: number,
): TitikKendaliYd {
  const u = 1 - t
  const u2 = u * u
  const t2 = t * t
  return {
    x: u2 * u * p0.x + 3 * u2 * t * c1.x + 3 * u * t2 * c2.x + t2 * t * p1.x,
    y: u2 * u * p0.y + 3 * u2 * t * c1.y + 3 * u * t2 * c2.y + t2 * t * p1.y,
  }
}

export interface TabelPanjangBusur {
  segmen: number
  kumulatif: number[]
  totalPanjang: number
}

/**
 * Bangun tabel panjang busur kumulatif (LUT) untuk kurva parametrik C(t), t ∈ [0, 1].
 * Menjamin pemain terdistribusi dengan jarak fisik yard/langkah yang SAMA RATA,
 * tidak menumpuk di tikungan tajam kurva Bézier.
 */
export function sampelPanjangBusurKurva(
  evalKurva: (t: number) => TitikKendaliYd,
  segmen = 256,
): TabelPanjangBusur {
  const n = Math.max(16, segmen)
  const kumulatif = new Array<number>(n + 1)
  kumulatif[0] = 0
  let prev = evalKurva(0)
  let total = 0
  for (let i = 1; i <= n; i++) {
    const cur = evalKurva(i / n)
    total += Math.hypot(cur.x - prev.x, cur.y - prev.y)
    kumulatif[i] = total
    prev = cur
  }
  return { segmen: n, kumulatif, totalPanjang: total }
}

/** Cari parameter `t` ∈ [0, 1] yang tepat menempuh jarak busur `jarakTarget` pada LUT. */
export function parameterTPadaJarakBusur(lut: TabelPanjangBusur, jarakTarget: number): number {
  if (lut.totalPanjang <= 1e-9 || jarakTarget <= 0) return 0
  if (jarakTarget >= lut.totalPanjang) return 1
  let lo = 0
  let hi = lut.segmen
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1
    if (lut.kumulatif[mid] <= jarakTarget) lo = mid
    else hi = mid
  }
  const s0 = lut.kumulatif[lo]
  const s1 = lut.kumulatif[hi]
  const fraksi = s1 > s0 ? (jarakTarget - s0) / (s1 - s0) : 0
  return (lo + fraksi) / lut.segmen
}

/** Distribusikan `jumlah` titik secara merata sepanjang kurva C(t) berdasarkan panjang busur. */
export function sebarMerataSepanjangKurva(
  evalKurva: (t: number) => TitikKendaliYd,
  jumlah: number,
  segmen = 256,
): TitikKendaliYd[] {
  if (jumlah <= 0) return []
  if (jumlah === 1) return [evalKurva(0.5)]
  const lut = sampelPanjangBusurKurva(evalKurva, segmen)
  const hasil: TitikKendaliYd[] = []
  for (let i = 0; i < jumlah; i++) {
    const target = (i / (jumlah - 1)) * lut.totalPanjang
    const t = parameterTPadaJarakBusur(lut, target)
    hasil.push(evalKurva(t))
  }
  return hasil
}

/* ========================================================================== */
/*  Generator Sekali-Cetak (#16.2 + Kurva S)                                  */
/* ========================================================================== */

/**
 * Bangun peta koordinat (`memberId -> DrillPoint`) untuk bentuk cepat `#16.2` / `#22`.
 * Urutan `ids` dipertahankan dari ujung `p0` (Side 1) ke `p1` (Side 2).
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
    const disnap = opsi.snap !== false ? snapToQuarterStep(x, y, field) : { x, y }
    const dijepit = jepitKeLapangan(disnap.x, disnap.y, field)
    return {
      ...(base ?? {}),
      x: Math.round(dijepit.x * 1000) / 1000,
      y: Math.round(dijepit.y * 1000) / 1000,
      facing: base?.facing ?? 'front',
      facingDeg: base?.facing ? base.facingDeg : undefined,
    }
  }

  if (opsi.jenis === 'company_front') {
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
      const u = n === 1 ? 0 : (i / (n - 1)) * 2 - 1
      const x = pusat.x - u * (lebarTotal / 2)
      const offsetTengah = (1 - u * u) * tinggiYd - tinggiYd * 0.5
      const pt = rapikan(x, pusat.y + offsetTengah, pointsSekarang[id])
      pt.facing = 'front'
      delete pt.facingDeg
      hasil[id] = pt
    })
    return hasil
  }

  if (opsi.jenis === 'kurva_s') {
    const lebarTotal = Math.max(intervalYd, (n - 1) * intervalYd)
    const tinggiYd = opsi.lengkunganLangkah * sYd
    const p0: TitikKendaliYd = { x: pusat.x + lebarTotal / 2, y: pusat.y }
    const p1: TitikKendaliYd = { x: pusat.x - lebarTotal / 2, y: pusat.y }
    const c1: TitikKendaliYd = { x: pusat.x + lebarTotal / 6, y: pusat.y + tinggiYd }
    const c2: TitikKendaliYd = { x: pusat.x - lebarTotal / 6, y: pusat.y - tinggiYd }
    const sampel = sebarMerataSepanjangKurva((t) => evaluasiBezierKubik(p0, c1, c2, p1, t), n)
    ids.forEach((id, i) => {
      const pt = rapikan(sampel[i].x, sampel[i].y, pointsSekarang[id])
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

/* ========================================================================== */
/*  Mesin Bentuk Parametrik Terikat (`BentukTerikat` — #22.1)                 */
/* ========================================================================== */

export const LABEL_JENIS_PARAMETRIK: Record<JenisBentukParametrik, string> = {
  garis: 'Garis',
  kurva_satu: 'Kurva Bézier',
  kurva_s: 'Kurva S',
  lingkaran: 'Lingkaran',
  blok: 'Grid Blok',
}

/**
 * Bangun objek `BentukTerikat` hidup lengkap dengan koordinat gagang kendali
 * (`p0`, `p1`, `c1`, `c2`) dari pilihan generator bentuk.
 */
export function buatBentukTerikatDariOpsi(
  ids: string[],
  pointsSekarang: Record<string, DrillPoint>,
  field: FieldConfig,
  opsi: OpsiBentukCepat,
  idBentuk = `btk_${Date.now().toString(36)}`,
): BentukTerikat | null {
  const n = ids.length
  if (n < 2) return null
  const sYd = stepYd(field)
  const intervalYd = Math.max(0.5, opsi.intervalLangkah) * sYd
  const pusat = opsi.pusatYd ?? pusatTitikTerpilih(ids, pointsSekarang)
  const jepit = (p: TitikKendaliYd) => jepitKeLapangan(p.x, p.y, field)

  if (opsi.jenis === 'company_front') {
    const setengah = ((n - 1) * intervalYd) / 2
    return {
      id: idBentuk,
      nama: `Company Front (${n})`,
      jenis: 'garis',
      memberIds: [...ids],
      p0: jepit({ x: pusat.x + setengah, y: pusat.y }),
      p1: jepit({ x: pusat.x - setengah, y: pusat.y }),
      arahHadap: 'depan',
    }
  }

  if (opsi.jenis === 'garis_diagonal') {
    const rad = (opsi.sudutDerajat * Math.PI) / 180
    const setengah = ((n - 1) * intervalYd) / 2
    const dx = Math.cos(rad) * setengah
    const dy = Math.sin(rad) * setengah
    return {
      id: idBentuk,
      nama: `Garis Miring (${n})`,
      jenis: 'garis',
      memberIds: [...ids],
      p0: jepit({ x: pusat.x + dx, y: pusat.y - dy }),
      p1: jepit({ x: pusat.x - dx, y: pusat.y + dy }),
      arahHadap: 'tetap',
    }
  }

  if (opsi.jenis === 'busur') {
    const setengah = Math.max(intervalYd, (n - 1) * intervalYd) / 2
    const tinggiYd = opsi.lengkunganLangkah * sYd
    return {
      id: idBentuk,
      nama: `Kurva Arc (${n})`,
      jenis: 'kurva_satu',
      memberIds: [...ids],
      p0: jepit({ x: pusat.x + setengah, y: pusat.y - tinggiYd * 0.5 }),
      p1: jepit({ x: pusat.x - setengah, y: pusat.y - tinggiYd * 0.5 }),
      // B(0.5) = 0.25*p0 + 0.5*c1 + 0.25*p1 = pusat.y + 0.5*tinggiYd → c1.y = pusat.y + 1.5*tinggiYd
      c1: jepit({ x: pusat.x, y: pusat.y + tinggiYd * 1.5 }),
      arahHadap: 'depan',
    }
  }

  if (opsi.jenis === 'kurva_s') {
    const setengah = Math.max(intervalYd, (n - 1) * intervalYd) / 2
    const tinggiYd = opsi.lengkunganLangkah * sYd
    return {
      id: idBentuk,
      nama: `Kurva S (${n})`,
      jenis: 'kurva_s',
      memberIds: [...ids],
      p0: jepit({ x: pusat.x + setengah, y: pusat.y }),
      p1: jepit({ x: pusat.x - setengah, y: pusat.y }),
      c1: jepit({ x: pusat.x + setengah / 3, y: pusat.y + tinggiYd }),
      c2: jepit({ x: pusat.x - setengah / 3, y: pusat.y - tinggiYd }),
      arahHadap: 'depan',
    }
  }

  if (opsi.jenis === 'lingkaran') {
    const rYd = Math.max(sYd, opsi.jariJariLangkah * sYd)
    return {
      id: idBentuk,
      nama: `Lingkaran (${n})`,
      jenis: 'lingkaran',
      memberIds: [...ids],
      p0: jepit({ x: pusat.x, y: pusat.y }),
      p1: jepit({ x: pusat.x, y: pusat.y - rYd }),
      arahHadap: 'tetap',
    }
  }

  // 'blok'
  const cols = Math.max(1, Math.round(opsi.kolomBlok || Math.ceil(Math.sqrt(n))))
  const rows = Math.max(1, Math.ceil(n / cols))
  const setengahLbr = ((cols - 1) * intervalYd) / 2
  const setengahTgi = ((rows - 1) * Math.max(0.5, opsi.jarakBarisLangkah) * sYd) / 2
  return {
    id: idBentuk,
    nama: `Grid Blok ${cols}×${rows}`,
    jenis: 'blok',
    memberIds: [...ids],
    p0: jepit({ x: pusat.x + setengahLbr, y: pusat.y - setengahTgi }),
    p1: jepit({ x: pusat.x - setengahLbr, y: pusat.y + setengahTgi }),
    kolom: cols,
    arahHadap: 'depan',
  }
}

/**
 * Evaluasi posisi terbaru tiap anggota pada satu `BentukTerikat` saat gagangnya digeser.
 * Kurva Bézier tunggal & ganda selalu memakai parameterisasi panjang busur merata.
 */
export function hitungTitikBentukTerikat(
  bentuk: BentukTerikat,
  pointsSekarang: Record<string, DrillPoint>,
  field: FieldConfig,
  opsiSnap: OpsiPembulatanSumbu = { snapAktif: false, langkahX: 0, langkahY: 0 },
): Record<string, DrillPoint> {
  const ids = bentuk.memberIds
  const n = ids.length
  if (!n) return {}
  const hasil: Record<string, DrillPoint> = {}

  const buatTitik = (rawX: number, rawY: number, id: string): DrillPoint => {
    const dibulat = opsiSnap.snapAktif
      ? bulatkanKoordinatSumbu(rawX, rawY, field, opsiSnap)
      : { x: rawX, y: rawY }
    const dijepit = jepitKeLapangan(dibulat.x, dibulat.y, field)
    const base = pointsSekarang[id]
    const pt: DrillPoint = {
      ...(base ?? { facing: 'front' as Facing }),
      x: Math.round(dijepit.x * 1000) / 1000,
      y: Math.round(dijepit.y * 1000) / 1000,
    }
    if (bentuk.arahHadap === 'depan') {
      pt.facing = 'front'
      delete pt.facingDeg
    } else if (bentuk.arahHadap === 'pusat') {
      const pusat = bentuk.jenis === 'lingkaran' ? bentuk.p0 : {
        x: (bentuk.p0.x + bentuk.p1.x) / 2,
        y: (bentuk.p0.y + bentuk.p1.y) / 2,
      }
      // 0° = hadap ke penonton (-y); atan2(-dx, -dy) menghasilkan sudut DrillKit
      const deg = (Math.atan2(-(pusat.x - pt.x), -(pusat.y - pt.y)) * 180) / Math.PI
      Object.assign(pt, facingDariDerajat(deg))
    }
    return pt
  }

  if (bentuk.jenis === 'garis') {
    ids.forEach((id, i) => {
      const t = n === 1 ? 0.5 : i / (n - 1)
      const x = bentuk.p0.x + (bentuk.p1.x - bentuk.p0.x) * t
      const y = bentuk.p0.y + (bentuk.p1.y - bentuk.p0.y) * t
      hasil[id] = buatTitik(x, y, id)
    })
    return hasil
  }

  if (bentuk.jenis === 'kurva_satu') {
    const c1 = bentuk.c1 ?? {
      x: (bentuk.p0.x + bentuk.p1.x) / 2,
      y: (bentuk.p0.y + bentuk.p1.y) / 2,
    }
    const sampel = sebarMerataSepanjangKurva(
      (t) => evaluasiBezierKuadrat(bentuk.p0, c1, bentuk.p1, t),
      n,
    )
    ids.forEach((id, i) => {
      hasil[id] = buatTitik(sampel[i].x, sampel[i].y, id)
    })
    return hasil
  }

  if (bentuk.jenis === 'kurva_s') {
    const c1 = bentuk.c1 ?? {
      x: bentuk.p0.x + (bentuk.p1.x - bentuk.p0.x) / 3,
      y: bentuk.p0.y,
    }
    const c2 = bentuk.c2 ?? {
      x: bentuk.p0.x + ((bentuk.p1.x - bentuk.p0.x) * 2) / 3,
      y: bentuk.p1.y,
    }
    const sampel = sebarMerataSepanjangKurva(
      (t) => evaluasiBezierKubik(bentuk.p0, c1, c2, bentuk.p1, t),
      n,
    )
    ids.forEach((id, i) => {
      hasil[id] = buatTitik(sampel[i].x, sampel[i].y, id)
    })
    return hasil
  }

  if (bentuk.jenis === 'lingkaran') {
    const r = Math.max(0.5, Math.hypot(bentuk.p1.x - bentuk.p0.x, bentuk.p1.y - bentuk.p0.y))
    const sudutAwal = Math.atan2(bentuk.p1.y - bentuk.p0.y, bentuk.p1.x - bentuk.p0.x)
    ids.forEach((id, i) => {
      const a = sudutAwal + (i / n) * Math.PI * 2
      hasil[id] = buatTitik(
        bentuk.p0.x + Math.cos(a) * r,
        bentuk.p0.y + Math.sin(a) * r,
        id,
      )
    })
    return hasil
  }

  // 'blok'
  const cols = Math.max(1, Math.round(bentuk.kolom || Math.ceil(Math.sqrt(n))))
  const rows = Math.max(1, Math.ceil(n / cols))
  ids.forEach((id, i) => {
    const c = i % cols
    const r = Math.floor(i / cols)
    const tx = cols <= 1 ? 0.5 : c / (cols - 1)
    const ty = rows <= 1 ? 0.5 : r / (rows - 1)
    const x = bentuk.p0.x + (bentuk.p1.x - bentuk.p0.x) * tx
    const y = bentuk.p0.y + (bentuk.p1.y - bentuk.p0.y) * ty
    hasil[id] = buatTitik(x, y, id)
  })
  return hasil
}

/**
 * Sampel kerangka garis/kurva `BentukTerikat` dalam satuan yard untuk digambar
 * sebagai garis tulang punggung bentuk di kanvas SVG.
 */
export function sampelGarisBentukUntukSvg(
  bentuk: BentukTerikat,
  jumlahSegmen = 48,
): TitikKendaliYd[] {
  if (bentuk.jenis === 'garis') return [bentuk.p0, bentuk.p1]
  if (bentuk.jenis === 'kurva_satu') {
    const c1 = bentuk.c1 ?? {
      x: (bentuk.p0.x + bentuk.p1.x) / 2,
      y: (bentuk.p0.y + bentuk.p1.y) / 2,
    }
    const pts: TitikKendaliYd[] = []
    for (let i = 0; i <= jumlahSegmen; i++) {
      pts.push(evaluasiBezierKuadrat(bentuk.p0, c1, bentuk.p1, i / jumlahSegmen))
    }
    return pts
  }
  if (bentuk.jenis === 'kurva_s') {
    const c1 = bentuk.c1 ?? bentuk.p0
    const c2 = bentuk.c2 ?? bentuk.p1
    const pts: TitikKendaliYd[] = []
    for (let i = 0; i <= jumlahSegmen; i++) {
      pts.push(evaluasiBezierKubik(bentuk.p0, c1, c2, bentuk.p1, i / jumlahSegmen))
    }
    return pts
  }
  if (bentuk.jenis === 'lingkaran') {
    const r = Math.max(0.5, Math.hypot(bentuk.p1.x - bentuk.p0.x, bentuk.p1.y - bentuk.p0.y))
    const pts: TitikKendaliYd[] = []
    for (let i = 0; i <= jumlahSegmen; i++) {
      const a = (i / jumlahSegmen) * Math.PI * 2
      pts.push({ x: bentuk.p0.x + Math.cos(a) * r, y: bentuk.p0.y + Math.sin(a) * r })
    }
    return pts
  }
  // 'blok': persegi panjang keliling dari p0 ke p1
  return [
    { x: bentuk.p0.x, y: bentuk.p0.y },
    { x: bentuk.p1.x, y: bentuk.p0.y },
    { x: bentuk.p1.x, y: bentuk.p1.y },
    { x: bentuk.p0.x, y: bentuk.p1.y },
    { x: bentuk.p0.x, y: bentuk.p0.y },
  ]
}

/**
 * Pasang `BentukTerikat` baru pada set: otomatis melepaskan anggota yang sama dari
 * bentuk terikat lama agar satu pemain tidak pernah terikat pada dua bentuk sekaligus.
 */
export function pasangBentukTerikatPadaSet(
  daftarLama: BentukTerikat[] | undefined,
  baru: BentukTerikat,
): BentukTerikat[] {
  const dipakai = new Set(baru.memberIds)
  const sisa = (daftarLama ?? [])
    .filter((b) => b.id !== baru.id)
    .map((b) => ({
      ...b,
      memberIds: b.memberIds.filter((id) => !dipakai.has(id)),
    }))
    .filter((b) => b.memberIds.length >= 2)
  return [...sisa, baru]
}

/**
 * Lepaskan himpunan anggota dari `bentukTerikat` (mis. saat satu titik digeser manual
 * terpisah atau dihapus dari set). Bentuk yang tersisa `< 2` pemain otomatis dibubarkan.
 */
export function lepaskanAnggotaDariBentuk(
  daftar: BentukTerikat[] | undefined,
  idsLepas: Iterable<string>,
): BentukTerikat[] | undefined {
  if (!daftar?.length) return undefined
  const lepas = new Set(idsLepas)
  if (!lepas.size) return daftar
  const baru = daftar
    .map((b) =>
      b.memberIds.some((id) => lepas.has(id))
        ? { ...b, memberIds: b.memberIds.filter((id) => !lepas.has(id)) }
        : b,
    )
    .filter((b) => b.memberIds.length >= 2)
  return baru.length ? baru : undefined
}

/** Geser seluruh gagang kendali `BentukTerikat` sejauh `(dx, dy)` yard. */
export function geserBentukTerikat(
  bentuk: BentukTerikat,
  dx: number,
  dy: number,
  field: FieldConfig,
): BentukTerikat {
  const g = (p: TitikKendaliYd) => jepitKeLapangan(p.x + dx, p.y + dy, field)
  return {
    ...bentuk,
    p0: g(bentuk.p0),
    p1: g(bentuk.p1),
    ...(bentuk.c1 ? { c1: g(bentuk.c1) } : {}),
    ...(bentuk.c2 ? { c2: g(bentuk.c2) } : {}),
  }
}

/** Putar seluruh gagang kendali `BentukTerikat` mengitari `pusat` sebesar `derajat`. */
export function putarBentukTerikat(
  bentuk: BentukTerikat,
  pusat: TitikKendaliYd,
  derajat: number,
  field: FieldConfig,
): BentukTerikat {
  const rad = (derajat * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const rot = (p: TitikKendaliYd) => {
    const dx = p.x - pusat.x
    const dy = p.y - pusat.y
    return jepitKeLapangan(pusat.x + dx * cos - dy * sin, pusat.y + dx * sin + dy * cos, field)
  }
  return {
    ...bentuk,
    p0: rot(bentuk.p0),
    p1: rot(bentuk.p1),
    ...(bentuk.c1 ? { c1: rot(bentuk.c1) } : {}),
    ...(bentuk.c2 ? { c2: rot(bentuk.c2) } : {}),
  }
}

/** Rentang/skala seluruh gagang kendali `BentukTerikat` terhadap `pusat` sebesar `(fx, fy)`. */
export function skalaBentukTerikat(
  bentuk: BentukTerikat,
  pusat: TitikKendaliYd,
  fx: number,
  fy: number,
  field: FieldConfig,
): BentukTerikat {
  const sc = (p: TitikKendaliYd) =>
    jepitKeLapangan(pusat.x + (p.x - pusat.x) * fx, pusat.y + (p.y - pusat.y) * fy, field)
  return {
    ...bentuk,
    p0: sc(bentuk.p0),
    p1: sc(bentuk.p1),
    ...(bentuk.c1 ? { c1: sc(bentuk.c1) } : {}),
    ...(bentuk.c2 ? { c2: sc(bentuk.c2) } : {}),
  }
}

/** Cerminkan seluruh gagang kendali `BentukTerikat` terhadap `pusat` pada sumbu `x` atau `y`. */
export function cerminBentukTerikat(
  bentuk: BentukTerikat,
  pusat: TitikKendaliYd,
  sumbu: 'x' | 'y',
  field: FieldConfig,
): BentukTerikat {
  const mir = (p: TitikKendaliYd) =>
    jepitKeLapangan(
      sumbu === 'x' ? 2 * pusat.x - p.x : p.x,
      sumbu === 'y' ? 2 * pusat.y - p.y : p.y,
      field,
    )
  return {
    ...bentuk,
    p0: mir(bentuk.p0),
    p1: mir(bentuk.p1),
    ...(bentuk.c1 ? { c1: mir(bentuk.c1) } : {}),
    ...(bentuk.c2 ? { c2: mir(bentuk.c2) } : {}),
  }
}

/* ========================================================================== */
/*  Alat Seleksi Lasso Poligon Bebas — Point-in-Polygon (#22.2)               */
/* ========================================================================== */

/**
 * Uji apakah `titik` berada di dalam `poligon` tertutup menggunakan algoritma
 * *ray-casting* Jordan (mendukung poligon cekung maupun melengkung bebas).
 */
export function titikDiDalamPoligon(titik: TitikKendaliYd, poligon: TitikKendaliYd[]): boolean {
  const n = poligon.length
  if (n < 3) return false
  let diDalam = false
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = poligon[i].x
    const yi = poligon[i].y
    const xj = poligon[j].x
    const yj = poligon[j].y
    // Tepat di titik sudut
    if (Math.abs(titik.x - xi) < 1e-9 && Math.abs(titik.y - yi) < 1e-9) return true
    const memotongY = yi > titik.y !== yj > titik.y
    if (memotongY) {
      const xPotong = ((xj - xi) * (titik.y - yi)) / (yj - yi) + xi
      if (Math.abs(titik.x - xPotong) < 1e-9) return true
      if (titik.x < xPotong) diDalam = !diDalam
    }
  }
  return diDalam
}

/** Pilih seluruh `memberId` yang posisinya masuk ke dalam poligon *lasso* (yard). */
export function pilihTitikDenganLasso(
  points: Record<string, DrillPoint>,
  poligonYd: TitikKendaliYd[],
  visibleIds?: Set<string>,
): string[] {
  if (poligonYd.length < 3) return []
  const terpilih: string[] = []
  for (const [id, p] of Object.entries(points)) {
    if (visibleIds && !visibleIds.has(id)) continue
    if (titikDiDalamPoligon(p, poligonYd)) terpilih.push(id)
  }
  return terpilih
}

/* ========================================================================== */
/*  Kotak Batas Transformasi Kanvas: Stretch/Squeeze & Free Rotate (#22.3)    */
/* ========================================================================== */

/**
 * Arah gagang kotak seleksi dilihat di layar bagan:
 * - `w` (kiri layar) = sisi Side 1 (`+X` maksimum)
 * - `e` (kanan layar) = sisi Side 2 (`-X` minimum)
 * - `n` (atas layar) = sisi Back Sideline (`+Y` maksimum)
 * - `s` (bawah layar) = sisi Front Sideline (`-Y` minimum)
 */
export type SudutGagangSkala = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

export interface KotakBatasYd {
  minX: number
  maxX: number
  minY: number
  maxY: number
  cx: number
  cy: number
  lebar: number
  tinggi: number
}

/** Hitung kotak batas (*axis-aligned bounding box*) dalam yard untuk titik terpilih. */
export function kotakBatasTitik(
  ids: string[],
  points: Record<string, DrillPoint>,
): KotakBatasYd | null {
  const ada = ids.map((id) => points[id]).filter(Boolean)
  if (ada.length < 2) return null
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const p of ada) {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }
  return {
    minX,
    maxX,
    minY,
    maxY,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    lebar: maxX - minX,
    tinggi: maxY - minY,
  }
}

/**
 * Rentang atau rapatkan (*Stretch & Squeeze*) himpunan titik saat gagang tepi/sudut
 * kotak seleksi ditarik ke `posisiBaruYd`, berjangkar pada sisi seberangnya.
 */
export function rentangTitikKotakBatas(
  origPoints: Record<string, DrillPoint>,
  ids: string[],
  kotakAwal: KotakBatasYd,
  gagang: SudutGagangSkala,
  posisiBaruYd: TitikKendaliYd,
  field: FieldConfig,
  opsiSnap: OpsiPembulatanSumbu = { snapAktif: false, langkahX: 0, langkahY: 0 },
): {
  points: Record<string, DrillPoint>
  jangkar: TitikKendaliYd
  fx: number
  fy: number
} {
  const ubahX = gagang.includes('w') || gagang.includes('e')
  const ubahY = gagang.includes('n') || gagang.includes('s')

  // w (kiri layar) menggerakkan maxX dengan jangkar minX; e menggerakkan minX dengan jangkar maxX
  const jangkarX = gagang.includes('w')
    ? kotakAwal.minX
    : gagang.includes('e')
      ? kotakAwal.maxX
      : kotakAwal.cx
  const tepiGerakX = gagang.includes('w') ? kotakAwal.maxX : kotakAwal.minX

  // n (atas layar) menggerakkan maxY dengan jangkar minY; s menggerakkan minY dengan jangkar maxY
  const jangkarY = gagang.includes('n')
    ? kotakAwal.minY
    : gagang.includes('s')
      ? kotakAwal.maxY
      : kotakAwal.cy
  const tepiGerakY = gagang.includes('n') ? kotakAwal.maxY : kotakAwal.minY

  const spanAwalX = tepiGerakX - jangkarX
  const spanAwalY = tepiGerakY - jangkarY

  const fx =
    !ubahX || Math.abs(spanAwalX) < 1e-6
      ? 1
      : Math.max(0.1, Math.min(6, (posisiBaruYd.x - jangkarX) / spanAwalX))
  const fy =
    !ubahY || Math.abs(spanAwalY) < 1e-6
      ? 1
      : Math.max(0.1, Math.min(6, (posisiBaruYd.y - jangkarY) / spanAwalY))

  const hasil: Record<string, DrillPoint> = {}
  for (const id of ids) {
    const p0 = origPoints[id]
    if (!p0) continue
    const rx = jangkarX + (p0.x - jangkarX) * fx
    const ry = jangkarY + (p0.y - jangkarY) * fy
    const dibulat = opsiSnap.snapAktif
      ? bulatkanKoordinatSumbu(rx, ry, field, opsiSnap)
      : { x: rx, y: ry }
    const dijepit = jepitKeLapangan(dibulat.x, dibulat.y, field)
    hasil[id] = {
      ...p0,
      x: Math.round(dijepit.x * 1000) / 1000,
      y: Math.round(dijepit.y * 1000) / 1000,
    }
  }
  return {
    points: hasil,
    jangkar: { x: jangkarX, y: jangkarY },
    fx,
    fy,
  }
}

/**
 * Putar bebas himpunan titik mengitari `pusat` sebesar `derajat` (positif = searah jarum jam
 * pada layar bagan), sekaligus memutar arah hadap pemain secara mulus.
 */
export function putarBebasTitik(
  origPoints: Record<string, DrillPoint>,
  ids: string[],
  pusat: TitikKendaliYd,
  derajat: number,
  field: FieldConfig,
  opsiSnap: OpsiPembulatanSumbu = { snapAktif: false, langkahX: 0, langkahY: 0 },
): Record<string, DrillPoint> {
  const rad = (derajat * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const hasil: Record<string, DrillPoint> = {}
  for (const id of ids) {
    const p0 = origPoints[id]
    if (!p0) continue
    const dx = p0.x - pusat.x
    const dy = p0.y - pusat.y
    const rx = pusat.x + dx * cos - dy * sin
    const ry = pusat.y + dx * sin + dy * cos
    const dibulat = opsiSnap.snapAktif
      ? bulatkanKoordinatSumbu(rx, ry, field, opsiSnap)
      : { x: rx, y: ry }
    const dijepit = jepitKeLapangan(dibulat.x, dibulat.y, field)
    const degAwal = hitungFacingDeg(p0.facing, p0.facingDeg)
    hasil[id] = {
      ...p0,
      x: Math.round(dijepit.x * 1000) / 1000,
      y: Math.round(dijepit.y * 1000) / 1000,
      ...facingDariDerajat(degAwal + derajat),
    }
  }
  return hasil
}

/* ========================================================================== */
/*  Cermin Terpadu Berporos Lapangan / Pilihan                                */
/* ========================================================================== */

/**
 * Cerminkan titik terpilih/semua terhadap:
 * - `'lapangan'` (garis 50 yard untuk kiri-kanan, garis tengah y=0 untuk depan-belakang), atau
 * - `'pilihan'` (titik tengah blok pilihan sendiri / di tempat).
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
  const ktk = poros === 'pilihan' ? kotakBatasTitik(ada, pointsSekarang) : null
  const pusat =
    poros === 'pilihan'
      ? ktk
        ? { x: ktk.cx, y: ktk.cy }
        : pusatTitikTerpilih(ada, pointsSekarang)
      : { x: 0, y: 0 }
  const hasil: Record<string, DrillPoint> = {}

  for (const id of ada) {
    const p = pointsSekarang[id]
    const rawX = sumbu === 'x' ? 2 * pusat.x - p.x : p.x
    const rawY = sumbu === 'y' ? 2 * pusat.y - p.y : p.y
    const disnap = snap ? snapToQuarterStep(rawX, rawY, field) : { x: rawX, y: rawY }
    const dijepit = jepitKeLapangan(disnap.x, disnap.y, field)
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
