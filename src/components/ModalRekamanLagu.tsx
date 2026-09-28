/**
 * #6 — Modal Rekaman Lagu (MP3, WAV, M4A, OGG).
 *
 * Mengunggah berkas audio, menyelaraskan titik mulai birama 1 ketuk 1,
 * menggambar gelombang suara (waveform), memeriksa bersama klik metronom,
 * dan mengatur volume serta mode bunyi.
 */

import { useEffect, useRef, useState } from 'react'
import type { RekamanAudioMeta, Song } from '../db/types'
import {
  bacaDurasiDanPeaks,
  cekKesesuaianRekaman,
  cekPenyimpanan,
  hapusRekamanAudio,
  mintaPenyimpananPersisten,
  muatRekamanAudio,
  simpanRekamanAudio,
  type InfoPenyimpanan,
} from '../lib/rekaman'
import { formatWaktu } from '../lib/birama'
import { formatBytes } from '../lib/backup'
import { Button, Modal, useToast } from './ui'
import { IconCheck, IconPause, IconPlay, IconTrash, IconUpload } from './Icons'

export function ModalRekamanLagu({
  open,
  song,
  onClose,
  onUpdateSong,
  hanyaPutar = false,
}: {
  open: boolean
  song: Song | null
  onClose: () => void
  onUpdateSong: (songId: string, meta: RekamanAudioMeta | null) => Promise<void>
  hanyaPutar?: boolean
}) {
  const toast = useToast()
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const [loading, setLoading] = useState(false)
  const [audioBlobUrl, setAudioBlobUrl] = useState<string | null>(null)
  const [durasiAudio, setDurasiAudio] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)

  // Pengaturan rekaman lokal yang sedang disunting
  const [titikMulai, setTitikMulai] = useState(0)
  const [modeBunyi, setModeBunyi] = useState<'rekaman' | 'keduanya' | 'klik'>('keduanya')
  const [volAudio, setVolAudio] = useState(1.0)
  const [volKlik, setVolKlik] = useState(0.8)
  const [koreksiSegmen, setKoreksiSegmen] = useState<Record<string, number>>({})
  const [peaks, setPeaks] = useState<number[]>([])

  // Penyimpanan browser
  const [storageInfo, setStorageInfo] = useState<InfoPenyimpanan | null>(null)
  // Mode cek bersama klik
  const [cekKlikAktif, setCekKlikAktif] = useState(false)
  const timerKlikRef = useRef<number | null>(null)

  // Inisialisasi saat song berubah
  useEffect(() => {
    if (!open || !song) return

    setTitikMulai(song.rekaman?.titikMulaiDetik ?? 0)
    setModeBunyi(song.rekaman?.modeBunyi ?? 'keduanya')
    setVolAudio(song.rekaman?.volumeAudio ?? 1.0)
    setVolKlik(song.rekaman?.volumeKlik ?? 0.8)
    setKoreksiSegmen(song.rekaman?.koreksiSegmen ?? {})
    setPeaks(song.rekaman?.peaks ?? [])

    void cekPenyimpanan().then(setStorageInfo)

    // Muat Blob audio dari IndexedDB
    let revoked = false
    setLoading(true)
    muatRekamanAudio(song.id)
      .then((item) => {
        if (revoked) return
        if (item && item.blob) {
          const url = URL.createObjectURL(item.blob)
          setAudioBlobUrl(url)
          setDurasiAudio(item.durasi)
          if (!song.rekaman?.peaks && item.blob) {
            void bacaDurasiDanPeaks(item.blob).then((info) => {
              if (info.peaks.length) setPeaks(info.peaks)
              if (!item.durasi && info.durasi) setDurasiAudio(info.durasi)
            })
          }
        } else {
          setAudioBlobUrl(null)
          setDurasiAudio(song.rekaman?.durasi ?? 0)
        }
      })
      .finally(() => {
        if (!revoked) setLoading(false)
      })

    return () => {
      revoked = true
      if (audioBlobUrl) URL.revokeObjectURL(audioBlobUrl)
      if (timerKlikRef.current !== null) {
        window.clearInterval(timerKlikRef.current)
        timerKlikRef.current = null
      }
    }
  }, [open, song?.id])

  // Pasang listener pada audio element
  useEffect(() => {
    const el = audioRef.current
    if (!el) return

    const onTime = () => setCurrentTime(el.currentTime)
    const onPlay = () => setIsPlaying(true)
    const onPause = () => {
      setIsPlaying(false)
      if (cekKlikAktif) hentikanCekKlik()
    }
    const onEnded = () => {
      setIsPlaying(false)
      if (cekKlikAktif) hentikanCekKlik()
    }

    el.addEventListener('timeupdate', onTime)
    el.addEventListener('play', onPlay)
    el.addEventListener('pause', onPause)
    el.addEventListener('ended', onEnded)

    return () => {
      el.removeEventListener('timeupdate', onTime)
      el.removeEventListener('play', onPlay)
      el.removeEventListener('pause', onPause)
      el.removeEventListener('ended', onEnded)
    }
  }, [audioBlobUrl, cekKlikAktif])

  // Gambar Waveform ke Canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = canvas.width
    const h = canvas.height
    ctx.clearRect(0, 0, w, h)

    const list = peaks.length > 0 ? peaks : Array.from({ length: 100 }, () => 0.3)
    const barW = Math.max(2, (w / list.length) - 1.5)
    const midY = h / 2

    // Background bar gelombang
    for (let i = 0; i < list.length; i++) {
      const x = i * (w / list.length)
      const val = list[i]
      const barH = Math.max(4, val * (h - 8))

      // Sorot jika sebelum titik mulai atau setelahnya
      const posDetik = durasiAudio > 0 ? (i / list.length) * durasiAudio : 0
      if (posDetik < titikMulai) {
        ctx.fillStyle = '#475569' // slate-600 (pre-roll intro)
      } else {
        ctx.fillStyle = '#059669' // emerald-600
      }
      ctx.fillRect(x, midY - barH / 2, barW, barH)
    }

    // Gambar indikator posisi saat ini (biru)
    if (durasiAudio > 0 && currentTime > 0) {
      const curX = (currentTime / durasiAudio) * w
      ctx.fillStyle = '#38bdf8' // sky-400
      ctx.fillRect(curX - 1, 0, 2, h)
    }

    // Gambar garis penanda Titik Mulai (birama 1 ketuk 1) — emas/amber
    if (durasiAudio > 0) {
      const startX = (titikMulai / durasiAudio) * w
      ctx.fillStyle = '#f59e0b' // amber-500
      ctx.fillRect(startX - 1.5, 0, 3, h)

      // Kepala penanda
      ctx.beginPath()
      ctx.moveTo(startX - 6, 0)
      ctx.lineTo(startX + 6, 0)
      ctx.lineTo(startX, 8)
      ctx.fill()
    }
  }, [peaks, titikMulai, currentTime, durasiAudio])

  // Unggah berkas audio baru
  const handlePilihBerkas = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !song) return
    try {
      setLoading(true)
      const res = await simpanRekamanAudio(song.id, file, file.name)
      if (audioBlobUrl) URL.revokeObjectURL(audioBlobUrl)
      const url = URL.createObjectURL(res.item.blob)
      setAudioBlobUrl(url)
      setDurasiAudio(res.meta.durasi)
      setPeaks(res.meta.peaks ?? [])

      if (hanyaPutar && song.rekaman) {
        // Mode anggota: periksa kesesuaian sidik dengan materi pelatih
        const uji = cekKesesuaianRekaman(song.rekaman, {
          hash: res.meta.hash,
          durasi: res.meta.durasi,
        })
        if (uji.cocok) {
          toast.push('✔ Rekaman cocok dengan materi pelatih')
        } else {
          toast.push(`⚠ Rekaman berbeda dengan versi pelatih (${uji.alasan ?? 'beda sidik'}). Posisi ketukan mungkin tidak tepat.`, 'info')
        }
      } else {
        // Mode pelatih: simpan metadata awal
        setTitikMulai(0)
        await onUpdateSong(song.id, res.meta)
        toast.push(`Rekaman ${file.name} berhasil disimpan`)
      }
      void cekPenyimpanan().then(setStorageInfo)
    } catch {
      toast.push('Gagal memproses berkas audio', 'err')
    } finally {
      setLoading(false)
      e.target.value = ''
    }
  }

  // Hapus rekaman
  const handleHapusRekaman = async () => {
    if (!song) return
    if (!confirm('Hapus rekaman audio dari lagu ini?')) return
    try {
      await hapusRekamanAudio(song.id)
      if (audioBlobUrl) {
        URL.revokeObjectURL(audioBlobUrl)
        setAudioBlobUrl(null)
      }
      setDurasiAudio(0)
      setPeaks([])
      await onUpdateSong(song.id, null)
      toast.push('Rekaman audio dihapus')
      void cekPenyimpanan().then(setStorageInfo)
    } catch {
      toast.push('Gagal menghapus rekaman', 'err')
    }
  }

  // Geser titik mulai (ms)
  const geserTitikMulaiMs = (deltaMs: number) => {
    setTitikMulai((lama) => {
      const baru = Math.max(0, Math.min(durasiAudio, lama + deltaMs / 1000))
      return Number(baru.toFixed(3))
    })
  }

  // Tandai waktu saat ini sebagai titik mulai
  const tandaiTitikMulaiSekarang = () => {
    if (!audioRef.current) return
    const pos = Number(audioRef.current.currentTime.toFixed(3))
    setTitikMulai(pos)
    toast.push(`Titik mulai disetel ke ${pos.toFixed(3)} dtk`)
  }

  // Putar / Jeda
  const togglePutar = () => {
    const el = audioRef.current
    if (!el) return
    if (isPlaying) {
      el.pause()
    } else {
      el.play().catch(() => toast.push('Peramban memblokir putar otomatis', 'err'))
    }
  }

  // Lompat ke titik mulai
  const lompatKeMulai = () => {
    const el = audioRef.current
    if (el) {
      el.currentTime = titikMulai
      setCurrentTime(titikMulai)
    }
  }

  // Cek bersama klik metronom
  const mulaiCekKlik = () => {
    if (!song || !audioRef.current) return
    const audio = audioRef.current
    audio.currentTime = titikMulai
    audio.play().catch(() => {})
    setCekKlikAktif(true)

    // Bunyikan Web Audio beeps sesuai BPM pada ketukan
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new AudioCtx()
    const bpm = song.bpm || 120
    const intervalMs = (60 / bpm) * 1000

    let beat = 0
    const bunyikan = () => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)

      const aksen = beat % (song.beats || 4) === 0
      osc.frequency.value = aksen ? 1000 : 800
      gain.gain.setValueAtTime(volKlik * 0.7, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.05)
      beat++
    }

    bunyikan()
    timerKlikRef.current = window.setInterval(bunyikan, intervalMs)
  }

  const hentikanCekKlik = () => {
    if (timerKlikRef.current !== null) {
      window.clearInterval(timerKlikRef.current)
      timerKlikRef.current = null
    }
    setCekKlikAktif(false)
  }

  // Simpan perubahan metadata ke database
  const simpanPengaturan = async () => {
    if (!song || !song.rekaman) return
    try {
      const metaBaru: RekamanAudioMeta = {
        ...song.rekaman,
        titikMulaiDetik: titikMulai,
        modeBunyi,
        volumeAudio: volAudio,
        volumeKlik: volKlik,
        koreksiSegmen: Object.keys(koreksiSegmen).length > 0 ? koreksiSegmen : undefined,
        peaks: peaks.length > 0 ? peaks : song.rekaman.peaks,
      }
      await onUpdateSong(song.id, metaBaru)
      toast.push('Pengaturan rekaman disimpan')
      onClose()
    } catch {
      toast.push('Gagal menyimpan pengaturan', 'err')
    }
  }

  if (!song) return null

  const punyaRekaman = !!song.rekaman || !!audioBlobUrl

  return (
    <Modal
      open={open}
      onClose={() => {
        if (isPlaying && audioRef.current) audioRef.current.pause()
        if (cekKlikAktif) hentikanCekKlik()
        onClose()
      }}
      title={`Rekaman Audio — ${song.title}`}
      wide
      footer={
        punyaRekaman && !hanyaPutar ? (
          <div className="flex w-full items-center justify-between gap-2">
            <Button variant="danger" size="sm" onClick={handleHapusRekaman}>
              <IconTrash size={14} /> Hapus rekaman
            </Button>
            <div className="flex items-center gap-2">
              <Button onClick={onClose}>Batal</Button>
              <Button variant="primary" onClick={simpanPengaturan}>
                <IconCheck size={16} /> Simpan Penyelarasan
              </Button>
            </div>
          </div>
        ) : (
          <Button onClick={onClose}>Tutup</Button>
        )
      }
    >
      {/* Hidden Audio Element */}
      {audioBlobUrl && (
        <audio ref={audioRef} src={audioBlobUrl} preload="auto" />
      )}

      <div className="space-y-4 text-xs">
        {/* Banner Penjelasan */}
        <p className="text-slate-400">
          Gunakan rekaman audio bertempo stabil (hasil render software notasi seperti MuseScore/Sibelius
          atau rekaman live dengan metronom klik). Rekaman disimpan offline di perangkat ini.
        </p>

        {loading ? (
          <div className="py-8 text-center text-slate-400">Memuat berkas audio...</div>
        ) : !audioBlobUrl ? (
          /* Layar Belum Ada Berkas Audio Lokal */
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-900/40 p-8 text-center">
            <IconUpload size={32} className="mb-2 text-slate-500" />
            <p className="font-semibold text-slate-200">
              {song.rekaman ? 'Berkas rekaman audio belum diunggah di perangkat ini' : 'Belum ada rekaman audio'}
            </p>
            <p className="mt-1 max-w-sm text-slate-400">
              {song.rekaman
                ? `Pelatih menyelaraskan materi ini dengan ${song.rekaman.namaFile} (${formatWaktu(song.rekaman.durasi)}). Tambahkan berkas audio tersebut untuk berlatih.`
                : 'Pilih berkas MP3, WAV, M4A, atau OGG dari perangkat untuk diselaraskan dengan tempo map lagu.'}
            </p>
            <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white shadow hover:bg-emerald-500">
              <IconUpload size={16} />{' '}
              {hanyaPutar ? 'Tambahkan rekaman dari pelatih' : 'Pilih berkas audio'}
              <input
                type="file"
                accept="audio/*,.mp3,.wav,.m4a,.ogg"
                className="hidden"
                onChange={handlePilihBerkas}
              />
            </label>
          </div>
        ) : (
          /* Layar Sudah Ada Rekaman & Penyelarasan */
          <div className="space-y-4">
            {/* Kartu Informasi Berkas */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/60 p-3">
              <div>
                <p className="font-semibold text-slate-200">{song.rekaman?.namaFile ?? 'Audio'}</p>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  {formatWaktu(durasiAudio || song.rekaman?.durasi || 0)} ·{' '}
                  {formatBytes(song.rekaman?.ukuran ?? 0)}
                  {song.rekaman?.hash ? ` · SHA: ${song.rekaman.hash.slice(0, 10)}…` : ''}
                </p>
              </div>
              {!hanyaPutar && (
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded bg-slate-800 px-2.5 py-1 text-[11px] font-medium text-slate-300 hover:bg-slate-700">
                  <IconUpload size={13} /> Ganti berkas
                  <input
                    type="file"
                    accept="audio/*,.mp3,.wav,.m4a,.ogg"
                    className="hidden"
                    onChange={handlePilihBerkas}
                  />
                </label>
              )}
            </div>

            {/* Visualisasi Gelombang Suara (Waveform) */}
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
              <div className="mb-2 flex items-center justify-between text-[11px] text-slate-400">
                <span>Gelombang Suara</span>
                <span>
                  Posisi: <strong className="text-sky-300">{formatWaktu(currentTime)}</strong> / {formatWaktu(durasiAudio)}
                </span>
              </div>

              <div
                className="relative h-20 w-full cursor-pointer overflow-hidden rounded-lg bg-slate-900"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect()
                  const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
                  const pos = frac * durasiAudio
                  if (audioRef.current) {
                    audioRef.current.currentTime = pos
                    setCurrentTime(pos)
                  }
                }}
              >
                <canvas
                  ref={canvasRef}
                  width={600}
                  height={80}
                  className="h-full w-full"
                />
              </div>

              {/* Bar Kontrol Putar */}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-850 pt-2">
                <div className="flex items-center gap-2">
                  <Button size="sm" variant={isPlaying ? 'primary' : 'soft'} onClick={togglePutar}>
                    {isPlaying ? <IconPause size={14} /> : <IconPlay size={14} />}
                    {isPlaying ? 'Jeda' : 'Putar Audio'}
                  </Button>
                  <Button size="sm" onClick={lompatKeMulai} title="Lompat ke Titik Mulai (Birama 1 Ketuk 1)">
                    Ke Titik Mulai
                  </Button>
                </div>

                {!hanyaPutar && (
                  <Button
                    size="sm"
                    variant={cekKlikAktif ? 'primary' : 'outline'}
                    onClick={cekKlikAktif ? hentikanCekKlik : mulaiCekKlik}
                    title="Putar bersama metronom klik untuk memeriksa keselarasan ketukan"
                  >
                    {cekKlikAktif ? <IconPause size={14} /> : <IconPlay size={14} />}
                    {cekKlikAktif ? 'Hentikan Cek Klik' : 'Cek Bersama Klik'}
                  </Button>
                )}
              </div>
            </div>

            {/* Penyelarasan Titik Mulai (Birama 1 Ketuk 1) */}
            <div className="rounded-xl border border-amber-900/40 bg-amber-950/15 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-amber-200">Titik Mulai (Birama 1 Ketuk 1)</h3>
                  <p className="mt-0.5 text-[11px] text-amber-300/80">
                    Posisi detik di dalam file audio saat ketukan pertama lagu mulai terdengar.
                  </p>
                </div>
                {!hanyaPutar && (
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={tandaiTitikMulaiSekarang}
                    title="Jadikan waktu playback sekarang sebagai titik mulai"
                  >
                    Tandai di sini ({currentTime.toFixed(2)} dtk)
                  </Button>
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold text-amber-300">
                  {titikMulai.toFixed(3)} dtk
                </span>
                {!hanyaPutar && (
                  <div className="flex items-center gap-1">
                    <Button size="sm" onClick={() => geserTitikMulaiMs(-50)}>−50 ms</Button>
                    <Button size="sm" onClick={() => geserTitikMulaiMs(-10)}>−10 ms</Button>
                    <Button size="sm" onClick={() => geserTitikMulaiMs(+10)}>+10 ms</Button>
                    <Button size="sm" onClick={() => geserTitikMulaiMs(+50)}>+50 ms</Button>
                    <Button size="sm" onClick={() => setTitikMulai(0)}>Reset (0 dtk)</Button>
                  </div>
                )}
              </div>
            </div>

            {/* Pilihan Bunyi & Volume */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                <p className="mb-2 font-semibold text-slate-200">Mode Bunyi Saat Latihan</p>
                <div className="flex flex-wrap gap-1.5">
                  {(['rekaman', 'keduanya', 'klik'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      disabled={hanyaPutar}
                      onClick={() => setModeBunyi(m)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                        modeBunyi === m
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                      }`}
                    >
                      {m === 'rekaman'
                        ? '🎵 Rekaman Saja'
                        : m === 'keduanya'
                          ? '🎵+🔔 Rekaman + Klik'
                          : '🔔 Klik Saja'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                <p className="mb-2 font-semibold text-slate-200">Volume Pengiring</p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-400">Audio: {Math.round(volAudio * 100)}%</span>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      disabled={hanyaPutar}
                      value={volAudio}
                      onChange={(e) => setVolAudio(Number(e.target.value))}
                      className="h-1.5 w-32 cursor-pointer accent-emerald-500"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-400">Klik: {Math.round(volKlik * 100)}%</span>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      disabled={hanyaPutar}
                      value={volKlik}
                      onChange={(e) => setVolKlik(Number(e.target.value))}
                      className="h-1.5 w-32 cursor-pointer accent-emerald-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Koreksi Per Segmen (Opsional untuk Fermata/Rit) */}
            {song.tempoMap.length > 1 && (
              <details className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                <summary className="cursor-pointer font-semibold text-slate-300">
                  Koreksi Offset Per Segmen (Fermata / Ritardando)
                </summary>
                <p className="mt-1 text-[11px] text-slate-500">
                  Jika rekaman live memiliki jeda/fermata pada pergantian segmen, atur offset milidetik di sini.
                </p>
                <div className="mt-3 space-y-2">
                  {song.tempoMap.map((seg) => {
                    const segKey = seg.id || String(seg.measure)
                    const val = koreksiSegmen[segKey] ?? 0
                    return (
                      <div key={segKey} className="flex items-center justify-between rounded bg-slate-900 px-2 py-1.5">
                        <span className="text-slate-300">
                          Bar {seg.measure} ({seg.label || 'Segmen'})
                        </span>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            step="10"
                            disabled={hanyaPutar}
                            value={val}
                            onChange={(e) =>
                              setKoreksiSegmen((prev) => ({
                                ...prev,
                                [segKey]: Number(e.target.value),
                              }))
                            }
                            className="w-20 rounded border border-slate-700 bg-slate-950 px-2 py-0.5 text-right text-xs text-white"
                          />
                          <span className="text-slate-500">ms</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </details>
            )}

            {/* Info Penyimpanan & iPhone / iOS note */}
            <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-2.5 text-[11px] text-slate-400">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  Penyimpanan browser:{' '}
                  {storageInfo?.terpakaiMb ? `${storageInfo.terpakaiMb} MB terpakai` : 'Tersedia'}
                  {storageInfo?.persisten ? ' · Persisten ✔' : ' · Belum persisten'}
                </span>
                {!storageInfo?.persisten && (
                  <Button
                    size="sm"
                    variant="soft"
                    onClick={async () => {
                      const ok = await mintaPenyimpananPersisten()
                      if (ok) {
                        toast.push('Penyimpanan persisten diizinkan')
                        void cekPenyimpanan().then(setStorageInfo)
                      } else {
                        toast.push('Peramban belum mengizinkan persisten otomatis', 'err')
                      }
                    }}
                  >
                    Minta Persisten
                  </Button>
                )}
              </div>
              {storageInfo?.pesanIos && (
                <p className="mt-1 text-amber-400/90">{storageInfo.pesanIos}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
