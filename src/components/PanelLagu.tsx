/**
 * M1 — Mode lagu: panel "sedang diputar", strip segmen, dan indikator ketuk.
 *
 * Tiga bagian ini sengaja dipisah dari `Music.tsx` supaya masing-masing bisa
 * diuji sendiri dan halaman Musik tidak makin padat.
 *
 * Pola strip segmen meniru **strip set di editor drill**: tombol berjajar yang
 * bisa digulir menyamping, yang aktif disorot, dan diklik untuk loncat.
 */

import type { SegmenWaktu } from '../lib/birama'
import {
  detikSampai,
  durasiBirama,
  formatWaktu,
  indexSegmen,
  labelBirama,
  meterPada,
  rentangSegmen,
} from '../lib/birama'
import { jepitTempo, luncuranPada, tempoBerlaku } from '../lib/metronome'
import type { SegmenTempo } from '../lib/metronome'
import type { LatihTempo, TandaBirama } from '../db/types'
import { labelLatihan, latihanAktif, terapkanLatihan } from '../lib/tempoLatihan'
import type { TempoLatihan } from '../lib/tempoLatihan'
import { cx } from '../lib/utils'

/* --------------------------- Indikator ketuk ------------------------------ */

/**
 * Kotak ketuk yang lebih besar & terbaca daripada versi lama:
 * - angka ketuk ditulis di dalam kotak,
 * - aksen (2) terang, ketuk biasa (1) redup, diam (0) nyaris tak terlihat,
 * - kotak yang sedang berbunyi diberi cincin dan sedikit membesar,
 * - kotak dikelompokkan sesuai pengelompokan sukat, jadi 7/8 = 2+2+3
 *   **kelihatan** sebagai tiga kelompok, bukan tujuh kotak rata.
 */
export function IndikatorKetuk({
  cells,
  subdiv,
  kelompok,
  iAktif,
  testId = 'indikator-ketuk',
}: {
  /** tingkat tiap kotak: 0 diam, 1 biasa, 2 aksen */
  cells: number[]
  /** pembagian per ketuk — dipakai untuk menandai kotak ketuk utama */
  subdiv: number
  /** pengelompokan sukat, hanya untuk memberi jarak antar kelompok */
  kelompok: number[]
  /** index kotak yang sedang berbunyi, -1 kalau tidak ada */
  iAktif: number
  testId?: string
}) {
  // Batas awal tiap kelompok (dalam not penyebut) → dipakai memberi jarak.
  const batas = new Set<number>()
  let pos = 0
  for (const g of kelompok) {
    batas.add(pos)
    pos += g
  }

  return (
    <div className="flex flex-wrap justify-center gap-1" data-testid={testId}>
      {cells.map((c, i) => {
        const menyala = i === iAktif
        const awalKelompok = batas.has(Math.floor(i / Math.max(1, subdiv)))
        const nomor = i % subdiv === 0 ? Math.floor(i / subdiv) + 1 : null
        return (
          <div
            key={i}
            data-testid={`ketuk-${i}`}
            data-tingkat={c}
            data-aktif={menyala ? '1' : '0'}
            className={cx(
              'flex h-9 w-9 items-center justify-center rounded-lg border text-xs font-semibold transition-all',
              awalKelompok ? 'ml-2 first:ml-0' : '',
              menyala ? 'scale-110 ring-2 ring-emerald-300' : '',
              c === 2
                ? menyala
                  ? 'border-emerald-200 bg-emerald-400 text-emerald-950'
                  : 'border-emerald-500/60 bg-emerald-500/30 text-emerald-100'
                : c === 1
                  ? menyala
                    ? 'border-emerald-400 bg-emerald-600 text-white'
                    : 'border-slate-600 bg-slate-800 text-slate-300'
                  : 'border-slate-800 bg-slate-900 text-slate-600',
            )}
            title={nomor ? `Ketuk ${nomor}${c === 2 ? ' (aksen)' : ''}` : 'Pembagian'}
          >
            {nomor ?? '·'}
          </div>
        )
      })}
    </div>
  )
}

/* ----------------------------- Strip segmen -------------------------------- */

/**
 * Strip segmen tempo — meniru strip set di editor drill.
 * Tiap chip: label segmen, rentang birama, tempo, dan sukatnya.
 * Diklik untuk loncat ke birama awal segmen itu.
 */
export function StripSegmen({
  segmen,
  biramaSekarang,
  warisan,
  onLoncat,
}: {
  segmen: (SegmenWaktu & { id: string; label: string })[]
  biramaSekarang: number
  warisan: TandaBirama
  onLoncat: (measure: number) => void
}) {
  if (segmen.length === 0) return null
  const aktif = indexSegmen(segmen, biramaSekarang)

  return (
    <div className="scroll-thin flex gap-2 overflow-x-auto pb-1" data-testid="strip-segmen">
      {segmen.map((s, i) => {
        const r = rentangSegmen(segmen, i)
        const meter = s.birama ?? warisan
        const aktifDiSini = i === aktif
        return (
          <button
            key={s.id}
            data-testid={`chip-segmen-${i}`}
            data-aktif={aktifDiSini ? '1' : '0'}
            onClick={() => onLoncat(s.measure)}
            title={`Loncat ke birama ${s.measure}`}
            className={cx(
              'shrink-0 rounded-lg border px-3 py-2 text-left text-xs transition',
              aktifDiSini
                ? 'border-emerald-600/50 bg-emerald-600/10 text-emerald-200'
                : 'border-slate-800 text-slate-400 hover:bg-slate-800/60',
            )}
          >
            <p className="font-medium">{s.label}</p>
            <p className="text-[10px] opacity-70">
              birama {r?.mulai}
              {r?.selesai ? `–${r.selesai}` : '+'} · {s.bpm} BPM · {labelBirama(meter)}
            </p>
          </button>
        )
      })}
    </div>
  )
}

/* --------------------------- Panel sedang diputar -------------------------- */

/**
 * Panel informasi saat sebuah lagu dipilih. Ini yang bikin halaman Musik
 * "berubah" saat masuk mode lagu: judul, posisi, segmen aktif, sukat yang
 * sedang berlaku, tempo, dan waktu berjalan.
 */
export function PanelSedangDiputar({
  judul,
  measure,
  running,
  segmen,
  warisan,
  tempoDasar,
  pakaiTempoMap,
  segmenTempo,
  latih,
  tempoUntuk,
  latihan,
  tempoKetuk,
  waktuBiramaUntuk,
  durasiBiramaUntuk,
}: {
  judul: string
  /** birama absolut yang sedang berjalan (1-based) */
  measure: number
  running: boolean
  segmen: (SegmenWaktu & { id: string; label: string })[]
  warisan: TandaBirama
  tempoDasar: number
  /** apakah tempo map sedang diikuti */
  pakaiTempoMap: boolean
  /**
   * N7 — tempo map mentah, supaya panel bisa memakai `tempoBerlaku`
   * (satu sumber kebenaran dengan mesin). Tanpa ini panel jatuh ke
   * hitungan tangganya sendiri dan bisa menampilkan angka yang tidak
   * sedang berbunyi.
   */
  segmenTempo?: SegmenTempo[]
  /** N7 — perubahan tempo menyeluruh; ikut menentukan tempo yang berlaku. */
  latih?: LatihTempo | null
  /** N7 — tempo per birama untuk hitungan waktu; lihat `detikSampai`. */
  tempoUntuk?: (birama: number) => number
  /** #4 — tempo latihan; diterapkan paling akhir. */
  latihan?: TempoLatihan | null
  /** Exact original/practice BPM at the last emitted beat, including mid-bar changes. */
  tempoKetuk?: { asli: number; latihan: number } | null
  /** Exact song seconds at measure start from TempoTimeline. */
  waktuBiramaUntuk?: (birama: number) => number
  /** Exact integrated measure duration from TempoTimeline. */
  durasiBiramaUntuk?: (birama: number) => number
}) {
  const idx = indexSegmen(segmen, measure)
  const seg = idx >= 0 ? segmen[idx] : null
  const meter = meterPada(segmen, measure, warisan)
  /**
   * N7 — tempo yang **benar-benar berbunyi**, bukan tempo tangga.
   *
   * Dulu panel memanggil `tempoPada`, yang hanya tahu tempo per segmen.
   * Akibatnya, pada lagu yang meluncur 172 → 161,3 → 150,7 → 140 panel
   * menampilkan 172 pada keempat birama itu: angkanya diam, padahal
   * bunyinya bergerak. Itu berbahaya justru saat mencoba — pelatih
   * melihat angka datar dan menyimpulkan luncurannya tidak jalan.
   */
  const tempo = jepitTempo(tempoKetuk?.asli ?? tempoBerlaku(
    {
      dasar: tempoDasar,
      segmen: segmenTempo ?? [],
      pakaiTempoMap,
      latih: latih ?? null,
      birama: warisan,
    },
    measure,
  ))
  /** #4 — tempo sebelum tempo latihan, untuk "138 BPM (asli 172)". */
  const adaLatihan = latihanAktif(latihan)
  const tempoLatihan = tempoKetuk
    ? jepitTempo(tempoKetuk.latihan)
    : adaLatihan
      ? jepitTempo(terapkanLatihan(tempo, latihan))
      : tempo
  const luncur = pakaiTempoMap ? luncuranPada(segmenTempo ?? [], measure) : null
  const fineMap = (segmenTempo ?? []).some((segment) =>
    segment.beat !== undefined || segment.subdivision !== undefined || segment.rampCounts !== undefined,
  )
  /** Luncuran per-segmen maupun ramp eksplisit mengesampingkan ramp umum. */
  const hasSpecificRamp = (segmenTempo ?? []).some((segment) =>
    segment.berangsur === 1 || (segment.rampCounts ?? 0) > 0,
  )
  const latihDikesampingkan = pakaiTempoMap && !!latih?.on && hasSpecificRamp
  const detik = waktuBiramaUntuk
    ? waktuBiramaUntuk(measure)
    : detikSampai(segmen, measure, warisan, tempoDasar, tempoUntuk)
  const lamaBirama = durasiBiramaUntuk
    ? durasiBiramaUntuk(measure)
    : durasiBirama(meter, tempoLatihan)
  /** Keterangan singkat di bawah angka tempo: kenapa angkanya bergerak. */
  const keteranganTempo = luncur
    ? `berangsur ke bar ${luncur.keBar} (${formatTempo(luncur.ke)} BPM)`
    : latihDikesampingkan
      ? 'luncuran menyeluruh dikesampingkan'
      : latih?.on
        ? `latihan ${latih.langkah > 0 ? '+' : ''}${latih.langkah.toFixed(1)} tiap ${latih.tiap} bar`
        : fineMap
          ? 'tempo map per ketuk/subdivisi'
          : null

  return (
    <div
      className="rounded-lg border border-emerald-700/40 bg-emerald-950/20 p-3"
      data-testid="panel-lagu"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-sm font-semibold text-emerald-100" data-testid="panel-judul">
          {judul}
        </p>
        <p className="text-[11px] text-emerald-300/70" data-testid="panel-waktu">
          {formatWaktu(detik)} · birama ke-
          <span className="font-semibold text-emerald-200" data-testid="panel-birama">
            {measure}
          </span>
          {running ? '' : ' (siap)'}
        </p>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Info
          label="Segmen"
          nilai={seg ? seg.label : '—'}
          testId="panel-segmen"
          tambahan={
            segmen.length
              ? seg
                ? `${idx + 1} dari ${segmen.length}`
                : `sebelum segmen 1`
              : 'tidak ada segmen'
          }
        />
        <Info
          label="Tempo"
          nilai={`${formatTempo(tempoLatihan)} BPM`}
          testId="panel-tempo"
          tambahan={
            adaLatihan
              ? `asli ${formatTempo(tempo)} · ${labelLatihan(latihan)}${keteranganTempo ? ` · ${keteranganTempo}` : ''}`
              : (keteranganTempo ?? undefined)
          }
        />
        <Info
          label="Sukat"
          nilai={labelBirama(meter)}
          testId="panel-sukat"
          tambahan={meter.kelompok.join('+')}
        />
        <Info
          label="1 birama"
          nilai={`${lamaBirama.toFixed(2)} dtk`}
          testId="panel-lama-birama"
          tambahan={pakaiTempoMap ? 'ikut tempo map' : 'tempo datar'}
        />
      </div>

      {!pakaiTempoMap && segmen.length > 0 && (
        <p className="mt-2 text-[11px] text-amber-300/90" data-testid="panel-peringatan-map">
          Tempo map belum diikuti — nyalakan <b>Ikuti tempo map</b> di bawah supaya tempo & sukat
          lagu dipakai saat berjalan.
        </p>
      )}
    </div>
  )
}

/**
 * N7 — tempo untuk ditampilkan: bulat kalau bulat, satu desimal kalau
 * sedang meluncur.
 *
 * Desimalnya sengaja hanya muncul saat tempo benar-benar berada di antara
 * dua angka yang diketik. Jadi "172 BPM" tetap terbaca sebagai angka yang
 * diketik pelatih, sedangkan "161.3 BPM" kelihatan sebagai angka antara —
 * bukti kecil yang langsung terlihat bahwa lagunya memang meluncur.
 */
export function formatTempo(bpm: number): string {
  const n = Math.round(bpm * 10) / 10
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

function Info({
  label,
  nilai,
  tambahan,
  testId,
}: {
  label: string
  nilai: string
  tambahan?: string
  testId?: string
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/50 px-2.5 py-1.5">
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-sm font-semibold text-slate-100" data-testid={testId}>
        {nilai}
      </p>
      {tambahan && <p className="text-[10px] text-slate-500">{tambahan}</p>}
    </div>
  )
}
