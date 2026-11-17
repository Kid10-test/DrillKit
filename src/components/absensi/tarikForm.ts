/**
 * v2.13 — tarik & terapkan isian Google Form tanpa membuka modal Impor.
 *
 * Dipakai "Tarik otomatis" di halaman Absensi dan tombol Terapkan di modal
 * Impor Form (satu cara menulis hasil impor). Rencananya sama persis dengan
 * pratinjau di modal: baris yang namanya tidak pasti, sesinya tidak
 * ditemukan, atau bentrok tetap dilewati dan dilaporkan "perlu dicek".
 */
import type { ProgramLatihan, Session, SumberSheetForm } from '../../db/types'
import { db } from '../../db/db'
import { aturanUntukSesi } from '../../lib/programLatsar'
import { uid } from '../../lib/utils'
import {
  bacaCsvForm,
  rencanakanImporForm,
  tebakKolomGForm,
  tebakUrutanTanggal,
  terapkanImporForm,
  type BarisRencanaForm,
  type HasilTerapForm,
  type JenisFormImpor,
} from '../../lib/imporGForm'

type ModulGoogle = typeof import('../../lib/googleDrive')

/** Tulis hasil `terapkanImporForm` ke Dexie dalam satu transaksi. */
export async function simpanHasilImpor(h: HasilTerapForm): Promise<void> {
  await db.transaction('rw', db.attendance, db.sessions, async () => {
    if (h.catatan.length) await db.attendance.bulkPut(h.catatan)
    for (const [id, form] of Object.entries(h.form)) await db.sessions.update(id, { formPresensi: form })
    for (const [id, ket] of Object.entries(h.keterangan ?? {})) await db.sessions.update(id, { formKeterangan: ket })
  })
}

/** Sesi kandidat: milik program latihan bila ada, selain itu semua sesi. */
export function kandidatSesi(program: ProgramLatihan[], sessions: Session[]): Session[] {
  const ids = new Set(program.flatMap((p) => p.sesiIds))
  const milik = sessions.filter((s) => ids.has(s.id))
  return milik.length ? milik : sessions
}

/** Urutan impor: izin dulu (presensi melewati baris izin), absen fisik terakhir. */
export const URUTAN_TARIK: JenisFormImpor[] = ['izin', 'presensi', 'datang']

export interface HasilTarikJenis {
  jenis: JenisFormImpor
  sumber: SumberSheetForm
  /** Baris yang ditulis (tambah + perbarui). */
  jumlah: number
  /** Baris baru-baru ini yang dilewati karena perlu dicek tangan. */
  perluCek: number
  galat?: string
}

const PERLU_CEK = /nama tidak|sesi tidak|cap waktu tidak/i

/** Baris yang layak dilaporkan: dari sesi yang sedang dibuka atau diisi ≤ 3 hari terakhir. */
function perluDicek(b: BarisRencanaForm, sesiAwal: string, sekarang: number): boolean {
  if (b.aksi === 'bentrok') return b.sesiId === sesiAwal
  if (b.aksi !== 'lewati' || !PERLU_CEK.test(b.pesan)) return false
  if (b.sesiId) return b.sesiId === sesiAwal
  return b.capWaktu != null && sekarang - b.capWaktu < 3 * 86_400_000
}

/**
 * Tarik semua Sheet jawaban yang sudah dipilih, berurutan izin → presensi →
 * absen fisik, dan terapkan barisnya. Data Dexie dibaca ulang tiap jenis
 * supaya hasil jenis sebelumnya ikut diperhitungkan.
 */
export async function tarikSemuaForm(o: {
  mod: ModulGoogle
  sumber: Partial<Record<JenisFormImpor, SumberSheetForm>>
  program: ProgramLatihan[]
  sesiAwal: string
  sekarang?: number
}): Promise<HasilTarikJenis[]> {
  const sekarang = o.sekarang ?? Date.now()
  const cache = new Map<string, string>()
  const hasil: HasilTarikJenis[] = []
  for (const jenis of URUTAN_TARIK) {
    const src = o.sumber[jenis]
    if (!src) continue
    try {
      const kunci = `${src.id}|${src.tab ?? ''}`
      let teks = cache.get(kunci)
      if (teks == null) {
        teks = (await o.mod.ambilCsvForm({ id: src.id }, src.tab)).teks
        cache.set(kunci, teks)
      }
      const tabel = bacaCsvForm(teks)
      const peta = tebakKolomGForm(tabel[0] ?? [])
      const data = tabel.slice(1)
      if (peta.nama < 0) {
        hasil.push({ jenis, sumber: src, jumlah: 0, perluCek: 0, galat: 'Kolom nama tidak ditemukan' })
        continue
      }
      const urutan = tebakUrutanTanggal(
        data.slice(0, 40).map((b) => (peta.waktu >= 0 ? (b[peta.waktu] ?? '') : peta.tanggal >= 0 ? (b[peta.tanggal] ?? '') : '')),
      )
      const [members, sessions, records] = await Promise.all([db.members.toArray(), db.sessions.toArray(), db.attendance.toArray()])
      const rencana = rencanakanImporForm({
        jenis,
        baris: data,
        peta,
        urutan,
        anggota: members.filter((m) => m.active),
        sesi: kandidatSesi(o.program, sessions),
        catatan: records,
        kategori: aturanUntukSesi(o.program, o.sesiAwal).kategoriIzin,
      })
      const h = terapkanImporForm(jenis, rencana, records, sessions, () => uid('a_'))
      if (h.jumlah) await simpanHasilImpor(h)
      hasil.push({ jenis, sumber: src, jumlah: h.jumlah, perluCek: rencana.filter((b) => perluDicek(b, o.sesiAwal, sekarang)).length })
    } catch (e) {
      hasil.push({ jenis, sumber: src, jumlah: 0, perluCek: 0, galat: o.mod.pesanGalat(e) })
    }
  }
  return hasil
}
