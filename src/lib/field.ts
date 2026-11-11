import type {
  FieldConfig,
  HashPreset,
  ParadeConfig,
  PatokConfig,
  SatuanTampilLapangan,
  StepPreset,
} from '../db/types'

/**
 * Geometri lapangan & konversi satuan.
 *
 * Semua posisi disimpan dalam yard. Untuk ditampilkan ke pemain (dan untuk
 * "coordinate sheet"), posisi dikonversi ke LANGKAH sesuai ukuran langkah
 * yang dipakai tim (8-to-5 = 8 langkah per 5 yard = 22,5 inci).
 */

/** Panjang 1 langkah dalam yard. */
export const STEP_YD: Record<StepPreset, number> = {
  '8to5': 5 / 8, // 22,5 inci — paling umum
  '6to5': 5 / 6, // 30 inci
  '4to5': 5 / 4, // 45 inci (jarang, untuk jarak jauh)
  custom: 0.625,
}

/** 1 meter = berapa yard. Dipakai untuk lapangan berukuran metrik (bola, indoor). */
export const M_TO_YD = 1.09361
/** 1 yard = berapa meter (kebalikan `M_TO_YD`). */
export const YD_TO_M = 1 / M_TO_YD

/**
 * Pengaturan patok bawaan (DD1).
 * Jarak 8 langkah = 5 yard pada ukuran langkah 8-to-5, tanda # di tengah-tengah
 * antar huruf — angka yang lazim dipakai dan mudah diubah pelatih.
 */
export const PATOK_DEFAULT: PatokConfig = {
  aktif: 0,
  /**
   * Huruf **membujur** (A di tengah lapangan, lalu ke kiri & kanan menuju dua
   * end zone) — itulah kebiasaan tim: A berada tepat di tempat Field Commander
   * berdiri, lalu `#`, B, `#`, C … ke dua sisi.
   */
  sumbuHuruf: 'x',
  dariTengah: 1,
  awalanT: 1,
  /**
   * Penanda sisi **menyala** bawaan. Tanpa ini, patok C di kiri dan di kanan
   * tercetak sama persis di buku saku — tidak ketahuan C yang mana.
   */
  penandaSisi: 1,
  jarakHuruf: 8,
  jarakHash: 4,
  jarakT: 8,
  tampil: 1,
  maksHuruf: undefined,
  maksT: undefined,
  tampilGaris: undefined,
  tampilLabel: undefined,
  satuanJarak: 'langkah',
}

/**
 * Warna latar lapangan — **hex murni**, tanpa `oklch()`/`color-mix()`, supaya
 * tetap aman di browser lama pada berkas portabel.
 */
export const WARNA_LAPANGAN: { id: string; label: string; rumput: string; zona: string }[] = [
  { id: 'hijau', label: 'Hijau (rumput)', rumput: '#166534', zona: '#14532d' },
  { id: 'hijautua', label: 'Hijau tua', rumput: '#14532d', zona: '#0f3f21' },
  { id: 'biru', label: 'Biru (indoor)', rumput: '#1e3a5f', zona: '#172d4a' },
  { id: 'abu', label: 'Abu-abu (GOR)', rumput: '#3f3f46', zona: '#333338' },
  { id: 'coklat', label: 'Cokelat (tanah)', rumput: '#5c3a21', zona: '#4a2f1b' },
  { id: 'ungu', label: 'Ungu', rumput: '#4c1d95', zona: '#3b157a' },
  { id: 'aspal', label: 'Aspal hitam (jalan raya)', rumput: '#1e293b', zona: '#0f172a' },
]

/**
 * Pengaturan bawaan Mode Kirab / *Street Parade* (#19).
 * `aktif: 0` berarti kanvas tetap memakai lapangan biasa.
 */
export const PARADE_DEFAULT: Required<ParadeConfig> = {
  aktif: 0,
  bahuJalanM: 0.5,
  markaTengah: 1,
  arahDefile: 'kiri-ke-kanan',
  panggungAktif: 1,
  posisiPanggungM: 0,
  panjangPanggungM: 16,
  sisiPanggung: 'depan',
  labelPanggung: 'PANGGUNG KEHORMATAN / JURI',
  panjangRuteM: 1500,
}

/** Pengaturan parade yang sudah dinormalisasi (aman untuk `FieldConfig` lama). */
export function paradeOf(f: FieldConfig): Required<ParadeConfig> {
  const p = f.parade
  if (!p) return { ...PARADE_DEFAULT }
  const bahu = Number(p.bahuJalanM)
  const posVip = Number(p.posisiPanggungM)
  const pjgVip = Number(p.panjangPanggungM)
  const pjgRute = Number(p.panjangRuteM)
  return {
    aktif: p.aktif === 1 ? 1 : 0,
    bahuJalanM: Number.isFinite(bahu) && bahu >= 0 ? Math.min(bahu, 4) : PARADE_DEFAULT.bahuJalanM,
    markaTengah: p.markaTengah === 0 ? 0 : 1,
    arahDefile: p.arahDefile === 'kanan-ke-kiri' ? 'kanan-ke-kiri' : 'kiri-ke-kanan',
    panggungAktif: p.panggungAktif === 0 ? 0 : 1,
    posisiPanggungM: Number.isFinite(posVip) ? posVip : 0,
    panjangPanggungM: Number.isFinite(pjgVip) && pjgVip >= 2 ? pjgVip : PARADE_DEFAULT.panjangPanggungM,
    sisiPanggung: p.sisiPanggung === 'belakang' ? 'belakang' : 'depan',
    labelPanggung: p.labelPanggung?.trim() ? p.labelPanggung.trim() : PARADE_DEFAULT.labelPanggung,
    panjangRuteM: Number.isFinite(pjgRute) && pjgRute >= 50 ? pjgRute : PARADE_DEFAULT.panjangRuteM,
  }
}

/** Apakah lapangan sedang berada dalam Mode Kirab / *Street Parade* (#19). */
export function apakahModeParade(f: FieldConfig): boolean {
  return f.parade?.aktif === 1
}

/**
 * Pengali ukuran titik pemain.
 *
 * Ukurannya mengikuti **panjang lapangan** dengan acuan lapangan DCI
 * (120 yard termasuk end zone). Pada koridor **Jalan Parade** yang sempit
 * memanjang (mis. 60 × 8 m), ukuran titik juga dibatasi mengikuti lebar
 * jalan (`widthYd / 24`) supaya 4–8 banjar pemain tidak saling menumpuk.
 *
 * Nilainya dibatasi 0,2–2× supaya lapangan yang sangat kecil atau sangat
 * besar tidak menghasilkan titik yang aneh.
 */
export function skalaTitik(f: FieldConfig): number {
  const panjang = f.lengthYd + f.endZoneYd * 2
  const proporsiDasar = apakahModeParade(f)
    ? Math.min(panjang / 120, Math.max(0.24, f.widthYd / 24))
    : panjang / 120
  const dasar = Math.min(2, Math.max(0.2, proporsiDasar))
  return dasar * (f.ukuranTitik ?? 1)
}

/**
 * Kalikan ukuran berbasis yard (radius titik, tebal garis, ukuran teks kode)
 * dengan skala titik, supaya tampilannya konsisten di lapangan apa pun.
 */
export function ukurTitik(f: FieldConfig, nilai: number): number {
  return nilai * skalaTitik(f)
}

/** Warna latar lapangan yang sedang dipakai (aman untuk konfigurasi lama). */
export function warnaLapangan(f: FieldConfig): { rumput: string; zona: string } {
  const c = WARNA_LAPANGAN.find((w) => w.id === f.warna)
  return c ? { rumput: c.rumput, zona: c.zona } : WARNA_LAPANGAN[0]
}

/**
 * Palet warna garis grid & tepi lapangan — **hex murni** (`#rrggbb`), tanpa
 * `oklch()`/`color-mix()`, aman untuk cetak A4, buku saku, dan bundel portabel.
 */
export interface OpsiWarnaGrid {
  id: string
  label: string
  hex: string
}

export const WARNA_GARIS_GRID: OpsiWarnaGrid[] = [
  { id: 'putih', label: 'Putih klasik', hex: '#ffffff' },
  { id: 'emas', label: 'Kuning emas', hex: '#fde047' },
  { id: 'sian', label: 'Biru muda', hex: '#7dd3fc' },
  { id: 'perak', label: 'Abu perak', hex: '#cbd5e1' },
]

export const TEBAL_GARIS_GRID: { nilai: number; label: string }[] = [
  { nilai: 0.7, label: 'Tipis' },
  { nilai: 1, label: 'Standar' },
  { nilai: 1.5, label: 'Tebal' },
]

/** Warna garis grid yang sedang aktif (hex murni, bawaan putih `#ffffff`). */
export function warnaGarisGrid(f: FieldConfig): OpsiWarnaGrid {
  return WARNA_GARIS_GRID.find((w) => w.id === (f.warnaGrid ?? 'putih')) ?? WARNA_GARIS_GRID[0]
}

/** Pengali ketebalan garis grid yang diamankan (`0,4`–`2,5`, bawaan `1`). */
export function tebalGarisGrid(f: FieldConfig): number {
  const t = Number(f.tebalGrid)
  return Number.isFinite(t) && t >= 0.4 && t <= 2.5 ? t : 1
}

/**
 * Ketebalan efektif garis grid mengikuti panjang lapangan (sejalan `skalaTitik`)
 * dikali `tebalGarisGrid(f)`, agar pada lapangan kecil (GOR 40 × 20 m) garis
 * tidak tampak terlalu tebal dan pada lapangan standar DCI (120 yd) tetap `1×`.
 */
export function skalaGarisLapangan(f: FieldConfig): number {
  const panjang = Math.max(4, (Number.isFinite(f.lengthYd) ? f.lengthYd : 100) + Math.max(0, f.endZoneYd || 0) * 2)
  const acuan = apakahModeParade(f)
    ? Math.min(panjang / 120, Math.max(0.35, f.widthYd / 26))
    : panjang / 120
  const proporsi = Math.min(1.35, Math.max(0.35, acuan))
  return proporsi * tebalGarisGrid(f)
}

/**
 * Pengaturan patok lapangan ini — aman untuk `FieldConfig` lama yang belum punya.
 *
 * v2.9 — jarak patok **selalu dalam langkah** (satu grid: garis lapangan =
 * garis patok). Drill lama yang menyimpan `satuanJarak: 'yard' | 'meter'`
 * dikonversi ke langkah di sini, sehingga patoknya tetap di tempat yang sama
 * persis (boleh pecahan langkah) — tidak ada titik atau patok yang bergeser.
 */
export function patokOf(f: FieldConfig): PatokConfig {
  if (!f.patok) return PATOK_DEFAULT
  const p: PatokConfig = { ...PATOK_DEFAULT, ...f.patok }
  if (p.satuanJarak === 'yard' || p.satuanJarak === 'meter') {
    const faktor = (p.satuanJarak === 'meter' ? M_TO_YD : 1) / stepYd(f)
    const bulat = (v: number) => Math.round(v * faktor * 1000) / 1000
    return {
      ...p,
      jarakHuruf: bulat(p.jarakHuruf),
      jarakHash: bulat(p.jarakHash),
      jarakT: bulat(p.jarakT),
      satuanJarak: 'langkah',
    }
  }
  return p
}

/**
 * Jarak dari GARIS TENGAH LAPANGAN ke masing-masing hash mark (yard).
 *   NFHS (SMA)    : hash terpisah 53' 4"  -> 17,78 yard -> offset 8,89 yard
 *   NCAA (kampus) : hash terpisah 40'     -> 13,33 yard -> offset 6,67 yard
 *   NFL (pro)     : hash terpisah 18' 6"  ->  6,17 yard -> offset 3,08 yard
 */
export const HASH_OFFSET_YD: Record<HashPreset, number> = {
  nfhs: (53 + 4 / 12) / 3 / 2,
  ncaa: 40 / 3 / 2,
  nfl: (18 + 6 / 12) / 3 / 2,
  none: 0,
}

export const HASH_LABEL: Record<HashPreset, string> = {
  nfhs: 'NFHS / SMA (53\' 4")',
  ncaa: 'NCAA / Kampus (40\')',
  nfl: 'NFL / Pro (18\' 6")',
  none: 'Tanpa hash',
}

export const STEP_LABEL: Record<StepPreset, string> = {
  '8to5': '8-to-5 (22,5")',
  '6to5': '6-to-5 (30")',
  '4to5': '4-to-5 (45")',
  custom: 'Ukuran khusus',
}

/**
 * Preset lapangan siap pakai.
 * Standar DCI/drum corps memakai lapangan football 100 × 53,33 yard dengan
 * hash mark jarak kampus/NCAA (terpisah 40 kaki) dan langkah 8-to-5.
 */
export const FIELD_PRESETS: {
  id: string
  label: string
  hint: string
  config: Partial<FieldConfig>
}[] = [
  {
    id: 'dci',
    label: 'DCI / kampus',
    hint: '100 × 53,33 yard · hash terpisah 40′ (NCAA) — standar drum corps & kompetisi',
    config: {
      widthYd: 53.33,
      lengthYd: 100,
      endZoneYd: 10,
      hash: 'ncaa',
      satuan: 'yd',
      patok: { ...PATOK_DEFAULT },
    },
  },
  {
    id: 'nfhs',
    label: 'SMA / NFHS',
    hint: '100 × 53,33 yard · hash terpisah 53′ 4″',
    config: {
      widthYd: 53.33,
      lengthYd: 100,
      endZoneYd: 10,
      hash: 'nfhs',
      satuan: 'yd',
      patok: { ...PATOK_DEFAULT },
    },
  },
  {
    id: 'nfl',
    label: 'Pro / NFL',
    hint: '100 × 53,33 yard · hash terpisah 18′ 6″',
    config: {
      widthYd: 53.33,
      lengthYd: 100,
      endZoneYd: 10,
      hash: 'nfl',
      satuan: 'yd',
      patok: { ...PATOK_DEFAULT },
    },
  },
  {
    id: 'grid',
    label: 'Tanpa hash',
    hint: 'Hanya garis yard & sideline — cocok untuk lapangan sekolah yang tidak ada hash',
    config: {
      widthYd: 53.33,
      lengthYd: 100,
      endZoneYd: 10,
      hash: 'none',
      satuan: 'yd',
      patok: { ...PATOK_DEFAULT },
    },
  },
  {
    id: 'sepakbola',
    label: 'Sepak bola (Indonesia)',
    hint: '105 × 68 m · lapangan bola standar — dipakai latihan & lomba marching band',
    config: {
      widthYd: 68 * M_TO_YD,
      lengthYd: 105 * M_TO_YD,
      endZoneYd: 0,
      hash: 'none',
      satuan: 'm',
      patok: { ...PATOK_DEFAULT, aktif: 1 },
    },
  },
  {
    id: 'indoor',
    label: 'Indoor / GOR',
    hint: '40 × 20 m · lapangan dalam ruang dengan patok — ukuran bisa diubah sendiri',
    config: {
      widthYd: 20 * M_TO_YD,
      lengthYd: 40 * M_TO_YD,
      endZoneYd: 0,
      hash: 'none',
      satuan: 'm',
      patok: { ...PATOK_DEFAULT, aktif: 1 },
    },
  },
  {
    id: 'indoor-polos',
    label: 'Indoor tanpa patok',
    hint: '40 × 20 m · garis tiap 8 langkah tanpa sistem patok — untuk aula/GOR kecil',
    config: {
      widthYd: 20 * M_TO_YD,
      lengthYd: 40 * M_TO_YD,
      endZoneYd: 0,
      hash: 'none',
      showLabels: 0,
      satuan: 'm',
      patok: { ...PATOK_DEFAULT, aktif: 0 },
    },
  },
  {
    id: 'parade-6m',
    label: 'Jalan Parade 6 m',
    hint: '50 × 6 m · jalan sempit kabupaten/desa · marka tengah & Panggung VIP 12 m',
    config: {
      widthYd: 6 * M_TO_YD,
      lengthYd: 50 * M_TO_YD,
      endZoneYd: 0,
      hash: 'none',
      showLabels: 0,
      satuan: 'm',
      warna: 'aspal',
      patok: { ...PATOK_DEFAULT, aktif: 0 },
      parade: {
        ...PARADE_DEFAULT,
        aktif: 1,
        bahuJalanM: 0.4,
        panjangPanggungM: 12,
      },
    },
  },
  {
    id: 'parade-8m',
    label: 'Jalan Parade 8 m',
    hint: '60 × 8 m · jalan kota standar Street Parade PDBI · Panggung VIP 16 m',
    config: {
      widthYd: 8 * M_TO_YD,
      lengthYd: 60 * M_TO_YD,
      endZoneYd: 0,
      hash: 'none',
      showLabels: 0,
      satuan: 'm',
      warna: 'aspal',
      patok: { ...PATOK_DEFAULT, aktif: 0 },
      parade: {
        ...PARADE_DEFAULT,
        aktif: 1,
        bahuJalanM: 0.5,
        panjangPanggungM: 16,
      },
    },
  },
  {
    id: 'parade-12m',
    label: 'Jalan Protokol 12 m',
    hint: '75 × 12 m · jalan raya protokol lebar kirab HUT · Panggung VIP 20 m',
    config: {
      widthYd: 12 * M_TO_YD,
      lengthYd: 75 * M_TO_YD,
      endZoneYd: 0,
      hash: 'none',
      showLabels: 0,
      satuan: 'm',
      warna: 'aspal',
      patok: { ...PATOK_DEFAULT, aktif: 0 },
      parade: {
        ...PARADE_DEFAULT,
        aktif: 1,
        bahuJalanM: 0.75,
        panjangPanggungM: 20,
      },
    },
  },
]

/** Preset yang sedang aktif (untuk menandai tombol), atau null kalau custom. */
/**
 * Samakan bentuk pengaturan sebelum dibandingkan, supaya `FieldConfig` lama
 * yang belum punya `satuan`/`patok`/`parade` tetap dikenali sebagai preset yang sama.
 */
function kanonPreset(c: Record<string, unknown>): Record<string, unknown> {
  const patokNorm = JSON.stringify({ ...PATOK_DEFAULT, ...((c.patok as object) ?? {}) })
  const paradeObj = c.parade as ParadeConfig | undefined
  const paradeNorm =
    paradeObj && paradeObj.aktif === 1
      ? JSON.stringify({ ...PARADE_DEFAULT, ...paradeObj })
      : '0'
  const hashVal = c.hash as string | undefined
  const sat = c.satuan === 'm' ? 'm' : c.satuan === 'langkah' ? 'langkah' : 'yd'
  return {
    ...c,
    satuan: sat,
    patok: patokNorm,
    parade: paradeNorm,
    garis: c.garis ?? 1,
    warna: c.warna ?? 'hijau',
    ukuranTitik: c.ukuranTitik ?? 1,
    gridTampil: (c.gridTampil as number | undefined) ?? 1,
    subgridTampil: (c.subgridTampil as number | undefined) ?? 0,
    hashTampil: !hashVal || hashVal === 'none' ? 0 : ((c.hashTampil as number | undefined) ?? 1),
  }
}

export function activePreset(f: FieldConfig): string | null {
  const cur = kanonPreset(f as unknown as Record<string, unknown>)
  for (const p of FIELD_PRESETS) {
    const want = kanonPreset(p.config as Record<string, unknown>)
    const ok = Object.entries(want).every(([k, v]) => cur[k] === v)
    if (ok) return p.id
  }
  return null
}

/**
 * N16 — ukuran satu langkah dalam yard, sudah diamankan.
 *
 * `customStepYd` diketik bebas pelatih di Pengaturan. Bila ia `0` —
 * atau sekadar kolomnya dikosongkan, karena `Number('')` adalah `0` —
 * maka setiap koordinat dihitung dengan pembagi nol: `xSteps` menjadi
 * `NaN`, dan seluruh buku saku berubah menjadi "NaN". Keadaan itu juga
 * menular ke patok, jarak, dan panah arah.
 *
 * Karena itu nilai yang tidak bisa dipakai dikembalikan ke ukuran
 * langkah baku. Lebih baik salah dengan angka yang masuk akal daripada
 * benar dengan `NaN`.
 */
export function stepYd(f: FieldConfig): number {
  const v = f.step === 'custom' ? f.customStepYd : STEP_YD[f.step]
  return Number.isFinite(v) && v > 0 ? v : STEP_YD['8to5']
}

/** Jarak hash dari garis tengah (yard). 0 kalau tanpa hash. */
export function hashOffsetYd(f: FieldConfig): number {
  return HASH_OFFSET_YD[f.hash] ?? 0
}

export interface FieldBox {
  /** total lebar termasuk end zone (yard) */
  totalWidthYd: number
  /** total panjang termasuk end zone (yard) */
  totalLengthYd: number
  /** offset: nilai x/y terkecil dalam koordinat internal */
  minX: number
  maxX: number
  minY: number
  maxY: number
}

export function fieldBox(f: FieldConfig): FieldBox {
  // Konvensi di seluruh aplikasi (lihat `describe` dan `FieldSurface`):
  //   sumbu x = MEMBUJUR (S1 ↔ S2, sepanjang panjang lapangan, ada end zone)
  //   sumbu y = MELINTANG (front sideline ↔ back sideline, selebar lapangan)
  const halfW = f.widthYd / 2
  const halfL = (f.lengthYd + f.endZoneYd * 2) / 2
  return {
    totalWidthYd: f.widthYd,
    totalLengthYd: f.lengthYd + f.endZoneYd * 2,
    minX: -halfL,
    maxX: halfL,
    minY: -halfW,
    maxY: halfW,
  }
}

export interface Coord {
  /** steps, positif = Side 1, dihitung dari garis 50 */
  xSteps: number
  /** steps, dihitung dari FRONT SIDELINE (sisi penonton) ke belakang */
  ySteps: number
  /** "S1" kalau x positif, "S2" kalau negatif */
  side: 'S1' | 'S2'
  /** nomor yard line terdekat, 0..50 */
  yardLine: number
  /** jarak dari yard line terdekat, dalam steps (positif = ke arah Side 1) */
  fromYardLineSteps: number
  /** jarak dari hash terdekat/sideline, dalam steps (positif = ke arah back sideline) */
  fromHashSteps: number
  hashRef: string
}

/** Konversi koordinat internal (yard) ke keterangan yang bisa dibaca pemain. */
export function describe(x: number, y: number, f: FieldConfig): Coord {
  const s = stepYd(f)
  /** y adalah sumbu LEBAR lapangan (front sideline ↔ back sideline) */
  const halfW = f.widthYd / 2
  const ho = hashOffsetYd(f)

  // Sumbu X (side to side), diukur dari garis 50.
  const xSteps = x / s
  const yardFromCenter = x
  const yardLine = 50 - Math.abs(Math.round(Math.abs(yardFromCenter) / 5) * 5)
  const nearestYL = Math.round(Math.abs(yardFromCenter) / 5) * 5 * Math.sign(yardFromCenter || 1)
  const fromYardLineSteps = (x - nearestYL) / s

  // Sumbu Y (front ↔ back sideline), diukur dari FRONT SIDELINE.
  const yFromFront = y + halfW
  const ySteps = yFromFront / s

  /*
   * Referensi melintang: bandingkan jarak ke front hash, back hash,
   * front sideline, dan back sideline.
   *
   * N15 — hash HANYA menjadi calon bila lapangannya MEMANG punya hash.
   *
   * Tanpa penjagaan ini, `hashOffsetYd` = 0 (pilihan "Tanpa hash")
   * menempatkan front hash dan back hash berdua tepat di GARIS TENGAH
   * lapangan. Maka setiap pemain di tengah diberi acuan "FH" — dan
   * kartu koordinatnya menyuruh anak-anak berdiri "8 langkah dari front
   * hash" pada lapangan yang tidak punya hash sama sekali. Mereka akan
   * mencari garis yang tidak ada, lalu berdiri di tempat yang salah.
   *
   * Urutannya pun diubah: dua garis tepi lebih dulu, sehingga bila
   * jaraknya sama, yang dipakai adalah garis DEPAN (sisi penonton) —
   * patokan yang paling mudah ditemukan mata.
   */
  const frontHashY = -ho
  const backHashY = ho
  const frontSidelineY = -halfW
  const backSidelineY = halfW
  const cands: { name: string; y: number }[] = [
    { name: 'front sideline', y: frontSidelineY },
    { name: 'back sideline', y: backSidelineY },
  ]
  if (ho > 0) {
    cands.push({ name: 'front hash', y: frontHashY }, { name: 'back hash', y: backHashY })
  }
  let best = cands[0]
  for (const c of cands) {
    if (Math.abs(y - c.y) < Math.abs(y - best.y)) best = c
  }
  const fromHashSteps = (y - best.y) / s

  return {
    xSteps,
    ySteps,
    side: x >= 0 ? 'S1' : 'S2',
    yardLine: Math.max(0, yardLine),
    fromYardLineSteps,
    fromHashSteps,
    hashRef: best.name,
  }
}

/**
 * Koordinat jalan raya untuk Mode Kirab / *Street Parade* (#19), mis:
 * `"Defile +8,0 m · Depan As 2 lkh"` atau `"Defile 0,0 m · As Jalan"`.
 *
 * - Sumbu membujur diukur searah gerak defile dari titik tengah `0 m`
 *   (positif = lebih maju ke arah kepala defile, negatif = di belakang titik tengah).
 * - Sumbu melintang diukur dari **As Jalan** (`y = 0`) dalam langkah menuju
 *   tepi **Depan** (sisi penonton/bawah layar) atau **Belakang** (seberang jalan/atas layar).
 */
export function coordParade(x: number, y: number, f: FieldConfig): string {
  const p = paradeOf(f)
  const s = stepYd(f)
  // Konvensi kanvas: x > 0 = kiri layar, x < 0 = kanan layar.
  // Bila arah defile kiri-ke-kanan, maju menuju -x => jarak maju = -x * YD_TO_M.
  const tandaMaju = p.arahDefile === 'kanan-ke-kiri' ? 1 : -1
  const majuM = x * tandaMaju * YD_TO_M
  const bulatM = Math.round(majuM * 10) / 10
  const teksMaju =
    Math.abs(bulatM) < 0.05
      ? 'Defile 0,0 m'
      : `Defile ${bulatM > 0 ? '+' : '−'}${Math.abs(bulatM).toFixed(1).replace('.', ',')} m`

  const langkahDariAs = Math.round((Math.abs(y) / s) * 4) / 4
  if (langkahDariAs === 0) return `${teksMaju} · As Jalan`
  // Konvensi kanvas: y < 0 = sisi depan (penonton/bawah), y > 0 = sisi belakang (atas).
  const arahTepi = y < 0 ? 'Depan As' : 'Belakang As'
  const teksLangkah = String(langkahDariAs).replace('.', ',')
  return `${teksMaju} · ${arahTepi} ${teksLangkah} lkh`
}

/**
 * Baris koordinat siap cetak, mis: "S1 · YL45 +1.5 · FH +2.75"
 * Format: sisi · garis yard (jarak dalam langkah dari garis tersebut) ·
 *         referensi hash/sideline (jarak dalam langkah, + = ke arah belakang).
 */
export function coordText(x: number, y: number, f: FieldConfig): string {
  // DD1 — kalau tim memakai patok, koordinat ditulis dengan patok.
  if (patokOf(f).aktif === 1) return coordPatok(x, y, f)
  // #19 — kalau Mode Kirab / Street Parade aktif, tulis koordinat jalan raya.
  if (apakahModeParade(f)) return coordParade(x, y, f)
  const c = describe(x, y, f)
  const yl = c.fromYardLineSteps === 0 ? `YL${c.yardLine}` : `YL${c.yardLine} ${fmtStep(c.fromYardLineSteps)}`
  const hn = c.hashRef === 'front hash' ? 'FH' : c.hashRef === 'back hash' ? 'BH' : c.hashRef === 'front sideline' ? 'FSL' : 'BSL'
  const hv = c.fromHashSteps === 0 ? hn : `${hn} ${fmtStep(c.fromHashSteps)}`
  return `${c.side} · ${yl} · ${hv}`
}

/* ========================================================================== */
/*  DD1 — Sistem patok cara Indonesia                                         */
/*                                                                            */
/*  Dua sumbu patok: huruf (A → # → B → # → C …) dan angka (T0 → T1 → T2 …).   */
/*  Posisi dibaca gabungan keduanya, mis. "A6" = patok A, patok T6.            */
/* ========================================================================== */

/** Label patok ke-k: 0 = 'A', 1 = 'B', …, 25 = 'Z', 26 = 'AA'. */
export function hurufPatok(k: number): string {
  let n = k
  let out = ''
  do {
    out = String.fromCharCode(65 + (n % 26)) + out
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return out
}

export interface PatokRef {
  /** label patok huruf terdekat, mis. 'A' atau 'B#' */
  huruf: string
  /** jarak dari patok itu, dalam langkah (positif = menjauh dari A) */
  hurufOffset: number
  /** nomor patok T terdekat, mulai dari 0 (T0 = tepi depan) */
  nomor: number
  /** jarak dari patok T itu, dalam langkah */
  nomorOffset: number
}

/** Jarak antar patok (langkah) yang sudah diamankan supaya tidak saling lewat. */
function jarakPatok(p: PatokConfig): { jh: number; jhash: number; jt: number } {
  const jh = Math.max(1, p.jarakHuruf)
  // Tanda # harus berada DI ANTARA dua huruf, tidak boleh melewatinya.
  const jhash = Math.min(Math.max(0.5, p.jarakHash), jh - 0.5)
  const jt = Math.max(1, p.jarakT)
  return { jh, jhash, jt }
}

/** Patok terdekat untuk sebuah titik, dihitung dari kedua sumbu. */
export function patokRef(x: number, y: number, f: FieldConfig): PatokRef {
  const p = patokOf(f)
  const s = stepYd(f)
  const box = fieldBox(f)
  const { jt } = jarakPatok(p)

  // Sumbu huruf dan sumbu angka (T) saling tegak lurus: satu 'x', lainnya 'y'.
  const hurufIsY = p.sumbuHuruf === 'y'
  const hMin = hurufIsY ? box.minY : box.minX
  const aMin = hurufIsY ? box.minX : box.minY

  /**
   * Sumbu huruf — kandidatnya diambil **langsung dari `daftarPatok`**, supaya
   * koordinat yang ditulis selalu sama dengan patok yang digambar: pola dari
   * tengah atau dari tepi, penanda sisi, dan jaraknya tidak mungkin berbeda.
   * Gambar patok boleh disembunyikan (`tampil: 0`) tanpa mengubah koordinat.
   */
  const fHitung = { ...f, patok: { ...p, tampil: 1 } }
  const daftar = daftarPatok(fHitung, p.sumbuHuruf)
  const vSteps = ((hurufIsY ? y : x) - hMin) / s
  const posSteps = (g: { pos: number }) => (g.pos - hMin) / s

  /**
   * **Acuan penamaan = patok HURUF**, bukan patok terdekat.
   *
   * Kebiasaan tim: dua langkah di dalam C disebut **"C − 2"**, bukan "B# +2"
   * — walaupun jaraknya sama dekat. Huruf dipakai sebagai patok utama, dan
   * tanda # hanya muncul kalau pemain **tepat** berdiri di atasnya.
   */
  let pas: GarisPatok | null = null
  for (const g of daftar) {
    if (Math.abs(vSteps - posSteps(g)) < 1 / 8) {
      pas = g
      break
    }
  }
  let huruf: GarisPatok | null = null
  let jauh = Infinity
  for (const g of daftar) {
    // Penanda sisi menempelkan koma atas di BELAKANG label (`B#'`), jadi tanda
    // # harus dicek setelah koma atasnya dibuang — kalau tidak, `B#'` akan dianggap patok huruf.
    const murni = g.label.endsWith("'") ? g.label.slice(0, -1) : g.label
    if (murni.endsWith('#')) continue
    const d = Math.abs(vSteps - posSteps(g))
    if (d < jauh) {
      jauh = d
      huruf = g
    }
  }
  const acuan = pas ?? huruf

  // Sumbu angka — T0, T1, T2, … diambil langsung dari `daftarPatok` seperti
  // sumbu huruf, supaya jarak dan `maksT` selalu selaras antara patok yang
  // digambar dan buku saku. T0 = tepi depan.
  const sumbuT: 'x' | 'y' = hurufIsY ? 'x' : 'y'
  const daftarT = daftarPatok(fHitung, sumbuT)
  const uSteps = ((hurufIsY ? x : y) - aMin) / s
  const posStepsT = (g: { pos: number }) => (g.pos - aMin) / s
  let idxT = 0
  let jauhT = Infinity
  for (let i = 0; i < daftarT.length; i++) {
    const d = Math.abs(uSteps - posStepsT(daftarT[i]))
    if (d < jauhT) {
      jauhT = d
      idxT = i
    }
  }
  const nomor = daftarT.length > 0 ? idxT : Math.max(0, Math.round(uSteps / jt))
  const nomorOffset =
    daftarT.length > 0 ? uSteps - posStepsT(daftarT[idxT]) : uSteps - nomor * jt

  /**
   * Tanda jarak diukur **dari A**, bukan dari tepi lapangan:
   * `−` = mendekati A (ke dalam), `+` = menjauhi A (ke luar).
   *
   * Ini kebiasaan tim, dan sebelumnya kode mengukur dari tepi lapangan —
   * sehingga di sisi negatif A tandanya **terbalik**: "C −2" tercetak untuk
   * posisi yang sebenarnya menjauhi A. Terbalik seperti itu berbahaya, karena
   * anak-anak membacanya "dua langkah mendekati A" lalu berdiri di tempat yang
   * salah.
   *
   * Patok A sendirian di tengah, jadi sisinya ditandai dengan koma atas
   * (`A&#39;`) — lihat keterangan di bawah.
   */
  const offsetMentah = acuan ? vSteps - posSteps(acuan) : vSteps
  let hurufOffset = (acuan?.arah ?? 0) < 0 ? -offsetMentah : offsetMentah
  let labelHuruf = acuan ? acuan.label : 'A'

  /**
   * **Patok A ikut ditandai sisinya.**
   *
   * A berdiri sendirian di tengah lapangan — tidak ada "A sisi S1" yang bisa
   * membedakan sebelahnya, berbeda dengan C dan C&#39;. Kalau tanda jarak
   * dipakai sebagai penanda sisi, posisi 3¼ langkah di sebelah S2 tercetak
   * "A −3.25"; anak-anak membacanya "3¼ langkah mendekati A" lalu berdiri di
   * seberang lapangan.
   *
   * Maka A memakai aturan yang sama dengan huruf lain: koma atas menandai sisi
   * negatif (`A&#39;`), dan jaraknya selalu diukur menjauhi A — jadi selalu `+`.
   */
  if ((acuan?.arah ?? 0) === 0 && p.penandaSisi === 1 && offsetMentah < 0) {
    labelHuruf = `${labelHuruf}'`
    hurufOffset = -offsetMentah
  }

  return {
    huruf: labelHuruf,
    hurufOffset,
    nomor,
    nomorOffset,
  }
}

/**
 * Panah arah jalan, dalam **orientasi gambar chart** (bukan sudut pandang
 * pemain), supaya tidak berubah-ubah saat arah hadap pemain berubah.
 *
 * Di layar: atas = belakang, bawah = penonton, kiri = S1, kanan = S2.
 * `dx`/`dy` adalah selisih posisi internal (yard).
 */
export function panahArah(dx: number, dy: number): string {
  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) return ''
  // Proyeksi ke layar: svgX = konstan − x, svgY = konstan − y.
  const sx = -dx
  const sy = -dy
  const derajat = (Math.atan2(sy, sx) * 180) / Math.PI
  const d = ((derajat % 360) + 360) % 360
  if (d >= 337.5 || d < 22.5) return '→'
  if (d < 67.5) return '↘'
  if (d < 112.5) return '↓'
  if (d < 157.5) return '↙'
  if (d < 202.5) return '←'
  if (d < 247.5) return '↖'
  if (d < 292.5) return '↑'
  return '↗'
}

/**
 * Koordinat cara Indonesia, mis. **"A6"** (patok A, patok T6) atau
 * **"B#8"** (patok B#, patok T8).
 * Kalau pemain tidak tepat berada di patok, jaraknya ditulis dalam langkah:
 * "A +1 · T6 +1.75".
 */
export function coordPatok(x: number, y: number, f: FieldConfig): string {
  const r = patokRef(x, y, f)
  const pasHuruf = Math.abs(r.hurufOffset) < 1 / 8
  const pasNomor = Math.abs(r.nomorOffset) < 1 / 8
  if (pasHuruf && pasNomor) return `${r.huruf}${r.nomor}`
  const h = pasHuruf ? r.huruf : `${r.huruf} ${fmtStep(r.hurufOffset)}`
  const nT = labelT(patokOf(f), r.nomor)
  const t = pasNomor ? nT : `${nT} ${fmtStep(r.nomorOffset)}`
  return `${h} · ${t}`
}

/** Angka meter gaya Indonesia: `4,57`. */
function fmtMeter(m: number): string {
  return (Math.round(m * 100) / 100).toFixed(2).replace('.', ',')
}

/**
 * v2.9 — jarak pita meteran dari titik nol grid (`asalGrid`), untuk
 * inspektor titik: mis. **"5,72 m dari A · 13,72 m dari T0"**.
 * Patok: dari A (sumbu huruf) dan T0 (tepi depan). Football: dari garis 50 dan
 * sideline depan. Mode Kirab sudah bermeter di koordinatnya → string kosong.
 */
export function teksMeterAcuan(x: number, y: number, f: FieldConfig): string {
  if (apakahModeParade(f)) return ''
  const asal = asalGrid(f)
  const p = patokOf(f)
  const dx = Math.abs(x - asal.x) * YD_TO_M
  const dy = Math.abs(y - asal.y) * YD_TO_M
  if (p.aktif === 1) {
    const t0 = labelT(p, 0)
    const [mHuruf, mT] = p.sumbuHuruf === 'y' ? [dy, dx] : [dx, dy]
    return `${fmtMeter(mHuruf)} m dari A · ${fmtMeter(mT)} m dari ${t0}`
  }
  return `${fmtMeter(dx)} m dari garis 50 · ${fmtMeter(dy)} m dari sideline depan`
}

export interface BarisMeteran {
  label: string
  /** jarak dari acuan (A atau T0), dalam langkah */
  langkah: number
  /** jarak yang sama dalam meter — angka yang ditandai di pita meteran */
  meter: number
}

export interface TabelMeteran {
  /** patok huruf dari A keluar (satu sisi bila A di tengah — sisi lain sama, diberi koma atas) */
  huruf: BarisMeteran[]
  /** T0, T1, … dari tepi depan */
  t: BarisMeteran[]
  /** A di tengah → berlaku ke dua sisi */
  duaSisi: boolean
  /** panjang 1 langkah (cm) */
  langkahCm: number
  /** tanda kecil pita meteran tiap `jarakHash` langkah (mis. tiap 4 langkah) */
  jarakTandaLangkah: number
}

/**
 * v2.9 — tabel tanda pita meteran untuk memasang patok di lapangan:
 * jarak tiap patok dari A dan dari T0, dalam langkah dan meter.
 * `null` bila patok tidak aktif.
 */
export function tabelMeteran(f: FieldConfig): TabelMeteran | null {
  const p = patokOf(f)
  if (p.aktif !== 1) return null
  const s = stepYd(f)
  const asal = asalGrid(f)
  const sumbuT: 'x' | 'y' = p.sumbuHuruf === 'y' ? 'x' : 'y'
  const asalHuruf = p.sumbuHuruf === 'y' ? asal.y : asal.x
  const asalT = sumbuT === 'y' ? asal.y : asal.x
  const baris = (pos: number, a: number, label: string): BarisMeteran => {
    const yd = Math.abs(pos - a)
    return { label, langkah: Math.round((yd / s) * 1000) / 1000, meter: Math.round(yd * YD_TO_M * 1000) / 1000 }
  }
  const duaSisi = p.dariTengah === 1
  const huruf = daftarPatok(f, p.sumbuHuruf)
    .filter((g) => !duaSisi || (g.arah ?? 1) >= 0)
    .map((g) => baris(g.pos, asalHuruf, g.label))
    .sort((a, b) => a.langkah - b.langkah)
  const t = daftarPatok(f, sumbuT)
    .map((g) => baris(g.pos, asalT, g.label))
    .sort((a, b) => a.langkah - b.langkah)
  return {
    huruf,
    t,
    duaSisi,
    langkahCm: Math.round(s * YD_TO_M * 1000) / 10,
    jarakTandaLangkah: jarakPatok(p).jhash,
  }
}

/**
 * Posisi patok terdekat pada satu sumbu (yard).
 * Dipakai supaya titik pemain bisa **menempel ke patok** saat digeser —
 * karena pemain biasanya berdiri tepat di patok, bukan di antaranya.
 */
export function patokTerdekat(f: FieldConfig, sumbu: 'x' | 'y', nilai: number): number {
  const daftar = daftarPatok(f, sumbu)
  if (daftar.length === 0) return nilai
  let dekat = daftar[0].pos
  for (const g of daftar) {
    if (Math.abs(nilai - g.pos) < Math.abs(nilai - dekat)) dekat = g.pos
  }
  return dekat
}

/** Label patok angka: `T0`/`T1`… kalau memakai awalan T, atau cukup `0`/`1`…. */
export function labelT(p: PatokConfig, nomor: number): string {
  return p.awalanT === 1 ? `T${nomor}` : `${nomor}`
}

export interface GarisPatok {
  /** posisi patok dalam yard, pada koordinat internal lapangan */
  pos: number
  /** label yang ditulis di lapangan, mis. 'A', 'B#', 'T3' */
  label: string
  /** sumbu patok ini: 'x' = membujur, 'y' = melintang */
  sumbu: 'x' | 'y'
  /**
   * Sisi patok terhadap A: `1` = sisi positif (menuju S1 bila sumbu x),
   * `-1` = sisi negatif, `0` = patok A sendiri.
   * Dipakai untuk menentukan tanda +/− jarak dan penanda sisi.
   */
  arah?: 1 | -1 | 0
}

export function gridUtamaTampil(f: FieldConfig): boolean {
  return (f.gridTampil ?? 1) === 1
}
/**
 * v2.9 — garis bantu tipis **tiap 1 langkah**, dihitung dari titik nol grid
 * yang sama dengan patok/garis yard (lihat `asalGrid`). Menggantikan subgrid
 * lama yang jaraknya bebas dan dihitung dari tepi lapangan.
 */
export function garisLangkahTampil(f: FieldConfig): boolean {
  return f.subgridTampil === 1
}
export function hashGarisTampil(f: FieldConfig): boolean {
  if (f.hashTampil !== undefined) return f.hashTampil === 1
  return f.hash !== 'none'
}

/** Satuan tampilan ukuran & grid lapangan yang dinormalisasi (`'yd' | 'm' | 'langkah'`). */
export function satuanLapanganOf(f: FieldConfig): SatuanTampilLapangan {
  if (f.satuan === 'm' || f.satuan === 'langkah') return f.satuan
  return 'yd'
}

/** Faktor pengali dari yard internal ke satuan tampilan (`yd`, `m`, atau `langkah`). */
export function faktorTampilLapangan(
  f: FieldConfig,
  satuanOverride?: SatuanTampilLapangan,
): number {
  const sat = satuanOverride ?? satuanLapanganOf(f)
  if (sat === 'm') return YD_TO_M
  if (sat === 'langkah') return 1 / stepYd(f)
  return 1
}

/** Konversi nilai yard internal ke angka tampilan (`yard` / `meter` / `langkah`). */
export function keSatuanTampil(
  nilaiYd: number,
  f: FieldConfig,
  satuanOverride?: SatuanTampilLapangan,
): number {
  return nilaiYd * faktorTampilLapangan(f, satuanOverride)
}

/** Konversi angka pada satuan tampilan (`yard` / `meter` / `langkah`) ke yard internal. */
export function dariSatuanTampil(
  nilaiTampil: number,
  f: FieldConfig,
  satuanOverride?: SatuanTampilLapangan,
): number {
  const faktor = faktorTampilLapangan(f, satuanOverride)
  return faktor > 0 ? nilaiTampil / faktor : nilaiTampil
}

export function namaSatuanLapangan(s?: SatuanTampilLapangan): string {
  if (s === 'm') return 'meter'
  if (s === 'langkah') return 'langkah'
  return 'yard'
}

export function singkatanSatuanLapangan(s?: SatuanTampilLapangan): string {
  if (s === 'm') return 'm'
  if (s === 'langkah') return 'lk'
  return 'yd'
}

/* ========================================================================== */
/*  v2.9 — Satu grid lapangan                                                 */
/*                                                                            */
/*  Dulu ada dua grid yang tidak saling kenal: "grid utama/subgrid" (jarak    */
/*  bebas, dihitung dari TEPI lapangan) dan patok (langkah, dari TENGAH).     */
/*  Di lapangan bola keduanya tidak pernah bertemu (5 m vs 8 langkah =        */
/*  4,57 m). Sekarang hanya ada satu set garis; label (A B C / 50 45 40)      */
/*  hanyalah cara menamainya.                                                 */
/* ========================================================================== */

/** `utama` = huruf / garis yard / T, `tengah` = tanda #, `langkah` = garis bantu 1 langkah. */
export type JenisGarisLapangan = 'utama' | 'tengah' | 'langkah'

export interface GarisLapangan {
  /** posisi garis (yard, koordinat internal) */
  pos: number
  jenis: JenisGarisLapangan
  /** label yang ditulis di lapangan, mis. `B'`, `A#`, `T3`, atau `45` */
  label?: string
  /** garis tengah lapangan (patok A di tengah / garis 50) — digambar lebih tebal */
  tengah?: boolean
}

/** Jarak garis yard football (yard fisik) dan garis meter Mode Kirab. */
const JARAK_YARD_LINE = 5
const JARAK_GARIS_PARADE_YD = 5 * M_TO_YD

/**
 * Titik nol grid pada tiap sumbu (yard internal) — acuan garis, snap
 * langkah, dan konversi meter. Semua garis jatuh tepat di kelipatan
 * langkah dari titik ini, jadi snap 1 langkah selalu bertemu patok.
 *
 * - Patok: sumbu huruf dari **A** (tengah, atau tepi bila pola "A di tepi");
 *   sumbu T dari **T0** = tepi depan (sisi penonton).
 * - Football / tanpa patok: X dari garis 50, Y dari sideline depan.
 */
export function asalGrid(f: FieldConfig): { x: number; y: number } {
  const box = fieldBox(f)
  const p = patokOf(f)
  if (p.aktif === 1) {
    const hurufIsY = p.sumbuHuruf === 'y'
    const hMin = hurufIsY ? box.minY : box.minX
    const hMax = hurufIsY ? box.maxY : box.maxX
    const asalHuruf = p.dariTengah === 1 ? hMin + (hMax - hMin) / 2 : hMin
    const asalT = hurufIsY ? box.minX : box.minY
    return hurufIsY ? { x: asalT, y: asalHuruf } : { x: asalHuruf, y: asalT }
  }
  return { x: 0, y: box.minY }
}

/** Kelipatan `jarak` dari `asal` di dalam rentang [min, max]. */
function kelipatan(asal: number, jarak: number, min: number, max: number, maks = 1500): number[] {
  if (!(jarak > 0)) return []
  const out: number[] = []
  const kMin = Math.ceil((min - asal) / jarak - 1e-9)
  const kMax = Math.floor((max - asal) / jarak + 1e-9)
  for (let k = kMin; k <= kMax && out.length < maks; k++) {
    const v = asal + k * jarak
    out.push(Math.abs(v) < 1e-9 ? 0 : v)
  }
  return out
}

function tanpaKomaAtas(label: string): string {
  return label.endsWith("'") ? label.slice(0, -1) : label
}

/**
 * Semua garis lapangan pada kedua sumbu: `x` = garis membujur (digambar
 * vertikal), `y` = garis melintang (digambar horizontal).
 *
 * - **Patok aktif**: garis = patok itu sendiri (huruf → `utama`, # → `tengah`,
 *   T → `utama`). Tidak ada grid lain yang bisa meleset darinya.
 * - **Football**: garis yard tiap 5 yard dari garis 50 (sama dengan 8 langkah
 *   pada 8-to-5), di antara dua garis gol.
 * - **Kirab**: garis tiap 5 m dari titik tengah koridor.
 * - Garis bantu tiap langkah (`garisLangkahTampil`) ditambahkan dari titik nol
 *   yang sama, tanpa menumpuk garis yang sudah ada.
 */
export function garisLapangan(f: FieldConfig): { x: GarisLapangan[]; y: GarisLapangan[] } {
  const box = fieldBox(f)
  const p = patokOf(f)
  let gx: GarisLapangan[] = []
  let gy: GarisLapangan[] = []
  if (p.aktif === 1) {
    const sumbuT: 'x' | 'y' = p.sumbuHuruf === 'y' ? 'x' : 'y'
    const huruf = daftarPatok(f, p.sumbuHuruf).map(
      (g): GarisLapangan => ({
        pos: g.pos,
        jenis: tanpaKomaAtas(g.label).endsWith('#') ? 'tengah' : 'utama',
        label: g.label,
        tengah: g.arah === 0,
      }),
    )
    const t = daftarPatok(f, sumbuT).map((g): GarisLapangan => ({ pos: g.pos, jenis: 'utama', label: g.label }))
    if (p.sumbuHuruf === 'y') {
      gy = huruf
      gx = t
    } else {
      gx = huruf
      gy = t
    }
  } else {
    const ez = Math.max(0, Number.isFinite(f.endZoneYd) ? f.endZoneYd : 0)
    const minMain = box.minX + ez
    const maxMain = box.maxX - ez
    const parade = apakahModeParade(f)
    gx = kelipatan(0, parade ? JARAK_GARIS_PARADE_YD : JARAK_YARD_LINE, minMain, maxMain).map((x) => {
      const nilai = Math.round(50 - Math.abs(x))
      return {
        pos: x,
        jenis: 'utama' as const,
        label: !parade && nilai >= 0 ? String(nilai) : undefined,
        tengah: Math.abs(x) < 1e-6,
      }
    })
  }
  if (garisLangkahTampil(f)) {
    const s = stepYd(f)
    const asal = asalGrid(f)
    const tambah = (daftar: GarisLapangan[], a: number, min: number, max: number) => {
      const ada = daftar.map((g) => g.pos)
      const bantu = kelipatan(a, s, min, max)
        .filter((v) => !ada.some((q) => Math.abs(q - v) < 1e-6))
        .map((v): GarisLapangan => ({ pos: v, jenis: 'langkah' }))
      return [...daftar, ...bantu]
    }
    gx = tambah(gx, asal.x, box.minX, box.maxX)
    gy = tambah(gy, asal.y, box.minY, box.maxY)
  }
  return { x: gx, y: gy }
}

/**
 * Normalisasi batas huruf: undefined = tak terbatas,
 * 0=A, 1=B, …, 4=E. Nilai di-clamp >=0.
 */
function batasHurufNorm(v?: number): number | undefined {
  if (v === undefined || v === null) return undefined
  const n = Math.floor(Number(v))
  if (!Number.isFinite(n) || n < 0) return undefined
  return n
}
/** Nomor T terakhir yang dipasang (T0..Tn); undefined = otomatis sampai tepi. */
function batasTNorm(v?: number): number | undefined {
  if (v === undefined || v === null) return undefined
  const n = Math.floor(Number(v))
  if (!Number.isFinite(n) || n < 0) return undefined
  return n
}

/**
 * Daftar patok pada satu sumbu lengkap dengan posisinya (yard).
 * Dipakai untuk menggambar patok di lapangan dan untuk koordinat buku saku.
 *
 * Perubahan fondasi grid/patok:
 * - `maksHuruf` & `maksT` membatasi jumlah patok.
 * - v2.9: jarak **selalu dalam langkah** (`patokOf` mengonversi data lama),
 *   dan patok angka dimulai dari **T0 = tepi depan** (deretan patok huruf),
 *   lalu T1, T2, … ke belakang.
 */
export function daftarPatok(f: FieldConfig, sumbu: 'x' | 'y'): GarisPatok[] {
  const p = patokOf(f)
  if (p.aktif !== 1) return []
  // Garis/label patok hanya mengontrol tampilan di FieldSurface, bukan data
  // patok itu sendiri. Snap & koordinat tetap memakai patok bila aktif,
  // meski garis/label disembunyikan.

  const s = stepYd(f)
  const box = fieldBox(f)
  const min = sumbu === 'y' ? box.minY : box.minX
  const max = sumbu === 'y' ? box.maxY : box.maxX
  // Jarak patok dalam langkah → yard (ikut ukuran langkah tim).
  const { jh: jhMentah, jhash: jhashMentah, jt: jtMentah } = jarakPatok(p)
  const jhYd = jhMentah * s
  const jhashYd = jhashMentah * s
  const jtYd = jtMentah * s
  // untuk batas tepi, hitung dalam satuan yard juga
  const lenYd = max - min
  const batasHuruf = batasHurufNorm(p.maksHuruf)
  const batasT = batasTNorm(p.maksT)

  const out: GarisPatok[] = []
  if (sumbu === p.sumbuHuruf) {
    if (p.dariTengah === 1) {
      /**
       * Kebiasaan tim: **A di titik tengah**, lalu keluar ke dua sisi.
       *   `# C # B # A # B # C #`
       * Sisi negatif bisa diberi tanda koma atas (`B'`) supaya tidak rancu.
       * Batas huruf berlaku simetris.
       */
      const tengah = min + (max - min) / 2
      const batasYd = lenYd / 2
      const tandai = (label: string, arah: 1 | -1) =>
        p.penandaSisi === 1 && arah < 0 && label !== 'A' ? `${label}'` : label
      out.push({ pos: tengah, label: 'A', sumbu, arah: 0 })
      for (let k = 0; k < 200; k++) {
        const jKresYd = k * jhYd + jhashYd
        const jHurufYd = (k + 1) * jhYd
        let ada = false
        const idxHash = k // hurufPatok(k) + '#'
        const idxHuruf = k + 1 // hurufPatok(k+1)
        const hashDalamBatas = jKresYd <= batasYd + 1e-9
        const hurufDalamBatas = jHurufYd <= batasYd + 1e-9
        const hashDiizinkan = batasHuruf === undefined ? true : idxHash < batasHuruf
        // hash setelah huruf terakhir (mis. E# setelah E) tidak diizinkan
        const hurufDiizinkan = batasHuruf === undefined ? true : idxHuruf <= batasHuruf

        if (hashDalamBatas && hashDiizinkan) {
          const lab = `${hurufPatok(idxHash)}#`
          out.push({ pos: tengah + jKresYd, label: tandai(lab, 1), sumbu, arah: 1 })
          out.push({ pos: tengah - jKresYd, label: tandai(lab, -1), sumbu, arah: -1 })
          ada = true
        }
        if (hurufDalamBatas && hurufDiizinkan) {
          const lab = hurufPatok(idxHuruf)
          out.push({ pos: tengah + jHurufYd, label: tandai(lab, 1), sumbu, arah: 1 })
          out.push({ pos: tengah - jHurufYd, label: tandai(lab, -1), sumbu, arah: -1 })
          ada = true
        }
        if (!ada) break
        // jika keduanya melebihi batasHuruf, berhenti
        if (batasHuruf !== undefined && idxHuruf >= batasHuruf && idxHash >= batasHuruf) {
          // huruf sudah mencapai batas, hash berikutnya juga di luar → selesai
          // tapi loop akan berhenti sendiri via ada===false di iterasi berikutnya
        }
      }
    } else {
      /** Pola lurus: A di tepi, lalu `#`, B, `#`, C … sampai tepi seberang. */
      const nMax = Math.floor(lenYd / jhYd)
      const n = batasHuruf !== undefined ? Math.min(nMax, batasHuruf) : nMax
      for (let k = 0; k <= n; k++) {
        out.push({ pos: min + k * jhYd, label: hurufPatok(k), sumbu })
        // hash setelah k, hanya jika masih dalam batas huruf berikutnya
        const hashIdx = k
        const hashDiizinkan = batasHuruf === undefined ? true : hashIdx < batasHuruf
        if (hashDiizinkan && k * jhYd + jhashYd <= lenYd + 1e-9) {
          // jangan buat hash melewati batas huruf terakhir (E# setelah E)
          if (batasHuruf !== undefined && k >= batasHuruf) {
            // skip
          } else {
            out.push({ pos: min + (k * jhYd + jhashYd), label: `${hurufPatok(k)}#`, sumbu })
          }
        }
      }
    }
  } else {
    // T0 di tepi depan (sejajar deretan patok huruf), lalu T1, T2, … ke belakang.
    const nMax = Math.floor(lenYd / jtYd + 1e-9)
    const terakhir = batasT !== undefined ? Math.min(nMax, batasT) : nMax
    for (let k = 0; k <= terakhir; k++) {
      out.push({ pos: min + k * jtYd, label: labelT(p, k), sumbu })
    }
  }
  return out
}

function fmtStep(v: number): string {
  const r = Math.round(v * 4) / 4
  if (r === 0) return '0'
  return r > 0 ? `+${r}` : `${r}`
}

export function facingDeg(facing: string, customDeg?: number): number {
  // 0° = menghadap penonton (front). Canvas: front = ke bawah (sumbu +y layar).
  switch (facing) {
    case 'front':
      return 0
    case 'back':
      return 180
    case 'left':
      return 90 // menghadap ke Side 1 (kiri layar)
    case 'right':
      return -90
    default:
      return customDeg ?? 0
  }
}
