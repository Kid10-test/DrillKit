/**
 * #28 — Pengenal alat Battery (*Snare, Tenor 1–5, Spock, Bass 1–5, Simbal*)
 * dari MusicXML, dipakai bersama oleh:
 *
 * - `perkusiSticking.ts` (lapisan sticking & revisi lapangan), dan
 * - `partiturBunyi.ts` (sintesis suara perkusi terpilah).
 *
 * Murni (tanpa DOM/Dexie) dan kecil, supaya ikut dirakit `qa/bangun-logika.sh`.
 *
 * Aturan pengenalan ditulis sendiri (*clean-room*) dari konvensi penamaan yang
 * lazim di partitur marching: nama part (*"Snare Drum"*, *"Tenor Drums"*,
 * *"Bass Drums"*, *"Cymbals"*) dan nama instrumen per not di
 * `<score-instrument>` (*"Drum 3"*, *"Drum 2 Rim"*, *"Spock 1"*, *"Rim Shot"*,
 * *"Unison"*). Bila nama tidak membantu, letak not di paranada dipakai:
 * makin tinggi letaknya, makin kecil nomornya (Bass 1 = drum terkecil/tertinggi).
 */

export type PeranPartPerkusi = 'snare' | 'tenor' | 'bass' | 'simbal' | 'pit' | 'perkusi'

export type AlatPerkusi =
  | 'snare'
  | 'tenor1'
  | 'tenor2'
  | 'tenor3'
  | 'tenor4'
  | 'tenor5'
  | 'spock'
  | 'bass1'
  | 'bass2'
  | 'bass3'
  | 'bass4'
  | 'bass5'
  | 'bass-unison'
  | 'simbal'
  | 'perkusi-rendah'
  | 'perkusi-sedang'
  | 'perkusi-tinggi'

/** Teknik pukulan khusus yang dibaca dari nama instrumen / kepala not. */
export type TeknikPerkusi = 'rimshot' | 'rim' | 'ping' | 'stick' | 'shell' | 'buzz' | 'mute'

const URUTAN_LANGKAH = 'CDEFGAB'

/** Nilai letak not di paranada (oktaf × 7 + langkah) — makin besar makin tinggi. */
export function nilaiLetak(step: string | null | undefined, octave: number | null | undefined): number {
  const s = (step ?? 'C').trim().toUpperCase()
  const idx = URUTAN_LANGKAH.indexOf(s)
  const o = Number.isFinite(octave as number) ? (octave as number) : 5
  return o * 7 + (idx >= 0 ? idx : 0)
}

/**
 * Peran part dari namanya. `adaUnpitched` = part memuat `<unpitched>`; nama
 * "Bass" saja (mis. *Bass Clarinet*) tidak dianggap Bass Drum kecuali part-nya
 * memang perkusi tak bernada.
 */
export function peranDariNamaPart(nama: string, adaUnpitched: boolean): PeranPartPerkusi | null {
  const n = ` ${nama.toLowerCase()} `
  if (/marimba|vibra|xylo|glock|crotal|chime|timpan|mallet|\bpit\b|front ensemble|bells?\b/.test(n)) return 'pit'
  if (!adaUnpitched) return null
  if (/snare|\bsd\b|caisse|tarol|senar/.test(n)) return 'snare'
  if (/tenor|quad|quint|\bsix\b|trio|\btoms?\b|\btms?\b/.test(n)) return 'tenor'
  if (/bass|\bbd\b|\bbds\b|bas drum|bedug|tambur bas/.test(n)) return 'bass'
  if (/cymbal|\bcym|crash|simbal|clash|piatti/.test(n)) return 'simbal'
  return 'perkusi'
}

/** Teknik dari nama instrumen MusicXML (`<instrument-name>`). */
export function teknikDariNamaInstrumen(nama: string | null | undefined): TeknikPerkusi | undefined {
  if (!nama) return undefined
  const n = nama.toLowerCase()
  if (/rim\s*-?\s*shot/.test(n)) return 'rimshot'
  if (/cross\s*-?\s*stick|side\s*-?\s*stick|rim\s*click/.test(n)) return 'rim'
  if (/stick\s*(click|shot)|back\s*-?\s*stick/.test(n)) return 'stick'
  if (/\bping\b/.test(n)) return 'ping'
  if (/\bshell\b/.test(n)) return 'shell'
  if (/\bbuzz\b|\bpress\b/.test(n)) return 'buzz'
  if (/\bmute|choke|dampen/.test(n)) return 'mute'
  if (/\brim\b/.test(n)) return 'rim'
  return undefined
}

/** Teknik dari `<notehead>` bila nama instrumen tidak menyebutnya. */
export function teknikDariKepalaNot(kepala: string | null | undefined): TeknikPerkusi | undefined {
  if (!kepala) return undefined
  const k = kepala.trim().toLowerCase()
  if (k === 'circle-x' || k === 'circled') return 'rimshot'
  if (k === 'x' || k === 'cross') return 'rim'
  if (k === 'diamond') return 'ping'
  return undefined
}

function nomorDariNama(nama: string): number | null {
  const m = /(?:drum|bass|tenor|\bbd|\bb|\bt)\s*-?\s*([1-6])\b/i.exec(nama)
  if (!m) return null
  const v = Number(m[1])
  return Number.isFinite(v) ? v : null
}

export interface MasukanKlasifikasiPerkusi {
  peran: PeranPartPerkusi
  namaInstrumen?: string | null
  /** `nilaiLetak(display-step, display-octave)` not ini. */
  letak: number
  /** Semua letak berbeda yang dipakai part ini, urut **menurun** (tertinggi dulu). */
  letakPart: number[]
  kepala?: string | null
}

export interface HasilKlasifikasiPerkusi {
  alat: AlatPerkusi
  teknik?: TeknikPerkusi
}

function warnaDariLetak(letak: number): AlatPerkusi {
  // Paranada perkusi / kunci G: F4–A4 lazim Bass Drum, C5 Snare, >= G5 simbal/hi-hat.
  if (letak <= 33) return 'perkusi-rendah'
  if (letak >= 38) return 'perkusi-tinggi'
  return 'perkusi-sedang'
}

/** Tentukan alat & teknik untuk satu not perkusi. */
export function klasifikasiNotPerkusi(m: MasukanKlasifikasiPerkusi): HasilKlasifikasiPerkusi {
  const nama = (m.namaInstrumen ?? '').trim()
  const n = nama.toLowerCase()
  const teknik = teknikDariNamaInstrumen(nama) ?? teknikDariKepalaNot(m.kepala)
  const peringkat = Math.max(0, m.letakPart.indexOf(m.letak)) + 1

  switch (m.peran) {
    case 'snare':
      return { alat: 'snare', teknik }
    case 'simbal':
      return { alat: 'simbal', teknik }
    case 'tenor': {
      if (/spock|shot\s*drum|gock|spock/.test(n)) return { alat: 'spock', teknik }
      const no = nomorDariNama(nama) ?? peringkat
      return { alat: `tenor${Math.min(5, Math.max(1, no))}` as AlatPerkusi, teknik }
    }
    case 'bass': {
      if (/unison|unis\b/.test(n) || (!nama && (m.kepala ?? '').toLowerCase() === 'slash')) {
        return { alat: 'bass-unison', teknik }
      }
      const no = nomorDariNama(nama) ?? peringkat
      return { alat: `bass${Math.min(5, Math.max(1, no))}` as AlatPerkusi, teknik }
    }
    default: {
      if (/snare/.test(n)) return { alat: 'snare', teknik }
      if (/cymbal|hi-?hat|ride|crash|splash|china/.test(n)) return { alat: 'simbal', teknik }
      if (/bass\s*drum|kick/.test(n)) return { alat: 'perkusi-rendah', teknik }
      if (/tom/.test(n)) return { alat: 'perkusi-sedang', teknik }
      return { alat: warnaDariLetak(m.letak), teknik }
    }
  }
}

/** Label pendek ramah pelatih, mis. `"Bass 2"`, `"Tenor 3"`, `"Spock"`. */
export function labelAlatPerkusi(alat: AlatPerkusi): string {
  if (alat === 'snare') return 'Snare'
  if (alat === 'spock') return 'Spock'
  if (alat === 'simbal') return 'Simbal'
  if (alat === 'bass-unison') return 'Unison'
  if (alat.startsWith('tenor')) return `Tenor ${alat.slice(5)}`
  if (alat.startsWith('bass')) return `Bass ${alat.slice(4)}`
  if (alat === 'perkusi-rendah') return 'Perkusi rendah'
  if (alat === 'perkusi-tinggi') return 'Perkusi tinggi'
  return 'Perkusi'
}

/** Singkatan 1–2 huruf untuk sel sempit (mis. `"B2"`, `"T3"`, `"Sp"`). */
export function singkatanAlatPerkusi(alat: AlatPerkusi): string {
  if (alat === 'snare') return 'SD'
  if (alat === 'spock') return 'Sp'
  if (alat === 'simbal') return 'Cy'
  if (alat === 'bass-unison') return 'U'
  if (alat.startsWith('tenor')) return `T${alat.slice(5)}`
  if (alat.startsWith('bass')) return `B${alat.slice(4)}`
  return 'P'
}

export const LABEL_TEKNIK_PERKUSI: Record<TeknikPerkusi, string> = {
  rimshot: 'Rimshot',
  rim: 'Rim / cross-stick',
  ping: 'Ping',
  stick: 'Stick click',
  shell: 'Shell',
  buzz: 'Buzz',
  mute: 'Mute / choke',
}
