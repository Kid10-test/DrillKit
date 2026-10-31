import type { BiramaPola } from "../../db/types"
import type { InfoKetuk } from "../../lib/metronome"
import { Button } from "../ui"
import { cx } from "../../lib/utils"

/**
 * E3 — Editor satu birama: pilih jumlah ketukan & pembagian, lalu klik kotak
 * berulang untuk mengatur **diam → biasa → aksen**. Saat metronom berjalan,
 * kotak yang sedang berbunyi diberi cincin terang.
 */
export function EditorBirama({
  bar,
  index,
  aktif,
  bisaHapus,
  onSel,
  onUbah,
  onSalin,
  onHapus,
}: {
  bar: BiramaPola
  index: number
  aktif: InfoKetuk | null
  bisaHapus: boolean
  onSel: (i: number) => void
  onUbah: (patch: Partial<BiramaPola>) => void
  onSalin: () => void
  onHapus: () => void
}) {
  const barAktif = aktif && aktif.suara === 1 ? aktif.bar : -1
  const iAktif = aktif && aktif.suara === 1 ? aktif.beat * bar.subdiv + aktif.sub : -1
  return (
    <div className="rounded-lg border border-slate-800 p-2.5" data-testid={`editor-birama-${index}`}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold text-slate-400">Birama {index + 1}</span>
        <select
          value={bar.beats}
          onChange={(e) => onUbah({ beats: Number(e.target.value) })}
          className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200"
          title="Jumlah ketukan dalam birama ini"
        >
          {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
            <option key={n} value={n}>
              {n} ketuk
            </option>
          ))}
        </select>
        <select
          value={bar.subdiv}
          onChange={(e) => onUbah({ subdiv: Number(e.target.value) })}
          className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200"
          title="Pembagian tiap ketukan"
        >
          <option value={1}>penuh</option>
          <option value={2}>setengah</option>
          <option value={3}>triplet</option>
          <option value={4}>enam belas</option>
        </select>
        <div className="ml-auto flex gap-1">
          <Button size="sm" variant="ghost" onClick={onSalin}>
            Salin
          </Button>
          {bisaHapus && (
            <Button size="sm" variant="ghost" onClick={onHapus}>
              Hapus
            </Button>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        {bar.cells.map((c, i) => {
          const menyala = barAktif === index && i === iAktif
          return (
            <button
              key={i}
              type="button"
              data-testid={`sel-${index}-${i}`}
              data-tingkat={c}
              onClick={() => onSel(i)}
              title="Klik berulang: diam → biasa → aksen"
              className={cx(
                'h-8 min-w-[26px] flex-1 rounded border text-[10px] font-semibold tabular-nums transition',
                c === 2
                  ? 'border-emerald-500/50 bg-emerald-500/25 text-emerald-200'
                  : c === 1
                    ? 'border-slate-600 bg-slate-800 text-slate-200'
                    : 'border-slate-800 bg-slate-950 text-slate-600',
                menyala && 'ring-2 ring-emerald-300',
              )}
            >
              {c === 2 ? 'A' : c === 1 ? Math.floor(i / bar.subdiv) + 1 : '·'}
            </button>
          )
        })}
      </div>
    </div>
  )
}

