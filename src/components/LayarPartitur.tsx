/**
 * #11b & #11c — Layar baca partitur (MusicXML via OSMD SVG hex & lembar PDF),
 * lengkap dengan penyaringan per seksi / per *part* instrumen, pencocokan
 * otomatis anggota, serta pratinjau cetak & unduh HTML mandiri murni hex.
 *
 * **Jaminan utama:**
 * - Menggambar *full score*, kelompok seksi, maupun *part* tunggal secara
 *   *offline* dengan warna hex murni (`#ffffff` kertas / `#0f172a` tinta, nol
 *   `oklch()` / `color-mix()`), dimuat malas lewat `partiturRender.ts` dan
 *   dirender bertahap (`renderNext`) agar metronom tidak tersendat.
 * - Mode anggota memberi pilihan awal cerdas sesuai `instrument` / `section`
 *   tanpa pernah mengunci atau menghalangi pemakaian tanpa nama (D4 `#11c`).
 * - Untuk berkas PDF, menampilkan bingkai pratinjau ditambah tombol selalu-ada
 *   **Buka di tab baru** & **Unduh PDF** (tanpa membundel `pdf.js`, D5 `#11b`).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Member, PartiturBerkasItem, SectionDef, Song } from '../db/types'
import type { BagianPartitur } from '../lib/partitur'
import {
  bacaFilterPartiturTersimpan,
  daftarIdPartAktif,
  kelompokkanPartSkor,
  pilihFilterAwalAnggota,
  samaFilterPartitur,
  sesuaikanFilterKePartSkor,
  simpanFilterPartitur,
  type FilterPartitur,
} from '../lib/partiturBagian'
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
import { muatPartiturBerkas } from '../lib/partiturSimpan'
import { DEFAULT_SECTIONS, cx } from '../lib/utils'
import { IconDownload, IconPrinter } from './Icons'
import { PratinjauCetakPartitur } from './PratinjauCetakPartitur'
import { Button } from './ui'

function tentukanFilterAwalLagu(
  kunciSimpan: string,
  daftarPart: BagianPartitur[],
  anggotaAktif: Member | null,
  sectionsTim: SectionDef[],
): FilterPartitur {
  const tersimpan = bacaFilterPartiturTersimpan(kunciSimpan)
  if (tersimpan) {
    return daftarPart.length > 0
      ? sesuaikanFilterKePartSkor(tersimpan, daftarPart)
      : tersimpan
  }
  if (anggotaAktif && daftarPart.length > 0) {
    return pilihFilterAwalAnggota(daftarPart, anggotaAktif, sectionsTim).filter
  }
  return { jenis: 'semua' }
}

export function LayarPartitur({
  song,
  onTutup,
  anggotaAktif = null,
  sectionsTim = DEFAULT_SECTIONS,
  namaTim,
  hanyaPutar = false,
}: {
  song: Song
  onTutup: () => void
  anggotaAktif?: Member | null
  sectionsTim?: SectionDef[]
  namaTim?: string
  hanyaPutar?: boolean
}) {
  const meta = song.partitur ?? null
  const [itemBerkas, setItemBerkas] = useState<PartiturBerkasItem | null>(null)
  const [memuatBerkas, setMemuatBerkas] = useState(true)
  const [blobUrl, setBlobUrl] = useState<string | null>(null)

  const [zoom, setZoom] = useState<number>(() => bacaZoomTersimpan())
  const [tataLetak, setTataLetak] = useState<ModeTataLetakPartitur>('vertikal')
  const [layarPenuh, setLayarPenuh] = useState(false)
  const [cetakTerbuka, setCetakTerbuka] = useState(false)
  const [seriLebar, setSeriLebar] = useState(0)

  const [sedangRender, setSedangRender] = useState(false)
  const [progres, setProgres] = useState<ProgresRenderPartitur | null>(null)
  const [infoSesi, setInfoSesi] = useState<HasilSesiPartitur | null>(null)
  const [galatRender, setGalatRender] = useState<string | null>(null)

  // Cadangan daftar part dari OSMD untuk berkas D4 (`terurai: false`, mis. `<score-timewise>`)
  // yang pada saat dipindai `#11a` belum memiliki `meta.bagian`.
  const [partCadanganOsmd, setPartCadanganOsmd] = useState<BagianPartitur[]>([])

  const daftarPartSkor = useMemo<BagianPartitur[]>(() => {
    if (meta?.parts && meta.parts.length > 0) return meta.parts
    return partCadanganOsmd
  }, [meta?.parts, partCadanganOsmd])

  const tandaPartSkor = useMemo(
    () => daftarPartSkor.map((p) => `${p.id}:${p.nama}`).join('|'),
    [daftarPartSkor],
  )

  // Kunci penyimpanan dipisah per identitas anggota bila di mode anggota,
  // supaya berganti profil anggota di HP bersama tidak mewarisi filter orang lain.
  const kunciSimpanFilter = anggotaAktif?.id
    ? `${song.id}::${anggotaAktif.id}`
    : hanyaPutar
      ? `${song.id}::anon`
      : song.id

  const [filterAktif, setFilterAktif] = useState<FilterPartitur>(() =>
    tentukanFilterAwalLagu(kunciSimpanFilter, daftarPartSkor, anggotaAktif, sectionsTim),
  )

  const kunciKonteksRef = useRef(`${kunciSimpanFilter}@@${tandaPartSkor}`)
  useEffect(() => {
    const kunciBaru = `${kunciSimpanFilter}@@${tandaPartSkor}`
    if (kunciKonteksRef.current === kunciBaru) return
    kunciKonteksRef.current = kunciBaru
    setFilterAktif(
      tentukanFilterAwalLagu(kunciSimpanFilter, daftarPartSkor, anggotaAktif, sectionsTim),
    )
  }, [kunciSimpanFilter, tandaPartSkor, daftarPartSkor, anggotaAktif, sectionsTim])

  const daftarKelompok = useMemo(
    () => kelompokkanPartSkor(daftarPartSkor, sectionsTim),
    [daftarPartSkor, sectionsTim],
  )

  const pilihanAnggotaAwal = useMemo(
    () => pilihFilterAwalAnggota(daftarPartSkor, anggotaAktif, sectionsTim),
    [daftarPartSkor, anggotaAktif, sectionsTim],
  )

  const filterIdAktif = useMemo(
    () => daftarIdPartAktif(filterAktif, daftarPartSkor),
    [filterAktif, daftarPartSkor],
  )
  const tandaFilterId = filterIdAktif ? filterIdAktif.join('\u0001') : '__SEMUA__'

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
    setPartCadanganOsmd([])

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

  // 3. Tutup mode layar penuh dengan tombol Escape & kunci gulir latar belakang
  //    (kecuali bila modal cetak sedang terbuka, biarkan Escape menutup modal dulu).
  useEffect(() => {
    if (!layarPenuh) return
    const gayaOverflowAsli = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const saatTombol = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !cetakTerbuka) setLayarPenuh(false)
    }
    window.addEventListener('keydown', saatTombol)
    return () => {
      document.body.style.overflow = gayaOverflowAsli
      window.removeEventListener('keydown', saatTombol)
    }
  }, [layarPenuh, cetakTerbuka])

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
    const daftarIdRender = tandaFilterId === '__SEMUA__' ? null : tandaFilterId.split('\u0001')

    setSedangRender(true)
    setGalatRender(null)
    setProgres({ selesai: false, biramaTerender: 0, totalBirama: meta?.jumlahBirama ?? 0 })

    void renderPartiturMusicXml({
      wadah,
      sumber: itemBerkas.blob,
      judulCadangan: meta?.judul || song.title,
      zoom,
      tataLetak,
      filterIdXml: daftarIdRender,
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
        if ((!meta?.parts || meta.parts.length === 0) && hasil.sesi.instrumen.length > 0) {
          setPartCadanganOsmd((lama) =>
            lama.length > 0
              ? lama
              : hasil.sesi.instrumen.map((i) => ({
                  id: i.idXml,
                  nama: i.nama,
                  singkatan: i.singkatan || undefined,
                })),
          )
        }
      } else if (!hasil.dibatalkan) {
        setInfoSesi(null)
        setGalatRender(hasil.galat)
      }
    })

    return () => {
      pengendali.abort()
      pembersihSesi?.()
    }
  }, [
    itemBerkas,
    zoom,
    tataLetak,
    tandaFilterId,
    layarPenuh,
    seriLebar,
    meta?.judul,
    meta?.jumlahBirama,
    meta?.parts,
    song.title,
  ])

  function ubahZoom(nilaiBaru: number) {
    const jepit = jepitZoom(nilaiBaru)
    setZoom(jepit)
    simpanZoomPartitur(jepit)
  }

  function pilihFilter(baru: FilterPartitur) {
    setFilterAktif(baru)
    simpanFilterPartitur(kunciSimpanFilter, baru)
  }

  const tipe = itemBerkas?.tipe ?? meta?.tipe ?? 'musicxml'
  const namaUnduh = itemBerkas?.namaFile ?? meta?.namaFile ?? `${song.title}.musicxml`
  const persenZoom = Math.round(zoom * 100)

  const teksInfoSesi = useMemo(() => {
    if (!infoSesi) return ''
    const arah = infoSesi.tataLetak === 'mendatar' ? 'mendatar' : 'halaman'
    const totalInst = infoSesi.instrumen.length
    const jumlahTampil = infoSesi.instrumen.filter((i) => i.tampil).length
    if (filterAktif.jenis === 'semua' || jumlahTampil >= totalInst) {
      return `${infoSesi.birama.length} birama · ${totalInst} part terender · Full score (${arah})`
    }
    return `${infoSesi.birama.length} birama · ${jumlahTampil}/${totalInst} part · ${filterAktif.label} (${arah})`
  }, [infoSesi, filterAktif])

  const sedangDiPartAnggota = samaFilterPartitur(filterAktif, pilihanAnggotaAwal.filter)
  const punyaPartAnggotaKhusus =
    Boolean(anggotaAktif) && pilihanAnggotaAwal.filter.jenis !== 'semua'

  return (
    <>
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
            ? 'fixed inset-0 z-40 flex flex-col p-3 sm:p-5'
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
                <span data-testid="partitur-info-sesi">{teksInfoSesi}</span>
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

                {!galatRender && (
                  <Button
                    size="sm"
                    variant="primary"
                    data-testid="partitur-cetak-buka"
                    onClick={() => setCetakTerbuka(true)}
                    title="Pratinjau halaman kertas A4 / Lyre A5, cetak, atau unduh HTML mandiri"
                  >
                    <IconPrinter size={13} /> Cetak / HTML
                  </Button>
                )}
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

        {/* #11c — Bilah penyaringan Full score / kelompok seksi / per part individu */}
        {tipe === 'musicxml' && itemBerkas && daftarPartSkor.length >= 1 && (
          <div
            data-testid="partitur-filter-bar"
            data-kiosk-allow
            style={{
              borderColor: '#1e293b',
              backgroundColor: '#020617',
              color: '#cbd5e1',
            }}
            className="mb-3 space-y-2 rounded-xl border p-2.5 text-xs"
          >
            {daftarPartSkor.length === 1 ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span style={{ color: '#cbd5e1' }}>
                  Part tunggal: <b style={{ color: '#f1f5f9' }}>{daftarPartSkor[0].nama}</b>
                </span>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="mr-0.5 text-[11px] font-medium" style={{ color: '#94a3b8' }}>
                    Tampilan:
                  </span>
                  <button
                    type="button"
                    data-testid="partitur-filter-semua"
                    onClick={() => pilihFilter({ jenis: 'semua' })}
                    style={
                      filterAktif.jenis === 'semua'
                        ? {
                            backgroundColor: '#059669',
                            borderColor: '#10b981',
                            color: '#ffffff',
                          }
                        : {
                            backgroundColor: '#0f172a',
                            borderColor: '#334155',
                            color: '#cbd5e1',
                          }
                    }
                    className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-medium"
                  >
                    Full score ({daftarPartSkor.length})
                  </button>

                  {daftarKelompok.map((kel) => {
                    const aktif =
                      filterAktif.jenis === 'kelompok' && filterAktif.kelompokId === kel.id
                    return (
                      <button
                        key={kel.id}
                        type="button"
                        data-testid={`partitur-filter-kelompok-${kel.id}`}
                        onClick={() =>
                          pilihFilter({
                            jenis: 'kelompok',
                            kelompokId: kel.id,
                            label: kel.label,
                            partIds: kel.partIds,
                          })
                        }
                        style={
                          aktif
                            ? {
                                backgroundColor: '#059669',
                                borderColor: '#10b981',
                                color: '#ffffff',
                              }
                            : {
                                backgroundColor: '#0f172a',
                                borderColor: '#334155',
                                color: '#cbd5e1',
                              }
                        }
                        className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium"
                      >
                        <span
                          aria-hidden="true"
                          style={{ backgroundColor: kel.warnaHex }}
                          className="inline-block h-2 w-2 rounded-full"
                        />
                        {kel.label} ({kel.partIds.length})
                      </button>
                    )
                  })}
                </div>

                <label className="inline-flex items-center gap-1.5">
                  <span className="text-[11px]" style={{ color: '#94a3b8' }}>
                    Part:
                  </span>
                  <select
                    data-testid="partitur-pilih-part"
                    aria-label="Pilih 1 part spesifik"
                    value={filterAktif.jenis === 'part' ? filterAktif.partId : ''}
                    onChange={(e) => {
                      const idDipilih = e.target.value
                      if (!idDipilih) {
                        pilihFilter({ jenis: 'semua' })
                        return
                      }
                      const p = daftarPartSkor.find((x) => x.id === idDipilih)
                      if (p) {
                        pilihFilter({ jenis: 'part', partId: p.id, label: p.nama })
                      }
                    }}
                    style={{
                      borderColor: '#334155',
                      backgroundColor: '#0f172a',
                      color: '#f1f5f9',
                    }}
                    className="max-w-[230px] rounded-lg border px-2 py-1 text-[11px]"
                  >
                    <option value="">— Pilih 1 part spesifik —</option>
                    {daftarPartSkor.map((p, idx) => (
                      <option key={p.id} value={p.id}>
                        {idx + 1}. {p.nama}
                        {p.singkatan ? ` (${p.singkatan})` : ''}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}

            {/* Keterangan cerdas untuk anggota aktif (hanya saat identitas dipilih) */}
            {anggotaAktif && pilihanAnggotaAwal.keterangan && (
              <div
                data-testid="partitur-info-anggota"
                style={{
                  borderColor: '#065f46',
                  backgroundColor: '#022c22',
                  color: '#a7f3d0',
                }}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-[11px]"
              >
                <span>
                  <b style={{ color: '#ecfdf5' }}>
                    {anggotaAktif.panggilan || anggotaAktif.name}:
                  </b>{' '}
                  {sedangDiPartAnggota
                    ? pilihanAnggotaAwal.keterangan
                    : `Sedang melihat tampilan pilihan manual (${
                        filterAktif.jenis === 'semua' ? 'Full score' : filterAktif.label
                      }).`}
                </span>
                {punyaPartAnggotaKhusus && !sedangDiPartAnggota && (
                  <button
                    type="button"
                    data-testid="partitur-ke-part-saya"
                    onClick={() => pilihFilter(pilihanAnggotaAwal.filter)}
                    style={{
                      backgroundColor: '#059669',
                      color: '#ffffff',
                    }}
                    className="rounded-md px-2 py-0.5 text-[11px] font-medium"
                  >
                    Ke part saya ({pilihanAnggotaAwal.filter.jenis === 'semua' ? 'Full score' : pilihanAnggotaAwal.filter.label})
                  </button>
                )}
              </div>
            )}
          </div>
        )}

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
                Berkas PDF berupa lembaran tetap (penyaringan per instrumen khusus MusicXML/MXL). Di peramban HP yang
                tidak menampilkan bingkai di bawah, gunakan tombol di samping untuk membuka atau mencetak PDF.
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

      {itemBerkas && tipe === 'musicxml' && (
        <PratinjauCetakPartitur
          open={cetakTerbuka}
          onClose={() => setCetakTerbuka(false)}
          song={song}
          sumber={itemBerkas.blob}
          daftarPart={daftarPartSkor}
          sectionsTim={sectionsTim}
          filterAwal={filterAktif}
          namaTim={namaTim}
        />
      )}
    </>
  )
}
