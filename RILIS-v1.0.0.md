# Catatan Rilis DrillKit `v1.0.0` (28 Oktober 2026)

Rilis stabil perdana **DrillKit `v1.0.0`** — aplikasi **all-in-one, gratis, tanpa server/akun, dan 100% *offline-first*** untuk pelatih dan anggota tim marching band Indonesia.

Seluruh modul inti serta **11 rancangan lanjutan (`#1` s.d. `#11d`)** telah rampung penuh dan diverifikasi otomatis lewat **116 rangkaian uji regresi** (logika murni Node + peramban Headless Chromium).

---

## Tiga Bundel Distribusi Siap Pakai

| Berkas | Ukuran | Cara Pakai |
|---|---|---|
| **`drillkit-portable.zip`** | ~770 KB ZIP (`DrillKit.html` ~2,8 MB tunggal) | Ekstrak lalu klik dua kali `DrillKit.html` di laptop/HP **tanpa internet dan tanpa hosting** (`file://`). Seluruh fitur termasuk render partitur MusicXML (OSMD) berjalan luring penuh. |
| **`drillkit-siap-unggah.zip`** | ~1,9 MB | Ekstrak, taruh `paket.json` bila ingin menyajikan paket tim bawaan, lalu seret folder `DrillKit/` ke **Netlify Drop** / hosting statis gratis. |
| **`drillkit-release.zip`** | ~1,9 MB | Folder `dist/` hasil rakitan produksi PWA + Service Worker untuk dipasang langsung pada server statis / Vercel / GitHub Pages. |

*(Seluruh bundel dapat dirakit ulang dari kode sumber kapan saja melalui satu perintah `bash scripts/siapkan-rilis.sh`.)*

---

## Sorotan Kemampuan Utama `v1.0.0`

### 1. Editor Formasi (Drill), Sistem Patok Indonesia, & Impor Pyware (`#5`, `#9`, `#10`)
- **Lapangan & patok kustom (`#9`):** preset DCI/NCAA, SMA/NFHS, Pro/NFL, tanpa hash, **Sepak bola Indonesia (105 × 68 m)**, **Indoor/GOR (40 × 20 m)**, serta **Indoor tanpa patok (40 × 20 m, grid 2 m)**.
- **Tiga satuan tampilan tanpa geser geometri:** ganti tampilan antara **Yard**, **Meter**, dan **Langkah** kapan saja sementara penyimpanan internal tetap presisi dalam yard; dilengkapi jarak grid/subgrid kustom, warna/ketebalan garis hex murni, satuan jarak patok (`langkah` / `yard` / `meter`), dan **pratinjau SVG langsung** di editor konfigurasi.
- **Alat formasi lengkap:** susun blok/busur/lingkaran/garis, jalur melengkung per pemain, riwayat *undo/redo* otomatis, analitik kecepatan & ukuran langkah (`8-to-5`, `6-to-5`, atau ikut hitungan), penggaris dua baris **Drill × Segmen Lagu** (`#5`), pecah/gabung set, mode Presenter proyektor, serta cetak **Dot Sheet A4** & **Buku Saku Lipat** ber-kompas mata angin.
- **Impor satu arah Pyware 3D (`#10`):** baca CSV *coordinate sheet* Pyware/Excel dengan deteksi otomatis peran kolom, satuan, dan titik asal sumbu Y, pratinjau titik di luar lapangan, pencocokan anggota otomatis, interpolasi set sela, serta dukungan *undo*.

### 2. Musik, Metronom WebAudio, Rekaman MP3, & Partitur Offline (`#4`, `#6`, `#11a`–`#11d`)
- **Metronom & `TempoTimeline`:** perubahan tempo & tanda birama per segmen (termasuk *accelerando/ritardando*), hitung mundur kustom + aba-aba suara, penala mikrofon + nada dengung transposisi (`C`, `Bb`, `Eb`, `F`), serta **Tempo Latihan** persen/BPM per lagu dengan kenaikan otomatis saat *loop* (`#4`).
- **Rekaman lagu sinkron (`#6`):** simpan MP3/WAV/M4A/OGG di IndexedDB (sidik SHA-256), selaraskan titik mulai ketukan lewat gelombang suara (*waveform*), dan putar seiring metronom maupun animasi/presenter drill (`m6-klik-rekaman` & `m6-drill-rekaman`).
- **Partitur *Full Score*, Per Instrumen, & Latihan Frasa (`#11a`–`#11d`):**
  - Simpan MusicXML (`.musicxml`/`.xml`), arsip terkompresi MuseScore (`.mxl`), dan lembar PDF di IndexedDB lengkap dengan pemantau kuota & *round-trip* di **Backup + rekaman (ZIP)**.
  - Render notasi vektor offline lewat *lazy-load* `opensheetmusicdisplay` berpalet hex murni, saring tampilan per seksi/instrumen, dan cetak ke **A4 Tegak**, **A4 Mendatar**, atau **Buku Saku / Lyre (A5)** anti-buntu.
  - **Latihan per bar/frasa (`#11d`):** sorot birama aktif *real-time* mengikuti metronom & rekaman, klik birama di partitur untuk mengulang frasa (mis. `Bar 5–8 · 80%`), tautkan rentang set drill ke birama (`Set 4–6 = Bar 9–16`), dan tampilkan partitur pendamping langsung di editor drill.

### 3. Anggota, Jadwal/Kalender, Absensi QR, Evaluasi, & Hari Lomba (`#1`, `#3`)
- **Satu anggota, dua nama (`#1`):** kelola nama resmi & nama panggilan, deteksi kembar saat impor CSV/paket/Pyware, dan gabungkan entri ganda tanpa kehilangan riwayat absensi, evaluasi, maupun titik drill.
- **Kalender & Agenda latihan (`#3`):** tampilan Bulan/Agenda/Daftar, seri jadwal mingguan aman-absensi, rencana & pemacu waktu latihan, ekspor `.ics`, cetak kalender bulanan, serta *Run Sheet* kesiapan **Hari Lomba**.
- **Absensi kartu QR kamera** dengan rekap tren bulanan dan evaluasi keterampilan bertingkat yang selaras dengan rapor cetak.

### 4. Berbagi Satu Tombol, Privasi Anggota, PIN Pelatih, & Satu Pintu Berkas (`#2`, `#7`, `#8`)
- **Terbitkan ke anggota (`#2`):** kirim pembaruan materi tim langsung ke GitHub Pages dari dalam aplikasi; absensi & catatan evaluasi tiap anggota dienkripsi **AES-256-GCM** (WebCrypto PBKDF2 100.000 putaran) dengan kunci pribadi per anggota.
- **Mode Anggota & Kios di HP:** tab Posisiku (animasi perpindahan + kuis hafalan koordinat), Musik & Partitur otomatis ke seksi instrumen sendiri, Kalender & Kehadiran pribadi, serta Penala.
- **PIN Pelatih Tim (`#8`) & Satu Pintu "Buka berkas DrillKit" (`#7`):** pagar mode pelatih berbasis hash PBKDF2 saat *build* (`PIN_PELATIH`), deteksi otomatis semua format berkas (JSON/ZIP/CSV/Pyware/MusicXML/`.mxl`/PDF) dengan pratinjau aman sebelum menulis, serta cetak **Panduan 1 Halaman A4** khusus pelatih dan anggota.

---

## Jaminan Mutu & Prinsip Arsitektur
- **0 biaya operasional:** tanpa backend, tanpa basis data awan berbayar, tanpa akun wajib.
- **Aman cetak & peramban lama:** seluruh dokumen cetak (buku saku, dot sheet, rapor, kalender, panduan 1 halaman, partitur, dan kanvas SVG lapangan) memakai warna **hex/rgb murni** (bebas `oklch()`/`color-mix()`), dan CSS antarmuka diturunkan otomatis lewat LightningCSS.
- **116 rangkaian uji regresi otomatis:** mencakup uji logika murni Node, uji antarmuka & audio Headless Chromium, uji cetak A4 1 halaman (`j1-polesan`), serta uji bundel tunggal `file://` luring (`portabel-rilis`).
