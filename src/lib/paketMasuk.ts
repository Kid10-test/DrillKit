/**
 * #7 — tulis paket anggota ke perangkat (dipakai dua pintu).
 *
 * Dulunya logika ini hanya ada di `MemberView.openPackage` (halaman
 * Berbagi): baca teks, pisahkan bagian terkunci (`locked`) bila berkasnya
 * berkas terbit, simpan paketnya, kenali penerimanya. Pintu baru "Buka
 * berkas DrillKit" di mode anggota melakukan hal yang sama persis — jadi
 * intinya dipindah ke sini supaya kedua pintu tidak pernah berbeda perilaku.
 */
import { db } from '../db/db'
import type { ShareBundle } from '../db/types'
import type { DataTerkunci } from './terbit'

export interface HasilSimpanPaket {
  namaTim: string
  /** Penerima yang disebut berkasnya (berkas per anggota), bila ada. */
  penerima?: { id: string; nama: string }
  /** Bagian terkunci (berkas terbit); kosong untuk berkas biasa/lama. */
  locked: DataTerkunci
}

/**
 * Simpan paket yang sudah diparse. Menolak (`throw`) bila bukan paket
 * DrillKit — pemanggil yang mengubahnya menjadi pesan manusiawi.
 */
export async function simpanPaketAnggota(
  data: (ShareBundle & { locked?: DataTerkunci }) | null | undefined,
): Promise<HasilSimpanPaket> {
  if (!data || typeof data !== 'object' || data.format !== 'drillkit-share') {
    throw new Error('Bukan berkas paket DrillKit')
  }
  const locked: DataTerkunci =
    data.locked && typeof data.locked === 'object' && !Array.isArray(data.locked)
      ? data.locked
      : {}
  const { locked: _buang, ...grup } = data
  const paket = grup as ShareBundle
  await db.packages.put({ key: 'current', data: paket, importedAt: Date.now() })
  // Selaraskan dengan `perbarui()` di `Share.tsx`: lagu & set list di dalam paket
  // juga ditulis ke `db.songs` dan `db.setlists` supaya tab Musik mode anggota
  // memperoleh repertoar (termasuk metadata `song.partitur`) saat paket dibuka
  // dari berkas lokal/WhatsApp, bukan hanya saat diambil lewat URL `paket.json`.
  if (paket.songs?.length) await db.songs.bulkPut(paket.songs)
  if (paket.setlists?.length) await db.setlists.bulkPut(paket.setlists)
  const penerima = (paket.members ?? []).find(
    (m) => paket.forMember != null && m.id === paket.forMember,
  )
  // Beri tahu tampilan anggota (meId + bagian terkunci dipegang sebagai
  // state, jadi tidak ikut segar oleh live query basis data).
  try {
    window.dispatchEvent(
      new CustomEvent('drillkit:paket-baru', {
        detail: { penerimaId: penerima?.id ?? null, locked },
      }),
    )
  } catch {
    // bukan peramban (uji node) — abaikan
  }
  return {
    namaTim: paket.team?.teamName ?? 'tim',
    penerima: penerima ? { id: penerima.id, nama: penerima.name } : undefined,
    locked,
  }
}
