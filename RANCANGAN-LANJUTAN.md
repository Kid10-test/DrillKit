# DrillKit — Rancangan lanjutan (hasil diskusi 26 Sep 2026, pemutakhiran 28 Okt 2026 — #1 s.d. #11 selesai penuh)

> **Catatan Pasca-`v1.0.0`:** Seluruh rancangan `#1` s.d. `#11d` di dokumen ini telah selesai penuh pada rilis stabil `v1.0.0`. Untuk rencana pengembangan generasi berikutnya (`#12` s.d. `#21`), lihat **[`PETA-JALAN-v2.md`](./PETA-JALAN-v2.md)**.

Dokumen ini merangkum delapan rancangan awal yang sudah didiskusikan dan
diputuskan bersama pelatih, ditambah tiga usulan baru pasca PR #14
(grid/patok yard–meter custom, impor Pyware, partitur full score/per instrumen)
— total sebelas rancangan.
Semuanya siap dikerjakan di sesi baru. Setiap rancangan dijadikan PR
tersendiri, sesuai kebiasaan proyek (satu ide = satu commit/PR,
disertai uji dan catatan di `IDE-PENGEMBANGAN.md`).

**Status per 28 Okt 2026 (seluruh #1 s.d. #11d selesai penuh):**
- **#1, #2, #3, dan #4 telah rampung penuh** (PR #6 hingga PR #10).
- **#5 telah rampung penuh** — fondasi tempo map custom per ketuk/subdivisi
  dan ramp eksplisit terintegrasi lewat **PR #14** (`TempoTimeline`), lalu
  sisanya (garis waktu musik × drill, bantuan hitungan, pecah/gabung set)
  diselesaikan 4 Okt 2026: penggaris hitungan dua baris + tanda ⚡, bantuan
  hitungan + tombol Pas ke batas segmen, panjang segmen dalam hitungan drill
  di editor lagu, serta pecah/gabung set ber-riwayat formasi.
- **#6 Rekaman lagu (MP3) telah rampung penuh** (PR #11 + susulan PR #12,
  28 Sep 2026).
- **#7 selesai (5 Okt 2026)** — satu pintu "Buka berkas DrillKit" (deteksi isi, pratinjau, pengarahan, tolak paket di mode pelatih), nama berkas jelas, Data sebagai pusat.
- **#8 selesai (6 Okt 2026)** — PIN pelatih tim (`PIN_PELATIH` → hash PBKDF2 saat build), kartu Saya pelatih ber-PIN, diingat per perangkat, perangkat lama ditanya sekali, ganti PIN menanya ulang, Mode pelatih menerima PIN tim atau kios, tanpa env = perilaku lama.
- **#9 selesai penuh (3 Okt & 28 Okt 2026)** — toggle satuan tampil tiga arah (`yard` / `meter` / `langkah`, internal tetap yard tanpa geser), jarak grid & subgrid kustom dengan hitungan garis otomatis dari `fieldBox`, palet warna hex murni (`WARNA_GARIS_GRID`) & ketebalan garis proporsional, pratinjau SVG lapangan langsung di `FieldConfigEditor` mengikuti warna lapangan & skala titik, satuan jarak patok `langkah` / `yard` / `meter` (selaras di `daftarPatok` & `patokRef`), serta opsi cepat + preset **"Indoor tanpa patok"**; teruji di `grid-patok-logika.mjs` (67 butir) & `lapangan-ui.mjs` (33 butir).
- **#10 Impor drill Pyware selesai (6 Okt 2026)** — satu arah Pyware/Excel →
  DrillKit lewat CSV lembar koordinat: kolom dikenali per peran, satuan &
  asal Y ditebak lalu bisa diganti, pratinjau + peringatan titik di luar
  lapangan, pencocokan anggota #1 yang diingat, interpolasi lurus antar set,
  Gabung/Timpa/Salinan, undo lewat riwayat, dan jenis `csv-pyware` di pintu #7.
- **#11a Partitur: simpan, kenali, dan bawa MusicXML/PDF selesai (22 Okt 2026)** —
  deteksi isi & pemindai ringkasan murni (`partitur.ts`), store Dexie versi 10
  `partiturBerkas` + metadata `Song.partitur`, jenis `'partitur'` di pintu #7
  (diizinkan di mode anggota; gagal ringkas tetap dipasang D4),
  `PanelPartitur` + kuota/`persist()` di halaman Musik, dan round-trip ZIP
  (`partitur/…` + manifest).
- **#11b Partitur: render *full score* offline (OSMD), lembar PDF, & dukungan `.mxl` selesai (23 Okt 2026)** —
  pengurai `.mxl` murni via Central Directory ZIP + `DecompressionStream('deflate-raw')`
  (`mxl.ts`, termasuk *data descriptor* bit 3 & batas anti-*zip-bomb* 8 MB) yang
  terhubung ke pintu #7 (`kenaliBerkasAsync`) dan `PanelPartitur` (disimpan sebagai
  XML tak terkompresi), pembungkus *lazy-load* `opensheetmusicdisplay@2.2.1`
  (`partiturRender.ts`: chunk terpisah, render bertahap `renderNext`, palet hex murni
  `#ffffff`/`#0f172a` bebas `oklch()`/`color-mix()`, normalisasi entitas HTML +
  transposisi `<score-timewise>` → `<score-partwise>` sehingga berkas D4 tetap
  terender), serta komponen `LayarPartitur` (zoom `60%`–`160%`, tata letak halaman /
  mendatar, layar penuh, penanganan galat ramah + unduh asli, dan penampil PDF
  anti-buntu tanpa memuat OSMD).
- **#11c Partitur: filter *part* per instrumen/section, pencocokan cerdas anggota, & cetak/unduh HTML murni hex selesai (24 Okt 2026)** —
  kamus klasifikasi instrumen dwibahasa + pemetaan ke `SectionDef` tim + pilihan
  awal cerdas anggota + simpanan per lagu (`partiturBagian.ts`), penyaringan
  `Instrument.Visible` + `Staff.Visible` + `osmd.updateGraphic()` (termasuk
  penggabungan istirahat multi-birama otomatis & lebar penuh 1-*part*) serta
  perender paginasi lepas-layar `A4_P` / `A4_L` / `A5_L` Lyre (`partiturRender.ts`),
  penyusun dokumen HTML cetak mandiri berpalet hex murni dengan injeksi `viewBox`
  SVG dan bilah `.no-print` (`partiturCetak.ts`), modal `PratinjauCetakPartitur`
  anti-buntu (`Unduh HTML` + `cetakAtauUnduh`), serta perbaikan `simpanPaketAnggota`
  agar lagu & set list dalam paket berkas lokal anggota langsung masuk ke
  `db.songs`/`db.setlists`.
- **#11d Partitur: highlight birama sinkron `TempoTimeline`, pilih/loop frasa, & tautan frasa ↔ set drill selesai (25 Okt 2026)** —
  pemetaan kotak piksel `<g.vf-measure>` OSMD termasuk istirahat multi-birama
  (`partiturRender.ts`, `partiturFrasa.ts`), lapisan sorot aktif + pita frasa
  berpalet hex/rgba murni tanpa `oklch()`/`color-mix()` beserta auto-scroll
  cerdas dan bilah putar/frasa/tempo di `LayarPartitur`, pemilihan frasa 2-ketuk
  / `Shift+klik` langsung di SVG yang diingat per lagu per perangkat
  (`useFrasaLatihan.ts`), pembungkusan batas loop tepat pada birama terakhir di
  `Metronom` + rekaman WAV `#6` (`onUlangBagian`), lencana `"Frasa 5–8 · 80%"` di
  `LayarPartitur`, `PanelLagu`, dan `KartuSetList` (termasuk fallback tanpa
  MusicXML), serta tautan `"Set 4–6 = Bar 9–16"` di `KartuSetList` dan partitur
  pendamping sinkron di `DrillEditor`.

**Aturan proyek yang tetap berlaku untuk semuanya:**

- Tetap jalan **offline**, **tanpa server sendiri**, dan **tanpa biaya** (PWA).
- Warna untuk cetak/HTML hanya **hex/rgb**, tanpa `oklch()`/`color-mix()`,
  karena laptop lama memakai `DrillKit.html`.
- Mencetak tidak pernah buntu: selalu ada pratinjau atau unduh HTML.
- Dokumen dan antarmuka dalam **Bahasa Indonesia**.
- Uji qa memakai asersi dan diakhiri `N lulus, M gagal` + kode keluar,
  lalu didaftarkan di `qa/regresi-penuh.sh`.

## Urutan yang disarankan & status pelaksanaan

| # | Rancangan | Ukuran | Status | Bergantung / catatan |
|---|---|---|---|---|
| 1 | Satu anggota, dua nama | Sedang | **Selesai (PR #6)** | Panggilan, gabung anggota, pencocokan saat impor, daftar induk |
| 2 | Terbitkan ke anggota (2 PR) | Sedang–besar | **Selesai (PR #7)** | Tahap 1 terbit materi grup; Tahap 2 kunci AES-256-GCM & data terkunci |
| 3 | Jadwal: kalender & agenda | Sedang | **Selesai (PR #8 & #9)** | Tahap 1 kalender/agenda/seri/cetak/.ics; Tahap 2 kalender baca-saja anggota |
| 4 | Tempo latihan | Kecil–sedang | **Selesai (PR #10)** | Persen & BPM per lagu, naik otomatis saat ulang, presenter ikut melambat, hari H asli |
| 5 | Drill × segmen lagu | Sedang | **Selesai (PR #14 + susulan 4 Okt 2026)** | Penggaris dua baris + ⚡, bantuan hitungan & Pas ke batas segmen, panjang segmen dalam hitungan, pecah/gabung set ber-riwayat |
| 6 | Rekaman lagu (MP3) | Sedang–besar | **Selesai (PR #11 + susulan PR #12, 28 Sep 2026)** | Berkas Blob IndexedDB, sidik SHA-256, waveform & titik mulai, jam rekaman sinkron |
| 7 | Pengelolaan berkas ("Buka berkas DrillKit") | Sedang | **Selesai (5 Okt 2026)** | Pintu Data+Dasbor+seret, deteksi isi (5 JSON+CSV+ZIP), pratinjau selalu, tolak paket di pelatih, Data pusat |
| 8 | PIN pelatih tim | Kecil–sedang | **Selesai (6 Okt 2026)** | Pagar mode pelatih via hash ENV; tanpa ketergantungan |
| 9 | Grid & patok yard–meter custom | Kecil–sedang | **Selesai penuh (28 Okt 2026)** | Toggle `yard`/`meter`/`langkah` tanpa geser, grid/subgrid kustom + warna/tebal hex, pratinjau SVG langsung, `satuanJarak` langkah/yard/meter, & opsi/preset Indoor tanpa patok (`67` + `33` butir uji) |
| 10 | Impor drill Pyware | Sedang | **Selesai (6 Okt 2026)** | CSV koordinat Pyware → DrillKit, pencocokan anggota reuse #1, pratinjau & undo; 146 butir uji |
| 11 | Partitur full score / per instrumen + latihan per bar/frasa | Sedang–besar | **Selesai penuh (#11a–#11d, 22–25 Okt 2026)** | #11a: Blob IndexedDB, pintu #7, ringkasan, kuota, ZIP; #11b: `.mxl` + render OSMD hex lazy-load + PDF; #11c: filter part/section + anggota + cetak HTML hex; #11d: sorot sinkron `TempoTimeline`, loop frasa, & tautan frasa↔set drill |

> **Status pelaksanaan keseluruhan (28 Okt 2026 — Rilis `v1.0.0`):**
> **Seluruh 11 rancangan (`#1` s.d. `#11d`, termasuk `#9` selesai penuh) telah tuntas 100%.**
> Panduan 1 halaman pelatih & anggota (`src/lib/panduan.ts`), dokumentasi `README.md`/`DEPLOY.md`/`RILIS-v1.0.0.md`, bundel rilis `v1.0.0` (`scripts/siapkan-rilis.sh`), serta **116 rangkaian** uji regresi di `qa/regresi-penuh.sh` (termasuk `m6-drill-rekaman` dari PR #13) telah dimutakhirkan. **I1** (log perubahan show) tetap ditunda.

---

## 1. Satu anggota, dua nama

**Masalah.** Pelatih absensi/evaluasi dan pelatih drill membuat data
anggota sendiri-sendiri dengan panggilan berbeda (mis. "Andra Pratama"
vs "Dede"), sehingga id-nya berbeda. Impor show (`src/lib/show.ts`)
hanya mencocokkan lewat **id** dan diam-diam menambah anggota baru.
Akibatnya posisi drill menempel ke "Dede", absensi dan evaluasi ke
"Andra", dan paket anggota atas nama Andra tidak berisi posisi drill.
**Di data pelatih, anggota ganda sudah ada.**

**Keputusan:** keempat bagian dikerjakan; nama yang tampil dipilih
**per perangkat**.

**Urutan pengerjaan:** 1 → 3 → 2 → 4.

1. **Nama panggilan**
   - Kolom baru `panggilan` di `Member`. Ikut di formulir anggota, CSV
     anggota, backup, dan berkas show.
   - Pengaturan per perangkat: tampilkan *Nama lengkap* atau *Nama
     panggilan*. Kalau panggilan kosong, yang tampil nama lengkap.
   - Pencarian anggota menemukan keduanya.
   - Paket anggota menulis "Andra Pratama (Dede)".
   - Cetakan resmi (laporan, kartu kehadiran) selalu memakai nama
     lengkap. *(Asumsi: belum dikonfirmasi pelatih.)*
2. **Gabungkan anggota ganda** (menu Anggota)
   - Aplikasi menyarankan pasangan yang mungkin ganda: kode chart sama,
     section sama, atau yang satu punya absensi sedangkan yang lain punya
     posisi drill.
   - Pelatih memilih yang dipertahankan. Semua rujukan dipindah:
     `attendance`, `evaluasi`, `kemajuan`, `memberNotes`,
     `DrillSet.points` dan `DrillSet.langkah` di semua drill, serta
     riwayat formasi (`RiwayatSnapshot`).
   - Kalau ada bentrokan (keduanya tercatat di sesi yang sama), yang
     dipertahankan menang dan bentrokannya dilaporkan.
   - Nama anggota yang dibuang menjadi panggilan. Id lamanya dicatat
     sebagai alias.
   - Selalu ada pratinjau dan anjuran backup lebih dulu.
3. **Pencocokan saat impor** (berkas show, data pilihan, backup)
   - Anggota yang tidak dikenal tidak lagi langsung ditambahkan. Muncul
     layar "Cocokkan anggota" dengan saran berdasarkan kode, section,
     instrumen, dan kemiripan nama.
   - Pilihan per baris: *sama dengan anggota …* atau *anggota baru*.
   - Posisi drill dipindah ke id yang dipilih, dan nama dari berkas
     disimpan sebagai panggilan kalau berbeda.
   - Pencocokan diingat (termasuk alias hasil penggabungan), jadi impor
     berikutnya langsung cocok.
4. **Daftar anggota induk**
   - Pelatih utama memegang daftar anggota. Pelatih kedua mengambilnya
     dari berkas pelatih utama dan hanya mengisi panggilan.
   - Pencocokan juga berjalan di perangkat pelatih kedua: anggotanya
     berganti id menjadi id milik pelatih utama, sehingga kedua perangkat
     memakai id yang sama.
   - Menu Data memberi petunjuk singkat tentang alur ini.

**Uji:** penggabungan dengan data lengkap (bentrokan, beberapa drill,
riwayat formasi); pencocokan saat impor show yang diingat untuk impor
berikutnya; pertukaran dua arah yang berakhir dengan id sama; paket
anggota berisi jadwal sekaligus posisi drill.

### Status: Selesai (26 Sep 2026, PR #6)

Keempat bagian telah dikerjakan penuh (commit `4a36566` / PR #6):
- **Nama panggilan**: kolom `panggilan` dan `alias` di `Member`. Pilihan
  tampilan nama di Pengaturan → Tampilan layar (*Nama lengkap* atau
  *Nama panggilan*). Pencarian anggota menemukan keduanya. Paket anggota
  menulis "Andra Pratama (Dede)". Cetakan resmi tetap nama lengkap.
- **Gabungkan anggota ganda**: Menu Anggota → *Gabungkan anggota ganda*
  dengan deteksi pasangan yang mungkin ganda (kode sama, section sama +
  satu absensi & satu drill). Resolusi bentrokan sesi, nama lama jadi
  panggilan, id lama jadi alias.
- **Pencocokan saat impor**: Layar "Cocokkan anggota" pada impor show, data
  pilihan, dan backup. Pilihan diingat lewat alias.
- **Daftar anggota induk**: Alur panduan di menu Data untuk menyelaraskan
  id anggota ke perangkat pelatih kedua tanpa merusak token QR.
- **Uji**: `qa/nama-anggota-logika.mjs` (100 lulus, 0 gagal),
  `qa/bagikan-logika.mjs` (58 lulus, 0 gagal). Terdaftar di `regresi-penuh.sh`.

---

## 2. Terbitkan ke anggota (satu tombol)

**Masalah.** Anggota sudah punya tombol **Perbarui** (mengambil
`paket.json` dari situs), tetapi pelatih harus mengunduh paket, meng-commit
`paket.json` ke repo, lalu menunggu Vercel menerbitkan ulang.

**Keputusan:**
- Data pribadi **ikut, dikunci (dienkripsi) per anggota**.
- Di HP anggota: **beri tahu, anggota yang menekan**.
- Pelatih bersedia membuat token GitHub sekali.

**Dikerjakan sebagai 2 PR:**
- **PR 1:** tombol Terbitkan, pemberitahuan di HP anggota, dan materi grup.
- **PR 2:** kunci pribadi dan data pribadi terkunci.

1. **Pengaturan sekali** (Pengaturan → Terbitkan ke anggota)
   - Langkah bergambar:
     1. buat repo publik terpisah `drillkit-materi`;
     2. buat token GitHub *fine-grained* yang hanya berhak menulis
        Contents di repo itu;
     3. tempel token di DrillKit;
     4. tekan **Uji sambungan**.
   - **Rewrite Vercel** (sekali): `/paket.json` → berkas mentah
     (`raw.githubusercontent.com`) di repo materi. Alamat bagi anggota
     tetap sama.
   - Token hanya tersimpan di perangkat pelatih (localStorage), tidak
     pernah masuk backup atau paket, dan hanya tersedia di mode pelatih.
   - Token kedaluwarsa atau ditolak harus diberi pesan yang jelas.
2. **Tombol "Terbitkan ke anggota"** (menu Berbagi)
   - Pratinjau isi: jadwal, show, lagu, jumlah anggota terkunci, dan
     daftar anggota yang belum punya kunci.
   - Menulis lewat GitHub Contents API (`PUT`, dengan `sha` berkas lama).
   - Menampilkan riwayat terbitan; versi sebelumnya bisa dikembalikan.
   - Saat offline, tombol ditolak dengan jelas. Berkas manual tetap
     tersedia sebagai cadangan.
3. **Isi berkas yang terbit**
   - Terbuka: materi grup, persis seperti paket grup sekarang.
   - Terkunci per anggota: isi yang **identik** dengan berkas per anggota
     sekarang (absensi, evaluasi, kemajuan, catatan pribadi), mengikuti
     aturan "berbagi aman" yang sudah ada.
   - Cara mengunci: AES-256-GCM lewat WebCrypto, dengan IV acak per
     anggota per terbitan. Bagian terkunci diberi kunci id anggota,
     tanpa nama.
4. **Kunci pribadi anggota**
   - Kunci acak baru, **bukan** token QR absensi.
   - Diberikan sekali lewat **QR kunci pribadi**. QR berisi alamat situs
     dengan kunci di bagian `#`, yang tidak pernah dikirim ke server.
     Bisa juga lewat berkas per anggota yang kini membawa kuncinya.
   - Tombol **Buat kunci baru** untuk kunci yang bocor.
   - Catatan jujur di aplikasi: terbitan lama di riwayat repo tetap
     terbuka dengan kunci lama.
   - Perlu dicek: `crypto.subtle` di `file://` (versi portabel). Anggota
     umumnya memakai situs HTTPS.
5. **Di HP anggota**
   - Saat dibuka dan sedang online, aplikasi memeriksa materi baru. Kalau
     ada, muncul "Ada materi baru dari pelatih (tanggal)" dengan tombol
     **Perbarui**.
   - Tanpa kunci, materi grup tetap terbuka, dengan catatan untuk meminta
     QR kunci ke pelatih.
   - Data yang dicatat anggota sendiri tidak pernah ditimpa.
   - Panduan anggota (J1) diperbarui.

**Uji:** kunci salah gagal; anggota A tidak bisa membuka data B; isi
terkunci identik dengan berkas per anggota; kunci baru menolak kunci
lama; token ditolak memberi pesan jelas; pemberitahuan materi baru
muncul.

### Status: Selesai (26 Sep 2026, 2 tahap / PR #7)

Kedua tahap telah dikerjakan penuh:
- **Tahap 1 (commit `db39bd0`)**: Pengaturan token GitHub sekali di
  Pengaturan → Terbitkan ke anggota, tombol "Terbitkan ke anggota" di
  menu Berbagi, rewrite Vercel `/paket.json`, dan penanda pemberitahuan
  materi baru di HP anggota.
- **Tahap 2 (PR #7, commit `88c375c`)**: Modul enkripsi AES-256-GCM
  (`src/lib/kunci.ts`), paket terbit dengan bagian terkunci per anggota
  (`src/lib/terbit.ts`), QR kunci pribadi via hash URL (`#`), tombol
  Buat kunci baru, dekripsi otomatis di HP anggota. Data pribadi (absensi,
  evaluasi, kemajuan, catatan) terkunci tanpa nama/skor terstruktur.
- **Uji**: `qa/terbit-logika.mjs` (58 lulus, 0 gagal),
  `qa/terbit-kunci-logika.mjs` (69 lulus, 0 gagal). Terdaftar di
  `qa/regresi-penuh.sh`.

---

## 3. Jadwal: kalender & agenda

**Masalah.** Halaman Jadwal (`src/pages/Schedule.tsx`) berupa daftar kartu
panjang yang selalu terbuka penuh. Tidak ada gambaran sebulan, tidak ada
fitur ulangi atau duplikat, dan kehadiran sesi yang sudah lewat tidak
ditampilkan.

**Keputusan** (pilihan yang disarankan; pelatih belum menjawab
pertanyaan rinci): tampilan **Bulan + Agenda**, **ulangi mingguan**, dan
semua tambahan **kecuali libur nasional**.

1. **Tampilan Bulan**
   - Kotak 7 kolom mulai Senin. Setiap sesi tampil sebagai label
     berwarna per jenis kegiatan, beserta jamnya. Hari ini disorot.
   - Keterangan kecil di setiap sesi:
     - sesi lewat: kehadiran %, dengan warna mengikuti ambang predikat J1;
     - sesi mendatang: checklist (3/5) dan tanda rencana latihan atau
       set list.
   - Ketuk hari untuk melihat detail: panel samping di laptop, di bawah
     kalender di HP.
   - Ketuk hari kosong untuk membuat jadwal baru dengan tanggal terisi.
   - Di HP, kalender ringkas dengan titik berwarna.
   - Tampilan bawaan: kalender di laptop, agenda di HP. Pilihan diingat
     per perangkat.
2. **Tampilan Agenda**
   - Kartu besar untuk **sesi berikutnya**, dengan hitung mundur.
   - Sesi lainnya dikelompokkan per minggu, satu baris per sesi. Ketuk
     baris untuk membuka detail, checklist, rencana, dan Pacu.
   - Sesi yang sudah lewat tersembunyi di balik "Tampilkan yang sudah
     lewat".
3. **Membuat jadwal lebih cepat**
   - **Ulangi mingguan:** hari-hari dalam seminggu, jam, dan tanggal
     akhir. Checklist dan rencana ikut tersalin.
     - Satu sesi bisa diubah sendiri.
     - Kalau seri diubah, pilihannya *hanya sesi ini* atau *semua
       berikutnya*.
     - Menghapus seri tidak pernah menghapus sesi yang sudah punya
       absensi.
   - **Duplikat sesi** ke tanggal lain.
   - **Seret-pindah** tanggal di kalender laptop, dengan undo.
4. **Tambahan**
   - Hitung mundur ke penampilan atau lomba terdekat.
   - Cetak kalender satu bulan (hex, pratinjau/unduh HTML).
   - Satu berkas `.ics` berisi semua jadwal mendatang.
   - Kalender di mode anggota, hanya untuk dilihat, dengan status
     kehadiran pribadi. Sumbernya data terkunci dari #2.

**Tidak berubah:** penyaring jenis, ekspor CSV, penanda sesi (G3), Pacu
latihan, dan pengingat (C3). Data sesi hanya bertambah satu penanda seri.

**Uji:** susunan minggu mulai Senin dan pergantian tahun; seri sampai
tanggal akhir; *ubah sesi ini* vs *semua berikutnya*; sesi berabsensi
tidak terhapus; tampilan HP 360 px; seret-pindah dengan undo; cetak;
kalender anggota.

### Status: Selesai (27 Sep 2026, PR #8 & PR #9)

Kedua tahap telah dikerjakan penuh:
- **Tahap 1 (PR #8, commit `5bdcd54`)**:
  - Halaman Jadwal (`src/pages/Schedule.tsx`): 3 tab tampilan (Bulan,
    Agenda, Daftar).
  - Tampilan Bulan: grid 7 kolom Senin–Minggu, warna predikat kehadiran
    sesi lewat, checklist sesi mendatang, penanda rencana latihan & set
    list, panel detail hari / buat jadwal terisi, titik berwarna di HP.
  - Tampilan Agenda: kartu besar sesi berikutnya + hitung mundur, sesi
    per minggu, sembunyikan sesi lewat.
  - Alur cepat: ulangi mingguan (ubah sesi ini / semua berikutnya;
    proteksi sesi berabsensi tidak terhapus), duplikat sesi, seret-pindah
    tanggal dengan tombol Batalkan (undo).
  - Ekspor `.ics` jadwal mendatang, cetak kalender sebulan (hex murni)
    dengan pratinjau / unduh HTML.
  - Modul logika: `src/lib/kalender.ts`. Kolom `seriId` pada `Session`.
  - Uji: `qa/kalender-logika.mjs` (67 butir), `qa/kalender-jadwal.mjs`
    (31 butir). Regresi jadwal lama tetap lulus.
- **Tahap 2 (PR #9, commit `0f20a89`)**:
  - Mode anggota (`src/pages/Share.tsx`, `src/main.tsx`): tab Kalender
    dan Agenda baca-saja.
  - Menampilkan jadwal dan status kehadiran pribadi (Hadir/Izin/Sakit/Alpa/Belum dicatat)
    dari data terkunci per anggota (#2).
  - Uji: `qa/kalender-anggota.mjs` (33 butir). Terdaftar di `regresi-penuh.sh`.

---

## 4. Tempo latihan

**Masalah.** Untuk berlatih lebih lambat, setiap segmen tempo map harus
diubah satu per satu, lalu dikembalikan. "Latih tempo" (`LatihTempo`)
yang sudah ada memakai angka BPM tetap, jadi tidak cocok untuk tempo map.

**Keputusan:** diingat **per lagu**; presenter drill **ikut melambat**;
"naik otomatis saat mengulang bagian" **disertakan**.

1. **Kendali tempo latihan** (dekat tombol Putar)
   - Tombol `−5%` · nilai · `+5%` · `Tempo asli`.
   - Dua mode: **persen** (bawaan, 40–150%) atau **BPM** (−60 sampai +30).
   - Diterapkan **paling akhir** pada tempo berlaku (tempo map, luncuran
     berangsur, latih tempo lama), termasuk hitung mundur. Batas bawah
     20 BPM.
   - Tanda yang jelas: lencana "Latihan 80%" dan "138 BPM (asli 172)".
     Daftar lagu dan set list juga menandainya.
   - Diingat per lagu per perangkat. Tidak mengubah data lagu dan tidak
     ikut backup atau paket.
   - Set list memakai tempo latihan setiap lagu, dengan tombol "Semua ke
     tempo asli".
   - Tersedia juga di mode anggota.
2. **Presenter drill ikut melambat**
   - Menampilkan lencana dan tombol kembali ke tempo asli.
   - Disatukan dengan pengatur kecepatan drill yang sudah ada (`view.cepat`).
   - **Layar hari H selalu memakai tempo asli** dan memberi peringatan.
     *(Asumsi: belum dikonfirmasi pelatih.)*
3. **Naik otomatis saat mengulang bagian** (M2)
   - Pengaturan: mulai 70%, naik +5%, setiap 1 putaran, sampai 100%.
     Mode BPM juga tersedia.
   - Setelah mencapai tujuan: tetap mengulang di tempo tujuan, atau
     berhenti.
   - Menampilkan "Putaran 3 · 80% → 100%". Tempo terakhir yang dicapai
     diingat.
   - Latih tempo lama tetap ada tanpa perubahan.

**Uji:** 80% dari tempo map 172 → 140 dengan luncuran berangsur menjadi
138 → 112; batas 20 BPM; naik otomatis berhenti di tujuan; nilai diingat
setelah dibuka ulang; presenter ikut melambat; layar hari H tetap asli;
mode anggota.

### Status: Selesai (27 Sep 2026, PR #10)

Seluruh rancangan telah dikerjakan penuh (commit `a7e835f` / PR #10):
- **Kendali tempo latihan**: Komponen `src/components/KendaliTempoLatihan.tsx`
  di halaman Musik (`Music.tsx`, `PanelLagu.tsx`). Dua mode: persen
  (40–150%, `−5%` / `+5%`) dan BPM (−60…+30), tombol "Tempo asli".
  Diterapkan paling akhir pada tempo berlaku, batas bawah 20 BPM.
- **Penyimpanan per lagu**: Hook `src/hooks/useTempoLatihan.ts` dan pustaka
  `src/lib/tempoLatihan.ts`. Disimpan di `localStorage` per lagu per
  perangkat (`drillkit_tempo_latihan_<laguId>`); tidak masuk backup atau
  paket berbagi. Tersedia juga di mode anggota.
- **Penanda visual & Set list**: Lencana "Latihan 80%" dan label
  "138 BPM (asli 172)" di daftar lagu, panel lagu, dan set list
  (`KartuSetList.tsx`). Durasi set list menghitung tempo latihan + tombol
  "Semua ke tempo asli".
- **Presenter drill ikut melambat**: Animasi editor (`DrillEditor.tsx`)
  dan presenter (`DrillPresenter.tsx`) melambat untuk drill yang ditautkan
  ke lagu; lencana disatukan dengan `view.cepat` + tombol "Tempo asli".
  Analitik tetap memakai tempo asli.
- **Layar hari H**: Pada `ModeLomba.tsx`, layar hari H selalu memakai
  tempo asli dan memberi peringatan bila ada tempo latihan yang aktif.
- **Naik otomatis saat ulang bagian (M2)**: Pengaturan otomatis naik
  tempo tiap N putaran hingga target tercapai (tetap/berhenti), dengan
  tampilan "Putaran 3 · 80% → 100%".
- **Uji**: `qa/tempo-latihan-logika.mjs` (34 butir), `qa/tempo-latihan.mjs`
  (26 butir), `qa/musik-anggota.mjs` (45 butir). Seluruh regresi terkait
  lulus bersih. Terdaftar di `regresi-penuh.sh`.

---

## 5. Drill × segmen lagu

**Masalah.** Set drill dan segmen lagu tidak sejajar (misalnya set 12
hitungan, segmen 18 hitungan). Ini **wajar**. Yang jadi masalah:

- Pelatih **bingung mencocokkan**, karena segmen diukur dalam birama
  sedangkan set dalam hitungan.
- Ada **kesalahan**: `petakanSetKeMusik` (`src/lib/gabungMusik.ts`)
  memakai satu tempo per set, yaitu tempo di birama tempat set mulai. Set
  yang melewati perubahan tempo berjalan dengan tempo yang salah.
  - Contoh: 6 hitungan di 120 lalu 6 hitungan di 160 seharusnya
    5,25 detik, tetapi dihitung 6 detik.
  - Selisihnya menumpuk, sehingga animasi tertinggal dari musik.

**Keputusan:** keempat bagian di bawah dikerjakan.

1. **Garis waktu musik × drill** (inti), di bawah lapangan editor drill
   saat drill ditautkan ke lagu
   - Satu penggaris hitungan dengan dua baris:
     - segmen: nama, tempo, rentang hitungan, dan rentang birama;
     - set: rentang hitungan dan birama.
   - Tanda ⚡ untuk set yang melewati perubahan tempo atau sukat, dengan
     keterangannya.
   - Bisa diketuk. Di HP penggaris bisa digeser ke samping.
2. **Bantuan mengisi hitungan set**
   - Keterangan "mulai di hitungan 13 (segmen A, birama 4), sisa segmen
     A: 6".
   - Tombol **Pas ke batas segmen**.
   - Di editor lagu, setiap segmen menampilkan panjangnya dalam hitungan
     drill.
3. **Tempo per hitungan** (perbaikan kesalahan)
   - Setiap hitungan memakai tempo musik yang berlaku, termasuk luncuran
     berangsur.
   - Berlaku untuk animasi, klik, garis waktu, durasi total, dan
     presenter.
   - Posisi pemain tetap rata per hitungan.
   - Untuk ramp berdurasi N hitungan, tempo awal berlaku tepat sebelum
     hitungan 1; hitungan 1 sudah mendapat langkah pertama dan hitungan N
     tepat mencapai tempo tujuan. Jumlah hitungan tempo dinyatakan
     eksplisit, bukan ditebak dari jumlah birama atau meter.
   - Drill tanpa set yang melewati perubahan tempo tidak berubah.
   - Presenter menampilkan "Set 2 · hitungan 7/12 · birama 5" dan
     berkedip kecil saat tempo berubah.
4. **Pecah dan gabung set** (alat bantu, tidak pernah otomatis)
   - Pecah di batas segmen atau di hitungan tertentu. Posisi peralihan
     diambil dari jalur yang sudah ada (termasuk busur), jadi animasi
     tetap identik.
   - Gabung dengan set berikutnya.
   - Keduanya masuk riwayat formasi dan bisa di-undo.

**Uji:** set 2 dalam contoh berdurasi 5,25 detik; accelerando 160 → 180
selama 8 hitungan menghasilkan 162,5; 165; 167,5; 170; 172,5; 175;
177,5; 180 BPM; ritardando 172 → 140 selama 6 hitungan mulai berubah
pada hitungan 1 dan tepat mencapai 140 pada hitungan 6; drill tanpa
perubahan tempo durasinya tetap; animasi identik setelah dipecah; garis
waktu dan ⚡; Pas ke batas segmen; undo.

### Status: Rampung (4 Okt 2026) — penggaris, bantuan hitungan, pecah/gabung set

**Sudah terintegrasi (PR #14, 1 Okt 2026):**
- Tempo map kini mendukung posisi **1-based pada birama, ketuk tertulis,
  dan subdivisi ketuk** serta ramp dengan **jumlah hitungan eksplisit**
  (satuan: ketuk tertulis / ketuk acuan BPM / subdivisi / birama; tempo
  awal opsional). Semantik: hitungan 0 = sebelum ramp, hitungan 1 sudah
  1/N, hitungan N = BPM target.
- Evaluator bersama **`TempoTimeline`** (`src/lib/tempoTimeline.ts`,
  `src/lib/tempoRamp.ts`) dipakai untuk BPM, durasi, konversi posisi/ waktu,
  serta tempo latihan. Metronom, cek klik MP3, pemetaan drill per-hitungan,
  waktu/progres lagu, rekaman, dan set list semuanya memakai evaluator ini;
  tempo map lama per birama tetap kompatibel.
- Verifikasi: `tempo-map-logika` 25, `perubahan-tempo-logika` 90,
  `uji-gabung-musik` 51, `uji-setlist` 107 — total 273 lulus.

**Sisa #5 selesai (4 Okt 2026):**
- **(1) Garis waktu musik × drill** — penggaris hitungan **dua baris** di bawah
  lapangan editor drill, muncul saat drill ditautkan ke lagu: baris **segmen**
  (nama, tempo, rentang hitungan & birama) dan baris **set** (rentang hitungan
  & birama). Set yang melewati perubahan tempo/sukat ditandai **⚡** dengan
  keterangan di bawah penggaris (mis. "melewati perubahan tempo 120 → 150 BPM
  di hitungan 5, birama 3"). Bloknya bisa diketuk untuk melompat ke set &
  hitungan itu, dan di HP penggarisnya bisa digeser ke samping.
  Modul murninya `src/lib/segmenDrill.ts` (`petaPenggaris`).
- **(2) Bantuan hitungan** — keterangan "Mulai di hitungan 13 (segmen A ·
  birama 4), sisa segmen A: 6 hitungan" + tombol **Pas ke batas segmen**
  (mengisi hitungan set supaya berakhir tepat di batas segmen; batas yang jatuh
  di tengah hitungan dibulatkan dan alasannya ikut ditulis). Di editor lagu,
  tiap segmen menampilkan panjangnya **dalam hitungan drill**; ketuk per
  hitungan diambil dari drill yang menautkan lagu itu dan sumbernya ditulis apa
  adanya supaya tidak dikira angka pasti (`panjangSegmenLagu`, `asumsiHitungan`).
- **(4) Pecah & gabung set** — pecah di batas segmen atau hitungan mana pun;
  posisi peralihan **diambil dari jalur yang sudah ada** (lurus, melengkung,
  busur) memakai fungsi animasi yang sama (`progresPemain`, `titikJalur`,
  `deltaBusur`) sehingga animasinya identik; tiap bagian menyimpan pengaturan
  jalurnya sendiri, dan busur hasil pecahan kembali utuh saat digabung
  (`gabungGerak`). Gabung melebur set berikutnya (hitungannya menjumlah).
  Keduanya memotret keadaan ke **riwayat formasi** (`sebelum-pecah-set`,
  `sebelum-gabung-set`), jadi bisa dibatalkan walau halaman sudah ditutup.
- Verifikasi: `segmen-drill-logika` **88 lulus** (murni; dirakit lewat
  `qa/bangun-logika.sh` → `rakit src/lib/segmenDrill.ts segmen`) dan
  `m1-penggaris-drill` **41 lulus** (peramban). Regresi yang menyentuh berkas
  ini tetap hijau: `uji-gabung-musik` 51, `uji-riwayat` 27, `uji-setlist` 107,
  `uji-birama` 123, `uji-panjang-lagu` 109, `tempo-map-logika` 25,
  `perubahan-tempo-logika` 90, `mode-logika` 34, `m1-tempo-lagu-drill` 20,
  `m1-sukat-segmen` 15, `m1-mode-lagu` 27, `m1-birama` 41,
  `m5-panjang-lagu-ui` 30, `tempo-latihan` 26, `uji-ulang` 41, `kartu-lipat` 48.
  Kedua rangkaian baru didaftarkan di `qa/regresi-penuh.sh`.
- Catatan: dua kelemahan uji lama ikut diperbaiki — `m1-mode-lagu` mengisi
  kolom lewat **urutan input** (kolom kedua ternyata "ketuk", bukan BPM),
  dan mengklik tombol di bawah daftar dengan koordinat mouse yang kini bisa
  jatuh ke latar modal; keduanya diganti testid + klik DOM (27/27).

> Prioritas berikutnya: **#10 → #11 → #8** (#7 selesai 5 Okt 2026).

---

## 6. Rekaman lagu (MP3)

**Keputusan:** rekaman **bertempo stabil** (render notasi atau direkam
dengan klik); dipakai **pelatih dan anggota**; rekaman dikirim
**terpisah** (WA/Drive), sedangkan paket hanya membawa pengaturan dan
sidik rekaman.

1. **Menambahkan** (Musik → lagu → Rekaman)
   - Berkas MP3, M4A, WAV, atau OGG, disimpan sebagai Blob di IndexedDB.
   - Menampilkan pemakaian memori dan meminta `navigator.storage.persist()`.
     Ada catatan khusus untuk iPhone.
   - Sidik rekaman: hash isi dan durasi.
2. **Menyelaraskan**
   - **Titik mulai** (birama 1 ketuk 1): tombol ketuk, geser ±10 ms, dan
     gambar gelombang suara.
   - Tombol **Cek bersama klik**.
   - **Koreksi per segmen** (opsional) untuk fermata atau rit.
   - Hitung mundur dimatikan saat rekaman diputar.
3. **Memutar**
   - **Rekaman menjadi patokan waktu.** Klik, penanda birama, drill, dan
     presenter mengikuti `currentTime` rekaman.
   - Pilihan bunyi: rekaman saja, rekaman + klik, atau klik saja, dengan
     dua volume.
   - Lompat birama dan ulang bagian ikut melompatkan rekaman.
   - Tempo latihan memakai `playbackRate` + `preservesPitch`. Di bawah
     70% ada catatan kualitas; kalau peramban tidak mendukung, pilihannya
     dinonaktifkan dengan penjelasan.
   - Set list memakai rekaman.
4. **Drill**
   - Editor dan presenter berjalan bersama rekaman. Menggeser garis
     waktu ikut memindah rekaman.
   - Layar hari H memakai tempo asli.
5. **Anggota**
   - "Tambahkan rekaman dari pelatih", lalu sidiknya diperiksa: ✔ sama,
     atau ⚠ berbeda.
   - Rekaman tetap ada setelah paket diperbarui.
   - Panduan anggota diperbarui.
6. **Backup**
   - Backup JSON tanpa rekaman, dan ini dinyatakan jelas.
   - Pilihan baru **Backup + rekaman (ZIP)** memakai `src/lib/zip.ts`.
   - Berkas show dan repertoar membawa pengaturan rekaman.

**Ditunda:** ketuk setiap birama untuk rekaman live, dan deteksi ketukan
otomatis.

**Uji:** MP3 buatan sendiri berisi klik di waktu yang diketahui; titik
mulai dan koreksi segmen tepat ±20 ms; ulang bagian; sinkron dengan
drill; sinkron saat diperlambat; sidik cocok dan tidak cocok;
bertahan setelah paket diperbarui; ZIP dipulihkan utuh.

### Status: Selesai (28 Sep 2026, PR #11 + susulan PR #12)

Seluruh rancangan #6 (Rekaman lagu MP3) telah dikerjakan penuh:
- **Penyimpanan Biner Blob & IndexedDB**:
  - Skema database Dexie versi 9 dengan tabel `rekamanAudio: 'id, songId, updatedAt'` (`src/db/db.ts`).
  - Tipe data `RekamanAudioMeta` dan `AudioRekamanItem` di `src/db/types.ts`.
  - Pustaka `src/lib/rekaman.ts`: fungsi `simpanRekamanAudio`, `muatRekamanAudio`, `hapusRekamanAudio`, `cekPenyimpanan`, `mintaPenyimpananPersisten`, dan deteksi peramban iOS/iPadOS dengan pengingat batas 7 hari di Safari.
- **Sidik Audio (Fingerprint) & Validasi**:
  - Hash biner SHA-256 via WebCrypto SubtleCrypto (`hitungHashAudio`) dan pembacaan durasi.
  - Validasi kesesuaian berkas audio pelatih vs unggahan anggota (`cekKesesuaianRekaman`).
- **Penyelarasan Titik Mulai (Birama 1 Ketuk 1) & Waveform**:
  - Komponen `src/components/ModalRekamanLagu.tsx`: visualisasi waveform canvas 120 bar dengan penanda garis vertikal titik mulai.
  - Tombol penanda posisi ketuk 1 dan penyesuaian halus (±10 ms, ±50 ms).
  - Tombol "Cek bersama klik" untuk memeriksa sinkronisasi audio vs beeps metronom.
  - Koreksi offset milidetik per segmen tempo untuk fermata atau ritardando live.
  - Pilihan mode bunyi (`rekaman`, `keduanya`, `klik`) dan kontrol dual volume (audio vs klik).
- **Master Waktu & Sinkronisasi Pemutaran Lagu**:
  - Singleton `PemutarRekaman` di `src/lib/rekaman.ts` dengan penanganan `playbackRate` dan pemeliharaan nada (`preservesPitch = true`).
  - Halaman Musik (`src/pages/Music.tsx`): integrasi pemutar audio dengan kontrol mulai, jeda, lompat segmen, dan loop ulang bagian (M2).
  - Set list (`src/components/KartuSetList.tsx` & `src/lib/setlist.ts`): penanda badge 🎵 untuk lagu yang memiliki rekaman audio dan pemutaran otomatis antar lagu.
- **Integrasi Drill**:
  - Scrubber garis waktu di editor (`src/components/DrillEditor.tsx`) menyinkronkan audio `currentTime` saat digeser.
  - Animasi perpindahan set di editor dan presenter (`src/components/DrillPresenter.tsx`) memutar rekaman audio set terkait.
  - Mode hari lomba / kunci layar di presenter memaksa tempo asli (100%).
- **Mode Anggota**:
  - Anggota dapat mengunggah rekaman dari pelatih ("Tambahkan rekaman dari pelatih").
  - Sistem memeriksa kecocokan sidik jari (✔ cocok / ⚠ berbeda).
  - Rekaman audio tersimpan di IndexedDB perangkat anggota secara mandiri dan tidak tertimpa saat paket tim diperbarui.
  - Panduan anggota (`src/lib/panduan.ts`) diperbarui dengan instruksi rekaman audio dan catatan PWA iPhone/Safari.
- **Backup & ZIP**:
  - `src/lib/zip.ts` diperluas dengan dukungan data biner `Uint8Array` dan fungsi dekompresi `bukaZip`.
  - Ekspor baru "Backup + rekaman (ZIP)" di `src/lib/backup.ts` dan Pengaturan (`src/pages/Settings.tsx`).
  - Pemulihan berkas backup mendukung format `.zip` otomatis mengekstrak JSON data tim dan mengembalikan seluruh rekaman audio biner.
- **Uji**:
  - Pengujian logika komprehensif `qa/rekaman-lagu-logika.mjs` (21 butir uji) mencakup sidik jari, toleransi, perhitungan detik ke birama dan sebaliknya, round-trip ZIP biner, serta integrasi set list.
  - `qa/bangun-logika.sh` memaketkan `rekaman.ts`. Seluruh 19 rangkaian uji logika lulus bersih (0 gagal).

**Susulan #6 — "klik melambat" (28 Sep 2026, PR #12):**
- Metronom kini mengikuti **jam rekaman** (`JamLagu` di `src/lib/metronome.ts`),
  bukan jam sendiri; klik mulai setelah rekaman berbunyi, tiap birama diposisikan
  dari `currentTime` rekaman, dan jadwal yang terlanjur ditanam dibatalkan saat
  rekaman digeser/diulang. Editor & presenter drill memakai `detikMulai` +
  `lajuRekaman` yang benar. Uji: `m6-klik-rekaman` 14/14, `uji-birama` 123,
  `uji-gabung-musik` 50, `rekaman-lagu-logika` 35.

---

## 7. Pengelolaan berkas ("Buka berkas DrillKit")

**Masalah.** Ada 6 pintu ekspor dan 5 jenis JSON (`drillkit-backup`,
`drillkit-data`, `drillkit-show`, `drillkit-repertoar`, `drillkit-share`),
semuanya `.json`. Nama berkas tidak jelas, dan setiap impor hanya
menerima jenisnya sendiri tanpa memberi tahu tempat yang benar. Ada juga
bahaya:

- Pulihkan backup di Pengaturan langsung menulis tanpa pratinjau.
- Pulihkan backup menerima `drillkit-share` (paket anggota), sehingga
  isi paket bisa tercampur ke data pelatih.

**Keputusan:** A + B + C; tombol impor lama **tetap ada, tapi menerima
semua jenis**.

- **A. Satu pintu "Buka berkas DrillKit"**
  - Letaknya di menu Data dan Dashboard. Di laptop, berkas bisa diseret
    ke jendela.
  - Jenis dikenali dari **isi** berkas (field `format`). CSV juga
    dikenali.
  - Selalu ada pratinjau: jenis, tanggal, isi, dan apa yang ditambah
    atau ditimpa.
  - Setiap jenis diarahkan ke alurnya: backup ke pemulihan (kini dengan
    pratinjau), data ke menu Data, show ke timpa/gabung/salinan, lagu ke
    impor repertoar.
  - Paket anggota di mode pelatih ditolak dengan jelas.
  - Pulihkan backup **tidak lagi menerima** paket anggota.
  - Mode anggota hanya menerima paket.
  - Tombol lama mengalihkan berkas yang bukan jenisnya ke pratinjau yang
    benar.
- **B. Nama berkas yang jelas** (akhiran tetap `.json`)
  - `DrillKit - BACKUP LENGKAP - 2026-09-26.json`, termasuk yang dari
    simpan otomatis
  - `DrillKit - DATA PILIHAN - …`
  - `DrillKit - SHOW <nama> - …`
  - `DrillKit - LAGU (<n> lagu) - …`
  - `DrillKit - UNTUK ANGGOTA - <Nama> <Kode>.json` dan
    `… - semua (grup).json`
  - `paket.json` di situs tetap bernama sama.
- **C. Menu Data sebagai pusat**
  - Bagian "Mau apa?" berisi: pindah semua data, kirim sebagian, kirim
    show ke pelatih lain, dan kirim ke anggota (menuju Berbagi).
  - Tombol di Drill, Musik, dan Pengaturan tetap ada sebagai jalan
    pintas.
- **Tidak dilakukan:** melebur jenis berkas. Berkas lama tetap bisa
  dibuka.

**Uji:** setiap jenis lewat pintu baru; setiap jenis lewat tombol lama
yang salah tempat; pratinjau pemulihan backup; paket anggota ditolak di
Pengaturan.
### Status: Selesai (5 Okt 2026)

- **A. Satu pintu "Buka berkas DrillKit"** — tombol di menu Data & Dashboard,
  plus seret berkas ke jendela (laptop). Modul murni `src/lib/bukaBerkas.ts`:
  JSON dikenali dari field `format` (audit: 5 nilai di kode — backup, data,
  show, repertoar, share — ditambah varian CSV & ZIP; nilai `drillkit-*` asing
  dilaporkan, tidak ditelan), CSV dari judul kolomnya, ZIP dari magic bytes
  lalu dibuka dengan `bukaZip` dan tiap entrinya dikenali lagi.
- **Selalu pratinjau** — jenis, tanggal, isi, dan baru/ditimpa; tiap jenis
  diarahkan ke alurnya (backup → pulihkan, data → menu Data, show →
  timpa/gabung/salinan, lagu → impor repertoar, CSV → halaman tujuannya).
- **Paket anggota ditolak di mode pelatih** (termasuk ZIP-nya); mode anggota
  hanya menerima paket. **Pemulihan backup tidak lagi menerima paket** dan
  tidak lagi menulis langsung — selalu lewat pratinjau (`AlurPulihkanBackup`,
  dipakai Pengaturan & pintu baru). Ekspor satu arah (laporan jadwal/absensi/
  kehadiran) dikenali dan dijelaskan, bukan disalahrute-kan.
- **Tombol lama menerima semua jenis** — berkas yang bukan jenisnya dialihkan
  ke pratinjau yang benar; impor Anggota & koordinat mempertahankan jalan
  longgar untuk berkas lama/buatan tangan.
- **B. Nama berkas jelas** — `DrillKit - BACKUP LENGKAP - ….json`,
  `… DATA PILIHAN …`, `… SHOW <nama> …`, `… LAGU (<n> lagu) …`,
  `… UNTUK ANGGOTA - <Nama> [(Panggilan)] <Kode>.json` & `… semua (grup).json`;
  `paket.json` tetap. **C. Menu Data sebagai pusat** — bagian "Mau apa?".
- **Temuan saat regresi (diperbaiki di cabang ini):** berkas show/repertoar yang drill-nya tanpa `field` memogokkan halaman Drill (`stepYd` membaca `step` dari `undefined`, lalu seluruh halaman blank sampai dimuat ulang). Kini impor show & repertoar memberi lapangan bawaan bila tidak ada, dan `DrillEditor` pun bertahan bila data di DB tidak lengkap — fixture show di `buka-berkas` sengaja tanpa `field` sebagai pengunci.
- **Uji:** `qa/buka-berkas-logika.mjs` 100 butir (deteksi 5 JSON + format
  asing + 4 CSV + 3 ZIP, aturan mode, pratinjau, 8 nama berkas) dan
  `qa/buka-berkas.mjs` (pintu baru per jenis, tombol lama salah tempat,
  pratinjau-sebelum-tulis, penolakan paket, nama unduhan) — keduanya
  terdaftar di `qa/regresi-penuh.sh`. Uji lama yang terdampak alur/nama baru
  disesuaikan (`backup-lengkap`, `backup-setlist`, `bagikan-logika`,
  `nama-anggota-logika`, `buka-paket`, `berbagi-anggota`, `f3`, `f3b`,
  `tukar-repertoar`).

---

## 8. PIN pelatih tim

**Masalah/tujuan.** Supaya mode pelatih **terasa khusus**, hanya orang
yang diberi PIN yang boleh masuk. Catatan jujur: data tim memang tidak
bisa dijangkau dari HP anggota (diuji 21 Sep; mode pelatih di HP anggota
kosong), jadi ini **pagar, bukan brankas**.

**Keputusan:** PIN disimpan di **env Vercel**; perangkat yang sudah di
mode pelatih **ditanya sekali**.

- **Pemasangan:** Vercel → Settings → Environment Variables →
  `PIN_PELATIH`, lalu Redeploy. Build mengubahnya menjadi hash
  (misalnya PBKDF2 dengan garam), sehingga PIN asli tidak pernah masuk
  bundle. Mengganti PIN caranya sama.
- **Halaman sambutan:** kartu "Saya pelatih" meminta PIN, "Saya anggota"
  tidak.
- **Diingat per perangkat** (menyimpan hash yang lolos), dan berlaku
  offline.
- **Perangkat lama di mode pelatih** ditanya sekali.
- **PIN diganti:** semua perangkat pelatih ditanya lagi. Ini cara
  menutup akses pelatih yang keluar.
- **Tombol "Mode pelatih" di mode anggota** menerima PIN tim, dan PIN
  kios perangkat tetap diterima.
- **`PIN_PELATIH` kosong:** perilaku persis seperti sekarang, termasuk
  `DrillKit.html` (kecuali dibuat ulang dengan PIN).
- **Jeda singkat setelah 5 kali salah.** Anjurkan minimal 6 angka.
- **Langkah bergambar di `DEPLOY.md`.**

**Uji:** `qa/pin-pelatih-logika.mjs` — tanpa env = perilaku lama; PIN salah
ditahan; PIN benar diingat; ganti PIN ditanya lagi; keluar mode anggota
dengan PIN tim atau PIN kios; hash PBKDF2 web = `node:crypto`; jeda setelah
5 salah. Terdaftar di `regresi-penuh.sh`. Langkah bergambar di `DEPLOY.md`.

### Status: Selesai (6 Okt 2026)

---

## 9. Grid & patok yard–meter custom

**Masalah.** Preset lapangan saat ini (DCI, NFHS, NFL, tanpa hash,
sepak bola 105×68 m, GOR 40×20 m) sudah menutup sebagian kebutuhan,
tetapi jarak grid, patok, dan satuan masih kaku. Latihan di GOR kecil,
lapangan sekolah tanpa end zone, atau lapangan bola metrik menuntut
jarak grid/patok yang berbeda; pelatih juga ingin mengganti satuan
tampilan yard ↔ meter ↔ langkah tanpa kehilangan presisi internal
(yard tetap satuan simpan).

**Keputusan:** tidak menambah preset baru saja, melainkan membuat grid
dan patok **kustom** yang tetap kompatibel dengan data lama.

1. **Grid kustom**
   - Jarak grid dapat diatur (mis. 2 m, 5 yard, 10 yard) dan jumlah
     garis dihitung otomatis dari `fieldBox`; warna & ketebalan garis
     memakai hex (aman cetak/portabel).
   - Toggle satuan tampil **yard / meter / langkah** — nilai tersimpan
     tetap yard (`STEP_YD`, `M_TO_YD` di `src/lib/field.ts`), konversi
     hanya di lapisan tampil/cetak.
   - Pratinjau lapangan langsung; grid ikut skala titik & warna lapangan.

2. **Patok kustom**
   - Jarak huruf (A, B, C…), hash (#), dan T dapat diatur terpisah
     (mis. 8 langkah = 5 yard pada 8-to-5, tapi bisa 6 atau 10);
     `awalanT`, `dariTengah`, `penandaSisi` S1/S2, dan `tampil` tetap
     seperti `PATOK_DEFAULT`.
   - Patok dihitung dari garis tengah (`fieldBox`) sehingga tanda `−`/`+`
     tidak terbalik di sisi S1 (cacat DD10 yang sudah diperbaiki tetap
     aman).
   - Opsi "Tanpa patok" untuk lapangan indoor kecil.

3. **Tetap offline & aman data lama**
   - `FieldConfig` lama tanpa `patok`/`gridYd` kustom tetap terbaca via
     `patokOf()`; tidak ada migrasi paksa.
   - Cetak/buku saku memakai hex yang sama; tidak ada `oklch()`.

**Tidak dilakukan pada tahap ini:** mengubah geometri lapangan atau
menambah jenis hash baru di luar NFHS/NCAA/NFL/none.

**Uji (fondasi 3 Okt & penyelesaian penuh 28 Okt 2026):**
- `qa/grid-patok-logika.mjs` (**67 butir**): A=YL50 (`0`), B 5 yard (`8×0.625`) & A# 2,5 yard, T–T 5 yard; konversi bolak-balik tiga satuan (`yard` / `meter` / `langkah`, mis. 100 yd = 160 langkah pada 8-to-5 & 120 langkah pada 6-to-5) tanpa menggeser `fieldBox`, `garisGridUtama`, maupun `daftarPatok`; `garisGridUtama` & `garisSubgrid` dihitung otomatis sepanjang area main `fieldBox` (termasuk grid kustom 2 m pada lapangan 40 m → 21 garis tepat bertengah `0`); palet `WARNA_GARIS_GRID` murni hex `#rrggbb` & `skalaGarisLapangan` proporsional; `satuanJarak: 'meter'` selaras antara `daftarPatok`, `patokRef`, dan `coordPatok` (termasuk penghormatan `maksT` pada sumbu T); serta preset `'indoor-polos'` (*Indoor tanpa patok*).
- `qa/lapangan-ui.mjs` (**33 butir**): toggle langsung `Yard` ↔ `Meter` ↔ `Langkah` di `FieldConfigEditor`, audit SVG `pratinjau-lapangan-editor` murni `#rrggbb` hex tanpa `oklch()`/`rgba()`, pembaruan real-time skala titik contoh (`100%` → `150%`), jarak grid kustom + warna emas (`#fde047`) + subgrid, tombol cepat **"Tanpa patok (indoor kecil)"** & preset **"Indoor tanpa patok"**, serta penjagaan input `0`/kosong/`NaN`.
- Regresi `qa/uji-lapangan.mjs` (94 butir), `qa/dd9-kompas.mjs` (35 butir), `qa/dd8*.mjs`, `qa/dd10b-*.mjs`, dan `qa/kartu-lipat.mjs` lulus penuh.

### Status: Selesai penuh (28 Okt 2026)

1. **Fondasi (3 Okt 2026):** pemisahan geometri grid utama, subgrid, hash, serta garis/label patok (`gridTampil`, `subgridTampil`, `hashTampil`, `subgridYd`, `tampilGaris`, `tampilLabel`), `maksHuruf` simetris & `maksT`, serta penjagaan yard vs meter tanpa snap paksa.
2. **Penyelesaian penuh (28 Okt 2026):**
   - Penambahan satuan tampilan **`'langkah'`** mendampingi `'yd'` dan `'m'` (`SatuanTampilLapangan`, `keSatuanTampil`, `dariSatuanTampil`) sementara penyimpanan internal tetap murni yard.
   - Input jarak grid & subgrid kustom bebas (dengan tombol cepat per satuan) + penghitung garis otomatis dari `fieldBox` (`garisGridUtama`, `garisSubgrid`), dilengkapi palet warna hex murni (`WARNA_GARIS_GRID`: putih `#ffffff`, emas `#fde047`, biru muda `#7dd3fc`, perak `#cbd5e1`) dan ketebalan proporsional (`TEBAL_GARIS_GRID`, `skalaGarisLapangan`), menghapus pemakaian `rgba()` dari `FieldSurface.tsx`.
   - **Pratinjau SVG lapangan langsung** (`FieldSurface` mode `pratinjau`) di dalam `FieldConfigEditor` beserta 5 titik contoh berskala `ukurTitik(f)` dan tombol preset lapangan di halaman **Pengaturan** maupun **Pengaturan drill**.
   - Penyelarasan sumbu angka `T` di `patokRef` langsung terhadap `daftarPatok` + dukungan `satuanJarak: 'meter'` untuk pemasangan patok berpita meteran, serta tombol cepat **"Tanpa patok (indoor kecil)"** + preset **`Indoor tanpa patok`** (`40 × 20 m`, grid 2 m).

---

## 10. Impor drill Pyware

**Masalah.** Banyak tim sudah mempunyai drill di **Pyware 3D** (atau
Excel) dan menulis ulang titik per set di DrillKit memakan waktu.
Format Pyware tidak terbuka lebar, tetapi ekspor **coordinate sheet CSV**
umum dipakai untuk bertukar dengan Excel — alur DD7 sudah membuktikan
manfaatnya.

**Keputusan:** impor **satu arah Pyware → DrillKit** lewat CSV
koordinat, memakai fondasi yang sudah ada, tanpa server.

1. **Format masuk**
   - CSV koordinat Pyware/Excel dengan kolom minimal: `Set`, `Count`,
     `Kode/Member`, `X`, `Y` (yard atau meter + penanda satuan).
     Nilai X membujur (S1↔S2 dari A), Y melintang (front↔back) — konsisten
     dengan `src/lib/field.ts`.
   - Dukungan meter: bila satuan meter, konversi otomatis via `M_TO_YD`.

2. **Alur impor**
   - Lewat pintu **#7 "Buka berkas DrillKit"** — jenis dikenali dari isi
     (header CSV). Pratinjau menampilkan jumlah set, jumlah anggota,
     rentang hitungan, dan posisi di luar lapangan yang akan diperingatkan.
   - **Pencocokan anggota** memakai layar "Cocokkan anggota" dari **#1**:
     kode Pyware dipetakan ke `Member` DrillKit (berdasarkan kode/section/
     kemiripan nama), alias diingat untuk impor berikutnya.
   - Posisi diinterpolasi linear antar set (busur tetap lurus pada impor
     awal; busur Pyware dapat ditambah manual setelah impor).

3. **Keamanan & kompatibilitas**
   - Pratinjau sebelum tulis, impor tidak menimpa show aktif tanpa
     konfirmasi ("Timpa / Gabung / Salinan" seperti show).
   - Riwayat formasi (`RiwayatSnapshot`) mencatat impor sehingga bisa
     di-undo satu langkah.
   - Berkas show lama tetap kompatibel; impor Pyware hanya menambah.

**Uji (rencana):** CSV 3 set × 20 anggota masuk utuh (60 titik × 3 set),
konversi meter↔yard tepat, anggota tak dikenal dipetakan manual dan
diingat, posisi di luar `fieldBox` diberi peringatan, undo menghapus
hasil impor.

### Status: Selesai (6 Okt 2026)

Semua butir rencana di atas dikerjakan, plus beberapa hal yang baru ketahuan
saat dikerjakan:

- **Modul murni `src/lib/pyware.ts`** — pengurai lembar koordinat (kolom
  dikenali per **peran**: set/subset/count/pemain/instrumen/X/Y/Z/arah/satuan,
  dari banyak ejaan: `Sidelong`, `Depth`, `Performer`, `Transition Counts`,
  `Page`, …), konversi satuan (`langkah`/`yard`/`meter`/`kaki` → yard via
  `M_TO_YD`), tiga asal pengukuran Y (`tengah`, `garis-depan`,
  `garis-belakang`), arti kolom Count (`mutlak`/`transisi`), interpolasi
  linear **berbobot hitungan** untuk titik yang bolong, pratinjau
  (`ringkasPyware`), dan saran asal Y bila pilihan lain jelas lebih sedikit
  mengeluarkan titik dari lapangan.
- **`rapikanJudul`** — judul kolom seperti `X (Sidelong, meters)` yang tidak
  dikutip Excel pecah jadi dua sel dan menggeser semua kolom sesudahnya;
  sel yang kurungnya belum ditutup disambung lagi.
- **Baris tanpa koordinat tidak dibuang** — pemainnya tetap terdaftar di set
  itu (posisi `null`) supaya setnya tidak hilang dari urutan dan celahnya bisa
  diisi lurus; yang benar-benar dilewati hanya baris tanpa identitas.
- **Pencocokan #1 dipakai apa adanya** — pemain Pyware dibungkus jadi
  `Member` ber-id `pyware:<kode>`, lewat `susunSaran`/`PanelCocok`/
  `terapkanCocok`, dan id itu masuk `alias` sehingga impor berikutnya cocok
  otomatis tanpa ditanya.
- **Penulisan di `src/lib/pywareTulis.ts`** — Gabung (set bernama sama
  diperbarui, facing lama dipertahankan, pemain yang tidak ada di berkas tidak
  diusir) / Timpa / Salinan (show baru). Gabung & Timpa difoto
  `sebelum-impor-pyware` (tersemat) → satu langkah undo. `rosterIds` ikut
  diperbarui, karena drill yang membatasi roster tidak akan menampilkan
  pemain baru walau titik-titiknya ada.
- **Pintu #7** — jenis baru `csv-pyware` (dikenali dari penanda Pyware;
  lembar koordinat ekspor DrillKit sendiri tetap ke pintu DD7), diarahkan ke
  Drill, dan jendela impor terbuka sudah terisi lewat titipan.

**Uji:** `qa/pyware-logika.mjs` **146 butir** (murni + `fake-indexeddb`) —
3 set × 20 pemain = 60 titik utuh, meter/yard/kaki tepat, `Count` mutlak
1-9-25 → 8 & 16 hitungan, interpolasi berbobot (8 langkah, bukan 12), titik
di luar `fieldBox` terhitung + saran asal Y, alias diingat lintas impor,
gabung/timpa/salinan + undo, roster diperbarui. `qa/buka-berkas-logika.mjs`
+6 butir untuk jenis baru (106 total). Alur layarnya diperiksa 42 asersi lewat
harness jsdom sementara (render → pratinjau → pencocokan → tulis → riwayat),
dan `qa/pyware-impor.mjs` (peramban) didaftarkan ke `qa/regresi-penuh.sh`.

---

## 11. Partitur full score & per instrumen + latihan per bar/frasa

> **Rencana teknis bagian pertama (#11a)** ditulis di
> `RANCANGAN-11a-PARTITUR-MUSICXML.md` (rampung 22 Okt 2026, PR #20 & #21) dan
> **bagian kedua (#11b)** — render *full score* offline OSMD, lembar PDF, dan
> dukungan `.mxl` — ditulis di `RANCANGAN-11b-PARTITUR-RENDER.md` (**rampung
> 23 Okt 2026**, lihat status di bawah). Part per instrumen + cetak hex (**11c**)
> dan highlight sinkron + loop frasa (**11d**) menyusul sebagai PR sendiri.

**Masalah.** Halaman Musik sudah punya repertoar, tempo map, metronom,
rekaman (#6), dan tempo latihan (#4), tetapi **belum ada notasi**.
Pelatih dan anggota membutuhkan partitur untuk melihat frase, melatih
per birama, dan mengulang bagian yang sulit — saat ini hanya mengandalkan
hafalan atau PDF terpisah yang tidak sinkron dengan audio/drill.

**Keputusan:** partitur menjadi **lapisan baca + latihan**, bukan editor
notasi. Tetap offline, tanpa server, memakai fondasi `TempoTimeline`
(PR #14).

1. **Sumber & penyimpanan**
   - **MusicXML** (ekspor MuseScore/Sibelius) sebagai sumber utama —
     disimpan sebagai Blob di IndexedDB (pola sama seperti rekaman #6),
     dirender offline dengan **OSMD (OpenSheetMusicDisplay)** yang
     menghasilkan SVG/Canvas hex (aman portabel).
   - **PDF / gambar** sebagai fallback: ditampilkan sebagai lembar
     statis (tanpa sinkron highlight) bila MusicXML tidak tersedia.
   - Berkas show & repertoar dapat membawa rujukan partitur (id lagu),
     bukan notasi penuh, agar ukuran paket tetap wajar.

2. **Tampilan**
   - **Full score** (semua instrumen) dan **part per instrumen/section**
     (filter: Brass, Battery, Pit, Guard, atau per instrumen) —
     instrumen mengikuti `section` anggota yang sudah ada.
   - Di laptop: dua panel (notasi + lapangan/metronom); di HP: tab
     Partitur. Cetak part per instrumen memakai hex, pratinjau/unduh HTML.

3. **Latihan per bar/frasa**
   - Pilih rentang birama (mis. Bar 5–8 = frase 1) langsung di partitur
     atau di daftar segmen lagu; rentang diingat per lagu per perangkat
     (seperti tempo latihan #4).
   - **Sinkron highlight**: birama aktif disorot mengikuti
     `TempoTimeline` — saat metronom, rekaman, atau drill berjalan,
     partitur menggulir/highlight bar yang sedang dimainkan.
   - **Loop frasa** (reuse M2 "Ulang bagian") + **tempo latihan** (#4) +
     **count-off** (M1) berlaku pada frasa; lencana "Frasa 5–8 · 80%"
     tampil di panel lagu & set list.
   - Set list dapat menautkan frasa partitur ke set drill tertentu
     (mis. Set 4–6 = Bar 9–16).

4. **Tetap offline & hemat memori**
   - `navigator.storage.persist()` dipakai bila ukuran MusicXML besar;
     ada peringatan kuota (seperti #6) dan catatan iPhone.
   - Tanpa MusicXML, fitur latihan frasa tetap jalan via tempo map
     (fallback).

**Uji (rencana):** MusicXML 32 birama dirender (full score + part
trumpet), highlight sinkron ±1 birama dengan rekaman & metronom,
loop Bar 5–8 mengulang tepat 4 birama pada 80% tempo, cetak part
hex 1 halaman, impor MusicXML round-trip ZIP tidak hilang.

### Status: Rampung penuh (#11a 22 Okt 2026, #11b 23 Okt 2026, #11c 24 Okt 2026, #11d 25 Okt 2026)

Bagian **#11a** (fondasi data, pintu masuk, ringkasan murni, kuota, dan
round-trip ZIP — sengaja tanpa merender notasi, tanpa dependensi baru) telah
selesai sesuai `RANCANGAN-11a-PARTITUR-MUSICXML.md`:

- **Modul murni `src/lib/partitur.ts`** — deteksi dari isi bita (`%PDF-` →
  `pdf`, ZIP ber-`META-INF/container.xml` → `.mxl`, akar `<score-partwise>` /
  `<score-timewise>` → `musicxml`, mendukung UTF-8 & UTF-16 lewat
  `teksPartitur`), pemindai tag kecil `ringkasMusicXml` (judul, pengarang,
  daftar part + singkatan, jumlah birama maksimum antar part, sukat awal,
  **`perubahanSukat` per birama** tanpa duplikasi lintas part, tempo pertama,
  batas 8 MB / 5.000 birama / 5 entitas XML bawaan), serta `putusanPartitur`
  yang menegakkan **D1** (`.mxl` ditolak dengan petunjuk simpan ulang dari
  MuseScore) dan **D4** (MusicXML yang gagal diringkas tetap boleh dipasang
  dengan `terurai: false` dan `ringkasGagal` terisi apa adanya).
- **Store Dexie versi 10 `partiturBerkas` & `Song.partitur`** (`src/db/db.ts`,
  `src/db/types.ts`, `src/lib/partiturSimpan.ts`) — bita Blob disimpan terpisah
  dari `songs` (berkas dulu → metadata; mengganti menimpa kunci `songId` dalam
  satu langkah tanpa jendela kosong; melepas mengosongkan metadata dulu baru
  menghapus Blob). Berkas show & repertoar hanya membawa metadata `PartiturMeta`
  sehingga ukurannya tetap kecil.
- **Pintu #7 (`src/lib/bukaBerkas.ts`, `src/components/BukaBerkas.tsx`)** —
  jenis baru `'partitur'` (`Partitur (MusicXML / PDF) (#11a)` → `Musik →
  Partitur lagu`), pratinjau `TubuhPartitur`, penghitungan `partiturZip`, dan
  pengecualian eksplisit di `aturMode` sehingga mode anggota ikut diizinkan.
- **Panel di halaman Musik (`src/components/PanelPartitur.tsx`)** — pratinjau
  sebelum tulis, konfirmasi ganti dua langkah yang menyebut nama berkas lama,
  tampilan jujur *"tercatat, berkasnya belum ada di perangkat ini"* saat
  metadata datang tanpa Blob, serta kartu kuota penyimpanan (> 50% memberi
  peringatan + tombol `Minta Persisten` / catatan iOS).
- **Round-trip ZIP (`src/lib/backup.ts`, `src/lib/partiturZip.ts`,
  `src/components/PulihkanBackup.tsx`)** — mengemas `partitur/<songId>_<nama>` +
  `partitur/manifest.json` di samping `audio/`, memisahkan jumlah partitur baru
  dan yang ditimpa di pratinjau pemulihan, dan mendaftarkan `partiturBerkas`
  di daftar pengecualian JSON `qa/backup-lengkap.mjs`.

**Uji #11a:** `qa/partitur-logika.mjs` **101 butir** (murni node: fixture lima
sumber MuseScore 3/4, Sibelius, Finale, Dolet + `score-timewise`, anacrusis,
sukat campur, batas ukuran/birama/entitas, D1 & D4, round-trip ZIP & SHA-256),
`qa/partitur-zip-logika.mjs` **9 butir**, `qa/buka-berkas-logika.mjs` **134
butir** (+21 untuk jenis `'partitur'`, D1/D4, `aturMode`, dan penjagaan agar CSV
& HTML tidak tertelan cabang mirip-partitur), `qa/buka-berkas.mjs` **61 butir**
(+6 untuk ekspor/pulihkan ZIP partitur), dan `qa/partitur-impor.mjs` **60 butir**
(peramban: seret pintu #7 → pasang/ganti/lepas di Musik → reload IndexedDB →
kuota & `persist()` → ukuran repertoar/show → pulihkan ZIP di DB bersih).

Bagian **#11b** (render *full score* offline dengan OSMD, penampil lembar PDF
anti-buntu, dan dukungan langsung berkas terkompresi `.mxl`) juga telah selesai
sesuai `RANCANGAN-11b-PARTITUR-RENDER.md`:

- **Pengurai murni `.mxl` (`src/lib/mxl.ts`)** — membaca dari *Central Directory*
  ZIP + `DecompressionStream('deflate-raw')` (menangani entri metode 0 *stored*
  maupun metode 8 *deflate* termasuk *data descriptor* bit 3), memvalidasi
  `META-INF/container.xml` → `<rootfile full-path="…">`, memverifikasi CRC-32,
  serta menegakkan batas terukur 8 MB terkompresi & tak-terkompresi (anti-*zip-bomb*),
  tanpa menyentuh `src/lib/zip.ts`. Tersambung ke pintu #7 lewat
  `kenaliBerkasAsync` (`src/lib/bukaBerkas.ts`, `src/components/BukaBerkas.tsx`)
  dan `periksaPartitur` (`src/lib/partiturSimpan.ts`), lalu disimpan ke
  `partiturBerkas` sebagai `.musicxml` tak terkompresi agar kompatibel penuh
  dengan skema Dexie v10 & round-trip backup ZIP.
- **Pembungkus *lazy-load* OSMD (`src/lib/partiturRender.ts`,
  `opensheetmusicdisplay@2.2.1` `BSD-3-Clause`)** — bundel OSMD (`1,438.32 kB`
  / `383.85 kB` gzip, sudah menyematkan vektor glif VexFlow tanpa font jaringan)
  terpisah menjadi *lazy chunk* tersendiri yang baru diunduh saat partitur
  MusicXML benar-benar dibuka; menggambar sistem demi sistem lewat `renderNext`
  ber-`AbortSignal` di atas palet heksadesimal murni `#ffffff`/`#0f172a` (nol
  `oklch()`/`color-mix()`), serta menormalisasi entitas HTML umum (`&nbsp;`, dll.)
  dan mentransposisi `<score-timewise>` → `<score-partwise>` menjadi `Document`
  langsung untuk `osmd.load()` sehingga berkas D4 dari `#11a` tetap tampil utuh.
- **Lembar baca di halaman Musik (`src/components/LayarPartitur.tsx`,
  `src/components/PanelPartitur.tsx`, `src/pages/Music.tsx`)** — tombol
  `Buka partitur` / `Sembunyikan partitur`, kendali *zoom* `60%`–`160%` yang
  tersimpan di `localStorage`, tata letak *Halaman* (vertikal) vs *Mendatar*
  (1 baris), mode *Layar penuh* (`Escape`), tetap interaktif saat Kunci Kios
  (`data-kiosk-allow`), pesan ramah + tombol *Unduh asli* saat XML rusak, serta
  penampil lembar PDF (`<iframe>` + *Buka tab baru* & *Unduh PDF* yang selalu
  tampil, tanpa memuat OSMD).

**Uji #11b:** `qa/mxl-logika.mjs` **42 butir** (murni node: *stored*, *deflate*,
*data descriptor* bit 3, UTF-16, beberapa `<rootfile>`, CRC rusak, batas 8 MB /
anti-*zip-bomb*, tanpa `DecompressionStream`), `qa/buka-berkas-logika.mjs`
**140 butir** (+6 untuk `kenaliBerkasAsync` `.mxl`), `qa/partitur-impor.mjs`
**61 butir** (+1 alur `.mxl` sah & rusak di UI), dan `qa/partitur-render.mjs`
**40 butir** (peramban: verifikasi *lazy-load* OSMD & `0` request eksternal,
seret/pasang `.mxl` bit 3, render `<svg>` hex `#ffffff`/`#0f172a`, *zoom* lintas
`reload`, tata letak halaman/mendatar, layar penuh + `Escape`, Kunci Kios,
janji D4 `<score-timewise>`+`&nbsp;`, XML rusak, serta PDF di konteks bersih
tanpa memuat OSMD).

Bagian **#11c** (penyaringan *part* per instrumen/seksi, pilihan awal cerdas di
mode anggota, serta cetak & unduh HTML mandiri berpalet hex murni) juga telah
selesai sesuai `RANCANGAN-11c-PARTITUR-PART-CETAK.md`:

- **Klasifikasi instrumen & pilihan awal anggota (`src/lib/partiturBagian.ts`)** —
  kamus dwibahasa (Inggris + Indonesia + singkatan MuseScore/Sibelius/Finale)
  yang mengurutkan frasa majemuk terpanjang lebih dulu (*Baritone Sax* / *Tenor Sax*
  / *Bass Clarinet* tidak salah masuk ke *Brass* / *Battery*), memetakan `<score-part>`
  ke `SectionDef[]` dinamis tim tanpa menyembunyikan *Woodwind* yang nyata ada di skor
  (D3), mencocokkan profil `instrument` lalu `section` anggota secara otomatis tanpa
  pernah mengunci atau menghalangi pemakaian tanpa nama (D4), serta menyimpan
  pilihan manual per lagu di `localStorage` (50 lagu FIFO).
- **Penyaringan OSMD & perender halaman cetak (`src/lib/partiturRender.ts`)** —
  menyaring `Instrument.Visible` + `Staff.Visible` + `osmd.updateGraphic()` langsung
  di objek OSMD (D1: menjaga tanda tempo global pada `<part>` teratas sekaligus
  menggabungkan istirahat multi-birama otomatis pada *part* tunggal), mematikan
  label kiri berulang saat 1 *part* tampil agar paranada selebar penuh, serta
  menambahkan `renderHalamanCetakPartitur` di wadah lepas-layar berukuran baku
  (`794 px` / `1122 px`) dengan `PageFormatStandards` (`A4_P`, `A4_L`, `A5_L` Lyre).
- **Dokumen HTML cetak murni hex & modal pratinjau anti-buntu (`src/lib/partiturCetak.ts`,
  `src/components/PratinjauCetakPartitur.tsx`, `src/components/LayarPartitur.tsx`,
  `src/pages/Music.tsx`, `src/pages/Share.tsx`)** — menyuntikkan `viewBox` pada setiap
  `<svg>` VexFlow agar tidak terpotong di margin printer (D2), merakit berkas `.html`
  mandiri berpalet hex murni (`#ffffff` / `#0f172a`, `0` `oklch()` / `color-mix()`)
  lengkap dengan bilah `.no-print`, menampilkan `<iframe srcDoc>` dengan pilihan
  bagian/kertas/skala, serta menyediakan **Unduh HTML** dan **Cetak** via
  `cetakAtauUnduh` (D5). Juga menambal `simpanPaketAnggota` (`src/lib/paketMasuk.ts`)
  agar pembukaan berkas paket lokal `.json` di mode anggota ikut menyalin `songs` dan
  `setlists` ke `db.songs` / `db.setlists`.

**Uji #11c:** `qa/partitur-bagian-logika.mjs` **87 butir** (murni node: kamus
dwibahasa, kasus ambigu *Bari Sax* / *Tenor Sax* / *Bass Clarinet*, `SectionDef`
kustom & tersembunyi, pencocokan anggota + *Color Guard*, FIFO `localStorage`,
injeksi `viewBox` SVG, `@page` `A4_P`/`A4_L`/`A5_L`, serta `0` `oklch`/`color-mix`)
dan `qa/partitur-cetak.mjs` **39 butir** (peramban: skor 6 *part* lintas 4 seksi,
penyaringan *Brass* & *Marimba* ber-multi-rest 4 birama, persistensi lintas
`reload`, ganti ke skor solo 1-*part* & PDF, pratinjau/unduh/fallback cetak HTML
`A4_L`/`A4_P`/`A5_L` Lyre, Kunci Kios, serta alur penuh mode anggota tanpa nama →
*Trumpet* → *Ke part saya* → *Trombone* → *Color Guard* → *Marimba*).

Bagian **#11d** (sorot birama aktif sinkron `TempoTimeline`, pilih & loop frasa
per birama, serta tautan frasa partitur ↔ set drill) telah menuntaskan seluruh
cakupan **#11** sesuai `RANCANGAN-11d-PARTITUR-FRASA.md`:

- **Pemetaan birama SVG & multi-rest (`src/lib/partiturRender.ts`,
  `src/lib/partiturFrasa.ts`)** — membaca kotak piksel setiap `<g.vf-measure>`
  dari DOM OSMD dan memetakan rentang birama sumber termasuk penggabungan
  istirahat multi-birama pada *part* tunggal (`biramaDari..biramaSampai`),
  sehingga birama yang terlipat (mis. `Bar 9–12` pada *Trumpet 1*) tetap tersorot
  dan dapat diklik tanpa melompat atau hilang.
- **Lapisan sorot murni hex, auto-scroll cerdas, & kendali putar non-blocking
  (`src/components/LayarPartitur.tsx`)** — menyorot birama aktif dan pita frasa
  di atas kanvas OSMD memakai warna inline hex/rgba (`WARNA_SOROT_PARTITUR_HEX`,
  `0` `oklch()` / `color-mix()`), menggulir otomatis hanya saat sistem paranada
  mendekati tepi wadah dengan jeda otomatis 4 detik seusai gulir manual pengguna,
  serta menyediakan tombol **Putar/Berhenti**, mode **Pilih frasa di partitur**
  (2-ketuk atau `Shift+klik` langsung pada birama SVG), input `Dari..Sampai`,
  preset tempo latihan (`70%`–`100%`), keping segmen lagu, dan keping set drill.
- **Ingatan frasa per perangkat, loop presisi WAV + Metronom, & fallback tanpa
  MusicXML (`src/hooks/useFrasaLatihan.ts`, `src/lib/metronome.ts`,
  `src/components/PanelLagu.tsx`, `src/pages/Music.tsx`, `src/pages/Share.tsx`)** —
  menyimpan pilihan frasa per lagu per perangkat di `localStorage`
  (`drillkit_frasa_latihan_v1`, 80 lagu FIFO) yang menyatu dengan M2 `ulangBagian`,
  `#4` tempo latihan, dan M1 hitung mundur; membungkus batas akhir birama tepat
  kembali ke `dari` pada `Metronom` sekaligus menyinkronkan seek `PemutarRekaman`
  (`#6`) via callback `onUlangBagian`; menampilkan lencana `"Frasa 5–8 · 80%"`
  di `LayarPartitur`, `PanelLagu`, dan `KartuSetList`; serta menjaga latihan frasa
  tetap berjalan via `TempoTimeline` dan keping segmen saat lagu belum memiliki
  MusicXML atau hanya berpartitur PDF.
- **Tautan frasa ↔ set drill & partitur pendamping di `DrillEditor`
  (`src/db/types.ts`, `src/components/KartuSetList.tsx`,
  `src/components/DrillEditor.tsx`)** — menghitung petunjuk rentang birama tiap
  set dari `petaPenggaris` (`hitungPetaSetKeBirama`, mis. `Set 4–6 = Bar 9–16`),
  menyimpan `SetList.tautanFrasa` agar terbawa ke paket anggota, dan menambahkan
  panel **Buka partitur** di penggaris `DrillEditor` yang menyorot birama aktif
  secara langsung seiring scrubber/animasi formasi berjalan.

**Uji #11d:** `qa/partitur-frasa-logika.mjs` **42 butir** (murni node: pemetaan
kotak multi-rest & pickup `0`, sorot aktif, `langkahPilihFrasa`, FIFO `localStorage`
+ prioritas di atas `Song.ulangBagian`, format lencana `"Frasa 5–8 · 80%"`,
`hitungPetaSetKeBirama` `Set 4–6 = Bar 9–16`, konversi progres set ↔ birama,
auto-scroll, serta audit palet hex murni) dan `qa/partitur-frasa.mjs` **30 butir**
(peramban: MusicXML 32 birama *Full score* & *Trumpet 1* ber-multi-rest 4 birama,
sinkronisasi sorot ±1 birama dengan rekaman WAV `#6` & metronom + auto-scroll,
klik SVG & `Shift+klik` `Bar 5–8` di `80%` tempo yang mengulang tepat 4 birama
`5..8 → 5` tanpa bocor ke `9` + persistensi `reload`, Kunci Kios, fallback tanpa
MusicXML + hitung mundur M1, tautan `"Set 4–6 = Bar 9–16"` di `KartuSetList` &
paket mode anggota, serta sorot partitur pendamping langsung di `DrillEditor`).
Seluruh **113 rangkaian** terdaftar di `qa/regresi-penuh.sh` dan
`.github/workflows/ci.yml`.

---

## Yang masih ditunda dari daftar lama

- **I1 — Log perubahan show** (siapa mengubah set apa dan kapan).
  Ditunda karena masalahnya belum pernah terjadi.
