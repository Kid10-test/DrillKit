/**
 * #10 — menulis hasil impor Pyware ke basis data.
 *
 * Dipisah dari `pyware.ts` karena dua alasan:
 *
 * 1. `pyware.ts` harus tetap murni supaya `bukaBerkas.ts` bisa mengimpor
 *    pendeteksinya tanpa ikut menarik Dexie ke dalam bundelnya.
 * 2. Aturan tulisnya (foto riwayat, timpa/gabung/salinan) layak diuji di
 *    node dengan `fake-indexeddb`, seperti `uji-riwayat.mjs`.
 *
 * Janji yang dijaga di sini: **impor selalu bisa dibatalkan.** Untuk
 * `gabung` dan `timpa`, keadaan drill difoto lebih dulu dengan alasan
 * `sebelum-impor-pyware`, jadi satu langkah di Riwayat mengembalikan
 * semuanya. Untuk `salinan` tidak ada yang ditimpa — drill baru dibuat dan
 * membatalkannya berarti menghapus show baru itu (disebut di layar, bukan
 * dibiarkan ditebak).
 */
import { db } from '../db/db'
import type { Drill, DrillSet } from '../db/types'
import { foto } from './riwayat'
import { uid } from './utils'
import type { ModeImporPyware, RancanganSetPyware } from './pyware'

export interface OpsiTulisPyware {
  drillId: string
  rancangan: RancanganSetPyware[]
  /** kunci pemain Pyware → id anggota DrillKit (hasil pencocokan #1) */
  peta: Record<string, string>
  mode: ModeImporPyware
  /** id anggota yang baru dibuat dari berkas — ikut dimasukkan ke roster */
  anggotaBaru?: string[]
  /** nama show baru untuk mode `salinan` */
  namaSalinan?: string
}

export interface HasilTulisPyware {
  drillId: string
  nama: string
  /** set yang benar-benar ditambahkan */
  setBaru: number
  /** set lama yang namanya sama dan titik-titiknya diperbarui */
  setDiperbarui: number
  titikDitulis: number
  /** foto riwayat yang membuat impor ini bisa dibatalkan (null untuk salinan) */
  snapshotId: string | null
  /** true bila hasilnya drill baru (mode `salinan`) */
  baru: boolean
}

/** Nama set yang sama dianggap set yang sama, tanpa peduli huruf besar/kecil. */
const namaSama = (a: string, b: string): boolean => a.trim().toLowerCase() === b.trim().toLowerCase()

export async function tulisImporPyware(opts: OpsiTulisPyware): Promise<HasilTulisPyware> {
  const drill = await db.drills.get(opts.drillId)
  if (!drill) throw new Error('Drill tujuan tidak ditemukan')
  if (!opts.rancangan.length) throw new Error('Tidak ada set untuk diimpor')

  const idTujuan = opts.mode === 'salinan' ? uid('d_') : drill.id
  const namaTujuan =
    opts.mode === 'salinan'
      ? (opts.namaSalinan?.trim() || `${drill.name} (Pyware)`).slice(0, 120)
      : drill.name

  /* ---- peta kunci → id anggota, buang yang tidak dicocokkan ---- */
  const idAnggota = (kunci: string): string | null => opts.peta[kunci] ?? null

  /* ---- susun baris set lebih dulu, supaya tulisnya satu transaksi ---- */
  const sekarang = Date.now()
  const setBaru: DrillSet[] = opts.rancangan.map((r, i) => {
    const points: DrillSet['points'] = {}
    for (const [kunci, t] of Object.entries(r.titik)) {
      const id = idAnggota(kunci)
      if (!id) continue
      points[id] = { x: t.x, y: t.y, facing: 'front' }
    }
    return {
      id: uid('set_'),
      drillId: idTujuan,
      order: i,
      name: r.nama,
      counts: r.counts,
      points,
      createdAt: sekarang,
      // Catatan kecil yang berguna bertahun-tahun kemudian: dari mana
      // formasi ini datang, dan bahwa jalur di antaranya lurus.
      notes: 'Impor Pyware — jalur antar set lurus (busur ditambahkan sendiri)',
    }
  })

  const titikDitulis = setBaru.reduce((n, s) => n + Object.keys(s.points).length, 0)

  /* ---------------------------- salinan -------------------------------- */
  if (opts.mode === 'salinan') {
    const baru: Drill = {
      ...drill,
      id: idTujuan,
      name: namaTujuan,
      rosterIds: gabungRoster(drill.rosterIds, opts),
      createdAt: sekarang,
      updatedAt: sekarang,
    }
    await db.transaction('rw', db.drills, db.sets, async () => {
      await db.drills.put(baru)
      await db.sets.bulkPut(setBaru)
    })
    return {
      drillId: idTujuan,
      nama: namaTujuan,
      setBaru: setBaru.length,
      setDiperbarui: 0,
      titikDitulis,
      snapshotId: null,
      baru: true,
    }
  }

  /* --------------------- gabung / timpa (dengan foto) ------------------- */
  const snap = await foto(drill.id, 'sebelum-impor-pyware')

  let diperbarui = 0
  let ditambah = 0

  await db.transaction('rw', db.drills, db.sets, async () => {
    const lama = await db.sets.where('drillId').equals(drill.id).toArray()
    lama.sort((a, b) => a.order - b.order)

    if (opts.mode === 'timpa') {
      if (lama.length) await db.sets.bulkDelete(lama.map((s) => s.id))
      await db.sets.bulkPut(setBaru)
      ditambah = setBaru.length
    } else {
      // Gabung: set yang namanya sama diperbarui (facing lama dipertahankan),
      // sisanya ditambahkan di akhir. Set yang tidak ada di berkas dibiarkan.
      const sisa = [...lama]
      const orderBerikut = lama.length ? Math.max(...lama.map((s) => s.order)) + 1 : 0
      const tambah: DrillSet[] = []

      for (const s of setBaru) {
        const idx = sisa.findIndex((l) => namaSama(l.name, s.name))
        if (idx < 0) {
          tambah.push({ ...s, order: orderBerikut + tambah.length })
          continue
        }
        const target = sisa[idx]
        const points = { ...target.points }
        for (const [id, t] of Object.entries(s.points)) {
          points[id] = { ...t, facing: points[id]?.facing ?? 'front' }
        }
        await db.sets.update(target.id, { points, counts: s.counts })
        sisa.splice(idx, 1)
        diperbarui++
      }

      if (tambah.length) await db.sets.bulkPut(tambah)
      ditambah = tambah.length
    }

    await db.drills.update(drill.id, {
      updatedAt: sekarang,
      rosterIds: gabungRoster(drill.rosterIds, opts),
    })
  })

  return {
    drillId: drill.id,
    nama: namaTujuan,
    setBaru: ditambah,
    setDiperbarui: diperbarui,
    titikDitulis,
    snapshotId: snap?.id ?? null,
    baru: false,
  }
}

/**
 * Roster drill ikut diperbarui bila drill membatasi anggotanya.
 *
 * `DrillEditor` hanya menampilkan anggota yang ada di `rosterIds` (kecuali
 * daftarnya kosong = semua anggota). Tanpa ini, pemain yang baru ditambahkan
 * dari berkas Pyware punya titik di tiap set tetapi tidak pernah tampil di
 * lapangan — dan pelatih mengira impornya gagal.
 */
function gabungRoster(rosterIds: string[], opts: OpsiTulisPyware): string[] {
  if (!rosterIds.length) return rosterIds
  const punya = new Set(rosterIds)
  const tambah = [...Object.values(opts.peta), ...(opts.anggotaBaru ?? [])]
  for (const id of tambah) if (id && !punya.has(id)) punya.add(id)
  return [...punya]
}
