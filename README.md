# DrillKit — Aplikasi Pelatih Marching Band

![CI](https://github.com/Kid10-test/DrillKit/actions/workflows/ci/badge.svg)

Aplikasi **all-in-one, gratis, dan offline-first** untuk pelatih marching band:
editor formasi/drill, data anggota, absensi QR, jadwal latihan, metronom + tempo map,
serta mode berbagi ke anggota.

> Status: **v0.1 — semua modul utama berfungsi** (dashboard, anggota, absensi, jadwal,
> drill & formasi, musik/metronom, berbagi/mode anggota, pengaturan & backup).
> Build produksi sudah lolos uji: service worker (PWA) terdaftar, semua halaman tanpa error.

**Mau langsung pakai?** Dua bundel sudah tersedia di folder proyek:

- **`drillkit-portable.zip`** — satu file `DrillKit.html`, **buka langsung di HP/laptop tanpa
  hosting**. Semua fitur jalan & data tersimpan, tapi belum bisa di-install/offline penuh.
- **`drillkit-release.zip`** — versi untuk **hosting gratis** (Netlify Drop/Vercel/GitHub Pages)
  supaya bisa di-install ke layar utama HP dan jalan offline. Panduan lengkap: [`DEPLOY.md`](DEPLOY.md).

---

## Kenapa begini bentuknya?

| Kebutuhan | Keputusan | Alasan |
|---|---|---|
| Harus gratis | **Tanpa server/backend** | Semua data di browser (IndexedDB). Nol biaya hosting, nol langganan. |
| Harus jalan di lapangan | **PWA + offline** | Bisa di-*install* ke layar utama HP; tetap terbuka tanpa sinyal. |
| Pelatih **dan** anggota | **Paket berbagi (file .json)** | Anggota tak perlu akun. Pelatih ekspor, anggota buka di HP masing-masing. |
| Bisa dikembangkan sendiri | **TypeScript + modul terpisah** | Kode rapi, ada komentar di bagian yang tidak biasa. |
| Kualitas terjamin | **Diuji dengan browser headless** | Alur utama (drag titik, ekspor/impor paket, absensi, mobile) diuji otomatis. |

---

## Menjalankan di komputer (development)

```bash
cd drillkit
npm install     # hanya sekali
npm run dev     # buka http://localhost:5173
```

Perintah lain:

```bash
npm run build            # versi hosting (PWA aktif)   → dist/
npm run build:portable   # satu berkas HTML portabel   → dist-standalone/index.html
npm run preview          # mencoba hasil build di http://localhost:4173
npx tsc --noEmit         # cek tipe TypeScript
```

---

## Struktur folder

```
drillkit/
├─ src/
│  ├─ main.tsx              # entry point (HashRouter → bisa dibuka dari hosting statis apa pun)
│  ├─ App.tsx               # daftar route + bootstrap pengaturan
│  ├─ index.css             # Tailwind + tema
│  ├─ db/
│  │  ├─ types.ts           # ⭐ semua bentuk data — mulai baca dari sini
│  │  ├─ db.ts              # skema IndexedDB (Dexie) + helper pengaturan
│  │  └─ seed.ts            # data contoh & util hapus data
│  ├─ lib/
│  │  ├─ kiosk.ts           # status kunci + penjaga global mode kios
│  │  ├─ feedback.ts        # bunyi & getar untuk pemindai QR
│  │  ├─ utils.ts           # format tanggal, CSV, ekspor file, warna section
│  │  ├─ field.ts           # ⭐ geometri lapangan & konversi yard ⇄ langkah
│  │  ├─ laporan.ts         # D4 — laporan bulanan, kartu kehadiran, CSV matriks/ringkas
│  │  ├─ tuner.ts           # E4 — deteksi nada dari mikrofon + nada dengung (drone)
│  │  ├─ panduan.ts         # F4 — penyusun panduan 1 halaman (dari data tim)
│  │  └─ shortcut.ts        # daftar shortcut editor (dipakai dialog ? & panduan)
│  ├─ hooks/useSettings.ts  # pembacaan data reaktif
│  ├─ components/
│  │  ├─ ui.tsx             # Button, Card, Modal, Toast, ErrorBoundary, …
│  │  ├─ Icons.tsx          # ikon SVG inline (tanpa CDN → aman offline)
│  │  ├─ AdminReports.tsx   # D4 — kartu "Paket laporan admin" di tab Rekap
│  │  ├─ TunerDrone.tsx     # E4 — penala & nada dengung di halaman Musik
│  │  └─ Panduan.tsx        # F4 — kartu & tombol "Panduan 1 halaman"
│  │  └─ Layout.tsx         # sidebar desktop + bottom nav mobile
│  └─ pages/                # satu file per menu
│     ├─ AttendanceRecap.tsx # rekap absensi (grafik, tabel, CSV, cetak)
│     ├─ Dashboard.tsx      # ringkasan: kehadiran, jadwal, komposisi tim
│     ├─ Members.tsx        # CRUD anggota, impor/ekspor CSV, kartu QR absensi
│     ├─ Attendance.tsx     # absensi cepat (H/I/S/A), buka pemindai QR, riwayat
│     ├─ KioskLock.tsx      # tombol kunci data, kartu PIN (mode kios)
│     ├─ Schedule.tsx       # jadwal + checklist materi + catatan evaluasi
│     ├─ Drill.tsx          # halaman drill (pilih drill; editornya di components/DrillEditor.tsx)
│     ├─ Music.tsx          # metronom, tap tempo, tempo map, repertoar (`hanyaPutar` = mode anggota)
│     ├─ Share.tsx          # ekspor paket tim + tampilan khusus anggota
│     └─ Settings.tsx       # profil tim, standar lapangan, backup/restore
├─ qa/                     # ⭐ 82 rangkaian uji regresi (Puppeteer) — lihat qa/README.md
│  ├─ regresi-penuh.sh     # menjalankan semuanya lawan versi yang sudah dibangun
│  ├─ pulihkan.sh          # pasang ulang node_modules & pustaka Chrome
│  └─ *.mjs                # satu berkas per rangkaian uji
├─ scripts/
│  └─ palette-hex.mjs      # konversi palet oklch Tailwind → heks (npm run palette)
├─ vite.config.ts          # build PWA (hosting)
├─ vite.config.portable.ts # build 1 berkas HTML (buka langsung dari file)
└─ public/                  # ikon PWA
```

---

## Konvensi data yang penting

### Koordinat formasi

Posisi disimpan dalam **yard** relatif ke titik tengah lapangan:

```
                    BACK SIDELINE  (y = +lebar/2)
        ┌────────────────────────────────────────┐
  S2 ←  │   ...   45   40   ...   50   ...       │  → S1
        └────────────────────────────────────────┘
                    FRONT SIDELINE (penonton, y = −lebar/2)

   x = memanjang lapangan (garis yard). 0 di garis 50, positif ke arah SIDE 1.
   y = melintang lapangan (sideline).   0 di tengah,  positif ke arah BACK SIDELINE.
```

* Di layar, chart ditampilkan **lanskap**: garis yard vertikal, **Side 1 di kiri**,
  **back sideline di atas**, **front sideline (penonton) di bawah** —
  sesuai kebiasaan bagan drill.
* Koordinat yang ditampilkan ke pemain dikonversi ke **langkah** sesuai ukuran
  langkah tim: `8-to-5` (5 yard per 8 langkah = 22,5") bawaan, bisa diganti
  `6-to-5`, `4-to-5`, atau ukuran khusus di **Pengaturan**.
* Contoh keterangan yang dihasilkan:
  `S1 · YL45 +1.5 · FH +2.75`
  = Side 1, garis 45 ditambah 1,5 langkah, 2,75 langkah **di belakang** front hash.

### Lapangan & patok

Selain standar football, aplikasi mendukung **lapangan cara Indonesia**:

* **Preset:** DCI/kampus, SMA/NFHS, Pro/NFL, tanpa hash, **Sepak bola (105 × 68 m)**,
  **Indoor/GOR (40 × 20 m)**, atau **kustom bebas** (panjang, lebar, dan jarak
  antar patok diatur sendiri).
* **Satuan** bisa **yard** atau **meter** — nilai tersimpan tetap yard, jadi
  drill yang dibuat sebelum fitur ini ada tetap terbaca persis seperti semula.
* **Patok** mengikuti kebiasaan tim. Bawaan: **`A` di titik tengah**, lalu
  keluar ke dua sisi — `# C # B # A # B # C #`. Pola lurus dari tepi
  (`A # B # C …`) juga tersedia. Jarak huruf→huruf, huruf→#, dan T→T diatur
  dalam **langkah**, dan patok huruf bisa dipasang di sumbu melintang atau
  membujur.
* Patok angka bisa ditulis **`T1`, `T2`** atau cukup **`1`, `2`**.
* Karena `A` di tengah, huruf yang sama ada di dua sisi. Bila perlu, satu sisi
  diberi tanda koma atas (`B'` · `B`) supaya tidak rancu di buku saku — tanda
  ini dipakai sampai ke `A` sendiri, jadi `A +2` berarti *dua langkah ke sisi
  S1 dari tengah*, sedangkan `A' +2` dua langkah ke sisi S2.
* **Tanda jarak selalu diukur dari A**, bukan dari tepi lapangan:
  **`−` mendekati A**, **`+` menjauhi A** — dan berlaku sama di dua sisi.
  Jadi `C −2` = dua langkah ke arah A dari patok C, entah C ada di sisi mana.
* **Garis lapangan** bisa ditampilkan semua, **tanpa garis tepi**, atau
  disembunyikan semua — berguna kalau garis asli lapangan sudah dicat.
* **Warna latar** bisa diganti: hijau, hijau tua, biru (indoor), abu-abu (GOR),
  cokelat (tanah), ungu. Semua warna hex murni, aman untuk browser lama.
* **Ukuran titik pemain mengikuti luas lapangan**, jadi tampak sama di layar
  baik di lapangan bola maupun GOR kecil. Kalau formasi terasa sesak, bisa
  diperkecil jadi 50–75%; kalau perlu menonjol, bisa dibesarkan sampai 200%.
* **Koordinat mengikuti patok** yang dipilih. Tepat di patok ditulis ringkas —
  `A6`, `B#8`; di antaranya ditulis dengan jaraknya — `A +1 · T6 +1.75`.
  Buku saku, dot sheet, dan lembar koordinat CSV ikut memakai format ini.
* **Titik menempel ke patok** saat digeser (bukan ke langkah), karena pemain
  berdiri di patok, bukan di antaranya.

Memilih preset DCI/NFHS/NFL/tanpa hash mengembalikan koordinat ke format
football lama: `S1 · YL45 +1.5 · FH +2.75`.

### Gerakan antar set

Cara pemain berpindah ke set berikutnya diatur **per set**:

* **Bentuk jalur** — lurus, **melengkung** dengan lengkungan −100% … +100%
  (melengkung ke kiri atau ke kanan terhadap arah gerak), atau **busur (putar)**.
  Jejak di layar ikut digambar mengikuti bentuknya.

  > **Busur dipakai kalau blok diputar.** Kalau pemain jalan lurus dari titik
  > awal ke titik akhir, yang mereka tempuh adalah *tali busur* — sehingga
  > formasi mengkerut di tengah jalan lalu mengembang lagi: putaran 45°
  > mengkerut sampai 92%, putaran 90° sampai **71%**. Dengan jalur busur,
  > radius setiap pemain tetap sama dari awal sampai akhir, jadi **jarak antar
  > pemain terjaga sepanjang perpindahan**.
* **Pembagian kecepatan** — `rata` (kecepatan tetap), `halus` (pelan di awal &
  akhir), `mulaiPelan`, atau `akhirPelan`.
* **Tunda mulai per section** (dalam count). Section yang ditunda diam beberapa
  count lebih dulu, lalu **mengejar** sehingga tetap tiba bersamaan di akhir.

Pengaturan ini tersimpan per set dan ikut dalam berbagi show, cadangan, dan
ekspor. Hitungannya hidup di `src/lib/gerak.ts` dan dipakai bersama oleh editor,
presenter, dan urutan latihan — jadi tidak mungkin berbeda satu sama lain.

### Alat gerak massa

Untuk mengubah banyak titik sekaligus, tersedia empat alat:

* **Putar blok** — 15°, 30°, 45°, atau 90°, mengitari titik tengah blok.
* **Kembang-kempis** — perkecil atau perbesar formasi 5%, 10%, atau 25%.
* **Cermin** — kiri ⇄ kanan, atau depan ⇄ belakang.
* **Geser blok** — 1, 2, 4, atau 8 langkah ke depan/belakang/Side 1/Side 2.

Kalau ada titik dipilih, perubahan hanya berlaku pada titik itu; kalau tidak ada
yang dipilih, berlaku untuk seluruh formasi di set itu. **Satu operasi = satu
langkah undo**, jadi sekali Ctrl+Z mengembalikan semuanya sekaligus.

Putaran 90° ikut memutar **arah hadap** pemain; pencerminan menukar
kiri ⇄ kanan dan depan ⇄ belakang. Putar dan kembang-kempis butuh **minimal 2
titik** — kalau cuma satu, titik itu sendiri adalah titik tengahnya, sehingga
tidak ada yang berubah.

### Detail per pemain

Pilih satu titik, lalu tombol **Detail** membuka panel riwayat pemain itu:

* Tiga angka ringkasan — **total langkah** sepanjang drill, **rata-rata
  langkah/menit**, dan **gerakan terberatnya** (berwarna sesuai kelasnya).
* Kalimat penunjuk set terberat, lengkap dengan tombol **Buka set itu**.
* Tabel semua perpindahan: `Perpindahan · Cnt · Langkah · Lk/cnt · Lk/mnt`,
  dengan kolom terakhir berwarna hijau → kuning → oranye → merah. Menyentuh
  salah satu baris langsung membuka set itu.
* **Instrumen / perlengkapan** bisa diedit dari sini — field yang sama dengan
  halaman Anggota, jadi tidak ada dua tempat untuk hal yang sama.

### Analitik gerakan

Setiap perpindahan dihitung **beratnya**, bukan hanya jaraknya. Ukurannya
**langkah per menit** — bukan langkah per hitungan — supaya tempo drill ikut
terhitung:

| Kelas | Langkah/menit | Artinya |
| --- | --- | --- |
| Nyaman | ≤ 120 | irama jalan biasa pada 120 BPM |
| Agak padat | 120 – 150 | masih bisa, tapi rapat |
| Berat | 150 – 180 | praktis harus setengah lari |
| Mustahil | > 180 | harus lari penuh — umumnya tidak bisa sambil membawa instrumen |

Dua hal dari DD2 ikut dihitung karena benar-benar menambah berat gerakan:

* **Jalur melengkung** menempuh jarak lebih panjang daripada garis lurusnya
  (lengkungan 100% ≈ 14,8% lebih jauh), walau titik awal & akhirnya sama.
* **Tunda mulai** memotong waktu yang tersedia, jadi kecepatannya naik walau
  jaraknya sama.

Hasilnya tampil sebagai ringkasan angka, batang per section, dan **peta
kesulitan** (jejak diwarnai hijau → kuning → oranye → merah). Hitungannya ada di
`src/lib/analitik.ts`.

### Section

Section **bisa diubah sendiri** di **Pengaturan → Section / kelompok instrumen**:
nama, singkatan, warna titik di chart, serta bisa disembunyikan (data anggotanya tetap aman).
Bawaan mengikuti istilah marching band: `Brass`, `Battery`, `Pit`, `Color Guard`, `FC`
(`Woodwind` dan `Lainnya` tersedia dan bisa dimunculkan/ditambah).

### Lainnya

* **Absensi** memakai 4 status: `hadir`, `izin`, `sakit`, `alpha`.
* Setiap anggota punya `token` acak untuk QR — bukan nomor urut, supaya tak bisa ditebak.
* Token QR **tidak pernah** ikut dalam paket berbagi; hanya perangkat pelatih yang perlu.

---

## Fitur per modul

**Drill & Formasi**
- Banyak drill (per show), masing-masing banyak **set**.
- **Ukuran lapangan per drill** dengan preset: DCI/kampus (hash 40′), SMA/NFHS (53′4″),
  Pro/NFL, tanpa hash, atau ukuran khusus — jadi tiap tahun/show boleh beda standar.
- Set baru otomatis menyalin set sebelumnya (alur kerja standar drill).
- Geser titik dengan mouse/jari, **snap ke grid langkah**, geser halus dengan panah keyboard
  (1 langkah, Shift = 4 langkah).
- **Pilih banyak titik**: seret kotak di area kosong lapangan, Shift + klik, atau Ctrl+A
  (Esc membatalkan pilihan).
- **Alat susun** untuk pilihan: sejajarkan (kiri/tengah/kanan/atas/tengah/bawah),
  ratakan jarak, putar 15°/90° (arah hadap ikut berputar), cermin kiri–kanan &
  depan–belakang di tempat.
- Bentuk cepat: blok, busur, lingkaran, garis.
- **Jejak gerakan & panah arah** (A5): **kuning** = dari mana pemain datang (set sebelumnya),
  **biru** = ke mana ia jalan (set berikutnya), lengkap dengan panah arah, **titik hantu** di posisi
  asal/tujuan, dan **angka jarak** tempuh dalam langkah. Semua bisa dihidupkan/dimatikan sendiri di
  panel **Alat**, dan pilihannya diingat. Kalau ada titik dipilih, jejak cuma digambar untuk titik
  itu — jadi mudah mengikuti satu pemain. Mode presenter ikut menampilkan panah & titik hantu.
- **Duplikat & salin set** (`src/components/CopySetModal.tsx`): tombol **Duplikat** menyalin set
  aktif **tepat di setelahnya** (bukan di akhir daftar). Tombol **Salin ke…** mengisi satu atau
  beberapa set lain dari set ini, dan **Ambil dari…** mengisi set ini dari set lain. Bisa pilih
  **semua titik** atau **hanya titik yang sedang dipilih**, serta cara mengisinya: **ganti isi**
  atau **tambahkan** (yang sudah ada di target dibiarkan). Seluruhnya bisa dibatalkan dengan
  **satu Ctrl+Z**, walaupun menyalin ke beberapa set sekaligus.
- **Undo/redo** (tombol ↶ ↷ atau Ctrl+Z / Ctrl+Shift+Z) sampai 50 langkah.
- Jalur gerak antar set, hitungan **count** per set, playback animasi mengikuti tempo.
- **Kontrol animasi** (bilah di bawah lapangan): **garis waktu** untuk melihat posisi di
  tengah perpindahan, **kecepatan 0,25×–2×**, **ulang terus** (tombol ↻ atau **L**),
  **mainkan hanya 1 section**, dan tombol ⏹ untuk kembali ke posisi awal. Kecepatan &
  ulang tersimpan, dan animasi 80 pemain tetap 60 fps.
- **Garis waktu melangkah per hitungan** (DD9): tombol **⌗ Per hitungan** membuat bilah
  waktu berhenti di tiap hitungan, bukan meluncur bebas — jadi pertanyaan *"di count 5
  pemain ini ada di mana?"* bisa dijawab dengan geser sekali. Tombol **,** dan **.**
  mundur/maju satu hitungan; keduanya otomatis memakai mode per hitungan.
- **Tapak langkah** (DD9): satu tanda di sepanjang jejak untuk **tiap satu langkah**,
  sehingga kelihatan berapa kali pemain melangkah dan seberapa panjang langkahnya.
  Jumlahnya mengikuti mode langkah — mode tetap menaruh tapak seukuran 22,5″, mode
  *ikut hitungan* menaruh tapak sesuai hitungan. Hanya digambar untuk pemain yang
  **dipilih**, supaya papan tidak penuh oleh ratusan tapak. Nyalakan lewat opsi
  **Tapak langkah** di panel kanan.
- Ekspor **PNG / SVG / cetak PDF** dan **lembar koordinat CSV** (siap dibagikan/dicetak).
- **Tukar formasi lewat CSV** (tombol **CSV**): unduh, edit di Excel, lalu impor balik.
  - **Formasi lebar** — satu baris per pemain, sepasang kolom `X`/`Y` tiap set. Ini bentuk
    yang enak diedit di Excel dan dipakai bertukar dengan aplikasi drill lain.
  - **Lembar koordinat (panjang)** — satu baris per pemain per set, enak dibaca & dicetak.
  - **Impor** menerima dua bentuk itu, plus berkas **tanpa judul kolom** (dipakai aturan
    posisi: kolom 1 kode, kolom 2 nama, lalu berpasangan). Pemisah koma, titik koma, atau
    tab dideteksi sendiri.
  - Angkanya bisa berupa **langkah, yard, atau meter**, dan Y bisa diukur dari garis
    belakang (bentuk ekspor DrillKit) maupun dari tengah lapangan.
  - **Aman**: sebelum dipakai selalu ada pratinjau (berapa set, berapa pemain cocok, berapa
    titik, dan baris yang tidak dikenal). Bawaannya **membuat set baru di akhir daftar**,
    jadi formasi yang sudah ada tidak pernah tertimpa tanpa diminta.
- **Penanda lapangan**: tanda yang bukan pemain — **titik/properti**, **kotak area**,
  **garis bantu**, **panah arah**, atau **teks**. Koordinatnya bisa diketik atau **dipetik
  langsung dari lapangan**; tersimpan per drill (tampil di semua set), ikut ke mode presenter,
  ekspor SVG, dan jadi tabel di dot sheet yang dicetak. Tombol **M** menyembunyikannya.
- **Mode presenter** (tombol ⛶ atau tombol **F**): formasi layar penuh untuk dipakai saat
  latihan — tombol besar, ketuk layar untuk maju, panah ←/→, Spasi memainkan pergerakan,
- **Mode urutan latihan** (B3): tombol **▶▶ Urutan latihan** (atau **R**) menjalankan
  **semua set berurutan** mengikuti tempo & count tiap set — benar-benar tanpa pegang HP.
  Ada chip **Diam 0/2/4/8 ct** (jeda di tiap formasi) dan **↻ Ulang urutan** untuk
  berputar terus. Ketuk layar atau tombol ‹ › langsung menghentikannya. Di editor tombol
  **▶▶** pada bilah animasi menjalankan hal yang sama.
  Esc menutup. Di HP yang dipegang tegak, lapangan otomatis diputar 90° agar lebih besar,
  dan layar ditahan supaya tidak mati (kalau browser mendukung).
- **Kunci layar presenter**: tombol **Kunci layar** menahan **sentuhan dan
  papan ketik** — supaya senggolan di lapangan tidak mengubah set yang
  sedang tampil. Animasi dan metronom tetap berjalan; yang ditahan hanya
  masukannya.
  - Papan ketik ikut ditahan karena **remote presenter mengirim tombol
    panah**; menahan sentuhan saja tidak akan mengunci apa-apa.
  - **Escape tetap bisa menutup presenter** — sengaja, supaya Anda tidak
    pernah terjebak di layar terkunci.
  - Kuncinya **tidak disimpan**: menutup presenter selalu membukanya, jadi
    PIN yang terlupa tidak pernah mengurung Anda.
  - Bila PIN kios sudah dipasang, PIN itu dipakai untuk membuka; tanpa PIN,
    cukup satu ketukan.
- **Shortcut keyboard** (lihat semuanya dengan tombol **?** di toolbar):
  `Panah` geser titik (±`Shift` = 4 langkah), `Spasi` mainkan/jeda perpindahan,
  `Ctrl+D` duplikat set, `[` / `]` pindah set, `Delete` keluarkan titik terpilih,
  `Ctrl+Z` / `Ctrl+Shift+Z` undo/redo, `Ctrl+A` pilih semua, `Esc` batal pilihan,
  `K` kode pemain, `J` jejak gerak, `M` penanda lapangan, `F` presenter, `?` daftar shortcut.
- **Dot sheet (A4)** per pemain: nomor set, count, koordinat, posisi X/Y dalam langkah,
  jarak & durasi gerakan — bisa cetak semua pemain sekaligus.
- **Buku saku (9,5 × 13,5 cm)** per pemain: ringkas berisi nomor set, count, koordinat,
  jumlah langkah berikut panah arah, **langkah per hitungan** (`Lk/cnt`), dan **ukuran
  langkah** — cocok dicetak, dipotong, lalu dibawa saat latihan.

  Dua kolom terakhir menjawab **dua pertanyaan yang berbeda**, karena itu keduanya
  dicetak bersamaan:
  - `Lk/cnt` → *“apakah aku harus berlari?”* Diwarnai dari **langkah per menit**.
  - `Ukuran langkah` (inci) → *“mampukah kakiku melangkah sejauh itu?”* Diwarnai
    dari panjang langkah: hijau sampai 22,5″ (8-to-5), kuning sampai 30″ (6-to-5),
    oranye sampai 45″ (4-to-5), merah di atasnya.

  Keduanya memakai hitungan yang sama dengan panel analitik, jadi sudah
  memperhitungkan jalur melengkung (jarak lebih jauh) dan tunda mulai per section
  (waktu lebih sedikit). Angkanya **diwarnai hanya kalau berat atau mustahil**,
  supaya tinta hemat; masing-masing bisa dimatikan lewat kotak centang di jendela cetak.
- **Dua cara menghitung langkah**, pilih sendiri mana yang dipakai:
  - **Ukuran langkah tetap** (bawaan) — panjang langkah dikunci 22,5″ (8-to-5).
    Jumlah langkah ditentukan **jaraknya**; yang menyesuaikan kecepatannya. Jarak
    dekat dalam hitungan panjang berarti jalan pelan, setengah langkah tiap hitungan.
  - **Langkah ikut hitungan** — jumlah langkah ditentukan **hitungannya**
    (1 langkah tiap hitungan, bisa diubah ½ / 1 / 2), lalu **panjang langkahnya**
    yang mengecil atau membesar. Ritme pemain tetap sama, yang menyesuaikan ukuran
    langkahnya — cocok kalau jaraknya terlalu dekat untuk hitungan yang disediakan.

  Bawaannya diatur **per drill**, dan bisa **ditimpa per pemain per perpindahan**
  dari panel **Detail** pemain: tiap baris gerakan punya tombol mode
  (`drill` → `tetap` → `hitungan` → `drill`). Berguna untuk mengecualikan satu
  gerakan tanpa mengubah seisi show.
- **Kompas & panah arah** di kepala buku saku. Karena koordinat saja tidak
  memberitahu arah jalan, kartu mencetak **mata angin kecil** sekali di atas
  tabel (`BELAKANG` · `PENONTON` · `S1` · `S2`) berikut keterangan singkat
  (`A` = tengah, `−` mendekati A, `+` menjauhi A, `C'` = C di seberang A).
  Dengan begitu setiap baris cukup memakai **satu panah** di kolom langkah —
  mis. `8 ↘` = delapan langkah ke arah kanan-bawah. Panahnya **mutlak**
  (mata angin), bukan sudut pandang pemain, jadi tidak berubah saat pemain
  menghadap lain. Bila tim tidak memakai patok, keterangan `A`/`−`/`+` otomatis
  disembunyikan dan hanya panah yang dicetak. Semua ini bisa dimatikan lewat
  kotak centang **“Sertakan kompas & panah arah”** di jendela cetak.

**Absensi**
- Ketuk H/I/S/A per anggota, “tandai semua hadir”, riwayat per anggota.
- **Scan QR beruntun** (`src/components/QrScanner.tsx`): kamera menyala terus, jadi
  satu kartu langsung ke kartu berikutnya tanpa menunggu kamera menyala lagi.
  Tiap kartu terbaca → bunyi "tit" + getar (bisa dimatikan lewat chip **Bunyi**/**Getar**),
  nama anggota muncul sebentar di layar, dan masuk ke daftar **Baru saja masuk**
  (ada tombol **Batalkan** kalau salah pindai). Kartu yang sama diabaikan selama
  4 detik supaya tidak dobel. Membutuhkan browser yang mendukung `BarcodeDetector`;
  kalau tidak tersedia, kamera tetap menyala dan tersedia kolom ketik kode/nama
  (Enter = tandai hadir).
- Rekap kehadiran 30 hari di dashboard, ekspor CSV.
- **Jenis kegiatan** (D3): tiap sesi ditandai *latihan rutin / latihan section /
  latihan gabungan / penampilan / rapat / lainnya*, lengkap dengan warna badge.
  Daftar sesi di tab **Isi absensi** bisa disaring menurut jenisnya.

**Rekap** (tab **Rekap** di menu Absensi)
- Filter **periode** (per bulan atau semua), **section**, dan **jenis kegiatan**
  (latihan rutin / latihan section / latihan gabungan / penampilan / rapat / lainnya).
- **Kartu "Kehadiran per jenis kegiatan"**: perbandingan persentase hadir antar jenis
  — misalnya latihan section 81% vs penampilan 31% — lengkap dengan jumlah sesinya.
  Blok yang sama ikut ke ekspor CSV dan hasil cetak.
- **Tren kehadiran per bulan** (`src/pages/AttendanceRecap.tsx`): batang per bulan + rata-rata
  6 bulan terakhir + arah (naik/turun/stabil). **Klik batangnya** untuk langsung memfilter rekap
  ke bulan itu (klik lagi untuk kembali ke semua).
- **Perbandingan antar bulan**: bulan terakhir dibanding bulan sebelumnya, lengkap dengan
  selisih poin dan jumlah sesinya.
- **Perlu perhatian**: ambang kehadiran rendah bisa diatur (<50/60/70/80%) dan anggota yang
  **mulai menurun** (turun ≥10 poin dibanding bulan sebelumnya) ditandai ⚠ — bisa disaring
  supaya cuma mereka yang tampil di tabel, dan diurutkan paling atas.
- **Grafik batang bertumpuk** kehadiran per sesi (hadir/izin/sakit/tanpa keterangan).
- Tabel **per anggota** (H/I/S/A + % kehadiran + kolom tren ↑↓) dan **per section**.
- Ekspor **CSV** dan **cetak** rekap (PDF lewat dialog cetak browser) — keduanya sudah
  memuat tabel tren per bulan dan daftar yang perlu perhatian.

**Laporan admin** (D4) — kartu **Paket laporan admin** di tab **Rekap**
- Alurnya: **Pratinjau** dulu (hasilnya tampil di dalam aplikasi, sama seperti
  buku saku di editor drill), lalu dari situ **Unduh HTML** atau **Cetak**.
- **Laporan bulanan siap serah**: kepala (nama tim + logo, periode, tanggal
  cetak), 7 kotak ringkasan, **kalimat ringkasan otomatis**, tabel per section /
  per jenis kegiatan / rincian per sesi / perlu perhatian / per anggota, dan
  **ruang tanda tangan** (Pembina & Pelatih).
- **Kartu kehadiran per anggota**: identitas, H/I/S/A + % kehadiran + predikat
  (Baik · Cukup · Perlu perhatian), rincian tiap sesi, keterangan pelatih, serta
  garis paraf. Bisa satu anggota atau semua anggota sekaligus.
- **Paket lengkap**: laporan + semua kartu dalam satu berkas HTML — tinggal
  kirim lewat WhatsApp, bisa dibuka & dicetak dari HP.
- **CSV matriks** (baris = anggota, kolom = sesi) dan **CSV ringkas** (satu
  tabel bersih) — keduanya ber-BOM UTF-8, rapi dibuka di Excel termasuk di HP.
- Semua mengikuti penyaring yang sedang aktif (periode, section, jenis kegiatan).
  Kode penyusunnya terpisah di `src/lib/laporan.ts`, jadi mudah diubah.

**Penala & nada dengung** (E4) — kartu di halaman Musik
- **Penala**: baca nada dari mikrofon, tampilkan nama nada (`A#4 / Bb4`),
  selisih dalam **sen**, dan jarum −50…+50 (zona hijau ±5 sen). Acuan A4 bisa
  diubah 438–445 Hz. Teruji dengan nada sintetis: **440 Hz → 0…+1 sen**,
  **Bb4 → 0…−1 sen**, **442 Hz pada acuan 440 → +8 sen**, **E2 82 Hz → ±4 sen**.
- **Nada dengung (drone)**: pilih nada & oktaf, bentuk bunyi, volume, plus
  tombol cepat **Bb / F / Eb / A konser**. Bisa ditambah **nada kelima** agar
  terdengar seperti harmoni band. Nada & volume bisa diubah sambil bunyi.
- Deteksi nada ada di `src/lib/tuner.ts` (korelasi silang + perbaikan oktaf +
  musyawarah 6 bacaan terakhir). Mikrofon dilepas saat berhenti/pindah halaman;
  kalau izin ditolak, pesannya ditulis dengan jelas.

**Musik & Metronom**
- Metronom Web Audio (dijadwalkan ke depan, jadi stabil), tempo map per birama, tap tempo,
  repertoar lagu.
- **Metronom lanjutan** (E3): **pola ritme & aksen per birama** — tiap kotak diklik bergilir
  *diam → biasa → aksen*, tiap birama boleh beda jumlah ketukan (2–12) & pembagian
  (penuh/setengah/triplet/1-16); **poliritme** (suara kedua, mis. 3 lawan 2); pilihan bunyi
  sintetis (klik / kayu / bel) + volume + getar.
  Pola tersimpan **per lagu**. Teruji: jarak antar ketukan 250 ms pada target 250 ms.
- **Accelerando & Ritardando** (N5): dua tombol — **Accelerando** (makin lama makin cepat)
  dan **Ritardando** (makin lama makin lambat). Yang diatur hanya **tujuan (BPM)** dan
  **berubah tiap berapa birama**; besar langkahnya **dihitung aplikasi**, lalu
  ditampilkan: *"Dari 120 ke 140 BPM — naik 2,5 BPM tiap 4 birama."* Menempel di kartu
  metronom, jadi **bisa dipakai anggota** — berlatih perubahan tempo justru paling
  sering dilakukan sendiri. Ini perilaku metronom di perangkat masing-masing, **bukan**
  data repertoar, jadi tidak mengubah apa pun yang dikirim pelatih.
  Tekan tombol yang sama sekali lagi untuk mengembalikan tempo jadi datar.
- **Ritardando / accelerando di antara dua segmen** (N6) — inilah yang
  paling sering dibutuhkan. Ketik tempo di dua segmen seperti biasa,
  lalu nyalakan **"Berangsur ke bar …"** pada segmen awalnya:
  ```
  bar 88 = 172  ←  nyalakan "Berangsur ke bar 91 (140 BPM)"
  bar 91 = 140
  maka bar 89 dan 90 MELUNCUR: 172 → 161,3 → 150,7 → 140
  ```
  Kalau tidak dinyalakan, bar 91 tetap **melompat** seperti sediakala —
  sehingga lagu yang sudah ada tidak pernah berubah perilakunya sendiri.
  Luncurannya linier dan ikut terbawa ke HP seluruh anggota.
- **Kolom ukuran lapangan tidak bisa dirusak tanpa sengaja**: mengosongkan
  kolom lebar, panjang, atau ukuran langkah tidak lagi membuat seluruh
  koordinat berubah `NaN` — nilai yang lama dipertahankan, dan end zone
  **tetap boleh 0** (lapangan bola & indoor).
- **Koordinat lapangan tidak pernah menyebut garis yang tidak ada**: pada
  lapangan **tanpa hash** (lapangan bola/indoor), koordinat diukur dari
  garis tepi, bukan dari "front hash" yang tidak tergambar di lapangan.
  Modul koordinat lapangan kini punya 88 butir uji logika, termasuk
  konvensi S1-di-kiri dan patok Indonesia (A di tengah, `B#` di antara
  dua huruf, jarak selalu diukur menjauhi A).
- **Anggota diberitahu bila ada versi baru** (N13): kalau situsnya
  memuat rilis yang lebih baru daripada yang sedang terbuka, muncul
  penanda *"Ada versi baru DrillKit"* dengan satu tombol **Muat ulang**,
  atau **Nanti** kalau sedang latihan. Tanpa ini, Anda mengunggah
  perbaikan lalu mengira unggahannya gagal — padahal perangkat itu
  hanya belum dimuat ulang. Aplikasi sengaja **tidak pernah** memuat
  ulang dirinya sendiri: memuat ulang otomatis akan mematikan metronom
  di tengah latihan. Karena itu keputusannya dikembalikan ke pemakai.
- **Aplikasi bisa memeriksa kesehatan situsnya sendiri** (N12): buka
  *Pengaturan → Kesehatan situs → Periksa sekarang*. Ia memeriksa
  apakah berkas yang diminta perambah benar-benar ada, apakah `sw.js`
  tidak boleh disimpan perambah, dan apakah `paket.json` masih ada —
  lalu menyebut berkas mana yang bermasalah beserta apa yang harus
  dilakukan. Hasilnya berlaku untuk **semua** perangkat yang membuka
  alamat yang sama, jadi pemeriksaan dari HP pelatih bisa menjelaskan
  mengapa HP anggotanya yang gagal. Ada juga versi terminalnya:
  `bash scripts/periksa-situs.sh https://situs-anda.netlify.app`.
- **Daftar lagu mengaku luncurannya** (N10): lagu yang berluncuran diberi
  lencana `luncur 172 → 140`, dan lencananya tampil **untuk anggota juga**.
  Tanpa itu sebuah lagu tertulis "120 BPM" di daftar padahal ia meluncur pada
  bar 88–91 — yang tahu hanya orang yang membuka editornya, padahal yang
  memutarnya belum tentu orang itu. Sentuh lencananya untuk melihat bar awal &
  bar tujuannya. Lagu tanpa luncuran tidak diberi lencana, supaya penandanya
  tidak menjadi kebisingan yang diabaikan.
- **Satu sumber kebenaran untuk tempo, di mana pun** (N9): pemetaan
  drill↔musik dan durasi set list pun memakai luncuran yang sama. Jadi drill
  yang ditautkan ke lagu berjalan mengikuti ritardandohnya, bukan mendahului
  musiknya; dan durasi yang tertulis di set list sama dengan yang dimainkan.
- **Angka temponya ikut bergerak, bukan diam** (N7). Panel lagu menampilkan
  tempo yang **benar-benar berbunyi** pada birama itu — jadi pada contoh di
  atas ia berjalan `172 → 161.3 → 150.7 → 140`, lengkap dengan keterangan
  *"berangsur ke bar 91 (140 BPM)"*. Desimalnya hanya muncul saat tempo
  sedang berada di antara dua angka yang diketik, jadi `172 BPM` tetap
  terbaca sebagai angka yang diketik pelatih.
  Durasi lagu, sisa waktu, dan batang progres pun ikut menghitung
  luncurannya: tiga birama yang melambat memang lebih panjang daripada
  tiga birama 172.
- **Kalau dua pengaturan tempo menyala bersamaan: yang lebih KHUSUS
  menang.** Luncuran per segmen lebih khusus daripada luncuran
  menyeluruh, jadi yang menyeluruh **dikesampingkan** — dan kedua tempat
  yang dikesampingkan **mengatakannya**, bukan diam saja. Tanpa aturan
  ini, luncuran yang diatur hati-hati bisa rata menjadi satu angka
  tanpa ada yang memberitahu.
- **Perubahan tempo TERSIMPAN DI LAGU**: di editor lagu ada bagian
  **Perubahan tempo lagu ini** — jadi sebuah lagu di repertoar bisa dibuat
  accelerando atau ritardando secara permanen. Karena tersimpan di dalam
  lagunya, ia **ikut terbawa ke HP seluruh anggota** setiap kali materi
  diterbitkan: satu band berlatih perubahan tempo yang sama, bukan
  masing-masing menebak sendiri. Daftar lagu menampilkan lencana
  `accelerando → 140` / `ritardando → 100`, dan lencananya tampil untuk
  anggota juga — mereka harus tahu **sebelum** memutarnya, bukan terkejut
  ketika temponya tiba-tiba naik sendiri.
- **Klik tempo saat latihan** (B5): tombol **Klik** di editor & chip **Klik** di presenter
  membuat metronom menyertai animasi dan mode urutan latihan — satu detak per count,
  aksen di count pertama tiap set. Bunyi berhenti bersama animasinya.
- **Tanda birama & hitung mundur** (M1): meter siap pakai maupun **kustom penuh** —
  pembilang 1–32 dan penyebut 1/2, 1/4, 1/8, 1/16, 1/32 — lengkap dengan
  **pengelompokan pulsa** yang menentukan letak aksen (7/8 bisa `2+2+3`, `2+3+2`,
  atau `3+2+2`; 5/8 `2+3` atau `3+2`). **Acuan tempo bebas dipilih** (not penuh …
  keenambelas, termasuk yang bertitik), dan ringkasannya menyebut lama satu birama
  dalam detik.
- **Hitung mundur (count-off)** sebelum lagu mulai: selalu **mengikuti birama pertama**
  yang dimainkan, bebas diulang 1–8 kali, menghitung **tiap pulsa** atau **tiap not**,
  dan bisa memakai **suara manusia** (ucapan bisa dikustom, mis. `siap, 1, 2`).
  Ucapan hanya lapisan di atas ketukan — ketukan pertama lagu tetap presisi.
- **Mulai dari birama berapa pun**: penghitung birama langsung mulai dari angka itu
  dan tempo map ikut dari segmen yang benar.
- **Begitu sebuah lagu dipilih, tempo map-nya langsung diikuti** (N8). Dulu
  pengaturan ini satu-satunya yang tidak ikut dimuat dari lagu, jadi tempo map
  sebuah lagu **tidak berbunyi** sampai pemakai menemukan sendiri pilihan
  "Ikuti tempo map" — termasuk untuk anggota yang menerima materi. Lebih gawat
  lagi, lagu yang sama mengikuti tempo map-nya kalau diputar dari set list dan
  mengabaikannya kalau diputar dengan tombol Mulai. Pilihannya tetap ada
  (praktik tempo datar tetap mungkin), dan panel tetap mengatakan keadaannya.
- **Sukat per segmen tempo**: tiap segmen tempo map bisa punya tanda birama sendiri,
  jadi lagu bisa berganti meter di tengah (4/4 → 7/8 → 4/4). Bawaannya
  **"Ikuti lagu"** — mewarisi tanda birama lagu — sehingga lagu yang meternya tetap
  tidak perlu mengisi segmen satu per satu. Hitung mundur pun mengikuti sukat
  **birama tempat lagu mulai**, bukan sukat awal lagu.
- **Panjang lagu** (M5): lagu bisa diberi panjang dalam **birama**. Durasi
  totalnya dihitung otomatis dari tempo map dan sukat, jadi pergantian sukat
  ikut terhitung. Metronom **berhenti sendiri** di birama terakhir, atau
  **mengulang** dari awal kalau tombol ulang dinyalakan. Lagu yang panjangnya
  belum diisi tetap berjalan tanpa akhir seperti sebelumnya.
- Selama lagu diputar tampil **birama keberapa dari berapa**, **sisa waktu**,
  dan **batang progres** yang dihitung dari waktu (bukan jumlah birama), supaya
  tidak melompat saat sukat berganti.
- Pemilih tanda birama dipakai **dua tempat** — metronom mandiri dan editor lagu —
  dengan pilihan yang sama persis, dan tersimpan **per lagu**.
- **Mode asisten di presenter**: saat urutan latihan berjalan, asisten
  mengumumkan tiap perpindahan — ke mana, berapa count, catatan yang Anda
  tulis pada set itu, dan section yang gerakannya paling berat — lalu
  menghitung mundur sebelum pemain bergerak.
- **Latihan per section**: pilih satu seksi di presenter, maka hanya seksi itu
  yang bergerak — sisanya tetap tampak, tapi diredupkan, supaya pemain masih
  melihat acuan posisi temannya alih-alih menonton mereka berbaris. Bisa
  dipadukan dengan **"Ulang terus"** untuk mengulang satu perpindahan tanpa
  maju, persis seperti pelatih berkata *"Battery, ulangi lagi."*
- **Tukar repertoar antar perangkat**: pindahkan lagu, set list, dan drill yang
  menautkannya ke perangkat pelatih lain lewat satu berkas — tanpa server.
  Berbeda dengan paket berbagi anggota, yang mengalir satu arah dan hanya bisa
  dibaca; berkas repertoar **langsung masuk ke pustaka** di perangkat tujuan.
  Id lagu tetap dipertahankan, jadi tautan drill ke lagu tidak putus.
- **Run sheet hari lomba**: seluruh sesi satu tanggal tersaji sebagai satu
  linimasa, lengkap dengan set list yang dibawakan di tiap slot — dan
  yang terpenting, **apakah isinya muat waktunya**. Set list 8 menit di slot
  5 menit bukan sekadar tidak nyaman; di banyak perlombaan itu penalti atau
  gugur. Sesi yang waktunya tumpang-tindih juga diperingatkan. Bisa diunduh
  atau dicetak untuk dibawa ke lapangan.
- **Mode lomba (layar hari H)**: tampilan besar untuk ruang persiapan — jam
  berjalan, sesi apa yang sedang berjalan dan berapa menit tersisa, hitung
  mundur ke sesi berikutnya, **set list penampilan terdekat** supaya pemain
  tahu apa yang disiapkan, dan daftar persiapan yang bisa dicentang.
  Peringatan dari run sheet tetap tampil, karena hari H adalah saat terakhir
  peringatan itu berguna.
- **Rencana latihan per sesi**: sebuah sesi dibagi menjadi blok waktu
  (pemanasan / section / gabungan / pendingin) beserta durasinya. Durasi
  disimpan per blok, jadi menggeser jam mulai sesi otomatis menggeser
  seluruh blok. Kalau total rencana melebihi slot sesinya, itu
  diperingatkan **sebelum** latihan dimulai.
- **Pacu latihan**: layar besar yang menemani latihan berjalan — blok mana
  yang sedang dikerjakan, berapa menit tersisa di blok itu, dan **berapa
  menit kita sudah melenceng** dari rencana. Keterlambatan ditunjukkan
  terakumulasi beserta proyeksi jam selesainya, karena yang paling rugi
  bukan blok yang molor, melainkan **blok terakhir yang kehabisan waktu**.
- **Penanda mulai & selesai sesi**: tombol **Mulai sesi** / **Selesai sesi**
  pada tiap jadwal (dan di layar Pacu) mencatat kapan latihan benar-benar
  mulai dan bubar. Ini **terpisah** dari blok pertama — sesi dimulai saat
  pelatih memanggil semua orang berkumpul, sedangkan blok pertama baru jalan
  saat pemanasan mulai; menyamakan keduanya menyembunyikan keterlambatan
  yang paling umum.
  - Rekap **Ketepatan waktu** di puncak halaman Jadwal merangkum
    keterlambatan dari beberapa sesi — satu sesi hanya bisa menggantung,
    baru beberapa sesi memberi pola.
  - **Yang belum ditandai tidak dihitung sebagai tepat waktu**, dan tidak
    ikut menarik rata-rata; sebaliknya **sesi yang belum terjadi tidak
    disebut "belum ditandai"**, karena itu tuduhan yang salah.
  - Lupa menekan tombol? Jam mulai & selesai bisa **diisi belakangan** pada
    tanggal sesinya.
- **Dasar jarak pilihan desainer**: jarak bisa dihitung sebagai **jarak tempuh
  kaki** (mengikuti kelengkungan jalur — bawaan) atau **garis lurus** dari
  titik awal ke akhir. Keduanya kebiasaan yang sah; yang menentukan desainer
  drill, bukan aplikasi. Pilihannya dipakai **dua permukaan sekaligus**:
  panel analitik dan buku saku yang dicetak untuk pemain.
- **Checklist kemajuan**: tiap set bisa ditandai sudah dikuasai, dan centangnya
  **tersimpan lintas sesi** — buka kembali drill yang sama minggu depan dan
  langsung tampak set mana yang masih kosong. Bisa per seksi juga, jadi
  "Brass sudah sampai set 7, Battery baru set 3" terbaca jelas. Baris
  kemajuannya sekaligus jadi penunjuk jalan: pip yang belum bercentang bisa
  diklik untuk melompat ke situ.
- **Kesulitan gerak yang konsisten**: analitik dan buku saku menilai dua
  hal yang sama — seberapa **cepat** kaki bergerak dan seberapa **jauh** satu
  langkah menjangkau — dan ambangnya bisa diatur di Pengaturan.
- **Rotasi lingkaran yang ikut berjalan**: blok diputar mengitari sebuah
  pusat, sementara pusatnya sendiri bergeser maju — formasi tetap utuh dan
  seluruh blok terbawa. Tujuannya bisa dihitung otomatis dari set berikutnya.
- **Ulang bagian** (M2): untuk berlatih bagian yang sulit, tentukan rentang
  birama (mis. 17–24) dan metronom mengulang bagian itu terus — **menang atas
  panjang lagu maupun tombol ulang**, jadi lagu tidak berhenti di akhir.
  Pemutaran langsung mulai di awal rentang, dan durasi satu putaran
  ditampilkan. Rentang tersimpan per lagu, dan rentang yang tidak masuk akal
  (terbalik, atau melebihi panjang lagu) ditolak dengan keterangan.
- **Set list** (M3): susun beberapa lagu menjadi satu urutan penampilan. Total
  durasinya dihitung otomatis, urutannya bisa dinaikkan/diturunkan, dan
  **metronom memutarnya berurutan tanpa henti** — begitu sebuah lagu habis ia
  pindah sendiri ke lagu berikutnya, dengan pengaturan lagu itu sendiri
  (tempo, sukat, tempo map, bunyi). Bisa juga mulai dari lagu mana saja di
  tengah. Lagu yang panjangnya belum diisi ditandai, dan totalnya disebut
  "perkiraan" sampai semua lagu terukur.
- **Mode lagu**: begitu sebuah lagu dipilih, kartu metronom berubah — muncul panel
  **Sedang diputar** (judul, birama berjalan, segmen aktif, sukat, tempo, lama satu
  birama, dan waktu berjalan `m:ss`) serta **strip segmen** yang bisa digulir dan
  diklik untuk loncat ke birama awal segmen itu, mirip strip set di editor drill.
- **Indikator ketuk** diperbesar dan bernomor: kotak yang sedang berbunyi diberi
  cincin, dan kotaknya **dikelompokkan sesuai sukat** — jadi 7/8 tampil sebagai
  `2+2+3`, bukan tujuh kotak rata.
- Tombol **Tambah segmen** tersedia di bawah daftar segmen juga, jadi mengisi banyak
  segmen tidak perlu menggulir kembali ke atas.
- **Tempo & segmen lagu dipakai drill**: di editor drill ada pilihan
  **Musik pengiring (opsional)**. Kalau drill ditautkan ke sebuah lagu, tiap set
  berjalan pada **tempo lagu di birama tempat set itu mulai** — birama awalnya
  dihitung dari jumlah count kumulatif memakai sukat lagu, jadi pergantian sukat
  lagu ikut menentukan berapa birama yang terlewati. Kartu tersebut menampilkan
  birama awal, tempo, sukat, dan durasi set yang sedang dipilih, plus ringkasan
  di set mana tempo berubah. Pemutaran, klik, presenter, dan peringatan
  "set terlalu berat" semuanya mengikuti tempo itu. Drill yang **tidak** ditautkan
  tetap memakai satu tempo datar seperti sebelumnya.

**Berbagi show antar pelatih** (F3)
- Tombol ⚙ di editor drill → kartu **Berbagi show dengan pelatih lain**: **Ekspor show**
  menghasilkan satu berkas `.json` berisi drill + semua set + lagu + anggota (token QR
  dibuang), dan **Impor show** membuka berkas dari pelatih lain.
- Saat show dengan id yang sama sudah ada, aplikasi bertanya dulu: **gabungkan set-nya**,
  **timpa show yang sama**, atau **simpan sebagai show baru**. Anggota & lagu yang sudah ada
  di perangkat tujuan tidak pernah ditimpa; anggota baru mendapat token QR sendiri.
- Untuk memindahkan *seluruh* data (semua drill, jadwal, absensi) gunakan backup di
  Pengaturan → Kelola data.

**Panduan 1 halaman** (F4)
- Tombol **Panduan** di Dashboard, dan kartu **Panduan 1 halaman** di Pengaturan
  (Pratinjau → Unduh HTML / Cetak, sama seperti buku saku & laporan).
- Isinya **dibuat otomatis dari data tim**: nama & logo tim, jumlah anggota,
  sesi, drill, lagu, daftar section, dan pengingat backup ikut tercetak.
- Berisi: enam langkah yang paling sering dipakai, isi tiap menu, 21 shortcut
  editor formasi (sumber sama dengan dialog `?`), empat cara mengatasi macet,
  dan catatan bahwa data tersimpan di perangkat.
- Teruji **benar-benar 1 halaman A4** — juga pada kasus terberat (nama tim
  panjang, 8 section, 80 anggota, 42 sesi).

**Berbagi**
- Pelatih membuat paket `.json` (jadwal, formasi, repertoar, absensi, evaluasi
  — bisa dipilih).
- Anggota membuka paket di HP-nya, memilih nama sekali, lalu melihat:
  **jadwal & materi**, **posisi formasinya sendiri** (ditandai emas + jarak langkah &
  durasi gerakan), **rekap kehadirannya**, dan **catatan evaluasi pribadi** dari pelatih.
- Tab **Formasi** anggota: tombol ‹ › besar untuk pindah set, koordinat & jumlah langkah,
  info **asal** (dari set sebelumnya) dan **tujuan** (gerakan ke set berikutnya),
  serta tombol **Putar** untuk melihat perpindahannya beranimasi — bisa dipakai belajar mandiri.
- **Catatan evaluasi** ditulis pelatih di **Anggota → edit anggota → Catatan evaluasi**,
  ikut terbawa ke paket berbagi, dan hanya bisa dibaca anggota yang bersangkutan.
- **Tab Musik & Metronom** juga tersedia untuk anggota: metronom, memilih dan
  memutar lagu, memutar set list berurutan, serta penala. Yang **tidak** ada:
  tambah/ubah/hapus lagu dan mengurutkan set list — repertoar itu milik pelatih.
  Tanpa batas ini, begitu anggota menekan **Perbarui**, perubahan yang ia buat
  lenyap tanpa ia mengerti mengapa. Tab ini bisa dibuka **walau belum memilih
  nama**: berlatih ketukan tidak perlu identitas.

**Memperbarui materi tanpa kirim ulang berkas**
- Terbitkan berkas **grup** (bukan berkas per anggota) di satu alamat tetap,
  bernama `paket.json`, sejajar dengan aplikasinya. Alamatnya sama untuk semua
  anggota dan tidak perlu berubah lagi.
- Anggota cukup menekan **Perbarui**. Tidak ada akun, tidak ada server.
- Yang diganti hanya **materi bersamanya** (tim, jadwal, formasi, repertoar).
  **Absensi dan catatan di HP anggota tidak pernah tersentuh** — tanpa
  penggabungan ini, setiap kali pelatih memperbarui materi, riwayat kehadiran
  setiap anggota ikut terhapus.
- Kalau gagal mengambil (alamat salah atau tidak ada sinyal), pesannya jujur
  dan salinan terakhir tetap ada di HP, jadi tetap bisa dipakai **luring**.
- Seluruhnya disembunyikan bila aplikasi dibuka dari berkas `file://`.
- **Satu kebiasan yang perlu diingat:** `paket.json` **tidak** ikut di dalam
  `dist/`, dan sebuah terbitan pada layanan tarik-dan-lepas adalah
  *penggantian*, bukan sinkronisasi — jadi mengunggah ulang isi `dist/`
  akan menghapus berkas materi yang sudah ada di situ. Unggah keduanya
  bersamaan, setiap kali. Rinciannya ada di **`DEPLOY.md`**.

### Evaluasi & kemajuan (menu Evaluasi)

Catatan bebas di atas berguna untuk merekam **peristiwa** ("terlambat 20
menit"). Yang tidak bisa dijawabnya adalah **bagaimana kemajuan anggota ini
dari waktu ke waktu** — itu butuh angka yang bisa dibandingkan. Menu ini
menjawabnya, tanpa menggantikan catatan bebas.

- Empat aspek, masing-masing 1–5: **teknik, musikalitas, kedisiplinan,
  kerjasama**. **Kehadiran sengaja tidak dinilai** — ia sudah diukur data
  absensi, dan menilainya lagi cuma menciptakan dua angka untuk satu hal.
- **Evaluasi parsial itu sah.** Menilai kerjasama tanpa menilai teknik tidak
  dipaksa dilengkapi; memaksa keempatnya terisi hanya menghasilkan angka
  asal-asalan.
- Tabel menampilkan **rata-rata terakhir**, **tren**, jumlah evaluasi, dan
  lencana **perlu perhatian**. Riwayat per anggota menyebutkan aspek mana
  yang dibandingkan.
- Anggota yang **belum pernah dinilai** tampil `—`, **bukan 0,0**, dan tidak
  masuk daftar "perlu perhatian" — nol adalah nilai terendah, bukan
  "belum dinilai".
- **Tren hanya dihitung pada aspek yang dinilai di kedua evaluasi**; kalau
  tidak ada irisan, tertulis **"belum bisa dibandingkan"**, bukan sebuah
  angka. Membandingkan rata-rata dari kumpulan aspek yang berbeda bisa
  membuat seseorang tampak "naik" hanya karena aspek tersulitnya tidak
  dinilai kali ini.

---

## Kinerja untuk tim besar (40–80 pemain)

Editor formasi sudah diuji sampai **160 pemain**. Kuncinya: saat menggeser
titik atau menjalankan animasi, aplikasi **tidak me-render ulang seluruh
tampilan** — titik digeser langsung lewat atribut `transform` pada elemen
`<g>`-nya, dan gerakan `pointermove` digabung (coalesce) per frame lewat
`requestAnimationFrame`. Render ulang React dan penulisan ke database terjadi
sekali, saat jari/mouse dilepas.

Hasilnya pada 80 pemain: menggeser titik dan animasi antar set sama-sama
**60 fps tanpa frame yang tersendat**.

## Catatan mencetak & mengunduh

Browser memblokir **jendela baru (cetak)** dan **unduhan** bila aplikasi dibuka **di dalam
iframe/pratinjau** — tombol cetak bisa terasa “tidak melakukan apa-apa”. DrillKit mendeteksi
situasi ini lalu:

1. Menampilkan **peringatan** di bagian atas.
2. Menyediakan tombol **Pratinjau** (hasil cetak tampil di dalam aplikasi).
3. Menyediakan tombol **Unduh HTML** — buka berkasnya di tab browser biasa lalu `Ctrl+P`.

Cara paling lancar: buka `DrillKit.html` (versi portabel) langsung di browser, atau
hosting-kan aplikasinya (lihat `DEPLOY.md`).

Sama seperti buku saku di editor drill, **laporan & kartu kehadiran juga punya
mode pratinjau**: hasilnya ditampilkan di dalam aplikasi, jadi tidak bergantung
pada jendela baru atau unduhan.

Semua hasil cetak — rekap absensi, **laporan bulanan**, maupun **kartu
kehadiran** — memakai jalan keluar yang sama (`printHtml` di `src/lib/print.ts`):
bila jendela cetak diblokir, berkas HTML-nya otomatis tersimpan dan muncul pesan
"Buka lalu Ctrl+P". Jadi tidak ada tombol cetak yang berujung pada layar diam.

## Dukungan browser

| Browser | Versi minimum |
| --- | --- |
| Chrome / Edge | 87+ |
| Firefox | 78+ |
| Safari (macOS & iOS) | 14+ |

Kenapa repot-repot? Tailwind v4 — kerangka CSS yang dipakai DrillKit —
menulis warna dengan `oklch()` dan membuat warna transparan dengan
`color-mix()`. Browser yang lebih lama dari **Chrome 111 / Safari 15.4 /
Firefox 113 tidak mengerti keduanya**. Begitu tidak dikenali, browser
membuang **seluruh deklarasi** itu — sehingga aplikasi tampil hanya sebagai
teks polos, tanpa warna dan tanpa latar gelap.

Karena itu dalam proyek ini:

- Palet warna ditulis sebagai **heks** dan ditandai `@theme inline`
  (lihat `src/index.css`), jadi utility class berisi `background-color:#0f172a`,
  bukan `var(--color-slate-900)`.
- CSS diturunkan oleh **Lightning CSS** (`css.transformer` di `vite.config.ts`)
  ke target browser lama, sehingga `color-mix(...)` otomatis memperoleh
  versi `rgba(...)`-nya.
- JavaScript juga diturunkan ke **ES2019**.

Daftar heksnya dibuat oleh `scripts/palette-hex.mjs` (`npm run palette`), yang
mengonversi palet asli Tailwind secara presisi — jadi tampilannya identik di
browser baru.

**Kalau aplikasi tetap tampil hanya teks:** periksa versi browser (buka
`chrome://version`), update lewat Play Store/App Store, atau pakai Chrome
terbaru. Kalau warna hanya hilang di komputer lain, itu tandanya browser di
komputer tersebut belum mendukung `oklch()`.

## Keamanan & backup

* Data **hanya** ada di perangkat/browser tempat dipakai.
* Karena itu **backup wajib**: **Pengaturan → Ekspor backup (JSON)**.
  Simpan di Drive/email. **Pulihkan backup** kalau ganti HP atau setelah membersihkan data browser.
* **Pengingat backup otomatis** (`src/lib/backup.ts`): kalau sudah lewat N hari sejak backup
  terakhir, sebuah kartu pengingat muncul di Dashboard — satu klik langsung mengunduh berkasnya.
  Intervalnya bisa diatur (Mati / 3 / 7 / 14 / 30 hari, bawaan **7 hari**) di
  **Pengaturan → Kelola data**, lengkap dengan **riwayat backup** (waktu, ukuran, isi).
  Catatan riwayat disimpan di `localStorage`, jadi tetap terbaca walau data utama hilang.
* **Pusat Data (menu Data)** — satu tempat untuk impor & ekspor seluruh fitur,
  dengan dua alur:
  - **Pindah data (JSON)**: pilih jenis datanya (lagu & set list & drill bisa
    dipilih satu per satu), unduh, lalu buka di perangkat lain. Berbeda dengan
    backup, yang selalu memuat segalanya sekaligus.
  - **Round-trip CSV** untuk **jadwal** dan **absensi** — ekspor, sunting
    massal di Excel, impor balik. Dua fitur ini sebelumnya hanya bisa
    diekspor tanpa bisa diimpor kembali.
* Dua aturan yang berlaku di Pusat Data:
  - **Bentrokan ditanyakan dulu.** Sebelum apa pun ditulis, tampilkan
    "N baru / M ditimpa" per jenis. Data yang sudah ada di perangkat
    **diganti**, dan suntingan lokalnya tidak bisa dikembalikan.
  - **Rujukan bersifat longgar.** Data DrillKit saling merujuk (jadwal
    menunjuk set list, absensi menunjuk sesi & anggota). Rujukan yang tidak
    ketemu **dikosongkan, bukan ditolak**, lalu dilaporkan — kehilangan data
    lebih buruk daripada rujukan yang putus, asalkan yang putus tidak
    diam-diam.
  - **Impor CSV menggabungkan, bukan menggantikan.** Berkas CSV hanya
    memuat sebagian kolom, jadi kolom yang tidak disebut **dipertahankan**
    dari data lama. Tanpa ini, menyunting satu judul lewat CSV akan
    menghapus materi latihan dan rencana latihan sesi itu tanpa kabar.
  - **Setiap tabel wajib ikut backup.** Daftar tabel dibaca langsung dari
    basis data oleh pengujian, sehingga tabel baru yang lupa didaftarkan
    akan menggagalkan uji — bukan menunggu seseorang kehilangan datanya
    saat memindahkan perangkat. (Hanya `settings` dan `packages` yang
    dikecualikan.)
* Beberapa hal **sengaja tidak** bisa diimpor: **rekap absensi & laporan**
  (data turunan yang dihitung, bukan data asli), serta **drill, set formasi,
  dan lagu** lewat CSV (bentuknya bersarang — tempo map, titik pemain —
  sehingga CSV akan membuang sebagian isinya; mereka memakai alur JSON yang
  tidak mengurangi apa pun).
* **Dua cara membagikan ke anggota** — karena **satu berkas untuk semua orang
  berarti data pribadi semua orang ikut di dalamnya**. Menyaring tampilan
  tidak mengatasinya: yang bocor adalah berkasnya, bukan layarnya.
  - **Berkas grup**: jadwal, formasi, repertoar — **tanpa** absensi &
    catatan siapa pun. Aman dibagikan ke mana saja, termasuk grup terbuka.
  - **Berkas per anggota**: satu ZIP berisi satu berkas per anak, sudah
    diberi namanya (`DrillKit-Andra-Pratama-A07.json`). Tiap berkas hanya
    memuat absensi & catatan **anak itu sendiri**. Butuh satu pesan per
    orang — itu biayanya, dan tertulis di layar.
  - Yang **tidak pernah** ikut ke mana pun: token QR absensi, nomor
    telepon, catatan pribadi pelatih, dan **nilai evaluasi** — yang sampai
    ke anggota hanya tulisan pelatih, bukan angkanya.
  - Berkas per anggota **langsung mengenali pemiliknya**: begitu dibuka,
    namanya sudah terpilih — tidak perlu memilih dari daftar 18 orang.
    Namanya disebut dengan jelas dan bisa diganti, jadi kalau berkasnya
    salah kirim, kesalahannya kelihatan.
* **Halaman pengantar sebelum masuk aplikasi.** Perangkat yang belum pernah
  memakai DrillKit tidak langsung melihat aplikasinya: ia melihat halaman
  pengantar yang menjelaskan apa DrillKit itu, lalu memilih **Saya pelatih**
  atau **Saya anggota**. Tanpa ini, perangkat baru langsung masuk mode
  pelatih, sehingga anggota yang baru saja disuruh membuka satu berkas malah
  melihat layar **ekspor** pelatih ("Unduh berkas grup", "Unduh per anggota
  (ZIP)") dan harus menemukan tombol "Lihat mode anggota" — yang namanya
  terdengar seperti milik pelatih.
  - Ditanyakan **sekali** lalu diingat di perangkat itu; tidak ditebak, karena
    menebak "pelatih" membuat setiap anggota mencari jalan keluar sendiri, dan
    menebak "anggota" mengurung Anda di perangkat sendiri.
  - **Tidak mengurung**: pilihan bisa dibalik kapan saja — dari mode anggota
    lewat tombol **Mode pelatih**, dari mode pelatih lewat menu **Berbagi**.
    Layar sambutannya sendiri mengatakan di mana mengubahnya nanti.
* Angka **Kehadiran** di HP anggota selalu menyertakan penyebutnya ("2 dari
  2 sesi yang dicatat"), dan sesi yang sudah lewat tanpa catatan ditandai
  **"Belum dicatat"** — bukan digabung ke "tidak hadir". Tanpa itu, pelatih
  yang mencatat 2 dari 5 sesi dan pelatih yang mencatat semua 5 sesi
  keduanya menampilkan **100%** bagi anggotanya. Bila belum ada catatan
  sama sekali, yang tampil adalah `—`, bukan `0%`: nol persen pada data yang
  kosong berbunyi sebagai tuduhan mangkir.
* Di HP anggota, menu otomatis disaring: yang tampil hanya **Tim saya**.
* **Mode anggota dikunci**: keluar ke mode pelatih memerlukan **PIN** (PIN
  kios yang sama). Rute pelatih pun dijaga — mengetik `#/pengaturan` di
  bilah alamat langsung dialihkan kembali, karena menyaring menu tanpa
  menjaga rutenya seperti menggembok pintu depan sambil membiarkan jendela
  terbuka.
  - Menyalakan mode anggota **menyarankan** memasang PIN lebih dulu. Bila
    PIN belum ada, keluar tetap diizinkan — sengaja, supaya Anda tidak
    pernah mengurung diri sendiri; antarmukanya mengatakan terus terang
    bahwa mode "belum dikunci".
  - Ini **pagar antarmuka, bukan pengaman**: yang ditahan adalah anggota
    yang tidak sengaja tersasar, bukan yang sengaja membongkar.
* Paket berbagi bersifat **salinan**: perubahan di HP anggota tidak kembali ke pelatih.
* **Tampilan kontras tinggi & huruf besar** (`src/lib/tampilan.ts` + aturan di
  `src/index.css`): dua saklar di **Pengaturan → Tampilan layar**, plus chip
  **Kontras**/**Huruf** di presenter untuk mengubahnya tanpa keluar dari layar
  latihan. Kontras tinggi menghitamkan latar, menerangkan teks kecil, dan
  mempertegas batas; huruf besar memperbesar seluruh antarmuka (16 → 19 px pada
  `<html>`, karena ukuran Tailwind memakai `rem`). Lapangan ikut menyesuaikan
  (rumput digelapkan, garis putih penuh) lewat CSS statis — tanpa filter, jadi
  animasi tetap ringan. Pilihannya disimpan di `localStorage`.
* **Mode kios / kunci data** (`src/lib/kiosk.ts` + `src/components/KioskLock.tsx`): kalau HP
  dipinjam anggota, aktifkan kunci dari tombol **Kunci data** (sidebar / header HP) atau
  **Pengaturan → Mode kios**.
  - **Kunci otomatis** (Pengaturan → Mode kios): kunci sendiri setelah 5–30 menit
    tanpa satu pun sentuhan. Bawaan **mati** dan hanya ditawarkan bila **PIN sudah
    terpasang** — tanpa PIN, kunci otomatis tidak melindungi apa pun karena siapa pun
    bisa membukanya lagi dengan satu tombol. Tidak pernah menyala saat presenter
    berjalan, dan sentuhan apa pun menyetel ulang waktunya. Selama terkunci, aplikasi cuma bisa dilihat: menjelajah menu,
  melihat formasi, **mode presenter**, dan metronom tetap jalan, sedangkan tombol yang mengubah
  data ditolak dengan pesan &ldquo;terkunci&rdquo;. Bisa dipasangi **PIN** (plus petunjuk) supaya
  tidak sembarang orang bisa membukanya. Kuncinya tetap aktif setelah aplikasi dimuat ulang.

---

## Catatan untuk pengembangan lanjut

* Menambah tabel baru: tambahkan di `src/db/db.ts` dengan `this.version(N).stores({...})`.
* **Jangan menulis (put/add/update) di dalam `useLiveQuery`** — ia berjalan di transaksi
  read-only dan akan memicu `ReadOnlyError`. Tulis cukup dari handler/aksi pengguna.
* Konversi koordinat terpusat di `src/lib/field.ts`; kalau mengubah tampilan papan,
  pastikan sumbu x = memanjang dan y = melintang (lihat bagian “Konvensi data”).

Ide lanjutan: undo/redo di editor, ekspor video animasi, cetak “dot sheet” per pemain,
sinkronisasi opsional, dan mode gelap/terang.
