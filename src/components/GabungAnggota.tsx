/**
 * Gabungkan dua kartu anggota yang ternyata orang yang sama.
 *
 * Pratinjau dulu, backup dianjurkan, baru ditulis. Yang dipertahankan
 * menang kalau keduanya tercatat di sesi yang sama. Nama yang dibuang
 * menjadi panggilan; id lamanya dicatat sebagai alias.
 */

import { useEffect, useMemo, useState } from 'react'
import type { Member } from '../db/types'
import { downloadBackup } from '../lib/backup'
import { rencanakanGabung, sarankanGanda, type RencanaGabung, type SaranGanda } from '../lib/namaAnggota'
import { muatJejakAnggota, muatUntukGabung, simpanGabung } from '../lib/simpanAnggota'
import { namaDenganPanggilan } from '../lib/namaAnggota'
import { Button, Field, Modal, Select, useToast } from './ui'

export function GabungAnggota({
  open,
  anggota,
  onClose,
}: {
  open: boolean
  anggota: Member[]
  onClose: () => void
}) {
  const toast = useToast()
  const [saran, setSaran] = useState<SaranGanda[]>([])
  const [simpanId, setSimpanId] = useState('')
  const [buangId, setBuangId] = useState('')
  const [rencana, setRencana] = useState<RencanaGabung | null>(null)
  const [sedang, setSedang] = useState(false)

  const olehId = useMemo(() => new Map(anggota.map((m) => [m.id, m])), [anggota])

  useEffect(() => {
    if (!open) return
    setRencana(null)
    setSimpanId('')
    setBuangId('')
    muatJejakAnggota()
      .then((jejak) => setSaran(sarankanGanda(anggota, jejak)))
      .catch(() => setSaran([]))
  }, [open, anggota])

  async function pratinjau(simpan: string, buang: string) {
    setSimpanId(simpan)
    setBuangId(buang)
    const a = olehId.get(simpan)
    const b = olehId.get(buang)
    if (!a || !b || a.id === b.id) {
      setRencana(null)
      return
    }
    const data = await muatUntukGabung()
    setRencana(rencanakanGabung({ simpan: a, buang: b, ...data }))
  }

  async function jalankan() {
    if (!rencana) return
    setSedang(true)
    try {
      await simpanGabung(rencana)
      const nama = olehId.get(rencana.buangId)?.name ?? 'anggota'
      toast.push(`${nama} digabung. Panggilan dan aliasnya ikut tersimpan.`)
      onClose()
    } catch {
      toast.push('Gagal menggabungkan — data tidak berubah', 'err')
    } finally {
      setSedang(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Gabungkan anggota ganda"
      wide
      testId="gabung-anggota"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button variant="primary" data-testid="gabung-jalankan" disabled={!rencana || sedang} onClick={() => void jalankan()}>
            {sedang ? 'Menggabungkan…' : 'Gabungkan'}
          </Button>
        </>
      }
    >
      <div className="rounded-lg border border-amber-600/40 bg-amber-950/30 p-3 text-[11px] leading-relaxed text-amber-100">
        Unduh backup lebih dulu. Penggabungan memindahkan absensi, evaluasi, catatan, dan posisi
        drill. Kalau keduanya tercatat di sesi yang sama, yang kamu pertahankan yang menang.
        <div className="mt-2">
          <Button
            size="sm"
            data-testid="gabung-backup"
            onClick={() => {
              void downloadBackup().then(() => toast.push('Backup diunduh — simpan di tempat aman'))
            }}
          >
            Unduh backup
          </Button>
        </div>
      </div>

      {saran.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 text-xs font-medium text-slate-300">Yang mungkin ganda</p>
          <ul className="space-y-1.5" data-testid="gabung-saran">
            {saran.map((s) => {
              const a = olehId.get(s.a)
              const b = olehId.get(s.b)
              if (!a || !b) return null
              return (
                <li key={`${s.a}|${s.b}`} className="rounded-lg border border-slate-800 p-2 text-xs">
                  <p className="text-slate-200">
                    {a.code} {namaDenganPanggilan(a)} · {b.code} {namaDenganPanggilan(b)}
                  </p>
                  <p className="text-[11px] text-slate-500">{s.alasan.join(' · ')}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <Button size="sm" onClick={() => void pratinjau(a.id, b.id)}>
                      Pertahankan {namaDenganPanggilan(a)}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => void pratinjau(b.id, a.id)}>
                      Pertahankan {namaDenganPanggilan(b)}
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Yang dipertahankan">
          <Select data-testid="gabung-simpan" value={simpanId} onChange={(e) => void pratinjau(e.target.value, buangId)}>
            <option value="">Pilih…</option>
            {anggota.map((m) => (
              <option key={m.id} value={m.id}>
                {m.code} — {namaDenganPanggilan(m)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Yang dibuang">
          <Select data-testid="gabung-buang" value={buangId} onChange={(e) => void pratinjau(simpanId, e.target.value)}>
            <option value="">Pilih…</option>
            {anggota
              .filter((m) => m.id !== simpanId)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.code} — {namaDenganPanggilan(m)}
                </option>
              ))}
          </Select>
        </Field>
      </div>

      {rencana && (
        <div data-testid="gabung-pratinjau" className="mt-3 rounded-lg bg-slate-950/50 p-3 text-xs text-slate-300">
          <p className="font-medium text-slate-100">
            {namaDenganPanggilan(olehId.get(rencana.buangId) ?? { name: 'anggota' })} digabung ke {namaDenganPanggilan(rencana.simpan)}
          </p>
          <ul className="mt-1.5 space-y-0.5 text-[11px] text-slate-400">
            <li>Absensi dipindah: {rencana.jumlah.absensi}</li>
            <li>Evaluasi dipindah: {rencana.jumlah.evaluasi}</li>
            <li>Catatan dipindah: {rencana.jumlah.catatan}</li>
            <li>
              Titik formasi dipindah: {rencana.jumlah.titik}
              {rencana.jumlah.drill ? ` di ${rencana.jumlah.drill} drill` : ''}
            </li>
            <li>Langkah per pemain dipindah: {rencana.jumlah.langkah}</li>
            <li>Riwayat formasi diperbarui: {rencana.jumlah.riwayat}</li>
            {rencana.info.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          {rencana.bentrok.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-[11px] text-amber-200" data-testid="gabung-bentrok">
              {rencana.bentrok.map((t) => (
                <li key={t}>Bentrok: {t}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Modal>
  )
}
