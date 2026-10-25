/**
 * DrillKit — Definisi tipe data.
 *
 * Semua data tersimpan di browser (IndexedDB lewat Dexie), jadi aplikasi
 * tetap berjalan tanpa internet dan tanpa biaya server.
 *
 * Koordinat formasi disimpan dalam SATUAN YARD, relatif terhadap:
 *   - x = 0  di garis tengah lapangan (50 yard), positif ke arah SIDE 1
 *   - y = 0  di garis tengah lapangan, positif ke arah BACK SIDELINE
 *     (menjauh dari penonton). Front sideline = sisi penonton.
 * Konversi ke "langkah" (steps) dilakukan saat ditampilkan, karena ukuran
 * langkah bisa berbeda tiap tim (8-to-5, 6-to-5, dst).
 */

/**
 * Section bersifat DINAMIS: pelatih bisa menambah/mengubah nama & warnanya
 * di Pengaturan. Nilai bawaan mengikuti istilah marching band pada umumnya.
 */
export type Section = string

export interface SectionDef {
  /** id internal, dipakai sebagai nilai `member.section` */
  id: string
  label: string
  /** singkatan pendek untuk chip */
  short: string
  /** warna titik di chart (hex) */
  dot: string
  /** 1 = tidak ditampilkan di pilihan, tapi data lamanya tetap aman */
  hidden?: number
}

export type MemberRole = 'member' | 'sectionLeader' | 'drumMajor' | 'assistant'

export interface Member {
  id: string
  /** Nomor/ID singkat yang tampil di chart (mis. "T1", "12") */
  code: string
  name: string
  /**
   * Nama panggilan di lapangan, mis. "Dede". Kosong = tidak ada.
   * Yang tampil (nama lengkap atau panggilan) dipilih per perangkat, bukan
   * di sini. Cetakan resmi tetap memakai `name`.
   */
  panggilan?: string
  /**
   * Id lama yang pernah merujuk orang yang sama — hasil penggabungan atau
   * pencocokan impor. Impor berikutnya langsung cocok tanpa ditanya lagi.
   */
  alias?: string[]
  section: Section
  /**
   * Instrumen **sekaligus perlengkapan** yang dibawa pemain. Satu kolom saja
   * (bukan dua), supaya tidak ada dua tempat untuk hal yang sama — label di
   * form anggota memang sengaja "Instrumen / perlengkapan".
   */
  instrument: string
  role: MemberRole
  joinYear: number
  active: number // 0 | 1 (IndexedDB tidak bisa index boolean)
  phone?: string
  notes?: string
  /** Token acak untuk QR absensi — jadi tidak bisa ditebak */
  token: string
  createdAt: number
}

/**
 * D3 — Jenis kegiatan. Dipakai untuk membedakan angka kehadiran:
 * latihan biasa, latihan section, latihan gabungan, penampilan/konser, rapat, dll.
 * Nilai lama ('latihan', 'penampilan', 'rapat', 'lainnya') tetap berlaku, jadi
 * data yang sudah ada tidak rusak.
 */
export type SessionType = 'latihan' | 'section' | 'gabungan' | 'penampilan' | 'rapat' | 'lainnya'

export interface ChecklistItem {
  id: string
  text: string
  done: number // 0 | 1
}

export interface Session {
  id: string
  title: string
  type: SessionType
  /** Tanggal format ISO: YYYY-MM-DD */
  date: string
  startTime: string // "15:30"
  endTime: string
  place?: string
  notes?: string
  checklist: ChecklistItem[]
  createdAt: number
  /**
   * G1 — set list yang dibawakan pada sesi ini.
   *
   * Dipakai run sheet hari lomba untuk menjawab pertanyaan yang paling
   * menentukan: **apakah isi penampilan muat di slot waktunya?** Tanpa
   * tautan ini, jadwal hanya berisi rentang waktu kosong.
   */
  setListId?: string

  /**
   * H1 — rencana latihan: blok waktu (pemanasan / section / gabungan / …)
   * beserta durasi yang direncanakan, **dalam menit**.
   *
   * Sengaja disimpan sebagai **durasi**, bukan jam absolut. Waktu absolut
   * tiap blok diturunkan dengan menjumlahkannya dari jam mulai sesi. Dengan
   * begitu, menggeser jam mulai sesi otomatis menggeser seluruh blok —
   * pelatih tidak perlu menyusun ulang rencananya satu per satu.
   */
  rencanaLatihan?: BlokLatihan[]

  /**
   * H1 — realisasi: kapan tiap blok benar-benar mulai dan selesai (epoch ms).
   *
   * Inilah yang membedakan **rencana** dari **kenyataan**. Tanpa ini,
   * "latihan melenceng dari rencana" hanya bisa dirasakan, tidak bisa
   * diukur. Catatan yang sama kelak dipakai G3 untuk sesi hari lomba.
   */
  realisasiLatihan?: RealisasiBlok[]

  /**
   * #3 — penanda seri "ulangi mingguan". Sesi dengan `seriId` sama dibuat
   * sekaligus; mengubah satu sesi bisa diterapkan ke semua berikutnya.
   * Kosong = sesi tunggal. Tidak ada tabel seri tersendiri.
   */
  seriId?: string

  /**
   * G3 — kapan **sesinya sendiri** benar-benar dimulai (epoch ms).
   *
   * Sengaja **terpisah** dari blok pertama. Sesi dimulai ketika pelatih
   * memanggil semua orang berkumpul; blok pertama baru mulai ketika
   * pemanasan benar-benar jalan. Memakai blok pertama sebagai penanda sesi
   * akan menyembunyikan keterlambatan yang paling umum.
   */
  mulaiNyata?: number

  /**
   * G3 — kapan sesi benar-benar diakhiri (epoch ms). `null`/kosong bila
   * belum ditandai; sesi yang dimulai tanpa penanda selesai dianggap
   * **masih berjalan** berapa lama pun, karena menebak waktu berakhirnya
   * lebih buruk daripada mengaku belum tahu.
   */
  selesaiNyata?: number
}

/**
 * H2 — aspek yang dinilai pelatih saat mengevaluasi anggota.
 *
 * **Kehadiran sengaja tidak ada di sini.** Ia sudah terukur dari data
 * absensi, jadi menilainya secara manual akan membuat dua tempat untuk hal
 * yang sama — dan dua angka yang lambat laun tidak cocok. Yang perlu
 * dinilai pelatih justru yang **tidak** bisa dihitung dari data.
 */
export type AspekEvaluasi = 'teknik' | 'musikalitas' | 'kedisiplinan' | 'kerjasama'

/**
 * H2 — satu kali evaluasi untuk satu anggota.
 *
 * Aspek disimpan sebagai peta sederhana (bukan kolom tetap) supaya pelatih
 * boleh menilai sebagian saja — menilai kerjasama tanpa menilai teknik itu
 * sah, dan memaksa semua terisi akan membuat evaluasi jadi asal-asalan.
 */
export interface Evaluasi {
  id: string
  memberId: string
  /** Tanggal evaluasi, format ISO: YYYY-MM-DD */
  tanggal: string
  /** Nilai per aspek, 1–5. Aspek yang tidak dinilai tidak disebut. */
  nilai: Partial<Record<AspekEvaluasi, number>>
  catatan?: string
  /** Siapa yang menilai, mis. "Pelatih". */
  oleh?: string
  createdAt: number
}

/** Jenis blok dalam rencana latihan. Terpisah dari `SessionType` yang ada. */
export type JenisBlok = 'pemanasan' | 'section' | 'gabungan' | 'pendingin' | 'lainnya'

export interface BlokLatihan {
  id: string
  judul: string
  jenis: JenisBlok
  /** Durasi yang direncanakan, dalam menit. Nol atau negatif dianggap tidak sah. */
  menit: number
  catatan?: string
}

export interface RealisasiBlok {
  /** Id blok yang bersesuaian di `rencanaLatihan`. */
  id: string
  /** Epoch ms saat blok benar-benar dimulai. */
  mulai: number
  /** Epoch ms saat blok benar-benar selesai. `null` = sedang berjalan. */
  selesai: number | null
}

export type AttendanceStatus = 'hadir' | 'izin' | 'sakit' | 'alpha'

export interface AttendanceRecord {
  id: string
  sessionId: string
  memberId: string
  status: AttendanceStatus
  checkInAt?: number
  note?: string
}

/* ------------------------------- Drill ---------------------------------- */

export type StepPreset = '8to5' | '6to5' | '4to5' | 'custom'
export type HashPreset = 'nfhs' | 'ncaa' | 'nfl' | 'none'

export interface FieldConfig {
  /** lebar lapangan (yard), default 53.33 */
  widthYd: number
  /** panjang area bermain (yard), default 100 */
  lengthYd: number
  /** end zone di setiap ujung (yard), default 10 */
  endZoneYd: number
  /** jarak antar hash mark */
  hash: HashPreset
  /** jarak antar garis yard untuk grid utama, default 5 yard */
  gridYd: number
  /** jarak subgrid (yard) — 0/undefined = tanpa subgrid */
  subgridYd?: number
  /** 1 = tampilkan grid utama, 0 = sembunyikan (default 1) */
  gridTampil?: number
  /** 1 = tampilkan subgrid, 0 = sembunyikan */
  subgridTampil?: number
  /** 1 = tampilkan hash mark, 0 = sembunyikan (jika undefined, ikut `hash !== 'none'`) */
  hashTampil?: number
  /** ukuran langkah */
  step: StepPreset
  /** jika step === 'custom', panjang 1 langkah dalam yard */
  customStepYd: number
  /** tampilkan label yard line (football) */
  showLabels: number
  /**
   * Satuan yang dipakai saat mengisi panjang/lebar di editor.
   * Nilai yang tersimpan **tetap yard** — ini hanya memengaruhi tampilan & input,
   * supaya drill lama tidak perlu diubah.
   */
  satuan?: 'yd' | 'm'
  /**
   * Sistem patok cara Indonesia (DD1).
   * Kosong atau `aktif: 0` = koordinat tetap memakai format football lama.
   */
  patok?: PatokConfig
  /** Garis lapangan: 1 = semua, 2 = tanpa garis tepi, 0 = sembunyikan semua. */
  garis?: number
  /** Warna latar lapangan — kunci dari `WARNA_LAPANGAN`. Bawaan `'hijau'`. */
  warna?: string
  /**
   * Pengali ukuran titik pemain. `1` = ukuran bawaan (sudah mengikuti luas
   * lapangan). Bisa diperkecil kalau formasi terasa sesak.
   */
  ukuranTitik?: number
}

/**
 * Sistem patok lapangan — kebiasaan tim marching band di Indonesia (DD1).
 *
 * Dua sumbu patok yang saling tegak lurus:
 * - **Patok huruf**: `A → # → B → # → C …` — huruf dan tanda # berselang-seling.
 * - **Patok angka**: `T1 → T2 → T3 …`
 *
 * Posisi pemain dibaca sebagai gabungan keduanya, misalnya **A6** (patok A,
 * patok T6) atau **B#8** (patok B#, patok T8).
 *
 * Semua jarak disimpan dalam **langkah**, bukan yard/meter — karena patok di
 * lapangan dipasang dengan melangkah, dan ukuran langkah bisa berbeda per
 * drill. Jaraknya ikut menyesuaikan kalau ukuran langkah diubah.
 */
export interface PatokConfig {
  /** 1 = koordinat ditulis memakai patok; 0 = memakai format football */
  aktif: number
  /**
   * Patok huruf dipasang di sumbu yang mana; sumbu lainnya dipakai patok T.
   * `'y'` = melintang (depan ↔ belakang), `'x'` = membujur (S1 ↔ S2).
   */
  sumbuHuruf: 'x' | 'y'
  /**
   * Pola patok huruf.
   * `1` (bawaan, kebiasaan tim) = **A di titik tengah**, lalu keluar ke dua
   *   sisi: `# C # B # A # B # C #`.
   * `0` = A di tepi, lalu lurus ke seberang: `A # B # C # …`.
   */
  dariTengah: number
  /** 1 = patok angka ditulis `T1`, `T2`; 0 = cukup `1`, `2` */
  awalanT: number
  /**
   * 1 = sisi yang berlawanan diberi tanda koma atas (`B'`), supaya patok kiri
   * dan kanan tidak rancu saat dibaca di buku saku. 0 = ditulis sama saja.
   */
  penandaSisi: number
  /** jarak patok huruf ke huruf berikutnya (A→B), dalam langkah */
  jarakHuruf: number
  /** jarak patok huruf ke tanda # sesudahnya (A→#), dalam langkah */
  jarakHash: number
  /** jarak antar patok angka (T1→T2), dalam langkah */
  jarakT: number
  /** 1 = gambar patok & labelnya di lapangan (legacy, gabungan) */
  tampil: number
  /**
   * Batas huruf maksimum (0=A, 1=B, …, 4=E). Undefined = otomatis sampai tepi
   * lapangan. Jika A di tengah, batas berlaku simetris ke dua sisi.
   */
  maksHuruf?: number
  /** Batas T maksimum (1-based, mis. 26 = T1..T26). Undefined = otomatis. */
  maksT?: number
  /** 1 = tampilkan garis patok; 0 = sembunyikan (jika undefined, ikut `tampil`) */
  tampilGaris?: number
  /** 1 = tampilkan label patok; 0 = sembunyikan (jika undefined, ikut `tampil`) */
  tampilLabel?: number
  /**
   * Satuan jarak patok: 'langkah' (bawaan) = jarak dalam langkah (ikut
   * ukuran langkah 8-to-5); 'yard' = jarak fisik yard (mengikuti grid,
   * tidak ikut langkah). Dipakai bila pelatih ingin patok sejajar garis grid.
   */
  satuanJarak?: 'langkah' | 'yard'
}

export type Facing = 'front' | 'back' | 'left' | 'right' | 'custom'

export interface DrillPoint {
  /** posisi dalam yard, relatif titik tengah lapangan */
  x: number
  y: number
  /** facing: 'front' = menghadap penonton, atau derajat manual (0 = front) */
  facing: Facing
  facingDeg?: number
}

/**
 * 1a — Riwayat perubahan formasi: "undo yang tidak hilang".
 *
 * Mengapa perlu: `Ctrl+Z` di editor hanya mengingat langkah selama halaman
 * masih terbuka. Begitu halaman ditutup, drill diganti, atau perangkat
 * kehabisan baterai, semua langkah itu lenyap — padahal menyusun satu set
 * bisa makan berjam-jam. Yang paling sering terjadi bukan salah besar,
 * melainkan salah kecil yang baru disadari besoknya.
 *
 * Karena itu keadaan drill difoto **utuh** (bukan sekadar langkah yang
 * berubah), dan bisa dikembalikan kapan saja. Fotonya disimpan di
 * IndexedDB yang sama, jadi tetap jalan offline seperti semua fitur lain.
 */
export type AlasanRiwayat =
  /** difoto sendiri oleh aplikasi tiap beberapa menit, bila ada perubahan */
  | 'otomatis'
  /** difoto oleh pelatih lewat tombol Tandai */
  | 'tandai'
  /** difoto sesaat sebelum sebuah set dihapus */
  | 'sebelum-hapus-set'
  /** difoto sesaat sebelum drill dihapus */
  | 'sebelum-hapus-drill'
  /** difoto sesaat sebelum show dari pelatih lain ditimpa / digabung */
  | 'sebelum-impor'
  /** difoto sesaat sebelum sebuah versi lama dikembalikan */
  | 'sebelum-kembalikan'
  /** #5 sisa — difoto sesaat sebelum sebuah set dipecah jadi dua */
  | 'sebelum-pecah-set'
  /** #5 sisa — difoto sesaat sebelum sebuah set digabung dengan set berikutnya */
  | 'sebelum-gabung-set'
  /** #10 — difoto sesaat sebelum lembar koordinat Pyware ditulis ke drill ini */
  | 'sebelum-impor-pyware'

/** Isi drill yang difoto — tanpa id & cap waktu, karena itu milik snapshot. */
export type IsiDrill = Omit<Drill, 'id' | 'createdAt' | 'updatedAt'>

export interface RiwayatSnapshot {
  id: string
  drillId: string
  /** kapan difoto (epoch ms) */
  at: number
  alasan: AlasanRiwayat
  /** tulisan pelatih; hanya terisi untuk alasan 'tandai' */
  label?: string
  /** 1 = jangan dibuang oleh pemangkasan otomatis */
  pin: 0 | 1
  /** ringkasan isi, supaya daftar bisa tampil tanpa membongkar fotonya */
  jumlahSet: number
  jumlahTitik: number
  /** sidik jari isi — foto yang sama persis tidak disimpan dua kali */
  cicip: string
  isiDrill: IsiDrill
  isiSet: DrillSet[]
}

/**
 * 1b — berkas backup yang ditulisi sendiri oleh aplikasi.
 *
 * `pegangan` bertipe `unknown` dengan sengaja: ia adalah
 * `FileSystemFileHandle`, yang tidak punya tipe di pustaka standar
 * TypeScript. Tipenya ditulis sendiri di `lib/simpanOtomatis.ts`, dan
 * dipakai dengan penyesuaian tipe di sana — bukan di sini, supaya lapisan
 * penyimpanan tidak perlu tahu tentang API peramban.
 */
export interface Simpanan {
  key: 'utama'
  pegangan: unknown
  /** nama berkas, untuk ditampilkan saja */
  nama: string
  /** kapan terakhir berhasil disimpan; 0 = belum pernah */
  at: number
}

export interface DrillSet {
  id: string
  drillId: string
  order: number
  name: string
  /** jumlah count untuk berpindah KE set berikutnya (0 = set terakhir/diam) */
  counts: number
  notes?: string
  /** key = memberId */
  points: Record<string, DrillPoint>
  /** DD2 — cara pemain berpindah KE set berikutnya. Kosong = lurus & rata. */
  gerak?: GerakSet
  /**
   * DD10b — cara langkah dihitung **per pemain** untuk perpindahan yang
   * bermula di set ini. Key = memberId. Yang tidak disebut mengikuti
   * bawaan drill.
   */
  langkah?: Record<string, SetelanLangkah>
  createdAt: number
}

/**
 * 31e — Dasar jarak yang dipakai untuk menghitung langkah.
 *
 * Dua kebiasaan yang sama-sama dipakai, dan tidak ada yang benar sendiri:
 *
 * - **`jalur`** (bawaan) — jarak **tempuh kaki**, mengikuti kelengkungan
 *   jalur. Jalur melengkung membuat jarak tempuh lebih panjang dari garis
 *   lurus walau titik awal & akhirnya sama. Ini yang menentukan berapa
 *   banyak langkah yang benar-benar diambil pemain.
 * - **`lurus`** — jarak **perpindahan** dari titik awal ke titik akhir,
 *   mengabaikan kelengkungan. Ini yang dipakai desainer yang menghitung
 *   formasi secara geometris: "delapan langkah dari sini ke sana".
 *
 * Pilihan ada di tangan desainer drill, bukan ditentukan aplikasi.
 */
export type DasarJarak = 'jalur' | 'lurus'

/** Cara menghitung langkah pada satu perpindahan. */
export type ModeLangkah = 'tetap' | 'menyesuaikan'

/**
 * DD10b — Cara langkah dihitung.
 *
 * Dua kebiasaan yang berbeda, dan keduanya dipakai tim:
 *
 * - **`tetap`** — ukuran langkah dikunci (bawaan 8-to-5 = 22,5″). Jumlah
 *   langkah ditentukan jaraknya; yang berubah adalah
 *   **kecepatannya** (langkah per hitungan). Jarak dekat dalam hitungan
 *   panjang = jalan pelan, setengah langkah tiap hitungan.
 * - **`menyesuaikan`** — jumlah langkah ditentukan **hitungannya**
 *   (`hitungan × langkahPerCount`), lalu **ukuran langkahnya** yang
 *   mengecil atau membesar. Ritme tetap satu langkah tiap hitungan, yang
 *   menyesuaikan panjang langkahnya.
 */
export interface SetelanLangkah {
  mode: ModeLangkah
  /**
   * Patokan langkah tiap hitungan. Hanya dipakai bila
   * `mode === 'menyesuaikan'`. Bawaan 1 (satu langkah tiap hitungan);
   * 2 untuk jalan cepat, 0,5 untuk setengah langkah.
   */
  langkahPerCount?: number
}

/**
 * DD2 — Cara pemain berpindah ke set berikutnya.
 *
 * Semua nilainya opsional; set yang belum diatur tetap bergerak **lurus dan
 * rata** seperti sebelumnya, jadi drill lama tidak berubah.
 */
export interface GerakSet {
  /** bentuk jalur yang dilalui pemain */
  jalur?: 'lurus' | 'lengkung' | 'busur'
  /**
   * Derajat kelengkungan, -1 … 1.
   * `0` = lurus; positif melengkung ke satu sisi, negatif ke sisi lain.
   * Hanya dipakai kalau `jalur === 'lengkung'`.
   */
  lengkung?: number
  /** pembagian kecepatan sepanjang perpindahan */
  mudah?: 'rata' | 'halus' | 'mulaiPelan' | 'akhirPelan'
  /**
   * Putaran blok yang terjadi pada perpindahan ini — pusat putaran (yard) dan
   * sudutnya (derajat, boleh negatif).
   *
   * Dipakai kalau `jalur === 'busur'`. Pemain yang perpindahannya **cocok**
   * dengan putaran ini mengikuti busur lingkaran, sehingga jaraknya ke pusat —
   * dan karena itu jarak antar pemain — tetap terjaga sepanjang jalan.
   * Pemain yang tidak cocok tetap memakai jalur lurus/melengkung seperti biasa.
   *
   * `pusatAkhir` membuat **lingkarannya ikut berjalan**: blok berputar
   * mengitari sebuah pusat yang pada saat yang sama bergeser lurus dari
   * `pusat` ke `pusatAkhir`. Tidak diisi (atau sama dengan `pusat`) =
   * berputar di tempat, persis seperti sediakala.
   */
  putar?: {
    pusat: { x: number; y: number }
    sudut: number
    /** Ke mana pusat putaran berpindah selama perpindahan ini (yard). */
    pusatAkhir?: { x: number; y: number }
  }
  /**
   * Tunda mulai **per section**, dalam count. Misal `{ battery: 2 }` berarti
   * Battery mulai jalan 2 count lebih lambat, lalu mengejar supaya tetap tiba
   * bersamaan di akhir.
   */
  tunda?: Record<string, number>
}

/**
 * A7 — Penanda bebas di lapangan (bukan pemain): properti, bendera, garis
 * bantu, panah, atau sekadar label area. Disimpan **per drill**, jadi tampil
 * di semua set layaknya garis lapangan.
 */
export type MarkerKind = 'titik' | 'kotak' | 'garis' | 'panah' | 'teks'

export interface FieldMarker {
  id: string
  jenis: MarkerKind
  label: string
  /** posisi dalam yard, titik tengah lapangan = 0,0 */
  x: number
  y: number
  /** ujung kedua — dipakai kotak, garis, dan panah */
  x2?: number
  y2?: number
  /** warna hex murni (aman untuk browser lama) */
  warna: string
  /** jari-jari titik dalam yard (khusus jenis 'titik') */
  r?: number
}

export interface Drill {
  id: string
  name: string
  showTitle: string
  field: FieldConfig
  /** tempo dasar (BPM) untuk playback */
  tempo: number
  /** beats per count (8-to-5 biasanya 1 count = 1 beat, bisa 2 untuk "mark time") */
  beatsPerCount: number
  /** urutan section yang dipakai, opsional */
  rosterIds: string[]
  /** A7 — penanda bebas di lapangan (properti, bendera, garis bantu) */
  markers?: FieldMarker[]
  /** DD10b — bawaan cara langkah dihitung untuk seluruh drill. */
  setelanLangkah?: SetelanLangkah
  /**
   * 31e — dasar jarak untuk drill ini: jarak tempuh mengikuti jalur, atau
   * garis lurus. Kosong = `jalur`, persis seperti sebelumnya, jadi drill
   * lama tidak berubah.
   */
  setelanJarak?: DasarJarak
  /**
   * M1 — tautan ke lagu di repertoar. Kalau diisi, **tempo & segmen lagu
   * dipakai untuk drill**: tiap set berjalan pada tempo lagu di birama
   * tempat set itu mulai, dan perubahan sukat lagu ikut menentukan berapa
   * birama yang terlewati.
   *
   * Kosong = perilaku lama (satu tempo datar untuk seluruh drill).
   */
  songId?: string
  createdAt: number
  updatedAt: number
}

/* ------------------------------- Musik ---------------------------------- */

export interface TempoSegment {
  id: string
  label: string
  measure: number
  bpm: number
  beats: number // pembilang birama, mis. 4
  note?: string
  /**
   * M1 — tanda birama yang berlaku **mulai segmen ini**. Kosong = mewarisi
   * tanda birama lagu. Jadi lagu bisa berganti meter: 4/4 → 7/8 → 4/4.
   */
  birama?: TandaBirama
  /**
   * N6 — legacy bar-to-bar ramp.  Keberadaannya mempertahankan perilaku
   * tempo map lama; new maps should use `rampCounts` for an explicit length.
   */
  berangsur?: 0 | 1
  /**
   * Fine-grained position within `measure` (1-based, counted in written
   * denominator-note beats).  Missing values mean beat 1, subdivision 1/1,
   * which is exactly the legacy bar-start position.
   */
  beat?: number
  subdivision?: number
  subdivisionsPerBeat?: number
  /**
   * Explicit inclusive ramp length.  The row's BPM is the target; the first
   * changed count occurs at this row's position and count N reaches target.
   */
  rampCounts?: number
  /** Musical distance between ramp counts. `tempoBeat` means the BPM note
   * unit (including dotted-note acuan), `beat` means one written beat. */
  rampUnit?: 'beat' | 'tempoBeat' | 'subdivision' | 'tempoSubdivision' | 'bar'
  /** Subdivisions per written beat when rampUnit is `subdivision` (e.g. 3). */
  rampSubdivisions?: number
  /** Optional explicit pre-ramp BPM; omitted = evaluator uses the active BPM. */
  rampFromBpm?: number
}

/* ------------------- M1 — Tanda birama & hitung mundur -------------------- */

import type { HitungMundur, TandaBirama } from '../lib/birama'
// #11a — sub-bidang ringkasan partitur, supaya metadata (di sini) dan pemindai
// (`src/lib/partitur.ts`) tidak bisa berbeda diam-diam. Impor tipe: tidak ada
// kode yang ikut masuk bundel.
import type { BagianPartitur, PerubahanSukatPartitur, SukatPartitur } from '../lib/partitur'

/** Diteruskan supaya komponen cukup mengimpor dari `db/types`. */
export type { HitungMundur, TandaBirama }

/* --------------------- E3 — Pola ritme metronom --------------------------- */

/** Keadaan satu kotak dalam pola: 0 = diam, 1 = ketuk biasa, 2 = aksen. */
export type TingkatKlik = 0 | 1 | 2

/** Satu birama di dalam pola ritme (bisa beda ketukan & pembagian per birama). */
export interface BiramaPola {
  id: string
  /** jumlah ketukan dalam birama ini (2–12) */
  beats: number
  /** pembagian per ketukan: 1 = penuh, 2 = setengah, 3 = triplet, 4 = enam belas */
  subdiv: number
  /** panjang = beats × subdiv */
  cells: TingkatKlik[]
  label?: string
}

/** Suara kedua untuk poliritme (mis. 3 lawan 2) — merata sepanjang birama. */
export interface SuaraKedua {
  beats: number
  subdiv: number
  cells: TingkatKlik[]
}

/** Pola ritme utuh: rangkaian birama yang diulang + suara kedua opsional. */
export interface PolaRitme {
  bars: BiramaPola[]
  poly: SuaraKedua | null
}

/** Latih tempo: tempo bergerak bertahap tiap beberapa birama. */
export interface LatihTempo {
  on: boolean
  /** BPM awal */
  dari: number
  /** BPM tujuan */
  ke: number
  /** perubahan BPM tiap siklus (boleh negatif kalau dari > ke) */
  langkah: number
  /** jumlah birama per siklus */
  tiap: number
}

/** Jenis bunyi metronom. */
export type SuaraKlik = 'klik' | 'kayu' | 'bel'

/**
 * M2 — rentang birama yang diulang terus saat berlatih.
 *
 * Inklusif di kedua ujung: `dari = 32, sampai = 48` berarti birama 32
 * sampai 48 diputar berulang-ulang.
 */
export interface UlangBagian {
  /** birama awal rentang (1-based, inklusif) */
  dari: number
  /** birama akhir rentang (1-based, inklusif) */
  sampai: number
  /** 1 = nyalakan pengulangan rentang ini. 0 = simpan saja, jangan pakai. */
  aktif: 0 | 1
}

export interface Song {
  id: string
  title: string
  composer?: string
  bpm: number
  beats: number
  key?: string
  notes?: string
  tempoMap: TempoSegment[]
  createdAt: number
  /** E3 — pola ritme per birama + poliritme. Null = metronom detak rata. */
  pola?: PolaRitme | null
  /** E3 — latih tempo (naik/turun bertahap). */
  latih?: LatihTempo | null
  /** E3 — jenis bunyi. */
  suara?: SuaraKlik
  /** E3 — getar tiap ketukan (0/1 seperti kebiasaan tabel lain di aplikasi ini). */
  getar?: 0 | 1
  /** E3 — volume 0–1. */
  volume?: number
  /**
   * M1 — tanda birama asli lagu (7/8, 5/4, 12/8, …).
   * Kosong pada lagu lama → diturunkan dari `beats`, dan bunyinya persis
   * seperti sebelumnya (lihat `dariBeatsLama`).
   */
  tandaBirama?: TandaBirama
  /** M1 — hitung mundur sebelum lagu mulai (count-off). */
  hitungMundur?: HitungMundur | null
  /**
   * M5 — panjang lagu dalam **birama** (1-based, inklusif): lagu ini
   * berakhir di akhir birama ke-`panjangBirama`.
   *
   * Kosong pada lagu lama → metronom berjalan terus seperti sebelumnya,
   * jadi tidak ada yang berubah sampai pelatih mengisinya.
   */
  panjangBirama?: number
  /**
   * M5 — ulang lagu dari awal begitu birama terakhir selesai.
   * Bawaan (kosong/false) = berhenti di akhir lagu.
   */
  ulang?: 0 | 1
  /**
   * M2 — ulang satu bagian saja (mis. birama 32–48) alih-alih seluruh lagu.
   * Kalau `aktif`, rentang ini **menang** atas `ulang` maupun akhir lagu:
   * lagu tidak akan berhenti sendiri selama pengulangan bagian menyala.
   */
  ulangBagian?: UlangBagian
  /**
   * #6 — Pengaturan rekaman audio (MP3/WAV/M4A/OGG) untuk lagu ini.
   * Berkas binernya (Blob) disimpan di IndexedDB tabel `rekamanAudio`.
   */
  rekaman?: RekamanAudioMeta | null
  /**
   * #11a — Metadata partitur (MusicXML/PDF) untuk lagu ini.
   * Berkas binernya (Blob) disimpan di IndexedDB tabel `partiturBerkas`.
   *
   * Metadata ini kecil dan **selalu ikut terkirim** di berkas show/repertoar;
   * notasinya tidak pernah ikut — persis alasan pemisahan yang sama dengan
   * `rekaman` di atas, seperti yang dipegang §11: *"berkas show & repertoar
   * dapat membawa rujukan partitur (id lagu), bukan notasi penuh, agar ukuran
   * paket tetap wajar."*
   */
  partitur?: PartiturMeta | null
}

/**
 * #6 — Metadata rekaman audio untuk lagu.
 *
 * Rekaman bertempo stabil (render notasi atau rekaman dengan klik).
 * Dibawa dalam berkas show dan ekspor repertoar; berkas audionya sendiri
 * dikirim terpisah atau via ZIP.
 */
export interface RekamanAudioMeta {
  namaFile: string
  tipe: string
  ukuran: number
  durasi: number
  /** SHA-256 hash atau sidik biner hex */
  hash: string
  /** Titik mulai (birama 1 ketuk 1) dalam detik pada berkas audio. Bawaan 0. */
  titikMulaiDetik: number
  /** Koreksi offset waktu per segmen (ms) untuk fermata/rit. */
  koreksiSegmen?: Record<string, number>
  /** Volume audio rekaman (0–1). Bawaan 1. */
  volumeAudio?: number
  /** Volume bunyi klik metronom (0–1). Bawaan 0.8. */
  volumeKlik?: number
  /** Pilihan bunyi: rekaman saja, rekaman + klik, atau klik saja. */
  modeBunyi?: 'rekaman' | 'keduanya' | 'klik'
  /** Ringkasan puncak gelombang suara (peaks) untuk canvas waveform. */
  peaks?: number[]
}

/**
 * #6 — Rekaman audio yang tersimpan di IndexedDB perangkat ini.
 */
export interface AudioRekamanItem {
  /** Id unik, disamakan dengan songId lagu pemilik */
  id: string
  songId: string
  blob: Blob
  namaFile: string
  tipe: string
  ukuran: number
  durasi: number
  hash: string
  updatedAt: number
}

/* ------------------------------ #11a — Partitur --------------------------- */

/**
 * #11a — Metadata partitur lagu (MusicXML/PDF).
 *
 * Isinya = **ringkasan dari `ringkasMusicXml`** (`src/lib/partitur.ts`)
 * ditambah empat bidang penyimpanan: `namaFile`, `ukuran`, `hash`, dan
 * `dipasangiAt`. Sub-bidangnya karena itu **diimpor** dari modul itu, bukan
 * ditulis ulang di sini: pemindai dan metadata harus sepakat, dan dua
 * definisi yang sama-sama ditulis tangan adalah dua definisi yang akan
 * berbeda diam-diam.
 *
 * Aturan yang dipegang: metadata kecil dan selalu ikut terkirim, bita tidak
 * pernah ikut. Kalau metadata ada tetapi Blob-nya tidak ada di perangkat ini
 * (mis. anggota menerima berkas show tanpa ZIP), UI menyebut "partitur
 * tercatat, berkasnya belum ada di perangkat ini" — bukan error, dan tidak
 * pernah buntu.
 */
export interface PartiturMeta {
  namaFile: string
  /** Jenis yang benar-benar terdeteksi dari isinya, bukan tebakan dari ekstensi. */
  tipe: 'musicxml' | 'pdf'
  ukuran: number
  /** SHA-256 hex — untuk tahu apakah Blob lokal masih cocok dengan metadata. */
  hash: string
  /** `partwise` (umum) atau `timewise` (measure-major). */
  susunan?: 'partwise' | 'timewise'
  /** `<movement-title>` / `<work-title>` / `<identification>`. */
  judul?: string
  /** `<creator type="composer">`. */
  pengarang?: string
  /** Birama terbanyak di antara semua part. */
  jumlahBirama: number
  jumlahPart: number
  /** Urutan sesuai `<part-list>` — bahan part per instrumen di 11c. */
  parts: BagianPartitur[]
  /** Sukat pertama yang ditemukan. */
  sukat?: SukatPartitur
  /**
   * Perubahan sukat, satu birama = paling banyak satu entri. Lagu 4/4 murni
   * menghasilkan satu entri; lagu bersukat campur (7/8 di tengah) beberapa.
   */
  perubahanSukat: PerubahanSukatPartitur[]
  /** `<sound tempo="…">` pertama (BPM). */
  tempo?: number
  /**
   * `false` bila tidak ada ringkasan struktur yang bisa dibaca — dua sebab
   * yang dibedakan pemakainya:
   *
   * - `ringkasGagal` terisi → berkasnya XML yang sah tetapi pemindai kita
   *   tidak sanggup meringkasnya (keputusan D4). Berkasnya **tetap disimpan**
   *   dan ikut terbawa di ZIP; hanya ringkasannya yang kosong — sebab OSMD di
   *   11b memakai parser XML sungguhan, jadi yang menjegal pemindai kita belum
   *   tentu menjegal perender.
   * - `ringkasGagal` kosong → berkasnya PDF: memang tidak ada yang bisa
   *   diringkas, dan itu bukan kegagalan.
   *
   * Bidang ringkasan (`jumlahBirama`, `parts`, …) bernilai nol/kosong saat
   * `terurai: false` — bukan angka karangan.
   */
  terurai: boolean
  /** Pesan galat parser bila `terurai: false` **dan** berkasnya MusicXML. */
  ringkasGagal?: string
  dipasangiAt: number
}

/**
 * #11a — Berkas partitur yang tersimpan di IndexedDB perangkat ini.
 *
 * Cerminan `AudioRekamanItem` (#6) untuk notasi, sesuai keputusan D2: store
 * baru bernama kata benda + jenis isinya (`rekamanAudio` → `partiturBerkas`),
 * dan "berkas" menyebut apa yang ada di dalamnya (bita), bukan konsep
 * domainnya.
 */
export interface PartiturBerkasItem {
  /** Id unik, disamakan dengan songId lagu pemilik (pola #6). */
  id: string
  songId: string
  blob: Blob
  namaFile: string
  /** `'musicxml' | 'pdf'` — hasil deteksi, bukan tebakan dari ekstensi. */
  tipe: 'musicxml' | 'pdf'
  ukuran: number
  hash: string
  updatedAt: number
}

/**
 * #11d — Tautan frasa birama partitur ke rentang set drill pada baris set list
 * (mis. `Set 4–6 = Bar 9–16`).
 */
export interface TautanFrasaSetList {
  /** Id drill sumber pemetaan bila ditautkan dari drill tertentu. */
  drillId?: string
  /** Nomor urut set awal 1-based inklusif (mis. 4 untuk "Set 4–6"). */
  setAwal: number
  /** Nomor urut set akhir 1-based inklusif (mis. 6 untuk "Set 4–6"). */
  setAkhir: number
  /** Birama awal 1-based inklusif (mis. 9 untuk "Bar 9–16"). */
  biramaDari: number
  /** Birama akhir 1-based inklusif (mis. 16 untuk "Bar 9–16"). */
  biramaSampai: number
  /** Catatan/label opsional (mis. "Transisi Reff"). */
  label?: string
}

/**
 * M3 — set list (urutan lagu untuk satu penampilan).
 *
 * Isinya hanya **id lagu**, bukan salinan lagu: jadi mengubah judul, tempo,
 * atau panjang sebuah lagu langsung terlihat di semua set list yang
 * memakainya, dan tidak ada data yang usang.
 */
export interface SetList {
  id: string
  /** nama set list, mis. "Show 2026 — Putaran Musik" */
  name: string
  /** id lagu, **berurutan** sesuai urutan penampilan */
  songIds: string[]
  /** catatan bebas: tempat, waktu, kostum, dll. */
  catatan?: string
  /**
   * #11d — tautan opsional antara baris lagu di set list dan rentang set drill
   * / birama partitur (mis. `Set 4–6 = Bar 9–16`). Kuncinya `${indeks}:${songId}`
   * (dengan cadangan `songId`).
   */
  tautanFrasa?: Record<string, TautanFrasaSetList>
  createdAt: number
  updatedAt: number
}

/**
 * M4 — paket repertoar untuk ditukar antar perangkat pelatih.
 *
 * Sengaja **bukan** `ShareBundle`: paket berbagi itu mengalir satu arah
 * (pelatih → HP anggota) dan hanya bisa dibaca, tidak pernah masuk ke
 * pustaka pelatih. Yang ini mengalir antar pelatih dan **ditulis ke
 * pustaka tujuan**.
 *
 * Yang terpenting: **id lagu dipertahankan apa adanya**. `Drill.songId` dan
 * `SetList.songIds` menyimpan id lagu, bukan salinannya — jadi kalau impor
 * memberi id baru, tautan drill ke lagu dan urutan set list akan putus.
 */
export interface PaketRepertoar {
  format: 'drillkit-repertoar'
  version: 1
  exportedAt: number
  /** Asal paket, hanya untuk ditampilkan di pratinjau. */
  team?: { teamName?: string; coachName?: string; city?: string }
  songs: Song[]
  setlists: SetList[]
  /** Drill yang menaut ke lagu terpilih — ikut supaya tautannya tidak putus. */
  drills: Drill[]
  /** Set milik drill di atas; tanpa ini drill yang diimpor akan kosong. */
  sets: DrillSet[]
}

/* ------------------------------ Settings -------------------------------- */

export interface TeamSettings {
  key: 'team'
  teamName: string
  coachName: string
  city?: string
  logo?: string // data URL
  defaultField: FieldConfig
  /** Daftar section/kelompok instrumen milik tim ini */
  sections?: SectionDef[]
  /** PIN opsional untuk mode "lihat saja" di perangkat bersama */
  memberMode: number
  /**
   * Ingatkan untuk backup tiap N hari (0 = pengingat dimatikan).
   * Default 7 — lihat `src/lib/backup.ts`.
   */
  backupIntervalDays?: number
  /**
   * Ambang kesulitan gerak — bisa diubah tim, karena tiap tim berbeda.
   *
   * Latar belakangnya: dulu analitik hanya menilai **kecepatan**
   * (langkah/menit), sedang buku saku menilai kecepatan **dan** ukuran
   * langkah. Akibatnya analitik bisa berkata "semua nyaman" sementara lembaran
   * yang dicetak penuh warna merah. Keduanya kini menilai dua dimensi yang
   * sama dengan ambang yang sama, dan ambangnya bisa diatur di sini.
   */
  ambangGerak?: AmbangGerak
  /**
   * J1 — ambang predikat di kartu kehadiran & CSV ringkas (persen hadir).
   * Kosong = bawaan 85/70 (`PREDIKAT_BAKU` di `lib/laporan.ts`). Disimpan di
   * pengaturan tim — bukan per perangkat — supaya laporan dari laptop dan
   * dari HP pelatih kedua memberi predikat yang sama untuk angka yang sama.
   */
  ambangPredikat?: AmbangPredikat
}

/**
 * Batas bawah tiap predikat kehadiran, dalam persen (0–100).
 * `rate >= baik` → Baik; `rate >= cukup` → Cukup; di bawahnya → Perlu perhatian.
 */
export interface AmbangPredikat {
  baik: number
  cukup: number
}

/** Ambang satu dimensi kesulitan: di atas `padat` jadi padat, dst. */
export interface AmbangTingkat {
  padat: number
  berat: number
  mustahil: number
}

/**
 * Ambang kesulitan gerak.
 *
 * Dua dimensi yang sengaja dipisah: **seberapa cepat** kaki harus bergerak
 * (`perMenit`) dan **seberapa jauh** satu langkah harus menjangkau (`inci`).
 * Keduanya bisa berat sendiri-sendiri — gerakan cepat dengan langkah pendek
 * berbeda masalahnya dengan gerakan pelan bertempo langkah raksasa.
 */
export interface AmbangGerak {
  perMenit?: AmbangTingkat
  inci?: AmbangTingkat
}

/**
 * Catatan evaluasi pribadi untuk satu anggota.
 * Ditulis pelatih, dibaca anggota yang bersangkutan di mode anggota.
 */
/**
 * K3 — kemajuan latihan untuk satu drill.
 *
 * Disimpan di tabel **sendiri**, bukan menempel di `Drill`, dengan dua alasan:
 *
 * 1. Kemajuan adalah **keadaan latihan**, bukan data desain. Mencampurnya
 *    berarti setiap centang menulis ulang rekaman drill — dan karena daftar
 *    drill diurutkan dengan `orderBy('updatedAt')`, drill itu akan melompat
 *    ke puncak daftar setiap kali pemain mencentang sesuatu.
 * 2. Satu drill bisa dilatih oleh banyak seksi secara terpisah, jadi
 *    kemajuan butuh ruangnya sendiri yang tidak ikut tersalin saat drill
 *    digandakan.
 */
export interface Kemajuan {
  /** id drill yang kemajuannya dicatat di sini */
  key: string
  /**
   * `setId` → (kunci centang → kapan dicentang, epoch ms).
   *
   * Kuncinya `'*'` untuk **seluruh formasi**, atau id seksi bila latihan
   * sedang dipilah per seksi (mode asisten K2). Waktu dicatat supaya
   * "terakhir dilatih kapan" bisa dijawab — berguna saat latihan disambung
   * beberapa minggu kemudian.
   */
  centang: Record<string, Record<string, number>>
  /** Kapan terakhir kali rekaman ini diubah (epoch ms). */
  diubah: number
}

export interface MemberNote {
  id: string
  memberId: string
  /** waktu dibuat (epoch ms) */
  at: number
  text: string
  /** siapa yang menulis, mis. "Pelatih" */
  by?: string
}

/* --------------------------- Paket berbagi ------------------------------- */

export interface ShareBundle {
  format: 'drillkit-share'
  version: 1
  exportedAt: number
  team: Omit<TeamSettings, 'key'> | null
  members: Member[]
  sessions: Session[]
  drills: Drill[]
  sets: DrillSet[]
  songs: Song[]
  /**
   * N4 — urutan lagu untuk satu penampilan.
   *
   * Opsional karena paket yang dibuat versi lama tidak memuatnya. Tanpa
   * ini, anggota menerima lagunya tetapi tidak pernah menerima susunan
   * penampilannya — padahal metronom bisa memutarnya berurutan.
   */
  setlists?: SetList[]
  attendance: AttendanceRecord[]
  /** Catatan evaluasi per anggota (opsional — paket lama belum punya) */
  memberNotes?: MemberNote[]
  /** Mode yang disarankan saat paket dibuka: 'member' untuk anggota */
  mode?: 'member' | 'coach'
  /**
   * Untuk siapa berkas ini dibuat — **hanya ada pada berkas per anggota**.
   *
   * Tanpa penanda ini, anggota yang membuka berkasnya sendiri (yang sudah
   * difilter hanya untuk dia) malah disuruh memilih namanya dari seluruh
   * daftar anggota: pertanyaan yang bisa dijawab sendiri oleh aplikasi.
   *
   * Opsional karena dua alasan: berkas **grup** memang bukan untuk siapa
   * pun secara khusus, dan berkas per anggota yang dibuat versi lama tidak
   * memilikinya — yang membukanya tetap ditanya seperti dulu.
   */
  forMember?: string
  /**
   * Nama yang ditulis di berkas per anggota, lengkap dengan panggilan:
   * "Andra Pratama (Dede)". Kosong di berkas grup.
   */
  namaPenerima?: string
}
