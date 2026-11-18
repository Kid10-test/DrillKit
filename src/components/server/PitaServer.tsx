/**
 * v2.14 — pita kehadiran bersama di Absensi: peran perangkat ini, kapan
 * terakhir tersinkron, dan apa artinya bagi isian di sini. Tidak memuat
 * pustaka Supabase; tombol Sinkronkan hanya membangunkan penjaganya.
 */
import { useEffect, useState } from 'react'
import { LABEL_PERAN, bolehIsi, bolehPutus, kapanSinkron, type StatusServer } from '../../lib/kehadiranBersama'
import { cx } from '../../lib/utils'
import { bacaStatusServer } from './statusServer'

export default function PitaServer() {
  const [st, setSt] = useState<StatusServer>(bacaStatusServer)
  const [, setDetak] = useState(0)
  useEffect(() => {
    const f = () => setSt(bacaStatusServer())
    window.addEventListener('drillkit-server', f)
    const t = window.setInterval(() => setDetak((n) => n + 1), 30_000)
    return () => {
      window.removeEventListener('drillkit-server', f)
      window.clearInterval(t)
    }
  }, [])
  if (!st.peran || !st.timId) return null
  const catatan = !bolehIsi(st.peran)
    ? 'Lihat saja — isian di perangkat ini tidak dikirim dan dikembalikan ke versi server.'
    : !bolehPutus(st.peran)
      ? 'Putusan izin/telat tetap di tangan danlat; yang kamu ubah di sini tidak dikirim.'
      : null
  return (
    <div
      data-testid="pita-server"
      className={cx(
        'mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-[12px]',
        st.galat ? 'border-amber-800/60 bg-amber-950/30 text-amber-200' : 'border-slate-800 bg-slate-900/50 text-slate-300',
      )}
    >
      <div className="min-w-0 flex-1">
        <p>
          <b className="text-slate-100">Kehadiran bersama</b> · {LABEL_PERAN[st.peran]}
          {st.aktif ? <> · tersinkron {kapanSinkron(st.terakhir, Date.now())}</> : <> · sinkron otomatis mati</>}
        </p>
        {st.galat && <p className="mt-0.5 text-[11px]">{st.galat}</p>}
        {catatan && <p className="mt-0.5 text-[11px] text-slate-400">{catatan}</p>}
      </div>
      {st.aktif && (
        <button
          type="button"
          data-testid="pita-server-sinkron"
          className="rounded-lg px-2.5 py-1 text-xs font-medium text-emerald-300 ring-1 ring-emerald-800/70 hover:bg-emerald-950/40"
          onClick={() => window.dispatchEvent(new Event('drillkit-server-sinkron'))}
        >
          Sinkronkan
        </button>
      )}
    </div>
  )
}
