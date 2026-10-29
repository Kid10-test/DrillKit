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
| **#12** | Polesan Performa Bundel, Navigasi Mobile Pelatih, Modularisasi, & CI | `v1.0.1` | Sedang | Pangkas JS awal >35%, laci menu HP, pecah komponen besar, hemat CI | Fondasi sebelum fitur `v1.1+` |
| **#13** | Partitur Per-Suara & Audio Panduan di Paket Anggota + Sintesis Nada & Drone | `v1.1` | Sedang–Besar | Anggota bisa baca partitur seksinya, putar bunyi notasi/rekaman, & latih intonasi | Melanjutkan `#2`, `#6`, `#11c–d` |
| **#14** | Matriks Setoran Hafalan (*Music & Visual Pass-Off Tracker*) | `v1.1` | Sedang | Pelacakan hafalan per segmen lagu × anggota untuk pelatih seksi & *Section Leader* | Tersambung ke `songs`, `Share`, `#2` |
| **#15** | Sinkronisasi Multi-Pelatih Seksi & Log Perubahan Show (`I1`) | `v1.1` | Sedang | Alur 1-klik setoran asisten → pelatih kepala + catatan revisi show otomatis | Melanjutkan `pindah.ts` & `riwayat` |
| **#16** | Koreografi Visual Lanjut: Jalur Per-Kelompok, *FTL*, *Hold/Ripple*, & *Moving Props* | `v1.2` | Besar | Gerak per kelompok/pemain, *Hold* + simbol visual di buku saku, properti bergerak | Melanjutkan `DD2`, `DD10b`, `A7`, `#12c` |
| **#17** | Lembar Hitungan *Color Guard* (*Count Sheet*) & Buku Saku Visual | `v1.2` | Sedang | Kerja alat *Guard* per *8-counts* sinkron birama/set, cetak A4/A5, & Mode Anggota | Tersambung ke `Drill`, `Song`, `#13` |
| **#18** | Inventaris Alat, Seragam (*Uniform Fitting*), & Manifes Logistik Lomba | `v1.2` | Sedang–Besar | Lacak aset/kondisi alat, ukuran seragam anggota, & *checklist* truk 3-tahap di Hari H | Tersambung ke `Members` & `Lomba` |
| **#19** | Mode Kirab / *Street Parade* & *Display* Jalan Raya | `v1.2` | Sedang | Kanvas jalan memanjang, barisan banjar × saf, belok tikungan, & kalkulator rute | Melanjutkan `field.ts` (`#9`) |
| **#20** | Simulasi Penilaian Juri (*Caption Recap*) & *Judge Tape* Berpenanda Waktu | `v2.0` | Sedang–Besar | Skor *caption* standar lomba, grafik *run-through*, & komentar suara tertaut set/bar | Tersambung ke `Lomba`, `Drill`, `Song` |
| **#21** | Audisi Anggota Baru, Administrasi Unit (Dispensasi, Medis, Kas TC), & Arsip Musim | `v2.0` | Besar | Seleksi angkatan baru, cetak surat izin resmi, kartu medis darurat, kas, & arsip musim | Menyempurnakan siklus tahunan tim |

---

## 4. Rincian Rancangan per Gelombang

---

### Gelombang 1 — Pemeliharaan, Performa, & Ergonomi (`v1.0.1`)

#### `#12` — Polesan Performa Bundel, Navigasi Mobile Pelatih, Modularisasi, & Efisiensi CI
* **Masalah yang diselesaikan:** Halaman awal memuat modul impor berkas yang belum dipakai, bilah bawah HP pelatih terlalu panjang untuk 11 menu, dan lima berkas utama terlalu besar untuk dirawat jangka panjang.
* **Ruang lingkup pengerjaan:**
  1. **Pemangkasan Bundel Utama (`12a`):** Ubah `PratinjauGlobal` dan `LapisanSeretBerkas` di `Layout.tsx` menjadi komponen *lazy-loaded* (hanya memuat logika berat `bukaBerkas`/`pyware`/`partitur`/`zip` saat pengguna menyeret berkas atau mengeklik tombol *Buka berkas*); seragamkan impor `src/lib/ucap.ts`. Target bundel JS awal turun dari `537 kB` ke **< 320 kB**.
  2. **Laci Navigasi HP & Ergonomi Sentuh (`12b`):** Di layar `< 1024px` pada Mode Pelatih, tampilkan 4 menu paling sering dipakai di lapangan (*Beranda, Absensi, Drill, Musik*) ditambah tombol **Lainnya** yang membuka laci menu lengkap tanpa geser horizontal sempit. Naikkan tinggi minimum tombol sekunder di tampilan HP menjadi `≥ 36 px` dan lengkapi atribut `htmlFor`/`id` atau `aria-label` pada kontrol form.
  3. **Modularisasi Komponen Raksasa (`12c`):** Pecah `DrillEditor.tsx`, `Music.tsx`, dan `Share.tsx` menjadi modul/komponen bagian yang bersih (mis. bilah alat kanvas, panel properti set, penggaris garis waktu, tab anggota) tanpa mengubah perilaku maupun antarmuka uji yang sudah ada.
  4. **Pembaruan CI (`12d`):** Perbarui `actions/checkout` dan `actions/setup-node` ke versi runtime Node 24 serta tambahkan `paths-ignore: ['**.md']` pada `.github/workflows/ci.yml` agar suntingan dokumentasi tidak menguras jatah menit CI bulanan.
* **Ukuran:** Sedang (dapat dijadikan 1–2 PR bersih tanpa perubahan versi IndexedDB).

---

### Gelombang 2 — Jembatan Musik, Latihan Mandiri, & Kolaborasi Staf (`v1.1`)

#### `#13` — Partitur Per-Suara & Audio Panduan di Paket Anggota + Bunyi Notasi & Drone Penala
* **Masalah yang diselesaikan:** Saat ini di Mode Anggota, pemain menerima peta tempo lagu dan daftar set list, tetapi belum bisa membuka lembar partitur instrumennya langsung dari paket anggota (`.dkp` / `ShareBundle`) tanpa mengimpor berkas MusicXML terpisah, belum bisa membunyikan notasi untuk mengecek nada sulit, dan penala belum memiliki bunyi referensi (*drone*).
* **Ruang lingkup pengerjaan:**
  1. **Partitur Tersaring di Paket Anggota:** Saat menerbitkan paket grup (`terbit.ts`) atau mengekspor berkas berbagi (`Share.tsx`), sediakan saklar **"Sertakan partitur lagu"**. Untuk berkas per-anggota, pangkas MusicXML secara otomatis hanya ke *part* instrumen/seksi penerima menggunakan `partiturBagian.ts` sehingga ukuran berkas tetap ringan (puluhan KB). Untuk paket grup terbitan repo GitHub (`#2`), simpan partitur per lagu dengan penanda *hash* agar HP anggota hanya mengunduh partitur yang berubah.
  2. **Opsi Audio Referensi Hemat Kuota:** Sediakan opsi menyertakan audio panduan terkompresi di paket lokal ZIP anggota atau penautan cerdas berbasis sidik jari SHA-256 (`#6`) yang lebih mulus di Mode Anggota.
  3. **Sintesis Bunyi Partitur Ringan (*WebAudio Note Playback*):** Tambahkan tombol *"Bunyikan suara ini"* di `LayarPartitur` menggunakan osilator WebAudio terukur (tanpa sampel audio ber-MB) yang mengikuti peta tempo, *loop* frasa `#11d`, dan *tempo latihan* `#4` agar anggota bisa belajar ritme & interval nada secara mandiri.
  4. **Generator *Drone* Nada Referensi di Penala:** Tambahkan penghasil nada tahan (*sustained pitch drone* murni + kuinta) di tab Penala (mendukung transposisi `C / Bb / Eb / F`, frekuensi dasar A4 `440–444 Hz` sesuai stelan tim) untuk latihan intonasi *Brass* & *Pit*.
* **Ukuran:** Sedang–Besar.

#### `#14` — Matriks Setoran Hafalan (*Music & Visual Pass-Off Tracker*)
* **Masalah yang diselesaikan:** Evaluasi 4-aspek (`H2`) bagus untuk rapor bulanan, dan centang `Kemajuan` (`K3`) bagus untuk menandai set formasi yang sudah dilatih bersama, tetapi pelatih seksi & *Section Leader* belum punya alat untuk menagih **tanggungan setoran hafalan per potongan lagu** tiap pemain.
* **Ruang lingkup pengerjaan:**
  1. **Daftar Target Setoran (*Checkpoints*):** Pelatih menetapkan target setoran dari lagu/segmen yang sudah ada (mis. *Lagu 1: Birama 1–16*, *Birama 17–36*, *Cadence*, atau *Warm-up Brass*) beserta tenggat tanggal opsional.
  2. **Jenjang Status Bertahap:** Tiap sel `[Anggota × Target]` memiliki jenjang yang dapat diketuk cepat: `Belum` → `Baca Lancar` → `Tempo Latihan` → `Tempo Asli` → `Hafal Musik` → `Lulus Sambil Gerak` (beserta tanggal lulus, penguji, dan catatan singkat).
  3. **Mode Uji Cepat *Section Leader*:** Tampilan daftar per seksi di HP yang bisa memutar *loop* frasa lagu (`#11d`) sambil langsung mengetuk status kelulusan pemain di depannya.
  4. **Papan Kesiapan Tim & Kartu Anggota:** Grafik % kesiapan hafalan per seksi/lagu di halaman Evaluasi & Dashboard, cetak matriks A4 hex untuk ditempel di ruang latihan, serta daftar tanggungan pribadi di Mode Anggota (ikut terkunci dengan kunci pribadi `#2`).
* **Dampak Data:** Store baru Dexie `setoran` (penambahan murni tanpa mengubah store lama).

#### `#15` — Kolaborasi Multi-Pelatih Seksi & Log Perubahan Show (`I1`)
* **Masalah yang diselesaikan:** Di lapangan, asisten pelatih (*Brass, Battery, Pit, Color Guard*) mencatat absensi, evaluasi, dan setoran hafalan di perangkat masing-masing, lalu kerepotan menyatukannya ke laptop Pelatih Kepala. Di sisi lain, saat desainer drill/musik mengubah formasi atau birama, staf & anggota sering tidak sadar titik mana saja yang berubah (kandidat lama `I1`).
* **Ruang lingkup pengerjaan:**
  1. **Alur 1-Klik *"Kirim Setoran Seksi"* & *"Gabung Setoran Asisten"*:** Di atas mesin `pindah.ts`, tambahkan pintasan khusus asisten pelatih untuk mengekspor hasil kerja hari/minggu itu (dibatasi otomatis ke seksi miliknya: absensi, evaluasi, setoran `#14`, catatan anggota, centang `kemajuan`). Saat dibuka di perangkat Pelatih Kepala lewat pintu `#7`, tampilkan ringkasan penggabungan per seksi dan selesaikan bentrokan secara transparan tanpa menimpa seksi lain.
  2. **Log Perubahan Show Otomatis (`I1`):** Bandingkan revisi drill/lagu terhadap terbitan/snapshot sebelumnya untuk menghasilkan daftar perubahan berbahasa manusia (mis. *"Set 8–11: posisi Trumpet T1–T6 berubah > 2 langkah; Set 14 dipecah menjadi 14 & 14A; Lagu 2: tempo Segmen B berubah 132 → 140 BPM"*). Ikutkan ringkasan perubahan ini saat menerbitkan paket anggota baru sehingga kartu **"Apa yang berubah di paket ini"** langsung tampil di HP anggota.
* **Ukuran:** Sedang.

---

### Gelombang 3 — Koreografi Visual, *Color Guard*, Parade, & Logistik (`v1.2`)

#### `#16` — Koreografi Visual Lanjut: Jalur Per-Kelompok, *FTL*, *Hold/Ripple*, Simbol Visual, & Properti Bergerak
* **Masalah yang diselesaikan:** Saat ini `GerakSet` (`DD2`: lurus/lengkung/busur/tunda) masih berlaku seragam untuk satu set atau per seksi utuh, belum mendukung dua sub-kelompok yang bergerak berbeda gaya di set yang sama, belum ada *Follow-the-Leader*, belum ada penanda *Hold* & simbol koreografi di buku saku, serta `FieldMarker` (`A7`) masih terkunci diam di seluruh set.
* **Ruang lingkup pengerjaan:**
  1. **Gerak Per-Kelompok & *Follow-the-Leader* (FTL):** Izinkan override jalur pada himpunan pemain terpilih di dalam satu `DrillSet` (termasuk gerak berantai mengikuti jejak pemimpin barisan dengan jarak langkah tetap).
  2. **Alat Bentuk Cepat (*Shape Generators*):** Alat bantu susun cepat di editor: *Arc/Kurva*, *Lingkaran*, *Grid Blok*, *Company Front*, serta *Mirror/Flip* kiri-kanan atau depan-belakang dengan pratinjau langsung.
  3. **Pembagian *Move + Hold*, *Ripple*, & Simbol Visual/Tanduk:** Dukungan pembagian hitungan di dalam satu set (mis. *"Jalan 12 + Hold 4"* tanpa wajib memecah set), penugasan grup *Ripple* (`A/B/C/D` atau berurutan 1..N), dan ikon instruksi visual per set (*Horn Up, Horn Snap, Mark Time, Lunge, Hadap Penonton, Choreo*) yang otomatis tercetak di **Dot Sheet & Buku Saku** serta tampil di Mode Anggota.
  4. **Properti Bergerak (*Moving Props*) & Tata Letak *Pit*:** Perluas `FieldMarker` agar opsional memiliki koordinat & sudut rotasi per `setId` (interpolasi mulus di editor & presenter) beserta penunjukan kru dorong properti.
* **Ketergantungan:** Disarankan sesudah `#12c` (pemecahan `DrillEditor.tsx`) agar kode editor tetap bersih dan ringan.

#### `#17` — Lembar Hitungan *Color Guard* (*Count Sheet*) & Buku Saku Visual
* **Masalah yang diselesaikan:** Pemain musik memiliki partitur (`#11`) dan pemain baris memiliki *dot sheet*, tetapi seksi *Color Guard* belum memiliki lembar kerja koreografi per 8-hitungan (*count sheet*) yang terikat ke musik dan set formasi.
* **Ruang lingkup pengerjaan:**
  1. **Editor *Count Sheet* Terikat Set & Birama:** Susun koreografi per blok hitungan (biasanya *8-counts* atau mengikuti panjang `DrillSet`): jenis alat (*Flag, Rifle, Sabre, Swing Flag, Dance, Prop*), teknik kerja (*Drop Spin, Peggy, Toss 45, Single/Double/Triple/Quad, Exchange*), hitungan aksen/*catch*, arah hadap, dan catatan posisi tangan.
  2. **Cetak A4 & Buku Saku *Guard* (Hex Murni):** Cetak lembar *Count Sheet* gabungan koordinat titik + hitungan kerja alat dalam format A4 atau buku saku A5 siap lipat.
  3. **Tampilan *Count Sheet* Sinkron di Mode Anggota:** Anggota seksi *Color Guard* melihat hitungan aktif yang tersorot otomatis mengikuti ketukan metronom atau rekaman lagu.
* **Ukuran:** Sedang.

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

Saat ini `src/db/db.ts` berada pada **versi 10** (`16` tabel/store). Agar seluruh data pengguna `v1.0.0` dijamin aman tanpa risiko hilang saat *upgrade*, pengembangan `#12`–`#21` wajib mematuhi aturan migrasi **tambah-murni (*additive-only*)**:

| Rancangan | Perubahan Store Dexie (`v11+`) | Ikut Backup Lengkap ZIP? | Ikut Paket Anggota (`.dkp` / `ShareBundle`)? | Catatan Privasi & Ukuran |
| :--- | :--- | :---: | :--- | :--- |
| **`#12`** | *Tidak ada perubahan skema (`v10`)* | — | — | Murni optimasi kode, UI, & CI |
| **`#13`** | *Tidak ada tabel baru* (memakai `partiturBerkas` & `rekamanAudio`) | Ya (sudah di `#6` & `#11a`) | **Ya, opsional bersaklar** (partitur dipangkas ke instrumen penerima) | Menjaga paket anggota tetap ringan |
| **`#14`** | `+ setoran` (target & status *pass-off*) | Ya | **Ya (khusus milik penerima, terenkripsi di `#2`)** | Anggota hanya melihat setoran dirinya |
| **`#15`** | `+ logPerubahan` (atau kolom ringkas di `riwayat`/terbitan) | Ya | **Ya** (ringkasan perubahan show publik tim) | Tidak memuat evaluasi/catatan privat |
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
