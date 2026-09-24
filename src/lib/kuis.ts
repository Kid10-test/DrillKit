import type { DrillSet } from '../db/types'

/**
 * C2 — mode kuis/hafalan untuk anggota: tebak posisi sendiri di set
 * berikutnya. Modul murni (tanpa React) supaya bisa diuji tanpa peramban.
 */

/** Satu soal: dari set A ke set B, di mana posisiku di B? */
export interface SoalKuis {
  dariSetId: string
  keSetId: string
  dariNama: string
  keNama: string
  /** Count yang tersedia untuk perpindahan (milik set asal). */
  counts: number
  /** Posisi saat ini — ditampilkan sebagai titik berangkat. */
  dari: { x: number; y: number }
  /** Posisi benar — kunci, disembunyikan sampai jawaban dikunci. */
  kunci: { x: number; y: number }
}

/** Toleransi jawaban benar, dalam langkah. */
export const TOLERANSI_LANGKAH = 2

/**
 * Susun soal dari seluruh perpindahan set: satu soal per pasangan set
 * berurutan. Anggota yang tidak ada di salah satu set (istirahat/prop)
 * membuat pasangannya dilewati — soalnya tidak punya kunci yang jujur.
 */
export function bangunSoal(sets: DrillSet[], memberId: string): SoalKuis[] {
  const urut = [...sets].sort((a, b) => a.order - b.order)
  const soal: SoalKuis[] = []
  for (let i = 0; i + 1 < urut.length; i++) {
    const dari = urut[i]
    const ke = urut[i + 1]
    const p = dari.points?.[memberId]
    const q = ke.points?.[memberId]
    if (!p || !q) continue
    soal.push({
      dariSetId: dari.id,
      keSetId: ke.id,
      dariNama: dari.name,
      keNama: ke.name,
      counts: dari.counts ?? 0,
      dari: { x: p.x, y: p.y },
      kunci: { x: q.x, y: q.y },
    })
  }
  return soal
}

export interface NilaiTebakan {
  /** Jarak tebakan ke kunci, dalam langkah (dua desimal). */
  jarakLangkah: number
  /** Benar bila tidak melebihi toleransi. */
  benar: boolean
}

/** Nilai satu tebakan terhadap kuncinya. */
export function nilaiTebakan(
  tebakan: { x: number; y: number },
  kunci: { x: number; y: number },
  sYd: number,
  toleransi = TOLERANSI_LANGKAH,
): NilaiTebakan {
  const jarak = Math.hypot(tebakan.x - kunci.x, tebakan.y - kunci.y) / sYd
  return {
    jarakLangkah: Math.round(jarak * 100) / 100,
    benar: jarak <= toleransi + 1e-9,
  }
}

/**
 * Acak urutan dengan benih (mulberry32) — benih yang sama selalu
 * menghasilkan urutan yang sama. **Benih 0 berarti jangan acak**: soal
 * mengikuti urutan set, untuk latihan berurutan dan untuk uji.
 */
export function acakUrutan<T>(daftar: T[], benih: number): T[] {
  if (!benih) return [...daftar]
  let a = benih >>> 0
  const rnd = () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const keluar = [...daftar]
  for (let i = keluar.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[keluar[i], keluar[j]] = [keluar[j], keluar[i]]
  }
  return keluar
}
