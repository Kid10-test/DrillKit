import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { RiwayatSnapshot } from '../db/types'
import {
  bedaDenganSekarang,
  foto,
  labelAlasan,
  penting,
  pulihkan,
  waktuRelatif,
} from '../lib/riwayat'
import { Badge, Button, ConfirmButton, EmptyState, Input, Modal, useToast } from './ui'

/**
 * 1a — Panel riwayat formasi.
 *
 * Sengaja dibuat terpisah dari `pages/Drill.tsx`: berkas itu sudah lebih
 * dari empat ribu baris, dan panel ini tidak perlu tahu apa pun tentang
 * alat penyusun — ia hanya membaca foto, lalu menulisnya kembali.
 *
 * Yang belum ada di sini dan sengaja ditunda: pratinjau gambar lapangannya.
 * Menggambar titik sekarang masih menyatu dengan editor, jadi memindahkannya
 * tersendiri lebih aman daripada diselipkan ke pekerjaan ini.
 */
export function RiwayatDrill({
  drillId,
  open,
  onClose,
  onPulihkan,
}: {
  drillId: string
  open: boolean
  onClose: () => void
  /** dipanggil setelah berhasil mengembalikan, supaya halaman ikut menyegarkan */
  onPulihkan?: () => void
}) {
  const toast = useToast()
  const [label, setLabel] = useState('')
  const [sedang, setSedang] = useState(false)

  const semua = useLiveQuery(
    () => db.riwayat.where('drillId').equals(drillId).toArray(),
    [drillId],
    [] as RiwayatSnapshot[],
  )

  const daftarFoto = useMemo(() => [...semua].sort((a, b) => b.at - a.at), [semua])

  const sekarang = useLiveQuery(
    async () => {
      const sets = await db.sets.where('drillId').equals(drillId).toArray()
      return {
        jumlahSet: sets.length,
        jumlahTitik: sets.reduce((n, s) => n + Object.keys(s.points ?? {}).length, 0),
      }
    },
    [drillId],
    { jumlahSet: 0, jumlahTitik: 0 },
  )

  async function tandai() {
    if (sedang) return
    setSedang(true)
    try {
      await foto(drillId, 'tandai', label)
      setLabel('')
      toast.push('Keadaan formasi ditandai')
    } finally {
      setSedang(false)
    }
  }

  async function kembalikan(s: RiwayatSnapshot) {
    const hasil = await pulihkan(s.id)
    if (!hasil) {
      toast.push('Foto riwayat tidak ditemukan', 'info')
      return
    }
    toast.push(`Dikembalikan ke keadaan ${waktuRelatif(s.at)}`)
    onPulihkan?.()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Riwayat formasi"
      wide
      footer={
        <Button variant="ghost" onClick={onClose}>
          Tutup
        </Button>
      }
    >
      <div className="space-y-3">
        <p className="text-xs leading-relaxed text-slate-400">
          Aplikasi memotret keadaan formasi sendiri tiap beberapa menit kalau ada perubahan,
          dan selalu memotret sebelum aksi yang bisa merusak. Mengembalikan versi lama
          pun memotret keadaan sekarang lebih dulu, jadi tidak ada langkah yang buntu.
        </p>

        {/* Tanda sendiri — dipakai sebelum mencoba sesuatu yang berisiko. */}
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/40 p-2">
          <Input
            className="min-w-[12rem] flex-1"
            placeholder="mis. sebelum coba blok baru"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void tandai()
            }}
          />
          <Button variant="soft" onClick={() => void tandai()} disabled={sedang}>
            Tandai sekarang
          </Button>
        </div>

        {daftarFoto.length === 0 ? (
          <EmptyState
            title="Belum ada foto"
            desc="Begitu kamu mengubah formasi, aplikasi akan memotretnya sendiri beberapa menit lagi."
          />
        ) : (
          <div className="max-h-[52vh] space-y-2 overflow-y-auto pr-1">
            {daftarFoto.map((s) => (
              <div
                key={s.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2"
              >
                <div className="min-w-[10rem] flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-100">
                      {labelAlasan(s)}
                    </span>
                    {penting(s) && (
                      <Badge className="border-emerald-800 bg-emerald-950/50 text-emerald-300">
                        penting
                      </Badge>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-400">
                    {waktuRelatif(s.at)} · {s.jumlahSet} set · {s.jumlahTitik} titik
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    Sekarang: {bedaDenganSekarang(s, sekarang)}
                  </div>
                </div>

                <ConfirmButton
                  label="Kembalikan"
                  message="Kembalikan ke sini?"
                  onConfirm={() => void kembalikan(s)}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}
