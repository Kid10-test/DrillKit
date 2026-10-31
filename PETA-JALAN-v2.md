# Peta Jalan Pengembangan DrillKit Pasca-`v1.0.0` (Menuju Platform *All-in-One* Program Marching Band)

Dokumen ini menjadi acuan kerja utama setelah rilis stabil **`v1.0.0`** (`28 Oktober 2026`), melanjutkan `IDE-PENGEMBANGAN.md` (kelompok `A`–`K`) dan `RANCANGAN-LANJUTAN.md` (`#1`–`#11d` yang telah selesai penuh).

Tujuan peta jalan ini ada dua:
1. Merangkum hasil **Quality Check & Functional Check `v1.0.0`** sebagai garis dasar kesehatan aplikasi dan daftar polesan teknis (`#12`).
2. Memetakan rancangan terukur **`#12` s.d. `#21`** agar DrillKit berevolusi dari aplikasi *drill + jadwal + absensi + musik* menjadi **platform operasional *all-in-one* untuk program marching band** (latihan harian, *pass-off* hafalan, koreografi *Color Guard*, inventaris alat/seragam, logistik hari lomba, simulasi penjurian, audisi, hingga administrasi unit) — tanpa mengorbankan kesederhanaan pemakaian di lapangan.

> **Cara memakai dokumen ini:** Dokumen ini bukan beban yang harus dikerjakan sekaligus. Setiap butir memiliki nomor rancangan tersendiri (`#12` s.d. `#21`) agar kapan pun siap dicicil, cukup sebutkan: *"Kerjakan `#12` dulu"* atau *"Rancang detail `#14`"*.

---

## 1. Aturan Permanen Proyek (Wajib Dijaga di Seluruh `#12`–`#21`)

1. **100% *Offline-First* & Nol Biaya Server:** Seluruh fitur wajib berjalan penuh di IndexedDB lokal, PWA, dan bundel portabel (`DrillKit.html`), tanpa backend berbayar maupun ketergantungan internet di lapangan.
2. **Hemat Ketergantungan (*Zero Unjustified Runtime Dependencies*):** Saat ini aplikasi hanya memakai 8 dependensi runtime (termasuk `opensheetmusicdisplay` yang terisolasi di *lazy chunk*). Fitur baru wajib mengutamakan API bawaan peramban (WebAudio, Canvas, SVG, WebCrypto, CompressionStream).
3. **Warna Cetak, SVG, & HTML Mandiri Murni Hex/RGB:** Dilarang menggunakan `oklch()` atau `color-mix()` pada keluaran cetak A4, buku saku, kanvas SVG lapangan (`FieldSurface`), maupun cetak partitur agar aman di peramban/laptop lama.
4. **Anti-Jalan-Buntu (*Zero Dead-Ends*):** Alur di Mode Pelatih, Mode Anggota, Mode Kios, maupun bundel portabel `file://` tidak boleh buntu; setiap fitur cetak wajib menyediakan pratinjau atau tombol **Unduh HTML**.
5. **Panduan Cetak Tetap 1 Halaman A4 Tegak:** Panduan cepat pelatih dan panduan cepat anggota (`src/lib/panduan.ts`) wajib selalu terukur pas **1 halaman A4 portrait** (`halamanA4 === 1`).
6. **Bahasa Indonesia & Satu Rancangan = Satu PR Teruji:** Seluruh antarmuka, pesan galat, komentar, dan dokumen memakai Bahasa Indonesia yang wajar; setiap rancangan dilengkapi rangkaian uji logika dan/atau peramban di `qa/` serta didaftarkan ke `qa/regresi-penuh.sh`.

---

## 2. Garis Dasar Kualitas `v1.0.0` (Hasil Audit Empiris)

Pemeriksaan menyeluruh terhadap build produksi `v1.0.0` (`8bf02bd`) mencatat garis dasar berikut:

| Aspek Audit | Hasil pada `v1.0.0` | Status |
| :--- | :--- | :---: |
| **Pemeriksaan Tipe (`tsc --noEmit`)** | `0` galat tipe pada `57.718` baris kode sumber TypeScript/TSX. | Lulus |
| **Build Produksi & Precache PWA** | `228` modul terkompilasi bersih (`target: es2019`, LightningCSS); *precache* `31` aset (`3.772 KiB`). | Lulus |
| **Regresi Otomatis** | **116 rangkaian uji** (logika murni + Headless Chromium) lulus penuh. | Lulus |
| **Uji Fungsional 11 Rute + Mode Anggota + Kios** | `0` `pageerror`, `0` `console.error`, dan `0` teks `NaN`/`undefined` di seluruh halaman. | Lulus |
| **Layar HP Sempit (`360×800` px)** | `0 px` *horizontal overflow* di semua 11 rute pelatih maupun Mode Anggota; ruang bawah `<main>` aman dari navigasi bawah. | Lulus |
| **Keamanan Cetak & Tombol Ikon** | `0` kebocoran `oklch()`/`color-mix()` di modul cetak/SVG; `0` tombol ikon tanpa label aksesibilitas. | Lulus |
| **Bundel Distribusi Rilis** | `drillkit-portable.zip` (`769 KB`), `drillkit-siap-unggah.zip` (`1,9 MB`), dan `drillkit-release.zip` (`1,9 MB`) utuh & bebas korup. | Lulus |

### Temuan Teknis & UX yang Menjadi Masukan Pemeliharaan (`#12`)
1. **Impor statis `BukaBerkas` di `Layout.tsx` membengkakkan bundel awal (`537,76 kB` / `177,11 kB` gzip):** Walaupun 10 rute di `App.tsx` sudah *lazy-loaded*, `Layout.tsx` memuat `BukaBerkas.tsx` secara statis sehingga `pyware.ts`, `partitur.ts`, `mxl.ts`, `zip.ts`, `backup.ts`, dan `namaAnggota.ts` ikut terunduh pada halaman pertama. Selain itu, `src/lib/ucap.ts` diimpor campuran (dinamis di `AturHitungMundur.tsx`, statis di `Music.tsx`).
2. **Lima berkas komponen melampaui 1.300–3.900 baris:** `DrillEditor.tsx` (`3.988` baris), `Music.tsx` (`2.648`), `Share.tsx` (`2.080`), `LayarPartitur.tsx` (`1.465`), dan `Schedule.tsx` (`1.344`) perlu dipecah bertahap menjadi sub-komponen terfokus sebelum ditambah fitur generasi berikutnya.
3. **Navigasi bawah Mode Pelatih di HP menumpuk 11 tab geser samping:** Di layar `360px`, berpindah antar-menu menuntut geser horizontal berulang; pola **4 tab utama + laci *"Lainnya"*** jauh lebih ergonomis.
4. **Target sentuh sekunder & pengait `<label>` form:** Sejumlah tombol *chip*/aksi sekunder di layar HP masih bertinggi `< 30 px`, dan beberapa `<input>/<select>` belum memiliki pasangan `htmlFor`/`id` atau `aria-label` eksplisit.
5. **Efisiensi CI GitHub Actions:** `actions/checkout` & `actions/setup-node` masih di `@v4` (runtime Node 20 mulai dideprekasi GitHub Actions), dan perubahan murni dokumentasi (`.md`) masih ikut menyalakan regresi penuh ±45 menit.

---

## 3. Ringkasan Gelombang & Daftar Rancangan (`#12` s.d. `#21`)

| # | Nama Rancangan | Gelombang | Ukuran | Dampak Utama | Ketergantungan |
| :---: | :--- | :---: | :---: | :--- | :--- |
| **#12** | Polesan Performa Bundel, Navigasi Mobile Pelatih, Modularisasi, & CI | `v1.0.1` / `v1.2.0` | Sedang | **Selesai Penuh (`12a`–`12d`)** — JS awal `390,3 kB`, laci HP & perbaikan `z-index` modal/anggota, modularisasi `DrillEditor`/`Music`/`Share`, CI Node 24 | Fondasi sebelum fitur `v1.1+` |
| **#13** | Partitur Per-Suara & Audio Panduan di Paket Anggota + Sintesis Nada & Drone | `v1.1` | Sedang–Besar | **Selesai (`v1.1.0`)** — Partitur tersaring per suara di paket anggota, audio panduan di ZIP, sintesis bunyi notasi WebAudio, & akor/temperamen drone penala | Melanjutkan `#2`, `#6`, `#11c–d` |
| **#14** | Matriks Setoran Hafalan (*Music & Visual Pass-Off Tracker*) | `v1.1` | Sedang | **Selesai (`v1.1.1`)** — Target setoran dari segmen lagu/manual, matriks 6 jenjang ketuk-cepat, uji cepat *Section Leader* + *loop* frasa, cetak A4 hex, & kartu anggota terkunci | Tersambung ke `songs`, `Share`, `#2` |
| **#15** | Sinkronisasi Multi-Pelatih Seksi & Log Perubahan Show (`I1`) | `v1.1` | Sedang | **Selesai (`v1.1.2`)** — 1-klik kirim/gabung setoran asisten per seksi tanpa menimpa seksi lain + log perubahan show otomatis (`I1`) di paket & HP anggota | Melanjutkan `pindah.ts` & `riwayat` |
| **#16** | Koreografi Visual Lanjut: Jalur Per-Kelompok, *FTL*, *Hold/Ripple*, & *Moving Props* | `v1.2` | Besar | **Selesai (`v1.2.0`)** — FTL & jalur sub-kelompok, generator bentuk cepat + pratinjau kanvas, *Move+Hold* + *Ripple* + simbol visual buku saku/anggota, properti bergerak & kru | Melanjutkan `DD2`, `DD10b`, `A7`, `#12c` |
| **#17** | Lembar Hitungan *Color Guard* (*Count Sheet*) & Buku Saku Visual | `v1.2` | Sedang | Kerja alat *Guard* per *8-counts* sinkron birama/set, cetak A4/A5, & Mode Anggota | Tersambung ke `Drill`, `Song`, `#13` |
| **#18** | Inventaris Alat, Seragam (*Uniform Fitting*), & Manifes Logistik Lomba | `v1.2` | Sedang–Besar | Lacak aset/kondisi alat, ukuran seragam anggota, & *checklist* truk 3-tahap di Hari H | Tersambung ke `Members` & `Lomba` |
| **#19** | Mode Kirab / *Street Parade* & *Display* Jalan Raya | `v1.2` | Sedang | Kanvas jalan memanjang, barisan banjar × saf, belok tikungan, & kalkulator rute | Melanjutkan `field.ts` (`#9`) |
| **#20** | Simulasi Penilaian Juri (*Caption Recap*) & *Judge Tape* Berpenanda Waktu | `v2.0` | Sedang–Besar | Skor *caption* standar lomba, grafik *run-through*, & komentar suara tertaut set/bar | Tersambung ke `Lomba`, `Drill`, `Song` |
| **#21** | Audisi Anggota Baru, Administrasi Unit (Dispensasi, Medis, Kas TC), & Arsip Musim | `v2.0` | Besar | Seleksi angkatan baru, cetak surat izin resmi, kartu medis darurat, kas, & arsip musim | Menyempurnakan siklus tahunan tim |

---

## 4. Rincian Rancangan per Gelombang

---

### Gelombang 1 — Pemeliharaan, Performa, & Ergonomi (`v1.0.1`)

#### `#12` — Polesan Performa Bundel, Navigasi Mobile Pelatih, Modularisasi, & Efisiensi CI *(Selesai Penuh `12a`–`12d` di `v1.0.1` & `v1.2.0`)*
* **Masalah yang diselesaikan:** Halaman awal memuat modul impor berkas yang belum dipakai, bilah bawah HP pelatih terlalu panjang untuk 11 menu, modal di layar HP sempat tertutup bilah bawah (termasuk bilah tunggal `"Tim"` di Mode Anggota), dan lima berkas utama terlalu besar untuk dirawat jangka panjang.
* **Ruang lingkup pengerjaan & status:**
  1. **Pemangkasan Bundel Utama (`12a` — Selesai):** `PratinjauGlobal` dan `TombolBukaBerkas` dipisahkan dari tubuh berat `PratinjauBerkasModal.tsx` & `bukaBerkas.ts`, pembentuk nama berkas dipisahkan ke `namaBerkas.ts`, `Panduan` & `seedDemoData` di Dashboard dimuat malas, dan impor `ucap.ts` diseragamkan. Bundel JS awal turun `-30%` dan tetap terjaga di **`390,32 kB` (`127,36 kB` gzip)** pada `v1.2.0` (jauh di bawah ambang `< 420 kB`).
  2. **Laci Navigasi HP, Ergonomi Sentuh, & Hirarki `z-index` Layar HP (`12b` — Selesai):** Di layar `< 1024px` pada Mode Pelatih, bilah bawah menampilkan 4 menu utama (*Beranda, Absensi, Drill, Musik*) + tombol **Lainnya** (`data-testid="tombol-menu-lainnya"`). Pada `v1.2.0`, bilah bawah `"Tim"` di Mode Anggota (`nav.length === 1`) dihapus agar tidak menutupi layar bawah HP, dan `<Modal>` dirender lewat `createPortal(..., document.body)` (`z-[220]`) di atas bilah bawah (`z-40`), `PenandaRilis` (`z-[60]`), dan `LayarPartitur` layar penuh (`z-[110]`), terverifikasi lewat uji ketuk `elementFromPoint` di `qa/lebar-hp.mjs`.
  3. **Modularisasi Komponen Raksasa (`12c` — Selesai di `v1.2.0`):** `DrillEditor.tsx` dipecah ke `src/components/drill/{PenggarisMusikDrill,PanelAnalitikGerak,PanelAlatFormasi,PanelGerakSet}.tsx` + modul geometri murni `src/lib/{bentukFormasi,propertiGerak}.ts`; `Music.tsx` dipecah ke `src/components/musik/{EditorBirama,ModalLagu}.tsx`; dan `Share.tsx` dipecah ke `src/components/share/{TabAnggotaJadwal,TabAnggotaKonten}.tsx`.
  4. **Pembaruan CI (`12d` — Selesai):** `actions/checkout` dan `actions/setup-node` diperbarui ke `@v5` (runtime Node 24) serta ditambahkan `paths-ignore: ['**.md']` pada `.github/workflows/ci.yml`.

---

### Gelombang 2 — Jembatan Musik, Latihan Mandiri, & Kolaborasi Staf (`v1.1`)

#### `#13` — Partitur Per-Suara & Audio Panduan di Paket Anggota + Bunyi Notasi & Drone Penala *(Selesai di `v1.1.0`)*
* **Masalah yang diselesaikan:** Sebelumnya di Mode Anggota, pemain menerima peta tempo lagu dan daftar set list, tetapi belum bisa membuka lembar partitur instrumennya langsung dari paket anggota (`ShareBundle`) tanpa mengimpor berkas MusicXML terpisah, belum bisa membunyikan notasi langsung dari lembar partitur untuk mengecek nada/ritme sulit, dan drone penala belum mendukung akor tiga-nada maupun pilihan temperamen *Just Intonation* vs *12-TET*.
* **Ruang lingkup pengerjaan & hasil aktual (`v1.1.0`):**
  1. **Partitur Tersaring di Paket Anggota (`13a` — Selesai):** Modul murni `src/lib/partiturPaket.ts` (`pangkasMusicXmlKePart` & `saringPartiturPaketUntukAnggota`) memangkas skor MusicXML ke *part* instrumen/seksi penerima pada berkas per-anggota (`paketAnggota`), mewariskan huruf latihan `<rehearsal>` dan tanda tempo global dari *part* teratas, menjaga *fallback* skor utuh bila instrumen tidak tercantum di skor, serta tidak menduplikasi bita partitur ke dalam ciphertext `locked` pada `paket.json` (`terbit.ts`). Di perangkat anggota (`paketMasuk.ts` & `Share.tsx`), lampiran otomatis masuk ke `db.partiturBerkas` agar langsung ter-render luring di Mode Anggota.
  2. **Opsi Audio Referensi di ZIP Paket Anggota (`13a` — Selesai):** Saklar opsional `toggle-rekaman-zip` pada halaman Berbagi membungkus rekaman panduan lagu (`audio/*` + `audio/manifest.json`) ke dalam ZIP paket anggota dan otomatis dipulihkan ke `db.rekamanAudio` saat dibuka di Mode Anggota.
  3. **Sintesis Bunyi Partitur Ringan (`13b` — Selesai):** Modul `src/lib/partiturBunyi.ts` mengurai `<pitch>`, transposisi kromatik konser (`<transpose><chromatic>`), penyambungan `<tie>` lintas birama, `<chord/>`, dan ketukan perkusi `<unpitched>`, lalu menyintesisnya lewat WebAudio (`PemutarNadaPartitur`) pada tombol **Bunyikan not** (`partitur-bunyikan-not`) di `LayarPartitur.tsx` sinkron dengan sorot birama aktif, tempo latihan `#4`, dan *loop* frasa `#11d`. Bundel JS awal tetap ringan di **`377,90 kB` (`122,54 kB` gzip)**.
  4. **Akor & Temperamen Drone di Penala (`13c` — Selesai):** `Dengung` (`src/lib/tuner.ts` & `TunerDrone.tsx`) kini mendukung mode harmoni *Nada Dasar*, *Kuinta*, *Akor Mayor (1–3–5)*, *Akor Minor (1–♭3–5)*, dan *Oktaf* dalam temperamen **Murni / Just Intonation** (*Brass Arc*, lengkap dengan panduan nada tertulis sesuai transposisi instrumen & target koreksi `-14` / `+16` / `+2` sen) maupun **Setara / 12-TET** (*Pit*). Teruji penuh di `qa/partitur-paket-bunyi-logika.mjs` (35/35) dan `qa/partitur-paket-bunyi.mjs` (21/21; total **119 rangkaian** regresi penuh).

#### `#14` — Matriks Setoran Hafalan (*Music & Visual Pass-Off Tracker*) *(Selesai di `v1.1.1`)*
* **Masalah yang diselesaikan:** Evaluasi 4-aspek (`H2`) bagus untuk rapor bulanan, dan centang `Kemajuan` (`K3`) bagus untuk menandai set formasi yang sudah dilatih bersama, tetapi pelatih seksi & *Section Leader* belum punya alat untuk menagih **tanggungan setoran hafalan per potongan lagu** tiap pemain.
* **Ruang lingkup pengerjaan & hasil aktual (`v1.1.1`):**
  1. **Daftar Target Setoran (*Checkpoints* — Selesai):** Store Dexie `v11` (`targetSetoran` + `setoran` berkunci deterministik `${targetId}__${memberId}`), pembuatan target manual (kategori *Musik / Visual / Musik+Gerak*, rentang birama, batas kelulusan per seksi, tenggat tanggal) maupun generator 1-klik `buatSaranTargetDariLagu(song)` dari `tempoMap` / blok 16 birama.
  2. **Jenjang Status Bertahap (`[Anggota × Target]` — Selesai):** Matriks ketuk-cepat 6 jenjang (`Belum` → `Baca Lancar` → `Tempo Latihan` → `Tempo Asli` → `Hafal Musik` → `Lulus Sambil Gerak`) atomik ke IndexedDB + modal rincian (tanggal uji, penguji, dan catatan umpan balik singkat).
  3. **Mode Uji Cepat *Section Leader* (Selesai):** Tampilan kartu ramah jempol di HP (bebas luapan di `390px`) yang memutar *loop* frasa lagu secara langsung lewat `PemutarNadaPartitur` (`#13b`, baik dari MusicXML maupun ketuk metronom bersegmen pada tempo `75%`/`85%`/`100%`) sambil mengetuk pil kelulusan pemain di depannya.
  4. **Papan Kesiapan Tim, Cetak A4 Hex, Privasi Berbagi, & Putaran Data (Selesai):** Grafik % kesiapan per seksi dan per target di halaman Evaluasi (`?tab=setoran`), baris ringkasan di Dashboard, pratinjau cetak A4 mendatar murni `#hex` (`0` `oklch()`/`color-mix()`) + **Unduh HTML**, perlindungan privasi di `paketGrup` (`setoran: []`) & `paketAnggota` / `locked` `#2` + kartu tanggungan pribadi di Mode Anggota lengkap tombol 1-klik **Latih di Musik**, serta putaran penuh di Backup ZIP, Pusat Data (`pindah.ts`), dan penggabungan anggota ganda (`namaAnggota.ts`). Teruji di `qa/setoran-logika.mjs` (22/22) dan `qa/setoran-hafalan.mjs` (18/18; total **121 rangkaian** regresi penuh).

#### `#15` — Kolaborasi Multi-Pelatih Seksi & Log Perubahan Show (`I1`) *(Selesai di `v1.1.2`)*
* **Masalah yang diselesaikan:** Di lapangan, asisten pelatih (*Brass, Battery, Pit, Color Guard*) mencatat absensi, evaluasi, dan setoran hafalan di perangkat masing-masing, lalu kerepotan menyatukannya ke laptop Pelatih Kepala. Di sisi lain, saat desainer drill/musik mengubah formasi atau birama, staf & anggota sering tidak sadar titik mana saja yang berubah (kandidat lama `I1`).
* **Ruang lingkup pengerjaan & hasil aktual (`v1.1.2` — menuntaskan Gelombang 2 `v1.1`):**
  1. **Alur 1-Klik *"Kirim Setoran Seksi"* & *"Gabung Setoran Asisten"* (`15a` — Selesai):** Modul murni `src/lib/kolaborasiSeksi.ts` di atas `pindah.ts` (`asistenSeksi` pada `BerkasPindah`), pintasan dari `PanelSetoranHafalan` → `#/data?seksi=...`, kartu 1-klik ekspor terfilter per seksi & rentang tanggal (`hari-ini`, `7-hari`, `semua`) tanpa pernah membocorkan kolom rahasia anggota (`token`, `phone`, `notes`), pengenalan lencana asisten di Pintu `#7` (`PratinjauBerkasModal`), serta ringkasan per seksi + bukti seksi lain tak tersentuh + penggabungan mendalam `gabungKemajuanAman`, `gabungSetoranAman`, dan `gabungAbsensiAsisten` di `Data.tsx` (juga menutup *race condition* `useLiveQuery` saat `Data` dipasang perdana dari Pintu `#7`).
  2. **Log Perubahan Show Otomatis (`15b` / `I1` — Selesai):** Store tambah-murni Dexie `v12` (`logPerubahan`) + modul murni `src/lib/logPerubahan.ts` yang membandingkan revisi drill, lagu, jadwal, dan target setoran menjadi daftar perubahan berbahasa manusia (pengelompokan set berurutan *"Set 8–11: posisi T1–T6 berubah > 2 langkah"*, deteksi pemecahan *"Set 14 dipecah menjadi 14 & 14A"*, perubahan tempo segmen *"Tempo Segmen B berubah 132 → 140 BPM"*, serta penjaga acuan `pilihAcuanPerubahan` saat ekspor berurutan grup → ZIP → terbit). Di Mode Anggota (`Share.tsx`, `paketMasuk.ts`, `terbit.ts`), kartu **"Apa yang berubah di paket ini"** tampil otomatis beserta sorotan **`Menyangkut titikmu!`** bagi pemain yang titik/seksinya terdampak. Teruji di `qa/kolaborasi-perubahan-logika.mjs` (18/18) dan `qa/kolaborasi-perubahan.mjs` (14/14; total **123 rangkaian** regresi penuh).

---

### Gelombang 3 — Koreografi Visual, *Color Guard*, Parade, & Logistik (`v1.2`)

#### `#16` — Koreografi Visual Lanjut: Jalur Per-Kelompok, *FTL*, *Hold/Ripple*, Simbol Visual, & Properti Bergerak *(Selesai di `v1.2.0`)*
* **Masalah yang diselesaikan:** Sebelumnya `GerakSet` (`DD2`: lurus/lengkung/busur/tunda) masih berlaku seragam untuk satu set atau per seksi utuh, belum mendukung dua sub-kelompok yang bergerak berbeda gaya di set yang sama, belum ada *Follow-the-Leader*, belum ada penanda *Hold* & simbol koreografi di buku saku, serta `FieldMarker` (`A7`) masih terkunci diam di seluruh set.
* **Ruang lingkup pengerjaan & hasil aktual (`v1.2.0`):**
  1. **Gerak Per-Kelompok & *Follow-the-Leader* (`FTL` — Selesai):** `GerakKelompok` pada `GerakSet` + mesin polilin `bangunPetaFtl` / `deltaPoliFtl` / `pathPoliFtl` di `src/lib/gerak.ts` memungkinkan sub-kelompok pemain memakai jalur *lurus*, *melengkung*, atau jejak berantai *Follow-the-Leader* (lengkap tombol pembalik pemimpin barisan & jejak `<path>` di kanvas SVG) baik saat *scrub*, pemutaran editor, `DrillPresenter`, maupun Mode Anggota.
  2. **Alat Bentuk Cepat (*Shape Generators* — Selesai):** Modul murni `src/lib/bentukFormasi.ts` + `PanelAlatFormasi.tsx` menyediakan *Company Front*, *Arc/Kurva*, *Lingkaran*, *Grid Blok*, dan *Garis Miring* beserta `cerminTitikFormasi` dan **pratinjau langsung** (*live ghost dots* `pratinjau-bentuk-kanvas`) di kanvas SVG sebelum diterapkan.
  3. **Pembagian *Move + Hold*, *Ripple*, & Simbol Visual/Tanduk (Selesai):** `jalanCount` (*Move + Hold* tanpa wajib memecah set), gelombang `RippleGerak` (`grup` `A/B/C/D` maupun `berurutan` `1..N`, termasuk penyusun cepat kiri→kanan), serta 8 simbol visual (`Horn Up`, `Horn Down`, `Horn Snap`, `Mark Time`, `Halt`, `Lunge`, `Hadap Penonton`, `Choreo`) + filter seksi & catatan yang otomatis tercetak murni `#hex` di **Dot Sheet & Buku Saku Lipat** serta tampil di **Mode Anggota** dan **Log Perubahan Show (`#15b`)**.
  4. **Properti Bergerak (*Moving Props*) & Kru Pendorong (Selesai):** `src/lib/propertiGerak.ts` + `FieldMarkers.tsx` menambahkan sudut `rotasi`, *keyframe* koordinat & rotasi `perSet` (terinterpolasi mulus lintas set), serta penunjukan `kruIds` yang tampil di buku saku dan kartu tugas anggota. Teruji penuh di `qa/koreografi-lanjut-logika.mjs` (31/31) dan `qa/koreografi-lanjut.mjs` (13/13; total **125 rangkaian** regresi penuh).

#### `#17` — Lembar Hitungan *Color Guard* (*Count Sheet*) & Buku Saku Visual *(Selesai di `v1.2.1`)*
* **Masalah yang diselesaikan:** Pemain musik memiliki partitur (`#11`) dan pemain baris memiliki *dot sheet*, tetapi seksi *Color Guard* belum memiliki lembar kerja koreografi per 8-hitungan (*count sheet*) yang terikat ke musik dan set formasi.
* **Ruang lingkup pengerjaan & hasil aktual (`v1.2.1`):**
  1. **Editor *Count Sheet* Terikat Set & Birama (Selesai):** Store tambah-murni Dexie `v13` (`countSheets`), modul murni `src/lib/countSheet.ts`, dan `ModalCountSheet.tsx` (dimuat malas di `DrillEditor` maupun `Music`) mendukung generator 1-klik `buatBlokDariDrill` (*per 8-count* atau *1 blok per Set*) & `buatBlokDariLagu`, pilihan alat (*Flag, Rifle, Sabre, Swing Flag, Air Blade, Dance, Prop*), pil teknik cepat (*Drop Spin, Peggy Spin, Toss 45, Single..Quad, Exchange*), pita ketuk aksen (`▲`) & *catch* (`★`) + rincian per hitungan, arah hadap, posisi tangan, serta filter sub-kelompok pemain.
  2. **Cetak A4 & Buku Saku *Guard* Hex Murni (Selesai):** `bangunHtmlCetakCountSheet` menghasilkan lembar A4 gabungan (koordinat titik + kerja alat) maupun buku saku lipat A5 (2 kartu per halaman A4) murni `#hex` (`0` `oklch()`/`color-mix()`), ditambah integrasi langsung di `DotSheetModal`.
  3. **Tampilan *Count Sheet* Sinkron di Mode Anggota & Putaran Data Penuh (Selesai):** `PanelCountSheetSinkron.tsx` menyorot hitungan aktif `1..N` (`▲ AKSEN` / `★ CATCH!`) secara waktu nyata mengikuti ketukan metronom/rekaman di tab **Musik** maupun animasi perpindahan di tab **Formasi**, lengkap putaran penuh di `ShareBundle`, Log Perubahan Show (`#15b`), Backup ZIP, Pusat Data (`pindah.ts`), salin show (`show.ts`), pecah/hapus set, dan penggabungan nama anggota. Teruji di `qa/count-sheet-logika.mjs` dan `qa/count-sheet.mjs` (total **127 rangkaian** regresi penuh).

#### `#18` — Manajemen Inventaris Alat, Seragam (*Uniform Fitting*), & Manifes Logistik Hari Lomba
* **Masalah yang diselesaikan:** Kerusakan instrumen tanpa catatan, ukuran seragam yang tertukar menjelang penampilan, dan tertinggalnya perlengkapan penting saat bongkar-muat truk hari lomba belum tertangani di aplikasi.
* **Ruang lingkup pengerjaan:**
  1. **Buku Induk Inventaris Instrumen & Perlengkapan:** Kode aset/nomor seri, kategori (*Brass, Battery, Pit, Elektronik/Sound, Guard, Podium & Properti*), merek/tipe, status kondisi (*Siap Pakai / Perlu Servis / Rusak*), riwayat perawatan (*ganti head, servis valve, tuning*), pemegang saat ini (tertaut ke `Member`), serta cetak **Berita Acara Peminjaman Alat** (A4 hex).
  2. **Data Ukuran & Distribusi Seragam (*Uniform Fitting*):** Simpan profil ukuran per anggota (sepatu, *bibber*/celana, jaket/*tunic*, *shako*/topi, sarung tangan, kostum *Guard*), nomor seri seragam yang dipinjamkan, serta daftar periksa pengembalian/pencucian sehabis lomba.
  3. **Manifes Logistik & *Loading Truk* 3-Tahap di Halaman `Lomba`:** Daftar periksa perlengkapan wajib yang terhubung ke sesi hari lomba dengan tiga kolom centang waktu nyata: **(1) Muat Berangkat dari Markas → (2) Cek Lengkap di Lokasi Lomba → (3) Masuk Kembali ke Gudang**. Barang yang belum tercentang saat pulang langsung ditandai merah.
* **Dampak Data:** Store baru Dexie `inventaris` & `logistikLomba` + profil ukuran opsional.

#### `#19` — Mode Kirab / *Street Parade* & *Display* Barisan Jalan Raya
* **Masalah yang diselesaikan:** Banyak unit marching band & drum band di Indonesia (PDBI, kirab HUT daerah/nasional, lomba mata lomba *Street Parade*) tampil di jalan raya memanjang, bukan hanya di lapangan persegi *field show*.
* **Ruang lingkup pengerjaan:**
  1. **Kanvas Jalan Raya & Susunan Banjar × Saf:** Preset lapangan tipe **Jalan Parade** (lebar jalan dalam meter, mis. `6 m` / `8 m` / `12 m`, garis tepi jalan, zona Panggung Kehormatan/Juri), serta penyusun cepat barisan pokok (*Drum Major/Gitapati → Spanduk → Guard → Brass → Battery* dalam susunan banjar × saf dengan jarak antar-baris terukur).
  2. **Simulasi Tikungan & Penghormatan VIP:** Templat gerak *wheel turn / gate turn* di tikungan 90° dan formasi *display* singkat di depan panggung kehormatan tanpa membubarkan urutan defile.
  3. **Kalkulator Ketukan & Kecepatan Rute Parade:** Hitung otomatis waktu tempuh, jumlah pengulangan lagu/*street beat*, dan cadangan napas berdasarkan panjang rute (km/meter), panjang langkah, serta tempo BPM.
* **Ukuran:** Sedang.

---

### Gelombang 4 — Kejuaraan, Rekrutmen, Administrasi Unit, & Arsip Musim (`v2.0`)

#### `#20` — Simulasi Penilaian Juri (*Caption Recap Sheet*) & *Judge Tape* Berpenanda Waktu
* **Masalah yang diselesaikan:** Saat evaluasi *run-through* mingguan atau *preview show* mengundang juri tamu, komentar suara dan lembar angka *caption* masih terpisah dari garis waktu drill & musik.
* **Ruang lingkup pengerjaan:**
  1. **Templat *Caption Recap* Kejuaraan:** Pilih skema penilaian standar (*Field Show / GPMB / IDCA / DCI*, *Indoor Winds / Percussion / Guard*, atau kustom unit) lengkap dengan sub-caption (*Achievement* vs *Composition/Repertoire*, *General Effect*, *Music*, *Visual*, *Color Guard*, dan pengurangan *Penalties*).
  2. **Perekam *Judge Tape* Tertaut Set & Birama:** Saat *run-through* diputar (atau direkam langsung di lapangan), juri/pelatih menekan rekam suara atau mengetik catatan cepat; setiap catatan otomatis ditempeli cap detik penampilan → dipetakan ke **Nomor Set & Nomor Birama** saat itu. Staf bisa memutar ulang komentar tepat pada set yang dimaksud.
  3. **Grafik Tren Skor Simulasi Tim:** Pantau kenaikan skor tiap *caption* dari simulasi ke-1 hingga H-1 kejuaraan beserta cetak lembar rekap A4 resmi.
* **Ukuran:** Sedang–Besar.

#### `#21` — Audisi Anggota Baru, Administrasi Unit (Surat Dispensasi, Medis, Kas TC), & Arsip Musim
* **Masalah yang diselesaikan:** Melengkapi kebutuhan manajerial pengurus unit marching band Indonesia sepanjang satu siklus kepengurusan penuh dari penerimaan anggota baru hingga penutupan musim.
* **Ruang lingkup pengerjaan:**
  1. **Modul Audisi & Seleksi (*Open Recruitment*):** Daftar *Calon Anggota* terpisah dari anggota aktif, pilihan minat seksi ke-1/ke-2, lembar penilaian tes audisi (*ritmik, kepekaan nada, postur & langkah, koordinasi alat*), peringkat per peminatan, dan tombol **1-Klik Luluskan ke Anggota Aktif**.
  2. **Generator Surat Izin / Dispensasi Resmi (Cetak A4 Hex):** Simpan data asal kelas/jurusan/fakultas/instansi anggota dan kop surat unit; pilih rentang tanggal TC/lomba dan peserta → hasilkan dokumen surat izin kolektif (otomatis dikelompokkan per sekolah/fakultas tujuan) siap cetak/simpan PDF tanpa server.
  3. **Kartu Medis & Kontak Darurat (Khusus Pelatih/Tim Medis):** Catatan golongan darah, alergi makanan/obat, riwayat asma/cedera, dan nomor darurat orang tua/wali yang siap dibuka cepat secara offline saat insiden di lapangan. **Pagar privasi keras:** data medis dijamin **tidak pernah** dimasukkan ke `ShareBundle` maupun `terbit.ts`.
  4. **Buku Kas & Iuran Kegiatan/TC Sederhana:** Pencatatan iuran wajib/cicilan anggota (kas rutin, konsumsi TC, transportasi lomba) beserta rekap tunggakan dan cetak kartu bukti bayar offline.
  5. **Arsip Lintas-Musim (*Season Rollover*):** Bekukan seluruh jadwal, absensi, drill, lagu, evaluasi, dan skor simulasi satu musim kejuaraan ke dalam berkas/ruang **Arsip Musim** baca-saja, lalu mulai musim baru secara bersih dengan tetap mempertahankan anggota aktif & inventaris alat.
* **Ukuran:** Besar (dapat dipecah menjadi `#21a` Audisi, `#21b` Dispensasi & Medis, `#21c` Kas & Arsip Musim saat akan dikerjakan).

---

## 5. Peta Dampak Skema IndexedDB (`Dexie`) & Pagar Privasi Berkas

Saat `v1.0.0`, `src/db/db.ts` berada pada **versi 10** (`16` tabel/store), dan per `v1.1.2` (`#15`) berada pada **versi 12** (`19` tabel/store: `+ targetSetoran`, `+ setoran`, `+ logPerubahan`). Agar seluruh data pengguna dijamin aman tanpa risiko hilang saat *upgrade*, pengembangan `#12`–`#21` wajib mematuhi aturan migrasi **tambah-murni (*additive-only*)**:

| Rancangan | Perubahan Store Dexie (`v11+`) | Ikut Backup Lengkap ZIP? | Ikut Paket Anggota (`.dkp` / `ShareBundle`)? | Catatan Privasi & Ukuran |
| :--- | :--- | :---: | :--- | :--- |
| **`#12`** | *Tidak ada perubahan skema (`v10`)* | — | — | Murni optimasi kode, UI, & CI |
| **`#13`** | *Tidak ada tabel baru* (memakai `partiturBerkas` & `rekamanAudio`) | Ya (sudah di `#6` & `#11a`) | **Ya, opsional bersaklar** (partitur dipangkas ke instrumen penerima) | Menjaga paket anggota tetap ringan |
| **`#14`** | `v11`: `+ targetSetoran`, `+ setoran` *(Selesai)* | Ya | **Ya (`targetSetoran` publik tim; `setoran` khusus milik penerima, terenkripsi di `#2`)** | Anggota hanya melihat setoran dirinya |
| **`#15`** | `v12`: `+ logPerubahan` *(Selesai)* | Ya | **Ya** (`perubahanPaket` ringkasan perubahan show publik tim) | Tidak memuat evaluasi/catatan privat |
| **`#16`** | Kolom opsional di `DrillSet` / `DrillPoint` / `FieldMarker` | Ya | **Ya** (bagian dari definisi drill) | Drill lama tanpa kolom baru tetap jalan identik |
| **`#17`** | `+ countSheets` (hitungan *Color Guard* per lagu/drill) | Ya | **Ya** (tampil otomatis bagi seksi *Guard*) | Ringan (JSON teks murni) |
| **`#18`** | `+ inventaris`, `+ logistikLomba` + ukuran seragam opsional | Ya | Hanya info alat/seragam milik penerima sendiri | Daftar aset keseluruhan tetap di pelatih |
| **`#19`** | Preset & opsi `FieldConfig` baru (*parade*) | Ya | **Ya** (mengikuti data drill) | Kompatibel mundur dengan `field.ts` |
| **`#20`** | `+ penilaianLomba`, `+ judgeTapeAudio` (Blob) | Ya (JSON + folder `judgetape/` di ZIP) | **Tidak** (khusus evaluasi staf pelatih) | Rekaman suara diisolasi di store Blob terpisah |
| **`#21`** | `+ audisi`, `+ medisAnggota`, `+ kasIuran`, `+ arsipMusim` | Ya (dengan opsi sandi/terpisah untuk medis) | **TIDAK PERNAH** untuk medis, nilai audisi, & kas keseluruhan | Pagar privasi diuji dengan asersi otomatis di `qa/` |

---

## 6. Rekomendasi Langkah Pertama Saat Siap Memulai

1. **Mulai dari `#12` (`v1.0.1`):** Risiko nol terhadap data pengguna, langsung memangkas ukuran unduhan awal aplikasi >35%, merapikan navigasi HP pelatih, memecah berkas komponen raksasa, dan menghemat menit CI GitHub Actions untuk semua PR berikutnya.
2. **Lanjutkan ke `#13` dan `#14` (`v1.1`):** Langsung menuntaskan kebutuhan latihan harian paling nyata — anggota bisa membuka partitur seksinya & berlatih intonasi di HP masing-masing, sementara pelatih seksi bisa menagih setoran hafalan (*pass-off*) secara terukur.
