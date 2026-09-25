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
import { DAFTAR_TRANSPOSISI } from './tuner'
import { TOLERANSI_LANGKAH } from './kuis'

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
    'Di editor: <b>Dot sheet &amp; buku saku</b> → <b>Pratinjau</b> → <b>Cetak</b> di kertas A4. Potong tiap kartu mengikuti garis tepi, lipat garis putus-putusnya ke belakang menjadi kartu 9,5 × 13,5 cm, dan masuk saku pemain.',
  ],
  [
    'Jadwal &amp; absensi',
    '<b>Jadwal</b>: buat sesi, pilih jenis kegiatan, isi checklist materi. <b>Absensi</b>: isi manual atau scan QR. Tab <b>Rekap</b>: tren kehadiran, lalu tombol <b>Pratinjau laporan</b> / <b>Pratinjau kartu</b>.',
  ],
  [
    'Kirim ke anggota',
    '<b>Berbagi</b> → <b>Ekspor paket</b> → kirim berkas <i>.json</i>-nya lewat WhatsApp. Anggota membuka berkas itu di HP, memilih namanya sekali, lalu melihat jadwal, posisi formasinya, dan rekap kehadirannya. Sertakan <b>Panduan anggota</b> (tombolnya di menu Berbagi).',
  ],
  [
    'Kerja bareng pelatih lain',
    'Di editor drill, tombol ⚙ → <b>Ekspor show</b>. Berkasnya dikirim; pelatih itu menyusun set sendiri lalu mengirim balik. Terima dengan <b>Impor show</b> → pilih <i>gabung</i>, <i>timpa</i>, atau <i>salinan</i>.',
  ],
  [
    'Tuning sebelum latihan',
    'Menu <b>Musik &amp; Metronom</b> → kartu <b>Penala &amp; nada dengung</b>: pilih nada (tombol cepat <b>Bb konser</b>), <b>Putar dengung</b>, lalu <b>Dengarkan</b>. Jarum di tengah = tepat. Kotak <b>Instrumen</b> menampilkan nada sesuai partitur (trumpet Bb, mellophone F, sax alto Eb).',
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

/**
 * CSS bersama kedua panduan (pelatih & anggota) — dua kolom, huruf kecil,
 * supaya muat satu halaman A4. Hex murni: aman untuk browser lama.
 */
const CSS_PANDUAN = `
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
    .qr { display:flex; gap:6px; align-items:center; border:1px solid #bbb; padding:4px; margin:3px 0 4px; break-inside:avoid; }
    .qr img { width:24mm; height:24mm; }
    .qr .alamat { font-family:monospace; font-size:7.4pt; word-break:break-all; }
`

/** Panduan lengkap siap cetak / unduh. */
export function htmlPanduan(d: DataPanduan): string {
  return printShell(`Panduan DrillKit — ${d.namaTim}`, bodyPanduan(d), CSS_PANDUAN)
}

/* ========================================================================== */
/*  J1 — Panduan 1 halaman versi ANGGOTA                                      */
/* ========================================================================== */

/**
 * Lembar untuk anggota — bukan salinan panduan pelatih yang dipangkas.
 *
 * Panduan pelatih bercerita tentang menu yang **tidak pernah dilihat
 * anggota** (editor formasi, absensi, backup). Anggota butuh hal lain:
 * bagaimana membuka aplikasinya, bagaimana memasukkan berkas dari pelatih,
 * apa isi keenam tab di HP-nya, cara menala sesuai instrumennya, dan apa
 * yang dilakukan kalau macet. Bahasanya menyapa "kamu", sama seperti layar
 * mode anggota.
 *
 * Dua keadaan yang isinya memang berbeda, dan tidak boleh tertukar:
 * - **Disajikan situs** (`alamat` terisi): ada alamat + kode QR untuk
 *   dipindai, tombol **Ambil materi dari situs**, dan **Perbarui**.
 * - **Berkas portabel** (`alamat` kosong): tidak ada alamat untuk dipindai,
 *   dan tombol Perbarui memang disembunyikan aplikasinya — panduan yang
 *   menyuruh menekan tombol yang tidak ada lebih buruk daripada tanpa panduan.
 */
export interface DataPanduanAnggota {
  namaTim: string
  kota?: string
  pelatih?: string
  /** data URL logo tim (opsional) */
  logo?: string
  /** Alamat aplikasi bila disajikan situs (http/https). Kosong = versi berkas portabel. */
  alamat?: string
  /** Kode QR alamat (data URL) — hanya dipakai bila `alamat` terisi. */
  qr?: string
  /** Sesi yang belum lewat — sekadar penanda di kepala lembar. */
  sesiMendatang: number
  drill: number
  lagu: number
}

/** Isi keenam tab anggota — urutannya sama dengan bar tab di HP. */
function tabAnggota(): [string, string][] {
  return [
    [
      'Jadwal',
      'Jadwal mendatang &amp; materinya. Spanduk di atas mengingatkan sesi <b>hari ini &amp; besok</b>. Tombol <b>Kalender</b> menyimpan sesi ke kalender HP, lengkap dengan alarm H-1 dan 1 jam sebelumnya.',
    ],
    [
      'Formasi',
      'Posisimu (titik <b>emas</b>) di tiap set. Tombol <b>‹ ›</b> pindah set; tertulis koordinat, jumlah langkah, dari mana kamu datang dan ke mana pindah. <b>Putar perpindahan</b> menunjukkan gerakannya.',
    ],
    [
      'Kuis',
      `Latihan hafalan: ketuk di peta tempat kamu berdiri di set berikutnya, lalu <b>Kunci jawaban</b>. Dihitung <b>tepat</b> bila meleset paling jauh ${TOLERANSI_LANGKAH} langkah.`,
    ],
    [
      'Absensi',
      'Rekap kehadiranmu menurut catatan pelatih. <b>Belum dicatat</b> artinya pelatih belum mengisi sesi itu — <b>bukan</b> berarti kamu tidak hadir.',
    ],
    ['Catatan', 'Catatan evaluasi dari pelatih, khusus untukmu.'],
    [
      'Musik',
      'Metronom, lagu &amp; perubahan temponya, set list, penala, dan nada dengung. Bisa dipakai walau belum memilih nama.',
    ],
  ]
}

/** Macet yang paling mungkin dialami anggota — beserta jalan keluarnya. */
function macetAnggota(disajikan: boolean): [string, string][] {
  const baris: [string, string][] = []
  if (disajikan) {
    baris.push([
      'Halaman “link rusak” / <i>Aplikasi gagal dimuat</i>',
      'HP-mu masih menyimpan versi lama. Tekan <b>Bersihkan &amp; muat ulang</b> di layar itu. Data di dalam aplikasi tidak ikut terhapus.',
    ])
  }
  baris.push(
    [
      'Berkas <i>.json</i> dari WhatsApp tidak mau terbuka',
      'Jangan diketuk dari chat. Unduh/simpan dulu, lalu di DrillKit tekan <b>Buka paket tim</b> (atau <b>Ganti paket</b>) dan pilih berkasnya dari folder Unduhan.',
    ],
    [
      'Muncul <i>“Penyimpanan browser belum bisa dipakai”</i>',
      'Buka DrillKit di tab browser biasa — bukan mode penyamaran dan bukan dari pratinjau di dalam aplikasi chat.',
    ],
    [
      'Mikrofon penala tidak menyala',
      'Izinkan <b>Mikrofon</b> untuk halaman ini (ikon gembok/pengaturan di sebelah alamat), lalu tekan <b>Dengarkan</b> lagi.',
    ],
    [
      'Terlanjur memilih <i>Saya pelatih</i>',
      'Buka menu <b>Berbagi</b> → <b>Lihat mode anggota</b>. Kalau HP ini diminta PIN untuk keluar dari mode anggota, itu memang disengaja pelatih.',
    ],
  )
  return baris
}

export function bodyPanduanAnggota(d: DataPanduanAnggota): string {
  const logo = d.logo ? `<img src="${esc(d.logo)}" alt="logo" />` : ''
  const disajikan = !!d.alamat
  const bagian: string[] = []

  /* 1. Membuka aplikasinya */
  const buka = disajikan
    ? `<div class="qr">
        ${d.qr ? `<img src="${esc(d.qr)}" alt="Kode QR alamat DrillKit" />` : ''}
        <div>Pindai kode ini dengan kamera HP, atau ketik alamatnya:<br/><span class="alamat">${esc(d.alamat!)}</span></div>
      </div>
      <ol>
        <li>Pertama kali dibuka, pilih <b>Saya anggota</b>.</li>
        <li>Supaya bisa dibuka tanpa sinyal, pasang ke layar utama — Android (Chrome): menu <b>⋮</b> → <b>Install aplikasi</b> / <b>Tambahkan ke layar utama</b>. iPhone (Safari): tombol <b>Bagikan</b> → <b>Add to Home Screen</b>.</li>
      </ol>`
    : `<ol>
        <li>Pelatih mengirim berkas <b>DrillKit.html</b>. Simpan/unduh dulu, lalu buka dengan browser (Chrome atau Safari) — jangan dari pratinjau di dalam aplikasi chat.</li>
        <li>Pertama kali dibuka, pilih <b>Saya anggota</b>.</li>
      </ol>`
  bagian.push(`<h2>1. Buka DrillKit</h2>${buka}`)

  /* 2. Memasukkan materi tim */
  bagian.push(`<h2>2. Masukkan materi tim</h2>
    <ol>
      ${
        disajikan
          ? '<li>Tekan <b>Ambil materi dari situs</b>. Atau, bila pelatih mengirim berkas <i>.json</i>: unduh berkasnya, tekan <b>Buka paket tim</b>, lalu pilih berkas itu.</li>'
          : '<li>Pelatih juga mengirim berkas <i>.json</i>. Unduh berkasnya, tekan <b>Buka paket tim</b>, lalu pilih berkas itu dari folder Unduhan.</li>'
      }
      <li>Berkas <b>atas namamu</b> (mis. <i>DrillKit-Nama-Kode.json</i>) langsung mengenali namamu. Berkas <b>grup</b>: ketik nama atau kodemu di <b>Pilih namamu dulu</b> — cukup sekali. Salah nama? Tekan <b>Ganti nama</b>.</li>
      <li><b>Absensi</b> dan <b>Catatan</b> hanya terisi dari berkas atas namamu; berkas grup tidak memuat data pribadi siapa pun.</li>
    </ol>`)

  /* 3. Isi tiap tab */
  bagian.push(`<h2>3. Isi tiap tab</h2>
    <table>
      <thead><tr><th style="width:18%">Tab</th><th>Untuk apa</th></tr></thead>
      <tbody>${tabAnggota().map(([a, b]) => tr(`<b>${a}</b>`, b)).join('')}</tbody>
    </table>`)

  /* 4. Menala sesuai instrumen */
  bagian.push(`<h2>4. Menala sesuai instrumenmu</h2>
    <p style="margin:2px 0 3px">Tab <b>Musik</b> → kartu <b>Penala &amp; nada dengung</b>. Pilih <b>Instrumen</b> sekali (diingat di HP ini), supaya nada yang tampil sama dengan partiturmu:</p>
    <table>
      <thead><tr><th style="width:26%">Pilih</th><th>Untuk</th></tr></thead>
      <tbody>${DAFTAR_TRANSPOSISI.map((t) => tr(`<b>${esc(t.label)}</b>`, esc(t.contoh))).join('')}</tbody>
    </table>
    <p style="margin:2px 0 3px">Tekan <b>Putar dengung</b> (tombol cepat <b>Bb konser</b>), lalu <b>Dengarkan</b> dan mainkan nadanya. Jarum hijau di tengah (±5 sen) = tepat. Angka <b>minus</b> = terlalu rendah (dorong slide/mouthpiece masuk); <b>plus</b> = terlalu tinggi (tarik keluar).</p>`)

  /* 5. Materi berubah */
  bagian.push(`<h2>5. Kalau materi berubah</h2>
    <ul>
      ${
        disajikan
          ? '<li>Tekan <b>Perbarui</b> di bagian atas. Absensi dan catatanmu <b>tidak</b> ikut tertimpa.</li>'
          : ''
      }
      <li>Pelatih mengirim berkas baru? Tekan <b>Ganti paket</b> dan pilih berkas terbarunya.</li>
      <li>Yang kamu ubah di HP-mu <b>tidak</b> terkirim ke pelatih. Absensi selalu diisi pelatih.</li>
    </ul>`)

  /* 6. Kalau macet */
  bagian.push(`<h2>6. Kalau macet</h2>
    <table>
      <thead><tr><th style="width:38%">Gejala</th><th>Cara mengatasi</th></tr></thead>
      <tbody>${macetAnggota(disajikan).map(([a, b]) => tr(a, b)).join('')}</tbody>
    </table>`)

  bagian.push(`<h2>Yang perlu diingat</h2>
    <div class="kotak">
      <ul>
        <li>Tidak perlu akun. Materi tersimpan <b>hanya di HP-mu</b> dan tetap bisa dibuka tanpa sinyal.</li>
        <li>Berkas <b>atas namamu</b> berisi absensi &amp; catatan pribadimu — jangan diteruskan ke orang lain.</li>
      </ul>
    </div>`)

  const hitungan = [
    d.sesiMendatang ? `${d.sesiMendatang} jadwal mendatang` : '',
    d.drill ? `${d.drill} drill` : '',
    d.lagu ? `${d.lagu} lagu` : '',
  ].filter(Boolean)

  return `
    <div class="kop">
      ${logo}
      <div>
        <div class="nama">${esc(d.namaTim || 'Marching Band')}</div>
        <div class="sub">Panduan Anggota DrillKit · dicetak ${esc(tanggalCetak(d.kota))}${hitungan.length ? ' · ' + hitungan.join(' · ') : ''}</div>
      </div>
    </div>
    <div class="isi">
      ${bagian.join('\n      ')}
      <p class="catatan">
        Lembar ini dibuat otomatis oleh DrillKit untuk anggota ${esc(d.namaTim || 'tim')}${d.pelatih ? ` — pelatih: ${esc(d.pelatih)}` : ''}.
        Ada yang belum jelas? Tanyakan ke pelatih.
      </p>
    </div>`
}

/** Panduan anggota siap cetak / unduh. */
export function htmlPanduanAnggota(d: DataPanduanAnggota): string {
  return printShell(`Panduan Anggota DrillKit — ${d.namaTim}`, bodyPanduanAnggota(d), CSS_PANDUAN)
}
