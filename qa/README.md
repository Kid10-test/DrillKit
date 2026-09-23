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

# 2. Bangun versi yang akan diuji.
cd drillkit && ./node_modules/.bin/vite build

# 3. Sajikan, kemudian jalankan ujinya.
./node_modules/.bin/vite preview --port 4173 --host 0.0.0.0
cd qa && BASE=http://localhost:4173 node <nama-uji>.mjs

# Atau jalankan semuanya sekaligus (24 rangkaian).
bash qa/regresi-penuh.sh http://localhost:4173
```

`regresi-penuh.sh` merakit dulu modul logika murni lewat `bangun-logika.sh`
(karena uji `*-logika` mengimpor dari `/tmp`), lalu menjalankan tiap
rangkaian bergiliran.

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
| `regresi-penuh.sh` | Menjalankan ke-24 rangkaian lawan satu `BASE`. |
| `sambutan.mjs` | `lewatSambutan(halaman)` — melewati layar sambutan seperti pemakai sungguhan. |
| `*.mjs` (160) | Satu berkas per rangkaian; yang masuk `regresi-penuh.sh` ada 24. |
| `nada-*.wav` | Berkas bunyi untuk uji penala & nada dengung. |
