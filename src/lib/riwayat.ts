import { db } from '../db/db'
import type { AlasanRiwayat, DrillSet, IsiDrill, RiwayatSnapshot } from '../db/types'
import { formatTime } from './utils'

/**
 * 1a — Riwayat perubahan formasi.
 *
 * Tiga keputusan yang sengaja diambil, supaya kelak tidak perlu ditebak ulang:
 *
 * 1. **Yang difoto adalah keadaan utuh, bukan langkah yang berubah.**
 *    Menyimpan "langkah" (geser titik A dari x ke y) jauh lebih hemat, tetapi
 *    mengharuskan setiap langkah bisa diputar ulang dengan tepat — dan itu
 *    menuntut mesin undo yang mengerti semua alat penyusun. Memfoto keadaan
 *    utuh memang lebih besar, tapi tidak pernah bisa meleset. Untuk ukuran
 *    drill marching band (puluhan set × puluhan pemain) selisihnya tidak
 *    terasa di IndexedDB.
 *
 * 2. **Pemeriksaan kembaran HANYA berlaku untuk foto otomatis.**
 *    Pemotretan otomatis berjalan setiap beberapa menit, jadi tanpa
 *    pemeriksaan sidik jari duduk saja sambil membaca sudah menghasilkan
 *    puluhan foto kembar yang menggeser yang penting.
 *
 *    Tetapi aturan itu sengaja TIDAK berlaku untuk foto yang tersemat.
 *    Kalau berlaku, "foto sebelum mengembalikan" tidak pernah tersimpan
 *    bilamana keadaan sekarang kebetulan sama dengan foto terakhir — padahal
 *    foto terakhir itu bertipe otomatis, dan foto otomatis boleh dipangkas.
 *    Jaminan "mengembalikan selalu bisa dibatalkan" lalu bergantung pada
 *    kebetulan. Menyimpan kembaran yang tersemat jauh lebih murah daripada
 *    kehilangan jaminan itu; lagipula jumlahnya dibatasi pemangkasan.
 *
 * 3. **Mengembalikan versi lama memotret keadaan sekarang lebih dulu.**
 *    Kalau tidak, mengembalikan adalah satu-satunya aksi di aplikasi ini
 *    yang tidak bisa dibatalkan — padahal justru itulah saatnya orang
 *    menekan tombol dengan yakin lalu menyesal.
 */

/** Berapa banyak foto otomatis yang disimpan per drill. */
const MAKS_OTOMATIS = 25

/** Berapa banyak foto penting (yang disematkan) yang disimpan per drill. */
const MAKS_PIN = 20

/** Jeda terpendek antar dua foto otomatis, supaya pemotretan tidak memburu. */
export const JEDA_OTOMATIS_MS = 3 * 60 * 1000

/* ------------------------------- Sidik jari ------------------------------- */

/**
 * Susun ulang kunci objek secara menaik, rekursif.
 *
 * Perlu karena `points` disimpan sebagai `Record<memberId, ...>`: urutan
 * kuncinya mengikuti urutan penyisipan, sehingga dua keadaan yang isinya
 * sama persis bisa menghasilkan JSON yang berbeda — dan sidik jarinya jadi
 * berbeda pula.
 */
function urut(nilai: unknown): unknown {
  if (Array.isArray(nilai)) return nilai.map(urut)
  if (nilai && typeof nilai === 'object') {
    const masuk = nilai as Record<string, unknown>
    const keluar: Record<string, unknown> = {}
    for (const k of Object.keys(masuk).sort()) keluar[k] = urut(masuk[k])
    return keluar
  }
  return nilai
}

/** Sidik jari ringan FNV-1a 32-bit. Cukup untuk membandingkan kembaran. */
function cicip(teks: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < teks.length; i++) {
    h ^= teks.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36)
}

/* ------------------------------ Mengumpulkan ------------------------------ */

interface Keadaan {
  isiDrill: IsiDrill
  isiSet: DrillSet[]
  jumlahSet: number
  jumlahTitik: number
  cicip: string
}

/** Baca keadaan drill saat ini lengkap dengan semua setnya. */
export async function keadaan(drillId: string): Promise<Keadaan | null> {
  const drill = await db.drills.get(drillId)
  if (!drill) return null

  // id & cap waktu tidak ikut difoto: itu identitas baris, bukan isi formasi.
  const { id: _id, createdAt: _c, updatedAt: _u, ...isiDrill } = drill

  const isiSet = await db.sets.where('drillId').equals(drillId).toArray()
  isiSet.sort((a, b) => a.order - b.order)

  const jumlahTitik = isiSet.reduce((n, s) => n + Object.keys(s.points ?? {}).length, 0)

  return {
    isiDrill,
    isiSet,
    jumlahSet: isiSet.length,
    jumlahTitik,
    cicip: cicip(JSON.stringify(urut({ isiDrill, isiSet }))),
  }
}

/* -------------------------------- Memotret -------------------------------- */

/**
 * Simpan foto keadaan drill saat ini.
 *
 * Mengembalikan `null` bila drill-nya sudah tidak ada, atau bila keadaannya
 * sama persis dengan foto terakhir — dalam hal ini foto terakhir itu
 * dikembalikan, karena ia sudah mewakili keadaan yang sama.
 */
export async function foto(
  drillId: string,
  alasan: AlasanRiwayat,
  label?: string,
): Promise<RiwayatSnapshot | null> {
  const k = await keadaan(drillId)
  if (!k) return null

  const pin = alasan === 'otomatis' ? 0 : 1
  const semua = await db.riwayat.where('drillId').equals(drillId).toArray()
  if (semua.length && pin === 0) {
    semua.sort((a, b) => a.at - b.at)
    const terakhir = semua[semua.length - 1]
    if (terakhir.cicip === k.cicip) return terakhir
  }

  const snapshot: RiwayatSnapshot = {
    id: `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    drillId,
    at: Date.now(),
    alasan,
    label: alasan === 'tandai' ? label?.trim() || undefined : undefined,
    pin,
    jumlahSet: k.jumlahSet,
    jumlahTitik: k.jumlahTitik,
    cicip: k.cicip,
    isiDrill: k.isiDrill,
    isiSet: k.isiSet,
  }

  await db.riwayat.put(snapshot)
  await pangkas(drillId)
  return snapshot
}

/**
 * Buang foto-foto lama yang sudah melewati batas.
 *
 * Foto yang disematkan (hasil aksi berbahaya & tanda sendiri) diperlakukan
 * terpisah dari foto otomatis: kalau disatukan, pemotretan otomatis yang
 * rajin bisa menggeser foto "sebelum set dihapus" — persis foto yang paling
 * mungkin dibutuhkan.
 */
async function pangkas(drillId: string): Promise<void> {
  const semua = await db.riwayat.where('drillId').equals(drillId).toArray()
  if (semua.length === 0) return
  semua.sort((a, b) => b.at - a.at)

  const pin = semua.filter((s) => s.pin === 1)
  const otomatis = semua.filter((s) => s.pin === 0)
  const buang = [...pin.slice(MAKS_PIN), ...otomatis.slice(MAKS_OTOMATIS)]

  if (buang.length) await db.riwayat.bulkDelete(buang.map((s) => s.id))
}

/* ------------------------------- Membaca ---------------------------------- */

/** Daftar foto untuk satu drill, terbaru di atas. */
export async function daftar(drillId: string): Promise<RiwayatSnapshot[]> {
  const semua = await db.riwayat.where('drillId').equals(drillId).toArray()
  return semua.sort((a, b) => b.at - a.at)
}

/** Kapan terakhir kali drill ini difoto (untuk menjaga jeda pemotretan). */
export async function terakhirDipotret(drillId: string): Promise<number | null> {
  const semua = await db.riwayat.where('drillId').equals(drillId).toArray()
  if (!semua.length) return null
  return semua.reduce((m, s) => Math.max(m, s.at), 0)
}

/** Bersihkan semua foto drill yang sudah dihapus. */
export async function hapusRiwayat(drillId: string): Promise<void> {
  await db.riwayat.where('drillId').equals(drillId).delete()
}

/* ------------------------------ Memulihkan -------------------------------- */

/**
 * Kembalikan drill ke keadaan dalam sebuah foto.
 *
 * Keadaan sekarang difoto lebih dulu, jadi pemulihan ini sendiri bisa
 * dibatalkan lewat riwayat — dengan alasan 'sebelum-kembalikan'.
 */
export async function pulihkan(snapshotId: string): Promise<RiwayatSnapshot | null> {
  const snap = await db.riwayat.get(snapshotId)
  if (!snap) return null

  await foto(snap.drillId, 'sebelum-kembalikan')

  await db.transaction('rw', db.drills, db.sets, async () => {
    // Set yang ada sekarang boleh saja berbeda jumlahnya dengan yang difoto,
    // jadi dikosongkan dulu lalu diisi ulang — bukan ditimpa satu per satu.
    const kunci = (await db.sets.where('drillId').equals(snap.drillId).primaryKeys()) as string[]
    if (kunci.length) await db.sets.bulkDelete(kunci)
    if (snap.isiSet.length) await db.sets.bulkAdd(snap.isiSet)

    // `put`, bukan `update`: foto 'sebelum-hapus-drill' dipakai justru ketika
    // baris drill-nya sudah tiada. `update` pada baris yang tidak ada tidak
    // menghasilkan apa-apa — set-nya hidup kembali, drill-nya tetap hilang.
    const ada = await db.drills.get(snap.drillId)
    await db.drills.put({
      id: snap.drillId,
      ...snap.isiDrill,
      createdAt: ada?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
    })
  })

  return snap
}

/* ------------------------- Tulisan untuk antarmuka ------------------------ */

/** Nama yang mudah dibaca untuk sebuah foto. */
export function labelAlasan(s: RiwayatSnapshot): string {
  if (s.alasan === 'tandai' && s.label) return s.label
  switch (s.alasan) {
    case 'otomatis':
      return 'Foto otomatis'
    case 'tandai':
      return 'Ditandai sendiri'
    case 'sebelum-hapus-set':
      return 'Sebelum set dihapus'
    case 'sebelum-hapus-drill':
      return 'Sebelum drill dihapus'
    case 'sebelum-impor':
      return 'Sebelum impor show'
    case 'sebelum-kembalikan':
      return 'Sebelum mengembalikan versi lama'
    case 'sebelum-pecah-set':
      return 'Sebelum set dipecah'
    case 'sebelum-gabung-set':
      return 'Sebelum set digabung'
    default:
      return 'Foto'
  }
}

/** Apakah foto ini layak ditandai sebagai penting di daftar. */
export function penting(s: RiwayatSnapshot): boolean {
  return s.alasan !== 'otomatis'
}

/** "baru saja" · "7 menit lalu" · "kemarin 09.14" · "21 Sep 09.14" */
export function waktuRelatif(at: number): string {
  const beda = Date.now() - at
  if (beda < 60_000) return 'baru saja'
  if (beda < 3_600_000) return `${Math.floor(beda / 60_000)} menit lalu`
  if (beda < 86_400_000) return `${Math.floor(beda / 3_600_000)} jam lalu`

  const hari = Math.floor(beda / 86_400_000)
  if (hari === 1) return `kemarin ${formatTime(at)}`

  const d = new Date(at)
  const bulan = [
    'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
    'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
  ][d.getMonth()]
  return `${d.getDate()} ${bulan} ${formatTime(at)}`
}

/** Selisih ringkas antara sebuah foto dengan keadaan sekarang. */
export function bedaDenganSekarang(
  s: RiwayatSnapshot,
  sekarang: { jumlahSet: number; jumlahTitik: number },
): string {
  const dSet = sekarang.jumlahSet - s.jumlahSet
  const dTitik = sekarang.jumlahTitik - s.jumlahTitik
  if (dSet === 0 && dTitik === 0) return 'sama dengan sekarang'

  const bagian: string[] = []
  if (dSet !== 0) bagian.push(`${dSet > 0 ? '+' : '−'}${Math.abs(dSet)} set`)
  if (dTitik !== 0) bagian.push(`${dTitik > 0 ? '+' : '−'}${Math.abs(dTitik)} titik`)
  return bagian.join(' · ')
}
