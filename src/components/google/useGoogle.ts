/**
 * v2.10.1 — keadaan sambungan Google Drive untuk komponen: modul Google dimuat
 * malas, status sambungan & online dipantau, pustaka Google dimuat lebih awal
 * supaya ketukan "Sambungkan" bisa langsung membuka jendela izin.
 */
import { useEffect, useReducer, useState } from 'react'
import { useSettings } from '../../hooks/useSettings'
import { adaIzinGoogle } from './izinGoogle'

export { adaIzinGoogle }

type ModulGoogle = typeof import('../../lib/googleDrive')

export function useGoogle(opsi: { siapkan?: boolean } = {}) {
  const settings = useSettings()
  const [mod, setMod] = useState<ModulGoogle | null>(null)
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine !== false)
  const [, segarkan] = useReducer((x: number) => x + 1, 0)
  const siapkan = opsi.siapkan !== false

  useEffect(() => {
    let hidup = true
    void import('../../lib/googleDrive').then((m) => {
      if (!hidup) return
      setMod(m)
      if (siapkan && m.konfigGoogle(settings.google)) m.siapkan()
    })
    const naik = () => setOnline(true)
    const turun = () => setOnline(false)
    window.addEventListener('online', naik)
    window.addEventListener('offline', turun)
    window.addEventListener('drillkit-google', segarkan)
    // Izin habis sendiri sesudah ±1 jam; periksa tiap 30 detik.
    const t = window.setInterval(segarkan, 30_000)
    return () => {
      hidup = false
      window.removeEventListener('online', naik)
      window.removeEventListener('offline', turun)
      window.removeEventListener('drillkit-google', segarkan)
      window.clearInterval(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const konfig = mod?.konfigGoogle(settings.google) ?? null
  return {
    mod,
    konfig,
    online,
    tersambung: mod?.tersambung() ?? adaIzinGoogle(),
    habis: mod?.habisPada() ?? 0,
  }
}

/** "52 menit lagi" — sisa izin Google. */
export function sisaIzin(habis: number, sekarang = Date.now()): string {
  const m = Math.max(0, Math.round((habis - sekarang) / 60_000))
  return m >= 1 ? `${m} menit lagi` : 'kurang dari semenit'
}
