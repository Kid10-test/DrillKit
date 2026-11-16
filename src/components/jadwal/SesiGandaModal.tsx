/**
 * v2.10.1 — Jadwal › Sesi ganda: tanggal dengan dua sesi latihan bertumpuk.
 * Pelatih memilih sesi yang dipertahankan; absensi & isian kembarannya
 * dipindah, tautan dialihkan, lalu kembarannya dihapus.
 */
import { useEffect, useMemo, useState } from 'react'
import type { AttendanceRecord, Session } from '../../db/types'
import { db, getSettings, saveSettings } from '../../db/db'
import { Button, Modal, useToast } from '../ui'
import { alihkanIdMusim, alihkanIdProgram, cariSesiGanda, rencanaGabung, type RencanaGabung } from '../../lib/gabungSesi'
import { formatDateLong } from '../../lib/utils'
import { cx } from '../../lib/utils'

/** Tulis penggabungan ke database dalam satu transaksi. */
export async function gabungkanSesi(utama: Session, ganda: Session[]): Promise<RencanaGabung> {
  let hasil: RencanaGabung | null = null
  await db.transaction('rw', [db.sessions, db.attendance, db.logistikLomba, db.penilaianLomba, db.settings], async () => {
    const ids = ganda.map((s) => s.id).filter((id) => id !== utama.id)
    const catatan = await db.attendance.where('sessionId').anyOf([utama.id, ...ids]).toArray()
    const r = rencanaGabung(utama, ganda, catatan)
    hasil = r
    const dari = new Set(r.hapus)
    await db.sessions.put(r.utama)
    if (r.buang.length) await db.attendance.bulkDelete(r.buang)
    if (r.tulis.length) await db.attendance.bulkPut(r.tulis)
    for (const id of r.hapus) {
      for (const mf of await db.logistikLomba.where('sessionId').equals(id).toArray()) await db.logistikLomba.update(mf.id, { sessionId: utama.id })
      for (const pn of await db.penilaianLomba.where('sessionId').equals(id).toArray()) await db.penilaianLomba.update(pn.id, { sessionId: utama.id })
    }
    await db.sessions.bulkDelete(r.hapus)
    const st = await getSettings()
    const prog = alihkanIdProgram(st?.programLatihan ?? [], dari, utama.id)
    const musim = alihkanIdMusim(st?.musimTc ?? [], dari, utama.id)
    if (prog.berubah || musim.berubah) {
      await saveSettings({
        ...(prog.berubah ? { programLatihan: prog.daftar } : {}),
        ...(musim.berubah ? { musimTc: musim.daftar } : {}),
      })
    }
  })
  return hasil!
}

export function pesanGabung(r: RencanaGabung): string {
  return [
    `${r.hapus.length + 1} sesi digabung`,
    r.dipindah ? `${r.dipindah} catatan absensi dipindah` : '',
    r.bentrok ? `${r.bentrok} anak tercatat di keduanya — status terkuat dipakai` : '',
  ]
    .filter(Boolean)
    .join(' · ')
}

export default function SesiGandaModal({
  open,
  onClose,
  sesi,
  absensi,
  milikProgram,
}: {
  open: boolean
  onClose: () => void
  sesi: Session[]
  absensi: AttendanceRecord[]
  milikProgram: ReadonlySet<string>
}) {
  const toast = useToast()
  const kelompok = useMemo(() => cariSesiGanda(sesi, absensi, milikProgram), [sesi, absensi, milikProgram])
  const [pilih, setPilih] = useState<Record<string, string>>({})
  const [sibuk, setSibuk] = useState('')
  useEffect(() => {
    if (open) setPilih({})
  }, [open])

  const kunci = (k: { tanggal: string; sesi: Session[] }) => `${k.tanggal}|${k.sesi.map((s) => s.id).join(',')}`

  async function gabung(k: (typeof kelompok)[number]) {
    const idUtama = pilih[kunci(k)] ?? k.sesi[0].id
    const utama = k.sesi.find((s) => s.id === idUtama)!
    setSibuk(kunci(k))
    try {
      const r = await gabungkanSesi(utama, k.sesi.filter((s) => s.id !== idUtama))
      toast.push(pesanGabung(r))
    } catch {
      toast.push('Gagal menggabungkan sesi', 'err')
    } finally {
      setSibuk('')
    }
  }

  async function gabungSemua() {
    setSibuk('semua')
    let n = 0
    try {
      for (const k of kelompok) {
        const idUtama = pilih[kunci(k)] ?? k.sesi[0].id
        const utama = k.sesi.find((s) => s.id === idUtama)!
        await gabungkanSesi(utama, k.sesi.filter((s) => s.id !== idUtama))
        n++
      }
      toast.push(`${n} tanggal digabung`)
    } catch {
      toast.push(`Berhenti setelah ${n} tanggal — gagal menggabungkan`, 'err')
    } finally {
      setSibuk('')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Sesi ganda" wide testId="modal-sesi-ganda">
      {kelompok.length === 0 ? (
        <p data-testid="sesi-ganda-kosong" className="text-[12px] text-slate-400">
          Tidak ada tanggal dengan sesi latihan ganda.
        </p>
      ) : (
        <div className="space-y-3">
          <p className="text-[12px] text-slate-400">
            Tanggal berikut punya lebih dari satu sesi sejenis pada jam yang bertumpuk. Pilih sesi yang dipertahankan — biasanya yang berisi
            absensi. Catatan absensi, rencana, dan isian Form dari kembarannya dipindah ke sana; tautan program ikut dialihkan; lalu kembarannya
            dihapus. Bila anak tercatat di keduanya, status terkuat yang dipakai (hadir &gt; izin/sakit &gt; tanpa keterangan).
          </p>
          <ul className="space-y-2" data-testid="daftar-sesi-ganda">
            {kelompok.map((k) => {
              const kk = kunci(k)
              const dipilih = pilih[kk] ?? k.sesi[0].id
              return (
                <li key={kk} data-testid={`ganda-${k.tanggal}`} className="rounded-lg border border-slate-800 p-2">
                  <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[12px] font-semibold text-slate-200">{formatDateLong(k.tanggal)}</span>
                    <Button size="sm" variant="primary" data-testid={`gabung-${k.tanggal}`} disabled={!!sibuk} onClick={() => void gabung(k)}>
                      {sibuk === kk ? 'Menggabungkan…' : 'Gabungkan'}
                    </Button>
                  </div>
                  <div className="space-y-1">
                    {k.sesi.map((s) => (
                      <label
                        key={s.id}
                        className={cx(
                          'flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1 text-[12px]',
                          dipilih === s.id ? 'border-emerald-600/60 bg-emerald-950/30 text-slate-100' : 'border-slate-800 text-slate-400',
                        )}
                      >
                        <input type="radio" name={`utama-${kk}`} data-testid={`utama-${s.id}`} checked={dipilih === s.id} onChange={() => setPilih({ ...pilih, [kk]: s.id })} />
                        <span className="font-mono">
                          {s.startTime}–{s.endTime}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{s.title}</span>
                        <span className="shrink-0 text-[11px]">
                          {k.absensi[s.id] ? `${k.absensi[s.id]} absensi` : 'tanpa absensi'}
                          {milikProgram.has(s.id) ? ' · program' : ''}
                          {s.seriId ? ' · berulang' : ''}
                          {(s.rencanaLatihan?.length ?? 0) > 0 ? ' · ada rencana' : ''}
                        </span>
                        {dipilih === s.id && <span className="shrink-0 text-[10px] font-semibold text-emerald-300">dipertahankan</span>}
                      </label>
                    ))}
                  </div>
                </li>
              )
            })}
          </ul>
          <p className="text-[11px] text-slate-500">Sesi dipertahankan tetap memakai jam dan judulnya sendiri. Sebaiknya ekspor backup dulu bila ragu.</p>
          {kelompok.length > 1 && (
            <div className="flex justify-end">
              <Button variant="soft" data-testid="gabung-semua" disabled={!!sibuk} onClick={() => void gabungSemua()}>
                {sibuk === 'semua' ? 'Menggabungkan…' : `Gabungkan semua (${kelompok.length} tanggal)`}
              </Button>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
