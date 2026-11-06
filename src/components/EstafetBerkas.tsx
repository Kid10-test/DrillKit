/**
 * #30 — Tombol kirim/terima berkas TANPA unduh-cari-kirim:
 *
 *  - **Bagikan langsung** — lembar berbagi OS (`navigator.share({files})`):
 *    Quick Share, AirDrop, WhatsApp… Hanya tampil bila didukung.
 *  - **Kirim lewat QR** — estafet QR berantai, tanpa sinyal sama sekali.
 *  - **Terima lewat QR** — kamera merakit berkas lalu membukanya lewat
 *    Pintu #7 (pratinjau), atau penangan khusus (mis. paket anggota).
 *
 * Komponen ringan: `qrcode` dan logika kamera hanya dimuat saat modal dibuka.
 */
import { Suspense, lazy, useState } from 'react'
import { Button, useToast } from './ui'
import { IconQr, IconShare } from './Icons'
import { bagikanBerkas, bisaBagikanBerkas } from '../lib/bagikanBerkas'
import { kenaliFile, mintaPratinjau } from './BukaBerkas'

const KirimEstafetQr = lazy(() => import('./estafet/KirimEstafetQr'))
const TerimaEstafetQr = lazy(() => import('./estafet/TerimaEstafetQr'))

/** Berkas yang siap dikirim — sama persis dengan yang akan diunduh. */
export interface BerkasSiapKirim {
  nama: string
  isi: string | Uint8Array
  mime?: string
}

export function AksiKirimBerkas({
  siapkan,
  judul,
  testId,
  qr = true,
  bagikan = true,
  peringatanQr,
  onTerkirim,
  size = 'sm',
}: {
  /** null = batal (mis. belum ada yang dipilih) */
  siapkan: () => Promise<BerkasSiapKirim | null> | BerkasSiapKirim | null
  judul: string
  testId: string
  qr?: boolean
  bagikan?: boolean
  peringatanQr?: string
  /** dipanggil setelah berkas dibagikan / mulai ditayangkan sebagai QR */
  onTerkirim?: (cara: 'bagikan' | 'qr') => void
  size?: 'sm' | 'md'
}) {
  const toast = useToast()
  const [modalQr, setModalQr] = useState(false)
  const bisaBagi = bagikan && bisaBagikanBerkas()
  if (!bisaBagi && !qr) return null

  async function bagikanSekarang() {
    const b = await siapkan()
    if (!b) return
    const h = await bagikanBerkas({ ...b, judul })
    if (h === 'dibagikan') {
      toast.push('Berkas dibagikan')
      onTerkirim?.('bagikan')
    } else if (h === 'tak-didukung') toast.push('Perangkat ini tidak bisa membagikan berkas — pakai Unduh', 'err')
    else if (h === 'gagal') toast.push('Gagal membagikan berkas', 'err')
  }

  return (
    <>
      {bisaBagi && (
        <Button size={size} variant="outline" data-testid={`${testId}-bagikan`} onClick={() => void bagikanSekarang()}
          title="Kirim lewat Quick Share, AirDrop, WhatsApp, dll. tanpa mencari berkas unduhan">
          <IconShare size={14} /> Bagikan langsung
        </Button>
      )}
      {qr && (
        <Button size={size} variant="outline" data-testid={`${testId}-qr`} onClick={() => setModalQr(true)}
          title="Tayangkan QR berantai — HP lain memindai tanpa sinyal">
          <IconQr size={14} /> Kirim lewat QR
        </Button>
      )}
      {modalQr && (
        <Suspense fallback={null}>
          <KirimEstafetQr
            judul={judul}
            peringatan={peringatanQr}
            siapkan={async () => siapkan()}
            onTutup={() => setModalQr(false)}
            onDitayangkan={() => onTerkirim?.('qr')}
          />
        </Suspense>
      )}
    </>
  )
}

/** Buka berkas hasil estafet lewat Pintu #7 (pratinjau sesuai jenis & mode). */
async function bukaLewatPintu(file: File) {
  const { hasil, bita } = await kenaliFile(file)
  mintaPratinjau(hasil, bita)
}

export function TombolTerimaQr({
  label = 'Terima lewat QR',
  testId = 'terima-qr',
  variant = 'outline',
  onBerkas,
  petunjuk,
}: {
  label?: string
  testId?: string
  variant?: 'outline' | 'ghost' | 'primary'
  onBerkas?: (file: File) => Promise<void> | void
  petunjuk?: string
}) {
  const toast = useToast()
  const [buka, setBuka] = useState(false)
  return (
    <>
      <Button variant={variant} data-testid={testId} onClick={() => setBuka(true)}
        title="Terima berkas dari HP lain lewat QR berantai — tanpa sinyal">
        <IconQr size={16} /> {label}
      </Button>
      {buka && (
        <Suspense fallback={null}>
          <TerimaEstafetQr
            petunjuk={petunjuk}
            onTutup={() => setBuka(false)}
            onBerkas={async (f) => {
              try {
                await (onBerkas ?? bukaLewatPintu)(f)
              } catch {
                toast.push('Berkas tidak bisa dibaca', 'err')
              }
            }}
          />
        </Suspense>
      )}
    </>
  )
}
