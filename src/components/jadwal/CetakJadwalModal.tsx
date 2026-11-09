/**
 * #35 — pilihan cetak kalender bulan: A4 tegak bergaya poster (Goals &
 * Catatan, seperti kalender cetak unit) atau A4 mendatar yang lama (detail
 * jam & tempat). Pembangun A4 tegak dimuat malas.
 */
import { useEffect, useState } from 'react'
import type { Session } from '../../db/types'
import { Button, Input, Modal, Textarea, useToast } from '../ui'
import { NAMA_BULAN, htmlKalenderBulan } from '../../lib/kalender'
import { cetakAtauUnduh } from '../../lib/laporan'
import { sesiMeta } from '../../lib/utils'
import { useSettings } from '../../hooks/useSettings'
import { useSeksiAktif } from '../../hooks/useSeksiAktif'

type ModulCetak = typeof import('../../lib/jadwalCetak')

/** Muat modul cetak Jadwal sekali, saat dibutuhkan (tidak masuk bundel awal). */
export function useModulCetakJadwal(aktif: boolean): ModulCetak | null {
  const [mod, setMod] = useState<ModulCetak | null>(null)
  useEffect(() => {
    if (!aktif || mod) return
    let batal = false
    import('../../lib/jadwalCetak').then((m) => !batal && setMod(m))
    return () => {
      batal = true
    }
  }, [aktif, mod])
  return mod
}

const KUNCI_CETAK = 'drillkit.jadwal.cetak.v1'

interface SimpanCetak {
  orientasi: 'tegak' | 'mendatar'
  mulaiMinggu: boolean
  komposisi: boolean
  /** Goals & catatan per bulan, kunci `YYYY-MM`. */
  bulan: Record<string, { goals: string[]; catatan: string }>
}

function bacaSimpan(): SimpanCetak {
  try {
    const x = JSON.parse(localStorage.getItem(KUNCI_CETAK) ?? 'null')
    if (x && typeof x === 'object') {
      return {
        orientasi: x.orientasi === 'mendatar' ? 'mendatar' : 'tegak',
        mulaiMinggu: x.mulaiMinggu !== false,
        komposisi: !!x.komposisi,
        bulan: x.bulan && typeof x.bulan === 'object' ? x.bulan : {},
      }
    }
  } catch {
    /* rusak / diblokir */
  }
  return { orientasi: 'tegak', mulaiMinggu: true, komposisi: false, bulan: {} }
}

export function CetakJadwalModal({
  open,
  onClose,
  tahun,
  bulan,
  sesi,
}: {
  open: boolean
  onClose: () => void
  tahun: number
  bulan: number
  sesi: Session[]
}) {
  const settings = useSettings()
  const seksi = useSeksiAktif()
  const toast = useToast()
  const mod = useModulCetakJadwal(open)
  const kunciBulan = `${tahun}-${String(bulan).padStart(2, '0')}`
  const [simpan, setSimpan] = useState<SimpanCetak>(bacaSimpan)
  useEffect(() => {
    if (open) setSimpan(bacaSimpan())
  }, [open])
  const isi = simpan.bulan[kunciBulan] ?? { goals: ['', '', '', ''], catatan: '' }
  const goals = [...isi.goals]
  while (goals.length < 4) goals.push('')

  function ubah(p: Partial<SimpanCetak>) {
    const baru = { ...simpan, ...p }
    setSimpan(baru)
    try {
      localStorage.setItem(KUNCI_CETAK, JSON.stringify(baru))
    } catch {
      /* abaikan */
    }
  }
  const ubahBulan = (p: Partial<{ goals: string[]; catatan: string }>) =>
    ubah({ bulan: { ...simpan.bulan, [kunciBulan]: { ...isi, goals, ...p } } })

  function cetak() {
    const dalam = sesi.filter((s) => s.date.startsWith(kunciBulan))
    const nama = `jadwal-${kunciBulan}${simpan.orientasi === 'tegak' ? '-tegak' : ''}.html`
    const html =
      simpan.orientasi === 'tegak' && mod
        ? mod.htmlKalenderTegak(tahun, bulan, dalam, {
            namaTim: settings.teamName,
            mulaiMinggu: simpan.mulaiMinggu,
            goals: goals.filter((g) => g.trim()),
            catatan: isi.catatan,
            komposisi: simpan.komposisi,
            seksi: seksi.map((s) => s.id),
            label: (t) => sesiMeta(t).label,
          })
        : htmlKalenderBulan(tahun, bulan, sesi, { namaTim: settings.teamName, label: (t) => sesiMeta(t).label })
    const dicetak = cetakAtauUnduh(html, nama)
    if (!dicetak) toast.push('Jendela cetak diblokir — berkas HTML diunduh, buka lalu tekan Ctrl+P', 'info')
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Cetak ${NAMA_BULAN[bulan - 1]} ${tahun}`}
      testId="modal-cetak-jadwal"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button variant="primary" data-testid="cetak-ya" disabled={simpan.orientasi === 'tegak' && !mod} onClick={cetak}>
            Cetak
          </Button>
        </>
      }
    >
      <div className="grid gap-2 sm:grid-cols-2">
        {(
          [
            ['tegak', 'A4 tegak — gaya poster', 'Judul bulan besar, kotak tanggal, Goals & Catatan. Cocok ditempel/dibagikan.'],
            ['mendatar', 'A4 mendatar — detail', 'Jam, judul, jenis & tempat tiap sesi.'],
          ] as const
        ).map(([v, judul, ket]) => (
          <label
            key={v}
            className={`cursor-pointer rounded-lg border p-3 text-sm ${
              simpan.orientasi === v ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-700'
            }`}
          >
            <span className="flex items-center gap-2 font-medium text-slate-100">
              <input type="radio" name="orientasi-cetak" data-testid={`cetak-${v}`} checked={simpan.orientasi === v} onChange={() => ubah({ orientasi: v })} />
              {judul}
            </span>
            <span className="mt-1 block text-[11px] text-slate-400">{ket}</span>
          </label>
        ))}
      </div>

      {simpan.orientasi === 'tegak' && (
        <>
          <div className="flex flex-wrap gap-4 text-sm text-slate-300">
            <label className="flex items-center gap-2">
              <input type="checkbox" data-testid="cetak-mulai-minggu" checked={simpan.mulaiMinggu} onChange={(e) => ubah({ mulaiMinggu: e.target.checked })} />
              Minggu dimulai hari Minggu
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" data-testid="cetak-komposisi" checked={simpan.komposisi} onChange={(e) => ubah({ komposisi: e.target.checked })} />
              Tampilkan komposisi ranah tiap sesi
            </label>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-slate-400">Goals bulan ini</p>
            <div className="space-y-1.5">
              {goals.slice(0, 4).map((g, i) => (
                <Input
                  key={i}
                  data-testid={`cetak-goal-${i}`}
                  value={g}
                  onChange={(e) => ubahBulan({ goals: goals.map((x, j) => (j === i ? e.target.value : x)) })}
                  placeholder={i === 0 ? 'mis. Penempatan seksi selesai 20 Nov' : ''}
                />
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-slate-400">Catatan</p>
            <Textarea data-testid="cetak-catatan" value={isi.catatan} onChange={(e) => ubahBulan({ catatan: e.target.value })} placeholder="Kosongkan untuk kotak catatan bertitik." />
          </div>
          <p className="text-[11px] text-slate-500">Goals & catatan diingat per bulan di perangkat ini.</p>
        </>
      )}
    </Modal>
  )
}
