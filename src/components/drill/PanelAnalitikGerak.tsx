/**
 * #12c & #24 (`v2.2.2`) — Panel Analitik Gerakan, Pemeriksa Tabrakan Lintasan,
 * Kerataan Interval Barisan, & Penyelesai Silang 1-Klik.
 *
 * Seluruh pemeriksaan #24 disatukan langsung di dalam kartu `Analitik gerakan`
 * agar tidak menumpuk kartu kembar di bilah samping kanan.
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
import type {
  HasilPemeriksaanTabrakan,
  KejadianTabrakan,
  SaranTukarSilang,
  TemuanKerataanSpasi,
} from '../../lib/tabrakanDrill'
import { cx } from '../../lib/utils'
import { NamaTampil } from '../NamaTampil'
import { Button, Card, Toggle } from '../ui'

export function PanelAnalitikGerak({
  drill,
  adaSetBerikut = true,
  nyalaAnalitik,
  onToggleAnalitik,
  analisis,
  ambang,
  terberat,
  rosterById,
  hasilTabrakan,
  tampilCincinTabrakan = true,
  onToggleCincinTabrakan,
  onFokusBenturan,
  saranTukarSilang = [],
  idPratinjauTukar,
  onPratinjauTukar,
  onTukarSatuPasangan,
  onTukarSemuaSilang,
  temuanSpasi = [],
  onPilihBarisanSpasi,
  onRatakanSpasi,
  onIkatKeGarisHidup,
}: {
  drill: Drill
  adaSetBerikut?: boolean
  nyalaAnalitik: boolean
  onToggleAnalitik: (v: boolean) => void
  analisis: ReturnType<typeof analisisPerpindahan>
  ambang: ReturnType<typeof ambangEfektif>
  terberat: ReturnType<typeof setTerberat>
  rosterById: Map<string, Member>
  hasilTabrakan?: HasilPemeriksaanTabrakan
  tampilCincinTabrakan?: boolean
  onToggleCincinTabrakan?: (v: boolean) => void
  onFokusBenturan?: (k: KejadianTabrakan) => void
  saranTukarSilang?: SaranTukarSilang[]
  idPratinjauTukar?: string | null
  onPratinjauTukar?: (id: string | null) => void
  onTukarSatuPasangan?: (saran: SaranTukarSilang) => void
  onTukarSemuaSilang?: () => void
  temuanSpasi?: TemuanKerataanSpasi[]
  onPilihBarisanSpasi?: (ids: string[]) => void
  onRatakanSpasi?: (temuan: TemuanKerataanSpasi) => void
  onIkatKeGarisHidup?: (temuan: TemuanKerataanSpasi) => void
}) {
  const totalBenturan = hasilTabrakan?.kejadian.length ?? 0

  return (
    <Card>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-200">Analitik gerakan &amp; keselamatan</h2>
        {adaSetBerikut && hasilTabrakan && (
          <span
            data-testid="lencana-ringkas-tabrakan"
            className={cx(
              'rounded-full px-2 py-0.5 text-[10px] font-semibold',
              hasilTabrakan.jmlTabrakan > 0
                ? 'bg-rose-500/20 text-rose-300 ring-1 ring-rose-500/40'
                : hasilTabrakan.jmlNyaris > 0
                  ? 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40'
                  : 'bg-emerald-500/15 text-emerald-300',
            )}
          >
            {totalBenturan === 0
              ? '✓ Jalur aman'
              : hasilTabrakan.jmlTabrakan > 0
                ? `${hasilTabrakan.jmlTabrakan} tabrakan${hasilTabrakan.jmlNyaris ? ` · ${hasilTabrakan.jmlNyaris} nyaris` : ''}`
                : `${hasilTabrakan.jmlNyaris} nyaris senggol`}
          </span>
        )}
      </div>

      {adaSetBerikut ? (
        <>
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

          {/* ---------- #24.1 & #24.2 — Pemeriksa Benturan Lintasan & Properti ---------- */}
          {hasilTabrakan && (
            <div
              className="mt-3 space-y-2 border-t border-slate-800 pt-2.5"
              data-testid="panel-tabrakan-lintasan"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-200">
                  Benturan lintasan &amp; properti
                </span>
                {onToggleCincinTabrakan && (
                  <Toggle
                    checked={tampilCincinTabrakan}
                    onChange={onToggleCincinTabrakan}
                    label="Cincin kanvas"
                  />
                )}
              </div>

              {hasilTabrakan.kejadian.length === 0 ? (
                <p className="text-[11px] text-emerald-400" data-testid="status-tabrakan-aman">
                  Tidak ada benturan lintasan maupun senggolan properti panggung pada perpindahan ini.
                </p>
              ) : (
                <div
                  className={cx(
                    'rounded-lg border p-2',
                    hasilTabrakan.jmlTabrakan > 0
                      ? 'border-rose-700/45 bg-rose-950/25'
                      : 'border-amber-700/45 bg-amber-950/25',
                  )}
                >
                  <p className="mb-1.5 text-[11px] font-medium text-slate-200">
                    Klik baris untuk melompat ke hitungan benturan di garis waktu:
                  </p>
                  <ul className="space-y-1" data-testid="daftar-kejadian-tabrakan">
                    {hasilTabrakan.kejadian.slice(0, 8).map((k, idx) => (
                      <li key={k.id}>
                        <button
                          type="button"
                          data-testid={`fokus-benturan-${idx}`}
                          onClick={() => onFokusBenturan?.(k)}
                          className="flex w-full items-center justify-between gap-1.5 rounded-md bg-slate-900/70 px-2 py-1 text-left text-[11px] transition hover:bg-slate-800"
                          title="Lompat scrubber ke hitungan ini & pilih pemain yang berbenturan"
                        >
                          <span className="truncate font-medium text-slate-200">
                            <span
                              className={cx(
                                'mr-1 inline-block h-2 w-2 rounded-full',
                                k.tingkat === 'tabrakan' ? 'bg-rose-500' : 'bg-amber-400',
                              )}
                            />
                            {k.kodeA} × {k.jenis === 'pemain_properti' ? `[${k.kodeB}]` : k.kodeB}
                            {k.jalanMundur && (
                              <span className="ml-1 rounded bg-amber-500/20 px-1 py-0.5 text-[9px] text-amber-300">
                                mundur
                              </span>
                            )}
                          </span>
                          <span className="shrink-0 font-mono text-[10px] text-rose-300">
                            c{k.padaCount} · {k.jarakLangkah.toFixed(1)}/{k.batasAmanLangkah.toFixed(1)} lk
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  {hasilTabrakan.kejadian.length > 8 && (
                    <p className="mt-1 text-[10px] text-slate-400">
                      …dan {hasilTabrakan.kejadian.length - 8} titik rawan lainnya.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ---------- #24.4 — Penyelesai Silang 1-Klik (2-Opt Uncrosser) ---------- */}
          {saranTukarSilang.length > 0 && (
            <div
              className="mt-3 space-y-2 rounded-lg border border-sky-700/40 bg-sky-950/20 p-2.5"
              data-testid="panel-tukar-silang"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-sky-200">
                    {saranTukarSilang.length} jalur seksi bersilangan
                  </p>
                  <p className="text-[10px] text-slate-400">
                    Tukar titik tujuan di set berikutnya agar bebas silang &amp; lebih dekat:
                  </p>
                </div>
                {saranTukarSilang.length >= 2 && onTukarSemuaSilang && (
                  <Button
                    size="sm"
                    variant="primary"
                    data-testid="tombol-tukar-semua-silang"
                    onClick={onTukarSemuaSilang}
                    className="shrink-0 px-2 py-1 text-[11px]"
                  >
                    ⇄ Semua ({saranTukarSilang.length})
                  </Button>
                )}
              </div>
              <ul className="space-y-1" data-testid="daftar-saran-tukar">
                {saranTukarSilang.slice(0, 6).map((s, idx) => {
                  const sedangPratinjau = idPratinjauTukar === s.id
                  return (
                    <li
                      key={s.id}
                      data-testid={`baris-tukar-silang-${idx}`}
                      onMouseEnter={() => onPratinjauTukar?.(s.id)}
                      onMouseLeave={() => {
                        if (idPratinjauTukar === s.id) onPratinjauTukar?.(null)
                      }}
                      className={cx(
                        'flex items-center justify-between gap-1.5 rounded-md border px-2 py-1 text-[11px] transition',
                        sedangPratinjau
                          ? 'border-emerald-500/50 bg-emerald-950/35'
                          : 'border-slate-800 bg-slate-900/70',
                      )}
                    >
                      <button
                        type="button"
                        data-testid={`pratinjau-tukar-${idx}`}
                        onClick={() => onPratinjauTukar?.(sedangPratinjau ? null : s.id)}
                        className="truncate text-left text-slate-200 hover:text-emerald-300"
                        title="Klik atau arahkan kursor untuk melihat pratinjau jalur bebas silang di kanvas"
                      >
                        <b>{s.kodeA}</b> ↔ <b>{s.kodeB}</b>{' '}
                        <span className="text-[10px] text-emerald-400">
                          (hemat {s.hematLangkah.toFixed(1)} lk)
                        </span>
                      </button>
                      <Button
                        size="sm"
                        variant="soft"
                        data-testid={`tombol-tukar-pasangan-${idx}`}
                        onClick={() => onTukarSatuPasangan?.(s)}
                        className="shrink-0 px-2 py-0.5 text-[10px]"
                      >
                        ⇄ Tukar
                      </Button>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </>
      ) : (
        <p className="text-[11px] text-slate-500">
          Set penutup (tidak ada perpindahan keluar). Pemeriksaan kerataan spasi barisan tetap aktif di bawah.
        </p>
      )}

      {/* ---------- #24.3 — Pemeriksa Kerataan Spasi Barisan (Spacing Drift) ---------- */}
      <div
        className="mt-3 space-y-1.5 border-t border-slate-800 pt-2.5"
        data-testid="panel-kerataan-spasi"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-slate-200">Kerataan interval barisan</span>
          <span className="text-[10px] text-slate-500">
            {temuanSpasi.length === 0 ? 'Rata' : `${temuanSpasi.length} barisan melenceng`}
          </span>
        </div>

        {temuanSpasi.length === 0 ? (
          <p className="text-[11px] text-slate-500" data-testid="status-spasi-rata">
            Spasi barisan pada set ini sudah seragam (atau terikat ke bentuk hidup).
          </p>
        ) : (
          <ul className="space-y-1.5" data-testid="daftar-temuan-spasi">
            {temuanSpasi.slice(0, 4).map((t, idx) => (
              <li
                key={t.id}
                data-testid={`baris-temuan-spasi-${idx}`}
                className="rounded-lg border border-amber-700/35 bg-amber-950/20 p-2 text-[11px]"
              >
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onPilihBarisanSpasi?.(t.memberIds)}
                    className="truncate font-medium text-amber-200 hover:underline"
                    title="Klik untuk memilih seluruh pemain pada barisan ini"
                  >
                    {t.label}
                  </button>
                  <span className="shrink-0 font-mono text-[10px] text-amber-300">
                    ±{t.simpanganMaksLangkah.toFixed(2)} lk (rata² {t.spasiRataLangkah.toFixed(1)})
                  </span>
                </div>
                <p className="mt-0.5 truncate font-mono text-[10px] text-slate-400">
                  Celah: {t.spasiLangkah.map((s) => s.toFixed(1)).join(' · ')} lk
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {onRatakanSpasi && (
                    <Button
                      size="sm"
                      variant="soft"
                      data-testid={`ratakan-spasi-${idx}`}
                      onClick={() => onRatakanSpasi(t)}
                      className="px-2 py-0.5 text-[10px]"
                    >
                      ⌗ Ratakan spasi
                    </Button>
                  )}
                  {onIkatKeGarisHidup && (
                    <Button
                      size="sm"
                      variant="ghost"
                      data-testid={`ikat-garis-spasi-${idx}`}
                      onClick={() => onIkatKeGarisHidup(t)}
                      className="px-2 py-0.5 text-[10px]"
                      title="Ratakan sekaligus ikat ke Bentuk Garis Hidup (#22) agar tetap rata saat digeser"
                    >
                      ⟋ Ikat ke Garis #22
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  )
}
