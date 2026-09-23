import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useToast } from '../components/ui'
import {
  aturKunciOtomatis,
  bacaKunciOtomatis,
  hasPin,
  installKioskGuard,
  isKiosk,
  setKiosk,
} from '../lib/kiosk'

/**
 * Penyedia status mode kios untuk seluruh aplikasi.
 *
 * Diletakkan di `App.tsx` (di dalam `ToastProvider`) supaya:
 * - penjaga global terpasang di mana pun pengguna berada, dan
 * - pesan "terkunci" bisa muncul sebagai toast.
 */
type KioskCtx = {
  /** Apakah data sedang dikunci (mode kios aktif). */
  locked: boolean
  /** Apakah pelatih sudah memasang PIN. */
  pinSet: boolean
  /** Aktifkan mode kios. */
  lock: () => void
  /** Matikan mode kios. */
  unlock: () => void
  /** Panggil setelah PIN diubah agar statusnya diperbarui. */
  refreshPin: () => void
  /** Kunci otomatis setelah sekian menit tanpa sentuhan. 0 = mati. */
  menitOtomatis: number
  /** Atur kunci otomatis. 0 mematikannya. */
  aturOtomatis: (menit: number) => void
}

const Ctx = createContext<KioskCtx>({
  locked: false,
  pinSet: false,
  lock: () => {},
  unlock: () => {},
  refreshPin: () => {},
  menitOtomatis: 0,
  aturOtomatis: () => {},
})

export function KioskProvider({ children }: { children: React.ReactNode }) {
  const toast = useToast()
  const [locked, setLocked] = useState(() => isKiosk())
  const [pinSet, setPinSet] = useState(() => hasPin())
  const [menitOtomatis, setMenitOtomatis] = useState(() => bacaKunciOtomatis())

  /** Didefinisikan di sini karena kunci otomatis di bawah juga memakainya. */
  const lock = useCallback(() => {
    setKiosk(true)
    setLocked(true)
  }, [])

  /**
   * Kunci otomatis setelah sekian menit tanpa satu pun sentuhan.
   *
   * Hanya jalan bila **PIN terpasang** dan pelatih **memilih waktunya** —
   * dua syarat yang sengaja. Tanpa PIN, kunci yang aktif tidak melindungi
   * apa pun karena siapa pun bisa membukanya lagi dengan satu tombol.
   *
   * Presenter dikecualikan: layar itu dipakai di tengah lapangan, dan
   * menguncinya di sana akan menghentikan latihan.
   */
  useEffect(() => {
    if (!pinSet || locked || menitOtomatis <= 0) return
    const presenterJalan = () => !!document.querySelector('[data-testid="presenter"]')
    if (presenterJalan()) return

    const acara = ['pointerdown', 'keydown', 'touchstart', 'wheel'] as const
    let tangan = 0
    const mulai = () => {
      window.clearTimeout(tangan)
      tangan = window.setTimeout(() => {
        // Periksa ulang: presenter bisa saja dibuka selama menunggu.
        if (presenterJalan()) return
        lock()
        toast.push(`Tidak disentuh ${menitOtomatis} menit — data dikunci otomatis`, 'info')
      }, menitOtomatis * 60_000)
    }
    acara.forEach((a) => window.addEventListener(a, mulai, { passive: true }))
    mulai()
    return () => {
      window.clearTimeout(tangan)
      acara.forEach((a) => window.removeEventListener(a, mulai))
    }
  }, [pinSet, locked, menitOtomatis, lock, toast])

  useEffect(() => {
    if (!locked) return
    return installKioskGuard(() =>
      toast.push('Terkunci — mode kios aktif. Buka kunci dulu untuk mengubah data.', 'info'),
    )
  }, [locked, toast])

  const value = useMemo<KioskCtx>(
    () => ({
      locked,
      pinSet,
      lock,
      unlock: () => {
        setKiosk(false)
        setLocked(false)
      },
      refreshPin: () => setPinSet(hasPin()),
      menitOtomatis,
      aturOtomatis: (menit: number) => {
        aturKunciOtomatis(menit)
        setMenitOtomatis(menit > 0 ? Math.round(menit) : 0)
      },
    }),
    [locked, pinSet, menitOtomatis, lock],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

/** Pakai status mode kios dari komponen mana pun. */
export function useKiosk() {
  return useContext(Ctx)
}
