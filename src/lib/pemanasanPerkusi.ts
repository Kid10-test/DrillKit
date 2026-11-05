/**
 * #28 — Generator pemanasan battery ("Timing Grid") untuk metronom pola.
 *
 * Setiap latihan menghasilkan `PolaRitme` biasa (kotak diam/biasa/aksen)
 * plus `sticking` per kotak, jadi tetap diputar oleh mesin metronom yang sama
 * — tidak ada pemutar kedua. Latihan-latihan ini adalah materi umum pedagogi
 * drumline (bukan salinan buku/aplikasi tertentu) dan sengaja ringkas.
 */
import type { BiramaPola, LatihTempo, PolaRitme, TingkatKlik } from '../db/types'

export interface PemanasanPerkusi {
  id: string
  nama: string
  ringkas: string
  /** BPM awal & tujuan latih tempo yang disarankan. */
  dari: number
  ke: number
}

export const DAFTAR_PEMANASAN_PERKUSI: readonly PemanasanPerkusi[] = [
  {
    id: 'delapan-satu-tangan',
    nama: '8 on a Hand',
    ringkas: 'Not 1/8: R×8, L×8, 4-4, 2-2, lalu bergantian — keseragaman tinggi stik.',
    dari: 100,
    ke: 160,
  },
  {
    id: 'aksen-bergeser',
    nama: 'Aksen bergeser',
    ringkas: 'Not 1/16 bergantian; aksen pindah 1 → e → & → a tiap birama.',
    dari: 80,
    ke: 132,
  },
  {
    id: 'grid-4-2-1',
    nama: 'Grid 4-2-1',
    ringkas: 'Not 1/16: empat per tangan, dua per tangan, satu-satu, lalu gabungan.',
    dari: 80,
    ke: 140,
  },
  {
    id: 'triplet-diddle',
    nama: 'Triplet & diddle',
    ringkas: 'Triplet bergantian, lalu triplet dengan diddle (RLL / LRR).',
    dari: 90,
    ke: 150,
  },
] as const

function idAcak(): string {
  return `b_${Math.random().toString(36).slice(2, 8)}`
}

/** Pecah teks sticking ("RRLL RLRL") menjadi satu huruf per kotak. */
function pecah(teks: string): string[] {
  return teks.replace(/\s+/g, '').split('')
}

function birama(
  subdiv: number,
  sticking: string,
  label: string,
  aksen: (i: number) => boolean = (i) => i === 0,
): BiramaPola {
  const st = pecah(sticking)
  const beats = Math.max(1, Math.round(st.length / subdiv))
  const cells = st.map((_, i) => (aksen(i) ? 2 : 1) as TingkatKlik)
  return { id: idAcak(), beats, subdiv, cells, sticking: st, label }
}

/** Susun pola sebuah latihan. `null` bila id tidak dikenal. */
export function susunPemanasanPerkusi(
  id: string,
): { pola: PolaRitme; latih: LatihTempo; nama: string } | null {
  const def = DAFTAR_PEMANASAN_PERKUSI.find((d) => d.id === id)
  if (!def) return null
  let bars: BiramaPola[]
  switch (id) {
    case 'delapan-satu-tangan':
      bars = [
        birama(2, 'RRRRRRRR', 'R×8'),
        birama(2, 'LLLLLLLL', 'L×8'),
        birama(2, 'RRRRLLLL', '4-4'),
        birama(2, 'RRRRLLLL', '4-4'),
        birama(2, 'RRLLRRLL', '2-2'),
        birama(2, 'RRLLRRLL', '2-2'),
        birama(2, 'RLRLRLRL', 'Bergantian'),
        birama(2, 'RLRLRLRL', 'Bergantian'),
      ]
      break
    case 'aksen-bergeser':
      bars = ['1', 'e', '&', 'a'].map((nama, k) =>
        birama(4, 'RLRLRLRLRLRLRLRL', `Aksen di "${nama}"`, (i) => i % 4 === k),
      )
      break
    case 'grid-4-2-1':
      bars = [
        birama(4, 'RRRRLLLLRRRRLLLL', 'Empat'),
        birama(4, 'RRLLRRLLRRLLRRLL', 'Dua'),
        birama(4, 'RLRLRLRLRLRLRLRL', 'Satu'),
        birama(4, 'RRRRLLLLRRLLRLRL', '4-2-1'),
      ]
      break
    case 'triplet-diddle':
      bars = [
        birama(3, 'RLRLRLRLRLRL', 'Bergantian', (i) => i % 3 === 0),
        birama(3, 'RLRLRLRLRLRL', 'Bergantian', (i) => i % 3 === 0),
        birama(3, 'RLLRLLRLLRLL', 'Diddle kiri', (i) => i % 3 === 0),
        birama(3, 'LRRLRRLRRLRR', 'Diddle kanan', (i) => i % 3 === 0),
      ]
      break
    default:
      return null
  }
  const latih: LatihTempo = { on: true, dari: def.dari, ke: def.ke, langkah: 4, tiap: bars.length }
  return { pola: { bars, poly: null }, latih, nama: def.nama }
}

