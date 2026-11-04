/**
 * #26 (`v2.2.4`) — Penjejak lintasan pemain **dalam ruang yard** yang dipakai
 * bersama oleh seluruh mesin hitung non-animasi:
 *
 * - pemeriksa benturan `#24` (`tabrakanDrill.ts`),
 * - bingkai pratinjau tribun & ekspor video `#25` (`perspektifTribun.ts`),
 * - `xCounts` & titik tengah buku saku `#26` (`bukuSakuPemain.ts`).
 *
 * Sebelumnya tiap modul menyalin sendiri rantai `FTL → midset → kelompok →
 * busur → lurus/lengkung`, dan salinannya sempat berbeda halus (mis. pemain
 * ber-midset yang kembali ke titik awal dianggap diam). Sekarang satu sumber.
 *
 * Konvensi: `p` adalah progres **hitungan** set (`p × counts` = hitungan ke-),
 * sedangkan `t` adalah progres lintasan setelah tunda/ripple/Hold/easing
 * (`progresPemain`). Titik singgah `midsets` sengaja dievaluasi dengan `p`
 * supaya pemain tiba **tepat** pada `padaCount` yang tertulis di buku saku.
 */
import type { DrillPoint, DrillSet, Member } from '../db/types'
import {
  bangunPetaFtl,
  cocokPutaran,
  deltaBusur,
  deltaMidsets,
  deltaPoliFtl,
  gerakOf,
  kelompokPemain,
  progresPemain,
  sinkronkanKelompokDariTag,
  titikJalur,
  type GerakLengkap,
} from './gerak'

type PoliFtl = ReturnType<typeof bangunPetaFtl> extends Map<string, infer V> ? V : never

/** Deskripsi lintasan satu pemain (atau slot Hole) pada satu perpindahan set. */
export interface JalurPemain {
  id: string
  section?: string
  awal: DrillPoint
  akhir: DrillPoint
  /** Tidak berpindah sama sekali (tanpa midset/FTL dan jarak < 0,0001 yd). */
  diam: boolean
  ftl?: PoliFtl
  adaMidset: boolean
  jalanCount?: number
  /** Kelengkungan segmen terakhir (kelompok `lengkung` atau jalur set `lengkung`). */
  kAkhir: number
  busur?: {
    pusat: { x: number; y: number }
    sudut: number
    geser: { x: number; y: number }
  }
}

export interface PenjejakSet {
  g: GerakLengkap
  /** Jumlah hitungan perpindahan (minimal 1). */
  counts: number
  jalur: Map<string, JalurPemain>
  /** Posisi yard pemain `id` pada progres hitungan `p` (`0..1`), atau `null` bila tak ada di set. */
  posisi(id: string, p: number): { x: number; y: number } | null
}

/** Evaluasi posisi yard satu lintasan pada progres hitungan `p`. */
export function posisiJalurPadaP(
  j: JalurPemain,
  dari: Pick<DrillSet, 'midsets'>,
  g: GerakLengkap,
  counts: number,
  p: number,
): { x: number; y: number } {
  if (j.diam || p <= 0) return { x: j.awal.x, y: j.awal.y }
  const tundaSeksi = j.section ? (g.tunda[j.section] ?? 0) : 0
  if (p >= 1 && !g.ripple && !j.jalanCount && !(tundaSeksi > 0)) {
    return { x: j.akhir.x, y: j.akhir.y }
  }
  const t = progresPemain(p, g, j.section, counts, j.id)
  if (j.ftl) {
    const [dx, dy] = deltaPoliFtl(j.ftl, t)
    return { x: j.awal.x + dx, y: j.awal.y + dy }
  }
  if (j.adaMidset && dari.midsets?.[j.id]?.length) {
    const [dx, dy] = deltaMidsets(j.awal, j.akhir, dari.midsets[j.id], counts, p, j.kAkhir, j.jalanCount)
    return { x: j.awal.x + dx, y: j.awal.y + dy }
  }
  if (j.busur) {
    const [dx, dy] = deltaBusur(t, j.awal.x, j.awal.y, j.busur.pusat, j.busur.sudut, j.busur.geser)
    return { x: j.awal.x + dx, y: j.awal.y + dy }
  }
  const [dx, dy] = titikJalur(t, j.akhir.x - j.awal.x, j.akhir.y - j.awal.y, j.kAkhir)
  return { x: j.awal.x + dx, y: j.awal.y + dy }
}

/**
 * Bangun penjejak lintasan untuk perpindahan `dari → ke`.
 *
 * `idTambahan` dipakai untuk titik non-anggota yang tetap punya lintasan
 * (slot **Hole** `#26`) — mereka ikut jalur set, tanpa tunda seksi.
 */
export function buatPenjejakSet(opsi: {
  dari: DrillSet
  ke?: DrillSet
  anggota: Member[]
  hanya?: Set<string>
  idTambahan?: string[]
}): PenjejakSet {
  const { dari, ke, anggota, hanya } = opsi
  const counts = Math.max(1, Math.floor(dari.counts || 0) || 1)
  const gMentah = gerakOf(dari.gerak)
  const klpSinkron = sinkronkanKelompokDariTag(gMentah.kelompok, anggota)
  const g = klpSinkron !== gMentah.kelompok ? { ...gMentah, kelompok: klpSinkron } : gMentah
  const petaFtl =
    ke && g.kelompok?.some((k) => k.jalur === 'ftl')
      ? bangunPetaFtl(g.kelompok, dari.points, ke.points)
      : new Map<string, PoliFtl>()
  const pt = g.jalur === 'busur' ? g.putar : undefined
  const geser = pt?.pusatAkhir
    ? { x: pt.pusatAkhir.x - pt.pusat.x, y: pt.pusatAkhir.y - pt.pusat.y }
    : { x: 0, y: 0 }

  const jalur = new Map<string, JalurPemain>()
  const daftar: { id: string; section?: string }[] = [
    ...anggota.map((m) => ({ id: m.id, section: m.section })),
    ...(opsi.idTambahan ?? []).map((id) => ({ id })),
  ]
  for (const { id, section } of daftar) {
    if (hanya && !hanya.has(id)) continue
    if (jalur.has(id)) continue
    const awal = dari.points[id]
    if (!awal) continue
    const akhir = ke?.points[id] ?? awal
    const klp = kelompokPemain(g, id)
    const ftl = ke ? petaFtl.get(id) : undefined
    const adaMidset = Boolean(ke && !ftl && dari.midsets?.[id]?.length)
    const kAkhir = klp
      ? klp.jalur === 'lengkung'
        ? (klp.lengkung ?? 0.4)
        : 0
      : g.jalur === 'lengkung'
        ? g.lengkung
        : 0
    const busur =
      ke && !ftl && !adaMidset && !klp && pt && pt.sudut &&
      cocokPutaran(awal.x, awal.y, akhir.x, akhir.y, pt.pusat, pt.sudut, geser)
        ? { pusat: pt.pusat, sudut: pt.sudut, geser }
        : undefined
    const diam = !ke || (Math.hypot(akhir.x - awal.x, akhir.y - awal.y) < 1e-4 && !adaMidset && !ftl)
    jalur.set(id, {
      id,
      section,
      awal,
      akhir,
      diam,
      ftl,
      adaMidset,
      jalanCount: klp?.jalanCount ?? g.jalanCount,
      kAkhir,
      busur,
    })
  }

  return {
    g,
    counts,
    jalur,
    posisi(id, p) {
      const j = jalur.get(id)
      if (!j) return null
      return posisiJalurPadaP(j, dari, g, counts, Math.min(1, Math.max(0, p)))
    },
  }
}
