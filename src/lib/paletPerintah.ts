/**
 * #23.4 — Mesin Pencarian & Katalog Palet Perintah Terpadu (`Ctrl+K` / `⌘K` / `?`).
 *
 * Menggabungkan eksekusi aksi langsung (*Command Palette*) dan daftar referensi
 * pintasan keyboard (`DAFTAR_SHORTCUT`) ke dalam satu jendela bebas tumpang tindih.
 */

import type { GrupShortcut } from './shortcut'

export interface ItemPaletPerintah {
  id: string
  label: string
  kategori: string
  /** Label tombol pintasan keyboard (mis. "Ctrl + D", "X", "[ / ]"). */
  pintasan?: string
  /** Kata kunci tambahan untuk pencarian cepat Bahasa Indonesia / istilah lapangan. */
  kataKunci?: string[]
  /** Bila true, aksi sedang tidak bisa dijalankan (mis. belum ada titik dipilih). */
  nonaktif?: boolean
  /** Bila true, baris ini murni pengingat pintasan gerak (mis. Panah / Shift+Panah). */
  hanyaInfo?: boolean
  /** Fungsi yang langsung dijalankan saat baris dipilih dengan Enter / klik. */
  jalankan?: () => void
}

function normTeks(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim()
}

/**
 * Saring & urutkan item palet berdasarkan kueri ketikan pengguna.
 *
 * Bila kueri kosong, seluruh item dikembalikan utuh sesuai urutan kategorinya.
 * Bila kueri diisi, tiap token kueri wajib cocok di `label`, `kategori`,
 * `pintasan`, atau `kataKunci`, lalu diurutkan menurut skor kemiripan tertinggi.
 */
export function saringPerintahPalet(
  daftar: readonly ItemPaletPerintah[],
  kueri: string,
): ItemPaletPerintah[] {
  const q = normTeks(kueri)
  if (!q) return [...daftar]
  const token = q.split(' ').filter(Boolean)

  const hasil: { item: ItemPaletPerintah; skor: number; urutan: number }[] = []
  daftar.forEach((item, urutan) => {
    const label = normTeks(item.label)
    const kat = normTeks(item.kategori)
    const pnt = normTeks(item.pintasan ?? '')
    const kunci = (item.kataKunci ?? []).map(normTeks).join(' ')
    const gabungan = `${label} ${kat} ${pnt} ${kunci}`

    if (!token.every((tk) => gabungan.includes(tk))) return

    let skor = 0
    if (label === q || pnt === q) skor += 120
    else if (label.startsWith(q)) skor += 80
    else if (label.includes(q)) skor += 50
    if (pnt && pnt.includes(q)) skor += 40
    if (kunci.includes(q)) skor += 25
    if (!item.hanyaInfo && !item.nonaktif) skor += 15
    if (item.nonaktif) skor -= 10

    hasil.push({ item, skor, urutan })
  })

  hasil.sort((a, b) => b.skor - a.skor || a.urutan - b.urutan)
  return hasil.map((h) => h.item)
}

/**
 * Ubah baris-baris `DAFTAR_SHORTCUT` yang belum terwakili oleh perintah aktif
 * menjadi baris referensi di dalam palet yang sama — sehingga menekan `?` tetap
 * menampilkan seluruh dokumentasi pintasan keyboard tanpa perlu dua modal berbeda.
 */
export function lengkapiReferensiPintasan(
  perintahAktif: readonly ItemPaletPerintah[],
  daftarShortcut: readonly GrupShortcut[],
): ItemPaletPerintah[] {
  const sudahAda = new Set(
    perintahAktif
      .map((p) => normTeks(p.pintasan ?? ''))
      .filter(Boolean),
  )
  const tambahan: ItemPaletPerintah[] = []
  daftarShortcut.forEach((grup, gi) => {
    grup.baris.forEach(([tombol, ket], bi) => {
      const k = normTeks(tombol)
      if (sudahAda.has(k)) return
      tambahan.push({
        id: `ref-shortcut-${gi}-${bi}`,
        label: ket,
        kategori: `Pintasan · ${grup.kelompok}`,
        pintasan: tombol,
        hanyaInfo: true,
      })
    })
  })
  return [...perintahAktif, ...tambahan]
}
