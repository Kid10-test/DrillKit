/**
 * #4 — kendali tempo latihan (dekat tombol Putar) + naik otomatis.
 *
 * Komponen ini hanya menampilkan & memanggil balik; penyimpanan per lagu
 * dipegang `useTempoLatihan`, penerapannya oleh mesin metronom.
 */
import { useEffect, useState } from 'react'
import type { NaikOtomatis, TempoLatihan } from '../lib/tempoLatihan'
import {
  BATAS_GESER,
  BATAS_PERSEN,
  TEMPO_ASLI,
  gantiMode,
  geserLangkah,
  labelLatihan,
  labelPutaran,
  latihanAktif,
  rapikanNaik,
  teksNilai,
  terapkanLatihan,
} from '../lib/tempoLatihan'
import { cx } from '../lib/utils'

/** Lencana "Latihan 80%" — dipakai di beberapa tempat. */
export function LencanaLatihan({ nilai, testId }: { nilai: TempoLatihan | null | undefined; testId?: string }) {
  const label = labelLatihan(nilai)
  if (!label) return null
  return (
    <span
      className="ml-1 rounded-full border border-amber-500/50 bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-200"
      data-testid={testId}
    >
      {label}
    </span>
  )
}

const tombol =
  'rounded-lg border border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-200 transition hover:bg-slate-800 disabled:opacity-40'

export function KendaliTempoLatihan({
  nilai,
  onUbah,
  bpmAsli,
  naik,
  onNaik,
  bisaNaik,
  putaran,
}: {
  nilai: TempoLatihan
  onUbah: (t: TempoLatihan) => void
  /** tempo asli yang sedang berlaku (untuk "138 BPM (asli 172)") */
  bpmAsli: number
  naik: NaikOtomatis
  onNaik: (n: NaikOtomatis) => void
  /** ulang bagian menyala — naik otomatis hanya berlaku di sana */
  bisaNaik: boolean
  /** putaran yang sedang berjalan (naik otomatis), `null` kalau tidak berjalan */
  putaran: number | null
}) {
  const aktif = latihanAktif(nilai)
  const naikHidup = naik.on && bisaNaik
  const b = nilai.mode === 'bpm' ? BATAS_GESER : BATAS_PERSEN
  const v = nilai.mode === 'bpm' ? nilai.geser : nilai.persen
  const satuan = nilai.mode === 'bpm' ? ' BPM' : '%'
  const bAsli = Math.round(bpmAsli)
  const bLatihan = Math.round(terapkanLatihan(bpmAsli, nilai))

  return (
    <div
      className={cx(
        'mt-3 rounded-lg border p-2.5',
        aktif ? 'border-amber-500/40 bg-amber-500/5' : 'border-slate-800 bg-slate-950/40',
      )}
      data-testid="kartu-tempo-latihan"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-300">Tempo latihan</span>
          {aktif && (
            <span
              className="rounded-full border border-amber-500/50 bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-200"
              data-testid="lencana-tempo-latihan"
            >
              {labelLatihan(nilai)}
            </span>
          )}
        </div>
        <div className="flex rounded-lg border border-slate-700 p-0.5 text-[10px]">
          {(['persen', 'bpm'] as const).map((m) => (
            <button
              key={m}
              type="button"
              disabled={naikHidup}
              onClick={() => onUbah(gantiMode(nilai, m))}
              data-testid={`mode-latihan-${m}`}
              className={cx(
                'rounded-md px-2 py-0.5 transition disabled:opacity-40',
                nilai.mode === m ? 'bg-slate-700 text-slate-100' : 'text-slate-400 hover:text-slate-200',
              )}
            >
              {m === 'persen' ? 'Persen' : 'BPM'}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={tombol}
          disabled={naikHidup || v <= b.min}
          onClick={() => onUbah(geserLangkah(nilai, -1))}
          data-testid="latihan-kurang"
        >
          −5{satuan}
        </button>
        <span
          className={cx('min-w-[4.5rem] text-center text-sm font-bold tabular-nums', aktif ? 'text-amber-200' : 'text-slate-200')}
          data-testid="latihan-nilai"
        >
          {teksNilai(nilai)}
        </span>
        <button
          type="button"
          className={tombol}
          disabled={naikHidup || v >= b.max}
          onClick={() => onUbah(geserLangkah(nilai, 1))}
          data-testid="latihan-tambah"
        >
          +5{satuan}
        </button>
        <button
          type="button"
          className={tombol}
          disabled={naikHidup || !aktif}
          onClick={() => onUbah({ ...TEMPO_ASLI, mode: nilai.mode })}
          data-testid="latihan-asli"
        >
          Tempo asli
        </button>
        <span className="text-[11px] text-slate-400" data-testid="latihan-bpm">
          {aktif ? (
            <>
              <b className="text-amber-200 tabular-nums">{bLatihan} BPM</b> (asli {bAsli})
            </>
          ) : (
            `${bAsli} BPM`
          )}
        </span>
      </div>
      <p className="mt-1.5 text-[10px] text-slate-500">
        Diterapkan paling akhir pada tempo map, luncuran, dan hitung mundur. Diingat untuk lagu ini di
        perangkat ini saja — data lagu tidak berubah.
      </p>

      {/* Naik otomatis saat mengulang bagian */}
      <div className="mt-2 border-t border-slate-800 pt-2" data-testid="kartu-naik-otomatis">
        <label className="flex items-center gap-2 text-[11px] text-slate-300">
          <input
            type="checkbox"
            checked={naik.on}
            onChange={(e) => onNaik({ ...naik, on: e.target.checked })}
            data-testid="naik-otomatis"
            className="accent-emerald-500"
          />
          Naik otomatis saat mengulang bagian
        </label>
        {naik.on && (
          <>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[11px] text-slate-400">
              <select
                value={naik.mode}
                onChange={(e) => {
                  const mode = e.target.value === 'bpm' ? 'bpm' : 'persen'
                  onNaik(rapikanNaik(mode === 'bpm' ? { ...naik, mode, mulai: -20, sampai: 0 } : { ...naik, mode, mulai: 70, sampai: 100 }))
                }}
                data-testid="naik-mode"
                className="rounded border border-slate-700 bg-slate-950 px-1 py-0.5"
              >
                <option value="persen">persen</option>
                <option value="bpm">BPM</option>
              </select>
              <span>mulai</span>
              <AngkaKecil nilai={naik.mulai} onUbah={(x) => onNaik(rapikanNaik({ ...naik, mulai: x }))} testId="naik-mulai" />
              <span>naik +</span>
              <AngkaKecil nilai={naik.naik} onUbah={(x) => onNaik(rapikanNaik({ ...naik, naik: x }))} testId="naik-langkah" />
              <span>setiap</span>
              <AngkaKecil nilai={naik.tiap} onUbah={(x) => onNaik(rapikanNaik({ ...naik, tiap: x }))} testId="naik-tiap" />
              <span>putaran, sampai</span>
              <AngkaKecil nilai={naik.sampai} onUbah={(x) => onNaik(rapikanNaik({ ...naik, sampai: x }))} testId="naik-sampai" />
              <span>{naik.mode === 'bpm' ? 'BPM' : '%'}</span>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
              <span>Setelah tujuan:</span>
              <select
                value={naik.akhir}
                onChange={(e) => onNaik({ ...naik, akhir: e.target.value === 'berhenti' ? 'berhenti' : 'tetap' })}
                data-testid="naik-akhir"
                className="rounded border border-slate-700 bg-slate-950 px-1 py-0.5"
              >
                <option value="tetap">tetap mengulang di tempo tujuan</option>
                <option value="berhenti">berhenti</option>
              </select>
            </div>
            {!bisaNaik ? (
              <p className="mt-1.5 text-[10px] text-amber-300/90" data-testid="naik-perlu-ulang">
                Nyalakan <b>Ulang bagian</b> di bawah — naik otomatis bekerja tiap putaran bagian itu.
              </p>
            ) : putaran !== null ? (
              <p className="mt-1.5 text-[11px] font-medium text-emerald-300" data-testid="naik-putaran">
                {labelPutaran(naik, putaran)}
              </p>
            ) : (
              <p className="mt-1.5 text-[10px] text-slate-500">
                Tekan Mulai: {labelPutaran(naik, 1)}. Tempo terakhir yang dicapai diingat.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function AngkaKecil({ nilai, onUbah, testId }: { nilai: number; onUbah: (v: number) => void; testId: string }) {
  // Disimpan saat keluar kotak / Enter, supaya mengetik "100" tidak dijepit
  // ke batas bawah begitu angka "1" pertama diketik.
  const [teks, setTeks] = useState(String(nilai))
  useEffect(() => setTeks(String(nilai)), [nilai])
  const simpan = () => {
    const v = Number(teks)
    if (teks.trim() !== '' && Number.isFinite(v)) onUbah(v)
    else setTeks(String(nilai))
  }
  return (
    <input
      type="number"
      value={teks}
      onChange={(e) => setTeks(e.target.value)}
      onBlur={simpan}
      onKeyDown={(e) => {
        if (e.key === 'Enter') simpan()
      }}
      data-testid={testId}
      className="w-14 rounded border border-slate-700 bg-slate-950 px-1 py-0.5 text-center tabular-nums text-slate-200"
    />
  )
}
