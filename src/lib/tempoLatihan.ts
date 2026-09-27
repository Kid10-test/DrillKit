/**
 * #4 — Tempo latihan.
 *
 * Untuk berlatih lebih lambat, pelatih dulu harus mengubah setiap segmen
 * tempo map satu per satu, lalu mengembalikannya. Modul ini memberi satu
 * pengali yang diterapkan **paling akhir** pada tempo yang berlaku (tempo
 * map, luncuran berangsur, latih tempo lama), termasuk hitung mundur.
 *
 * Aturan yang dipegang:
 * - Dua mode: **persen** (bawaan, 40–150%) atau **BPM** (−60 sampai +30).
 * - Hasilnya tidak pernah di bawah 20 BPM.
 * - Diingat **per lagu per perangkat** (localStorage). Tidak mengubah data
 *   lagu dan tidak ikut backup atau paket — sengaja, karena ini keadaan
 *   latihan satu orang, bukan bagian dari repertoar.
 * - Layar hari H (mode lomba) selalu memakai tempo asli.
 *
 * Sengaja murni (kecuali pembungkus localStorage yang bisa diganti) supaya
 * hitungannya bisa diuji langsung dari node.
 */

export type ModeTempoLatihan = 'persen' | 'bpm'

export interface TempoLatihan {
  mode: ModeTempoLatihan
  /** 40–150, 100 = tempo asli */
  persen: number
  /** −60 sampai +30 BPM, 0 = tempo asli */
  geser: number
}

/** Naik otomatis saat mengulang bagian (M2). */
export interface NaikOtomatis {
  on: boolean
  mode: ModeTempoLatihan
  /** nilai awal (persen atau geser BPM, sesuai `mode`) */
  mulai: number
  /** kenaikan tiap langkah (persen atau BPM) */
  naik: number
  /** naik setiap berapa putaran */
  tiap: number
  /** nilai tujuan */
  sampai: number
  /** setelah tujuan tercapai: tetap mengulang di tempo tujuan, atau berhenti */
  akhir: 'tetap' | 'berhenti'
}

/** Yang disimpan untuk satu lagu. */
export interface SimpananLatihan {
  tempo: TempoLatihan
  naik?: NaikOtomatis
}

export const BATAS_PERSEN = { min: 40, max: 150 } as const
export const BATAS_GESER = { min: -60, max: 30 } as const
/** Tempo latihan tidak pernah membuat lagu lebih lambat dari ini. */
export const BPM_TERENDAH = 20
const BPM_TERTINGGI = 400

export const TEMPO_ASLI: TempoLatihan = { mode: 'persen', persen: 100, geser: 0 }

export const NAIK_BAWAAN: NaikOtomatis = {
  on: false,
  mode: 'persen',
  mulai: 70,
  naik: 5,
  tiap: 1,
  sampai: 100,
  akhir: 'tetap',
}

const angka = (v: unknown, cadangan: number) => (typeof v === 'number' && Number.isFinite(v) ? v : cadangan)
const jepit = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

/** Rapikan nilai (dari localStorage, masukan pemakai, …) ke rentang yang sah. */
export function rapikanTempo(t: Partial<TempoLatihan> | null | undefined): TempoLatihan {
  return {
    mode: t?.mode === 'bpm' ? 'bpm' : 'persen',
    persen: Math.round(jepit(angka(t?.persen, 100), BATAS_PERSEN.min, BATAS_PERSEN.max)),
    geser: Math.round(jepit(angka(t?.geser, 0), BATAS_GESER.min, BATAS_GESER.max)),
  }
}

export function rapikanNaik(n: Partial<NaikOtomatis> | null | undefined): NaikOtomatis {
  const mode: ModeTempoLatihan = n?.mode === 'bpm' ? 'bpm' : 'persen'
  const b = mode === 'bpm' ? BATAS_GESER : BATAS_PERSEN
  const cadMulai = mode === 'bpm' ? -20 : NAIK_BAWAAN.mulai
  const cadSampai = mode === 'bpm' ? 0 : NAIK_BAWAAN.sampai
  return {
    on: !!n?.on,
    mode,
    mulai: Math.round(jepit(angka(n?.mulai, cadMulai), b.min, b.max)),
    naik: Math.round(jepit(Math.abs(angka(n?.naik, 5)), 1, 50)),
    tiap: Math.round(jepit(angka(n?.tiap, 1), 1, 32)),
    sampai: Math.round(jepit(angka(n?.sampai, cadSampai), b.min, b.max)),
    akhir: n?.akhir === 'berhenti' ? 'berhenti' : 'tetap',
  }
}

/** Nilai yang sedang berlaku menurut modenya (persen atau geser BPM). */
export function nilaiTempo(t: TempoLatihan): number {
  return t.mode === 'bpm' ? t.geser : t.persen
}

/** Apakah tempo latihan ini mengubah sesuatu. */
export function latihanAktif(t: TempoLatihan | null | undefined): boolean {
  if (!t) return false
  return t.mode === 'bpm' ? t.geser !== 0 : t.persen !== 100
}

/**
 * Terapkan tempo latihan pada satu tempo yang sudah berlaku.
 * Dipanggil **paling akhir** — sesudah tempo map, luncuran, dan latih tempo.
 */
export function terapkanLatihan(bpm: number, t: TempoLatihan | null | undefined): number {
  if (!Number.isFinite(bpm)) return BPM_TERENDAH
  if (!t || !latihanAktif(t)) return bpm
  const r = rapikanTempo(t)
  const hasil = r.mode === 'bpm' ? bpm + r.geser : (bpm * r.persen) / 100
  return jepit(hasil, BPM_TERENDAH, BPM_TERTINGGI)
}

/** Ganti nilai menurut mode saat ini (dijepit ke batas). */
export function setelNilai(t: TempoLatihan, nilai: number): TempoLatihan {
  return rapikanTempo(t.mode === 'bpm' ? { ...t, geser: nilai } : { ...t, persen: nilai })
}

/** Tombol −5% / +5% (atau −5 / +5 BPM pada mode BPM). */
export function geserLangkah(t: TempoLatihan, arah: 1 | -1, langkah = 5): TempoLatihan {
  return setelNilai(t, nilaiTempo(t) + arah * langkah)
}

/** Ganti mode tanpa membawa nilai: mode baru mulai dari tempo asli. */
export function gantiMode(t: TempoLatihan, mode: ModeTempoLatihan): TempoLatihan {
  if (t.mode === mode) return t
  return { mode, persen: 100, geser: 0 }
}

/** "Latihan 80%" / "Latihan −20 BPM". `null` kalau tempo asli. */
export function labelLatihan(t: TempoLatihan | null | undefined): string | null {
  if (!t || !latihanAktif(t)) return null
  if (t.mode === 'bpm') return `Latihan ${t.geser > 0 ? '+' : '−'}${Math.abs(t.geser)} BPM`
  return `Latihan ${t.persen}%`
}

/** Nilai singkat: "80%" atau "−20 BPM" atau "+5 BPM". */
export function teksNilai(t: TempoLatihan): string {
  if (t.mode === 'bpm') return t.geser === 0 ? '±0 BPM' : `${t.geser > 0 ? '+' : '−'}${Math.abs(t.geser)} BPM`
  return `${t.persen}%`
}

/** "138 BPM (asli 172)" — atau "172 BPM" kalau tempo asli. */
export function labelTempo(bpmAsli: number, t: TempoLatihan | null | undefined): string {
  const asli = Math.round(bpmAsli)
  if (!latihanAktif(t)) return `${asli} BPM`
  return `${Math.round(terapkanLatihan(bpmAsli, t))} BPM (asli ${asli})`
}

/* ----------------------------- naik otomatis ----------------------------- */

/**
 * Nilai (persen atau geser BPM) untuk putaran ke-`putaran` (1-based).
 * Berhenti di tujuan — tidak pernah melewatinya. Kalau `mulai` di atas
 * `sampai`, arahnya turun.
 */
export function nilaiPutaran(n: NaikOtomatis, putaran: number): number {
  const langkahKe = Math.floor((Math.max(1, Math.floor(putaran)) - 1) / Math.max(1, n.tiap))
  const naik = Math.abs(n.naik)
  if (n.sampai >= n.mulai) return Math.min(n.sampai, n.mulai + langkahKe * naik)
  return Math.max(n.sampai, n.mulai - langkahKe * naik)
}

/** Tujuan sudah tercapai pada putaran ini. */
export function tujuanTercapai(n: NaikOtomatis, putaran: number): boolean {
  return nilaiPutaran(n, putaran) === n.sampai
}

/** Tempo latihan untuk putaran ke-`putaran`. */
export function tempoPutaran(n: NaikOtomatis, putaran: number): TempoLatihan {
  const v = nilaiPutaran(n, putaran)
  return rapikanTempo(n.mode === 'bpm' ? { mode: 'bpm', persen: 100, geser: v } : { mode: 'persen', persen: v, geser: 0 })
}

/** "Putaran 3 · 80% → 100%". */
export function labelPutaran(n: NaikOtomatis, putaran: number): string {
  const f = (v: number) => (n.mode === 'bpm' ? `${v > 0 ? '+' : v < 0 ? '−' : '±'}${Math.abs(v)} BPM` : `${v}%`)
  return `Putaran ${putaran} · ${f(nilaiPutaran(n, putaran))} → ${f(n.sampai)}`
}

/* ------------------------------- simpanan -------------------------------- */

/** Kunci localStorage. Sengaja di luar basis data: tidak ikut backup/paket. */
export const KUNCI_SIMPAN = 'drillkit.tempoLatihan.v1'
/** Kunci untuk metronom tanpa lagu. */
export const TANPA_LAGU = '__bebas'

export type PetaLatihan = Record<string, SimpananLatihan>

interface Penyimpan {
  getItem(k: string): string | null
  setItem(k: string, v: string): void
}

function penyimpanBawaan(): Penyimpan | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null
  } catch {
    return null
  }
}

export function bacaSemua(p: Penyimpan | null = penyimpanBawaan()): PetaLatihan {
  if (!p) return {}
  try {
    const mentah = JSON.parse(p.getItem(KUNCI_SIMPAN) ?? '{}') as Record<string, Partial<SimpananLatihan>>
    const hasil: PetaLatihan = {}
    for (const [id, v] of Object.entries(mentah ?? {})) {
      if (!v || typeof v !== 'object') continue
      hasil[id] = { tempo: rapikanTempo(v.tempo), ...(v.naik ? { naik: rapikanNaik(v.naik) } : {}) }
    }
    return hasil
  } catch {
    return {}
  }
}

export function tulisSemua(peta: PetaLatihan, p: Penyimpan | null = penyimpanBawaan()) {
  if (!p) return
  try {
    // Lagu yang kembali ke tempo asli tanpa naik otomatis tidak perlu disimpan.
    const ringkas: PetaLatihan = {}
    for (const [id, v] of Object.entries(peta)) {
      if (latihanAktif(v.tempo) || v.naik?.on || v.tempo.mode === 'bpm') ringkas[id] = v
    }
    p.setItem(KUNCI_SIMPAN, JSON.stringify(ringkas))
  } catch {
    /* localStorage diblokir — lewati saja */
  }
}

/** Tempo latihan satu lagu (tempo asli kalau belum pernah diatur). */
export function tempoLagu(peta: PetaLatihan, songId: string | null | undefined): TempoLatihan {
  return peta[songId || TANPA_LAGU]?.tempo ?? TEMPO_ASLI
}

/** Kembalikan semua lagu ke tempo asli (naik otomatis dimatikan). */
export function semuaAsli(peta: PetaLatihan, ids?: string[]): PetaLatihan {
  const hasil: PetaLatihan = { ...peta }
  for (const id of ids ?? Object.keys(peta)) {
    const lama = hasil[id]
    if (!lama) continue
    hasil[id] = { tempo: { ...TEMPO_ASLI, mode: lama.tempo.mode }, ...(lama.naik ? { naik: { ...lama.naik, on: false } } : {}) }
  }
  return hasil
}
