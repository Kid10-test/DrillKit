import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { DEFAULT_SECTIONS } from '../lib/utils'
import { useSettings } from './useSettings'

export interface SeksiAktif {
  id: string
  label: string
  short: string
  dot: string
  /** Jumlah anggota aktif di seksi ini. */
  anggota: number
}

/**
 * #35 — seksi yang benar-benar dipakai tim: seksi tampak yang punya anggota
 * aktif. Tim tanpa anggota memakai semua seksi tampak, supaya pola & neraca
 * tetap bisa disusun sebelum daftar anggota masuk.
 */
export function useSeksiAktif(): SeksiAktif[] {
  const settings = useSettings()
  const hitung = useLiveQuery(
    async () => {
      const m = await db.members.where('active').equals(1).toArray()
      const c: Record<string, number> = {}
      for (const x of m) c[x.section] = (c[x.section] ?? 0) + 1
      return c
    },
    [],
    {} as Record<string, number>,
  )
  return useMemo(() => {
    const semua = (settings.sections?.length ? settings.sections : DEFAULT_SECTIONS).filter((s) => !s.hidden)
    const berisi = semua.filter((s) => (hitung[s.id] ?? 0) > 0)
    return (berisi.length ? berisi : semua).map((s) => ({
      id: s.id,
      label: s.label,
      short: s.short,
      dot: s.dot,
      anggota: hitung[s.id] ?? 0,
    }))
  }, [settings.sections, hitung])
}
