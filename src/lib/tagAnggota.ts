/**
 * #23.2 — Sistem `Tags` Lintas-Seksi Terpadu.
 *
 * Satu label lintas-seksi (mis. "Solois", "Sayap Kiri", "FTL Tuba") disimpan
 * pada `Member.tags` dan langsung melayani tiga kebutuhan tanpa tumpang tindih:
 *  1. Seleksi & penyaringan cepat 1-klik di editor formasi.
 *  2. Timpaan warna (`#hex` murni) & bentuk geometri titik per-drill atau per-set.
 *  3. Sumber anggota otomatis bagi jalur sub-kelompok / FTL (`GerakKelompok.tag`).
 */

import type { BentukTitikTag, Member, TimpaanTampilanTag } from '../db/types'

/** Palet warna #hex murni (bebas oklch/rgba, aman untuk ekspor SVG & cetak PDF). */
export const PALET_WARNA_TAG: readonly { hex: string; nama: string }[] = [
  { hex: '#f43f5e', nama: 'Merah Mawar' },
  { hex: '#f59e0b', nama: 'Emas Amber' },
  { hex: '#10b981', nama: 'Zamrud' },
  { hex: '#38bdf8', nama: 'Biru Langit' },
  { hex: '#a855f7', nama: 'Ungu' },
  { hex: '#ec4899', nama: 'Magenta' },
  { hex: '#f8fafc', nama: 'Putih Terang' },
] as const

export const DAFTAR_BENTUK_TAG: readonly {
  id: BentukTitikTag
  label: string
  simbol: string
}[] = [
  { id: 'bulat', label: 'Bulat', simbol: '●' },
  { id: 'kotak', label: 'Kotak', simbol: '■' },
  { id: 'intan', label: 'Intan', simbol: '◆' },
  { id: 'segitiga', label: 'Segitiga', simbol: '▲' },
] as const

/** Rapikan satu teks tag: pangkas spasi ganda, buang awalan `#` bila diketik. */
export function bersihkanSatuTag(mentah: string): string {
  return mentah
    .trim()
    .replace(/^#+/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Normalisasi daftar tag anggota: buang entri kosong dan duplikat tanpa membedakan
 * huruf besar/kecil (penulisan pertama dipertahankan).
 */
export function normalisasiDaftarTag(
  masukan: readonly string[] | string | undefined | null,
): string[] {
  if (!masukan) return []
  const sumber = typeof masukan === 'string' ? masukan.split(/[,;\n]+/) : masukan
  const lihat = new Set<string>()
  const hasil: string[] = []
  for (const butir of sumber) {
    const rapi = bersihkanSatuTag(String(butir ?? ''))
    if (!rapi) continue
    const kunci = rapi.toLowerCase()
    if (lihat.has(kunci)) continue
    lihat.add(kunci)
    hasil.push(rapi)
  }
  return hasil
}

/** Urai input teks berpemisah koma/titik-koma menjadi daftar tag bersih. */
export function uraiInputTag(teks: string): string[] {
  return normalisasiDaftarTag(teks)
}

/** Gabungkan beberapa daftar tag (mis. saat menggabung anggota ganda). */
export function gabungDaftarTag(
  ...daftar: Array<readonly string[] | undefined | null>
): string[] | undefined {
  const rata: string[] = []
  for (const d of daftar) {
    if (d?.length) rata.push(...d)
  }
  const rapi = normalisasiDaftarTag(rata)
  return rapi.length > 0 ? rapi : undefined
}

/** Apakah anggota memegang `tag` tertentu (tidak peka huruf besar/kecil)? */
export function punyaTag(
  anggota: Pick<Member, 'tags'> | undefined | null,
  tag: string,
): boolean {
  const target = bersihkanSatuTag(tag).toLowerCase()
  if (!target || !anggota?.tags?.length) return false
  return anggota.tags.some((t) => bersihkanSatuTag(t).toLowerCase() === target)
}

/** Tambahkan satu tag ke salinan `Member` (idempoten). */
export function pasangTagKeAnggota<T extends Pick<Member, 'tags'>>(
  anggota: T,
  tagBaru: string,
): T {
  const rapi = normalisasiDaftarTag([...(anggota.tags ?? []), tagBaru])
  return { ...anggota, tags: rapi.length ? rapi : undefined }
}

/** Lepaskan satu tag dari salinan `Member`. */
export function lepasTagDariAnggota<T extends Pick<Member, 'tags'>>(
  anggota: T,
  tagHapus: string,
): T {
  const kunci = bersihkanSatuTag(tagHapus).toLowerCase()
  const sisa = normalisasiDaftarTag(
    (anggota.tags ?? []).filter((t) => bersihkanSatuTag(t).toLowerCase() !== kunci),
  )
  return { ...anggota, tags: sisa.length ? sisa : undefined }
}

/** Kumpulkan seluruh tag unik pada roster drill beserta urutan `memberIds`-nya. */
export function kumpulkanTagRoster(
  roster: readonly Pick<Member, 'id' | 'tags'>[],
): { tag: string; memberIds: string[] }[] {
  const peta = new Map<string, { tag: string; memberIds: string[] }>()
  for (const m of roster) {
    for (const mentah of m.tags ?? []) {
      const rapi = bersihkanSatuTag(mentah)
      if (!rapi) continue
      const kunci = rapi.toLowerCase()
      const ada = peta.get(kunci)
      if (ada) {
        if (!ada.memberIds.includes(m.id)) ada.memberIds.push(m.id)
      } else {
        peta.set(kunci, { tag: rapi, memberIds: [m.id] })
      }
    }
  }
  return [...peta.values()].sort((a, b) => a.tag.localeCompare(b.tag, 'id'))
}

function cariTimpaan(
  peta: Record<string, TimpaanTampilanTag> | undefined,
  tag: string,
): TimpaanTampilanTag | undefined {
  if (!peta) return undefined
  if (peta[tag]) return peta[tag]
  const kunci = bersihkanSatuTag(tag).toLowerCase()
  for (const [k, v] of Object.entries(peta)) {
    if (bersihkanSatuTag(k).toLowerCase() === kunci) return v
  }
  return undefined
}

/**
 * Hitung warna `#hex` dan bentuk geometri efektif sebuah titik pemain pada set aktif.
 *
 * Urutan prioritas:
 *  1. `tampilanSet` (timpaan khusus pada set aktif, mis. sorot "Solois" hanya di Set 4)
 *  2. `tampilanDrill` (gaya bawaan tag di seluruh drill)
 *  3. Warna `section` bawaan & bentuk `'bulat'`.
 */
export function gayaTitikPemain(
  anggota: Pick<Member, 'tags'> | undefined | null,
  warnaSection: string,
  tampilanDrill?: Record<string, TimpaanTampilanTag>,
  tampilanSet?: Record<string, TimpaanTampilanTag>,
): { warna: string; bentuk: BentukTitikTag; tagAktif?: string } {
  const bawaan = { warna: warnaSection, bentuk: 'bulat' as BentukTitikTag }
  if (!anggota?.tags?.length) return bawaan

  for (const tag of anggota.tags) {
    const tSet = cariTimpaan(tampilanSet, tag)
    if (tSet && (tSet.warna || (tSet.bentuk && tSet.bentuk !== 'bulat'))) {
      return {
        warna: tSet.warna || warnaSection,
        bentuk: tSet.bentuk ?? 'bulat',
        tagAktif: bersihkanSatuTag(tag),
      }
    }
  }

  for (const tag of anggota.tags) {
    const tDrill = cariTimpaan(tampilanDrill, tag)
    if (tDrill && (tDrill.warna || (tDrill.bentuk && tDrill.bentuk !== 'bulat'))) {
      return {
        warna: tDrill.warna || warnaSection,
        bentuk: tDrill.bentuk ?? 'bulat',
        tagAktif: bersihkanSatuTag(tag),
      }
    }
  }

  return bawaan
}

/** Titik-titik `points` SVG `<polygon>` untuk bentuk titik `'intan'` atau `'segitiga'`. */
export function poligonBentukTitik(
  bentuk: 'intan' | 'segitiga',
  cx: number,
  cy: number,
  r: number,
): string {
  if (bentuk === 'intan') {
    const d = r * 1.22
    return `${cx},${cy - d} ${cx + d},${cy} ${cx},${cy + d} ${cx - d},${cy}`
  }
  const rAtas = r * 1.28
  const dx = r * 1.15
  const dyBawah = r * 0.92
  return `${cx},${cy - rAtas} ${cx + dx},${cy + dyBawah} ${cx - dx},${cy + dyBawah}`
}
