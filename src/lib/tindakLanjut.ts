/**
 * #26 (`v2.2.4`) — Logika murni catatan *cleaning* / tindak lanjut staf.
 *
 * Satu alur untuk semua sumber (cleaning set `#26`, komentar juri `#20`,
 * Papan Staf `#34`): **temuan → fokus → beres**. Modul ini tidak menyentuh
 * Dexie supaya bisa diuji tanpa peramban; penulisan ada di komponen panel.
 */
import type { PenandaJudgeTape, PenilaianLomba, StatusTindakLanjut, SumberTindakLanjut, TindakLanjut } from '../db/types'

export const URUTAN_STATUS_TL: StatusTindakLanjut[] = ['temuan', 'fokus', 'beres']

export const LABEL_STATUS_TL: Record<StatusTindakLanjut, string> = {
  temuan: 'Temuan',
  fokus: 'Fokus',
  beres: 'Beres',
}

/** Warna hex murni (dipakai juga di kertas cetak). */
export const WARNA_STATUS_TL_HEX: Record<StatusTindakLanjut, { teks: string; latar: string; garis: string }> = {
  temuan: { teks: '#9a3412', latar: '#fff7ed', garis: '#fb923c' },
  fokus: { teks: '#1e3a8a', latar: '#eff6ff', garis: '#3b82f6' },
  beres: { teks: '#166534', latar: '#f0fdf4', garis: '#22c55e' },
}

export type FilterStatusTL = StatusTindakLanjut | 'semua' | 'terbuka'

/** #34a — asal catatan, ditampilkan sebagai lencana di Papan Staf. */
export const LABEL_SUMBER_TL: Record<SumberTindakLanjut, string> = {
  cleaning: 'Cleaning',
  juri: 'Juri',
  staf: 'Staf',
}

/** #34a — kolom Fokus sebaiknya hanya 3–5 butir supaya benar-benar fokus. */
export const BATAS_FOKUS = 5

/** Status berikutnya saat chip status diketuk (beres → kembali temuan). */
export function statusBerikut(s: StatusTindakLanjut): StatusTindakLanjut {
  const i = URUTAN_STATUS_TL.indexOf(s)
  return URUTAN_STATUS_TL[(i + 1) % URUTAN_STATUS_TL.length]
}

/** Rapikan judul masukan cepat: spasi berlebih, batas 160 karakter. */
export function rapikanJudulTL(judul: string): string {
  return judul.replace(/\s+/g, ' ').trim().slice(0, 160)
}

export function buatTindakLanjut(opsi: {
  id: string
  judul: string
  sumber?: SumberTindakLanjut
  drillId?: string
  setId?: string
  setNomor?: number
  biramaDari?: number
  biramaSampai?: number
  seksi?: string
  prioritas?: TindakLanjut['prioritas']
  catatan?: string
  sekarang?: number
}): TindakLanjut | null {
  const judul = rapikanJudulTL(opsi.judul)
  if (!judul) return null
  const t = opsi.sekarang ?? Date.now()
  const tl: TindakLanjut = {
    id: opsi.id,
    judul,
    status: 'temuan',
    sumber: opsi.sumber ?? 'cleaning',
    createdAt: t,
    updatedAt: t,
  }
  if (opsi.drillId) tl.drillId = opsi.drillId
  if (opsi.setId) tl.setId = opsi.setId
  if (opsi.setNomor) tl.setNomor = opsi.setNomor
  if (opsi.biramaDari) tl.biramaDari = opsi.biramaDari
  if (opsi.biramaSampai) tl.biramaSampai = opsi.biramaSampai
  if (opsi.seksi) tl.seksi = opsi.seksi
  if (opsi.prioritas) tl.prioritas = opsi.prioritas
  if (opsi.catatan?.trim()) tl.catatan = opsi.catatan.trim()
  return tl
}

/** Ubah status + cap waktu `beresAt` (dihapus lagi bila dibuka kembali). */
export function ubahStatusTL(tl: TindakLanjut, status: StatusTindakLanjut, sekarang = Date.now()): TindakLanjut {
  const baru: TindakLanjut = { ...tl, status, updatedAt: sekarang }
  if (status === 'beres') baru.beresAt = sekarang
  else delete baru.beresAt
  return baru
}

/** Saring catatan untuk satu drill (opsional satu set) & filter status. */
export function saringTindakLanjut(
  daftar: TindakLanjut[],
  opsi: { drillId?: string; setId?: string; status?: FilterStatusTL; seksi?: string; sumber?: SumberTindakLanjut | 'semua' },
): TindakLanjut[] {
  const st = opsi.status ?? 'semua'
  return daftar.filter((t) => {
    if (opsi.sumber && opsi.sumber !== 'semua' && t.sumber !== opsi.sumber) return false
    if (opsi.drillId && t.drillId !== opsi.drillId) return false
    if (opsi.setId && t.setId !== opsi.setId) return false
    if (opsi.seksi && opsi.seksi !== 'semua' && t.seksi && t.seksi !== opsi.seksi) return false
    if (st === 'terbuka') return t.status !== 'beres'
    if (st !== 'semua' && t.status !== st) return false
    return true
  })
}

/** Urutan tampil: fokus → temuan → beres; prioritas tinggi dulu; lalu nomor set; lalu terbaru. */
export function urutkanTindakLanjut(daftar: TindakLanjut[]): TindakLanjut[] {
  const bobot: Record<StatusTindakLanjut, number> = { fokus: 0, temuan: 1, beres: 2 }
  return [...daftar].sort(
    (a, b) =>
      bobot[a.status] - bobot[b.status] ||
      (a.prioritas === 'tinggi' ? 0 : 1) - (b.prioritas === 'tinggi' ? 0 : 1) ||
      (a.setNomor ?? 9999) - (b.setNomor ?? 9999) ||
      b.updatedAt - a.updatedAt,
  )
}

export function hitungStatusTL(daftar: TindakLanjut[]): Record<StatusTindakLanjut, number> {
  const out: Record<StatusTindakLanjut, number> = { temuan: 0, fokus: 0, beres: 0 }
  for (const t of daftar) out[t.status] = (out[t.status] ?? 0) + 1
  return out
}

/** "Set 7 · Birama 25–28" — konteks ringkas satu catatan. */
export function konteksTL(t: Pick<TindakLanjut, 'setNomor' | 'biramaDari' | 'biramaSampai'>): string {
  const bagian: string[] = []
  if (t.setNomor) bagian.push(`Set ${t.setNomor}`)
  if (t.biramaDari) {
    bagian.push(
      t.biramaSampai && t.biramaSampai !== t.biramaDari
        ? `Birama ${t.biramaDari}–${t.biramaSampai}`
        : `Birama ${t.biramaDari}`,
    )
  }
  return bagian.join(' · ')
}

/** #34a — geser satu kolom ke kiri/kanan di Papan Staf (tanpa berputar). */
export function geserStatusTL(tl: TindakLanjut, arah: -1 | 1, sekarang = Date.now()): TindakLanjut {
  const i = URUTAN_STATUS_TL.indexOf(tl.status) + arah
  if (i < 0 || i >= URUTAN_STATUS_TL.length) return tl
  return ubahStatusTL(tl, URUTAN_STATUS_TL[i], sekarang)
}

/** #34a — catatan yang sudah dibuat dari satu komentar Judge Tape (bila ada). */
export function cariTLPenanda(daftar: TindakLanjut[], penilaianId: string, penandaId: string): TindakLanjut | undefined {
  return daftar.find((t) => t.penilaianId === penilaianId && t.penandaId === penandaId)
}

function mmss(detik: number): string {
  const d = Math.max(0, Math.round(detik))
  return `${Math.floor(d / 60)}:${String(d % 60).padStart(2, '0')}`
}

/**
 * #34a — "Jadikan tindak lanjut" dari satu komentar Judge Tape (#20):
 * tertaut drill, set, birama, prioritas tinggi bila ditandai penting, dan
 * menyimpan asal komentar supaya tombolnya tidak membuat kartu kembar.
 */
export function tindakLanjutDariPenanda(
  p: Pick<PenilaianLomba, 'id' | 'judul' | 'drillId'>,
  c: PenandaJudgeTape,
  opsi: { id: string; setNomor?: number; labelFokus?: string; sekarang?: number },
): TindakLanjut | null {
  const tl = buatTindakLanjut({
    id: opsi.id,
    judul: c.teks,
    sumber: 'juri',
    drillId: p.drillId,
    setId: c.setId,
    setNomor: opsi.setNomor,
    biramaDari: c.birama,
    prioritas: c.tingkat === 'penting' ? 'tinggi' : undefined,
    catatan: `Judge Tape “${p.judul}” ${mmss(c.detik)}${opsi.labelFokus ? ` · ${opsi.labelFokus}` : ''}`,
    sekarang: opsi.sekarang,
  })
  if (!tl) return null
  tl.penilaianId = p.id
  tl.penandaId = c.id
  return tl
}
