/**
 * #6 — Rekaman lagu (MP3, WAV, M4A, OGG).
 *
 * Mengelola rekaman bertempo stabil (render notasi partitur atau rekaman klik),
 * penyelarasan birama 1 ketuk 1, pemeriksaan sidik hash, penyimpanan IndexedDB,
 * dan konversi waktu audio ⇄ birama/ketukan.
 */

import { db } from '../db/db'
import type { AudioRekamanItem, RekamanAudioMeta, TandaBirama } from '../db/types'
import { detikSampai, durasiBirama, meterPada, tempoPada } from './birama'
import type { SegmenWaktu } from './birama'

/* ------------------------------- Hash & Sidik ----------------------------- */

/**
 * Hitung hash biner (SHA-256) dari ArrayBuffer sebagai sidik unik rekaman.
 * Berjalan di browser (WebCrypto) dan Node.js (crypto).
 */
export async function hitungHashAudio(data: ArrayBuffer | Uint8Array): Promise<string> {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)

  // WebCrypto (browser modern & node 15+)
  if (typeof crypto !== 'undefined' && crypto.subtle && typeof crypto.subtle.digest === 'function') {
    try {
      const digest = await crypto.subtle.digest('SHA-256', bytes as unknown as BufferSource)
      const arr = new Uint8Array(digest)
      let hex = ''
      for (let i = 0; i < arr.length; i++) {
        hex += arr[i].toString(16).padStart(2, '0')
      }
      return hex
    } catch {
      // lanjut ke fallback
    }
  }

  // Fallback hash cepat bila SubtleCrypto tidak tersedia (mis. HTTP lama / non-secure context)
  let h1 = 0xdeadbeef ^ bytes.length
  let h2 = 0x41c6ce57 ^ bytes.length
  for (let i = 0; i < bytes.length; i++) {
    h1 = Math.imul(h1 ^ bytes[i], 2654435761)
    h2 = Math.imul(h2 ^ bytes[i], 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  const n1 = (h1 >>> 0).toString(16).padStart(8, '0')
  const n2 = (h2 >>> 0).toString(16).padStart(8, '0')
  return `fb_${n1}${n2}`
}

/**
 * Periksa apakah berkas audio yang diunggah anggota cocok dengan
 * metadata rekaman yang ditentukan pelatih.
 */
export function cekKesesuaianRekaman(
  meta: RekamanAudioMeta,
  uji: { hash?: string; durasi: number },
): { cocok: boolean; alasan?: string } {
  // 1. Jika hash sama persis: pasti identik
  if (uji.hash && meta.hash && uji.hash === meta.hash) {
    return { cocok: true }
  }

  // 2. Jika durasi selisih kurang dari 0.75 detik: dianggap berkas yang sama
  const selisihDurasi = Math.abs(uji.durasi - meta.durasi)
  if (selisihDurasi <= 0.75) {
    return { cocok: true }
  }

  // 3. Durasi berbeda mencolok
  return {
    cocok: false,
    alasan: `Durasi berkas berbeda (${uji.durasi.toFixed(1)} dtk vs ${meta.durasi.toFixed(1)} dtk versi pelatih).`,
  }
}

/* --------------------------- Analisis Gelombang --------------------------- */

/**
 * Ekstrak ringkasan puncak gelombang suara (peaks) dari berkas audio.
 * Menghasilkan 100 nilai normal (0..1) untuk digambar di canvas.
 */
export async function bacaDurasiDanPeaks(
  file: Blob,
): Promise<{ durasi: number; peaks: number[] }> {
  const JUMLAH_PEAK = 120

  // 1. Coba decodeAudioData jika AudioContext tersedia di browser
  const AudioCtx =
    typeof window !== 'undefined'
      ? window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      : null

  if (AudioCtx) {
    try {
      const ctx = new AudioCtx()
      const ab = await file.arrayBuffer()
      const audioBuffer = await ctx.decodeAudioData(ab)
      ctx.close()

      const durasi = audioBuffer.duration
      const channelData = audioBuffer.getChannelData(0)
      const step = Math.floor(channelData.length / JUMLAH_PEAK)
      const peaks: number[] = []

      for (let i = 0; i < JUMLAH_PEAK; i++) {
        let max = 0
        const start = i * step
        const end = Math.min(start + step, channelData.length)
        for (let j = start; j < end; j += 10) {
          const val = Math.abs(channelData[j])
          if (val > max) max = val
        }
        peaks.push(Math.min(1, Number(max.toFixed(3))))
      }

      return { durasi, peaks }
    } catch {
      // decodeAudioData gagal (mis. format tidak didukung browser), coba lewat elemen Audio
    }
  }

  // 2. Fallback via elemen HTMLAudioElement untuk mendapatkan durasi
  const durasiElemen = await new Promise<number>((resolve) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      resolve(0)
      return
    }
    const audio = document.createElement('audio')
    const url = URL.createObjectURL(file)
    audio.src = url
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(url)
      resolve(Number.isFinite(audio.duration) ? audio.duration : 0)
    }
    audio.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(0)
    }
  })

  // Peak buatan bila audio decoding tidak dapat dibaca
  const peaksPalsu = Array.from({ length: JUMLAH_PEAK }, (_, i) => {
    const sin = Math.sin((i / JUMLAH_PEAK) * Math.PI * 4) * 0.4 + 0.5
    return Math.max(0.1, Math.min(1, Number(sin.toFixed(3))))
  })

  return { durasi: durasiElemen, peaks: peaksPalsu }
}

/* --------------------------- Penyimpanan DB ------------------------------- */

/**
 * Simpan rekaman audio biner ke IndexedDB dan buat metadatanya.
 */
export async function simpanRekamanAudio(
  songId: string,
  file: File | Blob,
  namaFile: string,
  durasiKetahui?: number,
): Promise<{ meta: RekamanAudioMeta; item: AudioRekamanItem }> {
  const ab = await file.arrayBuffer()
  const hash = await hitungHashAudio(ab)
  let durasi = durasiKetahui ?? 0
  let peaks: number[] = []

  if (!durasi || durasi <= 0) {
    const info = await bacaDurasiDanPeaks(file)
    durasi = info.durasi
    peaks = info.peaks
  }

  const tipe = file.type || 'audio/mpeg'
  const ukuran = file.size || ab.byteLength

  const item: AudioRekamanItem = {
    id: songId,
    songId,
    blob: file instanceof Blob ? file : new Blob([ab], { type: tipe }),
    namaFile,
    tipe,
    ukuran,
    durasi,
    hash,
    updatedAt: Date.now(),
  }

  await db.rekamanAudio.put(item)

  const meta: RekamanAudioMeta = {
    namaFile,
    tipe,
    ukuran,
    durasi,
    hash,
    titikMulaiDetik: 0,
    volumeAudio: 1.0,
    volumeKlik: 0.8,
    modeBunyi: 'keduanya',
    peaks: peaks.length ? peaks : undefined,
  }

  return { meta, item }
}

/**
 * Muat berkas biner rekaman audio lagu dari IndexedDB.
 */
export async function muatRekamanAudio(songId: string): Promise<AudioRekamanItem | undefined> {
  return db.rekamanAudio.get(songId)
}

/**
 * Hapus rekaman audio dari IndexedDB.
 */
export async function hapusRekamanAudio(songId: string): Promise<void> {
  await db.rekamanAudio.delete(songId)
}

/* --------------------------- Konversi Waktu ------------------------------- */

/**
 * Menghitung posisi detik dalam berkas audio untuk birama tertentu.
 * `detikAudio = titikMulaiDetik + detikSampai(birama) + (koreksiSegmen / 1000)`
 */
export function waktuBiramaKeDetikAudio(
  birama: number,
  meta: RekamanAudioMeta,
  segmen: SegmenWaktu[],
  warisanMeter: TandaBirama,
  bpmDasar: number,
  tempoUntuk?: (b: number) => number,
): number {
  const offsetMulai = meta.titikMulaiDetik || 0
  const detikLagu = detikSampai(segmen, birama, warisanMeter, bpmDasar, tempoUntuk)
  // Periksa koreksi segmen jika ada (bisa berdasarkan key id segmen atau nomor birama)
  let koreksi = 0
  if (meta.koreksiSegmen && segmen.length > 0) {
    for (const s of segmen) {
      const segId = (s as { id?: string }).id || String(s.measure)
      if (s.measure <= birama && meta.koreksiSegmen[segId] !== undefined) {
        koreksi = meta.koreksiSegmen[segId] / 1000
      }
    }
  }
  return Math.max(0, offsetMulai + detikLagu + koreksi)
}

/**
 * Hitung posisi audio untuk birama dan ketukan tertentu.
 */
export function waktuKetukKeDetikAudio(
  birama: number,
  ketuk: number, // 0-based
  detikPerKetuk: number,
  meta: RekamanAudioMeta,
  segmen: SegmenWaktu[],
  warisanMeter: TandaBirama,
  bpmDasar: number,
  tempoUntuk?: (b: number) => number,
): number {
  const detikBar = waktuBiramaKeDetikAudio(birama, meta, segmen, warisanMeter, bpmDasar, tempoUntuk)
  return detikBar + ketuk * detikPerKetuk
}

/**
 * Konversi detik lagu (relatif ke awal lagu) menjadi detik audio di berkas.
 */
export function detikLaguKeDetikAudio(detikLagu: number, meta: RekamanAudioMeta): number {
  return Math.max(0, (meta.titikMulaiDetik || 0) + detikLagu)
}

/**
 * Konversi detik audio di berkas menjadi detik lagu (bisa negatif jika masih di pre-roll/intro).
 */
export function detikAudioKeDetikLagu(detikAudio: number, meta: RekamanAudioMeta): number {
  return detikAudio - (meta.titikMulaiDetik || 0)
}

/**
 * Konversi posisi detik pemutaran audio menjadi nomor birama (1-based).
 */
export function detikAudioKeBirama(
  detikAudio: number,
  meta: RekamanAudioMeta,
  segmen: SegmenWaktu[],
  warisanMeter: TandaBirama,
  bpmDasar: number,
): number {
  const detikLagu = detikAudioKeDetikLagu(detikAudio, meta)
  if (detikLagu <= 0) return 1

  let b = 1
  let akumulasi = 0
  while (akumulasi < detikLagu && b < 1000) {
    const meter = meterPada(segmen, b, warisanMeter)
    const bpm = tempoPada(segmen, b, bpmDasar)
    const dur = durasiBirama(meter, bpm)
    if (akumulasi + dur > detikLagu) break
    akumulasi += dur
    b++
  }
  return b
}

/* ----------------------- Status Penyimpanan & iOS ------------------------- */

export interface InfoPenyimpanan {
  didukung: boolean
  persisten: boolean
  terpakaiMb?: number
  kuotaMb?: number
  isIos: boolean
  pesanIos?: string
}

/**
 * Periksa status kuota IndexedDB dan apakah penyimpanan sudah persisten.
 */
export async function cekPenyimpanan(): Promise<InfoPenyimpanan> {
  const isIos =
    typeof navigator !== 'undefined' &&
    (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))

  const info: InfoPenyimpanan = {
    didukung: typeof navigator !== 'undefined' && !!navigator.storage,
    persisten: false,
    isIos,
    pesanIos: isIos
      ? 'Di iPhone / iPad (Safari), simpan DrillKit ke Layar Utama (PWA) agar rekaman tidak dihapus otomatis setelah 7 hari tidak dibuka.'
      : undefined,
  }

  if (typeof navigator !== 'undefined' && navigator.storage) {
    try {
      if (typeof navigator.storage.persisted === 'function') {
        info.persisten = await navigator.storage.persisted()
      }
      if (typeof navigator.storage.estimate === 'function') {
        const est = await navigator.storage.estimate()
        if (typeof est.usage === 'number') {
          info.terpakaiMb = Number((est.usage / (1024 * 1024)).toFixed(1))
        }
        if (typeof est.quota === 'number') {
          info.kuotaMb = Number((est.quota / (1024 * 1024)).toFixed(1))
        }
      }
    } catch {
      // Abaikan error perizinan storage
    }
  }

  return info
}

/**
 * Minta peramban agar tidak membersihkan cache IndexedDB DrillKit.
 */
export async function mintaPenyimpananPersisten(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.storage && typeof navigator.storage.persist === 'function') {
    try {
      return await navigator.storage.persist()
    } catch {
      return false
    }
  }
  return false
}

/* ------------------------- Pemutar Rekaman Audio ------------------------- */

/**
 * Pemutar audio rekaman tunggal (singleton) untuk menjaga sinkronisasi
 * dengan metronom dan drill presenter.
 */
export class PemutarRekaman {
  private static instance: PemutarRekaman | null = null
  private audio: HTMLAudioElement | null = null
  private songId: string | null = null
  private objectUrl: string | null = null
  public onTimeUpdate?: (currentTime: number) => void
  public onEnded?: () => void

  static get(): PemutarRekaman {
    if (!PemutarRekaman.instance) {
      PemutarRekaman.instance = new PemutarRekaman()
    }
    return PemutarRekaman.instance
  }

  private initAudio(): HTMLAudioElement {
    if (!this.audio) {
      this.audio = document.createElement('audio')
      this.audio.preload = 'auto'
      // Jaga pitch tetap normal saat playbackRate berubah (tempo latihan)
      this.setPitchPreserved(true)

      this.audio.addEventListener('timeupdate', () => {
        if (this.audio && this.onTimeUpdate) {
          this.onTimeUpdate(this.audio.currentTime)
        }
      })
      this.audio.addEventListener('ended', () => {
        if (this.onEnded) this.onEnded()
      })
    }
    return this.audio
  }

  setPitchPreserved(preserve: boolean) {
    if (!this.audio) return
    const a = this.audio as unknown as Record<string, unknown>
    a.preservesPitch = preserve
    a.webkitPreservesPitch = preserve
    a.mozPreservesPitch = preserve
  }

  async muat(songId: string, item?: AudioRekamanItem): Promise<boolean> {
    const audio = this.initAudio()
    if (this.songId === songId && audio.src) {
      return true
    }

    const data = item ?? (await muatRekamanAudio(songId))
    if (!data || !data.blob) {
      this.lepaskan()
      return false
    }

    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl)
    }

    this.objectUrl = URL.createObjectURL(data.blob)
    this.songId = songId
    audio.src = this.objectUrl
    audio.load()
    return true
  }

  putar(detikMulai?: number) {
    if (!this.audio) return
    if (detikMulai !== undefined && Number.isFinite(detikMulai)) {
      this.audio.currentTime = Math.max(0, detikMulai)
    }
    this.audio.play().catch(() => {
      // Browser autoplay policy
    })
  }

  jeda() {
    if (this.audio) {
      this.audio.pause()
    }
  }

  lompat(detik: number) {
    if (this.audio && Number.isFinite(detik)) {
      this.audio.currentTime = Math.max(0, detik)
    }
  }

  setVolume(vol: number) {
    if (this.audio) {
      this.audio.volume = Math.max(0, Math.min(1, vol))
    }
  }

  setKecepatan(rate: number) {
    if (this.audio && Number.isFinite(rate)) {
      this.audio.playbackRate = Math.max(0.25, Math.min(3.0, rate))
    }
  }

  get currentTime(): number {
    return this.audio?.currentTime ?? 0
  }

  get paused(): boolean {
    return this.audio?.paused ?? true
  }

  get duration(): number {
    return this.audio?.duration ?? 0
  }

  lepaskan() {
    if (this.audio) {
      this.audio.pause()
      this.audio.src = ''
    }
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl)
      this.objectUrl = null
    }
    this.songId = null
  }
}
