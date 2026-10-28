# Rangkaian uji DrillKit

Uji-uji ini memakai peramban sungguhan (Puppeteer) lawan **versi yang sudah
dibangun**, bukan lawan peladen pengembangan. Alasannya: peladen `vite dev`
(:5173) kekurangan memori di kotak pasir ini dan tidak sanggup memikul satu
rangkaian regresi utuh — kegagalannya muncul sebagai waktu habis yang acak,
bukan sebagai asersi yang salah.

## Menjalankan

```bash
# 1. Pulihkan lingkungan bila `node_modules` hilang (setiap giliran baru).
bash qa/pulihkan.sh

# 2. Bangun versi yang akan diuji (dari akar repo).
./node_modules/.bin/vite build

# 3. Sajikan, kemudian jalankan ujinya.
./node_modules/.bin/vite preview --port 4173 --host 0.0.0.0
cd qa && BASE=http://localhost:4173 node <nama-uji>.mjs

# Atau jalankan semuanya sekaligus (116 rangkaian, hampir satu jam).
bash qa/regresi-penuh.sh http://localhost:4173
```

### Bila Chrome tidak bisa diunduh

Di sebagian kotak pasir, unduhan Chrome milik Puppeteer diblokir jaringan
(`npm install` gagal di `Failed to set up chrome`). Yang terbukti jalan (2a):

```bash
# Pasang dependensi tanpa unduhan Chrome, di kedua folder.
PUPPETEER_SKIP_DOWNLOAD=1 npm install          # di akar repo
cd qa && PUPPETEER_SKIP_DOWNLOAD=1 npm install

# Chromium siap-pakai dari npm, di luar repo.
mkdir -p ~/chromium-rt && cd ~/chromium-rt && npm init -y >/dev/null
npm install --no-save @sparticuz/chromium
node -e "import('@sparticuz/chromium').then(m=>m.default.executablePath())"   # -> /tmp/chromium
node -e "const fs=require('fs');fs.writeFileSync('/tmp/al2023.tar',require('zlib').brotliDecompressSync(fs.readFileSync('node_modules/@sparticuz/chromium/bin/al2023.tar.br')));require('child_process').execSync('mkdir -p /tmp/al2023 && tar -xf /tmp/al2023.tar -C /tmp/al2023')"

# Lalu jalankan uji seperti biasa dengan dua variabel ini.
export PUPPETEER_EXECUTABLE_PATH=/tmp/chromium LD_LIBRARY_PATH=/tmp/al2023/lib
```

`regresi-penuh.sh` merakit dulu modul logika murni lewat `bangun-logika.sh`
(karena uji `*-logika` mengimpor dari `/tmp`), lalu menjalankan tiap
rangkaian bergiliran.

## CI (GitHub Actions)

Tiap push & pull request menjalankan `.github/workflows/ci.yml`: typecheck
→ build → Chrome + pustaka sistem → pratinjau → `regresi-penuh.sh`.
Supaya bisa jalan di pelari mana pun, rangkaian uji **dilarang memakai
alamat absolut ke repo** — semua jalur diturunkan dari `qa/lokasi.mjs`
(`AKAR`, `DIST`, `QA`). Dulu 14 rangkaian menulis sendiri
`/home/user/drillkit/dist` (huruf kecil, lewat symlink); kini tidak ada
lagi, dan symlinknya pun tidak perlu dibuat.

## Yang perlu diketahui sebelum menambah uji

Hal-hal di bawah ini pernah menghabiskan waktu; semuanya sudah tertulis di
sini supaya tidak perlu ditemukan ulang.

- **Jangan menguji lawan `:5173`.** Peladen pengembangan tidak sanggup.
- **`useLiveQuery` mengabaikan tulisan mentah ke IndexedDB.** Kalau uji
  menulis langsung lewat `indexedDB.open(...)`, muat ulang halamannya setelah
  itu, atau perubahannya tidak akan terlihat.
- **Menimpa `HTMLInputElement.prototype.value` tidak berlaku pada kolom
  React.** Ketik saja: klik tiga kali → Ctrl+A → `keyboard.type`.
- **Baca dari basis data, bukan dari layar, bila klaimnya tentang data yang
  tersimpan.** Teks di layar mudah tertukar antar tab.
- **Pesan yang muncul sebentar harus dipantau, bukan dibaca sekali.** Ada
  pesan yang menghilang sebelum terbaca pada detik tertentu.
- **Layar sambutan memecahkan uji.** Pakai `lewatSambutan()` dari
  `sambutan.mjs`.
- **Uji tanpa asersi tidak bisa gagal.** Skrip yang hanya mencetak JSON
  tetap keluar dengan kode 0 walau tidak menyentuh apa pun, dan
  `regresi.sh` melaporkannya `"error": [] | tanda ✗: 0` — terbaca bersih.
  Setiap rangkaian harus berakhir dengan baris `N lulus, M gagal` dan kode
  keluar 1 bila ada yang gagal, juga saat ia mogok di tengah jalan.
- **Cari kolom lewat judulnya, kartu lewat nama pemainnya.** Kolom buku saku
  bertambah dari waktu ke waktu, dan urutan anggota mengikuti `id` acak —
  "sel terakhir" dan "kartu pertama" berubah arti tanpa peringatan. Alatnya
  ada di `alat-buku-saku.mjs`.
- **Escape di editor drill juga membatalkan pilihan titik** (bila tidak ada
  jendela terbuka). Tutup panel lewat tombol Tutup-nya bila langkah
  berikutnya memerlukan titik yang masih terpilih.
- **Jangan mengarang `data-testid`.** Semua penanda di sini ada di dalam
  kode sumbernya; cari dulu.
- **Bersihkan penyimpanan lewat `about:blank` → `createBrowserContext()`,**
  jangan sambil halamannya hidup.
- **Berkas di luar folder ini tidak bisa mengimpor puppeteer** — letakkan
  skrip percobaan di sini, bukan di `/tmp`.

## Berkas

| Berkas | Mengapa ada |
|---|---|
| `pulihkan.sh` | Memasang ulang `node_modules` di kedua folder dan pustaka Chrome. Tanpa yang terakhir, Puppeteer gagal dengan `Code: 127` tentang `libnspr4`. |
| `bangun-logika.sh` | Merakit `src/lib/*.ts` murni menjadi `/tmp/*.mjs` untuk uji logika. Impor gagal, bukan asersi. |
| `regresi-penuh.sh` | Menjalankan ke-116 rangkaian lawan satu `BASE`. |
| `jalankan-semua.sh` | Daftar yang sama, dipecah per blok, hasilnya ke `hasil-regresi.txt` — untuk dipantau selagi berjalan. |
| `sambutan.mjs` | `lewatSambutan(halaman)` — melewati layar sambutan seperti pemakai sungguhan. |
| `db-mentah.mjs` | Menanam & membaca IndexedDB langsung, tanpa modul aplikasinya. |
| `alat-buku-saku.mjs` | Alat bersama enam rangkaian buku saku (`dd8` … `dd10b-override`): membaca kartu di pratinjau, panel Detail, dan selalu mencetak `N lulus, M gagal`. Bukan rangkaian — jangan didaftarkan. |
| `*.mjs` | Satu berkas per rangkaian uji (sisanya alat bantu dan skrip tangkapan layar); yang masuk `regresi-penuh.sh` ada 116. |
| `nada-*.wav` | Berkas bunyi untuk uji penala & nada dengung. |
