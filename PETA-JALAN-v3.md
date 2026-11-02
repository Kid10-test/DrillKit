# Peta Jalan Pengembangan DrillKit Generasi ke-3 (`PETA-JALAN-v3.md`)
*(Pasca-`v2.1.0` Menuju `v3.0.0` — Kecerdasan Visual, Latihan Presisi, Sinkronisasi Tanpa Sinyal, & Kesiapan Arena)*

Dokumen ini menjadi acuan pengembangan **Generasi ke-3** setelah tuntasnya seluruh fondasi `v1.0.0` (`#1`–`#11d` pada [`RANCANGAN-LANJUTAN.md`](RANCANGAN-LANJUTAN.md)) serta seluruh 10 rancangan operasional *all-in-one* `v2.1.0` (`#12`–`#21` pada [`PETA-JALAN-v2.md`](PETA-JALAN-v2.md) dan [`RILIS-v2.1.0.md`](RILIS-v2.1.0.md)).

Tujuan peta jalan Generasi ke-3 ada tiga:
1. Mencatat **garis dasar kesehatan teknis `v2.1.0`** agar pengembangan lanjutan tidak menggerus kecepatan buka awal, kesederhanaan antarmuka, maupun ketahanan penyimpanan lokal.
2. Memetakan **9 rancangan terukur (`#22` s.d. `#30`)** dalam **4 gelombang (`v2.2` → `v2.3` → `v2.4` → `v3.0`)** yang menaikkan kelas DrillKit dari *platform manajemen & penyusun materi lengkap* menjadi **asisten cerdas di pinggir lapangan & arena kejuaraan** — mulai dari deteksi tabrakan lintasan antar-pemain, simulasi pandang tribun juri (*Press Box*), anotasi *sticking* perkusi & pelatih intonasi/ritme mandiri, estafet data antar-HP lewat QR berantai tanpa sinyal internet, konsol podium *Gitapati*, hingga tata panggung *Front Ensemble (Pit)* dan arsip pertunjukan terbuka `.dkshow`.
3. Menjaga agar seluruh kemampuan baru tetap mematuhi prinsip inti DrillKit: **100% gratis, *offline-first*, tanpa server/akun, tetap 8 dependensi runtime, dan bundel JS awal `< 420 kB`**.

> **Cara memakai dokumen ini:** Sama seperti `PETA-JALAN-v2.md`, kesembilan rancangan di bawah dirancang modular dan bebas dikerjakan satu per satu atau per gelombang. Kapan pun siap memulai, cukup sebutkan nomornya — misalnya: *"Kerjakan `#22` dulu"* atau *"Lanjut Gelombang 1 (`#22`–`#24`)"*.

---

## 1. Aturan Permanen Proyek (Wajib Dijaga di Seluruh `#22`–`#30`)

1. **100% *Offline-First* & Nol Biaya Server:** Seluruh fitur wajib berjalan penuh di IndexedDB lokal, PWA terpasang, maupun satu berkas portabel `DrillKit.html` (`file://`), tanpa backend berbayar atau ketergantungan sinyal di stadion.
2. **Nol Tambahan Dependensi Runtime Tanpa Alasan Keras:** Seluruh `#22`–`#30` dirancang di atas API standar peramban (`Canvas 2D`, `SVG`, `WebAudio`, `MediaRecorder`, `CompressionStream`, `BarcodeDetector`, `WebCrypto`, `Web Share API`) dan ke-**8 dependensi runtime** yang sudah ada.
3. **Batas Keras Bundel Awal `< 420 kB` (`qa/polesan-v101.mjs`):** Setiap panel UI baru, kanvas proyeksi tribun, dan pembangkit cetak HTML A4/A5 wajib diisolasi ke *lazy chunk* (`React.lazy` / dynamic `import()`) agar halaman awal tetap terbuka instan di HP kelas menengah-bawah.
4. **Warna Cetak, SVG, & Kanvas Ekspor Murni `#hex` / `rgb`:** Dilarang menggunakan `oklch()`, `color-mix()`, atau `rgba()` pada seluruh keluaran cetak HTML A4/A5, `FieldSurface`, dan `LayarPartitur` demi kompatibilitas penuh dengan laptop/peramban lama.
5. **Pagar Privasi Berlapis & Skema Dexie Tambah-Murni (*Additive-Only*):** Perubahan skema di `src/db/db.ts` di atas **Dexie `v16` (`28` store)** wajib 100% kompatibel mundur, terdaftar di `src/lib/backup.ts` (`qa/backup-lengkap.mjs`), dan menjaga pagar privasi `bersihkanAnggota` + `kupasDataKhususStaf` pada paket anggota maupun situs publik.
6. **Panduan Tetap 1 Halaman A4 & 1 Rancangan = Rangkaian Uji Otomatis:** Kedua panduan ringkas di `src/lib/panduan.ts` wajib tetap pas **1 halaman A4 tegak** (`halamanA4 === 1`), dan setiap rancangan baru wajib menyertakan uji logika Node + uji E2E Headless Chromium di `qa/regresi-penuh.sh`.

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

## 3. Ringkasan Gelombang & Daftar Rancangan (`#22` s.d. `#30`)

| # | Nama Rancangan | Gelombang | Ukuran | Dampak Utama di Lapangan | Fondasi yang Dilanjutkan |
| :---: | :--- | :---: | :---: | :--- | :--- |
| **`#22`** | Pemeriksa Tabrakan Lintasan, Kerataan Interval, & Penyelesai Silang 1-Klik | `v2.2.0` | Sedang–Besar | Mendeteksi benturan antar-pemain/*Moving Props* di tengah perpindahan set + saran tukar titik otomatis | `analitik.ts` (`DD3`), `gerak.ts`, `propertiGerak.ts` (`#16`) |
| **`#23`** | Pratinjau Perspektif Tribun Juri (*Press Box View*) & Ekspor Video `.webm` | `v2.2.1` | Sedang–Besar | Proyeksi miring 2.5D dari ketinggian tribun utama + rekam video animasi formasi bersuara tanpa server | `FieldSurface.tsx`, `rekaman.ts` (`#6`), `metronome.ts` |
| **`#24`** | Penanda *Dress / Guiding* Barisan & Lembar *Cleaning* Visual Lapangan | `v2.2.2` | Kecil–Sedang | Atribut arah lurus barisan (*Dress Left/Center/Right*) di buku saku + daftar *cleaning* staf per set | `DotSheetModal.tsx`, `DrillEditor.tsx`, `Share.tsx` |
| **`#25`** | Studio Perkusi (*Battery & Pit*): Anotasi *Sticking* (`R`/`L`), *Split Bass*, & *Timing Grid* | `v2.3.0` | Sedang–Besar | Lapisan *sticking* `R/L`, aksen/rudimen, *Bass 1–5* di partitur Lyre + latihan *Grid* naik tempo otomatis | `LayarPartitur.tsx` (`#11`), `partiturBunyi.ts` (`#13b`), `#4` |
| **`#26`** | Pelatih Intonasi (*Pitch Tendency Chart*) & Ketepatan Ketuk Ritme Mandiri | `v2.3.1` | Sedang | Peta nada instrumen yang cenderung *sharp/flat* + uji ketuk subdivisi (*silent bar*) & kuis show lengkap | `tuner.ts` (`#13c`), `metronome.ts`, `kuis.ts` (`C2`) |
| **`#27`** | Estafet QR Berantai Tanpa Sinyal (*Air-Gap Sync*) & `Web Share` Satu-Ketuk | `v2.4.0` | Sedang | Kirim setoran seksi/absensi/revisi set antar-HP lewat animasi QR kamera `2–5 dtk` tanpa internet/Wi-Fi | `QrScanner.tsx`, `qrcode`, `mxl.ts` (`CompressionStream`), `#7`, `#15` |
| **`#28`** | Konsol Podium *Gitapati / Field Commander* & Papan Aba-Aba Layar Besar | `v2.4.1` | Sedang | Satu layar komando blok gabungan (*lompat Set/Rehearsal Letter* + teks instruksi raksasa 40 m) | `DrillPresenter.tsx`, `Music.tsx`, `latihan.ts` (`H1`) |
| **`#29`** | Denah *Front Ensemble (Pit)*, Rute Kabel Audio, & Kalkulator *Warm-Up Lot* Lomba | `v3.0.0` | Sedang | Tata panggung *Pit* + tabel saluran mixer A4, *stopwatch bongkar-pasang*, & hitung mundur pos pemanasan | `Lomba.tsx`, `runsheet.ts` (`G1`), `inventarisLogistik.ts` (`#18`) |
| **`#30`** | Arsip Show Mandiri (`.dkshow`), Ekspor CSV Pyware 2-Arah, & Cetakan Dwibahasa (`ID`/`EN`) | `v3.0.0` | Sedang | Pertukaran bundel show utuh antar-desainer, ekspor balik CSV koordinat standar, & opsi tajuk cetak `EN` | `bukaBerkas.ts` (`#7`), `pyware.ts` (`#10`), `show.ts` |

---

## 4. Rincian Rancangan per Gelombang

---

### Gelombang 1 — Kecerdasan Koreografi, Keselamatan Lintasan, & Sudut Pandang Tribun (`v2.2`)

#### `#22` — Pemeriksa Tabrakan Lintasan, Kerataan Interval, & Penyelesai Silang 1-Klik
* **Masalah yang diselesaikan:** Saat ini `src/lib/analitik.ts` (`DD3` & `DD10b`) sudah menghitung beban kecepatan (`langkahPerMenit`) dan ukuran langkah (`ukuranLangkahInci`) tiap pemain secara individu, namun belum mendeteksi **tabrakan lintasan antar-pemain maupun tabrakan pemain dengan *Moving Props*** di tengah perpindahan set. Dua pemain bisa sama-sama berstatus `nyaman` (`8-to-5`), tetapi jalurnya berpapasan pada jarak `< 1 langkah` di `count 4.5` — risiko nyata bagi pembawa Sousaphone, Bass Drum, Tenor, atau bendera 6 kaki *Color Guard*.
* **Ruang lingkup pengerjaan:**
  1. **Detektor Benturan Lintasan Waktu-Nyata (`src/lib/tabrakanDrill.ts`):** Mencuplik posisi interpolasi `posisiAntarSet` setiap `0,25 count` (mencakup jalur lurus, lengkung, busur, *Follow-the-Leader*, *Move+Hold*, *Ripple*, serta kotak berputar *Moving Props* `#16e`) menggunakan *spatial hash grid* cepat (`O(N)` per sampel, ringan untuk 120+ pemain).
  2. **Radius Ruang Aman Sadar-Instrumen (*Equipment Footprint*) & Jalan Mundur:** Menetapkan jarak aman bawaan per seksi (mis. *Tuba/Battery/Guard* membutuhkan ruang bebas lebih lebar daripada *Trumpet/Woodwind*) serta memberi peringatan tambahan bila pemain melangkah mundur cepat (*blind back-march*) melintasi jalur seksi lain.
  3. **Pemeriksa Kerataan Interval (*Spacing Drift Linter*):** Mendeteksi ketidaksengajaan spasi tidak rata pada barisan segaris/busur (mis. interval `3,0 · 3,0 · 4,1 · 2,9 langkah` akibat titik tergeser sedikit saat mengedit).
  4. **Penyelesai Silang Otomatis 1-Klik (*2-Opt Assignment Uncrosser*):** Menawarkan saran non-destruktif untuk menukar pasangan titik tujuan di dalam seksi yang sama (`"Tukar tujuan B03 ↔ B04 di Set 9: menghilangkan silang jalur & menghemat 2,8 langkah"`) lengkap pratinjau kanvas dan dukungan *Undo* satu langkah.
  5. **Penanda Visual `#hex` di Kanvas & Penggaris Set:** Menampilkan lencana jumlah benturan di `PanelAnalitikGerak` dan cincin peringatan murni `#hex` tepat di lokasi & hitungan benturan saat garis waktu digeser.
* **Ukuran:** Sedang–Besar (`0` store Dexie baru — murni mesin analitik & aksi editor).

#### `#23` — Pratinjau Perspektif Tribun Juri (*Press Box View*) & Ekspor Video Animasi (`.webm`)
* **Masalah yang diselesaikan:** Formasi yang tampak simetris dan jelas pada kanvas 2D tegak lurus dari langit (*bird's-eye view*) sering tampak pipih atau tertutup barisan depan/properti ketika dilihat juri *General Effect* & *Visual* dari ketinggian tribun stadion (`15°–35°`). Selain itu, pelatih sering diminta mengirim video animasi formasi bersuara ke grup pengurus/anggota tanpa harus merekam layar secara manual.
* **Ruang lingkup pengerjaan:**
  1. **Proyeksi Perspektif Tribun 2.5D Murni Matematika (`src/lib/perspektifTribun.ts`):** Mengonversi koordinat lapangan + tinggi pemain/properti menggunakan matriks homografi & proyeksi perspektif ringan di atas Canvas/SVG `#hex` (**tanpa** pustaka 3D/WebGL berat seperti Three.js!) dengan 4 preset sudut pandang: **Podium Gitapati (`3 m`)**, **Tribun Rendah (`8 m`)**, **Tribun Stadion / *Press Box* (`18 m`)**, dan **Atas (`90°`)**.
  2. **Deteksi Halangan Pandang (*Prop & Plume Visual Occlusion*):** Menggambar siluet tinggi pemain, arah hadap instrumen, ayunan bendera sederhana, dan tinggi *Moving Props* (opsional `tinggiMeter` pada `FieldMarker`) sehingga langsung terlihat bila barisan pendek di belakang tertutup panggung prop dari sudut mata juri.
  3. **Perekam Ekspor Video Show Luring (`HTMLCanvasElement.captureStream` + `MediaRecorder`):** Satu tombol **Ekspor Video Animasi** di *lazy chunk* terpisah yang merender jalannya seluruh show (2D atau Perspektif Tribun) tersinkron dengan klik metronom atau rekaman lagu (`#6`) langsung menjadi berkas video `.webm` siap kirim di WhatsApp — 100% di peramban pengguna, nol biaya server.
* **Ukuran:** Sedang–Besar.

#### `#24` — Penanda *Dress / Guiding* Barisan & Lembar *Cleaning* Visual Lapangan
* **Masalah yang diselesaikan:** Saat pemain tiba di satu set atau bergerak dalam *Company Front*, mereka wajib tahu titik acuan lurus barisan (*Dress Left, Dress Center, Dress Right,* atau menunjuk seorang *Guide* pemimpin bentuk). Di sisi lain, saat latihan *cleaning* lapangan, staf visual membutuhkan daftar temuan per set yang bisa dicentang selesai dan dicetak ringkas.
* **Ruang lingkup pengerjaan:**
  1. **Atribut *Dress / Guiding* per Set & Sub-Kelompok:** Kolom opsional `dress` pada `DrillSet` / `GerakKelompok` (`kiri | tengah | kanan | depan | anggotaId`) yang otomatis tercetak jelas di **Dot Sheet**, **Buku Saku Lipat A5**, dan kartu titik **Mode Anggota** (`"Luruskan ke: Tengah (A05)"`).
  2. **Daftar Catatan *Cleaning* Per Set (`terbuka` / `beres`):** Panel cepat di editor & presenter untuk menandai koreksi lapangan per set (*"Set 7: busur sayap kanan terlalu maju 1 langkah"*), tersaring otomatis agar yang sudah `beres` tidak memenuhi layar, serta cetak **Lembar Fokus *Cleaning* Harian A4** murni `#hex`.
* **Ukuran:** Kecil–Sedang.

---

### Gelombang 2 — Latihan Perkusi, Brass, & Mandiri Anggota Tingkat Lanjut (`v2.3`)

#### `#25` — Studio Perkusi (*Battery & Pit*): Anotasi *Sticking* (`R`/`L`), *Split Bass*, & *Timing Grid*
* **Masalah yang diselesaikan:** Pembaca partitur `LayarPartitur.tsx` (`#11`) dan sintesis WebAudio `partiturBunyi.ts` (`#13b`) telah melayani instrumen tiup dengan sangat baik, tetapi seksi *Battery* (*Snare, Tenor/Quints, Bass Drum 1–5, Cymbal*) dan *Pit* membutuhkan penulisan pola tangan **`R` / `L` / `B` (*sticking*)**, penanda **nomor *split* Bass Drum (`1`–`5`)**, rudimen (*diddle, flam, rimshot, buzz*), serta latihan pemanasan ritmik berpola (*Grid*).
* **Ruang lingkup pengerjaan:**
  1. **Lapisan Anotasi *Sticking* & *Split Bass* Non-Destruktif (`src/lib/perkusiSticking.ts`):** Store ringan `anotasiPartitur` (Dexie `v17`) menyimpan ketukan `R`/`L`/`B`, aksen `>`, *diddle* `//`, *flam*, *rimshot*, dan penanda *Bass 1–5* per lagu/part/birama tanpa mengubah berkas MusicXML asli — tampil rapi di bawah/atas kepala not OSMD, ikut tercetak `#hex` di Buku Saku Lyre A5 (`#11c`), dan ikut terbawa ke paket anggota seksi perkusi (`#13a`).
  2. **Suara Sintesis Perkusi Terpilah di WebAudio:** Memperkaya `partiturBunyi.ts` agar ketukan *Snare*, *Rimshot*, *Tenor Drum 1–5*, *Bass Drum 1–5* bernada bertingkat, dan *Cymbal* terdengar jelas berbeda saat **Bunyikan not** dijalankan pada skor perkusi.
  3. **Generator Latihan *Timing & Accent Grid* Terpadu Metronom:** Templat pemanasan bawaan (*8-on-a-hand, Accent-Tap, 4-2-1 Grid, Triplet Roll*) yang terhubung langsung dengan fitur naik-tempo otomatis (`#4`) untuk latihan pemanasan seksi di lapangan.
* **Ukuran:** Sedang–Besar.

#### `#26` — Pelatih Intonasi (*Pitch Tendency Chart*) & Ketepatan Ketuk Ritme Mandiri
* **Masalah yang diselesaikan:** Penala `TunerDrone` (`E4` + `#13c`) membantu menyetem nada tunggal saat itu juga, namun pemain tiup belum mengetahui **peta kecenderungan fals alami instrumennya** di berbagai register, dan belum memiliki alat ukur objektif untuk melatih ketepatan masuk subdivisi ritme (*internal pulse*).
* **Ruang lingkup pengerjaan:**
  1. **Kartu Peta Kecenderungan Nada (*Instrument Pitch Tendency Chart*):** Alur panduan 2 menit menggunakan detektor frekuensi mikrofon (`src/lib/tuner.ts`) untuk mengambil sampel tangga nada inti instrumen pemain, menghitung rata-rata simpangan sen per nada (mis. `D5: +13¢`, `F5: -9¢`), menyimpannya per perangkat/anggota, dan mencetak kartu saku referensi tiup A6/A5 `#hex`.
  2. **Pelatih Ketepatan Ketuk Subdivisi & *Silent Bar* (*Rhythm Tap Coach*):** Pemain mengetuk layar/tombol mengikuti pola sukat & subdivisi metronom — termasuk mode **Birama Hening (*Drop-Out Click*, mis. 2 birama bunyi + 2 birama senyap)** — lalu mendapat umpan balik akurasi rata-rata `±ms` (*terlalu cepat / tepat / terlambat*).
  3. **Perluasan Mode Kuis Hafalan Show (`src/lib/kuis.ts`):** Menambahkan mode kuis mandiri *Count Sheet Guard* (`#17`), arah *Dress/Guiding* (`#24`), simbol visual/tanduk (`#16`), serta urutan tempo & sukat segmen lagu di Mode Anggota.
* **Ukuran:** Sedang.

---

### Gelombang 3 — Sinkronisasi Lapangan Tanpa Sinyal & Komando Podium (`v2.4`)

#### `#27` — Estafet QR Berantai Tanpa Sinyal (*Animated QR Air-Gap Sync*) & `Web Share` Satu-Ketuk
* **Masalah yang diselesaikan:** Di tengah lapangan rumput atau area parkir stadion kejuaraan yang sinyalnya lumpuh, asisten pelatih seksi ingin menyetor hasil absensi & *pass-off* hafalan (`#15`) ke HP/tablet Pelatih Kepala, atau Pelatih Kepala ingin membagikan tambalan koordinat 2 set darurat ke *Section Leader* **tanpa internet, tanpa hotspot Wi-Fi, dan tanpa kabel**.
* **Ruang lingkup pengerjaan:**
  1. **Protokol Estafet QR Berantai (*Chunked Animated QR* — `src/lib/estafetQr.ts`):** Memampatkan muatan JSON berkas `BerkasPindah` / tambalan set menggunakan `CompressionStream('deflate-raw')` bawaan peramban (fondasi `mxl.ts`), memecahnya menjadi bingkai QR `~700 byte` ber-CRC32 (`qrcode`), dan menayangkannya berputar pada `3–4 fps`. Kamera perangkat penerima (`QrScanner.tsx` berbasis `BarcodeDetector`) menangkap bingkai dalam urutan apa pun hingga lengkap (`100%` dalam `2–5 detik`), mendekode isinya, dan langsung membukanya lewat pratinjau aman Pintu `#7` (`PratinjauBerkasModal`).
  2. **Tombol `Bagikan Langsung` Berbasis `Web Share API` (`navigator.share({ files })`):** Menambahkan aksi berbagi sistem operasi satu-ketuk di samping tombol *Unduh* pada halaman Berbagi, Kolaborasi Seksi (`#15`), dan Backup sehingga berkas dapat langsung dilempar lewat *Quick Share* Android, *AirDrop* iOS, atau aplikasi pesan tanpa harus mencari berkas di pengelola penyimpanan HP.
* **Ukuran:** Sedang (`0` dependensi baru — murni di atas `qrcode`, `QrScanner`, & `CompressionStream`).

#### `#28` — Konsol Podium *Gitapati / Field Commander* & Papan Aba-Aba Layar Besar
* **Masalah yang diselesaikan:** Saat latihan gabungan (*full ensemble*) di stadion luas atau berangin, pelatih/Gitapati di atas menara harus bolak-balik berpindah antara layar `Musik` dan `DrillPresenter` untuk mengulang potongan *"Mulai dari Huruf [C] / Set 12 di tempo 85%"*, sementara pemain di garis belakang sulit mendengar aba-aba lisan.
* **Ruang lingkup pengerjaan:**
  1. **Layar Terpadu *Ensemble Block Console* (`src/components/KonsolPodium.tsx` — *lazy chunk*):** Menggabungkan pemilih cepat **Set ↔ Huruf Latihan (*Rehearsal Mark*) ↔ Birama**, kendali tempo latihan `70%–100%` (`#4`), *count-in* aba-aba dapat dikustomisasi (*"4 ketuk Standby + 4 ketuk Mark Time"*), kanvas formasi ringkas, dan indikator hitungan besar dalam satu layar ramah tablet/HP lanskap.
  2. **Papan Kartu Pengumuman Raksasa (*40-Meter Flash-Cue Board*):** Satu ketuk memunculkan plakat layar penuh kontras ekstrem murni `#hex` (mis. **`SET 12 – 16 · TEMPO 85%`** atau **`RESET KE SET 1 · FULL RUN`**) yang terbaca jelas dari tengah lapangan saat megafon mati/bising.
  3. **Pencatat Pengulangan Blok (*Rep Counter*):** Menghitung otomatis berapa kali tiap rentang set telah diulang pada sesi tersebut dan menyimpannya ke ringkasan sesi latihan (`latihan.ts`).
* **Ukuran:** Sedang.

---

### Gelombang 4 — Kesiapan Arena *Pit*, Logistik Menit-H, & Interoperabilitas `v3.0` (`v3.0.0`)

#### `#29` — Denah *Front Ensemble (Pit)*, Rute Kabel Audio, & Kalkulator *Warm-Up Lot* Lomba
* **Masalah yang diselesaikan:** Di kejuaraan modern, seksi *Front Ensemble (Pit)* & kru tata suara menghadapi batas waktu masuk/keluar arena yang sangat ketat (`4–5 menit` sebelum terkena penalti juri waktu `#20`) serta kerumitan sambungan kabel mixer/synth/mikrofon solois. Selain itu, pada hari H lomba (`Lomba.tsx`), keterlambatan sering terjadi saat perpindahan jalan kaki antar-area parkir truk → pemanasan fisik → *Music Warm-Up Lot* → *Ready Gate*.
* **Ruang lingkup pengerjaan:**
  1. **Penyusun Denah Panggung *Pit* & Tabel *Audio Patch* (`src/lib/pitDanWarmup.ts`):** Kanvas susun cepat kotak instrumen *Pit* (*Marimba, Vibraphone, Xylophone, Glockenspiel, Timpani, Synth, Rack, Amp/Speaker, Mixer, UPS/Genset*) terhubung ke aset inventaris (`#18`), lengkap tabel saluran input/output mixer (`Ch 1..16`), kebutuhan daya listrik, penugasan kru pendorong, serta cetak **Lembar *Pit Setup & Audio Patch* A4** murni `#hex`.
  2. ***Stopwatch Pit Crew Timed Drill*:** Pengukur waktu latihan bongkar-pasang panggung dengan batas target kejuaraan dan riwayat waktu tercepat tim.
  3. **Generator Jadwal Mundur *Warm-Up Lot* Otomatis di Halaman `Lomba`:** Pelatih cukup memasukkan **Jam Tampil Resmi (*Step-Off*)**, durasi jatah *lot* panitia, dan waktu jalan kaki antar-pos stadion; aplikasi otomatis membangkitkan rantai pos menit-demi-menit ke dalam *Run Sheet* (`G1`) & Layar Hari H (`G2`).
* **Ukuran:** Sedang.

#### `#30` — Arsip Show Mandiri (`.dkshow`), Ekspor CSV Pyware 2-Arah, & Cetakan Dwibahasa (`ID`/`EN`)
* **Masalah yang diselesaikan:** Memastikan karya koreografi dan aransemen di DrillKit tidak terkunci di satu ekosistem (*zero vendor lock-in*), mudah dipertukarkan utuh antar-desainer lintas kota tanpa ikut membawa data anggota/kas korps, serta siap dicetak ketika unit mengundang juri/klinisi internasional atau berlaga di ajang luar negeri (WAMSB, TWMC, MIBC).
* **Ruang lingkup pengerjaan:**
  1. **Bundel Pertunjukan Mandiri `.dkshow` (ZIP Bersih Data Pribadi):** Mengemas definisi drill, *tempo map* lagu, berkas partitur MusicXML, anotasi *sticking* (`#25`), *count sheet* (`#17`), *Moving Props* (`#16e`), dan denah *Pit* (`#29`) ke satu berkas `.dkshow` yang langsung dikenali Pintu `#7` (`bukaBerkas.ts`) — **dijamin bebas** nama asli, telepon, absensi, evaluasi, kas, maupun data medis anggota.
  2. **Ekspor Koordinat CSV Standar Lintas-Aplikasi (`#10` Dua Arah):** Melengkapi `pyware.ts` & `csvKoordinat.ts` dengan opsi ekspor CSV format standar *Coordinate Sheet* universal (kolom *Set, Counts, Performer, Side, Yard Line, Front-Back*) agar dapat dibuka kembali di perangkat lunak spreadsheet/desain pihak ketiga.
  3. **Opsi Tajuk Cetak Dwibahasa (`Bahasa Indonesia` / `English`) pada Dokumen Kejuaraan:** Saklar pilihan bahasa label khusus pada keluaran cetak *Dot Sheet*, *Count Sheet*, *Caption Recap*, dan *Pit Patch Sheet* ketika dokumen perlu diserahkan ke juri tamu berbahasa Inggris, sementara seluruh antarmuka aplikasi tetap memakai Bahasa Indonesia yang alami.
* **Ukuran:** Sedang.

---

## 5. Peta Dampak Skema IndexedDB (`Dexie v16+`) & Pagar Privasi Berkas

Melanjutkan **Dexie `v16` (`28` store)** pada `v2.1.0`, seluruh pengembangan `#22`–`#30` diwajibkan hemat tabel baru (mengutamakan atribut opsional kompatibel-mundur) dan mematuhi pagar privasi `bersihkanAnggota` + `kupasDataKhususStaf`:

| Rancangan | Perubahan Skema Dexie (`v16+`) | Ikut Backup Lengkap ZIP? | Ikut Paket Anggota (`ShareBundle` / `#2`)? | Catatan Privasi & Ukuran Bundel |
| :---: | :--- | :---: | :--- | :--- |
| **`#22`** | *Tidak ada store baru* (mesin analitik murni di atas `DrillSet`) | — | — | Nol dampak ukuran paket; *lazy* di editor drill |
| **`#23`** | Kolom opsional `tinggiMeter` pada `FieldMarker` (`v16` tetap) | Ya | Ya (bagian dari geometri panggung) | Kanvas tribun & perekam `.webm` di *lazy chunk* |
| **`#24`** | Kolom opsional `dress` & `catatanCleaning` pada `DrillSet` (`v16` tetap) | Ya | `dress` **Ya** (panduan baris pemain); `catatanCleaning` internal staf **dikupas** | Menjaga buku saku anggota fokus & bersih |
| **`#25`** | `v17`: `+ anotasiPartitur` (JSON ringan per lagu/birama) | Ya | **Ya, tersaring** khusus seksi penerima (`#13a`) | Tidak mengubah bita berkas MusicXML asli |
| **`#26`** | Profil kecenderungan nada lokal per perangkat/anggota (`localStorage` / opsional mandiri) | Opsional lokal | Milik perangkat anggota sendiri (tidak bocor antar-anggota) | Melatih mandiri di HP anggota luring penuh |
| **`#27`** | *Tidak ada store baru* (lapisan transpor di atas `BerkasPindah` `#7`/`#15`) | — | Mematuhi pagar privasi jenis berkas yang dikirim | `0` dependensi baru (`qrcode` + `BarcodeDetector` + `CompressionStream`) |
| **`#28`** | Kolom opsional `logRep` pada ringkasan sesi latihan (`v17` tetap) | Ya | **Tidak** (catatan staf latihan) | Dimuat malas saat Konsol Podium dibuka |
| **`#29`** | `v18`: `+ denahPit` + pos mundur opsional pada `RunSheet` | Ya | Penugasan dorong kru pribadi tampil di kartu anggota; detail mixer tetap staf | Cetak A4 diisolasi di `pitDanWarmupCetak.ts` |
| **`#30`** | *Tidak ada store baru* (format arsip `.dkshow` di atas `zip.ts` & `#7`) | — | `.dkshow` membuang seluruh identitas pribadi anggota (`kode` titik saja) | Aman dipertukarkan bebas antar-desainer |

---

## 6. Rekomendasi Urutan Eksekusi

1. **Mulai dari `#22` (*Pemeriksa Tabrakan Lintasan & Penyelesai Silang 1-Klik* — `v2.2.0`):** Langsung meningkatkan kualitas & keselamatan setiap drill yang dibuat di DrillKit tanpa menambah satu pun tabel database baru, serta menjadi fondasi geometri yang bersih sebelum menambahkan proyeksi tribun `#23`.
2. **Lanjutkan ke `#23` & `#24` (`v2.2.1`–`v2.2.2`):** Menutup penuh **Gelombang 1** sehingga desainer memiliki deteksi tabrakan, pratinjau sudut pandang juri *Press Box*, ekspor video `.webm`, dan penanda *Dress/Guiding* barisan sekaligus.
3. **Masuk ke `#27` (*Estafet QR Tanpa Sinyal*) atau `#25` (*Studio Perkusi*):** Keduanya berdampak langsung sangat tinggi di lapangan latihan Indonesia yang kerap terkendala sinyal maupun keseragaman *sticking* perkusi.
