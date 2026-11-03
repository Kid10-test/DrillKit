/**
 * #25 (`v2.2.3`) — Studio Pratinjau Perspektif Tribun Juri (*Press Box View*),
 * Deteksi Halangan Pandang, Simulasi Kontras Seragam/Bendera, & Ekspor Video (`.webm`).
 *
 * Dimuat secara `React.lazy` dari `DrillEditor.tsx` sehingga bundel JS awal
 * aplikasi tetap ramping (`< 420 kB`).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import type {
  CountSheet,
  Drill,
  DrillSet,
  Member,
  PresetLatarTribun,
  PresetSudutTribun,
  SkemaVisualTribun,
  Song,
} from '../../db/types'
import {
  apakahRekamVideoDidukung,
  rekamVideoDrillWebm,
  type CakupanVideoDrill,
  type ModeAudioVideoDrill,
  type ResolusiVideoDrill,
} from '../../lib/eksporVideoDrill'
import {
  DAFTAR_PRESET_LATAR_TRIBUN,
  DAFTAR_PRESET_SUDUT_TRIBUN,
  PALET_CEPAT_SERAGAM_HEX,
  bersihkanWarnaHex,
  buatKameraTribun,
  deteksiHalanganPandang,
  evaluasiKontrasVisual,
  gambarBingkaiPerspektifCanvas,
  interpolasiBingkaiShow,
  normalisasiSkemaVisualTribun,
} from '../../lib/perspektifTribun'
import { cx, slugify } from '../../lib/utils'
import { IconDownload, IconPause, IconPlay } from '../Icons'
import { Button, Modal, Select, Toggle, useToast } from '../ui'

export interface PropsModalPerspektifTribun {
  open: boolean
  onClose: () => void
  drill: Drill
  sets: DrillSet[]
  roster: Member[]
  idxAwal: number
  progresAwal?: number
  countSheets?: CountSheet[]
  song?: Song | null
  tempoPerSet?: number[]
  durasiPerSet?: number[]
  detikMulaiPerSet?: number[]
  bukaLangsungTabVideo?: boolean
}

export default function ModalPerspektifTribun({
  open,
  onClose,
  drill,
  sets,
  roster,
  idxAwal,
  progresAwal = 0,
  countSheets = [],
  song,
  tempoPerSet,
  durasiPerSet,
  detikMulaiPerSet,
  bukaLangsungTabVideo = false,
}: PropsModalPerspektifTribun) {
  const toast = useToast()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const [presetSudut, setPresetSudut] = useState<PresetSudutTribun>('press_box')
  const [idxSet, setIdxSet] = useState(idxAwal)
  const [progres, setProgres] = useState(progresAwal)
  const [sedangPutar, setSedangPutar] = useState(false)
  const [tampilKode, setTampilKode] = useState(false)
  const [tampilHalangan, setTampilHalangan] = useState(true)
  const [idSorotPemain, setIdSorotPemain] = useState<string | null>(null)
  const [tabKanan, setTabKanan] = useState<'kontras' | 'halangan' | 'video'>(
    bukaLangsungTabVideo ? 'video' : 'kontras',
  )

  // Draf sinkron + simpan ke db.drills agar perubahan warna langsung terasa tanpa jeda
  const [skema, setSkema] = useState<SkemaVisualTribun>(() =>
    normalisasiSkemaVisualTribun(drill.skemaVisualTribun),
  )
  const skemaRef = useRef(skema)
  skemaRef.current = skema

  // Pengaturan perekam video .webm
  const [cakupanVideo, setCakupanVideo] = useState<CakupanVideoDrill>('set_aktif')
  const [resolusiVideo, setResolusiVideo] = useState<ResolusiVideoDrill>('540p')
  const [modeAudioVideo, setModeAudioVideo] = useState<ModeAudioVideoDrill>('otomatis')
  const [percepatanBisu, setPercepatanBisu] = useState<1 | 2 | 4>(2)
  const [sedangMerekam, setSedangMerekam] = useState(false)
  const [progresRekam, setProgresRekam] = useState<{ persen: number; teks: string } | null>(null)
  const [hasilVideo, setHasilVideo] = useState<{
    url: string
    namaBerkas: string
    ukuranKb: number
    mimeType: string
    durasiDetik: number
  } | null>(null)
  const abortRekamRef = useRef<AbortController | null>(null)

  const rekamanItem = useLiveQuery(
    async () => (song?.id ? await db.rekamanAudio.get(song.id) : undefined),
    [song?.id],
  )

  useEffect(() => {
    if (!open) {
      setSedangPutar(false)
      abortRekamRef.current?.abort()
      return
    }
    setIdxSet(Math.max(0, Math.min(Math.max(0, sets.length - 1), idxAwal)))
    setProgres(progresAwal)
    setSkema(normalisasiSkemaVisualTribun(drill.skemaVisualTribun))
    if (bukaLangsungTabVideo) setTabKanan('video')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, drill.id, bukaLangsungTabVideo])

  useEffect(() => {
    return () => {
      if (hasilVideo?.url) URL.revokeObjectURL(hasilVideo.url)
    }
  }, [hasilVideo?.url])

  const simpanSkema = useCallback(
    (tambalan: Partial<SkemaVisualTribun>) => {
      const baru = normalisasiSkemaVisualTribun({ ...skemaRef.current, ...tambalan })
      skemaRef.current = baru
      setSkema(baru)
      void db.drills.update(drill.id, {
        skemaVisualTribun: baru,
        updatedAt: Date.now(),
      })
    },
    [drill.id],
  )

  const setAktif = sets[idxSet]
  const adaSetBerikut = Boolean(sets[idxSet + 1])
  const bpmSetAktif = Math.max(30, tempoPerSet?.[idxSet] ?? drill.tempo ?? 120)

  // Animasi pemutaran langsung di kanvas pratinjau
  useEffect(() => {
    if (!open || !sedangPutar) return
    if (!sets[idxSet + 1]) {
      setSedangPutar(false)
      return
    }
    const counts = Math.max(1, sets[idxSet]?.counts || 8)
    const durasiSet =
      durasiPerSet?.[idxSet] && durasiPerSet[idxSet] > 0.1
        ? durasiPerSet[idxSet]
        : (counts * Math.max(0.25, drill.beatsPerCount || 1) * 60) / bpmSetAktif
    let raf = 0
    let tTerakhir = performance.now()

    const langkahFrame = (kini: number) => {
      const dt = (kini - tTerakhir) / 1000
      tTerakhir = kini
      setProgres((lama) => {
        const baru = lama + dt / Math.max(0.4, durasiSet)
        if (baru >= 1) {
          if (idxSet + 2 < sets.length) {
            setIdxSet((s) => s + 1)
            return 0
          }
          setSedangPutar(false)
          return 1
        }
        return baru
      })
      raf = requestAnimationFrame(langkahFrame)
    }
    raf = requestAnimationFrame(langkahFrame)
    return () => cancelAnimationFrame(raf)
  }, [open, sedangPutar, idxSet, sets, durasiPerSet, drill.beatsPerCount, bpmSetAktif])

  // Evaluasi bingkai show + kamera + halangan + kontras
  const lebarKanvas = 960
  const tinggiKanvas = 540

  const kamera = useMemo(
    () => buatKameraTribun(drill.field, presetSudut, lebarKanvas, tinggiKanvas, true),
    [drill.field, presetSudut],
  )

  const bingkai = useMemo(
    () =>
      interpolasiBingkaiShow({
        sets,
        idxSet,
        p: adaSetBerikut ? progres : 0,
        anggota: roster,
        markers: drill.markers,
        countSheets,
        skemaVisual: skema,
      }),
    [sets, idxSet, adaSetBerikut, progres, roster, drill.markers, countSheets, skema],
  )

  const daftarHalangan = useMemo(
    () =>
      deteksiHalanganPandang({
        kamera,
        pemain: bingkai.pemain,
        markers: bingkai.markers,
        tinggiPemainMeter: skema.tinggiPemainMeter,
      }),
    [kamera, bingkai.pemain, bingkai.markers, skema.tinggiPemainMeter],
  )

  const idsTerhalang = useMemo(
    () => new Set(daftarHalangan.map((h) => h.idPemain)),
    [daftarHalangan],
  )

  // Kumpulkan seluruh warna bendera per-blok di CountSheet drill ini untuk evaluasi kontras lengkap
  const warnaBenderaCountSheet = useMemo(() => {
    const daftar: { label: string; warnaHex: string }[] = [...bingkai.warnaBenderaAktif]
    for (const cs of countSheets) {
      for (const b of cs.blok) {
        if (b.warnaBendera) {
          daftar.push({
            label: `Bendera ${b.labelBagian}`,
            warnaHex: b.warnaBendera,
          })
        }
      }
    }
    return daftar
  }, [bingkai.warnaBenderaAktif, countSheets])

  const evaluasiKontras = useMemo(
    () => evaluasiKontrasVisual(skema, drill.field, warnaBenderaCountSheet),
    [skema, drill.field, warnaBenderaCountSheet],
  )

  // Gambar bingkai ke <canvas> pratinjau
  useEffect(() => {
    if (!open) return
    const kanvas = canvasRef.current
    if (!kanvas) return
    const ctx = kanvas.getContext('2d')
    if (!ctx) return
    const judulShow = drill.showTitle ? `${drill.showTitle} — ${drill.name}` : drill.name
    gambarBingkaiPerspektifCanvas(ctx, {
      field: drill.field,
      kamera,
      bingkai,
      skemaVisual: skema,
      idsTerhalang: tampilHalangan ? idsTerhalang : undefined,
      idSorotPemain,
      tampilKode,
      hud: {
        judulShow,
        namaSet: setAktif?.name ?? `Set ${idxSet + 1}`,
        urutanSetTeks: `${idxSet + 1}/${Math.max(1, sets.length)}`,
        bpm: bpmSetAktif,
      },
    })
  }, [
    open,
    drill.field,
    drill.showTitle,
    drill.name,
    kamera,
    bingkai,
    skema,
    tampilHalangan,
    idsTerhalang,
    idSorotPemain,
    tampilKode,
    setAktif?.name,
    idxSet,
    sets.length,
    bpmSetAktif,
  ])

  function unduhPotretPng() {
    const kanvas = canvasRef.current
    if (!kanvas) return
    kanvas.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${slugify(drill.name || 'drill')}-${presetSudut}-${slugify(setAktif?.name || 'set')}.png`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 4000)
      toast.push('Potret perspektif tribun (.png) diunduh')
    }, 'image/png')
  }

  async function jalankanRekamWebm() {
    if (sedangMerekam) return
    setSedangPutar(false)
    setSedangMerekam(true)
    setProgresRekam({ persen: 1, teks: 'Menyiapkan kanvas & jalur suara…' })
    const controller = new AbortController()
    abortRekamRef.current = controller

    try {
      const hasil = await rekamVideoDrillWebm({
        drill,
        sets,
        roster,
        idxSetAktif: idxSet,
        presetSudut,
        skemaVisual: skema,
        tampilKode,
        tampilHalangan,
        cakupan: cakupanVideo,
        resolusi: resolusiVideo,
        modeAudio: modeAudioVideo,
        percepatanBisu,
        countSheets,
        song,
        rekamanBlob: rekamanItem?.blob ?? null,
        tempoPerSet,
        durasiPerSet,
        detikMulaiPerSet,
        signal: controller.signal,
        onProgres: (persen, teks) => setProgresRekam({ persen, teks }),
      })

      if (hasilVideo?.url) URL.revokeObjectURL(hasilVideo.url)
      const url = URL.createObjectURL(hasil.blob)
      const ukuranKb = Math.max(1, Math.round((hasil.blob.size / 1024) * 10) / 10)
      setHasilVideo({
        url,
        namaBerkas: hasil.namaBerkas,
        ukuranKb,
        mimeType: hasil.mimeType,
        durasiDetik: hasil.durasiDetik,
      })

      // Picu unduhan langsung berkas .webm
      const a = document.createElement('a')
      a.href = url
      a.download = hasil.namaBerkas
      a.click()
      toast.push(`Video animasi (${ukuranKb} KB) siap diunduh!`)
    } catch (err) {
      const pesan = err instanceof Error ? err.message : 'Gagal merekam video.'
      if (!/dibatalkan/i.test(pesan)) {
        toast.push(pesan, 'err')
      }
    } finally {
      setSedangMerekam(false)
      setProgresRekam(null)
      abortRekamRef.current = null
    }
  }

  const countsSet = Math.max(1, setAktif?.counts || 8)

  return (
    <Modal
      open={open}
      onClose={() => {
        if (sedangMerekam) abortRekamRef.current?.abort()
        onClose()
      }}
      title="Perspektif Tribun Juri, Kontras Seragam/Bendera, & Video (.webm)"
      wide
    >
      <div className="space-y-3" data-testid="modal-perspektif-tribun">
        {/* Baris 4 Preset Sudut Pandang */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div
            className="inline-flex flex-wrap gap-1 rounded-xl border border-slate-800 bg-slate-900/90 p-1"
            role="group"
            aria-label="Preset sudut pandang tribun"
          >
            {DAFTAR_PRESET_SUDUT_TRIBUN.map((pr) => (
              <button
                key={pr.id}
                type="button"
                data-testid={`preset-tribun-${pr.id}`}
                onClick={() => {
                  setPresetSudut(pr.id)
                  setIdSorotPemain(null)
                }}
                title={pr.keterangan}
                className={cx(
                  'rounded-lg px-2.5 py-1 text-xs font-medium transition',
                  presetSudut === pr.id
                    ? 'bg-emerald-600/30 text-emerald-200 ring-1 ring-emerald-500/40'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200',
                )}
              >
                {pr.labelPendek}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span
              data-testid="lencana-halangan-tribun"
              className={cx(
                'rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                daftarHalangan.length > 0
                  ? 'bg-rose-500/20 text-rose-300 ring-1 ring-rose-500/40'
                  : 'bg-emerald-500/15 text-emerald-300',
              )}
            >
              {presetSudut === 'atas'
                ? 'Denah 90°'
                : daftarHalangan.length === 0
                  ? '✓ Bebas halangan pandang'
                  : `${daftarHalangan.length} pemain terhalang`}
            </span>
            <span
              data-testid="lencana-kontras-tribun"
              className={cx(
                'rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                evaluasiKontras.jmlTenggelam > 0
                  ? 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40'
                  : 'bg-sky-500/15 text-sky-300',
              )}
            >
              {evaluasiKontras.jmlTenggelam > 0
                ? `${evaluasiKontras.jmlTenggelam} warna tenggelam`
                : '✓ Kontras seragam jelas'}
            </span>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
          {/* Kolom Kiri: Kanvas 2.5D + Kendali Putar/Scrubber */}
          <div className="min-w-0 space-y-2">
            <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
              <canvas
                ref={canvasRef}
                width={lebarKanvas}
                height={tinggiKanvas}
                data-testid="kanvas-perspektif-tribun"
                className="block h-auto w-full"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  data-testid="tribun-set-sebelum"
                  disabled={idxSet <= 0}
                  onClick={() => {
                    setSedangPutar(false)
                    setIdxSet((i) => Math.max(0, i - 1))
                    setProgres(0)
                  }}
                  className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-35"
                >
                  ‹
                </button>
                <span className="min-w-20 text-center text-xs font-medium text-slate-200">
                  {setAktif?.name ?? '-'} ({idxSet + 1}/{sets.length})
                </span>
                <button
                  type="button"
                  data-testid="tribun-set-berikut"
                  disabled={idxSet >= sets.length - 1}
                  onClick={() => {
                    setSedangPutar(false)
                    setIdxSet((i) => Math.min(sets.length - 1, i + 1))
                    setProgres(0)
                  }}
                  className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-35"
                >
                  ›
                </button>
              </div>

              <Button
                size="sm"
                variant={sedangPutar ? 'danger' : 'primary'}
                data-testid="tombol-putar-tribun"
                disabled={!adaSetBerikut}
                onClick={() => {
                  if (!sedangPutar && progres >= 0.99) setProgres(0)
                  setSedangPutar((v) => !v)
                }}
              >
                {sedangPutar ? <IconPause size={13} /> : <IconPlay size={13} />}
                {sedangPutar ? 'Jeda' : 'Putar'}
              </Button>

              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={adaSetBerikut ? progres : 0}
                disabled={!adaSetBerikut}
                data-testid="scrubber-tribun"
                onChange={(e) => {
                  setSedangPutar(false)
                  setProgres(Number(e.target.value))
                }}
                className="h-1.5 min-w-[100px] flex-1 accent-emerald-500"
              />

              <span className="font-mono text-[11px] text-slate-300">
                c{Math.round((adaSetBerikut ? progres : 0) * countsSet * 10) / 10}/{countsSet}
              </span>

              <Button
                size="sm"
                variant="soft"
                data-testid="tombol-potret-tribun-png"
                onClick={unduhPotretPng}
                title="Simpan gambar bingkai sudut pandang tribun saat ini (.png)"
              >
                <IconDownload size={13} /> PNG
              </Button>
            </div>

            <div className="flex flex-wrap gap-4 px-1">
              <Toggle
                checked={tampilKode}
                onChange={setTampilKode}
                label="Tampilkan kode pemain"
              />
              <Toggle
                checked={tampilHalangan}
                onChange={setTampilHalangan}
                label="Tandai cincin halangan pandang (#f43f5e)"
              />
            </div>
          </div>

          {/* Kolom Kanan: Tab Kontras Seragam/Bendera · Halangan Pandang · Ekspor Video .webm */}
          <div className="min-w-0 space-y-2.5 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
            <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-950 p-1 text-[11px]">
              {(
                [
                  ['kontras', 'Seragam & Kain'],
                  ['halangan', `Halangan (${daftarHalangan.length})`],
                  ['video', 'Video .webm'],
                ] as const
              ).map(([idTab, judul]) => (
                <button
                  key={idTab}
                  type="button"
                  data-testid={`tab-tribun-${idTab}`}
                  onClick={() => setTabKanan(idTab)}
                  className={cx(
                    'rounded-md px-2 py-1 font-medium transition',
                    tabKanan === idTab
                      ? 'bg-slate-800 text-emerald-300'
                      : 'text-slate-400 hover:text-slate-200',
                  )}
                >
                  {judul}
                </button>
              ))}
            </div>

            {tabKanan === 'kontras' && (
              <div className="space-y-2.5" data-testid="panel-kontras-visual">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-300">
                    Warna Permukaan Arena / Lapangan
                  </label>
                  <Select
                    data-testid="pilih-latar-tribun"
                    value={skema.latar}
                    onChange={(e) => simpanSkema({ latar: e.target.value as PresetLatarTribun })}
                    className="w-full py-1 text-xs"
                  >
                    {DAFTAR_PRESET_LATAR_TRIBUN.map((lt) => (
                      <option key={lt.id} value={lt.id}>
                        {lt.label}
                      </option>
                    ))}
                  </Select>
                </div>

                {(
                  [
                    ['jaketHex', 'Jaket Seragam', 'warna-jaket-input'],
                    ['celanaHex', 'Celana (Langkah Kaki)', 'warna-celana-input'],
                    ['plumeHex', 'Plume / Topi', 'warna-plume-input'],
                    ['warnaBenderaHex', 'Bendera Guard Utama', 'warna-bendera-input'],
                  ] as const
                ).map(([kunci, label, testId]) => (
                  <div key={kunci} className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-medium text-slate-300">{label}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[10px] text-slate-400">
                          {skema[kunci]}
                        </span>
                        <input
                          type="color"
                          data-testid={testId}
                          value={bersihkanWarnaHex(skema[kunci])}
                          onChange={(e) => simpanSkema({ [kunci]: e.target.value })}
                          className="h-5 w-7 cursor-pointer rounded border border-slate-700 bg-transparent p-0"
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {PALET_CEPAT_SERAGAM_HEX.map((hx) => (
                        <button
                          key={`${kunci}-${hx}`}
                          type="button"
                          data-testid={`swatch-${kunci}-${hx.slice(1)}`}
                          onClick={() => simpanSkema({ [kunci]: hx })}
                          aria-label={`${label} ${hx}`}
                          style={{ backgroundColor: hx }}
                          className={cx(
                            'h-4 w-4 rounded-full border border-slate-700',
                            bersihkanWarnaHex(skema[kunci]) === hx ? 'ring-2 ring-white' : '',
                          )}
                        />
                      ))}
                    </div>
                  </div>
                ))}

                {/* Tabel hasil audit kontras WCAG terhadap rumput/lantai */}
                <div className="space-y-1 border-t border-slate-800 pt-2">
                  <p className="text-[11px] font-semibold text-slate-200">
                    Keterbacaan Kontras dari Tribun:
                  </p>
                  <ul className="space-y-1" data-testid="daftar-evaluasi-kontras">
                    {evaluasiKontras.butir.map((b) => (
                      <li
                        key={b.id}
                        data-testid={`kontras-butir-${b.id}`}
                        className={cx(
                          'flex items-center justify-between gap-2 rounded-md px-2 py-1 text-[11px]',
                          b.tingkat === 'tenggelam'
                            ? 'border border-rose-700/50 bg-rose-950/35 text-rose-200'
                            : b.tingkat === 'cukup'
                              ? 'bg-amber-950/25 text-amber-200'
                              : 'bg-slate-950/70 text-slate-200',
                        )}
                        title={b.catatan}
                      >
                        <span className="flex items-center gap-1.5 truncate">
                          <span
                            className="inline-block h-3 w-3 shrink-0 rounded-sm border border-white/30"
                            style={{ backgroundColor: b.warnaHex }}
                          />
                          <span className="truncate">{b.elemen}</span>
                        </span>
                        <span className="shrink-0 font-mono text-[10px] font-semibold">
                          {b.rasio.toFixed(2)}:1 ·{' '}
                          {b.tingkat === 'tajam'
                            ? 'Tajam'
                            : b.tingkat === 'cukup'
                              ? 'Cukup'
                              : 'Tenggelam!'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {tabKanan === 'halangan' && (
              <div className="space-y-2" data-testid="panel-halangan-pandang">
                <p className="text-[11px] leading-relaxed text-slate-400">
                  Mendeteksi pemain yang tertutup properti bervolume (<b>Tinggi fisik &gt; 0,85 m</b>{' '}
                  di panel Penanda) atau berdiri segaris tepat di belakang bahu barisan depan pada
                  sudut pandang <b>{DAFTAR_PRESET_SUDUT_TRIBUN.find((s) => s.id === presetSudut)?.label}</b>.
                </p>

                {presetSudut === 'atas' ? (
                  <p className="rounded-lg bg-slate-950/70 p-2.5 text-[11px] text-slate-400">
                    Pilih sudut <b>Podium 3 m</b>, <b>Tribun 8 m</b>, atau <b>Press Box 18 m</b>{' '}
                    untuk menguji garis pandang miring.
                  </p>
                ) : daftarHalangan.length === 0 ? (
                  <p
                    data-testid="status-bebas-halangan"
                    className="rounded-lg border border-emerald-800/40 bg-emerald-950/25 p-2.5 text-[11px] text-emerald-300"
                  >
                    ✓ Seluruh pemain terlihat jelas tanpa tertutup properti tinggi maupun barisan
                    depan pada sudut ini.
                  </p>
                ) : (
                  <ul className="max-h-72 space-y-1 overflow-y-auto" data-testid="daftar-halangan-pandang">
                    {daftarHalangan.map((h, i) => (
                      <li key={`${h.idPemain}-${i}`}>
                        <button
                          type="button"
                          data-testid={`fokus-halangan-${i}`}
                          onClick={() =>
                            setIdSorotPemain((lama) => (lama === h.idPemain ? null : h.idPemain))
                          }
                          className={cx(
                            'flex w-full items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-left text-[11px] transition',
                            idSorotPemain === h.idPemain
                              ? 'border-amber-400/60 bg-amber-950/35 text-amber-100'
                              : 'border-rose-800/40 bg-rose-950/20 text-slate-200 hover:bg-slate-800',
                          )}
                        >
                          <span className="truncate">{h.ringkasan}</span>
                          <span className="shrink-0 font-mono text-[10px] text-rose-300">
                            {h.persenTertutup}%
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {tabKanan === 'video' && (
              <div className="space-y-2.5" data-testid="panel-ekspor-video">
                <p className="text-[11px] leading-relaxed text-slate-400">
                  Rekam animasi formasi sudut <b>{DAFTAR_PRESET_SUDUT_TRIBUN.find((s) => s.id === presetSudut)?.labelPendek}</b>{' '}
                  langsung di peramban menjadi berkas video <b>.webm</b> siap kirim ke grup
                  WhatsApp tim (100% luring, nol server).
                </p>

                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-300">
                    Cakupan Set yang Direkam
                  </label>
                  <Select
                    data-testid="pilih-cakupan-video"
                    value={cakupanVideo}
                    onChange={(e) => setCakupanVideo(e.target.value as CakupanVideoDrill)}
                    className="w-full py-1 text-xs"
                  >
                    <option value="set_aktif">
                      Perpindahan Set Aktif ({setAktif?.name ?? `Set ${idxSet + 1}`})
                    </option>
                    <option value="seluruh_show">
                      Seluruh Show (Set 1 s.d. Set {sets.length})
                    </option>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-slate-300">
                      Resolusi
                    </label>
                    <Select
                      data-testid="pilih-resolusi-video"
                      value={resolusiVideo}
                      onChange={(e) => setResolusiVideo(e.target.value as ResolusiVideoDrill)}
                      className="w-full py-1 text-xs"
                    >
                      <option value="720p">HD 1280×720</option>
                      <option value="540p">Ringkas 960×540</option>
                    </Select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-slate-300">
                      Jalur Suara
                    </label>
                    <Select
                      data-testid="pilih-audio-video"
                      value={modeAudioVideo}
                      onChange={(e) => setModeAudioVideo(e.target.value as ModeAudioVideoDrill)}
                      className="w-full py-1 text-xs"
                    >
                      <option value="otomatis">
                        {rekamanItem?.blob ? 'Rekaman Lagu (#6)' : 'Otomatis (Klik Tempo)'}
                      </option>
                      <option value="klik">Klik Metronom</option>
                      <option value="bisu">Tanpa Suara (Cepat)</option>
                    </Select>
                  </div>
                </div>

                {modeAudioVideo === 'bisu' && (
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-slate-300">
                      Kecepatan Render (Mode Bisu)
                    </label>
                    <Select
                      data-testid="pilih-cepat-bisu"
                      value={String(percepatanBisu)}
                      onChange={(e) => setPercepatanBisu(Number(e.target.value) as 1 | 2 | 4)}
                      className="w-full py-1 text-xs"
                    >
                      <option value="1">1× Waktu Nyata</option>
                      <option value="2">2× Lebih Cepat</option>
                      <option value="4">4× Kilat</option>
                    </Select>
                  </div>
                )}

                {!apakahRekamVideoDidukung() ? (
                  <p className="rounded bg-rose-950/40 p-2 text-[11px] text-rose-300">
                    Peramban ini tidak menyediakan API MediaRecorder kanvas.
                  </p>
                ) : sedangMerekam ? (
                  <div className="space-y-2 rounded-lg border border-emerald-700/40 bg-emerald-950/25 p-2.5">
                    <div className="flex items-center justify-between text-[11px] text-emerald-200">
                      <span>{progresRekam?.teks ?? 'Merekam…'}</span>
                      <span className="font-mono">{progresRekam?.persen ?? 0}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded bg-slate-800">
                      <div
                        className="h-full bg-emerald-500 transition-all"
                        style={{ width: `${progresRekam?.persen ?? 5}%` }}
                      />
                    </div>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => abortRekamRef.current?.abort()}
                      className="w-full justify-center"
                    >
                      Batalkan Perekaman
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="primary"
                    data-testid="tombol-rekam-webm"
                    onClick={() => void jalankanRekamWebm()}
                    className="w-full justify-center"
                  >
                    🎥 Rekam &amp; Unduh Video (.webm)
                  </Button>
                )}

                {hasilVideo && (
                  <div
                    data-testid="info-hasil-webm"
                    className="space-y-1.5 rounded-lg border border-slate-700 bg-slate-950/80 p-2"
                  >
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="truncate font-medium text-emerald-300">
                        ✓ {hasilVideo.namaBerkas}
                      </span>
                      <span className="shrink-0 font-mono text-[10px] text-slate-400">
                        {hasilVideo.ukuranKb} KB
                      </span>
                    </div>
                    <video
                      src={hasilVideo.url}
                      controls
                      playsInline
                      data-testid="pratinjau-video-webm"
                      className="w-full rounded border border-slate-800 bg-black"
                    />
                    <a
                      href={hasilVideo.url}
                      download={hasilVideo.namaBerkas}
                      data-testid="unduh-ulang-webm"
                      className="inline-flex w-full items-center justify-center gap-1 rounded-md bg-slate-800 px-2.5 py-1 text-[11px] font-medium text-slate-200 hover:bg-slate-700"
                    >
                      <IconDownload size={12} /> Unduh Ulang .webm
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}
