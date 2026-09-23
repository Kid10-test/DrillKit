import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { useSettings } from '../hooks/useSettings'
import { daysSince, downloadBackup, lastBackup, shouldRemind, snoozeReminder } from '../lib/backup'
import { Button, Card, useToast } from './ui'
import { IconDownload } from './Icons'

/**
 * Pengingat backup — muncul di Dashboard kalau sudah lewat N hari sejak
 * backup terakhir (N bisa diatur di menu Pengaturan).
 *
 * Kenapa tidak langsung mengunduh sendiri? Browser hanya boleh menulis berkas
 * kalau ada aksi dari pengguna (klik/ketuk). Jadi aplikasi mengingatkan, dan
 * pengguna tinggal satu klik untuk mengunduh berkasnya.
 *
 * Pengingat tidak pernah muncul kalau aplikasi belum berisi data anggota,
 * supaya tidak mengganggu saat pertama kali dipakai.
 */
export function BackupReminder() {
  const toast = useToast()
  const settings = useSettings()
  /** jumlah anggota — dipakai untuk memastikan aplikasi sudah berisi data */
  const memberCount = useLiveQuery(() => db.members.count(), [], 0)
  const [sembunyi, setSembunyi] = useState(false)
  const [menyimpan, setMenyimpan] = useState(false)

  const interval = settings?.backupIntervalDays ?? 7
  const terakhir = lastBackup()
  const hari = daysSince(terakhir?.at)

  async function cadangkan() {
    setMenyimpan(true)
    try {
      await downloadBackup()
      toast.push('Backup diunduh — simpan di tempat aman')
      setSembunyi(true)
    } catch {
      toast.push('Gagal menyiapkan backup', 'err')
    } finally {
      setMenyimpan(false)
    }
  }

  if (sembunyi || !memberCount || !shouldRemind(interval)) return null

  return (
    <Card className="border-amber-500/30 bg-amber-500/10">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-amber-100">
            {terakhir && hari !== null
              ? `Sudah ${hari} hari sejak backup terakhir`
              : 'Belum pernah backup'}
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-amber-200/90">
            Data DrillKit tersimpan <b>hanya di perangkat ini</b>. Unduh backup lalu simpan di Google Drive
            atau emailmu — supaya bisa dipulihkan kalau ganti HP/laptop atau data browser dibersihkan.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={cadangkan} disabled={menyimpan}>
            <IconDownload size={16} />
            {menyimpan ? 'Menyiapkan…' : 'Cadangkan sekarang'}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              snoozeReminder(1)
              setSembunyi(true)
            }}
          >
            Ingatkan besok
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              // Tunda sampai siklus berikutnya (atau 7 hari kalau pengingat dimatikan).
              snoozeReminder(interval > 0 ? interval : 7)
              setSembunyi(true)
            }}
          >
            Lewati dulu
          </Button>
        </div>
      </div>
    </Card>
  )
}
