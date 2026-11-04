/**
 * #27 — Pengurai XML ringan (pohon elemen) untuk modul murni yang dimuat malas.
 *
 * Dipakai konverter MuseScore (`mscz.ts`) dan penarik peta tempo partitur
 * (`petaPartitur.ts`). Keduanya berjalan di peramban **dan** di Node (uji
 * logika `qa/*-logika.mjs`), sedangkan `DOMParser` tidak ada di Node — jadi
 * pengurai kecil ini ditulis sendiri (*clean-room*), tanpa dependensi.
 *
 * Cakupan yang sengaja dibatasi: elemen, atribut, teks, entitas dasar &
 * numerik, CDATA, komentar, instruksi pemrosesan (`<?xml …?>`), dan DOCTYPE
 * sederhana dilewati. Isi campuran (*mixed content*) seperti
 * `<text><b>Allegro</b> <sym>metNoteQuarterUp</sym> = 120</text>` tetap
 * berurutan di `isi`, supaya teks tampilan bisa disusun ulang apa adanya.
 *
 * Galat tata bahasa dilempar sebagai `GalatXmlRingan` dengan kalimat Bahasa
 * Indonesia; pemanggil yang menangkapnya dan mengubahnya menjadi `{ ok: false }`.
 */

export interface ElemenXml {
  nama: string
  attr: Record<string, string>
  /** Anak berurutan: elemen atau potongan teks (entitas sudah diurai). */
  isi: (ElemenXml | string)[]
}

export class GalatXmlRingan extends Error {}

const ENTITAS: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }

/** Urai entitas `&amp;`, `&#38;`, `&#x26;`. Entitas tak dikenal dibiarkan apa adanya. */
export function dekodeEntitasXml(teks: string): string {
  if (teks.indexOf('&') < 0) return teks
  return teks.replace(/&(#x[0-9a-fA-F]+|#\d+|[A-Za-z][A-Za-z0-9]*);/g, (utuh, isi: string) => {
    if (isi[0] === '#') {
      const kode = isi[1] === 'x' || isi[1] === 'X' ? Number.parseInt(isi.slice(2), 16) : Number.parseInt(isi.slice(1), 10)
      return Number.isFinite(kode) && kode > 0 && kode <= 0x10ffff ? String.fromCodePoint(kode) : utuh
    }
    return ENTITAS[isi] ?? utuh
  })
}

/** Escape teks untuk ditulis kembali ke XML. */
export function escapeXml(teks: string): string {
  return teks
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const POLA_ATRIBUT = /([A-Za-z_:][A-Za-z0-9_.:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g

/**
 * Urai dokumen XML menjadi elemen akarnya.
 *
 * Melempar `GalatXmlRingan` bila dokumen tidak berimbang (tag tutup salah
 * pasang, akar tidak ada, atau ada dua akar).
 */
export function uraiXmlRingan(teks: string): ElemenXml {
  let i = 0
  const n = teks.length
  if (teks.charCodeAt(0) === 0xfeff) i = 1
  const tumpukan: ElemenXml[] = []
  let akar: ElemenXml | null = null

  const tambahTeks = (mentah: string) => {
    const atas = tumpukan[tumpukan.length - 1]
    if (!atas) {
      if (mentah.trim()) throw new GalatXmlRingan(`teks di luar elemen akar: "${mentah.trim().slice(0, 24)}"`)
      return
    }
    if (!mentah) return
    atas.isi.push(dekodeEntitasXml(mentah))
  }

  while (i < n) {
    const lt = teks.indexOf('<', i)
    if (lt < 0) {
      tambahTeks(teks.slice(i))
      break
    }
    if (lt > i) tambahTeks(teks.slice(i, lt))
    if (teks.startsWith('<!--', lt)) {
      const akhir = teks.indexOf('-->', lt + 4)
      if (akhir < 0) throw new GalatXmlRingan('komentar XML tidak ditutup')
      i = akhir + 3
      continue
    }
    if (teks.startsWith('<![CDATA[', lt)) {
      const akhir = teks.indexOf(']]>', lt + 9)
      if (akhir < 0) throw new GalatXmlRingan('CDATA tidak ditutup')
      const atas = tumpukan[tumpukan.length - 1]
      if (atas) atas.isi.push(teks.slice(lt + 9, akhir))
      i = akhir + 3
      continue
    }
    if (teks.startsWith('<?', lt)) {
      const akhir = teks.indexOf('?>', lt + 2)
      if (akhir < 0) throw new GalatXmlRingan('instruksi pemrosesan <?…?> tidak ditutup')
      i = akhir + 2
      continue
    }
    if (teks.startsWith('<!', lt)) {
      // DOCTYPE (boleh memuat subset internal [ … ]).
      let j = lt + 2
      let dalamKurung = 0
      while (j < n) {
        const c = teks[j]
        if (c === '[') dalamKurung += 1
        else if (c === ']') dalamKurung -= 1
        else if (c === '>' && dalamKurung <= 0) break
        j += 1
      }
      i = j + 1
      continue
    }
    if (teks[lt + 1] === '/') {
      const akhir = teks.indexOf('>', lt + 2)
      if (akhir < 0) throw new GalatXmlRingan('tag penutup tidak selesai')
      const nama = teks.slice(lt + 2, akhir).trim()
      const atas = tumpukan.pop()
      if (!atas || atas.nama !== nama) {
        throw new GalatXmlRingan(`tag penutup </${nama}> tidak cocok dengan <${atas?.nama ?? '—'}>`)
      }
      i = akhir + 1
      continue
    }
    // Tag pembuka — cari '>' di luar tanda kutip.
    let j = lt + 1
    let kutip = ''
    while (j < n) {
      const c = teks[j]
      if (kutip) {
        if (c === kutip) kutip = ''
      } else if (c === '"' || c === "'") kutip = c
      else if (c === '>') break
      j += 1
    }
    if (j >= n) throw new GalatXmlRingan('tag pembuka tidak selesai')
    let isiTag = teks.slice(lt + 1, j)
    const tutupSendiri = isiTag.endsWith('/')
    if (tutupSendiri) isiTag = isiTag.slice(0, -1)
    const m = /^([A-Za-z_:][A-Za-z0-9_.:-]*)/.exec(isiTag)
    if (!m) throw new GalatXmlRingan(`nama tag tidak sah: "<${isiTag.slice(0, 16)}"`)
    const el: ElemenXml = { nama: m[1], attr: {}, isi: [] }
    const sisaAttr = isiTag.slice(m[1].length)
    if (sisaAttr.trim()) {
      POLA_ATRIBUT.lastIndex = 0
      let a: RegExpExecArray | null
      while ((a = POLA_ATRIBUT.exec(sisaAttr)) !== null) {
        el.attr[a[1]] = dekodeEntitasXml(a[2] ?? a[3] ?? '')
      }
    }
    const induk = tumpukan[tumpukan.length - 1]
    if (induk) induk.isi.push(el)
    else {
      if (akar) throw new GalatXmlRingan(`elemen akar kedua <${el.nama}>`)
      akar = el
    }
    if (!tutupSendiri) tumpukan.push(el)
    i = j + 1
  }
  if (tumpukan.length > 0) throw new GalatXmlRingan(`elemen <${tumpukan[tumpukan.length - 1].nama}> tidak ditutup (berkas terpotong?)`)
  if (!akar) throw new GalatXmlRingan('tidak ada elemen akar XML')
  return akar
}

/* ------------------------------ Pembantu -------------------------------- */

/** Anak-anak elemen langsung (tanpa teks). */
export function anakElemen(el: ElemenXml | null | undefined, nama?: string): ElemenXml[] {
  if (!el) return []
  const out: ElemenXml[] = []
  for (const x of el.isi) {
    if (typeof x !== 'string' && (nama == null || x.nama === nama)) out.push(x)
  }
  return out
}

/** Anak langsung pertama bernama `nama`. */
export function anak(el: ElemenXml | null | undefined, nama: string): ElemenXml | null {
  if (!el) return null
  for (const x of el.isi) if (typeof x !== 'string' && x.nama === nama) return x
  return null
}

/** Seluruh teks keturunan, digabung berurutan. */
export function teksDalam(el: ElemenXml | null | undefined): string {
  if (!el) return ''
  let s = ''
  for (const x of el.isi) s += typeof x === 'string' ? x : teksDalam(x)
  return s
}

/** Teks anak langsung `nama` (dipangkas), atau `null` bila tidak ada. */
export function teksAnak(el: ElemenXml | null | undefined, nama: string): string | null {
  const a = anak(el, nama)
  return a ? teksDalam(a).trim() : null
}

/** Angka dari anak langsung `nama`, atau `null`. */
export function angkaAnak(el: ElemenXml | null | undefined, nama: string): number | null {
  const t = teksAnak(el, nama)
  if (t == null || t === '') return null
  const v = Number(t)
  return Number.isFinite(v) ? v : null
}

/** Cari keturunan pertama (pra-urut) bernama `nama`. */
export function cariKeturunan(el: ElemenXml | null | undefined, nama: string): ElemenXml | null {
  if (!el) return null
  for (const x of el.isi) {
    if (typeof x === 'string') continue
    if (x.nama === nama) return x
    const dalam = cariKeturunan(x, nama)
    if (dalam) return dalam
  }
  return null
}
