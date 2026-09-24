import { useState } from 'react'
import { bacaMode } from '../lib/modePerangkat'

/**
 * 'member' kalau perangkat ini memilih mode anggota.
 *
 * Dulu hook ini hidup di `src/pages/Share.tsx`, sehingga `Layout` (yang
 * eager — membungkus semua halaman) menarik seluruh halaman Berbagi +
 * Musik ke bundel awal. Pindah ke sini (#5): tidak ada lagi impor
 * halaman-dari-komponen-cangkang, dan tiap rute bisa dimuat malas.
 */
export function useMemberMode(): 'coach' | 'member' {
  const [mode] = useState<'coach' | 'member'>(bacaMode)
  return mode
}
