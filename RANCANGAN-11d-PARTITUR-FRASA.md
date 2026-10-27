# Rencana teknis #11d — Partitur: sorot birama aktif sinkron `TempoTimeline`, pilih & *loop* frasa, serta tautan frasa ↔ set drill

**Induk:** `RANCANGAN-LANJUTAN.md` §11 & penutup seri `RANCANGAN-11a-PARTITUR-MUSICXML.md`, `RANCANGAN-11b-PARTITUR-RENDER.md`, dan `RANCANGAN-11c-PARTITUR-PART-CETAK.md`.
**Status:** rancangan siap dikerjakan (disusun 25 Okt 2026 di branch `arena/5dd4be9a-drillkit`, di atas `main` `6590fcc` pasca PR #23).

---

## 1. Kenapa #11d menutup seri #11

Setelah **#11a** (penyimpanan offline IndexedDB & round-trip ZIP), **#11b** (urai `.mxl` & perender SVG hex murni OSMD *lazy-loaded*), dan **#11c** (filter *part*/*section*, pencocokan otomatis anggota, serta cetak HTML murni hex) menyatu di `main`, lembar partitur DrillKit sudah tajam dibaca dan dicetak secara statis.

Tahap **#11d** menghidupkan lembar partitur tersebut menjadi **alat latihan aktif yang bernapas seirama dengan musik dan lapangan**:

1. **Sorot birama aktif & gulir otomatis (*auto-scroll*) mengikuti `TempoTimeline`:** saat metronom, rekaman audio (`#6`), maupun animasi formasi drill berjalan, birama yang sedang berbunyi disorot langsung di atas partitur SVG dan digulir secara mulus — termasuk ketika pemain membuka tampilan 1 *part* yang menggabungkan birama istirahat menjadi lambang *multi-rest* (`|— 4 —|`).
2. **Pilih & *loop* frasa per birama:** rentang birama (mis. `Bar 5–8`) dapat dipilih langsung dengan mengeklik birama pada partitur, dari keping segmen lagu, atau dari rentang set drill; diingat **per lagu per perangkat** di `localStorage` (seperti `#4` tempo latihan), menyatu penuh dengan **M2 Ulang bagian**, **#4 Tempo latihan**, dan **M1 Hitung mundur**, menampilkan lencana **`"Frasa 5–8 · 80%"`** di panel lagu & set list, serta tetap bekerja penuh lewat *fallback* `TempoTimeline` walau lagu belum memiliki MusicXML atau hanya berpartitur PDF.
3. **Tautan frasa partitur ↔ set drill (`Set 4–6 = Bar 9–16`):** set list dan pembaca partitur dapat menautkan dan melompat langsung antara rentang set formasi lapangan dan rentang birama musik memakai pemetaan `petaPenggaris` (`segmenDrill.ts`).

| Bagian | Isi | Status |
| --- | --- | --- |
| **11a** | Simpan Blob IndexedDB, deteksi pintu #7, pemindai ringkasan murni, kuota, round-trip ZIP | **Selesai** (PR #20 & #21) |
| **11b** | Urai `.mxl` (`DecompressionStream`), render *full score* MusicXML offline (OSMD SVG hex, *lazy-load*, bertahap), dan lembar PDF | **Selesai** (PR #22) |
| **11c** | Filter *part* per instrumen & kelompok *section*, pilihan bawaan anggota aktif, pratinjau cetak & unduh HTML murni hex | **Selesai** (PR #23) |
| **11d (dokumen ini)** | **Sorot birama aktif & *auto-scroll* sinkron `TempoTimeline` (metronom, rekaman `#6`, drill) + pilih & *loop* frasa per perangkat (`"Frasa 5–8 · 80%"`, *fallback* tanpa MusicXML) + tautan frasa ↔ set drill (`Set 4–6 = Bar 9–16`)** | **Tahap ini** |

---

## 2. Fakta terukur dari audit kode & bundel OSMD (25 Okt 2026)

Seluruh keputusan teknis di bawah berdiri di atas lima fakta nyata pada `main` (`6590fcc`) dan `opensheetmusicdisplay@2.2.1` (tetap **nol dependensi npm baru**):

1. **Geometri grup `<g class="vf-measure" id="…">` di SVG VexFlow (`opensheetmusicdisplay.min.js`):**
   - Pada saat `VexFlowMeasure.draw(ctx)` dan `VexFlowMultiRestMeasure` menggambar setiap paranada birama ke SVG, VexFlow membuka grup `<g class="vf-measure" id="${this.MeasureNumber}">`.
   - Mengukur *union bounding box* semua elemen `<g.vf-measure>` ber-`id` sama relatif terhadap `wadahSvg` menghasilkan koordinat piksel CSS yang **100% presisi** pada segala kombinasi `zoom` (`60%–160%`), `tataLetak` (`vertikal` maupun `mendatar`), serta jumlah *part* (`Full score`, `Brass`, atau 1 *part*), tanpa perkiraan konversi satuan internal OSMD.
2. **Perilaku `MeasureList` saat istirahat multi-birama (*multi-rest*) aktif:**
   - Pada tampilan 1 *part* (mis. *Trumpet 1* atau *Marimba*), opsi bawaan `autoGenerateMultipleRestMeasuresFromRestMeasures` melipat birama istirahat berurutan (mis. birama 9–12, `SourceMeasure.multipleRestMeasures = 4`) ke birama grafis pembuka (`MeasureList[8]`), sementara `MeasureList[9..11]` berisi `[undefined]`.
   - Tanpa pemetaan rentang *multi-rest*, sorotan birama akan lenyap selama 4 birama penuh ketika pemain beristirahat. Pemetaan kita mengaitkan birama 9, 10, 11, dan 12 ke kotak grafis *multi-rest* pembukanya beserta penanda `rentangMultiRest: [9, 12]`.
3. **Batas putaran ulang bagian (`M2`) pada jalur jam rekaman audio (`#6`) di `src/lib/metronome.ts`:**
   - Di `Metronom.jadwalkan()` (`src/lib/metronome.ts:1052`), saat `ulangSampai > 0` dipakai bersama rekaman audio (`this.jam` dari `jamLagu(rekaman)`), dua hal harus dijaga:
     1. Bila `naikOtomatis` mati (kasus paling umum: melatih `Bar 5–8` tetap di `80%` tempo), sebelumnya `onPutaran` tidak pernah dipanggil sehingga `PemutarRekaman` tidak melompat balik ke `Bar 5` dan `selaraskanKeJam()` justru menyeret klik maju ke `Bar 9+`.
     2. Jendela lihat-ke-depan `LIHAT_KE_JAM = 0,6` dtk tidak boleh melompatkan posisi audio sebelum birama `ulangSampai` benar-benar selesai berbunyi.
   - Solusi di `#11d`: pada jalur `jam`, penjadwal menahan *lookahead* di ujung `ulangSampai` sampai `jam.posisi()` mencapai `detikPadaBirama(ulangSampai + 1)` (toleransi 15 ms), lalu memanggil callback putaran ulang (`onPutaran`) tepat di batas birama sehingga rekaman audio dan klik melompat serempak kembali ke awal frasa (`ulangDari`).
4. **Kontrak ketat nol `oklch()` / `color-mix()` pada `layar-partitur` (`qa/partitur-render.mjs`):**
   - `qa/partitur-render.mjs` memeriksa `/oklch\(|color-mix\(/i.test(layar.outerHTML) === false` pada seluruh pohon DOM `[data-testid="layar-partitur"]`.
   - Karena kelas utilitas warna/transparansi Tailwind v4 dikompilasi menjadi `oklch(...)` atau `color-mix(...)`, seluruh lapisan sorot birama aktif, sorot frasa, lencana status putar, keping set drill, dan tombol kendali baru di dalam `LayarPartitur.tsx` **wajib** memakai warna hex / `rgba(...)` murni tanpa satu pun fungsi warna CSS modern tersebut.
5. **Paket mode anggota (`Share.tsx` & `src/lib/paketMasuk.ts`):**
   - `simpanPaketAnggota` menulis `paket.songs` & `paket.setlists` ke IndexedDB, sedangkan `bundle.drills` dan `bundle.sets` pada perangkat anggota berada di dalam objek `ShareBundle` aktif. Meneruskan `drillsPaket={bundle.drills}` dan `setsPaket={bundle.sets}` dari `Share.tsx` ke `<Music hanyaPutar />` memastikan tautan `Set 4–6 = Bar 9–16` bekerja identik baik di mode pelatih maupun di HP anggota yang membuka berkas paket dari WhatsApp.

---

## 3. Keputusan arsitektur (`D1`–`D6`)

### D1 — Kotak geometri birama & pemetaan *multi-rest* (`src/lib/partiturRender.ts` & `src/lib/partiturFrasa.ts`)

`KotakBiramaRender` pada `HasilSesiPartitur` diperkaya dengan koordinat piksel hasil ukur nyata terhadap wadah SVG:

```ts
export interface KotakBiramaPiksel {
  /** Nomor birama sumber dari XML (`0` untuk anacrusis/pickup, `1..N` birama biasa). */
  nomorBiramaXml: number
  /** Nomor birama 1-based selaras `TempoTimeline` & `Metronom` (`1..N`). */
  birama: number
  /** Indeks urut 0-based di `SourceMeasures` OSMD. */
  indeksUrut: number
  /** Koordinat & ukuran dalam piksel CSS relatif terhadap `wadahSvg`. */
  x: number
  y: number
  lebar: number
  tinggi: number
  /** Rentang birama 1-based `[awal, akhir]` bila kotak ini mewakili istirahat multi-birama. */
  rentangMultiRest?: [number, number]
}
```

- Bila partitur memiliki birama pendahuluan (*pickup/anacrusis*, `MeasureNumberXML === 0` pada `indeksUrut === 0`), birama bertanda `1..N` dipetakan langsung ke `birama = nomorBiramaXml` agar selaras dengan nomor birama yang tertulis di atas paranada dan di `TempoTimeline`, sedangkan birama `0` tetap tercatat pada `nomorBiramaXml: 0` tanpa menggeser birama `5–8` menjadi `6–9`.
- Bila berkas tidak memakai nomor birama XML berurutan (mis. atribut `number` non-numerik seperti `"X1"`), pemetaan jatuh rapi ke urutan `indeksUrut + 1`.
- Bila `MeasureList[idx]` kosong akibat terlipat ke istirahat multi-birama sebelumnya (`idxAwal`), fungsi murni `petakanKotakBiramaSumber` memetakan `idx` ke kotak grafis `idxAwal` dengan `rentangMultiRest: [biramaAwal, biramaAkhir]`.

### D2 — Lapisan sorot murni hex tanpa render ulang OSMD + gulir otomatis pintar (`LayarPartitur.tsx`)

- Lapisan sorot dirender sebagai `<div aria-hidden="true">` absolut (`pointer-events: none`) yang menumpang tepat di atas `wadahSvg`:
  - **Rentang frasa terpilih (`[data-testid="partitur-sorot-frasa"]`):** latar `rgba(245, 158, 11, 0.13)`, garis tepi putus-putus `1.5px dashed #d97706` (emas ambar lembut — tidak menutupi kepala not `#0f172a`). Kotak birama bersebelahan pada sistem/baris yang sama digabung per segmen baris (`gabungKotakFrasaPerBaris`) agar tampak sebagai satu pita frasa yang bersih, bukan kotak-kotak terpisah yang rapat.
  - **Birama aktif (`[data-testid="partitur-sorot-aktif"]`):** latar `rgba(16, 185, 129, 0.20)` dengan garis tepi `2px solid #059669` saat berbunyi (atau tepi ambar `#d97706` saat tahap `hitung` *count-off* bersiap masuk birama pertama frasa).
- **Gulir otomatis (*auto-scroll*) hemat gerak (`hitungTargetGulirBirama`):**
  - Mode `vertikal`: memeriksa apakah `kotak.y .. kotak.y + kotak.tinggi` masih berada di dalam zona nyaman vertikal wadah gulir (`scrollTop + 0.15 * clientHeight` s.d. `scrollTop + 0.82 * clientHeight`). Selama birama berpindah di dalam sistem/baris yang sama, `hitungTargetGulirBirama` mengembalikan `null` sehingga lembar partitur diam tenang; begitu masuk sistem berikutnya di bawah layar, wadah bergulir mulus menempatkan sistem baru di sekitar 22% dari puncak wadah.
  - Mode `mendatar`: memeriksa zona nyaman horizontal (`scrollLeft + 0.15 * clientWidth` s.d. `scrollLeft + 0.78 * clientWidth`) dan menggulir `scrollLeft` ke depan saat birama mendekati tepi kanan.
  - Tombol **`Ikuti birama`** (`data-testid="partitur-ikuti-birama"`, aktif secara bawaan) mengizinkan pemain mematikan/menyalakan gulir otomatis kapan saja tanpa menghentikan musik.

### D3 — Ingatan frasa per lagu per perangkat (`localStorage`) + penyatuan M2 `ulangBagian`

Seperti `#4` (`useTempoLatihan`), frasa yang sedang dilatih disimpan per lagu per perangkat di `localStorage` dengan kunci **`drillkit_frasa_latihan_v1`** dan disinkronkan antarkomponen/antartab lewat event `drillkit:frasa-latihan` & `storage`:

```ts
export interface FrasaLatihan {
  /** Birama awal rentang (1-based, inklusif). */
  dari: number
  /** Birama akhir rentang (1-based, inklusif). */
  sampai: number
  /** 1 = pengulangan frasa menyala; 0 = rentang tersimpan tetapi tidak diulang. */
  aktif: 0 | 1
  /** Label ringkas asal frasa bila ada (mis. "Reff", "Set 4–6"). */
  label?: string
}
```

- **Penyatuan satu sumber kebenaran dengan M2 (`frasaEfektifUntukLagu`):**
  1. Bila `petaFrasa[song.id]` ada di `localStorage`, nilai tersebut yang dipakai.
  2. Bila belum ada, baca `song.ulangBagian` (bila ada di basis data) sehingga lagu lama atau basis data hasil *seed* M2 tetap berjalan persis seperti semula.
  3. Saat pengguna mengubah rentang/status ulang dari **mana saja** (`kartu-ulang-bagian`, klik birama di `LayarPartitur`, keping segmen di `PanelLagu`, atau tautan set di `KartuSetList`), `useFrasaLatihan` memperbarui `localStorage` seketika **dan** (selama `!hanyaPutar`) menyelaraskan `song.ulangBagian` di `db.songs`. Di mode anggota (`hanyaPutar`), perubahan tersimpan rapi di `localStorage` perangkat anggota tanpa menyentuh `db.songs` dan tetap awet saat anggota memperbarui paket show.

### D4 — Pemilihan frasa langsung di partitur, keping segmen, dan *fallback* tanpa MusicXML

Tiga jalur memilih frasa bermuara ke state `FrasaLatihan` yang sama:

1. **Langsung di kanvas partitur SVG (`LayarPartitur`):**
   - **Klik biasa** pada birama di partitur melompatkan posisi mulai ke birama tersebut (`onLoncatBirama(birama)`).
   - **Mode `"Pilih frasa"` 2-ketuk ramah layar sentuh HP** (`data-testid="partitur-mode-pilih-frasa"`) **atau `Shift + Klik` di laptop:** ketukan pertama menandai birama awal (`dari`), ketukan kedua menandai birama akhir (`sampai`, otomatis diurutkan `Math.min`..`Math.max`), menyalakan `aktif: 1`, dan langsung memindahkan posisi siap-putar ke `dari`.
   - Bilah kendali ringkas di dalam `LayarPartitur` menyediakan tombol **Putar / Berhenti** (`data-testid="partitur-tombol-putar"`), input/lencana rentang frasa, tombol **Ulang frasa** (`data-testid="partitur-toggle-ulang"`), pemilih cepat tempo latihan (`70%`, `80%`, `90%`, `100%`), serta tombol **Hapus frasa** — sehingga pemain tetap bisa mengendalikan latihan penuh bahkan saat `layarPenuh` aktif.
2. **Dari daftar segmen lagu (`PanelLagu` / `Tempo map`):**
   - Bila lagu memiliki segmen tempo (`Intro`, `Bagian A`, `Reff`, …), `hitungRentangFrasaSegmen` menurunkan birama awal dan birama akhir segmen tersebut (`seg[i].measure` s.d. `seg[i+1].measure - 1`, atau `panjangBirama` / `partitur.jumlahBirama` pada segmen terakhir). Tombol kecil **Ulang segmen** pada `PanelLagu` dan bilah partitur langsung menyetel frasa ke segmen itu.
3. ***Fallback* murni `TempoTimeline` tanpa MusicXML / partitur PDF:**
   - Saat lagu belum dipasangi MusicXML (tidak punya partitur, berkas belum ada di perangkat, atau partiturnya berupa PDF statis), seluruh pemilihan rentang di `kartu-ulang-bagian`, keping segmen `PanelLagu`, keping set drill, *count-off* M1, tempo latihan `#4`, serta lencana **`"Frasa 5–8 · 80%"`** tetap aktif 100% di atas `TempoTimeline`. Pada lembar PDF di `LayarPartitur`, bilah kendali putar + frasa + lencana birama aktif tetap ditampilkan di atas pratinjau PDF agar pemain pembaca PDF pun bisa memutar/mengulang frasa tanpa menutup lembarnya.

### D5 — Lencana baku `"Frasa 5–8 · 80%"` di `PanelLagu` & `KartuSetList`

Fungsi murni `formatLencanaFrasa(frasa, latihan, panjangBirama)` menyusun label yang seragam:

- Hanya tampil bila `frasa` sah (`rentangValid(frasa, panjangBirama)`) dan `frasa.aktif === 1`.
- Format rentang: `dari === sampai ? "Frasa 5" : "Frasa 5–8"`.
- Bila `latihanAktif(latihan)` bernilai `true`:
  - Mode `'persen'` → **`"Frasa 5–8 · 80%"`**
  - Mode `'bpm'` → **`"Frasa 5–8 · −20 BPM"`** (atau `+10 BPM`)
- Bila tempo latihan asli (`100%`) → **`"Frasa 5–8"`**.
- Ditampilkan pada:
  - `PanelLagu` (`data-testid="panel-lagu-lencana-frasa"`),
  - `KartuSetList` (`data-testid="setlist-lencana-frasa-${i}"`), dan
  - bilah status `LayarPartitur` (`data-testid="partitur-lencana-frasa"`).

### D6 — Tautan frasa partitur ↔ set drill (`Set 4–6 = Bar 9–16`) & partitur pendamping di `DrillEditor`

1. **Pemetaan murni set drill ↔ birama (`src/lib/partiturFrasa.ts` di atas `petaPenggaris`):**
   - Untuk setiap `BlokSet` dari `petaPenggaris(sets, lagu, { beatsPerCount })`:
     - `biramaDari = Math.max(1, Math.floor(blokAwal.mulaiBirama + 1e-9))`
     - `biramaSampai = Math.max(biramaDari, Math.ceil(blokAkhir.akhirBirama - 1e-9) - 1)`
   - Contoh: pada lagu 4/4 (`beatsPerCount = 1`), bila Set 1–3 masing-masing 8 hitungan (`Bar 1–2`, `Bar 3–4`, `Bar 5–8` bila Set 3 = 16 hitungan) lalu Set 4 = 8 hitungan (`mulaiBirama = 9`), Set 5 = 16 hitungan (`11..15`), Set 6 = 8 hitungan (`15..17`), maka rentang `Set 4–6` otomatis menghasilkan **`Set 4–6 = Bar 9–16`**!
2. **Tautan tersimpan di `SetList` (`SetList.tautanFrasa`):**
   - `SetList` di `src/db/types.ts` mendapat properti opsional:
     ```ts
     export interface TautanFrasaSetList {
       drillId?: string
       /** Nomor urut set tampilan 1-based inklusif (mis. 4 dan 6 untuk "Set 4–6"). */
       setAwal: number
       setAkhir: number
       /** Rentang birama lagu 1-based inklusif (mis. 9 dan 16 untuk "Bar 9–16"). */
       biramaDari: number
       biramaSampai: number
       label?: string
     }
     ```
     dengan `tautanFrasa?: Record<string, TautanFrasaSetList>` pada `SetList` (kunci baris `${indeks}:${songId}` dengan cadangan `songId`). Karena `setlists` di Dexie berindeks `id`, bidang opsional ini langsung terbawa utuh di IndexedDB, ekspor repertoar M4, `ShareBundle` anggota, dan cadangan ZIP tanpa migrasi skema.
   - Di `KartuSetList`:
     - Pelatih (`!hanyaPutar`) dapat mengeklik tombol **`Tautkan set`** (`data-testid="setlist-atur-tautan-${i}"`) pada baris lagu untuk memilih `Dari Set` dan `Sampai Set` dari drill yang menaut ke lagu tersebut (otomatis menghitung `Bar X–Y`, atau dapat diisi manual bila belum ada drill), lalu menyimpannya.
     - Baris lagu menampilkan keping tombol **`Set 4–6 = Bar 9–16`** (`data-testid="setlist-tautan-set-${i}"`); mengekliknya memilih lagu tersebut, mengaktifkan *loop* frasa `Bar 9–16`, dan melompatkan posisi putar ke `Bar 9`.
3. **Keping set drill di `LayarPartitur` & sorot birama langsung di `DrillEditor`:**
   - Di `LayarPartitur`, bila lagu memiliki drill tertaut, tampil deretan keping ringkas per set (`Set 1 · Bar 1–2`, `Set 2 · Bar 3–4`, …; `Shift + Klik` atau ketuk rentang merangkai `Set 4–6 = Bar 9–16`).
   - Di `DrillEditor.tsx`, bila `lagu?.partitur` tersedia pada drill yang dibuka, tombol **`Partitur`** (`data-testid="drill-tombol-partitur"`) membuka panel `LayarPartitur` pendamping lapangan; saat animasi set/urutan drill berjalan atau penggeser (*scrubber*) digerakkan, birama aktif dihitung dari `TempoTimeline` (`biramaPadaProgresSet`, hanya memperbarui state React saat angka birama bulat berpindah) sehingga sorotan partitur bergerak serempak dengan langkah pemain di lapangan.

---

## 4. Rincian berkas yang dibuat & disentuh

| Berkas | Perubahan |
| --- | --- |
| `src/lib/partiturFrasa.ts` *(baru)* | Modul murni (tanpa DOM/Dexie/OSMD): penyimpanan & normalisasi `FrasaLatihan`, `frasaEfektifUntukLagu`, `formatLencanaFrasa`, `petakanKotakBiramaSumber` (termasuk anacrusis & *multi-rest*), `cariBiramaDariTitikKlik`, `gabungKotakFrasaPerBaris`, `hitungTargetGulirBirama`, `hitungRentangFrasaSegmen`, `hitungPetaSetKeBirama`, `formatTautanSetBirama`, dan `biramaPadaProgresSet`. |
| `src/hooks/useFrasaLatihan.ts` *(baru)* | Hook React berbagi state `FrasaLatihan` per lagu per perangkat via `localStorage` (`drillkit_frasa_latihan_v1`) + event `drillkit:frasa-latihan` & `storage`. |
| `src/db/types.ts` | Tambah `TautanFrasaSetList` dan bidang opsional `tautanFrasa?: Record<string, TautanFrasaSetList>` pada `SetList`. |
| `src/lib/metronome.ts` | Sempurnakan batas putaran `ulangBagian` pada jalur `jam` (`#6` rekaman audio): tahan *lookahead* melewati `ulangSampai` sampai audio mencapai akhir `ulangSampai`, lalu panggil `onPutaran` baik saat `naikOtomatis` hidup maupun mati agar rekaman audio melompat tepat kembali ke `ulangDari`. |
| `src/lib/partiturRender.ts` | Ukur kotak piksel `<g.vf-measure>` terhadap `wadah` seusai render (`KotakBiramaPiksel[]`) dan sertakan pemetaan *multi-rest* di `HasilSesiPartitur.birama`. |
| `src/components/LayarPartitur.tsx` | Lapisan sorot murni hex (`partitur-sorot-aktif` & `partitur-sorot-frasa`), *auto-scroll* pintar (`partitur-ikuti-birama`), klik birama & mode pilih frasa 2-ketuk di partitur, bilah putar/ulang/tempo latihan mandiri, serta keping segmen lagu & set drill. |
| `src/components/PanelLagu.tsx` | Tampilkan lencana `panel-lagu-lencana-frasa` (`"Frasa 5–8 · 80%"`) dan aksi pilih cepat frasa dari keping `StripSegmen`. |
| `src/components/KartuSetList.tsx` | Tampilkan lencana `setlist-lencana-frasa-${i}`, keping tautan `setlist-tautan-set-${i}` (`"Set 4–6 = Bar 9–16"`), dan penyunting ringkas `setlist-atur-tautan-${i}` untuk pelatih. |
| `src/pages/Music.tsx` | Hubungkan `useFrasaLatihan` dengan M2 `ulangBagian`, `PemutarRekaman` `#6` pada putaran ulang frasa, pemetaan set drill lagu aktif, `PanelLagu`, `LayarPartitur`, dan `KartuSetList`. |
| `src/pages/Share.tsx` | Teruskan `drillsPaket={bundle.drills}` dan `setsPaket={bundle.sets}` ke `<Music hanyaPutar />` agar tautan set drill ↔ frasa tersedia di mode anggota. |
| `src/components/DrillEditor.tsx` | Tambah tombol pendamping `Partitur` (`drill-tombol-partitur`) saat lagu tertaut berpartitur, lengkap dengan sinkronisasi `biramaAktif` dari progres animasi/`geserKe` dan klik birama → lompat hitungan drill. |
| `qa/partitur-frasa-logika.mjs` *(baru)* | Uji Node murni untuk seluruh fungsi `partiturFrasa.ts` (lencana, *multi-rest*, anacrusis, klik koordinat, penggabungan kotak baris, target *auto-scroll*, segmen lagu, pemetaan `Set 4–6 = Bar 9–16`, dan progres set drill → birama). |
| `qa/partitur-frasa.mjs` *(baru)* | Uji peramban ujung-ke-ujung Chromium terhadap tolok ukur §11: MusicXML 32 birama (*full score* + *part* Trumpet ber-*multi-rest*), sinkron sorot ±1 birama dengan metronom & rekaman WAV `#6`, *loop* `Bar 5–8` tepat 4 birama pada `80%` tempo + *count-off*, ingatan per perangkat, lencana `"Frasa 5–8 · 80%"` di panel lagu & set list, *fallback* tanpa MusicXML, tautan `Set 4–6 = Bar 9–16`, sorot partitur saat drill berjalan, dan nol `oklch()` / `color-mix()` di `layar-partitur`. |
| `qa/bangun-logika.sh`, `qa/regresi-penuh.sh`, `.github/workflows/ci.yml` | Daftarkan bundel `/tmp/partiturFrasa.mjs` dan kedua skrip uji baru (**111 → 113** rangkaian regresi). |

---

## 5. Rencana uji & tolok ukur keberhasilan

1. **Uji logika murni (`qa/partitur-frasa-logika.mjs`):**
   - Format lencana `"Frasa 5–8 · 80%"`, `"Frasa 5–8 · −20 BPM"`, `"Frasa 5–8"`, serta penyembunyian lencana saat `aktif === 0` atau rentang tidak sah.
   - Penyatuan `frasaEfektifUntukLagu` (prioritas `localStorage` perangkat atas `song.ulangBagian`, dan *fallback* bersih ke `song.ulangBagian`).
   - Pemetaan kotak birama sumber dengan *pickup* (`MeasureNumberXML = 0`) dan istirahat multi-birama (`multipleRestMeasures = 4` → birama 9–12 meminjam kotak grafis birama 9 dengan `rentangMultiRest: [9, 12]`).
   - Hit-test klik koordinat `(x, y)` pada sistem bertumpuk vertikal & mendatar, penggabungan pita kotak frasa per baris, dan perhitungan *auto-scroll* anti-goyang.
   - Pemetaan `Set 4–6 = Bar 9–16` dari `petaPenggaris` pada sukat tetap maupun sukat/tempo berubah, serta konversi progres animasi set drill (`0..1`) ke birama `TempoTimeline`.
2. **Uji peramban menyeluruh (`qa/partitur-frasa.mjs`):**
   - **32 birama MusicXML** dirender utuh pada *Full score* dan *part* tunggal *Trumpet 1* (termasuk *multi-rest* 4 birama di tengah skor).
   - **Sinkronisasi sorot ±1 birama & *auto-scroll*:** baik dengan metronom mandiri maupun bersama rekaman WAV `#6`, birama yang disorot (`data-birama-aktif` pada `[data-testid="partitur-sorot-aktif"]`) mengikuti `TempoTimeline` ±1 birama dan menggulir wadah kertas saat berpindah sistem, termasuk tetap menyorot kotak *multi-rest* saat melewati birama istirahat.
   - **Pilih & *loop* `Bar 5–8` pada `80%` tempo:** memilih birama 5 dan 8 langsung di partitur SVG menyalakan `Frasa 5–8 · 80%`, mengulang **tepat 4 birama (`5, 6, 7, 8 → kembali ke 5`, tidak pernah bocor ke birama 9)** baik dengan metronom maupun dengan rekaman audio `#6`, mendukung *count-off* M1, serta bertahan di `localStorage` seusai muat ulang halaman.
   - **Lencana & *fallback* tanpa MusicXML:** lencana `"Frasa 5–8 · 80%"` tampil di `PanelLagu` dan `KartuSetList`; lagu kedua yang tidak memiliki MusicXML tetap dapat memilih dan mengulang frasa `Bar 5–8` pada `80%` tempo via `TempoTimeline`.
   - **Tautan `Set 4–6 = Bar 9–16` & sorot dari `DrillEditor`:** menautkan `Set 4–6` di `KartuSetList` menampilkan `"Set 4–6 = Bar 9–16"` dan mengekliknya langsung mengaktifkan frasa `Bar 9–16`; membuka `Partitur` di dalam `DrillEditor` menyorot birama sesuai set/hitungan yang sedang dimainkan.
   - **Audit warna ketat:** `!/oklch\(|color-mix\(/i.test(layar.outerHTML)` tetap bernilai `true` saat seluruh lapisan sorot dan bilah frasa tampil.
3. **Regresi penuh (`qa/regresi-penuh.sh`):** seluruh **113** rangkaian uji (`111` rangkaian lama termasuk `m2-ulang-bagian`, `m3-setlist`, `m6-klik-rekaman`, `tempo-latihan`, `partitur-render`, `partitur-cetak` + `2` rangkaian baru `#11d`) lulus dengan `0 gagal`.
