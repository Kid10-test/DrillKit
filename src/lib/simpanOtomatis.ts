import { db } from '../db/db'
import { buildBackupPayload, formatBytes } from './backup'
import { namaBackup } from './namaBerkas'

/**
 * 1b — Simpan otomatis ke berkas yang dipilih sekali.
 *
 * Mengapa modul ini perlu, dan mengapa ia tidak bisa lebih baik dari ini:
 *
 * Semua data DrillKit hidup di IndexedDB perangkat ini. Membersihkan cache
 * browser — hal yang sering terjadi tanpa disengaja — menghapus semuanya.
 * Berkas backup adalah satu-satunya jaring pengaman, tetapi menulisnya
 * selama ini harus ditekan tombol dulu.
 *
 * **File System Access API** mengizinkan kebalikannya: pengguna memilih satu
 * berkas sekali, pegangannya disimpan, lalu aplikasi menulis sendiri ke
 * berkas itu tanpa dialog lagi. Dua hal yang perlu diketahui:
 *
 * 1. **Hanya Chromium desktop** (Chrome & Edge). Firefox, Safari, dan semua
 *    browser HP tidak punya API ini. Modulnya mendeteksi dukungan dan
 *    mengatakan terus terang kalau tidak tersedia — bukan berpura-pura
 *    bekerja.
 * 2. **Izinnya bisa dicabut browser.** Setelah Chrome ditutup,
 *    `queryPermission` biasanya kembali ke 'prompt'. Meminta ulang harus
 *    dari aksi pengguna, jadi aplikasi tidak bisa melakukannya diam-diam.
 *    Karena itu ada tombol "Izinkan lagi" — satu klik, lalu lanjut sendiri.
 *
 * Yang TIDAK diselesaikan modul ini: berkasnya masih berada di perangkat
 * yang sama. Kalau perangkatnya hilang atau rusak, tetap perlu salinan di
 * tempat lain. Itu sengaja dikatakan terus terang di antarmukanya.
 */

/* ------------------------------- Tipe ------------------------------------ */

/**
 * Tipe File System Access API sengaja ditulis sendiri.
 *
 * TypeScript belum memasukkannya ke `lib.dom.d.ts` (ia hidup di paket
 * terpisah), dan aplikasi ini tidak memasang paket tambahan hanya demi
 * tipe. Menulisnya sendiri juga membuat batasnya kelihatan: hanya
 * kemampuan yang benar-benar dipakai yang dideklarasikan di sini.
 */
interface AliranTulis {
  write(data: unknown): Promise<void>
  close(): Promise<void>
}

interface PeganganBerkas {
  readonly name: string
  createWritable(options?: { keepExistingData?: boolean }): Promise<AliranTulis>
  queryPermission(deskripsi?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>
  requestPermission(deskripsi?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>
}

interface JendelaBerkas {
  showSaveFilePicker?(options?: unknown): Promise<PeganganBerkas>
}

export type HasilSimpan =
  /** berhasil ditulis ke berkas */
  | 'tersimpan'
  /** berkas sudah dipasang, tapi browser minta izin ulang lewat klik */
  | 'perlu-izin'
  /** belum ada berkas yang dipasang */
  | 'tidak-terpasang'
  /** gagal menulis (berkas dipindah/dihapus, disk penuh, dsb) */
  | 'gagal'

/* ------------------------------ Deteksi ---------------------------------- */

/** Apakah perangkat ini mendukung penyimpanan ke berkas tetap. */
export function didukung(): boolean {
  if (typeof window === 'undefined') return false
  const w = window as unknown as JendelaBerkas
  return typeof w.showSaveFilePicker === 'function'
}

/* ------------------------------ Pasang ----------------------------------- */

/**
 * Minta pengguna memilih berkas, lalu simpan pegangannya.
 *
 * Harus dipanggil dari aksi pengguna: browser menolak dialog penyimpanan
 * yang muncul tanpa gestur.
 */
export async function pasang(): Promise<{ ok: boolean; nama?: string }> {
  if (!didukung()) return { ok: false }
  const w = window as unknown as JendelaBerkas
  try {
    const pegangan = await w.showSaveFilePicker!({
      suggestedName: namaBackup(),
      types: [
        {
          description: 'Backup DrillKit',
          accept: { 'application/json': ['.json'] },
        },
      ],
    })
    await db.simpanan.put({
      key: 'utama',
      pegangan: pegangan as unknown,
      nama: pegangan.name,
      at: 0,
    })
    return { ok: true, nama: pegangan.name }
  } catch (e) {
    // `AbortError` = pengguna membatalkan dialog. Bukan kegagalan.
    if (e instanceof Error && e.name === 'AbortError') return { ok: false }
    return { ok: false }
  }
}

/** Lepas berkasnya — aplikasi berhenti menyimpan sendiri. */
export async function lepas(): Promise<void> {
  await db.simpanan.delete('utama')
}

/* ------------------------------- Status ---------------------------------- */

export interface StatusSimpan {
  terpasang: boolean
  nama: string
  /** kapan terakhir berhasil disimpan; 0 = belum pernah */
  at: number
  /** apakah izin masih berlaku, sehingga bisa menyimpan tanpa klik lagi */
  izin: boolean
}

export async function status(): Promise<StatusSimpan> {
  const s = await db.simpanan.get('utama')
  if (!s) return { terpasang: false, nama: '', at: 0, izin: false }
  const izin = (await (s.pegangan as unknown as PeganganBerkas).queryPermission({
    mode: 'readwrite',
  })) === 'granted'
  return { terpasang: true, nama: s.nama, at: s.at, izin }
}

/**
 * Minta ulang izin menulis.
 *
 * Harus dari aksi pengguna — browser menolak permintaan izin yang muncul
 * begitu saja. Dipanggil oleh tombol "Izinkan lagi".
 */
export async function mintaIzin(): Promise<boolean> {
  const s = await db.simpanan.get('utama')
  if (!s) return false
  try {
    return (await (s.pegangan as unknown as PeganganBerkas).requestPermission({
      mode: 'readwrite',
    })) === 'granted'
  } catch {
    return false
  }
}

/* ------------------------------- Menyimpan -------------------------------- */

/**
 * Tulis backup ke berkas yang sudah dipasang.
 *
 * Sengaja tidak pernah melempar: penyimpanan otomatis yang gagal tidak
 * boleh mengganggu apa pun. Kegagalannya dilaporkan supaya antarmuka bisa
 * memintakan izin, atau menyarankan memasang berkas ulang.
 */
export async function simpan(): Promise<{ hasil: HasilSimpan; bytes?: number }> {
  const s = await db.simpanan.get('utama')
  if (!s) return { hasil: 'tidak-terpasang' }

  const pegangan = s.pegangan as unknown as PeganganBerkas

  let izin: PermissionState
  try {
    izin = await pegangan.queryPermission({ mode: 'readwrite' })
  } catch {
    return { hasil: 'gagal' }
  }
  if (izin !== 'granted') return { hasil: 'perlu-izin' }

  try {
    const payload = await buildBackupPayload()
    const teks = JSON.stringify(payload, null, 2)
    const aliran = await pegangan.createWritable()
    await aliran.write(teks)
    await aliran.close()
    await db.simpanan.update('utama', { at: Date.now() })
    return { hasil: 'tersimpan', bytes: new Blob([teks]).size }
  } catch {
    // Paling sering: berkasnya dipindah atau dihapus orangnya.
    return { hasil: 'gagal' }
  }
}

/* ---------------------------- Penjaga berkala ----------------------------- */

/** Jarak terdekat antar dua penyimpanan otomatis. */
export const JEDA_SIMPAN_MS = 15 * 60_000

/** Seberapa sering keadaan diperiksa. */
export const JEDA_PERIKSA_MS = 5 * 60_000

/**
 * Simpan bila sudah waktunya. Dipanggil penjaga di `App`.
 *
 * Tidak menyimpan kalau aplikasi belum berisi anggota: tidak ada gunanya
 * menulisi berkas seseorang dengan backup kosong.
 */
export async function simpanBilaPerlu(): Promise<HasilSimpan> {
  const s = await db.simpanan.get('utama')
  if (!s) return 'tidak-terpasang'
  if (s.at && Date.now() - s.at < JEDA_SIMPAN_MS) return 'tersimpan'

  const anggota = await db.members.count()
  if (!anggota) return 'tidak-terpasang'

  const { hasil } = await simpan()
  return hasil
}

/** Ukuran berkas yang mudah dibaca — diteruskan dari modul backup. */
export function ukuran(b: number): string {
  return formatBytes(b)
}
