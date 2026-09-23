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
import { dariBeatsLama, detikTotal } from './birama'
import type { SegmenWaktu, TandaBirama } from './birama'
import { jepitTempo, tempoBerlaku } from './metronome'

/** Satu baris ringkasan set list: durasi sebuah lagu. */
export interface BarisSetList {
  id: string
  judul: string
  bpm: number
  /** Durasi lagu dalam detik. `null` = lagu belum diisi panjangnya. */
  detik: number | null
  /** Sukat utama lagu, untuk ditampilkan. */
  sukat: TandaBirama
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
  return (s.tempoMap ?? []).map((t) => ({
    measure: t.measure,
    bpm: t.bpm,
    birama: t.birama,
    // N9 — tanda berangsur ikut, supaya durasinya menghitung luncuran.
    berangsur: t.berangsur,
  }))
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
export function tempoUntukLagu(s: Song): (birama: number) => number {
  const segmen = s.tempoMap ?? []
  return (birama) =>
    jepitTempo(
      tempoBerlaku(
        { dasar: s.bpm, segmen, pakaiTempoMap: segmen.length > 0, latih: s.latih ?? null },
        birama,
      ),
    )
}

/** Durasi sebuah lagu dalam detik. `null` kalau panjangnya belum diisi. */
export function durasiSatu(s: Song): number | null {
  return detikTotal(segmenLagu(s), s.panjangBirama, sukatLagu(s), s.bpm, tempoUntukLagu(s))
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
export function hitungSetList(sl: SetList | null | undefined, semua: Song[]): HitunganSetList {
  const peta = new Map(semua.map((s) => [s.id, s]))
  const baris: BarisSetList[] = []
  let total = 0
  let tanpaPanjang = 0

  for (const id of sl?.songIds ?? []) {
    const s = peta.get(id)
    if (!s) continue // lagu sudah dihapus — lewati, jangan dihitung
    const detik = durasiSatu(s)
    if (detik === null) tanpaPanjang++
    else total += detik
    baris.push({
      id: s.id,
      judul: s.title,
      bpm: s.bpm,
      detik,
      sukat: sukatLagu(s),
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
