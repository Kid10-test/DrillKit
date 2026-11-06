/**
 * #29 — Studio Intonasi: logika murni (tanpa React/WebAudio) untuk
 *
 * 1. **Grafik kestabilan nada bergulir** — jejak sen 5–10 detik terakhir,
 *    tiga jenjang toleransi, penghitung detik tahan stabil, dan diagnosis
 *    tiupan panjang: *scoop* (serangan awal naik dari bawah), goyangan
 *    napas, dan ekor nada yang turun di akhir tiupan.
 * 2. **Peta kecenderungan nada per alat** — rekam tangga nada inti, hitung
 *    simpangan sen tiap nada (median, buang serangan awal), simpan per
 *    perangkat/pemain, dan susun saran singkat untuk kartu saku.
 *
 * Semua dibuat ulang dari prinsip akustik dasar (clean-room) — tidak ada
 * kode atau data dari aplikasi penala komersial.
 */

import { cariTransposisi, namaMidi } from './tuner'

/* ============================================================================
 * 1. Jenjang toleransi
 * ========================================================================== */

export type IdToleransi = 'pemula' | 'menengah' | 'mahir'

export interface JenjangToleransi {
  id: IdToleransi
  label: string
  /** batas ± sen yang dianggap "tepat" */
  sen: number
  keterangan: string
}

export const JENJANG_TOLERANSI: JenjangToleransi[] = [
  { id: 'pemula', label: 'Pemula', sen: 15, keterangan: 'anggota baru & pemanasan awal' },
  { id: 'menengah', label: 'Menengah', sen: 8, keterangan: 'latihan rutin seksi' },
  { id: 'mahir', label: 'Mahir/DCI', sen: 3, keterangan: 'standar kejuaraan' },
]

/** Cari jenjang menurut id; id tak dikenal → Menengah (bawaan). */
export function cariToleransi(id: string | undefined | null): JenjangToleransi {
  return JENJANG_TOLERANSI.find((j) => j.id === id) ?? JENJANG_TOLERANSI[1]
}

/**
 * Warna jarum/titik untuk selisih `sen` pada jenjang tertentu (#hex):
 * hijau = dalam toleransi, kuning = sampai 2× toleransi, merah = lebih.
 */
export function warnaSen(sen: number | null | undefined, tol: number): string {
  if (sen === null || sen === undefined || !Number.isFinite(sen)) return '#64748b'
  const a = Math.abs(sen)
  if (a <= tol) return '#10b981'
  if (a <= tol * 2) return '#f59e0b'
  return '#f43f5e'
}

/* ============================================================================
 * 2. Jejak nada bergulir
 * ========================================================================== */

/** Satu cuplikan jejak. `sen === null` = hening (tidak ada nada terbaca). */
export interface TitikJejak {
  /** waktu (ms, jam bebas — mis. `performance.now()`) */
  t: number
  sen: number | null
  /** nomor MIDI konser nada terdekat (untuk memisah nada berbeda) */
  midi?: number
}

/** Lebar jendela grafik bawaan (ms). */
export const JENDELA_JEJAK_MS = 8000
/** Jeda lebih lama dari ini memutus satu nada menjadi dua. */
const JEDA_PUTUS_MS = 220
/** Bagian awal & akhir nada yang dinilai sebagai serangan / ekor (ms). */
const PANJANG_SERANGAN_MS = 280
const PANJANG_EKOR_MS = 320

/** Tambahkan cuplikan & buang yang lebih tua dari jendela (ms). Mengembalikan larik baru. */
export function tambahJejak(jejak: TitikJejak[], titik: TitikJejak, jendelaMs = JENDELA_JEJAK_MS): TitikJejak[] {
  const batas = titik.t - Math.max(1000, jendelaMs)
  const awal = jejak.findIndex((p) => p.t >= batas)
  const sisa = awal < 0 ? [] : jejak.slice(awal)
  sisa.push(titik)
  return sisa
}

/** Satu nada utuh di dalam jejak: cuplikan berurutan, nada sama, tanpa jeda panjang. */
export interface SegmenNada {
  midi: number
  dari: number
  sampai: number
  titik: { t: number; sen: number }[]
}

/** Pecah jejak menjadi nada-nada utuh (hening/ganti nada/jeda panjang = putus). */
export function segmenNada(jejak: TitikJejak[]): SegmenNada[] {
  const keluar: SegmenNada[] = []
  let kini: SegmenNada | null = null
  for (const p of jejak) {
    if (p.sen === null || !Number.isFinite(p.sen)) {
      kini = null
      continue
    }
    const midi = p.midi ?? 0
    if (!kini || kini.midi !== midi || p.t - kini.sampai > JEDA_PUTUS_MS) {
      kini = { midi, dari: p.t, sampai: p.t, titik: [] }
      keluar.push(kini)
    }
    kini.titik.push({ t: p.t, sen: p.sen })
    kini.sampai = p.t
  }
  return keluar
}

const rata = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
const simpang = (xs: number[]) => {
  if (xs.length < 2) return 0
  const m = rata(xs)
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) * (b - m), 0) / xs.length)
}
const satuDesimal = (n: number) => Math.round(n * 10) / 10

/** Durasi tahan stabil (ms) yang berakhir di cuplikan terakhir sebuah segmen. */
function tahanDiUjung(seg: SegmenNada, tol: number): number {
  let i = seg.titik.length - 1
  if (i < 0 || Math.abs(seg.titik[i].sen) > tol) return 0
  while (i > 0 && Math.abs(seg.titik[i - 1].sen) <= tol) i--
  return seg.titik[seg.titik.length - 1].t - seg.titik[i].t
}

/** Rentang tahan stabil terpanjang (ms) di dalam satu segmen. */
function tahanTerpanjang(seg: SegmenNada, tol: number): number {
  let terbaik = 0
  let mulai = -1
  for (let i = 0; i < seg.titik.length; i++) {
    if (Math.abs(seg.titik[i].sen) <= tol) {
      if (mulai < 0) mulai = i
      terbaik = Math.max(terbaik, seg.titik[i].t - seg.titik[mulai].t)
    } else {
      mulai = -1
    }
  }
  return terbaik
}

export interface AnalisisJejak {
  /** detik tahan stabil yang sedang berjalan (0 bila sedang hening / di luar toleransi) */
  tahanKini: number
  /** detik tahan stabil terpanjang di dalam jendela */
  tahanTerbaik: number
  /** persentase cuplikan bernada yang masuk toleransi (0–100) */
  persenDalam: number
  /** rata-rata sen badan nada (tanpa serangan & ekor) nada terakhir */
  rataSen: number | null
  /** simpangan baku badan nada terakhir (goyangan), sen */
  goyang: number | null
  /** serangan awal nada terakhir dibanding badannya (negatif = *scoop* dari bawah) */
  serangan: number | null
  /** ekor nada terakhir dibanding badannya (negatif = nada turun di akhir) */
  ekor: number | null
  /** catatan siap tampil, mis. "Serangan awal naik dari bawah (scoop) −18 sen" */
  catatan: string[]
}

/**
 * Nilai jejak terhadap toleransi `tol` (sen). Diagnosis memakai **tiupan
 * panjang terakhir yang sudah selesai** (≥ 0,9 dtk; bila belum ada, tiupan
 * yang sedang berbunyi) — tiupan pendek tidak punya badan yang jujur untuk
 * dibandingkan dengan serangan & ekornya.
 */
export function analisisJejak(jejak: TitikJejak[], tol: number): AnalisisJejak {
  const seg = segmenNada(jejak)
  const semua = seg.flatMap((s) => s.titik.map((p) => p.sen))
  const persenDalam = semua.length ? Math.round((semua.filter((v) => Math.abs(v) <= tol).length / semua.length) * 100) : 0
  const terakhirJejak = jejak[jejak.length - 1]
  const segAkhir = seg[seg.length - 1]
  const masihBerbunyi = !!terakhirJejak && terakhirJejak.sen !== null && !!segAkhir && segAkhir.sampai === terakhirJejak.t
  const tahanKini = masihBerbunyi ? tahanDiUjung(segAkhir, tol) / 1000 : 0
  const tahanTerbaik = seg.reduce((m, s) => Math.max(m, tahanTerpanjang(s, tol)), 0) / 1000

  const hasil: AnalisisJejak = {
    tahanKini: satuDesimal(tahanKini),
    tahanTerbaik: satuDesimal(tahanTerbaik),
    persenDalam,
    rataSen: null,
    goyang: null,
    serangan: null,
    ekor: null,
    catatan: [],
  }

  // Utamakan tiupan panjang terakhir yang SUDAH selesai (serangan, badan, &
  // ekornya lengkap) — catatannya tidak hilang begitu nada berikutnya
  // dimulai. Belum ada yang selesai → nilai tiupan yang sedang berbunyi.
  const layak = (s: SegmenNada) => s.sampai - s.dari >= 900 && s.titik.length >= 8
  const kandidat = [...seg].reverse()
  const panjang =
    kandidat.find((s) => layak(s) && !(s === segAkhir && masihBerbunyi)) ?? kandidat.find(layak)
  if (!panjang) return hasil
  const awalBadan = panjang.dari + PANJANG_SERANGAN_MS
  // Ekor hanya dinilai bila nada sudah selesai (hening/ganti nada sesudahnya).
  const selesai = panjang !== segAkhir || !masihBerbunyi
  const akhirBadan = selesai ? panjang.sampai - PANJANG_EKOR_MS : panjang.sampai
  const badan = panjang.titik.filter((p) => p.t >= awalBadan && p.t <= akhirBadan).map((p) => p.sen)
  if (badan.length < 4) return hasil
  const mBadan = rata(badan)
  hasil.rataSen = Math.round(mBadan)
  hasil.goyang = satuDesimal(simpang(badan))
  const serang = panjang.titik.filter((p) => p.t < awalBadan).map((p) => p.sen)
  if (serang.length >= 2) hasil.serangan = Math.round(rata(serang) - mBadan)
  if (selesai) {
    const ekorTitik = panjang.titik.filter((p) => p.t > akhirBadan).map((p) => p.sen)
    if (ekorTitik.length >= 2) hasil.ekor = Math.round(rata(ekorTitik) - mBadan)
  }

  const ambang = Math.max(6, tol)
  const tanda = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0')
  if (hasil.serangan !== null && hasil.serangan <= -ambang)
    hasil.catatan.push(`Serangan awal naik dari bawah (scoop) ${tanda(hasil.serangan)} sen — siapkan bibir & udara sebelum bunyi.`)
  else if (hasil.serangan !== null && hasil.serangan >= ambang)
    hasil.catatan.push(`Serangan awal terlalu tinggi ${tanda(hasil.serangan)} sen lalu turun — kurangi tekanan saat mulai.`)
  if (hasil.goyang !== null && hasil.goyang > Math.max(3, tol * 0.6))
    hasil.catatan.push(`Goyangan napas ±${hasil.goyang} sen — jaga aliran udara tetap rata.`)
  if (hasil.ekor !== null && hasil.ekor <= -ambang)
    hasil.catatan.push(`Ekor nada turun ${tanda(hasil.ekor)} sen di akhir tiupan — dukung napas sampai nada benar-benar selesai.`)
  else if (hasil.ekor !== null && hasil.ekor >= ambang)
    hasil.catatan.push(`Ekor nada naik ${tanda(hasil.ekor)} sen — jangan menjepit bibir saat melepas nada.`)
  if (!hasil.catatan.length && Math.abs(mBadan) <= tol)
    hasil.catatan.push('Tiupan panjang stabil — pertahankan!')
  else if (!hasil.catatan.length)
    hasil.catatan.push(`Badan nada rata-rata ${tanda(hasil.rataSen)} sen — ${mBadan > 0 ? 'turunkan' : 'naikkan'} sedikit.`)
  return hasil
}

/**
 * Proyeksi jejak ke koordinat grafik (lebar `w`, tinggi `h`, sumbu sen
 * ±`skala`). Titik hening memutus garis (`null`). Murni — dipakai kanvas
 * & uji.
 */
export function proyeksiJejak(
  jejak: TitikJejak[],
  sekarang: number,
  w: number,
  h: number,
  skala = 50,
  jendelaMs = JENDELA_JEJAK_MS,
): ({ x: number; y: number; sen: number } | null)[] {
  const keluar: ({ x: number; y: number; sen: number } | null)[] = []
  let sebelum: TitikJejak | null = null
  for (const p of jejak) {
    const umur = sekarang - p.t
    if (umur > jendelaMs) continue
    if (p.sen === null || (sebelum && p.t - sebelum.t > JEDA_PUTUS_MS) || (sebelum && sebelum.midi !== p.midi)) {
      if (keluar.length && keluar[keluar.length - 1] !== null) keluar.push(null)
    }
    if (p.sen !== null) {
      const sen = Math.max(-skala, Math.min(skala, p.sen))
      keluar.push({
        x: Math.round((1 - umur / jendelaMs) * w * 10) / 10,
        y: Math.round((h / 2 - (sen / skala) * (h / 2)) * 10) / 10,
        sen: p.sen,
      })
    }
    sebelum = p
  }
  return keluar
}

/* ============================================================================
 * 3. Peta kecenderungan nada per alat
 * ========================================================================== */

export type IdTanggaPeta = 'bb-mayor' | 'bb-mayor-2' | 'f-mayor' | 'kromatik'

export interface TanggaPeta {
  id: IdTanggaPeta
  label: string
  /** semitone dari nada dasar konser */
  langkah: number[]
  /** nada dasar konser (indeks 0–11 dari C) */
  dasar: number
}

export const DAFTAR_TANGGA_PETA: TanggaPeta[] = [
  { id: 'bb-mayor', label: 'Bb konser mayor · 1 oktaf (8 nada)', dasar: 10, langkah: [0, 2, 4, 5, 7, 9, 11, 12] },
  {
    id: 'bb-mayor-2',
    label: 'Bb konser mayor · 2 oktaf (15 nada)',
    dasar: 10,
    langkah: [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19, 21, 23, 24],
  },
  { id: 'f-mayor', label: 'F konser mayor · 1 oktaf (8 nada)', dasar: 5, langkah: [0, 2, 4, 5, 7, 9, 11, 12] },
  { id: 'kromatik', label: 'Kromatik · 1 oktaf (13 nada)', dasar: 10, langkah: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
]

export function cariTanggaPeta(id: string | undefined): TanggaPeta {
  return DAFTAR_TANGGA_PETA.find((t) => t.id === id) ?? DAFTAR_TANGGA_PETA[0]
}

/** Wilayah alat: oktaf konser nada dasar tangga nada (Bb1 … Bb4). */
export const WILAYAH_PETA: { id: string; label: string; oktaf: number }[] = [
  { id: 'tuba', label: 'Bb1 — tuba / sousaphone', oktaf: 1 },
  { id: 'rendah', label: 'Bb2 — trombone, baritone/euphonium, sax tenor', oktaf: 2 },
  { id: 'tengah', label: 'Bb3 — trumpet, mellophone, sax alto, klarinet', oktaf: 3 },
  { id: 'tinggi', label: 'Bb4 — flute / piccolo', oktaf: 4 },
]

/** Wilayah yang paling mungkin untuk sebuah transposisi (bisa diganti pemain). */
export function wilayahBawaan(transposisiId: string): string {
  const id = cariTransposisi(transposisiId).id
  return id === 'bb8' || id === 'eb8' || id === 'c' ? 'rendah' : 'tengah'
}

export function cariWilayah(id: string | undefined): { id: string; label: string; oktaf: number } {
  return WILAYAH_PETA.find((w) => w.id === id) ?? WILAYAH_PETA[2]
}

/**
 * Daftar nada sasaran (MIDI **konser**) untuk satu tangga & oktaf dasar
 * (oktaf nada dasar konser, mis. 3 = Bb3 = C4 tertulis trumpet).
 */
export function nadaSasaranPeta(tanggaId: string, oktafDasar: number): number[] {
  const t = cariTanggaPeta(tanggaId)
  const akar = 12 * (Math.max(1, Math.min(5, Math.floor(oktafDasar))) + 1) + t.dasar
  return t.langkah.map((l) => akar + l)
}

/** Label nada untuk pemain: tertulis (sesuai transposisi) + konser. */
export function labelNadaPeta(midiKonser: number, transposisiId: string): { tertulis: string; konser: string } {
  const tr = cariTransposisi(transposisiId)
  const singkat = (m: number) => {
    const n = namaMidi(m)
    return n.label.includes(' / ') ? n.label.split(' / ')[1] : n.label
  }
  return { tertulis: singkat(midiKonser + tr.geser), konser: singkat(midiKonser) }
}

/** Satu cuplikan saat merekam satu nada sasaran. */
export interface SampelPeta {
  t: number
  sen: number
}

/** Syarat sebuah nada dianggap cukup terekam. */
export const SYARAT_SAMPEL = { buangAwalMs: 350, minimalMs: 1500, minimalCuplikan: 14 }

export interface RingkasSampel {
  /** median sen (bulat) setelah serangan dibuang */
  sen: number
  /** jumlah cuplikan yang dipakai */
  n: number
  /** sebaran antar-kuartil (sen) — makin kecil makin stabil */
  sebaran: number
  /** sudah cukup panjang & cukup banyak cuplikan */
  cukup: boolean
}

function kuantil(urut: number[], q: number): number {
  if (!urut.length) return 0
  const pos = (urut.length - 1) * q
  const b = Math.floor(pos)
  const a = Math.min(urut.length - 1, b + 1)
  return urut[b] + (urut[a] - urut[b]) * (pos - b)
}

/**
 * Ringkas cuplikan satu nada. Serangan (350 ms pertama) dibuang, lalu
 * dipakai **median** — satu dua bacaan sesat tidak menggeser hasil seperti
 * rata-rata. `null` bila belum ada badan nada sama sekali.
 */
export function ringkasSampelNada(sampel: SampelPeta[]): RingkasSampel | null {
  if (!sampel.length) return null
  const t0 = sampel[0].t
  const badan = sampel.filter((s) => s.t - t0 >= SYARAT_SAMPEL.buangAwalMs)
  if (!badan.length) return null
  const urut = badan.map((s) => s.sen).sort((a, b) => a - b)
  const durasi = badan[badan.length - 1].t - badan[0].t
  return {
    sen: Math.round(kuantil(urut, 0.5)),
    n: urut.length,
    sebaran: Math.round(kuantil(urut, 0.75) - kuantil(urut, 0.25)),
    cukup: durasi >= SYARAT_SAMPEL.minimalMs - SYARAT_SAMPEL.buangAwalMs && urut.length >= SYARAT_SAMPEL.minimalCuplikan,
  }
}

export interface NadaPeta {
  /** MIDI konser */
  midi: number
  sen: number
  n: number
  sebaran: number
}

export interface PetaKecenderungan {
  id: string
  /** nama pemain/alat, mis. "Rani — Trumpet 2" */
  nama: string
  transposisi: string
  a4: number
  tangga: IdTanggaPeta
  dibuat: number
  nada: NadaPeta[]
}

/**
 * Saran singkat per nada. Kurang dari ±5 sen dianggap aman (di bawah ambang
 * dengar kebanyakan pemain dalam ansambel).
 */
export function saranKecenderungan(sen: number): { arah: 'aman' | 'tinggi' | 'rendah'; teks: string } {
  if (Math.abs(sen) < 5) return { arah: 'aman', teks: 'aman' }
  if (sen > 0)
    return {
      arah: 'tinggi',
      teks: sen >= 15 ? 'sangat tinggi — pakai posisi/jari alternatif atau tarik slide' : 'cenderung tinggi — rilekskan bibir, arahkan udara lebih rendah',
    }
  return {
    arah: 'rendah',
    teks: sen <= -15 ? 'sangat rendah — pakai posisi/jari alternatif atau dorong slide' : 'cenderung rendah — percepat udara, dukung dari perut',
  }
}

/** Ringkasan satu peta untuk kartu & daftar: nada paling tinggi & paling rendah. */
export function ringkasPeta(p: PetaKecenderungan): { tertinggi: NadaPeta | null; terendah: NadaPeta | null; rataAbs: number } {
  if (!p.nada.length) return { tertinggi: null, terendah: null, rataAbs: 0 }
  const tertinggi = p.nada.reduce((a, b) => (b.sen > a.sen ? b : a))
  const terendah = p.nada.reduce((a, b) => (b.sen < a.sen ? b : a))
  return {
    tertinggi: tertinggi.sen >= 5 ? tertinggi : null,
    terendah: terendah.sen <= -5 ? terendah : null,
    rataAbs: Math.round(rata(p.nada.map((n) => Math.abs(n.sen)))),
  }
}

/* ----------------------------- Penyimpanan ----------------------------- */

const KUNCI_PETA = 'drillkit.petaNada'
export const MAKS_PETA = 12

/** Rapikan satu peta dari JSON yang tidak dipercaya; `null` bila rusak. */
export function rapikanPeta(x: unknown): PetaKecenderungan | null {
  if (!x || typeof x !== 'object') return null
  const d = x as Partial<PetaKecenderungan>
  if (typeof d.id !== 'string' || !Array.isArray(d.nada)) return null
  const nada = d.nada
    .filter((n): n is NadaPeta => !!n && Number.isFinite(n.midi) && Number.isFinite(n.sen))
    .map((n) => ({
      midi: Math.round(n.midi),
      sen: Math.max(-50, Math.min(50, Math.round(n.sen))),
      n: Math.max(0, Math.round(n.n ?? 0)),
      sebaran: Math.max(0, Math.round(n.sebaran ?? 0)),
    }))
  return {
    id: d.id,
    nama: typeof d.nama === 'string' && d.nama.trim() ? d.nama.trim().slice(0, 60) : 'Tanpa nama',
    transposisi: cariTransposisi(d.transposisi).id,
    a4: typeof d.a4 === 'number' && d.a4 >= 430 && d.a4 <= 450 ? d.a4 : 440,
    tangga: cariTanggaPeta(d.tangga).id,
    dibuat: typeof d.dibuat === 'number' ? d.dibuat : 0,
    nada,
  }
}

/** Baca semua peta di perangkat ini (terbaru dulu). */
export function bacaDaftarPeta(): PetaKecenderungan[] {
  try {
    const mentah = localStorage.getItem(KUNCI_PETA)
    if (!mentah) return []
    const arr = JSON.parse(mentah)
    if (!Array.isArray(arr)) return []
    return arr
      .map(rapikanPeta)
      .filter((p): p is PetaKecenderungan => !!p)
      .sort((a, b) => b.dibuat - a.dibuat)
  } catch {
    return []
  }
}

function tulisDaftar(daftar: PetaKecenderungan[]) {
  try {
    localStorage.setItem(KUNCI_PETA, JSON.stringify(daftar.slice(0, MAKS_PETA)))
  } catch {
    /* penyimpanan penuh / mode penyamaran — peta tetap tampil sampai halaman ditutup */
  }
}

/** Simpan (atau timpa id yang sama). Paling banyak `MAKS_PETA` — yang tertua tergeser. */
export function simpanPeta(p: PetaKecenderungan): PetaKecenderungan[] {
  const daftar = [p, ...bacaDaftarPeta().filter((x) => x.id !== p.id)].sort((a, b) => b.dibuat - a.dibuat)
  tulisDaftar(daftar)
  return daftar.slice(0, MAKS_PETA)
}

export function hapusPeta(id: string): PetaKecenderungan[] {
  const daftar = bacaDaftarPeta().filter((x) => x.id !== id)
  tulisDaftar(daftar)
  return daftar
}
