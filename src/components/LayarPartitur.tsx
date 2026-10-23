/**
 * #11b — Layar baca partitur *full score* (MusicXML via OSMD SVG hex & lembar PDF).
 *
 * **Batas yang dipegang di 11b.**
 * - Menggambar *full score* MusicXML secara *offline* dengan warna hex murni
 *   (`#ffffff` kertas / `#0f172a` tinta, nol `oklch()` / `color-mix()`), dimuat
 *   malas lewat `partiturRender.ts` dan dirender bertahap (`renderNext`) agar
 *   suara klik metronom maupun pemutar rekaman tidak tersendat.
 * - Untuk berkas PDF, menampilkan bingkai pratinjau ditambah tombol selalu-ada
 *   **Buka di tab baru** & **Unduh PDF** (tanpa membundel `pdf.js`, sesuai D5)
 *   sehingga pengguna HP Android pun tidak pernah menemui jalan buntu.
 * - Belum memfilter *part* per instrumen / cetak HTML (itu 11c) dan belum
 *   menyorot birama berjalan / *loop* frasa (itu 11d).
 */
import { useEffect, useRef, useState } from 'react'
import type { PartiturBerkasItem, Song } from '../db/types'
import { muatPartiturBerkas } from '../lib/partiturSimpan'
import {
  WARNA_PARTITUR_HEX,
  ZOOM_BAWAAN,
  ZOOM_LANGKAH,
  ZOOM_MAKS,
  ZOOM_MIN,
  bacaZoomTersimpan,
  jepitZoom,
  renderPartiturMusicXml,
  simpanZoomPartitur,
  type HasilSesiPartitur,
  type ModeTataLetakPartitur,
  type ProgresRenderPartitur,
} from '../lib/partiturRender'
import { cx } from '../lib/utils'
import { IconDownload } from './Icons'
import { Button } from './ui'

export function LayarPartitur({
  song,
  onTutup,
}: {
  song: Song
  onTutup: () => void
}) {
  const meta = song.partitur ?? null
  const [itemBerkas, setItemBerkas] = useState<PartiturBerkasItem | null>(null)
  const [memuatBerkas, setMemuatBerkas] = useState(true)
  const [blobUrl, setBlobUrl] = useState<string | null>(null)

  const [zoom, setZoom] = useState<number>(() => bacaZoomTersimpan())
  const [tataLetak, setTataLetak] = useState<ModeTataLetakPartitur>('vertikal')
  const [layarPenuh, setLayarPenuh] = useState(false)
  const [seriLebar, setSeriLebar] = useState(0)

  const [sedangRender, setSedangRender] = useState(false)
  const [progres, setProgres] = useState<ProgresRenderPartitur | null>(null)
  const [infoSesi, setInfoSesi] = useState<HasilSesiPartitur | null>(null)
  const [galatRender, setGalatRender] = useState<string | null>(null)

  const kertasRef = useRef<HTMLDivElement | null>(null)
  const wadahSvgRef = useRef<HTMLDivElement | null>(null)
  const lebarTerakhirRef = useRef<number>(0)

  // 1. Ambil Blob dari IndexedDB setiap kali lagu atau sidik berkasnya berubah.
  useEffect(() => {
    let hidup = true
    setMemuatBerkas(true)
    setItemBerkas(null)
    setInfoSesi(null)
    setGalatRender(null)
    setProgres(null)

    if (!meta) {
      setMemuatBerkas(false)
      return
    }

    void muatPartiturBerkas(song.id)
      .then((hasil) => {
        if (!hidup) return
        setItemBerkas(hasil ?? null)
        setMemuatBerkas(false)
      })
      .catch(() => {
        if (!hidup) return
        setItemBerkas(null)
        setMemuatBerkas(false)
      })

    return () => {
      hidup = false
    }
  }, [song.id, meta?.hash, meta?.namaFile, meta?.dipasangiAt])

  // 2. Kelola masa hidup Object URL untuk tombol unduh asli & penampil PDF.
  useEffect(() => {
    if (!itemBerkas?.blob) {
      setBlobUrl(null)
      return
    }
    const url = URL.createObjectURL(itemBerkas.blob)
    setBlobUrl(url)
    return () => {
      URL.revokeObjectURL(url)
    }
  }, [itemBerkas])

  // 3. Tutup mode layar penuh dengan tombol Escape & kunci gulir latar belakang.
  useEffect(() => {
    if (!layarPenuh) return
    const gayaOverflowAsli = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const saatTombol = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLayarPenuh(false)
    }
    window.addEventListener('keydown', saatTombol)
    return () => {
      document.body.style.overflow = gayaOverflowAsli
      window.removeEventListener('keydown', saatTombol)
    }
  }, [layarPenuh])

  // 4. Pantau perubahan lebar nyata wadah kertas (>= 24 px, mengabaikan munculnya
  //    scrollbar vertikal ~15 px agar tidak memicu loop render ulang).
  useEffect(() => {
    const el = kertasRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    lebarTerakhirRef.current = el.clientWidth
    let pewaktu: number | null = null

    const pengamat = new ResizeObserver(() => {
      const lebarBaru = el.clientWidth
      if (lebarBaru <= 0) return
      if (Math.abs(lebarBaru - lebarTerakhirRef.current) < 24) return
      lebarTerakhirRef.current = lebarBaru
      if (pewaktu != null) window.clearTimeout(pewaktu)
      pewaktu = window.setTimeout(() => {
        setSeriLebar((n) => n + 1)
      }, 240)
    })

    pengamat.observe(el)
    return () => {
      if (pewaktu != null) window.clearTimeout(pewaktu)
      pengamat.disconnect()
    }
  }, [itemBerkas?.tipe, layarPenuh])

  // 5. Render MusicXML secara malas & bertahap lewat OSMD; PDF tidak pernah
  //    masuk ke efek ini sehingga bundel OSMD sama sekali tidak diunduh.
  useEffect(() => {
    const wadah = wadahSvgRef.current
    if (!itemBerkas || itemBerkas.tipe !== 'musicxml' || !wadah) {
      return
    }

    const pengendali = new AbortController()
    let pembersihSesi: (() => void) | null = null

    setSedangRender(true)
    setGalatRender(null)
    setProgres({ selesai: false, biramaTerender: 0, totalBirama: meta?.jumlahBirama ?? 0 })

    void renderPartiturMusicXml({
      wadah,
      sumber: itemBerkas.blob,
      judulCadangan: meta?.judul || song.title,
      zoom,
      tataLetak,
      sinyal: pengendali.signal,
      onProgres: (p) => {
        if (!pengendali.signal.aborted) setProgres(p)
      },
    }).then((hasil) => {
      if (pengendali.signal.aborted) return
      setSedangRender(false)
      if (hasil.ok) {
        pembersihSesi = hasil.bersihkan
        setInfoSesi(hasil.sesi)
        setGalatRender(null)
      } else if (!hasil.dibatalkan) {
        setInfoSesi(null)
        setGalatRender(hasil.galat)
      }
    })

    return () => {
      pengendali.abort()
      pembersihSesi?.()
    }
  }, [itemBerkas, zoom, tataLetak, layarPenuh, seriLebar, meta?.judul, meta?.jumlahBirama, song.title])

  function ubahZoom(nilaiBaru: number) {
    const jepit = jepitZoom(nilaiBaru)
    setZoom(jepit)
    simpanZoomPartitur(jepit)
  }

  const tipe = itemBerkas?.tipe ?? meta?.tipe ?? 'musicxml'
  const namaUnduh = itemBerkas?.namaFile ?? meta?.namaFile ?? `${song.title}.musicxml`
  const persenZoom = Math.round(zoom * 100)

  return (
    <div
      data-testid="layar-partitur"
      data-kiosk-allow
      style={{
        backgroundColor: layarPenuh ? '#0b1120' : '#0f172a',
        borderColor: '#1e293b',
        color: '#e2e8f0',
      }}
      className={cx(
        layarPenuh
          ? 'fixed inset-0 z-50 flex flex-col p-3 sm:p-5'
          : 'min-w-0 rounded-2xl border p-4 shadow-sm sm:p-5 lg:col-span-3',
      )}
    >
      {/* Bilah atas: judul, status render, dan kendali baca */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold" style={{ color: '#f1f5f9' }}>
            Lembar Partitur — {meta?.judul || song.title}
          </h2>
          <p className="mt-0.5 text-[11px]" style={{ color: '#94a3b8' }}>
            {memuatBerkas ? (
              'Membaca berkas dari penyimpanan lokal…'
            ) : tipe === 'pdf' ? (
              'Lembar PDF statis — tidak merender ulang per instrumen'
            ) : sedangRender ? (
              <span data-testid="partitur-progres">
                {progres && progres.biramaTerender > 0
                  ? `Merender birama ${progres.biramaTerender}${progres.totalBirama > 0 ? ` / ${progres.totalBirama}` : ''}…`
                  : 'Memuat perender notasi & menyiapkan skor…'}
              </span>
            ) : infoSesi ? (
              <span data-testid="partitur-info-sesi">
                {infoSesi.birama.length} birama · {infoSesi.instrumen.length} part terender · Full score (
                {infoSesi.tataLetak === 'mendatar' ? 'mendatar' : 'halaman'})
              </span>
            ) : galatRender ? (
              'Partitur belum bisa ditampilkan'
            ) : (
              namaUnduh
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {tipe === 'musicxml' && itemBerkas && (
            <>
              <div
                className="inline-flex items-center rounded-lg border px-1 py-0.5"
                style={{ borderColor: '#334155', backgroundColor: '#020617' }}
              >
                <button
                  type="button"
                  data-testid="partitur-zoom-kurang"
                  disabled={zoom <= ZOOM_MIN}
                  onClick={() => ubahZoom(zoom - ZOOM_LANGKAH)}
                  title="Perkecil tampilan notasi"
                  style={{ color: '#e2e8f0' }}
                  className="rounded px-2 py-0.5 text-xs font-bold disabled:opacity-40"
                >
                  −
                </button>
                <button
                  type="button"
                  data-testid="partitur-zoom-nilai"
                  onClick={() => ubahZoom(ZOOM_BAWAAN)}
                  title="Kembalikan ke skala 100%"
                  style={{ color: '#cbd5e1' }}
                  className="px-1.5 py-0.5 text-[11px] font-medium tabular-nums"
                >
                  {persenZoom}%
                </button>
                <button
                  type="button"
                  data-testid="partitur-zoom-tambah"
                  disabled={zoom >= ZOOM_MAKS}
                  onClick={() => ubahZoom(zoom + ZOOM_LANGKAH)}
                  title="Perbesar tampilan notasi"
                  style={{ color: '#e2e8f0' }}
                  className="rounded px-2 py-0.5 text-xs font-bold disabled:opacity-40"
                >
                  +
                </button>
              </div>

              <Button
                size="sm"
                variant="outline"
                data-testid="partitur-tata-letak"
                onClick={() => setTataLetak((s) => (s === 'vertikal' ? 'mendatar' : 'vertikal'))}
                title="Ganti susunan halaman bertumpuk ke bawah atau satu baris mendatar"
              >
                {tataLetak === 'vertikal' ? 'Tata letak: Halaman' : 'Tata letak: Mendatar'}
              </Button>
            </>
          )}

          {blobUrl && (
            <a
              href={blobUrl}
              download={namaUnduh}
              data-testid="partitur-unduh-asli"
              style={{
                borderColor: '#334155',
                backgroundColor: '#1e293b',
                color: '#e2e8f0',
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium"
              title="Unduh berkas partitur asli dari penyimpanan lokal"
            >
              <IconDownload size={13} /> Unduh asli
            </a>
          )}

          <Button
            size="sm"
            variant="soft"
            data-testid="partitur-layar-penuh"
            onClick={() => setLayarPenuh((v) => !v)}
          >
            {layarPenuh ? 'Keluar layar penuh' : 'Layar penuh'}
          </Button>

          <Button
            size="sm"
            variant="ghost"
            data-testid="partitur-tutup"
            onClick={() => {
              setLayarPenuh(false)
              onTutup()
            }}
          >
            Tutup
          </Button>
        </div>
      </div>

      {/* Isi utama berdasarkan ketersediaan & jenis berkas */}
      {!memuatBerkas && !itemBerkas && (
        <div
          data-testid="partitur-berkas-kosong"
          style={{ borderColor: '#0369a1', backgroundColor: '#082f49', color: '#e0f2fe' }}
          className="rounded-xl border p-4 text-xs leading-relaxed"
        >
          Berkas partitur untuk lagu ini belum tersimpan di perangkat ini. Pasang berkasnya lewat panel Partitur di
          kartu Repertoar terlebih dahulu.
        </div>
      )}

      {itemBerkas && tipe === 'musicxml' && (
        <div className={cx('flex flex-col gap-3', layarPenuh && 'min-h-0 flex-1')}>
          {galatRender && (
            <div
              data-testid="partitur-render-galat"
              style={{ borderColor: '#b45309', backgroundColor: '#451a03', color: '#fef3c7' }}
              className="rounded-xl border p-3.5 text-xs leading-relaxed"
            >
              <p className="font-semibold">Notasi belum bisa digambar dari berkas ini</p>
              <p className="mt-1">{galatRender}</p>
              <p className="mt-1.5 text-[11px]" style={{ color: '#fcd34d' }}>
                Berkas aslinya tetap aman di perangkat ini — tekan tombol <b>Unduh asli</b> di atas bila ingin
                membukanya di MuseScore/Sibelius/Finale lalu mengekspornya kembali.
              </p>
            </div>
          )}

          <div
            ref={kertasRef}
            data-testid="partitur-kertas"
            style={{
              backgroundColor: WARNA_PARTITUR_HEX.kertas,
              color: WARNA_PARTITUR_HEX.tinta,
              borderColor: '#cbd5e1',
            }}
            className={cx(
              'overflow-auto rounded-xl border p-3 sm:p-5',
              layarPenuh ? 'min-h-0 flex-1' : 'max-h-[75vh]',
              galatRender && 'hidden',
            )}
          >
            <div
              ref={wadahSvgRef}
              data-testid="partitur-kanvas-svg"
              className={cx(tataLetak === 'mendatar' ? 'min-w-max' : 'w-full min-w-[300px]')}
            />
          </div>
        </div>
      )}

      {itemBerkas && tipe === 'pdf' && blobUrl && (
        <div className={cx('flex flex-col gap-2.5', layarPenuh && 'min-h-0 flex-1')}>
          <div
            style={{ borderColor: '#334155', backgroundColor: '#020617', color: '#cbd5e1' }}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-2.5 text-[11px]"
          >
            <span>
              Di sebagian peramban HP (seperti Chrome Android), bingkai PDF di bawah mungkin kosong — gunakan tombol di
              samping agar tidak pernah buntu.
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={blobUrl}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="partitur-pdf-buka"
                style={{ backgroundColor: '#059669', color: '#ffffff' }}
                className="inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-medium"
              >
                Buka di tab baru
              </a>
              <a
                href={blobUrl}
                download={namaUnduh}
                data-testid="partitur-pdf-unduh"
                style={{ borderColor: '#475569', backgroundColor: '#1e293b', color: '#e2e8f0' }}
                className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium"
              >
                <IconDownload size={12} /> Unduh PDF
              </a>
            </div>
          </div>

          <iframe
            data-testid="partitur-pdf-bingkai"
            src={blobUrl}
            title={`Partitur PDF ${song.title}`}
            style={{ backgroundColor: '#ffffff', borderColor: '#334155' }}
            className={cx('w-full rounded-xl border', layarPenuh ? 'min-h-0 flex-1' : 'h-[72vh]')}
          />
        </div>
      )}
    </div>
  )
}
