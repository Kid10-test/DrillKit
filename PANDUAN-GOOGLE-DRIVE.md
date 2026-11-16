# Panduan Menyambungkan Google Drive ke DrillKit

Sejak v2.10.1 DrillKit bisa **mengambil rundown dari Google Docs**, **menarik isian
Google Form** (spreadsheet jawabannya) dan **mem-backup otomatis ke Drive**. Semua
fitur lain tetap jalan tanpa sambungan ini dan tanpa internet.

DrillKit tidak punya server. Browser yang meminta izin ke Google dan memanggil
Drive langsung, jadi Google perlu tahu "aplikasi" mana yang meminta. Untuk itu
pelatih membuat **satu proyek Google Cloud gratis** dan menyalin tiga pengenal ke
DrillKit. Cukup sekali, ±15 menit, dan tidak perlu kartu kredit.

> **Izinnya sempit (`drive.file`).** DrillKit hanya bisa membuka berkas yang kamu
> pilih sendiri lewat jendela pemilih Google, ditambah folder dan berkas backup
> yang ia buat sendiri. Isi Drive lainnya tidak terlihat sama sekali.

---

## 1. Buat proyek

1. Buka **console.cloud.google.com** dengan akun Google pelatih.
2. Pilih proyek di kiri atas → **New project** → nama `DrillKit` → **Create**.
3. Di **Dashboard** proyek (atau **IAM & Admin → Settings**), catat
   **Project number**. Isinya angka saja, misalnya `123456789012`. Ini berbeda
   dari *Project ID* yang bernama.

## 2. Aktifkan tiga API

Buka **APIs & Services → Library**, cari dan tekan **Enable** pada:

- **Google Drive API** untuk rundown, backup, dan membaca berkas.
- **Google Sheets API** untuk membaca tab jawaban Form.
- **Google Picker API** untuk jendela pemilih berkas.

Kalau DrillKit menampilkan *"API Google ini belum diaktifkan"*, langkah inilah
yang terlewat.

## 3. Layar izin (OAuth consent)

Buka **Google Auth Platform** (di menu lama namanya *OAuth consent screen*).

1. **Branding**: nama aplikasi `DrillKit`, email dukungan diisi email pelatih.
2. **Audience**: pilih **External** dan biarkan status **Testing**.
   Di **Test users** tambahkan setiap akun Google yang akan menyambung
   (pelatih, PH, asisten; maksimal 100).
3. **Data access** → **Add or remove scopes** → centang
   `.../auth/drive.file` → **Save**.

Proyek **tidak perlu diverifikasi** dan boleh tetap di mode Testing. Saat
menyambung, Google akan menampilkan *"Google hasn't verified this app"*. Tekan
**Continue**, karena aplikasinya milikmu sendiri.

## 4. Client ID

**Google Auth Platform → Clients → Create client**

- Application type: **Web application**
- **Authorized JavaScript origins**: `https://drill-kit.vercel.app`
  (tambahkan alamat lain bila DrillKit juga dibuka dari domain lain, misalnya
  Cloudflare Pages. Alamatnya harus persis, tanpa garis miring di akhir.)
- *Authorized redirect URIs* dikosongkan saja.

Salin **Client ID**, yang berakhiran `.apps.googleusercontent.com`.

## 5. API key

**APIs & Services → Credentials → Create credentials → API key**, lalu
**Edit API key**:

- *Application restrictions*: **Websites** → `https://drill-kit.vercel.app/*`
- *API restrictions*: **Restrict key** → **Google Picker API**

Salin key-nya, yang diawali `AIza…`. Key ini hanya dipakai jendela pemilih
berkas, dan pembatasan di atas membuatnya tidak berguna di situs lain.

## 6. Masukkan ke DrillKit

**Pengaturan → Google Drive → Atur**, lalu tempel **Client ID**,
**API key** dan **Nomor proyek** → **Simpan** → **Sambungkan**, lalu pilih akun
yang tadi didaftarkan sebagai test user.

DrillKit memeriksa bentuk pengenal sebelum disimpan, misalnya Client ID yang
tertukar dengan key, atau nomor proyek yang tidak cocok dengan angka di depan
Client ID. Kartu itu juga menampilkan alamat situs yang harus didaftarkan di
langkah 4.

---

## Sehari-hari

| Fitur | Di mana | Catatan |
|---|---|---|
| Rundown dari Docs/Sheets | Jadwal → Edit sesi → **Impor rundown → Google Drive** | Tautan disimpan. Kalau dokumennya diubah, DrillKit menandainya dan menawarkan **Ambil ulang**. |
| Tarik isian Form | Absensi → **Impor Form → Tarik isian terbaru** | Pilih spreadsheet jawaban sekali saja. Tab *Izin untuk DrillKit* dipilih sendiri dan pilihannya diingat per jenis. |
| Backup otomatis | Pengaturan → Google Drive → **Backup otomatis ke Drive** | Folder **DrillKit Backup**, satu berkas per hari (ditimpa bila ada perubahan), 14 hari terakhir disimpan. Diperiksa tiap 10 menit, dan hanya mengunggah bila isinya berubah. |

**Izin berlaku sekitar 1 jam.** Tanpa server, browser tidak boleh memegang izin
lebih lama. Sesudah itu cukup satu ketukan **Sambungkan** (tanpa kata sandi bila
masih masuk Google). Backup otomatis tidak pernah membuka jendela Google sendiri;
ia menunggu sampai kamu menyambung lagi.

## Bila ada kendala

| Pesan / gejala | Penyebab | Perbaikan |
|---|---|---|
| *Access blocked* / *akses diblokir* | Akun belum terdaftar sebagai test user | Langkah 3.2 |
| *origin_mismatch* / *redirect_uri_mismatch* | Alamat situs belum didaftarkan | Langkah 4 (salin alamat dari kartu) |
| *API … belum diaktifkan* | API belum aktif | Langkah 2 |
| Jendela pemilih kosong atau galat key | API key dibatasi untuk situs/API lain | Langkah 5 |
| Jendela Google tidak muncul | Pop-up diblokir browser | Izinkan pop-up untuk situs DrillKit |
| Tombol Drive abu-abu | Sedang offline | Tempel/unggah berkas tetap bisa |

## Privasi

- Pengenal Google disimpan di pengaturan perangkat ini dan **tidak ikut** paket
  Berbagi ke anggota.
- Izin akses hanya disimpan di tab yang sedang terbuka. Begitu tab ditutup,
  izinnya hilang.
- Memutus sambungan: **Pengaturan → Google Drive → Putuskan**. Untuk mencabut
  sepenuhnya, buka **myaccount.google.com → Keamanan → Aplikasi pihak ketiga**.
