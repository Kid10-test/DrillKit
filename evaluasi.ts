/**
 * H2 — evaluasi & kemajuan anggota.
 *
 * Keluhan yang mendasarinya: *catatan evaluasi sekarang hanya teks bebas,
 * perkembangannya sulit dilihat.* Catatan bebas bagus untuk menangkap
 * kejadian, tetapi ia tidak bisa menjawab pertanyaan yang paling menentukan
 * bagi pembinaan: **apa perkembangan anggota ini dari waktu ke waktu?**
 *
 * Modul ini sengaja **murni** supaya aturan-aturannya bisa diuji di node.
 * Dua di antaranya mudah salah dan karenanya paling dikuji:
 *
 * 1. **Aspek boleh dinilai sebagian.** Menilai kerjasama tanpa menilai teknik
 *    itu sah; memaksa semua terisi akan membuat evaluasi jadi asal-asalan.
 *    Karena itu `rataRata` mengembalikan `null` kalau tidak ada satu pun
 *    aspek yang dinilai — bukan 0, yang akan tampak sebagai "nilai terendah".
 * 2. **Tren dihitung hanya pada aspek yang dinilai di KEDUA evaluasi.**
 *    Membandingkan rata-rata dari dua himpunan aspek yang berbeda
 *    menghasilkan angka yang tampak pasti padahal menipu: anggota bisa
 *    tampak "naik" hanya karena aspek tersulitnya tidak dinilai kali ini.
 *
 * **Kehadiran sengaja bukan aspek.** Ia sudah terukur dari data absensi,
 * jadi menilainya manual akan membuat dua tempat untuk hal yang sama.
 */
import type { AspekEvaluasi, Evaluasi } from '../db/types'

export const URUTAN_ASPEK: AspekEvaluasi[] = ['teknik', 'musikalitas', 'kedisiplinan', 'kerjasama']

export const LABEL_ASPEK: Record<AspekEvaluasi, string> = {
  teknik: 'Teknik',
  musikalitas: 'Musikalitas',
  kedisiplinan: 'Kedisiplinan',
  kerjasama: 'Kerjasama',
}

/** Nilai terkecil & terbesar yang sah. */
export const MIN_NILAI = 1
export const MAX_NILAI = 5

/** Nilai di luar rentang diabaikan, supaya berkas dari luar tidak merusak hitungan. */
export function nilaiSah(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= MIN_NILAI && n <= MAX_NILAI
}

/** Aspek yang dinilai pada evaluasi ini, mengikuti urutan baku. */
export function aspekDinilai(e: Evaluasi): AspekEvaluasi[] {
  return URUTAN_ASPEK.filter((k) => nilaiSah(e.nilai?.[k]))
}

/**
 * Rata-rata nilai sebuah evaluasi.
 *
 * `null` kalau tidak ada satu pun aspek yang dinilai — **bukan 0**. Nol akan
 * terbaca sebagai "nilai terendah", padahal maksudnya "belum dinilai".
 * Membedakan keduanya adalah pelajaran yang sama dengan `takPasti` di G1.
 */
export function rataRata(e: Evaluasi | null | undefined): number | null {
  if (!e) return null
  const aspek = aspekDinilai(e)
  if (!aspek.length) return null
  return aspek.reduce((t, k) => t + (e.nilai[k] as number), 0) / aspek.length
}

/** Urutkan evaluasi dari yang terbaru. */
export function urutEvaluasi(daftar: Evaluasi[]): Evaluasi[] {
  return [...daftar].sort((a, b) => {
    if (a.tanggal !== b.tanggal) return a.tanggal < b.tanggal ? 1 : -1
    return b.createdAt - a.createdAt
  })
}

export function terbaru(daftar: Evaluasi[]): Evaluasi | null {
  return urutEvaluasi(daftar)[0] ?? null
}

/** Evaluasi sebelum yang terbaru. `null` kalau baru ada satu. */
export function sebelumnya(daftar: Evaluasi[]): Evaluasi | null {
  return urutEvaluasi(daftar)[1] ?? null
}

/**
 * Selisih rata-rata antara evaluasi terbaru dan sebelumnya.
 *
 * **Hanya pada aspek yang dinilai di keduanya.** Kalau tidak ada satu pun
 * aspek yang sama, kembalikan `null` — dua evaluasi yang himpunan aspeknya
 * tidak bersinggungan memang tidak bisa dibandingkan, dan mengarang
 * perbandingannya lebih berbahaya daripada mengakui tidak tahu.
 */
export function tren(daftar: Evaluasi[]): number | null {
  const a = terbaru(daftar)
  const b = sebelumnya(daftar)
  if (!a || !b) return null
  const bersama = URUTAN_ASPEK.filter((k) => nilaiSah(a.nilai?.[k]) && nilaiSah(b.nilai?.[k]))
  if (!bersama.length) return null
  const rata = (e: Evaluasi) => bersama.reduce((t, k) => t + (e.nilai[k] as number), 0) / bersama.length
  return rata(a) - rata(b)
}

/** Aspek yang dibandingkan pada perhitungan tren — dipakai untuk penjelasan. */
export function aspekTren(daftar: Evaluasi[]): AspekEvaluasi[] {
  const a = terbaru(daftar)
  const b = sebelumnya(daftar)
  if (!a || !b) return []
  return URUTAN_ASPEK.filter((k) => nilaiSah(a.nilai?.[k]) && nilaiSah(b.nilai?.[k]))
}

export interface RingkasanEvaluasi {
  jumlah: number
  terbaru: Evaluasi | null
  rata: number | null
  tren: number | null
  /** Nilai per aspek pada evaluasi terbaru. `null` = aspek itu tidak dinilai. */
  perAspek: Record<AspekEvaluasi, number | null>
}

export function ringkasan(daftar: Evaluasi[]): RingkasanEvaluasi {
  const t = terbaru(daftar)
  const perAspek = {} as Record<AspekEvaluasi, number | null>
  for (const k of URUTAN_ASPEK) {
    const n = t?.nilai?.[k]
    perAspek[k] = nilaiSah(n) ? n : null
  }
  return {
    jumlah: daftar.length,
    terbaru: t,
    rata: rataRata(t),
    tren: tren(daftar),
    perAspek,
  }
}

/** Rata-rata seluruh tim dari evaluasi terbaru tiap anggota. */
export function rataTim(daftar: Evaluasi[]): number | null {
  const perAnggota = new Map<string, Evaluasi[]>()
  for (const e of daftar) {
    const l = perAnggota.get(e.memberId) ?? []
    l.push(e)
    perAnggota.set(e.memberId, l)
  }
  const nilai: number[] = []
  for (const l of perAnggota.values()) {
    const r = rataRata(terbaru(l))
    if (r != null) nilai.push(r)
  }
  if (!nilai.length) return null
  return nilai.reduce((t, n) => t + n, 0) / nilai.length
}

/**
 * Anggota yang nilainya di bawah ambang, diurutkan dari yang terendah.
 *
 * Yang belum pernah dievaluasi **tidak** masuk: "belum dinilai" dan "nilainya
 * rendah" bukan hal yang sama.
 */
export function perluPerhatian(daftar: Evaluasi[], ambang: number): { memberId: string; rata: number; tren: number | null }[] {
  const perAnggota = new Map<string, Evaluasi[]>()
  for (const e of daftar) {
    const l = perAnggota.get(e.memberId) ?? []
    l.push(e)
    perAnggota.set(e.memberId, l)
  }
  const out: { memberId: string; rata: number; tren: number | null }[] = []
  for (const [memberId, l] of perAnggota) {
    const r = rataRata(terbaru(l))
    if (r == null || r >= ambang) continue
    out.push({ memberId, rata: r, tren: tren(l) })
  }
  return out.sort((a, b) => a.rata - b.rata)
}

/* --------------------------------- Format --------------------------------- */

/** Satu desimal, untuk ditampilkan: "4.3". "—" kalau belum dinilai. */
export function formatNilai(n: number | null | undefined): string {
  return n == null ? '—' : n.toFixed(1)
}

/**
 * "naik 0.5", "turun 0.3", "tetap", atau "—" kalau belum bisa dibandingkan.
 *
 * Pembulatannya **simetris** (setengah menjauhi nol), bukan memakai
 * `Math.round` begitu saja: `Math.round(-3.5)` di JavaScript menghasilkan −3,
 * sehingga −0,35 tampil "turun 0,3" sementara +0,35 tampil "naik 0,4".
 * Tidak berbahaya, tetapi dua anggota dengan perubahan sama besarnya akan
 * ditampilkan berbeda.
 */
export function formatTren(t: number | null | undefined): string {
  if (t == null) return '—'
  const n = (t < 0 ? -1 : 1) * (Math.round(Math.abs(t) * 10) / 10)
  if (Math.abs(n) < 0.05) return 'tetap'
  return n > 0 ? `naik ${n.toFixed(1)}` : `turun ${Math.abs(n).toFixed(1)}`
}

/** Warna teks mengikuti nilainya — seragam dengan gaya laporan di aplikasi. */
export function warnaNilai(n: number | null): string {
  if (n == null) return 'text-slate-500'
  if (n >= 4) return 'text-emerald-300'
  if (n >= 3) return 'text-sky-300'
  if (n >= 2) return 'text-amber-300'
  return 'text-rose-300'
}

/** Warna tren: naik hijau, turun merah, tetap abu-abu. */
export function warnaTren(t: number | null): string {
  if (t == null) return 'text-slate-600'
  if (Math.abs(t) < 0.05) return 'text-slate-500'
  return t > 0 ? 'text-emerald-400' : 'text-rose-400'
}
