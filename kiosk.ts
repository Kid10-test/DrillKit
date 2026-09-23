/**
 * Mode kios / kunci data (F2).
 *
 * Gunanya: HP pelatih kadang dipinjam anggota — misalnya untuk melihat formasi
 * atau menjalankan mode presenter. Dalam keadaan terkunci, aplikasi tetap bisa
 * **dilihat dan dijelajahi**, tapi tidak ada satu pun tombol yang bisa mengubah
 * data (formasi, absensi, anggota, jadwal, pengaturan).
 *
 * Cara kerjanya ada dua lapis:
 * 1. **Penjaga global** (`installKioskGuard`) — satu pemasang event di `document`
 *    yang memblokir klik pada kontrol yang bisa mengubah data. Jadi tidak perlu
 *    menyunting satu per satu halaman: tombol baru pun otomatis terkunci.
 * 2. **Penanda di tampilan** — area yang *boleh* dipakai saat terkunci ditandai
 *    `data-kiosk-allow` (navigasi, presenter, metronom, ganti set). Sebaliknya
 *    kanvas editor ditandai `data-kiosk-block` supaya titik tidak bisa diseret.
 *
 * Catatan jujur: ini **pengaman pemakaian**, bukan kunci keamanan tingkat tinggi.
 * PIN disimpan sebagai hash sederhana di localStorage supaya tidak terbaca
 * langsung, dan berguna untuk mencegah perubahan tidak sengaja.
 */

const KEY_LOCK = 'drillkit.kiosk'
const KEY_PIN = 'drillkit.kiosk.pin'
const KEY_HINT = 'drillkit.kiosk.hint'
const KEY_AUTO = 'drillkit.kiosk.autolock'

/** Penanda: area ini tetap boleh dipakai saat mode kios aktif. */
export const ALLOW_ATTR = 'data-kiosk-allow'
/** Penanda: area ini diblokir total saat mode kios aktif (mis. kanvas editor). */
export const BLOCK_ATTR = 'data-kiosk-block'

/** Jenis kontrol yang selalu diblokir saat terkunci, kecuali ada di area allow. */
const KONTROL_EDIT =
  'button,select,textarea,input[type="checkbox"],input[type="radio"],input[type="file"],a[download],[role="button"]'

function baca(kunci: string): string {
  try {
    return localStorage.getItem(kunci) ?? ''
  } catch {
    return ''
  }
}

function tulis(kunci: string, nilai: string) {
  try {
    if (nilai) localStorage.setItem(kunci, nilai)
    else localStorage.removeItem(kunci)
  } catch {
    /* abaikan — mode kios tetap jalan walau localStorage diblokir */
  }
}

/** Apakah mode kios sedang aktif (tetap aktif setelah aplikasi dimuat ulang). */
export function isKiosk(): boolean {
  return baca(KEY_LOCK) === '1'
}

/** Aktifkan / matikan mode kios. */
export function setKiosk(on: boolean) {
  tulis(KEY_LOCK, on ? '1' : '')
}

/**
 * Kunci otomatis setelah sekian menit tanpa satu pun sentuhan.
 *
 * **Bawaan: mati (0).** Sengaja tidak dinyalakan sendiri. Kunci yang aktif
 * tanpa diminta akan mengunci layar di tengah latihan — dan itu jauh lebih
 * menyusahkan daripada perangkat yang dibiarkan terbuka. Pelatih yang mau
 * memakainya harus memilih waktunya sendiri.
 *
 * Hanya berarti **bila PIN terpasang**: tanpa PIN, siapa pun bisa membuka
 * kuncinya lagi dengan satu tombol, jadi menguncinya tidak melindungi apa
 * pun. Ini pagar pemakaian, bukan kunci keamanan — seperti mode kios itu
 * sendiri.
 */
export function bacaKunciOtomatis(): number {
  const n = Number.parseInt(baca(KEY_AUTO), 10)
  return Number.isFinite(n) && n > 0 ? n : 0
}

/** Atur kunci otomatis. `0` mematikannya. */
export function aturKunciOtomatis(menit: number) {
  tulis(KEY_AUTO, menit > 0 ? String(Math.round(menit)) : '')
}

/**
 * Hash PIN sederhana (djb2). Bukan untuk keamanan tinggi — tujuannya supaya
 * PIN tidak terbaca begitu saja kalau seseorang membuka localStorage.
 */
export function hashPin(pin: string): string {
  let h = 5381
  const s = `drillkit::${pin}`
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return `k${(h >>> 0).toString(36)}`
}

/** Apakah sudah ada PIN yang dipasang. */
export function hasPin(): boolean {
  return baca(KEY_PIN) !== ''
}

/** Simpan PIN baru beserta petunjuknya (petunjuk boleh kosong). */
export function setPin(pin: string, hint: string) {
  tulis(KEY_PIN, pin ? hashPin(pin) : '')
  tulis(KEY_HINT, pin ? hint.trim() : '')
}

/** Hapus PIN —Mode kios cukup dibuka dengan tombol, tanpa PIN. */
export function clearPin() {
  tulis(KEY_PIN, '')
  tulis(KEY_HINT, '')
}

/** Petunjuk PIN yang ditulis pelatih saat memasang PIN. */
export function getHint(): string {
  return baca(KEY_HINT)
}

/** Periksa apakah PIN yang diketik benar. */
export function checkPin(pin: string): boolean {
  const tersimpan = baca(KEY_PIN)
  if (!tersimpan) return true
  return tersimpan === hashPin(pin)
}

/**
 * Pasang penjaga global. Dipanggil sekali saat mode kios aktif.
 *
 * @param onBlocked Dipanggil kalau ada aksi yang ditolak — dipakai untuk
 *                  menampilkan pesan "terkunci" (sudah dijarangkan sendiri
 *                  supaya tidak membanjiri layar).
 * @returns fungsi pembersih — wajib dipanggil saat kunci dibuka.
 */
export function installKioskGuard(onBlocked: () => void): () => void {
  const el = (t: EventTarget | null): Element | null => (t instanceof Element ? t : null)
  const boleh = (t: EventTarget | null) => !!el(t)?.closest(`[${ALLOW_ATTR}]`)
  const diblok = (t: EventTarget | null) => !!el(t)?.closest(`[${BLOCK_ATTR}]`)

  let terakhirPesan = 0
  function tolak(e: Event) {
    e.preventDefault()
    e.stopPropagation()
    const now = Date.now()
    if (now - terakhirPesan > 1200) {
      terakhirPesan = now
      onBlocked()
    }
  }

  const onClick = (e: MouseEvent) => {
    const t = el(e.target)
    if (!t || boleh(t)) return
    if (diblok(t) || t.closest(KONTROL_EDIT)) tolak(e)
  }

  // Menggeser titik dimulai dari pointerdown, jadi harus ditahan di sini
  // (kalau cuma klik yang ditahan, titiknya sudah telanjur bergerak).
  const onPointerDown = (e: PointerEvent) => {
    const t = el(e.target)
    if (t && !boleh(t) && diblok(t)) tolak(e)
  }

  const onChange = (e: Event) => {
    const t = e.target
    if (boleh(t)) return
    if (t instanceof HTMLSelectElement) return tolak(e)
    if (t instanceof HTMLInputElement && ['checkbox', 'radio', 'file'].includes(t.type)) tolak(e)
  }

  // Shortcut yang mengubah data (Ctrl+Z, Ctrl+Shift+Z, Ctrl+A, …) ikut dikunci.
  // Menyalin (Ctrl+C) tetap dibolehkan karena tidak mengubah apa pun.
  const onKeyDown = (e: KeyboardEvent) => {
    if (boleh(e.target)) return
    if (!(e.ctrlKey || e.metaKey || e.altKey)) return
    if (e.key.toLowerCase() === 'c') return
    tolak(e)
  }

  const onSubmit = (e: Event) => {
    if (!boleh(e.target)) tolak(e)
  }

  document.addEventListener('click', onClick, true)
  document.addEventListener('pointerdown', onPointerDown, true)
  document.addEventListener('change', onChange, true)
  document.addEventListener('keydown', onKeyDown, true)
  document.addEventListener('submit', onSubmit, true)
  // Dipakai CSS untuk meredupkan tampilan saat terkunci.
  document.documentElement.setAttribute('data-kiosk', '1')

  return () => {
    document.removeEventListener('click', onClick, true)
    document.removeEventListener('pointerdown', onPointerDown, true)
    document.removeEventListener('change', onChange, true)
    document.removeEventListener('keydown', onKeyDown, true)
    document.removeEventListener('submit', onSubmit, true)
    document.documentElement.removeAttribute('data-kiosk')
  }
}
