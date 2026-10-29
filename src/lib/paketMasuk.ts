/**
 * #7 & #13a — tulis paket anggota ke perangkat (dipakai dua pintu + perbarui situs).
 *
 * Dulunya logika ini hanya ada di `MemberView.openPackage` (halaman
 * Berbagi): baca teks, pisahkan bagian terkunci (`locked`) bila berkasnya
 * berkas terbit, simpan paketnya, kenali penerimanya. Pintu baru "Buka
 * berkas DrillKit" di mode anggota melakukan hal yang sama persis — jadi
 * intinya dipindah ke sini supaya kedua pintu tidak pernah berbeda perilaku.
 *
 * Di #13a, lampiran `partiturPaket` juga diekstrak langsung ke `db.partiturBerkas`
 * sehingga partitur lagu langsung siap dibaca luring di Mode Anggota tanpa
 * perlu memasang berkas `.musicxml` / `.mxl` secara terpisah, dan audio panduan
 * opsional di dalam ZIP paket juga ikut dipulihkan ke `db.rekamanAudio`.
 */
import { db } from '../db/db'
import type { PartiturBerkasItem, ShareBundle } from '../db/types'
import { bitaDariLampiranPartiturPaket } from './partiturPaket'
import type { DataTerkunci } from './terbit'
import { bukaZip } from './zip'

export interface HasilSimpanPaket {
  namaTim: string
  /** Penerima yang disebut berkasnya (berkas per anggota), bila ada. */
  penerima?: { id: string; nama: string }
  /** Bagian terkunci (berkas terbit); kosong untuk berkas biasa/lama. */
  locked: DataTerkunci
  /** #13a — jumlah berkas partitur yang ikut dipasang ke perangkat. */
  jumlahPartitur: number
}

/**
 * #13a — Pasang semua lampiran `partiturPaket` dari `ShareBundle` ke `db.partiturBerkas`.
 *
 * Mengikuti aturan urutan #11a §8: berkas ditulis lebih dulu sebelum metadata lagu,
 * dan penimpaan aman dalam satu transaksi `bulkPut` berkunci `id = songId`.
 */
export async function pasangPartiturDariPaket(
  paket: Pick<ShareBundle, 'partiturPaket'>,
): Promise<number> {
  const peta = paket.partiturPaket
  if (!peta || typeof peta !== 'object') return 0
  const baris: PartiturBerkasItem[] = []
  const sekarang = Date.now()
  for (const [kunciId, lamp] of Object.entries(peta)) {
    if (!lamp || typeof lamp !== 'object') continue
    const songId = lamp.songId || kunciId
    if (!songId) continue
    const bita = bitaDariLampiranPartiturPaket(lamp)
    if (!bita || bita.byteLength === 0) continue
    const mime =
      lamp.tipe === 'pdf' ? 'application/pdf' : 'application/vnd.recordare.musicxml+xml'
    const salinan = new Uint8Array(bita.byteLength)
    salinan.set(bita)
    baris.push({
      id: songId,
      songId,
      namaFile: lamp.namaFile || `${songId}.${lamp.tipe === 'pdf' ? 'pdf' : 'musicxml'}`,
      tipe: lamp.tipe === 'pdf' ? 'pdf' : 'musicxml',
      blob: new Blob([salinan.buffer], { type: mime }),
      ukuran: salinan.byteLength,
      hash: lamp.hash || `paket-${sekarang}`,
      updatedAt: sekarang,
    })
  }
  if (baris.length > 0) {
    await db.partiturBerkas.bulkPut(baris)
  }
  return baris.length
}

/**
 * #13a — Pulihkan entri `audio/*` dari ZIP paket anggota ke `db.rekamanAudio` bila ada.
 */
export async function pulihkanAudioDariZipPaket(bitaZip: Uint8Array): Promise<number> {
  let entri: { nama: string; bita: Uint8Array; teks: () => string }[]
  try {
    entri = bukaZip(bitaZip)
  } catch {
    return 0
  }
  let manifest: Record<string, { songId: string; namaFile: string; durasi?: number; hash?: string }> = {}
  const entriManifest = entri.find((z) => z.nama === 'audio/manifest.json')
  if (entriManifest) {
    try {
      manifest = JSON.parse(entriManifest.teks())
    } catch {
      // abaikan manifest rusak
    }
  }
  const sekarang = Date.now()
  let jumlah = 0
  for (const z of entri) {
    if (!z.nama.startsWith('audio/') || z.nama.endsWith('.json')) continue
    const m = manifest[z.nama]
    let songId = m?.songId
    let namaFile = m?.namaFile
    if (!songId) {
      const dasar = z.nama.replace(/^audio\//, '')
      const garis = dasar.indexOf('_')
      if (garis > 0) {
        songId = dasar.substring(0, garis)
        namaFile = dasar.substring(garis + 1)
      }
    }
    if (!songId || !namaFile) continue
    const salinan = new Uint8Array(z.bita.byteLength)
    salinan.set(z.bita)
    const blob = new Blob([salinan.buffer], { type: 'audio/mpeg' })
    await db.rekamanAudio.put({
      id: songId,
      songId,
      blob,
      namaFile,
      tipe: 'audio/mpeg',
      ukuran: blob.size,
      durasi: m?.durasi ?? 0,
      hash: m?.hash ?? '',
      updatedAt: sekarang,
    })
    jumlah += 1
  }
  return jumlah
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
  // #13a — pasang berkas partitur lebih dulu (aturan #11a §8: bita dulu, metadata kemudian).
  const jumlahPartitur = await pasangPartiturDariPaket(paket)
  if (paket.songs?.length) await db.songs.bulkPut(paket.songs)
  if (paket.setlists?.length) await db.setlists.bulkPut(paket.setlists)
  // Simpan paket ke `db.packages` tanpa menyalin ulang bita `partiturPaket` yang
  // sudah mendarat di `db.partiturBerkas` supaya kuota IndexedDB tetap hemat.
  const paketRingan: ShareBundle = paket.partiturPaket
    ? { ...paket, partiturPaket: undefined }
    : paket
  await db.packages.put({ key: 'current', data: paketRingan, importedAt: Date.now() })
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
    jumlahPartitur,
  }
}
