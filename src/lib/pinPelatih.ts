/**
 * PIN pelatih tim (#8).
 *
 * Pagar, bukan brankas: data tim memang tidak bisa dijangkau dari HP
 * anggota. PIN hanya membuat mode pelatih *terasa khusus*.
 *
 * PIN asli (`PIN_PELATIH`) diubah menjadi hash PBKDF2 pada saat build
 * (`__PIN_PELATIH_HASH__`). Bundle tidak pernah berisi PIN polos.
 *
 * Perangkat yang sudah lolos mengingat **hash yang sama**. Mengganti PIN
 * (redeploy) membuat hash berbeda → semua perangkat ditanya lagi.
 *
 * `PIN_PELATIH` kosong = perilaku lama, termasuk `DrillKit.html`.
 */

declare const __PIN_PELATIH_HASH__: string

export const GARAM_PIN = 'drillkit-pin-pelatih-v1'
export const ITER_PIN = 10_000
export const KUNCI_INGAT = 'drillkit.pinPelatih.hash'
export const BATAS_SALAH = 5
export const JEDA_MS = 2500
export const ANJURAN_PANJANG = 6

/** Hash yang disuntikkan saat build. Kosong = PIN tidak dipasang. */
export function hashPinTersuntik(): string {
  try {
    return typeof __PIN_PELATIH_HASH__ === 'string' ? __PIN_PELATIH_HASH__ : ''
  } catch {
    return ''
  }
}

/** Apakah build ini memasang PIN tim. */
export function adaPinTim(hash = hashPinTersuntik()): boolean {
  return hash.length > 0
}

function bacaIngat(): string {
  try {
    return localStorage.getItem(KUNCI_INGAT) ?? ''
  } catch {
    return ''
  }
}

function tulisIngat(nilai: string) {
  try {
    if (nilai) localStorage.setItem(KUNCI_INGAT, nilai)
    else localStorage.removeItem(KUNCI_INGAT)
  } catch {
    /* abaikan */
  }
}

/**
 * Perangkat ini sudah lolos PIN untuk hash yang sedang berlaku.
 *
 * Tanpa PIN tim: selalu lolos (perilaku lama).
 * Hash berubah (PIN diganti): tidak lolos, ditanya lagi.
 */
export function perangkatSudahLolos(hash = hashPinTersuntik()): boolean {
  if (!adaPinTim(hash)) return true
  return bacaIngat() === hash
}

/** Ingat hash yang lolos di perangkat ini. */
export function ingatPinTim(hash = hashPinTersuntik()) {
  if (!hash) return
  tulisIngat(hash)
}

/** Hapus ingatan — dipakai uji. */
export function lupaPinTim() {
  tulisIngat('')
}

/** Jeda singkat setelah 5 kali salah (ms). */
export function jedaSetelahSalah(kaliSalah: number): number {
  return kaliSalah >= BATAS_SALAH ? JEDA_MS : 0
}

/** Anjuran minimal 6 angka — tidak dipaksa. */
export function pinPendek(pin: string): boolean {
  return pin.length > 0 && pin.length < ANJURAN_PANJANG
}

function keHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** PBKDF2-SHA-256 — sama dengan yang dipakai saat build (node:crypto). */
export async function hashPinTim(pin: string): Promise<string> {
  const enc = new TextEncoder()
  const kunci = await crypto.subtle.importKey(
    'raw',
    enc.encode(pin),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: enc.encode(GARAM_PIN),
      iterations: ITER_PIN,
      hash: 'SHA-256',
    },
    kunci,
    256,
  )
  return keHex(bits)
}

/** PIN yang diketik cocok dengan hash build. Tanpa PIN tim: selalu benar. */
export async function pinTimCocok(
  pin: string,
  hash = hashPinTersuntik(),
): Promise<boolean> {
  if (!adaPinTim(hash)) return true
  if (!pin) return false
  return (await hashPinTim(pin)) === hash
}

/**
 * Boleh masuk / tetap di mode pelatih?
 *
 * - tanpa PIN tim → ya
 * - perangkat sudah ingat hash yang sama → ya
 * - PIN yang diketik cocok → ya
 */
export function bolehMasukPelatih(args: {
  adaPinTim: boolean
  sudahIngat: boolean
  pinBenar: boolean
}): boolean {
  if (!args.adaPinTim) return true
  if (args.sudahIngat) return true
  return args.pinBenar
}

/**
 * Keluar dari mode anggota: terima PIN kios **atau** PIN tim.
 *
 * Tanpa keduanya: perilaku lama (`bolehKePelatih` kios).
 */
export function pinKeluarDiterima(args: {
  adaPinKios: boolean
  pinKiosBenar: boolean
  adaPinTim: boolean
  pinTimBenar: boolean
}): boolean {
  if (args.adaPinTim && args.pinTimBenar) return true
  if (args.adaPinKios) return args.pinKiosBenar
  if (args.adaPinTim) return false
  return true
}
