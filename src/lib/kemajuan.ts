/**
 * K3 — kemajuan latihan: mencatat set (dan seksi) mana yang sudah dikuasai.
 *
 * Tujuannya sederhana: latihan marching band berjalan berminggu-minggu, jadi
 * pelatih perlu membuka kembali drill yang sama minggu depan dan langsung
 * tahu **di mana ia berhenti**. Centang per set, tersimpan per drill.
 *
 * Modul ini sengaja dipisah dari komponen supaya logika "kapan sebuah set
 * dianggap selesai" bisa diuji langsung di node, tanpa merender apa pun.
 */
import { db } from '../db/db'
import type { Kemajuan } from '../db/types'

/**
 * Kunci centang untuk **seluruh formasi**.
 *
 * Selain kunci ini, yang dipakai adalah id seksi — jadi satu set bisa
 * ditandai "Brass sudah, Battery belum".
 */
export const KUNCI_SEMUA = '*'

/* ------------------------------- Baca (murni) ----------------------------- */

/** Tanda centang untuk satu set: kunci → kapan dicentang. Bisa kosong. */
export function tandaSet(k: Kemajuan | undefined | null, setId: string): Record<string, number> {
  return k?.centang?.[setId] ?? {}
}

/** Apakah satu seksi (atau seluruh formasi) sudah ditandai pada set ini? */
export function seksiSelesai(
  k: Kemajuan | undefined | null,
  setId: string,
  kunci: string,
): boolean {
  const t = tandaSet(k, setId)
  return Boolean(t[KUNCI_SEMUA] || t[kunci])
}

/**
 * Apakah satu set sudah selesai seluruhnya?
 *
 * Selesai kalau ditandai `'*'`, **atau** tiap seksi di `daftarSeksi` sudah
 * ditandai sendiri-sendiri. Daftar seksi dibutuhkan di sini karena
 * "semuanya sudah" tidak bisa diketahui dari rekaman centang saja.
 */
export function setSelesai(
  k: Kemajuan | undefined | null,
  setId: string,
  daftarSeksi: string[],
): boolean {
  const t = tandaSet(k, setId)
  if (t[KUNCI_SEMUA]) return true
  if (!daftarSeksi.length) return false
  return daftarSeksi.every((s) => Boolean(t[s]))
}

/** Berapa set yang sudah selesai — untuk ringkasan "5/12". */
export function hitungSelesai(
  k: Kemajuan | undefined | null,
  setIds: string[],
  daftarSeksi: string[],
): number {
  return setIds.filter((id) => setSelesai(k, id, daftarSeksi)).length
}

/** Indeks set pertama yang belum selesai — titik sambung latihan berikutnya. */
export function cariLanjut(
  k: Kemajuan | undefined | null,
  setIds: string[],
  daftarSeksi: string[],
  dari = 0,
): number {
  for (let i = 0; i < setIds.length; i += 1) {
    const j = (dari + i) % setIds.length
    if (!setSelesai(k, setIds[j], daftarSeksi)) return j
  }
  return -1
}

/* --------------------------------- Tulis ---------------------------------- */

/**
 * Balik centang pada satu set untuk satu kunci.
 *
 * Mengembalikan rekaman yang baru tersimpan, supaya pemanggil tak perlu
 * membaca ulang. Menulis di sini **tidak** menyentuh `Drill`, jadi urutan
 * daftar drill tidak berubah.
 */
export async function tandai(
  drillId: string,
  setId: string,
  kunci: string,
  pada = Date.now(),
): Promise<Kemajuan> {
  const cur = (await db.kemajuan.get(drillId)) ?? { key: drillId, centang: {}, diubah: 0 }
  const t = { ...(cur.centang[setId] ?? {}) }
  if (t[kunci]) delete t[kunci]
  else t[kunci] = pada

  const centang = { ...cur.centang }
  // Set yang tidak punya centang lagi dibuang sekalian, supaya rekaman tidak
  // menumpuk sampah setiap kali centang dibuka-tutup.
  if (Object.keys(t).length) centang[setId] = t
  else delete centang[setId]

  const next: Kemajuan = { key: drillId, centang, diubah: Date.now() }
  await db.kemajuan.put(next)
  return next
}

/**
 * Bersihkan seluruh centang pada satu set.
 *
 * Dibutuhkan karena sebuah set bisa jadi "selesai" lewat dua jalan: ditandai
 * `'*'`, atau tiap seksi dicentang satu-satu. Tanpa ini, tidak ada cara untuk
 * membatalkan kemajuan set yang lengkap lewat jalan kedua — mencentang `'*'`
 * hanya menambah tanda, tidak pernah menguranginya.
 */
export async function bersihkanSet(drillId: string, setId: string): Promise<Kemajuan> {
  const cur = (await db.kemajuan.get(drillId)) ?? { key: drillId, centang: {}, diubah: 0 }
  const centang = { ...cur.centang }
  delete centang[setId]
  const next: Kemajuan = { key: drillId, centang, diubah: Date.now() }
  await db.kemajuan.put(next)
  return next
}

/** Hapus seluruh kemajuan satu drill — dipanggil saat drillnya dihapus. */
export async function hapusKemajuan(drillId: string): Promise<void> {
  await db.kemajuan.delete(drillId)
}

/**
 * Hapus centang milik satu set yang sudah dihapus.
 *
 * Tanpa ini, `centang[setId]` jadi yatim: tidak pernah dibaca, tetapi ikut
 * terbackup dan membuat "5/12" keliru kalau id-nya dipakai ulang.
 */
export async function hapusTandaSet(drillId: string, setId: string): Promise<void> {
  const cur = await db.kemajuan.get(drillId)
  if (!cur || !cur.centang[setId]) return
  const centang = { ...cur.centang }
  delete centang[setId]
  await db.kemajuan.put({ key: drillId, centang, diubah: Date.now() })
}
