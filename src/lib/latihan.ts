/**
 * H1 — rencana latihan per sesi.
 *
 * Keluhan yang mendasarinya: **latihan sering melenceng dari rencana, dan
 * bagian akhir yang kehabisan waktu.** Bagian akhir selalu yang paling
 * mahal — di situlah biasanya materi yang paling perlu diulang — tetapi
 * justru yang paling dulu dipotong kalau waktunya habis.
 *
 * Modul ini mengerjakan dua hal yang berbeda waktunya:
 *
 * 1. **Sebelum latihan** — apakah rencananya muat di slot sesinya?
 *    (blok 5 × 20 menit di sesi 90 menit tidak akan pernah muat, dan itu
 *    seharusnya ketahuan sebelum lapangan, bukan sesudahnya.)
 * 2. **Selama latihan** — di blok mana kita sekarang, dan **berapa menit
 *    kita sudah melenceng**? Melencengnya terakumulasi, jadi blok terakhir
 *    menanggung semua keterlambatan blok-blok sebelumnya.
 *
 * Sengaja **murni** (tidak menyentuh Dexie, React, atau DOM) supaya bisa
 * diuji langsung dari node, seperti `runsheet.ts` dan `lomba.ts`.
 */
import type { BlokLatihan, JenisBlok, LogRepSet, PrioritasBlok, RealisasiBlok, Session } from '../db/types'

/** Satu blok rencana, sudah dihitung waktu absolutnya. */
export interface BarisRencana {
  id: string
  judul: string
  jenis: JenisBlok
  /** Durasi yang direncanakan, dalam menit. */
  menit: number
  catatan?: string
  /** v2.11 — prioritas efektif (lihat `prioritasBlok`). */
  prioritas: PrioritasBlok
  /** Menit sejak tengah malam. `null` kalau jam mulai sesi tidak sah. */
  mulai: number | null
  selesai: number | null
  urutan: number
}

/**
 * Urutan pilihan jenis/ranah blok di penyunting. #35 menambah delapan ranah
 * (apel, fisik, visual, musik bersama, drill, teori, tes, istirahat); lima
 * nilai lama tetap ada supaya rencana lama terbaca dengan arti yang sama.
 */
export const URUTAN_BLOK: JenisBlok[] = [
  'apel',
  'pemanasan',
  'fisik',
  'visual',
  'musik',
  'section',
  'drill',
  'gabungan',
  'teori',
  'tes',
  'istirahat',
  'pendingin',
  'lainnya',
]

export const LABEL_BLOK: Record<JenisBlok, string> = {
  apel: 'Apel & absensi',
  pemanasan: 'Pemanasan',
  fisik: 'Fisik',
  visual: 'Visual',
  musik: 'Musik bersama',
  section: 'Section',
  drill: 'Drill/formasi',
  gabungan: 'Gabungan',
  teori: 'Teori',
  tes: 'Tes/evaluasi',
  istirahat: 'Istirahat',
  pendingin: 'Pendingin',
  lainnya: 'Lainnya',
}

/** Warna per jenis blok, seragam dengan gaya badge di seluruh aplikasi. */
export const WARNA_BLOK: Record<JenisBlok, string> = {
  apel: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
  pemanasan: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  fisik: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
  visual: 'bg-green-500/15 text-green-300 border-green-500/30',
  musik: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  section: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  drill: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  gabungan: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  teori: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
  tes: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
  istirahat: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
  pendingin: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  lainnya: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
}

/**
 * v2.11 — prioritas blok saat waktu tidak cukup. Bila tidak diisi: apel,
 * tes, dan pendingin dianggap `kunci` (tidak pernah diusulkan dipotong),
 * selebihnya `biasa`.
 */
export function prioritasBlok(b: Pick<BlokLatihan, 'jenis' | 'prioritas'>): PrioritasBlok {
  if (b.prioritas === 'kunci' || b.prioritas === 'biasa' || b.prioritas === 'potong') return b.prioritas
  return b.jenis === 'apel' || b.jenis === 'tes' || b.jenis === 'pendingin' ? 'kunci' : 'biasa'
}

export const LABEL_PRIORITAS: Record<PrioritasBlok, string> = {
  kunci: 'Kunci',
  biasa: 'Biasa',
  potong: 'Potong dulu',
}

/** Total menit yang direncanakan. Blok dengan durasi tidak sah diabaikan. */
export function totalRencana(blok: BlokLatihan[] | undefined): number {
  if (!blok) return 0
  return blok.reduce((t, b) => t + (b.menit > 0 ? b.menit : 0), 0)
}

/**
 * Turunkan waktu absolut tiap blok dengan menjumlahkan durasinya dari jam
 * mulai sesi.
 *
 * `mulai` boleh `null` — entah jam mulainya tidak terbaca, atau sesinya
 * memang tidak berjam. Blok-bloknya tetap disusun, hanya tanpa waktu.
 * Ini sengaja: rencana tanpa jam masih berguna sebagai daftar urutan.
 */
export function susunRencana(mulai: number | null, blok: BlokLatihan[] | undefined): BarisRencana[] {
  if (!blok || blok.length === 0) return []
  let m = mulai
  return blok.map((b, urutan) => {
    const menit = b.menit > 0 ? b.menit : 0
    const awal = m
    const akhir = m == null ? null : m + menit
    if (m != null) m += menit
    return {
      id: b.id,
      judul: b.judul,
      jenis: b.jenis,
      menit,
      catatan: b.catatan,
      prioritas: prioritasBlok(b),
      mulai: awal,
      selesai: akhir,
      urutan,
    }
  })
}

/**
 * Berapa menit rencana **melebihi** slot sesinya.
 *
 * `null` = tidak bisa dinilai (slotnya tidak terbaca), jadi jangan
 * diklaim "muat". Angka > 0 = kelebihannya; ≤ 0 = muat.
 */
export function lebihRencana(lamaSlot: number | null, blok: BlokLatihan[] | undefined): number | null {
  if (lamaSlot == null) return null
  return totalRencana(blok) - lamaSlot
}

export type FaseLatihan = 'belumMulai' | 'berjalan' | 'rampung'

/**
 * Keadaan satu blok di Pacu.
 *
 * - `belum` — belum dikerjakan dan masih di depan; ikut dihitung ke proyeksi.
 * - `takTercatat` — tidak punya catatan padahal blok sesudahnya sudah
 *   dimulai. Dianggap sudah lewat, **tidak** menahan hitungan (dulu satu
 *   blok tanpa catatan membuat selisih berhenti dihitung).
 */
export type StatusBlok = 'belum' | 'berjalan' | 'selesai' | 'dilewati' | 'dibawa' | 'takTercatat'

/** Satu baris Pacu: rencana + kenyataan + perkiraan. Semua jam dalam menit sejak tengah malam hari sesi. */
export interface BarisPacu extends BarisRencana {
  status: StatusBlok
  nyataMulai: number | null
  nyataSelesai: number | null
  /** Durasi nyata blok selesai, atau yang sudah berjalan. */
  nyataMenit: number | null
  /** Perkiraan jam mulai & selesai untuk blok `belum` dan `berjalan`. */
  kiraMulai: number | null
  kiraSelesai: number | null
  /** Sesi tujuan bila blok dibawa ke sesi lain. */
  dibawaKe?: string
}

export interface PosisiLatihan {
  /** Menit sejak tengah malam, sesuai jam yang diberikan. */
  menit: number
  fase: FaseLatihan
  /**
   * Blok yang sedang berjalan. Bila belum ada catatan sama sekali: blok yang
   * menurut rencana seharusnya sedang berlangsung. `null` saat jeda
   * antarblok atau di luar rentang rencana.
   */
  blok: BarisRencana | null
  /**
   * Menit tersisa pada blok yang berjalan. **Boleh negatif** — negatif
   * berarti blok ini sudah lewat dari jatahnya dan belum dituntaskan.
   */
  sisaBlok: number | null
  /** Blok yang sudah lewat (selesai, dilewati, dibawa, tak tercatat). */
  sudahLewat: BarisRencana[]
  /** Blok yang belum dikerjakan. */
  tersisa: BarisRencana[]
  /**
   * **Inti modul ini.** Selisih proyeksi selesai terhadap jam selesai acuan,
   * dalam menit: positif = terlambat, negatif = lebih cepat.
   */
  geser: number
  /** Total menit rencana yang sekarang. */
  totalRencana: number
  /** Perkiraan jam selesai blok terakhir. `null` kalau rencananya tidak berjam. */
  proyeksiSelesai: number | null
  /** Berapa blok yang sudah punya catatan (termasuk yang dilewati). */
  tercatat: number

  /* --------------------------- v2.11 --------------------------- */
  /** Seluruh blok dengan keadaan, jam nyata, dan perkiraannya. */
  baris: BarisPacu[]
  berjalan: BarisPacu | null
  /** Blok berikutnya yang belum dikerjakan. */
  berikut: BarisPacu | null
  /** Menit sejak blok terakhir selesai, saat tidak ada blok berjalan. */
  jeda: number | null
  /** Blok yang menurut rencana sekarang seharusnya berlangsung. */
  seharusnya: BarisRencana | null
  /** Jam selesai acuan (rencana awal). */
  target: number | null
  /** Jam mulai acuan. */
  mulaiAcuan: number | null
  /** Blok pertama mulai berapa menit dari jam rencana. `null` = belum mulai. */
  telatMulai: number | null
  /** Jumlah jeda di antara blok yang sudah tercatat, dalam menit. */
  totalJeda: number
}

/**
 * Rapikan catatan realisasi sebelum dihitung:
 *
 * - satu catatan per blok (yang terakhir menang);
 * - blok yang dilewati selalu punya `selesai`;
 * - **paling banyak satu blok berjalan.** Data lama bisa berisi dua blok
 *   berjalan sekaligus (dulu tombol Mulai tidak menutup blok sebelumnya);
 *   yang lebih awal dianggap selesai saat blok berikutnya dimulai.
 */
export function rapikanRealisasi(realisasi: readonly RealisasiBlok[] | undefined): RealisasiBlok[] {
  const peta = new Map<string, RealisasiBlok>()
  for (const r of realisasi ?? []) {
    if (!r || !r.id || !Number.isFinite(r.mulai)) continue
    const salin: RealisasiBlok = { ...r }
    if (salin.dibawaKe) salin.dilewati = true
    if (salin.dilewati && salin.selesai == null) salin.selesai = salin.mulai
    if (salin.selesai != null && salin.selesai < salin.mulai) salin.selesai = salin.mulai
    peta.delete(r.id)
    peta.set(r.id, salin)
  }
  const hasil = [...peta.values()]
  const jalan = hasil.filter((r) => r.selesai == null).sort((a, b) => a.mulai - b.mulai)
  for (let i = 0; i < jalan.length - 1; i++) {
    const r = jalan[i]
    const sesudah = hasil
      .filter((x) => x !== r && !x.dilewati && x.mulai > r.mulai)
      .reduce((min, x) => Math.min(min, x.mulai), jalan[jalan.length - 1].mulai)
    r.selesai = Math.max(r.mulai, sesudah)
  }
  return hasil
}

/**
 * Posisi latihan saat ini — v2.11, **berpatokan pada jam nyata**.
 *
 * Pertanyaan yang dijawab: *kalau sisa blok dikerjakan sesuai menitnya mulai
 * sekarang, jam berapa latihan selesai, dan berapa selisihnya dari rencana
 * awal?* Karena dihitung dari jam dinding, semua yang dulu luput ikut
 * terhitung dengan sendirinya:
 *
 * - **apel yang mulai terlambat** — blok pertama mulai 17.40 padahal rencana
 *   17.30 berarti sisa latihan bergeser 10 menit;
 * - **jeda di antara blok** — blok selesai 18.10, berikutnya baru mulai
 *   18.15: lima menit itu hilang dan ikut dihitung;
 * - **blok yang dilewati** tidak menghentikan hitungan; menitnya justru
 *   menjadi waktu yang didapat kembali;
 * - blok yang berjalan hanya menyumbang **kelebihannya yang sudah terjadi** —
 *   baru 5 menit dari blok 20 menit tidak dibaca \"lebih cepat 15 menit\".
 *
 * Sebelum jam mulai rencana dan tanpa catatan apa pun, selisihnya 0: belum
 * ada yang bisa diketahui. Sesi yang sudah lewat tanpa pernah dicatat juga
 * dinilai 0, bukan terlambat berjam-jam.
 *
 * Acuan selisih adalah **rencana awal** (`mulaiAcuan` + `totalAcuan`), bukan
 * rencana yang sedang dipakai. Dengan begitu mengurangi menit atau melewati
 * blok benar-benar terlihat sebagai waktu yang dikejar, dan menambah blok
 * darurat terlihat sebagai tambahan.
 */
export function posisiLatihan(bahan: {
  rencana: BarisRencana[]
  realisasi: readonly RealisasiBlok[]
  /** Menit sejak tengah malam (hari sesi), jam saat ini. */
  menit: number
  /** Epoch ms saat ini. */
  kini: number
  /** Epoch ms pukul 00.00 hari sesi. Bawaan: diturunkan dari `kini` & `menit`. */
  nol?: number
  /** Jam mulai acuan (rencana awal). Bawaan: jam blok pertama rencana. */
  mulaiAcuan?: number | null
  /** Total menit rencana awal. Bawaan: total rencana sekarang. */
  totalAcuan?: number
  /** Epoch ms sesi ditandai selesai, bila ada. */
  selesaiSesi?: number | null
}): PosisiLatihan {
  const { rencana, menit, kini } = bahan
  const nol = bahan.nol ?? kini - menit * 60000
  const keMenit = (e: number) => (e - nol) / 60000
  const sekarang = keMenit(kini)
  const realisasi = rapikanRealisasi(bahan.realisasi)
  const peta = new Map(realisasi.map((r) => [r.id, r]))
  const total = rencana.reduce((t, b) => t + b.menit, 0)

  // --- Keadaan tiap blok.
  let terakhirNyata = -1
  rencana.forEach((b, i) => {
    const r = peta.get(b.id)
    if (r && !r.dilewati) terakhirNyata = i
  })
  const baris: BarisPacu[] = rencana.map((b, i) => {
    const r = peta.get(b.id)
    let status: StatusBlok
    if (!r) status = i < terakhirNyata ? 'takTercatat' : 'belum'
    else if (r.dibawaKe) status = 'dibawa'
    else if (r.dilewati) status = 'dilewati'
    else status = r.selesai == null ? 'berjalan' : 'selesai'
    const nyata = r && !r.dilewati
    const nyataMulai = nyata ? keMenit(r.mulai) : null
    const nyataSelesai = nyata && r.selesai != null ? keMenit(r.selesai) : null
    return {
      ...b,
      status,
      nyataMulai,
      nyataSelesai,
      nyataMenit: nyataMulai == null ? null : (nyataSelesai ?? sekarang) - nyataMulai,
      kiraMulai: null,
      kiraSelesai: null,
      ...(r?.dibawaKe ? { dibawaKe: r.dibawaKe } : {}),
    }
  })

  const nyataSemua = baris.filter((b) => b.nyataMulai != null)
  const idRencana = new Set(rencana.map((b) => b.id))
  const adaCatatan = realisasi.some((r) => idRencana.has(r.id))
  const berjalan = baris.find((b) => b.status === 'berjalan') ?? null
  const mulaiPertama = nyataSemua.length ? Math.min(...nyataSemua.map((b) => b.nyataMulai!)) : null
  const selesaiTerakhir = nyataSemua.some((b) => b.nyataSelesai != null)
    ? Math.max(...nyataSemua.filter((b) => b.nyataSelesai != null).map((b) => b.nyataSelesai!))
    : null

  // --- Acuan.
  const mulaiRencana = rencana.length ? rencana[0].mulai : null
  const acuanTetap = bahan.mulaiAcuan !== undefined ? bahan.mulaiAcuan : mulaiRencana
  const mulaiAcuan = acuanTetap ?? mulaiPertama
  const totalAcuan = bahan.totalAcuan ?? total
  const target = mulaiAcuan == null ? null : mulaiAcuan + totalAcuan
  const ujungRencanaKini = mulaiRencana == null ? null : mulaiRencana + total

  // --- Blok yang menurut rencana seharusnya sedang berlangsung.
  const seharusnya =
    rencana.find((b) => b.mulai != null && b.selesai != null && b.mulai <= menit && menit < b.selesai) ?? null

  // --- Proyeksi: sisa blok disusun mulai dari jam nyata.
  const sesiDitutup = bahan.selesaiSesi != null
  let kursor: number | null
  if (berjalan) {
    kursor = Math.max(sekarang, berjalan.nyataMulai! + berjalan.menit)
    berjalan.kiraMulai = berjalan.nyataMulai
    berjalan.kiraSelesai = kursor
  } else if (adaCatatan) {
    const basi = target != null && sekarang > target + 360
    const dasar = Math.max(selesaiTerakhir ?? -Infinity, mulaiAcuan ?? -Infinity)
    kursor = basi || sesiDitutup ? (Number.isFinite(dasar) ? dasar : null) : Math.max(sekarang, dasar)
  } else if (mulaiAcuan == null) {
    kursor = null
  } else {
    // Belum ada catatan. Sesi yang rencananya sudah habis dianggap tidak
    // dicatat, bukan terlambat; di dalam rentangnya, jam dinding berlaku.
    const sudahHabis = ujungRencanaKini != null && menit >= ujungRencanaKini
    kursor = sudahHabis || sesiDitutup ? mulaiAcuan : Math.max(sekarang, mulaiAcuan)
  }
  const belum = baris.filter((b) => b.status === 'belum')
  if (kursor != null) {
    for (const b of belum) {
      b.kiraMulai = kursor
      kursor += b.menit
      b.kiraSelesai = kursor
    }
  }
  const adaSisa = belum.length > 0 || berjalan != null
  const proyeksiSelesai = !adaSisa && selesaiTerakhir != null ? selesaiTerakhir : kursor
  const geser = proyeksiSelesai != null && target != null ? proyeksiSelesai - target : 0

  // --- Jeda.
  const urutNyata = [...nyataSemua].sort((a, b) => a.nyataMulai! - b.nyataMulai!)
  let totalJeda = 0
  for (let i = 1; i < urutNyata.length; i++) {
    const s = urutNyata[i - 1].nyataSelesai
    if (s != null) totalJeda += Math.max(0, urutNyata[i].nyataMulai! - s)
  }
  const jeda =
    !berjalan && adaCatatan && belum.length > 0 && selesaiTerakhir != null && !sesiDitutup
      ? Math.max(0, sekarang - selesaiTerakhir)
      : null

  // --- Blok yang ditampilkan & sisa waktunya.
  let blok: BarisRencana | null = null
  let sisaBlok: number | null = null
  if (berjalan) {
    blok = berjalan
    sisaBlok = berjalan.menit - (sekarang - berjalan.nyataMulai!)
  } else if (!adaCatatan && seharusnya) {
    blok = seharusnya
    sisaBlok = seharusnya.selesai! - menit
  }

  let sudahLewat: BarisRencana[]
  let tersisa: BarisRencana[]
  if (adaCatatan) {
    sudahLewat = baris.filter((b) => b.status !== 'belum' && b.status !== 'berjalan')
    tersisa = belum
  } else {
    const idx = blok ? blok.urutan : -1
    sudahLewat = idx >= 0 ? baris.slice(0, idx) : []
    tersisa = idx >= 0 ? baris.slice(idx + 1) : baris
  }

  let fase: FaseLatihan
  if (berjalan) fase = 'berjalan'
  else if (adaCatatan) fase = belum.length > 0 && !sesiDitutup ? 'berjalan' : 'rampung'
  else if (blok) fase = 'berjalan'
  else if (rencana.length === 0) fase = 'rampung'
  else {
    const berwaktu = rencana.filter((b) => b.mulai != null && b.selesai != null)
    const adaYangBelum = berwaktu.some((b) => b.selesai! > menit)
    fase = adaYangBelum || berwaktu.length === 0 ? 'belumMulai' : 'rampung'
  }

  return {
    menit,
    fase,
    blok,
    sisaBlok,
    sudahLewat,
    tersisa,
    geser,
    totalRencana: total,
    proyeksiSelesai,
    tercatat: realisasi.filter((r) => idRencana.has(r.id)).length,
    baris,
    berjalan,
    berikut: belum[0] ?? null,
    jeda,
    seharusnya,
    target,
    mulaiAcuan,
    telatMulai: mulaiPertama != null && acuanTetap != null ? mulaiPertama - acuanTetap : null,
    totalJeda,
  }
}

/** "25 mnt" / "1 jam 10 mnt" — ringkas untuk dibaca sekilas. */
export function formatMenit(m: number): string {
  const t = Math.max(0, Math.round(m))
  if (t < 60) return `${t} mnt`
  const j = Math.floor(t / 60)
  const s = t % 60
  return s ? `${j} jam ${s} mnt` : `${j} jam`
}

/**
 * Tanda geser untuk ditampilkan: "tepat", "lebih 7 mnt", "kurang 3 mnt".
 *
 * Ambang 1 menit dipakai supaya selisih receh karena detik tidak
 * mengganggu tampilan — latihan yang melenceng 20 detik tidak perlu
 * diberi warna merah.
 */
export function formatGeser(geser: number): string {
  const g = Math.round(geser)
  if (Math.abs(g) < 1) return 'tepat waktu'
  return g > 0 ? `terlambat ${formatMenit(g)}` : `lebih cepat ${formatMenit(-g)}`
}

/* ------------------- #31 — Pencatat pengulangan blok (Rep Counter) ------------------- */

/** Batas baris log per sesi — pengaman supaya satu sesi tidak membengkak. */
export const MAKS_BARIS_LOG_REP = 200

/** "Set 12–16" — label rentang set yang sama di presenter, Pacu, dan ringkasan. */
export function labelRentangSet(dari: number, sampai: number): string {
  return dari === sampai ? `Set ${dari}` : `Set ${dari}–${sampai}`
}

/**
 * Tambah satu pengulangan rentang set ke log sesi (murni, mengembalikan
 * salinan baru). Rentang dirapikan: bilangan bulat ≥ 1, dibalik bila
 * terbalik. Rentang satu set (tanpa perpindahan) diabaikan.
 */
export function tambahLogRep(
  log: readonly LogRepSet[] | undefined,
  e: { drillId: string; namaDrill?: string; dari: number; sampai: number },
  waktu: number,
): LogRepSet[] {
  const daftar = [...(log ?? [])]
  if (!e.drillId || !Number.isFinite(e.dari) || !Number.isFinite(e.sampai)) return daftar
  let a = Math.max(1, Math.floor(e.dari))
  let b = Math.max(1, Math.floor(e.sampai))
  if (a > b) [a, b] = [b, a]
  if (a === b) return daftar
  const i = daftar.findIndex((r) => r.drillId === e.drillId && r.dari === a && r.sampai === b)
  if (i >= 0) {
    const lama = daftar[i]
    daftar[i] = { ...lama, kali: Math.max(0, lama.kali) + 1, terakhir: waktu, namaDrill: e.namaDrill ?? lama.namaDrill }
    return daftar
  }
  if (daftar.length >= MAKS_BARIS_LOG_REP) return daftar
  daftar.push({ drillId: e.drillId, ...(e.namaDrill ? { namaDrill: e.namaDrill } : {}), dari: a, sampai: b, kali: 1, terakhir: waktu })
  return daftar
}

export interface BarisRingkasRep extends LogRepSet {
  label: string
}

/**
 * Ringkasan log pengulangan untuk ringkasan sesi: diurutkan per drill lalu
 * nomor set awal; baris rusak (kali ≤ 0, rentang tak sah) dibuang.
 */
export function ringkasLogRep(log: readonly LogRepSet[] | undefined): { baris: BarisRingkasRep[]; total: number } {
  const baris = (log ?? [])
    .filter((r) => r && r.drillId && r.kali > 0 && r.dari >= 1 && r.sampai > r.dari)
    .map((r) => ({ ...r, label: labelRentangSet(r.dari, r.sampai) }))
    .sort(
      (x, y) =>
        (x.namaDrill ?? x.drillId).localeCompare(y.namaDrill ?? y.drillId, 'id') ||
        x.drillId.localeCompare(y.drillId) ||
        x.dari - y.dari ||
        x.sampai - y.sampai,
    )
  return { baris, total: baris.reduce((t, r) => t + r.kali, 0) }
}

/** "YYYY-MM-DD" menurut jam lokal perangkat. */
export function tanggalLokal(kini: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${kini.getFullYear()}-${p(kini.getMonth() + 1)}-${p(kini.getDate())}`
}

const JENIS_SESI_LATIHAN = new Set(['latihan', 'section', 'gabungan'])

/**
 * Sesi tempat Rep Counter menyimpan hitungannya: sesi **hari ini**.
 * Urutan pilihan: yang sedang berjalan (ditandai mulai, belum selesai) →
 * yang jamnya sedang berlangsung → sesi jenis latihan pertama → sesi apa
 * pun hari ini. `null` bila hari ini tidak ada sesi sama sekali.
 */
export function pilihSesiLatihan(sesi: readonly Session[] | undefined, kini: Date): Session | null {
  const hariIni = tanggalLokal(kini)
  const kandidat = (sesi ?? []).filter((s) => s.date === hariIni)
  if (kandidat.length === 0) return null
  const urut = [...kandidat].sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''))
  const berjalan = urut.find((s) => s.mulaiNyata != null && s.selesaiNyata == null)
  if (berjalan) return berjalan
  const menit = kini.getHours() * 60 + kini.getMinutes()
  const keMenit = (j: string) => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(j || '')
    return m ? Number(m[1]) * 60 + Number(m[2]) : null
  }
  const sedang = urut.find((s) => {
    const a = keMenit(s.startTime)
    const b = keMenit(s.endTime)
    return a != null && b != null && a <= menit && menit <= b
  })
  if (sedang) return sedang
  return urut.find((s) => JENIS_SESI_LATIHAN.has(s.type)) ?? urut[0]
}
