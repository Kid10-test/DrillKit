/**
 * F4 — Panduan pemakaian 1 halaman.
 *
 * Satu lembar A4 yang bisa dicetak & ditempel, berisi: urutan pakai yang
 * paling sering, isi tiap menu, shortcut editor formasi, dan cara mengatasi
 * empat macet yang paling sering terjadi.
 *
 * Isinya **dibuat dari data tim yang sedang aktif** — nama tim, logo, jumlah
 * anggota/sesi/drill, daftar section, dan interval pengingat backup — jadi
 * lembarannya terasa milik tim itu sendiri, bukan panduan generik.
 *
 * Tata letaknya dua kolom (`column-count: 2`) dengan ukuran huruf kecil agar
 * benar-benar muat **satu halaman A4**. Kalau kelak menambah bagian baru,
 * periksa lagi jumlah halamannya (bisa lewat `Cetak → Pratinjau` di browser).
 */

import type { SectionDef } from '../db/types'
import { DAFTAR_SHORTCUT } from './shortcut'
import { esc, printShell } from './print'

export interface DataPanduan {
  namaTim: string
  kota?: string
  pelatih?: string
  /** data URL logo tim (opsional) */
  logo?: string
  /** label section yang tidak disembunyikan */
  section: SectionDef[]
  anggotaAktif: number
  sesi: number
  drill: number
  lagu: number
  /** pengingat backup: 0 = dimatikan */
  hariBackup: number
  /** true kalau aplikasi dibuka dari berkas (versi portabel) */
  portabel: boolean
}

const BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

function tanggalCetak(kota?: string): string {
  const n = new Date()
  const tgl = `${n.getDate()} ${BULAN[n.getMonth()]} ${n.getFullYear()}`
  return kota ? `${kota}, ${tgl}` : tgl
}

/** Baris tabel dua kolom. */
function tr(a: string, b: string): string {
  return `<tr><td>${a}</td><td>${b}</td></tr>`
}

/* --------------------------------- Isi ------------------------------------ */

/** Langkah-langkah yang paling sering dipakai — urutan ini yang dicetak. */
const LANGKAH: [string, string][] = [
  [
    'Susun formasi',
    'Menu <b>Drill &amp; Formasi</b>: tambah set, geser titik (Panah = 1 langkah, Shift + Panah = 4), lalu <b>Putar</b> untuk melihat perpindahannya. Tombol <b>F</b> membuka presenter layar penuh.',
  ],
  [
    'Bawa ke lapangan',
    'Di editor: <b>Dot sheet &amp; buku saku</b> → <b>Pratinjau</b> → <b>Cetak</b>. Buku saku 9,5 × 13,5 cm, tinggal dilipat dan masuk saku pemain.',
  ],
  [
    'Jadwal &amp; absensi',
    '<b>Jadwal</b>: buat sesi, pilih jenis kegiatan, isi checklist materi. <b>Absensi</b>: isi manual atau scan QR. Tab <b>Rekap</b>: tren kehadiran, lalu tombol <b>Pratinjau laporan</b> / <b>Pratinjau kartu</b>.',
  ],
  [
    'Kirim ke anggota',
    '<b>Berbagi</b> → <b>Ekspor paket</b> → kirim berkas <i>.json</i>-nya lewat WhatsApp. Anggota membuka berkas itu di HP, memilih namanya sekali, lalu melihat jadwal, posisi formasinya, dan rekap kehadirannya.',
  ],
  [
    'Kerja bareng pelatih lain',
    'Di editor drill, tombol ⚙ → <b>Ekspor show</b>. Berkasnya dikirim; pelatih itu menyusun set sendiri lalu mengirim balik. Terima dengan <b>Impor show</b> → pilih <i>gabung</i>, <i>timpa</i>, atau <i>salinan</i>.',
  ],
  [
    'Tuning sebelum latihan',
    'Menu <b>Musik &amp; Metronom</b> → kartu <b>Penala &amp; nada dengung</b>: pilih nada (tombol cepat <b>Bb konser</b>), <b>Putar dengung</b>, lalu <b>Dengarkan</b>. Jarum di tengah = tepat.',
  ],
]

/** Isi tiap menu — mengikuti nama menu yang tampil di aplikasi. */
const MENU: [string, string][] = [
  ['Dashboard', 'Ringkasan: kehadiran 30 hari, jadwal terdekat, komposisi tim'],
  ['Anggota', 'Data anggota, impor CSV, cetak kartu QR untuk absensi'],
  ['Jadwal', 'Sesi latihan &amp; jenis kegiatan, checklist materi, catatan'],
  ['Absensi', 'Isi kehadiran / scan QR · tab <b>Rekap</b>: tren, laporan, kartu kehadiran'],
  ['Drill &amp; Formasi', 'Editor formasi: set, animasi, presenter, buku saku, berbagi show'],
  ['Musik &amp; Metronom', 'Metronom &amp; pola ritme, penala, nada dengung, repertoar lagu'],
  ['Berbagi', 'Paket .json untuk anggota: jadwal, formasi, absensi, catatan evaluasi'],
  ['Pengaturan', 'Profil tim, standar lapangan, section, backup &amp; pulihkan data'],
]

/** Empat macet yang paling sering — beserta jalan keluarnya. */
function macet(hariBackup: number, portabel: boolean): [string, string][] {
  return [
    [
      'Tombol <b>Cetak</b> tidak memunculkan apa-apa',
      'Browser memblokir jendela baru. Pakai <b>Pratinjau</b> (hasilnya tampil di dalam aplikasi), atau <b>Unduh HTML</b> lalu buka berkasnya dan tekan Ctrl + P.',
    ],
    [
      'Mikrofon penala tidak mau menyala',
      'Klik ikon gembok di kiri alamat → izinkan <b>Mikrofon</b>. Buka aplikasi di tab browser biasa, bukan di dalam pratinjau.',
    ],
    [
      'Muncul <i>“Penyimpanan browser belum bisa dipakai”</i>',
      portabel
        ? 'Berkas DrillKit.html dibuka di dalam pratinjau/iframe atau mode penyamaran. Buka berkasnya lewat browser (Files → Chrome), bukan dari dalam pratinjau.'
        : 'Halaman dibuka di dalam iframe/pratinjau atau mode penyamaran. Buka aplikasi di tab browser biasa supaya data bisa tersimpan.',
    ],
    [
      'Takut data hilang / mau pindah perangkat',
      `<b>Pengaturan → Kelola data → Ekspor backup (JSON)</b>, simpan berkasnya di luar perangkat (email/Drive/flashdisk), lalu <b>Pulihkan backup</b> di perangkat baru.${
        hariBackup > 0 ? ` Pengingat backup menyala tiap <b>${hariBackup} hari</b>.` : ''
      }`,
    ],
  ]
}

/* ------------------------------- Penyusun --------------------------------- */

export function bodyPanduan(d: DataPanduan): string {
  const logo = d.logo ? `<img src="${esc(d.logo)}" alt="logo" />` : ''
  const bagian: string[] = []

  bagian.push(`<h2>Mulai dari sini</h2>
    <ol>
      ${LANGKAH.map(([a, b]) => `<li><b>${a}.</b> ${b}</li>`).join('\n      ')}
    </ol>`)

  bagian.push(`<h2>Isi tiap menu</h2>
    <table>
      <thead><tr><th style="width:26%">Menu</th><th>Untuk apa</th></tr></thead>
      <tbody>${MENU.map(([a, b]) => tr(`<b>${a}</b>`, b)).join('')}</tbody>
    </table>`)

  bagian.push(
    `<h2>Shortcut di editor formasi <span style="font-weight:400;color:#666">(tekan ? untuk daftar lengkap di layar)</span></h2>
    ${DAFTAR_SHORTCUT.map(
      (g) => `<table>
      <thead><tr><th style="width:30%">${esc(g.kelompok)}</th><th>Keterangan</th></tr></thead>
      <tbody>${g.baris.map(([k, ket]) => tr(`<b>${esc(k)}</b>`, esc(ket))).join('')}</tbody>
    </table>`,
    ).join('\n    ')}`,
  )

  bagian.push(`<h2>Kalau macet</h2>
    <table>
      <thead><tr><th style="width:38%">Gejala</th><th>Cara mengatasi</th></tr></thead>
      <tbody>${macet(d.hariBackup, d.portabel).map(([a, b]) => tr(a, b)).join('')}</tbody>
    </table>`)

  const section = d.section.length
    ? d.section.map((s) => esc(s.label)).join(', ')
    : 'belum diatur'

  bagian.push(`<h2>Yang perlu diingat</h2>
    <div class="kotak">
      <ul>
        <li>Data tersimpan <b>hanya di perangkat ini</b> — bukan di server. Karena itu backup berkala itu wajib.</li>
        <li>Bekerja <b>offline</b>: sekali dibuka, aplikasi tetap jalan tanpa sinyal.</li>
        <li>Section tim ini: <b>${section}</b>. Standar lapangan &amp; ukuran langkah bisa diubah di <b>Pengaturan</b>.</li>
        <li>Tidak sengaja mengubah formasi? <b>Ctrl + Z</b> berulang kali; <b>Ctrl + Shift + Z</b> untuk mengulang.</li>
      </ul>
    </div>`)

  return `
    <div class="kop">
      ${logo}
      <div>
        <div class="nama">${esc(d.namaTim || 'Marching Band')}</div>
        <div class="sub">Panduan Singkat DrillKit · dicetak ${esc(tanggalCetak(d.kota))} · ${d.anggotaAktif} anggota aktif · ${d.sesi} sesi · ${d.drill} drill · ${d.lagu} lagu</div>
      </div>
    </div>
    <div class="isi">
      ${bagian.join('\n      ')}
      <p class="catatan">
        Lembar ini dibuat otomatis oleh DrillKit dari pengaturan tim ini, jadi isinya mengikuti data &amp;
        kebiasaan tim saat ini${d.pelatih ? ` — pelatih: ${esc(d.pelatih)}` : ''}.
        Bagikan ke pelatih lain atau anggota yang baru mulai.
      </p>
    </div>`
}

/** Panduan lengkap siap cetak / unduh. */
export function htmlPanduan(d: DataPanduan): string {
  const css = `
    @page { size: A4 portrait; margin: 9mm 8mm; }
    body { font-size: 8.4pt; line-height: 1.3; color:#000; }
    .kop { display:flex; align-items:center; gap:8px; border-bottom:2px solid #111; padding-bottom:5px; margin-bottom:6px; }
    .kop img { height:32px; width:auto; }
    .kop .nama { font-size:12pt; font-weight:700; line-height:1.15; }
    .kop .sub { font-size:7.4pt; color:#555; }
    .isi { column-count:2; column-gap:6mm; }
    h2 { font-size:8.6pt; margin:6px 0 3px; padding-left:4px; border-left:3px solid #111; break-after:avoid; }
    ol, ul { margin:2px 0 4px; padding-left:12px; }
    li { margin-bottom:2.5px; break-inside:avoid; }
    table { width:100%; border-collapse:collapse; margin:2px 0 5px; }
    th, td { border:1px solid #aaa; padding:1.6px 3px; text-align:left; vertical-align:top; }
    th { background:#eef2f7; font-size:7.4pt; text-transform:uppercase; }
    .kotak { border:1px solid #bbb; background:#fafafa; padding:4px 6px; margin:3px 0 4px; break-inside:avoid; }
    .catatan { font-size:7.2pt; color:#444; margin-top:6px; border-top:1px solid #ccc; padding-top:4px; }
  `
  return printShell(`Panduan DrillKit — ${d.namaTim}`, bodyPanduan(d), css)
}
