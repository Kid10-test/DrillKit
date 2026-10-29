/**
 * Menulis hasil pencocokan dan penggabungan ke IndexedDB.
 *
 * Logikanya ada di `namaAnggota.ts` (murni, teruji). Di sini hanya urutan
 * tulisnya: catatan yang bentrok dihapus **dulu**, baru id-nya dipindah.
 * Kalau urutannya terbalik, indeks unik absensi `[sesi+anggota]` menolak
 * transaksi dan seluruh penggabungan batal.
 */

import { db } from '../db/db'
import type { RencanaGabung } from './namaAnggota'
import type { HasilCocok } from './namaAnggota'
import type {
  AttendanceRecord,
  CatatanSetoran,
  Drill,
  DrillSet,
  Evaluasi,
  Kemajuan,
  Member,
  MemberNote,
  RiwayatSnapshot,
} from '../db/types'

const TABEL = [
  db.members,
  db.attendance,
  db.evaluasi,
  db.setoran,
  db.memberNotes,
  db.sets,
  db.drills,
  db.riwayat,
  db.kemajuan,
]

export async function simpanAnggota(tulis: Member[], hapus: string[]): Promise<void> {
  const buang = hapus.filter((id) => !tulis.some((m) => m.id === id))
  if (!tulis.length && !buang.length) return
  await db.transaction('rw', db.members, async () => {
    if (buang.length) await db.members.bulkDelete(buang)
    if (tulis.length) await db.members.bulkPut(tulis)
  })
}

export async function simpanRencana(r: {
  anggotaTulis?: Member[]
  anggotaHapus?: string[]
  absensi?: AttendanceRecord[]
  absensiHapus?: string[]
  evaluasi?: Evaluasi[]
  evaluasiHapus?: string[]
  setoran?: CatatanSetoran[]
  setoranHapus?: string[]
  catatan?: MemberNote[]
  sets?: DrillSet[]
  drills?: Drill[]
  riwayat?: RiwayatSnapshot[]
  kemajuan?: Kemajuan[]
}): Promise<void> {
  const hapusAnggota = (r.anggotaHapus ?? []).filter((id) => !(r.anggotaTulis ?? []).some((m) => m.id === id))
  await db.transaction('rw', TABEL, async () => {
    if (r.absensiHapus?.length) await db.attendance.bulkDelete(r.absensiHapus)
    if (r.evaluasiHapus?.length) await db.evaluasi.bulkDelete(r.evaluasiHapus)
    if (r.setoranHapus?.length) await db.setoran.bulkDelete(r.setoranHapus)
    if (r.absensi?.length) await db.attendance.bulkPut(r.absensi)
    if (r.evaluasi?.length) await db.evaluasi.bulkPut(r.evaluasi)
    if (r.setoran?.length) await db.setoran.bulkPut(r.setoran)
    if (r.catatan?.length) await db.memberNotes.bulkPut(r.catatan)
    if (r.sets?.length) await db.sets.bulkPut(r.sets)
    if (r.drills?.length) await db.drills.bulkPut(r.drills)
    if (r.riwayat?.length) await db.riwayat.bulkPut(r.riwayat)
    if (r.kemajuan?.length) await db.kemajuan.bulkPut(r.kemajuan)
    if (hapusAnggota.length) await db.members.bulkDelete(hapusAnggota)
    if (r.anggotaTulis?.length) await db.members.bulkPut(r.anggotaTulis)
  })
}

export async function simpanGabung(r: RencanaGabung): Promise<void> {
  await simpanRencana({
    anggotaTulis: [r.simpan],
    anggotaHapus: [r.buangId],
    absensi: r.absensi,
    absensiHapus: r.absensiHapus,
    evaluasi: r.evaluasi,
    evaluasiHapus: r.evaluasiHapus,
    setoran: r.setoran,
    setoranHapus: r.setoranHapus,
    catatan: r.catatan,
    sets: r.sets,
    drills: r.drills,
    riwayat: r.riwayat,
    kemajuan: r.kemajuan,
  })
}

export async function muatJejakAnggota(): Promise<{ absensi: string[]; posisi: string[] }> {
  const [absensi, sets] = await Promise.all([db.attendance.toArray(), db.sets.toArray()])
  const posisi = new Set<string>()
  for (const s of sets) for (const id of Object.keys(s.points ?? {})) posisi.add(id)
  return {
    absensi: [...new Set(absensi.map((a) => a.memberId))],
    posisi: [...posisi],
  }
}

export async function muatUntukGabung() {
  const [absensi, evaluasi, setoran, catatan, sets, drills, riwayat, kemajuan] = await Promise.all([
    db.attendance.toArray(),
    db.evaluasi.toArray(),
    db.setoran.toArray(),
    db.memberNotes.toArray(),
    db.sets.toArray(),
    db.drills.toArray(),
    db.riwayat.toArray(),
    db.kemajuan.toArray(),
  ])
  return { absensi, evaluasi, setoran, catatan, sets, drills, riwayat, kemajuan }
}

export type { HasilCocok }
