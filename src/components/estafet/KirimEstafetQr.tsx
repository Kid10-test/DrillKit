/**
 * #30 — Pengirim estafet QR (dimuat malas; membawa pustaka `qrcode`).
 *
 * Menayangkan deret QR berputar 2–4 fps sampai HP penerima mengumpulkan
 * semua bingkai. Tidak butuh sinyal, Bluetooth, atau kabel — cukup layar.
 */
import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { Button, Modal } from '../ui'
import { IconPause, IconPlay } from '../Icons'
import {
  PILIHAN_FPS,
  SARAN_BINGKAI,
  UKURAN_BINGKAI,
  detikPutaran,
  formatUkuran,
  kemasEstafet,
  type KirimanEstafet,
  type UkuranBingkai,
} from '../../lib/estafetQr'
import type { BerkasSiapKirim } from '../EstafetBerkas'

const enc = new TextEncoder()

interface PenguncianLayar {
  release: () => Promise<void>
}

export default function KirimEstafetQr({
  judul,
  siapkan,
  peringatan,
  onTutup,
  onDitayangkan,
}: {
  judul: string
  siapkan: () => Promise<BerkasSiapKirim | null>
  /** catatan privasi/peruntukan di atas QR */
  peringatan?: string
  onTutup: () => void
  /** dipanggil sekali saat bingkai pertama tampil */
  onDitayangkan?: () => void
}) {
  const [berkas, setBerkas] = useState<{ nama: string; isi: Uint8Array; mime?: string } | null>(null)
  const [ukuran, setUkuran] = useState<UkuranBingkai>('besar')
  const [fps, setFps] = useState<number>(3)
  const [kiriman, setKiriman] = useState<KirimanEstafet | null>(null)
  const [galat, setGalat] = useState('')
  const [jalan, setJalan] = useState(true)
  const [ke, setKe] = useState(0)
  const [putaran, setPutaran] = useState(1)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sudahLapor = useRef(false)

  // 1. Siapkan isi berkas sekali.
  useEffect(() => {
    let batal = false
    void siapkan()
      .then((b) => {
        if (batal) return
        if (!b) return setGalat('Tidak ada yang dikirim.')
        setBerkas({ nama: b.nama, isi: typeof b.isi === 'string' ? enc.encode(b.isi) : b.isi, mime: b.mime })
      })
      .catch(() => !batal && setGalat('Berkas gagal disiapkan.'))
    return () => {
      batal = true
    }
    // siapkan sengaja hanya dibaca saat modal dibuka
  }, [])

  // 2. Kemas ulang saat ukuran bingkai berubah.
  useEffect(() => {
    if (!berkas) return
    let batal = false
    setKiriman(null)
    void kemasEstafet(berkas.nama, berkas.isi, { ukuranBingkai: UKURAN_BINGKAI[ukuran], mime: berkas.mime }).then((h) => {
      if (batal) return
      if (!h.ok) {
        setGalat(h.alasan)
        return
      }
      setGalat('')
      setKiriman(h.kiriman)
      setKe(0)
      setPutaran(1)
    })
    return () => {
      batal = true
    }
  }, [berkas, ukuran])

  // 3. Putar bingkai.
  useEffect(() => {
    if (!kiriman || !jalan || kiriman.bingkai.length < 2) return
    const id = window.setInterval(() => {
      setKe((i) => {
        const n = (i + 1) % kiriman.bingkai.length
        if (n === 0) setPutaran((p) => p + 1)
        return n
      })
    }, 1000 / fps)
    return () => window.clearInterval(id)
  }, [kiriman, jalan, fps])

  // 4. Gambar bingkai aktif.
  const teks = kiriman?.bingkai[ke] ?? ''
  useEffect(() => {
    const c = canvasRef.current
    if (!c || !teks) return
    const lebar = Math.max(220, Math.min(460, window.innerWidth - 56))
    void QRCode.toCanvas(c, teks, {
      errorCorrectionLevel: 'L',
      margin: 4,
      width: lebar,
      color: { dark: '#000000', light: '#ffffff' },
    }).then(() => {
      if (!sudahLapor.current) {
        sudahLapor.current = true
        onDitayangkan?.()
      }
    })
  }, [teks, onDitayangkan])

  // 5. Jaga layar tetap menyala selama menayangkan.
  useEffect(() => {
    let kunci: PenguncianLayar | null = null
    const wl = (navigator as unknown as { wakeLock?: { request: (t: 'screen') => Promise<PenguncianLayar> } }).wakeLock
    void wl
      ?.request('screen')
      .then((k) => (kunci = k))
      .catch(() => undefined)
    return () => {
      void kunci?.release().catch(() => undefined)
    }
  }, [])

  const n = kiriman?.bingkai.length ?? 0

  return (
    <Modal
      open
      onClose={onTutup}
      title="Kirim lewat QR (tanpa sinyal)"
      testId="modal-kirim-qr"
      footer={
        <Button variant="ghost" data-testid="kirim-qr-tutup" onClick={onTutup}>
          Selesai
        </Button>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-slate-300">
          <b>{judul}</b>
          {kiriman && (
            <span className="text-slate-400">
              {' '}
              · {formatUkuran(kiriman.ukuranAsli)}
              {kiriman.metode === 'deflate-raw' ? ` → ${formatUkuran(kiriman.ukuranKirim)} dimampatkan` : ''}
            </span>
          )}
        </p>
        <p className="text-xs text-slate-400">
          Di HP penerima buka <b>Terima lewat QR</b> lalu arahkan kamera ke layar ini. Urutan bebas — biarkan berputar sampai
          penerima selesai. Naikkan kecerahan layar.
        </p>
        {peringatan && (
          <p className="rounded-lg px-3 py-2 text-xs" style={{ backgroundColor: '#422006', color: '#fde68a' }}>
            {peringatan}
          </p>
        )}

        {galat && (
          <p data-testid="kirim-qr-galat" className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#450a0a', color: '#fecaca' }}>
            {galat}
          </p>
        )}
        {!galat && !kiriman && <p className="text-xs text-slate-400">Menyiapkan bingkai…</p>}

        {kiriman && (
          <>
            <div className="flex justify-center rounded-xl p-2" style={{ backgroundColor: '#ffffff' }}>
              <canvas
                ref={canvasRef}
                data-testid="kirim-qr-kanvas"
                data-bingkai-ke={ke}
                data-teks={teks}
                aria-label={`QR bingkai ${ke + 1} dari ${n}`}
                className="max-w-full"
              />
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ backgroundColor: '#1e293b' }}>
              <div className="h-full" style={{ width: `${((ke + 1) / n) * 100}%`, backgroundColor: '#10b981' }} />
            </div>
            <p className="text-xs text-slate-300" data-testid="kirim-qr-status">
              Bingkai {ke + 1}/{n} · putaran {putaran} · ±{detikPutaran(n, fps)} dtk per putaran · sesi {kiriman.sesi}
            </p>
            {n > SARAN_BINGKAI && (
              <p className="text-xs" style={{ color: '#fbbf24' }}>
                Berkasnya cukup besar ({n} bingkai). Bila HP penerima punya sinyal/Bluetooth, "Bagikan langsung" lebih cepat.
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" data-testid="kirim-qr-jeda" onClick={() => setJalan((j) => !j)}>
                {jalan ? <IconPause size={14} /> : <IconPlay size={14} />} {jalan ? 'Jeda' : 'Lanjut'}
              </Button>
              {!jalan && (
                <>
                  <Button size="sm" variant="ghost" onClick={() => setKe((i) => (i - 1 + n) % n)} aria-label="Bingkai sebelumnya">
                    ‹
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setKe((i) => (i + 1) % n)} aria-label="Bingkai berikutnya">
                    ›
                  </Button>
                </>
              )}
              <label className="flex items-center gap-1 text-xs text-slate-400">
                Kecepatan
                <select
                  data-testid="kirim-qr-fps"
                  value={fps}
                  onChange={(e) => setFps(Number(e.target.value))}
                  className="rounded-md px-1 py-0.5 text-xs"
                  style={{ backgroundColor: '#0f172a', color: '#e2e8f0', border: '1px solid #334155' }}
                >
                  {PILIHAN_FPS.map((f) => (
                    <option key={f} value={f}>
                      {f} fps
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-1 text-xs text-slate-400">
                Ukuran QR
                <select
                  data-testid="kirim-qr-ukuran"
                  value={ukuran}
                  onChange={(e) => setUkuran(e.target.value as UkuranBingkai)}
                  className="rounded-md px-1 py-0.5 text-xs"
                  style={{ backgroundColor: '#0f172a', color: '#e2e8f0', border: '1px solid #334155' }}
                >
                  <option value="besar">Padat (lebih cepat)</option>
                  <option value="kecil">Renggang (kamera lama)</option>
                </select>
              </label>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
