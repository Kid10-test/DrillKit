import { useMemo, useState } from 'react'
import { Badge, Button, Card, Modal, Select, useToast } from './ui'
import { IconDownload, IconEye, IconPrinter } from './Icons'
import { downloadHtmlFile } from '../lib/print'
import type { DataLaporan } from '../lib/laporan'
import {
  cetakAtauUnduh,
  csvMatriks,
  csvRingkas,
  htmlKartu,
  htmlLaporan,
  htmlPaket,
  namaBerkas,
  susunBaris,
  susunRingkasan,
  unduhCsv,
} from '../lib/laporan'

/**
 * D4 — Kartu "Paket laporan admin" di tab Rekap.
 *
 * Satu tempat untuk menyiapkan berkas administrasi: laporan bulanan siap
 * serah, kartu kehadiran per anggota, paket lengkap satu berkas, dan dua
 * jenis CSV yang rapi dibuka di Excel — termasuk di HP.
 *
 * Alurnya **sama seperti buku saku di editor drill**: klik **Pratinjau** dulu,
 * hasilnya tampil di dalam aplikasi (jadi tidak bergantung pada jendela baru
 * atau unduhan), lalu dari situ bisa diunduh sebagai HTML atau dicetak. Ini
 * penting karena browser suka memblokir jendela cetak & unduhan saat aplikasi
 * dibuka di dalam pratinjau/iframe.
 *
 * Data yang dipakai sudah disaring oleh tab Rekap (periode, section, jenis
 * kegiatan), jadi yang tercetak selalu sama dengan yang sedang dilihat.
 */
export default function AdminReports({ data }: { data: DataLaporan }) {
  const toast = useToast()
  /** '' = semua anggota; selain itu = id anggota yang dipilih. */
  const [anggotaId, setAnggotaId] = useState('')
  /** Jenis berkas yang sedang dibuka pratinjaunya (null = tidak ada). */
  const [jenis, setJenis] = useState<'laporan' | 'kartu' | 'paket' | null>(null)

  const ringkasan = useMemo(() => susunRingkasan(data, susunBaris(data)), [data])

  /** HTML pratinjau — hanya disusun saat modalnya terbuka. */
  const pratinjau = useMemo(() => {
    if (!jenis) return ''
    if (jenis === 'laporan') return htmlLaporan(data)
    if (jenis === 'kartu') return htmlKartu(data, anggotaId || undefined)
    return htmlPaket(data)
  }, [jenis, data, anggotaId])

  const judulPratinjau =
    jenis === 'laporan' ? 'Laporan bulanan' : jenis === 'kartu' ? 'Kartu kehadiran' : 'Paket lengkap'

  /** Jangan tampilkan kartu kalau periode yang disaring tidak punya data. */
  if (!data.sesi.length || !data.anggota.length) return null

  function unduhHtml() {
    downloadHtmlFile(pratinjau, namaBerkas(jenis ?? 'laporan', data.kunci, 'html'))
    toast.push(`${judulPratinjau} diunduh sebagai HTML — buka lalu Ctrl+P`)
  }

  function cetak() {
    if (cetakAtauUnduh(pratinjau, namaBerkas(jenis ?? 'laporan', data.kunci, 'html'))) {
      toast.push(`${judulPratinjau} dibuka di jendela cetak`)
    } else {
      toast.push('Jendela cetak diblokir — berkas HTML diunduh. Buka lalu Ctrl+P.', 'info')
    }
  }

  function unduhCsvFile(isi: string, j: 'matriks' | 'ringkas', apa: string) {
    unduhCsv(isi, namaBerkas(j, data.kunci, 'csv'))
    toast.push(`${apa} diunduh`)
  }

  return (
    <Card data-testid="kartu-laporan-admin">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-200">Paket laporan admin</h2>
        <Badge className="border-slate-700 bg-slate-800/60 text-slate-300">{data.periode}</Badge>
      </div>
      <p className="mb-3 text-[11px] leading-relaxed text-slate-500">
        Semua berkas mengikuti penyaring yang sedang aktif di atas (periode, section, jenis kegiatan).
        Bagikan ke pembina cukup satu berkas: <b className="text-slate-300">paket lengkap</b> berisi
        laporan plus kartu tiap anggota.
      </p>

      {/* Kalimat ringkasan otomatis — yang akan tercetak di laporan */}
      <p
        className="mb-3 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-xs leading-relaxed text-slate-300"
        data-testid="kalimat-ringkasan"
      >
        {ringkasan.kalimat}
      </p>

      <div className="flex flex-wrap gap-2">
        <Button data-testid="tombol-pratinjau-laporan" onClick={() => setJenis('laporan')}>
          <IconEye size={16} /> Pratinjau laporan
        </Button>

        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <Select
            data-testid="pilih-anggota-kartu"
            data-kiosk-allow
            value={anggotaId}
            onChange={(e) => setAnggotaId(e.target.value)}
            className="min-w-0 flex-1 sm:flex-none sm:max-w-[190px]"
            aria-label="Pilih anggota untuk kartu kehadiran"
          >
            <option value="">Semua anggota</option>
            {[...data.anggota]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
          </Select>
          <Button data-testid="tombol-pratinjau-kartu" onClick={() => setJenis('kartu')}>
            <IconEye size={16} /> Pratinjau kartu
          </Button>
        </div>

        <Button data-testid="tombol-pratinjau-paket" onClick={() => setJenis('paket')}>
          <IconEye size={16} /> Pratinjau paket lengkap
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button data-testid="tombol-csv-matriks" onClick={() => unduhCsvFile(csvMatriks(data), 'matriks', 'CSV matriks')}>
          <IconDownload size={16} /> CSV matriks
        </Button>
        <Button data-testid="tombol-csv-ringkas" onClick={() => unduhCsvFile(csvRingkas(data), 'ringkas', 'CSV ringkas')}>
          <IconDownload size={16} /> CSV ringkas
        </Button>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
        <b className="text-slate-400">CSV matriks</b> — satu baris per anggota, satu kolom per sesi
        (enak dibaca menyamping di Excel HP).{' '}
        <b className="text-slate-400">CSV ringkas</b> — satu tabel bersih tanpa blok bertumpuk, siap
        diolah lebih lanjut.
      </p>

      <div className="mt-3 rounded-lg border border-amber-500/25 bg-amber-500/10 p-3 text-[11px] leading-relaxed text-amber-200">
        <b>Kalau tombol Cetak tidak memunculkan apa-apa:</b> browser sedang memblokir jendela baru
        (terjadi bila aplikasi dibuka di dalam pratinjau/iframe). Untuk itu ada{' '}
        <b>Pratinjau</b> —hasilnya tampil langsung di dalam aplikasi— dan <b>Unduh HTML</b> untuk
        membuka berkasnya di tab browser biasa lalu Ctrl+P.
      </div>

      <Modal
        open={!!jenis}
        onClose={() => setJenis(null)}
        title={`Pratinjau — ${judulPratinjau}`}
        wide
        footer={
          <>
            <Button variant="ghost" onClick={() => setJenis(null)}>
              Tutup
            </Button>
            <Button data-testid="tombol-unduh-html" onClick={unduhHtml}>
              <IconDownload size={14} /> Unduh HTML
            </Button>
            <Button data-testid="tombol-cetak-pratinjau" variant="primary" onClick={cetak}>
              <IconPrinter size={14} /> Cetak
            </Button>
          </>
        }
      >
        {pratinjau && (
          <iframe
            data-testid="bingkai-pratinjau"
            title="Pratinjau laporan"
            srcDoc={pratinjau}
            className="h-[65vh] w-full rounded-lg border border-slate-800 bg-white"
          />
        )}
      </Modal>
    </Card>
  )
}
