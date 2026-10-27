/**
 * #11d — Frasa latihan per lagu per perangkat, dibagi antarkomponen & antartab.
 *
 * Mengikuti pola `useTempoLatihan` (#4): disimpan di `localStorage`
 * (`drillkit_frasa_latihan_v1`) supaya latihan seorang anggota/pelatih di satu
 * perangkat tidak menimpa repertoar yang dibagikan dan tidak hilang saat
 * memperbarui paket show, sambil tetap menyatu mulus dengan M2 `song.ulangBagian`.
 */
import { useCallback, useEffect, useState } from 'react'
import type { UlangBagian } from '../db/types'
import {
  KUNCI_SIMPAN_FRASA,
  TANPA_LAGU_FRASA,
  bacaSemuaFrasa,
  frasaEfektifUntukLagu,
  rapikanFrasaLatihan,
  tulisSemuaFrasa,
  type FrasaLatihan,
  type PetaFrasaLatihan,
} from '../lib/partiturFrasa'

const EVENT_FRASA = 'drillkit:frasa-latihan'

export function useFrasaLatihan() {
  const [peta, setPeta] = useState<PetaFrasaLatihan>(() => bacaSemuaFrasa())

  useEffect(() => {
    const segarkan = () => setPeta(bacaSemuaFrasa())
    const dariTabLain = (e: StorageEvent) => {
      if (e.key === KUNCI_SIMPAN_FRASA) segarkan()
    }
    window.addEventListener(EVENT_FRASA, segarkan)
    window.addEventListener('storage', dariTabLain)
    return () => {
      window.removeEventListener(EVENT_FRASA, segarkan)
      window.removeEventListener('storage', dariTabLain)
    }
  }, [])

  const tulis = useCallback((ubah: (lama: PetaFrasaLatihan) => PetaFrasaLatihan) => {
    const baru = ubah(bacaSemuaFrasa())
    tulisSemuaFrasa(baru)
    setPeta(bacaSemuaFrasa())
    window.dispatchEvent(new Event(EVENT_FRASA))
  }, [])

  const aturFrasa = useCallback(
    (
      songId: string | null | undefined,
      patch: Partial<FrasaLatihan>,
      cadanganLagu?: UlangBagian | null,
    ) =>
      tulis((lama) => {
        const id = songId || TANPA_LAGU_FRASA
        const dasar =
          lama[id] ??
          (cadanganLagu
            ? rapikanFrasaLatihan({
                dari: cadanganLagu.dari,
                sampai: cadanganLagu.sampai,
                aktif: cadanganLagu.aktif,
              })
            : { dari: 1, sampai: 4, aktif: 0 as const })
        return {
          ...lama,
          [id]: rapikanFrasaLatihan({ ...dasar, ...patch }),
        }
      }),
    [tulis],
  )

  const hapusFrasa = useCallback(
    (songId: string | null | undefined) =>
      tulis((lama) => {
        const id = songId || TANPA_LAGU_FRASA
        if (!(id in lama)) return lama
        const salinan = { ...lama }
        delete salinan[id]
        return salinan
      }),
    [tulis],
  )

  return {
    peta,
    frasaUntuk: (
      songId: string | null | undefined,
      ulangBagianLagu?: UlangBagian | null,
    ): FrasaLatihan | null => frasaEfektifUntukLagu(peta, songId, ulangBagianLagu),
    aturFrasa,
    hapusFrasa,
  }
}
