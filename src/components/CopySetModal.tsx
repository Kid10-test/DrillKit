import { useMemo, useState } from 'react'
import type { DrillSet } from '../db/types'
import { Button, Modal, Select, useToast } from './ui'
import { cx } from '../lib/utils'

/**
 * Menyalin formasi antar set (A3).
 *
 * Dua arah yang sama-sama sering dipakai:
 * - **salin** → dari set yang sedang dibuka, ke satu/berapa set lain
 *   (mis. "set 5 sampai 8 sama saja dengan set 4").
 * - **ambil** → mengisi set yang sedang dibuka dari set lain
 *   (mis. "set 7 isinya sama dengan set 2").
 *
 * Pilihannya:
 * - **Semua titik** atau **hanya titik yang sedang dipilih**.
 * - **Ganti isi** (target jadi persis sama dengan sumber) atau
 *   **Tambahkan** (titik target yang sudah ada dibiarkan, yang belum ada diisi).
 */
export default function CopySetModal({
  open,
  onClose,
  sets,
  currentId,
  selectedCount,
  mode,
  onApply,
}: {
  open: boolean
  onClose: () => void
  sets: DrillSet[]
  currentId: string
  /** Jumlah titik yang sedang dipilih di editor (0 = tidak ada pilihan). */
  selectedCount: number
  mode: 'salin' | 'ambil'
  onApply: (targetIds: string[], sourceId: string, hanyaTerpilih: boolean, ganti: boolean) => void
}) {
  const toast = useToast()
  const lain = useMemo(() => sets.filter((s) => s.id !== currentId), [sets, currentId])
  const current = sets.find((s) => s.id === currentId)

  const [pilihan, setPilihan] = useState<string[]>([])
  const [sumber, setSumber] = useState<string>('')
  const [cakupan, setCakupan] = useState<'semua' | 'terpilih'>('semua')
  const [ganti, setGanti] = useState(true)

  // Setiap kali dibuka, mulai dari keadaan bersih.
  const kunci = `${open}-${mode}-${currentId}`
  const [kunciTerakhir, setKunciTerakhir] = useState('')
  if (kunci !== kunciTerakhir) {
    setKunciTerakhir(kunci)
    setPilihan([])
    setSumber(lain[0]?.id ?? '')
    setCakupan('semua')
    setGanti(true)
  }

  const sumberId = mode === 'salin' ? currentId : sumber
  const targetIds = mode === 'salin' ? pilihan : [currentId]
  const sumberNama = sets.find((s) => s.id === sumberId)?.name ?? '-'
  const bisa = targetIds.length > 0 && !!sumberId && (cakupan === 'semua' || selectedCount > 0)

  function terapkan() {
    if (!bisa) return
    onApply(targetIds, sumberId, cakupan === 'terpilih', ganti)
    toast.push(
      mode === 'salin'
        ? `${targetIds.length} set diisi dari "${sumberNama}"`
        : `"${current?.name ?? 'Set ini'}" diisi dari "${sumberNama}"`,
    )
    onClose()
  }

  function toggle(id: string) {
    setPilihan((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  }

  return (
    <Modal open={open} onClose={onClose} title={mode === 'salin' ? 'Salin formasi ke set lain' : 'Ambil formasi dari set lain'}>
      <p className="text-xs leading-relaxed text-slate-400">
        {mode === 'salin' ? (
          <>
            Isi <b>{current?.name}</b> akan disalin ke set yang kamu centang di bawah.
          </>
        ) : (
          <>
            Pilih sumbernya — isinya akan disalin ke <b>{current?.name}</b>.
          </>
        )}
      </p>

      {mode === 'ambil' && (
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">Ambil dari set</label>
          <Select value={sumber} onChange={(e) => setSumber(e.target.value)}>
            {lain.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {Object.keys(s.points).length} titik
              </option>
            ))}
          </Select>
        </div>
      )}

      {mode === 'salin' && (
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="block text-xs font-medium text-slate-400">Set tujuan</label>
            <button
              type="button"
              className="text-[11px] text-sky-400 hover:underline"
              onClick={() => setPilihan(pilihan.length === lain.length ? [] : lain.map((s) => s.id))}
            >
              {pilihan.length === lain.length ? 'Kosongkan' : 'Pilih semua'}
            </button>
          </div>
          <div className="scroll-thin max-h-52 space-y-1 overflow-y-auto rounded-lg border border-slate-800 p-1">
            {lain.map((s) => (
              <label
                key={s.id}
                className={cx(
                  'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm',
                  pilihan.includes(s.id) ? 'bg-emerald-600/15 text-emerald-200' : 'text-slate-300 hover:bg-slate-800/60',
                )}
              >
                <input
                  type="checkbox"
                  checked={pilihan.includes(s.id)}
                  onChange={() => toggle(s.id)}
                  className="h-4 w-4 accent-emerald-500"
                />
                <span className="min-w-0 flex-1 truncate">{s.name}</span>
                <span className="shrink-0 text-[11px] text-slate-500">
                  {Object.keys(s.points).length} titik
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="mb-1 block text-xs font-medium text-slate-400">Yang disalin</p>
        <div className="space-y-1">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
            <input
              type="radio"
              name="cakupan"
              checked={cakupan === 'semua'}
              onChange={() => setCakupan('semua')}
              className="h-4 w-4 accent-emerald-500"
            />
            Semua titik
          </label>
          <label
            className={cx(
              'flex items-center gap-2 text-sm',
              selectedCount > 0 ? 'cursor-pointer text-slate-300' : 'text-slate-600',
            )}
          >
            <input
              type="radio"
              name="cakupan"
              checked={cakupan === 'terpilih'}
              disabled={selectedCount === 0}
              onChange={() => setCakupan('terpilih')}
              className="h-4 w-4 accent-emerald-500"
            />
            Hanya {selectedCount} titik yang dipilih
            {selectedCount === 0 && <span className="text-[11px] text-slate-600">— pilih titik dulu</span>}
          </label>
        </div>
      </div>

      <div>
        <p className="mb-1 block text-xs font-medium text-slate-400">Cara mengisi</p>
        <div className="space-y-1">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
            <input
              type="radio"
              name="cara"
              checked={ganti}
              onChange={() => setGanti(true)}
              className="h-4 w-4 accent-emerald-500"
            />
            Ganti isi (target jadi sama persis dengan sumber)
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
            <input
              type="radio"
              name="cara"
              checked={!ganti}
              onChange={() => setGanti(false)}
              className="h-4 w-4 accent-emerald-500"
            />
            Tambahkan (yang sudah ada di target dibiarkan)
          </label>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Batal
        </Button>
        <Button variant="primary" onClick={terapkan} disabled={!bisa}>
          {mode === 'salin' ? 'Salin sekarang' : 'Ambil sekarang'}
        </Button>
      </div>
    </Modal>
  )
}
