import type {
  FieldConfig,
  HashPreset,
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
]

/**
 * Pengali ukuran titik pemain.
 *
 * Ukurannya mengikuti **panjang lapangan** dengan acuan lapangan DCI
 * (120 yard termasuk end zone). Tanpa ini, titik berukuran tetap 1,15 yard
 * akan tampak jauh lebih besar di layar pada lapangan kecil (mis. GOR
 * 40 × 20 m) karena skala gambarnya membesar.
 *
 * Nilainya dibatasi 0,2–2× supaya lapangan yang sangat kecil atau sangat
 * besar tidak menghasilkan titik yang aneh.
 */
export function skalaTitik(f: FieldConfig): number {
  const panjang = f.lengthYd + f.endZoneYd * 2
  const dasar = Math.min(2, Math.max(0.2, panjang / 120))
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
  const proporsi = Math.min(1.35, Math.max(0.55, panjang / 120))
  return proporsi * tebalGarisGrid(f)
}

/** Pengaturan patok lapangan ini — aman untuk `FieldConfig` lama yang belum punya. */
export function patokOf(f: FieldConfig): PatokConfig {
  return f.patok ? { ...PATOK_DEFAULT, ...f.patok } : PATOK_DEFAULT
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
      gridYd: 5,
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
      gridYd: 5,
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
      gridYd: 5,
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
      gridYd: 5,
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
      gridYd: 5 * M_TO_YD,
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
      gridYd: 5 * M_TO_YD,
      hash: 'none',
      satuan: 'm',
      patok: { ...PATOK_DEFAULT, aktif: 1 },
    },
  },
  {
    id: 'indoor-polos',
    label: 'Indoor tanpa patok',
    hint: '40 × 20 m · grid tiap 2 m tanpa sistem patok — untuk aula/GOR kecil',
    config: {
      widthYd: 20 * M_TO_YD,
      lengthYd: 40 * M_TO_YD,
      endZoneYd: 0,
      gridYd: 2 * M_TO_YD,
      hash: 'none',
      showLabels: 0,
      satuan: 'm',
      patok: { ...PATOK_DEFAULT, aktif: 0 },
    },
  },
]

/** Preset yang sedang aktif (untuk menandai tombol), atau null kalau custom. */
/**
 * Samakan bentuk pengaturan sebelum dibandingkan, supaya `FieldConfig` lama
 * yang belum punya `satuan`/`patok` tetap dikenali sebagai preset yang sama.
 */
function kanonPreset(c: Record<string, unknown>): Record<string, unknown> {
  const patokNorm = JSON.stringify({ ...PATOK_DEFAULT, ...((c.patok as object) ?? {}) })
  const hashVal = c.hash as string | undefined
  const sat = c.satuan === 'm' ? 'm' : c.satuan === 'langkah' ? 'langkah' : 'yd'
  return {
    ...c,
    satuan: sat,
    patok: patokNorm,
    garis: c.garis ?? 1,
    warna: c.warna ?? 'hijau',
    ukuranTitik: c.ukuranTitik ?? 1,
    gridTampil: (c.gridTampil as number | undefined) ?? 1,
    subgridYd: (c.subgridYd as number | undefined) ?? undefined,
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
 * Baris koordinat siap cetak, mis: "S1 · YL45 +1.5 · FH +2.75"
 * Format: sisi · garis yard (jarak dalam langkah dari garis tersebut) ·
 *         referensi hash/sideline (jarak dalam langkah, + = ke arah belakang).
 */
export function coordText(x: number, y: number, f: FieldConfig): string {
  // DD1 — kalau tim memakai patok, koordinat ditulis dengan patok.
  if (patokOf(f).aktif === 1) return coordPatok(x, y, f)
  const c = describe(x, y, f)
  const yl = c.fromYardLineSteps === 0 ? `YL${c.yardLine}` : `YL${c.yardLine} ${fmtStep(c.fromYardLineSteps)}`
  const hn = c.hashRef === 'front hash' ? 'FH' : c.hashRef === 'back hash' ? 'BH' : c.hashRef === 'front sideline' ? 'FSL' : 'BSL'
  const hv = c.fromHashSteps === 0 ? hn : `${hn} ${fmtStep(c.fromHashSteps)}`
  return `${c.side} · ${yl} · ${hv}`
}

/* ========================================================================== */
/*  DD1 — Sistem patok cara Indonesia                                         */
/*                                                                            */
/*  Dua sumbu patok: huruf (A → # → B → # → C …) dan angka (T1 → T2 → T3 …).   */
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
  /** nomor patok T terdekat, mulai dari 1 */
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

  // Sumbu angka — T1, T2, T3, … diambil langsung dari `daftarPatok` seperti
  // sumbu huruf, supaya mode `satuanJarak` ('langkah' | 'yard' | 'meter') dan
  // `maksT` selalu selaras antara patok yang digambar dan buku saku.
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
  const nomor = daftarT.length > 0 ? idxT + 1 : Math.max(1, Math.round(uSteps / jt) + 1)
  const nomorOffset =
    daftarT.length > 0 ? uSteps - posStepsT(daftarT[idxT]) : uSteps - (nomor - 1) * jt

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

/** Label patok angka: `T1` kalau memakai awalan T, atau cukup `1`. */
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

export function patokGarisTampil(p: PatokConfig): boolean {
  if (p.tampilGaris !== undefined) return p.tampilGaris === 1
  return p.tampil === 1
}
export function patokLabelTampil(p: PatokConfig): boolean {
  if (p.tampilLabel !== undefined) return p.tampilLabel === 1
  return p.tampil === 1
}
export function gridUtamaTampil(f: FieldConfig): boolean {
  return (f.gridTampil ?? 1) === 1
}
export function subgridTampil(f: FieldConfig): boolean {
  if (f.subgridTampil !== undefined) return f.subgridTampil === 1
  return !!f.subgridYd && f.subgridYd > 0
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

/**
 * Daftar posisi garis grid utama membujur (yard, sumbu X internal), dihitung
 * otomatis sepanjang area main (`fieldBox` dikurangi end zone).
 */
export function garisGridUtama(f: FieldConfig): number[] {
  const step = Number.isFinite(f.gridYd) && f.gridYd > 0 ? f.gridYd : 5
  const ez = Math.max(0, Number.isFinite(f.endZoneYd) ? f.endZoneYd : 0)
  const box = fieldBox(f)
  const minMain = box.minX + ez
  const maxMain = box.maxX - ez
  const out: number[] = []
  const maks = 500
  for (let x = minMain; x <= maxMain + 0.001 && out.length < maks; x += step) {
    out.push(Math.abs(x) < 1e-9 ? 0 : x)
  }
  return out
}

/**
 * Daftar posisi garis subgrid membujur (yard) sepanjang area main yang tidak
 * berimpit dengan garis grid utama.
 */
export function garisSubgrid(f: FieldConfig): number[] {
  if (!subgridTampil(f)) return []
  const utama = Number.isFinite(f.gridYd) && f.gridYd > 0 ? f.gridYd : 5
  const step = f.subgridYd
  if (!step || !Number.isFinite(step) || step <= 0 || step >= utama) return []
  const ez = Math.max(0, Number.isFinite(f.endZoneYd) ? f.endZoneYd : 0)
  const box = fieldBox(f)
  const minMain = box.minX + ez
  const maxMain = box.maxX - ez
  const out: number[] = []
  const maks = 1000
  for (let x = minMain; x <= maxMain + 0.001 && out.length < maks; x += step) {
    const rasio = x / utama
    if (Math.abs(rasio - Math.round(rasio)) >= 1e-6) {
      out.push(Math.abs(x) < 1e-9 ? 0 : x)
    }
  }
  return out
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
function batasTNorm(v?: number): number | undefined {
  if (v === undefined || v === null) return undefined
  const n = Math.floor(Number(v))
  if (!Number.isFinite(n) || n < 1) return undefined
  return n
}

/**
 * Daftar patok pada satu sumbu lengkap dengan posisinya (yard).
 * Dipakai untuk menggambar patok di lapangan dan untuk koordinat buku saku.
 *
 * Perubahan fondasi grid/patok:
 * - `maksHuruf` & `maksT` membatasi label tanpa memotong grid.
 * - `satuanJarak='yard'` mengartikan jarak sebagai yard fisik, bukan langkah.
 * - Garis/label patok dapat diatur terpisah via `tampilGaris`/`tampilLabel`.
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
  // Jarak dalam yard: 'langkah' ikut stepYd(f), 'yard' ukuran yard fisik, 'meter' ukuran meter fisik.
  const modeJarak = p.satuanJarak ?? 'langkah'
  const { jh: jhMentah, jhash: jhashMentah, jt: jtMentah } = jarakPatok(p)
  const faktorJarakYd = modeJarak === 'yard' ? 1 : modeJarak === 'meter' ? M_TO_YD : s
  const jhYd = jhMentah * faktorJarakYd
  const jhashYd = jhashMentah * faktorJarakYd
  const jtYd = jtMentah * faktorJarakYd
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
    const nMax = Math.floor(lenYd / jtYd)
    const n =
      batasT !== undefined ? Math.min(nMax + 1, batasT) : nMax + 1
    // n adalah jumlah T yang akan digambar (1-based)
    for (let k = 0; k < n; k++) {
      out.push({ pos: min + k * jtYd, label: labelT(p, k + 1), sumbu })
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
