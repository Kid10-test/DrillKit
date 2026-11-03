/**
 * Daftar shortcut editor formasi — **satu sumber** untuk dua tempat:
 * 1. Dialog "Shortcut keyboard" di editor (tombol `?`).
 * 2. Bagian shortcut pada **Panduan 1 halaman** (F4).
 *
 * Dipisah ke modul sendiri supaya kedua tempat tidak pernah berbeda isi.
 */

export interface GrupShortcut {
  kelompok: string
  baris: [string, string][]
}

export const DAFTAR_SHORTCUT: GrupShortcut[] = [
  {
    kelompok: 'Pilihan & menggeser',
    baris: [
      ['Klik / Shift+klik', 'Pilih satu / tambah pilihan'],
      ['Seret / Shift+seret', 'Kotak pilih / Lasso bebas'],
      ['Ctrl + A / Esc', 'Pilih semua / lepas pilihan'],
      ['X / Y', 'Kunci gerak ke sumbu X / Y'],
      ['Panah', 'Geser titik terpilih 1 langkah'],
      ['Shift + Panah', 'Geser 4 langkah sekaligus'],
      ['Gagang kotak/kurva', 'Rentang, putar bebas, & lengkung'],
      ['Delete', 'Keluarkan titik terpilih dari set'],
    ],
  },
  {
    kelompok: 'Set & animasi',
    baris: [
      ['[ / ]', 'Set sebelumnya / berikutnya'],
      ['Spasi', 'Mainkan / jeda perpindahan'],
      ['Geser garis waktu', 'Lihat posisi di tengah perpindahan'],
      ['Ctrl + D', 'Duplikat set aktif'],
      ['Ctrl + Z', 'Undo'],
      ['Ctrl + Shift + Z', 'Redo'],
    ],
  },
  {
    kelompok: 'Tampilan',
    baris: [
      ['K', 'Kode pemain: tampil / sembunyi'],
      ['J', 'Jejak gerak: tampil / sembunyi'],
      ['M', 'Penanda lapangan: tampil / sembunyi'],
      ['L', 'Ulangi perpindahan terus-menerus'],
      ['R', 'Urutan latihan: mainkan semua set berurutan'],
      ['F', 'Mode presenter (layar penuh)'],
      ['Ctrl+K / ?', 'Palet perintah & pintasan'],
    ],
  },
]
