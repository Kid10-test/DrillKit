/**
 * #13a — Pengemas & penyaring partitur per suara untuk paket anggota (`ShareBundle`).
 *
 * Modul ini **murni** (tanpa Dexie atau DOM) supaya `qa/bangun-logika.sh` bisa
 * mengujinya langsung di Node dan `bagikan.ts` dapat memanggilnya secara sinkron.
 *
 * Dua kerja utamanya:
 * 1. `pangkasMusicXmlKePart`: memangkas `<score-partwise>` penuh menjadi hanya
 *    `<score-part>` dan `<part>` milik seksi/instrumen anggota, sambil menyalin
 *    petunjuk global (`<rehearsal>` seperti `[A]`, `[B]` dan `<metronome>` /
 *    `<sound tempo="...">`) dari part teratas (`P1`) ke part pertama yang
 *    disertakan bila belum ada — sehingga pemain Trumpet 2, Tuba, atau Snare
 *    tetap melihat huruf latihan dan tempo yang sama dengan konduktor.
 * 2. `saringPartiturPaketUntukAnggota`: memetakan `ShareBundle.partiturPaket`
 *    dan metadata `Song.partitur` untuk satu penerima paket menggunakan
 *    pencocok instrumen `#11c` (`pilihFilterAwalAnggota` + `daftarIdPartAktif`).
 *    Bila instrumen anggota tidak cocok dengan satu pun part di skor, ia jatuh
 *    aman ke skor penuh (tanpa jalan buntu).
 */
import type {
  LampiranPartiturPaket,
  Member,
  SectionDef,
  Song,
} from '../db/types'
import { ringkasMusicXml, teksPartitur, type BagianPartitur } from './partitur'
import { daftarIdPartAktif, pilihFilterAwalAnggota } from './partiturBagian'

/** Batas ukuran per berkas partitur yang aman disematkan langsung ke JSON paket (1,5 MB). */
export const BATAS_LAMPIRAN_PARTITUR_PAKET = 1_500_000

const TABEL_B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

/** Encode `Uint8Array` ke Base64 secara murni (bekerja identik di peramban & Node). */
export function bitaKeBase64(bita: Uint8Array): string {
  let out = ''
  const n = bita.length
  for (let i = 0; i < n; i += 3) {
    const a = bita[i] ?? 0
    const b = i + 1 < n ? (bita[i + 1] ?? 0) : 0
    const c = i + 2 < n ? (bita[i + 2] ?? 0) : 0
    const trip = (a << 16) | (b << 8) | c
    out += TABEL_B64[(trip >> 18) & 63]
    out += TABEL_B64[(trip >> 12) & 63]
    out += i + 1 < n ? TABEL_B64[(trip >> 6) & 63] : '='
    out += i + 2 < n ? TABEL_B64[trip & 63] : '='
  }
  return out
}

/** Decode Base64 ke `Uint8Array` secara murni (tanpa bergantung `atob` / `Buffer`). */
export function base64KeBita(b64: string): Uint8Array {
  const bersih = b64.replace(/[^A-Za-z0-9+/=]/g, '')
  if (!bersih) return new Uint8Array(0)
  const peta = new Int16Array(128).fill(-1)
  for (let i = 0; i < TABEL_B64.length; i += 1) {
    peta[TABEL_B64.charCodeAt(i)] = i
  }
  const pad = bersih.endsWith('==') ? 2 : bersih.endsWith('=') ? 1 : 0
  const panjang = Math.max(0, Math.floor((bersih.length * 3) / 4) - pad)
  const hasil = new Uint8Array(panjang)
  let pos = 0
  for (let i = 0; i < bersih.length; i += 4) {
    const c0 = peta[bersih.charCodeAt(i)] ?? 0
    const c1 = peta[bersih.charCodeAt(i + 1)] ?? 0
    const c2 = bersih[i + 2] === '=' ? 0 : (peta[bersih.charCodeAt(i + 2)] ?? 0)
    const c3 = bersih[i + 3] === '=' ? 0 : (peta[bersih.charCodeAt(i + 3)] ?? 0)
    const trip = (c0 << 18) | (c1 << 12) | (c2 << 6) | c3
    if (pos < panjang) hasil[pos++] = (trip >> 16) & 0xff
    if (pos < panjang) hasil[pos++] = (trip >> 8) & 0xff
    if (pos < panjang) hasil[pos++] = trip & 0xff
  }
  return hasil
}

/** Hash ringan deterministik (FNV-1a 64-bit heksadesimal) untuk teks hasil pangkas. */
export function hashTeksCepat(teks: string): string {
  let h1 = 0x811c9dc5
  let h2 = 0x01000193
  for (let i = 0; i < teks.length; i += 1) {
    const ch = teks.charCodeAt(i)
    h1 ^= ch & 0xff
    h1 = Math.imul(h1, 0x01000193) >>> 0
    h2 ^= (ch >> 8) & 0xff
    h2 = Math.imul(h2, 0x85ebca6b) >>> 0
  }
  return `pangkas-${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`
}

interface PetunjukBiramaGlobal {
  rehearsal: string[]
  tempo: string[]
}

/**
 * Kumpulkan `<direction>` global (huruf latihan `<rehearsal>` & penanda tempo
 * `<metronome>` / `<sound tempo="...">`) per nomor birama dari part teratas.
 */
function kumpulkanPetunjukGlobal(isiPartPertama: string): Map<string, PetunjukBiramaGlobal> {
  const peta = new Map<string, PetunjukBiramaGlobal>()
  const reMeasure = /<measure\b[^>]*\bnumber=(["'])(.*?)\1[^>]*>([\s\S]*?)<\/measure>/gi
  let m: RegExpExecArray | null
  while ((m = reMeasure.exec(isiPartPertama)) !== null) {
    const noBirama = m[2]
    const isiBirama = m[3]
    const reDir = /<direction\b[\s\S]*?<\/direction>/gi
    let d: RegExpExecArray | null
    const reh: string[] = []
    const tmp: string[] = []
    while ((d = reDir.exec(isiBirama)) !== null) {
      const blok = d[0]
      if (/<rehearsal\b/i.test(blok)) reh.push(blok)
      else if (/<metronome\b/i.test(blok) || /<sound\b[^>]*\btempo=/i.test(blok)) tmp.push(blok)
    }
    const reSoundLepas = /<sound\b[^>]*\btempo=(["'])[^"']+\1[^>]*\/?>/gi
    let s: RegExpExecArray | null
    while ((s = reSoundLepas.exec(isiBirama)) !== null) {
      const tag = s[0]
      if (!tmp.some((b) => b.includes(tag)) && !reh.some((b) => b.includes(tag))) {
        tmp.push(tag)
      }
    }
    if (reh.length > 0 || tmp.length > 0) {
      peta.set(noBirama, { rehearsal: reh, tempo: tmp })
    }
  }
  return peta
}

/** Sisipkan petunjuk global yang belum ada pada birama part terpilih pertama. */
function sisipkanPetunjukGlobalKePart(
  blokPart: string,
  petaGlobal: Map<string, PetunjukBiramaGlobal>,
): string {
  if (petaGlobal.size === 0) return blokPart
  return blokPart.replace(
    /(<measure\b[^>]*\bnumber=(["'])(.*?)\2[^>]*>)([\s\S]*?)(<\/measure>)/gi,
    (utuh, pembuka: string, _q: string, noBirama: string, isi: string, penutup: string) => {
      const g = petaGlobal.get(noBirama)
      if (!g) return utuh
      const sisip: string[] = []
      if (g.rehearsal.length > 0 && !/<rehearsal\b/i.test(isi)) {
        sisip.push(...g.rehearsal)
      }
      if (
        g.tempo.length > 0 &&
        !/<metronome\b/i.test(isi) &&
        !/<sound\b[^>]*\btempo=/i.test(isi)
      ) {
        sisip.push(...g.tempo)
      }
      if (sisip.length === 0) return utuh
      const gabungSisip = '\n      ' + sisip.join('\n      ')
      if (/<\/attributes>/i.test(isi)) {
        return pembuka + isi.replace(/<\/attributes>/i, (t) => t + gabungSisip) + penutup
      }
      return pembuka + gabungSisip + isi + penutup
    },
  )
}

/**
 * Pangkas dokumen MusicXML `<score-partwise>` agar hanya memuat part dengan `id`
 * di dalam `idPartAktif`.
 *
 * Jatuh aman (mengembalikan `xml` apa adanya) bila:
 * - `idPartAktif` kosong atau mencakup seluruh part yang ada;
 * - dokumen berbentuk `<score-timewise>` atau tidak memiliki `<part-list>`;
 * - tidak ada satu pun `idPartAktif` yang ditemukan di dalam skor.
 */
export function pangkasMusicXmlKePart(xml: string, idPartAktif: string[]): string {
  if (!xml || !Array.isArray(idPartAktif) || idPartAktif.length === 0) return xml
  if (!/<score-partwise\b/i.test(xml)) return xml

  const cocokPartList = /(<part-list\b[^>]*>)([\s\S]*?)(<\/part-list>)/i.exec(xml)
  if (!cocokPartList) return xml

  const isiPartList = cocokPartList[2]
  const reScorePart =
    /<score-part\b[^>]*\bid=(["'])(.*?)\1[^>]*>[\s\S]*?<\/score-part>|<score-part\b[^>]*\bid=(["'])(.*?)\3[^>]*\/>/gi
  const daftarScorePart: { id: string; blok: string }[] = []
  let sp: RegExpExecArray | null
  while ((sp = reScorePart.exec(isiPartList)) !== null) {
    const id = (sp[2] ?? sp[4] ?? '').trim()
    if (id) daftarScorePart.push({ id, blok: sp[0] })
  }
  if (daftarScorePart.length <= 1) return xml

  const setAktif = new Set(idPartAktif)
  const scorePartTerpilih = daftarScorePart.filter((p) => setAktif.has(p.id))
  if (scorePartTerpilih.length === 0 || scorePartTerpilih.length === daftarScorePart.length) {
    return xml
  }

  // Ambil seluruh blok `<part id="...">...</part>` pada dokumen.
  const rePart = /<part\b[^>]*\bid=(["'])(.*?)\1[^>]*>[\s\S]*?<\/part>/gi
  const semuaPart: { id: string; blok: string }[] = []
  let mp: RegExpExecArray | null
  while ((mp = rePart.exec(xml)) !== null) {
    semuaPart.push({ id: mp[2].trim(), blok: mp[0] })
  }
  const partTerpilih = semuaPart.filter((p) => setAktif.has(p.id))
  if (partTerpilih.length === 0) return xml

  // Bila part pertama yang dipertahankan bukan part teratas asli (`semuaPart[0]`),
  // wariskan huruf latihan `[A]` & tanda tempo global dari `semuaPart[0]`.
  const idPartTeratasAsli = semuaPart[0]?.id
  const petaGlobal =
    semuaPart[0] && partTerpilih[0]?.id !== idPartTeratasAsli
      ? kumpulkanPetunjukGlobal(semuaPart[0].blok)
      : new Map<string, PetunjukBiramaGlobal>()

  // Susun `<part-list>` bersih tanpa `<part-group>` menggantung.
  const partListBaru =
    cocokPartList[1] +
    '\n    ' +
    scorePartTerpilih.map((p) => p.blok).join('\n    ') +
    '\n  ' +
    cocokPartList[3]

  let hasil = xml.replace(cocokPartList[0], () => partListBaru)

  let sudahPartPertama = false
  hasil = hasil.replace(rePart, (blokPenuh, _q: string, idMentah: string) => {
    const id = idMentah.trim()
    if (!setAktif.has(id)) return ''
    if (!sudahPartPertama) {
      sudahPartPertama = true
      if (petaGlobal.size > 0) {
        return sisipkanPetunjukGlobalKePart(blokPenuh, petaGlobal)
      }
    }
    return blokPenuh
  })

  // Rapikan baris kosong berlebih akibat penghapusan `<part>`.
  return hasil.replace(/\n{3,}/g, '\n\n')
}

/** Hitung panjang byte UTF-8 suatu string. */
function panjangUtf8(teks: string): number {
  return new TextEncoder().encode(teks).byteLength
}

/**
 * Bangun `LampiranPartiturPaket` dari bita berkas partitur yang tersimpan.
 * Mengembalikan `null` bila ukuran melebihi `batasBytes` agar paket tetap ramping.
 */
export function buatLampiranPartiturPaket(
  songId: string,
  namaFile: string,
  tipe: 'musicxml' | 'pdf',
  bita: Uint8Array,
  hash: string,
  batasBytes = BATAS_LAMPIRAN_PARTITUR_PAKET,
): LampiranPartiturPaket | null {
  if (bita.byteLength === 0 || bita.byteLength > batasBytes) return null
  if (tipe === 'musicxml') {
    const xml = teksPartitur(bita)
    if (!xml.trim()) return null
    return {
      songId,
      namaFile,
      tipe: 'musicxml',
      xml,
      ukuran: bita.byteLength,
      hash,
    }
  }
  return {
    songId,
    namaFile,
    tipe: 'pdf',
    base64: bitaKeBase64(bita),
    ukuran: bita.byteLength,
    hash,
  }
}

/** Ubah kembali `LampiranPartiturPaket` menjadi bita siap simpan ke `db.partiturBerkas`. */
export function bitaDariLampiranPartiturPaket(lampiran: LampiranPartiturPaket): Uint8Array | null {
  if (lampiran.tipe === 'musicxml' && typeof lampiran.xml === 'string' && lampiran.xml.trim()) {
    return new TextEncoder().encode(lampiran.xml)
  }
  if (lampiran.tipe === 'pdf' && typeof lampiran.base64 === 'string' && lampiran.base64.trim()) {
    const bita = base64KeBita(lampiran.base64)
    return bita.byteLength > 0 ? bita : null
  }
  return null
}

/** Ambil daftar `BagianPartitur` dari metadata lagu atau urai cepat dari XML bila kosong. */
function daftarPartLagu(song: Song | undefined, xml: string): BagianPartitur[] {
  if (song?.partitur?.parts && song.partitur.parts.length > 0) {
    return song.partitur.parts
  }
  const r = ringkasMusicXml(xml)
  return r.ok ? r.ringkas.parts : []
}

/**
 * Saring peta `partiturPaket` dan metadata `songs` untuk satu anggota tertentu.
 *
 * - Bila instrumen/seksi `anggota` cocok ke subset part pada skor MusicXML,
 *   XML dipangkas hanya ke part tersebut dan `Song.partitur` disesuaikan.
 * - Bila tidak ada kecocokan (`filter.jenis === 'semua'`) atau berkas berupa PDF,
 *   skor utuh dipertahankan apa adanya supaya anggota tidak pernah menemui jalan buntu.
 */
export function saringPartiturPaketUntukAnggota(
  peta: Record<string, LampiranPartiturPaket> | undefined,
  songs: Song[],
  anggota: Member,
  sections?: SectionDef[],
): {
  partiturPaket: Record<string, LampiranPartiturPaket> | undefined
  songs: Song[]
} {
  if (!peta || Object.keys(peta).length === 0) {
    return { partiturPaket: undefined, songs }
  }
  const petaLagu = new Map(songs.map((s) => [s.id, s]))
  const petaBaru: Record<string, LampiranPartiturPaket> = {}
  const laguDiubah = new Map<string, Song>()

  for (const [songId, lamp] of Object.entries(peta)) {
    if (!lamp) continue
    if (lamp.tipe !== 'musicxml' || !lamp.xml) {
      petaBaru[songId] = lamp
      continue
    }
    const song = petaLagu.get(songId)
    const parts = daftarPartLagu(song, lamp.xml)
    if (parts.length <= 1) {
      petaBaru[songId] = lamp
      continue
    }
    const filterAwal = pilihFilterAwalAnggota(parts, anggota, sections)
    const idAktif = daftarIdPartAktif(filterAwal.filter, parts)
    if (!idAktif || idAktif.length === 0 || idAktif.length >= parts.length) {
      petaBaru[songId] = lamp
      continue
    }
    const xmlPangkas = pangkasMusicXmlKePart(lamp.xml, idAktif)
    if (xmlPangkas === lamp.xml) {
      petaBaru[songId] = lamp
      continue
    }
    const ukuranBaru = panjangUtf8(xmlPangkas)
    const hashBaru = hashTeksCepat(xmlPangkas)
    petaBaru[songId] = {
      ...lamp,
      xml: xmlPangkas,
      ukuran: ukuranBaru,
      hash: hashBaru,
      partTersaring: idAktif,
    }
    if (song?.partitur) {
      const setAktif = new Set(idAktif)
      const partTersisa = parts.filter((p) => setAktif.has(p.id))
      laguDiubah.set(songId, {
        ...song,
        partitur: {
          ...song.partitur,
          ukuran: ukuranBaru,
          hash: hashBaru,
          jumlahPart: partTersisa.length,
          parts: partTersisa,
        },
      })
    }
  }

  const songsHasil =
    laguDiubah.size > 0 ? songs.map((s) => laguDiubah.get(s.id) ?? s) : songs

  return {
    partiturPaket: Object.keys(petaBaru).length > 0 ? petaBaru : undefined,
    songs: songsHasil,
  }
}
