# Catatan Rilis DrillKit `v2.1.0` (2 November 2026)

Rilis stabil **DrillKit `v2.1.0`** menuntaskan **100% seluruh rancangan pada [`PETA-JALAN-v2.md`](PETA-JALAN-v2.md) (`#12` s.d. `#21`)** di atas fondasi [`RILIS-v1.0.0.md`](RILIS-v1.0.0.md) (`#1` s.d. `#11d`), menjadikan DrillKit **platform operasional *all-in-one*, gratis, tanpa server/akun, dan 100% *offline-first*** untuk seluruh siklus tahunan unit marching band Indonesia — mulai dari audisi anggota baru, latihan musik & setoran hafalan, koreografi *Field Show* / *Color Guard* / *Street Parade*, inventaris & logistik lomba, simulasi penilaian juri & *Judge Tape*, hingga surat dispensasi resmi, kartu medis darurat terenkripsi, buku kas TC, dan pembekuan arsip lintas-musim (*Season Rollover*).

Seluruh kapabilitas diuji otomatis oleh **135 rangkaian uji regresi** (`57` logika murni Node + `78` E2E peramban Headless Chromium), berjalan di atas **28 store IndexedDB (Dexie `v16`)** yang 100% tambah-murni (*additive-only*), tetap memakai **8 dependensi runtime** yang sama sejak `v1.0.0`, serta menjaga bundel JS awal tetap ramping di **`407,48 kB` (`132,80 kB` gzip)** — **24% lebih ringan** dibanding `v1.0.0` (`537,76 kB`).

---

## Tiga Bundel Distribusi Siap Pakai (`v2.1.0`)

| Berkas | Ukuran | Cara Pakai |
|---|---|---|
| **`drillkit-portable.zip`** | ~912 KB ZIP (`DrillKit.html` ~3,3 MB tunggal) | Ekstrak lalu buka `DrillKit.html` langsung di laptop/HP **tanpa internet dan tanpa hosting** (`file://`). Seluruh fitur — termasuk render partitur MusicXML (OSMD), sintesis bunyi notasi, koreografi, & cetak A4 — berjalan luring penuh. |
| **`drillkit-siap-unggah.zip`** | ~2,0 MB | Ekstrak, taruh `paket.json` di dalam `DrillKit/` bila ingin menyajikan paket tim bawaan, lalu seret folder `DrillKit/` ke **Netlify Drop** / Cloudflare Pages. |
| **`drillkit-release.zip`** | ~2,0 MB | Folder `dist/` hasil rakitan produksi PWA + Service Worker untuk dipasang langsung pada server statis / Vercel / GitHub Pages. |

*(Seluruh bundel dapat dirakit ulang kapan saja dari kode sumber melalui satu perintah `bash scripts/siapkan-rilis.sh`.)*

---

## Sorotan Lengkap Kemampuan Baru `v1.0.1` → `v2.1.0` (`#12` s.d. `#21`)

### 1. Polesan Performa Bundel, Navigasi Mobile Pelatih, Modularisasi, & CI (`#12` — `v1.0.1` & `v1.2.0`)
- **Pemangkasan Bundel Utama (`#12a`):** Pemisahan *lazy chunk* untuk modal pembuka berkas, penyusun panduan, data contoh, dan modul cetak menurunkan bundel awal dari `537,76 kB` (`v1.0.0`) dan menguncinya di bawah batas keras `< 420 kB` (`407,48 kB` pada `v2.1.0`).
- **Ergonomi Layar HP & Laci Navigasi (`#12b`):** Bilah bawah Mode Pelatih di layar sempit (`< 1024px`) diringkas menjadi 4 menu utama (*Beranda, Absensi, Drill, Musik*) + laci **Lainnya**, penghapusan bilah tunggal penutup layar di Mode Anggota, serta *portal* modal `z-[220]` bebas tertutup navigasi.
- **Modularisasi Komponen & CI Node 24 (`#12c`, `#12d`):** Pemecahan komponen besar ke sub-modul terfokus (`src/components/{anggota,drill,lomba,musik,pengaturan,share}/`) dan pembaruan GitHub Actions ke runtime Node 24 (`@v5`) dengan penghematan kuota untuk komit dokumentasi (`.md`).

### 2. Jembatan Musik Pribadi, Setoran Hafalan, & Kolaborasi Staf (`#13`, `#14`, `#15` — `v1.1.0` s.d. `v1.1.2`)
- **Partitur Tersaring Per-Suara & Audio Panduan di Paket Anggota (`#13a`):** Paket per-anggota otomatis memangkas skor MusicXML ke *part* instrumen/seksi penerima (mewariskan tanda `<rehearsal>` & tempo global) tanpa membengkakkan ciphertext `locked`, ditambah opsi pembungkusan audio panduan lagu ke dalam ZIP paket anggota.
- **Sintesis Bunyi Notasi WebAudio & Drone Harmoni/Just Intonation (`#13b`, `#13c`):** Tombol **Bunyikan not** langsung memainkan pitch tertransposisi, `<tie>`, `<chord/>`, dan ketukan perkusi dari lembar partitur mengikuti tempo latihan & *loop* frasa; penala mendukung drone *Nada Dasar*, *Kuinta*, *Akor Mayor (1–3–5)*, *Akor Minor (1–♭3–5)*, dan *Oktaf* dalam temperamen **Murni (*Just Intonation* — Brass Arc)** maupun **Setara (*12-TET* — Pit)**.
- **Matriks Setoran Hafalan (*Pass-Off Tracker* — `#14`):** Target setoran otomatis dari segmen lagu/manual, matriks ketuk-cepat 6 jenjang (`Belum` → `Baca Lancar` → `Tempo Latihan` → `Tempo Asli` → `Hafal Musik` → `Lulus Sambil Gerak`), **Mode Uji Cepat *Section Leader*** di HP sambil memutar *loop* frasa, cetak rekap A4 `#hex`, serta kartu tanggungan pribadi di Mode Anggota.
- **Kolaborasi Multi-Pelatih Seksi & Log Perubahan Show (`#15` / `I1`):** Alur 1-klik **Kirim Setoran Seksi** & **Gabung Setoran Asisten** tanpa menimpa seksi lain dan tanpa membocorkan kolom rahasia anggota, disertai **Log Perubahan Show Otomatis** yang menyorot **`Menyangkut titikmu!`** di HP anggota ketika koordinat set atau tempo birama direvisi.

### 3. Koreografi Visual Lanjut, *Count Sheet Color Guard*, & Mode Kirab Jalan Raya (`#16`, `#17`, `#19` — `v1.2.0` s.d. `v1.2.3`)
- **Koreografi Visual Lanjut (`#16`):** Jalur berbeda per sub-kelompok dalam satu set, rantai jejak ***Follow-the-Leader* (FTL)**, generator bentuk cepat (*Company Front, Arc, Lingkaran, Grid Blok, Garis Miring*) dengan pratinjau titik hantu langsung di kanvas, pembagian ***Move + Hold***, gelombang ***Ripple*** (`A/B/C/D` atau berurutan `1..N`), 8 simbol visual/tanduk (*Horn Up/Down/Snap, Mark Time, Halt, Lunge, Hadap Penonton, Choreo*) di buku saku, serta **Properti Panggung Bergerak (*Moving Props*)** ber-*keyframe* posisi/rotasi & kru pendorong.
- **Lembar Hitungan *Color Guard* (*Count Sheet* — `#17`):** Penyusun kerja alat (*Flag, Rifle, Sabre, Swing Flag, Air Blade, Dance, Prop*) per blok 8-hitungan terikat Set & Birama lagu, pil teknik cepat, penanda aksen (`▲`) & *catch* (`★`), cetak lembar gabungan A4 / buku saku lipat A5 `#hex`, serta tampilan otomatis bagi seksi *Guard* di Mode Anggota.
- **Mode Kirab / *Street Parade* & *Display* VIP (`#19`):** Preset koridor jalan raya (`6 m`, `8 m`, `12 m`) lengkap marka aspal & zona **Panggung Kehormatan (VIP)** murni `#hex`, generator barisan **Banjar × Saf** per urutan seksi parade, simulasi **Tikungan 90° (*Wheel* vs *Counter-March*)**, kalkulator kecepatan/langkah/siklus lagu & rasio cadangan napas Brass sepanjang rute km, cetak **Lembar Komando Kirab A4**, serta info posisi `Saf × Banjar` di HP anggota.

### 4. Inventaris Alat, *Uniform Fitting*, & Manifes Logistik Hari Lomba (`#18` — `v1.2.2`)
- **Buku Induk Inventaris & Servis:** Pencatatan aset alat musik, bendera/senjata *Guard*, properti panggung, & perlengkapan elektronik beserta kondisi, penanggung jawab peminjaman, riwayat perbaikan, serta cetak **Berita Acara Peminjaman Alat A4** murni `#hex`.
- **Distribusi & *Fitting* Seragam:** Profil ukuran lengkap (* tutup kepala/shako, jaket, celana, sepatu, sarung tangan, nomor seri seragam*) berikut status pinjam/kembali, ekspor/impor CSV ukuran, dan kartu perlengkapan pribadi khusus milik penerima di paket anggota.
- **Manifes Logistik Truk Lomba 3-Tahap:** Daftar periksa pemuatan (`Muat di Markas` → `Tiba di Arena` → `Kembali Pulang`) terhubung ke sesi lomba dan penanggung jawab kru agar tidak ada alat/aksesoris tertinggal di stadion.

### 5. Simulasi Penilaian Juri (*Caption Recap*) & Studio *Judge Tape* (`#20` — `v2.0.0`)
- **Templat *Caption Recap* 100 Poin + Klasifikasi *Box 1–5*:** Enam skema mata lomba siap pakai (*Field Show GPMB/IDCA/DCI, Street Parade PDBI, Indoor Winds, Indoor Percussion, Color Guard Contest,* & *Skema Kustom Unit*) lengkap dengan sub-caption *Komposisi* vs *Eksekusi*, pengali bobot, pengurangan penalti, serta analisis *Caption Terkuat* dan *Fokus Pembenahan*.
- **Studio *Judge Tape* Berpenanda Waktu:** Rekam komentar suara langsung (`MediaRecorder`) atau unggah audio ke store biner terpisah (`db.judgeTapeAudio`, ikut utuh di `judgetape/` pada Backup ZIP) sambil menjalankan *stopwatch run-through* yang otomatis memetakan detik komentar ke **Nomor Set, Hitungan Set, & Nomor Birama** lagu.
- **Grafik Tren Skor Multi-Simulasi & Cetak A4 Resmi:** Kurva pertumbuhan skor SVG `#hex` dari simulasi perdana hingga H-1 kejuaraan dan cetak lembar *Caption Recap* A4 murni `#hex` berpagar privasi staf pelatih.

### 6. Audisi Anggota Baru, Surat Dispensasi A4, Medis AES-256-GCM, Buku Kas TC, & Arsip Musim (`#21` — `v2.1.0`)
- **Audisi & Seleksi *Open Recruitment* (`#21a`):** Kelola pendaftar terpisah dari anggota aktif, nilai 4 aspek dasar (`0–100`: *ritmik, kepekaan nada, postur & langkah, koordinasi alat*), urutkan peringkat per peminatan seksi, cetak rekap A4 `#hex`, dan **Luluskan 1-Klik ke Anggota Aktif** bebas duplikasi.
- **Generator Surat Dispensasi Resmi A4 & Kartu Medis Bersandi (`#21b`):** Simpan kop surat unit (`settings.kopSurat`) & asal sekolah/fakultas/NIS anggota untuk menghasilkan bundel **Surat Izin / Dispensasi Kolektif A4** yang otomatis terpisah per sekolah/fakultas tujuan. Kelola **Kartu Medis & Kontak Darurat Lapangan** (*golongan darah, alergi obat/makanan, riwayat asma/cedera, obat pribadi, wali darurat*) secara luring dengan fitur ekspor/impor mandiri terenkripsi kata sandi **WebCrypto PBKDF2-SHA256 + AES-256-GCM**.
- **Buku Kas / Iuran TC & Arsip Lintas-Musim / *Season Rollover* (`#21c`):** Catat setoran iuran/cicilan TC, pemasukan umum, & pengeluaran operasional lengkap matriks `LUNAS` / `CICILAN` / `BELUM` dan cetak **Kwitansi Resmi A5** bernomor otomatis. Di akhir musim, bekukan seluruh jadwal, presensi, repertoar, drill, skor simulasi juri, dan kas ke **Arsip Lintas-Musim** baca-saja (lengkap **Piagam Musim A4 `#hex`**, unduh JSON, & tombol **Muat Ulang**), lalu mulai musim baru secara bersih **tanpa menghapus** anggota aktif, inventaris alat/seragam, kartu medis, maupun pengaturan unit.

---

## Jejak Evolusi Rilis (`v1.0.0` → `v2.1.0`)

| Versi | Rancangan | Cakupan Utama | Store Dexie | Regresi Otomatis |
| :---: | :---: | :--- | :---: | :---: |
| **`v1.0.0`** | `#1`–`#11d` | Fondasi *all-in-one*: Drill, Patok ID, Pyware, Musik/Rekaman/Partitur OSMD, Kalender, Absensi QR, Terbit AES-256, Pintu Berkas | `v10` (`16` store) | `116` rangkaian |
| **`v1.0.1`** | `#12a/b/d` | Pemangkasan bundel awal `-30%`, laci navigasi HP pelatih, & CI Node 24 | `v10` (`16` store) | `117` rangkaian |
| **`v1.1.0`** | `#13` | Partitur per-suara & audio di paket anggota, bunyi notasi WebAudio, & drone harmoni/JI | `v10` (`16` store) | `119` rangkaian |
| **`v1.1.1`** | `#14` | Matriks setoran hafalan 6 jenjang & Mode Uji Cepat *Section Leader* | `v11` (`18` store) | `121` rangkaian |
| **`v1.1.2`** | `#15` | Kirim/gabung setoran asisten per seksi & Log Perubahan Show otomatis (`I1`) | `v12` (`19` store) | `123` rangkaian |
| **`v1.2.0`** | `#12c`, `#16` | Modularisasi komponen, perbaikan tap modal HP, FTL, *Move+Hold*, *Ripple*, & *Moving Props* | `v12` (`19` store) | `125` rangkaian |
| **`v1.2.1`** | `#17` | Lembar hitungan *Color Guard* (*Count Sheet*) & buku saku visual A5 | `v13` (`20` store) | `127` rangkaian |
| **`v1.2.2`** | `#18` | Buku induk inventaris & Berita Acara, *uniform fitting*, & manifes truk lomba | `v14` (`22` store) | `129` rangkaian |
| **`v1.2.3`** | `#19` | Mode Kirab / *Street Parade*, tikungan 90°, *Display* VIP, & kalkulator rute | `v14` (`22` store) | `131` rangkaian |
| **`v2.0.0`** | `#20` | Simulasi Penilaian Juri (*Caption Recap* 100 poin + *Box 1–5*) & *Judge Tape* | `v15` (`24` store) | `133` rangkaian |
| **`v2.1.0`** | `#21a/b/c` | Audisi *Open Recruitment*, Surat Dispensasi A4, Medis AES-256-GCM, Buku Kas TC, & *Season Rollover* | `v16` (`28` store) | **`135` rangkaian** |

---

## Jaminan Mutu, Pagar Privasi Keras, & Prinsip Arsitektur

- **Nol Biaya Server & 100% Luring:** Seluruh fitur berjalan penuh di IndexedDB peramban, PWA terpasang, maupun satu berkas `DrillKit.html` (`file://`) tanpa backend berbayar.
- **Pagar Privasi Berlapis yang Diuji Otomatis:** `bersihkanAnggota`, `kupasDataKhususStaf`, `paketGrup`, `paketAnggota`, dan `siapTerbit` menjamin data sensitif staf/pribadi (`token` QR, telepon, catatan internal pelatih, nilai evaluasi angka, simulasi penilaian juri & *Judge Tape*, kartu medis darurat, nilai audisi, buku kas & tunggakan tim, daftar aset tim keseluruhan, ukuran seragam rekan lain, serta asal sekolah/NIS/NIM) **tidak pernah** bocor ke paket anggota maupun situs publik.
- **Cetak & SVG Murni `#hex` / `rgb`:** Seluruh 15+ jenis keluaran cetak (dot sheet, buku saku, *count sheet*, komando kirab, partitur Lyre, setoran, rapor kehadiran, Berita Acara inventaris, manifes logistik, *Caption Recap*, rekap audisi, surat dispensasi resmi, lembar siaga medis, kwitansi kas, piagam arsip musim, serta kedua **Panduan 1 Halaman A4**) diuji bebas `oklch()`/`color-mix()` agar aman di laptop/peramban lama.
