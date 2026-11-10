/**
 * v2.7.1 — Pratinjau impor CSV anggota: cocokkan nama dulu, baru tulis.
 *
 * Sebelumnya impor selalu menambah kartu baru, sehingga returner yang sudah
 * ada di DrillKit tercatat dobel. Sekarang tiap baris diberi label Baru /
 * Diperbarui / Tanpa perubahan / Perlu dicek; baris "Perlu dicek" (nama
 * mirip) memilih sendiri: orang baru atau sama dengan kartu lama.
 */
import { useMemo, useState } from 'react'
import { db } from '../../db/db'
import type { Member } from '../../db/types'
import {
  type BarisRencanaImpor,
  type KeputusanImpor,
  type RencanaImpor,
  hasilImporCsv,
} from '../../lib/rosterAnggota'
import { ROLE_LABEL, cx, sectionLabel, uid } from '../../lib/utils'
import { Button, Modal, useToast } from '../ui'

const LABEL_JENIS: Record<BarisRencanaImpor['jenis'], string> = {
  baru: 'Baru',
  perbarui: 'Diperbarui',
  sama: 'Tanpa perubahan',
  mirip: 'Perlu dicek',
}

const WARNA_JENIS: Record<BarisRencanaImpor['jenis'], string> = {
  baru: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  perbarui: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
  sama: 'border-slate-700 bg-slate-800/60 text-slate-400',
  mirip: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
}

const label = { section: sectionLabel, peran: (r: Member['role']) => ROLE_LABEL[r] ?? r }

export function ImporCsvAnggota({
  rencana,
  lokal,
  namaBerkas,
  onClose,
}: {
  rencana: RencanaImpor | null
  lokal: Member[]
  namaBerkas?: string
  onClose: () => void
}) {
  const toast = useToast()
  const [keputusan, setKeputusan] = useState<Record<number, KeputusanImpor>>({})
  const [saring, setSaring] = useState<'semua' | BarisRencanaImpor['jenis']>('semua')
  const [sibuk, setSibuk] = useState(false)
  const petaLokal = useMemo(() => new Map(lokal.map((m) => [m.id, m])), [lokal])

  const pratinjau = useMemo(
    () =>
      rencana
        ? hasilImporCsv({ rencana, lokal, keputusan, buatId: () => 'x', buatToken: () => 'x', label })
        : null,
    [rencana, lokal, keputusan],
  )

  if (!rencana || !pratinjau) return null
  const tampil = rencana.baris.filter((r) => saring === 'semua' || r.jenis === saring)

  async function terapkan() {
    if (!rencana) return
    setSibuk(true)
    try {
      const hasil = hasilImporCsv({
        rencana,
        lokal,
        keputusan,
        buatId: () => uid('m_'),
        buatToken: () => uid('t_'),
        label,
      })
      await db.members.bulkPut(hasil.tulis)
      const bagian = [`${hasil.baru} baru`, `${hasil.diperbarui} diperbarui`]
      if (hasil.tetap) bagian.push(`${hasil.tetap} tanpa perubahan`)
      toast.push(`Impor selesai: ${bagian.join(' · ')}`)
      onClose()
    } catch {
      toast.push('Gagal menyimpan hasil impor', 'err')
    } finally {
      setSibuk(false)
    }
  }

  return (
    <Modal
      open
      wide
      testId="impor-csv-anggota"
      title={`Pratinjau impor anggota${namaBerkas ? ` — ${namaBerkas}` : ''}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button
            variant="primary"
            data-testid="impor-csv-terapkan"
            disabled={sibuk || pratinjau.tulis.length === 0}
            onClick={() => void terapkan()}
          >
            Terapkan ({pratinjau.baru} baru · {pratinjau.diperbarui} diperbarui)
          </Button>
        </>
      }
    >
      <p className="mb-3 text-xs text-slate-400">
        Nama dicocokkan dengan anggota yang sudah ada. Yang sama <b>diperbarui</b>, bukan
        digandakan: hanya sel yang terisi yang menimpa data lama, dan tag ditambahkan (tidak pernah
        dilepas). Kode chart anggota lama tidak diubah.
      </p>
      <div className="mb-3 flex flex-wrap gap-1.5" data-testid="impor-csv-ringkasan">
        {(['semua', 'baru', 'perbarui', 'sama', 'mirip'] as const).map((j) => {
          const n = j === 'semua' ? rencana.baris.length : rencana.jumlah[j]
          if (j !== 'semua' && n === 0) return null
          return (
            <button
              key={j}
              type="button"
              data-testid={`impor-csv-saring-${j}`}
              aria-pressed={saring === j}
              onClick={() => setSaring(j)}
              className={cx(
                'rounded-full border px-2.5 py-0.5 text-[11px] font-semibold',
                saring === j ? 'ring-1 ring-emerald-400/60' : '',
                j === 'semua' ? 'border-slate-700 text-slate-300' : WARNA_JENIS[j],
              )}
            >
              {j === 'semua' ? 'Semua' : LABEL_JENIS[j]} {n}
            </button>
          )
        })}
      </div>
      {rencana.jumlah.mirip > 0 && (
        <p className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          {rencana.jumlah.mirip} nama mirip dengan anggota lama. Bawaannya dianggap <b>orang baru</b>;
          pilih "Sama dengan …" kalau memang orang yang sama.
        </p>
      )}
      <ul className="max-h-[55vh] divide-y divide-slate-800 overflow-y-auto rounded-lg border border-slate-800">
        {tampil.map((r) => {
          const b = r.baris
          const lama = r.idLokal ? petaLokal.get(r.idLokal) : undefined
          const kep = keputusan[r.indeks]
          return (
            <li key={r.indeks} data-testid={`impor-csv-baris-${r.indeks}`} data-jenis={r.jenis} className="flex flex-wrap items-start gap-2 px-3 py-2">
              <span className={cx('mt-0.5 shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-bold', WARNA_JENIS[r.jenis])}>
                {LABEL_JENIS[r.jenis]}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-100">
                  {b.name}
                  {r.gandaDiBerkas && <span className="ml-1.5 text-[10px] font-normal text-amber-300">nama ini muncul lebih dari sekali di berkas</span>}
                </p>
                <p className="flex flex-wrap gap-x-1.5 text-[11px] text-slate-500">
                  {[b.terisi.includes('section') ? sectionLabel(b.section) : '', b.instrument, b.active ? '' : 'Nonaktif']
                    .filter(Boolean)
                    .join(' · ') || null}
                  {b.tags?.map((t) => (
                    <span key={t} className="text-emerald-300">#{t}</span>
                  ))}
                </p>
                {r.jenis === 'perbarui' && lama && (
                  <p className="text-[11px] text-sky-300">
                    {lama.code} · {r.perubahan.join(' · ')}
                  </p>
                )}
                {r.jenis === 'mirip' && (
                  <select
                    data-testid={`impor-csv-pilih-${r.indeks}`}
                    aria-label={`Keputusan untuk ${b.name}`}
                    value={kep && kep !== 'baru' ? kep.sama : 'baru'}
                    onChange={(e) =>
                      setKeputusan((k) => ({ ...k, [r.indeks]: e.target.value === 'baru' ? 'baru' : { sama: e.target.value } }))
                    }
                    className="mt-1 max-w-full rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-slate-200"
                  >
                    <option value="baru">Orang baru (tambahkan)</option>
                    {(r.kandidat ?? []).map((k) => {
                      const m = petaLokal.get(k.id)
                      return m ? (
                        <option key={k.id} value={k.id}>
                          Sama dengan {m.name} ({m.code} · {sectionLabel(m.section)}
                          {m.active ? '' : ' · nonaktif'})
                        </option>
                      ) : null
                    })}
                  </select>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </Modal>
  )
}
