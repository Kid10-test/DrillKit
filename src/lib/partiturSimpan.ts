/**
 * #11a & #11b — tulisan basis data untuk partitur (Blob MusicXML/PDF + urai .mxl).
 *
 * Dipisah dari `partitur.ts` & `mxl.ts` dengan alasan yang sama `pywareTulis.ts`
 * dipisah dari `pyware.ts`: `partitur.ts` dan `mxl.ts` harus tetap **murni**
 * (dirakit `qa/bangun-logika.sh` dan diuji di node tanpa peramban), sedangkan
 * berkas ini yang menyentuh Dexie, Blob, dan hash.
 *
 * Urutan penyimpanan yang dipegang (§8 rancangan 11a & §3.1 rancangan 11b):
 *
 * 1. **Berkas dulu, metadata kemudian** — kalau langkah metadata gagal,
 *    yang tertinggal adalah Blob tanpa rujukan, bukan rujukan tanpa bita.
 * 2. **Mengganti tidak pernah menghapus lebih dulu.** Kunci store ini adalah
 *    `songId`, jadi `put` menimpa Blob lama dalam satu langkah — tidak ada
 *    jendela waktu ketika keduanya hilang.
 * 3. **Melepas: metadata kosong dulu, Blob kemudian.** Kebalikannya akan
 *    meninggalkan lagu yang menyebut berkas yang sudah tidak ada.
 * 4. **`.mxl` diurai di pintu masuk menjadi `.musicxml` tak terkompresi (#11b D3):**
 *    yang disimpan ke `partiturBerkas` dan dikemas ke ZIP backup selalu bita
 *    MusicXML hasil urai (`tipe: 'musicxml'`), sehingga tidak butuh migrasi
 *    Dexie dan tetap bisa dibuka di perangkat penerima backup ber-peramban lama.
 */
import { db } from '../db/db'
import type { PartiturBerkasItem, PartiturMeta } from '../db/types'
import { apakahMxl, namaMusicXmlDariMxl, uraiMxl } from './mxl'
import { putusanPartitur, type PutusanPartitur } from './partitur'
import { hitungHashAudio } from './rekaman'

/** Hasil memasang berkas: metadata siap disimpan + baris store-nya + putusan. */
export interface HasilPasangPartitur {
  meta: PartiturMeta
  item: PartiturBerkasItem
  /** Putusan `putusanPartitur` — pemanggil memakainya untuk pesan peringatan/D4. */
  putusan: PutusanPartitur
}

/** Hasil `periksaPartitur` sebelum apa pun ditulis ke basis data. */
export interface HasilPeriksaPartitur {
  putusan: PutusanPartitur
  hash: string
  ukuran: number
  /**
   * Blob yang siap disimpan ke `partiturBerkas`. Untuk `.musicxml`/`.pdf`
   * sama dengan berkas masukan; untuk `.mxl` berisi bita XML hasil urai.
   */
  blobSiap: Blob
  /** Nama simpan ternormalisasi (mis. `pembuka.mxl` → `pembuka.musicxml`). */
  namaSimpan: string
  /** `true` bila berkas masukan berasal dari arsip `.mxl` yang berhasil dibuka. */
  dariMxl: boolean
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
 * "pasang dulu, tulis kemudian" (§6 rancangan 11a & §3.3 rancangan 11b).
 *
 * Bila berkas masukan adalah `.mxl`, ia diurai di memori lewat `uraiMxl` dan
 * dikembalikan sebagai `blobSiap` tak terkompresi beserta `namaSimpan`
 * berekstensi `.musicxml`. Galat tidak dilempar: berkas rusak dikembalikan
 * sebagai `putusan.boleh === false` dengan alasannya.
 */
export async function periksaPartitur(
  file: Blob,
  namaFile = 'partitur.musicxml',
): Promise<HasilPeriksaPartitur> {
  const ab = await file.arrayBuffer()
  const bita = new Uint8Array(ab)

  if (apakahMxl(bita)) {
    const urai = await uraiMxl(bita)
    if (!urai.ok) {
      return {
        putusan: { boleh: false, tipe: 'mxl', alasan: urai.alasan },
        hash: await hitungHashAudio(bita),
        ukuran: file.size || ab.byteLength,
        blobSiap: file,
        namaSimpan: namaFile,
        dariMxl: false,
      }
    }
    const bitaXml = urai.bitaXml
    const putusan = putusanPartitur(bitaXml)
    const hash = await hitungHashAudio(bitaXml)
    const ukuran = bitaXml.byteLength
    const salinanBuffer = new Uint8Array(ukuran)
    salinanBuffer.set(bitaXml)
    const blobSiap = new Blob([salinanBuffer], {
      type: 'application/vnd.recordare.musicxml+xml',
    })
    return {
      putusan,
      hash,
      ukuran,
      blobSiap,
      namaSimpan: namaMusicXmlDariMxl(namaFile),
      dariMxl: true,
    }
  }

  const putusan = putusanPartitur(bita)
  return {
    putusan,
    hash: await hitungHashAudio(bita),
    ukuran: file.size || ab.byteLength,
    blobSiap: file,
    namaSimpan: namaFile,
    dariMxl: false,
  }
}

/**
 * Simpan bita partitur ke IndexedDB **beserta** metadatanya, dan kembalikan
 * keduanya. `Song.partitur` ditulis pemanggil (pola `simpanRekamanAudio` #6):
 * modul ini tidak ikut mengubah lagu, supaya satu alur tulis lagu tetap ada
 * di satu tempat.
 *
 * Menolak (melempar) bila berkas tidak sah atau `.mxl` rusak.
 */
export async function simpanPartiturBerkas(
  songId: string,
  file: Blob,
  namaFile: string,
  sekarang = Date.now(),
): Promise<HasilPasangPartitur> {
  const { putusan, hash, ukuran, blobSiap, namaSimpan } = await periksaPartitur(file, namaFile)
  if (!putusan.boleh) {
    throw new Error(putusan.alasan ?? 'Berkas ini tidak bisa dipasang sebagai partitur.')
  }

  const item: PartiturBerkasItem = {
    id: songId,
    songId,
    blob: blobSiap,
    namaFile: namaSimpan,
    tipe: putusan.tipe === 'pdf' ? 'pdf' : 'musicxml',
    ukuran,
    hash,
    updatedAt: sekarang,
  }

  await db.partiturBerkas.put(item)

  return { meta: metaDariPutusan(namaSimpan, ukuran, hash, putusan, sekarang), item, putusan }
}

/** Berkas partitur yang tersimpan di perangkat ini untuk satu lagu. */
export async function muatPartiturBerkas(songId: string): Promise<PartiturBerkasItem | undefined> {
  return db.partiturBerkas.get(songId)
}

/** Hapus bita partitur. Metadata lagunya diurus pemanggil (§8 butir 3). */
export async function hapusPartiturBerkas(songId: string): Promise<void> {
  await db.partiturBerkas.delete(songId)
}
