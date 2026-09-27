/**
 * Kunci pribadi & enkripsi data pribadi anggota — bagian kedua #2.
 *
 * AES-256-GCM lewat WebCrypto. IV acak per anggota per terbitan.
 * Kunci acak, bukan token QR absensi. Bagian terkunci dikunci dengan
 * id anggota, tanpa nama.
 *
 * `crypto.subtle` tidak tersedia di `file://` — anggota umumnya memakai
 * situs HTTPS, jadi ini hanya masalah di versi portabel. Fungsi
 * `cryptoTersedia()` mengembalikan statusnya supaya UI bisa memberi
 * catatan jujur.
 */

/* ================================= Kunci ================================== */

/**
 * Hasilkan kunci AES-256-GCM acak baru.
 *
 * Mengembalikan kunci dalam format base64url (aman untuk URL fragment).
 * Kunci ini diberikan sekali lewat QR yang berisi alamat situs dan kunci
 * di bagian #, supaya tidak terkirim ke server.
 */
export async function buatKunci(): Promise<string> {
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true, /* diekspor supaya bisa disimpan */
    ['encrypt', 'decrypt'],
  )
  const raw = await crypto.subtle.exportKey('raw', key)
  return base64url(new Uint8Array(raw as ArrayBuffer))
}

/**
 * Impor kunci base64url menjadi CryptoKey untuk AES-256-GCM.
 */
export async function imporKunci(kunci: string): Promise<CryptoKey> {
  const raw = base64urlDecode(kunci)
  return crypto.subtle.importKey('raw', raw.buffer as ArrayBuffer, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

/* ================================ Enkripsi ================================ */

/**
 * Enkripsi teks dengan AES-256-GCM.
 *
 * Mengembalikan base64url(IV ‖ ciphertext). IV 12 byte acak dibuat
 * setiap kali — jadi enkripsi yang sama dua kali menghasilkan hasil
 * berbeda.
 */
export async function enkripsi(teks: string, kunci: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_PANJANG))
  const encoded = new TextEncoder().encode(teks)
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, kunci, encoded.buffer as ArrayBuffer)
  // Gabung IV + ciphertext supaya tidak perlu menyimpan IV terpisah
  const ctArr = new Uint8Array(ct)
  const gabung = new Uint8Array(iv.length + ctArr.length)
  gabung.set(iv)
  gabung.set(ctArr, iv.length)
  return base64url(gabung)
}

/**
 * Dekripsi base64url(IV ‖ ciphertext) dengan AES-256-GCM.
 *
 * Mengembalikan teks asli, atau `null` bila kunci salah atau data rusak.
 * Kunci salah menghasilkan `OperationError` dari WebCrypto — ditangkap
 * dan dikembalikan sebagai `null`, bukan dilempar.
 */
export async function dekripsi(data: string, kunci: CryptoKey): Promise<string | null> {
  try {
    const gabung = base64urlDecode(data)
    if (gabung.length <= IV_PANJANG) return null
    const iv = gabung.slice(0, IV_PANJANG)
    const ct = gabung.slice(IV_PANJANG)
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, kunci, ct.buffer as ArrayBuffer)
    return new TextDecoder().decode(plain)
  } catch {
    return null
  }
}

/* ============================ Penyimpanan kunci ============================ */

const KUNCI_SIMPAN = 'drillkit.kunciPribadi'

export type PetaKunci = Record<string, string>

/**
 * Baca peta kunci pribadi dari localStorage.
 *
 * Key = id anggota, value = kunci base64url.
 * Tidak pernah masuk backup atau paket — hanya di perangkat pelatih.
 */
export function bacaKunciPribadi(): PetaKunci {
  try {
    const raw = localStorage.getItem(KUNCI_SIMPAN)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as PetaKunci
    return {}
  } catch {
    return {}
  }
}

export function simpanKunciPribadi(peta: PetaKunci): void {
  try {
    localStorage.setItem(KUNCI_SIMPAN, JSON.stringify(peta))
  } catch {
    /* localStorage diblokir */
  }
}

/**
 * Hasilkan kunci baru untuk semua anggota yang belum punya kunci.
 * Mengembalikan peta yang sudah diperbarui (yang lama tetap ada).
 */
export async function buatKunciBelumAda(anggota: { id: string }[]): Promise<PetaKunci> {
  const peta = bacaKunciPribadi()
  for (const m of anggota) {
    if (!peta[m.id]) {
      peta[m.id] = await buatKunci()
    }
  }
  simpanKunciPribadi(peta)
  return peta
}

/**
 * Buat kunci baru untuk satu anggota (bila kunci bocor).
 *
 * Terbitan lama di riwayat repo tetap terbuka dengan kunci lama —
 * catatan jujur ini harus ditulis di antarmuka.
 */
export async function buatKunciBaru(memberId: string): Promise<string> {
  const kunci = await buatKunci()
  const peta = bacaKunciPribadi()
  peta[memberId] = kunci
  simpanKunciPribadi(peta)
  return kunci
}

/* =========================== URL kunci (untuk QR) ========================== */

/**
 * Bentuk URL yang berisi kunci di fragment.
 *
 * Contoh: `https://drill-kit.vercel.app/#<kunci>`
 *
 * Fragment (#) tidak pernah dikirim ke server — jadi kunci tetap aman
 * walau URL-nya dipindai semua orang.
 */
export function urlDenganKunci(alamat: string, kunci: string): string {
  // Buang fragment lama bila ada
  const bersih = alamat.replace(/#.*$/, '').replace(/\/+$/, '')
  return `${bersih}/#${kunci}`
}

/**
 * Ambil kunci dari URL fragment.
 *
 * Mengembalikan string kosong bila tidak ada fragment, atau teks
 * fragment bila ada. Tidak divalidasi — validasi dilakukan saat
 * hendak mendekripsi.
 */
export function kunciDariUrl(): string {
  if (typeof location === 'undefined') return ''
  const hash = location.hash
  // DrillKit memakai HashRouter (`#/berbagi`). Itu adalah rute, bukan QR
  // kunci. `main.tsx` memindahkan fragment QR awal ke query DI DALAM hash
  // (`#/berbagi?kunci=...`) sebelum router dipasang; keduanya tetap tidak
  // pernah dikirim ke server.
  if (hash.startsWith('#/')) {
    const tandaTanya = hash.indexOf('?')
    if (tandaTanya < 0) return ''
    return new URLSearchParams(hash.slice(tandaTanya + 1)).get('kunci')?.trim() ?? ''
  }
  return hash.replace(/^#\/?/, '').trim()
}

/**
 * Simpan kunci yang diterima anggota (dari URL fragment atau berkas).
 *
 * Disimpan di localStorage per perangkat, bukan di IndexedDB,
 * supaya tidak ikut backup dan tidak bercampur dengan data tim.
 */
const KUNCI_ANGGOTA = 'drillkit.kunciAnggota'

export function simpanKunciAnggota(kunci: string): void {
  try {
    localStorage.setItem(KUNCI_ANGGOTA, kunci)
  } catch {
    /* */
  }
}

export function bacaKunciAnggota(): string {
  try {
    return localStorage.getItem(KUNCI_ANGGOTA) ?? ''
  } catch {
    return ''
  }
}

/* ============================ Cek ketersediaan ============================= */

/**
 * Apakah `crypto.subtle` tersedia di peramban ini?
 *
 * Di `file://` (versi portabel), `crypto.subtle` bisa saja tidak ada
 * atau tidak punya metode yang diperlukan. Anggota umumnya memakai
 * situs HTTPS, jadi ini jarang terjadi — tapi perlu dicek supaya UI
 * bisa memberi catatan jujur.
 */
export function cryptoTersedia(): boolean {
  try {
    return typeof crypto !== 'undefined'
      && typeof crypto.subtle === 'object'
      && typeof crypto.subtle.generateKey === 'function'
      && typeof crypto.subtle.encrypt === 'function'
      && typeof crypto.subtle.decrypt === 'function'
  } catch {
    return false
  }
}

/* ================================ Internal ================================= */

const IV_PANJANG = 12 // 96 bit — standar AES-GCM

const ABJAD_URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

/** Encode Uint8Array ke base64url (tanpa padding). */
function base64url(buf: Uint8Array): string {
  let out = ''
  for (let i = 0; i < buf.length; i += 3) {
    const a = buf[i]
    const b = i + 1 < buf.length ? buf[i + 1] : 0
    const c = i + 2 < buf.length ? buf[i + 2] : 0
    const n = (a << 16) | (b << 8) | c
    out += ABJAD_URL[(n >> 18) & 63]
    out += ABJAD_URL[(n >> 12) & 63]
    if (i + 1 < buf.length) out += ABJAD_URL[(n >> 6) & 63]
    if (i + 2 < buf.length) out += ABJAD_URL[n & 63]
  }
  return out
}

/** Decode base64url (dengan atau tanpa padding) ke Uint8Array. */
function base64urlDecode(s: string): Uint8Array {
  // Terima base64 standar dan base64url
  const bersih = s.replace(/[\s=]/g, '').replace(/-/g, '+').replace(/_/g, '/')
  const bytes: number[] = []
  for (let i = 0; i < bersih.length; i += 4) {
    const c0 = ABJAD_STANDAR.indexOf(bersih[i] ?? 'A')
    const c1 = ABJAD_STANDAR.indexOf(bersih[i + 1] ?? 'A')
    const c2 = bersih[i + 2] === undefined ? -1 : ABJAD_STANDAR.indexOf(bersih[i + 2])
    const c3 = bersih[i + 3] === undefined ? -1 : ABJAD_STANDAR.indexOf(bersih[i + 3])
    const n = ((c0 < 0 ? 0 : c0) << 18) | ((c1 < 0 ? 0 : c1) << 12) | ((c2 < 0 ? 0 : c2) << 6) | (c3 < 0 ? 0 : c3)
    bytes.push((n >> 16) & 255)
    if (c2 >= 0) bytes.push((n >> 8) & 255)
    if (c3 >= 0) bytes.push(n & 255)
  }
  return new Uint8Array(bytes)
}

const ABJAD_STANDAR = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'