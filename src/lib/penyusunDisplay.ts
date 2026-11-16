/**
 * v2.12 — Penyusun Display Latihan.
 *
 * Menyusun drill latihan pendek (3–4 set) dari tujuh konsep berjenjang,
 * untuk anggota yang HADIR hari itu dan lapangan yang dipakai hari itu
 * (Student Center atau lapangan terbuka). Tujuannya bukan show jadi,
 * melainkan bahan latihan display yang langsung bisa dijalankan dan diulang
 * dengan jumlah orang berapa pun.
 *
 * Aturan yang dipegang (Panduan Mengajar D&D §1, §8, §9; Bahan Acuan D&D):
 *
 * - Penonton di depan (y negatif). Garis depan formasi 8 langkah dari tepi
 *   depan (T0); A di tengah (x = 0). Semua dot di langkah bulat dari A dan
 *   dari T0, jadi selalu jatuh di patok, tanda #, atau tanda meteran.
 * - Blok awal = basics block: interval 4 langkah, kolom dibagi per pita
 *   (brass Side 1 | perkusi | brass Side 2), guard di saf belakang. Untuk
 *   58 orang hasilnya 9 banjar, sama dengan susunan di Panduan Mengajar.
 * - Semua bentuk memakai pita samping yang sama, sehingga tiap kelompok
 *   bergerak di jalurnya sendiri. Guard selalu di belakang musik atau masuk
 *   dari belakang (kotak terbuka), tidak pernah menembus barisan musik.
 * - Interval musik ±3 langkah, guard paling sedikit 6 langkah. Kalau
 *   lapangan tidak cukup, interval dipadatkan (musik sampai 2, guard sampai
 *   4) atau garis dipecah menjadi beberapa saf — dan dicatat.
 * - Pemain dipasangkan ke dot dengan jumlah kuadrat jarak terkecil
 *   (Hungarian), jadi jalur lurusnya tidak saling silang.
 * - Transisi 16 hitungan. Hitungan dinaikkan per 8 bila ada pemain yang
 *   harus melangkah lebih besar dari 8 to 5. Jarak papasan < 1,5 langkah
 *   dan dot yang terlalu rapat dicatat sebagai peringatan.
 *
 * Modul ini murni (tanpa DOM/Dexie) supaya bisa diuji di Node.
 */
import type { DrillPoint, FieldConfig, MemberRole } from '../db/types'
import { fieldBox, stepYd } from './field'

/* ========================================================================== */
/*  Konsep                                                                    */
/* ========================================================================== */

export type JenisMomen =
  | 'blok'
  | 'company_front'
  | 'busur'
  | 'baji'
  | 'v_terbuka'
  | 'lingkaran'
  | 'panggung'
  | 'kotak'

export const LABEL_MOMEN: Record<JenisMomen, string> = {
  blok: 'Blok',
  company_front: 'Company front',
  busur: 'Busur terbuka',
  baji: 'Baji',
  v_terbuka: 'V terbuka',
  lingkaran: 'Lingkaran',
  panggung: 'Panggung section',
  kotak: 'Kotak terbuka',
}

export interface KonsepDisplay {
  id: number
  judul: string
  /** Satu kalimat: apa yang terjadi. */
  ringkas: string
  /** Kapan dipakai dalam musim ini. */
  kapan: string
  /** Teknik D&D yang dilatih (istilah Kurikulum D&D). */
  teknik: string[]
  /** Aturan alat untuk konsep ini. */
  alat: string
  /** Urutan bentuk, set pertama sampai terakhir. */
  momen: JenisMomen[]
  /** Hitungan dasar tiap transisi (panjang = momen.length − 1). */
  hitungan: number[]
  /** Fokus cleaning yang disarankan untuk tiap transisi. */
  fokus: string[]
}

export const ATURAN_ALAT =
  'Alat baru dipegang setelah dua repetisi berturut-turut bersih tanpa alat.'

export const KONSEP_DISPLAY: KonsepDisplay[] = [
  {
    id: 1,
    judul: 'Blok ke Company Front',
    ringkas: 'Dari basics block maju dan melebar menjadi satu garis depan, lalu tahan.',
    kapan: 'P11 (Kam 3 Des) bila disetujui PH, atau latihan 8 Des',
    teknik: ['Forward', 'Slide', 'Halt'],
    alat: 'Tanpa alat.',
    momen: ['blok', 'company_front'],
    hitungan: [16],
    fokus: ['Langkah pertama serempak di hitungan 1; dress garis depan dengan mata saja'],
  },
  {
    id: 2,
    judul: 'Garis ke Busur',
    ringkas: 'Company front lalu bagian tengah mundur sehingga garis membuka ke penonton.',
    kapan: 'Desember, sesudah Konsep 1 bersih',
    teknik: ['Forward', 'Slide', 'Backward', 'Halt'],
    alat: ATURAN_ALAT,
    momen: ['blok', 'company_front', 'busur'],
    hitungan: [16, 16],
    fokus: ['Ukuran langkah sama sampai hitungan 16', 'Bagian tengah mundur tanpa condong; interval di busur'],
  },
  {
    id: 3,
    judul: 'Busur ke Baji',
    ringkas: 'Lanjutan Konsep 2: busur menutup menjadi baji dengan ujung ke penonton.',
    kapan: 'Desember, bersama Drill Latihan 1',
    teknik: ['Forward', 'Backward', 'Ganti arah', 'Halt'],
    alat: ATURAN_ALAT,
    momen: ['blok', 'company_front', 'busur', 'baji'],
    hitungan: [16, 16, 16],
    fokus: ['Langkah pertama', 'Bentuk busur rata', 'Ganti arah tanpa langkah tambahan; ujung baji tepat di A'],
  },
  {
    id: 4,
    judul: 'V Terbuka',
    ringkas: 'Blok terbelah menjadi dua garis diagonal yang membuka ke penonton, lalu kembali.',
    kapan: 'Januari',
    teknik: ['Slide', 'Gerak diagonal', 'Backward'],
    alat: ATURAN_ALAT,
    momen: ['blok', 'v_terbuka', 'blok'],
    hitungan: [16, 16],
    fokus: ['Garis diagonal lurus; cover ke depan', 'Kembali ke dot blok yang sama'],
  },
  {
    id: 5,
    judul: 'Lingkaran',
    ringkas: 'Blok berubah menjadi lingkaran besar dengan guard sebagai latar di belakangnya, lalu kembali ke blok.',
    kapan: 'Januari',
    teknik: ['Gerak lengkung', 'Slide', 'Jaga interval'],
    alat: ATURAN_ALAT,
    momen: ['blok', 'lingkaran', 'blok'],
    hitungan: [16, 16],
    fokus: ['Interval sama di sepanjang lingkaran', 'Bentuk blok kembali rapi'],
  },
  {
    id: 6,
    judul: 'Panggung Section',
    ringkas: 'Perkusi maju ke tengah depan sebagai blok kecil, brass membuka ke dua sayap, guard menjadi latar di belakang.',
    kapan: 'Januari, saat musik sudah dimainkan sambil jalan',
    teknik: ['Forward', 'Slide', 'Staging section'],
    alat: ATURAN_ALAT + ' Konsep ini paling berguna dengan alat dan musik.',
    momen: ['blok', 'panggung', 'company_front'],
    hitungan: [16, 16],
    fokus: ['Tiap section menemukan tempatnya; perkusi tetap rapat', 'Semua masuk garis depan bersama; guard menjaga 6 langkah'],
  },
  {
    id: 7,
    judul: 'Kotak dan Penutup',
    ringkas: 'Kedua ujung garis depan melipat ke belakang menjadi kotak terbuka, guard masuk ke dalamnya, lalu semua kembali ke garis depan dan tahan sebagai penutup.',
    kapan: 'Januari, sebagai penutup rangkaian',
    teknik: ['Slide', 'Backward', 'Ganti arah'],
    alat: ATURAN_ALAT,
    momen: ['company_front', 'kotak', 'company_front'],
    hitungan: [16, 16],
    fokus: ['Sudut kotak tajam; guard masuk dari belakang', 'Ujung kotak membuka kembali tepat di hitungan terakhir; tahan rapi sebagai penutup'],
  },
]

/* ========================================================================== */
/*  Pemain & peran                                                            */
/* ========================================================================== */

export type PeranDisplay = 'brass' | 'perkusi' | 'guard' | 'pit' | 'pemimpin' | 'lain'

export interface PemainDisplay {
  id: string
  section: string
  /** Label section dari Pengaturan (dipakai menebak peran). */
  labelSection?: string
  role?: MemberRole
  code?: string
}

/** Urutan peran dari depan ke belakang di blok, sekaligus urutan baris laporan. */
export const URUTAN_PERAN: PeranDisplay[] = ['brass', 'lain', 'perkusi', 'guard']

/** Tebak peran tampil dari label/id section dan peran anggota. */
export function peranDisplay(p: Pick<PemainDisplay, 'section' | 'labelSection' | 'role'>): PeranDisplay {
  if (p.role === 'drumMajor') return 'pemimpin'
  const t = `${p.labelSection ?? ''} ${p.section}`.toLowerCase()
  if (/\b(fc|field ?commander|mayoret|mayorette|drum ?major|gitapati)\b/.test(t)) return 'pemimpin'
  if (/\b(pit|front ?ensemble|keyboard|marimba|vibra)/.test(t)) return 'pit'
  if (/(guard|\bcg\b|bendera|flag|rifle|sabre|tari)/.test(t)) return 'guard'
  if (/(perkusi|percussion|battery|drum|snare|tenor|quint|cymbal|simbal)/.test(t)) return 'perkusi'
  if (/(brass|tiup|trumpet|terompet|mello|horn|baritone|bariton|euph|tuba|sousa|trombone|woodwind)/.test(t)) return 'brass'
  return 'lain'
}

/* ========================================================================== */
/*  Geometri                                                                  */
/* ========================================================================== */

interface Slot {
  x: number
  y: number
  peran: PeranDisplay
}

interface Ruang {
  s: number
  /** batas lapangan yang boleh dipakai (yard) */
  xMin: number
  xMax: number
  yMin: number
  yMax: number
  /** y garis depan formasi (T1, atau lebih maju di lapangan dangkal) */
  yDepan: number
  /** y tepi depan (T0) */
  yT0: number
  /** lebar zona tengah: paling lebar 64 langkah (A ± 4 huruf) */
  lebarZona: number
  /** kedalaman dari garis depan sampai batas belakang */
  dalamZona: number
}

/** Lebar zona tengah dalam langkah: C′ sampai C dan satu huruf lagi di tiap sisi. */
export const LEBAR_ZONA_LANGKAH = 64
/** Jarak terdekat yang masih aman saat dua pemain berpapasan (langkah). */
export const JARAK_PAPASAN_MIN = 1.5
/** Jarak antarlapis (saf, busur, lingkaran) dalam langkah. */
const JARAK_LAPIS = 4

function ruangLapangan(f: FieldConfig): Ruang {
  const s = stepYd(f)
  const b = fieldBox(f)
  const tepi = 2 * s
  const yT0 = b.minY
  // Lapangan yang sangat dangkal: garis depan dimajukan supaya tetap ada ruang.
  const kedalaman = b.maxY - b.minY
  const offsetDepan = Math.min(8 * s, Math.max(tepi, kedalaman * 0.2))
  const xMin = b.minX + tepi
  const xMax = b.maxX - tepi
  const yDepan = yT0 + offsetDepan
  const yMax = b.maxY - tepi
  return {
    s,
    xMin,
    xMax,
    yMin: yT0 + tepi,
    yMax,
    yDepan,
    yT0,
    lebarZona: Math.min(xMax - xMin, LEBAR_ZONA_LANGKAH * s),
    dalamZona: Math.max(0, yMax - yDepan),
  }
}

/** Bulatkan ke langkah utuh: x dari A (tengah), y dari T0 (tepi depan). */
function bulat(x: number, y: number, r: Ruang): { x: number; y: number } {
  const bx = Math.round(x / r.s) * r.s
  const by = r.yT0 + Math.round((y - r.yT0) / r.s) * r.s
  // Hindari -0 supaya A tetap terbaca "0" di editor.
  return { x: bx === 0 ? 0 : bx, y: by === 0 ? 0 : by }
}

/** Sebar n titik merata dengan jarak `iv`, berpusat di cx (urutan Side 1 → Side 2). */
function garisX(n: number, iv: number, cx = 0): number[] {
  return Array.from({ length: n }, (_, i) => cx + ((n - 1) / 2 - i) * iv)
}

interface Jumlah {
  brass: number
  perkusi: number
  guard: number
  lain: number
}

const musikDari = (j: Jumlah) => j.brass + j.perkusi + j.lain
const isi = (n: number, p: PeranDisplay) => Array<PeranDisplay>(Math.max(0, n)).fill(p)

/**
 * Susunan peran di garis musik: separuh brass (Side 1), lain, perkusi di
 * tengah, lain, separuh brass (Side 2). Perkusi di tengah supaya tempo
 * terdengar merata ke kedua ujung. Urutan ini juga dipakai untuk kolom blok,
 * sehingga blok → garis cukup "membuka kipas" tanpa ada yang menyeberang.
 */
function urutanGarisMusik(j: Jumlah): PeranDisplay[] {
  const bKiri = Math.ceil(j.brass / 2)
  const lKiri = Math.ceil(j.lain / 2)
  return [
    ...isi(bKiri, 'brass'),
    ...isi(lKiri, 'lain'),
    ...isi(j.perkusi, 'perkusi'),
    ...isi(j.lain - lKiri, 'lain'),
    ...isi(j.brass - bKiri, 'brass'),
  ]
}

/**
 * Beri peran pada posisi musik menurut urutan samping: posisi paling Side 1
 * mendapat peran pertama dari urutanGarisMusik, dan seterusnya. Karena semua
 * bentuk memakai pita samping yang sama (brass | perkusi | brass), tiap
 * kelompok tetap di pitanya sendiri dan jalurnya tidak memotong kelompok lain.
 */
function labelSamping(pos: { x: number; y: number }[], j: Jumlah): Slot[] {
  const peran = urutanGarisMusik(j)
  return [...pos]
    .sort((a, b) => b.x - a.x || a.y - b.y)
    .map((t, i) => ({ x: t.x, y: t.y, peran: peran[i] ?? 'lain' }))
}

/** Pecah n menjadi bagian sebanyak `jumlah.length` sesuai kapasitas, sisa ke lapis pertama. */
function bagiKapasitas(n: number, kap: number[]): number[] {
  const hasil = kap.map(() => 0)
  const totalKap = kap.reduce((a, b) => a + b, 0)
  if (!totalKap) return hasil
  let sisa = n
  kap.forEach((k, i) => {
    hasil[i] = Math.min(k, Math.floor((n * k) / totalKap))
    sisa -= hasil[i]
  })
  for (let i = 0; sisa > 0 && i < 1000; i++) {
    const l = i % kap.length
    hasil[l] += 1
    sisa -= 1
  }
  return hasil
}

/**
 * Bagikan urutan peran ke beberapa lapis secara berselang (setiap lapis tetap
 * berisi brass–perkusi–brass dengan urutan kiri-kanan yang sama).
 */
function selangSeling(peran: PeranDisplay[], banyak: number[]): PeranDisplay[][] {
  const lapis: PeranDisplay[][] = banyak.map(() => [])
  peran.forEach((p) => {
    let pilih = 0
    let rasio = Infinity
    banyak.forEach((b, l) => {
      if (lapis[l].length >= b) return
      const r = lapis[l].length / b
      if (r < rasio) {
        rasio = r
        pilih = l
      }
    })
    lapis[pilih].push(p)
  })
  return lapis
}

/** Garis bersaf (company front) mulai y0; dipecah per kapasitas zona. */
function garisBersaf(
  peran: PeranDisplay[],
  ivL: number,
  y0: number,
  r: Ruang,
  jarakSafL = JARAK_LAPIS,
  lebarMaks = r.lebarZona,
) {
  const n = peran.length
  if (!n) return { slot: [] as Slot[], saf: 0, tinggi: 0 }
  const iv = ivL * r.s
  const kap = Math.max(1, Math.floor(Math.min(r.lebarZona, lebarMaks) / iv + 1e-9) + 1)
  const saf = Math.ceil(n / kap)
  const lapis = selangSeling(peran, bagiSaf(n, saf))
  const slot: Slot[] = []
  lapis.forEach((l, si) => {
    const geser = saf > 1 && si % 2 === 1 ? iv / 2 : 0
    garisX(l.length, iv, geser).forEach((x, k) => slot.push({ x, y: y0 + si * jarakSafL * r.s, peran: l[k] }))
  })
  return { slot, saf, tinggi: (saf - 1) * jarakSafL * r.s }
}

/** Pecah n ke `k` saf yang hampir sama panjang. */
function bagiSaf(n: number, k: number): number[] {
  const dasar = Math.floor(n / k)
  const sisa = n % k
  return Array.from({ length: k }, (_, i) => dasar + (i < sisa ? 1 : 0))
}

/** Guard: garis di belakang y0 (dipakai bila tidak muat di dalam bentuk). */
/**
 * Lebar guard di belakang garis musik: 10 langkah lebih sempit di tiap ujung
 * (dua lapis musik + ruang bendera), tapi paling tidak separuh lebar musik.
 * Ujung garis musik jadi bebas melipat ke belakang tanpa menembus guard.
 */
function lebarGuard(lebarMusik: number, r: Ruang): number {
  return Math.max(lebarMusik - 20 * r.s, lebarMusik / 2)
}

function guardDiBelakang(n: number, ivG: number, y0: number, r: Ruang, lebarMusik?: number): Slot[] {
  const lebarMaks = lebarMusik === undefined ? r.lebarZona : lebarGuard(lebarMusik, r)
  const sempit = garisBersaf(isi(n, 'guard'), ivG, y0, r, ivG, lebarMaks).slot
  if (sempit.every((t) => t.y <= r.yMax + 1e-6)) return sempit
  // Lapangan dangkal: guard melebar dan maju 2 langkah lebih dekat ke musik.
  return garisBersaf(isi(n, 'guard'), ivG, y0 - 2 * r.s, r, ivG).slot
}

/**
 * Tinggi tiap kolom blok (Side 1 → Side 2). Kolom dibagi per pita samping
 * (brass Side 1 | perkusi | brass Side 2) supaya tidak ada kolom campuran:
 * dengan begitu perkusi tidak perlu menembus brass saat blok membuka.
 */
function tinggiKolomBlok(j: Jumlah, kolomM: number): number[] {
  const nM = musikDari(j)
  const kiri = Math.ceil(j.brass / 2) + Math.ceil(j.lain / 2)
  const pita = [kiri, j.perkusi, nM - kiri - j.perkusi]
  const isiPita = pita.filter((c) => c > 0).length
  if (!nM || kolomM < isiPita) return bagiSaf(nM, kolomM)
  if (!pita[0] && !pita[2]) return bagiSaf(nM, kolomM)
  // Kolom brass kedua sisi selalu sama banyak supaya blok simetris terhadap A.
  const sisi = Math.max(pita[0], pita[2])
  let best: number[] = []
  let skor = Infinity
  for (let kS = sisi ? 1 : 0; kS <= (sisi ? Math.floor(kolomM / 2) : 0); kS++) {
    const kP = kolomM - 2 * kS
    if (j.perkusi > 0 ? kP < 1 : kP !== 0) continue
    const d = [sisi / Math.max(1, kS), j.perkusi / Math.max(1, kP)].filter((x) => x > 0)
    const sk = Math.max(...d.map(Math.ceil)) * 10 + (Math.max(...d) - Math.min(...d))
    if (sk < skor) {
      skor = sk
      best = [kS, kP, kS]
    }
  }
  if (!best.length) return bagiSaf(nM, kolomM)
  const kol = best
  return pita.flatMap((c, i) => (kol[i] ? bagiSaf(c, kol[i]) : []))
}

function bentukBlok(j: Jumlah, ivL: number, r: Ruang): Slot[] {
  const musik = urutanGarisMusik(j)
  const nM = musik.length
  const n = nM + j.guard
  if (!n) return []
  const iv = ivL * r.s
  const kolomMaks = Math.max(1, Math.floor(r.lebarZona / iv + 1e-9) + 1)
  // 58 orang → 9 banjar, seperti basics block di Panduan Mengajar.
  const kolom = Math.max(1, Math.min(kolomMaks, n, Math.round(Math.sqrt((n * 9) / 7))))
  const slot: Slot[] = []
  // Musik diisi per kolom (Side 1 → Side 2), dari depan ke belakang.
  const kolomM = Math.min(kolom, Math.max(1, nM))
  const tinggi = tinggiKolomBlok(j, kolomM)
  const y0 = r.yDepan
  let k = 0
  tinggi.forEach((t, c) => {
    const x = ((kolomM - 1) / 2 - c) * iv
    for (let b = 0; b < t; b++) slot.push({ x, y: y0 + b * iv, peran: musik[k++] })
  })
  // Guard di saf belakang, baris demi baris, dirapatkan ke tengah.
  const barisM = nM ? Math.max(...tinggi) : 0
  for (let i = 0; i < j.guard; i++) {
    const c = i % kolom
    const b = Math.floor(i / kolom)
    const diBaris = Math.min(kolom, j.guard - b * kolom)
    slot.push({ x: ((diBaris - 1) / 2 - c) * iv, y: y0 + (barisM + b) * iv, peran: 'guard' })
  }
  return slot
}

function bentukCompanyFront(j: Jumlah, ivM: number, ivG: number, r: Ruang): Slot[] {
  const musik = garisBersaf(urutanGarisMusik(j), ivM, r.yDepan, r)
  const yGuard = r.yDepan + musik.tinggi + 6 * r.s
  const lebarMusik = musik.slot.length ? Math.max(...musik.slot.map((t) => Math.abs(t.x))) * 2 : 0
  return [...musik.slot, ...guardDiBelakang(j.guard, ivG, yGuard, r, lebarMusik)]
}

/** n titik merata menurut panjang busur kurva c(u), u ∈ [−1, 1]. */
function sebarKurva(c: (u: number) => { x: number; y: number }, n: number): { x: number; y: number }[] {
  if (n <= 0) return []
  if (n === 1) return [c(0)]
  const seg = 400
  const cum = [0]
  let prev = c(-1)
  for (let i = 1; i <= seg; i++) {
    const cur = c(-1 + (2 * i) / seg)
    cum.push(cum[i - 1] + Math.hypot(cur.x - prev.x, cur.y - prev.y))
    prev = cur
  }
  const total = cum[seg]
  const hasil: { x: number; y: number }[] = []
  let j = 0
  for (let i = 0; i < n; i++) {
    const target = (i / (n - 1)) * total
    while (j < seg - 1 && cum[j + 1] < target) j++
    const f = cum[j + 1] > cum[j] ? (target - cum[j]) / (cum[j + 1] - cum[j]) : 0
    hasil.push(c(-1 + (2 * (j + f)) / seg))
  }
  return hasil
}

/** Panjang busur parabola y = d(1 − u²) selebar W, dengan d = rasio·W. */
const FAKTOR_BUSUR = 1.19 // untuk rasio 0,25

function bentukBusur(j: Jumlah, ivM: number, ivG: number, r: Ruang): Slot[] {
  const peran = urutanGarisMusik(j)
  const n = peran.length
  const iv = ivM * r.s
  const kap = Math.max(2, Math.floor((r.lebarZona * FAKTOR_BUSUR) / iv) + 1)
  const L = Math.max(1, Math.ceil(n / kap))
  const lapis = selangSeling(peran, bagiSaf(n, L))
  const slot: Slot[] = []
  let yBelakang = r.yDepan
  lapis.forEach((lp, l) => {
    const m = lp.length
    const lebar = Math.min(r.lebarZona, Math.max(iv, ((m - 1) * iv) / FAKTOR_BUSUR))
    const dalam = lebar * 0.25
    const y0 = r.yDepan + l * JARAK_LAPIS * r.s
    yBelakang = Math.max(yBelakang, y0 + dalam)
    sebarKurva((u) => ({ x: (-u * lebar) / 2, y: y0 + dalam * (1 - u * u) }), m).forEach((t, i) =>
      slot.push({ ...t, peran: lp[i] }),
    )
  })
  // Guard menjadi latar di belakang busur: tidak menembus musik saat masuk.
  if (j.guard) slot.push(...guardDiBelakang(j.guard, ivG, yBelakang + 6 * r.s, r, Math.max(0, ...slot.map((t) => Math.abs(t.x))) * 2))
  return slot
}

const SUDUT_LENGAN = (32 * Math.PI) / 180

/** Baji (ujung di depan) atau V terbuka (ujung di belakang), bisa berlapis. */
function bentukLengan(j: Jumlah, ivM: number, ivG: number, r: Ruang, ujungDiDepan: boolean): Slot[] {
  const iv = ivM * r.s
  const n = musikDari(j)
  const dx = Math.cos(SUDUT_LENGAN) * iv
  const dy = Math.sin(SUDUT_LENGAN) * iv
  const perLengan = Math.max(1, Math.floor(r.lebarZona / 2 / dx - 0.5 + 1e-9) + 1)
  const L = Math.max(1, Math.ceil(n / (2 * perLengan)))
  const pos: { x: number; y: number }[] = []
  let dalamMaks = 0
  bagiSaf(n, L).forEach((m, l) => {
    const nKiri = Math.ceil(m / 2)
    const nKanan = m - nKiri
    const dalam = (Math.max(nKiri, nKanan) - 0.5) * dy
    dalamMaks = Math.max(dalamMaks, dalam)
    const geserY = l * JARAK_LAPIS * r.s
    const titik = (k: number, arah: 1 | -1) => ({
      x: arah * (k + 0.5) * dx,
      y: ujungDiDepan ? r.yDepan + geserY + (k + 0.5) * dy : r.yDepan + geserY + dalam - (k + 0.5) * dy,
    })
    for (let k = 0; k < nKiri; k++) pos.push(titik(k, 1))
    for (let k = 0; k < nKanan; k++) pos.push(titik(k, -1))
  })
  // Perkusi di ujung V (tengah samping), brass di kedua lengan.
  const slot = labelSamping(pos, j)
  if (j.guard) {
    const lapisAkhir = (L - 1) * JARAK_LAPIS * r.s
    slot.push(...guardDiBelakang(j.guard, ivG, r.yDepan + lapisAkhir + dalamMaks + 6 * r.s, r, Math.max(0, ...slot.map((t) => Math.abs(t.x))) * 2))
  }
  return slot
}

function bentukLingkaran(j: Jumlah, ivM: number, ivG: number, r: Ruang): Slot[] {
  const peran = urutanGarisMusik(j)
  const n = peran.length
  const iv = ivM * r.s
  const rMaks = Math.max(4 * r.s, Math.min(r.lebarZona, r.dalamZona) / 2)
  const R0 = Math.min(rMaks, Math.max(4 * r.s, (n * iv) / (2 * Math.PI)))
  // Lapis ke dalam setiap 4 langkah sampai semua muat.
  const jari: number[] = []
  const kap: number[] = []
  for (let R = R0; R >= 4 * r.s - 1e-9 && kap.reduce((a, b) => a + b, 0) < n; R -= JARAK_LAPIS * r.s) {
    jari.push(R)
    kap.push(Math.max(1, Math.floor((2 * Math.PI * R) / iv + 1e-9)))
  }
  const banyak = bagiKapasitas(n, kap)
  const cy = r.yDepan + R0
  const pos: { x: number; y: number }[] = []
  banyak.forEach((m, l) => {
    const R = jari[l]
    for (let i = 0; i < m; i++) {
      const a = -Math.PI / 2 + ((i + 0.5) / m) * Math.PI * 2
      pos.push({ x: Math.cos(a) * R, y: cy + Math.sin(a) * R })
    }
  })
  const slot = labelSamping(pos, j)
  if (j.guard) slot.push(...guardDiBelakang(j.guard, ivG, cy + R0 + 6 * r.s, r, Math.max(0, ...slot.map((t) => Math.abs(t.x))) * 2))
  return slot
}

/**
 * Panggung section: perkusi maju ke tengah depan sebagai blok kecil, brass
 * membuka ke dua sayap sedikit di belakangnya, guard menjadi latar di
 * belakang. Pita samping (brass | perkusi | brass) sama dengan blok, jadi
 * tidak ada kelompok yang memotong kelompok lain.
 */
function bentukPanggung(j: Jumlah, ivM: number, ivG: number, r: Ruang): Slot[] {
  const iv = ivM * r.s
  const pos: { x: number; y: number }[] = []
  const kolomP = Math.max(1, Math.min(j.perkusi, Math.ceil(Math.sqrt(j.perkusi * 2))))
  for (let i = 0; i < j.perkusi; i++) {
    const c = i % kolomP
    const b = Math.floor(i / kolomP)
    const diBaris = Math.min(kolomP, j.perkusi - b * kolomP)
    pos.push({ x: ((diBaris - 1) / 2 - c) * iv, y: r.yDepan + b * iv })
  }
  const barisP = j.perkusi ? Math.ceil(j.perkusi / kolomP) : 0
  const lebarP = j.perkusi ? (Math.min(kolomP, j.perkusi) - 1) * iv : 0
  const x0 = j.perkusi ? lebarP / 2 + 4 * r.s : iv / 2
  const ySayap = r.yDepan + (j.perkusi ? 4 * r.s : 0)
  let yBelakang = r.yDepan + Math.max(0, barisP - 1) * iv
  const sayap = (m: number, arah: 1 | -1) => {
    if (!m) return
    const kolomMaks = Math.max(1, Math.floor((r.lebarZona / 2 - x0) / iv + 1e-9) + 1)
    const kolom = Math.max(1, Math.min(kolomMaks, m, Math.ceil(Math.sqrt(m * 2))))
    for (let i = 0; i < m; i++) {
      const c = i % kolom
      const b = Math.floor(i / kolom)
      const y = ySayap + b * iv
      yBelakang = Math.max(yBelakang, y)
      pos.push({ x: arah * (x0 + c * iv), y })
    }
  }
  const kiri = Math.ceil(j.brass / 2) + Math.ceil(j.lain / 2)
  sayap(kiri, 1)
  sayap(j.brass + j.lain - kiri, -1)
  const slot = labelSamping(pos, j)
  const lebarMusik = slot.length ? Math.max(...slot.map((t) => Math.abs(t.x))) * 2 : 0
  slot.push(...guardDiBelakang(j.guard, ivG, yBelakang + 6 * r.s, r, lebarMusik))
  return slot
}

/**
 * Kotak terbuka: sisi depan dan dua sisi samping, terbuka ke belakang. Guard
 * masuk dari belakang ke dalam kotak tanpa menembus barisan musik. Lapis
 * dalam (bila perlu) masuk 4 langkah dari depan dan dari tiap sisi.
 */
function bentukKotak(j: Jumlah, ivM: number, ivG: number, r: Ruang): Slot[] {
  const n = musikDari(j)
  const iv = ivM * r.s
  const sisiMaksN = Math.max(2, Math.floor(Math.min(r.lebarZona, r.dalamZona) / iv + 1e-9) + 1)
  // Lebar sisi depan ±0,6n titik, sisi samping sepertiganya: kotak pipih
  // sehingga ujung garis cukup melipat pendek ke belakang.
  const k0 = Math.max(2, Math.min(sisiMaksN, Math.ceil((n * 3) / 5)))
  const L0 = (k0 - 1) * iv
  // Kedalaman sisi samping mulai sepertiga lebar; ditambah bila belum muat.
  type Lapis = { setengah: number; yDepan: number; panjang: number }
  let yBelakang = r.yDepan
  let lapis: Lapis[] = []
  const susunLapis = (dalam: number) => {
    yBelakang = r.yDepan + dalam
    lapis = []
    let total = 0
    for (let l = 0; total < n && l < 20; l++) {
      const o = l * JARAK_LAPIS * r.s
      const setengah = L0 / 2 - o
      const yDepan = r.yDepan + o
      if (setengah < iv / 2 || yBelakang - yDepan < iv) break
      const panjang = 2 * setengah + 2 * (yBelakang - yDepan)
      lapis.push({ setengah, yDepan, panjang })
      total += Math.floor(panjang / iv + 1e-9) + 1
    }
    return total
  }
  let dalam = Math.min(r.dalamZona, Math.max(2, Math.round(k0 / 3)) * iv)
  while (susunLapis(dalam) < n && dalam + iv <= r.dalamZona + 1e-9) dalam += iv
  if (!lapis.length) lapis.push({ setengah: L0 / 2, yDepan: r.yDepan, panjang: L0 + 2 * Math.max(iv, dalam) })
  /** Titik pada jarak d sepanjang jalur U: belakang Side 1 → depan → belakang Side 2. */
  const titikJalur = (lp: Lapis, d: number) => {
    const sisi = yBelakang - lp.yDepan
    if (d <= sisi) return { x: lp.setengah, y: yBelakang - d }
    if (d <= sisi + 2 * lp.setengah) return { x: lp.setengah - (d - sisi), y: lp.yDepan }
    return { x: -lp.setengah, y: lp.yDepan + (d - sisi - 2 * lp.setengah) }
  }
  // Peran mengikuti urutan jalur, sama seperti urutan garis musik, jadi
  // brass di ujung garis menjadi sisi samping dan perkusi tetap di depan tengah.
  const banyak = bagiKapasitas(
    n,
    lapis.map((lp) => Math.floor(lp.panjang / iv + 1e-9) + 1),
  )
  const lapisPeran = selangSeling(urutanGarisMusik(j), banyak)
  const slot: Slot[] = []
  banyak.forEach((m, l) => {
    const lp = lapis[l]
    for (let i = 0; i < m; i++) {
      const d = m > 1 ? (i * lp.panjang) / (m - 1) : lp.panjang / 2
      slot.push({ ...titikJalur(lp, d), peran: lapisPeran[l][i] })
    }
  })
  if (j.guard) {
    const lIn = Math.max(0, lapis.length - 1)
    const setengahIn = L0 / 2 - lIn * JARAK_LAPIS * r.s
    const yDepanIn = r.yDepan + lIn * JARAK_LAPIS * r.s + 6 * r.s
    // 6 langkah dari tiap sisi: ruang bagi bendera dan bagi sisi yang melipat.
    // Guard memakai lebar yang sama dengan susunannya di company front, jadi
    // cukup maju lurus masuk ke kotak dan mundur lurus saat kembali.
    const ruang = 2 * setengahIn - 12 * r.s
    const cf = garisBersaf(urutanGarisMusik(j), ivM, r.yDepan, r).slot
    const lebarCf = cf.length ? lebarGuard(Math.max(...cf.map((t) => Math.abs(t.x))) * 2, r) : 0
    const lebarG = Math.min(ruang, lebarCf)
    if (lebarG >= 0) {
      // Guard berdiri di bagian belakang kotak: musik yang melipat ke sisi
      // lewat di depan guard, bukan memotong barisannya.
      const g = garisBersaf(isi(j.guard, 'guard'), ivG, 0, r, ivG, lebarG)
      const yG = Math.max(yDepanIn, yBelakang - g.tinggi)
      slot.push(...g.slot.map((t) => ({ ...t, y: t.y + yG })))
    } else slot.push(...guardDiBelakang(j.guard, ivG, yBelakang + 6 * r.s, r))
  }
  return slot
}

function buatSlot(m: JenisMomen, j: Jumlah, ivM: number, ivG: number, ivB: number, r: Ruang): Slot[] {
  switch (m) {
    case 'blok':
      return bentukBlok(j, ivB, r)
    case 'company_front':
      return bentukCompanyFront(j, ivM, ivG, r)
    case 'busur':
      return bentukBusur(j, ivM, ivG, r)
    case 'baji':
      return bentukLengan(j, ivM, ivG, r, true)
    case 'v_terbuka':
      return bentukLengan(j, ivM, ivG, r, false)
    case 'lingkaran':
      return bentukLingkaran(j, ivM, ivG, r)
    case 'panggung':
      return bentukPanggung(j, ivM, ivG, r)
    case 'kotak':
      return bentukKotak(j, ivM, ivG, r)
  }
}

function muat(slot: Slot[], r: Ruang): boolean {
  return slot.every((t) => t.x >= r.xMin - 1e-6 && t.x <= r.xMax + 1e-6 && t.y >= r.yMin - 1e-6 && t.y <= r.yMax + 1e-6)
}

/* ========================================================================== */
/*  Penyusun                                                                  */
/* ========================================================================== */

export interface OpsiPenyusun {
  konsep: number
  field: FieldConfig
  /** Interval musik di bentuk display (langkah). Bawaan 3. */
  intervalMusik?: number
  /** Interval guard (langkah). Bawaan 6. */
  intervalGuard?: number
  /** Interval basics block (langkah). Bawaan 4. */
  intervalBlok?: number
}

export interface SetDisplay {
  nama: string
  momen: JenisMomen
  /** Hitungan menuju set berikutnya (set terakhir: tahan). */
  counts: number
  points: Record<string, DrillPoint>
  catatan: string
}

export interface TransisiDisplay {
  dari: string
  ke: string
  counts: number
  /** Langkah standar per hitungan terbesar (1 = 8 to 5). */
  langkahPerHitungan: number
  /** Ukuran langkah terbesar dalam bentuk "N to 5" (dibulatkan). */
  ukuranTo5: number
  /** Jarak terdekat antar-pemain selama berjalan (langkah). */
  jarakMinLangkah: number
  fokus: string
}

export interface HasilPenyusun {
  konsep: KonsepDisplay
  sets: SetDisplay[]
  transisi: TransisiDisplay[]
  jumlah: Record<PeranDisplay, number>
  interval: { musik: number; guard: number; blok: number }
  peringatan: string[]
}

export function konsepById(id: number): KonsepDisplay {
  return KONSEP_DISPLAY.find((k) => k.id === id) ?? KONSEP_DISPLAY[0]
}

/**
 * Penugasan optimal (Hungarian, O(n³)) untuk matriks biaya persegi.
 * Mengembalikan kolom untuk tiap baris.
 */
export function tugaskan(biaya: number[][]): number[] {
  const n = biaya.length
  if (!n) return []
  const u = new Array(n + 1).fill(0)
  const v = new Array(n + 1).fill(0)
  const p = new Array(n + 1).fill(0)
  const way = new Array(n + 1).fill(0)
  for (let i = 1; i <= n; i++) {
    p[0] = i
    let j0 = 0
    const minv = new Array(n + 1).fill(Infinity)
    const used = new Array(n + 1).fill(false)
    do {
      used[j0] = true
      const i0 = p[j0]
      let delta = Infinity
      let j1 = 0
      for (let j = 1; j <= n; j++) {
        if (used[j]) continue
        const cur = biaya[i0 - 1][j - 1] - u[i0] - v[j]
        if (cur < minv[j]) {
          minv[j] = cur
          way[j] = j0
        }
        if (minv[j] < delta) {
          delta = minv[j]
          j1 = j
        }
      }
      for (let j = 0; j <= n; j++) {
        if (used[j]) {
          u[p[j]] += delta
          v[j] -= delta
        } else minv[j] -= delta
      }
      j0 = j1
    } while (p[j0] !== 0)
    do {
      const j1 = way[j0]
      p[j0] = p[j1]
      j0 = j1
    } while (j0)
  }
  const hasil = new Array(n).fill(-1)
  for (let j = 1; j <= n; j++) if (p[j]) hasil[p[j] - 1] = j - 1
  return hasil
}

/**
 * Pasangkan pemain ke slot per peran. Set pertama mengikuti urutan kode
 * (mudah dibaca di lapangan). Set berikutnya memakai penugasan dengan jumlah
 * kuadrat jarak terkecil: jalur lurus yang dihasilkan tidak saling silang
 * dan langkah terbesar ikut kecil.
 */
function pasangkan(
  slot: Slot[],
  kelompok: Record<PeranDisplay, PemainDisplay[]>,
  sebelum: Record<string, DrillPoint> | null,
  r: Ruang,
  gabungMusik = false,
): Record<string, DrillPoint> {
  const hasil: Record<string, DrillPoint> = {}
  // Mode gabung: brass, perkusi, dan lainnya dipasangkan bersama (pita samping
  // tetap terjaga, hanya pemain di perbatasan kelompok yang bisa bertukar).
  const grup = (p: PeranDisplay): PeranDisplay => (gabungMusik && (p === 'perkusi' || p === 'lain') ? 'brass' : p)
  const peranSlot = [...new Set(slot.map((t) => grup(t.peran)))]
  for (const p of peranSlot) {
    const daftar = slot.filter((t) => grup(t.peran) === p).map((t) => ({ ...t, ...bulat(t.x, t.y, r) }))
    const anggota =
      gabungMusik && p === 'brass' ? [...kelompok.brass, ...kelompok.lain, ...kelompok.perkusi] : (kelompok[p] ?? [])
    const pemain = anggota.slice(0, daftar.length)
    if (!sebelum) {
      pemain.forEach((m, i) => (hasil[m.id] = { x: daftar[i].x, y: daftar[i].y, facing: 'front' }))
      continue
    }
    const biaya = pemain.map((m) => {
      const a = sebelum[m.id]
      return daftar.map((t) => (a ? (t.x - a.x) ** 2 + (t.y - a.y) ** 2 : 0))
    })
    // Lengkapi menjadi persegi (slot lebih banyak dari pemain tidak terjadi, tapi aman).
    while (biaya.length < daftar.length) biaya.push(daftar.map(() => 0))
    const kol = tugaskan(biaya)
    pemain.forEach((m, i) => {
      const t = daftar[kol[i]]
      hasil[m.id] = { x: t.x, y: t.y, facing: 'front' }
    })
  }
  return hasil
}

/** Jarak terdekat antar-dot dalam satu set (langkah). */
export function jarakDotTerdekat(points: Record<string, DrillPoint>, s: number): number {
  const v = Object.values(points)
  let min = Infinity
  for (let i = 0; i < v.length; i++)
    for (let k = i + 1; k < v.length; k++) min = Math.min(min, Math.hypot(v[i].x - v[k].x, v[i].y - v[k].y))
  return Number.isFinite(min) ? min / s : Infinity
}

/** Langkah per hitungan terbesar & jarak terdekat selama transisi (sampel linear). */
export function ukurTransisi(
  a: Record<string, DrillPoint>,
  b: Record<string, DrillPoint>,
  counts: number,
  s: number,
): { langkahPerHitungan: number; jarakMinLangkah: number } {
  const ids = Object.keys(a).filter((id) => b[id])
  let maks = 0
  for (const id of ids) maks = Math.max(maks, Math.hypot(b[id].x - a[id].x, b[id].y - a[id].y))
  let min = Infinity
  const sampel = Math.max(4, counts)
  for (let k = 0; k <= sampel; k++) {
    const t = k / sampel
    const pos = ids.map((id) => [a[id].x + (b[id].x - a[id].x) * t, a[id].y + (b[id].y - a[id].y) * t])
    for (let i = 0; i < pos.length; i++)
      for (let j = i + 1; j < pos.length; j++) {
        const d = Math.hypot(pos[i][0] - pos[j][0], pos[i][1] - pos[j][1])
        if (d < min) min = d
      }
  }
  return {
    langkahPerHitungan: counts > 0 ? maks / s / counts : 0,
    jarakMinLangkah: Number.isFinite(min) ? min / s : Infinity,
  }
}

export function susunDisplay(pemain: PemainDisplay[], opsi: OpsiPenyusun): HasilPenyusun {
  const konsep = konsepById(opsi.konsep)
  const r = ruangLapangan(opsi.field)
  const peringatan: string[] = []
  const kelompok: Record<PeranDisplay, PemainDisplay[]> = {
    brass: [],
    perkusi: [],
    guard: [],
    pit: [],
    pemimpin: [],
    lain: [],
  }
  for (const p of pemain) kelompok[peranDisplay(p)].push(p)
  const urutKode = (a: PemainDisplay, b: PemainDisplay) =>
    (a.code ?? a.id).localeCompare(b.code ?? b.id, 'id', { numeric: true })
  for (const k of Object.values(kelompok)) k.sort(urutKode)
  const jumlah: Record<PeranDisplay, number> = {
    brass: kelompok.brass.length,
    perkusi: kelompok.perkusi.length,
    guard: kelompok.guard.length,
    pit: kelompok.pit.length,
    pemimpin: kelompok.pemimpin.length,
    lain: kelompok.lain.length,
  }
  const j: Jumlah = { brass: jumlah.brass, perkusi: jumlah.perkusi, guard: jumlah.guard, lain: jumlah.lain }
  const ivMAwal = Math.max(2, opsi.intervalMusik ?? 3)
  const ivGAwal = Math.max(4, opsi.intervalGuard ?? 6)
  const ivBAwal = Math.max(2, opsi.intervalBlok ?? 4)

  if (musikDari(j) + j.guard === 0) {
    return { konsep, sets: [], transisi: [], jumlah, interval: { musik: ivMAwal, guard: ivGAwal, blok: ivBAwal }, peringatan: ['Belum ada pemain hadir yang bisa disusun.'] }
  }

  // Cari interval terbesar yang membuat SEMUA bentuk konsep muat di lapangan.
  let ivM = ivMAwal
  let ivG = ivGAwal
  let ivB = ivBAwal
  const semuaMuat = () =>
    konsep.momen.every((m) => muat(buatSlot(m, j, ivM, ivG, ivB, r), r))
  let aman = 0
  while (!semuaMuat() && aman++ < 20) {
    if (ivG > 4 && ivG - 4 >= ivM - 2) ivG -= 1
    else if (ivB > 2 && ivB > ivM) ivB -= 1
    else if (ivM > 2) ivM -= 1
    else if (ivB > 2) ivB -= 1
    else break
  }
  if (ivM < ivMAwal || ivG < ivGAwal || ivB < ivBAwal) {
    peringatan.push(
      `Lapangan sempit untuk ${pemain.length} orang: interval dipadatkan menjadi musik ${ivM}, guard ${ivG}, blok ${ivB} langkah.`,
    )
  }
  if (!semuaMuat()) {
    peringatan.push('Sebagian dot tetap keluar dari lapangan walau sudah dipadatkan. Pakai konsep lain atau lapangan yang lebih besar.')
  }
  if (ivG < 6 && j.guard) peringatan.push('Ruang guard kurang dari 6 langkah. Latih tanpa bendera dulu atau kurangi putaran lebar.')

  // Bentuk tiap set.
  const sets: SetDisplay[] = []
  let sebelum: Record<string, DrillPoint> | null = null
  konsep.momen.forEach((m, i) => {
    const slot = buatSlot(m, j, ivM, ivG, ivB, r)
    let points = pasangkan(slot, kelompok, sebelum, r)
    // Bila ada yang berpapasan terlalu dekat, coba pasangkan musik sebagai satu
    // kelompok. Tidak dipakai untuk panggung section (peran harus tepat).
    if (sebelum && m !== 'panggung' && m !== 'blok') {
      const a = ukurTransisi(sebelum, points, 16, r.s).jarakMinLangkah
      if (a < JARAK_PAPASAN_MIN) {
        const alt = pasangkan(slot, kelompok, sebelum, r, true)
        if (ukurTransisi(sebelum, alt, 16, r.s).jarakMinLangkah > a) points = alt
      }
    }
    // Pit diam di depan; pemimpin di depan tengah.
    garisX(jumlah.pit, 4 * r.s).forEach((x, k) => {
      const b = bulat(x, r.yT0 + 2 * r.s, r)
      points[kelompok.pit[k].id] = { x: b.x, y: b.y, facing: 'front' }
    })
    garisX(jumlah.pemimpin, 4 * r.s).forEach((x, k) => {
      const b = bulat(x, Math.max(r.yT0 + 3 * r.s, r.yDepan - 4 * r.s), r)
      points[kelompok.pemimpin[k].id] = { x: b.x, y: b.y, facing: 'front' }
    })
    sets.push({
      nama: `Set ${i + 1} · ${LABEL_MOMEN[m]}`,
      momen: m,
      counts: i < konsep.hitungan.length ? konsep.hitungan[i] : 16,
      points,
      catatan: i < konsep.fokus.length ? `Fokus ke set berikutnya: ${konsep.fokus[i]}` : 'Tahan, check and adjust.',
    })
    sebelum = points
  })

  for (const st of sets) {
    const d = jarakDotTerdekat(st.points, r.s)
    if (d < JARAK_PAPASAN_MIN) {
      peringatan.push(`${st.nama}: ada dot yang hanya berjarak ${d.toFixed(1).replace('.', ',')} langkah. Lapangan terlalu sempit untuk jumlah ini; pertimbangkan konsep lain atau bagi dua kelompok.`)
    }
  }

  // Hitungan: naikkan per 8 bila ada yang melangkah lebih besar dari 8 to 5.
  const transisi: TransisiDisplay[] = []
  for (let i = 0; i < sets.length - 1; i++) {
    const a = sets[i]
    const b = sets[i + 1]
    let counts = a.counts
    let u = ukurTransisi(a.points, b.points, counts, r.s)
    if (u.langkahPerHitungan > 1 + 1e-9) {
      const perlu = Math.ceil((u.langkahPerHitungan * counts) / 8 - 1e-9) * 8
      peringatan.push(`${a.nama} → ${b.nama}: hitungan dinaikkan dari ${counts} ke ${perlu} supaya langkah tidak lebih besar dari 8 to 5.`)
      counts = perlu
      a.counts = counts
      u = ukurTransisi(a.points, b.points, counts, r.s)
    }
    if (u.jarakMinLangkah < JARAK_PAPASAN_MIN) {
      peringatan.push(`${a.nama} → ${b.nama}: ada pemain yang berpapasan lebih dekat dari 1,5 langkah. Cek dengan jejak gerak (J) sebelum diajarkan.`)
    }
    transisi.push({
      dari: a.nama,
      ke: b.nama,
      counts,
      langkahPerHitungan: Math.round(u.langkahPerHitungan * 100) / 100,
      ukuranTo5: u.langkahPerHitungan > 0 ? Math.round(8 / u.langkahPerHitungan) : 0,
      jarakMinLangkah: Math.round(u.jarakMinLangkah * 10) / 10,
      fokus: konsep.fokus[i] ?? '',
    })
  }
  return { konsep, sets, transisi, jumlah, interval: { musik: ivM, guard: ivG, blok: ivB }, peringatan }
}

/** Teks count sheet singkat untuk kartu pelatih / catatan drill. */
export function teksCountSheet(h: HasilPenyusun): string {
  const baris: string[] = [`Konsep ${h.konsep.id} — ${h.konsep.judul}`]
  let mulai = 1
  h.sets.forEach((s, i) => {
    if (i === 0) {
      baris.push(`${s.nama}: awal (8 hitungan metronom sebagai aba-aba)`)
      return
    }
    const c = h.sets[i - 1].counts
    baris.push(`${s.nama}: hitungan ${mulai}–${mulai + c - 1}`)
    mulai += c
  })
  const akhir = h.sets[h.sets.length - 1]
  if (akhir) baris.push(`Tahan: hitungan ${mulai}–${mulai + akhir.counts - 1}`)
  return baris.join('\n')
}
