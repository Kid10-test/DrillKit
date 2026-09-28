/**
 * E3 — Mesin metronom bersama (Web Audio API).
 *
 * Dipakai tiga tempat:
 * 1. **Halaman Musik** — metronom lanjutan: pola ritme & aksen per birama,
 *    poliritme, latih tempo, pilihan bunyi, dan getar.
 * 2. **Editor drill** (B5) — klik yang menyertai animasi perpindahan.
 * 3. **Presenter** (B5) — klik yang menyertai mode urutan latihan.
 *
 * Cara kerja (penting kalau mau mengubah sendiri):
 * - Klik **dijadwalkan ke depan** (`lookahead scheduler`): timer 25 ms hanya
 *   menanam jadwal bunyi di masa depan, sehingga ketukan tetap stabil walau
 *   JavaScript sedang sibuk merender formasi.
 * - Penjadwal berjalan **per birama**, bukan per ketukan. Satu birama punya
 *   ketukan & pembagian sendiri, jadi ritme bisa berbeda tiap birama.
 * - Tampilan (`onKetuk`) dikirim lewat **antrean waktu**: event ditanam bersama
 *   jadwal bunyi, lalu dikeluarkan saat waktunya tiba — jadi angka birama &
 *   sorotan sel di layar tepat bersamaan dengan bunyinya, bukan lebih awal.
 *
 * Semua bunyi dibuat sintetis (osilator), jadi tetap **offline & ringan** —
 * tidak ada berkas audio yang perlu diunduh.
 */

import type { BiramaPola, LatihTempo, PolaRitme, SuaraKlik, TingkatKlik } from '../db/types'
import type { HitungMundur, TandaBirama } from './birama'
import { rapikanNaik, tempoPutaran, terapkanLatihan, tujuanTercapai } from './tempoLatihan'
import type { NaikOtomatis, TempoLatihan } from './tempoLatihan'
import {
  bikinPolaDariBirama,
  biramaDefault,
  biramaPadaDetik,
  detikPerNot as hitungDetikPerNot,
  detikSampai,
  durasiBirama,
  normalisasiBirama,
  posisiHitungMundur,
  ucapHitungMundur,
} from './birama'

/** #6 — matikan bunyi yang belum (atau baru saja) berbunyi, tanpa sisa letupan. */
function hentikanSegera(osc: OscillatorNode | OscillatorNode[], ...lain: AudioNode[]): () => void {
  return () => {
    for (const o of Array.isArray(osc) ? osc : [osc]) {
      try {
        o.stop()
      } catch {
        /* sudah berhenti */
      }
      o.disconnect()
    }
    for (const n of lain) n.disconnect()
  }
}

export type { SuaraKlik }

/**
 * #6 — Jam lagu: rekaman sebagai **patokan waktu**.
 *
 * Mengapa ini ada: mesin metronom menjadwalkan klik di jam `AudioContext`,
 * sedangkan rekaman berbunyi di jam elemen `<audio>`. Dua jam itu tidak
 * berjalan sama cepat — diukur di kotak pasir ini: 0,25 ms per sekon
 * (±15 ms per menit) — dan titik mulainya juga berbeda, karena rekaman baru
 * berbunyi sesudah berkasnya dibaca, digeser ke titik mulai, lalu di-`play()`.
 * Selisih titik mulai itu tidak kecil dan tidak tetap: 40 ms di mesin cepat,
 * **157 ms** saat utas utama diperlambat 8× — dan di HP yang sibuk bisa lebih.
 *
 * Dulu klik berjalan sendiri tanpa memperhatikan kapan rekaman benar-benar
 * mulai, jadi tiap ketukan meleset dari lagunya. Sekarang, kalau ada jam lagu,
 * mesin **menunggu rekaman berbunyi** dan menempatkan tiap klik pada posisi
 * rekaman yang seharusnya — bukan pada hitungan sendiri.
 */
export interface JamLagu {
  /** Posisi lagu sekarang, detik (0 = birama 1 ketuk 1). */
  posisi: () => number
  /** Laju nyata pemutaran rekaman (1 = tempo asli). */
  laju: () => number
  /** Rekaman benar-benar sedang berbunyi. */
  jalan: () => boolean
}

/**
 * Satu segmen tempo map: mulai birama ke-`measure`, temponya `bpm`.
 *
 * M1 — `birama` opsional: kalau diisi, segmen ini **mengganti tanda birama**
 * mulai birama tersebut (jadi lagu bisa 4/4 → 7/8 → 4/4). Kalau kosong,
 * segmen mewarisi tanda birama lagu.
 */
export interface SegmenTempo {
  measure: number
  bpm: number
  birama?: TandaBirama
  /**
   * N6 — 1 = menuju segmen berikutnya berangsur (accelerando / ritardando
   * di antara dua segmen yang sudah diketik). Lihat penjelasan lengkapnya
   * pada `TempoSegment.berangsur` di db/types.ts.
   */
  berangsur?: 0 | 1
}

/**
 * N6 — tempo menurut tempo map pada birama absolut ke-`ke` (1-based).
 *
 * Tanpa tanda berangsur, ini fungsi tangga seperti sediakala: tempo
 * berubah MENDADAK pada birama pertama segmen.
 *
 * Dengan tanda berangsur, tempo MELUNCUR linier dari segmen ini ke
 * segmen berikutnya. Contoh yang diminta pelatih:
 *
 *   segmen bar 88 = 172, berangsur
 *   segmen bar 91 = 140
 *
 *   bar 88 → 172      (titik awal, belum bergerak)
 *   bar 89 → 161,3
 *   bar 90 → 150,7
 *   bar 91 → 140      (tiba di segmen berikutnya)
 *
 * Sengaja dipisah menjadi fungsi murni supaya perilaku ini bisa diuji
 * tanpa peramban dan tanpa AudioContext — persis seperti `tempoLatih`.
 */
/**
 * N6 — tempo yang BERLAKU pada birama ke-`ke`: tempo dasar, lalu tempo
 * map (tangga maupun luncuran per segmen), lalu luncuran menyeluruh.
 *
 * Sengaja dipisah menjadi fungsi murni supaya **aturan prioritasnya bisa
 * diuji**. Tanpa fungsi ini, satu-satunya cara membuktikan bahwa luncuran
 * per segmen menang atas luncuran menyeluruh adalah menjalankan peramban
 * dengan AudioContext sungguhan dan mendengarkannya.
 */
export function tempoBerlaku(
  opsi: {
    dasar: number
    segmen?: SegmenTempo[]
    pakaiTempoMap?: boolean
    latih?: LatihTempo | null
    /**
     * #4 — tempo latihan (persen / geser BPM). Diterapkan **paling akhir**,
     * sesudah tempo map, luncuran berangsur, dan latih tempo lama.
     */
    latihan?: TempoLatihan | null
  },
  ke: number,
): number {
  const segmen = opsi.segmen ?? []
  const pakai = (opsi.pakaiTempoMap ?? false) && segmen.length > 0
  const bpm = pakai ? tempoPeta(segmen, ke, opsi.dasar) : opsi.dasar
  // Yang lebih khusus menang; lihat penjelasan `adaBerangsur`.
  const berlaku = pakai && adaBerangsur(segmen) ? bpm : tempoLatih(bpm, opsi.latih ?? null, ke)
  return terapkanLatihan(berlaku, opsi.latihan ?? null)
}

/**
 * N6 — apakah tempo map ini punya luncuran per segmen.
 *
 * Dipakai untuk menentukan **prioritas**. Ada tiga cara mengubah tempo di
 * aplikasi ini, dan tanpa aturan yang tegas dua di antaranya bisa menyala
 * bersamaan — hasilnya luncuran per segmen yang diatur hati-hati
 * (172 → 161,3 → 150,7 → 140) rata menjadi satu angka (180), **tanpa
 * peringatan apa pun**. Itu kegagalan yang tampak berhasil: lagunya
 * berbunyi, hanya saja temponya bukan yang diatur.
 *
 * Aturannya: **yang lebih khusus menang.** Luncuran per segmen lebih
 * khusus daripada luncuran menyeluruh, jadi kalau ada yang per segmen,
 * yang menyeluruh dikesampingkan — dan antarmukanya mengatakannya.
 */
export function adaBerangsur(segmen: SegmenTempo[]): boolean {
  return segmen.some((s) => s.berangsur === 1)
}

/** Salinan segmen yang sudah urut berdasarkan birama mulainya. */
function urutSegmen(segmen: SegmenTempo[]): SegmenTempo[] {
  return [...segmen].sort((a, b) => a.measure - b.measure)
}

/** Index segmen terakhir yang sudah mulai pada birama ke-`ke`. `-1` = belum ada. */
function cariIndex(segmen: SegmenTempo[], ke: number): number {
  const s = urutSegmen(segmen)
  let index = -1
  for (let i = 0; i < s.length; i += 1) if (s[i].measure <= ke) index = i
  return index
}

/**
 * N7 — jendela luncuran yang sedang berlaku pada birama ke-`ke`, atau
 * `null` kalau birama itu **tidak sedang** meluncur.
 *
 * Kenapa perlu: panel lagu harus bisa berkata "172 → 161,3 (berangsur ke
 * bar 91)" tanpa menghitung ulang interpolasinya sendiri. Kalau panel
 * menghitung sendiri, cepat atau lambat ia akan berbeda dari yang
 * berbunyi — dan perbedaan itu tidak akan kelihatan di layar, hanya di
 * telinga. Satu fungsi, dua pemakai, tidak bisa menyimpang.
 *
 * `posisi` selalu di antara 0 dan 1 secara **eksklusif**: di ujung-ujungnya
 * tempo sudah sama dengan titik awal atau titik akhir, jadi tidak ada
 * yang perlu diluncurkan.
 */
export function luncuranPada(
  segmen: SegmenTempo[],
  ke: number,
): { dari: number; ke: number; posisi: number; dariBar: number; keBar: number } | null {
  if (!segmen.length) return null
  const s = urutSegmen(segmen)
  const index = cariIndex(s, ke)
  if (index < 0) return null

  const sekarang = s[index]
  const berikut = s[index + 1]
  if (!sekarang.berangsur || !berikut) return null

  const rentang = berikut.measure - sekarang.measure
  // Tanpa jarak tidak ada yang bisa diluncurkan — jangan membagi nol.
  if (rentang <= 0) return null
  const posisi = (ke - sekarang.measure) / rentang
  if (posisi <= 0 || posisi >= 1) return null
  return {
    dari: sekarang.bpm,
    ke: berikut.bpm,
    posisi,
    dariBar: sekarang.measure,
    keBar: berikut.measure,
  }
}

/** N10 — satu luncuran yang didefinisikan tempo map: dari bar A ke bar B. */
export interface LuncuranLagu {
  dariBar: number
  keBar: number
  dari: number
  ke: number
}

/**
 * N10 — semua luncuran yang didefinisikan tempo map, sudah urut.
 *
 * Sekadar `adaBerangsur` hanya menjawab "apakah ada". Untuk memberitahu
 * pemakai **apa** yang akan terjadi sebelum ia memutar lagunya, perlu
 * titik awal, titik akhir, dan kedua temponya.
 */
export function daftarLuncuran(segmen: SegmenTempo[]): LuncuranLagu[] {
  const s = urutSegmen(segmen)
  const out: LuncuranLagu[] = []
  for (let i = 0; i < s.length - 1; i += 1) {
    if (s[i].berangsur !== 1) continue
    // Segmen berikutnya harus benar-benar di depan — tanpa jarak tidak
    // ada yang bisa diluncurkan (seperti penjagaan di `luncuranPada`).
    if (s[i + 1].measure - s[i].measure <= 0) continue
    out.push({
      dariBar: s[i].measure,
      keBar: s[i + 1].measure,
      dari: s[i].bpm,
      ke: s[i + 1].bpm,
    })
  }
  return out
}

/**
 * N10 — ringkasan singkat luncuran sebuah lagu, untuk lencana di daftar
 * lagu. `null` kalau lagunya tidak punya luncuran.
 */
export function ringkasLuncuran(segmen: SegmenTempo[]): string | null {
  const daftar = daftarLuncuran(segmen)
  if (daftar.length === 0) return null
  if (daftar.length === 1) {
    const g = daftar[0]
    return `luncur ${Math.round(g.dari)} → ${Math.round(g.ke)}`
  }
  return `${daftar.length} luncuran`
}

/** N10 — penjelasan luncuran sebuah lagu, untuk keterangan saat disentuh. */
export function jejakLuncuran(segmen: SegmenTempo[]): string | null {
  const daftar = daftarLuncuran(segmen)
  if (daftar.length === 0) return null
  return daftar
    .map((g) => `Bar ${g.dariBar}: ${Math.round(g.dari)} → bar ${g.keBar}: ${Math.round(g.ke)} BPM`)
    .join(' · ')
}

export function tempoPeta(segmen: SegmenTempo[], ke: number, dasar: number): number {
  if (!segmen.length) return dasar
  const s = urutSegmen(segmen)
  const index = cariIndex(s, ke)
  if (index < 0) return dasar

  const luncur = luncuranPada(segmen, ke)
  if (luncur) return luncur.dari + (luncur.ke - luncur.dari) * luncur.posisi
  return s[index].bpm
}

/** Informasi yang dikirim ke tampilan setiap kali sebuah ketukan berbunyi. */
export interface InfoKetuk {
  /** index birama di dalam pola (0-based) */
  bar: number
  /** index ketukan di dalam birama (0-based) */
  beat: number
  /** index pembagian di dalam ketukan (0-based) */
  sub: number
  /** tingkat kotak: 0 diam, 1 biasa, 2 aksen */
  sel: number
  /** nomor birama absolut, dihitung sejak tombol Mulai ditekan (1-based) */
  birama: number
  /** tempo yang dipakai birama ini (sudah termasuk latih tempo) */
  bpm: number
  /** 1 = pola utama, 2 = suara kedua (poliritme) */
  suara: 1 | 2
  /** M1 — 'hitung' = hitung mundur sebelum lagu mulai; 'main' = lagu (bawaan). */
  tahap?: 'hitung' | 'main'
  /** M1 — teks yang diucapkan, hanya diisi kalau hitung mundur memakai suara manusia. */
  ucap?: string
}

export interface OpsiMetronom {
  /** tempo dasar (BPM) */
  bpm: number
  /** ketukan per birama — dipakai kalau tidak ada pola */
  beats: number
  /** pembagian per ketukan — dipakai kalau tidak ada pola */
  subdiv: number
  /** pola ritme per birama + poliritme; null = detak rata */
  pola?: PolaRitme | null
  /** jenis bunyi */
  suara?: SuaraKlik
  /** volume 0–1 */
  volume?: number
  /** getar tiap ketukan (HP) */
  getar?: boolean
  /** latih tempo: naik/turun bertahap */
  latih?: LatihTempo | null
  /** tempo map lagu */
  segmen?: SegmenTempo[]
  /** ikuti tempo map (kalau ada segmennya) */
  pakaiTempoMap?: boolean
  /** dipanggil setiap ketukan berbunyi — untuk menyorot tampilan */
  onKetuk?: (i: InfoKetuk) => void
  /**
   * M1 — tanda birama yang sedang dipakai. Kalau diisi, lama satu ketukan
   * dihitung dari **acuan tempo** yang dipilih (bisa seperempat, seperdelapan,
   * seperempat bertitik, …). Kalau kosong, perilakunya persis seperti dulu
   * (1 ketuk = 60/BPM) — presenter & editor drill tidak berubah.
   */
  birama?: TandaBirama
  /** M1 — mulai dari birama absolut ke-berapa (1-based). Bawaan 1. */
  mulaiDari?: number
  /** M1 — hitung mundur sebelum lagu mulai. */
  hitungMundur?: HitungMundur | null
  /**
   * M5 — birama terakhir lagu (1-based, inklusif). Kosong/0 = lagu tanpa
   * akhir, persis perilaku lama.
   */
  biramaAkhir?: number
  /** M5 — ulang dari birama awal begitu lagu habis. Bawaan = berhenti. */
  ulang?: boolean
  /** M5 — dipanggil sekali saat lagu benar-benar habis (bunyi terakhir sudah lewat). */
  onSelesai?: () => void
  /**
   * M2 — ulang satu bagian saja: rentang birama inklusif `dari`–`sampai`.
   * Kosong atau tidak sah = tidak ada pengulangan bagian.
   */
  ulangBagian?: { dari: number; sampai: number } | null
  /** #4 — tempo latihan, diterapkan paling akhir (termasuk hitung mundur). */
  latihan?: TempoLatihan | null
  /**
   * #4 — naik otomatis tiap putaran ulang bagian. Hanya berlaku kalau
   * `ulangBagian` sah. Selama menyala, ia yang menentukan tempo latihan.
   */
  naikOtomatis?: NaikOtomatis | null
  /** #4 — dipanggil tiap kali putaran ulang bagian dimulai (termasuk putaran 1). */
  onPutaran?: (i: { putaran: number; tempo: TempoLatihan; tujuan: boolean }) => void
  /**
   * #6 — kalau diisi, klik mengikuti jam rekaman: ia baru mulai berbunyi
   * setelah rekamannya benar-benar berjalan, dan tiap ketukan ditempatkan
   * menurut posisi rekaman — bukan menurut hitungan mesin sendiri.
   *
   * Diisi hanya oleh pemanggil yang benar-benar memutar rekaman. Tanpa jam
   * ini, perilakunya persis seperti sediakala (metronom mandiri).
   */
  jam?: JamLagu | null
}

/** M1 — hitung mundur dianggap hidup kalau dinyalakan dan ulangannya masuk akal. */
function ctxHitungValid(h: HitungMundur): boolean {
  return h.on && Number.isFinite(h.ulang) && h.ulang >= 1
}

/** Batas aman tempo agar tidak ada durasi nol atau negatif. */
const MIN_BPM = 20
const MAX_BPM = 400

/**
 * N7 — jepit tempo ke rentang yang benar-benar bisa dimainkan mesinnya.
 *
 * Sengaja diekspor supaya **tampilan memakai penjepit yang sama dengan
 * mesin**. Sebelumnya mesin menjepit diam-diam sedangkan panel menampilkan
 * angka mentahnya — jadi pada tempo ekstrem panel bisa menampilkan angka
 * yang tidak pernah berbunyi.
 */
export function jepitTempo(bpm: number): number {
  if (!Number.isFinite(bpm)) return MIN_BPM
  return Math.min(MAX_BPM, Math.max(MIN_BPM, bpm))
}

/** Berapa detik ke depan jadwal ditanam (lookahead). */
const LIHAT_KE_DEPAN = 0.18

/**
 * #6 — cadangan jadwal saat klik mengikuti jam rekaman.
 *
 * Lebih panjang daripada jalur mandiri dengan sengaja: pada jalur jam,
 * menanam lebih awal tidak berisiko (acuannya posisi rekaman, bukan hitungan
 * sendiri), sedangkan menanam terlambat berarti ketukan hilang. Utas utama
 * yang sibuk — HP yang sekaligus menggambar formasi — bisa tertahan lebih
 * dari 180 ms, dan itulah yang dulu terdengar sebagai klik yang melambat.
 */
const LIHAT_KE_JAM = 0.45

/**
 * #6 — berapa lama menunggu rekaman benar-benar berbunyi sebelum menyerah.
 *
 * Rekaman besar di HP bisa perlu waktu; tetapi menunggu tanpa batas berarti
 * metronom yang diam tanpa penjelasan ketika berkasnya gagal dimuat.
 */
const JAM_TUNGGU = 2.5

function bikinBiramaKosong(beats: number, subdiv: number): TingkatKlik[] {
  return new Array(Math.max(1, beats * subdiv)).fill(0 as TingkatKlik)
}

/** Pola bawaan: aksen di ketukan 1, ketuk biasa di ketukan lainnya. */
export function polaBaku(beats: number, subdiv: number): BiramaPola {
  const cells = bikinBiramaKosong(beats, subdiv)
  for (let b = 0; b < beats; b++) cells[b * subdiv] = b === 0 ? 2 : 1
  return { id: `b_${Math.random().toString(36).slice(2, 8)}`, beats, subdiv, cells }
}

/** Susun ulang panjang `cells` kalau ketukan/pembagian birama diubah. */
export function rapikanBirama(bar: BiramaPola): BiramaPola {
  const panjang = Math.max(1, bar.beats * bar.subdiv)
  const cells = [...bar.cells]
  while (cells.length < panjang) cells.push(0)
  return { ...bar, cells: cells.slice(0, panjang) }
}

/** Putar tingkat kotak: diam → biasa → aksen → diam. */
export function putarSel(nilai: number): 0 | 1 | 2 {
  return ((nilai + 1) % 3) as 0 | 1 | 2
}

/**
 * N5 — tempo setelah perubahan bertahap (accelerando / ritardando).
 *
 * Sengaja dipisah menjadi fungsi murni, tidak lagi bersarang di dalam
 * kelas `Metronom`: sebelumnya satu-satunya cara membuktikan tempo
 * benar-benar naik adalah menjalankan peramban dengan AudioContext
 * sungguhan. Dengan begini hitungannya bisa diuji langsung.
 *
 * Perilaku: tiap `tiap` birama, tempo bergeser sebesar `langkah` BPM,
 * lalu DIJEPIT di antara `dari` dan `ke` — sehingga ia berhenti di
 * tujuan, bukan terus melampauinya tanpa akhir.
 */
export function tempoLatih(bpm: number, l: LatihTempo | null, ke: number): number {
  if (!l || !l.on) return bpm
  const siklus = Math.floor((ke - 1) / Math.max(1, l.tiap))
  const target = l.langkah === 0 ? bpm : bpm + siklus * l.langkah
  return l.langkah > 0
    ? Math.min(target, Math.max(l.ke, l.dari))
    : Math.max(target, Math.min(l.ke, l.dari))
}

export class Metronom {
  private ctx: AudioContext | null = null
  private timer: number | null = null
  private waktuBirama = 0
  private pos = 0
  private bars: BiramaPola[] = []
  private poly: PolaRitme['poly'] = null
  private segmen: SegmenTempo[] = []
  private pakaiTempoMap = false
  private bpmDasar = 120
  private latih: LatihTempo | null = null
  private suara: SuaraKlik = 'klik'
  private volume = 0.8
  private getar = false
  private onKetuk: (i: InfoKetuk) => void = () => {}
  private antrean: { waktu: number; info: InfoKetuk }[] = []
  /** #6 — bunyi yang sudah ditanam tetapi belum terdengar; bisa dibatalkan. */
  private terjadwal: { waktu: number; batalkan: () => void }[] = []
  private birama: TandaBirama | null = null
  private suaraHitung: SuaraKlik = 'bel'
  /** M1 — true kalau `opsi.pola` berisi pola buatan pemakai (bukan turunan meter). */
  private polaKustom = false
  /** M1 — ketukan & pembagian bawaan, dipakai kalau tidak ada meter sama sekali. */
  private beatsDasar = 4
  private subdivDasar = 1
  /** M1 — cache birama turunan meter, supaya tidak dibuat ulang tiap birama. */
  private cacheBar: { kunci: string; bar: BiramaPola } | null = null
  /** M5 — birama terakhir lagu (0 = tanpa akhir, perilaku lama). */
  private biramaAkhir = 0
  /** M5 — ulang dari `awal` begitu lagu habis. */
  private ulang = false
  /** M5 — birama tempat pemutaran dimulai, dipakai sebagai tujuan ulang. */
  private awal = 1
  /** M2 — birama awal rentang ulang (0 = tidak ada pengulangan bagian). */
  private ulangDari = 0
  /** M2 — birama akhir rentang ulang; lewat dari sini langsung kembali ke `ulangDari`. */
  private ulangSampai = 0
  /** M5 — sudah mencapai akhir lagu: tidak ada birama baru dijadwalkan lagi. */
  private selesai = false
  private onSelesai: (() => void) | null = null
  /** #4 — tempo latihan yang sedang dipakai. */
  private latihan: TempoLatihan | null = null
  private naik: NaikOtomatis | null = null
  private putaran = 1
  private onPutaran: OpsiMetronom['onPutaran'] | null = null
  /**
   * #6 — jam lagu (rekaman) yang menjadi patokan waktu, kalau ada.
   * Selama jam ini terpasang, mesin tidak memakai hitungan waktunya sendiri.
   */
  private jam: JamLagu | null = null
  /** #6 — batas tunggu rekaman berbunyi sebelum kembali ke metronom mandiri. */
  private jamBatas = 0
  /**
   * #6 — posisi lagu (detik, skala asli) di awal birama berikutnya yang akan
   * dijadwalkan. Ini pengganti `waktuBirama` pada jalur jam: yang dihitung
   * adalah *musiknya*, bukan jam dinding — jam dindingnya ikut rekaman.
   */
  private detikLagu = 0

  get jalan() {
    return this.timer !== null
  }

  /*
   * Dulu ada `get tempo()` yang mengembalikan `hitungBpm(1)` — tempo pada
   * BIRAMA PERTAMA. N9: ia dihapus, bukan diperbaiki.
   *
   * Alasannya bukan karena tidak terpakai (memang tidak ada pemanggilnya),
   * melainkan karena ia mengajarkan hal yang keliru: bahwa sebuah lagu
   * punya SATU tempo yang bisa ditanyakan kapan saja. Sejak ada luncuran
   * per segmen itu tidak benar lagi — pertanyaannya harus menyebut
   * biramanya. Menyimpannya hanya menunggu seseorang memakainya untuk
   * menampilkan angka yang diam sementara lagunya bergerak, persis cacat
   * panel yang diperbaiki pada N7. Yang benar: `tempoBerlaku(opsi, birama)`.
   */

  mulai(opsi: OpsiMetronom) {
    this.berhenti()
    this.bpmDasar = this.batasi(opsi.bpm)
    this.suara = opsi.suara ?? 'klik'
    this.volume = Math.min(1, Math.max(0, opsi.volume ?? 0.8))
    this.getar = opsi.getar ?? false
    this.latih = opsi.latih && opsi.latih.on ? opsi.latih : null
    this.segmen = [...(opsi.segmen ?? [])].sort((a, b) => a.measure - b.measure)
    this.pakaiTempoMap = (opsi.pakaiTempoMap ?? false) && this.segmen.length > 0
    this.onKetuk = opsi.onKetuk ?? (() => {})
    // #6 — jam lagu (rekaman). Dijepit: tanpa tanda birama, batas birama
    // tidak bisa dihitung, jadi jalur jam dimatikan dan perilakunya kembali
    // seperti metronom mandiri.
    this.jam = opsi.jam && opsi.birama ? opsi.jam : null

    this.beatsDasar = Math.max(1, Math.min(12, opsi.beats))
    this.subdivDasar = Math.max(1, Math.min(4, opsi.subdiv))
    this.cacheBar = null

    const pola = opsi.pola
    if (pola && pola.bars.length > 0) {
      // Pola buatan pemakai menang: ritmenya ditentukan sendiri, bukan meter.
      this.bars = pola.bars.map(rapikanBirama)
      this.poly = pola.poly
      this.polaKustom = true
    } else {
      // Tanpa pola kustom, birama dibuat dari meter yang berlaku — bisa
      // berubah tiap segmen tempo (lihat `barUntuk`).
      this.bars = []
      this.poly = null
      this.polaKustom = false
    }

    // M1 — tanda birama & mulai dari birama tertentu.
    this.birama = opsi.birama ? normalisasiBirama(opsi.birama) : null
    const mulaiDari = Math.max(1, Math.floor(opsi.mulaiDari ?? 1))
    this.pos = mulaiDari - 1

    // M5 — panjang lagu & ulang.
    this.awal = mulaiDari
    const akhir = Math.floor(opsi.biramaAkhir ?? 0)
    this.biramaAkhir = Number.isFinite(akhir) && akhir >= 1 ? akhir : 0
    this.ulang = (opsi.ulang ?? false) && this.biramaAkhir > 0

    // M2 — ulang bagian. Pengaman: rentang yang terbalik atau kosong
    // dimatikan. Tanpa pengaman ini penjadwal berputar di tempat tanpa
    // henti, karena `pos` akan terus dikembalikan ke birama yang sudah lewat
    // batas. `ulangDari` juga tidak boleh lebih besar dari `ulangSampai`.
    const ub = opsi.ulangBagian
    const d = Math.floor(ub?.dari ?? 0)
    const sp = Math.floor(ub?.sampai ?? 0)
    const rentangSah =
      !!ub && Number.isFinite(d) && Number.isFinite(sp) && d >= 1 && sp >= d && d <= sp
    this.ulangDari = rentangSah ? d : 0
    this.ulangSampai = rentangSah ? sp : 0
    this.selesai = false
    this.onSelesai = opsi.onSelesai ?? null
    // #4 — tempo latihan & naik otomatis.
    this.latihan = opsi.latihan ?? null
    this.onPutaran = opsi.onPutaran ?? null
    this.naik = opsi.naikOtomatis && opsi.naikOtomatis.on && rentangSah ? rapikanNaik(opsi.naikOtomatis) : null
    this.putaran = 1
    if (this.naik) {
      this.latihan = tempoPutaran(this.naik, 1)
      this.onPutaran?.({ putaran: 1, tempo: this.latihan, tujuan: tujuanTercapai(this.naik, 1) })
    }
    // Mulai dari birama yang sudah lewat akhir lagu = tidak ada yang diputar.
    if (this.biramaAkhir > 0 && mulaiDari > this.biramaAkhir) this.selesai = true

    // #6 — titik mulai jalur jam: detik lagu di awal birama pertama yang
    // dimainkan. Rekaman sudah digeser ke titik yang sama oleh pemanggil.
    this.detikLagu = this.detikPadaBirama(mulaiDari)

    const Ctor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    this.ctx = new Ctor()

    let waktu = this.ctx.currentTime + 0.08
    const h = opsi.hitungMundur
    /*
     * #6 — hitung mundur dimatikan saat rekaman menjadi patokan waktu.
     * Kalau tidak, klik menghitung mundur N ketukan sementara lagunya sudah
     * berjalan dari birama 1: yang terdengar adalah klik yang tertinggal satu
     * hitung mundur penuh, dan penomoran biramanya meleset.
     */
    if (h && h.on && ctxHitungValid(h) && this.birama && !this.jam) {
      this.suaraHitung = h.suara === 'suara' ? 'bel' : h.suara
      waktu = this.jadwalkanHitungMundur(h, waktu, mulaiDari)
    }
    this.waktuBirama = waktu
    this.jamBatas = this.ctx.currentTime + JAM_TUNGGU
    this.timer = window.setInterval(() => this.jadwalkan(), 25)
  }

  berhenti() {
    if (this.timer !== null) window.clearInterval(this.timer)
    this.timer = null
    this.terjadwal = []
    this.antrean = []
    // M5 — jangan panggil `onSelesai` saat pemakai berhenti sendiri.
    this.selesai = false
    this.onSelesai = null
    this.ulangDari = 0
    this.ulangSampai = 0
    this.naik = null
    this.onPutaran = null
    const ctx = this.ctx
    this.ctx = null
    if (ctx) ctx.close().catch(() => undefined)
  }

  /**
   * #4 — ganti tempo latihan tanpa menghentikan metronom. Berlaku mulai
   * birama berikutnya yang dijadwalkan. Diabaikan selama naik otomatis
   * menyala (naik otomatis yang memegang tempo).
   */
  setLatihan(t: TempoLatihan | null) {
    if (this.naik) return
    this.latihan = t
  }

  /** Ubah volume tanpa menghentikan metronom. */
  setVolume(v: number) {
    this.volume = Math.min(1, Math.max(0, v))
  }

  /* ------------------------------ Penjadwalan ------------------------------ */

  private batasi(bpm: number) {
    // N7 — jepitTempo diekspor supaya tampilan memakai aturan yang sama.
    return jepitTempo(bpm)
  }

  /**
   * #6 — tempo ASLI birama ke-`ke`: tempo map, luncuran, dan latih tempo lama
   * ikut, tetapi **tempo latihan tidak**.
   *
   * Ini yang menentukan posisi di sepanjang rekaman. Rekaman adalah partitur:
   * ketukan ke-100 selalu ada di detik yang sama, berapa pun lambatnya ia
   * diputar. Tempo latihan diwujudkan oleh `playbackRate` dan oleh laju jam —
   * bukan oleh hitungan detik lagunya. Kalau tempo latihan ikut dihitung di
   * sini, posisi klik dan posisi rekaman dihitung dua kali dari dua arah yang
   * berbeda, dan keduanya berpisah lagi.
   */
  private hitungBpmAsli(ke: number): number {
    return this.batasi(
      tempoBerlaku(
        { dasar: this.bpmDasar, segmen: this.segmen, pakaiTempoMap: this.pakaiTempoMap, latih: this.latih },
        ke,
      ),
    )
  }

  /** #6 — tanda birama warisan, untuk menghitung detik lagu. */
  private meterWarisan(): TandaBirama {
    return this.birama ?? biramaDefault()
  }

  /** #6 — tempo asli sebagai fungsi, untuk `detikSampai`/`biramaPadaDetik`. */
  private tempoAsliUntuk = (b: number): number => this.hitungBpmAsli(b)

  /** #6 — detik lagu di awal birama ke-`b` (birama 1 = 0 detik). */
  private detikPadaBirama(b: number): number {
    return detikSampai(this.segmen, b, this.meterWarisan(), this.bpmDasar, this.tempoAsliUntuk)
  }

  /** #6 — lama birama ke-`ke` dalam detik lagu (skala asli). */
  private durasiLaguBirama(ke: number): number {
    // Tanpa tanda birama, batas birama tidak terdefinisi — jalur jam memang
    // dimatikan di `mulai` untuk keadaan itu; ini pengaman terakhir.
    return durasiBirama(this.meterUntuk(ke) ?? this.meterWarisan(), this.hitungBpmAsli(ke))
  }

  /**
   * #6 — tarik jalan-biarawal ke posisi rekaman yang sebenarnya.
   *
   * Dijalankan tiap tick dan memang murah: selama posisi rekaman masih di
   * dalam birama yang sedang berjalan, tidak ada yang dikerjakan. Yang
   * ditangani hanya lompatan — pengguna menggeser garis waktu, satu bagian
   * diulang, atau tab tidak aktif sekian lama sehingga mesin tertinggal jauh.
   * Tanpa ini, klik akan mencoba "mengejar" dengan membunyikan ketukan yang
   * sudah lewat, satu per satu.
   */
  private selaraskanKeJam() {
    const jam = this.jam
    if (!jam) return
    const pos = jam.posisi()
    const laju = Math.max(0.1, jam.laju())
    /*
     * Jalan-biarawal selalu sedikit di depan rekaman: birama berikutnya memang
     * ditanam begitu mulainya masuk jendela lihat-ke-depan. Karena itu
     * "posisi ada di dalam birama yang belum dijadwalkan" itu NORMAL.
     *
     * Yang perlu disusulkan hanya dua hal:
     *  - rekaman menyalip jadwal (posisi sudah melewati birama yang belum
     *    dijadwalkan) — mis. lagu digeser maju; dan
     *  - rekaman tertinggal jauh di belakang jadwal — mis. bagian diulang.
     * Satu versi pertama fungsi ini menuntut posisi ada di dalam birama yang
     * akan dijadwalkan; akibatnya jalan-biarawal ditarik mundur TIAP tick dan
     * birama pertama dijadwalkan ulang tanpa henti (2.621 klik dalam 26 detik
     * alih-alih 88).
     */
    const lalu = this.durasiLaguBirama(Math.max(1, this.pos))
    const menyalip = pos >= this.detikLagu
    const tertinggal = pos < this.detikLagu - lalu - laju * LIHAT_KE_JAM - 0.25
    if (!menyalip && !tertinggal) return

    // Klik yang terlanjur ditanam untuk posisi lama dibuang: rekamannya sudah
    // pindah, jadi ketukan itu tidak cocok lagi dengan apa pun.
    for (const t of this.terjadwal) t.batalkan()
    this.terjadwal = []
    this.antrean = []

    const b = biramaPadaDetik(this.segmen, pos, this.meterWarisan(), this.bpmDasar, this.tempoAsliUntuk)
    this.pos = b.birama - 1
    this.detikLagu = this.detikPadaBirama(b.birama)
    /*
     * Birama yang sedang berjalan bisa saja sudah dimulai sebelum detik ini
     * (klik di tengah birama) — ketukan yang sudah lewat tidak dibunyikan,
     * dan itu memang yang diinginkan: lebih baik masuk di ketukan berikutnya
     * daripada berbunyi di tempat yang salah.
     */
    this.waktuBirama = this.ctx ? this.ctx.currentTime + (this.detikLagu - pos) / laju : this.waktuBirama
  }


  /** Tempo untuk birama absolut ke-`ke` (1-based): tempo dasar + tempo map + latih tempo. */
  private hitungBpm(ke: number): number {
    // N6 — tempoBerlaku menangani urutan & prioritasnya; batasi() menjepit
    // hasilnya ke rentang yang masih bisa dipakai mesinnya.
    return this.batasi(
      tempoBerlaku(
        {
          dasar: this.bpmDasar,
          segmen: this.segmen,
          pakaiTempoMap: this.pakaiTempoMap,
          latih: this.latih,
          latihan: this.latihan,
        },
        ke,
      ),
    )
  }

  /**
   * M1 — tanda birama yang berlaku pada birama absolut ke-`ke`.
   *
   * Urutan: segmen tempo terakhir yang membawa `birama` dan sudah mulai,
   * kalau tidak ada → tanda birama lagu, kalau tidak ada lagi → `null`
   * (perilaku lama: 1 ketuk = 60/BPM).
   */
  private meterUntuk(ke: number): TandaBirama | null {
    if (this.pakaiTempoMap) {
      let hasil: TandaBirama | null = null
      for (const s of this.segmen) {
        if (s.measure <= ke && s.birama) hasil = s.birama
      }
      if (hasil) return hasil
    }
    return this.birama
  }

  /**
   * M1 — birama turunan meter untuk dibunyikan, di-cache supaya tidak
   * dibuat ulang setiap birama.
   */
  private barUntuk(meter: TandaBirama | null, subdiv: number): BiramaPola {
    const kunci = meter ? `${JSON.stringify(meter)}|${subdiv}` : `lama|${this.beatsDasar}|${subdiv}`
    if (this.cacheBar && this.cacheBar.kunci === kunci) return this.cacheBar.bar
    const bar = meter
      ? bikinPolaDariBirama(meter, subdiv, undefined, true)
      : polaBaku(this.beatsDasar, subdiv)
    this.cacheBar = { kunci, bar }
    return bar
  }

  /**
   * Lama **satu not penyebut** pada tempo tertentu.
   * Tanpa tanda birama nilainya 60/BPM — persis perilaku lama, supaya
   * presenter & editor drill tidak berubah sedikit pun.
   */
  private detikPerNotUntuk(bpm: number, meter: TandaBirama | null): number {
    if (!meter) return 60 / bpm
    return hitungDetikPerNot(bpm, meter.penyebut, meter.acuan)
  }

  /**
   * M1 — jadwalkan hitung mundur, lalu kembalikan waktu ketukan pertama lagu.
   *
   * Hitung mundur **mengikuti tanda birama birama pertama** yang akan
   * dimainkan, dan boleh diulang beberapa kali.
   *
   * Bunyi kliknya dijadwalkan Web Audio seperti biasa (presisi). Kalau
   * pemakai memilih suara manusia, `info.ucap` diisi dan pemanggil
   * (`onKetuk`) yang mengucapkannya — ucapan tidak bisa dijadwalkan
   * sepresisi audio, tapi ketukan pertama lagu tetap tepat karena
   * waktunya dihitung di sini, bukan dari ucapan.
   */
  private jadwalkanHitungMundur(h: HitungMundur, waktuMulai: number, mulaiDari: number): number {
    const ctx = this.ctx
    // M1 — hitung mundur mengikuti meter **birama tempat lagu mulai**, bukan
    // meter awal lagu. Kalau mulai di birama 45 yang ternyata 7/8, hitung
    // mundurnya juga 7/8.
    const t = this.meterUntuk(mulaiDari)
    if (!ctx || !t) return waktuMulai

    const bpm = this.hitungBpm(mulaiDari)
    const perNot = hitungDetikPerNot(bpm, t.penyebut, t.acuan)
    const durasiSatuPutaran = perNot * t.pembilang
    const posisi = posisiHitungMundur(t, h)
    const ucapan = ucapHitungMundur(t, h)
    const ulang = Math.max(1, Math.min(8, Math.floor(h.ulang)))

    let waktu = waktuMulai
    for (let r = 0; r < ulang; r++) {
      for (let i = 0; i < posisi.length; i++) {
        const w = waktu + posisi[i] * perNot
        this.bunyiHitung(ctx, w, posisi[i] === 0)
        this.antrean.push({
          waktu: w,
          info: {
            bar: 0,
            beat: i,
            sub: 0,
            sel: posisi[i] === 0 ? 2 : 1,
            birama: mulaiDari,
            bpm,
            suara: 1,
            tahap: 'hitung',
            ucap: h.suara === 'suara' ? ucapan[i] : undefined,
          },
        })
      }
      waktu += durasiSatuPutaran
    }
    return waktu
  }

  /** Bunyi hitung mundur: pakai suaranya sendiri, sedikit lebih pelan. */
  private bunyiHitung(ctx: AudioContext, waktu: number, aksen: boolean) {
    const asli = this.suara
    const volumeAsli = this.volume
    this.suara = this.suaraHitung
    this.volume = volumeAsli * 0.8
    this.bunyi(ctx, waktu, aksen)
    this.suara = asli
    this.volume = volumeAsli
  }

  private jadwalkan() {
    const ctx = this.ctx
    if (!ctx) return

    // Keluarkan event tampilan yang waktunya sudah tiba.
    while (this.antrean.length && this.antrean[0].waktu <= ctx.currentTime) {
      const e = this.antrean.shift()!
      this.onKetuk(e.info)
      if (this.getar) bergetar(e.info.sel === 2 ? 28 : 12)
    }

    /*
     * #6 — selama rekaman belum benar-benar berbunyi, klik belum mulai.
     *
     * Inilah yang dulu tidak ada: mesin mulai menghitung sejak tombol ditekan,
     * sedangkan rekaman baru berbunyi setelah berkasnya dibaca dari IndexedDB,
     * digeser ke titik mulai, dan `play()`-nya benar-benar berjalan. Klik jadi
     * selalu mendahului lagunya — 40 ms di mesin cepat, dan makin lebar di
     * perangkat sibuk (terukur 157 ms saat utas utama diperlambat 8×).
     */
    if (this.jam && !this.jam.jalan()) {
      /*
       * Rekaman belum berbunyi. Biasanya ini hanya sekejap (berkas sedang
       * dibaca & digeser ke titik mulai), tetapi kalau rekamannya gagal
       * dimuat atau ditolak peramban, menunggu selamanya berarti metronom
       * yang diam tanpa penjelasan. Karena itu ada batas tunggu: sesudahnya
       * mesin berjalan seperti metronom mandiri.
       */
      if (ctx.currentTime <= this.jamBatas) return
      this.jam = null
      this.waktuBirama = ctx.currentTime + 0.08
    }
    const jam = this.jam
    if (jam) this.selaraskanKeJam()

    const laju = jam ? Math.max(0.1, jam.laju()) : 1
    const posLagu = jam ? jam.posisi() : 0
    /*
     * Jalur jam boleh melihat lebih jauh ke depan, karena acuannya posisi
     * rekaman — bukan akumulasi mesin sendiri. Jadi satu hiccup utas utama
     * tidak langsung memakan ketukan berikutnya (yang dulu terjadi: 180 ms
     * cadangan bisa habis oleh satu render berat, lalu ketukan berbunyi
     * terlambat).
     */
    const lihat = jam ? LIHAT_KE_JAM : LIHAT_KE_DEPAN

    // Bunyi yang waktunya sudah lewat tidak perlu bisa dibatalkan lagi.
    if (this.terjadwal.length) this.terjadwal = this.terjadwal.filter((t) => t.waktu > ctx.currentTime)

    while (!this.selesai) {
      // #6 — waktu AudioContext saat birama ini MULAI. Pada jalur jam, ini
      // dihitung dari posisi rekaman, bukan dari akumulasi mesin sendiri.
      const awalCtx = jam ? ctx.currentTime + (this.detikLagu - posLagu) / laju : this.waktuBirama
      if (awalCtx > ctx.currentTime + lihat) break

      const biramaAbsolut = this.pos + 1

      // M2 — ulang bagian: lewat batas akhir rentang, langsung kembali ke
      // awal rentang. Ini **menang** atas akhir lagu maupun `ulang`, karena
      // berlatih satu bagian berarti lagu memang tidak boleh berhenti.
      if (this.ulangSampai > 0 && biramaAbsolut > this.ulangSampai) {
        // #4 — naik otomatis: tiap putaran baru, tempo latihan naik.
        if (this.naik) {
          if (tujuanTercapai(this.naik, this.putaran) && this.naik.akhir === 'berhenti') {
            this.selesai = true
            break
          }
          this.putaran++
          this.latihan = tempoPutaran(this.naik, this.putaran)
          this.onPutaran?.({
            putaran: this.putaran,
            tempo: this.latihan,
            tujuan: tujuanTercapai(this.naik, this.putaran),
          })
        }
        this.pos = this.ulangDari - 1
        this.detikLagu = this.detikPadaBirama(this.ulangDari)
        continue
      }

      // M5 — batas akhir lagu.
      if (this.biramaAkhir > 0 && biramaAbsolut > this.biramaAkhir) {
        if (this.ulang) {
          // Kembali ke birama awal. `awal` dijamin tidak melebihi
          // `biramaAkhir` (diperiksa di `mulai`), jadi tidak mungkin
          // berputar di tempat tanpa batas.
          this.pos = this.awal - 1
          this.detikLagu = this.detikPadaBirama(this.awal)
          continue
        }
        this.selesai = true
        break
      }

      // Pada jalur jam, tempo yang menentukan posisi di sepanjang rekaman
      // adalah tempo ASLI — tempo latihan hidup di laju jam, bukan di sini.
      const bpm = jam ? this.hitungBpmAsli(biramaAbsolut) : this.hitungBpm(biramaAbsolut)
      // M1 — meter bisa berubah tiap segmen tempo, jadi birama & durasinya
      // ditentukan untuk birama yang sedang berjalan.
      const meterAktif = this.meterUntuk(biramaAbsolut)
      const idx = this.polaKustom ? this.pos % this.bars.length : 0
      const bar = this.polaKustom
        ? this.bars[idx]
        : this.barUntuk(meterAktif, this.subdivDasar)
      const durasiKetuk = this.detikPerNotUntuk(bpm, meterAktif)
      const durasiBarLagu = bar.beats * durasiKetuk
      const durasiLangkah = durasiKetuk / bar.subdiv
      // Detik lagu → detik nyata. Tanpa jam, laju = 1 dan angkanya sama
      // persis dengan perilaku lama.
      const langkahCtx = durasiLangkah / laju

      // Pola utama: tiap kotak yang tidak diam dijadwalkan pada waktunya.
      for (let i = 0; i < bar.cells.length; i++) {
        const sel = bar.cells[i]
        if (!sel) continue
        const waktu = awalCtx + i * langkahCtx
        /*
         * Jalur jam: ketukan yang waktunya sudah lewat dilewati, tidak
         * dibunyikan terlambat — kecuali yang baru lewat sekejap (30 ms).
         * Toleransi sekecil itu membuat ketukan pertama saat kita "ikut
         * bergabung" dengan rekaman tidak hilang, tanpa membuat ketukan lama
         * berbunyi bertumpuk sesudah lompatan.
         */
        if (jam && waktu < ctx.currentTime - 0.03) continue
        this.terjadwal.push({ waktu, batalkan: this.bunyi(ctx, waktu, sel === 2) })
        this.antrean.push({
          waktu,
          info: {
            bar: idx,
            beat: Math.floor(i / bar.subdiv),
            sub: i % bar.subdiv,
            sel,
            birama: biramaAbsolut,
            // Yang terdengar adalah tempo latihan, jadi itu yang dilaporkan.
            bpm: jam ? this.hitungBpm(biramaAbsolut) : bpm,
            suara: 1,
          },
        })
      }

      // Poliritme: suara kedua dibagi merata sepanjang birama ini.
      if (this.poly) {
        const p = this.poly
        const jumlah = Math.max(1, p.beats * p.subdiv)
        const langkah = durasiBarLagu / jumlah / laju
        for (let j = 0; j < jumlah; j++) {
          const sel = p.cells[j] ?? 0
          if (!sel) continue
          const waktu = awalCtx + j * langkah
          if (jam && waktu < ctx.currentTime - 0.03) continue
          this.terjadwal.push({ waktu, batalkan: this.bunyi(ctx, waktu, sel === 2, true) })
          this.antrean.push({
            waktu,
            info: { bar: idx, beat: j, sub: 0, sel, birama: biramaAbsolut, bpm, suara: 2 },
          })
        }
      }

      this.waktuBirama = awalCtx + durasiBarLagu / laju
      this.detikLagu += durasiBarLagu
      this.pos++
    }

    // Jaga antrean supaya tidak menumpuk kalau tab sedang tidak aktif.
    if (this.antrean.length > 400) this.antrean.splice(0, this.antrean.length - 400)

    // M5 — lagu habis: tunggu sampai bunyi terakhir benar-benar lewat, baru
    // berhenti. Kalau langsung berhenti, ekor birama terakhir terpotong.
    if (this.selesai && this.antrean.length === 0 && ctx.currentTime >= this.waktuBirama) {
      const cb = this.onSelesai
      this.onSelesai = null
      this.selesai = false
      this.berhenti()
      cb?.()
    }
  }

  /** Satu bunyi klik. `aksen` = lebih keras & lebih tinggi, `kedua` = suara poliritme. */
  /**
   * #6 — bunyikan satu ketukan; kembalikan cara membatalkannya.
   *
   * Pembatalan dipakai kalau rekaman melompat (ulang bagian, geser): klik
   * yang sudah ditanam untuk posisi lama tetapi belum berbunyi harus dibuang,
   * kalau tidak ia berbunyi di tempat yang sudah tidak cocok lagi.
   */
  private bunyi(ctx: AudioContext, waktu: number, aksen: boolean, kedua = false): () => void {
    const v = this.volume * (aksen ? 0.22 : 0.12)
    if (v <= 0) return () => undefined
    if (this.suara === 'kayu') return this.bunyiKayu(ctx, waktu, v, aksen, kedua)
    if (this.suara === 'bel') return this.bunyiBel(ctx, waktu, v, aksen, kedua)
    return this.bunyiKlik(ctx, waktu, v, aksen, kedua)
  }

  private bunyiKlik(ctx: AudioContext, waktu: number, v: number, aksen: boolean, kedua: boolean) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.value = kedua ? (aksen ? 1500 : 1100) : aksen ? 1400 : 1000
    gain.gain.setValueAtTime(v, waktu)
    gain.gain.exponentialRampToValueAtTime(0.0001, waktu + 0.05)
    osc.start(waktu)
    osc.stop(waktu + 0.07)
    return hentikanSegera(osc, gain)
  }

  /** Woodblock: segitiga pendek dengan bunyi "tok" yang lebih padat. */
  private bunyiKayu(ctx: AudioContext, waktu: number, v: number, aksen: boolean, kedua: boolean) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(kedua ? 1200 : aksen ? 1000 : 820, waktu)
    osc.frequency.exponentialRampToValueAtTime(kedua ? 700 : aksen ? 560 : 480, waktu + 0.03)
    gain.gain.setValueAtTime(v * 1.2, waktu)
    gain.gain.exponentialRampToValueAtTime(0.0001, waktu + 0.045)
    osc.start(waktu)
    osc.stop(waktu + 0.06)
    return hentikanSegera(osc, gain)
  }

  /** Cowbell: dua osilator kotak (interval ~6th) seperti bel sapi. */
  private bunyiBel(ctx: AudioContext, waktu: number, v: number, aksen: boolean, kedua: boolean): () => void {
    const gain = ctx.createGain()
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = kedua ? 2600 : 2200
    filter.Q.value = 4
    gain.connect(filter)
    filter.connect(ctx.destination)
    const osilator: OscillatorNode[] = []
    for (const f of kedua ? [680, 1010] : aksen ? [620, 930] : [540, 800]) {
      const osc = ctx.createOscillator()
      osc.type = 'square'
      osc.frequency.value = f
      osc.connect(gain)
      osc.start(waktu)
      osc.stop(waktu + 0.14)
      osilator.push(osc)
    }
    gain.gain.setValueAtTime(v * 0.5, waktu)
    gain.gain.exponentialRampToValueAtTime(0.0001, waktu + 0.16)
    return hentikanSegera(osilator, gain)
  }
}

/** Getar pendek — diam-diam dilewati kalau browser/HP tidak mendukung. */
function bergetar(ms: number) {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(ms)
  } catch {
    /* abaikan */
  }
}

/**
 * B5 — Hitung pengaturan klik untuk animasi drill.
 *
 * Di DrillKit satu **count** = `beatsPerCount` ketukan, dan `tempo` = BPM.
 * Jadi metronomnya berdetak sekali per count (BPM dibagi beatsPerCount) dan
 * memberi aksen pada count pertama tiap set (`counts` = ketukan per birama).
 */
export function klikUntukDrill(tempo: number, beatsPerCount: number, counts: number) {
  const bpm = Math.max(MIN_BPM, tempo / Math.max(0.25, beatsPerCount))
  const beats = Math.max(1, Math.min(12, Math.round(counts)))
  return { bpm, beats, subdiv: 1 }
}
