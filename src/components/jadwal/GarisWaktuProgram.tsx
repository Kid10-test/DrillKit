/**
 * #36 — garis waktu program: fase berwarna, tonggak, dan titik tiap sesi
 * latihan (wajib = titik penuh). Warna inline hex supaya sama dengan cetakan.
 */
import type { ProgramLatihan } from '../../db/types'
import { NAMA_BULAN, selisihHari } from '../../lib/kalender'
import { LABEL_TONGGAK, WARNA_FASE, WARNA_TONGGAK, tanggalLatihan } from '../../lib/programLatsar'

const tglPendek = (iso: string) => `${Number(iso.slice(8))} ${NAMA_BULAN[Number(iso.slice(5, 7)) - 1]?.slice(0, 3) ?? ''}`

export function GarisWaktuProgram({
  program,
  wajib,
  hariIni,
}: {
  program: ProgramLatihan
  /** Tanggal sesi wajib (titik penuh). Kosong = pakai usulan: sebelum pelantikan. */
  wajib?: Set<string>
  hariIni?: string
}) {
  const p = program
  if (!p.mulai || !p.selesai || p.selesai < p.mulai) return null
  const total = selisihHari(p.mulai, p.selesai) + 1
  const pos = (iso: string) => Math.max(0, Math.min(100, (selisihHari(p.mulai, iso) / total) * 100))
  const lebar = (a: string, b: string) => Math.max(0.8, ((selisihHari(a, b) + 1) / total) * 100)
  const latihan = tanggalLatihan(p)
  const tonggak = p.tonggak.filter((t) => t.dari && t.dari <= p.selesai && (t.sampai ?? t.dari) >= p.mulai)
  const tanpaTanggal = p.tonggak.filter((t) => !t.dari)

  return (
    <div data-testid="garis-waktu-program" className="space-y-1">
      <div className="relative h-7 overflow-hidden rounded-md bg-slate-800/70">
        {p.fase.map((f, i) => (
          <div
            key={f.id}
            data-testid={`gw-fase-${i}`}
            title={`${f.nama}: ${tglPendek(f.dari)} – ${tglPendek(f.sampai)}`}
            className="absolute inset-y-0 flex items-center overflow-hidden px-1.5 text-[10px] font-semibold text-white"
            style={{ left: `${pos(f.dari)}%`, width: `${lebar(f.dari, f.sampai)}%`, background: WARNA_FASE[i % WARNA_FASE.length] }}
          >
            <span className="truncate">{f.nama.replace(/^Fase (\d+)\s*—\s*/, 'F$1 · ')}</span>
          </div>
        ))}
        {tonggak.map((t) => (
          <div
            key={t.id}
            title={`${t.nama} (${LABEL_TONGGAK[t.jenis]})`}
            className="absolute inset-y-0"
            style={{
              left: `${pos(t.dari!)}%`,
              width: `${lebar(t.dari!, t.sampai && t.sampai >= t.dari! ? t.sampai : t.dari!)}%`,
              background: WARNA_TONGGAK[t.jenis],
              opacity: 0.9,
            }}
          />
        ))}
        {hariIni && hariIni >= p.mulai && hariIni <= p.selesai && (
          <div className="absolute inset-y-0 w-0.5" style={{ left: `${pos(hariIni)}%`, background: '#ffffff' }} title="Hari ini" />
        )}
      </div>
      <div className="relative h-3">
        {latihan.map((t) => {
          const penuh = wajib ? wajib.has(t) : true
          return (
            <span
              key={t}
              title={tglPendek(t)}
              className="absolute top-0.5 h-2 w-2 -translate-x-1/2 rounded-full"
              style={{
                left: `${pos(t) + 50 / total}%`,
                background: penuh ? '#e2e8f0' : 'transparent',
                border: '1px solid #94a3b8',
              }}
            />
          )
        })}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-slate-400">
        <span>
          {tglPendek(p.mulai)} – {tglPendek(p.selesai)} · {latihan.length} latihan
        </span>
        {tonggak.map((t) => (
          <span key={t.id} className="flex items-center gap-1">
            <i className="inline-block h-2 w-2 rounded-sm" style={{ background: WARNA_TONGGAK[t.jenis] }} />
            {t.nama} {tglPendek(t.dari!)}
            {t.sampai && t.sampai > t.dari! ? `–${tglPendek(t.sampai)}` : ''}
          </span>
        ))}
        {tanpaTanggal.map((t) => (
          <span key={t.id} className="flex items-center gap-1 text-slate-500">
            <i className="inline-block h-2 w-2 rounded-sm" style={{ background: WARNA_TONGGAK[t.jenis] }} />
            {t.nama}: tanggal belum ditentukan
          </span>
        ))}
      </div>
    </div>
  )
}
