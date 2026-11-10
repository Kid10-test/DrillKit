/**
 * #34a — kartu Dashboard: hitung mundur H-Minus terpadu (tonggak Program
 * Latsar, kejuaraan & gerbang musim, penampilan Jadwal) + kolom "Fokus
 * minggu ini" dari Papan Tindak Lanjut. Dimuat malas; tidak tampil bila
 * keduanya kosong.
 */
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import type { Session } from '../../db/types'
import { useSettings } from '../../hooks/useSettings'
import { NAMA_BULAN } from '../../lib/kalender'
import { LABEL_ASAL_TITIK, WARNA_STATUS_GERBANG, labelH, teksSisa, titikHMinus } from '../../lib/manajemenMusim'
import { BATAS_FOKUS, konteksTL, ubahStatusTL, urutkanTindakLanjut } from '../../lib/tindakLanjut'
import { sectionLabel, todayISO } from '../../lib/utils'
import { Card } from '../ui'
import { useRingkasMusim } from './useDataMusim'

const tgl = (iso: string) => `${Number(iso.slice(8))} ${NAMA_BULAN[Number(iso.slice(5, 7)) - 1]?.slice(0, 3) ?? ''}`
const MAKS_TITIK = 5

export default function KartuMusimDasbor({ sessions }: { sessions: Session[] }) {
  const settings = useSettings()
  const hariIni = todayISO()
  const { ringkas } = useRingkasMusim(settings.musimTc)
  const fokus = useLiveQuery(async () => urutkanTindakLanjut(await db.tindakLanjut.where('status').equals('fokus').toArray()), [], [])
  // Dashboard hanya memuat gerbang yang mendesak (≤ 7 hari / lewat tenggat);
  // daftar lengkapnya ada di Evaluasi → Musim & Papan Staf.
  const titik = useMemo(
    () =>
      titikHMinus({ program: settings.programLatihan, ringkas, sessions, hariIni }).filter(
        (t) => t.asal !== 'gerbang' || t.status === 'terlambat' || t.status === 'dekat',
      ),
    [settings.programLatihan, ringkas, sessions, hariIni],
  )
  const terlambat = titik.filter((t) => t.status === 'terlambat').length
  if (!titik.length && !fokus.length) return null
  const tampil = titik.slice(0, MAKS_TITIK)

  return (
    <Card className="mb-4 space-y-3 p-3" data-testid="kartu-musim-dasbor">
      {titik.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-200">
              Hitung mundur
              {terlambat > 0 && (
                <span data-testid="dasbor-gerbang-terlambat" className="ml-2 rounded px-1.5 py-0.5 text-[10px] font-semibold text-white" style={{ background: WARNA_STATUS_GERBANG.terlambat }}>
                  {terlambat} gerbang lewat tenggat
                </span>
              )}
            </h2>
            <Link to="/evaluasi?tab=papan" className="text-xs font-medium text-emerald-400 hover:text-emerald-300">
              Musim & gerbang →
            </Link>
          </div>
          <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {tampil.map((t) => (
              <li
                key={t.id}
                data-testid={`titik-${t.id}`}
                data-asal={t.asal}
                className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/40 px-2 py-1.5"
                style={t.status ? { borderLeft: `3px solid ${WARNA_STATUS_GERBANG[t.status]}` } : undefined}
              >
                <span className="w-14 shrink-0 text-center font-mono text-base font-bold tabular-nums text-slate-100">{t.sisa == null ? '?' : labelH(t.sisa)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-slate-100">{t.nama}</span>
                  <span className="block truncate text-[11px] text-slate-500">
                    {t.tanggal ? `${tgl(t.tanggal)} · ${teksSisa(t.sisa!)}` : 'tanggal belum ditentukan'} · {t.keterangan ?? LABEL_ASAL_TITIK[t.asal]}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          {titik.length > MAKS_TITIK && <p className="text-[11px] text-slate-500">+{titik.length - MAKS_TITIK} lainnya</p>}
        </div>
      )}

      {fokus.length > 0 && (
        <div className="space-y-1.5" data-testid="fokus-dasbor">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-200">
              Fokus minggu ini <span className="text-xs font-normal text-slate-500">· {fokus.length}{fokus.length > BATAS_FOKUS ? ` (sebaiknya ≤ ${BATAS_FOKUS})` : ''}</span>
            </h2>
            <Link to="/evaluasi?tab=papan" className="text-xs font-medium text-emerald-400 hover:text-emerald-300">
              Papan staf →
            </Link>
          </div>
          <ul className="space-y-1">
            {fokus.slice(0, BATAS_FOKUS + 2).map((t) => (
              <li key={t.id} data-testid={`fokus-dasbor-${t.id}`} className="flex min-w-0 items-start gap-2 rounded-lg border border-slate-800 bg-slate-950/40 px-2 py-1.5">
                <button
                  type="button"
                  data-testid={`fokus-beres-${t.id}`}
                  onClick={() => void db.tindakLanjut.put(ubahStatusTL(t, 'beres'))}
                  title="Tandai beres"
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border border-slate-500 text-[10px] leading-none text-transparent hover:border-emerald-400 hover:text-emerald-400"
                >
                  ✓
                </button>
                <span className="min-w-0 flex-1">
                  <span className="block break-words text-xs text-slate-100">
                    {t.prioritas === 'tinggi' && <b className="mr-1 text-rose-400">!</b>}
                    {t.judul}
                  </span>
                  <span className="block text-[10px] text-slate-500">{[konteksTL(t), t.seksi ? sectionLabel(t.seksi) : ''].filter(Boolean).join(' · ')}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}
