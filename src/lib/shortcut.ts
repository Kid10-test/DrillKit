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
      ['Klik', 'Pilih satu titik'],
      ['Shift + klik', 'Tambah / kurangi pilihan'],
      ['Seret di lapangan', 'Kotak pilih (marquee)'],
      ['Ctrl + A', 'Pilih semua titik yang tampil'],
      ['Esc', 'Batalkan pilihan'],
      ['Panah', 'Geser titik terpilih 1 langkah'],
      ['Shift + Panah', 'Geser 4 langkah sekaligus'],
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
      ['?', 'Buka daftar ini'],
    ],
  },
]
