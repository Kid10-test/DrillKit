/**
 * #11c — Klasifikasi *part* MusicXML, pemetaan ke `SectionDef` tim, dan
 * pemilihan awal cerdas untuk anggota.
 *
 * Modul ini **100% murni** (tanpa DOM, tanpa Dexie, tanpa OSMD, tanpa dependensi
 * baru) supaya dirakit `qa/bangun-logika.sh` ke `/tmp/partiturBagian.mjs` dan
 * seluruh kamus instrumennya diuji langsung di Node (`qa/partitur-bagian-logika.mjs`).
 */
import type { SectionDef } from '../db/types'
import type { BagianPartitur } from './partitur'

/* --------------------------------- Tipe --------------------------------- */

export type KeluargaInstrumen = 'brass' | 'woodwind' | 'percussion' | 'pit' | 'lainnya'

export type FilterPartitur =
  | { jenis: 'semua' }
  | {
      /** Satu kelompok seksi (mis. semua part Brass atau Battery di skor ini). */
      jenis: 'kelompok'
      kelompokId: string
      label: string
      partIds: string[]
    }
  | {
      /** Satu `<score-part>` spesifik (mis. `"P1"` = Trumpet 1). */
      jenis: 'part'
      partId: string
      label: string
    }
  | {
      /** Beberapa part sejenis hasil pencocokan instrumen anggota (mis. Trumpet 1 & 2). */
      jenis: 'instrumen'
      label: string
      partIds: string[]
    }

export interface KelompokPartSkor {
  /** Mengikuti `SectionDef.id` tim bila cocok, atau id keluarga bawaan. */
  id: string
  label: string
  /** Warna titik hex murni untuk chip UI (mis. `#f59e0b`). */
  warnaHex: string
  partIds: string[]
}

export interface ProfilAnggotaPartitur {
  id?: string
  name?: string
  panggilan?: string
  section: string
  instrument: string
}

export interface HasilFilterAwalAnggota {
  filter: FilterPartitur
  /** Penjelasan jujur untuk ditampilkan di lencana UI mode anggota (`null` bila tidak perlu). */
  keterangan: string | null
}

export interface HasilKenaliInstrumen {
  keluarga: KeluargaInstrumen
  /** Slug instrumen kanonik (mis. `'trumpet'`, `'tenor-sax'`, `'tenor-drum'`), `null` bila asing. */
  kanon: string | null
  /** Induk keluarga instrumen generik bila ada (mis. `'alto-sax'` → `'saxophone'`). */
  indukKanon: string | null
  /** Nomor suara bila disebut spesifik (mis. `Trumpet 2` / `Tpt. II` → `2`), `null` bila umum/gabungan. */
  nomorSuara: number | null
}

export interface PenyimpananKunciNilai {
  getItem(kunci: string): string | null
  setItem(kunci: string, nilai: string): void
}

/* ------------------------------- Konstanta ------------------------------ */

export const KUNCI_SIMPAN_FILTER_PARTITUR = 'drillkit_partitur_filter_v1'
const BATAS_LAGU_TERSIMPAN = 50

const META_KELUARGA_BAWAAN: Record<
  KeluargaInstrumen,
  { id: string; label: string; warnaHex: string }
> = {
  brass: { id: 'brass', label: 'Brass', warnaHex: '#f59e0b' },
  woodwind: { id: 'woodwind', label: 'Woodwind', warnaHex: '#38bdf8' },
  percussion: { id: 'percussion', label: 'Battery', warnaHex: '#fb7185' },
  pit: { id: 'pit', label: 'Pit', warnaHex: '#a78bfa' },
  lainnya: { id: 'lainnya', label: 'Part lainnya', warnaHex: '#94a3b8' },
}

interface EntriKamusInstrumen {
  frasa: string
  keluarga: KeluargaInstrumen
  kanon: string
  indukKanon?: string
}

/**
 * Kamus dwibahasa (Inggris + Indonesia + singkatan umum MuseScore/Sibelius/Finale).
 *
 * Diurutkan otomatis dari **frasa terpanjang ke terpendek** saat modul dimuat,
 * sehingga istilah spesifik seperti `"baritone sax"`, `"tenor sax"`, atau
 * `"bass clarinet"` selalu menang sebelum kata pendek `"baritone"`, `"tenor"`,
 * atau `"bass"` diperiksa (keputusan D3).
 */
const DAFTAR_KAMUS_MENTAH: EntriKamusInstrumen[] = [
  // --- Woodwind (frasa majemuk ambigu didahulukan) ---
  { frasa: 'baritone saxophone', keluarga: 'woodwind', kanon: 'bari-sax', indukKanon: 'saxophone' },
  { frasa: 'baritone sax', keluarga: 'woodwind', kanon: 'bari-sax', indukKanon: 'saxophone' },
  { frasa: 'bari saxophone', keluarga: 'woodwind', kanon: 'bari-sax', indukKanon: 'saxophone' },
  { frasa: 'bari sax', keluarga: 'woodwind', kanon: 'bari-sax', indukKanon: 'saxophone' },
  { frasa: 'b sax', keluarga: 'woodwind', kanon: 'bari-sax', indukKanon: 'saxophone' },
  { frasa: 'bsx', keluarga: 'woodwind', kanon: 'bari-sax', indukKanon: 'saxophone' },
  { frasa: 'tenor saxophone', keluarga: 'woodwind', kanon: 'tenor-sax', indukKanon: 'saxophone' },
  { frasa: 'tenor sax', keluarga: 'woodwind', kanon: 'tenor-sax', indukKanon: 'saxophone' },
  { frasa: 't sax', keluarga: 'woodwind', kanon: 'tenor-sax', indukKanon: 'saxophone' },
  { frasa: 'tsx', keluarga: 'woodwind', kanon: 'tenor-sax', indukKanon: 'saxophone' },
  { frasa: 'alto saxophone', keluarga: 'woodwind', kanon: 'alto-sax', indukKanon: 'saxophone' },
  { frasa: 'alto sax', keluarga: 'woodwind', kanon: 'alto-sax', indukKanon: 'saxophone' },
  { frasa: 'a sax', keluarga: 'woodwind', kanon: 'alto-sax', indukKanon: 'saxophone' },
  { frasa: 'asx', keluarga: 'woodwind', kanon: 'alto-sax', indukKanon: 'saxophone' },
  { frasa: 'soprano saxophone', keluarga: 'woodwind', kanon: 'soprano-sax', indukKanon: 'saxophone' },
  { frasa: 'soprano sax', keluarga: 'woodwind', kanon: 'soprano-sax', indukKanon: 'saxophone' },
  { frasa: 's sax', keluarga: 'woodwind', kanon: 'soprano-sax', indukKanon: 'saxophone' },
  { frasa: 'bass clarinet', keluarga: 'woodwind', kanon: 'bass-clarinet', indukKanon: 'clarinet' },
  { frasa: 'klarinet bas', keluarga: 'woodwind', kanon: 'bass-clarinet', indukKanon: 'clarinet' },
  { frasa: 'b cl', keluarga: 'woodwind', kanon: 'bass-clarinet', indukKanon: 'clarinet' },
  { frasa: 'bcl', keluarga: 'woodwind', kanon: 'bass-clarinet', indukKanon: 'clarinet' },
  { frasa: 'piccolo', keluarga: 'woodwind', kanon: 'piccolo', indukKanon: 'flute' },
  { frasa: 'pikolo', keluarga: 'woodwind', kanon: 'piccolo', indukKanon: 'flute' },
  { frasa: 'picc', keluarga: 'woodwind', kanon: 'piccolo', indukKanon: 'flute' },
  { frasa: 'flute', keluarga: 'woodwind', kanon: 'flute' },
  { frasa: 'flutes', keluarga: 'woodwind', kanon: 'flute' },
  { frasa: 'suling', keluarga: 'woodwind', kanon: 'flute' },
  { frasa: 'seruling', keluarga: 'woodwind', kanon: 'flute' },
  { frasa: 'fl', keluarga: 'woodwind', kanon: 'flute' },
  { frasa: 'clarinet', keluarga: 'woodwind', kanon: 'clarinet' },
  { frasa: 'clarinets', keluarga: 'woodwind', kanon: 'clarinet' },
  { frasa: 'klarinet', keluarga: 'woodwind', kanon: 'clarinet' },
  { frasa: 'cl', keluarga: 'woodwind', kanon: 'clarinet' },
  { frasa: 'oboe', keluarga: 'woodwind', kanon: 'oboe' },
  { frasa: 'english horn', keluarga: 'woodwind', kanon: 'oboe' },
  { frasa: 'bassoon', keluarga: 'woodwind', kanon: 'bassoon' },
  { frasa: 'fagot', keluarga: 'woodwind', kanon: 'bassoon' },
  { frasa: 'bsn', keluarga: 'woodwind', kanon: 'bassoon' },
  { frasa: 'saxophone', keluarga: 'woodwind', kanon: 'saxophone' },
  { frasa: 'saxophones', keluarga: 'woodwind', kanon: 'saxophone' },
  { frasa: 'saksofon', keluarga: 'woodwind', kanon: 'saxophone' },
  { frasa: 'sax', keluarga: 'woodwind', kanon: 'saxophone' },
  { frasa: 'recorder', keluarga: 'woodwind', kanon: 'recorder' },
  { frasa: 'rekorder', keluarga: 'woodwind', kanon: 'recorder' },

  // --- Pit / Front Ensemble (frasa bas elektrik & perkusi statis didahulukan) ---
  { frasa: 'electric bass', keluarga: 'pit', kanon: 'electric-bass' },
  { frasa: 'bass guitar', keluarga: 'pit', kanon: 'electric-bass' },
  { frasa: 'acoustic bass', keluarga: 'pit', kanon: 'electric-bass' },
  { frasa: 'synth bass', keluarga: 'pit', kanon: 'electric-bass' },
  { frasa: 'e bass', keluarga: 'pit', kanon: 'electric-bass' },
  { frasa: 'orchestra bells', keluarga: 'pit', kanon: 'glockenspiel' },
  { frasa: 'marching bells', keluarga: 'pit', kanon: 'glockenspiel' },
  { frasa: 'bell lyra', keluarga: 'pit', kanon: 'glockenspiel' },
  { frasa: 'bellyra', keluarga: 'pit', kanon: 'glockenspiel' },
  { frasa: 'belira', keluarga: 'pit', kanon: 'glockenspiel' },
  { frasa: 'glockenspiel', keluarga: 'pit', kanon: 'glockenspiel' },
  { frasa: 'glock', keluarga: 'pit', kanon: 'glockenspiel' },
  { frasa: 'glk', keluarga: 'pit', kanon: 'glockenspiel' },
  { frasa: 'bells', keluarga: 'pit', kanon: 'glockenspiel' },
  { frasa: 'tubular bells', keluarga: 'pit', kanon: 'chimes' },
  { frasa: 'chimes', keluarga: 'pit', kanon: 'chimes' },
  { frasa: 'marimba', keluarga: 'pit', kanon: 'marimba' },
  { frasa: 'marimbas', keluarga: 'pit', kanon: 'marimba' },
  { frasa: 'mba', keluarga: 'pit', kanon: 'marimba' },
  { frasa: 'vibraphone', keluarga: 'pit', kanon: 'vibraphone' },
  { frasa: 'vibraphones', keluarga: 'pit', kanon: 'vibraphone' },
  { frasa: 'vibes', keluarga: 'pit', kanon: 'vibraphone' },
  { frasa: 'vib', keluarga: 'pit', kanon: 'vibraphone' },
  { frasa: 'xylophone', keluarga: 'pit', kanon: 'xylophone' },
  { frasa: 'silofon', keluarga: 'pit', kanon: 'xylophone' },
  { frasa: 'xylo', keluarga: 'pit', kanon: 'xylophone' },
  { frasa: 'xyl', keluarga: 'pit', kanon: 'xylophone' },
  { frasa: 'timpani', keluarga: 'pit', kanon: 'timpani' },
  { frasa: 'kettle drum', keluarga: 'pit', kanon: 'timpani' },
  { frasa: 'timp', keluarga: 'pit', kanon: 'timpani' },
  { frasa: 'synthesizer', keluarga: 'pit', kanon: 'synth' },
  { frasa: 'synth', keluarga: 'pit', kanon: 'synth' },
  { frasa: 'electric piano', keluarga: 'pit', kanon: 'synth' },
  { frasa: 'keyboard', keluarga: 'pit', kanon: 'synth' },
  { frasa: 'piano', keluarga: 'pit', kanon: 'synth' },
  { frasa: 'pianika', keluarga: 'pit', kanon: 'pianika' },
  { frasa: 'melodica', keluarga: 'pit', kanon: 'pianika' },
  { frasa: 'melodika', keluarga: 'pit', kanon: 'pianika' },
  { frasa: 'drum set', keluarga: 'pit', kanon: 'drumset' },
  { frasa: 'drum kit', keluarga: 'pit', kanon: 'drumset' },
  { frasa: 'drumset', keluarga: 'pit', kanon: 'drumset' },
  { frasa: 'auxiliary percussion', keluarga: 'pit', kanon: 'aux-percussion' },
  { frasa: 'aux percussion', keluarga: 'pit', kanon: 'aux-percussion' },
  { frasa: 'front ensemble', keluarga: 'pit', kanon: 'aux-percussion' },
  { frasa: 'concert percussion', keluarga: 'pit', kanon: 'aux-percussion' },
  { frasa: 'tambourine', keluarga: 'pit', kanon: 'aux-percussion' },
  { frasa: 'triangle', keluarga: 'pit', kanon: 'aux-percussion' },
  { frasa: 'timbales', keluarga: 'pit', kanon: 'aux-percussion' },
  { frasa: 'conga', keluarga: 'pit', kanon: 'aux-percussion' },
  { frasa: 'bongo', keluarga: 'pit', kanon: 'aux-percussion' },
  { frasa: 'mallet', keluarga: 'pit', kanon: 'aux-percussion' },
  { frasa: 'rack', keluarga: 'pit', kanon: 'aux-percussion' },
  { frasa: 'pit', keluarga: 'pit', kanon: 'aux-percussion' },

  // --- Brass ---
  { frasa: 'contrabass bugle', keluarga: 'brass', kanon: 'tuba' },
  { frasa: 'contrabass', keluarga: 'brass', kanon: 'tuba' },
  { frasa: 'sousaphone', keluarga: 'brass', kanon: 'tuba' },
  { frasa: 'sousafon', keluarga: 'brass', kanon: 'tuba' },
  { frasa: 'contra', keluarga: 'brass', kanon: 'tuba' },
  { frasa: 'tuba', keluarga: 'brass', kanon: 'tuba' },
  { frasa: 'tubas', keluarga: 'brass', kanon: 'tuba' },
  { frasa: 'french horn', keluarga: 'brass', kanon: 'horn' },
  { frasa: 'f horn', keluarga: 'brass', kanon: 'horn' },
  { frasa: 'mellophone', keluarga: 'brass', kanon: 'mellophone' },
  { frasa: 'mellophones', keluarga: 'brass', kanon: 'mellophone' },
  { frasa: 'melofon', keluarga: 'brass', kanon: 'mellophone' },
  { frasa: 'mello', keluarga: 'brass', kanon: 'mellophone' },
  { frasa: 'horn', keluarga: 'brass', kanon: 'horn' },
  { frasa: 'hn', keluarga: 'brass', kanon: 'horn' },
  { frasa: 'flugelhorn', keluarga: 'brass', kanon: 'flugelhorn', indukKanon: 'trumpet' },
  { frasa: 'flugel', keluarga: 'brass', kanon: 'flugelhorn', indukKanon: 'trumpet' },
  { frasa: 'flgh', keluarga: 'brass', kanon: 'flugelhorn', indukKanon: 'trumpet' },
  { frasa: 'cornet', keluarga: 'brass', kanon: 'cornet', indukKanon: 'trumpet' },
  { frasa: 'kornet', keluarga: 'brass', kanon: 'cornet', indukKanon: 'trumpet' },
  { frasa: 'crnt', keluarga: 'brass', kanon: 'cornet', indukKanon: 'trumpet' },
  { frasa: 'trumpet', keluarga: 'brass', kanon: 'trumpet' },
  { frasa: 'trumpets', keluarga: 'brass', kanon: 'trumpet' },
  { frasa: 'terompet', keluarga: 'brass', kanon: 'trumpet' },
  { frasa: 'tpt', keluarga: 'brass', kanon: 'trumpet' },
  { frasa: 'trp', keluarga: 'brass', kanon: 'trumpet' },
  { frasa: 'bass trombone', keluarga: 'brass', kanon: 'trombone' },
  { frasa: 'trombone', keluarga: 'brass', kanon: 'trombone' },
  { frasa: 'trombones', keluarga: 'brass', kanon: 'trombone' },
  { frasa: 'trombon', keluarga: 'brass', kanon: 'trombone' },
  { frasa: 'tbn', keluarga: 'brass', kanon: 'trombone' },
  { frasa: 'trb', keluarga: 'brass', kanon: 'trombone' },
  { frasa: 'euphonium', keluarga: 'brass', kanon: 'euphonium', indukKanon: 'baritone' },
  { frasa: 'euphoniums', keluarga: 'brass', kanon: 'euphonium', indukKanon: 'baritone' },
  { frasa: 'euph', keluarga: 'brass', kanon: 'euphonium', indukKanon: 'baritone' },
  { frasa: 'baritone', keluarga: 'brass', kanon: 'baritone' },
  { frasa: 'baritones', keluarga: 'brass', kanon: 'baritone' },
  { frasa: 'bariton', keluarga: 'brass', kanon: 'baritone' },
  { frasa: 'bar', keluarga: 'brass', kanon: 'baritone' },

  // --- Battery / Marching Percussion ---
  { frasa: 'marching snare', keluarga: 'percussion', kanon: 'snare' },
  { frasa: 'snare drum', keluarga: 'percussion', kanon: 'snare' },
  { frasa: 'snare drums', keluarga: 'percussion', kanon: 'snare' },
  { frasa: 'snare', keluarga: 'percussion', kanon: 'snare' },
  { frasa: 'senar', keluarga: 'percussion', kanon: 'snare' },
  { frasa: 'sd', keluarga: 'percussion', kanon: 'snare' },
  { frasa: 'sn', keluarga: 'percussion', kanon: 'snare' },
  { frasa: 'tenor drums', keluarga: 'percussion', kanon: 'tenor-drum' },
  { frasa: 'tenor drum', keluarga: 'percussion', kanon: 'tenor-drum' },
  { frasa: 'multi tom', keluarga: 'percussion', kanon: 'tenor-drum' },
  { frasa: 'multitom', keluarga: 'percussion', kanon: 'tenor-drum' },
  { frasa: 'timotom', keluarga: 'percussion', kanon: 'tenor-drum' },
  { frasa: 'tenors', keluarga: 'percussion', kanon: 'tenor-drum' },
  { frasa: 'quads', keluarga: 'percussion', kanon: 'tenor-drum' },
  { frasa: 'quad', keluarga: 'percussion', kanon: 'tenor-drum' },
  { frasa: 'quints', keluarga: 'percussion', kanon: 'tenor-drum' },
  { frasa: 'quint', keluarga: 'percussion', kanon: 'tenor-drum' },
  { frasa: 'tenor', keluarga: 'percussion', kanon: 'tenor-drum' },
  { frasa: 'marching bass', keluarga: 'percussion', kanon: 'bass-drum' },
  { frasa: 'bass drums', keluarga: 'percussion', kanon: 'bass-drum' },
  { frasa: 'bass drum', keluarga: 'percussion', kanon: 'bass-drum' },
  { frasa: 'bd', keluarga: 'percussion', kanon: 'bass-drum' },
  { frasa: 'crash cymbals', keluarga: 'percussion', kanon: 'cymbal' },
  { frasa: 'crash cymbal', keluarga: 'percussion', kanon: 'cymbal' },
  { frasa: 'marching cymbals', keluarga: 'percussion', kanon: 'cymbal' },
  { frasa: 'cymbals', keluarga: 'percussion', kanon: 'cymbal' },
  { frasa: 'cymbal', keluarga: 'percussion', kanon: 'cymbal' },
  { frasa: 'simbal', keluarga: 'percussion', kanon: 'cymbal' },
  { frasa: 'cym', keluarga: 'percussion', kanon: 'cymbal' },
  { frasa: 'battery', keluarga: 'percussion', kanon: 'battery' },
]

const KAMUS_TERURUT: EntriKamusInstrumen[] = [...DAFTAR_KAMUS_MENTAH].sort(
  (a, b) => b.frasa.length - a.frasa.length,
)

/* ------------------------ Normalisasi & Pengurai ------------------------ */

/**
 * Rapikan teks instrumen menjadi spasi tunggal huruf kecil dan buang keterangan
 * transposisi seperti `"in Bb"`, `"in Eb"`, `"in F"` supaya `"Trumpet in Bb 1"`
 * atau `"S.D."` mudah dicocokkan per kata utuh.
 */
export function normalisasiTeksInstrumen(mentah: string): string {
  // Gabungkan singkatan bertitik satu huruf seperti "S.D." -> "sd", "B.D." -> "bd", "B.Cl." -> "b cl".
  const tanpaSingkatanTitik = mentah.replace(
    /\b([a-zA-Z])\.([a-zA-Z])\.(?![a-zA-Z])/g,
    '$1$2',
  )
  return tanpaSingkatanTitik
    .toLowerCase()
    .replace(/\bin\s+(?:b-?flat|e-?flat|bb|eb|f|c|a|g|d)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

const ANGKA_ROMAWI: Record<string, number> = {
  i: 1,
  ii: 2,
  iii: 3,
  iv: 4,
  v: 5,
  vi: 6,
}

const ANGKA_URUT: Record<string, number> = {
  '1st': 1,
  '2nd': 2,
  '3rd': 3,
  '4th': 4,
  '5th': 5,
  '6th': 6,
}

/**
 * Ekstrak nomor suara spesifik (mis. `Trumpet 2`, `2nd Clarinet`, `Trombone III`).
 * Bila teks menyebut rentang gabungan seperti `"Bass Drum 1-5"` atau `"Flute 1/2"`,
 * kembalikan `null` karena paranada tersebut milik beberapa suara sekaligus.
 */
export function bacaNomorSuara(mentah: string): number | null {
  if (/\b\d+\s*[-/&+]\s*\d+\b/.test(mentah)) return null
  if (/\b(?:i|ii|iii|iv)\s*[-/&+]\s*(?:ii|iii|iv|v)\b/i.test(mentah)) return null

  const bersih = mentah
    .toLowerCase()
    .replace(/\bin\s+(?:b-?flat|e-?flat|bb|eb|f|c|a|g|d)\b/g, ' ')
  const token = bersih.split(/[^a-z0-9]+/).filter(Boolean)

  for (let idx = token.length - 1; idx >= 0; idx -= 1) {
    const t = token[idx]
    if (ANGKA_URUT[t] !== undefined) return ANGKA_URUT[t]
    if (ANGKA_ROMAWI[t] !== undefined && token.length >= 2) return ANGKA_ROMAWI[t]
    if (/^[1-9]$/.test(t)) return Number(t)
  }
  return null
}

function mengandungFrasaKataUtuh(teksNormal: string, frasa: string): boolean {
  if (!teksNormal) return false
  const berpagar = ` ${teksNormal} `
  return berpagar.includes(` ${frasa} `)
}

/**
 * Kenali keluarga, slug instrumen kanonik, dan nomor suara dari nama/singkatan
 * `<score-part>` maupun kolom `Member.instrument`.
 */
export function kenaliInstrumen(nama: string, singkatan = ''): HasilKenaliInstrumen {
  const normNama = normalisasiTeksInstrumen(nama)
  const normSingkat = normalisasiTeksInstrumen(singkatan)
  const nomorSuara = bacaNomorSuara(nama) ?? (singkatan ? bacaNomorSuara(singkatan) : null)

  // Periksa nama lengkap lebih dulu (lebih kaya konteks daripada singkatan).
  for (const sumber of [normNama, normSingkat]) {
    if (!sumber) continue
    for (const entri of KAMUS_TERURUT) {
      if (mengandungFrasaKataUtuh(sumber, entri.frasa)) {
        return {
          keluarga: entri.keluarga,
          kanon: entri.kanon,
          indukKanon: entri.indukKanon ?? null,
          nomorSuara,
        }
      }
    }
  }

  return {
    keluarga: 'lainnya',
    kanon: null,
    indukKanon: null,
    nomorSuara,
  }
}

/* --------------------- Pengelompokan ke Section Tim --------------------- */

function tebakKeluargaDariSectionDef(sec: SectionDef): KeluargaInstrumen | null {
  const gabungan = `${sec.id} ${sec.label}`.toLowerCase()
  if (/\b(?:brass|tiup logam|horn\s*line|hornline)\b/.test(gabungan)) return 'brass'
  if (/\b(?:woodwind|tiup kayu)\b/.test(gabungan)) return 'woodwind'
  if (/\b(?:percussion|battery|perkusi)\b/.test(gabungan)) return 'percussion'
  if (/\b(?:pit|front ensemble|mallet)\b/.test(gabungan)) return 'pit'
  return null
}

function cocokkanSectionKustomLangsung(
  part: BagianPartitur,
  daftarSection: SectionDef[],
): SectionDef | null {
  const normPart = `${normalisasiTeksInstrumen(part.nama)} ${normalisasiTeksInstrumen(part.singkatan ?? '')}`.trim()
  if (!normPart) return null

  for (const sec of daftarSection) {
    // Lewati section umum bawaan; mereka ditangani lewat keluarga instrumen.
    if (tebakKeluargaDariSectionDef(sec) !== null) continue
    if (sec.id === 'guard' || sec.id === 'fc' || sec.id === 'other') continue
    const normLabel = normalisasiTeksInstrumen(sec.label)
    const normId = normalisasiTeksInstrumen(sec.id)
    if (normLabel.length >= 3 && mengandungFrasaKataUtuh(normPart, normLabel)) return sec
    if (normId.length >= 3 && mengandungFrasaKataUtuh(normPart, normId)) return sec
  }
  return null
}

/**
 * Kelompokkan `<score-part>` ke kelompok seksi yang siap ditampilkan sebagai
 * chip cepat di `LayarPartitur`.
 *
 * Prinsip anti-hilang (keputusan D3):
 * - Menghormati label & warna hex dari `SectionDef[]` tim (termasuk `{ id: 'percussion', label: 'Battery' }`
 *   maupun seksi kustom seperti `Pianika`).
 * - Walau suatu seksi disembunyikan di pengaturan tim (`hidden: 1`, mis. `woodwind`
 *   pada `DEFAULT_SECTIONS`), bila di dalam partitur MusicXML benar-benar ada
 *   part seksi tersebut, chip kelompoknya **tetap ditampilkan** agar tidak ada
 *   part yang lenyap diam-diam.
 */
export function kelompokkanPartSkor(
  parts: BagianPartitur[],
  sectionsTim: SectionDef[] = [],
): KelompokPartSkor[] {
  const petaSectionPerKeluarga = new Map<KeluargaInstrumen, SectionDef>()
  for (const sec of sectionsTim) {
    const kel = tebakKeluargaDariSectionDef(sec)
    if (kel && !petaSectionPerKeluarga.has(kel)) {
      petaSectionPerKeluarga.set(kel, sec)
    }
  }

  const urutanId: string[] = []
  const wadah = new Map<string, KelompokPartSkor>()

  const masukkan = (id: string, label: string, warnaHex: string, partId: string) => {
    let kel = wadah.get(id)
    if (!kel) {
      kel = {
        id,
        label,
        warnaHex: /^#[0-9a-fA-F]{3,8}$/.test(warnaHex) ? warnaHex : '#94a3b8',
        partIds: [],
      }
      wadah.set(id, kel)
      urutanId.push(id)
    }
    if (!kel.partIds.includes(partId)) {
      kel.partIds.push(partId)
    }
  }

  for (const p of parts) {
    const kustom = cocokkanSectionKustomLangsung(p, sectionsTim)
    if (kustom) {
      masukkan(kustom.id, kustom.label, kustom.dot, p.id)
      continue
    }

    const hasil = kenaliInstrumen(p.nama, p.singkatan)
    const secTim = petaSectionPerKeluarga.get(hasil.keluarga)
    if (secTim) {
      masukkan(secTim.id, secTim.label, secTim.dot, p.id)
    } else {
      const cadangan = META_KELUARGA_BAWAAN[hasil.keluarga]
      masukkan(cadangan.id, cadangan.label, cadangan.warnaHex, p.id)
    }
  }

  return urutanId.map((id) => wadah.get(id)!)
}

/* ------------------- Pilihan Awal Cerdas Mode Anggota ------------------- */

function apakahKanonSepadan(target: HasilKenaliInstrumen, kandidat: HasilKenaliInstrumen): boolean {
  if (!target.kanon || !kandidat.kanon) return false
  if (target.kanon === kandidat.kanon) return true
  if (target.kanon === kandidat.indukKanon) return true
  return false
}

/**
 * Tentukan filter awal saat anggota membuka partitur lagu yang belum pernah ia
 * atur secara manual di perangkat ini.
 *
 * Tidak pernah gagal dan tidak pernah mengembalikan himpunan kosong: bila
 * instrumen maupun seksi anggota tidak punya paranada di berkas ini (mis.
 * anggota *Color Guard* atau *Field Commander*), otomatis kembali ke
 * `Full score` disertai keterangan yang ramah.
 */
export function pilihFilterAwalAnggota(
  parts: BagianPartitur[],
  anggota: ProfilAnggotaPartitur | null | undefined,
  sectionsTim: SectionDef[] = [],
): HasilFilterAwalAnggota {
  if (!anggota || parts.length === 0) {
    return { filter: { jenis: 'semua' }, keterangan: null }
  }

  const teksInstrumen = (anggota.instrument ?? '').trim()
  const infoTarget = teksInstrumen ? kenaliInstrumen(teksInstrumen) : null
  const analisisPart = parts.map((part) => ({
    part,
    info: kenaliInstrumen(part.nama, part.singkatan),
    normNama: normalisasiTeksInstrumen(part.nama),
  }))

  // 1. Coba cocokkan langsung berdasarkan `anggota.instrument`.
  if (teksInstrumen) {
    const normDicari = normalisasiTeksInstrumen(teksInstrumen)
    const cocokKanon = analisisPart.filter(({ info, normNama }) => {
      if (infoTarget?.kanon && apakahKanonSepadan(infoTarget, info)) return true
      // Cadangan pencocokan kata utuh untuk instrumen unik di luar kamus (mis. "Angklung").
      return normDicari.length >= 3 && mengandungFrasaKataUtuh(normNama, normDicari)
    })

    if (cocokKanon.length > 0) {
      // Bila anggota menyebut nomor suara spesifik (mis. "Trumpet 2"), utamakan yang tepat.
      if (infoTarget?.nomorSuara !== null && infoTarget?.nomorSuara !== undefined) {
        const tepatNomor = cocokKanon.filter(
          (k) => k.info.nomorSuara === infoTarget.nomorSuara,
        )
        if (tepatNomor.length === 1) {
          const terpilih = tepatNomor[0].part
          return {
            filter: { jenis: 'part', partId: terpilih.id, label: terpilih.nama },
            keterangan: `Otomatis menampilkan ${terpilih.nama} sesuai profil instrumen kamu.`,
          }
        }
      }

      if (cocokKanon.length === 1) {
        const terpilih = cocokKanon[0].part
        return {
          filter: { jenis: 'part', partId: terpilih.id, label: terpilih.nama },
          keterangan: `Otomatis menampilkan ${terpilih.nama} sesuai profil instrumen kamu.`,
        }
      }

      const daftarId = cocokKanon.map((k) => k.part.id)
      // Bila ternyata seluruh part di skor sama semua (mis. skor kwartet terompet), cukup sebut jelas.
      const labelBersih = teksInstrumen.replace(/\s+/g, ' ')
      return {
        filter: {
          jenis: 'instrumen',
          label: `${labelBersih} (${daftarId.length} part)`,
          partIds: daftarId,
        },
        keterangan: `Otomatis menyaring ${daftarId.length} part ${labelBersih} sesuai profil kamu.`,
      }
    }
  }

  // 2. Cadangan ke kelompok `anggota.section` bila ada di skor.
  const daftarKelompok = kelompokkanPartSkor(parts, sectionsTim)
  const idSeksiAnggota = (anggota.section ?? '').trim()
  const defSeksiAnggota = sectionsTim.find((s) => s.id === idSeksiAnggota)
  const labelSeksiAnggota = defSeksiAnggota?.label || idSeksiAnggota || 'seksi kamu'

  let kelompokCocok = daftarKelompok.find((k) => k.id === idSeksiAnggota)
  if (!kelompokCocok && defSeksiAnggota) {
    const kelDariDef = tebakKeluargaDariSectionDef(defSeksiAnggota)
    if (kelDariDef) {
      kelompokCocok = daftarKelompok.find((k) => k.id === kelDariDef)
    }
  }

  if (kelompokCocok && kelompokCocok.partIds.length > 0) {
    const alasanAwal = teksInstrumen
      ? `Part ${teksInstrumen} tersendiri tidak ditemukan — menampilkan kelompok ${kelompokCocok.label}.`
      : `Otomatis menampilkan kelompok ${kelompokCocok.label} sesuai seksi kamu.`
    return {
      filter: {
        jenis: 'kelompok',
        kelompokId: kelompokCocok.id,
        label: kelompokCocok.label,
        partIds: kelompokCocok.partIds,
      },
      keterangan: alasanAwal,
    }
  }

  // 3. Cadangan aman ke Full score (mis. anggota Color Guard / Drum Major).
  return {
    filter: { jenis: 'semua' },
    keterangan: `Tidak ada part khusus ${labelSeksiAnggota} di partitur ini — menampilkan Full score.`,
  }
}

/* --------------------- Utilitas & Simpanan per Lagu --------------------- */

/**
 * Hasilkan daftar `id` XML part yang harus tampak untuk diberikan ke perender
 * OSMD, atau `null` bila mode `Full score` aktif (maupun bila filter lama tidak
 * lagi cocok dengan daftar part skor terbaru).
 */
export function daftarIdPartAktif(
  filter: FilterPartitur,
  semuaPart: BagianPartitur[],
): string[] | null {
  if (filter.jenis === 'semua') return null
  const himpunanSah = new Set(semuaPart.map((p) => p.id))
  const kandidat =
    filter.jenis === 'part' ? [filter.partId] : filter.partIds
  const tersaring = kandidat.filter((id) => himpunanSah.has(id))
  if (tersaring.length === 0 || tersaring.length === semuaPart.length && filter.jenis === 'kelompok' && semuaPart.length === 1) {
    return tersaring.length === 0 ? null : tersaring
  }
  return tersaring
}

/** Validasi ulang `FilterPartitur` terhadap daftar `BagianPartitur` terkini. */
export function sesuaikanFilterKePartSkor(
  filter: FilterPartitur,
  semuaPart: BagianPartitur[],
): FilterPartitur {
  if (filter.jenis === 'semua' || semuaPart.length === 0) return { jenis: 'semua' }
  const petaPart = new Map(semuaPart.map((p) => [p.id, p]))

  if (filter.jenis === 'part') {
    const p = petaPart.get(filter.partId)
    return p ? { jenis: 'part', partId: p.id, label: p.nama } : { jenis: 'semua' }
  }

  const idSah = filter.partIds.filter((id) => petaPart.has(id))
  if (idSah.length === 0) return { jenis: 'semua' }
  if (filter.jenis === 'kelompok') {
    return { ...filter, partIds: idSah }
  }
  return { ...filter, partIds: idSah }
}

/** Label ringkas manusiawi untuk kepala layar maupun judul cetakan. */
export function labelFilterPartitur(filter: FilterPartitur, totalPart = 0): string {
  if (filter.jenis === 'semua') {
    return totalPart > 0 ? `Full Score (${totalPart} part)` : 'Full Score'
  }
  if (filter.jenis === 'part') return filter.label
  if (filter.jenis === 'kelompok') {
    return `${filter.label} (${filter.partIds.length} part)`
  }
  return filter.label
}

export function samaFilterPartitur(a: FilterPartitur, b: FilterPartitur): boolean {
  if (a.jenis !== b.jenis) return false
  if (a.jenis === 'semua' && b.jenis === 'semua') return true
  if (a.jenis === 'part' && b.jenis === 'part') return a.partId === b.partId
  if (
    (a.jenis === 'kelompok' && b.jenis === 'kelompok') ||
    (a.jenis === 'instrumen' && b.jenis === 'instrumen')
  ) {
    if (a.partIds.length !== b.partIds.length) return false
    return a.partIds.every((id, i) => id === b.partIds[i])
  }
  return false
}

function ambilStorageBawaan(): PenyimpananKunciNilai | null {
  try {
    if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis && globalThis.localStorage) {
      return globalThis.localStorage
    }
  } catch {
    // akses localStorage diblokir — abaikan
  }
  return null
}

interface RekamanSimpananFilter {
  urutan: string[]
  peta: Record<string, FilterPartitur>
}

function bacaRekamanFilter(storage: PenyimpananKunciNilai | null): RekamanSimpananFilter {
  if (!storage) return { urutan: [], peta: {} }
  try {
    const mentah = storage.getItem(KUNCI_SIMPAN_FILTER_PARTITUR)
    if (!mentah) return { urutan: [], peta: {} }
    const urai = JSON.parse(mentah) as Partial<RekamanSimpananFilter>
    if (!urai || typeof urai !== 'object' || !urai.peta || typeof urai.peta !== 'object') {
      return { urutan: [], peta: {} }
    }
    const urutan = Array.isArray(urai.urutan)
      ? urai.urutan.filter((x): x is string => typeof x === 'string')
      : Object.keys(urai.peta)
    return { urutan, peta: { ...urai.peta } }
  } catch {
    return { urutan: [], peta: {} }
  }
}

/** Baca filter tersimpan untuk `songId` (`null` bila belum pernah disimpan manual). */
export function bacaFilterPartiturTersimpan(
  songId: string,
  storage: PenyimpananKunciNilai | null = ambilStorageBawaan(),
): FilterPartitur | null {
  if (!songId) return null
  const rekaman = bacaRekamanFilter(storage)
  const item = rekaman.peta[songId]
  if (!item || typeof item !== 'object' || !('jenis' in item)) return null
  if (item.jenis === 'semua') return { jenis: 'semua' }
  if (item.jenis === 'part' && typeof item.partId === 'string' && typeof item.label === 'string') {
    return { jenis: 'part', partId: item.partId, label: item.label }
  }
  if (
    item.jenis === 'kelompok' &&
    typeof item.kelompokId === 'string' &&
    typeof item.label === 'string' &&
    Array.isArray(item.partIds)
  ) {
    return {
      jenis: 'kelompok',
      kelompokId: item.kelompokId,
      label: item.label,
      partIds: item.partIds.filter((x): x is string => typeof x === 'string'),
    }
  }
  if (
    item.jenis === 'instrumen' &&
    typeof item.label === 'string' &&
    Array.isArray(item.partIds)
  ) {
    return {
      jenis: 'instrumen',
      label: item.label,
      partIds: item.partIds.filter((x): x is string => typeof x === 'string'),
    }
  }
  return null
}

/** Simpan filter pilihan pengguna per lagu (dibatasi 50 lagu terakhir secara FIFO). */
export function simpanFilterPartitur(
  songId: string,
  filter: FilterPartitur,
  storage: PenyimpananKunciNilai | null = ambilStorageBawaan(),
): void {
  if (!songId || !storage) return
  try {
    const rekaman = bacaRekamanFilter(storage)
    const urutanBaru = rekaman.urutan.filter((id) => id !== songId)
    urutanBaru.push(songId)
    const petaBaru: Record<string, FilterPartitur> = {
      ...rekaman.peta,
      [songId]: filter,
    }
    while (urutanBaru.length > BATAS_LAGU_TERSIMPAN) {
      const buang = urutanBaru.shift()
      if (buang) delete petaBaru[buang]
    }
    storage.setItem(
      KUNCI_SIMPAN_FILTER_PARTITUR,
      JSON.stringify({ urutan: urutanBaru, peta: petaBaru }),
    )
  } catch {
    // kuota penuh / diblokir — abaikan
  }
}
