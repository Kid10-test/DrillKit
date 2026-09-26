import { useEffect, useState } from 'react'
import { bacaModeNama, langgananModeNama, simpanModeNama, type ModeNama } from '../lib/namaAnggota'

/** Pilihan per perangkat: nama lengkap atau nama panggilan. */
export function PilihModeNama({ ringkas = false }: { ringkas?: boolean }) {
  const [mode, setMode] = useState<ModeNama>(bacaModeNama)
  useEffect(() => langgananModeNama(setMode), [])

  return (
    <div data-testid="pilih-mode-nama">
      {!ringkas && (
        <p className="mb-1.5 text-[11px] text-slate-500">
          Nama yang tampil di perangkat ini. Laporan dan kartu kehadiran tetap nama lengkap.
        </p>
      )}
      <div className="flex gap-1.5">
        <button
          type="button"
          data-testid="nama-lengkap"
          onClick={() => setMode(simpanModeNama('lengkap'))}
          className={`rounded-lg px-2.5 py-1 text-[11px] font-medium ${
            mode === 'lengkap' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          Nama lengkap
        </button>
        <button
          type="button"
          data-testid="nama-panggilan"
          onClick={() => setMode(simpanModeNama('panggilan'))}
          className={`rounded-lg px-2.5 py-1 text-[11px] font-medium ${
            mode === 'panggilan' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          Nama panggilan
        </button>
      </div>
    </div>
  )
}
