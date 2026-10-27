# Panduan Upload DrillKit ke Hosting Gratis

Aplikasi ini **frontend saja** (tidak butuh server/ database), jadi bisa ditaruh di
layanan hosting statis gratis. Setelah online, kamu dan anggota tinggal buka linknya
dan bisa **install ke layar utama HP** (PWA) — tetap jalan offline.

> ⚠️ **Ingat:** data tersimpan **di browser masing-masing perangkat**, bukan di server.
> Jadi data pelatih dan data anggota terpisah. Pertukaran data tetap lewat menu
> **Berbagi** (ekspor/ impor paket `.json`) atau **Backup** di Pengaturan.

---

## Opsi cepat: **mode portabel**, tanpa hosting sama sekali

Kalau cuma mau mencoba atau memakai sendiri di HP/laptop lama, pakai **`drillkit-portable.zip`**.
Berkasnya berisi **satu file `DrillKit.html`** (~2,8 MB, sudah menyertakan mesin partitur MusicXML offline) — semua kode ditanam di
dalamnya, jadi tidak butuh server.

Cara pakai di HP Android:

1. Kirim `drillkit-portable.zip` ke HP (WhatsApp/email), lalu **ekstrak** (Files → *Extract*).
2. Buka `DrillKit.html` dengan **Chrome** — jangan lewat peragaan/pratinjau aplikasi lain.
3. Langsung bisa dipakai: data tersimpan di browser HP itu.

Yang perlu diketahui:

- ✅ Semua fitur jalan (formasi, absensi, jadwal, metronom, berbagi).
- ✅ Data tersimpan & tetap ada setelah ditutup.
- ❌ **Belum bisa di-install ke layar utama / dipakai saat benar-benar offline.**
  Itu butuh alamat HTTPS — tinggal lanjut ke salah satu opsi hosting di bawah
  (gratis, ±5 menit), tanpa perlu mengubah apa pun di aplikasi.
- Kalau muncul pesan *“Penyimpanan browser belum bisa dipakai”*, berarti berkas dibuka
  di dalam pratinjau/iframe atau mode penyamaran — buka di tab browser biasa.

> Tips: bookmark halamannya di Chrome HP supaya mudah dibuka lagi.

---

## Yang dilihat orang yang membuka tautan Anda

Begitu tautan dibuka di perangkat yang **belum pernah** memakai DrillKit, yang
muncul bukan aplikasinya, melainkan **halaman pengantar**: penjelasan singkat
apa DrillKit itu, lalu dua pilihan —

- **Saya pelatih** → masuk dengan semua menu pelatih.
- **Saya anggota** → masuk hanya dengan menu Tim saya.

Tiga hal yang perlu Anda tahu:

1. **Ditanyakan sekali saja.** Pilihannya tersimpan di perangkat itu. Anggota
   yang membuka tautannya besok lusa langsung masuk, tidak ditanya lagi.
2. **Tidak pernah dikira-kira.** Tidak ada mode bawaan untuk pengunjung baru,
   karena menebak "pelatih" membuat setiap anggota harus mencari jalan keluar
   sendiri.
3. **Bisa diubah.** Anggota lewat tombol **Mode pelatih**, pelatih lewat menu
   **Berbagi**. Jadi salah pilih tidak mengurung siapa pun.

Halaman ini **bagian dari aplikasi**, bukan berkas terpisah di depannya —
sengaja, supaya ia ikut tersimpan oleh service worker dan tetap terbuka saat
HP sedang tanpa kuota.

> Data tetap **tidak pernah** berpindah lewat tautan. Yang tersimpan di
> server hosting hanya berkas aplikasinya; data latihan Anda tetap di
> perangkat Anda sendiri, dan data anggota tetap di HP anggota.

---

## 0. Siapkan berkasnya (untuk di-hosting)

```bash
cd drillkit
npm install
npm run build     # hasilnya ada di folder dist/
```

Isi folder `dist/` (mis. `index.html`, `assets/`, `sw.js`, `manifest.webmanifest`,
`icon-192.png`, `icon-512.png`) itulah yang di-upload.

Tiga bundel sudah disiapkan di folder proyek, jadi tidak perlu build ulang:

- **`drillkit-release.zip`** → untuk di-hosting (isi = folder `dist/`).
- **`drillkit-siap-unggah.zip`** → folder `DrillKit/` siap seret ke Netlify Drop beserta pengingat `paket.json`.
- **`drillkit-portable.zip`** → satu file `portable/DrillKit.html`, bisa dibuka langsung (lihat “Opsi cepat” di atas).

Kalau ingin merakit ulang sendiri (termasuk memasang PIN pelatih tim opsional `#8`):

```bash
npm run build                    # versi untuk hosting  → dist/
npm run build:portable           # satu file HTML       → dist-standalone/index.html
PIN_PELATIH=1234 npm run build   # opsional: tanam pagar PIN pelatih tim saat build
bash scripts/siapkan-rilis.sh    # rakit ulang ketiga bundel .zip sekaligus
```

---

## 1. Netlify Drop — paling cepat, tanpa akun

1. Buka <https://app.netlify.com/drop>
2. Seret folder `dist/` (atau isi `release/`) ke kotak yang tersedia.
3. Tunggu ±30 detik → dapat link seperti `https://acak-12345.netlify.app`.
4. Buka link itu di HP → **Install aplikasi** / **Add to Home Screen**.
5. (Opsional) Masuk dengan akun gratis untuk mengganti alamat jadi
   misalnya `https://drillkit-gema-santi.netlify.app`.

File `netlify.toml` sudah disertakan, jadi kalau nanti mau hubungkan dengan
repository Git, pengaturannya otomatis benar.

---

## 2. Vercel — gratis, cocok kalau mau hubungkan Git

Cara paling mudah: impor repository-nya dari dashboard <https://vercel.com/new>,
lalu biarkan Vercel mendeteksi framework-nya (Vite). Tidak ada yang perlu
diisi manual.

Kalau lewat CLI:

```bash
npm i -g vercel
cd drillkit
vercel        # ikuti pertanyaan; framework detection: Vite
vercel --prod # untuk versi final
```

### Berkas `vercel.json`

Berkas ini disertakan supaya pengaturannya tidak perlu diisi ulang setiap
kali membuat proyek baru. Tiga baris pertama hanya menegaskan apa yang
memang sudah ditebak Vercel; yang **penting** ada dua:

1. **`installCommand`** memasang `PUPPETEER_SKIP_DOWNLOAD=1`. Tanpa itu,
   Vercel mengunduh peramban Chrome sebesar ~200 MB untuk `puppeteer`
   padahal peramban itu hanya dipakai rangkaian uji di folder `qa/`,
   bukan oleh aplikasinya.
2. **`headers`** menyalin aturan yang sama dengan `public/_headers`
   (berkas itu hanya dibaca Netlify, tidak dibaca Vercel). Isinya:
   `sw.js`, `registerSW.js`, dan `index.html` **jangan pernah
   disimpan** oleh peramban. Alasannya sama dengan keterangan panjang di
   `public/_headers` — setiap unggahan baru adalah PENGGANTIAN, dan
   peramban yang masih menyimpan `index.html` lama akan meminta berkas
   ber-hash yang sudah terhapus, lalu menampilkan "link rusak" padahal
   situsnya sehat.

Berkas ber-hash di dalam `/assets/` sengaja tidak diatur: namanya berubah
setiap kali isinya berubah, jadi aman disimpan lama.

### PIN pelatih tim (`PIN_PELATIH`) — langkah bergambar

Ini **pagar**, bukan brankas: HP anggota tetap tidak melihat data pelatih.
PIN membuat kartu **Saya pelatih** hanya bisa dilalui orang yang diberi
angkanya. Kalau dikosongkan, perilaku persis seperti sekarang
(termasuk `DrillKit.html` yang tidak dibuat ulang dengan PIN).

Anjuran: **minimal 6 angka**.

1. Buka proyek di Vercel → **Settings** → **Environment Variables**.
2. **Key:** `PIN_PELATIH` · **Value:** misalnya `246810` · centang
   Production (dan Preview bila ingin sama).
3. **Save**, lalu **Deployments** → menu `⋯` pada deployment terakhir →
   **Redeploy** (wajib: hash dibuat saat *build*, bukan saat orang membuka
   situs).
4. Setelah live: kartu **Saya pelatih** meminta PIN; **Saya anggota** tidak.
   Perangkat yang sudah lolos mengingatnya (offline pun). Mengganti nilai
   `PIN_PELATIH` lalu Redeploy membuat **semua** perangkat pelatih ditanya
   lagi — itu cara menutup akses pelatih yang sudah keluar.
5. Tombol **Mode pelatih** di mode anggota menerima PIN tim **atau** PIN
   kios perangkat (yang dipasang di Pengaturan).
6. Setelah **5 kali salah**, tombol Masuk jeda singkat (~2,5 detik).

Netlify: Site configuration → Environment variables → `PIN_PELATIH`, lalu
trigger deploy baru. Build lokal: `PIN_PELATIH=246810 npm run build`.
PIN polos **tidak** masuk bundle — yang disuntikkan hanya hash PBKDF2.

---

## 3. GitHub Pages — gratis selamanya lewat repository

1. Buat repository di GitHub, lalu push isi proyek ini.
2. Di `vite.config.ts`, tambahkan `base` sesuai nama repository:

   ```ts
   export default defineConfig({
     base: '/nama-repo/',   // ganti dengan nama repositorymu
     plugins: [ /* ... */ ],
   })
   ```

3. Tambahkan file `.github/workflows/deploy.yml`:

   ```yaml
   name: Deploy
   on:
     push:
       branches: [main]
   jobs:
     build:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-node@v4
           with: { node-version: 20 }
         - run: npm ci
         - run: npm run build
         - uses: peaceiris/actions-gh-pages@v4
           with:
             github_token: ${{ secrets.GITHUB_TOKEN }}
             publish_dir: ./dist
   ```

4. Aktifkan **Settings → Pages → Source: gh-pages branch**.
5. Alamatnya: `https://username.github.io/nama-repo/`.

---

## 4. Sekadar mau dicoba di komputer/laptop

```bash
npm run build
npm run preview      # buka http://localhost:4173
```

---

## Sudah diunggah tapi tidak ada yang berubah?

Ini kejadian yang paling sering, dan hampir selalu **bukan** kesalahan
Anda. Penyebabnya: aplikasi disimpan di perangkat oleh *service worker*
supaya bisa dipakai luring. Akibatnya, setelah Anda mengunggah rilis baru,
perangkat Anda bisa saja masih menjalankan **rilis yang lama**.

**Cara memastikannya** — buka menu **Pengaturan**, lihat kartu **"Rilis
yang sedang berjalan"**:

> Dibangun **22 Sep 2026, 04.11**

Bandingkan tanggalnya dengan rilis terakhir yang Anda unggah.

- **Tanggalnya SUDAH baru** → rilisnya benar-benar sudah berganti. Bila
  fiturnya tetap tidak tampak, berarti letaknya yang berbeda dari dugaan
  Anda, bukan versinya.
- **Tanggalnya MASIH lama** → perangkat ini masih memakai simpanan lama.
  **Tutup aplikasinya sampai benar-benar berhenti, lalu buka kembali.**
  Di HP sering kali harus ditutup dari daftar aplikasi, bukan sekadar
  diminimalkan. Atau buka di **jendela penyamaran** untuk memastikan.

**Berkas latihan Anda tidak akan hilang karenanya.** Menutup aplikasi
hanya membuang simpanan tampilannya; data tersimpan di perangkat, dan
tidak ikut terunggah ke mana pun.

---

## Memperbarui MATERI tanpa mengunggah ulang aplikasi

Ini jalan yang lebih hemat, dan biasanya yang Anda inginkan: jadwal atau
formasi berubah, tetapi aplikasinya sendiri tidak.

1. Di aplikasi, buka menu **Berbagi**.
2. Unduh **berkas grup** (bukan berkas per anggota).
3. Ganti namanya menjadi persis **`paket.json`**.
4. Unggah ke folder yang **sama** dengan `index.html` aplikasi Anda.
5. Anggota cukup menekan **Perbarui** di HP-nya. Sekali ketuk, tanpa berkas.

Alamatnya tidak berubah lagi setelah ini. Yang Anda unggah ulang kelak
cukup isi `paket.json`-nya.

> **⚠ Jebakan yang paling sering menghentikan alur ini.**
>
> Mengunggah ulang isi `dist/` akan **menghapus** `paket.json` yang sudah
> Anda taruh di situ. `paket.json` memang tidak ada di dalam `dist/` — Anda
> yang menambahkannya sendiri — sedangkan sebuah terbitan pada layanan
> tarik-dan-lepas adalah **penggantian**, bukan sinkronisasi: apa yang ada
> di dalam folder menjadi situsnya, dan apa yang tidak ada di dalamnya
> berhenti ada.
>
> Karena itu, biasakan satu kebiasan: **unggah `paket.json` bersama-sama
> dengan isi `dist/`, setiap kali.** Bila lupa, tombol Perbarui di HP
> anggota akan berhenti bekerja tanpa ada yang rusak di aplikasinya —
> dan pesannya memang akan menyebut kemungkinan ini.

## Memperbarui situs yang sudah terbit

Unggah ulang isi `dist/` (atau `release/`) dengan cara yang sama seperti
pertama kali — ke Netlify Drop, seret foldernya lagi ke situs yang sudah ada.

Yang sering membingungkan setelah pembaruan:

- **Pengunjung lama bisa saja masih melihat versi sebelumnya.** Service worker
  menyimpan aplikasi di perangkatnya. DrillKit memakai `autoUpdate`, jadi
  versi baru diambil pada kunjungan berikutnya — tetapi di HP sering perlu
  **ditutup lalu dibuka kembali** (atau ditarik ulang sekali) sebelum
  pergantiannya kelihatan.
- **Pilihan mode tidak ikut berubah.** Kalau sebuah perangkat sudah memilih
  "anggota", ia tetap anggota setelah pembaruan — halaman pengantar tidak
  akan muncul lagi di situ. Untuk melihat halaman pengantarnya lagi, buka di
  jendela penyamaran atau hapus data situsnya.
- **Data tidak ikut terunggah dan tidak ikut terhapus.** Memperbarui berkas
  aplikasi tidak menyentuh data latihan yang tersimpan di perangkat.

---

## Checklist sebelum dibagikan ke anggota

- [ ] Buka tautannya di **jendela penyamaran** — halaman pengantarnya harus
      muncul, lengkap dengan dua pilihan pelatih/anggota.
- [ ] Buka aplikasinya di HP, coba semua menu.
- [ ] **Install ke layar utama**, lalu matikan internet dan buka lagi — harusnya tetap jalan.
- [ ] Isi data anggota (atau impor CSV).
- [ ] Atur standar lapangan di **Pengaturan** (hash & ukuran langkah).
- [ ] Buat drill & set formasi, lalu ekspor **paket berbagi** dan kirim ke grup tim.
- [ ] **Kalau memakai tombol Perbarui:** ekspor berkas **grup**, ganti nama
      jadi `paket.json`, unggah sejajar dengan `index.html`, lalu coba tekan
      **Perbarui** dari HP. Ingat: `paket.json` ikut diunggah ulang setiap
      kali Anda memperbarui aplikasinya.
- [ ] **Ekspor backup** secara berkala — data tidak ada di server, jadi backup adalah
      satu-satunya jaring pengaman.

## Bila ada yang melapor "link rusak"

Gejalanya: sebagian pemakai — terutama iPhone/iPad (Safari) dan Mac
(Safari) — membuka tautan dan mendapat halaman Netlify:

> **Page not found** — Looks like you've followed a broken link or
> entered a URL that doesn't exist on this site.

Padahal di perangkat lain tautannya baik-baik saja.

### Mengapa bisa begitu

Sekali unggah ke Netlify adalah **penggantian, bukan penambahan**: berkas
ber-hash yang lama ikut terhapus dari situs. Sementara itu perambah
bisa saja masih menyimpan `index.html` lama berikut `sw.js` lama.
Perambah itu lalu meminta berkas ber-hash yang sudah tidak ada,
menerima 404, dan menampilkan halaman di atas.

Yang paling sering kena justru pemakai yang **pernah membuka tautannya
sebelum unggahan terakhir** — bukan pemakai baru. Itu sebabnya
gejalanya tampak "acak" dan seolah khusus iOS/Mac: Safari memegang
pekerja layanannya jauh lebih lama daripada Chrome di Android.

### Yang bisa dilakukan pemakainya (tanpa ganti apa pun di aplikasi)

Begitu DrillKit versi ini terunggah, aplikasi yang gagal dimuat akan
menampilkan sendiri panel:

> **Aplikasi gagal dimuat** — ini hampir selalu karena peramban
> menyimpan versi lama DrillKit… **[ Bersihkan & muat ulang ]**

Satu sentuh pada tombol itu membuang pekerja layanan dan simpanan
lamanya di perangkat tersebut, lalu membuka aplikasinya kembali.
**Data di dalam aplikasi tidak ikut terhapus.**

Kalau panelnya tidak muncul (misalnya pemakai memakai versi lama
sebelum panel ini ada), jalan keluarnya manual:

- **iPhone/iPad (Safari):** Pengaturan → Safari → *Hapus Riwayat dan
  Data Situs Web*. Bila DrillKit pernah ditambahkan ke Layar Utama,
  hapus ikonnya dulu, lalu buka kembali tautannya.
- **Mac (Safari):** Safari → Pengaturan → Privasi → *Kelola Data Situs
  Web…* → cari alamatnya → *Hapus*. Atau `⌘⌥E` lalu muat ulang.

### Pencegahannya (sudah termasuk dalam hasil build)

Dua berkas kini ikut ke dalam folder unggah:

| Berkas       | Isinya                                                  |
|--------------|---------------------------------------------------------|
| `_headers`   | `sw.js`, `registerSW.js`, dan `index.html` **tidak boleh** disimpan CDN maupun perambah |
| `_redirects` | `/* /index.html 200` — pengaman bila ada yang meminta berkas yang sudah tiada |

Berkas yang benar-benar ada **tidak pernah** tertimpa aturan
`_redirects` (aturan Netlify: *you can't shadow an existing URL by
default*), jadi `paket.json` dan `assets/*` tetap terlayani seperti
biasa — tombol *Perbarui materi* tidak tersentuh.

### Periksa dari dalam aplikasi — tanpa terminal

Buka **Pengaturan → Kesehatan situs → Periksa sekarang**. Aplikasi
memeriksa sendiri situsnya dan menampilkan hasilnya, lengkap dengan
apa yang harus dilakukan bila ada yang tidak beres.

Ini jalur yang paling mudah: tidak butuh terminal, tidak butuh `curl`,
dan bisa dijalankan dari HP Anda sendiri. Hasilnya bersifat **situs**,
bukan perangkat — jadi pemeriksaan dari HP Anda bisa menjelaskan
mengapa HP anggota yang gagal.

### Periksa sendiri dengan SATU perintah (butuh terminal)


```bash
bash scripts/periksa-situs.sh https://nama-situs-anda.netlify.app
```

Skrip itu memeriksa lima hal dan menyebut berkas mana yang bermasalah:

| Yang diperiksa                     | Bila gagal                                             |
|------------------------------------|--------------------------------------------------------|
| Halaman utama menjawab 200 & HTML  | Alamatnya salah, atau folder yang terunggah salah tingkat |
| `index.html` & `sw.js` tidak disimpan perambah | `_headers` belum berlaku — penyebab utama "link rusak" |
| **Setiap berkas `assets/` yang disebut `index.html` benar-benar ada** | Unggahannya tidak lengkap; pemakai lama melihat "link rusak" |
| `paket.json` ada & berbentuk JSON  | Berkas materi ikut terhapus — tombol *Perbarui* anggota mati |
| Alamat yang tidak ada dikembalikan ke aplikasi | `_redirects` belum berlaku |

Keluar dengan kode `1` bila ada yang gagal, jadi bisa dijalankan
otomatis setiap kali selesai mengunggah.

### Atau periksa sendiri dengan curl

Ganti `ALAMAT` dengan alamat situs Anda:

```bash
curl -sI ALAMAT/              # harusnya 200
curl -s  ALAMAT/index.html | grep -o 'assets/index-[^"]*'
curl -sI ALAMAT/sw.js | grep -i cache-control   # harusnya no-store
```

Bila `sw.js` tidak berisi `no-store`, berarti folder yang terunggah
**belum** memuat `_headers` — jalankan `bash scripts/siapkan-unggah.sh`
ulang, lalu seret ulang `unggah/DrillKit/`. Ingat: unggahan adalah
penggantian, jadi **taruh `paket.json` kembali** ke dalam foldernya
sebelum menyeret.
