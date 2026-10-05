/**
 * M4 — tukar repertoar antar perangkat pelatih.
 *
 * Yang dilayani: pelatih punya repertoar di laptop, lalu ingin memindahkannya
 * ke HP di lapangan — atau menerima repertoar dari pelatih lain. Berkasnya
 * kecil (hanya yang berhubungan dengan lagu) dan **ditulis ke pustaka
 * tujuan**, bukan sekadar dibaca seperti paket berbagi anggota.
 *
 * Aturan yang paling penting: **id lagu tidak pernah diubah**. `Drill.songId`
 * dan `SetList.songIds` menyimpan id, jadi mengganti id saat impor akan
 * memutuskan tautan drill ke lagu dan mengosongkan set list.
 *
 * Logika penyusunan & pemeriksaan dibuat murni (tanpa Dexie) supaya bisa
 * diuji langsung di node.
 */
import { DEFAULT_FIELD, db } from '../db/db'
import type { Drill, DrillSet, PaketRepertoar, SetList, Song } from '../db/types'

/** Penanda format — dipakai untuk menolak berkas yang bukan paket repertoar. */
export const FORMAT_REPERTOAR = 'drillkit-repertoar'

/* ------------------------------- Penyusunan ------------------------------ */

/**
 * Susun paket dari lagu-lagu yang dipilih.
 *
 * Set list dan drill **mengikuti lagu**, bukan dipilih sendiri: set list yang
 * ikut adalah yang memuat salah satu lagu terpilih, dan drill yang ikut
 * adalah yang menaut ke salah satunya. Menyuruh pelatih memilihnya terpisah
 * hanya memberi peluang untuk menghasilkan paket yang tidak lengkap.
 */
export function bangunPaket(bahan: {
  songs: Song[]
  setlists: SetList[]
  drills: Drill[]
  sets: DrillSet[]
  /** id lagu yang dipilih; kosong = semua lagu ikut */
  songIds?: string[]
  team?: PaketRepertoar['team']
}): PaketRepertoar {
  const { songs, setlists, drills, sets, team } = bahan
  const terpilih = bahan.songIds?.length ? new Set(bahan.songIds) : null
  const songsTerpilih = terpilih ? songs.filter((s) => terpilih.has(s.id)) : songs
  const idLagu = new Set(songsTerpilih.map((s) => s.id))

  const setlistsTerpilih = setlists.filter((sl) => sl.songIds.some((id) => idLagu.has(id)))
  const drillsTerpilih = drills.filter((d) => Boolean(d.songId && idLagu.has(d.songId)))
  const idDrill = new Set(drillsTerpilih.map((d) => d.id))

  return {
    format: FORMAT_REPERTOAR,
    version: 1,
    exportedAt: Date.now(),
    team,
    songs: songsTerpilih,
    setlists: setlistsTerpilih,
    drills: drillsTerpilih,
    // Set diambil dari drill yang ikut saja; set milik drill lain tidak ada
    // gunanya di berkas ini.
    sets: sets.filter((s) => idDrill.has(s.drillId)),
  }
}

/* -------------------------------- Pembacaan ------------------------------ */

export type HasilBaca =
  | { ok: true; paket: PaketRepertoar }
  | { ok: false; alasan: string }

/**
 * Baca & periksa berkas paket.
 *
 * Dibuat toleran: semua bagian yang opsional dinormalisasi menjadi larik,
 * karena berkas bisa saja disunting orang atau datang dari versi lama. Yang
 * ditolak hanya yang benar-benar bukan paket repertoar.
 */
export function bacaPaket(teks: string): HasilBaca {
  let data: unknown
  try {
    data = JSON.parse(teks)
  } catch {
    return { ok: false, alasan: 'Berkas bukan JSON yang sah' }
  }
  if (!data || typeof data !== 'object') return { ok: false, alasan: 'Berkas kosong' }
  const p = data as Partial<PaketRepertoar>
  if (p.format !== FORMAT_REPERTOAR) {
    return { ok: false, alasan: 'Bukan berkas repertoar DrillKit' }
  }
  const songs = Array.isArray(p.songs) ? p.songs : []
  if (!songs.length) return { ok: false, alasan: 'Paket tidak berisi lagu' }
  // Berkas bisa saja datang dari versi yang belum punya set list / drill.
  return {
    ok: true,
    paket: {
      format: FORMAT_REPERTOAR,
      version: 1,
      exportedAt: typeof p.exportedAt === 'number' ? p.exportedAt : Date.now(),
      team: p.team,
      songs,
      setlists: Array.isArray(p.setlists) ? p.setlists : [],
      drills: Array.isArray(p.drills) ? p.drills : [],
      sets: Array.isArray(p.sets) ? p.sets : [],
    },
  }
}

/* ------------------------------- Pemeriksaan ------------------------------ */

export interface RingkasanImpor {
  /** Yang belum ada di perangkat ini — akan ditambahkan. */
  baru: { songs: Song[]; setlists: SetList[]; drills: Drill[] }
  /** Yang sudah ada — akan ditimpa isinya. */
  timpa: { songs: Song[]; setlists: SetList[]; drills: Drill[] }
  /** Jumlah set yang ikut (menempel pada drill, tidak dihitung terpisah). */
  jumlahSet: number
  /**
   * Id lagu yang dirujuk set list/drill yang dibawa paket, tetapi lagunya
   * tidak ada di paket **dan** tidak ada di perangkat ini.
   *
   * Dihitung supaya pelatih tahu sebelum menjalankan: impor seperti ini
   * tidak merusak apa pun, tetapi set list-nya akan berlubang.
   */
  rujukanHilang: string[]
}

/**
 * Bandingkan isi paket dengan pustaka yang sudah ada.
 *
 * Yang dilihat adalah **id**, bukan judul: dua lagu berjudul sama itu hal
 * biasa (aransemen berbeda), sedangkan id yang sama berarti lagu yang sama.
 */
export function ringkasanImpor(
  paket: PaketRepertoar,
  punya: { songs: Song[]; setlists: SetList[]; drills: Drill[] },
): RingkasanImpor {
  const idLagu = new Set(punya.songs.map((s) => s.id))
  const idSetList = new Set(punya.setlists.map((s) => s.id))
  const idDrill = new Set(punya.drills.map((d) => d.id))

  const bagi = <T extends { id: string }>(daftar: T[], ada: Set<string>) => ({
    baru: daftar.filter((x) => !ada.has(x.id)),
    timpa: daftar.filter((x) => ada.has(x.id)),
  })

  const lagu = bagi(paket.songs, idLagu)
  const setlist = bagi(paket.setlists, idSetList)
  const drill = bagi(paket.drills, idDrill)

  // Lagu yang tersedia setelah impor: yang dibawa paket ditambah yang sudah ada.
  const tersedia = new Set([...idLagu, ...paket.songs.map((s) => s.id)])
  const rujuk = new Set<string>()
  for (const sl of paket.setlists) for (const id of sl.songIds) rujuk.add(id)
  for (const d of paket.drills) if (d.songId) rujuk.add(d.songId)

  return {
    baru: { songs: lagu.baru, setlists: setlist.baru, drills: drill.baru },
    timpa: { songs: lagu.timpa, setlists: setlist.timpa, drills: drill.timpa },
    jumlahSet: paket.sets.length,
    rujukanHilang: [...rujuk].filter((id) => !tersedia.has(id)),
  }
}

/** Apakah ringkasan ini mengandung sesuatu yang patut diperingatkan? */
export function perluPeringatan(r: RingkasanImpor): boolean {
  return r.timpa.songs.length + r.timpa.setlists.length + r.timpa.drills.length > 0
}

/* -------------------------------- Penerapan ------------------------------ */

/**
 * Tulis isi paket ke pustaka.
 *
 * Memakai `bulkPut` dengan **id apa adanya**, jadi yang sudah ada ditimpa dan
 * yang belum ada ditambahkan — persis seperti yang dijanjikan ringkasan.
 * Semua ditulis dalam satu transaksi supaya gagal di tengah tidak
 * meninggalkan pustaka setengah jadi.
 */
export async function terapkanPaket(paket: PaketRepertoar): Promise<void> {
  await db.transaction(
    'rw',
    [db.songs, db.setlists, db.drills, db.sets],
    async () => {
      if (paket.songs.length) await db.songs.bulkPut(paket.songs)
      if (paket.setlists.length) await db.setlists.bulkPut(paket.setlists)
      if (paket.drills.length)
        await db.drills.bulkPut(
          paket.drills.map((d) => (d.field ? d : { ...d, field: { ...DEFAULT_FIELD } })),
        )
      if (paket.sets.length) await db.sets.bulkPut(paket.sets)
    },
  )
}
