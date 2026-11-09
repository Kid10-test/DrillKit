/**
 * #35 — bilah komposisi ranah (fisik/visual/musik/section/…) sebuah sesi
 * atau seminggu. Warnanya hex yang sama dengan cetakan.
 */
import { LABEL_RANAH, URUTAN_RANAH, WARNA_RANAH_HEX, jumlahSemua, type Menit } from '../../lib/ranahSesi'

export function BilahKomposisi({
  m,
  className = '',
  tinggi = 6,
  testId,
}: {
  m: Menit
  className?: string
  /** Tinggi dalam px. */
  tinggi?: number
  testId?: string
}) {
  const tot = jumlahSemua(m)
  if (tot <= 0) return null
  return (
    <div
      data-testid={testId}
      className={`flex w-full overflow-hidden rounded-full bg-slate-800 ${className}`}
      style={{ height: tinggi }}
      role="img"
      aria-label={URUTAN_RANAH.filter((r) => m[r] > 0)
        .map((r) => `${LABEL_RANAH[r]} ${Math.round((m[r] / tot) * 100)}%`)
        .join(', ')}
    >
      {URUTAN_RANAH.filter((r) => m[r] > 0).map((r) => (
        <span
          key={r}
          data-ranah={r}
          title={`${LABEL_RANAH[r]} · ${Math.round(m[r])} mnt`}
          style={{ width: `${(m[r] / tot) * 100}%`, background: WARNA_RANAH_HEX[r] }}
        />
      ))}
    </div>
  )
}

/** Legenda warna ranah. */
export function LegendaRanah({ className = '' }: { className?: string }) {
  return (
    <div className={`flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-400 ${className}`}>
      {URUTAN_RANAH.map((r) => (
        <span key={r} className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm" style={{ background: WARNA_RANAH_HEX[r] }} />
          {LABEL_RANAH[r]}
        </span>
      ))}
    </div>
  )
}
