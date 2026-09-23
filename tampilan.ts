/**
 * B4 — Tampilan: **kontras tinggi** dan **huruf besar**.
 *
 * Gunanya: layar HP sulit dibaca saat latihan di luar ruangan kena matahari.
 * Dua pengaturan ini bisa dinyalakan sendiri-sendiri atau bersamaan:
 *
 * - `kontras` → diberi penanda `data-kontras="1"` pada `<html>`. Aturannya
 *   hidup di `src/index.css` (latar digelapkan, teks diterangkan, batas
 *   dipertegas, warna lapangan dibuat lebih pekat).
 * - `besar` → diberi penanda `data-ukuran="besar"` pada `<html>`. Karena
 *   ukuran Tailwind memakai `rem`, mengubah `font-size` di `<html>` saja sudah
 *   membuat seluruh antarmuka ikut membesar — tombol, jarak, dan teks.
 *
 * Pilihan disimpan di `localStorage` supaya tetap sama setelah aplikasi
 * dimuat ulang, dan dibungkus `try/catch` karena localStorage bisa diblokir
 * (mode pribadi, atau berkas `file://` di beberapa browser).
 */

const KUNCI = 'drillkit.tampilan'

export type Tampilan = {
  /** Kontras tinggi: warna lebih pekat, teks lebih terang. */
  kontras: boolean
  /** Huruf besar: seluruh antarmuka diperbesar. */
  besar: boolean
}

const BAKU: Tampilan = { kontras: false, besar: false }

function baca(): Partial<Tampilan> {
  try {
    const raw = localStorage.getItem(KUNCI)
    return raw ? (JSON.parse(raw) as Partial<Tampilan>) : {}
  } catch {
    /* abaikan — pakai nilai bawaan */
  }
  return {}
}

/** Pengaturan tampilan yang tersimpan. */
export function bacaTampilan(): Tampilan {
  const p = baca()
  return { kontras: p.kontras === true, besar: p.besar === true }
}

/** Pasang penanda ke elemen `<html>` — CSS yang mengerjakan sisanya. */
export function terapkanTampilan(t: Tampilan) {
  const el = document.documentElement
  if (t.kontras) el.setAttribute('data-kontras', '1')
  else el.removeAttribute('data-kontras')
  if (t.besar) el.setAttribute('data-ukuran', 'besar')
  else el.removeAttribute('data-ukuran')
}

/** Simpan ke localStorage, lalu pasang penanda dan kabari semua pemirsa. */
export function simpanTampilan(t: Tampilan) {
  try {
    localStorage.setItem(KUNCI, JSON.stringify({ kontras: !!t.kontras, besar: !!t.besar }))
  } catch {
    /* abaikan — tetap dipakai walau tidak tersimpan */
  }
  terapkanTampilan(t)
  for (const fn of pemirsa) fn(t)
}

/** Ubah sebagian pengaturan (yang tidak disebut tetap dipertahankan). */
export function ubahTampilan(potongan: Partial<Tampilan>): Tampilan {
  const berikut = { ...bacaTampilan(), ...potongan }
  simpanTampilan(berikut)
  return berikut
}

/* --------------------------- Langganan (React) ---------------------------- */

const pemirsa = new Set<(t: Tampilan) => void>()

/**
 * Dengarkan perubahan pengaturan tampilan dari mana pun (termasuk dari
 * presenter atau halaman lain). Mengembalikan fungsi untuk berhenti
 * berlangganan, jadi aman dipakai di `useEffect`.
 */
export function langgananTampilan(fn: (t: Tampilan) => void): () => void {
  pemirsa.add(fn)
  return () => pemirsa.delete(fn)
}

/** Terapkan pengaturan tersimpan sekali saat aplikasi dinyalakan. */
export function mulaiTampilan() {
  terapkanTampilan(bacaTampilan())
}

export const TAMPILAN_BAKU = BAKU
