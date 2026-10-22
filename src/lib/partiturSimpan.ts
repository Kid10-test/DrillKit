/**
 * #11a — tulisan basis data untuk partitur (Blob MusicXML/PDF).
 *
 * Dipisah dari `partitur.ts` dengan alasan yang sama `pywareTulis.ts` dipisah
 * dari `pyware.ts`: `partitur.ts` harus tetap **murni** — ia dirakit
 * `qa/bangun-logika.sh` dan diuji di node tanpa peramban, dan Dexie di
 * dalamnya akan membuat bundel uji itu ikut menarik basis data. Berkas ini
 * yang menyentuh Dexie, Blob, dan hash.
 *
 * Urutan penyimpanan yang dipegang (§8 rancangan 11a):
 *
 * 1. **Berkas dulu, metadata kemudian** — kalau langkah metadata gagal,
 *    yang tertinggal adalah Blob tanpa rujukan, bukan rujukan tanpa bita.
 * 2. **Mengganti tidak pernah menghapus lebih dulu.** Kunci store ini adalah
 *    `songId`, jadi `put` menimpa Blob lama dalam satu langkah — tidak ada
 *    jendela waktu ketika keduanya hilang (itu yang diperingatkan §8 kalau
 *    hapus-lalu-tulis dipakai).
 * 3. **Melepas: metadata kosong dulu, Blob kemudian.** Kebalikannya akan
 *    meninggalkan lagu yang menyebut berkas yang sudah tidak ada.
 */
import { db } from '../db/db'
import type { PartiturBerkasItem, PartiturMeta } from '../db/types'
import { hitungHashAudio } from './rekaman'
import { putusanPartitur, type PutusanPartitur } from './partitur'

/** Hasil memasang berkas: metadata siap disimpan + baris store-nya + putusan D1/D4. */
export interface HasilPasangPartitur {
  meta: PartiturMeta
  item: PartiturBerkasItem
  /** Putusan `putusanPartitur` — pemanggil memakainya untuk pesan D1/D4. */
  putusan: PutusanPartitur
}

/**
 * Susun metadata dari putusan pemindai. Bidang ringkasan diisi **hanya** bila
 * putusannya menghasilkan ringkasan; kalau tidak, angkanya 0 dan daftarnya
 * kosong — bukan angka karangan.
 *
 * `terurai` berarti "ada ringkasan struktur yang bisa dibaca":
 *
 * - `false` + `ringkasGagal` → XML yang menjegal pemindai (D4).
 * - `false` tanpa `ringkasGagal` → PDF; memang tidak ada yang bisa diringkas,
 *   dan itu bukan kegagalan.
 */
export function metaDariPutusan(
  namaFile: string,
  ukuran: number,
  hash: string,
  putusan: PutusanPartitur,
  dipasangiAt: number,
): PartiturMeta {
  const r = putusan.ringkas ?? null
  return {
    namaFile,
    // Putusan yang boleh dipasang selalu punya tipe (musicxml/pdf).
    tipe: putusan.tipe === 'pdf' ? 'pdf' : 'musicxml',
    ukuran,
    hash,
    susunan: r?.susunan,
    judul: r?.judul,
    pengarang: r?.pengarang,
    jumlahBirama: r?.jumlahBirama ?? 0,
    jumlahPart: r?.jumlahPart ?? 0,
    parts: r?.parts ?? [],
    sukat: r?.sukat,
    perubahanSukat: r?.perubahanSukat ?? [],
    tempo: r?.tempo,
    terurai: r != null,
    ringkasGagal: putusan.ringkasGagal,
    dipasangiAt,
  }
}

/**
 * Periksa sebuah berkas **tanpa menyimpan apa pun** — dipakai pratinjau
 * "pasang dulu, tulis kemudian" (§6 rancangan 11a).
 *
 * Galat tidak dilempar: berkas yang ditolak D1 dikembalikan sebagai putusan
 * `boleh: false` dengan alasannya, supaya pemanggil menampilkannya apa adanya.
 */
export async function periksaPartitur(file: Blob): Promise<{
  putusan: PutusanPartitur
  hash: string
  ukuran: number
}> {
  const ab = await file.arrayBuffer()
  const bita = new Uint8Array(ab)
  const putusan = putusanPartitur(bita)
  return { putusan, hash: await hitungHashAudio(bita), ukuran: file.size || ab.byteLength }
}

/**
 * Simpan bita partitur ke IndexedDB **beserta** metadatanya, dan kembalikan
 * keduanya. `Song.partitur` ditulis pemanggil (pola `simpanRekamanAudio` #6):
 * modul ini tidak ikut mengubah lagu, supaya satu alur tulis lagu tetap ada
 * di satu tempat.
 *
 * Menolak (melempar) bila putusan partitur berkata tidak boleh dipasang —
 * satu-satunya kemungkinan saat ini `.mxl` (D1). Pesannya persis pesan
 * petunjuk dari `partitur.ts`, jadi UI tidak perlu menyusunnya lagi.
 */
export async function simpanPartiturBerkas(
  songId: string,
  file: Blob,
  namaFile: string,
  sekarang = Date.now(),
): Promise<HasilPasangPartitur> {
  const { putusan, hash, ukuran } = await periksaPartitur(file)
  if (!putusan.boleh) {
    throw new Error(putusan.alasan ?? 'Berkas ini tidak bisa dipasang sebagai partitur.')
  }

  const item: PartiturBerkasItem = {
    id: songId,
    songId,
    blob: file,
    namaFile,
    tipe: putusan.tipe === 'pdf' ? 'pdf' : 'musicxml',
    ukuran,
    hash,
    updatedAt: sekarang,
  }

  await db.partiturBerkas.put(item)

  return { meta: metaDariPutusan(namaFile, ukuran, hash, putusan, sekarang), item, putusan }
}

/** Berkas partitur yang tersimpan di perangkat ini untuk satu lagu. */
export async function muatPartiturBerkas(songId: string): Promise<PartiturBerkasItem | undefined> {
  return db.partiturBerkas.get(songId)
}

/** Hapus bita partitur. Metadata lagunya diurus pemanggil (§8 butir 3). */
export async function hapusPartiturBerkas(songId: string): Promise<void> {
  await db.partiturBerkas.delete(songId)
}
