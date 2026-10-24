# Rencana teknis #11c — Partitur: filter *part* per instrumen / *section* anggota & cetak HTML murni hex

**Induk:** `RANCANGAN-LANJUTAN.md` §11 & lanjutan langsung `RANCANGAN-11a-PARTITUR-MUSICXML.md` + `RANCANGAN-11b-PARTITUR-RENDER.md`.
**Status:** rancangan siap dikerjakan (disusun 24 Okt 2026 di branch `arena/81283383-drillkit`, di atas `main` `93b1233` pasca PR #22).

---

## 1. Kenapa #11c dipisah dari 11d

Setelah **#11a** (PR #20 & #21) dan **#11b** (PR #22) selesai di `main`, DrillKit sudah mampu menyimpan MusicXML/`.mxl`/PDF secara *offline* di IndexedDB, membawanya lewat ZIP backup, dan merender *full score* SVG dengan palet heksadesimal murni (`#ffffff` / `#0f172a`) lewat `opensheetmusicdisplay@2.2.1` yang dimuat secara malas (*lazy-loaded*).

Namun di lapangan latihan masih ada dua hambatan nyata yang langsung terasa oleh pelatih dan anggota:

1. **Layar HP anggota terlalu sempit untuk 10–16 paranada sekaligus.** Pemain *Trumpet 2* atau *Snare Drum* yang membuka *full score* di layar 6 inci harus memperbesar dan menggeser terus-menerus hanya untuk melacak satu baris miliknya sendiri — padahal di mode anggota (`Share.tsx`) ia sudah memilih namanya lengkap dengan `section` dan `instrument`.
2. **Belum ada jalur cetak / lembar HTML per instrumen.** Sebelum turun ke lapangan atau latihan seksi (*sectional*), pelatih biasa membagikan lembar *part* per instrumen (A4 di *music stand* atau ukuran buku saku/*lyre* A5 mendatar yang dijepit di instrumen). Saat ini belum ada tombol cetak maupun unduh HTML mandiri dari partitur yang sedang disaring.

Memisahkan **#11c** (penyaringan *part*/*section* + pencocokan otomatis anggota + paginasi cetak & ekspor HTML murni hex) dari **#11d** (kursor/*highlight* birama aktif sinkron `TempoTimeline` + *loop* frasa + tautan frasa↔set drill) menjaga agar tata letak statis & cetak beres dan teruji penuh sebelum menyentuh sinkronisasi waktu nyata mesin WebAudio.

| Bagian | Isi | Status |
| --- | --- | --- |
| **11a** | Simpan Blob IndexedDB, deteksi pintu #7, pemindai ringkasan murni, kuota, round-trip ZIP | **Selesai** (PR #20 & #21) |
| **11b** | Urai `.mxl` (`DecompressionStream`), render *full score* MusicXML offline (OSMD SVG hex, *lazy-load*, bertahap), dan lembar PDF | **Selesai** (PR #22) |
| **11c (dokumen ini)** | **Filter *part* per instrumen & kelompok *section***, **pilihan bawaan cerdas sesuai anggota aktif**, serta **pratinjau cetak & unduh HTML mandiri murni hex (`A4 Tegak` / `A4 Mendatar` / `Buku Saku A5`)** | **Tahap ini** |
| 11d | *Highlight* birama aktif sinkron `TempoTimeline` + pilih & *loop* frasa + tautan frasa↔set drill | Menyusul |

### Batas 11c

- **Masuk:**
  1. Modul murni `src/lib/partiturBagian.ts` (tanpa DOM/Dexie/OSMD, tanpa dependensi baru): klasifikasi nama & singkatan `<score-part>` dwibahasa (Indonesia + Inggris) ke keluarga instrumen marching band, pemetaan ke `SectionDef[]` dinamis tim, serta penentuan filter awal otomatis dari `Member` aktif (`instrument` → `section` → *fallback* `Full score`).
  2. Modul murni `src/lib/partiturCetak.ts` (tanpa DOM/Dexie/OSMD): penyusun dokumen HTML cetak mandiri murni hex (`#ffffff` / `#0f172a`, nol `oklch()` / `color-mix()`), injeksi `viewBox` SVG agar skalanya proporsional di semua ukuran kertas & peramban HP, dukungan tiga ukuran kertas (`A4 Tegak`, `A4 Mendatar`, `Buku Saku / Lyre A5 Mendatar`), bilah `.no-print` di dalam berkas `.html` hasil unduhan, dan penamaan berkas jelas bergaya pintu #7.
  3. Perluasan `src/lib/partiturRender.ts`: dukungan `filterIdXml` (`Instrument.Visible` + `Staff.Visible` + `osmd.updateGraphic()` sebelum `renderNext()`/`render()`, otomatis menyatukan istirahat multi-birama `|— N —|` saat 1 *part* dipilih) serta fungsi `renderHalamanCetakPartitur` yang memaginasi per halaman fisik (`PageFormatStandards` OSMD) di wadah lepas-layar (*offscreen*).
  4. Perluasan `src/components/LayarPartitur.tsx`, `src/pages/Music.tsx`, dan `src/pages/Share.tsx` (+ komponen modal `PratinjauCetakPartitur`): bilah filter *Full score* / per *section* / per *part* (diingat per lagu di `localStorage`), lencana pencocokan anggota aktif di mode anggota, serta jendela pratinjau cetak `<iframe srcDoc>` + tombol **Unduh HTML** & **Cetak** anti-buntu (`cetakAtauUnduh`).
  5. Rangkaian uji Node murni (`qa/partitur-bagian-logika.mjs`) dan peramban ujung-ke-ujung (`qa/partitur-cetak.mjs`), terdaftar di `qa/bangun-logika.sh`, `qa/regresi-penuh.sh`, dan `.github/workflows/ci.yml` (**109 → 111 rangkaian**).
- **Tidak masuk:** penyorotan birama berjalan saat metronom/rekaman berbunyi, pemilihan rentang birama untuk *loop* frasa, dan penautan frasa ke set drill (ketiganya cakupan penuh **11d**), maupun transposisi tangga nada ulang di luar yang sudah tertulis di MusicXML.

---

## 2. Fakta terukur dari audit kode & bundel OSMD (24 Okt 2026)

Seluruh rancangan di bawah bertumpu pada lima temuan faktual dari kode `main` (`93b1233`) dan `opensheetmusicdisplay@2.2.1` (tanpa menambah satu pun paket npm baru — tetap 8 dependensi runtime):

1. **ID *section* bawaan vs label tampil (`src/lib/utils.ts:154`, `src/db/types.ts:16`):**
   - `BUILTIN_SECTIONS` memakai pasangan `{ id: 'brass', label: 'Brass' }`, `{ id: 'woodwind', label: 'Woodwind' }`, **`{ id: 'percussion', label: 'Battery' }`** (perhatikan `id`-nya `'percussion'` sedangkan labelnya `'Battery'`), `{ id: 'pit', label: 'Pit' }`, `{ id: 'guard', label: 'Color Guard' }`, `{ id: 'fc', label: 'FC' }`, dan `{ id: 'other', label: 'Lainnya' }`.
   - Selain itu `SectionDef` bersifat **dinamis** (pelatih bebas menambah/mengganti nama *section* di Pengaturan, mis. `Horn Line` atau `Pianika`), dan `DEFAULT_SECTIONS` menyembunyikan `woodwind` secara bawaan (`hidden: 1`) walau berkas MusicXML tim bisa saja memuat *Flute*/*Clarinet*/*Saxophone*. Artinya pengelompokan *part* di `LayarPartitur` **tidak boleh membuang *part* yang `SectionDef`-nya disembunyikan atau belum terdaftar**.
2. **Identitas anggota di tab Musik mode anggota (`src/pages/Share.tsx:872` & `qa/musik-anggota.mjs`):**
   - Di `MemberView` (`Share.tsx`), `<Music hanyaPutar />` dirender langsung pada `tab === 'musik'` dan **sengaja boleh dibuka walau anggota belum memilih namanya** (`me === null` — diuji ketat oleh `qa/musik-anggota.mjs`).
   - Saat anggota **sudah** memilih namanya (atau membuka paket pribadi yang otomatis menyetel `meId`), objek `me: Member` tersedia lengkap dengan `me.section` (mis. `'brass'`, `'percussion'`, `'pit'`, `'guard'`) dan `me.instrument` (mis. `'Trumpet'`, `'Snare'`, `'Marimba'`, `'Flag'`, lihat `src/db/seed.ts:17`). Meneruskan prop opsional `anggotaAktif?: Pick<Member, 'id' | 'name' | 'panggilan' | 'section' | 'instrument'> | null` ke `<Music hanyaPutar anggotaAktif={me} />` memberi konteks penuh tanpa melanggar syarat pakai-tanpa-nama.
3. **Urutan wajib `Instrument.Visible` + `osmd.updateGraphic()` di `opensheetmusicdisplay@2.2.1`:**
   - Di `opensheetmusicdisplay.min.js`, akhir metode `osmd.load()` langsung memanggil `this.updateGraphic()` **sebelum** `Promise` kembali ke pemanggil, ketika semua `Sheet.Instruments[i].Visible` masih `true`.
   - Setter `inst.Visible = false` hanya mengubah `Voices[k].Visible`, sedangkan `isVisible()` juga memeriksa `inst.Staves`. Maka penyaringan wajib menyetel `inst.Visible = tampil` **dan** setiap `staff.Visible = tampil`, lalu memanggil **`osmd.updateGraphic()`** sebelum `renderNext()` / `render()`.
   - Keuntungan langsungnya: karena opsi bawaan `autoGenerateMultipleRestMeasuresFromRestMeasures` bernilai `true`, memanggil `osmd.updateGraphic()` sesudah menyembunyikan *part* lain membuat OSMD **otomatis menggabungkan birama istirahat berurutan pada *part* tunggal menjadi lambang istirahat multi-birama standar (`|— 8 —|`)** — persis cetakan *part* dari MuseScore/Sibelius.
   - Saat hanya **1 instrumen** yang tampil (`jumlahTampil === 1`), `drawPartNames` & `drawPartAbbreviations` dimatikan pada kanvas agar lebar baris pertama maupun baris berikutnya dipakai penuh untuk notasi (judul *part* sudah tertulis jelas di kepala lembar & bilah filter); saat `≥ 2` instrumen tampil (mis. kelompok *Brass* atau *Full score*), nama & singkatan *part* tetap digambar di kiri paranada.
4. **Paginasi kertas fisik vs jebakan pemotongan paranada saat cetak:**
   - Di layar (`LayarPartitur`), `pageFormat: 'Endless'` menghasilkan satu gulungan menerus yang nyaman dibaca. Namun bila satu `<svg>` setinggi 4.500 px langsung dicetak ke kertas A4, peramban akan **memotong garis paranada tepat di tengah halaman**.
   - `OpenSheetMusicDisplay.PageFormatStandards` sudah menyediakan paginasi bawaan berbasis milimeter: **`A4_P`** (`210×297 mm`), **`A4_L`** (`297×210 mm`), dan **`A5_L`** (`210×148 mm` — setengah A4 mendatar, ukuran standar buku saku / *flip-folder lyre* marching band). Dengan `pageFormat` tersebut, OSMD memecah skor tepat di batas antarsistem menjadi satu elemen `<svg id="osmdSvgPage1">`, `<svg id="osmdSvgPage2">`, dst. per halaman kertas.
5. **Jebakan `<svg>` VexFlow tanpa `viewBox`:**
   - Backend SVG VexFlow (`this.paper.setSize(w, h)`) menulis atribut piksel `<svg width="794" height="1123">` **tanpa** atribut `viewBox`. Bila CSS cetak atau bingkai pratinjau menerapkan `width: 100%; height: auto;`, elemen `<svg>` tanpa `viewBox` akan **terpotong tepi kanannya** alih-alih mengecil secara proporsional.
   - Karena itu `siapkanSvgHalamanCetak(svgHtml)` di `partiturCetak.ts` wajib membaca `width` & `height` pembuka `<svg>`, menyuntikkan `viewBox="0 0 {w} {h}"` bila belum ada, dan merapikan `style` ke unit responsif murni hex.

---

## 3. Pencocokan *part* ↔ *section* & anggota — modul murni `src/lib/partiturBagian.ts`

Tanpa DOM, tanpa Dexie, tanpa OSMD — dirakit oleh `qa/bangun-logika.sh` ke `/tmp/partiturBagian.mjs` agar seluruh kamus pencocokan instrumen diuji cepat di Node 22.

### 3.1 Model filter tampilan

```ts
// src/lib/partiturBagian.ts
import type { BagianPartitur, SectionDef } from '../db/types'

export type KeluargaInstrumen = 'brass' | 'woodwind' | 'percussion' | 'pit' | 'lainnya'

export type FilterPartitur =
  | { jenis: 'semua' }
  | {
      /** Satu kelompok seksi (mis. semua part Brass atau Battery di skor ini). */
      jenis: 'kelompok'
      kelompokId: string
      label: string
      partIds: string[]
    }
  | {
      /** Satu <score-part> spesifik (mis. "P1" = Trumpet 1). */
      jenis: 'part'
      partId: string
      label: string
    }
  | {
      /** Beberapa part sejenis hasil pencocokan instrumen anggota (mis. Trumpet 1 & Trumpet 2). */
      jenis: 'instrumen'
      label: string
      partIds: string[]
    }

export interface KelompokPartSkor {
  /** Mengikuti `SectionDef.id` tim bila cocok, atau keluarga bawaan (`'woodwind'`, `'lainnya'`). */
  id: string
  label: string
  /** Warna hex murni untuk titik penanda chip di UI (mis. `#f59e0b`). */
  warnaHex: string
  partIds: string[]
}
```

### 3.2 Aturan klasifikasi nama & singkatan `<score-part>`

1. **Normalisasi teks:** huruf kecil, tanda baca (`.`, `-`, `/`, `(`, `)`) diubah ke spasi tunggal, angka nomor suara (`1`, `2`, `I`, `II`, `III`, `1st`, `2nd`) dipisahkan agar `"Trumpet in Bb 1"`, `"Bb Tpt. I"`, dan `"Terompet 1"` semuanya bermuara ke kata dasar instrumennya.
2. **Frasa majemuk lebih panjang diperiksa lebih dulu daripada kata tunggal** — mencegah salah kamar yang klasik di marching band:
   - `"baritone sax"`, `"bari sax"`, `"b. sax"` → **`woodwind`** (bukan `brass` karena kata `"baritone"`).
   - `"tenor sax"`, `"t. sax"` → **`woodwind`** (bukan `percussion` karena kata `"tenor"`).
   - `"bass clarinet"`, `"b. cl."` → **`woodwind`**; `"bass drum"`, `"marching bass"`, `"b.d."` → **`percussion`**; `"electric bass"`, `"synth bass"`, `"acoustic bass"` → **`pit`**.
   - `"drum set"`, `"drumset"` → **`pit`** (*front ensemble*), sedangkan `"snare drum"`, `"tenor drum"` / `"quad"` / `"quint"` / `"multi-tom"`, `"cymbal"` → **`percussion`** (*battery*).
3. **Kamus dwibahasa (Inggris + Indonesia + singkatan umum MuseScore/Sibelius/Finale):**
   - **`brass`:** `trumpet`, `tpt`, `trp`, `terompet`, `cornet`, `kornet`, `flugelhorn`, `flugel`, `mellophone`, `mello`, `melofon`, `french horn`, `f horn`, `horn`, `hn`, `trombone`, `tbn`, `trb`, `trombon`, `baritone`, `bariton`, `bar`, `euphonium`, `euph`, `tuba`, `sousaphone`, `sousafon`, `contrabass`, `contra`.
   - **`woodwind`:** `piccolo`, `picc`, `flute`, `fl`, `suling`, `oboe`, `bassoon`, `fagot`, `clarinet`, `cl`, `klarinet`, `saxophone`, `sax`, `saksofon`, `alto sax`, `tenor sax`, `soprano sax`, `bari sax`, `recorder`, `rekorder`.
   - **`percussion` (*Battery*):** `snare`, `sd`, `senar`, `tenor drum`, `tenors`, `quad`, `quads`, `quint`, `quints`, `multi tom`, `timotom`, `bass drum`, `bd`, `cymbal`, `cym`, `simbal`, `battery`.
   - **`pit` (*Front Ensemble*):** `marimba`, `mba`, `vibraphone`, `vibes`, `vib`, `xylophone`, `xylo`, `xyl`, `glockenspiel`, `glock`, `bells`, `belira`, `bell lyra`, `marching bells`, `chimes`, `timpani`, `timp`, `synthesizer`, `synth`, `piano`, `keyboard`, `pianika`, `melodica`, `mallet`, `aux percussion`, `rack`, `tambourine`, `triangle`, `conga`, `bongo`, `timbales`, `pit`, `front ensemble`.
4. **Pemetaan ke `SectionDef[]` tim (`kelompokkanPartSkor`):**
   - Bila pelatih membuat *section* kustom yang namanya langsung cocok dengan kata instrumen (mis. `{ id: 'pianika', label: 'Pianika' }`), *part* tersebut masuk ke kelompok *section* kustom itu.
   - Selain itu dipetakan lewat keluarga instrumen ke `SectionDef` yang sesuai (`brass` → `id: 'brass'`, `percussion` → `id: 'percussion'` berlabel `Battery`, `pit` → `id: 'pit'`, `woodwind` → `id: 'woodwind'`).
   - Bila *section*-nya disembunyikan di pengaturan tim (seperti `woodwind` bawaan) tetapi **ada di dalam skor MusicXML**, chip kelompoknya **tetap dimunculkan** untuk skor tersebut supaya tidak ada *part* yang tersembunyi diam-diam; *part* yang di luar keempat keluarga (mis. `Choir`, `Violin`) dikumpulkan di kelompok `'lainnya'` (*Part lainnya*).

### 3.3 Pilihan awal cerdas untuk anggota (`pilihFilterAwalAnggota`)

Urutan prioritas saat anggota membuka partitur lagu yang belum pernah ia ubah filternya secara manual:

1. **Tidak ada anggota terpilih (`anggota === null`):** kembalikan `{ filter: { jenis: 'semua' }, keterangan: null }`.
2. **Cocok spesifik pada `anggota.instrument`:**
   - Mis. `anggota.instrument = "Trumpet"` dan skor punya `P1: Trumpet 1`, `P2: Trumpet 2` → kembalikan `{ jenis: 'instrumen', label: 'Trumpet (2 part)', partIds: ['P1', 'P2'] }` (atau `{ jenis: 'part', partId: 'P1', label: 'Trumpet' }` bila hanya satu *part* Trumpet), dengan keterangan jujur `"Menampilkan part Trumpet sesuai profil kamu"`.
   - Bila anggota menulis nomor suara di profilnya (mis. `anggota.instrument = "Trumpet 2"`), prioritaskan pencocokan nomor suara tepat ke `Trumpet 2` (`P2`).
3. **Cadangan pada `anggota.section`:**
   - Mis. `anggota.instrument = "Flugelhorn"` (tidak ada di skor), `anggota.section = "brass"`, dan skor punya *part* kelompok `Brass` → kembalikan `{ jenis: 'kelompok', kelompokId: 'brass', ... }` dengan keterangan `"Part Flugelhorn tersendiri tidak ada — menampilkan kelompok Brass"`.
4. **Cadangan aman ke `Full score` (mis. anggota *Color Guard* / *Drum Major* / seksi yang tidak ada di skor):**
   - Kembalikan `{ jenis: 'semua' }` dengan keterangan tenang `"Tidak ada part khusus Color Guard di berkas ini — menampilkan Full score"`. Tidak pernah gagal, tidak pernah menghasilkan kanvas kosong.

### 3.4 Mengingat pilihan filter per lagu di perangkat (`localStorage`)

- Kunci: `drillkit_partitur_filter_v1` — objek ringkas `{ [songId]: SimpananFilterLagu }`, dibatasi maksimal 50 lagu terakhir (FIFO) supaya `localStorage` tetap ramping.
- Saat `partIds` yang tersimpan diuji terhadap skor baru (mis. pelatih mengganti berkas MusicXML lagu itu dengan susunan `<score-part>` berbeda), hanya `partId` yang **masih ada** di skor yang dipakai; bila tak satu pun tersisa, otomatis kembali ke aturan 3.3 / `Full score`.

---

## 4. Cetak & Unduh HTML murni hex — modul murni `src/lib/partiturCetak.ts`

Mengikuti pola baku `src/lib/laporan.ts` & `src/lib/panduan.ts`: seluruh string HTML disusun di modul murni tanpa DOM agar bisa diuji ketat di Node 22 (termasuk pemeriksaan otomatis ketiadaan `oklch()` / `color-mix()`, keutuhan `viewBox`, `@page`, dan `.no-print`).

### 4.1 Ukuran kertas & orientasi (`UkuranKertasPartitur`)

| Kode | Label UI | Dimensi fisik (`@page`) | Lebar render OSMD (96 dpi) | Bawaan otomatis |
| --- | --- | --- | --- | --- |
| `'A4_P'` | `A4 Tegak` | `210mm 297mm` | `794 px` | Bawaan saat **1–3 *part*** tampil (part instrumen / latihan seksi) |
| `'A4_L'` | `A4 Mendatar` | `297mm 210mm` | `1122 px` | Bawaan saat **≥ 4 *part*** tampil (*Full score* agar birama tidak sempit) |
| `'A5_L'` | `Buku Saku / Lyre (A5 Mendatar)` | `210mm 148mm` | `794 px` | Pilihan cepat untuk cetakan *flip-folder* yang dijepit di instrumen |

Ditambah pilihan **Skala notasi cetak (`SkalaCetakPartitur`):** `'padat'` (`0.82`), `'normal'` (`0.95`, bawaan), dan `'besar'` (`1.10`).

### 4.2 Normalisasi SVG & palet heksadesimal ketat

```ts
// src/lib/partiturCetak.ts
export type UkuranKertasPartitur = 'A4_P' | 'A4_L' | 'A5_L'
export type SkalaCetakPartitur = 'padat' | 'normal' | 'besar'

export interface DataCetakPartitur {
  namaTim?: string
  judulLagu: string
  pengarang?: string
  /** Mis. "Full Score (8 part)" atau "Trumpet 1" atau "Kelompok Brass (3 part)". */
  labelBagian: string
  /** Info ringkas di kepala cetak, mis. "132 BPM · 4/4 → 3/4 · 32 birama". */
  ringkasanMusik?: string
  ukuranKertas: UkuranKertasPartitur
  /** Daftar elemen `<svg>…</svg>` per halaman dari OSMD (`osmdSvgPage1`, dst.). */
  halamanSvg: string[]
  dicetakPada?: string
}

export function siapkanSvgHalamanCetak(svgMentah: string): string
export function htmlCetakPartitur(data: DataCetakPartitur): string
export function namaBerkasCetakPartitur(judulLagu: string, labelBagian: string, ukuranKertas: UkuranKertasPartitur): string
```

Aturan wajib di `partiturCetak.ts`:
1. **`siapkanSvgHalamanCetak(svgMentah)`:**
   - Membaca `width="W"` dan `height="H"` dari tag pembuka `<svg …>`; bila `viewBox` belum ada, menyuntikkan `viewBox="0 0 W H"`.
   - Mengatur `style="width:100%;height:auto;display:block;background:#ffffff;"` supaya SVG menyesuaikan margin printer apa pun dan lebar layar pratinjau HP tanpa terpotong.
   - Menolak/membersihkan fungsi warna CSS modern bila ada (menjamin 100% hex/rgb murni: `#ffffff`, `#0f172a`, `#334155`, `#64748b`, `#cbd5e1`, `#f8fafc`).
2. **Bilah atas `.no-print` di dalam berkas HTML mandiri:**
   - Berkas `.html` yang diunduh memuat bilah atas gelap tipis (`.no-print`, hilang otomatis saat `@media print`) berisi judul lagu, nama *part*, jumlah halaman, dan tombol **`Cetak / Simpan PDF`** (`onclick="window.print()"`). Dengan begitu pelatih/anggota yang membuka berkas `.html` di laptop lama atau lewat WhatsApp tetap punya tombol cetak satu klik di dalamnya.
3. **Tata letak `@media print`:**
   - Setiap elemen halaman dibungkus `<section class="lembar-partitur">` dengan `break-after: page; page-break-after: always;` (kecuali halaman terakhir `break-after: auto; page-break-after: auto;`) dan `break-inside: avoid;`.
   - Baris kaki tipis di tiap lembar (`#64748b`, `9pt`): `{namaTim} · {judulLagu} — {labelBagian} · Hal. {no}/{total}` agar lembaran kertas yang terjatuh di lapangan langsung ketahuan urutannya dan milik instrumen apa.
4. **Nama berkas jelas (selaras konvensi #7):**
   - `DrillKit - PARTITUR - <Judul Lagu> - <Label Bagian> (<Ukuran>).html`, dibersihkan dari karakter terlarang sistem berkas (`/\:*?"<>|`).

---

## 5. Perluasan perender `src/lib/partiturRender.ts`

### 5.1 Penyaringan instrumen pada render layar (`renderPartiturMusicXml`)

Menambahkan opsi `filterIdXml?: string[] | null` ke `OpsiRenderPartitur`:
- Bila `filterIdXml` kosong/`null`: semua instrumen `Visible = true` (*Full score*, perilaku identik `#11b`).
- Bila `filterIdXml` berisi daftar ID (mis. `['P1']` atau `['P1', 'P2']`):
  1. Sesudah `await osmd.load(siap.dok, judulCadangan)`, iterasi `osmd.Sheet.Instruments`:
     - Setel `inst.Visible = dipilih` **dan** untuk setiap `st` di `inst.Staves` setel `st.Visible = dipilih`.
  2. Pastikan minimal satu instrumen yang `Visible` benar-benar ditemukan; bila tidak ada yang cocok, kembalikan `{ ok: false, galat: 'Part yang dipilih tidak ditemukan di dalam partitur ini.' }` (tanpa melempar pengecualian).
  3. Bila tepat **1 instrumen** yang tampil (`jumlahTampil === 1`), panggil `osmd.setOptions({ drawPartNames: false, drawPartAbbreviations: false })` agar area paranada mendapat lebar penuh (terutama penting di layar HP), lalu panggil **`osmd.updateGraphic()`** sebelum memulai putaran `osmd.renderNext(...)`!
  4. `HasilSesiPartitur` mencatat `instrumen` lengkap beserta status `tampil: boolean` masing-masing (sudah disiapkan sejak `#11b`!), sehingga UI selalu tahu daftar seluruh *part* asli skor sekaligus *part* mana yang sedang digambar.

### 5.2 Render paginasi halaman cetak (`renderHalamanCetakPartitur`)

```ts
export interface OpsiRenderCetakPartitur {
  sumber: Blob | Uint8Array | string
  judulCadangan?: string
  filterIdXml?: string[] | null
  ukuranKertas: UkuranKertasPartitur
  skala?: SkalaCetakPartitur
  sinyal?: AbortSignal
}

export type HasilRenderCetakPartitur =
  | { ok: true; halamanSvg: string[]; jumlahPartTampil: number; jumlahBirama: number }
  | { ok: false; dibatalkan?: boolean; galat: string }
```

Cara kerjanya:
1. Membuat elemen `<div>` sementara di luar tampilan (`position: fixed; left: -10000px; top: 0; width: 794px | 1122px; visibility: hidden; pointer-events: none;`) di dalam `document.body` supaya OSMD memperoleh `offsetWidth` yang pasti dan tidak bergantung pada ukuran jendela pengguna saat itu (bahkan bila dibuka dari HP selebar 360 px, cetakan A4 tetap ditata selebar kertas A4 penuh!).
2. Menginisialisasi `OpenSheetMusicDisplay` dengan `backend: 'svg'`, `autoResize: false`, `pageFormat: ukuranKertas` (`'A4_P'`, `'A4_L'`, atau `'A5_L'`), palet `WARNA_PARTITUR_HEX`, dan skala zoom sesuai `SkalaCetakPartitur`.
3. Memuat dokumen XML, menyaring `Instrument.Visible` + `Staff.Visible` + `osmd.updateGraphic()`, lalu menjalankan `osmd.renderNext({ systems: 3 })` berjeda antar-bingkai sampai `done: true` supaya antarmuka pratinjau tidak membeku pada skor besar.
4. Mengambil seluruh `<svg>` yang dihasilkan (`Array.from(wadah.querySelectorAll('svg')).map((el) => el.outerHTML)`), lalu di blok `finally` **selalu** memanggil `osmd.clear()` dan `wadah.remove()` sehingga tidak ada kebocoran node DOM lepas-layar.

---

## 6. Antarmuka di `LayarPartitur.tsx`, `Music.tsx`, dan `Share.tsx`

### 6.1 Bilah filter *part* / *section* di `LayarPartitur.tsx`

Ditampilkan tepat di bawah kepala `LayarPartitur` ketika `tipe === 'musicxml'` dan daftar instrumen skor memiliki `≥ 1` *part* (`[data-testid="partitur-filter-bar"]`):

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Tampilan: [Full score (6)] [Brass (3)] [Battery (2)] [Pit (1)]           │
│           Part individu: [ Pilih 1 part… ▾ ]                             │
│           🎯 Otomatis: Trumpet (sesuai profil Andra) · [Lihat Full score]│
└──────────────────────────────────────────────────────────────────────────┘
```

- **Chip cepat (`data-kiosk-allow`):**
  - `[data-testid="partitur-filter-semua"]` — `Full score (N)`
  - `[data-testid="partitur-filter-kelompok-<id>"]` — satu chip untuk setiap kelompok *section* yang memiliki minimal 1 *part* di skor ini (mis. `Brass (3)`, `Battery (2)`, `Pit (1)`), dengan titik warna hex dari `SectionDef.dot`.
  - Bila skor hanya punya **1 *part*** (mis. berkas solo *Trumpet* yang sudah diekspor terpisah dari MuseScore), bilah chip kelompok tidak membingungkan pengguna — cukup menampilkan lencana tenang `Part tunggal: <nama>`.
- **Pemilih per *part* individu (`[data-testid="partitur-pilih-part"]`):**
  - Elemen `<select>` ramah HP berisi `— Pilih 1 part spesifik —` diikuti semua `<score-part>` sesuai urutan skor asli (`1. Trumpet 1 (Tpt. 1)`, `2. Trumpet 2 (Tpt. 2)`, dst.).
- **Keterangan pencocokan anggota aktif (`[data-testid="partitur-info-anggota"]`):**
  - Hanya muncul di mode anggota ketika `anggotaAktif` ada: menyebut dengan jujur *part*/*section* apa yang dipilihkan dan menyediakan tombol satu klik (`[data-testid="partitur-ke-part-saya"]`) bila anggota sedang melihat *Full score* dan ingin kembali ke *part* miliknya.
- **Label status sesi (`[data-testid="partitur-info-sesi"]`):**
  - Tetap mempertahankan format `#11b` saat *Full score* (`12 birama · 3 part terender · Full score (halaman)`), dan saat disaring menyebut bagian aktifnya secara jelas (`12 birama · 1/3 part · Trumpet 1 (halaman)` atau `12 birama · 2/6 part · Brass (halaman)`).

### 6.2 Jendela Pratinjau Cetak & Unduh HTML (`PratinjauCetakPartitur`)

mengikuti pola anti-buntu `Panduan.tsx` & `DotSheetModal.tsx`:
- Tombol **`Cetak / HTML`** (`[data-testid="partitur-cetak-buka"]`, `data-kiosk-allow`) di bilah atas `LayarPartitur` (untuk berkas MusicXML yang valid):
  - Membuka `Modal` lebar (`[data-testid="modal-cetak-partitur"]`) yang otomatis menyusun cetakan sesuai **filter *part* yang sedang aktif saat itu** (mis. bila sedang memilih `Trumpet 1`, yang dicetak adalah `Trumpet 1` dengan ukuran bawaan `A4 Tegak`; bila sedang memilih `Full score` ≥ 4 *part*, ukuran bawaan `A4 Mendatar`; dan di dalam modal pengguna juga bisa mengganti filter *part* / ukuran kertas / skala tanpa harus menutup modal!).
  - Pilihan di dalam modal:
    1. **Bagian yang dicetak (`[data-testid="cetak-partitur-bagian"]`):** mengikuti filter aktif saat dibuka, bisa diganti langsung ke *Full score*, kelompok *section*, atau salah satu *part*.
    2. **Ukuran kertas (`[data-testid="cetak-partitur-kertas"]`):** `A4 Tegak`, `A4 Mendatar`, `Buku Saku / Lyre (A5 Mendatar)`.
    3. **Skala notasi (`[data-testid="cetak-partitur-skala"]`):** `Padat`, `Normal`, `Besar`.
  - Menampilkan `<iframe srcDoc={html} data-testid="bingkai-cetak-partitur" />` berlatar putih beserta lencana jumlah halaman (`[data-testid="cetak-partitur-halaman"]`, mis. `2 halaman · A4 Tegak`).
  - Tombol kaki modal:
    - **`Tutup`**
    - **`Unduh HTML`** (`[data-testid="tombol-unduh-html-partitur"]` → `downloadHtmlFile(html, namaBerkas)`)
    - **`Cetak`** (`[data-testid="tombol-cetak-partitur"]` → `cetakAtauUnduh(html, namaBerkas)`: bila `window.open` diizinkan membuka dialog cetak; bila diblokir di iframe/WebView/`DrillKit.html`, otomatis mengunduh berkas `.html` disertai toast petunjuk `Buka berkas HTML lalu tekan Ctrl+P`).
- **Untuk partitur PDF (`tipe === 'pdf'`):**
  - Tetap menampilkan keterangan jujur bahwa berkas PDF berupa lembaran tetap sehingga penyaringan per instrumen hanya tersedia untuk MusicXML/MXL, sementara tombol **`Buka tab baru`** (untuk langsung mencetak lewat penampil PDF sistem) & **`Unduh PDF`** selalu tersedia.

### 6.3 Sambungan ringan di `Share.tsx` & `Music.tsx`

- `src/pages/Share.tsx` (baris 872): mengubah `<Music hanyaPutar />` menjadi `<Music hanyaPutar anggotaAktif={me} />` — ketika anggota belum memilih nama, `me` bernilai `null` sehingga perilaku tab Musik tanpa nama tetap 100% terjaga (`qa/musik-anggota.mjs`).
- `src/pages/Music.tsx`: meneruskan `anggotaAktif` opsional dan `sections` tim (`settings.sections ?? DEFAULT_SECTIONS`) ke `<LayarPartitur />` dan nama tim `settings.teamName` untuk tajuk cetakan.

---

## 7. Rencana pengujian

### 7.1 `qa/partitur-bagian-logika.mjs` (baru — Node murni, target ≥ 45 asersi)

Menguji `src/lib/partiturBagian.ts` dan `src/lib/partiturCetak.ts` tanpa peramban (< 1 detik):
1. **Klasifikasi instrumen dwibahasa & singkatan:**
   - Brass (`Trumpet in Bb 1`, `Tpt. II`, `Terompet`, `Mellophone`, `F Horn`, `Trombone`, `Baritone`, `Euphonium`, `Tuba`, `Sousaphone`).
   - Woodwind (`Piccolo`, `Flute`, `Suling`, `Clarinet in Bb`, `Alto Sax`, `Soprano Sax`).
   - Battery (`Snare Drum`, `S.D.`, `Tenor Drums`, `Quads`, `Quints`, `Bass Drum 1–5`, `Marching Cymbals`, `Simbal`).
   - Pit (`Marimba 1`, `Vibraphone`, `Xylophone`, `Glockenspiel`, `Belira`, `Bell Lyra`, `Timpani`, `Synthesizer`, `Pianika`, `Melodica`, `Aux Percussion`, `Drumset`).
2. **Penanganan kata ambigu (anti salah-kamar):**
   - `"Baritone Saxophone"` & `"Bari Sax"` → `woodwind` (bukan `brass`).
   - `"Tenor Saxophone"` & `"T. Sax"` → `woodwind` (bukan `percussion`).
   - `"Bass Clarinet"` → `woodwind`, `"Bass Drum"` → `percussion`, `"Electric Bass"` → `pit`.
3. **Pemetaan ke `SectionDef[]` dinamis & tersembunyi:**
   - Memetakan `percussion` ke `{ id: 'percussion', label: 'Battery' }` dengan benar.
   - Menghormati *section* kustom buatan pelatih (mis. `{ id: 'pianika', label: 'Pianika' }`).
   - Tidak menghilangkan *part* `Woodwind` walau `woodwind.hidden === 1` di `DEFAULT_SECTIONS`, dan menampung *part* tak dikenal (`Choir`) di kelompok `'lainnya'`.
4. **Pilihan awal anggota (`pilihFilterAwalAnggota`):**
   - `anggota === null` → `Full score`.
   - `instrument: 'Trumpet'` pada skor ber-`Trumpet 1` & `Trumpet 2` → menyaring keduanya; `instrument: 'Trumpet 2'` → tepat `Trumpet 2`.
   - `instrument: 'Flugelhorn'` (tak ada di skor) + `section: 'brass'` → jatuh ke kelompok `Brass`.
   - `section: 'guard'` (`Color Guard`) → jatuh ke `Full score` dengan keterangan ramah.
   - Validasi ulang filter tersimpan saat daftar `partIds` skor berubah.
5. **Pembangkit HTML cetak murni hex (`partiturCetak.ts`):**
   - `siapkanSvgHalamanCetak` menyuntikkan `viewBox="0 0 794 1123"` pada `<svg width="794" height="1123">` yang belum punya `viewBox`, dan mempertahankan `viewBox` bila sudah ada.
   - `htmlCetakPartitur` menghasilkan dokumen `<!doctype html>` utuh untuk `A4_P`, `A4_L`, dan `A5_L` dengan aturan `@page` yang sesuai, pemisah halaman `.lembar-partitur`, bilah `.no-print`, tajuk/kaki yang di-*escape* aman terhadap karakter `< > & "`, serta **0 kemunculan `oklch(` maupun `color-mix(`**.
   - `namaBerkasCetakPartitur` menghasilkan nama berkas bersih tanpa karakter ilegal.

### 7.2 `qa/partitur-cetak.mjs` (baru — peramban ujung-ke-ujung di Chromium, target ≥ 35 asersi)

Menguji alur penuh penyaringan, mode anggota, dan cetak/unduh HTML di Headless Chromium:
1. **Skor marching band 6 *part* lintas 4 seksi** (`Trumpet 1`, `Trumpet 2`, `Mellophone`, `Clarinet`, `Snare Drum`, `Marimba` — 12 birama, dengan `Tuba` / `Marimba` memiliki 4 birama istirahat beruntun untuk menguji istirahat multi-birama):
   - Buka partitur → bawaan `Full score (6)` merender keenam *part*.
   - Klik chip kelompok `Brass` → `partitur-info-sesi` berubah ke `3/6 part · Brass`, SVG hanya memuat *part* Brass (tidak memuat `Snare Drum` / `Marimba`).
   - Pilih 1 *part* spesifik (`Marimba`) lewat `partitur-pilih-part` → `1/6 part · Marimba`, lebar paranada penuh, istirahat beruntun tergabung rapi tanpa galat, dan pilihan bertahan sesudah `page.reload()`.
2. **Alur mode anggota (`Share.tsx` → tab `musik`):**
   - Sebelum memilih nama (`me === null`), tab Musik & buka partitur tetap berfungsi penuh pada `Full score` (menjaga invarian `musik-anggota`).
   - Sesudah memilih anggota *Trumpet* (`Andra Pratama`), membuka partitur otomatis menyaring ke *part* Trumpet dengan keterangan `partitur-info-anggota`, tetap bisa berpindah ke `Full score` lalu kembali lewat `partitur-ke-part-saya`.
   - Sesudah memilih anggota *Color Guard* (`Putri Ramadhani`), membuka partitur tetap menampilkan `Full score` dengan keterangan ramah tanpa kanvas kosong.
3. **Pratinjau Cetak & Unduh HTML murni hex (`modal-cetak-partitur`):**
   - Klik `partitur-cetak-buka` saat *Full score* (6 *part*) → bawaan kertas otomatis `A4_L` (*A4 Mendatar*); saat 1 *part* (`Trumpet 1`) → bawaan kertas otomatis `A4_P` (*A4 Tegak*).
   - Ganti ukuran kertas ke `A5_L` (*Buku Saku / Lyre*) → jumlah halaman `<svg>` terpaginasi ulang di dalam `bingkai-cetak-partitur` tanpa memotong paranada dan seluruh `srcDoc` bebas `oklch()` / `color-mix()` serta setiap `<svg>` memiliki `viewBox`.
   - Klik `tombol-unduh-html-partitur` → berkas `DrillKit - PARTITUR - … .html` terunduh ke disk, isinya mandiri (`<!doctype html>`, memuat `<svg>`, `viewBox`, `@page`, tombol `.no-print`, dan 0 `oklch`/`color-mix`).
   - Saat `window.open` diblokir (simulasi lingkungan WebView/iframe terkurung), klik `tombol-cetak-partitur` tidak buntu melainkan otomatis mengunduh berkas `.html` disertai pesan petunjuk.
4. **Kunci Kios & kebersihan konsol:**
   - Tombol filter *part* dan `partitur-cetak-buka` tetap interaktif (`pointer-events: auto`) saat `html[data-kiosk="1"]` aktif; `0` error konsol/halaman dan `0` permintaan jaringan eksternal.

---

## 8. Berkas yang akan disentuh

| Berkas | Perubahan |
| --- | --- |
| `src/lib/partiturBagian.ts` | **baru** — klasifikasi instrumen dwibahasa, pengelompokan `SectionDef[]`, pencocokan otomatis anggota, & simpanan filter per lagu |
| `src/lib/partiturCetak.ts` | **baru** — normalisasi `viewBox` SVG, pembangkit HTML cetak mandiri murni hex (`A4_P` / `A4_L` / `A5_L`), & penamaan berkas jelas |
| `src/lib/partiturRender.ts` | Tambah `filterIdXml` (`Instrument.Visible` + `Staff.Visible` + `updateGraphic()`) & `renderHalamanCetakPartitur` lepas-layar |
| `src/components/PratinjauCetakPartitur.tsx` | **baru** — modal pratinjau cetak `<iframe srcDoc>` + pilih bagian/kertas/skala + tombol *Unduh HTML* & *Cetak* anti-buntu |
| `src/components/LayarPartitur.tsx` | Bilah filter *Full score* / kelompok *section* / per *part*, info anggota aktif, & tombol *Cetak / HTML* |
| `src/pages/Music.tsx`, `src/pages/Share.tsx` | Teruskan `anggotaAktif` opsional (dari `MemberView`), `sections`, dan `teamName` ke `LayarPartitur` |
| `qa/partitur-bagian-logika.mjs`, `qa/partitur-cetak.mjs` | **baru** — uji Node murni pencocokan/HTML cetak & uji peramban filter + mode anggota + cetak HTML |
| `qa/bangun-logika.sh`, `qa/regresi-penuh.sh`, `.github/workflows/ci.yml` | Rakit `partiturBagian.ts` & `partiturCetak.ts`; daftarkan 2 rangkaian baru (**109 → 111 rangkaian**) |
| `RANCANGAN-LANJUTAN.md`, `IDE-PENGEMBANGAN.md` | Pembaruan status §11 setelah seluruh tahap hijau |

*(Nol dependensi baru di `package.json`, nol migrasi skema Dexie.)*

---

## 9. Keputusan teknis (ditetapkan 24 Okt 2026)

**D1 — Penyaringan memakai `Instrument.Visible` + `Staff.Visible` + `osmd.updateGraphic()` langsung di OSMD (bukan memotong string XML mentah).**
Memotong elemen `<part>` dari teks XML mentah berisiko merusak rujukan `<part-group>` (kurung kurawal seksi) atau tanda tempo global yang oleh MuseScore/Sibelius sering hanya ditulis pada `<part>` teratas (`P1`). Dengan membiarkan OSMD mengurai skor utuh lalu menyembunyikan instrumen lain lewat `Visible = false` + `updateGraphic()`, tanda tempo global tetap terbaca di setiap *part* tunggal **dan** birama istirahat beruntun otomatis diringkas menjadi lambang multi-istirahat (`|— N —|`).

**D2 — Paginasi cetak dikerjakan oleh `PageFormatStandards` OSMD di wadah lepas-layar berukuran baku (`A4_P` / `A4_L` / `A5_L`), lalu setiap `<svg>` disuntik `viewBox`.**
Mengandalkan CSS `page-break` pada satu `<svg>` panjang (`Endless`) pasti membelah garis paranada di batas kertas, sedangkan merender di lebar kontainer layar pengguna membuat hasil cetak berubah-ubah antara HP dan laptop. Wadah lepas-layar selebar `794 px` / `1122 px` dengan `pageFormat` OSMD menghasilkan halaman `<svg>` yang konsisten dari perangkat mana pun, dan injeksi `viewBox` menjamin skalanya tajam tanpa terpotong di margin printer.

**D3 — Kamus pencocokan instrumen dwibahasa mendahulukan frasa majemuk terpanjang dan tidak pernah menyembunyikan *part* di luar `SectionDef` aktif.**
Istilah seperti *Baritone Sax* atau *Tenor Sax* mengandung kata yang sama dengan instrumen *Brass*/*Battery*, dan `DEFAULT_SECTIONS` menyembunyikan *Woodwind* secara bawaan. Menguji frasa spesifik lebih dulu serta tetap menampilkan chip kelompok yang nyata ada di skor mencegah salah kelompok sekaligus menjamin setiap `<score-part>` selalu terjangkau.

**D4 — Mode anggota memberi pilihan awal cerdas tanpa pernah mengunci atau menghalangi pemakaian tanpa nama.**
Bila anggota belum memilih nama (`me === null`), tab Musik dan `LayarPartitur` tetap terbuka normal pada *Full score*. Bila nama sudah dipilih, filter awal menyesuaikan `instrument` lalu `section` anggota (atau kembali ramah ke *Full score* untuk *Color Guard* / *FC*), namun anggota tetap bebas berpindah ke *Full score* atau *part* teman satu seksi kapan saja.

**D5 — Mencetak partitur wajib anti-buntu (`Pratinjau` + `Unduh HTML` + `cetakAtauUnduh`).**
Sama seperti laporan kehadiran dan panduan 1 halaman, pengguna selalu melihat pratinjau lembaran kertasnya lebih dulu, dapat mengunduh berkas `.html` mandiri berpalet hex murni (lengkap dengan tombol cetak `.no-print` di dalamnya), dan bila `window.open` diblokir peramban/WebView/iframe maka tombol **Cetak** otomatis jatuh mulus ke pengunduhan berkas `.html`.

---

## 10. Kriteria terima

- [x] Bilah filter di `LayarPartitur` menampilkan pilihan *Full score*, chip kelompok *section* yang ada di skor, dan pemilih per *part* individu, serta merender ulang SVG dengan benar (termasuk istirahat multi-birama pada *part* tunggal dan penghilangan label kiri berulang saat 1 *part* tampil).
- [x] Pilihan filter diingat per lagu di `localStorage` dan pulih aman walau berkas partitur lagu diganti.
- [x] Di mode anggota (`Share.tsx` → tab `musik`), membuka partitur tanpa memilih nama tetap menampilkan *Full score*; setelah memilih nama anggota berinstrumen cocok (mis. *Trumpet* / *Snare*), partitur otomatis tersaring ke *part* yang sesuai disertai keterangan jelas, sedangkan anggota *Color Guard* tetap mendapat *Full score* tanpa galat.
- [x] `qa/partitur-bagian-logika.mjs` ≥ 45 asersi (**87 lulus, 0 gagal** di Node 22 — mencakup kamus dwibahasa, kasus ambigu *Bari Sax* / *Tenor Sax* / *Bass Clarinet*, `SectionDef` dinamis, pilihan awal anggota, injeksi `viewBox` SVG, dan ketiadaan `oklch()`/`color-mix()` di `htmlCetakPartitur`); terdaftar di `qa/regresi-penuh.sh`.
- [x] Modal **Pratinjau Cetak Partitur** mendukung ukuran `A4 Tegak`, `A4 Mendatar` (otomatis terpilih untuk ≥ 4 *part*), dan `Buku Saku / Lyre (A5 Mendatar)` serta skala notasi, menampilkan halaman `<svg>` terpaginasi utuh di `<iframe srcDoc>`, menyediakan **Unduh HTML** mandiri berpalet hex murni, dan otomatis jatuh ke unduh HTML bila dialog cetak diblokir.
- [x] Seluruh kendali baru tetap bisa diklik saat Kunci Kios (`html[data-kiosk="1"]`) aktif (`data-kiosk-allow`).
- [x] `qa/partitur-cetak.mjs` ≥ 35 asersi (**39 lulus, 0 gagal**), konsol peramban bersih & `0` permintaan jaringan luar; seluruh **111 rangkaian** terdaftar di `qa/regresi-penuh.sh` & `.github/workflows/ci.yml` (termasuk `musik-anggota`, `partitur-impor`, dan `partitur-render` tetap hijau).
- [x] `npx tsc --noEmit`, `npm run build`, dan `npm run build:portable` bersih tanpa dependensi baru.

---

## 11. Urutan pengerjaan (satu PR di branch ini, 6 langkah terukur)

1. **`src/lib/partiturBagian.ts` + `src/lib/partiturCetak.ts` + `qa/partitur-bagian-logika.mjs` → hijau di Node dulu**, sebelum menyentuh OSMD atau komponen React (`bash qa/bangun-logika.sh && node qa/partitur-bagian-logika.mjs`).
2. **Perluas `src/lib/partiturRender.ts`** dengan `filterIdXml` (`Instrument.Visible` + `Staff.Visible` + `osmd.updateGraphic()`, mode 1-*part* tanpa label kiri berulang) serta `renderHalamanCetakPartitur` lepas-layar ber-`PageFormatStandards` (`A4_P` / `A4_L` / `A5_L`) — verifikasi `npm run typecheck` & `npm run build`.
3. **Bangun `src/components/PratinjauCetakPartitur.tsx` & sambungkan bilah filter + info anggota + tombol cetak ke `LayarPartitur.tsx`, `Music.tsx`, dan `Share.tsx`** — verifikasi `npm run typecheck`, `npm run build`, `npm run build:portable`, serta pastikan `partitur-render` dan `musik-anggota` tetap hijau.
4. **Tulis `qa/partitur-cetak.mjs` & daftarkan kedua rangkaian baru di `qa/regresi-penuh.sh` + `.github/workflows/ci.yml`** (109 → 111 rangkaian), lalu jalankan uji peramban lokal sampai `0 gagal`.
5. **Jalankan sapuan regresi terkait** (`partitur-bagian-logika`, `partitur-cetak`, `partitur-render`, `partitur-impor`, `musik-anggota`, `mxl-logika`, `partitur-logika`, `periksa-situs`) sampai semuanya hijau dan ruang kerja bersih.
6. **Perbarui status §11 di `RANCANGAN-LANJUTAN.md`, `IDE-PENGEMBANGAN.md`, dan centang kriteria terima dokumen ini** sebelum satu kali `git push` dan membuka PR.
