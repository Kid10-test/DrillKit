/**
 * #28 — Studio Perkusi (*Battery & Pit*): penyerapan otomatis *sticking* &
 * artikulasi *Muse Drumline* dari MusicXML, plus lapisan revisi lapangan
 * non-destruktif (`anotasiPartitur`).
 *
 * Modul ini **murni** (tanpa DOM/Dexie/WebAudio) sehingga diuji langsung di
 * Node lewat `qa/bangun-logika.sh`, dan hanya dimuat malas oleh Studio
 * Perkusi di `LayarPartitur` (tidak menambah bundel awal).
 *
 * Yang dibaca sebagai **lapisan dasar** (tanpa diketik ulang):
 * - *sticking* `R` / `L` / `B` / `RL`… dari `<direction><words>` (cara
 *   MuseScore & DrillKit `#27` mengekspor `<Sticking>`), `<lyric>` (cara
 *   sebagian penulis Sibelius/Finale), atau `<technical><fingering>`;
 * - alat *Snare*, *Tenor 1–5*, *Spock*, *Bass 1–5*, *Unison*, *Simbal*
 *   (`perkusiAlat.ts`);
 * - teknik *rimshot / rim / ping / stick / shell* dari nama instrumen atau
 *   kepala not (`x`, `diamond`, `circle-x`);
 * - *flam* (1 not hias bergaris miring) & *drag* (2 not hias), *diddle*
 *   (tremolo 1–2 garis) & *buzz* (tremolo ≥ 3 garis / `unmeasured` /
 *   instrumen "Buzz"), serta aksen `>` dan marcato `^`.
 *
 * **Revisi lapangan** disimpan terpisah per not (kunci stabil
 * `idPart|birama|suara|ketukMulai`) sehingga berkas skor asli tidak pernah
 * ditulis ulang. Untuk tampilan, cetak Lyre A5, dan suara panduan, revisi
 * disuntikkan sementara ke salinan MusicXML (`sisipkanRevisiPerkusi`) dengan
 * warna `#c2410c` supaya terlihat beda dari tulisan *arranger*.
 */
import {
  klasifikasiNotPerkusi,
  labelAlatPerkusi,
  nilaiLetak,
  peranDariNamaPart,
  singkatanAlatPerkusi,
  type AlatPerkusi,
  type PeranPartPerkusi,
  type TeknikPerkusi,
} from './perkusiAlat'

/* --------------------------------- Tipe --------------------------------- */

export type TingkatAksen = 0 | 1 | 2

export interface SumberStickingXml {
  jenis: 'words' | 'lyric' | 'fingering'
  /** Indeks absolut awal tag pembuka (`<words`, `<text`, `<fingering`). */
  awalTag: number
  /** Indeks absolut tepat sebelum tag penutup. */
  akhirTeks: number
  /** Atribut tag pembuka (tanpa nama tag & tanpa `>`), mis. ` default-y="-40"`. */
  atribut: string
  /** Bila sumber berada di dalam blok `<note>`, indeks bloknya di `lokasi.not`. */
  indeksNot?: number
}

export interface LokasiPeristiwaXml {
  /** Titik sisip arah/not hias baru: awal not hias pertama atau awal not utama. */
  posSisip: number
  not: { awal: number; akhir: number }[]
  grace: { awal: number; akhir: number }[]
  sumber?: SumberStickingXml
  voiceXml: string
  staffXml: string
  nadaXml: string
  instrumenXml: string
}

export interface PeristiwaPerkusi {
  /** Kunci stabil revisi: `idPart|birama|suara|ketukMulai`. */
  kunci: string
  idPart: string
  /** Urutan birama 1-berbasis (sama dengan `partiturBunyi` & sorot birama). */
  birama: number
  /** Nomor birama tertulis (`<measure number>`). */
  nomorBirama: string
  suara: string
  /** Mulai dari awal birama dalam ketuk not seperempat. */
  mulaiPerempat: number
  durasiPerempat: number
  /** Alat per not di akor ini (unik, berurutan). Kosong untuk part *Pit* bernada. */
  alat: AlatPerkusi[]
  teknik?: TeknikPerkusi
  sticking?: string
  aksen: TingkatAksen
  /** 0 = tanpa, 1 = flam, 2 = drag (jumlah not hias sebelum not ini). */
  flam: 0 | 1 | 2
  diddle: boolean
  buzz: boolean
  /** Nilai tremolo asli (0 bila tidak ada) — dipakai penyuntik revisi. */
  tremoloAsli: number
  lokasi: LokasiPeristiwaXml
}

export interface PartPerkusi {
  id: string
  nama: string
  peran: PeranPartPerkusi
  jumlahPeristiwa: number
  jumlahSticking: number
  jumlahBirama: number
}

export interface LapisanPerkusi {
  /** `false` untuk `<score-timewise>` (belum didukung studio). */
  didukung: boolean
  parts: PartPerkusi[]
  peristiwa: PeristiwaPerkusi[]
}

/** Satu revisi lapangan pada satu not. Bidang `undefined` = ikut skor asli. */
export interface RevisiPerkusiNot {
  kunci: string
  idPart: string
  birama: number
  /** `null` = hapus sticking asli; string = ganti. */
  sticking?: string | null
  aksen?: TingkatAksen
  flam?: 0 | 1 | 2
  diddle?: boolean
  buzz?: boolean
  diubah: number
}

export interface PeristiwaEfektif extends PeristiwaPerkusi {
  direvisi: boolean
  revisi?: RevisiPerkusiNot
}

/** Warna tinta revisi lapangan di partitur & cetak (hex murni). */
export const WARNA_REVISI_PERKUSI = '#c2410c'

/* ------------------------------- Pembantu ------------------------------- */

const RE_STICKING = /^[RLBrlb](?:[ /.\-–]?[RLBrlb]){0,7}$/

/** Apakah teks berupa *sticking* (mis. `R`, `L`, `B`, `RL`, `r/l`, `RLR`). */
export function apakahTeksSticking(teks: string | null | undefined): boolean {
  if (!teks) return false
  return RE_STICKING.test(teks.trim())
}

/** Rapikan masukan sticking pelatih; `null` bila tidak sah. */
export function rapikanSticking(teks: string | null | undefined): string | null {
  if (teks == null) return null
  const t = teks.trim().replace(/\s+/g, '')
  if (!t) return null
  return apakahTeksSticking(t) ? t : null
}

function teksTag(blok: string, tag: string): string | null {
  const m = new RegExp(`<${tag}(?=[\\s>])[^>]*>([\\s\\S]*?)</${tag}>`, 'i').exec(blok)
  return m ? m[1].trim() : null
}

function dekodeTeks(t: string): string {
  return t
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&amp;/g, '&')
}

function escapeTeks(t: string): string {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function bulat(n: number): number {
  return Math.round(n * 1000) / 1000
}

export function kunciPeristiwa(idPart: string, birama: number, suara: string, mulai: number): string {
  return `${idPart}|${birama}|${suara}|${bulat(mulai)}`
}

interface InfoScorePart {
  nama: string
  instrumen: Map<string, string>
}

function uraiDaftarPart(xml: string): Map<string, InfoScorePart> {
  const hasil = new Map<string, InfoScorePart>()
  const re = /<score-part\b[^>]*\bid=(["'])(.*?)\1[^>]*>([\s\S]*?)<\/score-part>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) !== null) {
    const isi = m[3]
    const nama = dekodeTeks(teksTag(isi, 'part-name') ?? '') || m[2]
    const instrumen = new Map<string, string>()
    const reI = /<score-instrument\b[^>]*\bid=(["'])(.*?)\1[^>]*>([\s\S]*?)<\/score-instrument>/gi
    let mi: RegExpExecArray | null
    while ((mi = reI.exec(isi)) !== null) {
      instrumen.set(mi[2], dekodeTeks(teksTag(mi[3], 'instrument-name') ?? ''))
    }
    hasil.set(m[2], { nama, instrumen })
  }
  return hasil
}

interface InfoNotMentah {
  awal: number
  akhir: number
  grace: boolean
  chord: boolean
  rest: boolean
  durasi: number
  suara: string
  staf: string | null
  letak: number | null
  nadaXml: string
  instrumenId: string | null
  instrumenXml: string
  kepala: string | null
  aksen: TingkatAksen
  tremolo: number
  sticking?: { teks: string; awalTag: number; akhirTeks: number; atribut: string; jenis: 'lyric' | 'fingering' }
}

function uraiBlokNot(blok: string, awal: number): InfoNotMentah {
  const grace = /<grace\b/i.test(blok)
  const chord = /<chord\s*\/?>/i.test(blok)
  const rest = /<rest\b/i.test(blok)
  const durasi = Number(teksTag(blok, 'duration') ?? '0')
  const suara = teksTag(blok, 'voice') ?? '1'
  const staf = teksTag(blok, 'staff')
  let letak: number | null = null
  let nadaXml = ''
  const mUn = /<unpitched\b[^>]*\/>|<unpitched\b[^>]*>[\s\S]*?<\/unpitched>/i.exec(blok)
  if (mUn) {
    nadaXml = mUn[0]
    letak = nilaiLetak(teksTag(mUn[0], 'display-step'), Number(teksTag(mUn[0], 'display-octave') ?? '5'))
  } else {
    const mP = /<pitch\b[^>]*>[\s\S]*?<\/pitch>/i.exec(blok)
    if (mP) nadaXml = mP[0]
  }
  const mIns = /<instrument\b[^>]*\bid=(["'])(.*?)\1[^>]*\/?>/i.exec(blok)
  const kepala = teksTag(blok, 'notehead')
  const aksen: TingkatAksen = /<strong-accent\b/i.test(blok) ? 2 : /<accent\b/i.test(blok) ? 1 : 0
  let tremolo = 0
  const mT = /<tremolo\b([^>]*)>\s*(\d*)\s*<\/tremolo>/i.exec(blok)
  if (mT) {
    const tipe = (/type\s*=\s*["']([^"']+)/i.exec(mT[1])?.[1] ?? 'single').toLowerCase()
    if (tipe === 'unmeasured') tremolo = 3
    else if (tipe === 'single') tremolo = Math.max(1, Number(mT[2] || '3'))
  }
  let sticking: InfoNotMentah['sticking']
  const reLirik = /<lyric\b[^>]*>([\s\S]*?)<\/lyric>/gi
  let ml: RegExpExecArray | null
  while (!sticking && (ml = reLirik.exec(blok)) !== null) {
    const awalIsi = ml.index + ml[0].indexOf('>') + 1
    const mt = /<text\b([^>]*)>([^<]*)<\/text>/i.exec(ml[1])
    if (mt && apakahTeksSticking(dekodeTeks(mt[2]))) {
      const awalTagRel = awalIsi + mt.index
      sticking = {
        teks: dekodeTeks(mt[2]).trim(),
        awalTag: awal + awalTagRel,
        akhirTeks: awal + awalTagRel + mt[0].length - '</text>'.length,
        atribut: mt[1],
        jenis: 'lyric',
      }
    }
  }
  if (!sticking) {
    const mf = /<fingering\b([^>]*)>([^<]*)<\/fingering>/i.exec(blok)
    if (mf && apakahTeksSticking(dekodeTeks(mf[2]))) {
      sticking = {
        teks: dekodeTeks(mf[2]).trim(),
        awalTag: awal + mf.index,
        akhirTeks: awal + mf.index + mf[0].length - '</fingering>'.length,
        atribut: mf[1],
        jenis: 'fingering',
      }
    }
  }
  return {
    awal,
    akhir: awal + blok.length,
    grace,
    chord,
    rest,
    durasi: Number.isFinite(durasi) ? durasi : 0,
    suara,
    staf,
    letak,
    nadaXml,
    instrumenId: mIns ? mIns[2] : null,
    instrumenXml: mIns ? mIns[0] : '',
    kepala,
    aksen,
    tremolo,
    sticking,
  }
}

/* ------------------------------ Pengurai -------------------------------- */

/**
 * Urai lapisan perkusi dasar dari teks MusicXML `<score-partwise>`.
 * Part bernada non-*Pit* dilewati; part tanpa satu pun not dilewati.
 */
export function uraiLapisanPerkusi(xml: string): LapisanPerkusi {
  if (!xml || !/<score-partwise\b/i.test(xml)) {
    return { didukung: !/<score-timewise\b/i.test(xml ?? ''), parts: [], peristiwa: [] }
  }
  const daftar = uraiDaftarPart(xml)
  const parts: PartPerkusi[] = []
  const peristiwa: PeristiwaPerkusi[] = []

  const rePart = /<part\s[^>]*\bid=(["'])(.*?)\1[^>]*>/gi
  let mp: RegExpExecArray | null
  while ((mp = rePart.exec(xml)) !== null) {
    const idPart = mp[2]
    const awalIsi = mp.index + mp[0].length
    const akhirPart = xml.indexOf('</part>', awalIsi)
    if (akhirPart < 0) break
    rePart.lastIndex = akhirPart
    const isiPart = xml.slice(awalIsi, akhirPart)
    const info = daftar.get(idPart) ?? { nama: idPart, instrumen: new Map<string, string>() }
    const adaUnpitched = /<unpitched\b/i.test(isiPart)
    const peran = peranDariNamaPart(info.nama, adaUnpitched)
    if (!peran) continue

    // Letak berbeda yang dipakai part (untuk penomoran Bass/Tenor tanpa nama).
    const setLetak = new Set<number>()
    const reUn = /<unpitched\b[^>]*>([\s\S]*?)<\/unpitched>/gi
    let mu: RegExpExecArray | null
    while ((mu = reUn.exec(isiPart)) !== null) {
      setLetak.add(nilaiLetak(teksTag(mu[1], 'display-step'), Number(teksTag(mu[1], 'display-octave') ?? '5')))
    }
    const letakPart = [...setLetak].sort((a, b) => b - a)

    const ringkas: PartPerkusi = {
      id: idPart,
      nama: info.nama,
      peran,
      jumlahPeristiwa: 0,
      jumlahSticking: 0,
      jumlahBirama: 0,
    }

    let divisions = 1
    let noBirama = 0
    const reMeasure = /<measure(?=[\s>/])[^>]*?(\/?)>/gi
    let mm: RegExpExecArray | null
    while ((mm = reMeasure.exec(isiPart)) !== null) {
      noBirama += 1
      const nomorTertulis = /\bnumber=(["'])(.*?)\1/i.exec(mm[0])?.[2] ?? String(noBirama)
      if (mm[1] === '/') continue
      const awalM = mm.index + mm[0].length
      const akhirM = isiPart.indexOf('</measure>', awalM)
      if (akhirM < 0) break
      reMeasure.lastIndex = akhirM
      const isiM = isiPart.slice(awalM, akhirM)
      const offsetM = awalIsi + awalM

      let kursor = 0
      let mulaiSebelumnya = 0
      let peristiwaAktif: PeristiwaPerkusi | null = null
      let graceTertunda: InfoNotMentah[] = []
      let stickingTertunda: (SumberStickingXml & { teks: string; staf: string | null }) | null = null

      const reTok = /<(note|backup|forward|direction|attributes)(?=[\s>/])[^>]*?(?:\/>|>[\s\S]*?<\/\1>)/gi
      let tk: RegExpExecArray | null
      while ((tk = reTok.exec(isiM)) !== null) {
        const blok = tk[0]
        const jenis = tk[1].toLowerCase()
        const awalAbs = offsetM + tk.index
        if (jenis === 'attributes') {
          const d = Number(teksTag(blok, 'divisions') ?? 'NaN')
          if (Number.isFinite(d) && d > 0) divisions = d
          continue
        }
        if (jenis === 'backup' || jenis === 'forward') {
          const d = Number(teksTag(blok, 'duration') ?? '0')
          if (Number.isFinite(d) && d > 0) kursor = jenis === 'backup' ? Math.max(0, kursor - d) : kursor + d
          peristiwaAktif = null
          continue
        }
        if (jenis === 'direction') {
          const reW = /<words\b([^>]*)>([^<]*)<\/words>/gi
          let mw: RegExpExecArray | null
          while ((mw = reW.exec(blok)) !== null) {
            const teks = dekodeTeks(mw[2]).trim()
            if (!apakahTeksSticking(teks)) continue
            const awalTag = awalAbs + mw.index
            stickingTertunda = {
              jenis: 'words',
              teks,
              awalTag,
              akhirTeks: awalTag + mw[0].length - '</words>'.length,
              atribut: mw[1],
              staf: teksTag(blok, 'staff'),
            }
            break
          }
          continue
        }

        // <note>
        const n = uraiBlokNot(blok, awalAbs)
        if (n.grace) {
          graceTertunda.push(n)
          continue
        }
        const mulaiDiv = n.chord ? mulaiSebelumnya : kursor
        if (!n.chord) {
          mulaiSebelumnya = mulaiDiv
          kursor += n.durasi
        }
        if (n.rest) {
          if (!n.chord) peristiwaAktif = null
          continue
        }

        const namaIns = n.instrumenId ? info.instrumen.get(n.instrumenId) ?? null : null
        const kls =
          n.letak != null && peran !== 'pit'
            ? klasifikasiNotPerkusi({ peran, namaInstrumen: namaIns, letak: n.letak, letakPart, kepala: n.kepala })
            : null
        const buzzNama = kls?.teknik === 'buzz'

        if (n.chord && peristiwaAktif) {
          const ev: PeristiwaPerkusi = peristiwaAktif
          ev.lokasi.not.push({ awal: n.awal, akhir: n.akhir })
          if (kls && !ev.alat.includes(kls.alat)) ev.alat.push(kls.alat)
          if (!ev.teknik && kls?.teknik && kls.teknik !== 'buzz') ev.teknik = kls.teknik
          if (n.aksen > ev.aksen) ev.aksen = n.aksen
          if (buzzNama) ev.buzz = true
          if (!ev.sticking && n.sticking) {
            ev.sticking = n.sticking.teks
            ev.lokasi.sumber = { ...n.sticking, indeksNot: ev.lokasi.not.length - 1 }
          }
          continue
        }

        const mulai = mulaiDiv / divisions
        const graceIni = graceTertunda.filter((g) => g.suara === n.suara)
        graceTertunda = []
        const lokasi: LokasiPeristiwaXml = {
          posSisip: graceIni.length > 0 ? graceIni[0].awal : n.awal,
          not: [{ awal: n.awal, akhir: n.akhir }],
          grace: graceIni.map((g) => ({ awal: g.awal, akhir: g.akhir })),
          voiceXml: `<voice>${escapeTeks(n.suara)}</voice>`,
          staffXml: n.staf ? `<staff>${escapeTeks(n.staf)}</staff>` : '',
          nadaXml: n.nadaXml,
          instrumenXml: n.instrumenXml,
        }
        let sticking: string | undefined
        if (stickingTertunda && (!stickingTertunda.staf || !n.staf || stickingTertunda.staf === n.staf)) {
          sticking = stickingTertunda.teks
          const { teks: _t, staf: _s, ...sumber } = stickingTertunda
          lokasi.sumber = sumber
          stickingTertunda = null
        } else if (n.sticking) {
          sticking = n.sticking.teks
          const { teks: _t, ...sumber } = n.sticking
          lokasi.sumber = { ...sumber, indeksNot: 0 }
        }
        const ev: PeristiwaPerkusi = {
          kunci: kunciPeristiwa(idPart, noBirama, n.suara, mulai),
          idPart,
          birama: noBirama,
          nomorBirama: nomorTertulis,
          suara: n.suara,
          mulaiPerempat: bulat(mulai),
          durasiPerempat: bulat(n.durasi / divisions),
          alat: kls ? [kls.alat] : [],
          teknik: kls?.teknik && kls.teknik !== 'buzz' ? kls.teknik : undefined,
          sticking,
          aksen: n.aksen,
          flam: (Math.min(2, graceIni.length) as 0 | 1 | 2),
          diddle: n.tremolo > 0 && n.tremolo < 3,
          buzz: n.tremolo >= 3 || buzzNama,
          tremoloAsli: n.tremolo,
          lokasi,
        }
        peristiwa.push(ev)
        peristiwaAktif = ev
        ringkas.jumlahPeristiwa += 1
      }
      ringkas.jumlahBirama = noBirama
    }
    ringkas.jumlahBirama = noBirama
    ringkas.jumlahSticking = peristiwa.filter((e) => e.idPart === idPart && e.sticking).length
    if (ringkas.jumlahPeristiwa > 0) parts.push(ringkas)
  }

  return { didukung: true, parts, peristiwa }
}

/* ------------------------- Revisi & lapisan efektif ---------------------- */

/** Rapikan daftar revisi: buang yang rusak & duplikat kunci (yang terakhir menang). */
export function rapikanDaftarRevisi(daftar: unknown): RevisiPerkusiNot[] {
  if (!Array.isArray(daftar)) return []
  const peta = new Map<string, RevisiPerkusiNot>()
  for (const r of daftar) {
    if (!r || typeof r !== 'object') continue
    const x = r as Partial<RevisiPerkusiNot>
    if (typeof x.kunci !== 'string' || !x.kunci || typeof x.idPart !== 'string') continue
    const bersih: RevisiPerkusiNot = {
      kunci: x.kunci,
      idPart: x.idPart,
      birama: Number.isFinite(x.birama) ? Number(x.birama) : 1,
      diubah: Number.isFinite(x.diubah) ? Number(x.diubah) : 0,
    }
    if (x.sticking === null) bersih.sticking = null
    else if (typeof x.sticking === 'string') {
      const s = rapikanSticking(x.sticking)
      if (s) bersih.sticking = s
    }
    if (x.aksen === 0 || x.aksen === 1 || x.aksen === 2) bersih.aksen = x.aksen
    if (x.flam === 0 || x.flam === 1 || x.flam === 2) bersih.flam = x.flam
    if (typeof x.diddle === 'boolean') bersih.diddle = x.diddle
    if (typeof x.buzz === 'boolean') bersih.buzz = x.buzz
    if (!revisiKosong(bersih)) peta.set(bersih.kunci, bersih)
  }
  return [...peta.values()]
}

/** Revisi tanpa satu pun perubahan. */
export function revisiKosong(r: RevisiPerkusiNot): boolean {
  return (
    r.sticking === undefined &&
    r.aksen === undefined &&
    r.flam === undefined &&
    r.diddle === undefined &&
    r.buzz === undefined
  )
}

/**
 * Terapkan satu perubahan ke daftar revisi. Bidang yang sama dengan skor asli
 * otomatis dibuang (kembali ke lapisan dasar), revisi kosong dihapus.
 */
export function terapkanUbahRevisi(
  daftar: RevisiPerkusiNot[],
  ev: PeristiwaPerkusi,
  ubah: Partial<Pick<RevisiPerkusiNot, 'sticking' | 'aksen' | 'flam' | 'diddle' | 'buzz'>> | 'asli',
  sekarang = Date.now(),
): RevisiPerkusiNot[] {
  const sisa = daftar.filter((r) => r.kunci !== ev.kunci)
  if (ubah === 'asli') return sisa
  const lama = daftar.find((r) => r.kunci === ev.kunci)
  const baru: RevisiPerkusiNot = { ...(lama ?? { kunci: ev.kunci, idPart: ev.idPart, birama: ev.birama, diubah: sekarang }) }
  baru.idPart = ev.idPart
  baru.birama = ev.birama
  baru.diubah = sekarang
  if ('sticking' in ubah) {
    const s = ubah.sticking === null ? null : rapikanSticking(ubah.sticking ?? '')
    if (ubah.sticking === null) baru.sticking = ev.sticking ? null : undefined
    else if (s) baru.sticking = s === ev.sticking ? undefined : s
  }
  if (ubah.aksen !== undefined) baru.aksen = ubah.aksen === ev.aksen ? undefined : ubah.aksen
  if (ubah.flam !== undefined) baru.flam = ubah.flam === ev.flam ? undefined : ubah.flam
  if (ubah.diddle !== undefined) {
    baru.diddle = ubah.diddle === ev.diddle ? undefined : ubah.diddle
    if (ubah.diddle) baru.buzz = ev.buzz ? false : undefined
  }
  if (ubah.buzz !== undefined) {
    baru.buzz = ubah.buzz === ev.buzz ? undefined : ubah.buzz
    if (ubah.buzz) baru.diddle = ev.diddle ? false : undefined
  }
  for (const k of ['sticking', 'aksen', 'flam', 'diddle', 'buzz'] as const) {
    if (baru[k] === undefined) delete baru[k]
  }
  return revisiKosong(baru) ? sisa : [...sisa, baru]
}

/** Gabungkan lapisan dasar dengan revisi lapangan. */
export function gabungLapisanRevisi(
  lapisan: LapisanPerkusi,
  revisi: RevisiPerkusiNot[],
): { peristiwa: PeristiwaEfektif[]; yatim: RevisiPerkusiNot[] } {
  const peta = new Map(revisi.map((r) => [r.kunci, r]))
  const terpakai = new Set<string>()
  const hasil = lapisan.peristiwa.map((ev): PeristiwaEfektif => {
    const r = peta.get(ev.kunci)
    if (!r) return { ...ev, direvisi: false }
    terpakai.add(r.kunci)
    return {
      ...ev,
      sticking: r.sticking === undefined ? ev.sticking : r.sticking ?? undefined,
      aksen: r.aksen ?? ev.aksen,
      flam: r.flam ?? ev.flam,
      diddle: r.diddle ?? ev.diddle,
      buzz: r.buzz ?? ev.buzz,
      direvisi: true,
      revisi: r,
    }
  })
  return { peristiwa: hasil, yatim: revisi.filter((r) => !terpakai.has(r.kunci)) }
}

/** Peristiwa satu part pada satu birama, urut ketuk lalu suara. */
export function peristiwaDalamBirama<T extends PeristiwaPerkusi>(daftar: T[], idPart: string, birama: number): T[] {
  return daftar
    .filter((e) => e.idPart === idPart && e.birama === birama)
    .sort((a, b) => a.mulaiPerempat - b.mulaiPerempat || a.suara.localeCompare(b.suara))
}

/** Label alat untuk satu peristiwa (mis. `"Bass 1 + Bass 3"`). */
export function labelAlatPeristiwa(ev: Pick<PeristiwaPerkusi, 'alat'>, pendek = false): string {
  if (ev.alat.length === 0) return pendek ? 'Pit' : 'Pit'
  return ev.alat.map((a) => (pendek ? singkatanAlatPerkusi(a) : labelAlatPerkusi(a))).join(pendek ? '+' : ' + ')
}

/** Ringkas "R L R R L" satu birama (sticking efektif; `·` bila kosong). */
export function teksStickingBirama(daftar: Pick<PeristiwaPerkusi, 'sticking'>[]): string {
  return daftar.map((e) => e.sticking ?? '·').join(' ')
}

/**
 * #13a — Saring revisi untuk paket anggota: hanya part yang diterima anggota.
 * `idPartAktif` kosong/`null` = skor utuh (semua revisi ikut).
 */
export function saringRevisiUntukPart(
  revisi: RevisiPerkusiNot[],
  idPartAktif: string[] | null | undefined,
): RevisiPerkusiNot[] {
  if (!idPartAktif || idPartAktif.length === 0) return revisi
  const set = new Set(idPartAktif)
  return revisi.filter((r) => set.has(r.idPart))
}

/* ---------------------------- Penyuntik XML ----------------------------- */

interface Suntingan {
  awal: number
  akhir: number
  ganti: string
}

function buangAksen(blok: string): string {
  return rapikanNotasiKosong(
    blok
      .replace(/<strong-accent\b[^>]*\/>|<strong-accent\b[^>]*>\s*<\/strong-accent>/gi, '')
      .replace(/<accent\b[^>]*\/>|<accent\b[^>]*>\s*<\/accent>/gi, ''),
  )
}

function buangTremolo(blok: string): string {
  return rapikanNotasiKosong(blok.replace(/<tremolo\b[^>]*>[^<]*<\/tremolo>|<tremolo\b[^>]*\/>/gi, ''))
}

function rapikanNotasiKosong(blok: string): string {
  return blok
    .replace(/<articulations\b[^>]*>\s*<\/articulations>/gi, '')
    .replace(/<ornaments\b[^>]*>\s*<\/ornaments>/gi, '')
    .replace(/<notations\b[^>]*>\s*<\/notations>/gi, '')
}

/** Sisipkan `isi` ke dalam `<notations>/<wadah>` blok not (membuat bila perlu). */
function sisipNotasi(blok: string, wadah: 'articulations' | 'ornaments', isi: string): string {
  const reWadah = new RegExp(`<${wadah}\\b[^>]*>`, 'i')
  const mW = reWadah.exec(blok)
  if (mW) return blok.slice(0, mW.index + mW[0].length) + isi + blok.slice(mW.index + mW[0].length)
  const mN = /<notations\b[^>]*>/i.exec(blok)
  if (mN) {
    const pos = mN.index + mN[0].length
    return blok.slice(0, pos) + `<${wadah}>${isi}</${wadah}>` + blok.slice(pos)
  }
  const notasi = `<notations><${wadah}>${isi}</${wadah}></notations>`
  const mL = /<lyric\b|<play\b|<listen\b/i.exec(blok)
  const pos = mL ? mL.index : blok.lastIndexOf('</note>')
  if (pos < 0) return blok
  return blok.slice(0, pos) + notasi + blok.slice(pos)
}

function aturAksen(blok: string, tingkat: TingkatAksen): string {
  const bersih = buangAksen(blok)
  if (tingkat === 0) return bersih
  return sisipNotasi(bersih, 'articulations', tingkat === 2 ? '<strong-accent type="up"/>' : '<accent/>')
}

function aturTremolo(blok: string, nilai: number): string {
  const bersih = buangTremolo(blok)
  if (nilai <= 0) return bersih
  return sisipNotasi(bersih, 'ornaments', `<tremolo type="single">${nilai}</tremolo>`)
}

function tagSticking(jenis: SumberStickingXml['jenis'], atribut: string, teks: string): string {
  const tanpaWarna = atribut.replace(/\s+color\s*=\s*(["'])[^"']*\1/gi, '')
  const tag = jenis === 'words' ? 'words' : jenis === 'lyric' ? 'text' : 'fingering'
  if (!teks) return `<${tag}${tanpaWarna}>`
  return `<${tag}${tanpaWarna} color="${WARNA_REVISI_PERKUSI}">${escapeTeks(teks)}`
}

function graceXml(ev: PeristiwaPerkusi, jumlah: number): string {
  if (jumlah <= 0 || !ev.lokasi.nadaXml) return ''
  const satu =
    `<note>${jumlah === 1 ? '<grace slash="yes"/>' : '<grace/>'}${ev.lokasi.nadaXml}${ev.lokasi.instrumenXml}` +
    `${ev.lokasi.voiceXml}<type>${jumlah === 1 ? 'eighth' : '16th'}</type>${ev.lokasi.staffXml}</note>`
  return satu.repeat(jumlah)
}

/**
 * Suntikkan revisi lapangan ke salinan MusicXML (untuk tampilan, cetak Lyre
 * A5, dan suara panduan). Berkas asli tidak pernah diubah.
 *
 * `lapisan` **harus** hasil `uraiLapisanPerkusi(xml)` dari teks yang sama.
 */
export function sisipkanRevisiPerkusi(
  xml: string,
  lapisan: LapisanPerkusi,
  revisi: RevisiPerkusiNot[],
): { xml: string; diterapkan: number; yatim: number } {
  if (!revisi.length || !lapisan.peristiwa.length) return { xml, diterapkan: 0, yatim: revisi.length }
  const petaEv = new Map(lapisan.peristiwa.map((e) => [e.kunci, e]))
  const suntingan: Suntingan[] = []
  let diterapkan = 0
  let yatim = 0
  const sudah = new Set<string>()

  for (const r of revisi) {
    if (sudah.has(r.kunci)) continue
    sudah.add(r.kunci)
    const ev = petaEv.get(r.kunci)
    if (!ev) {
      yatim += 1
      continue
    }
    const lok = ev.lokasi
    let sisipan = ''
    // Ubahan per blok not: indeks → teks baru.
    const blokBaru = new Map<number, string>()
    const ambilBlok = (i: number) => blokBaru.get(i) ?? xml.slice(lok.not[i].awal, lok.not[i].akhir)

    // 1. Sticking.
    if (r.sticking !== undefined) {
      const teks = r.sticking ?? ''
      if (lok.sumber) {
        const tagBaru = tagSticking(lok.sumber.jenis, lok.sumber.atribut, teks)
        if (lok.sumber.indeksNot != null && lok.not[lok.sumber.indeksNot]) {
          const i = lok.sumber.indeksNot
          const b = lok.not[i]
          const s = ambilBlok(i)
          blokBaru.set(
            i,
            s.slice(0, lok.sumber.awalTag - b.awal) + tagBaru + s.slice(lok.sumber.akhirTeks - b.awal),
          )
        } else {
          suntingan.push({ awal: lok.sumber.awalTag, akhir: lok.sumber.akhirTeks, ganti: tagBaru })
        }
      } else if (teks) {
        sisipan +=
          `<direction placement="below"><direction-type><words font-weight="bold" color="${WARNA_REVISI_PERKUSI}">` +
          `${escapeTeks(teks)}</words></direction-type>${lok.voiceXml}${lok.staffXml}</direction>`
      }
    }

    // 2. Aksen.
    if (r.aksen !== undefined && r.aksen !== ev.aksen) {
      blokBaru.set(0, aturAksen(ambilBlok(0), r.aksen))
      if (r.aksen === 0) for (let i = 1; i < lok.not.length; i += 1) blokBaru.set(i, buangAksen(ambilBlok(i)))
    }

    // 3. Diddle / buzz (tremolo pada not utama).
    if (r.diddle !== undefined || r.buzz !== undefined) {
      const buzz = r.buzz ?? ev.buzz
      const diddle = r.diddle ?? ev.diddle
      const nilai = buzz ? 3 : diddle ? 1 : 0
      const asli = ev.tremoloAsli >= 3 ? 3 : ev.tremoloAsli > 0 ? 1 : 0
      if (nilai !== asli) blokBaru.set(0, aturTremolo(ambilBlok(0), nilai))
    }

    // 4. Flam / drag (not hias sebelum not utama).
    if (r.flam !== undefined && r.flam !== ev.flam) {
      for (const g of lok.grace) suntingan.push({ awal: g.awal, akhir: g.akhir, ganti: '' })
      sisipan += graceXml(ev, r.flam)
    }

    for (const [i, teks] of blokBaru) suntingan.push({ awal: lok.not[i].awal, akhir: lok.not[i].akhir, ganti: teks })
    if (sisipan) suntingan.push({ awal: lok.posSisip, akhir: lok.posSisip, ganti: sisipan })
    diterapkan += 1
  }

  // Terapkan dari belakang; pada posisi sama, penghapusan (lebih panjang) dulu.
  suntingan.sort((a, b) => b.awal - a.awal || b.akhir - a.akhir)
  let hasil = xml
  for (const s of suntingan) hasil = hasil.slice(0, s.awal) + s.ganti + hasil.slice(s.akhir)
  return { xml: hasil, diterapkan, yatim }
}
