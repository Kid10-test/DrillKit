/**
 * #25.3 (`v2.2.3`) — Perekam Ekspor Video Animasi Show Luring (`.webm`).
 *
 * Berjalan 100% di peramban pengguna memakai `HTMLCanvasElement.captureStream`
 * + `MediaRecorder` + `MediaStreamAudioDestinationNode` (rekaman lagu `#6` atau
 * klik metronom sintetis WebAudio) tanpa mengunggah satu bita pun ke peladen.
 */

import type {
  CountSheet,
  Drill,
  DrillSet,
  Member,
  PresetSudutTribun,
  SkemaVisualTribun,
  Song,
} from '../db/types'
import { slugify } from './utils'
import {
  buatKameraTribun,
  deteksiHalanganPandang,
  gambarBingkaiPerspektifCanvas,
  interpolasiBingkaiShow,
} from './perspektifTribun'

export type CakupanVideoDrill = 'set_aktif' | 'seluruh_show'
export type ModeAudioVideoDrill = 'otomatis' | 'klik' | 'bisu'
export type ResolusiVideoDrill = '720p' | '540p'

export interface OpsiRekamVideoDrill {
  drill: Drill
  sets: DrillSet[]
  roster: Member[]
  idxSetAktif: number
  presetSudut: PresetSudutTribun
  skemaVisual: SkemaVisualTribun
  tampilKode: boolean
  tampilHalangan: boolean
  cakupan: CakupanVideoDrill
  resolusi: ResolusiVideoDrill
  modeAudio: ModeAudioVideoDrill
  /** Percepatan render khusus bila modeAudio === 'bisu' (1, 2, atau 4). */
  percepatanBisu?: 1 | 2 | 4
  countSheets?: CountSheet[]
  song?: Song | null
  rekamanBlob?: Blob | null
  tempoPerSet?: number[]
  durasiPerSet?: number[]
  detikMulaiPerSet?: number[]
  signal?: AbortSignal
  onProgres?: (persen: number, keterangan: string) => void
}

export interface HasilRekamVideoDrill {
  blob: Blob
  mimeType: string
  namaBerkas: string
  durasiDetik: number
}

const DAFTAR_KANDIDAT_MIME_WEBM: readonly string[] = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
]

export function pilihMimeVideoWebm(denganAudio = true): string {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return 'video/webm'
  }
  const daftar = denganAudio
    ? DAFTAR_KANDIDAT_MIME_WEBM
    : ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
  for (const m of daftar) {
    if (MediaRecorder.isTypeSupported(m)) return m
  }
  return 'video/webm'
}

export function apakahRekamVideoDidukung(): boolean {
  if (typeof document === 'undefined' || typeof MediaRecorder === 'undefined') return false
  const c = document.createElement('canvas')
  return typeof c.captureStream === 'function'
}

interface SegmenWaktuSetVideo {
  idxSet: number
  mulaiDetik: number
  durasiDetik: number
  bpm: number
  counts: number
  adaPerpindahan: boolean
}

export function susunJadwalWaktuVideo(opsi: {
  drill: Drill
  sets: DrillSet[]
  cakupan: CakupanVideoDrill
  idxSetAktif: number
  tempoPerSet?: number[]
  durasiPerSet?: number[]
}): { segmen: SegmenWaktuSetVideo[]; totalDetik: number } {
  const { drill, sets, cakupan, idxSetAktif, tempoPerSet, durasiPerSet } = opsi
  if (!sets.length) return { segmen: [], totalDetik: 0 }

  const indeksMulai = cakupan === 'set_aktif' ? Math.max(0, Math.min(sets.length - 1, idxSetAktif)) : 0
  const indeksAkhir =
    cakupan === 'set_aktif'
      ? indeksMulai
      : Math.max(0, sets.length - 2) // perpindahan berjalan Set 0->1 .. Set (N-2)->(N-1)

  const segmen: SegmenWaktuSetVideo[] = []
  let kursor = 0

  for (let i = indeksMulai; i <= indeksAkhir; i++) {
    const s = sets[i]
    if (!s) continue
    const adaKe = Boolean(sets[i + 1])
    const counts = Math.max(1, s.counts || 8)
    const bpm = Math.max(30, tempoPerSet?.[i] ?? drill.tempo ?? 120)
    const beatsPerCount = Math.max(0.25, drill.beatsPerCount || 1)
    const durasiHitung =
      durasiPerSet?.[i] && durasiPerSet[i] > 0.1
        ? durasiPerSet[i]
        : (counts * beatsPerCount * 60) / bpm
    // Jika set terakhir dipilih sendirian (tanpa set tujuan), rekam tahan pose 2 detik
    const durasi = adaKe ? Math.max(0.5, durasiHitung) : 2.0
    segmen.push({
      idxSet: i,
      mulaiDetik: kursor,
      durasiDetik: durasi,
      bpm,
      counts,
      adaPerpindahan: adaKe,
    })
    kursor += durasi
  }

  return { segmen, totalDetik: kursor }
}

function jadwalkanKlikMetronomKeTujuan(
  audioCtx: AudioContext,
  tujuan: AudioNode,
  waktuMulaiAudio: number,
  segmen: readonly SegmenWaktuSetVideo[],
) {
  for (const seg of segmen) {
    const detikPerCount = seg.durasiDetik / Math.max(1, seg.counts)
    for (let c = 0; c < seg.counts; c++) {
      const t = waktuMulaiAudio + seg.mulaiDetik + c * detikPerCount
      const osc = audioCtx.createOscillator()
      const gain = audioCtx.createGain()
      const aksen = c === 0
      osc.type = aksen ? 'triangle' : 'sine'
      osc.frequency.setValueAtTime(aksen ? 1320 : 880, t)
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(aksen ? 0.28 : 0.15, t + 0.004)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.055)
      osc.connect(gain)
      gain.connect(tujuan)
      osc.start(t)
      osc.stop(t + 0.065)
    }
  }
}

export async function rekamVideoDrillWebm(
  opsi: OpsiRekamVideoDrill,
): Promise<HasilRekamVideoDrill> {
  if (!apakahRekamVideoDidukung()) {
    throw new Error('Peramban ini belum mendukung perekaman video kanvas (MediaRecorder).')
  }

  const lebarPx = opsi.resolusi === '720p' ? 1280 : 960
  const tinggiPx = opsi.resolusi === '720p' ? 720 : 540
  const fps = 24

  const { segmen, totalDetik } = susunJadwalWaktuVideo({
    drill: opsi.drill,
    sets: opsi.sets,
    cakupan: opsi.cakupan,
    idxSetAktif: opsi.idxSetAktif,
    tempoPerSet: opsi.tempoPerSet,
    durasiPerSet: opsi.durasiPerSet,
  })
  if (!segmen.length || totalDetik <= 0) {
    throw new Error('Belum ada set formasi untuk direkam menjadi video.')
  }

  const jedaPembukaDetik = 0.25
  const jedaPenutupDetik = 0.35
  const durasiAnimasiPenuh = jedaPembukaDetik + totalDetik + jedaPenutupDetik
  const lajuCepat =
    opsi.modeAudio === 'bisu' ? Math.max(1, opsi.percepatanBisu ?? 1) : 1
  const durasiDindingDetik = durasiAnimasiPenuh / lajuCepat

  const kanvasRekam = document.createElement('canvas')
  kanvasRekam.width = lebarPx
  kanvasRekam.height = tinggiPx
  const ctx = kanvasRekam.getContext('2d')
  if (!ctx) throw new Error('Gagal menyiapkan konteks kanvas 2D perekam video.')

  const kamera = buatKameraTribun(opsi.drill.field, opsi.presetSudut, lebarPx, tinggiPx, true)
  const judulShow = opsi.drill.showTitle
    ? `${opsi.drill.showTitle} — ${opsi.drill.name}`
    : opsi.drill.name

  const gambarPadaDetikShow = (detikShow: number) => {
    const tKlip = Math.max(0, Math.min(totalDetik, detikShow - jedaPembukaDetik))
    let segAktif = segmen[segmen.length - 1]
    for (const s of segmen) {
      if (tKlip <= s.mulaiDetik + s.durasiDetik + 1e-6) {
        segAktif = s
        break
      }
    }
    const pSet = segAktif.adaPerpindahan
      ? Math.max(0, Math.min(1, (tKlip - segAktif.mulaiDetik) / Math.max(0.05, segAktif.durasiDetik)))
      : 0

    const bingkai = interpolasiBingkaiShow({
      sets: opsi.sets,
      idxSet: segAktif.idxSet,
      p: pSet,
      anggota: opsi.roster,
      markers: opsi.drill.markers,
      countSheets: opsi.countSheets,
      skemaVisual: opsi.skemaVisual,
    })

    const idsTerhalang = opsi.tampilHalangan
      ? new Set(
          deteksiHalanganPandang({
            kamera,
            pemain: bingkai.pemain,
            markers: bingkai.markers,
            tinggiPemainMeter: opsi.skemaVisual.tinggiPemainMeter,
          }).map((h) => h.idPemain),
        )
      : undefined

    const setObj = opsi.sets[segAktif.idxSet]
    gambarBingkaiPerspektifCanvas(ctx, {
      field: opsi.drill.field,
      kamera,
      bingkai,
      skemaVisual: opsi.skemaVisual,
      idsTerhalang,
      tampilKode: opsi.tampilKode,
      hud: {
        judulShow,
        namaSet: setObj?.name ?? `Set ${segAktif.idxSet + 1}`,
        urutanSetTeks: `${segAktif.idxSet + 1}/${opsi.sets.length}`,
        bpm: segAktif.bpm,
      },
    })
  }

  // Gambar bingkai pertama sebelum captureStream dimulai agar frame ke-0 tidak hitam
  gambarPadaDetikShow(0)
  const streamKanvas = kanvasRekam.captureStream(fps)
  const tracksGabung: MediaStreamTrack[] = [...streamKanvas.getVideoTracks()]

  let audioCtx: AudioContext | null = null
  let sumberBufferAudio: AudioBufferSourceNode | null = null

  if (opsi.modeAudio !== 'bisu' && typeof AudioContext !== 'undefined') {
    try {
      audioCtx = new AudioContext()
      await Promise.race([
        audioCtx.resume(),
        new Promise((r) => setTimeout(r, 600)),
      ])
      if (audioCtx.state === 'running') {
        const dest = audioCtx.createMediaStreamDestination()
        const mulaiAudio = audioCtx.currentTime + jedaPembukaDetik
        let pakaiRekamanLagu = false

        if (opsi.modeAudio === 'otomatis' && opsi.rekamanBlob && opsi.song?.rekaman) {
          try {
            const arrBuf = await opsi.rekamanBlob.arrayBuffer()
            const decoded = await audioCtx.decodeAudioData(arrBuf.slice(0))
            const idxAwal = segmen[0].idxSet
            const offsetLagu =
              (opsi.song.rekaman.titikMulaiDetik || 0) +
              (opsi.detikMulaiPerSet?.[idxAwal] ?? 0)
            if (offsetLagu < decoded.duration) {
              sumberBufferAudio = audioCtx.createBufferSource()
              sumberBufferAudio.buffer = decoded
              sumberBufferAudio.connect(dest)
              sumberBufferAudio.start(
                mulaiAudio,
                Math.max(0, offsetLagu),
                Math.min(totalDetik, decoded.duration - Math.max(0, offsetLagu)),
              )
              pakaiRekamanLagu = true
            }
          } catch {
            pakaiRekamanLagu = false
          }
        }

        if (!pakaiRekamanLagu) {
          jadwalkanKlikMetronomKeTujuan(audioCtx, dest, mulaiAudio, segmen)
        }
        tracksGabung.push(...dest.stream.getAudioTracks())
      } else {
        await audioCtx.close().catch(() => undefined)
        audioCtx = null
      }
    } catch {
      if (audioCtx) await audioCtx.close().catch(() => undefined)
      audioCtx = null
    }
  }

  const streamRekam = new MediaStream(tracksGabung)
  const adaTrackAudio = streamRekam.getAudioTracks().length > 0
  const mimePilihan = pilihMimeVideoWebm(adaTrackAudio)

  const potongan: BlobPart[] = []
  const recorder = new MediaRecorder(streamRekam, {
    mimeType: mimePilihan,
    videoBitsPerSecond: opsi.resolusi === '720p' ? 3_200_000 : 1_800_000,
  })

  const bersihSumberDaya = async () => {
    try {
      sumberBufferAudio?.stop()
    } catch {
      // abaikan bila sudah berhenti
    }
    streamRekam.getTracks().forEach((t) => t.stop())
    streamKanvas.getTracks().forEach((t) => t.stop())
    if (audioCtx) {
      await audioCtx.close().catch(() => undefined)
      audioCtx = null
    }
  }

  return new Promise<HasilRekamVideoDrill>((resolve, reject) => {
    let dibatalkan = false
    let timerTick = 0

    const hentikanBilaBatal = () => {
      dibatalkan = true
      window.clearInterval(timerTick)
      if (recorder.state !== 'inactive') {
        try {
          recorder.stop()
        } catch {
          // abaikan
        }
      }
    }

    if (opsi.signal) {
      if (opsi.signal.aborted) {
        void bersihSumberDaya()
        reject(new Error('Perekaman dibatalkan.'))
        return
      }
      opsi.signal.addEventListener('abort', hentikanBilaBatal, { once: true })
    }

    recorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) potongan.push(ev.data)
    }

    recorder.onerror = () => {
      window.clearInterval(timerTick)
      void bersihSumberDaya().then(() =>
        reject(new Error('Terjadi kegagalan pada perekam MediaRecorder.')),
      )
    }

    recorder.onstop = () => {
      window.clearInterval(timerTick)
      void bersihSumberDaya().then(() => {
        if (dibatalkan) {
          reject(new Error('Perekaman dibatalkan.'))
          return
        }
        const mimeAkhir = recorder.mimeType || mimePilihan || 'video/webm'
        const blob = new Blob(potongan, { type: mimeAkhir })
        const akhiranCakupan =
          opsi.cakupan === 'set_aktif'
            ? slugify(opsi.sets[segmen[0].idxSet]?.name || `set-${segmen[0].idxSet + 1}`)
            : 'full-show'
        const namaBerkas = `${slugify(opsi.drill.name || 'drill')}-${opsi.presetSudut}-${akhiranCakupan}.webm`
        opsi.onProgres?.(100, 'Video selesai dirakit!')
        resolve({
          blob,
          mimeType: mimeAkhir,
          namaBerkas,
          durasiDetik: Math.round(durasiDindingDetik * 10) / 10,
        })
      })
    }

    recorder.start(200)
    const tMulaiMs = performance.now()
    opsi.onProgres?.(2, 'Merekam animasi formasi…')

    timerTick = window.setInterval(() => {
      if (dibatalkan) return
      const lewatDetikDinding = (performance.now() - tMulaiMs) / 1000
      const detikShow = Math.min(durasiAnimasiPenuh, lewatDetikDinding * lajuCepat)
      gambarPadaDetikShow(detikShow)

      // Paksa pengiriman bingkai bila peramban mendukung CanvasCaptureMediaStreamTrack.requestFrame
      const vt = streamKanvas.getVideoTracks()[0] as unknown as { requestFrame?: () => void }
      if (vt && typeof vt.requestFrame === 'function') {
        try {
          vt.requestFrame()
        } catch {
          // abaikan
        }
      }

      const persen = Math.min(99, Math.max(2, Math.round((lewatDetikDinding / durasiDindingDetik) * 100)))
      opsi.onProgres?.(
        persen,
        `Merekam ${persen}% (${Math.min(durasiDindingDetik, lewatDetikDinding).toFixed(1)} / ${durasiDindingDetik.toFixed(1)} dtk)…`,
      )

      if (lewatDetikDinding >= durasiDindingDetik) {
        window.clearInterval(timerTick)
        if (recorder.state !== 'inactive') recorder.stop()
      }
    }, Math.round(1000 / fps))
  })
}
