# Rencana teknis #11a — Partitur: simpan, kenali, dan bawa MusicXML

**Induk:** `RANCANGAN-LANJUTAN.md` §11 (baris 857).
**Status:** rencana, belum dikerjakan. Ditulis 10 Okt 2026 di branch
`arena/bf8ee716-drillkit` (PR #19) supaya bisa dipindah ke branch #11 sendiri.

---

## 1. Kenapa #11 dipecah

§11 adalah fitur terbesar yang tersisa: notasi, part per instrumen, highlight
sinkron, dan loop frasa. Dikerjakan sekaligus artinya satu PR yang tidak bisa
diuji sebagian. Pecahan yang diusulkan:

| Bagian | Isi | Butuh peramban untuk uji? |
| --- | --- | --- |
| **11a** | MusicXML/PDF **disimpan** sebagai Blob, **dikenali** di pintu #7, **diringkas** (birama, part, sukat, tempo), dan **ikut terbawa** di ZIP/repertoar | Sebagian kecil |
| 11b | Render *full score* dengan OSMD (SVG hex, offline) | Ya |
| 11c | Part per instrumen/section + cetak hex | Ya |
| 11d | Highlight sinkron `TempoTimeline` + loop frasa + lencana frasa↔set | Ya |

**11a sengaja tidak merender apa pun.** Ia menyiapkan data dan pintu masuknya,
dan seluruh logikanya murni sehingga bisa diuji di node — pola yang sama
dengan #10 (Pyware): `src/lib/pyware.ts` diuji 146 asersi tanpa peramban.

### Batas 11a

Masuk: deteksi berkas, parser ringkasan, store IndexedDB, metadata di `Song`,
UI pasang/lepas + ringkasan, kuota, round-trip ZIP, pratinjau pintu #7.

Tidak masuk: render SVG, partitur per instrumen, cetak, highlight, loop,
pencocokan part→section (itu 11c, dan bisa menumpang `namaAnggota.susunSaran`).

---

## 2. Keadaan sekarang (diperiksa 10 Okt 2026)

Fakta yang dipakai rancangan ini, dengan rujukannya:

- **Belum ada satu pun kode MusicXML/OSMD.** `grep -rniE "musicxml|osmd" src`
  kosong; kata "partitur" yang ada semuanya komentar tentang *tempo partitur*
  (mis. `src/lib/metronome.ts:346`), bukan notasi.
- **Dependensi masih 7**: `date-fns, dexie, dexie-react-hooks, qrcode, react,
  react-dom, react-router-dom`. 11a **tidak menambah dependensi**.
- **Pola Blob sudah ada dari #6.** `AudioRekamanItem` (`src/db/types.ts:771`)
  menyimpan `blob` di store `rekamanAudio` (Dexie **versi 9**,
  `src/db/db.ts:84`), sementara `Song.rekaman` (`src/db/types.ts:737`) hanya
  membawa metadata — komentarnya persis alasan pemisahan itu: *"Berkas
  binernya (Blob) disimpan di IndexedDB tabel `rekamanAudio`."*
- **Pintu #7 sudah punya jalur deteksi.** `kenaliBerkas(nama, bita)`
  (`src/lib/bukaBerkas.ts:311`) bercabang: ZIP → buka & kenali tiap entri;
  teks → `kenaliCsv`/`deteksiPyware`. `kenaliTeks` (baris 443) hanya
  membungkus `kenaliBerkas`, jadi sekali tambah, jalur pilih-berkas dan
  seret-lepas ikut dapat.
- **Jenis berkas adalah union tertutup** (`bukaBerkas.ts:35`) dengan tiga peta
  yang harus ikut diisi: `LABEL_JENIS` (51), `TUJUAN_JENIS` (77), dan aturan
  mode `aturMode` (461).
- **ZIP kita *store-only*.** `bikinZip` menulis "tanpa pemadatan"
  (`src/lib/zip.ts:62`) dan `bukaZip` didokumentasikan *"metode 0 'stored' /
  tanpa pemadatan"* (`src/lib/zip.ts:148`). Konsekuensi penting di §5.
- **Pola Blob-di-ZIP sudah ada.** `downloadBackupZip` (`src/lib/backup.ts:167`)
  menulis `audio/{songId}_{nama}` + `audio/manifest.json` (baris 182, 197);
  pemulihan membaca manifest itu di `src/components/PulihkanBackup.tsx:57`.
- **Kuota sudah ada alatnya.** `cekPenyimpanan()` (`src/lib/rekaman.ts:320`)
  dan `mintaPenyimpananPersisten()` (360); satu-satunya pemakai UI saat ini
  `src/components/ModalRekamanLagu.tsx`.
- **Hash berkas sudah generik.** `hitungHashAudio(data)` (`rekaman.ts:21`)
  sebenarnya SHA-256 atas bita apa pun, dan `rekaman.ts` sudah dirakit untuk
  uji node (`qa/bangun-logika.sh:97`) — jadi aman dipakai ulang.
- **Repertoar membawa lagu tanpa biner.** `FORMAT_REPERTOAR`
  (`src/lib/repertoar.ts:20`), `bangunPaket` (32), `bacaPaket` (77),
  `terapkanPaket` (178).
- **Regresi penuh kini 104 rangkaian** (dihitung dari `qa/regresi-penuh.sh`).

---

## 3. Rancangan data

### 3.1 Store baru `partiturBerkas` (Dexie versi 10)

```ts
// src/db/db.ts — setelah this.version(9)
this.version(10).stores({
  partiturBerkas: 'id, songId, updatedAt',
})
```

```ts
// src/db/types.ts — bayangan AudioRekamanItem (771)
export interface PartiturBerkasItem {
  /** Id unik, disamakan dengan songId lagu pemilik (pola #6). */
  id: string
  songId: string
  blob: Blob
  namaFile: string
  /** 'musicxml' | 'pdf' — hasil deteksi, bukan tebakan dari ekstensi. */
  tipe: 'musicxml' | 'pdf'
  ukuran: number
  hash: string
  updatedAt: number
}
```

Kenapa store terpisah dan bukan kolom di `songs`: satu partitur 32 birama
berukuran puluhan–ratusan KB, dan `songs` ikut terkirim di **setiap** berkas
show/repertoar/paket. Memasukkan XML ke sana membuat berkas pertukaran
membengkak — persis yang diperingatkan §11: *"Berkas show & repertoar dapat
membawa rujukan partitur (id lagu), bukan notasi penuh, agar ukuran paket
tetap wajar."*

### 3.2 Metadata di `Song`

```ts
// src/db/types.ts — di dalam interface Song (686), dekat `rekaman?` (737)
export interface Song {
  …
  /** #11a — metadata partitur; bitanya di store `partiturBerkas`. */
  partitur?: PartiturMeta | null
}

export interface PartiturMeta {
  namaFile: string
  tipe: 'musicxml' | 'pdf'
  ukuran: number
  /** SHA-256 hex — untuk tahu apakah Blob lokal masih cocok dengan metadata. */
  hash: string
  /** 'partwise' (umum) atau 'timewise' (measure-major). */
  susunan?: 'partwise' | 'timewise'
  judul?: string          // <movement-title> / <work-title> / <identification>
  pengarang?: string      // <creator type="composer">
  jumlahBirama: number    // birama terbanyak di antara semua part
  jumlahPart: number
  /** Urutan sesuai <part-list> — bahan part per instrumen di 11c. */
  parts: { id: string; nama: string; singkatan?: string }[]
  sukat?: { beats: number; beatType: number }   // sukat pertama
  /**
   * Setiap `<time>` yang berbeda dari sebelumnya, berurutan, dengan nomor
   * biramanya. Lagu 4/4 murni menghasilkan satu entri; lagu bersukat campur
   * (7/8 di tengah) beberapa. Inilah "struktur" yang bisa dibaca pelatih
   * tanpa merender apa pun, sekaligus bahan pemilih rentang frasa di 11d.
   */
  perubahanSukat: { birama: number; beats: number; beatType: number }[]
  tempo?: number                                // <sound tempo> pertama (BPM)
  /**
   * `false` bila berkasnya XML yang sah tetapi pemindai kita tidak sanggup
   * meringkasnya (keputusan D4, §4.1). Berkasnya **tetap disimpan** dan ikut
   * terbawa di ZIP; hanya ringkasannya yang kosong.
   */
  terurai: boolean
  /** Pesan galat parser bila `terurai: false` — ditampilkan apa adanya. */
  ringkasGagal?: string
  dipasangiAt: number
}
```

Aturan yang dipegang: **metadata kecil dan selalu ikut terkirim**, bita tidak
pernah ikut. Kalau metadata ada tapi Blob-nya tidak ada di perangkat ini
(mis. anggota menerima berkas show tanpa ZIP), UI menyebut "partitur tercatat,
berkasnya belum ada di perangkat ini" — bukan error, dan tidak pernah buntu.

---

## 4. Modul baru `src/lib/partitur.ts` (murni, teruji di node)

Tanpa DOM, tanpa dependensi — pola `pyware.ts`/`csvKoordinat.ts`.

```ts
export type JenisPartitur = 'musicxml' | 'mxl' | 'pdf'

/** Deteksi dari bita: PDF dari magic `%PDF-`, ZIP dari magic PK, sisanya XML. */
export function deteksiPartitur(bita: Uint8Array): {
  ya: boolean
  tipe?: JenisPartitur
  alasan?: string        // kenapa ditolak — selalu ada, tidak pernah diam
}

/** Ringkas isi MusicXML tanpa merender. Galat dikembalikan, tidak dilempar. */
export function ringkasMusicXml(teks: string):
  | { ok: true; ringkas: RingkasanPartitur }
  | { ok: false; galat: string }
```

`RingkasanPartitur` = bidang yang sama dengan `PartiturMeta` (tanpa
hash/ukuran/`terurai`).

**Galat parser tidak memblokir penyimpanan** (keputusan D4). Bila
`ringkasMusicXml` mengembalikan `ok: false` sementara `deteksiPartitur` yakin
ini MusicXML, berkas tetap dipasang dengan `terurai: false` dan `ringkasGagal`
terisi; UI menampilkan pesan itu apa adanya. Alasannya: OSMD di 11b memakai
parser XML sungguhan, jadi berkas yang menjegal pemindai kita bisa saja tetap
terender nanti — menyimpannya lebih berguna daripada menolaknya, dan pelatih
tidak kehilangan berkas hanya karena keterbatasan parser kita.

### 4.1 Parser: pemindai tag kecil, bukan parser XML penuh

Yang diambil hanya tag yang dibutuhkan, dengan pemindai `<tag attr="…">`:

| Data | Sumber di MusicXML |
| --- | --- |
| judul | `<movement-title>`, `<work-title>`, `<identification><creator>` |
| susunan | akar `<score-partwise>` vs `<score-timewise>` |
| daftar part | `<part-list><score-part id="P1"><part-name>` + `<part-abbreviation>` |
| jumlah birama | cacah `<measure number="…">` per part → ambil maksimum |
| sukat pertama | `<attributes><time><beats>`/`<beat-type>` pertama |
| perubahan sukat | setiap `<time>` yang berbeda dari sebelumnya + nomor biramanya |
| tempo | `<sound tempo="…">` pertama |

Batas yang **disengaja** dan harus tertulis di komentar modul:

- Hanya lima entitas bawaan XML (`&amp; &lt; &gt; &quot; &apos;`); entitas lain
  → galat jelas. `<![CDATA[ ]]>` diperlakukan sebagai teks mentah.
- Namespace di luar default tidak ditelusuri; `<score-partwise>` harus muncul
  sebagai elemen akar (BOM, spasi, deklarasi `<?xml …?>`, DOCTYPE, dan komentar
  sebelum akar ditoleransi — semuanya ada di ekspor nyata).
- Ukuran maksimum 8 MB dan 5.000 birama; lebih dari itu ditolak dengan pesan
  yang menyebut batasnya, bukan menggantung.
- XML terpotong → `galat`, bukan ringkasan setengah jadi.
- Setiap `galat` **menyebut apa yang dilihat**, bukan sekadar "gagal": mis.
  `"elemen akar <html>, bukan <score-partwise>/<score-timewise>"`,
  `"entitas &nbsp; tidak dikenal"`, `"8,4 MB melebihi batas 8 MB"`. Pelatih
  harus bisa memutuskan sendiri langkah berikutnya dari pesan itu.

Alternatif yang **ditolak**: `DOMParser` (hanya ada di peramban → tidak bisa
diuji di node) dan menambah dependensi XML (melanggar "tanpa biaya, tanpa
dependensi baru").

### 4.2 Hash

Pakai ulang `hitungHashAudio` (`rekaman.ts:21`) — namanya menyebut audio tapi
isinya SHA-256 atas bita. Di 11a dipakai apa adanya; kalau nanti mengganggu,
pindah ke `src/lib/sidik.ts` sebagai alias (jangan menyalin kodenya).

---

## 5. Deteksi di pintu #7

### 5.1 Jenis baru

```ts
// bukaBerkas.ts:35  union
| 'partitur'

// bukaBerkas.ts:51  LABEL_JENIS
partitur: 'Partitur (MusicXML / PDF) (#11a)',

// bukaBerkas.ts:77  TUJUAN_JENIS
partitur: { rute: '/musik', tempat: 'Musik → Partitur lagu' },
```

### 5.2 Cabang deteksi di `kenaliBerkas` (311)

Urutan cabang jadi: ZIP → **partitur** → CSV → tidak dikenal.

- `%PDF-` di 4 bita pertama → `partitur` dengan `tipe: 'pdf'`.
- Teks yang akarnya `<score-partwise>`/`<score-timewise>` → `partitur`,
  `tipe: 'musicxml'`, plus `ringkasMusicXml` untuk pratinjau.
- ZIP yang memuat `META-INF/container.xml` → **`.mxl`, ditolak dengan pesan
  petunjuk**, bukan gagal diam-diam. Alasannya terukur dari kode kita sendiri:
  `bukaZip` hanya membaca metode 0 "stored" (`zip.ts:148`), sedangkan `.mxl`
  hasil MuseScore dipadatkan deflate. Pesannya: *"Ini MusicXML terkompresi
  (.mxl). Simpan ulang dari MuseScore sebagai 'MusicXML file (*.musicxml)' —
  DrillKit belum membuka yang terkompresi."*
  **Keputusan D1: 11a berhenti di pesan itu.** Membaca deflate berarti
  menambah varian *async* pada `bukaZip`, padahal `zip.ts` dipakai jalur
  backup & pulihkan — risiko regresi di jalur paling sensitif tidak sebanding
  dengan satu format yang bisa dihindari dari aplikasi notasinya. Dukungan
  `DecompressionStream('deflate-raw')` di peramban sasaran juga **belum saya
  verifikasi**. Dicatat sebagai kandidat 11b: `bukaZipAsync` +
  `DecompressionStream`, diuji di node (Node ≥ 18 punya global yang sama),
  dan tidak boleh menyentuh jalur backup. (`DecompressionStream('deflate-raw')`
  sudah dipastikan tersedia di Node 22 — versi yang sama dipakai CI,
  `node-version: 22` — jadi varian itu bisa diuji tanpa peramban.)

### 5.3 Pratinjau & aturan mode

- `BerkasDikenal` dapat `partiturZip?: number`, meniru `audioZip` (116) supaya
  pratinjau ZIP menyebut "N partitur" di samping "N rekaman".
- Baris pratinjau: judul, pengarang, birama, jumlah part, sukat, tempo.
- `aturMode` (461): partitur **boleh di kedua mode**. Perlu pengecualian
  eksplisit sebelum penolakan umum `mode === 'member' && jenis !== 'paket'`,
  karena anggota justru yang paling butuh membaca part-nya.

---

## 6. UI minimum (tanpa render)

Komponen baru `src/components/PanelPartitur.tsx`, dipasang di `src/pages/Music.tsx`
di samping `PanelLagu.tsx` (satu-satunya pemakai `PanelLagu` saat ini). Isinya:

1. Tombol pasang berkas (`<input type="file" accept=".musicxml,.xml,.pdf">`),
   seret-lepas mengikuti pola `lapisan-seret` yang sudah ada.
2. Ringkasan hasil `ringkasMusicXml` — tabel part, birama, sukat, tempo.
3. Kuota: `cekPenyimpanan()`; di atas 50% tampilkan peringatan + tombol
   `mintaPenyimpananPersisten()`. Salin susunan kalimat dari
   `ModalRekamanLagu.tsx` supaya nadanya sama, termasuk catatan iPhone.
4. Lepas partitur: hapus Blob **setelah** metadata kosong tersimpan.

`testid` mengikuti konvensi: `panel-partitur`, `partitur-pilih`,
`partitur-ringkas`, `partitur-part`, `partitur-kuota`, `partitur-hapus`,
`partitur-tak-ada`.

---

## 7. Round-trip ZIP & pertukaran berkas

Meniru `audio/` sepasang demi sepasang:

| Tempat | Sekarang (#6) | Tambahan 11a |
| --- | --- | --- |
| `backup.ts:167` `downloadBackupZip` | `audio/{songId}_{nama}` + `audio/manifest.json` | `partitur/{songId}_{nama}` + `partitur/manifest.json` |
| `PulihkanBackup.tsx:57` | baca `audio/manifest.json` | baca `partitur/manifest.json`, tulis Blob ke `partiturBerkas` |
| `bukaBerkas.ts:320` | hitung entri `audio/` | hitung entri `partitur/` → `partiturZip` |
| `repertoar.ts:32` `bangunPaket` | `Song.rekaman` (metadata) | `Song.partitur` (metadata) — bita tetap di ZIP |
| `bukaBerkas.ts:516` `hitungBaruTimpa` | — | partitur ikut dihitung sebagai baru/timpa |

Nama entri dibersihkan dengan pola yang sama (`replace(/[^\w.-]/g, '_')`,
`backup.ts:181`) supaya ZIP tetap bisa dibuka di mana pun.

---

## 8. Riwayat & kegagalan

- `riwayat.ts` berlingkup **drill** (`drillId`), jadi perubahan lagu tidak
  tercakup. Ganti aturan: memasang partitur di atas yang lama meminta
  konfirmasi yang menyebut nama berkas lama, dan Blob lama baru dihapus
  setelah Blob baru tersimpan — jadi tidak ada jendela "dua-duanya hilang".
- Metadata ada, Blob hilang → UI menampilkan keadaan itu apa adanya.
- Berkas rusak → pesan `galat` dari `ringkasMusicXml` tampil utuh; pintu #7
  tetap bisa ditutup. Tidak boleh ada jalan buntu (aturan cetak & PWA).

---

## 9. Uji

### 9.1 `qa/partitur-logika.mjs` (node, tanpa peramban)

Fixture dibuat tangan (bukan salinan berkas berhak cipta):

- MuseScore 3, MuseScore 4, Sibelius-style, Finale, keluaran plug-in Dolet,
  dan satu `score-timewise`.
- Sukat 4/4, 7/8, dan sukat berubah di tengah lagu.
- `<part-list>` 6 part dengan `<part-abbreviation>`.
- `<sound tempo="120">` dan tanpa tempo.
- BOM + CRLF, komentar sebelum akar, DOCTYPE, `&amp;` di judul.
- XML terpotong, berkas > 8 MB, 6.000 birama, entitas tak dikenal → galat.
- PDF (`%PDF-`) → `tipe: 'pdf'` tanpa parser.
- `.mxl` (ZIP + `META-INF/container.xml`) → ditolak dengan pesan petunjuk.
- Round-trip: `bikinZip` → `bukaZip` → bita identik & manifest cocok.
- Hash stabil untuk bita yang sama, beda untuk 1 bita berbeda.
- Sukat campur (4/4 → 7/8 di birama 17 → 4/4) → `perubahanSukat` tiga entri
  dengan nomor birama yang benar.
- XML sah yang **tidak** sanggup diringkas pemindai (akar tak dikenal) → tetap
  terpasang dengan `terurai: false` dan `ringkasGagal` terisi (D4).

Target: **≥ 90 asersi**, keluaran berakhiran `N lulus, M gagal`, exit code.

### 9.2 `qa/partitur-impor.mjs` (peramban, hanya jalan di CI)

Seret `.musicxml` ke pintu #7 → pratinjau menyebut *Partitur (MusicXML)* →
pasang ke sebuah lagu → muat ulang halaman → Blob masih ada (IndexedDB) →
unduh ZIP → di DB bersih, pulihkan → partitur kembali utuh (hash sama).

### 9.3 Pendaftaran

- `qa/bangun-logika.sh`: tambah `rakit src/lib/partitur.ts partitur`
  (di dekat baris 97 tempat `rekaman` dirakit).
- `qa/regresi-penuh.sh`: tambah `partitur-logika partitur-impor` → 104 jadi
  **106 rangkaian**; angka di komentar kepala `ci.yml` ikut diperbarui.
- `qa/buka-berkas-logika.mjs`: +asersi untuk `jenis: 'partitur'`, label,
  `TUJUAN_JENIS`, dan `aturMode` di kedua mode.

---

## 10. Berkas yang disentuh

| Berkas | Perubahan |
| --- | --- |
| `src/lib/partitur.ts` | **baru** — deteksi + ringkasan (murni) |
| `src/components/PanelPartitur.tsx` | **baru** — pasang/lepas + ringkasan + kuota |
| `src/db/db.ts` | versi 10, store `partiturBerkas` |
| `src/db/types.ts` | `PartiturMeta`, `PartiturBerkasItem`, `Song.partitur` |
| `src/lib/bukaBerkas.ts` | jenis `partitur`, deteksi, pratinjau, `aturMode` |
| `src/lib/backup.ts` | entri `partitur/` + manifest di ZIP |
| `src/components/PulihkanBackup.tsx` | pulihkan Blob partitur |
| `src/lib/repertoar.ts` | bawa `partitur` metadata |
| `src/pages/Music.tsx` (induk `PanelLagu`) | pasang `PanelPartitur` |
| `qa/partitur-logika.mjs`, `qa/partitur-impor.mjs` | **baru** |
| `qa/bangun-logika.sh`, `qa/regresi-penuh.sh`, `qa/buka-berkas-logika.mjs` | pendaftaran |
| `RANCANGAN-LANJUTAN.md`, `IDE-PENGEMBANGAN.md`, `.github/workflows/ci.yml` | status & angka rangkaian |

---

## 11. Keputusan (ditetapkan 10 Okt 2026)

Empat titik yang tadinya terbuka sudah diputuskan; alasannya dicatat supaya
bisa dibantah dengan alasan juga.

**D1 — `.mxl` ditolak di 11a, dengan pesan petunjuk.** Membaca deflate
memaksa varian *async* pada `bukaZip` (`zip.ts`), modul yang dipakai jalur
backup & pulihkan. Risiko regresi di jalur paling sensitif tidak sebanding
dengan satu format yang bisa dihindari dari aplikasi notasinya, dan dukungan
`DecompressionStream('deflate-raw')` di peramban sasaran belum terverifikasi.
→ Kandidat 11b: `bukaZipAsync`, diuji di node, tidak menyentuh jalur backup.

**D2 — nama store `partiturBerkas`.** Mengikuti `rekamanAudio` yang memang
jadi cetak birunya: kata benda + jenis isinya. Store baru di proyek ini
bernama Indonesia (`rekamanAudio`, `simpanan`, `riwayat`, `kemajuan`,
`evaluasi`), dan "berkas" menyebut apa yang ada di dalamnya (bita), bukan
konsep domainnya. `partiturScore` mencampur Indonesia-Inggris.

**D3 — 11a tetap tanpa render, tapi ringkasannya diperkaya.** Batas "tidak
merender" dipertahankan supaya seluruh logika teruji di node dan PR-nya bisa
dihijaukan tanpa peramban. Sebagai gantinya ringkasan tidak berhenti di
"jumlah birama": `perubahanSukat[]` memberi pelatih struktur lagu (sukat apa
di birama berapa) — cukup untuk memastikan berkas yang terpasang benar dan
untuk merencanakan frasa, dan memang data yang dibutuhkan 11d. Murah
dihitung: pemindai sudah melewati setiap `<measure>`.

**D4 — parser tulisan tangan, dan kegagalannya tidak memblokir apa pun.**
`DOMParser` tidak tersedia di node dan dependensi XML baru melanggar aturan
proyek, jadi pemindai tag kecil tetap dipakai. Risikonya ekspor yang tidak
lazim; penawarnya tiga lapis: (a) fixture dari lima sumber (MuseScore 3 & 4,
Sibelius, Finale, Dolet), (b) setiap `galat` menyebut apa yang dilihat, dan
(c) berkas yang gagal diringkas **tetap disimpan** dengan `terurai: false` —
sebab OSMD di 11b memakai parser XML sungguhan, jadi yang menjegal pemindai
kita belum tentu menjegal perender.

Sisa risiko yang tidak dihilangkan: ekspor eksotis bisa membuat ringkasan
kosong (D4c membatasi dampaknya), dan penolakan `.mxl` menambah satu langkah
bagi pengguna MuseScore yang terbiasa mengekspor terkompresi (pesannya
menyebut cara memperbaikinya).

---

## 12. Kriteria terima

- [ ] `.musicxml` dan `.pdf` dikenali pintu #7 dengan label & tujuan yang benar.
- [ ] `.mxl` ditolak dengan pesan yang menyebut cara menyimpan ulang.
- [ ] Ringkasan (judul, birama, part, sukat, tempo) benar untuk fixture tiga aplikasi.
- [ ] Blob tersimpan di IndexedDB dan **selamat setelah muat ulang**.
- [ ] ZIP backup memuat `partitur/…` + manifest; pemulihan di DB bersih mengembalikan bita identik.
- [ ] Berkas show/repertoar **tidak membesar** karena notasi (hanya metadata).
- [ ] Peringatan kuota muncul dan `persist()` bisa diminta.
- [ ] `qa/partitur-logika.mjs` ≥ 90 asersi, `0 gagal`; terdaftar di `regresi-penuh.sh`.
- [ ] Sukat campur menghasilkan `perubahanSukat` dengan nomor birama yang benar.
- [ ] Berkas XML yang gagal diringkas tetap terpasang (`terurai: false`) dan pesannya tampil.
- [ ] `tsc --noEmit` bersih; tidak ada dependensi baru; tidak ada `oklch()`/`color-mix()`.

---

## 13. Urutan pengerjaan

1. `src/lib/partitur.ts` + `qa/partitur-logika.mjs` → **hijau di node dulu**,
   sebelum ada satu pun perubahan UI. (Verifikasi: `bash qa/bangun-logika.sh
   && JEDA=0 bash qa/regresi.sh http://localhost:4173 partitur-logika`.)
2. Store versi 10 + tipe + `Song.partitur`.
3. Pintu #7: jenis, deteksi, pratinjau, `aturMode` → tambah asersi di
   `qa/buka-berkas-logika.mjs`.
4. `PanelPartitur.tsx` + kuota.
5. ZIP: ekspor → pratinjau → pulihkan.
6. `qa/partitur-impor.mjs` + pendaftaran di `regresi-penuh.sh`.
7. Dokumen: status §11 di `RANCANGAN-LANJUTAN.md` (termasuk memperbarui sel
   tabel baris 56 yang masih berbunyi *"Menunggu — jangan mulai pada tahap
   ini"*), bullet di `IDE-PENGEMBANGAN.md`, jumlah rangkaian di `ci.yml`.
