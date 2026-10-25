/**
 * #11d — Logika murni latihan frasa partitur, sorot birama sinkron
 * `TempoTimeline`, dan tautan frasa ↔ set drill (`Set 4–6 = Bar 9–16`).
 *
 * Sengaja bebas dari DOM, Dexie, React, dan OSMD supaya seluruh hitungan
 * (penyimpanan per perangkat, format lencana `"Frasa 5–8 · 80%"`, pemetaan
 * kotak birama ber-*pickup* / ber-*multi-rest*, deteksi klik koordinat,
 * penggabungan pita sorot per sistem, target *auto-scroll*, serta pemetaan
 * set drill ↔ birama) diuji cepat di Node melalui `qa/partitur-frasa-logika.mjs`.
 */
import type { TautanFrasaSetList, UlangBagian } from '../db/types'
import { petaPenggaris, type LaguSegmen } from './segmenDrill'
import { latihanAktif, rapikanTempo, type TempoLatihan } from './tempoLatihan'
import { createTempoTimeline } from './tempoTimeline'
import { rentangValid } from './ulang'

/* ---------------------- Konstanta & Warna Hex Murni --------------------- */

export const KUNCI_SIMPAN_FRASA = 'drillkit_frasa_latihan_v1'
export const TANPA_LAGU_FRASA = '__bebas'

/**
 * Palet sorot partitur murni hex & rgba (nol `oklch()` / `color-mix()`),
 * aman di dalam `[data-testid="layar-partitur"]`.
 */
export const WARNA_SOROT_PARTITUR_HEX = {
  aktifLatar: 'rgba(16, 185, 129, 0.20)',
  aktifTepi: '#059669',
  hitungLatar: 'rgba(245, 158, 11, 0.20)',
  hitungTepi: '#d97706',
  frasaLatar: 'rgba(245, 158, 11, 0.12)',
  frasaTepi: '#d97706',
  calonAwalLatar: 'rgba(14, 165, 233, 0.18)',
  calonAwalTepi: '#0284c7',
} as const

/* --------------------------------- Tipe --------------------------------- */

export interface FrasaLatihan {
  /** Birama awal rentang (1-based, inklusif). */
  dari: number
  /** Birama akhir rentang (1-based, inklusif). */
  sampai: number
  /** 1 = pengulangan frasa menyala; 0 = rentang tersimpan tanpa diulang. */
  aktif: 0 | 1
  /** Label opsional asal rentang (mis. "Reff", "Set 4–6"). */
  label?: string
}

export type PetaFrasaLatihan = Record<string, FrasaLatihan>

export interface PenyimpanFrasa {
  getItem(k: string): string | null
  setItem(k: string, v: string): void
}

export interface BiramaSumberMentah {
  /** Indeks 0-based di daftar `SourceMeasures` OSMD. */
  indeksUrut: number
  /** Nomor birama sumber dari XML (`0` bila anacrusis/pickup, `1..N` birama biasa). */
  nomorBiramaXml: number
  /** Id elemen `<g class="vf-measure" id="…">` bila birama ini digambar langsung; `null` bila terlipat multi-rest. */
  idGrafis: string | null
  /** Banyak birama istirahat yang dilipat mulai dari birama ini (`>= 2` untuk multi-rest). */
  jumlahMultiRest?: number
}

export interface KotakPikselMentah {
  x: number
  y: number
  lebar: number
  tinggi: number
}

export interface KotakBiramaPiksel extends KotakPikselMentah {
  /** Nomor birama sumber dari XML (`0` untuk pickup, `1..N` birama biasa). */
  nomorBiramaXml: number
  /** Nomor birama selaras `TempoTimeline` & `Metronom` (`0` untuk pickup, `1..N` birama biasa). */
  birama: number
  /** Indeks urut 0-based di `SourceMeasures`. */
  indeksUrut: number
  /** Rentang birama `[awal, akhir]` bila kotak ini mewakili istirahat multi-birama (`|— N —|`). */
  rentangMultiRest?: [number, number]
}

export interface RentangFrasaSegmen {
  id: string
  label: string
  dari: number
  sampai: number
  bpm: number
}

export interface InfoSetBirama {
  /** Indeks 0-based di urutan set drill. */
  index: number
  /** Nomor set 1-based untuk tampilan (`Set 1`, `Set 2`, …). */
  nomorSet: number
  /** Nama set di drill (mis. "Set 4" atau "Pembuka"). */
  nama: string
  /** Hitungan perpindahan set ini. */
  counts: number
  /** Posisi mulai presisi (pecahan birama 1-based dari `TempoTimeline`). */
  mulaiBirama: number
  /** Posisi akhir presisi (pecahan birama 1-based dari `TempoTimeline`). */
  akhirBirama: number
  /** Birama bulat awal 1-based inklusif. */
  biramaDari: number
  /** Birama bulat akhir 1-based inklusif. */
  biramaSampai: number
}

/* --------------------- Penyimpanan Frasa Per Perangkat ------------------ */

function penyimpanBawaan(): PenyimpanFrasa | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null
  } catch {
    return null
  }
}

function angkaBulatPositif(v: unknown, cadangan: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return cadangan
  return Math.max(1, Math.floor(v))
}

/**
 * Rapikan objek frasa dari `localStorage` atau masukan pengguna.
 *
 * Catatan penting: saat pengguna sedang mengetik di kotak input angka M2
 * (`ulang-dari` / `ulang-sampai`), kita **tidak** membalik otomatis `dari > sampai`
 * agar pesan validasi M2 (`ulang-tidak-sah`) tetap muncul jujur ketika input
 * memang terbalik; sedangkan pemilihan langsung lewat klik partitur/segmen/set
 * mengurutkan `Math.min`..`Math.max` melalui `susunFrasaTerurut`.
 */
export function rapikanFrasaLatihan(
  f: Partial<FrasaLatihan> | null | undefined,
): FrasaLatihan {
  const dari = angkaBulatPositif(f?.dari, 1)
  const sampai = angkaBulatPositif(f?.sampai, Math.max(4, dari))
  const label = typeof f?.label === 'string' && f.label.trim() ? f.label.trim().slice(0, 60) : undefined
  return {
    dari,
    sampai,
    aktif: f?.aktif === 1 ? 1 : 0,
    ...(label ? { label } : {}),
  }
}

/** Susun `FrasaLatihan` dengan `dari <= sampai` dijamin terurut rapi. */
export function susunFrasaTerurut(
  biramaA: number,
  biramaB: number,
  aktif: 0 | 1 = 1,
  label?: string,
): FrasaLatihan {
  const a = angkaBulatPositif(biramaA, 1)
  const b = angkaBulatPositif(biramaB, a)
  return rapikanFrasaLatihan({
    dari: Math.min(a, b),
    sampai: Math.max(a, b),
    aktif,
    label,
  })
}

export function bacaSemuaFrasa(p: PenyimpanFrasa | null = penyimpanBawaan()): PetaFrasaLatihan {
  if (!p) return {}
  try {
    const mentah = JSON.parse(p.getItem(KUNCI_SIMPAN_FRASA) ?? '{}') as Record<
      string,
      Partial<FrasaLatihan>
    >
    if (!mentah || typeof mentah !== 'object' || Array.isArray(mentah)) return {}
    const hasil: PetaFrasaLatihan = {}
    for (const [id, nilai] of Object.entries(mentah)) {
      if (!id || !nilai || typeof nilai !== 'object') continue
      hasil[id] = rapikanFrasaLatihan(nilai)
    }
    return hasil
  } catch {
    return {}
  }
}

export function tulisSemuaFrasa(
  peta: PetaFrasaLatihan,
  p: PenyimpanFrasa | null = penyimpanBawaan(),
): void {
  if (!p) return
  try {
    const bersih: PetaFrasaLatihan = {}
    for (const [id, nilai] of Object.entries(peta)) {
      if (!id || !nilai) continue
      bersih[id] = rapikanFrasaLatihan(nilai)
    }
    p.setItem(KUNCI_SIMPAN_FRASA, JSON.stringify(bersih))
  } catch {
    // penyimpanan diblokir — abaikan
  }
}

/**
 * Tentukan frasa latihan efektif satu lagu:
 * 1. bila perangkat ini sudah punya catatan di `localStorage`, pakai itu;
 * 2. bila belum ada, jatuh ke `song.ulangBagian` (kompatibilitas M2 penuh).
 */
export function frasaEfektifUntukLagu(
  peta: PetaFrasaLatihan,
  songId: string | null | undefined,
  ulangBagianLagu?: UlangBagian | null,
): FrasaLatihan | null {
  const kunci = songId || TANPA_LAGU_FRASA
  if (peta[kunci]) return peta[kunci]
  if (ulangBagianLagu) {
    return rapikanFrasaLatihan({
      dari: ulangBagianLagu.dari,
      sampai: ulangBagianLagu.sampai,
      aktif: ulangBagianLagu.aktif,
    })
  }
  return null
}

/** Konversi `FrasaLatihan` ke bentuk M2 `UlangBagian` untuk mesin metronom & DB lagu. */
export function keUlangBagian(frasa: FrasaLatihan | null | undefined): UlangBagian | null {
  if (!frasa) return null
  return {
    dari: frasa.dari,
    sampai: frasa.sampai,
    aktif: frasa.aktif,
  }
}

export function frasaAktifSah(
  frasa: FrasaLatihan | null | undefined,
  panjangBirama?: number,
): boolean {
  if (!frasa || frasa.aktif !== 1) return false
  return rentangValid(keUlangBagian(frasa), panjangBirama)
}

/* ------------------ Format Lencana "Frasa 5–8 · 80%" -------------------- */

/**
 * Susun teks lencana baku untuk `PanelLagu`, `KartuSetList`, dan `LayarPartitur`.
 * Mengembalikan `null` bila pengulangan frasa sedang mati atau rentangnya tidak sah.
 */
export function formatLencanaFrasa(
  frasa: FrasaLatihan | null | undefined,
  latihan?: TempoLatihan | null,
  panjangBirama?: number,
): string | null {
  if (!frasaAktifSah(frasa, panjangBirama) || !frasa) return null
  const rentang = frasa.dari === frasa.sampai ? `Frasa ${frasa.dari}` : `Frasa ${frasa.dari}–${frasa.sampai}`
  if (latihanAktif(latihan) && latihan) {
    const rapi = rapikanTempo(latihan)
    const ringkasTempo =
      rapi.mode === 'bpm'
        ? `${rapi.geser > 0 ? '+' : '−'}${Math.abs(rapi.geser)} BPM`
        : `${rapi.persen}%`
    return `${rentang} · ${ringkasTempo}`
  }
  return rentang
}

/* -------------- Pemetaan Kotak Birama, Multi-Rest, & Klik --------------- */

function nomorBiramaSelarasTimeline(daftarSumber: readonly BiramaSumberMentah[]): number[] {
  if (daftarSumber.length === 0) return []
  const adaPickupNol = daftarSumber[0].nomorBiramaXml === 0
  let xmlUrutSah = true
  for (let i = 0; i < daftarSumber.length; i += 1) {
    const harap = adaPickupNol ? i : i + 1
    if (daftarSumber[i].nomorBiramaXml !== harap) {
      xmlUrutSah = false
      break
    }
  }
  if (xmlUrutSah) {
    return daftarSumber.map((s) => s.nomorBiramaXml)
  }
  return daftarSumber.map((_, i) => (adaPickupNol ? i : i + 1))
}

/**
 * Pasangkan setiap birama sumber MusicXML dengan kotak piksel SVG-nya, termasuk
 * menangani birama pendahuluan (*pickup* `0`) dan birama yang dilipat ke dalam
 * lambang istirahat multi-birama (`|— N —|`).
 */
export function petakanKotakBiramaSumber(
  daftarSumber: readonly BiramaSumberMentah[],
  petaKotakGrafis: ReadonlyMap<string, KotakPikselMentah>,
): KotakBiramaPiksel[] {
  const nomorTimeline = nomorBiramaSelarasTimeline(daftarSumber)
  const hasil: KotakBiramaPiksel[] = []

  let i = 0
  while (i < daftarSumber.length) {
    const sm = daftarSumber[i]
    const idLangsung = sm.idGrafis && petaKotakGrafis.has(sm.idGrafis) ? sm.idGrafis : null

    if (!idLangsung) {
      i += 1
      continue
    }

    const kotak = petaKotakGrafis.get(idLangsung)!

    // Hitung rentang lipatan multi-rest: baik dari `jumlahMultiRest` eksplisit
    // maupun dari deretan birama berikutnya yang `idGrafis`-nya kosong/terlipat.
    const dinyatakan = Math.max(1, Math.floor(sm.jumlahMultiRest ?? 1))
    let akhirIdx = Math.min(daftarSumber.length - 1, i + dinyatakan - 1)
    while (
      akhirIdx + 1 < daftarSumber.length &&
      (!daftarSumber[akhirIdx + 1].idGrafis ||
        !petaKotakGrafis.has(daftarSumber[akhirIdx + 1].idGrafis!))
    ) {
      akhirIdx += 1
    }

    const adalahMultiRest = akhirIdx > i
    const rentangMultiRest: [number, number] | undefined = adalahMultiRest
      ? [nomorTimeline[i], nomorTimeline[akhirIdx]]
      : undefined

    for (let k = i; k <= akhirIdx; k += 1) {
      hasil.push({
        nomorBiramaXml: daftarSumber[k].nomorBiramaXml,
        birama: nomorTimeline[k],
        indeksUrut: daftarSumber[k].indeksUrut,
        x: kotak.x,
        y: kotak.y,
        lebar: kotak.lebar,
        tinggi: kotak.tinggi,
        ...(rentangMultiRest ? { rentangMultiRest } : {}),
      })
    }

    i = akhirIdx + 1
  }

  return hasil
}

/** Cari kotak piksel untuk birama aktif (termasuk di tengah istirahat multi-birama). */
export function cariKotakBiramaAktif(
  daftarKotak: readonly KotakBiramaPiksel[],
  biramaAktif: number,
): KotakBiramaPiksel | null {
  if (!Number.isFinite(biramaAktif) || daftarKotak.length === 0) return null
  const bulat = Math.floor(biramaAktif)
  const tepat = daftarKotak.find((k) => k.birama === bulat)
  if (tepat) return tepat
  const diMultiRest = daftarKotak.find(
    (k) => k.rentangMultiRest && bulat >= k.rentangMultiRest[0] && bulat <= k.rentangMultiRest[1],
  )
  return diMultiRest ?? null
}

/**
 * Temukan birama pada titik klik `(x, y)` dalam koordinat `wadahSvg`.
 * Bila mengenai lambang istirahat multi-birama, mengembalikan entri pembuka
 * rentang tersebut (lengkap dengan `rentangMultiRest`).
 */
export function cariBiramaDariTitikKlik(
  daftarKotak: readonly KotakBiramaPiksel[],
  x: number,
  y: number,
  toleransiPx = 16,
): KotakBiramaPiksel | null {
  if (!Number.isFinite(x) || !Number.isFinite(y) || daftarKotak.length === 0) return null

  // 1. Tepat di dalam kotak birama (utamakan birama >= 1 atau pembuka multi-rest).
  for (const k of daftarKotak) {
    if (k.rentangMultiRest && k.birama !== k.rentangMultiRest[0]) continue
    if (x >= k.x && x <= k.x + k.lebar && y >= k.y && y <= k.y + k.tinggi) {
      return k
    }
  }

  // 2. Di sekitar tepi atas/bawah paranada (mis. mengeklik angka birama di atas garis).
  let kandidatTerdekat: KotakBiramaPiksel | null = null
  let jarakTerbaik = Number.POSITIVE_INFINITY
  for (const k of daftarKotak) {
    if (k.rentangMultiRest && k.birama !== k.rentangMultiRest[0]) continue
    const dx = x < k.x ? k.x - x : x > k.x + k.lebar ? x - (k.x + k.lebar) : 0
    const dy = y < k.y ? k.y - y : y > k.y + k.tinggi ? y - (k.y + k.tinggi) : 0
    if (dx <= toleransiPx && dy <= toleransiPx) {
      const jarak = dx * dx + dy * dy
      if (jarak < jarakTerbaik) {
        jarakTerbaik = jarak
        kandidatTerdekat = k
      }
    }
  }

  return kandidatTerdekat
}

/**
 * Gabungkan kotak-kotak birama dalam rentang `[dari, sampai]` yang terletak
 * pada sistem/baris paranada yang sama menjadi satu pita per baris agar
 * tampilan sorot frasa bersih dan tidak bertumpuk garis tengahnya.
 */
export function gabungKotakFrasaPerBaris(
  daftarKotak: readonly KotakBiramaPiksel[],
  dari: number,
  sampai: number,
): KotakPikselMentah[] {
  const awal = Math.min(dari, sampai)
  const akhir = Math.max(dari, sampai)
  const terpilih: KotakPikselMentah[] = []
  const kunciSudah = new Set<string>()

  for (const k of daftarKotak) {
    if (k.birama < awal || k.birama > akhir) continue
    const sidik = `${Math.round(k.x)}:${Math.round(k.y)}:${Math.round(k.lebar)}:${Math.round(k.tinggi)}`
    if (kunciSudah.has(sidik)) continue
    kunciSudah.add(sidik)
    terpilih.push({ x: k.x, y: k.y, lebar: k.lebar, tinggi: k.tinggi })
  }

  if (terpilih.length <= 1) return terpilih

  const urut = [...terpilih].sort((a, b) => (Math.abs(a.y - b.y) > 14 ? a.y - b.y : a.x - b.x))
  const pita: KotakPikselMentah[] = []

  for (const k of urut) {
    const terakhir = pita[pita.length - 1]
    if (!terakhir) {
      pita.push({ ...k })
      continue
    }
    const toleransiBaris = Math.max(14, Math.min(terakhir.tinggi, k.tinggi) * 0.45)
    const satuBaris = Math.abs(k.y - terakhir.y) <= toleransiBaris
    const berdampingan = k.x <= terakhir.x + terakhir.lebar + 28
    if (satuBaris && berdampingan) {
      const xMin = Math.min(terakhir.x, k.x)
      const yMin = Math.min(terakhir.y, k.y)
      const xMaks = Math.max(terakhir.x + terakhir.lebar, k.x + k.lebar)
      const yMaks = Math.max(terakhir.y + terakhir.tinggi, k.y + k.tinggi)
      terakhir.x = xMin
      terakhir.y = yMin
      terakhir.lebar = xMaks - xMin
      terakhir.tinggi = yMaks - yMin
    } else {
      pita.push({ ...k })
    }
  }

  return pita
}

/**
 * Hitung target gulir (`top` atau `left`) bila kotak birama aktif berada di
 * luar zona nyaman baca. Mengembalikan `null` bila sudah nyaman terlihat,
 * sehingga halaman tidak bergoyang di tiap ketukan pada sistem yang sama.
 */
export function hitungTargetGulirBirama(
  kotak: KotakPikselMentah,
  pandangan: {
    scrollTop: number
    scrollLeft: number
    clientHeight: number
    clientWidth: number
  },
  tataLetak: 'vertikal' | 'mendatar',
): { top?: number; left?: number } | null {
  if (tataLetak === 'mendatar') {
    const lebarLayar = Math.max(1, pandangan.clientWidth)
    const batasKiri = pandangan.scrollLeft + lebarLayar * 0.14
    const batasKanan = pandangan.scrollLeft + lebarLayar * 0.78
    const kananKotak = kotak.x + Math.min(kotak.lebar, lebarLayar * 0.55)
    if (kotak.x >= batasKiri && kananKotak <= batasKanan) return null
    return { left: Math.max(0, Math.round(kotak.x - lebarLayar * 0.22)) }
  }

  const tinggiLayar = Math.max(1, pandangan.clientHeight)
  const batasAtas = pandangan.scrollTop + tinggiLayar * 0.14
  const batasBawah = pandangan.scrollTop + tinggiLayar * 0.82
  const bawahKotak = kotak.y + Math.min(kotak.tinggi, tinggiLayar * 0.62)
  if (kotak.y >= batasAtas && bawahKotak <= batasBawah) return null
  return { top: Math.max(0, Math.round(kotak.y - tinggiLayar * 0.20)) }
}

/* --------------- Segmen Lagu & Tautan Frasa ↔ Set Drill ----------------- */

/**
 * Turunkan daftar frasa cepat dari segmen tempo lagu (`Intro`, `Reff`, dst.).
 * Berfungsi penuh walau lagu tidak memiliki MusicXML (*fallback* `TempoTimeline`).
 */
export function hitungRentangFrasaSegmen(
  segmen: readonly { id?: string; label?: string; measure: number; bpm?: number }[],
  batasAkhirBirama?: number | null,
): RentangFrasaSegmen[] {
  if (!segmen || segmen.length === 0) return []
  const urut = [...segmen]
    .filter((s) => Number.isFinite(s.measure) && s.measure >= 1)
    .sort((a, b) => a.measure - b.measure)

  const hasil: RentangFrasaSegmen[] = []
  for (let i = 0; i < urut.length; i += 1) {
    const kini = urut[i]
    const dari = Math.max(1, Math.floor(kini.measure))
    // Cari segmen berikutnya yang mulai di birama lebih besar.
    const berikut = urut.slice(i + 1).find((x) => Math.floor(x.measure) > dari)
    let sampai: number
    if (berikut) {
      sampai = Math.max(dari, Math.floor(berikut.measure) - 1)
    } else if (batasAkhirBirama && Number.isFinite(batasAkhirBirama) && batasAkhirBirama >= dari) {
      sampai = Math.floor(batasAkhirBirama)
    } else {
      sampai = dari + 3
    }
    hasil.push({
      id: kini.id || `seg_${i + 1}`,
      label: (kini.label && kini.label.trim()) || `Bagian ${i + 1}`,
      dari,
      sampai,
      bpm: typeof kini.bpm === 'number' && Number.isFinite(kini.bpm) ? kini.bpm : 120,
    })
  }
  return hasil
}

/**
 * Petakan setiap `DrillSet` ke rentang birama bulat inklusif (`biramaDari`..`biramaSampai`)
 * memakai evaluator `petaPenggaris` (`TempoTimeline`).
 */
export function hitungPetaSetKeBirama(
  sets: readonly { counts: number; name?: string }[],
  lagu: LaguSegmen,
  opsi?: { beatsPerCount?: number; latihan?: TempoLatihan | null },
): InfoSetBirama[] {
  if (!sets || sets.length === 0) return []
  const penggaris = petaPenggaris([...sets], lagu, {
    beatsPerCount: opsi?.beatsPerCount ?? 1,
    latihan: opsi?.latihan,
  })
  return penggaris.set.map((blok) => {
    const biramaDari = Math.max(1, Math.floor(blok.mulaiBirama + 1e-9))
    const biramaSampai = Math.max(biramaDari, Math.ceil(blok.akhirBirama - 1e-9) - 1)
    return {
      index: blok.index,
      nomorSet: blok.index + 1,
      nama: blok.nama,
      counts: blok.hitungan,
      mulaiBirama: blok.mulaiBirama,
      akhirBirama: blok.akhirBirama,
      biramaDari,
      biramaSampai,
    }
  })
}

/**
 * Gabungkan rentang nomor set 1-based (`nomorSetAwal`..`nomorSetAkhir`, mis. `4`..`6`)
 * menjadi rentang birama inklusif (`Set 4–6 = Bar 9–16`).
 */
export function gabungRentangSetKeBirama(
  petaSet: readonly InfoSetBirama[],
  nomorSetAwal: number,
  nomorSetAkhir: number,
): {
  setAwal: number
  setAkhir: number
  biramaDari: number
  biramaSampai: number
} | null {
  if (!petaSet || petaSet.length === 0) return null
  const minSet = Math.max(1, Math.min(Math.floor(nomorSetAwal), Math.floor(nomorSetAkhir)))
  const maksSet = Math.min(
    petaSet[petaSet.length - 1].nomorSet,
    Math.max(Math.floor(nomorSetAwal), Math.floor(nomorSetAkhir)),
  )
  const diRentang = petaSet.filter((s) => s.nomorSet >= minSet && s.nomorSet <= maksSet)
  if (diRentang.length === 0) return null
  return {
    setAwal: diRentang[0].nomorSet,
    setAkhir: diRentang[diRentang.length - 1].nomorSet,
    biramaDari: diRentang[0].biramaDari,
    biramaSampai: diRentang[diRentang.length - 1].biramaSampai,
  }
}

/** Format baku `"Set 4–6 = Bar 9–16"` (atau `"Set 4 = Bar 9–10"`). */
export function formatTautanSetBirama(
  tautan: Pick<TautanFrasaSetList, 'setAwal' | 'setAkhir' | 'biramaDari' | 'biramaSampai'>,
): string {
  const awalSet = Math.max(1, Math.floor(Math.min(tautan.setAwal, tautan.setAkhir)))
  const akhirSet = Math.max(awalSet, Math.floor(Math.max(tautan.setAwal, tautan.setAkhir)))
  const dariBar = Math.max(1, Math.floor(Math.min(tautan.biramaDari, tautan.biramaSampai)))
  const sampaiBar = Math.max(dariBar, Math.floor(Math.max(tautan.biramaDari, tautan.biramaSampai)))

  const teksSet = awalSet === akhirSet ? `Set ${awalSet}` : `Set ${awalSet}–${akhirSet}`
  const teksBar = dariBar === sampaiBar ? `Bar ${dariBar}` : `Bar ${dariBar}–${sampaiBar}`
  return `${teksSet} = ${teksBar}`
}

export function kunciTautanSetList(indeksBaris: number, songId: string): string {
  return `${Math.max(0, Math.floor(indeksBaris))}:${songId}`
}

export function bacaTautanFrasaBaris(
  peta: Record<string, TautanFrasaSetList> | undefined,
  indeksBaris: number,
  songId: string,
): TautanFrasaSetList | null {
  if (!peta) return null
  return peta[kunciTautanSetList(indeksBaris, songId)] ?? peta[songId] ?? null
}

/**
 * Hitung birama bulat 1-based dari posisi set ke-`indeksSet` dan progres animasi
 * `progres01` (`0..1`) di `DrillEditor` menggunakan `TempoTimeline` yang sama.
 */
export function biramaPadaProgresSet(
  sets: readonly { counts: number }[],
  lagu: LaguSegmen,
  indeksSet: number,
  progres01: number,
  opsi?: { beatsPerCount?: number },
): number {
  if (!sets || sets.length === 0) return 1
  const bpc = Math.max(0.25, opsi?.beatsPerCount ?? 1)
  const timeline = createTempoTimeline({
    bpm: lagu.bpm,
    meter: lagu.tandaBirama,
    segments: lagu.tempoMap,
    latih: lagu.latih ?? null,
  })
  const idxAman = Math.max(0, Math.min(sets.length - 1, Math.floor(indeksSet)))
  let quarter = 0
  for (let i = 0; i < idxAman; i += 1) {
    const c = Math.max(1, Math.floor(sets[i].counts))
    quarter = timeline.advanceTempoBeats(quarter, c * bpc)
  }
  const p = Math.max(0, Math.min(0.999999, Number.isFinite(progres01) ? progres01 : 0))
  const cAktif = Math.max(1, Math.floor(sets[idxAman].counts))
  const qKini = timeline.advanceTempoBeats(quarter, p * cAktif * bpc)
  return Math.max(1, timeline.positionAtQuarter(qKini).measure)
}

/**
 * Kebalikan `biramaPadaProgresSet`: cari posisi hitungan drill tempat `biramaTujuan`
 * dimulai (dipakai saat pengguna mengeklik birama pada partitur di dalam `DrillEditor`).
 */
export function hitunganPadaBirama(
  sets: readonly { counts: number; name?: string }[],
  lagu: LaguSegmen,
  biramaTujuan: number,
  opsi?: { beatsPerCount?: number },
): number {
  const bpc = Math.max(0.25, opsi?.beatsPerCount ?? 1)
  const timeline = createTempoTimeline({
    bpm: lagu.bpm,
    meter: lagu.tandaBirama,
    segments: lagu.tempoMap,
    latih: lagu.latih ?? null,
  })
  const qTarget = timeline.quarterAtMeasure(Math.max(1, Math.floor(biramaTujuan)))
  const totalHitungan = (sets ?? []).reduce((a, s) => a + Math.max(1, Math.floor(s.counts)), 0)
  if (totalHitungan <= 0) return 0

  let bawah = 0
  let atas = totalHitungan
  for (let iter = 0; iter < 28; iter += 1) {
    const tengah = (bawah + atas) / 2
    const q = timeline.advanceTempoBeats(0, tengah * bpc)
    if (q < qTarget) bawah = tengah
    else atas = tengah
  }
  return Math.min(totalHitungan, Math.max(0, Math.round(((bawah + atas) / 2) * 100) / 100))
}
