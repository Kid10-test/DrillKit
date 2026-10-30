/**
 * #16.4 — Properti Bergerak (Moving Props) & Tata Letak Pit per Set.
 *
 * Memperluas `FieldMarker` (`A7`) secara kompatibel mundur:
 * - Penanda lama tanpa `perSet` maupun `rotasi` tampil statis di seluruh set
 *   persis seperti sebelumnya.
 * - Penanda dengan `perSet[setId]` memiliki posisi & sudut rotasi per set:
 *   set yang belum diberi keyframe mewarisi posisi set terdekat sebelumnya
 *   (atau kembali ke posisi dasar `marker.x, marker.y, marker.rotasi`), dan
 *   selama animasi berpindah antar set (`progres` 0..1) posisi & rotasinya
 *   diinterpolasi secara mulus.
 */
import type { DrillSet, FieldMarker, Member, PosisiPenandaSet } from '../db/types'

/** Interpolasi sudut terpendek dalam derajat (-180..180) agar properti tidak berputar 350° keliru. */
export function lerpsudutDerajat(dari: number, ke: number, t: number): number {
  const selisih = ((((ke - dari) % 360) + 540) % 360) - 180
  return dari + selisih * t
}

/** Ambil posisi & rotasi efektif sebuah penanda pada indeks set `idxSet` (0-based). */
export function posisiPenandaPadaIndeksSet(
  marker: FieldMarker,
  sets: Pick<DrillSet, 'id'>[],
  idxSet: number,
): Required<Pick<PosisiPenandaSet, 'x' | 'y' | 'rotasi'>> & Pick<PosisiPenandaSet, 'x2' | 'y2'> {
  const dasar = {
    x: marker.x,
    y: marker.y,
    x2: marker.x2,
    y2: marker.y2,
    rotasi: marker.rotasi ?? 0,
  }
  if (!marker.perSet || !sets.length || idxSet < 0) return dasar

  const batas = Math.min(idxSet, sets.length - 1)
  for (let i = batas; i >= 0; i--) {
    const kf = marker.perSet[sets[i].id]
    if (kf) {
      return {
        x: kf.x,
        y: kf.y,
        x2: kf.x2 ?? dasar.x2,
        y2: kf.y2 ?? dasar.y2,
        rotasi: kf.rotasi ?? dasar.rotasi,
      }
    }
  }
  return dasar
}

/**
 * Hitung daftar `FieldMarker` yang sudah diinterpolasi untuk set `idxSet`
 * pada `progres` animasi `0..1` menuju `idxSet + 1`.
 */
export function penandaEfektifPadaSet(
  markers: FieldMarker[] | undefined,
  sets: Pick<DrillSet, 'id'>[],
  idxSet: number,
  progres = 0,
): FieldMarker[] {
  if (!markers?.length) return []
  const p = Math.min(1, Math.max(0, progres))
  const adaSetBerikut = idxSet >= 0 && idxSet + 1 < sets.length

  return markers.map((m) => {
    const awal = posisiPenandaPadaIndeksSet(m, sets, idxSet)
    if (p <= 0 || !adaSetBerikut || !m.perSet) {
      return {
        ...m,
        x: awal.x,
        y: awal.y,
        x2: awal.x2,
        y2: awal.y2,
        rotasi: awal.rotasi,
      }
    }
    const akhir = posisiPenandaPadaIndeksSet(m, sets, idxSet + 1)
    const lerp = (a: number, b: number) => a + (b - a) * p
    return {
      ...m,
      x: lerp(awal.x, akhir.x),
      y: lerp(awal.y, akhir.y),
      x2: awal.x2 != null && akhir.x2 != null ? lerp(awal.x2, akhir.x2) : awal.x2,
      y2: awal.y2 != null && akhir.y2 != null ? lerp(awal.y2, akhir.y2) : awal.y2,
      rotasi: lerpsudutDerajat(awal.rotasi, akhir.rotasi, p),
    }
  })
}

/** Apakah penanda ini adalah properti bergerak (punya >= 1 keyframe set)? */
export function apakahPropertiBergerak(marker: FieldMarker): boolean {
  return Boolean(marker.perSet && Object.keys(marker.perSet).length > 0)
}

/** Daftar properti tempat seorang anggota ditugaskan sebagai kru pendorong. */
export function tugasKruPropertiAnggota(
  markers: FieldMarker[] | undefined,
  memberId: string,
): FieldMarker[] {
  if (!markers?.length || !memberId) return []
  return markers.filter((m) => m.kruIds?.includes(memberId))
}

/** Ringkas nama kru pendorong sebuah properti untuk label cetak / UI. */
export function ringkasKruProperti(
  marker: FieldMarker,
  rosterById: Map<string, Pick<Member, 'code' | 'name'>>,
): string {
  if (!marker.kruIds?.length) return ''
  return marker.kruIds
    .map((id) => {
      const m = rosterById.get(id)
      return m ? m.code || m.name : id
    })
    .join(', ')
}
