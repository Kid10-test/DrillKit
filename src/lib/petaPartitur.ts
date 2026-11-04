/**
 * #27 — 1-Klik "Tarik Peta Birama, Sukat, Tempo, Repeat/Volta, & Huruf
 * Latihan dari Partitur" → `Song.tempoMap`.
 *
 * Modul **murni** (tanpa React/Dexie, diuji di Node lewat
 * `qa/peta-partitur-logika.mjs`) dan dimuat malas oleh `ModalTarikPeta`.
 * Masukannya MusicXML yang sudah tersimpan di `partiturBerkas` — termasuk
 * hasil konversi `.mscz`/`.mscx` (`mscz.ts`) — keluarannya usulan baris
 * `TempoSegment` (tanpa `id`) yang **dipratinjau dulu** sebelum disimpan.
 *
 * Yang ditarik:
 * - huruf latihan `<rehearsal>` (`A`, `B`, *Intro*, *Closer*) → label segmen;
 * - perubahan sukat `<time>` → `TempoSegment.birama` (birama gantung/pickup
 *   menjadi sukat pendek tersendiri, supaya hitungan metronom tidak bergeser);
 * - perubahan tempo `<metronome>`/`<sound tempo>` → BPM segmen dengan acuan
 *   not yang sama dengan partitur (mis. ♩. = 80 di 6/8);
 * - *rit./rall./accel./string.* menuju tanda tempo berikutnya → luncuran
 *   eksplisit `rampCounts` (`TempoTimeline`), *a tempo* atau *Tempo I* → kembali;
 * - tanda ulang `‖: :‖` & volta 1–2 → batas segmen bercatatan, dan bila
 *   diminta **dibentangkan** menjadi urutan main (birama main 1..N).
 *
 * D.S./D.C./Coda tidak dibentangkan otomatis (disebut di `peringatan`).
 */
import type { TempoSegment } from '../db/types'
import { biramaBaku, type AcuanTempo, type NilaiNot, type TandaBirama } from './birama'
import { anak, anakElemen, teksDalam, uraiXmlRingan, type ElemenXml } from './xmlRingan'

/* --------------------------------- Tipe --------------------------------- */

export type UsulanSegmen = Omit<TempoSegment, 'id'>

export interface RentangUlang {
  /** Birama partitur (1-based) awal & akhir bagian yang diulang. */
  dari: number
  sampai: number
  kali: number
  /** Volta di dalam/akhir bagian ini, mis. `[{ nomor: '1', dari: 11, sampai: 12 }]`. */
  volta: { nomor: string; dari: number; sampai: number }[]
}

export interface HasilTarikPeta {
  ok: true
  /** Jumlah birama di partitur. */
  jumlahBiramaPartitur: number
  /** Panjang lagu dalam birama metronom (= urutan main bila dibentangkan). */
  panjangBirama: number
  dibentangkan: boolean
  /** Urutan birama partitur yang dimainkan (1-based). */
  urutanMain: number[]
  tandaBiramaAwal: TandaBirama
  bpmAwal: number
  segmen: UsulanSegmen[]
  ulangan: RentangUlang[]
  hurufLatihan: { birama: number; teks: string }[]
  peringatan: string[]
}

export type HasilTarikPetaAtauGagal = HasilTarikPeta | { ok: false; alasan: string }

export interface OpsiTarikPeta {
  /** Bentangkan tanda ulang & volta menjadi urutan main. Bawaan `false`. */
  bentangkanUlang?: boolean
  /** BPM bila partitur tidak menyebut tempo sama sekali. Bawaan 120. */
  bpmCadangan?: number
}

/* ------------------------------ Model antara ---------------------------- */

interface TempoPeristiwa {
  /** posisi dalam not seperempat dari awal birama */
  q: number
  bpmPerempat: number
  unit?: AcuanTempo
}

interface KataPeristiwa {
  q: number
  jenis: 'rit' | 'accel' | 'atempo' | 'tempo1'
  teks: string
}

interface InfoBirama {
  no: number
  beats: number
  beatType: number
  /** panjang aktual birama dalam not seperempat */
  panjangQ: number
  implicit: boolean
  tempo: TempoPeristiwa[]
  kata: KataPeristiwa[]
  huruf: { q: number; teks: string }[]
  ulangAwal: boolean
  ulangAkhir: number
  endingMulai?: string
  endingSelesai?: string
  lompat: boolean
}

const UNIT_NILAI: Record<string, NilaiNot> = { whole: 1, half: 2, quarter: 4, eighth: 8, '16th': 16, '32nd': 32 }

function angka(teks: string | null | undefined): number | null {
  if (teks == null) return null
  const v = Number(String(teks).trim())
  return Number.isFinite(v) ? v : null
}

function teksAnakL(el: ElemenXml | null | undefined, nama: string): string | null {
  const a = anak(el, nama)
  return a ? teksDalam(a).trim() : null
}

function quarterPerAcuan(a: AcuanTempo): number {
  return (4 / a.nilai) * (a.titik ? 1.5 : 1)
}

function bulatBpm(v: number): number {
  const r = Math.round(v)
  return Math.abs(v - r) < 0.05 ? r : Math.round(v * 10) / 10
}

/** Teks lompatan yang tidak dibentangkan (D.S./D.C./To Coda/Fine-jump). */
const POLA_LOMPAT = /(^|\s)(d\.\s?s\.|d\.\s?c\.|dal segno|da capo|to coda)/i

function jenisKata(teks: string): KataPeristiwa['jenis'] | null {
  const t = teks.toLowerCase().replace(/\s+/g, ' ').trim()
  if (/^(a tempo|tempo primo|tempo i\b|tempo 1\b)/.test(t)) return /primo|tempo (i|1)\b/.test(t) ? 'tempo1' : 'atempo'
  if (/\b(rit|ritard|ritardando|rall|rallentando|allarg|allargando|calando|morendo|slentando|riten)\b\.?/.test(t)) return 'rit'
  if (/\b(accel|accelerando|string|stringendo|poco a poco accel)\b\.?/.test(t)) return 'accel'
  return null
}

/* ------------------------------- Pindai --------------------------------- */

function pindaiBirama(akar: ElemenXml): { info: InfoBirama[]; peringatan: string[] } {
  const peringatan: string[] = []
  const partwise = akar.nama === 'score-partwise'
  // Daftar birama per part (partwise) atau part per birama (timewise).
  const perPart: ElemenXml[][] = []
  if (partwise) {
    for (const p of anakElemen(akar, 'part')) perPart.push(anakElemen(p, 'measure'))
  } else {
    const ukuran = anakElemen(akar, 'measure')
    const idPart: string[] = []
    for (const m of ukuran) for (const p of anakElemen(m, 'part')) if (!idPart.includes(p.attr.id ?? '')) idPart.push(p.attr.id ?? '')
    idPart.forEach((id) => perPart.push(ukuran.map((m) => anakElemen(m, 'part').find((p) => (p.attr.id ?? '') === id) ?? { nama: 'measure', attr: {}, isi: [] })))
  }
  const jumlah = perPart.reduce((m, d) => Math.max(m, d.length), 0)
  const info: InfoBirama[] = []
  for (let i = 0; i < jumlah; i += 1) {
    info.push({
      no: i + 1,
      beats: 0,
      beatType: 0,
      panjangQ: 0,
      implicit: false,
      tempo: [],
      kata: [],
      huruf: [],
      ulangAwal: false,
      ulangAkhir: 0,
      lompat: false,
    })
  }

  perPart.forEach((daftar, pi) => {
    let div = 1
    daftar.forEach((mEl, i) => {
      const inf = info[i]
      let kursor = 0
      let maks = 0
      let mulaiSebelum = 0
      if (pi === 0 && mEl.attr.implicit === 'yes') inf.implicit = true
      for (const x of mEl.isi) {
        if (typeof x === 'string') continue
        if (x.nama === 'attributes') {
          const d = angka(teksAnakL(x, 'divisions'))
          if (d && d > 0) div = d
          const t = anak(x, 'time')
          if (t && !inf.beats) {
            const b = angka(teksAnakL(t, 'beats')?.split('+').reduce((a, c) => String(Number(a) + Number(c))) ?? null)
            const bt = angka(teksAnakL(t, 'beat-type'))
            if (b && bt) {
              inf.beats = b
              inf.beatType = bt
            }
          }
        } else if (x.nama === 'note') {
          if (anak(x, 'grace')) continue
          const dur = (angka(teksAnakL(x, 'duration')) ?? 0) / div
          if (anak(x, 'chord')) {
            maks = Math.max(maks, mulaiSebelum + dur)
            continue
          }
          mulaiSebelum = kursor
          kursor += dur
          maks = Math.max(maks, kursor)
        } else if (x.nama === 'backup') {
          kursor = Math.max(0, kursor - (angka(teksAnakL(x, 'duration')) ?? 0) / div)
        } else if (x.nama === 'forward') {
          kursor += (angka(teksAnakL(x, 'duration')) ?? 0) / div
          maks = Math.max(maks, kursor)
        } else if (x.nama === 'direction') {
          const offset = (angka(teksAnakL(x, 'offset')) ?? 0) / div
          const q = Math.max(0, kursor + offset)
          for (const dt of anakElemen(x, 'direction-type')) {
            for (const r of anakElemen(dt, 'rehearsal')) {
              const teks = teksDalam(r).trim()
              if (teks && !inf.huruf.some((h) => h.teks === teks)) inf.huruf.push({ q, teks })
            }
            for (const w of anakElemen(dt, 'words')) {
              const teks = teksDalam(w).trim()
              const jk = teks ? jenisKata(teks) : null
              if (teks && POLA_LOMPAT.test(teks)) inf.lompat = true
              if (jk && !inf.kata.some((k) => k.jenis === jk && Math.abs(k.q - q) < 1e-6)) inf.kata.push({ q, jenis: jk, teks })
            }
            const met = anak(dt, 'metronome')
            if (met) {
              const pm = angka(teksAnakL(met, 'per-minute'))
              const unitNama = teksAnakL(met, 'beat-unit') ?? 'quarter'
              const nilai = UNIT_NILAI[unitNama]
              if (pm && pm > 0 && nilai) {
                const unit: AcuanTempo = { nilai, titik: !!anak(met, 'beat-unit-dot') }
                tambahTempo(inf, { q, bpmPerempat: pm * quarterPerAcuan(unit), unit })
              }
            }
          }
          const snd = anak(x, 'sound')
          if (snd) {
            const tq = angka(snd.attr.tempo)
            if (tq && tq > 0) tambahTempo(inf, { q, bpmPerempat: tq })
            if (snd.attr.dacapo || snd.attr.dalsegno || snd.attr.tocoda) inf.lompat = true
          }
        } else if (x.nama === 'sound') {
          const tq = angka(x.attr.tempo)
          if (tq && tq > 0) tambahTempo(inf, { q: kursor, bpmPerempat: tq })
          if (x.attr.dacapo || x.attr.dalsegno || x.attr.tocoda) inf.lompat = true
        } else if (x.nama === 'barline' && pi === 0) {
          const rep = anak(x, 'repeat')
          if (rep?.attr.direction === 'forward') inf.ulangAwal = true
          if (rep?.attr.direction === 'backward') inf.ulangAkhir = Math.max(2, Number(rep.attr.times) || 2)
          const end = anak(x, 'ending')
          if (end) {
            const nomor = (end.attr.number ?? '1').trim()
            if (end.attr.type === 'start') inf.endingMulai = nomor
            else if (end.attr.type === 'stop' || end.attr.type === 'discontinue') inf.endingSelesai = nomor
          }
        }
      }
      if (pi === 0) inf.panjangQ = maks
    })
  })

  // Sukat berlaku & panjang aktual.
  let beats = 4
  let beatType = 4
  for (const inf of info) {
    if (inf.beats) {
      beats = inf.beats
      beatType = inf.beatType
    } else {
      inf.beats = beats
      inf.beatType = beatType
    }
    const nominal = (beats * 4) / beatType
    if (inf.panjangQ <= 0 || inf.panjangQ > nominal + 1e-6 || (!inf.implicit && inf.no !== 1)) inf.panjangQ = nominal
    if (inf.panjangQ < nominal - 1e-6 && !inf.implicit && inf.no !== 1) inf.panjangQ = nominal
    inf.tempo.sort((a, b) => a.q - b.q)
    inf.kata.sort((a, b) => a.q - b.q)
  }
  if (info.some((i) => i.lompat)) {
    peringatan.push('Partitur memuat D.S./D.C./Coda — lompatan itu tidak dibentangkan otomatis; tambahkan segmennya manual bila perlu.')
  }
  return { info, peringatan }
}

function tambahTempo(inf: InfoBirama, t: TempoPeristiwa) {
  const sama = inf.tempo.find((x) => Math.abs(x.q - t.q) < 1e-6)
  if (sama) {
    // `<metronome>` (punya unit) dan `<sound tempo>` di satu arah → gabung.
    if (!sama.unit && t.unit) sama.unit = t.unit
    return
  }
  inf.tempo.push(t)
}

/* --------------------------- Urutan main -------------------------------- */

function bentangUrutan(info: InfoBirama[]): { urutan: number[]; ulangan: RentangUlang[] } {
  const n = info.length
  // Rentang ending (volta) per birama.
  const endingDi: (string[] | null)[] = new Array(n).fill(null)
  let aktif: string | null = null
  info.forEach((inf, i) => {
    if (inf.endingMulai) aktif = inf.endingMulai
    if (aktif) endingDi[i] = aktif.split(/[,\s]+/).filter(Boolean)
    if (inf.endingSelesai) aktif = null
  })

  // Rentang ulang untuk ringkasan.
  const ulangan: RentangUlang[] = []
  let awal = 0
  info.forEach((inf, i) => {
    if (inf.ulangAwal) awal = i
    if (inf.ulangAkhir) {
      const volta: RentangUlang['volta'] = []
      // volta yang menempel di akhir bagian ini (mundur dari i, lalu maju setelahnya)
      let j = i
      while (j > awal && endingDi[j] && endingDi[j - 1] && endingDi[j - 1]!.join() === endingDi[j]!.join()) j -= 1
      if (endingDi[i]) {
        volta.push({ nomor: endingDi[i]!.join(', '), dari: j + 1, sampai: i + 1 })
        let k = i + 1
        while (k < n && endingDi[k]) {
          const nomor = endingDi[k]!.join(', ')
          const mulai = k
          while (k + 1 < n && endingDi[k + 1] && endingDi[k + 1]!.join() === endingDi[k]!.join() && !info[k + 1].endingMulai) k += 1
          volta.push({ nomor, dari: mulai + 1, sampai: k + 1 })
          k += 1
        }
      }
      ulangan.push({ dari: awal + 1, sampai: i + 1, kali: inf.ulangAkhir, volta })
      awal = i + 1
    }
  })

  const urutan: number[] = []
  const hitungUlang = new Map<number, number>()
  let dari = 0
  let lintasan = 1
  let i = 0
  let jaga = 0
  let sebelumnyaEnding = false
  const batas = Math.max(64, n * 24)
  while (i < n && jaga < batas) {
    jaga += 1
    const inf = info[i]
    if (inf.ulangAwal && dari !== i) {
      dari = i
      lintasan = 1
    }
    const ending = endingDi[i]
    if (ending) {
      sebelumnyaEnding = true
      const cocok = ending.some((e) => Number(e) === lintasan)
      if (!cocok) {
        i += 1
        continue
      }
    } else if (sebelumnyaEnding) {
      sebelumnyaEnding = false
      lintasan = 1
    }
    urutan.push(i + 1)
    if (inf.ulangAkhir) {
      const sudah = hitungUlang.get(i) ?? 0
      if (sudah < inf.ulangAkhir - 1) {
        hitungUlang.set(i, sudah + 1)
        lintasan = sudah + 2
        sebelumnyaEnding = false
        i = dari
        continue
      }
      hitungUlang.set(i, 0)
      dari = i + 1
      if (!ending) lintasan = 1
    }
    i += 1
  }
  return { urutan, ulangan }
}

/* ------------------------------ Tarik ----------------------------------- */

/** Rentang BPM yang diterima editor tempo map & `TempoTimeline`. */
const BPM_MIN = 20
const BPM_MAKS = 400

/**
 * Satuan BPM segmen: satuan tanda metronom bila cocok dengan sukatnya,
 * selain itu acuan bawaan `biramaBaku`.
 * - majemuk (6/8, 9/8, 12/8, 6/4 …): ketuk bertitik (♩. di x/8) atau satuan penyebut;
 * - sederhana ber-penyebut ≤ 4 (2/4, 3/4, 4/4, 2/2 …): satuan tanpa titik apa pun;
 * - lainnya (5/8, 7/8, x/16): hanya satuan penyebut tanpa titik.
 */
function acuanUntuk(beats: number, beatType: number, unit?: AcuanTempo): AcuanTempo {
  if (unit) {
    const majemuk = beats % 3 === 0 && beats > 3 && beatType >= 4
    if (majemuk) {
      if ((unit.titik && unit.nilai * 2 === beatType) || (!unit.titik && unit.nilai === beatType)) return unit
    } else if (beatType <= 4) {
      if (!unit.titik) return unit
    } else if (!unit.titik && unit.nilai === beatType) {
      return unit
    }
  }
  return biramaBaku(beats, beatType).acuan
}

function labelSukat(t: TandaBirama): string {
  return `${t.pembilang}/${t.penyebut}`
}

/**
 * Tarik usulan tempo map dari teks MusicXML. Tidak menulis apa pun.
 */
export function tarikPetaPartitur(xml: string, opsi: OpsiTarikPeta = {}): HasilTarikPetaAtauGagal {
  let akar: ElemenXml
  try {
    akar = uraiXmlRingan(xml)
  } catch (e) {
    return { ok: false, alasan: `MusicXML tidak bisa diurai: ${e instanceof Error ? e.message : String(e)}` }
  }
  if (akar.nama !== 'score-partwise' && akar.nama !== 'score-timewise') {
    return { ok: false, alasan: `elemen akar <${akar.nama}>, bukan <score-partwise>/<score-timewise>` }
  }
  const { info, peringatan } = pindaiBirama(akar)
  if (info.length === 0) return { ok: false, alasan: 'partitur tidak memuat satu birama pun' }

  const { urutan: urutanBentang, ulangan } = bentangUrutan(info)
  const bentang = !!opsi.bentangkanUlang && ulangan.length > 0
  const urutan = bentang ? urutanBentang : info.map((i) => i.no)
  const bpmCadangan = opsi.bpmCadangan && opsi.bpmCadangan > 0 ? opsi.bpmCadangan : 120
  if (!info.some((x) => x.tempo.length > 0)) {
    peringatan.push(`Partitur tidak memuat tanda tempo — dipakai ${bpmCadangan} ketuk ♩/menit; sesuaikan BPM-nya bila perlu.`)
  }

  // Tempo berlaku di awal tiap birama (urutan partitur) — tempat kembali saat mengulang.
  const tempoAwalBirama: { q: number; unit?: AcuanTempo }[] = []
  {
    let q = info.find((x) => x.tempo.length > 0)?.tempo[0]?.bpmPerempat ?? bpmCadangan
    let unit = info.find((x) => x.tempo.length > 0)?.tempo[0]?.unit
    for (const inf of info) {
      tempoAwalBirama.push({ q, unit })
      for (const t of inf.tempo) {
        q = t.bpmPerempat
        if (t.unit) unit = t.unit
      }
    }
  }

  // Sukat efektif per birama partitur (birama gantung → sukat pendek).
  const sukatEfektif = info.map((inf) => {
    const nominal = (inf.beats * 4) / inf.beatType
    if (inf.panjangQ < nominal - 1e-6) {
      // Cari penyebut terkecil yang membuat panjangnya utuh: ketukan ⅛ di
      // 4/4 → 1/8, triol tidak bisa dinyatakan → birama penuh + peringatan.
      for (let pen = inf.beatType; pen <= 64; pen *= 2) {
        const pembilang = (inf.panjangQ * pen) / 4
        if (pembilang >= 1 - 1e-6 && Math.abs(pembilang - Math.round(pembilang)) < 1e-3) {
          return { beats: Math.round(pembilang), beatType: pen, gantung: true }
        }
      }
      peringatan.push(`Birama ${inf.no} lebih pendek dari sukatnya tapi panjangnya tidak bisa dinyatakan sebagai sukat — dihitung penuh.`)
    }
    return { beats: inf.beats, beatType: inf.beatType, gantung: false }
  })

  interface Calon {
    measure: number
    beat: number
    subdivision?: number
    subdivisionsPerBeat?: number
    alasan: Set<string>
    label?: string
    catatan: string[]
    bpmPerempat?: number
    unit?: AcuanTempo
    sukat?: { beats: number; beatType: number }
    /** Label cadangan dari kata tempo (mis. "accel." tanpa tujuan). */
    labelKata?: string
    ramp?: { counts: number; targetPerempat: number; targetUnit?: AcuanTempo; dariPerempat: number; kata: string }
  }
  const calon: Calon[] = []
  const ambilCalon = (measure: number, beat = 1, sub?: { s: number; per: number }): Calon => {
    let c = calon.find((x) => x.measure === measure && x.beat === beat && (x.subdivision ?? 1) === (sub?.s ?? 1))
    if (!c) {
      c = { measure, beat, alasan: new Set(), catatan: [] }
      if (sub && sub.s > 1) {
        c.subdivision = sub.s
        c.subdivisionsPerBeat = sub.per
      }
      calon.push(c)
    }
    return c
  }

  // Posisi (birama main, ketuk) dari q di dalam birama.
  const posisiKetuk = (q: number, beatType: number): { beat: number; sub?: { s: number; per: number } } => {
    const ketukQ = 4 / beatType
    const pos = q / ketukQ
    const beat = Math.floor(pos + 1e-6) + 1
    const sisa = pos - (beat - 1)
    if (sisa < 1e-3) return { beat }
    for (const per of [2, 3, 4]) {
      const s = Math.round(sisa * per)
      if (Math.abs(sisa * per - s) < 1e-3 && s > 0 && s < per) return { beat, sub: { s: s + 1, per } }
    }
    return { beat }
  }

  // Posisi absolut dalam ketuk tertulis (untuk menghitung panjang luncuran).
  const awalKetukMain: number[] = []
  {
    let acc = 0
    urutan.forEach((no) => {
      awalKetukMain.push(acc)
      const s = sukatEfektif[no - 1]
      acc += s.beats
    })
  }

  const hurufLatihan: { birama: number; teks: string }[] = []
  let tempoBerjalanQ = tempoAwalBirama[0].q
  let unitBerjalan = tempoAwalBirama[0].unit
  let tempoSebelumUbah = tempoBerjalanQ
  const tempoPertamaQ = tempoBerjalanQ
  const unitPertama = unitBerjalan
  let sukatSebelum = ''
  const kunjungan = new Map<number, number>()
  let rampSampaiKetuk = -1

  urutan.forEach((no, idxMain) => {
    const inf = info[no - 1]
    const pMain = idxMain + 1
    const ke = (kunjungan.get(no) ?? 0) + 1
    kunjungan.set(no, ke)
    const s = sukatEfektif[no - 1]
    const kunciSukat = `${s.beats}/${s.beatType}`
    const ketukAwal = awalKetukMain[idxMain]
    const dalamRamp = ketukAwal < rampSampaiKetuk

    // Lompat balik saat mengulang → tempo kembali ke tempo tertulis di birama itu.
    if (bentang && idxMain > 0 && urutan[idxMain - 1] !== no - 1) {
      const t = tempoAwalBirama[no - 1]
      if (Math.abs(t.q - tempoBerjalanQ) > 0.01) {
        const c = ambilCalon(pMain)
        c.alasan.add('tempo')
        c.bpmPerempat = t.q
        c.unit = t.unit
        tempoBerjalanQ = t.q
        if (t.unit) unitBerjalan = t.unit
      }
    }

    if (kunciSukat !== sukatSebelum) {
      const c = ambilCalon(pMain)
      c.alasan.add('sukat')
      c.sukat = { beats: s.beats, beatType: s.beatType }
      if (s.gantung) c.catatan.push('birama gantung (pickup)')
      else if (sukatSebelum) c.catatan.push(`sukat ${kunciSukat}`)
      if (dalamRamp && idxMain > 0) peringatan.push(`Sukat berubah di tengah luncuran tempo (birama ${pMain}) — periksa luncurannya.`)
      sukatSebelum = kunciSukat
    }

    // Tanda ulang & volta sebagai batas segmen bercatatan.
    const r = ulangan.find((u) => u.dari === no)
    if (r) {
      const c = ambilCalon(pMain)
      c.alasan.add('ulang')
      c.catatan.push(bentang ? `‖: ulangan ${ke}/${r.kali} (partitur ${r.dari}–${r.sampai})` : `‖: ulang ×${r.kali} sampai birama ${r.sampai}`)
    }
    if (inf.endingMulai) {
      const c = ambilCalon(pMain)
      c.alasan.add('volta')
      c.catatan.push(`volta ${inf.endingMulai}`)
    }

    for (const h of inf.huruf) {
      const pos = posisiKetuk(h.q, s.beatType)
      const c = ambilCalon(pMain, pos.beat, pos.sub)
      c.alasan.add('huruf')
      const label = bentang && ke > 1 ? `${h.teks} (ulang)` : h.teks
      c.label = c.label ? `${c.label} / ${label}` : label
      if (!hurufLatihan.some((x) => x.teks === h.teks && x.birama === pMain)) hurufLatihan.push({ birama: pMain, teks: h.teks })
    }

    // Peristiwa tempo & kata di dalam birama, berurutan.
    const peristiwa: ({ q: number; tipe: 'tempo'; t: TempoPeristiwa } | { q: number; tipe: 'kata'; k: KataPeristiwa })[] = [
      ...inf.tempo.map((t) => ({ q: t.q, tipe: 'tempo' as const, t })),
      ...inf.kata.map((k) => ({ q: k.q, tipe: 'kata' as const, k })),
    ].sort((a, b) => a.q - b.q || (a.tipe === 'kata' ? 1 : -1))

    for (const ev of peristiwa) {
      const pos = posisiKetuk(ev.q, s.beatType)
      const ketukAbs = ketukAwal + (ev.q * s.beatType) / 4
      if (ev.tipe === 'tempo') {
        const t = ev.t
        if (ketukAbs < rampSampaiKetuk - 1e-6) continue
        if (Math.abs(t.bpmPerempat - tempoBerjalanQ) < 0.01 && !(idxMain === 0 && ev.q === 0)) {
          // Tempo sama, satuan beda (mis. ♩=120 → ♩.=80 saat masuk 6/8): BPM
          // segmen ikut satuan baru tanpa mengubah kecepatan sebenarnya.
          if (t.unit && (t.unit.nilai !== unitBerjalan?.nilai || t.unit.titik !== unitBerjalan?.titik)) {
            ambilCalon(pMain, pos.beat, pos.sub).unit = t.unit
          }
          if (t.unit) unitBerjalan = t.unit
          continue
        }
        const c = ambilCalon(pMain, pos.beat, pos.sub)
        if (!c.ramp) {
          c.alasan.add('tempo')
          c.bpmPerempat = t.bpmPerempat
          c.unit = t.unit ?? unitBerjalan
        }
        tempoSebelumUbah = tempoBerjalanQ
        tempoBerjalanQ = t.bpmPerempat
        if (t.unit) unitBerjalan = t.unit
        continue
      }
      // Kata tempo.
      const k = ev.k
      if (k.jenis === 'atempo' || k.jenis === 'tempo1') {
        const tujuan = k.jenis === 'tempo1' ? tempoPertamaQ : tempoSebelumUbah
        if (Math.abs(tujuan - tempoBerjalanQ) > 0.01) {
          const c = ambilCalon(pMain, pos.beat, pos.sub)
          c.alasan.add('tempo')
          c.bpmPerempat = tujuan
          c.unit = k.jenis === 'tempo1' ? unitPertama : unitBerjalan
          c.labelKata ??= k.teks
          tempoBerjalanQ = tujuan
        }
        continue
      }
      // rit./accel. → cari tanda tempo berikutnya di urutan main (≤ 16 birama).
      let target: { ketukAbs: number; t: TempoPeristiwa } | null = null
      for (let j = idxMain; j < urutan.length && j <= idxMain + 16 && !target; j += 1) {
        const infJ = info[urutan[j] - 1]
        const sJ = sukatEfektif[urutan[j] - 1]
        for (const t of infJ.tempo) {
          const abs = awalKetukMain[j] + (t.q * sJ.beatType) / 4
          if (abs > ketukAbs + 1e-6 && Math.abs(t.bpmPerempat - tempoBerjalanQ) > 0.01) {
            target = { ketukAbs: abs, t }
            break
          }
        }
        // Huruf latihan baru tanpa tempo = luncuran berakhir tanpa tujuan.
      }
      if (!target) {
        peringatan.push(`"${k.teks}" di birama ${pMain} tanpa tanda tempo tujuan sesudahnya — atur luncurannya manual.`)
        const c = ambilCalon(pMain, pos.beat, pos.sub)
        c.alasan.add('kata')
        c.labelKata ??= k.teks
        c.catatan.push('tujuan tempo belum diketahui — atur luncurannya manual')
        continue
      }
      const counts = Math.max(1, Math.round(target.ketukAbs - ketukAbs))
      const c = ambilCalon(pMain, pos.beat, pos.sub)
      // Titik awal luncuran selalu ditulis eksplisit (`rampFromBpm`) supaya
      // tidak bergantung pada satuan BPM segmen sebelumnya.
      const dariPerempat = c.bpmPerempat != null && !c.ramp ? c.bpmPerempat : tempoBerjalanQ
      c.alasan.add('ramp')
      c.ramp = {
        counts,
        targetPerempat: target.t.bpmPerempat,
        targetUnit: target.t.unit ?? unitBerjalan,
        dariPerempat,
        kata: k.teks,
      }
      c.bpmPerempat = target.t.bpmPerempat
      c.unit = target.t.unit ?? unitBerjalan
      tempoSebelumUbah = tempoBerjalanQ
      tempoBerjalanQ = target.t.bpmPerempat
      if (target.t.unit) unitBerjalan = target.t.unit
      rampSampaiKetuk = target.ketukAbs
    }
  })

  // Susun segmen: sukat & tempo berjalan sepanjang urutan calon.
  calon.sort((a, b) => a.measure - b.measure || a.beat - b.beat || (a.subdivision ?? 1) - (b.subdivision ?? 1))
  // Pastikan ada calon di birama 1 ketuk 1.
  if (!calon.some((c) => c.measure === 1 && c.beat === 1 && (c.subdivision ?? 1) === 1)) {
    calon.unshift({ measure: 1, beat: 1, alasan: new Set(['awal']), catatan: [] })
  }
  let sukat = { beats: sukatEfektif[urutan[0] - 1].beats, beatType: sukatEfektif[urutan[0] - 1].beatType }
  let qAktif = tempoPertamaQ
  let unitAktif = unitPertama
  const segmen: UsulanSegmen[] = []
  let nomorSegmen = 0
  for (const c of calon) {
    if (c.sukat) sukat = c.sukat
    if (c.bpmPerempat != null) qAktif = c.bpmPerempat
    if (c.unit) unitAktif = c.unit
    let acuan = acuanUntuk(sukat.beats, sukat.beatType, unitAktif)
    let bpm = bulatBpm(qAktif / quarterPerAcuan(acuan))
    if (bpm < BPM_MIN || bpm > BPM_MAKS) {
      // Satuan tanda yang tak lazim (mis. ♬=936) → pakai acuan bawaan sukat.
      const baku = biramaBaku(sukat.beats, sukat.beatType).acuan
      const bpmBaku = bulatBpm(qAktif / quarterPerAcuan(baku))
      if (bpmBaku >= BPM_MIN && bpmBaku <= BPM_MAKS) {
        acuan = baku
        bpm = bpmBaku
      } else {
        const jepit = Math.min(BPM_MAKS, Math.max(BPM_MIN, bpmBaku))
        peringatan.push(`Tempo di birama ${c.measure} (${bpmBaku} BPM) di luar ${BPM_MIN}–${BPM_MAKS} — dijepit ke ${jepit}.`)
        acuan = baku
        bpm = jepit
      }
    }
    const birama = biramaBaku(sukat.beats, sukat.beatType, acuan)
    nomorSegmen += 1
    const labelDasar =
      c.label ??
      (c.measure === 1 && c.beat === 1
        ? 'Awal'
        : c.alasan.has('ramp')
          ? (c.ramp?.kata ?? 'Luncur')
          : c.alasan.has('volta')
            ? c.catatan.find((x) => x.startsWith('volta'))!.replace('volta', 'Volta')
            : c.alasan.has('ulang')
              ? 'Ulang ‖:'
              : c.alasan.has('tempo')
                ? (c.labelKata ?? `Tempo ${bpm}`)
                : c.alasan.has('sukat')
                  ? `Sukat ${labelSukat(birama)}`
                  : (c.labelKata ?? `Segmen ${nomorSegmen}`))
    const seg: UsulanSegmen = {
      label: labelDasar,
      measure: c.measure,
      bpm,
      beats: birama.pembilang,
      birama,
    }
    if (c.beat > 1 || c.subdivision) seg.beat = c.beat
    if (c.subdivision) {
      seg.subdivision = c.subdivision
      seg.subdivisionsPerBeat = c.subdivisionsPerBeat
    }
    if (c.ramp) {
      seg.rampCounts = c.ramp.counts
      seg.rampUnit = 'beat'
      seg.rampFromBpm = Math.min(BPM_MAKS, Math.max(BPM_MIN, bulatBpm(c.ramp.dariPerempat / quarterPerAcuan(acuan))))
      c.catatan.unshift(`${c.ramp.kata} ${seg.rampFromBpm} → ${bpm} BPM dalam ${c.ramp.counts} ketuk`)
    }
    const catatan = [...new Set(c.catatan)].filter((x) => x && x !== labelDasar)
    if (bentang) {
      const no = urutan[c.measure - 1]
      if (no !== c.measure) catatan.push(`partitur b. ${no}`)
    }
    if (catatan.length > 0) seg.note = catatan.join(' · ')
    segmen.push(seg)
  }

  // Sukat & BPM lagu diambil dari birama utuh pertama — birama gantung
  // (pickup) cukup menjadi segmen pendek sendiri.
  const idxUtuh = urutan.findIndex((no) => !sukatEfektif[no - 1].gantung)
  const biramaUtuh = idxUtuh >= 0 ? idxUtuh + 1 : 1
  const awal = [...segmen].reverse().find((sg) => sg.measure <= biramaUtuh) ?? segmen[0]
  return {
    ok: true,
    jumlahBiramaPartitur: info.length,
    panjangBirama: urutan.length,
    dibentangkan: bentang,
    urutanMain: urutan,
    tandaBiramaAwal: awal.birama!,
    bpmAwal: awal.bpm,
    segmen,
    ulangan,
    hurufLatihan,
    peringatan,
  }
}
