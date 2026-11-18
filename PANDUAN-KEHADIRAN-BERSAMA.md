# Panduan Kehadiran Bersama (Supabase + login Google)

Sejak v2.14.0 pemilik, danlat, pencatat, dan PH/asisten bisa memakai **satu daftar
kehadiran yang sama**. Masing-masing masuk dengan akun Google sendiri, dan pemilik
menentukan perannya. Semua fitur DrillKit lain tetap berjalan di perangkat dan tetap
bisa dipakai tanpa sinyal.

| Peran | Yang bisa dilakukan |
|---|---|
| **Pemilik** | Mengatur anggota, sesi, dan aturan; mengundang staf; mengisi dan memutus kehadiran. |
| **Danlat** | Mengisi kehadiran dan memutus izin, sakit, telat, serta pulang awal. |
| **Pencatat** | Mengisi kehadiran (H/I/S/A, jam datang dan pulang). Putusan yang ia ubah dibuang server. |
| **PH & asisten** | Melihat kehadiran dan rekap saja. Isian di perangkatnya dikembalikan ke versi server. |

**Yang dikirim ke server hanya:** daftar anggota (nama, panggilan, kode, section,
instrumen, status aktif), daftar sesi (judul, tanggal, jam, tempat, isian Form
presensi), aturan program latihan, dan catatan kehadiran. Nomor HP, kartu medis,
kas, nilai, drill, musik, rundown, dan token QR anggota **tidak pernah** ikut.
Daftar putihnya ada di `src/lib/kehadiranBersama.ts` (`dataAnggota`, `dataSesi`).

Hak akses dijaga oleh server (Row Level Security di Postgres), bukan oleh aplikasi.
Orang yang tidak diundang tidak bisa membaca apa pun, sekalipun berhasil masuk
dengan akun Google.

---

## 1. Pasang tabel di Supabase (sekali)

1. Buka proyek di **supabase.com** → **SQL Editor** → **New query**.
2. Tempel seluruh isi `supabase/v2.14.0-kehadiran-bersama.sql` → **Run**.
   Hasilnya *Success. No rows returned*. Berkas ini aman dijalankan ulang.
3. Masih di SQL Editor, jalankan dua baris pemilik yang ada di bagian paling bawah
   berkas itu. Hapus tanda `--` di depannya dan ganti `email-pemilik@gmail.com`
   dengan email Google pemilik, **huruf kecil semua**:

   ```sql
   insert into public.tim (id, nama)
     values ('00000000-0000-4000-8000-000000000001', 'Tim DrillKit') on conflict (id) do nothing;
   insert into public.staf_tim (tim_id, email, peran, nama)
     values ('00000000-0000-4000-8000-000000000001', 'email-pemilik@gmail.com', 'pemilik', 'Pemilik')
     on conflict (tim_id, email) do nothing;
   ```

   Nama tim boleh diganti. Email pemilik sengaja tidak ditulis di repo.

## 2. Nyalakan login Google di Supabase

1. **Google Cloud Console** → **Google Auth Platform** → **Clients** → client web
   "DrillKit Supabase":
   - **Authorized JavaScript origins:** `https://drill-kit.vercel.app`
   - **Authorized redirect URIs:** `https://<ref>.supabase.co/auth/v1/callback`
     (tersedia di Supabase › Authentication › Sign In / Providers › Google)
2. Supabase → **Authentication** → **Sign In / Providers** → **Google** → nyalakan,
   tempel **Client ID** dan **Client Secret** dari client di atas → **Save**.
   *Client Secret hanya ditempel di Supabase, tidak pernah di DrillKit atau Vercel.*
3. Supabase → **Authentication** → **URL Configuration**:
   - **Site URL:** `https://drill-kit.vercel.app`
   - **Redirect URLs:** `https://drill-kit.vercel.app/**` (dan `http://localhost:5173/**`
     untuk pengembangan).

DrillKit memakai HashRouter (`#/absensi`), jadi Supabase mengirim kode masuk ke
alamat akar (`https://drill-kit.vercel.app/?code=…`). DrillKit mengambil kodenya
dan memulihkan halaman semula sendiri — tidak perlu aturan rewrite apa pun.

## 3. Pengenal untuk aplikasi (Vercel)

Vercel → proyek → **Settings** → **Environment Variables**, centang **Production**
dan **Preview**:

| Nama | Isi |
|---|---|
| `VITE_SUPABASE_URL` | `https://<ref>.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…` (Project Settings › API Keys) |

Awalan `VITE_` memang disengaja: nilainya ikut ke aplikasi, dan kunci publik memang
aman di aplikasi. **Jangan pernah** memberi awalan `VITE_` pada *secret key*,
*service_role key*, atau kata sandi database. Sesudah disimpan, lakukan
**Redeploy** supaya nilainya terbaca.

Tanpa Vercel (mis. hosting lain), pengenal yang sama bisa diisi dari DrillKit:
**Pengaturan › Kehadiran bersama › Atur**. DrillKit menolak menyimpan kunci rahasia.

## 4. Layar izin Google (mode uji)

Selama aplikasi Google masih **Testing**, hanya email yang terdaftar sebagai
**Test users** (maks. 100) yang bisa masuk. Setiap kali pemilik mengundang staf
di DrillKit, tambahkan email yang sama di **Google Auth Platform › Audience ›
Test users**.

Bila nanti ingin **Publish**, Google meminta tautan ini di **Branding**:

| Isian | Alamat |
|---|---|
| Application home page | `https://drill-kit.vercel.app/tentang.html` |
| Application privacy policy link | `https://drill-kit.vercel.app/privasi.html` |
| Application terms of service link | `https://drill-kit.vercel.app/ketentuan.html` |

Login ini hanya meminta `openid`, `email`, dan `profile` (non-sensitif), jadi
biasanya tidak perlu verifikasi panjang. Catatan: Google bisa menolak domain
`*.vercel.app` di *Authorized domains*; bila itu terjadi, pakai domain sendiri.

## 5. Mulai memakai

**Pemilik (sekali):**

1. Buka DrillKit → **Pengaturan › Kehadiran bersama** → **Masuk dengan Google**.
2. Badge berubah menjadi **Pemilik**. Ketuk **Sinkronkan sekarang** — anggota, sesi,
   aturan program, dan kehadiran yang sudah ada terkirim.
3. Di **Staf tim**, isi email Google tiap staf, nama/jabatan, dan perannya → **Undang**.
   Tambahkan email yang sama di Test users (langkah 4).

**Staf (di HP masing-masing):**

1. Buka `https://drill-kit.vercel.app`, pilih **Pelatih** di layar sambutan
   (masukkan PIN pelatih bila diminta).
2. **Pengaturan › Kehadiran bersama** → **Masuk dengan Google** dengan email yang
   diundang. Anggota, sesi, dan kehadiran langsung masuk ke HP-nya.
3. Isi absensi seperti biasa di **Absensi**. Pita di atas daftar menunjukkan peran
   dan kapan terakhir tersinkron.

## 6. Cara kerjanya sehari-hari

- **Sinkron otomatis** tiap menit selama aplikasi terbuka, beberapa detik sesudah
  ada isian baru, saat sinyal kembali, dan saat aplikasi dibuka lagi.
- **Tanpa sinyal** absensi tetap bisa diisi; kirimnya menyusul otomatis.
- **Satu baris per anggota per sesi.** Bila dua orang mengisi anggota yang sama di
  sesi yang sama, isian yang terakhir terkirim yang berlaku.
- **Anggota dan sesi milik pemilik.** Perubahan nama atau jadwal di HP staf
  dikembalikan ke versi pemilik.
- **Keluar** (Pengaturan › Kehadiran bersama › Keluar) hanya memutus HP itu; data di
  HP tetap ada.
- **Proyek Supabase gratis dijeda** bila sekitar seminggu tidak dipakai. Pita
  Absensi akan menulis *server tidak terjangkau*; buka dasbor Supabase lalu
  **Restore**. Isian selama jeda tetap di HP dan terkirim sesudahnya.

## 7. Bila ada masalah

| Pesan di DrillKit | Penyebab & perbaikan |
|---|---|
| *Masuk dibatalkan atau ditolak Google…* | Email belum masuk Test users (langkah 4). |
| *Login Google belum dinyalakan di Supabase* | Langkah 2.2. |
| *Alamat kembali belum diizinkan* | Redirect URLs di langkah 2.3. |
| *Sesi masuk kedaluwarsa* | Kembali dari Google di browser lain (mis. tautan dibuka di aplikasi lain). Ulangi dari browser yang sama. |
| *Email ini belum diundang* | Pemilik belum mengundang email itu, atau salah ketik. |
| *Tabel server belum dibuat* | Langkah 1 belum dijalankan. |
| *Peranmu tidak mengizinkan perubahan ini* | Peran di daftar staf tidak sesuai; ubah dari HP pemilik. |
| *Server tidak terjangkau* | Tidak ada sinyal, atau proyek Supabase sedang dijeda. |

## Untuk pengembang

- Migrasi: `supabase/v2.14.0-kehadiran-bersama.sql`.
- Logika murni: `src/lib/kehadiranBersama.ts`; sambungan Supabase (dimuat malas):
  `src/lib/serverKehadiran.ts`; kartu Pengaturan & pita Absensi: `src/components/server/`.
- Uji: `qa/server-sql-logika.mjs` (RLS di PGlite), `qa/server-kehadiran-logika.mjs`,
  `qa/server-kehadiran-e2e.mjs` (lima perangkat, Supabase tiruan `qa/server-palsu.mjs`).
- Supabase lokal (CLI, `http://127.0.0.1:54321`) diterima sebagai alamat proyek untuk
  pengembangan.
