# Ide Pengembangan DrillKit — daftar untuk dipilih

Dokumen ini **bukan** rencana yang harus dikerjakan semua. Ini kandidat perbaikan,
diurutkan per kelompok, supaya kamu bisa bilang: *"kerjakan nomor X dulu"*.

**Terakhir diperbarui: 23 Okt 2026 — #11b Partitur: render full score offline (OSMD SVG hex lazy-load), lembar PDF anti-buntu, dan pengurai `.mxl` murni rampung (11c–11d menyusul).**
· **#11b Partitur: render *full score* offline (OSMD), lembar PDF, & dukungan `.mxl` rampung (23 Okt 2026)** — pecahan kedua §11 sesuai `RANCANGAN-11b-PARTITUR-RENDER.md`. Modul murni `src/lib/mxl.ts` mengurai arsip `.mxl` langsung dari *Central Directory* ZIP + `DecompressionStream('deflate-raw')` (tahan *data descriptor* bit 3, verifikasi CRC-32, batas 8 MB terkompresi & tak-terkompresi anti-*zip-bomb*, tanpa menyentuh `zip.ts`), disambungkan ke pintu #7 (`kenaliBerkasAsync` di `bukaBerkas.ts` & `BukaBerkas.tsx`) dan `periksaPartitur` (`partiturSimpan.ts`) lalu disimpan sebagai XML tak terkompresi di `partiturBerkas`. Pembungkus *lazy-load* `src/lib/partiturRender.ts` mengisolasi `opensheetmusicdisplay@2.2.1` (`BSD-3-Clause`, dependensi runtime ke-8) ke *chunk* terpisah (`1,438.32 kB` / `383.85 kB` gzip, vektor VexFlow tersemat → `0` font/jaringan luar) yang baru diunduh saat partitur MusicXML dibuka; merender bertahap lewat `renderNext` ber-`AbortSignal` dengan palet hex murni `#ffffff`/`#0f172a` (nol `oklch()`/`color-mix()`), serta menormalisasi entitas HTML umum (`&nbsp;`, dll.) dan mentransposisi `<score-timewise>` → `<score-partwise>` langsung sebagai `Document` ke `osmd.load()` sehingga berkas D4 dari `#11a` berhasil dirender utuh (dan XML pendek tanpa deklarasi `<?xml …?>` tidak salah dikira URL oleh OSMD). Komponen `src/components/LayarPartitur.tsx` (dibuka lewat `Buka partitur` di `PanelPartitur.tsx` / `Music.tsx`) menyediakan *zoom* `60%`–`160%` ber-`localStorage`, tata letak *Halaman* vs *Mendatar*, mode *Layar penuh* (`Escape`), dukungan Kunci Kios (`data-kiosk-allow`), fallback ramah + unduh asli untuk XML rusak, dan lembar PDF (`<iframe>` + *Buka tab baru* & *Unduh PDF* eksplisit tanpa memuat OSMD). **Uji:** `qa/mxl-logika.mjs` 42 butir, `qa/buka-berkas-logika.mjs` 140 (+6), `qa/partitur-impor.mjs` 61 (+1), dan `qa/partitur-render.mjs` 40 butir (peramban Headless Chromium, `0` error konsol & `0` request eksternal) — seluruh **109 rangkaian** terdaftar di `qa/regresi-penuh.sh` & `.github/workflows/ci.yml`. Part per instrumen + cetak hex (**11c**) dan highlight sinkron + loop frasa (**11d**) menyusul.
· **#11a Partitur: simpan, kenali, dan bawa MusicXML/PDF rampung (22 Okt 2026)** — pecahan pertama §11 sesuai `RANCANGAN-11a-PARTITUR-MUSICXML.md` (tanpa render notasi, tanpa dependensi baru, tetap 7 dependensi). Modul murni `src/lib/partitur.ts`: deteksi dari bita (`%PDF-` → PDF, ZIP ber-`META-INF/container.xml` → `.mxl`, akar `<score-partwise>`/`<score-timewise>` → MusicXML UTF-8/UTF-16), pemindai tag kecil `ringkasMusicXml` (judul, pengarang, daftar part + singkatan, jumlah birama maksimum antar part, sukat awal + **`perubahanSukat` per birama**, tempo pertama; batas 8 MB, 5.000 birama, 5 entitas XML), serta keputusan **D1** (`.mxl` ditolak dengan petunjuk simpan ulang dari MuseScore) dan **D4** (MusicXML yang menjegal pemindai tetap dipasang dengan `terurai: false` & `ringkasGagal` tampil apa adanya). Store Dexie versi 10 `partiturBerkas` + metadata `Song.partitur` (`src/lib/partiturSimpan.ts`: berkas dulu → metadata; ganti menimpa 1 langkah; lepas metadata dulu → Blob), sementara berkas show & repertoar hanya membawa metadata agar tidak membengkak. Pintu #7 mengenali jenis baru `'partitur'` (diizinkan juga di mode anggota lewat pengecualian `aturMode`) dan menghitung `partiturZip`; `PanelPartitur.tsx` di halaman Musik menyediakan pratinjau sebelum tulis, konfirmasi ganti menyebut nama lama, keterangan jujur *"tercatat, berkasnya belum ada di perangkat ini"* saat metadata datang tanpa Blob, serta kartu kuota (> 50% peringatan + `Minta Persisten`). Round-trip backup ZIP mengemas `partitur/<songId>_<nama>` + `partitur/manifest.json` (`backup.ts`, `partiturZip.ts`, `PulihkanBackup.tsx`), dan `partiturBerkas` didaftarkan pada daftar pengecualian JSON `backup-lengkap.mjs`. **Uji:** `qa/partitur-logika.mjs` 101 butir, `qa/partitur-zip-logika.mjs` 9 butir, `qa/buka-berkas-logika.mjs` 134 (+21), `qa/buka-berkas.mjs` 61 (+6), dan `qa/partitur-impor.mjs` 60 butir (peramban, dijalankan lokal dengan Headless Chromium) — seluruh **107 rangkaian** terdaftar di `qa/regresi-penuh.sh` & `ci.yml`. Render OSMD (**11b**), part per instrumen + cetak hex (**11c**), dan highlight sinkron + loop frasa (**11d**) menyusul.
· **CI diboroskan dua kali lipat, dan jatah menit Oktober habis karenanya (7 Okt 2026)** — `ci.yml` memakai `push:` **dan** `pull_request:` tanpa saringan, jadi setiap commit di branch ber-PR menyalakan dua run regresi penuh ±60 menit. Terukur dari API Actions (1–7 Okt): **39 run untuk 24 commit = 1.990 menit**, sementara repo private paket Free diberi 2.000 menit/bulan; dua job berikutnya ditolak sebelum mulai dengan *"The job was not started because recent account payments have failed or your spending limit needs to be increased."* Perbaikannya dua lapis: `push` kini hanya untuk `main` (commit di branch diuji lewat PR-nya → 1.344 menit, hemat 32%) dan `concurrency: cancel-in-progress` per ref, karena pada 6 Okt ada **empat run yang mulai dalam satu menit** (±240 menit) padahal hanya commit terakhir yang perlu diuji (→ 1.049 menit, hemat 47%) — tanpa mengurangi satu pun dari 104 rangkaian. Konsekuensi yang diterima: commit di branch yang belum punya PR tidak diuji sampai PR-nya dibuka. Yang tetap perlu dilakukan pemilik akun: membereskan Billing & plans (metode pembayaran / spending limit), karena menit yang sudah terpakai tidak kembali sebelum siklus tagihan berikutnya.
· **#10 Impor drill Pyware rampung (6 Okt 2026)** — impor **satu arah** Pyware/Excel → DrillKit lewat CSV lembar koordinat. Modul murni `src/lib/pyware.ts` (pengurai, konversi, pratinjau, interpolasi) + `src/lib/pywareTulis.ts` (tulis ke Dexie) + layar `src/components/ImporPyware.tsx` (tombol **Pyware** di editor drill). Kolom dikenali per **peran** (set/subset/count/pemain/instrumen/X/Y/Z/arah/satuan) dari banyak ejaan (`Sidelong`, `Depth`, `Performer`, `Transition Counts`, `Page`); satuan `langkah`/`yard`/`meter`/`kaki` dan asal Y (`tengah`/`garis-depan`/`garis-belakang`) **ditebak dari judul kolom lalu bisa diganti** — tebakannya disebut di pratinjau, tidak diputuskan diam-diam; judul kolom yang terpecah koma tak-dikutip disambung lagi (`rapikanJudul`); baris tanpa koordinat tidak dibuang (pemainnya tetap di set itu, posisinya diisi lurus). Pratinjau sebelum tulis: jumlah set/pemain/titik, rentang hitungan (kolom Count dibaca `mutlak`/`transisi`), titik hasil interpolasi, **titik di luar lapangan** + saran asal Y bila pilihan lain jelas lebih baik. Pencocokan pemain memakai mesin #1 apa adanya (id tiruan `pyware:<kode>` → masuk `alias`, impor berikutnya cocok otomatis); pemain yang tak dikenal masuk sebagai anggota baru **dan tetap mendapat titik** — cacat yang ketahuan saat diuji: `terapkanCocok` hanya mengisi `peta` untuk yang dipasangkan ke anggota lama, jadi tanpa cabang kedua impornya "berhasil" dengan formasi bolong. Cara masuk: **Gabung** (set bernama sama diperbarui, facing lama dipertahankan, pemain yang tidak ada di berkas tidak diusir) / **Timpa** / **Salinan**; Gabung & Timpa difoto `sebelum-impor-pyware` (tersemat) → undo satu langkah, dan `rosterIds` ikut diperbarui supaya pemain baru benar-benar tampil. Pintu #7 mengenali jenis baru `csv-pyware` (penanda Pyware; lembar ekspor DrillKit sendiri tetap ke pintu DD7) dan mengarahkannya ke Drill dengan jendela impor sudah terisi. **Uji:** `qa/pyware-logika.mjs` 146 butir (murni + `fake-indexeddb`: 60 titik utuh, konversi satuan tepat, Count 1-9-25 → 8 & 16 hitungan, interpolasi berbobot 8 bukan 12 langkah, titik keluar lapangan + saran asal Y, alias diingat, gabung/timpa/salinan + undo, roster), `qa/buka-berkas-logika.mjs` 106 (+6 untuk jenis baru), alur layar 42 asersi lewat harness jsdom sementara (tidak ikut di-commit), dan `qa/pyware-impor.mjs` (peramban) terdaftar di `qa/regresi-penuh.sh` — **belum bisa dijalankan di kotak pasir ini** karena Chrome tidak dapat diunduh (`storage.googleapis.com` tertutup) dan `libnss3` tidak ada tanpa root; rangkaian itu pertama kali berjalan di CI.
· **#8 PIN pelatih tim rampung (6 Okt 2026)** — env `PIN_PELATIH` di-hash PBKDF2-SHA-256 (garam `drillkit-pin-pelatih-v1`, 10.000 iterasi) saat build (`vite.config.ts` / portable); PIN polos tidak masuk bundle. Kosong = perilaku lama. Kartu **Saya pelatih** meminta PIN; **Saya anggota** tidak. Hash yang lolos diingat di `localStorage` (`drillkit.pinPelatih.hash`); ganti PIN (hash berbeda) menanya semua perangkat lagi. Perangkat lama di mode pelatih ditanya sekali (`PinPelatihLama`). Tombol Mode pelatih menerima PIN tim **atau** PIN kios. Jeda 2,5 dtk setelah 5 salah; anjuran 6 angka. Langkah bergambar di `DEPLOY.md`. Uji `pin-pelatih-logika` (terdaftar regresi penuh).
· **#7 Pengelolaan berkas rampung (pintu Buka berkas DrillKit, nama jelas, Data pusat); sebelumnya #5 Drill × segmen lagu rampung (penggaris dua baris + ⚡, bantuan hitungan & Pas ke batas segmen, panjang segmen dalam hitungan, pecah/gabung set ber-riwayat); sebelumnya fondasi #9 grid/patok (41 butir uji) dan roadmap pasca PR #14.**
· **#7 Pengelolaan berkas rampung (5 Okt 2026)** — satu pintu **Buka berkas DrillKit** di menu Data & Dashboard + seret berkas ke jendela; deteksi dari isi (`src/lib/bukaBerkas.ts`: 5 format JSON + 4 CSV + ZIP via `bukaZip`, nilai `drillkit-*` asing dilaporkan); selalu pratinjau (jenis, tanggal, isi, baru/ditimpa) lalu diarahkan ke alurnya; paket anggota ditolak di mode pelatih & pemulihan backup selalu pratinjau (`AlurPulihkanBackup`, dipakai Pengaturan & pintu baru); tombol lama menerima semua jenis dan mengalihkan yang salah tempat; nama berkas jelas (`DrillKit - BACKUP LENGKAP/DATA PILIHAN/SHOW/LAGU/UNTUK ANGGOTA - …`); menu Data sebagai pusat (bagian "Mau apa?"); CSV satu arah (laporan jadwal/absensi/kehadiran) dikenali & dijelaskan. Uji `buka-berkas-logika` 100 (murni) + `buka-berkas` (peramban), terdaftar di regresi penuh; uji lama yang terdampak (`backup-lengkap`, `backup-setlist`, `bagikan-logika`, `nama-anggota-logika`, `buka-paket`, `berbagi-anggota`, `f3`, `f3b`,
  `tukar-repertoar`) disesuaikan.
· **N19 — tiga rangkaian yang selama ini merah di balik lampu hijau palsu (4 Okt 2026)** — CI pertama dengan runner yang bisa gagal menunjuk tiga rangkaian di luar #5: (1) `Badge` (ui.tsx) hanya menerima `children` & `className`, sehingga `data-testid` yang dipasang pemanggil hilang tanpa suara — lencana kehadiran di halaman Berbagi sudah lama memintanya, dan uji `kalender-anggota` mencarinya (kini prop lain diteruskan apa adanya; mogok → 13/13); (2) `pengingat-jadwal` (23/2 → 25/25) mencari kartu sesi di tab Bulan — kartunya hanya ada di Agenda, dan di sana pun sesi selain "berikutnya" harus dibuka lewat barisnya dulu; (3) `backup-lengkap` (25/11 → 36/36) menunggu toast pemulihan yang tidak muncul karena sejak #1 pemulihan sengaja bertanya lewat dialog "Cocokkan anggota" — tombol "Pulihkan" di dialog itu kini yang diklik. Sekalian: `m6-klik-rekaman` & `diagnosa-klik-rekaman` memakai pustaka Chrome cadangan di `/tmp/br/lib` (alamat kotak pasir lama) sehingga mogok dengan `libnspr4.so` saat dijalankan mengikuti `qa/pulihkan.sh`; kini mengikuti `CHROME_LIB` → `/home/user/chrome-lib` → `/tmp/br/lib`. **Regresi penuh lokal: 99 rangkaian, 99 lulus**; CI `e9fe582` & `3e39d08` (typecheck + build + regresi penuh) hijau dengan runner yang benar-benar bisa gagal.
· **N18 — CI kini benar-benar bisa merah (4 Okt 2026)** — `qa/regresi.sh` hanya MENCETAK ringkasan; kode keluarnya selalu 0, jadi langkah "Regresi penuh" di CI hijau apa pun yang terjadi (82 rangkaian boleh merah semua, lampunya tetap hijau). Sekarang rangkaian yang **gagal**, yang **mogok tanpa ringkasan**, yang berkasnya **tidak ada**, dan keluaran bergaya probe dengan **daftar error tidak kosong** dihitung sebagai kegagalan → skrip keluar 1; alasannya juga dicetak sebagai anotasi `::error::` di Actions supaya terbaca dari API run tanpa mengunduh log. Ditemukan saat memeriksa lampu hijau PR #16: pola deteksi probe-nya pun tidak pernah cocok (`"errors": []` tanpa spasi) sehingga rangkaian bergaya probe selalu lolos diam-diam.
· **#5 Drill × segmen lagu rampung (4 Okt 2026)** — penggaris hitungan **dua baris** (segmen & set) di editor drill dengan tanda **⚡** + keterangan untuk set yang melewati perubahan tempo/sukat, bisa diketuk & digeser di HP; bantuan "mulai di hitungan … / sisa segmen" + tombol **Pas ke batas segmen**; panjang tiap segmen dalam **hitungan drill** di editor lagu; serta **pecah/gabung set** yang mengambil posisi peralihan dari jalur yang ada (termasuk busur, animasi identik) dan bisa dibatalkan lewat riwayat formasi. Modul murni baru `src/lib/segmenDrill.ts`; uji `segmen-drill-logika` 88 (murni) + `m1-penggaris-drill` 41 (peramban); regresi musik/drill sekitarnya tetap hijau.
· **Fondasi #9 grid/patok selesai (3 Okt 2026)** — audit `field.ts`/`FieldConfigEditor`/`FieldSurface`/tipe, `gantiSatuan` diperbaiki (geometri tetap yard internal, konversi hanya tampil), grid utama/subgrid/hash & garis/label patok terpisah, batas `maksHuruf` simetris & `maksT`, `satuanJarak: langkah|yard`, UI jelaskan 8-to-5=8 langkah/5 yard (4.57 m) vs grid 5 m=5.468 yard ≠ disamakan; uji `grid-patok-logika` 41 lulus, `uji-lapangan` 94, `typecheck` bersih — **tanpa Pyware/partitur**.
· **Pemutakhiran roadmap 3 Okt 2026 (pasca PR #14)** — fondasi **tempo map custom per ketuk/subdivisi & ramp eksplisit** (`TempoTimeline`, `tempoRamp`, PR #14 — 1 Okt 2026) **terintegrasi sebagian ke #5 Drill × segmen lagu**; evaluasinya dipakai bersama untuk metronom, drill per hitungan, rekaman, dan set list (verifikasi 273 lulus). **#6 Rekaman (MP3)** ditegaskan **selesai** (PR #11 + susulan PR #12, 28 Sep 2026). **Usulan baru #9 grid/patok yard–meter custom, #10 impor drill Pyware, #11 partitur full score/per instrumen + latihan per bar/frasa** ditambahkan ke roadmap; urutan prioritas awal **#5 sisa → #7 → #9 → #10 → #11 → #8**, kini fondasi #9 selesai → **#5 sisa → #7 → #10 → #11 → #8**.
· **#6 rampung (28 Sep 2026)** — Rekaman audio MP3, M4A, WAV, OGG disimpan di IndexedDB
  (Blob). Sidik rekaman biner SHA-256 via WebCrypto + durasi. Penyelarasan titik mulai
  birama 1 ketuk 1 dengan visualisasi waveform canvas, stepper ±10/50ms, tombol "Cek bersama klik",
  koreksi offset per segmen, kontrol dual volume dan mode bunyi (rekaman, klik, keduanya).
  Master clock: audio sinkron dengan metronom, lompat birama, loop ulang bagian (M2),
  tempo latihan (`playbackRate` + `preservesPitch`), dan set list (badge 🎵). Integrasi
  drill: editor scrubber & presenter bergerak selaras dengan linimasa audio, mode kunci
  layar lomba memaksa tempo asli 100%. Mode anggota: "Tambahkan rekaman dari pelatih" dengan
  validasi sidik jari (✔ cocok / ⚠ berbeda), persistensi audio saat pembaruan paket,
  panduan anggota diperbarui dengan tips PWA iOS. Backup + rekaman ZIP lewat `zip.ts`
  dan pemulihan otomatis. Uji: `qa/rekaman-lagu-logika.mjs` (21/21 → 35/35 setelah susulan), 19 rangkaian uji logika lulus.
· **Susulan #6 rampung (28 Sep 2026)** — keluhan "klik melambat/terlambat saat
  metronom diputar bersama lagu" diperbaiki: mesin metronom kini mengikuti **jam
  rekaman** (`JamLagu`), bukan menghitung sendiri sejak tombol ditekan. Klik baru
  mulai setelah rekaman benar-benar berbunyi, tiap birama ditempatkan menurut
  posisi rekaman, dan jadwal yang terlanjur ditanam dibatalkan saat rekaman
  digeser/diulang. Editor & presenter drill ikut memakai titik mulai segmen
  (`detikMulai`) dan laju rekaman yang benar. Uji: `m6-klik-rekaman` 14/14
  (peramban, baru), `uji-birama` 123/123, `uji-gabung-musik` 50/50,
  `rekaman-lagu-logika` 35/35.
· **#4 rampung (27 Sep 2026, PR #10)** — Kendali tempo latihan persen (40–150%) atau
  BPM (−60…+30) di halaman Musik, diterapkan paling akhir pada tempo berlaku, batas
  bawah 20 BPM. Diingat per lagu per perangkat (localStorage). Lencana "Latihan 80%"
  dan "138 BPM (asli 172)" di daftar lagu, panel lagu, dan set list (+ tombol "Semua
  ke tempo asli"). Presenter drill ikut melambat untuk drill yang ditautkan ke lagu;
  layar hari H selalu tempo asli dan memberi peringatan. Naik otomatis saat mengulang
  bagian (M2). Uji: `tempo-latihan-logika` 34/34, `tempo-latihan` 26/26, `musik-anggota` 45/45.
· **#3 bagian kedua rampung (27 Sep 2026, PR #9)** — Kalender baca-saja di mode
  anggota (`src/pages/Share.tsx`, `src/main.tsx`), menampilkan agenda & kalender
  dengan status kehadiran pribadi (Hadir/Izin/Sakit/Alpa/Belum dicatat) dari data
  terenkripsi (#2). Uji: `kalender-anggota` 33/33. #3 tuntas sepenuhnya.
· **#3 bagian pertama rampung (27 Sep 2026, PR #8)** — halaman Jadwal punya tampilan **Bulan**
  (mulai Senin, label per jenis, % hadir sesi lewat, checklist sesi mendatang, detail hari,
  titik di HP), **Agenda** (kartu sesi berikutnya + hitung mundur, per minggu, sesi lewat
  tersembunyi) dan **Daftar** (tampilan lama). Tambahan: ulangi mingguan (ubah *sesi ini* /
  *semua berikutnya*, hapus seri tidak menyentuh sesi berabsensi), duplikat, seret-pindah
  dengan Batalkan, hitung mundur penampilan, cetak bulan (hex), satu `.ics` semua jadwal
  mendatang. Data sesi hanya bertambah `seriId`. Logika di `src/lib/kalender.ts`.
  Uji: `kalender-logika` 67/67, `kalender-jadwal` 31/31; uji lama jadwal tetap lulus.
· **Rancangan lanjutan (26 Sep 2026, pemutakhiran 4 Okt 2026)** — delapan rancangan awal (#1–#4 rampung PR #6–#10). **Tempo map custom (PR #14, 1 Okt 2026) kini terintegrasi penuh ke #5** (`TempoTimeline` + ramp eksplisit per ketuk/subdivisi), dan **#5 Drill × segmen lagu rampung 4 Okt 2026** (penggaris dua baris + ⚡, bantuan hitungan, pecah/gabung set); **#6 Rekaman tuntas** (PR #11 + susulan PR #12). **Usulan #9 grid/patok yard–meter custom, #10 impor drill Pyware, #11 partitur full score/per instrumen + latihan per bar/frasa** menunggu; urutan prioritas **#10 → #11 → #8** (#7 selesai 5 Okt 2026). Rincian di bagian **Rancangan lanjutan** paling bawah.
· **#2 bagian kedua rampung (26 Sep 2026)** — kunci pribadi AES-256-GCM per anggota,
  data pribadi terkunci di berkas terbit, QR kunci, dan tombol Buat kunci baru.
· **#2 bagian pertama rampung (26 Sep 2026)** — satu tombol menerbitkan materi
  grup ke repo GitHub. HP anggota memberitahu bila ada materi baru. Rinciannya
  di **Hasil #2** pada bagian yang sama.
· **#1 rampung (26 Sep 2026)** — satu anggota bisa punya nama panggilan, anggota
  ganda bisa digabung, dan impor tidak lagi diam-diam menambah orang baru.
  Rinciannya di **Hasil #1** pada bagian yang sama.
· **J1 rampung (24 Sep 2026)** — transposisi penala (nada sesuai partitur
  instrumen), ambang predikat laporan bisa diatur, dan panduan 1 halaman
  versi anggota. Rinciannya di bagian **J1** paling bawah. Yang masih
  ditunda tinggal **I1** (log perubahan show).
· **25 dari 29** ide kelompok A–F selesai · 2 dicoret · tidak ada lagi ide yang
  menunggu — kelompok A–F tuntas.
· **Seri musik rampung: M1–M5** — tanda birama & hitung mundur, panjang lagu,
  ulang bagian, set list latihan, dan tukar repertoar antar perangkat.
  Kelompok E tidak ada yang tersisa. Rinciannya di bagian **E**.
· **Seri hari lomba rampung: G1 + G2** — G1 run sheet (apakah rencana hari-H
  muat), G2 layar hari H (posisi tim saat ini & apa yang disiapkan berikutnya).
  Rinciannya di bagian tersendiri di bawah.
· **H1 rampung (19 Sep 2026)** — rencana latihan per sesi + layar pacu yang
  menunjukkan **berapa menit kita sudah melenceng** dan proyeksi jam
  selesainya, supaya blok terakhir tidak kehabisan waktu.
· **Pusat Data rampung (19 Sep 2026)** — menu **Data** menyatukan impor &
  ekspor seluruh fitur: pindah data pilih-pilih (JSON) dan round-trip CSV
  untuk jadwal & absensi, yang sebelumnya hanya bisa keluar tanpa bisa
  masuk kembali.
· **Satu cacat kehilangan data diperbaiki (19 Sep 2026)** — backup tidak
  menyertakan set list, jadi memulihkan dari backup menghilangkannya.
· **Mode asisten presenter rampung: K1–K3** — catatan set, latihan per
  section, dan checklist kemajuan.
· **Seri DD (Drill Display) diistirahatkan sejak 17 Sep 2026** atas permintaanmu,
  sampai ada feedback pemakaian. Tidak ada item DD yang menggantung.
· 2 ide lain ternyata **sudah ada di aplikasi inti** (E2 penuh, E1 sebagian besar).
Dikerjakan satu per satu, dan setiap ide yang selesai dicatat hasilnya di bawah kelompoknya.

> **Hasil kalibrasi 16 Sep 2026.** Daftar ini ditinjau ulang bersama pelatih:
> - **E2 (daftar lagu + tempo map) dicoret** — halaman Musik sudah punya repertoar
>   lagu, tempo map per birama, dan tap tempo.
> - **E1 (metronom aksen & subdivisi) sebagian besar sudah ada** (aksen ketukan 1,
>   pembagian ½/triplet/1-16, ketukan 2–8 per birama); sisanya digabung ke **E3**.
> - **Penala & drone diminta nanti dulu**; yang dikejar lebih dulu adalah
>   **metronom** level Tonal Energy (detail di E3).
> - **C2 & C3 ditunda** sampai anggota benar-benar rutin membuka aplikasi sendiri
>   (hari ini yang memakai baru pelatihnya).
> - **F4 ditunda** — nilainya justru muncul setelah F3, saat ada pelatih kedua
>   yang perlu tahu cara pakai.

> **Hasil kalibrasi 17 Sep 2026.** Daftar ini ditinjau ulang setelah **23 dari 27**
> ide selesai:
> - **E4 (penala & drone) selesai** — dulu kamu minta "nanti dulu". Teruji ±1 sen
>   pada nada uji sintetis, dan mikrofonnya tetap jalan di berkas portabel.
> - **D4 (paket laporan admin) selesai** — keluhan yang dulu paling berat
>   (rekap & administrasi) sudah punya laporan siap serah, kartu kehadiran, dan
>   dua jenis CSV. Ditambah **mode pratinjau** supaya mencetak tidak pernah buntu.
> - **F4 (panduan 1 halaman) selesai** — nilainya justru muncul setelah F3 ada:
>   sekarang ada satu lembar untuk diberikan ke pelatih kedua.
> - **C2 & C3 naik status (17 Sep 2026).** Dulu ditunda karena anggota belum
>   membuka aplikasi — itu masih benar hari ini. Tetapi setelah kamu menyebut
>   rencana komersial dan sasaran tahun depan, keduanya **bukan lagi ide
>   pinggiran**: sisi anggota justru inti dari produk yang akan dijual.
> - **Arah berikutnya (diputuskan 17 Sep 2026): sempurnakan Drill Display dulu.**
>   Kamu memilih *"fitur drill display-nya kita sempurnakan dulu"*, dan pelatih
>   kedua ingin *"lebih detail seperti Pyware"*. **J1 (polesan) ditunda**,
>   G1/H1 tetap menunggu kepastian jadwal lomba.
> - **Pengaman baru:** folder `drillkit/` sekarang punya **git**. Setiap ide yang
>   selesai saya simpan sebagai commit, jadi suntingan yang meleset bisa
>   dikembalikan dengan satu perintah (terjadi sekali, 17 Sep 2026 — untung
>   pulih utuh dari arsip sesi).
>
> **Kalibrasi 17 Sep 2026 — seri Drill Display ditutup.** Sembilan item
> diselesaikan beruntun (DD10, DD10b, DD9, DD7 ditambah yang sebelumnya):
> - **DD10** — koordinat buku saku tidak rancu lagi. Tiga cacat ditemukan dengan
>   menghitung langsung terhadap `field.ts`, yang paling berbahaya **tanda `−`/`+`
>   terbalik di sisi negatif A** (anak bisa berdiri di seberang lapangan).
> - **DD10b** — lahir dari pertanyaanmu tentang angka di kolom "arah & jalan".
>   Ternyata aplikasi mengunci ukuran langkah lalu membiarkan kecepatan berubah,
>   padahal banyak perancang drill memakai cara sebaliknya. Sekarang dua mode
>   tersedia, dan jumlah **tapak langkah** di lapangan ikut berubah sesuai mode.
> - **DD9** — sebagian besar ternyata sudah ada sejak B2; yang ditambahkan
>   **bilah waktu per hitungan** dan **tapak langkah**.
> - **DD7** — impor CSV yang selama ini belum ada; dua bug ketemu saat diuji
>   (nama set tanpa angka menyusut, berkas tanpa judul tidak terbaca).
>
> **Pelajaran yang berulang di seri ini:** hampir setiap cacat berbahaya
> ditemukan dengan **menghitung langsung terhadap kodenya** atau **menguji di
> browser**, bukan dengan membaca ulang logikanya. Karena itu tiap hasil di
> bawah selalu menyertakan angka terukurnya.
>
> **Arah berubah 17 Sep 2026 — Drill diistirahatkan, fokus ke musik.**
> Kamu meminta *"untuk sementara drill kita hold dulu sampai ada feedback
> lagi"*, lalu memilih *"kita fokus ke metronome dan lagu?"*. Maka:
> - **Seri DD (Drill Display) ditutup & diistirahatkan.** Tidak ada item DD
>   yang menggantung; semuanya sudah ✅. Catatan perbaikan dari pemakaian
>   lapangan ditampung di sini sampai kamu memberi feedback.
> - **Kelompok E (Musik & metronom) jadi fokus.** M1 selesai. Kandidat
>   berikutnya yang sudah teridentifikasi: **M2** (ulang bagian/loop),
>   **M3** (playlist & set list latihan), **M4** (tukar repertoar antar
>   perangkat — penting karena ada dua pelatih).
> - **Yang masih menunggu jawaban (per 17 Sep 2026):** jadwal lomba
>   (menentukan G1 vs H1) dan **panjang lagu** — lagu belum punya jumlah
>   birama total, padahal itu syarat untuk M2, M3, dan untuk mengaitkan musik
>   dengan hitungan drill.
>
> **Arah berubah 19 Sep 2026 — musik rampung, lomba dikerjakan, latihan berikutnya.**
> Kedua pertanyaan di atas akhirnya **terjawab dengan dikerjakan, bukan dengan
> diputuskan** — dan satu di antaranya membuat saya menunggu yang salah:
> - **Panjang lagu (M5) selesai**, jadi M2 & M3 tidak terblokir lagi; M4
>   (tukar repertoar antar perangkat) menyusul. **Kelompok E tidak ada yang
>   tersisa.**
> - **G1 & G2 selesai tanpa pernah ada kepastian tanggal lomba.** Catatan
>   untuk diri sendiri: menunggu jadwal lomba itu **alasan yang keliru**.
>   Run sheet & layar hari H berguna juga untuk **gladi resik dan latihan
>   gabungan**, bukan hanya untuk hari-H — jadi nilainya tidak bergantung
>   pada tanggal lomba. Yang betul-betul masih butuh keputusan Anda tinggal
>   **H1 vs H2** (waktu latihan, atau pembinaan orangnya).
>
> **Keadaan tim yang dipakai untuk menilai ide-ide di bawah (per 17 Sep 2026):**
> - **Pemakai:** kamu (laptop + HP) dan **satu pelatih lagi** yang menyusun set
>   sendiri dari berkas portabel. Anggota **belum** membuka aplikasi.
> - **Yang dibuka sehari-hari:** `portable/DrillKit.html` di laptopmu — browsernya
>   lebih tua, jadi warna wajib tetap `hex`/`rgb` (tanpa `oklch()`/`color-mix()`).
> - **Tim:** 40–80 pemain · section **Brass, Battery, Pit, Color Guard, FC** ·
>   langkah **8-to-5 (22,5")** · lapangan **DCI**.
> - **Fase tim:** persiapan lomba + latihan rutin.
> - **Syarat yang tidak berubah:** PWA, offline, **tanpa server & nol biaya**, dan
>   **mencetak tidak boleh buntu** (selalu ada pratinjau atau berkas cadangan).

| Status | Ide |
| --- | --- |
| ✅ Sudah selesai | **A1–A7** (editor formasi) · **B1–B5** (lapangan) · **C1** (sisi anggota) · **D1–D4** (absensi) · **E3, E4** (musik) · **F1–F4** (keandalan data) · **DD1–DD10 + DD10b** (Drill Display) · **M1–M5** (musik, rampung 19 Sep) · **K1–K3** (mode asisten presenter) · **31e** (dasar jarak) · **G1** (run sheet hari lomba) · **G2** (layar hari H) · **H1** (rencana & pacu latihan) · **Pusat Data** (impor/ekspor lintas fitur) · **H2** (evaluasi & kemajuan anggota, rampung 20 Sep) · **G3** (penanda mulai/selesai sesi, rampung 20 Sep) · **G2b** (kunci layar presenter, rampung 20 Sep) · **Berbagi aman** (berkas grup vs per anggota, rampung 20 Sep) · **Kunci mode anggota** (21 Sep) · **Pilihan mode pertama** (layar sambutan, 21 Sep) · **Berkas anggota mengenali pemiliknya** (21 Sep) · **Angka kehadiran anggota jujur** (21 Sep) · **C2** (mode kuis/hafalan, rampung 24 Sep) · **C3** (pengingat jadwal, rampung 24 Sep) · **J1** (polesan: transposisi penala, ambang predikat, panduan anggota — rampung 24 Sep) |
| ⬜ Belum dikerjakan | — |
| 🔜 Kandidat berikutnya | — (menunggu arahanmu; I1 satu-satunya kandidat tersisa) |
| 💤 Ditunda | I1 (log perubahan show — belum pernah jadi masalah) |
| 🚫 Dicoret | E2 (sudah ada di aplikasi inti) · E1 (sisanya sudah masuk E3) |

Daftar ini hanya berisi **tambahan & perbaikan**. Fitur inti yang sudah ada sejak awal
(jadwal & materi, editor formasi dengan bentuk blok/busur/lingkaran/garis, undo,
cetak & ekspor CSV, absensi & rekap, data anggota, metronom, paket berbagi, mode
offline) tidak tercantum di sini — anggap itu sudah jalan.
**Riwayat pengerjaan:**

| Tanggal | Ide | Intinya |
| --- | --- | --- |
| 16 Sep 2026 | **A4** | Geser & animasi mulus untuk 40–80 pemain (teruji sampai 160) |
| 16 Sep 2026 | **A1 + A2** | Pilih banyak titik (kotak pilih, shift-klik, Ctrl+A) + alat sejajarkan / ratakan jarak / putar / cermin |
| 16 Sep 2026 | **B1** | Mode Presenter layar penuh untuk dipakai di lapangan |
| 16 Sep 2026 | **F1** | Pengingat backup otomatis + riwayat backup + uji pulihkan data |
| 16 Sep 2026 | **C1** | Halaman anggota: navigasi set, animasi perpindahan, asal & tujuan, catatan evaluasi pribadi |
| 16 Sep 2026 | **D1** | Scan QR beruntun: kamera menyala terus, bunyi + getar tiap berhasil, daftar "baru saja masuk" dengan tombol batal |
| 16 Sep 2026 | **F2** | Mode kios / kunci data: aplikasi cuma bisa dilihat saat terkunci, bisa dipasangi PIN |
| 16 Sep 2026 | **A3** | Duplikat & salin set: duplikat tersisip di tempat, salin ke/ambil dari set lain (bisa banyak set sekaligus), undo satu kali |
| 16 Sep 2026 | **A5** | Jejak gerakan & panah arah: asal (kuning) & tujuan (biru), titik hantu, angka jarak langkah, bisa dihidupkan/dimatikan |
| 16 Sep 2026 | **D2** | Rekap tren: grafik per bulan, perbandingan antar bulan, penanda anggota dengan kehadiran rendah/menurun |
| 16 Sep 2026 | **A6** | Shortcut keyboard lengkap + lembar contekan (`?`), dan perbaikan: tombol Escape kini selalu menutup dialog pada tekanan pertama |
| 16 Sep 2026 | **A7** | Penanda bebas di lapangan: properti, kotak area, garis bantu, panah, dan teks — bisa dipetik langsung dari lapangan, ikut ke presenter & dot sheet |
| 16 Sep 2026 | **B2** | Kontrol animasi: garis waktu (scrub), kecepatan 0,25–2×, ulang terus, mainkan hanya 1 section |
| 16 Sep 2026 | **F3** | Berbagi show dua arah: ekspor satu show jadi berkas .json, pelatih lain susun set di perangkatnya, kirim balik lalu digabung (timpa / gabung / salinan) |
| 16 Sep 2026 | **E3 + B5** | Metronom lanjutan: pola ritme & aksen per birama, poliritme, latih tempo, pilihan bunyi, getar — plus klik tempo yang menyertai animasi & urutan latihan |
| 16 Sep 2026 | **B4** | Tampilan kontras tinggi & huruf besar: dua saklar (disimpan) + chip cepat di presenter, lapangan ikut lebih pekat |
| 16 Sep 2026 | **D3** | Jenis kegiatan absensi: latihan section / gabungan / penampilan bisa dibedakan, disaring, dan direkap terpisah |
| 16 Sep 2026 | **B3** | Mode urutan latihan (run-through): semua set dimainkan berurutan mengikuti tempo, dengan jeda & ulang |
| 16 Sep 2026 | **D4** | Paket laporan admin: laporan bulanan siap serah (kop, ringkasan, ruang tanda tangan), kartu kehadiran per anggota, paket lengkap 1 berkas, CSV matriks & ringkas |
| 17 Sep 2026 | **D4** | Tambahan: **mode pratinjau** untuk laporan & kartu (mirip buku saku) — hasil tampil di dalam aplikasi, baru unduh/cetak |
| 17 Sep 2026 | **E4** | Penala & nada dengung: deteksi nada dari mikrofon (±1 sen pada nada uji), dengung dengan nada kelima, tombol cepat Bb/F/Eb/A konser, mikrofon dilepas otomatis |
| 17 Sep 2026 | **F4** | Panduan 1 halaman: dibuat otomatis dari data tim, teruji **1 halaman A4** juga pada kasus terberat; tombol di Dashboard & kartu di Pengaturan |
| 18 Sep 2026 | **Rotasi lingkaran berjalan** | Lingkaran ikut berputar mengikuti jalannya formasi |
| 18 Sep 2026 | **Ambang kesulitan gerak** | Analitik & buku saku diseragamkan; ambangnya bisa diatur |
| 18 Sep 2026 | **K1** | Mode asisten di presenter: catatan set akhirnya bisa diisi, chip cepat |
| 18 Sep 2026 | **K2** | Mode asisten latihan per section |
| 18 Sep 2026 | **K3** | Checklist kemajuan: tabel tersendiri, kunci centang per seksi |
| 17–19 Sep 2026 | **M5, M2, M3** | Panjang lagu · ulang bagian + loncat segmen tempo · set list latihan |
| 19 Sep 2026 | **M4** | Tukar repertoar antar perangkat: lagu + set list + drill yang merujuknya |
| 19 Sep 2026 | **31e** | Dasar jarak: `jalur` (sepanjang lintasan) atau `lurus` (garis lurus), pilihan perancang drill |
| 19 Sep 2026 | **G1** | Run sheet hari lomba: satu linimasa, status cukup / melebihi / tak pasti, bisa diunduh & dicetak |
| 19 Sep 2026 | **G2** | Mode lomba: layar hari H — jam berjalan, sisa slot, hitung mundur, set list, daftar persiapan |
| 19 Sep 2026 | **H1** | Rencana latihan per sesi + layar pacu: blok waktu, geser dari realisasi, proyeksi jam selesai |
| 19 Sep 2026 | **Perbaikan** | Backup tidak menyertakan set list — pulihkan dari backup menghilangkan seluruh set list & merusak run sheet |
| 19 Sep 2026 | **Pusat Data** | Menu Data: pindah data pilih-pilih (JSON) + round-trip CSV jadwal & absensi, konfirmasi sebelum menulis |

**Cara membaca:**

| Kolom | Arti |
| --- | --- |
| Dampak | ⭐ = sedikit terasa, ⭐⭐⭐⭐⭐ = mengubah cara kerja kamu |
| Usaha | **Kecil** = satu sesi selesai · **Sedang** = 1–2 sesi · **Besar** = beberapa sesi |

---

## A. Editor formasi (menu Drill) — tempat kamu paling banyak menghabiskan waktu

| # | Ide | Masalah yang dipecahkan | Dampak | Usaha |
| --- | --- | --- | --- | --- |
| A1 | **✅ SELESAI — Pilih banyak titik sekaligus** (seret kotak pilih / shift-klik / Ctrl+A), lalu geser, sejajarkan, atau rotasi bersama | Menggeser 12 orang satu-satu = capek & tidak presisi | ⭐⭐⭐⭐⭐ | Sedang |
| A2 | **✅ SELESAI — Alat susun**: sejajarkan, ratakan jarak, putar 15°/90°, cermin kiri–kanan & depan–belakang (bentuk blok/busur/lingkaran/garis sudah ada sebelumnya) | Menyusun blok/baris rata sekarang dilakukan manual | ⭐⭐⭐⭐⭐ | Sedang |
| A3 | **✅ SELESAI — Duplikat & salin set**: "set 5 = set 4", salin formasi ke set lain (bisa beberapa set sekaligus) | Set yang mirip harus digambar ulang dari nol | ⭐⭐⭐⭐ | Kecil |
| A4 | **✅ SELESAI — Performa 40–80 pemain** (uji nyata + penyederhanaan render) | Kriteria ini sudah diuji: geser & animasi kini tidak me-render ulang seluruh titik tiap frame | ⭐⭐⭐⭐⭐ | Sedang |
| A5 | **✅ SELESAI — Jejak gerakan & panah arah** antar set: asal (kuning), tujuan (biru), titik hantu, angka jarak — bisa dihidupkan/dimatikan | Sulit menjelaskan "kamu jalan ke mana" tanpa gambar | ⭐⭐⭐⭐ | Kecil |
| A6 | **✅ SELESAI — Shortcut keyboard**: panah = geser 1 langkah, spasi = mainkan animasi, Ctrl+D = duplikat | Kerja lebih cepat saat di laptop | ⭐⭐⭐ | Kecil |
| A7 | **✅ SELESAI — Penanda bebas di lapangan** (properti, bendera, garis bantu) | Kadang butuh tanda yang bukan pemain | ⭐⭐ | Sedang |

**Hasil A7 (diuji 16 Sep 2026):**

- **Lima jenis penanda**, semuanya teruji tampil di lapangan:
  | Jenis | Kegunaan | Hasil uji |
  |---|---|---|
  | **Titik / properti** | podium, drum besar, bendera | lingkaran berlabel "Bendera", jari-jari bisa diatur |
  | **Kotak / area** | area properti, zona latihan | "Podium" −8,4 → 8,−4 (langkah) tergambar |
  | **Garis bantu** | garis lurus pembantu | "Garis latihan" −20,0 → 20,0 |
  | **Panah arah** | arah masuk/keluar | panah dengan ujung segitiga |
  | **Teks / label** | tulisan bebas di lapangan | teks "GARIS 40" tampil |
- **Koordinat bisa diketik atau dipetik**: tombol **Petik dari lapangan** menutup dialog
  lalu menunggu sentuhan di lapangan (dua kali untuk penanda berujung). Teruji: petunjuk
  muncul, dialog kembali terbuka dengan koordinat terisi (29 ; 8,25 langkah), dan **Esc**
  membatalkan pemetikan tanpa meninggalkan mode aneh. Penanda bisa diubah (✎) dan
  dihapus (✕ → "Yakin?").
- **Tersimpan per drill**, jadi tampil di semua set: teruji tetap ada setelah halaman
  dimuat ulang, dan sudah ikut ke **cadangan/backup** karena tersimpan di data drill.
- **Ikut ke mana-mana**: tampil di **mode presenter** (agak diredup supaya pemain tetap
  menonjol) dan jadi tabel **Penanda lapangan** di dot sheet/buku saku yang dicetak
  (teruji: pratinjau cetak memuat tabel itu).
- **Tombol M** menyembunyikan/menampilkan penanda; ada juga tombolnya di kartu Alat,
  dan daftar 18 shortcut sudah memuatnya.
- **Rapi di HP**: dialog penanda tidak meluber di layar 390 px (tombol Petik, Batal,
  Simpan tetap muat).
- **Selaras dengan mode kios**: saat data dikunci, tombol "+ Penanda" ditolak —
  penanda tidak bisa ditambah oleh yang cuma boleh melihat.
- Teruji ulang di **versi produksi** dan **versi portabel** (`DrillKit.html`): penanda
  tersimpan, bertahan setelah dimuat ulang, ikut ke presenter, **0 error**.

---

**Hasil A6 (diuji 16 Sep 2026):**

- **Lembar contekan**: tombol **?** di pojok kanan toolbar (atau tombol `?` pada keyboard)
  membuka daftar 17 shortcut, dikelompokkan jadi **Pilihan & menggeser**, **Set & animasi**,
  dan **Tampilan**. Tombol `?` lagi atau **Esc** menutupnya.
- **Tombol baru yang teruji berjalan:**
  | Tombol | Aksi | Hasil uji |
  |---|---|---|
  | `Spasi` | Mainkan / jeda perpindahan | 18 titik bergerak, tombol berubah jadi hitungan count |
  | `Ctrl+D` | Duplikat set aktif | 2 → 3 set, langsung pindah ke salinannya |
  | `[` / `]` | Set sebelumnya / berikutnya | "Set 1 — Blok" ⇄ "Set 2 — Busur" |
  | `Delete` | Keluarkan titik terpilih dari set | 18 titik terpilih → 0, lalu **Ctrl+Z** mengembalikan 18 |
  | `K` | Kode pemain hidup/mati | pengaturan tersimpan, bertahan setelah dimuat ulang |
  | `J` | Jejak gerak hidup/mati | 18 jejak → 0 → 18 |
- **Aman saat mengetik**: fokus di kolom nama set lalu menekan `K`, `J`, `F` → hurufnya masuk
  ke kolom ("Set 1 — Blokkjf"), jejak tidak berubah, dan presenter tidak terbuka.
- **Selaras dengan mode kios (F2)**: saat data dikunci, `]` dan `J` tetap jalan (cuma melihat),
  sedangkan `Ctrl+D` ditolak dengan pesan "Terkunci" — jumlah set tidak bertambah.
- **Perbaikan bawaan yang ikut ke mana-mana**: komponen `Modal` (`src/components/ui.tsx`)
  dulu memasang ulang *listener* Escape setiap kali induknya render ulang, jadi tekanan
  Escape pertama sering **hilang** dan dialog baru menutup pada tekanan kedua. Sekarang
  `onClose` disimpan di ref, listener terpasang sekali selama dialog terbuka. Teruji:
  Escape sekali langsung menutup dialog shortcut, **salin set**, **tambah anggota**,
  dan **kunci data**.
- Teruji ulang di **versi produksi** dan **versi portabel** (`DrillKit.html`): 17 baris
  daftar shortcut, Escape, `[`/`]`, Spasi, `J`, dan `Ctrl+D` semuanya berjalan, **0 error**.

---

**Hasil A5 (diuji 16 Sep 2026):**

- **Dua jejak sekaligus**, masing-masing bisa dinyalakan sendiri:
  - **kuning** = jejak MASUK, dari posisi pemain di set sebelumnya ke posisinya sekarang
    (*dari mana ia datang*);
  - **biru** = jejak KELUAR, dari posisi sekarang ke set berikutnya (*ke mana ia jalan*).
- **Panah arah** di ujung tiap jejak (bisa dimatikan), **titik hantu** — lingkaran
  putus-putus di posisi asal & tujuan — dan **angka jarak** tempuh dalam **langkah**
  (contoh terbaca: 13, 17, 21 langkah), jadi kamu bisa melihat mana gerakan yang
  terlalu jauh untuk count yang tersedia.
- **Jejak hanya untuk titik terpilih**: pilih 1–3 titik dan jejak pemain lain
  menghilang — teruji: saat 2 titik dipilih, cuma 2 jejak yang digambar, lengkap
  dengan panah, titik hantu, dan angkanya.
- **Pilihan diingat** (disimpan di `localStorage`): setelah dimuat ulang, keadaan
  tombol-tombolnya sama persis seperti terakhir dipakai.
- **Rapi di ujung**: di set terakhir tidak lagi digambar garis nol (dulu `nextSet`
  menunjuk ke set itu sendiri); pemain yang tidak berpindah juga tidak digambari garis.
- **Mode presenter ikut dapat panah & titik hantu** — di layar lapangan, panahnya
  dibuat lebih besar supaya kelihatan dari jauh (teruji: 18 jejak, 18 panah, 18 titik hantu).
- **Performa tetap 60 fps**: diuji dengan **80 pemain** sambil menggeser titik —
  jejak hidup (80 garis), semua hidup (240 elemen: garis + titik hantu + angka),
  dan jejak mati, semuanya **0 long task, 17 ms per frame**.
- Teruji di **versi produksi** dan **versi portabel** (`DrillKit.html`): jejak &
  panah tampil, panah bisa dimatikan, angka jarak terbaca. **0 error**.

---

**Hasil A4 (diuji 16 Sep 2026, Chrome headless, 80 pemain & 8 set):**

| Kegiatan | Sebelum | Sesudah |
| --- | --- | --- |
| Geser 1 titik | 5 frame tersendat, paling lambat 67 ms, 1 "long task" 56 ms | 0 frame tersendat, paling lambat 17 ms |
| Geser 12 titik sekaligus | 0 frame tersendat | 0 frame tersendat |
| Animasi antar set | 49 fps, 29 frame tersendat, paling lambat 50 ms | 60 fps, 0 frame tersendat, paling lambat 17 ms |
| Geser 160 pemain (uji ketahanan) | — | 2 frame tersendat dari ~170 |

Yang diubah: (1) saat menggeser, titik digerakkan langsung lewat atribut
`transform` pada elemen `<g>`-nya — React tidak di-render ulang tiap gerakan;
(2) `pointermove` digabung per frame dengan `requestAnimationFrame` supaya
mouse/layar 120 Hz tidak membanjiri aplikasi; (3) animasi antar set juga
digerakkan lewat `transform`, bukan lewat state React; (4) pencarian anggota
yang sebelumnya O(n²) diganti peta (Map).

---

**Hasil A1 & A2 (diuji 16 Sep 2026):**

- **Kotak pilih (marquee)**: seret di area kosong → semua titik di dalam kotak
  terpilih. Kotaknya digambar langsung lewat atribut elemen (ringan untuk 80 pemain),
  hilang otomatis setelah selesai, dan klik tanpa menggeser mengosongkan pilihan.
- **Ctrl+A** memilih semua titik yang tampil, **Esc** membatalkan pilihan.
- **Sejajarkan**: kiri / tengah / kanan / atas / tengah / bawah — teruji tepat
  (mis. semua x menjadi 4 saat "kiri", semua y menjadi -14 saat "atas").
- **Ratakan jarak** mendatar & vertikal: teruji sama rata sampai 2 desimal.
- **Putar 15° & 90°**: posisi berputar mengelilingi titik tengah pilihan dan
  **arah hadap ikut berputar** (depan→kiri→belakang→kanan) — supaya chart tidak menyesatkan.
- **Cermin** kiri–kanan & depan–belakang di tempat (blok tidak berpindah),
  arah hadap ikut dicerminkan (kiri↔kanan, depan↔belakang).
- Semua operasi bisa di-**undo** dengan Ctrl+Z — teruji kembali ke posisi & hadap semula.

---

**Hasil A3 (diuji 16 Sep 2026):**

- **Duplikat** (`⧉ Duplikat`): salinan kini **tersisip tepat setelah set aktif** dan nomor
  urut set sesudahnya digeser — dulu salinan selalu muncul di akhir daftar, jadi
  urutannya melompat. Nama tidak dobel: "Set 1 (salinan)" disalin lagi tetap
  menjadi "Set 1 (salinan)", bukan "Set 1 (salinan) (salinan)". Setelah menyalin,
  set yang aktif langsung pindah ke salinannya.
- **Salin ke…**: isi set aktif dikirim ke **satu atau beberapa** set lain sekaligus
  (tinggal centang daftarnya) — cocok untuk "set 5 sampai 8 sama dengan set 4".
- **Ambil dari…**: kebalikannya — set aktif diisi dari set lain yang dipilih.
- **Dua pilihan isi**:
  - *Semua titik* atau *hanya titik yang sedang dipilih* (jadi bisa memindahkan
    separuh formasi saja tanpa menyentuh sisanya);
  - *Ganti isi* (target jadi sama persis) atau *Tambahkan* (titik yang sudah ada
    di target dibiarkan).
- **Satu Ctrl+Z untuk semuanya**: menyalin ke 3 set sekaligus cukup dibatalkan
  sekali. Caranya — riwayat undo/redo diubah agar satu langkah bisa berisi
  beberapa set (`snapshotMany` di `src/pages/Drill.tsx`), bukan cuma satu set.
- Teruji: salinan tersisip di urut 0‑1‑2 dengan isi sama persis; mode *Tambahkan*
  mempertahankan titik yang hanya ada di target (target tetap 18 saat sumber 17),
  sedangkan *Ganti isi* merapikannya jadi 17; menyalin 2 titik terpilih menghasilkan
  target berisi tepat 2 titik; **Ambil dari…** mengisi set aktif dari sumbernya.
- Juga teruji di **versi produksi** dan **versi portabel** (`DrillKit.html`):
  duplikat menghasilkan 3 set dengan salinan di urut 1, lalu *Salin ke…* membuat
  isi target sama persis dengan sumber. Semuanya **0 error**.

---

## B. Dipakai saat latihan di lapangan

| # | Ide | Masalah yang dipecahkan | Dampak | Usaha |
| --- | --- | --- | --- | --- |
| B1 | **✅ SELESAI — Mode Presenter**: formasi layar penuh, tombol ‹ › besar, bisa di-tap di HP saat berdiri | Di lapangan, menu & tombol kecil sulit dipakai | ⭐⭐⭐⭐ | Kecil |
| B2 | **✅ SELESAI — Kontrol animasi**: garis waktu (scrubber), atur kecepatan, ulang terus, mainkan hanya 1 section | Animasi sudah ada, tapi belum bisa diatur/detail | ⭐⭐⭐⭐ | Sedang |
| B3 | **✅ SELESAI — Mode "urutan latihan"**: mainkan set 1→8 otomatis mengikuti tempo lagu | Menjalankan run-through tanpa pegang HP terus | ⭐⭐⭐⭐ | Sedang |
| B5 | **✅ SELESAI — Klik tempo saat latihan**: metronom menyertai animasi & urutan latihan (memakai mesin E3) | B3 berjalan tanpa bunyi — pelatih menonton tapi tak mendengar ketukan | ⭐⭐⭐⭐ | Kecil (setelah E3) |
| B4 | **✅ SELESAI — Tampilan kontras tinggi & huruf besar**: dua saklar di Pengaturan + chip **Kontras**/**Huruf** di presenter, lapangan ikut lebih pekat | Layar HP sulit dibaca di luar ruangan | ⭐⭐⭐ | Kecil |

**Hasil B4 (diuji 16 Sep 2026):**

**Dua saklar, bisa sendiri-sendiri atau bersamaan** — ada di **Pengaturan →
Tampilan layar**, dan juga tersedia sebagai chip **Kontras** dan **Huruf** di
presenter supaya bisa diubah tanpa keluar dari layar latihan:

- **Kontras tinggi** — latar menjadi hitam penuh, teks kecil yang biasanya
  redup diterangkan (`#62748e` → `#e7eef7`), batas kartu & isian dipertegas
  (`#1d293d` → `#8b98ab`), warna emerald/amber dibuat lebih menyala, dan unsur
  yang sengaja diredupkan (riwayat lewat, mode kios) dikembalikan penuh.
  Teruji: latar `rgb(0,0,0)`, teks `rgb(255,255,255)`.
- **Huruf besar** — seluruh antarmuka membesar karena ukuran Tailwind memakai
  `rem`: mengubah `font-size` di `<html>` (16 → 19 px) saja sudah cukup.
  Teruji: tinggi tombol 38 → 45 px, lebarnya 191 → 227 px.
- **Keduanya diingat** setelah aplikasi dimuat ulang (teruji di versi produksi
  maupun portabel), dan bisa dimatikan lagi kapan saja.

**Lapangan ikut menyesuaikan:** rumput digelapkan (`#166534` → `#04240f`),
garis yard, hash, dan sideline dijadikan putih penuh, label yard diterangkan,
serta cincin luar titik pemain mengikuti latar yang sekarang hitam. Semua
lewat CSS statis — **tanpa filter**, jadi animasi 80 pemain tetap ringan.

- **Rapi di HP**: diuji pada layar 390 px dengan kedua mode menyala di **tujuh
  halaman** (dasbor, anggota, absensi, jadwal, drill, musik, pengaturan) —
  tidak ada geser mendatar, tidak ada teks terpotong, dan baris chip presenter
  tidak meluber (chip 30 → 35 px).
- **Selaras dengan mode kios**: chip di presenter tetap terang (opacity 1) dan
  tetap bisa ditekan saat data dikunci — teruji menyala dari dalam presenter.
- Teruji di **versi produksi** dan **versi portabel** (`DrillKit.html` dibuka
  langsung dari berkas): saklar, chip, dan perubahan lapangan jalan, **0 error**.
- Catatan jujur: huruf besar memperbesar *seluruh* antarmuka, jadi beberapa
  halaman perlu digeser lebih panjang — itu wajar. Kalau terasa kebesaran,
  tinggal matikan satu saklarnya.


**Hasil B3 (diuji 16 Sep 2026):**

**Mode presenter** (tempat utamanya — dipakai sambil berdiri di lapangan):

- Tombol besar **▶▶ Urutan latihan**: menjalankan semua set berurutan mengikuti
  tempo & jumlah count tiap set. Teruji dengan 4 set: **Set 1 → Set 2 → Uji 1 →
  Uji 2** berjalan sendiri tanpa disentuh, lalu berhenti di set terakhir.
- **Diam dulu di tiap formasi** supaya sempat dilihat — chip **Diam 0/2/4/8 ct**
  mengatur lamanya (bawaan 2 count).
- Chip **↻ Ulang urutan**: setelah set terakhir, kembali ke set pertama dan terus
  berputar. Teruji: 1/4 → 2/4 → 3/4 → 4/4 → **1/4**.
- Tombol **R** menjalankan/menghentikan urutan. Kalau ditekan saat sudah di set
  terakhir, urutan **mulai lagi dari set pertama** (tidak "nggak ngefek").
- **Ketuk layar** atau tombol ‹ › langsung menghentikan urutan — pelatih tetap
  pegang kendali kapan saja.
- Hitungan count berjalan di sebelah tombol, jadi kelihatan posisi gerakan.

**Editor** (untuk meninjau di laptop): tombol **▶▶** di bilah animasi menjalankan
semua set berurutan dan berhenti di set terakhir; tombol **R** sama fungsinya.

- **Rapi di HP**: tombol urutan setinggi 44 px dan lebarnya mengikuti layar 390 px.
- **Selaras dengan mode kios**: urutan latihan tetap bisa dijalankan saat data
  dikunci (cuma melihat) — teruji berjalan di set 3/4 dalam keadaan terkunci.
- Teruji ulang di **versi produksi** dan **versi portabel** (`DrillKit.html`):
  urutan berjalan melewati keempat set, lalu **R** mengulang dari set pertama,
  **0 error**.

---

**Hasil B2 (diuji 16 Sep 2026):**

Bilah **kontrol animasi** sekarang ada tepat di bawah lapangan:

| Kontrol | Kegunaan | Hasil uji |
|---|---|---|
| **▶ / ⏸** | Mainkan / jeda | 18 titik bergerak mengikuti tempo |
| **Garis waktu** | Geser untuk melihat posisi di tengah perpindahan | pada 50% jaraknya **setengah** dari jarak penuh (4,04 → 8,07 satuan), label count ikut |
| **⏹** | Kembali ke posisi awal set ini | semua transform dibersihkan, slider ke 0 |
| **Kecepatan** | 0,25× · 0,5× · 1× · 1,5× · 2× | durasi 8,0 detik → **4,0 detik** pada 2× dan **16,0 detik** pada 0,5× |
| **↻ Ulang** | Mengulang perpindahan ini terus-menerus | setelah lewat satu putaran slider kembali ke 0,295 dan **set tidak pindah** |
| **Section** | Mainkan hanya 1 section | Brass = **5 titik** bergerak (dari 5 anggota brass); Battery 3, Pit 2, Color Guard 4 |
| — | Tanpa ulang: selesai → lanjut ke set berikutnya | "Set 1 — Blok" → "Set 2 — Busur" |

- **Tanpa mengorbankan kinerja**: posisi animasi tidak disimpan di state React
  (itu akan memicu render 60×/detik) — garis waktu dan label count diperbarui
  langsung lewat DOM. Teruji dengan **80 pemain**: **0 longtask**, frame
  **17 ms** (60 fps), 80 titik bergerak.
- **Kecepatan & ulang bisa diubah saat animasi berjalan** (disimpan di ref, bukan
  di state yang memicu ulang dari nol) dan **pengaturannya diingat** setelah
  dimuat ulang halaman.
- **Tombol L** menyalakan/mematikan ulang terus; daftar shortcut sudah memuatnya.
- **Rapi di HP**: di layar 390 px bilahnya setinggi **95 px** (dua baris) dan
  tidak meluber.
- **Selaras dengan mode kios**: saat data dikunci, animasi tetap bisa dimainkan
  (cuma melihat) — teruji 18 titik bergerak dalam keadaan terkunci.
- Teruji ulang di **versi produksi** dan **versi portabel** (`DrillKit.html`):
  scrub, mainkan, kecepatan, satu section, dan ulang terus semuanya jalan,
  **0 error**.

---

**Hasil B1 (diuji 16 Sep 2026):**

- Dibuka dari tombol ⛶ di toolbar editor atau tombol **F**.
- Tampilan penuh layar: judul show, nama set, nomor set, jumlah count.
- **Ketuk layar = maju** ke set berikutnya (bisa dimatikan lewat chip *Ketuk = maju*).
- Tombol **‹** dan **›** setinggi 64 px (enak untuk jari), plus tombol **Mainkan**
  yang menjalankan perpindahan ke set berikutnya sesuai tempo.
- Keyboard: ← → ganti set, Spasi mainkan/jeda, Esc tutup.
- Chip tampilan: **Kode** (kode pemain), **Jalur** (garis gerak), **Putar layar**
  (lapangan diputar 90° agar memenuhi layar HP yang berdiri — otomatis aktif
  kalau layar lebih tinggi dari lebarnya), **Ketuk = maju**.
- Layar ditahan agar tidak mati selama presenter terbuka (Screen Wake Lock,
  kalau browser mendukung; kalau tidak, dilewati tanpa pesan).
- Menutup presenter akan memindahkan set aktif di editor ke set terakhir yang dilihat.

---

## C. Sisi anggota (yang mereka buka sendiri)

| # | Ide | Masalah yang dipecahkan | Dampak | Usaha |
| --- | --- | --- | --- | --- |
| C1 | **✅ SELESAI — Halaman anggota lebih kaya**: posisiku + set sebelumnya & berikutnya + catatan evaluasi pribadi + animasi perpindahan | Sekarang "Posisiku" masih sederhana | ⭐⭐⭐⭐ | Sedang |
| C2 | **✅ SELESAI — Mode kuis/hafalan**: tebak posisi sendiri di set berikutnya dengan mengetuk peta | Anggota bisa berlatih mandiri | ⭐⭐⭐ | Sedang |
| C3 | **✅ SELESAI — Pengingat jadwal latihan**: spanduk saat dibuka + notifikasi sistem + berkas kalender (.ics) | Anggota lupa jadwal | ⭐⭐⭐ | Sedang |

**Hasil C1 (diuji 16 Sep 2026):**

- **Tab Formasi anggota** diperbarui:
  - tombol **‹ ›** besar (48 px) untuk pindah set, pengganti dua pilihan dropdown;
  - info **"Dari Set …"** (asal: jumlah count, jarak langkah, koordinat) sehingga anggota
    tahu dari mana ia datang — bukan hanya ke mana ia pergi;
  - tombol **Putar perpindahan**: animasi ke set berikutnya sesuai tempo, lalu set aktif maju
    (teruji: 18 titik bergerak, set 1 → 2, tidak ada sisa `transform`).
- **Catatan evaluasi pribadi** (fitur baru):
  - tabel baru `memberNotes` di database (versi skema 3, `id, memberId, at`);
  - pelatih menulisnya di **Anggota → edit anggota → Catatan evaluasi** (bisa dihapus);
  - ikut terbawa ke **paket berbagi** dan ke **backup** (juga ikut dipulihkan saat restore);
  - anggota membacanya di tab **Catatan**.
- **Privasi teruji**: catatan milik satu anggota tidak muncul di akun anggota lain
  (anggotanya melihat "Belum ada catatan").
- **Uji alur penuh** di *versi produksi* maupun *versi portabel* (`DrillKit.html`),
  murni lewat antarmuka (tanpa menyentuh database langsung): tulis catatan → ekspor
  paket → buka sebagai anggota → catatan terbaca. Keduanya **0 error**.

**Hasil C2 (diuji 24 Sep 2026):**

- **Tab Kuis** di halaman anggota: satu soal per perpindahan set — peta
  menampilkan set asal (titik sendiri berlingkaran emas) *tanpa* garis
  perpindahan, anggota mengetuk tebakannya lalu mengunci jawaban.
- **Benar bila dalam 2 langkah** dari kunci; sesudah dikunci tampil jarak
  tebakan, koordinat kunci, dan skor sesi. Urutan soal mengikuti set, bisa
  diacak. Baca-saja: tidak menulis ke database, aman untuk kios.
- **Dua rangkaian uji baru**: `uji-kuis` (25 uji logika murni) dan
  `kuis-anggota` (31 uji end-to-end: ketukan tepat → Tepat, sudut terjauh →
  Belum tepat, geser penanda, skor akhir, ulangi, acak, dan lebar 360px).

**Hasil C3 (diuji 24 Sep 2026):**

- **Spanduk "jadwal terdekat"** di Dashboard pelatih dan tab Jadwal anggota:
  sesi hari ini & besok, bisa ditutup per sesi sampai besok. Tanpa server
  tidak ada alarm sungguhan — dan dokumen kodenya berkata begitu.
- **Notifikasi sistem** sekali per sesi per hari, bila aplikasinya dibuka,
  sesinya dalam 3 jam ke depan, dan izinnya diberikan (tombolnya di
  spanduk, tidak otomatis meminta).
- **Tombol Kalender (.ics)** di tiap sesi (pelatih & anggota): berkasnya
  memuat dua alarm (H-1 dan sejam sebelumnya) — dialah pengingat yang
  berjalan saat aplikasi tutup, dipegang kalender HP.
- **Dua rangkaian uji baru**: `uji-pengingat` (50 uji logika murni) dan
  `pengingat-jadwal` (25 uji end-to-end: spanduk, tutup-ingatkan,
  notifikasi tercatat sekali, .ics valid, dan lebar 360px).

---

## D. Absensi & rekap

| # | Ide | Masalah yang dipecahkan | Dampak | Usaha |
| --- | --- | --- | --- | --- |
| D1 | **✅ SELESAI — Scan QR beruntun**: kamera terus menyala, bunyi/getar tiap berhasil, daftar "baru saja masuk" dengan tombol batal | Sekarang sekali scan = sekali klik ulang | ⭐⭐⭐⭐ | Kecil |
| D2 | **✅ SELESAI — Rekap tren**: grafik per bulan, bandingkan antar bulan, tandai anggota yang jarang hadir | Rekap sudah ada, tapi belum menunjukkan *arah* | ⭐⭐⭐ | Sedang |
| D4 | **✅ SELESAI — Paket laporan admin**: laporan bulanan siap serah (kepala, ringkasan, ruang tanda tangan) + **kartu kehadiran per anggota** + ekspor CSV yang rapi dibuka di Excel/HP | Urusan rekap & administrasi masih terasa berat | ⭐⭐⭐ | Sedang |
| D3 | **✅ SELESAI — Jenis kegiatan**: absensi latihan section vs latihan gabungan vs penampilan, bisa disaring & direkap terpisah | Rekap jadi lebih bermakna | ⭐⭐⭐ | Sedang |

**Hasil D3 (diuji 16 Sep 2026):**

- **Enam jenis kegiatan**: *Latihan rutin*, *Latihan section*, *Latihan gabungan*,
  *Penampilan / konser*, *Rapat*, *Lainnya* — masing-masing punya warna badge
  sendiri, tampil di jadwal, dasbor, dan halaman absensi. Data lama (4 jenis
  sebelumnya) tetap terbaca, tidak ada yang perlu diubah.
- **Kartu "Kehadiran per jenis kegiatan"** di tab **Rekap**: satu baris per jenis
  berisi jumlah sesi, persentase hadir, dan jumlah `hadir/tercatat` — langsung
  kelihatan bedanya. Teruji dengan 18 anggota & 7 sesi: **Latihan section 81%**
  (29/36), **Latihan gabungan 53%** (19/36), **Penampilan / konser 31%** (11/36),
  **Latihan rutin 67%** (12/18).
- **Penyaring "Jenis kegiatan"** ada di tiga tempat:
  - **Rekap** — teruji: memilih *Penampilan / konser* menyisakan 1 baris di kartu
    per jenis, grafik tren tinggal 1 bulan (Agu), dan tabel per anggota ikut
    tersaring.
  - **Isi absensi** — daftar sesi ikut tersaring (7 sesi → 2 sesi untuk
    *Penampilan*), badge jenis tampil di bawah pilihan sesi, dan sesi aktif
    berpindah otomatis kalau sesi yang dipilih tidak termasuk penyaring.
  - **Jadwal** — teruji: 7 jadwal → 2 jadwal saat disaring *Penampilan / konser*.
  Pilihan penyaring menampilkan **jumlah sesi per jenis**, jadi kelihatan mana
  yang kosong tanpa perlu menebak.
- **Ikut ke ekspor**: CSV sekarang memuat blok **Kehadiran per jenis kegiatan**
  dan kolom `Jenis` di baris judulnya; hasil cetak menambah tabel
  **Per jenis kegiatan** (teruji: keempat jenis tercetak benar).
- **Rapi di HP**: diuji pada layar 390 px — baris per jenis lebarnya 324 px dan
  kartunya tidak meluber; pilihan penyaring 152 px, masih nyaman disentuh.
- **Aman dipakai anggota**: badge jenis di dasbor memakai `sesiMeta()` yang selalu
  punya nilai cadangan, jadi tidak mungkin kosong/eror meski datanya aneh.
- Teruji di **versi produksi** dan **versi portabel** (`DrillKit.html` dibuka
  langsung dari berkas): kartu per jenis, penyaring di rekap/absensi/jadwal
  semuanya jalan, **0 error**.

---

**Hasil D4 (diuji 16 Sep 2026):**

Ada kartu baru **Paket laporan admin** di tab **Rekap** (tepat di bawah deret
ringkasan). Semua berkasnya mengikuti penyaring yang sedang aktif — periode,
section, dan jenis kegiatan — jadi yang tercetak selalu sama dengan yang
sedang dilihat di layar.

- **Laporan bulanan siap serah**: kepala berisi nama tim (+ logo bila diisi),
  judul, periode, dan tanggal cetak; **7 kotak ringkasan** (kehadiran, sesi,
  anggota, hadir, izin, sakit, tanpa keterangan); **kalimat ringkasan otomatis**
  ("Kehadiran September 2026: 87% … naik 3 poin dibanding Agustus 2026 … 2
  anggota perlu perhatian …"); tabel **per section**, **per jenis kegiatan**,
  **rincian per sesi**, **perlu perhatian**, dan **per anggota**; ditutup
  **ruang tanda tangan** untuk Pembina/Ketua Tim dan Pelatih.
- **Kartu kehadiran per anggota**: satu kartu berisi identitas (nama, kode,
  section, instrumen, peran, tahun gabung), ringkasan H/I/S/A + % kehadiran +
  **predikat** (Baik ≥85% · Cukup ≥70% · Perlu perhatian), tabel rincian tiap
  sesi lengkap dengan status berwarna dan keterangan pelatih, lalu **garis
  paraf anggota & pelatih**. Bisa dicetak **satu anggota** (pilih namanya dulu)
  atau **semua anggota** sekaligus.
- **Paket lengkap**: laporan + semua kartu dalam **satu berkas HTML** — praktis
  dibagikan lewat WhatsApp dan dibuka di HP.
- **Dua CSV**: **matriks** (satu baris per anggota, satu kolom per sesi — enak
  dibaca menyamping di Excel HP) dan **ringkas** (satu tabel bersih tanpa blok
  bertumpuk). Keduanya ber-BOM UTF-8 supaya nama Indonesia tidak rusak.
- **Mencetak tidak pernah buntu**: kalau browser memblokir jendela cetak,
  berkasnya otomatis **diunduh sebagai HTML** dan ada pesan
  "Buka lalu Ctrl+P" — teruji dengan `window.open` yang dipaksa gagal.
- Teruji di **versi produksi** dan **versi portabel** (`DrillKit.html` dari
  berkas): laporan 5 tabel lengkap, 18 kartu, paket lengkap berisi keduanya,
  dua CSV (19 baris × 14 kolom & 19 baris × 12 kolom), **0 error**, dan kartu
  tidak meluber di layar 390 px (lebar 358 px).

**Tambahan 17 Sep 2026 — mode pratinjau (mirip buku saku):** tombolnya
sekarang **Pratinjau laporan / Pratinjau kartu / Pratinjau paket lengkap**.
Hasilnya tampil **di dalam aplikasi** (bingkai pratinjau di sebuah modal),
baru dari situ pilih **Unduh HTML** atau **Cetak**. Alurnya sama persis
dengan buku saku di editor drill, dan menjawab keluhan yang sama: kalau
browser memblokir jendela baru atau unduhan — yang sering terjadi saat
aplikasi dibuka di dalam pratinjau — hasilnya tetap bisa dilihat. Teruji:
pratinjau laporan 5 tabel, pratinjau kartu 1 kartu untuk nama yang dipilih,
pratinjau paket berisi laporan + 18 kartu, tombol Unduh HTML menghasilkan
berkas, tombol Cetak membuka jendela cetak, dan saat `window.open` dipaksa
gagal berkasnya tetap tersimpan dengan pesan "Buka lalu Ctrl+P". Bingkai
pratinjau 348 × 549 px di layar 390 px, tidak meluber, **0 error**.

---

**Hasil D1 (diuji 16 Sep 2026):**

- **Penyebab utama "sekali scan = sekali klik ulang" sudah ketemu & diperbaiki.**
  Kode lama menyimpan kamera di dalam efek yang bergantung pada data hasil pindai,
  jadi setiap kali satu anggota tercatat, React merender ulang → kamera dimatikan
  lalu dinyalakan lagi (1–2 detik hilang tiap kartu). Sekarang semua data dibaca
  lewat *ref*, sehingga efek kamera hanya berjalan saat pemindai dibuka atau
  kamera dibalik. Teruji: `getUserMedia` dipanggil **1 kali** untuk 3 pemindaian
  beruntun (sebelumnya akan memanggil ulang tiap kartu).
- **Kamera menyala terus**, pembacaan dijalankan tiap ~120 ms (≈8×/detik) dengan
  pengaman supaya dua pembacaan tidak bertabrakan.
- **Umpan balik**: bunyi "tit-tit" naik kalau berhasil, satu nada sedang kalau
  sudah tercatat, nada rendah kalau kode tidak dikenal — plus getar 45 ms di HP.
  Keduanya bisa dimatikan lewat chip **Bunyi** dan **Getar**.
- **Anti dobel**: kode yang sama diabaikan selama 4 detik (kartu yang diam di
  depan kamera tidak tercatat puluhan kali). Lewat 4 detik, kalau anggotanya
  sudah hadir, muncul *"… sudah tercatat"* tanpa menulis data baru.
- **Daftar "Baru saja masuk"**: nama, kode, jam, dan tombol **Batalkan** —
  teruji: membatalkan menghapus record absensinya dan membuka kembali kode itu
  untuk dipindai ulang.
- **Ketik manual** tetap ada: kode atau nama, lalu **Enter** langsung menandai hadir.
- **Chip Balik kamera** untuk ganti kamera depan/belakang — teruji: aliran lama
  dimatikan (`ended`) sebelum yang baru menyala, pemindaian tetap jalan.
- **Kamera selalu dilepas** saat modal ditutup (teruji: semua track `ended`),
  jadi lampu kamera tidak menyala diam-diam.
- Teruji di **versi produksi** maupun **versi portabel** (`DrillKit.html`,
  dibuka langsung dari berkas): kamera menyala, 2 kartu tercatat, kode asing
  ditolak, **0 error**.
- Kode lama yang berserakan di `Attendance.tsx` dipindah ke
  `src/components/QrScanner.tsx`, dan logika bunyi/getar ke `src/lib/feedback.ts`,
  supaya mudah diubah sendiri nanti.

---

**Hasil D2 (diuji 16 Sep 2026):**

- **Tren kehadiran per bulan**: batang per bulan (dengan % di atasnya) + **rata-rata 6 bulan
  terakhir** + **arah** (naik / turun / stabil). Teruji dengan data 3 bulan — 100% → 72% → 78%
  — batangnya persis sesuai isi data.
- **Batangnya bisa diklik**: klik satu batang → rekap langsung tersaring ke bulan itu; klik
  lagi → kembali ke semua periode.
- **Perbandingan antar bulan**: *"September 2026 78% dibanding Agustus 2026 72% → naik 6
  poin · 2 sesi bulan ini, 2 sesi sebelumnya"*.
- **Perlu perhatian** — dua kelompok yang jelas bedanya:
  - *Kehadiran rendah*: di bawah ambang yang bisa dipilih (**<50/60/70/80%**, bawaan 60).
    Teruji: ambang 60 → 3 anggota; ambang 80 → 6 anggota.
  - *Mulai menurun*: kehadirannya **turun ≥10 poin** dibanding bulan sebelumnya. Teruji:
    satu anggota yang bulan lalu 100% lalu bulan ini 0% muncul dengan tanda **↓100**.
- **Tanda di tabel**: anggota yang masuk daftar diberi ikon **⚠**, ada **kolom Tren** (↑/↓ poin),
  bisa **disaring** (teruji: 6 baris tersisa) dan **diurutkan** (tombol *Perlu perhatian dulu*
  menaruh yang ↓100 di baris pertama).
- **Ikut ke ekspor**: CSV dan cetakan sekarang memuat tabel **Tren per bulan** dan
  **Perlu perhatian** (teruji: berkas CSV berisi kedua judul itu; tombol Cetak membuka
  jendela cetak seperti biasa).
- **Rapi di HP**: diuji dengan **6 bulan pada layar 390 px** — batang menyesuaikan (49 px
  per batang) dan tidak meluber.
- Teruji juga di **versi produksi** dan **versi portabel** (`DrillKit.html`): batang tren,
  kartu perlu perhatian, dan kalimat perbandingan tampil benar. Semuanya **0 error**.

---

## E. Musik & metronom

| # | Ide | Masalah yang dipecahkan | Dampak | Usaha |
| --- | --- | --- | --- | --- |
| E1 | **~~Metronom dengan aksen & subdivisi~~ — SUDAH ADA SEBAGIAN**: aksen ketukan 1 (nada 1400 Hz), pembagian penuh/½/triplet/1-16, ketukan 2–8 per birama. Yang belum: **getar** → digabung ke E3 | — | ⭐⭐⭐ | Sisa kecil |
| E2 | **~~Daftar lagu + tempo map~~ — SUDAH ADA di aplikasi inti**: halaman Musik punya repertoar lagu, tempo map per birama, dan tap tempo | — | ⭐⭐⭐ | — |
| E3 | **✅ SELESAI — Metronom lanjutan**: pola ritme & aksen **per birama**, **poliritme** (2 suara, mis. 3 lawan 2), **latih tempo** (naik bertahap), pilihan bunyi (klik/woodblock/cowbell), getar, tersimpan per lagu | Metronom sekarang baru detak rata; yang diinginkan setajam Tonal Energy | ⭐⭐⭐⭐ | Sedang |
| E4 | **✅ SELESAI — Penala (tuner) + nada dengung (drone)** dari mikrofon — *diminta nanti dulu* | Tuning section masih pakai aplikasi lain | ⭐⭐⭐ | Sedang |
| M1 | **✅ SELESAI — Tanda birama & hitung mundur**: meter ganjil (7/8, 5/8, …) **dengan pengelompokan**, kustom penuh (pembilang & penyebut bebas), acuan tempo bisa dipilih, **count-off** yang mengikuti birama pertama & bebas diulang (bisa pakai **suara manusia**), dan **mulai dari birama berapa pun** | Tanda birama selama ini **palsu** — cuma angka ketukan berlabel "/4" mati, jadi 7/8 terdengar sebagai 7 ketuk rata | ⭐⭐⭐⭐⭐ | Sedang |
| M2 | **Ulang bagian (loop) + loncat cepat ke segmen tempo** | Bagian sulit tidak bisa diputar berulang tanpa menyentuh tombol | ⭐⭐⭐⭐ | Kecil |
| M3 | **Playlist / set list latihan**: susun urutan lagu untuk satu sesi, mainkan berurutan | Tidak ada urutan lagu untuk satu sesi latihan | ⭐⭐⭐ | Kecil–Sedang |
| M4 | **Tukar repertoar antar perangkat** (ekspor/impor lagu + tempo map + meter) | Ada **dua pelatih**, tapi lagu & tempo map tidak bisa dibagikan — beda dengan formasi yang sudah bisa (DD7) | ⭐⭐⭐⭐ | Kecil |
| M5 | **Panjang lagu (jumlah birama total)** sebagai fondasi | Lagu tidak punya akhir, jadi tidak ada progres, estimasi durasi, maupun kaitan musik–hitungan drill | ⭐⭐⭐ | Kecil |

**Hasil E4 (diuji 17 Sep 2026):**

Kartu **Penala & nada dengung** ada di halaman Musik, di bawah metronom.
Bunyinya dibuat sendiri oleh aplikasi (osilator Web Audio), jadi tetap jalan
offline dan ukuran aplikasi cuma bertambah sedikit.

- **Penala dari mikrofon**: nama nada (ditulis ganda untuk nada hitam, mis.
  `A#4 / Bb4`), selisih dalam **sen**, dan jarum −50…+50 dengan zona hijau
  ±5 sen. Ada pilihan **acuan A4** 438–445 Hz (band Eropa biasa pakai 442).
- **Akurasi teruji** dengan nada sintetis yang dimasukkan ke mikrofon Chrome:
  **A4 440 Hz → 0…+1 sen**, **Bb4 466,16 Hz → 0…−1 sen**, **A4 442 Hz pada
  acuan 440 → +8 sen** (seharusnya +7,9), **E2 82,41 Hz → −3…+4 sen**, dan
  suasana hening ditolak dengan rapi ("menunggu nada…") alih-alih menampilkan
  angka acak.
- **Dua jebakan yang sudah diperbaiki** (penting kalau kelak kamu mengubah
  sendiri `src/lib/tuner.ts`): korelasi silang memberi nilai nyaris sama di
  **kelipatan periode**, jadi tanpa perbaikan nada bisa terbaca 4–7 oktaf
  lebih rendah (440 Hz sempat terbaca 62,8 Hz). Sebaliknya, membagi terlalu
  bebas membuat E2 (82 Hz) terbaca 12 oktaf lebih tinggi. Sekarang: puncak
  dicari dengan korelasi **ternormalisasi**, lalu kelipatan diuji dengan
  syarat ketat (harus ≥90% **dan** benar-benar puncak), dan enam bacaan
  terakhir dimusyawarahkan per nada — bukan dirata-rata, karena rata-rata
  antara 440 Hz dan 220 Hz jatuh di 330 Hz yang bukan nada apa pun.
- **Nada dengung (drone)**: pilih nada (C–B) & oktaf (2–5), bentuk bunyi
  (lembut/hangat/tebal), volume, dan bisa **ditambah nada kelima** supaya
  terdengar seperti harmoni band. Tombol cepat: **Bb konser, F konser,
  Eb konser, A konser**. Nada & volume bisa diubah **sambil bunyi**; tersimpan
  di perangkat, jadi lain kali langsung sesuai kebiasaan.
- **Mikrofon dijaga**: dibuka hanya setelah tombol ditekan, dan **benar-benar
  dilepas** saat berhenti atau saat pindah halaman (teruji: trek berstatus
  `ended`). Kalau izin ditolak / tidak ada mikrofon / mic dipakai aplikasi
  lain, pesannya ditulis dengan bahasa yang jelas, bukan error mentah.
- Teruji di **versi produksi** dan **versi portabel** (`DrillKit.html` dari
  berkas — mikrofon tetap bisa dipakai): penala membaca Bb4 466,0 Hz −1 sen,
  dengung membuat 2 osilator (233 & 350 Hz = Bb3 + nada kelima), **0 error**,
  kartu 358 px di layar 390 px tanpa meluber.

---

**Hasil E3 + B5 (diuji 16 Sep 2026):**

Dua ide ini dikerjakan sebagai **satu paket** karena memakai mesin yang sama
(`src/lib/metronome.ts` — mesin klik Web Audio yang dijadwalkan ke depan, jadi
detaknya tetap stabil walau sedang merender 80 pemain).

**Metronom lanjutan (E3)** — halaman Musik sekarang punya kartu
**Pola ritme & latih tempo**:

- **Pola per birama**: tiap birama punya jumlah ketukan (2–12) dan pembagian
  sendiri (penuh / setengah / triplet / enam belas). Tiap kotak diklik bergilir
  **diam → biasa → aksen**. Teruji: membuat pola, mengubah 4 ketuk → 6 ketuk →
  12 kotak (setelah pembagian setengah), menyalin & menghapus birama.
- **Poliritme**: suara kedua yang dibagi merata sepanjang birama — mis. 3 lawan
  2. Teruji berbunyi bersama pola utama.
- **Latih tempo**: tempo bergerak bertahap, mis. 100 → 140 BPM naik 10 tiap
  birama. Teruji: pada birama berturut-turut temponya benar-benar 100 lalu 110.
- **Pilihan bunyi**: klik (nada), kayu (woodblock), bel (cowbell) — semuanya
  **sintetis**, jadi tetap offline tanpa berkas audio. Plus pengatur volume dan
  **getar** tiap ketukan di HP (dilewati diam-diam kalau tidak didukung).
- **Tersimpan per lagu**: pola, latih tempo, bunyi, getar, dan volume melekat
  pada lagu di repertoar. Teruji: tersimpan, lalu terbaca lagi setelah aplikasi
  dimuat ulang.
- **Ketepatan terukur**: diuji pada 240 BPM — rata-rata jarak antar ketukan
  **250 ms** dengan target 250 ms; aksen hanya jatuh di ketukan pertama.

**Klik tempo saat latihan (B5)** — tombol **Klik** di editor dan chip **Klik**
di presenter:

- Satu detak per **count**, aksen di count pertama tiap set, mengikuti tempo
  drill dan pengali kecepatan animasi (B2).
- Teruji di editor: saat animasi berjalan bunyi terjadwal (8 ketuk untuk set
  4 count pada 200 BPM) dan **berhenti tepat saat animasi selesai** — tidak ada
  bunyi sisa.
- Teruji di presenter bersama mode urutan latihan (B3): klik menyertai seluruh
  run-through dan berhenti saat presenter ditutup.
- Pilihannya **diingat** (tersimpan di `drillkit.drillView`) dan bisa dimatikan
  kapan saja — kalau dimatikan saat berjalan, bunyi langsung berhenti.

**Catatan jujur:**

- Pola yang belum disimpan **tidak hilang** kalau kamu ganti pilihan lagu — ada
  penanda **"belum disimpan"** di kepala kartu, dan pola lagu lain hanya dimuat
  kalau tidak ada suntingan yang tertunda. Ini saya tambahkan setelah menemukan
  perilaku lama yang membuang suntingan saat ganti lagu.
- Yang belum ada: penala & drone (E4) dan perekam latihan — E4 kamu minta nanti.
- Teruji di **versi produksi** dan **versi portabel** (`DrillKit.html` dibuka
  langsung dari berkas): pola tersimpan, indikator berjalan, klik menyertai
  animasi & urutan latihan, **0 error** di keduanya — jadi Web Audio aman
  dipakai dari berkas portabel.

**Hasil M1 (diuji 17 Sep 2026):**

Dua kartu baru di halaman Musik: **Tanda birama** dan **Hitung mundur**.
Pemilih tanda birama dipakai **dua tempat** — metronom mandiri dan editor
lagu — dengan pilihan yang sama persis, sesuai permintaanmu.

**Temuan utama — tanda birama selama ini palsu.** Dropdown "Ketukan per
birama" menampilkan `{n}/4 & {n}/8`, padahal yang tersimpan hanya satu angka
`beats` tanpa penyebut sungguhan; repertoar pun selalu menampilkan
`{beats}/4`. Akibatnya **7/8 terdengar sebagai 7 ketuk rata** dengan satu
aksen — padahal 7/8 adalah `2+2+3`, `2+3+2`, atau `3+2+2`, dan
**pengelompokannya menentukan di mana aksen jatuh**.

- **Meter jadi & kustom penuh**: 26 meter siap pakai (4/4, 5/4 2+3 & 3+2,
  6/8 3+3 & 2+2+2, 7/8 dalam **tiga** pengelompokan, 9/8, 11/8, 12/8, 2/2,
  …), plus kustom: pembilang 1–32 dan penyebut 1/2, 1/4, 1/8, 1/16, 1/32.
- **Pengelompokan bisa diutak-atik sendiri** tiap kelompoknya, dengan tombol
  Reset ke pengelompokan baku. Jumlahnya selalu dijaga = pembilang, jadi
  aksen tidak pernah bergeser diam-diam.
- **Acuan tempo bebas dipilih** (not penuh … keenambelas, termasuk yang
  bertitik — seperempat bertitik untuk 6/8). Ringkasannya menyebut **lama
  satu birama dalam detik** pada tempo yang sedang dipilih.
- **Count-off mengikuti birama pertama** yang dimainkan, bebas diulang 1–8
  kali, bisa menghitung **tiap pulsa** (7/8 → "1 2 3") atau **tiap not**
  (7/8 → "1 2 3 4 5 6 7"), dan bisa memakai **suara manusia** (Web Speech —
  tanpa berkas audio, tetap offline). Ucapan bisa dikustom, mis.
  `siap, 1, 2`.
- **Mulai dari birama berapa pun** — penghitung birama langsung mulai dari
  angka itu, dan tempo map ikut dari segmen yang benar.

**Tiga cacat yang ketemu saat diuji, bukan saat membaca kode:**

1. **Aksen di semua ketuk.** 4/4 dengan kelompok `[1,1,1,1]` menghasilkan
   `[2,2,2,2]` — tiap ketuk jadi aksen. Padahal metronom 4/4 mengaksen
   ketuk 1 saja. Ketemu oleh uji node.
2. **Pengelompokan tidak terdengar.** Memilih 7/8 **tanpa** pola kustom
   tetap memakai `polaBaku`, jadi 7 ketuk sama kuat. Ketemu oleh **uji
   audio**: rasio aksen 0,14 (1 dari 7), seharusnya 0,43 (3 dari 7). Ini
   tidak akan pernah ketemu hanya dengan membaca kode.
3. **Suntingan nyasar ke fungsi simpan.** Pola turunan meter terpasang di
   fungsi **Simpan**, bukan tombol Mulai — karena penanda
   `pola: pakaiPola ? pola : null` muncul **dua kali**. Efeknya: pola
   buatanmu akan tertimpa pola turunan meter setiap menyimpan. Diperbaiki
   dengan penanda yang dijamin unik; yang tersimpan tetap pola buatanmu.

**Yang sengaja tidak disembunyikan:** ucapan suara manusia **tidak bisa
dijadwalkan sepresisi Web Audio** (ada jeda 50–200 ms). Karena itu ucapan
hanya jadi **lapisan** di atas ketukan — ketukan pertama lagu tetap presisi
karena waktunya dihitung oleh metronom, bukan dari ucapan. Kalau perangkat
tidak punya suara ucapan (sering di Linux), ketukan tetap jalan dan
muncul pesan yang jujur, bukan error mentah.

**Keserasian dengan yang lama — diuji, bukan diasumsikan:**
- Lagu lama tanpa `tandaBirama` **terdengar persis seperti sebelumnya**
  (4/4 → `[2,1,1,1]`, 7 ketuk → `[2,1,1,1,1,1,1]`).
- Pola dengan pembagian 2 **identik** dengan `polaBaku` lama
  (`[2,0,1,0,1,0,1,0]`).
- **Presenter & editor drill tidak berubah sama sekali** — keduanya tidak
  mengirim `birama`, sehingga perhitungan durasi jatuh ke perilaku lama.

Teruji di **dev, produksi, dan berkas portabel**: **41/41 lulus, 0 error**,
termasuk uji audio yang menghitung osilator (aksen 1400 Hz vs ketuk biasa
1000 Hz) untuk membuktikan pengelompokan benar-benar terdengar.
Regresi E3: ketepatan **250/250 ms**, aksen 3/6, latih tempo 100→110,
klik presenter & editor drill normal, penyimpanan pola utuh.

**Lanjutan (diminta 17 Sep 2026) — sukat per segmen tempo.** Kamu memberi tahu
bahwa *"untuk tempo dalam lagu belum ada opsi sukat nya, masih belum sama
dengan metronome nya"*. Ternyata celahnya struktural:

- Tempo map lagu cuma punya `Label · Birama · BPM`.
- `SegmenTempo` di mesin cuma `{ measure, bpm }` — jadi meter segmen akan
  diabaikan walau diisi.
- `TempoSegment.beats` ada di tipe data tapi tak pernah ditampilkan/dipakai.

Sekarang tiap segmen tempo bisa punya tanda birama sendiri, dengan
**"Ikuti lagu"** sebagai bawaan. Mesin memilih meter **per birama**: segmen
terakhir yang membawa sukat dan sudah mulai → sukat lagu → tanpa sukat
(perilaku lama). Hitung mundur mengikuti sukat **birama tempat lagu mulai**.
Pola kustom tetap menang atas sukat, karena itu ritme buatanmu.

Buktinya diuji sebagai **bunyi**, bukan cuma tersimpan: lagu 4/4 di birama 1
dan 7/8 di birama 5 → dari birama 1 rasio aksen 0,25 (1 dari 4), dari
birama 5 rasio 0,43 (3 dari 7). Teruji **15/15** di dev, produksi, dan
berkas portabel.

**Mode lagu — tampilan & interaksi (diminta 17 Sep 2026).** Setelah sukat &
hitung mundur beres, kamu meminta tampilan yang **lebih informatif dan
interaktif saat lagu diputar**, UI yang ikut berubah di mode lagu, cara isi
segmen yang tidak perlu menggulir ke atas, visual ketuk yang jelas, detail
bar-ke-bar/segmen-ke-segmen seperti **set di drill**, dan tempo lagu yang
bisa dipakai drill. Yang dikerjakan sekarang (empat yang pertama):

- **Panel "Sedang diputar"** di dalam kartu metronom: judul lagu, birama
  berjalan, segmen aktif, sukat yang sedang berlaku, tempo, lama satu
  birama, dan waktu berjalan (`m:ss`) yang dihitung dari tempo map.
- **Strip segmen** meniru strip set di editor drill: berjajar, bisa digulir
  menyamping, yang aktif disorot, diklik untuk loncat ke birama awal segmen.
- **Indikator ketuk** dirombak: kotak 36 px bernomor, bercincin saat
  berbunyi, dan **dikelompokkan sesuai sukat** — 7/8 kelihatan sebagai
  `2+2+3`.
- **Tombol "Tambah segmen" di bawah daftar** juga, supaya mengisi banyak
  segmen tidak perlu menggulir ke atas.

Cacat yang ketemu dengan menelusuri sendiri sebelum diuji: `detikSampai`
menentukan segmen aktif **setelah** menghitung durasi, sehingga tempo &
sukat segmen pertama terlewat. Dua uji ditambah untuk menguncinya.

Teruji di dev, produksi, dan berkas portabel: mode lagu **27/27**, sukat
segmen 15/15, kartu metronom 41/41, node 107/107, 0 error.

**Poin ke-5 — tempo & segmen lagu dipakai untuk drill (selesai 17 Sep 2026).**
`Drill.songId?` (tautan opsional, kosong = perilaku lama). Birama awal tiap
set dihitung dari **jumlah count kumulatif** memakai sukat lagu &
ketuk-per-hitungan, lalu tempo & sukat di birama itu diambil dari tempo map.
Jadi drill mengikuti tempo lagu **tanpa perlu menunggu M5** (panjang lagu).

Modul murninya `src/lib/gabungMusik.ts` (tanpa DOM/React/db, jadi bisa diuji
dari node): `petakanSetKeMusik`, `tempoSet`, `daftarTempo`, `ketukPerBirama`,
`totalDetik`. Kontraknya: 1 count = `beatsPerCount` ketuk, 1 ketuk = satu
not acuan, 1 birama = `pembilang / notPerAcuan` ketuk — karena itu
**pergantian sukat mengubah jumlah birama yang terlewati**. Set diproses
berurutan dan tempo+sukat diselesaikan **sebelum** memajukan birama (pelajaran
yang sama dengan cacat `detikSampai` di atas).

Yang ikut memakai tempo lagu: putar & klik di editor (`tempoUntuk(idx)`),
presenter (`tempoPerSet?.[i]`), dan `setTerberat` yang kini menerima
`tempoPerSet?` supaya peringatan dihitung pada tempo yang benar-benar
diputar.

Cacat yang ketemu waktu menguji: tombol `›` di presenter **tidak** boleh
diklik lewat pencarian tombol global — editor di balik overlay punya tombol
yang mirip, jadi uji otomatis mengira presenter sudah pindah set padahal
belum. Presenter kini punya `presenter-berikutnya` / `presenter-sebelumnya` /
`tutup-presenter` / `tempo-presenter` supaya tidak tertukar.

Teruji: `uji-gabung-musik` **34/34** (node) dan `m1-tempo-lagu-drill`
**20/20** (browser) — tanpa lagu tempo datar `[120,120,120,120]`, dengan lagu
bertempo map (4/4 @120 → 7/8 @150 di birama 5) menjadi `[120,150,150,150]`.
Regresi drill (dd1–dd10b, d4, smoke-drill) dan e3 **250/250 ms** tetap bersih.

**Catatan untuk M2 & M3:** keduanya butuh **panjang lagu** (M5) lebih dulu —
tanpa jumlah birama total, "ulang birama 32–48" dan progres lagu tidak
punya batas yang jelas. **M5, M3, dan M2 sudah selesai** — antrean M1–M5
tinggal M4 (tukar repertoar antar perangkat).

**M2 — ulang bagian (selesai 18 Sep 2026).** `Song.ulangBagian?`
(`{ dari, sampai, aktif }`, inklusif di kedua ujung). Modul murninya
`src/lib/ulang.ts` (`rentangValid`, `normalisasiUlangBagian`,
`detikSatuPutaran`, `jumlahBirama`).

Mesin (`src/lib/metronome.ts`) dapat `ulangBagian`. Di penjadwal, pemeriksaan
rentang diletakkan **sebelum** pemeriksaan akhir lagu, jadi rentang menang
atas `biramaAkhir` maupun `ulang` — berlatih satu bagian berarti lagu
memang tidak boleh berhenti. Pengamanannya sama seperti M5: rentang yang
terbalik atau kosong dimatikan di `mulai`, karena tanpa itu `pos` terus
dikembalikan ke birama yang sudah lewat batas dan penjadwal berputar di
tempat tanpa henti.

Satu keputusan yang berubah setelah diuji: mulanya pemutaran tetap mulai
dari `mulaiDari`, sehingga untuk mengulang birama 3–4 pemakai harus
mendengar birama 1–2 dulu setiap kali menekan Mulai. Sekarang kalau rentang
menyala pemutaran **langsung mulai di `ulangBagian.dari`** — maksudnya
berlatih bagian itu — dan keterangannya mengatakannya.

Rentang yang runtuh (`sampai < dari`) tidak dibalik diam-diam, melainkan
diruntuhkan jadi satu birama, sama seperti `normalisasiUlangBagian` yang
menyamakan `sampai = dari`. Menukar kedua ujungnya akan menghitung rentang
yang berbeda dari yang diketik pemakai, jadi sengaja tidak dilakukan.

Teruji: `uji-ulang` **41/41** (node) dan `m2-ulang-bagian` **29/29** di
**ketiga** target — termasuk uji yang menentukan: lagu 8 birama @240
(8 dtk) dengan rentang 3–4 menyala **tetap berjalan pada detik ke-8**, dan
birama tidak pernah keluar dari rentang.

**M5 — panjang lagu (selesai 18 Sep 2026).** `Song.panjangBirama?` (jumlah
birama, opsional — kosong = tanpa akhir, persis perilaku lama) dan
`Song.ulang?: 0 | 1`. Durasi tidak disimpan: selalu dihitung dari tempo map
& sukat, supaya tidak pernah usang kalau tempo diubah.

Fungsi murninya di `src/lib/birama.ts`: `detikTotal`, `detikSisa`,
`rasioProgres` — semuanya dibangun di atas `detikSampai` yang sudah ada
(`detikSampai` menghitung waktu **menjelang** suatu birama, jadi durasi
birama ke-`N` baru ikut pada `N + 1`). Progres dihitung dari **waktu**, bukan
jumlah birama: kalau lagu 4/4 lalu 7/8, birama 5 dari 8 ada di 8/19,2 ≈ 42%,
bukan 50% — kalau dihitung per birama batangnya melompat saat sukat berganti.

Mesin (`src/lib/metronome.ts`) dapat `biramaAkhir`, `ulang`, `onSelesai`.
Penjadwalnya melihat ke depan ~0,18 dtk, jadi akhir lagu **tidak** memotong
ekor birama terakhir: setelah batas tercapai ia berhenti menjadwalkan birama
baru, lalu menunggu antrean kosong **dan** waktu lewat, baru memanggil
`onSelesai`. Pengamanannya: `ulang` hanya aktif kalau `biramaAkhir > 0`, dan
kalau `mulaiDari > biramaAkhir` lagu langsung dianggap selesai — tanpa itu
`pos` direset ke birama yang sudah lewat batas dan penjadwal berputar di
tempat tanpa henti.

Dua cacat yang ketemu waktu menguji, keduanya nyata dan bukan sekadar
kegagalan tes:

1. **Footer modal menutupi isi paling bawah.** Modal lagu memakai footer
   `sticky bottom-0`, dan isinya cuma punya `py-4`. Menambah satu baris field
   membuat tombol "Tambah segmen" di bawah **tidak bisa diklik** — tertutup
   footer. Diperbaiki dengan memberi ruang bawah `pb-20` pada isi modal
   (`src/components/ui.tsx`), jadi apa pun di akhir isi selalu bisa digulir
   hingga bebas dari footer. Ini memperbaiki **semua** modal di aplikasi.
2. Karena modal sudah setinggi layar (92vh), field "Panjang lagu" **sengaja
   tidak** ditaruh di modal lagu, melainkan di kolom setelan metronom
   sebelah "Mulai dari birama" — begitu lagu dipilih. Menaruhnya di modal
   mengembalikan cacat nomor 1 untuk pemakai.

Perilaku yang perlu diingat (bukan cacat, tapi mengagetkan): **setiap kali
data lagu berubah, metronom memuat ulang pengaturan lagu itu, termasuk
BPM** — lihat `useEffect` pada `[song]` di `Music.tsx`. Jadi mengisi panjang
lagu atau menyalakan ulang akan mengembalikan tempo ke BPM lagu. Tes
otomatis harus mengatur ulang tempo setelah setiap penulisan ke lagu.

**M3 — set list (selesai 18 Sep 2026).** Tabel baru `setlists` (Dexie
versi 4) berisi **`songIds` saja**, bukan salinan lagu: mengubah judul,
tempo, atau panjang sebuah lagu langsung terlihat di semua set list yang
memakainya, dan tidak ada data yang bisa usang. `hitungSetList` melewati id
yang lagunya sudah dihapus, jadi set list tidak rusak karena satu lagu hilang.

Modul murninya `src/lib/setlist.ts` (`durasiSatu`, `hitungSetList`, `pindah`,
`naik`, `turun`, `bisaDiputar`). Tampilannya `src/components/KartuSetList.tsx`
— dipisah dari `Music.tsx` supaya berkas halaman tidak makin membengkak.

Keputusan yang paling penting ada di pemutaran: `putarSetListDari(k)`
membangun opsi mesin **dari objek lagunya sendiri** (`opsiDariLagu`), bukan
dari state metronom. Dua alasan:

1. Saat pindah lagu, `useEffect` pada `[song]` memuat ulang pengaturan lagu
   ke state — kalau pemutaran menunggu state itu, ia balapan dengan effect
   dan lagu berikutnya mulai dengan tempo lagu **sebelumnya**.
2. Memang itu maksud set list: tiap lagu diputar dengan pengaturannya
   sendiri (tempo, sukat, tempo map, pola, bunyi, volume). Perhatikan bahwa
   karena itu **BPM yang dipakai adalah BPM tersimpan di lagu**, bukan angka
   di kolom metronom — yang terakhir hanya state tampilan dan tidak pernah
   ditulis balik ke lagu.

Lagu tanpa panjang tidak menghentikan pemutaran, tapi tidak bisa diputar
dalam set list (mesin tidak tahu kapan harus pindah) — karena itu ditandai
di kartu dan totalnya disebut perkiraan.

Pengejaran regresi yang perlu diingat: `urutanSetList()` di uji otomatis
harus membaca **anak teks pertama** dari judul, bukan `textContent` —
lencana "dimuat" ikut berada di dalam `<p>` yang sama, jadi judulnya
terbaca "SL-Cdimuat".

Teruji: `uji-setlist` **102/102** (node) dan `m3-setlist` **45/45** di
**ketiga** target (dev, produksi, berkas portabel) — termasuk pindah lagu
otomatis pada detik ke-2 dan ke-4, berhenti sendiri di akhir, mulai dari
tengah, dan berhenti lewat tombol yang sama.

Teruji: `uji-panjang-lagu` **109/109** (node), `m5-panjang-lagu` **31/31**
(dev, menyemai lewat db) dan `m5-panjang-lagu-ui` **30/30** di **ketiga**
target (dev, produksi, berkas portabel) — versi `-ui` digerakkan antarmuka
karena `import('/src/db/db.ts')` hanya ada di dev. Regresi penuh bersih:
mode lagu 27/27, sukat segmen 15/15, kartu metronom 41/107/109, drill
dd1–dd10b, e3 **250/250 ms**.

---

## F. Keandalan & data — "supaya saya tenang"

| # | Ide | Masalah yang dipecahkan | Dampak | Usaha |
| --- | --- | --- | --- | --- |
| F1 | **✅ SELESAI — Backup otomatis**: aplikasi mengingatkan ekspor berkas tiap N hari + menyimpan riwayat backup | Data hilang = semua kerjaan hilang (ini risiko terbesar) | ⭐⭐⭐⭐ | Kecil |
| F2 | **✅ SELESAI — Mode kios / kunci data**: saat HP dipegang anggota, mereka tidak bisa mengubah formasi/absensi | HP pelatih kadang dipinjam | ⭐⭐⭐ | Sedang |
| F3 | **✅ SELESAI — Berbagi show, dua arah**: ekspor 1 show (drill + set + lagu + anggota) jadi berkas `.json` → pelatih lain buka & **menyusun set sendiri** di perangkatnya → kirim balik → digabung lagi (timpa / gabung / salinan) | Teman pelatih ikut meninjau & menyusun drill, tapi hasilnya tak bisa kembali | ⭐⭐⭐⭐ | Kecil–sedang |

**Hasil F4 (diuji 17 Sep 2026):**

Satu lembar A4 berjudul **Panduan Singkat DrillKit**, bisa dibuka dari dua
tempat: tombol **Panduan** di Dashboard, dan kartu **Panduan 1 halaman** di
Pengaturan. Isinya **dibuat otomatis dari data tim yang sedang aktif** —
nama & logo tim, jumlah anggota/sesi/drill/lagu, daftar section, dan interval
pengingat backup — jadi tidak perlu disunting manual dan tidak pernah usang.

- **Isi lembar**: (1) *Mulai dari sini* — enam langkah yang paling sering
  (susun formasi → buku saku → jadwal & absensi → kirim ke anggota → kerja
  bareng pelatih lain → tuning); (2) *Isi tiap menu* — delapan menu dengan
  kegunaannya; (3) *Shortcut editor formasi* — 21 pintasan, diambil dari
  sumber yang sama dengan dialog `?` di editor (`src/lib/shortcut.ts`), jadi
  keduanya tidak mungkin berbeda; (4) *Kalau macet* — empat gejala & cara
  mengatasi (cetak diblokir, mikrofon, penyimpanan diblokir, backup/pindah
  perangkat); (5) *Yang perlu diingat* — data tersimpan di perangkat, jalan
  offline, section tim, undo.
- **Sungguhan satu halaman**: diuji dengan mencetak ke PDF A4 — **1 halaman**
  pada tim contoh (18 anggota) **dan tetap 1 halaman** pada kasus terberat
  (nama tim 45 karakter, 8 section, 80 anggota, 42 sesi). Tata letak dua kolom,
  huruf 8,4 pt.
- **Alurnya sama seperti laporan & buku saku**: **Pratinjau** (tampil di dalam
  aplikasi) → lalu **Unduh HTML** atau **Cetak**; bila jendela cetak diblokir,
  berkasnya tersimpan otomatis dengan pesan "Buka lalu Ctrl+P".
- Teruji di **versi produksi** dan **versi portabel** (`DrillKit.html`): tombol
  Dashboard membuka pratinjau yang benar, kartu di Pengaturan lengkap, **tanpa
  warna `oklch()`/`color-mix()`**, kartu 358 px di layar 390 px, **0 error**.

---

**Hasil F3 (diuji 16 Sep 2026):**

Tempatnya di **Pengaturan drill** (tombol ⚙ di editor) — kartu
**Berbagi show dengan pelatih lain** berisi tombol **Ekspor show** dan
**Impor show**. Modulnya hidup di `src/lib/show.ts`, antarmukanya di
`src/components/ShowShare.tsx`.

**Isi satu berkas show** (`drillkit-show`, mis.
`demo-formasi-pembuka-show-2026-09-16.json`):

- **drill** — nama, judul show, ukuran lapangan, tempo, ketukan per count, dan
  penanda lapangan (A7).
- **semua set** milik drill itu, lengkap dengan titik tiap pemain.
- **repertoar lagu** — jadi pola metronom (E3) ikut pindah ke perangkat lain.
- **anggota aktif** — supaya titik di setiap set tetap punya nama & section saat
  dibuka di laptop temanmu.

**Yang dijaga ketat:**

- **Token QR absensi dibuang** saat ekspor (teruji: semua token kosong di dalam
  berkas) dan **dibuatkan baru** untuk anggota yang memang belum ada di
  perangkat penerima.
- Berkas **diperiksa dulu** sebelum apa pun ditulis. Teruji ditolak dengan pesan
  jelas: berkas format lain, JSON rusak, dan berkas show yang isinya tidak
  lengkap — dalam semua kasus data yang sudah ada **tidak berubah**.
- Kalau show dengan id yang sama sudah ada, aplikasi **bertanya dulu** — tidak
  ada yang ditimpa tanpa pilihanmu.

**Tiga cara mengimpor** (teruji semua):

| Cara | Yang terjadi | Hasil uji |
| --- | --- | --- |
| **Gabungkan set-nya** | set yang sama diperbarui, set baru ditambahkan, set yang hanya ada di perangkat ini tetap dipertahankan | 4 set (2 lama + 1 tambahan teman + 1 set lokal yang dipertahankan), nama drill & set ikut revisi, 1 anggota baru bertambah dengan token baru |
| **Timpa show yang sama** | isi berkas menggantikan seluruh set show itu | set lokal yang tidak ada di berkas ikut diganti; laporan *"2 set · 1 set lama diganti"* |
| **Simpan sebagai show baru** | show baru dengan id & nama sendiri, show lama tidak disentuh | jadi 2 drill: *"Show revisi"* & *"Show revisi (dari Marching Band Saya)"*, masing-masing 2 set, dan **tampilan langsung pindah** ke show yang baru |

- **Rapi di HP**: kartu berbagi lebarnya 348 px pada layar 390 px, tidak meluber.
- Teruji di **versi produksi** dan **versi portabel** (`DrillKit.html` dibuka
  langsung dari berkas): ekspor menghasilkan berkas yang sah, impor menambah set
  dari pelatih lain, **0 error** di keduanya.

**Catatan jujur:** berkas show berisi **satu** show. Kalau mau memindahkan semua
data (anggota, jadwal, absensi, semua drill) ke perangkat lain, itu urusan
**F1 — backup** (menu Pengaturan → Kelola data). F3 ini khusus untuk kerja
bareng satu show.
| F4 | **✅ SELESAI — Panduan pemakaian 1 halaman** untuk pelatih & anggota — dibuat otomatis dari data tim, benar-benar muat 1 halaman A4 | Orang baru bingung pakainya | ⭐⭐⭐ | Kecil |

**Hasil F2 (diuji 16 Sep 2026):**

- **Cara kerjanya**: satu penjaga global di `src/lib/kiosk.ts` memblokir klik pada
  kontrol yang bisa mengubah data (tombol, pilihan, isian, tautan unduh) plus
  shortcut keyboard. Jadi tombol baru pun otomatis terkunci — tidak perlu
  menyunting satu per satu halaman.
- **Yang tetap bisa dipakai saat terkunci** (ditandai `data-kiosk-allow`):
  pindah menu, melihat formasi & berpindah set, **mode presenter**, metronom,
  ganti tab & filter tampilan. Tombol-tombol itu tetap terang; sisanya diredupkan.
- **Yang ditolak & teruji tidak mengubah apa pun**: tombol H/I/S/A absensi,
  "tandai semua hadir", membuka pemindai QR, **menggeser titik di kanvas**,
  menambah/mengedit anggota, dan mengubah pengaturan. Tiap penolakan muncul
  pesan *"Terkunci — mode kios aktif…"*.
- **Kunci tahan banting**: tetap aktif setelah aplikasi dimuat ulang.
- **PIN opsional** (bisa diberi petunjuk): salah PIN → *"PIN salah."* dan tetap
  terkunci; PIN benar → langsung bisa mengubah data lagi.
- Teruji di **tampilan laptop (1400 px)** dan **HP (390×844)** — tombol kuncinya
  tampil di sidebar (laptop) dan header (HP); serta di **versi produksi** dan
  **versi portabel** (`DrillKit.html`): terkunci → absensi tidak berubah; dibuka
  → absensi berubah lagi. Semuanya **0 error**.
- Yang ikut disentuh: `Card` dan `Button` di `src/components/ui.tsx` sekarang
  meneruskan atribut tambahan (supaya bisa ditandai `data-kiosk-allow`),
  presenter & kanvas editor diberi penanda, dan
  **Pengaturan → Mode kios / kunci data** menampilkan status + pengaturan PIN.

---

**Hasil F1 (diuji 16 Sep 2026):**

- Modul baru `src/lib/backup.ts`, dipakai bersama oleh pengingat & menu Pengaturan
  (tidak ada lagi logika ekspor ganda).
- **Kartu pengingat di Dashboard**, muncul kalau lewat N hari sejak backup terakhir:
  - belum pernah backup → *"Belum pernah backup"*;
  - sudah lewat → *"Sudah 10 hari sejak backup terakhir"*;
  - masih dalam interval → tidak muncul sama sekali.
- Tiga tombol: **Cadangkan sekarang** (unduh + catat riwayat), **Ingatkan besok**,
  **Lewati dulu** (tunda satu siklus).
- Tidak pernah muncul kalau aplikasi belum berisi anggota — tidak mengganggu pemakaian pertama.
- Menu **Pengaturan → Kelola data** menampilkan *Backup terakhir* (tanggal, ukuran, jumlah
  anggota & drill, "hari ini / N hari lalu"), pilihan interval (**Mati / 3 / 7 / 14 / 30 hari**,
  bawaan 7), dan **riwayat backup** 5 entri terakhir.
- **Uji pulihkan (round-trip)**: data dikosongkan total (0 anggota, 0 drill, 0 set, 0 sesi),
  lalu berkas backup dipulihkan → kembali utuh **18 anggota, 1 drill, 2 set, 5 sesi**.
- Riwayat disimpan di `localStorage` dengan try/catch: kalau browser memblokir penyimpanan
  (mode penyamaran / iframe), fitur ini dilewati tanpa merusak aplikasi.

---

## Visi jangka panjang (17 Sep 2026)

Ditulis ulang setelah kamu menyebut tujuan yang sebenarnya: **DrillKit harus
menjadi solusi *all-in-one* untuk marching band**, bukan sekadar alat bantu
menyusun formasi.

| Bagian | Yang diharapkan |
| --- | --- |
| Produksi pertunjukan | Tempat memproduksi **display**, **koreografi color guard**, sampai **kolosal** — lengkap dengan ruang **coba-coba properti** sebelum dipakai di lapangan |
| Latihan | **Impor partitur** (PDF / Sibelius / MuseScore) langsung menjadi **preset metronom** untuk latihan |
| Administrasi | Kehadiran direkap **dan dianalisa** |
| Komunikasi | Grup per section, grup besar, grup pelatih, pengurus harian, official/manajerial, dan **pesan pribadi** antar anggota |
| Jadwal | Satu jadwal yang bisa dilihat semua orang |
| Analisis | **Analyzer** yang menilai display: dengan level tim saat ini, berapa lama proses *transfer*-nya, tingkat kesulitannya, dan seterusnya |

**Akan dikomersialkan.** Ditawarkan dulu ke **pengurus harian**, disebarkan
pelan-pelan **tahun depan** setelah program baru berjalan.

### Konsekuensi yang perlu disepakati bersama

Visi di atas **tidak bisa dicapai dengan satu berkas offline**. Ini perubahan
besar dari syarat lama ("tanpa server, nol biaya"), jadi perlu diputuskan dengan
sadar, bukan tidak sengaja:

| Yang diinginkan | Konsekuensinya |
| --- | --- |
| Grup, pesan pribadi, jadwal bersama | Butuh **akun & server** — data harus ada di satu tempat yang bisa dibuka banyak orang |
| Analyzer AI | Butuh **API berbayar** (biaya per pakai) — atau diganti hitungan pasti yang jalan offline |
| Impor partitur | **MusicXML** (ekspor dari MuseScore/Sibelius) realistis; **impor PDF** jauh lebih rawan salah dan mahal dikerjakan |
| Tetap bisa dipakai di laptop lama tanpa internet | Harus tetap ada **versi offline** — tidak boleh semua bergantung server |

**Usul saya: dua lapis, bukan satu.**
- **Lapis 1 — inti offline (yang kamu pakai sekarang).** Editor drill, musik &
  penala, absensi, laporan. Tetap satu berkas, tetap jalan tanpa internet.
- **Lapis 2 — layanan online (nanti).** Akun, grup, pesan, jadwal bersama,
  analyzer. Hanya bagian yang memang butuh orang lain.

Alasannya: kalau semuanya dipindah ke online, yang hilang justru yang membuatnya
berguna di lapangan — tidak ada sinyal, laptop tua, satu berkas tinggal
dobel-klik. Dan secara dagang, inti offline itu nilai jualnya: **jalan di mana
saja, tanpa biaya bulanan**.

**Catatan untuk analyzer:** sebagian besar yang kamu sebutkan sebenarnya bisa
dihitung pasti **tanpa AI** — jarak tempuh tiap pemain, kepadatan langkah per
hitungan, gerakan yang mustahil diselesaikan, tingkat kesulitan per section.
Hitungan itu jalan offline dan gratis. AI baru berguna untuk **merangkainya
menjadi narasi & saran** — lapisan yang bisa ditambahkan belakangan.

## Fokus sekarang: menyempurnakan Drill Display (arah Pyware)

Dari jawabanmu: **"fitur drill display-nya kita sempurnakan dulu"**, dan pelatih
kedua ingin **"drill display-nya lebih detail seperti Pyware"**.

**Status 17 Sep 2026: seluruh seri ini selesai.** Tabel di bawah yang dipakai
untuk memulai dulu — sebelah kanannya berisi semua yang *belum ada* — sekarang
tinggal catatan sejarah. Tiap kekurangan itu sudah ditutup:

| Dulu belum ada | Ditutup oleh |
| --- | --- |
| Jalur melengkung & *easing* (animasi lurus & konstan) | **DD2**, disempurnakan **DD4** dengan **busur putaran** yang menjaga jarak antar pemain saat blok berputar |
| Alat gerak massa: roda, kembang-kempis, geser blok, bertahap | **DD4** |
| Properti & perlengkapan yang ikut berpindah | **DD5** — ternyata sudah tercakup **penanda bebas** (A7) sejak awal |
| Posisi per hitungan di buku saku, catatan gerak per pemain | **DD6** (Detail per pemain) · **DD8** (`Lk/cnt`) · **DD10b** (ukuran langkah) |
| Hitungan pasti: berapa langkah, mana yang mustahil | **DD3** — analitik & peringatan gerak |
| Tukar-menukar koordinat dengan Pyware/Excel | **DD7** |
| Melihat posisi di tengah perpindahan, **per hitungan** | **DD9** — bilah waktu per hitungan & tapak langkah |
| Koordinat buku saku yang tidak rancu antara dua sisi lapangan | **DD10** — penanda sisi & tanda `−`/`+` yang diukur dari A |

Ringkasan tiap hasil (rincian lengkap ada di bawah, urut sesuai nomor):

| # | Inti hasilnya |
| --- | --- |
| **DD1** | Patok huruf (`A`…), patok angka (`T1`…), tanda `#`; `A` di titik tengah, koma atas menandai sisi |
| **DD2** | Jalur lurus / melengkung / **busur**; pembagian kecepatan; tunda mulai per section |
| **DD3** | Jarak tempuh, langkah per hitungan, peringatan **berat/mustahil** (120/150/180 lk per menit) |
| **DD4** | Roda, kembang-kempis, geser, cermin, bertahap — jarak antar pemain tetap terjaga |
| **DD5** | Sudah tercakup penanda bebas (A7); perlengkapan melekat cukup di field "Instrumen / perlengkapan" |
| **DD6** | Panel Detail per pemain: ringkasan, kalimat gerakan terberat, tabel semua perpindahan |
| **DD7** | Unduh formasi lebar + **impor balik dengan pratinjau**; aman karena bawaannya membuat set baru |
| **DD8** | Kolom `Lk/cnt` di buku saku & dot sheet |
| **DD9** | Bilah waktu **per hitungan** (tombol ⌗, `,` dan `.`) & **tapak langkah** |
| **DD10** | Koordinat tidak rancu: `C` · `C'`, `−`/`+` diukur dari A, kompas & panah arah |
| **DD10b** | Dua cara menghitung langkah: **ukuran tetap** atau **ikut hitungan**; kolom Ukuran langkah |

> **Catatan penomoran:** **DD10 & DD10b bukan rencana awal** — keduanya lahir
> dari pemakaian. DD10 dari kebingungan koordinat dua sisi lapangan, dan DD10b
> dari pertanyaanmu tentang angka di kolom "arah & jalan". Karena itu nomornya
> menempel di belakang, bukan disisipkan (DD9 sudah terlanjur dipakai untuk
> scrub per hitungan).

Kandidat penyempurnaan — dikerjakan **satu per satu**:

| # | Ide | Yang dikerjakan | Dampak | Usaha |
| --- | --- | --- | --- | --- |
| DD1 | ✅ **Mode lapangan & patok kustom** | Pilihan lapangan: **DCI (sepak bola Amerika)**, **lapangan sepak bola Indonesia**, **lapangan lomba Indonesia**, dan **kustom bebas** — lengkap dengan patok **huruf (A…)**, patok **angka (1…)**, dan tanda **# (hash)** sesuai kebiasaan tim | ⭐⭐⭐⭐⭐ | Sedang |
| DD2 | ✅ **Jalur & pembagian gerak** | Garis lurus **atau** melengkung per pemain, *easing* (pelan di awal/akhir), titik tengah (*waypoint*), mulai bertahap per section | ⭐⭐⭐⭐⭐ | Besar |
| DD3 | ✅ **Analitik & peringatan gerak** | Jarak tempuh per pemain, langkah per hitungan, tanda gerakan yang mustahil diselesaikan, peta kesulitan | ⭐⭐⭐⭐⭐ | Sedang |
| DD4 | ✅ **Alat gerak massa** | Roda mengitari titik pusat, kembang-kempis dari tengah, geser blok, cermin (*mirror*), bertahap | ⭐⭐⭐⭐ | Sedang |
| DD5 | ✅ **Properti & perlengkapan** | Sudah tercakup **penanda bebas** (A7): bendera, properti, garis bantu jadi objek dengan jalurnya sendiri, bisa dianimasikan & dicetak. Perlengkapan yang **melekat pada pemain** cukup dicatat di field "Instrumen / perlengkapan" — sengaja tidak dibuat field baru supaya satu fakta tidak punya dua tempat | ⭐⭐⭐⭐ | — |
| DD6 | ✅ **Detail per pemain** | Bentuk & warna titik per instrumen, nomor/label, catatan per set, garis pandu | ⭐⭐⭐ | Kecil–Sedang |
| DD7 | ✅ **Impor/ekspor koordinat CSV** | Bertukar formasi dengan Pyware/Excel: unduh formasi lebar, edit di Excel, impor balik dengan pratinjau | ⭐⭐⭐ | Sedang |
| DD8 | ✅ **Langkah per hitungan di buku saku** | Buku saku ikut menampilkan posisi per hitungan & arah hadap | ⭐⭐⭐ | Kecil |
| DD9 | ✅ **Scrub per hitungan & jejak** | Geser animasi hitungan demi hitungan, tampilkan jejak langkah pemain terpilih | ⭐⭐⭐ | Kecil |
| DD10 | ✅ **Koordinat buku saku yang tidak rancu** | Penanda sisi (`C` · `C'`), tanda `−`/`+` diukur dari A, kompas & panah arah jalan di kepala kartu | ⭐⭐⭐⭐ | Kecil |
| DD10b | ✅ **Dua cara menghitung langkah** | Mode **ukuran langkah tetap** (8-to-5) atau **langkah ikut hitungan**, bawaan per drill + timpaan per pemain per perpindahan; kolom **Ukuran langkah** (inci) di buku saku | ⭐⭐⭐⭐ | Sedang |

### Rincian hasil DD

Bagian di bawah **diurutkan sesuai waktu pengerjaan**, bukan nomor idenya —
jadi `DD10` dan `DD10b` yang lahir belakangan justru lebih dulu terbaca.
Kalau mau mencari satu ide tertentu, pakai **tabel ringkasan di atas**.

### Hasil DD1 (diuji 17 Sep 2026)

**Mode lapangan & patok kustom selesai** dan teruji di dev, produksi, dan
berkas portabel (0 error).

Yang sekarang bisa dilakukan:
- **Preset lapangan:** DCI/kampus, SMA/NFHS, Pro/NFL, tanpa hash, **Sepak bola
  Indonesia (105 × 68 m)**, **Indoor/GOR (40 × 20 m)**, atau **kustom bebas**.
- **Satuan yard atau meter** — nilai tersimpan tetap yard, jadi drill lama
  tidak perlu diubah apa pun.
- **Patok diatur sendiri:** patok huruf `A → # → B → # → C …`, patok angka
  `T1 → T2 → T3 …`, jarak huruf→huruf, huruf→#, dan T→T — semuanya dalam
  **langkah**. Patok huruf bisa dipasang di sumbu melintang atau membujur.
- **Koordinat mengikuti patok:** tepat di patok ditulis ringkas (`A6`, `B#8`),
  di antaranya ditulis dengan jaraknya (`A +1 · T6 +1.75`). Buku saku, dot
  sheet, dan lembar koordinat CSV ikut memakai format ini.
- **Titik menempel ke patok** saat digeser, bukan ke langkah.

**Temuan penting saat mengerjakan ini:** ada **bug lama** di editor —
penempatan titik memakai *closure* yang usang, sehingga setelah mengganti
lapangan, titik masih menempel memakai **ukuran langkah dan lebar lapangan yang
lama**. Sudah diperbaiki dengan membaca konfigurasi lapangan lewat *ref*.
Sebelum DD1, bug ini juga mengganggu `Snap ke grid`.

**Yang tidak berubah:** memilih preset DCI/NFHS/NFL/tanpa hash mengembalikan
koordinat ke format lama (`S1 · YL45 +1.5 · FH +2.75`), dan drill yang dibuat
sebelum DD1 tetap terbaca persis seperti semula.

### Penyempurnaan setelah dicoba pelatih (17 Sep 2026)

Empat hal yang diminta setelah DD1 dicoba, semuanya sudah dikerjakan:

1. **Pola patok huruf diperbaiki.** Bukan lagi `A` di tepi lurus ke seberang,
   melainkan **`A` di titik tengah** lalu keluar ke dua sisi:
   `# C # B # A # B # C #`. Pola lurus tetap tersedia sebagai pilihan.
2. **Patok angka bisa tanpa awalan.** Pilihan `T1, T2, …` **atau** cukup
   `1, 2, …`. Koordinat ringkas tetap `A6` / `B#8`.
3. **Garis lapangan bisa disembunyikan** — pilihan: tampilkan semua, **tanpa
   garis tepi** (garis putih tebal), atau sembunyikan semua. Patok tetap
   tergambar dalam semua pilihan, karena patok adalah acuannya.
4. **Warna latar bisa diganti:** hijau, hijau tua, biru (indoor), abu-abu
   (GOR), cokelat (tanah), ungu. Semua **hex murni** — tanpa `oklch()` atau
   `color-mix()` — jadi tetap aman di browser lama pada berkas portabel.
5. **Ukuran titik pemain mengikuti luas lapangan.** Sebelumnya radiusnya
   dipatok 1,15 yard sehingga di lapangan kecil (GOR 40 × 20 m) titik tampak
   jauh lebih besar di layar, karena skala gambarnya ikut membesar. Sekarang
   radiusnya proporsional terhadap panjang lapangan (acuan DCI 120 yard), lalu
   dikalikan pengali pilihan pelatih (**50% – 200%**). Hasil terukur: diameter
   titik tampak **14,6 px** baik di DCI, lapangan bola, maupun GOR — dan
   **tetap 14,6 px** di drill DCI yang sudah ada, jadi tampilan lamanya tidak
   berubah. Yang mengikuti skala ini: radius titik, tebal garisnya, panjang
   garis hadap, dan ukuran teks kode pemain — di editor, presenter, dan
   tampilan anggota.

**Catatan:** preset lapangan hanya mengatur **geometri & sistem koordinat**
(ukuran, end zone, grid, hash, satuan, patok). Tampilan — **garis, warna, dan
ukuran titik** — adalah pilihanmu sendiri dan tetap dipertahankan saat ganti
preset.

**Catatan untuk buku saku:** karena `A` di tengah, huruf yang sama ada di dua
sisi (`B` kiri dan `B` kanan). Kalau itu membingungkan pemain, ada opsi
**penanda sisi** yang memberi tanda koma atas pada satu sisi (`B'` · `B`).

**Penyatuan sumber patok:** dulu koordinat dihitung terpisah dari patok yang
digambar, sehingga keduanya bisa berbeda. Sekarang keduanya membaca **satu
sumber** (`daftarPatok`), jadi tidak mungkin lagi tidak sejalan. Menyembunyikan
gambar patok juga tidak mengubah koordinat yang ditulis.

### Hasil DD2 (diuji 17 Sep 2026)

**Jalur & pembagian gerak selesai** dan teruji di dev, produksi, dan berkas
portabel (0 error).

Sebelumnya pemain meluncur **lurus dengan kecepatan konstan** dari awal sampai
akhir. Sekarang tiap set bisa diatur:

- **Bentuk jalur** — lurus atau **melengkung**, lengkungan −100% … +100%
  (melengkung ke kiri atau ke kanan terhadap arah gerak). Jejak gerak di layar
  ikut digambar sebagai kurva, bukan garis.
- **Pembagian kecepatan** — rata (seperti dulu), **halus** (pelan di awal &
  akhir), **mulai pelan**, atau **akhir pelan**.
- **Tunda mulai per section** (dalam count). Section yang ditunda diam dulu
  beberapa count, lalu **mengejar** sehingga tetap tiba bersamaan di akhir —
  bagian terakhir yang biasanya bikin formasi "bertubrukan".

Ketiganya tersimpan **per set** dan ikut dalam berbagi show, cadangan, dan
ekspor.

**Ketepatan hitungannya diuji, bukan sekadar dilihat.** Pada lengkungan +50%,
+100%, dan −100%, posisi titik tengah dibandingkan dengan hitungan kurva
kuadratik: selisih terbesar **0,0000 satuan gambar**. Ujung jalur juga tepat
sama antara lurus dan melengkung, jadi posisi akhir pemain tidak pernah
bergeser. Pengujian tunda: 5 pemain satu section diam di 25% waktu, lalu semua
tiba bersamaan — 0 pemain yang tertinggal di akhir.

**Satu sumber untuk semua tampilan.** Editor, presenter, dan urutan latihan
memakai modul yang sama (`src/lib/gerak.ts`), jadi tidak mungkin jejak
menunjukkan lengkungan yang berbeda dari animasi. Ini sengaja: pada DD1, dua
hitungan terpisah pernah membuat koordinat dan gambar patok tidak sejalan.

### Hasil DD3 (diuji 17 Sep 2026)

**Analitik & peringatan gerak selesai**, teruji di dev, produksi, dan berkas
portabel (0 error).

Ukuran beratnya **langkah per menit**, bukan langkah per hitungan — supaya tempo
drill ikut terhitung. Dengan langkah 8-to-5 (22,5"), pada 120 BPM dan 1 ketuk
per hitungan:

| Kelas | Langkah/menit | Arti di lapangan |
| --- | --- | --- |
| Nyaman | ≤ 120 | 1 langkah per ketuk = irama jalan biasa |
| Agak padat | 120 – 150 | masih bisa, tapi rapat |
| Berat | 150 – 180 | praktis harus setengah lari |
| Mustahil | > 180 | harus lari penuh — umumnya tidak bisa sambil membawa instrumen |

Panel **Analitik gerakan** menampilkan: tiga angka ringkasan (rata-rata
langkah/menit, langkah terjauh, pemain paling cepat), **batang per section**,
**set terberat di seluruh drill**, dan **daftar peringatan** berisi pemain yang
masuk kelas berat/mustahil lengkap dengan angkanya. Ada juga **peta kesulitan**:
sakelar yang mewarnai setiap jejak hijau → kuning → oranye → merah.

**DD3 mengambil dua hal dari DD2**, karena keduanya benar-benar menambah berat
gerakan:

- **Jalur melengkung** menempuh jarak lebih panjang daripada garis lurusnya —
  lengkungan 100% membuatnya **14,8% lebih jauh** walau titik awal & akhirnya
  sama. Rumus panjang kurvanya dihitung tepat (bukan didekati) dan sudah
  diverifikasi terhadap integrasi numerik: cocok hingga **6 desimal**.
- **Tunda mulai** memotong waktu yang tersedia, jadi kecepatannya naik walau
  jaraknya sama. Dalam uji coba, pemain dengan jarak 8 langkah dalam 8 count
  berada di 120 langkah/menit (nyaman); setelah section-nya ditunda 4 count,
  angkanya menjadi **275 langkah/menit (mustahil)**.

**Contoh nyata pada data contoh:** pada 16 count, rata-rata 142 langkah/menit
dengan 10 dari 18 pemain masuk peringatan — dan ketika count-nya dipaksa jadi 1,
semuanya berubah merah dan jumlah peringatan menjadi 18.

**Ambang 120/150/180 itu keputusan saya, berdasar fisika gerakan** — bukan
standar baku. Kalau menurutmu tim ini biasanya jalan lebih cepat atau lebih
pelan, angkanya bisa digeser; bilang saja.

### Hasil DD4 (diuji 17 Sep 2026)

**Alat gerak massa selesai**, teruji di dev, produksi, dan berkas portabel
(0 error).

Empat alat, semuanya bekerja pada **titik yang dipilih** — atau seluruh formasi
kalau tidak ada yang dipilih:

- **Putar blok** — 15°, 30°, 45°, 90° mengitari titik tengah blok.
- **Kembang-kempis** — perkecil/perbesar 5%, 10%, 25% dari titik tengah blok.
- **Cermin** — kiri ⇄ kanan, atau depan ⇄ belakang.
- **Geser blok** — 1, 2, 4, atau 8 langkah ke depan / belakang / Side 1 / Side 2.

**Satu operasi = satu langkah undo.** Ini penting: mengubah 60 titik tidak boleh
membutuhkan 60 kali Ctrl+Z.

**Arah hadap ikut dihitung**, bukan cuma posisi: putaran 90° memutar arah hadap
(front → left → back → right → front), dan pencerminan menukar kiri ⇄ kanan serta
depan ⇄ belakang. Putaran 15°/30°/45° sengaja **tidak** memutar arah hadap,
karena hasilnya arah diagonal yang tidak ada padanannya di pilihan arah hadap.

**Kebenarannya diuji dengan ukuran, bukan perasaan:**
- putar 90° → titik tengah blok **tetap**, dan jarak tiap titik ke titik tengah
  **kekal** (bentuk tidak berubah, hanya berputar);
- cermin kiri ⇄ kanan → setiap titik tepat di posisi cerminnya;
- geser 4 langkah → semua titik bergeser **tepat 2,5 satuan** (4 × 0,625 yard),
  seragam tanpa kecuali;
- undo → kembali ke posisi semula, titik demi titik.

**Satu jebakan yang ketemu saat diuji, lalu diperbaiki.** Dengan **satu** titik
dipilih, tombol putar & kembang-kempis tidak berpengaruh apa-apa — karena titik
tengah kumpulan satu titik ya titik itu sendiri. Daripada tombolnya diam tanpa
keterangan, sekarang tombol itu **dimatikan** dan panel menjelaskan: "Perlu
minimal 2 titik — kosongkan pilihan supaya berlaku untuk seluruh formasi."
Cermin dan geser tetap aktif, karena keduanya tidak bergantung pada titik
tengah.

**Dua keputusan yang saya ambil** (mudah diubah kalau kebiasaanmu berbeda):
1. Titik pusat putar & kembang-kempis adalah **titik tengah blok yang dipilih**,
   bukan titik yang ditentukan sendiri. Pyware mengizinkan memilih titik pusat
   secara manual — itu bisa ditambahkan nanti.
2. Cermin dilakukan terhadap **garis tengah lapangan**, jadi blok berpindah ke
   sisi seberang (bukan sekadar membalik bentuk di tempat). Ini yang lazim
   dipakai untuk membuat formasi simetris.

### Penyempurnaan DD4 — busur putaran (17 Sep 2026)

Pelatih bertanya: *"kenapa ketika mereka berputar, lingkarannya harus mengecil
dulu baru membesar lagi?"*

Bukan alat putarnya yang salah — posisi awal & akhirnya sudah benar. Yang salah
adalah **jalur tempuhnya**. Kalau tiap pemain berjalan lurus dari titik awal ke
titik akhir, yang ia tempuh adalah **tali busur**, bukan busur lingkaran.
Akibatnya formasi mengkerut di tengah jalan:

| Sudut putar | Radius di tengah jalan (jalur lurus) |
| --- | --- |
| 15° | 99% |
| 45° | 92% |
| 90° | **71%** |

Jadi pada putaran 90°, jarak antar pemain menyusut sampai 71% di pertengahan
perpindahan — persis seperti yang dilihat pelatih.

**Perbaikannya: pilihan jalur ketiga, `busur (putar)`.** Pemain mengitari pusat
putaran yang sama, sehingga radius — dan karena itu jarak antar pemain — tetap
utuh sepanjang jalan. Terukur:

| Jalur | Radius di 25% | 50% | 75% |
| --- | --- | --- | --- |
| Lurus (putaran 90°) | 0,791 | **0,707** | 0,791 |
| Busur (putaran 90°) | **1,000** | **1,000** | **1,000** |

Angka 0,707 itu tepat cos 45° — jadi hitungannya cocok dengan teori, bukan
kebetulan.

**Alat "Putar blok" memasangnya otomatis.** Ada kotak centang **"Ikuti busur"**
(nyala bawaan). Kalau dicentang, memutar blok sekaligus memasang jalur busur
dengan sudut dan pusat yang sama.

**Jalur busur dipasang pada set SEBELUMNYA, bukan set yang sedang dibuka.**
Ini penting dan mudah keliru: `gerak` pada sebuah set mengatur perpindahan
**dari** set itu ke set berikutnya. Memutar blok di set 3 berarti putarannya
terjadi pada perpindahan set 2 → set 3. Kalau dipasang di set 3, yang ikut
busur justru perpindahan 3 → 4 dan pemain tetap terlihat mengkerut.

**Hanya pemain yang benar-benar ikut berputar yang mengikuti busur.** Tiap
perpindahan dicek: kalau sesuai dengan putaran itu (toleransi 0,5 yard), ia ikut
busur; kalau tidak, ia tetap memakai jalur lurus/melengkung seperti pengaturan
semula. Jadi memutar satu blok tidak merusak jalan pemain lain. Pengecekan ini
juga membuatnya **kebal terhadap perubahan**: edit titik sesudahnya, dan busur
otomatis berhenti dipakai kalau perpindahannya tidak lagi cocok.

**Dua kutu yang ketemu saat diuji — keduanya hanya muncul setelah busur benar-benar dipakai:**
1. **Aplikasi mogok** — `Cannot access 'sx' before initialization`. Peta busur
   dihitung sebelum fungsi proyeksi `sx`/`sy` didefinisikan. Tidak pernah
   ketemu sebelumnya karena fungsinya selesai lebih awal (belum ada set
   berbusur) sehingga `sx` tidak tersentuh. Dipindahkan ke bawah setelah
   `sx`/`sy` ada.
2. **Busur tidak bisa dimatikan** — mengganti jalur kembali ke "lurus" tidak
   berpengaruh, karena pemeriksanya hanya melihat ada tidaknya pengaturan
   putaran, bukan pilihan jalurnya. Sekarang keduanya dicek.

### Hasil DD8 (diuji 17 Sep 2026)

**Langkah per hitungan di buku saku selesai**, teruji di dev, produksi, dan
berkas portabel (0 error).

Buku saku dan dot sheet sekarang punya kolom **`Lk/cnt`** (langkah per
hitungan) di tiap baris. Jadi kartu yang dipegang pemain tidak lagi sekadar
berkata "29 langkah" — melainkan "29 langkah dalam 16 count = **1,8 langkah per
hitungan**". Itu angka yang bisa langsung dipakai saat latihan, tanpa pemain
harus menghitung sendiri.

**Angkanya bukan sekadar jarak dibagi count**, melainkan memakai modul analitik
DD3 — jadi dua hal dari DD2 ikut terhitung:

- **Jalur melengkung** menambah jarak tempuh (lengkungan 100% ≈ 14,8% lebih
  jauh), sehingga Lk/cnt ikut naik walau jarak lurusnya sama.
- **Tunda mulai per section** memotong waktu yang tersedia, sehingga Lk/cnt
  naik walau jaraknya sama. Ini yang paling sering membuat latihan mendadak
  terasa mustahil padahal jaraknya tidak berubah.

**Hemat tinta, dan bisa dimatikan.** Angka diwarnai **hanya** kalau gerakannya
berat (oranye) atau mustahil (merah); sisanya hitam biasa. Ada kotak centang
"Sertakan langkah per hitungan" (nyala bawaan) di jendela cetak kalau kertasnya
perlu lebih ringkas.

**Terukur:** jarak 29 langkah dalam 16 count tercetak **1,82**; ketika count
dipaksa jadi 1, tercetak **12,92 dalam merah** (mustahil) lengkap dengan
legendanya; mematikan centang menghilangkan kolom dan legendanya sekaligus.

### Hasil DD10 (diuji 17 Sep 2026)

**Koordinat buku saku selesai**, teruji di dev, produksi, dan berkas portabel
(0 error).

Masalahnya berawal dari satu pertanyaan: karena `A` di tengah, **huruf yang
sama ada di dua sisi lapangan**. Di buku saku tidak ada penjelasan, jadi
`C` bisa berarti C di kiri atau C di kanan tengah. Tiga cacat ditemukan dengan
menghitung langsung terhadap `src/lib/field.ts`, lalu diperbaiki:

1. **Dua sisi tercetak sama.** C di sisi S1 dan C di sisi S2 sama-sama
   ditulis `C`. Sekarang sisi negatif diberi **koma atas** (`C'`).
2. **Tanda `−`/`+` terbalik di sisi negatif.** Jarak diukur dari tepi
   lapangan, bukan dari A — sehingga `C −2` tercetak untuk posisi yang
   sebenarnya *menjauhi* A. Ini yang paling berbahaya: anak-anak membacanya
   "dua langkah mendekati A" lalu berdiri di tempat yang salah. Sekarang
   tanda selalu diukur **dari A**, dan berlaku sama di dua sisi.
3. **Acuan bukan huruf.** Posisi dua langkah di dalam C ditulis `B# +2`
   (patok terdekat), padahal kebiasaan tim menyebutnya **`C −2`**. Sekarang
   acuannya selalu **huruf**; tanda `#` hanya muncul kalau pemain tepat
   berdiri di atasnya.

**Satu cacat lagi yang baru tampak setelah dua yang di atas selesai:** patok A
sendirian di tengah, jadi tidak punya pasangan `A`/`A'`. Kalau tanda jarak
dipakai sebagai penanda sisi, posisi 3¼ langkah di sebelah S2 tercetak
`A −3.25` — dibaca "mendekati A" padahal pemainnya **di seberang** A. Maka A
memakai aturan yang sama dengan huruf lain: **koma atas menandai sisi
negatif** (`A' +3.25`), dan jaraknya selalu diukur menjauhi A, jadi selalu
`+`.

**Kompas & panah arah.** Koordinat saja tidak memberitahu arah jalan. Supaya
kartu tidak kebanjiran informasi, penjelasannya dicetak **sekali di kepala
kartu** — mata angin kecil (`BELAKANG` · `PENONTON` · `S1` · `S2`) berikut
satu baris keterangan. Dengan begitu tiap baris cukup **satu panah** di kolom
jarak (`8 ↘`) dan **jumlah kolom tetap enam**. Panahnya **mutlak** (mata
angin), bukan sudut pandang pemain, sehingga tidak berubah saat pemain
menghadap lain. Bila tim tidak memakai patok, keterangan `A`/`−`/`+` otomatis
disembunyikan — yang tersisa hanya "panah = arah jalan".

**Terukur:** 13 kasus koordinat lulus semua (`A`, `A +2`, `A' +2`, `B`, `B'`,
`C`, `C'`, `C −2`, `C' −2`, `C +2`, `C' +2`, `A#`, `A#'`) dan 8 arah panah
lulus semua. Di kartu sungguhan: `C' · T5 +2.75` → `B' +2.25 · T6 +0.75`
dengan panah `↖`, dan koordinat serta panahnya selalu searah.

### Hasil DD10b (diuji 17 Sep 2026)

**Dua cara menghitung langkah selesai**, teruji di dev, produksi, dan berkas
portabel (0 error).

Berawal dari pertanyaan sederhana: *"di buku saku bagian arah & jalan, angkanya
ditentukan dari mana? Kalau 16 count berarti jalan 16 hitungan, kenapa angkanya
beda-beda?"* Ternyata dua hal itu memang berbeda — **count adalah waktu**, angka
di kolom itu adalah **jarak** — dan judul kolomnyalah yang menyesatkan.

Dari situ muncul konsep yang selama ini belum ada di aplikasi. Selama ini
aplikasi mengunci **ukuran langkah** (22,5″) lalu membiarkan kecepatannya yang
berubah: jarak dekat dalam hitungan panjang = jalan pelan, setengah langkah tiap
hitungan. Padahal banyak perancang drill memakai cara sebaliknya: **jumlah
langkah mengikuti hitungan**, lalu **panjang langkahnya** yang mengecil.

Jadi sekarang ada dua mode:

| Mode | Jumlah langkah ditentukan | Yang menyesuaikan |
| --- | --- | --- |
| **Ukuran langkah tetap** (bawaan) | jarak (22,5″ per langkah) | kecepatan — langkah per hitungan |
| **Langkah ikut hitungan** | hitungan × langkah/hitungan | panjang langkah — inci |

**Dua kolom terakhir buku saku menjawab dua pertanyaan berbeda**, karena itu
keduanya dicetak bersamaan:

- `Lk/cnt` → *"apakah aku harus berlari?"* — diwarnai dari **langkah per menit**
  (ambang 120/150/180, seperti DD3).
- `Ukuran langkah` (inci) → *"mampukah kakiku melangkah sejauh itu?"* — diwarnai
  dari panjang langkah, memakai angka yang sudah dikenal tim: hijau sampai
  **22,5″** (8-to-5), kuning sampai **30″** (6-to-5), oranye sampai **45″**
  (4-to-5), merah di atasnya.

Keduanya perlu, karena bisa saja ritmenya ringan tetapi langkahnya mustahil
panjang — atau sebaliknya. Contoh nyata: 1 langkah tiap hitungan pada 120 BPM =
**120 langkah/menit** (batas padat) walau langkahnya cuma 18,2″.

**Angka di kolom "Langkah & arah" sekarang konsisten dengan Lk/cnt di dua mode** —
dulu kolom itu dihitung garis lurus (`Math.hypot`) sementara Lk/cnt memakai
panjang jalur (lengkungan +14,8%), sehingga anak yang mencoba mengalikan akan
dapat angka yang tidak cocok. Sekarang keduanya membaca **satu sumber**.

**Bawaan per drill, timpaan per pemain per perpindahan.** Bawaannya ada di
Pengaturan drill. Di panel **Detail** pemain, tiap baris gerakan punya tombol
mode yang bersiklus `drill` → `tetap` → `hitungan` → `drill`; yang ditimpa
ditandai biru. Jadi satu gerakan bisa dikecualikan tanpa menyentuh seisi show.

**Terukur:**
- Mode tetap: `21 lk / 16 cnt = 1,31` vs `Lk/cnt 1,32` — cocok; ukuran `22,5″`.
- Mode menyesuaikan: `16 lk / 16 cnt = 1` vs `Lk/cnt 1` — cocok; ukuran `29,6″`.
- Timpaan per gerakan: panel Detail menampilkan `16 · 1 · 120 · 18,2″`, dan kartu
  untuk anggota yang sama mencetak `16 →` · `1` · `18,2″` — **sama persis**.
- Penimpa tetap tersimpan setelah panel ditutup-dibuka kembali.

### Hasil DD9 (diuji 17 Sep 2026)

**Scrub per hitungan & tapak langkah selesai**, teruji di dev, produksi, dan
berkas portabel (0 error).

Begitu dibongkar, ternyata **sebagian besar sudah ada sejak B2**: bilah waktu
(garis waktu), `Count N/M`, kecepatan 0,25×–2×, ulang terus, dan fungsi scrub
`geserKe()` sudah berjalan. Yang belum ada justru dua hal yang lebih kecil:

**1. Bilah waktu melangkah per hitungan.** Sebelumnya bilahnya meluncur bebas
(`step` 0,005), jadi tidak mungkin berhenti tepat di satu hitungan — padahal
pertanyaan pelatih di latihan selalu *"di count 5 pemain ini ada di mana?"*
Sekarang ada tombol **⌗ Per hitungan** yang mengubah satuan bilah jadi
hitungan (`min 0`, `max = count`, `step 1`), plus tombol **,** dan **.** untuk
mundur/maju satu hitungan. Mode lama tetap tersedia dengan satu klik.

Yang perlu hati-hati: loop animasi menulis nilai bilah **langsung ke DOM**
(sengaja, supaya tidak memicu render 60 kali sedetik), jadi penulisan nilainya
ikut disesuaikan memakai `perHitunganRef`. Dan karena posisi progres tidak ada
di state, tombol `,`/`.` membacanya dari `posisiRef` — ref baru yang dicatat
baik oleh loop animasi maupun oleh scrub, sehingga melangkah selalu mulai dari
posisi terakhir, bukan dari nol.

**2. Tapak langkah.** Satu tanda di sepanjang jejak untuk **tiap satu langkah**,
jadi kelihatan berapa kali pemain melangkah dan seberapa panjang langkahnya.
Jumlahnya diambil dari `jumlahLangkah()`, yang mengikuti mode langkah DD10b —
karena itu tapaknya berubah saat mode diubah, dan justru itulah gunanya:
"jarak dekat dalam hitungan panjang" kelihatan sebagai langkah pendek-pendek,
bukan jalan lambat.

**Satu hal yang langsung ketemu saat diuji:** mula-mula tapak digambar untuk
semua pemain yang jejaknya tampil. Dengan formasi 18 orang dan 16 hitungan itu
jadi **270 lingkaran** — papan justru tidak terbaca. Sesuai deskripsi DD9
("jejak langkah **pemain terpilih**"), tapak kini hanya digambar kalau ada
pemain dipilih.

**Terukur:**
- Bilah waktu: `min 0 · max 16 · step 1`, tombol ⌗ menyala.
- `.` tiga kali → `Count 3/16` dan titik bergerak; `,` → `Count 2/16`.
- Tapak mode tetap: **12 tapak** untuk perpindahan 13 langkah (= 13 − 1).
- Tapak tanpa pilihan: **0** (tidak membanjiri papan).
- Tapak mode ikut hitungan: **15 tapak** untuk 16 count (= 16 − 1).

### Hasil DD7 (diuji 17 Sep 2026)

**Tukar formasi lewat CSV selesai**, teruji di dev, produksi, dan berkas portabel
(0 error).

Sebelumnya yang ada hanya **ekspor** lembar koordinat (bentuk panjang: satu baris
per pemain per set). Yang belum ada — dan yang sebenarnya diminta — adalah
**impor**, supaya formasi bisa diedit di Excel lalu masuk kembali.

Logikanya ditaruh di modul **murni** (`src/lib/csvKoordinat.ts`, tanpa DOM/DB/React)
supaya bisa diuji langsung di node. Dua bentuk berkas didukung:

- **Lebar** — satu baris per pemain, sepasang kolom X/Y tiap set. Ini yang dipakai
  bertukar dengan Excel.
- **Panjang** — satu baris per pemain per set, yaitu bentuk lembar koordinat yang
  sudah diekspor sejak awal. Jadi berkas hasil ekspor sendiri bisa masuk lagi.

**Prinsip utamanya: impor tidak pernah menimpa tanpa diminta.** Bawaannya membuat
set baru di akhir daftar. Menimpa set aktif harus dipilih dulu.

**Dua bug yang ketemu saat diuji, keduanya berasal dari asumsi yang tidak pernah
dipertanyakan:**

1. **Nama set tanpa angka menyusut jadi satu set.** Nomor set diambil dari angka
   di judul kolom (`Set 1 X` → 1). Begitu dipakai nama `Set A X` / `Set B X` —
   yang tidak punya angka sama sekali — **semua pasangan dikira set nomor 0**, dan
   dua set menyusut jadi satu. Sekarang pasangan X/Y ditentukan dari **urutan
   kolom**; angka di judul hanya dipakai kalau semua kolom X berangka. Nama set
   juga kini diambil dari judul kolomnya (`Set A X` → "Set A"), jadi tidak lagi
   menjadi "Set 1/2/3" yang tidak bermakna.
2. **Berkas tanpa judul kolom tidak bisa diimpor**, karena tidak ada petunjuk mana
   X dan mana Y. Sekarang ada aturan posisi: kolom 1 kode, kolom 2 nama, lalu
   berpasangan; kalau sisanya ganjal, kolom nama dianggap tidak ada.

**Terukur:** 36 kasus murni lulus (round-trip ekspor→impor kembali ke posisi
semula dengan toleransi ¼ langkah; pemisah koma/titik koma/tab; satuan
langkah/yard/meter; asal Y belakang/tengah; tanpa judul; set berangka & tak
berangka). Di peramban: CSV lebar 3 pemain × 2 set terbaca "2 set · 3 pemain
cocok · 6 titik", set bertambah 2 → 4; jalur timpa memakai pemisah titik koma,
terbaca "1 set · 3 pemain cocok · 3 titik", dan jumlah set **tetap 4**.

### Hasil DD6 (diuji 17 Sep 2026)

**Detail per pemain selesai**, teruji di dev, produksi, dan berkas portabel
(0 error).

Pilih satu titik → tombol **Detail** membuka panel riwayat pemain itu, yang
menjawab dua pertanyaan yang sebelumnya harus dilihat set demi set: **seberapa
berat** perpindahan pemain ini, dan **di set mana** yang paling berat.

Isinya:

- **Tiga angka ringkasan** — total langkah sepanjang drill, rata-rata
  langkah/menit, dan gerakan terberatnya (berwarna sesuai kelasnya).
- **Kalimat penunjuk** seperti "Gerakan terberat: Set 4 → Set 5 — 26 langkah
  dalam 4 count (mustahil)", lengkap dengan tombol **Buka set itu**.
- **Tabel semua perpindahan**: `Perpindahan · Cnt · Langkah · Lk/cnt · Lk/mnt`,
  dengan kolom terakhir berwarna hijau → kuning → oranye → merah. Menyentuh
  salah satu baris langsung membuka set itu — jadi dari "pemain ini kesulitan"
  bisa langsung lompat ke "ini setnya".
- **Instrumen / perlengkapan** bisa diedit dari sini tanpa pindah halaman.

**Terukur:** pada data contoh, pemain pertama tercatat 13 langkah dalam 16
count = **0,81 langkah per hitungan** = **97 langkah/menit** (nyaman), cocok
dengan hitungan panel analitik. Perubahan instrumen tersimpan dan tetap ada
setelah panel ditutup-dibuka kembali. Menyentuh baris tabel menutup panel dan
membuka set yang bersangkutan.

**Satu keputusan yang saya batalkan sendiri.** Awalnya saya menambah field baru
`perlengkapan` pada data anggota untuk menuntaskan sisa DD5. Setelah diperiksa,
halaman Anggota **sudah punya** field **"Instrumen / perlengkapan"** dengan
contoh isian *Trumpet, Snare, Flag* — jadi perlengkapan sebenarnya sudah
tercakup sejak awal. Menambah field baru berarti menciptakan **dua tempat untuk
hal yang sama**, dan itu selalu berakhir dengan data yang tidak konsisten.
Field baru itu saya batalkan; panel detail cukup mengedit field yang sudah ada.

**Catatan tentang DD5 (properti & perlengkapan):** sebagian besar sudah ada
sejak A7 — **penanda bebas** di lapangan mendukung titik, kotak, garis bantu,
panah, dan teks, tersimpan per drill dan tampil di semua set. Sisa yang belum
ada: **perlengkapan yang melekat pada pemain** (misal "pemain ini membawa
bendera"), dan itu masuk DD6. Karena itu, usul saya lompati DD5 dan lanjut ke
**DD8 — langkah per hitungan di buku saku**, yang sekarang jadi hampir gratis
karena DD3 sudah menghitungnya; dilanjut **DD6 — detail per pemain**.

**Catatan arah (17 Sep 2026):** pelatih kedua ingin **semua fitur Pyware**, dan
memang benar DrillKit masih sederhana dibanding itu. Perlu jujur sejak awal:
Pyware dikembangkan selama puluhan tahun dan berharga mahal, jadi kita dekati
dengan **urutan nilai**, bukan dengan mengejar seluruh daftar fiturnya.

- **Realistis dikejar:** hampir semua alat desain dan cetak — jalur gerak, alat
  gerak massa, properti, detail per pemain, koordinat per hitungan, analitik
  gerak, tukar-menukar berkas.
- **Tidak realistis untuk aplikasi web seperti ini:** 3D penuh, ekspor video
  *fly-through* kualitas presentasi, dan kamera virtual bebas.

Karena itu urutan di atas disusun dari yang paling mengubah cara kamu bekerja,
bukan dari yang paling mirip Pyware.

## Fase berikutnya — kandidat baru (menunggu arahanmu)

Kelompok A–F sudah hampir habis: **23 dari 27 selesai**, 2 dicoret, tinggal
**C2 & C3** yang menunggu anggota memakai aplikasi sendiri. Supaya kamu tidak
kehabisan pilihan sambil menunggu, ini kandidat **baru** yang saya susun dari
keadaan tim hari ini — terutama dari tiga hal: **dua pelatih** yang menyunting
show yang sama, **masa lomba**, dan kebiasaan memakai **berkas portabel**.

| # | Ide | Masalah yang dipecahkan | Dampak | Usaha |
| --- | --- | --- | --- | --- |
| G1 | ✅ **Run sheet hari lomba** — *selesai 19 Sep 2026* | Menjelang hari-H, informasi tersebar di kertas & grup WhatsApp | ⭐⭐⭐⭐ | Sedang |
| G2 | ✅ **Mode lomba — layar hari H** — *selesai 19 Sep 2026*; **isinya berbeda dari rencana awal, lihat catatan di bawah** | Ruang persiapan tidak tahu posisi tim saat ini & apa yang disiapkan berikutnya | ⭐⭐⭐ | Sedang |
| ~~**G2b**~~ ✅ | **Kunci layar presenter** — PIN (sudah ada dari F2) sebelum layar bisa disentuh | Di lapangan layar tak sengaja tersentuh dan urutan set berubah | ⭐⭐⭐ | Kecil |
| ~~**G3**~~ ✅ | **Penanda mulai/selesai sesi** — pelatih menandai "kami mulai", lalu aplikasi membandingkan realisasi dengan rencana | Rencana & kenyataan tak pernah dibandingkan; keterlambatan hanya terasa, tak pernah terukur | ⭐⭐⭐ | Kecil |
| H1 | ✅ **Rencana latihan per sesi** — *selesai 19 Sep 2026*, bersama layar **pacu latihan** | Latihan sering melenceng dari rencana, bagian akhir kehabisan waktu | ⭐⭐⭐⭐ | Sedang |
| ~~H2~~ ✅ | **Evaluasi & kemajuan anggota**: catatan evaluasi terstruktur + rekap perkembangannya untuk pembinaan | Catatan evaluasi sekarang hanya teks bebas, perkembangannya sulit dilihat | ⭐⭐⭐ | Sedang |
| I1 | **Log perubahan show**: jejak siapa mengubah set apa & kapan — penting karena sekarang dua pelatih menyunting | Set tiba-tiba berubah tanpa tahu siapa yang mengubah | ⭐⭐⭐ | Kecil |
| ~~J1~~ ✅ | **Polesan kecil yang sengaja ditunda**: transposisi penala (nada sesuai instrumen), ambang predikat laporan bisa diatur, panduan 1 halaman versi anggota — *selesai 24 Sep 2026* | Beberapa kebiasaan tim belum bisa diatur sendiri | ⭐⭐ | Kecil |

Catatan 17 Sep 2026: **I1 (log perubahan show) belum pernah jadi masalah** —
pelatih tidak pernah kehilangan jejak siapa mengubah apa. Jadi statusnya sekadar
kandidat, bukan kebutuhan.

**Catatan jujur tentang G2 (19 Sep 2026).** Ide aslinya berbunyi *"semua set
tampil berurutan tanpa perlu disentuh, dengan kunci layar"*. Yang saya bangun
**berbeda**: layar hari H — jam berjalan, sesi yang sedang berjalan, hitung
mundur ke sesi berikutnya, set list penampilan terdekat, dan daftar
persiapan. Alasannya, G1 baru selesai dan G2 butuh sesuatu untuk ditampilkan.

Akibatnya **dua hal dari ide asli belum terpecahkan**, dan saya pecah menjadi
**G2b** di atas supaya tidak hilang begitu saja:

- **kunci layar** — justru yang paling sering terasa di lapangan;
- **set tampil berurutan tanpa disentuh** — belum saya perlukan, karena
  presenter sudah punya tombol maju-mundur dan mode asisten.

Semua kandidat di atas **tetap** mengikuti syarat lama: offline, tanpa server,
dan aman untuk browser lama di laptopmu.

## Rekomendasi saya — apa berikutnya

### Yang sudah saya sarankan di awal → semuanya sudah selesai

| Urutan | Ide | Alasan dulu |
| --- | --- | --- |
| 1 | **A4** — performa 40–80 pemain | Fondasi. Kalau editor melambat di jumlah pemain aslimu, fitur lain jadi tidak berguna. |
| 2 | **A1 + A2** — pilih banyak titik & alat susun | Paling menghemat waktu saat menyusun formasi: geser satu blok, ratakan baris, cermin kiri–kanan. |
| 3 | **B1** — Mode Presenter | Murah, tapi langsung kepakai tiap latihan: buka di HP, ketuk layar, pindah set. |
| 4 | **F1** — Backup otomatis | Ketenangan pikiran; data DrillKit tersimpan di perangkat. |
| 5 | **C1** — Halaman anggota | Setelah pelatihnya nyaman, sisi anggota diperkaya. |

### Yang sedang dikerjakan

**Tidak ada yang menggantung (19 Sep 2026).** Seri hari lomba (G1 + G2), H1,
dan Pusat Data sudah selesai dan terkomit. Yang tersisa tinggal **G2b (kunci
layar)**, **G3**, dan **H2** — menunggu Anda memilih.

Riwayat mutakhir, untuk dirujuk: **31e** dasar jarak, **G1** run sheet hari
lomba, **G2** layar hari H, **H1** rencana & pacu latihan, **Pusat Data** —
semuanya 19 Sep 2026. Masing-masing punya bagian tersendiri di bawah dan
commit sendiri di git, jadi bisa dibatalkan satu per satu tanpa mengganggu
yang lain.

**Drill (seri DD) diistirahatkan sejak 17 Sep 2026** atas permintaanmu,
sampai ada feedback dari pemakaian. Tidak ada item DD yang menggantung.

**Musik: M1–M5 semuanya selesai (17–19 Sep 2026)** — tanda birama & hitung
mundur, panjang lagu, ulang bagian, set list latihan, dan tukar repertoar
antar perangkat. Semua teruji di dev, produksi, dan berkas portabel. Rincian
& tiga cacat yang ketemu saat M1 diuji ada di bagian **E**.

Riwayat seri DD, untuk dirujuk kalau kelak dilanjutkan: Masing-masing teruji di dev, produksi, dan
berkas portabel dengan **0 error**, dan masing-masing punya commit sendiri di
git sehingga bisa dibatalkan satu per satu tanpa mengganggu yang lain.

| # | Selesai | Inti hasilnya |
| --- | --- | --- |
| DD1 | 17 Sep 2026 | Mode lapangan & patok kustom |
| DD2 | 17 Sep 2026 | Jalur & pembagian gerak |
| DD3 | 17 Sep 2026 | Analitik & peringatan gerak |
| DD4 | 17 Sep 2026 | Alat gerak massa (+ busur putaran) |
| DD5 | 17 Sep 2026 | Sudah tercakup penanda bebas (A7) |
| DD6 | 17 Sep 2026 | Detail per pemain |
| DD7 | 17 Sep 2026 | Impor/ekspor koordinat CSV |
| DD8 | 17 Sep 2026 | Langkah per hitungan di buku saku |
| DD9 | 17 Sep 2026 | Scrub per hitungan & tapak langkah |
| DD10 | 17 Sep 2026 | Koordinat buku saku tidak rancu |
| DD10b | 17 Sep 2026 | Dua cara menghitung langkah |

**J1 (polesan) selesai 24 Sep 2026** — lihat bagian **J1** paling bawah.

**Kandidat musik — semuanya sudah selesai, tidak ada yang tersisa.**

| # | Ide | Status |
| --- | --- | --- |
| **M1** | Tanda birama & hitung mundur | ✅ 17 Sep 2026 |
| **M5** | Panjang lagu (jumlah birama total) | ✅ selesai — fondasi untuk M2 & M3 |
| **M2** | Ulang bagian (loop) + loncat cepat ke segmen tempo | ✅ selesai |
| **M3** | Playlist / set list latihan | ✅ selesai |
| **M4** | Tukar repertoar antar perangkat | ✅ 19 Sep 2026 — rincian di bagian tersendiri di bawah |

### Sesudahnya

1. **H2 — Evaluasi & kemajuan anggota** (Sedang) — **ini yang saya sarankan
   berikutnya.** Waktu latihan sudah terjaga H1, jadi yang tersisa yang
   terasa berat adalah pembinaan orangnya.
2. **G3 — Penanda mulai/selesai sesi** (Kecil) — kini **hampir gratis**
   karena H1 sudah menyediakan catatan realisasinya; tinggal memakainya
   untuk sesi hari H.
3. **G2b — Kunci layar presenter** (Kecil) — murah dan langsung terasa di
   lapangan; bisa diselipkan kapan saja tanpa mengganggu pekerjaan lain.
4. **C2 & C3** (Sedang) — **keduanya rampung 24 Sep 2026**; sisi anggota
   untuk rencana komersial sudah terisi (kuis/hafalan + pengingat jadwal).
5. **J1 — polesan kecil** (Kecil) — **rampung 24 Sep 2026**: transposisi
   penala, ambang predikat laporan bisa diatur, panduan 1 halaman versi anggota.

**Catatan: G3 & H1 beririsan, jadi urutannya tidak netral (19 Sep 2026).**
H1 hendak menyimpan blok waktu latihan (pemanasan / section / gabungan)
beserta stopwatchnya; G3 hendak menandai kapan sebuah sesi benar-benar mulai
dan selesai. Kalau dilihat dari datanya, **keduanya pada dasarnya perkara
yang sama**: mencatat realisasi waktu untuk sebuah blok yang sudah
direncanakan. Karena itu:

- kalau **H1 dikerjakan lebih dulu**, sebagian besar G3 bisa jadi ikut
  selesai — tinggal memakai catatan waktunya untuk sesi hari lomba;
- kalau **G3 dikerjakan lebih dulu**, H1 akan mewarisi mekanismenya dan
  menjadi lebih murah.

**Dugaan ini terbukti (19 Sep 2026).** H1 dikerjakan lebih dulu, dan benar
saja: catatan `realisasiLatihan` yang dipakai layar pacu persis data yang
dibutuhkan G3. Yang tersisa untuk G3 tinggal **memakai** mekanisme yang
sudah ada pada sesi hari H, bukan membangun yang baru — karena itu G3 naik
ke urutan atas dan turun perkiraan usahanya.

Ada satu sisi yang membuat keduanya tetap berbeda: G3 dipakai di **hari H**,
saat orangnya tegang dan hanya punya waktu satu ketukan tombol, sedangkan
H1 dipakai di **latihan biasa**, saat pelatih sempat mengoreksi. Jangan
sampai antarmuka hari H diwarisi dari latihan tanpa dipikir ulang.

**Ditunda:** tidak ada lagi di daftar ini (C2 & C3 & J1 rampung 24 Sep 2026;
I1 tetap ditunda sesuai tabel status).
**Dicoret:** E2 (sudah ada di aplikasi inti) dan E1 (sisanya — getar — sudah
masuk E3).

---

## Yang **tidak** saya sarankan dulu

- Sinkronisasi antar perangkat / login anggota → butuh server & biaya (ingat syaratmu: nol biaya, tanpa backend).
- Notifikasi push ke semua anggota → juga butuh server.
- Impor berkas drill dari aplikasi lain (PDF/CSV pihak ketiga) → formatnya tidak baku, rawan salah.
- Editor musik / partitur → di luar inti aplikasi.

## Supaya kamu mudah memilih, jawab 3 pertanyaan ini

1. **Hari-H lombanya sudah lewat, atau masih jauh?** G1 (run sheet) & G2
   (layar hari H) sudah siap dipakai, jadi pertanyaan ini sekarang menentukan
   apakah **G2 sempat dicoba dulu di lapangan** — dan G2b (kunci layar)
   dipasang — atau kita langsung lanjut ke H1 (rencana latihan).
2. **Minggu ini, apa yang paling bikin kamu kesel?** (menyusun formasi / mencatat
   absensi / menjelaskan ke anggota / koordinasi dengan pelatih lain / hal lain)
3. **Sudah pernah dipakai dengan 40–80 pemain belum?** Kalau sudah, apa yang
   terasa berat?

Jawab yang mana saja yang kamu mau — cukup sebut **nomor idenya** (misal *"A4 dulu"*), nanti saya kerjakan itu saja sampai selesai.

---

## Berkas yang perlu kamu ambil setelah ada perubahan

Setiap kali satu ide selesai, berkas ini ikut diperbarui — ambil yang kamu pakai:

| Berkas | Untuk apa |
| --- | --- |
| `portable/DrillKit.html` | **Yang biasa kamu buka.** Satu berkas, dobel-klik, langsung jalan — tidak perlu internet, tidak perlu install. |
| `drillkit-portable.zip` | `DrillKit.html` dibungkus zip, mudah dikirim/dicadangkan. |
| `drillkit-release.zip` | Versi web lengkap (PWA + service worker) untuk diunggah ke hosting. |
| `release/` | Isi yang sama dengan zip di atas, sudah terbuka. |

**Catatan:** yang kamu buka di laptop adalah `portable/DrillKit.html`. Karena browser
di laptopmu lebih tua dari Chrome 111, semua warna di aplikasi ini memakai format
yang aman (`hex`/`rgb`) — jadi kalau nanti ada perubahan, jangan pakai `oklch()`,
`lab()`, atau `color-mix()` tanpa cadangan warnanya.

**Riwayat kode (baru sejak 17 Sep 2026):** folder `drillkit/` sudah menjadi
repositori **git**. Setiap ide yang selesai saya simpan sebagai commit, jadi kalau
suatu saat hasil perubahan tidak sesuai, kode bisa dikembalikan ke keadaan commit
terakhir tanpa mengganggu berkas jadi di atas:

| Perintah | Untuk apa |
| --- | --- |
| `git log --oneline` | melihat daftar perubahan yang pernah disimpan |
| `git status` | melihat berkas yang berubah sejak commit terakhir |
| `git checkout -- namafile` | mengembalikan satu berkas ke keadaan commit terakhir |

Yang **tidak** ikut tercatat di git (semuanya bisa dibuat ulang): `node_modules/`,
`dist/`, `dist-standalone/`, `release/`, `portable/`, dan `*.zip`.

**Cacat proses rilis yang ditemukan 20 Sep 2026 — dan pelajarannya.** Perintah
yang saya pakai untuk membungkus rilis sebelumnya adalah `zip -qr
drillkit-release.zip dist`. Rupanya `zip` **memperbarui** arsip yang sudah ada:
ia menambah dan menimpa berkas, tetapi **tidak pernah membuang** berkas yang
sudah hilang dari `dist/`. Karena setiap build menghasilkan nama aset baru
(`index-0uDpyCnC.js`), bundel lama menumpuk di dalam zip dari rilis ke rilis —
250 KB sampah terkumpul sebelum ketahuan. Tidak berbahaya bagi pemakai
(`index.html` selalu menunjuk aset yang baru), tetapi zipnya terus menggemuk
tanpa alasan.

Perintahnya sekarang: **`rm -f` zip-nya dulu, baru bungkus.**

```bash
rm -f drillkit-release.zip drillkit-portable.zip
zip -qr drillkit-release.zip dist -x "*.map"
zip -qr drillkit-portable.zip portable
```

Ini cacat yang sama jenisnya dengan beberapa yang lain di dokumen ini: yang
berbahaya bukan yang rusak saat dipakai, melainkan yang **terlihat baik-baik
saja** sambil perlahan menumpuk masalah. Ia tidak akan pernah ketemu oleh uji
yang membuka aplikasi — hanya oleh orang yang membuka isi arsipnya.

---

## Rotasi lingkaran yang ikut berjalan (18 Sep 2026)

Permintaan: *"di drill display, kita mau bikin rotasi lingkaran, tapi sambil
lingkarannya juga berjalan — apakah bisa?"*

**Bisa**, dan ternyata tidak butuh rumus baru. Rotasi yang pusatnya berjalan
itu sama dengan "putar sekian derajat, lalu geser":

```
P(t) = putar(P₀, θ·t) + geser·t
```

dan karena `P(t) − pusat(t) = putar(P₀ − pusat, θ·t)`, jarak tiap pemain ke
pusat yang *sedang berjalan* tetap sama. Bentuk formasi tidak berubah —
bloknya hanya ikut terbawa maju.

**Penyimpanan.** `GerakSet.putar` mendapat `pusatAkhir?` (yard). Tidak diisi =
berputar di tempat, persis perilaku lama — jadi ini murni tambahan dan data
yang sudah ada tidak berubah.

**Penurunan otomatis.** `turunkanPusatAkhir()` di `src/lib/gerak.ts`
membalikkan rumusnya. Untuk tiap pemain, `geserᵢ = P₁ − putar(P₀, θ)`; semua
pemain yang benar-benar ikut berputar menghasilkan angka yang sama, sedang
pemain yang diam atau jalannya berbeda menghasilkan angka acak. Karena itu
dipakai **kelompok terbesar yang sepakat** (paling sedikit dua pemain), bukan
rata-rata semua orang yang akan tercemar. Pemakai cukup menggambar set A & B
lalu menyebut sudutnya; angkanya tetap bisa diubah sesudahnya.

**Catatan yang sengaja diuji supaya tidak "diperbaiki" nanti:** pemain yang
berputar sambil pusatnya berjalan **kecepatannya tidak konstan**. Ia melaju
lebih cepat saat kecepatan putarannya searah dengan arah jalan, dan lebih
pelan saat berlawanan. Ini bukan cacat — memang begitu kenyataannya di
lapangan, dan justru itulah yang dihitung peringkat kesulitannya. Yang penting
mereka berangkat dan tiba bersama, dan bentuk formasinya utuh.

**Jebakan QA yang penting — mode per hitungan.** Bilah waktu
(`[data-testid="garis-waktu"]`) memakai mode per hitungan secara bawaan, jadi
rentangnya `0..counts` dengan `step = 1`, **bukan** `0..1`. Mengirim `0,5`
membuatnya dibulatkan, sehingga progres yang tercapai cuma `1/(2·counts)` —
titiknya nyaris tidak bergerak dan setiap uji "bentuk terjaga" lolos dengan
sia-sia. **Ini membuat `dd5-busur.mjs` kosong sejak awal**: ia mengirim
0,25–1,0 dan selalu mendapat rasio 1,000. Sudah diperbaiki dengan
mengalikan progres ke `slider.max` dan membulatkannya; kini jalur lurus
memberi **0,924 = cos(22,5°)** untuk putaran 45° — persis nilai teoretisnya,
dan busur memberi 1,000. Uji lama lain yang memakai `scrub` perlu
diperiksa dengan kacamata yang sama.

Teruji: `uji-putar-jalan` **90/90** (node) dan `putar-jalan` **25/25** di
**ketiga** target. Pembuktian utamanya: blok digeser 8 langkah, tombol Hitung
memulihkan perpindahan pusat **−0,25 → 7,75 langkah** (tepat 8), dan
ke-18 pemain kembali mengikuti busur — sebelumnya nol.

---

## Ambang kesulitan gerak — analitik & buku saku diseragamkan (18 Sep 2026)

Keluhan: *"step size pada analyzer dengan pada buku saku memiliki standar yang
berbeda — pada analyzer aman, tapi pada buku saku malah berat dan mustahil."*

### Penyebabnya bukan dua standar, melainkan analitik yang buta separuh

Keduanya sebenarnya memakai modul yang sama (`src/lib/analitik.ts`), tetapi
menilai **dua dimensi yang berbeda**, dan hanya buku saku yang menampilkan
keduanya:

| | kecepatan (langkah/menit) | ukuran langkah (inci) |
| --- | --- | --- |
| Panel **Analitik gerakan** | ✅ dinilai | ❌ **tidak pernah ditampilkan** |
| **Buku saku** | ✅ dinilai | ✅ dinilai & diwarnai |

Contoh yang melahirkan keluhan itu: pemain menempuh 8 yard dalam 4 hitungan
pada mode `menyesuaikan`, 1 langkah per hitungan, tempo 120 BPM.

- kecepatan = 1 × 120 = **120 langkah/menit → "nyaman"** (yang dilihat analitik)
- ukuran langkah = 8 yard ÷ 4 = **72 inci → "mustahil"** (yang dicetak buku saku)

Jadi analitik bisa dengan jujur menulis *"Semua gerakan masih nyaman"*
sementara lembaran yang dibagikan ke pemain penuh warna merah.

### Yang diubah

1. **Dua dimensi keduanya dinilai.** `MetrikPemain` mendapat `tingkatAkhir` =
   yang lebih buruk dari kecepatan dan ukuran langkah (`lebihBerat`).
   `peringatan` kini menyertakan masalah ukuran langkah — dulu hanya kecepatan.
2. **Analitik menampilkan ukuran langkah.** Baris "Langkah terbesar" muncul di
   panel, diwarnai dengan aturan yang sama seperti buku saku.
3. **Batang section memakai tingkat gabungan**, jadi section yang pelan tapi
   langkahnya raksasa tetap merah.
4. **Daftar peringatan menyebut dimensi yang bermasalah** — kecepatan, ukuran
   langkah, atau keduanya. Tanpa itu pembaca tidak tahu apa yang mesti
   diperbaiki.
5. **Ambangnya bisa diatur** lewat `TeamSettings.ambangGerak`
   (`perMenit` & `inci`), diedit di Pengaturan, dengan tombol
   *Kembalikan ke bawaan*.

`ambangEfektif()` mengembalikan ambang yang benar-benar berlaku (punya tim,
atau bawaan) dan `urutkan()` merapikan ambang yang salah ketik tidak urut —
mungkin terjadi, dan tanpa itu tingkatnya melompat-lompat.

### Bukti yang menentukan

Memperketat ambang ukuran langkah (22,5/30/45 → 8/12/16 inci) pada data contoh:

| | ambang bawaan | ambang ketat |
| --- | --- | --- |
| gerakan berat/mustahil di analitik | 10 | **18** |
| tanda merah di buku saku | 24 | **42** |

**8 gerakan selama ini lolos dari analitik** dan baru kelihatan setelah ukuran
langkah ikut dinilai. Itulah angka yang hilang.

`uji-ambang-gerak` **59/59** (node), `ambang-gerak` **20/20** di ketiga target.
Bagian 5 uji node-nya adalah reproduksi persis keluhan di atas.

### Jebakan QA: pratinjau cetak ada di dalam iframe

Pratinjau buku saku dirender sebagai `<iframe srcDoc=...>`, jadi
`document.body.innerHTML` **tidak** memuat isi kertasnya. Menghitung warna
merah dari situ akan menghitung UI aplikasi sendiri dan selalu menghasilkan
angkanya — uji terlihat lolos walau kertasnya kosong. Harus masuk dulu:

```js
const el = await p.$('iframe[title="Pratinjau cetak"]')
const frame = await el.contentFrame()
const html = await frame.content()
```

---

## Mode asisten di presenter (K1, 18 Sep 2026)

Fase 1 dari mode asisten: **menuntun run-through**.

Ternyata B3 (urutan latihan) sudah menjalankan set berurutan dengan benar —
jadi yang kurang bukan pergerakannya, melainkan **pemberitahuannya**. Presenter
hanya menggerakkan titik tanpa pernah mengatakan apa yang sedang terjadi.
Asisten menambah lapisan itu.

**Alurnya:** `SIAP` (hitung mundur mengikuti tempo, memakai jeda "Diam N ct"
yang sudah ada) → `JALAN` → … → `SELESAI`.

Kartu menampilkan: set asal → tujuan, jumlah count & tempo, **catatan set
tujuan**, dan peringatan section bila ada. Catatan diambil dari set **tujuan**
karena catatan di situlah yang menjelaskan formasi yang harus dibentuk.

### Catatan set selama ini tidak bisa diisi

Field `DrillSet.notes` sudah ada sejak lama tetapi **tidak pernah bisa diisi
dari antarmuka mana pun** — nilainya selalu kosong. Karena asisten
membacakannya, isiannya kini ditambahkan di editor ("Catatan set", di bawah
Nama set / Count / Tempo).

### Jebakan 1: kartu "Selesai" mati seketika

Pembersih `useEffect` pada `[urutan]` menghapus `tahap`. Begitu urutan selesai
dan `urutan` menjadi `false`, pembersih berjalan dan kartu "Selesai" lenyap
pada detik yang sama ia dibuat. Solusinya: penanda `rampung` — pembersih hanya
membersihkan `tahap` kalau urutannya **dibatalkan**, bukan habis sendiri.

### Jebakan 2: menyalahkan hal yang keliru

Awalnya peringatan menampilkan `tingkatAkhir` (gabungan) bersama ukuran
langkah, sehingga muncul *"Perhatian Pit — langkah 22,5″ (mustahil)"*. Padahal
22,5 inci itu **nyaman**; yang mustahil adalah kecepatannya. Pesan seperti itu
akan membuat pelatih memperkecil langkah, padahal yang perlu ditambah jumlah
count-nya.

Perbaikannya: `MetrikSeksi` kini menyimpan `tingkatLangkah` terpisah, dan
peringatan menyebut **sebab yang sebenarnya** — `langkah 34″` atau
`227 langkah/mnt` — lengkap dengan `data-sebab` supaya bisa diuji. Ini juga
alasan `tingkatAkhir` tidak pernah cukup untuk keperluan penyampaian pesan:
ia menjawab "berapa berat", bukan "apa sebabnya".

### Jebakan 3: "Set baru" menyalin set sebelumnya

`addSet()` memanggil `copyPrevious = true`, jadi set baru **identik** dengan
sebelumnya. Perpindahan ke set itu tidak menggerakkan siapa pun, analitik
mengembalikan hasil kosong, dan peringatan section tidak akan pernah muncul —
uji yang mengharapkannya gagal tanpa sebab yang jelas. Set baru harus
**digeser** dulu supaya ada perpindahan sungguhan.

Teruji: `asisten-urutan` **23/23** di ketiga target. Yang dibuktikan: urutan
tahap `siap` → `jalan` → `selesai`, hitung mundur benar-benar berdetak (2 → 1),
catatan set terbaca, mematikan asisten menghilangkan kartu **tanpa**
menghentikan B3, dan peringatan section mengikuti ambang yang sama dengan
panel analitik.

## Mode asisten — latihan per section (K2, 18 Sep 2026)

Fase 2: **melatih satu seksi saja** tanpa kehilangan konteks formasi.

Keputusan yang diambil: seksi yang dipilih bergerak, sisanya **tetap tampak
tetapi diredupkan** (`opacity 0.22`) — bukan disembunyikan. Pemain yang sedang
dilatih harus tetap melihat di mana rekan mereka berdiri, karena posisi
mereka sendiri didefinisikan relatif terhadap orang-orang itu. Menyembunyikan
separuh barisan justru melatih hal yang keliru.

Ditambahkan pula **"Ulang terus"** (`chip-ulang-perpindahan`): mengulang satu
perpindahan tanpa maju ke set berikutnya. Ini yang diucapkan pelatih di
lapangan — *"Battery, ulangi lagi."*

### Jebakan: penyaringan gerak ada di dua tempat

Loop animasi menyusun vektor per pemain lewat **dua** pola sumber yang
berbeda (sekitar baris 304: `if (!q) continue` lalu `vec.push`, dan baris 380:
`if (q) vec.push`). Menambal satu jangkar saja hanya menyaring separuh jalur
gerak, dan gejalanya samar — sebagian titik redup tetap bergerak. Cari dengan
`grep -n "vec.push"` lalu tambal keduanya terpisah.

### Jebakan: state terbaca basi di dalam loop

Loop animasi dipasang sekali, jadi `seksi`/`anggotaSeksi`/`ulangPerpindahan`
harus diakses lewat **ref** (`seksiRef`, `anggotaRef`, `ulangPerRef`).
Membaca state langsung akan mengunci nilai pada saat loop dipasang dan
pilihan seksi tidak akan pernah berpengaruh.

### "Ulang terus" tidak butuh reset

Pengulangan dilakukan dengan `continue` **sebelum** `setIdx(i + 1)`, jadi
indeks set tidak pernah berubah. Tidak perlu mengembalikan transformasi ke
nol: `mainkanPerpindahan` sudah membersihkannya sendiri di akhir putaran,
sehingga setiap ulangan mulai dari posisi diam yang benar.

Teruji: `asisten-seksi` **19/19** di ketiga target. Yang dibuktikan: memilih
seksi meredupkan 13 dari 18 titik, titik redup **tidak pernah bergerak**
(0 dari 57 cuplikan) sementara yang terang bergerak, "Ulang terus" menahan
set di tempat latihan dimulai selama 7 detik sambil gerakannya berulang dan
kembali diam tiap putaran, kembali ke "Semua" menghapus semua peredupan, dan
tanpa "Ulang terus" urutan B3 tetap maju normal (2/3 → 3/3).

## Mode asisten — checklist kemajuan (K3, 18 Sep 2026)

Fase 3: **kemajuan latihan yang tersimpan lintas sesi**.

### Kenapa tabel sendiri, bukan menempel di `Drill`

Daftar drill diurutkan dengan `db.drills.orderBy('updatedAt')`. Kalau centang
disimpan di rekaman drill, **setiap centang akan menulis ulang `updatedAt`** —
dan drill itu melompat ke puncak daftar setiap kali pemain mencentang sesuatu.
Gejalanya tidak berkaitan dengan apa yang dikerjakan, jadi akan sangat
membingungkan untuk dilacak.

Karena itu kemajuan hidup di tabel `kemajuan` sendiri, berbentuk
`setId → (kunci → waktu)`. Menulis ke sini **tidak pernah menyentuh `Drill`**.

### Kunci centang: `'*'` atau id seksi

Satu set bisa selesai lewat **dua jalan**: ditandai `'*'` (seluruh formasi),
atau tiap seksi dicentang satu-satu. Dua jalan ini yang melahirkan cacat di
bawah.

### Cacat: chip "Kuasai" membaca pertanyaan yang salah

Awalnya chip memakai `seksiSelesai(k, setId, '*')` untuk menampilkan keadaan
dalam mode "Semua". Padahal fungsi itu hanya menjawab *"apakah kunci `'*'`
dicentang"* — ia tidak tahu daftar seksi. Akibatnya: pelatih mencentang
Brass → Battery → Pit → CG → Woodwind satu per satu hingga **lengkap**, dan
chip tetap menampilkan **belum dikuasai**, karena `'*'` memang tak pernah
dicentang.

Perbaikannya ada dua lapis:
- Tampilan memakai `setSelesai` (yang menerima `daftarSeksi`) saat mode
  "Semua"; `seksiSelesai` hanya dipakai untuk menilai satu seksi.
- Mengklik chip saat set sudah rampung memanggil `bersihkanSet`, bukan
  menambah `'*'`. Tanpa ini, "membatalkan" kemajuan yang lengkap lewat jalan
  per seksi tidak ada caranya — mencentang `'*'` cuma menambah, tidak pernah
  mengurangi, sehingga klik pertama tampak seperti tidak berbuat apa-apa.

Pelajaran: begitu sebuah keadaan bisa dicapai lewat **lebih dari satu jalan**,
tombol baliknya harus memakai pembacaan yang sama dengan tombol majunya.

### Teruji di dua tingkat

Logika murni diuji di node (`kemajuan-logika` **26/26**) — cepat, tanpa
browser, dan menangkap persis cacat di atas. Penyimpanan diuji di browser
(`kemajuan-presenter` **26/26**) dengan **memuat ulang seluruh halaman**,
bukan sekadar menutup presenter, karena centang yang cuma tersimpan di state
React akan tetap lolos kalau pengujinya hanya menutup presenter.

## Tukar repertoar antar perangkat (M4, 19 Sep 2026)

Memindahkan lagu, set list, dan drill yang menautkannya antar perangkat
pelatih lewat satu berkas.

### Kenapa bukan `ShareBundle` yang diperluas

`ShareBundle` sudah berisi `songs`, jadi godaannya tinggal menambah jalan
impor. Tetapi paket itu **mengalir satu arah** (pelatih → HP anggota), dan
satu-satunya jalan masuknya menyimpannya ke `db.packages` pada kunci
`'current'` — artinya (a) lagu yang diimpor tak pernah masuk ke `db.songs`,
dan (b) **membuka paket kedua menghapus yang pertama**. Memperluasnya berarti
mengubah makna berkas yang sudah beredar. Karena itu M4 memakai format
sendiri: `drillkit-repertoar`.

### Aturan yang menentukan: id lagu tidak boleh berubah

`Drill.songId` dan `SetList.songIds` menyimpan **id**, bukan salinan lagu.
Kalau impor memberi id baru, tautan drill ke lagu putus dan set list jadi
kosong — dan gejalanya **tidak terlihat saat berkas dibuka**, baru terasa
berminggu-minggu kemudian saat latihan memakai lagu itu. Karena itu impor
memakai `bulkPut` dengan id apa adanya, dan uji browser membandingkan
id perangkat asal dengan id perangkat tujuan secara langsung.

### Keputusan yang diambil pemakai

- **Yang ikut**: lagu + set list + drill yang menautkannya (beserta set-nya).
  Set list dan drill **mengikuti lagu** otomatis, tidak dipilih terpisah —
  menyuruh pelatih memilihnya sendiri hanya memberi peluang menghasilkan
  paket yang tidak lengkap.
- **Konflik**: timpa dengan yang datang. Tetap ditambahkan **satu** pratinjau
  berisi hitungan "N baru / M ditimpa" dan peringatan sebelum menjalankan.
  Menimpa tanpa pemberitahuan sama sekali akan menghilangkan suntingan lokal
  tanpa jejak.
- **Tempat**: panel dipasang di halaman Musik (di dalam kartu Repertoar) dan
  juga di halaman Berbagi, dengan tautan bolak-balik. Komponen
  `PanelTukarRepertoar` **memuat drill dan nama timnya sendiri**, jadi kedua
  titik pemasangan tidak perlu tahu-menahu soal itu.

### Jebakan: rute Berbagi bernama `/berbagi`

Uji yang menuju `location.hash = '#/bagi'` diam-diam berakhir di Dasbor
(karena `*` → `/`), lalu gagal mencari panel dengan pesan yang tidak
menyebut sebab yang sebenarnya. Nama yang mirip tidak cukup — baca
`src/App.tsx`.

### Teruji

Logika murni di node (`repertoar-logika` **31/31**) menangani penyusunan
berikut-ikutannya, penolakan berkas asing, normalisasi berkas versi lama, dan
deteksi rujukan yang hilang. Uji browser (`tukar-repertoar` **36/36**)
mengimpor ke **konteks browser terpisah** — IndexedDB benar-benar kosong,
jadi benar-benar menyimulasikan perangkat kedua; mengimpor ke perangkat yang
sudah berisi lagu yang sama tidak membuktikan apa-apa.

## Dasar jarak — pilihan desainer (31e, 19 Sep 2026)

Dua kebiasaan yang sama-sama dipakai, dan tidak ada yang benar sendiri:
**jarak tempuh kaki** (mengikuti kelengkungan jalur) versus **garis lurus**
dari titik awal ke akhir. Dulu aplikasi hanya menghitung yang pertama; kini
desainer drill yang menentukan, per drill.

### Mengapa ini lebih mendesak daripada fitur baru

Ini menyelesaikan pertanyaan yang masih terbuka pada kode yang **sudah
terlanjur dikirim** (kerja ukuran langkah `48dc763`). Fitur baru bisa
menunggu; pertanyaan yang belum terjawab pada sesuatu yang sudah dipakai
orang, sebaiknya tidak.

### Aturan yang menentukan: jalur lurus tidak boleh berubah

Pada jalur lurus kedua dasar **harus memberi angka yang sama persis**. Kalau
tidak, fitur ini diam-diam mengubah angka di semua drill lama — cacat yang
jauh lebih menyusahkan daripada fitur yang tidak ada. Karena itu
`dasarJarak` bersifat opsional dengan bawaan `'jalur'`, dan uji node
memasang **pemeriksaan khusus** bahwa jalur lurus tidak terpengaruh.

### Dua permukaan, dua fungsi berbeda

Jarak dihitung di **dua** tempat yang terpisah: `analisisPerpindahan` di
`analitik.ts` (panel analitik, peringatan asisten) dan `jumlahLangkah` di
`Drill.tsx` (buku saku & dot sheet). Keduanya harus mengikuti pilihan yang
sama — kalau cuma satu, pelatih melihat dua angka berbeda untuk perpindahan
yang sama. Uji browser karena itu membaca **angka langkah di dalam lembar
cetak**, bukan sekadar memastikan pengaturannya tersimpan, dan hasilnya
menyilang: 32 langkah (garis lurus) dan 37 (jarak tempuh) di kedua permukaan.

Lembar cetak juga kini **menyebut dasar yang dipakai** di legendanya,
sebab buku saku adalah kertas yang dipegang pemain — tanpa itu, pelatih dan
pemain bisa membaca dua angka berbeda tanpa tahu sebabnya.

### Jebakan: huruf kapital di lembar cetak

Header tabel buku saku tertulis `LANGKAH & ARAH` — kapital karena CSS, bukan
karena isinya. Uji yang mencari `'Langkah'` pada `innerText` gagal dengan
pesan yang sama sekali tidak menyebut sebabnya. Cocokkan dengan huruf kecil
bila memeriksa teks yang sudah digayai.

### Jebakan: menambahkan bagian baru ke ekor dokumen

Bagian baru ditulis dengan menempelkannya pada **teks jangkar** yang ada.
Kalau jangkar itu berada di tengah bagian lain — misalnya paragraf penutup
bagian K3 — bagian baru akan tersisip **di tengahnya**, membelah narasi.
Gejalanya tidak muncul di layar: baru kelihatan kalau struktur headings-nya
diperiksa (`grep -n "^## \|^### "`). Hal ini sudah dua kali terjadi di
berkas ini (M4 membelah K3, lalu 31e membelah M4) sebelum diperbaiki.

Sebelum menulis bagian baru, periksa dulu bahwa jangkar yang dipakai
merupakan **baris terakhir** dari bagian yang dituju.

### Teruji

Logika murni di node (`jarak-logika` **16/16**) membuktikan jalur lurus tidak
berubah, kelengkungan 1 menambah ~14,8%, serta perilaku pada mode langkah
`tetap` dan `menyesuaikan`. Uji browser (`dasar-jarak` **17/17**) membuktikan
kontrol tersimpan lintas muat dan **kedua permukaan** mengikuti pilihan.


## Run sheet hari lomba (G1, 19 Sep 2026)

Jadwal (`Session`) selama ini hanya berisi **rentang waktu kosong**: jam
berapa sampai jam berapa, di mana. Ia tidak tahu apa yang dibawakan di slot
itu. Padahal pada hari lomba, pertanyaan yang paling menentukan justru:
**apakah isi penampilan muat di slot waktunya?**

Dipilih lebih dulu daripada G2 (mode lomba presenter) karena G2 butuh sesuatu
untuk ditampilkan; kebalikannya tidak.

### Mengapa `takPasti` dipisah dari `cukup`

Set list yang masih punya lagu tanpa panjang menghasilkan total **sementara**.
Menyebutnya "cukup" akan membuat pelatih berhenti mengecek, padahal angkanya
belum final — dan bisa saja berubah jadi tidak muat. Karena itu statusnya
terpisah, dan peringatannya menyebut jumlah lagu yang belum diisi. "Mungkin
cukup" dan "cukup" bukan hal yang sama.

### Yang diubah pada data: `Session.setListId`

Satu field opsional. Tanpa tautan ini run sheet hanya bisa menampilkan
rentang waktu kosong — yang sudah bisa dilihat di halaman Jadwal. Sesi tetap
dibuat & disunting di halaman Jadwal; halaman run sheet hanya melengkapi dan
menilai.

### Dua permukaan lagi — dan mengapa lembar cetaknya diuji isinya

Run sheet pada hari lomba dipakai sebagai **kertas**. Karena itu uji browser
menangkap berkas unduhan HTML-nya lalu memeriksa isinya: judul sesi, nama set
list, peringatan, dan penanda baris yang tak muat. Menguji hanya bahwa tombol
Unduh berfungsi akan membuat fitur ini lolos uji walau cetakannya kosong.

### Jebakan: Dexie tidak melihat tulisan IndexedDB mentah

Uji menyiapkan fixture dengan menulis langsung lewat IndexedDB. Setelah itu
**wajib dimuat ulang**: `useLiveQuery` milik Dexie hanya bereaksi pada
perubahan yang dilakukan **lewat Dexie sendiri**, bukan tulisan dari koneksi
IndexedDB lain. Tanpa memuat ulang, tampilan terus memakai data lama dan uji
gagal dengan angka yang tampaknya acak — sulit dilacak kalau tidak tahu
sebabnya.

### Jebakan: jangan menebak durasi lagu contoh

Lagu yang dibawa data contoh punya tempo map sendiri, jadi durasinya tidak
bisa ditebak dari luar. Uji yang mengasumsikan "32 birama @ 120 BPM = 64
detik" gagal dengan selisih tiga detik. Untuk uji yang perlu angka pasti,
buat lagu baru yang bersih (`tempoMap: []`), jangan memakai lagu contoh.

### Teruji

Logika murni di node (`runsheet-logika` **45/45**) menangani penguraian waktu,
pengurutan linimasa, baris tanpa waktu, bentrok, dan keempat status
kecukupan. Uji browser (`runsheet-lomba` **23/23**) menautkan set list lewat
dropdown sungguhan, melihat status berubah `cukup` → `melebihi`, memeriksa
**isi berkas cetaknya**, dan memastikan tautannya tersimpan lintas muat.


## Mode lomba — layar hari H (G2, 19 Sep 2026)

Tampilan besar untuk ruang persiapan pada hari pertunjukan. G1 menjawab
"apakah rencananya muat"; ini menjawab **"di mana kita sekarang, dan apa yang
harus disiapkan berikutnya"**.

Dikerjakan setelah G1 karena G2 butuh sesuatu untuk ditampilkan; kebalikannya
tidak.

### Rentang slot setengah terbuka: `mulai ≤ now < selesai`

Ini keputusan yang paling mudah salah dan paling menjengkelkan di hari H:
pada pukul 08:00:00 tampilan masih bilang "Pemanasan" padahal penampilan
sudah dimulai. Dengan rentang setengah terbuka, menit ke-08:00 **sudah**
menjadi milik sesi berikutnya. Uji node menguji tepat di kedua ujung slot
(07:15 dan 08:00 pada contoh yang sama), karena di situlah letak
kesalahannya.

### Tidak ada nilai "terlambat" — dan itu disengaja

Godaan pertama adalah menambahkan penanda "kita terlambat N menit". Tetapi
keterlambatan **tidak bisa diturunkan dari rencana saja**: kalau jam
menunjukkan 08:20 dan rencana bilang penampilan 08:00–08:05, aplikasi tak
bisa tahu apakah tim sedang tertinggal atau rencananya yang bergeser — itu
butuh penanda "kami sudah mulai/selesai" dari pelatih. Menampilkan angka
terlambat yang diada-adakan akan lebih menyesatkan daripada tidak ada.
Karena itu yang ditampilkan adalah posisi rencana apa adanya: sesi yang
sedang berjalan, sisa slotnya, dan hitung mundur ke sesi berikutnya.

### Menguji sesuatu yang bergantung jam sungguhan

Jam tidak bisa dibekukan dari luar tanpa perkakas yang berat. Alih-alih
memanipulasi waktu, uji **menyusun sesinya mengapit saat ini** — dihitung
dari jam peramban saat uji berjalan: satu sesi sudah lewat, satu sedang
berjalan (mulai 10 menit lalu, habis 20 menit lagi), satu berikutnya (30
menit lagi). Hasilnya pasti, dan keadaan batasnya ikut teruji. Uji juga
memastikan hitung mundurnya **benar-benar berkurang** (bukan hanya
bertampilan benar) dengan membacanya dua kali berjarak 2,5 detik.

### Teruji

Logika murni di node (`lomba-logika` **45/45**) menangani keempat fase hari
(belum mulai / sedang / senggang / rampung), keadaan batas di ujung slot,
baris tanpa waktu, hari kosong, dan format tampilan. Uji browser
(`mode-lomba` **23/23**) membuktikan fase terdeteksi benar, hitung mundur
berkurang sungguhan, set list penampilan terdekat tampil, centang persiapan
tersimpan lintas buka-tutup, dan peringatan run sheet ikut tampil di hari H.


## Rencana latihan per sesi (H1, 19 Sep 2026)

Keluhan yang mendasarinya: **latihan sering melenceng dari rencana, dan
bagian akhir yang kehabisan waktu.** Bagian akhir selalu yang paling mahal —
di situlah biasanya materi yang paling perlu diulang — tetapi justru yang
paling dulu dipotong kalau waktunya habis.

Dipecah menjadi dua permukaan yang waktunya berbeda: **penyunting rencana**
(sebelum latihan: apakah rencananya muat?) dan **pacu latihan** (selama
latihan: sudah melenceng berapa jauh?).

### Disimpan sebagai durasi, bukan jam absolut

Tiap blok menyimpan **menitnya**, bukan jam mulainya. Jam absolut diturunkan
dengan menjumlahkan durasi dari jam mulai sesi.

Alasannya praktis: begini pelatih menggeser jam mulai sesi dari 15:30 ke
16:00, **seluruh blok ikut bergeser** tanpa perlu disusun ulang satu per
satu. Kalau jam absolut yang disimpan, menggeser jam sesi akan membuat
seluruh rencana meleset dari slotnya — cacat yang baru ketahuan di
lapangan.

### Geser: blok yang sedang berjalan hanya menyumbang kelebihannya

Ini cacat yang saya temukan **saat merancang uji**, bukan saat menguji —
dan ia akan menghasilkan angka yang menenangkan padahal kosong.

Rumus pertama: tiap blok menyumbang `berjalan − rencana`. Akibatnya, baru 5
menit masuk blok berjatah 20 menit, layar membaca **"lebih cepat 15 menit"**.
Padahal yang benar kita tidak tahu apa pun selain "belum melenceng" — blok
itu masih bisa saja molor 20 menit ke depan.

Rumus yang benar: blok yang **sudah selesai** menyumbang selisih utuhnya
(lebih atau kurang), sedangkan blok yang **sedang berjalan** hanya menyumbang
`max(0, berjalan − rencana)` — kelebihannya yang sudah terjadi.

### "Belum tahu" bukan "tepat waktu"

Sebelum blok pertama dimulai, gesernya **0**. Itu bukan pernyataan bahwa
latihannya tepat waktu, melainkan bahwa **belum ada yang bisa diketahui**.
Menyamakan keduanya akan memberi rasa aman palsu pada menit-menit
terpenting. Ini pelajaran yang sama persis dengan status `takPasti` di G1:
*mungkin cukup* dan *cukup* bukan hal yang sama.

Karena itu pula layar pacu punya **dua jangkar**: kalau ada realisasi,
posisi dihitung dari kenyataan; kalau belum ada, ia jatuh ke jangkar rencana
— dan labelnya berubah menjadi **"Seharusnya sekarang"**, bukan "Sedang
berjalan". Perbedaan satu kata itu yang menjaga kejujurannya.

### Proyeksi selesai: yang paling rugi adalah blok terakhir

Ujung rencana digeser sebesar keterlambatan yang sudah menumpuk, lalu
ditampilkan sebagai **proyeksi jam selesai**. Inilah jawaban langsung untuk
keluhan awalnya. Kalau pemanasan molor 7 menit, proyeksinya bergeser 7
menit — dan blok terakhir yang menanggungnya. Keterlambatan tidak berdiri
sendiri; ia menumpuk.

### Cacat: layar pacu membeku karena menyimpan salinan

Mula-mula state-nya menyimpan **salinan sesi** (`Session | null`). Begitu
blok dimulai dan ditulis ke db, layarnya tidak pernah berubah — karena
salinan itu tidak tahu ada pembaruan. Perbaikannya: simpan **id-nya saja**,
lalu ambil sesinya dari kueri hidup. Berlaku umum untuk semua tampilan yang
menulis ke db lalu menampilkan hasilnya.

### G3 ternyata hampir gratis

Catatan kemarin menduga H1 & G3 beririsan, dan dugaan itu **terbukti**:
`realisasiLatihan` yang dipakai layar pacu ini persis data yang dibutuhkan
G3 (penanda mulai/selesai sesi untuk hari lomba). Yang tersisa untuk G3
tinggal memakai catatan yang sama pada sesi hari H, bukan membangun
mekanisme baru.

### Teruji

Logika murni di node (`latihan-logika` **72/72**) menguji keadaan batas
rentang setengah terbuka, penyusunan waktu absolut, peringatan kelebihan
slot, dua jangkar posisi, semantik geser (termasuk kasus yang tadi salah),
dan proyeksi. Uji browser `latihan-jadwal` **17/17** menguji penyuntingnya
lewat antarmuka sungguhan, dan `pacu-latihan` **32/32** membuktikan geser
benar-benar datang dari realisasi, bertahan lintas buka-tutup layar, dan
kembali ke jangkar rencana setelah direset. Ketiga target hijau; 44 suite
regresi bersih.


## Pusat Data — impor & ekspor lintas fitur (19 Sep 2026)

Berawal dari pertanyaanmu: *"ini kan bisa ekspor data tapi nda bisa impor,
maksudku untuk semua fitur"*.

### Audit dulu, jangan langsung bangun

Intuisinya benar, tetapi keadaannya tidak persis seperti yang disebutkan.
**Impor sudah ada di lima tempat**, dengan lima format berbeda: backup JSON
(Pengaturan), paket show (Berbagi), tukar repertoar (Musik), CSV koordinat
(Drill), CSV anggota (Anggota). Yang benar-benar buntu cuma tiga: **jadwal,
absensi, rekap absensi** — ketiganya bisa ekspor tanpa bisa impor balik.

Jadi masalah utamanya **bukan "tidak ada impor", melainkan keterpecahan**.
Pelatih harus hapal tombol mana yang melakukan apa. Itu temuan yang berbeda
dari keluhannya, dan kalau langsung dibangun tanpa mengaudit, yang dibuat
akan menjawab pertanyaan yang keliru.

### Temuan sambil mengaudit: backup menghilangkan set list

`buildBackupPayload` mengumpulkan members, sessions, attendance, drills,
sets, songs, memberNotes, kemajuan — tetapi **tidak** `setlists`, yang baru
ada sejak M3 (skema versi 4). `importBackup` pun tidak memulihkannya.

Akibatnya: *backup → bersihkan data → pulihkan* menghilangkan **seluruh set
list**, dan karena `Session.setListId` (G1) merujuk set list, run sheet hari
lomba ikut rusak. Ini cacat kehilangan data yang **tidak berbunyi apa pun**:
tombolnya bekerja, berkasnya terbentuk, tidak ada peringatan. Baru ketahuan
kalau backupnya benar-benar dipakai untuk memulihkan.

Diperbaiki lebih dulu dan dikomit tersendiri (`8cd8ac3`), bersama uji
regresinya (`backup-setlist` 14/14) yang menjalankan alur sungguhan:
ekspor → kosongkan tabel → impor balik → periksa isinya. Membaca ulang
kodenya tidak akan menangkap cacat ini, karena yang hilang adalah sesuatu
yang tidak tertulis di mana pun.

### Tiga keputusan pemakai

| Pertanyaan | Jawaban |
| --- | --- |
| Apa yang paling dibutuhkan? | **Keduanya** — pindah data pilih-pilih (JSON) **dan** round-trip CSV |
| Kalau id-nya sudah ada? | **Tanya dulu** — tampilkan "N baru / M ditimpa" sebelum menulis |
| Kalau rujukannya tidak ketemu? | **Longgar** — impor saja, kosongkan rujukannya, lalu laporkan |

Jawaban kedua menuntaskan pertanyaan yang menggantung sejak M4: di sana kamu
memilih "timpa" tetapi saya menambahkan satu modal konfirmasi juga. Ternyata
modal itu memang yang kamu inginkan.

### Uji yang menentukan: konfirmasi bukan hiasan

Godaan terbesar pada fitur seperti ini adalah menulis dulu, lalu
memberitahu. Uji `pusat-data` karena itu **membaca basis data tepat sebelum
tombol "Terapkan" ditekan** dan memastikan isinya belum berubah sama sekali.
Kalau konfirmasinya hanya hiasan, uji ini yang menangkapnya.

Ada pula cacat nyata yang ketemu uji ini: kepala CSV dibandingkan dengan
huruf besar-kecil yang tidak seragam, sehingga `setListId` (camelCase) tidak
pernah cocok dengan `setlistid` yang sudah dikecilkan — **setiap** berkas
CSV yang sah akan ditolak. Perbandingannya kini tidak mempedulikan huruf
besar-kecil.

### Rujukan yang putus harus berbunyi

Aturan longgar dipilih karena menolak berkas akan membuang data yang bagus
hanya karena satu rujukannya hilang. Tetapi aturan ini hanya aman kalau
setiap rujukan yang diputus **dilaporkan** — rujukan yang diam-diam
menghilang baru ketahuan berminggu-minggu kemudian, saat laporannya sudah
terlanjur dipakai. Karena itu `putusRujukan` mengembalikan daftar
`RujukanPutus`, dan antarmukanya menampilkannya.

Hal yang sama berlaku untuk `Kemajuan`: rekamannya dikunci oleh id drill,
jadi tidak bisa "dikosongkan" tanpa kehilangan artinya. Yang rujukannya
putus karena itu **dibuang seluruhnya** dan dilaporkan — pengecualian
satu-satunya dari aturan longgar.

### Yang belum selesai — dan koreksi atas catatan saya sendiri

Halaman Data baru mencakup CSV untuk **jadwal** dan **absensi**.

Tulisan saya sebelumnya di bagian ini berbunyi *"Rekap absensi dan anggota
masih memakai jalurnya masing-masing … menyatukannya tinggal menambah
jenis, karena mekanismenya sudah generik."* **Itu keliru**, dan untungnya
ketahuan sebelum dikerjakan.

**Rekap absensi bukan data, melainkan data turunan.** Berkasnya berisi
beberapa tabel bertumpuk (ringkasan per anggota, per jenis kegiatan, tren
per bulan, perlu perhatian, ringkasan per sesi), lengkap dengan persentase
dan tren yang **dihitung**, dan tanpa satu pun id. Mengimpornya balik bukan
sekadar sia-sia melainkan keliru: tidak ada cara yang masuk akal untuk
memecah ringkasan kembali menjadi rekaman absensi.

Pelajaran yang sama berlaku untuk **lagu** dan **drill**: `Song` punya
`tempoMap`, `DrillSet` punya `points` (titik tiap pemain). Menyimpannya ke
CSV berarti membuang sebagian isinya **tanpa kabar** — persis kerusakan
diam-diam yang hendak dihindari modul ini. Karena itu mereka tetap memakai
alur JSON, yang tidak mengurangi apa pun.

Yang bisa diimpor adalah **absensi**-nya sendiri, bukan rekapnya. Dan
supaya pemakai tidak mencari-cari, halaman Data kini mencantumkan apa yang
**sengaja tidak ada** di sana beserta alasannya.

### Cacat kedua: impor CSV menghapus kolom yang tidak ada di berkasnya

Yang pertama selesai dan lulus uji; yang kedua ini **tidak ketahuan sampai
saya memeriksa ulang pekerjaan sendiri keesokan harinya**, dan ia jenis cacat
yang paling berbahaya.

Berkas CSV hanya memuat sebagian kolom. Versi pertama `terapkanCsv` menulis
ulang seluruh rekamannya, sehingga kolom yang **tidak** ada di CSV ikut
terhapus:

```ts
checklist: [],          // materi latihan lenyap
createdAt: Date.now(),  // tanggal dibuat ditulis ulang
// rencanaLatihan, realisasiLatihan, notes: tidak disebut sama sekali
```

Alur yang memicunya sangat lazim: **ekspor jadwal → sunting satu judul di
Excel → impor balik**. Pemakai hanya melihat judulnya berubah, persis seperti
yang diinginkannya — sementara seluruh **materi latihan** dan **rencana
latihan** (hasil H1 sehari sebelumnya) pada sesi itu lenyap bersama catatan
evaluasinya. Tidak ada peringatan, tidak ada jejak.

Perbaikannya: **gabungkan, jangan ganti.** Kolom yang ada di CSV ditimpa;
kolom yang tidak disebut **dipertahankan** dari rekaman lama. Hal yang sama
menyelamatkan `checkInAt` pada absensi — waktu benar-benar hadir tidak ada di
CSV, jadi ia tidak boleh hilang hanya karena statusnya disunting.

Uji `csv-gabung` (13/13) ditulis **sebelum** perbaikan dan gagal pada tujuh
asersi, yang membuktikan cacatnya nyata dan bukan dugaan. Pola yang sama
dengan uji regresi `backup-setlist`: tulis uji yang menjalankan alur
sungguhan, jalankan, lihat ia gagal, barulah perbaiki.

### Teruji

Logika murni di node (`pindah-logika` **39/39**) menguji ringkasan berkas,
hitungan bentrokan, semua aturan rujukan (sah dari berkas, sah dari
perangkat, putus), pembuangan kemajuan, penolakan berkas rusak, dan satu hal
yang mudah luput: **`putusRujukan` tidak boleh mengubah berkas aslinya**.
Uji browser `pusat-data` **33/33** membuktikan konfirmasi tampil sebelum
apa pun ditulis, pilihan per entitas bekerja, rujukan putus dilaporkan,
serta round-trip CSV jadwal benar-benar mengubah dan menambah baris. Uji
regresi `backup-setlist` **14/14** menjaga agar set list tidak hilang lagi
dari backup, dan `csv-gabung` **13/13** menjaga agar impor CSV
**menggabungkan, bukan menggantikan**. Ketiga target hijau; 41 suite
regresi bersih.

## Evaluasi & kemajuan anggota (H2, 20 Sep 2026)

Keluhan yang memicunya: *"catatan evaluasi sekarang hanya teks bebas,
perkembangannya sulit dilihat."*

**Catatan bebas tetap ada** dan tidak saya gantikan. Ia berguna untuk
merekam **peristiwa** — "terlambat 20 menit", "meminjamkan alat". Yang tidak
bisa dijawab teks bebas adalah pertanyaan lain: **bagaimana kemajuan anggota
ini dari waktu ke waktu?** Menjawabnya butuh angka yang bisa dibandingkan,
dan teks bebas tidak pernah bisa dibandingkan. Jadi H2 **menambah**, bukan
mengganti: dua hal yang menjawab dua pertanyaan berbeda.

### Empat aspek — dan satu yang sengaja tidak dinilai

`teknik`, `musikalitas`, `kedisiplinan`, `kerjasama`, masing-masing 1–5.

**Kehadiran sengaja bukan aspek.** Ia sudah diukur oleh data absensi yang
lebih teliti daripada ingatan siapa pun; menilainya secara manual menciptakan
**dua angka untuk satu hal**, dan dua angka yang berbeda hanya membuat
keduanya diragukan.

### Tiga keputusan yang menentukan kejujuran angkanya

1. **Evaluasi parsial itu sah.** Menilai kerjasama tanpa menilai teknik
   adalah masukan yang valid. Memaksa keempatnya terisi tidak menghasilkan
   penilaian yang lengkap, melainkan penilaian **asal-asalan** — karena yang
   dipaksa akhirnya mengisi angka yang tidak dipikirkannya.
2. **`rataRata` mengembalikan `null`, bukan `0`,** ketika belum ada yang
   dinilai. Nol bukan "belum dinilai"; nol adalah **nilai terendah**. Anggota
   yang belum dinilai akan tampak sebagai yang terburuk, dan itulah
   ketidakadilan paling mudah terjadi tanpa disengaja. Di antarmuka ia
   menjadi `—`.
3. **Tren hanya dihitung pada aspek yang dinilai di KEDUA evaluasi;**
   selebihnya `null` ("belum bisa dibandingkan"). Ini yang paling penting.
   Membandingkan rata-rata dari **kumpulan aspek yang berbeda** menghasilkan
   angka yang tampak pasti padahal menipu: seorang anggota bisa tampak
   "naik" semata-mata karena aspek tersulitnya tidak dinilai kali ini.

Kasus penentunya ada di uji: `{teknik:5, musikalitas:2}` lalu
`{musikalitas:4}`. Rata-rata kasar 3,5 → 4,0 memberi "naik 0,5". Padahal
satu-satunya aspek yang benar-benar dinilai dua kali adalah musikalitas,
2 → 4, yaitu **naik 2,0**. Angka pertama lebih halus dan sepenuhnya salah.

### Yang dibangun

- `src/lib/evaluasi.ts` — modul murni (`nilaiSah`, `aspekDinilai`,
  `rataRata`, `urutEvaluasi`, `terbaru`, `sebelumnya`, `tren`, `aspekTren`,
  `ringkasan`, `rataTim`, `perluPerhatian`, `formatNilai`, `formatTren`,
  `warnaNilai`, `warnaTren`).
- `src/pages/Evaluasi.tsx` — tabel semua anggota (rata-rata terakhir, tren,
  jumlah evaluasi, lencana **perlu perhatian**), modal penilaian, dan modal
  riwayat per anggota yang menyebutkan aspek mana yang dibandingkan.
- Tabel `evaluasi` di `db.ts` **versi 6**, rute `/evaluasi`, entri menu.
- Ikon menu Absensi dipindah ke `IconQr` supaya tidak ada ikon kembar.

**`perluPerhatian` hanya menyertakan anggota yang PERNAH dinilai.** Anggota
yang belum dinilai tidak masuk daftar itu — mereka butuh dinilai, bukan
butuh perhatian karena nilainya rendah.

### Cacat yang saya temukan sendiri sebelum selesai

Tabel `evaluasi` awalnya **tidak ikut backup, tidak ikut Pusat Data**. Ini
cacat sejenis dengan set list yang pernah hilang dari backup: fitur baru
bekerja, lalu lenyap saat data dipindahkan. Saya tambahkan ke
`buildBackupPayload`, `importBackup`, `Settings.tsx`, jenis di `pindah.ts`
(dengan aturan rujukan `evaluasi → anggota`), dan `Data.tsx`.

Agar kelalaian semacam ini **gagal dengan sendirinya** lain kali, uji
`backup-lengkap` membaca daftar tabel **langsung dari IndexedDB** dan
menuntut setiap tabel (kecuali `settings` dan `packages`) muncul sebagai
kunci dalam berkas backup. Menambah tabel tanpa mendaftarkannya sekarang
akan menggagalkan uji, bukan menunggu seseorang kehilangan datanya.

### Teruji

`evaluasi-logika` **51/51** (node: rentang nilai, parsial, `null` vs `0`,
tren tanpa irisan → `null`, kasus +2,0 di atas, `rataTim` memakai evaluasi
terakhir tiap anggota). `evaluasi-anggota` **29/29** (browser: `—` bukan
`0,0`, satu evaluasi → `—`, dua → `naik 2,0`, lencana perhatian, hapus
evaluasi terbaru mengembalikan tren ke `—`). `backup-lengkap` **21/21**
(ke-10 tabel wajib ada, evaluasi pulih utuh). `pindah-logika` **44/44**
(setelah ditambah aturan rujukan `evaluasi → anggota`). Ketiga target hijau;
42 suite regresi bersih.

## Penanda mulai & selesai sesi (G3, 20 Sep 2026)

H1 sudah mencatat kapan tiap **blok** mulai dan selesai. G3 mencatat hal
yang berbeda: kapan **sesinya sendiri** mulai dan selesai.

### Mengapa blok pertama tidak cukup

Keduanya **tidak terjadi pada saat yang sama**. Sesi dimulai ketika pelatih
memanggil semua orang berkumpul; blok pertama baru dimulai ketika pemanasan
benar-benar berjalan. Memakai blok pertama sebagai penanda sesi akan
menyembunyikan keterlambatan yang justru paling umum: *semua sudah berkumpul,
tetapi belum ada yang mulai.*

Sebaliknya pun berlaku: sesi bisa selesai sementara blok terakhir tidak
pernah ditandai rampung. Karena itu **penanda sesi tidak pernah menyimpulkan
keadaan blok, dan tidak pernah mengubah catatan blok** — keduanya dicatat
terpisah, lalu dibandingkan.

### Empat aturan yang menjaga kejujuran angkanya

1. **Yang belum ditandai tidak dihitung sebagai tepat waktu.** Sesi tanpa
   penanda mengembalikan `null`, dan `rataTelat` **melewatinya** — bukan
   menganggapnya nol. Menghitung "belum ditandai" sebagai "telat 0 menit"
   akan membuat keterlambatan tampak **membaik setiap kali pelatih lupa
   menekan tombol**, persis kebalikan dari yang diinginkan.
2. **Penanda di luar hari sesinya tidak dipakai.** Bila penanda jatuh pada
   tanggal yang berbeda dari `s.date`, selisihnya tidak dihitung dan
   dilaporkan sebagai `hariLain`. Ini bukan tebakan, melainkan perbandingan
   tanggal yang pasti. Tanpa ini, satu ketukan salah pada jadwal hari Kamis
   menghasilkan "telat 2879 menit".
3. **Penanda yang mundur tidak menghasilkan durasi negatif.** Bila
   `selesaiNyata` lebih awal daripada `mulaiNyata` — jam perangkat berubah,
   atau penanda salah urutan — durasinya `null`, bukan angka negatif yang
   tidak ada artinya. Keterlambatan mulainya tetap terbaca, karena mulainya
   sendiri sah.
4. **Tepat waktu punya ambang** (`AMBANG_TEPAT` = 1 menit). Sesi yang mulai
   40 detik terlambat tidak perlu dilaporkan sebagai keterlambatan; presisi
   semu seperti itu hanya menambah derau.

### Dua keputusan antarmuka yang tidak kentara tetapi menentukan

**Penanda bisa diisi belakangan.** Ini celah yang saya temukan sendiri
setelah tombolnya selesai: bila pelatih **lupa** menekan "Mulai sesi", esok
harinya satu-satunya jalan keluar adalah menghapus penanda — padahal jam
mulainya diketahui. Penanda yang tidak bisa diperbaiki akhirnya tidak
ditandai sama sekali. Karena itu tersedia dua input jam; isinya disimpan pada
**tanggal sesinya**, bukan hari ini, supaya memperbaiki penanda kemarin tidak
mengubah maknanya menjadi hari ini.

**Rekap hanya menghitung sesi yang waktu selesai rencananya sudah lewat.**
Awalnya saya memakai daftar "sudah lewat" dari halaman, yang menganggap
**hari ini** sebagai mendatang — akibatnya rekap akan menyebut sesi besok
sebagai "belum ditandai". Itu **tuduhan yang salah**, dan lebih buruk
daripada tidak memberi angka.

### Yang dibangun

- `src/lib/sesi.ts` — modul murni (`epochRencana`, `statusSesi`,
  `ringkasanSesi`, `rataTelat`, `rataLampau`, `formatTelat`, `formatLampau`,
  `formatDurasi`, `warnaTelat`).
- `src/components/PenandaSesi.tsx` — `PenandaSesi` (kartu sesi + layar Pacu)
  dan `RekapPenanda` (rekap "Ketepatan waktu" di puncak halaman Jadwal).
- `Session.mulaiNyata` & `Session.selesaiNyata` (epoch ms). **Tidak perlu
  versi basis data baru** — menambah kolom opsional pada tabel yang sudah
  ada tidak mengubah skema.

Penanda ditulis dengan **get lalu put**, bukan `update`: menghapus penanda
berarti **membuang kuncinya**, dan `update` dengan nilai `undefined` tidak
bisa diandalkan untuk itu.

### Teruji

`sesi-logika` **67/67** (node: keempat aturan di atas, sesi lewat tengah
malam, blok menggantung, dan satu kasus yang menjadi alasan G3 ada — penanda
sesi 08:05 dengan blok pertama 08:15 harus memberi "telat 5 menit", **bukan**
15). `penanda-sesi` **36/36** (browser: tombol mulai/selesai, sunting jam,
rata-rata hanya dari yang ditandai — 6 menit, bukan 4 — sesi besok tidak
ikut rekap, penanda beda hari diperingatkan, tandai ulang, penanda tampil di
layar Pacu, dan **penanda ikut backup**). Ketiga target hijau; 43 suite
regresi bersih.

## Kunci layar presenter (G2b, 20 Sep 2026)

Keluhan yang memicunya: *di lapangan layar tak sengaja tersentuh dan urutan
set berubah.*

Presenter memang penuh kontrol navigasi — panah, pip kemajuan, ketuk kanvas
untuk maju — dan semuanya berada tepat di bawah jari, tali, atau senggolan
orang lewat. G2b menambahkan saklar **Kunci layar** yang menahan masukan
selama terkunci; animasi dan metronom tetap berjalan, karena kunci hanya
menahan **masukan**, bukan pertunjukan.

### Dua keputusan yang menentukan

**Kunci menahan papan ketik, bukan hanya sentuhan.** Kalau yang ditahan
hanya sentuhan, kuncinya tidak mengunci apa-apa: *remote presenter
mengirim tombol panah*, dan laptop yang tersenggol mengirim tombol apa
saja.

**Semua tombol ditelan, kecuali Escape** — bukan daftar tombol yang dicegat.
Menginventaris tombol satu per satu pasti ada yang luput, dan yang luput
justru yang berbahaya: presenter hanya mencegat panah/spasi/R, sehingga
tombol lain (**Delete**, **Ctrl+Z**, huruf pintasan editor) menembus ke
editor di belakangnya. Menelan semuanya menutup celah itu sekaligus.

**Escape sengaja dibiarkan lewat.** Menutup presenter tidak bisa mengubah
urutan set, dan menjebak pemakai di layar terkunci jauh lebih buruk
daripada kehilangan posisi. Ini juga alasan kunci **tidak pernah
disimpan**: bila ia bertahan setelah aplikasi dimuat ulang, pemakai yang
lupa PIN-nya terkunci selamanya.

### Cacat kebuntuan yang ditemukan oleh uji

Ini yang paling penting dari keseluruhan G2b, dan ia **tidak** saya
perkirakan sebelumnya.

Kunci menelan semua tombol dengan `preventDefault()`. Rupanya
`preventDefault()` pada `keydown` **mencegah karakter masuk ke kolom
input** — termasuk kolom PIN di layar kunci itu sendiri. Akibatnya:

> **Memasang PIN berarti mengunci layar selamanya.** PIN yang benar pun
> tidak pernah bisa diketik, karena ketikannya ditelan sebelum mencapai
> kolomnya.

Uji peramban menemukannya sebagai "PIN benar: kunci terbuka — gagal", dan
pemeriksaan menunjukkan nilai kolomnya tetap kosong walau sudah diketik.
Tanpa uji yang benar-benar mengetik PIN, cacat ini akan lolos: semua
hal lain di layar kunci tampak bekerja.

Perbaikannya: tombol yang ditujukan ke elemen **di dalam** lapisan kunci
diterima. Penanda `data-terima-kunci` pada lapisan, dan penjaga
`kunciMenahan(terkunci, kunci, diLayarKunci)`. Pengecualiannya **sempit** —
hanya ketikan yang benar-benar masuk ke kolom PIN yang lolos, bukan semua
`<input>`.

### Cacat rancangan kedua: kunci tidak bisa menang dengan penangan saingan

Rancangan pertama saya memasang penjaga `keydown` sendiri dari
`pakaiKunciLayar`. Ia tidak pernah bekerja, dan sebabnya mendasar:

**Dua penangan pada target yang sama berjalan berurutan sesuai urutan
pendaftaran** — bukan saling membatalkan. Presenter memasang penangannya
dengan tangkap (`capture`) di `window` dan memanggil `goNext()` di dalamnya.
Penjaga yang dipasang belakangan baru berjalan **sesudah** `goNext()`
telanjur dipanggil, sedangkan `preventDefault()` tidak pernah bisa
membatalkan apa yang sudah terjadi.

Karena itu kunci ditegakkan **di sumbernya**: pada penangan tombol
presenter yang sudah ada, melalui `kunciMenahan`. Bebas dari urutan
pendaftaran, dan deterministik. `pakaiKunciLayar` kini hanya memegang
keadaan — komentarnya menyatakan dengan jelas mengapa ia **tidak** memasang
penangan, supaya kelak tidak ada yang "memperbaiki"nya dengan menambahkan
penangan saingan yang sama-sama tidak berguna.

### Yang dibangun

- `src/lib/kunciLayar.ts` — modul murni (`bolehLewat`, `kunciMenahan`,
  `diDalamLayarKunci`, `keteranganKunci`, `masihTunggu`, `PINTASAN_URUTAN`).
- `src/components/KunciPresenter.tsx` — `pakaiKunciLayar`, `TombolKunci`,
  `LayarTerkunci`.
- Tombol **Kunci layar** di baris atas presenter; lapisan
  `z-[210]` menutupi seluruh presenter (lapisan tertinggi lain di dalamnya
  hanya `z-20`, jadi aman).
- PIN memakai mekanisme yang **sudah ada** dari F2 (`checkPin`, `getHint`);
  tanpa PIN terpasang, membuka kunci cukup satu ketukan. Batas 5 percobaan
  salah lalu tunggu 15 detik — untuk menahan ketukan beruntun, bukan
  menahan penyerang.

**Mode lomba sengaja tidak dikunci.** Ia layar baca-saji tanpa navigasi
set; satu-satunya yang interaktif di sana adalah daftar periksa yang justru
sedang dicentang pemakai.

### Teruji

`kunci-layar-logika` **54/54** (node: semua pintasan urutan tertahan, 12
tombol asing tertahan sehingga tidak tembus ke editor, Escape lewat, dan
pengecualian kolom PIN). `kunci-layar-presenter` **29/29** (browser: panah
tidak mengubah set saat terkunci, Delete/Backspace tidak mengubah isi
lapangan, ketuk kanvas tertahan, tombol berikutnya tertutup lapisan, Escape
tetap menutup, PIN salah ditolak lalu PIN benar membuka — **ujian yang
menemukan cacat kebuntuan**). Ketiga target hijau; 44 suite regresi bersih.

## Berbagi ke anggota: berkas grup vs berkas per anggota (20 Sep 2026)

Pertanyaan yang memicunya: *"nanti aku mau bagi ke anggota (anak didikku),
tentunya ada fitur yang berbeda dengan pelatih kan?"*

### Apa yang sebenarnya terjadi sebelum perbaikan

Saya tidak menjawab dari ingatan, melainkan membuat paket sungguhan lalu
membaca isi berkasnya. Hasilnya:

| | dalam berkas | milik penerima | milik orang lain |
| --- | --- | --- | --- |
| Absensi | 36 | **2** | **34** |
| Catatan evaluasi | 3 | **1** | **2** |

**Tampilannya memang disaring** — Andra hanya melihat absensinya sendiri.
Tetapi **berkasnya tidak**. Siapa pun yang membuka `.json`-nya dengan editor
teks melihat kehadiran dan catatan 17 rekannya. Satu berkas dibagikan ke
grup berarti 18 berkas pribadi terbagi ke 18 orang.

Selain itu berkasnya juga memuat **`phone`** (nomor telepon) dan **`notes`**
(catatan pribadi pelatih tentang anggota itu) — dua-duanya tidak pernah
dimaksudkan untuk dibagikan.

### Mengapa menyaring tampilan tidak pernah cukup

Inilah intinya, dan ia menolak semua jalan pintas: **selama 18 anggota
menerima satu berkas yang sama, data pribadi 18 orang harus ada di dalam
berkas itu.** Bukan kebetulan yang bisa diperbaiki — konsekuensi. Menyaring
tampilan memberi **rasa aman palsu**, justru karena ia terlihat bekerja.

### Keputusan: dua keluaran, bukan satu

Karena itu dua pekerjaan dipisahkan, dan pemakai memilih per situasi:

- **Berkas grup** — data bersama saja (jadwal, formasi, repertoar). Nol
  data pribadi. Aman dibagikan ke mana saja, termasuk grup terbuka.
- **Berkas per anggota** — satu ZIP berisi satu berkas per anak, sudah
  diberi nama (`DrillKit-Andra-Pratama-A07.json`). Tiap berkas hanya memuat
  absensi & catatan **anak itu sendiri**.

Biayanya jujur dan dinyatakan di layar: **kalau** anak perlu melihat absensi
dan catatannya, itu satu pesan per orang per ekspor. Kalau tidak, satu pesan.

Keputusan pemakai untuk H2: **nilai evaluasi terstruktur tidak pernah ikut**,
baik di grup maupun per anggota. Yang sampai ke anggota hanya **tulisan
pelatih**, bukan angkanya. Nilai 1–5 adalah penilaian tentang seseorang, dan
penilaian tentang seseorang tidak perlu berkeliaran di dalam berkas yang bisa
diteruskan siapa saja.

### Tiga perbaikan lain

- **Catatan evaluasi kini punya saklar.** Sebelumnya `memberNotes` **selalu**
  ikut berkas apa pun yang dipilih, tanpa saklar sama sekali — cacat yang
  kentara setelah disandingkan dengan jenis data lain yang semuanya punya
  saklar.
- **Menu disaring di mode anggota.** `useMemberMode` sudah ditulis sejak
  lama tetapi **tidak pernah dipakai**, jadi HP anggota menampilkan 11 menu
  pelatih yang sebagian besar kosong. Bukan kebocoran data (halaman itu
  membaca basis data perangkatnya sendiri, yang memang kosong), tetapi
  membingungkan. Sekarang tinggal **Tim saya**.
- **Kolom rahasia dibuang secara terpusat** lewat `bersihkanAnggota`:
  `token` (kunci QR — pemiliknya bisa absen atas nama orang lain), `phone`,
  dan `notes`.

### Penulis ZIP sendiri, tanpa pustaka

Aplikasi harus tetap **luring dan nol biaya**, dan berkas portabelnya sudah
860 KB. Menambah pustaka kompresi untuk membungkus 18 berkas teks kecil
tidak sebanding — lagipula isinya sudah padat. Format ZIP **tanpa pemadatan**
(metode 0) hanya butuh CRC32, sehingga `src/lib/zip.ts` cukup pendek.

Yang diuji bukan "berkasnya terunduh", melainkan **bisa dibuka**:
`bikinZip` menghasilkan `Uint8Array`, lalu dibuka dan diuji integritasnya
dengan `zipfile` Python — nama berkas, isi, dan UTF-8 diperiksa sama
persisnya. Mengaku berhasil tanpa membukanya kembali tidak ada gunanya.

### Teruji

`bagikan-logika` **52/52** (node: nilai uji baku CRC32, ZIP dibuka Python
termasuk UTF-8 dan ZIP kosong, serta asersi yang menentukan — `paketAnggota`
memuat **nol** data anggota lain, dan **id yang tidak dikenal mengembalikan
kosong, bukan semuanya**; mengembalikan semuanya adalah kegagalan paling
berbahaya karena ia tampak berhasil). `berbagi-anggota` **34/34** (browser:
berkas grup nol absensi & catatan, ZIP berisi 18 berkas dengan **nol** data
asing, seluruh absensi tersalur **tanpa ada yang hilang atau ganda**, saklar
catatan dihormati, menu mode anggota tersaring). Ketiga target hijau; 45
suite regresi bersih.

## Mode anggota tidak bisa masuk mode pelatih (21 Sep 2026)

Permintaan: *"aku mau mode anggota tidak bisa masuk mode pelatih."*

### Tiga jalan keluar, dan hanya yang pertama yang kentara

1. **Tombol "Kembali ke mode pelatih"** — jalan yang paling jelas, dan
   satu-satunya yang tadinya terlihat.
2. **Rute pelatih lewat URL langsung** — menu memang sudah disaring, tetapi
   mengetik `#/anggota` di bilah alamat tidak melewati menu sama sekali.
   **Menyaring menu tanpa menjaga rutenya seperti menggembok pintu depan
   sambil membiarkan jendela terbuka.** Termasuk `#/` (dashboard), yang
   mudah luput karena ia rute bawaan.
3. **Menyunting `localStorage`** — **tidak bisa dicegah**, dan harus
   dikatakan terus terang.

Karena itu modul ini adalah **pagar antarmuka, bukan pengaman**. Ia
menghentikan anggota yang **tidak sengaja** tersasar, bukan anggota yang
sengaja membongkar. Menyebutnya pengaman akan memberi rasa aman palsu —
cacat yang sama dengan berkas berbagi yang menyaring tampilannya.

### Mengapa tanpa PIN tidak dikunci

Aturan `bolehKePelatih` mengizinkan keluar **bila PIN belum terpasang**.
Sengaja, dan ini keputusan yang paling mudah salah: mengunci mode anggota
tanpa ada kuncinya berarti pelatih bisa **mengurung dirinya sendiri**, dan
satu-satunya jalan keluar tinggal membersihkan data peramban. **Mengunci
pemilik yang sah lebih buruk daripada membiarkan anggota melihat menu yang
kosong.**

Karenanya menyalakan mode anggota **menganjurkan** PIN lebih dulu, bukan
memaksa — memaksa akan menghalangi pelatih yang sekadar ingin mencoba. Dan
bilamana PIN belum ada, antarmukanya **mengatakannya terus terang**:
"mode ini belum dikunci", bukan berpura-pura aman.

### Yang dibangun

- `src/lib/modePerangkat.ts` — modul murni (`bolehBuka`, `bolehKePelatih`,
  `wajibPasangPin`, `teksKunci`, `teksTanpaPin`, `bacaMode`, `simpanMode`).
- `src/components/ModePerangkat.tsx` — `TombolMasukModeAnggota` (sisi
  pelatih, menganjurkan PIN) dan `TombolKeluarModeAnggota` (sisi anggota,
  ber-PIN).
- Penjaga rute di `src/components/Layout.tsx`: semua rute selain
  `/berbagi` dialihkan selama mode anggota.
- Simpanan mode dipindah dari `Share.tsx` ke modulnya, karena komponen
  penjaga butuh `useMemberMode` sementara komponen itu sendiri dipakai
  halaman Share — **impor melingkar**. Menyatukan keadaan dan aturannya di
  satu modul lebih rapi daripada sekadar memutus lingkarannya.

Tombol keluarnya sengaja **tidak disembunyikan**: yang ditahan adalah
**pemakaiannya**, bukan penemuannya. Menyembunyikan tombol hanya akan
menyulitkan pemilik yang sah pada saat ia paling membutuhkannya.

### Teruji

`mode-logika` **32/32** (node: sepuluh rute pelatih tertahan termasuk
dashboard, dan dua asersi yang berlawanan arah — PIN terpasang + PIN salah
= tertahan; PIN belum terpasang = tetap boleh keluar). `mode-terkunci`
**34/34** (browser: mengetik `#/pengaturan` dialihkan ke `#/berbagi`, PIN
salah ditahan lalu PIN benar mengeluarkan, tanpa PIN keluar diizinkan, dan
masuk tanpa PIN menawarkan pemasangan PIN). Ketiga target hijau; 46 suite
regresi bersih.

## Layar sambutan: memilih mode pada pembukaan pertama (21 Sep 2026)

Bukan item dari daftar di atas. Ketemu waktu menelusuri apa yang **dilihat
anggota pada kali pertama ia membuka berkasnya** — tonggak yang belum pernah
diuji, padahal 18 anggota akan melewatinya.

### Cacatnya

Di perangkat benar-benar baru (tanpa `localStorage`, basis data kosong)
aplikasi langsung masuk **mode pelatih**. Tertulis apa adanya waktu
diperiksa: tombol yang tampil adalah `Kunci data`, `Lihat mode anggota`,
`Unduh berkas grup`, `Unduh per anggota (ZIP)`, `Pratinjau isi`, dan
seterusnya; menu sebelah kiri berisi **11 menu pelatih**.

Jadi anggota yang baru saja disuruh "buka berkas ini di HP-mu" mendapati
layar **ekspor** pelatih, dan harus menemukan tombol `Lihat mode anggota` —
nama yang justru terdengar seperti milik pelatih, bukan seperti tempat
yang dituju.

### Tiga aturan

1. **Ditanya, jangan dikira-kira.** Menebak "pelatih" untuk semua orang
   berarti **setiap** anggota harus menemukan jalan keluarnya sendiri —
   persis cacat yang mau diperbaiki. Menebak "anggota" berarti pelatih
   dikurung di perangkatnya sendiri tanpa PIN. Kedua tebakan salah, maka
   ditanya.
2. **Sekali saja, lalu diingat.** Menanyai berulang-ulang adalah gangguan,
   bukan bantuan. Disimpan di `localStorage` per perangkat.
3. **Tidak mengurung.** Pilihan ini bisa dibalik: dari mode anggota lewat
   tombol **Mode pelatih** (ber-PIN bila PIN terpasang). Layar sambutan
   mengatakannya di bagian bawah, supaya orang tahu pilihan ini tidak
   permanen.

Yang **sengaja tidak** dilakukan: memuat data contoh, meminta nama, atau
menanyakan apa pun selain satu pertanyaan ini.

### Yang dibangun

- `src/components/PilihMode.tsx` — lapisan penuh dengan dua kartu: **Saya
  pelatih** (menyusun jadwal, mencatat evaluasi, membagikan paket) dan
  **Saya anggota** (melihat jadwal & materi, posisi formasi sendiri,
  catatan pelatih). Kartu menjelaskan **apa yang bisa dilakukan**, bukan
  sekadar label — supaya anggota bisa memilih tanpa bertanya.
- `pernahMemilih()` di `src/lib/modePerangkat.ts` — berbeda dari
  `bacaMode()`. `bacaMode()` mengembalikan `'coach'` baik karena belum
  pernah memilih maupun karena memilih pelatih; **dua keadaan yang tidak
  boleh disamakan**. `pernahMemilih()` memeriksa ada-tidaknya kuncinya.
  Bila `localStorage` tidak tersedia ia mengembalikan `true`: kalau pilihan
  tidak bisa diingat, menanyai berulang-ulang jauh lebih menyusahkan
  daripada menebak pelatih.

### Dua jebakan yang tidak kentara

**Menyembunyikan lapisan saja tidak cukup — halaman harus dimuat ulang.**
Percobaan pertama memakai `setSudahPilih(true)`: semua asersi DOM lolos,
tetapi aplikasi menampilkan **menu pelatih lengkap** dan tidak ada tombol
keluar bagi anggota. Sebabnya mode dibaca **sekali** saat komponen dipasang
(`useMemberMode`, `pernahMemilih`), jadi tanpa memuat ulang menu dan
penjaga rute tetap memakai mode lama — aplikasi dalam keadaan setengah
berubah. `onPilih` karenanya memanggil `window.location.reload()`.

**Membersihkan IndexedDB dari bawah aplikasi yang sedang berjalan membuat
peramban kehilangan halamannya.** Pengujian yang menyimulasikan "perangkat
baru" dengan mengosongkan `localStorage` dan menghapus basis data memicu
galat acak: `SecurityError: Failed to read the 'localStorage' property`,
bingkai yang lepas, dan halaman kosong (`<nav>` 0, badan kosong) padahal
modenya tersimpan benar. Simulasi yang dipakai sekarang adalah **konteks
peramban baru** — benar-benar nol, tanpa bekas sesi, dan tidak merusak
keadaan renderer.

### Catatan perkakas: `regresi.sh` mengabaikan alamat yang dikirim

Rangkaian uji membaca `process.env.BASE`, tetapi `regresi.sh` mengirim
alamat sebagai **argumen**. Argumennya diabaikan begitu saja, jadi seluruh
rangkaian diam-diam berlari ke bawaan `:5173` — **server dev Vite**, yang di
kotak pasir bermemori 2 GB menyajikan ratusan modul per muat dan kehabisan
sumber daya (`ERR_INSUFFICIENT_RESOURCES`, halaman gagal dimuat, gagal acak
yang berbeda-beda tiap kali dijalankan). Diperbaiki dengan mengirim lewat
lingkungan, dan tiap rangkaian diberi jeda. Melawan **versi jadi** (satu
berkas JS), 15 rangkaian lulus tanpa satu pun gagal.

### Teruji

- `sambutan-mode` **25/25** (browser): sambutan tampil di perangkat baru;
  **layar ekspor pelatih tidak ikut tampil di belakangnya**; tombol Lanjut
  nonaktif sebelum memilih; memilih anggota langsung mengarah ke
  `#/berbagi` dengan menu tinggal dua; **tidak ditanya lagi setelah
  dimuat ulang**; memilih pelatih memberi menu lengkap dan layar ekspor;
  tombol keluar tetap tersedia bagi anggota.
- `mode-logika` **34/34** (bertambah 2: `pernahMemilih()` mengembalikan
  `true` tanpa `localStorage`, dan `bacaMode()` sendirian **tidak bisa**
  membedakan "belum memilih" dari "memilih pelatih").
- `mode-terkunci` **34/34** (tetap lulus setelah layar ini dipasang).
- 15 rangkaian regresi bersih lawan versi jadi (403 pemeriksaan).

## Berkas per anggota mengenali pemiliknya (21 Sep 2026)

Bukan item dari daftar. Ketemu waktu menelusuri **perjalanan utuh seorang
anggota** — tonggak yang belum pernah diuji, padahal 18 anggota akan
melewatinya.

### Cacatnya

Berkas per anggota **sudah difilter hanya untuk satu orang**: berkas
`DrillKit-Andra-Pratama-BR01.json` hanya memuat 2 catatan absensi Andra,
berkas Bunga hanya memuat absensi Bunga. Tetapi berkas itu **tidak mencatat
untuk siapa ia dibuat**.

Akibatnya, begitu Andra membuka berkasnya sendiri, aplikasi menyuruhnya
**"Pilih namamu dulu"** dari daftar 18 nama. Padahal **pertanyaannya sudah
bisa dijawab sendiri oleh aplikasi** — ia yang membuat berkas itu.

Delapan belas anggota akan melakukan ini di HP, dengan nama-nama yang
mirip, dan bisa memilih yang salah.

### Perbaikannya

`ShareBundle.forMember` — penanda opsional "berkas ini untuk anggota ini",
diisi `paketAnggota()` dan dibuang `paketGrup()`. Saat paket dibuka dan
penandanya cocok dengan seorang anggota di dalamnya, namanya langsung
dipakai.

Tiga pagar, karena mengenali otomatis punya caranya sendiri untuk salah:

1. **Tidak diam-diam.** Namanya disebut di pesan ("hai, Andra Pratama!")
   dan ditampilkan di kartu, lengkap dengan tombol **Ganti nama**. Kalau
   pelatih salah kirim berkas, salah orangnya harus **kelihatan** — bukan
   tersembunyi di balik pilihan yang tampak berhasil.
2. **Tidak berlaku untuk berkas grup.** Berkas itu dibagikan ke semua
   orang, jadi penandanya dibuang — dan dibuang **secara tersurat**, bukan
   sekadar tidak diisi. `paketGrup()` menyebar `...b`; kalau `b`-nya
   berasal dari paket per anggota, penandanya akan ikut terbawa dan
   **semua** orang diidentifikasi sebagai orang yang sama.
3. **Tidak mengidentifikasi orang yang salah.** Bila `memberId` tidak
   dikenal, `forMember` tetap `undefined` — menyebut seseorang sebagai
   penerima padahal datanya tidak disertakan lebih buruk daripada tidak
   menyebut siapa pun. Berkas yang dibuat versi lama tidak punya penanda
   ini, dan tetap ditanya seperti dulu.

### Perkakas: uji logika tidak bisa diulang

Uji `*-logika` mengimpor modul dari `/tmp/<modul>.mjs`, yang dirakit dengan
esbuild secara ad-hoc — dan `/tmp` kosong setiap kali kotak pasir dimulai
ulang. Jadi uji itu gagal **pada baris impornya**, bukan pada asersinya,
dan kegagalannya mudah salah dibaca sebagai cacat aplikasi. Sekarang ada
`qa/bangun-logika.sh`, dan `qa/regresi-penuh.sh` merakit lebih dulu lalu
menjalankan 19 rangkaian dengan daftar yang tercatat di satu tempat.

### Teruji

- `buka-paket` **28/28** (browser, dua perangkat): anggota membuka
  berkasnya sendiri → namanya dikenali dan **disebut**; berkas **grup**
  tetap menanyakan nama; berkas versi lama dan penerima yang tidak dikenal
  → ditanya lagi, dan **tidak** menuliskan id asing ke perangkat.
- `bagikan-logika` **58/58** (bertambah 6, termasuk "grup dari paket
  anggota: penanda penerimanya DIBUANG" — kebocoran `...b` di atas).
- 19 rangkaian regresi bersih lawan versi jadi (548 pemeriksaan).

## Angka "Kehadiran" di layar anggota tidak lagi menyanjung (21 Sep 2026)

Bukan item dari daftar. Ketemu waktu memeriksa **isi tab Absensi milik
anggota** — bagian yang selama ini hanya diuji berkasnya, bukan tampilannya.

### Cacatnya

Persentase kehadiran di layar anggota dihitung dari `pct(hadir,
mine.length)`, dan `mine` adalah catatan yang **ada di paket**. Jadi sesi
yang tidak dicatat pelatih hilang dari pembilang sekaligus dari penyebut.

Terbukti dengan dua keadaan yang dijalankan berdampingan:

| yang dicatat pelatih | yang tampil di layar anggota |
| --- | --- |
| 2 dari 5 sesi, dua-duanya hadir | **KEHADIRAN 100%** |
| 5 dari 5 sesi, semuanya hadir | **KEHADIRAN 100%** |

Persentase adalah hal yang paling tampak berwibawa di tab itu, dan
pembacaannya tidak bisa dicek oleh orang yang melihatnya.

### Perbaikannya

1. **Penyebutnya ditulis** di bawah angkanya — `2 dari 2 sesi yang dicatat`
   lawan `5 dari 5 sesi yang dicatat`. Ini bukan kebiasaan baru: layar rekap
   pelatih sendiri (`AttendanceRecap`) sudah memakai pola yang sama dengan
   `sub="3 dari 5 catatan"`. Yang hilang justru di layar anggota.
2. **Kekosongannya ditampilkan**: sesi yang sudah lewat tanpa catatan
   muncul tersendiri berbadge **"Belum dicatat"**, disertai keterangan bahwa
   itu bukan berarti tidak hadir.
3. **Tidak ada angka untuk data yang kosong.** Bila pelatih belum mencatat
   apa pun, ubinnya menampilkan `—`, bukan `0%`. Nol persen pada data yang
   kosong berbunyi sebagai tuduhan mangkir.

Yang **sengaja tidak** dilakukan: memasukkan sesi yang belum tercatat ke
penyebut persentase. Itu akan membalik cacatnya ke arah seberang — pelatih
yang belum sempat mengisi absensi membuat seluruh anggotanya tampak mangkir.
**"Belum dicatat" dan "tidak hadir" adalah dua hal yang berbeda**, dan
digabung hanya karena keduanya sama-sama bukan "hadir".

### Teruji

`tab-absensi` **15/15** (browser, tiga keadaan yang sengaja dibuat
berlawanan): satu sesi tercatat → penyebutnya tertulis dan kekosongannya
diberitahukan; semua sesi tercatat → penyebutnya penuh dan tidak ada
peringatan; **nol** catatan → `—`, bukan `0%`. Di semua keadaan diuji bahwa
sesi tanpa catatan **tidak** dilabeli "Tanpa keterangan" — pelabelan itu
akan mengubah ketiadaan data menjadi kesalahan anggota.

20 rangkaian regresi bersih lawan versi jadi (563 pemeriksaan).

## Pemeriksaan tab Formasi anggota: sehat, dan kenapa ia tetap diuji (21 Sep 2026)

Tab ini diperiksa karena ia langkah terakhir anggota yang belum pernah
diuji. Hasilnya: **tidak ada cacat**. Dicatat di sini justru karena dua
kali berturut-turut saya hampir melaporkan cacat yang sebenarnya tidak
ada — dan tanpa uji yang menguncinya, pemeriksaan berikutnya akan
mengulang dua kekeliruan yang sama.

**Kekeliruan pertama.** Angka "Langkah dari garis 50 = -16" tampak
meleset jauh dari hitungan (-28,5). Ternyata saya membandingkannya dengan
titik milik **set yang lain** — `sets.find(...)` mengembalikan set
mana saja, bukan set yang sedang ditampilkan. Setelah semua set dicetak
berurutannya, angkanya tepat: -10 yard ÷ 0,625 = **-16 langkah**, dan
(-10 + 26,665) ÷ 0,625 = **26,75 langkah** dari garis depan.

**Kekeliruan kedua.** Animasi "Putar perpindahan" tampak mandek: setelah
tujuh detik set belum maju dan tombolnya masih "Jeda". Ternyata
animasinya **delapan** detik (16 count pada 120 BPM), dan saya membacanya
pada detik ketujuh. Setelah ditunggu sampai rampung: 18 titik bergerak,
set maju, dan atribut `transform`-nya dibersihkan.

### Yang diukur, bukan dikira

| lebar layar | tinggi kode anggota | titik biasa | lingkaran emasnya |
| --- | --- | --- | --- |
| 390 px (HP) | 4 px (7 px punya sendiri) | 6,5 px | 19,3 px |
| 768 px | 8 px | 13,5 px | 39,8 px |
| 1300 px | 10 px | 19,1 px | 56,3 px |

### Satu keterbatasan yang sengaja dibiarkan

Di HP, kode anggota tergambar setinggi **4 px** — tidak terbaca, termasuk
kode miliknya sendiri (7 px). Saya **tidak** memperbesarnya: 18 label pada
peta selebar 340 px sudah saling bertumpukan 5–6 pasang **di semua lebar
layar**, jadi memperbesarnya akan memperburuk tabrakan itu. Tugas
"titik yang mana punyaku" sudah dijalankan lingkaran emasnya, yang
diameternya **tiga kali** titik biasa (19,3 px lawan 6,5 px), dan
kepastiannya ada di panel "Posisiku" yang menulis koordinat dan jumlah
langkah dengan angka yang bisa dibaca.

Kalau kelak kode itu ingin terbaca di HP, yang masuk akal bukan
memperbesar semuanya, melainkan **menyembunyikan kode anggota lain dan
menampilkan satu label terbaca untuk titiknya sendiri** — rekan satu tim
tidak ia butuhkan di layar sekecil itu.

### Teruji

`formasi-anggota` **17/17** (HP 390 px): lingkaran emasnya ada dan lebih
besar berarti dari titik lain; koordinatnya **dihitung sendiri dari
berkasnya** lalu dicocokkan dengan yang tampil (bukan sekadar "ada
angka"); tombol Putar menggerakkan titik, memajukan set, rampung dalam
wajar, dan membersihkan `transform`. 21 rangkaian regresi bersih lawan
versi jadi (580 pemeriksaan).

## Halaman pengantar sebelum masuk aplikasi (21 Sep 2026)

Diminta sendiri oleh pelatih setelah ia **menerbitkan DrillKit ke Netlify**:
*"semua yang dapat linknya bakal langsung masuk ke mode pelatih. Gimana kalo
kita set supaya tidak langsung masuk ke dalam situsnya? Jadi ada landing
page-nya dulu gitu."*

### Dua masalah yang terjalin

Keluhan itu sebenarnya berisi dua hal yang berbeda:

1. **Pengunjung baru tidak diberi pengantar.** Tautannya dipublikasikan,
   jadi siapa pun yang menerimanya membuka DrillKit tanpa tahu apa itu,
   tanpa tahu datanya tersimpan di mana, dan tanpa diberitahu bahwa ia
   diminta memilih.
2. **Perangkat baru langsung masuk mode pelatih** — cacat yang sudah
   diperbaiki commit `dfe21a1` lewat layar "Siapa yang akan memakai
   perangkat ini?".

Keduanya diselesaikan **satu halaman**: halaman pengantar yang menjelaskan
DrillKit sekaligus menanyakan siapa pemakainya. Mengapa tidak dibuat
terpisah — pengantar menjelaskan, lalu aplikasi bertanya — karena itu
menambah satu langkah bagi 18 anggota tanpa menambah informasi apa pun.

### Mengapa ia bagian dari aplikasi, bukan berkas statis terpisah

Pilihan yang lebih lazim adalah menaruh halaman pengantar di root (`/`)
dan memindahkan aplikasi ke `/app/`. **Ditinggalkan**, karena satu syarat
proyek ini tidak bisa ditawar: **aplikasi harus tetap jalan offline**.

Service worker DrillKit terdaftar pada cakupan aplikasi. Halaman pengantar
yang terpisah di luar cakupannya **tidak akan pernah tersimpan**, sehingga
ia gagal dimuat tepat pada keadaan yang paling sering terjadi di lapangan:
HP anggota yang sedang tanpa kuata. Pintu masuk yang mati saat offline
lebih buruk daripada tidak ada pintu masuk.

Harga yang dibayar: berkas 870 KB tetap diunduh sebelum halaman pengantar
tampil. Tetapi berkas itu memang harus diunduh juga untuk memakai
DrillKit — jadi biayanya **nol tambahan**, hanya bergeser urutannya.

### Isinya

- Nama dan satu kalimat penjelas: catatan latihan marching band, tersimpan
  di perangkat ini, jalan tanpa sinyal.
- Empat kotak "Yang ada di dalamnya": jadwal & materi, formasi & drill,
  anggota & absensi, musik & metronom.
- Dua catatan yang menjawab pertanyaan yang paling sering muncul: **tanpa
  akun & tanpa server** (datanya tidak dikirim ke mana pun) dan **dipakai
  bersama** (pelatih membagikan paket, anggota membukanya di HP sendiri).
- Pertanyaannya sendiri: **Saya pelatih** / **Saya anggota**, dengan kartu
  yang menjelaskan apa yang bisa dilakukan masing-masing.
- Tombol **Masuk** (bukan "Lanjut" — ia mengajak masuk, bukan melanjutkan).

Tiga aturan lamanya tidak berubah: **ditanya sekali lalu diingat**, tidak
pernah dikira-kira, dan tidak mengurung.

### Yang dicatat di DEPLOY.md

Ukuran berkas portabel di `DEPLOY.md` sudah kedaluwarsa (tertulis 461 KB,
kenyataannya ~870 KB) — diperbaiki. Ditambahkan dua bagian yang langsung
menjawab keadaan pelatih ini: **apa yang dilihat orang yang membuka
tautannya**, dan **memperbarui situs yang sudah terbit** — termasuk bahwa
service worker bisa membuat pengunjung lama masih melihat versi sebelumnya,
dan bahwa pilihan mode tidak ikut berubah sehingga halaman pengantar tidak
muncul lagi di perangkat yang sudah memilih.

### Teruji

`sambutan-mode` **32/32** (bertambah 7): halaman itu menyebut nama
DrillKit, menjelaskan apa itu, menyatakan datanya tersimpan di perangkat
dan jalan tanpa sinyal, menyebut "tanpa akun, tanpa server",
memperkenalkan isinya, dan tombolnya berbunyi **Masuk**. 21 rangkaian
regresi bersih lawan versi jadi (587 pemeriksaan).

## Mengapa tidak ada sistem login (21 Sep 2026)

Pelatih bertanya setelah melihat halaman pengantar: *"kalau sistem login aja
gitu gimana? Ini kan berarti pemain bisa berbohong dan masuk menggunakan
fitur pelatih?"*

Pertanyaannya tepat, dan jawabannya perlu bukti — bukan argumen.

### Yang sebenarnya didapat pemain yang berbohong

Diukur dengan dua perangkat berbeda:

| | Perangkat pelatih | Perangkat pemain yang memilih "Saya pelatih" |
| --- | --- | --- |
| Anggota | **18** | **0** |
| Sesi | **5** | **0** |
| Drill | **1** | **0** |
| Absensi | **36** | **0** |

Percobaan kedua lebih tajam: perangkatnya disuruh **membuka paket tim dulu**
(seperti anggota sungguhan), lalu dipindah ke mode pelatih. Hasilnya tetap
**0 anggota, 0 sesi, 0 absensi**. Paket yang dibuka tidak berubah menjadi
data pelatih — ia tersimpan terpisah sebagai `packages/current`.

Jadi: **ya, ia mendapat seluruh menu pelatih. Tetapi yang ia dapat adalah
aplikasi kosong di HP-nya sendiri.** Ke-36 catatan absensi pelatih tidak
bisa dijangkau dari perangkat lain, karena data itu tidak pernah berada di
server.

### Mengapa login tidak memperbaiki ini

Sistem login melindungi **database bersama**. DrillKit tidak punya database
bersama — setiap perangkat menyimpan datanya sendiri. Tidak ada yang perlu
dijaga dengan login.

Menambahkannya justru mengorbankan dua syarat yang dipegang sejak awal:
**offline** (harus terhubung untuk masuk) dan **nol biaya** (perlu server).
Dan setelah dikorbankan, ia tetap tidak melindungi sesuatu yang belum
terancam.

### Yang justru berisi data: perangkat pelatihnya sendiri

Karena itu yang ditambahkan bukan pintu masuknya, melainkan pengaman untuk
perangkat yang **ditinggal terbuka** — tablet di bangku cadangan, misalnya.
Mode kios sudah ada, tetapi harus dinyalakan sendiri setiap kali.

**Kunci otomatis** (`drillkit.kiosk.autolock`), tiga syarat yang sengaja:

1. **Bawaan MATI, dan hanya ditawarkan bila PIN terpasang.** Tanpa PIN,
   kunci otomatis tidak melindungi apa pun — siapa pun bisa membukanya lagi
   dengan satu tombol. Karena itu pilihannya tidak ditampilkan, dan
   alasannya dikatakan terus terang di Pengaturan.
2. **Bawaan MATI, bukan lima menit.** Kunci yang aktif tanpa diminta akan
   mengunci layar di tengah latihan — jauh lebih menyusahkan daripada
   perangkat yang dibiarkan terbuka. Pelatih memilih waktunya sendiri.
3. **Tidak pernah menyala saat presenter berjalan.** Layar itu dipakai di
   tengah lapangan; menguncinya di sana menghentikan latihan. Diperiksa dua
   kali: saat pengatur waktu dipasang dan saat ia hendak berbunyi.

Sentuhan apa pun (ketuk, tombol, gulir) menyetel ulang waktunya — jadi
perangkat yang sedang dipakai tidak pernah terkunci.

### Teruji

`kunci-otomatis` **13/13**, dengan dua keadaan yang benar-benar menunggu 70
detik: didiamkan → **mengunci**; disentuh tiap 15 detik → **tidak
mengunci**. Ditambah: tanpa PIN → tidak mengunci (percuma); bawaan MATI →
tidak mengunci; pengaturannya tidak ditawarkan tanpa PIN dan menyimpan
pilihannya dengan benar. 22 rangkaian regresi bersih lawan versi jadi
(600 pemeriksaan).

## Musik & metronom untuk anggota (21 Sep 2026)

**Yang diminta:** *"tambahkan semua"* — tab Musik & Metronom dibuka untuk
mode anggota, bukan metronomnya saja.

**Keadaan sebelumnya.** Metronom ikut terkirim di dalam materi, tetapi
anggota tidak punya jalan memanggilnya: mode anggota hanya punya empat tab
(jadwal/formasi/absensi/catatan). Satu-satunya alat latihan mandiri yang
sesungguhnya — ketukan — tidak bisa dipakai oleh orang yang paling
membutuhkannya.

**Yang dibangun.** Halaman `Music.tsx` kini menerima `hanyaPutar`. Mode ini
mempertahankan semua yang bersifat *memakai* dan menyembunyikan semua yang
bersifat *menulis*:

| Tetap ada | Disembunyikan |
|---|---|
| metronom (mulai/hentikan, tap tempo, tanda birama) | tambah/ubah/hapus lagu |
| memilih & memutar lagu | editor pola ritme & latih tempo |
| memilih & memutar set list berurutan | membuat/mengurutkan/menghapus set list |
| penala & nada dengung | tukar repertoar (impor/ekspor) |

**Mengapa dibatasi begitu.** Bukan soal keamanan — mode terkunci sudah
mengurus itu. Ini soal **kepemilikan**: repertoar milik pelatih. Kalau 18
anggota bisa mengurutkan set list, perubahannya lenyap begitu saja saat
mereka menekan **Perbarui**, dan mereka tidak akan mengerti mengapa. Batas
yang dipakai karena itu: *yang menulis ke basis data disembunyikan, yang
tidak menulis tetap terbuka.* Penala tetap ada justru karena ia tidak
menulis apa pun — dan menala alat paling sering dilakukan anggota sendiri.

**Dua keputusan yang sengaja diambil.**

1. **Tab Musik bisa dipakai walau belum memilih nama.** Berlatih ketukan
   tidak perlu identitas. Memaksa anggota memilih namanya dulu hanya untuk
   memakai metronom adalah rintangan yang tidak memberi apa pun. Tab-tab
   lain tetap menuntut nama, seperti sebelumnya.
2. **Set list ikut di dalam berkas paket** (`ShareBundle.setlists`, opsional
   karena berkas lama tidak memuatnya). Tanpa ini anggota menerima lagunya
   tetapi tidak pernah menerima susunan penampilannya, dan kartu set list
   di HP mereka akan selamanya kosong.

**Satu cacat sungguhan yang ketemu saat diuji, bukan saat dibaca.**
`perbarui()` menyimpan paketnya ke `db.packages` tetapi tidak pernah
memindahkan lagu dan set list ke tabel `songs` / `setlists`. Akibatnya
anggota melihat **repertoar kosong padahal materinya berisi lagu** — karena
halaman Musik membaca tabelnya, bukan berkasnya. Ini jenis kegagalan yang
paling berbahaya: ia tampak berhasil. Diperbaiki dengan `bulkPut` (bukan
kosongkan-lalu-isi, supaya apa pun yang sudah ada di perangkat tetap ada),
lalu diuji: lagu sampai, urutan set list tidak berubah sedikit pun setelah
dipakai anggota.

**Diuji:** `qa/musik-anggota.mjs`, 38 butir. Yang menentukan: metronom
benar-benar berdetak (birama bertambah sendiri, bukan sekadar mengganti
tulisan tombol); lagu & set list bisa diputar; ketujuh alat sunting
terbukti *tidak ada*; repertoar pelatih tidak berubah setelah dipakai;
pelatih tetap punya semua alat suntingnya. 24 rangkaian regresi bersih.

## Audit lebar HP: cacat yang tak terlihat selama berbulan-bulan (21 Sep 2026)

**Yang memicu:** *"selesaikan"* ketiga kalinya. Setelah dua putaran
merampungkan hal yang tertulis, kali ini saya mengaudit — bukan menebak.
Dan audit itu menemukan sesuatu yang tidak ada dalam daftar apa pun.

**Cacatnya: halaman Musik melebarkan halaman 30px pada layar 360px** —
dan ini terjadi **baik untuk pelatih maupun anggota**. Bukan cacat yang
lahir dari fitur baru; ia sudah ada berbulan-bulan.

**Mengapa ia tidak pernah terlihat.** Seluruh 24 rangkaian uji berjalan di
lebar 1300px. Padahal yang memakai mode anggota adalah 18 orang dengan HP,
dan pelatih memakainya sambil berdiri di lapangan. **Uji yang tidak pernah
melihat layar sempit tidak akan pernah menemukan cacat di layar sempit** —
ini bukan kelalaian menulis asersi, melainkan kelalaian memilih kacamata.

**Sumbernya.** Item grid dengan `min-width: auto` tidak bisa menyusut di
bawah `min-content` anaknya. `<select>` menyumbang `min-content` sepanjang
pilihan terpanjangnya ("4/4 · 2+2", "Not setengah", …). Jadi kartu
metronom memaksa grid melebar, dan grid memaksa halaman melebar.
Perbaikannya `min-w-0` pada item gridnya — satu kata, setelah berjam-jam
mencari. Itulah sebabnya mencari sumbernya sepadan: cacatnya sepele,
penemunya tidak.

**Dua cacat, dua asal-usul yang berbeda — dan saya melaporkannya berbeda.**
- **Bar tab anggota meluber 12px.** Ini **saya yang menciptakan**: tab
  Musik adalah tab kelima, dan empat tab memang muat di 360px.
- **Halaman Musik meluber 30px.** Ini **cacat bawaan**; tab kelima hanya
  membukanya. Mengatakan keduanya "cacat baru" adalah keliru, dan
  mengatakan keduanya "sudah ada" sama kelirunya.

**Yang dibangun supaya ini tidak terulang.** Alat auditnya tidak dibuang:
ia dipromosikan menjadi rangkaian uji `qa/lebar-hp.mjs`, yang memeriksa
**ke-12 halaman** pada lebar 360px dan menuntut tidak ada satu pun yang
melebarkan layar. Pemeriksaannya sederhana — `scrollWidth` tidak boleh
melebihi `innerWidth` — tetapi ia menangkap seluruh golongan cacat yang
mustahil tampak di layar lebar. Ia kini berjalan dalam regresi penuh.

Selain itu, `musik-anggota.mjs` bertambah dua butir yang mengunci
perbaikan ini pada kedua sisi: anggota **dan** pelatih.

**Pelajaran yang tercatat di sini:** sebelum menambah sesuatu yang
mengubah tata letak, ukur pada lebar terkecil yang sungguh dipakai
orang — bukan pada lebar yang enak dipakai saya.

## Audit tiga klaim yang belum pernah diuji (21 Sep 2026)

**Yang memicu:** *"selesaikan"* keempat kalinya. Tiga putaran sebelumnya
merampungkan hal yang tertulis; putaran ketiga mengaudit dan menemukan
cacat tata letak. Putaran keempat mengaudit **klaim**, bukan kode — sebab
ada beberapa hal yang pernah saya katakan kepada pelatih tanpa pernah
mengujinya.

Tiga klaim, tiga hasil. **Ketiganya benar.** Tetapi "benar" yang tidak
pernah diuji sama nilainya dengan tebakan yang beruntung, jadi semuanya
kini dijaga oleh pengujian.

| Klaim | Hasil | Catatan |
|---|---|---|
| **Luring**: aplikasi tetap jalan tanpa sinyal | ✓ benar | Service worker aktif; materi 18 anggota utuh; Perbarui gagal dengan jujur dan **tidak** merusak salinan tersimpan |
| **Tim besar**: 80 pemain masih wajar | ✓ benar | Berkas grup hanya **20 KB** (18 anggota: 10 KB); semua halaman masih ~10 ms |
| **Mikrofon ditolak**: penala diam, metronom tetap jalan | ✓ benar | Nol galat; metronom tetap berdetak (birama 1 → 2) |

**Yang paling penting justru yang negatif.** Luring adalah **alasan
arsitektur ini dipilih**: menolak server bukan untuk menghemat uang,
melainkan karena latihan berlangsung di lapangan yang belum tentu ada
sinyal. Kalau luring ini rusak, seluruh argumen itu runtuh — dan tidak ada
uji yang akan memberitahu kita. Sekarang ada.

**Tim besar dan uang.** Klaim "nol rupiah" pernah saya ucapkan kepada
pelatih yang sudah dua kali menanyakan biaya. Tetapi yang menarik berkas
materi setiap kali menekan Perbarui adalah **HP anggotanya**, dan kuotanya
**mereka** yang membayar. Jadi yang diukur bukan apakah hosting-nya gratis,
melainkan berapa megabita yang dihabiskan anak-anak itu: **0,02 MB sekali
Perbarui pada 80 anggota.** Baru setelah angka ini ada, klaim "nol rupiah"
bisa dipertanggungjawabkan.

**Mikrofon dan janji yang belum diuji.** Saya pernah mengatakan "kalau
anak-anak menolak izinnya, penala diam saja — metronom tetap jalan".
Bahayanya bukan penala yang tidak bunyi, melainkan satu `getUserMedia` yang
gagal meruntuhkan seluruh halaman: anak yang menolak izin mikrofon akan
kehilangan metronomnya — alat yang sama sekali tidak butuh mikrofon.
Karena itu yang diuji bukan "penalanya bekerja", melainkan "segalanya yang
lain tetap bekerja".

**Rangkaian baru:** `qa/luring.mjs` (9), `qa/tim-besar.mjs` (14),
`qa/mikrofon-ditolak.mjs` (9). Bersama `qa/lebar-hp.mjs` (13) dari putaran
sebelumnya, kini ada **empat rangkaian yang menguji sifat, bukan fitur** —
hal-hal yang tidak pernah muncul sebagai permintaan, tetapi akan membuat
seluruh aplikasi tidak berguna bila dilanggar.

**Pola yang tercatat di sini:** dua dari empat "selesaikan" terakhir
menghasilkan penemuan. Polanya bukan "selesaikan lagi", melainkan
**berhenti menjawab dari daftar yang sudah saya ketahui, dan ukur
sesuatu yang belum pernah diukur.**

## Accelerando & Ritardando (21 Sep 2026)

**Yang diminta:** *"bisa ada opsi accelerando dan ritardando gitu di
metronome repertoar nya, bisa nda ya?"*

**Jawabannya: bisa — dan mesinnya sudah ada sejak lama.** Yang tidak ada
adalah **bahasa** dan **tempatnya**. Ia bernama "Latih tempo (naik/turun
bertahap)", terkubur di dalam kartu "Pola ritme", dengan empat angka yang
harus diketik sendiri. Jadi fiturnya ada, tetapi tidak dapat ditemukan
oleh orang yang memintanya dengan nama musiknya.

**Tiga keputusan.**

1. **Bahasanya jadi bahasa musik.** Dua tombol: **Accelerando** dan
   **Ritardando**. Yang diatur hanya tujuan (BPM) dan berubah tiap berapa
   birama.

2. **Langkahnya DIHITUNG, bukan diketik.** Ini yang terpenting. Pada
   bentuk lama, besar langkah diketik sendiri dan **boleh nol** — dan nol
   membuat tempo tidak pernah berubah sedetik pun, tanpa peringatan apa
   pun. Keadaan mati yang tampak seperti fitur rusak. Kini langkahnya
   diturunkan dari jarak tempo dan rentang waktunya, sehingga selalu ada
   perubahan yang terjadi. Ringkasannya ditampilkan supaya pelatih bisa
   memeriksanya, bukan menebaknya.

3. **Anggotanya ikut bisa memakainya.** Keputusan yang paling menentukan.
   Kendali lama ikut tersembunyi bersama kartu Pola ritme — yang justru
   sengaja saya sembunyikan dari anggota karena ia menulis ke repertoar.
   Tetapi **perubahan tempo adalah perilaku metronom di perangkat ini
   sendiri, bukan data repertoar**. Jadi ia dipindahkan ke kartu metronom
   dan terbuka untuk keduanya, tanpa melanggar aturan kepemilikan yang
   dibangun sebelumnya: repertoar tetap milik pelatih.

**Cara membuktikannya tanpa peramban.** Godaan terbesarnya adalah
menganggap selesai setelah dua tombol tampil dan bisa ditekan. Yang
diminta bukan sebuah tombol, melainkan **tempo yang makin cepat dari
birama ke birama** — dan itu tidak bisa dibuktikan dari warna tombol.
Karena itu hitungannya dikeluarkan dari kelas `Metronom` menjadi fungsi
murni `tempoLatih`, sehingga bisa diuji langsung.

**Uji yang keliru.** Butir pertama menuntut tempo sudah mencapai 140 BPM
pada birama ke-65 dan gagal. Yang keliru adalah harapannya, bukan
hitungannya: dengan langkah 2 BPM tiap 4 birama, ia baru tiba di tujuan
pada birama ke-81. Butirnya diperbaiki menjadi "mendekati tujuan tanpa
melampaui", dan yang diuji di akhir rentang adalah bahwa ia **berhenti
tepat di tujuan**, bukan terus naik tanpa akhir.

**Diuji:** `qa/perubahan-tempo-logika.mjs` (16 butir: tempo naik, turun,
datar, dijepit di tujuan, pecahan langkah masuk akal, dan "tiap 0 birama"
tidak menghasilkan NaN) dan `qa/perubahan-tempo.mjs` (27 butir: kedua
tombol, berpindah arah, ringkasan diperbarui, langkah tidak pernah nol,
metronom tetap berdetak, dan **anggota bisa memakainya** sementara kartu
Pola ritme tetap tersembunyi). 30 rangkaian regresi bersih.

## Separuh yang terlewat: "di metronome REPERTOAR nya" (21 Sep 2026)

**Yang terjadi:** permintaan yang sama dikirim **dua kali**. Setelah yang
pertama dikerjakan, godaannya adalah menjawab "sudah selesai". Tetapi
pesan yang dikirim ulang biasanya berarti yang dikerjakan **bukan** yang
diminta — dan kali ini buktinya ada di dalam kalimatnya sendiri.

**Kata yang terlewat adalah "repertoar".**

Yang pertama kubangun adalah **kendali hidup di kartu metronom**: untuk
berlatih sesaat, di perangkat ini sendiri, tidak tersimpan ke mana pun.
Itu perlu, dan anggota pun bisa memakainya. Tetapi pelatih mengatakannya
*"di metronome **repertoar** nya"* — maksudnya **terpasang pada lagunya**.

Perbedaan ini bukan detail:

| | Kendali hidup (metronom) | Tersimpan di lagu (repertoar) |
|---|---|---|
| Berlaku untuk | latihan sesaat | lagu itu, selamanya |
| Tersimpan | tidak | ya, di dalam `Song.latih` |
| Ikut ke anggota | tidak | **ya**, lewat berkas materi |
| Satu band sama tempo | tidak | **ya** |

Tanpa yang kedua, 18 anggota masing-masing menebak sendiri seberapa
cepat accelerando lagu itu — padahal mereka harus latih **bersama**.

**Yang dibangun.** Editor lagu kini punya bagian **Perubahan tempo lagu
ini** (Accelerando / Ritardando, tujuan, dan intervalnya). Karena tersimpan
di dalam `Song`, ia ikut terbawa ke HP seluruh anggota setiap kali materi
diterbitkan; dan daftar lagu menampilkan lencana
`accelerando → 140` / `ritardando → 100`.

**Lencananya sengaja tampil untuk anggota juga.** Kalau sebuah lagu
accelerando, mereka harus tahu **sebelum** memutarnya — bukan terkejut
ketika temponya tiba-tiba naik sendiri. Ini jenis hal kecil yang tidak
pernah diminta, tetapi langsung terasa begitu dipakai.

**Butir yang membuktikannya.** Yang diuji bukan "tombolnya ada", melainkan
alur utuhnya: pelatih memberi sebuah lagu accelerando → menyimpannya →
menerbitkan materi → anggota menekan Perbarui → **memilih lagunya, dan
perubahan temponya langsung aktif tanpa diatur ulang**. Tanpa butir ini,
separuh permintaannya bisa saja belum dikerjakan tanpa ada yang tahu.

**Pelajaran yang tercatat di sini:** bila sebuah permintaan dikirim ulang,
baca ulang kalimatnya kata demi kata sebelum menjawab "sudah selesai".
Jawaban yang benar sering kali tersembunyi di kata yang tidak kuperhatikan
pada bacaan pertama — dan kali ini kata itu adalah **repertoar**.

**Diuji:** `perubahan-tempo.mjs` bertambah dari 27 menjadi **40 butir**.
30 rangkaian regresi bersih.

## Ritardando di antara dua segmen (21 Sep 2026)

**Yang diminta, dengan contohnya sendiri:** *"Misal aku mau ada ritardando
di bar 89 dan 90, dari 172 ke 140. Aku tinggal ketik tempo 172 di bar 88
dan tempo 140 di bar 91 kan? terus aku aktifin opsi ritardando di bar 89
sebagai awal mulai ritardando. Kalau aku tidak aktifin otomatis bar 91
langsung turun tempo gitu."*

**Dua kali kubangun yang salah.** Pertama kubuat accelerando/ritardando
menyeluruh: kamu mengetik tujuan dan rentangnya. Kedua, setelah pesannya
dikirim ulang, kutambahkan versi yang tersimpan di lagu — tetapi tetap
berupa luncuran menyeluruh. Dua-duanya bukan yang diminta.

Yang diminta adalah **luncuran DI ANTARA dua segmen yang sudah diketik**.
Tempo map sudah punya 172 di bar 88 dan 140 di bar 91; yang kurang
hanyalah satu tanda pada segmen awalnya supaya birama di antaranya
meluncur, bukan menunggu lompatan di bar 91. Modelnya **jauh lebih
sederhana** daripada yang kubangun — karena pelatih tidak perlu mengetik
tujuan apa pun: tujuannya sudah ada di segmen berikutnya.

**Yang dibangun.** `TempoSegment.berangsur` (0/1). Kalau 1, tempo meluncur
linier dari segmen ini ke segmen berikutnya. Fungsi murni baru
`tempoPeta()` menangani tangga maupun luncuran; tanpa tanda itu, perilakunya
**persis seperti sediakala** (fungsi tangga) — jadi lagu yang sudah ada
tidak pernah berubah dengan sendirinya. Itu janji yang diuji.

**Keadaan pinggir yang sengaja dijaga:** segmen terakhir yang ditandai
berangsur (tidak ada tujuan), dua segmen di birama yang sama (tidak boleh
membagi nol), segmen berikutnya yang mundur, dan tempo map yang kosong.
Semuanya harus tetap menghasilkan angka, bukan `NaN`.

**Dua kegagalan uji yang bukan cacat fitur — dan keduanya patut dicatat.**

1. **Empat butir gagal karena BPM tetap 120.** Rupanya `Ctrl+A` **tidak
   memilih isi kolom angka**, sehingga ketikan uji MENEMPEL di belakang
   nilai lama (120 lalu diketik 172 menjadi 120172, lalu ditampilkan
   kembali sebagai 120). Sebelum menyalahkan fiturnya, kuperiksa dengan
   `elementFromPoint` apakah kolomnya tertutup sesuatu — ternyata tidak,
   kolomnya bisa diklik dengan sempurna. Perbaikannya: panggil `select()`
   pada kolomnya, baru mengetik.
2. **Dua butir gagal karena lagunya tidak pernah tersimpan.** Uji membuka
   "Tambah lagu" tetapi **lupa memberi judul**, dan aplikasi dengan benar
   menolak menyimpan lagu tanpa judul. Yang keliru ujinya, bukan
   aplikasinya — malah aplikasinya melakukan hal yang tepat.

Pola yang sama muncul dua kali dalam satu putaran: **kegagalan uji
dulu, baru fitur.** Dua-duanya tidak akan ketemu kalau aku langsung
menyimpulkan "fiturnya rusak".

**Diuji:** `perubahan-tempo-logika.mjs` 36 butir (contohnya dipakai apa
adanya: bar 88 = 172, bar 91 = 140, luncurannya linier, tanpa tanda tetap
melompat, dan keempat keadaan pinggir) dan `perubahan-tempo.mjs` 53 butir
(saklarnya, ringkasannya menyebut ritardando/accelerando, mematikannya
tidak meninggalkan sisa, dan tanda berangsur **ikut terbawa ke dalam
berkas materi**). 31 rangkaian regresi bersih.

## Aturan prioritas: cacat yang diam saja (21 Sep 2026)

**Yang memicu:** *"lanjut"*. Setelah luncuran per segmen jadi, aplikasi
kini punya **tiga** cara mengubah tempo. Yang belum pernah kupikirkan
selama itu: **apa yang terjadi bila dua di antaranya menyala bersamaan.**

**Ternyata: luncuran per segmen hancur, tanpa peringatan apa pun.**

```
bar | per-segmen saja | keduanya menyala
 88 |           172,0 |            180,0
 89 |           161,3 |            180,0
 90 |           150,7 |            180,0
 91 |           140,0 |            180,0
```

Ritardando yang diatur hati-hati **rata menjadi 180**. Lagunya tetap
berbunyi. Tidak ada yang error. Pelatih mendengar tempo datar dan tidak
punya petunjuk apa pun tentang penyebabnya — dan ia akan menyalahkan
diri sendiri, atau menyalahkan aplikasinya, tanpa pernah menemukan
saklar yang lupa ia matikan.

Ini golongan kegagalan yang paling berbahaya: **ia tampak berhasil.**

**Aturannya: yang lebih KHUSUS menang.** Luncuran per segmen lebih
khusus daripada luncuran menyeluruh, jadi kalau keduanya menyala, yang
menyeluruh dikesampingkan.

**Tetapi aturan yang tidak terlihat sama saja dengan tidak ada.** Karena
itu kedua tempat yang dikesampingkan sekarang **mengatakannya** — baik
kartu metronom maupun editor lagu — lengkap dengan penyebabnya dan cara
mengembalikannya. Dan peringatannya **tidak** muncul pada lagu yang
tidak punya luncuran per segmen, supaya tidak menjadi kebisingan yang
diabaikan.

**Agar aturan ini bisa diuji,** urutannya dikeluarkan dari kelas
`Metronom` menjadi fungsi murni `tempoBerlaku()`. Tanpa itu, satu-satunya
cara membuktikannya adalah menjalankan peramban dengan AudioContext
sungguhan dan **mendengarkannya**.

**Kesalahan yang kuulang.** Butir pertama menuntut 180 di bar 89 lagi —
dan gagal, untuk **kedua kalinya** dengan alasan yang sama persis:
dengan langkah 2 BPM tiap 4 birama, di bar 89 baru naik 22 langkah
(+44 BPM), yaitu **164**, belum sampai tujuan. Aku menulis catatannya di
dalam uji ini supaya lain kali aku tidak menghabiskan waktu yang sama
untuk ketiga kalinya.

**Satu kesalahan uji lagi, beda jenis.** Tujuh butir gagal bertubi-tubi
seolah fiturnya rusak. Padahal ujinya **menekan saklar secara buta**:
satu klik tidak mengenai sasaran, seluruh urutan bergeser satu langkah,
dan keadaannya terbalik. Diperbaiki dengan membaca keadaan saklarnya
dulu, menekan hanya bila perlu, lalu **memeriksa hasilnya** — bukan
menghitung klik.

**Diuji:** `perubahan-tempo-logika.mjs` 45 butir, `perubahan-tempo.mjs`
63 butir. 31 rangkaian regresi bersih.

## Panel yang berbohong: angka diam, bunyi bergerak (22 Sep 2026)

**Yang memicu:** *"lanjut"*. Luncuran per segmen sudah berbunyi sejak
kemarin. Yang belum pernah kupertanyakan: **dari mana pelatih tahu luncuran
itu benar-benar jalan?** Jawabannya: dari panel lagu, satu-satunya tempat
yang menampilkan tempo saat lagu berjalan.

**Ternyata panel menghitung temponya sendiri.** Mesin memainkan
`tempoBerlaku`; panel memanggil `tempoPada`, yang hanya tahu tempo **tangga**
per segmen. Pada empat birama yang menurun 172 → 161,3 → 150,7 → 140, panel
menampilkan **172 empat kali berturut-turut**.

```
bar | yang berbunyi | yang ditampilkan
 88 |         172,0 |              172
 89 |         161,3 |              172   ← angkanya diam
 90 |         150,7 |              172   ← padahal lagunya meluncur
 91 |         140,0 |              140
```

Ini cacat yang paling merugikan pada **saat yang paling penting**: pelatih
sedang mencoba lagunya di section. Telinganya mendengar ritardando, matanya
membaca angka datar. Yang mana yang ia percayai? Yang mana pun yang ia
pilih, hasilnya buruk — ia bisa menyimpulkan fiturnya tidak jalan, atau menyimpulkan
telinganya yang salah.

Dua hal yang berbeda tentang hal yang sama paling cepat terasa di telinga
dan paling lambat ketahuan di layar.

**Perbaikannya bukan menambal angkanya, melainkan menghapus duplikasinya.**
Panel kini memanggil **fungsi yang sama** dengan mesin (`tempoBerlaku`), dan
penjepit temponya pun yang sama (`jepitTempo` — sebelumnya privat di dalam
kelas `Metronom`, jadi pada tempo ekstrem panel bisa menampilkan angka yang
tidak pernah berbunyi). Satu sumber kebenaran, dua pemakai: tidak bisa
menyimpang lagi.

**Angka yang bergerak harus dijelaskan**, supaya tidak disangka galat. Maka
muncul keterangan di bawahnya — *"berangsur ke bar 91 (140 BPM)"* — dan
desimalnya hanya ditampilkan saat tempo sedang berada **di antara** dua angka
yang diketik. `172 BPM` tetap terbaca sebagai angka yang diketik pelatih;
`161.3 BPM` kelihatan sebagai angka antara.

**Jamnya ikut meleset.** Semua hitungan waktu lagu berakar pada
`detikSampai`, yang menganggap tempo datar di dalam satu segmen. Tiga birama
yang melambat ternyata **0,29 detik lebih panjang** daripada tiga birama
172 — jadi durasi total, sisa waktu, dan batang progres ikut salah. Pelan,
tidak pernah berteriak, dan karena itu tidak pernah dicurigai.
`detikSampai` kini menerima tempo per birama sebagai parameter **opsional**:
tanpanya ia berjalan persis seperti dulu, jadi lagu lama tidak berubah
sedetik pun — dan itu diuji, bukan diandaikan.

**Kesalahan uji yang ketiga kalinya, dan jenisnya baru.** Bagian 16 menuntut
140 di bar 91 dan mendapat **200**. Awalnya tampak seperti panel yang masih
berbohong; yang berbohong adalah **contohnya**: butir 14 pernah mengubah bar
91 menjadi 200 untuk memeriksa kata "accelerando", lalu **tidak pernah
mengembalikannya** — sehingga lagu yang tersimpan, dan ikut terbit ke
anggota, meluncur 172 → 200. Panelnya benar sejak awal.

Pelajaran yang tercatat kini di dalam ujinya: **setiap kali sebuah butir
mengubah contoh untuk keperluan selingan, butir itu wajib
mengembalikannya** — dan isi materi yang diterbitkan diperiksa, bukan hanya
tombolnya.

**Diuji:** `perubahan-tempo-logika.mjs` 65 butir (bagian 12 membandingkan
cara lama dengan cara baru dan membuktikan **keduanya benar-benar berbeda**;
bagian 13 membuktikan jalan baru sama dengan jalan lama selama tempo diam),
`perubahan-tempo.mjs` 73 butir (bagian 16 memutar metronom sungguhan dan
membaca angka di layar pada bar 88–91). 31 rangkaian regresi bersih.

## Tempo map yang tidak berbunyi, dan sepuluh rangkaian uji yang mati diam-diam (22 Sep 2026)

**Yang memicu:** *"lanjut"*. Usai merapikan panel, pertanyaan yang belum
pernah kutanyakan: **masih ada tempat lain yang menghitung tempo dengan
caranya sendiri?**

### 1. Tempo map lagu tidak pernah berbunyi sampai dicari

Menelusuri pemakai `tempoPada` menuntun ke satu baris di `Music.tsx`:
`useEffect` yang memuat pengaturan lagu ke metronom memuat **semuanya** —
bpm, sukat, hitung mundur, pola, bunyi, getar, volume — **kecuali
`useMap`**. Jadi tempo map sebuah lagu diam saja sampai pemakai menemukan
sendiri pilihan "Ikuti tempo map" di antara kolom-kolom setelan.

Yang membuatnya lebih dari sekadar kurang nyaman: **pemutaran lewat SET
LIST menyusun opsinya sendiri** (`opsiDariLagu`) dengan
`pakaiTempoMap: segmen.length > 0`. Jadi

```
lagu yang sama ──lewat set list──► mengikuti tempo map-nya
               ──tombol Mulai────► tempo dasar 120
```

Dua jawaban berbeda untuk pertanyaan yang sama. Dan yang paling mungkin
kena dampaknya justru anggota: pelatih mengatur ritardando, menerbitkannya,
anak-anak membuka lagunya, menekan Mulai — dan mendengar tempo datar.

Perbaikannya satu baris: muat `useMap` dari lagu seperti pengaturan
lainnya. Menjadikannya bawaan tidak menutup apa pun — pilihannya tetap
ada untuk berlatih tempo datar, dan panel serta peringatannya tetap
mengatakan keadaannya.

### 2. Sepuluh rangkaian uji yang mogok sebelum periksaannya yang pertama

Sambil memeriksa, kusadari **sepuluh rangkaian** yang menguji persis
bagian ini — mode lagu, panel, segmen, panjang lagu, rentang ulang, set
list, pemetaan drill↔musik — **tidak ada dalam `regresi-penuh.sh`**.
Dijalankan satu per satu, semuanya mogok. Tiga sebabnya:

1. **Layar sambutan menutupi semuanya** (8 rangkaian). Tiap peluncuran
   Puppeteer membawa perangkat baru; layar sambutan muncul, klik pertama
   tidak mengenai apa pun. Tambalan: `lewatSambutan(p)`.
2. **Menyisipkan modul aplikasinya sendiri** —
   `await import('/src/db/db.ts')` — yang hanya ada di server
   pengembangan. Begitu diarahkan ke versi jadi: `Failed to fetch
   dynamically imported module`. Dua rangkaian.
3. **Modul `/tmp` yang tidak ikut dirakit** (`gabung.mjs`, `setlist.mjs`,
   `birama.mjs`, `ulang.mjs`) → `ERR_MODULE_NOT_FOUND`. Empat rangkaian.

Mogoknya **bunuh diri sebelum menghasilkan apa pun**: tidak ada baris
"N lulus, M gagal", hanya jejak galat. Karena itu ringkasannya tampak
kosong — `regresi.sh` mencetak "(tanpa ringkasan)" — dan mudah dilewatkan
begitu saja.

Untuk sebab (2) kutulis `qa/db-mentah.mjs`: menanam data lewat IndexedDB
langsung, tanpa modul aplikasinya. Satu hal yang harus diingat dan sudah
ditulis di dalam berkasnya: **`useLiveQuery` tidak bereaksi pada tulisan
mentah**, jadi sesudah menanam data halamannya harus dimuat ulang
(`segar()`). Kalau tidak, datanya sudah ada di basis data tetapi tidak
pernah sampai ke layar — dan ujinya gagal pada hal yang sama sekali tidak
ada sangkut pautnya dengan yang sedang diuji.

Satu perbaikan sambil jalan: pada `m1-tempo-lagu-drill`, menautkan drill
ke lagu kini dilakukan **lewat pilihan lagunya** (`pilih-lagu-drill`),
bukan dengan menyunting `songId` langsung di basis data. Selain tidak
bergantung pada server pengembangan, itu juga berarti cacat pada pilihan
lagunya tidak akan lagi luput dari uji.

### 3. Alamat yang salah, dan kenapa mereka tercantum di luar daftar

Akar mengapa mereka tercantum di luar `regresi-penuh.sh`: rangkaian-rangkaian
itu membaca alamatnya dari `process.argv[2]`, sedangkan `regresi.sh`
mengirimnya lewat lingkungan (`BASE`). Dikirim lewat lingkungan, mereka
diam-diam berlari ke bawaan `:5173` — server pengembangan — yang memang
tidak bisa memikul seluruh regresi. Sekarang lingkungan menang, argumen
tetap berlaku untuk dijalankan sendiri.

**Hasilnya:** 10 rangkaian yang mati membawa **374 pernyataan** hidup
kembali (238 pernyataan antarmuka + 34 pemetaan drill↔musik + 102 set
list); 3 rangkaian lagi (`uji-birama`, `uji-panjang-lagu`, `uji-ulang` —
257 pernyataan) sebenarnya sehat, hanya tidak pernah tercantum. Semuanya
— 13 rangkaian — kini ada di dalam `regresi-penuh.sh`, lengkap dengan
catatan di dalam berkasnya supaya tidak dikeluarkan lagi tanpa alasan
yang tertulis. Regresi penuh: **44 rangkaian bersih**.

## Dua tempat terakhir yang masih buta luncuran (22 Sep 2026)

**Yang memicu:** *"lanjut"*. Pertanyaan yang sama seperti kemarin, diulang
sampai habis: **masih ada tempat yang menghitung tempo dengan caranya
sendiri?**

Kali ini tinggal dua, keduanya modul murni:

1. **`gabungMusik.ts` — pemetaan drill↔musik.** `petakanSetKeMusik`
   memakai `tempoPada`: tempo **tangga** per segmen. Bila lagunya
   meluncur 172 → 161,3 → 150,7 → 140, tiap set di dalam rentang itu
   dipetakan seolah temponya masih 172. Akibatnya drill berjalan lebih
   cepat daripada musiknya, dan pemain tiba di set berikutnya **sebelum
   lagunya sampai di situ**.

2. **`setlist.ts` — durasi lagu di set list.** `durasiSatu` menghitung
   dengan tempo tangga, padahal saat set list MEMUTAR lagunya
   (`opsiDariLagu`) tempo map-nya diikuti. Jadi durasi yang
   **ditampilkan** dihitung dengan aturan yang berbeda dari durasi yang
   **dimainkan**. Selisihnya kecil, tidak pernah berteriak, dan karena
   itu mengendap bertahun-tahun.

Keduanya kini memakai `tempoBerlaku` — fungsi yang sama dengan mesin.
`SegmenWaktu` mendapat `berangsur?` opsional supaya tanda luncurannya
ikut terbawa; tanpa tanda itu perilakunya persis seperti sediakala
(diuji, bukan diandaikan).

**Satu baris yang sengaja dihapus: `get tempo()`.** Getter itu
mengembalikan `hitungBpm(1)` — tempo pada **birama pertama** — dan
tidak punya pemanggil. Ia dihapus bukan karena tidak terpakai, melainkan
karena ia mengajarkan hal yang keliru: bahwa sebuah lagu punya SATU
tempo yang bisa ditanyakan kapan saja. Sejak ada luncuran per segmen itu
tidak benar lagi — pertanyaannya harus menyebut biramanya. Menyimpannya
hanya menunggu seseorang memakainya untuk menampilkan angka yang diam
sementara lagunya bergerak, persis cacat panel yang diperbaiki pada N7.

**Kesalahan hitung yang ketiga kalinya, untuk jenis yang sama.** Butir
`latih` menuntut 140 di bar 1 dan mendapat 120. Dengan `tiap: 1`, bar 1
memakai `siklus = floor((1-1)/1) = 0` — **belum bergerak**; langkah
pertama baru terjadi di bar 2. Ini kesalahan yang sama dengan dua
sebelumnya (22 langkah × 2 BPM; dan lupa mengembalikan contoh), dan
kali ini catatannya ditulis lengkap dengan tabel bar 1/2/3 di dalam
ujinya supaya tidak ada putaran keempat.

**Diuji:** `uji-gabung-musik.mjs` 45 butir (bagian N9 membandingkan
tangga dengan luncuran dan membuktikan **bedanya lebih dari 20 BPM**;
posisi birama tidak boleh bergeser hanya karena tempo meluncur),
`uji-setlist.mjs` 107 butir (selisih 0,29 dtk — bukan pembulatan).
44 rangkaian regresi bersih.

## Lagu mengaku luncurannya sebelum diputar (22 Sep 2026)

**Yang memicu:** *"lanjut"*. Setelah semua perhitungan tempo menyatu,
pertanyaan sisanya bukan lagi soal angka, melainkan soal **siapa yang
tahu**.

Sebuah lagu tertulis "120 BPM · 2 segmen tempo" di daftar repertoar,
padahal ia meluncur 172 → 140 pada bar 88–91. Yang tahu hanya orang yang
membuka editor lagunya — padahal yang **memutarnya** belum tentu orang
itu, dan anggota tidak punya editor sama sekali.

Ini bukan keluhan baru: aplikasi ini sudah punya penanda `accelerando →
140` untuk perubahan tempo menyeluruh, dengan alasan yang tertulis di
kodenya — *"mereka harus tahu SEBELUM memutarnya, bukan terkejut ketika
temponya tiba-tiba naik sendiri."* Alasan itu berlaku persis sama untuk
luncuran per segmen; hanya penandanya yang belum ada.

Maka ditambahkan lencana `luncur 172 → 140` pada lagu yang punya
luncuran, dengan keterangan bar awal & bar tujuan saat disentuh. Tiga
hal yang sengaja dijaga:

- **Tampil untuk anggota juga.** Daftar lagunya tidak dibatasi
  `hanyaPutar`, jadi lencananya ikut terbawa ke HP mereka — dan ini
  diuji pada perangkat anggota sungguhan (berkas materi diunduh ulang
  lalu diambil), bukan diandaikan. Penanda yang hanya tampil di
  perangkat pelatih tidak berguna bagi orang yang paling perlu
  mengetahuinya.
- **Lagu tanpa luncuran tidak diberi lencana.** Lencana yang selalu
  muncul berubah menjadi kebisingan yang diabaikan, dan kebisingan yang
  diabaikan sama bahayanya dengan tidak ada penanda.
- **Ringkasannya dihitung, bukan dikatkan.** `daftarLuncuran` dan
  `ringkasLuncuran` fungsi murni di `metronome.ts`, jadi isi lencananya
  bisa diuji tanpa peramban — termasuk kasirnya: tanda pada segmen
  terakhir (tidak punya tujuan) dan dua segmen pada bar yang sama
  (tidak punya jarak) tidak menghasilkan luncuran.

**Sambil jalan: dua fungsi ditandai, bukan dihapus.** `tempoPada` dan
`detikBiramaPada` kini tidak punya pemanggil di aplikasi — yang tersisa
hanya uji. Keduanya tetap benar untuk apa yang mereka klaim (tempo
TANGGA), tetapi nama mereka tidak memberitahu bahwa mereka **buta
luncuran**, dan dua dari empat cacat yang ditemukan minggu ini
berawal dari situ. Karena itu keduanya diberi penanda besar: untuk
menampilkan atau memainkan tempo, pakai `tempoBerlaku`.

**Satu hal tentang kotak pasir:** di tengah pengerjaan, `node_modules`,
`/tmp`, dan `dist/` lenyap — kotak pasirnya diganti di antara pesan.
Berkas sumber di `/home/user` selamat, jadi tidak ada yang hilang; cukup
jalankan `pulihkan.sh`, `bangun-logika.sh`, lalu `vite build`. Tetapi
pelajarannya dicatat: **anggap lingkungan bangun tidak pernah bertahan
di antara pesan**, dan periksa sebelum menganggap suatu kegagalan
berasal dari kode.

**Diuji:** `perubahan-tempo-logika.mjs` 78 butir (bagian 14 baru:
ringkasan, jumlah, urutan, dan dua kasirnya), `perubahan-tempo.mjs`
81 butir (bagian 17 memeriksa lencana di perangkat pelatih **dan**
anggota, serta bahwa lagu tanpa luncuran tidak memilikinya).
44 rangkaian regresi bersih.

## "Link rusak" di iPhone & Mac: cacat yang baru terasa setelah dipakai (22 Sep 2026)

**Yang memicu:** laporan sungguhan. *"Aku sudah deploy ke Netlify, nah
ada beberapa anakku yang HP-nya iOS dan teman pelatihku yang pakai MacBook
tidak bisa akses linknya. Error-nya: link broken."*

Kalimat "broken link" itu **persis** bunyi halaman 404-nya Netlify:
*"Looks like you've followed a broken link or entered a URL that doesn't
exist on this site."* Jadi mereka tidak gagal membuka internet — mereka
menerima berkas yang tidak ada di situsnya.

### Mekanismenya

Sekali unggah ke host statis adalah **penggantian**: berkas ber-hash
yang lama ikut terhapus. Sementara perambah bisa saja masih menyimpan
`index.html` lama berikut `sw.js` lama. Perambah itu lalu meminta
`/assets/index-LAMA.js`, menerima 404, dan menampilkan halaman
"link rusak" — padahal situsnya sehat.

Yang paling sering kena justru pemakai yang **pernah membuka tautannya
sebelum unggahan terakhir**, bukan pemakai baru. Itu sebabnya gejalanya
tampak acak dan seolah khusus iOS/Mac: WebKit memegang pekerja layanan
dan simpanannya jauh lebih lama daripada Chrome di Android.

### Dua cacat di sisi aplikasi

1. **`_headers` tidak pernah ikut terunggah.** `netlify.toml` memang
   punya aturan `Cache-Control: no-cache` untuk `sw.js` — tetapi berkas
   itu **tidak pernah masuk ke folder unggahan**. `siapkan-unggah.sh`
   hanya menyalin isi `dist/`. Jadi aturannya ada di repositori dan
   tidak pernah berlaku di peladen. Aturan yang tidak pernah sampai ke
   peladen sama dengan tidak ada aturan.
2. **Tidak ada jalan keluar bagi pemakai awam.** Mereka tidak tahu apa
   itu cache, apalagi cara membersihkannya di Safari.

Perbaikannya: `_headers` dan `_redirects` kini berada di `public/`,
jadi ikut ke dalam `dist/` dan ke dalam folder unggah. Dan `index.html`
mendapat **panel darurat** yang muncul hanya bila aplikasi gagal
dimuat, dengan satu tombol yang membuang pekerja layanan & simpanan
lamanya lalu memuat ulang.

Tiga hal yang sengala dijaga pada panel itu:

- **Muncul hanya bila benar-benar gagal.** Penanda
  `window.__drillkitJalan` dipasang `main.tsx` sesudah React hidup;
  tanpa itu panel akan muncul pada perangkat lambat yang sebenarnya
  baik-baik saja — menyuruh pemakai membersihkan yang tidak perlu
  dibersihkan.
- **Ditulis sebagai JavaScript biasa di dalam HTML**, bukan modul:
  kalau berkas modulnya gagal dimuat, hanya skrip sebaris itu yang
  masih hidup untuk menolong.
- **Dijelaskan, bukan sekadar "error".** Panelnya menyebut penyebabnya
  (versi lama) dan menenangkan yang paling ditakutkan pemakai: data di
  dalam aplikasi tidak ikut terhapus.

### Pelajaran uji yang menyamar sebagai kebetulan

Uji pertama **lulus walau seharusnya gagal**: panel darurat tidak
muncul, padahal berkas aplikasinya sengaja diblokir. Ternyata pekerja
layanan dari halaman sebelumnya (konteks peramban yang sama) melayani
aplikasi dari cache, sehingga aplikasinya hidup juga. Kebetulan ini
menunjukkan persis mekanisme yang membuat pemakai macet pada versi
lama. Diperbaiki dengan konteks peramban baru untuk tiap keadaan.

**Diuji:** `darurat-muat.mjs` 17 butir (panel tidak muncul saat hidup,
muncul saat gagal, dan tombolnya benar-benar menyembuhkan; berkas
`_headers`/`_redirects` ada di dalam hasil build).

## Alat diagnosis, dan jebakan `spawnSync` (22 Sep 2026)

**Yang memicu:** *"lanjutkan"* — setelah laporan "link rusak" ditangani,
pertanyaan yang tersisa: **bagaimana kalau ini terjadi lagi saat saya
tidak ada?** Membersihkan cache perangkat satu per satu tidak boleh
menjadi satu-satunya jawaban.

Maka ditulis `scripts/periksa-situs.sh`: satu perintah, lima
pemeriksaan, dan yang paling penting — ia menyebut **berkas mana** yang
bermasalah, bukan sekadar "ada yang salah". Alat diagnosis yang
mengatakan "semuanya baik-baik saja" pada situs yang rusak lebih
berbahaya daripada tidak punya alat sama sekali, karena itu skripnya
sendiri diuji (`qa/periksa-situs.mjs`, 15 butir: situs sehat keluar 0,
situs yang berkasnya hilang keluar 1 **dan menyebut nama berkasnya**,
dan tanpa `paket.json` diberitahukan tanpa dikatakan gagal).

Pemeriksaan yang paling menentukan sengaja dibuat demikian: ambil
`index.html` yang **sedang melayani**, petik semua berkas `assets/`
yang disebut di dalamnya, lalu periksa satu per satu. Itulah persis
kegagalan yang dilaporkan — perambah meminta berkas ber-hash yang sudah
dihapus unggahan baru — jadi pemeriksaannya harus meniru perambahnya,
bukan meniru isi foldernya di komputer pelatih.

**Satu jebakan yang menghabiskan waktu:** uji pertama **menggantung
sampai waktu habis tanpa menghasilkan satu baris pun**. Ujiannya
menjalankan peladen HTTP sendiri di dalam proses Node, lalu memanggil
skripnya dengan `spawnSync` — yang **memblokir putaran event**, sehingga
peladen itu tidak pernah menjawab permintaan `curl` dari dalam skrip.
Kegagalannya tidak berbunyi: tidak ada galat, tidak ada keluaran, hanya
diam. Diperbaiki dengan `execFile` asinkron.

Pelajaran yang bisa dipakai ulang: **bila sebuah uji memakai peladen di
dalam proses yang sama, jangan pernah memanggil sesuatu secara sinkron
selama peladen itu harus menjawab.** Gejalanya selalu berupa
keheningan, bukan galat.

## Pemeriksa situs di dalam aplikasi (22 Sep 2026)

**Yang memicu:** *"lanjutkan"* — dua kali. Setelah skrip
`periksa-situs.sh` selesai, satu kelemahannya tetap ada: **ia butuh
terminal dan `curl`**, sementara pelatih yang memakai aplikasi ini
tidak selalu punya keduanya. Dan keadaan yang paling perlu diperiksa
justru muncul saat ia hanya memegang HP.

Maka pemeriksaannya dipindahkan juga ke dalam aplikasi: **Pengaturan →
Kesehatan situs → Periksa sekarang**. Modulnya (`src/lib/situs.ts`)
murni — semua pengambilan dilewatkan lewat fungsi `Ambil`, sehingga
seluruh keadaan bisa diuji tanpa peramban, termasuk "situsnya tidak
menjawab sama sekali".

Tiga keputusan yang sengaja diambil:

- **Tidak pernah melempar galat.** Kegagalan pengambilan dicatat
  sebagai hasil, bukan sebagai pengecualian. Alat diagnosis yang
  berhenti berjalan pada keadaan terburuk tidak ada gunanya — justru
  pada keadaan itulah ia dibutuhkan.
- **Tidak dijalankan otomatis saat halaman dibuka.** Setiap pemeriksaan
  memicu permintaan jaringan, dan halaman Pengaturan dibuka juga oleh
  perangkat yang sedang hemat kuota. Yang menekan tombolnya sedang
  mencari jawaban; yang sekadar membuka pengaturan belum tentu.
  Ini diuji: hasilnya **tidak boleh** tampil sebelum tombol ditekan.
- **`HEAD`, bukan `GET`, untuk sekadar mengecek keberadaan.**
  Mengunduh bundel hampir 1 MB hanya untuk memastikan ia ada jelas
  berlebihan. `GET` dipakai hanya untuk `index.html`, yang isinya
  memang perlu dibaca untuk mengetahui berkas mana yang akan diminta
  perambah.

Pemeriksaan yang paling menentukan tetap sama seperti versi terminalnya:
petik semua berkas `assets/` dari `index.html` **yang sedang melayani**,
lalu periksa satu per satu. Kegagalan yang dilaporkan bukan "situsnya
mati", melainkan "perambah meminta berkas ber-hash yang sudah dihapus
unggahan berikutnya" — jadi pemeriksanya harus meniru perambahnya.

Alat diagnosis yang mengatakan "semuanya baik-baik saja" pada situs
yang rusak lebih berbahaya daripada tidak punya alat, karena itu
keduanya diuji: `uji-situs.mjs` 27 butir (logika murni, termasuk
pengambil yang selalu galat) dan `situs-ui.mjs` 11 butir (hasilnya
sampai ke mata pemakai, tidak jalan sendiri, dan satu berkas yang
sengaja diputus **disebut namanya**).

Sambil jalan: `registerSW.js` diperiksa dan ternyata hanya mendaftarkan
pekerja layanan — **tidak ada muat-ulang otomatis**. Jadi unggahan baru
tidak akan pernah memutus metronom yang sedang berjalan di tengah
latihan. Sebaliknya, perangkat bisa tetap memakai versi lama sampai
dibuka ulang; itulah sebabnya cap rilis di Pengaturan tetap penting.

## "Ada versi baru": cacat yang tidak pernah dilaporkan (22 Sep 2026)

**Yang memicu:** *"lanjutkan"*. Semua perbaikan terbitan sudah selesai,
lalu pertanyaan yang tersisa: setelah pelatih mengunggah perbaikan,
**bagaimana perangkat anggota mengetahuinya?**

Aplikasi ini sengaja **tidak pernah** memuat ulang dirinya sendiri —
memuat ulang otomatis akan mematikan metronom di tengah latihan.
Konsekuensinya sebuah perangkat bisa menjalankan versi lama
berhari-hari. Pelatih yang baru mengunggah perbaikan lalu melihat
anak-anaknya tetap memakai yang lama akan **mengira unggahannya gagal**
— padahal unggahannya berhasil, hanya saja perangkat itu belum dimuat
ulang. Itu kegagalan yang tidak pernah dilaporkan, karena tidak ada
yang tahu ada yang salah.

Maka ditambahkan penanda *"Ada versi baru DrillKit"* dengan satu tombol
**Muat ulang**, atau **Nanti** bila sedang latihan. Keputusannya
dikembalikan ke pemakai; aplikasi tidak pernah mengambil alih.

### Dua sinyal, sebab satu saja tidak cukup

Desain pertama hanya membandingkan nama bundel yang diminta
`index.html` di situs dengan yang sedang berjalan. **Uji pertamanya
gagal**, dan kegagalannya sunyi — tidak ada galat, penandanya saja yang
tidak pernah muncul.

Sebabnya: setelah aplikasi pernah dibuka, `index.html` **disajikan dari
cache pekerja layanan**, sehingga permintaannya tidak pernah sampai ke
jaringan. Pemeriksanya selalu membaca salinan lama. Ironisnya, itulah
persis keadaan yang hendak dideteksi. Mencopot pekerja layanan pun
tidak menolong — `unregister()` membuatnya berhenti terdaftar, tetapi
ia tetap menguasai halaman yang sudah terbuka (terbukti: `controller`
masih `true`, dan penyadapan jaringannya dipanggil **nol** kali).

Maka sinyal utamanya diubah menjadi **`controllerchange`**: bila
pekerja layanannya berganti, kode yang sedang berjalan pasti lebih tua
dari yang ada di situs. Itu sinyal yang tidak bisa meleset. Pemeriksaan
nama bundel tetap dipakai sebagai sinyal kedua, untuk perangkat yang
belum punya pekerja layanan sama sekali.

Penjaga yang mudah dilupakan: `controllerchange` **berbunyi juga** saat
pekerja layanan pertama kali mengambil alih, dan saat ia dibuang —
padahal saat itu tidak ada versi lama. Karena itu baru dihitung bila
sebelumnya **sudah** ada pengendali, dan pengendalinya tidak menjadi
kosong.

### Mengapa tidak sekalian memuat ulang otomatis

Karena metronom. Memuat ulang tanpa peringatan pada detik yang salah
akan menghentikan ketukan di tengah latihan, dan mengulang hitungan
yang sudah jalan. Keadaan yang hendak dihindari lebih buruk daripada
keadaan yang diperbaiki.

**Diuji:** `uji-rilis.mjs` 14 butir (logika murni, termasuk disiplin
"bila tidak tahu, diamlah"), dan `cap-rilis.mjs` 16 butir — bertambah
tujuh yang menguji **dua arah kesalahan**: penanda tidak muncul pada
rilis yang sama, muncul saat pekerja layanan berganti, **tidak** muncul
saat `controllerchange` berbunyi tanpa pengendali sebelumnya, muncul
saat situsnya memuat bundel lain, dan **Nanti** benar-benar menutupnya.

## Delapan belas rangkaian uji yang tidak pernah dijalankan (22 Sep 2026)

**Yang memicu:** *"lanjutkan"*. Setelah tema terbitan selesai, saya
menjawab pertanyaan yang paling murah dan paling sering menghasilkan
cacat: **mana yang belum tersentuh uji sama sekali?**

Dua pertanyaan dijawab dengan perintah, bukan dengan perasaan:

1. modul murni mana yang tidak ikut dirakit `bangun-logika.sh`;
2. berkas `qa/*.mjs` mana yang tidak ada di dalam daftar regresi.

Jawabannya membuat saya berhenti sejenak.

### Temuan

**Tiga belas rangkaian logika** sudah ditulis lengkap, tetapi modul
yang mereka impor (`/tmp/evaluasi.mjs`, `/tmp/analitik.mjs`,
`/tmp/sesi.mjs`, `/tmp/gerak.mjs`, `/tmp/csvk.mjs`, dan sebelas
lainnya) **tidak pernah dirakit**. Mereka mogok pada baris impornya —
`ERR_MODULE_NOT_FOUND` — sebelum menyentuh satu asersi pun.

**Lima rangkaian peramban** hidup, tetapi masih menunjuk ke
`http://localhost:5173`, server pengembangan. Server itu menyajikan
ratusan modul sekali muat dan kehabisan memori di kotak pasir; karena
itu kelimanya tidak pernah bisa masuk daftar regresi.

Total: **18 rangkaian, 737 asersi**, tidak pernah berjalan sejak
ditulis.

Yang paling mengejutkan: **ketigabelas rangkaian logika langsung lulus
tanpa satu perubahan pun pada kode aplikasinya.** 636 asersi itu
benar-benar sehat — mereka hanya tidak pernah dipanggil. Kelima
rangkaian peramban hidup juga, setelah dua hal yang sudah dikenal
diselesaikan: alamatnya dialihkan ke hasil build, dan `lewatSambutan()`
disisipkan sesudah halaman pertama dibuka.

### Mengapa ini penting

Uji yang tidak dijalankan **lebih berbahaya daripada tidak punya uji**,
karena ia memberi keyakinan palsu. Ia ada di repositori, ia dibaca
orang, ia membuat perubahan berikutnya terasa aman — padahal ia tidak
pernah membuktikan apa pun.

Ini kejadian kedua kalinya. Yang pertama (sepuluh rangkaian) tercatat
pada bagian N8. Kesamaannya: **kegagalannya sunyi**. Tidak ada galat
yang berteriak; tidak ada baris "N lulus, M gagal" yang hilang. Yang
hilang justru barisnya, dan tidak ada yang mencarinya.

Karena itu sekarang ada kebiasaan yang tertulis di dalam skripnya:
sebelum menganggap daftar regresi lengkap, **bandingkan isi `qa/` dengan
daftar di `regresi-penuh.sh`**, dan bandingkan modul di `src/lib/`
dengan yang dirakit `bangun-logika.sh`.

### Satu perbaikan kecil yang layak dicatat

`periksa-paket.mjs` berbunyi `const BASE = process.argv[2] ?? BASE` —
merujuk dirinya sendiri. Skripnya mogok sebelum menyentuh apa pun,
dan kalimat galatnya (`Cannot access 'BASE' before initialization`)
sama sekali tidak menyebut bahwa skrip itulah yang salah.

**Diuji:** 18 rangkaian di atas kini masuk regresi (67 rangkaian
seluruhnya), dan `jalankan-semua.sh` mendapat blok ketiga & keempat
supaya satu blok tidak melewati batas waktu satu perintah.

## field.ts: cacat pada lapangan tanpa hash (22 Sep 2026)

**Yang memicu:** *"lanjutkan"*. Setelah sapuan "mana yang belum diuji"
selesai dan 18 rangkaian mati dihidupkan kembali, satu pertanyaan
masih terbuka: **modul terbesar aplikasi masih belum punya uji logika
sama sekali.**

`src/lib/field.ts` — 656 baris, sistem koordinat lapangan. Ia
menentukan ke mana seorang pemain berdiri. Kalau ia salah, anak-anak
berbaris ke tempat yang salah, dan tidak ada yang menyadarinya sampai
seluruh formasi tampak miring.

### Cacatnya

Dengan pilihan **"Tanpa hash"** (lapangan bola, lapangan indoor, GOR),
`hashOffsetYd` bernilai `0` — sehingga front hash dan back hash
berdua ditempatkan tepat di **garis tengah lapangan**. Akibatnya
setiap pemain diberi acuan:

```
S1 · YL50 · FH +8
```

…padahal di lapangannya **tidak ada hash sama sekali**. Anak-anak
disuruh berdiri "8 langkah dari front hash" dan akan mencari garis
yang tidak ada, lalu berdiri di tempat yang salah.

Inilah jenis cacat yang paling mungkin ditemui anak-anak section
pelatih: bukan yang membuat aplikasi berhenti, melainkan yang
memberi perintah yang tidak bisa dijalankan.

Perbaikannya: hash hanya menjadi calon acuan bila lapangannya **memang
punya hash** (`ho > 0`). Urutannya pun diubah — dua garis tepi lebih
dulu — sehingga bila jaraknya sama, yang dipakai adalah garis DEPAN
(sisi penonton), patokan yang paling mudah ditemukan mata.

### Satu kegagalan uji yang ujinya sendiri yang salah

Uji pertama melaporkan tanda `#` melampaui hurufnya: *"B# di 7.500
(jarak huruf 5.000)"*. Ternyata ujinyalah yang keliru — ia mengukur
celah dari celah PERTAMA saja (A di 0 → B di 5), padahal B# di 7,5
terjepit rapi di antara B (5) dan C (10). Kodenya benar.

Pelajarannya sama seperti sebelumnya: **bila sebuah uji gagal,
periksa dulu apakah ujinya sendiri benar** — terutama bila yang
digagalkan adalah pola yang sudah berjalan bertahun-tahun.

### Yang diuji (uji-lapangan.mjs, 88 butir)

Bukan angka hasil hitungan semata, melainkan **konvensi yang dipakai
bersama** oleh beberapa fungsi sekaligus:

- S1 di kiri layar, S2 di kanan (terbukti dari `sx = halfL − x`);
- depan/penonton di bawah, belakang di atas (`sy = halfW − y`);
- koordinat yang DITULIS sama dengan patok yang DIGAMBAR
  (`patokRef` mengambil daftarnya langsung dari `daftarPatok`);
- jarak hash NFHS/NCAA/NFL sesuai angka yang tertulis di
  keterangannya — konstanta dan keterangan tidak boleh berbeda;
- A di sisi negatif ditandai koma atas (`A'`), bukan tanda minus,
  supaya anak-anak tidak membacanya "mendekati A";
- panah arah: ke S1 = kiri, ke belakang = atas.

Bila dua fungsi memakai konvensi yang berbeda, pemain akan berdiri
di tempat yang benar menurut satu layar dan salah menurut layar lain.

## Kolom ukuran lapangan: mengosongkan kolom bukan berarti nol (22 Sep 2026)

**Yang memicu:** *"lanjutkan"*. Cacat `field.ts` kemarin punya pola:
**nilai nol pada pilihan konfigurasi menciptakan acuan ke sesuatu yang
tidak ada.** Maka dicari saudara-saudaranya di modul yang sama.

### Yang ditemukan

`customStepYd` — ukuran satu langkah — adalah kolom angka bebas tanpa
batas bawah. Mengisinya `0`, atau **sekadar mengosongkannya**, membuat
`setiap` koordinat dihitung dengan pembagi nol: `NaN` di `xSteps`, di
jarak dari garis, di buku saku, di patok, di panah arah.

Yang membuat ini licik: `Number('')` adalah `0`, **bukan** `NaN`. Jadi
kolom yang dikosongkan tidak pernah tampak sebagai kesalahan — ia
hanya diam-diam menghasilkan nol.

Lebar dan panjang lapangan pun kolom bebas. Tetapi **end zone boleh
nol** — keterangan kolomnya sendiri menyuruh pelatih mengisi `0` untuk
lapangan bola dan indoor. Penjagaan yang seragam akan merusak pilihan
yang sah itu.

### Perbaikannya, dua lapis

1. **Di modul murni** (`stepYd`): nilai yang tidak bisa dipakai — nol,
   negatif, `NaN`, atau preset yang tidak dikenal — dikembalikan ke
   ukuran langkah baku. Seperti `jepitTempo` dan `jarakPatok`, yang
   sudah memakai idiom yang sama. Penjagaan di modul menyelamatkan
   **perhitungannya** dari mana pun nilainya datang.
2. **Di kolom isian** (`angkaAman`): nilai yang tidak terbaca, atau di
   bawah batas minimum, ditolak sejak awal — jadi yang TERSIMPAN pun
   tidak pernah berisi angka yang tidak masuk akal.

### Dua hal yang ujinya ajarkan

**Pertama: mengosongkan kolom bukan berarti nol.** `angkaAman` mula-
mula menganggap `''` sebagai `0`, sehingga menghapus angka untuk
mengetik yang baru membuat lebar lapangan **meloncat ke batas
minimumnya**. Kolom yang dikosongkan berarti "belum diisi" — kembalikan
nilai yang lama.

**Kedua: jangan tekan Backspace sebelum mengetik pada kolom
terkendali.** Kolom yang menjadi kosong membuat React menggambar ulang
nilainya, pilihan teksnya hilang, dan angka yang diketik menempel di
belakang nilai lama — ujinya melihat `"00"` padahal yang diketik satu
angka. Kegagalannya tampak seperti cacat aplikasi, padahal cara ujinya
mengetik yang salah.

**Diuji:** `uji-lapangan.mjs` 94 butir (bertambah 6 — termasuk
pemeriksaan bahwa ukuran langkah nol **tidak menghasilkan NaN pada
koordinat mana pun**, bukan sekadar bahwa `stepYd` mengembalikan angka),
dan `lapangan-ui.mjs` 16 butir: end zone **boleh** 0, ukuran langkah
tidak boleh 0 atau kosong, lebar & panjang dijaga, dan setelah semuanya
halaman drill tetap terbuka tanpa `NaN`.

## 2a — Enam rangkaian buku saku yang tidak bisa gagal (23 Sep 2026)

**Yang memicu:** agenda *Item #2 — Buku Saku, 2a: pemulihan uji & regresi*.
Perbaikan buku sakunya sendiri (kompas, panah, tanda ′, −/+) sudah tayang;
yang tersisa adalah enam rangkaian ujinya — `dd8`, `dd8b`, `dd9-kompas`,
`dd10b-kartu`, `dd10b-mode`, `dd10b-override` — yang disebut "mati karena
layar sambutan".

### Yang ditemukan: bukan mati, melainkan tidak bisa gagal

Diagnosis awalnya benar, tetapi tidak lengkap. Keenamnya memang tertutup
layar sambutan `PilihMode` — klik pertama tidak mengenai apa pun. Yang
lebih buruk: **mereka tidak pernah gagal karenanya.** Keenamnya skrip
pengintai yang mencetak JSON tanpa satu asersi pun. Dijalankan apa
adanya (alamatnya dialihkan ke versi jadi):

```
dd8          {"buka": false, "adaCentang": false, "denganLpc": null, ...}   exit 0
dd8b         {"berat": null, "error": []}                                   exit 0
dd9-kompas   {"patokOn": false, "saatPatok": null, ...}                     exit 0
dd10b-mode   TETAP TIDAK ADA · MENYESUAIKAN TIDAK ADA                       exit 0
```

`regresi.sh` melaporkan yang pertama sebagai `"error": [] | tanda ✗: 0` —
**terbaca bersih**. Ini jenis kegagalan sunyi yang ketiga, setelah
"mogok sebelum asersi pertama" (N8) dan "tidak pernah dirakit/dijalankan"
(N14): uji yang ada, berjalan, keluar dengan kode 0, dan tidak
membuktikan apa pun.

### Dan di balik layar sambutan pun pemeriksaannya sudah rusak

Menambahkan `lewatSambutan()` saja tidak cukup. Versi lamanya dijalankan
lagi dengan sambutan dilewati, dan tiga pemeriksaan ternyata sudah lama
berbohong:

1. **`dd8` menyatakan SETIAP baris "tidak cocok".** Sejak DD10 kolom
   langkah berisi panah (`17 →`); `Number('17 →')` adalah `NaN`, jadi
   pemeriksaan Lk/cnt-nya tidak mungkin lulus — dan tidak ada yang tahu,
   karena hasilnya hanya dicetak.
2. **`dd8` & `dd8b` membaca kolom yang salah.** Warna Lk/cnt dibaca dari
   "sel terakhir". Sejak DD10b sel terakhir adalah **Ukuran langkah** —
   `dd8b` membaca `<span class="mono">22.5″</span>` yang memang tidak
   pernah berwarna, lalu melaporkannya sebagai hasil pemeriksaan warna
   peringatan.
3. **"Kartu pertama" adalah pemain yang berbeda di setiap perangkat.**
   Urutan kartu mengikuti `id` anggota, dan `id` dibuat dengan akhiran
   acak. Karena itu catatan DD8 menyebut angka Eka dan DD8b angka Andra
   dari rangkaian yang sama-sama membaca kartu pertama.

Satu hal lagi yang dicatat supaya tidak diulang: komentar `dd10b-override`
yang lama berbunyi "setel ke hitungan", padahal satu klik dari `drill`
menghasilkan `tetap`. Dan ia menutup panel Detail dengan Escape, yang —
tanpa jendela terbuka — juga **membatalkan pilihan titik** di editor.
Dengan panel terbuka, pilihannya diamati bertahan, tetapi tidak ada yang
menjanjikannya di kode; rangkaian baru tidak mengandalkannya.

### Perbaikannya: satu alat bersama, enam rangkaian dengan asersi

`qa/alat-buku-saku.mjs` — **bukan rangkaian**, alat bersama keenamnya
(seperti `sambutan.mjs` dan `db-mentah.mjs`). Ia menjamin:

- **selalu ada baris "N lulus, M gagal"** — juga saat rangkaiannya mogok
  (dihitung satu kegagalan, lengkap dengan sebabnya) atau macet (batas
  waktu sendiri 240 detik, jauh di bawah `timeout 600` milik
  `regresi.sh`, supaya ringkasannya sempat tercetak);
- **langkah yang gagal berhenti dengan terang** — pratinjau yang tidak
  muncul atau jendela yang tidak terbuka melempar galat berkalimat
  jelas, bukan mengembalikan `null` untuk dibaca asersi berikutnya;
- **kolom dicari lewat judulnya, kartu lewat nama pemainnya**;
- **yang tersimpan dibaca dari basis data**, bukan dari layar (README);
- **kolom React diketik**, bukan ditimpa lewat setter prototipe.

Keenam rangkaian ditulis ulang di atasnya. Maksud tiap rangkaian
dipertahankan, dan angka acuannya diambil dari bagian **Hasil DD8/DD10/
DD10b** di dokumen ini — jadi yang diuji adalah klaim yang dulu ditulis,
bukan angka yang dicomot dari layar hari ini.

| Rangkaian | Butir | Yang dibuktikan |
|---|---:|---|
| `dd8` | 23 | kolom Lk/cnt di 18 kartu; Eka 29 langkah / 16 = **1,82**; di semua kartu Lk/cnt sejalan dengan Langkah ÷ Cnt; warna hanya untuk berat/mustahil, sama dengan legendanya; centang mati → kolom **dan** legenda hilang |
| `dd8b` | 15 | count diketik 1 → tersimpan di basis data; Andra **12,92 merah** (mustahil) di semua kartu; ukuran langkah 22,5″ **tidak** ikut merah — yang mustahil kecepatannya |
| `dd9-kompas` | 35 | kompas BELAKANG · PENONTON · S1 · S2; penjelasan A/−/+ hanya bila patok menyala; Gita `C' · T5 +2.75` → `B' +2.25 · T6 +0.75` `↖`; **koma atas tepat pada pemain di sisi S2**, dicocokkan silang dengan koordinat garis yard (36 koordinat); panah sama dengan atau tanpa patok |
| `dd10b-mode` | 24 | tetap: Citra 21/16 = **1,32**, 22,5″ di semua kartu; ikut hitungan: **16/16 = 1**, Citra **29,6″**; (ukuran ÷ 22,5″) × 16 = langkah mode tetap untuk tiap pemain; warna ukuran mengikuti 22,5/30/45″ |
| `dd10b-override` | 24 | siklus drill → tetap → hitungan → drill, tiap langkah **tersimpan di basis data**; kembali ke drill = timpaan dihapus; `hitungan` = **16 · 1 · 120**; bertahan setelah panel ditutup-dibuka **dan setelah halaman dimuat ulang**; pemain lain tidak ikut |
| `dd10b-kartu` | 15 | Detail Andra `16 · 1 · 120 · 18,2″` = kartu Andra `16 →` · `1` · `18,2″`; **17 kartu lainnya tidak berubah**; dikembalikan → kartu kembali persis |

**Jumlah: 136 butir**, dari enam rangkaian yang sebelumnya membuktikan
nol.

### Batas "sejalan" yang jujur, bukan 0,02

Rangkaian lama memakai selisih tetap 0,02 antara Lk/cnt dan Langkah ÷ Cnt.
Itu terlalu ketat untuk angka yang dicetak: langkah dibulatkan ke
bilangan bulat, sedangkan Lk/cnt dihitung dari jarak yang belum
dibulatkan. 8,49 langkah tercetak "8" dengan Lk/cnt 0,53, padahal 8 ÷ 16
= 0,50. Selisih yang jujur bisa mencapai ½ ÷ Cnt + 0,005 (0,036 untuk 16
hitungan); dengan batas 0,02, **tujuh dari delapan belas kartu** data
contoh akan "gagal" padahal angkanya benar. Batasnya kini diturunkan
dari cara angkanya dibulatkan, dan ditulis di `lkCntSejalan()`.

### Uji yang benar-benar bisa gagal

Setiap rangkaian baru dibuktikan bisa gagal dengan menyuntikkan cacat ke
bundel versi jadi, lalu mengembalikannya:

- Lk/cnt dikali 1,1 → `dd8`: **21 lulus, 2 gagal** (Eka 2 ≠ 1,82; 18
  kartu tidak sejalan).
- Koma atas dipasang di sisi yang salah → `dd9-kompas`: **31 lulus, 4
  gagal**, termasuk pemeriksaan silang dengan garis yard.
- Buku saku mengabaikan timpaan per pemain → `dd10b-kartu`: **11 lulus,
  4 gagal** (13 ≠ 16, 22,5″ ≠ 18,2″).
- Alamat mati, dan layar sambutan yang tidak terlewati → **0 lulus, 1
  gagal**, exit 1, dengan sebabnya — bukan JSON kosong berkode 0.

### Lain-lain

- Keenamnya didaftarkan ke `regresi-penuh.sh` (kini **77 rangkaian**),
  dengan catatan di dalam berkasnya supaya tidak dikeluarkan tanpa
  alasan tertulis. `jalankan-semua.sh` mendapat blok kelima, yang juga
  menambal dua rangkaian 1a/1b (`uji-riwayat`, `uji-simpan-otomatis`)
  yang belum tercantum di sana — kedua daftar kini sama persis.
- Bawaan `regresi.sh` dipindah dari `:5173` ke `:4173`, sama dengan
  `regresi-penuh.sh`.
- `qa/README.md`: angka rangkaian yang basi (24 → 77), tiga pelajaran di
  atas, dan cara menjalankan Chromium bila unduhan Chrome Puppeteer
  diblokir (`@sparticuz/chromium`).
- Tangkapan layar kini opsional (`SHOTS=/folder`); dulu dua rangkaian
  menulis ke `/home/user/shots` yang belum tentu ada.
- Rangkaian yang sama juga lulus pada berkas portabel
  (`BASE=file:///…/index.html`).
- **Catatan lingkungan:** tiga belas rangkaian lain yang terdaftar juga
  masih menyebut `/home/user/drillkit` (huruf kecil) untuk `dist/` atau
  folder unduhan. Di kotak pasir ini mereka dijalankan dengan tautan
  `ln -s /home/user/DrillKit /home/user/drillkit`; merapikannya menjadi
  jalur relatif sengaja tidak dicampur ke 2a.

### Regresi penuh: empat yang tidak bersih, satu yang sungguhan

Regresi penuh pertama dengan 77 rangkaian (23 Sep 2026, 15.00–15.46,
lawan versi jadi): **73 bersih**, termasuk keenam rangkaian buku saku.
Empat sisanya diperiksa satu per satu. Tiga ternyata ujinya sendiri, satu
cacat sungguhan:

1. **`uji-csvkoordinat` — `(tanpa ringkasan)`.** Ia merakit modulnya
   sendiri lewat `execSync` di `/home/user/drillkit`, jalur yang tidak ada
   di checkout ini (huruf besar `DrillKit`), dan mogok dengan
   `spawnSync /bin/sh ENOENT`. Ringkasannya pun berbentuk `36/36 lulus`,
   yang tidak dikenali `regresi.sh`: sehat atau mogok, catatannya sama
   persis, dan kode keluarnya tidak pernah 1. Kini ia memakai modul yang
   sudah dirakit `bangun-logika.sh`, mencetak `N lulus, M gagal`, dan
   keluar dengan kode 1 bila ada yang gagal (dibuktikan dengan merusak
   modulnya sementara: lima ✗, exit 1).
2. **`berbagi-anggota` — 33 lulus, 1 gagal, karena kebetulan.** "Anggota
   pertama" diambil dari IndexedDB, yang urutannya mengikuti `id`
   berakhiran acak, lalu berkasnya dicari lewat nama DEPAN. Kali ini yang
   terambil Kirana Ayu, dan "kirana" juga cocok dengan
   `DrillKit-Indah-Kirana-WO09.json`: dua berkas, uji gagal. Peluangnya
   kira-kira satu dari delapan belas putaran, tanpa ada yang rusak. Kini
   dicocokkan dengan nama lengkap, persis seperti `namaBerkasAnggota`
   membentuknya.
3. **`mode-lomba` — `(tanpa ringkasan)`, bergantung jam.** Data contoh
   punya sesi hari ini pukul 15.30–18.00, dan regresinya kebetulan sampai
   di sini pukul 15.30. Sesi itu menjadi "sedang berjalan", kartu set list
   penampilan yang disiapkan uji tidak muncul, dan uji mogok di
   `daftar-lagu`. Setiap sore, kira-kira 15.00–18.00 jam perangkat, uji
   ini mogok tanpa ada yang rusak. Kini sesi data contoh yang jatuh hari
   ini dibuang sebelum sesi uji ditanam.
4. **`backup-lengkap` — 20 lulus, 3 gagal: CACAT SUNGGUHAN, sudah ada di
   `main`.** Uji ini membaca daftar tabel langsung dari IndexedDB dan
   menuntut setiap tabel ada di berkas backup. Tujuannya persis menangkap
   tabel baru yang lupa didaftarkan (cacat `setlists` di M3). 1a dan 1b
   menambah dua tabel, `riwayat` dan `simpanan`, dan tidak satu pun masuk
   backup. Tidak ketahuan karena PR #2 hanya menjalankan uji logika:
   Chrome tidak bisa diunduh di kotak pasirnya. **Sengaja belum
   diperbaiki**, karena ini keputusan produk, bukan urusan 2a:
   - `simpanan` berisi *pegangan berkas* (File System Access) milik
     perangkat itu sendiri. Isinya tidak bisa ditulis ke JSON dan tidak
     berarti apa pun di perangkat lain. Hampir pasti harus
     **dikecualikan** seperti `packages`, dengan alasannya ditulis di
     ujinya.
   - `riwayat` perlu diputuskan. Pilihan pertama: ikut backup, sehingga
     pulih bersama datanya. Tetapi berkas backup, termasuk yang ditulis 1b
     tiap ±15 menit, bisa membengkak beberapa MB per drill, dan
     pemulihannya harus ditambahkan. Pilihan kedua: dikecualikan.
     Riwayat dianggap milik perangkat, dan backup sudah memuat keadaan
     terkini.

   **Diputuskan keesokan harinya: keduanya dikecualikan** (lihat
   *Keputusan backup* di bawah).

Setelah ketiga uji diperbaiki, keempatnya dijalankan ulang lewat
`regresi.sh`: `uji-csvkoordinat` 36 lulus, `berbagi-anggota` 34 lulus,
dan `mode-lomba` 23 lulus. `mode-lomba` dijalankan pukul 15.47, di
dalam jendela yang dulu membuatnya mogok. `backup-lengkap` tetap 20
lulus, 3 gagal, sampai keputusannya diambil.

### Keputusan backup: `riwayat` dan `simpanan` milik perangkat

Diputuskan 24 Sep 2026: **keduanya dikecualikan dari backup**. Alasannya
ditulis di kepala `qa/backup-lengkap.mjs`, di samping `packages`:

- `simpanan`: pegangan berkas hanya berlaku di browser yang membuatnya,
  dan tidak bisa ditulis ke JSON.
- `riwayat`: backup memuat keadaan terkini, sedangkan riwayat untuk undo
  tetap milik perangkat. Kalau ikut, setiap berkas backup ikut membengkak,
  termasuk yang ditulis simpan otomatis tiap ±15 menit.

Sebelum memutuskan, jalur pemulihannya diperiksa dulu. `importBackup`
hanya menimpa tabel yang ada di berkas lewat `bulkPut`, tanpa
mengosongkan apa pun. Jadi saat backup dipulihkan, riwayat dan pegangan
simpan otomatis di perangkat tetap utuh; mengecualikan keduanya tidak
berarti menghapusnya. Bila kelak riwayat mau ikut backup, ada tiga
tempat yang harus diubah bersamaan: daftar `DIKECUALIKAN`,
`buildBackupPayload`, dan transaksi `importBackup`.

Keputusan ini tidak mengubah `src/`. Hasilnya, `backup-lengkap` **21
lulus, 0 gagal**.

### Temuan saat memutuskan: pemulihan yang batal seluruhnya

Memeriksa jalur pemulihan untuk keputusan di atas membuka cacat yang jauh
lebih berat. Cacat ini sudah ada sebelum 1a/1b: PR #2 tidak menyentuh
kedua transaksi yang bermasalah.

`importBackup` (Pengaturan) menulis semua tabel dalam satu transaksi
Dexie. Di dalamnya ia memanggil `db.memberNotes.bulkPut`, padahal
`memberNotes` tidak tercantum di cakupan transaksinya. Dexie 4.4.6 menolak
tabel di luar cakupan (`NotFound: Table memberNotes not part of
transaction`), sehingga seluruh transaksi batal. Akibatnya, **backup yang
memuat satu saja catatan anggota tidak bisa dipulihkan sama sekali**.
Tidak satu tabel pun kembali, dan pengguna hanya melihat "Gagal memulihkan
backup". Padahal berkas backup adalah satu-satunya jaring pengaman untuk
data yang hanya tinggal di perangkat.

Pola yang sama ada di `terapkan` (Pusat Data), dengan tabel lain: di sana
`evaluasi` yang ditulis tanpa tercantum di cakupan. Berkas Data apa pun
yang memuat evaluasi batal seluruhnya ("Gagal menerapkan data").

Tidak ada uji yang pernah menyentuh kedua jalur ini, karena data contoh
tidak punya catatan anggota maupun evaluasi. Semua `db.transaction(` di
`src/` (lima buah) lalu dipindai, dan hanya dua kasus ini yang ditemukan.

Ujinya ditulis lebih dulu, dan dibuktikan gagal pada versi jadi yang
belum diperbaiki:

- **`backup-lengkap` mendapat langkah 5.** Di setiap tabel wajib ditandai
  satu baris: baris yang sudah ada, atau baris uji bila tabelnya kosong.
  Backup diekspor, baris-baris itu dihapus, backup dipulihkan, dan setiap
  baris harus kembali. Tabel yang kelak ditambahkan ikut teruji tanpa
  perlu diingat. Sebelum perbaikan hasilnya **25 lulus, 11 gagal**:
  muncul "Gagal memulihkan backup", dan tidak satu pun dari sepuluh tabel
  pulih.
- **Berkas masuk `pusat-data` kini memuat satu evaluasi.** Sebelum
  perbaikan hasilnya **25 lulus, 10 gagal**: lagu, jadwal, dan evaluasinya
  tidak ada yang masuk. Dulu rangkaian ini mogok tanpa ringkasan bila
  terapkan gagal, karena dialog konfirmasinya tetap terbuka. Kini
  kegagalannya terlapor, lalu dialognya ditutup supaya sisa uji tetap
  berjalan.

Perbaikannya dua baris, masing-masing dengan komentar: `db.memberNotes`
masuk cakupan `importBackup`, dan `db.evaluasi` masuk cakupan `terapkan`.
Sesudahnya `backup-lengkap` **36 lulus**, `pusat-data` **35 lulus**, dan
`backup-setlist` 14 lulus, semuanya tanpa kegagalan.

**Diuji:** keenam rangkaian buku saku lulus lewat `regresi.sh`, diulang
tiga putaran lagi tanpa satu pun kegagalan, dan lulus lagi di regresi
penuh. `tsc --noEmit` bersih, `npm run build` sukses, dan
`bangun-logika.sh` merakit 26 modul. Regresi penuh pertama (23 Sep)
berakhir dengan 76 dari 77 rangkaian bersih. Setelah keputusan backup dan
perbaikan pemulihan, regresi penuh diulang sekali jalan lawan versi jadi
yang baru (24 Sep 2026, ±46 menit): **77 dari 77 rangkaian bersih, 2.670
butir lulus, 0 gagal**, dan tidak satu pun berakhir tanpa ringkasan.

## 2b — Kartu lipat buku saku (24 Sep 2026)

**Yang memicu:** sisa agenda *Item #2 — Buku Saku*: "kartu lipat (menunggu
keputusan user)". Panduan dan teks bantuan menyuruh kartu 9,5 × 13,5 cm itu
"dilipat", padahal desain lipatnya belum pernah ada — yang dicetak aplikasi
adalah kartu satu muka per pemain, satu halaman per kartu, di kertas
berukuran 95 × 135 mm yang hampir tidak ada printer rumahan mendukungnya.

**Keputusannya** (disetujui user, "ikut preferensimu"): kartu **dilipat dua**.
Lembaran 190 × 135 mm dicetak satu sisi, lalu panel kanan dilipat ke
belakang menjadi kartu 9,5 × 13,5 cm bermuka dua — tidak perlu printer
bolak-balik. Dua kartu muat satu lembar A4, lengkap dengan garis potong
(✂) dan garis lipat. Muka depan memuat kepala kartu + kompas + set awal;
muka belakang memuat sambungan set + keterangan + catatan. Contoh cetaknya
dibuat dulu di luar aplikasi (`contoh-kartu-lipat.html`, disetujui), baru
dipasang ke tombol "Buku saku". Format kartu tunggal yang lama dihapus;
"Lembar A4" (dot sheet) tidak berubah.

### Baris yang tingginya harus tetap

Muka kartu tingginya tetap (135 mm), jadi pagination-nya memakai kapasitas
baris per muka — dan kapasitas hanya jujur kalau tinggi barisnya tetap.
Awalnya nama set boleh melipat (seperti format lama), tetapi uji multikartu
langsung menangkapnya: 17 baris nama panjang ("Set 1 — Blok (salinan)")
meluap 125 px. Karena itu tabel lipat memakai `table-layout: fixed` dengan
sel satu baris: kolom Set berelipsis bila kepanjangan (teks selnya utuh di
HTML, hanya tampilan cetaknya yang dipotong; kolom "#" tetap mengancarkan
identitas). Kapasitas final, diukur dari render Chromium lalu dikurangi
±10% sebagai ruang font lain: depan 27 (30 tanpa kompas), belakang-tengah
32, belakang-terakhir 24 (ditambah 2/3 bila keterangan dimatikan, dikurangi
panjang catatan). Satu kartu memuat ±51 set; show yang lebih panjang
otomatis menjadi kartu 1/2, 2/2, … — diuji dengan 64 set: baris 1–27,
28–59, 60–64, tidak satu pun hilang atau ganda.

### Lebar kolom: koordinat tak boleh terpotong

Kolom Koordinat hampir menjadi korban: format DCI ("S2 · YL50 −3.25 · FH
−5.25", 27 karakter) terpotong pada lebar 30%. Bobot final: # 6, Set 16,
Cnt 7, Koordinat 38, Langkah 12, Lk/cnt 9, Ukuran 13 (dinormalisasi ulang
bila kolom dimatikan). Judul kolom yang panjang ("Langkah & arah")
dipenggal paksa dua baris dengan `<br>` — dengan spasi yang disengaja di
sekitarnya, supaya `textContent`-nya tetap "Langkah & arah" sesuai kontrak
dengan uji. Rangkaian `kartu-lipat` mengunci semua ini: 48 butir, termasuk
"tak ada sel terpotong selain nama set" dan "judul kolom tak terpotong"
(diukur lewat `scrollWidth` lawan `clientWidth`), serta "tak ada muka yang
meluap" di setiap konfigurasi.

### Uji lama tidak diubah, pembacanya yang diperbarui

Keenam rangkaian dd membaca pratinjau lewat `section.page` — struktur yang
tidak ada lagi di format lipat. Tetapi yang diubah hanya pembacanya
(`qa/alat-buku-saku.mjs`): `.kartu` bermuka dua (digabung menjadi satu
kartu per pemain, kompas dari depan, keterangan dari belakang kartu
terakhir), dengan `section.page` sebagai jalan kembali untuk format A4.
Hasilnya: **136 dari 136 butir dd lulus tanpa satu asersi pun diubah** —
bukti kontrak "kolom dicari lewat judul, kartu lewat nama" menahan
perubahan struktur total.

**Diuji:** `kartu-lipat` 48 lulus; dd8 23, dd8b 15, dd9-kompas 35,
dd10b-kartu 15, dd10b-mode 24, dd10b-override 24; ambang-gerak 20 dan
dasar-jarak 17 (keduanya membaca pratinjau) tetap lulus. `tsc --noEmit`
bersih, `npm run build` sukses. Contoh cetak diverifikasi satu halaman A4,
nol luapan, di render maupun PDF.

## J1 — Polesan: transposisi penala, ambang predikat, panduan anggota (24 Sep 2026)

**Yang memicu:** *"Kerjakan J1: transposisi penala, ambang predikat laporan,
dan panduan satu halaman anggota."* Tiga polesan yang sengaja ditunda sejak
17 Sep 2026, disatukan karena temanya sama: **kebiasaan tim yang belum bisa
diatur sendiri**.

### 1. Transposisi penala

Mikrofon mendengar nada **konser**. Pemain trumpet yang meniup C di
partiturnya membunyikan Bb konser — dan penala lama menulis "Bb4", jadi ia
harus menghitung ulang di kepala, atau mengira dirinya salah nada.

- Kotak **Instrumen** di kartu penala: *Konser (C)*, *Bb*, *Bb oktaf bawah*,
  *Eb*, *Eb oktaf bawah*, *F* — tiap pilihan menyebut contoh instrumennya
  (trumpet, sax tenor, sax alto, sax bariton, mellophone, …), karena pemain
  tidak perlu tahu teori transposisi untuk memilih.
- Nada besar menjadi **nada tertulis** (Bb4 konser → **C5** di trumpet),
  nada konsernya tetap disebut kecil di bawahnya supaya pelatih di
  sebelahnya bisa tetap bicara dalam nada konser. Nada dengung ikut
  diterjemahkan: *"A#3 · = C4 di partitur Bb"*.
- **Oktafnya ikut benar**, bukan hanya nama nadanya: sax tenor berbunyi M9
  di bawah tulisan, jadi gesernya 14, bukan 2. Tanpa itu, penala menulis
  "C4" untuk nada yang di partitur sax tenor tertulis C5.
- **Sen tidak ikut bergeser** — meleset 12 sen tetap 12 sen, apa pun nama
  nadanya. Nama tertulis diambil dari nada **terdekat** (bukan frekuensi
  mentah), jadi nama dan angka sen selalu sepasang.
- Disimpan **per perangkat** (setelan penala di `localStorage`), bukan per
  tim: HP pemain trumpet dan HP pemain mellophone memang harus berbeda.
  Setelan lama tanpa kolom ini, atau id yang tidak dikenal, jatuh ke
  **konser** — tidak pernah menggeser nada diam-diam.
- Penala juga ada di tab Musik **mode anggota**, jadi transposisi paling
  terasa justru di HP pemain.
- Sengaja **tidak** dimasukkan: bugle G (DCI lama). Belum pernah disebut
  tim, dan pilihan yang salah lebih berbahaya daripada pilihan yang tidak ada.

### 2. Ambang predikat laporan

Angka 85/70 dulu tertanam di **dua** tempat terpisah (kartu kehadiran & CSV
ringkas). Kini satu sumber: `predikatKehadiran()` di `lib/laporan.ts`.

- Kartu **Predikat kartu kehadiran** di Pengaturan: *Baik mulai dari …%*,
  *Cukup mulai dari …%*, pratinjau teks yang akan tercetak, dan
  **Kembalikan ke bawaan**. Disimpan di **pengaturan tim** (`ambangPredikat`)
  — ikut backup, dan laporan dari laptop & HP pelatih kedua memberi
  predikat yang sama untuk angka yang sama.
- **Ambangnya ikut tercetak di setiap kartu** (*"Predikat: Baik ≥ 90% ·
  Cukup 75–89% · Perlu perhatian < 75%"*). Begitu ambang bisa diatur, kata
  "Cukup" sendiri tidak lagi menjelaskan apa pun bagi pembina yang
  membacanya.
- Kartu Paket laporan admin di Rekap menyebut ambang yang berlaku plus
  tautan **Ubah di Pengaturan** — di sanalah pelatih melihat kata "Cukup"
  dan bertanya artinya.
- **Tahan salah ketik** (`rapikanPredikat`): dijepit 0–100, dibulatkan,
  bukan-angka → bawaan, dan **urutan terbalik ditukar**. Tanpa penukaran,
  `Baik 70 / Cukup 85` membuat predikat Cukup mustahil diraih. Dirapikan
  saat disimpan, jadi yang tersimpan sama dengan pratinjaunya.
- **Mengosongkan kolom bukan nol** (pelajaran 22 Sep 2026 terulang): di sini
  nol itu sah (Cukup 0% = tak ada yang "Perlu perhatian"), jadi kolom kosong
  yang diam-diam menjadi 0 akan mengubah laporan. Kolom memegang teksnya
  sendiri dan hanya meneruskan angka yang benar-benar terbaca.
- Tanpa pengaturan, predikatnya **identik** dengan sebelum J1 — diuji
  untuk setiap persen 0–100.

**Ambang "Perlu perhatian" di Rekap kini mengikuti Cukup (J1a, diputuskan
24 Sep 2026).** Saat J1 selesai, ambang di tab Rekap (pilihan <50/60/70/80%,
bawaan 60, tidak diingat) masih **terpisah**: anggota 65% berpredikat
"Perlu perhatian" di kartunya, tetapi tidak masuk daftar "Perlu perhatian
(di bawah 60%)" di laporan yang sama. Dari dua pilihan — (a) ambang Rekap
mengikuti Cukup, atau (b) predikat terendah diganti nama — kamu memilih (a):

- Bawaan ambang Rekap = **ambang Cukup** dari Pengaturan (bawaan 70, jadi
  angka bawaannya naik dari 60 ke 70 — itu memang maksudnya). Pilihannya
  ditandai *"(Cukup)"*, dan ambang Cukup yang bukan kelipatan 10 (mis. 75)
  ikut masuk daftar pilihan.
- Angka lain **tetap boleh** dipilih untuk melihat sekilas, tetapi hanya
  untuk kunjungan itu dan disertai peringatan kuning *"Berbeda dari ambang
  predikat Cukup … kartu kehadiran tetap memakai 70%"* plus tombol
  **Kembali ke 70%**. Ketidaksepakatan tidak dilarang — tetapi tidak lagi
  terjadi diam-diam, dan tidak lagi jadi keadaan bawaan.
- Ambang yang dipilih tetap menentukan daftar "Perlu perhatian" di layar,
  kalimat ringkasan & daftar di laporan, serta CSV — kini semuanya satu
  angka dengan predikat kartu.
- Diuji di `j1-polesan` (8 butir tambahan): bawaan 70 bertanda (Cukup),
  memilih 60 → peringatan + laporan memakai 60, "Kembali" → 70, dan setelah
  Cukup diubah di Pengaturan ambang Rekap ikut berubah.

### 3. Panduan 1 halaman versi anggota

Panduan F4 ditulis untuk pelatih: shortcut editor, backup, absensi — menu
yang tidak pernah dilihat anggota. Versi anggota **bukan salinan yang
dipangkas**, melainkan lembar dengan urutan yang dialami anggota:

1. **Buka DrillKit** — alamat situs + **kode QR** (pustaka `qrcode` yang
   sama dengan kartu QR absensi, tetap offline), pilih *Saya anggota*,
   pasang ke layar utama (Android & iPhone).
2. **Masukkan materi tim** — *Ambil materi dari situs* / *Buka paket tim*;
   berkas atas nama langsung mengenali pemiliknya, berkas grup lewat *Pilih
   namamu dulu*; Absensi & Catatan hanya terisi dari berkas atas nama.
3. **Isi tiap tab** — enam tab, urut seperti bar tab di HP.
4. **Menala sesuai instrumenmu** — tabel pilihan transposisi (sumbernya
   `DAFTAR_TRANSPOSISI` yang sama dengan penala, jadi tidak bisa berbeda).
5. **Kalau materi berubah** — *Perbarui* / *Ganti paket*.
6. **Kalau macet** — lima gejala, termasuk halaman "link rusak" (panel
   *Bersihkan & muat ulang*, 22 Sep 2026) dan berkas .json dari WhatsApp.

- **Dua keadaan yang tidak boleh tertukar.** Dari situs: alamat, QR,
  *Ambil materi dari situs*, *Perbarui*, panel darurat. Dari berkas
  portabel: tidak satu pun — aplikasinya memang menyembunyikan tombol
  itu, dan panduan yang menyuruh menekan tombol yang tidak ada lebih buruk
  daripada tanpa panduan. Kartu Pengaturan memberi tahu bila lembarnya
  sedang disusun versi berkas.
- **Alamat lokal diperingatkan.** Dicetak dari `localhost`/jaringan rumah,
  QR-nya tidak akan terbuka di HP anggota — pelatih diberi tahu sebelum
  mencetak 60 lembar yang tidak berguna. Bagian `#/…` dibuang dari alamat,
  supaya anggota mendarat di layar awal, bukan di Pengaturan.
- **Dua pintu masuk:** kartu Panduan di Pengaturan (bagian *Versi anggota*)
  dan kotak *Panduan untuk anggota* di menu **Berbagi** — tempat pelatih
  sedang menyiapkan kiriman. Unduhannya bernama sendiri
  (`panduan-anggota-drillkit.html`), tidak menimpa panduan pelatih.
- Panduan pelatih ikut disentuh sedikit: langkah *Kirim ke anggota*
  menunjuk ke panduan anggota, dan langkah tuning menyebut kotak Instrumen.
  Keduanya tetap **satu halaman**.

### Uji yang bisa gagal

**Setiap tombol yang disebut panduan dicari di kode sumber**
(`uji-panduan-anggota`, 20 label: *Ambil materi dari situs*, *Kunci
jawaban*, *Bersihkan & muat ulang*, …). Panduan yang menyebut tombol yang
sudah berganti nama tidak pernah terasa rusak — sampai seorang anggota
tersesat. Sekarang ia menggagalkan uji.

Satu asersi e2e sempat **lulus padahal tidak membuktikan apa-apa**:
absensi data contoh acak dan hampir semuanya 100%/50%/0%, sehingga ambang
90/60 tidak mengubah satu predikat pun — kartu "cocok dengan ambang tim"
sekaligus cocok dengan ambang bawaan. Kini uji menulis satu anggota tepat
50% dan menuntut **sedikitnya satu predikat berbeda dari bawaan**. Begitu
pula penghitung halaman PDF diuji dulu bisa berkata "2", sebelum
dipercaya berkata "1".

**Diuji:** `uji-transposisi` 41 · `uji-predikat` 31 · `uji-panduan-anggota`
58 · `j1-polesan` 76 (J1a ikut di dalamnya; mikrofon palsu Bb4 → C5/G5/F5/C6/G6 dengan sen tetap;
pengaturan diketik lewat antarmuka → tersimpan rapi → kartu & CSV; panduan
anggota dari Berbagi & Pengaturan, satu halaman A4 termasuk kasus terberat;
lebar 360px). Rangkaian di sekitarnya tetap bersih: musik-anggota 43,
mikrofon-ditolak 9, lebar-hp 13, berbagi-anggota 34, backup-lengkap 36,
pusat-data 35, sambutan-mode 32, buka-paket 28. Keempat rangkaian baru
masuk `regresi-penuh.sh` (kini 86). **Regresi penuh: 86 dari 86 rangkaian
bersih, 3.048 butir lulus, 0 gagal.** `tsc --noEmit` bersih, `vite build` dan
`build:portable` sukses.

---

## Rancangan lanjutan (26 Sep 2026, pemutakhiran 3 Okt 2026 pasca PR #14)

Disalin dari `RANCANGAN-LANJUTAN.md` supaya daftar ide dan keputusan diskusi
tinggal di dokumen ini. Berkas aslinya tetap ada sebagai ringkasan yang bisa
dibaca terpisah. Pengerjaan mengikuti urutan tabel; tiap rancangan selesai
dicatat di bawah salinannya.

# DrillKit — Rancangan lanjutan (hasil diskusi 26 Sep 2026, pemutakhiran 3 Okt 2026 pasca PR #14)

Dokumen ini merangkum delapan rancangan awal yang sudah didiskusikan dan
diputuskan bersama pelatih, ditambah tiga usulan baru pasca PR #14
(grid/patok yard–meter custom, impor Pyware, partitur full score/per instrumen)
— total sebelas rancangan.
Semuanya siap dikerjakan di sesi baru. Setiap rancangan dijadikan PR
tersendiri, sesuai kebiasaan proyek (satu ide = satu commit/PR,
disertai uji dan catatan di `IDE-PENGEMBANGAN.md`).

**Status per 4 Okt 2026 (pemutakhiran #5 rampung):**
- **#1, #2, #3, dan #4 telah rampung penuh** (PR #6 hingga PR #10).
- **#5 telah rampung penuh** — fondasi tempo map custom per ketuk/subdivisi
  dan ramp eksplisit lewat **PR #14** (`TempoTimeline`), lalu sisanya
  (garis waktu musik × drill, bantuan hitungan, pecah/gabung set) selesai
  4 Okt 2026 lengkap dengan uji murni + peramban.
- **#6 Rekaman lagu (MP3) telah rampung penuh** (PR #11 + susulan PR #12,
  28 Sep 2026).
- **#7 selesai (5 Okt 2026)** — satu pintu "Buka berkas DrillKit" (deteksi isi, pratinjau, pengarahan, tolak paket di mode pelatih), nama berkas jelas, Data sebagai pusat; **#8 menunggu**.
- **#9–#11 usulan baru** (grid/patok yard–meter custom, impor Pyware, partitur
  full score/per instrumen + latihan per bar/frasa) ditambahkan sebagai
  kandidat berikutnya; hanya roadmap/prioritas yang dirapikan, tanpa ubah kode.

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
| 5 | Drill × segmen lagu | Sedang | **Selesai (PR #14 + susulan 4 Okt 2026)** | Penggaris dua baris + ⚡, bantuan hitungan & Pas ke batas segmen, panjang segmen dalam hitungan, pecah/gabung set ber-riwayat; uji `segmen-drill-logika` 88 + `m1-penggaris-drill` 41 |
| 6 | Rekaman lagu (MP3) | Sedang–besar | **Selesai (PR #11 + susulan PR #12, 28 Sep 2026)** | Berkas Blob IndexedDB, sidik SHA-256, waveform & titik mulai, jam rekaman sinkron |
| 7 | Pengelolaan berkas ("Buka berkas DrillKit") | Sedang | **Selesai (5 Okt 2026)** | Pintu Data+Dasbor+seret, deteksi isi (5 JSON+CSV+ZIP), pratinjau selalu, tolak paket di pelatih, Data pusat |
| 8 | PIN pelatih tim | Kecil–sedang | **Menunggu** | Pagar mode pelatih via hash ENV; tanpa ketergantungan, bisa disisipkan kapan saja |
| 9 | Grid & patok yard–meter custom | Kecil–sedang | **Fondasi selesai (3 Okt 2026)** | Tipe, geometri & UI terpisah; yard↔meter tanpa geser; batas E/T26; 41 butir uji baru |
| 10 | Impor drill Pyware | Sedang | **Menunggu — jangan mulai pada tahap ini** | CSV koordinat Pyware → DrillKit, pencocokan anggota reuse #1, pratinjau & undo |
| 11 | Partitur full score / per instrumen + latihan per bar/frasa | Sedang–besar | **Menunggu — jangan mulai pada tahap ini** | MusicXML offline (OSMD) + PDF fallback, full score & part, highlight sinkron, loop bar/frasa |

> **Urutan prioritas yang disarankan pasca #5 rampung (4 Okt 2026):**
> **#10 → #11 → #8** (#7 selesai 5 Okt 2026) (fondasi #9 selesai; sisa polish tidak memblokir).
> Alasan: **#5** sudah rampung sehingga drill×musik benar-benar menyatu; **#7** merapikan 5 jenis berkas + ZIP rekaman
> sehingga impor Pyware (#10) dan MusicXML (#11) punya pintu masuk yang jelas;
> **#9** grid/patok kustom memberi akurasi lapangan sebelum migrasi massal;
> **#10** Pyware mempercepat migrasi tim yang sudah punya drill; **#11**
> partitur adalah fitur terbesar yang bertumpu pada TempoTimeline + rekaman +
> tempo latihan, sehingga wajar di akhir; **#8** PIN bersifat pagar dan dapat
> disisipkan kapan saja tanpa memblokir fitur musik/drill. **I1** (log perubahan
> show) tetap ditunda.

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

**Uji:** tanpa env = perilaku lama; PIN salah ditahan; PIN benar diingat
setelah dibuka ulang; ganti PIN menyebabkan ditanya lagi; keluar dari
mode anggota dengan PIN tim.

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
menambah jenis hash baru di luar NFHS/NCAA/NFL/none — juga tidak memulai impor Pyware/partitur.

**Uji (fondasi 3 Okt 2026):** `qa/grid-patok-logika.mjs` 41 butir — A=YL50 (0), B 5 yard (8×0.625) & A# 2.5 yard, T-T 5 yard, yard↔meter identik (geometri tidak geser), batas E & T26 memotong patok saja (grid tetap 21 garis, grid/subgrid/hash terpisah), metrik 5 m =5.468 yard ≠8 langkah/5 yard (8 langkah=4.572 m); `qa/uji-lapangan.mjs` 94 & `qa/lapangan-ui.mjs` tetap lulus.

### Status: Fondasi selesai (3 Okt 2026) — tanpa Pyware/partitur

Fondasi grid & patok diselesaikan tanpa menyentuh impor Pyware/partitur, sesuai instruksi. Yang dikerjakan: audit `field.ts`/`FieldConfigEditor`/`FieldSurface`/tipe, perbaikan `gantiSatuan` (hanya `patch({satuan})` — geometri tetap yard internal, konversi hanya tampil `*YD_TO_M`), pemisahan `gridUtama/subgrid/hash` (`gridTampil/subgridTampil/hashTampil/subgridYd`) dan `garis patok/label patok` (`tampilGaris/tampilLabel`), patok `daftarPatok` menghormati `maksHuruf` simetris (E=4 → A..E & E' simetris) & `maksT` per sumbu serta `satuanJarak: 'langkah'|'yard'` (8-to-5=8 langkah=5 yard=4.57 m, grid 5 m=5.468 yard beda fisik — tidak dipaksa snap), UI menjelaskan yard vs meter & pilihan jarak berbasis langkah vs yard, `typecheck` & regresi bersih.

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

---

## 11. Partitur full score & per instrumen + latihan per bar/frasa

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

### Status: #11a (22 Okt 2026) & #11b (23 Okt 2026) selesai; 11c–11d menyusul

Fondasi **#11a** (deteksi & pemindai ringkasan murni `partitur.ts`, store Blob `partiturBerkas` Dexie v10 + `Song.partitur`, pintu #7 `'partitur'` termasuk mode anggota, `PanelPartitur` + kuota/`persist()`, dan round-trip ZIP `partitur/…` + manifest) dan **#11b** (pengurai `.mxl` murni `mxl.ts` via Central Directory + `DecompressionStream`, *lazy-load* `opensheetmusicdisplay@2.2.1` di `partiturRender.ts` dengan render SVG bertahap berpalet hex `#ffffff`/`#0f172a` & transposisi `<score-timewise>`/entitas D4, serta `LayarPartitur` untuk kendali baca MusicXML + lembar PDF anti-buntu) telah selesai; diuji lewat `partitur-logika` (101), `partitur-zip-logika` (9), `mxl-logika` (42), `buka-berkas-logika` (140), `buka-berkas` (61), `partitur-impor` (61), dan `partitur-render` (40) — total regresi penuh **109 rangkaian**. Tahap berikutnya: **11c** part per instrumen + cetak hex, **11d** highlight sinkron `TempoTimeline` & loop frasa.

---

## Yang masih ditunda dari daftar lama

- **I1 — Log perubahan show** (siapa mengubah set apa dan kapan).
  Ditunda karena masalahnya belum pernah terjadi.


---

## Tempo map custom per hitungan dan ramp eksplisit — terintegrasi sebagian ke #5 (1 Okt 2026, PR #14)

> **Catatan pemutakhiran 3 Okt 2026:** bagian tempo map ini telah **terintegrasi
> sebagian ke #5 Drill × segmen lagu** sebagai fondasi `TempoTimeline`. Rincian
> status sisa #5 ada di **Rancangan lanjutan → #5** di atas. Pemutakhiran ini
> hanya merapikan roadmap; tidak ada perubahan kode.

Tempo map mendukung posisi 1-based pada **birama, ketuk tertulis, dan
subdivisi ketuk**. Ramp menyimpan jumlah hitungan secara eksplisit dan dapat
memakai satuan ketuk tertulis, ketuk acuan BPM, subdivisi, atau birama;
opsional, tempo awalnya juga dapat ditentukan.

Semantik ramp: count 0 adalah tempo tepat sebelum ramp; count 1 sudah
berubah sebesar 1/N; count N mencapai BPM target. Contoh uji:

- 160 → 180 selama 8 hitungan: **162,5; 165; 167,5; 170; 172,5; 175;
  177,5; 180 BPM**.
- 172 → 140 selama 6 hitungan: hitungan 1 sudah turun dan hitungan 6
  tepat mencapai 140 BPM.

`TempoTimeline` (`src/lib/tempoTimeline.ts`, `src/lib/tempoRamp.ts`) adalah
evaluator bersama untuk BPM, durasi dan konversi posisi/waktu. Metronom,
pemeriksaan klik MP3, pemetaan tempo serta klik per-hitungan drill,
waktu/progres lagu, rekaman, dan set list menggunakannya. Tempo map warisan
per birama tetap didukung; fitur posisi/ramp baru tidak mengubah data lama
yang tidak memakainya. Sisa pekerjaan #5 (garis waktu musik × drill, bantuan
hitungan, pecah/gabung set) akan memakai fondasi ini tanpa mengubah evaluator.

**Diuji lokal:** `npm run typecheck`, `npm run build`, dan `git diff --check`
lulus. Rangkaian terarah: `tempo-map-logika.mjs` 25, `perubahan-tempo-logika.mjs`
90, `uji-gabung-musik.mjs` 51, dan `uji-setlist.mjs` 107 — total **273 lulus,
0 gagal**. GitHub Actions/regresi penuh dan uji audio dengan aplikasi Sibelius
sendiri tidak dijalankan.
