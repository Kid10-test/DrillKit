/**
 * v2.13 — Tarik otomatis isian Google Form saat Absensi dibuka.
 *
 * Bila Sheet jawaban sudah pernah dipilih (Impor Form → Pilih Sheet) dan
 * izin Google masih berlaku, isian terbaru ditarik dan diterapkan sendiri —
 * saat halaman dibuka lalu tiap 5 menit selama halaman terbuka. Tanpa izin
 * yang berlaku (habis ±1 jam) cukup satu ketukan "Tarik sekarang", karena
 * jendela izin Google hanya boleh dibuka oleh ketukan.
 *
 * Pengimpornya dimuat malas saat menarik, supaya halaman Absensi tetap ringan.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ProgramLatihan } from '../../db/types'
import { saveSettings } from '../../db/db'
import { useSettings } from '../../hooks/useSettings'
import { useGoogle } from '../google/useGoogle'
import { Button, useToast } from '../ui'
import { cx } from '../../lib/utils'
import type { HasilTarikJenis } from './tarikForm'

const SELANG_MS = 5 * 60_000
const LABEL: Record<HasilTarikJenis['jenis'], string> = { izin: 'izin/sakit', presensi: 'presensi', datang: 'absen fisik' }

/** Terakhir menarik (dibagi antar-pemasangan komponen dalam satu tab). */
let terakhirTarik = 0

const dua = (n: number) => String(n).padStart(2, '0')
const jam = (ms: number) => {
  const d = new Date(ms)
  return `${dua(d.getHours())}.${dua(d.getMinutes())}`
}

export default function TarikOtomatis({ sesiId, program, onBukaImpor }: { sesiId: string; program: ProgramLatihan[]; onBukaImpor: () => void }) {
  const settings = useSettings()
  const toast = useToast()
  const g = useGoogle({ siapkan: true })
  const sumber = settings.sumberForm ?? {}
  const adaSumber = !!(sumber.izin || sumber.presensi || sumber.datang)
  const otomatis = settings.tarikOtomatis !== false
  const [sibuk, setSibuk] = useState(false)
  const [hasil, setHasil] = useState<{ waktu: number; daftar: HasilTarikJenis[] } | null>(null)
  const sibukRef = useRef(false)

  const tarik = useCallback(
    async (manual: boolean) => {
      if (!g.mod || !g.konfig || sibukRef.current) return
      sibukRef.current = true
      setSibuk(true)
      try {
        if (manual) await g.mod.sambung(g.konfig)
        const { tarikSemuaForm } = await import('./tarikForm')
        terakhirTarik = Date.now()
        const daftar = await tarikSemuaForm({ mod: g.mod, sumber, program, sesiAwal: sesiId })
        setHasil({ waktu: Date.now(), daftar })
        const ditulis = daftar.reduce((n, x) => n + x.jumlah, 0)
        const galat = daftar.find((x) => x.galat)
        if (galat) toast.push(`Tarik ${LABEL[galat.jenis]}: ${galat.galat}`, 'err')
        else if (manual || ditulis) toast.push(ditulis ? `${ditulis} isian Form baru diterapkan` : 'Tidak ada isian Form baru')
      } catch (e) {
        toast.push(g.mod.pesanGalat(e), 'err')
      } finally {
        sibukRef.current = false
        setSibuk(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [g.mod, g.konfig, sesiId, program, settings.sumberForm],
  )

  const bisaOtomatis = otomatis && adaSumber && g.online && g.tersambung && !!g.mod && !!g.konfig
  useEffect(() => {
    if (!bisaOtomatis) return
    const jalan = () => {
      if (document.visibilityState === 'visible' && Date.now() - terakhirTarik >= SELANG_MS) void tarik(false)
    }
    jalan()
    const t = window.setInterval(jalan, 30_000)
    document.addEventListener('visibilitychange', jalan)
    return () => {
      window.clearInterval(t)
      document.removeEventListener('visibilitychange', jalan)
    }
  }, [bisaOtomatis, tarik])

  if (!adaSumber || !g.konfig) return null

  const ditulis = hasil?.daftar.reduce((n, x) => n + x.jumlah, 0) ?? 0
  const perluCek = hasil?.daftar.reduce((n, x) => n + x.perluCek, 0) ?? 0
  const nama = [...new Set(Object.values(sumber).map((s) => s!.nama))].join(', ')

  return (
    <div
      data-testid="tarik-otomatis"
      className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2 text-[12px] text-slate-400"
    >
      <span className="min-w-0 flex-1">
        <b className="text-slate-200">Form</b> · {nama}
        {' — '}
        {!g.online ? (
          'luring; isian ditarik saat ada internet'
        ) : sibuk ? (
          'menarik isian…'
        ) : hasil ? (
          <span data-testid="tarik-hasil">
            ditarik {jam(hasil.waktu)}
            {ditulis ? ` · ${ditulis} isian baru` : ' · tidak ada yang baru'}
            {hasil.daftar
              .filter((x) => x.jumlah)
              .map((x) => ` (${x.jumlah} ${LABEL[x.jenis]})`)
              .join('')}
          </span>
        ) : g.tersambung ? (
          otomatis ? 'ditarik otomatis tiap 5 menit' : 'tarik otomatis mati'
        ) : (
          'izin Google habis — ketuk Tarik sekarang'
        )}
        {perluCek > 0 && (
          <>
            {' · '}
            <button type="button" data-testid="tarik-perlu-cek" className={cx('font-medium text-amber-300 underline')} onClick={onBukaImpor}>
              {perluCek} isian perlu dicek
            </button>
          </>
        )}
      </span>
      <label className="flex items-center gap-1">
        <input
          type="checkbox"
          data-testid="tarik-otomatis-saklar"
          checked={otomatis}
          onChange={(e) => void saveSettings({ tarikOtomatis: e.target.checked ? undefined : false })}
        />
        otomatis
      </label>
      <Button size="sm" data-testid="tarik-sekarang" disabled={sibuk || !g.online || !g.mod} onClick={() => void tarik(true)}>
        Tarik sekarang
      </Button>
    </div>
  )
}
