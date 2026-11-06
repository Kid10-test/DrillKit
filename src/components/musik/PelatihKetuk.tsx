import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, Select } from '../ui'
import type { InfoKetuk, Metronom } from '../../lib/metronome'
import { PILIHAN_HENING } from '../../lib/metronome'
import {
  arahKetuk,
  nilaiKetukan,
  vonisKetuk,
  type HasilKetuk,
  type SasaranKetuk,
} from '../../lib/pelatihKetuk'

/**
 * #29 — Birama hening & Pelatih Ketepatan Ketuk (*Silent-Bar Rhythm Coach*).
 *
 * Bukan metronom kedua: memakai **mesin metronom yang sama** (tempo, sukat,
 * bunyi, pola) dan hanya menambah dua hal —
 * 1. pilihan **birama hening** (klik berbunyi N birama lalu diam M birama),
 *    yang juga berlaku saat berlatih biasa;
 * 2. **uji ketuk**: pemain mengetuk bantalan besar mengikuti ketukan; tiap
 *    ketukan dicocokkan ke waktu klik di jam `AudioContext` (bukan jam
 *    dinding), dikoreksi jeda keluaran audio, lalu dinilai ±ms.
 */
export function PelatihKetuk({
  engine,
  berjalan,
  polaHening,
  onPolaHening,
  onMulai,
  onBerhenti,
  daftarkan,
}: {
  engine: Metronom
  berjalan: boolean
  polaHening: string
  onPolaHening: (id: string) => void
  onMulai: () => void
  onBerhenti: () => void
  /** pasang/lepas pendengar ketukan metronom (dipanggil dari `onKetuk` milik halaman Musik) */
  daftarkan: (fn: ((i: InfoKetuk) => void) | null) => void
}) {
  const [tahap, setTahap] = useState<'siap' | 'ukur' | 'hasil'>('siap')
  const [semuaBunyi, setSemuaBunyi] = useState(false)
  const [hasil, setHasil] = useState<HasilKetuk | null>(null)
  const [jumlahKetuk, setJumlahKetuk] = useState(0)
  const [terakhirMs, setTerakhirMs] = useState<number | null>(null)
  const [heningKini, setHeningKini] = useState(false)
  const sasaranRef = useRef<SasaranKetuk[]>([])
  const ketukRef = useRef<number[]>([])
  const semuaBunyiRef = useRef(semuaBunyi)
  semuaBunyiRef.current = semuaBunyi

  /** Pendengar ketukan metronom: kumpulkan sasaran selama mengukur. */
  useEffect(() => {
    if (tahap !== 'ukur') {
      daftarkan(null)
      return
    }
    daftarkan((i) => {
      if (i.tahap === 'hitung' || i.suara !== 1 || i.waktu === undefined || i.sel <= 0) return
      if (!semuaBunyiRef.current && i.sub !== 0) return
      sasaranRef.current.push({ waktu: i.waktu, hening: !!i.hening })
      setHeningKini(!!i.hening)
    })
    return () => daftarkan(null)
  }, [tahap, daftarkan])

  const nilai = useCallback(() => {
    const h = nilaiKetukan(sasaranRef.current, ketukRef.current)
    setHasil(h)
    setTahap('hasil')
    onBerhenti()
  }, [onBerhenti])

  /** Metronom berhenti sendiri (lagu habis / tombol Berhenti) → langsung nilai. */
  useEffect(() => {
    if (tahap === 'ukur' && !berjalan && ketukRef.current.length > 0) nilai()
  }, [berjalan, tahap, nilai])

  function mulai() {
    sasaranRef.current = []
    ketukRef.current = []
    setJumlahKetuk(0)
    setTerakhirMs(null)
    setHasil(null)
    setHeningKini(false)
    setTahap('ukur')
    if (!berjalan) onMulai()
  }

  function ketuk(stempelEvent?: number) {
    const t = engine.waktuAudio()
    if (t === null) return
    // Koreksi: event diproses sedikit sesudah jari menyentuh layar, dan klik
    // yang didengar tertinggal `latensiKeluar` dari jadwalnya.
    const telat = stempelEvent !== undefined ? Math.max(0, Math.min(0.1, (performance.now() - stempelEvent) / 1000)) : 0
    const waktu = t - telat - engine.latensiKeluar()
    ketukRef.current.push(waktu)
    setJumlahKetuk(ketukRef.current.length)
    // Umpan balik langsung: selisih ke sasaran terdekat yang sudah diketahui.
    let dekat: SasaranKetuk | null = null
    for (const s of sasaranRef.current) if (!dekat || Math.abs(s.waktu - waktu) < Math.abs(dekat.waktu - waktu)) dekat = s
    setTerakhirMs(dekat && Math.abs(dekat.waktu - waktu) < 0.35 ? Math.round((waktu - dekat.waktu) * 1000) : null)
  }

  const warnaMs = (ms: number) => (Math.abs(ms) <= 35 ? '#10b981' : Math.abs(ms) <= 70 ? '#f59e0b' : '#f43f5e')

  return (
    <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/40 p-3" data-testid="kartu-pelatih-ketuk">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-semibold text-slate-300">Birama hening &amp; uji ketuk</h3>
        <span className="text-[11px] text-slate-500">latih tempo batin saat klik diam</span>
      </div>
      <div className="grid min-w-0 gap-2 sm:grid-cols-2">
        <div className="min-w-0">
          <label className="mb-1 block text-[11px] text-slate-500" htmlFor="pilih-hening">
            Birama hening (drop-out click)
          </label>
          <Select
            id="pilih-hening"
            data-testid="pilih-hening"
            data-kiosk-allow
            value={polaHening}
            onChange={(e) => onPolaHening(e.target.value)}
          >
            {PILIHAN_HENING.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="min-w-0">
          <label className="mb-1 block text-[11px] text-slate-500" htmlFor="pilih-sasaran-ketuk">
            Yang diketuk
          </label>
          <Select
            id="pilih-sasaran-ketuk"
            data-testid="pilih-sasaran-ketuk"
            data-kiosk-allow
            value={semuaBunyi ? 'semua' : 'pulsa'}
            disabled={tahap === 'ukur'}
            onChange={(e) => setSemuaBunyi(e.target.value === 'semua')}
          >
            <option value="pulsa">Ketukan (pulsa) saja</option>
            <option value="semua">Semua bunyi pola / subdivisi</option>
          </Select>
        </div>
      </div>

      {tahap !== 'ukur' && (
        <Button size="sm" variant="primary" className="mt-2.5 w-full" data-testid="mulai-uji-ketuk" onClick={mulai}>
          {tahap === 'hasil' ? 'Ulangi uji ketuk' : 'Mulai uji ketuk'}
        </Button>
      )}

      {tahap === 'ukur' && (
        <div className="mt-2.5 space-y-2">
          <button
            type="button"
            data-testid="pad-ketuk"
            data-kiosk-allow
            onPointerDown={(e) => {
              e.preventDefault()
              ketuk(e.timeStamp)
            }}
            onKeyDown={(e) => {
              if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault()
                if (!e.repeat) ketuk(e.timeStamp)
              }
            }}
            className="flex h-28 w-full touch-manipulation select-none flex-col items-center justify-center rounded-xl border-2 text-slate-100 transition active:scale-[0.99]"
            style={{
              borderColor: heningKini ? '#a855f7' : '#10b981',
              background: heningKini ? '#2e1065' : '#052e1c',
            }}
          >
            <span className="text-lg font-bold tracking-wide">KETUK</span>
            <span className="text-[11px]" style={{ color: heningKini ? '#d8b4fe' : '#6ee7b7' }} data-testid="status-hening">
              {heningKini ? 'birama hening — jaga tempo di kepala' : 'ikuti klik'}
            </span>
          </button>
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
            <span data-testid="jumlah-ketuk">{jumlahKetuk} ketukan</span>
            <span data-testid="selisih-terakhir" className="tabular-nums">
              {terakhirMs === null ? '—' : (
                <b style={{ color: warnaMs(terakhirMs) }}>
                  {terakhirMs > 0 ? '+' : ''}
                  {terakhirMs} ms
                </b>
              )}
            </span>
            <Button size="sm" variant="soft" data-testid="selesai-uji-ketuk" onClick={nilai}>
              Selesai &amp; nilai
            </Button>
          </div>
        </div>
      )}

      {tahap === 'hasil' && hasil && <HasilUjiKetuk hasil={hasil} />}
    </div>
  )
}

function HasilUjiKetuk({ hasil }: { hasil: HasilKetuk }) {
  const arah = arahKetuk(hasil.semua.rataMs)
  const W = 300
  const H = 64
  const n = Math.max(1, hasil.pasangan.length)
  const skala = 120
  return (
    <div className="mt-2.5 space-y-2" data-testid="hasil-uji-ketuk">
      <div className="grid grid-cols-3 gap-1.5 text-center">
        <Kotak
          label="Rata-rata"
          nilai={`${hasil.semua.rataMs > 0 ? '+' : ''}${hasil.semua.rataMs} ms`}
          sub={arah === 'tepat' ? 'pas' : arah}
          testId="rata-ketuk"
        />
        <Kotak label="Konsistensi" nilai={`±${hasil.semua.sebaranMs} ms`} sub={`${hasil.pasangan.length} cocok`} testId="sebaran-ketuk" />
        <Kotak label="Tepat" nilai={`${hasil.persenTepat}%`} sub={`dalam ±${hasil.toleransiMs} ms`} testId="persen-ketuk" />
      </div>
      {hasil.hening.n > 0 && (
        <div className="grid grid-cols-2 gap-1.5 text-center">
          <Kotak label="Saat klik berbunyi" nilai={`${hasil.bunyi.rataMs > 0 ? '+' : ''}${hasil.bunyi.rataMs} ms`} sub={`±${hasil.bunyi.sebaranMs}`} testId="ketuk-bunyi" />
          <Kotak label="Saat birama hening" nilai={`${hasil.hening.rataMs > 0 ? '+' : ''}${hasil.hening.rataMs} ms`} sub={`±${hasil.hening.sebaranMs}`} testId="ketuk-hening" />
        </div>
      )}
      {hasil.pasangan.length > 0 && (
        <svg viewBox={`0 0 ${W} ${H}`} className="h-16 w-full rounded-md" style={{ background: '#0b1120' }} data-testid="grafik-ketuk">
          <line x1={0} y1={H / 2} x2={W} y2={H / 2} stroke="#334155" strokeWidth={1} />
          {hasil.pasangan.map((p, i) => {
            const x = ((i + 0.5) / n) * W
            const y = H / 2 - (Math.max(-skala, Math.min(skala, p.selisihMs)) / skala) * (H / 2 - 3)
            const warna = Math.abs(p.selisihMs) <= hasil.toleransiMs ? '#10b981' : Math.abs(p.selisihMs) <= hasil.toleransiMs * 2 ? '#f59e0b' : '#f43f5e'
            return (
              <g key={i}>
                {p.hening && <rect x={x - W / n / 2} y={0} width={W / n} height={H} fill="#2e1065" opacity={0.6} />}
                <line x1={x} y1={H / 2} x2={x} y2={y} stroke={warna} strokeWidth={Math.max(1, Math.min(4, (W / n) * 0.5))} />
              </g>
            )
          })}
        </svg>
      )}
      <ul className="space-y-0.5 text-[11px] leading-relaxed text-slate-300" data-testid="vonis-ketuk">
        {vonisKetuk(hasil).map((v) => (
          <li key={v}>• {v}</li>
        ))}
      </ul>
      <p className="text-[10px] text-slate-500">
        Di atas garis = terlambat (terseret), di bawah = mendahului (tergesa). Latar ungu = birama hening.
      </p>
    </div>
  )
}

function Kotak({ label, nilai, sub, testId }: { label: string; nilai: string; sub: string; testId: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-800 bg-slate-950/60 px-1.5 py-1.5">
      <div className="truncate text-[10px] text-slate-500">{label}</div>
      <div className="text-sm font-semibold tabular-nums text-slate-100" data-testid={testId}>
        {nilai}
      </div>
      <div className="truncate text-[10px] text-slate-500">{sub}</div>
    </div>
  )
}
