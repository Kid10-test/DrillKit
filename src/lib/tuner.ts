/**
 * E4 — Penala (tuner) & nada dengung (drone).
 *
 * Dua alat yang biasanya terpisah di aplikasi lain, disatukan karena dipakai
 * berbarengan: **dengung** menyalakan nada acuan, **penala** membaca nada
 * pemain dari mikrofon lalu menunjukkan selisihnya dalam **sen** (1/100
 * semitone).
 *
 * Catatan teknis kalau mau mengubah sendiri:
 * - Deteksi nada memakai **korelasi silang (autocorrelation)** pada data
 *   gelombang mikrofon. Sederhana, cukup akurat untuk menala (±1–2 sen pada
 *   nada sintetis), dan ringan karena jarak tunda (lag) yang diuji dibatasi
 *   hanya pada rentang nada musik (55–1300 Hz).
 * - Semua bunyi **sintetis** (osilator Web Audio): tetap offline, tanpa berkas
 *   suara, ukuran aplikasi tidak bertambah.
 * - Rentang tunda dibatasi supaya perhitungannya ~1 juta operasi per frame,
 *   aman untuk HP kelas menengah.
 */

/* ------------------------------- Nada & Hz -------------------------------- */

const NAMA = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
/** Ejaan miring (flat) — marching band lebih akrab dengan Bb, Eb, Ab. */
const NAMA_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']

/** Daftar nada untuk pilihan nada dengung. */
export const PILIHAN_NADA = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
/** Oktaf yang ditawarkan: C2 (65 Hz) sampai B5 (988 Hz) — cukup untuk band. */
export const PILIHAN_OKTAF = [2, 3, 4, 5]

/** Nama nada (mis. "A#") → indeks 0–11. Nama tak dikenal dianggap C. */
export function indeksNada(nama: string): number {
  const i = NAMA.indexOf(nama)
  if (i >= 0) return i
  const f = NAMA_FLAT.indexOf(nama)
  return f >= 0 ? f : 0
}

/** Nada + oktaf → frekuensi (Hz), dengan acuan A4 yang bisa diatur. */
export function nadaKeHz(nama: string, oktaf: number, a4 = 440): number {
  const midi = 12 * (oktaf + 1) + indeksNada(nama)
  return a4 * Math.pow(2, (midi - 69) / 12)
}

export interface HasilNada {
  /** frekuensi yang terbaca (Hz) — sudah dihaluskan */
  hz: number
  /** nama nada, mis. "A#" */
  nama: string
  oktaf: number
  /** label siap tampil: "A#4" atau "A#4 / Bb4" untuk nada hitam */
  label: string
  /** selisih terhadap nada terdekat, dalam sen (−50 … +50) */
  sen: number
  /** frekuensi nada terdekat yang seharusnya (Hz) */
  target: number
}

/** Nomor MIDI → nama, oktaf, dan label siap tampil ("A#4 / Bb4"). */
export function namaMidi(midi: number): { nama: string; oktaf: number; label: string } {
  const oktaf = Math.floor(midi / 12) - 1
  const idx = ((midi % 12) + 12) % 12
  const nama = NAMA[idx]
  const flat = NAMA_FLAT[idx]
  return { nama, oktaf, label: `${nama}${oktaf}${flat !== nama ? ` / ${flat}${oktaf}` : ''}` }
}

/** Frekuensi → nada terdekat + selisih sen. */
export function hzKeNada(hz: number, a4 = 440): HasilNada | null {
  if (!isFinite(hz) || hz <= 0) return null
  const midi = Math.round(69 + 12 * Math.log2(hz / a4))
  const target = a4 * Math.pow(2, (midi - 69) / 12)
  const sen = Math.round(1200 * Math.log2(hz / target))
  const { nama, oktaf, label } = namaMidi(midi)
  return { hz, nama, oktaf, label, sen, target }
}

/* ------------------------------ Transposisi -------------------------------- */

/**
 * J1 — transposisi penala: nada yang tampil mengikuti **partitur** pemain.
 *
 * Mikrofon selalu mendengar nada **konser** (nada yang benar-benar berbunyi).
 * Tetapi pemain trumpet yang memainkan C di partiturnya membunyikan Bb konser,
 * jadi penala yang menulis "Bb" membuatnya menghitung ulang di kepala setiap
 * kali — atau lebih buruk, mengira ia salah nada. Dengan transposisi, penala
 * menulis **nada tertulis** ("C5") dan nada konsernya tetap disebut di bawahnya.
 *
 * `geser` = jarak (semitone) dari nada konser ke nada tertulis:
 * **tertulis = konser + geser**. Oktafnya ikut benar — sax tenor berbunyi
 * satu oktaf + satu nada (M9) di bawah tulisannya, jadi geser 14, bukan 2.
 *
 * Selisih **sen tidak berubah** oleh transposisi: meleset 12 sen ya tetap
 * 12 sen, apa pun nama nadanya.
 */
export interface Transposisi {
  id: string
  /** label singkat di pilihan, mis. "Bb" */
  label: string
  /** contoh instrumen — supaya pemain tidak perlu tahu teori transposisi */
  contoh: string
  /** semitone dari konser ke tertulis (tertulis = konser + geser) */
  geser: number
}

export const DAFTAR_TRANSPOSISI: Transposisi[] = [
  { id: 'c', label: 'Konser (C)', contoh: 'trombone, tuba/sousaphone, baritone kunci F, flute, pit', geser: 0 },
  { id: 'bb', label: 'Bb', contoh: 'trumpet, cornet, flugelhorn, klarinet, sax sopran', geser: 2 },
  { id: 'bb8', label: 'Bb oktaf bawah', contoh: 'sax tenor, baritone/euphonium kunci G, klarinet bas', geser: 14 },
  { id: 'eb', label: 'Eb', contoh: 'sax alto, alto horn', geser: 9 },
  { id: 'eb8', label: 'Eb oktaf bawah', contoh: 'sax bariton', geser: 21 },
  { id: 'f', label: 'F', contoh: 'mellophone, french horn', geser: 7 },
]

/** Cari transposisi menurut id; id tak dikenal → konser (aman: tidak menggeser apa pun). */
export function cariTransposisi(id: string | undefined): Transposisi {
  return DAFTAR_TRANSPOSISI.find((t) => t.id === id) ?? DAFTAR_TRANSPOSISI[0]
}

/**
 * Nada konser (hasil penala) → nada tertulis untuk instrumen bertransposisi.
 * Memakai nada terdekat (`target`), bukan frekuensi mentah, supaya nama nada
 * tertulis selalu sepasang dengan angka sen yang tampil.
 */
export function keTertulis(h: HasilNada, geser: number, a4 = 440): { nama: string; oktaf: number; label: string } {
  const midi = Math.round(69 + 12 * Math.log2(h.target / a4))
  return namaMidi(midi + geser)
}

/** Nada dengung (konser) → bunyinya di partitur instrumen, mis. Bb3 konser → "C4" untuk trumpet. */
export function dengungTertulis(nama: string, oktaf: number, geser: number): string {
  const midi = 12 * (oktaf + 1) + indeksNada(nama)
  return namaMidi(midi + geser).label
}

/* ------------------------------ Deteksi nada ------------------------------- */

/** Rentang nada yang dicari (Hz) — di luar ini dianggap bukan nada musik. */
const HZ_TERENDAH = 55
const HZ_TERTINGGI = 1300

/**
 * Korelasi silang pada satu buffer gelombang.
 * Mengembalikan frekuensi (Hz) atau `null` bila sinyal terlalu pelan/rawan noise.
 *
 * Tiga langkah yang penting kalau hasilnya ingin diubah:
 * 1. Jendela korelasi **menyusut** mengikuti jarak tunda (`n - lag`). Dengan
 *    begitu puncak pada periode terkecil nilainya paling besar, jadi nada
 *    tidak terkunci satu–dua oktaf lebih rendah (kelipatan periode juga
 *    menghasilkan korelasi tinggi — itu jebakan utamanya).
 * 2. Interpolasi parabola memakai nilai **ternormalisasi**, supaya panjang
 *    jendela yang berbeda tidak membiaskan arah pergeseran.
 * 3. Pemeriksaan oktaf: kalau separuh/pertiga jarak tunda nilainya nyaris
 *    sama bagus, berarti yang tadi ketemu hanyalah kelipatan periode aslinya.
 *
 * Diekspor juga supaya bisa diuji langsung dari konsol browser.
 */
export function deteksiHz(buf: Float32Array, sampleRate: number): number | null {
  const n = buf.length
  if (!n) return null

  /** Korelasi ternormalisasi untuk satu jarak tunda (0…1 untuk nada murni). */
  const kor = (lag: number): number => {
    if (lag < 1 || lag >= n) return 0
    let s = 0
    const w = n - lag
    for (let i = 0; i < w; i++) s += buf[i] * buf[i + lag]
    return s / w
  }

  // 1. Ukur kekerasan suara. Hening → tidak usah menghitung apa pun.
  let energi = 0
  for (let i = 0; i < n; i++) energi += buf[i] * buf[i]
  const rms = Math.sqrt(energi / n)
  if (rms < 0.006) return null

  // 2. Batasi jarak tunda pada rentang nada musik saja (menghemat hitungan).
  const lagMin = Math.max(2, Math.floor(sampleRate / HZ_TERTINGGI))
  const lagMax = Math.min(n - 2, Math.floor(sampleRate / HZ_TERENDAH))
  if (lagMax <= lagMin) return null

  // 3. Cari puncak korelasi. Nilainya **dinormalisasi** panjang jendela
  //    (`s / (n - lag)`): tanpa itu, tunda kecil selalu menang hanya karena
  //    jendelanya lebih panjang — nada rendah seperti E2 (82 Hz) akan terbaca
  //    beberapa oktaf lebih tinggi.
  let maks = -Infinity
  let idx = -1
  for (let lag = lagMin; lag <= lagMax; lag++) {
    let s = 0
    const w = n - lag
    for (let i = 0; i < w; i++) s += buf[i] * buf[i + lag]
    const v = s / w
    if (v > maks) {
      maks = v
      idx = lag
    }
  }
  if (idx < 0 || maks <= 0) return null

  // 4. Kejelasan nada: korelasi ternormalisasi dibanding energi sinyal.
  //    Nada murni ≈ 1; desis & suara ruangan biasanya jauh di bawah 0,3.
  const jelas = kor(idx) / (rms * rms)
  if (jelas < 0.3) return null

  // 5. Interpolasi parabola — jarak tunda itu bilangan bulat, jadi tanpa ini
  //    angka sen akan melompat-lompat di antara dua nilai terdekat.
  const x1 = kor(idx - 1)
  const x2 = kor(idx)
  const x3 = kor(idx + 1)
  const a = (x1 + x3 - 2 * x2) / 2
  const b = (x3 - x1) / 2
  const geser = a !== 0 ? -b / (2 * a) : 0
  let lag = idx + (Math.abs(geser) < 1 ? geser : 0)

  // 6. Perbaikan oktaf: uji separuh, sepertiga, … dari jarak tunda tadi.
  //    Kalau nilainya nyaris sama bagus, pakai yang lebih kecil (nada lebih
  //    tinggi). Sampai kelipatan 12 — pada nada tinggi, kelipatan ke-7 pun
  //    masih masuk rentang yang diuji, dan itu pernah membuat A4 (440 Hz)
  //    terbaca sebagai 62,8 Hz.
  let nilai = x2
  for (let k = 2; k <= 12; k++) {
    const bagi = lag / k
    if (bagi < lagMin) break
    const b = Math.round(bagi)
    const v = kor(b)
    // Syarat ketat: nilainya harus nyaris sama bagus (≥90%) **dan** benar-benar
    // sebuah puncak (lebih besar dari tetangga kiri-kanannya). Tanpa syarat
    // kedua, nada rendah seperti E2 (82 Hz) bisa salah dibagi 12 kali —
    // gelombangnya pelan, jadi korelasi di tunda kecil memang tinggi.
    const puncak = v >= kor(b - 1) && v >= kor(b + 1)
    if (v > nilai * 0.9 && puncak) {
      lag = bagi
      nilai = v
      k = 1 // ulangi pemeriksaan dari k = 2 untuk kandidat yang baru
    }
  }

  const hz = sampleRate / lag
  if (!isFinite(hz) || hz < HZ_TERENDAH * 0.8 || hz > HZ_TERTINGGI * 1.2) return null
  return hz
}

/* -------------------------------- Penala ----------------------------------- */

/**
 * Penala dari mikrofon.
 *
 * Dipakai: `await mulai()` sekali (harus dari klik tombol, karena browser
 * hanya mengizinkan setelah ada gestur), lalu panggil `baca()` berulang.
 */
export class Penala {
  private ctx: AudioContext | null = null
  private aliran: MediaStream | null = null
  private sumber: MediaStreamAudioSourceNode | null = null
  private analyser: AnalyserNode | null = null
  private data = new Float32Array(0)
  /**
   * Beberapa bacaan terakhir (Hz). Dipakai untuk **musyawarah**: kalau satu
   * bacaan melenceng jauh (oktaf salah) tapi yang lain sepakat, yang dipakai
   * suara terbanyak — bukan rata-rata, karena rata-rata antara 440 Hz dan
   * 220 Hz jatuh di 330 Hz (tidak ada nadanya).
   */
  private riwayat: number[] = []

  get aktif(): boolean {
    return this.aliran !== null
  }

  /** Buka mikrofon. Melempar Error yang perlu diterjemahkan ke pesan ramah. */
  async mulai(): Promise<void> {
    if (this.aliran) return
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Browser ini tidak mendukung pembacaan mikrofon. Coba Chrome atau Edge terbaru.')
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      // Semua pemrosesan dimatikan: kita butuh gelombang asli untuk menala.
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    })
    this.aliran = stream

    const Ctor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctor()
    this.ctx = ctx
    if (ctx.state === 'suspended') await ctx.resume().catch(() => undefined)

    const src = ctx.createMediaStreamSource(stream)
    const an = ctx.createAnalyser()
    // 2048 sampel ≈ 43 ms pada 48 kHz: cukup panjang untuk nada rendah (55 Hz),
    // cukup pendek agar jarum terasa cepat.
    an.fftSize = 2048
    an.smoothingTimeConstant = 0
    src.connect(an)
    this.sumber = src
    this.analyser = an
    this.data = new Float32Array(an.fftSize)
    this.riwayat = []
  }

  /** Lepas mikrofon & tutup AudioContext. Aman dipanggil berkali-kali. */
  berhenti() {
    this.aliran?.getTracks().forEach((t) => t.stop())
    this.aliran = null
    this.sumber?.disconnect()
    this.sumber = null
    this.analyser = null
    const ctx = this.ctx
    this.ctx = null
    this.riwayat = []
    if (ctx) ctx.close().catch(() => undefined)
  }

  /** Baca nada saat ini. `null` = hening atau sinyal belum cukup jelas. */
  baca(a4 = 440): HasilNada | null {
    const an = this.analyser
    if (!an) return null
    an.getFloatTimeDomainData(this.data)
    const hz = deteksiHz(this.data, this.ctx?.sampleRate ?? 48_000)
    if (!hz) {
      // Hening: kosongkan riwayat supaya jarum langsung kembali ke tengah.
      this.riwayat = []
      return null
    }

    this.riwayat.push(hz)
    if (this.riwayat.length > 6) this.riwayat.shift()

    // Kelompokkan bacaan menurut nada terdekatnya, lalu pakai kelompok
    // terbesar. Ini menahan bacaan sesat (oktaf salah) yang muncul sesekali.
    const kunci = this.riwayat.map((h) => Math.round(69 + 12 * Math.log2(h / a4)))
    const hitung = new Map<number, number>()
    for (const k of kunci) hitung.set(k, (hitung.get(k) ?? 0) + 1)
    const terakhir = kunci[kunci.length - 1]
    let pilih = terakhir
    let terbanyak = 0
    for (const [k, j] of hitung) {
      // Seri → menangkan bacaan yang paling baru.
      if (j > terbanyak || (j === terbanyak && k === terakhir)) {
        pilih = k
        terbanyak = j
      }
    }

    const sepakat = this.riwayat.filter((_, i) => kunci[i] === pilih)
    const rata = sepakat.reduce((a, b) => a + b, 0) / sepakat.length
    return hzKeNada(rata, a4)
  }
}

/* ------------------------------ Nada dengung -------------------------------- */

/**
 * #13c — Mode harmoni drone untuk latihan intonasi seksi tiup (*Brass Arc*)
 * maupun perkusi bernada (*Pit*).
 */
export type ModeHarmoniDengung = 'tunggal' | 'kuinta' | 'mayor' | 'minor' | 'oktaf'

/**
 * #13c — Temperamen interval harmoni:
 * - `'murni'` (*Just Intonation*): rasio utuh bebas layangan (3:2, 5:4, 6:5) untuk tiup/brass;
 * - `'setara'` (*12-TET*): tangga nada 12-semiton setara standar instrumen bilah pit/marimba.
 */
export type ModeTemperamenDengung = 'murni' | 'setara'

export interface KomponenHarmoniDengung {
  peran: string
  semiton: number
  rasio: number
  skala: number
  /** Selisih sen terhadap 12-TET (mis. terts besar murni = -14 sen, kuinta murni = +2 sen). */
  koreksiSen: number
}

export interface PanduanNadaAkor {
  peran: string
  tertulis: string
  konser: string
  koreksiSen: number
}

const DAFTAR_MODE_HARMONI: ModeHarmoniDengung[] = ['tunggal', 'kuinta', 'mayor', 'minor', 'oktaf']
const DAFTAR_MODE_TEMPERAMEN: ModeTemperamenDengung[] = ['murni', 'setara']

/** Susun daftar komponen rasio frekuensi dan koreksi sen untuk mode harmoni & temperamen drone. */
export function susunKomponenHarmoniDengung(
  harmoni: ModeHarmoniDengung,
  temperamen: ModeTemperamenDengung = 'murni',
): KomponenHarmoniDengung[] {
  const murni = temperamen === 'murni'
  switch (harmoni) {
    case 'tunggal':
      return [{ peran: 'Dasar', semiton: 0, rasio: 1, skala: 1, koreksiSen: 0 }]
    case 'oktaf':
      return [
        { peran: 'Dasar', semiton: 0, rasio: 1, skala: 0.9, koreksiSen: 0 },
        { peran: 'Oktaf', semiton: 12, rasio: 2, skala: 0.3, koreksiSen: 0 },
      ]
    case 'mayor':
      return [
        { peran: 'Dasar', semiton: 0, rasio: 1, skala: 0.85, koreksiSen: 0 },
        {
          peran: 'Terts',
          semiton: 4,
          rasio: murni ? 1.25 : Math.pow(2, 4 / 12),
          skala: 0.3,
          koreksiSen: murni ? -14 : 0,
        },
        {
          peran: 'Kuinta',
          semiton: 7,
          rasio: murni ? 1.5 : Math.pow(2, 7 / 12),
          skala: 0.34,
          koreksiSen: murni ? 2 : 0,
        },
      ]
    case 'minor':
      return [
        { peran: 'Dasar', semiton: 0, rasio: 1, skala: 0.85, koreksiSen: 0 },
        {
          peran: 'Terts',
          semiton: 3,
          rasio: murni ? 1.2 : Math.pow(2, 3 / 12),
          skala: 0.3,
          koreksiSen: murni ? 16 : 0,
        },
        {
          peran: 'Kuinta',
          semiton: 7,
          rasio: murni ? 1.5 : Math.pow(2, 7 / 12),
          skala: 0.34,
          koreksiSen: murni ? 2 : 0,
        },
      ]
    case 'kuinta':
    default:
      return [
        { peran: 'Dasar', semiton: 0, rasio: 1, skala: 1, koreksiSen: 0 },
        {
          peran: 'Kuinta',
          semiton: 7,
          rasio: murni ? 1.5 : Math.pow(2, 7 / 12),
          skala: 0.34,
          koreksiSen: murni ? 2 : 0,
        },
      ]
  }
}

/**
 * #13c — Panduan nama nada tertulis (sesuai transposisi instrumen) beserta target
 * koreksi sen untuk tiap komponen harmoni drone yang sedang dipilih.
 */
export function panduanAkorDengung(
  namaKonser: string,
  oktaf: number,
  geserTransposisi: number,
  harmoni: ModeHarmoniDengung,
  temperamen: ModeTemperamenDengung = 'murni',
): PanduanNadaAkor[] {
  const midiDasar = 12 * (oktaf + 1) + indeksNada(namaKonser)
  return susunKomponenHarmoniDengung(harmoni, temperamen).map((k) => ({
    peran: k.peran,
    konser: namaMidi(midiDasar + k.semiton).label,
    tertulis: namaMidi(midiDasar + k.semiton + geserTransposisi).label,
    koreksiSen: k.koreksiSen,
  }))
}

export interface OpsiDengung {
  /** frekuensi nada acuan (Hz) */
  hz: number
  /** bentuk gelombang */
  bentuk: OscillatorType
  /** volume 0–1 */
  volume: number
  /** tambahkan **nada kelima** di atasnya (kompatibilitas lama bila `harmoni` tidak diisi) */
  kelima: boolean
  /** #13c — mode harmoni lengkap (bila diisi, mengungguli `kelima`). */
  harmoni?: ModeHarmoniDengung
  /** #13c — temperamen murni (*Just*) vs 12-TET (*Equal*). */
  temperamen?: ModeTemperamenDengung
}

/**
 * Nada dengung (drone): nada panjang yang terus berbunyi untuk dijadikan acuan
 * tuning. Bisa ditambah kuinta, oktaf, atau akor mayor/minor murni (*Brass Arc*).
 */
export class Dengung {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private osilator: OscillatorNode[] = []
  private rasioAktif: number[] = []

  get aktif(): boolean {
    return this.osilator.length > 0
  }

  async mulai(o: OpsiDengung): Promise<void> {
    if (this.osilator.length) return
    const Ctor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctor()
    this.ctx = ctx
    if (ctx.state === 'suspended') await ctx.resume().catch(() => undefined)

    const master = ctx.createGain()
    master.gain.value = 0
    // Saringan rendah: merapikan bunyi sawtooth & triangle yang tajam.
    const saring = ctx.createBiquadFilter()
    saring.type = 'lowpass'
    saring.frequency.value = 4000
    master.connect(saring)
    saring.connect(ctx.destination)
    this.master = master

    const modeHarmoni: ModeHarmoniDengung = o.harmoni ?? (o.kelima ? 'kuinta' : 'tunggal')
    const komponen = susunKomponenHarmoniDengung(modeHarmoni, o.temperamen ?? 'murni')
    this.rasioAktif = komponen.map((k) => k.rasio)

    const sekarang = ctx.currentTime
    for (const k of komponen) {
      this.buat(ctx, master, o.hz * k.rasio, o.bentuk, k.skala)
    }

    // Naikkan volume perlahan (0,3 detik) supaya tidak ada "jedug" di awal.
    master.gain.setValueAtTime(0.0001, sekarang)
    master.gain.exponentialRampToValueAtTime(Math.max(0.0001, o.volume), sekarang + 0.3)
  }

  private buat(ctx: AudioContext, tujuan: AudioNode, hz: number, bentuk: OscillatorType, skala: number) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = bentuk
    osc.frequency.value = hz
    gain.gain.value = skala
    osc.connect(gain)
    gain.connect(tujuan)
    osc.start()
    this.osilator.push(osc)
  }

  /** Ubah volume saat dengung berbunyi (tanpa putus). */
  setVolume(v: number) {
    const ctx = this.ctx
    const master = this.master
    if (!ctx || !master) return
    master.gain.cancelScheduledValues(ctx.currentTime)
    master.gain.setTargetAtTime(Math.max(0.0001, Math.min(1, v)), ctx.currentTime, 0.05)
  }

  /** Geser frekuensi saat dengung berbunyi (tanpa putus). */
  setFrekuensi(hz: number) {
    const ctx = this.ctx
    if (!ctx) return
    this.osilator.forEach((osc, i) => {
      const rasio = this.rasioAktif[i] ?? (i === 0 ? 1 : 1.5)
      osc.frequency.setTargetAtTime(hz * rasio, ctx.currentTime, 0.03)
    })
  }

  /** Hentikan dengung (volume diturunkan perlahan supaya tidak "klik"). */
  berhenti() {
    const ctx = this.ctx
    const master = this.master
    const daftar = this.osilator
    this.ctx = null
    this.master = null
    this.osilator = []
    this.rasioAktif = []
    if (!ctx) return
    const sekarang = ctx.currentTime
    if (master) {
      master.gain.cancelScheduledValues(sekarang)
      master.gain.setTargetAtTime(0.0001, sekarang, 0.08)
    }
    window.setTimeout(() => {
      daftar.forEach((o) => {
        try {
          o.stop()
        } catch {
          /* sudah berhenti */
        }
      })
      ctx.close().catch(() => undefined)
    }, 400)
  }
}

/* ------------------------------ Setelan ------------------------------------ */

export interface SetelanPenala {
  /** acuan A4 (Hz) — band Eropa 442, kebanyakan 440 */
  a4: number
  /** nada dengung */
  nada: string
  oktaf: number
  bentuk: OscillatorType
  volume: number
  /** 1 = sertakan nada kelima (tetap dijaga selaras dengan `harmoni` untuk kompatibilitas) */
  kelima: number
  /** #13c — mode harmoni drone: tunggal, kuinta, mayor, minor, atau oktaf. */
  harmoni: ModeHarmoniDengung
  /** #13c — temperamen drone: 'murni' (Just Intonation) atau 'setara' (12-TET). */
  temperamen: ModeTemperamenDengung
  /**
   * J1 — id transposisi instrumen pemakai perangkat ini (lihat
   * `DAFTAR_TRANSPOSISI`). Disimpan per perangkat, bukan per tim: HP pemain
   * trumpet dan HP pemain mellophone memang harus berbeda.
   */
  transposisi: string
}

const KUNCI_SETELAN = 'drillkit.penala'

export const SETELAN_BAKU: SetelanPenala = {
  a4: 440,
  nada: 'A#',
  oktaf: 3,
  bentuk: 'triangle',
  volume: 0.35,
  kelima: 1,
  harmoni: 'kuinta',
  temperamen: 'murni',
  transposisi: 'c',
}

/** Baca setelan tersimpan; kalau gagal (mode penyamaran/penyimpanan penuh) pakai bawaan. */
export function bacaSetelan(): SetelanPenala {
  try {
    const mentah = localStorage.getItem(KUNCI_SETELAN)
    if (!mentah) return { ...SETELAN_BAKU }
    const d = JSON.parse(mentah) as Partial<SetelanPenala>
    const kelimaLama = d.kelima === undefined ? SETELAN_BAKU.kelima : d.kelima ? 1 : 0
    const harmoniSah =
      typeof d.harmoni === 'string' && DAFTAR_MODE_HARMONI.includes(d.harmoni as ModeHarmoniDengung)
        ? (d.harmoni as ModeHarmoniDengung)
        : kelimaLama
          ? 'kuinta'
          : 'tunggal'
    const temperamenSah =
      typeof d.temperamen === 'string' &&
      DAFTAR_MODE_TEMPERAMEN.includes(d.temperamen as ModeTemperamenDengung)
        ? (d.temperamen as ModeTemperamenDengung)
        : SETELAN_BAKU.temperamen
    return {
      a4: typeof d.a4 === 'number' ? d.a4 : SETELAN_BAKU.a4,
      nada: typeof d.nada === 'string' ? d.nada : SETELAN_BAKU.nada,
      oktaf: typeof d.oktaf === 'number' ? d.oktaf : SETELAN_BAKU.oktaf,
      bentuk: (d.bentuk ?? SETELAN_BAKU.bentuk) as OscillatorType,
      volume: typeof d.volume === 'number' ? d.volume : SETELAN_BAKU.volume,
      kelima: harmoniSah === 'tunggal' ? 0 : 1,
      harmoni: harmoniSah,
      temperamen: temperamenSah,
      // Setelan dari versi sebelum J1 tidak punya kolom ini → konser, persis
      // perilaku lama. Id yang tidak dikenal juga jatuh ke konser.
      transposisi: cariTransposisi(typeof d.transposisi === 'string' ? d.transposisi : undefined).id,
    }
  } catch {
    return { ...SETELAN_BAKU }
  }
}

export function simpanSetelan(s: SetelanPenala) {
  try {
    localStorage.setItem(KUNCI_SETELAN, JSON.stringify(s))
  } catch {
    /* abaikan — setelan tidak penting sampai aplikasi harus error */
  }
}

/** Terjemahkan error mikrofon menjadi pesan yang bisa dipahami pelatih. */
export function pesanMikrofon(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e)
  if (/NotAllowed|Permission denied|denied/i.test(m))
    return 'Izin mikrofon ditolak. Buka pengaturan situs di browser (ikon gembok di kiri alamat), lalu izinkan Mikrofon untuk halaman ini.'
  if (/NotFoundError|not found|no microphone/i.test(m))
    return 'Tidak ada mikrofon yang terdeteksi di perangkat ini. Coba colok headset, lalu tekan Dengarkan lagi.'
  if (/NotReadable|Could not start audio source/i.test(m))
    return 'Mikrofon sedang dipakai aplikasi lain. Tutup aplikasi itu (mis. Zoom/Meet), lalu coba lagi.'
  if (/insecure|NotSupported|getUserMedia is not/i.test(m))
    return 'Browser memblokir mikrofon di halaman ini. Buka berkas DrillKit.html di tab browser biasa — jangan dari dalam pratinjau.'
  return `Mikrofon tidak bisa dibuka: ${m}`
}
