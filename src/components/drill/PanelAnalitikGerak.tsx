/**
 * #12c — Panel DD3 Analitik Gerakan (diekstrak dari `DrillEditor.tsx`).
 */
import type { Drill, Member } from '../../db/types'
import {
  AMBANG,
  TINGKAT_LABEL,
  TINGKAT_WARNA,
  tingkatLangkahDari,
  type ambangEfektif,
  type analisisPerpindahan,
  type setTerberat,
} from '../../lib/analitik'
import { NamaTampil } from '../NamaTampil'
import { Card, Toggle } from '../ui'

export function PanelAnalitikGerak({
  drill,
  nyalaAnalitik,
  onToggleAnalitik,
  analisis,
  ambang,
  terberat,
  rosterById,
}: {
  drill: Drill
  nyalaAnalitik: boolean
  onToggleAnalitik: (v: boolean) => void
  analisis: ReturnType<typeof analisisPerpindahan>
  ambang: ReturnType<typeof ambangEfektif>
  terberat: ReturnType<typeof setTerberat>
  rosterById: Map<string, Member>
}) {
  return (
    <Card>
      <h2 className="mb-2 text-sm font-semibold text-slate-200">Analitik gerakan</h2>
      <Toggle
        checked={nyalaAnalitik}
        onChange={onToggleAnalitik}
        label="Warnai jejak menurut kesulitan"
      />

      {analisis.daftar.length === 0 ? (
        <p className="mt-2 text-[11px] text-slate-500">
          Belum ada perpindahan yang bisa dihitung pada set ini.
        </p>
      ) : (
        <div className="mt-2 space-y-2">
          <div className="grid grid-cols-3 gap-1.5 text-center">
            <div className="rounded bg-slate-800/60 p-1.5">
              <div className="text-[15px] font-semibold text-slate-100">
                {Math.round(analisis.rata)}
              </div>
              <div className="text-[10px] leading-tight text-slate-500">
                rata² langkah/menit
              </div>
            </div>
            <div
              className="rounded bg-slate-800/60 p-1.5"
              data-testid="analitik-langkah-terjauh"
            >
              <div className="text-[15px] font-semibold text-slate-100">
                {Math.round(analisis.terjauh?.jarakLangkah ?? 0)}
              </div>
              <div className="text-[10px] leading-tight text-slate-500">langkah terjauh</div>
            </div>
            <div
              className="rounded bg-slate-800/60 p-1.5"
              data-testid="analitik-paling-cepat"
            >
              <div
                className="text-[15px] font-semibold"
                style={{ color: TINGKAT_WARNA[analisis.tercepat?.tingkat ?? 'nyaman'] }}
              >
                {Math.round(analisis.tercepat?.langkahPerMenit ?? 0)}
              </div>
              <div className="text-[10px] leading-tight text-slate-500">paling cepat</div>
            </div>
          </div>

          <div>
            {analisis.seksi.map((sc) => (
              <div key={sc.seksi} className="mb-1">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="truncate">{sc.label}</span>
                  <span className="shrink-0">
                    {Math.round(sc.rata)} lk/mnt · terberat {Math.round(sc.terberat)}
                  </span>
                </div>
                <div className="mt-0.5 h-1.5 overflow-hidden rounded bg-slate-800">
                  <div
                    className="h-full rounded"
                    style={{
                      width: `${Math.min(100, (sc.rata / Math.max(1, ambang.perMenit.mustahil)) * 100)}%`,
                      background: TINGKAT_WARNA[sc.tingkatAkhir],
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div
            className="flex items-center justify-between rounded bg-slate-800/60 px-2 py-1.5 text-[11px]"
            data-testid="analitik-ukuran-langkah"
          >
            <span className="text-slate-400">Langkah terbesar</span>
            <span
              className="font-semibold"
              style={{
                color: TINGKAT_WARNA[tingkatLangkahDari(analisis.langkahTerbesarInci, ambang.inci)],
              }}
            >
              {Math.round(analisis.langkahTerbesarInci * 10) / 10}&Prime; ·{' '}
              {TINGKAT_LABEL[tingkatLangkahDari(analisis.langkahTerbesarInci, ambang.inci)]}
            </span>
          </div>

          {terberat && (
            <p className="text-[11px] text-slate-400">
              Set terberat di drill ini: <b className="text-slate-200">{terberat.nama}</b> (set{' '}
              {terberat.urutan}) — rata² {Math.round(terberat.rata)} langkah/menit.
            </p>
          )}

          {analisis.peringatan.length > 0 ? (
            <div className="rounded border border-amber-600/40 bg-amber-950/30 p-2">
              <p className="mb-1 text-[11px] font-medium text-amber-300">
                {analisis.peringatan.length} gerakan berat / mustahil
              </p>
              <ul className="space-y-0.5" data-testid="analitik-peringatan">
                {analisis.peringatan.slice(0, 8).map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="truncate text-slate-300">
                      {rosterById.get(d.id) ? <NamaTampil anggota={rosterById.get(d.id)!} /> : d.nama}
                    </span>
                    <span className="shrink-0" style={{ color: TINGKAT_WARNA[d.tingkatAkhir] }}>
                      {d.tingkatAkhir === d.tingkatLangkah && d.tingkatAkhir === d.tingkat
                        ? `${Math.round(d.langkahPerMenit)} lk/mnt · ${Math.round(d.ukuranLangkahInci)}\u2033`
                        : d.tingkatAkhir === d.tingkatLangkah
                          ? `${Math.round(d.ukuranLangkahInci)}\u2033 langkah`
                          : `${Math.round(d.langkahPerMenit)} lk/mnt`}
                    </span>
                  </li>
                ))}
              </ul>
              {analisis.peringatan.length > 8 && (
                <p className="mt-1 text-[10px] text-slate-500">
                  …dan {analisis.peringatan.length - 8} pemain lainnya
                </p>
              )}
            </div>
          ) : (
            <p className="text-[11px] text-emerald-400">
              Semua gerakan masih nyaman atau sekadar agak padat.
            </p>
          )}

          <p className="text-[11px] leading-relaxed text-slate-500">
            Ambang: nyaman ≤ {AMBANG.padat} · padat ≤ {AMBANG.berat} · berat ≤ {AMBANG.mustahil} ·
            mustahil &gt; {AMBANG.mustahil} langkah/menit. Dihitung dari tempo {drill.tempo} BPM
            dan {drill.beatsPerCount} ketuk/hitungan.
          </p>
        </div>
      )}
    </Card>
  )
}
