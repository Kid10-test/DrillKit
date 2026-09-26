/**
 * F3 — Berkas show: ekspor & impor **satu show** (drill + set + lagu + anggota).
 *
 * Beda dengan "paket anggota" (`ShareBundle` di halaman Berbagi) yang bersifat
 * **satu arah & hanya untuk dilihat**, berkas show ini **dua arah dan bisa
 * disunting**: pelatih mengekspor show, pelatih lain membuka & menyusun set di
 * perangkatnya, lalu mengirim balik berkasnya untuk digabungkan lagi.
 *
 * Yang ikut dalam satu berkas:
 * - **drill** — nama, ukuran lapangan, tempo, penanda lapangan (A7)
 * - **sets** — semua set milik drill itu, lengkap dengan titik tiap pemain
 * - **songs** — repertoar lagu, supaya pola metronom (E3) ikut pindah
 * - **members** — anggota aktif; **token QR dibuang** saat ekspor dan dibuatkan
 *   baru saat impor, jadi kartu absensi tidak pernah ikut berpindah.
 *
 * Saat mengimpor, anggota yang id-nya sudah ada **tidak pernah ditimpa**.
 * Yang belum dikenal tidak lagi langsung ditambahkan: layar "Cocokkan
 * anggota" (`PanelCocok`) memetakan id berkas ke id lokal lebih dulu, lalu
 * fungsi ini hanya menambah yang memang dipilih sebagai anggota baru.
 */

import { db } from '../db/db'
import type { Drill, DrillSet, Member, Song } from '../db/types'
import { slugify, uid } from './utils'

/** Penanda format berkas — dipakai untuk menolak berkas yang salah. */
const FORMAT = 'drillkit-show'
const VERSI = 1

export interface BerkasShow {
  format: typeof FORMAT
  versi: number
  /** kapan berkas dibuat (ms) */
  dibuat: number
  /** nama tim pengirim — supaya jelas asal berkasnya */
  tim: string
  drill: Drill
  sets: DrillSet[]
  songs: Song[]
  members: Member[]
}

/** Pilihan saat mengimpor berkas show. */
export type ModeImpor = 'ganti' | 'gabung' | 'salinan'

export const LABEL_MODE: Record<ModeImpor, string> = {
  ganti: 'Timpa show yang sama',
  gabung: 'Gabungkan set-nya',
  salinan: 'Simpan sebagai show baru',
}

export const KETERANGAN_MODE: Record<ModeImpor, string> = {
  ganti: 'Set lama di show ini diganti seluruhnya dengan isi berkas.',
  gabung: 'Set yang sama diperbarui, set baru ditambahkan, set yang hanya ada di sini tetap dipertahankan.',
  salinan: 'Dibuat show baru dengan nama sendiri — show yang sudah ada tidak disentuh.',
}

/**
 * Susun berkas show untuk satu drill.
 * `members` diisi anggota aktif (tanpa token), supaya titik di setiap set
 * tetap punya nama & section saat dibuka di perangkat lain.
 */
export async function susunBerkasShow(drillId: string, namaTim: string): Promise<BerkasShow | null> {
  const drill = await db.drills.get(drillId)
  if (!drill) return null
  const sets = await db.sets.where('drillId').equals(drillId).toArray()
  const songs = await db.songs.toArray()
  const members = await db.members.toArray()
  return {
    format: FORMAT,
    versi: VERSI,
    dibuat: Date.now(),
    tim: namaTim,
    // Token QR sengaja dibuang — cuma perangkat pelatih yang perlu memindainya.
    members: members.filter((m) => m.active).map(({ token: _token, ...rest }) => ({ ...rest, token: '' })),
    drill,
    sets: sets.sort((a, b) => a.order - b.order),
    songs,
  }
}

/** Nama berkas yang rapi, mis. `opening-number-show-2026-09-16.json`. */
export function namaBerkasShow(namaDrill: string, tanggal = new Date()) {
  return `${slugify(namaDrill) || 'show'}-show-${tanggal.toISOString().slice(0, 10)}.json`
}

/** Periksa berkas hasil impor. Mengembalikan pesan galat, atau null kalau sah. */
export function cekBerkas(data: unknown): string | null {
  if (!data || typeof data !== 'object') return 'Berkas tidak bisa dibaca'
  const d = data as Partial<BerkasShow>
  if (d.format !== FORMAT) return 'Bukan berkas show DrillKit (format tidak dikenal)'
  if (d.versi !== VERSI) return `Versi berkas ${d.versi ?? '?'} belum didukung (yang dikenal: ${VERSI})`
  if (!d.drill || typeof d.drill.id !== 'string' || !d.drill.name) return 'Data drill di dalam berkas tidak lengkap'
  if (!Array.isArray(d.sets)) return 'Daftar set di dalam berkas tidak lengkap'
  for (const s of d.sets) {
    if (!s || typeof s.id !== 'string' || typeof s.points !== 'object' || s.points === null) {
      return 'Ada set di dalam berkas yang rusak'
    }
  }
  return null
}

/** Ringkasan isi berkas, ditampilkan sebelum memilih cara mengimpor. */
export function ringkasBerkas(data: BerkasShow) {
  return {
    nama: data.drill.name,
    judul: data.drill.showTitle || '',
    tim: data.tim || '—',
    jumlahSet: data.sets.length,
    jumlahAnggota: Object.keys(
      data.sets.reduce<Record<string, 1>>((ak, s) => {
        for (const id of Object.keys(s.points ?? {})) ak[id] = 1
        return ak
      }, {}),
    ).length,
    jumlahLagu: data.songs?.length ?? 0,
    dibuat: data.dibuat,
  }
}

export interface HasilImpor {
  drillId: string
  nama: string
  setDitulis: number
  setDihapus: number
  anggotaBaru: number
  laguBaru: number
}

/**
 * Terapkan berkas show ke database.
 *
 * - `ganti`   — set lama show ini dihapus, diganti isi berkas
 * - `gabung`  — set di perangkat ini diperbarui & ditambah, yang tidak ada di
 *               berkas tetap dipertahankan
 * - `salinan` — show baru dengan id & nama sendiri; show lama tidak disentuh
 */
export async function imporShow(data: BerkasShow, mode: ModeImpor): Promise<HasilImpor> {
  const salah = cekBerkas(data)
  if (salah) throw new Error(salah)

  /* ---------------- Anggota: tambah yang belum ada ---------------- */
  const idAnggotaAda = new Set((await db.members.toArray()).map((m) => m.id))
  const anggotaBaru: Member[] = (data.members ?? [])
    .filter((m) => m && m.id && !idAnggotaAda.has(m.id))
    .map((m) => ({ ...m, token: uid('t_'), active: m.active ?? 1 }))
  if (anggotaBaru.length) await db.members.bulkPut(anggotaBaru)

  /* ---------------- Lagu: gabung per id ---------------- */
  const idLaguAda = new Set((await db.songs.toArray()).map((s) => s.id))
  const laguBaru = (data.songs ?? []).filter((s) => s && s.id && !idLaguAda.has(s.id)).length
  if (data.songs?.length) await db.songs.bulkPut(data.songs.filter((s) => s && s.id))

  /* ---------------- Drill ---------------- */
  let drillId = data.drill.id
  let nama = data.drill.name

  if (mode === 'salinan') {
    drillId = uid('dr_')
    nama = `${data.drill.name} (dari ${data.tim || 'berkas'})`
    await db.drills.put({
      ...data.drill,
      id: drillId,
      name: nama,
      rosterIds: [...(data.drill.rosterIds ?? [])],
      markers: (data.drill.markers ?? []).map((m) => ({ ...m })),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    // Set ikut jadi milik show baru, dengan id baru supaya tidak tabrakan.
    const sets: DrillSet[] = data.sets
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((s, i) => ({ ...s, id: uid('st_'), drillId, order: i, points: { ...s.points } }))
    await db.sets.bulkPut(sets)
    return { drillId, nama, setDitulis: sets.length, setDihapus: 0, anggotaBaru: anggotaBaru.length, laguBaru }
  }

  // `ganti` & `gabung`: tulis ulang data drill-nya (nama, lapangan, tempo, penanda).
  const lama = await db.drills.get(drillId)
  await db.drills.put({
    ...data.drill,
    id: drillId,
    createdAt: lama?.createdAt ?? data.drill.createdAt ?? Date.now(),
    updatedAt: Date.now(),
  })

  const setLama = await db.sets.where('drillId').equals(drillId).toArray()
  const petaSetLama = new Map(setLama.map((s) => [s.id, s]))

  if (mode === 'ganti') {
    const idBerkas = new Set(data.sets.map((s) => s.id))
    const dihapus = setLama.filter((s) => !idBerkas.has(s.id)).map((s) => s.id)
    if (dihapus.length) await db.sets.bulkDelete(dihapus)
    const sets = data.sets
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((s, i) => ({ ...s, drillId, order: i, points: { ...s.points } }))
    await db.sets.bulkPut(sets)
    return { drillId, nama: data.drill.name, setDitulis: sets.length, setDihapus: dihapus.length, anggotaBaru: anggotaBaru.length, laguBaru }
  }

  // `gabung`: perbarui yang sama, tambahkan yang baru, sisanya dibiarkan.
  const urutanTerbesar = setLama.reduce((m, s) => Math.max(m, s.order ?? 0), -1)
  const masuk: DrillSet[] = []
  data.sets
    .slice()
    .sort((a, b) => a.order - b.order)
    .forEach((s, i) => {
      const punya = petaSetLama.get(s.id)
      masuk.push({
        ...s,
        drillId,
        // Set baru ditaruh di belakang, mengikuti urutan di dalam berkas.
        order: punya ? (punya.order ?? i) : urutanTerbesar + 1 + i,
        points: { ...s.points },
      })
    })
  await db.sets.bulkPut(masuk)
  return {
    drillId,
    nama: data.drill.name,
    setDitulis: masuk.length,
    setDihapus: 0,
    anggotaBaru: anggotaBaru.length,
    laguBaru,
  }
}
