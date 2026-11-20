/**
 * v2.14 — bagian kecil kehadiran bersama yang dibutuhkan bundel awal:
 * kunci penyimpanan, bentuk status, dan pembaca alamat kembali dari masuk
 * Google. Sengaja terpisah dari `kehadiranBersama.ts` — modul yang dipakai
 * bundel awal ikut seluruhnya ke bundel awal, jadi yang ada di sini hanya
 * yang benar-benar perlu sebelum halaman mana pun dibuka.
 */

export type PeranStaf = 'pemilik' | 'danlat' | 'pencatat' | 'pengamat'

export interface StatusServer {
  /** Sinkron otomatis menyala di perangkat ini. */
  aktif?: boolean
  email?: string
  timId?: string
  namaTim?: string
  peran?: PeranStaf
  /** Akun sudah masuk tetapi emailnya belum diundang ke tim mana pun. */
  belumDiundang?: boolean
  terakhir?: number
  galat?: string
  dikirim?: number
  diterima?: number
  /** v2.15.1 — kiriman program kosong ditahan; isinya jumlah program di server. */
  programDitahan?: number
  /** v2.15.1 — izin sekali pakai dari pemilik untuk mengosongkan program di server. */
  izinkanProgramKosong?: boolean
}

export const KUNCI_STATUS = 'drillkit.server'
export const KUNCI_SIDIK = 'drillkit.server.sidik'
/** Kode masuk Google yang menunggu ditukar (sessionStorage). */
export const KUNCI_KODE = 'drillkit.server.kode'
/** Penanda bahwa perangkat ini baru saja meminta masuk (alamat kembali = alamat akar). */
export const KUNCI_MASUK = 'drillkit.server.masuk'

export interface KembaliOAuth {
  kode: string | null
  galat: string | null
  /** Query yang tersisa sesudah parameter OAuth dibuang ('' atau '?a=b'). */
  sisa: string
}

/** Baca `?code=` / `?error=` dari alamat kembali dan buang parameternya. */
export function bacaKembaliOAuth(search: string): KembaliOAuth {
  const q = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const kode = q.get('code')
  const galat = q.get('error_description') || q.get('error')
  for (const k of ['code', 'state', 'error', 'error_code', 'error_description']) q.delete(k)
  const s = q.toString()
  return { kode: kode || null, galat: galat || null, sisa: s ? `?${s}` : '' }
}
