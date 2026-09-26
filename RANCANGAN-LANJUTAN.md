# DrillKit — Rancangan lanjutan (hasil diskusi 26 Sep 2026)

Dokumen ini merangkum delapan rancangan yang sudah didiskusikan dan
diputuskan bersama pelatih. Semuanya siap dikerjakan di sesi baru.
Setiap rancangan dijadikan PR tersendiri, sesuai kebiasaan proyek
(satu ide = satu commit/PR, disertai uji dan catatan di
`IDE-PENGEMBANGAN.md`).

**Aturan proyek yang tetap berlaku untuk semuanya:**

- Tetap jalan **offline**, **tanpa server sendiri**, dan **tanpa biaya** (PWA).
- Warna untuk cetak/HTML hanya **hex/rgb**, tanpa `oklch()`/`color-mix()`,
  karena laptop lama memakai `DrillKit.html`.
- Mencetak tidak pernah buntu: selalu ada pratinjau atau unduh HTML.
- Dokumen dan antarmuka dalam **Bahasa Indonesia**.
- Uji qa memakai asersi dan diakhiri `N lulus, M gagal` + kode keluar,
  lalu didaftarkan di `qa/regresi-penuh.sh`.

## Urutan yang disarankan

| # | Rancangan | Ukuran | Bergantung / catatan |
|---|---|---|---|
| 1 | Satu anggota, dua nama | Sedang | **Paling mendesak**: data pelatih sudah telanjur ganda |
| 2 | Terbitkan ke anggota (2 PR) | Sedang–besar | Sesudah #1, supaya data pribadi menempel ke anggota yang benar |
| 3 | Jadwal: kalender & agenda | Sedang | Kalender anggota memakai data terkunci dari #2 |
| 4 | Tempo latihan | Kecil–sedang | Disatukan dengan pengatur kecepatan drill yang sudah ada (`view.cepat`) |
| 5 | Drill × segmen lagu | Sedang | Sebaiknya sesudah #4, karena keduanya menyentuh tempo di drill |
| 6 | Rekaman lagu (MP3) | Sedang–besar | Sesudah #4 dan #5 |
| 7 | Pengelolaan berkas ("Buka berkas DrillKit") | Sedang | Mengenali ZIP dari #6 bila sudah ada; memuat langkah pencocokan dari #1 |
| 8 | PIN pelatih tim | Kecil–sedang | |

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
   - Drill tanpa set yang melewati perubahan tempo tidak berubah.
   - Presenter menampilkan "Set 2 · hitungan 7/12 · birama 5" dan
     berkedip kecil saat tempo berubah.
4. **Pecah dan gabung set** (alat bantu, tidak pernah otomatis)
   - Pecah di batas segmen atau di hitungan tertentu. Posisi peralihan
     diambil dari jalur yang sudah ada (termasuk busur), jadi animasi
     tetap identik.
   - Gabung dengan set berikutnya.
   - Keduanya masuk riwayat formasi dan bisa di-undo.

**Uji:** set 2 dalam contoh berdurasi 5,25 detik; drill tanpa perubahan
tempo durasinya tetap; animasi identik setelah dipecah; garis waktu dan
⚡; Pas ke batas segmen; undo.

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

## Yang masih ditunda dari daftar lama

- **I1 — Log perubahan show** (siapa mengubah set apa dan kapan).
  Ditunda karena masalahnya belum pernah terjadi.
