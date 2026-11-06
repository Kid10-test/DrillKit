import { useEffect, useRef, useState } from 'react'

/**
 * Kamera + `BarcodeDetector` yang dipakai bersama oleh **Scan QR beruntun**
 * (absensi) dan **Terima lewat QR** (#30 estafet berkas) — satu loop kamera
 * untuk seluruh aplikasi.
 *
 * Kamera **tidak** mati-nyala saat data baru masuk: pemanggil memberi
 * `onKode` lewat ref, jadi efek hanya berjalan ulang saat dibuka/ditutup atau
 * kamera dibalik (menyalakan kamera butuh 1–2 detik).
 */
export type GalatKamera = '' | 'kamera' | 'detektor'

interface Detektor {
  detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]>
}
type KonstruktorDetektor = new (o?: { formats: string[] }) => Detektor

/** Peramban ini punya pemindai QR bawaan (`BarcodeDetector`)? */
export function adaPemindaiBawaan(): boolean {
  return typeof (window as unknown as { BarcodeDetector?: unknown }).BarcodeDetector === 'function'
}

export function useKameraQr({
  aktif,
  facing,
  onKode,
  jedaMs = 120,
  semuaKode = false,
}: {
  aktif: boolean
  facing: 'environment' | 'user'
  /** dipanggil untuk tiap kode yang terbaca (tanpa saring dobel) */
  onKode: (raw: string) => void
  /** jarak minimal antar pembacaan (ms) */
  jedaMs?: number
  /** teruskan SEMUA kode dalam satu tangkapan (bukan hanya yang pertama) */
  semuaKode?: boolean
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [galat, setGalat] = useState<GalatKamera>('')
  const onKodeRef = useRef(onKode)
  onKodeRef.current = onKode

  useEffect(() => {
    if (!aktif) return
    let batal = false
    let stream: MediaStream | undefined
    let raf = 0
    let sibuk = false
    let terakhir = 0
    setGalat('')

    function beres() {
      cancelAnimationFrame(raf)
      stream?.getTracks().forEach((t) => t.stop())
      stream = undefined
      if (videoRef.current) videoRef.current.srcObject = null
    }

    async function mulai() {
      // 1. Nyalakan kamera. Kalau kamera belakang tidak ada, coba apa saja.
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing } })
      } catch {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: true })
        } catch {
          setGalat('kamera')
          return
        }
      }
      if (batal) return beres()
      const video = videoRef.current
      if (!video) return beres()
      video.srcObject = stream
      await video.play().catch(() => undefined)

      // 2. Pemindaian otomatis butuh BarcodeDetector.
      const BD = (window as unknown as { BarcodeDetector?: KonstruktorDetektor }).BarcodeDetector
      if (!BD) {
        setGalat('detektor')
        return
      }

      // 3. Loop pemindaian — kamera tetap menyala sampai ditutup.
      const detektor = new BD({ formats: ['qr_code'] })
      const tick = (t: number) => {
        if (batal) return
        raf = requestAnimationFrame(tick)
        const v = videoRef.current
        if (sibuk || !v || v.readyState < 2) return
        if (t - terakhir < jedaMs) return
        terakhir = t
        sibuk = true
        detektor
          .detect(v)
          .then((kode) => {
            if (batal) return
            if (semuaKode) for (const k of kode) k.rawValue && onKodeRef.current(k.rawValue)
            else if (kode[0]?.rawValue) onKodeRef.current(kode[0].rawValue)
          })
          .catch(() => undefined)
          .finally(() => {
            sibuk = false
          })
      }
      raf = requestAnimationFrame(tick)
    }

    void mulai()
    return () => {
      batal = true
      beres()
    }
  }, [aktif, facing, jedaMs, semuaKode])

  return { videoRef, galat }
}
