import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import QRCode from 'qrcode'
import { db } from '../db/db'
import { useSettings } from '../hooks/useSettings'
import { Button, Card, Modal, useToast } from './ui'
import { IconDownload, IconEye, IconPrinter } from './Icons'
import { downloadHtmlFile } from '../lib/print'
import { cetakAtauUnduh } from '../lib/laporan'
import {
  htmlPanduan,
  htmlPanduanAnggota,
  type DataPanduan,
  type DataPanduanAnggota,
} from '../lib/panduan'
import { daysFromToday, visibleSections } from '../lib/utils'

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
 *
 * J1 — ada **versi anggota**: lembar terpisah untuk HP anggota (membuka
 * aplikasi, memasukkan berkas pelatih, keenam tab, menala sesuai instrumen,
 * kalau macet). Pintu masuknya kartu yang sama di Pengaturan, plus tombol di
 * menu **Berbagi** — di sanalah pelatih sedang menyiapkan kiriman ke anggota.
 */

type JenisPanduan = 'pelatih' | 'anggota'

const BERKAS: Record<JenisPanduan, string> = {
  pelatih: 'panduan-drillkit.html',
  anggota: 'panduan-anggota-drillkit.html',
}

/**
 * Alamat aplikasi untuk dicetak di panduan anggota — hanya bila disajikan
 * situs. Dari berkas (`file://`) tidak ada alamat yang bisa dibuka HP lain,
 * jadi dikosongkan dan panduannya beralih ke petunjuk versi berkas.
 * Bagian `#/...` dibuang: anggota harus mendarat di layar awal, bukan di
 * halaman Pengaturan tempat pelatih kebetulan menekan tombolnya.
 */
function alamatAplikasi(): string {
  if (typeof location === 'undefined' || !/^https?:$/.test(location.protocol)) return ''
  return `${location.origin}${location.pathname}`
}

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

/**
 * Alamat yang hanya bisa dibuka dari perangkat ini atau jaringan rumah
 * (localhost, 127.x, 10.x, 192.168.x, 172.16–31.x). QR-nya tetap tercetak,
 * tetapi HP anggota tidak akan bisa membukanya — jadi pelatih diberi tahu
 * sebelum mencetak 60 lembar yang tidak berguna.
 */
export function alamatLokal(alamat: string): boolean {
  try {
    const h = new URL(alamat).hostname
    return (
      h === 'localhost' ||
      h.endsWith('.local') ||
      /^127\./.test(h) ||
      /^10\./.test(h) ||
      /^192\.168\./.test(h) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(h) ||
      /^169\.254\./.test(h)
    )
  } catch {
    return false
  }
}

/**
 * J1 — data panduan anggota. Kode QR dibuat sekali per alamat (asinkron,
 * pustaka `qrcode` yang sama dengan kartu QR absensi — tetap offline).
 */
export function pakaiDataPanduanAnggota(): DataPanduanAnggota {
  const settings = useSettings()
  const sessions = useLiveQuery(() => db.sessions.toArray(), [], [])
  const drills = useLiveQuery(() => db.drills.toArray(), [], [])
  const songs = useLiveQuery(() => db.songs.toArray(), [], [])
  const alamat = alamatAplikasi()
  const [qr, setQr] = useState<string | undefined>(undefined)

  useEffect(() => {
    if (!alamat) return
    let batal = false
    QRCode.toDataURL(alamat, { width: 320, margin: 1, errorCorrectionLevel: 'M' })
      .then((u) => {
        if (!batal) setQr(u)
      })
      // Gagal membuat QR bukan alasan panduannya gagal: alamatnya tetap tercetak.
      .catch(() => undefined)
    return () => {
      batal = true
    }
  }, [alamat])

  return useMemo(
    () => ({
      namaTim: settings.teamName,
      kota: settings.city,
      pelatih: settings.coachName,
      logo: settings.logo,
      alamat: alamat || undefined,
      qr: alamat ? qr : undefined,
      sesiMendatang: sessions.filter((x) => daysFromToday(x.date) >= 0).length,
      drill: drills.length,
      lagu: songs.length,
    }),
    [settings, alamat, qr, sessions, drills, songs],
  )
}

/** Pratinjau panduan di dalam aplikasi + tombol unduh &amp; cetak. */
export function PratinjauPanduan({
  open,
  onClose,
  data,
  jenis = 'pelatih',
  dataAnggota,
}: {
  open: boolean
  onClose: () => void
  data?: DataPanduan
  jenis?: JenisPanduan
  dataAnggota?: DataPanduanAnggota
}) {
  const toast = useToast()
  const html = useMemo(() => {
    if (!open) return ''
    if (jenis === 'anggota') return dataAnggota ? htmlPanduanAnggota(dataAnggota) : ''
    return data ? htmlPanduan(data) : ''
  }, [open, jenis, data, dataAnggota])
  const namaBerkas = BERKAS[jenis]

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={jenis === 'anggota' ? 'Pratinjau panduan anggota (1 halaman)' : 'Pratinjau panduan 1 halaman'}
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
          data-jenis={jenis}
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

/** J1 — tombol panduan anggota, dipakai di menu Berbagi. */
export function TombolPanduanAnggota({ label = 'Panduan anggota' }: { label?: string }) {
  const dataAnggota = pakaiDataPanduanAnggota()
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        data-testid="tombol-panduan-anggota-berbagi"
        onClick={() => setOpen(true)}
        title="Panduan 1 halaman untuk HP anggota"
      >
        <IconEye size={16} /> {label}
      </Button>
      {dataAnggota.alamat && alamatLokal(dataAnggota.alamat) && (
        <p className="mt-2 text-[11px] leading-relaxed text-amber-300" data-testid="peringatan-alamat-lokal-berbagi">
          Alamat {dataAnggota.alamat} hanya bisa dibuka dari perangkat/jaringan ini — kode QR di lembarnya
          tidak akan terbuka di HP anggota. Cetak dari situs yang sudah diunggah.
        </p>
      )}
      <PratinjauPanduan open={open} onClose={() => setOpen(false)} jenis="anggota" dataAnggota={dataAnggota} />
    </>
  )
}

/** Kartu di halaman Pengaturan. */
export default function KartuPanduan() {
  const data = pakaiDataPanduan()
  const dataAnggota = pakaiDataPanduanAnggota()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [openAnggota, setOpenAnggota] = useState(false)
  const html = useMemo(() => htmlPanduan(data), [data])
  const htmlAnggota = useMemo(() => htmlPanduanAnggota(dataAnggota), [dataAnggota])
  const berkas = BERKAS.pelatih

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
        sering terjadi. Cocok diberikan ke pelatih kedua; untuk anggota ada versinya sendiri di bawah.
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

      {/* J1 — versi anggota */}
      <div className="mt-4 border-t border-slate-800 pt-3" data-testid="bagian-panduan-anggota">
        <h3 className="mb-1 text-xs font-semibold text-slate-200">Versi anggota</h3>
        <p className="mb-3 text-[11px] leading-relaxed text-slate-500">
          Lembar terpisah untuk <b className="text-slate-300">HP anggota</b>: cara membuka DrillKit
          {dataAnggota.alamat ? ' (dengan kode QR alamat situs ini)' : ''}, memasukkan berkas dari
          pelatih, isi keenam tab, menala sesuai instrumen (Bb/Eb/F), dan kalau macet. Tidak memuat
          menu pelatih sama sekali.
          {dataAnggota.alamat && alamatLokal(dataAnggota.alamat) && (
            <>
              {' '}
              <b className="text-amber-300" data-testid="peringatan-alamat-lokal">
                Alamat {dataAnggota.alamat} hanya bisa dibuka dari perangkat/jaringan ini
              </b>{' '}
              — kode QR-nya tidak akan terbuka di HP anggota. Cetak dari situs yang sudah diunggah.
            </>
          )}
          {!dataAnggota.alamat && (
            <>
              {' '}
              <b className="text-amber-300">Dibuka dari berkas:</b> lembarnya memakai petunjuk versi berkas
              (tanpa alamat & QR). Cetak dari situs yang sudah diunggah untuk mendapatkan kode QR-nya.
            </>
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button data-testid="tombol-pratinjau-panduan-anggota" onClick={() => setOpenAnggota(true)}>
            <IconEye size={16} /> Pratinjau
          </Button>
          <Button
            data-testid="tombol-unduh-panduan-anggota"
            onClick={() => {
              downloadHtmlFile(htmlAnggota, BERKAS.anggota)
              toast.push('Panduan anggota diunduh sebagai HTML — bisa dikirim lewat WhatsApp')
            }}
          >
            <IconDownload size={16} /> Unduh HTML
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              if (cetakAtauUnduh(htmlAnggota, BERKAS.anggota)) toast.push('Panduan anggota dibuka di jendela cetak')
              else toast.push('Jendela cetak diblokir — berkas HTML diunduh. Buka lalu Ctrl+P.', 'info')
            }}
          >
            <IconPrinter size={16} /> Cetak
          </Button>
        </div>
      </div>

      <PratinjauPanduan
        open={openAnggota}
        onClose={() => setOpenAnggota(false)}
        jenis="anggota"
        dataAnggota={dataAnggota}
      />
    </Card>
  )
}
