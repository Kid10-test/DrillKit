import { useEffect, useState } from 'react'
import { bacaModeNama, langgananModeNama, namaTampil, type ModeNama } from '../lib/namaAnggota'

/** Mode nama yang dipilih di perangkat ini. Berubah di mana pun pengaturannya diubah. */
export function useModeNama(): ModeNama {
  const [mode, setMode] = useState<ModeNama>(bacaModeNama)
  useEffect(() => langgananModeNama(setMode), [])
  return mode
}

/** Nama anggota sesuai pengaturan perangkat. Panggilan kosong tetap nama lengkap. */
export function NamaTampil({
  anggota,
  className,
}: {
  anggota: { name: string; panggilan?: string }
  className?: string
}) {
  const mode = useModeNama()
  return <span className={className}>{namaTampil(anggota, mode)}</span>
}
