import { useEffect, useRef, useState } from 'react'
import { Button, Card, Select, useToast } from './ui'
import { IconMic, IconMusic, IconPause, IconPlay } from './Icons'
import {
  DAFTAR_TRANSPOSISI,
  Dengung,
  Penala,
  PILIHAN_NADA,
  PILIHAN_OKTAF,
  bacaSetelan,
  cariTransposisi,
  dengungTertulis,
  keTertulis,
  nadaKeHz,
  pesanMikrofon,
  simpanSetelan,
  type HasilNada,
  type SetelanPenala,
} from '../lib/tuner'

/**
 * E4 — Penala (tuner) & nada dengung (drone).
 *
 * Cara pakainya seperti menala di ruang latihan:
 * 1. Nyalakan **nada dengung** (Bb konser untuk brass, atau nada lain).
 * 2. Tekan **Dengarkan**, lalu mainkan nada yang sama.
 * 3. Jarum di tengah = tepat. Angka **sen** menunjukkan selisihnya:
 *    ±5 sen masih wajar, di atas itu perlu dibetulkan.
 *
 * J1 — **Instrumen** (transposisi): pemain trumpet memilih "Bb", lalu penala
 * menulis nada sesuai partiturnya (C5), bukan nada konser (Bb4). Nada konser
 * tetap disebut kecil di bawahnya, supaya pelatih yang berdiri di sebelahnya
 * tetap bisa bicara dalam nada konser.
 *
 * Mikrofon hanya dibuka setelah tombol ditekan (aturan browser), dan langsung
 * dilepas saat dimatikan atau saat komponen dibongkar — jadi tidak ada
 * indikator "mic menyala" yang tertinggal di HP.
 */
export default function TunerDrone() {
  const toast = useToast()
  const penalaRef = useRef<Penala | null>(null)
  const dengungRef = useRef<Dengung | null>(null)

  const [st, setSt] = useState<SetelanPenala>(() => bacaSetelan())
  const [nyala, setNyala] = useState(false)
  const [bunyi, setBunyi] = useState(false)
  const [hasil, setHasil] = useState<HasilNada | null>(null)
  const [pesan, setPesan] = useState('')

  const patch = (p: Partial<SetelanPenala>) => setSt((s) => ({ ...s, ...p }))

  /** Setelan diingat, jadi lain kali langsung sesuai kebiasaan tim. */
  useEffect(() => {
    simpanSetelan(st)
  }, [st])

  /** Baca mikrofon ~16 kali per detik — cukup halus, ringan untuk HP. */
  useEffect(() => {
    if (!nyala) return
    const id = window.setInterval(() => {
      setHasil(penalaRef.current?.baca(st.a4) ?? null)
    }, 60)
    return () => window.clearInterval(id)
  }, [nyala, st.a4])

  /** Volume & frekuensi bisa diubah sambil dengung berbunyi. */
  useEffect(() => {
    if (bunyi) dengungRef.current?.setVolume(st.volume)
  }, [st.volume, bunyi])

  useEffect(() => {
    if (bunyi) dengungRef.current?.setFrekuensi(nadaKeHz(st.nada, st.oktaf, st.a4))
  }, [st.nada, st.oktaf, st.a4, bunyi])

  /** Bersihkan mikrofon & dengung saat pindah halaman. */
  useEffect(
    () => () => {
      penalaRef.current?.berhenti()
      dengungRef.current?.berhenti()
    },
    [],
  )

  async function mulaiDengung(s: SetelanPenala) {
    try {
      dengungRef.current?.berhenti()
      const d = new Dengung()
      dengungRef.current = d
      await d.mulai({
        hz: nadaKeHz(s.nada, s.oktaf, s.a4),
        bentuk: s.bentuk,
        volume: s.volume,
        kelima: !!s.kelima,
      })
      setBunyi(true)
    } catch (e) {
      setBunyi(false)
      toast.push(`Nada dengung tidak bisa diputar: ${e instanceof Error ? e.message : String(e)}`, 'err')
    }
  }

  async function toggleMikrofon() {
    if (nyala) {
      penalaRef.current?.berhenti()
      setNyala(false)
      setHasil(null)
      return
    }
    setPesan('')
    try {
      if (!penalaRef.current) penalaRef.current = new Penala()
      await penalaRef.current.mulai()
      setNyala(true)
    } catch (e) {
      setPesan(pesanMikrofon(e))
      toast.push('Mikrofon tidak bisa dibuka', 'err')
    }
  }

  async function toggleDengung() {
    if (bunyi) {
      dengungRef.current?.berhenti()
      setBunyi(false)
      return
    }
    await mulaiDengung(st)
  }

  /** Bentuk gelombang & nada kelima tidak bisa diubah sambil bunyi → mulai ulang. */
  async function ubahYangPerluMulaiUlang(p: Partial<SetelanPenala>) {
    const baru = { ...st, ...p }
    patch(p)
    if (bunyi) await mulaiDengung(baru)
  }

  const sen = hasil?.sen ?? 0
  /** Posisi jarum 0–100 (50 = tepat di tengah). */
  const pos = 50 + Math.max(-50, Math.min(50, sen))
  const warna = !hasil ? '#64748b' : Math.abs(sen) <= 5 ? '#10b981' : Math.abs(sen) <= 15 ? '#f59e0b' : '#f43f5e'
  const hzDengung = nadaKeHz(st.nada, st.oktaf, st.a4)
  const tr = cariTransposisi(st.transposisi)
  /** Label besar: nada tertulis untuk instrumen bertransposisi, konser bila tidak. */
  const labelUtama = !hasil ? '—' : tr.geser ? keTertulis(hasil, tr.geser, st.a4).label : hasil.label

  return (
    <Card data-testid="kartu-penala" className="min-w-0 lg:col-span-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-200">Penala &amp; nada dengung</h2>
        <span className="text-[11px] text-slate-500">
          Bunyi dibuat sendiri oleh aplikasi — tetap jalan offline
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* ------------------------------ Penala ------------------------------ */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
          <div className="text-center">
            <div
              className="text-4xl font-bold tabular-nums leading-tight"
              style={{ color: warna }}
              data-testid="nada-terdeteksi"
            >
              {labelUtama}
            </div>
            {tr.geser !== 0 && (
              <div className="mt-0.5 text-[11px] text-slate-400" data-testid="nada-konser">
                {hasil ? (
                  <>
                    konser <b className="tabular-nums text-slate-300">{hasil.label}</b> · nada tertulis {tr.label}
                  </>
                ) : (
                  <>nada tertulis untuk instrumen {tr.label}</>
                )}
              </div>
            )}
            <div className="mt-1 text-xs text-slate-400">
              <span data-testid="sen-terdeteksi" className="tabular-nums">
                {hasil ? `${sen > 0 ? '+' : ''}${sen} sen` : 'menunggu nada…'}
              </span>
              <span className="text-slate-600"> · </span>
              <span data-testid="hz-terdeteksi" className="tabular-nums">
                {hasil ? `${hasil.hz.toFixed(1)} Hz` : '—'}
              </span>
            </div>
          </div>

          {/* Jarum sen: -50 … +50, zona hijau ±5 sen */}
          <div className="mt-4" data-testid="jarum-penala">
            <div className="relative h-5 overflow-hidden rounded-full border border-slate-800 bg-slate-900">
              <div
                className="absolute inset-y-0 bg-emerald-500/15"
                style={{ left: '45%', width: '10%' }}
                aria-hidden="true"
              />
              <div className="absolute inset-y-0 w-px bg-slate-600" style={{ left: '50%' }} aria-hidden="true" />
              <div
                className="absolute top-0 h-full w-1.5 rounded-full transition-[left] duration-75"
                style={{ left: `calc(${pos}% - 3px)`, background: warna }}
                aria-hidden="true"
              />
            </div>
            <div className="mt-1 flex justify-between text-[10px] tabular-nums text-slate-600">
              <span>−50</span>
              <span>0</span>
              <span>+50</span>
            </div>
          </div>

          <p className="mt-2 min-h-[32px] text-center text-[11px] leading-relaxed text-slate-400" data-testid="keterangan-penala">
            {!nyala
              ? 'Tekan Dengarkan untuk membaca nada dari mikrofon.'
              : !hasil
                ? 'Belum ada nada yang terbaca — mainkan lebih keras atau dekati mikrofon.'
                : Math.abs(sen) <= 5
                  ? 'Tepat.'
                  : sen < 0
                    ? `${Math.abs(sen)} sen terlalu rendah.`
                    : `${sen} sen terlalu tinggi.`}
          </p>

          <div className="mt-3">
            <label className="mb-1 block text-[11px] text-slate-500" htmlFor="pilih-transposisi">
              Instrumen (nada yang tampil mengikuti partitur)
            </label>
            <Select
              id="pilih-transposisi"
              data-testid="pilih-transposisi"
              data-kiosk-allow
              value={tr.id}
              onChange={(e) => patch({ transposisi: e.target.value })}
            >
              {DAFTAR_TRANSPOSISI.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label} — {t.contoh}
                </option>
              ))}
            </Select>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <Button
              data-testid="tombol-mikrofon"
              variant={nyala ? 'soft' : 'primary'}
              onClick={toggleMikrofon}
            >
              <IconMic size={16} /> {nyala ? 'Berhenti mendengarkan' : 'Dengarkan'}
            </Button>
            <div className="flex items-center gap-2">
              <label className="text-[11px] text-slate-500">Acuan A4</label>
              <Select
                data-testid="pilih-a4"
                data-kiosk-allow
                value={String(st.a4)}
                onChange={(e) => patch({ a4: Number(e.target.value) })}
                className="w-24"
              >
                {[438, 439, 440, 441, 442, 443, 444, 445].map((v) => (
                  <option key={v} value={v}>
                    {v} Hz
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {pesan && (
            <p
              className="mt-3 rounded-lg border border-amber-500/25 bg-amber-500/10 p-2.5 text-[11px] leading-relaxed text-amber-200"
              data-testid="pesan-penala"
            >
              {pesan}
            </p>
          )}
        </div>

        {/* ---------------------------- Nada dengung ---------------------------- */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-2xl font-semibold tabular-nums text-slate-100" data-testid="nada-dengung">
                {st.nada}
                {st.oktaf}
              </div>
              <div className="text-[11px] tabular-nums text-slate-500">{hzDengung.toFixed(1)} Hz</div>
              {tr.geser !== 0 && (
                <div className="text-[11px] text-slate-400" data-testid="dengung-tertulis">
                  = <b className="tabular-nums text-slate-300">{dengungTertulis(st.nada, st.oktaf, tr.geser)}</b> di
                  partitur {tr.label}
                </div>
              )}
            </div>
            <Button data-testid="tombol-dengung" variant={bunyi ? 'soft' : 'primary'} onClick={toggleDengung}>
              {bunyi ? <IconPause size={16} /> : <IconPlay size={16} />} {bunyi ? 'Hentikan' : 'Putar dengung'}
            </Button>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {[
              { id: 'bb', label: 'Bb konser', nada: 'A#', oktaf: 3 },
              { id: 'f', label: 'F konser', nada: 'F', oktaf: 3 },
              { id: 'eb', label: 'Eb konser', nada: 'D#', oktaf: 3 },
              { id: 'a', label: 'A konser', nada: 'A', oktaf: 3 },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                data-testid={`preset-${p.id}`}
                onClick={() => patch({ nada: p.nada, oktaf: p.oktaf })}
                className={cxPreset(st.nada === p.nada && st.oktaf === p.oktaf)}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-[11px] text-slate-500">Nada</label>
              <Select
                data-testid="pilih-nada-dengung"
                data-kiosk-allow
                value={st.nada}
                onChange={(e) => patch({ nada: e.target.value })}
              >
                {PILIHAN_NADA.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-slate-500">Oktaf</label>
              <Select
                data-testid="pilih-oktaf-dengung"
                data-kiosk-allow
                value={String(st.oktaf)}
                onChange={(e) => patch({ oktaf: Number(e.target.value) })}
              >
                {PILIHAN_OKTAF.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-[11px] text-slate-500">Bentuk bunyi</label>
              <Select
                data-testid="pilih-bentuk-dengung"
                data-kiosk-allow
                value={st.bentuk}
                onChange={(e) => ubahYangPerluMulaiUlang({ bentuk: e.target.value as OscillatorType })}
              >
                <option value="sine">Lembut (sine)</option>
                <option value="triangle">Hangat (triangle)</option>
                <option value="sawtooth">Tebal (sawtooth)</option>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-slate-500">Volume</label>
              <input
                data-testid="geser-volume-dengung"
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={st.volume}
                onChange={(e) => patch({ volume: Number(e.target.value) })}
                className="mt-1.5 w-full accent-emerald-500"
              />
            </div>
          </div>

          <button
            type="button"
            data-testid="toggle-kelima"
            onClick={() => ubahYangPerluMulaiUlang({ kelima: st.kelima ? 0 : 1 })}
            className="mt-3 flex w-full items-center justify-between rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2.5 text-xs text-slate-300 hover:bg-slate-800/50"
          >
            <span>Tambah nada kelima (harmoni 3:2)</span>
            <span
              className="relative h-5 w-9 shrink-0 rounded-full transition"
              style={{ background: st.kelima ? '#10b981' : '#334155' }}
            >
              <span
                className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all"
                style={{ left: st.kelima ? '18px' : '2px' }}
              />
            </span>
          </button>

          <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
            <IconMusic size={12} className="mr-1 inline align-[-1px]" />
            Nada kelima membuat dengung terdengar seperti harmoni band, bukan sekadar bunyi pipa —
            telinga lebih mudah menangkap nada yang melenceng.
          </p>
        </div>
      </div>
    </Card>
  )
}

/** Kelas tombol preset — aktif diberi latar hijau. */
function cxPreset(aktif: boolean): string {
  return [
    'rounded-full border px-3 py-1.5 text-[11px] transition',
    aktif
      ? 'border-emerald-600/40 bg-emerald-600/15 text-emerald-200'
      : 'border-slate-800 text-slate-400 hover:bg-slate-800/50',
  ].join(' ')
}
