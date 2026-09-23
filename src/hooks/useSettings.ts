import { useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { defaultSettings, ensureSettings, getSettings } from '../db/db'
import type { TeamSettings } from '../db/types'

/** Dipakai sebelum pengaturan tersedia — identitasnya stabil agar tidak memicu render ulang. */
const FALLBACK = defaultSettings()

/**
 * Pengaturan tim, reaktif terhadap perubahan di IndexedDB.
 * Tidak pernah `undefined`: kalau belum ada, kembalikan nilai bawaan.
 */
export function useSettings(): TeamSettings {
  const s = useLiveQuery(() => getSettings(), [], undefined)
  return s ?? FALLBACK
}

/** Panggil sekali di root aplikasi untuk membuat pengaturan bawaan bila perlu. */
export function useBootstrap() {
  useEffect(() => {
    ensureSettings().catch(() => undefined)
  }, [])
}
