/**
 * #30 — Penerima estafet QR (dimuat malas).
 *
 * Kamera membaca bingkai dalam urutan apa pun; begitu lengkap, berkas dirakit
 * dan diserahkan ke `onBerkas` — biasanya Pintu #7 (`kenaliFile` →
 * pratinjau), jadi aturan mode & privasi berlaku sama seperti berkas unduhan.
 */
import { useRef, useState } from 'react'
import { Button, Modal, useToast } from '../ui'
import { beep, buzz } from '../../lib/feedback'
import {
  bingkaiKurang,
  formatUkuran,
  lengkap,
  penampungBaru,
  persenEstafet,
  rakitEstafet,
  tampung,
  type PenampungEstafet,
} from '../../lib/estafetQr'
import { useKameraQr } from '../useKameraQr'

export default function TerimaEstafetQr({
  onBerkas,
  onTutup,
  petunjuk,
}: {
  onBerkas: (file: File) => Promise<void> | void
  onTutup: () => void
  petunjuk?: string
}) {
  const toast = useToast()
  const [facing, setFacing] = useState<'environment' | 'user'>('environment')
  const [p, setP] = useState<PenampungEstafet>(penampungBaru)
  const [status, setStatus] = useState<'pindai' | 'merakit' | 'selesai'>('pindai')
  const [galat, setGalat] = useState('')
  const [bukanEstafet, setBukanEstafet] = useState(0)
  const pRef = useRef(p)
  const statusRef = useRef(status)
  statusRef.current = status

  async function rakit(akhir: PenampungEstafet) {
    setStatus('merakit')
    const h = await rakitEstafet(akhir)
    if (!h.ok) {
      setGalat(h.alasan)
      ulangi()
      return
    }
    beep('ok')
    buzz('ok')
    setStatus('selesai')
    const file = new File([new Uint8Array(h.isi)], h.nama, h.mime ? { type: h.mime } : undefined)
    toast.push(`Diterima lewat QR: ${h.nama} (${formatUkuran(h.isi.byteLength)})`)
    try {
      await onBerkas(file)
    } finally {
      onTutup()
    }
  }

  function terima(raw: string) {
    if (statusRef.current !== 'pindai') return
    const { p: baru, hasil } = tampung(pRef.current, raw)
    if (hasil === 'bukan') {
      setBukanEstafet((n) => n + 1)
      return
    }
    if (baru === pRef.current) return
    pRef.current = baru
    setP(baru)
    if (hasil === 'baru') {
      setGalat('')
      if (lengkap(baru)) void rakit(baru)
    }
  }

  function ulangi() {
    pRef.current = penampungBaru()
    setP(pRef.current)
    setBukanEstafet(0)
    setStatus('pindai')
  }

  const { videoRef, galat: galatKamera } = useKameraQr({
    aktif: status === 'pindai',
    facing,
    onKode: terima,
    jedaMs: 90,
    semuaKode: true,
  })

  const persen = persenEstafet(p)
  const kurang = p.jumlah ? bingkaiKurang(p) : []

  return (
    <Modal
      open
      onClose={onTutup}
      title="Terima lewat QR (tanpa sinyal)"
      testId="modal-terima-qr"
      footer={
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" data-testid="terima-qr-ulangi" onClick={ulangi} disabled={status !== 'pindai'}>
            Ulangi
          </Button>
          <Button variant="ghost" data-testid="terima-qr-tutup" onClick={onTutup}>
            Tutup
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <p className="text-xs text-slate-400">
          {petunjuk ??
            'Arahkan kamera ke QR yang berputar di HP pengirim. Urutan bebas — tunggu sampai semua kotak terisi.'}
        </p>

        {galatKamera === 'detektor' && (
          <p
            data-testid="terima-qr-tak-didukung"
            className="rounded-lg px-3 py-2 text-sm"
            style={{ backgroundColor: '#422006', color: '#fde68a' }}
          >
            HP/peramban ini belum punya pemindai QR bawaan. Pakai Chrome atau Edge di Android untuk menerima — atau minta
            pengirim memakai <b>Bagikan langsung</b> / mengunduh berkasnya.
          </p>
        )}
        {galatKamera === 'kamera' && (
          <p className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#450a0a', color: '#fecaca' }}>
            Kamera tidak tersedia atau izinnya ditolak.
          </p>
        )}

        <div className="relative overflow-hidden rounded-xl" style={{ backgroundColor: '#000000' }}>
          <video ref={videoRef} className="h-56 w-full object-cover sm:h-64" playsInline muted autoPlay />
          {status === 'merakit' && (
            <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold" style={{ backgroundColor: 'rgba(0,0,0,0.6)', color: '#ffffff' }}>
              Merakit berkas…
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="h-2 w-full overflow-hidden rounded-full" style={{ backgroundColor: '#1e293b' }}>
            <div className="h-full transition-all" style={{ width: `${persen}%`, backgroundColor: '#10b981' }} />
          </div>
          <p className="text-xs text-slate-300" data-testid="terima-qr-status" data-diterima={p.diterima} data-jumlah={p.jumlah}>
            {p.jumlah
              ? `${p.diterima}/${p.jumlah} bingkai (${persen}%) · sesi ${p.sesi}`
              : 'Menunggu bingkai pertama…'}
            {p.rusak > 0 && ` · ${p.rusak} bingkai buram dibuang`}
            {p.asing > 0 && ` · ${p.asing} dari kiriman lain diabaikan`}
          </p>
          {p.asing > 0 && (
            <p className="text-xs" data-testid="terima-qr-saran-ulangi" style={{ color: '#fbbf24' }}>
              Ada kiriman lain di depan kamera. Kalau memang ingin menerima yang itu, tekan <b>Ulangi</b>.
            </p>
          )}
          {bukanEstafet > 0 && p.diterima === 0 && (
            <p className="text-xs" style={{ color: '#fbbf24' }}>
              Itu QR lain (bukan estafet DrillKit). Di HP pengirim pilih "Kirim lewat QR".
            </p>
          )}
          {p.jumlah > 0 && (
            <div className="flex flex-wrap gap-[3px]" data-testid="terima-qr-kisi" aria-label="Bingkai yang sudah diterima">
              {Array.from({ length: p.jumlah }, (_, i) => (
                <span
                  key={i}
                  className="h-2.5 w-2.5 rounded-sm"
                  style={{ backgroundColor: p.potongan[i] ? '#10b981' : '#334155' }}
                />
              ))}
            </div>
          )}
          {p.jumlah > 0 && kurang.length > 0 && kurang.length <= 5 && (
            <p className="text-xs text-slate-400">Tinggal bingkai {kurang.map((i) => i + 1).join(', ')} — tunggu putaran berikutnya.</p>
          )}
        </div>

        {galat && (
          <p data-testid="terima-qr-galat" className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#450a0a', color: '#fecaca' }}>
            {galat}
          </p>
        )}

        <Button size="sm" variant="ghost" onClick={() => setFacing((f) => (f === 'environment' ? 'user' : 'environment'))}>
          Balik kamera
        </Button>
      </div>
    </Modal>
  )
}
