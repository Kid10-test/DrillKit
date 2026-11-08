/**
 * #31 — Mode Podium *Gitapati / Field Commander* (logika murni).
 *
 * Mode Podium adalah **tata letak di dalam `DrillPresenter`**, bukan pemutar
 * tandingan: mesin animasi, klik, dan urutan latihan tetap milik presenter.
 * Modul ini hanya berisi bagian yang bisa diuji tanpa React/DOM:
 *
 * - pemilih cepat Set ↔ Huruf Latihan (*rehearsal mark*) ↔ Birama;
 * - rancangan *count-in* aba-aba ("4 ketuk Standby + 4 ketuk Mark Time")
 *   sebagai pola birama untuk `Metronom` (klik lapangan #29);
 * - teks & ukuran huruf plakat *Flash-Cue Board 40 m* (warna murni hex);
 * - setelan per perangkat (localStorage).
 */
import type { BiramaPola, TempoSegment, TingkatKlik } from '../db/types'

/* ------------------------------ Tempo latihan ------------------------------ */

/** Pilihan tempo latihan cepat di podium (#4), dalam persen tempo asli. */
export const PERSEN_PODIUM = [70, 75, 80, 85, 90, 95, 100] as const

/** Jepit persen ke rentang podium 70–100 dan bulatkan ke kelipatan 5. */
export function rapikanPersenPodium(p: number): number {
  if (!Number.isFinite(p)) return 100
  return Math.min(100, Math.max(70, Math.round(p / 5) * 5))
}

/* ------------------------------- Count-in -------------------------------- */

export const PILIHAN_STANDBY = [0, 2, 4, 8] as const
export const PILIHAN_MARK_TIME = [0, 4, 8] as const
export type ProfilPodium = 'drbeat' | 'cowbell' | 'rim'
export const PROFIL_PODIUM: ProfilPodium[] = ['drbeat', 'cowbell', 'rim']

export type TahapHitungMasuk = 'standby' | 'markTime'

export const LABEL_TAHAP: Record<TahapHitungMasuk, string> = {
  standby: 'STANDBY',
  markTime: 'MARK TIME',
}

export interface RancanganHitungMasuk {
  /** Pola birama untuk `Metronom.mulai({ pola })` — satu birama per tahap. */
  bars: BiramaPola[]
  /** Tahap tiap birama (sejajar dengan `bars`). */
  tahap: TahapHitungMasuk[]
  /** Jumlah ketukan count-in seluruhnya. */
  total: number
}

function biramaHitung(id: string, beats: number, label: string): BiramaPola {
  const cells: TingkatKlik[] = Array.from({ length: beats }, (_, i) => (i === 0 ? 2 : 1) as TingkatKlik)
  return { id, beats, subdiv: 1, cells, label }
}

/**
 * Susun count-in: birama "Standby" lalu birama "Mark Time", masing-masing
 * beraksen di ketukan pertama sehingga telinga tahu kapan tahap berganti.
 * Jumlah ketukan dijepit 0 atau 2–12 (batas birama `Metronom`).
 */
export function rancangHitungMasuk(standby: number, markTime: number): RancanganHitungMasuk {
  const jepit = (n: number) => {
    const k = Math.floor(Number.isFinite(n) ? n : 0)
    return k <= 0 ? 0 : Math.min(12, Math.max(2, k))
  }
  const s = jepit(standby)
  const m = jepit(markTime)
  const bars: BiramaPola[] = []
  const tahap: TahapHitungMasuk[] = []
  if (s > 0) {
    bars.push(biramaHitung('podium-standby', s, 'Standby'))
    tahap.push('standby')
  }
  if (m > 0) {
    bars.push(biramaHitung('podium-mark', m, 'Mark Time'))
    tahap.push('markTime')
  }
  return { bars, tahap, total: s + m }
}

export interface LangkahHitungMasuk {
  tahap: TahapHitungMasuk
  /** Ketukan ke-berapa di tahap ini (1-based). */
  ke: number
  /** Jumlah ketukan tahap ini. */
  dari: number
  /** Ketukan terakhir seluruh count-in. */
  terakhir: boolean
}

/**
 * Terjemahkan ketukan `Metronom` (birama absolut 1-based, beat 0-based)
 * menjadi langkah count-in untuk indikator hitungan besar.
 */
export function langkahHitungMasuk(r: RancanganHitungMasuk, birama: number, beat: number): LangkahHitungMasuk | null {
  const i = Math.floor(birama) - 1
  const bar = r.bars[i]
  if (!bar || beat < 0 || beat >= bar.beats) return null
  return {
    tahap: r.tahap[i],
    ke: Math.floor(beat) + 1,
    dari: bar.beats,
    terakhir: i === r.bars.length - 1 && beat === bar.beats - 1,
  }
}

/** BPM klik count-in: satu klik per count drill (sama dengan klik presenter B5). */
export function bpmHitungMasuk(tempo: number, beatsPerCount: number): number {
  const t = Number.isFinite(tempo) && tempo > 0 ? tempo : 120
  return Math.max(20, t / Math.max(0.25, beatsPerCount || 1))
}

/* ------------------------- Pemilih Set/Huruf/Birama ------------------------- */

export interface HurufLatihan {
  label: string
  birama: number
}

/**
 * Huruf latihan (*rehearsal mark*) dari tempo map lagu. Impor MusicXML/
 * MuseScore (#27) menaruh `<rehearsal>` sebagai label segmen, jadi tidak
 * ada data kedua yang harus dirawat. Label kosong dibuang; label sama di
 * birama sama hanya muncul sekali.
 */
export function daftarHurufLatihan(tempoMap: readonly TempoSegment[] | undefined | null): HurufLatihan[] {
  const hasil: HurufLatihan[] = []
  const sudah = new Set<string>()
  for (const s of [...(tempoMap ?? [])].sort((a, b) => a.measure - b.measure)) {
    const label = (s.label ?? '').trim()
    const birama = Math.floor(s.measure)
    if (!label || !Number.isFinite(birama) || birama < 1) continue
    const k = `${label}@${birama}`
    if (sudah.has(k)) continue
    sudah.add(k)
    hasil.push({ label, birama })
  }
  return hasil
}

/**
 * Indeks set (0-based) tempat birama `birama` dimainkan. Birama sebelum set
 * pertama → set pertama; sesudah set terakhir → set terakhir; jatuh di
 * celah → set pertama sesudahnya. `-1` bila peta kosong.
 */
export function setUntukBirama(
  peta: readonly { biramaDari: number; biramaSampai: number }[],
  birama: number,
): number {
  if (!peta.length || !Number.isFinite(birama)) return -1
  const b = Math.floor(birama)
  if (b <= peta[0].biramaDari) return 0
  const tepat = peta.findIndex((p) => p.biramaDari <= b && b <= p.biramaSampai)
  if (tepat >= 0) return tepat
  const sesudah = peta.findIndex((p) => p.biramaDari >= b)
  return sesudah >= 0 ? sesudah : peta.length - 1
}

/* --------------------------- Flash-Cue Board 40 m --------------------------- */

export type PaletPlakat = 'kuning' | 'putih' | 'terbalik'

/** Warna plakat — **hex murni** (aturan warna DrillKit untuk kanvas/cetak). */
export const PALET_PLAKAT: Record<PaletPlakat, { latar: string; teks: string; label: string }> = {
  kuning: { latar: '#000000', teks: '#ffff00', label: 'Kuning di hitam' },
  putih: { latar: '#000000', teks: '#ffffff', label: 'Putih di hitam' },
  terbalik: { latar: '#ffffff', teks: '#000000', label: 'Hitam di putih' },
}
export const URUTAN_PALET: PaletPlakat[] = ['kuning', 'putih', 'terbalik']

/** Panjang maksimum teks plakat (lebih dari ini tidak terbaca dari 40 m). */
export const MAKS_TEKS_PLAKAT = 48

/** Rapikan teks plakat: huruf kapital, spasi tunggal, dipotong ke batas. */
export function rapikanTeksPlakat(teks: string): string {
  return (teks ?? '').replace(/\s+/g, ' ').trim().toUpperCase().slice(0, MAKS_TEKS_PLAKAT).trim()
}

/** "SET 12 – 16 · TEMPO 85%" (atau "SET 12 · TEMPO 85%" untuk satu set). */
export function teksPlakatRentang(dari: number, sampai: number, persen: number): string {
  const a = Math.max(1, Math.floor(Math.min(dari, sampai)))
  const b = Math.max(1, Math.floor(Math.max(dari, sampai)))
  const rentang = a === b ? `SET ${a}` : `SET ${a} – ${b}`
  return `${rentang} · TEMPO ${Math.round(persen)}%`
}

/** "RESET KE SET 1 · FULL RUN". */
export function teksPlakatReset(set = 1): string {
  return `RESET KE SET ${Math.max(1, Math.floor(set))} · FULL RUN`
}

/** "DARI HURUF C · TEMPO 85%". */
export function teksPlakatHuruf(label: string, persen: number): string {
  return rapikanTeksPlakat(`DARI HURUF ${label} · TEMPO ${Math.round(persen)}%`)
}

/** Isyarat siap pakai yang paling sering diteriakkan dari menara. */
export const ISYARAT_PODIUM = ['TAHAN · HOLD', 'ULANGI SEKALI LAGI', 'ISTIRAHAT · MINUM', 'KEMBALI KE POSISI'] as const

/** Pecah teks plakat menjadi baris di setiap pemisah " · ". */
export function barisPlakat(teks: string): string[] {
  return rapikanTeksPlakat(teks)
    .split(/\s*·\s*/)
    .map((b) => b.trim())
    .filter(Boolean)
}

/**
 * Perkiraan awal ukuran huruf plakat sebagai nilai CSS `min(..vw, ..vh)`
 * agar baris terpanjang memenuhi ±92% lebar layar dan semua baris muat
 * tingginya. Lebar satu huruf tebal kapital diperkirakan longgar 0,8 em
 * (Arial Black/DejaVu Bold); `PlakatPodium` lalu menyetelnya dari ukuran
 * yang benar-benar terukur di perangkat.
 */
export function ukuranHurufPlakat(baris: readonly string[]): string {
  const terpanjang = Math.max(1, ...baris.map((b) => b.length))
  const n = Math.max(1, baris.length)
  const vw = Math.min(30, 92 / (0.8 * terpanjang))
  const vh = Math.min(60, 82 / (n * 1.12))
  const bulat = (x: number) => Math.round(x * 100) / 100
  return `min(${bulat(vw)}vw, ${bulat(vh)}vh)`
}

/* ------------------------------ Setelan podium ------------------------------ */

export interface SetelanPodium {
  standby: number
  markTime: number
  profil: ProfilPodium
  palet: PaletPlakat
}

export const SETELAN_PODIUM_BAWAAN: SetelanPodium = { standby: 4, markTime: 4, profil: 'drbeat', palet: 'kuning' }
export const KUNCI_PODIUM = 'drillkit.podium.v1'

export function rapikanSetelanPodium(x: Partial<SetelanPodium> | null | undefined): SetelanPodium {
  const b = SETELAN_PODIUM_BAWAAN
  const pilih = <T extends number>(daftar: readonly T[], v: unknown, cadangan: T): T =>
    daftar.includes(v as T) ? (v as T) : cadangan
  return {
    standby: pilih(PILIHAN_STANDBY, x?.standby, b.standby as 4),
    markTime: pilih(PILIHAN_MARK_TIME, x?.markTime, b.markTime as 4),
    profil: PROFIL_PODIUM.includes(x?.profil as ProfilPodium) ? (x!.profil as ProfilPodium) : b.profil,
    palet: URUTAN_PALET.includes(x?.palet as PaletPlakat) ? (x!.palet as PaletPlakat) : b.palet,
  }
}

interface Penyimpan {
  getItem(k: string): string | null
  setItem(k: string, v: string): void
}

function penyimpan(): Penyimpan | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null
  } catch {
    return null
  }
}

export function bacaSetelanPodium(p: Penyimpan | null = penyimpan()): SetelanPodium {
  try {
    const mentah = p?.getItem(KUNCI_PODIUM)
    return rapikanSetelanPodium(mentah ? (JSON.parse(mentah) as Partial<SetelanPodium>) : null)
  } catch {
    return { ...SETELAN_PODIUM_BAWAAN }
  }
}

export function tulisSetelanPodium(s: SetelanPodium, p: Penyimpan | null = penyimpan()) {
  try {
    p?.setItem(KUNCI_PODIUM, JSON.stringify(rapikanSetelanPodium(s)))
  } catch {
    /* penyimpanan penuh/diblokir — setelan hanya berlaku di layar ini */
  }
}
