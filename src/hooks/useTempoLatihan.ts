/**
 * #4 — tempo latihan per lagu per perangkat, dibagi antar komponen.
 *
 * Halaman Musik, editor drill, dan presenter bisa terbuka bersamaan; begitu
 * satu mengubah tempo latihan, yang lain ikut tahu lewat event kecil ini
 * (dan lewat event `storage` untuk tab lain).
 */
import { useCallback, useEffect, useState } from 'react'
import {
  KUNCI_SIMPAN,
  NAIK_BAWAAN,
  TANPA_LAGU,
  TEMPO_ASLI,
  bacaSemua,
  rapikanNaik,
  rapikanTempo,
  semuaAsli,
  tulisSemua,
} from '../lib/tempoLatihan'
import type { NaikOtomatis, PetaLatihan, TempoLatihan } from '../lib/tempoLatihan'

const EVENT = 'drillkit:tempo-latihan'

export function useTempoLatihan() {
  const [peta, setPeta] = useState<PetaLatihan>(() => bacaSemua())

  useEffect(() => {
    const segarkan = () => setPeta(bacaSemua())
    const dariTabLain = (e: StorageEvent) => {
      if (e.key === KUNCI_SIMPAN) segarkan()
    }
    window.addEventListener(EVENT, segarkan)
    window.addEventListener('storage', dariTabLain)
    return () => {
      window.removeEventListener(EVENT, segarkan)
      window.removeEventListener('storage', dariTabLain)
    }
  }, [])

  const tulis = useCallback((ubah: (p: PetaLatihan) => PetaLatihan) => {
    const baru = ubah(bacaSemua())
    tulisSemua(baru)
    setPeta(bacaSemua())
    window.dispatchEvent(new Event(EVENT))
  }, [])

  const aturTempo = useCallback(
    (songId: string | null | undefined, t: TempoLatihan) =>
      tulis((p) => {
        const id = songId || TANPA_LAGU
        return { ...p, [id]: { ...p[id], tempo: rapikanTempo(t) } }
      }),
    [tulis],
  )

  const aturNaik = useCallback(
    (songId: string | null | undefined, n: NaikOtomatis) =>
      tulis((p) => {
        const id = songId || TANPA_LAGU
        return { ...p, [id]: { tempo: p[id]?.tempo ?? TEMPO_ASLI, naik: rapikanNaik(n) } }
      }),
    [tulis],
  )

  const keAsli = useCallback((ids?: string[]) => tulis((p) => semuaAsli(p, ids)), [tulis])

  return {
    peta,
    tempoUntuk: (songId: string | null | undefined): TempoLatihan => peta[songId || TANPA_LAGU]?.tempo ?? TEMPO_ASLI,
    naikUntuk: (songId: string | null | undefined): NaikOtomatis => peta[songId || TANPA_LAGU]?.naik ?? NAIK_BAWAAN,
    aturTempo,
    aturNaik,
    keAsli,
  }
}
