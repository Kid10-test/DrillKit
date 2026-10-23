# Rencana teknis #11b — Partitur: render *full score* offline (OSMD), lembar PDF, dan dukungan `.mxl`

**Induk:** `RANCANGAN-LANJUTAN.md` §11 & lanjutan langsung `RANCANGAN-11a-PARTITUR-MUSICXML.md` (§1, §11 D1/D4).
**Status:** **Selesai** (23 Okt 2026 di branch `arena/db91d9e5-drillkit`, di atas `main` `7061548` pasca PR #21).

---

## 1. Kenapa #11b dipisah dari 11c dan 11d

Setelah **#11a** rampung (PR #20 & #21), DrillKit sudah menyimpan bita partitur di IndexedDB (`partiturBerkas`), mengenalinya di pintu #7, menampilkan ringkasan struktur (`judul`, `jumlahBirama`, `parts`, `perubahanSukat`, `tempo`), menjaga kuota penyimpanan, dan membawanya utuh lewat ZIP backup. Namun pelatih dan anggota **belum melihat satu not pun** di layar, dan berkas bawaan MuseScore (`.mxl` terkompresi) masih harus diekspor ulang secara manual.

Bila render notasi, filter per instrumen + cetak HTML, dan *highlight* birama sinkron + *loop* frasa digabung dalam satu PR, ada tiga risiko sekaligus (bundel eksternal pertama yang besar, tata letak cetak kertas, dan sinkronisasi waktu nyata terhadap mesin WebAudio). Karena itu pecahan §11 dipertahankan ketat:

| Bagian | Isi | Status |
| --- | --- | --- |
| **11a** | Simpan Blob IndexedDB, deteksi pintu #7, pemindai ringkasan murni, kuota, round-trip ZIP | **Selesai** (PR #20 & #21) |
| **11b (dokumen ini)** | **Urai `.mxl` (`DecompressionStream`)**, **render *full score* MusicXML offline (OSMD SVG hex, *lazy-load*, bertahap)**, dan **tampilan lembar PDF anti-buntu** | **Selesai** (23 Okt 2026) |
| 11c | Filter *part* per instrumen / *section* anggota + cetak / unduh HTML murni hex | Menyusul |
| 11d | *Highlight* birama aktif sinkron `TempoTimeline` + pilih & *loop* frasa + tautan frasa↔set drill | Menyusul |

### Batas 11b

- **Masuk:**
  1. Ekstraksi `.mxl` murni (`src/lib/mxl.ts`) berbasis Central Directory ZIP + `DecompressionStream('deflate-raw')` (menutup kandidat D1 dari `#11a` tanpa menyentuh `src/lib/zip.ts`).
  2. Penambahan satu-satunya dependensi baru untuk perenderan notasi: `opensheetmusicdisplay@2.2.1` (`BSD-3-Clause`), dimuat malas (*dynamic import*) lewat pembungkus tipis `src/lib/partiturRender.ts`.
  3. Komponen baca `src/components/LayarPartitur.tsx`: render *full score* SVG dengan warna hex murni di atas kertas terang (`#ffffff` / tinta `#0f172a`), render bertahap per sistem (`renderNext`) agar tidak membekukan detak metronom, kendali *zoom* (`60%`–`160%`), mode tata letak (*Halaman vertikal* vs *Baris mendatar*), mode layar penuh, serta penanganan galat OSMD & kasus D4 (`terurai: false`).
  4. Penampil PDF statis (`tipe === 'pdf'`) dengan `URL.createObjectURL` yang dibersihkan rapi + tombol **Buka di tab baru** dan **Unduh PDF** agar tidak pernah buntu di peramban HP (Android Chrome).
  5. Rangkaian uji Node murni (`qa/mxl-logika.mjs`) dan peramban (`qa/partitur-render.mjs`).
- **Tidak masuk:** menyembunyikan *part* tertentu / pencocokan *part* ↔ `section` anggota (11c), cetak / ekspor HTML partitur (11c), sorot birama berjalan / kursor sinkron metronom & rekaman (11d), serta klik birama untuk *loop* frasa (11d). Namun pembungkus `partiturRender.ts` di 11b sudah menyiapkan struktur data indeks birama grafis dan daftar instrumen OSMD supaya 11c & 11d tinggal memakainya tanpa membongkar ulang komponen.

---

## 2. Fakta terukur keadaan sekarang (diaudit 23 Okt 2026)

Seluruh angka di bawah ini diukur langsung dari repositori (`main` `7061548`) dan paket resmi `opensheetmusicdisplay@2.2.1` di registri npm:

1. **Paket `opensheetmusicdisplay@2.2.1`:**
   - Lisensi: **`BSD-3-Clause`** (bebas biaya, kompatibel penuh).
   - Berkas bundel bawaan (`build/opensheetmusicdisplay.min.js`): **1.420.444 bita** (~1,35 MiB *minified*) / **363.503 bita** (~355 KB *gzip*). Di dalamnya VexFlow `1.2.93` sudah terbundel utuh.
   - **Nol permintaan font eksternal (`.woff2` / `@font-face` / CDN):** glif musik VexFlow digambar sebagai vektor `<path>` SVG langsung dari tabel glif di dalam JS — artinya 100% jalan *offline* baik di situs PWA (`https://`) maupun berkas tunggal `DrillKit.html` (`file://`), tanpa balapan muat font (*FOIT/FOUT*).
   - **Nol `oklch()` dan nol `color-mix()`** di dalam `opensheetmusicdisplay.min.js` (diperiksa dengan `grep -oE "oklch\(|color-mix\("`). Seluruh warna keluaran SVG memakai kode hex (`#000000` atau nilai `defaultColor*` hex yang kita berikan).
   - Mendukung **render bertahap resmi (`osmd.renderNext({ systems })`)** yang menggambar sistem demi sistem tanpa menghapus sistem sebelumnya — krusial agar skor penuh 10+ instrumen tidak menahan utas utama > 1 detik di HP anggota.
2. **Dampak ke dua jalur *build* Vite yang ada:**
   - **PWA standar (`vite.config.ts`):** `App.tsx` sudah memakai *code splitting* per rute (`lazy()`), dan `VitePWA` sudah menyetel `workbox.maximumFileSizeToCacheInBytes: 5 * 1024 * 1024` (5 MiB, `vite.config.ts:94`). Memuat OSMD lewat `await import('opensheetmusicdisplay')` di dalam `partiturRender.ts` menghasilkan *chunk* terpisah (~1,42 MB) yang **tidak pernah diunduh/diurai pada muatan awal** (Dasbor, Anggota, Absensi, Jadwal, Drill, bahkan halaman Musik sebelum tombol *Buka partitur* ditekan), tetapi **tetap di-*precache* di latar belakang oleh Service Worker** sehingga aman dipakai di lapangan tanpa sinyal.
   - **Berkas tunggal portabel (`vite.config.portable.ts`):** `vite-plugin-singlefile` menyatukan semua *chunk* (`chunkSizeWarningLimit: 4000`, `vite.config.portable.ts:83`). Ukuran `dist-standalone/index.html` naik dari ±1,1 MB menjadi ±2,5 MB — masih jauh di bawah batas peringatan 4 MB dan tetap berupa satu berkas `.html` mandiri tanpa ketergantungan jaringan.
3. **Jebakan nyata format `.mxl` yang ketemu saat audit kode:**
   - `bukaZip` kita (`src/lib/zip.ts:150`) membaca *local file header* (`0x04034b50`) secara berurutan memakai `compSize = dv.getUint32(o + 18, true)`.
   - Banyak pengekspor ZIP/MXL (termasuk pustaka berbasis Java/Qt) menyalakan *general purpose bit 3* (`0x0008`, *streaming data descriptor*): di *local file header*, `compSize` dan `crc32` bernilai **`0`**, sedangkan ukuran terkompresi yang sah hanya tertulis di **Central Directory (`0x02014b50`)** di ekor berkas!
   - Karena itu pengurai `.mxl` di 11b **wajib membaca dari End of Central Directory (`0x06054b50`) → Central Directory (`0x02014b50`)**, bukan menelusuri *local header* dari depan.
4. **Ketersediaan `DecompressionStream('deflate-raw')` terhadap `browserslist` kita (`vite.config.ts:15`):**
   - Tersedia bawaan tanpa pustaka di Chrome ≥ 80, Edge ≥ 80, Android WebView ≥ 80, Safari / iOS ≥ 16.4, Firefox ≥ 113, dan **Node 22** (lingkungan CI kita).
   - Belum ada di iOS Safari 14–16.3 dan Firefox 78–112. Maka `typeof DecompressionStream === 'function'` **wajib diperiksa saat jalan**: bila tidak tersedia, kembalikan pesan petunjuk simpan ulang ke `.musicxml` (tidak pernah melempar `ReferenceError`).
5. **Alur asinkron sudah siap di kedua pintu:**
   - Di pintu #7 (`src/components/BukaBerkas.tsx:142`), `kenaliFile(file)` sudah `async`.
   - Di panel Musik (`src/lib/partiturSimpan.ts:81`), `periksaPartitur(file)` sudah `async`.

---

## 3. Dukungan `.mxl` — modul murni `src/lib/mxl.ts`

### 3.1 Prinsip utama: urai di pintu masuk, simpan sebagai XML tak terkompresi

Ketika pengguna memilih atau menyeret berkas `.mxl`:

1. `uraiMxl(bita)` memeriksa dan mengekstrak berkas XML utamanya di memori menjadi `Uint8Array` MusicXML tak terkompresi (`bitaXml`).
2. Yang disimpan ke `partiturBerkas` (IndexedDB) dan dikemas ke `partitur/` di dalam ZIP backup **adalah `bitaXml` tak terkompresi itu** (`tipe: 'musicxml'`), dengan nama berkas ternormalisasi (mis. `pembuka.mxl` → `pembuka.musicxml`, sementara nama berkas asal tetap bisa dilihat di konfirmasi pratinjau).

**Kenapa disimpan sebagai `.musicxml` hasil urai, bukan `.mxl` mentah:**
- **Nol migrasi Dexie:** tetap versi 10, `PartiturBerkasItem.tipe` tetap `'musicxml' | 'pdf'`.
- **Kompatibel lintas perangkat lama:** jika pelatih memasang `lagu.mxl` di laptop Chrome lalu membagikan *Backup ZIP* ke HP anggota ber-iOS 15 (yang belum punya `DecompressionStream`), HP anggota itu tetap langsung bisa memulihkan dan merender partiturnya tanpa perlu mendekompresi ulang.
- **Satu jalur render:** `LayarPartitur` dan `ringkasMusicXml` selalu menerima XML tak terkompresi yang seragam.
- **`src/lib/zip.ts` tidak disentuh sama sekali:** jalur *backup & pulihkan* bebas dari risiko regresi (menjaga alasan keputusan D1 di `#11a`).

### 3.2 Antarmuka & pengamanan `src/lib/mxl.ts`

Tanpa DOM, tanpa Dexie, tanpa dependensi npm — dirakit oleh `qa/bangun-logika.sh` dan diuji langsung di Node 22:

```ts
// src/lib/mxl.ts
export type HasilUraiMxl =
  | {
      ok: true
      /** Bita MusicXML utama hasil ekstraksi (siap masuk putusanPartitur & Blob). */
      bitaXml: Uint8Array
      /** Jalur berkas utama di dalam arsip, mis. "score.xml". */
      jalurUtama: string
    }
  | {
      ok: false
      /** Pesan Bahasa Indonesia yang menyebut penyebab & langkah berikutnya. */
      alasan: string
    }

/** Cepat & sinkron: apakah bita ini ZIP yang tampak seperti .mxl? */
export function apakahMxl(bita: Uint8Array): boolean

/** Ekstrak berkas MusicXML utama dari arsip .mxl (stored metode 0 maupun deflate metode 8). */
export async function uraiMxl(bita: Uint8Array): Promise<HasilUraiMxl>
```

Aturan ketahanan `uraiMxl`:
- **Baca Central Directory (`0x06054b50` → `0x02014b50`):** mencari tanda tangan EOCD dari ekor berkas (mendukung komentar ZIP hingga 65.535 bita), lalu membaca metode kompresi (`0` = *stored*, `8` = *deflate*), `compSize`, `uncompSize`, `crc32`, dan `localHeaderOffset` dari Central Directory — aman terhadap berkas `.mxl` ber-*data-descriptor* (`flag & 0x08`).
- **Baca `META-INF/container.xml`:** mengambil atribut `full-path` dari elemen `<rootfile>`. Bila ada beberapa `<rootfile>` (mis. MuseScore menyertakan `score.xml` + pratinjau `.pdf` atau `.png`), utamakan yang `media-type`-nya mengandung `musicxml` atau berekstensi `.musicxml`/`.xml`.
- **Pagar anti-*zip-bomb*:** tolak sebelum/selama dekompresi bila `uncompSize > BATAS_BITA` (8 MB, satu konstanta dengan `partitur.ts:62`) atau jumlah bita keluaran aliran melewati `BATAS_BITA` — pembaca potongan aliran menghentikan bacaan segera begitu melewati 8 MB agar RAM HP tidak habis.
- **Verifikasi CRC-32:** cocokkan hasil ekstraksi dengan `crc32` dari `zip.ts:30` supaya `.mxl` yang terpotong di tengah jalan terdeteksi dengan pesan jelas (`"berkas .mxl rusak (CRC tidak cocok)"`), bukan menghasilkan XML setengah jadi.
- **Cadangan peramban lama:** bila entri memakai metode `8` (*deflate*) tetapi `typeof globalThis.DecompressionStream !== 'function'`, kembalikan `ok: false` dengan pesan ramah yang meminta simpan ulang sebagai `.musicxml` tak terkompresi.

### 3.3 Sambungan ke pintu #7 & `partiturSimpan.ts`

- **`src/lib/bukaBerkas.ts`:** tambah `kenaliBerkasAsync(nama: string, bita: Uint8Array): Promise<BerkasDikenal>`. Bila ` magicZip(bita)` dan memuat `META-INF/container.xml`, ia memanggil `uraiMxl(bita)`:
  - Jika `ok: true` → teruskan `bitaXml` ke jalur pengenalan partitur sehingga kembali `jenis: 'partitur'` lengkap dengan `partiturRingkas` dan catatan `"MusicXML terkompresi (.mxl)"`.
  - Jika `ok: false` → kembali `jenis: 'tak-dikenal'` dengan `catatan: hasil.alasan`.
  - Fungsi sinkron `kenaliBerkas` tetap utuh agar seluruh pemanggil sinkron dan uji lama tidak rusak. `kenaliFile` di `BukaBerkas.tsx:142` dan pemilih berkas menerima `.mxl` (`accept=".musicxml,.mxl,.xml,.pdf"`).
- **`src/lib/partiturSimpan.ts`:** `periksaPartitur(file, namaFile?)` mendeteksi `.mxl`, menjalankan `uraiMxl`, dan mengembalikan `blobSiap` (Blob `application/vnd.recordare.musicxml+xml` berisi `bitaXml`) + `namaSimpan` (`lagu.mxl` → `lagu.musicxml`) sehingga `PanelPartitur` dan `simpanPartiturBerkas` langsung bekerja tanpa cabang ganda.

---

## 4. Pembungkus render — `src/lib/partiturRender.ts`

Seluruh interaksi dengan `opensheetmusicdisplay` dikurung di satu berkas `src/lib/partiturRender.ts`. Komponen React tidak mengimpor `opensheetmusicdisplay` secara langsung.

### 4.1 Kenapa dibungkus

1. ***Lazy chunk* tunggal:** satu `let janjiOsmd: Promise<typeof import('opensheetmusicdisplay')> | null = null` menjamin modul 1,42 MB itu hanya diunduh sekali per sesi, hanya saat pengguna benar-benar membuka notasi MusicXML.
2. **Kontrak siap-pakai untuk 11c & 11d:** pembungkus mengekspor daftar instrumen internal OSMD (untuk filter *part* 11c) dan daftar kotak batas birama (`PetaBiramaRender`, untuk *highlight* & klik birama 11d) dalam tipe milik DrillKit sendiri.
3. **Warna hex terkunci di satu tempat:** semua opsi warna OSMD disetel memakai konstanta hex murni sehingga tidak pernah ada warna turunan CSS modern yang bocor ke SVG:

```ts
export const WARNA_PARTITUR_HEX = {
  kertas: '#ffffff',
  tinta: '#0f172a',
  tintaRedup: '#475569',
} as const
```

### 4.2 Opsi OSMD & render bertahap (`renderNext`)

Saat membuat instans `OpenSheetMusicDisplay(wadah, opsi)`:

- `backend: 'svg'` — tajam pada semua tingkat *zoom*, siap dicetak di 11c, dan mudah diinspeksi di uji otomatis.
- `autoResize: false` — kita mengendalikan *resize* sendiri dengan `ResizeObserver` ber-*debounce* (250 ms) supaya perubahan lebar panel atau munculnya *scrollbar* tidak memicu render berulang tanpa henti.
- `disableCursor: true` di 11b (kursor/sorot birama baru dinyalakan secara terkendali di 11d).
- `drawingParameters: 'compacttight'` pada layar sempit (< 640 px) atau `'default'` pada layar lebar, dengan mode tata letak yang bisa dipilih pemakai:
  - `'vertikal'` (`renderSingleHorizontalStaffline: false`) — lembaran bertumpuk ke bawah seperti kertas partitur biasa (bawaan).
  - `'mendatar'` (`renderSingleHorizontalStaffline: true`) — satu baris panjang digulir ke kanan, sering disukai pemain di layar HP lanskap.
- Warna eksplisit hex:
  - `defaultColorMusic: '#0f172a'`
  - `defaultColorNotehead: '#0f172a'`
  - `defaultColorStem: '#0f172a'`
  - `defaultColorRest: '#0f172a'`
  - `defaultColorLabel: '#0f172a'`
  - `defaultColorTitle: '#0f172a'`
  - `EngravingRules.PageBackgroundColor = '#ffffff'`

**Alur render bertahap anti-beku (`renderBertahap`):**
1. Muat teks XML lewat `await osmd.load(teksXml)` (memakai `teksPartitur(bita)` dari `partitur.ts` sehingga berkas UTF-16 ekspor lama Sibelius/Finale juga langsung terbaca!).
2. Atur `osmd.Zoom = zoom` (mis. `1.0` untuk 100%).
3. Jalankan loop `osmd.renderNext({ systems: 2 })` yang dijadwalkan dengan `requestAnimationFrame`:
   - Setiap gelombang menggambar 2 sistem musik (~15–40 ms per gelombang), lalu menyerahkan kendali kembali ke *event loop* peramban supaya jadwal detak `AudioContext` metronom dan tombol *Berhenti* tetap responsif.
   - Laporkan progres `{ selesai: boolean; biramaTerender: number; totalBirama: number }` ke UI.
   - Sediakan `AbortSignal` / token pembatalan: jika pengguna mengganti lagu, mengubah *zoom*, atau menutup panel di tengah render, loop langsung berhenti bersih tanpa menulis ke DOM yang sudah dilepas.

---

## 5. Komponen tampilan — `src/components/LayarPartitur.tsx`

### 5.1 Posisi di halaman Musik (`src/pages/Music.tsx`)

Di `PanelPartitur` (`src/components/PanelPartitur.tsx`), ketika `meta` ada dan `adaBerkas === true`, muncul tombol utama **`Buka partitur` / `Sembunyikan partitur`** (`data-testid="partitur-buka"`).

Saat dibuka, **`LayarPartitur`** tampil sebagai kartu lebar penuh (`lg:col-span-3`, lebar penuh grid halaman Musik) tepat di bawah baris Metronom/Repertoar (atau bisa diluaskan ke mode **Layar penuh** `fixed inset-0 z-50` lewat satu tombol `data-testid="partitur-layar-penuh"`):
- **Di laptop:** pelatih/anggota tetap bisa menyalakan Metronom / Rekaman / Tempo latihan sambil melihat lembaran *full score* lebar penuh di bawahnya.
- **Di HP:** tombol **Layar penuh** memberi ruang baca maksimum tanpa terpotong bilah samping/kartu lain, lengkap dengan tombol kembali & indikator status singkat judul lagu.

### 5.2 Bilah kendali `LayarPartitur` (untuk MusicXML)

| Kendali | `data-testid` | Perilaku |
| --- | --- | --- |
| Perkecil / Reset / Perbesar | `partitur-zoom-kurang`, `partitur-zoom-nilai`, `partitur-zoom-tambah` | Rentang `60%`–`160%` langkah `15%`; disimpan per perangkat di `localStorage` (`drillkit_partitur_zoom`) |
| Tata letak (*Halaman* / *Baris mendatar*) | `partitur-tata-letak` | Mengganti mode gulir vertikal ↔ satu baris mendatar |
| Layar penuh / Keluar layar penuh | `partitur-layar-penuh` | Mode fokus baca di HP maupun proyektor ruang latihan (`Escape` juga menutup mode layar penuh) |
| Unduh berkas asli | `partitur-unduh-asli` | Selalu ada untuk mengunduh `.musicxml` / `.pdf` dari IndexedDB bila ingin dibuka di aplikasi luar |
| Tutup tampilan | `partitur-tutup` | Melepas SVG dari DOM untuk menghemat memori saat selesai membaca |

### 5.3 Keadaan khusus MusicXML: D4 (`terurai: false`) & galat render

- **Berkas D4 (`meta.terurai === false`):** di `#11a`, berkas XML yang menjegal pemindai kecil kita (mis. mengandung `&nbsp;`) tetap disimpan karena `DOMParser` peramban + OSMD lebih luwes. Di `#11b`, berkas D4 **tetap dicoba dirender oleh OSMD** — bila berhasil, notasi tampil normal!
- **Bila OSMD menolak berkas (XML benar-benar rusak / tak didukung):** tangkap galatnya, tampilkan kotak peringatan jujur (`data-testid="partitur-render-galat"`) yang menyebut pesan galat aslinya + tombol **Unduh berkas asli** — tidak pernah melempar *unhandled rejection* ke `ErrorBoundary` halaman Musik.

### 5.4 Tampilan lembar PDF (`tipe === 'pdf'`)

Untuk lagu berpartitur PDF, `LayarPartitur` **tidak memuat OSMD sama sekali**:
1. Buat `blobUrl = URL.createObjectURL(item.blob)` di dalam `useEffect`, dan pastikan `URL.revokeObjectURL(blobUrl)` dipanggil saat berganti lagu atau komponen dilepas.
2. Tampilkan bilah atas berisi keterangan jujur (*"Lembar PDF statis — tidak merender ulang per instrumen"*) + dua tombol yang **selalu tampil**:
   - **Buka di tab baru** (`<a href={blobUrl} target="_blank" rel="noopener noreferrer" data-testid="partitur-pdf-buka">`)
   - **Unduh PDF** (`<a href={blobUrl} download={meta.namaFile} data-testid="partitur-pdf-unduh">`)
3. Di bawahnya tampilkan `<iframe data-testid="partitur-pdf-bingkai" src={blobUrl} title={...} className="h-[72vh] w-full rounded-lg border border-slate-700 bg-white" />`.
4. Dengan pasangan `<iframe>` + tombol *Buka / Unduh*, pengguna laptop langsung membaca di dalam halaman, sementara pengguna Android Chrome (yang memblokir pratinjau PDF di dalam `<iframe>`) tetap bisa membuka lembarannya dalam satu ketukan — memenuhi aturan proyek *"tidak pernah buntu"*.

---

## 6. Kaitan yang disiapkan untuk 11c dan 11d

Agar `partiturRender.ts` tidak perlu ditulis ulang di dua PR berikutnya, hasil render mengembalikan objek sesi yang sudah memuat dua informasi struktural dari OSMD:

```ts
export interface InfoInstrumenRender {
  indeks: number
  idXml: string
  nama: string
  singkatan: string
  tampil: boolean
}

export interface KotakBiramaRender {
  /** Nomor birama sumber di MusicXML (mis. 0 untuk anacrusis, 1..N). */
  nomorBirama: number
  /** Indeks urut 0-based di daftar birama OSMD (`measureListIndex`). */
  indeksUrut: number
}

export interface HasilSesiPartitur {
  jumlahHalaman: number
  jumlahBiramaGrafis: number
  instrumen: InfoInstrumenRender[]
  birama: KotakBiramaRender[]
}
```

Di 11b nilai itu cukup dipakai untuk indikator status (*"16 birama · 3 part terender"*) dan verifikasi di rangkaian uji `qa/partitur-render.mjs`; di 11c `instrumen` menjadi sumber pemilih *part*, dan di 11d `birama` menjadi jembatan ke `TempoTimeline`.

---

## 7. Rencana pengujian

### 7.1 `qa/mxl-logika.mjs` (baru — Node 22 murni, tanpa peramban)

Dirakit lewat `qa/bangun-logika.sh` (`rakit src/lib/mxl.ts mxl`):
- `.mxl` terkompresi *deflate* (metode 8, dibuat dengan `node:zlib` `deflateRawSync`) → `uraiMxl` mengembalikan bita XML persis byte-per-byte & lulus `ringkasMusicXml`.
- `.mxl` dengan *streaming data descriptor* (`flag = 0x0808`, `compSize = 0` di *local header*, ukuran asli hanya di *Central Directory*) → tetap berhasil diurai utuh!
- `.mxl` tanpa kompresi (metode 0 *stored*, seperti fixture `#11a`) → berhasil diurai bahkan bila `DecompressionStream` dimatikan sementara.
- `.mxl` multi-`rootfile` (`META-INF/container.xml` berisi `score.musicxml` + `preview.pdf`) → memilih `score.musicxml`, bukan PDF-nya.
- `.mxl` dengan komentar di ekor EOCD → Central Directory tetap ditemukan.
- `.mxl` rusak (CRC-32 salah / aliran *deflate* terpotong / tanpa `META-INF/container.xml` / `rootfile` menunjuk berkas yang tidak ada di ZIP) → `ok: false` dengan pesan spesifik yang menyebut apa yang salah.
- `.mxl` melampaui `BATAS_BITA` (> 8 MB hasil dekompresi / simulasi *zip-bomb* nol berulang) → dihentikan dan ditolak dengan pesan batas 8 MB.
- Simulasi peramban lama (`globalThis.DecompressionStream = undefined` sementara) pada entri *deflate* → `ok: false` dengan pesan simpan ulang ke `.musicxml` (tidak melempar error).
- Sambungan `kenaliBerkasAsync`: berkas `.mxl` dikenali sebagai `jenis: 'partitur'` lengkap dengan `partiturRingkas`.

Target: **≥ 35 asersi**, diakhiri `N lulus, M gagal` + kode keluar.

### 7.2 `qa/partitur-render.mjs` (baru — peramban ujung-ke-ujung)

Menguji seluruh alur visual & *lazy-loading* di Chromium:
1. **Verifikasi *lazy-load*:** buka Dasbor (`#/`) dan halaman Musik (`#/musik`) sebelum membuka partitur → pastikan *chunk* OSMD belum menghambat muatan halaman dan tidak ada error jaringan/konsol.
2. **Unggah `.mxl` terkompresi *deflate* sungguhan** lewat pintu #7 (`TombolBukaBerkas` / seret-lepas) → modal mengenali sebagai **Partitur** dan menampilkan judul, birama, part, sukat, tempo (menggantikan penolakan D1 lama di alur asinkron).
3. **Pasang `.mxl` di `PanelPartitur`** → tersimpan di `partiturBerkas` sebagai XML tak terkompresi (`tipe: 'musicxml'`), bertahan lintas `reload()`.
4. **Klik `Buka partitur` (`[data-testid="partitur-buka"]`):**
   - `LayarPartitur` me-render `<svg>` nyata di dalam `[data-testid="partitur-kanvas-svg"]` dengan lebar & tinggi > 0, memuat elemen notasi VexFlow (`vf-stavenote` / `<path>`), dan menampilkan judul skor.
   - **Pemeriksaan warna ketat:** seluruh atribut/gaya di dalam HTML `LayarPartitur` **bebas dari `oklch(` dan `color-mix(`**, dan latar kertas memakai `#ffffff` / `rgb(255, 255, 255)`.
5. **Kendali baca:**
   - Klik `partitur-zoom-tambah` (`100%` → `115%`) → lebar/skala render berubah dan tersimpan setelah `reload()`.
   - Ganti `partitur-tata-letak` ke *Baris mendatar* → terender ulang tanpa error.
   - Nyalakan & matikan `partitur-layar-penuh` (termasuk tombol `Escape`).
6. **Kasus D4 (`aneh-entitas.musicxml` dengan `&nbsp;` / XML yang gagal diringkas pemindai kecil) & XML rusak:**
   - XML rusak yang ditolak OSMD menampilkan `[data-testid="partitur-render-galat"]` + tombol unduh berkas asli, tanpa mematikan halaman Musik atau konsol *pageerror*.
7. **Partitur PDF (`lembar-cadangan.pdf`):**
   - Menampilkan `[data-testid="partitur-pdf-bingkai"]` dengan `blob:` URL sah + tombol `[data-testid="partitur-pdf-buka"]` dan `[data-testid="partitur-pdf-unduh"]`, serta tidak memuat OSMD bila di konteks baru yang hanya membuka PDF.

Target: **≥ 30 asersi**, konsol bersih (`0` error), terdaftar di `qa/regresi-penuh.sh`.

### 7.3 Penyesuaian terukur pada uji `#11a` yang sudah ada

Audit `grep -rn -i mxl qa/` menunjukkan tiga tempat yang di `#11a` menguji penolakan D1:
- `qa/partitur-logika.mjs` (baris 500–517) & `qa/buka-berkas-logika.mjs` (baris 212–219): memanggil fungsi sinkron `deteksiPartitur` / `putusanPartitur` / `kenaliBerkas` — **tetap hijau apa adanya**, sebab jalur sinkron memang tetap melaporkan `tipe: 'mxl'` + `PESAN_MXL` bila belum diurai `uraiMxl`.
- `qa/partitur-impor.mjs` (baris 380–416): menguji alur UI (`BukaBerkas` & `PanelPartitur`) yang memanggil `kenaliFile` / `periksaPartitur` (asinkron). Diperbarui selaras keputusan D1→11b: `.mxl` yang sah kini diterima dan menampilkan pratinjau ringkasan, sedangkan `.mxl` rusak tetap ditolak di `partitur-tolak` tanpa menulis apa pun ke `partiturBerkas`.

---

## 8. Berkas yang akan disentuh

| Berkas | Perubahan |
| --- | --- |
| `package.json`, `package-lock.json` | Tambah `opensheetmusicdisplay` (`2.2.1`, `BSD-3-Clause`) — dependensi runtime jadi 8 |
| `src/lib/mxl.ts` | **baru** — pendeteksi & pengurai `.mxl` murni (Central Directory ZIP + `DecompressionStream('deflate-raw')` + batas 8 MB + CRC-32) |
| `src/lib/partiturRender.ts` | **baru** — *lazy loader* `opensheetmusicdisplay`, konfigurasi SVG hex `#ffffff`/`#0f172a`, render bertahap `renderNext` ber-pembatalan, ekstraksi info instrumen & birama |
| `src/components/LayarPartitur.tsx` | **baru** — kanvas baca MusicXML (*zoom*, tata letak vertikal/mendatar, layar penuh, progres, galat ramah) + penampil lembar PDF anti-buntu |
| `src/lib/bukaBerkas.ts`, `src/components/BukaBerkas.tsx` | `kenaliBerkasAsync` untuk `.mxl`, pemilih berkas menerima `.mxl`, label pintu #7 diperbarui |
| `src/lib/partiturSimpan.ts`, `src/components/PanelPartitur.tsx` | `periksaPartitur` mengurai `.mxl` → simpan sebagai `.musicxml`; tombol `Buka partitur` & terima `.mxl` di `#partitur-input` |
| `src/pages/Music.tsx` | Merentangkan kartu `LayarPartitur` lebar penuh saat partitur lagu yang dipilih sedang dibuka |
| `qa/mxl-logika.mjs`, `qa/partitur-render.mjs` | **baru** — uji Node `.mxl` & uji peramban render OSMD/PDF |
| `qa/partitur-impor.mjs`, `qa/bangun-logika.sh`, `qa/regresi-penuh.sh`, `.github/workflows/ci.yml` | Penyesuaian asersi UI `.mxl`, rakit `mxl.ts`, pendaftaran 2 rangkaian baru (107 → **109 rangkaian**) |
| `RANCANGAN-LANJUTAN.md`, `IDE-PENGEMBANGAN.md` | Pembaruan status §11 setelah seluruh tahap hijau |

---

## 9. Keputusan teknis (ditetapkan 23 Okt 2026)

**D1 — OSMD diizinkan sebagai dependensi ke-8, tetapi wajib *lazy-loaded* terpisah.**
Menulis perender notasi balok (tata letak spasi suara ganda, *beam*, *slur*, tanda mula, transposisi, sistem baris) dari nol membutuhkan puluhan ribu baris kode dan justru rawan salah gambar. `opensheetmusicdisplay@2.2.1` (`BSD-3-Clause`, sudah membundel VexFlow tanpa font eksternal dan tanpa `oklch()`) menyelesaikan masalah itu secara *offline*, sesuai rencana induk `RANCANGAN-LANJUTAN.md` §11 butir 1. Syarat kerasnya: ia tidak boleh masuk ke *chunk* awal — hanya diunduh ketika `LayarPartitur` untuk MusicXML benar-benar dibuka.

**D2 — Kertas partitur selalu terang (`#ffffff`) dengan tinta hex (`#0f172a`), meskipun tema aplikasi gelap.**
Notasi balok yang rapat (garis paranada tipis, titik staccato, garis bantu *ledger line*) cepat kabur pada latar gelap di bawah sinar matahari lapangan latihan, dan di 11c partitur akan dicetak di kertas putih. Merender langsung di atas kartu kertas putih `#ffffff` dengan warna hex `#0f172a` memberi keterbacaan tertinggi sekaligus menjaga konsistensi layar ↔ cetak tanpa perlu membalik palet.

**D3 — `.mxl` diurai lewat `src/lib/mxl.ts` sendiri (bukan mengubah `src/lib/zip.ts`) dan disimpan sebagai `.musicxml` tak terkompresi.**
`zip.ts` tetap khusus metode 0 (*stored*) untuk jalur sensitif backup & paket anggota. `mxl.ts` membaca dari *Central Directory* ZIP + `DecompressionStream('deflate-raw')` agar tahan terhadap berkas `.mxl` ber-*data-descriptor*, dan menyimpan bita XML hasil urai ke `partiturBerkas` supaya tidak butuh migrasi Dexie maupun dekompresi ulang di perangkat penerima backup.

**D4 — Render dilakukan bertahap (`renderNext`) dengan pembatalan bersih.**
*Full score* marching band (brass + battery + pit) bisa puluhan sistem. Menggambar 2 sistem per `requestAnimationFrame` menjaga *main thread* tetap longgar sehingga suara klik metronom dan pemutar rekaman tidak tersendat saat partitur dibuka sambil berlatih.

**D5 — PDF memakai `<iframe>` + tombol *Buka di tab baru* & *Unduh* (tanpa membundel `pdf.js`).**
Menambah `pdf.js` (+1,5 MB lagi + *worker* terpisah) hanya demi merender PDF di dalam kanvas tidak sebanding dengan bobot bundel portabel `DrillKit.html`. Peramban laptop sudah merender PDF bawaan lewat `<iframe>`, dan di HP tombol *Buka di tab baru* / *Unduh PDF* membuka penampil PDF bawaan sistem operasi secara instan dan *offline*.

---

## 10. Kriteria terima

- [x] Berkas `.mxl` (baik *deflate* biasa maupun ber-*data-descriptor*) dikenali pintu #7 dan bisa dipasang di `PanelPartitur`, tersimpan sebagai MusicXML utuh di IndexedDB.
- [x] `.mxl` rusak atau melebihi batas 8 MB terkompresi/tak-terkompresi ditolak dengan pesan jelas tanpa membekukan peramban.
- [x] `qa/mxl-logika.mjs` ≥ 35 asersi (**42 lulus, 0 gagal** di Node 22 tanpa peramban); terdaftar di `qa/regresi-penuh.sh`.
- [x] *Chunk* `opensheetmusicdisplay` terpisah pada `npm run build` (`1,438.32 kB` / `383.85 kB` gzip; tidak dimuat di Dasbor atau sebelum partitur MusicXML dibuka) dan `npm run build:portable` tetap berhasil menghasilkan satu berkas HTML mandiri tanpa peringatan galat.
- [x] Membuka partitur MusicXML merender `<svg>` *full score* yang terbaca jelas di atas kertas `#ffffff` dengan warna murni hex/rgb (**nol `oklch()` / `color-mix()`**).
- [x] Kendali *zoom* (`60%`–`160%`), pilihan tata letak (*Vertikal* / *Mendatar*), dan mode *Layar penuh* berjalan mulus serta tidak membocorkan memori saat lagu diganti atau panel ditutup.
- [x] Berkas XML rusak yang gagal dirender OSMD menampilkan pesan ramah + tombol unduh berkas asli (tidak menjatuhkan halaman ke `ErrorBoundary`).
- [x] Partitur PDF menampilkan bingkai pratinjau + tombol *Buka di tab baru* dan *Unduh PDF*, serta membersihkan `blob:` URL saat ditutup.
- [x] `qa/partitur-render.mjs` ≥ 30 asersi (**40 lulus, 0 gagal**), konsol peramban bersih; seluruh **109 rangkaian** terdaftar di `qa/regresi-penuh.sh` & `.github/workflows/ci.yml`.
- [x] `npx tsc --noEmit`, `npm run build`, dan `npm run build:portable` bersih.

---

## 11. Urutan pengerjaan (satu PR di branch ini, 6 langkah terukur)

1. **`src/lib/mxl.ts` + `qa/mxl-logika.mjs` → hijau di Node dulu**, sebelum menyentuh `package.json` atau UI (`bash qa/bangun-logika.sh && node qa/mxl-logika.mjs`).
2. **Sambungkan `.mxl` ke pintu #7 & `partiturSimpan.ts`** (`kenaliBerkasAsync`, `periksaPartitur`, `accept=".musicxml,.mxl,.xml,.pdf"`) + sesuaikan asersi `.mxl` di `qa/partitur-impor.mjs`.
3. **Pasang `opensheetmusicdisplay@2.2.1` + tulis `src/lib/partiturRender.ts`** — pastikan `npm run typecheck`, `npm run build` (verifikasi *chunk* OSMD terpisah & di bawah 5 MB Workbox), dan `npm run build:portable` semuanya hijau lebih dulu.
4. **Bangun `src/components/LayarPartitur.tsx` & sambungkan ke `PanelPartitur.tsx` + `src/pages/Music.tsx`** (render SVG bertahap, *zoom*, tata letak, layar penuh, penanganan galat, dan penampil PDF).
5. **Tulis `qa/partitur-render.mjs` & daftarkan kedua rangkaian baru di `qa/regresi-penuh.sh` + `.github/workflows/ci.yml`** (107 → 109 rangkaian), lalu jalankan uji peramban lokal sampai 0 gagal.
6. **Perbarui status §11 di `RANCANGAN-LANJUTAN.md`, `IDE-PENGEMBANGAN.md`, dan centang kriteria terima dokumen ini** sebelum `git push` dan membuka PR.
