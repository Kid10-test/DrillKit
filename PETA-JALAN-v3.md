# Peta Jalan Pengembangan DrillKit Generasi ke-3 (`PETA-JALAN-v3.md`)
*(Pasca-`v2.1.0` Menuju `v3.0.0` — Kanvas Parametrik Generasi Baru, Kecerdasan Visual, Latihan Presisi, Sinkronisasi Tanpa Sinyal, & Jembatan Universal)*

Dokumen ini menjadi acuan pengembangan **Generasi ke-3** setelah tuntasnya seluruh fondasi `v1.0.0` (`#1`–`#11d` pada [`RANCANGAN-LANJUTAN.md`](RANCANGAN-LANJUTAN.md)) serta seluruh 10 rancangan operasional *all-in-one* `v2.1.0` (`#12`–`#21` pada [`PETA-JALAN-v2.md`](PETA-JALAN-v2.md) dan [`RILIS-v2.1.0.md`](RILIS-v2.1.0.md)).

Tujuan peta jalan Generasi ke-3 ada tiga:
1. Mencatat **garis dasar kesehatan teknis `v2.1.0`** agar pengembangan lanjutan tidak menggerus kecepatan buka awal, kesederhanaan antarmuka, maupun ketahanan penyimpanan lokal.
2. Memetakan **11 rancangan terukur (`#22` s.d. `#32`)** dalam **4 gelombang (`v2.2` → `v2.3` → `v2.4` → `v3.0`)** — memadukan **5 keunggulan UX editor terbaik hasil bedah arsitektur OpenMarch** (*kurva parametrik hidup, seleksi lasso + gagang stretch/rotate + kunci sumbu, titik singgah `midsets` & `tags` lintas-seksi, ergonomi tablet/stylus + palet perintah `Ctrl+K`, serta jembatan berkas `.dots`*) dengan kemampuan khas asisten lapangan DrillKit (*deteksi tabrakan lintasan, perspektif tribun juri Press Box + ekspor video `.webm`, studio sticking perkusi, pelatih intonasi/ritme mandiri, estafet QR tanpa sinyal, konsol podium Gitapati, & tata panggung Pit*).
3. Menjaga agar seluruh kemampuan baru tetap mematuhi prinsip inti DrillKit: **100% gratis, *offline-first*, tanpa server/akun, tetap 8 dependensi runtime, dan bundel JS awal `< 420 kB`**.

> **Cara memakai dokumen ini:** Sama seperti `PETA-JALAN-v2.md`, kesebelas rancangan di bawah dirancang modular dan bebas dikerjakan satu per satu atau per gelombang. Kapan pun siap memulai, cukup sebutkan nomornya — misalnya: *"Kerjakan `#22` dulu"* atau *"Lanjut Gelombang 1 (`#22`–`#26`)"*.

---

## 1. Aturan Permanen Proyek (Wajib Dijaga di Seluruh `#22`–`#32`)

1. **100% *Offline-First* & Nol Biaya Server:** Seluruh fitur wajib berjalan penuh di IndexedDB lokal, PWA terpasang, maupun satu berkas portabel `DrillKit.html` (`file://`), tanpa backend berbayar atau ketergantungan sinyal di stadion.
2. **Nol Tambahan Dependensi Runtime Tanpa Alasan Keras:** Seluruh `#22`–`#32` dirancang di atas API standar peramban (`Canvas 2D`, `SVG`, `Pointer Events`, `WebAudio`, `MediaRecorder`, `CompressionStream`, `BarcodeDetector`, `WebCrypto`, `Web Share API`) dan ke-**8 dependensi runtime** yang sudah ada — tanpa Electron, tanpa Fabric.js, dan tanpa WASM SQLite berat.
3. **Batas Keras Bundel Awal `< 420 kB` (`qa/polesan-v101.mjs`):** Setiap panel UI baru, kanvas proyeksi tribun, pengurai `.dots`, dan pembangkit cetak HTML A4/A5 wajib diisolasi ke *lazy chunk* (`React.lazy` / dynamic `import()`) agar halaman awal tetap terbuka instan di HP kelas menengah-bawah.
4. **Warna Cetak, SVG, & Kanvas Ekspor Murni `#hex` / `rgb`:** Dilarang menggunakan `oklch()`, `color-mix()`, atau `rgba()` pada seluruh keluaran cetak HTML A4/A5, `FieldSurface`, dan `LayarPartitur` demi kompatibilitas penuh dengan laptop/peramban lama.
5. **Pagar Privasi Berlapis & Skema Dexie Tambah-Murni (*Additive-Only*):** Perubahan skema di `src/db/db.ts` di atas **Dexie `v16` (`28` store)** wajib 100% kompatibel mundur, terdaftar di `src/lib/backup.ts` (`qa/backup-lengkap.mjs`), dan menjaga pagar privasi `bersihkanAnggota` + `kupasDataKhususStaf` pada paket anggota maupun situs publik.
6. **Panduan Tetap 1 Halaman A4 & 1 Rancangan = Rangkaian Uji Otomatis:** Kedua panduan ringkas di `src/lib/panduan.ts` wajib tetap pas **1 halaman A4 tegak** (`halamanA4 === 1`), dan setiap rancangan baru wajib menyertakan uji logika Node + uji E2E Headless Chromium di `qa/regresi-penuh.sh`.
7. **Implementasi *Clean-Room* Bebas Lisensi Menular (`AGPL-3.0`):** Karena aplikasi utama OpenMarch berlisensi *strong copyleft* `AGPL-3.0`, **dilarang menyalin kode sumber dari repositori aplikasi OpenMarch**. Seluruh kurva parametrik Bézier, algoritma *lasso*, gagang transformasi 2D, `midsets`, mesin gestur `pointerType`, dan pembaca biner halaman SQLite `.dots` wajib ditulis **100% mandiri (*clean-room*)** dari matematika geometri dasar, spesifikasi biner publik SQLite3 (*Public Domain*), serta konsep skema terbuka (`Apache-2.0`).
8. **Anti-Tumpang-Tindih (*Consolidate & Replace, Jangan Menumpuk Menu Kembar*):** Setiap kali rancangan `v3` menghadirkan mekanisme yang lebih baik, **kode UI, tombol, atau format ekspor lama yang fungsinya beririsan WAJIB dilebur atau dihapus** (lihat matriks pemangkasan pada **Bagian 3B**), dan rangkaian uji lama di `qa/` wajib diperbarui mengikuti antarmuka baru — bukan mempertahankan dua tombol kembar demi meloloskan *selector* usang. Satu-satunya yang tetap dijaga kompatibel mundur adalah **pembacaan data tersimpan** agar berkas/IndexedDB lama pengguna tetap otomatis terbaca tanpa kehilangan data.

---

## 2. Garis Dasar Kualitas `v2.1.0` (Titik Berangkat Generasi ke-3)

| Aspek Audit | Garis Dasar Aktual pada `v2.1.0` (`acf004c`) | Target Penjagaan di `v3` |
| :--- | :--- | :--- |
| **Basis Kode Sumber** | `84.116` baris TypeScript/TSX (`0` galat `tsc --noEmit`). | Modul baru dipisah ke `src/lib/*.ts` murni + sub-komponen `< 600` baris. |
| **Bundel JS Awal** | **`407,48 kB` (`132,80 kB` gzip)** — tetap di bawah pagar `< 420 kB`. | Wajib tetap **`< 420 kB`** di seluruh rilis `v2.2`–`v3.0`. |
| **Dependensi Runtime** | **8 pustaka** (`react`, `react-dom`, `react-router-dom`, `dexie`, `dexie-react-hooks`, `date-fns`, `qrcode`, `opensheetmusicdisplay`). | Tetap **8 pustaka** (`0` tambahan pustaka runtime baru). |
| **Skema Penyimpanan Lokal** | **Dexie `v16`** (`28` store IndexedDB, termasuk 3 store Blob biner terisolasi). | Migrasi tambah-murni (`v17+`), round-trip penuh di Backup ZIP. |
| **Regresi Otomatis** | **135 rangkaian lulus penuh** (`57` logika murni + `78` E2E Chromium). | Bertambah minimal `+2` rangkaian (logika + E2E) per rancangan baru. |
| **Bundel Distribusi** | `drillkit-portable.zip` (`912 KB` / `DrillKit.html` `3,29 MB`), `drillkit-siap-unggah.zip` (`2,0 MB`), `drillkit-release.zip` (`2,0 MB`). | Ketiga bundel tetap dirakit bersih via `scripts/siapkan-rilis.sh`. |

---

## 3. Ringkasan Gelombang & Daftar Rancangan (`#22` s.d. `#32`)

| # | Nama Rancangan | Gelombang | Ukuran | Dampak Utama di Lapangan | Fondasi yang Dilanjutkan |
| :---: | :--- | :---: | :---: | :--- | :--- |
| **`#22`** | Kanvas Parametrik Hidup (*Persistent Bézier Shapes*), *Lasso*, Gagang *Stretch/Rotate*, & Kunci Sumbu | `v2.2.0` | Sedang–Besar | Kurva/garis yang tetap "hidup" saat gagangnya ditarik, seleksi *lasso* bebas, *bounding-box* langsung di kanvas, & *Lock X/Y* *(inspirasi UX OpenMarch 1 & 2)* | `bentukFormasi.ts` (`#16`), `DrillEditor.tsx`, `field.ts` |
| **`#23`** | Titik Singgah Per-Pemain (`Midsets`), `Tags` Lintas-Seksi Berwarna, Mode Tablet/Stylus, & Palet `Ctrl+K` | `v2.2.1` | Sedang | Titik belok tengah tanpa pecah set band, *tag* kelompok bebas berwarna per set, pisah jari vs *stylus*, & pencari perintah cepat *(inspirasi UX OpenMarch 3 & 4)* | `gerak.ts`, `DrillEditor.tsx`, `shortcut.ts` |
| **`#24`** | Pemeriksa Tabrakan Lintasan, Kerataan Interval, & Penyelesai Silang 1-Klik | `v2.2.2` | Sedang–Besar | Mendeteksi benturan antar-pemain/*Moving Props* (termasuk jalur `midsets` & kurva `#22`–`#23`) + saran tukar titik otomatis | `analitik.ts` (`DD3`), `gerak.ts`, `propertiGerak.ts` (`#16`) |
| **`#25`** | Pratinjau Perspektif Tribun Juri (*Press Box View*) & Ekspor Video `.webm` | `v2.2.3` | Sedang–Besar | Proyeksi miring 2.5D dari ketinggian tribun utama + rekam video animasi formasi bersuara tanpa server | `FieldSurface.tsx`, `rekaman.ts` (`#6`), `metronome.ts` |
| **`#26`** | Penanda *Dress / Guiding* Barisan & Lembar *Cleaning* Visual Lapangan | `v2.2.4` | Kecil–Sedang | Atribut arah lurus barisan (*Dress Left/Center/Right*) di buku saku + daftar *cleaning* staf per set | `DotSheetModal.tsx`, `DrillEditor.tsx`, `Share.tsx` |
| **`#27`** | Studio Perkusi (*Battery & Pit*): Anotasi *Sticking* (`R`/`L`), *Split Bass*, & *Timing Grid* | `v2.3.0` | Sedang–Besar | Lapisan *sticking* `R/L`, aksen/rudimen, *Bass 1–5* di partitur Lyre + latihan *Grid* naik tempo otomatis | `LayarPartitur.tsx` (`#11`), `partiturBunyi.ts` (`#13b`), `#4` |
| **`#28`** | Pelatih Intonasi (*Pitch Tendency Chart*) & Ketepatan Ketuk Ritme Mandiri | `v2.3.1` | Sedang | Peta nada instrumen yang cenderung *sharp/flat* + uji ketuk subdivisi (*silent bar*) & kuis show lengkap | `tuner.ts` (`#13c`), `metronome.ts`, `kuis.ts` (`C2`) |
| **`#29`** | Estafet QR Berantai Tanpa Sinyal (*Air-Gap Sync*) & `Web Share` Satu-Ketuk | `v2.4.0` | Sedang | Kirim setoran seksi/absensi/revisi set antar-HP lewat animasi QR kamera `2–5 dtk` tanpa internet/Wi-Fi | `QrScanner.tsx`, `qrcode`, `mxl.ts` (`CompressionStream`), `#7`, `#15` |
| **`#30`** | Konsol Podium *Gitapati / Field Commander* & Papan Aba-Aba Layar Besar | `v2.4.1` | Sedang | Satu layar komando blok gabungan (*lompat Set/Rehearsal Letter* + teks instruksi raksasa 40 m) | `DrillPresenter.tsx`, `Music.tsx`, `latihan.ts` (`H1`) |
| **`#31`** | Denah *Front Ensemble (Pit)*, Rute Kabel Audio, & Kalkulator *Warm-Up Lot* Lomba | `v3.0.0` | Sedang | Tata panggung *Pit* + tabel saluran mixer A4, *stopwatch bongkar-pasang*, & hitung mundur pos pemanasan | `Lomba.tsx`, `runsheet.ts` (`G1`), `inventarisLogistik.ts` (`#18`) |
| **`#32`** | Jembatan Universal: Impor/Ekspor OpenMarch (`.dots`/Schema), CSV Pyware 2-Arah, `.dkshow`, & Dwibahasa | `v3.0.0` | Sedang–Besar | Jembatan 3-arah **Pyware ↔ DrillKit ↔ OpenMarch** *(inspirasi 5)*, bundel `.dkshow` bersih data pribadi, & opsi tajuk cetak `EN` | `bukaBerkas.ts` (`#7`), `pyware.ts` (`#10`), `show.ts` |

---

## 3B. Matriks Pemangkasan & Peleburan Kode Lama (Jaminan Nol Tumpang Tindih)

Hasil audit kode sumber `v2.1.0` menunjukkan bahwa `DrillEditor.tsx` (`3.777` baris) saat ini sudah menyimpan beberapa kontrol dari generasi awal (`v0` / `DD4`) yang beririsan dengan `#16` — dan akan menjadi tumpang tindih rangkap tiga bila `#22`–`#32` sekadar ditumpuk di atasnya. Sesuai **Aturan Permanen #8**, berikut daftar **kode & kontrol lama yang WAJIB dihapus atau dilebur** saat rancangan terkait dikerjakan:

| Area Irisan | Kode / Kontrol Lama di `v2.1.0` | Keputusan Pemangkasan & Peleburan di `v3` | Dampak pada Kode & Data Lama |
| :--- | :--- | :--- | :--- |
| **1. Pembuat Bentuk Formasi** | Ada **2** tempat berbeda saat ini: (a) tombol `Bentuk cepat` (`applyShape`: *Blok, Busur, Lingkaran, Garis*) di kartu *Alat* `DrillEditor.tsx` **dan** (b) *Generator bentuk presisi* di `PanelAlatFormasi.tsx` (`bentukFormasi.ts` `#16.2`). | **Hapus total `applyShape` lama** di `DrillEditor.tsx` dan **lebur langsung `bentukFormasi.ts` menjadi satu Mesin Bentuk Parametrik Terpadu (`#22`)** (jangan membuat modul kembar `bentukParametrik.ts` di samping `bentukFormasi.ts`). Semua bentuk baru langsung memiliki gagang kendali hidup + tombol *Lepas Ikatan (Ungroup)* bila ingin dijadikan titik bebas. | Sidebar kanan jauh lebih ringkas; titik hasil bentuk lama tetap utuh sebagai koordinat biasa. |
| **2. Putar, Cermin, Skala, & Geser Pilihan** | Ada **2** panel kembar di sidebar kanan: (a) *Susun pilihan* (`rotateSelection ±15/90`, `mirrorSelection` di tempat) di `DrillEditor.tsx` **dan** (b) *Alat gerak massa* (`putarBlok`, `ubahUkuran %`, `cerminBlok` garis tengah, `geserBlok` 4 tombol arah) di `PanelAlatFormasi.tsx` (`massa.ts`). | **Hapus duplikasi kedua panel tersebut (`#22`)** lalu satukan ke **Gagang *Bounding-Box* Langsung di Kanvas** + **1 Inspektor Seleksi Tunggal**: 1 kontrol Putar (dengan kotak centang *Ikuti busur*), 1 kontrol Cermin (pilihan poros: *Tengah Pilihan* vs *Garis 50*), 1 bar Sejajarkan/Ratakan, serta hapus 4 tombol *Geser blok* karena digantikan seret kanvas ber-`Kunci X/Y` + panah keyboard. | Memangkas ratusan baris JSX di `DrillEditor.tsx` & `PanelAlatFormasi.tsx`; perbarui uji `dd4-gerak-massa.mjs`. |
| **3. Kelompok Pemain Sub-Set vs `Tags`** | `GerakKelompok` (`#16.1` di `PanelGerakSet.tsx`) meminta pelatih memilih ulang anggota kelompok secara manual di tiap set satu per satu. | **Satukan ke sistem `Tag Kelompok` tingkat Drill/Tim (`#23`)**: satu *tag* (mis. `"Sayap Kiri"`, `"Solois"`, `"FTL Tuba"`) langsung dipakai bersama untuk **(a) filter pilih cepat**, **(b) warna/bentuk titik per set**, **dan (c) target jalur sub-kelompok / FTL** tanpa mendefinisikan ulang daftar pemain di tiap set. | `GerakKelompok.memberIds` lama tetap terbaca otomatis (migrasi mulus ke rujukan `tagId` atau pilihan langsung). |
| **4. `Midsets` vs `Pecah Set` (`#5`)** | Berpotensi membingungkan pelatih kapan memakai *Pecah Set* (`14 → 14 & 14A`) vs kapan memakai *Midset*. | **Pisahkan tempat & peran secara tegas (`#23`)**: *Pecah Set* hanya berada di penggaris waktu atas untuk perubahan formasi **seluruh band**; sedangkan `Midset` tidak memiliki menu saingan, melainkan dibuat langsung dengan **menarik titik belok pada garis jalur biru pemain terpilih** di kanvas. | Nol menu ganda; alur kerja intuitif secara visual. |
| **5. Dialog Pintasan `?` vs Palet `Ctrl+K`** | Modal statis `Daftar shortcut keyboard (?)` (`shortcut.ts`) di `DrillEditor.tsx`. | **Hapus modal statis `?` lalu lebur ke satu Palet Perintah & Pintasan Terpadu (`#23`)**: menekan `?` maupun `Ctrl+K` / `⌘K` membuka palet yang sama — menampilkan daftar pintasan sekaligus bisa diketik/diklik untuk menjalankan aksinya langsung. | Satu komponen, dua fungsi; perbarui uji `uji-shortcut.mjs`. |
| **6. Mode Sentuh HP Lama vs Gestur Tablet/Stylus** | Cabang khusus layar sempit lama di `DrillEditor.tsx` (*"Pilih satu anggota di daftar bawah, lalu sentuh lapangan"*). | **Ganti cabang sentuh kaku tersebut dengan satu Mesin Pointer Terpadu (`touch` / `pen` / `mouse`) (`#23`)**: geser 1 jari di ruang kosong menggeser bidang pandang (*pan*), ketuk memilih titik, dan seret pada titik/gagang terpilih memindahkannya mulus di HP, tablet, maupun laptop. | Pengalaman kanvas seragam di semua ukuran layar. |
| **7. Konsol Podium vs `DrillPresenter`** | `DrillPresenter.tsx` sudah memiliki pemutar animasi, metronom/audio sinkron, filter seksi, dan catatan asisten (`K1–K3`). | **Jangan membuat halaman/komponen pemutar tandingan baru (`#30`)**: bangun *Mode Podium & Papan Aba-Aba 40 Meter* langsung sebagai tata letak di dalam `DrillPresenter.tsx` dengan memanfaatkan mesin putar yang sudah ada. | Nol duplikasi logika sinkronisasi audio × drill. |
| **8. Tujuh Tombol Ekspor/Impor Show & CSV** | Saat ini sudah terpisah antara *Ekspor/Impor Show JSON* (`ShowShare.tsx`), tombol *CSV* (lebar/panjang), dan tombol *Pyware* (`ImporPyware.tsx`). | **Lebur menjadi SATU Modal `"Tukar Berkas Pertunjukan"` (`#32`)** dengan 3 tab tujuan bersih: **(1) Bundel Show DrillKit (`.dkshow`)** *(menggantikan tombol Ekspor Show JSON lama; berkas JSON lama tetap bisa diimpor lewat Pintu `#7`)*, **(2) OpenMarch (`.dots` / Schema)**, dan **(3) Spreadsheet / Pyware CSV 2-Arah**. | Bilah atas `DrillEditor` bersih dari deretan tombol ekspor serupa. |

---

## 4. Rincian Rancangan per Gelombang

---

### Gelombang 1 — Kanvas Parametrik Generasi Baru, Keselamatan Lintasan, & Sudut Pandang Tribun (`v2.2`)

#### `#22` — Kanvas Parametrik Hidup (*Persistent Bézier Shapes*), Seleksi *Lasso*, Gagang *Stretch/Rotate*, & Kunci Sumbu `X`/`Y`
* **Masalah yang diselesaikan & kode lama yang dilebur:** Menghapus duplikasi antara `applyShape` lama (`DrillEditor.tsx`), *Generator bentuk presisi* (`#16.2`), *Susun pilihan*, dan *Alat gerak massa* (`PanelAlatFormasi.tsx` — lihat **Matriks 3B #1 & #2**), sekaligus mengubah bentuk sekali-cetak menjadi bentuk parametrik yang tetap "hidup" saat diedit di kanvas.
* **Ruang lingkup pengerjaan (*clean-room* matematika 2D di atas SVG `DrillEditor`):**
  1. **Peleburan `bentukFormasi.ts` Menjadi Mesin Bentuk Parametrik Terikat:** Memperbarui langsung `src/lib/bentukFormasi.ts` (tanpa membuat modul kembar) untuk menyimpan daftar opsional `bentukTerikat` pada `DrillSet` mencakup **Garis / *Company Front***, **Kurva Tunggal (*Quadratic Bézier / Arc*)**, **Kurva Ganda / *S-Curve* (*Cubic Bézier*)**, **Lingkaran**, dan **Grid Blok**. Menarik titik ujung atau gagang kendali lengkung (*control handle*) di kanvas otomatis mendistribusikan ulang pemain dengan jarak busur (*arc-length parameterization*) rata presisi, dilengkapi **Salin Bentuk ke Set Sebelum/Berikut**, **Bulatkan ke Langkah Terdekat**, dan **Lepas Ikatan (*Ungroup*)** (menghapus tombol `applyShape` generasi awal di `DrillEditor.tsx`).
  2. **Alat Seleksi *Lasso* Poligon Bebas (`Shift + Seret` / Tombol *Lasso*):** Menggambar poligon bebas mengelilingi barisan melengkung atau diagonal (`point-in-polygon` *ray casting*) tanpa tak sengaja memilih pemain seksi lain di sebelahnya.
  3. **Kotak Batas Transformasi Kanvas + Peleburan Inspektor Seleksi Tunggal:** Menampilkan bingkai seleksi SVG murni `#hex` di sekeliling titik terpilih lengkap gagang sudut **Rentang/Rapatkan (*Stretch & Squeeze*)** dan gagang atas **Putar Bebas (*Free Rotate* + opsi *Ikuti busur*)**, serta melebur dua panel kembar (*Susun pilihan* + *Alat gerak massa*) menjadi **satu Inspektor Seleksi** (1 kontrol Putar, 1 kontrol Cermin berporos *Pilihan / Garis 50*, & 1 bar Sejajarkan/Ratakan; menghapus 4 tombol *Geser blok* lama).
  4. **Pengunci Sumbu Gerak (`Kunci X` / `Kunci Y`) & Pembulatan Koordinat Terpisah (`X` vs `Y`):** Menahan geseran titik agar hanya bergerak murni depan–belakang atau kiri–kanan tanpa melenceng setengah langkah, disertai pilihan pembulatan langkah mandiri per sumbu (`1`, `0,5`, `0,25` langkah, atau bebas).
* **Ukuran:** Sedang–Besar.

#### `#23` — Titik Singgah Per-Pemain (`Midsets`), `Tags` Lintas-Seksi Terpadu, Mode Pointer Tablet/Stylus, & Palet Perintah `Ctrl+K`
* **Masalah yang diselesaikan & kode lama yang dilebur:** Mengatasi kebutuhan titik belok sebagian pemain tanpa memecah set seluruh band, melebur pengelompokan manual per-set (`GerakKelompok` `#16.1`), mengganti cabang sentuh HP lama yang kaku, serta menyatukan modal statis daftar pintasan `?` dengan pencari perintah cepat (lihat **Matriks 3B #3, #4, #5, & #6**).
* **Ruang lingkup pengerjaan:**
  1. **`Midsets` / *Per-Performer Waypoints* Langsung pada Garis Jalur:** Atribut opsional `midsets` pada `DrillSet` (`Record<memberId, Array<{ padaCount: number; x: number; y: number; lengkung?: number }>>`) yang dibuat intuitif dengan **menarik titik belok pada jejak biru pemain terpilih di kanvas** (bukan menu saingan *Pecah Set*). `posisiAntarSet` (`gerak.ts`), buku saku pemain terkait, dan `DrillPresenter` otomatis mengikuti lintasan bertahap tersebut sementara buku saku pemain lain tetap bersih 1 baris.
  2. **Sistem `Tags` Lintas-Seksi Terpadu (Filter + Warna Per-Set + Target Gerak Sub-Kelompok):** Menambahkan `tags?: string[]` yang langsung terhubung ke `PanelGerakSet` (`#16.1`) sehingga satu *tag* (*"Kuartet Solois"*, *"Sayap Kiri"*, *"FTL Tuba"*) dipakai bersama untuk filter pilih cepat 1-klik, sorot warna/bentuk titik per set, maupun jalur *FTL*/lengkung sub-kelompok tanpa memilih ulang pemain di setiap set.
  3. **Mesin Pointer Terpadu (`touch` / `pen` / `mouse`) Pengganti Cabang Sentuh Lama:** Menghapus mode *tap-to-place* kaku lama di `DrillEditor.tsx` dan menggantinya dengan mesin gestur sadar-`pointerType` + saklar **Mode Input (`Otomatis / Sentuh / Tetikus`)**: seretan 1 jari pada area kosong menggeser bidang pandang (*pan*), radius gagang sentuh diperbesar (`>= 40 px`), dan tekan-lama (*long-press bubble*) menjelaskan kontrol ikon tanpa *hover* tetikus.
  4. **Palet Perintah & Pintasan Terpadu (`Ctrl+K` / `⌘K` / `?`):** Menggantikan modal statis `Daftar shortcut (?)` lama dengan satu palet interaktif yang menampilkan pintasan papan ketik sekaligus mengeksekusi aksi editor langsung saat diketik/diklik.
* **Ukuran:** Sedang.

#### `#24` — Pemeriksa Tabrakan Lintasan, Kerataan Interval, & Penyelesai Silang 1-Klik
* **Masalah yang diselesaikan:** Saat ini `src/lib/analitik.ts` (`DD3` & `DD10b`) sudah menghitung beban kecepatan (`langkahPerMenit`) dan ukuran langkah (`ukuranLangkahInci`) tiap pemain secara individu, namun belum mendeteksi **tabrakan lintasan antar-pemain maupun tabrakan pemain dengan *Moving Props*** di tengah perpindahan set. Dua pemain bisa sama-sama berstatus `nyaman` (`8-to-5`), tetapi jalurnya berpapasan pada jarak `< 1 langkah` di `count 4.5` — risiko nyata bagi pembawa Sousaphone, Bass Drum, Tenor, atau bendera 6 kaki *Color Guard*.
* **Ruang lingkup pengerjaan:**
  1. **Detektor Benturan Lintasan Waktu-Nyata (`src/lib/tabrakanDrill.ts`):** Mencuplik posisi interpolasi `posisiAntarSet` setiap `0,25 count` — termasuk kurva parametrik (`#22`), titik singgah `midsets` (`#23`), jalur lengkung, busur, *Follow-the-Leader*, *Move+Hold*, *Ripple*, serta kotak berputar *Moving Props* (`#16e`) — menggunakan *spatial hash grid* cepat (`O(N)` per sampel, ringan untuk 120+ pemain).
  2. **Radius Ruang Aman Sadar-Instrumen (*Equipment Footprint*) & Jalan Mundur:** Menetapkan jarak aman bawaan per seksi (mis. *Tuba/Battery/Guard* membutuhkan ruang bebas lebih lebar daripada *Trumpet/Woodwind*) serta memberi peringatan tambahan bila pemain melangkah mundur cepat (*blind back-march*) melintasi jalur seksi lain.
  3. **Pemeriksa Kerataan Interval (*Spacing Drift Linter*):** Mendeteksi ketidaksengajaan spasi tidak rata pada barisan segaris/busur non-terikat (mis. interval `3,0 · 3,0 · 4,1 · 2,9 langkah` akibat titik tergeser sedikit) lengkap tombol 1-klik **Ratakan Spasi / Ikat ke Bentuk `#22`**.
  4. **Penyelesai Silang Otomatis 1-Klik (*2-Opt Assignment Uncrosser*):** Menawarkan saran non-destruktif untuk menukar pasangan titik tujuan di dalam seksi yang sama (`"Tukar tujuan B03 ↔ B04 di Set 9: menghilangkan silang jalur & menghemat 2,8 langkah"`) lengkap pratinjau kanvas dan dukungan *Undo* satu langkah.
  5. **Penanda Visual `#hex` di Kanvas & Penggaris Set:** Menampilkan lencana jumlah benturan di `PanelAnalitikGerak` dan cincin peringatan murni `#hex` tepat di lokasi & hitungan benturan saat garis waktu digeser.
* **Ukuran:** Sedang–Besar (`0` store Dexie baru — murni mesin analitik & aksi editor).

#### `#25` — Pratinjau Perspektif Tribun Juri (*Press Box View*) & Ekspor Video Animasi (`.webm`)
* **Masalah yang diselesaikan:** Formasi yang tampak simetris dan jelas pada kanvas 2D tegak lurus dari langit (*bird's-eye view*) sering tampak pipih atau tertutup barisan depan/properti ketika dilihat juri *General Effect* & *Visual* dari ketinggian tribun stadion (`15°–35°`). Selain itu, pelatih sering diminta mengirim video animasi formasi bersuara ke grup pengurus/anggota tanpa harus merekam layar secara manual.
* **Ruang lingkup pengerjaan:**
  1. **Proyeksi Perspektif Tribun 2.5D Murni Matematika (`src/lib/perspektifTribun.ts`):** Mengonversi koordinat lapangan + tinggi pemain/properti menggunakan matriks homografi & proyeksi perspektif ringan di atas Canvas/SVG `#hex` (**tanpa** pustaka 3D/WebGL berat seperti Three.js!) dengan 4 preset sudut pandang: **Podium Gitapati (`3 m`)**, **Tribun Rendah (`8 m`)**, **Tribun Stadion / *Press Box* (`18 m`)**, dan **Atas (`90°`)**.
  2. **Deteksi Halangan Pandang (*Prop & Plume Visual Occlusion*):** Menggambar siluet tinggi pemain, arah hadap instrumen, ayunan bendera sederhana, dan tinggi *Moving Props* (opsional `tinggiMeter` pada `FieldMarker`) sehingga langsung terlihat bila barisan pendek di belakang tertutup panggung prop dari sudut mata juri.
  3. **Perekam Ekspor Video Show Luring (`HTMLCanvasElement.captureStream` + `MediaRecorder`):** Satu tombol **Ekspor Video Animasi** di *lazy chunk* terpisah yang merender jalannya seluruh show (2D atau Perspektif Tribun) tersinkron dengan klik metronom atau rekaman lagu (`#6`) langsung menjadi berkas video `.webm` siap kirim di WhatsApp — 100% di peramban pengguna, nol biaya server.
* **Ukuran:** Sedang–Besar.

#### `#26` — Penanda *Dress / Guiding* Barisan & Lembar *Cleaning* Visual Lapangan
* **Masalah yang diselesaikan:** Saat pemain tiba di satu set atau bergerak dalam *Company Front*, mereka wajib tahu titik acuan lurus barisan (*Dress Left, Dress Center, Dress Right,* atau menunjuk seorang *Guide* pemimpin bentuk). Di sisi lain, saat latihan *cleaning* lapangan, staf visual membutuhkan daftar temuan per set yang bisa dicentang selesai dan dicetak ringkas.
* **Ruang lingkup pengerjaan:**
  1. **Atribut *Dress / Guiding* per Set & Bentuk:** Kolom opsional `dress` pada `DrillSet` / `BentukParametrik` (`kiri | tengah | kanan | depan | anggotaId`) yang otomatis tercetak jelas di **Dot Sheet**, **Buku Saku Lipat A5**, dan kartu titik **Mode Anggota** (`"Luruskan ke: Tengah (A05)"`).
  2. **Daftar Catatan *Cleaning* Per Set (`terbuka` / `beres`):** Panel cepat di editor & presenter untuk menandai koreksi lapangan per set (*"Set 7: busur sayap kanan terlalu maju 1 langkah"*), tersaring otomatis agar yang sudah `beres` tidak memenuhi layar, serta cetak **Lembar Fokus *Cleaning* Harian A4** murni `#hex`.
* **Ukuran:** Kecil–Sedang.

---

### Gelombang 2 — Latihan Perkusi, Brass, & Mandiri Anggota Tingkat Lanjut (`v2.3`)

#### `#27` — Studio Perkusi (*Battery & Pit*): Anotasi *Sticking* (`R`/`L`), *Split Bass*, & *Timing Grid*
* **Masalah yang diselesaikan:** Pembaca partitur `LayarPartitur.tsx` (`#11`) dan sintesis WebAudio `partiturBunyi.ts` (`#13b`) telah melayani instrumen tiup dengan sangat baik, tetapi seksi *Battery* (*Snare, Tenor/Quints, Bass Drum 1–5, Cymbal*) dan *Pit* membutuhkan penulisan pola tangan **`R` / `L` / `B` (*sticking*)**, penanda **nomor *split* Bass Drum (`1`–`5`)**, rudimen (*diddle, flam, rimshot, buzz*), serta latihan pemanasan ritmik berpola (*Grid*).
* **Ruang lingkup pengerjaan:**
  1. **Lapisan Anotasi *Sticking* & *Split Bass* Non-Destruktif (`src/lib/perkusiSticking.ts`):** Store ringan `anotasiPartitur` (Dexie `v17`) menyimpan ketukan `R`/`L`/`B`, aksen `>`, *diddle* `//`, *flam*, *rimshot*, dan penanda *Bass 1–5* per lagu/part/birama tanpa mengubah berkas MusicXML asli — tampil rapi di bawah/atas kepala not OSMD, ikut tercetak `#hex` di Buku Saku Lyre A5 (`#11c`), dan ikut terbawa ke paket anggota seksi perkusi (`#13a`).
  2. **Suara Sintesis Perkusi Terpilah di WebAudio:** Memperkaya `partiturBunyi.ts` agar ketukan *Snare*, *Rimshot*, *Tenor Drum 1–5*, *Bass Drum 1–5* bernada bertingkat, dan *Cymbal* terdengar jelas berbeda saat **Bunyikan not** dijalankan pada skor perkusi.
  3. **Generator Latihan *Timing & Accent Grid* Terpadu Metronom:** Templat pemanasan bawaan (*8-on-a-hand, Accent-Tap, 4-2-1 Grid, Triplet Roll*) yang terhubung langsung dengan fitur naik-tempo otomatis (`#4`) untuk latihan pemanasan seksi di lapangan.
* **Ukuran:** Sedang–Besar.

#### `#28` — Pelatih Intonasi (*Pitch Tendency Chart*) & Ketepatan Ketuk Ritme Mandiri
* **Masalah yang diselesaikan:** Penala `TunerDrone` (`E4` + `#13c`) membantu menyetem nada tunggal saat itu juga, namun pemain tiup belum mengetahui **peta kecenderungan fals alami instrumennya** di berbagai register, dan belum memiliki alat ukur objektif untuk melatih ketepatan masuk subdivisi ritme (*internal pulse*).
* **Ruang lingkup pengerjaan:**
  1. **Kartu Peta Kecenderungan Nada (*Instrument Pitch Tendency Chart*):** Alur panduan 2 menit menggunakan detektor frekuensi mikrofon (`src/lib/tuner.ts`) untuk mengambil sampel tangga nada inti instrumen pemain, menghitung rata-rata simpangan sen per nada (mis. `D5: +13¢`, `F5: -9¢`), menyimpannya per perangkat/anggota, dan mencetak kartu saku referensi tiup A6/A5 `#hex`.
  2. **Pelatih Ketepatan Ketuk Subdivisi & *Silent Bar* (*Rhythm Tap Coach*):** Pemain mengetuk layar/tombol mengikuti pola sukat & subdivisi metronom — termasuk mode **Birama Hening (*Drop-Out Click*, mis. 2 birama bunyi + 2 birama senyap)** — lalu mendapat umpan balik akurasi rata-rata `±ms` (*terlalu cepat / tepat / terlambat*).
  3. **Perluasan Mode Kuis Hafalan Show (`src/lib/kuis.ts`):** Menambahkan mode kuis mandiri *Count Sheet Guard* (`#17`), arah *Dress/Guiding* (`#26`), simbol visual/tanduk (`#16`), serta urutan tempo & sukat segmen lagu di Mode Anggota.
* **Ukuran:** Sedang.

---

### Gelombang 3 — Sinkronisasi Lapangan Tanpa Sinyal & Komando Podium (`v2.4`)

#### `#29` — Estafet QR Berantai Tanpa Sinyal (*Animated QR Air-Gap Sync*) & `Web Share` Satu-Ketuk
* **Masalah yang diselesaikan:** Di tengah lapangan rumput atau area parkir stadion kejuaraan yang sinyalnya lumpuh, asisten pelatih seksi ingin menyetor hasil absensi & *pass-off* hafalan (`#15`) ke HP/tablet Pelatih Kepala, atau Pelatih Kepala ingin membagikan tambalan koordinat 2 set darurat ke *Section Leader* **tanpa internet, tanpa hotspot Wi-Fi, dan tanpa kabel**.
* **Ruang lingkup pengerjaan:**
  1. **Protokol Estafet QR Berantai (*Chunked Animated QR* — `src/lib/estafetQr.ts`):** Memampatkan muatan JSON berkas `BerkasPindah` / tambalan set menggunakan `CompressionStream('deflate-raw')` bawaan peramban (fondasi `mxl.ts`), memecahnya menjadi bingkai QR `~700 byte` ber-CRC32 (`qrcode`), dan menayangkannya berputar pada `3–4 fps`. Kamera perangkat penerima (`QrScanner.tsx` berbasis `BarcodeDetector`) menangkap bingkai dalam urutan apa pun hingga lengkap (`100%` dalam `2–5 detik`), mendekode isinya, dan langsung membukanya lewat pratinjau aman Pintu `#7` (`PratinjauBerkasModal`).
  2. **Tombol `Bagikan Langsung` Berbasis `Web Share API` (`navigator.share({ files })`):** Menambahkan aksi berbagi sistem operasi satu-ketuk di samping tombol *Unduh* pada halaman Berbagi, Kolaborasi Seksi (`#15`), dan Backup sehingga berkas dapat langsung dilempar lewat *Quick Share* Android, *AirDrop* iOS, atau aplikasi pesan tanpa harus mencari berkas di pengelola penyimpanan HP.
* **Ukuran:** Sedang (`0` dependensi baru — murni di atas `qrcode`, `QrScanner`, & `CompressionStream`).

#### `#30` — Mode Podium *Gitapati / Field Commander* & Papan Aba-Aba Layar Besar (Terpadu di `DrillPresenter`)
* **Masalah yang diselesaikan & duplikasi yang dicegah:** Saat latihan gabungan (*full ensemble*) di stadion luas atau berangin, pelatih/Gitapati di atas menara membutuhkan lompatan cepat *"Mulai dari Huruf [C] / Set 12 di tempo 85%"* dan teks aba-aba yang terbaca dari garis belakang. Sesuai **Matriks 3B #7**, fitur ini dibangun **langsung sebagai tata letak di dalam `DrillPresenter.tsx`** (memakai mesin putar/sinkronisasi yang sudah ada, bukan membuat halaman pemutar tandingan baru).
* **Ruang lingkup pengerjaan:**
  1. **Tata Letak *Mode Podium* di `DrillPresenter.tsx`:** Menambahkan pemilih cepat **Set ↔ Huruf Latihan (*Rehearsal Mark*) ↔ Birama**, kendali tempo latihan `70%–100%` (`#4`), *count-in* aba-aba kustom (*"4 ketuk Standby + 4 ketuk Mark Time"*), dan indikator hitungan besar ramah tablet/HP lanskap di atas mesin presenter yang sudah ada.
  2. **Papan Kartu Pengumuman Raksasa (*40-Meter Flash-Cue Board*):** Satu ketuk memunculkan plakat layar penuh kontras ekstrem murni `#hex` (mis. **`SET 12 – 16 · TEMPO 85%`** atau **`RESET KE SET 1 · FULL RUN`**) yang terbaca jelas dari tengah lapangan saat megafon mati/bising.
  3. **Pencatat Pengulangan Blok (*Rep Counter*):** Menghitung otomatis berapa kali tiap rentang set telah diulang pada sesi tersebut dan menyimpannya ke ringkasan sesi latihan (`latihan.ts`).
* **Ukuran:** Sedang.

---

### Gelombang 4 — Kesiapan Arena *Pit*, Logistik Menit-H, & Jembatan Interoperabilitas Universal (`v3.0.0`)

#### `#31` — Denah *Front Ensemble (Pit)*, Rute Kabel Audio, & Kalkulator *Warm-Up Lot* Lomba
* **Masalah yang diselesaikan:** Di kejuaraan modern, seksi *Front Ensemble (Pit)* & kru tata suara menghadapi batas waktu masuk/keluar arena yang sangat ketat (`4–5 menit` sebelum terkena penalti juri waktu `#20`) serta kerumitan sambungan kabel mixer/synth/mikrofon solois. Selain itu, pada hari H lomba (`Lomba.tsx`), keterlambatan sering terjadi saat perpindahan jalan kaki antar-area parkir truk → pemanasan fisik → *Music Warm-Up Lot* → *Ready Gate*.
* **Ruang lingkup pengerjaan:**
  1. **Penyusun Denah Panggung *Pit* & Tabel *Audio Patch* (`src/lib/pitDanWarmup.ts`):** Kanvas susun cepat kotak instrumen *Pit* (*Marimba, Vibraphone, Xylophone, Glockenspiel, Timpani, Synth, Rack, Amp/Speaker, Mixer, UPS/Genset*) terhubung ke aset inventaris (`#18`), lengkap tabel saluran input/output mixer (`Ch 1..16`), kebutuhan daya listrik, penugasan kru pendorong, serta cetak **Lembar *Pit Setup & Audio Patch* A4** murni `#hex`.
  2. ***Stopwatch Pit Crew Timed Drill*:** Pengukur waktu latihan bongkar-pasang panggung dengan batas target kejuaraan dan riwayat waktu tercepat tim.
  3. **Generator Jadwal Mundur *Warm-Up Lot* Otomatis di Halaman `Lomba`:** Pelatih cukup memasukkan **Jam Tampil Resmi (*Step-Off*)**, durasi jatah *lot* panitia, dan waktu jalan kaki antar-pos stadion; aplikasi otomatis membangkitkan rantai pos menit-demi-menit ke dalam *Run Sheet* (`G1`) & Layar Hari H (`G2`).
* **Ukuran:** Sedang.

#### `#32` — Jembatan Interoperabilitas Universal: OpenMarch (`.dots`/Schema), CSV Pyware 2-Arah, Arsip `.dkshow`, & Dwibahasa (`ID`/`EN`)
* **Masalah yang diselesaikan & tombol lama yang dilebur:** Menyatukan tiga ekosistem berkas desain (**Pyware 3D**, **OpenMarch**, dan **DrillKit**) sekaligus merapikan deretan tombol ekspor/impor terpisah (`ShowShare`, `CSV`, `Pyware` — lihat **Matriks 3B #8**) menjadi **satu pintu modal `"Tukar Berkas Pertunjukan"`** yang bersih.
* **Ruang lingkup pengerjaan:**
  1. **Peleburan ke Modal Tunggal `"Tukar Berkas Pertunjukan"` & Penggantian `Show JSON` → `.dkshow`:** Menyatukan tombol *Show*, *CSV*, dan *Pyware* di bilah `DrillEditor` ke satu modal 3-tab, serta mengganti keluaran *Ekspor Show JSON* lama dengan bundel ZIP bersih **`.dkshow`** (drill + *tempo map* + partitur MusicXML + *sticking* `#27` + *count sheet* `#17` + *Moving Props* `#16e` + denah *Pit* `#31`, bebas identitas pribadi anggota; sementara berkas `Show JSON` lama tetap dapat diimpor mulus lewat Pintu `#7`).
  2. **Impor/Ekspor OpenMarch (`.dots` & Skema Terbuka — `src/lib/imporOpenMarch.ts` di *lazy chunk*):** Mengurai berkas `.dots` secara *clean-room* menggunakan pembaca halaman B-Tree biner SQLite3 ringan murni TypeScript (spesifikasi format berkas SQLite berada di *Public Domain* → **`0` WASM & `0` dependensi npm baru**) serta JSON skema terbuka (`Apache-2.0`). Pintu `#7` (`bukaBerkas.ts`) langsung mengenali bita `SQLite format 3\0` bertabel `marcher_pages`, mencocokkan pemain lewat alias `#1`, dan memetakan `pages`, `beats`/`measures`, `midsets` (`#23`), serta `shapes` (`#22`), ditambah ekspor balik ke JSON OpenMarch / CSV pemain.
  3. **Ekspor Koordinat CSV Standar Pyware 2-Arah (`#10` Lengkap):** Melengkapi `pyware.ts` & `csvKoordinat.ts` dengan opsi ekspor CSV format standar *Coordinate Sheet* universal (kolom *Set, Counts, Performer, Side, Yard Line, Front-Back*).
  4. **Opsi Tajuk Cetak Dwibahasa (`Bahasa Indonesia` / `English`) pada Dokumen Kejuaraan:** Saklar bahasa label pada keluaran cetak *Dot Sheet*, *Count Sheet*, *Caption Recap*, dan *Pit Patch Sheet* untuk juri/klinisi internasional, sementara antarmuka utama aplikasi tetap berbahasa Indonesia alami.
* **Ukuran:** Sedang–Besar.

---

## 5. Peta Dampak Skema IndexedDB (`Dexie v16+`) & Pagar Privasi Berkas

Melanjutkan **Dexie `v16` (`28` store)** pada `v2.1.0`, seluruh pengembangan `#22`–`#32` diwajibkan hemat tabel baru (mengutamakan atribut opsional kompatibel-mundur) dan mematuhi pagar privasi `bersihkanAnggota` + `kupasDataKhususStaf`:

| Rancangan | Perubahan Skema Dexie (`v16+`) | Ikut Backup Lengkap ZIP? | Ikut Paket Anggota (`ShareBundle` / `#2`)? | Catatan Privasi & Ukuran Bundel |
| :---: | :--- | :---: | :--- | :--- |
| **`#22`** | Atribut opsional `bentukTerikat` pada `DrillSet` (`v16` tetap) | Ya | Ya (bagian dari geometri formasi) | Matematika Bézier & *lasso* murni SVG; `0` pustaka baru |
| **`#23`** | Atribut opsional `midsets` & `tampilanTag` pada `Drill` / `DrillSet` + `tags` pada `Member` (`v16` tetap) | Ya | `midsets` & `tags` panggung **Ya** (panduan jalur & visual pemain) | Palet `Ctrl+K` & mesin sentuh dimuat ringan di editor |
| **`#24`** | *Tidak ada store baru* (mesin analitik murni di atas `DrillSet`) | — | — | Nol dampak ukuran paket; *lazy* di editor drill |
| **`#25`** | Kolom opsional `tinggiMeter` pada `FieldMarker` (`v16` tetap) | Ya | Ya (bagian dari geometri panggung) | Kanvas tribun & perekam `.webm` di *lazy chunk* |
| **`#26`** | Kolom opsional `dress` & `catatanCleaning` pada `DrillSet` (`v16` tetap) | Ya | `dress` **Ya** (panduan baris pemain); `catatanCleaning` internal staf **dikupas** | Menjaga buku saku anggota fokus & bersih |
| **`#27`** | `v17`: `+ anotasiPartitur` (JSON ringan per lagu/birama) | Ya | **Ya, tersaring** khusus seksi penerima (`#13a`) | Tidak mengubah bita berkas MusicXML asli |
| **`#28`** | Profil kecenderungan nada lokal per perangkat/anggota (`localStorage` / opsional mandiri) | Opsional lokal | Milik perangkat anggota sendiri (tidak bocor antar-anggota) | Melatih mandiri di HP anggota luring penuh |
| **`#29`** | *Tidak ada store baru* (lapisan transpor di atas `BerkasPindah` `#7`/`#15`) | — | Mematuhi pagar privasi jenis berkas yang dikirim | `0` dependensi baru (`qrcode` + `BarcodeDetector` + `CompressionStream`) |
| **`#30`** | Kolom opsional `logRep` pada ringkasan sesi latihan (`v17` tetap) | Ya | **Tidak** (catatan staf latihan) | Dimuat malas saat Konsol Podium dibuka |
| **`#31`** | `v18`: `+ denahPit` + pos mundur opsional pada `RunSheet` | Ya | Penugasan dorong kru pribadi tampil di kartu anggota; detail mixer tetap staf | Cetak A4 diisolasi di `pitDanWarmupCetak.ts` |
| **`#32`** | *Tidak ada store baru* (pembaca B-Tree `.dots` + `.dkshow` di *lazy chunk* `#7`) | — | `.dkshow` & ekspor OpenMarch membuang seluruh identitas pribadi anggota (`kode` titik saja) | Aman dipertukarkan bebas lintas-ekosistem |

---

## 6. Rekomendasi Urutan Eksekusi

1. **Mulai dari `#22` → `#23` (*Kanvas Parametrik Hidup, Lasso, Stretch/Rotate, `Midsets`, `Tags`, Tablet/Stylus, & `Ctrl+K`* — `v2.2.0`–`v2.2.1`):** Langsung menyuntikkan kelincahan mengedit ala OpenMarch ke dalam kanvas ringan DrillKit tanpa menambah satu pun store IndexedDB maupun pustaka eksternal.
2. **Lanjutkan ke `#24`, `#25`, & `#26` (`v2.2.2`–`v2.2.4`):** Menutup penuh **Gelombang 1** sehingga kurva parametrik dan `midsets` yang baru dibuat otomatis diperiksa tabrakannya (`#24`), dapat ditinjau dari sudut pandang juri *Press Box* serta diekspor ke video `.webm` (`#25`), dan tercetak rapi beserta arah *Dress/Guiding* (`#26`).
3. **Masuk ke `#29` (*Estafet QR Tanpa Sinyal*), `#27` (*Studio Perkusi*), atau `#32` (*Jembatan `.dots` OpenMarch ↔ DrillKit ↔ Pyware*):** Fleksibel dipilih sesuai prioritas kebutuhan terdekat tim.
