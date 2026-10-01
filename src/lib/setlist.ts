/**
 * M3 — set list: urutan lagu untuk satu penampilan.
 *
 * Sengaja **murni** (tidak menyentuh DOM, React, atau database) supaya
 * logika durasi & pengurutan bisa diuji langsung dari node.
 *
 * Yang disimpan di set list hanyalah **id lagu** (lihat `SetList` di
 * `src/db/types.ts`), jadi semua perhitungan di sini menerima kumpulan lagu
 * yang sudah dicari pemanggilnya.
 */
import type { SetList, Song } from '../db/types'
import { dariBeatsLama } from './birama'
import type { SegmenWaktu, TandaBirama } from './birama'
import { createTempoTimeline } from './tempoTimeline'
import { labelLatihan, latihanAktif, terapkanLatihan } from './tempoLatihan'
import type { TempoLatihan } from './tempoLatihan'

/** Satu baris ringkasan set list: durasi sebuah lagu. */
export interface BarisSetList {
  id: string
  judul: string
  bpm: number
  /** Durasi lagu dalam detik. `null` = lagu belum diisi panjangnya. */
  detik: number | null
  /** Sukat utama lagu, untuk ditampilkan. */
  sukat: TandaBirama
  /** #4 — tempo dasar setelah tempo latihan (sama dengan `bpm` kalau tempo asli). */
  bpmLatihan: number
  /** #4 — "Latihan 80%"; `null` kalau lagu ini memakai tempo asli. */
  latihan: string | null
  /** #6 — true bila lagu memiliki rekaman audio yang diselaraskan */
  adaRekaman?: boolean
}

/** Hasil perhitungan durasi satu set list. */
export interface HitunganSetList {
  /** Durasi total lagu-lagu **yang punya panjang**. Lagu tanpa panjang dihitung 0. */
  total: number
  /** Jumlah lagu yang belum diisi panjangnya — totalnya jadi tidak pasti. */
  tanpaPanjang: number
  baris: BarisSetList[]
}

/** Tanda birama yang berlaku untuk lagu ini (sukat lagu, atau turunan `beats`). */
export function sukatLagu(s: Song): TandaBirama {
  return s.tandaBirama ? s.tandaBirama : dariBeatsLama(s.beats)
}

/** Tempo map lagu dalam bentuk ringkas untuk perhitungan waktu. */
export function segmenLagu(s: Song): SegmenWaktu[] {
  return s.tempoMap ?? []
}

/**
 * N9 — tempo per birama yang dipakai saat MEMUTAR lagu lewat set list.
 *
 * Disusun persis seperti `opsiDariLagu` di halaman Musik menyusun opsi
 * mesinnya (`pakaiTempoMap: segmen.length > 0`, `latih` dari lagunya).
 * Tanpa kesamaan ini, durasi yang DITAMPILKAN di set list dihitung
 * dengan aturan yang berbeda dari durasi yang benar-benar DIMAINKAN —
 * dan selisihnya tidak pernah berteriak, hanya mengendap.
 */
export function tempoUntukLagu(s: Song, latihan?: TempoLatihan | null): (birama: number) => number {
  const timeline = createTempoTimeline({
    bpm: s.bpm,
    meter: sukatLagu(s),
    segments: segmenLagu(s),
    latih: s.latih ?? null,
  })
  return (birama) => timeline.tempoAtPosition({ measure: birama, beat: 1 }, latihan)
}

/** Durasi sebuah lagu dalam detik. `null` kalau panjangnya belum diisi. */
export function durasiSatu(s: Song, latihan?: TempoLatihan | null): number | null {
  const panjang = Math.floor(s.panjangBirama ?? 0)
  if (!Number.isFinite(panjang) || panjang < 1) return null
  const timeline = createTempoTimeline({
    bpm: s.bpm,
    meter: sukatLagu(s),
    segments: segmenLagu(s),
    latih: s.latih ?? null,
  })
  return timeline.secondsAtPosition({ measure: panjang + 1, beat: 1 }, latihan)
}

/**
 * Hitung durasi set list.
 *
 * Lagu yang **belum diisi panjangnya tetap dihitung 0 detik**, tapi
 * jumlahnya dilaporkan di `tanpaPanjang` — jadi pemakai tahu totalnya baru
 * perkiraan, bukan angka final yang menyesatkan.
 *
 * Lagu yang id-nya tidak ketemu di `semua` dilewati (misalnya lagunya sudah
 * dihapus), supaya set list tidak rusak hanya karena satu lagu hilang.
 */
/**
 * #4 — `latihanUntuk` opsional: kalau diisi, durasi & tempo tiap lagu memakai
 * tempo latihannya. Layar hari H (mode lomba) sengaja tidak mengisinya,
 * jadi selalu tempo asli.
 */
export function hitungSetList(
  sl: SetList | null | undefined,
  semua: Song[],
  latihanUntuk?: (songId: string) => TempoLatihan | null,
): HitunganSetList {
  const peta = new Map(semua.map((s) => [s.id, s]))
  const baris: BarisSetList[] = []
  let total = 0
  let tanpaPanjang = 0

  for (const id of sl?.songIds ?? []) {
    const s = peta.get(id)
    if (!s) continue // lagu sudah dihapus — lewati, jangan dihitung
    const lat = latihanUntuk?.(s.id) ?? null
    const detik = durasiSatu(s, lat)
    if (detik === null) tanpaPanjang++
    else total += detik
    baris.push({
      id: s.id,
      judul: s.title,
      bpm: s.bpm,
      detik,
      sukat: sukatLagu(s),
      bpmLatihan: latihanAktif(lat) ? Math.round(terapkanLatihan(s.bpm, lat)) : s.bpm,
      latihan: labelLatihan(lat),
      adaRekaman: !!s.rekaman,
    })
  }
  return { total, tanpaPanjang, baris }
}

/* ------------------------------ pengurutan ------------------------------- */

/** Pindahkan item dari indeks `dari` ke indeks `ke`. Indeks luar diabaikan. */
export function pindah<T>(daftar: T[], dari: number, ke: number): T[] {
  const n = daftar.length
  if (dari < 0 || dari >= n) return daftar
  const tujuan = Math.max(0, Math.min(n - 1, ke))
  if (tujuan === dari) return daftar
  const hasil = [...daftar]
  const [item] = hasil.splice(dari, 1)
  hasil.splice(tujuan, 0, item)
  return hasil
}

/** Naikkan satu posisi (ke arah awal set list). */
export function naik<T>(daftar: T[], i: number): T[] {
  return pindah(daftar, i, i - 1)
}

/** Turunkan satu posisi (ke arah akhir set list). */
export function turun<T>(daftar: T[], i: number): T[] {
  return pindah(daftar, i, i + 1)
}

/* --------------------------------- lain ---------------------------------- */

/** Set list baru yang kosong. */
export function setListBaru(id: string, name: string): SetList {
  const kini = Date.now()
  return { id, name, songIds: [], createdAt: kini, updatedAt: kini }
}

/**
 * Apakah set list ini bisa diputar **seluruhnya** tanpa berhenti.
 *
 * Syaratnya: ada lagunya, dan setiap lagu sudah punya panjang — kalau ada
 * yang belum, mesin tidak tahu kapan harus pindah ke lagu berikutnya.
 */
export function bisaDiputar(h: HitunganSetList): boolean {
  return h.baris.length > 0 && h.tanpaPanjang === 0
}
