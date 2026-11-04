/**
 * #27 — Jembatan langsung MuseScore: `.mscz` / `.mscx` → MusicXML `<score-partwise>`.
 *
 * **Batas lisensi (*clean-room*).** Modul ini ditulis dari pengamatan format
 * berkas (`META-INF/container.xml` → `*.mscx` berakar `<museScore version>`),
 * bukan dari kode MuseScore (GPL-3.0). Tidak ada baris yang disalin.
 *
 * **Batas fungsi.** DrillKit bukan editor notasi: yang diterjemahkan adalah
 * apa yang perlu dibaca dan diputar di lapangan — daftar part & transposisi
 * instrumen, birama (termasuk birama gantung), tanda kunci/mula/sukat, tempo,
 * huruf latihan, volta & tanda ulang, lompatan D.S./D.C., not & akor, tuplet,
 * ikatan (*tie*), dinamika & *hairpin*, teks staf/sistem, *sticking* (R/L),
 * not hias (*flam*), *tremolo* (*diddle/roll*), serta *drumset* perkusi
 * (*Muse Drumline*) sebagai `<unpitched>` + `<instrument>`. Yang di luar itu
 * (lirik, simbol akor, *slur*, posisi tata letak) dilewati dan disebut di
 * `peringatan` — tidak pernah diam-diam.
 *
 * **Penyimpanan.** Hasilnya disimpan sebagai MusicXML biasa di store
 * `partiturBerkas` (Dexie v16, tanpa store baru): berkas `.mscz` aslinya tidak
 * pernah disimpan, sama seperti `.mxl` di #11b.
 *
 * **Dimuat malas.** Modul ini hanya diimpor (`import('./mscz')`) saat berkas
 * MuseScore benar-benar dibuka; bundel awal tidak bertambah satu bita pun.
 *
 * Galat tidak pernah dilempar keluar: semuanya `{ ok: false, alasan }`.
 */
import { BATAS_BITA, teksPartitur } from './partitur'
import { apakahArsipMuseScore, bukaEntriUtamaArsip } from './mxl'
import {
  anak,
  anakElemen,
  angkaAnak,
  escapeXml,
  teksAnak,
  uraiXmlRingan,
  type ElemenXml,
} from './xmlRingan'

/* --------------------------------- Tipe --------------------------------- */

export interface InfoKonversiMuseScore {
  /** Versi format berkas, mis. `"4.70"` atau `"3.02"`. */
  versi: string
  judul?: string
  jumlahPart: number
  jumlahBirama: number
  /** Hal-hal yang dilewati/didekati — ditampilkan apa adanya ke pelatih. */
  peringatan: string[]
}

export type HasilKonversiMuseScore =
  | ({ ok: true; xml: string } & InfoKonversiMuseScore)
  | { ok: false; alasan: string }

export type HasilUraiMuseScore =
  | ({
      ok: true
      /** Bita MusicXML UTF-8 hasil konversi, siap masuk `putusanPartitur`. */
      bitaXml: Uint8Array
      /** `'mscz'` (arsip) atau `'mscx'` (teks mentah). */
      asal: 'mscz' | 'mscx'
      /** Jalur `.mscx` di dalam arsip (khusus `.mscz`). */
      jalurUtama?: string
    } & InfoKonversiMuseScore)
  | { ok: false; alasan: string }

/** `lagu.mscz` / `lagu.mscx` → `lagu.musicxml`. */
export function namaMusicXmlDariMuseScore(namaFile: string): string {
  const bersih = namaFile.trim() || 'partitur'
  if (/\.(mscz|mscx)$/i.test(bersih)) return bersih.replace(/\.(mscz|mscx)$/i, '.musicxml')
  if (/\.(musicxml|xml)$/i.test(bersih)) return bersih
  return `${bersih}.musicxml`
}

/* ------------------------------ Konstanta ------------------------------- */

const LANGKAH = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const
const PC_LANGKAH = [0, 2, 4, 5, 7, 9, 11]
/** Urutan lingkaran kuin mulai tpc −1 (Fbb). */
const LANGKAH_KUIN = ['F', 'C', 'G', 'D', 'A', 'E', 'B'] as const

/** Panjang nilai not dalam satuan not seperempat. */
const NILAI_PEREMPAT: Record<string, number> = {
  long: 16,
  breve: 8,
  whole: 4,
  half: 2,
  quarter: 1,
  eighth: 0.5,
  '16th': 0.25,
  '32nd': 0.125,
  '64th': 0.0625,
  '128th': 0.03125,
  '256th': 0.015625,
  '512th': 0.0078125,
  '1024th': 0.00390625,
}

const DINAMIKA_MUSICXML = new Set([
  'pppppp', 'ppppp', 'pppp', 'ppp', 'pp', 'p', 'mp', 'mf', 'f', 'ff', 'fff', 'ffff', 'fffff', 'ffffff',
  'fp', 'pf', 'sf', 'sfp', 'sfpp', 'sfz', 'sffz', 'sfzp', 'fz', 'rf', 'rfz', 'n',
])

const KEPALA_NOT: Record<string, string> = {
  cross: 'x',
  '1': 'x',
  xcircle: 'circle-x',
  '3': 'circle-x',
  withx: 'x',
  '4': 'x',
  plus: 'cross',
  '2': 'cross',
  diamond: 'diamond',
  'diamond-old': 'diamond',
  '9': 'diamond',
  '10': 'diamond',
  'triangle-up': 'triangle',
  '5': 'triangle',
  'triangle-down': 'inverted triangle',
  '6': 'inverted triangle',
  slash: 'slash',
  circled: 'circle dot',
  'circled-large': 'circle dot',
}

const ARTIKULASI: { pola: RegExp; xml: string; jenis: 'articulations' | 'fermata' }[] = [
  { pola: /fermata/i, xml: '<fermata type="upright"/>', jenis: 'fermata' },
  { pola: /marcatoStaccato/i, xml: '<strong-accent type="up"/><staccato/>', jenis: 'articulations' },
  { pola: /marcatoTenuto/i, xml: '<strong-accent type="up"/><tenuto/>', jenis: 'articulations' },
  { pola: /accentStaccato|sforzatoStaccato/i, xml: '<accent/><staccato/>', jenis: 'articulations' },
  { pola: /tenutoStaccato|portato/i, xml: '<detached-legato/>', jenis: 'articulations' },
  { pola: /staccatissimo/i, xml: '<staccatissimo/>', jenis: 'articulations' },
  { pola: /marcato/i, xml: '<strong-accent type="up"/>', jenis: 'articulations' },
  { pola: /accent|sforzato/i, xml: '<accent/>', jenis: 'articulations' },
  { pola: /staccato/i, xml: '<staccato/>', jenis: 'articulations' },
  { pola: /tenuto/i, xml: '<tenuto/>', jenis: 'articulations' },
]

/** Kata bawaan untuk perubahan tempo berangsur MuseScore 4. */
const KATA_TEMPO_BERANGSUR: Record<string, string> = {
  accelerando: 'accel.',
  allargando: 'allarg.',
  calando: 'calando',
  lentando: 'lentando',
  morendo: 'morendo',
  precipitando: 'precipitando',
  rallentando: 'rall.',
  ritardando: 'rit.',
  smorzando: 'smorz.',
  sostenuto: 'sost.',
  stringendo: 'string.',
}

/* ------------------------------ Pembantu -------------------------------- */

function pecahan(teks: string | null | undefined): number | null {
  if (!teks) return null
  const m = /^\s*(-?\d+)\s*\/\s*(\d+)\s*$/.exec(teks)
  if (m) {
    const d = Number(m[2])
    return d > 0 ? Number(m[1]) / d : null
  }
  const v = Number(teks)
  return Number.isFinite(v) ? v : null
}

function fpb(a: number, b: number): number {
  a = Math.abs(a)
  b = Math.abs(b)
  while (b) [a, b] = [b, a % b]
  return a || 1
}

function kpk(a: number, b: number): number {
  return (a / fpb(a, b)) * b
}

/** Teks tampilan dari isi campuran MuseScore (`<b>`, `<font/>`, `<sym>`). */
function teksTampil(el: ElemenXml | null | undefined): string {
  if (!el) return ''
  let s = ''
  for (const x of el.isi) {
    if (typeof x === 'string') s += x
    else if (x.nama === 'sym') s += simbolKeUnicode(teksAnakMentah(x))
    else s += teksTampil(x)
  }
  return s.replace(/\s+/g, ' ').trim()
}

function teksAnakMentah(el: ElemenXml): string {
  let s = ''
  for (const x of el.isi) s += typeof x === 'string' ? x : teksAnakMentah(x)
  return s.trim()
}

const SIMBOL_UNICODE: Record<string, string> = {
  metNoteWhole: '𝅝',
  metNoteHalfUp: '𝅗𝅥',
  metNoteQuarterUp: '♩',
  metNote8thUp: '♪',
  metNote16thUp: '𝅘𝅥𝅯',
  metAugmentationDot: '.',
  segno: '𝄋',
  coda: '𝄌',
  dynamicForte: 'f',
  dynamicPiano: 'p',
  dynamicMezzo: 'm',
}

function simbolKeUnicode(nama: string): string {
  return SIMBOL_UNICODE[nama] ?? ''
}

/** Unit ketuk metronom dari teks tempo (`♩ = 120`, `♩. = 80`, `𝅗𝅥 = 60`). */
function unitTempoDariTeks(teks: string): { unit: string; titik: boolean; perempat: number } | null {
  const pola: [RegExp, string, number][] = [
    [/𝅝/u, 'whole', 4],
    [/𝅗𝅥|𝅗/u, 'half', 2],
    [/♩|𝅘𝅥(?!𝅮|𝅯)/u, 'quarter', 1],
    [/♪|𝅘𝅥𝅮/u, 'eighth', 0.5],
    [/𝅘𝅥𝅯/u, '16th', 0.25],
  ]
  for (const [re, unit, nilai] of pola) {
    const m = re.exec(teks)
    if (m) {
      const sesudah = teks.slice(m.index + m[0].length, m.index + m[0].length + 2)
      const titik = /^\s?[.𝅭]/u.test(sesudah)
      return { unit, titik, perempat: titik ? nilai * 1.5 : nilai }
    }
  }
  return null
}

/** Bagian kata dari teks tempo: "Allegro ♩ = 120" → "Allegro". */
function kataTempo(teks: string): string {
  const idx = teks.search(/[♩♪𝅝𝅗𝅘]/u)
  const kata = (idx >= 0 ? teks.slice(0, idx) : teks.replace(/=\s*\d+([.,]\d+)?/, ''))
    .replace(/[([]\s*$/, '')
    .trim()
  return /^[\s=\d.,()]*$/.test(kata) ? '' : kata
}

function bulat2(v: number): number {
  return Math.round(v * 100) / 100
}

function angkaTeks(v: number): string {
  const b = bulat2(v)
  return Number.isInteger(b) ? String(b) : String(b)
}

/** tpc MuseScore → langkah + alterasi. */
function tpcKeEjaan(tpc: number): { langkah: string; alter: number } {
  const t = Math.round(tpc)
  const idx = (((t + 1) % 7) + 7) % 7
  return { langkah: LANGKAH_KUIN[idx], alter: Math.floor((t + 1) / 7) - 2 }
}

/** Ejaan not tertulis (langkah, alter, oktaf) dari MIDI + tpc. */
function ejaanNot(midi: number, tpc: number | null): { langkah: string; alter: number; oktaf: number } {
  if (tpc != null && Number.isFinite(tpc) && tpc >= -1 && tpc <= 33) {
    const { langkah, alter } = tpcKeEjaan(tpc)
    const pc = PC_LANGKAH[LANGKAH.indexOf(langkah as (typeof LANGKAH)[number])]
    const oktaf = Math.round((midi - alter - pc) / 12) - 1
    return { langkah, alter, oktaf }
  }
  // Cadangan tanpa tpc: ejaan kres.
  const tabel: [string, number][] = [
    ['C', 0], ['C', 1], ['D', 0], ['D', 1], ['E', 0], ['F', 0], ['F', 1], ['G', 0], ['G', 1], ['A', 0], ['A', 1], ['B', 0],
  ]
  const pc = ((midi % 12) + 12) % 12
  return { langkah: tabel[pc][0], alter: tabel[pc][1], oktaf: Math.floor(midi / 12) - 1 }
}

/** Kunci (clef) MuseScore → MusicXML. */
function kunciMusicXml(jenis: string | null | undefined): { sign: string; line?: number; oktaf?: number } {
  const k = (jenis ?? 'G').trim()
  if (/^PERC/i.test(k)) return { sign: 'percussion' }
  if (/^TAB/i.test(k)) return { sign: 'TAB', line: 5 }
  const okt = /15ma/.test(k) ? 2 : /8va/.test(k) ? 1 : /15mb/.test(k) ? -2 : /8vb/.test(k) ? -1 : 0
  const m = /^([GFC])(\d)?/.exec(k)
  if (!m) return { sign: 'G', line: 2 }
  const sign = m[1]
  const garisBawaan = sign === 'G' ? 2 : sign === 'F' ? 4 : 3
  const line = m[2] ? Number(m[2]) : garisBawaan
  return { sign, line, oktaf: okt || undefined }
}

/** Selisih kuin sebuah transposisi (diatonik, kromatik). */
function kuinTransposisi(diatonik: number, kromatik: number): number {
  return kromatik * 7 - diatonik * 12
}

function rapikanKuin(f: number): number {
  let v = f
  while (v > 7) v -= 12
  while (v < -7) v += 12
  return v
}

/* --------------------------- Model antara ------------------------------- */

interface NotAntara {
  pitch: number
  tpc: number | null
  tpc2: number | null
  tieMulai: boolean
  tieAkhir: boolean
  kepala?: string
}

interface PeristiwaAntara {
  tick: number
  dur: number
  jenis: 'chord' | 'rest'
  grace?: 'slash' | 'biasa'
  tipe?: string
  titik: number
  utuh?: boolean
  notes: NotAntara[]
  rasio?: { aktual: number; normal: number }
  tupletMulai?: boolean
  tupletAkhir?: boolean
  artikulasi: string[]
  fermata: boolean
  tremolo?: number
}

type ItemArah =
  | { tick: number; jenis: 'xml'; xml: string; sistem: boolean }
  | { tick: number; jenis: 'clef'; clef: string }

interface SuaraAntara {
  peristiwa: PeristiwaAntara[]
}

interface BiramaStaf {
  suara: SuaraAntara[]
  arah: ItemArah[]
  panjang: number | null
  irregular: boolean
  startRepeat: boolean
  endRepeat: number
  waktu?: { n: number; d: number; simbol?: 'common' | 'cut' }
  kunciNada?: { fifths: number; mode?: string }
  clefAwal?: string
  gayaBar?: string
  ulangBirama?: number
  voltaMulai?: { nomor: string; teks: string }
  voltaSelesai?: { nomor: string; putus: boolean }
  /** Volta yang dimulai di birama ini berakhir di birama indeks `m`. */
  voltaAkhir?: { m: number; nomor: string; putus: boolean }
  /** Ottava (8va/8vb/15ma…) yang dimulai di birama ini. */
  ottava?: { geser: number; ukuran: number; mulaiTick: number; akhirM: number; akhirTick: number }[]
}

interface DrumDef {
  baris: number
  kepala: string
  nama: string
}

interface PartAntara {
  id: string
  nama: string
  singkatan: string
  diatonik: number
  kromatik: number
  perkusi: boolean
  drum: Map<number, DrumDef>
  program: number | null
  idxStaf: number[]
  garisStaf: number[]
  clefStaf: string[]
}

/* ------------------------------ Konversi -------------------------------- */

/**
 * Terjemahkan teks `.mscx` menjadi MusicXML `<score-partwise>` versi 4.0.
 */
export function konversiMscxKeMusicXml(teks: string): HasilKonversiMuseScore {
  try {
    const akar = uraiXmlRingan(teks)
    if (akar.nama !== 'museScore') {
      return { ok: false, alasan: `elemen akar <${akar.nama}>, bukan <museScore>` }
    }
    const versi = akar.attr.version ?? '?'
    const mayor = Number.parseInt(versi, 10)
    const peringatan: string[] = []
    if (Number.isFinite(mayor) && mayor < 3) {
      peringatan.push(
        `Berkas MuseScore ${versi} (format lama) — dicoba sebisanya; hasil terbaik dari MuseScore 3 atau 4.`,
      )
    }
    const skor = anak(akar, 'Score')
    if (!skor) return { ok: false, alasan: 'berkas MuseScore tanpa elemen <Score>' }
    return konversiSkor(skor, versi, peringatan)
  } catch (e) {
    return { ok: false, alasan: `berkas MuseScore tidak bisa diurai: ${e instanceof Error ? e.message : String(e)}` }
  }
}

function konversiSkor(skor: ElemenXml, versi: string, peringatan: string[]): HasilKonversiMuseScore {
  const div = Math.max(1, angkaAnak(skor, 'Division') ?? 480)

  /* ---- Metadata ---- */
  const meta = new Map<string, string>()
  for (const mt of anakElemen(skor, 'metaTag')) {
    const nama = mt.attr.name
    const isi = teksTampil(mt)
    if (nama && isi) meta.set(nama, isi)
  }

  /* ---- Staf tingkat skor ---- */
  const stafSkor = anakElemen(skor, 'Staff')
  if (stafSkor.length === 0) return { ok: false, alasan: 'berkas MuseScore tanpa staf (<Staff>) berisi birama' }

  // Judul cadangan dari bingkai VBox teratas.
  let judulVbox: string | undefined
  let komposerVbox: string | undefined
  for (const vb of anakElemen(stafSkor[0], 'VBox')) {
    for (const t of anakElemen(vb, 'Text')) {
      const gaya = teksAnak(t, 'style') ?? ''
      const isi = teksTampil(anak(t, 'text'))
      if (!isi) continue
      if (/^title$/i.test(gaya) && !judulVbox) judulVbox = isi
      else if (/^composer$/i.test(gaya) && !komposerVbox) komposerVbox = isi
    }
  }
  const judul = meta.get('workTitle') || meta.get('movementTitle') || judulVbox
  const komposer = meta.get('composer') || komposerVbox
  const arranger = meta.get('arranger')

  /* ---- Part ---- */
  const parts: PartAntara[] = []
  let kursorStaf = 0
  const elemenPart = anakElemen(skor, 'Part')
  for (const p of elemenPart) {
    const stafPart = anakElemen(p, 'Staff')
    const jumlah = Math.max(1, stafPart.length)
    const ins = anak(p, 'Instrument')
    const idxStaf: number[] = []
    const garisStaf: number[] = []
    const clefStaf: string[] = []
    let perkusi = false
    for (let s = 0; s < jumlah; s += 1) {
      idxStaf.push(kursorStaf + s)
      const st = stafPart[s]
      const tipe = st ? anak(st, 'StaffType') : null
      if (tipe?.attr.group === 'percussion') perkusi = true
      garisStaf.push(tipe ? (angkaAnak(tipe, 'lines') ?? 5) : 5)
      clefStaf.push('')
    }
    kursorStaf += jumlah
    if (ins) {
      if (angkaAnak(ins, 'useDrumset') === 1) perkusi = true
      for (const c of anakElemen(ins, 'clef')) {
        const s = Math.max(1, Number(c.attr.staff ?? '1')) - 1
        if (s < clefStaf.length) clefStaf[s] = teksAnakMentah(c)
      }
    }
    const drum = new Map<number, DrumDef>()
    for (const d of anakElemen(ins, 'Drum')) {
      const pitch = Number(d.attr.pitch)
      if (!Number.isFinite(pitch)) continue
      drum.set(pitch, {
        baris: angkaAnak(d, 'line') ?? 4,
        kepala: teksAnak(d, 'head') ?? 'normal',
        nama: teksAnak(d, 'name') ?? `Perkusi ${pitch}`,
      })
    }
    const kanal = anak(ins, 'Channel')
    const prog = kanal ? anak(kanal, 'program') : null
    const programV = prog ? Number(prog.attr.value) : NaN
    const nama = (ins && (teksTampil(anak(ins, 'longName')) || teksTampil(anak(ins, 'trackName')))) ||
      teksTampil(anak(p, 'trackName')) ||
      `Part ${parts.length + 1}`
    parts.push({
      id: `P${parts.length + 1}`,
      nama,
      singkatan: (ins && teksTampil(anak(ins, 'shortName'))) || '',
      diatonik: (ins && angkaAnak(ins, 'transposeDiatonic')) || 0,
      kromatik: (ins && angkaAnak(ins, 'transposeChromatic')) || 0,
      perkusi,
      drum,
      program: Number.isFinite(programV) ? programV : null,
      idxStaf,
      garisStaf,
      clefStaf,
    })
  }
  if (parts.length === 0) {
    // Berkas tanpa <Part> (jarang): satu part per staf.
    stafSkor.forEach((_, i) =>
      parts.push({
        id: `P${i + 1}`,
        nama: `Part ${i + 1}`,
        singkatan: '',
        diatonik: 0,
        kromatik: 0,
        perkusi: false,
        drum: new Map(),
        program: null,
        idxStaf: [i],
        garisStaf: [5],
        clefStaf: [''],
      }),
    )
  }

  /* ---- Birama per staf ---- */
  const hitung = { lirik: 0, akor: 0, ulangBirama: 0, lompat: 0 }
  const rasioDitemui = new Set<number>()
  const biramaPerStaf: BiramaStaf[][] = stafSkor.map((st, i) =>
    uraiStaf(st, div, i === 0, hitung, rasioDitemui),
  )
  const jumlahBirama = biramaPerStaf.reduce((m, b) => Math.max(m, b.length), 0)
  if (jumlahBirama === 0) return { ok: false, alasan: 'berkas MuseScore tidak memuat satu birama pun' }

  // Panjang birama nominal & aktual (dari staf pertama, berlaku untuk semua).
  const strukturBirama = biramaPerStaf[0]
  strukturBirama.forEach((b) => {
    if (!b.voltaAkhir) return
    const target = strukturBirama[Math.min(b.voltaAkhir.m, strukturBirama.length - 1)]
    if (target && !target.voltaSelesai) target.voltaSelesai = { nomor: b.voltaAkhir.nomor, putus: b.voltaAkhir.putus }
  })
  const panjangBirama: number[] = []
  const nominalBirama: number[] = []
  let waktuAktif = { n: 4, d: 4 }
  for (let m = 0; m < jumlahBirama; m += 1) {
    const b = strukturBirama[m] ?? biramaPerStaf.find((x) => x[m])?.[m]
    if (b?.waktu) waktuAktif = b.waktu
    const nominal = (waktuAktif.n / waktuAktif.d) * 4 * div
    nominalBirama.push(nominal)
    panjangBirama.push(b?.panjang != null ? b.panjang : nominal)
  }

  // Ulang birama (simile): salin isi birama yang diulang.
  for (const daftar of biramaPerStaf) {
    for (let m = 0; m < daftar.length; m += 1) {
      const b = daftar[m]
      if (!b.ulangBirama) continue
      const sumber = daftar[m - b.ulangBirama]
      if (sumber) {
        b.suara = sumber.suara.map((v) => ({
          peristiwa: v.peristiwa.map((e) => ({ ...e, notes: e.notes.map((n) => ({ ...n, tieMulai: false, tieAkhir: false })) })),
        }))
      }
    }
  }

  // Ottava: MuseScore menyimpan nada tanpa geseran 8va, MusicXML menyimpan
  // nada bunyi — jadi nada di dalam rentang digeser, dan penutupnya ditulis.
  biramaPerStaf.forEach((daftar) => {
    daftar.forEach((b, m) => {
      for (const o of b.ottava ?? []) {
        const akhirM = Math.min(o.akhirM, daftar.length - 1)
        for (let mm = m; mm <= akhirM; mm += 1) {
          for (const v of daftar[mm].suara) {
            for (const e of v?.peristiwa ?? []) {
              const setelahMulai = mm > m || e.tick >= o.mulaiTick - 1e-9
              const sebelumAkhir = mm < o.akhirM || e.tick < o.akhirTick - 1e-9
              if (setelahMulai && sebelumAkhir) for (const n of e.notes) n.pitch += o.geser
            }
          }
        }
        const target = daftar[akhirM]
        if (target) {
          target.arah.push({
            tick: o.akhirM <= akhirM ? o.akhirTick : panjangBiramaKasar(target, div),
            jenis: 'xml',
            xml: `<direction><direction-type><octave-shift type="stop" size="${o.ukuran}"/></direction-type></direction>`,
            sistem: false,
          })
        }
      }
    })
  })

  // Faktor pembagi keluaran supaya durasi tuplet tetap bulat.
  let k = 1
  for (const a of rasioDitemui) k = kpk(k, a / fpb(a, div))
  if (k > 64) k = 64
  const divKeluar = div * k
  const t = (v: number) => Math.round(v * k)

  if (hitung.lirik > 0) peringatan.push(`${hitung.lirik} suku kata lirik dilewati (DrillKit tidak menampilkan lirik).`)
  if (hitung.akor > 0) peringatan.push(`${hitung.akor} simbol akor dilewati.`)
  if (hitung.ulangBirama > 0) {
    peringatan.push(`${hitung.ulangBirama} tanda ulang birama (simile) ditulis ulang sebagai not utuh.`)
  }
  if (hitung.lompat > 0) {
    peringatan.push(`${hitung.lompat} lompatan D.S./D.C./Coda dipertahankan sebagai tanda — urutan main tidak dibentangkan otomatis.`)
  }

  /* ---- Tulis MusicXML ---- */
  const out: string[] = []
  out.push('<?xml version="1.0" encoding="UTF-8"?>')
  out.push(
    '<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">',
  )
  out.push('<score-partwise version="4.0">')
  if (judul) out.push(`  <work><work-title>${escapeXml(judul)}</work-title></work>`)
  if (meta.get('movementTitle') && meta.get('movementTitle') !== judul) {
    out.push(`  <movement-title>${escapeXml(meta.get('movementTitle') ?? '')}</movement-title>`)
  }
  out.push('  <identification>')
  if (komposer) out.push(`    <creator type="composer">${escapeXml(komposer)}</creator>`)
  if (arranger) out.push(`    <creator type="arranger">${escapeXml(arranger)}</creator>`)
  out.push('    <encoding>')
  out.push(`      <software>DrillKit — konversi langsung MuseScore ${escapeXml(versi)}</software>`)
  out.push('    </encoding>')
  out.push('  </identification>')

  // Drum yang benar-benar dipakai per part.
  const drumDipakai = parts.map((p) => {
    const set = new Set<number>()
    if (!p.perkusi) return set
    for (const si of p.idxStaf) {
      for (const b of biramaPerStaf[si] ?? []) {
        for (const v of b.suara) for (const e of v.peristiwa) for (const n of e.notes) set.add(n.pitch)
      }
    }
    return set
  })

  out.push('  <part-list>')
  parts.forEach((p, pi) => {
    out.push(`    <score-part id="${p.id}">`)
    out.push(`      <part-name>${escapeXml(p.nama)}</part-name>`)
    if (p.singkatan) out.push(`      <part-abbreviation>${escapeXml(p.singkatan)}</part-abbreviation>`)
    if (p.perkusi) {
      const daftar = [...drumDipakai[pi]].sort((a, b) => a - b)
      for (const pitch of daftar) {
        const nm = p.drum.get(pitch)?.nama ?? `Perkusi ${pitch}`
        out.push(`      <score-instrument id="${p.id}-I${pitch + 1}"><instrument-name>${escapeXml(nm)}</instrument-name></score-instrument>`)
      }
      for (const pitch of daftar) {
        out.push(
          `      <midi-instrument id="${p.id}-I${pitch + 1}"><midi-channel>10</midi-channel><midi-unpitched>${pitch + 1}</midi-unpitched></midi-instrument>`,
        )
      }
    } else if (p.program != null) {
      out.push(`      <score-instrument id="${p.id}-I1"><instrument-name>${escapeXml(p.nama)}</instrument-name></score-instrument>`)
      out.push(`      <midi-instrument id="${p.id}-I1"><midi-program>${Math.min(128, Math.max(1, p.program + 1))}</midi-program></midi-instrument>`)
    }
    out.push('    </score-part>')
  })
  out.push('  </part-list>')

  parts.forEach((p, pi) => {
    out.push(`  <part id="${p.id}">`)
    tulisPart(out, p, biramaPerStaf, strukturBirama, jumlahBirama, panjangBirama, nominalBirama, divKeluar, t, pi === 0)
    out.push('  </part>')
  })
  out.push('</score-partwise>')

  return {
    ok: true,
    xml: out.join('\n') + '\n',
    versi,
    judul,
    jumlahPart: parts.length,
    jumlahBirama,
    peringatan,
  }
}

/* ------------------------------ Urai staf ------------------------------- */

function uraiStaf(
  staf: ElemenXml,
  div: number,
  stafPertama: boolean,
  hitung: { lirik: number; akor: number; ulangBirama: number; lompat: number },
  rasioDitemui: Set<number>,
): BiramaStaf[] {
  const hasil: BiramaStaf[] = []
  const elemenBirama = anakElemen(staf, 'Measure')
  // Spanner gaya MuseScore 3: id → data awal.
  const spannerId = new Map<string, { jenis: string; m: number; tick: number; data: Record<string, string> }>()

  const panjangKeTick = (pecah: number) => pecah * 4 * div

  elemenBirama.forEach((mEl, m) => {
    const b: BiramaStaf = {
      suara: [],
      arah: [],
      panjang: null,
      irregular: false,
      startRepeat: false,
      endRepeat: 0,
    }
    const len = pecahan(mEl.attr.len)
    if (len != null && len > 0) b.panjang = panjangKeTick(len)
    if (anak(mEl, 'irregular')) b.irregular = true
    if (anak(mEl, 'startRepeat')) b.startRepeat = true
    const er = anak(mEl, 'endRepeat')
    if (er) b.endRepeat = Math.max(2, Number(teksAnakMentah(er)) || 2)

    let suaraEl = anakElemen(mEl, 'voice')
    // MuseScore 2: isi birama langsung tanpa <voice>.
    if (suaraEl.length === 0) suaraEl = [mEl]

    suaraEl.forEach((vEl, vi) => {
      const suara: SuaraAntara = { peristiwa: [] }
      let kursor = 0
      const tupletStack: { aktual: number; normal: number; idxPertama: number; idxTerakhir: number }[] = []
      const tupletMs3 = new Map<string, { aktual: number; normal: number; induk?: string; pertama: number; terakhir: number }>()
      let graceTertunda: PeristiwaAntara[] = []
      let fermataTertunda = false

      const tambahArah = (item: ItemArah) => {
        b.arah.push(item)
      }

      for (const x of vEl.isi) {
        if (typeof x === 'string') continue
        switch (x.nama) {
          case 'location': {
            const f = pecahan(teksAnak(x, 'fractions'))
            if (f != null) kursor = Math.max(0, kursor + panjangKeTick(f))
            break
          }
          case 'Chord':
          case 'Rest': {
            const ev = uraiChord(x, kursor, div, b, nominalSementara(b, hasil, div))
            if (!ev) break
            hitung.lirik += anakElemen(x, 'Lyrics').length
            // Tuplet
            let rasio = 1
            if (tupletStack.length > 0) {
              for (const tp of tupletStack) rasio *= tp.normal / tp.aktual
              const luar = tupletStack[0]
              ev.rasio = {
                aktual: tupletStack.reduce((a, tp) => a * tp.aktual, 1),
                normal: tupletStack.reduce((a, tp) => a * tp.normal, 1),
              }
              if (!ev.grace) {
                if (luar.idxPertama < 0) luar.idxPertama = suara.peristiwa.length + graceTertunda.length
                luar.idxTerakhir = suara.peristiwa.length + graceTertunda.length
              }
            } else {
              const ref = teksAnak(x, 'Tuplet')
              if (ref && tupletMs3.has(ref)) {
                let id: string | undefined = ref
                let aktual = 1
                let normal = 1
                let jaga = 0
                while (id && tupletMs3.has(id) && jaga < 8) {
                  const tp: { aktual: number; normal: number; induk?: string } = tupletMs3.get(id)!
                  aktual *= tp.aktual
                  normal *= tp.normal
                  id = tp.induk
                  jaga += 1
                }
                rasio = normal / aktual
                ev.rasio = { aktual, normal }
                const tp = tupletMs3.get(ref)!
                if (!ev.grace) {
                  if (tp.pertama < 0) tp.pertama = suara.peristiwa.length + graceTertunda.length
                  tp.terakhir = suara.peristiwa.length + graceTertunda.length
                }
              }
            }
            if (ev.rasio) rasioDitemui.add(ev.rasio.aktual)
            if (ev.grace) {
              ev.tick = kursor
              graceTertunda.push(ev)
              break
            }
            if (!ev.utuh) ev.dur = ev.dur * rasio
            if (fermataTertunda) {
              ev.fermata = true
              fermataTertunda = false
            }
            for (const g of graceTertunda) {
              g.tick = kursor
              suara.peristiwa.push(g)
            }
            graceTertunda = []
            ev.tick = kursor
            suara.peristiwa.push(ev)
            kursor += ev.dur
            break
          }
          case 'Tuplet': {
            const aktual = angkaAnak(x, 'actualNotes') ?? 3
            const normal = angkaAnak(x, 'normalNotes') ?? 2
            if (x.attr.id) {
              tupletMs3.set(x.attr.id, {
                aktual,
                normal,
                induk: teksAnak(x, 'Tuplet') ?? undefined,
                pertama: -1,
                terakhir: -1,
              })
            } else {
              tupletStack.push({ aktual, normal, idxPertama: -1, idxTerakhir: -1 })
            }
            break
          }
          case 'endTuplet': {
            const tp = tupletStack.pop()
            if (tp && tupletStack.length === 0) tandaiTuplet(suara.peristiwa, tp.idxPertama, tp.idxTerakhir)
            break
          }
          case 'Clef': {
            const jenis = teksAnak(x, 'transposingClefType') ?? teksAnak(x, 'concertClefType') ?? teksAnak(x, 'subtype')
            if (jenis) {
              if (kursor === 0 && !b.clefAwal) b.clefAwal = jenis
              else tambahArah({ tick: kursor, jenis: 'clef', clef: jenis })
            }
            break
          }
          case 'KeySig': {
            const custom = angkaAnak(x, 'custom') === 1 || teksAnak(x, 'mode') === 'none'
            const f = angkaAnak(x, 'concertKey') ?? angkaAnak(x, 'accidental') ?? angkaAnak(x, 'key')
            if (!custom && f != null && !b.kunciNada) {
              const mode = teksAnak(x, 'mode') ?? undefined
              b.kunciNada = { fifths: f, mode: mode === 'minor' ? 'minor' : mode === 'major' ? 'major' : undefined }
            } else if (custom && !b.kunciNada) {
              b.kunciNada = { fifths: 0 }
            }
            break
          }
          case 'TimeSig': {
            const n = angkaAnak(x, 'sigN')
            const d = angkaAnak(x, 'sigD')
            if (n && d && !b.waktu) {
              const sub = angkaAnak(x, 'subtype')
              b.waktu = { n, d, simbol: sub === 1 ? 'common' : sub === 2 ? 'cut' : undefined }
            }
            break
          }
          case 'Tempo': {
            if (!stafPertama) break
            const qps = angkaAnak(x, 'tempo')
            const teksT = teksTampil(anak(x, 'text'))
            tambahArah({ tick: kursor, jenis: 'xml', xml: xmlTempo(qps, teksT), sistem: true })
            break
          }
          case 'RehearsalMark': {
            if (!stafPertama) break
            const isi = teksTampil(anak(x, 'text'))
            if (isi) {
              tambahArah({
                tick: kursor,
                jenis: 'xml',
                xml: `<direction placement="above"><direction-type><rehearsal>${escapeXml(isi)}</rehearsal></direction-type></direction>`,
                sistem: true,
              })
            }
            break
          }
          case 'SystemText':
          case 'StaffText':
          case 'Expression':
          case 'PlayTechAnnotation': {
            const sistem = x.nama === 'SystemText'
            if (sistem && !stafPertama) break
            const isi = teksTampil(anak(x, 'text'))
            if (isi) {
              tambahArah({
                tick: kursor,
                jenis: 'xml',
                xml: `<direction placement="${x.nama === 'Expression' ? 'below' : 'above'}"><direction-type><words>${escapeXml(isi)}</words></direction-type></direction>`,
                sistem,
              })
            }
            break
          }
          case 'Sticking': {
            const isi = teksTampil(anak(x, 'text'))
            if (isi) {
              tambahArah({
                tick: kursor,
                jenis: 'xml',
                xml: `<direction placement="below"><direction-type><words>${escapeXml(isi)}</words></direction-type></direction>`,
                sistem: false,
              })
            }
            break
          }
          case 'Dynamic': {
            const sub = (teksAnak(x, 'subtype') ?? '').trim()
            const isiTeks = teksTampil(anak(x, 'text'))
            const nama = sub || isiTeks
            if (!nama) break
            const el = DINAMIKA_MUSICXML.has(nama) ? `<${nama}/>` : `<other-dynamics>${escapeXml(isiTeks || nama)}</other-dynamics>`
            tambahArah({
              tick: kursor,
              jenis: 'xml',
              xml: `<direction placement="below"><direction-type><dynamics>${el}</dynamics></direction-type></direction>`,
              sistem: false,
            })
            break
          }
          case 'Harmony':
            hitung.akor += 1
            break
          case 'Fermata':
            fermataTertunda = true
            break
          case 'Jump': {
            if (!stafPertama) break
            hitung.lompat += 1
            const isi = teksTampil(anak(x, 'text')) || 'D.S.'
            const ke = (teksAnak(x, 'jumpTo') ?? '').toLowerCase()
            const suaraAttr = /start/.test(ke) || /^d\.?\s?c/i.test(isi) ? ' dacapo="yes"' : ` dalsegno="${escapeXml(ke || 'segno')}"`
            tambahArah({
              tick: kursor,
              jenis: 'xml',
              xml: `<direction placement="above"><direction-type><words>${escapeXml(isi)}</words></direction-type><sound${suaraAttr}/></direction>`,
              sistem: true,
            })
            break
          }
          case 'Marker': {
            if (!stafPertama) break
            const sub = (teksAnak(x, 'subtype') ?? teksAnak(x, 'label') ?? '').toLowerCase()
            const isi = teksTampil(anak(x, 'text'))
            let xml = ''
            if (/segno/.test(sub)) xml = '<direction-type><segno/></direction-type><sound segno="segno"/>'
            else if (/tocoda/.test(sub)) xml = `<direction-type><words>${escapeXml(isi || 'To Coda')}</words></direction-type><sound tocoda="coda"/>`
            else if (/coda/.test(sub)) xml = '<direction-type><coda/></direction-type><sound coda="coda"/>'
            else if (/fine/.test(sub)) xml = `<direction-type><words>${escapeXml(isi || 'Fine')}</words></direction-type><sound fine="yes"/>`
            else if (isi) xml = `<direction-type><words>${escapeXml(isi)}</words></direction-type>`
            if (xml) tambahArah({ tick: kursor, jenis: 'xml', xml: `<direction placement="above">${xml}</direction>`, sistem: true })
            break
          }
          case 'BarLine': {
            const sub = teksAnak(x, 'subtype')
            if (sub) b.gayaBar = sub
            break
          }
          case 'MeasureRepeat':
          case 'RepeatMeasure': {
            b.ulangBirama = Math.max(1, angkaAnak(x, 'subtype') ?? 1)
            hitung.ulangBirama += 1
            const dur = pecahan(teksAnak(x, 'duration'))
            kursor += dur != null ? panjangKeTick(dur) : 0
            break
          }
          case 'Spanner': {
            uraiSpanner(x, m, kursor, b, stafPertama, tambahArah, hasil, div)
            break
          }
          case 'Volta':
          case 'HairPin':
          case 'Ottava':
          case 'Pedal':
          case 'Trill':
          case 'TextLine':
          case 'Slur': {
            // Gaya MuseScore 3: elemen ber-id, ditutup <endSpanner id>.
            if (x.attr.id) {
              const data: Record<string, string> = {}
              for (const c of anakElemen(x)) data[c.nama] = teksAnakMentah(c)
              spannerId.set(x.attr.id, { jenis: x.nama, m, tick: kursor, data })
              if (x.nama === 'Volta' && stafPertama) {
                b.voltaMulai = { nomor: data.endings || '1', teks: data.beginText || data.text || '' }
              } else if (x.nama === 'HairPin') {
                tambahArah({ tick: kursor, jenis: 'xml', xml: xmlWedge(data.subtype, true), sistem: false })
              }
            }
            break
          }
          case 'endSpanner': {
            const id = x.attr.id
            const sp = id ? spannerId.get(id) : undefined
            if (!sp) break
            spannerId.delete(id!)
            if (sp.jenis === 'Volta' && stafPertama) {
              const akhirM = kursor === 0 ? m - 1 : m
              const target = akhirM === m ? b : hasil[akhirM]
              if (target) target.voltaSelesai = { nomor: sp.data.endings || '1', putus: (Number(sp.data.endHookType) || 0) === 0 }
            } else if (sp.jenis === 'HairPin') {
              tambahArah({ tick: kursor, jenis: 'xml', xml: xmlWedge(sp.data.subtype, false), sistem: false })
            }
            break
          }
          default:
            break
        }
      }
      // Grace-after yang tertinggal di ujung suara.
      for (const g of graceTertunda) {
        g.tick = kursor
        suara.peristiwa.push(g)
      }
      // Tuplet MuseScore 3: tandai awal/akhir.
      for (const tp of tupletMs3.values()) tandaiTuplet(suara.peristiwa, tp.pertama, tp.terakhir)
      // Tuplet MS4 yang tidak ditutup endTuplet.
      while (tupletStack.length > 0) {
        const tp = tupletStack.pop()!
        if (tupletStack.length === 0) tandaiTuplet(suara.peristiwa, tp.idxPertama, tp.idxTerakhir)
      }
      if (vi < 4) b.suara[vi] = suara
    })
    hasil.push(b)
  })
  return hasil
}

function panjangBiramaKasar(b: BiramaStaf, div: number): number {
  if (b.panjang != null) return b.panjang
  const w = b.waktu ?? { n: 4, d: 4 }
  return (w.n / w.d) * 4 * div
}

/** Panjang nominal birama saat diurai (untuk istirahat satu birama tanpa `<duration>`). */
function nominalSementara(b: BiramaStaf, sebelumnya: BiramaStaf[], div: number): number {
  if (b.panjang != null) return b.panjang
  let w = b.waktu
  for (let i = sebelumnya.length - 1; !w && i >= 0; i -= 1) w = sebelumnya[i].waktu
  const ww = w ?? { n: 4, d: 4 }
  return (ww.n / ww.d) * 4 * div
}

function tandaiTuplet(daftar: PeristiwaAntara[], pertama: number, terakhir: number) {
  if (pertama < 0 || terakhir < 0) return
  const a = daftar[pertama]
  const z = daftar[terakhir]
  if (a) a.tupletMulai = true
  if (z) z.tupletAkhir = true
}

function uraiChord(
  x: ElemenXml,
  kursor: number,
  div: number,
  _b: BiramaStaf,
  nominal: number,
): PeristiwaAntara | null {
  const tipeMs = (teksAnak(x, 'durationType') ?? 'quarter').trim()
  const titik = Math.max(0, angkaAnak(x, 'dots') ?? 0)
  const ev: PeristiwaAntara = {
    tick: kursor,
    dur: 0,
    jenis: x.nama === 'Rest' ? 'rest' : 'chord',
    titik,
    notes: [],
    artikulasi: [],
    fermata: false,
  }
  if (tipeMs === 'measure') {
    const d = pecahan(teksAnak(x, 'duration'))
    ev.dur = d != null ? d * 4 * div : nominal
    ev.utuh = true
  } else {
    const dasar = NILAI_PEREMPAT[tipeMs] ?? 1
    ev.tipe = tipeMs in NILAI_PEREMPAT ? tipeMs : 'quarter'
    ev.dur = dasar * div * (2 - Math.pow(0.5, titik))
  }
  if (anak(x, 'acciaccatura')) ev.grace = 'slash'
  else if (anak(x, 'appoggiatura') || anakElemen(x).some((c) => /^grace(4|8|16|32)(after)?$/.test(c.nama))) ev.grace = 'biasa'
  if (ev.grace) ev.dur = 0

  for (const a of anakElemen(x, 'Articulation')) {
    const sub = teksAnak(a, 'subtype') ?? ''
    const cocok = ARTIKULASI.find((r) => r.pola.test(sub))
    if (!cocok) continue
    if (cocok.jenis === 'fermata') ev.fermata = true
    else if (!ev.artikulasi.includes(cocok.xml)) ev.artikulasi.push(cocok.xml)
  }
  const trem = anak(x, 'TremoloSingleChord') ?? anak(x, 'Tremolo')
  if (trem) {
    const sub = teksAnak(trem, 'subtype') ?? ''
    const m = /r(8|16|32|64)/.exec(sub)
    if (m) ev.tremolo = { '8': 1, '16': 2, '32': 3, '64': 4 }[m[1] as '8' | '16' | '32' | '64']
    else if (/buzz/i.test(sub)) ev.tremolo = 3
  }

  for (const n of anakElemen(x, 'Note')) {
    const pitch = angkaAnak(n, 'pitch')
    if (pitch == null) continue
    let tieMulai = false
    let tieAkhir = false
    for (const sp of anakElemen(n, 'Spanner')) {
      if (sp.attr.type !== 'Tie') continue
      if (anak(sp, 'next') || anak(sp, 'Tie')) tieMulai = true
      if (anak(sp, 'prev')) tieAkhir = true
    }
    if (anak(n, 'Tie')) tieMulai = true
    if (anak(n, 'endSpanner')) tieAkhir = true
    ev.notes.push({
      pitch,
      tpc: angkaAnak(n, 'tpc'),
      tpc2: angkaAnak(n, 'tpc2'),
      tieMulai,
      tieAkhir,
      kepala: teksAnak(n, 'head') ?? undefined,
    })
  }
  if (ev.jenis === 'chord' && ev.notes.length === 0) ev.jenis = 'rest'
  return ev
}

function uraiSpanner(
  x: ElemenXml,
  m: number,
  kursor: number,
  b: BiramaStaf,
  stafPertama: boolean,
  tambahArah: (i: ItemArah) => void,
  _sebelumnya: BiramaStaf[],
  div: number,
) {
  const jenis = x.attr.type ?? ''
  const isi = anak(x, jenis)
  const next = anak(x, 'next')
  const prev = anak(x, 'prev')
  if (jenis === 'Volta' && stafPertama) {
    // Penutup (`<prev>`) diabaikan: panjang volta sudah diketahui dari `<next>`.
    if (isi && next) {
      const loc = anak(next, 'location')
      const ukuran = angkaAnak(loc, 'measures') ?? 1
      const frac = pecahan(teksAnak(loc, 'fractions')) ?? 0
      const panjang = Math.max(1, ukuran + (frac > 0 ? 1 : 0))
      const nomor = teksAnak(isi, 'endings') || '1'
      const teks = teksTampil(anak(isi, 'beginText')) || teksTampil(anak(isi, 'text'))
      b.voltaMulai = { nomor, teks }
      b.voltaAkhir = { m: m + panjang - 1, nomor, putus: (angkaAnak(isi, 'endHookType') ?? 0) === 0 }
    }
    return
  }
  if (jenis === 'Ottava') {
    if (isi && next) {
      const sub = (teksAnak(isi, 'subtype') ?? '8va').trim()
      const PETA: Record<string, number> = { '8va': 12, '0': 12, '8vb': -12, '1': -12, '15ma': 24, '2': 24, '15mb': -24, '3': -24, '22ma': 36, '4': 36, '22mb': -36, '5': -36 }
      const geser = PETA[sub] ?? 12
      const loc = anak(next, 'location')
      const ukuranM = angkaAnak(loc, 'measures') ?? 0
      const frac = pecahan(teksAnak(loc, 'fractions')) ?? 0
      const ukuran = Math.abs(geser) === 12 ? 8 : Math.abs(geser) === 24 ? 15 : 22
      ;(b.ottava ??= []).push({ geser, ukuran, mulaiTick: kursor, akhirM: m + ukuranM, akhirTick: kursor + frac * 4 * div })
      tambahArah({
        tick: kursor,
        jenis: 'xml',
        xml: `<direction placement="${geser > 0 ? 'above' : 'below'}"><direction-type><octave-shift type="${geser > 0 ? 'down' : 'up'}" size="${ukuran}"/></direction-type></direction>`,
        sistem: false,
      })
    }
    return
  }
  if (jenis === 'HairPin') {
    if (isi && next) {
      const sub = teksAnak(isi, 'subtype') ?? '0'
      tambahArah({ tick: kursor, jenis: 'xml', xml: xmlWedge(sub, true), sistem: false })
    } else if (prev && !isi) {
      tambahArah({ tick: kursor, jenis: 'xml', xml: xmlWedge('0', false), sistem: false })
    }
    return
  }
  if (jenis === 'GradualTempoChange' && stafPertama && isi && next) {
    const tipe = (teksAnak(isi, 'tempoChangeType') ?? '').toLowerCase()
    const kata = teksTampil(anak(isi, 'beginText')) || KATA_TEMPO_BERANGSUR[tipe] || 'rit.'
    tambahArah({
      tick: kursor,
      jenis: 'xml',
      xml: `<direction placement="above"><direction-type><words>${escapeXml(kata)}</words></direction-type></direction>`,
      sistem: true,
    })
  }
}

function xmlWedge(subtype: string | undefined, mulai: boolean): string {
  if (!mulai) return '<direction placement="below"><direction-type><wedge type="stop"/></direction-type></direction>'
  const cresc = (subtype ?? '0').trim() === '0' || /cresc/i.test(subtype ?? '')
  return `<direction placement="below"><direction-type><wedge type="${cresc ? 'crescendo' : 'diminuendo'}"/></direction-type></direction>`
}

function xmlTempo(qps: number | null, teks: string): string {
  const bpmPerempat = qps != null && qps > 0 ? qps * 60 : null
  const unit = unitTempoDariTeks(teks)
  const kata = kataTempo(teks)
  const bagian: string[] = []
  if (kata) bagian.push(`<direction-type><words>${escapeXml(kata)}</words></direction-type>`)
  if (bpmPerempat != null) {
    const u = unit ?? { unit: 'quarter', titik: false, perempat: 1 }
    const perMenit = bpmPerempat / u.perempat
    bagian.push(
      `<direction-type><metronome parentheses="no"><beat-unit>${u.unit}</beat-unit>${u.titik ? '<beat-unit-dot/>' : ''}<per-minute>${angkaTeks(perMenit)}</per-minute></metronome></direction-type>`,
    )
  }
  if (bagian.length === 0) bagian.push(`<direction-type><words>${escapeXml(teks || 'Tempo')}</words></direction-type>`)
  const suara = bpmPerempat != null ? `<sound tempo="${angkaTeks(bpmPerempat)}"/>` : ''
  return `<direction placement="above">${bagian.join('')}${suara}</direction>`
}

/* ------------------------------ Tulis part ------------------------------ */

function tulisPart(
  out: string[],
  p: PartAntara,
  biramaPerStaf: BiramaStaf[][],
  struktur: BiramaStaf[],
  jumlahBirama: number,
  panjangBirama: number[],
  nominalBirama: number[],
  divKeluar: number,
  t: (v: number) => number,
  _partPertama: boolean,
) {
  const kuinGeser = kuinTransposisi(p.diatonik, p.kromatik)
  const jumlahStaf = p.idxStaf.length
  let kunciAktif: number | null = null
  let waktuAktif: string | null = null
  const clefAktif: string[] = p.idxStaf.map(() => '')

  for (let m = 0; m < jumlahBirama; m += 1) {
    const sb = struktur[m]
    const L = panjangBirama[m]
    const implicit = (m === 0 && L < nominalBirama[m]) || sb?.irregular
    out.push(`    <measure number="${m + 1}"${implicit ? ' implicit="yes"' : ''}>`)

    // Barline kiri: ulang maju + awal volta.
    if (sb?.startRepeat || sb?.voltaMulai) {
      let isi = ''
      if (sb.startRepeat) isi += '<bar-style>heavy-light</bar-style>'
      if (sb.voltaMulai) {
        const nomor = sb.voltaMulai.nomor.replace(/\s+/g, ' ')
        const teks = sb.voltaMulai.teks || `${nomor}.`
        isi += `<ending number="${escapeXml(nomor)}" type="start">${escapeXml(teks)}</ending>`
      }
      if (sb.startRepeat) isi += '<repeat direction="forward"/>'
      out.push(`      <barline location="left">${isi}</barline>`)
    }

    // Atribut.
    const atr: string[] = []
    if (m === 0) atr.push(`<divisions>${divKeluar}</divisions>`)
    // Kunci nada (dari staf pertama part ini).
    const bPertama = biramaPerStaf[p.idxStaf[0]]?.[m]
    if (bPertama?.kunciNada || m === 0) {
      const konser: number = bPertama?.kunciNada?.fifths ?? kunciAktif ?? 0
      const tulis: number = p.perkusi ? 0 : rapikanKuin(konser - kuinGeser)
      if (tulis !== kunciAktif || m === 0) {
        const mode = bPertama?.kunciNada?.mode
        atr.push(`<key><fifths>${tulis}</fifths>${mode ? `<mode>${mode}</mode>` : ''}</key>`)
        kunciAktif = tulis
      }
    }
    const w = sb?.waktu ?? bPertama?.waktu
    if (w || m === 0) {
      const ww = w ?? { n: 4, d: 4 }
      const kunciW = `${ww.n}/${ww.d}/${ww.simbol ?? ''}`
      if (kunciW !== waktuAktif) {
        atr.push(`<time${ww.simbol ? ` symbol="${ww.simbol}"` : ''}><beats>${ww.n}</beats><beat-type>${ww.d}</beat-type></time>`)
        waktuAktif = kunciW
      }
    }
    if (m === 0 && jumlahStaf > 1) atr.push(`<staves>${jumlahStaf}</staves>`)
    p.idxStaf.forEach((si, s) => {
      const bs = biramaPerStaf[si]?.[m]
      const jenis = bs?.clefAwal ?? (m === 0 ? p.clefStaf[s] || (p.perkusi ? 'PERC' : 'G') : '')
      if (jenis && jenis !== clefAktif[s]) {
        atr.push(xmlClef(jenis, jumlahStaf > 1 ? s + 1 : 0))
        clefAktif[s] = jenis
      }
    })
    if (m === 0) {
      p.garisStaf.forEach((g, s) => {
        if (g !== 5) {
          atr.push(`<staff-details${jumlahStaf > 1 ? ` number="${s + 1}"` : ''}><staff-lines>${g}</staff-lines></staff-details>`)
        }
      })
      if (!p.perkusi && (p.kromatik !== 0 || p.diatonik !== 0)) {
        const okt = Math.trunc(p.kromatik / 12)
        const kr = p.kromatik - okt * 12
        const di = p.diatonik - okt * 7
        atr.push(
          `<transpose><diatonic>${di}</diatonic><chromatic>${kr}</chromatic>${okt !== 0 ? `<octave-change>${okt}</octave-change>` : ''}</transpose>`,
        )
      }
    }
    if (atr.length > 0) out.push(`      <attributes>${atr.join('')}</attributes>`)

    // Isi per staf.
    let posisi = 0
    p.idxStaf.forEach((si, s) => {
      const bs = biramaPerStaf[si]?.[m]
      const noStaf = jumlahStaf > 1 ? s + 1 : 0
      const arahStaf: ItemArah[] = []
      if (bs) for (const a of bs.arah) arahStaf.push(a)
      // Arah sistem (tempo, huruf latihan, lompatan) dari staf pertama skor → semua part.
      if (s === 0 && si !== 0) {
        const bAtas = biramaPerStaf[0]?.[m]
        if (bAtas) for (const a of bAtas.arah) if (a.jenis === 'xml' && a.sistem) arahStaf.push(a)
      }
      arahStaf.sort((a, b) => a.tick - b.tick)

      const suaraIsi = (bs?.suara ?? []).map((v, vi) => ({ v, vi })).filter((x) => x && x.v && x.v.peristiwa.length > 0)
      if (suaraIsi.length === 0) {
        // Staf kosong: istirahat satu birama.
        if (posisi > 0) out.push(`      <backup><duration>${posisi}</duration></backup>`)
        posisi = 0
        const sisa = tulisArahSampai(out, arahStaf, 0, posisi, t, noStaf)
        out.push(
          `      <note><rest measure="yes"/><duration>${t(L)}</duration><voice>${(noStaf ? noStaf - 1 : 0) * 4 + 1}</voice>${noStaf ? `<staff>${noStaf}</staff>` : ''}</note>`,
        )
        posisi = t(L)
        tulisArahSisa(out, sisa, posisi, t, noStaf)
        return
      }
      suaraIsi.forEach(({ v, vi }, urutan) => {
        if (posisi > 0) out.push(`      <backup><duration>${posisi}</duration></backup>`)
        posisi = 0
        let arahTertunda = urutan === 0 ? arahStaf : []
        const noSuara = (noStaf ? noStaf - 1 : 0) * 4 + vi + 1
        let i = 0
        while (i < v.peristiwa.length) {
          const ev = v.peristiwa[i]
          const mulai = t(ev.tick)
          if (mulai > posisi) {
            out.push(`      <forward><duration>${mulai - posisi}</duration><voice>${noSuara}</voice>${noStaf ? `<staff>${noStaf}</staff>` : ''}</forward>`)
            posisi = mulai
          }
          arahTertunda = tulisArahSampai(out, arahTertunda, ev.tick, posisi, t, noStaf)
          const dur = ev.utuh ? Math.max(t(ev.dur), 1) : t(ev.dur)
          tulisPeristiwa(out, ev, p, kuinGeser, dur, noSuara, noStaf)
          posisi += ev.grace ? 0 : dur
          i += 1
        }
        if (urutan === 0) tulisArahSisa(out, arahTertunda, posisi, t, noStaf)
      })
    })

    // Barline kanan: ulang mundur + akhir volta + gaya.
    const kanan: string[] = []
    if (sb?.endRepeat) kanan.push('<bar-style>light-heavy</bar-style>')
    else if (sb?.gayaBar === 'end') kanan.push('<bar-style>light-heavy</bar-style>')
    else if (sb?.gayaBar === 'double') kanan.push('<bar-style>light-light</bar-style>')
    else if (sb?.gayaBar === 'dashed') kanan.push('<bar-style>dashed</bar-style>')
    const vs = sb?.voltaSelesai
    if (vs) {
      kanan.push(`<ending number="${escapeXml(vs.nomor.replace(/\s+/g, ' '))}" type="${vs.putus && !sb?.endRepeat ? 'discontinue' : 'stop'}"/>`)
    }
    if (sb?.endRepeat) kanan.push(`<repeat direction="backward"${sb.endRepeat > 2 ? ` times="${sb.endRepeat}"` : ''}/>`)
    if (kanan.length > 0) out.push(`      <barline location="right">${kanan.join('')}</barline>`)
    out.push('    </measure>')
  }
}

function xmlClef(jenis: string, nomor: number): string {
  const k = kunciMusicXml(jenis)
  return `<clef${nomor ? ` number="${nomor}"` : ''}><sign>${k.sign}</sign>${k.line ? `<line>${k.line}</line>` : ''}${k.oktaf ? `<clef-octave-change>${k.oktaf}</clef-octave-change>` : ''}</clef>`
}

function tulisArahSampai(
  out: string[],
  daftar: ItemArah[],
  tickBatas: number,
  posisi: number,
  t: (v: number) => number,
  noStaf: number,
): ItemArah[] {
  const sisa: ItemArah[] = []
  for (const a of daftar) {
    if (a.tick <= tickBatas + 1e-9) tulisSatuArah(out, a, t(a.tick) - posisi, noStaf)
    else sisa.push(a)
  }
  return sisa
}

function tulisArahSisa(out: string[], daftar: ItemArah[], posisi: number, t: (v: number) => number, noStaf: number) {
  for (const a of daftar) tulisSatuArah(out, a, t(a.tick) - posisi, noStaf)
}

function tulisSatuArah(out: string[], a: ItemArah, offset: number, noStaf: number) {
  if (a.jenis === 'clef') {
    out.push(`      <attributes>${xmlClef(a.clef, noStaf)}</attributes>`)
    return
  }
  let xml = a.xml
  const sisip = `${offset !== 0 ? `<offset>${offset}</offset>` : ''}${noStaf ? `<staff>${noStaf}</staff>` : ''}`
  if (sisip) {
    // <offset> & <staff> berada setelah <direction-type> terakhir, sebelum <sound>.
    const idxSound = xml.lastIndexOf('<sound')
    const idxTutup = xml.lastIndexOf('</direction>')
    const pos = idxSound >= 0 ? idxSound : idxTutup
    xml = xml.slice(0, pos) + sisip + xml.slice(pos)
  }
  out.push(`      ${xml}`)
}

function tulisPeristiwa(
  out: string[],
  ev: PeristiwaAntara,
  p: PartAntara,
  kuinGeser: number,
  dur: number,
  noSuara: number,
  noStaf: number,
) {
  const stafXml = noStaf ? `<staff>${noStaf}</staff>` : ''
  const tm = ev.rasio && ev.rasio.aktual !== ev.rasio.normal
    ? `<time-modification><actual-notes>${ev.rasio.aktual}</actual-notes><normal-notes>${ev.rasio.normal}</normal-notes></time-modification>`
    : ''
  const titik = '<dot/>'.repeat(ev.titik)
  const tipe = ev.tipe ? `<type>${ev.tipe}</type>` : ''
  const graceXml = ev.grace === 'slash' ? '<grace slash="yes"/>' : ev.grace ? '<grace/>' : ''

  if (ev.jenis === 'rest') {
    out.push(
      `      <note>${ev.utuh ? '<rest measure="yes"/>' : '<rest/>'}<duration>${dur}</duration><voice>${noSuara}</voice>${ev.utuh ? '' : tipe + titik}${tm}${stafXml}${notasi(ev, null, true, true)}</note>`,
    )
    return
  }
  ev.notes.forEach((n, idx) => {
    const akor = idx > 0 ? '<chord/>' : ''
    let nada = ''
    let instrumen = ''
    let kepala = ''
    if (p.perkusi) {
      const d = p.drum.get(n.pitch)
      const baris = d?.baris ?? 4
      const indeks = 38 - baris // F5 = garis teratas paranada 5 garis
      const langkah = LANGKAH[((indeks % 7) + 7) % 7]
      const oktaf = Math.floor(indeks / 7)
      nada = `<unpitched><display-step>${langkah}</display-step><display-octave>${oktaf}</display-octave></unpitched>`
      instrumen = `<instrument id="${p.id}-I${n.pitch + 1}"/>`
      const kp = KEPALA_NOT[(n.kepala ?? d?.kepala ?? 'normal').toLowerCase()]
      if (kp) kepala = `<notehead>${kp}</notehead>`
    } else {
      const tertulis = n.pitch - p.kromatik
      const tpcT = n.tpc2 ?? (n.tpc != null ? n.tpc - kuinGeser : null)
      const e = ejaanNot(tertulis, tpcT != null && tpcT >= -1 && tpcT <= 33 ? tpcT : null)
      nada = `<pitch><step>${e.langkah}</step>${e.alter ? `<alter>${e.alter}</alter>` : ''}<octave>${e.oktaf}</octave></pitch>`
      const kp = n.kepala ? KEPALA_NOT[n.kepala.toLowerCase()] : undefined
      if (kp) kepala = `<notehead>${kp}</notehead>`
    }
    const durXml = ev.grace ? '' : `<duration>${dur}</duration>`
    const tie = `${n.tieAkhir ? '<tie type="stop"/>' : ''}${n.tieMulai ? '<tie type="start"/>' : ''}`
    out.push(
      `      <note>${graceXml}${akor}${nada}${durXml}${tie}${instrumen}<voice>${noSuara}</voice>${tipe}${titik}${tm}${kepala}${stafXml}${notasi(ev, n, idx === 0, false)}</note>`,
    )
  })
}

function notasi(ev: PeristiwaAntara, n: NotAntara | null, notPertama: boolean, istirahat: boolean): string {
  const isi: string[] = []
  if (n?.tieAkhir) isi.push('<tied type="stop"/>')
  if (n?.tieMulai) isi.push('<tied type="start"/>')
  if (notPertama) {
    if (ev.tupletMulai) isi.push('<tuplet type="start" bracket="yes"/>')
    if (ev.tupletAkhir) isi.push('<tuplet type="stop"/>')
    if (ev.fermata) isi.push('<fermata type="upright"/>')
    if (!istirahat && ev.artikulasi.length > 0) isi.push(`<articulations>${ev.artikulasi.join('')}</articulations>`)
    if (!istirahat && ev.tremolo) isi.push(`<ornaments><tremolo type="single">${ev.tremolo}</tremolo></ornaments>`)
  }
  return isi.length > 0 ? `<notations>${isi.join('')}</notations>` : ''
}

/* ---------------------------- Pintu masuk ------------------------------- */

const enkoder = new TextEncoder()

/**
 * Buka berkas MuseScore — `.mscz` (arsip ZIP) atau `.mscx` (teks) — lalu
 * terjemahkan ke MusicXML. Jenisnya ditentukan dari **isi**, bukan ekstensi.
 */
export async function uraiMuseScore(bita: Uint8Array): Promise<HasilUraiMuseScore> {
  try {
    if (bita.length === 0) return { ok: false, alasan: 'berkas MuseScore kosong (0 bita)' }
    if (bita.length > BATAS_BITA) {
      return { ok: false, alasan: `berkas MuseScore melebihi batas ${Math.round(BATAS_BITA / (1024 * 1024))} MB` }
    }
    let teks: string
    let asal: 'mscz' | 'mscx'
    let jalurUtama: string | undefined
    if (apakahArsipMuseScore(bita)) {
      const buka = await bukaEntriUtamaArsip(bita, { utamakan: /\.mscx$/i, label: '.mscz' })
      if (!buka.ok) return buka
      teks = teksPartitur(buka.bita)
      asal = 'mscz'
      jalurUtama = buka.jalur
    } else {
      teks = teksPartitur(bita)
      asal = 'mscx'
    }
    const hasil = konversiMscxKeMusicXml(teks)
    if (!hasil.ok) return hasil
    const { xml, ...info } = hasil
    return { ...info, ok: true, bitaXml: enkoder.encode(xml), asal, jalurUtama }
  } catch (e) {
    return { ok: false, alasan: `gagal membuka berkas MuseScore: ${e instanceof Error ? e.message : String(e)}` }
  }
}
