/**
 * #11c — Modal pratinjau cetak & unduh HTML mandiri partitur (anti-buntu, D5).
 *
 * Selaras dengan `Panduan.tsx` dan `DotSheetModal.tsx`:
 * - Merender halaman `<svg>` terpaginasi (`A4_P`, `A4_L`, atau `A5_L` buku saku
 *   / *lyre*) di wadah lepas-layar lewat `renderHalamanCetakPartitur`.
 * - Membungkusnya menjadi dokumen HTML mandiri murni hex (`#ffffff` / `#0f172a`,
 *   nol `oklch()` / `color-mix()`, nol font eksternal) lewat `htmlCetakPartitur`
 *   dan menampilkannya di `<iframe srcDoc>`.
 * - Menyediakan **Unduh HTML** (bisa dikirim lewat WhatsApp/Bluetooth dan dibuka
 *   di peramban mana pun dengan tombol cetak di dalamnya) serta **Cetak** lewat
 *   `cetakAtauUnduh` yang otomatis jatuh ke unduh HTML bila `window.open`
 *   diblokir WebView/iframe/`DrillKit.html`.
 */
import { useEffect, useMemo, useState } from 'react'
import type { SectionDef, Song } from '../db/types'
import { cetakAtauUnduh } from '../lib/laporan'
import type { BagianPartitur } from '../lib/partitur'
import {
  daftarIdPartAktif,
  kelompokkanPartSkor,
  labelFilterPartitur,
  type FilterPartitur,
} from '../lib/partiturBagian'
import {
  DAFTAR_UKURAN_KERTAS_PARTITUR,
  LABEL_SKALA_CETAK_PARTITUR,
  SPESIFIKASI_KERTAS_PARTITUR,
  htmlCetakPartitur,
  kertasBawaanUntukJumlahPart,
  namaBerkasCetakPartitur,
  type SkalaCetakPartitur,
  type UkuranKertasPartitur,
} from '../lib/partiturCetak'
import { renderHalamanCetakPartitur } from '../lib/partiturRender'
import { downloadHtmlFile } from '../lib/print'
import { formatDateShort, todayISO } from '../lib/utils'
import { IconDownload, IconPrinter } from './Icons'
import { Button, Modal, useToast } from './ui'

function kunciPilihanBagian(filter: FilterPartitur): string {
  if (filter.jenis === 'semua') return 'semua'
  if (filter.jenis === 'kelompok') return `kelompok:${filter.kelompokId}`
  if (filter.jenis === 'part') return `part:${filter.partId}`
  return 'instrumen'
}

function susunRingkasanMusik(song: Song, jumlahBiramaHasil: number): string {
  const meta = song.partitur
  const keping: string[] = []
  const bpm = meta?.tempo ?? song.bpm
  if (bpm && bpm > 0) keping.push(`${Math.round(bpm)} BPM`)
  if (meta?.perubahanSukat && meta.perubahanSukat.length > 0) {
    const labelSukat = meta.perubahanSukat
      .slice(0, 3)
      .map((s) => `${s.beats}/${s.beatType}`)
      .join(' → ')
    keping.push(labelSukat)
  } else if (meta?.sukat) {
    keping.push(`${meta.sukat.beats}/${meta.sukat.beatType}`)
  } else if (song.beats) {
    keping.push(`${song.beats}/4`)
  }
  const birama = jumlahBiramaHasil || meta?.jumlahBirama || 0
  if (birama > 0) keping.push(`${birama} birama`)
  return keping.join(' · ')
}

export function PratinjauCetakPartitur({
  open,
  onClose,
  song,
  sumber,
  daftarPart,
  sectionsTim,
  filterAwal,
  namaTim,
}: {
  open: boolean
  onClose: () => void
  song: Song
  sumber: Blob
  daftarPart: BagianPartitur[]
  sectionsTim: SectionDef[]
  filterAwal: FilterPartitur
  namaTim?: string
}) {
  const toast = useToast()
  const meta = song.partitur
  const daftarKelompok = useMemo(
    () => kelompokkanPartSkor(daftarPart, sectionsTim),
    [daftarPart, sectionsTim],
  )

  const [pilihanFilter, setPilihanFilter] = useState<FilterPartitur>(filterAwal)
  const [ukuranKertas, setUkuranKertas] = useState<UkuranKertasPartitur>(() => {
    const n = daftarIdPartAktif(filterAwal, daftarPart)?.length ?? daftarPart.length
    return kertasBawaanUntukJumlahPart(n || 1)
  })
  const [kertasManual, setKertasManual] = useState(false)
  const [skala, setSkala] = useState<SkalaCetakPartitur>('normal')

  const [sedangMenyusun, setSedangMenyusun] = useState(false)
  const [halamanSvg, setHalamanSvg] = useState<string[]>([])
  const [jumlahBirama, setJumlahBirama] = useState<number>(meta?.jumlahBirama ?? 0)
  const [galatCetak, setGalatCetak] = useState<string | null>(null)

  // Saat modal baru dibuka, selaraskan pilihan bagian & orientasi kertas bawaan
  // dengan filter yang sedang aktif di layar baca.
  useEffect(() => {
    if (!open) return
    setPilihanFilter(filterAwal)
    const jumlahPart =
      daftarIdPartAktif(filterAwal, daftarPart)?.length ?? (daftarPart.length || 1)
    setUkuranKertas(kertasBawaanUntukJumlahPart(jumlahPart))
    setKertasManual(false)
    setSkala('normal')
  }, [open, filterAwal, daftarPart])

  const filterIdAktif = useMemo(
    () => daftarIdPartAktif(pilihanFilter, daftarPart),
    [pilihanFilter, daftarPart],
  )

  // Render halaman cetak lepas-layar setiap kali pengaturan berubah selama modal terbuka.
  useEffect(() => {
    if (!open) return
    const pengendali = new AbortController()
    setSedangMenyusun(true)
    setGalatCetak(null)

    void renderHalamanCetakPartitur({
      sumber,
      judulCadangan: meta?.judul || song.title,
      filterIdXml: filterIdAktif,
      ukuranKertas,
      skala,
      sinyal: pengendali.signal,
    }).then((hasil) => {
      if (pengendali.signal.aborted) return
      setSedangMenyusun(false)
      if (hasil.ok) {
        setHalamanSvg(hasil.halamanSvg)
        setJumlahBirama(hasil.jumlahBirama)
        setGalatCetak(null)
      } else if (!hasil.dibatalkan) {
        setHalamanSvg([])
        setGalatCetak(hasil.galat)
      }
    })

    return () => {
      pengendali.abort()
    }
  }, [open, sumber, meta?.judul, song.title, filterIdAktif, ukuranKertas, skala])

  const judulLagu = meta?.judul || song.title
  const labelBagian = labelFilterPartitur(pilihanFilter, daftarPart.length)
  const spekKertas = SPESIFIKASI_KERTAS_PARTITUR[ukuranKertas]

  const html = useMemo(() => {
    if (!open || halamanSvg.length === 0) return ''
    return htmlCetakPartitur({
      namaTim: namaTim || undefined,
      judulLagu,
      pengarang: meta?.pengarang || undefined,
      labelBagian,
      ringkasanMusik: susunRingkasanMusik(song, jumlahBirama),
      ukuranKertas,
      halamanSvg,
      dicetakPada: formatDateShort(todayISO()),
    })
  }, [open, halamanSvg, namaTim, judulLagu, meta?.pengarang, labelBagian, song, jumlahBirama, ukuranKertas])

  const namaBerkas = useMemo(
    () => namaBerkasCetakPartitur(judulLagu, labelBagian, ukuranKertas),
    [judulLagu, labelBagian, ukuranKertas],
  )

  function gantiPilihanBagian(nilai: string) {
    let filterBaru: FilterPartitur = { jenis: 'semua' }
    if (nilai === 'instrumen' && filterAwal.jenis === 'instrumen') {
      filterBaru = filterAwal
    } else if (nilai.startsWith('kelompok:')) {
      const idKel = nilai.slice('kelompok:'.length)
      const kel = daftarKelompok.find((k) => k.id === idKel)
      if (kel) {
        filterBaru = {
          jenis: 'kelompok',
          kelompokId: kel.id,
          label: kel.label,
          partIds: kel.partIds,
        }
      }
    } else if (nilai.startsWith('part:')) {
      const idPart = nilai.slice('part:'.length)
      const part = daftarPart.find((p) => p.id === idPart)
      if (part) {
        filterBaru = {
          jenis: 'part',
          partId: part.id,
          label: part.nama,
        }
      }
    }

    setPilihanFilter(filterBaru)
    if (!kertasManual) {
      const n = daftarIdPartAktif(filterBaru, daftarPart)?.length ?? (daftarPart.length || 1)
      setUkuranKertas(kertasBawaanUntukJumlahPart(n))
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Pratinjau Cetak & Unduh HTML Partitur"
      wide
      testId="modal-cetak-partitur"
      footer={
        <>
          <Button variant="ghost" data-kiosk-allow onClick={onClose}>
            Tutup
          </Button>
          <Button
            data-testid="tombol-unduh-html-partitur"
            data-kiosk-allow
            disabled={sedangMenyusun || !html}
            onClick={() => {
              downloadHtmlFile(html, namaBerkas)
              toast.push('Partitur diunduh sebagai HTML mandiri — bisa dikirim atau dibuka lalu Ctrl+P')
            }}
          >
            <IconDownload size={14} /> Unduh HTML
          </Button>
          <Button
            data-testid="tombol-cetak-partitur"
            data-kiosk-allow
            variant="primary"
            disabled={sedangMenyusun || !html}
            onClick={() => {
              if (cetakAtauUnduh(html, namaBerkas)) {
                toast.push('Partitur dibuka di jendela cetak')
              } else {
                toast.push(
                  'Jendela cetak diblokir — berkas HTML diunduh. Buka berkas HTML lalu tekan Ctrl+P.',
                  'info',
                )
              }
            }}
          >
            <IconPrinter size={14} /> Cetak
          </Button>
        </>
      }
    >
      <div data-kiosk-allow className="space-y-3">
        {/* Pengaturan bagian, ukuran kertas, dan skala notasi */}
        <div
          style={{ borderColor: '#334155', backgroundColor: '#020617', color: '#e2e8f0' }}
          className="grid gap-2.5 rounded-xl border p-3 sm:grid-cols-3"
        >
          <label className="block text-xs">
            <span className="mb-1 block font-medium" style={{ color: '#cbd5e1' }}>
              Bagian yang dicetak
            </span>
            <select
              data-testid="cetak-partitur-bagian"
              value={kunciPilihanBagian(pilihanFilter)}
              onChange={(e) => gantiPilihanBagian(e.target.value)}
              style={{
                borderColor: '#475569',
                backgroundColor: '#0f172a',
                color: '#f1f5f9',
              }}
              className="w-full rounded-lg border px-2.5 py-1.5 text-xs"
            >
              <option value="semua">
                Full score ({daftarPart.length || 1} part)
              </option>
              {filterAwal.jenis === 'instrumen' && (
                <option value="instrumen">{filterAwal.label}</option>
              )}
              {daftarPart.length > 1 && daftarKelompok.length > 1 && (
                <optgroup label="Kelompok seksi">
                  {daftarKelompok.map((kel) => (
                    <option key={kel.id} value={`kelompok:${kel.id}`}>
                      {kel.label} ({kel.partIds.length} part)
                    </option>
                  ))}
                </optgroup>
              )}
              {daftarPart.length > 1 && (
                <optgroup label="Part individu">
                  {daftarPart.map((p, idx) => (
                    <option key={p.id} value={`part:${p.id}`}>
                      {idx + 1}. {p.nama}
                      {p.singkatan ? ` (${p.singkatan})` : ''}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </label>

          <label className="block text-xs">
            <span className="mb-1 block font-medium" style={{ color: '#cbd5e1' }}>
              Ukuran kertas
            </span>
            <select
              data-testid="cetak-partitur-kertas"
              value={ukuranKertas}
              onChange={(e) => {
                setKertasManual(true)
                setUkuranKertas(e.target.value as UkuranKertasPartitur)
              }}
              style={{
                borderColor: '#475569',
                backgroundColor: '#0f172a',
                color: '#f1f5f9',
              }}
              className="w-full rounded-lg border px-2.5 py-1.5 text-xs"
            >
              {DAFTAR_UKURAN_KERTAS_PARTITUR.map((kode) => (
                <option key={kode} value={kode}>
                  {SPESIFIKASI_KERTAS_PARTITUR[kode].label}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs">
            <span className="mb-1 block font-medium" style={{ color: '#cbd5e1' }}>
              Skala notasi
            </span>
            <select
              data-testid="cetak-partitur-skala"
              value={skala}
              onChange={(e) => setSkala(e.target.value as SkalaCetakPartitur)}
              style={{
                borderColor: '#475569',
                backgroundColor: '#0f172a',
                color: '#f1f5f9',
              }}
              className="w-full rounded-lg border px-2.5 py-1.5 text-xs"
            >
              {(['padat', 'normal', 'besar'] as const).map((kode) => (
                <option key={kode} value={kode}>
                  {LABEL_SKALA_CETAK_PARTITUR[kode]}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Status jumlah halaman & panduan singkat */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span
            data-testid="cetak-partitur-halaman"
            style={{
              borderColor: '#334155',
              backgroundColor: '#1e293b',
              color: '#e2e8f0',
            }}
            className="inline-flex items-center rounded-md border px-2.5 py-1 font-medium"
          >
            {sedangMenyusun
              ? `Menyusun halaman ${spekKertas.labelPendek}…`
              : galatCetak
                ? 'Gagal menyusun halaman cetak'
                : `${halamanSvg.length} halaman · ${spekKertas.label}`}
          </span>
          <span className="text-[11px]" style={{ color: '#94a3b8' }}>
            Berkas HTML mandiri 100% vektor &amp; luring — tajam dicetak di A4 maupun lyre A5.
          </span>
        </div>

        {galatCetak && (
          <div
            style={{ borderColor: '#b45309', backgroundColor: '#451a03', color: '#fef3c7' }}
            className="rounded-xl border p-3 text-xs leading-relaxed"
          >
            {galatCetak}
          </div>
        )}

        {sedangMenyusun && !html && (
          <div
            style={{ borderColor: '#334155', backgroundColor: '#0f172a', color: '#cbd5e1' }}
            className="flex h-[52vh] items-center justify-center rounded-xl border text-xs"
          >
            Menata sistem paranada per halaman ({spekKertas.label})…
          </div>
        )}

        {html && (
          <iframe
            data-testid="bingkai-cetak-partitur"
            title={`Pratinjau cetak partitur ${judulLagu}`}
            srcDoc={html}
            style={{ backgroundColor: '#ffffff', borderColor: '#334155' }}
            className="h-[58vh] w-full rounded-xl border"
          />
        )}
      </div>
    </Modal>
  )
}
