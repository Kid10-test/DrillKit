/**
 * #12c — Penggaris Musik × Drill (diekstrak dari `DrillEditor.tsx`).
 */
import type { Song } from '../../db/types'
import { formatWaktu } from '../../lib/birama'
import { fmtAngka, fmtBirama, type petaPenggaris } from '../../lib/segmenDrill'
import { cx } from '../../lib/utils'

type PetaPenggaris = NonNullable<ReturnType<typeof petaPenggaris>>

export function PenggarisMusikDrill({
  lagu,
  penggaris,
  idxAktif,
  partiturDrillTerbuka,
  onTogglePartitur,
  keHitungan,
  lebarBlok,
  catatanLintas,
}: {
  lagu: Song
  penggaris: PetaPenggaris
  idxAktif: number
  partiturDrillTerbuka: boolean
  onTogglePartitur: () => void
  keHitungan: (hitungan: number) => void
  lebarBlok: (hitungan: number) => string | number
  catatanLintas: { index: number; nama: string; teks: string }[]
}) {
  if (!penggaris.set.length) return null
  return (
    <div className="border-t border-slate-800 px-3 py-2" data-testid="penggaris-drill">
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="text-[11px] font-medium text-slate-300">
          Garis waktu <b className="text-emerald-300">{lagu.title}</b>
          <span className="ml-1 text-slate-500">— segmen lagu × set drill, dalam hitungan</span>
        </span>
        <div className="flex items-center gap-2">
          {lagu.partitur && (
            <button
              type="button"
              data-kiosk-allow
              data-testid="drill-tombol-partitur"
              onClick={onTogglePartitur}
              className={cx(
                'rounded-md border px-2 py-0.5 text-[10px] font-semibold transition',
                partiturDrillTerbuka
                  ? 'border-emerald-500/60 bg-emerald-600/20 text-emerald-200'
                  : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800',
              )}
            >
              {partiturDrillTerbuka ? 'Tutup partitur' : 'Buka partitur'}
            </button>
          )}
          <span className="text-[10px] tabular-nums text-slate-500" data-testid="penggaris-ringkas">
            {penggaris.totalHitungan} hitungan · {formatWaktu(penggaris.totalDetik)}
          </span>
        </div>
      </div>
      <div className="scroll-thin overflow-x-auto pb-1" data-testid="penggaris-gulir">
        <div className="min-w-max space-y-1">
          <div className="flex items-stretch gap-1" data-testid="penggaris-baris-segmen">
            {penggaris.segmen.map((b) => (
              <button
                key={`g${b.index}`}
                type="button"
                data-kiosk-allow
                data-testid={`penggaris-segmen-${b.index}`}
                onClick={() => keHitungan(b.mulai)}
                style={{ width: lebarBlok(b.hitungan) }}
                title={
                  `Segmen ${b.label} · ${b.luncur ? `${fmtAngka(b.bpm)} → ${fmtAngka(b.bpmAkhir)}` : fmtAngka(b.bpm)} BPM · ` +
                  `hitungan ${fmtAngka(b.mulai + 1)}–${fmtAngka(b.akhir)} · ` +
                  `birama ${fmtBirama(b.mulaiBirama)}–${fmtBirama(b.akhirBirama)} · ketuk untuk melompat`
                }
                className="shrink-0 rounded-md border border-sky-800/50 bg-sky-950/30 px-2 py-1 text-left transition hover:border-sky-600/60 hover:bg-sky-950/50"
              >
                <span className="block truncate text-[11px] font-medium text-sky-200">
                  {b.dasar ? 'Awal lagu' : b.label}
                </span>
                <span className="block truncate text-[9px] tabular-nums text-slate-400">
                  {b.luncur ? `${fmtAngka(b.bpm)}→${fmtAngka(b.bpmAkhir)}` : fmtAngka(b.bpm)} BPM ·{' '}
                  {fmtAngka(b.mulai + 1)}–{fmtAngka(b.akhir)} · br {fmtBirama(b.mulaiBirama)}–{fmtBirama(b.akhirBirama)}
                </span>
              </button>
            ))}
          </div>
          <div className="flex items-stretch gap-1" data-testid="penggaris-baris-set">
            {penggaris.set.map((b) => (
              <button
                key={`s${b.index}`}
                type="button"
                data-kiosk-allow
                data-testid={`penggaris-set-${b.index}`}
                onClick={() => keHitungan(b.mulai)}
                style={{ width: lebarBlok(b.hitungan) }}
                title={
                  `${b.nama} · ${fmtAngka(b.mulai + 1)}–${fmtAngka(b.akhir)} hitungan · ` +
                  `birama ${fmtBirama(b.mulaiBirama)}–${fmtBirama(b.akhirBirama)} · ${fmtAngka(b.bpm)} BPM` +
                  (b.keterangan.length ? ` · ${b.keterangan.join(' · ')}` : '')
                }
                className={cx(
                  'shrink-0 rounded-md border px-2 py-1 text-left transition',
                  b.index === idxAktif
                    ? 'border-emerald-600/60 bg-emerald-600/15 text-emerald-200'
                    : 'border-slate-800 bg-slate-900/40 text-slate-300 hover:bg-slate-800/60',
                )}
              >
                <span className="flex items-center gap-1 text-[11px] font-medium">
                  <span className="truncate">{b.nama}</span>
                  {(b.lintasTempo || b.lintasSukat) && (
                    <span
                      data-testid={`penggaris-lintas-${b.index}`}
                      className="shrink-0 text-amber-300"
                      title={b.keterangan.join(' · ')}
                    >
                      ⚡
                    </span>
                  )}
                </span>
                <span className="block truncate text-[9px] tabular-nums text-slate-400">
                  {fmtAngka(b.mulai + 1)}–{fmtAngka(b.akhir)} · birama {fmtBirama(b.mulaiBirama)}–
                  {fmtBirama(b.akhirBirama)}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
      {catatanLintas.length > 0 && (
        <ul className="mt-1 space-y-0.5 text-[10px] leading-snug text-amber-300/90" data-testid="penggaris-catatan">
          {catatanLintas.map((c) => (
            <li key={`c${c.index}`} data-testid={`penggaris-catatan-${c.index}`}>
              ⚡ <b>{c.nama}</b>: {c.teks}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
