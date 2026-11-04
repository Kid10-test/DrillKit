/**
 * #26 (`v2.2.4`) — Buku Saku Generasi Baru (logika murni, tanpa React/DOM).
 *
 * 1. **`xCounts`** — hitungan tepat saat lintasan pemain melintasi garis yard,
 *    hash, atau patok Indonesia (`A, B#, T1..Tn`), untuk jalur lurus, lengkung,
 *    busur, titik singgah `#23`, maupun FTL `#16` (via `jejakJalur.ts`).
 * 2. **Titik tengah** — posisi tepat pada separuh hitungan set.
 * 3. **Dress / guiding** — siapa pemandu pelurusan bagi seorang pemain.
 * 4. **Hole & Bayangan** — slot penjaga interval & pemain alternate, tanpa
 *    mengubah penomoran titik tim.
 *
 * Seluruh teks berbahasa Indonesia dengan koma desimal ("hit. 4,5").
 */
import type {
  AcuanDress,
  BayanganAnggota,
  BentukTerikat,
  Drill,
  DrillPoint,
  DrillSet,
  DressBarisan,
  FieldConfig,
  Member,
  SlotHole,
} from '../db/types'
import { apakahModeParade, coordText, daftarPatok, hashOffsetYd, panahArah, patokOf, stepYd } from './field'
import { buatPenjejakSet, type PenjejakSet } from './jejakJalur'

/* ============================================================================
 * 1. Garis acuan lapangan & xCounts
 * ========================================================================== */

export interface GarisAcuanLapangan {
  /** `x` = garis membujur tegak (yard line / patok huruf), `y` = garis melintang (hash / patok T). */
  sumbu: 'x' | 'y'
  /** Posisi garis dalam koordinat internal (yard). */
  pos: number
  label: string
  jenis: 'yard' | 'hash' | 'patok'
}

/** Format angka hitungan cara Indonesia: `6` → "6", `4.5` → "4,5". */
export function fmtHitungan(n: number): string {
  const r = Math.round(n * 10) / 10
  return Number.isInteger(r) ? String(r) : String(r).replace('.', ',')
}

/**
 * Daftar garis yang layak disebut di `xCounts`.
 *
 * - Lapangan berpatok (DD1) → patok huruf & patok T (persis label di lapangan).
 * - Lapangan football → yard line kelipatan 5 di area main + front/back hash.
 * - Mode Kirab (#19) → kosong (barisan berjalan lurus di jalan raya).
 */
export function daftarGarisAcuan(f: FieldConfig): GarisAcuanLapangan[] {
  if (apakahModeParade(f)) return []
  if (patokOf(f).aktif === 1) {
    return [
      ...daftarPatok(f, 'x').map((g) => ({ sumbu: 'x' as const, pos: g.pos, label: g.label, jenis: 'patok' as const })),
      ...daftarPatok(f, 'y').map((g) => ({ sumbu: 'y' as const, pos: g.pos, label: g.label, jenis: 'patok' as const })),
    ]
  }
  const out: GarisAcuanLapangan[] = []
  const batas = f.lengthYd / 2 + 1e-6
  for (let k = -40; k <= 40; k++) {
    const x = k * 5
    if (Math.abs(x) > batas) continue
    const yl = 50 - Math.abs(x)
    out.push({
      sumbu: 'x',
      pos: x,
      label: x === 0 ? `YL${yl}` : `YL${yl} ${x > 0 ? 'S1' : 'S2'}`,
      jenis: 'yard',
    })
  }
  const ho = hashOffsetYd(f)
  if (ho > 0) {
    out.push({ sumbu: 'y', pos: -ho, label: 'FH', jenis: 'hash' })
    out.push({ sumbu: 'y', pos: ho, label: 'BH', jenis: 'hash' })
  }
  return out
}

export interface XCount {
  label: string
  jenis: GarisAcuanLapangan['jenis']
  sumbu: 'x' | 'y'
  /** Hitungan (dari awal perpindahan) saat garis dilintasi, dibulatkan 0,1. */
  hitungan: number
}

/**
 * Cari semua perlintasan garis acuan oleh pemain `id` sepanjang perpindahan.
 *
 * Lintasan dicuplik rapat (±12 cuplikan per hitungan), lalu tiap pergantian
 * sisi garis dipersempit dengan bagi-dua 24 langkah sehingga hitungannya
 * presisi walau jalurnya melengkung atau berbelok di titik singgah.
 * Menyentuh garis lalu kembali, berangkat dari garis, atau berhenti tepat
 * di garis **tidak** dihitung sebagai perlintasan.
 */
export function hitungXCounts(
  penjejak: PenjejakSet,
  id: string,
  garis: GarisAcuanLapangan[],
): XCount[] {
  const j = penjejak.jalur.get(id)
  if (!j || j.diam || garis.length === 0) return []
  const counts = penjejak.counts
  const N = Math.max(48, Math.min(720, Math.round(counts * 12)))
  const sampel: { x: number; y: number }[] = []
  for (let i = 0; i <= N; i++) sampel.push(penjejak.posisi(id, i / N)!)
  const EPS = 1e-6
  const hasil: XCount[] = []
  for (const gl of garis) {
    const nilai = (q: { x: number; y: number }) => (gl.sumbu === 'x' ? q.x : q.y) - gl.pos
    let tandaAkhir = 0
    let iAkhir = -1
    for (let i = 0; i <= N; i++) {
      const v = nilai(sampel[i])
      const tanda = Math.abs(v) < EPS ? 0 : v > 0 ? 1 : -1
      if (tanda === 0) continue
      if (tandaAkhir !== 0 && tanda !== tandaAkhir) {
        // Persempit antara cuplikan bertanda terakhir dan cuplikan ini.
        let lo = iAkhir / N
        let hi = i / N
        for (let k = 0; k < 24; k++) {
          const mid = (lo + hi) / 2
          const vm = nilai(penjejak.posisi(id, mid)!)
          const tm = Math.abs(vm) < EPS ? 0 : vm > 0 ? 1 : -1
          if (tm === tandaAkhir) lo = mid
          else hi = mid
        }
        hasil.push({
          label: gl.label,
          jenis: gl.jenis,
          sumbu: gl.sumbu,
          hitungan: Math.round(((lo + hi) / 2) * counts * 10) / 10,
        })
      }
      tandaAkhir = tanda
      iAkhir = i
    }
  }
  return hasil.sort((a, b) => a.hitungan - b.hitungan || a.label.localeCompare(b.label))
}

export interface TitikTengahPemain {
  x: number
  y: number
  /** Hitungan separuh set (mis. 4 dari 8, 3,5 dari 7). */
  hitungan: number
  koordinat: string
}

/** Posisi tepat pada 50% hitungan perpindahan (mengikuti tunda, Hold, & easing). */
export function titikTengahPemain(
  penjejak: PenjejakSet,
  id: string,
  f: FieldConfig,
): TitikTengahPemain | null {
  const j = penjejak.jalur.get(id)
  if (!j || j.diam) return null
  const pos = penjejak.posisi(id, 0.5)
  if (!pos) return null
  return {
    x: pos.x,
    y: pos.y,
    hitungan: Math.round((penjejak.counts / 2) * 10) / 10,
    koordinat: coordText(pos.x, pos.y, f),
  }
}

export interface InfoXCountPemain {
  xCounts: XCount[]
  tengah: TitikTengahPemain | null
  /** `xCount: YL45 S1 hit. 6 · FH hit. 3,5` (kosong bila tak melintasi apa pun). */
  teksXCount: string
  /** `Tengah [hit. 4]: S1 · YL45 +2 · FH +1.5` */
  teksTengah: string
}

/** Rangkum xCounts + titik tengah satu pemain pada perpindahan `dari → ke`. */
export function infoXCountPemain(opsi: {
  dari: DrillSet
  ke?: DrillSet
  anggota: Member[]
  memberId: string
  field: FieldConfig
  /** Batas jumlah perlintasan yang ditulis (sisanya diringkas "+n lagi"). */
  maks?: number
  penjejak?: PenjejakSet
}): InfoXCountPemain | null {
  if (!opsi.ke) return null
  const penjejak =
    opsi.penjejak ??
    buatPenjejakSet({ dari: opsi.dari, ke: opsi.ke, anggota: opsi.anggota, hanya: new Set([opsi.memberId]) })
  const j = penjejak.jalur.get(opsi.memberId)
  if (!j || j.diam) return null
  const xCounts = hitungXCounts(penjejak, opsi.memberId, daftarGarisAcuan(opsi.field))
  const tengah = titikTengahPemain(penjejak, opsi.memberId, opsi.field)
  const maks = opsi.maks ?? 6
  const tampil = xCounts.slice(0, maks).map((x) => `${x.label} hit. ${fmtHitungan(x.hitungan)}`)
  if (xCounts.length > maks) tampil.push(`+${xCounts.length - maks} lagi`)
  return {
    xCounts,
    tengah,
    teksXCount: tampil.length ? `xCount: ${tampil.join(' · ')}` : '',
    teksTengah: tengah ? `Tengah [hit. ${fmtHitungan(tengah.hitungan)}]: ${tengah.koordinat}` : '',
  }
}

/* ============================================================================
 * 2. Perspektif pemain 180°
 * ========================================================================== */

export const KUNCI_PERSPEKTIF_PEMAIN = 'drillkit_perspektif_pemain_v1'

export function bacaPerspektifPemain(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(KUNCI_PERSPEKTIF_PEMAIN) === '1'
  } catch {
    return false
  }
}

export function simpanPerspektifPemain(balik: boolean): void {
  try {
    localStorage.setItem(KUNCI_PERSPEKTIF_PEMAIN, balik ? '1' : '0')
  } catch {
    /* penyimpanan diblokir — abaikan */
  }
}

/**
 * Proyeksi koordinat internal ke SVG. `balik = true` memutar 180°: penonton
 * (front sideline) di ATAS, S1 di kanan — seperti dilihat pemain yang berdiri
 * di lapangan menghadap penonton. Koordinat tersimpan tidak berubah.
 */
export function proyeksiLapangan(f: FieldConfig, balik: boolean) {
  const halfW = f.widthYd / 2
  const halfL = (f.lengthYd + f.endZoneYd * 2) / 2
  return balik
    ? { sx: (x: number) => halfL + x, sy: (y: number) => halfW + y, arahHadap: -1 }
    : { sx: (x: number) => halfL - x, sy: (y: number) => halfW - y, arahHadap: 1 }
}

/** Panah arah jalan sesuai orientasi kertas (normal / perspektif pemain). */
export function panahArahPerspektif(dx: number, dy: number, balik: boolean): string {
  return balik ? panahArah(-dx, -dy) : panahArah(dx, dy)
}

/* ============================================================================
 * 3. Hole & Bayangan
 * ========================================================================== */

export function apakahIdHole(id: string): boolean {
  return id.startsWith('hole_')
}

/** Label hole berikutnya: H1, H2, … (mengisi nomor yang kosong lebih dulu). */
export function labelHoleBerikut(holes: SlotHole[] | undefined): string {
  const dipakai = new Set((holes ?? []).map((h) => h.label))
  for (let n = 1; n < 1000; n++) if (!dipakai.has(`H${n}`)) return `H${n}`
  return `H${(holes?.length ?? 0) + 1}`
}

/** Ganti id titik `lama` → `baru` di seluruh struktur set yang memakai id anggota. */
function gantiIdDiSet(s: DrillSet, lama: string, baru: string): Partial<DrillSet> {
  const patch: Partial<DrillSet> = {}
  const points = { ...s.points }
  points[baru] = points[lama]
  delete points[lama]
  patch.points = points
  if (s.midsets?.[lama]) {
    const m = { ...s.midsets }
    m[baru] = m[lama]
    delete m[lama]
    patch.midsets = m
  }
  if (s.langkah?.[lama]) {
    const l = { ...s.langkah }
    l[baru] = l[lama]
    delete l[lama]
    patch.langkah = l
  }
  if (s.bentukTerikat?.some((b) => b.memberIds.includes(lama))) {
    patch.bentukTerikat = s.bentukTerikat.map((b) =>
      b.memberIds.includes(lama) ? { ...b, memberIds: b.memberIds.map((id) => (id === lama ? baru : id)) } : b,
    )
  }
  const g = s.gerak
  if (g && (g.kelompok?.some((k) => k.memberIds.includes(lama)) || g.ripple?.urutan?.[lama] !== undefined)) {
    const gBaru = { ...g }
    if (g.kelompok) {
      gBaru.kelompok = g.kelompok.map((k) =>
        k.memberIds.includes(lama) ? { ...k, memberIds: k.memberIds.map((id) => (id === lama ? baru : id)) } : k,
      )
    }
    if (g.ripple?.urutan?.[lama] !== undefined) {
      const u = { ...g.ripple.urutan }
      u[baru] = u[lama]
      delete u[lama]
      gBaru.ripple = { ...g.ripple, urutan: u }
    }
    patch.gerak = gBaru
  }
  return patch
}

/**
 * "Jadikan Hole": posisi `memberId` mulai set ke-`dariIdx` (dan seterusnya
 * bila `sampaiAkhir`) diambil alih slot Hole baru, sehingga interval bentuk
 * `#22`, kelompok FTL, dan titik singgah tetap utuh walau pemainnya absen.
 */
export function jadikanHole(opsi: {
  drill: Pick<Drill, 'holes'>
  sets: DrillSet[]
  memberId: string
  dariIdx: number
  sampaiAkhir?: boolean
  alasan?: SlotHole['alasan']
  idBaru: string
}): { hole: SlotHole; patchSets: { id: string; patch: Partial<DrillSet> }[] } | null {
  const urut = [...opsi.sets].sort((a, b) => a.order - b.order)
  const target = urut.slice(opsi.dariIdx, opsi.sampaiAkhir === false ? opsi.dariIdx + 1 : undefined)
  const patchSets = target
    .filter((s) => s.points[opsi.memberId])
    .map((s) => ({ id: s.id, patch: gantiIdDiSet(s, opsi.memberId, opsi.idBaru) }))
  if (!patchSets.length) return null
  return {
    hole: {
      id: opsi.idBaru,
      label: labelHoleBerikut(opsi.drill.holes),
      alasan: opsi.alasan,
      memberIdAsal: opsi.memberId,
      createdAt: Date.now(),
    },
    patchSets,
  }
}

/**
 * "Isi Hole": pindahkan seluruh titik hole ke `memberId` pada set yang
 * belum memberi titik kepada pemain itu. Hole dihapus dari drill bila tak
 * tersisa lagi di set mana pun.
 */
export function isiHole(opsi: {
  drill: Pick<Drill, 'holes'>
  sets: DrillSet[]
  holeId: string
  memberId: string
}): { patchSets: { id: string; patch: Partial<DrillSet> }[]; holesBaru: SlotHole[]; dilewati: number } {
  let dilewati = 0
  const patchSets: { id: string; patch: Partial<DrillSet> }[] = []
  for (const s of opsi.sets) {
    if (!s.points[opsi.holeId]) continue
    if (s.points[opsi.memberId]) {
      dilewati++
      continue
    }
    patchSets.push({ id: s.id, patch: gantiIdDiSet(s, opsi.holeId, opsi.memberId) })
  }
  const holesBaru = dilewati > 0 ? [...(opsi.drill.holes ?? [])] : (opsi.drill.holes ?? []).filter((h) => h.id !== opsi.holeId)
  return { patchSets, holesBaru, dilewati }
}

/** Hapus hole beserta titiknya dari seluruh set (interval bentuk ikut dirapatkan oleh pemanggil). */
export function hapusHoleDariSet(s: DrillSet, holeId: string): Partial<DrillSet> | null {
  if (!s.points[holeId] && !s.bentukTerikat?.some((b) => b.memberIds.includes(holeId))) return null
  const points = { ...s.points }
  delete points[holeId]
  const patch: Partial<DrillSet> = { points }
  if (s.bentukTerikat?.some((b) => b.memberIds.includes(holeId))) {
    patch.bentukTerikat = s.bentukTerikat.map((b) => ({ ...b, memberIds: b.memberIds.filter((id) => id !== holeId) }))
  }
  if (s.midsets?.[holeId]) {
    const m = { ...s.midsets }
    delete m[holeId]
    patch.midsets = m
  }
  return patch
}

const ARAH_OFFSET: Record<NonNullable<BayanganAnggota['arahOffset']>, [number, number]> = {
  belakang: [0, 1],
  depan: [0, -1],
  s1: [1, 0],
  s2: [-1, 0],
}

export const LABEL_ARAH_OFFSET: Record<NonNullable<BayanganAnggota['arahOffset']>, string> = {
  belakang: 'ke belakang',
  depan: 'ke depan',
  s1: 'ke arah S1',
  s2: 'ke arah S2',
}

/** Titik turunan si bayangan dari titik induk. */
export function titikBayangan(b: BayanganAnggota, induk: DrillPoint, sYd: number): DrillPoint {
  if (b.mode === 'berbagi') return { ...induk }
  const [ux, uy] = ARAH_OFFSET[b.arahOffset ?? 'belakang']
  const jarak = Math.max(0.25, b.offsetLangkah ?? 1) * sYd
  return { ...induk, x: induk.x + ux * jarak, y: induk.y + uy * jarak }
}

/**
 * Sisipkan titik turunan pemain bayangan ke salinan set (hanya untuk tampilan
 * & cetak — tidak pernah ditulis ke basis data). Pemain yang punya titik
 * sendiri di suatu set tidak ditimpa. Titik singgah induk ikut digeser agar
 * jalurnya sejajar.
 */
export function terapkanBayangan(sets: DrillSet[], drill: Pick<Drill, 'bayangan' | 'field'>): DrillSet[] {
  const daftar = (drill.bayangan ?? []).filter((b) => b.memberId && b.indukId && b.memberId !== b.indukId)
  if (!daftar.length) return sets
  const sYd = stepYd(drill.field)
  return sets.map((s) => {
    let points: Record<string, DrillPoint> | null = null
    let midsets = s.midsets
    for (const b of daftar) {
      if (s.points[b.memberId]) continue
      const induk = s.points[b.indukId]
      if (!induk) continue
      if (!points) points = { ...s.points }
      const turunan = titikBayangan(b, induk, sYd)
      points[b.memberId] = turunan
      const midInduk = s.midsets?.[b.indukId]
      if (midInduk?.length) {
        const dx = turunan.x - induk.x
        const dy = turunan.y - induk.y
        midsets = { ...(midsets ?? {}), [b.memberId]: midInduk.map((w) => ({ ...w, x: w.x + dx, y: w.y + dy })) }
      }
    }
    return points ? { ...s, points, midsets } : s
  })
}

/** Keterangan status bayangan untuk pemain `memberId` (atau `null`). */
export function keteranganBayangan(
  drill: Pick<Drill, 'bayangan'>,
  memberId: string,
  anggota: Member[],
): string | null {
  const b = (drill.bayangan ?? []).find((x) => x.memberId === memberId)
  if (!b) return null
  const induk = anggota.find((m) => m.id === b.indukId)
  const kode = induk?.code || '?'
  if (b.mode === 'berbagi') return `Bayangan ${kode} — berbagi nomor & titik`
  const arah = LABEL_ARAH_OFFSET[b.arahOffset ?? 'belakang']
  return `Bayangan ${kode} — geser ${fmtHitungan(b.offsetLangkah ?? 1)} langkah ${arah}`
}

/* ============================================================================
 * 4. Dress / guiding
 * ========================================================================== */

export const LABEL_ACUAN_DRESS: Record<AcuanDress, string> = {
  kiri: 'Kiri',
  tengah: 'Tengah',
  kanan: 'Kanan',
  depan: 'Depan',
  belakang: 'Belakang',
  anggota: 'Pemandu',
}

export interface InfoDress {
  acuan: AcuanDress
  label: string
  pemanduId?: string
  pemanduKode?: string
  /** Pemain ini sendiri yang menjadi pemandu. */
  diriSendiri: boolean
  /** "Luruskan ke: Tengah (A05)" atau "Kamu pemandu dress (Kiri)". */
  teks: string
  /** Asal acuan: bentuk `#22` atau set. */
  dari: 'bentuk' | 'set'
}

/**
 * Tentukan pemandu dress bagi `memberId` pada `set`.
 *
 * Urutan: dress bentuk `#22` yang memuat pemain → dress set. Kelompok acuan =
 * anggota bentuk itu, atau (untuk dress set) rekan satu seksi yang ada di set.
 * Kiri/kanan dari sudut pandang pemain menghadap penonton: kiri = −x (S2).
 */
export function resolusiDress(set: DrillSet | undefined, memberId: string, anggota: Member[]): InfoDress | null {
  if (!set || !set.points[memberId]) return null
  const byId = new Map(anggota.map((m) => [m.id, m]))
  let dress: DressBarisan | undefined
  let kelompok: string[] = []
  let dari: InfoDress['dari'] = 'set'
  const bentuk: BentukTerikat | undefined = set.bentukTerikat?.find((b) => b.dress && b.memberIds.includes(memberId))
  if (bentuk?.dress) {
    dress = bentuk.dress
    kelompok = bentuk.memberIds
    dari = 'bentuk'
  } else if (set.dress) {
    dress = set.dress
    const seksi = byId.get(memberId)?.section
    kelompok = Object.keys(set.points).filter((id) => byId.get(id)?.section === seksi)
  }
  if (!dress) return null
  const calon = kelompok.filter((id) => !apakahIdHole(id) && set.points[id] && byId.has(id))
  let pemanduId: string | undefined
  if (dress.acuan === 'anggota') {
    pemanduId = dress.anggotaId && byId.has(dress.anggotaId) ? dress.anggotaId : undefined
  } else if (calon.length) {
    const pt = (id: string) => set.points[id]
    const pilih = (skor: (id: string) => number) =>
      calon.reduce((terbaik, id) => (skor(id) < skor(terbaik) - 1e-9 ? id : terbaik), calon[0])
    if (dress.acuan === 'kiri') pemanduId = pilih((id) => pt(id).x)
    else if (dress.acuan === 'kanan') pemanduId = pilih((id) => -pt(id).x)
    else if (dress.acuan === 'depan') pemanduId = pilih((id) => pt(id).y)
    else if (dress.acuan === 'belakang') pemanduId = pilih((id) => -pt(id).y)
    else {
      const cx = calon.reduce((a, id) => a + pt(id).x, 0) / calon.length
      const cy = calon.reduce((a, id) => a + pt(id).y, 0) / calon.length
      pemanduId = pilih((id) => Math.hypot(pt(id).x - cx, pt(id).y - cy))
    }
  }
  const label = LABEL_ACUAN_DRESS[dress.acuan]
  const pemanduKode = pemanduId ? byId.get(pemanduId)?.code : undefined
  const diriSendiri = pemanduId === memberId
  const teks = diriSendiri
    ? `Kamu pemandu dress (${label})`
    : `Luruskan ke: ${label}${pemanduKode ? ` (${pemanduKode})` : ''}`
  return { acuan: dress.acuan, label, pemanduId, pemanduKode, diriSendiri, teks, dari }
}
