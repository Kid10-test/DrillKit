import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { useSettings } from '../hooks/useSettings'
import { Button, Card, Modal, useToast } from './ui'
import { IconDownload, IconEye, IconPrinter } from './Icons'
import { downloadHtmlFile } from '../lib/print'
import { cetakAtauUnduh } from '../lib/laporan'
import { htmlPanduan, type DataPanduan } from '../lib/panduan'
import { visibleSections } from '../lib/utils'

/**
 * F4 — Panduan pemakaian 1 halaman.
 *
 * Dua pintu masuk:
 * 1. **Kartu di Pengaturan** (tempat utama) — pratinjau, unduh, atau cetak.
 * 2. **Tombol di Dashboard** — membuka pratinjau yang sama, untuk pelatih
 *    kedua yang baru pertama kali membuka aplikasi.
 *
 * Isinya disusun dari data tim yang sedang aktif (nama, logo, jumlah anggota,
 * sesi, drill, section, interval backup), jadi lembarannya selalu mutakhir
 * tanpa perlu disunting manual.
 */

/** Kumpulkan data tim untuk panduan — reaktif terhadap perubahan di database. */
export function pakaiDataPanduan(): DataPanduan {
  const settings = useSettings()
  const members = useLiveQuery(() => db.members.toArray(), [], [])
  const sessions = useLiveQuery(() => db.sessions.toArray(), [], [])
  const drills = useLiveQuery(() => db.drills.toArray(), [], [])
  const songs = useLiveQuery(() => db.songs.toArray(), [], [])

  return useMemo(
    () => ({
      namaTim: settings.teamName,
      kota: settings.city,
      pelatih: settings.coachName,
      logo: settings.logo,
      section: visibleSections(),
      anggotaAktif: members.filter((m) => m.active).length,
      sesi: sessions.length,
      drill: drills.length,
      lagu: songs.length,
      hariBackup: settings.backupIntervalDays ?? 7,
      portabel: typeof location !== 'undefined' && location.protocol === 'file:',
    }),
    [settings, members, sessions, drills, songs],
  )
}

/** Pratinjau panduan di dalam aplikasi + tombol unduh &amp; cetak. */
export function PratinjauPanduan({
  open,
  onClose,
  data,
}: {
  open: boolean
  onClose: () => void
  data: DataPanduan
}) {
  const toast = useToast()
  const html = useMemo(() => (open ? htmlPanduan(data) : ''), [open, data])
  const namaBerkas = `panduan-drillkit.html`

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Pratinjau panduan 1 halaman"
      wide
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Tutup
          </Button>
          <Button
            data-testid="tombol-unduh-panduan"
            onClick={() => {
              downloadHtmlFile(html, namaBerkas)
              toast.push('Panduan diunduh sebagai HTML — buka lalu Ctrl+P')
            }}
          >
            <IconDownload size={14} /> Unduh HTML
          </Button>
          <Button
            data-testid="tombol-cetak-panduan"
            variant="primary"
            onClick={() => {
              if (cetakAtauUnduh(html, namaBerkas)) toast.push('Panduan dibuka di jendela cetak')
              else toast.push('Jendela cetak diblokir — berkas HTML diunduh. Buka lalu Ctrl+P.', 'info')
            }}
          >
            <IconPrinter size={14} /> Cetak
          </Button>
        </>
      }
    >
      {html && (
        <iframe
          data-testid="bingkai-panduan"
          title="Pratinjau panduan"
          srcDoc={html}
          className="h-[65vh] w-full rounded-lg border border-slate-800 bg-white"
        />
      )}
    </Modal>
  )
}

/** Tombol kecil untuk membuka panduan — dipakai di Dashboard. */
export function TombolPanduan({ label = 'Panduan' }: { label?: string }) {
  const data = pakaiDataPanduan()
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button data-testid="tombol-panduan-dasbor" onClick={() => setOpen(true)} title="Panduan pemakaian 1 halaman">
        <IconEye size={16} /> {label}
      </Button>
      <PratinjauPanduan open={open} onClose={() => setOpen(false)} data={data} />
    </>
  )
}

/** Kartu di halaman Pengaturan. */
export default function KartuPanduan() {
  const data = pakaiDataPanduan()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const html = useMemo(() => htmlPanduan(data), [data])
  const berkas = 'panduan-drillkit.html'

  return (
    <Card data-testid="kartu-panduan" className="lg:col-span-2">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-200">Panduan 1 halaman</h2>
        <span className="text-[11px] text-slate-500">satu lembar A4, siap ditempel di tas</span>
      </div>
      <p className="mb-3 text-[11px] leading-relaxed text-slate-500">
        Lembar panduan ini <b className="text-slate-300">dibuat otomatis dari data tim Anda</b>: nama &amp; logo
        tim, jumlah anggota, sesi, drill, daftar section, dan pengingat backup ikut tercetak. Isinya: urutan pakai
        yang paling sering, isi tiap menu, shortcut editor formasi, dan cara mengatasi empat macet yang paling
        sering terjadi. Cocok diberikan ke pelatih kedua atau anggota yang baru mulai.
      </p>

      <div className="flex flex-wrap gap-2">
        <Button data-testid="tombol-pratinjau-panduan" onClick={() => setOpen(true)}>
          <IconEye size={16} /> Pratinjau
        </Button>
        <Button
          onClick={() => {
            downloadHtmlFile(html, berkas)
            toast.push('Panduan diunduh sebagai HTML — buka lalu Ctrl+P')
          }}
        >
          <IconDownload size={16} /> Unduh HTML
        </Button>
        <Button
          variant="primary"
          onClick={() => {
            if (cetakAtauUnduh(html, berkas)) toast.push('Panduan dibuka di jendela cetak')
            else toast.push('Jendela cetak diblokir — berkas HTML diunduh. Buka lalu Ctrl+P.', 'info')
          }}
        >
          <IconPrinter size={16} /> Cetak
        </Button>
      </div>

      <PratinjauPanduan open={open} onClose={() => setOpen(false)} data={data} />
    </Card>
  )
}
