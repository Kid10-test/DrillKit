/**
 * #13b — Pengurai notasi MusicXML & penyintesis bunyi panduan WebAudio.
 *
 * Bagian pengurai & penjadwal waktu (`uraiJadwalNadaMusicXml`, `jadwalkanDetikNada`,
 * `cariPosisiBiramaDariDetik`) **100% murni** tanpa ketergantungan DOM/WebAudio
 * sehingga dapat diuji langsung di Node lewat `qa/bangun-logika.sh`.
 *
 * Kelas `PemutarNadaPartitur` di bagian bawah membunyikan jadwal tersebut
 * menggunakan osilator WebAudio terukur (tanpa berkas sampel MP3/SoundFont
 * ber-MB):
 * - instrumen bernada dimainkan pada **tinggi nada konser** sebenarnya
 *   (menghormati `<transpose><chromatic>` seperti Trumpet Bb `-2`, Horn F `-7`,
 *   Alto Sax Eb `-9`), lengkap dengan penyambungan `<tie>` lintas birama;
 * - instrumen perkusi tak bernada (`<unpitched>`, mis. Snare, Tenor, Bass Drum)
 *   disintesis dengan amplop ketukan perkusif (tinggi/sedang/rendah) sehingga
 *   seksi Battery tetap bisa melatih ritme suaranya secara mandiri;
 * - mengikuti tempo segmen lagu (`Song.segments`), persentase tempo latihan
 *   (`#4`), serta rentang & pengulangan frasa (`#11d`).
 */
import type { TempoSegment } from '../db/types'

export interface NadaMentahPartitur {
  idPart: string
  suara: string
  /** Nomor birama 1-berbasis berdasarkan urutan birama di skor. */
  birama: number
  /** Posisi mulai dari awal birama dalam satuan ketuk not seperempat (quarter-note beats). */
  mulaiPerempat: number
  /** Durasi dalam satuan ketuk not seperempat (sudah menggabungkan `<tie>`). */
  durasiPerempat: number
  /** Jenis bunyi: `'nada'` untuk `<pitch>`, `'perkusi'` untuk `<unpitched>`. */
  jenis: 'nada' | 'perkusi'
  /** Nomor MIDI konser (60 = C4, 69 = A4) bila `jenis === 'nada'`. */
  midiKonser?: number
  /** Warna perkusi berdasarkan letak garis paranada bila `jenis === 'perkusi'`. */
  warnaPerkusi?: 'rendah' | 'sedang' | 'tinggi'
}

export interface InfoBiramaSkor {
  birama: number
  beats: number
  beatType: number
  /** Tempo dalam ketuk seperempat per menit bila tertulis di skor. */
  tempoPerempat?: number
}

export interface JadwalNadaPartitur {
  jumlahBirama: number
  idPartTermuat: string[]
  birama: InfoBiramaSkor[]
  nada: NadaMentahPartitur[]
}

export interface PeristiwaBunyiNada {
  idPart: string
  birama: number
  /** Indeks ketuk di dalam birama (0-berbasis, sesuai sukat birama). */
  ketuk: number
  mulaiDetik: number
  durasiDetik: number
  jenis: 'nada' | 'perkusi'
  frekuensiHz?: number
  midiKonser?: number
  warnaPerkusi?: 'rendah' | 'sedang' | 'tinggi'
}

export interface InfoWaktuBirama {
  birama: number
  beats: number
  beatType: number
  mulaiDetik: number
  durasiDetik: number
}

export interface HasilJadwalDetik {
  peristiwa: PeristiwaBunyiNada[]
  biramaWaktu: InfoWaktuBirama[]
  totalDurasiDetik: number
  dariBirama: number
  sampaiBirama: number
}

const SEMITON_LANGKAH: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
}

const FAKTOR_UNIT_TEMPO: Record<string, number> = {
  whole: 4,
  half: 2,
  quarter: 1,
  eighth: 0.5,
  '16th': 0.25,
}

function bacaTeksTag(blok: string, namaTag: string): string | null {
  const re = new RegExp(`<${namaTag}\\b[^>]*>([\\s\\S]*?)<\\/${namaTag}>`, 'i')
  const m = re.exec(blok)
  return m ? m[1].trim() : null
}

/** Konversi nomor MIDI ke frekuensi Hz dengan acuan A4 (bawaan 440 Hz). */
export function midiKeHz(midi: number, a4Hz = 440): number {
  return a4Hz * Math.pow(2, (midi - 69) / 12)
}

/**
 * Ubah dokumen `<score-timewise>` sederhana menjadi susunan per-part supaya
 * pemindai nada di bawah bekerja seragam pada kedua bentuk MusicXML.
 */
function ekstrakPartDariXml(
  xml: string,
  filterId: Set<string> | null,
): { id: string; biramaBlok: string[] }[] {
  if (/<score-timewise\b/i.test(xml)) {
    const petaPart = new Map<string, string[]>()
    const reMeasure = /<measure\b[^>]*>([\s\S]*?)<\/measure>/gi
    let mm: RegExpExecArray | null
    while ((mm = reMeasure.exec(xml)) !== null) {
      const isiMeasure = mm[1]
      const rePart = /<part\b[^>]*\bid=(["'])(.*?)\1[^>]*>([\s\S]*?)<\/part>/gi
      let mp: RegExpExecArray | null
      while ((mp = rePart.exec(isiMeasure)) !== null) {
        const id = mp[2].trim()
        if (filterId && !filterId.has(id)) continue
        let daftar = petaPart.get(id)
        if (!daftar) {
          daftar = []
          petaPart.set(id, daftar)
        }
        daftar.push(mp[3])
      }
    }
    return [...petaPart.entries()].map(([id, biramaBlok]) => ({ id, biramaBlok }))
  }

  const hasil: { id: string; biramaBlok: string[] }[] = []
  const rePart = /<part\b[^>]*\bid=(["'])(.*?)\1[^>]*>([\s\S]*?)<\/part>/gi
  let mp: RegExpExecArray | null
  while ((mp = rePart.exec(xml)) !== null) {
    const id = mp[2].trim()
    if (filterId && !filterId.has(id)) continue
    const isiPart = mp[3]
    const biramaBlok: string[] = []
    const reMeasure = /<measure\b[^>]*>([\s\S]*?)<\/measure>/gi
    let mm: RegExpExecArray | null
    while ((mm = reMeasure.exec(isiPart)) !== null) {
      biramaBlok.push(mm[1])
    }
    hasil.push({ id, biramaBlok })
  }
  return hasil
}

/** Ekstrak sukat dan tempo global per indeks birama dari seluruh part di skor. */
function pindaiInfoBiramaGlobal(xml: string): InfoBiramaSkor[] {
  const semuaPart = ekstrakPartDariXml(xml, null)
  const maksBirama = semuaPart.reduce((m, p) => Math.max(m, p.biramaBlok.length), 0)
  const petaSukat = new Map<number, { beats: number; beatType: number }>()
  const petaTempo = new Map<number, number>()

  for (const p of semuaPart) {
    for (let i = 0; i < p.biramaBlok.length; i += 1) {
      const no = i + 1
      const isi = p.biramaBlok[i]
      if (!petaSukat.has(no)) {
        const blokTime = bacaTeksTag(isi, 'time')
        if (blokTime) {
          const b = Number(bacaTeksTag(blokTime, 'beats'))
          const bt = Number(bacaTeksTag(blokTime, 'beat-type'))
          if (Number.isFinite(b) && b > 0 && Number.isFinite(bt) && bt > 0) {
            petaSukat.set(no, { beats: b, beatType: bt })
          }
        }
      }
      if (!petaTempo.has(no)) {
        const mSound = /<sound\b[^>]*\btempo=(["'])([\d.]+)\1/i.exec(isi)
        if (mSound) {
          const t = Number(mSound[2])
          if (Number.isFinite(t) && t > 0) petaTempo.set(no, t)
        } else {
          const blokMet = bacaTeksTag(isi, 'metronome')
          if (blokMet) {
            const pm = Number(bacaTeksTag(blokMet, 'per-minute'))
            if (Number.isFinite(pm) && pm > 0) {
              const unit = (bacaTeksTag(blokMet, 'beat-unit') ?? 'quarter').toLowerCase()
              const titik = /<beat-unit-dot\b/i.test(blokMet) ? 1.5 : 1
              const faktor = (FAKTOR_UNIT_TEMPO[unit] ?? 1) * titik
              petaTempo.set(no, pm * faktor)
            }
          }
        }
      }
    }
  }

  const hasil: InfoBiramaSkor[] = []
  let beatsAktif = 4
  let beatTypeAktif = 4
  let tempoAktif: number | undefined
  for (let no = 1; no <= maksBirama; no += 1) {
    const s = petaSukat.get(no)
    if (s) {
      beatsAktif = s.beats
      beatTypeAktif = s.beatType
    }
    const t = petaTempo.get(no)
    if (t != null) tempoAktif = t
    hasil.push({
      birama: no,
      beats: beatsAktif,
      beatType: beatTypeAktif,
      tempoPerempat: tempoAktif,
    })
  }
  return hasil
}

function tebakWarnaPerkusi(blokUnpitched: string): 'rendah' | 'sedang' | 'tinggi' {
  const step = (bacaTeksTag(blokUnpitched, 'display-step') ?? 'C').toUpperCase()
  const oct = Number(bacaTeksTag(blokUnpitched, 'display-octave') ?? '5')
  const nilai = oct * 7 + ('CDEFGAB'.indexOf(step) >= 0 ? 'CDEFGAB'.indexOf(step) : 0)
  // Di kunci perkusi/G-clef: F4–A4 lazim dipakai Bass Drum (rendah), C5 Snare (sedang), >= G5 Cymbal/Hi-hat (tinggi).
  if (nilai <= 33) return 'rendah'
  if (nilai >= 38) return 'tinggi'
  return 'sedang'
}

/**
 * Urai notasi MusicXML menjadi jadwal nada mentah per birama.
 *
 * @param xml Teks MusicXML.
 * @param idPartAktif Daftar id part yang ingin dibunyikan (`null`/`undefined`/kosong = semua part).
 */
export function uraiJadwalNadaMusicXml(
  xml: string,
  idPartAktif?: string[] | null,
): JadwalNadaPartitur {
  if (!xml || !xml.trim()) {
    return { jumlahBirama: 0, idPartTermuat: [], birama: [], nada: [] }
  }
  const infoBirama = pindaiInfoBiramaGlobal(xml)
  const filterSet =
    idPartAktif && idPartAktif.length > 0 ? new Set(idPartAktif.map((s) => s.trim())) : null
  let daftarPart = ekstrakPartDariXml(xml, filterSet)
  // Jatuh aman: bila filter tidak cocok satu pun part di berkas yang sudah dipangkas, muat semua yang ada.
  if (daftarPart.length === 0 && filterSet) {
    daftarPart = ekstrakPartDariXml(xml, null)
  }

  const semuaNada: NadaMentahPartitur[] = []
  const reTokenBirama =
    /<(attributes|backup|forward|note)\b[^>]*>[\s\S]*?<\/\1>|<note\b[^>]*\/>/gi

  for (const part of daftarPart) {
    let divisions = 1
    let geserSemiton = 0
    // Kunci sambungan `<tie>`: `${suara}:${kunciNada}` → objek NadaMentahPartitur yang masih terbuka.
    const tieTerbuka = new Map<string, NadaMentahPartitur>()

    for (let idx = 0; idx < part.biramaBlok.length; idx += 1) {
      const noBirama = idx + 1
      const isi = part.biramaBlok[idx]
      let kursorDiv = 0
      let mulaiNoteSebelumnyaDiv = 0

      reTokenBirama.lastIndex = 0
      let tok: RegExpExecArray | null
      while ((tok = reTokenBirama.exec(isi)) !== null) {
        const blok = tok[0]
        const jenisTag = (tok[1] ?? 'note').toLowerCase()

        if (jenisTag === 'attributes') {
          const divTeks = bacaTeksTag(blok, 'divisions')
          if (divTeks != null) {
            const d = Number(divTeks)
            if (Number.isFinite(d) && d > 0) divisions = d
          }
          const blokTrans = bacaTeksTag(blok, 'transpose')
          if (blokTrans != null) {
            const chr = Number(bacaTeksTag(blokTrans, 'chromatic') ?? '0')
            const oct = Number(bacaTeksTag(blokTrans, 'octave-change') ?? '0')
            geserSemiton =
              (Number.isFinite(chr) ? chr : 0) + (Number.isFinite(oct) ? oct * 12 : 0)
          }
          continue
        }

        if (jenisTag === 'backup') {
          const dur = Number(bacaTeksTag(blok, 'duration') ?? '0')
          if (Number.isFinite(dur) && dur > 0) kursorDiv = Math.max(0, kursorDiv - dur)
          continue
        }

        if (jenisTag === 'forward') {
          const dur = Number(bacaTeksTag(blok, 'duration') ?? '0')
          if (Number.isFinite(dur) && dur > 0) kursorDiv += dur
          continue
        }

        // `<note ...>`
        if (/<grace\b/i.test(blok)) continue
        const durDiv = Number(bacaTeksTag(blok, 'duration') ?? '0')
        if (!Number.isFinite(durDiv) || durDiv <= 0) continue

        const adalahChord = /<chord\b/i.test(blok)
        const mulaiDiv = adalahChord ? mulaiNoteSebelumnyaDiv : kursorDiv
        if (!adalahChord) {
          mulaiNoteSebelumnyaDiv = mulaiDiv
          kursorDiv += durDiv
        }

        if (/<rest\b/i.test(blok)) continue

        const suara = bacaTeksTag(blok, 'voice') ?? '1'
        const durasiPerempat = durDiv / divisions
        const mulaiPerempat = mulaiDiv / divisions

        const adaTieStop = /<tie\b[^>]*\btype=(["'])stop\1/i.test(blok)
        const adaTieStart = /<tie\b[^>]*\btype=(["'])start\1/i.test(blok)

        const blokPitch = bacaTeksTag(blok, 'pitch')
        const blokUnpitched = bacaTeksTag(blok, 'unpitched')

        if (blokPitch != null) {
          const step = (bacaTeksTag(blokPitch, 'step') ?? 'C').toUpperCase()
          const alter = Number(bacaTeksTag(blokPitch, 'alter') ?? '0')
          const octave = Number(bacaTeksTag(blokPitch, 'octave') ?? '4')
          const dasar = SEMITON_LANGKAH[step]
          if (dasar == null || !Number.isFinite(octave)) continue
          const midiTertulis = (octave + 1) * 12 + dasar + (Number.isFinite(alter) ? alter : 0)
          const midiKonser = Math.max(12, Math.min(116, midiTertulis + geserSemiton))
          const kunciTie = `${suara}:m${midiKonser}`

          if (adaTieStop && tieTerbuka.has(kunciTie)) {
            const sebelumnya = tieTerbuka.get(kunciTie)!
            sebelumnya.durasiPerempat += durasiPerempat
            if (!adaTieStart) tieTerbuka.delete(kunciTie)
            continue
          }

          const item: NadaMentahPartitur = {
            idPart: part.id,
            suara,
            birama: noBirama,
            mulaiPerempat,
            durasiPerempat,
            jenis: 'nada',
            midiKonser,
          }
          semuaNada.push(item)
          if (adaTieStart) tieTerbuka.set(kunciTie, item)
        } else if (blokUnpitched != null) {
          const warna = tebakWarnaPerkusi(blokUnpitched)
          const kunciTie = `${suara}:p-${warna}`
          if (adaTieStop && tieTerbuka.has(kunciTie)) {
            const sebelumnya = tieTerbuka.get(kunciTie)!
            sebelumnya.durasiPerempat += durasiPerempat
            if (!adaTieStart) tieTerbuka.delete(kunciTie)
            continue
          }
          const item: NadaMentahPartitur = {
            idPart: part.id,
            suara,
            birama: noBirama,
            mulaiPerempat,
            durasiPerempat,
            jenis: 'perkusi',
            warnaPerkusi: warna,
          }
          semuaNada.push(item)
          if (adaTieStart) tieTerbuka.set(kunciTie, item)
        }
      }
    }
  }

  return {
    jumlahBirama: infoBirama.length,
    idPartTermuat: daftarPart.map((p) => p.id),
    birama: infoBirama,
    nada: semuaNada,
  }
}

export interface OpsiJadwalDetik {
  tempoMap?: TempoSegment[]
  tempoDasar?: number
  /** Persentase tempo latihan (#4), mis. 80 = 80% kecepatan asli. Bawaan 100. */
  persenTempo?: number
  dariBirama?: number
  sampaiBirama?: number
  a4Hz?: number
}

/** Petakan nomor birama 1-berbasis ke segmen tempo lagu bila `Song.tempoMap` tersedia. */
function petakanSegmenPerBirama(
  tempoMap: TempoSegment[] | undefined,
  sampaiBirama: number,
): Map<number, { bpm: number; beats: number; beatType: number }> {
  const peta = new Map<number, { bpm: number; beats: number; beatType: number }>()
  if (!tempoMap || tempoMap.length === 0) return peta
  const urut = [...tempoMap].sort((a, b) => (a.measure || 1) - (b.measure || 1))
  let idxSeg = 0
  for (let no = 1; no <= sampaiBirama; no += 1) {
    while (idxSeg + 1 < urut.length && (urut[idxSeg + 1].measure || 1) <= no) {
      idxSeg += 1
    }
    const seg = urut[idxSeg]
    if (!seg || (seg.measure || 1) > no) continue
    const beats = Math.max(1, seg.birama?.pembilang ?? seg.beats ?? 4)
    const beatType = Math.max(1, seg.birama?.penyebut ?? 4)
    const bpm = Math.max(20, seg.bpm || 120)
    peta.set(no, { bpm, beats, beatType })
  }
  return peta
}

/**
 * Konversi jadwal nada MusicXML menjadi peristiwa berwaktu detik absolut mulai `0`
 * pada `dariBirama`, lengkap dengan peta waktu tiap birama untuk sorotan berjalan.
 */
export function jadwalkanDetikNada(
  jadwal: JadwalNadaPartitur,
  opsi: OpsiJadwalDetik = {},
): HasilJadwalDetik {
  const totalBirama = Math.max(jadwal.jumlahBirama, 1)
  const dari = Math.max(1, Math.min(totalBirama, Math.floor(opsi.dariBirama ?? 1)))
  const sampai = Math.max(dari, Math.min(totalBirama, Math.floor(opsi.sampaiBirama ?? totalBirama)))
  const skalaTempo = Math.max(0.25, Math.min(2, (opsi.persenTempo ?? 100) / 100))
  const a4 = opsi.a4Hz && opsi.a4Hz > 0 ? opsi.a4Hz : 440
  const petaSeg = petakanSegmenPerBirama(opsi.tempoMap, sampai)
  const tempoCadangan = opsi.tempoDasar && opsi.tempoDasar > 0 ? opsi.tempoDasar : 120

  const biramaWaktu: InfoWaktuBirama[] = []
  const indeksBirama = new Map<
    number,
    InfoWaktuBirama & { detikPerPerempat: number }
  >()

  let waktuBerjalan = 0
  for (let no = dari; no <= sampai; no += 1) {
    const infoSkor = jadwal.birama[no - 1]
    const seg = petaSeg.get(no)
    const beats = seg?.beats ?? infoSkor?.beats ?? 4
    const beatType = seg?.beatType ?? infoSkor?.beatType ?? 4
    // Pada `TempoSegment` DrillKit, `seg.bpm` adalah jumlah ketuk sukat per menit;
    // pada MusicXML `<sound tempo>`, nilainya adalah ketuk not seperempat per menit.
    let detikPerPerempat: number
    if (seg) {
      const detikPerKetukSukat = 60 / (seg.bpm * skalaTempo)
      detikPerPerempat = detikPerKetukSukat * (beatType / 4)
    } else {
      const bpmPerempat = (infoSkor?.tempoPerempat ?? tempoCadangan) * skalaTempo
      detikPerPerempat = 60 / Math.max(15, bpmPerempat)
    }
    const perempatDalamBirama = beats * (4 / beatType)
    const durasiBirama = perempatDalamBirama * detikPerPerempat
    const baris: InfoWaktuBirama = {
      birama: no,
      beats,
      beatType,
      mulaiDetik: waktuBerjalan,
      durasiDetik: durasiBirama,
    }
    biramaWaktu.push(baris)
    indeksBirama.set(no, { ...baris, detikPerPerempat })
    waktuBerjalan += durasiBirama
  }

  const peristiwa: PeristiwaBunyiNada[] = []
  for (const n of jadwal.nada) {
    if (n.birama < dari || n.birama > sampai) continue
    const bw = indeksBirama.get(n.birama)
    if (!bw) continue
    const mulaiDetik = bw.mulaiDetik + n.mulaiPerempat * bw.detikPerPerempat
    const durasiDetik = Math.max(0.04, n.durasiPerempat * bw.detikPerPerempat)
    const rasioKetuk = n.mulaiPerempat / (4 / bw.beatType)
    const ketuk = Math.max(0, Math.min(bw.beats - 1, Math.floor(rasioKetuk + 1e-6)))
    peristiwa.push({
      idPart: n.idPart,
      birama: n.birama,
      ketuk,
      mulaiDetik,
      durasiDetik,
      jenis: n.jenis,
      frekuensiHz: n.midiKonser != null ? midiKeHz(n.midiKonser, a4) : undefined,
      midiKonser: n.midiKonser,
      warnaPerkusi: n.warnaPerkusi,
    })
  }

  peristiwa.sort((a, b) => a.mulaiDetik - b.mulaiDetik)

  return {
    peristiwa,
    biramaWaktu,
    totalDurasiDetik: waktuBerjalan,
    dariBirama: dari,
    sampaiBirama: sampai,
  }
}

/** Cari birama & ketuk aktif (0-berbasis) pada detik berjalan `detik`. */
export function cariPosisiBiramaDariDetik(
  biramaWaktu: InfoWaktuBirama[],
  detik: number,
): { birama: number; ketuk: number } {
  if (biramaWaktu.length === 0) return { birama: 1, ketuk: 0 }
  const d = Math.max(0, detik)
  for (let i = 0; i < biramaWaktu.length; i += 1) {
    const b = biramaWaktu[i]
    if (d < b.mulaiDetik + b.durasiDetik || i === biramaWaktu.length - 1) {
      const lokal = Math.max(0, d - b.mulaiDetik)
      const detikPerKetuk = b.durasiDetik / Math.max(1, b.beats)
      const ketuk = Math.max(0, Math.min(b.beats - 1, Math.floor(lokal / detikPerKetuk)))
      return { birama: b.birama, ketuk }
    }
  }
  const akhir = biramaWaktu[biramaWaktu.length - 1]
  return { birama: akhir.birama, ketuk: 0 }
}

/* ========================================================================== */
/*  Penyintesis WebAudio — hanya menyentuh AudioContext saat `mulai()`        */
/* ========================================================================== */

export interface OpsiMainkanNadaPartitur {
  hasilJadwal: HasilJadwalDetik
  ulang?: boolean
  volume?: number
  onPosisi?: (birama: number, ketuk: number) => void
  onSelesai?: () => void
}

export class PemutarNadaPartitur {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private timerJadwal: ReturnType<typeof setInterval> | null = null
  private timerPosisi: ReturnType<typeof setInterval> | null = null
  private bufferDerau: AudioBuffer | null = null
  private sedang = false

  get aktif(): boolean {
    return this.sedang
  }

  async mulai(opsi: OpsiMainkanNadaPartitur): Promise<boolean> {
    this.henti()
    const { hasilJadwal } = opsi
    if (hasilJadwal.totalDurasiDetik <= 0 || hasilJadwal.biramaWaktu.length === 0) {
      return false
    }
    const Ctor =
      typeof window !== 'undefined'
        ? window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        : undefined
    if (!Ctor) return false

    const ctx = new Ctor()
    this.ctx = ctx
    if (ctx.state === 'suspended') {
      await ctx.resume().catch(() => undefined)
    }

    const master = ctx.createGain()
    master.gain.value = Math.max(0.05, Math.min(1, opsi.volume ?? 0.45))
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 2800
    master.connect(filter)
    filter.connect(ctx.destination)
    this.master = master
    this.bufferDerau = this.buatBufferDerau(ctx)
    this.sedang = true

    const JENDELA_JADWAL = 0.2
    let awalPutaranCtx = ctx.currentTime + 0.05
    let indeksBerikut = 0
    const { peristiwa, biramaWaktu, totalDurasiDetik } = hasilJadwal

    const jadwalkanMaju = () => {
      if (!this.sedang || !this.ctx || !this.master) return
      const sekarang = this.ctx.currentTime
      const batas = sekarang + JENDELA_JADWAL

      while (indeksBerikut < peristiwa.length) {
        const p = peristiwa[indeksBerikut]
        const waktuAudio = awalPutaranCtx + p.mulaiDetik
        if (waktuAudio > batas) break
        if (waktuAudio + p.durasiDetik >= sekarang - 0.02) {
          this.bunyikanSatu(this.ctx, this.master, p, Math.max(sekarang, waktuAudio))
        }
        indeksBerikut += 1
      }

      if (sekarang >= awalPutaranCtx + totalDurasiDetik) {
        if (opsi.ulang) {
          awalPutaranCtx += totalDurasiDetik
          indeksBerikut = 0
        } else {
          const selesaiCb = opsi.onSelesai
          this.henti()
          selesaiCb?.()
        }
      }
    }

    jadwalkanMaju()
    this.timerJadwal = setInterval(jadwalkanMaju, 60)

    if (opsi.onPosisi) {
      opsi.onPosisi(hasilJadwal.dariBirama, 0)
      this.timerPosisi = setInterval(() => {
        if (!this.sedang || !this.ctx) return
        const berlalu = Math.max(0, this.ctx.currentTime - awalPutaranCtx)
        const pos = cariPosisiBiramaDariDetik(biramaWaktu, berlalu % Math.max(0.01, totalDurasiDetik))
        opsi.onPosisi?.(pos.birama, pos.ketuk)
      }, 45)
    }

    return true
  }

  private buatBufferDerau(ctx: AudioContext): AudioBuffer {
    const panjang = Math.max(1, Math.floor(ctx.sampleRate * 0.08))
    const buf = ctx.createBuffer(1, panjang, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < panjang; i += 1) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (panjang * 0.3))
    }
    return buf
  }

  private bunyikanSatu(
    ctx: AudioContext,
    tujuan: AudioNode,
    p: PeristiwaBunyiNada,
    mulai: number,
  ) {
    if (p.jenis === 'perkusi') {
      const warna = p.warnaPerkusi ?? 'sedang'
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.type = 'triangle'
      const hzAwal = warna === 'rendah' ? 115 : warna === 'tinggi' ? 620 : 240
      const hzAkhir = warna === 'rendah' ? 52 : warna === 'tinggi' ? 320 : 110
      const dur = warna === 'rendah' ? 0.11 : 0.065
      osc.frequency.setValueAtTime(hzAwal, mulai)
      osc.frequency.exponentialRampToValueAtTime(hzAkhir, mulai + dur)
      g.gain.setValueAtTime(0.0001, mulai)
      g.gain.linearRampToValueAtTime(0.45, mulai + 0.004)
      g.gain.exponentialRampToValueAtTime(0.0001, mulai + dur)
      osc.connect(g)
      g.connect(tujuan)
      osc.start(mulai)
      osc.stop(mulai + dur + 0.01)

      if (warna !== 'rendah' && this.bufferDerau) {
        const src = ctx.createBufferSource()
        src.buffer = this.bufferDerau
        const hp = ctx.createBiquadFilter()
        hp.type = 'highpass'
        hp.frequency.value = warna === 'tinggi' ? 3500 : 1200
        const gn = ctx.createGain()
        gn.gain.setValueAtTime(warna === 'tinggi' ? 0.28 : 0.22, mulai)
        gn.gain.exponentialRampToValueAtTime(0.0001, mulai + 0.06)
        src.connect(hp)
        hp.connect(gn)
        gn.connect(tujuan)
        src.start(mulai)
      }
      return
    }

    const hz = p.frekuensiHz ?? 440
    const durasi = Math.max(0.045, p.durasiDetik * 0.94)
    const serang = Math.min(0.014, durasi * 0.25)
    const lepas = Math.min(0.045, durasi * 0.3)

    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(hz, mulai)

    g.gain.setValueAtTime(0.0001, mulai)
    g.gain.linearRampToValueAtTime(0.32, mulai + serang)
    g.gain.setValueAtTime(0.26, Math.max(mulai + serang, mulai + durasi - lepas))
    g.gain.exponentialRampToValueAtTime(0.0001, mulai + durasi)

    osc.connect(g)
    g.connect(tujuan)
    osc.start(mulai)
    osc.stop(mulai + durasi + 0.015)
  }

  henti(): void {
    this.sedang = false
    if (this.timerJadwal) {
      clearInterval(this.timerJadwal)
      this.timerJadwal = null
    }
    if (this.timerPosisi) {
      clearInterval(this.timerPosisi)
      this.timerPosisi = null
    }
    const ctx = this.ctx
    this.ctx = null
    this.master = null
    this.bufferDerau = null
    if (ctx) {
      void ctx.close().catch(() => undefined)
    }
  }
}
